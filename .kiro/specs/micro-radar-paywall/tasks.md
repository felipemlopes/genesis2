# Tasks: Micro Radar Paywall

## Task 1: Database Migration

- [x] 1.1 Create Laravel migration to add columns `motivos` (JSON), `timeframes` (JSON), `expires_at` (TIMESTAMP), `revelado_por` (INT NULLABLE FK users), `revelado_em` (TIMESTAMP NULLABLE) to `genesis_alertas` table
- [x] 1.2 Run migration and verify columns exist with correct types

## Task 2: Python Worker — Populate New Fields

- [x] 2.1 Update `gravar_banco()` in `monitor_worker.py` to include `motivos` (JSON array of `{label, value}` objects from detection reasons), `timeframes` (JSON array of confirmed timeframe strings), and `expires_at` (created_at + 4h) in the INSERT statement
- [x] 2.2 Verify detection logic remains unmodified (no changes to anomaly detection algorithms)

## Task 3: Backend — Reveal Endpoint

- [x] 3.1 Create `POST /v1/alertas/{id}/reveal` route in `routes/api.php` (auth:sanctum middleware)
- [x] 3.2 Implement `reveal()` method in `AlertaController`: validate idempotency_key, check balance >= 50, debit 50 credits, set `revelado_por` and `revelado_em`, return alert data (ativo, corretora, preco_atual, timeframes, credits_remaining)
- [x] 3.3 Handle idempotency: if same idempotency_key already used for this alert+user, return existing reveal data without re-debiting

## Task 4: Backend — Refactor Poll Endpoint

- [x] 4.1 Refactor `AlertaController@poll` to conditionally include/exclude `ativo`, `corretora`, `preco_atual` based on whether `revelado_por` matches the authenticated user's ID
- [x] 4.2 Ensure poll always returns: `id`, `tipo`, `direcao`, `score`, `motivos`, `timeframes`, `urgencia`, `mensagem`, `criado_em`, `expires_at` for all alerts
- [x] 4.3 Limit poll response to alerts from the last 24 hours

## Task 5: Frontend — Update `useAlertas` Hook

- [x] 5.1 Update `AlertaGenesis` interface: make `ativo`, `corretora`, `preco_atual` optional; add required `motivos`, `timeframes`, `expires_at` fields; add optional `revelado` boolean
- [x] 5.2 Remove auto-dismiss timer (12s timeout) — cards persist in feed until displaced by newer alerts
- [x] 5.3 Remove `dispararAlertaTeste` and `limparAlertasTeste` functions (preview panel removed)
- [x] 5.4 Keep polling at 10s, keep max 5 alerts logic, maintain newest-first ordering

## Task 6: Frontend — Create `AlertCard` Component

- [x] 6.1 Create `components/AlertCard.tsx` displaying: score, tipo, direcao, motivos badges, active timeframes, timestamp
- [x] 6.2 Implement paywall state: hide ativo/corretora/preco_atual, show "Revelar e Analisar — 50 créditos" button
- [x] 6.3 Implement confluence badge: green (1 tf), yellow "CONFLUÊNCIA" (2 tf), orange "CONFLUÊNCIA FORTE" (3 tf), red pulsing "CONFLUÊNCIA MÁXIMA" (4+ tf)
- [x] 6.4 Implement expiration visual: reduced opacity + "EXPIRADO" badge when `expires_at < now`
- [x] 6.5 Implement reveal flow: on click → call `POST /v1/alertas/{id}/reveal` with idempotency_key → on success redirect to `/nova-analise?symbol={ativo}&exchange={corretora}&timeframe={timeframes[0]}&radar_id={id}`
- [x] 6.6 Handle error states: insufficient credits message, network error with retry

## Task 7: Frontend — Refactor `ConfluenceScore.tsx`

- [x] 7.1 Remove single-alert display logic (currentAlerta, handleAnalyze, 75 credits button)
- [x] 7.2 Add RadarFeed section: render up to 5 AlertCard components in vertical stack
- [x] 7.3 Implement idle state when no alerts: show radar animation + "Monitorando oportunidades..." message
- [x] 7.4 Adjust card layout/sizing to accommodate feed within the component's grid span

## Task 8: Frontend — Remove Floating Popups

- [x] 8.1 Delete `components/AlertaPopup.tsx` file
- [x] 8.2 Delete `components/OportunidadePopup.tsx` file (if exists)
- [x] 8.3 Remove all imports and renders of AlertaPopup/OportunidadePopup from layout components (AppLayout or parent pages)

## Task 9: Frontend — Redirect Reveal to `/dashboard` Route

- [x] 9.1 Update `AlertCard.tsx` redirect after reveal success to navigate to `/dashboard?symbol={ativo}&exchange={corretora}&timeframe={timeframes[0]}&radar_id={id}` instead of `/nova-analise`
- [x] 9.2 Ensure the existing `/dashboard` page (GenesisPage) reads `symbol`, `exchange`, `timeframe`, `radar_id` from URL query params and pre-fills the analysis form

## Task 10: Testing

- [ ] 10.1 Write property-based tests for poll endpoint field masking (Property 1 & 2) using PHPUnit data providers
- [ ] 10.2 Write property-based test for credit debit exactness (Property 4) 
- [ ] 10.3 Write property-based test for idempotency (Property 10)
- [ ] 10.4 Write property-based tests for confluence badge mapping (Property 6) using fast-check
- [ ] 10.5 Write property-based tests for expiration state (Property 7) using fast-check
- [ ] 10.6 Write property-based test for feed max-5 and ordering (Property 5) using fast-check
- [ ] 10.7 Write property-based test for redirect URL construction (Property 9) using fast-check
- [ ] 10.8 Write unit tests for edge cases: empty timeframes, idle state render, "50 créditos" label, network error retry
