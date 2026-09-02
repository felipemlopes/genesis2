import { describe, it, expect } from 'vitest';
import { rotularTimeframe } from '../utils/rotulos';

/**
 * V6.9 correção técnica (spec genesis-v6-9-correcao-tecnica, item 36): "1M" (mês) cru é
 * visualmente idêntico a "1m" (minuto) depois que o CSS aplica `uppercase` nos chips de
 * confluência temporal (`AnalysisResult.tsx`). Escrito nesta sessão (2026-09-02), não é
 * transcrição do documento.
 */
describe('rotularTimeframe', () => {
  it('1M (mês, maiúsculo, valor canônico do backend) vira Mensal', () => {
    expect(rotularTimeframe('1M')).toBe('Mensal');
  });

  it('1w (semana, valor canônico do backend) vira Semanal', () => {
    expect(rotularTimeframe('1w')).toBe('Semanal');
  });

  it('1W maiúsculo também vira Semanal — semana não tem ambiguidade de capitalização', () => {
    expect(rotularTimeframe('1W')).toBe('Semanal');
  });

  it('1m minúsculo (minuto) nunca é confundido com 1M (mês) — não vira Mensal', () => {
    expect(rotularTimeframe('1m')).not.toBe('Mensal');
    expect(rotularTimeframe('1m')).toBe('1M');
  });

  it('timeframes sem ambiguidade passam só por uppercase, sem tradução', () => {
    expect(rotularTimeframe('15m')).toBe('15M');
    expect(rotularTimeframe('4h')).toBe('4H');
    expect(rotularTimeframe('1d')).toBe('1D');
  });

  it('null/undefined/vazio devolvem travessão, nunca quebram', () => {
    expect(rotularTimeframe(null)).toBe('—');
    expect(rotularTimeframe(undefined)).toBe('—');
    expect(rotularTimeframe('')).toBe('—');
  });
});
