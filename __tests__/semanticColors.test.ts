import { describe, it, expect } from 'vitest';
import { directionTone, relationTone, directionToneFromValue } from '../utils/semanticColors';

/**
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.8, doc §18).
 */
describe('semanticColors — directionTone vs relationTone nunca se misturam', () => {
  it('directionTone usa verde/vermelho, nunca roxo/âmbar', () => {
    expect(directionTone('positive').texto).toContain('genesis-positive');
    expect(directionTone('negative').texto).toContain('genesis-negative');
    expect(directionTone('positive').texto).not.toContain('purple');
    expect(directionTone('negative').texto).not.toContain('amber');
  });

  it('relationTone usa roxo/âmbar/cinza, nunca verde/vermelho', () => {
    expect(relationTone('normal').texto).toContain('purple');
    expect(relationTone('atencao').texto).toContain('amber');
    expect(relationTone('indisponivel').texto).toContain('gray');
    expect(relationTone('normal').texto).not.toContain('genesis-positive');
    expect(relationTone('atencao').texto).not.toContain('genesis-negative');
  });

  it('directionToneFromValue deriva o tom a partir do sinal do número', () => {
    expect(directionToneFromValue(5)).toBe('positive');
    expect(directionToneFromValue(-5)).toBe('negative');
    expect(directionToneFromValue(0)).toBe('neutral');
    expect(directionToneFromValue(null)).toBe('neutral');
    expect(directionToneFromValue(undefined)).toBe('neutral');
  });
});
