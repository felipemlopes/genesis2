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

  // A9 (V6.9): derivatives_confirmation saiu de score_basis (virou resposta da ETAPA 2, separada,
  // que nunca decide direção) — o bloco Derivativos passa a ler derivatives_context.strength.
  it('bloco derivativos le derivatives_context.strength, nao mais score_basis.derivatives_confirmation', () => {
    expect(fonte).not.toContain('derivatives_confirmation');
    expect(fonte).toContain('derivativesContext');
    expect(fonte).toContain('STRENGTH_LABEL');
  });

  it('publica os rótulos categóricos em português para technical_coherence', () => {
    expect(fonte).toContain("VERY_LOW: 'Muito baixa'");
    expect(fonte).toContain("HIGH: 'Alta'");
  });

  it('Macro e Sentimento continuam com barra numérica (o percentual ali é real, não inventado)', () => {
    expect(fonte).toContain('BlocoNumerico nome="Macro e Geopolítico"');
    expect(fonte).toContain('BlocoNumerico nome="Sentimento"');
  });

  // A7 (V6.9): Qualidade dos Dados sai da fileira — vira a nota de cobertura do rodapé (G5,
  // Fase 7). A fileira passa a ser só Técnico, Derivativos, Macro e Geopolítico, Sentimento.
  it('não renderiza mais o card Qualidade dos Dados na fileira', () => {
    expect(fonte).not.toContain('nome="Qualidade dos Dados"');
    expect(fonte).not.toContain('DATA_QUALITY_LABEL');
  });

  it('fileira usa 4 colunas (Técnico, Derivativos, Macro e Geopolítico, Sentimento)', () => {
    expect(fonte).toContain('lg:grid-cols-4');
  });
});
