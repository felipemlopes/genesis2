
import { fetchWithProxy } from './cryptoApi';

export interface SmartMoneyData {
  asset: string;
  institutionalFlow: {
    status: string; // "entrada institucional", "saída institucional", "movimento agressivo"
    contractsChange: number; // % change
    longRatio: number;
    shortRatio: number;
    description: string;
  };
  directionalFlow: {
    status: string; // "fundo institucional comprador", "fundo institucional vendedor", "ausência de direção institucional"
    delta: number;
    buyVol: number;
    sellVol: number;
    description: string;
  };
  activity: {
    intensity: 'Baixa' | 'Média' | 'Alta';
    score: number;
    description: string;
  };
  lastUpdate: string;
}

const ALLOWED_ASSETS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

// 1. FLUXO INSTITUCIONAL
// API: Binance Global Long/Short Ratio + Open Interest
// Logic: OI Up = Entrada, OI Down = Saída.
const fetchInstitutionalFlow = async (symbol: string) => {
  try {
    // 1. Get Long/Short Ratio (Proxy for CME/Institutional Sentiment in this context)
    const ratioUrl = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`;
    // 2. Get Open Interest History (To measure Contract Variation)
    const oiUrl = `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=15m&limit=2`;

    const [ratioData, oiData] = await Promise.all([
      fetchWithProxy(ratioUrl),
      fetchWithProxy(oiUrl)
    ]);

    let status = "neutro";
    let contractsChange = 0;
    let longRatio = 50;
    let shortRatio = 50;

    if (Array.isArray(ratioData) && ratioData.length > 0) {
       longRatio = parseFloat(ratioData[0].longAccount) * 100;
       shortRatio = parseFloat(ratioData[0].shortAccount) * 100;
    }

    if (Array.isArray(oiData) && oiData.length >= 2) {
       const currOI = parseFloat(oiData[oiData.length - 1].sumOpenInterest);
       const prevOI = parseFloat(oiData[oiData.length - 2].sumOpenInterest);
       
       contractsChange = ((currOI - prevOI) / prevOI) * 100;

       // Logic Imutável requested:
       // Aumento -> Entrada
       // Redução -> Saída
       // Aumento Abrupto (> 2%) -> Movimento Agressivo
       
       if (contractsChange > 2.0) {
           status = "movimento agressivo";
       } else if (contractsChange > 0) {
           status = "entrada institucional";
       } else {
           status = "saída institucional";
       }
    }

    return {
        status,
        contractsChange,
        longRatio,
        shortRatio,
        description: "Mede entrada e saída de capital institucional através de posições líquidas e variação contratual."
    };

  } catch (e) {
    return { 
        status: "neutro", 
        contractsChange: 0, 
        longRatio: 50, 
        shortRatio: 50,
        description: "Dados indisponíveis." 
    };
  }
};

// 2. FLUXO DIRECIONAL
// API: Binance AggTrades
// Logic: Delta > 0 (Comp), Delta < 0 (Vend), Delta ~ 0 (Neutro)
const fetchDirectionalFlow = async (symbol: string) => {
  try {
    const url = `https://fapi.binance.com/fapi/v1/aggTrades?symbol=${symbol}&limit=1000`; // 1000 trades snapshot
    const trades = await fetchWithProxy(url);

    let buyVol = 0;
    let sellVol = 0;

    if (Array.isArray(trades)) {
       trades.forEach((t: any) => {
          const val = parseFloat(t.q) * parseFloat(t.p);
          if (t.m) {
             // Maker was buyer -> Taker was seller (Aggressive Sell)
             sellVol += val;
          } else {
             // Maker was seller -> Taker was buyer (Aggressive Buy)
             buyVol += val;
          }
       });
    }

    const delta = buyVol - sellVol;
    const threshold = (buyVol + sellVol) * 0.05; // 5% buffer for neutrality

    let status = "ausência de direção institucional";
    if (delta > threshold) status = "fundo institucional comprador";
    else if (delta < -threshold) status = "fundo institucional vendedor";

    return {
        status,
        delta,
        buyVol,
        sellVol,
        description: "Mede se a pressão agressiva está vindo de compradores ou vendedores."
    };

  } catch (e) {
    return { status: "ausência de direção institucional", delta: 0, buyVol: 0, sellVol: 0, description: "Dados indisponíveis" };
  }
};

// 3. ATIVIDADE INSTITUCIONAL
// Derived metric
const calculateActivity = (contractsChange: number, delta: number) => {
    const absChange = Math.abs(contractsChange);
    const activityScore = Math.min((absChange * 20) + (Math.abs(delta) / 1000000), 100); // Rough normalization

    let intensity: 'Baixa' | 'Média' | 'Alta' = 'Baixa';
    if (activityScore > 60) intensity = 'Alta';
    else if (activityScore > 30) intensity = 'Média';

    return {
        intensity,
        score: activityScore,
        description: "Mostra intensidade e frequência das movimentações anormais."
    };
};

export const fetchSmartMoneyData = async (symbol: string): Promise<SmartMoneyData | null> => {
  if (!ALLOWED_ASSETS.includes(symbol)) return null;

  const instFlow = await fetchInstitutionalFlow(symbol);
  const dirFlow = await fetchDirectionalFlow(symbol);
  const activity = calculateActivity(instFlow.contractsChange, dirFlow.delta);

  return {
      asset: symbol,
      institutionalFlow: instFlow,
      directionalFlow: dirFlow,
      activity,
      lastUpdate: new Date().toLocaleTimeString('pt-BR')
  };
};
