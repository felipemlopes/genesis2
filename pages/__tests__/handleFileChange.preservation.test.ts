/**
 * Preservation Tests — handleFileChange (Property 2)
 * 
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 * 
 * Property 2: Preservation — Atualização do Par em Detecção Bem-Sucedida
 * 
 * These property-based tests capture the CURRENT correct behavior that must NOT change
 * after the bugfix is applied. They follow observation-first methodology:
 * 1. Observe current behavior on unfixed code
 * 2. Write property tests that pass on current code
 * 3. After fix, re-run to confirm zero regressions
 * 
 * EXPECTED: Tests PASS on unfixed code (confirms baseline behavior to preserve)
 */
import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { normalizarPar } from '../../services/normalizarPar';

// ============================================================
// Simulated State & Types (mirrors GenesisPage.tsx)
// ============================================================

interface SimulatedState {
  selectedPair: string;
  exchange: string;
  timeframe: string;
  isScanning: boolean;
  refreshTrigger: number;
  selectedFile: File | null;
  chartMetadata: any;
  result: any;
}

interface UnifiedResult {
  pair: string | null;
  exchange?: string | null;
  timeframe?: string | null;
  supports: number[];
  resistances: number[];
  trendlines: any[];
  fibonacci: any[];
  patterns: string[];
}

// ============================================================
// Simulation of handleFileChange logic (mirrors GenesisPage.tsx)
// Includes the bug — this is the UNFIXED code behavior
// ============================================================

async function simulateHandleFileChange(
  state: SimulatedState,
  unifiedChartAnalysisMock: (file: File) => Promise<UnifiedResult>,
  file: File
): Promise<{ state: SimulatedState; fetchCalled: boolean; fetchPair: string }> {
  const newState = { ...state };
  newState.selectedFile = file;
  newState.chartMetadata = null;
  newState.result = null;
  newState.isScanning = true;
  let fetchCalled = false;
  let fetchPair = '';

  try {
    const unifiedResult = await unifiedChartAnalysisMock(file);
    newState.chartMetadata = unifiedResult;

    // Exchange detection
    let newExchange = newState.exchange;
    if (unifiedResult.exchange && unifiedResult.exchange !== 'UNK') {
      const cleanEx = unifiedResult.exchange.toLowerCase();
      if (cleanEx.includes('binance')) newExchange = 'Binance';
      else if (cleanEx.includes('bybit')) newExchange = 'Bybit';
      else if (cleanEx.includes('bitget')) newExchange = 'Bitget';
      else if (cleanEx.includes('okx')) newExchange = 'OKX';
      newState.exchange = newExchange;
    }

    // Pair detection
    let newPair = '';
    if (unifiedResult.pair && unifiedResult.pair !== 'UNK') {
      const cleanPair = normalizarPar(unifiedResult.pair);
      newPair = cleanPair;
      newState.selectedPair = cleanPair;
      newState.refreshTrigger = newState.refreshTrigger + 1;
    }

    // Timeframe detection
    if (unifiedResult.timeframe && unifiedResult.timeframe !== 'UNK') {
      const tfMap: Record<string, string> = {
        '1M': '1M', 'MONTHLY': '1M', 'M': '1M', 'MONTH': '1M',
        '1W': '1w', 'WEEKLY': '1w', 'W': '1w', 'WEEK': '1w',
        '1D': '1d', 'DAILY': '1d', 'D': '1d', 'DAY': '1d',
        '12H': '12h', 'H12': '12h',
        '4H': '4h', 'H4': '4h',
        '3H': '3h', 'H3': '3h',
        '2H': '2h', 'H2': '2h', '120M': '2h',
        '1H': '1h', 'H1': '1h', '60M': '1h',
        '15M': '15m', 'M15': '15m',
      };
      const normalizedTf = tfMap[unifiedResult.timeframe.toUpperCase()] || unifiedResult.timeframe;
      if (['15m', '1h', '2h', '3h', '4h', '12h', '1d', '1w', '1M'].includes(normalizedTf)) {
        newState.timeframe = normalizedTf;
      }
    }

    // Fetch trigger
    if (newPair) {
      fetchCalled = true;
      fetchPair = newPair;
    }
  } catch (err: any) {
    // Fixed: no longer clears existing pair on error
  } finally {
    newState.isScanning = false;
  }

  return { state: newState, fetchCalled, fetchPair };
}

// ============================================================
// Bug Condition Function (from spec) — used to filter inputs
// ============================================================
function isBugCondition(input: { existingPair: string; analysisResult: UnifiedResult | Error }): boolean {
  if (input.existingPair === '') return false;
  if (input.analysisResult instanceof Error) return true;
  return !input.analysisResult.pair || input.analysisResult.pair === 'UNK';
}

// ============================================================
// Arbitraries for property-based testing
// ============================================================

const validPairArbitrary = fc.constantFrom(
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT',
  'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'BNBUSDT',
  'LTCUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT', 'MATICUSDT'
);

// Pairs that need normalization (slash, lowercase, other stablecoins)
const rawPairArbitrary = fc.constantFrom(
  'BTC/USDT', 'ETH/USDC', 'SOL/USD', 'DOGE/BUSD',
  'btcusdt', 'ethusdt', 'solusdt',
  'BTCUSDC', 'ETHBUSD', 'SOLUSD',
  '1000PEPEUSDT', '1000SHIBUSDT',
  'BTCUSD.P', 'ETHUSDPERP'
);

const exchangeArbitrary = fc.constantFrom(
  'binance', 'Binance', 'BINANCE',
  'bybit', 'Bybit', 'BYBIT',
  'bitget', 'Bitget', 'BITGET',
  'okx', 'OKX', 'Okx'
);

const timeframeArbitrary = fc.constantFrom(
  '1M', 'MONTHLY', 'M', 'MONTH',
  '1W', 'WEEKLY', 'W', 'WEEK',
  '1D', 'DAILY', 'D', 'DAY',
  '12H', 'H12',
  '4H', 'H4',
  '3H', 'H3',
  '2H', 'H2', '120M',
  '1H', 'H1', '60M',
  '15M', 'M15'
);

const existingPairArbitrary = fc.constantFrom('', 'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT');
const existingExchangeArbitrary = fc.constantFrom('Binance', 'Bybit', 'Bitget', 'OKX');
const existingTimeframeArbitrary = fc.constantFrom('15m', '1h', '4h', '1d', '1w');

// ============================================================
// TESTS — Property 2: Preservation
// ============================================================

describe('Preservation: handleFileChange with valid pair detection (Req 3.1, 3.2, 3.3, 3.4)', () => {
  const mockFile = new File(['fake-image-data'], 'chart.png', { type: 'image/png' });

  function createInitialState(overrides: Partial<SimulatedState> = {}): SimulatedState {
    return {
      selectedPair: '',
      exchange: 'Binance',
      timeframe: '4h',
      isScanning: false,
      refreshTrigger: 0,
      selectedFile: null,
      chartMetadata: null,
      result: null,
      ...overrides,
    };
  }

  // ----------------------------------------------------------
  // Observation 1: Valid pair detection updates selectedPair
  // ----------------------------------------------------------
  describe('Observation: selectedPair is updated when valid pair detected (Req 3.1)', () => {
    it('Observation: pair "BTCUSDT" from analysis → selectedPair becomes "BTCUSDT"', async () => {
      const initialState = createInitialState({ selectedPair: '' });
      const mockAnalysis = vi.fn().mockResolvedValue({
        pair: 'BTCUSDT', exchange: 'binance', timeframe: '4H',
        supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
      });

      const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);
      // Observed: selectedPair is updated to the normalized pair
      expect(state.selectedPair).toBe('BTCUSDT');
    });

    it('Observation: pair "ETH/USDC" from analysis → selectedPair becomes "ETHUSDT" (normalized)', async () => {
      const initialState = createInitialState({ selectedPair: 'SOLUSDT' });
      const mockAnalysis = vi.fn().mockResolvedValue({
        pair: 'ETH/USDC', exchange: 'bybit', timeframe: '1D',
        supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
      });

      const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);
      // Observed: selectedPair is updated to normalized pair (overrides existing)
      expect(state.selectedPair).toBe('ETHUSDT');
    });
  });

  // ----------------------------------------------------------
  // Observation 2: Exchange detection updates exchange state
  // ----------------------------------------------------------
  describe('Observation: exchange is updated when detected (Req 3.2)', () => {
    it('Observation: exchange "binance" → state.exchange becomes "Binance"', async () => {
      const initialState = createInitialState({ exchange: 'OKX' });
      const mockAnalysis = vi.fn().mockResolvedValue({
        pair: 'BTCUSDT', exchange: 'binance', timeframe: '4H',
        supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
      });

      const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);
      expect(state.exchange).toBe('Binance');
    });

    it('Observation: exchange "bybit" → state.exchange becomes "Bybit"', async () => {
      const initialState = createInitialState({ exchange: 'Binance' });
      const mockAnalysis = vi.fn().mockResolvedValue({
        pair: 'ETHUSDT', exchange: 'bybit', timeframe: '1H',
        supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
      });

      const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);
      expect(state.exchange).toBe('Bybit');
    });
  });

  // ----------------------------------------------------------
  // Observation 3: Timeframe detection updates timeframe state
  // ----------------------------------------------------------
  describe('Observation: timeframe is updated when detected (Req 3.3)', () => {
    it('Observation: timeframe "4H" → state.timeframe becomes "4h"', async () => {
      const initialState = createInitialState({ timeframe: '1d' });
      const mockAnalysis = vi.fn().mockResolvedValue({
        pair: 'BTCUSDT', exchange: 'binance', timeframe: '4H',
        supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
      });

      const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);
      expect(state.timeframe).toBe('4h');
    });

    it('Observation: timeframe "DAILY" → state.timeframe becomes "1d"', async () => {
      const initialState = createInitialState({ timeframe: '15m' });
      const mockAnalysis = vi.fn().mockResolvedValue({
        pair: 'SOLUSDT', exchange: 'okx', timeframe: 'DAILY',
        supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
      });

      const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);
      expect(state.timeframe).toBe('1d');
    });
  });

  // ----------------------------------------------------------
  // Property-Based Tests
  // ----------------------------------------------------------

  describe('Property 2: For all valid pair inputs, selectedPair is updated with normalized pair (Req 3.1)', () => {
    it('Property: selectedPair is always updated to normalizarPar(pair) when pair is valid', async () => {
      await fc.assert(
        fc.asyncProperty(
          existingPairArbitrary,
          rawPairArbitrary,
          existingExchangeArbitrary,
          existingTimeframeArbitrary,
          async (existingPair, rawPair, existingExchange, existingTimeframe) => {
            const initialState = createInitialState({
              selectedPair: existingPair,
              exchange: existingExchange,
              timeframe: existingTimeframe,
            });

            const mockAnalysis = vi.fn().mockResolvedValue({
              pair: rawPair, exchange: 'binance', timeframe: '4H',
              supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
            });

            // Confirm this is NOT a bug condition (valid pair detected)
            const analysisResult: UnifiedResult = {
              pair: rawPair, exchange: 'binance', timeframe: '4H',
              supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
            };
            expect(isBugCondition({ existingPair, analysisResult })).toBe(false);

            const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);

            // selectedPair must be updated to the normalized version
            const expectedPair = normalizarPar(rawPair);
            expect(state.selectedPair).toBe(expectedPair);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: refreshTrigger is incremented when valid pair is detected', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPairArbitrary,
          existingPairArbitrary,
          async (detectedPair, existingPair) => {
            const initialState = createInitialState({
              selectedPair: existingPair,
              refreshTrigger: 5,
            });

            const mockAnalysis = vi.fn().mockResolvedValue({
              pair: detectedPair, exchange: null, timeframe: null,
              supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
            });

            const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);

            // refreshTrigger must be incremented
            expect(state.refreshTrigger).toBe(6);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 2: Exchange is updated correctly for all recognized exchanges (Req 3.2)', () => {
    it('Property: exchange state is updated to capitalized form when detected', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPairArbitrary,
          exchangeArbitrary,
          existingExchangeArbitrary,
          async (pair, detectedExchange, existingExchange) => {
            const initialState = createInitialState({ exchange: existingExchange });

            const mockAnalysis = vi.fn().mockResolvedValue({
              pair, exchange: detectedExchange, timeframe: '4H',
              supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
            });

            const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);

            // Exchange must be updated to the correct capitalized form
            const cleanEx = detectedExchange.toLowerCase();
            if (cleanEx.includes('binance')) expect(state.exchange).toBe('Binance');
            else if (cleanEx.includes('bybit')) expect(state.exchange).toBe('Bybit');
            else if (cleanEx.includes('bitget')) expect(state.exchange).toBe('Bitget');
            else if (cleanEx.includes('okx')) expect(state.exchange).toBe('OKX');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: exchange is NOT changed when analysis returns null/UNK exchange', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPairArbitrary,
          existingExchangeArbitrary,
          fc.constantFrom(null, 'UNK', undefined),
          async (pair, existingExchange, detectedExchange) => {
            const initialState = createInitialState({ exchange: existingExchange });

            const mockAnalysis = vi.fn().mockResolvedValue({
              pair, exchange: detectedExchange, timeframe: '4H',
              supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
            });

            const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);

            // Exchange must remain unchanged
            expect(state.exchange).toBe(existingExchange);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 2: Timeframe is updated correctly for all recognized timeframes (Req 3.3)', () => {
    it('Property: timeframe state is updated to normalized form when detected', async () => {
      const tfMap: Record<string, string> = {
        '1M': '1M', 'MONTHLY': '1M', 'M': '1M', 'MONTH': '1M',
        '1W': '1w', 'WEEKLY': '1w', 'W': '1w', 'WEEK': '1w',
        '1D': '1d', 'DAILY': '1d', 'D': '1d', 'DAY': '1d',
        '12H': '12h', 'H12': '12h',
        '4H': '4h', 'H4': '4h',
        '3H': '3h', 'H3': '3h',
        '2H': '2h', 'H2': '2h', '120M': '2h',
        '1H': '1h', 'H1': '1h', '60M': '1h',
        '15M': '15m', 'M15': '15m',
      };

      await fc.assert(
        fc.asyncProperty(
          validPairArbitrary,
          timeframeArbitrary,
          existingTimeframeArbitrary,
          async (pair, detectedTimeframe, existingTimeframe) => {
            const initialState = createInitialState({ timeframe: existingTimeframe });

            const mockAnalysis = vi.fn().mockResolvedValue({
              pair, exchange: 'binance', timeframe: detectedTimeframe,
              supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
            });

            const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);

            // Timeframe must be updated to the normalized form
            const expectedTf = tfMap[detectedTimeframe.toUpperCase()] || detectedTimeframe;
            expect(state.timeframe).toBe(expectedTf);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: timeframe is NOT changed when analysis returns null/UNK timeframe', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPairArbitrary,
          existingTimeframeArbitrary,
          fc.constantFrom(null, 'UNK', undefined),
          async (pair, existingTimeframe, detectedTimeframe) => {
            const initialState = createInitialState({ timeframe: existingTimeframe });

            const mockAnalysis = vi.fn().mockResolvedValue({
              pair, exchange: 'binance', timeframe: detectedTimeframe,
              supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
            });

            const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);

            // Timeframe must remain unchanged
            expect(state.timeframe).toBe(existingTimeframe);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  describe('Property 2: Fetch is triggered for all valid pair detections (Req 3.4)', () => {
    it('Property: fetch is called with normalized pair when valid pair is detected', async () => {
      await fc.assert(
        fc.asyncProperty(
          rawPairArbitrary,
          existingPairArbitrary,
          async (detectedPair, existingPair) => {
            const initialState = createInitialState({ selectedPair: existingPair });

            const mockAnalysis = vi.fn().mockResolvedValue({
              pair: detectedPair, exchange: 'binance', timeframe: '4H',
              supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
            });

            const { fetchCalled, fetchPair } = await simulateHandleFileChange(
              initialState, mockAnalysis, mockFile
            );

            // Fetch must be called with the normalized pair
            const expectedPair = normalizarPar(detectedPair);
            expect(fetchCalled).toBe(true);
            expect(fetchPair).toBe(expectedPair);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property: fetch is NOT called when pair detection fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(null, 'UNK', '', undefined),
          async (detectedPair) => {
            const initialState = createInitialState({ selectedPair: '' });

            const mockAnalysis = vi.fn().mockResolvedValue({
              pair: detectedPair, exchange: 'binance', timeframe: '4H',
              supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
            });

            const { fetchCalled } = await simulateHandleFileChange(
              initialState, mockAnalysis, mockFile
            );

            // Fetch must NOT be called when pair is invalid
            expect(fetchCalled).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ----------------------------------------------------------
  // Property: isScanning lifecycle is preserved
  // ----------------------------------------------------------
  describe('Property 2: isScanning lifecycle is preserved (Req 3.1)', () => {
    it('Property: isScanning is false after handleFileChange completes (success)', async () => {
      await fc.assert(
        fc.asyncProperty(
          validPairArbitrary,
          async (pair) => {
            const initialState = createInitialState({ isScanning: false });

            const mockAnalysis = vi.fn().mockResolvedValue({
              pair, exchange: 'binance', timeframe: '4H',
              supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
            });

            const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);
            expect(state.isScanning).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('Property: isScanning is false after handleFileChange completes (error)', async () => {
      const initialState = createInitialState({ isScanning: false });
      const mockAnalysis = vi.fn().mockRejectedValue(new Error('Network error'));

      const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);
      expect(state.isScanning).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // Req 3.4: Empty pair + failed detection → pair stays empty
  // ----------------------------------------------------------
  describe('Preservation: Empty pair stays empty when detection fails (Req 3.4)', () => {
    it('Property: when selectedPair is empty and detection fails, it remains empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(null, 'UNK'),
          async (detectedPair) => {
            const initialState = createInitialState({ selectedPair: '' });

            const mockAnalysis = vi.fn().mockResolvedValue({
              pair: detectedPair, exchange: 'binance', timeframe: '4H',
              supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [],
            });

            // This is NOT a bug condition (existingPair is empty)
            expect(isBugCondition({
              existingPair: '',
              analysisResult: { pair: detectedPair, supports: [], resistances: [], trendlines: [], fibonacci: [], patterns: [] },
            })).toBe(false);

            const { state } = await simulateHandleFileChange(initialState, mockAnalysis, mockFile);

            // Pair should remain empty (current behavior: setSelectedPair('') on empty → stays '')
            expect(state.selectedPair).toBe('');
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
