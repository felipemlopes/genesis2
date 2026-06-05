# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Low Delivery Due to Restrictive Filters
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the four sub-conditions causing news to be silently dropped
  - **Scoped PBT Approach**: Scope properties to concrete failing cases for each sub-condition
  - **Sub-condition 1 (RSS Recency)**: Test that `_is_recent(entry, hours=0, minutes=10)` returns False for entries 11–180 minutes old (these SHOULD be accepted under the 3-hour window)
  - **Sub-condition 2 (Poll Window)**: Test that `getUnreadForUser()` returns empty for unread items inserted 6–1440 minutes ago (these SHOULD be returned under the 24-hour window)
  - **Sub-condition 3 (Missing Sources)**: Assert that `RSS_FEEDS` does NOT contain Reuters, Bloomberg, The Block, or FT Markets entries
  - **Sub-condition 4 (Telegram Cap)**: Simulate 3 CRITICAL entries in one cycle, assert only 1 is dispatched (the `if sent: break` limiter)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this proves the bug exists)
  - Document counterexamples: e.g., `_is_recent(entry_25min_old, hours=0, minutes=10)` → False; poll misses 8-min-old unread item; only 1/3 CRITICAL dispatched
  - Mark task complete when tests are written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Deduplication, Read State, Severity Gating, and Telegram Sent Flag
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code**:
    - `_is_recent(entry_5min_old)` returns True (entries younger than 10min already accepted)
    - `_is_recent(entry_with_no_timestamp)` returns True (fail-open behavior)
    - `deduplicate()` rejects entries with matching `title_hash + source` within 24h
    - `getUnreadForUser()` excludes items present in `radar_news_user_reads`
    - MEDIUM/LOW severity entries are never dispatched to Telegram
    - Entries with `telegram_sent = 1` are never re-sent
  - **Write property-based tests**:
    - For all entries with age <= 10 minutes, `_is_recent()` returns True (unchanged by fix)
    - For all entries with age > 3 hours, `_is_recent()` returns False (still rejected)
    - For all entries without `published_parsed`, `_is_recent()` returns True (fail-open preserved)
    - For all entries with matching `title_hash + source` in DB within 24h, `deduplicate()` filters them out
    - For all items in `radar_news_user_reads`, `getUnreadForUser()` excludes them
    - For all entries with severity in [MEDIUM, LOW], Telegram dispatch is skipped
    - For all entries with `telegram_sent = 1`, no re-send occurs
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix for low news delivery caused by restrictive filters

  - [x] 3.1 Widen RSS recency window from 10 minutes to 3 hours
    - In `G-nesis-2.0-main/monitor/rss_collector.py`, function `_fetch_single_feed()`
    - Change `self._is_recent(entry, hours=0, minutes=10)` to `self._is_recent(entry, hours=3, minutes=0)`
    - _Bug_Condition: isBugCondition(input) where input.entryAge > 10min AND input.entryAge <= 3h_
    - _Expected_Behavior: `_is_recent()` returns True for all entries within 3 hours_
    - _Preservation: Entries without timestamps still treated as recent (fail-open); entries > 3h still rejected_
    - _Requirements: 2.1, 3.5_

  - [x] 3.2 Add MACRO/GEO RSS sources
    - In `G-nesis-2.0-main/monitor/rss_collector.py`, constant `RSS_FEEDS`
    - Add The Block: `{'name': 'The Block', 'url': 'https://www.theblock.co/rss.xml'}`
    - Add Reuters Business: `{'name': 'Reuters', 'url': 'https://www.reutersagency.com/feed/'}`
    - Add Bloomberg Markets: `{'name': 'Bloomberg', 'url': 'https://feeds.bloomberg.com/markets/news.rss'}`
    - Add FT Markets: `{'name': 'FT Markets', 'url': 'https://www.ft.com/markets?format=rss'}`
    - _Bug_Condition: isBugCondition(input) where input.source IN ['Reuters', 'Bloomberg', 'TheBlock', 'FTMarkets']_
    - _Expected_Behavior: RSS_FEEDS contains at least 8 sources covering crypto + MACRO/GEO_
    - _Preservation: Existing 4 feeds (CoinDesk, Decrypt, Cointelegraph, Bitcoin Magazine) remain unchanged_
    - _Requirements: 2.3_

  - [x] 3.3 Widen poll time window from 5 minutes to 24 hours
    - In `genesis-api/app/Services/RadarNewsService.php`, function `getUnreadForUser()`
    - Change `now()->subMinutes(5)` to `now()->subHours(24)`
    - _Bug_Condition: isBugCondition(input) where input.newsAge > 5min AND input.newsAge <= 24h AND user has not read_
    - _Expected_Behavior: All unread items within 24h returned, read-state via `radar_news_user_reads` handles filtering_
    - _Preservation: Items in `radar_news_user_reads` still excluded; `markAsRead()` behavior unchanged_
    - _Requirements: 2.2, 3.2, 3.3_

  - [x] 3.4 Remove single-dispatch limiter in Telegram loop
    - In `G-nesis-2.0-main/monitor/worker_radar_news.py`, function `_run_rss_cycle()`
    - Remove `sent = False` variable initialization
    - Remove `if sent: break` logic inside the `for top_entry in candidates_tg` loop
    - Remove `sent = True` assignment after dispatch
    - Use `self.telegram_dispatcher.dispatch(top_entry)` for each entry (CRITICAL = immediate, HIGH = 3-min delay)
    - Keep the `telegram_sent` flag check to avoid re-sending already-dispatched entries
    - _Bug_Condition: isBugCondition(input) where input.severity IN ['CRITICAL','HIGH'] AND input.cyclePosition > 1 AND telegram_sent == 0_
    - _Expected_Behavior: ALL CRITICAL/HIGH entries with telegram_sent=0 are dispatched per cycle_
    - _Preservation: MEDIUM/LOW still skipped; telegram_sent=1 entries still not re-sent; CRITICAL immediate, HIGH 3-min delay_
    - _Requirements: 2.4, 3.4, 3.6_

  - [x] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Low Delivery Due to Restrictive Filters
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Deduplication, Read State, Severity Gating, and Telegram Sent Flag
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite (bug condition + preservation tests)
  - Ensure all tests pass after the fix is applied
  - Ask the user if questions arise
