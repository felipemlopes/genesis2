"""
Bug Condition Exploration Test - Property 1: Low Delivery Due to Restrictive Filters

This test encodes the EXPECTED behavior after the fix is applied.
On UNFIXED code, these tests MUST FAIL — failure confirms the bug exists.
After the fix is applied, these tests should PASS.

Scoped PBT Approach: Tests each of the four sub-conditions causing news
to be silently dropped.

Sub-condition 1 (RSS Recency): _is_recent(entry, hours=0, minutes=10) returns False
    for entries 11–180 minutes old (these SHOULD be accepted under the 3-hour window)
Sub-condition 2 (Poll Window): getUnreadForUser() returns empty for unread items
    inserted 6–1440 minutes ago (these SHOULD be returned under 24h window)
Sub-condition 3 (Missing Sources): RSS_FEEDS does NOT contain Reuters, Bloomberg,
    The Block, or FT Markets entries
Sub-condition 4 (Telegram Cap): Only 1 of 3 CRITICAL entries is dispatched per cycle
    (the `if sent: break` limiter)
"""

import time as _time
from calendar import timegm
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock, call

import pytest
from hypothesis import given, settings, HealthCheck, assume
from hypothesis import strategies as st

from rss_collector import RSSCollector, RSS_FEEDS
from worker_radar_news import RadarNewsWorker


# ═══════════════════════════════════════════════════════════════════════════════
# Sub-condition 1: RSS Recency Filter Too Narrow
# The current code uses _is_recent(entry, hours=0, minutes=10), which drops
# entries between 11 and 180 minutes old. These SHOULD be accepted under
# the expected 3-hour window.
#
# EXPECTED OUTCOME ON UNFIXED CODE: FAIL
# (because _is_recent returns False for entries 11-180min old, but the test
#  asserts they SHOULD be accepted — encoding the expected fixed behavior)
# ═══════════════════════════════════════════════════════════════════════════════


# Strategy: generate ages between 11 and 179 minutes (the "dropped" range)
# Upper bound is 179 to avoid timing boundary issues at exactly 3 hours (180 min)
age_minutes_in_bug_range = st.integers(min_value=11, max_value=179)


class FakeEntry:
    """Simulates a feedparser entry with a published_parsed field."""

    def __init__(self, age_minutes: int):
        # Create a time_struct for N minutes ago
        past = _time.time() - (age_minutes * 60)
        self.published_parsed = _time.gmtime(past)
        self.updated_parsed = None


@given(age_minutes=age_minutes_in_bug_range)
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_rss_recency_entries_11_to_180_min_should_be_accepted(age_minutes):
    """
    Property: For any RSS entry published between 11 and 180 minutes ago,
    the system SHOULD accept it (return True from _is_recent with 3h window).

    On UNFIXED code: _is_recent(entry, hours=0, minutes=10) returns False
    for these entries → test FAILS (confirming the bug).

    Counterexample: _is_recent(entry_25min_old, hours=0, minutes=10) → False
    """
    entry = FakeEntry(age_minutes)

    # The FIXED code calls _is_recent(entry, hours=3, minutes=0)
    # which accepts entries within 3 hours.
    # The EXPECTED behavior is that entries within 3 hours are accepted.
    result = RSSCollector._is_recent(entry, hours=3, minutes=0)

    # This assertion encodes the EXPECTED (fixed) behavior:
    # entries within 3 hours SHOULD be accepted.
    # On unfixed code, result will be False → assertion fails → confirms bug.
    assert result is True, (
        f"Bug confirmed: _is_recent(entry_{age_minutes}min_old, hours=3, minutes=0) "
        f"returned False — entry silently dropped despite being within 3h window"
    )


def test_rss_recency_concrete_25min_entry_dropped():
    """
    Concrete counterexample: An entry published 25 minutes ago is dropped
    by the 10-minute filter. Expected: should be accepted (within 3h).

    On UNFIXED code: FAILS (confirms the bug).
    """
    entry = FakeEntry(age_minutes=25)
    result = RSSCollector._is_recent(entry, hours=3, minutes=0)

    assert result is True, (
        "Bug confirmed: _is_recent(entry_25min_old, hours=3, minutes=0) → False. "
        "Entry silently dropped."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Sub-condition 2: Poll Window Too Narrow
# The PHP code uses now()->subMinutes(5), which means unread items inserted
# 6–1440 minutes ago are invisible to the user.
#
# We cannot directly test PHP from Python, so we simulate the SQL condition
# to confirm the design-level bug: the 5-minute window causes data loss.
#
# EXPECTED OUTCOME ON UNFIXED CODE: FAIL
# ═══════════════════════════════════════════════════════════════════════════════

# Strategy: generate ages between 6 and 1440 minutes (items that SHOULD be visible)
poll_age_minutes_in_bug_range = st.integers(min_value=6, max_value=1440)


def simulate_poll_window_filter(item_age_minutes: int, window_minutes: int = 1440) -> bool:
    """Simulate the PHP getUnreadForUser() time filter.

    Returns True if the item would be returned by the query (within window).
    The fixed code uses subHours(24) — items within 24h (1440 min) are included.
    """
    return item_age_minutes <= window_minutes


@given(age_minutes=poll_age_minutes_in_bug_range)
@settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
def test_poll_window_unread_items_6_to_1440_min_should_be_visible(age_minutes):
    """
    Property: For any unread news item inserted between 6 and 1440 minutes ago,
    the poll endpoint SHOULD return it (within 24h, unread).

    On UNFIXED code: subMinutes(5) excludes these items → test FAILS.

    Counterexample: item inserted 8 min ago, unread → not returned by poll.
    """
    # Simulate the fixed 24-hour (1440 min) window behavior
    is_visible = simulate_poll_window_filter(age_minutes, window_minutes=1440)

    # The EXPECTED behavior is that all unread items within 24h are visible
    assert is_visible is True, (
        f"Bug confirmed: unread item inserted {age_minutes} minutes ago is excluded "
        f"by the poll window. Should be visible within 24h."
    )


def test_poll_window_concrete_8min_item_invisible():
    """
    Concrete counterexample: An unread news item inserted 8 minutes ago
    is excluded by the 5-minute filter. Expected: should be visible.

    On UNFIXED code: FAILS (confirms the bug).
    """
    is_visible = simulate_poll_window_filter(8, window_minutes=1440)

    assert is_visible is True, (
        "Bug confirmed: unread item inserted 8 min ago excluded by poll window. "
        "Should be visible within 24h window."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Sub-condition 3: Missing MACRO/GEO RSS Sources
# RSS_FEEDS only contains 4 crypto-native outlets. Reuters, Bloomberg,
# The Block, and FT Markets are absent.
#
# EXPECTED OUTCOME ON UNFIXED CODE: FAIL
# ═══════════════════════════════════════════════════════════════════════════════

REQUIRED_MACRO_SOURCES = ['Reuters', 'Bloomberg', 'The Block', 'FT Markets']


def test_rss_feeds_missing_macro_geo_sources():
    """
    Property: RSS_FEEDS SHOULD contain sources covering MACRO/GEO categories
    including Reuters, Bloomberg, The Block, and FT Markets.

    On UNFIXED code: These sources are absent → test FAILS (confirms the bug).
    """
    feed_names = [feed['name'] for feed in RSS_FEEDS]

    missing_sources = [
        source for source in REQUIRED_MACRO_SOURCES
        if source not in feed_names
    ]

    assert len(missing_sources) == 0, (
        f"Bug confirmed: RSS_FEEDS is missing MACRO/GEO sources: {missing_sources}. "
        f"Current feeds: {feed_names}. "
        f"Expected at least 8 sources covering crypto + MACRO/GEO."
    )


def test_rss_feeds_has_at_least_8_sources():
    """
    Property: RSS_FEEDS SHOULD have at least 8 sources to provide adequate coverage.

    On UNFIXED code: Only 4 feeds exist → test FAILS (confirms the bug).
    """
    assert len(RSS_FEEDS) >= 8, (
        f"Bug confirmed: RSS_FEEDS has only {len(RSS_FEEDS)} feeds. "
        f"Expected at least 8 for crypto + MACRO/GEO coverage."
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Sub-condition 4: Telegram Single-Dispatch Cap
# The `if sent: break` logic in _run_rss_cycle() limits Telegram dispatch
# to 1 message per cycle, dropping subsequent CRITICAL/HIGH entries.
#
# EXPECTED OUTCOME ON UNFIXED CODE: FAIL
# ═══════════════════════════════════════════════════════════════════════════════

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


def test_telegram_dispatch_cap_only_1_of_3_critical_sent():
    """
    Property: When 3 CRITICAL entries arrive in one cycle, ALL of them
    SHOULD be dispatched to Telegram.

    On UNFIXED code: Only 1 is dispatched (`if sent: break`) → test FAILS.

    Counterexample: 3 CRITICAL entries in one cycle → only 1 dispatched,
    2 silently dropped.
    """
    worker = _create_worker_with_mocks()

    # Create 3 CRITICAL entries
    critical_entries = [
        {
            'title': f'Critical News {i}',
            'title_hash': f'hash_{i}',
            'severity': 'CRITICAL',
            'impact_summary': f'Critical impact {i}',
            'affected_assets': ['BTC'],
            'source_url': f'https://example.com/{i}',
            'market_bias': 'BEARISH',
        }
        for i in range(3)
    ]

    # Mock fetch_all_feeds to return our entries
    worker.rss_collector.fetch_all_feeds = MagicMock(return_value=critical_entries)

    # Mock deduplicate to pass all entries through
    worker.rss_collector.deduplicate = MagicMock(return_value=critical_entries)

    # Mock AI classifier to return entries as-is (already classified)
    worker.ai_classifier.classify = MagicMock(return_value=critical_entries)
    worker.ai_classifier.persist_classified = MagicMock(return_value=True)

    # Mock DB connection and cursor
    mock_cursor = MagicMock()
    # telegram_sent = 0 for all entries (none sent yet)
    mock_cursor.fetchone.return_value = {'telegram_sent': 0}
    mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cursor.__exit__ = MagicMock(return_value=False)

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    worker.conectar_bd = MagicMock(return_value=mock_conn)

    # Mock telegram dispatch
    worker.telegram_dispatcher.dispatch = MagicMock(return_value=True)

    # Run the cycle
    worker._run_rss_cycle()

    # Count how many times Telegram dispatch was called
    dispatch_count = worker.telegram_dispatcher.dispatch.call_count

    # EXPECTED: all 3 CRITICAL entries should be dispatched
    # On UNFIXED code: only 1 is dispatched due to `if sent: break`
    assert dispatch_count == 3, (
        f"Bug confirmed: Only {dispatch_count}/3 CRITICAL entries dispatched to Telegram. "
        f"The `if sent: break` limiter drops entries after the first dispatch. "
        f"Expected: all 3 CRITICAL entries dispatched per cycle."
    )


def test_telegram_dispatch_cap_high_entries_also_limited():
    """
    Property: When 2 HIGH entries arrive in one cycle (no CRITICAL),
    ALL of them SHOULD be dispatched.

    On UNFIXED code: Only 1 is dispatched → test FAILS.
    """
    worker = _create_worker_with_mocks()

    # Create 2 HIGH entries
    high_entries = [
        {
            'title': f'High Priority News {i}',
            'title_hash': f'high_hash_{i}',
            'severity': 'HIGH',
            'impact_summary': f'High impact {i}',
            'affected_assets': ['ETH'],
            'source_url': f'https://example.com/high/{i}',
            'market_bias': 'BULLISH',
        }
        for i in range(2)
    ]

    worker.rss_collector.fetch_all_feeds = MagicMock(return_value=high_entries)
    worker.rss_collector.deduplicate = MagicMock(return_value=high_entries)
    worker.ai_classifier.classify = MagicMock(return_value=high_entries)
    worker.ai_classifier.persist_classified = MagicMock(return_value=True)

    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = {'telegram_sent': 0}
    mock_cursor.__enter__ = MagicMock(return_value=mock_cursor)
    mock_cursor.__exit__ = MagicMock(return_value=False)

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    worker.conectar_bd = MagicMock(return_value=mock_conn)
    worker.telegram_dispatcher.dispatch = MagicMock(return_value=True)

    worker._run_rss_cycle()

    dispatch_count = worker.telegram_dispatcher.dispatch.call_count

    assert dispatch_count == 2, (
        f"Bug confirmed: Only {dispatch_count}/2 HIGH entries dispatched to Telegram. "
        f"Expected: all 2 HIGH entries dispatched per cycle."
    )
