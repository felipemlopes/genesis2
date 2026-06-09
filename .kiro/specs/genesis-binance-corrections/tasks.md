# Implementation Tasks

## Task 1: Fix TechnicalAnalysisService (Bugs 1.1-1.6)

- [x] 1.1 Fix EMA threshold from `period + 10` to `period + 1` in `ema()` method
- [x] 1.2 Replace `macd()` method with real EMA9 signal line computation
- [x] 1.3 Replace `preco_subindo` logic with EMA21 slope check (fallback to 2-candle)
- [x] 1.4 Replace OCR source labels from 'GRAFICO' to 'OCR' in 3 locations
- [x] 1.5 Fix `detectarDivergenciaRSI()` thresholds from 60/40 to 70/30
- [x] 1.6 Add `analisarVolume()` method and integrate into `calcular()` return array

## Task 2: Fix ScoringService (Bug 1.7)

- [x] 2.1 Replace RSI scoring block with corrected progressive scale (<20→10pts, <30→8pts, <45→4pts, 45-55→1/1, ≤70→5pts, ≤80→7pts bearish, >80→10pts bearish) and flags

## Task 3: Fix MotorExecucaoService (Bugs 1.8-1.10)

- [x] 3.1 Add geometric validation to `calcularStopLong()` — force ATR fallback when stop >= entry
- [x] 3.2 Add geometric validation to `calcularStopShort()` — force ATR fallback when stop <= entry
- [x] 3.3 Add TP geometry validation to `calcularTPs()` — apply percentage fallbacks for invalid ordering

## Task 4: Fix GeminiAnalysisService (Bugs 1.11-1.17)

- [x] 4.1 Update `contextBuilder->build()` call to pass volume, wyckoffResult, elementosVisuais
- [x] 4.2 Update `buildPrompt()` call to pass macro, fearGreedReal, btcDominanciaReal, wyckoffResult
- [x] 4.3 Replace `buildPrompt()` method with full version (patterns, macro, sentiment, language instructions)
- [x] 4.4 Update OCR extraction prompt to extract poc, hvn, lvn, exchange fields
- [x] 4.5 Add OCR zones overlay logic (POC/HVN/LVN override calculated zones)
- [x] 4.6 Update `gerarNarrativa()` call to pass derivativos, wyckoff, elementosVisuais
- [x] 4.7 Replace `gerarNarrativa()` method — returns array with analiseTecnica + rationalScore

## Task 5: Rewrite ContextBuilderService (Bugs 1.18-1.22)

- [x] 5.1 Replace entire ContextBuilderService.php with new implementation containing INDICADORES_CONHECIDOS, 14 unified blocks, interpretarIndicadorOCR(), lerIndicadoresOCR(), and correct macro injection

## Task 6: Fix MacroController and Route (Bugs 1.23-1.25)

- [x] 6.1 Replace MacroController with version using google_search_retrieval and 4-economy references
- [x] 6.2 Add `sentimento()` endpoint (symbol-specific, 1h cache, max 300 chars)
- [x] 6.3 Register `GET /macro/sentimento` route in routes/api.php
