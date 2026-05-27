# Tarefas de Implementação — Genesis Moderate Fixes

## Tarefa 1: GeoEngine Context Provider + Persistência do Radar

- [x] 1.1 Criar `contexts/GeoEngineContext.tsx` com Provider que gerencia o singleton geoEngine, expondo events, isScanning, start/stop/toggle
- [x] 1.2 Implementar persistência em localStorage (chave `genesis_geo_radar_active`) no toggle e restauração no mount do Provider
- [x] 1.3 Implementar lógica de auto-start: se localStorage indica "ativo", iniciar engine no mount do Provider
- [x] 1.4 Envolver a aplicação com `<GeoEngineProvider>` no layout raiz (junto ao AppProvider existente)
- [x] 1.5 Refatorar `GeopoliticalRadar.tsx` para consumir `useGeoEngine()` ao invés de useState local para isScanning
- [x] 1.6 Refatorar `GlobalGeopoliticalAlert.tsx` para consumir `useGeoEngine()` ao invés de importar geoEngine diretamente
- [x] 1.7 Escrever testes de propriedade para P1 (round-trip estado), P2 (engine sobrevive unmount), P3 (eventos acumulados), P13 (engine inativo)

## Tarefa 2: EMAs Dinâmicas no Scoring

- [x] 2.1 Criar função `classificarEMAs(emas: {periodo: number, valor: number}[]): EMAsClassificadas` no adaptedDataFetcher ou módulo auxiliar
- [x] 2.2 Integrar classificação no `buscarDadosAdaptados`: extrair EMAs de `resultadosIndicadores`, classificar, e usar como fonte primária para DadosScore
- [x] 2.3 Manter fallback para EMAs fixas 21/50/200 quando nenhuma EMA é detectada no gráfico
- [x] 2.4 Calcular `emaSubindo` usando a EMA dinâmica selecionada (comparar valor atual vs candle anterior)
- [x] 2.5 Escrever testes de propriedade para P4 (classificação EMAs), P5 (EMAs dinâmicas primárias), P6 (tendência EMA)

## Tarefa 3: Modelo Adequado para Leitura Visual

- [x] 3.1 Configurar no backend (ou parâmetro de request) o uso de `gemini-2.5-pro-preview-05-06` para endpoints de leitura visual (`/v1/unified-scan`)
- [x] 3.2 Implementar fallback no frontend: se resposta do backend retorna erro 503/timeout, retry com parâmetro `model=flash`
- [x] 3.3 Adicionar log de aviso quando fallback é ativado
- [x] 3.4 Escrever teste unitário para fallback de modelo (mock HTTP) — P7

## Tarefa 4: Correção da Signal Line do MACD

- [x] 4.1 Substituir cálculo inline no `obterIndicadorComFallback` (caso 'MACD'): remover `signalLine = macdLine * 0.9` e usar `calcularMACD` do indicatorEngine
- [x] 4.2 Ajustar condição de dados mínimos: exigir ≥ 35 candles (26 slow + 9 signal) antes de calcular
- [x] 4.3 Garantir que o objeto retornado mantém interface `{ linha_macd, linha_sinal }` compatível com consumidores
- [x] 4.4 Escrever testes de propriedade para P8 (Signal Line = EMA9), P9 (histograma invariante), P10 (round-trip numérico)

## Tarefa 5: Testes de Preservação de Comportamento

- [x] 5.1 Escrever teste de propriedade P11 (score 0-100 para qualquer DadosScore)
- [x] 5.2 Escrever teste unitário para fallback OCR em falha de cálculo — P12
- [x] 5.3 Verificar que indicadores não-EMA (RSI, Bollinger, ADX, ATR) não foram afetados (teste de regressão)
