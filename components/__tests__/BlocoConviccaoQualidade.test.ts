/**
 * V6.8 (CODE-P1-11, spec genesis-v6-8-correcao-tecnica) — a nota de custos ("não considera taxas,
 * spread e slippage") migrou da legenda do líquido para a do bruto. Determinação do PO: nenhuma
 * mudança de layout/hierarquia/cor/ordem — só duas linhas de legenda trocando de lugar. Sem
 * `@testing-library/react` neste projeto (nenhum outro componente é renderizado em teste, ver
 * `services/__tests__/integration.e2e.test.ts` para o mesmo padrão de asserção sobre texto-fonte),
 * este teste confere o arquivo-fonte diretamente — é exatamente o critério de aceite literal do
 * manual do PO (`grep -c "líquido (taxas" ... retorna 0`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../BlocoConviccaoQualidade.tsx'),
  'utf-8',
);

describe('BlocoConviccaoQualidade — bloco de risco e retorno (bruto x líquido)', () => {
  it('a nota de custos não está mais na legenda do líquido', () => {
    expect(fonte).not.toContain('líquido (taxas');
  });

  it('a nota de custos está na legenda do bruto', () => {
    expect(fonte).toContain('bruto (não considera taxas, spread e slippage)');
  });

  it('a legenda do líquido ficou só com a palavra "líquido"', () => {
    expect(fonte).toContain('<span className="text-[9px] text-gray-500">líquido</span>');
  });

  it('o aviso de R/R abaixo do mínimo continua no mesmo lugar (fallback não mudou)', () => {
    expect(fonte).toContain('cuidado, risco retorno abaixo do recomendado');
  });

  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.7, doc §18): rr/rrBruto
  // (número) viraram rrExibir/rrBrutoExibir (string pronta do backend) — asserção atualizada pro
  // novo nome de prop, mesmo critério de ordem (bruto antes do líquido no JSX).
  it('layout, ordem e classes do bloco não mudaram — bruto continua antes do líquido no JSX', () => {
    const indiceBruto = fonte.indexOf('rrBrutoExibir != null');
    const indiceLiquido = fonte.indexOf('{rrExibir != null && (');
    expect(indiceBruto).toBeGreaterThan(-1);
    expect(indiceLiquido).toBeGreaterThan(-1);
    expect(indiceBruto).toBeLessThan(indiceLiquido);
  });
});
