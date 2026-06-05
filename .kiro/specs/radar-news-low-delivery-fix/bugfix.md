# Bugfix Requirements Document

## Introduction

The Radar News system is delivering very few news items to users due to multiple compounding filters that aggressively reduce delivery volume. Four independent root causes have been identified: an overly restrictive RSS recency filter (10 minutes), a redundant 5-minute temporal window on the poll endpoint, missing RSS sources for MACRO/GEO coverage, and a single Telegram dispatch per cycle that drops concurrent CRITICAL/HIGH news.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an RSS entry has a published timestamp older than 10 minutes THEN the system discards the entry even if it has never been seen before

1.2 WHEN a user polls the `/v1/radar-news/poll` endpoint more than 5 minutes after a news item was inserted THEN the system does not return that item, making it permanently invisible to the user

1.3 WHEN the system collects RSS feeds THEN it only queries 4 crypto-specific sources (CoinDesk, Decrypt, Cointelegraph, Bitcoin Magazine), missing required MACRO/GEO coverage from Reuters, Bloomberg, The Block, and FT Markets

1.4 WHEN multiple CRITICAL or HIGH severity news items arrive in the same 3-minute RSS cycle THEN the system dispatches only the first one to Telegram and silently drops the rest (they are persisted but never sent)

### Expected Behavior (Correct)

2.1 WHEN an RSS entry has a published timestamp within the last 3 hours THEN the system SHALL accept the entry for processing (deduplication in the DB handles duplicates)

2.2 WHEN a user polls the `/v1/radar-news/poll` endpoint THEN the system SHALL return all unread news for that user within the last 24 hours, relying on the `radar_news_user_reads` table for read-state control instead of an aggressive time window

2.3 WHEN the system collects RSS feeds THEN it SHALL query at least 6 sources including feeds covering MACRO/GEO categories (The Block, Reuters Business, Bloomberg Markets, FT Markets or equivalent available feeds)

2.4 WHEN multiple CRITICAL or HIGH severity news items arrive in the same RSS cycle THEN the system SHALL dispatch ALL of them to Telegram (respecting per-entry `telegram_sent` flag to avoid re-sends)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an RSS entry has already been persisted in the database (matching title_hash + source within 24h) THEN the system SHALL CONTINUE TO deduplicate and skip the entry

3.2 WHEN a user has already read a news item (entry exists in `radar_news_user_reads`) THEN the system SHALL CONTINUE TO exclude that item from poll results

3.3 WHEN the `markAsRead` mechanism is invoked after poll delivery THEN the system SHALL CONTINUE TO insert records into `radar_news_user_reads` so items are not resent

3.4 WHEN a MEDIUM or LOW severity news item is classified THEN the system SHALL CONTINUE TO skip Telegram dispatch for that entry (only CRITICAL and HIGH are dispatched)

3.5 WHEN an RSS entry has no published timestamp THEN the system SHALL CONTINUE TO assume it is recent (fail-open behavior)

3.6 WHEN a Telegram message has already been sent for a given entry (`telegram_sent = 1`) THEN the system SHALL CONTINUE TO skip re-sending that entry
