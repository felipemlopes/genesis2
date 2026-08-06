"""
RSS Collector — Gênesis Labs Radar News
Busca notícias de feeds RSS configurados usando feedparser.
"""

import hashlib
import logging
import socket

import feedparser

logger = logging.getLogger('radar-news')

# ─── Coleta robusta (A5) ────────────────────────────────────────────────────────
# feedparser.parse(url) sem User-Agent/timeout deixava o Radar cego: Bloomberg e FT
# (atrás de CDN) costumam devolver 403 pro User-Agent padrão, e um feed lento sem
# timeout travava o ciclo inteiro (fila do Telegram e resumo das 20h incluídos).

socket.setdefaulttimeout(20)

FEED_USER_AGENT = 'Mozilla/5.0 (compatible; GenesisRadarNews/1.1; +https://cripto.ico)'
CICLOS_SEM_ENTRADA_PARA_ALERTA = 20   # 20 ciclos de 3 min = 1 hora

# ─── Dedup de entrada (A3) ──────────────────────────────────────────────────────
# Roda ANTES da classificação: hash global 24h (sem filtrar por fonte — o Aviso 1
# da V1.0 mandava remover o dedup por título+fonte, sem deixar conviver) mais
# similaridade 72h sobre o TÍTULO ORIGINAL (nunca o traduzido pelo Gemini).

SIMILARITY_WINDOW_HOURS = 72
SIMILARITY_THRESHOLD = 85  # % (rapidfuzz) — RT-08 pendente ratificação do PO pra subir a 88

# ─── RSS Sources Configuration ────────────────────────────────────────────────

RSS_FEEDS = [
    {
        'name': 'Decrypt',
        'url': 'https://decrypt.co/feed',
    },
    {
        'name': 'Cointelegraph',
        'url': 'https://cointelegraph.com/rss',
    },
    {
        'name': 'Bitcoin Magazine',
        'url': 'https://bitcoinmagazine.com/feed',
    },
    {
        'name': 'The Block',
        'url': 'https://www.theblock.co/rss.xml',
    },
    {
        'name': 'CryptoSlate',
        'url': 'https://cryptoslate.com/feed/',
    },
    {
        'name': 'NewsBTC',
        'url': 'https://www.newsbtc.com/feed/',
    },
    {
        'name': 'Bloomberg',
        'url': 'https://feeds.bloomberg.com/markets/news.rss',
    },
    {
        'name': 'FT Markets',
        'url': 'https://www.ft.com/markets?format=rss',
    },
]


class RSSCollector:
    """Coleta entradas de feeds RSS de múltiplas fontes cripto/financeiras."""

    def __init__(self, feeds=None):
        """
        Args:
            feeds: Lista de dicts com 'name' e 'url'. Se None, usa RSS_FEEDS padrão.
        """
        self.feeds = feeds if feeds is not None else RSS_FEEDS
        self._cache = {}   # name -> {'etag':..., 'modified':...}
        self._vazios = {}  # name -> ciclos consecutivos sem entrada
        # Bloco G (telemetria): contadores do último ciclo. Fica em memória —
        # persistir em genesis_radar_telemetria depende de migration que não
        # existe ainda (worker faz a tentativa de INSERT e loga o resumo de
        # qualquer forma, ver RadarNewsWorker._registrar_telemetria_do_ciclo).
        self.telemetria = {'coletadas': 0, 'cortadas_frescor': 0, 'cortadas_sem_data': 0}

    def fetch_all_feeds(self) -> list[dict]:
        """Busca entradas de todos os feeds RSS configurados.

        Processa cada feed de forma independente — se um feed falhar,
        loga o erro e continua para os demais (fault tolerance).

        Returns:
            Lista de dicts com campos: title, published, source, source_url, summary
        """
        all_entries = []
        self.telemetria = {'coletadas': 0, 'cortadas_frescor': 0, 'cortadas_sem_data': 0}

        for feed_config in self.feeds:
            name = feed_config['name']
            url = feed_config['url']

            try:
                entries = self._fetch_single_feed(name, url)
                all_entries.extend(entries)
                self._registrar_saude(name, len(entries))
                logger.info(f"[RSS] {name}: {len(entries)} entrada(s) coletada(s)")
            except Exception as e:
                logger.error(f"[RSS] Erro ao buscar feed '{name}' ({url}): {e}")
                self._registrar_saude(name, 0)
                continue

        self.telemetria['coletadas'] = len(all_entries)
        logger.info(f"[RSS] Total coletado: {len(all_entries)} entrada(s) de {len(self.feeds)} feed(s)")
        return all_entries

    @staticmethod
    def compute_title_hash(title: str) -> str:
        """Calcula SHA-256 do título em lowercase para deduplicação.

        Args:
            title: Título original da notícia.

        Returns:
            Hash SHA-256 hex do título em lowercase.
        """
        return hashlib.sha256(title.lower().encode('utf-8')).hexdigest()

    def deduplicate(self, entries: list[dict], db_connection) -> list[dict]:
        """Corta antes de gastar classificação: hash global 24h + similaridade 72h
        sobre o TÍTULO ORIGINAL (nunca sobre o título traduzido) — A3.

        O dedup por título+fonte saiu daqui (Aviso 1 da V1.0): descartava
        atualização legítima da mesma fonte dentro de 24h e nunca deveria ter
        continuado vivo depois que a migration tirou o índice único correspondente.

        Args:
            entries: Lista de dicts com pelo menos 'title'.
            db_connection: Conexão pymysql ativa.

        Returns:
            Lista de entradas que NÃO existem no banco (novas).
        """
        if not entries:
            return []

        from rapidfuzz import fuzz

        novas = []
        cortadas_hash = 0
        cortadas_similaridade = 0
        try:
            with db_connection.cursor() as cursor:
                cursor.execute(
                    "SELECT title_original FROM genesis_radar_news "
                    "WHERE created_at >= NOW() - INTERVAL %s HOUR AND title_original IS NOT NULL",
                    (SIMILARITY_WINDOW_HOURS,),
                )
                recentes = [r['title_original'].lower() for r in cursor.fetchall() if r.get('title_original')]

                for entry in entries:
                    title_hash = self.compute_title_hash(entry['title'])
                    entry['title_hash'] = title_hash

                    cursor.execute(
                        "SELECT id FROM genesis_radar_news "
                        "WHERE title_hash = %s AND created_at >= NOW() - INTERVAL 24 HOUR LIMIT 1",
                        (title_hash,),
                    )
                    if cursor.fetchone():
                        logger.info(f"[DEDUP] Hash já registrado: '{entry['title'][:60]}'")
                        cortadas_hash += 1
                        continue

                    alvo = entry['title'].lower()
                    similar = next(
                        (t for t in recentes if fuzz.token_sort_ratio(alvo, t) >= SIMILARITY_THRESHOLD),
                        None,
                    )
                    if similar:
                        logger.info(f"[DEDUP] Similar em 72h, ignorada: '{entry['title'][:60]}'")
                        cortadas_similaridade += 1
                        continue

                    recentes.append(alvo)  # evita duplicata dentro do próprio ciclo
                    novas.append(entry)
        except Exception as e:
            logger.error(f"[DEDUP] Erro ao verificar duplicatas: {e}")
            return entries
        finally:
            self.telemetria['cortadas_hash'] = cortadas_hash
            self.telemetria['cortadas_similaridade'] = cortadas_similaridade

        logger.info(f"[DEDUP] {len(entries)} entrada(s) -> {len(novas)} nova(s)")
        return novas

    def _fetch_single_feed(self, name: str, url: str) -> list[dict]:
        """Busca e parseia um único feed RSS, com User-Agent, timeout e
        cabeçalho condicional (ETag/Last-Modified) — A5.

        Args:
            name: Nome da fonte (ex: 'Reuters')
            url: URL do feed RSS

        Returns:
            Lista de dicts normalizados com dados das entradas.

        Raises:
            Exception: Se o feed retornar erro HTTP ou status de bozo.
        """
        c = self._cache.get(name, {})
        parsed = feedparser.parse(
            url,
            agent=FEED_USER_AGENT,
            etag=c.get('etag'),
            modified=c.get('modified'),
        )

        status = getattr(parsed, 'status', 200)
        if status == 304:
            # Nao modificado desde a ultima checagem: zero entradas, sem erro.
            return []
        if status >= 400:
            raise Exception(f"HTTP {status} ao acessar feed")

        # feedparser seta bozo=1 quando encontra problemas no XML
        if parsed.bozo and not parsed.entries:
            raise Exception(
                f"Feed retornou erro: {getattr(parsed, 'bozo_exception', 'unknown')}"
            )

        self._cache[name] = {
            'etag': getattr(parsed, 'etag', None),
            'modified': getattr(parsed, 'modified', None),
        }

        entries = []
        for entry in parsed.entries:
            parsed_entry = self._parse_entry(entry, name)
            if not parsed_entry:
                continue
            # Janela de frescor: 30 min (C1). Notícia velha dispara movimento que já aconteceu.
            if self._is_recent(entry, hours=0, minutes=30):
                entries.append(parsed_entry)
            elif getattr(entry, 'published_parsed', None) or getattr(entry, 'updated_parsed', None):
                self.telemetria['cortadas_frescor'] = self.telemetria.get('cortadas_frescor', 0) + 1
            else:
                self.telemetria['cortadas_sem_data'] = self.telemetria.get('cortadas_sem_data', 0) + 1

        return entries

    def _registrar_saude(self, name: str, qtd: int):
        """Feed morto tem que gritar. Silêncio não pode ser confundido com dia parado (A5)."""
        if qtd > 0:
            self._vazios[name] = 0
            return
        self._vazios[name] = self._vazios.get(name, 0) + 1
        if self._vazios[name] == CICLOS_SEM_ENTRADA_PARA_ALERTA:
            logger.error(f"[RSS] FONTE MUDA: {name} sem nenhuma entrada há 1 hora. Verificar 403/bloqueio.")

    @staticmethod
    def _is_recent(entry, hours: int = 0, minutes: int = 30) -> bool:
        """Verifica se a entrada foi publicada nos últimos N minutos."""
        import time as _time
        from calendar import timegm

        published_parsed = getattr(entry, 'published_parsed', None) or getattr(entry, 'updated_parsed', None)
        if not published_parsed:
            # Sem data de publicação → sem como garantir frescor (fail-CLOSED, C1)
            logger.debug(f"[RSS] Sem data de publicacao, descartada: {getattr(entry, 'title', '')[:60]}")
            return False

        try:
            entry_timestamp = timegm(published_parsed)
            cutoff = _time.time() - (hours * 3600) - (minutes * 60)
            return entry_timestamp >= cutoff
        except (TypeError, ValueError):
            logger.debug(f"[RSS] Data de publicacao invalida, descartada: {getattr(entry, 'title', '')[:60]}")
            return False

    def _parse_entry(self, entry, source: str) -> dict | None:
        """Extrai campos relevantes de uma entrada feedparser.

        Args:
            entry: Entrada do feedparser
            source: Nome da fonte RSS

        Returns:
            Dict com title, published, source, source_url, summary ou None se inválido.
        """
        title = getattr(entry, 'title', '').strip()
        if not title:
            return None

        # Data de publicação (string bruta do feed)
        published = getattr(entry, 'published', '') or getattr(entry, 'updated', '')

        # URL da matéria
        source_url = getattr(entry, 'link', '')

        # Resumo/conteúdo
        summary = ''
        if hasattr(entry, 'summary'):
            summary = entry.summary
        elif hasattr(entry, 'description'):
            summary = entry.description
        elif hasattr(entry, 'content') and entry.content:
            summary = entry.content[0].get('value', '')

        # Remove tags HTML do summary (limpeza básica)
        summary = self._strip_html(summary).strip()

        return {
            'title': title,
            'published': published,
            'source': source,
            'source_url': source_url,
            'summary': summary[:2000],  # Limita tamanho do summary
        }

    @staticmethod
    def _strip_html(text: str) -> str:
        """Remove tags HTML de forma simples (sem dependência externa)."""
        import re
        clean = re.sub(r'<[^>]+>', '', text)
        # Colapsa múltiplos espaços/newlines
        clean = re.sub(r'\s+', ' ', clean)
        return clean
