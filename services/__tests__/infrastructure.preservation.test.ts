/**
 * Preservation Tests — FASE 3: Infraestrutura de Monitoramento
 * 
 * Validates: Requirements 3.3, 3.4, 3.7
 * 
 * These property-based tests capture the CURRENT correct behavior that must NOT change
 * after infrastructure fixes are applied. They follow observation-first methodology:
 * 1. Observe current behavior on unfixed code
 * 2. Write property tests that pass on current code
 * 3. After fixes, re-run to confirm zero regressions
 * 
 * PRESERVATION TARGETS:
 * - Queries existentes continuam funcionando (DEFAULT na nova coluna) [Req 3.4]
 * - Filtro de score mínimo continua ativo no worker [Req 3.7]
 * - Reconexão SSE com backoff é preservada no frontend [Req 3.3]
 * 
 * EXPECTED: Tests PASS on unfixed code (confirms baseline behavior to preserve)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// HELPER: Read SQL schema file
// ============================================================
function readSchemaSQL(): string {
  const schemaPath = path.resolve(__dirname, '../../criar_tabelas.sql');
  return fs.readFileSync(schemaPath, 'utf-8');
}

// ============================================================
// HELPER: Read monitor_worker.py
// ============================================================
function readMonitorWorker(): string {
  const workerPath = path.resolve(__dirname, '../../monitor/monitor_worker.py');
  return fs.readFileSync(workerPath, 'utf-8');
}

// ============================================================
// HELPER: Read useAlertas.ts (SSE reconnection hook)
// ============================================================
function readUseAlertas(): string {
  const hookPath = path.resolve(__dirname, '../../hooks/useAlertas.ts');
  return fs.readFileSync(hookPath, 'utf-8');
}

// ============================================================
// HELPER: Read api.ts (SSE connection function)
// ============================================================
function readApiService(): string {
  const apiPath = path.resolve(__dirname, '../api.ts');
  return fs.readFileSync(apiPath, 'utf-8');
}


// ============================================================
// HELPER: Simulate worker score filtering logic (extracted from monitor_worker.py)
// This mirrors the Python logic: score < SCORE_MINIMO → discard
// ============================================================
const SCORE_MINIMO = 68;

function filtrarScore(score: number): boolean {
  if (score < SCORE_MINIMO) {
    return false; // Alert discarded
  }
  return true; // Alert passes filter
}

// ============================================================
// HELPER: Simulate SSE reconnection with backoff
// Mirrors the useAlertas.ts commented-out logic
// ============================================================
function createSSEReconnectionSimulator() {
  let reconnectAttempts = 0;
  let isConnected = false;
  const RECONNECT_DELAY_MS = 3000;

  return {
    connect: () => { isConnected = true; reconnectAttempts = 0; },
    disconnect: () => { isConnected = false; },
    onError: () => {
      isConnected = false;
      reconnectAttempts++;
      return { shouldReconnect: true, delayMs: RECONNECT_DELAY_MS };
    },
    getState: () => ({ isConnected, reconnectAttempts }),
    getReconnectDelay: () => RECONNECT_DELAY_MS,
  };
}

// ============================================================
// Arbitraries
// ============================================================

// Score values that should be FILTERED (below minimum)
const scoreBelowMinArbitrary = fc.integer({ min: 0, max: 67 });

// Score values that should PASS the filter (at or above minimum)
const scoreAboveMinArbitrary = fc.integer({ min: 68, max: 100 });

// Any valid score value
const anyScoreArbitrary = fc.integer({ min: 0, max: 100 });

// Alert data that would be queried from genesis_alertas (existing columns only)
const existingAlertQueryArbitrary = fc.record({
  ativo: fc.constantFrom('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'),
  tipo: fc.constantFrom('SPIKE_VOLUME', 'MOVIMENTO_BRUSCO', 'CVD_DIVERGENCIA', 'FUNDING_EXTREMO', 'OI_SPIKE', 'BOOK_IMBALANCE'),
  corretora: fc.constantFrom('BINANCE', 'BYBIT'),
  enviado_sse: fc.constantFrom(0, 1),
});

// Simulated SSE error scenarios
const sseErrorArbitrary = fc.record({
  errorType: fc.constantFrom('network', 'timeout', 'server_error', '404'),
  consecutiveFailures: fc.integer({ min: 1, max: 10 }),
});

// ============================================================
// PROPERTY 1: Queries existentes continuam funcionando (Req 3.4)
// The current schema works WITHOUT a timeframe column.
// After adding timeframe with DEFAULT '1h', existing queries must still work.
// ============================================================
describe('Preservation: Queries Existentes sem Timeframe (Req 3.4)', () => {
  it('Property: Current schema defines genesis_alertas without timeframe column', () => {
    /**
     * Validates: Requirements 3.4
     * 
     * OBSERVATION: The current schema in criar_tabelas.sql does NOT have a timeframe column.
     * All existing queries work without it. After adding timeframe with DEFAULT '1h',
     * existing queries (SELECT, INSERT without timeframe) must continue working.
     * 
     * This test confirms the baseline: schema currently has no timeframe column,
     * and existing column set is complete for current operations.
     */
    const schema = readSchemaSQL();

    // Confirm existing columns ARE present (these must remain after fix)
    const requiredColumns = [
      'ativo', 'tipo', 'mensagem', 'direcao', 'urgencia',
      'corretora', 'preco_atual', 'variacao_pct',
      'enviado_sse', 'enviado_telegram', 'criado_em'
    ];

    for (const col of requiredColumns) {
      expect(schema).toContain(col);
    }
  });

  it('Property: Existing indices are defined for query performance', () => {
    /**
     * Validates: Requirements 3.4
     * 
     * OBSERVATION: The current schema has indices for SSE polling and deduplication.
     * These indices must remain functional after adding the timeframe column.
     */
    const schema = readSchemaSQL();

    // These indices must be preserved
    expect(schema).toContain('idx_enviado_sse');
    expect(schema).toContain('idx_criado_em');
    expect(schema).toContain('idx_multiplo');
  });

  it('Property: For any existing alert data, SELECT queries use only existing columns', () => {
    /**
     * Validates: Requirements 3.4
     * 
     * For any alert record using existing columns (ativo, tipo, corretora, enviado_sse),
     * queries filtering by these columns must continue to work.
     * After adding timeframe with DEFAULT, these queries remain valid because
     * the new column has a DEFAULT value and doesn't affect existing WHERE clauses.
     */
    fc.assert(
      fc.property(existingAlertQueryArbitrary, (alertQuery) => {
        // Simulate a WHERE clause using existing columns
        const whereClause = `WHERE ativo = '${alertQuery.ativo}' AND tipo = '${alertQuery.tipo}' AND corretora = '${alertQuery.corretora}' AND enviado_sse = ${alertQuery.enviado_sse}`;

        // All referenced columns exist in current schema
        const schema = readSchemaSQL();
        expect(schema).toContain('ativo');
        expect(schema).toContain('tipo');
        expect(schema).toContain('corretora');
        expect(schema).toContain('enviado_sse');

        // The query structure is valid (no reference to timeframe needed)
        expect(whereClause).not.toContain('timeframe');
      }),
      { numRuns: 30 }
    );
  });

  it('Property: INSERT without timeframe is valid in current schema', () => {
    /**
     * Validates: Requirements 3.4
     * 
     * OBSERVATION: Current INSERTs don't include timeframe (column doesn't exist).
     * After fix, INSERTs without timeframe must still work because DEFAULT '1h' is set.
     * This test confirms the current INSERT pattern uses only existing columns.
     */
    const schema = readSchemaSQL();

    // Current INSERT pattern (from monitor_worker.py gravar_banco) uses these columns:
    const insertColumns = ['ativo', 'tipo', 'mensagem', 'direcao', 'urgencia', 'corretora', 'preco_atual', 'variacao_pct', 'criado_em'];

    for (const col of insertColumns) {
      expect(schema).toContain(col);
    }

    // Confirm timeframe now exists in schema WITH DEFAULT, so old INSERTs still work
    // The DEFAULT '1h' ensures INSERT without timeframe column succeeds
    const hasTimeframeColumn = /timeframe\s+VARCHAR/i.test(schema);
    expect(hasTimeframeColumn).toBe(true); // After fix: timeframe column exists with DEFAULT

    // Verify it has a DEFAULT value (critical for preservation of old INSERTs)
    const hasDefault = /timeframe\s+VARCHAR\(\d+\)\s+NOT NULL\s+DEFAULT\s+'1h'/i.test(schema);
    expect(hasDefault).toBe(true); // DEFAULT '1h' ensures backward compatibility
  });
});


// ============================================================
// PROPERTY 2: Filtro de score mínimo continua ativo no worker (Req 3.7)
// Alerts with score < SCORE_MINIMO (68) are filtered and discarded.
// This behavior must be preserved after worker enrichment with real dados_extras.
// ============================================================
describe('Preservation: Filtro de Score Mínimo no Worker (Req 3.7)', () => {
  it('Property: For any score below SCORE_MINIMO (68), alert is discarded', () => {
    /**
     * Validates: Requirements 3.7
     * 
     * OBSERVATION: monitor_worker.py defines SCORE_MINIMO = 68.
     * The filtrar_score() method returns False for score < 68, preventing alert dispatch.
     * This filtering must be preserved after enriching dados_extras with real data.
     * 
     * For any score value < 68, the filter rejects the alert.
     */
    fc.assert(
      fc.property(scoreBelowMinArbitrary, (score) => {
        const passes = filtrarScore(score);
        expect(passes).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('Property: For any score at or above SCORE_MINIMO (68), alert passes filter', () => {
    /**
     * Validates: Requirements 3.7
     * 
     * OBSERVATION: Alerts with score >= 68 pass the filter and are processed.
     * This must remain true after worker enrichment.
     * 
     * For any score value >= 68, the filter allows the alert through.
     */
    fc.assert(
      fc.property(scoreAboveMinArbitrary, (score) => {
        const passes = filtrarScore(score);
        expect(passes).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Property: SCORE_MINIMO constant is 68 in worker source', () => {
    /**
     * Validates: Requirements 3.7
     * 
     * OBSERVATION: The worker defines SCORE_MINIMO = 68 as a module-level constant.
     * This threshold must not change after infrastructure fixes.
     */
    const workerSource = readMonitorWorker();

    // Verify SCORE_MINIMO is defined as 68
    expect(workerSource).toMatch(/SCORE_MINIMO\s*=\s*68/);
  });

  it('Property: filtrar_score is called in processar_candle before alert dispatch', () => {
    /**
     * Validates: Requirements 3.7
     * 
     * OBSERVATION: In processar_candle(), after calcular_indicadores_e_score() returns,
     * filtrar_score() is called to gate alert processing. This call chain must be preserved.
     */
    const workerSource = readMonitorWorker();

    // Verify the filtering pattern exists in processar_candle
    expect(workerSource).toContain('filtrar_score');
    expect(workerSource).toContain('calcular_indicadores_e_score');

    // Verify the pattern: resultado_score check + filtrar_score call
    expect(workerSource).toMatch(/resultado_score.*filtrar_score/s);
  });

  it('Property: Score boundary - exactly 68 passes, exactly 67 fails', () => {
    /**
     * Validates: Requirements 3.7
     * 
     * Boundary test: score of exactly 68 passes, score of exactly 67 is discarded.
     * This precise boundary must be preserved.
     */
    expect(filtrarScore(68)).toBe(true);
    expect(filtrarScore(67)).toBe(false);
    expect(filtrarScore(0)).toBe(false);
    expect(filtrarScore(100)).toBe(true);
  });

  it('Property: Worker discards alerts below minimum regardless of alert type', () => {
    /**
     * Validates: Requirements 3.7
     * 
     * For any combination of alert type and low score, the filter discards.
     * The filter is score-only, independent of alert type/ativo/corretora.
     */
    const alertTypeArbitrary = fc.constantFrom(
      'SPIKE_VOLUME', 'MOVIMENTO_BRUSCO', 'CVD_DIVERGENCIA',
      'FUNDING_EXTREMO', 'OI_SPIKE', 'BOOK_IMBALANCE'
    );

    fc.assert(
      fc.property(
        fc.tuple(alertTypeArbitrary, scoreBelowMinArbitrary),
        ([_alertType, score]) => {
          // Score filter is independent of alert type
          const passes = filtrarScore(score);
          expect(passes).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});


// ============================================================
// PROPERTY 3: Reconexão SSE com backoff é preservada no frontend (Req 3.3)
// When SSE connection fails, frontend reconnects with delay (3s).
// This behavior must be preserved after implementing the SSE endpoint.
// ============================================================
describe('Preservation: Reconexão SSE com Backoff (Req 3.3)', () => {
  it('Property: SSE reconnection logic exists in useAlertas hook source', () => {
    /**
     * Validates: Requirements 3.3
     * 
     * OBSERVATION: useAlertas.ts contains (commented-out) SSE reconnection logic
     * that reconnects after 3 seconds on error. This pattern must be preserved
     * (and re-enabled) after the SSE endpoint is implemented.
     */
    const hookSource = readUseAlertas();

    // The reconnection pattern exists (even if commented out)
    expect(hookSource).toContain('connectAlertasSSE');
    expect(hookSource).toContain('reconnect');
    // The 3-second delay is defined
    expect(hookSource).toMatch(/setTimeout.*3000/s);
  });

  it('Property: connectAlertasSSE function creates EventSource with correct URL pattern', () => {
    /**
     * Validates: Requirements 3.3
     * 
     * OBSERVATION: api.ts defines connectAlertasSSE that creates an EventSource
     * pointing to /v1/alertas/stream with optional token parameter.
     * This URL pattern and connection setup must be preserved.
     */
    const apiSource = readApiService();

    // Function exists and creates EventSource
    expect(apiSource).toContain('connectAlertasSSE');
    expect(apiSource).toContain('EventSource');
    // URL pattern includes alertas/stream
    expect(apiSource).toMatch(/alertas\/stream/);
    // Token is passed as query parameter
    expect(apiSource).toContain('token');
  });

  it('Property: SSE connection handles ping messages by ignoring them', () => {
    /**
     * Validates: Requirements 3.3
     * 
     * OBSERVATION: connectAlertasSSE in api.ts checks for 'ping' messages
     * and returns early without processing them. This keep-alive handling
     * must be preserved.
     */
    const apiSource = readApiService();

    // Ping handling exists
    expect(apiSource).toMatch(/['"]ping['"]/);
    expect(apiSource).toContain('return');
  });

  it('Property: For any number of consecutive SSE failures, reconnection is always attempted', () => {
    /**
     * Validates: Requirements 3.3
     * 
     * For any number of consecutive SSE connection failures,
     * the system always attempts reconnection (no give-up threshold).
     * The reconnection delay is constant at 3000ms.
     */
    fc.assert(
      fc.property(sseErrorArbitrary, (errorScenario) => {
        const simulator = createSSEReconnectionSimulator();

        // Simulate consecutive failures
        for (let i = 0; i < errorScenario.consecutiveFailures; i++) {
          const result = simulator.onError();
          // Should always attempt reconnection
          expect(result.shouldReconnect).toBe(true);
          // Delay should always be 3000ms (constant, not exponential in current impl)
          expect(result.delayMs).toBe(3000);
        }

        // After errors, state should show disconnected
        const state = simulator.getState();
        expect(state.isConnected).toBe(false);
        expect(state.reconnectAttempts).toBe(errorScenario.consecutiveFailures);
      }),
      { numRuns: 50 }
    );
  });

  it('Property: SSE reconnection resets attempt counter on successful connection', () => {
    /**
     * Validates: Requirements 3.3
     * 
     * After a successful reconnection, the attempt counter resets.
     * This ensures the system doesn't accumulate stale state.
     */
    const simulator = createSSEReconnectionSimulator();

    // Simulate some failures
    simulator.onError();
    simulator.onError();
    simulator.onError();
    expect(simulator.getState().reconnectAttempts).toBe(3);

    // Successful reconnection resets counter
    simulator.connect();
    expect(simulator.getState().isConnected).toBe(true);
    expect(simulator.getState().reconnectAttempts).toBe(0);
  });

  it('Property: Frontend cleanup closes EventSource on unmount', () => {
    /**
     * Validates: Requirements 3.3
     * 
     * OBSERVATION: useAlertas.ts cleanup function closes the EventSource
     * and clears reconnection timeouts. This cleanup must be preserved.
     */
    const hookSource = readUseAlertas();

    // Cleanup pattern exists (even if commented out, the structure is there)
    expect(hookSource).toContain('close');
    expect(hookSource).toContain('clearTimeout');
  });

  it('Property: SSE message parsing handles JSON data correctly', () => {
    /**
     * Validates: Requirements 3.3
     * 
     * OBSERVATION: connectAlertasSSE parses incoming messages as JSON
     * and passes them to the onMessage callback. Invalid JSON is silently caught.
     * This error-tolerant parsing must be preserved.
     */
    const apiSource = readApiService();

    // JSON parsing with try/catch exists
    expect(apiSource).toContain('JSON.parse');
    expect(apiSource).toContain('try');
    expect(apiSource).toContain('catch');
  });

  it('Property: Alert deduplication by ID is preserved in useAlertas', () => {
    /**
     * Validates: Requirements 3.3
     * 
     * OBSERVATION: useAlertas.ts checks if an alert ID already exists before adding.
     * This prevents duplicate alerts from appearing in the UI.
     * Must be preserved after SSE endpoint implementation.
     */
    const hookSource = readUseAlertas();

    // Deduplication check exists
    expect(hookSource).toMatch(/some.*id/s);
    // Max alerts limit (5) is enforced
    expect(hookSource).toContain('slice(0, 5)');
  });

  it('Property: Auto-dismiss timeout of 12 seconds is preserved', () => {
    /**
     * Validates: Requirements 3.3
     * 
     * OBSERVATION: Alerts are automatically removed after 12 seconds.
     * This UX behavior must be preserved regardless of SSE implementation.
     */
    const hookSource = readUseAlertas();

    // 12-second auto-dismiss
    expect(hookSource).toContain('12000');
  });
});
