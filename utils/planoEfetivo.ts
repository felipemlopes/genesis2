import type { PlanoSetup } from '../types';
import type { RepriceResponse } from '../services/api';

/**
 * V6.12 (§7): o slider de stop passa a mandar na tela inteira. `planoEfetivo` é o plano original
 * com TUDO que depende do stop trocado pela resposta confirmada do `/reprice` (stop, R:R por alvo,
 * risco, quantidade, nocional, margem, liquidação e o aviso "liquida antes do stop"). Entrada,
 * alvos, textos e gatilho continuam vindo do plano original — mover o stop nunca mexe neles.
 * Lógica pura, sem React: testável sem renderizar o componente.
 */

export type RepriceState = { pending: boolean; error: string | null; response: RepriceResponse | null };

export const REPRICE_IDLE: RepriceState = { pending: false, error: null, response: null };

/** Mesmo formato do backend (`ExecucaoService::formatarRrExibir()`, "1:%.2f") — nunca outro. */
const rrExibir = (rr: number | null | undefined): string | null =>
  rr != null && Number.isFinite(rr) ? `1:${rr.toFixed(2)}` : null;

export function aplicarReprice(base: PlanoSetup | null, r: RepriceResponse | null): PlanoSetup | null {
  if (!base || !r) return base;

  const alvo = (chave: 'tp1' | 'tp2' | 'tp3') => ({
    ...base.rr_por_alvo?.[chave],
    rr_bruto: r.rr_bruto?.[chave] ?? null,
    rr_liquido: r.rr[chave],
    rr_bruto_exibir: rrExibir(r.rr_bruto?.[chave]),
    rr_liquido_exibir: rrExibir(r.rr[chave]),
  });

  return {
    ...base,
    stop: r.stop_effective,
    stop_effective: r.stop_effective,
    stop_source: r.stop_source,
    // V6.12 (§9.2): zona pela régua única — aviso de stop largo e slider mudam juntos.
    stop_risk_zone: r.stop_risk.zone,
    stop_distance_atr: r.stop_risk.distance_atr,
    rr_por_alvo: { ...base.rr_por_alvo, tp1: alvo('tp1'), tp2: alvo('tp2'), tp3: alvo('tp3') } as PlanoSetup['rr_por_alvo'],
    rr_bruto: r.rr_bruto?.tp1 ?? null,
    rr_liquido_estimado: r.rr.tp1,
    rr_bruto_exibir: rrExibir(r.rr_bruto?.tp1),
    rr_liquido_exibir: rrExibir(r.rr.tp1),
    risco_preco_pct: Number(r.risk.distance_pct.toFixed(2)),
    risco_usd_estimado: r.risk.risk_usd,
    risco_pct_capital_base: r.risk.pct_capital_base,
    risco_pct_margem: r.risk.pct_margem,
    quantidade_base_estimada: r.position.quantity,
    nocional_estimado: r.position.notional,
    margem_comprometida_usd: r.position.margin,
    margem_comprometida_pct_capital: r.position.margin_pct_capital,
    liquidacao: r.liquidation.price,
    verificacao: r.liquidation.verification,
    liquidacao_classificacao: r.liquidation.classification,
    // Desvio de arredondamento do stepSize é do stop antigo — o /reprice não recalcula. Ausência,
    // nunca o número de outro stop.
    risco_planejado: null,
    risco_real: null,
    risco_desvio_pct: null,
  };
}

/** Confirmar posição só com a matemática já consistente com o stop exibido. */
export function repriceConsistente(estado: RepriceState): boolean {
  return !estado.pending && !estado.error;
}

/** Texto do botão enquanto a matemática não fecha — não é bloqueio de setup, é espera. */
export function textoEsperaReprice(estado: RepriceState): string | null {
  if (estado.pending) return 'Recalculando...';
  if (estado.error) return 'Reprecificação indisponível';
  return null;
}

/**
 * Resposta que chega depois de o membro já ter movido o stop de novo é descartada. Cada
 * requisição recebe um número; só a mais recente vale.
 */
export function criarGuardaDeSequencia(): { proxima: () => number; ehAtual: (seq: number) => boolean } {
  let atual = 0;
  return {
    proxima: () => ++atual,
    ehAtual: (seq: number) => seq === atual,
  };
}

/** A resposta tem que ser do stop que está na tela (mesma tolerância do slider). */
export function respostaDoStopAtual(resposta: RepriceResponse, stopEffective: number, entrada: number): boolean {
  return Math.abs(resposta.stop_effective - stopEffective) <= Math.max(entrada * 1e-6, 1e-6);
}
