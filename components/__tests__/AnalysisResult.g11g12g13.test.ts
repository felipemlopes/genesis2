/**
 * G11/G12/G13 (V6.9, spec genesis-v6-9-correcao-completa, Fase 7): três achados pequenos e
 * independentes na mesma tela — unidade do VIX ambígua ao lado de dois indicadores em %, Fear &
 * Greed sem faixa qualitativa, Plano A não pré-selecionado apesar do backend já publicar os dois
 * planos completos. Sem `@testing-library/react` — mesmo padrão de asserção sobre texto-fonte.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../AnalysisResult.tsx'),
  'utf-8',
);

describe('AnalysisResult — G11 unidade do VIX', () => {
  it('rotula VIX como nível e DXY/S&P 500 como variação de 24h', () => {
    expect(fonte).toContain('VIX (nível)');
    expect(fonte).toContain('DXY (var. 24h)');
    expect(fonte).toContain('S&P 500 (var. 24h)');
  });
});

describe('AnalysisResult — G12 faixa do Fear & Greed', () => {
  it('classifica o índice em faixas qualitativas PT-BR', () => {
    expect(fonte).toContain('faixaFearGreed');
    expect(fonte).toContain("'Medo extremo'");
    expect(fonte).toContain("'Ganância extrema'");
  });
});

describe('AnalysisResult — G13 Plano A pré-selecionado', () => {
  it('selectedZone inicia em "A", não null', () => {
    expect(fonte).toContain(`useState<'A' | 'B' | null>('A')`);
  });

  it('reset ao trocar de análise volta pro Plano A, não para nenhum plano', () => {
    expect(fonte).toContain("setSelectedZone('A')");
    expect(fonte).not.toContain('setSelectedZone(null)');
  });
});
