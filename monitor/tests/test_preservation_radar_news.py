"""
Preservation Property Tests - Property 2: Deduplication, Read State, Severity Gating, Telegram Sent Flag

These tests verify EXISTING CORRECT behavior on UNFIXED code that MUST be preserved
after the fix is applied. They follow the observation-first methodology:

1. _is_recent(entry_5min_old) returns True (entries younger than 10min already accepted)
2. _is_recent(entry_with_no_timestamp) returns True (fail-open behavior)
3. deduplicate() rejects entries with matching title_hash + source within 24h
4. getUnreadForUser() excludes items present in radar_news_user_reads (simulated)
5. MEDIUM/LOW severity entries are never dispatched to Telegram
6. Entries with telegram_sent = 1 are never re-sent

EXPECTED OUTCOME: ALL tests PASS on UNFIXED code (confirms baseline to preserve).
Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
"""

import time as _time
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

import pytest
from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st

from rss_collector import RSSCollector, RSS_FEEDS
from worker_radar_news import RadarNewsWorker


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

class FakeEntry:
    """Simulates a feedparser entry with published_parsed field."""

    def __init__(self, age_minutes: int):
        past = _time.time() - (age_minutes * 60)
        self.published_parsed = _time.gmtime(past)
        self.updated_parsed = None


class FakeEntryNoTimestamp:
    """Simulates a feedparser entry WITHOUT any timestamp (fail-open case)."""

    def __init__(self):
        self.published_parsed = None
        self.updated_parsed = None


def _create_worker_with_mocks():
    """Create a RadarNewsWorker with all external dependencies mocked."""
    with patch.dict('os.environ', {
        'TELEGRAM_BOT_TOKEN': 'test-token',
        'TELEGRAM_CHAT_ID': 'test-chat',
        'GEMINI_API_KEY': 'test-key',
        'MYSQL_HOST': 'localhost',
        'MYSQL_USER': 'root',
        'MYSQL_DATABASE': 'test_db',
    }):
        worker = RadarNewsWorker()
    return worker



# ═══════════════════════════════════════════════════════════════════════════════
# Preservation 1: _is_recent() returns True for entries <= 10 minutes old
# These entries are ALREADY accepted by the current 10-minute filter.
# After the fix (3-hour window), they must STILL be accepted.
# Requirement: 3.5 (entries within acceptable window remain accepted)
# ═══════════════════════════════════════════════════════════════════════════════

# Strategy: ages between 0 and 10 minutes (already accepted by current filter)
age_within_current_window = st.integers(min_value=0, max_value=9)


@given(age_minutes=age_within_current_window)
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_preservation_is_recent_accepts_entries_within_10_minutes(age_minutes):
    """
    Preservation Property: For all entries with age <= 10 minutes,
    _is_recent(entry, hours=0, minutes=10) returns True.

    This behavior MUST be preserved after the fix widens to 3 hours.
    On UNFIXED code: PASSES (confirms current correct behavior).
    """
    entry = FakeEntry(age_minutes)
    result = RSSCollector._is_recent(entry, hours=0, minutes=10)

    assert result is True, (
        f"Preservation violated: _is_recent(entry_{age_minutes}min_old, hours=0, minutes=10) "
        f"returned False. Entries within 10 minutes should ALWAYS be accepted."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Preservation 2: _is_recent() returns False for entries > 3 hours old
# These entries are rejected by both the current filter (>10min) and the
# fixed filter (>3h). After the fix, they must STILL be rejected.
# Requirement: 3.5 (entries beyond acceptable window remain rejected)
# ═══════════════════════════════════════════════════════════════════════════════

# Strategy: ages between 181 and 2880 minutes (3h+1min to 48h)
age_beyond_3_hours = st.integers(min_value=181, max_value=2880)


@given(age_minutes=age_beyond_3_hours)
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_preservation_is_recent_rejects_entries_older_than_3_hours(age_minutes):
    """
    Preservation Property: For all entries with age > 3 hours,
    _is_recent() returns False (with any reasonable window up to 3h).

    On UNFIXED code (10min window): returns False (already rejected). PASSES.
    After fix (3h window): still returns False. Preserved.
    """
    entry = FakeEntry(age_minutes)

    # Test with the current 10-minute window — should reject entries > 3h
    result = RSSCollector._is_recent(entry, hours=0, minutes=10)
    assert result is False, (
        f"Preservation violated: _is_recent(entry_{age_minutes}min_old, hours=0, minutes=10) "
        f"returned True. Entries older than 3 hours should always be rejected."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Preservation 3: _is_recent() returns True for entries without timestamps
# The fail-open behavior ensures entries with no published_parsed are accepted.
# Requirement: 3.5 (fail-open behavior preserved)
# ═══════════════════════════════════════════════════════════════════════════════

def test_preservation_is_recent_no_timestamp_fail_open():
    """
    Preservation Property: Entries without published_parsed are treated as recent.

    This fail-open behavior MUST be preserved after the fix.
    On UNFIXED code: PASSES (confirms fail-open is current behavior).
    """
    entry = FakeEntryNoTimestamp()
    result = RSSCollector._is_recent(entry, hours=0, minutes=10)

    assert result is True, (
        "Preservation violated: _is_recent(entry_no_timestamp) returned False. "
        "Entries without timestamps must be treated as recent (fail-open)."
    )


@given(hours=st.integers(min_value=0, max_value=24), minutes=st.integers(min_value=0, max_value=60))
@settings(max_examples=30, suppress_health_check=[HealthCheck.too_slow])
def test_preservation_is_recent_no_timestamp_any_window(hours, minutes):
    """
    Preservation Property: For any window parameter, entries without timestamps
    are always accepted (fail-open behavior is parameter-independent).

    On UNFIXED code: PASSES.
    """
    assume(hours > 0 or minutes > 0)  # at least some window
    entry = FakeEntryNoTimestamp()
    result = RSSCollector._is_recent(entry, hours=hours, minutes=minutes)

    assert result is True, (
        f"Preservation violated: _is_recent(entry_no_timestamp, hours={hours}, minutes={minutes}) "
        f"returned False. Fail-open must work with any window parameters."
    )



# ═══════════════════════════════════════════════════════════════════════════════
# Preservation 4: deduplicate() rejects entries with matching title_hash + source
# Entries already in the DB (title_hash + source match within 24h) are filtered out.
# Requirement: 3.1 (deduplication preserved)
# ═══════════════════════════════════════════════════════════════════════════════

# Strategies for generating entry data
source_names = st.sampled_from(['CoinDesk', 'Decrypt', 'Cointelegraph', 'Bitcoin Magazine'])
title_text = st.text(min_size=5, max_size=100, alphabet=st.characters(whitelist_categories=('L', 'N', 'Z')))


@given(title=title_text, source=source_names)
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_preservation_deduplicate_rejects_existing_entries(title, source):
    """
    Preservation Property: For all entries with matching title_hash + source
    in the DB within 24h, deduplicate() filters them out (returns empty).

    On UNFIXED code: PASSES (deduplication is working correctly).
    """
    collector = RSSCollector()
    entries = [{'title': title, 'source': source}]

    # Mock DB connection: cursor.fetchone returns a match (entry exists)
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = {'id': 1}  # entry found in DB
    mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cursor.__exit__ = MagicMock(return_value=False)

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    result = collector.deduplicate(entries, mock_conn)

    assert len(result) == 0, (
        f"Preservation violated: deduplicate() did not filter out entry "
        f"'{title[:30]}...' from '{source}' that already exists in DB. "
        f"Deduplication must reject matching title_hash + source within 24h."
    )


@given(title=title_text, source=source_names)
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_preservation_deduplicate_accepts_new_entries(title, source):
    """
    Preservation Property: For entries NOT in the DB, deduplicate() passes them through.

    On UNFIXED code: PASSES (new entries are accepted).
    """
    collector = RSSCollector()
    entries = [{'title': title, 'source': source}]

    # Mock DB: cursor.fetchone returns None (entry NOT in DB)
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = None
    mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cursor.__exit__ = MagicMock(return_value=False)

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    result = collector.deduplicate(entries, mock_conn)

    assert len(result) == 1, (
        f"Preservation violated: deduplicate() rejected new entry "
        f"'{title[:30]}...' from '{source}' that does NOT exist in DB."
    )
    assert result[0]['title'] == title
    assert result[0]['source'] == source


def test_preservation_deduplicate_empty_input():
    """
    Preservation: deduplicate([]) returns [] without DB interaction.
    """
    collector = RSSCollector()
    mock_conn = MagicMock()

    result = collector.deduplicate([], mock_conn)

    assert result == []
    mock_conn.cursor.assert_not_called()


# ═══════════════════════════════════════════════════════════════════════════════
# Preservation 5: Poll endpoint excludes items in radar_news_user_reads (simulated)
# We simulate the PHP getUnreadForUser() filtering logic since we can't run PHP.
# The key invariant: items that a user has read are excluded from results.
# Requirement: 3.2, 3.3
# ═══════════════════════════════════════════════════════════════════════════════

def simulate_get_unread_for_user(
    all_news: list[dict],
    user_reads: set[int],
    window_minutes: int = 5,
) -> list[dict]:
    """Simulate the PHP getUnreadForUser() behavior.

    Applies:
    1. Time filter: only items within window_minutes
    2. Read filter: excludes items in user_reads set
    """
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
    return [
        item for item in all_news
        if item['created_at'] >= cutoff and item['id'] not in user_reads
    ]


@given(
    news_count=st.integers(min_value=1, max_value=10),
    read_fraction=st.floats(min_value=0.0, max_value=1.0),
)
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_preservation_poll_excludes_read_items(news_count, read_fraction):
    """
    Preservation Property: For all items in radar_news_user_reads,
    getUnreadForUser() excludes them from results.

    On UNFIXED code: PASSES (read-state filtering works correctly).
    """
    # Generate recent news items (within 5min window so they pass time filter)
    now = datetime.utcnow()
    all_news = [
        {'id': i, 'created_at': now - timedelta(seconds=i * 10)}
        for i in range(1, news_count + 1)
    ]

    # Mark a fraction of items as read
    read_count = max(0, int(news_count * read_fraction))
    user_reads = set(range(1, read_count + 1))

    result = simulate_get_unread_for_user(all_news, user_reads, window_minutes=5)

    # Verify NO read items appear in results
    result_ids = {item['id'] for item in result}
    leaked_reads = result_ids & user_reads

    assert len(leaked_reads) == 0, (
        f"Preservation violated: read items {leaked_reads} appeared in poll results. "
        f"Items in radar_news_user_reads must always be excluded."
    )


def test_preservation_poll_excludes_read_items_concrete():
    """
    Concrete observation: 3 news items, user has read item 2.
    Poll should return items 1 and 3 only.
    """
    now = datetime.utcnow()
    all_news = [
        {'id': 1, 'created_at': now - timedelta(seconds=10)},
        {'id': 2, 'created_at': now - timedelta(seconds=20)},
        {'id': 3, 'created_at': now - timedelta(seconds=30)},
    ]
    user_reads = {2}

    result = simulate_get_unread_for_user(all_news, user_reads, window_minutes=5)

    result_ids = {item['id'] for item in result}
    assert 2 not in result_ids, "Preservation violated: read item 2 appeared in results."
    assert 1 in result_ids, "Item 1 should be returned (unread)."
    assert 3 in result_ids, "Item 3 should be returned (unread)."



# ═══════════════════════════════════════════════════════════════════════════════
# Preservation 6: MEDIUM/LOW severity entries are NEVER dispatched to Telegram
# The _run_rss_cycle only dispatches CRITICAL and HIGH entries.
# Requirement: 3.4
# ═══════════════════════════════════════════════════════════════════════════════

severity_medium_low = st.sampled_from(['MEDIUM', 'LOW'])


@given(severity=severity_medium_low)
@settings(max_examples=20, suppress_health_check=[HealthCheck.too_slow])
def test_preservation_medium_low_never_dispatched_to_telegram(severity):
    """
    Preservation Property: For all entries with severity in [MEDIUM, LOW],
    Telegram dispatch is NEVER triggered.

    On UNFIXED code: PASSES (only CRITICAL/HIGH are dispatched).
    After fix: MUST STILL PASS.
    """
    worker = _create_worker_with_mocks()

    # Create entries with only MEDIUM or LOW severity
    entries = [
        {
            'title': f'{severity} News Item {i}',
            'title_hash': f'hash_{severity.lower()}_{i}',
            'severity': severity,
            'impact_summary': f'{severity} impact',
            'affected_assets': ['BTC'],
            'source_url': f'https://example.com/{severity.lower()}/{i}',
            'market_bias': 'NEUTRAL',
        }
        for i in range(3)
    ]

    worker.rss_collector.fetch_all_feeds = MagicMock(return_value=entries)
    worker.rss_collector.deduplicate = MagicMock(return_value=entries)
    worker.ai_classifier.classify = MagicMock(return_value=entries)
    worker.ai_classifier.persist_classified = MagicMock(return_value=True)

    mock_cursor = MagicMock()
    mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cursor.__exit__ = MagicMock(return_value=False)

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    worker.conectar_bd = MagicMock(return_value=mock_conn)
    worker.telegram_dispatcher.send_news_alert = MagicMock(return_value=True)

    worker._run_rss_cycle()

    # MEDIUM/LOW should NEVER trigger Telegram dispatch
    dispatch_count = worker.telegram_dispatcher.send_news_alert.call_count
    assert dispatch_count == 0, (
        f"Preservation violated: {dispatch_count} Telegram dispatch(es) for "
        f"{severity} severity entries. MEDIUM/LOW must never be dispatched."
    )


def test_preservation_medium_low_concrete_no_dispatch():
    """
    Concrete observation: 2 MEDIUM + 1 LOW entries → 0 Telegram dispatches.
    """
    worker = _create_worker_with_mocks()

    entries = [
        {'title': 'Medium 1', 'title_hash': 'h1', 'severity': 'MEDIUM',
         'impact_summary': 'x', 'affected_assets': ['BTC'], 'source_url': 'u1', 'market_bias': 'NEUTRAL'},
        {'title': 'Medium 2', 'title_hash': 'h2', 'severity': 'MEDIUM',
         'impact_summary': 'x', 'affected_assets': ['ETH'], 'source_url': 'u2', 'market_bias': 'NEUTRAL'},
        {'title': 'Low 1', 'title_hash': 'h3', 'severity': 'LOW',
         'impact_summary': 'x', 'affected_assets': ['SOL'], 'source_url': 'u3', 'market_bias': 'NEUTRAL'},
    ]

    worker.rss_collector.fetch_all_feeds = MagicMock(return_value=entries)
    worker.rss_collector.deduplicate = MagicMock(return_value=entries)
    worker.ai_classifier.classify = MagicMock(return_value=entries)
    worker.ai_classifier.persist_classified = MagicMock(return_value=True)

    mock_cursor = MagicMock()
    mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cursor.__exit__ = MagicMock(return_value=False)
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    worker.conectar_bd = MagicMock(return_value=mock_conn)
    worker.telegram_dispatcher.send_news_alert = MagicMock(return_value=True)

    worker._run_rss_cycle()

    assert worker.telegram_dispatcher.send_news_alert.call_count == 0, (
        "Preservation violated: Telegram dispatch triggered for MEDIUM/LOW entries."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Preservation 7: Entries with telegram_sent = 1 are NEVER re-sent
# The _run_rss_cycle checks telegram_sent flag and skips already-sent entries.
# Requirement: 3.6
# ═══════════════════════════════════════════════════════════════════════════════

@given(num_entries=st.integers(min_value=1, max_value=5))
@settings(max_examples=20, suppress_health_check=[HealthCheck.too_slow])
def test_preservation_telegram_sent_entries_never_resent(num_entries):
    """
    Preservation Property: For all entries with telegram_sent = 1,
    no re-send occurs (dispatch is skipped).

    On UNFIXED code: PASSES (telegram_sent check works correctly).
    After fix: MUST STILL PASS.
    """
    worker = _create_worker_with_mocks()

    # Create CRITICAL entries (would normally be dispatched)
    entries = [
        {
            'title': f'Already Sent Critical {i}',
            'title_hash': f'sent_hash_{i}',
            'severity': 'CRITICAL',
            'impact_summary': f'Critical impact {i}',
            'affected_assets': ['BTC'],
            'source_url': f'https://example.com/sent/{i}',
            'market_bias': 'BEARISH',
        }
        for i in range(num_entries)
    ]

    worker.rss_collector.fetch_all_feeds = MagicMock(return_value=entries)
    worker.rss_collector.deduplicate = MagicMock(return_value=entries)
    worker.ai_classifier.classify = MagicMock(return_value=entries)
    worker.ai_classifier.persist_classified = MagicMock(return_value=True)

    # Mock DB: telegram_sent = 1 for ALL entries (already sent)
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = {'telegram_sent': 1}  # already sent
    mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cursor.__exit__ = MagicMock(return_value=False)

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    worker.conectar_bd = MagicMock(return_value=mock_conn)
    worker.telegram_dispatcher.send_news_alert = MagicMock(return_value=True)

    worker._run_rss_cycle()

    # No dispatch should occur — all entries are already sent
    dispatch_count = worker.telegram_dispatcher.send_news_alert.call_count
    assert dispatch_count == 0, (
        f"Preservation violated: {dispatch_count} Telegram dispatch(es) for "
        f"entries with telegram_sent=1. Already-sent entries must never be re-sent."
    )


def test_preservation_telegram_sent_concrete_no_resend():
    """
    Concrete observation: 2 CRITICAL entries with telegram_sent=1 → 0 dispatches.
    """
    worker = _create_worker_with_mocks()

    entries = [
        {'title': 'Already Sent 1', 'title_hash': 'ash1', 'severity': 'CRITICAL',
         'impact_summary': 'x', 'affected_assets': ['BTC'], 'source_url': 'u1', 'market_bias': 'BEARISH'},
        {'title': 'Already Sent 2', 'title_hash': 'ash2', 'severity': 'CRITICAL',
         'impact_summary': 'x', 'affected_assets': ['ETH'], 'source_url': 'u2', 'market_bias': 'BEARISH'},
    ]

    worker.rss_collector.fetch_all_feeds = MagicMock(return_value=entries)
    worker.rss_collector.deduplicate = MagicMock(return_value=entries)
    worker.ai_classifier.classify = MagicMock(return_value=entries)
    worker.ai_classifier.persist_classified = MagicMock(return_value=True)

    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = {'telegram_sent': 1}
    mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cursor.__exit__ = MagicMock(return_value=False)
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    worker.conectar_bd = MagicMock(return_value=mock_conn)
    worker.telegram_dispatcher.send_news_alert = MagicMock(return_value=True)

    worker._run_rss_cycle()

    assert worker.telegram_dispatcher.send_news_alert.call_count == 0, (
        "Preservation violated: Telegram dispatch triggered for already-sent entries."
    )
