/**
 * V6.8 (spec genesis-v6-8-correcao-tecnica, Fase 7, CODE-P1-09, 14/08/2026) — dois achados reais:
 * (1) Técnico/Derivativos usavam um mapa fixo (VERY_LOW:20…VERY_HIGH:100) pra simular um percentual
 * que o decisor nunca devolveu — trocado por um selo categórico com o próprio rótulo; (2)
 * `score_basis.data_quality` (existe desde CODE-P0-07/Fase 4.5) nunca era lido aqui — bloco novo.
 * Sem `@testing-library/react` neste projeto — mesmo padrão de asserção sobre texto-fonte de
 * `BlocoConviccaoQualidade.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../ScoreBasisBars.tsx'),
  'utf-8',
);

describe('ScoreBasisBars — selo categórico em vez de percentual inventado', () => {
  it('não usa mais o mapa fixo de percentuais para Técnico/Derivativos', () => {
    expect(fonte).not.toContain('VERY_LOW: 20');
    expect(fonte).not.toContain('COHERENCE_PCT');
    expect(fonte).not.toContain('CONFIRMATION_PCT');
  });

  it('publica os rótulos categóricos em português para technical_coherence', () => {
    expect(fonte).toContain("VERY_LOW: 'Muito baixa'");
    expect(fonte).toContain("HIGH: 'Alta'");
  });

  it('lê score_basis.data_quality e publica um bloco próprio', () => {
    expect(fonte).toContain('data_quality');
    expect(fonte).toContain('Qualidade dos Dados');
  });

  it('Macro e Sentimento continuam com barra numérica (o percentual ali é real, não inventado)', () => {
    expect(fonte).toContain('BlocoNumerico nome="Macro"');
    expect(fonte).toContain('BlocoNumerico nome="Sentimento"');
  });

  it('data_quality nunca ganha polaridade LONG/SHORT — sempre apoio "neutro" (mesma regra DP-06 de macro/sentimento)', () => {
    const indice = fonte.indexOf('nome="Qualidade dos Dados"');
    expect(indice).toBeGreaterThan(-1);
    const trecho = fonte.slice(Math.max(0, indice - 100), indice + 200);
    expect(trecho).toContain('apoio="neutro"');
  });
});
