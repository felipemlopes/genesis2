import { fetchWithProxy } from './cryptoApi';

export const fetchDexScreenerContext = async (symbol: string) => {
    try {
        const cleanSymbol = symbol.replace('USDT', '').replace('USD', '');
        const data = await fetchWithProxy(`https://api.dexscreener.com/latest/dex/search?q=${cleanSymbol}`);
        if (data && data.pairs && data.pairs.length > 0) {
            // Get the most liquid pair
            const bestPair = data.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
            if (bestPair && bestPair.liquidity && bestPair.liquidity.usd > 100000) {
                return `DEX Liquidity (${bestPair.dexId}): $${bestPair.liquidity.usd.toLocaleString()} | 24h Vol: $${bestPair.volume?.h24?.toLocaleString() || 0} | FDV: $${bestPair.fdv?.toLocaleString() || 0}`;
            }
        }
        return null;
    } catch (e) {
        return null;
    }
};

export const fetchFredMacroContext = async () => {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) return null;
    
    try {
        // Fetch DXY proxy (DTWEXBGS) or similar, or just FEDFUNDS
        const data = await fetchWithProxy(`https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`);
        if (data && data.observations && data.observations.length > 0) {
            const obs = data.observations[0];
            return `FEDFUNDS Rate: ${obs.value}% (Date: ${obs.date})`;
        }
        return null;
    } catch (e) {
        return null;
    }
};

let defiLlamaCache: any[] | null = null;
let defiLlamaCacheTime = 0;

export const fetchDefiLlamaContext = async (symbol: string) => {
    try {
        const cleanSymbol = symbol.replace('USDT', '').replace('USD', '');
        
        if (!defiLlamaCache || Date.now() - defiLlamaCacheTime > 3600000) { // 1 hour cache
            const data = await fetchWithProxy(`https://api.llama.fi/protocols`);
            if (Array.isArray(data)) {
                defiLlamaCache = data;
                defiLlamaCacheTime = Date.now();
            }
        }

        if (defiLlamaCache) {
            const protocol = defiLlamaCache.find((p: any) => p.symbol.toUpperCase() === cleanSymbol.toUpperCase());
            if (protocol) {
                return `DeFi TVL (${protocol.name}): $${protocol.tvl.toLocaleString()} | Category: ${protocol.category}`;
            }
        }
        return null;
    } catch (e) {
        return null;
    }
};

export const fetchAlternativeMeContext = async () => {
    try {
        const data = await fetchWithProxy('https://api.alternative.me/fng/?limit=1');
        if (data && data.data && data.data.length > 0) {
            const fng = data.data[0];
            return `Fear & Greed Index: ${fng.value} (${fng.value_classification})`;
        }
        return null;
    } catch (e) {
        return null;
    }
};

export const fetchCryptoCompareContext = async (symbol: string) => {
    try {
        const cleanSymbol = symbol.replace('USDT', '').replace('USD', '');
        const data = await fetchWithProxy(`https://min-api.cryptocompare.com/data/v2/news/?categories=${cleanSymbol},Market&lang=EN&limit=3`);
        if (data && data.Data && data.Data.length > 0) {
            const news = data.Data.map((n: any) => `- ${n.title}`).join('\n');
            return `Latest News (${cleanSymbol}):\n${news}`;
        }
        return null;
    } catch (e) {
        return null;
    }
};
