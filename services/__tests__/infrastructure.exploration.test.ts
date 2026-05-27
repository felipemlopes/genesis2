/**
 * Bug Condition Exploration Tests — FASE 3: Infraestrutura Ausente
 * 
 * Validates: Requirements 1.2, 1.3, 1.4
 * 
 * These property-based tests demonstrate the 3 infrastructure bugs:
 * 1. Coluna `timeframe` não existe na tabela `genesis_alertas` (Req 1.4)
 * 2. `monitor_worker.py` passa `dados_extras` com valores zerados/null (Req 1.3)
 * 3. Endpoint SSE `/api/v1/alertas/stream` não existe no backend Node.js (Req 1.2)
 * 
 * EXPECTED: Tests FAIL on unfixed code (failure confirms infrastructure bugs exist)
 * AFTER FIX: Tests PASS (infrastructure is operational)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// HELPER: Read SQL schema file to check column existence
// ============================================================
function readSchemaSQL(): string {
  const schemaPath = path.resolve(__dirname, '../../criar_tabelas.sql');
  return fs.readFileSync(schemaPath, 'utf-8');
}

// ============================================================
// HELPER: Read monitor_worker.py to check dados_extras construction
// ============================================================
function readMonitorWorker(): string {
  const workerPath = path.resolve(__dirname, '../../monitor/monitor_worker.py');
  return fs.readFileSync(workerPath, 'utf-8');
}

// ============================================================
// HELPER: Read server routes to check SSE endpoint existence
// ============================================================
function readServerRoutes(): string {
  const serverPath = path.resolve(__dirname, '../../server.ts');
  return fs.readFileSync(serverPath, 'utf-8');
}

function readApiRoutes(): string {
  const routesPath = path.resolve(__dirname, '../../routes/api.js');
  if (fs.existsSync(routesPath)) {
    return fs.readFileSync(routesPath, 'utf-8');
  }
  return '';
}

// ============================================================
// Arbitraries
// ============================================================

// Timeframe values that should be storable in the database
const timeframeArbitrary = fc.constantFrom('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w');

// Alert data that would be inserted into genesis_alertas
const alertDataArbitrary = fc.record({
  ativo: fc.constantFrom('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'),
  tipo: fc.constantFrom('SPIKE_VOLUME', 'MOVIMENTO_BRUSCO', 'CVD_DIVERGENCIA', 'FUNDING_EXTREMO', 'OI_SPIKE', 'BOOK_IMBALANCE'),
  mensagem: fc.string({ minLength: 10, maxLength: 100 }),
  direcao: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRO'),
  urgencia: fc.constantFrom('ALTA', 'MEDIA', 'BAIXA'),
  corretora: fc.constantFrom('BINANCE', 'BYBIT'),
  timeframe: timeframeArbitrary,
  preco_atual: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
  variacao_pct: fc.float({ min: Math.fround(-50), max: Math.fround(50), noNaN: true }),
});

// dados_extras keys that should have real values from API
const dadosExtrasKeysArbitrary = fc.constantFrom(
  'cvd_slope', 'book_imbalance_ratio', 'funding_rate', 'oi_subindo', 'ls_ratio'
);

// ============================================================
// PROPERTY 1: Bug Condition — Coluna Timeframe Ausente (Req 1.4)
// The schema SQL does NOT include a `timeframe` column in genesis_alertas.
// After fix: schema WILL include `timeframe VARCHAR(10) NOT NULL DEFAULT '1h'`
// ============================================================
describe('Bug Condition Exploration: Coluna Timeframe Ausente (Req 1.4)', () => {
  it('Property: Schema SQL should include timeframe column in genesis_alertas', () => {
    /**
     * Validates: Requirements 1.4
     * 
     * For any valid timeframe value, the schema should support storing it.
     * The correct behavior: `criar_tabelas.sql` includes a `timeframe` column
     * in the CREATE TABLE statement for `genesis_alertas`.
     * 
     * BEFORE FIX: FAILS because column doesn't exist in schema
     * AFTER FIX: PASSES because column is added
     */
    const schema = readSchemaSQL();

    fc.assert(
      fc.property(timeframeArbitrary, (timeframe) => {
        // The schema SHOULD define a timeframe column
        const hasTimeframeColumn = /timeframe\s+VARCHAR/i.test(schema);
        expect(hasTimeframeColumn).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  it('Property: Schema should allow INSERT with timeframe field for any alert', () => {
    /**
     * Validates: Requirements 1.4
     * 
     * For any alert data with a timeframe field, the schema should accept it.
     * We verify this by checking the CREATE TABLE statement includes the column
     * positioned after `corretora` as specified in the design.
     * 
     * BEFORE FIX: FAILS because timeframe column is not in the schema
     * AFTER FIX: PASSES because column exists with DEFAULT '1h'
     */
    const schema = readSchemaSQL();

    fc.assert(
      fc.property(alertDataArbitrary, (alertData) => {
        // Extract column names from CREATE TABLE statement
        const createTableMatch = schema.match(/CREATE TABLE.*?genesis_alertas\s*\(([\s\S]*?)\)\s*ENGINE/i);
        expect(createTableMatch).not.toBeNull();

        const tableBody = createTableMatch![1];
        
        // timeframe column should exist in the table definition
        const hasTimeframe = /timeframe/i.test(tableBody);
        expect(hasTimeframe).toBe(true);

        // timeframe should be positioned after corretora
        const corretoraPos = tableBody.indexOf('corretora');
        const timeframePos = tableBody.indexOf('timeframe');
        expect(timeframePos).toBeGreaterThan(corretoraPos);
      }),
      { numRuns: 20 }
    );
  });
});

// ============================================================
// PROPERTY 2: Bug Condition — Worker dados_extras Zerados (Req 1.3)
// The worker hardcodes dados_extras with zeros/nulls instead of fetching real data.
// After fix: worker fetches real funding, OI data from Binance APIs.
// ============================================================
describe('Bug Condition Exploration: Worker dados_extras Zerados (Req 1.3)', () => {
  it('Property: Worker should fetch real dados_extras, not hardcode zeros/nulls', () => {
    /**
     * Validates: Requirements 1.3
     * 
     * For any dados_extras key (cvd_slope, book_imbalance_ratio, funding_rate, 
     * oi_subindo, ls_ratio), the worker should fetch real values from APIs
     * instead of hardcoding zeros/nulls.
     * 
     * BEFORE FIX: FAILS because dados_extras is hardcoded as {cvd_slope: 0, ...null}
     * AFTER FIX: PASSES because worker fetches real data from Binance APIs
     */
    const workerCode = readMonitorWorker();

    fc.assert(
      fc.property(dadosExtrasKeysArbitrary, (key) => {
        // Find the line where dados_extras is constructed
        const dadosExtrasMatch = workerCode.match(/dados_extras\s*=\s*\{([^}]+)\}/);
        expect(dadosExtrasMatch).not.toBeNull();

        const dadosExtrasStr = dadosExtrasMatch![1];

        // The correct behavior: dados_extras should NOT be a static dict with zeros/nulls
        // It should be populated by API calls (e.g., buscar_dados_extras, fetch_funding, etc.)
        const isHardcodedZeroOrNull = /cvd_slope['"]?\s*:\s*0/.test(dadosExtrasStr) &&
          /book_imbalance_ratio['"]?\s*:\s*None/.test(dadosExtrasStr) &&
          /funding_rate['"]?\s*:\s*None/.test(dadosExtrasStr) &&
          /oi_subindo['"]?\s*:\s*None/.test(dadosExtrasStr);

        // Should NOT be all hardcoded zeros/nulls
        expect(isHardcodedZeroOrNull).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  it('Property: Worker should call real API functions to populate dados_extras', () => {
    /**
     * Validates: Requirements 1.3
     * 
     * The worker code should contain calls to fetch real data from exchange APIs
     * (e.g., /fapi/v1/premiumIndex for funding, /fapi/v1/openInterest for OI)
     * before constructing dados_extras.
     * 
     * BEFORE FIX: FAILS because no API fetch calls exist before dados_extras assignment
     * AFTER FIX: PASSES because worker fetches from Binance REST APIs
     */
    const workerCode = readMonitorWorker();

    // Find the processar_candle method section where dados_extras is built
    const processarCandleStart = workerCode.indexOf('def processar_candle');
    const onMessageStart = workerCode.indexOf('def _on_message');
    const processarCandleSection = workerCode.slice(
      processarCandleStart >= 0 ? processarCandleStart : 0,
      onMessageStart >= 0 ? onMessageStart : workerCode.length
    );

    // The correct behavior: there should be HTTP/REST API calls to fetch real data
    // Look for actual network requests (requests.get, httpx, aiohttp, urllib)
    // NOT just the key name 'funding_rate' in a dict literal
    const hasFundingAPICall = /premiumIndex|fapi\/v1\/premiumIndex|requests\.get.*funding|buscar_funding|fetch_funding_rate/i.test(processarCandleSection);
    const hasOIAPICall = /fapi\/v1\/openInterest|requests\.get.*openInterest|buscar_oi|fetch_open_interest/i.test(processarCandleSection);

    // At least one real REST API fetch should exist in processar_candle
    expect(hasFundingAPICall || hasOIAPICall).toBe(true);
  });
});

// ============================================================
// PROPERTY 3: Bug Condition — SSE Endpoint 404 (Req 1.2)
// The Node.js backend does NOT have an SSE endpoint at /api/v1/alertas/stream.
// After fix: endpoint exists and returns text/event-stream responses.
// ============================================================
describe('Bug Condition Exploration: SSE Endpoint 404 (Req 1.2)', () => {
  it('Property: Backend should define SSE route /api/v1/alertas/stream', () => {
    /**
     * Validates: Requirements 1.2
     * 
     * The server.ts or routes/api.js should define a route for
     * GET /api/v1/alertas/stream that returns Server-Sent Events.
     * 
     * BEFORE FIX: FAILS because no SSE route exists in Node.js backend
     * AFTER FIX: PASSES because SSE endpoint is implemented
     */
    const serverCode = readServerRoutes();
    const apiRoutes = readApiRoutes();
    const allRouteCode = serverCode + '\n' + apiRoutes;

    fc.assert(
      fc.property(fc.constant(null), () => {
        // The correct behavior: route for alertas/stream should exist
        const hasSSERoute = /alertas.*stream|alerta.*stream/i.test(allRouteCode);
        expect(hasSSERoute).toBe(true);
      }),
      { numRuns: 1 }
    );
  });

  it('Property: SSE endpoint should set correct headers (text/event-stream)', () => {
    /**
     * Validates: Requirements 1.2
     * 
     * The SSE endpoint implementation should set the Content-Type header
     * to 'text/event-stream' for proper SSE protocol compliance.
     * 
     * BEFORE FIX: FAILS because endpoint doesn't exist
     * AFTER FIX: PASSES because endpoint sets correct headers
     */
    const serverCode = readServerRoutes();
    const apiRoutes = readApiRoutes();
    const allRouteCode = serverCode + '\n' + apiRoutes;

    fc.assert(
      fc.property(fc.constant(null), () => {
        // The correct behavior: SSE implementation should reference event-stream content type
        const hasEventStreamHeader = /text\/event-stream/i.test(allRouteCode);
        expect(hasEventStreamHeader).toBe(true);
      }),
      { numRuns: 1 }
    );
  });

  it('Property: SSE endpoint should poll genesis_alertas and transmit new alerts', () => {
    /**
     * Validates: Requirements 1.2
     * 
     * The SSE endpoint should query genesis_alertas for unsent alerts
     * (WHERE enviado_sse = 0) and transmit them to connected clients.
     * 
     * BEFORE FIX: FAILS because no SSE logic exists in Node.js backend
     * AFTER FIX: PASSES because endpoint polls and transmits alerts
     */
    const serverCode = readServerRoutes();
    const apiRoutes = readApiRoutes();
    const allRouteCode = serverCode + '\n' + apiRoutes;

    fc.assert(
      fc.property(fc.constant(null), () => {
        // The correct behavior: SSE should reference enviado_sse for polling
        const hasPollingLogic = /enviado_sse|enviado.*sse/i.test(allRouteCode);
        expect(hasPollingLogic).toBe(true);
      }),
      { numRuns: 1 }
    );
  });
});
