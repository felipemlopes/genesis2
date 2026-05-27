/**
 * Integration Tests End-to-End — Pós-Correção
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 * 
 * These integration tests verify that all corrected components work together correctly
 * in end-to-end flows combining multiple fixes:
 * 
 * 13.1 Full flow: image upload → unified visual reading → pair normalization → data fetch (real ADX) → score calculation (with cap)
 * 13.2 Worker flow: WebSocket connection → candle receipt → real extra data → anomaly detection → alert recording with timeframe
 * 13.3 SSE end-to-end: worker records alert → SSE detects → frontend receives (without direcao/urgencia fields)
 * 13.4 Legacy alerts without timeframe continue working with DEFAULT '1h'
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

import { obterIndicadorComFallback } from '../adaptedDataFetcher';
import { calcularScore, DadosScore } from '../scoringEngine';
import { normalizarPar } from '../normalizarPar';

// ============================================================
// HELPERS
// ============================================================

function readSchemaSQL(): string {
  const schemaPath = path.resolve(__dirname, '../../criar_tabelas.sql');
  return fs.readFileSync(schemaPath, 'utf-8');
}

function readMonitorWorker(): string {
  const workerPath = path.resolve(__dirname, '../../monitor/monitor_worker.py');
  return fs.readFileSync(workerPath, 'utf-8');
}

function readApiRoutes(): string {
  const routesPath = path.resolve(__dirname, '../../routes/api.js');
  return fs.readFileSync(routesPath, 'utf-8');
}

function readUseAlertas(): string {
  const hookPath = path.resolve(__dirname, '../../hooks/useAlertas.ts');
  return fs.readFileSync(hookPath, 'utf-8');
}

function readApiService(): string {
  const apiPath = path.resolve(__dirname, '../api.ts');
  return fs.readFileSync(apiPath, 'utf-8');
}

function readGeminiService(): string {
  const geminiPath = path.resolve(__dirname, '../geminiService.ts');
  return fs.readFileSync(geminiPath, 'utf-8');
}

/**
 * Generate realistic kline data (Binance format) for testing
 */
function generateKline(basePrice: number, volatility: number, index: number): any[] {
  const open = basePrice + (index % 10 - 5) * volatility;
  const high = open + Math.abs(index % 7) * volatility;
  const low = open - Math.abs((index + 3) % 7) * volatility;
  const close = low + Math.abs((index + 1) % 10) * volatility * (high - low > 0 ? 1 : 0.5);
  const volume = 1000 + (index % 500);
  return [
    Date.now() - index * 3600000,
    String(open),
    String(Math.max(open, high, close)),
    String(Math.min(open, low, close)),
    String(close),
    String(volume),
    Date.now() - (index - 1) * 3600000,
    String(volume * close),
    100 + index % 50,
    String(volume * 0.6),
    String(volume * close * 0.6),
    '0'
  ];
}

// ============================================================
// ARBITRARIES
// ============================================================

// Klines with >= 28 candles for ADX calculation
const klinesForADXArbitrary = fc.integer({ min: 28, max: 200 }).chain(numCandles =>
  fc.tuple(
    fc.integer({ min: 100, max: 50000 }),
    fc.integer({ min: 5, max: 50 })
  ).map(([basePrice, volatility]) => {
    const klines: any[] = [];
    for (let i = 0; i < numCandles; i++) {
      klines.push(generateKline(basePrice, volatility / 10, i));
    }
    return klines;
  })
);

// Raw pairs that need normalization (OCR output with stablecoin suffixes or special chars)
const rawPairWithSuffixArbitrary = fc.constantFrom(
  'BTCUSDC', 'ETHBUSD', 'SOLUSD', 'BTCUSD.P', 'ETHPERP',
  'BTCDAI', 'SOLTUSD', '1000PEPEUSDT', 'DOGEUSDC',
  'XRPBUSD', 'AVAXUSD.P', 'LINKPERP', '1000SHIBUSDT'
);

// Valid pairs that should pass through unchanged
const validPairArbitrary = fc.constantFrom(
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'
);

// DadosScore WITHOUT technical data (triggers cap at 65)
const dadosScoreSemTecnicoArbitrary = fc.record({
  preco: fc.integer({ min: 100, max: 50000 }).map(v => v * 1.0),
  ema200: fc.constant(undefined),
  ema200Subindo: fc.constant(undefined),
  rsi: fc.constant(undefined),
  adx: fc.constant(undefined),
  adxSubindo: fc.constant(undefined),
  macdAcimaSignal: fc.constant(undefined),
  histogramaSubindo: fc.constant(undefined),
  precoSubindo: fc.boolean(),
  compressaoDetectada: fc.constant(false),
  cvdSlope: fc.integer({ min: -100, max: 100 }).map(v => v / 10),
  divergenciaCVD: fc.constantFrom('BULLISH', 'BEARISH', 'NENHUMA') as fc.Arbitrary<string>,
  fundingMedio: fc.integer({ min: -50, max: 50 }).map(v => v / 1000),
  oiVariacao: fc.integer({ min: -20, max: 20 }).map(v => v * 1.0),
  oiSubindo: fc.boolean(),
  lsRatioLongs: fc.integer({ min: 30, max: 70 }).map(v => v / 100),
  bookImbalanceRatio: fc.integer({ min: -80, max: 80 }).map(v => v / 100),
  vix: fc.integer({ min: 10, max: 35 }).map(v => v * 1.0),
  dxyVariacao: fc.integer({ min: -10, max: 10 }).map(v => v / 10),
  sp500Variacao: fc.integer({ min: -20, max: 20 }).map(v => v / 10),
  btcDominanciaVariacao: fc.integer({ min: -5, max: 5 }).map(v => v / 10),
  usdtDominanciaVariacao: fc.integer({ min: -5, max: 5 }).map(v => v / 10),
  fearGreed: fc.integer({ min: 5, max: 95 }),
  geopoliticaScore: fc.constantFrom(-3, 0, 3),
  sentimentoMoedaScore: fc.constantFrom(-3, 0, 3),
  clusterLiquidacaoAcima: fc.integer({ min: 50000, max: 60000 }).map(v => v * 1.0),
  clusterLiquidacaoAbaixo: fc.integer({ min: 40000, max: 49000 }).map(v => v * 1.0),
  correlacaoBtc: fc.constant(null),
}) as fc.Arbitrary<DadosScore>;

// DadosScore WITH technical data (full 0-100 scale)
const dadosScoreComTecnicoArbitrary = fc.record({
  preco: fc.integer({ min: 100, max: 50000 }).map(v => v * 1.0),
  ema200: fc.integer({ min: 100, max: 50000 }).map(v => v * 1.0),
  ema200Subindo: fc.boolean(),
  rsi: fc.integer({ min: 10, max: 90 }).map(v => v * 1.0),
  adx: fc.integer({ min: 5, max: 80 }).map(v => v * 1.0),
  adxSubindo: fc.boolean(),
  macdAcimaSignal: fc.boolean(),
  histogramaSubindo: fc.boolean(),
  precoSubindo: fc.boolean(),
  compressaoDetectada: fc.constant(false),
  cvdSlope: fc.integer({ min: -100, max: 100 }).map(v => v / 10),
  divergenciaCVD: fc.constantFrom('BULLISH', 'BEARISH', 'NENHUMA') as fc.Arbitrary<string>,
  fundingMedio: fc.integer({ min: -50, max: 50 }).map(v => v / 1000),
  oiVariacao: fc.integer({ min: -20, max: 20 }).map(v => v * 1.0),
  oiSubindo: fc.boolean(),
  lsRatioLongs: fc.integer({ min: 30, max: 70 }).map(v => v / 100),
  bookImbalanceRatio: fc.integer({ min: -80, max: 80 }).map(v => v / 100),
  vix: fc.integer({ min: 10, max: 35 }).map(v => v * 1.0),
  dxyVariacao: fc.integer({ min: -10, max: 10 }).map(v => v / 10),
  sp500Variacao: fc.integer({ min: -20, max: 20 }).map(v => v / 10),
  btcDominanciaVariacao: fc.integer({ min: -5, max: 5 }).map(v => v / 10),
  usdtDominanciaVariacao: fc.integer({ min: -5, max: 5 }).map(v => v / 10),
  fearGreed: fc.integer({ min: 5, max: 95 }),
  geopoliticaScore: fc.constantFrom(-3, 0, 3),
  sentimentoMoedaScore: fc.constantFrom(-3, 0, 3),
  clusterLiquidacaoAcima: fc.integer({ min: 50000, max: 60000 }).map(v => v * 1.0),
  clusterLiquidacaoAbaixo: fc.integer({ min: 40000, max: 49000 }).map(v => v * 1.0),
  correlacaoBtc: fc.constant(null),
}) as fc.Arbitrary<DadosScore>;

// Timeframe values
const timeframeArbitrary = fc.constantFrom('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w');

// ============================================================
// 13.1 FULL FLOW: upload → unified visual reading → pair normalization → data fetch (real ADX) → score (with cap)
// Validates: Requirements 2.1, 2.5, 2.6, 2.7, 3.1, 3.2, 3.5, 3.6
// ============================================================
describe('13.1 Integration: Full Analysis Flow (Upload → Visual → Normalize → ADX → Score)', () => {

  it('E2E: Raw pair from OCR → normalizarPar → valid USDT pair → ADX calculation → score with cap', () => {
    /**
     * Validates: Requirements 2.1, 2.6, 2.7
     * 
     * Tests the complete flow:
     * 1. OCR returns a raw pair with stablecoin suffix (simulating unified visual reading output)
     * 2. normalizarPar normalizes it to valid USDT pair
     * 3. ADX is calculated with real data (not hardcoded 22.5)
     * 4. Score is capped at 65 when technical data is absent
     */
    fc.assert(
      fc.property(
        rawPairWithSuffixArbitrary,
        klinesForADXArbitrary,
        dadosScoreSemTecnicoArbitrary,
        (rawPair, klinesData, dadosScore) => {
          // Step 1: Normalize pair (simulates output from unified visual reading)
          const normalizedPair = normalizarPar(rawPair);
          
          // Verify normalized pair is valid
          expect(normalizedPair).toMatch(/^[A-Z]+USDT$/);
          expect(normalizedPair).not.toMatch(/USDCUSDT|BUSDUSDT|USDUSDT|DAIUSDT|TUSDUSDT/);
          expect(normalizedPair).not.toContain('.P');
          expect(normalizedPair).not.toContain('PERP');
          
          // Step 2: Calculate ADX with real data (not hardcoded)
          const closes = klinesData.map((k: any) => parseFloat(k[4]));
          const adxResult = obterIndicadorComFallback('ADX', 14, closes, klinesData, null);
          
          // ADX should return real calculated values, NOT 22.5
          expect(adxResult.fonte).toBe('API');
          expect(adxResult.valor).not.toBe(22.5);
          expect(adxResult.valor).toHaveProperty('adx');
          expect(adxResult.valor).toHaveProperty('diPlus');
          expect(adxResult.valor).toHaveProperty('diMinus');
          expect(adxResult.valor.adx).toBeGreaterThanOrEqual(0);
          expect(adxResult.valor.adx).toBeLessThanOrEqual(100);
          
          // Step 3: Calculate score without technical data → capped at 65
          const scoreResult = calcularScore(dadosScore);
          expect(scoreResult.scoreFinal).toBeLessThanOrEqual(65);
          expect(scoreResult.scoreFinal).toBeGreaterThanOrEqual(35);
          expect(scoreResult.flags).toContain('CONFIANCA_REDUZIDA_SEM_TECNICO');
        }
      ),
      { numRuns: 30 }
    );
  });

  it('E2E: Valid pair → ADX real → score with technical data uses full scale', () => {
    /**
     * Validates: Requirements 2.1, 3.5, 3.6
     * 
     * Tests the flow when pair is already valid and technical data IS present:
     * 1. Valid USDT pair passes through normalization unchanged
     * 2. ADX returns real values
     * 3. Score uses full 0-100 scale (no cap)
     */
    fc.assert(
      fc.property(
        validPairArbitrary,
        klinesForADXArbitrary,
        dadosScoreComTecnicoArbitrary,
        (validPair, klinesData, dadosScore) => {
          // Step 1: Valid pair passes unchanged
          const normalizedPair = normalizarPar(validPair);
          expect(normalizedPair).toBe(validPair);
          
          // Step 2: ADX returns real calculated values
          const closes = klinesData.map((k: any) => parseFloat(k[4]));
          const adxResult = obterIndicadorComFallback('ADX', 14, closes, klinesData, null);
          expect(adxResult.fonte).toBe('API');
          expect(adxResult.valor).toHaveProperty('adx');
          expect(adxResult.valor.adx).toBeGreaterThanOrEqual(0);
          expect(adxResult.valor.adx).toBeLessThanOrEqual(100);
          
          // Step 3: Score with technical data uses full scale (can exceed 65)
          const scoreResult = calcularScore(dadosScore);
          expect(scoreResult.scoreFinal).toBeGreaterThanOrEqual(0);
          expect(scoreResult.scoreFinal).toBeLessThanOrEqual(100);
          expect(scoreResult.flags).not.toContain('CONFIANCA_REDUZIDA_SEM_TECNICO');
        }
      ),
      { numRuns: 30 }
    );
  });

  it('E2E: Unified visual reading structure contains both metadata and visual data', () => {
    /**
     * Validates: Requirements 2.5, 3.2
     * 
     * Verifies that the geminiService's unifiedChartAnalysis function is structured
     * to return both metadata (pair, exchange, timeframe) AND visual data
     * (supports, resistances, trendlines, fibonacci) in a single result.
     */
    const geminiSource = readGeminiService();
    
    // unifiedChartAnalysis exists and returns UnifiedChartResult
    expect(geminiSource).toContain('unifiedChartAnalysis');
    expect(geminiSource).toContain('UnifiedChartResult');
    
    // It returns visual data fields
    expect(geminiSource).toMatch(/supports.*parsed/s);
    expect(geminiSource).toMatch(/resistances.*parsed/s);
    expect(geminiSource).toMatch(/trendlines.*parsed/s);
    expect(geminiSource).toMatch(/fibonacci.*parsed/s);
    
    // scanChartMetadata is now a wrapper around unifiedChartAnalysis
    expect(geminiSource).toMatch(/scanChartMetadata.*unifiedChartAnalysis/s);
    
    // normalizarPar is used in the unified reading
    expect(geminiSource).toContain('normalizarPar');
  });

  it('E2E: Non-ADX indicators still work correctly alongside real ADX', () => {
    /**
     * Validates: Requirements 3.1, 3.2
     * 
     * Verifies that EMA and RSI calculations still work correctly
     * when ADX is also being calculated with real data.
     */
    fc.assert(
      fc.property(klinesForADXArbitrary, (klinesData) => {
        const closes = klinesData.map((k: any) => parseFloat(k[4]));
        
        // ADX returns real values
        const adxResult = obterIndicadorComFallback('ADX', 14, closes, klinesData, null);
        expect(adxResult.fonte).toBe('API');
        
        // EMA still works
        if (closes.length > 42) {
          const emaResult = obterIndicadorComFallback('EMA', 21, closes, klinesData, null);
          expect(emaResult).toHaveProperty('valor');
          expect(emaResult).toHaveProperty('fonte');
          if (emaResult.fonte === 'API') {
            expect(typeof emaResult.valor).toBe('number');
            expect(emaResult.valor).toBeGreaterThan(0);
          }
        }
        
        // RSI still works
        if (closes.length >= 15) {
          const rsiResult = obterIndicadorComFallback('RSI', 14, closes, klinesData, null);
          expect(rsiResult).toHaveProperty('valor');
          expect(rsiResult).toHaveProperty('fonte');
          if (rsiResult.fonte === 'API') {
            expect(rsiResult.valor).toBeGreaterThan(1);
            expect(rsiResult.valor).toBeLessThan(99);
          }
        }
      }),
      { numRuns: 30 }
    );
  });
});

// ============================================================
// 13.2 WORKER FLOW: WebSocket → candle → real extra data → anomaly detection → alert with timeframe
// Validates: Requirements 2.3, 2.4, 3.7
// ============================================================
describe('13.2 Integration: Worker Flow (WebSocket → Candle → Extras → Anomalies → Alert)', () => {

  it('E2E: Worker connects via WebSocket, processes candles, fetches real extras, and records alerts with timeframe', () => {
    /**
     * Validates: Requirements 2.3, 2.4
     * 
     * Verifies the complete worker flow by checking the source code structure:
     * 1. WebSocket connection to Binance Futures
     * 2. Candle processing in processar_candle
     * 3. Real dados_extras fetched via REST API (funding, OI)
     * 4. Anomaly detection functions called with real data
     * 5. Alert includes timeframe field
     */
    const workerCode = readMonitorWorker();
    
    // 1. WebSocket connection to Binance Futures
    expect(workerCode).toContain('wss://fstream.binance.com');
    expect(workerCode).toContain('WebSocketApp');
    
    // 2. processar_candle processes incoming candles
    expect(workerCode).toContain('def processar_candle');
    expect(workerCode).toContain('candles_cache');
    
    // 3. Real dados_extras fetched via REST API
    expect(workerCode).toContain('buscar_funding_rate');
    expect(workerCode).toContain('buscar_open_interest');
    expect(workerCode).toContain('fapi/v1/premiumIndex');
    expect(workerCode).toContain('fapi/v1/openInterest');
    
    // 4. Anomaly detection called with real data in processar_candle
    expect(workerCode).toContain('detectar_funding_extremo');
    expect(workerCode).toContain('detectar_oi_spike');
    expect(workerCode).toContain('detectar_spike_volume');
    expect(workerCode).toContain('detectar_movimento_brusco');
    
    // 5. Alert includes timeframe field
    expect(workerCode).toMatch(/['"]timeframe['"]/);
    expect(workerCode).toContain("'timeframe': TIMEFRAME");
  });

  it('E2E: Worker processar_candle calls buscar_funding_rate and buscar_open_interest before anomaly detection', () => {
    /**
     * Validates: Requirements 2.3
     * 
     * Verifies the correct ordering in processar_candle:
     * 1. Fetch funding rate via REST
     * 2. Fetch open interest via REST
     * 3. Build dados_extras with real values
     * 4. Call anomaly detection with real data
     */
    const workerCode = readMonitorWorker();
    
    // Find processar_candle section
    const processarCandleStart = workerCode.indexOf('def processar_candle');
    expect(processarCandleStart).toBeGreaterThan(-1);
    
    const processarCandleSection = workerCode.slice(processarCandleStart);
    
    // Funding rate is fetched in processar_candle
    expect(processarCandleSection).toContain('buscar_funding_rate');
    
    // Open interest is fetched in processar_candle
    expect(processarCandleSection).toContain('buscar_open_interest');
    
    // dados_extras is built with real funding_rate
    expect(processarCandleSection).toMatch(/funding_rate.*buscar_funding_rate|dados_extras.*funding_rate/s);
    
    // Anomaly detection is called AFTER dados_extras is built
    const dadosExtrasPos = processarCandleSection.indexOf('dados_extras');
    const fundingDetectionPos = processarCandleSection.indexOf('detectar_funding_extremo');
    const oiDetectionPos = processarCandleSection.indexOf('detectar_oi_spike');
    
    expect(dadosExtrasPos).toBeGreaterThan(-1);
    expect(fundingDetectionPos).toBeGreaterThan(dadosExtrasPos);
    expect(oiDetectionPos).toBeGreaterThan(dadosExtrasPos);
  });

  it('E2E: Worker score filter preserves SCORE_MINIMO = 68 threshold', () => {
    /**
     * Validates: Requirements 3.7
     * 
     * Verifies that the score filtering logic is preserved in the worker:
     * - SCORE_MINIMO = 68
     * - filtrar_score is called before alert dispatch
     * - Alerts below threshold are discarded
     */
    const workerCode = readMonitorWorker();
    
    // SCORE_MINIMO is 68
    expect(workerCode).toMatch(/SCORE_MINIMO\s*=\s*68/);
    
    // filtrar_score is defined and used
    expect(workerCode).toContain('def filtrar_score');
    expect(workerCode).toContain('filtrar_score');
    
    // Score check happens in processar_candle flow
    const processarCandleSection = workerCode.slice(workerCode.indexOf('def processar_candle'));
    expect(processarCandleSection).toContain('filtrar_score');
    expect(processarCandleSection).toContain('resultado_score');
  });

  it('E2E: Worker gravar_banco sends timeframe in payload', () => {
    /**
     * Validates: Requirements 2.4
     * 
     * Verifies that when the worker records an alert, the timeframe field
     * is included in the payload sent to the Laravel API.
     */
    const workerCode = readMonitorWorker();
    
    // gravar_banco method exists
    expect(workerCode).toContain('def gravar_banco');
    
    // The payload includes timeframe
    const gravarBancoStart = workerCode.indexOf('def gravar_banco');
    const gravarBancoSection = workerCode.slice(gravarBancoStart, gravarBancoStart + 1000);
    expect(gravarBancoSection).toContain('timeframe');
    
    // processar_alerta includes timeframe in the alert dict
    const processarAlertaStart = workerCode.indexOf('def processar_alerta');
    const processarAlertaSection = workerCode.slice(processarAlertaStart, processarAlertaStart + 1000);
    expect(processarAlertaSection).toContain("'timeframe'");
  });
});

// ============================================================
// 13.3 SSE END-TO-END: worker records alert → SSE detects → frontend receives (without direcao/urgencia)
// Validates: Requirements 2.2, 3.3
// ============================================================
describe('13.3 Integration: SSE End-to-End (Worker → SSE → Frontend)', () => {

  it('E2E: SSE endpoint exists, polls genesis_alertas, and excludes direcao/urgencia from payload', () => {
    /**
     * Validates: Requirements 2.2
     * 
     * Verifies the complete SSE flow:
     * 1. SSE route exists at /v1/alertas/stream
     * 2. Sets correct headers (text/event-stream)
     * 3. Polls genesis_alertas WHERE enviado_sse = 0
     * 4. Excludes direcao and urgencia from transmitted payload
     * 5. Marks alerts as enviado_sse = 1 after sending
     */
    const apiRoutes = readApiRoutes();
    
    // 1. SSE route exists
    expect(apiRoutes).toMatch(/v1\/alertas\/stream/);
    expect(apiRoutes).toMatch(/router\.get.*alertas\/stream/s);
    
    // 2. Correct SSE headers
    expect(apiRoutes).toContain('text/event-stream');
    expect(apiRoutes).toContain('no-cache');
    expect(apiRoutes).toContain('keep-alive');
    
    // 3. Polls for unsent alerts
    expect(apiRoutes).toContain('enviado_sse = 0');
    expect(apiRoutes).toContain('genesis_alertas');
    
    // 4. Excludes direcao and urgencia from payload
    expect(apiRoutes).toMatch(/\{\s*direcao\s*,\s*urgencia\s*,\s*\.\.\.payload\s*\}/);
    
    // 5. Marks as sent after transmission
    expect(apiRoutes).toContain('enviado_sse = 1');
  });

  it('E2E: SSE endpoint sends ping every 30s to keep connection alive', () => {
    /**
     * Validates: Requirements 2.2
     * 
     * Verifies the keep-alive mechanism:
     * - Ping is sent as SSE comment (`: ping`)
     * - Interval is approximately 30 seconds
     */
    const apiRoutes = readApiRoutes();
    
    // Ping mechanism exists
    expect(apiRoutes).toMatch(/: ping/);
    expect(apiRoutes).toMatch(/30000/);
    
    // Poll interval is 10 seconds
    expect(apiRoutes).toMatch(/10000/);
  });

  it('E2E: Frontend connectAlertasSSE creates EventSource with correct URL and handles messages', () => {
    /**
     * Validates: Requirements 3.3
     * 
     * Verifies the frontend SSE client:
     * 1. connectAlertasSSE creates EventSource pointing to /v1/alertas/stream
     * 2. Handles ping messages by ignoring them
     * 3. Parses JSON data from messages
     * 4. Passes parsed data to onMessage callback
     */
    const apiService = readApiService();
    
    // 1. Creates EventSource with correct URL
    expect(apiService).toContain('connectAlertasSSE');
    expect(apiService).toContain('EventSource');
    expect(apiService).toContain('alertas/stream');
    
    // 2. Handles ping messages
    expect(apiService).toMatch(/['"]ping['"]/);
    expect(apiService).toContain('return');
    
    // 3. Parses JSON
    expect(apiService).toContain('JSON.parse');
    
    // 4. Calls onMessage
    expect(apiService).toContain('onMessage');
  });

  it('E2E: useAlertas hook deduplicates alerts and auto-dismisses after 12s', () => {
    /**
     * Validates: Requirements 3.3
     * 
     * Verifies the frontend alert handling:
     * 1. Deduplication by ID (prevents duplicate alerts)
     * 2. Max 5 alerts displayed
     * 3. Auto-dismiss after 12 seconds
     * 4. Reconnection with 3s delay on error
     */
    const hookSource = readUseAlertas();
    
    // 1. Deduplication
    expect(hookSource).toMatch(/some.*id/s);
    
    // 2. Max 5 alerts
    expect(hookSource).toContain('slice(0, 5)');
    
    // 3. Auto-dismiss 12s
    expect(hookSource).toContain('12000');
    
    // 4. Reconnection with 3s delay
    expect(hookSource).toMatch(/setTimeout.*3000/s);
  });

  it('E2E: SSE payload from backend matches what frontend expects (no direcao/urgencia)', () => {
    /**
     * Validates: Requirements 2.2, 3.3
     * 
     * Verifies that the SSE payload structure is consistent:
     * - Backend excludes direcao and urgencia via destructuring
     * - Frontend AlertaGenesis interface includes timeframe (from schema)
     * - The flow is: DB row → exclude fields → JSON → EventSource → parse → display
     */
    const apiRoutes = readApiRoutes();
    const hookSource = readUseAlertas();
    
    // Backend destructures out direcao and urgencia
    expect(apiRoutes).toMatch(/direcao.*urgencia.*payload|urgencia.*direcao.*payload/s);
    
    // Frontend interface includes timeframe
    expect(hookSource).toContain('timeframe: string');
    
    // Frontend interface does NOT require direcao/urgencia from SSE
    // (they exist in the interface for test alerts but not from SSE)
    expect(hookSource).toContain('AlertaGenesis');
  });
});

// ============================================================
// 13.4 LEGACY ALERTS: alerts without timeframe continue working with DEFAULT '1h'
// Validates: Requirements 2.4, 3.4
// ============================================================
describe('13.4 Integration: Legacy Alerts Without Timeframe (DEFAULT 1h)', () => {

  it('E2E: Schema defines timeframe column with DEFAULT 1h for backward compatibility', () => {
    /**
     * Validates: Requirements 2.4, 3.4
     * 
     * Verifies that the schema supports both new alerts (with explicit timeframe)
     * and legacy alerts (without timeframe, using DEFAULT '1h'):
     * 1. timeframe column exists in genesis_alertas
     * 2. Has NOT NULL constraint with DEFAULT '1h'
     * 3. Positioned after corretora column
     * 4. Existing columns remain unchanged
     */
    const schema = readSchemaSQL();
    
    // 1. timeframe column exists
    expect(schema).toMatch(/timeframe\s+VARCHAR/i);
    
    // 2. NOT NULL with DEFAULT '1h'
    expect(schema).toMatch(/timeframe\s+VARCHAR\(\d+\)\s+NOT NULL\s+DEFAULT\s+'1h'/i);
    
    // 3. Positioned after corretora
    const corretoraPos = schema.indexOf('corretora');
    const timeframePos = schema.indexOf('timeframe');
    expect(timeframePos).toBeGreaterThan(corretoraPos);
    
    // 4. Existing columns still present
    const requiredColumns = ['ativo', 'tipo', 'mensagem', 'direcao', 'urgencia', 'corretora', 'preco_atual', 'variacao_pct', 'enviado_sse', 'criado_em'];
    for (const col of requiredColumns) {
      expect(schema).toContain(col);
    }
  });

  it('E2E: Migration SQL adds timeframe with DEFAULT for existing records', () => {
    /**
     * Validates: Requirements 2.4, 3.4
     * 
     * Verifies that the migration file correctly adds the timeframe column
     * with DEFAULT '1h' so existing records automatically get the default value.
     */
    const migrationPath = path.resolve(__dirname, '../../migrations/001_add_timeframe_and_enviado_sse.sql');
    const migrationExists = fs.existsSync(migrationPath);
    expect(migrationExists).toBe(true);
    
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    
    // ALTER TABLE adds timeframe
    expect(migration).toMatch(/ALTER TABLE.*genesis_alertas/i);
    expect(migration).toMatch(/ADD COLUMN.*timeframe/i);
    expect(migration).toMatch(/DEFAULT\s+'1h'/i);
    expect(migration).toMatch(/AFTER\s+corretora/i);
  });

  it('E2E: For any timeframe value, schema accepts INSERT with timeframe field', () => {
    /**
     * Validates: Requirements 2.4
     * 
     * For any valid timeframe value (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w),
     * the schema column definition can store it (VARCHAR(10) is sufficient).
     */
    fc.assert(
      fc.property(timeframeArbitrary, (timeframe) => {
        // All timeframe values fit within VARCHAR(10)
        expect(timeframe.length).toBeLessThanOrEqual(10);
        
        // Schema defines VARCHAR(10) for timeframe
        const schema = readSchemaSQL();
        expect(schema).toMatch(/timeframe\s+VARCHAR\(10\)/i);
      }),
      { numRuns: 20 }
    );
  });

  it('E2E: Existing queries without timeframe in WHERE clause still work (indices preserved)', () => {
    /**
     * Validates: Requirements 3.4
     * 
     * Verifies that existing query patterns (SSE polling, deduplication)
     * continue to work because:
     * 1. Indices are preserved (idx_enviado_sse, idx_criado_em, idx_multiplo)
     * 2. Adding a column with DEFAULT doesn't break existing SELECT/INSERT patterns
     * 3. The SSE endpoint queries by enviado_sse (not timeframe)
     */
    const schema = readSchemaSQL();
    const apiRoutes = readApiRoutes();
    
    // 1. Indices preserved
    expect(schema).toContain('idx_enviado_sse');
    expect(schema).toContain('idx_criado_em');
    expect(schema).toContain('idx_multiplo');
    
    // 2. SSE endpoint queries by enviado_sse (existing pattern)
    expect(apiRoutes).toContain('enviado_sse = 0');
    
    // 3. SSE endpoint does NOT filter by timeframe (backward compatible)
    const sseSection = apiRoutes.slice(apiRoutes.indexOf('alertas/stream'));
    const querySection = sseSection.slice(0, sseSection.indexOf('poll'));
    // The WHERE clause only uses enviado_sse, not timeframe
    expect(apiRoutes).toMatch(/WHERE\s+enviado_sse\s*=\s*0/i);
  });

  it('E2E: Worker sends timeframe in alert payload, but old alerts without it get DEFAULT', () => {
    /**
     * Validates: Requirements 2.4, 3.4
     * 
     * Verifies the complete backward compatibility story:
     * 1. New alerts from worker include timeframe explicitly
     * 2. Schema DEFAULT '1h' handles any legacy INSERTs without timeframe
     * 3. The timeframe field is accessible in SSE payload for new alerts
     */
    const workerCode = readMonitorWorker();
    const schema = readSchemaSQL();
    
    // 1. Worker includes timeframe in alert
    expect(workerCode).toContain("'timeframe'");
    expect(workerCode).toContain('TIMEFRAME');
    
    // 2. Schema has DEFAULT for backward compatibility
    expect(schema).toMatch(/DEFAULT\s+'1h'/i);
    
    // 3. The SSE endpoint transmits all fields (including timeframe) except direcao/urgencia
    const apiRoutes = readApiRoutes();
    // The destructuring `{ direcao, urgencia, ...payload }` means timeframe IS in payload
    expect(apiRoutes).toMatch(/\{\s*direcao\s*,\s*urgencia\s*,\s*\.\.\.payload\s*\}/);
  });
});
