# Documento de Requisitos — Audit Assertiveness Engine

## Introdução

Este documento especifica os requisitos para a Auditoria Final (Seção 6c) e as 5 Melhorias de Assertividade (Seção 6d) do sistema Genesis Labs. O objetivo é corrigir 12 defeitos críticos nos módulos Python de monitoramento (indicatorEngine.py, scoringEngine.py, monitor_worker.py) e implementar 5 melhorias que aumentam a precisão do scoring de sinais de trading.

A regra central é: nenhum campo pode chegar zerado ao ScoringEngine. Campo zerado = flag morta = score incorreto.

## Glossário

- **Monitor_Worker**: Módulo Python (monitor_worker.py) responsável por receber dados de mercado via WebSocket de 4 exchanges e orquestrar a análise de cada ativo.
- **IndicatorEngine**: Módulo Python (indicatorEngine.py) que calcula indicadores técnicos (EMA, RSI, ATR, ADX, MACD, Bollinger, VWAP, CVD slope, divergências, compressão de volatilidade).
- **ScoringEngine**: Módulo Python (scoringEngine.py) que recebe dados calculados e retorna um score final (0-100) com viés direcional e flags.
- **CVD**: Cumulative Volume Delta — diferença acumulada entre volume de compra e venda agressiva.
- **Book_Imbalance**: Razão entre volume de bids e asks nos primeiros 5 níveis do order book.
- **OI**: Open Interest — total de contratos em aberto em mercados futuros.
- **L/S_Ratio**: Razão entre posições Long e Short dos traders.
- **Fear_Greed_Index**: Índice de medo e ganância do mercado crypto (0-100).
- **ATR**: Average True Range — medida de volatilidade baseada em amplitude de candles.
- **EMA21**: Média Móvel Exponencial de 21 períodos.
- **ADX**: Average Directional Index — mede força de tendência (0-100).
- **MACD**: Moving Average Convergence Divergence — indicador de momentum.
- **Sessao_Mercado**: Janela horária de atividade de trading (Ásia, Londres, Nova York, Overnight).
- **Equal_Highs**: Topos de preço com diferença inferior a 0.15% entre si — níveis de liquidez.
- **Equal_Lows**: Fundos de preço com diferença inferior a 0.15% entre si — níveis de liquidez.
- **Cluster_Liquidacao**: Zona de preço onde concentram-se ordens de liquidação forçada.
- **aggTrade_WebSocket**: Stream WebSocket da Binance que transmite cada trade executado em tempo real.
- **depth5_WebSocket**: Stream WebSocket que transmite os 5 melhores níveis de bid/ask em tempo real.

## Requisitos

### Requisito 1: Correção do Limite ATR (Correção 1)

**User Story:** Como desenvolvedor do sistema, eu quero que o cálculo de ATR funcione corretamente com o número mínimo de candles, para que a detecção de compressão de volatilidade severa não fique permanentemente inativa.

#### Critérios de Aceitação

1. WHEN a função `calcular_atr` recebe candles com `len(candles) == periodo`, THE IndicatorEngine SHALL calcular e retornar o valor ATR válido (não None).
2. WHEN a função `calcular_atr` recebe candles com `len(candles) < periodo`, THE IndicatorEngine SHALL retornar None.
3. WHEN a função `detectar_compressao_volatilidade` calcula `atr_5` com exatamente 5 candles recentes, THE IndicatorEngine SHALL retornar um valor numérico positivo.
4. FOR ALL conjuntos de candles com tamanho >= periodo, parsing do ATR e retorno ao caller SHALL produzir valor equivalente (propriedade round-trip de consistência).

### Requisito 2: Imports Ausentes no Monitor Worker (Correção 2)

**User Story:** Como desenvolvedor do sistema, eu quero que todas as funções utilizadas do IndicatorEngine estejam importadas no monitor_worker, para que não ocorra NameError em tempo de execução.

#### Critérios de Aceitação

1. THE Monitor_Worker SHALL importar `calcular_ema_series` do IndicatorEngine.
2. THE Monitor_Worker SHALL importar `detectar_divergencia_rsi` do IndicatorEngine.
3. THE Monitor_Worker SHALL importar `identificar_equal_highs` do IndicatorEngine.
4. THE Monitor_Worker SHALL importar `identificar_equal_lows` do IndicatorEngine.
5. WHEN o Monitor_Worker é inicializado, THE Monitor_Worker SHALL carregar sem erro de importação (NameError).

### Requisito 3: Conexão da Divergência RSI (Correção 3)

**User Story:** Como analista de trading, eu quero que a divergência RSI seja efetivamente calculada e conectada ao scoring, para que sinais de reversão baseados em divergência influenciem o score final.

#### Critérios de Aceitação

1. WHEN candles suficientes estão disponíveis (>=20), THE Monitor_Worker SHALL gerar a série de valores RSI utilizando `calcular_ema_series` e `calcular_rsi`.
2. WHEN a série RSI está disponível, THE Monitor_Worker SHALL chamar `detectar_divergencia_rsi(candles, valores_rsi)`.
3. WHEN divergência RSI é detectada (BULLISH ou BEARISH), THE Monitor_Worker SHALL atribuir o resultado ao campo `divergencia_rsi` de dados_score.
4. THE Monitor_Worker SHALL substituir o valor hardcoded 'NENHUMA' pelo resultado real da função de detecção.

### Requisito 4: Conexão da Divergência CVD (Correção 4)

**User Story:** Como analista de trading, eu quero que a divergência CVD seja calculada e conectada ao scoring, para que falsos rompimentos sejam detectados antes de gerar alertas.

#### Critérios de Aceitação

1. WHEN dados de CVD acumulado estão disponíveis, THE Monitor_Worker SHALL calcular a divergência entre preço e CVD.
2. WHEN preço faz topos ascendentes e CVD faz topos descendentes, THE Monitor_Worker SHALL atribuir 'BEARISH' ao campo `divergencia_cvd` de dados_score.
3. WHEN preço faz fundos descendentes e CVD faz fundos ascendentes, THE Monitor_Worker SHALL atribuir 'BULLISH' ao campo `divergencia_cvd` de dados_score.
4. THE Monitor_Worker SHALL substituir o valor hardcoded None pelo resultado real do cálculo de divergência CVD.

### Requisito 5: Fear & Greed Index do Servidor (Correção 5)

**User Story:** Como analista de trading, eu quero que o índice Fear & Greed seja buscado da API alternative.me, para que o sentimento de mercado influencie a análise quando relevante.

#### Critérios de Aceitação

1. THE Monitor_Worker SHALL implementar o método `buscar_fear_greed()` que consulta `https://api.alternative.me/fng/`.
2. WHEN o método é chamado com cache válido (menos de 1 hora desde última busca), THE Monitor_Worker SHALL retornar o valor em cache sem nova requisição HTTP.
3. WHEN o cache expira (mais de 1 hora), THE Monitor_Worker SHALL realizar nova requisição HTTP e atualizar o cache.
4. IF a API retorna erro ou timeout, THEN THE Monitor_Worker SHALL retornar o último valor em cache (se disponível) ou None.
5. WHEN o valor fear_greed é obtido, THE Monitor_Worker SHALL atribuí-lo ao campo `fear_greed` de dados_score.

### Requisito 6: CVD via aggTrade WebSocket (Correção 6)

**User Story:** Como analista de trading, eu quero que o CVD seja calculado a partir de trades reais via WebSocket, para que o slope do CVD reflita pressão compradora/vendedora real e não fique zerado.

#### Critérios de Aceitação

1. THE Monitor_Worker SHALL implementar o método `_acumular_cvd()` que processa mensagens do stream aggTrade.
2. THE Monitor_Worker SHALL subscrever ao stream `<symbol>@aggTrade` da Binance WebSocket.
3. WHEN uma mensagem aggTrade é recebida, THE Monitor_Worker SHALL classificar o trade como compra (se `m == False`) ou venda (se `m == True`) e acumular no CVD.
4. WHEN candles são processados, THE Monitor_Worker SHALL calcular `cvd_slope` utilizando os últimos 10 valores acumulados via `calcular_cvd_slope()`.
5. THE Monitor_Worker SHALL substituir o valor hardcoded `cvd_slope = 0` pelo slope real calculado.
6. WHILE o WebSocket aggTrade está conectado, THE Monitor_Worker SHALL manter um buffer circular de no mínimo 60 amostras de CVD por ativo.

### Requisito 7: L/S Ratio de 4 Exchanges (Correção 7)

**User Story:** Como analista de trading, eu quero que o L/S Ratio seja buscado das 4 exchanges suportadas, para que as flags MERCADO_SOBRECOMPRADO e MERCADO_SOBREVENDIDO sejam ativadas com dados reais.

#### Critérios de Aceitação

1. THE Monitor_Worker SHALL implementar o método `buscar_ls_ratio(symbol)` que consulta APIs REST.
2. WHEN a exchange é Binance, THE Monitor_Worker SHALL consultar `/futures/data/globalLongShortAccountRatio`.
3. WHEN a exchange é Bybit, THE Monitor_Worker SHALL consultar o endpoint de L/S ratio equivalente.
4. WHEN a exchange é Bitget, THE Monitor_Worker SHALL consultar o endpoint de L/S ratio equivalente.
5. WHEN a exchange é OKX, THE Monitor_Worker SHALL consultar o endpoint de L/S ratio equivalente.
6. WHEN o L/S ratio é obtido, THE Monitor_Worker SHALL atribuir o valor ao campo `ls_ratio` de dados_score.
7. THE Monitor_Worker SHALL substituir o valor hardcoded None pelo ratio real agregado.
8. IF todas as APIs de L/S ratio falham, THEN THE Monitor_Worker SHALL retornar None sem interromper o processamento.

### Requisito 8: Book Imbalance via depth5 WebSocket (Correção 8)

**User Story:** Como analista de trading, eu quero que o book imbalance seja calculado a partir do order book em tempo real, para que pressão compradora/vendedora estrutural seja detectada.

#### Critérios de Aceitação

1. THE Monitor_Worker SHALL manter um `orderbook_cache` por ativo com os 5 melhores níveis de bid e ask.
2. THE Monitor_Worker SHALL subscrever ao stream `<symbol>@depth5@100ms` da Binance WebSocket.
3. WHEN uma mensagem depth5 é recebida, THE Monitor_Worker SHALL atualizar o `orderbook_cache` do ativo correspondente.
4. WHEN candles são processados, THE Monitor_Worker SHALL calcular `book_imbalance_ratio = (sum_bids - sum_asks) / (sum_bids + sum_asks)`.
5. THE Monitor_Worker SHALL substituir o valor hardcoded None pelo ratio real calculado.
6. IF o orderbook_cache está vazio para um ativo, THEN THE Monitor_Worker SHALL retornar None para book_imbalance_ratio.

### Requisito 9: preco_subindo via EMA21 (Correção 9)

**User Story:** Como analista de trading, eu quero que a variável `preco_subindo` reflita a direção da EMA21 ao invés de comparar apenas dois candles, para que um único candle bullish após tendência de baixa não distorça o score.

#### Critérios de Aceitação

1. WHEN candles suficientes estão disponíveis (>=22), THE Monitor_Worker SHALL calcular a EMA21 do período atual e do período anterior.
2. THE Monitor_Worker SHALL definir `preco_subindo = True` quando EMA21 atual > EMA21 anterior.
3. THE Monitor_Worker SHALL definir `preco_subindo = False` quando EMA21 atual <= EMA21 anterior.
4. THE Monitor_Worker SHALL substituir a lógica `preco_atual > preco_anterior` pela comparação de EMA21.

### Requisito 10: Persistência de OI no Banco de Dados (Correção 10)

**User Story:** Como operador do sistema, eu quero que o histórico de Open Interest seja persistido no banco de dados MySQL, para que reinícios do worker não percam o histórico e `oi_subindo` não retorne None após restart.

#### Critérios de Aceitação

1. THE Monitor_Worker SHALL implementar o método `_buscar_oi_banco(symbol)` que consulta o último OI registrado no MySQL.
2. THE Monitor_Worker SHALL implementar o método `_gravar_oi_banco(symbol, oi_value)` que persiste o OI atual no MySQL.
3. WHEN o Monitor_Worker é inicializado, THE Monitor_Worker SHALL carregar os últimos valores de OI do banco para o `_oi_cache`.
4. WHEN um novo valor de OI é obtido via API, THE Monitor_Worker SHALL gravar o valor no banco de dados.
5. WHEN o `_oi_cache` não possui valor anterior para um ativo, THE Monitor_Worker SHALL consultar o banco antes de retornar None.
6. IF a conexão com o banco falha, THEN THE Monitor_Worker SHALL utilizar o cache em memória como fallback sem interromper o processamento.

### Requisito 11: Reescrita do ScoringEngine — Score Técnico + Derivativos (Correção 10b, 11, 12)

**User Story:** Como product owner, eu quero que o score final seja composto exclusivamente por blocos Técnico (máx 55 pontos) e Derivativos (máx 45 pontos), para que o scoring seja determinístico e arredondado em múltiplos de 5.

#### Critérios de Aceitação

1. THE ScoringEngine SHALL calcular o score final como soma de Bloco_Técnico (máximo 55 pontos) e Bloco_Derivativos (máximo 45 pontos).
2. THE ScoringEngine SHALL remover os blocos Macro e Sentimento do cálculo do score final.
3. THE ScoringEngine SHALL arredondar o score final para o múltiplo de 5 mais próximo.
4. WHEN RSI está entre 50-65, THE ScoringEngine SHALL atribuir 7 pontos bullish ao bloco técnico.
5. WHEN RSI está entre 35-50, THE ScoringEngine SHALL atribuir 7 pontos bearish ao bloco técnico.
6. WHEN RSI > 70, THE ScoringEngine SHALL atribuir 3 pontos bearish (sobrecomprado).
7. WHEN RSI < 30, THE ScoringEngine SHALL atribuir 3 pontos bullish (sobrevendido).
8. WHEN `geo_score >= 3`, THE ScoringEngine SHALL atribuir pontos bullish (usando >= em vez de ==).
9. WHEN `geo_score <= -3`, THE ScoringEngine SHALL atribuir pontos bearish (usando <= em vez de ==).
10. WHEN `sent_moeda >= 3`, THE ScoringEngine SHALL atribuir pontos bullish (usando >= em vez de ==).
11. WHEN `sent_moeda <= -3`, THE ScoringEngine SHALL atribuir pontos bearish (usando <= em vez de ==).
12. FOR ALL inputs válidos, THE ScoringEngine SHALL retornar score entre 0 e 100 (invariante de range).

### Requisito 12: Liquidações Reais via Binance API (Melhoria 1)

**User Story:** Como analista de trading, eu quero detectar liquidações reais via endpoint `/fapi/v1/allForceOrders` da Binance, para que cascatas de liquidação sejam detectadas pela causa (ordens forçadas) e não apenas pelo efeito (movimento de preço).

#### Critérios de Aceitação

1. THE Monitor_Worker SHALL implementar o método `buscar_liquidacoes_recentes(symbol)` que consulta `https://fapi.binance.com/fapi/v1/allForceOrders`.
2. WHEN liquidações são obtidas, THE Monitor_Worker SHALL filtrar por janela de tempo configurável (padrão: últimos 5 minutos).
3. WHEN liquidações LONG concentram-se abaixo do preço atual, THE Monitor_Worker SHALL identificar cluster de liquidação abaixo.
4. WHEN liquidações SHORT concentram-se acima do preço atual, THE Monitor_Worker SHALL identificar cluster de liquidação acima.
5. WHEN clusters são identificados, THE Monitor_Worker SHALL atribuir os valores aos campos `cluster_liquidacao_acima` e `cluster_liquidacao_abaixo` de dados_score.
6. IF a API retorna erro ou está indisponível, THEN THE Monitor_Worker SHALL continuar sem dados de liquidação (retornar None).

### Requisito 13: Equal Highs e Equal Lows Conectados (Melhoria 2)

**User Story:** Como analista de trading, eu quero que as funções `identificar_equal_highs()` e `identificar_equal_lows()` sejam efetivamente chamadas e conectadas ao scoring, para que níveis de liquidez próximos ao preço atual influenciem o score.

#### Critérios de Aceitação

1. THE Monitor_Worker SHALL importar e chamar `identificar_equal_highs(candles)` e `identificar_equal_lows(candles)`.
2. WHEN equal highs são detectados a menos de 1.5% acima do preço atual, THE Monitor_Worker SHALL atribuir o nível mais próximo ao campo `cluster_liquidacao_acima`.
3. WHEN equal lows são detectados a menos de 1.5% abaixo do preço atual, THE Monitor_Worker SHALL atribuir o nível mais próximo ao campo `cluster_liquidacao_abaixo`.
4. WHEN tanto liquidações reais (Requisito 12) quanto equal levels estão disponíveis, THE Monitor_Worker SHALL utilizar o maior valor (mais próximo ao preço) entre os dois como cluster final.
5. THE Monitor_Worker SHALL não sobrescrever um cluster de liquidação real com um equal level mais distante.

### Requisito 14: ADX Zona 20-25 — Scoring Proporcional (Melhoria 3)

**User Story:** Como analista de trading, eu quero que ADX entre 20-25 receba pontuação proporcional, para que tendências nascentes não fiquem em zona cega do scoring.

#### Critérios de Aceitação

1. WHEN ADX >= 30, THE ScoringEngine SHALL atribuir 8 pontos na direção do preço.
2. WHEN ADX está entre 25 e 30, THE ScoringEngine SHALL atribuir 5 pontos na direção do preço.
3. WHEN ADX está entre 20 e 25, THE ScoringEngine SHALL atribuir 3 pontos na direção do preço.
4. WHEN ADX < 20, THE ScoringEngine SHALL atribuir 1 ponto neutro e adicionar flag RANGING_SEM_TENDENCIA.
5. FOR ALL valores de ADX entre 0 e 100, THE ScoringEngine SHALL atribuir pontuação (sem zona morta).

### Requisito 15: MACD Zero Line Crossover no Scoring (Melhoria 4)

**User Story:** Como analista de trading, eu quero que o cruzamento do MACD pela linha zero seja detectado e pontuado, para que mudanças de regime de curto-médio prazo influenciem o score.

#### Critérios de Aceitação

1. WHEN MACD atual > 0 e MACD do candle anterior <= 0, THE Monitor_Worker SHALL identificar `macd_cruza_zero = 'BULLISH'`.
2. WHEN MACD atual < 0 e MACD do candle anterior >= 0, THE Monitor_Worker SHALL identificar `macd_cruza_zero = 'BEARISH'`.
3. WHEN `macd_cruza_zero == 'BULLISH'`, THE ScoringEngine SHALL atribuir +5 pontos bullish e adicionar flag MACD_ZERO_CROSS_BULL.
4. WHEN `macd_cruza_zero == 'BEARISH'`, THE ScoringEngine SHALL atribuir +5 pontos bearish e adicionar flag MACD_ZERO_CROSS_BEAR.
5. THE Monitor_Worker SHALL calcular MACD do candle anterior utilizando `closes[:-1]` e comparar com MACD atual.

### Requisito 16: Multiplicador de Sessão de Mercado (Melhoria 5)

**User Story:** Como analista de trading, eu quero que o score final seja ajustado por um multiplicador de sessão, para que alertas durante sessões de baixa liquidez (Ásia, Overnight) tenham score reduzido e gerem menos falsos positivos.

#### Critérios de Aceitação

1. THE Monitor_Worker SHALL implementar o método `obter_multiplicador_sessao()` que retorna um fator baseado na hora UTC atual.
2. WHILE a hora UTC está entre 0:00 e 8:00 (sessão Ásia), THE Monitor_Worker SHALL retornar multiplicador 0.85.
3. WHILE a hora UTC está entre 8:00 e 13:00 (sessão Londres), THE Monitor_Worker SHALL retornar multiplicador 0.95.
4. WHILE a hora UTC está entre 13:00 e 21:00 (sessão Nova York), THE Monitor_Worker SHALL retornar multiplicador 1.00.
5. WHILE a hora UTC está entre 21:00 e 0:00 (sessão Overnight), THE Monitor_Worker SHALL retornar multiplicador 0.90.
6. WHEN o score final é calculado, THE Monitor_Worker SHALL aplicar `score_final = round(score_final * multiplicador)` antes de verificar o filtro de score mínimo.
7. THE Monitor_Worker SHALL manter o score entre 0 e 100 após aplicação do multiplicador (invariante de range).
