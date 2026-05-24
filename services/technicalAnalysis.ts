export const calculatePDH_PDL = (klines: any[]) => {
    // klines normally: [timestamp, open, high, low, close, volume, closeTime, ...]
    // Day previous (we can just look at the last completed 1d candle if given 1d klines, or we can use 1h klines to find previous UTC day)
    // Assuming we pass daily klines where the last is current day and second to last is previous day:
    if (!klines || !Array.isArray(klines) || klines.length < 2) {
        console.warn(`[calculatePDH_PDL] Falha na validação em klines: esperado array com pelo menos 2 elementos, recebido:`, klines);
        return { pdh: 0, pdl: 0 };
    }
    const prevDay = klines[klines.length - 2];
    return {
        pdh: parseFloat(prevDay[2]),
        pdl: parseFloat(prevDay[3])
    };
};

export const calculatePWH_PWL = (klines: any[]) => {
    // Assuming we pass weekly klines where last is current week and second to last is previous week:
    if (!klines || !Array.isArray(klines) || klines.length < 2) {
        console.warn(`[calculatePWH_PWL] Falha na validação em klines: esperado array com pelo menos 2 elementos, recebido:`, klines);
        return { pwh: 0, pwl: 0 };
    }
    const prevWeek = klines[klines.length - 2];
    return {
        pwh: parseFloat(prevWeek[2]),
        pwl: parseFloat(prevWeek[3])
    };
};

export const identificarEqualHighsLows = (klines: any[]) => {
    if (!klines || !Array.isArray(klines) || klines.length === 0) {
        console.warn(`[identificarEqualHighsLows] Falha na validação em klines: esperado array não vazio, recebido:`, klines);
        return { equalHighs: 0, equalLows: 0 };
    }
    // klines of lower timeframe, e.g. 15m or 1h (last 100)
    let sortedHighs = [...klines].map((k: any) => parseFloat(k[2])).sort((a,b)=>b-a);
    let sortedLows = [...klines].map((k: any) => parseFloat(k[3])).sort((a,b)=>a-b);
    let equalHighs = [];
    let equalLows = [];

    // equal highs check (diff < 0.15%)
    for (let i = 0; i < sortedHighs.length - 1; i++) {
        const diff = (sortedHighs[i] - sortedHighs[i+1]) / sortedHighs[i] * 100;
        if (diff < 0.15) {
            equalHighs.push({ price: sortedHighs[i] });
        }
    }

    // equal lows check (diff < 0.15%)
    for (let i = 0; i < sortedLows.length - 1; i++) {
        const diff = (sortedLows[i+1] - sortedLows[i]) / sortedLows[i] * 100;
        if (diff < 0.15) {
            equalLows.push({ price: sortedLows[i] });
        }
    }

    return { 
        equalHighs: equalHighs.length > 0 ? equalHighs[0].price : 0, 
        equalLows: equalLows.length > 0 ? equalLows[0].price : 0 
    };
};

export const calculateATR = (klines: any[], period = 14) => {
    if (!klines || !Array.isArray(klines) || klines.length < period + 1) {
        console.warn(`[calculateATR] Falha na validação em klines: esperado array com pelo menos ${period + 1} elementos, recebido:`, klines);
        return { value: 0, percent: 0 };
    }
    let trs = [];
    for (let i = 1; i < klines.length; i++) {
        const high = parseFloat(klines[i][2]);
        const low = parseFloat(klines[i][3]);
        const prevClose = parseFloat(klines[i-1][4]);
        const tr1 = high - low;
        const tr2 = Math.abs(high - prevClose);
        const tr3 = Math.abs(low - prevClose);
        trs.push(Math.max(tr1, tr2, tr3));
    }
    
    // Simple average of TRs for the given period (at the end of the array)
    const recentTrs = trs.slice(-period);
    const atr = recentTrs.reduce((a, b) => a + b, 0) / period;
    const currentPrice = parseFloat(klines[klines.length - 1][4]);
    return {
        value: atr,
        percent: (atr / currentPrice) * 100
    };
};
