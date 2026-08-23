
import { fetchDerivativesFlow, DerivativesFlowResponse, TradeFlowWindow } from './api';

/**
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 12, item 12.5, doc §17): SUBSTITUÍDO —
 * o "FlowTrack" antigo simulava quase tudo que exibia: `blockchain`/`from`/`to`/`hash` de uma API
 * de whale-alert com chave "FREE" inválida (sempre caía no fallback), que por sua vez FINGIA ser
 * whale-alert usando aggTrades da Binance SPOT (`api.binance.com/api/v3`, mercado errado — o
 * Gênesis só opera Futures perpétuo); `activeAddresses` era `Math.random()`; `pressureNet`/
 * `totalInflow`/`totalOutflow` misturavam volume real do orderbook com fatores arbitrários
 * (`* 0.1`, `* 0.05`); e as barras "Entrada Total"/"Saída Total" do card 4 eram larguras FIXAS
 * (45%/55%), nunca proporcionais ao dado real. `conversionRate` caía para um preço fixo de 60.000
 * quando a busca de preço falhava — outro número inventado sem indicar que era um fallback.
 *
 * Agora: só fluxo agressor real (buy/sell notional por janela), da mesma fonte que o cérebro usa
 * para o mesmo conceito (`TradeFlowService::resumir()` sobre `aggTradesRange()` real da Binance
 * USD-M Futures, backend, item 12.3/12.4) — `decision_role: DISPLAY_ONLY`, nunca entra na análise.
 */

export interface FlowTrackData {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  errorCode?: string;
  windows: Record<string, TradeFlowWindow>;
  asOfMs?: number;
}

export const fetchFlowTrackData = async (symbol: string, timeframe: string): Promise<FlowTrackData> => {
  const res: DerivativesFlowResponse | null = await fetchDerivativesFlow(symbol, timeframe);

  if (!res || res.status !== 'AVAILABLE' || !res.windows) {
    return { status: 'UNAVAILABLE', errorCode: res?.error_code, windows: {} };
  }

  return { status: 'AVAILABLE', windows: res.windows, asOfMs: res.as_of_ms };
};
