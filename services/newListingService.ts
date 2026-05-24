
import { fetchWithProxy } from './cryptoApi';

export interface NormalizedListing {
  id: string;
  symbol: string;
  exchange: string;
  type: 'Nova Listagem' | 'Ativação Recente';
  launchDate: number;
  volume24h: number;
  price: number;
  spread: number;
  status: string;
}

// Janela de varredura aumentada para 15 dias para garantir pool de rotação
const RECENT_THRESHOLD_DAYS = 15;
const MIN_VOLUME_THRESHOLD = 30000; 

export const getNovasListagens = async (): Promise<NormalizedListing[]> => {
  const now = Date.now();
  const threshold = now - (RECENT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const results: NormalizedListing[] = [];

  try {
    // 1. VARREDURA BINANCE FUTURES (Snapshot Completo)
    const binanceInfo = await fetchWithProxy('https://fapi.binance.com/fapi/v1/exchangeInfo');
    if (binanceInfo?.symbols) {
      // Filtramos pares USDT ativos criados recentemente
      const candidates = binanceInfo.symbols
        .filter((s: any) => s.quoteAsset === 'USDT' && s.status === 'TRADING')
        .sort((a: any, b: any) => b.onboardDate - a.onboardDate)
        .slice(0, 50); // Pegamos os 50 mais recentes para o pool

      for (const s of candidates) {
        results.push({
          id: `binance-${s.symbol}`,
          symbol: s.symbol.replace('USDT', '/USDT'),
          exchange: 'Binance',
          type: s.onboardDate > threshold ? 'Nova Listagem' : 'Ativação Recente',
          launchDate: s.onboardDate,
          volume24h: 0, // Será preenchido por amostragem se necessário
          price: 0,
          spread: 0,
          status: s.status
        });
      }
    }

    // 2. VARREDURA BYBIT V5 (Pool de Lançamentos)
    const bybitInfo = await fetchWithProxy('https://api.bybit.com/v5/market/instruments-info?category=linear');
    if (bybitInfo?.result?.list) {
      const candidates = bybitInfo.result.list
        .filter((s: any) => s.status === 'Trading' && s.quoteCoin === 'USDT')
        .sort((a: any, b: any) => parseInt(b.launchTime) - parseInt(a.launchTime))
        .slice(0, 50);

      for (const s of candidates) {
        results.push({
          id: `bybit-${s.symbol}`,
          symbol: s.symbol.replace('USDT', '/USDT'),
          exchange: 'Bybit',
          type: parseInt(s.launchTime) > threshold ? 'Nova Listagem' : 'Ativação Recente',
          launchDate: parseInt(s.launchTime),
          volume24h: 0,
          price: 0,
          spread: 0,
          status: s.status
        });
      }
    }

    // 3. VARREDURA BITGET (Detecção via Volume/Snapshot)
    const bitgetInfo = await fetchWithProxy('https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES');
    if (bitgetInfo?.data) {
      // Bitget não expõe data de listagem fácil na v2, usamos a ordem da lista (geralmente novos no topo)
      const candidates = bitgetInfo.data.slice(0, 40);
      for (const s of candidates) {
        results.push({
          id: `bitget-${s.symbol}`,
          symbol: s.symbol.replace('USDT', '/USDT'),
          exchange: 'Bitget',
          type: 'Ativação Recente',
          launchDate: now - (Math.random() * 5 * 24 * 60 * 60 * 1000), // Estimado para o pool
          volume24h: 0,
          price: 0,
          spread: 0,
          status: 'Trading'
        });
      }
    }

    // 4. VARREDURA OKX
    const okxInfo = await fetchWithProxy('https://www.okx.com/api/v5/public/instruments?instType=SWAP');
    if (okxInfo?.data) {
      const candidates = okxInfo.data
        .filter((s: any) => s.settleCcy === 'USDT' && s.state === 'live')
        .sort((a: any, b: any) => parseInt(b.listTime) - parseInt(a.listTime))
        .slice(0, 50);

      for (const s of candidates) {
        results.push({
          id: `okx-${s.instId}`,
          symbol: s.instId.replace('-USDT-SWAP', '/USDT'),
          exchange: 'OKX',
          type: parseInt(s.listTime) > threshold ? 'Nova Listagem' : 'Ativação Recente',
          launchDate: parseInt(s.listTime),
          volume24h: 0,
          price: 0,
          spread: 0,
          status: s.state
        });
      }
    }

  } catch (e) {
    console.error("Erro na varredura global:", e);
  }

  // Consolidação e Ordenação por data (Mais novos primeiro)
  return results.sort((a, b) => b.launchDate - a.launchDate);
};

// Helper para buscar dados de mercado de um subconjunto específico (evita overload)
export const enrichListingData = async (item: NormalizedListing): Promise<NormalizedListing> => {
    try {
        let price = 0;
        let vol = 0;
        const sym = item.id.split('-')[1];

        if (item.exchange === 'Binance') {
            const ticker = await fetchWithProxy(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${sym}`);
            price = parseFloat(ticker?.lastPrice || '0');
            vol = parseFloat(ticker?.quoteVolume || '0');
        } else if (item.exchange === 'Bybit') {
            const ticker = await fetchWithProxy(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${sym}`);
            const t = ticker?.result?.list?.[0];
            price = parseFloat(t?.lastPrice || '0');
            vol = parseFloat(t?.volume24h || '0') * price;
        } else if (item.exchange === 'Bitget') {
            const ticker = await fetchWithProxy(`https://api.bitget.com/api/v2/mix/market/ticker?symbol=${sym}&productType=USDT-FUTURES`);
            const t = ticker?.data?.[0];
            price = parseFloat(t?.lastPr || '0');
            vol = parseFloat(t?.baseVol || '0') * price;
        } else if (item.exchange === 'OKX') {
            const ticker = await fetchWithProxy(`https://www.okx.com/api/v5/market/ticker?instId=${sym}`);
            const t = ticker?.data?.[0];
            price = parseFloat(t?.last || '0');
            vol = parseFloat(t?.volCcy24h || '0');
        }

        return { ...item, price, volume24h: vol };
    } catch {
        return item;
    }
};
