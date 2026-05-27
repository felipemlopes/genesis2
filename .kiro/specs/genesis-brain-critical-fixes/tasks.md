# Plano de Implementação — Genesis Brain Critical Fixes

## FASE 1: Correção de Dados (ADX, Normalização de Par, Score Inflado)

- [x] 1. Escrever teste exploratório de bug condition — ADX, Par, Score
  - **Property 1: Bug Condition** - ADX Hardcoded, Normalização de Par Incorreta, Score Inflado
  - **IMPORTANTE**: Escrever este teste property-based ANTES de implementar qualquer correção
  - **OBJETIVO**: Surfar counterexamples que demonstram os 3 bugs de dados no código atual
  - **Abordagem PBT com Escopo**:
    - ADX: Gerar arrays de klines com >= 28 candles e verificar que `obterIndicadorComFallback('ADX', ...)` SEMPRE retorna 22.5 (demonstra bug)
    - Par: Gerar strings com sufixos (USDC, BUSD, USD, DAI, TUSD, .P, PERP, 1000) e verificar que normalização produz pares inválidos (demonstra bug)
    - Score: Gerar `DadosScore` com `isTechnicalPresent=false` e pontos > 0, verificar que score > 65 (demonstra inflação)
  - Rodar testes no código NÃO-CORRIGIDO — esperar FALHA (confirma que os bugs existem)
  - Documentar counterexamples encontrados (ex: "ADX retorna 22.5 para qualquer input", "BTCUSDC → BTCUSDCUSDT")
  - Marcar tarefa completa quando testes escritos, executados e falhas documentadas
  - _Requirements: 1.1, 1.6, 1.7_

- [x] 2. Escrever testes de preservação (ANTES de implementar correção)
  - **Property 2: Preservation** - Indicadores Não-ADX, Pares Válidos, Score com Técnico
  - **IMPORTANTE**: Seguir metodologia observation-first
  - Observar: `obterIndicadorComFallback('EMA', 200, closes, klinesData, null)` retorna valor calculado no código atual
  - Observar: `obterIndicadorComFallback('RSI', 14, closes, klinesData, null)` retorna valor calculado no código atual
  - Observar: Pares "BTCUSDT", "ETHUSDT", "SOLUSDT" passam sem modificação pela normalização atual
  - Observar: `calcularScore` com `isTechnicalPresent=true` usa escala completa 0-100
  - Escrever property-based tests:
    - Para todo indicador != 'ADX', resultado da função corrigida === resultado da original
    - Para todo par já terminando em USDT, normalização retorna par inalterado
    - Para todo `DadosScore` com `isTechnicalPresent=true`, score usa escala completa sem cap
    - Para ADX com `klinesData.length < 28`, fallback OCR/INDISPONIVEL é preservado
  - Rodar testes no código NÃO-CORRIGIDO
  - **RESULTADO ESPERADO**: Testes PASSAM (confirma baseline de comportamento a preservar)
  - _Requirements: 3.1, 3.2, 3.5, 3.6_

- [ ] 3. Correção FASE 1 — Dados Corretos

  - [x] 3.1 Corrigir ADX hardcoded em `services/adaptedDataFetcher.ts`
    - Substituir `const adxEst = 22.5` por chamada real a `calcularADX(candlesForIE, period)`
    - Converter `klinesData` para formato Candle[] antes de chamar
    - Retornar `{valor: {adx, diPlus, diMinus}, fonte: "API"}` se resultado não-nulo
    - Manter fallback para OCR/INDISPONIVEL se `calcularADX` retornar null ou `klinesData.length < 28`
    - _Bug_Condition: obterIndicadorComFallback('ADX', ...) com klinesData.length >= 28 retorna 22.5_
    - _Expected_Behavior: retorna {adx, diPlus, diMinus} reais via Wilder's Smoothing_
    - _Preservation: indicadores não-ADX e fallback com < 28 candles inalterados_
    - _Requirements: 2.1, 3.1, 3.2_

  - [x] 3.2 Corrigir normalização de par em `pages/GenesisPage.tsx`
    - Criar função `normalizarPar(rawPair: string): string`
    - Remover caracteres especiais: `.P`, `PERP`, `/`
    - Remover prefixo `1000` (ex: 1000PEPEUSDT → PEPEUSDT)
    - Remover sufixos de stablecoin na ordem: USDT, USDC, BUSD, USD, DAI, TUSD
    - Adicionar "USDT" ao símbolo base limpo
    - Retornar par sem modificação se já termina em USDT após limpeza
    - Substituir lógica inline em `handleFileChange` por chamada a `normalizarPar`
    - Aplicar mesma lógica no `scanChartMetadata` (symbolClean) em `geminiService.ts`
    - _Bug_Condition: par com sufixo stablecoin ou caractere especial produz string inválida_
    - _Expected_Behavior: BTCUSDC → BTCUSDT, SOLUSD.P → SOLUSDT, 1000PEPEUSDT → PEPEUSDT_
    - _Preservation: pares já válidos (BTCUSDT, ETHUSDT) passam sem modificação_
    - _Requirements: 2.6, 3.5_

  - [x] 3.3 Corrigir score inflado em `services/scoringEngine.ts`
    - Remover normalização `(pontos / 65) * 100` quando `!isTechnicalPresent`
    - Após calcular `scoreFinal`, se `!isTechnicalPresent` e `scoreFinal > 65`: `scoreFinal = 65`
    - Adicionar `flags.push('CONFIANCA_REDUZIDA_SEM_TECNICO')` quando `!isTechnicalPresent`
    - Manter cálculo normal quando `isTechnicalPresent === true`
    - _Bug_Condition: isTechnicalPresent === false e score > 65 (inflação artificial)_
    - _Expected_Behavior: score capped em 65 + flag CONFIANCA_REDUZIDA_SEM_TECNICO_
    - _Preservation: score com técnico usa escala completa 0-100 sem cap_
    - _Requirements: 2.7, 3.6_

  - [x] 3.4 Verificar teste exploratório (Property 1) agora passa
    - **Property 1: Expected Behavior** - ADX Calculado, Par Normalizado, Score Capped
    - **IMPORTANTE**: Re-executar os MESMOS testes da tarefa 1 — NÃO escrever novos testes
    - Os testes da tarefa 1 codificam o comportamento esperado
    - Quando passarem, confirma que os 3 bugs de dados estão corrigidos
    - **RESULTADO ESPERADO**: Testes PASSAM (confirma correção)
    - _Requirements: 2.1, 2.6, 2.7_

  - [x] 3.5 Verificar testes de preservação ainda passam
    - **Property 2: Preservation** - Indicadores Não-ADX, Pares Válidos, Score com Técnico
    - **IMPORTANTE**: Re-executar os MESMOS testes da tarefa 2 — NÃO escrever novos testes
    - Confirmar que todos os testes de preservação continuam passando após correções
    - **RESULTADO ESPERADO**: Testes PASSAM (confirma zero regressões)
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

- [x] 4. Checkpoint FASE 1 — Garantir todos os testes passam
  - Executar suite completa de testes
  - Confirmar que ADX retorna valores reais, pares são normalizados corretamente, score é capped
  - Perguntar ao usuário se há dúvidas antes de prosseguir para FASE 2

## FASE 2: Unificar Leitura Visual (Merge de Prompts)

- [x] 5. Escrever teste exploratório — Leitura Visual Dupla
  - **Property 1: Bug Condition** - Dados Visuais Perdidos entre Leituras
  - **IMPORTANTE**: Escrever ANTES de implementar a unificação
  - **OBJETIVO**: Demonstrar que dados da Leitura 1 (suportes, resistências, trendlines, fibonacci) NÃO chegam à Leitura 2
  - Testar que `scanChartMetadata` retorna metadata mas NÃO retorna dados visuais detalhados
  - Testar que `analyzeChart` NÃO recebe dados visuais da primeira leitura como input
  - Verificar que o super-prompt final NÃO contém suportes/resistências/trendlines/fibonacci da leitura visual
  - Rodar no código NÃO-CORRIGIDO — esperar FALHA (confirma perda de dados)
  - _Requirements: 1.5_

- [x] 6. Escrever teste de preservação — Fluxo de Análise Visual
  - **Property 2: Preservation** - Resultado Final de Análise Mantido
  - **IMPORTANTE**: Seguir metodologia observation-first
  - Observar: formato de saída do `analyzeChart` no código atual (campos retornados)
  - Observar: campos de metadata que `scanChartMetadata` retorna (pair, exchange, timeframe, indicators)
  - Escrever testes que verificam:
    - Resultado unificado contém TODOS os campos que `scanChartMetadata` retornava
    - Resultado unificado contém TODOS os campos que `analyzeChart` retornava
    - Formato de dados é compatível com consumidores downstream (adaptedDataFetcher, super-prompt)
  - Rodar no código NÃO-CORRIGIDO (adaptado para interface esperada)
  - **RESULTADO ESPERADO**: Testes PASSAM (confirma que interface é preservada)
  - _Requirements: 3.2_

- [x] 7. Correção FASE 2 — Unificar Leitura Visual

  - [x] 7.1 Criar função `unifiedChartAnalysis` em `services/geminiService.ts`
    - Criar prompt unificado que solicita: metadata (par, exchange, timeframe) + suportes/resistências + trendlines + fibonacci + padrões + indicadores detectados + EMAs visíveis
    - Usar modelo `gemini-3.1-pro-preview` para máxima precisão visual
    - Retornar objeto unificado contendo tanto `ChartMetadata` quanto dados visuais detalhados
    - Definir schema JSON de resposta unificado
    - _Bug_Condition: duas leituras separadas perdem dados entre etapas_
    - _Expected_Behavior: uma única leitura retorna TODOS os dados visuais_
    - _Preservation: campos de metadata e análise continuam disponíveis para consumidores_
    - _Requirements: 2.5_

  - [x] 7.2 Adaptar `scanChartMetadata` como wrapper
    - Manter `scanChartMetadata` como wrapper que extrai apenas metadata do resultado unificado
    - Garantir compatibilidade com código que chama `scanChartMetadata` diretamente
    - _Requirements: 2.5, 3.2_

  - [x] 7.3 Adaptar `handleFileChange` para usar resultado unificado
    - Passar resultado completo da leitura unificada para `adaptedDataFetcher`
    - Passar dados visuais (suportes, resistências, trendlines, fibonacci) para o super-prompt final
    - Remover chamada separada a `analyzeChart` (agora redundante)
    - _Requirements: 2.5_

  - [x] 7.4 Verificar teste exploratório (Property 1) agora passa
    - **Property 1: Expected Behavior** - Leitura Visual Unificada Completa
    - Re-executar testes da tarefa 5
    - **RESULTADO ESPERADO**: Testes PASSAM (dados visuais não são mais perdidos)
    - _Requirements: 2.5_

  - [x] 7.5 Verificar testes de preservação ainda passam
    - **Property 2: Preservation** - Interface de Análise Visual
    - Re-executar testes da tarefa 6
    - **RESULTADO ESPERADO**: Testes PASSAM (interface compatível)

- [x] 8. Checkpoint FASE 2 — Garantir todos os testes passam
  - Executar suite completa incluindo testes da FASE 1
  - Confirmar que leitura visual unificada retorna todos os dados
  - Perguntar ao usuário se há dúvidas antes de prosseguir para FASE 3

## FASE 3: Infraestrutura de Monitoramento (Timeframe, Worker, SSE)

- [x] 9. Escrever teste exploratório — Infraestrutura Ausente
  - **Property 1: Bug Condition** - Coluna Timeframe, Worker Vazio, SSE 404
  - **IMPORTANTE**: Escrever ANTES de implementar infraestrutura
  - **OBJETIVO**: Demonstrar que infraestrutura de monitoramento não funciona
  - Testar que INSERT com campo `timeframe` na tabela `genesis_alertas` falha (coluna inexistente)
  - Testar que `monitor_worker.py` passa `dados_extras` com valores zerados/null para detecção de anomalias
  - Testar que GET `/api/v1/alertas/stream` retorna 404 no backend Laravel
  - Rodar no código NÃO-CORRIGIDO — esperar FALHA (confirma infraestrutura ausente)
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 10. Escrever teste de preservação — Comportamento Existente do Worker e Alertas
  - **Property 2: Preservation** - Queries Existentes, Filtro de Score, Reconexão
  - **IMPORTANTE**: Seguir metodologia observation-first
  - Observar: queries existentes na tabela `genesis_alertas` funcionam sem campo timeframe
  - Observar: alertas com score < SCORE_MINIMO são filtrados e descartados
  - Observar: frontend mantém comportamento de reconexão com backoff quando SSE falha
  - Escrever testes que verificam:
    - Queries existentes continuam funcionando (DEFAULT na nova coluna)
    - Filtro de score mínimo continua ativo no worker
    - Reconexão SSE com backoff é preservada no frontend
  - Rodar no código NÃO-CORRIGIDO
  - **RESULTADO ESPERADO**: Testes PASSAM (baseline de comportamento preservado)
  - _Requirements: 3.3, 3.4, 3.7_

- [x] 11. Correção FASE 3 — Infraestrutura de Monitoramento

  - [x] 11.1 Adicionar coluna `timeframe` ao schema SQL
    - Adicionar `timeframe VARCHAR(10) NOT NULL DEFAULT '1h'` após coluna `corretora` em `criar_tabelas.sql`
    - Criar migration SQL: `ALTER TABLE genesis_alertas ADD COLUMN timeframe VARCHAR(10) NOT NULL DEFAULT '1h' AFTER corretora;`
    - Garantir que registros antigos recebem DEFAULT '1h' sem quebrar queries existentes
    - _Bug_Condition: INSERT com campo timeframe falha por coluna inexistente_
    - _Expected_Behavior: coluna aceita valores como '1h', '4h', '1d'_
    - _Preservation: queries existentes continuam funcionando com DEFAULT_
    - _Requirements: 2.4, 3.4_

  - [x] 11.2 Enriquecer `monitor_worker.py` com dados extras reais
    - Adicionar busca periódica de funding rate via REST API Binance (`/fapi/v1/premiumIndex`)
    - Adicionar busca de Open Interest via REST API (`/fapi/v1/openInterest`)
    - Passar dados reais para `calcular_indicadores_e_score` em vez de zeros/nulls
    - Acionar funções de detecção existentes (`detectar_funding_extremo`, `detectar_oi_spike`) com dados reais
    - Manter filtro de score mínimo (`SCORE_MINIMO`) para descartar alertas fracos
    - _Bug_Condition: dados_extras sempre {cvd_slope: 0, book_imbalance_ratio: null}_
    - _Expected_Behavior: dados reais de funding, OI passados para detecção de anomalias_
    - _Preservation: filtro de score mínimo e lógica de descarte preservados_
    - _Requirements: 2.3, 3.7_

  - [x] 11.3 Criar endpoint SSE no backend Laravel
    - Criar controller `AlertaStreamController` com método `stream`
    - Registrar rota `GET /api/v1/alertas/stream` em `routes/api.php`
    - Implementar polling na tabela `genesis_alertas` a cada 10 segundos (WHERE `enviado_sse = 0`)
    - Transmitir alertas novos excluindo campos `direcao` e `urgencia` do payload
    - Marcar `enviado_sse = 1` após envio bem-sucedido
    - Enviar `ping` (comentário SSE `: ping`) a cada 30s para manter conexão viva
    - Adicionar coluna `enviado_sse TINYINT(1) NOT NULL DEFAULT 0` à tabela `genesis_alertas`
    - Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
    - _Bug_Condition: rota /api/v1/alertas/stream retorna 404_
    - _Expected_Behavior: conexão SSE mantida, alertas transmitidos em tempo real_
    - _Preservation: reconexão com backoff no frontend preservada_
    - _Requirements: 2.2, 3.3_

  - [x] 11.4 Verificar teste exploratório (Property 1) agora passa
    - **Property 1: Expected Behavior** - Infraestrutura Funcional
    - Re-executar testes da tarefa 9
    - **RESULTADO ESPERADO**: Testes PASSAM (infraestrutura operacional)
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 11.5 Verificar testes de preservação ainda passam
    - **Property 2: Preservation** - Queries, Filtro, Reconexão
    - Re-executar testes da tarefa 10
    - **RESULTADO ESPERADO**: Testes PASSAM (zero regressões)
    - _Requirements: 3.3, 3.4, 3.7_

- [x] 12. Checkpoint FASE 3 — Garantir TODOS os testes passam
  - Executar suite completa de testes (FASE 1 + FASE 2 + FASE 3)
  - Confirmar que todos os 7 bugs estão corrigidos
  - Confirmar que nenhum comportamento existente foi quebrado
  - Perguntar ao usuário se há dúvidas ou ajustes necessários

## Testes de Integração (Pós-Correção)

- [x] 13. Testes de integração end-to-end
  - [x] 13.1 Testar fluxo completo: upload de imagem → leitura visual unificada → normalização de par → busca de dados (ADX real) → cálculo de score (com cap)
  - [x] 13.2 Testar worker: conexão WebSocket → recebimento de candle → dados extras reais → detecção de anomalias → gravação de alerta com timeframe
  - [x] 13.3 Testar SSE end-to-end: worker grava alerta → SSE detecta → frontend recebe (sem campos direcao/urgencia)
  - [x] 13.4 Testar que alertas antigos sem timeframe continuam funcionando com DEFAULT '1h'
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
