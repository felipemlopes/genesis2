# Documento de Requisitos de Bugfix

## Introdução

O sistema de análise Genesis Labs possui 7 bugs críticos identificados em relatório diagnóstico que comprometem a integridade dos dados entregues ao usuário, a infraestrutura de monitoramento em tempo real e a confiabilidade do score de confluência. Os bugs afetam desde dados técnicos falsos (ADX hardcoded), passando por infraestrutura inexistente (SSE, worker skeleton, coluna faltante), até lógica de normalização incorreta (par, score inflado) e perda de dados entre etapas visuais.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN o indicador ADX é solicitado via `obterIndicadorComFallback` em `adaptedDataFetcher.ts` THEN o sistema retorna o valor fixo 22.5 (constante hardcoded) em vez de calcular o ADX real, entregando dados falsos ao prompt do Gemini e ao usuário.

1.2 WHEN o frontend tenta conectar ao endpoint SSE `/api/alertas-stream` via `useAlertas.ts` THEN o sistema retorna 404/500 pois a rota não existe em `server.ts` nem em `routes/api.js`, causando loop infinito de reconexão e impossibilitando o monitoramento de oportunidades.

1.3 WHEN o `monitor_worker.py` é iniciado THEN o loop principal (`rodar_loop_principal`) inicia threads WebSocket mas o loop interno apenas faz `time.sleep(1)` sem processar dados reais, e as funções de detecção de anomalias não são acionadas por dados reais de exchange — o worker opera vazio.

1.4 WHEN um alerta é gravado na tabela `genesis_alertas` THEN o campo `timeframe` não existe no schema SQL (`criar_tabelas.sql`), impedindo que o pop-up exiba "BINANCE — 4H" e que o formulário de análise seja pré-preenchido com o timeframe correto.

1.5 WHEN o sistema processa uma imagem de gráfico THEN são feitas DUAS leituras visuais separadas (`scanChartMetadata` e `analyzeChart`) com prompts e schemas JSON diferentes, e os dados da Leitura 1 (suportes, resistências, trendlines, fibonacci, anotações) NÃO são passados para a Leitura 2 nem para o super-prompt final — dados visuais são perdidos entre etapas.

1.6 WHEN o par identificado pelo OCR termina em "USD" (ex: BTCUSD), "USDC" (ex: BTCUSDC), "BUSD" (ex: BTCBUSD) ou contém sufixos especiais (.P, PERP) THEN a lógica de normalização produz pares inválidos como BTCUSDCUSDT, BTCBUSDUSDT ou SOLUSDPUSDT, pois apenas concatena "T" ou "USDT" sem remover sufixos existentes.

1.7 WHEN dados técnicos estão ausentes (bloco técnico não presente) THEN o `scoringEngine.ts` divide os pontos por 65 e multiplica por 100, inflando artificialmente o score (ex: 40 pontos bullish sem técnico → 61.5 em vez de ser penalizado), gerando falsa confiança na análise.

### Expected Behavior (Correct)

2.1 WHEN o indicador ADX é solicitado via `obterIndicadorComFallback` THEN o sistema SHALL chamar `calcularADX(klinesData, period)` de `indicatorEngine.ts` e retornar os três valores reais (adx, diPlus, diMinus) calculados com Wilder's Smoothing, passando todos ao prompt do Gemini.

2.2 WHEN o frontend conecta ao endpoint SSE `/api/alertas-stream` THEN o sistema SHALL manter uma conexão Server-Sent Events ativa que faz polling na tabela `genesis_alertas` a cada 10 segundos e transmite alertas novos (sem os campos `direcao` e `urgencia`) ao cliente, eliminando o tag DEMO.

2.3 WHEN o `monitor_worker.py` é iniciado THEN o sistema SHALL conectar via WebSocket ao Binance Futures (`wss://fstream.binance.com/stream`), processar candles em tempo real, executar as 6 funções de detecção de anomalias com dados reais, e gravar alertas válidos na tabela `genesis_alertas` via API Laravel.

2.4 WHEN a tabela `genesis_alertas` é criada ou atualizada THEN o schema SHALL incluir a coluna `timeframe VARCHAR(10) NOT NULL DEFAULT '1h'` posicionada após a coluna `corretora`, permitindo armazenar e exibir o timeframe do alerta.

2.5 WHEN o sistema processa uma imagem de gráfico THEN SHALL realizar uma ÚNICA leitura visual unificada usando o modelo `gemini-3.1-pro-preview`, solicitando TODOS os dados (metadata, suportes, resistências, trendlines, fibonacci, padrões, indicadores detectados, EMAs) em uma única chamada, e SHALL passar o resultado completo tanto para `adaptedDataFetcher` quanto para o super-prompt final.

2.6 WHEN o par identificado pelo OCR contém sufixos de stablecoin (USDT, USDC, BUSD, USD, DAI, TUSD) ou caracteres especiais (.P, PERP, 1000) THEN o sistema SHALL primeiro remover TODOS os sufixos de stablecoin e caracteres especiais, e DEPOIS adicionar "USDT" ao símbolo base limpo, produzindo pares válidos (ex: BTCUSDC → BTC → BTCUSDT, SOLUSD.P → SOL → SOLUSDT).

2.7 WHEN dados técnicos estão ausentes THEN o `scoringEngine.ts` SHALL limitar (cap) o score final a um máximo de 65 pontos e SHALL adicionar uma flag `CONFIANCA_REDUZIDA_SEM_TECNICO` ao array de flags, sinalizando que a análise tem confiabilidade reduzida por falta de dados técnicos.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN o indicador ADX é solicitado e `klinesData` possui menos de 28 candles THEN o sistema SHALL CONTINUE TO retornar fallback (valor do gráfico via OCR ou null/INDISPONIVEL), mantendo o comportamento de fallback existente.

3.2 WHEN outros indicadores (EMA, RSI, MACD, Bollinger, ATR) são solicitados via `obterIndicadorComFallback` THEN o sistema SHALL CONTINUE TO calcular e retornar seus valores normalmente sem alteração na lógica existente.

3.3 WHEN o frontend não está conectado ao SSE ou o SSE é desconectado THEN o sistema SHALL CONTINUE TO funcionar normalmente sem travar, mantendo o comportamento de reconexão com backoff e exibindo alertas de teste quando disponíveis.

3.4 WHEN alertas existentes na tabela `genesis_alertas` não possuem timeframe (registros antigos) THEN o sistema SHALL CONTINUE TO funcionar com o valor default '1h' sem quebrar queries existentes.

3.5 WHEN o par identificado pelo OCR já está no formato correto (ex: BTCUSDT, ETHUSDT) THEN o sistema SHALL CONTINUE TO retornar o par sem modificação, preservando pares já válidos.

3.6 WHEN dados técnicos ESTÃO presentes (bloco técnico ativo) THEN o `scoringEngine.ts` SHALL CONTINUE TO calcular o score normalmente usando a escala completa de 0-100 pontos sem cap nem flag de confiança reduzida.

3.7 WHEN o `monitor_worker.py` detecta anomalias com score abaixo do mínimo configurado (`SCORE_MINIMO`) THEN o sistema SHALL CONTINUE TO filtrar e descartar esses alertas sem gravá-los no banco.
