"""
Worker Radar News — Gênesis Labs
Coleta notícias de RSS a cada 3 minutos, classifica via Gemini 2.5 Flash,
persiste no MySQL e despacha alertas para Telegram.
Executa Discovery Radar a cada 20 minutos.
"""

import os
import sys
import time
import signal
import logging

import pymysql
from dotenv import load_dotenv

from rss_collector import RSSCollector
from ai_classifier import AIClassifier
from telegram_dispatcher import TelegramDispatcher
from discovery_radar import DiscoveryRadar

load_dotenv()

# ─── Variáveis de ambiente ────────────────────────────────────────────────────

MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'genesis_db')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 3306))

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

# ─── Ciclos (em segundos) ────────────────────────────────────────────────────

RSS_CYCLE_SECONDS = 180       # 3 minutos
DISCOVERY_CYCLE_SECONDS = 1200  # 20 minutos

# ─── Logging ──────────────────────────────────────────────────────────────────

logger = logging.getLogger('radar-news')
logger.setLevel(logging.DEBUG)

formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

error_handler = logging.StreamHandler(sys.stderr)
error_handler.setLevel(logging.ERROR)
error_handler.setFormatter(formatter)
logger.addHandler(error_handler)


# ─── Worker Class ─────────────────────────────────────────────────────────────

class RadarNewsWorker:
    """Worker principal do Radar News."""

    def __init__(self):
        self.running = True
        self._last_rss_cycle = 0.0
        self._last_discovery_cycle = 0.0
        self.rss_collector = RSSCollector()
        self.ai_classifier = AIClassifier()
        self.telegram_dispatcher = TelegramDispatcher()
        self.discovery_radar = DiscoveryRadar(
            ai_classifier=self.ai_classifier,
            telegram_dispatcher=self.telegram_dispatcher,
            cmc_api_key=os.getenv('CMC_API_KEY', ''),
        )

        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    # ─── Signal handling ──────────────────────────────────────────────────────

    def _signal_handler(self, signum, frame):
        logger.info("Sinal de desligamento recebido. Encerrando Radar News worker...")
        self.running = False

    # ─── MySQL connection ─────────────────────────────────────────────────────

    def conectar_bd(self):
        """Cria e retorna uma conexão MySQL. Retorna None em caso de falha."""
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

    # ─── Validate startup ────────────────────────────────────────────────────

    def _validate_env(self):
        """Valida que variáveis de ambiente críticas estão configuradas.

        Variáveis obrigatórias (fatal se ausentes):
          TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY,
          MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE
        """
        required_vars = {
            'TELEGRAM_BOT_TOKEN': TELEGRAM_BOT_TOKEN,
            'TELEGRAM_CHAT_ID': TELEGRAM_CHAT_ID,
            'GEMINI_API_KEY': GEMINI_API_KEY,
            'MYSQL_HOST': MYSQL_HOST,
            'MYSQL_USER': MYSQL_USER,
            'MYSQL_DATABASE': MYSQL_DATABASE,
        }

        missing = [name for name, value in required_vars.items() if not value]

        if missing:
            logger.critical(
                f"Variáveis de ambiente obrigatórias ausentes: {', '.join(missing)}. Abortando."
            )
            sys.exit(1)

        logger.info("Todas variáveis de ambiente obrigatórias presentes.")

        # MySQL — testa conexão real
        conn = self.conectar_bd()
        if conn is None:
            logger.critical("Não foi possível conectar ao MySQL. Abortando.")
            sys.exit(1)
        conn.close()
        logger.info("Conexão MySQL verificada com sucesso.")

    # ─── RSS cycle ────────────────────────────────────────────────────────────

    def _run_rss_cycle(self):
        """Executa um ciclo de coleta RSS + classificação + persistência + dispatch."""
        logger.info("─── Iniciando ciclo RSS ───")
        try:
            entries = self.rss_collector.fetch_all_feeds()

            # Deduplicação contra MySQL
            conn = self.conectar_bd()
            if conn:
                try:
                    entries = self.rss_collector.deduplicate(entries, conn)
                finally:
                    conn.close()
            else:
                logger.warning("Sem conexão MySQL para dedup; seguindo com todas entradas.")

            # Classificação via Gemini 2.5 Flash
            if entries:
                classified = self.ai_classifier.classify(entries)
                logger.info(f"[AI] {len(classified)} entrada(s) classificada(s).")

                # Persistência no MySQL
                if classified:
                    conn = self.conectar_bd()
                    if conn:
                        try:
                            persisted = 0
                            for entry in classified:
                                if self.ai_classifier.persist_classified(entry, conn):
                                    persisted += 1
                            logger.info(f"[DB] {persisted}/{len(classified)} entrada(s) persistida(s).")
                        finally:
                            conn.close()
                    else:
                        logger.error("Sem conexão MySQL para persistir entradas classificadas.")
            else:
                classified = []

            # Dispatch Telegram para entradas CRITICAL/HIGH
            if classified:
                for entry in classified:
                    sev = entry.get('severity', 'LOW')
                    if sev == 'CRITICAL':
                        self.telegram_dispatcher.send_news_alert(entry)
                    elif sev == 'HIGH':
                        # HIGH será despachado com delay em task 6.4
                        self.telegram_dispatcher.send_news_alert(entry)
            logger.info(f"Ciclo RSS concluído. {len(entries)} entrada(s) nova(s) após dedup.")
        except Exception as e:
            logger.error(f"Erro no ciclo RSS: {e}")

    # ─── Discovery cycle ──────────────────────────────────────────────────────

    def _run_discovery_cycle(self):
        """Executa um ciclo do Discovery Radar."""
        logger.info("─── Iniciando ciclo Discovery Radar ───")
        try:
            conn = self.conectar_bd()
            if conn:
                try:
                    self.discovery_radar.run_discovery_cycle(conn)
                finally:
                    conn.close()
            else:
                logger.error("Sem conexão MySQL para Discovery Radar.")
            logger.info("Ciclo Discovery Radar concluído.")
        except Exception as e:
            logger.error(f"Erro no ciclo Discovery Radar: {e}")

    # ─── Main loop ────────────────────────────────────────────────────────────

    def rodar(self):
        """Loop principal do worker."""
        self._validate_env()

        logger.info("=" * 60)
        logger.info("📡 RADAR NEWS WORKER INICIADO")
        logger.info(f"   Ciclo RSS: a cada {RSS_CYCLE_SECONDS}s ({RSS_CYCLE_SECONDS // 60} min)")
        logger.info(f"   Ciclo Discovery: a cada {DISCOVERY_CYCLE_SECONDS}s ({DISCOVERY_CYCLE_SECONDS // 60} min)")
        logger.info(f"   MySQL: {MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}")
        logger.info("=" * 60)

        # Executa ciclo RSS imediatamente na primeira vez
        self._last_rss_cycle = 0.0
        self._last_discovery_cycle = 0.0

        while self.running:
            try:
                now = time.time()

                # Ciclo RSS (3 min)
                if now - self._last_rss_cycle >= RSS_CYCLE_SECONDS:
                    self._run_rss_cycle()
                    self._last_rss_cycle = time.time()

                # Ciclo Discovery (20 min)
                if now - self._last_discovery_cycle >= DISCOVERY_CYCLE_SECONDS:
                    self._run_discovery_cycle()
                    self._last_discovery_cycle = time.time()

                # Sleep curto para não consumir CPU
                time.sleep(1)

            except Exception as e:
                logger.error(f"Erro no loop principal: {e}")
                time.sleep(5)

        logger.info("Radar News worker encerrado.")


# ─── Entrypoint ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    worker = RadarNewsWorker()
    worker.rodar()
