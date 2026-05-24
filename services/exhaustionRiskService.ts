export type ExhaustionRiskInput = {
  currentPrice: number;
  ema21?: number;
  hvn?: number;
  lastImpulseSizePct: number;
  recentCandleRangePct: number;
  consecutiveDirectionalCandles: number;
  rsi?: number;
  macdSlope?: number;
};

export type ExhaustionRiskResult = {
  score: number;
  level: "low" | "moderate" | "high" | "extreme";
  isStretched: boolean;
};

export function evaluateExhaustionRisk(input: ExhaustionRiskInput): ExhaustionRiskResult {
  const {
    currentPrice,
    ema21,
    hvn,
    lastImpulseSizePct,
    recentCandleRangePct,
    consecutiveDirectionalCandles,
    rsi,
    macdSlope
  } = input;

  let score = 20;

  const distanceToEma21Pct =
    typeof ema21 === "number" ? ((currentPrice - ema21) / currentPrice) * 100 : 0;

  const distanceToHvnPct =
    typeof hvn === "number" ? (Math.abs(currentPrice - hvn) / currentPrice) * 100 : 0;

  if (lastImpulseSizePct >= 2) score += 15;
  if (lastImpulseSizePct >= 4) score += 10;

  if (recentCandleRangePct >= 2) score += 10;
  if (recentCandleRangePct >= 4) score += 10;

  if (consecutiveDirectionalCandles >= 3) score += 10;
  if (consecutiveDirectionalCandles >= 5) score += 10;

  if (distanceToEma21Pct >= 2) score += 10;
  if (distanceToEma21Pct >= 4) score += 10;

  if (distanceToHvnPct >= 2) score += 5;
  if (distanceToHvnPct >= 4) score += 10;

  if (typeof rsi === "number" && rsi > 70) score += 10;
  if (typeof rsi === "number" && rsi > 78) score += 10;

  if (typeof macdSlope === "number" && macdSlope < 0 && typeof rsi === "number" && rsi > 75) {
    score += 10;
  }

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  let level: "low" | "moderate" | "high" | "extreme" = "low";

  if (score >= 75) level = "extreme";
  else if (score >= 60) level = "high";
  else if (score >= 40) level = "moderate";

  const isStretched = score >= 60;

  return {
    score,
    level,
    isStretched
  };
}
