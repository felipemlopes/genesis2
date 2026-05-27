/**
 * Unit Tests — normalizarPar
 * 
 * Validates: Requirements 2.6, 3.5
 * 
 * Tests the pair normalization function that removes stablecoin suffixes,
 * special characters, and the 1000 prefix, then adds USDT.
 */
import { describe, it, expect } from 'vitest';
import { normalizarPar } from '../normalizarPar';

describe('normalizarPar', () => {
  describe('Stablecoin suffix removal', () => {
    it('BTCUSDC → BTCUSDT', () => {
      expect(normalizarPar('BTCUSDC')).toBe('BTCUSDT');
    });

    it('ETHBUSD → ETHUSDT', () => {
      expect(normalizarPar('ETHBUSD')).toBe('ETHUSDT');
    });

    it('SOLUSD → SOLUSDT', () => {
      expect(normalizarPar('SOLUSD')).toBe('SOLUSDT');
    });

    it('ADATUSD → ADAUSDT', () => {
      expect(normalizarPar('ADATUSD')).toBe('ADAUSDT');
    });

    it('LINKDAI → LINKUSDT', () => {
      expect(normalizarPar('LINKDAI')).toBe('LINKUSDT');
    });

    it('DOTTUSD → DOTUSDT', () => {
      expect(normalizarPar('DOTTUSD')).toBe('DOTUSDT');
    });
  });

  describe('Special character removal', () => {
    it('SOLUSD.P → SOLUSDT', () => {
      expect(normalizarPar('SOLUSD.P')).toBe('SOLUSDT');
    });

    it('BTCUSDPERP → BTCUSDT', () => {
      expect(normalizarPar('BTCUSDPERP')).toBe('BTCUSDT');
    });

    it('BTC/USDT → BTCUSDT', () => {
      expect(normalizarPar('BTC/USDT')).toBe('BTCUSDT');
    });

    it('ETH/USD → ETHUSDT', () => {
      expect(normalizarPar('ETH/USD')).toBe('ETHUSDT');
    });

    it('SOL/USDC → SOLUSDT', () => {
      expect(normalizarPar('SOL/USDC')).toBe('SOLUSDT');
    });
  });

  describe('1000 prefix removal', () => {
    it('1000PEPEUSDT → PEPEUSDT', () => {
      expect(normalizarPar('1000PEPEUSDT')).toBe('PEPEUSDT');
    });

    it('1000SHIBUSDT → SHIBUSDT', () => {
      expect(normalizarPar('1000SHIBUSDT')).toBe('SHIBUSDT');
    });

    it('1000FLOKIUSDC → FLOKIUSDT', () => {
      expect(normalizarPar('1000FLOKIUSDC')).toBe('FLOKIUSDT');
    });
  });

  describe('Already valid pairs pass unchanged', () => {
    it('BTCUSDT → BTCUSDT', () => {
      expect(normalizarPar('BTCUSDT')).toBe('BTCUSDT');
    });

    it('ETHUSDT → ETHUSDT', () => {
      expect(normalizarPar('ETHUSDT')).toBe('ETHUSDT');
    });

    it('SOLUSDT → SOLUSDT', () => {
      expect(normalizarPar('SOLUSDT')).toBe('SOLUSDT');
    });

    it('DOGEUSDT → DOGEUSDT', () => {
      expect(normalizarPar('DOGEUSDT')).toBe('DOGEUSDT');
    });
  });

  describe('Combined special cases', () => {
    it('1000PEPE/USDC → PEPEUSDT', () => {
      expect(normalizarPar('1000PEPE/USDC')).toBe('PEPEUSDT');
    });

    it('BTCUSD.P → BTCUSDT (removes .P then handles USD suffix)', () => {
      expect(normalizarPar('BTCUSD.P')).toBe('BTCUSDT');
    });

    it('handles lowercase input', () => {
      expect(normalizarPar('btcusdt')).toBe('BTCUSDT');
    });

    it('handles whitespace', () => {
      expect(normalizarPar('  BTCUSDT  ')).toBe('BTCUSDT');
    });
  });
});
