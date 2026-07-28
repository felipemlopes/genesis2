import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

/**
 * Restauração pós-entrega (2026-07-27): recria o layout de 4 blocos (Técnico/Derivativos/Macro/
 * Sentimento) que a tela sempre mostrou, mas sem recalcular nada em paralelo ao decisor único —
 * cada barra lê um dado que o Gemini (ou a chamada auxiliar de narrativa, já separada do decisor)
 * já devolve pronto:
 *   - Técnico: score_basis.technical_coherence (nível de confiança do próprio decisor na leitura
 *     técnica), colorido pela direção já decidida — nunca pode contradizer o resultado.
 *   - Derivativos: score_basis.derivatives_confirmation, que já tem polaridade própria
 *     (OPOE/apoia a direção escolhida).
 *   - Macro / Sentimento: score 0-100 da chamada de narrativa (InformativeNarrativeService).
 */

type TechnicalCoherence = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | undefined;
type DerivativesConfirmation = 'OPPOSES' | 'NEUTRAL' | 'SUPPORTS' | 'STRONGLY_SUPPORTS' | 'UNAVAILABLE' | undefined;

const COHERENCE_PCT: Record<string, number> = {
  VERY_LOW: 20, LOW: 40, MODERATE: 60, HIGH: 80, VERY_HIGH: 100,
};

const CONFIRMATION_PCT: Record<string, number> = {
  OPPOSES: 25, NEUTRAL: 50, SUPPORTS: 75, STRONGLY_SUPPORTS: 100, UNAVAILABLE: 0,
};

interface Props {
  scoreBasis?: { technical_coherence?: string; derivatives_confirmation?: string } | null;
  direction: 'LONG' | 'SHORT' | 'INDISPONIVEL';
  macroScore: number | null;
  sentimentScore: number | null;
}

const scoreColor = (score: number | null) => {
  if (score == null) return 'bg-gray-600';
  if (score >= 55) return 'bg-genesis-positive';
  if (score <= 45) return 'bg-genesis-negative';
  return 'bg-yellow-500';
};

const Bloco: React.FC<{ nome: string; pct: number; cor: string; icone?: 'check' | 'x' | null }> = ({ nome, pct, cor, icone }) => (
  <div className="bg-black/40 rounded p-3 border border-white/[0.05]">
    <div className="flex justify-between items-center mb-2">
      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{nome}</span>
      {icone === 'check' && <CheckCircle2 size={12} className="text-genesis-positive" />}
      {icone === 'x' && <XCircle size={12} className="text-genesis-negative" />}
    </div>
    <div className="relative w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
      <div className={`h-full ${cor}`} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
    </div>
  </div>
);

const ScoreBasisBars: React.FC<Props> = ({ scoreBasis, direction, macroScore, sentimentScore }) => {
  if (!scoreBasis && macroScore == null && sentimentScore == null) return null;

  const isLong = direction === 'LONG';
  const directionColor = isLong ? 'bg-genesis-positive' : 'bg-genesis-negative';

  const coherence = scoreBasis?.technical_coherence as TechnicalCoherence;
  const tecnicoPct = coherence ? (COHERENCE_PCT[coherence] ?? 0) : 0;

  const confirmation = scoreBasis?.derivatives_confirmation as DerivativesConfirmation;
  const derivativosPct = confirmation ? (CONFIRMATION_PCT[confirmation] ?? 0) : 0;
  const derivativosCor = confirmation === 'OPPOSES' ? 'bg-genesis-negative'
    : confirmation === 'SUPPORTS' || confirmation === 'STRONGLY_SUPPORTS' ? 'bg-genesis-positive'
    : 'bg-yellow-500';
  const derivativosIcone = confirmation === 'OPPOSES' ? 'x' : confirmation === 'SUPPORTS' || confirmation === 'STRONGLY_SUPPORTS' ? 'check' : null;

  return (
    <div className="mb-5 relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {coherence && <Bloco nome="Técnico" pct={tecnicoPct} cor={directionColor} />}
      {confirmation && confirmation !== 'UNAVAILABLE' && (
        <Bloco nome="Derivativos" pct={derivativosPct} cor={derivativosCor} icone={derivativosIcone} />
      )}
      {macroScore != null && <Bloco nome="Macro" pct={macroScore} cor={scoreColor(macroScore)} />}
      {sentimentScore != null && <Bloco nome="Sentimento" pct={sentimentScore} cor={scoreColor(sentimentScore)} />}
    </div>
  );
};

export default ScoreBasisBars;
