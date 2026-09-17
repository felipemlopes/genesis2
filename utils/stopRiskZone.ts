// Genesis Brain V2 (Fase 4.2, item 13.2, Requisito 12.7, Fonte §36.1-§36.5): régua BIDIRECIONAL —
// há risco nos dois extremos (stop perto demais = ruído; stop longe demais = risco financeiro +
// aproximação da liquidação), nunca "quanto mais longe, mais verde". Lado curto usa ATR (dado
// objetivo da própria operação); lado distante usa % da distância real entrada->liquidação que
// ainda resta além do stop — nunca manutenção estimada (Fonte: "Nunca usar maintenance margin
// estimada para colorir a régua em produção V2").
//
// Os limiares abaixo espelham `config('genesis.stop_slider')` (genesis-api) — precisam ficar
// sincronizados manualmente até o endpoint de repricing (Fase 4.3, task 14) existir pra servir
// isto do backend.

export type StopRiskZone =
  | 'TOO_CLOSE_NOISE'
  | 'CAUTION_CLOSE'
  | 'TECHNICAL_ZONE'
  | 'CAUTION_WIDE'
  | 'TOO_WIDE_LIQUIDATION_RISK';

export interface StopSliderThresholds {
  noiseRedBelowAtr: number;
  noiseYellowBelowAtr: number;
  liqDangerBelowPct: number;
  liqCautionBelowPct: number;
}

export const STOP_SLIDER_THRESHOLDS: StopSliderThresholds = {
  noiseRedBelowAtr: 0.50,
  noiseYellowBelowAtr: 0.80,
  liqDangerBelowPct: 15.0,
  liqCautionBelowPct: 30.0,
};

export const STOP_RISK_ZONE_MICROTEXT: Record<StopRiskZone, string> = {
  TOO_CLOSE_NOISE: 'Muito próximo: maior risco de ruído.',
  CAUTION_CLOSE: 'Perto do ruído normal do ativo.',
  TECHNICAL_ZONE: 'Zona técnica recomendada.',
  CAUTION_WIDE: 'Distante: eficiência de risco/retorno reduzida.',
  TOO_WIDE_LIQUIDATION_RISK: 'Muito distante: risco elevado e menor margem até a liquidação.',
};

/**
 * Fonte §36.5: `liq_gap_pct_of_entry_to_liquidation` — % da distância total entre entrada e
 * liquidação que ainda resta ALÉM do stop. 100% = stop colado na entrada (folga máxima); 0% = stop
 * na própria liquidação (folga nenhuma). `null` quando liquidação é `UNAVAILABLE` — nunca
 * aproximado com manutenção estimada.
 */
export const liqGapPctOfEntryToLiquidation = (
  stopEffective: number,
  entrada: number,
  liquidacao: number | null | undefined,
): number | null => {
  if (typeof liquidacao !== 'number' || !Number.isFinite(liquidacao)) {
    return null;
  }
  const distanciaTotal = Math.abs(entrada - liquidacao);
  if (distanciaTotal <= 0) {
    return null;
  }
  const distanciaRestante = Math.abs(stopEffective - liquidacao);

  return (distanciaRestante / distanciaTotal) * 100;
};

/**
 * Classifica a posição atual do stop na régua de 5 zonas (Fonte §36.2-§36.3). `stopDistanceAtr` é
 * sempre a distância ABSOLUTA (em ATR) entre entrada e o stop atual — o lado (acima/abaixo) já foi
 * validado separadamente por `isStopSideValid`/`isStopPositionValid` (utils/stopValidation.ts),
 * esta função não julga lado, só distância.
 */
export const classifyStopRiskZone = (
  stopDistanceAtr: number,
  liqGapPct: number | null,
  thresholds: StopSliderThresholds = STOP_SLIDER_THRESHOLDS,
): StopRiskZone => {
  if (stopDistanceAtr < thresholds.noiseRedBelowAtr) {
    return 'TOO_CLOSE_NOISE';
  }
  if (stopDistanceAtr < thresholds.noiseYellowBelowAtr) {
    return 'CAUTION_CLOSE';
  }
  if (liqGapPct !== null) {
    if (liqGapPct < thresholds.liqDangerBelowPct) {
      return 'TOO_WIDE_LIQUIDATION_RISK';
    }
    if (liqGapPct < thresholds.liqCautionBelowPct) {
      return 'CAUTION_WIDE';
    }
  }

  return 'TECHNICAL_ZONE';
};
