/**
 * E1 (V6.9, spec genesis-v6-9-correcao-completa, Fase 6): "Pontos que pesam contra esta leitura" —
 * bloco novo abaixo da Análise Técnica, mostrando as contradições objetivas que já custaram pontos
 * reais do score final (DirectionCoherenceGate, backend). Sem `@testing-library/react` neste
 * projeto — mesmo padrão de asserção sobre texto-fonte de `ScoreBasisBars.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../AnalysisResult.tsx'),
  'utf-8',
);

describe('AnalysisResult — bloco de contradições objetivas (E1)', () => {
  it('renderiza o título "Pontos que pesam contra esta leitura"', () => {
    expect(fonte).toContain('Pontos que pesam contra esta leitura');
  });

  it('só renderiza quando existe ao menos uma contradição', () => {
    expect(fonte).toContain('(anyData.contradicoes ?? []).length > 0');
  });

  it('lista o detalhe de cada contradição, não só a contagem', () => {
    expect(fonte).toContain('c.detalhe');
  });
});
