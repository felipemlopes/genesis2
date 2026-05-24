export interface CvdAnalysisInput {
  cvdValues: number[];       // Array com últimos 10 valores de CVD (do mais antigo ao mais recente)
  priceValues: number[];     // Array com últimos 10 preços de fechamento correspondentes
  fundingRate: number;       // Em percentual (ex: -0.6990)
  openInterest: number;      // Valor atual
  openInterestPrevious: number; // Valor 4 horas atrás
}

export interface CvdAnalysisOutput {
  divergenceType: 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'NONE';
  divergenceStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE';
  predictiveSignal: 'LONG_ANTICIPATED' | 'SHORT_ANTICIPATED' | 'NEUTRAL';
  fundingContext: 'SQUEEZE_RISK_LONG' | 'SQUEEZE_RISK_SHORT' | 'NEUTRAL';
  oiContext: 'BUILDING' | 'REDUCING' | 'NEUTRAL';
  anticipationScore: number;  // 0 a 100, peso deste sinal no score preditivo
  description: string;
}

const calculateSlope = (values: number[]): number => {
  const n = values.length;
  if (n < 2) return 0;
  
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return slope;
};

export const analyzeCvdDivergence = (input: CvdAnalysisInput): CvdAnalysisOutput => {
  const { cvdValues, priceValues, fundingRate, openInterest, openInterestPrevious } = input;

  const slope_cvd = calculateSlope(cvdValues);
  const slope_price = calculateSlope(priceValues);

  let divergenceType: 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'NONE' = 'NONE';
  if (slope_price <= 0 && slope_cvd > 0) {
    divergenceType = 'BULLISH_DIVERGENCE';
  } else if (slope_price >= 0 && slope_cvd < 0) {
    divergenceType = 'BEARISH_DIVERGENCE';
  }

  let divergenceStrength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE' = 'NONE';
  if (divergenceType !== 'NONE') {
    const absCvd = Math.abs(slope_cvd);
    const absPrice = Math.abs(slope_price);
    
    if (absCvd > 2 * absPrice) divergenceStrength = 'STRONG';
    else if (absCvd > absPrice) divergenceStrength = 'MODERATE';
    else divergenceStrength = 'WEAK';
  }

  let fundingContext: 'SQUEEZE_RISK_LONG' | 'SQUEEZE_RISK_SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (fundingRate < -0.3) fundingContext = 'SQUEEZE_RISK_LONG';
  else if (fundingRate > 0.3) fundingContext = 'SQUEEZE_RISK_SHORT';

  let oiContext: 'BUILDING' | 'REDUCING' | 'NEUTRAL' = 'NEUTRAL';
  if (openInterest > openInterestPrevious * 1.05) oiContext = 'BUILDING';
  else if (openInterest < openInterestPrevious * 0.95) oiContext = 'REDUCING';

  let anticipationScore = 0;
  if (divergenceStrength === 'STRONG') anticipationScore = 60;
  else if (divergenceStrength === 'MODERATE') anticipationScore = 40;
  else if (divergenceStrength === 'WEAK') anticipationScore = 20;

  if (
    (divergenceType === 'BULLISH_DIVERGENCE' && fundingContext === 'SQUEEZE_RISK_LONG') ||
    (divergenceType === 'BEARISH_DIVERGENCE' && fundingContext === 'SQUEEZE_RISK_SHORT')
  ) {
    anticipationScore += 25;
  }

  if (divergenceType !== 'NONE' && oiContext === 'BUILDING') {
    anticipationScore += 15;
  }

  anticipationScore = Math.min(100, anticipationScore);

  let predictiveSignal: 'LONG_ANTICIPATED' | 'SHORT_ANTICIPATED' | 'NEUTRAL' = 'NEUTRAL';
  if (divergenceType === 'BULLISH_DIVERGENCE' && anticipationScore >= 40) {
    predictiveSignal = 'LONG_ANTICIPATED';
  } else if (divergenceType === 'BEARISH_DIVERGENCE' && anticipationScore >= 40) {
    predictiveSignal = 'SHORT_ANTICIPATED';
  }

  const description = divergenceType === 'NONE' 
    ? "Sem divergência clara entre CVD e Preço." 
    : `${divergenceType === 'BULLISH_DIVERGENCE' ? 'Acumulação' : 'Distribuição'} detectada via CVD (${divergenceStrength}). Sinal preditivo: ${predictiveSignal}.`;

  return {
    divergenceType,
    divergenceStrength,
    predictiveSignal,
    fundingContext,
    oiContext,
    anticipationScore,
    description
  };
};
