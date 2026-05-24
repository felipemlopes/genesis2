export type RegimeClassifierInput = {
  lastImpulseSizePct: number;
  recentCandleRangePct: number;
  rsi?: number;
  adx?: number;
  macdSlope?: number;
  priceDistanceFromBasePct: number;
};

export type RegimeClassifierResult = {
  regime: "trending" | "ranging" | "volatile" | "extreme";
  comments: string[];
};

export function classifyRegime(input: RegimeClassifierInput): RegimeClassifierResult {
  const { lastImpulseSizePct, recentCandleRangePct, priceDistanceFromBasePct, adx } = input;
  const comments: string[] = [];
  let regime: "trending" | "ranging" | "volatile" | "extreme" = "ranging";

  const isHighAdx = adx !== undefined && adx !== null && adx > 25;

  if (lastImpulseSizePct > 5 && priceDistanceFromBasePct > 5) {
    regime = "extreme";
    comments.push("Expansão agressiva e alto esticamento detectados.");
  } else if (recentCandleRangePct > 3 && priceDistanceFromBasePct > 3) {
    regime = "volatile";
    comments.push("Candles amplos e distância estrutural alta.");
  } else if (lastImpulseSizePct > 2 && isHighAdx) {
    regime = "trending";
    comments.push("Tendência clara com deslocamento progressivo.");
  } else {
    regime = "ranging";
    comments.push("Pouca expansão, regime lateral ou de consolidação.");
  }

  return { regime, comments };
}
