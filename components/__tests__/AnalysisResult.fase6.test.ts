/**
 * Spec genesis-v6-10-implementacao (Fase 6 — "Os sete achados de segunda ordem", doc §Fase 6):
 * sete achados pequenos e independentes, a maioria em AnalysisResult.tsx. Sem
 * `@testing-library/react` neste projeto — mesmo padrão de asserção sobre texto-fonte já usado no
 * resto da suíte (ex. AnalysisResult.g11g12g13.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../AnalysisResult.tsx'),
  'utf-8',
);

describe('AnalysisResult — Fase 6, item 6.1: Wyckoff cru na tela', () => {
  it('WYCKOFF_LABEL cobre as 11 fases canônicas (TechnicalAnalysisService::FASES_WYCKOFF, backend)', () => {
    const fases = [
      'MARKUP', 'MARKDOWN', 'ACUMULACAO_SPRING', 'ACUMULACAO_SC', 'ACUMULACAO_AR',
      'ACUMULACAO_ST', 'ACUMULACAO_RANGE', 'DISTRIBUICAO_UAT', 'DISTRIBUICAO_RANGE',
      'RANGE_SEM_EVENTO', 'INDETERMINADO',
    ];
    for (const fase of fases) {
      expect(fonte).toContain(`${fase}:`);
    }
  });

  it('não tem mais a entrada DISTRIBUICAO_SPRING no dicionário — não existe em FASES_WYCKOFF, nunca foi uma fase real', () => {
    expect(fonte).not.toContain('DISTRIBUICAO_SPRING:');
  });

  it('fallback usa ?? (nunca chega na chave crua), não mais || (caía na chave antes de N/A)', () => {
    expect(fonte).toContain("WYCKOFF_LABEL[anyData.wyckoff?.fase] ?? 'Fase não classificada'");
    expect(fonte).not.toContain("WYCKOFF_LABEL[anyData.wyckoff?.fase] || anyData.wyckoff?.fase || 'N/A'");
  });
});

describe('AnalysisResult — Fase 6, item 6.2: estado interno não vaza pro texto do card de Macro', () => {
  it('card de Macro não cita mais orçamento/serviço fora do ar', () => {
    expect(fonte).not.toContain('orçamento de IA esgotado ou serviço fora do ar');
  });
});

/**
 * Spec genesis-v6-11-correcao-tecnica (Fase 4, item 4.6, doc §Fase 7 do checklist): a frase fixa
 * "Contexto informativo indisponível para esta análise" saiu por completo — dado que não veio não
 * aparece (R7), nunca mais um texto genérico ao lado de VIX/DXY/S&P500 reais. Este teste EXIGIA a
 * frase (Fase 6 da V6.10, item 6.2 — "fallback genérico continua existindo") e é exatamente o
 * teste que o próprio documento da V6.11 já antecipa quebrar de propósito — reescrito pra provar a
 * regra nova, nunca contornado pra manter a frase viva.
 */
describe('AnalysisResult — Fase 4, item 4.6: sem frase fixa quando o resumo/narrativa não vem', () => {
  it('a frase fixa "Contexto informativo indisponível para esta análise" não existe mais no código', () => {
    expect(fonte).not.toContain('Contexto informativo indisponível para esta análise');
  });

  it('o parágrafo de Macro só renderiza quando publicText(macroInfo?.resumo) existe', () => {
    expect(fonte).toContain('{publicText(macroInfo?.resumo) && (');
  });

  it('o parágrafo de Sentimento só renderiza quando publicText(sentimento?.narrativa) existe', () => {
    expect(fonte).toContain('{publicText(sentimento?.narrativa) && (');
  });
});

describe('AnalysisResult — Fase 6, item 6.3: disponibilidade de Macro/Sentimento olha todos os campos', () => {
  it('macroDisponivel considera score, vix, dxy, sp500 e resumo — não só o score', () => {
    expect(fonte).toContain('macroInfo?.score != null || macroInfo?.vix != null');
    expect(fonte).toContain('macroInfo?.dxy_change_pct != null || macroInfo?.sp500_change_pct != null');
    expect(fonte).toContain('!!macroInfo?.resumo');
  });

});

/**
 * Spec genesis-v6-11-correcao-tecnica (Fase 4, item 4.8): Fear&Greed e dominância do BTC são
 * sentimento de MERCADO (card superior), não do ativo — sentimentDisponivel parou de olhar os
 * dois. Este teste (Fase 6 da V6.10, item 6.3) exigia o comportamento antigo e foi reescrito pra
 * provar o novo, não contornado.
 */
describe('AnalysisResult — Fase 4, item 4.8: sentimentDisponivel não olha mais sentimento de mercado', () => {
  it('sentimentDisponivel considera só score e narrativa do ativo', () => {
    expect(fonte).toContain('sentimentDisponivel={sentimento?.score != null || !!sentimento?.narrativa}');
  });

  // Nota: não testamos "o arquivo inteiro nunca contém sentimento?.fear_greed" — o item 4.7
  // (mesma fase) passou a usar esses mesmos campos para montar `sentimentValoresBrutos` (os
  // números brutos mostrados quando falta score), um uso legítimo e diferente da disponibilidade.
  // A asserção acima (linha exata de sentimentDisponivel) já prova o que este item pede.

  it('macroDisponivel continua olhando todos os campos de mercado, intocado por esta correção', () => {
    expect(fonte).toContain('macroInfo?.score != null || macroInfo?.vix != null');
    expect(fonte).toContain('macroInfo?.dxy_change_pct != null || macroInfo?.sp500_change_pct != null');
  });
});

describe('AnalysisResult — Fase 6, item 6.6: as três invalidações', () => {
  it('bloco antigo renomeado de "Invalidação da tese" pra "Invalidação da operação"', () => {
    expect(fonte).toContain('Invalidação da operação');
  });

  it('expõe invalidação da estrutura e da tese como linhas próprias, condicionais', () => {
    expect(fonte).toContain('invalidacaoEstruturaTexto');
    expect(fonte).toContain('invalidacaoTeseTexto');
    expect(fonte).toContain('{invalidacaoEstruturaTexto && (');
    expect(fonte).toContain('{invalidacaoTeseTexto && (');
  });

  it('lê os 4 campos novos do backend (estrutura/tese, direção + nível)', () => {
    expect(fonte).toContain('planoAtivo?.invalidacao_estrutura_direcao');
    expect(fonte).toContain('planoAtivo?.invalidacao_estrutura_nivel');
    expect(fonte).toContain('planoAtivo?.invalidacao_tese_direcao');
    expect(fonte).toContain('planoAtivo?.invalidacao_tese_nivel');
  });
});

describe('AnalysisResult — Fase 6, item 6.7: risco realizado divergente do planejado', () => {
  // Hotfix V6.11 final (spec genesis-v6-11-hotfix-final, Fase 4, item P0.12, 10/09/2026): o
  // fallback `?? setup.campo` foi removido — planoAtivo já resolve pra candidate_setup sozinho no
  // caso legado (legacyMode), então um segundo fallback aqui só reabriria a mistura A/B que P0.12
  // elimina.
  it('mostra os dois lado a lado quando risco_desvio_pct existe', () => {
    expect(fonte).toContain('Risco realizado divergente do planejado');
    expect(fonte).toContain('planoAtivo?.risco_desvio_pct');
    expect(fonte).toContain('planoAtivo?.risco_planejado');
    expect(fonte).toContain('planoAtivo?.risco_real');
    expect(fonte).not.toMatch(/planoAtivo\?\.risco_desvio_pct \?\? setup/);
  });
});
