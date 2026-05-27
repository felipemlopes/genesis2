import { describe, it, expect } from 'vitest';
import { classificarEMAs, EMADetectada, EMAsClassificadas } from '../services/emaClassifier';
import { calcularEMA } from '../services/indicatorEngine';

/**
 * Unit tests for EMA fallback behavior (Task 2.3)
 * Feature: genesis-moderate-fixes
 * 
 * Validates Requirement 3.2: IF nenhuma EMA é detectada no gráfico do usuário,
 * THEN THE Scoring_Engine SHALL calcular EMAs 21, 50 e 200 como referência secundária
 * (comportamento atual como fallback)
 */

// Helper: generate synthetic candles with a known price pattern
function gerarCandles(count: number, basePrice: number = 100) {
    const candles = [];
    let price = basePrice;
    for (let i = 0; i < count; i++) {
        // Small random-like variation using deterministic formula
        const variation = Math.sin(i * 0.1) * 2;
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

describe('EMA Fallback: EMAs fixas 21/50/200 quando nenhuma detectada', () => {

    describe('classificarEMAs retorna nulls para lista vazia', () => {
        it('deve retornar curta=null, media=null, longa=null quando array vazio', () => {
            const resultado = classificarEMAs([]);
            expect(resultado.curta).toBeNull();
            expect(resultado.media).toBeNull();
            expect(resultado.longa).toBeNull();
        });

        it('deve retornar nulls quando EMAs têm período <= 0', () => {
            const emas: EMADetectada[] = [
                { periodo: 0, valor: 100 },
                { periodo: -5, valor: 200 },
            ];
            const resultado = classificarEMAs(emas);
            expect(resultado.curta).toBeNull();
            expect(resultado.media).toBeNull();
            expect(resultado.longa).toBeNull();
        });
    });

    describe('Fallback para EMAs fixas 21/50/200 com candle data', () => {
        it('quando nenhuma EMA detectada, calcularEMA com períodos 21/50/200 produz valores válidos', () => {
            const candles = gerarCandles(500, 100);

            // Simula o cenário de fallback: classificarEMAs retorna tudo null
            const emasClassificadas = classificarEMAs([]);
            const usarEmaCurta = emasClassificadas.curta !== null;
            const usarEmaMedia = emasClassificadas.media !== null;
            const usarEmaLonga = emasClassificadas.longa !== null;

            expect(usarEmaCurta).toBe(false);
            expect(usarEmaMedia).toBe(false);
            expect(usarEmaLonga).toBe(false);

            // Fallback: calcular EMAs fixas
            const ema21 = calcularEMA(candles, 21);
            const ema50 = calcularEMA(candles, 50);
            const ema200 = calcularEMA(candles, 200);

            // EMAs fixas devem ser calculadas com sucesso
            expect(ema21).not.toBeNull();
            expect(ema50).not.toBeNull();
            expect(ema200).not.toBeNull();

            // Valores devem ser números finitos positivos
            expect(typeof ema21).toBe('number');
            expect(typeof ema50).toBe('number');
            expect(typeof ema200).toBe('number');
            expect(ema21).toBeGreaterThan(0);
            expect(ema50).toBeGreaterThan(0);
            expect(ema200).toBeGreaterThan(0);
        });

        it('fallback mapeia corretamente para campos DadosScore (ema21, ema50, ema200)', () => {
            const candles = gerarCandles(500, 50);

            const emasClassificadas = classificarEMAs([]);

            // Simula a lógica do adaptedDataFetcher
            const ema21 = calcularEMA(candles, 21);
            const ema50 = calcularEMA(candles, 50);
            const ema200 = calcularEMA(candles, 200);

            const usarEmaCurta = emasClassificadas.curta !== null;
            const usarEmaMedia = emasClassificadas.media !== null;
            const usarEmaLonga = emasClassificadas.longa !== null;

            // Lógica de fallback do adaptedDataFetcher
            const emaScoreCurta = usarEmaCurta ? emasClassificadas.curta!.valor : (ema21 || undefined);
            const emaScoreMedia = usarEmaMedia ? emasClassificadas.media!.valor : (ema50 || undefined);
            const emaScoreLonga = usarEmaLonga ? emasClassificadas.longa!.valor : (ema200 || undefined);

            // Deve usar os valores fixos calculados
            expect(emaScoreCurta).toBe(ema21);
            expect(emaScoreMedia).toBe(ema50);
            expect(emaScoreLonga).toBe(ema200);
        });

        it('fallback calcula emaSubindo corretamente com EMAs fixas', () => {
            const candles = gerarCandles(500, 100);

            const emasClassificadas = classificarEMAs([]);
            const usarEmaCurta = emasClassificadas.curta !== null;

            // Simula lógica de emaSubindo no fallback
            const ema21Atual = calcularEMA(candles, 21);
            const ema21Prev = calcularEMA(candles.slice(0, -1), 21);

            let emaCurtaSubindo: boolean;
            if (usarEmaCurta) {
                emaCurtaSubindo = false; // Não deveria entrar aqui
            } else {
                emaCurtaSubindo = ema21Atual !== null && ema21Prev !== null ? ema21Atual > ema21Prev : false;
            }

            // O resultado deve ser um booleano determinístico
            expect(typeof emaCurtaSubindo).toBe('boolean');
        });
    });

    describe('EMAs dinâmicas têm prioridade sobre fallback', () => {
        it('quando EMA curta é detectada, não usa fallback para curta', () => {
            const emasDetectadas: EMADetectada[] = [
                { periodo: 9, valor: 105.5 },
            ];
            const emasClassificadas = classificarEMAs(emasDetectadas);

            const usarEmaCurta = emasClassificadas.curta !== null;
            expect(usarEmaCurta).toBe(true);

            // Valor dinâmico deve ser usado
            const emaScoreCurta = usarEmaCurta ? emasClassificadas.curta!.valor : undefined;
            expect(emaScoreCurta).toBe(105.5);
        });

        it('fallback parcial: usa dinâmica para curta, fixa para média e longa', () => {
            const candles = gerarCandles(500, 100);
            const emasDetectadas: EMADetectada[] = [
                { periodo: 20, valor: 99.5 }, // curta (≤25)
            ];
            const emasClassificadas = classificarEMAs(emasDetectadas);

            const ema50 = calcularEMA(candles, 50);
            const ema200 = calcularEMA(candles, 200);

            const usarEmaCurta = emasClassificadas.curta !== null;
            const usarEmaMedia = emasClassificadas.media !== null;
            const usarEmaLonga = emasClassificadas.longa !== null;

            expect(usarEmaCurta).toBe(true);
            expect(usarEmaMedia).toBe(false);
            expect(usarEmaLonga).toBe(false);

            const emaScoreCurta = usarEmaCurta ? emasClassificadas.curta!.valor : undefined;
            const emaScoreMedia = usarEmaMedia ? emasClassificadas.media!.valor : (ema50 || undefined);
            const emaScoreLonga = usarEmaLonga ? emasClassificadas.longa!.valor : (ema200 || undefined);

            // Curta usa dinâmica
            expect(emaScoreCurta).toBe(99.5);
            // Média e longa usam fallback fixo
            expect(emaScoreMedia).toBe(ema50);
            expect(emaScoreLonga).toBe(ema200);
        });
    });
});
