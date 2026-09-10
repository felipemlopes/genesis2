/**
 * Hotfix V6.11 final (spec genesis-v6-11-hotfix-final, Fase 3, item P0.10, 10/09/2026): a coluna
 * "Risco e retorno" (R:R combinado dos três alvos, bruto/líquido, esquema de parciais) foi
 * REMOVIDA por completo deste componente — decisão de produto. Este arquivo testava exatamente
 * esse bloco (bruto x líquido, legenda "combinado, líquido", esquema de parciais); reescrito para
 * provar a ausência dele e que o componente volta a ser só sobre Qualidade da entrada.
 * Sem `@testing-library/react` neste projeto — mesmo padrão de asserção sobre texto-fonte do
 * resto da suíte.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../BlocoConviccaoQualidade.tsx'),
  'utf-8',
);

describe('BlocoConviccaoQualidade — bloco de risco e retorno removido (P0.10)', () => {
  it('não recebe mais nenhuma prop de R:R', () => {
    expect(fonte).not.toContain('rrExibir');
    expect(fonte).not.toContain('rrBrutoExibir');
    expect(fonte).not.toContain('rrMinimo');
    expect(fonte).not.toContain('rrAbaixoDoMinimo');
  });

  it('não referencia mais o esquema de parciais', () => {
    expect(fonte).not.toContain('parciaisAlvo');
    expect(fonte).not.toContain('formatarEsquemaDeParciais');
    expect(fonte).not.toContain('parciais_alvo');
  });

  it('a legenda "combinado, líquido" não existe mais', () => {
    expect(fonte).not.toContain('combinado, líquido');
  });

  it('o aviso de R/R abaixo do mínimo não existe mais neste bloco', () => {
    expect(fonte).not.toContain('cuidado, risco retorno abaixo do recomendado');
  });

  it('Props só tem fatores e direcao', () => {
    const inicio = fonte.indexOf('interface Props');
    const fim = fonte.indexOf('}', inicio);
    const bloco = fonte.slice(inicio, fim);
    expect(bloco).toContain('fatores: FatorQualidadeEntrada[]');
    expect(bloco).toContain("direcao: 'LONG' | 'SHORT'");
    expect(bloco).not.toContain('rr');
  });
});
