# Plano de Implementação: Audit Assertiveness Engine

## Visão Geral

Implementação sequencial das 12 correções (Seção 6c) e 5 melhorias de assertividade (Seção 6d) nos módulos Python do Genesis Labs. Cada tarefa depende das anteriores. Linguagem: Python. Testes de propriedade com Hypothesis em `monitor/tests/test_properties.py`.

## Tarefas

- [x] 1. Corr.1 — Correção do boundary ATR (indicatorEngine.py)
  - [x] 1.1 Alterar condição `len(candles) <= periodo` para `len(candles) < periodo` na função `calcular_atr`
    - Arquivo: `monitor/indicatorEngine.py`
    - Mudar linha `if len(candles) <= periodo:` para `if len(candles) < periodo:`
    - _Requisitos: 1.1, 1.2, 1.3_
  - [ ]* 1.2 Escrever teste de propriedade para ATR boundary
    - **Propriedade 1: ATR Boundary — retorno válido na fronteira**
    - Gerar candles aleatórios com `high > low > 0`, testar `len == periodo` retorna float positivo e `len < periodo` retorna None
    - Criar arquivo `monitor/tests/test_properties.py` com setup Hypothesis
    - **Valida: Requisitos 1.1, 1.2**

- [x] 2. Corr.2 — Imports ausentes no monitor_worker.py
  - [x] 2.1 Adicionar imports de `calcular_ema_series`, `detectar_divergencia_rsi`, `identificar_equal_highs`, `identificar_equal_lows`
    - Arquivo: `monitor/monitor_worker.py`
    - Atualizar bloco de import do `indicatorEngine`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Corr.10 — Persistência de OI no MySQL (monitor_worker.py)
  - [x] 3.1 Implementar `_buscar_oi_banco(symbol)` e `_gravar_oi_banco(symbol, oi_value)`
    - Arquivo: `monitor/monitor_worker.py`
    - Criar tabela `oi_historico` via CREATE IF NOT EXISTS na inicialização
    - Carregar últimos valores de OI do banco no `__init__`
    - Gravar novo OI após cada busca via API
    - Fallback para cache em memória se conexão MySQL falhar
    - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - [ ]* 3.2 Escrever teste de propriedade para OI round trip
    - **Propriedade 7: OI persistence — round trip**
    - Gerar pares (symbol, oi_valor), gravar e ler, verificar igualdade
    - **Valida: Requisitos 10.1, 10.2, 10.3, 10.4, 10.5**

- [x] 4. Corr.6 — CVD via aggTrade WebSocket (monitor_worker.py)
  - [x] 4.1 Implementar `_acumular_cvd(symbol, trade_msg)` e buffer circular CVD
    - Arquivo: `monitor/monitor_worker.py`
    - Adicionar `self._cvd_buffers = {}` com `collections.deque(maxlen=100)` por ativo
    - Subscrever ao stream `<symbol>@aggTrade` no WebSocket Binance
    - Classificar trade: `m == False` → compra (soma CVD), `m == True` → venda (subtrai CVD)
    - Snapshot CVD a cada ~1 minuto no buffer
    - _Requisitos: 6.1, 6.2, 6.3, 6.6_
  - [x] 4.2 Implementar `_calcular_cvd_slope_real(symbol)` e conectar ao dados_score
    - Retornar 0 se buffer < 60 amostras, senão chamar `calcular_cvd_slope()` com últimos 10 valores
    - Substituir `cvd_slope = 0` hardcoded pelo slope real
    - _Requisitos: 6.4, 6.5_
  - [ ]* 4.3 Escrever teste de propriedade para CVD buffer mínimo
    - **Propriedade 6: CVD buffer mantém mínimo de amostras**
    - Gerar sequências de trades, verificar threshold de 60 amostras
    - **Valida: Requisitos 6.5, 6.6**

- [x] 5. Corr.7 — L/S Ratio de 4 exchanges (monitor_worker.py)
  - [x] 5.1 Implementar `buscar_ls_ratio(symbol)` com consulta a Binance, Bybit, Bitget e OKX
    - Arquivo: `monitor/monitor_worker.py`
    - Binance: `/futures/data/globalLongShortAccountRatio`
    - Bybit: `/v5/market/account-ratio`
    - Bitget: `/api/v2/mix/market/account-long-short`
    - OKX: `/api/v5/rubik/stat/contracts-long-short-ratio`
    - Retornar média aritmética dos ratios obtidos, None se todas falham
    - Conectar ao campo `ls_ratio_longs` de dados_score
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  - [ ]* 5.2 Escrever teste de propriedade para L/S Ratio range
    - **Propriedade 12: L/S Ratio — range válido**
    - Gerar respostas de APIs mockadas, verificar retorno ∈ [0.0, 1.0]
    - **Valida: Requisitos 7.1, 7.6, 7.7**

- [x] 6. Corr.8 — Book Imbalance via depth5 WebSocket (monitor_worker.py)
  - [x] 6.1 Implementar `_atualizar_orderbook(symbol, depth_msg)` e `_calcular_book_imbalance(symbol)`
    - Arquivo: `monitor/monitor_worker.py`
    - Adicionar `self._orderbook_cache = {}` por ativo com 5 níveis bid/ask
    - Subscrever ao stream `<symbol>@depth5@100ms` no WebSocket Binance
    - Calcular `book_imbalance_ratio = (sum_bids - sum_asks) / (sum_bids + sum_asks)`
    - Retornar None se cache vazio
    - Substituir hardcoded None pelo ratio real no dados_score
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  - [ ]* 6.2 Escrever teste de propriedade para Book Imbalance range
    - **Propriedade 10: Book imbalance — range invariant**
    - Gerar orderbooks com bids/asks > 0, verificar retorno ∈ [-1.0, 1.0]
    - **Valida: Requisitos 8.4, 8.5**

- [x] 7. Checkpoint — Verificar que WebSocket streams e buffers funcionam
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Corr.3 — Conexão da Divergência RSI (monitor_worker.py)
  - [x] 8.1 Gerar série de valores RSI e chamar `detectar_divergencia_rsi`
    - Arquivo: `monitor/monitor_worker.py`
    - Usar `calcular_ema_series` para gerar série RSI nos últimos 20+ candles
    - Chamar `detectar_divergencia_rsi(candles, valores_rsi)`
    - Substituir hardcoded `'NENHUMA'` pelo resultado real no campo `divergencia_rsi`
    - _Requisitos: 3.1, 3.2, 3.3, 3.4_

- [x] 9. Corr.4 — Conexão da Divergência CVD (monitor_worker.py)
  - [x] 9.1 Calcular divergência entre preço e CVD e conectar ao dados_score
    - Arquivo: `monitor/monitor_worker.py`
    - Comparar topos de preço com topos de CVD nos últimos candles
    - Preço topos ascendentes + CVD topos descendentes → 'BEARISH'
    - Preço fundos descendentes + CVD fundos ascendentes → 'BULLISH'
    - Substituir hardcoded None pelo resultado real no campo `divergencia_cvd`
    - _Requisitos: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 9.2 Escrever teste de propriedade para campos antes hardcoded
    - **Propriedade 8: Campos antes hardcoded agora populados**
    - Gerar candles ≥ 20 com dados de mercado disponíveis, verificar que `divergencia_rsi`, `divergencia_cvd`, `cvd_slope` não são os valores hardcoded originais
    - **Valida: Requisitos 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.5, 6.5, 7.6**

- [x] 10. Corr.5 — Fear & Greed Index (monitor_worker.py)
  - [x] 10.1 Implementar `buscar_fear_greed()` com cache de 1 hora
    - Arquivo: `monitor/monitor_worker.py`
    - API: `GET https://api.alternative.me/fng/` → `response['data'][0]['value']`
    - Cache: `self._fear_greed_cache` e `self._fear_greed_timestamp`
    - Se `time.time() - timestamp < 3600`, retorna cache
    - Se API falha, retorna último cache ou None
    - Conectar ao campo `fear_greed` de dados_score
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 11. Corr.9 — preco_subindo via EMA21 (monitor_worker.py)
  - [x] 11.1 Substituir lógica de `preco_subindo` por comparação de EMA21
    - Arquivo: `monitor/monitor_worker.py`
    - Calcular `ema21_atual = calcular_ema(closes, 21)` e `ema21_anterior = calcular_ema(closes[:-1], 21)`
    - `preco_subindo = ema21_atual > ema21_anterior` (fallback para comparação de 2 candles se EMA indisponível)
    - _Requisitos: 9.1, 9.2, 9.3, 9.4_

- [x] 12. Corr.10b+11+12 — Reescrita do ScoringEngine (scoringEngine.py)
  - [x] 12.1 Reescrever `calcular_score()` com Bloco Técnico (max 55pts) + Bloco Derivativos (max 45pts)
    - Arquivo: `monitor/scoringEngine.py`
    - Remover blocos Macro e Sentimento do cálculo do score
    - Bloco Técnico: EMA200, RSI, Divergência RSI, ADX proporcional, MACD signal, MACD zero cross, Compressão
    - Bloco Derivativos: CVD slope, Book Imbalance, Divergência CVD, Funding, OI, L/S Ratio, Clusters Liquidação
    - Arredondar score final para múltiplo de 5: `round(score / 5) * 5`
    - Corrigir comparadores: `geo_score >= 3` e `<= -3`, `sent_moeda >= 3` e `<= -3`
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12_
  - [x] 12.2 Implementar ADX scoring proporcional (Melhoria 3)
    - ADX >= 30 → 8pts; 25-30 → 5pts; 20-25 → 3pts; < 20 → 1pt neutro + flag RANGING_SEM_TENDENCIA
    - _Requisitos: 14.1, 14.2, 14.3, 14.4, 14.5_
  - [x] 12.3 Implementar MACD zero cross scoring
    - `macd_cruza_zero == 'BULLISH'` → +5pts bullish + flag MACD_ZERO_CROSS_BULL
    - `macd_cruza_zero == 'BEARISH'` → +5pts bearish + flag MACD_ZERO_CROSS_BEAR
    - _Requisitos: 15.3, 15.4_
  - [ ]* 12.4 Escrever teste de propriedade para invariantes do score
    - **Propriedade 2: Invariantes do Score Final**
    - Gerar dados_score com campos em ranges válidos, verificar: 0 <= score <= 100, score % 5 == 0, bloco_tecnico <= 55, bloco_derivativos <= 45
    - **Valida: Requisitos 11.1, 11.3, 11.12, 16.7**
  - [ ]* 12.5 Escrever teste de propriedade para Macro não afeta score
    - **Propriedade 3: Macro e Sentimento não afetam score**
    - Gerar dados_score, variar campos macro/sentimento, comparar que score_final não muda
    - **Valida: Requisito 11.2**
  - [ ]* 12.6 Escrever teste de propriedade para ADX sem zona morta
    - **Propriedade 4: ADX scoring sem zona morta**
    - Gerar ADX ∈ [0, 100] e preco_subindo ∈ {True, False}, verificar contribuição > 0
    - **Valida: Requisitos 14.1, 14.2, 14.3, 14.4, 14.5**

- [x] 13. Checkpoint — Verificar scoring reescrito e correções integradas
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Melhoria 1 — Liquidações reais via Binance API (monitor_worker.py)
  - [x] 14.1 Implementar `buscar_liquidacoes_recentes(symbol, janela_minutos=5)`
    - Arquivo: `monitor/monitor_worker.py`
    - API: `GET https://fapi.binance.com/fapi/v1/allForceOrders?symbol={symbol}`
    - Filtrar por janela de tempo (últimos 5 minutos)
    - Liquidações LONG abaixo do preço → `cluster_abaixo`; SHORT acima → `cluster_acima`
    - Retornar preço médio ponderado por quantidade do cluster mais próximo
    - Conectar aos campos `cluster_liquidacao_acima` e `cluster_liquidacao_abaixo` de dados_score
    - Se API falha, retornar None
    - _Requisitos: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  - [ ]* 14.2 Escrever teste de propriedade para classificação de clusters
    - **Propriedade 11: Classificação de clusters de liquidação**
    - Gerar liquidações + preço, verificar LONG abaixo → cluster_abaixo, SHORT acima → cluster_acima
    - **Valida: Requisitos 12.3, 12.4, 12.5, 13.2, 13.3, 13.4, 13.5**

- [x] 15. Melhoria 2 — Equal Highs/Lows conectados (monitor_worker.py)
  - [x] 15.1 Chamar `identificar_equal_highs` e `identificar_equal_lows`, conectar ao cluster_liquidacao
    - Arquivo: `monitor/monitor_worker.py`
    - Filtrar níveis a menos de 1.5% do preço atual
    - Comparar com clusters de liquidações reais: usar o mais próximo ao preço
    - Nunca sobrescrever cluster real com equal level mais distante
    - _Requisitos: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 16. Melhoria 4 — MACD Zero Cross detecção (monitor_worker.py)
  - [x] 16.1 Implementar `_detectar_macd_zero_cross(closes)` no monitor_worker
    - Arquivo: `monitor/monitor_worker.py`
    - Calcular MACD atual (`closes`) e MACD anterior (`closes[:-1]`)
    - Se `macd_atual > 0` e `macd_anterior <= 0` → 'BULLISH'
    - Se `macd_atual < 0` e `macd_anterior >= 0` → 'BEARISH'
    - Conectar resultado ao campo `macd_cruza_zero` de dados_score
    - _Requisitos: 15.1, 15.2, 15.5_
  - [ ]* 16.2 Escrever teste de propriedade para MACD zero cross
    - **Propriedade 9: MACD zero cross — detecção correta de cruzamento**
    - Gerar pares (macd_anterior, macd_atual) com mudança de sinal, verificar resultado correto
    - **Valida: Requisitos 15.1, 15.2, 15.3, 15.4, 15.5**

- [x] 17. Melhoria 5 — Multiplicador de sessão (monitor_worker.py)
  - [x] 17.1 Implementar `obter_multiplicador_sessao()` e aplicar ao score final
    - Arquivo: `monitor/monitor_worker.py`
    - Ásia (00:00–08:00 UTC) → 0.85; Londres (08:00–13:00) → 0.95; NY (13:00–21:00) → 1.00; Overnight (21:00–00:00) → 0.90
    - Aplicar `score_final = round(score_final * multiplicador)` após cálculo do scoring
    - Manter score entre 0 e 100 após multiplicador
    - Aplicar antes de verificar filtro de score mínimo
    - _Requisitos: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_
  - [ ]* 17.2 Escrever teste de propriedade para multiplicador de sessão
    - **Propriedade 5: Multiplicador de sessão — mapeamento correto**
    - Gerar hora ∈ [0, 24), verificar multiplicador correto e score * mult ∈ [0, 100]
    - **Valida: Requisitos 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7**

- [x] 18. Checkpoint final — Validação completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tarefas marcadas com `*` são opcionais (testes de propriedade) e podem ser puladas para MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Testes de propriedade usam Hypothesis e validam propriedades universais de corretude
- Ordem de execução é crítica: cada tarefa depende das anteriores
- A reescrita do scoringEngine (tarefa 12) incorpora ADX proporcional (Melhoria 3) e MACD zero cross scoring (Melhoria 4)
