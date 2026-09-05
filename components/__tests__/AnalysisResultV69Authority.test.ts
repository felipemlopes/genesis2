/**
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 14, item 14.4, doc §19): consolida em um
 * único arquivo as 4 garantias de "fonte única de verdade" do contrato V6.9 — cada uma já
 * implementada em fases anteriores desta mesma spec (referenciadas no docblock de cada teste), sem
 * `@testing-library/react` (mesmo padrão de asserção sobre texto-fonte de todo o resto da suíte
 * deste projeto).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Remove comentários antes de buscar (mesma técnica de forbiddenProductionCode.test.ts, Fase 14
// item 14.3) — vários arquivos aqui documentam em prosa histórica exatamente os nomes que este
// teste procura ("fetchMacroToday/fetchSentimento apagados", "o mesmo faixaDeConviccao()"),
// colidindo com uma busca ingênua de string nua.
const semComentarios = (conteudo: string): string =>
  conteudo
    .split('\n')
    .map((linha) => {
      const semEspaco = linha.trimStart();
      if (semEspaco.startsWith('*') || semEspaco.startsWith('//')) return '';
      const posComentario = linha.indexOf('//');
      return posComentario !== -1 ? linha.slice(0, posComentario) : linha;
    })
    .join('\n');

const analysisResultFonte = semComentarios(readFileSync(resolve(__dirname, '../AnalysisResult.tsx'), 'utf-8'));
const geminiServiceFonte = semComentarios(readFileSync(resolve(__dirname, '../../services/geminiService.ts'), 'utf-8'));
const blocoConviccaoFonte = semComentarios(readFileSync(resolve(__dirname, '../BlocoConviccaoQualidade.tsx'), 'utf-8'));

describe('AnalysisResultV69Authority — pipeline síncrono, uma única verdade persistida', () => {
  // Fase 11, item 11.5: macroGovernanceCache/sentimentCache/fetchMacroToday/fetchSentimento
  // apagados — a tela nunca mais sobrescreve o payload já persistido com uma chamada paralela.
  it('nunca consulta macro/sentimento em paralelo depois da análise já pronta', () => {
    expect(geminiServiceFonte).not.toContain('fetchMacroToday');
    expect(geminiServiceFonte).not.toContain('fetchSentimento');
    expect(geminiServiceFonte).not.toContain('macroGovernanceCache');
    expect(geminiServiceFonte).not.toContain('sentimentCache');
  });

  // Spec genesis-v6-10-implementacao (Fase 5, item 5.1/5.4, doc §5.3): o Plano A deixou de ser
  // sempre o ponto de partida hardcoded — a IA declara qual plano (A ou B) é o primário
  // (plano_primario), e é ELE que vem pré-selecionado, não sempre A. `selectedZone` (a escolha
  // EXPLÍCITA do membro) inicia em null; `zonaEfetiva` (o que a tela efetivamente mostra) cai no
  // primário declarado. Plano A continua existindo e clicável, só não é mais o padrão fixo.
  it('plano primário declarado pela IA vem pré-selecionado, não sempre o Plano A', () => {
    expect(analysisResultFonte).toMatch(/useState<'A' \| 'B' \| null>\(null\)/);
    expect(analysisResultFonte).toContain("zonaEfetiva: 'A' | 'B' = selectedZone ?? planoPrimario");
  });

  // Fase 11, item 11.8: rrPorAlvo vem pronto do backend (ExecucaoService::calcularRrPorAlvo()) —
  // calcularRiscoRetornoAlvo() (cálculo local antigo) apagado, utils/riscoRetorno.ts não existe mais.
  it('nunca recalcula risco-retorno no cliente', () => {
    expect(analysisResultFonte).not.toContain('calcularRiscoRetornoAlvo');
    expect(analysisResultFonte).not.toContain("from '../utils/riscoRetorno'");
  });

  // Liquidação (candidate_setup.liquidacao / planoAtivo.liquidacao) sempre lida direto do payload
  // — nunca existiu (e não deveria existir) uma função local de cálculo de preço de liquidação
  // aqui (a fórmula real, com bracket de alavancagem/manutenção, vive só no backend —
  // ExecucaoService/MotorExecucaoService).
  it('nunca recalcula preço de liquidação no cliente', () => {
    expect(analysisResultFonte).not.toContain('calcularLiquidacao');
    expect(analysisResultFonte).not.toContain('calculateLiquidationPrice');
  });

  // Fase 11, item 11.11: a coluna Convicção saiu de BlocoConviccaoQualidade.tsx — era repetição
  // exata do número em letra garrafal no topo de AnalysisResult.tsx (mesmo faixaDeConviccao()).
  it('convicção não é duplicada em BlocoConviccaoQualidade — aparece só uma vez, no topo', () => {
    expect(blocoConviccaoFonte).not.toContain('faixaDeConviccao');
    expect(blocoConviccaoFonte).not.toContain('score: number | null');
    const ocorrenciasFaixaDeConviccaoNaTelaPrincipal = (analysisResultFonte.match(/faixaDeConviccao\(/g) ?? []).length;
    expect(ocorrenciasFaixaDeConviccaoNaTelaPrincipal).toBe(1);
  });
});
