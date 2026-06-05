# Radar News Low Delivery Bugfix Design

## Overview

The Radar News system delivers far fewer news items than expected due to four compounding restrictive filters. The fix widens the RSS recency window from 10 minutes to 3 hours, extends the poll endpoint time window from 5 minutes to 24 hours, adds four missing RSS sources for MACRO/GEO coverage, and removes the single-dispatch-per-cycle limiter so all CRITICAL/HIGH entries reach Telegram.

## Glossary

- **Bug_Condition (C)**: The set of conditions causing valid news to be silently dropped — overly narrow time filters, missing sources, and single-dispatch limiter
- **Property (P)**: All valid news items within 3 hours reach the DB; all unread items within 24h appear on poll; all CRITICAL/HIGH items are dispatched to Telegram
- **Preservation**: Existing deduplication (title_hash+source), per-user read state (`radar_news_user_reads`), MEDIUM/LOW skip, `telegram_sent` flag, and fail-open behavior for entries without timestamps must remain unchanged
- **`_is_recent()`**: Method in `rss_collector.py` that filters RSS entries by publication age
- **`getUnreadForUser()`**: Method in `RadarNewsService.php` that queries unread news for the poll endpoint
- **`_run_rss_cycle()`**: Method in `worker_radar_news.py` that orchestrates RSS collection → classification → persistence → Telegram dispatch

## Bug Details

### Bug Condition

The bug manifests when news items pass through any of four independent filters that aggressively discard them: a 10-minute recency check on RSS entries, a 5-minute time window on the poll query, absence of MACRO/GEO RSS feeds, and a `if sent: break` loop that caps Telegram dispatch to 1 per cycle.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type NewsProcessingEvent
  OUTPUT: boolean

  // Sub-condition 1: RSS recency filter too narrow
  rssFilterDropped := input.entryAge > 10_MINUTES AND input.entryAge <= 3_HOURS

  // Sub-condition 2: Poll window too narrow
  pollFilterDropped := input.newsAge > 5_MINUTES AND input.newsAge <= 24_HOURS
                       AND input.userHasNotRead(input.newsId)

  // Sub-condition 3: Missing source
  missingSource := input.source IN ['Reuters', 'Bloomberg', 'TheBlock', 'FTMarkets']

  // Sub-condition 4: Telegram single-dispatch cap
  telegramDropped := input.severity IN ['CRITICAL', 'HIGH']
                     AND input.cyclePosition > 1
                     AND input.telegramSent == false

  RETURN rssFilterDropped OR pollFilterDropped OR missingSource OR telegramDropped
END FUNCTION
```

### Examples

- **RSS filter**: CoinDesk publishes an article 25 minutes ago → `_is_recent(entry, minutes=10)` returns False → entry discarded. Expected: accepted (within 3h).
- **Poll window**: A news item was inserted 8 minutes ago, user has not read it → `subMinutes(5)` excludes it from query. Expected: returned (within 24h, unread).
- **Missing source**: Reuters publishes a MACRO-critical Fed rate decision → system has no Reuters feed → news never collected. Expected: collected and classified.
- **Telegram cap**: In one 3-minute cycle, 2 CRITICAL news arrive → only the first is dispatched, the second is dropped silently. Expected: both dispatched.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Deduplication via `title_hash + source` within 24h in `genesis_radar_news` table continues to prevent duplicate entries
- Per-user read state via `radar_news_user_reads` table continues to exclude already-read items from poll results
- `markAsRead()` continues to insert records into `radar_news_user_reads` after poll delivery
- MEDIUM and LOW severity items continue to be skipped for Telegram dispatch
- Entries without a `published_parsed` timestamp continue to be treated as recent (fail-open)
- The `telegram_sent = 1` flag continues to prevent re-sending entries already dispatched
- CRITICAL entries are still dispatched immediately; HIGH entries still use the 3-minute delay timer

**Scope:**
All inputs that do NOT match the bug condition should be completely unaffected by this fix. This includes:
- Entries younger than 10 minutes (already accepted by old filter, still accepted by new)
- Poll results for items younger than 5 minutes (already returned, still returned)
- CoinDesk, Decrypt, Cointelegraph, Bitcoin Magazine feeds (unchanged)
- Single CRITICAL/HIGH entry per cycle (was already sent, still sent)
- Mouse/UI interactions, SSE mechanisms (not applicable — poll only)

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **Overly restrictive `_is_recent()` default**: The method uses `minutes=10` as the cutoff in `_fetch_single_feed()`. RSS feeds often batch-publish or have delayed timestamps, so 10 minutes eliminates most entries. The call site passes `hours=0, minutes=10` explicitly.

2. **Redundant temporal filter in `getUnreadForUser()`**: The Laravel query applies `where('created_at', '>=', now()->subMinutes(5))` which is far narrower than the 3-minute polling cycle. If a user misses one poll, news becomes permanently invisible. The `radar_news_user_reads` table already handles read state correctly.

3. **Incomplete RSS_FEEDS list**: The `RSS_FEEDS` constant only contains 4 crypto-native outlets. MACRO/GEO events (Fed decisions, geopolitical news) come from Reuters, Bloomberg, The Block, and FT Markets — none of which are configured.

4. **Single-dispatch limiter in `_run_rss_cycle()`**: The loop `for top_entry in candidates_tg: if sent: break` ensures only one Telegram message per cycle. Combined with the 3-minute cycle, bursts of important news get silently dropped.

## Correctness Properties

Property 1: Bug Condition - RSS Entries Within 3 Hours Are Accepted

_For any_ RSS entry where the publication timestamp is within the last 3 hours and the entry has not been previously persisted (no title_hash+source match in DB), the fixed `_is_recent()` function SHALL return True, allowing the entry to proceed to classification and persistence.

**Validates: Requirements 2.1**

Property 2: Bug Condition - Poll Returns All Unread Within 24 Hours

_For any_ authenticated user poll request, the fixed `getUnreadForUser()` SHALL return all news items created within the last 24 hours that the user has not yet read (no entry in `radar_news_user_reads`), regardless of how many minutes have passed since insertion.

**Validates: Requirements 2.2**

Property 3: Bug Condition - All CRITICAL/HIGH Dispatched Per Cycle

_For any_ RSS cycle that produces multiple CRITICAL or HIGH severity entries with `telegram_sent = 0`, the fixed `_run_rss_cycle()` SHALL dispatch ALL of them to Telegram (not just the first), respecting the per-entry `telegram_sent` check.

**Validates: Requirements 2.4**

Property 4: Preservation - Deduplication and Read State Unchanged

_For any_ input where the bug condition does NOT hold (entries already in DB, items already read by user, MEDIUM/LOW severity entries, entries without timestamps), the fixed functions SHALL produce the same result as the original functions, preserving deduplication, read-state filtering, severity gating, and fail-open timestamp behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `G-nesis-2.0-main/monitor/rss_collector.py`

**Function**: `_fetch_single_feed()`

**Change 1 — Widen recency window**:
- Change `self._is_recent(entry, hours=0, minutes=10)` to `self._is_recent(entry, hours=3, minutes=0)`
- This allows entries published within the last 3 hours to pass through

---

**File**: `G-nesis-2.0-main/monitor/rss_collector.py`

**Constant**: `RSS_FEEDS`

**Change 2 — Add MACRO/GEO sources**:
- Add Reuters Business News RSS feed
- Add Bloomberg Markets RSS feed (or available alternative)
- Add The Block RSS feed
- Add FT Markets RSS feed (or available alternative)

---

**File**: `genesis-api/app/Services/RadarNewsService.php`

**Function**: `getUnreadForUser()`

**Change 3 — Widen poll time window to 24 hours**:
- Change `now()->subMinutes(5)` to `now()->subHours(24)`
- The `radar_news_user_reads` table already handles per-user read state

---

**File**: `G-nesis-2.0-main/monitor/worker_radar_news.py`

**Function**: `_run_rss_cycle()`

**Change 4 — Remove single-dispatch limiter**:
- Remove the `sent = False` variable and the `if sent: break` logic
- Iterate through ALL `candidates_tg` and dispatch each one that has `telegram_sent = 0`
- Use `self.telegram_dispatcher.dispatch(top_entry)` instead of `send_news_alert()` to preserve CRITICAL=immediate / HIGH=3min delay logic

---


## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests exercising each of the four sub-conditions on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **RSS Recency Filter Test**: Create a mock RSS entry with `published_parsed` = 25 minutes ago, call `_is_recent(entry, hours=0, minutes=10)` → expect False (confirming the filter drops valid entries)
2. **Poll Window Test**: Insert a news item 8 minutes ago, query `getUnreadForUser()` → expect empty result (confirming the 5-minute window hides valid unread items)
3. **Missing Source Test**: Inspect `RSS_FEEDS` list → confirm Reuters, Bloomberg, The Block, FT Markets are absent
4. **Telegram Cap Test**: Simulate 3 CRITICAL entries in one cycle, run `_run_rss_cycle()` → expect only 1 Telegram dispatch (confirming the `if sent: break` behavior)

**Expected Counterexamples**:
- `_is_recent()` returns False for entries 11-180 minutes old
- `getUnreadForUser()` returns empty set for items 6-1440 minutes old that are unread
- Only 1 Telegram message sent per cycle regardless of CRITICAL/HIGH count
- Possible causes confirmed: hardcoded `minutes=10`, `subMinutes(5)`, `if sent: break`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL entry WHERE entry.age > 10min AND entry.age <= 3h DO
  result := _is_recent_fixed(entry, hours=3, minutes=0)
  ASSERT result == True
END FOR

FOR ALL newsItem WHERE newsItem.age > 5min AND newsItem.age <= 24h AND NOT userHasRead(newsItem) DO
  result := getUnreadForUser_fixed(userId)
  ASSERT newsItem IN result
END FOR

FOR ALL cycle WHERE len(criticalHighEntries) > 1 DO
  dispatched := run_rss_cycle_fixed(cycle)
  ASSERT dispatched == len(criticalHighEntries)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL entry WHERE entry.age <= 10min DO
  ASSERT _is_recent_original(entry) == _is_recent_fixed(entry)
END FOR

FOR ALL entry WHERE entry.age > 3h DO
  ASSERT _is_recent_fixed(entry, hours=3) == False
END FOR

FOR ALL newsItem WHERE newsItem.age <= 5min AND NOT userHasRead(newsItem) DO
  ASSERT newsItem IN getUnreadForUser_fixed(userId)
END FOR

FOR ALL newsItem WHERE userHasRead(newsItem) DO
  ASSERT newsItem NOT IN getUnreadForUser_fixed(userId)
END FOR

FOR ALL entry WHERE entry.severity IN ['MEDIUM', 'LOW'] DO
  ASSERT telegramDispatched(entry) == False
END FOR

FOR ALL entry WHERE entry.telegram_sent == 1 DO
  ASSERT NOT reSent(entry)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (varying timestamps, severities, read states)
- It catches edge cases that manual unit tests might miss (boundary conditions at exactly 3h, exactly 24h)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-bug inputs (entries <10min old, already-read items, MEDIUM/LOW entries), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Deduplication Preservation**: Entries with matching `title_hash + source` within 24h are still rejected after fix
2. **Read State Preservation**: Items in `radar_news_user_reads` are still excluded from poll results
3. **Severity Gating Preservation**: MEDIUM/LOW entries never trigger Telegram dispatch
4. **Telegram Sent Flag Preservation**: Entries with `telegram_sent = 1` are never re-sent
5. **Fail-Open Timestamp Preservation**: Entries without `published_parsed` are still treated as recent

### Unit Tests

- Test `_is_recent()` with entries at boundary ages: 0min, 10min, 1h, 3h, 3h+1s
- Test `getUnreadForUser()` with items at boundary ages: 1min, 5min, 12h, 24h, 24h+1s
- Test Telegram dispatch loop with 0, 1, 2, 5 CRITICAL/HIGH entries per cycle
- Test that `dispatch()` method correctly applies CRITICAL=immediate, HIGH=3min delay

### Property-Based Tests

- Generate random entry ages (0s to 48h) and verify `_is_recent()` returns True iff age <= 3h
- Generate random poll scenarios (varying news ages 0-48h, read/unread states) and verify query correctness
- Generate random cycle payloads (varying counts and severities) and verify all CRITICAL/HIGH are dispatched
- Generate random entries with `telegram_sent` flags and verify no re-sends occur

### Integration Tests

- End-to-end test: inject RSS entries across all 8 feeds, verify they reach DB with correct classification
- End-to-end test: insert news items of varying ages, poll as user, verify all unread within 24h are returned
- End-to-end test: simulate burst of 3 CRITICAL news in single cycle, verify all 3 reach Telegram
- End-to-end test: verify poll → markAsRead → re-poll returns empty for those items
