# Bugfix Requirements Document

## Introduction

25 corrections across 7 PHP files in the genesis-api Laravel backend. The bugs affect the entire trading analysis pipeline — from indicator calculations (TechnicalAnalysisService), scoring (ScoringService), trade execution (MotorExecucaoService), AI prompt construction (GeminiAnalysisService), context building (ContextBuilderService), and macro/sentiment data (MacroController). Each bug introduces incorrect signals, distorted scores, geometrically invalid trade setups, or blind AI analysis that never receives critical data.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an altcoin has fewer than `period + 10` candles but more than `period + 1` THEN the system returns null for EMA, rejecting valid altcoins with shorter history

1.2 WHEN calculating MACD signal line THEN the system uses `macdLine * 0.9` (a fake multiplier) instead of a real EMA9 of the MACD series, distorting histogram and crossover signals for all pairs

1.3 WHEN determining `preco_subindo` THEN the system compares only 2 consecutive candles — one green candle after 10 red marks price as "rising"

1.4 WHEN EMA data comes from OCR source THEN the system labels it as 'GRAFICO' instead of 'OCR', misrepresenting data provenance

1.5 WHEN detecting RSI divergence THEN the system uses thresholds 60/40 (too loose), generating false positive divergence signals in non-extreme zones

1.6 WHEN calculating indicators THEN the system never computes volume as an independent indicator — volume analysis never reaches Gemini, making AI blind to volume trends and divergences

1.7 WHEN RSI is in extreme oversold (< 20) THEN the scoring system assigns only 3 points bullish (same as moderate overbought 70+), inverting the scale and distorting direction for all pairs

1.8 WHEN calculating stop for LONG position THEN the system uses PDL above the entry price as stop without geometric validation — stop can be above entry (e.g., PHAUSDT)

1.9 WHEN calculating stop for SHORT position THEN the system allows stop below entry price, which is geometrically invalid for a short

1.10 WHEN calculating take-profit levels THEN the system allows TPs below entry in LONG or above entry in SHORT, creating impossible profit targets

1.11 WHEN calling contextBuilder.build() THEN the system does not pass volume, wyckoffResult, or elementosVisuais parameters — context is incomplete

1.12 WHEN calling buildPrompt() THEN the system does not pass macro, fearGreed, btcDominancia, or wyckoffResult — prompt lacks macro/sentiment data

1.13 WHEN constructing the analysis prompt THEN the system does not inject graphic patterns, trader language instructions, or macro/sentiment data into the prompt body

1.14 WHEN OCR extracts chart elements THEN the system does not extract POC/HVN/LVN/exchange from Volume Profile — Motor calculates TPs without real LuxAlgo anchoring

1.15 WHEN OCR zones are parsed THEN the system does not overlay POC/HVN/LVN onto calculated zones — LuxAlgo precision is lost

1.16 WHEN calling gerarNarrativa() THEN the system does not pass derivatives or visual elements — narrative is blind to funding, CVD, L/S ratio, and graphic patterns

1.17 WHEN gerarNarrativa() returns THEN the system returns a single narrative string instead of structured array with 'analiseTecnica' and 'rationalScore' as separate fields

1.18 WHEN ContextBuilderService interprets OCR indicators THEN there is no INDICADORES_CONHECIDOS dictionary — indicators cannot be semantically interpreted

1.19 WHEN ContextBuilderService encounters an OCR indicator THEN there is no interpretarIndicadorOCR() method — raw values pass through without interpretation

1.20 WHEN ContextBuilderService reads OCR data THEN there is no lerIndicadoresOCR() method — no unified OCR indicator reading pipeline exists

1.21 WHEN ContextBuilderService.build() executes THEN it does not produce 14 unified context blocks and injects wrong macro/sentiment percentages into the context string

1.22 WHEN ContextBuilderService injects macro data THEN lines inject 'Macro: X%' and 'Sentimento: X%' as percentage values, confusing Gemini about the score architecture

1.23 WHEN MacroController.generateMacro() executes THEN it uses a wrong Gemini call without google_search_retrieval tool and does not reference the 4 key economies (Fed, BCE, PBOC, BOJ)

1.24 WHEN requesting per-symbol market sentiment THEN there is no sentimento() endpoint — the feature does not exist

1.25 WHEN accessing GET /macro/sentimento THEN there is no route registered in routes/api.php

### Expected Behavior (Correct)

2.1 WHEN an altcoin has at least `period + 1` candles THEN the system SHALL calculate EMA normally (minimum mathematical requirement)

2.2 WHEN calculating MACD signal line THEN the system SHALL compute a real EMA9 over the MACD line series using proper exponential smoothing

2.3 WHEN determining `preco_subindo` THEN the system SHALL use EMA21 slope (current EMA21 > previous EMA21) as primary signal, falling back to 2-candle comparison only when EMA21 is unavailable

2.4 WHEN EMA data comes from OCR source THEN the system SHALL label it as 'OCR'

2.5 WHEN detecting RSI divergence THEN the system SHALL use thresholds 70/30 (overbought/oversold zones) to avoid false positives in neutral territory

2.6 WHEN calculating indicators THEN the system SHALL compute volume analysis (tendencia, divergencia, ratio_atual, vol5, vol20) as an independent indicator and include it in the returned data for Gemini consumption

2.7 WHEN RSI is in extreme oversold (< 20) THEN the scoring system SHALL assign 10 points bullish with RSI_SOBREVENDA_EXTREMA flag; the full scale SHALL be: <20→10pts, <30→8pts, <45→4pts, 45-55→1/1, ≤70→5pts bullish, ≤80→7pts bearish, >80→10pts bearish

2.8 WHEN calculated stop for LONG is >= entry price THEN the system SHALL force stop to `price - (ATR * multiplier)` with hierarchy 'ATR_FORCADO'

2.9 WHEN calculated stop for SHORT is <= entry price THEN the system SHALL force stop to `price + (ATR * multiplier)` with hierarchy 'ATR_FORCADO'

2.10 WHEN calculating take-profit levels THEN the system SHALL validate that in LONG all TPs > entry (fallback: tp1=entry*1.06, tp2=tp1*1.04, tp3=tp2*1.08) and in SHORT all TPs < entry (fallback: tp1=entry*0.94, tp2=tp1*0.96, tp3=tp2*0.92)

2.11 WHEN calling contextBuilder.build() THEN the system SHALL pass volume, wyckoffResult, and elementosVisuais as parameters

2.12 WHEN calling buildPrompt() THEN the system SHALL pass macro, fearGreedReal, btcDominanciaReal, and wyckoffResult as parameters

2.13 WHEN constructing the analysis prompt THEN the system SHALL inject graphic patterns from OCR, trader language instructions, Wyckoff phase, macro data (VIX/DXY/SP500), Fear&Greed index, and BTC dominance into the prompt body

2.14 WHEN OCR extracts chart elements THEN the system SHALL extract POC (float or null), HVN (array of floats), LVN (array of floats), and exchange identification from the Volume Profile visual

2.15 WHEN OCR zones are parsed THEN the system SHALL overlay POC/HVN/LVN values onto the calculated zones array (LuxAlgo precision overrides calculated values)

2.16 WHEN calling gerarNarrativa() THEN the system SHALL pass derivatives, wyckoff, and elementosVisuais — narrative SHALL reference funding rate, CVD, L/S ratio, and graphic patterns

2.17 WHEN gerarNarrativa() returns THEN the system SHALL return an array with keys 'analiseTecnica' (full trader analysis) and 'rationalScore' (score justification) as separate fields

2.18 WHEN ContextBuilderService is loaded THEN it SHALL contain a const INDICADORES_CONHECIDOS with interpretation dictionaries for fibonacci, estocastico, order_blocks, fair_value_gap, vwap, bollinger_ocr, elliott_wave, and ichimoku

2.19 WHEN ContextBuilderService encounters an OCR indicator THEN it SHALL call interpretarIndicadorOCR() to semantically interpret the indicator using the INDICADORES_CONHECIDOS dictionary

2.20 WHEN ContextBuilderService reads OCR data THEN it SHALL use lerIndicadoresOCR() to unify reading of fibonacci, supports, resistances, and visible indicators from elementosVisuais

2.21 WHEN ContextBuilderService.build() executes THEN it SHALL produce 14 unified blocks (EMAs, RSI, ADX, MACD, Volume, VRVP, Bollinger, Derivativos, Wyckoff, OCR indicators, Graphic patterns, Zones, Score, Macro) with correct data injection

2.22 WHEN ContextBuilderService injects macro data THEN it SHALL inject raw VIX/DXY/SP500 values with percentage change notation, not confusing percentage values with score percentages

2.23 WHEN MacroController.generateMacro() executes THEN it SHALL use google_search_retrieval tool and reference 4 economies: EUA (Fed), BCE (Eurozona), China (PBOC), Japao (BOJ)

2.24 WHEN requesting per-symbol market sentiment THEN there SHALL be a sentimento() endpoint that accepts ?symbol=SYMBOL, uses google_search_retrieval, caches for 1 hour, and returns max 300 chars

2.25 WHEN accessing GET /macro/sentimento THEN the route SHALL be registered in routes/api.php pointing to MacroController@sentimento

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an altcoin has enough candle history (>= period + 10) THEN the system SHALL CONTINUE TO calculate EMA identically to current behavior

3.2 WHEN quantity is a positive integer in LONG with stop geometrically valid (stop < entry) THEN the system SHALL CONTINUE TO use the calculated stop without fallback

3.3 WHEN quantity is a positive integer in SHORT with stop geometrically valid (stop > entry) THEN the system SHALL CONTINUE TO use the calculated stop without fallback

3.4 WHEN all TPs are already on the correct side (TPs > entry for LONG, TPs < entry for SHORT) THEN the system SHALL CONTINUE TO use the calculated TPs without modification

3.5 WHEN RSI is in neutral zone (45-55) THEN the system SHALL CONTINUE TO assign minimal points to both directions (no strong bias)

3.6 WHEN RSI is in healthy bullish zone (55-70) THEN the system SHALL CONTINUE TO assign moderate bullish points

3.7 WHEN MacroController.today() is called THEN the system SHALL CONTINUE TO cache the result until end of day and return date + content structure

3.8 WHEN MACD receives sufficient candle data (>= 35 candles) THEN the system SHALL CONTINUE TO return macd, signal, and histogram values (field names unchanged)

3.9 WHEN EMA data comes from calculated source (not OCR) THEN the system SHALL CONTINUE TO label it with the appropriate non-OCR source identifier

3.10 WHEN volume data is unavailable (< 20 candles) THEN the system SHALL CONTINUE TO return a safe default indicating INDISPONIVEL

---

## Bug Condition Derivation

```pascal
FUNCTION isBugCondition_MACD(X)
  INPUT: X of type MACDCalculation
  OUTPUT: boolean
  RETURN X.signalLine = X.macdLine * 0.9 (not real EMA9 of MACD series)
END FUNCTION

FUNCTION isBugCondition_RSIScoring(X)
  INPUT: X of type RSIScore
  OUTPUT: boolean
  RETURN X.rsi < 20 AND X.bullishPoints = 3
END FUNCTION

FUNCTION isBugCondition_StopLong(X)
  INPUT: X of type StopCalculation
  OUTPUT: boolean
  RETURN X.direction = 'LONG' AND X.stop >= X.entryPrice
END FUNCTION

FUNCTION isBugCondition_StopShort(X)
  INPUT: X of type StopCalculation
  OUTPUT: boolean
  RETURN X.direction = 'SHORT' AND X.stop <= X.entryPrice
END FUNCTION

FUNCTION isBugCondition_TPLong(X)
  INPUT: X of type TPCalculation
  OUTPUT: boolean
  RETURN X.direction = 'LONG' AND (X.tp1 <= X.entry OR X.tp2 <= X.tp1 OR X.tp3 <= X.tp2)
END FUNCTION

FUNCTION isBugCondition_Volume(X)
  INPUT: X of type IndicatorSet
  OUTPUT: boolean
  RETURN X.volume IS NULL OR X.volume NOT IN indicatorResults
END FUNCTION

FUNCTION isBugCondition_OCR_POC(X)
  INPUT: X of type OCRExtraction
  OUTPUT: boolean
  RETURN X.poc IS NULL AND X.hvn IS EMPTY AND X.lvn IS EMPTY
END FUNCTION

FUNCTION isBugCondition_Narrativa(X)
  INPUT: X of type NarrativaCall
  OUTPUT: boolean
  RETURN X.derivativos NOT PASSED OR X.elementosVisuais NOT PASSED
END FUNCTION

FUNCTION isBugCondition_ContextBuilder(X)
  INPUT: X of type ContextBuild
  OUTPUT: boolean
  RETURN X.hasIndicatorDictionary = false OR X.hasInterpretMethod = false
END FUNCTION

FUNCTION isBugCondition_MacroSearch(X)
  INPUT: X of type MacroGeneration
  OUTPUT: boolean
  RETURN X.usesGoogleSearchRetrieval = false
END FUNCTION
```

```pascal
// Property: Fix Checking — MACD Signal
FOR ALL X WHERE isBugCondition_MACD(X) DO
  result ← macd'(X.closes)
  ASSERT result.signal = EMA9(macdSeries) AND result.histogram = result.macd - result.signal
END FOR

// Property: Fix Checking — RSI Scoring
FOR ALL X WHERE isBugCondition_RSIScoring(X) DO
  result ← scoreRSI'(X.rsi)
  ASSERT result.bullishPoints = 10 AND 'RSI_SOBREVENDA_EXTREMA' IN result.flags
END FOR

// Property: Fix Checking — Stop Long
FOR ALL X WHERE isBugCondition_StopLong(X) DO
  result ← calcularStopLong'(X)
  ASSERT result.stop < result.entryPrice AND result.hierarquia = 'ATR_FORCADO'
END FOR

// Property: Fix Checking — Stop Short
FOR ALL X WHERE isBugCondition_StopShort(X) DO
  result ← calcularStopShort'(X)
  ASSERT result.stop > result.entryPrice AND result.hierarquia = 'ATR_FORCADO'
END FOR

// Property: Fix Checking — TPs
FOR ALL X WHERE isBugCondition_TPLong(X) DO
  result ← calcularTPs'(X)
  ASSERT result.tp1 > X.entry AND result.tp2 > result.tp1 AND result.tp3 > result.tp2
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_StopLong(X) DO
  ASSERT calcularStopLong(X) = calcularStopLong'(X)
END FOR

FOR ALL X WHERE NOT isBugCondition_RSIScoring(X) AND X.rsi >= 45 AND X.rsi <= 55 DO
  ASSERT scoreRSI(X) ≈ scoreRSI'(X)  // neutral zone remains balanced
END FOR
```
