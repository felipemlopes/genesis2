const { EMA, RSI, MACD, ADX, ATR } = require('technicalindicators');

// Mock data (simple trend)
const closes = Array.from({length: 300}, (_, i) => 100 + i + Math.random());
const highs = closes.map(c => c + 1);
const lows = closes.map(c => c - 1);

console.log("RSI:", RSI.calculate({period: 14, values: closes}).pop());
console.log("EMA200:", EMA.calculate({period: 200, values: closes}).pop());

// TV-like Manual RSI
function calcTV_RSI(closes, period = 14) {
    if (closes.length <= period) return 0;
    let sumGains = 0, sumLosses = 0;
    for (let i = 1; i <= period; i++) {
        let diff = closes[i] - closes[i-1];
        if (diff > 0) sumGains += diff;
        else sumLosses -= diff;
    }
    let rmaGain = sumGains / period;
    let rmaLoss = sumLosses / period;
    
    for (let i = period + 1; i < closes.length; i++) {
        let diff = closes[i] - closes[i-1];
        let gain = diff > 0 ? diff : 0;
        let loss = diff < 0 ? -diff : 0;
        rmaGain = (rmaGain * (period - 1) + gain) / period;
        rmaLoss = (rmaLoss * (period - 1) + loss) / period;
    }
    
    let rs = rmaGain / rmaLoss;
    return rmaLoss === 0 ? 100 : 100 - (100 / (1 + rs));
}
console.log("TV RSI:", calcTV_RSI(closes));

function calcTV_EMA(data, period) {
    if (data.length <= period) return 0;
    let multiplier = 2 / (period + 1);
    let sum = 0;
    for (let i = 0; i < period; i++) sum += data[i];
    let ema = sum / period;
    for (let i = period; i < data.length; i++) {
        ema = (data[i] - ema) * multiplier + ema;
    }
    return ema;
}
console.log("TV EMA200:", calcTV_EMA(closes, 200));
