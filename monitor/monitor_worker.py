import os
import sys
import time
import json
import math
import signal
import logging
import datetime
import threading
import collections

import pymysql
import requests
from dotenv import load_dotenv
import websocket

from indicatorEngine import (
    calcular_ema, calcular_ema_series, calcular_rsi, calcular_atr, calcular_adx,
    calcular_macd, calcular_bollinger, calcular_vwap,
    calcular_cvd_slope, detectar_compressao_volatilidade,
    detectar_divergencia_rsi, identificar_equal_highs, identificar_equal_lows
)
from scoringEngine import calcular_score

load_dotenv()

MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'genesis_db')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 3306))


PARES_MONITORADOS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
    "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT",
    "MATICUSDT", "NEARUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT"
]
TIMEFRAME = "1h"
VOLUME_MINIMO_DIARIO = 50_000_000
SCORE_MINIMO = 65
INTERVALO_DUPLICATAS = 300

WS_URLS = {
    'BINANCE': 'wss://fstream.binance.com/ws',
    'BYBIT': 'wss://stream.bybit.com/v5/public/linear',
    'OKX': 'wss://ws.okx.com:8443/ws/v5/public',
    'BITGET': 'wss://ws.bitget.com/v2/ws/public',
}

logger = logging.getLogger('genesis-monitor')
logger.setLevel(logging.DEBUG)

formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

try:
    from logging.handlers import RotatingFileHandler
    file_handler = RotatingFileHandler(
        '/var/log/genesis-monitor.out.log',
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
except (PermissionError, FileNotFoundError):
    logger.warning("Nao foi possivel criar /var/log/genesis-monitor.out.log — logs so no console")

error_handler = logging.StreamHandler(sys.stderr)
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(formatter)
logger.addHandler(error_handler)

logger.addHandler(console_handler)


class MonitorWorker:
    def __init__(self):
        self.ultimos_alertas = {}
        self.intervalo_duplicatas = INTERVALO_DUPLICATAS
        self.candles_cache = {}
        self.volume_24h_cache = {}
        self._oi_cache = {}
        self._dados_extras_cache = {}
        self._dados_extras_last_fetch = {}
        self.running = True
        self.ws_connections = {}

        # CVD via aggTrade WebSocket
        self._cvd_buffers = {}       # {symbol: deque(maxlen=100)} — snapshots CVD por ativo
        self._cvd_accumulators = {}  # {symbol: float} — CVD acumulado em tempo real
        self._cvd_last_snapshot = {} # {symbol: float} — timestamp do último snapshot

        # Book Imbalance via depth5 WebSocket
        self._orderbook_cache = {}   # {symbol: {'bids': [...], 'asks': [...]}}

        # Fear & Greed Index — cache de 1 hora
        self._fear_greed_cache = None
        self._fear_greed_timestamp = 0

        # Bloquear alertas OPORTUNIDADE consecutivos do mesmo par
        self._ultimo_par_oportunidade = None

        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

        # Persistência de OI no MySQL
        self._criar_tabela_oi()
        self._carregar_oi_banco()

        # Carregar histórico inicial de candles (200 candles por par)
        self._carregar_historico_inicial()

    def _signal_handler(self, signum, frame):
        logger.info("Sinal de desligamento recebido. Encerrando worker...")
        self.running = False
        for corretora, ws in self.ws_connections.items():
            try:
                ws.close()
            except Exception:
                pass

    def conectar_bd(self):
        try:
            return pymysql.connect(
                host=MYSQL_HOST,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                database=MYSQL_DATABASE,
                port=MYSQL_PORT,
                cursorclass=pymysql.cursors.DictCursor,
                charset='utf8mb4'
            )
        except Exception as e:
            logger.error(f"Erro ao conectar no banco de dados: {e}")
            return None

    def _criar_tabela_oi(self):
        """Cria tabela oi_historico no MySQL se não existir."""
        try:
            conn = self.conectar_bd()
            if not conn:
                logger.warning("Não foi possível conectar ao banco para criar tabela oi_historico. Usando cache em memória.")
                return
            with conn.cursor() as cursor:
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS oi_historico (
                        id BIGINT AUTO_INCREMENT PRIMARY KEY,
                        symbol VARCHAR(20) NOT NULL,
                        exchange VARCHAR(20) DEFAULT 'BINANCE',
                        oi_valor DOUBLE NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        INDEX idx_symbol_exchange_created (symbol, exchange, created_at DESC)
                    )
                """)
                conn.commit()
            conn.close()
            logger.debug("Tabela oi_historico verificada/criada com sucesso.")
        except Exception as e:
            logger.warning(f"Erro ao criar tabela oi_historico: {e}. Usando cache em memória.")

    def _carregar_oi_banco(self):
        """Carrega últimos valores de OI do banco para o _oi_cache na inicialização."""
        try:
            conn = self.conectar_bd()
            if not conn:
                logger.warning("Não foi possível conectar ao banco para carregar OI histórico. Cache em memória vazio.")
                return
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT symbol, exchange, oi_valor
                    FROM oi_historico o1
                    WHERE created_at = (
                        SELECT MAX(created_at)
                        FROM oi_historico o2
                        WHERE o2.symbol = o1.symbol AND o2.exchange = o1.exchange
                    )
                """)
                rows = cursor.fetchall()
                for row in rows:
                    cache_key = f"{row['symbol']}_oi"
                    self._oi_cache[cache_key] = row['oi_valor']
            conn.close()
            logger.info(f"OI histórico carregado do banco: {len(self._oi_cache)} ativos.")
        except Exception as e:
            logger.warning(f"Erro ao carregar OI do banco: {e}. Cache em memória vazio.")

    def _buscar_oi_banco(self, symbol):
        """Busca último OI registrado no MySQL para o ativo."""
        try:
            conn = self.conectar_bd()
            if not conn:
                return None
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT oi_valor FROM oi_historico
                    WHERE symbol = %s
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (symbol,))
                row = cursor.fetchone()
            conn.close()
            if row:
                return row['oi_valor']
            return None
        except Exception as e:
            logger.debug(f"Erro ao buscar OI do banco para {symbol}: {e}")
            return None

    def _carregar_historico_inicial(self):
        """Carrega 200 candles iniciais via REST API Binance para cada par monitorado."""
        logger.info("Carregando histórico inicial de candles (200 por par)...")
        pares_carregados = 0
        for symbol in PARES_MONITORADOS:
            try:
                url = "https://fapi.binance.com/fapi/v1/klines"
                params = {
                    "symbol": symbol,
                    "interval": "1h",
                    "limit": 200
                }
                resp = requests.get(url, params=params, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    candles = []
                    for k in data:
                        candle = {
                            'open': float(k[1]),
                            'high': float(k[2]),
                            'low': float(k[3]),
                            'close': float(k[4]),
                            'volume': float(k[5])
                        }
                        candles.append(candle)
                    cache_key = f"{symbol}_BINANCE"
                    self.candles_cache[cache_key] = candles
                    pares_carregados += 1
                    logger.debug(f"  {symbol}: {len(candles)} candles carregados")
                else:
                    logger.warning(f"  {symbol}: falha ao buscar candles (status {resp.status_code})")
            except Exception as e:
                logger.warning(f"  {symbol}: erro ao carregar histórico: {e}")
        logger.info(f"Histórico inicial carregado para {pares_carregados}/{len(PARES_MONITORADOS)} pares.")

    def _disparar_oportunidade(self, symbol, score, vies, preco, corretora, flags=None):
        """Dispara alerta OPORTUNIDADE com bloqueio de par consecutivo.

        Verifica se o último par alertado é o mesmo — se for, descarta silenciosamente.
        Caso contrário, atualiza o último par e dispara processar_alerta().

        Args:
            symbol: Par de trading (ex: BTCUSDT)
            score: Score calculado (0-100)
            vies: Viés calculado (LONG_FORTE, SHORT_MODERADO, NEUTRO, etc.)
            preco: Preço atual do ativo
            corretora: Nome da corretora (ex: BINANCE)
            flags: Lista opcional de flags/indicadores ativos para motivos
        """
        # Bloqueio consecutivo (Req 8.1, 8.2, 8.3)
        if self._ultimo_par_oportunidade == symbol:
            logger.debug(f"Bloqueio consecutivo: {symbol} já foi o último alerta")
            return

        # Atualizar último par alertado
        self._ultimo_par_oportunidade = symbol

        # Determinar direção a partir do viés (Req 9.2)
        if vies in ('LONG_FORTE', 'LONG_MODERADO', 'LONG_LEVE'):
            direcao = 'BULLISH'
        elif vies in ('SHORT_FORTE', 'SHORT_MODERADO', 'SHORT_LEVE'):
            direcao = 'BEARISH'
        else:
            direcao = 'NEUTRO'

        # Formatar motivos a partir das flags
        if flags:
            motivos = [{'label': f, 'value': f} for f in flags]
        else:
            motivos = [{'label': 'OPORTUNIDADE', 'value': f"Score {score}/100 ({vies})"}]

        # Disparar alerta (Req 9.1)
        self.processar_alerta(
            ativo=symbol,
            tipo='OPORTUNIDADE',
            mensagem=f"Score {score} ({vies}) - Oportunidade detectada para {symbol}",
            direcao=direcao,
            urgencia='ALTA',
            corretora=corretora,
            preco_atual=preco,
            score=score,
            motivos=motivos,
        )

    def _gravar_oi_banco(self, symbol, oi_value, exchange='BINANCE'):
        """Grava OI atual no MySQL (tabela oi_historico) com campo exchange."""
        try:
            conn = self.conectar_bd()
            if not conn:
                return
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO oi_historico (symbol, exchange, oi_valor)
                    VALUES (%s, %s, %s)
                """, (symbol, exchange, oi_value))
                conn.commit()
            conn.close()
        except Exception as e:
            logger.debug(f"Erro ao gravar OI no banco para {symbol}: {e}")

    # ─── CVD via aggTrade WebSocket ────────────────────────────────────────

    def _acumular_cvd(self, symbol, trade_msg):
        """Processa mensagem aggTrade e acumula no buffer CVD do ativo.

        trade_msg fields used:
            q (str): quantity
            m (bool): True = seller is maker (venda agressiva), False = buyer is maker (compra agressiva)
        """
        try:
            qty = float(trade_msg.get('q', 0))
            is_seller_maker = trade_msg.get('m', True)

            # Inicializar acumulador se necessário
            if symbol not in self._cvd_accumulators:
                self._cvd_accumulators[symbol] = 0.0
                self._cvd_last_snapshot[symbol] = time.time()
                self._cvd_buffers[symbol] = collections.deque(maxlen=100)

            # m == False → buyer is taker (compra agressiva) → soma CVD
            # m == True → seller is taker (venda agressiva) → subtrai CVD
            if not is_seller_maker:
                self._cvd_accumulators[symbol] += qty
            else:
                self._cvd_accumulators[symbol] -= qty

            # Snapshot CVD a cada ~60 segundos no buffer circular
            now = time.time()
            if now - self._cvd_last_snapshot[symbol] >= 60:
                self._cvd_buffers[symbol].append(self._cvd_accumulators[symbol])
                self._cvd_last_snapshot[symbol] = now

        except Exception as e:
            logger.debug(f"Erro ao acumular CVD para {symbol}: {e}")

    def _calcular_cvd_slope_real(self, symbol):
        """Retorna slope dos últimos 10 valores CVD do buffer, ou 0 se < 60 amostras."""
        buf = self._cvd_buffers.get(symbol)
        if not buf or len(buf) < 60:
            return 0
        ultimos_10 = list(buf)[-10:]
        return calcular_cvd_slope(ultimos_10)

    def _calcular_divergencia_cvd(self, candles, symbol):
        """Calcula divergência entre preço e CVD comparando topos/fundos recentes.

        - Preço topos ascendentes + CVD topos descendentes → 'BEARISH'
        - Preço fundos descendentes + CVD fundos ascendentes → 'BULLISH'
        - Caso contrário → None

        Requer pelo menos 3 candles recentes e 3 amostras CVD no buffer.
        """
        buf = self._cvd_buffers.get(symbol)
        if not buf or len(buf) < 3:
            return None
        if len(candles) < 3:
            return None

        # Usar os últimos 3 pontos de preço (highs para topos, lows para fundos)
        # e os últimos 3 snapshots CVD do buffer
        cvd_recentes = list(buf)[-3:]
        precos_high = [c['high'] for c in candles[-3:]]
        precos_low = [c['low'] for c in candles[-3:]]

        # Preço topos ascendentes + CVD topos descendentes → BEARISH
        preco_topos_asc = all(precos_high[i] < precos_high[i + 1] for i in range(2))
        cvd_topos_desc = all(cvd_recentes[i] > cvd_recentes[i + 1] for i in range(2))

        if preco_topos_asc and cvd_topos_desc:
            return 'BEARISH'

        # Preço fundos descendentes + CVD fundos ascendentes → BULLISH
        preco_fundos_desc = all(precos_low[i] > precos_low[i + 1] for i in range(2))
        cvd_fundos_asc = all(cvd_recentes[i] < cvd_recentes[i + 1] for i in range(2))

        if preco_fundos_desc and cvd_fundos_asc:
            return 'BULLISH'

        return None

    def _atualizar_orderbook(self, symbol, depth_msg):
        """Atualiza cache com 5 melhores níveis bid/ask a partir de mensagem depth5."""
        try:
            bids = depth_msg.get('bids', depth_msg.get('b', []))
            asks = depth_msg.get('asks', depth_msg.get('a', []))
            if bids and asks:
                self._orderbook_cache[symbol] = {
                    'bids': [[float(p), float(q)] for p, q in bids[:5]],
                    'asks': [[float(p), float(q)] for p, q in asks[:5]],
                }
        except Exception as e:
            logger.debug(f"Erro ao atualizar orderbook para {symbol}: {e}")

    def _calcular_book_imbalance(self, symbol):
        """Retorna (sum_bids - sum_asks) / (sum_bids + sum_asks) ou None se cache vazio."""
        cache = self._orderbook_cache.get(symbol)
        if not cache:
            return None
        bids = cache.get('bids', [])
        asks = cache.get('asks', [])
        if not bids or not asks:
            return None
        sum_bids = sum(qty for _, qty in bids)
        sum_asks = sum(qty for _, qty in asks)
        total = sum_bids + sum_asks
        if total == 0:
            return None
        return (sum_bids - sum_asks) / total

    def _detectar_macd_zero_cross(self, closes):
        """Detecta cruzamento do MACD pela linha zero.
        Retorna: 'BULLISH', 'BEARISH', ou None.
        """
        if len(closes) < 36:  # slow(26) + signal(9) + 1 mínimo
            return None
        macd_atual_result = calcular_macd(closes)
        macd_anterior_result = calcular_macd(closes[:-1])
        if macd_atual_result is None or macd_anterior_result is None:
            return None
        macd_atual = macd_atual_result['macd']
        macd_anterior = macd_anterior_result['macd']
        if macd_atual > 0 and macd_anterior <= 0:
            return 'BULLISH'
        if macd_atual < 0 and macd_anterior >= 0:
            return 'BEARISH'
        return None

    def obter_multiplicador_sessao(self):
        """Retorna multiplicador baseado na sessão UTC atual.
        Ásia (00:00–08:00) → 0.85; Londres (08:00–13:00) → 0.95;
        Nova York (13:00–21:00) → 1.00; Overnight (21:00–00:00) → 0.90
        """
        hora_utc = datetime.datetime.utcnow().hour
        if 0 <= hora_utc < 8:
            return 0.85
        elif 8 <= hora_utc < 13:
            return 0.95
        elif 13 <= hora_utc < 21:
            return 1.00
        else:
            return 0.90

    def gravar_banco(self, alerta, enviado_telegram):
        """Grava alerta direto no MySQL via pymysql (evita timeout do artisan serve single-thread).
        
        Campos obrigatórios: ativo, tipo, mensagem, direcao, urgencia, corretora, timeframe,
        preco_atual, variacao_pct, score.
        Campos JSON extras: motivos, timeframes (serializados como JSON string).
        
        Resiliência: exceções de conexão/gravação são logadas mas NUNCA propagadas
        ao loop principal do worker (Req 24.3).
        """
        try:
            conn = self.conectar_bd()
            if not conn:
                logger.error("Não foi possível conectar ao banco para gravar alerta.")
                return

            try:
                with conn.cursor() as cursor:
                    # Serializar campos JSON extras
                    motivos_json = json.dumps(alerta.get('motivos'), ensure_ascii=False) if alerta.get('motivos') is not None else None
                    timeframes_json = json.dumps(alerta.get('timeframes'), ensure_ascii=False) if alerta.get('timeframes') is not None else None

                    sql = """
                        INSERT INTO genesis_alertas
                            (ativo, tipo, mensagem, direcao, urgencia, corretora, timeframe,
                             preco_atual, variacao_pct, motivos, timeframes, score,
                             enviado_sse, enviado_telegram, criado_em, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s, NOW(), NOW())
                    """
                    cursor.execute(sql, (
                        alerta['ativo'],
                        alerta['tipo'],
                        alerta['mensagem'],
                        alerta['direcao'],
                        alerta['urgencia'],
                        alerta['corretora'],
                        alerta.get('timeframe', '1h'),
                        alerta['preco_atual'],
                        alerta['variacao_pct'],
                        motivos_json,
                        timeframes_json,
                        alerta.get('score', 0),
                        1 if enviado_telegram else 0,
                    ))
                    conn.commit()
                    logger.info(f"Alerta gravado no banco: {alerta['ativo']} - {alerta['tipo']}")
            finally:
                conn.close()
        except Exception as e:
            # Resiliência: log error, nunca propagar exceção ao loop principal (Req 24.3)
            logger.error(f"Erro ao gravar alerta no banco: {e}")

    def processar_alerta(self, ativo, tipo, mensagem, direcao, urgencia, corretora, preco_atual, variacao_pct=0.0, score=0, motivos=None, timeframes=None):
        chave_cache = f"{ativo}_{tipo}_{corretora}"
        agora = time.time()

        ultimo = self.ultimos_alertas.get(chave_cache, 0)
        if agora - ultimo < self.intervalo_duplicatas:
            logger.debug(f"Alerta duplicado ignorado: {chave_cache}")
            return

        self.ultimos_alertas[chave_cache] = agora

        # Build motivos from provided list or default from tipo/mensagem
        if motivos is None:
            motivos = [{'label': tipo, 'value': mensagem}]

        # Build timeframes from provided list or default to current TIMEFRAME
        if timeframes is None:
            timeframes = [TIMEFRAME]

        alerta = {
            'ativo': ativo,
            'tipo': tipo,
            'mensagem': mensagem,
            'direcao': direcao,
            'urgencia': urgencia,
            'corretora': corretora,
            'timeframe': TIMEFRAME,
            'preco_atual': preco_atual,
            'variacao_pct': variacao_pct,
            'score': score,
            'motivos': motivos,
            'timeframes': timeframes,
        }

        logger.info(f"🔔 Novo Alerta Detectado! {alerta['tipo']} - {alerta['ativo']} ({alerta['corretora']})")

        self.gravar_banco(alerta, False)

    def filtrar_volume(self, ativo, volume_24h):
        if volume_24h < VOLUME_MINIMO_DIARIO:
            logger.debug(f"Par {ativo} descartado: volume ${volume_24h:,.0f} abaixo do minimo de ${VOLUME_MINIMO_DIARIO:,.0f}")
            return False
        return True

    def filtrar_score(self, score):
        if score < SCORE_MINIMO:
            logger.debug(f"Score {score} abaixo do minimo de {SCORE_MINIMO}. Alerta nao disparado.")
            return False
        return True

    def calcular_indicadores_e_score(self, candles, dados_extras):
        if len(candles) < 50:
            return None

        closes = [c['close'] for c in candles]

        ema21 = calcular_ema(closes, 21)
        ema50 = calcular_ema(closes, 50) if len(closes) >= 100 else None
        ema200 = calcular_ema(closes, 200) if len(closes) >= 400 else None
        rsi = calcular_rsi(closes, 14)
        atr = calcular_atr(candles, 14)
        adx_result = calcular_adx(candles, 14)
        macd_result = calcular_macd(closes)
        boll_result = calcular_bollinger(closes, 20, 2)

        preco_atual = closes[-1]
        preco_anterior = closes[-2] if len(closes) >= 2 else preco_atual

        # Corr.9: preco_subindo via EMA21 (fallback para 2-candle se EMA indisponível)
        ema21_subindo = None
        if ema21 is not None and len(closes) >= 22:
            ema21_ant = calcular_ema(closes[:-1], 21)
            ema21_subindo = ema21 > ema21_ant if ema21_ant else None

        preco_subindo = ema21_subindo if ema21_subindo is not None else preco_atual > preco_anterior

        ema200_subindo = None
        if ema200 is not None and len(closes) >= 201:
            ema200_ant = calcular_ema(closes[:-1], 200)
            ema200_subindo = ema200 > ema200_ant if ema200_ant else None

        # Gerar série de valores RSI para detecção de divergência
        divergencia_rsi = 'NENHUMA'
        if len(closes) >= 20:
            periodo_rsi = 14
            rsi_series = []
            if len(closes) > periodo_rsi:
                gains = 0
                losses = 0
                for i in range(1, periodo_rsi + 1):
                    diff = closes[i] - closes[i - 1]
                    if diff > 0:
                        gains += diff
                    else:
                        losses -= diff
                avg_gain = gains / periodo_rsi
                avg_loss = losses / periodo_rsi
                # Primeiros periodo_rsi valores sem RSI
                rsi_series = [None] * periodo_rsi
                # RSI no índice periodo_rsi
                if avg_loss == 0:
                    rsi_series.append(99.0)
                elif avg_gain == 0:
                    rsi_series.append(1.0)
                else:
                    rs = avg_gain / avg_loss
                    rsi_series.append(100 - (100 / (1 + rs)))
                # RSI para cada candle subsequente
                for i in range(periodo_rsi + 1, len(closes)):
                    diff = closes[i] - closes[i - 1]
                    if diff > 0:
                        avg_gain = (avg_gain * (periodo_rsi - 1) + diff) / periodo_rsi
                        avg_loss = (avg_loss * (periodo_rsi - 1)) / periodo_rsi
                    else:
                        avg_gain = (avg_gain * (periodo_rsi - 1)) / periodo_rsi
                        avg_loss = (avg_loss * (periodo_rsi - 1) - diff) / periodo_rsi
                    if avg_loss == 0:
                        rsi_series.append(99.0)
                    elif avg_gain == 0:
                        rsi_series.append(1.0)
                    else:
                        rs = avg_gain / avg_loss
                        rsi_series.append(100 - (100 / (1 + rs)))
            if len(rsi_series) >= 20:
                divergencia_rsi = detectar_divergencia_rsi(candles, rsi_series)

        dados_score = {
            'preco': preco_atual,
            'ema200': ema200,
            'ema200_subindo': ema200_subindo,
            'rsi': rsi,
            'adx': adx_result['adx'] if adx_result else None,
            'preco_subindo': preco_subindo,
            'macd_acima_signal': (macd_result['macd'] > macd_result['signal']) if macd_result else None,
            'histograma_subindo': (macd_result['histogram'] > 0) if macd_result else None,
            'macd_cruza_zero': self._detectar_macd_zero_cross(closes),
            'compressao_detectada': False,
            'cvd_slope': dados_extras.get('cvd_slope', 0),
            'book_imbalance_ratio': dados_extras.get('book_imbalance_ratio'),
            'funding_medio': dados_extras.get('funding_rate'),
            'oi_subindo': dados_extras.get('oi_subindo'),
            'ls_ratio_longs': dados_extras.get('ls_ratio'),
            'fear_greed': self.buscar_fear_greed(),
            'divergencia_rsi': divergencia_rsi,
            'divergencia_cvd': self._calcular_divergencia_cvd(candles, dados_extras.get('symbol', '')),
            'cluster_liquidacao_acima': dados_extras.get('cluster_liquidacao_acima'),
            'cluster_liquidacao_abaixo': dados_extras.get('cluster_liquidacao_abaixo'),
        }

        compressao = detectar_compressao_volatilidade(candles)
        if compressao:
            dados_score['compressao_detectada'] = compressao['compressao_detectada']
            dados_score['nivel_compressao'] = compressao['nivel_compressao']

        resultado = calcular_score(dados_score)
        return resultado

    def detectar_spike_volume(self, dados_mercado):
        volume_atual = dados_mercado.get('volume_atual', 0)
        sma20_volume = dados_mercado.get('sma20_volume', 1)

        if sma20_volume > 0 and volume_atual > (3 * sma20_volume):
            direcao_candle = 'BULLISH' if dados_mercado['close'] > dados_mercado['open'] else 'BEARISH'
            self.processar_alerta(
                ativo=dados_mercado['ativo'],
                tipo='SPIKE_VOLUME',
                mensagem=f"Volume anormal detectado: {math.floor(volume_atual/sma20_volume)}x maior que a media recente (SMA 20).",
                direcao=direcao_candle,
                urgencia='ALTA',
                corretora=dados_mercado.get('corretora', 'BINANCE'),
                preco_atual=dados_mercado['close']
            )

    def detectar_movimento_brusco(self, variacao_1m, dados_mercado):
        if abs(variacao_1m) >= 1.5:
            direcao = 'BULLISH' if variacao_1m > 0 else 'BEARISH'
            self.processar_alerta(
                ativo=dados_mercado['ativo'],
                tipo='MOVIMENTO_BRUSCO',
                mensagem=f"Acao de preco violenta: variacao de {variacao_1m:.2f}% nos ultimos 60 segundos.",
                direcao=direcao,
                urgencia='ALTA',
                corretora=dados_mercado.get('corretora', 'BINANCE'),
                preco_atual=dados_mercado['close'],
                variacao_pct=variacao_1m
            )

    def detectar_divergencia_cvd(self, preco_candles_recentes, cvd_candles_recentes, dados_mercado):
        if len(preco_candles_recentes) >= 3 and len(cvd_candles_recentes) >= 3:
            preco_up = all(preco_candles_recentes[i] < preco_candles_recentes[i+1] for i in range(2))
            cvd_down = all(cvd_candles_recentes[i] > cvd_candles_recentes[i+1] for i in range(2))
            preco_down = all(preco_candles_recentes[i] > preco_candles_recentes[i+1] for i in range(2))
            cvd_up = all(cvd_candles_recentes[i] < cvd_candles_recentes[i+1] for i in range(2))

            if preco_up and cvd_down:
                self.processar_alerta(
                    ativo=dados_mercado['ativo'],
                    tipo='CVD_DIVERGENCIA',
                    mensagem="Falso rompimento de alto detectado: Preco fazendo topos ascendentes, mas agressao vendedora domina (Divergencia CVD).",
                    direcao='BEARISH',
                    urgencia='MEDIA',
                    corretora=dados_mercado.get('corretora', 'BINANCE'),
                    preco_atual=dados_mercado['close']
                )
            elif preco_down and cvd_up:
                self.processar_alerta(
                    ativo=dados_mercado['ativo'],
                    tipo='CVD_DIVERGENCIA',
                    mensagem="Falso rompimento de baixa detectado: Preco fazendo fundos descendentes, mas agressao compradora domina (Divergencia CVD).",
                    direcao='BULLISH',
                    urgencia='MEDIA',
                    corretora=dados_mercado.get('corretora', 'BINANCE'),
                    preco_atual=dados_mercado['close']
                )

    def detectar_funding_extremo(self, funding_rate, dados_mercado):
        if funding_rate > 0.05:
            self.processar_alerta(
                ativo=dados_mercado['ativo'],
                tipo='FUNDING_EXTREMO',
                mensagem=f"Funding Rate positivo ({funding_rate:.4f}%). Mercado sobrealavancado em Long. Risco de Long Squeeze.",
                direcao='BEARISH',
                urgencia='ALTA',
                corretora=dados_mercado.get('corretora', 'BINANCE'),
                preco_atual=dados_mercado['close']
            )
        elif funding_rate < -0.03:
            self.processar_alerta(
                ativo=dados_mercado['ativo'],
                tipo='FUNDING_EXTREMO',
                mensagem=f"Funding Rate negativo ({funding_rate:.4f}%). Mercado sobrealavancado em Short. Risco de Short Squeeze.",
                direcao='BULLISH',
                urgencia='ALTA',
                corretora=dados_mercado.get('corretora', 'BINANCE'),
                preco_atual=dados_mercado['close']
            )

    def detectar_oi_spike(self, oi_anterior, oi_atual, dados_mercado):
        if oi_anterior > 0:
            variacao = ((oi_atual - oi_anterior) / oi_anterior) * 100
            if variacao > 5.0:
                self.processar_alerta(
                    ativo=dados_mercado['ativo'],
                    tipo='OI_SPIKE',
                    mensagem=f"Aumento massivo de Contratos em Aberto: {variacao:.2f}% injetado nos ultimos 5 minutos.",
                    direcao='NEUTRO',
                    urgencia='ALTA',
                    corretora=dados_mercado.get('corretora', 'BINANCE'),
                    preco_atual=dados_mercado['close'],
                    variacao_pct=variacao
                )

    def detectar_book_imbalance(self, hist_bid, hist_ask, dados_mercado):
        if len(hist_bid) >= 2 and len(hist_ask) >= 2:
            ratios = []
            for i in range(-2, 0):
                total = hist_bid[i] + hist_ask[i]
                if total > 0:
                    delta = (hist_bid[i] - hist_ask[i]) / total
                    ratios.append(delta)

            if len(ratios) == 2:
                if all(r > 0.35 for r in ratios):
                    self.processar_alerta(
                        ativo=dados_mercado['ativo'],
                        tipo='BOOK_IMBALANCE',
                        mensagem="Pressao compradora estrutural: Bids excedem Asks consideravelmente.",
                        direcao='BULLISH',
                        urgencia='MEDIA',
                        corretora=dados_mercado.get('corretora', 'BINANCE'),
                        preco_atual=dados_mercado['close']
                    )
                elif all(r < -0.35 for r in ratios):
                    self.processar_alerta(
                        ativo=dados_mercado['ativo'],
                        tipo='BOOK_IMBALANCE',
                        mensagem="Pressao vendedora estrutural: Asks excedem Bids consideravelmente.",
                        direcao='BEARISH',
                        urgencia='MEDIA',
                        corretora=dados_mercado.get('corretora', 'BINANCE'),
                        preco_atual=dados_mercado['close']
                    )


    def detectar_liquidation_cascade(self, candles_recentes, dados_mercado):
        if len(candles_recentes) < 4:
            return
        ultimos4 = candles_recentes[-4:]
        todos_bullish = all(c["close"] > c["open"] for c in ultimos4[1:])
        todos_bearish = all(c["close"] < c["open"] for c in ultimos4[1:])
        if not todos_bullish and not todos_bearish:
            return
        variacao_total = abs(ultimos4[-1]["close"] - ultimos4[0]["close"]) / ultimos4[0]["close"] * 100
        if variacao_total < 1.5:
            return
        vol_3 = sum(c["volume"] for c in ultimos4[1:])
        vol_ant = sum(c["volume"] for c in candles_recentes[-10:-4]) / 6 if len(candles_recentes) >= 10 else 1
        if vol_ant > 0 and vol_3 < 2 * vol_ant:
            return
        direcao = "BEARISH" if todos_bearish else "BULLISH"
        self.processar_alerta(
            ativo=dados_mercado["ativo"],
            tipo="LIQUIDATION_CASCADE",
            mensagem=f"Cascata de liquidacoes detectada: {variacao_total:.2f}% em 3 candles consecutivos com volume alto.",
            direcao=direcao,
            urgencia="ALTA",
            corretora=dados_mercado.get("corretora", "BINANCE"),
            preco_atual=dados_mercado["close"],
            variacao_pct=variacao_total
        )

    def buscar_funding_rate(self, symbol):
        """Busca funding rate atual via REST API Binance (/fapi/v1/premiumIndex)"""
        try:
            url = "https://fapi.binance.com/fapi/v1/premiumIndex"
            resp = requests.get(url, params={"symbol": symbol}, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                funding_rate = float(data.get("lastFundingRate", 0))
                return funding_rate
        except Exception as e:
            logger.debug(f"Erro ao buscar funding rate para {symbol}: {e}")
        return None

    def buscar_open_interest(self, symbol):
        """Busca Open Interest atual via REST API Binance (/fapi/v1/openInterest)"""
        try:
            url = "https://fapi.binance.com/fapi/v1/openInterest"
            resp = requests.get(url, params={"symbol": symbol}, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                oi = float(data.get("openInterest", 0))
                return oi
        except Exception as e:
            logger.debug(f"Erro ao buscar open interest para {symbol}: {e}")
        return None

    def buscar_fear_greed(self):
        """Busca Fear & Greed Index de alternative.me com cache de 1 hora."""
        try:
            if time.time() - self._fear_greed_timestamp < 3600:
                return self._fear_greed_cache
            resp = requests.get("https://api.alternative.me/fng/", timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                value = int(data['data'][0]['value'])
                self._fear_greed_cache = value
                self._fear_greed_timestamp = time.time()
                return value
            else:
                logger.debug(f"Fear & Greed API retornou status {resp.status_code}")
                return self._fear_greed_cache
        except Exception as e:
            logger.debug(f"Erro ao buscar Fear & Greed: {e}")
            return self._fear_greed_cache

    def buscar_ls_ratio(self, symbol):
        """Busca L/S ratio agregado de até 4 exchanges. Retorna proporção de longs (0.0-1.0) ou None."""
        ratios = []

        # Binance
        try:
            resp = requests.get(
                "https://fapi.binance.com/futures/data/globalLongShortAccountRatio",
                params={"symbol": symbol, "period": "1h", "limit": 1},
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0:
                    long_account = float(data[0].get("longAccount", 0))
                    if 0 <= long_account <= 1:
                        ratios.append(long_account)
        except Exception as e:
            logger.debug(f"L/S Ratio Binance falhou para {symbol}: {e}")

        # Bybit
        try:
            resp = requests.get(
                "https://api.bybit.com/v5/market/account-ratio",
                params={"category": "linear", "symbol": symbol, "period": "1h", "limit": 1},
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                result_list = data.get("result", {}).get("list", [])
                if result_list and len(result_list) > 0:
                    buy_ratio = float(result_list[0].get("buyRatio", 0))
                    if 0 <= buy_ratio <= 1:
                        ratios.append(buy_ratio)
        except Exception as e:
            logger.debug(f"L/S Ratio Bybit falhou para {symbol}: {e}")

        # Bitget
        try:
            resp = requests.get(
                "https://api.bitget.com/api/v2/mix/market/long-short-ratio",
                params={"symbol": symbol, "period": "1h"},
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                result_list = data.get("data", [])
                if result_list and len(result_list) > 0:
                    long_ratio = float(result_list[0].get("longAccountRatio", 0))
                    if 0 <= long_ratio <= 1:
                        ratios.append(long_ratio)
        except Exception as e:
            logger.debug(f"L/S Ratio Bitget falhou para {symbol}: {e}")

        # OKX
        try:
            inst_id = symbol.replace("USDT", "-USDT-SWAP")
            resp = requests.get(
                "https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader",
                params={"instId": inst_id, "period": "1H"},
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json()
                result_list = data.get("data", [])
                if result_list and len(result_list) > 0:
                    # OKX returns longShortRatio = longs/shorts, convert to proportion
                    ls_ratio_raw = float(result_list[0][1]) if len(result_list[0]) > 1 else None
                    if ls_ratio_raw is not None and ls_ratio_raw >= 0:
                        long_proportion = ls_ratio_raw / (1 + ls_ratio_raw)
                        if 0 <= long_proportion <= 1:
                            ratios.append(long_proportion)
        except Exception as e:
            logger.debug(f"L/S Ratio OKX falhou para {symbol}: {e}")

        if not ratios:
            return None

        avg_ratio = sum(ratios) / len(ratios)
        return max(0.0, min(1.0, avg_ratio))

    def buscar_liquidacoes_recentes(self, symbol, janela_minutos=5):
        """Busca liquidações reais via /fapi/v1/allForceOrders da Binance.
        Classifica LONG abaixo do preço como cluster_abaixo e SHORT acima como cluster_acima.
        Retorna: {'cluster_acima': float|None, 'cluster_abaixo': float|None}
        """
        try:
            url = "https://fapi.binance.com/fapi/v1/allForceOrders"
            resp = requests.get(url, params={"symbol": symbol}, timeout=5)
            if resp.status_code != 200:
                logger.debug(f"Liquidacoes API retornou status {resp.status_code} para {symbol}")
                return {'cluster_acima': None, 'cluster_abaixo': None}

            liquidacoes = resp.json()
            if not liquidacoes:
                return {'cluster_acima': None, 'cluster_abaixo': None}

            # Filtrar por janela de tempo
            agora_ms = time.time() * 1000
            janela_ms = janela_minutos * 60 * 1000
            recentes = [liq for liq in liquidacoes if agora_ms - liq.get('time', 0) <= janela_ms]

            if not recentes:
                return {'cluster_acima': None, 'cluster_abaixo': None}

            # Obter preço atual para classificação
            preco_atual = None
            try:
                ticker_resp = requests.get(
                    "https://fapi.binance.com/fapi/v1/ticker/price",
                    params={"symbol": symbol}, timeout=3
                )
                if ticker_resp.status_code == 200:
                    preco_atual = float(ticker_resp.json().get('price', 0))
            except Exception:
                pass

            if not preco_atual:
                return {'cluster_acima': None, 'cluster_abaixo': None}

            # Classificar liquidações: LONG abaixo do preço → cluster_abaixo, SHORT acima → cluster_acima
            longs_abaixo = []  # (preco, qty)
            shorts_acima = []  # (preco, qty)

            for liq in recentes:
                liq_preco = float(liq.get('price', 0))
                liq_qty = float(liq.get('origQty', 0) or liq.get('executedQty', 0))
                side = liq.get('side', '').upper()

                if liq_preco <= 0 or liq_qty <= 0:
                    continue

                # Liquidação de posição LONG = ordem SELL forçada (preço abaixo do atual)
                if side == 'SELL' and liq_preco < preco_atual:
                    longs_abaixo.append((liq_preco, liq_qty))
                # Liquidação de posição SHORT = ordem BUY forçada (preço acima do atual)
                elif side == 'BUY' and liq_preco > preco_atual:
                    shorts_acima.append((liq_preco, liq_qty))

            # Calcular preço médio ponderado por quantidade para cada cluster
            cluster_abaixo = None
            if longs_abaixo:
                total_qty = sum(qty for _, qty in longs_abaixo)
                if total_qty > 0:
                    cluster_abaixo = sum(p * q for p, q in longs_abaixo) / total_qty

            cluster_acima = None
            if shorts_acima:
                total_qty = sum(qty for _, qty in shorts_acima)
                if total_qty > 0:
                    cluster_acima = sum(p * q for p, q in shorts_acima) / total_qty

            return {'cluster_acima': cluster_acima, 'cluster_abaixo': cluster_abaixo}

        except Exception as e:
            logger.debug(f"Erro ao buscar liquidacoes recentes para {symbol}: {e}")
            return {'cluster_acima': None, 'cluster_abaixo': None}

    def buscar_dados_extras(self, ativo):
        """Busca dados extras reais (funding, OI, L/S ratio) via REST APIs para enriquecer detecção de anomalias"""
        funding_rate = self.buscar_funding_rate(ativo)
        oi_atual = self.buscar_open_interest(ativo)
        ls_ratio = self.buscar_ls_ratio(ativo)

        # Determinar se OI está subindo comparando com cache anterior (fallback para banco)
        cache_key = f"{ativo}_oi"
        oi_anterior = self._oi_cache.get(cache_key)
        if oi_anterior is None:
            oi_anterior = self._buscar_oi_banco(ativo)
            if oi_anterior is not None:
                self._oi_cache[cache_key] = oi_anterior
        oi_subindo = None
        if oi_anterior is not None and oi_atual is not None:
            oi_subindo = oi_atual > oi_anterior
        if oi_atual is not None:
            self._oi_cache[cache_key] = oi_atual
            self._gravar_oi_banco(ativo, oi_atual)

        # Buscar liquidações reais
        liquidacoes = self.buscar_liquidacoes_recentes(ativo)

        return {
            'cvd_slope': self._calcular_cvd_slope_real(ativo),
            'book_imbalance_ratio': self._calcular_book_imbalance(ativo),
            'funding_rate': funding_rate,
            'oi_subindo': oi_subindo,
            'oi_atual': oi_atual,
            'oi_anterior': oi_anterior,
            'ls_ratio': ls_ratio,
            'cluster_liquidacao_acima': liquidacoes.get('cluster_acima'),
            'cluster_liquidacao_abaixo': liquidacoes.get('cluster_abaixo'),
        }

    def detectar_spot_futures_divergencia(self, symbol, preco_futures, dados_mercado):
        try:
            pair = symbol if symbol.endswith("USDT") else symbol + "USDT"
            resp = requests.get("https://api.binance.com/api/v3/ticker/price", params={"symbol": pair}, timeout=3)
            if resp.status_code != 200:
                return
            preco_spot = float(resp.json()["price"])
            if preco_spot <= 0:
                return
            divergencia = abs(preco_futures - preco_spot) / preco_spot * 100
            if divergencia < 0.3:
                return
            if preco_futures > preco_spot:
                direcao = "BEARISH"
                msg = f"Futures {divergencia:.2f}% acima do Spot. Mercado sobrealavancado em Long."
            else:
                direcao = "BULLISH"
                msg = f"Futures {divergencia:.2f}% abaixo do Spot. Mercado sobrealavancado em Short."
            self.processar_alerta(
                ativo=symbol,
                tipo="SPOT_FUTURES_DIVERGENCIA",
                mensagem=msg,
                direcao=direcao,
                urgencia="MEDIA",
                corretora=dados_mercado.get("corretora", "BINANCE"),
                preco_atual=preco_futures,
                variacao_pct=divergencia
            )
        except Exception as e:
            logger.debug(f"Erro ao checar divergencia spot/futures: {e}")

    def processar_candle(self, ativo, corretora, candle):
        cache_key = f"{ativo}_{corretora}"
        if cache_key not in self.candles_cache:
            self.candles_cache[cache_key] = []
        self.candles_cache[cache_key].append(candle)
        if len(self.candles_cache[cache_key]) > 500:
            self.candles_cache[cache_key] = self.candles_cache[cache_key][-500:]

        candles = self.candles_cache[cache_key]
        closes = [c['close'] for c in candles]

        if len(closes) < 22:
            return

        volume_24h = sum(c['volume'] for c in candles[-24:])
        if not self.filtrar_volume(ativo, volume_24h):
            return

        volume_24h_usd = volume_24h * closes[-1]
        if volume_24h_usd < VOLUME_MINIMO_DIARIO:
            logger.debug(f"Par {ativo} descartado: volume 24h em USD ${volume_24h_usd:,.0f} abaixo do minimo")
            return

        sma20_volume = sum(c['volume'] for c in candles[-20:]) / 20 if len(candles) >= 20 else 1
        dados_mercado = {
            'ativo': ativo,
            'corretora': corretora,
            'close': closes[-1],
            'open': candles[-1]['open'],
            'volume_atual': candles[-1]['volume'],
            'sma20_volume': sma20_volume,
        }

        self.detectar_spike_volume(dados_mercado)

        if len(closes) >= 2:
            variacao = ((closes[-1] - closes[-2]) / closes[-2]) * 100
            self.detectar_movimento_brusco(variacao, dados_mercado)

        # Buscar dados extras reais via REST API Binance
        funding_rate = self.buscar_funding_rate(ativo)
        oi_atual = self.buscar_open_interest(ativo)

        # Determinar se OI está subindo comparando com cache anterior (fallback para banco)
        oi_cache_key = f"{ativo}_oi"
        oi_anterior = self._oi_cache.get(oi_cache_key)
        if oi_anterior is None:
            oi_anterior = self._buscar_oi_banco(ativo)
            if oi_anterior is not None:
                self._oi_cache[oi_cache_key] = oi_anterior
        oi_subindo = None
        if oi_anterior is not None and oi_atual is not None:
            oi_subindo = oi_atual > oi_anterior
        if oi_atual is not None:
            self._oi_cache[oi_cache_key] = oi_atual
            self._gravar_oi_banco(ativo, oi_atual)

        dados_extras = {
            'cvd_slope': self._calcular_cvd_slope_real(ativo),
            'book_imbalance_ratio': self._calcular_book_imbalance(ativo),
            'funding_rate': funding_rate,
            'oi_subindo': oi_subindo,
            'oi_atual': oi_atual,
            'oi_anterior': oi_anterior,
            'ls_ratio': self.buscar_ls_ratio(ativo),
            'symbol': ativo,
        }

        # Buscar liquidações reais via Binance API
        liquidacoes = self.buscar_liquidacoes_recentes(ativo)
        cluster_acima = liquidacoes.get('cluster_acima')
        cluster_abaixo = liquidacoes.get('cluster_abaixo')

        # Melhoria 2: Equal Highs/Lows conectados ao cluster_liquidacao
        try:
            preco_atual = closes[-1]
            equal_highs = identificar_equal_highs(candles)
            equal_lows = identificar_equal_lows(candles)

            # Filtrar equal highs acima do preço e dentro de 1.5%
            eq_acima = [h for h in equal_highs if h > preco_atual and (h - preco_atual) / preco_atual <= 0.015]
            if eq_acima:
                eq_mais_proximo_acima = min(eq_acima, key=lambda x: x - preco_atual)
                # Usar equal level apenas se não há cluster real ou se equal level está mais próximo
                if cluster_acima is None:
                    cluster_acima = eq_mais_proximo_acima
                else:
                    # Nunca sobrescrever cluster real com equal level mais distante
                    if eq_mais_proximo_acima < cluster_acima:
                        cluster_acima = eq_mais_proximo_acima

            # Filtrar equal lows abaixo do preço e dentro de 1.5%
            eq_abaixo = [l for l in equal_lows if l < preco_atual and (preco_atual - l) / preco_atual <= 0.015]
            if eq_abaixo:
                eq_mais_proximo_abaixo = max(eq_abaixo, key=lambda x: x)
                # Usar equal level apenas se não há cluster real ou se equal level está mais próximo
                if cluster_abaixo is None:
                    cluster_abaixo = eq_mais_proximo_abaixo
                else:
                    # Nunca sobrescrever cluster real com equal level mais distante
                    if eq_mais_proximo_abaixo > cluster_abaixo:
                        cluster_abaixo = eq_mais_proximo_abaixo
        except Exception as e:
            logger.debug(f"Erro ao calcular equal highs/lows para {ativo}: {e}")

        dados_extras['cluster_liquidacao_acima'] = cluster_acima
        dados_extras['cluster_liquidacao_abaixo'] = cluster_abaixo

        resultado_score = self.calcular_indicadores_e_score(candles, dados_extras)

        # Melhoria 5: Aplicar multiplicador de sessão ao score final
        if resultado_score and resultado_score.get('score_final') is not None:
            multiplicador = self.obter_multiplicador_sessao()
            score_ajustado = resultado_score['score_final'] * multiplicador
            # Manter múltiplo de 5, clamp [0,100]
            score_ajustado = round(score_ajustado / 5) * 5
            score_ajustado = max(0, min(100, score_ajustado))
            resultado_score['score_final'] = score_ajustado
            # Recalcular viés com score ajustado
            if score_ajustado > 84:
                resultado_score['vies'] = 'LONG_FORTE'
            elif 70 <= score_ajustado <= 84:
                resultado_score['vies'] = 'LONG_MODERADO'
            elif 55 <= score_ajustado <= 69:
                resultado_score['vies'] = 'LONG_LEVE'
            elif 45 <= score_ajustado <= 54:
                resultado_score['vies'] = 'NEUTRO'
            elif 31 <= score_ajustado <= 44:
                resultado_score['vies'] = 'SHORT_LEVE'
            elif 16 <= score_ajustado <= 30:
                resultado_score['vies'] = 'SHORT_MODERADO'
            else:
                resultado_score['vies'] = 'SHORT_FORTE'

        self.detectar_liquidation_cascade(candles, dados_mercado)
        self.detectar_spot_futures_divergencia(ativo, candles[-1]['close'], dados_mercado)

        # Acionar detecção de anomalias com dados reais de funding e OI
        if dados_extras.get('funding_rate') is not None:
            self.detectar_funding_extremo(dados_extras['funding_rate'], dados_mercado)

        if dados_extras.get('oi_anterior') is not None and dados_extras.get('oi_atual') is not None:
            self.detectar_oi_spike(dados_extras['oi_anterior'], dados_extras['oi_atual'], dados_mercado)

        # Book Imbalance alert detection via _calcular_book_imbalance (Req 11.1, 11.2)
        book_imbalance_ratio = self._calcular_book_imbalance(ativo)
        if book_imbalance_ratio is not None:
            if book_imbalance_ratio > 0.6:
                self.processar_alerta(
                    ativo=ativo,
                    tipo='BOOK_IMBALANCE',
                    mensagem=f"Pressao compradora estrutural: ratio {book_imbalance_ratio:.2f} excede threshold 0.6.",
                    direcao='BULLISH',
                    urgencia='MEDIA',
                    corretora=corretora,
                    preco_atual=closes[-1],
                )
            elif book_imbalance_ratio < -0.6:
                self.processar_alerta(
                    ativo=ativo,
                    tipo='BOOK_IMBALANCE',
                    mensagem=f"Pressao vendedora estrutural: ratio {book_imbalance_ratio:.2f} excede threshold -0.6.",
                    direcao='BEARISH',
                    urgencia='MEDIA',
                    corretora=corretora,
                    preco_atual=closes[-1],
                )

        if resultado_score and self.filtrar_score(resultado_score['score_final']):
            # Disparar alerta OPORTUNIDADE via método dedicado com bloqueio consecutivo
            self._disparar_oportunidade(
                symbol=ativo,
                score=resultado_score['score_final'],
                vies=resultado_score.get('vies', 'NEUTRO'),
                preco=closes[-1],
                corretora=corretora,
                flags=resultado_score.get('flags', []),
            )

            logger.info(
                f"📊 Score {resultado_score['score_final']} ({resultado_score['vies']}) - "
                f"{ativo} ({corretora}) - Confiabilidade: {resultado_score['confiabilidade']}"
            )

    def _on_message_binance(self, ws, message):
        try:
            data = json.loads(message)
            # Handle aggTrade stream for CVD accumulation
            if data.get('e') == 'aggTrade':
                symbol = data.get('s', '')
                self._acumular_cvd(symbol, data)
                return
            # Handle depth5 stream for Book Imbalance
            if data.get('e') == 'depthUpdate' or ('bids' in data and 'asks' in data):
                symbol = data.get('s', '')
                if symbol:
                    self._atualizar_orderbook(symbol, data)
                return
            # Handle combined stream format (stream field present)
            if 'stream' in data and 'data' in data:
                stream = data['stream']
                payload = data['data']
                if '@depth5' in stream:
                    symbol = stream.split('@')[0].upper()
                    self._atualizar_orderbook(symbol, payload)
                    return
                if '@aggTrade' in stream:
                    symbol = payload.get('s', '')
                    self._acumular_cvd(symbol, payload)
                    return
                data = payload
            if 'k' in data:
                k = data['k']
                if k['x']:
                    candle = {
                        'timestamp': k['t'],
                        'open': float(k['o']),
                        'high': float(k['h']),
                        'low': float(k['l']),
                        'close': float(k['c']),
                        'volume': float(k['v'])
                    }
                    self.processar_candle(k['s'], 'BINANCE', candle)
        except Exception as e:
            logger.error(f"Erro ao processar mensagem Binance: {e}")

    def _on_message_bybit(self, ws, message):
        try:
            data = json.loads(message)
            if 'topic' in data and 'kline' in data.get('topic', ''):
                kline_data = data.get('data', [])
                for k in kline_data:
                    if k.get('confirm'):
                        candle = {
                            'timestamp': int(k['start']),
                            'open': float(k['open']),
                            'high': float(k['high']),
                            'low': float(k['low']),
                            'close': float(k['close']),
                            'volume': float(k['volume'])
                        }
                        symbol = data['topic'].split('.')[-1]
                        self.processar_candle(symbol, 'BYBIT', candle)
        except Exception as e:
            logger.error(f"Erro ao processar mensagem Bybit: {e}")

    def _on_message_okx(self, ws, message):
        try:
            data = json.loads(message)
            if 'data' in data:
                for candle_data in data['data']:
                    candle = {
                        'timestamp': int(candle_data[0]),
                        'open': float(candle_data[1]),
                        'high': float(candle_data[2]),
                        'low': float(candle_data[3]),
                        'close': float(candle_data[4]),
                        'volume': float(candle_data[5])
                    }
                    inst_id = candle_data.get('instId', data.get('arg', {}).get('instId', ''))
                    symbol = inst_id.replace('-USDT', 'USDT').replace('-SWAP', '')
                    self.processar_candle(symbol, 'OKX', candle)
        except Exception as e:
            logger.error(f"Erro ao processar mensagem OKX: {e}")

    def _on_message_bitget(self, ws, message):
        try:
            data = json.loads(message)
            if 'data' in data:
                for candle_data in data['data']:
                    if len(candle_data) >= 6:
                        candle = {
                            'timestamp': int(candle_data[0]),
                            'open': float(candle_data[1]),
                            'high': float(candle_data[2]),
                            'low': float(candle_data[3]),
                            'close': float(candle_data[4]),
                            'volume': float(candle_data[5])
                        }
                        inst_id = data.get('arg', {}).get('instId', '')
                        symbol = inst_id.replace('_UMCBL', '').replace('_SPBL', '')
                        self.processar_candle(symbol, 'BITGET', candle)
        except Exception as e:
            logger.error(f"Erro ao processar mensagem Bitget: {e}")

    def _on_error(self, ws, error):
        logger.error(f"WebSocket erro: {error}")

    def _on_close(self, ws, close_status_code, close_msg):
        logger.warning(f"WebSocket fechado (code={close_status_code}, msg={close_msg})")

    def _on_open_binance(self, ws):
        logger.info("✅ Conectado à Binance WebSocket")
        # Subscribe to kline streams
        streams = [f"{s.lower()}@kline_{TIMEFRAME}" for s in PARES_MONITORADOS]
        subscribe_msg = {"method": "SUBSCRIBE", "params": streams, "id": 1}
        ws.send(json.dumps(subscribe_msg))
        logger.info(f"   Binance: inscrito em {len(streams)} pares ({TIMEFRAME})")

        # Subscribe to aggTrade streams for CVD calculation
        agg_streams = [f"{s.lower()}@aggTrade" for s in PARES_MONITORADOS]
        subscribe_agg = {"method": "SUBSCRIBE", "params": agg_streams, "id": 2}
        ws.send(json.dumps(subscribe_agg))
        logger.info(f"   Binance: inscrito em {len(agg_streams)} aggTrade streams para CVD")

        # Subscribe to depth5 streams for Book Imbalance calculation
        depth_streams = [f"{s.lower()}@depth5@100ms" for s in PARES_MONITORADOS]
        subscribe_depth = {"method": "SUBSCRIBE", "params": depth_streams, "id": 3}
        ws.send(json.dumps(subscribe_depth))
        logger.info(f"   Binance: inscrito em {len(depth_streams)} depth5 streams para Book Imbalance")

    def _on_open_bybit(self, ws):
        logger.info("✅ Conectado à Bybit WebSocket")
        topics = [f"kline.{TIMEFRAME}.{s}" for s in PARES_MONITORADOS]
        subscribe_msg = {"op": "subscribe", "args": topics}
        ws.send(json.dumps(subscribe_msg))
        logger.info(f"   Bybit: inscrito em {len(topics)} pares ({TIMEFRAME})")

    def _on_open_okx(self, ws):
        logger.info("✅ Conectado à OKX WebSocket")
        args = [{"channel": f"candle{TIMEFRAME.upper()}", "instId": f"{s[:-4]}-USDT"} for s in PARES_MONITORADOS]
        subscribe_msg = {"op": "subscribe", "args": args}
        ws.send(json.dumps(subscribe_msg))
        logger.info(f"   OKX: inscrito em {len(args)} pares ({TIMEFRAME})")

    def _on_open_bitget(self, ws):
        logger.info("✅ Conectado à Bitget WebSocket")
        args = [{"instType": "USDT-FUTURES", "channel": f"candle{TIMEFRAME.upper()}", "instId": f"{s}"} for s in PARES_MONITORADOS]
        subscribe_msg = {"op": "subscribe", "args": args}
        ws.send(json.dumps(subscribe_msg))
        logger.info(f"   Bitget: inscrito em {len(args)} pares ({TIMEFRAME})")

    def iniciar_ws_binance(self):
        url = WS_URLS['BINANCE']
        ws = websocket.WebSocketApp(
            url,
            on_message=self._on_message_binance,
            on_error=self._on_error,
            on_close=self._on_close,
            on_open=self._on_open_binance
        )
        self.ws_connections['BINANCE'] = ws
        return ws

    def iniciar_ws_bybit(self):
        url = WS_URLS['BYBIT']
        ws = websocket.WebSocketApp(
            url,
            on_message=self._on_message_bybit,
            on_error=self._on_error,
            on_close=self._on_close,
            on_open=self._on_open_bybit
        )
        self.ws_connections['BYBIT'] = ws
        return ws

    def iniciar_ws_okx(self):
        url = WS_URLS['OKX']
        ws = websocket.WebSocketApp(
            url,
            on_message=self._on_message_okx,
            on_error=self._on_error,
            on_close=self._on_close,
            on_open=self._on_open_okx
        )
        self.ws_connections['OKX'] = ws
        return ws

    def iniciar_ws_bitget(self):
        url = WS_URLS['BITGET']
        ws = websocket.WebSocketApp(
            url,
            on_message=self._on_message_bitget,
            on_error=self._on_error,
            on_close=self._on_close,
            on_open=self._on_open_bitget
        )
        self.ws_connections['BITGET'] = ws
        return ws

    def _run_ws_thread(self, corretora, ws_factory):
        while self.running:
            try:
                ws = ws_factory()
                ws.run_forever(ping_interval=20, ping_timeout=10)
            except Exception as e:
                logger.error(f"Erro na thread WebSocket {corretora}: {e}")

            if self.running:
                logger.warning(f"Reconectando {corretora} em 5 segundos...")
                time.sleep(5)

    def rodar_loop_principal(self):
        logger.info("=" * 60)
        logger.info("🚀 GENESIS MONITOR WORKER INICIADO")
        logger.info(f"   Pares: {len(PARES_MONITORADOS)} | Timeframe: {TIMEFRAME}")
        logger.info(f"   Corretoras: {', '.join(WS_URLS.keys())}")
        logger.info(f"   Volume minimo: ${VOLUME_MINIMO_DIARIO:,.0f}")
        logger.info(f"   Score minimo: {SCORE_MINIMO}")
        logger.info(f"   Anti-duplicata: {self.intervalo_duplicatas}s")
        logger.info("=" * 60)

        factories = [
            ('BINANCE', self.iniciar_ws_binance),
            ('BYBIT', self.iniciar_ws_bybit),
            ('OKX', self.iniciar_ws_okx),
            ('BITGET', self.iniciar_ws_bitget),
        ]

        threads = []
        for corretora, factory in factories:
            t = threading.Thread(target=self._run_ws_thread, args=(corretora, factory), daemon=True)
            t.start()
            threads.append(t)
            logger.info(f"Thread WebSocket {corretora} iniciada")

        while self.running:
            try:
                time.sleep(1)
                for corretora, ws in list(self.ws_connections.items()):
                    if hasattr(ws, 'sock') and ws.sock and ws.sock.connected:
                        pass
            except Exception as e:
                logger.error(f"Erro no loop principal: {e}")
                time.sleep(5)

        logger.info("Worker encerrado.")


if __name__ == '__main__':
    worker = MonitorWorker()
    worker.rodar_loop_principal()
