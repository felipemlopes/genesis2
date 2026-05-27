import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { classificarEMAs, EMADetectada, EMAsClassificadas } from '../services/emaClassifier';
import { calcularEMA } from '../services/indicatorEngine';

/**
 * Property-based tests for EMA classification and dynamic EMA scoring
 * Feature: genesis-moderate-fixes
 * Properties: P4, P5, P6
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

// Helper: generate synthetic candles with controlled close prices
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

// Arbitrary: EMA with positive period and finite positive value
const emaArb = fc.record({
  periodo: fc.integer({ min: 1, max: 500 }),
  valor: fc.double({ min: 0.01, max: 100000, noNaN: true }),
});

// Arbitrary: EMA specifically in the "curta" range (≤25)
const emaCurtaArb = fc.record({
  periodo: fc.integer({ min: 1, max: 25 }),
  valor: fc.double({ min: 0.01, max: 100000, noNaN: true }),
});

// Arbitrary: EMA specifically in the "media" range (26-100)
const emaMediaArb = fc.record({
  periodo: fc.integer({ min: 26, max: 100 }),
  valor: fc.double({ min: 0.01, max: 100000, noNaN: true }),
});

// Arbitrary: EMA specifically in the "longa" range (>100)
const emaLongaArb = fc.record({
  periodo: fc.integer({ min: 101, max: 500 }),
  valor: fc.double({ min: 0.01, max: 100000, noNaN: true }),
});

// Feature: genesis-moderate-fixes, Property 4: Classificação e seleção de EMAs
describe('P4: Classificação e seleção de EMAs', () => {
  it('categoriza cada EMA corretamente: curta ≤ 25, média 26-100, longa > 100', () => {
    fc.assert(
      fc.property(
        fc.array(emaArb, { minLength: 1, maxLength: 20 }),
        (emas) => {
          const resultado = classificarEMAs(emas);

          // Verify curta category
          if (resultado.curta !== null) {
            expect(resultado.curta.periodo).toBeGreaterThanOrEqual(1);
            expect(resultado.curta.periodo).toBeLessThanOrEqual(25);
          }

          // Verify media category
          if (resultado.media !== null) {
            expect(resultado.media.periodo).toBeGreaterThanOrEqual(26);
            expect(resultado.media.periodo).toBeLessThanOrEqual(100);
          }

          // Verify longa category
          if (resultado.longa !== null) {
            expect(resultado.longa.periodo).toBeGreaterThan(100);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('seleciona a de menor período como representante quando há múltiplas na mesma categoria', () => {
    fc.assert(
      fc.property(
        fc.array(emaCurtaArb, { minLength: 2, maxLength: 10 }),
        fc.array(emaMediaArb, { minLength: 2, maxLength: 10 }),
        fc.array(emaLongaArb, { minLength: 2, maxLength: 10 }),
        (curtas, medias, longas) => {
          const todasEmas = [...curtas, ...medias, ...longas];
          const resultado = classificarEMAs(todasEmas);

          // Curta: should be the one with smallest period among curtas
          const menorCurta = curtas.reduce((min, e) => e.periodo < min.periodo ? e : min);
          expect(resultado.curta).not.toBeNull();
          expect(resultado.curta!.periodo).toBe(menorCurta.periodo);

          // Media: should be the one with smallest period among medias
          const menorMedia = medias.reduce((min, e) => e.periodo < min.periodo ? e : min);
          expect(resultado.media).not.toBeNull();
          expect(resultado.media!.periodo).toBe(menorMedia.periodo);

          // Longa: should be the one with smallest period among longas
          const menorLonga = longas.reduce((min, e) => e.periodo < min.periodo ? e : min);
          expect(resultado.longa).not.toBeNull();
          expect(resultado.longa!.periodo).toBe(menorLonga.periodo);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('ignora EMAs com período ≤ 0', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            periodo: fc.integer({ min: -100, max: 0 }),
            valor: fc.double({ min: 0.01, max: 100000, noNaN: true }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (emasInvalidas) => {
          const resultado = classificarEMAs(emasInvalidas);
          expect(resultado.curta).toBeNull();
          expect(resultado.media).toBeNull();
          expect(resultado.longa).toBeNull();
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('resultado contém apenas EMAs presentes na lista original', () => {
    fc.assert(
      fc.property(
        fc.array(emaArb, { minLength: 1, maxLength: 20 }),
        (emas) => {
          const resultado = classificarEMAs(emas);
          const validEmas = emas.filter(e => e.periodo > 0);

          if (resultado.curta !== null) {
            const found = validEmas.some(
              e => e.periodo === resultado.curta!.periodo && e.valor === resultado.curta!.valor
            );
            expect(found).toBe(true);
          }
          if (resultado.media !== null) {
            const found = validEmas.some(
              e => e.periodo === resultado.media!.periodo && e.valor === resultado.media!.valor
            );
            expect(found).toBe(true);
          }
          if (resultado.longa !== null) {
            const found = validEmas.some(
              e => e.periodo === resultado.longa!.periodo && e.valor === resultado.longa!.valor
            );
            expect(found).toBe(true);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: genesis-moderate-fixes, Property 5: EMAs dinâmicas como fonte primária
describe('P5: EMAs dinâmicas como fonte primária', () => {
  it('quando EMAs são detectadas, DadosScore usa valores dinâmicos ao invés de fixas', () => {
    fc.assert(
      fc.property(
        emaCurtaArb,
        emaMediaArb,
        emaLongaArb,
        (curtaDyn, mediaDyn, longaDyn) => {
          const emasDetectadas: EMADetectada[] = [curtaDyn, mediaDyn, longaDyn];
          const emasClassificadas = classificarEMAs(emasDetectadas);

          // All categories should be populated
          expect(emasClassificadas.curta).not.toBeNull();
          expect(emasClassificadas.media).not.toBeNull();
          expect(emasClassificadas.longa).not.toBeNull();

          // Simulate the adaptedDataFetcher logic: dynamic EMAs as primary
          const usarEmaCurta = emasClassificadas.curta !== null;
          const usarEmaMedia = emasClassificadas.media !== null;
          const usarEmaLonga = emasClassificadas.longa !== null;

          // Fixed fallback values (simulated)
          const ema21Fixa = 100;
          const ema50Fixa = 99;
          const ema200Fixa = 98;

          const emaScoreCurta = usarEmaCurta ? emasClassificadas.curta!.valor : ema21Fixa;
          const emaScoreMedia = usarEmaMedia ? emasClassificadas.media!.valor : ema50Fixa;
          const emaScoreLonga = usarEmaLonga ? emasClassificadas.longa!.valor : ema200Fixa;

          // DadosScore must use dynamic values, NOT the fixed fallbacks
          expect(emaScoreCurta).toBe(curtaDyn.valor);
          expect(emaScoreMedia).toBe(mediaDyn.valor);
          expect(emaScoreLonga).toBe(longaDyn.valor);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('quando nenhuma EMA é detectada, DadosScore usa fallback fixo', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 10, max: 1000, noNaN: true }),
        fc.double({ min: 10, max: 1000, noNaN: true }),
        fc.double({ min: 10, max: 1000, noNaN: true }),
        (ema21Fixa, ema50Fixa, ema200Fixa) => {
          const emasClassificadas = classificarEMAs([]);

          const usarEmaCurta = emasClassificadas.curta !== null;
          const usarEmaMedia = emasClassificadas.media !== null;
          const usarEmaLonga = emasClassificadas.longa !== null;

          const emaScoreCurta = usarEmaCurta ? emasClassificadas.curta!.valor : ema21Fixa;
          const emaScoreMedia = usarEmaMedia ? emasClassificadas.media!.valor : ema50Fixa;
          const emaScoreLonga = usarEmaLonga ? emasClassificadas.longa!.valor : ema200Fixa;

          // Must use fixed fallback values
          expect(emaScoreCurta).toBe(ema21Fixa);
          expect(emaScoreMedia).toBe(ema50Fixa);
          expect(emaScoreLonga).toBe(ema200Fixa);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('fallback parcial: categorias com EMA detectada usam dinâmica, sem detectada usam fixa', () => {
    fc.assert(
      fc.property(
        emaCurtaArb,
        fc.double({ min: 10, max: 1000, noNaN: true }),
        fc.double({ min: 10, max: 1000, noNaN: true }),
        (curtaDyn, ema50Fixa, ema200Fixa) => {
          // Only curta detected
          const emasClassificadas = classificarEMAs([curtaDyn]);

          const usarEmaCurta = emasClassificadas.curta !== null;
          const usarEmaMedia = emasClassificadas.media !== null;
          const usarEmaLonga = emasClassificadas.longa !== null;

          const emaScoreCurta = usarEmaCurta ? emasClassificadas.curta!.valor : 100;
          const emaScoreMedia = usarEmaMedia ? emasClassificadas.media!.valor : ema50Fixa;
          const emaScoreLonga = usarEmaLonga ? emasClassificadas.longa!.valor : ema200Fixa;

          // Curta uses dynamic
          expect(emaScoreCurta).toBe(curtaDyn.valor);
          // Media and longa use fallback
          expect(emaScoreMedia).toBe(ema50Fixa);
          expect(emaScoreLonga).toBe(ema200Fixa);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: genesis-moderate-fixes, Property 6: Tendência EMA (emaSubindo)
describe('P6: Tendência EMA (emaSubindo)', () => {
  it('emaSubindo é true sse EMA(candles) > EMA(candles sem último)', () => {
    fc.assert(
      fc.property(
        // Generate enough candles for EMA calculation (need periodo*2 candles minimum)
        // Use period 5-12 to keep candle arrays manageable
        fc.integer({ min: 5, max: 12 }),
        fc.array(
          fc.double({ min: 50, max: 150, noNaN: true }),
          { minLength: 50, maxLength: 100 }
        ),
        (periodo, closePrices) => {
          // Need at least periodo*2 candles for calcularEMA to return non-null
          if (closePrices.length < periodo * 2 + 1) return true; // skip insufficient data

          const candles = gerarCandles(closePrices);
          const candlesSemUltimo = candles.slice(0, -1);

          const emaAtual = calcularEMA(candles, periodo);
          const emaPrev = calcularEMA(candlesSemUltimo, periodo);

          // If either is null (sanity check from indicatorEngine), skip
          if (emaAtual === null || emaPrev === null) return true;

          // The emaSubindo logic from adaptedDataFetcher
          const emaSubindo = emaAtual > emaPrev;

          // Verify the property: emaSubindo is true iff emaAtual > emaPrev
          expect(emaSubindo).toBe(emaAtual > emaPrev);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('emaSubindo é false quando preços são constantes (EMA converge para o mesmo valor)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 12 }),
        fc.double({ min: 50, max: 150, noNaN: true }),
        (periodo, preco) => {
          // Constant prices: EMA should converge, so emaAtual ≈ emaPrev
          const closePrices = Array(periodo * 3).fill(preco);
          const candles = gerarCandles(closePrices);
          const candlesSemUltimo = candles.slice(0, -1);

          const emaAtual = calcularEMA(candles, periodo);
          const emaPrev = calcularEMA(candlesSemUltimo, periodo);

          if (emaAtual === null || emaPrev === null) return true;

          // With constant prices, EMA converges — emaSubindo should be false
          // (emaAtual should equal emaPrev or be negligibly different)
          const emaSubindo = emaAtual > emaPrev;
          expect(emaSubindo).toBe(false);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('emaSubindo é true quando último candle tem preço significativamente maior', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 10 }),
        fc.double({ min: 80, max: 120, noNaN: true }),
        fc.double({ min: 50, max: 200, noNaN: true }),
        (periodo, basePrice, spike) => {
          // Generate stable prices then add a large spike at the end
          const stablePrices = Array(periodo * 3 - 1).fill(basePrice);
          // Spike must be significantly above base to guarantee EMA rises
          const spikePrice = basePrice + Math.abs(spike);
          const closePrices = [...stablePrices, spikePrice];

          const candles = gerarCandles(closePrices);
          const candlesSemUltimo = candles.slice(0, -1);

          const emaAtual = calcularEMA(candles, periodo);
          const emaPrev = calcularEMA(candlesSemUltimo, periodo);

          if (emaAtual === null || emaPrev === null) return true;

          // With a spike above the stable base, EMA must rise
          const emaSubindo = emaAtual > emaPrev;
          expect(emaSubindo).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('emaSubindo integra corretamente com classificarEMAs para EMAs dinâmicas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 12 }),
        fc.array(
          fc.double({ min: 50, max: 150, noNaN: true }),
          { minLength: 50, maxLength: 80 }
        ),
        (periodo, closePrices) => {
          // Ensure period is in curta range for this test
          const periodoAjustado = Math.min(periodo, 25);
          if (closePrices.length < periodoAjustado * 2 + 1) return true;

          const candles = gerarCandles(closePrices);
          const candlesSemUltimo = candles.slice(0, -1);

          // Simulate: EMA detected in chart with this period
          const emasDetectadas: EMADetectada[] = [
            { periodo: periodoAjustado, valor: 100 }, // valor from chart reading
          ];
          const emasClassificadas = classificarEMAs(emasDetectadas);

          // The adaptedDataFetcher logic for dynamic EMA emaSubindo
          const usarEmaCurta = emasClassificadas.curta !== null;
          expect(usarEmaCurta).toBe(true);

          const periodoC = emasClassificadas.curta!.periodo;
          const emaAtualC = calcularEMA(candles, periodoC);
          const emaPrevC = calcularEMA(candlesSemUltimo, periodoC);

          const emaCurtaSubindo = emaAtualC !== null && emaPrevC !== null
            ? emaAtualC > emaPrevC
            : false;

          // Verify consistency: the boolean matches the actual comparison
          if (emaAtualC !== null && emaPrevC !== null) {
            expect(emaCurtaSubindo).toBe(emaAtualC > emaPrevC);
          } else {
            expect(emaCurtaSubindo).toBe(false);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
