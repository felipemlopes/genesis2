export interface Candle {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

const _calcularEMA = (candles: Candle[], periodo: number): number | null => {
    if (candles.length < periodo * 2) return null;
    
    // First EMA is SMA of the first N candles
    let initialSum = 0;
    for (let i = 0; i < periodo; i++) {
        initialSum += candles[i].close;
    }
    let ema = initialSum / periodo;
    
    const k = 2 / (periodo + 1);
    for (let i = periodo; i < candles.length; i++) {
        ema = (candles[i].close - ema) * k + ema;
    }
    
    const currentPrice = candles[candles.length - 1].close;
    if (isFinite(ema) && ema > 0 && ema >= currentPrice * 0.1 && ema <= currentPrice * 10) {
        return ema;
    }
    return null;
};

const _calcularRSI = (candles: Candle[], periodo: number = 14): number | null => {
    if (candles.length <= periodo) return null;
    let gains = 0;
    let losses = 0;
    
    // Calculate initial average gain/loss
    for (let i = 1; i <= periodo; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    
    let avgGain = gains / periodo;
    let avgLoss = losses / periodo;
    
    // Smooth using Wilder's smoothing
    for (let i = periodo + 1; i < candles.length; i++) {
        const diff = candles[i].close - candles[i - 1].close;
        if (diff > 0) {
            avgGain = (avgGain * (periodo - 1) + diff) / periodo;
            avgLoss = (avgLoss * (periodo - 1)) / periodo;
        } else {
            avgGain = (avgGain * (periodo - 1)) / periodo;
            avgLoss = (avgLoss * (periodo - 1) - diff) / periodo;
        }
    }
    
    if (avgLoss === 0) return 99;
    if (avgGain === 0) return 1;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    if (rsi >= 1 && rsi <= 99) return rsi;
    return null;
};

const _calcularATR = (candles: Candle[], periodo: number = 14): number | null => {
    if (candles.length <= periodo) return null;
    
    const trs = [];
    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trs.push(tr);
    }
    
    // Initial ATR is simple average of first N TRs
    let atr = 0;
    for (let i = 0; i < periodo; i++) {
        atr += trs[i];
    }
    atr /= periodo;
    
    // Wilder's smoothing for remaining
    for (let i = periodo; i < trs.length; i++) {
        atr = (atr * (periodo - 1) + trs[i]) / periodo;
    }
    
    if (atr > 0) return atr;
    return null;
};

const _calcularADX = (candles: Candle[], periodo: number = 14): { adx: number; diPlus: number; diMinus: number } | null => {
    if (candles.length <= periodo * 2) return null; // Need more strictly for smoothing
    
    let trs = [];
    let pdms = [];
    let ndms = [];
    
    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevHigh = candles[i - 1].high;
        const prevLow = candles[i - 1].low;
        const prevClose = candles[i - 1].close;
        
        const upMove = high - prevHigh;
        const downMove = prevLow - low;
        
        let pdm = 0;
        let ndm = 0;
        
        if (upMove > downMove && upMove > 0) pdm = upMove;
        if (downMove > upMove && downMove > 0) ndm = downMove;
        
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        
        trs.push(tr);
        pdms.push(pdm);
        ndms.push(ndm);
    }
    
    const wilderSmooth = (data: number[], period: number) => {
        let smoothed = [];
        let initial = 0;
        for (let i = 0; i < period; i++) initial += data[i];
        smoothed.push(initial);
        
        for (let i = period; i < data.length; i++) {
            const prev = smoothed[smoothed.length - 1];
            smoothed.push(prev - (prev / period) + data[i]);
        }
        return smoothed;
    };
    
    const smoothedTR = wilderSmooth(trs, periodo);
    const smoothedPDM = wilderSmooth(pdms, periodo);
    const smoothedNDM = wilderSmooth(ndms, periodo);
    
    let dxs = [];
    let finalDiPlus = 0;
    let finalDiMinus = 0;
    
    for (let i = 0; i < smoothedTR.length; i++) {
        const tr = smoothedTR[i];
        const diPlus = tr > 0 ? (smoothedPDM[i] / tr) * 100 : 0;
        const diMinus = tr > 0 ? (smoothedNDM[i] / tr) * 100 : 0;
        
        if (i === smoothedTR.length - 1) {
            finalDiPlus = diPlus;
            finalDiMinus = diMinus;
        }
        
        const diff = Math.abs(diPlus - diMinus);
        const sum = diPlus + diMinus;
        const dx = sum === 0 ? 0 : (diff / sum) * 100;
        dxs.push(dx);
    }
    
    let adx = 0;
    let initialDxSum = 0;
    for(let i=0; i<periodo; i++) initialDxSum += dxs[i];
    adx = initialDxSum / periodo;
    
    for (let i = periodo; i < dxs.length; i++) {
        adx = (adx * (periodo - 1) + dxs[i]) / periodo;
    }
    
    if (adx >= 0 && adx <= 100 && finalDiPlus >= 0 && finalDiPlus <= 100 && finalDiMinus >= 0 && finalDiMinus <= 100) {
        return { adx, diPlus: finalDiPlus, diMinus: finalDiMinus };
    }
    return null;
};

const _calcularMACD = (candles: Candle[]): { macd: number; signal: number; histogram: number } | null => {
    const fastPeriod = 12;
    const slowPeriod = 26;
    const signalPeriod = 9;
    
    if (candles.length < slowPeriod + signalPeriod) return null;
    
    const emaFast = calcularEMA(candles, fastPeriod);
    const emaSlow = calcularEMA(candles, slowPeriod);
    if (emaFast === null || emaSlow === null) return null;
    
    const macdSeries = [];
    
    // Reconstruct full EMA series to calculate Signal
    let sumFast = 0, sumSlow = 0;
    for(let i=0; i<fastPeriod; i++) sumFast += candles[i].close;
    for(let i=0; i<slowPeriod; i++) sumSlow += candles[i].close;
    
    let currentEmaFast = sumFast / fastPeriod;
    let currentEmaSlow = sumSlow / slowPeriod;
    
    const kFast = 2 / (fastPeriod + 1);
    const kSlow = 2 / (slowPeriod + 1);
    
    for (let i = slowPeriod; i < candles.length; i++) {
        // Fast will have started earlier, but we just re-run it
        currentEmaFast = (candles[i].close - currentEmaFast) * kFast + currentEmaFast;
        currentEmaSlow = (candles[i].close - currentEmaSlow) * kSlow + currentEmaSlow;
        macdSeries.push(currentEmaFast - currentEmaSlow);
    }
    
    // Need at least 9 values of MACD to calculate signal EMA
    if (macdSeries.length < signalPeriod) return null;
    
    let signalSum = 0;
    for(let i=0; i<signalPeriod; i++) signalSum += macdSeries[i];
    let signalEma = signalSum / signalPeriod;
    
    const kSignal = 2 / (signalPeriod + 1);
    for (let i = signalPeriod; i < macdSeries.length; i++) {
        signalEma = (macdSeries[i] - signalEma) * kSignal + signalEma;
    }
    
    const currentMacd = macdSeries[macdSeries.length - 1];
    return {
        macd: currentMacd,
        signal: signalEma,
        histogram: currentMacd - signalEma
    };
};

const _calcularBollinger = (candles: Candle[], periodo: number = 20, desvios: number = 2): { upper: number; middle: number; lower: number } | null => {
    if (candles.length < periodo) return null;
    
    const recent = candles.slice(-periodo);
    const middle = recent.reduce((sum, c) => sum + c.close, 0) / periodo;
    
    let sqSum = 0;
    for (const c of recent) {
        sqSum += Math.pow(c.close - middle, 2);
    }
    const stdev = Math.sqrt(sqSum / periodo);
    
    return {
        upper: middle + (stdev * desvios),
        middle,
        lower: middle - (stdev * desvios)
    };
};

const _calcularVWAP = (candles: Candle[]): number | null => {
    if (candles.length === 0) return null;
    
    const lastDate = new Date(candles[candles.length - 1].timestamp);
    const currentDayStr = lastDate.toISOString().split('T')[0];
    
    let sumVP = 0;
    let sumV = 0;
    
    for (let i = candles.length - 1; i >= 0; i--) {
        const d = new Date(candles[i].timestamp);
        if (d.toISOString().split('T')[0] === currentDayStr) {
            const typicalPrice = (candles[i].high + candles[i].low + candles[i].close) / 3;
            sumVP += typicalPrice * candles[i].volume;
            sumV += candles[i].volume;
        } else {
            break;
        }
    }
    
    if (sumV === 0) return null;
    return sumVP / sumV;
};

const _calcularPDH_PDL = (candles: Candle[]): { pdh: number; pdl: number } | null => {
    if (candles.length === 0) return null;
    const lastDate = new Date(candles[candles.length - 1].timestamp);
    const currentDayStr = lastDate.toISOString().split('T')[0];
    
    let prevDayStr = '';
    let pdh = -Infinity;
    let pdl = Infinity;
    
    for (let i = candles.length - 1; i >= 0; i--) {
        const dStr = new Date(candles[i].timestamp).toISOString().split('T')[0];
        if (dStr !== currentDayStr) {
            if (!prevDayStr) prevDayStr = dStr;
            if (dStr === prevDayStr) {
                if (candles[i].high > pdh) pdh = candles[i].high;
                if (candles[i].low < pdl) pdl = candles[i].low;
            } else {
                break; // Moving to day before previous day
            }
        }
    }
    
    if (prevDayStr === '') return null;
    return { pdh, pdl };
};

const _calcularPWH_PWL = (candles: Candle[]): { pwh: number; pwl: number } | null => {
    if (candles.length === 0) return null;
    // Helper to get week string formatted
    const getWeekId = (ts: number) => {
        const d = new Date(ts);
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        const weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
        return `${d.getUTCFullYear()}-W${weekNo}`;
    };
    
    const currentWeekId = getWeekId(candles[candles.length - 1].timestamp);
    let prevWeekId = '';
    
    let pwh = -Infinity;
    let pwl = Infinity;
    
    for (let i = candles.length - 1; i >= 0; i--) {
        const wId = getWeekId(candles[i].timestamp);
        if (wId !== currentWeekId) {
            if (!prevWeekId) prevWeekId = wId;
            if (wId === prevWeekId) {
                if (candles[i].high > pwh) pwh = candles[i].high;
                if (candles[i].low < pwl) pwl = candles[i].low;
            } else {
                break;
            }
        }
    }
    
    if (prevWeekId === '') return null;
    return { pwh, pwl };
};

const _identificarEqualHighs = (candles: Candle[], tolerancia: number = 0.0015): number[] => {
    const recent = candles.slice(-100);
    const equals: number[] = [];
    for (let i = 0; i < recent.length; i++) {
        for (let j = i + 1; j < recent.length; j++) {
            const diff = Math.abs(recent[i].high - recent[j].high) / recent[i].high;
            if (diff < tolerancia) {
                equals.push(recent[i].high);
            }
        }
    }
    return [...new Set(equals)]; // Return unique
};

const _identificarEqualLows = (candles: Candle[], tolerancia: number = 0.0015): number[] => {
    const recent = candles.slice(-100);
    const equals: number[] = [];
    for (let i = 0; i < recent.length; i++) {
        for (let j = i + 1; j < recent.length; j++) {
            const diff = Math.abs(recent[i].low - recent[j].low) / recent[i].low;
            if (diff < tolerancia) {
                equals.push(recent[i].low);
            }
        }
    }
    return [...new Set(equals)]; // Return unique
};

const _detectarDivergenciaRSI = (candles: Candle[], valoresRSI: number[]): string => {
    if (candles.length < 20 || valoresRSI.length < 20) return 'NENHUMA';
    
    const recentCandles = candles.slice(-20);
    const recentRSI = valoresRSI.slice(-20);
    
    // Find highest peak in price
    let p1 = 0; let p2 = 0;
    let highIdx1 = 0; let highIdx2 = 0;
    
    let low1 = Infinity; let low2 = Infinity;
    let lowIdx1 = 0; let lowIdx2 = 0;
    
    // Simplistic local pivot finding
    for (let i = 2; i < 18; i++) {
        // Highs
        if (recentCandles[i].high > recentCandles[i-1].high && recentCandles[i].high > recentCandles[i+1].high) {
            if (recentCandles[i].high > p1) {
                p2 = p1; highIdx2 = highIdx1;
                p1 = recentCandles[i].high; highIdx1 = i;
            } else if (recentCandles[i].high > p2) {
                p2 = recentCandles[i].high; highIdx2 = i;
            }
        }
        
        // Lows
        if (recentCandles[i].low < recentCandles[i-1].low && recentCandles[i].low < recentCandles[i+1].low) {
            if (recentCandles[i].low < low1) {
                low2 = low1; lowIdx2 = lowIdx1;
                low1 = recentCandles[i].low; lowIdx1 = i;
            } else if (recentCandles[i].low < low2) {
                low2 = recentCandles[i].low; lowIdx2 = i;
            }
        }
    }
    
    // Bearish Div: Price made higher high, RSI made lower high
    if (highIdx1 > highIdx2 && p1 > p2 && recentRSI[highIdx1] < recentRSI[highIdx2]) {
        return 'BEARISH';
    }
    
    // Bullish Div: Price made lower low, RSI made higher low
    if (lowIdx1 > lowIdx2 && low1 < low2 && recentRSI[lowIdx1] > recentRSI[lowIdx2]) {
        return 'BULLISH';
    }
    
    return 'NENHUMA';
};

const _detectarCompressaoVolatilidade = (candles: Candle[]): any => {
    if (candles.length < 20) return null;
    
    const recent20 = candles.slice(-20);
    const recent5 = candles.slice(-5);
    const prev5 = candles.slice(-10, -5);
    const recent3 = candles.slice(-3);
    const recent10 = candles.slice(-10);
    
    // ATR Calculations
    const atr20Val = calcularATR(recent20, 20); // Média de 20 períodos
    const atr5Val = calcularATR(recent5, 5); // ATR Atual
    
    if (!atr20Val || !atr5Val) return null;
    
    // Percentual do ATR atual em relação à média
    const pctATR = (atr5Val / atr20Val) * 100;
    
    // Bollinger Bands width comparison
    const boll5 = calcularBollinger(recent5, 5);
    const bollPrev5 = calcularBollinger(prev5, 5);
    
    let isBollingerSqueezing = false;
    if (boll5 && bollPrev5) {
        const spread5 = boll5.upper - boll5.lower;
        const spreadPrev5 = bollPrev5.upper - bollPrev5.lower;
        isBollingerSqueezing = spread5 < spreadPrev5;
    }
    
    // compressaoDetectada
    const restrictATR = pctATR < 70;
    const compressaoDetectada = restrictATR && isBollingerSqueezing;
    
    // nívelCompressao
    let nivelCompressao = "NENHUMA";
    if (pctATR < 55) {
        nivelCompressao = "SEVERA";
    } else if (pctATR >= 55 && pctATR < 70) {
        nivelCompressao = "MODERADA";
    } else if (pctATR >= 70 && pctATR <= 85) {
        nivelCompressao = "LEVE";
    }
    
    // volumeDecrescente
    const volMedio3 = recent3.reduce((sum, c) => sum + c.volume, 0) / 3;
    const volMedio10 = recent10.reduce((sum, c) => sum + c.volume, 0) / 10;
    const volumeDecrescente = volMedio3 < volMedio10;
    
    // probabilidadeRompimento
    const probabilidadeRompimento = Math.max(0, Math.min(100, 100 - pctATR));
    
    return {
        compressaoDetectada,
        nivelCompressao,
        volumeDecrescente,
        probabilidadeRompimento
    };
};

const _calcularCVDSlope = (cvdValues: number[]): number => {
    if (cvdValues.length < 10) return 0;
    const y = cvdValues.slice(-10);
    const x = Array.from({length: 10}, (_, i) => i);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    
    let sumXY = 0;
    let sumXX = 0;
    for (let i = 0; i < 10; i++) {
        sumXY += x[i] * y[i];
        sumXX += x[i] * x[i];
    }
    
    const slope = (10 * sumXY - sumX * sumY) / (10 * sumXX - sumX * sumX);
    return slope;
};

// --- WRAPPERS DE SEGURANÇA ---

export const calcularEMA = (...args: any[]): any => {
    try {
        return (_calcularEMA as any)(...args);
    } catch(e) {
        console.error(`[${"calcularEMA"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const calcularRSI = (...args: any[]): any => {
    try {
        return (_calcularRSI as any)(...args);
    } catch(e) {
        console.error(`[${"calcularRSI"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const calcularATR = (...args: any[]): any => {
    try {
        return (_calcularATR as any)(...args);
    } catch(e) {
        console.error(`[${"calcularATR"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const calcularADX = (...args: any[]): any => {
    try {
        return (_calcularADX as any)(...args);
    } catch(e) {
        console.error(`[${"calcularADX"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const calcularMACD = (...args: any[]): any => {
    try {
        return (_calcularMACD as any)(...args);
    } catch(e) {
        console.error(`[${"calcularMACD"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const calcularBollinger = (...args: any[]): any => {
    try {
        return (_calcularBollinger as any)(...args);
    } catch(e) {
        console.error(`[${"calcularBollinger"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const calcularVWAP = (...args: any[]): any => {
    try {
        return (_calcularVWAP as any)(...args);
    } catch(e) {
        console.error(`[${"calcularVWAP"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const calcularPDH_PDL = (...args: any[]): any => {
    try {
        return (_calcularPDH_PDL as any)(...args);
    } catch(e) {
        console.error(`[${"calcularPDH_PDL"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const calcularPWH_PWL = (...args: any[]): any => {
    try {
        return (_calcularPWH_PWL as any)(...args);
    } catch(e) {
        console.error(`[${"calcularPWH_PWL"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const identificarEqualHighs = (...args: any[]): any => {
    try {
        return (_identificarEqualHighs as any)(...args);
    } catch(e) {
        console.error(`[${"identificarEqualHighs"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const identificarEqualLows = (...args: any[]): any => {
    try {
        return (_identificarEqualLows as any)(...args);
    } catch(e) {
        console.error(`[${"identificarEqualLows"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const detectarDivergenciaRSI = (...args: any[]): any => {
    try {
        return (_detectarDivergenciaRSI as any)(...args);
    } catch(e) {
        console.error(`[${"detectarDivergenciaRSI"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const detectarCompressaoVolatilidade = (...args: any[]): any => {
    try {
        return (_detectarCompressaoVolatilidade as any)(...args);
    } catch(e) {
        console.error(`[${"detectarCompressaoVolatilidade"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};

export const calcularCVDSlope = (...args: any[]): any => {
    try {
        return (_calcularCVDSlope as any)(...args);
    } catch(e) {
        console.error(`[${"calcularCVDSlope"}] Falha inesperada. Parâmetros recebidos:`, args, e);
        return null;
    }
};
