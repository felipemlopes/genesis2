export interface MaturityInput {
  rsi: number;
  adx: number;
  distanceFromPocPercent: number;  // % de distância do preço atual até a POC
  candlesAboveEma21: number;       // Quantas velas consecutivas acima da EMA21 (ou abaixo se SHORT)
  direction: 'LONG' | 'SHORT';
}

export interface MaturityOutput {
  totalPenalty: number;            // Valor a subtrair do score (0 a 55)
  breakdown: {
    rsiPenalty: number;
    adxPenalty: number;
    pocDistancePenalty: number;
    overextensionPenalty: number;
  };
  maturityLevel: 'EARLY' | 'DEVELOPING' | 'MATURE' | 'EXHAUSTED';
  warningMessage: string | null;
}

export const calculateMaturityPenalty = (input: MaturityInput): MaturityOutput => {
  const { rsi, adx, distanceFromPocPercent, candlesAboveEma21, direction } = input;

  let rsiPenalty = 0;
  if (direction === 'LONG') {
    if (rsi >= 80) rsiPenalty = 30;
    else if (rsi >= 75) rsiPenalty = 20;
    else if (rsi >= 70) rsiPenalty = 10;
    else if (rsi >= 65) rsiPenalty = 5;
  } else {
    if (rsi <= 20) rsiPenalty = 30;
    else if (rsi <= 25) rsiPenalty = 20;
    else if (rsi <= 30) rsiPenalty = 10;
    else if (rsi <= 35) rsiPenalty = 5;
  }

  let adxPenalty = 0;
  if (adx >= 45) adxPenalty = 15;
  else if (adx >= 40) adxPenalty = 10;
  else if (adx >= 30) adxPenalty = 5;

  let pocDistancePenalty = 0;
  if (distanceFromPocPercent >= 25) pocDistancePenalty = 10;
  else if (distanceFromPocPercent >= 15) pocDistancePenalty = 5;

  let overextensionPenalty = 0;
  if (candlesAboveEma21 >= 10) overextensionPenalty = 10;
  else if (candlesAboveEma21 >= 7) overextensionPenalty = 5;

  const totalPenalty = Math.min(55, rsiPenalty + adxPenalty + pocDistancePenalty + overextensionPenalty);

  let maturityLevel: 'EARLY' | 'DEVELOPING' | 'MATURE' | 'EXHAUSTED';
  if (totalPenalty >= 40) maturityLevel = 'EXHAUSTED';
  else if (totalPenalty >= 25) maturityLevel = 'MATURE';
  else if (totalPenalty >= 10) maturityLevel = 'DEVELOPING';
  else maturityLevel = 'EARLY';

  let warningMessage: string | null = null;
  if (maturityLevel === 'EXHAUSTED') {
    warningMessage = "Movimento em zona de exaustão. Score máximo limitado a 40/100. Aguardar pullback.";
  } else if (maturityLevel === 'MATURE') {
    warningMessage = "Tendência madura. Entrada apenas em reteste de zona de suporte.";
  } else if (maturityLevel === 'DEVELOPING') {
    warningMessage = "Tendência em desenvolvimento. Monitorar para continuação.";
  }

  return {
    totalPenalty,
    breakdown: {
      rsiPenalty,
      adxPenalty,
      pocDistancePenalty,
      overextensionPenalty
    },
    maturityLevel,
    warningMessage
  };
};
