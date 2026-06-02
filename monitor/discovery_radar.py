"""
Discovery Radar — Gênesis Labs Radar News
Monitora tokens fora da watchlist principal (70 tokens) que estão ganhando
relevância de mercado via CoinGecko trending e CMC top gainers.
Ciclo: a cada 20 minutos.
"""

import hashlib
import logging
import time
from datetime import datetime, timedelta

import pymysql
import requests

logger = logging.getLogger('radar-news')

# ─── Configurações ────────────────────────────────────────────────────────────

COINGECKO_TRENDING_URL = 'https://api.coingecko.com/api/v3/search/trending'
CMC_GAINERS_URL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/trending/gainers'

MIN_VOLUME_24H = 5_000_000  # USD
VALID_EXCHANGES = {'binance', 'bybit', 'okx', 'coinbase'}
SUPPRESSION_WINDOW_HOURS = 6
MULTI_SOURCE_WINDOW_HOURS = 2
MIN_SOURCES_REQUIRED = 2

# Score routing thresholds
SCORE_TELEGRAM_THRESHOLD = 7   # >= 7 → Telegram
SCORE_POLL_MIN = 5             # 5-6 → poll only
SCORE_LOG_MAX = 4              # < 5 → log only

# Monitored tokens list (main 70-token watchlist) — tokens aqui são EXCLUÍDOS
# do Discovery Radar. Manter sincronizado com a lista principal da plataforma.
MONITORED_TOKENS = {
    'BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'SOL', 'DOGE', 'DOT', 'MATIC', 'SHIB',
    'TRX', 'AVAX', 'LINK', 'UNI', 'ATOM', 'LTC', 'ETC', 'XLM', 'NEAR', 'BCH',
    'APT', 'FIL', 'ALGO', 'VET', 'ICP', 'HBAR', 'QNT', 'AAVE', 'FTM', 'EOS',
    'SAND', 'MANA', 'THETA', 'AXS', 'XTZ', 'EGLD', 'FLOW', 'CHZ', 'KCS', 'CAKE',
    'NEO', 'KLAY', 'ZIL', 'ENJ', 'BAT', 'DASH', 'ZEC', 'WAVES', 'COMP', 'MKR',
    'SNX', 'CRV', 'LDO', 'RPL', 'IMX', 'GRT', 'FXS', 'GMX', 'STX', 'AR',
    'OP', 'ARB', 'SUI', 'SEI', 'TIA', 'INJ', 'RUNE', 'PEPE', 'WIF', 'BONK',
}

REQUEST_TIMEOUT = 15  # seconds


class DiscoveryRadar:
    """Módulo Discovery Radar — identifica tokens emergentes fora da watchlist."""

    def __init__(self, ai_classifier=None, telegram_dispatcher=None, cmc_api_key: str = ''):
        """
        Args:
            ai_classifier: instância de AIClassifier para scoring via Gemini
            telegram_dispatcher: instância de TelegramDispatcher para alertas
            cmc_api_key: chave da API CoinMarketCap (opcional para CMC gainers)
        """
        self.ai_classifier = ai_classifier
        self.telegram_dispatcher = telegram_dispatcher
        self.cmc_api_key = cmc_api_key

    def run_discovery_cycle(self, connection) -> list[dict]:
        """Executa um ciclo completo do Discovery Radar.

        1. Busca trending (CoinGecko) e top gainers (CMC)
        2. Filtra: volume > $5M, listado em exchanges válidas, NÃO monitorado
        3. Verifica confirmação multi-source (>= 2 fontes em 2h)
        4. Envia para scoring via Gemini (discovery_score 1-10)
        5. Roteia notificações por score
        6. Aplica janela de supressão de 6h por token

        Args:
            connection: conexão pymysql ativa

        Returns:
            Lista de dicts com tokens descobertos e processados neste ciclo.
        """
        logger.info('[Discovery] Iniciando ciclo de descoberta...')
        processed = []

        try:
            # 1. Fetch de candidatos de múltiplas fontes
            candidates = self._fetch_candidates()
            if not candidates:
                logger.info('[Discovery] Nenhum candidato encontrado.')
                return processed

            logger.info(f'[Discovery] {len(candidates)} candidato(s) bruto(s) coletado(s).')

            # 2. Filtro: volume, exchanges, não-monitorado
            filtered = self._apply_filters(candidates)
            if not filtered:
                logger.info('[Discovery] Nenhum candidato passou nos filtros.')
                return processed

            logger.info(f'[Discovery] {len(filtered)} candidato(s) após filtros.')

            # 3. Confirmação multi-source (>= 2 fontes em 2h)
            confirmed = self._check_multi_source(filtered)
            if not confirmed:
                logger.info('[Discovery] Nenhum candidato com confirmação multi-source.')
                return processed

            logger.info(f'[Discovery] {len(confirmed)} candidato(s) com confirmação multi-source.')

            # 4. Janela de supressão — remove tokens já alertados nas últimas 6h
            unsuppressed = self._filter_suppressed(confirmed, connection)
            if not unsuppressed:
                logger.info('[Discovery] Todos candidatos suprimidos (alerta recente).')
                return processed

            logger.info(f'[Discovery] {len(unsuppressed)} candidato(s) após supressão.')

            # 5. Scoring via Gemini
            scored = self._score_candidates(unsuppressed)

            # 6. Roteamento por score e persistência
            for entry in scored:
                score = entry.get('discovery_score', 0)
                symbol = entry.get('symbol', '???')

                # Persistir no banco
                self._persist_discovery(entry, connection)

                if score >= SCORE_TELEGRAM_THRESHOLD:
                    # Score >= 7 → Telegram imediato
                    logger.info(f'[Discovery] {symbol} score={score} → Telegram')
                    if self.telegram_dispatcher:
                        self.telegram_dispatcher.send_discovery_alert(entry)
                elif score >= SCORE_POLL_MIN:
                    # Score 5-6 → disponível via poll (já persistido)
                    logger.info(f'[Discovery] {symbol} score={score} → poll only')
                else:
                    # Score < 5 → log only
                    logger.info(f'[Discovery] {symbol} score={score} → log only (ignorado)')

                processed.append(entry)

        except Exception as e:
            logger.error(f'[Discovery] Erro no ciclo: {e}')

        logger.info(f'[Discovery] Ciclo concluído. {len(processed)} token(s) processado(s).')
        return processed

    # ─── Fetch de candidatos ──────────────────────────────────────────────────

    def _fetch_candidates(self) -> list[dict]:
        """Busca candidatos do CoinGecko trending e CMC top gainers.

        Returns:
            Lista de candidatos com campos: symbol, name, volume_24h,
            exchanges, source, fetched_at
        """
        candidates = []

        # CoinGecko trending
        cg_candidates = self._fetch_coingecko_trending()
        candidates.extend(cg_candidates)

        # CMC top gainers
        cmc_candidates = self._fetch_cmc_gainers()
        candidates.extend(cmc_candidates)

        # Enriquecer com dados de exchanges (para candidatos sem esse dado)
        candidates = self._enrich_exchanges(candidates)

        return candidates

    def _fetch_coingecko_trending(self) -> list[dict]:
        """Busca tokens trending via CoinGecko API."""
        try:
            resp = requests.get(COINGECKO_TRENDING_URL, timeout=REQUEST_TIMEOUT)
            if resp.status_code != 200:
                logger.warning(f'[Discovery] CoinGecko API retornou status {resp.status_code}')
                return []

            data = resp.json()
            coins = data.get('coins', [])
            results = []

            for item in coins:
                coin = item.get('item', {})
                symbol = coin.get('symbol', '').upper()
                name = coin.get('name', '')
                # CoinGecko trending pode não ter volume diretamente;
                # será enriquecido no filtro ou via dados adicionais
                market_data = coin.get('data', {})
                volume_24h = market_data.get('total_volume', 0) if market_data else 0

                results.append({
                    'symbol': symbol,
                    'name': name,
                    'coingecko_id': coin.get('id', ''),
                    'volume_24h': volume_24h,
                    'exchanges': [],  # será enriquecido via _enrich_exchanges
                    'source': 'coingecko',
                    'fetched_at': datetime.utcnow(),
                    'context': f'Trending on CoinGecko — {name} ({symbol})',
                    'source_url': f'https://www.coingecko.com/en/coins/{coin.get("id", "")}',
                })

            logger.info(f'[Discovery] CoinGecko: {len(results)} token(s) trending.')
            return results

        except requests.RequestException as e:
            logger.error(f'[Discovery] Erro ao buscar CoinGecko trending: {e}')
            return []

    def _fetch_cmc_gainers(self) -> list[dict]:
        """Busca top gainers via CoinMarketCap API."""
        if not self.cmc_api_key:
            logger.debug('[Discovery] CMC API key não configurada, pulando CMC.')
            return []

        try:
            headers = {'X-CMC_PRO_API_KEY': self.cmc_api_key}
            resp = requests.get(
                CMC_GAINERS_URL,
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )

            if resp.status_code != 200:
                logger.warning(f'[Discovery] CMC API retornou status {resp.status_code}')
                return []

            data = resp.json()
            gainers = data.get('data', [])
            results = []

            for coin in gainers:
                symbol = coin.get('symbol', '').upper()
                name = coin.get('name', '')
                quote = coin.get('quote', {}).get('USD', {})
                volume_24h = quote.get('volume_24h', 0)

                results.append({
                    'symbol': symbol,
                    'name': name,
                    'coingecko_id': '',
                    'volume_24h': volume_24h,
                    'exchanges': [],  # será enriquecido via _enrich_exchanges
                    'source': 'coinmarketcap',
                    'fetched_at': datetime.utcnow(),
                    'context': f'Top gainer on CMC — {name} ({symbol})',
                    'source_url': f'https://coinmarketcap.com/currencies/{name.lower().replace(" ", "-")}/',
                })

            logger.info(f'[Discovery] CMC: {len(results)} gainer(s).')
            return results

        except requests.RequestException as e:
            logger.error(f'[Discovery] Erro ao buscar CMC gainers: {e}')
            return []

    # ─── Enriquecimento de exchanges ──────────────────────────────────────────

    def _enrich_exchanges(self, candidates: list[dict]) -> list[dict]:
        """Enriquece candidatos com dados de exchanges via CoinGecko tickers.

        Para cada candidato que ainda não possui exchanges populadas,
        consulta a API de tickers do CoinGecko para identificar em quais
        exchanges o token está listado.

        Args:
            candidates: lista de candidatos (podem ter exchanges vazio).

        Returns:
            A mesma lista com o campo 'exchanges' preenchido.
        """
        for c in candidates:
            if c.get('exchanges'):
                continue

            symbol = c.get('symbol', '').upper()
            coin_id = c.get('coingecko_id', '')

            if not coin_id:
                # Tentar derivar ID do nome (fallback simples)
                coin_id = c.get('name', '').lower().replace(' ', '-')

            if not coin_id:
                continue

            try:
                url = f'https://api.coingecko.com/api/v3/coins/{coin_id}/tickers'
                resp = requests.get(url, params={'depth': 'true'}, timeout=REQUEST_TIMEOUT)

                if resp.status_code == 429:
                    # Rate limit — parar enriquecimento, seguir com o que temos
                    logger.warning('[Discovery] CoinGecko rate limit atingido no enriquecimento.')
                    break

                if resp.status_code != 200:
                    logger.debug(f'[Discovery] Tickers para {symbol}: status {resp.status_code}')
                    continue

                data = resp.json()
                tickers = data.get('tickers', [])
                exchanges_found = set()

                for ticker in tickers:
                    market = ticker.get('market', {})
                    exchange_id = market.get('identifier', '').lower()
                    # Mapear identificadores conhecidos para nomes padronizados
                    if 'binance' in exchange_id:
                        exchanges_found.add('binance')
                    elif 'bybit' in exchange_id:
                        exchanges_found.add('bybit')
                    elif 'okx' in exchange_id or 'okex' in exchange_id:
                        exchanges_found.add('okx')
                    elif 'coinbase' in exchange_id or 'gdax' in exchange_id:
                        exchanges_found.add('coinbase')

                c['exchanges'] = list(exchanges_found)
                logger.debug(f'[Discovery] {symbol} exchanges: {exchanges_found}')

                # Pequena pausa para evitar rate limit
                time.sleep(0.5)

            except requests.RequestException as e:
                logger.debug(f'[Discovery] Erro ao buscar tickers de {symbol}: {e}')
                continue

        return candidates

    # ─── Filtros ──────────────────────────────────────────────────────────────

    def _apply_filters(self, candidates: list[dict]) -> list[dict]:
        """Aplica filtros de volume, exchange e watchlist.

        Critérios:
          - volume_24h > $5M
          - listado em pelo menos uma exchange válida (Binance/Bybit/OKX/Coinbase)
          - NÃO está na MONITORED_TOKENS (70 tokens)

        Returns:
            Lista de candidatos que passaram em todos os filtros.
        """
        filtered = []

        for c in candidates:
            symbol = c.get('symbol', '').upper()

            # 1. Excluir tokens monitorados (watchlist principal de 70 tokens)
            if symbol in MONITORED_TOKENS:
                logger.debug(f'[Discovery][Filter] {symbol} excluído — monitorado.')
                continue

            # 2. Volume mínimo > $5M USD
            volume = c.get('volume_24h', 0)
            if not isinstance(volume, (int, float)) or volume <= MIN_VOLUME_24H:
                logger.debug(
                    f'[Discovery][Filter] {symbol} excluído — volume '
                    f'${volume:,.0f} <= ${MIN_VOLUME_24H:,.0f}.'
                )
                continue

            # 3. Deve estar listado em pelo menos uma exchange válida
            exchanges = {ex.lower() for ex in c.get('exchanges', [])}
            if not exchanges.intersection(VALID_EXCHANGES):
                logger.debug(
                    f'[Discovery][Filter] {symbol} excluído — '
                    f'não listado em exchanges válidas. Exchanges: {exchanges or "nenhuma"}.'
                )
                continue

            filtered.append(c)

        return filtered

    def _check_multi_source(self, candidates: list[dict]) -> list[dict]:
        """Verifica confirmação multi-source: token deve ter >= 2 fontes em 2h.

        Agrupa candidatos por symbol e verifica se há >= MIN_SOURCES_REQUIRED
        fontes distintas com fetched_at dentro de MULTI_SOURCE_WINDOW_HOURS.
        """
        from collections import defaultdict

        symbol_sources = defaultdict(list)
        for c in candidates:
            symbol_sources[c['symbol']].append(c)

        confirmed = []
        window = timedelta(hours=MULTI_SOURCE_WINDOW_HOURS)

        for symbol, entries in symbol_sources.items():
            # Fontes únicas dentro da janela
            sources_in_window = set()
            reference_time = datetime.utcnow()

            for entry in entries:
                fetched = entry.get('fetched_at', reference_time)
                if reference_time - fetched <= window:
                    sources_in_window.add(entry.get('source', ''))

            if len(sources_in_window) >= MIN_SOURCES_REQUIRED:
                # Usar a entrada mais recente como representante
                best = max(entries, key=lambda e: e.get('fetched_at', datetime.min))
                best['sources_confirmed'] = list(sources_in_window)
                confirmed.append(best)

        return confirmed

    # ─── Supressão ────────────────────────────────────────────────────────────

    def _filter_suppressed(self, candidates: list[dict], connection) -> list[dict]:
        """Remove tokens que já tiveram alerta nas últimas 6 horas.

        Consulta genesis_radar_news onde is_discovery=1 e created_at >= now - 6h.
        """
        if not candidates:
            return []

        try:
            symbols = [c['symbol'] for c in candidates]
            placeholders = ', '.join(['%s'] * len(symbols))
            cutoff = datetime.utcnow() - timedelta(hours=SUPPRESSION_WINDOW_HOURS)

            with connection.cursor() as cursor:
                sql = f"""
                    SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(affected_assets, '$[0]')) AS symbol
                    FROM genesis_radar_news
                    WHERE is_discovery = 1
                      AND created_at >= %s
                      AND JSON_UNQUOTE(JSON_EXTRACT(affected_assets, '$[0]')) IN ({placeholders})
                """
                cursor.execute(sql, [cutoff] + symbols)
                suppressed_symbols = {row['symbol'] for row in cursor.fetchall()}

            unsuppressed = [c for c in candidates if c['symbol'] not in suppressed_symbols]
            if suppressed_symbols:
                logger.info(f'[Discovery] Suprimidos (alerta recente): {suppressed_symbols}')

            return unsuppressed

        except Exception as e:
            logger.error(f'[Discovery] Erro ao verificar supressão: {e}')
            # Em caso de erro, seguir sem supressão
            return candidates

    # ─── Scoring via Gemini ───────────────────────────────────────────────────

    def _score_candidates(self, candidates: list[dict]) -> list[dict]:
        """Atribui discovery_score (1-10) a cada candidato via AI Classifier.

        Usa o método score_discoveries() que envia um prompt dedicado ao Gemini
        para avaliar relevância de trading de tokens emergentes.

        Se AI Classifier não disponível, atribui score padrão de 5.
        """
        if not self.ai_classifier or not candidates:
            for c in candidates:
                c['discovery_score'] = 5
            return candidates

        try:
            scored = self.ai_classifier.score_discoveries(candidates)
            return scored
        except Exception as e:
            logger.error(f'[Discovery] Erro ao scoring via Gemini: {e}')
            for c in candidates:
                c['discovery_score'] = 5

        return candidates

    # ─── Persistência ─────────────────────────────────────────────────────────

    def _persist_discovery(self, entry: dict, connection) -> bool:
        """Persiste entrada de discovery no genesis_radar_news.

        Args:
            entry: dict com dados do token descoberto
            connection: conexão pymysql

        Returns:
            True se persistido com sucesso.
        """
        try:
            import json

            symbol = entry.get('symbol', '')
            title = f"Discovery: {symbol}"
            title_hash = hashlib.sha256(title.lower().encode('utf-8')).hexdigest()
            source = entry.get('source', 'discovery')

            with connection.cursor() as cursor:
                sql = """
                    INSERT INTO genesis_radar_news
                    (title, title_hash, source, source_url, severity, category,
                     affected_assets, market_bias, impact_summary, discovery_score,
                     is_discovery, telegram_sent)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE updated_at = NOW()
                """
                cursor.execute(sql, (
                    title,
                    title_hash,
                    source,
                    entry.get('source_url', ''),
                    'MEDIUM',  # discovery entries don't use news severity
                    'discovery',
                    json.dumps([symbol]),
                    'NEUTRAL',
                    entry.get('context', ''),
                    entry.get('discovery_score', 5),
                    1,  # is_discovery = True
                    1 if entry.get('discovery_score', 0) >= SCORE_TELEGRAM_THRESHOLD else 0,
                ))
            connection.commit()
            logger.info(f'[Discovery] Persistido: {symbol} (score={entry.get("discovery_score")})')
            return True

        except Exception as e:
            logger.error(f'[Discovery] Erro ao persistir {entry.get("symbol", "?")}: {e}')
            return False
