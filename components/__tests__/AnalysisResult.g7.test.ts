/**
 * G7 (V6.9, spec genesis-v6-9-correcao-completa, Fase 7): códigos/termos em inglês saem da tela —
 * bias de tempo maior (BULLISH/BEARISH/MIXED), sessão de mercado (ASIA/LONDON/NEW_YORK/OVERNIGHT)
 * e o rótulo de squeeze (long/short squeeze) chegavam crus do backend. Sem
 * `@testing-library/react` neste projeto — mesmo padrão de asserção sobre texto-fonte já usado em
 * `ScoreBasisBars.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../AnalysisResult.tsx'),
  'utf-8',
);

describe('AnalysisResult — dicionários de exibição PT-BR (G7)', () => {
  it('traduz o bias de tempo maior em vez de mostrar BULLISH/BEARISH cru', () => {
    expect(fonte).toContain('BIAS_LABEL');
    expect(fonte).toContain("BULLISH: 'ALTA'");
    expect(fonte).toContain('{BIAS_LABEL[tf.bias]');
  });

  it('traduz o nome da sessão de mercado', () => {
    expect(fonte).toContain('SESSAO_LABEL');
    expect(fonte).toContain("NEW_YORK: 'Nova York'");
  });

  it('não mostra mais "long squeeze"/"short squeeze" em inglês', () => {
    expect(fonte).not.toContain("'long squeeze'");
    expect(fonte).not.toContain("'short squeeze'");
    expect(fonte).toContain('squeeze de comprados');
    expect(fonte).toContain('squeeze de vendidos');
  });
});
