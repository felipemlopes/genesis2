import { describe, it, expect } from 'vitest';
import { price, usd, formatMoney } from '../utils/canonicalMoney';

/**
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.7, doc §16): price() usa
 * tickDecimals real quando disponível (PriceNormalizer, backend), cai na heurística de magnitude
 * antiga só sem ele. usd() é sempre 2 casas. Escrito nesta sessão (2026-08-22), não é transcrição
 * do documento.
 */
describe('canonicalMoney', () => {
  describe('price()', () => {
    it('usa tickDecimals real quando informado, mesmo para valores >= 1', () => {
      expect(price(65370.9262, 1)).toBe('$ 65,370.9');
      expect(price(65370.9262, 0)).toBe('$ 65,371');
    });

    it('sem tickDecimals, cai na heurística de magnitude (>= 1 -> 2 casas)', () => {
      expect(price(65370.9262)).toBe('$ 65,370.93');
    });

    it('sem tickDecimals, valores entre 0.01 e 1 usam 4 casas', () => {
      expect(price(0.4212345)).toBe('$ 0.4212');
    });

    it('sem tickDecimals, valores abaixo de 0.01 usam 8 casas (tokens de baixo valor)', () => {
      expect(price(0.0000123456)).toBe('$ 0.00001235');
    });

    it('null/undefined/NaN devolvem travessão', () => {
      expect(price(null)).toBe('—');
      expect(price(undefined)).toBe('—');
      expect(price(NaN)).toBe('—');
    });

    it('tickDecimals=0 é um valor real, não deve cair no fallback de magnitude', () => {
      // 0 é falsy em JS — precisa de ?? explícito, não ||, pra não escapar pro fallback.
      expect(price(100, 0)).toBe('$ 100');
    });
  });

  describe('usd()', () => {
    it('sempre 2 casas, independente da magnitude', () => {
      expect(usd(73.06)).toBe('$ 73.06');
      expect(usd(1000)).toBe('$ 1,000.00');
      expect(usd(0.004)).toBe('$ 0.00');
    });

    it('null/undefined/NaN devolvem travessão', () => {
      expect(usd(null)).toBe('—');
      expect(usd(undefined)).toBe('—');
    });
  });

  describe('formatMoney()', () => {
    it('delega para usd() ou price() conforme kind', () => {
      expect(formatMoney(1234.5, 'USD_AMOUNT')).toBe(usd(1234.5));
      expect(formatMoney(1234.5, 'PRICE', 3)).toBe(price(1234.5, 3));
    });
  });
});
