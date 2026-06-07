# Implementation Plan: Exchange Router + OI Histórico

## Overview

Implementação incremental do ExchangeRouter multi-corretora com fallback Binance, persistência histórica de OI, e integração de dados públicos (Fear & Greed, BTC Dominância) no scoring. Linguagem: PHP/Laravel. Workspace: `e:\Programas\wamp64\www\genesis-api`.

## Tasks

- [x] 1. Completar endpoints derivativos nos serviços de corretoras
  - [x] 1.1 Adicionar getOpenInterest, getLongShortRatio e getCvd ao BybitService
    - Implementar `getOpenInterest(string $symbol)` consultando `/v5/market/open-interest?category=linear&symbol={symbol}`
    - Implementar `getLongShortRatio(string $symbol, string $period = '5m', int $limit = 30)` consultando `/v5/market/account-ratio`
    - Implementar `getCvd(string $symbol, int $limit = 1000)` calculando delta a partir de `/v5/market/recent-trade`
    - Seguir o padrão `get()` + `CacheManager::remember` existente no BybitService
    - _Requirements: 1.1, 1.2, 1.3, 1.12_

  - [ ]* 1.2 Write property test: CVD invariant (BybitService)
    - **Property 1: Invariante do cálculo CVD**
    - Gerar listas aleatórias de trades (qty + side) e validar que `delta = sum(buys) - sum(sells)` e volume total = buy_volume + sell_volume
    - Mínimo 100 iterações com DataProvider + Faker
    - **Validates: Requirements 1.3**

  - [x] 1.3 Adicionar getFundingRate, getOpenInterest, getLongShortRatio, getCvd e getCandles ao BitgetService
    - Implementar `getFundingRate(string $symbol)` consultando `/api/v2/mix/market/current-fund-rate?productType=USDT-FUTURES`
    - Implementar `getOpenInterest(string $symbol)` consultando `/api/v2/mix/market/open-interest?productType=USDT-FUTURES`
    - Implementar `getLongShortRatio(string $symbol, string $period = '5m')` consultando `/api/v2/mix/market/account-long-short-ratio`
    - Implementar `getCvd(string $symbol, int $limit = 1000)` calculando delta a partir de `/api/v2/mix/market/fills`
    - Implementar `getCandles(string $symbol, string $granularity, int $limit = 200)` consultando `/api/v2/mix/market/candles`
    - Seguir o padrão `get()` + `CacheManager::remember` existente no BitgetService
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 1.12_

  - [x] 1.4 Adicionar getLongShortRatio, getCvd e getCandles ao OkxService
    - Implementar `getLongShortRatio(string $instId, string $period = '5m')` consultando `/api/v5/rubik/stat/contracts/long-short-account-ratio`
    - Implementar `getCvd(string $instId, int $limit = 1000)` calculando delta a partir de `/api/v5/market/trades`
    - Implementar `getCandles(string $instId, string $bar = '5m', int $limit = 200)` consultando `/api/v5/market/candles`
    - Seguir o padrão `get()` + `CacheManager::remember` existente no OkxService
    - _Requirements: 1.9, 1.10, 1.11, 1.12_

  - [ ]* 1.5 Write property test: HTTP error gera RuntimeException
    - **Property 2: Erro HTTP gera RuntimeException**
    - Para cada serviço (Binance, Bybit, Bitget, OKX), usar `Http::fake()` com status codes aleatórios >= 400 e validar que `RuntimeException` é lançada
    - Mínimo 100 iterações
    - **Validates: Requirement 1.12**

- [x] 2. Criar tabela oi_historico e model Eloquent
  - [x] 2.1 Criar migration para tabela oi_historico
    - Tabela com colunas: id (bigint auto), symbol (varchar 50), exchange (varchar 20), oi_valor (decimal 20,2), created_at (timestamp)
    - Índice composto em [symbol, exchange, created_at]
    - _Requirements: 3.1, 3.2_

  - [x] 2.2 Criar model OiHistorico
    - Eloquent model em `App\Models\OiHistorico`
    - `$table = 'oi_historico'`, `$timestamps = false`, `$fillable` e `$casts` conforme design
    - _Requirements: 3.1_

- [x] 3. Checkpoint - Verificar services e migration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Criar ExchangeRouter com detecção e fallback
  - [x] 4.1 Implementar ExchangeRouter::detectar()
    - Receber string OCR nullable, usar `stripos` para detectar corretora no conjunto [binance, bybit, bitget, okx]
    - Retornar 'binance' como padrão quando não reconhecido
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 4.2 Write property test: Roteamento correto por exchange
    - **Property 3: Roteamento correto por exchange**
    - Gerar strings aleatórias (válidas e inválidas) e validar que o mapeamento é correto; strings fora do conjunto devem retornar 'binance'
    - Mínimo 100 iterações
    - **Validates: Requirements 2.2, 2.3**

  - [x] 4.3 Implementar ExchangeRouter::buscar()
    - Injetar os 4 serviços no construtor
    - Para cada endpoint (oi, funding, ls_ratio, cvd): tentar corretora detectada, em falha/null → fallback Binance
    - Implementar detecção de liquidez insuficiente (OI=0 E funding=0 → aviso_liquidez + fallback total)
    - Setar `alerta_hibrido = true` quando dados vêm de 2+ fontes
    - Retornar array normalizado com todas as chaves do contrato
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 4.4 Write property test: Fallback para Binance em caso de falha
    - **Property 4: Fallback para Binance em caso de falha**
    - Usar mocks para simular falhas aleatórias em endpoints da corretora detectada e validar que BinanceService supre o dado
    - Mínimo 100 iterações
    - **Validates: Requirement 2.4**

  - [ ]* 4.5 Write property test: Detecção de liquidez insuficiente
    - **Property 5: Detecção de liquidez insuficiente**
    - Gerar cenários onde OI=0 E funding=0 para corretoras aleatórias e validar aviso_liquidez=true + fallback total
    - Mínimo 100 iterações
    - **Validates: Requirements 2.5, 5.1, 5.2**

  - [ ]* 4.6 Write property test: Alerta híbrido em fontes mistas
    - **Property 6: Alerta híbrido em fontes mistas**
    - Gerar cenários com falhas parciais em subsets de endpoints e validar alerta_hibrido=true
    - Mínimo 100 iterações
    - **Validates: Requirements 2.6, 6.4**

  - [ ]* 4.7 Write property test: Invariante estrutural do retorno
    - **Property 7: Invariante estrutural do retorno**
    - Para qualquer symbol+exchange, validar que o array retornado contém exatamente as 8 chaves esperadas
    - Mínimo 100 iterações
    - **Validates: Requirement 2.7**

- [x] 5. Checkpoint - Verificar ExchangeRouter
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrar ExchangeRouter e OI Histórico no GeminiAnalysisService
  - [x] 6.1 Atualizar construtor do GeminiAnalysisService
    - Injetar `ExchangeRouter`, `AlternativeService` e `CoinGeckoService`
    - Manter dependências existentes (BinanceService para candles, Yahoo, TechAnalysis, Scoring, ContextBuilder)
    - _Requirements: 6.1, 6.2_

  - [x] 6.2 Substituir bloco hardcoded de derivativos (linhas 47-63)
    - Usar `$this->exchangeRouter->detectar()` com texto OCR
    - Usar `$this->exchangeRouter->buscar()` para obter derivativos normalizados
    - Compor ScoreInput com valores reais do array retornado
    - Incluir `alerta_hibrido` e `aviso_liquidez` na resposta final quando aplicável
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.3 Implementar persistência e cálculo de variação de OI
    - Após obter OI do ExchangeRouter, inserir registro em oi_historico via model OiHistorico
    - Consultar registro anterior para calcular variação: `((oi_atual - oi_anterior) / oi_anterior) * 100`
    - Retornar 0 se não existir registro anterior
    - Tratar exceções de DB sem bloquear a análise
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 6.4 Write property test: Round-trip de persistência do OI
    - **Property 8: Round-trip de persistência do OI**
    - Inserir valores aleatórios (symbol, exchange, oi_valor positivo) e validar que a consulta mais recente retorna o mesmo valor
    - Mínimo 100 iterações (usar SQLite in-memory ou RefreshDatabase)
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 6.5 Write property test: Fórmula de variação do OI
    - **Property 9: Fórmula de variação do OI**
    - Gerar pares (oi_anterior > 0, oi_atual >= 0) e validar fórmula `round(((atual - anterior) / anterior) * 100, 2)`; quando anterior=null, resultado=0
    - Mínimo 100 iterações
    - **Validates: Requirements 3.5, 3.6**

- [x] 7. Integrar dados públicos (Fear & Greed + BTC Dominância)
  - [x] 7.1 Adicionar chamadas a AlternativeService e CoinGeckoService no GeminiAnalysisService
    - Chamar `AlternativeService::getCurrentFearGreed()` com try/catch → default 50 em falha
    - Chamar `CoinGeckoService::getBtcDominance()` com try/catch → default 0 em falha
    - Passar valores reais ao ScoreInput nos campos `fear_greed` e `btc_dominancia_variacao`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 7.2 Write property test: Valores padrão em falha de serviços externos
    - **Property 10: Valores padrão em falha de serviços externos**
    - Simular combinações de falhas (Alternative, CoinGecko, Exchange) e validar que defaults são aplicados sem interrupção
    - Mínimo 100 iterações
    - **Validates: Requirements 4.5, 4.6, 6.5**

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marcadas com `*` são opcionais (testes de propriedade) e podem ser puladas para um MVP mais rápido
- Cada task referencia os requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests usam PHPUnit DataProviders com Faker (100+ iterações)
- Todos os services usam `Http::fake()` para mocking em testes
- A ordem das tasks respeita as dependências: services → migration → router → integração
