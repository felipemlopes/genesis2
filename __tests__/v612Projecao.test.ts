/**
 * V6.12 (§5.10): alvo que vem de projeção técnica (medida de figura, altura do range) mostra a
 * etiqueta cinza "Projeção" ao lado do preço, para o membro saber que é um alvo medido e não uma
 * barreira testada. Nenhum código interno (projecao_figura/projecao_range) chega à tela.
 * Sem `@testing-library/react` neste projeto — asserção sobre o texto-fonte, mesmo padrão de
 * `AnalysisResult.g7.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ehProjecao, rotularFonte } from '../utils/rotulos';

describe('ehProjecao', () => {
  it('reconhece as duas fontes de projeção', () => {
    expect(ehProjecao('projecao_figura')).toBe(true);
    expect(ehProjecao('projecao_range')).toBe(true);
  });

  it('barreira real e borda do range não são projeção', () => {
    expect(ehProjecao('pivo_swing')).toBe(false);
    expect(ehProjecao('range_wyckoff')).toBe(false);
    expect(ehProjecao('fibonacci')).toBe(false);
    expect(ehProjecao(null)).toBe(false);
    expect(ehProjecao(undefined)).toBe(false);
  });
});

describe('rotularFonte com as fontes da V6.12', () => {
  it('traduz as projeções em vez de cair no genérico', () => {
    expect(rotularFonte('projecao_figura')).toBe('Alvo por medida da figura');
    expect(rotularFonte('projecao_range')).toBe('Projeção do range');
    expect(rotularFonte('fibonacci')).toBe('Fibonacci desenhado no gráfico');
  });
});

describe('AnalysisResult — etiqueta "Projeção" nas metas de lucro', () => {
  const fonte = readFileSync(resolve(__dirname, '../components/AnalysisResult.tsx'), 'utf-8');

  it('mostra a etiqueta nos três alvos', () => {
    for (const tp of ['tp1', 'tp2', 'tp3']) {
      expect(fonte).toContain(`ehProjecao(planoAtivo?.${tp}_fonte) && <EtiquetaProjecao />`);
    }
    expect(fonte).toContain('>Projeção</span>');
  });
});
