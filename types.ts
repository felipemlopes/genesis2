
export enum TradeDirection {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

export interface TradeSetup {
  vies?: string;
  viés?: string;
  confluenciaRecomendada?: string;
  gestaoRisco?: any;
  sinteseDaAnalise?: string;
  pair: string;
  direcaoProvavel: 'LONG' | 'SHORT';
  scoreProbabilidade: number;
  confianca: number;
  regime: string;
  alerta: string | null;
  entradaSugerida: {
    planoA: number | string;
    planoB: number | string;
    descricaoPlanoA: string;
    descricaoPlanoB: string;
  };
  execucao: {
    motivo: string;
    setup: {
      entrada: number | string;
      stop: number | string;
      tp1: number | string;
      tp2: number | string;
      tp3: number | string;
      alavancagem: number;
      liquidacao: number | string;
      riscoPct: number;
      rr1: number;
      verificacao: string;
      tamanhoSugerido?: string;
      riscoMaximoUsd?: string;
      tp1Usd?: string;
      tp2Usd?: string;
      tp3Usd?: string;
    } | null;
  }
  ensemble: {
    motorTecnico?: { status: string; score: number };
    motorDerivativos?: { status: string; score: number };
    motorMacro?: { status: string; score: number };
    motorSentimento?: { status: string; score: number };
    motorOnChain?: { status: string; score: number };
    motorQuantitativo?: { status: string; score: number };
  };
  analiseTecnica: string;
  macroGeopolitica: {
    resumo: string;
    eventos: string[];
  };
  multiTimeframe?: {
    timeframe: string;
    bias: string;
  }[];
  sentimentoNarrativa: {
    score: number;
    sentimento: 'OTIMISTA' | 'NEUTRO' | 'PESSIMISTA';
    narrativa: string;
    gatilhosPositivos: string[];
    gatilhosNegativos: string[];
  };
  indicadores: {
    rsi: number;
    adx: number;
    plusDI: number;
    minusDI: number;
    macdHist: number;
    ema21: number;
    ema50: number;
    ema200: number;
    atr: number;
    cvd: number;
    compressaoDetectada?: boolean;
    nivelCompressao?: string;
    fontes?: {
      rsi: string;
      adx: string;
      atr: string;
      ema21?: string;
      ema50?: string;
      ema200?: string;
    };
  };
  zonaInteresse?: {
    tipo: string;
    zona: string;
    invalidacao: string;
  };
}

export interface MarketSentiment {
  score: number; // 0-100
  label: string; // e.g., "Medo Extremo", "Ganância"
}

export interface FundingRate {
  exchange: string;
  rate: string;
  openInterest: string;
  trend: 'up' | 'down' | 'neutral';
}

export interface ChartMetadata {
  pair: string;
  timeframe: string;
  exchange?: string; // New: Detected Exchange
  symbol?: string; // New: Detected Token Symbol
  price?: number; // New: Detected Current Price via OCR
  detectedIndicators?: string[]; // New: General indicators detected
  visualMarkings?: string[]; // New: Visual lines, boxes, or markings detected
  detectedEMAs?: string[]; // New: Dynamic periods detected in the chart
  adx?: number | null; // New: Visually extracted ADX
  pdi?: number | null; // New: Visually extracted +DI
  mdi?: number | null; // New: Visually extracted -DI
  pocPrice?: number | null; // New: Visually extracted POC (Point of Control)
  hvmNodes?: number[]; // New: High Volume Nodes
  lvmNodes?: number[]; // New: Low Volume Nodes
}

export interface ActiveTrade {
  id: string;
  exchange: string; // New: Track which exchange this trade belongs to
  date: string;
  asset: string;
  leverage: string;
  direction: string;
  status: string;
  pnl: string;
  entryPrice: number;
  currentPriceStr?: string; // New: Display real-time price in table
  targetPrice: number;
  financialTarget?: number; // New: Specific Profit Target in USD
  liquidationPrice: number;
  amount: number;
}

export interface SavedAnalysis {
  id: string;
  timestamp: string;
  symbol: string;
  interval: string;
  direction: 'LONG' | 'SHORT';
  score: number;
  rsi: number;
  ema200: number;
  adx: number;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  status: 'PENDENTE' | 'ACERTOU' | 'ERROU';
  profit_loss?: number;
  notes?: string;
}
