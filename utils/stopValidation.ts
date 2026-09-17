// Genesis Brain V2 (Fase 4.1, item 12.4, Requisito 12.5, Fonte §35): `Number(null)` é `0` (um
// valor FINITO) — qualquer checagem no formato `Number.isFinite(Number(x))` trata `null`/vazio
// como um zero legítimo, nunca como ausência. `AnalysisResult.tsx` já documenta um caso onde isso é
// DELIBERADO (planoAtivoCompleto, DP-03: stop ausente não pode travar a tela de execução) — mas o
// slider de stop (Fase 4.2) precisa do oposto: um guard explícito que rejeita null/undefined de
// verdade, porque ali o número é usado como VALOR (posição do slider, matemática de risco), não só
// como precondição de "o plano existe".

/** Rejeita explicitamente null/undefined/NaN — nunca deixa `Number(null) === 0` passar como válido. */
export const hasValidNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export type PlanoDirecao = 'LONG' | 'SHORT';

/**
 * Fonte §36.6: lado matematicamente correto do stop em relação à entrada — LONG protege abaixo
 * (stop < entrada), SHORT protege acima (stop > entrada). Usado pelo slider pra nunca aceitar uma
 * posição que uma corretora rejeitaria.
 */
export const isStopSideValid = (stop: number, entrada: number, direcao: PlanoDirecao): boolean =>
  direcao === 'LONG' ? stop < entrada : stop > entrada;

/**
 * Fonte §36.6: posição matematicamente válida do slider inteiro — LONG exige
 * `liquidation < stop < entry`; SHORT exige `entry < stop < liquidation`. Quando a liquidação é
 * `null` (UNAVAILABLE), a checagem de lado simples (`isStopSideValid`) ainda vale — RR/risco
 * continuam sendo previstos, só a zona verde/vermelha de liquidação some (nunca fingida com dado
 * estimado).
 */
export const isStopPositionValid = (
  stop: number,
  entrada: number,
  direcao: PlanoDirecao,
  liquidacao: number | null | undefined,
): boolean => {
  if (!isStopSideValid(stop, entrada, direcao)) {
    return false;
  }
  if (!hasValidNumber(liquidacao)) {
    return true;
  }

  return direcao === 'LONG' ? stop > liquidacao : stop < liquidacao;
};
