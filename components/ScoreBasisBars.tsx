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
 *   - Macro / Sentimento: score 0-100 vindo do contexto canônico (GeminiContextService, backend),
 *     puramente informativo — nunca comparado com a direção escolhida.
 *
 * V6.5 (G08) / V6.6 (F06, DP-06): duas correções de cor já feitas aqui antes — a primeira trocou
 * "cor pela direção escolhida" por "cor pela polaridade real"; a segunda tirou Macro/Sentimento de
 * qualquer comparação com a direção (são informativos, nunca decidem nada — DP-06).
 *
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.3, doc §16): SUBSTITUÍDO —
 * dois achados/mudanças reais:
 * 1) Um guard condicional no topo do componente fazia a fileira inteira desaparecer quando
 *    qualquer combinação de dado faltava — violava a regra que não pode ser reinterpretada da
 *    matriz de aceite ("Os quatro cards aparecem sempre — Técnico, Derivativos, Macro e
 *    Geopolítico, Sentimento; ausência aparece como Indisponível"). Cada bloco também só
 *    renderizava condicionalmente, com curly-brace + AND lógico guardando o JSX — agora os 4
 *    slots sempre existem; ausência vira um selo "Indisponível" explícito, nunca a ausência do
 *    card inteiro.
 * 2) Paleta simplificada pra roxo (normal/informativo) e âmbar (atenção — coerência ou força
 *    baixa), nunca mais vermelho/verde ligado a "contraria/apoia a direção escolhida". Mesmo
 *    princípio do DP-06 (Macro/Sentimento nunca julgam a operação) agora estendido a Derivativos:
 *    "enfraquece a leitura" é um fato sobre a força do dado, não um veredito vermelho sobre a
 *    operação escolhida.
 */

type TechnicalCoherence = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
type DerivativesStrength = 'WEAKENS' | 'NEUTRAL' | 'STRENGTHENS' | 'UNAVAILABLE';

const COHERENCE_LABEL: Record<TechnicalCoherence, string> = {
  VERY_LOW: 'Muito baixa', LOW: 'Baixa', MODERATE: 'Moderada', HIGH: 'Alta', VERY_HIGH: 'Muito alta',
};

const STRENGTH_LABEL: Record<DerivativesStrength, string> = {
  WEAKENS: 'Enfraquece', NEUTRAL: 'Neutro', STRENGTHENS: 'Reforça', UNAVAILABLE: 'Indisponível',
};

type Severidade = 'normal' | 'atencao' | 'indisponivel';

const COR: Record<Severidade, { texto: string; fundo: string; barra: string }> = {
  normal: { texto: 'text-purple-400', fundo: 'bg-purple-500/10', barra: 'bg-purple-500' },
  atencao: { texto: 'text-amber-400', fundo: 'bg-amber-500/10', barra: 'bg-amber-500' },
  indisponivel: { texto: 'text-gray-500', fundo: 'bg-white/[0.03]', barra: 'bg-gray-700' },
};

interface Props {
  scoreBasis?: { technical_coherence?: string; data_quality?: string } | null;
  derivativesContext?: { strength?: string } | null;
  direction: 'LONG' | 'SHORT' | 'INDISPONIVEL';
  macroScore: number | null;
  sentimentScore: number | null;
}

const Selo: React.FC<{ severidade: Severidade; rotulo: string }> = ({ severidade, rotulo }) => (
  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${COR[severidade].texto} ${COR[severidade].fundo}`}>{rotulo}</span>
);

// Bloco categórico — selo com o rótulo, sem simular um percentual que o decisor nunca devolveu.
const BlocoCategorico: React.FC<{ nome: string; rotulo: string; severidade: Severidade; legenda: string }> = ({ nome, rotulo, severidade, legenda }) => (
  <div className="bg-black/40 rounded p-3 border border-white/[0.05]">
    <div className="flex justify-between items-center mb-2">
      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{nome}</span>
      <Selo severidade={severidade} rotulo={rotulo} />
    </div>
    <p className="text-[8px] text-gray-500 mt-1">{legenda}</p>
  </div>
);

// Bloco numérico — só pros dois casos (Macro/Sentimento) onde o percentual é um dado real, não
// inventado por este componente. pct=null renderiza o mesmo selo "Indisponível" dos categóricos.
const BlocoNumerico: React.FC<{ nome: string; pct: number | null; legenda: string }> = ({ nome, pct, legenda }) => (
  <div className="bg-black/40 rounded p-3 border border-white/[0.05]">
    <div className="flex justify-between items-center mb-2">
      <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{nome}</span>
      {pct == null && <Selo severidade="indisponivel" rotulo="Indisponível" />}
    </div>
    {pct != null && (
      <div className="relative w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full ${COR.normal.barra}`} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
      </div>
    )}
    <p className="text-[8px] text-gray-500 mt-1">{legenda}</p>
  </div>
);

const ScoreBasisBars: React.FC<Props> = ({ scoreBasis, derivativesContext, macroScore, sentimentScore }) => {
  const coherence = scoreBasis?.technical_coherence as TechnicalCoherence | undefined;
  const strength = (derivativesContext?.strength as DerivativesStrength | undefined) ?? 'UNAVAILABLE';

  // item 11.3: âmbar é ATENÇÃO (coerência/força baixa), nunca "contraria a direção escolhida" —
  // os 4 blocos nunca mais julgam a operação, só descrevem o próprio dado.
  const tecnicoSeveridade: Severidade = !coherence ? 'indisponivel'
    : (coherence === 'VERY_LOW' || coherence === 'LOW') ? 'atencao' : 'normal';
  const derivativosSeveridade: Severidade = strength === 'UNAVAILABLE' ? 'indisponivel'
    : strength === 'WEAKENS' ? 'atencao' : 'normal';

  return (
    <div className="mb-5 relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      <BlocoCategorico
        nome="Técnico"
        rotulo={coherence ? (COHERENCE_LABEL[coherence] ?? coherence) : 'Indisponível'}
        severidade={tecnicoSeveridade}
        legenda="Coerência dos indicadores com a leitura"
      />
      <BlocoCategorico
        nome="Derivativos"
        rotulo={STRENGTH_LABEL[strength]}
        severidade={derivativosSeveridade}
        legenda="Força dos derivativos sobre o cenário"
      />
      <BlocoNumerico nome="Macro e Geopolítico" pct={macroScore} legenda="Contexto macro/geopolítico — informativo" />
      <BlocoNumerico nome="Sentimento" pct={sentimentScore} legenda="Sentimento do ativo — informativo" />
    </div>
  );
};

export default ScoreBasisBars;
