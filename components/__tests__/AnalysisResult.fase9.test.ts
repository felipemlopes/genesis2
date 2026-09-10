/**
 * Spec genesis-v6-10-implementacao (Fase 9 — "A geometria do alvo", doc §Fase 9): itens 9.2/9.3
 * original deste arquivo — cabeçalho com R:R combinado e manchete nomeando um alvo posterior.
 *
 * Hotfix V6.11 final (spec genesis-v6-11-hotfix-final, Fase 3/4, itens P0.9/P0.10/P0.11/P0.12/
 * P0.13, 10/09/2026): o R:R combinado (item 9.2) e o apontamento de alvo posterior (item 9.3) — as
 * duas coisas que este arquivo testava — foram REMOVIDOS por decisão de produto. Reescrito para
 * provar a ausência dos dois e a chegada das mudanças do hotfix (autoridade do plano ativo,
 * seleção separada de confirmação, entry_notes do Plano A). Sem @testing-library/react — mesmo
 * padrão de asserção sobre texto-fonte do resto da suíte.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../AnalysisResult.tsx'),
  'utf-8',
);

describe('AnalysisResult — hotfix V6.11 final, item P0.10: R:R combinado removido', () => {
  it('BlocoConviccaoQualidade não recebe mais nenhuma prop de R:R combinado', () => {
    expect(fonte).not.toContain('rrExibir=');
    expect(fonte).not.toContain('rr_liquido_combinado');
    expect(fonte).not.toContain('parciais_alvo');
    expect(fonte).not.toContain('parciaisAlvo=');
  });

  it('BlocoConviccaoQualidade recebe só fatores e direcao', () => {
    const chamada = fonte.slice(fonte.indexOf('<BlocoConviccaoQualidade'), fonte.indexOf('/>', fonte.indexOf('<BlocoConviccaoQualidade')));
    expect(chamada).toContain('fatores=');
    expect(chamada).toContain('direcao=');
    expect(chamada).not.toContain('rrMinimo');
    expect(chamada).not.toContain('rrBrutoExibir');
  });
});

describe('AnalysisResult — hotfix V6.11 final, item P0.11: nenhum alvo posterior é nomeado', () => {
  it('manchetePlano não recebe mais alvoQueAtende nem R:R combinado como parâmetro', () => {
    expect(fonte).toMatch(/const manchetePlano = \(\): string =>/);
  });

  it('a manchete não cita "Plano atende o" nem "risco-retorno combinado"', () => {
    expect(fonte).not.toContain('Plano atende o');
    expect(fonte).not.toContain('risco-retorno combinado');
  });

  it('alvoQueAtendeAtivo e rrLiquidoCombinadoExibirAtivo não existem mais como declaração (só em comentário histórico)', () => {
    expect(fonte).not.toMatch(/const alvoQueAtendeAtivo/);
    expect(fonte).not.toMatch(/const rrLiquidoCombinadoExibirAtivo/);
  });
});

describe('AnalysisResult — hotfix V6.11 final, item P0.12: autoridade do plano ativo', () => {
  it('a resolução de planoAtivo nunca cai num fallback cruzado (planos[0] ou o outro plano)', () => {
    const resolucao = fonte.slice(fonte.indexOf('const planos = Array.isArray'), fonte.indexOf('const tickDecimals'));
    expect(resolucao).not.toContain("|| planos.find((p) => p.plano === 'A')");
    expect(resolucao).not.toContain('|| planos[0]');
    expect(resolucao).toContain("const planoAtivo = zonaEfetiva === 'B' ? planoBDados : planoADados;");
  });

  it('cada plano é resolvido isoladamente, com legacyMode explícito pro formato cacheado antigo', () => {
    expect(fonte).toContain('const legacyMode = planos.length === 0;');
    expect(fonte).toContain("const planoADados = planos.find((p) => p.plano === 'A') ?? (legacyMode ? setup : null);");
  });

  it('campos operacionais do plano ativo não caem mais em candidate_setup como segunda fonte', () => {
    // Os únicos usos de `setup` remanescentes são: a declaração, o gate `{setup && (`, e o
    // fallback de legacyMode dentro de planoADados — nunca um `??` cruzado tipo
    // `planoAtivo?.campo ?? setup.campo` (o padrão que causava a mistura A/B).
    expect(fonte).not.toMatch(/planoAtivo\?\.\w+ \?\? setup/);
  });

  it('invalidação/recomendação não caem mais no fallback de execution (sempre do Plano A)', () => {
    expect(fonte).not.toContain('execution.zonaInteresse?.invalidacao_direcao');
    expect(fonte).not.toContain('execution.zonaInteresse?.invalidacao_nivel');
    expect(fonte).not.toMatch(/planoAtivo\?\.recommended \?\? execution\.recommended/);
    expect(fonte).not.toMatch(/planoAtivo\?\.motivo \?\? execution\.motivo/);
  });
});

describe('AnalysisResult — hotfix V6.11 final, item P0.13: seleção separada de confirmação', () => {
  it('podeInteragir deu lugar a podeSelecionarPlano/podeConfirmarPosicao', () => {
    expect(fonte).toContain('const podeSelecionarPlano = execution.action !== null;');
    expect(fonte).toContain('const podeConfirmarPosicao = podeSelecionarPlano && planoAtivoCompleto && gatilhoBPronto;');
  });

  it('os botões de A/B usam podeSelecionarPlano, não podeConfirmarPosicao', () => {
    const botaoA = fonte.slice(fonte.indexOf("{/* Plano A */}"), fonte.indexOf("{/* Plano B"));
    expect(botaoA).toContain('disabled={!podeSelecionarPlano}');
    expect(botaoA).not.toContain('podeConfirmarPosicao');
  });

  it('o botão de confirmação usa podeConfirmarPosicao, não mais o antigo podeInteragir', () => {
    const botaoConfirmar = fonte.slice(fonte.indexOf('Botão de Confirmação'), fonte.indexOf('confirmar-alerta') + 200);
    expect(botaoConfirmar).toContain('disabled={!podeConfirmarPosicao}');
    expect(botaoConfirmar).not.toContain('podeInteragir');
    // podeInteragir só sobrevive em comentários históricos explicando a renomeação — nunca mais
    // como identificador declarado ou usado em JSX (`={!podeInteragir}`, `{podeInteragir &&`).
    expect(fonte).not.toMatch(/const podeInteragir/);
    expect(fonte).not.toMatch(/[{=]!?podeInteragir\b/);
  });

  it('gatilhoBPronto exige o trigger do Plano B ATINGIDO, lido de planoBDados (planos[]), nunca do objeto planoB bruto', () => {
    expect(fonte).toContain("const gatilhoBPronto = zonaEfetiva !== 'B' || planoBDados?.trigger?.estado === 'ATINGIDO';");
  });
});

describe('AnalysisResult — hotfix V6.11 final, item P0.9: entry_notes do Plano A', () => {
  it('o card do Plano A renderiza entry_notes quando presente', () => {
    expect(fonte).toContain('planoADados?.entry_notes &&');
    expect(fonte).toContain('{publicText(planoADados.entry_notes)}');
  });
});
