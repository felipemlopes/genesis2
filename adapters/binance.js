class BinanceAdapter {
    async getKlines() {
        return [{ close: 40000, volume: 100 }];
    }
    async getFundingRate() { return 0; }
    async getOpenInterest() { return 0; }
    async getTicker24h() { return { lastPrice: 40000, priceChangePercent: 0, volume: 1000 }; }
}
module.exports = { BinanceAdapter };
