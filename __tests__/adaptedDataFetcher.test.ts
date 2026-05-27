import { describe, it, expect } from 'vitest';
import { obterIndicadorComFallback } from '../services/adaptedDataFetcher';

/**
 * Unit tests for OCR fallback when indicator calculation fails (Task 5.2)
 * Feature: genesis-moderate-fixes, Property 12: Fallback para OCR em falha de cálculo
 *
 * Validates: Requisito 6.4
 * PARA QUALQUER indicador cujo cálculo via API falha (dados insuficientes ou erro),
 * o sistema deve tentar fallback para leitura visual (OCR) antes de retornar INDISPONIVEL.
 */

// Helper: jsonVisual com indicadores visíveis para simular OCR
function criarJsonVisualCom(nome: string, valor: number) {
  return {
    indicadores_visiveis: [
      { nome, valor_estimado: valor },
    ],
  };
}

// Helper: closes insuficientes para qualquer cálculo
const closesInsuficientes: number[] = [100, 101];

// Helper: klinesData insuficientes
const klinesInsuficientes = [[Date.now(), '100', '101', '99', '100', '1000']];

describe('Fallback OCR em falha de cálculo — P12', () => {

  describe('EMA: dados insuficientes → fallback OCR', () => {
    it('retorna valor OCR quando closes insuficientes para EMA', () => {
      const jsonVisual = criarJsonVisualCom('EMA', 98.5);
      const result = obterIndicadorComFallback('EMA', 21, closesInsuficientes, klinesInsuficientes, jsonVisual);

      expect(result.fonte).toBe('GRAFICO');
      expect(result.valor).toBe(98.5);
      expect(result.nota).toContain('visualmente');
    });

    it('retorna INDISPONIVEL quando closes insuficientes e OCR não tem valor', () => {
      const result = obterIndicadorComFallback('EMA', 21, closesInsuficientes, klinesInsuficientes, {});

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });

    it('retorna INDISPONIVEL quando jsonVisual é null', () => {
      const result = obterIndicadorComFallback('EMA', 21, closesInsuficientes, klinesInsuficientes, null);

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });
  });

  describe('RSI: dados insuficientes → fallback OCR', () => {
    it('retorna valor OCR quando closes insuficientes para RSI', () => {
      const jsonVisual = criarJsonVisualCom('RSI', 65.3);
      const result = obterIndicadorComFallback('RSI', 14, closesInsuficientes, klinesInsuficientes, jsonVisual);

      expect(result.fonte).toBe('GRAFICO');
      expect(result.valor).toBe(65.3);
    });

    it('retorna INDISPONIVEL quando RSI falha e OCR não disponível', () => {
      const result = obterIndicadorComFallback('RSI', 14, closesInsuficientes, klinesInsuficientes, null);

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });
  });

  describe('MACD: dados insuficientes (< 35 candles) → fallback OCR', () => {
    it('retorna valor OCR quando klinesData < 35 candles', () => {
      const jsonVisual = criarJsonVisualCom('MACD', -0.5);
      // Apenas 10 candles — insuficiente para MACD (precisa ≥ 35)
      const klines10 = Array.from({ length: 10 }, (_, i) => [
        Date.now() - (10 - i) * 60000, '100', '101', '99', '100', '1000',
      ]);
      const result = obterIndicadorComFallback('MACD', 0, [], klines10, jsonVisual);

      expect(result.fonte).toBe('GRAFICO');
      expect(result.valor).toBe(-0.5);
    });

    it('retorna INDISPONIVEL quando MACD falha e OCR não disponível', () => {
      const klines10 = Array.from({ length: 10 }, (_, i) => [
        Date.now() - (10 - i) * 60000, '100', '101', '99', '100', '1000',
      ]);
      const result = obterIndicadorComFallback('MACD', 0, [], klines10, null);

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });
  });

  describe('BOLLINGER: dados insuficientes → fallback OCR', () => {
    it('retorna valor OCR quando closes insuficientes para Bollinger', () => {
      const jsonVisual = criarJsonVisualCom('BOLLINGER', 102.0);
      const result = obterIndicadorComFallback('BOLLINGER', 20, closesInsuficientes, klinesInsuficientes, jsonVisual);

      expect(result.fonte).toBe('GRAFICO');
      expect(result.valor).toBe(102.0);
    });

    it('retorna INDISPONIVEL quando Bollinger falha e OCR não disponível', () => {
      const result = obterIndicadorComFallback('BOLLINGER', 20, closesInsuficientes, klinesInsuficientes, {});

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });
  });

  describe('ADX: dados insuficientes → fallback OCR', () => {
    it('retorna valor OCR quando klinesData < 28 candles para ADX', () => {
      const jsonVisual = criarJsonVisualCom('ADX', 32.1);
      // Apenas 5 candles — insuficiente para ADX (precisa ≥ 28)
      const klines5 = Array.from({ length: 5 }, (_, i) => [
        Date.now() - (5 - i) * 60000, '100', '101', '99', '100', '1000',
      ]);
      const result = obterIndicadorComFallback('ADX', 14, closesInsuficientes, klines5, jsonVisual);

      expect(result.fonte).toBe('GRAFICO');
      expect(result.valor).toBe(32.1);
    });

    it('retorna INDISPONIVEL quando ADX falha e OCR não disponível', () => {
      const klines5 = Array.from({ length: 5 }, (_, i) => [
        Date.now() - (5 - i) * 60000, '100', '101', '99', '100', '1000',
      ]);
      const result = obterIndicadorComFallback('ADX', 14, closesInsuficientes, klines5, null);

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });
  });

  describe('ATR: dados insuficientes → fallback OCR', () => {
    it('retorna valor OCR quando klinesData < 15 candles para ATR', () => {
      const jsonVisual = criarJsonVisualCom('ATR', 1.25);
      // Apenas 5 candles — insuficiente para ATR (precisa ≥ 15)
      const klines5 = Array.from({ length: 5 }, (_, i) => [
        Date.now() - (5 - i) * 60000, '100', '101', '99', '100', '1000',
      ]);
      const result = obterIndicadorComFallback('ATR', 14, closesInsuficientes, klines5, jsonVisual);

      expect(result.fonte).toBe('GRAFICO');
      expect(result.valor).toBe(1.25);
    });

    it('retorna INDISPONIVEL quando ATR falha e OCR não disponível', () => {
      const klines5 = Array.from({ length: 5 }, (_, i) => [
        Date.now() - (5 - i) * 60000, '100', '101', '99', '100', '1000',
      ]);
      const result = obterIndicadorComFallback('ATR', 14, closesInsuficientes, klines5, null);

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });
  });

  describe('Cálculo retorna valor inválido → fallback OCR', () => {
    it('EMA com variação zero nos closes → fallback OCR', () => {
      // Closes sem variação — hasPriceVariation retorna false
      const closesSemVariacao = Array(100).fill(100);
      const jsonVisual = criarJsonVisualCom('EMA', 100.0);
      const result = obterIndicadorComFallback('EMA', 21, closesSemVariacao, klinesInsuficientes, jsonVisual);

      expect(result.fonte).toBe('GRAFICO');
      expect(result.valor).toBe(100.0);
    });
  });

  describe('Indicador desconhecido → fallback OCR', () => {
    it('indicador não reconhecido cai no fallback OCR se disponível', () => {
      const jsonVisual = criarJsonVisualCom('STOCH', 80.0);
      const result = obterIndicadorComFallback('STOCH', 14, closesInsuficientes, klinesInsuficientes, jsonVisual);

      // Indicador desconhecido: calculado = null, fallbackNecessario = false
      // Mas calculado é null, então vai para OCR
      expect(result.fonte).toBe('GRAFICO');
      expect(result.valor).toBe(80.0);
    });

    it('indicador não reconhecido sem OCR retorna INDISPONIVEL', () => {
      const result = obterIndicadorComFallback('STOCH', 14, closesInsuficientes, klinesInsuficientes, null);

      expect(result.fonte).toBe('INDISPONIVEL');
      expect(result.valor).toBeNull();
    });
  });

  describe('Cálculo bem-sucedido → retorna API (não usa OCR)', () => {
    it('RSI com dados suficientes retorna fonte API', () => {
      // Gerar closes com variação suficiente para RSI válido (entre 1 e 99)
      const closes = Array.from({ length: 100 }, (_, i) => 50 + (i % 5) - 2);
      const jsonVisual = criarJsonVisualCom('RSI', 999);
      const result = obterIndicadorComFallback('RSI', 14, closes, klinesInsuficientes, jsonVisual);

      expect(result.fonte).toBe('API');
      expect(result.valor).not.toBeNull();
    });

    it('MACD com dados suficientes (≥ 35 candles) retorna fonte API', () => {
      // Gerar klines suficientes com variação para MACD válido
      const klines = Array.from({ length: 50 }, (_, i) => {
        const price = 100 + (i % 7) - 3;
        return [
          Date.now() - (50 - i) * 60000,
          String(price - 0.5),
          String(price + 1),
          String(price - 1),
          String(price),
          '1000',
        ];
      });
      const closes = klines.map(k => parseFloat(k[4] as string));
      const jsonVisual = criarJsonVisualCom('MACD', 999);
      const result = obterIndicadorComFallback('MACD', 0, closes, klines, jsonVisual);

      expect(result.fonte).toBe('API');
      expect(result.valor).not.toBeNull();
      expect(result.valor).toHaveProperty('linha_macd');
      expect(result.valor).toHaveProperty('linha_sinal');
    });
  });
});
