export interface QuantitativeResult {
  score: number; // -1.0 to 1.0
  status: string;
  description: string;
}

export const runQuantitativeEngine = async (
  imbalanceParam: string | number | undefined, 
  delta: number, 
  openInterest: string
): Promise<QuantitativeResult> => {
  try {
    // Parse imbalance
    let imbalance = 0;
    if (imbalanceParam !== undefined) {
      if (typeof imbalanceParam === 'string') {
        const match = imbalanceParam.match(/[+-]?\d+(\.\d+)?/);
        if (match) imbalance = parseFloat(match[0]);
      } else {
        imbalance = imbalanceParam as number;
      }
    }
    
    let score = 0;
    
    if (imbalance > 15) score -= 0.4;
    else if (imbalance < -15) score += 0.4;
    
    if (delta > 1000) score += 0.4;
    else if (delta < -1000) score -= 0.4;

    if (openInterest !== "Indisponível") {
      score *= 1.2; 
    }

    score = Math.max(-1.0, Math.min(1.0, score));

    let status = "Neutro Estatístico";
    if (score > 0.6) status = "Puxada Bullish Estatística";
    else if (score > 0.2) status = "Leve Viés Positivo";
    else if (score < -0.6) status = "Despejo Bearish Estatístico";
    else if (score < -0.2) status = "Leve Viés Negativo";

    return {
      score,
      status,
      description: `Order Book Imbalance vs CVD Delta Regression Proxy Result: ${status}. Score: ${(score*100).toFixed(0)}%.`
    };
  } catch (e) {
    return {
      score: 0,
      status: "Indisponível",
      description: "Falha estatística."
    }
  }
};
