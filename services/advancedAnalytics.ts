
import { 
    fetchBinanceDepth, fetchBinanceTrades, 
    fetchBybitDepth, fetchBybitTrades, 
    fetchBitgetDepth, fetchBitgetTrades,
    fetchOkxDepth, fetchOkxTrades,
    fetchWithProxy, fetchLSRData
} from './cryptoApi';

// Helper to sum volumes
const sumVolume = (orders: any[]) => {
    if (!orders || !Array.isArray(orders)) return 0;
    return orders.reduce((acc, curr) => acc + (parseFloat(curr[1]) || 0), 0);
};

// 1. Calculate Orderbook Imbalance (Bids vs Asks)
const calculateImbalance = (bids: any[], asks: any[]) => {
    const bidVol = sumVolume(bids);
    const askVol = sumVolume(asks);
    const total = bidVol + askVol;
    if (total === 0) return 0;
    return ((bidVol - askVol) / total) * 100;
};

// 2. Calculate CVD / Delta from Recent Trades
const calculateTradeFlow = (trades: any[], exchange: string) => {
    let buyVol = 0;
    let sellVol = 0;
    if (!trades || !Array.isArray(trades)) return { delta: 0, cvd: 'Neutro' };

    trades.forEach(t => {
        let isBuyerMaker = false; 
        let qty = 0;
        if (exchange === 'Binance') {
            isBuyerMaker = t.m; 
            qty = parseFloat(t.q);
        } else if (exchange === 'Bybit') {
            isBuyerMaker = t.side === 'Sell'; 
            qty = parseFloat(t.size);
        } else if (exchange === 'Bitget') {
            isBuyerMaker = t.side === 'sell';
            qty = parseFloat(t.size);
        } else if (exchange === 'OKX') {
            isBuyerMaker = t.side === 'sell';
            qty = parseFloat(t.sz);
        }
        if (isBuyerMaker) sellVol += qty; 
        else buyVol += qty; 
    });

    const delta = buyVol - sellVol;
    const cvdStatus = delta > 0 ? 'Positivo (Absorção Compra)' : 'Negativo (Pressão Venda)';
    return { delta, buyVol, sellVol, cvdStatus };
};

// 3. REBUILT PREMIUM INDEX LOGIC - FIXED TO AVOID INCORRECT ZEROS
const getSpotPremiumState = async (pair: string, exchange: string) => {
    try {
        let rawSymbol = pair.toUpperCase().replace('/', '').replace('-', '').replace('_', '');
        rawSymbol = rawSymbol.split(' ')[0]; 
        if (rawSymbol.includes('PERP')) rawSymbol = rawSymbol.replace('PERP', '');

        let base = rawSymbol;
        if (rawSymbol.endsWith('USDT')) base = rawSymbol.replace('USDT', '');
        else if (rawSymbol.endsWith('USD')) base = rawSymbol.replace('USD', '');

        const futSymbol = `${base}USDT`;
        
        // Spot Mapping: Handle 1000x / 100x symbol prefixes common in Futures but absent in Spot
        let spotBase = base;
        if (spotBase.startsWith('1000000')) spotBase = spotBase.substring(7);
        else if (spotBase.startsWith('1000')) spotBase = spotBase.substring(4);
        else if (spotBase.startsWith('100')) spotBase = spotBase.substring(3);
        const spotSymbol = `${spotBase}USDT`;

        let spotPrice = 0;
        let markPrice = 0;

        if (exchange === 'Binance') {
             const [spotData, futData] = await Promise.all([
                 fetchWithProxy(`https://api.binance.com/api/v3/ticker/price?symbol=${spotSymbol}`),
                 fetchWithProxy(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${futSymbol}`)
             ]);
             if (spotData?.price) spotPrice = parseFloat(spotData.price);
             if (futData?.markPrice) markPrice = parseFloat(futData.markPrice);
        } else if (exchange === 'Bybit') {
             const [spotData, futData] = await Promise.all([
                 fetchWithProxy(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${spotSymbol}`),
                 fetchWithProxy(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${futSymbol}`)
             ]);
             if (spotData?.retCode === 0 && spotData.result?.list?.[0]) spotPrice = parseFloat(spotData.result.list[0].lastPrice);
             if (futData?.retCode === 0 && futData.result?.list?.[0]) markPrice = parseFloat(futData.result.list[0].markPrice);
        } else if (exchange === 'OKX') {
             const okxSpot = `${spotBase}-USDT`;
             const okxFut = `${base}-USDT-SWAP`;
             const [spotData, futData] = await Promise.all([
                 fetchWithProxy(`https://www.okx.com/api/v5/market/ticker?instId=${okxSpot}`),
                 fetchWithProxy(`https://www.okx.com/api/v5/market/ticker?instId=${okxFut}`)
             ]);
             if (spotData?.code === '0' && spotData.data?.[0]) spotPrice = parseFloat(spotData.data[0].last);
             if (futData?.code === '0' && futData.data?.[0]) markPrice = parseFloat(futData.data[0].last);
        }

        // Precision Comparison: Never return 0 if data is actually missing
        if (spotPrice > 0 && markPrice > 0) {
            const premium = ((markPrice - spotPrice) / spotPrice) * 100;
            let text = "NEUTRO";
            if (premium > 0.05) text = "SOBRECOMPRA (Futures > Spot)";
            else if (premium < -0.05) text = "SOBREVENDA (Spot > Futures)";
            else text = "EQUILÍBRIO";
            return { value: premium, text };
        }
        return { value: null, text: "N/A" };
    } catch (e) {
        return { value: null, text: "N/A" };
    }
};

import { calculateRSI, calculateEMA, calculateMACD, calculateADX, calculateATR } from './tradingViewIndicators';


const fetchTechnicalContext = async (pair: string, exchange: string, timeframe: string, emaPeriods: string[] = []) => {
    try {
        const symbol = pair.replace('/', '').replace('USDT', '') + 'USDT';
        let klines = [];
        let closes: number[] = [], highs: number[] = [], lows: number[] = [], volumes: number[] = [];
        if (exchange === 'Bybit') {
            const tfMap: Record<string, string> = { '15m': '15', '1h': '60', '4h': '240', '1d': 'D', '1w': 'W' };
            const tf = tfMap[timeframe] || '240';
            const data = await fetchWithProxy(`https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${tf}&limit=1000`);
            if (data && data.retCode === 0 && data.result?.list) {
                klines = data.result.list.reverse();
                highs = klines.map((k: any) => parseFloat(k[2])); lows = klines.map((k: any) => parseFloat(k[3]));
                closes = klines.map((k: any) => parseFloat(k[4])); volumes = klines.map((k: any) => parseFloat(k[5]));
            }
        } else if (exchange === 'OKX') {
            const okxSymbol = pair.replace('/', '').toUpperCase().replace('USDT', '-USDT-SWAP');
            const tfMap: Record<string, string> = { '15m': '15m', '1h': '1H', '4h': '4H', '1d': '1D', '1w': '1W' };
            const tf = tfMap[timeframe] || '4H';
            const data = await fetchWithProxy(`https://www.okx.com/api/v5/market/candles?instId=${okxSymbol}&bar=${tf}&limit=300`);
            if (data && data.code === '0') {
                klines = data.data.reverse();
                highs = klines.map((k: any) => parseFloat(k[2])); lows = klines.map((k: any) => parseFloat(k[3]));
                closes = klines.map((k: any) => parseFloat(k[4])); volumes = klines.map((k: any) => parseFloat(k[5]));
            }
        } else {
            const data = await fetchWithProxy(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${timeframe}&limit=1500`);
            if (Array.isArray(data) && data.length > 0) {
                highs = data.map((k: any) => parseFloat(k[2])); lows = data.map((k: any) => parseFloat(k[3]));
                closes = data.map((k: any) => parseFloat(k[4])); volumes = data.map((k: any) => parseFloat(k[5]));
            }
        }
        if (closes.length < 100) return null;

        // Dynamic EMAs based on detected periods from the chart scan
        const emas: Record<string, number> = {};
        emaPeriods.forEach(p => {
            const period = parseInt(p);
            if (!isNaN(period) && period > 0) {
                const emaValue = calculateEMA(closes, period);
                if (emaValue > 0) {
                    emas[p] = emaValue;
                }
            }
        });

        return { 
            rsi: calculateRSI(closes), 
            macd: calculateMACD(closes), 
            adx: calculateADX(highs, lows, closes),
            atr: calculateATR(highs, lows, closes),
            emas,
            lastClose: closes[closes.length - 1] 
        };
    } catch (e) { return null; }
};

const analyzeTrendState = (techData: any) => {
    if (!techData) return "Dados Insuficientes";
    const { emas, lastClose, macd } = techData;
    // Base trend on the largest detected EMA if available, else MACD
    const periods = Object.keys(emas).map(p => parseInt(p)).sort((a, b) => b - a);
    const mainEMA = periods.length > 0 ? emas[periods[0].toString()] : 0;
    
    const direction = mainEMA > 0 ? (lastClose > mainEMA ? "ALTA" : "BAIXA") : (macd.macd > 0 ? "ALTA" : "BAIXA");
    return `${direction} | MACD: ${macd.macd > 0 ? "Força" : "Fraqueza"}`;
};

const classifyMarketRegime = (techData: any): string => {
    if (!techData) return "Desconhecido";
    const { rsi, macd } = techData;
    
    if (rsi > 70) return "Exaustão (Sobrecomprado)";
    if (rsi < 30) return "Exaustão (Sobrevendido)";
    if (Math.abs(macd.macd) < 0.001) return "Compressão / Exaustão";
    
    return "Transição / Indefinido";
};

export interface AdvancedData {
    contextText: string;
    rawData: { delta: string; imbalance: string; walls: string; regime: string; spotStatus: string; premiumValue: string | null; };
    indicators?: {
        rsi?: number;
        adx?: number;
        atr?: number;
        macd?: { macd: number; signal: number; hist: number; };
        emas?: Record<string, number>;
    };
}

export const generateAdvancedContext = async (pair: string, exchange: string, timeframe: string = '4h', emaPeriods: string[] = []): Promise<AdvancedData> => {
    try {
        let depthData = null, tradeData = null, depthError = false;
        try {
            if (exchange === 'Binance') { [depthData, tradeData] = await Promise.all([fetchBinanceDepth(pair), fetchBinanceTrades(pair)]); }
            else if (exchange === 'Bybit') { const d = await fetchBybitDepth(pair), t = await fetchBybitTrades(pair); depthData = d?.result; tradeData = t?.result?.list; }
            else if (exchange === 'Bitget') { const d = await fetchBitgetDepth(pair), t = await fetchBitgetTrades(pair); depthData = d?.data; tradeData = t?.data; }
            else if (exchange === 'OKX') { const d = await fetchOkxDepth(pair), t = await fetchOkxTrades(pair); depthData = d?.data?.[0]; tradeData = t?.data; }
        } catch (err) { depthError = true; }

        let imbalance = 0, wallsText = "Nenhuma Wall Detectada";
        if (!depthError && depthData) {
            const bids = depthData.bids || depthData.asks || [], asks = depthData.asks || [];
            if (bids.length > 0 && asks.length > 0) {
                imbalance = ((sumVolume(bids) - sumVolume(asks)) / (sumVolume(bids) + sumVolume(asks))) * 100;
                wallsText = Math.abs(imbalance) > 20 ? (imbalance > 0 ? "Bid Wall" : "Ask Wall") : "Equilíbrio";
            }
        }

        const flow = calculateTradeFlow(tradeData, exchange);
        const premiumData = await getSpotPremiumState(pair, exchange);
        
        const lsr = await fetchLSRData(pair, exchange);
        const lsrText = lsr ? `${lsr.ratio.toFixed(2)} (${lsr.long.toFixed(1)}% Long / ${lsr.short.toFixed(1)}% Short)` : "N/A (Indisponível)";

        const mtfPromise = Promise.all([
            fetchTechnicalContext(pair, exchange, timeframe, emaPeriods), 
            fetchTechnicalContext(pair, exchange, '4h', emaPeriods), 
            fetchTechnicalContext(pair, exchange, '1d', emaPeriods), 
            fetchTechnicalContext(pair, exchange, '1w', emaPeriods)
        ]);
        const [techData, tf4h, tf1d, tf1w] = await mtfPromise;
        
        let techText = "N/A", mtfText = "N/A";

        if (techData) {
            let emaStr = "N/A";
            if (techData.emas && Object.keys(techData.emas).length > 0) {
                emaStr = Object.entries(techData.emas).map(([p, val]) => `EMA${p}=${(val as number).toFixed(2)}`).join(" | ");
            }
            techText = `RSI=${techData.rsi != null ? techData.rsi.toFixed(2) : 'N/D'} | MACD=${techData.macd?.macd != null ? techData.macd.macd.toFixed(4) : 'N/D'} | ADX=${techData.adx != null ? techData.adx.toFixed(2) : 'N/D'} | ATR=${techData.atr != null ? techData.atr.toFixed(4) : 'N/D'} | ${emaStr}`;
            mtfText = `4H: ${analyzeTrendState(tf4h)} | 1D: ${analyzeTrendState(tf1d)} | 1W: ${analyzeTrendState(tf1w)}`;
        }

        const premiumValueFormatted = premiumData.value !== null ? premiumData.value.toFixed(4) : null;

        const premiumLine = premiumValueFormatted !== null 
            ? `- Premium Index: ${premiumValueFormatted}% (${premiumData.text})`
            : `- Premium Index: INDISPONÍVEL (DADO NÃO DISPONÍVEL NA API - NÃO CITE NA ANÁLISE)`;

        const regime = classifyMarketRegime(techData);

        const contextText = `
        [MICROESTRUTURA]
        - Walls: ${wallsText} (Imbalance: ${imbalance.toFixed(2)}%)
        - Delta (CVD): ${flow.delta.toFixed(4)} (${flow.cvdStatus})
        ${premiumLine}
        - Long Short Ratio (LSR): ${lsrText}
        
        [INDICADORES]
        ${techText}
        - Regime: ${regime}
        
        [MTF]
        ${mtfText}
        `;

        return { 
            contextText, 
            rawData: { 
                delta: flow.delta.toFixed(4), 
                imbalance: `${imbalance.toFixed(2)}%`, 
                walls: wallsText, 
                regime: regime, 
                spotStatus: premiumData.text, 
                premiumValue: premiumValueFormatted
            },
            indicators: techData ? {
                rsi: techData.rsi,
                adx: techData.adx,
                atr: techData.atr,
                macd: techData.macd,
                emas: techData.emas
            } : undefined
        };
    } catch (e) {
        return { contextText: "[Erro]", rawData: { delta: "N/A", imbalance: "N/A", walls: "N/A", regime: "N/A", spotStatus: "N/A", premiumValue: null }, indicators: undefined };
    }
};
