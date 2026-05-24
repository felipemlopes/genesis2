export type FlowConfirmationInput = {
  currentPrice: number;
  previousPrice?: number;
  cvd?: number;
  previousCvd?: number;
  fundingRate?: number;
  openInterest?: number;
  previousOpenInterest?: number;
  premiumIndex?: number;
};

export type FlowConfirmationResult = {
  score: number;
  flowDirection: "bullish" | "bearish" | "neutral";
  cvdState: "confirming" | "diverging" | "ambiguous";
  fundingState: "supportive" | "contrarian" | "neutral";
  oiState: "supportive" | "weak" | "unknown";
  hasAbsorptionSignal: boolean;
  hasExhaustionSignal: boolean;
};

export function evaluateFlowConfirmation(input: FlowConfirmationInput): FlowConfirmationResult {
  const {
    currentPrice,
    previousPrice,
    cvd,
    previousCvd,
    fundingRate,
    openInterest,
    previousOpenInterest
  } = input;

  let score = 50;
  let flowDirection: "bullish" | "bearish" | "neutral" = "neutral";
  let cvdState: "confirming" | "diverging" | "ambiguous" = "ambiguous";
  let fundingState: "supportive" | "contrarian" | "neutral" = "neutral";
  let oiState: "supportive" | "weak" | "unknown" = "unknown";
  let hasAbsorptionSignal = false;
  let hasExhaustionSignal = false;

  const priceUp =
    typeof previousPrice === "number" ? currentPrice > previousPrice : false;

  const priceDown =
    typeof previousPrice === "number" ? currentPrice < previousPrice : false;

  const cvdUp =
    typeof cvd === "number" && typeof previousCvd === "number" ? cvd > previousCvd : false;

  const cvdDown =
    typeof cvd === "number" && typeof previousCvd === "number" ? cvd < previousCvd : false;

  if (priceUp && cvdUp) {
    cvdState = "confirming";
    flowDirection = "bullish";
    score += 15;
  }

  if (priceDown && cvdDown) {
    cvdState = "confirming";
    flowDirection = "bearish";
    score += 15;
  }

  if (priceUp && cvdDown) {
    cvdState = "diverging";
    hasAbsorptionSignal = true;
    score += 5;
  }

  if (priceDown && cvdUp) {
    cvdState = "diverging";
    hasExhaustionSignal = true;
    score -= 5;
  }

  if (typeof fundingRate === "number") {
    if (fundingRate < 0 && priceUp) {
      fundingState = "supportive";
      score += 8;
    } else if (fundingRate > 0 && priceDown) {
      fundingState = "contrarian";
      score += 4;
    } else if (fundingRate < 0 && !priceUp) {
      fundingState = "neutral";
    } else if (fundingRate > 0 && priceUp) {
      fundingState = "neutral";
    }
  }

  if (typeof openInterest === "number" && typeof previousOpenInterest === "number") {
    if (openInterest > previousOpenInterest && (priceUp || priceDown)) {
      oiState = "supportive";
      score += 10;
    } else if (openInterest < previousOpenInterest) {
      oiState = "weak";
      score -= 5;
    }
  }

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  if (flowDirection === "neutral") {
    if (priceUp) flowDirection = "bullish";
    else if (priceDown) flowDirection = "bearish";
  }

  return {
    score,
    flowDirection,
    cvdState,
    fundingState,
    oiState,
    hasAbsorptionSignal,
    hasExhaustionSignal
  };
}
