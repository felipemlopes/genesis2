/**
 * A8 (V6.9, spec genesis-v6-9-correcao-completa, Fase 7): código interno (reason_code) sai da
 * tela; manchete deixa de ser fixa "Plano não recomendado" quando um alvo posterior já atende o
 * R/R mínimo (execution.alvo_que_atende, ExecucaoService::primeiroAlvoAcimaDoMinimo() no backend).
 * Sem `@testing-library/react` — mesmo padrão de asserção sobre texto-fonte.
 *
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.9, doc §16): a fonte de
 * alvo_que_atende deixou de ser sempre execution.alvo_que_atende (implicitamente o Plano A) — vira
 * alvoQueAtendeAtivo, derivado do PLANO ATIVO (troca com A/B), com fallback pro campo legado de
 * execution só pra decisões cacheadas antes de execution.planos[] carregar o campo por plano.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../AnalysisResult.tsx'),
  'utf-8',
);

describe('AnalysisResult — manchete coerente do plano (A8)', () => {
  it('não renderiza mais execution.reason_code', () => {
    expect(fonte).not.toContain('{execution.reason_code}');
  });

  it('usa manchetePlano() em vez do título fixo', () => {
    expect(fonte).toContain('{manchetePlano(alvoQueAtendeAtivo)}');
    expect(fonte).toContain('manchetePlano = (alvoQueAtende');
    // alvoQueAtendeAtivo precisa vir do plano ativo, com fallback pro campo legado de execution —
    // nunca só execution.alvo_que_atende direto (isso reintroduziria o bug de ficar preso ao Plano A).
    expect(fonte).toMatch(/const alvoQueAtendeAtivo = planoAtivo\?\.alvo_que_atende \?\? setup\?\.alvo_que_atende \?\? execution\.alvo_que_atende;/);
  });

  it('manchetePlano nomeia o alvo quando existe, cai no título genérico quando não', () => {
    const fonteAposDef = fonte.slice(fonte.indexOf('const manchetePlano'));
    expect(fonteAposDef).toContain("`Plano atende o ${alvoQueAtende}`");
    expect(fonteAposDef).toContain("'Plano não recomendado'");
  });
});
