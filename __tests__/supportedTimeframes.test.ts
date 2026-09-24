import { describe, expect, it } from 'vitest';
import { SUPPORTED_TIMEFRAMES, isSupportedTimeframe } from '../utils/supportedTimeframes';

describe('supportedTimeframes (Genesis Brain V2, Fonte §56)', () => {
  it('espelha exatamente GenesisSupportedTimeframes::ALL da API', () => {
    expect([...SUPPORTED_TIMEFRAMES]).toEqual(['5m', '15m', '1h', '4h', '1d', '1w']);
  });

  it('aceita os 6 timeframes canônicos', () => {
    for (const tf of SUPPORTED_TIMEFRAMES) expect(isSupportedTimeframe(tf)).toBe(true);
  });

  it('rejeita timeframes sem suporte ponta a ponta', () => {
    for (const tf of ['1m', '2h', '3h', '12h', '3d', '1M', '']) expect(isSupportedTimeframe(tf)).toBe(false);
  });
});
