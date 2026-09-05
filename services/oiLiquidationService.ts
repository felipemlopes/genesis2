
import { fetchWithProxy } from './cryptoApi';
import { fetchDerivativesComparison, DerivativesDisplayMetric } from './api';

/**
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 12, item 12.1, doc §17): achado real —
 * `byExchange.bybit/bitget/okx` eram o Open Interest da Binance MULTIPLICADO por frações fixas
 * (0.45/0.20/0.30 respectivamente) — um número inventado, sem nenhuma chamada real às outras 3
 * exchanges, exibido como se fosse dado de mercado real. Substituído pela comparação real
 * (`MultiExchangeDerivativesDisplayService`, backend, `/v1/tools/derivatives-comparison/{symbol}`)
 * — cada exchange `AVAILABLE`/`UNAVAILABLE` de forma independente, nunca extrapolada de outra.
 * `totalOiUsd` agora soma só as fontes `AVAILABLE` (nunca preenche uma indisponível com um número
 * fabricado); o histórico/tendência (série 24h) continua vindo só da Binance, que é quem realmente
 * expõe essa série — as outras exchanges entram só no card de comparação por fonte.
 */

// Spec genesis-v6-10-implementacao (Fase 8, item 8.1, doc §8.1): campos que dependiam de uma
// chamada de rede (preço, OI e variações) viram nullable — falha de coleta agora é `null`
// ("indisponível"), nunca um `0` fabricado que a tela mostraria como se fosse um dado real (ex.:
// "0.00% em 1h" parecendo mercado parado, quando na verdade a chamada falhou).
export interface OiLiquidationData {
  meta: {
    price: number | null;
    change24h: number | null;
  };
  openInterest: {
    totalUsd: number | null;
    change5m: number | null;
    change1h: number | null;
    change24h: number | null;
    trend: 'Rising' | 'Falling' | 'Stable' | 'Unavailable';
    history: number[]; // For chart
  };
  byExchange: Record<'binance' | 'bybit' | 'bitget' | 'okx', DerivativesDisplayMetric>;
  analysis: {
    summary: string; // The specific PT-BR text
    status: string; // Simplified status
  };
}

const getSymbol = (asset: string, exchange: string) => {
  if (exchange === 'Binance') return asset; // BTCUSDT
  if (exchange === 'Bybit') return asset; // BTCUSDT
  if (exchange === 'Bitget') return `${asset}_UMCBL`; // BTCUSDT_UMCBL
  return asset;
};

// --- API FETCHERS ---

// BINANCE
interface BinanceOiHistoryResult {
  val: number | null;
  history: number[];
  chg5m: number | null;
  chg1h: number | null;
  chg24h: number | null;
}

// Item 8.1 (doc §8.1): falha de coleta (exceção ou array vazio) devolve `null` nos quatro campos
// numéricos — antes devolvia `0` nos dois casos, indistinguível de "OI real é zero" pra tela.
const OI_HISTORY_INDISPONIVEL: BinanceOiHistoryResult = { val: null, history: [], chg5m: null, chg1h: null, chg24h: null };

const fetchBinanceOIHistory = async (symbol: string): Promise<BinanceOiHistoryResult> => {
  try {
    // 5m period, 288 periods = 24 hours
    const url = `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=289`;
    const data = await fetchWithProxy(url);

    if (Array.isArray(data) && data.length > 0) {
      const history = data.map((d: any) => parseFloat(d.sumOpenInterestValue));
      const latest = history[history.length - 1];

      // Calculate changes
      // 5m: last vs last-1
      const prev5m = history[history.length - 2] || latest;
      const chg5m = ((latest - prev5m) / prev5m) * 100;

      // 1h: last vs last-12 (5m * 12 = 60m)
      const prev1h = history[history.length - 13] || history[0];
      const chg1h = ((latest - prev1h) / prev1h) * 100;

      // 24h: last vs first
      const prev24h = history[0];
      const chg24h = ((latest - prev24h) / prev24h) * 100;

      return { val: latest, history, chg5m, chg1h, chg24h };
    }
    return OI_HISTORY_INDISPONIVEL;
  } catch (e) {
    return OI_HISTORY_INDISPONIVEL;
  }
};

// PRICE TICKER FETCH
// V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 14, item 14.3, achado real): apontava
// para api.binance.com/api/v3 (Spot) — resíduo que passou despercebido na Fase 12 (só o bloco
// byExchange foi reescrito ali, não este header de preço). Migrado para Futures.
const fetchCurrentTicker = async (symbol: string): Promise<{ price: number | null; change: number | null }> => {
    try {
        const url = `https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`;
        const data = await fetchWithProxy(url);
        return {
            price: parseFloat(data.lastPrice),
            change: parseFloat(data.priceChangePercent)
        };
    } catch {
        // Item 8.1 (doc §8.1): falha de coleta vira null — antes "$0" e "0.00%" pareciam preço e
        // variação reais.
        return { price: null, change: null };
    }
}

// --- MAIN SERVICE ---

export const fetchOiLiquidationData = async (symbol: string = 'BTCUSDT'): Promise<OiLiquidationData> => {
    // 1. PRICE TICKER (Header)
    const ticker = await fetchCurrentTicker(symbol);

    // 2. OPEN INTEREST (série real, só Binance expõe histórico 24h)
    const binanceData = await fetchBinanceOIHistory(symbol);

    // 3. COMPARAÇÃO REAL ENTRE EXCHANGES (backend, item 12.1) — cada fonte independente.
    const comparacao = await fetchDerivativesComparison(symbol);
    const indisponivel: DerivativesDisplayMetric = {
        status: 'UNAVAILABLE', value: null, unit: 'contracts', source: 'INDISPONIVEL',
        observed_at: new Date().toISOString(), error_code: 'DISPLAY_SOURCE_UNAVAILABLE',
    };
    const byExchange: OiLiquidationData['byExchange'] = {
        binance: comparacao?.exchanges.binance.open_interest ?? indisponivel,
        bybit: comparacao?.exchanges.bybit.open_interest ?? indisponivel,
        bitget: comparacao?.exchanges.bitget.open_interest ?? indisponivel,
        okx: comparacao?.exchanges.okx.open_interest ?? indisponivel,
    };

    // totalOiUsd soma só o que é real e disponível — nunca preenche uma fonte ausente com número
    // inventado. Unidades divergem por exchange (contratos, não USD) — usado aqui só como proxy
    // relativo de tamanho agregado real, nunca como valor monetário exato somável entre exchanges.
    // Item 8.1: `binanceData.val` agora pode ser `null` de verdade (falha de coleta) — o fallback
    // só serve quando a soma das exchanges é zero (nenhuma disponível), nunca mascara um null real.
    const somaExchanges = Object.values(byExchange)
        .filter((m) => m.status === 'AVAILABLE' && m.value !== null)
        .reduce((acc, m) => acc + (m.value as number), 0);
    const totalOiUsd = somaExchanges > 0 ? somaExchanges : binanceData.val;

    // 4. GENERATE ANALYSIS TEXT (Focused strictly on OI)
    // Item 8.1 (doc §8.1): chg1h pode ser null (falha de coleta) — antes null>0/null<-0.5 caíam
    // silenciosamente no ramo "diminuiu"/"estabilidade", uma leitura fabricada sobre dado ausente.
    const chg1h = binanceData.chg1h;
    let summary: string;
    let status: string;
    if (chg1h == null) {
        summary = 'Não foi possível obter a variação recente do Open Interest da Binance nesta consulta.';
        status = 'Unavailable';
    } else {
        const oiTrend = chg1h > 0 ? 'aumentou' : 'diminuiu';
        const leverageContext = chg1h > 0 ? 'entrada de nova alavancagem' : 'saída de alavancagem (limpeza)';
        const oiTrendNoun = chg1h > 0 ? 'crescente' : 'decrescente';

        let riskConclusion: string;
        if (chg1h > 0.5) {
            riskConclusion = 'que o mercado está acumulando risco especulativo, aumentando a probabilidade de volatilidade no curto prazo';
        } else if (chg1h < -0.5) {
            riskConclusion = 'que o mercado está em fase de desalavancagem, reduzindo o risco de movimentos explosivos imediatos';
        } else {
            riskConclusion = 'estabilidade momentânea na alavancagem, aguardando novo gatilho de volume';
        }

        summary = `O Open Interest da Binance ${oiTrend} nas últimas horas, indicando ${leverageContext}. A manutenção de uma taxa ${oiTrendNoun} sugere ${riskConclusion}.`;
        status = chg1h > 0 ? 'Leverage Increasing' : 'Deleveraging';
    }

    return {
        meta: {
            price: ticker.price,
            change24h: ticker.change
        },
        openInterest: {
            totalUsd: totalOiUsd,
            change5m: binanceData.chg5m,
            change1h: binanceData.chg1h,
            change24h: binanceData.chg24h,
            trend: chg1h == null ? 'Unavailable' : (chg1h > 0.5 ? 'Rising' : (chg1h < -0.5 ? 'Falling' : 'Stable')),
            history: binanceData.history,
        },
        byExchange,
        analysis: {
            summary,
            status
        }
    };
};
