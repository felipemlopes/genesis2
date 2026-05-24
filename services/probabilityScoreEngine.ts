import { calculateMaturityPenalty } from './maturityPenalty';

export type ProbabilityScoreInput = {
  structuralScore: number;
  executionScore: number;
  locationScore: number;
  flowScore: number;
  exhaustionRiskScore: number;
  isLatePhase: boolean;
  isTooFarFromDefense: boolean;
  bestPointAlreadyPassed: boolean;
  maturityPenalty?: number;
  currentEntryStatus?: "valid" | "weak" | "invalid";
  shouldWaitForLiquidityTarget?: boolean;
  regime?: "trending" | "ranging" | "volatile" | "extreme";
  volatilityRegime?: "low" | "normal" | "high" | "extreme";
};

export type ProbabilityScoreResult = {
  finalScore: number;
  riskPenalty: number;
  maturityPenalty: number;
  scoreBreakdown: {
    structuralScore: number;
    executionScore: number;
    locationScore: number;
    flowScore: number;
    riskPenalty: number;
    maturityPenalty: number;
  };
};

export function calculateProbabilityScore(input: ProbabilityScoreInput): ProbabilityScoreResult {
  const {
    structuralScore,
    executionScore,
    locationScore,
    flowScore,
    exhaustionRiskScore,
    isLatePhase,
    isTooFarFromDefense,
    bestPointAlreadyPassed,
    maturityPenalty: externalMaturityPenalty
  } = input;

  let riskPenalty = 0;

  if (exhaustionRiskScore >= 60) riskPenalty += 10;
  if (exhaustionRiskScore >= 75) riskPenalty += 5;

  if (isLatePhase) riskPenalty += 10;
  if (isTooFarFromDefense) riskPenalty += 10;
  if (bestPointAlreadyPassed) riskPenalty += 15;

  if (input.currentEntryStatus === "invalid") riskPenalty += 20;
  if (input.shouldWaitForLiquidityTarget) riskPenalty += 15;
  if (input.regime === "extreme") riskPenalty += 10;
  if (input.volatilityRegime === "extreme") riskPenalty += 10;

  let finalScore =
    structuralScore * 0.25 +
    executionScore * 0.25 +
    locationScore * 0.25 +
    flowScore * 0.15 -
    riskPenalty;

  const totalMaturityPenalty = externalMaturityPenalty || 0;
  finalScore -= totalMaturityPenalty;

  // The score represents the INTENSITY of the direction.
  // We NEVER output zero. Minimum score is 10 (very weak intensity).
  const maxAllowedScore = 100 - totalMaturityPenalty;
  if (finalScore > maxAllowedScore) finalScore = maxAllowedScore;
  if (finalScore < 10) finalScore = 10;

  return {
    finalScore: Math.round(finalScore),
    riskPenalty,
    maturityPenalty: totalMaturityPenalty,
    scoreBreakdown: {
      structuralScore,
      executionScore,
      locationScore,
      flowScore,
      riskPenalty,
      maturityPenalty: totalMaturityPenalty
    }
  };
}
