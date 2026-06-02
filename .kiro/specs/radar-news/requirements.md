# Requirements Document

## Introduction

Radar News is a real-time news monitoring and alerting system for the Gênesis Labs crypto trading platform. It collects crypto-relevant news from RSS feeds, classifies them using AI (Gemini 2.5 Flash), deduplicates via MySQL, dispatches critical alerts to Telegram, and surfaces them in the frontend via polling. Additionally, a "Discovery Radar" module monitors tokens outside the main 70-token watchlist that are gaining market relevance (via CoinGecko trending and CMC gainers).

## Glossary

- **Worker_Radar_News**: Python process (worker_radar_news.py) that runs continuously, collecting and classifying news every 3 minutes and running discovery radar every 20 minutes
- **RSS_Collector**: Module within Worker_Radar_News responsible for fetching news from RSS feeds (Reuters, Bloomberg, CoinDesk, The Block, Decrypt, FT Markets)
- **AI_Classifier**: Module that sends news to Gemini 2.5 Flash API for severity classification and market impact analysis
- **Discovery_Radar**: Module within Worker_Radar_News that monitors tokens outside the main 70-token list gaining relevance via CoinGecko trending and CMC gainers every 20 minutes
- **Radar_News_API**: Laravel backend endpoint (/v1/radar-news/poll) that serves classified news to authenticated users via polling
- **Frontend_Polling_Hook**: React hook (useRadarNewsAlerts.ts) that polls the Radar_News_API at regular intervals
- **Telegram_Dispatcher**: Module that formats and sends alerts to Telegram channel via bot API
- **Severity**: Classification level assigned to news (CRITICAL, HIGH, MEDIUM, LOW)
- **Discovery_Score**: Numeric score (1-10) assigned to discovery radar findings indicating trading relevance
- **Monitored_Tokens_List**: The main 70 cryptocurrency tokens actively monitored by the platform
- **Deduplication_Engine**: MySQL-based mechanism to prevent duplicate news alerts within a configurable time window

## Requirements

### Requirement 1: RSS News Collection

**User Story:** As a trader, I want the system to automatically collect crypto-relevant news from major financial sources, so that I stay informed about market-moving events without manually checking multiple sites.

#### Acceptance Criteria

1. WHEN the 3-minute collection cycle triggers, THE RSS_Collector SHALL fetch news from Reuters, Bloomberg, CoinDesk, The Block, Decrypt, and FT Markets RSS feeds
2. IF a feed is unreachable or returns an error, THEN THE RSS_Collector SHALL log the error and continue processing remaining feeds without interruption
3. THE RSS_Collector SHALL extract title, publication date, source URL, and content summary from each feed entry
4. WHEN a new feed entry is fetched, THE Deduplication_Engine SHALL check MySQL for existing entries with matching title (case-insensitive) created within the last 24 hours
5. IF a duplicate entry is detected, THEN THE RSS_Collector SHALL skip the entry and log the deduplication event

### Requirement 2: AI News Classification

**User Story:** As a trader, I want news to be automatically classified by severity and market impact, so that I can prioritize my attention on the most critical information.

#### Acceptance Criteria

1. WHEN new non-duplicate news entries are collected, THE AI_Classifier SHALL send them to Gemini 2.5 Flash API for classification
2. THE AI_Classifier SHALL assign a severity level (CRITICAL, HIGH, MEDIUM, or LOW) to each news entry
3. THE AI_Classifier SHALL extract affected crypto assets, market bias (BULLISH, BEARISH, NEUTRAL), and a concise impact summary for each entry
4. IF the Gemini API returns an error or times out after 30 seconds, THEN THE AI_Classifier SHALL retry once after 5 seconds and log the failure if the retry also fails
5. WHEN classification is complete, THE AI_Classifier SHALL persist the classified entry to the genesis_radar_news MySQL table with all metadata

### Requirement 3: Telegram Dispatch

**User Story:** As a trader, I want critical and high-severity news to be sent to my Telegram channel, so that I receive immediate notifications on my mobile device.

#### Acceptance Criteria

1. WHEN a news entry is classified as CRITICAL, THE Telegram_Dispatcher SHALL send the formatted message to Telegram immediately
2. WHEN a news entry is classified as HIGH, THE Telegram_Dispatcher SHALL send the formatted message to Telegram after a 3-minute delay
3. WHEN a news entry is classified as MEDIUM or LOW, THE Telegram_Dispatcher SHALL NOT send a Telegram message
4. THE Telegram_Dispatcher SHALL format messages using HTML parse mode with severity emoji, title, impact summary, affected assets, and the signature "-- @cripto.ico"
5. IF the Telegram API returns an error, THEN THE Telegram_Dispatcher SHALL retry once after 10 seconds and log the failure

### Requirement 4: Discovery Radar

**User Story:** As a trader, I want to discover tokens outside my main watchlist that are gaining significant market relevance, so that I can identify early trading opportunities.

#### Acceptance Criteria

1. WHEN the 20-minute discovery cycle triggers, THE Discovery_Radar SHALL fetch trending tokens from CoinGecko and top gainers from CoinMarketCap
2. THE Discovery_Radar SHALL filter tokens to include only those with 24h volume greater than $5M USD
3. THE Discovery_Radar SHALL filter tokens to include only those listed on Binance, Bybit, OKX, or Coinbase
4. THE Discovery_Radar SHALL exclude any token that is part of the Monitored_Tokens_List (70 tokens)
5. THE Discovery_Radar SHALL require positive concrete context (no speculation-based entries) and multi-source confirmation (at least 2 sources within 2 hours)
6. THE AI_Classifier SHALL assign a Discovery_Score (1-10) to each qualifying discovery token
7. WHEN a discovery token receives a Discovery_Score of 7 or higher, THE Telegram_Dispatcher SHALL send the formatted discovery alert to Telegram immediately
8. WHEN a discovery token receives a Discovery_Score between 5 and 6, THE Frontend_Polling_Hook SHALL display a popup alert (no Telegram dispatch)
9. WHEN a discovery token receives a Discovery_Score below 5, THE Discovery_Radar SHALL log the finding without any notification
10. WHILE a discovery alert has been sent for a specific token within the last 6 hours, THE Discovery_Radar SHALL suppress additional alerts for that token

### Requirement 5: Backend Polling Endpoint

**User Story:** As a frontend developer, I want a polling endpoint that returns unread radar news for the authenticated user, so that the UI can display new alerts without SSE or WebSocket connections.

#### Acceptance Criteria

1. THE Radar_News_API SHALL expose a GET endpoint at /v1/radar-news/poll requiring Sanctum authentication
2. WHEN polled, THE Radar_News_API SHALL return news entries created within the last 5 minutes that the authenticated user has not yet received
3. WHEN news entries are returned, THE Radar_News_API SHALL mark them as read for the authenticated user to prevent duplicate delivery
4. THE Radar_News_API SHALL return entries ordered by creation date ascending, limited to 10 entries per response
5. THE Radar_News_API SHALL return a JSON response with structure: {"success": true, "data": [...]}

### Requirement 6: Frontend Polling and Display

**User Story:** As a trader using the platform, I want radar news alerts to appear as popup/toast notifications in the UI, so that I am aware of market-moving news while actively trading.

#### Acceptance Criteria

1. THE Frontend_Polling_Hook SHALL poll the /v1/radar-news/poll endpoint every 10 seconds
2. WHEN new radar news entries are received, THE Frontend_Polling_Hook SHALL display each as a popup/toast notification
3. THE Frontend_Polling_Hook SHALL display a maximum of 5 simultaneous popup notifications, with oldest dismissed first
4. WHEN a popup has been displayed for 15 seconds without user interaction, THE Frontend_Polling_Hook SHALL automatically dismiss the notification
5. THE Frontend_Polling_Hook SHALL start polling only when at least one component subscribes and stop polling when all subscribers unsubscribe

### Requirement 7: MySQL Persistence Schema

**User Story:** As a developer, I want a well-defined database schema for radar news, so that all classified news and user read states are reliably stored and queryable.

#### Acceptance Criteria

1. THE Radar_News_API SHALL use a genesis_radar_news table with columns: id, title, source, source_url, severity, category, affected_assets (JSON), market_bias, impact_summary, discovery_score (nullable), is_discovery (boolean), telegram_sent (boolean), created_at, updated_at
2. THE Radar_News_API SHALL use a radar_news_user_reads pivot table with columns: id, user_id, radar_news_id, created_at to track per-user read state
3. THE Deduplication_Engine SHALL use a unique constraint or index on (title hash, source) to enforce deduplication at the database level

### Requirement 8: Worker Process Management

**User Story:** As a DevOps engineer, I want the radar news worker to run reliably as a managed process, so that it restarts automatically on failure and can be monitored.

#### Acceptance Criteria

1. THE Worker_Radar_News SHALL be configurable to run under PM2 or systemd with automatic restart on failure
2. THE Worker_Radar_News SHALL read configuration from environment variables: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY, MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT
3. THE Worker_Radar_News SHALL log all operations (collections, classifications, dispatches, errors) with timestamps to stdout/stderr for process manager capture
4. IF the Worker_Radar_News encounters a fatal error, THEN THE Worker_Radar_News SHALL exit with a non-zero code to trigger process manager restart

### Requirement 9: Telegram Message Formatting

**User Story:** As a trader receiving Telegram alerts, I want messages to be clearly formatted with severity indicators and relevant context, so that I can quickly assess the importance of each alert.

#### Acceptance Criteria

1. THE Telegram_Dispatcher SHALL format news alerts with: severity emoji (🔴 CRITICAL, 🟠 HIGH), bold title, impact summary, affected assets list, source link, and signature "-- @cripto.ico"
2. THE Telegram_Dispatcher SHALL format discovery alerts with: 🔍 emoji, token symbol, Discovery_Score, volume data, listing exchanges, context summary, and signature "-- @cripto.ico"
3. THE Telegram_Dispatcher SHALL use Telegram HTML parse mode for all messages
4. THE Telegram_Dispatcher SHALL truncate impact summaries exceeding 500 characters with "..." suffix
