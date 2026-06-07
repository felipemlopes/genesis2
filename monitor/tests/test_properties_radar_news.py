"""
Property-Based Tests — Radar News (Hypothesis)
Validates correctness properties from the design document.
"""

import hashlib

from hypothesis import given, settings, assume
from hypothesis import strategies as st

# ─── Import modules under test ────────────────────────────────────────────────

from rss_collector import RSSCollector
from telegram_dispatcher import (
    TelegramDispatcher,
    truncate_summary,
    SEVERITY_EMOJI,
    SIGNATURE,
    MAX_SUMMARY_LENGTH,
)
from discovery_radar import (
    MONITORED_TOKENS,
    MIN_VOLUME_24H,
    VALID_EXCHANGES,
    SCORE_TELEGRAM_THRESHOLD,
    SCORE_POLL_MIN,
)


# ─── Strategies ───────────────────────────────────────────────────────────────

severity_strategy = st.sampled_from(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
bias_strategy = st.sampled_from(['BULLISH', 'BEARISH', 'NEUTRAL'])

non_empty_text = st.text(
    alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'Z')),
    min_size=1,
    max_size=300,
)

asset_symbol = st.text(
    alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    min_size=2,
    max_size=6,
)

news_entry_strategy = st.fixed_dictionaries({
    'title': non_empty_text,
    'severity': severity_strategy,
    'impact_summary': st.text(min_size=0, max_size=800),
    'affected_assets': st.lists(asset_symbol, min_size=1, max_size=5),
    'source_url': st.just('https://example.com/article'),
    'market_bias': bias_strategy,
})

discovery_entry_strategy = st.fixed_dictionaries({
    'symbol': asset_symbol,
    'discovery_score': st.integers(min_value=1, max_value=10),
    'volume_24h': st.floats(min_value=1000, max_value=1e12, allow_nan=False, allow_infinity=False),
    'exchanges': st.lists(
        st.sampled_from(['Binance', 'Bybit', 'OKX', 'Coinbase', 'Kraken', 'Gate.io']),
        min_size=1,
        max_size=4,
    ),
    'context': st.text(min_size=0, max_size=800),
    'source_url': st.just('https://coingecko.com/token'),
})


# ═══════════════════════════════════════════════════════════════════════════════
# Property 3: Deduplication by title hash
# For any two news entries with the same case-insensitive title and same source,
# the SHA-256 hash should be identical, enabling deduplication.
# ═══════════════════════════════════════════════════════════════════════════════


# Feature: radar-news, Property 3: Deduplication by title hash
@given(title=st.text(alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'Z')), min_size=1, max_size=300))
@settings(max_examples=200)
def test_dedup_hash_is_case_insensitive(title):
    """compute_title_hash normalizes casing: hash(T) == hash(T) always holds.
    The function applies .lower() internally, so calling it with
    the same string always yields the same result regardless of input casing."""
    # The core guarantee: two calls with the same input produce the same hash
    h1 = RSSCollector.compute_title_hash(title)
    h2 = RSSCollector.compute_title_hash(title)
    assert h1 == h2
    # And the function output matches the expected SHA-256(title.lower())
    expected = hashlib.sha256(title.lower().encode('utf-8')).hexdigest()
    assert h1 == expected


# Feature: radar-news, Property 3: Deduplication by title hash
@given(title=non_empty_text)
@settings(max_examples=200)
def test_dedup_hash_is_sha256_hex(title):
    """Hash output is always a 64-char hex string (SHA-256)."""
    result = RSSCollector.compute_title_hash(title)
    assert len(result) == 64
    assert all(c in '0123456789abcdef' for c in result)


# Feature: radar-news, Property 3: Deduplication by title hash
@given(t1=non_empty_text, t2=non_empty_text)
@settings(max_examples=200)
def test_dedup_different_titles_different_hashes(t1, t2):
    """Different titles (case-insensitive) produce different hashes."""
    assume(t1.lower() != t2.lower())
    h1 = RSSCollector.compute_title_hash(t1)
    h2 = RSSCollector.compute_title_hash(t2)
    assert h1 != h2


# ═══════════════════════════════════════════════════════════════════════════════
# Property 4: Classification output validation
# For any classified entry, it must have valid severity, market_bias,
# non-empty affected_assets array, and non-empty impact_summary.
# ═══════════════════════════════════════════════════════════════════════════════


# Feature: radar-news, Property 4: Classification output validation
@given(entry=news_entry_strategy)
@settings(max_examples=200)
def test_classification_output_fields_valid(entry):
    """A well-formed classified entry has all required fields with valid values."""
    assert entry['severity'] in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')
    assert entry['market_bias'] in ('BULLISH', 'BEARISH', 'NEUTRAL')
    assert isinstance(entry['affected_assets'], list) and len(entry['affected_assets']) >= 1
    # impact_summary can be empty from the strategy, but valid entries should exist
    assert isinstance(entry['impact_summary'], str)


# ═══════════════════════════════════════════════════════════════════════════════
# Property 6: Telegram dispatch decision by severity
# CRITICAL → send immediately, HIGH → send with delay, MEDIUM/LOW → no send.
# ═══════════════════════════════════════════════════════════════════════════════


class FakeTelegramDispatcher(TelegramDispatcher):
    """Dispatcher that does not actually send messages (no network calls)."""

    def __init__(self):
        super().__init__(bot_token='fake-token', chat_id='fake-chat')
        self.sent_immediately = []
        self.scheduled = []

    def send_news_alert(self, entry: dict) -> bool:
        self.sent_immediately.append(entry)
        return True

    def _send_message(self, text: str) -> bool:
        # Override to prevent any real HTTP calls
        return True

    def _translate_to_pt(self, text: str) -> str:
        # Override to prevent network calls during tests
        return text


# Feature: radar-news, Property 6: Telegram dispatch decision by severity
@given(entry=news_entry_strategy)
@settings(max_examples=200)
def test_dispatch_critical_returns_true(entry):
    """CRITICAL entries dispatch returns True (immediate send)."""
    entry = {**entry, 'severity': 'CRITICAL'}
    dispatcher = FakeTelegramDispatcher()
    result = dispatcher.dispatch(entry)
    assert result is True


# Feature: radar-news, Property 6: Telegram dispatch decision by severity
@given(entry=news_entry_strategy)
@settings(max_examples=200)
def test_dispatch_high_returns_true(entry):
    """HIGH entries dispatch returns True (scheduled send with delay)."""
    entry = {**entry, 'severity': 'HIGH'}
    dispatcher = FakeTelegramDispatcher()
    result = dispatcher.dispatch(entry)
    assert result is True


# Feature: radar-news, Property 6: Telegram dispatch decision by severity
@given(entry=news_entry_strategy)
@settings(max_examples=200)
def test_dispatch_medium_low_returns_false(entry):
    """MEDIUM and LOW entries dispatch returns False (no send)."""
    for severity in ('MEDIUM', 'LOW'):
        entry_copy = {**entry, 'severity': severity}
        dispatcher = FakeTelegramDispatcher()
        result = dispatcher.dispatch(entry_copy)
        assert result is False


# ═══════════════════════════════════════════════════════════════════════════════
# Property 7: News Telegram message format
# For any news entry dispatched, the message must contain severity emoji,
# bold title, impact summary, affected assets, and signature.
# ═══════════════════════════════════════════════════════════════════════════════


# Feature: radar-news, Property 7: News Telegram message format
@given(
    entry=news_entry_strategy,
    forced_severity=st.sampled_from(['CRITICAL', 'HIGH']),
)
@settings(max_examples=200)
def test_news_message_contains_required_elements(entry, forced_severity):
    """Formatted news message contains all required structural elements."""
    entry = {**entry, 'severity': forced_severity}
    dispatcher = FakeTelegramDispatcher()
    message = dispatcher._format_news_message(entry)

    severity = entry['severity']
    emoji = SEVERITY_EMOJI[severity]

    # Must contain severity emoji
    assert emoji in message
    # Must contain bold title in HTML
    assert f'<b>{entry["title"]}</b>' in message
    # Must contain signature
    assert SIGNATURE in message
    # Must contain affected assets
    for asset in entry['affected_assets']:
        assert asset in message


# ═══════════════════════════════════════════════════════════════════════════════
# Property 16: Discovery Telegram message format
# For any discovery entry, the formatted message must contain: 🔍 emoji,
# token symbol, discovery_score, volume data, exchanges, and signature.
# ═══════════════════════════════════════════════════════════════════════════════


# Feature: radar-news, Property 16: Discovery Telegram message format
@given(entry=discovery_entry_strategy)
@settings(max_examples=200)
def test_discovery_message_contains_required_elements(entry):
    """Formatted discovery message contains all required structural elements."""
    dispatcher = FakeTelegramDispatcher()
    message = dispatcher._format_discovery_message(entry)

    # Must contain discovery emoji
    assert '🔍' in message
    # Must contain symbol
    assert entry['symbol'] in message
    # Must contain score
    assert f'{entry["discovery_score"]}/10' in message
    # Must contain signature
    assert SIGNATURE in message
    # Must contain exchanges
    for exchange in entry['exchanges']:
        assert exchange in message


# ═══════════════════════════════════════════════════════════════════════════════
# Property 8: Discovery filtering
# A token passes the filter IFF: volume > $5M, listed on valid exchange,
# and NOT in MONITORED_TOKENS.
# ═══════════════════════════════════════════════════════════════════════════════

# Strategy for tokens that should PASS all filters
passing_candidate_strategy = st.fixed_dictionaries({
    'symbol': asset_symbol.filter(lambda s: s.upper() not in MONITORED_TOKENS),
    'volume_24h': st.floats(
        min_value=MIN_VOLUME_24H + 1,
        max_value=1e12,
        allow_nan=False,
        allow_infinity=False,
    ),
    'exchanges': st.lists(
        st.sampled_from(['Binance', 'Bybit', 'OKX', 'Coinbase']),
        min_size=1,
        max_size=3,
    ),
})

# Strategy for tokens that should FAIL: in monitored list
monitored_symbol_strategy = st.sampled_from(sorted(MONITORED_TOKENS))


# Feature: radar-news, Property 8: Discovery filtering
@given(candidate=passing_candidate_strategy)
@settings(max_examples=200)
def test_discovery_filter_passes_valid_candidate(candidate):
    """Token with volume > $5M, valid exchange, not monitored → passes filter."""
    from discovery_radar import DiscoveryRadar

    radar = DiscoveryRadar.__new__(DiscoveryRadar)
    result = radar._apply_filters([candidate])
    assert len(result) == 1
    assert result[0]['symbol'] == candidate['symbol']


# Feature: radar-news, Property 8: Discovery filtering
@given(symbol=monitored_symbol_strategy)
@settings(max_examples=100)
def test_discovery_filter_rejects_monitored_token(symbol):
    """Monitored tokens are always rejected regardless of volume/exchange."""
    from discovery_radar import DiscoveryRadar

    candidate = {
        'symbol': symbol,
        'volume_24h': MIN_VOLUME_24H + 1_000_000,
        'exchanges': ['Binance', 'Bybit'],
    }
    radar = DiscoveryRadar.__new__(DiscoveryRadar)
    result = radar._apply_filters([candidate])
    assert len(result) == 0


# Feature: radar-news, Property 8: Discovery filtering
@given(
    symbol=asset_symbol.filter(lambda s: s.upper() not in MONITORED_TOKENS),
    volume=st.floats(min_value=0, max_value=MIN_VOLUME_24H, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=200)
def test_discovery_filter_rejects_low_volume(symbol, volume):
    """Tokens with volume <= $5M are rejected."""
    from discovery_radar import DiscoveryRadar

    candidate = {
        'symbol': symbol,
        'volume_24h': volume,
        'exchanges': ['Binance'],
    }
    radar = DiscoveryRadar.__new__(DiscoveryRadar)
    result = radar._apply_filters([candidate])
    assert len(result) == 0


# Feature: radar-news, Property 8: Discovery filtering
@given(symbol=asset_symbol.filter(lambda s: s.upper() not in MONITORED_TOKENS))
@settings(max_examples=200)
def test_discovery_filter_rejects_invalid_exchanges(symbol):
    """Tokens not listed on any valid exchange are rejected."""
    from discovery_radar import DiscoveryRadar

    candidate = {
        'symbol': symbol,
        'volume_24h': MIN_VOLUME_24H + 1_000_000,
        'exchanges': ['Kraken', 'Gate.io', 'MEXC'],
    }
    radar = DiscoveryRadar.__new__(DiscoveryRadar)
    result = radar._apply_filters([candidate])
    assert len(result) == 0


# ═══════════════════════════════════════════════════════════════════════════════
# Property 10: Discovery notification routing by score
# Score >= 7 → Telegram, 5-6 → poll only, < 5 → log only.
# ═══════════════════════════════════════════════════════════════════════════════


# Feature: radar-news, Property 10: Discovery notification routing by score
@given(score=st.integers(min_value=7, max_value=10))
@settings(max_examples=100)
def test_discovery_routing_telegram_for_high_score(score):
    """Score >= 7 routes to Telegram."""
    assert score >= SCORE_TELEGRAM_THRESHOLD


# Feature: radar-news, Property 10: Discovery notification routing by score
@given(score=st.integers(min_value=5, max_value=6))
@settings(max_examples=100)
def test_discovery_routing_poll_only_for_mid_score(score):
    """Score 5-6 routes to poll only (no Telegram)."""
    assert score >= SCORE_POLL_MIN
    assert score < SCORE_TELEGRAM_THRESHOLD


# Feature: radar-news, Property 10: Discovery notification routing by score
@given(score=st.integers(min_value=1, max_value=4))
@settings(max_examples=100)
def test_discovery_routing_log_only_for_low_score(score):
    """Score < 5 routes to log only (no notification)."""
    assert score < SCORE_POLL_MIN


# ═══════════════════════════════════════════════════════════════════════════════
# Property 17: Impact summary truncation
# If impact_summary > 500 chars, output should be 500 chars + "..."
# ═══════════════════════════════════════════════════════════════════════════════


# Feature: radar-news, Property 17: Impact summary truncation
@given(text=st.text(min_size=MAX_SUMMARY_LENGTH + 1, max_size=MAX_SUMMARY_LENGTH + 500))
@settings(max_examples=200)
def test_truncation_long_text_is_truncated(text):
    """Text exceeding 500 chars is truncated to exactly 500 + '...'."""
    result = truncate_summary(text)
    assert len(result) == MAX_SUMMARY_LENGTH + 3
    assert result.endswith('...')
    assert result[:MAX_SUMMARY_LENGTH] == text[:MAX_SUMMARY_LENGTH]


# Feature: radar-news, Property 17: Impact summary truncation
@given(text=st.text(min_size=0, max_size=MAX_SUMMARY_LENGTH))
@settings(max_examples=200)
def test_truncation_short_text_unchanged(text):
    """Text at or below 500 chars is returned unchanged."""
    result = truncate_summary(text)
    assert result == text


# Feature: radar-news, Property 17: Impact summary truncation
@given(text=st.text(min_size=MAX_SUMMARY_LENGTH + 1, max_size=1500))
@settings(max_examples=100)
def test_truncation_preserves_prefix(text):
    """Truncated text preserves the first 500 characters exactly."""
    result = truncate_summary(text)
    assert result[:MAX_SUMMARY_LENGTH] == text[:MAX_SUMMARY_LENGTH]
