import React from 'react';

/**
 * Restauração pós-entrega (2026-07-27): recria o layout de blocos (Técnico/Derivativos/Macro/
 * Sentimento) que a tela sempre mostrou, mas sem recalcular nada em paralelo ao decisor único —
 * cada barra lê um dado que o Gemini (ou a chamada auxiliar de narrativa, já separada do decisor)
 * já devolve pronto:
 *   - Técnico: score_basis.technical_coherence (nível de confiança do próprio decisor na leitura
 *     técnica) — mede coerência, não direção, por isso nunca muda de cor com LONG/SHORT.
 *   - Derivativos: derivatives_context.strength (V6.9, A9: saiu de score_basis — passou a ser
 *     resposta da ETAPA 2, chamada separada que nunca decide direção, ver GenesisDecisionStage2Schema
 *     no backend), que já tem polaridade própria (apoia/contraria a direção escolhida).
 *   - Qualidade dos Dados: score_basis.data_quality (V6.8, ver nota abaixo).
 *   - Macro / Sentimento: score 0-100 da chamada de narrativa (InformativeNarrativeService),
 *     puramente informativo (ver V6.6 F06 abaixo) — nunca comparado com a direção escolhida.
 *
 * V6.5 (G08): antes cada barra usava uma gramática de cor diferente — Técnico pela direção (vermelho
 * só por ser SHORT, não por ser ruim), Derivativos pela polaridade real, Macro/Sentimento pelo valor
 * bruto (verde se >55, independente da direção escolhida). Um SHORT com macro altista aparecia com 1
 * barra vermelha e 3 verdes, como se 3 dados confirmassem a operação — a tela afirmava visualmente o
 * oposto do que os dados diziam.
 *
 * V6.6 (F06): a correção G08 acima tinha resolvido só metade do problema — trocou a cor de Macro/
 * Sentimento de "valor bruto" pra "apoia a direção escolhida" (apoiaSe/COR[macroApoio] antigos),
 * mas pela DP-06 macro e sentimento são informativos e NUNCA interferem na decisão, então nem
 * deveriam ter polaridade em relação à direção nenhuma. Caso real, BTCUSDT 01/08/2026: barra de
 * Macro em verde, "Contexto favorece a leitura", numa operação SHORT, em cima de texto macro de
 * viés altista — contradição visual direta com o próprio texto logo abaixo. Macro e Sentimento
 * agora usam a mesma cor neutra do bloco Técnico (mede algo, não julga direção) e legenda sem
 * nenhuma comparação com LONG/SHORT. Restrição (DP-06): os blocos de sentimento do ativo e de
 * macro/geopolítico (texto completo, em outro componente) não mudam em conteúdo — só esta barra de
 * resumo.
 *
 * V6.8 (spec genesis-v6-8-correcao-tecnica, Fase 7, CODE-P1-09, 14/08/2026): dois achados reais.
 * 1) Técnico/Derivativos usavam um mapa fixo (VERY_LOW:20…VERY_HIGH:100) inventado pra desenhar uma
 *    barra de progresso — o decisor nunca devolveu um número aí, só uma categoria. A barra sugeria
 *    precisão (68% vs 72%) que os dados não têm. Substituído por um selo categórico (o próprio
 *    rótulo, ex. "ALTA"), sem simular um percentual que não existe — mesmo princípio já aplicado ao
 *    bloco de Derivativos em `AnalysisResult.tsx` (Fase 7 também) e às barras de qualidade de
 *    entrada (`BlocoConviccaoQualidade`, sem nota composta nem % inventado, ver G15).
 * 2) `score_basis.data_quality` (existe desde `CODE-P0-07`/Fase 4.5 deste spec) nunca era lido aqui
 *    — terceiro bloco "que soma da tela" citado no plano. Adicionado como bloco próprio, mesmo
 *    tratamento categórico dos outros dois (nunca comparado com LONG/SHORT, mede qualidade dos
 *    dados de entrada, não a direção).
 * Macro/Sentimento continuam com barra numérica — ali o número (0-100) é real, vem da própria
 * chamada de narrativa, não é um mapa inventado por este componente.
 */

type TechnicalCoherence = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | undefined;
type DerivativesStrength = 'WEAKENS' | 'NEUTRAL' | 'STRENGTHENS' | 'UNAVAILABLE' | undefined;

const COHERENCE_LABEL: Record<string, string> = {
  VERY_LOW: 'Muito baixa', LOW: 'Baixa', MODERATE: 'Moderada', HIGH: 'Alta', VERY_HIGH: 'Muito alta',
};

const STRENGTH_LABEL: Record<string, string> = {
  WEAKENS: 'Enfraquece', NEUTRAL: 'Neutro', STRENGTHENS: 'Reforça',
};

type Apoio = 'apoia' | 'contraria' | 'neutro';

const COR: Record<Apoio, { texto: string; fundo: string; barra: string }> = {
  apoia: { texto: 'text-genesis-positive', fundo: 'bg-genesis-positive/10', barra: 'bg-genesis-positive' },
  contraria: { texto: 'text-genesis-negative', fundo: 'bg-genesis-negative/10', barra: 'bg-genesis-negative' },
  neutro: { texto: 'text-purple-400', fundo: 'bg-purple-500/10', barra: 'bg-purple-500' },
};

interface Props {
  scoreBasis?: { technical_coherence?: string; data_quality?: string } | null;
  derivativesContext?: { strength?: string } | null;
  direction: 'LONG' | 'SHORT' | 'INDISPONIVEL';
  macroScore: number | null;
  sentimentScore: number | null;
}

// Bloco categórico — selo com o rótulo, sem simular um percentual que o decisor nunca devolveu.
const BlocoCategorico: React.FC<{ nome: string; rotulo: string; apoio: Apoio; legenda: string }> = ({ nome, rotulo, apoio, legenda }) => (
  <div className="bg-black/40 rounded p-3 border border-white/[0.05]">
    <div className="flex justify-between items-center mb-2">
      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{nome}</span>
      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${COR[apoio].texto} ${COR[apoio].fundo}`}>{rotulo}</span>
    </div>
    <p className="text-[8px] text-gray-500 mt-1">{legenda}</p>
  </div>
);

// Bloco numérico — só pros dois casos (Macro/Sentimento) onde o percentual é um dado real, não
// inventado por este componente.
const BlocoNumerico: React.FC<{ nome: string; pct: number; legenda: string }> = ({ nome, pct, legenda }) => (
  <div className="bg-black/40 rounded p-3 border border-white/[0.05]">
    <div className="flex justify-between items-center mb-2">
      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{nome}</span>
    </div>
    <div className="relative w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full ${COR.neutro.barra}`} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
    </div>
    <p className="text-[8px] text-gray-500 mt-1">{legenda}</p>
  </div>
);

const ScoreBasisBars: React.FC<Props> = ({ scoreBasis, derivativesContext, macroScore, sentimentScore }) => {
  if (!scoreBasis && !derivativesContext && macroScore == null && sentimentScore == null) return null;

  const coherence = scoreBasis?.technical_coherence as TechnicalCoherence;
  const strength = derivativesContext?.strength as DerivativesStrength;
  const derivativosApoio: Apoio = strength === 'WEAKENS' ? 'contraria'
    : strength === 'STRENGTHENS' ? 'apoia'
    : 'neutro';
  const derivativosLegenda = strength === 'WEAKENS' ? 'Contraria a leitura'
    : strength === 'STRENGTHENS' ? 'Apoia a leitura'
    : 'Neutro em relação à leitura';

  // A7 (V6.9): Qualidade dos Dados sai da fileira — vira a nota de cobertura do rodapé (G5,
  // Fase 7). A fileira passa a ser Técnico, Derivativos, Macro e Geopolítico, Sentimento.
  // Grade ajustada de 5 pra 4 colunas — com Macro/Sentimento agora preenchidos pelo A2, a
  // fileira de 4 fica cheia em vez de deixar um item sozinho na segunda linha.
  // V6.6 (F06, DP-06): Macro e Sentimento são informativos — nunca comparados com a direção
  // escolhida (LONG/SHORT). Mesma cor neutra do bloco Técnico, legenda sem "favorece"/"contraria".
  return (
    <div className="mb-5 relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {coherence && (
        <BlocoCategorico nome="Técnico" rotulo={COHERENCE_LABEL[coherence] ?? coherence} apoio="neutro" legenda="Coerência dos indicadores com a leitura" />
      )}
      {strength && strength !== 'UNAVAILABLE' && (
        <BlocoCategorico nome="Derivativos" rotulo={STRENGTH_LABEL[strength] ?? strength} apoio={derivativosApoio} legenda={derivativosLegenda} />
      )}
      {macroScore != null && (
        <BlocoNumerico nome="Macro e Geopolítico" pct={macroScore} legenda="Contexto macro/geopolítico — informativo" />
      )}
      {sentimentScore != null && (
        <BlocoNumerico nome="Sentimento" pct={sentimentScore} legenda="Sentimento do ativo — informativo" />
      )}
    </div>
  );
};

export default ScoreBasisBars;
