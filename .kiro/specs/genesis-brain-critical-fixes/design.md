# Genesis Brain Critical Fixes — Design de Bugfix

## Overview

Este documento formaliza a abordagem técnica para corrigir 7 bugs críticos no sistema Genesis Labs que comprometem a integridade dos dados de análise, a infraestrutura de monitoramento em tempo real e a confiabilidade do score de confluência. Os bugs variam desde dados técnicos falsos (ADX hardcoded com valor fixo 22.5), infraestrutura inexistente (endpoint SSE, worker skeleton, coluna SQL faltante), lógica de normalização incorreta de pares, score inflado artificialmente, até perda de dados entre etapas de leitura visual.

A estratégia de correção é cirúrgica: cada bug é tratado isoladamente com validação de que o comportamento existente não é afetado (preservation checking).

## Glossário

- **Bug_Condition (C)**: Condição que dispara cada um dos 7 bugs — inputs/estados que produzem comportamento incorreto
- **Property (P)**: Comportamento correto esperado quando a condição de bug é satisfeita
- **Preservation**: Comportamentos existentes que NÃO devem ser alterados pela correção
- **obterIndicadorComFallback**: Função em `services/adaptedDataFetcher.ts` que retorna indicadores técnicos com fallback para OCR
- **calcularADX**: Função em `services/indicatorEngine.ts` que calcula ADX real via Wilder's Smoothing retornando `{adx, diPlus, diMinus}`
- **calcularScore**: Função em `services/scoringEngine.ts` que calcula o score de confluência (0-100) com 4 blocos
- **scanChartMetadata / analyzeChart**: Funções em `services/geminiService.ts` que fazem leitura visual do gráfico em duas chamadas separadas
- **isTechnicalPresent**: Flag booleana no scoringEngine que indica se dados técnicos (EMA200, RSI, ADX) estão disponíveis

## Bug Details

### Bug Condition

Os 7 bugs se manifestam nas seguintes condições:

**Bug 1 — ADX Hardcoded**: Quando `obterIndicadorComFallback('ADX', ...)` é chamado com `klinesData.length >= 28`, o valor retornado é sempre `22.5` (constante) em vez de calcular via `calcularADX`.

**Bug 2 — SSE Inexistente**: Quando o frontend tenta conectar a `/api/v1/alertas/stream`, a rota não existe no backend Laravel, retornando 404.

**Bug 3 — Worker Skeleton**: Quando `monitor_worker.py` inicia, o loop principal apenas faz `time.sleep(1)` sem processar dados — embora as threads WebSocket estejam implementadas, o worker já funciona mas precisa de melhorias na detecção de anomalias com dados extras (funding, OI, book).

**Bug 4 — Coluna Timeframe Ausente**: Quando um alerta é gravado, o campo `timeframe` não existe na tabela `genesis_alertas`.

**Bug 5 — Leitura Visual Dupla**: Quando uma imagem é processada, `scanChartMetadata` extrai metadata e `analyzeChart` faz análise completa, mas os dados da primeira leitura (suportes, resistências, trendlines, fibonacci) não são passados para a segunda nem para o super-prompt.

**Bug 6 — Normalização de Par**: Quando o OCR retorna pares como "BTCUSD", "BTCUSDC", "SOLUSD.P", a lógica em `handleFileChange` apenas concatena "T" ou "USDT" sem remover sufixos existentes.

**Bug 7 — Score Inflado**: Quando `isTechnicalPresent === false`, o scoringEngine normaliza `(pontos / 65) * 100`, inflando artificialmente o score.

**Especificação Formal:**
```
FUNCTION isBugCondition(input)
  INPUT: input de tipo {bugId: number, context: any}
  OUTPUT: boolean

  IF input.bugId == 1:
    RETURN input.context.nome == 'ADX'
           AND input.context.klinesData.length >= 28
           AND retorno == 22.5 (constante)

  IF input.bugId == 2:
    RETURN input.context.url MATCHES '/api/v1/alertas/stream'
           AND rota NÃO existe no backend

  IF input.bugId == 3:
    RETURN input.context.worker == 'monitor_worker.py'
           AND dados_extras == {cvd_slope: 0, book_imbalance_ratio: null, ...}

  IF input.bugId == 4:
    RETURN input.context.tabela == 'genesis_alertas'
           AND coluna 'timeframe' NÃO existe no schema

  IF input.bugId == 5:
    RETURN input.context.hasImage == true
           AND scanChartMetadata.resultado NÃO é passado para analyzeChart

  IF input.bugId == 6:
    RETURN input.context.pair MATCHES /(USD|USDC|BUSD|DAI|TUSD|\.P|PERP|1000)$/
           AND resultado contém sufixo duplicado

  IF input.bugId == 7:
    RETURN input.context.isTechnicalPresent == false
           AND scoreFinal > 65
END FUNCTION
```

### Exemplos

- **Bug 1**: `obterIndicadorComFallback('ADX', 14, closes, klinesData200, null)` → retorna `{valor: 22.5, fonte: "API"}` em vez de `{valor: 31.2, fonte: "API"}` (valor real calculado)
- **Bug 2**: `new EventSource('/api/v1/alertas/stream')` → `onerror` disparado imediatamente, loop de reconexão a cada 3s
- **Bug 4**: `INSERT INTO genesis_alertas (..., timeframe, ...) VALUES (..., '4h', ...)` → erro SQL "Unknown column 'timeframe'"
- **Bug 6**: OCR retorna "BTCUSDC" → `cleanPair = "BTCUSDC"` → `!cleanPair.endsWith('USDT')` → `cleanPair += 'USDT'` → "BTCUSDCUSDT" (inválido)
- **Bug 6**: OCR retorna "SOLUSD.P" → após `replace('.P','')` no scan → "SOLUSD" → `endsWith('USD')` → `+= 'T'` → "SOLUSDT" (parcialmente correto, mas `.P` deveria ser removido antes)
- **Bug 7**: Sem técnico, 40 pontos bullish → `(40/65)*100 = 61.5` → score 80.75 (inflado) em vez de cap em 65

## Expected Behavior

### Preservation Requirements

**Comportamentos Inalterados:**
- Cálculo de EMA, RSI, MACD, Bollinger, ATR via `obterIndicadorComFallback` deve continuar funcionando normalmente
- Fallback para valor OCR quando API falha deve ser preservado
- Mouse clicks e interações de UI existentes não devem ser afetados
- Pares já no formato correto (ex: BTCUSDT, ETHUSDT) devem passar sem modificação
- Score com bloco técnico presente deve continuar usando escala completa 0-100
- Alertas com score abaixo de `SCORE_MINIMO` devem continuar sendo filtrados
- Queries existentes na tabela `genesis_alertas` devem continuar funcionando (DEFAULT na nova coluna)
- Reconexão SSE com backoff deve ser preservada no frontend

**Escopo:**
Todos os inputs que NÃO satisfazem as condições de bug devem produzir exatamente o mesmo resultado antes e depois da correção. Isso inclui:
- Indicadores técnicos que não são ADX
- Pares já normalizados corretamente
- Análises com bloco técnico presente
- Alertas existentes sem campo timeframe (usarão DEFAULT)

## Hypothesized Root Cause

### Bug 1 — ADX Hardcoded
**Causa**: O desenvolvedor deixou um placeholder `const adxEst = 22.5` na linha do ADX dentro de `obterIndicadorComFallback` (linha ~107 de `adaptedDataFetcher.ts`), com comentário "Approximation, full math requires DM arrays". A função `calcularADX` já existe e é importada, mas não é chamada neste ponto específico. Nota: mais abaixo no mesmo arquivo, `calcularADX(candlesForIE, 14)` É chamado corretamente para o objeto `dadosScore` — o bug está apenas no bloco `obterIndicadorComFallback`.

### Bug 2 — SSE Inexistente
**Causa**: O endpoint `/api/v1/alertas/stream` é referenciado pelo frontend (`services/api.ts` linha 202) mas nunca foi implementado no backend Laravel. O `server.ts` monta rotas de `routes/api.js` mas não possui rota SSE dedicada.

### Bug 3 — Worker Skeleton
**Causa**: O worker já possui implementação funcional de WebSocket e processamento de candles, mas o `dados_extras` passado para `calcular_indicadores_e_score` é sempre `{cvd_slope: 0, book_imbalance_ratio: None, ...}` — dados de funding, OI e book não são buscados em tempo real.

### Bug 4 — Coluna Timeframe
**Causa**: O schema SQL em `criar_tabelas.sql` não inclui a coluna `timeframe` entre `corretora` e `preco_atual`. O worker já envia `timeframe` no payload, mas a tabela não aceita.

### Bug 5 — Leitura Visual Dupla
**Causa**: `scanChartMetadata` retorna apenas metadata básica (pair, exchange, timeframe, indicators detectados) e `analyzeChart` faz uma segunda chamada ao backend sem receber os dados visuais detalhados (suportes, resistências, trendlines, fibonacci) que poderiam ter sido extraídos na primeira leitura. Os dados são perdidos entre as duas chamadas.

### Bug 6 — Normalização de Par
**Causa**: Em `handleFileChange` (GenesisPage.tsx, linhas 253-257), a lógica é:
```typescript
if (cleanPair.endsWith('USD')) cleanPair += 'T';
if (!cleanPair.endsWith('USDT')) cleanPair += 'USDT';
```
Isso falha para BTCUSDC (não termina em USD, não termina em USDT → vira BTCUSDCUSDT), BTCBUSD (termina em USD? Não, termina em BUSD → não termina em USDT → vira BTCBUSDUSDT). O `scanChartMetadata` faz `replace('PERP','').replace('.P','')` mas não remove USDC/BUSD/DAI/TUSD.

### Bug 7 — Score Inflado
**Causa**: Em `scoringEngine.ts` (linhas 148-152), quando `!isTechnicalPresent`:
```typescript
finalPontosBullish = (pontosBullish / 65) * 100;
finalPontosBearish = (pontosBearish / 65) * 100;
```
Isso normaliza os pontos para uma escala de 100 mesmo sem dados técnicos, inflando o score. O correto seria limitar (cap) o score final a 65 máximo.

## Correctness Properties

Property 1: Bug Condition - ADX Calculado Corretamente

_For any_ input onde `obterIndicadorComFallback('ADX', period, closes, klinesData, jsonVisual)` é chamado com `klinesData.length >= 28`, a função corrigida SHALL chamar `calcularADX(candlesForIE, period)` e retornar `{valor: {adx, diPlus, diMinus}, fonte: "API"}` com valores reais calculados via Wilder's Smoothing.

**Validates: Requirements 2.1**

Property 2: Bug Condition - SSE Endpoint Funcional

_For any_ conexão EventSource ao endpoint `/api/v1/alertas/stream`, o backend SHALL manter a conexão aberta, fazer polling na tabela `genesis_alertas` a cada 10 segundos, e transmitir alertas novos (excluindo campos `direcao` e `urgencia`) ao cliente.

**Validates: Requirements 2.2**

Property 3: Bug Condition - Worker Operacional

_For any_ execução do `monitor_worker.py`, o sistema SHALL conectar via WebSocket ao Binance Futures, processar candles em tempo real, buscar dados extras (funding, OI) periodicamente, executar detecção de anomalias com dados reais, e gravar alertas válidos via API Laravel.

**Validates: Requirements 2.3**

Property 4: Bug Condition - Schema com Timeframe

_For any_ criação ou atualização da tabela `genesis_alertas`, o schema SHALL incluir a coluna `timeframe VARCHAR(10) NOT NULL DEFAULT '1h'` posicionada após `corretora`.

**Validates: Requirements 2.4**

Property 5: Bug Condition - Leitura Visual Unificada

_For any_ processamento de imagem de gráfico, o sistema SHALL realizar uma ÚNICA leitura visual unificada usando `gemini-3.1-pro-preview`, extraindo TODOS os dados (metadata + suportes + resistências + trendlines + fibonacci + padrões + indicadores + EMAs) em uma única chamada, e SHALL passar o resultado completo para o fluxo de análise.

**Validates: Requirements 2.5**

Property 6: Bug Condition - Normalização de Par Correta

_For any_ par identificado pelo OCR que contenha sufixos de stablecoin (USDT, USDC, BUSD, USD, DAI, TUSD) ou caracteres especiais (.P, PERP, 1000), a função corrigida SHALL primeiro remover TODOS os sufixos e caracteres especiais, e DEPOIS adicionar "USDT" ao símbolo base limpo.

**Validates: Requirements 2.6**

Property 7: Bug Condition - Score com Cap sem Técnico

_For any_ cálculo de score onde `isTechnicalPresent === false`, o `scoringEngine` SHALL limitar o score final a um máximo de 65 pontos e SHALL adicionar a flag `CONFIANCA_REDUZIDA_SEM_TECNICO` ao array de flags.

**Validates: Requirements 2.7**

Property 8: Preservation - Indicadores Não-ADX Inalterados

_For any_ chamada a `obterIndicadorComFallback` com nome diferente de 'ADX' (EMA, RSI, MACD, BOLLINGER, ATR), a função corrigida SHALL produzir exatamente o mesmo resultado que a função original, preservando toda a lógica de cálculo e fallback existente.

**Validates: Requirements 3.1, 3.2**

Property 9: Preservation - Score com Técnico Inalterado

_For any_ cálculo de score onde `isTechnicalPresent === true`, o `scoringEngine` corrigido SHALL produzir exatamente o mesmo resultado que o original, preservando a escala completa 0-100 sem cap nem flag adicional.

**Validates: Requirements 3.6**

Property 10: Preservation - Pares Já Válidos Inalterados

_For any_ par que já está no formato correto (ex: BTCUSDT, ETHUSDT, SOLUSDT), a normalização corrigida SHALL retornar o par sem modificação.

**Validates: Requirements 3.5**

## Fix Implementation

### Changes Required

**Arquivo**: `services/adaptedDataFetcher.ts`
**Função**: `obterIndicadorComFallback` — bloco `else if (nome === 'ADX')`

**Mudança 1 — Substituir ADX hardcoded por cálculo real:**
1. Converter `klinesData` para formato Candle[] (mesmo padrão usado mais abaixo no arquivo)
2. Chamar `calcularADX(candlesForIE, period)` importado de `indicatorEngine.ts`
3. Retornar `{valor: {adx, diPlus, diMinus}, fonte: "API"}` se resultado não-nulo
4. Manter fallback para OCR/INDISPONIVEL se `calcularADX` retornar null

---

**Arquivo**: Backend Laravel (novo controller/rota)
**Rota**: `GET /api/v1/alertas/stream`

**Mudança 2 — Criar endpoint SSE:**
1. Criar rota SSE no Laravel que mantém conexão aberta
2. Implementar polling na tabela `genesis_alertas` a cada 10 segundos (WHERE `enviado_sse = 0`)
3. Transmitir alertas novos excluindo campos `direcao` e `urgencia` do payload
4. Marcar `enviado_sse = 1` após envio
5. Enviar `ping` a cada 30s para manter conexão viva

---

**Arquivo**: `monitor/monitor_worker.py`
**Função**: `processar_candle` e novo método `buscar_dados_extras`

**Mudança 3 — Enriquecer worker com dados extras:**
1. Adicionar busca periódica de funding rate via REST API Binance (`/fapi/v1/premiumIndex`)
2. Adicionar busca de Open Interest via REST API (`/fapi/v1/openInterest`)
3. Passar dados reais para `calcular_indicadores_e_score` em vez de zeros/nulls
4. Adicionar chamadas às funções de detecção existentes (`detectar_funding_extremo`, `detectar_oi_spike`) com dados reais

---

**Arquivo**: `criar_tabelas.sql`

**Mudança 4 — Adicionar coluna timeframe:**
1. Adicionar `timeframe VARCHAR(10) NOT NULL DEFAULT '1h' COMMENT 'Timeframe do alerta (ex: 1h, 4h, 1d)'` após coluna `corretora`
2. Adicionar migration SQL: `ALTER TABLE genesis_alertas ADD COLUMN timeframe VARCHAR(10) NOT NULL DEFAULT '1h' AFTER corretora;`

---

**Arquivo**: `services/geminiService.ts`
**Funções**: `scanChartMetadata` + `analyzeChart`

**Mudança 5 — Unificar leitura visual:**
1. Criar nova função `unifiedChartAnalysis` que faz UMA chamada ao backend com prompt unificado
2. O prompt deve solicitar: metadata (par, exchange, timeframe) + suportes/resistências + trendlines + fibonacci + padrões + indicadores detectados + EMAs visíveis
3. Usar modelo `gemini-3.1-pro-preview` para máxima precisão visual
4. Retornar objeto unificado contendo tanto `ChartMetadata` quanto dados visuais detalhados
5. Manter `scanChartMetadata` como wrapper que extrai apenas metadata do resultado unificado

---

**Arquivo**: `pages/GenesisPage.tsx`
**Função**: `handleFileChange` — bloco de normalização de par

**Mudança 6 — Corrigir normalização de par:**
1. Criar função `normalizarPar(rawPair: string): string` que:
   - Remove caracteres especiais: `.P`, `PERP`, `/`
   - Remove prefixo `1000` (ex: 1000PEPEUSDT → PEPEUSDT)
   - Remove sufixos de stablecoin na ordem: USDT, USDC, BUSD, USD, DAI, TUSD
   - Adiciona "USDT" ao símbolo base limpo
   - Retorna par sem modificação se já termina em USDT após limpeza
2. Substituir lógica inline por chamada a `normalizarPar`
3. Aplicar mesma lógica no `scanChartMetadata` (symbolClean)

---

**Arquivo**: `services/scoringEngine.ts`
**Função**: `calcularScore`

**Mudança 7 — Cap de score sem técnico:**
1. Remover normalização `(pontos / 65) * 100` quando `!isTechnicalPresent`
2. Após calcular `scoreFinal`, se `!isTechnicalPresent` e `scoreFinal > 65`: `scoreFinal = 65`
3. Adicionar `flags.push('CONFIANCA_REDUZIDA_SEM_TECNICO')` quando `!isTechnicalPresent`
4. Manter cálculo normal quando `isTechnicalPresent === true`

## Testing Strategy

### Validation Approach

A estratégia de testes segue abordagem em duas fases: primeiro, surfar counterexamples que demonstram os bugs no código não-corrigido, depois verificar que a correção funciona e preserva comportamento existente.

### Exploratory Bug Condition Checking

**Goal**: Surfar counterexamples que demonstram cada bug ANTES de implementar a correção. Confirmar ou refutar a análise de root cause.

**Test Plan**: Escrever testes unitários que exercitam cada condição de bug no código atual e observam as falhas.

**Test Cases**:
1. **ADX Hardcoded Test**: Chamar `obterIndicadorComFallback('ADX', 14, closes, klinesData200, null)` e verificar que retorna 22.5 (demonstra o bug)
2. **Pair Normalization Test**: Passar "BTCUSDC" pela lógica de normalização e verificar que produz "BTCUSDCUSDT" (demonstra o bug)
3. **Score Inflation Test**: Chamar `calcularScore` com `isTechnicalPresent=false` e 40 pontos bullish, verificar que score > 65 (demonstra o bug)
4. **Schema Test**: Tentar INSERT com campo timeframe na tabela genesis_alertas (demonstra erro SQL)

**Expected Counterexamples**:
- ADX sempre retorna 22.5 independente dos dados de entrada
- Pares com sufixos produzem strings inválidas (BTCUSDCUSDT, BTCBUSDUSDT)
- Score sem técnico ultrapassa 65 pontos artificialmente

### Fix Checking

**Goal**: Verificar que para todos os inputs onde a condição de bug é satisfeita, a função corrigida produz o comportamento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

**Verificações específicas:**
- ADX: Para qualquer klinesData com >= 28 candles, `obterIndicadorComFallback('ADX', ...)` retorna objeto `{adx, diPlus, diMinus}` com valores entre 0-100
- Par: Para qualquer string com sufixo stablecoin, `normalizarPar` produz par válido terminando em USDT sem duplicação
- Score: Para qualquer `DadosScore` sem técnico, `scoreFinal <= 65` e flags contém `CONFIANCA_REDUZIDA_SEM_TECNICO`

### Preservation Checking

**Goal**: Verificar que para todos os inputs onde a condição de bug NÃO é satisfeita, a função corrigida produz o mesmo resultado que a original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: Property-based testing é recomendado para preservation checking porque:
- Gera muitos casos de teste automaticamente no domínio de entrada
- Captura edge cases que testes manuais podem perder
- Fornece garantias fortes de que o comportamento é inalterado para inputs não-bugados

**Test Plan**: Observar comportamento no código NÃO-corrigido primeiro para indicadores não-ADX, pares já válidos e scores com técnico, depois escrever property-based tests capturando esse comportamento.

**Test Cases**:
1. **EMA/RSI/MACD Preservation**: Verificar que `obterIndicadorComFallback('EMA', ...)`, `('RSI', ...)`, `('MACD', ...)` produzem mesmos resultados antes e depois da correção
2. **Valid Pair Preservation**: Verificar que pares como "BTCUSDT", "ETHUSDT" passam sem modificação pela normalização corrigida
3. **Score with Technical Preservation**: Verificar que `calcularScore` com `isTechnicalPresent=true` produz mesmo resultado antes e depois
4. **Fallback ADX Preservation**: Verificar que com `klinesData.length < 28`, ADX continua retornando fallback OCR ou INDISPONIVEL

### Unit Tests

- Testar `obterIndicadorComFallback('ADX', ...)` com dados reais de klines (>= 28 candles) → deve retornar `{adx, diPlus, diMinus}`
- Testar `normalizarPar` com todos os sufixos: USDC, BUSD, USD, DAI, TUSD, .P, PERP, 1000
- Testar `calcularScore` sem técnico → score <= 65 e flag presente
- Testar `calcularScore` com técnico → score usa escala completa
- Testar endpoint SSE retorna alertas sem campos `direcao`/`urgencia`
- Testar schema SQL aceita INSERT com campo timeframe

### Property-Based Tests

- Gerar dados aleatórios de klines (28-500 candles) e verificar que ADX retorna valores entre 0-100 com diPlus/diMinus
- Gerar strings aleatórias de pares com sufixos variados e verificar que normalização sempre produz par válido terminando em USDT
- Gerar `DadosScore` aleatórios sem técnico e verificar que score nunca excede 65
- Gerar `DadosScore` aleatórios com técnico e verificar que resultado é idêntico ao da função original

### Integration Tests

- Testar fluxo completo: upload de imagem → scan unificado → normalização de par → busca de dados → cálculo de score
- Testar worker: conexão WebSocket → recebimento de candle → processamento → gravação de alerta
- Testar SSE end-to-end: worker grava alerta → SSE detecta → frontend recebe
- Testar que alertas antigos sem timeframe continuam funcionando com DEFAULT '1h'
