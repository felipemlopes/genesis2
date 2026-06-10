# Bugfix Requirements Document

## Introduction

As EMAs (EMA21, EMA50, EMA200) das altcoins aparecem como INDISPONIVEL no contexto enviado ao Gemini, comprometendo a qualidade da análise técnica. O BTC funciona corretamente porque seu símbolo (`BTCUSDT`) já chega limpo. Para altcoins, símbolos como `BINANCE:PHAUSDT.P`, `ETH/USDT` ou `PHAUSDT.P` chegam sujos ao `BinanceService.getCandles()`, que os repassa diretamente à API Binance Futures sem sanitização. A Binance retorna "Invalid symbol" → exceção → `$candles = []` → `TechnicalAnalysisService.calcular()` não consegue calcular as EMAs → `ContextBuilderService.lerEstruturaEMAs()` descarta silenciosamente os valores nulos → seção de EMAs fica ausente no contexto do Gemini.

Além disso, o limite de 500 candles é insuficiente para calcular a EMA200 em certos cenários (o cálculo converge melhor com ~891+ candles), e o fallback OCR em `TechnicalAnalysisService.calcular()` nunca é ativado porque `ocrData` jamais é passado na chamada principal do `GeminiAnalysisService`.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN o símbolo recebido pelo controller contém prefixos de exchange, sufixos de contrato perpétuo ou separadores inválidos (ex: `BINANCE:PHAUSDT.P`, `PHAUSDT.P`, `ETH/USDT`) THEN o sistema passa o símbolo cru para `BinanceService.getCandles()` sem nenhuma sanitização

1.2 WHEN `BinanceService.getCandles()` envia um símbolo inválido à API Binance Futures THEN o sistema recebe erro "Invalid symbol", lança exceção, e `$candles` fica como array vazio

1.3 WHEN `$candles` está vazio no `GeminiAnalysisService` THEN o sistema chama `TechnicalAnalysisService.calcular()` com array vazio, resultando em `ema21 = null`, `ema50 = null`, `ema200 = null`

1.4 WHEN `TechnicalAnalysisService.calcular()` é chamado sem o argumento `$ocrData` THEN o sistema nunca usa os valores de EMA lidos via OCR da imagem como fallback, mesmo que estejam disponíveis

1.5 WHEN `BinanceService.getCandles()` é chamado com `limit=500` para cálculo de EMA200 THEN o sistema pode retornar candles insuficientes para convergência confiável da EMA200 em timeframes maiores

1.6 WHEN `ContextBuilderService.lerEstruturaEMAs()` recebe `$ind['ema21']`, `$ind['ema50']` ou `$ind['ema200']` como `null` ou `0` THEN o sistema descarta silenciosamente cada EMA com `if (empty($ind[$k])) continue`, sem registrar "INDISPONIVEL" na seção de EMAs

1.7 WHEN os demais métodos do `BinanceService` (`getFundingRate`, `getOpenInterest`, `getLongShortRatio`, `getAggTrades`, `getCurrentPrice`) recebem um símbolo sujo THEN o sistema envia o símbolo inválido à API Binance, podendo causar falhas em toda a cadeia de derivativos

### Expected Behavior (Correct)

2.1 WHEN o símbolo recebido contém prefixos de exchange, sufixos de contrato perpétuo ou separadores inválidos THEN o sistema SHALL sanitizar o símbolo (removendo `BINANCE:`, `BYBIT:`, `.P`, `PERP`, `/`, espaços e caracteres inválidos) antes de qualquer chamada à API Binance

2.2 WHEN `BinanceService.getCandles()` recebe o símbolo sanitizado e a chamada à API Binance Futures falha ou retorna array vazio THEN o sistema SHALL tentar automaticamente a API Binance Spot (`/api/v3/klines`) como fallback antes de retornar array vazio

2.3 WHEN `$candles` retorna vazio mesmo após tentativa Futures + Spot THEN o sistema SHALL logar o erro com símbolo e motivo, e retornar array vazio sem lançar exceção para a camada superior

2.4 WHEN `GeminiAnalysisService` chama `TechnicalAnalysisService.calcular()` e `$elementosVisuais` já foram extraídos via OCR THEN o sistema SHALL passar `$elementosVisuais` como `$ocrData` para que os valores de EMA lidos da imagem atuem como fallback quando os candles falharem

2.5 WHEN `GeminiAnalysisService` busca candles para cálculo de indicadores técnicos THEN o sistema SHALL solicitar pelo menos 1500 candles para garantir convergência confiável da EMA200

2.6 WHEN `ContextBuilderService.lerEstruturaEMAs()` processa uma EMA cujo valor é `null`, `0` ou ausente THEN o sistema SHALL registrar explicitamente `[LABEL]=INDISPONIVEL` no contexto enviado ao Gemini, em vez de omitir a linha silenciosamente

2.7 WHEN os demais métodos do `BinanceService` (`getFundingRate`, `getOpenInterest`, `getLongShortRatio`, `getAggTrades`, `getCurrentPrice`) recebem um símbolo THEN o sistema SHALL aplicar `sanitizeSymbol()` antes de enviar o símbolo à API Binance

### Unchanged Behavior (Regression Prevention)

3.1 WHEN o símbolo já está no formato correto da Binance (ex: `BTCUSDT`, `ETHUSDT`, `1000PEPEUSDT`) THEN o sistema SHALL CONTINUE TO buscar candles normalmente sem alteração no símbolo ou no fluxo existente

3.2 WHEN os candles são obtidos com sucesso e `TechnicalAnalysisService.calcular()` retorna EMAs válidas THEN o sistema SHALL CONTINUE TO exibir os valores de EMA21, EMA50 e EMA200 com direção e relação ao preço no contexto

3.3 WHEN o fluxo completo funciona (candles → indicadores → score → contexto → Gemini) THEN o sistema SHALL CONTINUE TO produzir análise técnica com score, viés, confiabilidade e setup de entrada no mesmo formato atual

3.4 WHEN `calcularMultiTimeframe()` chama `getCandles()` internamente para timeframes superiores THEN o sistema SHALL CONTINUE TO funcionar normalmente, beneficiando-se da sanitização de símbolo e do limit maior

3.5 WHEN `calcularZonas()` chama `getCandles()` com `"1d"` e `"1w"` THEN o sistema SHALL CONTINUE TO calcular PDH, PDL, PWH, PWL corretamente

3.6 WHEN o OCR da imagem não detecta nenhuma EMA (`$elementosVisuais` sem campos EMA) THEN o sistema SHALL CONTINUE TO exibir INDISPONIVEL para as EMAs que falharam, sem crash

---

## Bug Condition (Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X.symbol of type string
  OUTPUT: boolean

  // Retorna true quando o símbolo contém caracteres inválidos para a Binance Futures
  RETURN X.symbol MATCHES /[:\/.]/
      OR X.symbol CONTAINS 'BINANCE:'
      OR X.symbol ENDS_WITH '.P'
      OR X.symbol ENDS_WITH 'PERP'
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition(X) DO
  candles ← getCandlesResiliente'(sanitizeSymbol'(X.symbol), X.timeframe, 1500)
  ASSERT candles IS array
  ASSERT no_exception_propagated
  indicators ← calcular'(candles, ocrData)
  ASSERT indicators.ema21 IS NOT null OR context_shows_INDISPONIVEL
  ASSERT indicators.ema50 IS NOT null OR context_shows_INDISPONIVEL
  ASSERT indicators.ema200 IS NOT null OR context_shows_INDISPONIVEL
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT getCandlesResiliente'(X.symbol, X.timeframe, 1500) = getCandles(X.symbol, X.timeframe, 500) // mesmo conjunto de dados, mais candles
  ASSERT F'(X).ema21 IS NOT null  // continua calculando
  ASSERT F'(X).ema50 IS NOT null
  ASSERT F'(X).ema200 IS NOT null
END FOR
```
