// V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.8, doc §18): centraliza uma
// distinção que já existia espalhada e implementada manualmente em vários componentes desta tela
// (ScoreBasisBars.tsx, Fase 11 — "paleta roxo/âmbar por severidade, nunca cor ligada à direção da
// operação"; BasisSpotPerpetualCard.tsx, Fase 12 — mesma ideia para o prêmio Spot/Futuros) — dois
// tipos de cor que respondem perguntas diferentes e nunca deveriam se misturar:
//
// - directionTone(): verde/vermelho — usado SÓ quando a cor representa a direção real de um
//   preço (subiu/desceu, LONG/SHORT, lucro/prejuízo). É a única categoria com carga direcional.
// - relationTone(): roxo/âmbar/neutro — usado para tudo que é sobre a RELAÇÃO entre um dado e o
//   cenário (derivativos reforçando/enfraquecendo a leitura, confluência entre timeframes, um
//   plano sendo recomendado ou não) — nunca implica "preço vai subir ou cair", mesmo que o dado
//   em si tenha polaridade própria.
//
// Usar directionTone() para algo que não é preço (ex.: "derivativos concordam com a direção") é
// exatamente o erro que a Fase 11 (G08/F06/DP-06) corrigiu em ScoreBasisBars.tsx — verde/vermelho
// ali dava a impressão de veredito de mercado sobre um dado que é só uma leitura de intensidade.

export type DirectionTone = 'positive' | 'negative' | 'neutral';
export type RelationTone = 'normal' | 'atencao' | 'indisponivel';

export interface ToneClasses {
  texto: string;
  fundo: string;
  barra: string;
}

const DIRECTION_CLASSES: Record<DirectionTone, ToneClasses> = {
  positive: { texto: 'text-genesis-positive', fundo: 'bg-green-900/10', barra: 'bg-genesis-positive' },
  negative: { texto: 'text-genesis-negative', fundo: 'bg-red-900/10', barra: 'bg-genesis-negative' },
  neutral: { texto: 'text-gray-400', fundo: 'bg-white/5', barra: 'bg-gray-500' },
};

const RELATION_CLASSES: Record<RelationTone, ToneClasses> = {
  normal: { texto: 'text-purple-400', fundo: 'bg-purple-500/10', barra: 'bg-purple-500' },
  atencao: { texto: 'text-amber-400', fundo: 'bg-amber-500/10', barra: 'bg-amber-500' },
  indisponivel: { texto: 'text-gray-500', fundo: 'bg-white/[0.03]', barra: 'bg-gray-700' },
};

/** Verde/vermelho — só para direção real de preço (subiu/desceu, lucro/prejuízo, LONG/SHORT). */
export const directionTone = (tone: DirectionTone): ToneClasses => DIRECTION_CLASSES[tone];

/**
 * Roxo/âmbar/neutro — para relação entre um dado e o cenário (derivativos, confluência,
 * recomendação de plano). Nunca verde/vermelho, mesmo que o dado em si tenha polaridade própria.
 */
export const relationTone = (tone: RelationTone): ToneClasses => RELATION_CLASSES[tone];

/** Deriva o tom direcional a partir de um número (variação, delta, lucro) — >0 positivo, <0 negativo. */
export const directionToneFromValue = (value: number | null | undefined): DirectionTone => {
  if (value === null || value === undefined || value === 0) return 'neutral';
  return value > 0 ? 'positive' : 'negative';
};
