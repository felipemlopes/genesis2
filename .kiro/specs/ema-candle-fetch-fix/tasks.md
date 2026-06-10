# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Símbolos Sujos Causam Candles Vazios e EMAs Ausentes
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope to concrete failing symbols: `BINANCE:PHAUSDT.P`, `ETH/USDT`, `PHAUSDT.P`
  - Test that `BinanceService::getCandles('BINANCE:PHAUSDT.P', '1h', 500)` returns `[]` on unfixed code (isBugCondition returns true when symbol matches `/[:\/.]/` OR ends with `.P` OR ends with `PERP`)
  - Test that `ContextBuilderService::lerEstruturaEMAs(['ema21'=>null,'ema50'=>null,'ema200'=>null], 50000)` produces a section WITHOUT any `EMA21=`, `EMA50=`, `EMA200=` line (confirms silent discard bug 1.6)
  - Test that `TechnicalAnalysisService::calcular([], [])` returns `ema21 => null` even when caller has `ema_21` in `$elementosVisuais` (confirms ocrData never passed — bug 1.4)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — proves bugs 1.1, 1.2, 1.4, 1.6 exist)
  - Document counterexamples found (e.g. `getCandles('BINANCE:PHAUSDT.P', ...)` propagates exception or returns `[]`; `lerEstruturaEMAs` outputs `ESTRUTURA DE PRECO vs EMAs:\nEstrutura: INDEFINIDA` with no EMA lines)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.4, 1.6_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Símbolos Limpos Não São Afetados
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `sanitizeSymbol('BTCUSDT')` on unfixed code (method does not exist yet — observe that `BTCUSDT` passes through `getCandles` unchanged and candles are returned normally)
  - Observe: `sanitizeSymbol('1000PEPEUSDT')` — numeric prefix must not be removed
  - Observe: `calcular($candles, [])` with valid candles returns `ema21 IS NOT null`, `ema50 IS NOT null`, `ema200 IS NOT null`
  - Observe: `lerEstruturaEMAs($ind, $preco)` with valid EMAs produces lines like `EMA21=XXXX (subindo) preco acima`
  - Write property-based test: for all symbols matching `/^[A-Z0-9]+$/` (isBugCondition = false), a future `sanitizeSymbol()` must be idempotent (`sanitizeSymbol(s) === s`) — from Preservation Requirements in design
  - Write property-based test: for any symbol already clean, `getCandlesResiliente` (once implemented) must return same data as `getCandles` with same symbol
  - Verify tests PASS on UNFIXED code (baseline confirmed)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix — EMA Candle Fetch Fix (sanitização de símbolo, fallback Futures→Spot, limit 1500, INDISPONIVEL explícito)

  - [x] 3.1 Implementar `sanitizeSymbol()` e `getCandlesResiliente()` em BinanceService.php
    - Adicionar `public function sanitizeSymbol(string $symbol): string` que: converte para uppercase+trim, remove prefixo antes de `:` (ex: `BINANCE:PHAUSDT` → `PHAUSDT`), remove sufixo `.P` via `/\.P$/`, remove sufixo `PERP` via `/PERP$/`, remove qualquer caractere não alfanumérico via `preg_replace('/[^A-Z0-9]/', '', $s)` — resultado: apenas `[A-Z0-9]+`
    - Adicionar `public function getCandlesResiliente(string $symbol, string $interval, int $limit = 1500): array` que: aplica `sanitizeSymbol()`, tenta `/fapi/v1/klines` (Futures), se vazio/falha tenta `https://api.binance.com/api/v3/klines` (Spot), se ambos falham loga com símbolo sanitizado e retorna `[]` sem exceção
    - Aplicar `$symbol = $this->sanitizeSymbol($symbol);` como primeira linha de: `getCandles()`, `getFundingRate()`, `getOpenInterest()`, `getLongShortRatio()`, `getAggTrades()`, `getCurrentPrice()`
    - _Bug_Condition: isBugCondition(symbol) where symbol MATCHES /[:\/.]/  OR ENDS_WITH '.P' OR ENDS_WITH 'PERP'_
    - _Expected_Behavior: sanitizeSymbol retorna apenas [A-Z0-9]+; getCandlesResiliente retorna array sem lançar exceção_
    - _Preservation: símbolos já em formato [A-Z0-9]+ passam por sanitizeSymbol sem alteração (idempotência)_
    - _Requirements: 2.1, 2.2, 2.3, 2.7, 3.1, 3.4, 3.5_

  - [x] 3.2 Atualizar GeminiAnalysisService.php para usar `getCandlesResiliente` e passar `$ocrData`
    - Linha ~29: substituir `$this->binance->getCandles($symbol, $timeframe, 500)` por `$this->binance->getCandlesResiliente($symbol, $timeframe, 1500)`
    - Após extração de `$elementosVisuais` (bloco 3.1), montar `$ocrData` e passar para `calcular()`:
      ```php
      $ocrData = array_filter([
          'ema_21'  => $elementosVisuais['ema_21']  ?? null,
          'ema_50'  => $elementosVisuais['ema_50']  ?? null,
          'ema_200' => $elementosVisuais['ema_200'] ?? null,
      ], fn($v) => $v !== null);
      $indicadores = $this->techAnalysis->calcular($candles, $ocrData);
      ```
    - _Bug_Condition: ocrData nunca passado → fallback OCR em TechnicalAnalysisService nunca ativado (bug 1.4); limit=500 insuficiente para EMA200 (bug 1.5)_
    - _Expected_Behavior: calcular() recebe $ocrData com ema_21/ema_50/ema_200 quando disponíveis via OCR; 1500 candles garantem convergência confiável_
    - _Preservation: fluxo completo (candles → indicadores → score → contexto → Gemini) continua no mesmo formato_
    - _Requirements: 2.4, 2.5, 3.3, 3.6_

  - [x] 3.3 Corrigir `lerEstruturaEMAs()` em ContextBuilderService.php para exibir INDISPONIVEL explícito
    - Substituir `if (empty($ind[$k])) continue;` pela lógica:
      ```php
      $v = $ind[$k] ?? null;
      if ($v === null || !is_numeric($v) || (float) $v <= 0) {
          $emas[] = "{$label}=INDISPONIVEL";
          continue;
      }
      $v = (float) $v;
      ```
    - _Bug_Condition: empty($ind[$k]) descarta silenciosamente EMA nula sem registrar INDISPONIVEL (bug 1.6)_
    - _Expected_Behavior: contexto sempre contém EMA21=, EMA50=, EMA200= com valor ou INDISPONIVEL_
    - _Preservation: EMAs válidas continuam sendo exibidas com valor, direção e relação ao preço_
    - _Requirements: 2.6, 3.2, 3.6_

  - [ ] 3.4 Verificar que o teste de bug condition agora passa
    - **Property 1: Expected Behavior** - Símbolos Inválidos São Sanitizados e Candles Retornados
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (isBugCondition inputs → candles retornados, EMAs calculadas ou INDISPONIVEL explícito)
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs 1.1, 1.2, 1.4, 1.6 are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.6_

  - [ ] 3.5 Verificar que os testes de preservação continuam passando
    - **Property 2: Preservation** - Símbolos Limpos Não São Afetados
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — BTCUSDT, 1000PEPEUSDT, EMAs válidas continuam funcionando)
    - Confirm all preservation tests still pass after fix
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Checkpoint — Ensure all tests pass
  - Rodar suite PHPUnit completa (`php artisan test` ou `vendor/bin/phpunit`)
  - Verificar que Property 1 e Property 2 passam
  - Verificar que nenhum teste existente foi quebrado
  - Confirmar nos logs do Laravel que `DEBUG_TECH_ANALYSIS` exibe `ema21_fonte: "API"` (ou `"OCR"`) em vez de `"INDISPONIVEL"` para altcoins com símbolo sujo
  - Confirmar no contexto gerado que `EMA21=`, `EMA50=`, `EMA200=` aparecem com valor ou com `INDISPONIVEL` explícito (nunca omitidas)
  - Perguntar ao usuário se houver dúvidas antes de encerrar
