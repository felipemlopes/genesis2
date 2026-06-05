"""
RSS Collector — Gênesis Labs Radar News
Busca notícias de feeds RSS configurados usando feedparser.
"""

import hashlib
import logging
from datetime import datetime, timedelta

import feedparser



logger = logging.getLogger('radar-news')

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

    def fetch_all_feeds(self) -> list[dict]:
        """Busca entradas de todos os feeds RSS configurados.

        Processa cada feed de forma independente — se um feed falhar,
        loga o erro e continua para os demais (fault tolerance).

        Returns:
            Lista de dicts com campos: title, published, source, source_url, summary
        """
        all_entries = []

        for feed_config in self.feeds:
            name = feed_config['name']
            url = feed_config['url']

            try:
                entries = self._fetch_single_feed(name, url)
                all_entries.extend(entries)
                logger.info(f"[RSS] {name}: {len(entries)} entrada(s) coletada(s)")
            except Exception as e:
                logger.error(f"[RSS] Erro ao buscar feed '{name}' ({url}): {e}")
                continue

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
        """Filtra entradas já existentes no banco (title_hash + source) nas últimas 24h.

        Args:
            entries: Lista de dicts com pelo menos 'title' e 'source'.
            db_connection: Conexão pymysql ativa.

        Returns:
            Lista de entradas que NÃO existem no banco (novas).
        """
        if not entries:
            return []

        new_entries = []

        try:
            with db_connection.cursor() as cursor:
                for entry in entries:
                    title_hash = self.compute_title_hash(entry['title'])
                    entry['title_hash'] = title_hash

                    since = datetime.utcnow() - timedelta(hours=24)

                    cursor.execute(
                        """
                        SELECT id FROM genesis_radar_news
                        WHERE title_hash = %s AND source = %s AND created_at >= %s
                        LIMIT 1
                        """,
                        (title_hash, entry['source'], since)
                    )

                    if cursor.fetchone() is None:
                        new_entries.append(entry)
                    else:
                        logger.info(
                            f"[DEDUP] Entrada duplicada ignorada: '{entry['title'][:60]}...' ({entry['source']})"
                        )

        except Exception as e:
            logger.error(f"[DEDUP] Erro ao verificar duplicatas no banco: {e}")
            # Em caso de erro no DB, retorna todas as entradas (fail-open)
            return entries

        logger.info(f"[DEDUP] {len(entries)} entrada(s) → {len(new_entries)} nova(s), {len(entries) - len(new_entries)} duplicada(s)")
        return new_entries

    def _fetch_single_feed(self, name: str, url: str) -> list[dict]:
        """Busca e parseia um único feed RSS.

        Args:
            name: Nome da fonte (ex: 'Reuters')
            url: URL do feed RSS

        Returns:
            Lista de dicts normalizados com dados das entradas.

        Raises:
            Exception: Se o feed retornar erro HTTP ou status de bozo.
        """
        parsed = feedparser.parse(url)

        # feedparser seta bozo=1 quando encontra problemas no XML
        if parsed.bozo and not parsed.entries:
            raise Exception(
                f"Feed retornou erro: {getattr(parsed, 'bozo_exception', 'unknown')}"
            )

        # Verifica status HTTP se disponível
        status = getattr(parsed, 'status', 200)
        if status >= 400:
            raise Exception(f"HTTP {status} ao acessar feed")

        entries = []
        for entry in parsed.entries:
            parsed_entry = self._parse_entry(entry, name)
            if parsed_entry:
                # Filtrar entradas antigas (>3h) para evitar flood na primeira execução
                if self._is_recent(entry, hours=3, minutes=0):
                    entries.append(parsed_entry)

        return entries

    @staticmethod
    def _is_recent(entry, hours: int = 0, minutes: int = 10) -> bool:
        """Verifica se a entrada foi publicada nos últimos N minutos."""
        import time as _time
        from calendar import timegm

        published_parsed = getattr(entry, 'published_parsed', None) or getattr(entry, 'updated_parsed', None)
        if not published_parsed:
            # Sem data → assume recente (fail-open)
            return True

        try:
            entry_timestamp = timegm(published_parsed)
            cutoff = _time.time() - (hours * 3600) - (minutes * 60)
            return entry_timestamp >= cutoff
        except (TypeError, ValueError):
            return True

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
