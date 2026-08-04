import React from 'react';

/**
 * Restauração pós-entrega (2026-07-27): recria o layout de 4 blocos (Técnico/Derivativos/Macro/
 * Sentimento) que a tela sempre mostrou, mas sem recalcular nada em paralelo ao decisor único —
 * cada barra lê um dado que o Gemini (ou a chamada auxiliar de narrativa, já separada do decisor)
 * já devolve pronto:
 *   - Técnico: score_basis.technical_coherence (nível de confiança do próprio decisor na leitura
 *     técnica) — mede coerência, não direção, por isso nunca muda de cor com LONG/SHORT.
 *   - Derivativos: score_basis.derivatives_confirmation, que já tem polaridade própria
 *     (apoia/contraria a direção escolhida).
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
 */

type TechnicalCoherence = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | undefined;
type DerivativesConfirmation = 'OPPOSES' | 'NEUTRAL' | 'SUPPORTS' | 'STRONGLY_SUPPORTS' | 'UNAVAILABLE' | undefined;

const COHERENCE_PCT: Record<string, number> = {
  VERY_LOW: 20, LOW: 40, MODERATE: 60, HIGH: 80, VERY_HIGH: 100,
};

const CONFIRMATION_PCT: Record<string, number> = {
  OPPOSES: 25, NEUTRAL: 50, SUPPORTS: 75, STRONGLY_SUPPORTS: 100, UNAVAILABLE: 0,
};

type Apoio = 'apoia' | 'contraria' | 'neutro';

const COR: Record<Apoio, string> = {
  apoia: 'bg-genesis-positive',
  contraria: 'bg-genesis-negative',
  neutro: 'bg-purple-500',
};

interface Props {
  scoreBasis?: { technical_coherence?: string; derivatives_confirmation?: string } | null;
  direction: 'LONG' | 'SHORT' | 'INDISPONIVEL';
  macroScore: number | null;
  sentimentScore: number | null;
}

const Bloco: React.FC<{ nome: string; pct: number; cor: string; legenda: string }> = ({ nome, pct, cor, legenda }) => (
  <div className="bg-black/40 rounded p-3 border border-white/[0.05]">
    <div className="flex justify-between items-center mb-2">
      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{nome}</span>
    </div>
    <div className="relative w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full ${cor}`} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
    </div>
    <p className="text-[8px] text-gray-500 mt-1">{legenda}</p>
  </div>
);

const ScoreBasisBars: React.FC<Props> = ({ scoreBasis, macroScore, sentimentScore }) => {
  if (!scoreBasis && macroScore == null && sentimentScore == null) return null;

  const coherence = scoreBasis?.technical_coherence as TechnicalCoherence;
  const tecnicoPct = coherence ? (COHERENCE_PCT[coherence] ?? 0) : 0;

  const confirmation = scoreBasis?.derivatives_confirmation as DerivativesConfirmation;
  const derivativosPct = confirmation ? (CONFIRMATION_PCT[confirmation] ?? 0) : 0;
  const derivativosApoio: Apoio = confirmation === 'OPPOSES' ? 'contraria'
    : confirmation === 'SUPPORTS' || confirmation === 'STRONGLY_SUPPORTS' ? 'apoia'
    : 'neutro';
  const derivativosLegenda = confirmation === 'OPPOSES' ? 'Contraria a leitura'
    : confirmation === 'SUPPORTS' || confirmation === 'STRONGLY_SUPPORTS' ? 'Apoia a leitura'
    : 'Neutro em relação à leitura';

  // V6.6 (F06, DP-06): Macro e Sentimento são informativos — nunca comparados com a direção
  // escolhida (LONG/SHORT). Mesma cor neutra do bloco Técnico, legenda sem "favorece"/"contraria".
  return (
    <div className="mb-5 relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {coherence && (
        <Bloco nome="Técnico" pct={tecnicoPct} cor={COR.neutro} legenda="Coerência dos indicadores com a leitura" />
      )}
      {confirmation && confirmation !== 'UNAVAILABLE' && (
        <Bloco nome="Derivativos" pct={derivativosPct} cor={COR[derivativosApoio]} legenda={derivativosLegenda} />
      )}
      {macroScore != null && (
        <Bloco nome="Macro" pct={macroScore} cor={COR.neutro} legenda="Contexto macro/geopolítico — informativo" />
      )}
      {sentimentScore != null && (
        <Bloco nome="Sentimento" pct={sentimentScore} cor={COR.neutro} legenda="Sentimento do ativo — informativo" />
      )}
    </div>
  );
};

export default ScoreBasisBars;
