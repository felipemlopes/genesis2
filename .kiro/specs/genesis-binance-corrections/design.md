# Genesis Binance Corrections — Bugfix Design

## Overview

25 bugs across the genesis-api trading analysis pipeline produce incorrect indicator calculations, distorted scores, geometrically invalid trade setups, and incomplete AI context. The fix strategy is surgical: apply targeted corrections to each service while preserving all existing behavior for non-buggy inputs. The corrections are well-defined with exact code replacements provided in the `correcoes/` directory.

## Glossary

- **Bug_Condition (C)**: Any input/state combination where the current code produces incorrect output (wrong EMA threshold, fake MACD signal, invalid stop/TP geometry, missing context data, etc.)
- **Property (P)**: The mathematically correct or architecturally complete behavior expected after the fix
- **Preservation**: All existing correct behaviors that must remain unchanged — valid EMA calculations, geometrically valid stops, neutral RSI scoring, existing routes and caching
- **TechnicalAnalysisService**: Service in `app/Services/TechnicalAnalysisService.php` that computes EMA, MACD, RSI, volume, and divergence indicators from raw candle data
- **ScoringService**: Service in `app/Services/ScoringService.php` that converts indicator values into directional scores (bullish/bearish points)
- **MotorExecucaoService**: Service in `app/Services/MotorExecucaoService.php` that calculates stop-loss and take-profit levels for trade execution
- **GeminiAnalysisService**: Service in `app/Services/GeminiAnalysisService.php` that orchestrates AI analysis by building context, prompts, and narratives via Gemini API
- **ContextBuilderService**: Service in `app/Services/ContextBuilderService.php` that constructs the unified technical reading string passed to Gemini
- **MacroController**: Controller in `app/Http/Controllers/Api/MacroController.php` that fetches macroeconomic and sentiment data via Gemini + Google Search

## Bug Details

### Bug Condition

The bugs manifest across 6 services when the trading analysis pipeline processes any symbol. The defects range from mathematical errors (fake MACD signal, wrong EMA threshold) to architectural omissions (missing parameters, missing methods, missing endpoints).

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AnalysisPipelineExecution
  OUTPUT: boolean

  // Indicator calculation bugs (1.1-1.6)
  RETURN (input.candleCount >= period + 1 AND input.candleCount < period + 10)
         OR input.macdSignal = input.macdLine * 0.9
         OR input.precoSubindo USES only 2-candle comparison
         OR input.emaFonteLabel = 'GRAFICO' WHEN source IS OCR
         OR input.rsiDivergenceThreshold IN [40, 60]
         OR input.volumeAnalysis IS NULL

  // Scoring bug (1.7)
         OR (input.rsi < 20 AND input.bullishPoints = 3)

  // Execution geometry bugs (1.8-1.10)
         OR (input.direction = 'LONG' AND input.stop >= input.entry)
         OR (input.direction = 'SHORT' AND input.stop <= input.entry)
         OR (input.direction = 'LONG' AND ANY(input.tps) <= input.entry)
         OR (input.direction = 'SHORT' AND ANY(input.tps) >= input.entry)

  // Context/prompt incompleteness bugs (1.11-1.17)
         OR input.contextBuilderCall MISSING [volume, wyckoff, elementosVisuais]
         OR input.buildPromptCall MISSING [macro, fearGreed, btcDominancia, wyckoff]
         OR input.promptBody MISSING [patterns, macro, sentiment, language_instructions]
         OR input.ocrExtraction MISSING [poc, hvn, lvn, exchange]
         OR input.ocrZonesOverlay IS FALSE
         OR input.gerarNarrativaCall MISSING [derivativos, elementosVisuais]
         OR input.narrativaReturn IS STRING (not array)

  // ContextBuilder architecture bugs (1.18-1.22)
         OR input.contextBuilder MISSING INDICADORES_CONHECIDOS
         OR input.contextBuilder MISSING interpretarIndicadorOCR()
         OR input.contextBuilder MISSING lerIndicadoresOCR()
         OR input.contextBuilder NOT PRODUCING 14 unified blocks
         OR input.contextBuilder INJECTS wrong macro percentages

  // MacroController bugs (1.23-1.25)
         OR input.macroGeneration NOT USING google_search_retrieval
         OR input.sentimentoEndpoint NOT EXISTS
         OR input.sentimentoRoute NOT EXISTS
END FUNCTION
```

### Examples

- **Bug 1.1**: PHAUSDT with 45 candles → EMA(21) requires 31 candles (period+10=31 threshold), returns null. Fixed: needs only 22 (period+1)
- **Bug 1.2**: MACD signal = 0.00045 * 0.9 = 0.000405 (fake). Fixed: real EMA9 of MACD series = 0.000387 (different crossover timing)
- **Bug 1.7**: RSI = 15 → assigns 3 pts bullish (same as RSI 72). Fixed: assigns 10 pts bullish + RSI_SOBREVENDA_EXTREMA flag
- **Bug 1.8**: PHAUSDT LONG entry=0.42, PDL=0.45 → stop=0.45 (above entry!). Fixed: stop = price - ATR*mult with hierarchy 'ATR_FORCADO'
- **Bug 1.10**: LONG entry=0.42, tp1=0.40 → impossible profit. Fixed: tp1 = entry * 1.06 = 0.4452

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- EMA calculations for coins with >= period + 10 candles produce identical results
- Stop-loss values that are already geometrically valid (stop < entry for LONG, stop > entry for SHORT) remain untouched
- Take-profit values already on correct side of entry remain untouched
- RSI scoring in neutral zone (45-55) continues assigning minimal balanced points
- MacroController.today() caching behavior and response structure unchanged
- MACD field names (macd, signal, histogram) unchanged — only values corrected
- EMA labels from calculated (non-OCR) sources remain unchanged
- Volume returning INDISPONIVEL when < 20 candles available

**Scope:**
All inputs where the bug conditions do NOT hold should produce identical results to the current implementation. The fixes are strictly additive (new methods, new parameters) or corrective (replacing wrong formulas with correct ones) — never altering logic paths that already work correctly.

## Hypothesized Root Cause

Based on the correction files and bug analysis:

1. **Mathematical Shortcuts (1.1, 1.2, 1.5)**: Developer used approximations instead of proper mathematical implementations — `period + 10` as safety margin instead of `period + 1`, `macdLine * 0.9` instead of real EMA9, thresholds 60/40 instead of canonical 70/30

2. **Incomplete Wiring (1.3, 1.4, 1.6, 1.11-1.17)**: Features were partially implemented — methods exist but parameters never connected, volume analysis never integrated, OCR labels hardcoded wrong, narrative call missing critical data

3. **Missing Geometric Validation (1.8-1.10)**: Stop/TP calculation trusts external data (PDL/PDH) without validating geometric consistency relative to entry direction

4. **Architectural Gaps (1.18-1.22)**: ContextBuilderService was a skeleton — no indicator dictionary, no OCR interpretation, no unified block structure

5. **Missing Features (1.23-1.25)**: MacroController lacked google_search_retrieval tool integration and the sentimento endpoint was never created

## Correctness Properties

Property 1: Bug Condition — EMA Threshold Accepts Valid Altcoins

_For any_ input where candle count is >= period + 1 but < period + 10, the fixed ema() function SHALL return a valid float EMA value instead of null.

**Validates: Requirements 2.1**

Property 2: Bug Condition — MACD Signal Is Real EMA9

_For any_ input with >= 35 candles, the fixed macd() function SHALL compute the signal line as a proper EMA9 of the MACD line series, producing histogram = macdLine - signal.

**Validates: Requirements 2.2**

Property 3: Bug Condition — Price Direction Uses EMA Slope

_For any_ input where EMA21 current and previous values are available, the fixed `preco_subindo` field SHALL reflect EMA21 slope (current > previous), not single-candle comparison.

**Validates: Requirements 2.3**

Property 4: Bug Condition — OCR Source Label Correct

_For any_ input where EMA data originates from OCR extraction, the fixed system SHALL label the source as 'OCR' not 'GRAFICO'.

**Validates: Requirements 2.4**

Property 5: Bug Condition — RSI Divergence Uses 70/30 Thresholds

_For any_ input where RSI divergence is detected, the fixed detectarDivergenciaRSI() SHALL use 70 (bearish) and 30 (bullish) thresholds to avoid false positives in neutral zones.

**Validates: Requirements 2.5**

Property 6: Bug Condition — Volume Analysis Computed

_For any_ input with >= 20 candles, the fixed calcular() method SHALL include a 'volume' key in the returned array containing tendencia, divergencia, ratio_atual, vol5, and vol20.

**Validates: Requirements 2.6**

Property 7: Bug Condition — RSI Scoring Scale Corrected

_For any_ input where RSI < 20, the fixed scoring SHALL assign 10 points bullish with RSI_SOBREVENDA_EXTREMA flag. The complete scale SHALL follow: <20→10pts, <30→8pts, <45→4pts, 45-55→1/1, ≤70→5pts, ≤80→7pts bearish, >80→10pts bearish.

**Validates: Requirements 2.7**

Property 8: Bug Condition — Stop Geometry Validated (LONG)

_For any_ LONG position where calculated stop >= entry price, the fixed calcularStopLong() SHALL force stop to `price - (ATR * multiplier)` with hierarchy 'ATR_FORCADO'.

**Validates: Requirements 2.8**

Property 9: Bug Condition — Stop Geometry Validated (SHORT)

_For any_ SHORT position where calculated stop <= entry price, the fixed calcularStopShort() SHALL force stop to `price + (ATR * multiplier)` with hierarchy 'ATR_FORCADO'.

**Validates: Requirements 2.9**

Property 10: Bug Condition — TP Geometry Validated

_For any_ position where TPs violate geometric constraints (LONG: TP <= entry; SHORT: TP >= entry), the fixed calcularTPs() SHALL apply fallback percentages ensuring correct ordering.

**Validates: Requirements 2.10**

Property 11: Bug Condition — Context Builder Receives Full Data

_For any_ analysis execution, the fixed contextBuilder.build() call SHALL pass volume, wyckoffResult, and elementosVisuais as parameters.

**Validates: Requirements 2.11, 2.18, 2.19, 2.20, 2.21, 2.22**

Property 12: Bug Condition — Prompt Contains Complete Data

_For any_ analysis execution, the fixed buildPrompt() SHALL receive and inject macro, fearGreed, btcDominancia, wyckoff, graphic patterns, and trader language instructions into the prompt body.

**Validates: Requirements 2.12, 2.13**

Property 13: Bug Condition — OCR Extracts Volume Profile

_For any_ chart image with visible Volume Profile, the fixed OCR extraction SHALL attempt to extract POC, HVN, LVN, and exchange fields, overlaying them onto calculated zones.

**Validates: Requirements 2.14, 2.15**

Property 14: Bug Condition — Narrative Returns Structured Array

_For any_ narrative generation call, the fixed gerarNarrativa() SHALL accept derivatives and visual elements, and SHALL return an array with 'analiseTecnica' and 'rationalScore' keys.

**Validates: Requirements 2.16, 2.17**

Property 15: Bug Condition — MacroController Uses Google Search

_For any_ macro generation, the fixed generateMacro() SHALL use google_search_retrieval tool and reference 4 economies (Fed, BCE, PBOC, BOJ). The sentimento endpoint SHALL exist with 1h cache.

**Validates: Requirements 2.23, 2.24, 2.25**

Property 16: Preservation — Valid EMA Calculations Unchanged

_For any_ input where candle count >= period + 10, the fixed ema() function SHALL produce the same result as the original function.

**Validates: Requirements 3.1**

Property 17: Preservation — Valid Stop/TP Geometry Unchanged

_For any_ input where stop is already geometrically valid (stop < entry for LONG, stop > entry for SHORT) and TPs are on correct side, the fixed functions SHALL produce identical results to the original.

**Validates: Requirements 3.2, 3.3, 3.4**

Property 18: Preservation — Neutral RSI Scoring Unchanged

_For any_ input where RSI is in neutral zone (45-55), the fixed scoring SHALL continue assigning minimal balanced points to both directions.

**Validates: Requirements 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `app/Services/TechnicalAnalysisService.php`

1. **EMA Threshold** (Bug 1.1): Replace `count($closes) < $period + 10` with `count($closes) < $period + 1` in `ema()` method
2. **MACD Signal** (Bug 1.2): Replace entire `macd()` method with real EMA9 computation over MACD series
3. **preco_subindo** (Bug 1.3): Replace 2-candle comparison with EMA21 slope check (current EMA21 > previous EMA21), fallback to candle comparison
4. **OCR Labels** (Bug 1.4): Replace `'GRAFICO'` with `'OCR'` in 3 locations where EMA data comes from OCR
5. **RSI Divergence** (Bug 1.5): Replace thresholds 60/40 with 70/30 in `detectarDivergenciaRSI()`
6. **Volume Analysis** (Bug 1.6): Add new `analisarVolume()` method and integrate into `calcular()` return array

---

**File**: `app/Services/ScoringService.php`

7. **RSI Scoring Scale** (Bug 1.7): Replace RSI scoring block (lines 46-57) with corrected progressive scale: <20→10pts bullish + flag, <30→8pts, <45→4pts, 45-55→1/1, ≤70→5pts, ≤80→7pts bearish + flag, >80→10pts bearish + flag

---

**File**: `app/Services/MotorExecucaoService.php`

8. **Stop LONG Validation** (Bug 1.8): Add geometric validation at end of `calcularStopLong()` — if stop >= entry, force ATR fallback
9. **Stop SHORT Validation** (Bug 1.9): Add geometric validation at end of `calcularStopShort()` — if stop <= entry, force ATR fallback
10. **TP Validation** (Bug 1.10): Add TP geometry validation at end of `calcularTPs()` — apply percentage fallbacks if TPs on wrong side

---

**File**: `app/Services/GeminiAnalysisService.php`

11. **contextBuilder.build() call** (Bug 1.11): Add volume, wyckoffResult, elementosVisuais parameters
12. **buildPrompt() call** (Bug 1.12): Add macro, fearGreedReal, btcDominanciaReal, wyckoffResult parameters
13. **buildPrompt() body** (Bug 1.13): Replace entire method with version that injects patterns, macro, sentiment, language instructions
14. **OCR extraction prompt** (Bug 1.14): Update OCR prompt to extract poc, hvn, lvn, exchange fields
15. **OCR zones overlay** (Bug 1.15): Add zone override logic after OCR parse
16. **gerarNarrativa() call** (Bug 1.16): Add derivativos, wyckoff, elementosVisuais parameters
17. **gerarNarrativa() return** (Bug 1.17): Replace entire method — returns array with analiseTecnica + rationalScore

---

**File**: `app/Services/ContextBuilderService.php`

18. **Complete Rewrite** (Bugs 1.18-1.22): Replace entire file with new implementation containing:
    - INDICADORES_CONHECIDOS constant (fibonacci, estocastico, order_blocks, fair_value_gap, vwap, bollinger_ocr, elliott_wave, ichimoku)
    - 14 unified context blocks via dedicated `ler*()` methods
    - `interpretarIndicadorOCR()` method for semantic OCR interpretation
    - `lerIndicadoresOCR()` for unified OCR pipeline
    - Correct macro data injection (raw values, not percentage confusion)

---

**File**: `app/Http/Controllers/Api/MacroController.php`

19. **google_search_retrieval** (Bug 1.23): Update generateMacro() to use google_search_retrieval tool and reference 4 economies
20. **sentimento endpoint** (Bug 1.24): Add new `sentimento()` method with symbol-specific search, 1h cache, max 300 chars

---

**File**: `routes/api.php`

21. **sentimento route** (Bug 1.25): Register `GET /macro/sentimento` → `MacroController@sentimento`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write unit tests that exercise each buggy code path with inputs known to trigger the defect. Run on unfixed code to observe failures.

**Test Cases**:
1. **EMA Threshold Test**: Call ema() with exactly period+2 candles — will return null on unfixed code
2. **MACD Signal Test**: Call macd() and compare signal to real EMA9 — will differ on unfixed code
3. **Stop Geometry LONG**: Call calcularStopLong() with PDL above entry — will return invalid stop on unfixed code
4. **Stop Geometry SHORT**: Call calcularStopShort() with stop below entry — will return invalid stop on unfixed code
5. **RSI Scoring Test**: Score RSI=15 — will get only 3 pts on unfixed code
6. **TP Geometry Test**: Generate TPs that fall below entry for LONG — will pass through on unfixed code

**Expected Counterexamples**:
- EMA returns null for valid altcoins with short history
- MACD signal differs from real EMA9 by variable amounts (not constant 0.9x)
- Stops placed on wrong side of entry for certain market conditions
- RSI extreme zones scored identically to moderate zones

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random candle arrays and verifies EMA outputs match for sufficient data
- It generates random stop/TP scenarios and verifies geometrically valid ones are unchanged
- It generates random RSI values in non-extreme zones and verifies scoring matches

**Test Plan**: Observe behavior on UNFIXED code first for valid inputs (sufficient candles, valid geometry, neutral RSI), then write property-based tests capturing that behavior.

**Test Cases**:
1. **EMA Preservation**: Generate random candle arrays with count >= period+10, verify ema() output identical before/after fix
2. **Stop Preservation**: Generate random stop values geometrically valid, verify calcularStopLong/Short output identical
3. **TP Preservation**: Generate random TPs on correct side of entry, verify calcularTPs output identical
4. **RSI Neutral Preservation**: Generate RSI values 45-55, verify scoring unchanged
5. **MACD Field Names**: Verify returned array keys remain 'macd', 'signal', 'histogram'

### Unit Tests

- Test ema() with boundary candle counts (period+1, period+2, period+9, period+10)
- Test macd() signal line against manually computed EMA9
- Test RSI scoring at each threshold boundary (19, 20, 29, 30, 44, 45, 55, 56, 70, 71, 80, 81)
- Test stop geometry validation for LONG/SHORT with edge cases
- Test TP fallback percentages when geometry is violated
- Test analisarVolume() with various candle configurations
- Test gerarNarrativa() returns array with correct keys
- Test ContextBuilderService.build() produces all 14 blocks
- Test MacroController routes respond correctly

### Property-Based Tests

- Generate random close arrays (20-500 candles) and verify EMA monotonicity properties
- Generate random price/stop combinations and verify geometric invariant: LONG stop < entry, SHORT stop > entry
- Generate random TP arrays and verify ordering invariant: LONG tp1 < tp2 < tp3 > entry, SHORT tp1 > tp2 > tp3 < entry
- Generate random RSI values [0-100] and verify scoring is monotonically correct (lower RSI = more bullish points)
- Generate random MACD series and verify signal is bounded by series min/max

### Integration Tests

- Test full analysis pipeline with a real symbol (mock API responses) — verify all 14 context blocks present
- Test MacroController.sentimento() endpoint returns valid JSON with caching
- Test that MotorExecucaoService produces geometrically valid setups for 10+ different market conditions
- Test GeminiAnalysisService.analyze() wires all parameters through context → prompt → narrative chain
