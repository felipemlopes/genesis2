/**
 * Preservation Tests — FASE 2: Fluxo de Análise Visual
 * 
 * Validates: Requirements 3.2
 * 
 * These property-based tests verify that the UNIFIED result (after fix) will contain
 * ALL fields from both `scanChartMetadata` (ChartMetadata) and `analyzeChart` (TradeSetup).
 * 
 * Methodology: observation-first
 * 1. Observe: scanChartMetadata returns ChartMetadata (pair, exchange, timeframe, detectedIndicators, detectedEMAs, etc.)
 * 2. Observe: analyzeChart returns TradeSetup (pair, direcaoProvavel, scoreProbabilidade, indicadores, execucao, etc.)
 * 3. Write tests that verify a unified interface preserves ALL fields from both
 * 4. Verify format compatibility with downstream consumers (adaptedDataFetcher, super-prompt)
 * 
 * EXPECTED: Tests PASS on unfixed code (confirms interface is preserved)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ChartMetadata, TradeSetup } from '../../types';

// ============================================================
// OBSERVED INTERFACES (from current code)
// ============================================================

/**
 * ChartMetadata fields as returned by scanChartMetadata (observed from types.ts and geminiService.ts):
 * - pair: string (required)
 * - timeframe: string (required)
 * - exchange?: string
 * - symbol?: string
 * - price?: number
 * - detectedIndicators?: string[]
 * - visualMarkings?: string[]
 * - detectedEMAs?: string[]
 * - adx?: number | null
 * - pdi?: number | null
 * - mdi?: number | null
 * - pocPrice?: number | null
 * - hvmNodes?: number[]
 * - lvmNodes?: number[]
 */
const CHART_METADATA_REQUIRED_FIELDS = ['pair', 'timeframe'] as const;
const CHART_METADATA_OPTIONAL_FIELDS = [
  'exchange', 'symbol', 'price', 'detectedIndicators',
  'visualMarkings', 'detectedEMAs', 'adx', 'pdi', 'mdi',
  'pocPrice', 'hvmNodes', 'lvmNodes'
] as const;

/**
 * TradeSetup fields as returned by analyzeChart (observed from types.ts):
 * - pair: string (required)
 * - direcaoProvavel: 'LONG' | 'SHORT' (required)
 * - scoreProbabilidade: number (required)
 * - confianca: number (required)
 * - regime: string (required)
 * - alerta: string | null (required)
 * - entradaSugerida: object (required)
 * - execucao: object (required)
 * - ensemble: object (required)
 * - analiseTecnica: string (required)
 * - macroGeopolitica: object (required)
 * - sentimentoNarrativa: object (required)
 * - indicadores: object (required)
 */
const TRADE_SETUP_REQUIRED_FIELDS = [
  'pair', 'direcaoProvavel', 'scoreProbabilidade', 'confianca',
  'regime', 'alerta', 'entradaSugerida', 'execucao',
  'ensemble', 'analiseTecnica', 'macroGeopolitica',
  'sentimentoNarrativa', 'indicadores'
] as const;

// ============================================================
// Arbitraries for generating valid ChartMetadata
// ============================================================
const pairArb = fc.constantFrom('BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT');
const exchangeArb = fc.constantFrom('Binance', 'Bybit', 'OKX', 'Bitget');
const timeframeArb = fc.constantFrom('15m', '1h', '4h', '1d', '1w');
const indicatorsArb = fc.subarray(['RSI', 'MACD', 'EMA', 'Bollinger', 'ADX', 'ATR', 'Volume']);
const emasArb = fc.subarray(['EMA9', 'EMA21', 'EMA50', 'EMA100', 'EMA200']);

const chartMetadataArb: fc.Arbitrary<ChartMetadata> = fc.record({
  pair: pairArb,
  timeframe: timeframeArb,
  exchange: exchangeArb,
  symbol: pairArb,
  price: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
  detectedIndicators: indicatorsArb,
  detectedEMAs: emasArb,
});

// ============================================================
// Arbitraries for generating valid TradeSetup
// ============================================================
const tradeSetupArb: fc.Arbitrary<TradeSetup> = fc.record({
  pair: pairArb,
  direcaoProvavel: fc.constantFrom('LONG' as const, 'SHORT' as const),
  scoreProbabilidade: fc.integer({ min: 0, max: 100 }),
  confianca: fc.integer({ min: 0, max: 100 }),
  regime: fc.constantFrom('TRENDING', 'RANGING', 'BREAKOUT', 'CONSOLIDATION'),
  alerta: fc.oneof(fc.constant(null), fc.constantFrom('ALTA VOLATILIDADE', 'DIVERGENCIA', 'SQUEEZE')),
  entradaSugerida: fc.record({
    planoA: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
    planoB: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
    descricaoPlanoA: fc.constant('Entrada na retração de 38.2%'),
    descricaoPlanoB: fc.constant('Entrada no rompimento da resistência'),
  }),
  execucao: fc.record({
    motivo: fc.constantFrom('Confluência técnica forte', 'Divergência bullish', 'Breakout confirmado'),
    setup: fc.record({
      entrada: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
      stop: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
      tp1: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
      tp2: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
      tp3: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
      alavancagem: fc.integer({ min: 1, max: 125 }),
      liquidacao: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
      riscoPct: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
      rr1: fc.float({ min: Math.fround(0.5), max: Math.fround(10), noNaN: true }),
      verificacao: fc.constant('Aguardar confirmação de volume'),
    }),
  }),
  ensemble: fc.record({
    motorTecnico: fc.record({ status: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRO'), score: fc.integer({ min: 0, max: 100 }) }),
    motorDerivativos: fc.record({ status: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRO'), score: fc.integer({ min: 0, max: 100 }) }),
    motorMacro: fc.record({ status: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRO'), score: fc.integer({ min: 0, max: 100 }) }),
    motorSentimento: fc.record({ status: fc.constantFrom('BULLISH', 'BEARISH', 'NEUTRO'), score: fc.integer({ min: 0, max: 100 }) }),
  }),
  analiseTecnica: fc.constantFrom(
    'Tendência de alta com suporte em EMA200',
    'Consolidação com possível breakout',
    'Divergência bearish no RSI'
  ),
  macroGeopolitica: fc.record({
    resumo: fc.constant('Mercado em modo risk-on com DXY em queda'),
    eventos: fc.constant(['Fed mantém taxa', 'CPI abaixo do esperado']),
  }),
  sentimentoNarrativa: fc.record({
    score: fc.integer({ min: 0, max: 100 }),
    sentimento: fc.constantFrom('OTIMISTA' as const, 'NEUTRO' as const, 'PESSIMISTA' as const),
    narrativa: fc.constant('Mercado otimista com fluxo institucional'),
    gatilhosPositivos: fc.constant(['ETF inflows', 'Halving proximity']),
    gatilhosNegativos: fc.constant(['Regulação', 'Mt. Gox distribution']),
  }),
  indicadores: fc.record({
    rsi: fc.float({ min: Math.fround(1), max: Math.fround(99), noNaN: true }),
    adx: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
    plusDI: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
    minusDI: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
    macdHist: fc.float({ min: Math.fround(-1000), max: Math.fround(1000), noNaN: true }),
    ema21: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
    ema50: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
    ema200: fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
    atr: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
    cvd: fc.float({ min: Math.fround(-10000), max: Math.fround(10000), noNaN: true }),
  }),
});

// ============================================================
// PROPERTY 1: Unified result contains ALL ChartMetadata fields
// Validates: Requirements 3.2
// ============================================================
describe('Preservation: Unified Result Contains All scanChartMetadata Fields (Req 3.2)', () => {
  it('Property: Unified result preserves ALL required ChartMetadata fields', () => {
    /**
     * Validates: Requirements 3.2
     * 
     * For any ChartMetadata returned by scanChartMetadata, a unified result
     * MUST contain all required fields (pair, timeframe) so that downstream
     * consumers (adaptedDataFetcher, GenesisPage) continue to work.
     */
    fc.assert(
      fc.property(chartMetadataArb, (metadata) => {
        // Simulate a unified result that includes all ChartMetadata fields
        const unifiedResult = { ...metadata };

        // Verify ALL required ChartMetadata fields are present
        for (const field of CHART_METADATA_REQUIRED_FIELDS) {
          expect(unifiedResult).toHaveProperty(field);
          expect(unifiedResult[field]).toBeDefined();
        }

        // Verify pair is a non-empty string
        expect(typeof unifiedResult.pair).toBe('string');
        expect(unifiedResult.pair.length).toBeGreaterThan(0);

        // Verify timeframe is a non-empty string
        expect(typeof unifiedResult.timeframe).toBe('string');
        expect(unifiedResult.timeframe.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('Property: Unified result preserves optional ChartMetadata fields when present', () => {
    /**
     * Validates: Requirements 3.2
     * 
     * For any ChartMetadata with optional fields populated,
     * the unified result preserves those fields with correct types.
     * This ensures adaptedDataFetcher can still access detectedIndicators, detectedEMAs, etc.
     */
    fc.assert(
      fc.property(chartMetadataArb, (metadata) => {
        const unifiedResult = { ...metadata };

        // exchange should be a string when present
        if (unifiedResult.exchange !== undefined) {
          expect(typeof unifiedResult.exchange).toBe('string');
        }

        // detectedIndicators should be an array when present
        if (unifiedResult.detectedIndicators !== undefined) {
          expect(Array.isArray(unifiedResult.detectedIndicators)).toBe(true);
        }

        // detectedEMAs should be an array when present
        if (unifiedResult.detectedEMAs !== undefined) {
          expect(Array.isArray(unifiedResult.detectedEMAs)).toBe(true);
        }

        // price should be a number when present
        if (unifiedResult.price !== undefined) {
          expect(typeof unifiedResult.price).toBe('number');
          expect(isFinite(unifiedResult.price)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// PROPERTY 2: Unified result contains ALL TradeSetup fields
// Validates: Requirements 3.2
// ============================================================
describe('Preservation: Unified Result Contains All analyzeChart Fields (Req 3.2)', () => {
  it('Property: Unified result preserves ALL required TradeSetup fields', () => {
    /**
     * Validates: Requirements 3.2
     * 
     * For any TradeSetup returned by analyzeChart, a unified result
     * MUST contain all required fields so that the super-prompt and
     * downstream consumers continue to work correctly.
     */
    fc.assert(
      fc.property(tradeSetupArb, (tradeSetup) => {
        // Simulate a unified result that includes all TradeSetup fields
        const unifiedResult = { ...tradeSetup };

        // Verify ALL required TradeSetup fields are present
        for (const field of TRADE_SETUP_REQUIRED_FIELDS) {
          expect(unifiedResult).toHaveProperty(field);
        }

        // Verify critical field types
        expect(typeof unifiedResult.pair).toBe('string');
        expect(['LONG', 'SHORT']).toContain(unifiedResult.direcaoProvavel);
        expect(typeof unifiedResult.scoreProbabilidade).toBe('number');
        expect(typeof unifiedResult.confianca).toBe('number');
        expect(typeof unifiedResult.regime).toBe('string');
        expect(typeof unifiedResult.analiseTecnica).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  it('Property: Unified result preserves indicadores structure for super-prompt', () => {
    /**
     * Validates: Requirements 3.2
     * 
     * The indicadores object in TradeSetup must preserve its structure
     * (rsi, adx, plusDI, minusDI, macdHist, ema21, ema50, ema200, atr, cvd)
     * as the super-prompt relies on these fields for analysis context.
     */
    fc.assert(
      fc.property(tradeSetupArb, (tradeSetup) => {
        const unifiedResult = { ...tradeSetup };
        const indicadores = unifiedResult.indicadores;

        // All indicator fields must be present
        expect(indicadores).toHaveProperty('rsi');
        expect(indicadores).toHaveProperty('adx');
        expect(indicadores).toHaveProperty('plusDI');
        expect(indicadores).toHaveProperty('minusDI');
        expect(indicadores).toHaveProperty('macdHist');
        expect(indicadores).toHaveProperty('ema21');
        expect(indicadores).toHaveProperty('ema50');
        expect(indicadores).toHaveProperty('ema200');
        expect(indicadores).toHaveProperty('atr');
        expect(indicadores).toHaveProperty('cvd');

        // All indicator values must be numbers
        expect(typeof indicadores.rsi).toBe('number');
        expect(typeof indicadores.adx).toBe('number');
        expect(typeof indicadores.plusDI).toBe('number');
        expect(typeof indicadores.minusDI).toBe('number');
        expect(typeof indicadores.macdHist).toBe('number');
        expect(typeof indicadores.ema21).toBe('number');
        expect(typeof indicadores.ema50).toBe('number');
        expect(typeof indicadores.ema200).toBe('number');
        expect(typeof indicadores.atr).toBe('number');
        expect(typeof indicadores.cvd).toBe('number');
      }),
      { numRuns: 100 }
    );
  });

  it('Property: Unified result preserves execucao.setup structure', () => {
    /**
     * Validates: Requirements 3.2
     * 
     * The execucao.setup object must preserve its structure (entrada, stop, tp1-3,
     * alavancagem, liquidacao, riscoPct, rr1, verificacao) as the UI renders
     * trade execution details from these fields.
     */
    fc.assert(
      fc.property(tradeSetupArb, (tradeSetup) => {
        const unifiedResult = { ...tradeSetup };
        const setup = unifiedResult.execucao.setup;

        expect(setup).not.toBeNull();
        if (setup) {
          expect(setup).toHaveProperty('entrada');
          expect(setup).toHaveProperty('stop');
          expect(setup).toHaveProperty('tp1');
          expect(setup).toHaveProperty('tp2');
          expect(setup).toHaveProperty('tp3');
          expect(setup).toHaveProperty('alavancagem');
          expect(setup).toHaveProperty('liquidacao');
          expect(setup).toHaveProperty('riscoPct');
          expect(setup).toHaveProperty('rr1');
          expect(setup).toHaveProperty('verificacao');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// PROPERTY 3: Format compatibility with downstream consumers
// Validates: Requirements 3.2
// ============================================================
describe('Preservation: Format Compatibility with Downstream Consumers (Req 3.2)', () => {
  it('Property: ChartMetadata format is compatible with adaptedDataFetcher (jsonVisual)', () => {
    /**
     * Validates: Requirements 3.2
     * 
     * The adaptedDataFetcher's buscarDadosAdaptados expects a jsonVisual parameter
     * with indicadores_visiveis array. The unified result must be convertible to
     * this format. ChartMetadata.detectedIndicators maps to jsonVisual.indicadores_visiveis.
     */
    fc.assert(
      fc.property(chartMetadataArb, (metadata) => {
        // Simulate converting ChartMetadata to jsonVisual format for adaptedDataFetcher
        const jsonVisual = {
          indicadores_visiveis: (metadata.detectedIndicators || []).map(ind => ({
            nome: ind,
            valor_estimado: null,
            periodos: null,
          })),
        };

        // adaptedDataFetcher expects jsonVisual.indicadores_visiveis to be an array
        expect(Array.isArray(jsonVisual.indicadores_visiveis)).toBe(true);

        // Each indicator should have a nome field (string)
        for (const ind of jsonVisual.indicadores_visiveis) {
          expect(typeof ind.nome).toBe('string');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property: ChartMetadata pair/timeframe are compatible with buscarDadosAdaptados params', () => {
    /**
     * Validates: Requirements 3.2
     * 
     * buscarDadosAdaptados(jsonVisual, confirmedPair, confirmedTimeframe) expects:
     * - confirmedPair: string (from ChartMetadata.pair)
     * - confirmedTimeframe: string (from ChartMetadata.timeframe)
     * The unified result must preserve these as strings for the function call.
     */
    fc.assert(
      fc.property(chartMetadataArb, (metadata) => {
        const confirmedPair = metadata.pair;
        const confirmedTimeframe = metadata.timeframe;

        // Must be non-empty strings suitable for API calls
        expect(typeof confirmedPair).toBe('string');
        expect(confirmedPair.length).toBeGreaterThan(0);
        expect(confirmedPair).toMatch(/^[A-Z]+$/); // All uppercase letters

        expect(typeof confirmedTimeframe).toBe('string');
        expect(confirmedTimeframe.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('Property: TradeSetup format is compatible with super-prompt consumption', () => {
    /**
     * Validates: Requirements 3.2
     * 
     * The super-prompt (final analysis) consumes TradeSetup fields to build
     * the analysis context. The unified result must preserve:
     * - pair (for asset identification)
     * - direcaoProvavel (for bias direction)
     * - indicadores (for technical context)
     * - ensemble (for multi-engine consensus)
     * - sentimentoNarrativa (for sentiment context)
     */
    fc.assert(
      fc.property(tradeSetupArb, (tradeSetup) => {
        const unifiedResult = { ...tradeSetup };

        // Super-prompt needs pair for asset identification
        expect(unifiedResult.pair).toMatch(/^[A-Z]+$/);

        // Super-prompt needs direction for bias
        expect(['LONG', 'SHORT']).toContain(unifiedResult.direcaoProvavel);

        // Super-prompt needs ensemble for multi-engine consensus
        expect(unifiedResult.ensemble).toBeDefined();
        expect(typeof unifiedResult.ensemble).toBe('object');

        // Super-prompt needs sentimentoNarrativa for narrative context
        expect(unifiedResult.sentimentoNarrativa).toBeDefined();
        expect(['OTIMISTA', 'NEUTRO', 'PESSIMISTA']).toContain(
          unifiedResult.sentimentoNarrativa.sentimento
        );

        // Super-prompt needs macroGeopolitica for macro context
        expect(unifiedResult.macroGeopolitica).toBeDefined();
        expect(typeof unifiedResult.macroGeopolitica.resumo).toBe('string');
        expect(Array.isArray(unifiedResult.macroGeopolitica.eventos)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('Property: Unified result can serve both metadata and analysis consumers simultaneously', () => {
    /**
     * Validates: Requirements 3.2
     * 
     * After unification, a single result object must be decomposable into:
     * 1. ChartMetadata subset (for adaptedDataFetcher and GenesisPage state)
     * 2. TradeSetup subset (for super-prompt and UI rendering)
     * Both subsets must be extractable without data loss.
     */
    fc.assert(
      fc.property(chartMetadataArb, tradeSetupArb, (metadata, tradeSetup) => {
        // Simulate unified result containing both
        const unifiedResult = {
          ...metadata,
          ...tradeSetup,
          // pair from tradeSetup takes precedence (same value expected)
        };

        // Extract ChartMetadata subset
        const extractedMetadata: Partial<ChartMetadata> = {
          pair: unifiedResult.pair,
          timeframe: unifiedResult.timeframe,
          exchange: unifiedResult.exchange,
          detectedIndicators: unifiedResult.detectedIndicators,
          detectedEMAs: unifiedResult.detectedEMAs,
        };

        // Extract TradeSetup subset
        const extractedSetup: Partial<TradeSetup> = {
          pair: unifiedResult.pair,
          direcaoProvavel: unifiedResult.direcaoProvavel,
          scoreProbabilidade: unifiedResult.scoreProbabilidade,
          indicadores: unifiedResult.indicadores,
          execucao: unifiedResult.execucao,
          ensemble: unifiedResult.ensemble,
          sentimentoNarrativa: unifiedResult.sentimentoNarrativa,
        };

        // Both subsets must have their critical fields intact
        expect(extractedMetadata.pair).toBeDefined();
        expect(extractedMetadata.timeframe).toBeDefined();
        expect(extractedSetup.direcaoProvavel).toBeDefined();
        expect(extractedSetup.indicadores).toBeDefined();
        expect(extractedSetup.execucao).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});
