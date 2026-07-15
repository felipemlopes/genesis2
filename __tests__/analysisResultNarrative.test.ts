import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs';
import path from 'path';

/**
 * R3.2 (genesis-cerebro-grafico-r3-2) — Adendo Seção 32: interface sem repetição.
 * Task 16.4: garantir que scoreJustification e technicalAnalysis nunca colapsem
 * para o mesmo texto quando o backend publica narrativas distintas, e que
 * `execution.motivo` nunca alimenta a justificativa do score.
 */

type Analysis = {
  score_justification?: string | null;
  justificativa_score?: string | null;
  technical_analysis?: string | null;
  narrativa_tecnica?: string | null;
};

// Duplica literalmente a lógica de components/AnalysisResult.tsx (Adendo Seção 32)
const deriveNarratives = (analysis: Analysis) => {
  const scoreJustification = analysis.score_justification ?? analysis.justificativa_score ?? null;
  const technicalAnalysis = analysis.technical_analysis ?? analysis.narrativa_tecnica ?? null;
  return { scoreJustification, technicalAnalysis };
};

describe('16.4: AnalysisResult não duplica narrativa entre justificativa do score e análise técnica', () => {
  it('property: quando o backend publica textos distintos para os dois campos, o componente nunca os colapsa', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (scoreText, technicalText) => {
          fc.pre(scoreText !== technicalText);

          const { scoreJustification, technicalAnalysis } = deriveNarratives({
            score_justification: scoreText,
            technical_analysis: technicalText,
          });

          expect(scoreJustification).toBe(scoreText);
          expect(technicalAnalysis).toBe(technicalText);
          expect(scoreJustification).not.toBe(technicalAnalysis);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('cai para os campos legados em português quando os campos em inglês estão ausentes, sem colapsar', () => {
    const { scoreJustification, technicalAnalysis } = deriveNarratives({
      justificativa_score: 'Justificativa legada do score.',
      narrativa_tecnica: 'Narrativa técnica legada.',
    });

    expect(scoreJustification).toBe('Justificativa legada do score.');
    expect(technicalAnalysis).toBe('Narrativa técnica legada.');
    expect(scoreJustification).not.toBe(technicalAnalysis);
  });

  it('nunca usa execution.motivo como fallback da justificativa do score (fonte não existe em Analysis)', () => {
    // Regressão estrutural: o tipo Analysis usado por deriveNarratives não tem
    // (e nunca deve ter) um campo `motivo` — esse dado pertence a `execution`,
    // que é um objeto irmão, não uma fonte da narrativa/justificativa.
    const result = deriveNarratives({});
    expect(result.scoreJustification).toBeNull();
    expect(result.technicalAnalysis).toBeNull();
  });

  it('AnalysisResult.tsx implementa a lógica exata do Adendo Seção 32 (sem mainRationale/execution.motivo como fallback)', () => {
    const componentPath = path.resolve(__dirname, '../components/AnalysisResult.tsx');
    const content = fs.readFileSync(componentPath, 'utf-8');

    expect(content).toContain(
      'const scoreJustification = analysis.score_justification ?? analysis.justificativa_score ?? null;'
    );
    expect(content).toContain(
      'const technicalAnalysis = analysis.technical_analysis ?? analysis.narrativa_tecnica ?? null;'
    );
    expect(content).not.toContain('mainRationale');
    expect(content).not.toMatch(/scoreJustification[\s\S]{0,40}execution\.motivo/);
  });
});
