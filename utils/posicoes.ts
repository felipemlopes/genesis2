import type { ActiveTrade } from '../types';

/**
 * V6.12 (§8.3): posição confirmada como o servidor guarda (`trades`, colunas camelCase; preços
 * antigos em texto, o stop confirmado como número) e a conversão para o formato que a tela de
 * posições já mostrava. Ausência continua ausência (liquidação `null`), nunca zero.
 */
export interface TradeDoServidor {
  id: number;
  analysis_uuid: string | null;
  plano: 'A' | 'B' | null;
  exchange: string | null;
  date: string | null;
  asset: string | null;
  leverage: string | number | null;
  direction: string | null;
  status: string | null;
  pnl: string | null;
  entryPrice: string | number | null;
  currentPriceStr: string | null;
  targetPrice: string | number | null;
  financialTarget: string | number | null;
  liquidationPrice: string | number | null;
  amount: string | number | null;
  stopPrice: number | null;
  stopRecommended: number | null;
  stopSource: string | null;
}

const numero = (v: string | number | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const doisDigitos = (n: number): string => n.toString().padStart(2, '0');

/** Mesmo formato que a tela sempre usou: "30/09/2026, 14:05". */
const dataDaTela = (bruto: string | null): string => {
  const d = bruto ? new Date(bruto) : null;
  if (!d || Number.isNaN(d.getTime())) return bruto ?? '';
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}, ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
};

const ativoDaTela = (ativo: string | null): string => {
  if (!ativo) return '';
  return ativo.includes('/') ? ativo : ativo.replace(/USDT$/, '/USDT');
};

export function tradeDoServidor(t: TradeDoServidor): ActiveTrade {
  const alavancagem = t.leverage == null || t.leverage === '' ? '' : `${String(t.leverage).replace(/x$/i, '')}x`;

  return {
    id: String(t.id),
    exchange: t.exchange ?? '',
    date: dataDaTela(t.date),
    asset: ativoDaTela(t.asset),
    leverage: alavancagem,
    direction: t.direction ?? '',
    status: t.status ?? 'Pendente',
    pnl: t.pnl ?? '$0.00 (0.00%)',
    entryPrice: numero(t.entryPrice) ?? 0,
    currentPriceStr: t.currentPriceStr ?? '-',
    targetPrice: numero(t.targetPrice) ?? 0,
    financialTarget: numero(t.financialTarget) ?? undefined,
    liquidationPrice: numero(t.liquidationPrice),
    amount: numero(t.amount) ?? 0,
    analysisUuid: t.analysis_uuid ?? null,
    plano: t.plano ?? null,
    stopPrice: numero(t.stopPrice),
    stopSource: t.stopSource ?? null,
  };
}

/** "Finalizada" é histórico; o resto (Pendente, Executada) é posição ativa. */
export function separarPorStatus(lista: ActiveTrade[]): { ativas: ActiveTrade[]; encerradas: ActiveTrade[] } {
  return {
    ativas: lista.filter((t) => t.status !== 'Finalizada'),
    encerradas: lista.filter((t) => t.status === 'Finalizada'),
  };
}
