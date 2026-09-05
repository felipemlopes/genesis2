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

  it('fallback genérico continua existindo (só sem o motivo interno)', () => {
    expect(fonte).toContain('"Contexto informativo indisponível para esta análise."');
  });
});

describe('AnalysisResult — Fase 6, item 6.3: disponibilidade de Macro/Sentimento olha todos os campos', () => {
  it('macroDisponivel considera score, vix, dxy, sp500 e resumo — não só o score', () => {
    expect(fonte).toContain('macroInfo?.score != null || macroInfo?.vix != null');
    expect(fonte).toContain('macroInfo?.dxy_change_pct != null || macroInfo?.sp500_change_pct != null');
    expect(fonte).toContain('!!macroInfo?.resumo');
  });

  it('sentimentDisponivel considera score, fear_greed, btc_dominance e narrativa', () => {
    expect(fonte).toContain('sentimento?.score != null || sentimento?.fear_greed != null');
    expect(fonte).toContain('sentimento?.btc_dominance != null || !!sentimento?.narrativa');
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
  it('mostra os dois lado a lado quando risco_desvio_pct existe', () => {
    expect(fonte).toContain('Risco realizado divergente do planejado');
    expect(fonte).toContain('planoAtivo?.risco_desvio_pct ?? setup.risco_desvio_pct');
    expect(fonte).toContain('planoAtivo?.risco_planejado ?? setup.risco_planejado');
    expect(fonte).toContain('planoAtivo?.risco_real ?? setup.risco_real');
  });
});
