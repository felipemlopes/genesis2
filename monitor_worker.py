import time
import datetime
import math
import logging
# import pymysql
# import requests
# import os
# from dotenv import load_dotenv

# Configuração básica de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# DEV - ATIVAR CONEXÃO - descomente as linhas abaixo após configurar o .env com as credenciais
# load_dotenv()
# MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
# MYSQL_USER = os.getenv('MYSQL_USER', 'root')
# MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
# MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'genesis_db')
# MYSQL_PORT = int(os.getenv('MYSQL_PORT', 3306))
# TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')
# TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

class MonitorWorker:
    def __init__(self):
        self.ultimos_alertas = {}  # Memória em cache { "ativo_tipo": timestamp_ultimo_alerta }
        self.intervalo_duplicatas = 300  # Ignorar mesmo alerta (mesmo ativo e tipo) por 5 minutos (300 segundos)

    def conectar_bd(self):
        """Conecta ao banco de dados MySQL para salvar os alertas."""
        # DEV - ATIVAR CONEXÃO - descomente as linhas abaixo após configurar o .env com as credenciais
        # try:
        #     return pymysql.connect(
        #         host=MYSQL_HOST,
        #         user=MYSQL_USER,
        #         password=MYSQL_PASSWORD,
        #         database=MYSQL_DATABASE,
        #         port=MYSQL_PORT,
        #         cursorclass=pymysql.cursors.DictCursor
        #     )
        # except Exception as e:
        #     logging.error(f"Erro ao conectar no banco de dados: {e}")
        #     return None
        pass

    def enviar_telegram(self, alerta):
        """Envia mensagem formatada para o Telegram."""
        # DEV - ATIVAR CONEXÃO - descomente as linhas abaixo após configurar o .env com as credenciais
        # if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        #     return False
        #
        # url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        # 
        # emoji_dir = "🟢" if alerta['direcao'] == 'BULLISH' else ("🔴" if alerta['direcao'] == 'BEARISH' else "⚪")
        # msg = (
        #     f"🚨 *GÊNESIS ALERTA: {alerta['urgencia']}* 🚨\n\n"
        #     f"📌 *Ativo:* {alerta['ativo']} ({alerta['corretora']})\n"
        #     f"🔄 *Tipo:* {alerta['tipo']}\n"
        #     f"📈 *Direção:* {emoji_dir} {alerta['direcao']}\n"
        #     f"💰 *Preço:* ${alerta['preco_atual']:,.4f}\n\n"
        #     f"📝 *Detalhes:* {alerta['mensagem']}"
        # )
        # 
        # try:
        #     resposta = requests.post(url, json={
        #         "chat_id": TELEGRAM_CHAT_ID,
        #         "text": msg,
        #         "parse_mode": "Markdown"
        #     }, timeout=5)
        #     return resposta.status_code == 200
        # except Exception as e:
        #     logging.error(f"Erro ao enviar Telegram: {e}")
        #     return False
        pass

    def gravar_banco(self, alerta, enviado_telegram):
        """Grava os dados do alerta no banco MySQL"""
        # DEV - ATIVAR CONEXÃO - descomente as linhas abaixo após configurar o .env com as credenciais
        # conn = self.conectar_bd()
        # if not conn:
        #     return
        # 
        # try:
        #     with conn.cursor() as cursor:
        #         sql = """
        #             INSERT INTO genesis_alertas 
        #             (ativo, tipo, mensagem, direcao, urgencia, corretora, preco_atual, variacao_pct, enviado_telegram, criado_em)
        #             VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        #         """
        #         criado_em = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        #         
        #         cursor.execute(sql, (
        #             alerta['ativo'], alerta['tipo'], alerta['mensagem'], 
        #             alerta['direcao'], alerta['urgencia'], alerta['corretora'], 
        #             alerta['preco_atual'], alerta['variacao_pct'], 
        #             1 if enviado_telegram else 0, criado_em
        #         ))
        #     conn.commit()
        #     logging.info(f"Alerta salvo no banco: {alerta['ativo']} - {alerta['tipo']}")
        # except Exception as e:
        #     logging.error(f"Erro ao salvar no banco de dados: {e}")
        # finally:
        #     conn.close()
        pass

    def processar_alerta(self, ativo, tipo, mensagem, direcao, urgencia, corretora, preco_atual, variacao_pct=0.0):
        """Prepara, previne duplicadas, despacha e salva o alerta"""
        chave_cache = f"{ativo}_{tipo}"
        agora = time.time()
        
        # Anti-duplicata: ignorar se alertado recentemente
        ultimo = self.ultimos_alertas.get(chave_cache, 0)
        if agora - ultimo < self.intervalo_duplicatas:
            return # Já alertado nos últimos 5 minutos
            
        self.ultimos_alertas[chave_cache] = agora
        
        alerta = {
            'ativo': ativo,
            'tipo': tipo,
            'mensagem': mensagem,
            'direcao': direcao,
            'urgencia': urgencia,
            'corretora': corretora,
            'preco_atual': preco_atual,
            'variacao_pct': variacao_pct
        }
        
        logging.info(f"Novo Alerta Detectado! {alerta}")
        
        # Despacho externo
        enviado_telegram = self.enviar_telegram(alerta)
        self.gravar_banco(alerta, enviado_telegram)

    # =========================================================================
    # LÓGICAS DE DETECÇÃO DAS ANOMALIAS MATEMÁTICAS
    # =========================================================================

    def detectar_spike_volume(self, dados_mercado):
        """Avalia volume atual vs média móvel simples de volume (últimos 20 fechados)."""
        # Matematica de Spike: Volume candle atual > 3 * SMA(Volume, 20)
        # DEV - Integre ao fetcher de klines real aqui
        volume_atual = dados_mercado.get('volume_atual', 0)
        sma20_volume = dados_mercado.get('sma20_volume', 1)
        
        if volume_atual > (3 * sma20_volume):
            direcao_candle = 'BULLISH' if dados_mercado['close'] > dados_mercado['open'] else 'BEARISH'
            self.processar_alerta(
                ativo=dados_mercado['ativo'],
                tipo='SPIKE_VOLUME',
                mensagem=f"Volume anormal detectado: {math.floor(volume_atual/sma20_volume)}x maior que a média recente (SMA 20).",
                direcao=direcao_candle,
                urgencia='ALTA',
                corretora=dados_mercado.get('corretora', 'BINANCE'),
                preco_atual=dados_mercado['close']
            )

    def detectar_movimento_brusco(self, variacao_1m, dados_mercado):
        """Variação percentual >= 1.5% em 1 minuto."""
        if abs(variacao_1m) >= 1.5:
            direcao = 'BULLISH' if variacao_1m > 0 else 'BEARISH'
            self.processar_alerta(
                ativo=dados_mercado['ativo'],
                tipo='MOVIMENTO_BRUSCO',
                mensagem=f"Ação de preço violenta: variação de {variacao_1m:.2f}% nos últimos 60 segundos.",
                direcao=direcao,
                urgencia='ALTA',
                corretora=dados_mercado.get('corretora', 'BINANCE'),
                preco_atual=dados_mercado['close'],
                variacao_pct=variacao_1m
            )

    def detectar_divergencia_cvd(self, preco_candles_recentes, cvd_candles_recentes, dados_mercado):
        """Preço sobe mas agressão (Delta CVD) cai nos últimos 3 candles, ou vice-versa."""
        if len(preco_candles_recentes) >= 3 and len(cvd_candles_recentes) >= 3:
            preco_up = all(preco_candles_recentes[i] < preco_candles_recentes[i+1] for i in range(2))
            cvd_down = all(cvd_candles_recentes[i] > cvd_candles_recentes[i+1] for i in range(2))
            
            preco_down = all(preco_candles_recentes[i] > preco_candles_recentes[i+1] for i in range(2))
            cvd_up = all(cvd_candles_recentes[i] < cvd_candles_recentes[i+1] for i in range(2))
            
            if preco_up and cvd_down:
                self.processar_alerta(
                    ativo=dados_mercado['ativo'],
                    tipo='CVD_DIVERGENCIA',
                    mensagem="Falso rompimento de alta detectado: Preço fazendo topos ascendentes, mas agressão vendedora domina (Divergência CVD).",
                    direcao='BEARISH',
                    urgencia='MEDIA',
                    corretora=dados_mercado.get('corretora', 'BINANCE'),
                    preco_atual=dados_mercado['close']
                )
            elif preco_down and cvd_up:
                self.processar_alerta(
                    ativo=dados_mercado['ativo'],
                    tipo='CVD_DIVERGENCIA',
                    mensagem="Falso rompimento de baixa detectado: Preço fazendo fundos descendentes, mas agressão compradora domina (Divergência CVD).",
                    direcao='BULLISH',
                    urgencia='MEDIA',
                    corretora=dados_mercado.get('corretora', 'BINANCE'),
                    preco_atual=dados_mercado['close']
                )

    def detectar_funding_extremo(self, funding_rate, dados_mercado):
        """Taxa > 0.05% (Long Squeeze Risco) ou < -0.03% (Short Squeeze Risco)."""
        if funding_rate > 0.05:
            self.processar_alerta(
                ativo=dados_mercado['ativo'],
                tipo='FUNDING_EXTREMO',
                mensagem=f"Funding Rate altamente positivo ({funding_rate:.4f}%). Mercado sobrealavancado em Long. Iminência de Long Squeeze.",
                direcao='BEARISH',
                urgencia='ALTA',
                corretora=dados_mercado.get('corretora', 'BINANCE'),
                preco_atual=dados_mercado['close']
            )
        elif funding_rate < -0.03:
            self.processar_alerta(
                ativo=dados_mercado['ativo'],
                tipo='FUNDING_EXTREMO',
                mensagem=f"Funding Rate altamente negativo ({funding_rate:.4f}%). Mercado sobrealavancado em Short. Iminência de Short Squeeze.",
                direcao='BULLISH',
                urgencia='ALTA',
                corretora=dados_mercado.get('corretora', 'BINANCE'),
                preco_atual=dados_mercado['close']
            )

    def detectar_oi_spike(self, oi_anterior, oi_atual, dados_mercado):
        """Open Interest aumenta > 5% em 5 minutos."""
        if oi_anterior > 0:
            variacao = ((oi_atual - oi_anterior) / oi_anterior) * 100
            if variacao > 5.0:
                self.processar_alerta(
                    ativo=dados_mercado['ativo'],
                    tipo='OI_SPIKE',
                    mensagem=f"Aumento massivo de Contratos em Aberto: {variacao:.2f}% injetado nos últimos 5 minutos.",
                    direcao='NEUTRO',
                    urgencia='ALTA',
                    corretora=dados_mercado.get('corretora', 'BINANCE'),
                    preco_atual=dados_mercado['close'],
                    variacao_pct=variacao
                )

    def detectar_book_imbalance(self, hist_bid, hist_ask, dados_mercado):
        """Razão Bid/Ask desequilibrada > 0.35 para Venda ou <-0.35 para Compra por 2 snapshots consecutivos."""
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
                        mensagem="Pressão compradora estrutural: Ordens limitadas de compra (Bid) excedem consideravelmente as de venda (Ask).",
                        direcao='BULLISH',
                        urgencia='MEDIA',
                        corretora=dados_mercado.get('corretora', 'BINANCE'),
                        preco_atual=dados_mercado['close']
                    )
                elif all(r < -0.35 for r in ratios):
                    self.processar_alerta(
                        ativo=dados_mercado['ativo'],
                        tipo='BOOK_IMBALANCE',
                        mensagem="Pressão vendedora estrutural: Ordens limitadas de venda (Ask) excedem consideravelmente as de compra (Bid).",
                        direcao='BEARISH',
                        urgencia='MEDIA',
                        corretora=dados_mercado.get('corretora', 'BINANCE'),
                        preco_atual=dados_mercado['close']
                    )

    def rodar_loop_principal(self):
        """Loop contínuo com backoff exponencial preventivo e tratamento de falhas."""
        logging.info("Gênesis Monitor Worker Iniciado.")
        backoff_tempo = 1
        
        while True:
            try:
                # DEV - ATIVAR CONEXÃO: Implemente aqui o fetcher via API da corretora desejada.
                # Exemplo: df = buscar_klines_binance('BTCUSDT', '1m')
                # ... Realizar cálculos para cada anomalia ...
                
                # Mockup temporário para estrutura não falhar
                time.sleep(10)
                
                # Se completou sem erro, reseta backoff em caso de loops de erro
                backoff_tempo = 1
                
            except Exception as e:
                logging.error(f"Worker encontrou erro crítico: {e}")
                logging.info(f"Reconectando em {backoff_tempo} segundos...")
                time.sleep(backoff_tempo)
                # Backoff Exponencial
                backoff_tempo = min(backoff_tempo * 2, 60)

if __name__ == '__main__':
    worker = MonitorWorker()
    worker.rodar_loop_principal()
