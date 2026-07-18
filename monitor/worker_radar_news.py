"""
Worker Radar News — Gênesis Labs V1.0
Coleta notícias de RSS a cada 3 minutos, classifica via Gemini (API interna Genesis),
persiste no MySQL, roteia por nível (C4) e despacha para o Telegram por fila
persistente (C8) com orçamento/cooldown por tema (C9). Envia o resumo diário
às 20h horário de Brasília (seção 5.1).

Radar News NÃO é Radar de Oportunidades: nenhum código de descoberta/scoring de
tokens roda neste worker (C11) — isso é outro sistema.
"""

import json
import os
import sys
import time
import signal
import logging
from datetime import datetime, timedelta, timezone

import pymysql
from dotenv import load_dotenv

from rss_collector import RSSCollector
from ai_classifier import AIClassifier, load_carteira_tokens
from telegram_dispatcher import TelegramDispatcher

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

# ─── Variáveis de ambiente ────────────────────────────────────────────────────

MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'genesis_db')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 3306))

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')

# ─── Ciclos e janelas ──────────────────────────────────────────────────────────

RSS_CYCLE_SECONDS = 180             # 3 minutos
QUEUE_DRAIN_TICK_SECONDS = 5        # granularidade de checagem da fila de Telegram
TELEGRAM_SEND_SPACING_SECONDS = 30  # intervalo mínimo entre envios (C8, mantido)

RESUMO_HOUR_BRT = 20                # 20h horário de Brasília (seção 5.1)
BRT_OFFSET = timedelta(hours=-3)    # Brasília não tem horário de verão desde 2019

# Orçamento e cooldown por tema (C9)
NIVEL1_HOURLY_CAP = 3
NIVEL1_DAILY_CAP = 10
TEMA_COOLDOWN_HOURS = 2

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


def _agora_brt() -> datetime:
    return datetime.now(timezone.utc) + BRT_OFFSET


# ─── Worker Class ─────────────────────────────────────────────────────────────

class RadarNewsWorker:
    """Worker principal do Radar News."""

    def __init__(self):
        self.running = True
        self._last_rss_cycle = 0.0
        self._last_telegram_send_ts = 0.0
        self._last_resumo_date = None

        self.rss_collector = RSSCollector()
        self.ai_classifier = AIClassifier()
        self.telegram_dispatcher = TelegramDispatcher()

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
        """Valida que variáveis de ambiente críticas estão configuradas."""
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

        conn = self.conectar_bd()
        if conn is None:
            logger.critical("Não foi possível conectar ao MySQL. Abortando.")
            sys.exit(1)
        conn.close()
        logger.info("Conexão MySQL verificada com sucesso.")

    # ─── RSS cycle ────────────────────────────────────────────────────────────

    def _run_rss_cycle(self):
        """Coleta + classifica + persiste. O disparo ao Telegram acontece na fila (drain)."""
        logger.info("─── Iniciando ciclo RSS ───")
        try:
            entries = self.rss_collector.fetch_all_feeds()

            carteira = []
            conn = self.conectar_bd()
            if conn:
                try:
                    entries = self.rss_collector.deduplicate(entries, conn)
                    carteira = load_carteira_tokens(conn)
                finally:
                    conn.close()
            else:
                logger.warning("Sem conexão MySQL para dedup/carteira; seguindo com todas as entradas.")

            if not entries:
                logger.info("Ciclo RSS concluído. 0 entrada(s) nova(s) após dedup.")
                return

            classified = self.ai_classifier.classify(entries, carteira)
            logger.info(f"[AI] {len(classified)} entrada(s) classificada(s).")

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

            logger.info(f"Ciclo RSS concluído. {len(entries)} entrada(s) nova(s) após dedup.")
        except Exception as e:
            logger.error(f"Erro no ciclo RSS: {e}")

    # ─── Orçamento e cooldown por tema (C9) ───────────────────────────────────

    def _pode_disparar(self, row: dict, conn) -> bool:
        """CRITICAL nunca é limitado. Nível 1 não-crítico: teto de 3/hora e 10/dia;
        mesmo tema (categoria + ativo principal) em 2h rebaixa para Nível 2."""
        if (row.get('severity') or '').upper() == 'CRITICAL':
            return True

        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) AS n FROM genesis_radar_news "
                    "WHERE nivel = 1 AND telegram_sent = 1 AND created_at >= NOW() - INTERVAL 1 HOUR"
                )
                hora = cur.fetchone()['n']

                cur.execute(
                    "SELECT COUNT(*) AS n FROM genesis_radar_news "
                    "WHERE nivel = 1 AND telegram_sent = 1 AND DATE(created_at) = CURDATE()"
                )
                dia = cur.fetchone()['n']

                tema = 0
                affected_assets = json.loads(row.get('affected_assets') or '[]')
                ativo_principal = affected_assets[0] if affected_assets else None
                if row.get('categoria') is not None and ativo_principal:
                    cur.execute(
                        "SELECT COUNT(*) AS n FROM genesis_radar_news "
                        "WHERE categoria = %s AND JSON_CONTAINS(affected_assets, %s) AND telegram_sent = 1 "
                        "AND created_at >= NOW() - INTERVAL %s HOUR",
                        (row['categoria'], json.dumps(ativo_principal), TEMA_COOLDOWN_HOURS),
                    )
                    tema = cur.fetchone()['n']
        except Exception as e:
            logger.error(f"[Budget] Erro ao checar orçamento/cooldown: {e}")
            return True  # falha de leitura do orçamento não deve bloquear notícia crítica de fato

        return hora < NIVEL1_HOURLY_CAP and dia < NIVEL1_DAILY_CAP and tema == 0

    # ─── Fila persistente do Telegram (C8) ────────────────────────────────────

    def _drain_telegram_queue(self):
        """Drena a fila persistente de Nível 1 pendente, 1 mensagem por vez, respeitando
        o intervalo mínimo de 30s. telegram_sent só é marcado DEPOIS da confirmação de envio —
        sobrevive a restart do pm2 porque a fila vive na própria tabela, não em thread."""
        now = time.time()
        if now - self._last_telegram_send_ts < TELEGRAM_SEND_SPACING_SECONDS:
            return

        conn = self.conectar_bd()
        if not conn:
            return

        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM genesis_radar_news WHERE nivel = 1 AND telegram_sent = 0 "
                    "ORDER BY (severity = 'CRITICAL') DESC, created_at ASC LIMIT 1"
                )
                row = cur.fetchone()

            if not row:
                return

            if not self._pode_disparar(row, conn):
                with conn.cursor() as cur:
                    cur.execute("UPDATE genesis_radar_news SET nivel = 2 WHERE id = %s", (row['id'],))
                conn.commit()
                logger.info(
                    f"[Budget] Nível 1 rebaixado para Nível 2 (orçamento/cooldown): "
                    f"id={row['id']} \"{(row.get('title') or '')[:60]}\""
                )
                return

            row['affected_assets'] = json.loads(row.get('affected_assets') or '[]')

            sent = self.telegram_dispatcher.send_news_alert(row)

            if sent:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE genesis_radar_news SET telegram_sent = 1, telegram_sent_at = NOW() WHERE id = %s",
                        (row['id'],),
                    )
                conn.commit()
                self._last_telegram_send_ts = time.time()
                logger.info(f"[Telegram] Despachado id={row['id']}: {(row.get('title') or '')[:60]}")
            else:
                logger.error(
                    f"[Telegram] Falha ao enviar id={row['id']}; telegram_sent permanece 0, "
                    f"reprocessa no próximo ciclo."
                )
        except Exception as e:
            logger.error(f"Erro ao drenar fila do Telegram: {e}")
        finally:
            conn.close()

    # ─── Resumo diário — 20h horário de Brasília (seção 5.1) ─────────────────

    def _maybe_send_resumo_diario(self):
        agora = _agora_brt()
        hoje = agora.date()

        if agora.hour < RESUMO_HOUR_BRT:
            return
        if self._last_resumo_date == hoje:
            return

        self._last_resumo_date = hoje  # marca antes de tentar: nunca reenvia no mesmo dia
        self._run_resumo_diario()

    def _run_resumo_diario(self):
        logger.info("─── Gerando resumo diário do Radar News ───")
        conn = self.conectar_bd()
        if not conn:
            logger.error("Sem conexão MySQL para o resumo diário.")
            return

        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM genesis_radar_news "
                    "WHERE nivel IN (1, 2) AND DATE(created_at) = CURDATE() "
                    "ORDER BY nivel ASC, impact_score DESC, created_at DESC "
                    "LIMIT 10"
                )
                top10 = cur.fetchall()
        except Exception as e:
            logger.error(f"Erro ao buscar notícias do dia para o resumo: {e}")
            return
        finally:
            conn.close()

        if not top10:
            logger.info("Sem notícia relevante hoje — resumo diário não enviado.")
            return

        conclusao = self._gerar_conclusao_do_dia(top10)
        texto = self._formatar_resumo_diario(top10, conclusao)

        if self.telegram_dispatcher.send_resumo_diario(texto):
            logger.info("Resumo diário enviado com sucesso.")
        else:
            logger.error("Falha ao enviar o resumo diário.")

    def _formatar_resumo_diario(self, top10: list[dict], conclusao: str) -> str:
        linhas = [
            '📰 <b>RADAR NEWS - Resumo do dia</b>',
            '',
            'As 10 principais notícias que movimentaram o mercado hoje:',
            '',
        ]
        for i, item in enumerate(top10, start=1):
            categoria_nome = item.get('category') or 'Radar News'
            titulo = item.get('title') or 'Sem título'
            impacto = (item.get('impact_summary') or '').strip()
            linhas.append(f'{i}. [{categoria_nome}] {titulo}')
            if impacto:
                linhas.append(f'   Impacto: {impacto}')
            linhas.append('')

        linhas.append(f'Conclusão do dia: {conclusao}')
        linhas.append('')
        linhas.append('Cripto.ico')
        return '\n'.join(linhas)

    def _gerar_conclusao_do_dia(self, top10: list[dict]) -> str:
        """Pede ao Gemini (via API interna Genesis) uma leitura objetiva do tom do mercado."""
        resumo_itens = "\n".join(
            f"- [{item.get('category') or ''}] {item.get('title') or ''}: {(item.get('impact_summary') or '')[:200]}"
            for item in top10
        )
        prompt = (
            "Com base nas notícias de mercado cripto abaixo, escreva UMA frase objetiva em "
            "português descrevendo o tom geral do mercado hoje (ex.: aumento de aversão a risco, "
            "fluxo institucional positivo, pressão regulatória, risco em stablecoins). "
            "Responda apenas com a frase, sem explicação.\n\n" + resumo_itens
        )
        texto = self.ai_classifier._call_gemini(prompt)
        if not texto:
            return "Sem leitura disponível hoje."
        return texto.strip().splitlines()[0][:300]

    # ─── Main loop ────────────────────────────────────────────────────────────

    def rodar(self):
        """Loop principal do worker."""
        self._validate_env()

        logger.info("=" * 60)
        logger.info("📡 RADAR NEWS WORKER INICIADO (V1.0)")
        logger.info(f"   Ciclo RSS: a cada {RSS_CYCLE_SECONDS}s ({RSS_CYCLE_SECONDS // 60} min)")
        logger.info(f"   Resumo diário: {RESUMO_HOUR_BRT}h (horário de Brasília)")
        logger.info(f"   MySQL: {MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}")
        logger.info("=" * 60)

        self._last_rss_cycle = 0.0

        while self.running:
            try:
                now = time.time()

                if now - self._last_rss_cycle >= RSS_CYCLE_SECONDS:
                    self._run_rss_cycle()
                    self._last_rss_cycle = time.time()

                self._drain_telegram_queue()
                self._maybe_send_resumo_diario()

                time.sleep(QUEUE_DRAIN_TICK_SECONDS)

            except Exception as e:
                logger.error(f"Erro no loop principal: {e}")
                time.sleep(5)

        logger.info("Radar News worker encerrado.")


# ─── Entrypoint ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    worker = RadarNewsWorker()
    worker.rodar()
