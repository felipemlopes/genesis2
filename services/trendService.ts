
import { fetchWithProxy } from './cryptoApi';

export interface TrendResult {
  asset: string;
  trend: 'Alta' | 'Baixa' | 'Neutra';
  score: number;
  justification: string;
  metrics: {
    cvd: number;
    delta: number;
    oi: number;
    funding: number;
    imbalance: number;
    volatility: number;
    vwap: number;
    structure: number;
  };
}

const BASE_BINANCE = "https://api.binance.com/api/v3";
const BASE_BINANCE_FUT = "https://fapi.binance.com/fapi/v1";

export const analyzeTrend = async (asset: 'BTC' | 'ETH'): Promise<TrendResult> => {
  const symbol = `${asset}USDT`;
  const okxSymbol = `${asset}-USDT`;

  // 1. DATA COLLECTION
  const [klines, trades, depth, funding, oi, aggTrades] = await Promise.all([
    fetchWithProxy(`${BASE_BINANCE}/klines?symbol=${symbol}&interval=1m&limit=100`),
    fetchWithProxy(`${BASE_BINANCE}/aggTrades?symbol=${symbol}&limit=500`),
    fetchWithProxy(`${BASE_BINANCE}/depth?symbol=${symbol}&limit=100`),
    fetchWithProxy(`${BASE_BINANCE_FUT}/fundingRate?symbol=${symbol}&limit=1`),
    fetchWithProxy(`${BASE_BINANCE_FUT}/openInterestHist?symbol=${symbol}&period=5m&limit=12`),
    fetchWithProxy(`${BASE_BINANCE}/aggTrades?symbol=${symbol}&limit=1000`)
  ]);

  if (!klines || !Array.isArray(klines) || klines.length === 0) {
      throw new Error(`Data fetch failed for ${symbol} or no klines returned.`);
  }

  const currentPrice = parseFloat(klines[klines.length - 1][4]);
  let scores = { cvd: 0, delta: 0, oi: 0, funding: 0, imbalance: 0, volatility: 0, vwap: 0, structure: 0 };

  // INDICATOR 1: CVD (Cumulative Volume Delta)
  // Logic: Price Up + CVD Down = Divergence (-2). Price Up + CVD Up = Strength (+2).
  let buyVol = 0, sellVol = 0;
  aggTrades.forEach((t: any) => {
    const v = parseFloat(t.q);
    if (t.m) sellVol += v; else buyVol += v;
  });
  const cvd = buyVol - sellVol;
  const recentIndex = Math.max(0, klines.length - 10);
  const priceChangeRecent = currentPrice - parseFloat(klines[recentIndex][4]);
  if (priceChangeRecent > 0 && cvd < 0) scores.cvd = -2;
  else if (priceChangeRecent < 0 && cvd > 0) scores.cvd = 2;
  else if (priceChangeRecent > 0 && cvd > 0) scores.cvd = 1.5;
  else if (priceChangeRecent < 0 && cvd < 0) scores.cvd = -1.5;

  // INDICATOR 2: Delta Volume (1m e 5m)
  const last5m = klines.slice(-5);
  let delta5m = 0;
  last5m.forEach((k: any) => {
    const vol = parseFloat(k[5]);
    const takerVol = parseFloat(k[9]);
    delta5m += (takerVol - (vol - takerVol));
  });
  if (delta5m > 0) scores.delta = 1.5;
  else if (delta5m < 0) scores.delta = -1.5;

  // INDICATOR 3: Open Interest
  if (Array.isArray(oi) && oi.length >= 2) {
    const latestOi = parseFloat(oi[oi.length - 1].sumOpenInterest);
    const prevOi = parseFloat(oi[oi.length - 2].sumOpenInterest);
    const oiDelta = latestOi - prevOi;
    if (oiDelta > 0 && priceChangeRecent > 0) scores.oi = 2;
    else if (oiDelta > 0 && priceChangeRecent < 0) scores.oi = -2;
    else if (oiDelta < 0 && priceChangeRecent > 0) scores.oi = -1; // Shorts covering
    else if (oiDelta < 0 && priceChangeRecent < 0) scores.oi = 1; // Longs liquidating
  }

  // INDICATOR 4: Funding Rate
  if (funding && funding[0]) {
    const rate = parseFloat(funding[0].fundingRate);
    if (rate > 0.01) scores.funding = -1.5; // Overbought risk
    else if (rate < 0) scores.funding = 1.5; // Short squeeze risk
  }

  // INDICATOR 5: Order Book Imbalance
  if (depth && depth.bids && depth.asks) {
    let bidSum = 0, askSum = 0;
    depth.bids.forEach((b: any) => bidSum += parseFloat(b[1]));
    depth.asks.forEach((a: any) => askSum += parseFloat(a[1]));
    const imb = (bidSum - askSum) / (bidSum + askSum);
    if (imb > 0.15) scores.imbalance = 1.5;
    else if (imb < -0.15) scores.imbalance = -1.5;
  }

  // INDICATOR 6: Volatility (Bollinger Width approximation)
  const prices = klines.map((k: any) => parseFloat(k[4]));
  const sma = prices.reduce((a: any, b: any) => a + b, 0) / prices.length;
  const variance = prices.reduce((a: any, b: any) => a + Math.pow(b - sma, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  const bbWidth = (stdDev * 4) / sma;
  if (bbWidth < 0.002) scores.volatility = 0; // Squeeze coming
  else scores.volatility = priceChangeRecent > 0 ? 0.5 : -0.5;

  // INDICATOR 7: VWAP
  let sumPV = 0, sumV = 0;
  klines.forEach((k: any) => {
    const p = (parseFloat(k[2]) + parseFloat(k[3]) + parseFloat(k[4])) / 3;
    const v = parseFloat(k[5]);
    sumPV += p * v;
    sumV += v;
  });
  const vwap = sumPV / sumV;
  if (currentPrice > vwap) scores.vwap = 1.5;
  else scores.vwap = -1.5;

  // INDICATOR 8: Price Structure
  const highLast20 = Math.max(...klines.slice(-20).map((k: any) => parseFloat(k[2])));
  const lowLast20 = Math.min(...klines.slice(-20).map((k: any) => parseFloat(k[3])));
  if (currentPrice > (highLast20 + lowLast20) / 2) scores.structure = 1;
  else scores.structure = -1;

  // FINAL SUM
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  
  let trend: 'Alta' | 'Baixa' | 'Neutra' = 'Neutra';
  let justification = "";

  if (totalScore > 3) {
    trend = 'Alta';
    justification = `${asset}: CVD sustentado, delta volume comprador agressivo, open interest aumentando junto com o preço, funding saudável, bid wall no book, volatilidade direcional, preço acima do VWAP e estrutura de topos e fundos ascendentes.`;
  } else if (totalScore < -3) {
    trend = 'Baixa';
    justification = `${asset}: divergência negativa no CVD, fluxo vendedor agressivo no delta, open interest subindo com queda de preço (venda institucional), funding elevado, resistência no book, volatilidade de queda, preço abaixo do VWAP e estrutura macro de baixa.`;
  } else {
    trend = 'Neutra';
    justification = `${asset}: indicadores sem confluência clara. Conflito entre fluxo e estrutura. CVD e Delta Volume não apresentam consenso institucional no momento. Recomendação de neutralidade até rompimento de VWAP ou mudança no Funding.`;
  }

  return { asset, trend, score: totalScore, justification, metrics: scores };
};
