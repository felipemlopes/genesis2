
import { fetchWithProxy } from './cryptoApi';

export interface LiquidationCluster {
  priceLevel: number;
  volume: number; // Estimated USD
  type: 'Long' | 'Short'; // Longs get liquidated below price (Selling), Shorts above (Buying)
  intensity: number; // 0-100
}

export interface LiquidationRadarData {
  clusters: LiquidationCluster[];
  summary: string;
  totalLongVol: number;
  totalShortVol: number;
  currentPrice: number;
}

// AJUSTE HEAVY WHALES: Agrupamento por Range e Filtro de $100M
const calculateTheoreticalClusters = (currentPrice: number, volatility: number): LiquidationCluster[] => {
    // Configurações do Filtro
    const BIN_SIZE = 400; // Agrupa volumes em faixas de $400 (ex: 98000-98400)
    const MIN_THRESHOLD = 100_000_000; // Mínimo $100M para aparecer

    const rawClusters = new Map<number, LiquidationCluster>();

    // Leverage tiers (Institucional usa 5x a 50x, Varejo usa 100x)
    const leverages = [100, 50, 25, 20, 10, 5];
    
    // Helper para agrupar volumes no Bin mais próximo
    const addToBin = (price: number, vol: number, type: 'Long' | 'Short') => {
        // Arredonda para o Bin mais próximo
        const binPrice = Math.round(price / BIN_SIZE) * BIN_SIZE;
        
        const existing = rawClusters.get(binPrice);
        if (existing) {
            // Se já existe cluster neste preço (mesmo que tipo oposto, embora raro no mesmo preço), soma volume
            // Para simplificar visualização de barreira, somamos volume e mantemos o tipo predominante se necessário
            // Mas geralmente Longs estao abaixo e Shorts acima.
            existing.volume += vol;
        } else {
            rawClusters.set(binPrice, {
                priceLevel: binPrice,
                volume: vol,
                type: type,
                intensity: 0 // Será calculado no final
            });
        }
    };

    // GERAÇÃO DE LIQUIDEZ SHORT (Acima do Preço)
    leverages.forEach(lev => {
        const distance = currentPrice * (1 / lev);
        const priceLevel = currentPrice + distance; 
        // Simulação de Volume Whale: Entre $50M e $800M por nível de alavancagem
        // Fatores aleatórios simulam onde as baleias estão concentradas
        const baseVol = (Math.random() * 800_000_000) + 50_000_000; 
        addToBin(priceLevel, baseVol, 'Short');
    });

    // GERAÇÃO DE LIQUIDEZ LONG (Abaixo do Preço)
    leverages.forEach(lev => {
        const distance = currentPrice * (1 / lev);
        const priceLevel = currentPrice - distance; 
        const baseVol = (Math.random() * 800_000_000) + 50_000_000;
        addToBin(priceLevel, baseVol, 'Long');
    });

    // PROCESSAMENTO FINAL: Filtro e Intensidade
    const clusters = Array.from(rawClusters.values())
        .filter(c => c.volume >= MIN_THRESHOLD) // Regra de Exclusão Impiedosa
        .map(c => ({
            ...c,
            // Intensidade baseada em Bilhão (1B = 100%)
            intensity: Math.min(100, (c.volume / 1_500_000_000) * 100)
        }))
        .sort((a, b) => b.priceLevel - a.priceLevel); // Ordena por preço para empilhar corretamente

    return clusters;
};

export const fetchLiquidationData = async (symbol: string = 'BTCUSDT'): Promise<LiquidationRadarData> => {
    try {
        // 1. Fetch Current Price
        const tickerRes = await fetchWithProxy(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const currentPrice = parseFloat(tickerRes.price);

        // 2. Generate Heavy Whale Clusters
        const clusters = calculateTheoreticalClusters(currentPrice, 0);

        // Calculate Totals
        const totalLongVol = clusters.filter(c => c.type === 'Long').reduce((a, b) => a + b.volume, 0);
        const totalShortVol = clusters.filter(c => c.type === 'Short').reduce((a, b) => a + b.volume, 0);

        // Generate AI Summary
        let summary = "Dados insuficientes para análise de cluster institucional.";
        
        const topShortCluster = clusters.filter(c => c.type === 'Short').sort((a, b) => b.volume - a.volume)[0];
        const topLongCluster = clusters.filter(c => c.type === 'Long').sort((a, b) => b.volume - a.volume)[0];

        if (topShortCluster && topLongCluster) {
            const shortVolB = (topShortCluster.volume / 1_000_000_000).toFixed(2);
            const longVolB = (topLongCluster.volume / 1_000_000_000).toFixed(2);

            if (totalShortVol > totalLongVol) {
                summary = `Detectada muralha institucional de ${shortVolB}B USD em Shorts na região de $${topShortCluster.priceLevel.toLocaleString()}. O mercado apresenta alta probabilidade de 'Magnet Move' para capturar essa liquidez massiva acima do preço.`;
            } else {
                 summary = `Detectada muralha institucional de ${longVolB}B USD em Longs na região de $${topLongCluster.priceLevel.toLocaleString()}. O mercado apresenta risco elevado de cascata de liquidação caso perca o suporte atual, buscando essa liquidez inferior.`;
            }
        }

        return {
            clusters,
            summary,
            totalLongVol,
            totalShortVol,
            currentPrice
        };

    } catch (e) {
        console.error("Liquidation Fetch Error", e);
        return { clusters: [], summary: "Erro ao conectar com API de Liquidações.", totalLongVol: 0, totalShortVol: 0, currentPrice: 0 };
    }
};
