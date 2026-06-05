// services/spotPriceService.ts

// Módulo responsável por buscar preços de ativos no mercado spot das corretoras.

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Caches em memória
const priceCache: Record<string, CacheEntry<number | null>> = {};
const listCache: Record<string, CacheEntry<{ symbol: string; name: string }[]>> = {};

const PRICE_CACHE_DURATION = 30 * 1000; // 30 segundos
const LIST_CACHE_DURATION = 10 * 60 * 1000; // 10 minutos

/**
 * Busca a lista completa de ativos spot da corretora fornecida.
 * Implementa um cache de 10 minutos.
 * @param corretora Nome da corretora ('Binance', 'Bybit', 'Bitget', 'OKX')
 * @returns Lista de ativos { symbol: string, name: string }
 */
export const buscarListaAtivos = async (corretora: string): Promise<{ symbol: string; name: string }[]> => {
  const ex = corretora.toLowerCase();
  
  if (listCache[ex] && Date.now() - listCache[ex].timestamp < LIST_CACHE_DURATION) {
    return listCache[ex].data;
  }

  let result: { symbol: string; name: string }[] = [];

  try {
    switch (ex) {
      case 'binance': {
        const res = await fetch(`https://api.binance.com/api/v3/exchangeInfo`);
        const json = await res.json();
        if (json && json.symbols) {
          result = json.symbols
            .filter((s: any) => s.status === 'TRADING' && s.isSpotTradingAllowed)
            .map((s: any) => ({ symbol: s.symbol, name: s.baseAsset }));
        }
        break;
      }
      case 'bybit': {
        const res = await fetch(`https://api.bybit.com/v5/market/instruments-info?category=spot`);
        const json = await res.json();
        if (json && json.result && json.result.list) {
          result = json.result.list
            .map((s: any) => ({ symbol: s.symbol, name: s.baseCoin }));
        }
        break;
      }
      case 'bitget': {
        const res = await fetch(`https://api.bitget.com/api/spot/v1/public/products`);
        const json = await res.json();
        if (json && json.data) {
          result = json.data
            .map((s: any) => ({ symbol: s.symbolName, name: s.baseCoin }));
        }
        break;
      }
      case 'okx': {
        const res = await fetch(`https://www.okx.com/api/v5/public/instruments?instType=SPOT`);
        const json = await res.json();
        if (json && json.data) {
          result = json.data
            .map((s: any) => ({ symbol: s.instId, name: s.baseCcy }));
        }
        break;
      }
      default:
        break;
    }
    
    if (result.length > 0) {
      listCache[ex] = { data: result, timestamp: Date.now() };
    }
  } catch (error) {
    console.error(`Erro ao buscar lista de ativos na ${corretora}:`, error);
  }

  return result;
};

/**
 * Busca o preço spot de uma criptomoeda em uma corretora específica.
 * Implementa cache de 30 segundos.
 * Usa Binance como fallback caso a primária falhe.
 * @param symbol Símbolo do ativo (ex: 'BTCUSDT' ou 'BTC')
 * @param corretora Nome da corretora
 * @returns Preço atual ou null em caso de falha completa
 */
export const buscarPrecoSpot = async (symbol: string, corretora: string): Promise<number | null> => {
  let cleanSymbol = symbol.replace('/', '').toUpperCase();
  
  // Extrair símbolo base: se o par termina com quote conhecida (USDT, BTC, ETH, BNB, BUSD, USDC, FDUSD),
  // extraímos só a base e reconstruímos com USDT
  const quotes = ['USDT', 'BUSD', 'USDC', 'FDUSD', 'BTC', 'ETH', 'BNB', 'EUR', 'BRL', 'TRY'];
  for (const quote of quotes) {
    if (cleanSymbol.endsWith(quote) && cleanSymbol.length > quote.length) {
      cleanSymbol = cleanSymbol.slice(0, -quote.length) + 'USDT';
      break;
    }
  }
  // Se após limpeza ainda não termina com USDT, adiciona
  if (!cleanSymbol.endsWith('USDT')) {
    cleanSymbol = cleanSymbol + 'USDT';
  }

  const cacheKey = `${cleanSymbol}-${corretora.toLowerCase()}`;

  if (priceCache[cacheKey] && Date.now() - priceCache[cacheKey].timestamp < PRICE_CACHE_DURATION) {
    return priceCache[cacheKey].data;
  }

  let preco = await fetchPrecoSpot(cleanSymbol, corretora);

  // Se falhar e a corretora solicitada não for a Binance, tentar fallback na Binance
  if (preco === null && corretora.toLowerCase() !== 'binance') {
    console.warn(`Falha ao buscar ${cleanSymbol} na ${corretora}. Tentando fallback na Binance.`);
    preco = await fetchPrecoSpot(cleanSymbol, 'binance');
  }

  // Atualiza cache (mesmo se for null, para evitar spamar falhas a cada milisegundo)
  priceCache[cacheKey] = { data: preco, timestamp: Date.now() };

  return preco;
};

/**
 * Função auxiliar que efetivamente realiza a requisição HTTP.
 */
const fetchPrecoSpot = async (symbol: string, corretora: string): Promise<number | null> => {
  try {
    switch (corretora.toLowerCase()) {
      case 'binance': {
        const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const json = await res.json();
        if (json && json.price) return parseFloat(json.price);
        return null;
      }
      case 'bybit': {
        const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
        const json = await res.json();
        if (json && json.result && json.result.list && json.result.list[0]) {
          return parseFloat(json.result.list[0].lastPrice);
        }
        return null;
      }
      case 'bitget': {
        const res = await fetch(`https://api.bitget.com/api/spot/v1/market/ticker?symbol=${symbol}`);
        const json = await res.json();
        if (json && json.data && json.data.close) {
          return parseFloat(json.data.close);
        }
        return null;
      }
      case 'okx': {
        // OKX usa formato BTC-USDT
        const okxSymbol = symbol.replace('USDT', '-USDT');
        const res = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxSymbol}`);
        const json = await res.json();
        if (json && json.data && json.data[0] && json.data[0].last) {
          return parseFloat(json.data[0].last);
        }
        return null;
      }
      default:
        return null;
    }
  } catch (error) {
    console.error(`Erro ao buscar preço de ${symbol} na ${corretora}:`, error);
    return null;
  }
};
