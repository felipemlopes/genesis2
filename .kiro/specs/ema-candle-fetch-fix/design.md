# EMA Candle Fetch Fix — Bugfix Design

## Overview

EMAs (EMA21, EMA50, EMA200) de altcoins aparecem como INDISPONIVEL no contexto enviado ao Gemini porque símbolos sujos (`BINANCE:PHAUSDT.P`, `ETH/USDT`, `PHAUSDT.P`) são repassados sem sanitização ao `BinanceService.getCandles()`, que os envia diretamente à Binance Futures API. A Binance responde com "Invalid symbol", a exceção é capturada, `$candles` fica vazio, `TechnicalAnalysisService.calcular()` não consegue calcular as EMAs, e `ContextBuilderService.lerEstruturaEMAs()` descarta silenciosamente os valores nulos com `if (empty($ind[$k])) continue`.

Problemas secundários: (1) o limite de 500 candles é insuficiente para convergência confiável da EMA200; (2) o fallback OCR em `TechnicalAnalysisService.calcular()` nunca é ativado porque `$elementosVisuais` não é passado como `$ocrData`; (3) os demais endpoints do `BinanceService` também recebem símbolos sujos.

A correção é composta por quatro mudanças cirúrgicas: sanitização de símbolo via `sanitizeSymbol()`, fallback Futures→Spot via `getCandlesResiliente()`, aumento do limit para 1500 candles, e exposição explícita de `INDISPONIVEL` no contexto.

## Glossary

- **Bug_Condition (C)**: Símbolo recebido que contém caracteres inválidos para a Binance API (`:`  `/` `.P` `PERP` espaços)
- **Property (P)**: Comportamento correto esperado — candles retornam com sucesso (ou fallback), EMAs são calculadas ou marcadas explicitamente como INDISPONIVEL
- **Preservation**: Fluxo existente para símbolos já limpos (ex: `BTCUSDT`) que deve continuar funcionando identicamente
- **sanitizeSymbol()**: Nova função em `BinanceService` que normaliza qualquer símbolo para o formato aceito pela Binance
- **getCandlesResiliente()**: Nova função em `BinanceService` que tenta Futures primeiro, depois Spot como fallback
- **lerEstruturaEMAs()**: Função em `ContextBuilderService` que formata a seção de EMAs no contexto textual do Gemini
- **$elementosVisuais**: Array com dados extraídos via OCR da imagem do gráfico, incluindo `ema_21`, `ema_50`, `ema_200`
- **$ocrData**: Segundo argumento de `TechnicalAnalysisService.calcular()` — fallback de EMAs quando candles falham

## Bug Details

### Bug Condition

O bug se manifesta quando o símbolo recebido pelo `GeminiAnalysisService` contém prefixos de exchange, sufixos de contrato perpétuo ou separadores inválidos. O `BinanceService.getCandles()` repassa o símbolo cru diretamente à URL da API Binance Futures sem qualquer normalização.

**Formal Specification:**
```
FUNCTION isBugCondition(symbol)
  INPUT: symbol of type string
  OUTPUT: boolean

  RETURN symbol MATCHES /[:\/.]/
      OR symbol CONTAINS 'BINANCE:'
      OR symbol CONTAINS 'BYBIT:'
      OR symbol ENDS_WITH '.P'
      OR symbol ENDS_WITH 'PERP'
      OR symbol CONTAINS ' '
END FUNCTION
```

### Examples

- `BINANCE:PHAUSDT.P` → Binance rejeita → `$candles = []` → EMA = null → INDISPONIVEL silencioso
- `ETH/USDT` → Binance rejeita → mesmo fluxo de falha
- `PHAUSDT.P` → Binance rejeita → mesmo fluxo de falha
- `BTCUSDT` → isBugCondition = false → fluxo normal (não afetado pela correção)
- `1000PEPEUSDT` → isBugCondition = false → fluxo normal (não afetado)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Símbolos já limpos como `BTCUSDT`, `ETHUSDT`, `1000PEPEUSDT` devem continuar buscando candles normalmente sem alteração no símbolo ou fluxo
- EMAs calculadas com sucesso devem continuar sendo exibidas com valor, direção e relação ao preço
- O fluxo completo (candles → indicadores → score → contexto → Gemini) deve continuar produzindo análise no mesmo formato
- `calcularMultiTimeframe()` e `calcularZonas()` internamente chamam `getCandles()` e devem continuar funcionando, beneficiando-se da sanitização
- Quando OCR não detecta nenhuma EMA, o sistema deve continuar exibindo INDISPONIVEL sem crash

**Scope:**
Todos os inputs onde `isBugCondition(symbol) = false` devem ser completamente não afetados. Isso inclui:
- Qualquer símbolo já no formato `[A-Z0-9]+` (ex: `BTCUSDT`, `SOLUSDT`)
- Símbolos numéricos como `1000PEPEUSDT`, `1000SHIBUSDT`
- Cliques de mouse e outros inputs não relacionados ao fetch de candles

## Hypothesized Root Cause

1. **Ausência de sanitização de entrada**: `BinanceService.getCandles()` não possui nenhum passo de normalização. O símbolo é passado diretamente no `$params` da chamada HTTP sem validação ou limpeza.

2. **Propagação silenciosa via try/catch**: Em `GeminiAnalysisService.analisar()`, a exceção lançada pelo HTTP error é capturada e `$candles` simplesmente fica `[]`. Não há log do símbolo inválido original, dificultando o diagnóstico.

3. **Descarte silencioso em lerEstruturaEMAs()**: A condição `if (empty($ind[$k])) continue` no `ContextBuilderService` silencia completamente a ausência de EMA — a seção aparece no contexto mas sem nenhuma linha de EMA, o que é ambíguo para o Gemini.

4. **ocrData nunca passado**: `GeminiAnalysisService` calcula `$elementosVisuais` via OCR (que pode conter `ema_21`, `ema_50`, `ema_200`), mas chama `$this->techAnalysis->calcular($candles)` sem o segundo argumento — o fallback OCR em `TechnicalAnalysisService` nunca é acionado.

5. **Limite insuficiente de candles**: Com `limit=500`, timeframes maiores (4h, 1d) podem não ter candles suficientes para a EMA200 convergir de forma confiável. O cálculo matemático mínimo é `period + 1 = 201` candles, mas para convergência real a recomendação é ~891+ candles.

## Correctness Properties

Property 1: Bug Condition — Símbolos Inválidos São Sanitizados e Candles Retornados

_For any_ símbolo onde `isBugCondition(symbol) = true`, o sistema corrigido SHALL sanitizar o símbolo via `sanitizeSymbol()`, tentar a API Binance Futures com o símbolo limpo, e em caso de falha tentar a API Binance Spot, retornando sempre um array (vazio ou com candles) sem propagar exceção para a camada superior. Quando candles são retornados, as EMAs devem ser calculadas; quando candles falham mesmo após fallback, o contexto SHALL exibir explicitamente `EMA21=INDISPONIVEL`, `EMA50=INDISPONIVEL`, `EMA200=INDISPONIVEL`.

**Validates: Requirements 2.1, 2.2, 2.3, 2.6**

Property 2: Preservation — Símbolos Limpos Não São Afetados

_For any_ símbolo onde `isBugCondition(symbol) = false` (ex: `BTCUSDT`), o sistema corrigido SHALL produzir o mesmo resultado de candles que o sistema original, com as EMAs calculadas corretamente e exibidas com valor, direção e relação ao preço — sem nenhuma alteração no comportamento observável.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File 1**: `app/Services/BinanceService.php`

**Specific Changes**:

1. **Adicionar `sanitizeSymbol(string $symbol): string`**:
   - Converte para uppercase e trim
   - Remove prefixo de exchange antes de `:` (ex: `BINANCE:PHAUSDT` → `PHAUSDT`)
   - Remove sufixo `.P` via regex (`/\.P$/`)
   - Remove sufixo `PERP` via regex (`/PERP$/`)
   - Remove qualquer caractere não alfanumérico via `preg_replace('/[^A-Z0-9]/', '', $s)`
   - Resultado: apenas `[A-Z0-9]+`

2. **Adicionar `getCandlesResiliente(string $symbol, string $interval, int $limit = 1500): array`**:
   - Aplica `sanitizeSymbol()` no símbolo recebido
   - Tenta `$this->get('/fapi/v1/klines', ...)` (Binance Futures)
   - Se retornar array vazio ou lançar exceção, tenta `Http::get('https://api.binance.com/api/v3/klines', ...)`
   - Se ambos falharem, loga erro com símbolo sanitizado e motivo, retorna `[]`
   - Cache key inclui símbolo sanitizado para evitar duplicação

3. **Aplicar `sanitizeSymbol()` em todos os demais endpoints** (`getFundingRate`, `getOpenInterest`, `getLongShortRatio`, `getAggTrades`, `getCurrentPrice`): adicionar `$symbol = $this->sanitizeSymbol($symbol);` como primeira linha de cada método público que recebe `$symbol`.

---

**File 2**: `app/Services/GeminiAnalysisService.php`

**Specific Changes**:

4. **Linha ~29 — trocar `getCandles` por `getCandlesResiliente` com limit 1500**:
   ```php
   // ANTES:
   $candles = $this->binance->getCandles($symbol, $timeframe, 500);
   
   // DEPOIS:
   $candles = $this->binance->getCandlesResiliente($symbol, $timeframe, 1500);
   ```

5. **Passar `$elementosVisuais` como `$ocrData` em `calcular()`** (seção 4, após extração visual):
   ```php
   // ANTES:
   $indicadores = $this->techAnalysis->calcular($candles);
   
   // DEPOIS:
   $ocrData = [
       'ema_21'  => $elementosVisuais['ema_21']  ?? null,
       'ema_50'  => $elementosVisuais['ema_50']  ?? null,
       'ema_200' => $elementosVisuais['ema_200'] ?? null,
   ];
   $ocrData = array_filter($ocrData, fn($v) => $v !== null);
   $indicadores = $this->techAnalysis->calcular($candles, $ocrData);
   ```

---

**File 3**: `app/Services/ContextBuilderService.php`

**Specific Changes**:

6. **Corrigir `lerEstruturaEMAs()` — substituir descarte silencioso por INDISPONIVEL explícito**:
   ```php
   // ANTES:
   if (empty($ind[$k])) continue;
   $v   = $ind[$k];
   $sub = $ind[$k . '_subindo'] ?? false;
   $rel = $preco > $v ? 'acima' : 'abaixo';
   $dir = $sub ? 'subindo' : 'caindo';
   if ($preco > $v) $acima++;
   $emas[] = "{$label}={$v} ({$dir}) preco {$rel}";

   // DEPOIS:
   $v = $ind[$k] ?? null;
   if ($v === null || !is_numeric($v) || (float) $v <= 0) {
       $emas[] = "{$label}=INDISPONIVEL";
       continue;
   }
   $v   = (float) $v;
   $sub = $ind[$k . '_subindo'] ?? false;
   $rel = $preco > $v ? 'acima' : 'abaixo';
   $dir = $sub ? 'subindo' : 'caindo';
   if ($preco > $v) $acima++;
   $emas[] = "{$label}={$v} ({$dir}) preco {$rel}";
   ```

## Testing Strategy

### Validation Approach

A estratégia segue duas fases: primeiro, rodar testes no código **não corrigido** para confirmar (ou refutar) a hipótese de causa raiz via contraexemplos concretos; depois, verificar que a correção resolve todos os casos bugados e preserva os casos normais.

### Exploratory Bug Condition Checking

**Goal**: Expor contraexemplos que demonstram o bug **antes** de aplicar o fix. Confirmar que símbolos sujos causam `$candles = []` e que `lerEstruturaEMAs()` omite as linhas silenciosamente.

**Test Plan**: Instanciar `BinanceService` com um HTTP mock que retorna erro 400 quando o símbolo contém `:` ou `.P`. Chamar `getCandles()` com símbolo sujo e verificar que `$candles` é `[]`. Em seguida, chamar `ContextBuilderService.lerEstruturaEMAs()` com `$ind` sem EMAs e verificar que a seção de EMAs aparece vazia no output.

**Test Cases**:
1. **Símbolo com prefixo de exchange**: `getCandles('BINANCE:PHAUSDT.P', '1h', 500)` → deve retornar `[]` no código não corrigido (confirma bug 1.1 e 1.2)
2. **Símbolo com barra**: `getCandles('ETH/USDT', '1h', 500)` → deve retornar `[]` (confirma bug 1.1)
3. **lerEstruturaEMAs com emas nulas**: `lerEstruturaEMAs(['ema21' => null, 'ema50' => null, 'ema200' => null], 50000)` → deve retornar string sem nenhuma linha de EMA (confirma bug 1.6)
4. **calcular() sem ocrData com candles vazios**: `calcular([], [])` → deve retornar `ema21 = null` e `ema21_fonte = 'INDISPONIVEL'` (confirma bug 1.4)

**Expected Counterexamples**:
- `getCandles('BINANCE:PHAUSDT.P', ...)` propaga exceção HTTP ou retorna `[]`
- `lerEstruturaEMAs` produz seção `ESTRUTURA DE PRECO vs EMAs:` seguida imediatamente de classificação sem nenhuma linha de EMA individual
- `calcular([])` retorna `ema21 => null` mesmo que `$elementosVisuais` tenha `ema_21 = 65432.10` (porque `$ocrData` não é passado)

### Fix Checking

**Goal**: Para todos os inputs onde `isBugCondition = true`, o sistema corrigido deve retornar candles (ou `[]` sem exceção) e o contexto deve sempre incluir alguma informação sobre EMAs.

**Pseudocode:**
```
FOR ALL symbol WHERE isBugCondition(symbol) DO
  candles := getCandlesResiliente'(symbol, '1h', 1500)
  ASSERT candles IS array          // nunca lança exceção
  ind := calcular'(candles, ocrData)
  ctx := lerEstruturaEMAs'(ind, preco)
  ASSERT ctx CONTAINS 'EMA21='     // sempre presente, com valor ou INDISPONIVEL
  ASSERT ctx CONTAINS 'EMA50='
  ASSERT ctx CONTAINS 'EMA200='
END FOR
```

### Preservation Checking

**Goal**: Para todos os inputs onde `isBugCondition = false`, o sistema corrigido deve produzir exatamente o mesmo resultado que o sistema original.

**Pseudocode:**
```
FOR ALL symbol WHERE NOT isBugCondition(symbol) DO
  candles_original := getCandles(symbol, tf, 500)
  candles_fixed    := getCandlesResiliente'(symbol, tf, 1500)
  // Mesmo conjunto de dados (mais candles, mesmo símbolo)
  ASSERT sanitizeSymbol'(symbol) = symbol   // símbolo já limpo não é alterado
  ind_original := calcular(candles_original)
  ind_fixed    := calcular'(candles_fixed, {})
  ASSERT ind_fixed.ema21  IS NOT null       // continua calculando
  ASSERT ind_fixed.ema50  IS NOT null
  ASSERT ind_fixed.ema200 IS NOT null
END FOR
```

**Testing Approach**: Property-based testing é recomendado para preservation checking porque:
- Gera muitos casos automaticamente no domínio de símbolos limpos
- Captura edge cases como símbolos numéricos (`1000PEPEUSDT`) que seriam ignorados em testes manuais
- Garante que `sanitizeSymbol()` é idempotente para entradas já válidas

**Test Cases**:
1. **Preservação BTCUSDT**: `sanitizeSymbol('BTCUSDT') === 'BTCUSDT'` e candles retornam normalmente
2. **Preservação 1000PEPEUSDT**: `sanitizeSymbol('1000PEPEUSDT') === '1000PEPEUSDT'` — dígitos iniciais não são removidos
3. **Preservação EMAs válidas**: com candles suficientes, `calcular()` ainda retorna `ema21`, `ema50`, `ema200` não nulos
4. **Preservação lerEstruturaEMAs com valores**: com EMAs válidas, o contexto ainda exibe `EMA21=XXXX (subindo) preco acima`

### Unit Tests

- `sanitizeSymbol()`: testar cada transformação individualmente (`BINANCE:`, `.P`, `PERP`, `/`, espaços, já limpo)
- `getCandlesResiliente()` com mock Futures retornando erro: verificar que tenta Spot
- `getCandlesResiliente()` com ambos falhando: verificar que retorna `[]` sem exceção e loga erro
- `lerEstruturaEMAs()` com EMA nula: verificar que `EMA21=INDISPONIVEL` aparece no output
- `lerEstruturaEMAs()` com todas EMAs nulas: verificar classificação de estrutura adequada
- `calcular()` com `$ocrData` contendo `ema_21`: verificar que EMA é lida do OCR quando candles estão vazios

### Property-Based Tests

- Gerar strings aleatórias de símbolo e verificar que `sanitizeSymbol()` sempre retorna apenas `[A-Z0-9]+`
- Gerar símbolos limpos aleatórios e verificar que `sanitizeSymbol()` é idempotente (`sanitizeSymbol(sanitizeSymbol(s)) === sanitizeSymbol(s)`)
- Gerar arrays de candles válidos e verificar que `calcular()` com `$ocrData` vazio produz o mesmo resultado que sem `$ocrData`
- Verificar que para qualquer símbolo com `isBugCondition = true`, após `sanitizeSymbol()`, `isBugCondition` do resultado é `false`

### Integration Tests

- Simular análise completa de `BINANCE:PHAUSDT.P` via `GeminiAnalysisService.analisar()` com mocks HTTP: verificar que o contexto final contém `EMA21=` (com valor ou INDISPONIVEL) e não propaga exceção
- Simular análise de `BTCUSDT` e verificar que score, viés, confiabilidade e setup de entrada continuam no mesmo formato
- Testar `calcularMultiTimeframe()` com símbolo sujo e verificar que os timeframes superiores retornam `bias` válido ou `'N/D'` sem crash
- Testar `calcularZonas()` com símbolo sujo e verificar que PDH/PDL/PWH/PWL são calculados ou zerados sem exceção
