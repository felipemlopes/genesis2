
export enum TradeDirection {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

// ─── Contrato R3.2 (Documento Mestre, Seção 15.2) ──────────────────────────
// Único contrato para o resultado de /v1/analyze. Substitui o antigo
// TradeSetup (direcaoProvavel, confianca, regime, ensemble, execucao.setup).
// Campos proibidos no contrato público: confianca, regime, ensemble,
// scoreDetalhado, blocoMacro, blocoSentimento, barras.

export type AnalysisDirection = 'LONG' | 'SHORT' | 'INDISPONIVEL';

export type AnalysisStatus =
  | 'CONCLUIDA'
  | 'ANALISE_INCONSISTENTE'
  | 'INDISPONIVEL';

export type ExecutionStatus =
  | 'EXECUTAVEL'
  | 'SHADOW_MODE'
  | 'NAO_RECOMENDADA_RR'
  | 'NAO_RECOMENDADA_ALVO'
  | 'NAO_RECOMENDADA_CONVICCAO'
  | 'NAO_RECOMENDADA_CONFIGURACAO'
  | 'BLOQUEADA_ANALISE_INCONSISTENTE'
  | 'INDISPONIVEL';

export interface ScoreFamilias {
  estrutura: number;
  order_flow: number;
  derivativos: number;
  momentum: number;
}

export interface ScoreContexto {
  familias_divergentes: string[];
  limitadores: string[];
  dados_ausentes_relevantes: string[];
  confirmacao_necessaria: string[];
}

export interface CandidateSetup {
  entrada: number | null;
  stop: number | null;
  tp1: number | null;
  tp1_fonte: string | null;
  tp2: number | null;
  tp2_fonte: string | null;
  tp3: number | null;
  tp3_fonte: string | null;
  alavancagem: number | null;
  liquidacao: number | null;
  liquidacao_rotulo: 'estimada' | null;
  risco_preco_pct: number | null;
  risco_margem_pct: number | null;
  risco_usd_estimado: number | null;
  nocional_estimado: number | null;
  tamanho_sugerido_texto: string | null;
  rr_bruto: number | null;
  rr_liquido_estimado: number | null;
  rr_aviso: string | null;
  custos_bps: Record<string, number>;
  entrada_ts: string | null;
}

export interface GenesisAnalysisResult {
  analysis_id: string;
  pair: string;
  analysis: {
    direction: AnalysisDirection;
    status: AnalysisStatus;
    conviccao_modelo: number | null;
    leitura_fraca: boolean;
    reason_code: string | null;
    score_familias?: ScoreFamilias;
    justificativa_score?: string;
    score_contexto?: ScoreContexto;
    narrativa_tecnica?: string;
    invalidacao_tese?: string;
  };
  execution: {
    status: ExecutionStatus;
    executable: boolean;
    action: 'LONG' | 'SHORT' | null;
    direction_reference: 'LONG' | 'SHORT' | null;
    reason_code: string | null;
    motivo: string;
    candidate_setup: CandidateSetup | null;
    executable_setup: CandidateSetup | null;
    planoB: Record<string, unknown> | null;
    zonaInteresse: {
      tipo: string;
      zona: string;
      invalidacao: string | null;
    } | null;
    avisos: string[];
    stop_ancora: Record<string, unknown> | null;
  };
  contexto_informativo: Record<string, unknown> | null;
  ai_meta: Record<string, unknown>;
  indicadores?: Record<string, number | string | boolean | null | Record<string, unknown>>;
  // Campos informativos/deterministicos que o PHP ainda calcula e que nao
  // fazem parte do contrato formal da Secao 15.1, mas continuam sendo
  // enviados hoje (nao sao "cerebro" duplicado, sao dado calculado pelo
  // backend): wyckoff, sessao, multiTimeframe, macroGeopolitica, sentimento.
  // Acessados via `as any`/opcional no componente, nao tipados em detalhe
  // aqui para nao reintroduzir um segundo contrato paralelo.
  wyckoff?: Record<string, unknown>;
  sessao?: { nome: string; cor: string };
  multiTimeframe?: { timeframe: string; bias: string }[];
  macroGeopolitica?: { resumo: string; eventos: string[] };
  sentimentoAtivo?: Record<string, unknown>;
  folha_decisao?: Record<string, unknown>;
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
  detectedEMAs?: Array<{ period: number; value: number }> | string[]; // Dynamic EMAs: { period, value } from OCR or legacy string[] format
  adx?: number | null; // New: Visually extracted ADX
  pdi?: number | null; // New: Visually extracted +DI
  mdi?: number | null; // New: Visually extracted -DI
  pocPrice?: number | null; // New: Visually extracted POC (Point of Control)
  hvmNodes?: number[]; // New: High Volume Nodes
  lvmNodes?: number[]; // New: Low Volume Nodes
  // Visual data fields (unified reading)
  supports?: number[];
  resistances?: number[];
  trendlines?: Array<{ type: string; slope: string; touches: number }>;
  fibonacci?: Array<{ level: number; price: number }>;
  patterns?: string[];
}

/**
 * UnifiedChartResult — resultado da leitura visual unificada.
 * Contém tanto metadata (ChartMetadata) quanto dados visuais detalhados
 * em uma única estrutura, eliminando perda de dados entre leituras.
 */
export interface UnifiedChartResult extends ChartMetadata {
  supports: number[];
  resistances: number[];
  trendlines: Array<{ type: string; slope: string; touches: number }>;
  fibonacci: Array<{ level: number; price: number }>;
  patterns: string[];
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
  // Opcionais: a tabela genesis_analises (histórico) ainda não tem essas
  // colunas — só ficam preenchidas quando a análise é salva a partir de um
  // resultado /v1/analyze fresco (GenesisPage.tsx). Ver Documento Mestre
  // Seção 15.2; deviamos do tipo literal (que os declara obrigatórios) para
  // não quebrar o histórico existente, que não tem esses campos no banco.
  analysis_id?: string;
  analysis_status?: AnalysisStatus;
  execution_status?: ExecutionStatus;
  executable?: boolean;
  rr_liquido_estimado?: number | null;
  timestamp: string;
  symbol: string;
  interval: string;
  direction: AnalysisDirection;
  score: number | null;
  rsi: number | null;
  ema200: number | null;
  adx: number | null;
  entry_price: number | null;
  target_price: number | null;
  target_price2: number | null;
  target_price3: number | null;
  stop_loss: number | null;
  status: 'PENDENTE' | 'ACERTOU' | 'ERROU' | 'NAO_EXECUTAVEL';
  profit_loss?: number | null;
  notes?: string;
}
