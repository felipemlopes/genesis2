# Implementation Plan: Genesis Cérebro Análise

## Overview

Implementação completa do pipeline de análise de trading do Genesis Labs, incluindo suporte multi-exchange com fallback, indicadores técnicos, scoring unificado (Técnico 55pts + Derivativos 45pts), análise Wyckoff, Volume Profile, Motor de Execução com Plano A/B, e Micro Radar em tempo real. O plano segue a prioridade CRÍTICA definida no documento fonte.

## Tasks

- [x] 1. Infraestrutura de banco de dados e ExchangeRouter
  - [x] 1.1 Criar migration para tabela `oi_historico` com campo exchange
    - Criar migration Laravel com colunas: id, symbol, exchange (VARCHAR 20, default 'BINANCE'), oi_valor (DOUBLE), created_at
    - Criar índice composto idx_symbol_exchange_created (symbol, exchange, created_at DESC)
    - Criar model Eloquent `OiHistorico`
    - _Requirements: 4.1_

  - [x] 1.2 Implementar ExchangeRouter com detecção de exchange e fallback
    - Verificar e ajustar ExchangeRouter::detectar() para retornar exchange correta a partir de texto OCR
    - Validar lógica de fallback individual por endpoint (OI, funding, LSR, CVD) → Binance
    - Validar ativação de `aviso_liquidez` quando OI=0 E funding=0 com fallback total
    - Validar `alerta_hibrido` quando dados vêm de múltiplas fontes
    - Garantir normalização da resposta com todos os campos: oi, funding_rate, long_short_ratio, cvd, fonte_primaria, fonte_fallback, alerta_hibrido, aviso_liquidez
    - _Requirements: 1.3, 1.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 1.3 Write property tests for ExchangeRouter
    - **Property 1: Detecção de exchange via texto**
    - **Property 2: Fallback para Binance em endpoints individuais**
    - **Property 3: Aviso de liquidez insuficiente**
    - **Property 4: Normalização da resposta do ExchangeRouter**
    - **Validates: Requirements 1.3, 1.4, 3.2, 3.3, 3.4, 3.5, 3.6**

  - [x] 1.4 Criar BybitService com endpoints de derivativos
    - Implementar getOpenInterest(), getFundingRate(), getLongShortRatio(), getCvd()
    - Usar API v5 Bybit: `/v5/market/open-interest`, `/v5/market/funding/history`, `/v5/market/account-ratio`
    - Cache com TTL 300s via CacheManager
    - _Requirements: 3.1_

  - [x] 1.5 Criar BitgetService com endpoints de derivativos
    - Implementar getOpenInterest(), getFundingRate(), getLongShortRatio(), getCvd()
    - Usar API v2 Bitget: `/api/v2/mix/market/open-interest`, `/api/v2/mix/market/current-fund-rate`
    - Cache com TTL 300s via CacheManager
    - _Requirements: 3.1_

  - [x] 1.6 Criar OkxService com endpoints de derivativos
    - Implementar getOpenInterest(), getFundingRate(), getLongShortRatio(), getCvd()
    - Usar API v5 OKX: `/api/v5/public/open-interest`, `/api/v5/public/funding-rate`
    - Cache com TTL 300s via CacheManager
    - _Requirements: 3.1_

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Correções Python — IndicatorEngine
  - [x] 3.1 Corr.1: Fix calcular_atr() boundary condition
    - Alterar condição de `if len(candles) < periodo` para `if len(candles) <= periodo` (precisa de pelo menos periodo+1 candles para calcular TR)
    - Arquivo: `monitor/indicatorEngine.py`
    - _Requirements: 5.5_

  - [x] 3.2 Corr.2: Garantir imports corretos em monitor_worker.py
    - Verificar que `calcular_cvd_slope`, `detectar_compressao_volatilidade`, `detectar_divergencia_rsi`, `identificar_equal_highs`, `identificar_equal_lows` estão importados
    - Verificar import de `calcular_score` de scoringEngine
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 5.10, 17.2_

  - [x] 3.3 Corr.9: Implementar preco_subindo via EMA21
    - Verificar que `calcular_indicadores_e_score()` calcula `preco_subindo` comparando EMA21 atual com EMA21 do candle anterior
    - Manter fallback para comparação de 2 candles quando EMA21 indisponível
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 6.1, 6.2_

  - [ ]* 3.4 Write property tests for IndicatorEngine
    - **Property 6: Indicadores dentro de limites válidos**
    - **Property 7: MACD histogram é diferença de macd e signal**
    - **Property 8: VWAP entre extremos do dia**
    - **Property 9: CVD slope via regressão linear**
    - **Property 10: Indicadores retornam None sem exceção para inputs inválidos**
    - **Property 11: preco_subindo determinado pela EMA21**
    - **Validates: Requirements 5.1-5.11, 6.1, 6.2**

  - [x] 3.5 Implementar identificar_equal_highs e identificar_equal_lows
    - Verificar implementação com tolerância 0.15% nos últimos 100 candles
    - Garantir retorno de lista de valores únicos
    - Arquivo: `monitor/indicatorEngine.py`
    - _Requirements: 19.1, 19.2, 19.3_

  - [ ]* 3.6 Write property test for equal highs/lows
    - **Property 46: Equal highs/lows detecção e unicidade**
    - **Validates: Requirements 19.1, 19.2, 19.3**

- [x] 4. Correções Python — ScoringEngine completo
  - [x] 4.1 Reescrever scoringEngine.py com arquitetura 55/45
    - Bloco Técnico (max 55pts): EMA200(8), RSI(7), Divergência RSI(3), ADX proporcional(8), MACD signal(7), MACD zero cross(5), Compressão(7)
    - Bloco Derivativos (max 45pts): CVD slope(10), Book Imbalance(5), Divergência CVD(10), Funding 5 faixas(8), OI direcional(8), L/S Ratio(5), Clusters Liquidação(2+2)
    - Fórmula: score = 50 + (bullish - bearish) / 2, arredondar múltiplo de 5, clamp [0,100]
    - 7 níveis de viés: LONG_FORTE(>84), LONG_MODERADO(70-84), LONG_LEVE(55-69), NEUTRO(45-54), SHORT_LEVE(31-44), SHORT_MODERADO(16-30), SHORT_FORTE(<16)
    - Confiabilidade: ALTA (tech+deriv concordam >5pts diff), BAIXA (discordam), MEDIA (outros)
    - Macro/Sentimento apenas como flags (não pontuam)
    - Arquivo: `monitor/scoringEngine.py`
    - _Requirements: 7.1-7.4, 8.1-8.2, 9.1-9.7, 10.5, 16.1-16.6, 18.1-18.2, 21.1-21.5, 22.1-22.4, 23.1-23.2_

  - [ ]* 4.2 Write property tests for ScoringEngine Python
    - **Property 12: ADX proporcional no scoring**
    - **Property 13: MACD zero cross no scoring**
    - **Property 15: Caps dos blocos de scoring**
    - **Property 16: Score final no range [0,100] e múltiplo de 5**
    - **Property 17: Classificação do viés corresponde ao score**
    - **Property 18: Macro e sentimento geram apenas flags sem afetar score**
    - **Property 19: Cálculo de confiabilidade**
    - **Property 20: None não pontua no ScoringEngine**
    - **Property 31: Funding rate com 5 faixas no scoring**
    - **Property 32: OI direcional com preço no scoring**
    - **Property 33: Divergência CVD no scoring**
    - **Property 35: Flags macro/sentimento geradas corretamente**
    - **Property 45: Clusters de liquidação no scoring**
    - **Validates: Requirements 7-9, 10.5, 16, 18, 21-23**

  - [x] 4.3 Implementar multiplicador de sessão no MonitorWorker
    - Ásia (00:00-08:00 UTC) → 0.85
    - Londres (08:00-13:00 UTC) → 0.95
    - Nova York (13:00-21:00 UTC) → 1.00
    - Overnight (21:00-00:00 UTC) → 0.90
    - Aplicar ao score final antes de disparar alertas
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 11.1-11.4_

  - [ ]* 4.4 Write property test for session multiplier
    - **Property 21: Multiplicador de sessão correto por hora UTC**
    - **Validates: Requirements 11.1-11.4**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Correções Python — MonitorWorker (CVD, Book, Alertas)
  - [x] 6.1 Corr.5: Implementar buscar_fear_greed() via alternative.me
    - GET https://api.alternative.me/fng/ → retorna {data: [{value: "25"}]}
    - Cache de 1 hora em self._fear_greed_cache + self._fear_greed_timestamp
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 25.3_

  - [x] 6.2 Corr.6: CVD via aggTrade WebSocket
    - Verificar que `_acumular_cvd()` processa mensagens aggTrade corretamente
    - Buyer is taker (m=False) → soma CVD; Seller is taker (m=True) → subtrai
    - Snapshot a cada 60s em buffer circular de 100 posições
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 17.2_

  - [x] 6.3 Corr.7: Implementar buscar_ls_ratio() para 4 exchanges
    - Binance: /futures/data/globalLongShortAccountRatio
    - Bybit: /v5/market/account-ratio
    - Bitget: /api/v2/mix/market/long-short-ratio
    - OKX: /api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader
    - Retornar ratio normalizado (0-1 range)
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 9.2_

  - [x] 6.4 Corr.8: Book Imbalance via depth WebSocket
    - Verificar que `_atualizar_orderbook()` armazena top 5 levels bid/ask
    - Verificar que `_calcular_book_imbalance()` retorna (sum_bids - sum_asks) / (sum_bids + sum_asks)
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 17.3, 17.4_

  - [x] 6.5 Corr.3 + Corr.4: Conectar divergência RSI e CVD no scoring
    - Verificar que `calcular_indicadores_e_score()` passa divergencia_rsi e divergencia_cvd ao dados_score
    - Verificar chamada a `_calcular_divergencia_cvd()` passando candles e symbol
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 5.9, 23.3_

  - [x] 6.6 Corr.10: Persistência de OI no servidor DB
    - Verificar que `_criar_tabela_oi()` cria tabela com campo exchange
    - Verificar que `_carregar_oi_banco()` carrega últimos valores na inicialização
    - Verificar que `_gravar_oi_banco()` persiste novos valores com exchange
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ]* 6.7 Write property tests for MonitorWorker alerts
    - **Property 36: Buffer CVD circular com tamanho máximo 100**
    - **Property 37: Orderbook cache limita a 5 níveis**
    - **Property 38: Book imbalance entre -1 e 1**
    - **Property 39: Alerta SPIKE_VOLUME quando volume > 3× SMA20**
    - **Property 40: Alerta MOVIMENTO_BRUSCO quando variação > 1.5%**
    - **Property 41: Alerta FUNDING_EXTREMO por thresholds**
    - **Property 42: Alerta OI_SPIKE quando variação > 5%**
    - **Property 43: Deduplicação de alertas em 300 segundos**
    - **Property 44: Filtro de volume mínimo diário**
    - **Validates: Requirements 17.2-17.12**

  - [x] 6.8 Implementar MACD zero cross detection no MonitorWorker
    - Verificar que `_detectar_macd_zero_cross()` compara MACD atual vs anterior
    - Retorna 'BULLISH' quando negativo→positivo, 'BEARISH' quando positivo→negativo
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 8.3_

  - [ ]* 6.9 Write property test for MACD zero cross
    - **Property 14: Detecção de MACD zero cross**
    - **Validates: Requirements 8.3**

  - [ ]* 6.10 Write property test for divergência CVD detection
    - **Property 34: Detecção de divergência CVD por 3 pontos**
    - **Validates: Requirements 23.3**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Melhorias Monitor (Liquidações, Equal Levels, SCORE_MINIMO)
  - [x] 8.1 Implementar detecção LIQUIDATION_CASCADE
    - Verificar critério: 3 candles consecutivos mesma direção, variação total > 1.5%, volume 2x acima da média
    - Alerta com urgência ALTA
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 17.10_

  - [x] 8.2 Ajustar SCORE_MINIMO para 65
    - Alterar constante SCORE_MINIMO de 68 para 65
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: (Micro Radar Correção D)_

  - [x] 8.3 Implementar _carregar_historico_inicial() — 200 candles on startup
    - No __init__ do MonitorWorker, para cada par em PARES_MONITORADOS, buscar 200 candles via REST API
    - Armazenar em self.candles_cache[symbol]
    - _Requirements: (Micro Radar Correção A)_

  - [x] 8.4 Bloquear alertas consecutivos do mesmo par
    - Se o último alerta OPORTUNIDADE disparado foi para o mesmo par, bloquear até que outro par gere alerta
    - _Requirements: (Micro Radar Correção B)_

  - [x] 8.5 Disparar alerta OPORTUNIDADE quando score passa threshold
    - Ao calcular score via `calcular_indicadores_e_score()`, se score_final >= SCORE_MINIMO, disparar alerta tipo OPORTUNIDADE
    - Incluir score, viés e motivos no alerta
    - _Requirements: (Micro Radar Correção C)_

  - [x] 8.6 Chamar detectar_book_imbalance() em processar_candle()
    - Integrar `_calcular_book_imbalance()` no fluxo de processamento de candle
    - Passar resultado no dados_extras para calcular_indicadores_e_score()
    - _Requirements: (Micro Radar Correção E)_

- [x] 9. TechnicalAnalysisService — Volume Profile e Wyckoff (PHP)
  - [x] 9.1 Verificar/implementar calcularVolumeProfile() completo
    - 50 bins, distribuição proporcional de volume nos bins cobertos por cada candle
    - POC = bin com maior volume acumulado
    - HVN = bins com volume > 150% da média
    - LVN = bins com volume < 50% da média
    - Arquivo: `app/Services/TechnicalAnalysisService.php`
    - _Requirements: 13.1-13.4_

  - [ ]* 9.2 Write property tests for Volume Profile
    - **Property 24: Conservação de volume no Volume Profile**
    - **Property 25: POC, HVN e LVN seguem thresholds definidos**
    - **Validates: Requirements 13.1-13.4**

  - [x] 9.3 Verificar/implementar detectarWyckoff() completo
    - identificarRange(): sliding window 60/40/20 candles, amplitude < 8%
    - detectarEventos(): 7 eventos (SC, AR, ST, SPRING, UAT, SOS, SOB)
    - classificarFase(): 9 estados possíveis
    - gerarNarrativaWyckoff(): narrativa em português com range (teto/suporte) + gatilho operacional
    - Retorno INDETERMINADO quando < 20 candles
    - Arquivo: `app/Services/TechnicalAnalysisService.php`
    - _Requirements: 12.1-12.6_

  - [ ]* 9.4 Write property tests for Wyckoff
    - **Property 22: Range lateral detectado quando amplitude < 8%**
    - **Property 23: Fase Wyckoff tem narrativa e gatilho não-vazios**
    - **Validates: Requirements 12.1-12.6**

  - [x] 9.5 Implementar detectarPadraoCandle() completo
    - DOJI: corpo < 10% do range
    - ENGOLFO_ALTISTA: bullish atual engolfa bearish anterior
    - ENGOLFO_BAIXISTA: bearish atual engolfa bullish anterior
    - MARTELO: sombra inferior > 2x corpo, superior < 50% corpo
    - ESTRELA_CADENTE: sombra superior > 2x corpo, inferior < 50% corpo
    - PIN_BAR: qualquer sombra > 2.5x corpo
    - Arquivo: `app/Services/TechnicalAnalysisService.php`
    - _Requirements: 26.1-26.6_

  - [ ]* 9.6 Write property test for candle patterns
    - **Property 49: Detecção de padrões de candle por geometria**
    - **Validates: Requirements 26.1, 26.4, 26.5**

  - [x] 9.7 Implementar calcularDivergenciaCVD() no TechnicalAnalysisService
    - Comparar 14 últimos closes com 14 últimos CVD deltas
    - Preço nova mínima + CVD não confirma → BULLISH
    - Preço nova máxima + CVD não confirma → BEARISH
    - Arquivo: `app/Services/TechnicalAnalysisService.php`
    - _Requirements: 23.1, 23.2_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. ScoringService PHP — Reescrita para 55/45
  - [x] 11.1 Reescrever ScoringService.php com arquitetura 55/45
    - Remover blocos Macro (20pts) e Sentimento (10pts) do cálculo de score
    - Bloco Técnico: max 55pts (EMA200=8, RSI=7, DivRSI=3, ADX=8, MACD signal=7, MACD zero cross=5, Compressão=7)
    - Bloco Derivativos: max 45pts (CVD=10, Book=5, DivCVD=10, Funding=8, OI=8, LS=5, Clusters=2+2)
    - ADX proporcional: 8pts(≥30), 5pts(25-29), 3pts(20-24), 1pt(<20 + RANGING flag)
    - MACD zero cross: +5pts bull/bear com flags
    - Funding 5 faixas: neutro(±0.01)=2, >0.05=8bear, 0.03-0.05=6bear, <-0.03=8bull, -0.03 a -0.02=6bull
    - Macro/Sentimento geram apenas flags informativas
    - Fórmula: 50 + (bull - bear)/2, arredondar ×5, clamp [0,100]
    - Multiplicador de sessão aplicado ao final
    - Arquivo: `app/Services/ScoringService.php`
    - _Requirements: 7.1-7.4, 8.1-8.2, 9.1-9.7, 11.1-11.4, 16.1-16.6, 18.1-18.2, 21.1-21.5, 22.1-22.4, 23.1-23.2_

  - [ ]* 11.2 Write PHPUnit property tests for ScoringService
    - **Property 15: Caps dos blocos de scoring (55/45)**
    - **Property 16: Score final no range [0,100] e múltiplo de 5**
    - **Property 17: Classificação do viés corresponde ao score**
    - **Property 21: Multiplicador de sessão correto por hora UTC**
    - **Property 31: Funding rate com 5 faixas no scoring**
    - **Property 32: OI direcional com preço no scoring**
    - **Validates: Requirements 7-9, 11, 16, 18, 21-23**

- [x] 12. GeminiAnalysisService — Peças Faltantes
  - [x] 12.1 Peça 1: Substituir $scoreInput (remover macro/sentimento do score, adicionar novos campos)
    - Remover campos macro do scoreInput que alimentam pontuação: vix, dxy_variacao, sp500_variacao, btc_dominancia_variacao do score calculation (manter para flags)
    - Adicionar macd_cruza_zero ao scoreInput
    - Garantir que funding_rate, oi_subindo, cvd_slope, book_imbalance_ratio NÃO chegam zerados quando dados disponíveis (passar None quando indisponível)
    - Arquivo: `app/Services/GeminiAnalysisService.php`
    - _Requirements: 10.1-10.5_

  - [x] 12.2 Peça 2: Substituir bloco MotorExecucao (RR com HVN/LVN, validação de direção)
    - Passar HVN do Volume Profile como targets LONG e LVN como targets SHORT
    - Passar POC como referência para Plano B
    - Validar que direção do setup concorda com viés do score
    - Passar elementosVisuais (suportes/resistências) para ajuste de stops
    - Arquivo: `app/Services/GeminiAnalysisService.php`
    - _Requirements: 13.5, 14.1-14.8_

  - [x] 12.3 Peça 3: Substituir score fallback (nova arquitetura 55/45)
    - Score fallback: {scoreFinal: 50, vies: 'NEUTRO', confiabilidade: 'BAIXA', blocoTecnico: {pontos:0, maximo:55}, blocoDerivativos: {pontos:0, maximo:45}}
    - Remover referências a blocoMacro e blocoSentimento no cálculo (manter flags)
    - Arquivo: `app/Services/GeminiAnalysisService.php`
    - _Requirements: 9.1, 9.2_

  - [x] 12.4 Peça 4: Adicionar getLiquidacoes() ao BinanceService
    - Endpoint: GET /fapi/v1/allForceOrders (já existe getForceOrders)
    - Mapear para clusters: agrupar por faixa de preço, retornar {above: [], below: []}
    - Integrar no GeminiAnalysisService para passar ao MotorExecucao
    - Arquivo: `app/Services/BinanceService.php`, `app/Services/GeminiAnalysisService.php`
    - _Requirements: 18.1, 18.2_

  - [x] 12.5 Peça 5: Substituir setupLong() e setupShort() no MotorExecucaoService
    - Plano A: entrada no preço atual, stop por ATR×mult, TPs em HVN (LONG) ou LVN (SHORT)
    - Plano B: entrada em pullback a POC ou suporte relevante
    - Validar direção: se score indica SHORT mas setup é LONG, inverter ou sinalizar inconsistência
    - Usar clusters de liquidação como referência para TP2
    - Ajustar stop LONG para abaixo do suporte mais alto válido (OCR) × 0.995
    - Ajustar stop SHORT para acima da resistência mais baixa válida (OCR) × 1.005
    - Arquivo: `app/Services/MotorExecucaoService.php`
    - _Requirements: 14.1-14.8, 2.3_

  - [ ]* 12.6 Write property tests for MotorExecucaoService
    - **Property 26: Entrada do Plano A é o preço atual**
    - **Property 27: Alavancagem respeitando limites por score**
    - **Property 28: Fórmula de liquidação**
    - **Property 29: Segurança stop vs liquidação**
    - **Property 30: Stop ajustado por suportes do usuário (LONG)**
    - **Validates: Requirements 14.1-14.8, 2.3**

- [ ] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. GeminiAnalysisService — Narrativa, OCR, Multi-Timeframe
  - [x] 14.1 Substituir gerarNarrativa() prompt
    - Prompt deve incluir hierarquia: "dados calculados via API prevalecem sobre interpretação visual"
    - Incluir compressão obrigatória quando ativa: "setup agressivo na direção do rompimento"
    - Incluir Wyckoff (fase, gatilho) no contexto narrativo
    - Arquivo: `app/Services/GeminiAnalysisService.php`
    - _Requirements: 15.1-15.3_

  - [x] 14.2 Remover extrairIndicadoresOCR() e atualizar OCR prompt
    - Remover lógica antiga de extração de indicadores numéricos via OCR
    - Manter apenas extrairElementosVisuais() que busca suportes, resistências e exchange
    - Arquivo: `app/Services/GeminiAnalysisService.php`
    - _Requirements: 2.1, 2.2_

  - [x] 14.3 Fix modelo Gemini para gemini-2.5-flash
    - Verificar config `services.gemini_analysis_model` retorna "gemini-2.5-flash"
    - Remover referências a modelos antigos (gemini-3.5-flash é inválido)
    - Arquivo: `app/Services/GeminiAnalysisService.php` + config
    - _Requirements: 15.4_

  - [x] 14.4 Remover cache de análise Gemini
    - Remover bloco que usa `gemini:analise:` como cache key
    - Cada análise deve ser fresca (os dados já são cacheados individualmente por endpoint)
    - Arquivo: `app/Services/GeminiAnalysisService.php`
    - _Requirements: (Remoção de cache mandatória)_

  - [x] 14.5 Corrigir Multi-Timeframe para mapas corretos
    - 15m → [1h, 4h, 1d]
    - 1h → [4h, 1d, 1w]
    - 4h → [1d, 1w, 1M]
    - Bias: score ≥ 2 → BULLISH, score ≤ -2 → BEARISH, else NEUTRO
    - Score = RSI vs 50 (±1) + preço vs EMA21 (±1) + preço vs EMA50 (±1)
    - Arquivo: `app/Services/GeminiAnalysisService.php`
    - _Requirements: 20.1-20.4_

  - [ ]* 14.6 Write property test for multi-timeframe
    - **Property 47: Multi-timeframe bias classification**
    - **Validates: Requirements 20.4**

  - [x] 14.7 Implementar JSON parsing resiliente
    - Remover code fences markdown (```json ... ```)
    - Tentar extrair JSON via regex se não começa com {/[
    - Remover trailing commas e control characters antes de retry
    - Arquivo: `app/Services/GeminiAnalysisService.php`
    - _Requirements: 15.5, 15.7_

  - [ ]* 14.8 Write property test for JSON parsing
    - **Property 51: JSON parsing resiliente**
    - **Validates: Requirements 15.5, 15.7**

  - [x] 14.9 Implementar cálculo de tamanho de posição
    - valor_total = margem × alavancagem
    - quantidade = valor_total / preço_entrada
    - risco_usd = (distância_stop / preço_entrada) × valor_total
    - Fallback: margem demo 100 USD quando entryValue = 0
    - Arquivo: `app/Services/GeminiAnalysisService.php`
    - _Requirements: 28.1-28.3_

  - [ ]* 14.10 Write property test for position sizing
    - **Property 48: Cálculo de tamanho de posição**
    - **Validates: Requirements 28.1, 28.2**

- [ ] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. TechnicalAnalysisService — Fontes e Zonas (PHP)
  - [x] 16.1 Implementar rastreamento de fontes por indicador
    - Cada indicador: "API" (calculado via candles), "GRAFICO" (OCR fallback), "INDISPONIVEL"
    - Quando API retorna null E OCR existe → usar OCR como fallback e marcar "GRAFICO"
    - Incluir mapa de fontes na resposta final
    - Arquivo: `app/Services/TechnicalAnalysisService.php`
    - _Requirements: 29.1-29.3_

  - [ ]* 16.2 Write property test for source tracking
    - **Property 50: Fonte de indicadores rastreada corretamente**
    - **Validates: Requirements 29.1, 29.2**

  - [x] 16.3 Implementar calcular PDH/PDL e PWH/PWL no IndicatorEngine Python
    - PDH/PDL baseado em UTC day boundary
    - PWH/PWL baseado em semana ISO
    - Verificar implementação existente em indicatorEngine.py
    - Arquivo: `monitor/indicatorEngine.py`
    - _Requirements: 27.3, 27.4_

  - [ ]* 16.4 Write property test for PDH/PDL/PWH/PWL
    - **Property 52: PDH/PDL e PWH/PWL baseados em boundaries UTC**
    - **Validates: Requirements 27.3, 27.4**

  - [x] 16.5 Implementar calcularZonas() com PDH/PDL/PWH/PWL + Volume Profile
    - Passar POC, HVN, LVN para o MotorExecucaoService
    - Calcular zonas usando candles diários (PDH/PDL) e semanais (PWH/PWL) via Binance API
    - Arquivo: `app/Services/GeminiAnalysisService.php`
    - _Requirements: 13.5, 27.1, 27.2_

- [x] 17. API Endpoints Radar e Frontend
  - [x] 17.1 Criar endpoint GET /api/radar/alertas
    - Retornar últimos 50 alertas com score >= SCORE_MINIMO
    - Filtrar por tipo OPORTUNIDADE
    - Incluir campos: ativo, tipo, mensagem, direcao, urgencia, score, created_at
    - Arquivo: `routes/api.php` + Controller
    - _Requirements: (Micro Radar API)_

  - [x] 17.2 Criar endpoint GET /api/radar/revelar/{id}
    - Retornar detalhes completos do alerta por ID
    - Incluir motivos, timeframes, indicadores snapshot
    - Arquivo: `routes/api.php` + Controller
    - _Requirements: (Micro Radar API)_

  - [x] 17.3 Criar endpoint GET /api/radar/historico
    - Retornar alertas dos últimos 7 dias paginados
    - Filtros: ativo, tipo, urgencia, direcao
    - Arquivo: `routes/api.php` + Controller
    - _Requirements: (Micro Radar API)_

  - [x] 17.4 Implementar OI variação via banco no GeminiAnalysisService
    - Calcular variação percentual: ((oi_atual - oi_anterior) / oi_anterior) × 100
    - Buscar oi_anterior por symbol + exchange do MySQL
    - Persistir oi_atual com timestamp
    - Arquivo: `app/Services/GeminiAnalysisService.php`
    - _Requirements: 4.3_

  - [ ]* 17.5 Write property test for OI variation
    - **Property 5: Variação percentual de OI**
    - **Validates: Requirements 4.3**

- [x] 18. Gravação de alertas e resiliência
  - [x] 18.1 Verificar gravação direta no MySQL via pymysql
    - Alertas gravados diretamente na tabela genesis_alertas (sem artisan serve)
    - Campos: ativo, tipo, mensagem, direcao, urgencia, corretora, timeframe, preco_atual, variacao_pct, score
    - Campos JSON extras: motivos, timeframes (serializar como JSON string)
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 24.1, 24.2_

  - [x] 18.2 Garantir resiliência a falha de conexão DB
    - Conexão MySQL falha → log error, continuar processamento
    - Nunca propagar exceção ao loop principal do worker
    - Arquivo: `monitor/monitor_worker.py`
    - _Requirements: 24.3_

  - [ ]* 18.3 Write property tests for alert persistence
    - **Property 53: Alertas contêm todos os campos obrigatórios**
    - **Property 54: Resiliência a falha de conexão DB**
    - **Validates: Requirements 24.2, 24.3**

- [x] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Python files are in `G-nesis-2.0-main/monitor/` (monitor_worker.py, indicatorEngine.py, scoringEngine.py)
- PHP files are in `e:\Programas\wamp64\www\genesis-api\app\Services\`
- Property tests use Hypothesis (Python) and PHPUnit with custom generators (PHP)
- Each property test must reference its property number and requirements clause
- Test structure: `G-nesis-2.0-main/tests/property/` for Python, `genesis-api/tests/Property/` for PHP
- Checkpoints ensure incremental validation between major implementation blocks
