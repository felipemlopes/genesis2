export interface SweepDetectionInput {
  currentPrice: number;
  keyResistanceLevel: number;    // Week High, Equal Highs, HVN superior
  keySupportLevel: number;       // Week Low, Equal Lows, HVN inferior
  lastCandleHigh: number;
  lastCandleClose: number;
  lastCandleLow: number;
  cvdCurrent: number;
  cvdPrevious: number;           // CVD da vela anterior
  volumeLastCandle: number;
  volumeAverage20: number;       // Média de volume das últimas 20 velas
  direction: 'LONG' | 'SHORT';
}

export interface SweepDetectionOutput {
  classification: 'REAL_BREAKOUT' | 'LIQUIDITY_SWEEP' | 'UNCERTAIN';
  sweepScore: number;            // 0 a 4 (quantidade de condições ativas)
  conditions: {
    touchedKeyLevel: boolean;
    rejectedBelowLevel: boolean; // Fechou abaixo do nível que tocou (em LONG)
    cvdDivergence: boolean;      // CVD caindo enquanto preço sobe (em LONG)
    spikeVolume: boolean;        // Volume > 1.5x média
  };
  blockEntry: boolean;           // true = bloquear entrada na direção atual
  suggestedAction: string;       // Texto explicativo para o relatório
}

export const detectLiquiditySweep = (input: SweepDetectionInput): SweepDetectionOutput => {
  const {
    keyResistanceLevel,
    keySupportLevel,
    lastCandleHigh,
    lastCandleClose,
    lastCandleLow,
    cvdCurrent,
    cvdPrevious,
    volumeLastCandle,
    volumeAverage20,
    direction
  } = input;

  const conditions = {
    touchedKeyLevel: false,
    rejectedBelowLevel: false,
    cvdDivergence: false,
    spikeVolume: volumeLastCandle > volumeAverage20 * 1.5
  };

  if (direction === 'LONG') {
    conditions.touchedKeyLevel = lastCandleHigh >= keyResistanceLevel * 0.998;
    conditions.rejectedBelowLevel = lastCandleClose < keyResistanceLevel * 0.995;
    conditions.cvdDivergence = cvdCurrent < cvdPrevious;
  } else {
    conditions.touchedKeyLevel = lastCandleLow <= keySupportLevel * 1.002;
    conditions.rejectedBelowLevel = lastCandleClose > keySupportLevel * 1.005;
    conditions.cvdDivergence = cvdCurrent > cvdPrevious;
  }

  let sweepScore = 0;
  if (conditions.touchedKeyLevel) sweepScore++;
  if (conditions.rejectedBelowLevel) sweepScore++;
  if (conditions.cvdDivergence) sweepScore++;
  if (conditions.spikeVolume) sweepScore++;

  let classification: 'REAL_BREAKOUT' | 'LIQUIDITY_SWEEP' | 'UNCERTAIN' = 'UNCERTAIN';
  let blockEntry = false;

  if (sweepScore >= 3) {
    classification = 'LIQUIDITY_SWEEP';
    blockEntry = true;
  } else if (sweepScore <= 1) {
    classification = 'REAL_BREAKOUT';
    blockEntry = false;
  } else {
    classification = 'UNCERTAIN';
    blockEntry = false;
  }

  let suggestedAction = '';
  if (classification === 'LIQUIDITY_SWEEP') {
    const level = direction === 'LONG' ? 'resistência' : 'suporte';
    suggestedAction = `Stop hunt detectado em ${level}. Aguardar CVD positivo e fechamento acima de ${level} para confirmar breakout real.`;
  } else if (classification === 'REAL_BREAKOUT') {
    suggestedAction = "Rompimento com estrutura válida. Sem divergência de sweep.";
  } else {
    suggestedAction = "Sinal ambíguo. Reduzir tamanho de posição ou aguardar próxima vela.";
  }

  return {
    classification,
    sweepScore,
    conditions,
    blockEntry,
    suggestedAction
  };
};
