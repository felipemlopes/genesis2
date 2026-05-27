/**
 * Preservation Tests — FASE 1
 * 
 * Validates: Requirements 3.1, 3.2, 3.5, 3.6
 * 
 * These property-based tests capture the CURRENT correct behavior that must NOT change
 * after bugfixes are applied. They follow observation-first methodology:
 * 1. Observe current behavior on unfixed code
 * 2. Write property tests that pass on current code
 * 3. After fixes, re-run to confirm zero regressions
 * 
 * EXPECTED: Tests PASS on unfixed code (confirms baseline behavior to preserve)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { obterIndicadorComFallback } from '../adaptedDataFetcher';
import { calcularScore, DadosScore } from '../scoringEngine';
import { normalizarPar } from '../normalizarPar';

// ============================================================
// HELPER: Generate realistic kline data (Binance format)
// ============================================================
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

// Arbitrary for klines arrays with enough candles for EMA/RSI calculation
const klinesForIndicatorsArbitrary = fc.integer({ min: 50, max: 200 }).chain(numCandles =>
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

// Arbitrary for klines with < 28 candles (ADX fallback scenario)
const klinesShortArbitrary = fc.integer({ min: 1, max: 27 }).chain(numCandles =>
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

// ============================================================
// PROPERTY 1: Non-ADX indicators preserve their calculation
// Validates: Requirements 3.1, 3.2
// ============================================================
describe('Preservation: Non-ADX Indicators (Req 3.1, 3.2)', () => {
  it('Property: EMA calculation returns a numeric value from API when sufficient data', () => {
    /**
     * Validates: Requirements 3.1, 3.2
     * 
     * For any klines array with sufficient candles (>= 50), 
     * obterIndicadorComFallback('EMA', 200, closes, klinesData, null) 
     * returns a calculated numeric value with fonte "API" or falls back gracefully.
     * This behavior must be preserved after ADX fix.
     */
    fc.assert(
      fc.property(klinesForIndicatorsArbitrary, (klinesData) => {
        const closes = klinesData.map((k: any) => parseFloat(k[4]));
        const result = obterIndicadorComFallback('EMA', 21, closes, klinesData, null);
        
        // EMA with period 21 and >= 50 candles should calculate successfully
        // The function either returns a calculated value (API) or falls back (INDISPONIVEL/GRAFICO)
        expect(result).toHaveProperty('valor');
        expect(result).toHaveProperty('fonte');
        expect(['API', 'GRAFICO', 'INDISPONIVEL']).toContain(result.fonte);
        
        // If API source, value should be a finite positive number
        if (result.fonte === 'API') {
          expect(typeof result.valor).toBe('number');
          expect(isFinite(result.valor)).toBe(true);
          expect(result.valor).toBeGreaterThan(0);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('Property: RSI calculation returns value between 1-99 from API when sufficient data', () => {
    /**
     * Validates: Requirements 3.1, 3.2
     * 
     * For any klines array with sufficient candles (>= 50),
     * obterIndicadorComFallback('RSI', 14, closes, klinesData, null)
     * returns a value between 1 and 99 with fonte "API" when data has price variation.
     * This behavior must be preserved after ADX fix.
     */
    fc.assert(
      fc.property(klinesForIndicatorsArbitrary, (klinesData) => {
        const closes = klinesData.map((k: any) => parseFloat(k[4]));
        const result = obterIndicadorComFallback('RSI', 14, closes, klinesData, null);
        
        expect(result).toHaveProperty('valor');
        expect(result).toHaveProperty('fonte');
        expect(['API', 'GRAFICO', 'INDISPONIVEL']).toContain(result.fonte);
        
        // If API source, RSI should be between 1 and 99 (the function filters out extremes)
        if (result.fonte === 'API') {
          expect(typeof result.valor).toBe('number');
          expect(result.valor).toBeGreaterThan(1);
          expect(result.valor).toBeLessThan(99);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('Property: MACD calculation returns object with linha_macd and linha_sinal', () => {
    /**
     * Validates: Requirements 3.1, 3.2
     * 
     * For any klines array with > 52 candles,
     * obterIndicadorComFallback('MACD', 0, closes, klinesData, null)
     * returns an object with linha_macd and linha_sinal properties.
     * This behavior must be preserved after ADX fix.
     */
    // Use klines with guaranteed > 52 candles
    const klinesLargeArbitrary = fc.integer({ min: 53, max: 200 }).chain(numCandles =>
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

    fc.assert(
      fc.property(klinesLargeArbitrary, (klinesData) => {
        const closes = klinesData.map((k: any) => parseFloat(k[4]));
        const result = obterIndicadorComFallback('MACD', 0, closes, klinesData, null);
        
        expect(result).toHaveProperty('valor');
        expect(result).toHaveProperty('fonte');
        
        if (result.fonte === 'API') {
          expect(result.valor).toHaveProperty('linha_macd');
          expect(result.valor).toHaveProperty('linha_sinal');
          expect(typeof result.valor.linha_macd).toBe('number');
          expect(typeof result.valor.linha_sinal).toBe('number');
        }
      }),
      { numRuns: 50 }
    );
  });
});

// ============================================================
// PROPERTY 2: Pairs already ending in USDT pass unchanged
// Validates: Requirements 3.5
// ============================================================

// Use the real normalizarPar function (imported above)
// This replaces the old inline simulation

// Arbitrary for pairs that already end in USDT (valid pairs)
const validUsdtPairArbitrary = fc.constantFrom(
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT',
  'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'MATICUSDT',
  'BNBUSDT', 'LTCUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT'
);

describe('Preservation: Valid USDT Pairs Unchanged (Req 3.5)', () => {
  it('Property: Pairs already ending in USDT pass through normalization unchanged', () => {
    /**
     * Validates: Requirements 3.5
     * 
     * For any pair that already ends in "USDT" (e.g., BTCUSDT, ETHUSDT, SOLUSDT),
     * the current normalization logic returns the pair without modification.
     * This behavior must be preserved after the normalization fix.
     */
    fc.assert(
      fc.property(validUsdtPairArbitrary, (pair) => {
        const normalized = normalizarPar(pair);
        
        // Valid USDT pairs should pass through unchanged
        expect(normalized).toBe(pair);
      }),
      { numRuns: 50 }
    );
  });

  it('Property: Pairs ending in USDT with lowercase/slash are cleaned but base preserved', () => {
    /**
     * Validates: Requirements 3.5
     * 
     * For any pair that ends in USDT but has minor formatting issues (lowercase, slash),
     * the normalization cleans formatting but preserves the base pair + USDT suffix.
     */
    const formattedPairArbitrary = fc.tuple(
      fc.constantFrom('BTC', 'ETH', 'SOL', 'DOGE', 'XRP'),
      fc.constantFrom('/', '')
    ).map(([base, sep]) => `${base}${sep}USDT`);

    fc.assert(
      fc.property(formattedPairArbitrary, (pair) => {
        const normalized = normalizarPar(pair);
        
        // After cleaning (uppercase, remove slash), should end in USDT
        expect(normalized).toMatch(/^[A-Z]+USDT$/);
        // Should not have double USDT
        expect(normalized).not.toMatch(/USDTUSDT/);
      }),
      { numRuns: 30 }
    );
  });
});

// ============================================================
// PROPERTY 3: Score with isTechnicalPresent=true uses full 0-100 scale
// Validates: Requirements 3.6
// ============================================================

// Arbitrary for DadosScore WITH technical data present (ema200, rsi, adx defined)
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

describe('Preservation: Score with Technical Present (Req 3.6)', () => {
  it('Property: Score with isTechnicalPresent=true uses full 0-100 scale without cap', () => {
    /**
     * Validates: Requirements 3.6
     * 
     * For any DadosScore where isTechnicalPresent === true (ema200, rsi, or adx defined),
     * the score uses the full 0-100 scale without any artificial cap.
     * The score CAN exceed 65 when technical data supports it.
     * This behavior must be preserved after the score cap fix.
     */
    fc.assert(
      fc.property(dadosScoreComTecnicoArbitrary, (dados) => {
        // Ensure technical data IS present
        expect(dados.ema200 !== undefined || dados.rsi !== undefined || dados.adx !== undefined).toBe(true);
        
        const resultado = calcularScore(dados);
        
        // Score should be in valid range 0-100
        expect(resultado.scoreFinal).toBeGreaterThanOrEqual(0);
        expect(resultado.scoreFinal).toBeLessThanOrEqual(100);
        
        // Should NOT have the reduced confidence flag (that's only for !isTechnicalPresent)
        expect(resultado.flags).not.toContain('CONFIANCA_REDUZIDA_SEM_TECNICO');
        
        // Verify the score structure is complete
        expect(resultado).toHaveProperty('vies');
        expect(resultado).toHaveProperty('blocoTecnico');
        expect(resultado).toHaveProperty('blocoDerivativos');
        expect(resultado).toHaveProperty('blocoMacro');
        expect(resultado).toHaveProperty('blocoSentimento');
        expect(resultado).toHaveProperty('confiabilidade');
      }),
      { numRuns: 100 }
    );
  });

  it('Property: Score with technical data can reach values above 65', () => {
    /**
     * Validates: Requirements 3.6
     * 
     * Demonstrates that with strong bullish technical signals, the score CAN exceed 65.
     * This confirms the full 0-100 scale is used when technical data is present.
     */
    // Construct a strongly bullish scenario with technical data
    const strongBullishDados: DadosScore = {
      preco: 50000,
      ema200: 45000, // Price well above EMA200
      ema200Subindo: true,
      rsi: 60, // Bullish RSI zone
      adx: 35, // Strong trend
      adxSubindo: true,
      macdAcimaSignal: true,
      histogramaSubindo: true,
      precoSubindo: true,
      compressaoDetectada: false,
      cvdSlope: 5,
      divergenciaCVD: 'BULLISH',
      fundingMedio: -0.04, // Short squeeze territory
      oiVariacao: 10,
      oiSubindo: true,
      lsRatioLongs: 0.35, // Market oversold
      bookImbalanceRatio: 0.5,
      vix: 12, // Low VIX bullish
      dxyVariacao: -0.5, // DXY falling bullish
      sp500Variacao: 1.0, // SP500 up bullish
      btcDominanciaVariacao: -1,
      usdtDominanciaVariacao: -1,
      fearGreed: 15, // Extreme fear = opportunity
      geopoliticaScore: 3,
      sentimentoMoedaScore: 3,
      clusterLiquidacaoAcima: 55000,
      clusterLiquidacaoAbaixo: 45000,
      correlacaoBtc: null,
    };

    const resultado = calcularScore(strongBullishDados);
    
    // With all bullish signals and technical present, score should exceed 65
    expect(resultado.scoreFinal).toBeGreaterThan(65);
    expect(resultado.scoreFinal).toBeLessThanOrEqual(100);
  });
});

// ============================================================
// PROPERTY 4: ADX with klinesData.length < 28 falls back to OCR/INDISPONIVEL
// Validates: Requirements 3.1, 3.2
// ============================================================
describe('Preservation: ADX Fallback with < 28 candles (Req 3.1, 3.2)', () => {
  it('Property: ADX with insufficient klines (< 28) returns fallback OCR or INDISPONIVEL', () => {
    /**
     * Validates: Requirements 3.1, 3.2
     * 
     * For any klinesData with length < 28, obterIndicadorComFallback('ADX', ...)
     * should NOT attempt calculation and should fall back to OCR value or INDISPONIVEL.
     * This fallback behavior must be preserved after the ADX calculation fix.
     */
    fc.assert(
      fc.property(klinesShortArbitrary, (klinesData) => {
        const closes = klinesData.map((k: any) => parseFloat(k[4]));
        const result = obterIndicadorComFallback('ADX', 14, closes, klinesData, null);
        
        // With < 28 candles and no jsonVisual, should return INDISPONIVEL
        expect(result.fonte).toBe('INDISPONIVEL');
        expect(result.valor).toBeNull();
      }),
      { numRuns: 50 }
    );
  });

  it('Property: ADX with insufficient klines but OCR available returns GRAFICO value', () => {
    /**
     * Validates: Requirements 3.1, 3.2
     * 
     * For any klinesData with length < 28 but with jsonVisual containing ADX value,
     * the function should fall back to the OCR/visual value.
     * This fallback behavior must be preserved after the ADX calculation fix.
     */
    const jsonVisualWithAdx = {
      indicadores_visiveis: [
        { nome: 'ADX', valor_estimado: 30 }
      ]
    };

    fc.assert(
      fc.property(klinesShortArbitrary, (klinesData) => {
        const closes = klinesData.map((k: any) => parseFloat(k[4]));
        const result = obterIndicadorComFallback('ADX', 14, closes, klinesData, jsonVisualWithAdx);
        
        // With < 28 candles but OCR available, should return GRAFICO source
        expect(result.fonte).toBe('GRAFICO');
        expect(result.valor).toBe(30);
        expect(result.nota).toContain('visualmente');
      }),
      { numRuns: 30 }
    );
  });
});
