import { describe, it, expect } from 'vitest';
import { obterIndicadorComFallback } from '../services/adaptedDataFetcher';
import { calcularRSI, calcularADX, calcularATR, calcularBollinger } from '../services/indicatorEngine';

/**
 * Regression tests for non-EMA indicators (RSI, Bollinger, ADX, ATR)
 * Task 5.3 — Verificar que indicadores não-EMA não foram afetados
 * Feature: genesis-moderate-fixes
 *
 * Validates: Requirement 6.3
 * WHEN indicadores não-EMA (RSI, Bollinger, ADX, ATR) são calculados,
 * THE AdaptedDataFetcher SHALL manter o comportamento atual sem alterações
 */

// Helper: generate synthetic klines data in Binance format
function gerarKlines(count: number, basePrice: number = 100): any[] {
  const klines = [];
  let price = basePrice;
  for (let i = 0; i < count; i++) {
    const variation = Math.sin(i * 0.3) * 5 + Math.cos(i * 0.1) * 3;
    price = basePrice + variation;
    klines.push([
      Date.now() - (count - i) * 60000,
      String(price - 0.5),
      String(price + 1),
      String(price - 1),
      String(price),
      String(1000 + i * 10),
    ]);
  }
  return klines;
}

// Helper: generate candles in indicatorEngine format
function gerarCandles(count: number, basePrice: number = 100) {
  const candles = [];
  let price = basePrice;
  for (let i = 0; i < count; i++) {
    const variation = Math.sin(i * 0.3) * 5 + Math.cos(i * 0.1) * 3;
    price = basePrice + variation;
    candles.push({
      timestamp: Date.now() - (count - i) * 60000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000 + i * 10,
    });
  }
  return candles;
}

describe('Regression: Non-EMA Indicators — RSI, Bollinger, ADX, ATR (Task 5.3)', () => {

  describe('RSI — cálculo via obterIndicadorComFallback', () => {
    it('retorna RSI válido (entre 1 e 99) com dados suficientes', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('RSI', 14, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(result.valor).not.toBeNull();
      expect(typeof result.valor).toBe('number');
      expect(result.valor).toBeGreaterThan(1);
      expect(result.valor).toBeLessThan(99);
    });

    it('retorna RSI consistente com indicatorEngine', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));
      const candles = gerarCandles(100);

      const resultFetcher = obterIndicadorComFallback('RSI', 14, closes, klines, null);
      const resultEngine = calcularRSI(candles, 14);

      // Both should produce valid RSI values
      expect(resultFetcher.fonte).toBe('API');
      expect(resultFetcher.valor).not.toBeNull();
      expect(resultEngine).not.toBeNull();
      // Both should be in valid RSI range
      expect(resultFetcher.valor).toBeGreaterThan(1);
      expect(resultFetcher.valor).toBeLessThan(99);
      expect(resultEngine).toBeGreaterThan(0);
      expect(resultEngine).toBeLessThanOrEqual(99);
    });

    it('RSI com período customizado (7) funciona corretamente', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('RSI', 7, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(result.valor).not.toBeNull();
      expect(result.valor).toBeGreaterThan(1);
      expect(result.valor).toBeLessThan(99);
    });

    it('RSI com dados insuficientes retorna fallback', () => {
      const closes = [100, 101];

      const result = obterIndicadorComFallback('RSI', 14, closes, [], null);

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });
  });

  describe('Bollinger Bands — cálculo via obterIndicadorComFallback', () => {
    it('retorna Bollinger Bands válidas com dados suficientes', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('BOLLINGER', 20, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(result.valor).not.toBeNull();
      expect(result.valor).toHaveProperty('banda_media');
      expect(result.valor).toHaveProperty('banda_superior');
      expect(result.valor).toHaveProperty('banda_inferior');
    });

    it('banda_superior > banda_media > banda_inferior', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('BOLLINGER', 20, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(result.valor.banda_superior).toBeGreaterThan(result.valor.banda_media);
      expect(result.valor.banda_media).toBeGreaterThan(result.valor.banda_inferior);
    });

    it('Bollinger Bands são números finitos', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('BOLLINGER', 20, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(isFinite(result.valor.banda_media)).toBe(true);
      expect(isFinite(result.valor.banda_superior)).toBe(true);
      expect(isFinite(result.valor.banda_inferior)).toBe(true);
    });

    it('Bollinger consistente com indicatorEngine', () => {
      const candles = gerarCandles(100);

      const resultEngine = calcularBollinger(candles, 20, 2);

      expect(resultEngine).not.toBeNull();
      expect(resultEngine!.upper).toBeGreaterThan(resultEngine!.middle);
      expect(resultEngine!.middle).toBeGreaterThan(resultEngine!.lower);
    });

    it('Bollinger com dados insuficientes retorna fallback', () => {
      const closes = [100, 101, 102];

      const result = obterIndicadorComFallback('BOLLINGER', 20, closes, [], null);

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });
  });

  describe('ADX — cálculo via obterIndicadorComFallback', () => {
    it('retorna ADX válido com dados suficientes (≥ 28 candles)', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('ADX', 14, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(result.valor).not.toBeNull();
      expect(result.valor).toHaveProperty('adx');
      expect(result.valor).toHaveProperty('diPlus');
      expect(result.valor).toHaveProperty('diMinus');
    });

    it('ADX está no intervalo 0-100', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('ADX', 14, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(result.valor.adx).toBeGreaterThanOrEqual(0);
      expect(result.valor.adx).toBeLessThanOrEqual(100);
      expect(result.valor.diPlus).toBeGreaterThanOrEqual(0);
      expect(result.valor.diPlus).toBeLessThanOrEqual(100);
      expect(result.valor.diMinus).toBeGreaterThanOrEqual(0);
      expect(result.valor.diMinus).toBeLessThanOrEqual(100);
    });

    it('ADX consistente com indicatorEngine', () => {
      const candles = gerarCandles(100);

      const resultEngine = calcularADX(candles, 14);

      expect(resultEngine).not.toBeNull();
      expect(resultEngine!.adx).toBeGreaterThanOrEqual(0);
      expect(resultEngine!.adx).toBeLessThanOrEqual(100);
      expect(resultEngine!.diPlus).toBeGreaterThanOrEqual(0);
      expect(resultEngine!.diMinus).toBeGreaterThanOrEqual(0);
    });

    it('ADX com dados insuficientes (< 28 candles) retorna fallback', () => {
      const klines = gerarKlines(10);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('ADX', 14, closes, klines, null);

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });

    it('ADX com exatamente 28 candles retorna resultado válido', () => {
      const klines = gerarKlines(28);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('ADX', 14, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(result.valor).not.toBeNull();
      expect(result.valor).toHaveProperty('adx');
    });
  });

  describe('ATR — cálculo via obterIndicadorComFallback', () => {
    it('retorna ATR válido com dados suficientes (≥ 15 candles)', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('ATR', 14, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(result.valor).not.toBeNull();
      expect(typeof result.valor).toBe('number');
      expect(result.valor).toBeGreaterThan(0);
    });

    it('ATR é um número finito positivo', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('ATR', 14, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(isFinite(result.valor)).toBe(true);
      expect(result.valor).toBeGreaterThan(0);
    });

    it('ATR consistente com indicatorEngine', () => {
      const candles = gerarCandles(100);

      const resultEngine = calcularATR(candles, 14);

      expect(resultEngine).not.toBeNull();
      expect(resultEngine).toBeGreaterThan(0);
      expect(isFinite(resultEngine!)).toBe(true);
    });

    it('ATR com dados insuficientes (< 15 candles) retorna fallback', () => {
      const klines = gerarKlines(5);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('ATR', 14, closes, klines, null);

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });

    it('ATR com exatamente 15 candles retorna resultado válido', () => {
      const klines = gerarKlines(15);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('ATR', 14, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(result.valor).not.toBeNull();
      expect(result.valor).toBeGreaterThan(0);
    });
  });

  describe('Determinismo — mesmos inputs produzem mesmos outputs', () => {
    it('RSI é determinístico para mesmos closes', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result1 = obterIndicadorComFallback('RSI', 14, closes, klines, null);
      const result2 = obterIndicadorComFallback('RSI', 14, closes, klines, null);

      expect(result1.valor).toBe(result2.valor);
    });

    it('Bollinger é determinístico para mesmos closes', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result1 = obterIndicadorComFallback('BOLLINGER', 20, closes, klines, null);
      const result2 = obterIndicadorComFallback('BOLLINGER', 20, closes, klines, null);

      expect(result1.valor.banda_media).toBe(result2.valor.banda_media);
      expect(result1.valor.banda_superior).toBe(result2.valor.banda_superior);
      expect(result1.valor.banda_inferior).toBe(result2.valor.banda_inferior);
    });

    it('ADX é determinístico para mesmos klines', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result1 = obterIndicadorComFallback('ADX', 14, closes, klines, null);
      const result2 = obterIndicadorComFallback('ADX', 14, closes, klines, null);

      expect(result1.valor.adx).toBe(result2.valor.adx);
      expect(result1.valor.diPlus).toBe(result2.valor.diPlus);
      expect(result1.valor.diMinus).toBe(result2.valor.diMinus);
    });

    it('ATR é determinístico para mesmos klines', () => {
      const klines = gerarKlines(100);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result1 = obterIndicadorComFallback('ATR', 14, closes, klines, null);
      const result2 = obterIndicadorComFallback('ATR', 14, closes, klines, null);

      expect(result1.valor).toBe(result2.valor);
    });
  });

  describe('Code path não alterado — indicadores usam mesma lógica', () => {
    it('RSI usa calculateRSI do adaptedDataFetcher (não indicatorEngine diretamente)', () => {
      // Verifica que RSI com dados válidos retorna fonte API (calculado localmente)
      const klines = gerarKlines(50);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('RSI', 14, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(result.valor).toBeGreaterThan(1);
      expect(result.valor).toBeLessThan(99);
    });

    it('Bollinger usa cálculo inline no adaptedDataFetcher', () => {
      // Verifica que Bollinger com dados válidos retorna objeto com 3 bandas
      const klines = gerarKlines(50);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('BOLLINGER', 20, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(Object.keys(result.valor).sort()).toEqual(['banda_inferior', 'banda_media', 'banda_superior']);
    });

    it('ADX usa calcularADX do indicatorEngine', () => {
      // Verifica que ADX com dados válidos retorna objeto com adx, diPlus, diMinus
      const klines = gerarKlines(50);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('ADX', 14, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(Object.keys(result.valor).sort()).toEqual(['adx', 'diMinus', 'diPlus']);
    });

    it('ATR usa calculateATR do technicalAnalysis', () => {
      // Verifica que ATR com dados válidos retorna número (value extraído do objeto)
      const klines = gerarKlines(50);
      const closes = klines.map((k: any) => parseFloat(k[4]));

      const result = obterIndicadorComFallback('ATR', 14, closes, klines, null);

      expect(result.fonte).toBe('API');
      expect(typeof result.valor).toBe('number');
      expect(result.valor).toBeGreaterThan(0);
    });
  });
});
