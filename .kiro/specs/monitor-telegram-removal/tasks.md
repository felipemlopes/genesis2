# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Envio de Telegram ocorre para todo alerta processado
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists (enviar_telegram is called)
  - **Scoped PBT Approach**: Scope the property to concrete alert types: SPIKE_VOLUME, MOVIMENTO_BRUSCO, CVD_DIVERGENCIA, FUNDING_EXTREMO, OI_SPIKE, BOOK_IMBALANCE, LIQUIDATION_CASCADE, SPOT_FUTURES_DIVERGENCIA
  - Create test file `monitor/tests/test_telegram_removal.py`
  - Mock `enviar_telegram` and `gravar_banco` on the MonitorWorker instance
  - For each generated alert (any tipo, ativo, corretora), call `processar_alerta` on UNFIXED code
  - Assert that `enviar_telegram` is NOT called (expected behavior after fix)
  - Assert that `gravar_banco` is called with `enviado_telegram=False`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS because `enviar_telegram` IS called (this proves the bug exists)
  - Document counterexamples: e.g., "processar_alerta('BTCUSDT', 'SPIKE_VOLUME', ...) calls enviar_telegram"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Gravação no banco e deduplicação inalteradas
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: `processar_alerta('BTCUSDT', 'SPIKE_VOLUME', 'msg', 'BULLISH', 'ALTA', 'binance', 50000.0, 5.0)` calls `gravar_banco` with all fields correctly
  - Observe on UNFIXED code: duplicate alert within `intervalo_duplicatas` is ignored (no `gravar_banco` call)
  - Observe on UNFIXED code: `logger.info` is called with alert details
  - Write property-based test: for all valid alert inputs (random tipo, ativo, corretora, preco, variacao), `gravar_banco` receives correct alerta dict with all 10 fields (ativo, tipo, mensagem, direcao, urgencia, corretora, timeframe, preco_atual, variacao_pct, score)
  - Write property-based test: for duplicate alerts within interval, `gravar_banco` is NOT called
  - Write test: `logger.info` is called with alert type and ativo for non-duplicate alerts
  - Verify all tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix: Remove Telegram integration from monitor_worker.py

  - [x] 3.1 Implement the fix
    - Remove `TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')` constant
    - Remove `TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')` constant
    - Remove the entire `enviar_telegram` method (~25 lines)
    - In `processar_alerta`, replace `enviado_telegram = self.enviar_telegram(alerta)` + `self.gravar_banco(alerta, enviado_telegram)` with `self.gravar_banco(alerta, False)`
    - Keep `import requests` (used by other methods: funding rate, open interest, spot price)
    - _Bug_Condition: isBugCondition(X) where X.tipo IN all alert types — enviar_telegram is always called_
    - _Expected_Behavior: processar_alerta grava no banco com enviado_telegram=0, sem chamada ao Telegram_
    - _Preservation: Gravação de todos os campos do alerta, deduplicação, e logging permanecem inalterados_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Nenhum envio de Telegram ocorre
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (no enviar_telegram call, gravar_banco with False)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Gravação no banco e deduplicação inalteradas
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite for monitor module
  - Ensure all property-based tests and unit tests pass
  - Ask the user if questions arise
