import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calcularMACD } from '../services/indicatorEngine';

/**
 * Property-based tests for MACD calculation correctness
 * Feature: genesis-moderate-fixes
 * Properties: P8, P9, P10
 */

// Helper: Candle interface matching indicatorEngine expectations
interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Helper: generate candles from close prices array
function gerarCandles(closePrices: number[]): Candle[] {
  return closePrices.map((close, i) => ({
    timestamp: Date.now() - (closePrices.length - i) * 60000,
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000 + i * 10,
  }));
}

// Reference EMA calculation for verification
function calcularEMASerie(values: number[], period: number): number[] {
  if (values.length < period) return [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let ema = sum / period;
  const results: number[] = [ema];
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * k + ema;
    results.push(ema);
  }
  return results;
}

// Reference MACD calculation for comparison
function referenceMacd(closePrices: number[]): { macd: number; signal: number; histogram: number } | null {
  const fastPeriod = 12;
  const slowPeriod = 26;
  const signalPeriod = 9;

  if (closePrices.length < slowPeriod + signalPeriod) return null;

  // Calculate EMA fast and slow series
  let sumFast = 0, sumSlow = 0;
  for (let i = 0; i < fastPeriod; i++) sumFast += closePrices[i];
  for (let i = 0; i < slowPeriod; i++) sumSlow += closePrices[i];

  let emaFast = sumFast / fastPeriod;
  let emaSlow = sumSlow / slowPeriod;

  const kFast = 2 / (fastPeriod + 1);
  const kSlow = 2 / (slowPeriod + 1);

  const macdSeries: number[] = [];
  for (let i = slowPeriod; i < closePrices.length; i++) {
    emaFast = (closePrices[i] - emaFast) * kFast + emaFast;
    emaSlow = (closePrices[i] - emaSlow) * kSlow + emaSlow;
    macdSeries.push(emaFast - emaSlow);
  }

  if (macdSeries.length < signalPeriod) return null;

  // Signal = EMA(9) of MACD series
  let signalSum = 0;
  for (let i = 0; i < signalPeriod; i++) signalSum += macdSeries[i];
  let signalEma = signalSum / signalPeriod;

  const kSignal = 2 / (signalPeriod + 1);
  for (let i = signalPeriod; i < macdSeries.length; i++) {
    signalEma = (macdSeries[i] - signalEma) * kSignal + signalEma;
  }

  const currentMacd = macdSeries[macdSeries.length - 1];
  return {
    macd: currentMacd,
    signal: signalEma,
    histogram: currentMacd - signalEma,
  };
}

// Arbitrary: array of close prices with at least 35 elements (minimum for MACD)
const closePricesArb = fc.array(
  fc.double({ min: 1, max: 10000, noNaN: true, noDefaultInfinity: true }),
  { minLength: 35, maxLength: 200 }
);

describe('MACD Property-Based Tests', () => {

  // Feature: genesis-moderate-fixes, Property 8: Signal Line = EMA(9) da série MACD
  describe('P8: Signal Line = EMA(9) of MACD series', () => {
    it('para qualquer série de preços com ≥ 35 candles, Signal Line deve ser EMA(9) da série MACD Line', () => {
      fc.assert(
        fc.property(closePricesArb, (closePrices) => {
          const candles = gerarCandles(closePrices);
          const result = calcularMACD(candles);

          // With ≥ 35 candles, result should not be null
          expect(result).not.toBeNull();

          // Calculate reference signal using independent EMA(9) implementation
          const reference = referenceMacd(closePrices);
          expect(reference).not.toBeNull();

          // Signal from calcularMACD must match reference EMA(9) of MACD series
          expect(result.signal).toBeCloseTo(reference!.signal, 10);

          // Signal must NOT be macdLine * 0.9 (the old bug pattern)
          // Only check when macd is non-zero to avoid trivial case
          if (Math.abs(result.macd) > 1e-8) {
            expect(Math.abs(result.signal - result.macd * 0.9)).toBeGreaterThan(1e-12);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: genesis-moderate-fixes, Property 9: Invariante do histograma MACD
  describe('P9: Histogram invariant (histogram = MACD_Line - Signal_Line)', () => {
    it('para qualquer resultado de cálculo MACD, histograma deve ser exatamente MACD_Line - Signal_Line', () => {
      fc.assert(
        fc.property(closePricesArb, (closePrices) => {
          const candles = gerarCandles(closePrices);
          const result = calcularMACD(candles);

          expect(result).not.toBeNull();

          // Histogram must be exactly macd - signal
          const expectedHistogram = result.macd - result.signal;
          expect(result.histogram).toBe(expectedHistogram);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: genesis-moderate-fixes, Property 10: Round-trip numérico do MACD
  describe('P10: Numeric round-trip (JSON serialize/deserialize preserves values)', () => {
    it('para qualquer série de preços válida, formatar como JSON e re-parsear deve produzir valores equivalentes', () => {
      fc.assert(
        fc.property(closePricesArb, (closePrices) => {
          const candles = gerarCandles(closePrices);
          const result = calcularMACD(candles);

          expect(result).not.toBeNull();

          // Serialize to JSON and parse back
          const serialized = JSON.stringify(result);
          const deserialized = JSON.parse(serialized);

          // Values must be numerically equivalent (difference < 1e-10)
          expect(Math.abs(deserialized.macd - result.macd)).toBeLessThan(1e-10);
          expect(Math.abs(deserialized.signal - result.signal)).toBeLessThan(1e-10);
          expect(Math.abs(deserialized.histogram - result.histogram)).toBeLessThan(1e-10);

          // Types must be preserved
          expect(typeof deserialized.macd).toBe('number');
          expect(typeof deserialized.signal).toBe('number');
          expect(typeof deserialized.histogram).toBe('number');

          // Values must be finite
          expect(isFinite(deserialized.macd)).toBe(true);
          expect(isFinite(deserialized.signal)).toBe(true);
          expect(isFinite(deserialized.histogram)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });
});
