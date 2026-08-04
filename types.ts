import type { VisualPattern } from './types/graphicalAnalysis';

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

// ─── Adendo Seção 33: contrato canônico em inglês, publicado ao lado do
// português (Seção 14.4) — mesmo valor, nunca recalculado no frontend.
export interface GraphicalFamilyScores {
  structure: number;
  trend: number;
  momentum: number;
  technical_flow: number;
  visual_confluence: number;
}

export interface GraphicalScoreContext {
  divergent_families: string[];
  limitations: string[];
  missing_relevant_data: string[];
  required_confirmation: string[];
}

export interface DerivativesContext {
  classification: 'REFORCA' | 'ENFRAQUECE' | 'NEUTRO' | 'INDISPONIVEL';
  modifier: number;
  reasons: string[];
  warnings: string[];
  quality: string[];
  liquidity_zones: unknown[];
  squeeze_risk: string;
  rule: 'CONTEXT_ONLY_CANNOT_CHANGE_DIRECTION';
}

export interface GraphicalAnalysis {
  direction: 'LONG' | 'SHORT';
  status: 'VALIDA' | 'INCONSISTENTE';
  base_conviction: number;
  conviction: number;
  coverage: number;
  family_scores: GraphicalFamilyScores;
  score_justification: string;
  technical_analysis: string;
  score_context: GraphicalScoreContext;
  thesis_invalidation: string;
}

// V6.5 (E09-E10): antes alavancagemSegura() só devolvia o número já reduzido, sem indicar que houve
// redução — o membro pedia 20x, o sistema aplicava 8x em silêncio.
export interface AlavancagemInfo {
  escolhida: number;
  aplicada: number;
  maxima_segura: number;
  ajustada: boolean;
  motivo: string | null;
}

export interface CandidateSetup {
  entrada: number | null;
  stop: number | null;
  tp1: number | null;
  tp1_fonte: string | null;
  tp2: number | null;
  tp2_fonte: string | null;
  // V6.6 (C06): motivo da ausência quando tp2/tp3 vem null — sem barreira dentro do horizonte do
  // timeframe. Permite a tela explicar em vez de só mostrar traço/sumir o campo.
  tp2_motivo: string | null;
  tp3: number | null;
  tp3_fonte: string | null;
  tp3_motivo: string | null;
  alavancagem: number | null;
  alavancagem_info: AlavancagemInfo | null;
  liquidacao: number | null;
  liquidacao_rotulo: 'estimada' | null;
  risco_preco_pct: number | null;
  risco_margem_pct: number | null;
  risco_usd_estimado: number | null;
  nocional_estimado: number | null;
  // V6.5 (E11): substituem tamanho_sugerido_texto — o texto ("0.05 BTCUSDT") usava o par inteiro como
  // se fosse a unidade da quantidade; a unidade real é só o ativo base (BTC). Backend para de montar
  // frase, frontend formata a partir destes dois campos.
  quantidade_base_estimada: number | null;
  ativo_base: string | null;
  rr_bruto: number | null;
  rr_liquido_estimado: number | null;
  rr_aviso: string | null;
  // V6.6 (E04/F01): número puro de referência — o bloco de convicção (único lugar onde RR aparece
  // agora, DF-02) monta a observação "abaixo do recomendado" a partir destes dois campos.
  rr_minimo_referencia: number | null;
  rr_abaixo_do_minimo: boolean;
  custos_bps: Record<string, number>;
  entrada_ts: string | null;
  // V6.5 (G15, Decisão 8 do PO): 4 fatores de LOCALIZAÇÃO de QualidadeEntradaService.
  qualidade_entrada: { fator: string; avaliacao: 'BOM' | 'MEDIO' | 'RUIM'; detalhe: string }[] | null;
}

// V6.5 (E08): Plano A e Plano B chegavam com formatos diferentes — CandidateSetup completo para A,
// um Record<string, unknown> solto para B (planoB) sem tamanho sugerido/risco em dólar/RR líquido
// calculados. PlanoSetup é o formato único que os dois agora compartilham em execution.planos[],
// permitindo a tela trocar TODOS os campos (não só a entrada) ao alternar de plano.
export interface PlanoSetup {
  plano: 'A' | 'B';
  entrada: number | null;
  stop: number | null;
  tp1: number | null;
  tp1_fonte: string | null;
  tp2: number | null;
  tp2_fonte: string | null;
  tp2_motivo: string | null;
  tp3: number | null;
  tp3_fonte: string | null;
  tp3_motivo: string | null;
  alavancagem: number | null;
  alavancagem_info: AlavancagemInfo | null;
  liquidacao: number | null;
  liquidacao_rotulo: string | null;
  risco_preco_pct: number | null;
  risco_margem_pct: number | null;
  risco_usd_estimado: number | null;
  nocional_estimado: number | null;
  quantidade_base_estimada: number | null;
  ativo_base: string | null;
  rr_bruto: number | null;
  rr_liquido_estimado: number | null;
  rr_aviso: string | null;
  // V6.6 (E04/F01): número puro de referência — o bloco de convicção (único lugar onde RR aparece
  // agora, DF-02) monta a observação "abaixo do recomendado" a partir destes dois campos.
  rr_minimo_referencia: number | null;
  rr_abaixo_do_minimo: boolean;
  // V6.5 (G02): substituem 'invalidacao' (string) — o backend montava a frase com o nível cru embutido
  // (ex.: "$65370.9262", sem separador de milhar); agora devolve direção + nível numéricos, o frontend
  // formata e monta o texto.
  invalidacao_direcao: 'acima' | 'abaixo' | null;
  invalidacao_nivel: number | null;
  // Só preenchidos no Plano B (zona de entrada calculada) — null no Plano A.
  zona_de: number | null;
  zona_ate: number | null;
  fonte: string | null;
  descricao: string | null;
  custos_bps: Record<string, number>;
  entrada_ts: string | null;
  // V6.5 (G15, Decisão 8 do PO): 4 fatores de LOCALIZAÇÃO (não repetem os 67 indicadores do score),
  // calculados por QualidadeEntradaService a partir da entrada específica deste plano — texto aberto,
  // sem nota composta nem porcentagem inventada. null quando os insumos (EMA21/ATR/barreira) não
  // estavam disponíveis.
  qualidade_entrada: { fator: string; avaliacao: 'BOM' | 'MEDIO' | 'RUIM'; detalhe: string }[] | null;
}

export interface GenesisAnalysisResult {
  analysis_id: string;
  pair: string;
  analysis_version?: string | null;
  market_price?: number | null;
  snapshot_observed_at?: string | null;
  analysis: {
    direction: AnalysisDirection;
    status: AnalysisStatus;
    conviccao_modelo: number | null;
    reason_code: string | null;
    score_familias?: ScoreFamilias;
    justificativa_score?: string;
    score_contexto?: ScoreContexto;
    narrativa_tecnica?: string;
    invalidacao_tese?: string;
    // Contrato canônico em inglês (Adendo Seção 33), publicado ao lado do
    // português acima — mesmo valor, nunca recalculado (Seção 14.4/31.1).
    conviction?: number;
    coverage?: number;
    // V6.5 (G14): antes leitura_fraca vinha chumbado em false do adaptador e base_conviction
    // reintroduzia o conceito de convicção-base separada (a V6 aboliu isso, é só o score final de
    // novo). cobertura_baixa é derivado de verdade a partir de coverage_percent — nunca chumbado.
    cobertura_baixa?: boolean;
    family_scores?: GraphicalFamilyScores;
    score_justification?: string;
    technical_analysis?: string;
    score_context?: GraphicalScoreContext;
    thesis_invalidation?: string;
  };
  execution: {
    status: ExecutionStatus;
    executable: boolean;
    // V6.5 (E02): separado de 'executable' — 'executable' agora só diz que a matemática fechou
    // (stop válido, TP1 real, risco configurado); 'recommended' diz se, além disso, passou nos
    // limiares de RR e convicção. RR baixo/convicção baixa não bloqueiam mais a interação.
    recommended: boolean;
    action: 'LONG' | 'SHORT' | null;
    direction_reference: 'LONG' | 'SHORT' | null;
    reason_code: string | null;
    motivo: string;
    candidate_setup: CandidateSetup | null;
    executable_setup: CandidateSetup | null;
    planoB: Record<string, unknown> | null;
    // V6.5 (E08): 1 item (só Plano A) ou 2 (A e B), mesmo formato completo pros dois — ver PlanoSetup.
    planos: PlanoSetup[];
    // V6.5 (G02): invalidacao (string) substituída por direção + nível numéricos — campo legado,
    // relevante só pra decisões cacheadas antes de execution.planos[] existir (E08).
    zonaInteresse: {
      tipo: string;
      zona: string;
      invalidacao_direcao: 'acima' | 'abaixo' | null;
      invalidacao_nivel: number | null;
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
  // Restauração pós-entrega (2026-07-27): score_basis já vem pronto do decisor (justificativa
  // estruturada), reaproveitado pras barras Técnico/Derivativos sem recalcular nada.
  score_basis?: Record<string, string> | null;
  // V6.6 (A04): figura gráfica identificada pelo decisor (visual_observations.patterns) — antes
  // chegava na resposta HTTP e era descartada no adaptador, sem nenhum componente exibindo.
  visual_observations?: { patterns: VisualPattern[] };
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
  market?: 'SPOT' | 'FUTURES'; // R3.2 — Adendo Secao 9.1: mercado lido pelo OCR 1
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
