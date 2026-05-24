/**
 * microstructureEngine.ts
 * 
 * Core engine for real-time market microstructure analysis.
 * Operates on public REST APIs (polling) to simulate real-time data.
 */

import { fetchBinanceDepth, fetchBinanceTrades, fetchBybitDepth, fetchBybitTrades } from './cryptoApi';

export interface OrderBook {
  bids: [number, number][]; // [price, size]
  asks: [number, number][];
  lastUpdateId: number;
}

export class MicrostructureEngine {
  private orderBook: OrderBook = { bids: [], asks: [], lastUpdateId: 0 };
  private symbol: string;
  private exchange: string;

  constructor(symbol: string, exchange: string) {
    this.symbol = symbol;
    this.exchange = exchange;
  }

  // Segment 1: Order Book Management (Polling Simulation)
  async updateOrderBook() {
    try {
      let data: any;
      if (this.exchange === 'Binance') {
        data = await fetchBinanceDepth(this.symbol);
        if (data) {
          this.orderBook = {
            bids: data.bids.map((b: any) => [parseFloat(b[0]), parseFloat(b[1])]),
            asks: data.asks.map((a: any) => [parseFloat(a[0]), parseFloat(a[1])]),
            lastUpdateId: data.lastUpdateId
          };
        }
      }
      // Add other exchanges as needed
    } catch (e) {
      console.error("Error updating order book:", e);
    }
  }

  // Segment 1: Microprice calculation
  getMicroprice(): number {
    if (this.orderBook.bids.length === 0 || this.orderBook.asks.length === 0) return 0;
    const bid = this.orderBook.bids[0][0];
    const ask = this.orderBook.asks[0][0];
    const bidSize = this.orderBook.bids[0][1];
    const askSize = this.orderBook.asks[0][1];
    return (bid * askSize + ask * bidSize) / (bidSize + askSize);
  }

  // Segment 2: Flow metrics (CVD, aggression)
  calculateCVD(trades: any[]): number {
    return trades.reduce((acc, trade) => {
      const vol = parseFloat(trade.q);
      return trade.m ? acc - vol : acc + vol; // m=true means maker is buyer (aggressor seller)
    }, 0);
  }

  // Segment 3: Absorption/Exhaustion scores
  calculateAbsorptionScore(trades: any[], priceChange: number): number {
    const volume = trades.reduce((acc, t) => acc + parseFloat(t.q), 0);
    if (priceChange === 0 && volume > 0) return 1; // High volume, no price change = absorption
    return 0;
  }

  // Segment 5: Derivatives pressure
  calculateDerivativesPressure(oiChange: number, fundingRate: number, priceChange: number): number {
    // Price up + OI up = 1, Price up + OI down = -1, etc.
    if (priceChange > 0 && oiChange > 0) return 1;
    if (priceChange > 0 && oiChange < 0) return -0.5;
    if (priceChange < 0 && oiChange > 0) return -1;
    if (priceChange < 0 && oiChange < 0) return 0.5;
    return 0;
  }
}
