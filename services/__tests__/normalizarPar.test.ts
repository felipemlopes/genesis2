/**
 * Unit Tests — normalizarPar / normalizarTimeframe
 *
 * Validates: Requirements 2.6, 3.5 · CODE-P0-18 (spec genesis-v6-8-correcao-tecnica)
 *
 * V6.8: a suíte anterior fixava como esperado o próprio bug (seção "1000 prefix removal"
 * verificava que 1000PEPEUSDT virava PEPEUSDT). Isso foi invertido — 1000PEPEUSDT é um contrato
 * real e distinto na Binance Futures, e precisa sobreviver íntegro à normalização.
 */
import { describe, it, expect } from 'vitest';
import { normalizarPar, normalizarTimeframe } from '../normalizarPar';

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

    it('BINANCE:BTCUSDT.P → BTCUSDT (prefixo de corretora removido)', () => {
      expect(normalizarPar('BINANCE:BTCUSDT.P')).toBe('BTCUSDT');
    });

    it('SUPERPUSDT preserva o "PERP" do meio do nome (regex ancorada, não global)', () => {
      // A versão anterior usava clean.replace(/PERP/g, '') sem âncora — "SUPERPUSDT" contém
      // "PERP" nas posições 2-5 e virava "SUUSDT" por acidente. Só o sufixo no FIM da string
      // conta como marcador de perpétuo agora.
      expect(normalizarPar('SUPERPUSDT')).toBe('SUPERPUSDT');
    });
  });

  describe('CODE-P0-18 — prefixo "1000" é preservado (contrato real, distinto do token)', () => {
    it('1000PEPEUSDT → 1000PEPEUSDT', () => {
      expect(normalizarPar('1000PEPEUSDT')).toBe('1000PEPEUSDT');
    });

    it('1000SHIBUSDT → 1000SHIBUSDT', () => {
      expect(normalizarPar('1000SHIBUSDT')).toBe('1000SHIBUSDT');
    });

    it('1000BONKUSDT → 1000BONKUSDT', () => {
      expect(normalizarPar('1000BONKUSDT')).toBe('1000BONKUSDT');
    });

    it('1000FLOKIUSDT → 1000FLOKIUSDT', () => {
      expect(normalizarPar('1000FLOKIUSDT')).toBe('1000FLOKIUSDT');
    });

    it('1000RATSUSDT → 1000RATSUSDT', () => {
      expect(normalizarPar('1000RATSUSDT')).toBe('1000RATSUSDT');
    });

    it('1000FLOKIUSDC → 1000FLOKIUSDT (suffix trocado, prefixo preservado)', () => {
      expect(normalizarPar('1000FLOKIUSDC')).toBe('1000FLOKIUSDT');
    });

    it('BINANCE:1000PEPEUSDT.P → 1000PEPEUSDT', () => {
      expect(normalizarPar('BINANCE:1000PEPEUSDT.P')).toBe('1000PEPEUSDT');
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
    it('1000PEPE/USDC → 1000PEPEUSDT', () => {
      expect(normalizarPar('1000PEPE/USDC')).toBe('1000PEPEUSDT');
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

  describe('Entradas inválidas', () => {
    it('string vazia lança erro', () => {
      expect(() => normalizarPar('')).toThrow();
    });

    it('só espaços lança erro', () => {
      expect(() => normalizarPar('   ')).toThrow();
    });

    it('só a quote, sem base, lança erro', () => {
      expect(() => normalizarPar('USDT')).toThrow();
    });
  });
});

describe('normalizarTimeframe', () => {
  it('distingue mensal (1M) de 1 minuto (1m)', () => {
    expect(normalizarTimeframe('1M')).toBe('1M');
    expect(normalizarTimeframe('1m')).toBe('1m');
  });

  it('normaliza rótulos comuns', () => {
    expect(normalizarTimeframe('daily')).toBe('1d');
    expect(normalizarTimeframe('H4')).toBe('4h');
    expect(normalizarTimeframe('60m')).toBe('1h');
    expect(normalizarTimeframe('weekly')).toBe('1w');
  });

  it('timeframe já normalizado passa inalterado', () => {
    expect(normalizarTimeframe('15m')).toBe('15m');
  });

  it('rejeita timeframe fora da lista permitida', () => {
    expect(() => normalizarTimeframe('7h')).toThrow();
  });
});
