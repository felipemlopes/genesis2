export type LocationQualityInput = {
  currentPrice: number;
  ema21?: number;
  poc?: number;
  hvn?: number;
  lvn?: number;
  lhm?: number;
  recentHigh?: number;
  recentLow?: number;
};

export type LocationQualityResult = {
  score: number;
  isEfficientLocation: boolean;
  isTooFarFromDefense: boolean;
  nearestDefense?: number;
  nearestAcceptanceZone?: number;
  distanceToDefensePct?: number;
  distanceToAcceptancePct?: number;
};

export function evaluateLocationQuality(input: LocationQualityInput): LocationQualityResult {
  const {
    currentPrice,
    ema21,
    poc,
    hvn,
    lvn,
    lhm,
    recentHigh,
    recentLow
  } = input;

  const defenseCandidates = [ema21, poc, hvn, recentLow].filter(
    (v): v is number => typeof v === "number" && v < currentPrice
  );

  const acceptanceCandidates = [poc, hvn, lvn, lhm].filter(
    (v): v is number => typeof v === "number"
  );

  const nearestDefense = defenseCandidates.length
    ? defenseCandidates.reduce((a, b) =>
        Math.abs(currentPrice - a) < Math.abs(currentPrice - b) ? a : b
      )
    : undefined;

  const nearestAcceptanceZone = acceptanceCandidates.length
    ? acceptanceCandidates.reduce((a, b) =>
        Math.abs(currentPrice - a) < Math.abs(currentPrice - b) ? a : b
      )
    : undefined;

  const distanceToDefensePct =
    nearestDefense !== undefined
      ? ((currentPrice - nearestDefense) / currentPrice) * 100
      : undefined;

  const distanceToAcceptancePct =
    nearestAcceptanceZone !== undefined
      ? (Math.abs(currentPrice - nearestAcceptanceZone) / currentPrice) * 100
      : undefined;

  let score = 50;

  if (distanceToDefensePct !== undefined) {
    if (distanceToDefensePct <= 1) score += 30;
    else if (distanceToDefensePct <= 2) score += 15;
    else if (distanceToDefensePct > 4) score -= 20;
  }

  if (distanceToAcceptancePct !== undefined) {
    if (distanceToAcceptancePct <= 1) score += 15;
    else if (distanceToAcceptancePct > 3) score -= 10;
  }

  if (recentHigh !== undefined && currentPrice >= recentHigh) {
    score -= 10;
  }

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  const isTooFarFromDefense =
    distanceToDefensePct !== undefined ? distanceToDefensePct > 4 : true;

  const isEfficientLocation = score >= 65 && !isTooFarFromDefense;

  return {
    score,
    isEfficientLocation,
    isTooFarFromDefense,
    nearestDefense,
    nearestAcceptanceZone,
    distanceToDefensePct,
    distanceToAcceptancePct
  };
}
