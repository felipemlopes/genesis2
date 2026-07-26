export type AnalysisDirection = 'LONG' | 'SHORT';

export interface DerivativesContext {
  strength: 'WEAKENS' | 'NEUTRAL' | 'STRENGTHENS' | 'UNAVAILABLE';
  squeeze_risk: 'NONE' | 'LONG_SQUEEZE' | 'SHORT_SQUEEZE' | 'BOTH' | 'UNAVAILABLE';
  summary: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualPattern {
  id: string;
  confidence: number;
  state: 'FORMING' | 'TESTING' | 'BREAKOUT' | 'RETEST' | 'CONFIRMED';
  bbox: BoundingBox;
}

export interface VisualObject {
  type: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface FibonacciObservation {
  label: string;
  visible_price: number | null;
  confidence: number;
}

export interface VisualObservations {
  patterns: VisualPattern[];
  objects: VisualObject[];
  fibonacci: FibonacciObservation[];
}

// Spec genesis-v6-4-contexto-informativo, Tarefa 2.1: restaura os campos de indicadores/macro/sentimento
// que a tela de resultado sempre mostrou (V4.3-R3.2).
export interface EvidenceValue<T = number> {
  value: T | null;
  unit: string | null;
  status: 'AVAILABLE' | 'UNAVAILABLE';
}

export interface MultiTimeframeEntry {
  timeframe: string;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  price: number | null;
  ema21: number | null;
  ema50: number | null;
  rsi: number | null;
  macd: number | null;
  bias: 'BULLISH' | 'BEARISH' | 'MIXED' | null;
}

// Correção pós-entrega (2026-07-26): narrativa de macro/sentimento, gerada por uma chamada Gemini
// separada do decisor único (InformativeNarrativeService, backend) — recria o texto que a tela sempre
// mostrou no V4.3-R3.2. Best-effort: pode vir com status UNAVAILABLE se a chamada falhar.
export interface MacroNarrative {
  resumo: string;
  eventos: string[];
}

export interface SentimentNarrative {
  score: number | null;
  narrativa: string;
  gatilhos_positivos: string[];
  gatilhos_negativos: string[];
}

export interface InformativeContext {
  indicators: {
    rsi14: EvidenceValue;
    adx14: EvidenceValue;
    atr14: EvidenceValue;
    ema21: EvidenceValue;
    ema50: EvidenceValue;
    ema200: EvidenceValue;
    wyckoff: EvidenceValue<Record<string, unknown>>;
    session: EvidenceValue<{ name: string; utc_hour: number }>;
    multi_timeframe: EvidenceValue<MultiTimeframeEntry[]>;
  };
  macro: {
    vix: EvidenceValue;
    dxy_change_pct: EvidenceValue;
    sp500_change_pct: EvidenceValue;
    narrative: EvidenceValue<MacroNarrative>;
  };
  sentiment: {
    fear_greed: EvidenceValue;
    btc_dominance: EvidenceValue;
    narrative: EvidenceValue<SentimentNarrative>;
  };
}

export interface GraphicalAnalysisResult {
  analysis_id: string;
  status: 'COMPLETED';
  pair: string;
  exchange: 'BINANCE';
  market: 'FUTURES';
  timeframe: string;
  direction: AnalysisDirection;
  score: number;
  score_description: string;
  technical_analysis: string;
  derivatives_context: DerivativesContext;
  visual_observations: VisualObservations;
  coverage_percent: number | null;
  snapshot_observed_at: string | null;
  display_only: {
    long_short_ratio: unknown;
  };
  informative_context: InformativeContext;
  created_at: string;
}

export interface GraphicalAnalysisErrorPayload {
  error?: string;
  reason_code?: string;
}
