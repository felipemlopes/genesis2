import { LiquidityMapResult } from "./liquidityMapService";

export type PredictiveEntryPlannerInput = {
  currentPrice: number;
  structuralBias: "long" | "short";
  marketPhase: "building" | "breakout" | "executing" | "stretched" | "exhausted" | "range" | "neutral";
  locationScore: number;
  exhaustionScore: number;
  liquidityMap: LiquidityMapResult;
  regime: "trending" | "ranging" | "volatile" | "extreme";
  volatilityRegime: "low" | "normal" | "high" | "extreme";
  bestPointAlreadyPassed: boolean;
};

export type PredictiveEntryPlannerResult = {
  currentEntryStatus: "valid" | "weak" | "invalid";
  nextLiquidityZone?: number;
  nextActionableZone?: number;
  nextActionCondition?: string;
  shouldWaitForLiquidityTarget: boolean;
  comments: string[];
};

export function buildPredictiveEntryPlan(input: PredictiveEntryPlannerInput): PredictiveEntryPlannerResult {
  const { marketPhase, locationScore, exhaustionScore, liquidityMap, bestPointAlreadyPassed } = input;
  const comments: string[] = [];
  
  let currentEntryStatus: "valid" | "weak" | "invalid" = "valid";
  let shouldWaitForLiquidityTarget = false;

  if (marketPhase === "stretched" || marketPhase === "exhausted" || exhaustionScore >= 60 || locationScore < 40 || bestPointAlreadyPassed) {
    currentEntryStatus = "invalid";
    shouldWaitForLiquidityTarget = true;
    comments.push("Entrada atual tardia ou em localização ruim.");
  } else if (locationScore < 60 || exhaustionScore >= 40) {
    currentEntryStatus = "weak";
  }

  let nextLiquidityZone = undefined;
  let nextActionableZone = undefined;
  let nextActionCondition = undefined;

  if (currentEntryStatus === "invalid" || currentEntryStatus === "weak") {
    nextLiquidityZone = liquidityMap.primaryTarget?.price;
    nextActionableZone = liquidityMap.nextOperationalZone;
    
    if (nextActionableZone) {
      if (input.structuralBias === "long") {
        nextActionCondition = `aceitação e defesa acima de $${nextActionableZone} ou pullback até $${nextActionableZone} com defesa compradora`;
      } else {
        nextActionCondition = `rejeição abaixo de $${nextActionableZone} ou reteste em $${nextActionableZone} com falha de recuperação`;
      }
      comments.push(`Aguardar revisita de liquidez em $${nextActionableZone}.`);
    } else {
      comments.push("Nenhuma zona de liquidez clara identificada para reentrada.");
    }
  }

  return {
    currentEntryStatus,
    nextLiquidityZone,
    nextActionableZone,
    nextActionCondition,
    shouldWaitForLiquidityTarget,
    comments
  };
}
