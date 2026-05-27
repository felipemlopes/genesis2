/**
 * Bug Condition Exploration Tests — FASE 1
 * 
 * Validates: Requirements 1.1, 1.6, 1.7
 * 
 * These property-based tests demonstrate the 3 data bugs in the current code:
 * 1. ADX hardcoded at 22.5 (should calculate real values)
 * 2. Pair normalization produces invalid pairs (should produce valid USDT pairs)
 * 3. Score inflated when !isTechnicalPresent (should cap at 65)
 * 
 * EXPECTED: Tests FAIL on unfixed code (failure confirms bugs exist)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { obterIndicadorComFallback } from '../adaptedDataFetcher';
import { calcularScore, DadosScore } from '../scoringEngine';
import { normalizarPar } from '../normalizarPar';

// ============================================================
// HELPER: Generate realistic kline data (Binance format)
// Each kline: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, buyBaseVol, buyQuoteVol, ignore]
// ============================================================
function generateKline(basePrice: number, volatility: number, seed: number): any[] {
  const open = basePrice + (seed % 10 - 5) * volatility;
  const high = open + Math.abs(seed % 7) * volatility;
  const low = open - Math.abs((seed + 3) % 7) * volatility;
  const close = low + Math.abs((seed + 1) % 10) * volatility * (high - low > 0 ? 1 : 0.5);
  const volume = 1000 + (seed % 500);
  return [
    Date.now() - seed * 3600000,
    String(open),
    String(Math.max(open, high, close)),
    String(Math.min(open, low, close)),
    String(close),
    String(volume),
    Date.now() - (seed - 1) * 3600000,
    String(volume * close),
    100 + seed % 50,
    String(volume * 0.6),
    String(volume * close * 0.6),
    '0'
  ];
}

// Arbitrary for klines arrays with >= 28 candles and price variation
const klinesArbitrary = fc.integer({ min: 28, max: 100 }).chain(numCandles =>
  fc.tuple(
    fc.integer({ min: 100, max: 50000 }),
    fc.integer({ min: 1, max: 50 })
  ).map(([basePrice, volatility]) => {
    const klines: any[] = [];
    for (let i = 0; i < numCandles; i++) {
      klines.push(generateKline(basePrice, volatility / 10, i));
    }
    return klines;
  })
);

// ============================================================
// PROPERTY 1: ADX Bug Condition
// The correct behavior: obterIndicadorComFallback('ADX', ...) should return
// a real calculated ADX value (not the hardcoded 22.5)
// ============================================================
describe('Bug Condition Exploration: ADX Hardcoded (Req 1.1)', () => {
  it('Property: ADX should return real calculated values, not hardcoded 22.5', () => {
    /**
     * Validates: Requirements 1.1
     * 
     * For any klines array with >= 28 candles, obterIndicadorComFallback('ADX', ...)
     * should return a dynamically calculated ADX value that varies with input data,
     * NOT the constant 22.5.
     */
    fc.assert(
      fc.property(klinesArbitrary, (klinesData) => {
        const closes = klinesData.map((k: any) => parseFloat(k[4]));
        const result = obterIndicadorComFallback('ADX', 14, closes, klinesData, null);
        
        // The correct behavior: ADX should be a real calculated object {adx, diPlus, diMinus}
        // or at minimum NOT be the hardcoded constant 22.5
        expect(result.fonte).toBe('API');
        
        // If it's always exactly 22.5, that's the bug
        // The correct implementation should return an object with adx, diPlus, diMinus
        const isHardcoded = result.valor === 22.5;
        expect(isHardcoded).toBe(false);
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================================
// PROPERTY 2: Pair Normalization Bug Condition
// The correct behavior: pairs with stablecoin suffixes should be normalized
// to valid USDT pairs without duplication
// ============================================================

// Use the real normalizarPar function (imported above)
// This replaces the old inline simulation that demonstrated the bug

// Arbitrary for pairs with problematic suffixes
const pairWithSuffixArbitrary = fc.tuple(
  fc.constantFrom('BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC'),
  fc.constantFrom('USDC', 'BUSD', 'DAI', 'TUSD')
).map(([base, suffix]) => `${base}${suffix}`);

const pairWithSpecialSuffixArbitrary = fc.tuple(
  fc.constantFrom('BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC'),
  fc.constantFrom('USD.P', 'USDPERP', 'USD')
).map(([base, suffix]) => `${base}${suffix}`);

describe('Bug Condition Exploration: Pair Normalization (Req 1.6)', () => {
  it('Property: Pairs with stablecoin suffixes should normalize to valid USDT pairs', () => {
    /**
     * Validates: Requirements 1.6
     * 
     * For any pair with a stablecoin suffix (USDC, BUSD, DAI, TUSD),
     * normalization should produce a valid pair ending in exactly one "USDT"
     * without duplication (e.g., BTCUSDC → BTCUSDT, not BTCUSDCUSDT)
     */
    fc.assert(
      fc.property(pairWithSuffixArbitrary, (rawPair) => {
        const normalized = normalizarPar(rawPair);
        
        // Correct behavior: should end in USDT without duplication
        // e.g., BTCUSDC → BTCUSDT (not BTCUSDCUSDT)
        expect(normalized).toMatch(/^[A-Z]+USDT$/);
        
        // Should NOT contain duplicate stablecoin suffixes
        expect(normalized).not.toMatch(/USDC/);
        expect(normalized).not.toMatch(/BUSD/);
        expect(normalized).not.toMatch(/DAI(?!LY)/);
        expect(normalized).not.toMatch(/TUSD(?!T)/);
      }),
      { numRuns: 50 }
    );
  });

  it('Property: Pairs with special suffixes (.P, PERP) should normalize correctly', () => {
    /**
     * Validates: Requirements 1.6
     * 
     * For any pair with special suffixes (.P, PERP),
     * normalization should remove the suffix and produce a valid USDT pair
     */
    fc.assert(
      fc.property(pairWithSpecialSuffixArbitrary, (rawPair) => {
        const normalized = normalizarPar(rawPair);
        
        // Correct behavior: should not contain .P or PERP in the result
        expect(normalized).not.toContain('.P');
        expect(normalized).not.toContain('PERP');
        
        // Should be a valid pair ending in USDT
        expect(normalized).toMatch(/^[A-Z]+USDT$/);
        
        // Should not have double USD (e.g., BTCUSDUSDT is invalid)
        const withoutUsdt = normalized.replace(/USDT$/, '');
        expect(withoutUsdt).not.toMatch(/USD$/);
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================================
// PROPERTY 3: Score Inflation Bug Condition
// The correct behavior: when isTechnicalPresent === false, score should be
// capped at 65 maximum
// ============================================================

// Arbitrary for DadosScore without technical data but with bullish points
const dadosScoreSemTecnicoArbitrary = fc.record({
  preco: fc.integer({ min: 100, max: 50000 }).map(v => v * 1.0),
  // No ema200, rsi, adx → isTechnicalPresent will be false
  cvdSlope: fc.integer({ min: 1, max: 100 }).map(v => v / 10),
  divergenciaCVD: fc.constantFrom('BULLISH', 'NENHUMA') as fc.Arbitrary<string>,
  fundingMedio: fc.integer({ min: -50, max: -20 }).map(v => v / 1000),
  oiVariacao: fc.integer({ min: 1, max: 20 }).map(v => v * 1.0),
  oiSubindo: fc.constant(true),
  precoSubindo: fc.constant(true),
  lsRatioLongs: fc.integer({ min: 30, max: 40 }).map(v => v / 100),
  bookImbalanceRatio: fc.integer({ min: 40, max: 80 }).map(v => v / 100),
  vix: fc.integer({ min: 10, max: 14 }).map(v => v * 1.0),
  dxyVariacao: fc.integer({ min: -10, max: -4 }).map(v => v / 10),
  sp500Variacao: fc.integer({ min: 6, max: 20 }).map(v => v / 10),
  btcDominanciaVariacao: fc.integer({ min: -10, max: -1 }).map(v => v / 10),
  usdtDominanciaVariacao: fc.integer({ min: -5, max: 1 }).map(v => v / 10),
  fearGreed: fc.integer({ min: 15, max: 19 }),
  geopoliticaScore: fc.constant(3),
  sentimentoMoedaScore: fc.constant(3),
  clusterLiquidacaoAcima: fc.integer({ min: 50000, max: 60000 }).map(v => v * 1.0),
  clusterLiquidacaoAbaixo: fc.integer({ min: 40000, max: 49000 }).map(v => v * 1.0),
  correlacaoBtc: fc.constant(null),
}) as fc.Arbitrary<DadosScore>;

describe('Bug Condition Exploration: Score Inflado (Req 1.7)', () => {
  it('Property: Score without technical data should be capped at 65', () => {
    /**
     * Validates: Requirements 1.7
     * 
     * For any DadosScore where isTechnicalPresent === false (no ema200, rsi, adx),
     * the final score should never exceed 65 points.
     * The current buggy code normalizes (pontos/65)*100, inflating the score.
     */
    fc.assert(
      fc.property(dadosScoreSemTecnicoArbitrary, (dados) => {
        // Ensure no technical data is present
        expect(dados.ema200).toBeUndefined();
        expect(dados.rsi).toBeUndefined();
        expect(dados.adx).toBeUndefined();
        
        const resultado = calcularScore(dados);
        
        // Correct behavior: score should be capped at 65 when no technical data
        expect(resultado.scoreFinal).toBeLessThanOrEqual(65);
      }),
      { numRuns: 100 }
    );
  });
});
