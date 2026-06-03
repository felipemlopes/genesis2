"""
AI Classifier — Gênesis Labs Radar News
Classifica notícias via Gemini 2.5 Flash API (severity, assets, bias, impacto).
"""

import hashlib
import json
import logging
import os
import re

import pymysql
import requests

logger = logging.getLogger('radar-news')

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = 'gemini-2.5-flash'
GEMINI_URL = (
    f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent'
)
GEMINI_TIMEOUT = 30  # seconds
RETRY_DELAY = 5      # seconds

CLASSIFICATION_PROMPT = """You are a crypto/financial news analyst. Classify each news entry below.

For EACH entry, return a JSON object with:
- "severity": one of "CRITICAL", "HIGH", "MEDIUM", "LOW"
- "affected_assets": array of crypto ticker symbols affected (e.g. ["BTC", "ETH"])
- "market_bias": one of "BULLISH", "BEARISH", "NEUTRAL"
- "impact_summary": concise 1-2 sentence summary of market impact (in Portuguese)
- "category": short category label (e.g. "regulation", "hack", "macro", "defi", "exchange")

Severity guide:
- CRITICAL: Exchange hacks, major regulatory bans, black swan events, protocol exploits > $100M
- HIGH: Central bank decisions, major protocol upgrades, whale movements > $500M, ETF decisions
- MEDIUM: Partnership announcements, mid-tier protocol updates, market analysis
- LOW: Minor project updates, opinion pieces, routine market summaries

Return a JSON array with one object per entry, in the same order as input.
If you cannot classify an entry, use severity "LOW", bias "NEUTRAL", empty assets, and note in impact_summary.

NEWS ENTRIES:
{entries_text}

Respond ONLY with the JSON array. No markdown, no explanation."""


DISCOVERY_SCORING_PROMPT = """You are a crypto trading analyst evaluating newly discovered tokens for trading relevance.

For EACH token below, assign a discovery_score from 1 to 10 based on:
- Volume strength (24h volume relative to market cap)
- Exchange availability (more major exchanges = higher score)
- Context quality (concrete catalysts vs speculation)
- Trend momentum (multiple sources confirming relevance)

Scoring guide:
- 9-10: Exceptional opportunity — massive volume spike, listed on 3+ major exchanges, strong concrete catalyst
- 7-8: Strong opportunity — significant volume, 2+ major exchanges, clear catalyst
- 5-6: Moderate interest — decent volume, at least 1 major exchange, some catalyst
- 3-4: Weak signal — borderline volume/exchange requirements, speculative context
- 1-2: Noise — minimal evidence of real momentum

Return a JSON array with one object per token, each containing:
- "symbol": the token ticker
- "discovery_score": integer 1-10

TOKENS:
{entries_text}

Respond ONLY with the JSON array. No markdown, no explanation."""


class AIClassifier:
    """Classifica notícias de RSS usando Gemini 2.5 Flash API."""

    def __init__(self, api_key: str | None = None):
        """
        Args:
            api_key: Gemini API key. Se None, usa GEMINI_API_KEY do ambiente.
        """
        self.api_key = api_key or os.getenv('GEMINI_API_KEY', '')

    def classify(self, entries: list[dict]) -> list[dict]:
        """Classifica uma lista de entradas de notícias via Gemini 2.5 Flash.

        Args:
            entries: Lista de dicts com pelo menos 'title', 'source', 'summary'.

        Returns:
            Lista de dicts originais enriquecidos com campos de classificação:
            severity, affected_assets, market_bias, impact_summary, category.
            Entradas que falharem na classificação são omitidas.
        """
        if not entries:
            return []

        if not self.api_key:
            logger.error("[AI] GEMINI_API_KEY não configurada. Pulando classificação.")
            return []

        # Monta texto das entradas para o prompt
        entries_text = self._format_entries_for_prompt(entries)
        prompt = CLASSIFICATION_PROMPT.format(entries_text=entries_text)

        # Chama Gemini API (com retry)
        raw_response = self._call_gemini(prompt)
        if raw_response is None:
            logger.error("[AI] Falha ao obter resposta do Gemini. Nenhuma entrada classificada.")
            return []

        # Parseia resposta JSON
        classifications = self._parse_response(raw_response)
        if classifications is None:
            logger.error("[AI] Falha ao parsear resposta do Gemini.")
            return []

        # Enriquece entradas originais com classificação
        classified = self._merge_classifications(entries, classifications)
        logger.info(f"[AI] {len(classified)}/{len(entries)} entrada(s) classificada(s) com sucesso.")
        return classified

    def score_discoveries(self, entries: list[dict]) -> list[dict]:
        """Atribui discovery_score (1-10) a tokens via Gemini 2.5 Flash.

        Usa um prompt especializado para scoring de tokens emergentes,
        considerando volume, exchanges, contexto e momentum.

        Args:
            entries: Lista de dicts com keys: symbol, volume_24h, exchanges, context.

        Returns:
            Lista de dicts originais enriquecidos com 'discovery_score'.
            Em caso de falha, atribui score padrão de 5.
        """
        if not entries:
            return []

        if not self.api_key:
            logger.error("[AI] GEMINI_API_KEY não configurada. Usando score padrão.")
            for e in entries:
                e['discovery_score'] = 5
            return entries

        # Formata entradas para o prompt de scoring
        lines = []
        for i, entry in enumerate(entries, 1):
            symbol = entry.get('symbol', '???')
            volume = entry.get('volume_24h', 0)
            exchanges = ', '.join(entry.get('exchanges', []))
            context = entry.get('context', '')[:300]
            lines.append(
                f"[{i}] Symbol: {symbol}\n"
                f"    Volume 24h: ${volume:,.0f}\n"
                f"    Exchanges: {exchanges}\n"
                f"    Context: {context}"
            )
        entries_text = "\n\n".join(lines)
        prompt = DISCOVERY_SCORING_PROMPT.format(entries_text=entries_text)

        # Chama Gemini API
        raw_response = self._call_gemini(prompt)
        if raw_response is None:
            logger.error("[AI] Falha no scoring via Gemini. Usando score padrão.")
            for e in entries:
                e['discovery_score'] = 5
            return entries

        # Parseia resposta
        scores = self._parse_response(raw_response)
        if scores is None:
            logger.error("[AI] Falha ao parsear scores do Gemini. Usando score padrão.")
            for e in entries:
                e['discovery_score'] = 5
            return entries

        # Mapeia scores por symbol
        score_map = {}
        for item in scores:
            sym = item.get('symbol', '').upper()
            sc = item.get('discovery_score', 5)
            # Clamp entre 1-10
            sc = max(1, min(10, int(sc)))
            score_map[sym] = sc

        for e in entries:
            e['discovery_score'] = score_map.get(e.get('symbol', '').upper(), 5)

        scored_count = sum(1 for e in entries if e['symbol'].upper() in score_map)
        logger.info(f"[AI] Discovery scoring: {scored_count}/{len(entries)} token(s) scored via Gemini.")
        return entries

    def persist_classified(self, entry: dict, connection) -> bool:
        """Persiste uma entrada classificada na tabela genesis_radar_news.

        Gera o title_hash (SHA-256 do título em lowercase) e insere no banco.
        Ignora duplicatas (UNIQUE constraint em title_hash + source).

        Args:
            entry: Dict com campos: title, source, source_url, severity,
                   category, affected_assets, market_bias, impact_summary,
                   discovery_score (opcional), is_discovery (opcional).
            connection: Conexão pymysql ativa.

        Returns:
            True se inserido com sucesso, False se duplicata ou erro.
        """
        title = entry.get('title', '')
        title_hash = hashlib.sha256(title.lower().encode('utf-8')).hexdigest()

        affected_assets = entry.get('affected_assets', [])
        if isinstance(affected_assets, list):
            affected_assets_json = json.dumps(affected_assets)
        else:
            affected_assets_json = json.dumps([])

        sql = """
            INSERT INTO genesis_radar_news
                (title, title_hash, source, source_url, severity, category,
                 affected_assets, market_bias, impact_summary, discovery_score,
                 is_discovery, telegram_sent)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        params = (
            title,
            title_hash,
            entry.get('source', ''),
            entry.get('source_url', None),
            entry.get('severity', 'MEDIUM'),
            entry.get('category', None),
            affected_assets_json,
            entry.get('market_bias', 'NEUTRAL'),
            entry.get('impact_summary', None),
            entry.get('discovery_score', None),
            1 if entry.get('is_discovery', False) else 0,
            0,
        )

        try:
            with connection.cursor() as cursor:
                cursor.execute(sql, params)
            connection.commit()
            logger.info(f"[AI] Persistida: \"{title[:60]}...\" ({entry.get('severity')})")
            return True
        except pymysql.err.IntegrityError:
            # Duplicata — UNIQUE constraint em (title_hash, source)
            connection.rollback()
            logger.debug(f"[AI] Duplicata ignorada: \"{title[:60]}...\"")
            return False
        except Exception as e:
            connection.rollback()
            logger.error(f"[AI] Erro ao persistir entrada: {e}")
            return False

    def _format_entries_for_prompt(self, entries: list[dict]) -> str:
        """Formata entradas para inclusão no prompt."""
        lines = []
        for i, entry in enumerate(entries, 1):
            title = entry.get('title', '')
            source = entry.get('source', '')
            summary = entry.get('summary', '')[:500]
            lines.append(f"[{i}] Title: {title}\n    Source: {source}\n    Summary: {summary}")
        return "\n\n".join(lines)

    def _call_gemini(self, prompt: str) -> str | None:
        """Chama Gemini API com retry (1 tentativa extra após 5s).

        Returns:
            Texto da resposta ou None em caso de falha.
        """
        import time

        for attempt in range(2):
            try:
                response = requests.post(
                    GEMINI_URL,
                    params={'key': self.api_key},
                    headers={'Content-Type': 'application/json'},
                    json={
                        'contents': [{'parts': [{'text': prompt}]}],
                        'generationConfig': {
                            'temperature': 0.2,
                            'maxOutputTokens': 4096,
                        },
                    },
                    timeout=GEMINI_TIMEOUT,
                )

                if response.status_code == 200:
                    data = response.json()
                    text = (
                        data.get('candidates', [{}])[0]
                        .get('content', {})
                        .get('parts', [{}])[0]
                        .get('text', '')
                    )
                    if text:
                        return text
                    logger.warning("[AI] Resposta do Gemini sem texto.")
                else:
                    logger.warning(
                        f"[AI] Gemini retornou HTTP {response.status_code}: "
                        f"{response.text[:200]}"
                    )

            except requests.exceptions.Timeout:
                logger.warning(f"[AI] Timeout ({GEMINI_TIMEOUT}s) na tentativa {attempt + 1}.")
            except Exception as e:
                logger.warning(f"[AI] Erro na tentativa {attempt + 1}: {e}")

            # Retry após delay (apenas na primeira tentativa)
            if attempt == 0:
                logger.info(f"[AI] Retentando em {RETRY_DELAY}s...")
                time.sleep(RETRY_DELAY)

        return None

    def _parse_response(self, raw_text: str) -> list[dict] | None:
        """Parseia resposta JSON do Gemini, tratando markdown code fences.

        Handles common Gemini response patterns:
        - Clean JSON array
        - ```json\\n[...]\\n```
        - ```\\n[...]\\n```
        - Text before/after fenced block

        Args:
            raw_text: Texto bruto retornado pela API.

        Returns:
            Lista de dicts de classificação ou None se inválido.
        """
        cleaned = raw_text.strip()

        # Try to extract JSON from within markdown code fences first
        fence_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', cleaned, re.DOTALL)
        if fence_match:
            cleaned = fence_match.group(1).strip()
        else:
            # Fallback: remove leading/trailing fences if present (no inner match)
            cleaned = re.sub(r'^```(?:json)?\s*\n?', '', cleaned)
            cleaned = re.sub(r'\n?\s*```$', '', cleaned)
        cleaned = cleaned.strip()

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"[AI] JSON inválido na resposta: {e}")
            logger.debug(f"[AI] Resposta bruta: {raw_text[:500]}")
            return None

        if not isinstance(parsed, list):
            logger.error("[AI] Resposta não é uma lista JSON.")
            return None

        return parsed

    def _merge_classifications(
        self, entries: list[dict], classifications: list[dict]
    ) -> list[dict]:
        """Mescla classificações do Gemini com as entradas originais.

        Se a quantidade de classificações diferir das entradas, associa
        por índice até o mínimo dos dois.
        """
        classified = []
        count = min(len(entries), len(classifications))

        if len(classifications) != len(entries):
            logger.warning(
                f"[AI] Gemini retornou {len(classifications)} classificações "
                f"para {len(entries)} entradas. Mesclando até índice {count}."
            )

        for i in range(count):
            entry = entries[i].copy()
            cls = classifications[i]

            # Valida e atribui campos obrigatórios
            severity = cls.get('severity', 'LOW')
            if severity not in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'):
                severity = 'LOW'

            market_bias = cls.get('market_bias', 'NEUTRAL')
            if market_bias not in ('BULLISH', 'BEARISH', 'NEUTRAL'):
                market_bias = 'NEUTRAL'

            affected_assets = cls.get('affected_assets', [])
            if not isinstance(affected_assets, list):
                affected_assets = []

            impact_summary = cls.get('impact_summary', '')
            if not isinstance(impact_summary, str):
                impact_summary = ''

            category = cls.get('category', '')
            if not isinstance(category, str):
                category = ''

            entry['severity'] = severity
            entry['market_bias'] = market_bias
            entry['affected_assets'] = affected_assets
            entry['impact_summary'] = impact_summary
            entry['category'] = category

            classified.append(entry)

        return classified
