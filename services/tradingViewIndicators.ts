export function calculateRSI(closes: number[], period: number = 14): number {
    if (closes.length <= period) return 0;
    
    let sumGains = 0;
    let sumLosses = 0;
    
    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) sumGains += diff;
        else sumLosses -= diff;
    }
    
    let rmaGain = sumGains / period;
    let rmaLoss = sumLosses / period;
    
    for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;
        
        rmaGain = (rmaGain * (period - 1) + gain) / period;
        rmaLoss = (rmaLoss * (period - 1) + loss) / period;
    }
    
    if (rmaLoss === 0) return 100;
    const rs = rmaGain / rmaLoss;
    return 100 - (100 / (1 + rs));
}

export function calculateEMA(data: number[], period: number): number {
    if (data.length <= period) return 0;
    
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    
    let ema = sum / period; // Initial SMA
    const multiplier = 2 / (period + 1);
    
    for (let i = period; i < data.length; i++) {
        ema = (data[i] - ema) * multiplier + ema;
    }
    
    return ema;
}

export function calculateMACD(closes: number[]): { macd: number; signal: number; hist: number } {
    if (closes.length <= 26) return { macd: 0, signal: 0, hist: 0 };
    
    const ema12Array: number[] = [];
    let sum12 = 0;
    for (let i = 0; i < 12; i++) sum12 += closes[i];
    let ema12 = sum12 / 12;
    // We only need to start recording from index 25 (the 26th period) because MACD line exists from there.
    // Actually, calculate EMA12 for the whole array
    for (let i = 12; i < closes.length; i++) {
        ema12 = (closes[i] - ema12) * (2 / 13) + ema12;
        if (i >= 25) ema12Array.push(ema12); // Pushing from index 25
    }
    
    let sum26 = 0;
    for (let i = 0; i < 26; i++) sum26 += closes[i];
    let ema26 = sum26 / 26;
    
    const macdLine: number[] = [];
    macdLine.push(ema12Array[0] - ema26); // At index 25
    
    for (let i = 26; i < closes.length; i++) {
        ema26 = (closes[i] - ema26) * (2 / 27) + ema26;
        macdLine.push(ema12Array[i - 25] - ema26);
    }
    
    // Now we have the MACD line. We need a 9-period EMA of the MACD line.
    if (macdLine.length <= 9) {
        const lastMacd = macdLine[macdLine.length - 1] || 0;
        return { macd: lastMacd, signal: lastMacd, hist: 0 };
    }
    
    let sumSignal = 0;
    for (let i = 0; i < 9; i++) sumSignal += macdLine[i];
    let signal = sumSignal / 9;
    
    const signalMultiplier = 2 / 10;
    for (let i = 9; i < macdLine.length; i++) {
        signal = (macdLine[i] - signal) * signalMultiplier + signal;
    }
    
    const finalMacd = macdLine[macdLine.length - 1];
    return {
        macd: finalMacd,
        signal: signal,
        hist: finalMacd - signal
    };
}

export function calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (closes.length <= period) return 0;
    
    let trArray = [];
    let plusDmArray = [];
    let minusDmArray = [];
    
    // Start from index 1
    for (let i = 1; i < closes.length; i++) {
        const upMove = highs[i] - highs[i - 1];
        const downMove = lows[i - 1] - lows[i];
        
        let plusDm = 0;
        let minusDm = 0;
        
        if (upMove > downMove && upMove > 0) plusDm = upMove;
        if (downMove > upMove && downMove > 0) minusDm = downMove;
        
        const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        );
        
        trArray.push(tr);
        plusDmArray.push(plusDm);
        minusDmArray.push(minusDm);
    }
    
    // Initial Wilder Smoothing (Smoothed TR, Smoothed +DM, Smoothed -DM)
    if (trArray.length < period) return 0;
    
    let smoothedTr = 0;
    let smoothedPlusDm = 0;
    let smoothedMinusDm = 0;
    
    for (let i = 0; i < period; i++) {
        smoothedTr += trArray[i];
        smoothedPlusDm += plusDmArray[i];
        smoothedMinusDm += minusDmArray[i];
    }
    
    let dxArray = [];
    
    let plusDi = (smoothedPlusDm / smoothedTr) * 100;
    let minusDi = (smoothedMinusDm / smoothedTr) * 100;
    let dx = Math.abs(plusDi - minusDi) / (plusDi + minusDi) * 100;
    if (isNaN(dx)) dx = 0;
    dxArray.push(dx);
    
    for (let i = period; i < trArray.length; i++) {
        smoothedTr = smoothedTr - (smoothedTr / period) + trArray[i];
        smoothedPlusDm = smoothedPlusDm - (smoothedPlusDm / period) + plusDmArray[i];
        smoothedMinusDm = smoothedMinusDm - (smoothedMinusDm / period) + minusDmArray[i];
        
        plusDi = (smoothedPlusDm / smoothedTr) * 100;
        minusDi = (smoothedMinusDm / smoothedTr) * 100;
        dx = Math.abs(plusDi - minusDi) / (plusDi + minusDi) * 100;
        if (isNaN(dx)) dx = 0;
        dxArray.push(dx);
    }
    
    if (dxArray.length < period) return dxArray[dxArray.length - 1] || 0;
    
    let sumDx = 0;
    for (let i = 0; i < period; i++) {
        sumDx += dxArray[i];
    }
    
    let adx = sumDx / period; // Initial ADX
    
    for (let i = period; i < dxArray.length; i++) {
        adx = ((adx * (period - 1)) + dxArray[i]) / period;
    }
    
    return adx;
}

export function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (closes.length <= period) return 0;
    
    let trArray = [];
    for (let i = 1; i < closes.length; i++) {
        const tr = Math.max(
            highs[i] - lows[i],
            Math.abs(highs[i] - closes[i - 1]),
            Math.abs(lows[i] - closes[i - 1])
        );
        trArray.push(tr);
    }
    
    if (trArray.length < period) return 0;
    
    let atr = 0;
    for (let i = 0; i < period; i++) {
        atr += trArray[i];
    }
    atr = atr / period; // Initial ATR (SMA of TR)
    
    // Wilder's Smoothing for ATR
    for (let i = period; i < trArray.length; i++) {
        atr = (atr * (period - 1) + trArray[i]) / period;
    }
    
    return atr;
}
