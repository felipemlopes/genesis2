/**
 * G5 (V6.9, spec genesis-v6-9-correcao-completa, Fase 7): nota de rastreabilidade sempre visível
 * — substitui o card "Qualidade dos Dados" removido no A7. Sem `@testing-library/react` — mesmo
 * padrão de asserção sobre texto-fonte.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../AnalysisResult.tsx'),
  'utf-8',
);

describe('AnalysisResult — nota de rastreabilidade (G5)', () => {
  it('renderiza a nota sempre que nota_cobertura está presente, não só em cobertura baixa', () => {
    expect(fonte).toContain('analysis.nota_cobertura != null');
    expect(fonte).toContain('Rastreabilidade dos dados desta leitura');
  });
});
