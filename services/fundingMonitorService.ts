
import { fetchWithProxy } from './cryptoApi';

export interface FundingData {
  symbol: string;
  currentRates: {
    binance: number;
    bybit: number;
    bitget: number;
    okx: number;
  };
  averageCurrent: number;
  average24h: number;
  trend: 'Rising' | 'Falling' | 'Stable';
  lastUpdate: number;
}

// Helper: Standardize symbols for specific APIs
const getSymbolForExchange = (baseSymbol: string, exchange: string) => {
  // Base: BTCUSDT
  if (exchange === 'Binance') return baseSymbol;
  if (exchange === 'Bybit') return baseSymbol;
  if (exchange === 'Bitget') return `${baseSymbol}_UMCBL`; // Bitget V1 mix format
  return baseSymbol;
};

// 1. BINANCE FETCH
const fetchBinanceFunding = async (symbol: string) => {
  try {
    // Current
    const currentUrl = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`;
    const currentRes = await fetchWithProxy(currentUrl);
    const current = parseFloat(currentRes.lastFundingRate);

    // History (for 24h avg / trend) - using public fundingRate endpoint
    const historyUrl = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=3`;
    const historyRes = await fetchWithProxy(historyUrl);
    
    let avg24h = current;
    let prev = current;

    if (Array.isArray(historyRes) && historyRes.length > 0) {
        // Average of last 3 + current roughly
        const sum = historyRes.reduce((acc: number, item: any) => acc + parseFloat(item.fundingRate), 0);
        avg24h = sum / historyRes.length;
        prev = parseFloat(historyRes[historyRes.length - 1].fundingRate);
    }

    return { current, avg24h, prev };
  } catch (e) {
    console.warn(`Binance Funding Error for ${symbol}`, e);
    return { current: 0, avg24h: 0, prev: 0 };
  }
};

// 2. BYBIT FETCH
const fetchBybitFunding = async (symbol: string) => {
  try {
    // Try Requested V2 API First
    const v2Url = `https://api.bybit.com/v2/public/funding/prev-funding-rate?symbol=${symbol}`;
    
    let current = 0;
    let prev = 0;
    
    try {
        const v2Res = await fetchWithProxy(v2Url);
        if (v2Res.ret_code === 0 && v2Res.result) {
            current = parseFloat(v2Res.result.funding_rate);
            prev = current; // V2 doesn't give history easily in one call
        } else {
            throw new Error("V2 Failed");
        }
    } catch (v2Error) {
        // Fallback to V5 if V2 is deprecated/fails
        const v5Url = `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`;
        const v5Res = await fetchWithProxy(v5Url);
        if (v5Res.retCode === 0 && v5Res.result?.list?.[0]) {
            current = parseFloat(v5Res.result.list[0].fundingRate);
            prev = current;
        }
    }

    return { current, avg24h: current, prev };
  } catch (e) {
    console.warn(`Bybit Funding Error for ${symbol}`, e);
    return { current: 0, avg24h: 0, prev: 0 };
  }
};

// 3. BITGET FETCH
const fetchBitgetFunding = async (symbol: string) => {
  try {
    const bitgetSymbol = getSymbolForExchange(symbol, 'Bitget');
    const url = `https://api.bitget.com/api/mix/v1/market/history-fund-rate?symbol=${bitgetSymbol}&pageSize=5`;
    
    const res = await fetchWithProxy(url);
    
    let current = 0;
    let avg24h = 0;
    let prev = 0;

    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        current = parseFloat(res.data[0].fundingRate);
        
        // Calculate 24h avg (Bitget returns descending order usually)
        const relevant = res.data.slice(0, 3);
        const sum = relevant.reduce((acc: number, item: any) => acc + parseFloat(item.fundingRate), 0);
        avg24h = sum / relevant.length;
        
        if (res.data.length > 1) {
            prev = parseFloat(res.data[1].fundingRate);
        } else {
            prev = current;
        }
    }

    return { current, avg24h, prev };
  } catch (e) {
    console.warn(`Bitget Funding Error for ${symbol}`, e);
    return { current: 0, avg24h: 0, prev: 0 };
  }
};

// 4. OKX FETCH
const fetchOkxFunding = async (symbol: string) => {
  try {
    const okxSymbol = symbol.replace('USDT', '-USDT-SWAP');
    const url = `https://www.okx.com/api/v5/public/funding-rate?instId=${okxSymbol}`;
    const res = await fetchWithProxy(url);
    
    let current = 0;
    
    if (res.code === '0' && res.data && res.data.length > 0) {
        current = parseFloat(res.data[0].fundingRate);
    }

    return { current, avg24h: current, prev: current };
  } catch (e) {
    console.warn(`OKX Funding Error for ${symbol}`, e);
    return { current: 0, avg24h: 0, prev: 0 };
  }
};

// MAIN AGGREGATOR
export const fetchFundingMonitorData = async (): Promise<FundingData[]> => {
  const assets = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  const results: FundingData[] = [];

  for (const asset of assets) {
      const [binance, bybit, bitget, okx] = await Promise.all([
          fetchBinanceFunding(asset),
          fetchBybitFunding(asset),
          fetchBitgetFunding(asset),
          fetchOkxFunding(asset)
      ]);

      // Calculate Averages
      // We filter out 0s if fetch failed to avoid skewing average towards 0, unless all failed
      const validCurrents = [binance.current, bybit.current, bitget.current, okx.current].filter(v => v !== 0);
      const avgCurrent = validCurrents.length > 0 
          ? validCurrents.reduce((a, b) => a + b, 0) / validCurrents.length 
          : 0;

      // 24h Avg Logic: Mix of history
      const validAvgs = [binance.avg24h, bybit.avg24h, bitget.avg24h, okx.avg24h].filter(v => v !== 0);
      const avg24h = validAvgs.length > 0 
          ? validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length 
          : avgCurrent;

      // Trend Logic
      // Compare Aggregated Current vs Aggregated Previous
      const validPrevs = [binance.prev, bybit.prev, bitget.prev, okx.prev].filter(v => v !== 0);
      const avgPrev = validPrevs.length > 0 
          ? validPrevs.reduce((a, b) => a + b, 0) / validPrevs.length 
          : avgCurrent;
      
      let trend: 'Rising' | 'Falling' | 'Stable' = 'Stable';
      if (avgCurrent > avgPrev) trend = 'Rising';
      else if (avgCurrent < avgPrev) trend = 'Falling';

      results.push({
          symbol: asset,
          currentRates: {
              binance: binance.current,
              bybit: bybit.current,
              bitget: bitget.current,
              okx: okx.current
          },
          averageCurrent: avgCurrent,
          average24h: avg24h,
          trend,
          lastUpdate: Date.now()
      });
  }

  return results;
};
