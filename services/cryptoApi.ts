
// Service to fetch REAL market data from Exchanges
// Note: Direct browser calls to these APIs often face CORS issues. 
// In a production env, these should be routed through a backend proxy.
// For this 'Terminal', we attempt direct fetch as requested.

export interface MarketData {
  funding: string;
  oi: string; // Formatted compact ($ 1M, $ 1B)
  price?: string;
  change24h?: string; // New: 24h Change Percentage
}

export interface ExchangeData {
  binance: MarketData | null;
  bybit: MarketData | null;
  bitget: MarketData | null;
  okx: MarketData | null;
}

// NEW: Interface for CVD Data
export interface CVDData {
  delta: number;
  priceChangePercent: number;
}

// Utility: Robust Crypto Value Formatter
export const formatCryptoValue = (value: string | number | undefined | null): string => {
  if (value === null || value === undefined || value === '') return '---';
  
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) return '---';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(num);
};

// --- REGRA IMUTÁVEL DE FORMATAÇÃO DE PREÇOS EM DÓLAR ---
export const formatPrice = (value: number) => {
  if (isNaN(value)) return '---';
  
  // Regra 1: Preços iguais ou superiores a $1.00 -> Max 2 casas decimais
  if (Math.abs(value) >= 1) {
    return '$ ' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  // Regra 2: Preços entre $0.01 e $1.00 -> Max 4 casas decimais
  if (Math.abs(value) >= 0.01) {
    return '$ ' + value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }

  // Regra 3: Preços inferiores a $0.01 -> Preservar precisão (Visual Truncation Only)
  // Utiliza 8 casas para garantir que tokens de baixo valor (ex: PEPE, SHIB) não sejam arredondados para 0 ou percam precisão crítica.
  return '$ ' + value.toLocaleString('en-US', { maximumFractionDigits: 8 });
};

const formatFunding = (value: number) => {
  if (isNaN(value)) return '---';
  return `${(value * 100).toFixed(4)}%`;
};

// Helper to get leverage options per exchange
export const getLeverageOptions = (exchange: string): number[] => {
  switch (exchange) {
    case 'Binance': return [1, 2, 3, 5, 10, 20, 25, 50, 75, 100, 125];
    case 'Bybit': return [1, 2, 3, 5, 10, 25, 50, 100];
    case 'Bitget': return [1, 5, 10, 20, 50, 100, 125];
    case 'OKX': return [1, 2, 3, 5, 10, 20, 50, 100, 125];
    default: return [1, 5, 10, 20, 50, 100];
  }
};

// --- CORS PROXY & TIMEOUT HELPER ---
export const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error(`Fetch timed out after ${timeoutMs}ms`);
    throw e;
  }
};

export const fetchWithProxy = async (targetUrl: string, timeoutMs: number = 4000): Promise<any> => {
  const directController = new AbortController();
  const directTimeout = setTimeout(() => directController.abort(), timeoutMs);

  const isRestricted = (json: any) => {
      if (json?.error && typeof json.error === "string" && json.error.includes("Server-side requests")) return true;
      if (json?.msg && typeof json.msg === "string" && json.msg.toLowerCase().includes("restricted")) return true;
      if (json?.retMsg && typeof json.retMsg === "string" && json.retMsg.toLowerCase().includes("restricted")) return true;
      return false;
  };

  try {
    const res = await fetch(targetUrl, { signal: directController.signal });
    clearTimeout(directTimeout);
    if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const json = await res.json();
            if (!isRestricted(json)) return json;
        }
    }
  } catch (e) {
      clearTimeout(directTimeout);
  }

  const proxies = [
    (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ];

  // Race all proxies simultaneously for speed
  try {
      const proxyPromises = proxies.map(async (proxyGen) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs + 2000); // Give proxies slightly more time
          const proxyUrl = proxyGen(targetUrl);
          
          try {
              const res = await fetch(proxyUrl, { signal: controller.signal });
              clearTimeout(timeoutId);
              
              if (res.ok) {
                  const text = await res.text();
                  if (!text) throw new Error("Empty response");
                  let json;
                  try {
                      json = JSON.parse(text);
                  } catch (e) {
                      throw new Error("Invalid JSON: " + text.slice(0, 50));
                  }
                  
                  let finalJson = json;
                  if (proxyUrl.includes('allorigins') && json.contents) {
                      try { finalJson = JSON.parse(json.contents); } catch(e) { finalJson = json; }
                  }
                  
                  if (isRestricted(finalJson)) throw new Error("Restricted or proxy error");

                  return finalJson;
              }
              throw new Error("Proxy response not OK");
          } catch (err) {
              clearTimeout(timeoutId);
              throw err;
          }
      });

      return await Promise.any(proxyPromises);
  } catch (e) {
      throw new Error("Unable to fetch data from market APIs via direct or proxies.");
  }
};

// --- NEW: LSR (Long Short Ratio) FETCH ---
export const fetchLSRData = async (symbol: string, exchange: string) => {
    try {
        const cleanSymbol = symbol.replace('/', '').toUpperCase();
        if (exchange === 'Binance') {
            const data = await fetchWithProxy(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${cleanSymbol}&period=1h&limit=1`);
            if (data?.[0]) return { 
                ratio: parseFloat(data[0].longShortRatio), 
                long: parseFloat(data[0].longAccount) * 100, 
                short: parseFloat(data[0].shortAccount) * 100 
            };
        } else if (exchange === 'Bybit') {
            const data = await fetchWithProxy(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${cleanSymbol}&period=1h&limit=1`);
            if (data?.result?.list?.[0]) {
                const item = data.result.list[0];
                const long = parseFloat(item.buyRatio) * 100;
                const short = parseFloat(item.sellRatio) * 100;
                return { ratio: long / short, long, short };
            }
        } else if (exchange === 'OKX') {
            const ccy = cleanSymbol.replace('USDT', '');
            const data = await fetchWithProxy(`https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=1H`);
            if (data?.code === '0' && data?.data?.[0]) {
                const ratio = parseFloat(data.data[0][1]);
                const long = (ratio * 100) / (1 + ratio);
                const short = 100 - long;
                return { ratio, long, short };
            }
        }
        return null;
    } catch (e) {
        return null;
    }
};

// --- BINANCE (Futures) ---
export const fetchBinancePairs = async (): Promise<string[]> => {
  try {
    const data = await fetchWithProxy(`https://fapi.binance.com/fapi/v1/exchangeInfo?_t=${Date.now()}`);
    return data.symbols
      .filter((s: any) => s.contractType === 'PERPETUAL' && s.status === 'TRADING' && s.quoteAsset === 'USDT')
      .map((s: any) => s.symbol)
      .sort();
  } catch (e) {
    return ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  }
};

export const fetchBinanceData = async (symbol: string): Promise<MarketData | null> => {
  try {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const t = Date.now();
    const [fundingData, oiData, tickerData] = await Promise.all([
      fetchWithProxy(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${cleanSymbol}&_t=${t}`),
      fetchWithProxy(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${cleanSymbol}&_t=${t}`),
      fetchWithProxy(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${cleanSymbol}&_t=${t}`)
    ]);

    if (!fundingData || !oiData) return null;
    const markPrice = parseFloat(fundingData.markPrice);
    const oiValue = parseFloat(oiData.openInterest) * markPrice;
    const change = tickerData ? parseFloat(tickerData.priceChangePercent).toFixed(2) : '0.00';
    if (isNaN(markPrice)) return null;

    return {
      funding: formatFunding(parseFloat(fundingData.lastFundingRate)),
      oi: formatCryptoValue(oiValue),
      price: formatPrice(markPrice),
      change24h: change
    };
  } catch (e) {
    return null;
  }
};

export const fetchCVDData = async (symbol: string): Promise<CVDData | null> => {
  try {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const t = Date.now();
    const targetUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${cleanSymbol}&interval=1h&limit=24&_t=${t}`;
    const data = await fetchWithProxy(targetUrl);
    if (!Array.isArray(data) || data.length === 0) return null;

    let cumulativeDelta = 0;
    const firstOpen = parseFloat(data[0][1]);
    const lastClose = parseFloat(data[data.length - 1][4]);
    const priceChangePercent = ((lastClose - firstOpen) / firstOpen) * 100;

    for (const candle of data) {
        const totalVol = parseFloat(candle[5]);
        const buyVol = parseFloat(candle[9]);
        if (!isNaN(totalVol) && !isNaN(buyVol)) {
            const sellVol = totalVol - buyVol;
            const delta = buyVol - sellVol;
            cumulativeDelta += delta;
        }
    }
    if (isNaN(cumulativeDelta) || isNaN(priceChangePercent)) return null;
    return { delta: cumulativeDelta, priceChangePercent };
  } catch (e) {
    return null;
  }
};

export const fetchBybitPairs = async (): Promise<string[]> => {
  try {
    const data = await fetchWithProxy(`https://api.bybit.com/v5/market/instruments-info?category=linear&_t=${Date.now()}`);
    if (data.retCode !== 0) throw new Error(data.retMsg);
    return data.result.list
      .filter((s: any) => s.quoteCoin === 'USDT' && s.status === 'Trading')
      .map((s: any) => s.symbol)
      .sort();
  } catch (e) {
    return ['BTCUSDT', 'ETHUSDT'];
  }
};

export const fetchBybitData = async (symbol: string): Promise<MarketData | null> => {
  try {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const data = await fetchWithProxy(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${cleanSymbol}&_t=${Date.now()}`);
    if (data.retCode !== 0 || !data.result.list[0]) return null;
    const ticker = data.result.list[0];
    const price = parseFloat(ticker.lastPrice);
    const oi = parseFloat(ticker.openInterestValue);
    const change = (parseFloat(ticker.price24hPcnt) * 100).toFixed(2);
    if (isNaN(price)) return null;
    return {
      funding: formatFunding(parseFloat(ticker.fundingRate)),
      oi: formatCryptoValue(oi),
      price: formatPrice(price),
      change24h: change
    };
  } catch (e) {
    return null;
  }
};

export const fetchBitgetPairs = async (): Promise<string[]> => {
  try {
    const data = await fetchWithProxy(`https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES&_t=${Date.now()}`);
    if (!data || !Array.isArray(data.data)) throw new Error('Invalid Bitget pairs data');
    return data.data.map((s: any) => s.symbol).sort();
  } catch (e) {
    return ['BTCUSDT', 'ETHUSDT'];
  }
};

export const fetchBitgetData = async (symbol: string): Promise<MarketData | null> => {
  try {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const data = await fetchWithProxy(`https://api.bitget.com/api/v2/mix/market/ticker?symbol=${cleanSymbol}&productType=USDT-FUTURES&_t=${Date.now()}`);
    if (data.code !== '00000' || !data.data[0]) return null;
    const ticker = data.data[0];
    const price = parseFloat(ticker.lastPr);
    const oiRaw = parseFloat(ticker.openInterest);
    const change = (parseFloat(ticker.change24h) * 100).toFixed(2);
    const oiValue = isNaN(oiRaw) ? null : oiRaw * price;
    if (isNaN(price)) return null;
    return {
      funding: formatFunding(parseFloat(ticker.fundingRate)),
      oi: formatCryptoValue(oiValue),
      price: formatPrice(price),
      change24h: change
    };
  } catch (e) {
    return null;
  }
};

/* ADD FIX: Export missing depth fetcher for Binance */
export const fetchBinanceDepth = async (symbol: string) => {
  try {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    return await fetchWithProxy(`https://fapi.binance.com/fapi/v1/depth?symbol=${cleanSymbol}&limit=100`);
  } catch (e) {
    return null;
  }
};

/* ADD FIX: Export missing trades fetcher for Binance */
export const fetchBinanceTrades = async (symbol: string) => {
  try {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    return await fetchWithProxy(`https://fapi.binance.com/fapi/v1/trades?symbol=${cleanSymbol}&limit=100`);
  } catch (e) {
    return null;
  }
};

/* ADD FIX: Export missing depth fetcher for Bybit */
export const fetchBybitDepth = async (symbol: string) => {
  try {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    return await fetchWithProxy(`https://api.bybit.com/v5/market/orderbook?category=linear&symbol=${cleanSymbol}&limit=100&_t=${Date.now()}`);
  } catch (e) {
    return null;
  }
};

/* ADD FIX: Export missing trades fetcher for Bybit */
export const fetchBybitTrades = async (symbol: string) => {
  try {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    return await fetchWithProxy(`https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=${cleanSymbol}&limit=100&_t=${Date.now()}`);
  } catch (e) {
    return null;
  }
};

/* ADD FIX: Export missing depth fetcher for Bitget */
export const fetchBitgetDepth = async (symbol: string) => {
  try {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    return await fetchWithProxy(`https://api.bitget.com/api/v2/mix/market/depth?symbol=${cleanSymbol}&productType=USDT-FUTURES&limit=100`);
  } catch (e) {
    return null;
  }
};

/* ADD FIX: Export missing trades fetcher for Bitget */
export const fetchBitgetTrades = async (symbol: string) => {
  try {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    return await fetchWithProxy(`https://api.bitget.com/api/v2/mix/market/fills?symbol=${cleanSymbol}&productType=USDT-FUTURES&limit=100`);
  } catch (e) {
    return null;
  }
};

// --- OKX ---
export const fetchOkxPairs = async (): Promise<string[]> => {
  try {
    const data = await fetchWithProxy(`https://www.okx.com/api/v5/public/instruments?instType=SWAP`);
    if (data.code !== '0') throw new Error(data.msg);
    return data.data
      .filter((s: any) => s.settleCcy === 'USDT' && s.state === 'live')
      .map((s: any) => s.instId.replace('-USDT-SWAP', 'USDT'))
      .sort();
  } catch (e) {
    return ['BTCUSDT', 'ETHUSDT'];
  }
};

export const fetchOkxData = async (symbol: string): Promise<MarketData | null> => {
  try {
    const okxSymbol = symbol.replace('/', '').toUpperCase().replace('USDT', '-USDT-SWAP');
    const [tickerData, fundingData, oiData] = await Promise.all([
      fetchWithProxy(`https://www.okx.com/api/v5/market/ticker?instId=${okxSymbol}`),
      fetchWithProxy(`https://www.okx.com/api/v5/public/funding-rate?instId=${okxSymbol}`),
      fetchWithProxy(`https://www.okx.com/api/v5/public/open-interest?instId=${okxSymbol}`)
    ]);

    if (tickerData.code !== '0' || !tickerData.data[0]) return null;
    
    const ticker = tickerData.data[0];
    const price = parseFloat(ticker.last);
    
    let oiValue = null;
    if (oiData.code === '0' && oiData.data[0]) {
      const oiCcy = parseFloat(oiData.data[0].oiCcy);
      if (!isNaN(oiCcy) && !isNaN(price)) {
        oiValue = oiCcy * price;
      }
    }

    let fundingRate = '---';
    if (fundingData.code === '0' && fundingData.data[0]) {
      fundingRate = formatFunding(parseFloat(fundingData.data[0].fundingRate));
    }

    const openPrice = parseFloat(ticker.open24h);
    const change = openPrice > 0 ? ((price - openPrice) / openPrice * 100).toFixed(2) : '0.00';

    if (isNaN(price)) return null;

    return {
      funding: fundingRate,
      oi: formatCryptoValue(oiValue),
      price: formatPrice(price),
      change24h: change
    };
  } catch (e) {
    return null;
  }
};

export const fetchOkxDepth = async (symbol: string) => {
  try {
    const okxSymbol = symbol.replace('/', '').toUpperCase().replace('USDT', '-USDT-SWAP');
    return await fetchWithProxy(`https://www.okx.com/api/v5/market/books?instId=${okxSymbol}&sz=100`);
  } catch (e) {
    return null;
  }
};

export const fetchOkxTrades = async (symbol: string) => {
  try {
    const okxSymbol = symbol.replace('/', '').toUpperCase().replace('USDT', '-USDT-SWAP');
    return await fetchWithProxy(`https://www.okx.com/api/v5/market/trades?instId=${okxSymbol}&limit=100`);
  } catch (e) {
    return null;
  }
};

export const fetchMarketKlines = async (symbol: string, interval: string, limit: number = 100) => {
    let cleanSymbol = symbol.replace('/', '').toUpperCase();
    if (!cleanSymbol.endsWith('USDT')) cleanSymbol += 'USDT';
    try {
        const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${cleanSymbol}&interval=${interval}&limit=${limit}`;
        return await fetchWithProxy(url);
    } catch (e) {
        console.warn("Unable to fetch klines:", e);
        return [];
    }
};

export const fetchOpenInterestHist = async (symbol: string, period: string, limit: number = 10) => {
    let cleanSymbol = symbol.replace('/', '').toUpperCase();
    if (!cleanSymbol.endsWith('USDT')) cleanSymbol += 'USDT';
    try {
        const url = `https://fapi.binance.com/futures/data/openInterestHist?symbol=${cleanSymbol}&period=${period}&limit=${limit}`;
        return await fetchWithProxy(url);
    } catch (e) {
        console.warn("Unable to fetch OI history:", e);
        return [];
    }
};

export const fetchDeribitOptions = async (currency: string = "BTC") => {
    try {
        const url = `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${currency}&kind=option`;
        return await fetchWithProxy(url);
    } catch (e) {
        return null;
    }
};

export const fetchYahooData = async (symbol: string) => {
    try {
        const data = await fetchWithProxy(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
        if (data && data.chart && data.chart.result && data.chart.result[0]) {
            const meta = data.chart.result[0].meta;
            const price = meta.regularMarketPrice;
            const change = ((price - meta.chartPreviousClose) / meta.chartPreviousClose) * 100;
            return { price, change };
        }
    } catch (e) {
        // Fallback silencioso
    }
    return { price: 0, change: 0 };
};
