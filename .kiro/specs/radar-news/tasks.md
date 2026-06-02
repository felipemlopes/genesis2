# Tasks: Radar News

## 1. Database Schema & Laravel Migration

- [x] 1.1 Create migration `create_genesis_radar_news_table` with all columns (title, title_hash, source, source_url, severity, category, affected_assets JSON, market_bias, impact_summary, discovery_score, is_discovery, telegram_sent, created_at, updated_at) and indexes (idx_created_at, idx_severity, UNIQUE idx_title_hash_source)
- [x] 1.2 Create migration `create_radar_news_user_reads_table` with columns (id, user_id, radar_news_id, created_at) and indexes (UNIQUE idx_unique_read on user_id+radar_news_id, foreign keys)
- [x] 1.3 Run migrations and verify tables exist

## 2. Laravel Model & Service

- [x] 2.1 Create `App\Models\RadarNews` model with `$table = 'genesis_radar_news'`, `$fillable`, `$casts` (affected_assets → array, is_discovery → boolean, telegram_sent → boolean), and `readByUsers()` relationship
- [x] 2.2 Create `App\Services\RadarNewsService` with `getUnreadForUser(int $userId): Collection` (entries from last 5 min not in user_reads) and `markAsRead(int $userId, array $newsIds): void`
- [x] 2.3 Create `App\Http\Controllers\Api\RadarNewsController` with `poll(Request $request): JsonResponse` method following AlertaController::poll() pattern
- [x] 2.4 Register route `GET /v1/radar-news/poll` inside auth:sanctum middleware group in `routes/api.php`

## 3. Worker Python — Core Infrastructure

- [x] 3.1 Create `monitor/worker_radar_news.py` with `RadarNewsWorker` class, signal handling, MySQL connection via pymysql, logging setup, main loop with 3-min RSS cycle and 20-min discovery cycle
- [x] 3.2 Implement environment variable loading (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GEMINI_API_KEY, MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT) with validation on startup
- [x] 3.3 Add PM2 ecosystem config entry for `worker_radar_news` in `ecosystem.config.cjs`

## 4. Worker Python — RSS Collector Module

- [x] 4.1 Implement `RSSCollector` class with `fetch_all_feeds()` method that fetches from configured RSS sources (Reuters, Bloomberg, CoinDesk, The Block, Decrypt, FT Markets) using `feedparser`
- [x] 4.2 Implement RSS entry parsing: extract title, publication date, source URL, content summary
- [x] 4.3 Implement fault tolerance: try/except per feed, log errors, continue to next feed
- [x] 4.4 Implement deduplication check: SHA-256 hash of lowercase title, query MySQL for existing (title_hash, source) within 24h

## 5. Worker Python — AI Classifier Module

- [x] 5.1 Implement `AIClassifier` class with `classify(entries: list) -> list` method that calls Gemini 2.5 Flash API with structured prompt
- [x] 5.2 Implement response parsing: extract severity, affected_assets, market_bias, impact_summary from Gemini JSON response (handle markdown code fences)
- [x] 5.3 Implement retry logic: 30s timeout, retry once after 5s on failure
- [x] 5.4 Implement `persist_classified(entry: dict)` to INSERT into genesis_radar_news with title_hash

## 6. Worker Python — Telegram Dispatcher Module

- [x] 6.1 Implement `TelegramDispatcher` class with `send_news_alert(entry)` and `send_discovery_alert(entry)` methods using Telegram Bot API (HTML parse_mode)
- [x] 6.2 Implement news alert formatting: severity emoji (🔴/🟠), bold title, impact summary, affected assets, source link, signature "-- @cripto.ico"
- [x] 6.3 Implement discovery alert formatting: 🔍 emoji, token symbol, score, volume, exchanges, context, signature
- [x] 6.4 Implement dispatch decision logic: CRITICAL → immediate, HIGH → 3-min delay (threading.Timer), MEDIUM/LOW → skip
- [x] 6.5 Implement retry logic: on Telegram API error, retry once after 10s
- [x] 6.6 Implement impact summary truncation: if > 500 chars, truncate + "..."

## 7. Worker Python — Discovery Radar Module

- [x] 7.1 Implement `DiscoveryRadar` class with `run_discovery_cycle()` method
- [x] 7.2 Implement CoinGecko trending API fetch and CMC top gainers fetch
- [x] 7.3 Implement filtering pipeline: volume > $5M, listed on (Binance/Bybit/OKX/Coinbase), NOT in monitored 70 tokens list
- [x] 7.4 Implement multi-source confirmation check (at least 2 sources within 2h)
- [x] 7.5 Implement discovery scoring via Gemini (score 1-10) and notification routing (>=7 Telegram, 5-6 poll only, <5 log only)
- [x] 7.6 Implement 6-hour suppression window per token (check last discovery alert timestamp in DB)

## 8. Frontend — useRadarNewsAlerts Hook

- [x] 8.1 Create `hooks/useRadarNewsAlerts.ts` with singleton polling pattern (module-level pollInterval, pollListeners, lastNewsId, startPolling/stopPolling/subscribePolling)
- [x] 8.2 Implement poll function: GET `/v1/radar-news/poll` with Bearer token, 10-second interval
- [x] 8.3 Implement hook: `useRadarNewsAlerts()` returning `{ news, fecharNews }` with max 5 items and 15s auto-dismiss

## 9. Frontend — RadarNewsPopup Component

- [x] 9.1 Create `components/RadarNewsPopup.tsx` toast/popup component with severity badge, title, impact summary, affected assets tags, source link, dismiss button, auto-dismiss progress bar (15s)
- [x] 9.2 Integrate `useRadarNewsAlerts` hook into main app layout (same location as existing AlertaPopup)

## 10. Testing

- [x] 10.1 Write Python property tests (Hypothesis): deduplication, classification validation, dispatch decision, message formatting, discovery filtering, truncation
- [x] 10.2 Write Laravel feature tests: poll endpoint returns unread, marks as read, respects 10-item limit, correct JSON structure
- [x] 10.3 Write frontend tests (fast-check): popup state max 5, subscribe/unsubscribe lifecycle
