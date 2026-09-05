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

// Spec genesis-v6-10-implementacao (Fase 5, item 5.1/5.4, doc §5.3): G13 (acima) garantia que
// ALGUM plano ficasse pré-selecionado (antes dela, nada era — bug real). Esta fase substitui o
// hardcode em 'A' pelo plano que a IA de fato declarou como primário (`plano_primario`, novo campo
// do contrato) — G13 continua satisfeita (sempre há um plano efetivamente selecionado,
// `zonaEfetiva`), só o valor padrão deixou de ser sempre A.
describe('AnalysisResult — Fase 5 plano primário declarado pela IA', () => {
  it('selectedZone inicia em null — sem escolha explícita do membro ainda', () => {
    expect(fonte).toContain(`useState<'A' | 'B' | null>(null)`);
  });

  it('reset ao trocar de análise volta pra null, nunca herda escolha da análise anterior', () => {
    expect(fonte).toContain('setSelectedZone(null)');
  });

  it('zonaEfetiva cai no plano primário declarado pela IA quando não há escolha explícita', () => {
    expect(fonte).toContain("const zonaEfetiva: 'A' | 'B' = selectedZone ?? planoPrimario;");
    expect(fonte).toContain("execution.plano_primario === 'B' ? 'B' : 'A'");
  });
});
