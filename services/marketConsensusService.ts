import { fetchBinanceData, fetchBybitData, fetchBitgetData, fetchOkxData } from './cryptoApi';

export interface ConsensusData {
    price: number;
    fundingRate: number;
    oiUsd: number;
    exchanges: string[];
    divergence: boolean;
    divergenceDetails: string;
}

export const fetchMarketConsensus = async (symbol: string): Promise<ConsensusData | null> => {
    try {
        const [binance, bybit, bitget, okx] = await Promise.allSettled([
            fetchBinanceData(symbol),
            fetchBybitData(symbol),
            fetchBitgetData(symbol),
            fetchOkxData(symbol)
        ]);

        const validData: any[] = [];
        const exchanges: string[] = [];

        if (binance.status === 'fulfilled' && binance.value) {
            validData.push({ exchange: 'Binance', data: binance.value });
            exchanges.push('Binance');
        }
        if (bybit.status === 'fulfilled' && bybit.value) {
            validData.push({ exchange: 'Bybit', data: bybit.value });
            exchanges.push('Bybit');
        }
        if (bitget.status === 'fulfilled' && bitget.value) {
            validData.push({ exchange: 'Bitget', data: bitget.value });
            exchanges.push('Bitget');
        }
        if (okx.status === 'fulfilled' && okx.value) {
            validData.push({ exchange: 'OKX', data: okx.value });
            exchanges.push('OKX');
        }

        if (validData.length === 0) return null;

        let avgPrice = 0;
        let avgFunding = 0;
        let totalOi = 0;
        let minPrice = Infinity;
        let maxPrice = -Infinity;

        let validPriceCount = 0;
        let validFundingCount = 0;

        validData.forEach(item => {
            const pStr = item.data.price.replace(/[^0-9.-]+/g, "");
            const p = parseFloat(pStr);
            if (!isNaN(p)) {
                avgPrice += p;
                minPrice = Math.min(minPrice, p);
                maxPrice = Math.max(maxPrice, p);
                validPriceCount++;
            }
            
            const fStr = item.data.funding.replace(/[^0-9.-]+/g, "");
            const f = parseFloat(fStr);
            if (!isNaN(f)) {
                avgFunding += f;
                validFundingCount++;
            }

            const oiStr = item.data.oi.replace(/[^0-9.-]+/g, "");
            const oi = parseFloat(oiStr);
            if (!isNaN(oi)) totalOi += oi;
        });

        if (validPriceCount > 0) avgPrice /= validPriceCount;
        if (validFundingCount > 0) avgFunding /= validFundingCount;

        const priceDiffPercent = ((maxPrice - minPrice) / minPrice) * 100;
        const divergence = priceDiffPercent > 0.5; // 0.5% difference is considered a divergence
        
        let divergenceDetails = "Consensus Aligned";
        if (divergence) {
            divergenceDetails = `Price Divergence Detected: Max $${maxPrice.toFixed(2)} vs Min $${minPrice.toFixed(2)} (${priceDiffPercent.toFixed(2)}% diff)`;
        }

        return {
            price: avgPrice,
            fundingRate: avgFunding,
            oiUsd: totalOi,
            exchanges,
            divergence,
            divergenceDetails
        };
    } catch (e) {
        console.error("Error fetching market consensus:", e);
        return null;
    }
};
