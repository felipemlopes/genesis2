/**
 * G5 (V6.9, spec genesis-v6-9-correcao-completa, Fase 7): nota de rastreabilidade sempre visível
 * — substitui o card "Qualidade dos Dados" removido no A7. Sem `@testing-library/react` — mesmo
 * padrão de asserção sobre texto-fonte.
 *
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.14, doc §18): `nota_cobertura`
 * (número solto, morava no card de convicção) substituída por `data_traceability` (objeto
 * completo — cobertura de decisão + frescor real por fonte), migrada pro rodapé. Asserções
 * atualizadas para o novo nome/local.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../AnalysisResult.tsx'),
  'utf-8',
);

describe('AnalysisResult — rastreabilidade de dados no rodapé (item 13.14)', () => {
  it('lê data_traceability, não mais nota_cobertura', () => {
    expect(fonte).toContain('analysis.data_traceability');
    expect(fonte).not.toContain('nota_cobertura');
  });

  it('o bloco de rastreabilidade fica fora do card de convicção — depois do grid de showIndicators', () => {
    const indiceConviccaoModelo = fonte.indexOf('Convicção do Modelo');
    const indiceDataTraceability = fonte.indexOf('{dataTraceability &&');
    expect(indiceConviccaoModelo).toBeGreaterThan(-1);
    expect(indiceDataTraceability).toBeGreaterThan(-1);
    expect(indiceDataTraceability).toBeGreaterThan(indiceConviccaoModelo);
  });

  it('exibe cobertura de decisão e frescor das fontes, nunca só um número solto', () => {
    expect(fonte).toContain('dataTraceability.decision_coverage_percent');
    expect(fonte).toContain('dataTraceability.freshness_coverage_percent');
    expect(fonte).toContain('dataTraceability.fresh_sources');
    expect(fonte).toContain('dataTraceability.expected_sources');
  });
});
