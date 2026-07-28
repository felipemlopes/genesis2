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
  score: number | null;
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

// Restauração pós-entrega (2026-07-27): justificativa estruturada que o próprio decisor já devolve
// junto da decisão — não é um cálculo novo, só nunca tinha sido exposto na resposta pública. Usado
// pra colorir os blocos Técnico/Derivativos sem recalcular nada em paralelo ao Gemini.
export interface ScoreBasis {
  technical_coherence: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
  structure_clarity: 'UNCLEAR' | 'PARTIAL' | 'CLEAR' | 'VERY_CLEAR';
  derivatives_confirmation: 'OPPOSES' | 'NEUTRAL' | 'SUPPORTS' | 'STRONGLY_SUPPORTS' | 'UNAVAILABLE';
  contradiction_level: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
  data_quality: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
}

// Restauração pós-entrega (2026-07-27): pipeline de execução (entrada/stop/TP/tamanho/risco-retorno),
// calculado depois da decisão do Gemini (ExecucaoService/MotorExecucaoService, backend). Nunca decide
// direção/score — só matemática de risco em cima da direção já decidida. null quando ATR/preço não
// estavam disponíveis ou o cálculo falhou (best-effort).
export interface ExecutionCandidateSetup {
  entrada: number;
  stop: number;
  tp1: number | null;
  tp1_fonte: string | null;
  tp2: number | null;
  tp2_fonte: string | null;
  tp3: number | null;
  tp3_fonte: string | null;
  alavancagem: number;
  liquidacao: number | null;
  liquidacao_rotulo: string | null;
  risco_preco_pct: number | null;
  risco_margem_pct: number | null;
  risco_usd_estimado: number | null;
  nocional_estimado: number | null;
  tamanho_sugerido_texto: string | null;
  rr_bruto: number | null;
  rr_liquido_estimado: number | null;
  rr_aviso: string | null;
  custos_bps: Record<string, number>;
  entrada_ts: string;
}

export interface ExecutionPlanB {
  entrada: number;
  stop: number;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  alavancagem: number;
  liquidacao: number | string | null;
  riscoPct: number;
  rr1: number;
  verificacao: 'SEGURO' | 'INSEGURO';
  verificacao_motivo: string | null;
  tipo: string;
  descricao: string;
}

export interface ExecutionPipelineResult {
  status: string;
  executable: boolean;
  action: AnalysisDirection | null;
  direction_reference: AnalysisDirection | null;
  reason_code: string | null;
  motivo: string;
  candidate_setup: ExecutionCandidateSetup | null;
  executable_setup: ExecutionCandidateSetup | null;
  planoB: ExecutionPlanB | null;
  zonaInteresse: { tipo: string; zona: string; invalidacao: string | null } | null;
  avisos: string[];
  stop_ancora: { tipo: string; valor: number } | null;
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
  score_basis: ScoreBasis | null;
  technical_analysis: string;
  derivatives_context: DerivativesContext;
  visual_observations: VisualObservations;
  coverage_percent: number | null;
  snapshot_observed_at: string | null;
  display_only: {
    long_short_ratio: unknown;
  };
  informative_context: InformativeContext;
  execution: ExecutionPipelineResult | null;
  created_at: string;
}

export interface GraphicalAnalysisErrorPayload {
  error?: string;
  reason_code?: string;
}
