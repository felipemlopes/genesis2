import os
import sys
import time
import json
import math
import signal
import logging
import datetime
import threading

import pymysql
import requests
from dotenv import load_dotenv
import websocket

from indicatorEngine import (
    calcular_ema, calcular_rsi, calcular_atr, calcular_adx,
    calcular_macd, calcular_bollinger, calcular_vwap,
    calcular_cvd_slope, detectar_compressao_volatilidade
)
from scoringEngine import calcular_score

load_dotenv()

MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'genesis_db')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 3306))
TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

PARES_MONITORADOS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
    "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT",
    "MATICUSDT", "NEARUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT"
]
TIMEFRAME = "1h"
VOLUME_MINIMO_DIARIO = 50_000_000
SCORE_MINIMO = 68
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

        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

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

    def enviar_telegram(self, alerta):
        if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
            return False

        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"

        emoji_dir = "🟢" if alerta['direcao'] == 'BULLISH' else ("🔴" if alerta['direcao'] == 'BEARISH' else "⚪")
        msg = (
            f"🚨 *GENESIS ALERTA: {alerta['urgencia']}* 🚨\n\n"
            f"📌 *Ativo:* {alerta['ativo']} ({alerta['corretora']})\n"
            f"🔄 *Tipo:* {alerta['tipo']}\n"
            f"📈 *Direção:* {emoji_dir} {alerta['direcao']}\n"
            f"💰 *Preço:* ${alerta['preco_atual']:,.4f}\n\n"
            f"📝 *Detalhes:* {alerta['mensagem']}"
        )

        try:
            resposta = requests.post(url, json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": msg,
                "parse_mode": "Markdown"
            }, timeout=5)
            return resposta.status_code == 200
        except Exception as e:
            logger.error(f"Erro ao enviar Telegram: {e}")
            return False

    def gravar_banco(self, alerta, enviado_telegram):
        try:
            laravel_url = os.getenv('LARAVEL_API_URL', 'http://localhost:8000/api')
            payload = {
                'ativo': alerta['ativo'],
                'tipo': alerta['tipo'],
                'mensagem': alerta['mensagem'],
                'direcao': alerta['direcao'],
                'urgencia': alerta['urgencia'],
                'corretora': alerta['corretora'],
                'timeframe': alerta.get('timeframe', '1h'),
                'preco_atual': alerta['preco_atual'],
                'variacao_pct': alerta['variacao_pct'],
                'score': alerta.get('score', 0),
            }
            resp = requests.post(f"{laravel_url}/webhook/alertas", json=payload, timeout=5)
            if resp.status_code in (200, 201):
                logger.info(f"Alerta enviado ao Laravel: {alerta['ativo']} - {alerta['tipo']}")
            else:
                logger.error(f"Laravel respondeu {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.error(f"Erro ao enviar alerta ao Laravel: {e}")

    def processar_alerta(self, ativo, tipo, mensagem, direcao, urgencia, corretora, preco_atual, variacao_pct=0.0, score=0):
        chave_cache = f"{ativo}_{tipo}_{corretora}"
        agora = time.time()

        ultimo = self.ultimos_alertas.get(chave_cache, 0)
        if agora - ultimo < self.intervalo_duplicatas:
            logger.debug(f"Alerta duplicado ignorado: {chave_cache}")
            return

        self.ultimos_alertas[chave_cache] = agora

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
        }

        logger.info(f"🔔 Novo Alerta Detectado! {alerta['tipo']} - {alerta['ativo']} ({alerta['corretora']})")

        enviado_telegram = self.enviar_telegram(alerta)
        self.gravar_banco(alerta, enviado_telegram)

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
        preco_subindo = preco_atual > preco_anterior

        ema21_subindo = None
        if ema21 is not None and len(closes) >= 22:
            ema21_ant = calcular_ema(closes[:-1], 21)
            ema21_subindo = ema21 > ema21_ant if ema21_ant else None

        ema200_subindo = None
        if ema200 is not None and len(closes) >= 201:
            ema200_ant = calcular_ema(closes[:-1], 200)
            ema200_subindo = ema200 > ema200_ant if ema200_ant else None

        dados_score = {
            'preco': preco_atual,
            'ema200': ema200,
            'ema200_subindo': ema200_subindo,
            'rsi': rsi,
            'adx': adx_result['adx'] if adx_result else None,
            'preco_subindo': preco_subindo,
            'macd_acima_signal': (macd_result['macd'] > macd_result['signal']) if macd_result else None,
            'histograma_subindo': (macd_result['histogram'] > 0) if macd_result else None,
            'compressao_detectada': False,
            'cvd_slope': dados_extras.get('cvd_slope', 0),
            'book_imbalance_ratio': dados_extras.get('book_imbalance_ratio'),
            'funding_medio': dados_extras.get('funding_rate'),
            'oi_subindo': dados_extras.get('oi_subindo'),
            'ls_ratio_longs': dados_extras.get('ls_ratio'),
            'fear_greed': None,
            'divergencia_rsi': 'NENHUMA',
            'divergencia_cvd': None,
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

    def buscar_dados_extras(self, ativo):
        """Busca dados extras reais (funding, OI) via REST API Binance para enriquecer detecção de anomalias"""
        funding_rate = self.buscar_funding_rate(ativo)
        oi_atual = self.buscar_open_interest(ativo)

        # Determinar se OI está subindo comparando com cache anterior
        cache_key = f"{ativo}_oi"
        oi_anterior = self._oi_cache.get(cache_key)
        oi_subindo = None
        if oi_anterior is not None and oi_atual is not None:
            oi_subindo = oi_atual > oi_anterior
        if oi_atual is not None:
            self._oi_cache[cache_key] = oi_atual

        return {
            'cvd_slope': 0,  # CVD requer dados de trades em tempo real (WebSocket depth)
            'book_imbalance_ratio': None,  # Requer WebSocket de order book
            'funding_rate': funding_rate,
            'oi_subindo': oi_subindo,
            'oi_atual': oi_atual,
            'oi_anterior': oi_anterior,
            'ls_ratio': None,  # Requer endpoint separado
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

        # Determinar se OI está subindo comparando com cache anterior
        oi_cache_key = f"{ativo}_oi"
        oi_anterior = self._oi_cache.get(oi_cache_key)
        oi_subindo = None
        if oi_anterior is not None and oi_atual is not None:
            oi_subindo = oi_atual > oi_anterior
        if oi_atual is not None:
            self._oi_cache[oi_cache_key] = oi_atual

        dados_extras = {
            'cvd_slope': 0,
            'book_imbalance_ratio': None,
            'funding_rate': funding_rate,
            'oi_subindo': oi_subindo,
            'oi_atual': oi_atual,
            'oi_anterior': oi_anterior,
            'ls_ratio': None,
        }
        resultado_score = self.calcular_indicadores_e_score(candles, dados_extras)

        self.detectar_liquidation_cascade(candles, dados_mercado)
        self.detectar_spot_futures_divergencia(ativo, candles[-1]['close'], dados_mercado)

        # Acionar detecção de anomalias com dados reais de funding e OI
        if dados_extras.get('funding_rate') is not None:
            self.detectar_funding_extremo(dados_extras['funding_rate'], dados_mercado)

        if dados_extras.get('oi_anterior') is not None and dados_extras.get('oi_atual') is not None:
            self.detectar_oi_spike(dados_extras['oi_anterior'], dados_extras['oi_atual'], dados_mercado)

        if resultado_score and self.filtrar_score(resultado_score['score_final']):
            logger.info(
                f"📊 Score {resultado_score['score_final']} ({resultado_score['vies']}) - "
                f"{ativo} ({corretora}) - Confiabilidade: {resultado_score['confiabilidade']}"
            )

    def _on_message_binance(self, ws, message):
        try:
            data = json.loads(message)
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
        streams = [f"{s.lower()}@kline_{TIMEFRAME}" for s in PARES_MONITORADOS]
        subscribe_msg = {"method": "SUBSCRIBE", "params": streams, "id": 1}
        ws.send(json.dumps(subscribe_msg))
        logger.info(f"   Binance: inscrito em {len(streams)} pares ({TIMEFRAME})")

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
