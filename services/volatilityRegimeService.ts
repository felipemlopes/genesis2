export type VolatilityRegimeInput = {
  atrPct?: number;
  recentCandleRangePct: number;
  lastImpulseSizePct: number;
};

export type VolatilityRegimeResult = {
  volatilityRegime: "low" | "normal" | "high" | "extreme";
  stopMultiplier: number;
  targetMultiplier: number;
};

export function classifyVolatilityRegime(input: VolatilityRegimeInput): VolatilityRegimeResult {
  const { atrPct, recentCandleRangePct, lastImpulseSizePct } = input;
  
  const volMetric = atrPct !== undefined && atrPct !== null ? atrPct : recentCandleRangePct;

  let volatilityRegime: "low" | "normal" | "high" | "extreme" = "normal";
  let stopMultiplier = 1.0;
  let targetMultiplier = 1.0;

  if (volMetric > 5 || lastImpulseSizePct > 10) {
    volatilityRegime = "extreme";
    stopMultiplier = 2.0;
    targetMultiplier = 2.5;
  } else if (volMetric > 3 || lastImpulseSizePct > 5) {
    volatilityRegime = "high";
    stopMultiplier = 1.5;
    targetMultiplier = 1.8;
  } else if (volMetric < 1 && lastImpulseSizePct < 2) {
    volatilityRegime = "low";
    stopMultiplier = 0.8;
    targetMultiplier = 0.8;
  } else {
    volatilityRegime = "normal";
    stopMultiplier = 1.0;
    targetMultiplier = 1.2;
  }

  return {
    volatilityRegime,
    stopMultiplier,
    targetMultiplier
  };
}
