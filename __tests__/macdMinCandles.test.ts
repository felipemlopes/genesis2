import { describe, it, expect } from 'vitest';
import { obterIndicadorComFallback, MACD_MIN_CANDLES } from '../services/adaptedDataFetcher';
import { calcularMACD } from '../services/indicatorEngine';

/**
 * Unit tests for MACD minimum candles condition (Task 4.2)
 * Feature: genesis-moderate-fixes
 * 
 * Validates Requirement 5.4: IF o número de candles disponíveis é inferior a 35
 * (26 para EMA slow + 9 para Signal EMA), THEN THE AdaptedDataFetcher SHALL
 * retornar fallback para leitura visual (OCR) ou INDISPONIVEL
 */

// Helper: generate synthetic klines data in Binance format [timestamp, open, high, low, close, volume, ...]
function gerarKlines(count: number, basePrice: number = 100): any[] {
    const klines = [];
    let price = basePrice;
    for (let i = 0; i < count; i++) {
        // Deterministic variation to ensure price movement
        const variation = Math.sin(i * 0.3) * 5 + Math.cos(i * 0.1) * 3;
        price = basePrice + variation;
        klines.push([
            Date.now() - (count - i) * 60000, // timestamp
            String(price - 0.5),               // open
            String(price + 1),                 // high
            String(price - 1),                 // low
            String(price),                     // close
            String(1000 + i * 10),             // volume
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

describe('MACD Minimum Candles Condition', () => {

    describe('MACD_MIN_CANDLES constant', () => {
        it('deve ser 35 (26 slow + 9 signal)', () => {
            expect(MACD_MIN_CANDLES).toBe(35);
        });
    });

    describe('obterIndicadorComFallback - MACD com dados insuficientes', () => {
        it('com exatamente 34 candles (< 35), deve retornar INDISPONIVEL (fallback)', () => {
            const klinesData = gerarKlines(34);
            const closes = klinesData.map((k: any) => parseFloat(k[4]));

            const resultado = obterIndicadorComFallback('MACD', 0, closes, klinesData, null);

            // Com menos de 35 candles e sem dados visuais, deve retornar INDISPONIVEL
            expect(resultado.fonte).toBe('INDISPONIVEL');
            expect(resultado.valor).toBeNull();
        });

        it('com 0 candles, deve retornar INDISPONIVEL', () => {
            const resultado = obterIndicadorComFallback('MACD', 0, [], [], null);

            expect(resultado.fonte).toBe('INDISPONIVEL');
            expect(resultado.valor).toBeNull();
        });

        it('com 26 candles (apenas suficiente para EMA slow, insuficiente para signal), deve retornar INDISPONIVEL', () => {
            const klinesData = gerarKlines(26);
            const closes = klinesData.map((k: any) => parseFloat(k[4]));

            const resultado = obterIndicadorComFallback('MACD', 0, closes, klinesData, null);

            expect(resultado.fonte).toBe('INDISPONIVEL');
            expect(resultado.valor).toBeNull();
        });
    });

    describe('obterIndicadorComFallback - MACD com dados suficientes', () => {
        it('com exatamente 35 candles (= mínimo), deve calcular MACD via API', () => {
            const klinesData = gerarKlines(35);
            const closes = klinesData.map((k: any) => parseFloat(k[4]));

            const resultado = obterIndicadorComFallback('MACD', 0, closes, klinesData, null);

            expect(resultado.fonte).toBe('API');
            expect(resultado.valor).not.toBeNull();
            expect(resultado.valor).toHaveProperty('linha_macd');
            expect(resultado.valor).toHaveProperty('linha_sinal');
            expect(typeof resultado.valor.linha_macd).toBe('number');
            expect(typeof resultado.valor.linha_sinal).toBe('number');
        });

        it('com 200 candles, deve calcular MACD via API', () => {
            const klinesData = gerarKlines(200);
            const closes = klinesData.map((k: any) => parseFloat(k[4]));

            const resultado = obterIndicadorComFallback('MACD', 0, closes, klinesData, null);

            expect(resultado.fonte).toBe('API');
            expect(resultado.valor).not.toBeNull();
            expect(resultado.valor).toHaveProperty('linha_macd');
            expect(resultado.valor).toHaveProperty('linha_sinal');
        });
    });

    describe('obterIndicadorComFallback - MACD fallback para OCR', () => {
        it('com < 35 candles mas com dados visuais disponíveis, deve usar fallback gráfico', () => {
            const klinesData = gerarKlines(20);
            const closes = klinesData.map((k: any) => parseFloat(k[4]));
            const jsonVisual = {
                indicadores_visiveis: [
                    { nome: 'MACD', valor_estimado: 0.5 }
                ]
            };

            const resultado = obterIndicadorComFallback('MACD', 0, closes, klinesData, jsonVisual);

            // Deve usar fallback gráfico (OCR) quando dados insuficientes para cálculo
            expect(resultado.fonte).toBe('GRAFICO');
            expect(resultado.valor).toBe(0.5);
            expect(resultado.nota).toContain('visualmente');
        });
    });

    describe('obterIndicadorComFallback - MACD interface { linha_macd, linha_sinal } compatível com consumidores', () => {
        it('objeto retornado deve ter exatamente as propriedades linha_macd e linha_sinal como números finitos', () => {
            const klinesData = gerarKlines(100);
            const closes = klinesData.map((k: any) => parseFloat(k[4]));

            const resultado = obterIndicadorComFallback('MACD', 0, closes, klinesData, null);

            expect(resultado.fonte).toBe('API');
            expect(resultado.valor).not.toBeNull();
            // Interface contract: { linha_macd: number, linha_sinal: number }
            expect(resultado.valor).toHaveProperty('linha_macd');
            expect(resultado.valor).toHaveProperty('linha_sinal');
            expect(typeof resultado.valor.linha_macd).toBe('number');
            expect(typeof resultado.valor.linha_sinal).toBe('number');
            expect(isFinite(resultado.valor.linha_macd)).toBe(true);
            expect(isFinite(resultado.valor.linha_sinal)).toBe(true);
        });

        it('linha_sinal deve ser diferente de linha_macd * 0.9 (não é multiplicação por constante)', () => {
            const klinesData = gerarKlines(100);
            const closes = klinesData.map((k: any) => parseFloat(k[4]));

            const resultado = obterIndicadorComFallback('MACD', 0, closes, klinesData, null);

            expect(resultado.fonte).toBe('API');
            // Signal line is EMA(9) of MACD series, NOT macdLine * 0.9
            expect(resultado.valor.linha_sinal).not.toBeCloseTo(resultado.valor.linha_macd * 0.9, 5);
        });

        it('histograma implícito (linha_macd - linha_sinal) deve ser calculável pelo consumidor', () => {
            const klinesData = gerarKlines(100);
            const closes = klinesData.map((k: any) => parseFloat(k[4]));

            const resultado = obterIndicadorComFallback('MACD', 0, closes, klinesData, null);

            expect(resultado.fonte).toBe('API');
            // Consumer calculates histograma as: linha_macd - linha_sinal
            const histograma = resultado.valor.linha_macd - resultado.valor.linha_sinal;
            expect(typeof histograma).toBe('number');
            expect(isFinite(histograma)).toBe(true);
        });
    });

    describe('calcularMACD (indicatorEngine) - minimum candles check', () => {
        it('com 34 candles, deve retornar null', () => {
            const candles = gerarCandles(34);
            const resultado = calcularMACD(candles);
            expect(resultado).toBeNull();
        });

        it('com 35 candles, deve retornar resultado válido', () => {
            const candles = gerarCandles(35);
            const resultado = calcularMACD(candles);
            expect(resultado).not.toBeNull();
            expect(resultado).toHaveProperty('macd');
            expect(resultado).toHaveProperty('signal');
            expect(resultado).toHaveProperty('histogram');
        });

        it('signal line não deve ser macdLine * 0.9 (bug antigo)', () => {
            const candles = gerarCandles(100);
            const resultado = calcularMACD(candles);
            expect(resultado).not.toBeNull();
            // Signal should NOT be 0.9 * macd (the old bug)
            expect(resultado!.signal).not.toBeCloseTo(resultado!.macd * 0.9, 5);
        });
    });
});
