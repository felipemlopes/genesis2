import { fetchWithProxy } from './cryptoApi';

export type InstitutionalFlowData = {
  putCallRatio: number | null;
  totalPutsOI: number | null;
  totalCallsOI: number | null;
  blockTradesVol: number; // Volume in USD
  blockTradesCount: number;
  flowDirection: "BULLISH" | "BEARISH" | "NEUTRAL";
  interpretation: string;
};

// Fetch Deribit Options Book to calculate real-time Put/Call Ratio
const fetchPutCallRatio = async (symbol: string = 'BTC'): Promise<{ pcr: number, puts: number, calls: number } | null> => {
  try {
    const url = `https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=${symbol}&kind=option`;
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const data = await res.json();
    if (!data.result) return null;

    let puts = 0;
    let calls = 0;

    data.result.forEach((o: any) => {
      if (o.instrument_name.endsWith('-P')) puts += o.open_interest;
      else if (o.instrument_name.endsWith('-C')) calls += o.open_interest;
    });

    return {
      pcr: calls > 0 ? (puts / calls) : 0,
      puts,
      calls
    };
  } catch (error) {
    console.error("Error fetching PCR:", error);
    return null;
  }
};

// Fetch block trades via Binance aggTrades to detect OTC/Dark Pool style absorptions
const fetchBlockTrades = async (symbol: string = 'BTCUSDT'): Promise<{ buyVol: number, sellVol: number, blockCount: number, blockVol: number }> => {
  try {
    const url = `https://fapi.binance.com/fapi/v1/aggTrades?symbol=${symbol}&limit=1000`;
    // Must use proxy to bypass georestrictions in some server regions
    const data = await fetchWithProxy(url);
    
    if (!data || !Array.isArray(data)) return { buyVol: 0, sellVol: 0, blockCount: 0, blockVol: 0 };

    let buyVol = 0;
    let sellVol = 0;
    let blockCount = 0;
    let blockVol = 0;

    data.forEach((t: any) => {
      const vol = parseFloat(t.q) * parseFloat(t.p);
      if (t.m) sellVol += vol; // maker -> sell
      else buyVol += vol;      // taker -> buy

      // Block trade threshold: > $500,000 USD executed in a single printed aggregated trade
      if (vol > 500000) {
        blockCount += 1;
        blockVol += vol;
      }
    });

    return { buyVol, sellVol, blockCount, blockVol };
  } catch (error) {
    console.error("Error fetching Block Trades:", error);
    return { buyVol: 0, sellVol: 0, blockCount: 0, blockVol: 0 };
  }
};

export const fetchInstitutionalFlow = async (symbol: string): Promise<InstitutionalFlowData> => {
  const isBtc = symbol.includes('BTC') || symbol === 'BTC';
  const baseCurrency = isBtc ? 'BTC' : (symbol.includes('ETH') ? 'ETH' : 'BTC'); // Deribit supports basically BTC/ETH

  const [pcrData, blockTrades] = await Promise.all([
    fetchPutCallRatio(baseCurrency),
    fetchBlockTrades(`${baseCurrency}USDT`)
  ]);

  let interpretation = "Atividade institucional dentro do padrão normal (Sem anomalias detectadas).";
  let flowDirection: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";

  if (pcrData && blockTrades) {
    const isExtremeBearish = pcrData.pcr > 1.2; // Lots of puts
    const isExtremeBullish = pcrData.pcr < 0.5; // Lots of calls

    if (isExtremeBearish) {
      flowDirection = "BEARISH";
      interpretation = `Smart Money fortemente protegido contra quedas (Put/Call Ratio em ${pcrData.pcr.toFixed(2)} indica hedge em massa).`;
    } else if (isExtremeBullish) {
      flowDirection = "BULLISH";
      interpretation = `Fluxo institucional de derivativos apontando especulação agressiva de alta (Put/Call Ratio baixo em ${pcrData.pcr.toFixed(2)}).`;
    }

    if (blockTrades.blockCount > 5) {
      const volFormatted = (blockTrades.blockVol / 1000000).toFixed(1);
      interpretation += ` Alerta de Tape: ${blockTrades.blockCount} Block Trades recém detectados injetando $${volFormatted}M. Presença de Dark Pool/OTC Ativa no book.`;
    }
  }

  return {
    putCallRatio: pcrData?.pcr ?? null,
    totalPutsOI: pcrData?.puts ?? null,
    totalCallsOI: pcrData?.calls ?? null,
    blockTradesVol: blockTrades.blockVol,
    blockTradesCount: blockTrades.blockCount,
    flowDirection,
    interpretation
  };
};
