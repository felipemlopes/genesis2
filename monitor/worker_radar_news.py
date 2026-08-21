"""
Worker Radar News — Gênesis Labs V1.0
Coleta notícias de RSS a cada 3 minutos, classifica via Gemini (API pública do Google),
persiste no MySQL, roteia por nível (C4) e despacha para o Telegram por fila
persistente (C8) com orçamento/cooldown por tema (C9). Envia o resumo diário
às 20h horário de Brasília (seção 5.1).

Radar News NÃO é Radar de Oportunidades: nenhum código de descoberta/scoring de
tokens roda neste worker (C11) — isso é outro sistema.
"""

import hashlib
import json
import os
import sys
import time
import signal
import logging
from datetime import datetime, timedelta, timezone

import pymysql
from dotenv import load_dotenv
from rapidfuzz import fuzz

# load_dotenv() PRECISA rodar antes de importar ai_classifier: esse módulo lê
# GENESIS_AI_URL/GENESIS_AI_TOKEN do ambiente no nível de módulo (na hora do
# import), então se o .env ainda não tiver sido carregado essas constantes
# ficam travadas em '' pelo resto do processo (Python não relê o valor depois).
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))

from rss_collector import RSSCollector, CICLOS_SEM_ENTRADA_PARA_ALERTA
from ai_classifier import (
    AIClassifier,
    load_carteira_tokens,
    GENESIS_AI_URL,
    GENESIS_AI_TOKEN,
    CATEGORIAS_NOMES,
)
from telegram_dispatcher import TelegramDispatcher

# ─── Variáveis de ambiente ────────────────────────────────────────────────────

MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
MYSQL_USER = os.getenv('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '')
MYSQL_DATABASE = os.getenv('MYSQL_DATABASE', 'genesis_db')
MYSQL_PORT = int(os.getenv('MYSQL_PORT', 3306))

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID', '')

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

# Garantia de não reenvio (Bloco D) — trava de despacho (D1) e idempotência de envio (D2)
DISPATCH_DEDUP_HOURS = 72
DISPATCH_SIMILARITY_THRESHOLD = 88

# Roteamento e orçamento (Bloco E2) — RT-07 pendente ratificação do Fabrício
JANELA_UTIL_HORAS = 6      # depois disso a notícia perdeu o valor operacional
ADIAMENTO_MINUTOS = 45

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

        # Bloco G (telemetria): acumula entre flushes de _registrar_telemetria_do_ciclo
        # (chamado no fim de cada ciclo RSS) — disparo/supressão acontecem no drain da
        # fila, que roda numa cadência própria (QUEUE_DRAIN_TICK_SECONDS), não presa
        # ao ciclo de coleta.
        self._telemetria_dispatch = {
            'disparadas': 0, 'suprimidas_orcamento': 0, 'suprimidas_duplicidade': 0,
        }

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
            'GENESIS_AI_URL': GENESIS_AI_URL,
            'GENESIS_AI_TOKEN': GENESIS_AI_TOKEN,
            'MYSQL_HOST': MYSQL_HOST,
            'MYSQL_USER': MYSQL_USER,
            'MYSQL_DATABASE': MYSQL_DATABASE,
        }

        missing = [name for name, value in required_vars.items() if not value]

        if missing:
            # Nunca logar o conteúdo dos tokens — só o nome da variável ausente.
            logger.critical(
                f"Variáveis de ambiente obrigatórias ausentes: {', '.join(missing)}. Abortando."
            )
            sys.exit(1)

        logger.info("Todas variáveis de ambiente obrigatórias presentes.")

        conn = self.conectar_bd()
        if conn is None:
            logger.critical("Não foi possível conectar ao MySQL. Abortando.")
            sys.exit(1)

        try:
            self._validate_schema(conn)
        except Exception as exc:
            logger.critical(f'Schema incompatível com o Radar News: {exc}')
            conn.close()
            sys.exit(1)

        self._reconcile_stale_dispatches(conn)
        conn.close()
        logger.info("Conexão MySQL e schema verificados com sucesso.")

        telegram_ok, telegram_error = self.telegram_dispatcher.validate_connection()
        if not telegram_ok:
            logger.critical(f'Telegram inválido: {telegram_error}. Abortando.')
            sys.exit(1)

        logger.info('Credenciais e destino do Telegram validados com sucesso.')

    def _validate_schema(self, conn):
        """Confere, antes de subir, que as tabelas/colunas que o worker usa existem
        de verdade — sem isso o worker parecia saudável no Supervisor enquanto
        classificações e despachos falhavam silenciosamente linha por linha."""
        required_tables = {
            'genesis_radar_news',
            'genesis_radar_dispatch',
            'genesis_radar_resumo',
            'genesis_radar_telemetria',
            'genesis_carteira_tokens',
        }
        required_news_columns = {
            'title_original',
            'supressao',
            'adiado_ate',
            'piso_aplicado',
            'telegram_sent',
            'telegram_sent_at',
            'nivel',
            'impact_score',
        }

        with conn.cursor() as cur:
            cur.execute('SHOW TABLES')
            tables = {next(iter(row.values())) for row in cur.fetchall()}

            missing_tables = sorted(required_tables - tables)
            if missing_tables:
                raise RuntimeError(f"Tabelas ausentes: {', '.join(missing_tables)}")

            cur.execute('SHOW COLUMNS FROM genesis_radar_news')
            columns = {row['Field'] for row in cur.fetchall()}

            missing_columns = sorted(required_news_columns - columns)
            if missing_columns:
                raise RuntimeError(f"Colunas ausentes: {', '.join(missing_columns)}")

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
        finally:
            # Bloco G: telemetria sempre fecha o ciclo, mesmo em erro/0 entradas —
            # é exatamente o cenário ("por que o Radar não trouxe nada hoje?") que
            # o próprio documento cita como motivação do bloco.
            self._registrar_telemetria_do_ciclo()

    # ─── Telemetria (Bloco G) ──────────────────────────────────────────────────

    def _registrar_telemetria_do_ciclo(self):
        """Junta os contadores do coletor, do classificador e do despacho num só
        registro por ciclo. Tenta gravar em genesis_radar_telemetria; se a tabela
        não existir ainda (dependência externa deste plano), loga o resumo mesmo
        assim — não é aceitável que ficar sem a tabela signifique ficar sem
        nenhuma visibilidade também."""
        rss = getattr(self.rss_collector, 'telemetria', {})
        ai = getattr(self.ai_classifier, '_telemetria', {})
        disp = self._telemetria_dispatch
        feeds_mudos = ','.join(
            nome for nome, vazios in self.rss_collector._vazios.items()
            if vazios >= CICLOS_SEM_ENTRADA_PARA_ALERTA
        )

        registro = {
            'coletadas': rss.get('coletadas', 0),
            'cortadas_frescor': rss.get('cortadas_frescor', 0),
            'cortadas_sem_data': rss.get('cortadas_sem_data', 0),
            'cortadas_hash': rss.get('cortadas_hash', 0),
            'cortadas_similaridade': rss.get('cortadas_similaridade', 0),
            'enviadas_ao_modelo': ai.get('enviadas_ao_modelo', 0),
            'lotes_falhos': ai.get('lotes_falhos', 0),
            'perdidas_classificacao': ai.get('perdidas_classificacao', 0),
            'acionaveis': ai.get('acionaveis', 0),
            'piso_aplicado': ai.get('piso_aplicado', 0),
            'cortadas_event_key': ai.get('cortadas_event_key', 0),
            'nivel_1': ai.get('nivel_1', 0),
            'nivel_2': ai.get('nivel_2', 0),
            'nivel_3': ai.get('nivel_3', 0),
            'disparadas': disp['disparadas'],
            'suprimidas_orcamento': disp['suprimidas_orcamento'],
            'suprimidas_duplicidade': disp['suprimidas_duplicidade'],
            'feeds_mudos': feeds_mudos or None,
        }

        logger.info(f"[Telemetria] {registro}")

        conn = self.conectar_bd()
        if conn:
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO genesis_radar_telemetria "
                        "(coletadas, cortadas_frescor, cortadas_sem_data, cortadas_hash, "
                        " cortadas_similaridade, enviadas_ao_modelo, lotes_falhos, "
                        " perdidas_classificacao, acionaveis, piso_aplicado, cortadas_event_key, "
                        " nivel_1, nivel_2, nivel_3, disparadas, suprimidas_orcamento, "
                        " suprimidas_duplicidade, feeds_mudos) "
                        "VALUES (%(coletadas)s, %(cortadas_frescor)s, %(cortadas_sem_data)s, "
                        " %(cortadas_hash)s, %(cortadas_similaridade)s, %(enviadas_ao_modelo)s, "
                        " %(lotes_falhos)s, %(perdidas_classificacao)s, %(acionaveis)s, "
                        " %(piso_aplicado)s, %(cortadas_event_key)s, %(nivel_1)s, %(nivel_2)s, "
                        " %(nivel_3)s, %(disparadas)s, %(suprimidas_orcamento)s, "
                        " %(suprimidas_duplicidade)s, %(feeds_mudos)s)",
                        registro,
                    )
                conn.commit()
            except Exception as e:
                # Esperado até a migration de genesis_radar_telemetria existir
                # (dependência externa, fora da pasta monitor/) — não deixa o
                # ciclo falhar por causa disso, só fica sem persistir a linha.
                logger.debug(f"[Telemetria] Não gravado em genesis_radar_telemetria: {e}")
            finally:
                conn.close()

        # Janela de contagem de despacho fecha aqui — o próximo ciclo começa do zero.
        self._telemetria_dispatch = {
            'disparadas': 0, 'suprimidas_orcamento': 0, 'suprimidas_duplicidade': 0,
        }

    # ─── Orçamento e cooldown por tema (C9) ───────────────────────────────────

    def _pode_disparar(self, row: dict, conn) -> bool:
        """CRITICAL nunca é limitado. Nível 1 não-crítico: teto de 3/hora e 10/dia;
        mesmo tema (categoria + ativo principal) em 2h rebaixa para Nível 2."""
        if (row.get('severity') or '').upper() == 'CRITICAL':
            return True

        try:
            with conn.cursor() as cur:
                # E2: contar pelo horário do ENVIO, não pelo da criação — senão uma
                # notícia criada há 50min e só enviada agora (após fila/adiamento)
                # nunca conta pro teto da hora em que foi de fato pro Telegram.
                cur.execute(
                    "SELECT COUNT(*) AS n FROM genesis_radar_news "
                    "WHERE nivel = 1 AND telegram_sent = 1 AND telegram_sent_at >= NOW() - INTERVAL 1 HOUR"
                )
                hora = cur.fetchone()['n']

                cur.execute(
                    "SELECT COUNT(*) AS n FROM genesis_radar_news "
                    "WHERE nivel = 1 AND telegram_sent = 1 AND DATE(telegram_sent_at) = CURDATE()"
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
            # Fail-open explícito (E2): o pior caso aqui é uma notícia a mais, nunca
            # uma repetida — o oposto deliberado do fail-closed de _ja_foi_ao_telegram.
            logger.error(f"[Budget] Falha ao checar orçamento, liberando por segurança: {e}")
            return True

        return hora < NIVEL1_HOURLY_CAP and dia < NIVEL1_DAILY_CAP and tema == 0

    # ─── Garantia de não reenvio (Bloco D) ─────────────────────────────────────

    def _ja_foi_ao_telegram(self, row: dict, conn) -> str | None:
        """Devolve o motivo da supressão, ou None se pode enviar (D1).
        Regra: um fato vai ao Telegram UMA vez. Nunca duas."""
        try:
            with conn.cursor() as cur:
                if row.get('event_key'):
                    cur.execute(
                        "SELECT id FROM genesis_radar_news "
                        "WHERE event_key = %s AND telegram_sent = 1 AND id <> %s "
                        "AND telegram_sent_at >= NOW() - INTERVAL %s HOUR LIMIT 1",
                        (row['event_key'], row['id'], DISPATCH_DEDUP_HOURS),
                    )
                    dup = cur.fetchone()
                    if dup:
                        return f"event_key ja enviado no id={dup['id']}"

                cur.execute(
                    "SELECT id, title FROM genesis_radar_news "
                    "WHERE telegram_sent = 1 AND telegram_sent_at >= NOW() - INTERVAL %s HOUR",
                    (DISPATCH_DEDUP_HOURS,),
                )
                enviados = cur.fetchall()
        except Exception as e:
            logger.error(f"[Dedup-Despacho] Erro na verificacao: {e}")
            return "erro na verificacao de duplicidade"  # fail-CLOSED: na duvida, nao envia

        alvo = (row.get('title') or '').lower()
        for env in enviados:
            if fuzz.token_sort_ratio(alvo, (env['title'] or '').lower()) >= DISPATCH_SIMILARITY_THRESHOLD:
                return f"titulo similar ao id={env['id']} ja enviado"

        return None

    def _reservar_despacho(self, row: dict, conn) -> bool:
        """Reserva a chave de despacho ANTES do POST (D2/P0.5). False = não pode enviar
        agora (reserva ativa de outra tentativa, ou terminal em SENT/UNCERTAIN, ou
        FAILED sem retry_ready ainda).

        Máquina de estados de verdade: PENDING nunca reenvia sozinho (só o worker que
        já reservou decide o desfecho); SENT/UNCERTAIN são terminais, nunca reenviam;
        FAILED permite no máximo 1 nova tentativa (attempts < 2), e só depois de
        next_attempt_at — isso resolve a tensão que a versão anterior deste método
        deixava documentada e sem resolver (INSERT único bloqueava reenvio pra sempre).
        """
        base = row.get('event_key') or row.get('title_hash') or str(row['id'])
        dispatch_key = hashlib.sha256(f"{base}|nivel1".encode('utf-8')).hexdigest()

        try:
            conn.begin()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, status, attempts,
                           (next_attempt_at IS NULL OR next_attempt_at <= NOW()) AS retry_ready
                    FROM genesis_radar_dispatch
                    WHERE dispatch_key = %s
                    FOR UPDATE
                    """,
                    (dispatch_key,),
                )
                current = cur.fetchone()

                if current is None:
                    cur.execute(
                        """
                        INSERT INTO genesis_radar_dispatch
                            (news_id, dispatch_key, status, attempts, created_at, updated_at)
                        VALUES (%s, %s, 'PENDING', 1, NOW(), NOW())
                        """,
                        (row['id'], dispatch_key),
                    )
                    conn.commit()
                    row['_dispatch_key'] = dispatch_key
                    return True

                can_retry = (
                    current['status'] == 'FAILED'
                    and int(current['attempts'] or 0) < 2
                    and bool(current['retry_ready'])
                )

                if can_retry:
                    cur.execute(
                        """
                        UPDATE genesis_radar_dispatch
                        SET status = 'PENDING',
                            attempts = attempts + 1,
                            last_error = NULL,
                            next_attempt_at = NULL,
                            updated_at = NOW()
                        WHERE id = %s
                        """,
                        (current['id'],),
                    )
                    conn.commit()
                    row['_dispatch_key'] = dispatch_key
                    return True

            conn.rollback()
            logger.info(f"[Idempotencia] Despacho ja reservado para id={row['id']}, envio bloqueado.")
            return False
        except Exception:
            conn.rollback()
            raise

    def _reconcile_stale_dispatches(self, conn):
        """Roda no startup (depois de _validate_schema): reservas PENDING antigas
        (processo caiu entre o INSERT/UPDATE e o POST) viram UNCERTAIN — não é
        possível provar se o envio ocorreu antes da queda, então nunca são
        reenviadas (mesma regra fail-closed contra duplicação do resto do Bloco D)."""
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE genesis_radar_dispatch
                SET status = 'UNCERTAIN',
                    last_error = 'Reserva PENDING encontrada apos reinicio; envio nao repetido',
                    updated_at = NOW()
                WHERE status = 'PENDING'
                  AND updated_at < NOW() - INTERVAL 5 MINUTE
                """
            )
        conn.commit()

    # ─── Fila persistente do Telegram (C8) ────────────────────────────────────

    def _drain_telegram_queue(self):
        """Drena a fila persistente de Nível 1 pendente, 1 mensagem por vez, respeitando
        o intervalo mínimo de 30s. telegram_sent só é marcado DEPOIS da confirmação de envio —
        sobrevive a restart do supervisor (A7: genesis-radar-news.conf) porque a fila vive
        na própria tabela, não em thread."""
        now = time.time()
        if now - self._last_telegram_send_ts < TELEGRAM_SEND_SPACING_SECONDS:
            return

        conn = self.conectar_bd()
        if not conn:
            return

        try:
            with conn.cursor() as cur:
                # E2: fila por RELEVÂNCIA (impact_score), não por idade — a versão
                # anterior (ORDER BY created_at ASC) gastava o teto de 3/hora na
                # notícia mais velha e empurrava a mais importante pra depois.
                # Janela de 6h (JANELA_UTIL_HORAS): depois disso a notícia perdeu
                # o valor operacional e sai da fila de tentativa. adiado_ate:
                # notícia que esbarrou no orçamento espera 45min antes de tentar
                # de novo, em vez de ser rebaixada na hora (ver bloco abaixo).
                # P0.5: LEFT JOIN com genesis_radar_dispatch — sem isso, uma reserva
                # terminal (SENT/UNCERTAIN, ou FAILED sem retry_ready ainda) ocupava o
                # topo da fila pra sempre, porque a notícia continuava nivel=1 e
                # telegram_sent=0. Não muda quem é Nível 1, a janela, o orçamento nem
                # o cooldown — só impede a trava.
                cur.execute(
                    """
                    SELECT n.*
                    FROM genesis_radar_news n
                    LEFT JOIN genesis_radar_dispatch d ON d.news_id = n.id
                    WHERE n.nivel = 1
                      AND n.telegram_sent = 0
                      AND n.created_at >= NOW() - INTERVAL %s HOUR
                      AND (n.adiado_ate IS NULL OR n.adiado_ate <= NOW())
                      AND (
                          d.id IS NULL
                          OR (
                              d.status = 'FAILED'
                              AND d.attempts < 2
                              AND (d.next_attempt_at IS NULL OR d.next_attempt_at <= NOW())
                          )
                      )
                    ORDER BY (n.severity = 'CRITICAL') DESC,
                             n.impact_score DESC,
                             n.created_at DESC
                    LIMIT 1
                    """,
                    (JANELA_UTIL_HORAS,),
                )
                row = cur.fetchone()

            if not row:
                return

            motivo = self._ja_foi_ao_telegram(row, conn)
            if motivo:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE genesis_radar_news SET nivel = 2, supressao = %s WHERE id = %s",
                        (f'DUPLICADO: {motivo}', row['id']),
                    )
                conn.commit()
                self._telemetria_dispatch['suprimidas_duplicidade'] += 1
                logger.info(
                    f"[Dedup-Despacho] SUPRIMIDA id={row['id']} ({motivo}): "
                    f"\"{(row.get('title') or '')[:60]}\""
                )
                return

            if not self._pode_disparar(row, conn):
                # E2: rebaixamento deixa de ser sentença. Só vira Nível 2 de vez
                # quando a notícia já passou da janela útil (6h) — antes disso,
                # é só adiada 45min, pra não morrer por causa de um pico pontual
                # de orçamento/cooldown.
                idade_horas = (datetime.utcnow() - row['created_at']).total_seconds() / 3600
                with conn.cursor() as cur:
                    if idade_horas >= JANELA_UTIL_HORAS:
                        cur.execute(
                            "UPDATE genesis_radar_news SET nivel = 2, supressao = 'ORCAMENTO_EXPIRADO' "
                            "WHERE id = %s",
                            (row['id'],),
                        )
                        logger.info(f"[Budget] Rebaixada por expiração: id={row['id']}")
                    else:
                        cur.execute(
                            "UPDATE genesis_radar_news SET adiado_ate = NOW() + INTERVAL %s MINUTE "
                            "WHERE id = %s",
                            (ADIAMENTO_MINUTOS, row['id']),
                        )
                        logger.info(
                            f"[Budget] Adiada {ADIAMENTO_MINUTOS} min (orçamento/cooldown): id={row['id']}"
                        )
                conn.commit()
                self._telemetria_dispatch['suprimidas_orcamento'] += 1
                return

            if not self._reservar_despacho(row, conn):
                # Já reservado por um ciclo anterior (ex.: processo caiu entre reservar
                # e enviar, ou já foi tratado). Não reenvia.
                return

            row['affected_assets'] = json.loads(row.get('affected_assets') or '[]')

            resultado = self.telegram_dispatcher.send_news_alert(row)

            with conn.cursor() as cur:
                if resultado['status'] == 'SENT':
                    cur.execute(
                        """
                        UPDATE genesis_radar_dispatch
                        SET status = 'SENT',
                            telegram_message_id = %s,
                            confirmed_at = NOW(),
                            last_error = NULL,
                            next_attempt_at = NULL,
                            updated_at = NOW()
                        WHERE dispatch_key = %s
                        """,
                        (resultado.get('message_id'), row['_dispatch_key']),
                    )
                    cur.execute(
                        "UPDATE genesis_radar_news SET telegram_sent = 1, telegram_sent_at = NOW() WHERE id = %s",
                        (row['id'],),
                    )
                    conn.commit()
                    self._last_telegram_send_ts = time.time()
                    self._telemetria_dispatch['disparadas'] += 1
                    logger.info(f"[Telegram] Despachado id={row['id']}: {(row.get('title') or '')[:60]}")
                elif resultado['status'] == 'FAILED':
                    cur.execute(
                        """
                        UPDATE genesis_radar_dispatch
                        SET status = 'FAILED',
                            last_error = %s,
                            next_attempt_at = NOW() + INTERVAL 5 MINUTE,
                            updated_at = NOW()
                        WHERE dispatch_key = %s
                        """,
                        ((resultado.get('error') or 'Falha confirmada')[:1000], row['_dispatch_key']),
                    )
                    conn.commit()
                    logger.error(
                        f"[Telegram] Erro claro ao enviar id={row['id']}; despacho marcado FAILED "
                        f"(telegram_sent permanece 0, 1 nova tentativa liberada em 5min)."
                    )
                else:  # UNCERTAIN
                    cur.execute(
                        """
                        UPDATE genesis_radar_dispatch
                        SET status = 'UNCERTAIN',
                            last_error = %s,
                            next_attempt_at = NULL,
                            updated_at = NOW()
                        WHERE dispatch_key = %s
                        """,
                        ((resultado.get('error') or 'Desfecho incerto')[:1000], row['_dispatch_key']),
                    )
                    conn.commit()
                    logger.error(
                        f"[Telegram] Desfecho INCERTO ao enviar id={row['id']} (timeout/erro de rede). "
                        f"NÃO reenviando — a mensagem pode já ter sido entregue (RT-04)."
                    )
        except Exception as e:
            logger.error(f"Erro ao drenar fila do Telegram: {e}")
        finally:
            conn.close()

    # ─── Resumo diário — 20h horário de Brasília (seção 5.1) ─────────────────

    @staticmethod
    def _limites_dia_brt() -> tuple[datetime, datetime]:
        """Início e fim do dia em horário de Brasília, convertidos pra UTC (D3) —
        nunca CURDATE(), que compararia contra o relógio do servidor MySQL.
        created_at é gravado em UTC (datetime.utcnow() em todo o resto do worker)."""
        agora_brt = _agora_brt()
        inicio_brt = agora_brt.replace(hour=0, minute=0, second=0, microsecond=0)
        fim_brt = inicio_brt + timedelta(days=1)
        # _agora_brt() embute o offset de -3h nos números do datetime (tzinfo
        # continua utc); subtrair BRT_OFFSET de volta dá o instante UTC real.
        inicio_utc = (inicio_brt - BRT_OFFSET).replace(tzinfo=None)
        fim_utc = (fim_brt - BRT_OFFSET).replace(tzinfo=None)
        return inicio_utc, fim_utc

    def _reservar_resumo_do_dia(self, hoje, conn) -> bool:
        """Reserva a linha do resumo do dia ANTES de montar/enviar (D4/P0.6). Mesma
        máquina de estados do despacho (_reservar_despacho): PENDING/SENT/UNCERTAIN
        nunca reenviam sozinhos, FAILED permite no máximo 1 nova tentativa. Resolve a
        limitação que a versão anterior deixava documentada — INSERT único sem coluna
        de status não tinha como distinguir "já enviado" de "reservado e falhou"."""
        try:
            conn.begin()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, status, attempts,
                           (next_attempt_at IS NULL OR next_attempt_at <= NOW()) AS retry_ready
                    FROM genesis_radar_resumo
                    WHERE data_ref = %s
                    FOR UPDATE
                    """,
                    (hoje,),
                )
                current = cur.fetchone()

                if current is None:
                    cur.execute(
                        """
                        INSERT INTO genesis_radar_resumo
                            (data_ref, status, attempts, itens, created_at, updated_at)
                        VALUES (%s, 'PENDING', 1, 0, NOW(), NOW())
                        """,
                        (hoje,),
                    )
                    conn.commit()
                    return True

                can_retry = (
                    current['status'] == 'FAILED'
                    and int(current['attempts'] or 0) < 2
                    and bool(current['retry_ready'])
                )

                if can_retry:
                    cur.execute(
                        """
                        UPDATE genesis_radar_resumo
                        SET status = 'PENDING',
                            attempts = attempts + 1,
                            last_error = NULL,
                            next_attempt_at = NULL,
                            updated_at = NOW()
                        WHERE id = %s
                        """,
                        (current['id'],),
                    )
                    conn.commit()
                    return True

            conn.rollback()
            logger.info(f"[Resumo] Resumo de {hoje} já foi enviado ou aguarda retry, não reenviando agora.")
            return False
        except Exception:
            conn.rollback()
            raise

    def _maybe_send_resumo_diario(self):
        agora = _agora_brt()
        hoje = agora.date()

        if agora.hour < RESUMO_HOUR_BRT:
            return
        if self._last_resumo_date == hoje:
            # Otimização local, não a garantia: evita bater no banco a cada
            # QUEUE_DRAIN_TICK_SECONDS pelo resto da noite. Quem garante
            # não-reenvio de verdade é a tabela genesis_radar_resumo (D4) —
            # um restart limpa esse cache, mas o INSERT reservado continua
            # rejeitando o reenvio.
            return

        if self._run_resumo_diario():
            self._last_resumo_date = hoje

    def _run_resumo_diario(self) -> bool:
        """Retorna True se o resumo já está tratado (enviado agora, enviado antes,
        ou não havia nada pra enviar) — False só em falha real que vale reprocessar
        no próximo tick."""
        logger.info("─── Gerando resumo diário do Radar News ───")
        hoje = _agora_brt().date()
        conn = self.conectar_bd()
        if not conn:
            logger.error("Sem conexão MySQL para o resumo diário.")
            return False

        try:
            if not self._reservar_resumo_do_dia(hoje, conn):
                return True  # já saiu — não é erro, só nada a fazer

            inicio_utc, fim_utc = self._limites_dia_brt()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM (
                        SELECT n.*,
                               CASE n.severity
                                   WHEN 'CRITICAL' THEN 3 WHEN 'HIGH' THEN 2
                                   WHEN 'MEDIUM' THEN 1 ELSE 0
                               END AS severity_ord,
                               ROW_NUMBER() OVER (
                                   PARTITION BY COALESCE(n.event_key, n.title_hash)
                                   ORDER BY n.impact_score DESC, n.created_at DESC
                               ) AS rn
                        FROM genesis_radar_news n
                        WHERE n.nivel IN (1, 2)
                          AND n.created_at >= %s AND n.created_at < %s
                    ) t
                    WHERE t.rn = 1
                    ORDER BY t.impact_score DESC, t.severity_ord DESC, t.created_at DESC
                    LIMIT 10
                    """,
                    (inicio_utc, fim_utc),
                )
                top10 = cur.fetchall()
        except Exception as e:
            logger.error(f"Erro ao buscar notícias do dia para o resumo: {e}")
            return False
        finally:
            conn.close()

        if not top10:
            logger.info("Sem notícia relevante hoje — resumo diário não enviado.")
            self._atualizar_estado_resumo(hoje, {'status': 'SENT', 'message_id': None, 'error': None}, 0)
            return True

        conclusao = self._gerar_conclusao_do_dia(top10)
        texto = self._formatar_resumo_diario(top10, conclusao)

        resultado = self.telegram_dispatcher.send_resumo_diario(texto)
        self._atualizar_estado_resumo(hoje, resultado, len(top10))

        if resultado['status'] == 'SENT':
            logger.info("Resumo diário enviado com sucesso.")
        elif resultado['status'] == 'FAILED':
            logger.error(f"Falha confirmada ao enviar o resumo diário: {resultado.get('error')}")
        else:
            logger.error(
                f"Desfecho INCERTO ao enviar o resumo diário: {resultado.get('error')}. "
                f"NÃO reenviando — pode já ter sido entregue."
            )

        # SENT/UNCERTAIN são tratados como "não reprocessar no próximo tick" (o
        # cache local de _maybe_send_resumo_diario passa a considerar o dia
        # fechado); só FAILED com retry_ready ainda vale reprocessar antes das 24h.
        return resultado['status'] in ('SENT', 'UNCERTAIN')

    def _atualizar_estado_resumo(self, hoje, resultado: dict, itens: int) -> None:
        """Atualiza genesis_radar_resumo com o desfecho real do envio (P0.6). Reabre
        conexão própria porque o SELECT do top10 já fechou a anterior — mesmo padrão
        do documento (seção 12.3)."""
        conn = self.conectar_bd()
        if not conn:
            logger.error('Resumo enviado ou tentado, mas sem conexão para atualizar o estado.')
            return

        try:
            with conn.cursor() as cur:
                if resultado['status'] == 'SENT':
                    cur.execute(
                        """
                        UPDATE genesis_radar_resumo
                        SET status = 'SENT',
                            itens = %s,
                            telegram_message_id = %s,
                            enviado_em = NOW(),
                            last_error = NULL,
                            updated_at = NOW()
                        WHERE data_ref = %s
                        """,
                        (itens, resultado.get('message_id'), hoje),
                    )
                elif resultado['status'] == 'FAILED':
                    cur.execute(
                        """
                        UPDATE genesis_radar_resumo
                        SET status = 'FAILED',
                            last_error = %s,
                            next_attempt_at = NOW() + INTERVAL 5 MINUTE,
                            updated_at = NOW()
                        WHERE data_ref = %s
                        """,
                        ((resultado.get('error') or 'Falha confirmada')[:1000], hoje),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE genesis_radar_resumo
                        SET status = 'UNCERTAIN',
                            last_error = %s,
                            next_attempt_at = NULL,
                            updated_at = NOW()
                        WHERE data_ref = %s
                        """,
                        ((resultado.get('error') or 'Desfecho incerto')[:1000], hoje),
                    )
            conn.commit()
        finally:
            conn.close()

    @staticmethod
    def _categoria_nome(item: dict) -> str:
        """F07: o rótulo sai de CATEGORIAS_NOMES (a partir de `categoria`, número) —
        `category` (texto) parou de ser gravado em persist_classified; o fallback pro
        texto legado só serve pra linha antiga que já tinha `category` persistido
        antes desta correção."""
        return CATEGORIAS_NOMES.get(item.get('categoria')) or item.get('category') or 'Radar News'

    def _formatar_resumo_diario(self, top10: list[dict], conclusao: str) -> str:
        linhas = [
            '📰 <b>RADAR NEWS - Resumo do dia</b>',
            '',
            'As 10 principais notícias que movimentaram o mercado hoje:',
            '',
        ]
        for i, item in enumerate(top10, start=1):
            categoria_nome = self._categoria_nome(item)
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
        """Pede ao Gemini (API pública do Google) uma leitura objetiva do tom do mercado."""
        resumo_itens = "\n".join(
            f"- [{self._categoria_nome(item)}] {item.get('title') or ''}: {(item.get('impact_summary') or '')[:200]}"
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

                # P1.2: drenar a fila e checar o resumo ANTES do ciclo RSS, não depois —
                # correção mínima (documento, seção 13). Limite real, não escondido: isso
                # evita que a fila fique presa esperando a *próxima* iteração do laço,
                # mas não resolve o caso em que _run_rss_cycle() já está em execução
                # (fetch de feed lento, retries do Gemini) — é uma única thread, então
                # enquanto o ciclo RSS roda, nada mais roda neste processo. A correção
                # definitiva (2 processos separados, produtor/consumidor) fica fora do
                # escopo P0, como o próprio documento registra.
                self._drain_telegram_queue()
                self._maybe_send_resumo_diario()

                if now - self._last_rss_cycle >= RSS_CYCLE_SECONDS:
                    self._run_rss_cycle()
                    self._last_rss_cycle = time.time()

                time.sleep(QUEUE_DRAIN_TICK_SECONDS)

            except Exception as e:
                logger.error(f"Erro no loop principal: {e}")
                time.sleep(5)

        logger.info("Radar News worker encerrado.")


# ─── Entrypoint ───────────────────────────────────────────────────────────────

if __name__ == '__main__':
    worker = RadarNewsWorker()
    worker.rodar()
