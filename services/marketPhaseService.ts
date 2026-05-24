export type MarketPhase =
  | "building"
  | "breakout"
  | "executing"
  | "stretched"
  | "exhausted"
  | "range"
  | "neutral";

export type MarketPhaseInput = {
  currentPrice: number;
  ema21?: number;
  poc?: number;
  hvn?: number;
  lastImpulseSizePct: number;
  priceDistanceFromBasePct: number;
  rsi?: number;
  macdSlope?: number;
};

export type MarketPhaseResult = {
  phase: MarketPhase;
  isLatePhase: boolean;
  isEarlyPhase: boolean;
  confidence: number;
};

export function detectMarketPhase(input: MarketPhaseInput): MarketPhaseResult {
  const { lastImpulseSizePct, priceDistanceFromBasePct, rsi, macdSlope } = input;

  let phase: MarketPhase = "neutral";
  let isLatePhase = false;
  let isEarlyPhase = false;
  let confidence = 60;

  if (lastImpulseSizePct < 1.5 && priceDistanceFromBasePct < 1) {
    phase = "building";
    isEarlyPhase = true;
  }

  if (lastImpulseSizePct >= 1.5 && priceDistanceFromBasePct < 2) {
    phase = "breakout";
    isEarlyPhase = true;
  }

  if (lastImpulseSizePct >= 2 && priceDistanceFromBasePct >= 2 && priceDistanceFromBasePct < 4) {
    phase = "executing";
  }

  if (priceDistanceFromBasePct >= 4) {
    phase = "stretched";
    isLatePhase = true;
  }

  if (
    priceDistanceFromBasePct >= 5 &&
    lastImpulseSizePct > 3 &&
    rsi && rsi > 75 &&
    macdSlope && macdSlope < 0
  ) {
    phase = "exhausted";
    isLatePhase = true;
  }

  if (lastImpulseSizePct < 1 && priceDistanceFromBasePct < 1.5) {
    phase = "range";
  }

  // regra crítica
  if (priceDistanceFromBasePct > 3 && (phase === "building" || phase === "breakout")) {
    phase = "executing";
    isEarlyPhase = false;
  }

  return {
    phase,
    isLatePhase,
    isEarlyPhase,
    confidence
  };
}
