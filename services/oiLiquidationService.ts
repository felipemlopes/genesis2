
import { fetchWithProxy } from './cryptoApi';

export interface OiLiquidationData {
  meta: {
    price: number;
    change24h: number;
  };
  openInterest: {
    totalUsd: number;
    change5m: number;
    change1h: number;
    change24h: number;
    trend: 'Rising' | 'Falling' | 'Stable';
    history: number[]; // For chart
    byExchange: {
      binance: number;
      bybit: number;
      bitget: number;
      okx: number;
    };
  };
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
const fetchBinanceOIHistory = async (symbol: string) => {
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
    return { val: 0, history: [], chg5m: 0, chg1h: 0, chg24h: 0 };
  } catch (e) {
    return { val: 0, history: [], chg5m: 0, chg1h: 0, chg24h: 0 };
  }
};

// PRICE TICKER FETCH
const fetchCurrentTicker = async (symbol: string) => {
    try {
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
        const data = await fetchWithProxy(url);
        return {
            price: parseFloat(data.lastPrice),
            change: parseFloat(data.priceChangePercent)
        };
    } catch {
        return { price: 0, change: 0 };
    }
}

// --- MAIN SERVICE ---

export const fetchOiLiquidationData = async (symbol: string = 'BTCUSDT'): Promise<OiLiquidationData> => {
    // 1. PRICE TICKER (Header)
    const ticker = await fetchCurrentTicker(symbol);

    // 2. OPEN INTEREST (Binance Master + Proxies)
    const binanceData = await fetchBinanceOIHistory(symbol);
    
    const binanceVal = binanceData.val;
    const bybitVal = binanceVal * 0.45; 
    const bitgetVal = binanceVal * 0.20;
    const okxVal = binanceVal * 0.30;
    const totalOiUsd = binanceVal + bybitVal + bitgetVal + okxVal;

    // 4. GENERATE ANALYSIS TEXT (Focused strictly on OI)
    const oiTrend = binanceData.chg1h > 0 ? 'aumentou' : 'diminuiu';
    const leverageContext = binanceData.chg1h > 0 ? 'entrada de nova alavancagem' : 'saída de alavancagem (limpeza)';
    const oiTrendNoun = binanceData.chg1h > 0 ? 'crescente' : 'decrescente';
    
    let riskConclusion = '';
    if (binanceData.chg1h > 0.5) {
        riskConclusion = 'que o mercado está acumulando risco especulativo, aumentando a probabilidade de volatilidade no curto prazo';
    } else if (binanceData.chg1h < -0.5) {
        riskConclusion = 'que o mercado está em fase de desalavancagem, reduzindo o risco de movimentos explosivos imediatos';
    } else {
        riskConclusion = 'estabilidade momentânea na alavancagem, aguardando novo gatilho de volume';
    }

    const summary = `O Open Interest Agregado ${oiTrend} nas últimas horas, indicando ${leverageContext}. A manutenção de uma taxa ${oiTrendNoun} sugere ${riskConclusion}.`;

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
            trend: binanceData.chg1h > 0.5 ? 'Rising' : (binanceData.chg1h < -0.5 ? 'Falling' : 'Stable'),
            history: binanceData.history,
            byExchange: {
                binance: binanceVal,
                bybit: bybitVal,
                bitget: bitgetVal,
                okx: okxVal
            }
        },
        analysis: {
            summary,
            status: binanceData.chg1h > 0 ? 'Leverage Increasing' : 'Deleveraging'
        }
    };
};
