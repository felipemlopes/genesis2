/**
 * Spec genesis-v6-10-implementacao (Fase 9 — "A geometria do alvo", doc §Fase 9): itens 9.2/9.3
 * (o item 9.1 é 100% backend, coberto em CanonicalBundleBuilderRrProvisorioTest/
 * GenesisPromptRrProvisorioTest no lado PHP). Sem @testing-library/react — mesmo padrão de
 * asserção sobre texto-fonte do resto da suíte.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../AnalysisResult.tsx'),
  'utf-8',
);

describe('AnalysisResult — Fase 9, item 9.2: cabeçalho usa o R:R combinado', () => {
  it('BlocoConviccaoQualidade recebe rr_liquido_combinado_exibir, não mais rr_liquido_exibir (TP1)', () => {
    expect(fonte).toContain('rrExibir={planoAtivo?.rr_liquido_combinado_exibir ?? setup?.rr_liquido_combinado_exibir ?? null}');
  });

  it('o aviso de abaixo do mínimo compara o mesmo número combinado, nunca o TP1 isolado', () => {
    expect(fonte).toContain('rrAbaixoDoMinimo={planoAtivo?.rr_liquido_combinado_abaixo_do_minimo ?? setup?.rr_liquido_combinado_abaixo_do_minimo ?? false}');
  });

  it('o esquema de parciais é passado pro componente exibir', () => {
    expect(fonte).toContain('parciaisAlvo={planoAtivo?.parciais_alvo ?? setup?.parciais_alvo ?? null}');
  });
});

describe('AnalysisResult — Fase 9, item 9.3: rótulo descreve o plano, nunca "não recomendado"', () => {
  it('manchetePlano não usa mais o literal "Plano não recomendado"', () => {
    expect(fonte).not.toContain("'Plano não recomendado'");
  });

  it('fallback descreve o R:R combinado quando nenhum alvo isolado atinge o mínimo', () => {
    expect(fonte).toContain('Plano de risco-retorno combinado');
    expect(fonte).toContain("'Plano de risco-retorno modesto'");
  });

  it('o botão de confirmação continua ativo independente de recommendedAtivo (só avisa, nunca bloqueia)', () => {
    // podeInteragir (o que de fato habilita o botão) depende só de execution.executable/action —
    // não deve depender de recommendedAtivo em lugar nenhum do arquivo.
    expect(fonte).not.toMatch(/podeInteragir\s*=.*recommendedAtivo/);
  });
});
