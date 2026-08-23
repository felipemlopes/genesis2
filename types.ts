// V6.7 (G-44): ExecutionPlanB e ScoreBasis vêm do contrato real do backend (types/graphicalAnalysis.ts)
// em vez de Record<string, unknown>/Record<string, string> genéricos — eram esses dois "achatamentos"
// que forçavam o adaptador (geminiService.ts) a usar "as unknown as" pra preencher os campos.
// V6.8 (spec genesis-v6-8-correcao-tecnica, Fase 7): `DerivativesContext` importado com alias —
// já existe uma interface LOCAL de mesmo nome neste arquivo (linha abaixo, formato antigo da era
// "famílias votantes" pré-V6, classification/modifier/rule — não usada por nenhum componente real,
// candidata a limpeza futura, não removida aqui por estar fora do escopo desta fase) que colidiria
// com o nome do contrato real do backend.
import type { VisualPattern, VisualObject, FibonacciObservation, VrvpObservation, DerivativesContext as GraphicalDerivativesContext, DirectionContradiction, ExecutionPlanB, ScoreBasis, StopStatus, StopAncora, StopBuffer, RrPorAlvo, DataTraceability } from './types/graphicalAnalysis';

// V6.7 (A-13): reexportados para quem importa de '../types' (a maioria dos componentes) em vez de
// '../types/graphicalAnalysis' diretamente.
export type { StopStatus, StopAncora, StopBuffer };

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
// V6.7 (B-17, DP-06): 'aplicada' passa a ser sempre igual a 'escolhida'; 'ajustada' foi substituído
// por 'excede_seguro' — mesma estrutura de types/graphicalAnalysis.ts (compatibilidade estrutural).
export interface AlavancagemInfo {
  escolhida: number;
  aplicada: number;
  maxima_segura: number;
  excede_seguro: boolean;
  motivo: string | null;
}

export interface CandidateSetup {
  entrada: number | null;
  stop: number | null;
  tp1: number | null;
  tp1_fonte: string | null;
  // C7 (V6.9): rótulo em linguagem de trader (AlvoService::rotuloDeTrader()).
  tp1_rotulo: string | null;
  tp2: number | null;
  tp2_fonte: string | null;
  // V6.6 (C06): motivo da ausência quando tp2/tp3 vem null — sem barreira dentro do horizonte do
  // timeframe. Permite a tela explicar em vez de só mostrar traço/sumir o campo.
  tp2_motivo: string | null;
  tp2_rotulo: string | null;
  tp3: number | null;
  tp3_fonte: string | null;
  tp3_motivo: string | null;
  tp3_rotulo: string | null;
  alavancagem: number | null;
  alavancagem_info: AlavancagemInfo | null;
  liquidacao: number | null;
  liquidacao_rotulo: 'estimada' | null;
  risco_preco_pct: number | null;
  // D7 (V6.9): renomeado de 'risco_margem_pct' — sempre foi risco sobre o CAPITAL-BASE (saldo
  // total), nunca a margem de fato comprometida nesta posição especificamente.
  risco_pct_capital_base: number | null;
  // D7 (V6.9): novo — risco / margem desta posição (nocional/alavancagem), o número que faltava.
  risco_pct_margem: number | null;
  risco_usd_estimado: number | null;
  nocional_estimado: number | null;
  // V6.5 (E11): substituem tamanho_sugerido_texto — o texto ("0.05 BTCUSDT") usava o par inteiro como
  // se fosse a unidade da quantidade; a unidade real é só o ativo base (BTC). Backend para de montar
  // frase, frontend formata a partir destes dois campos.
  quantidade_base_estimada: number | null;
  ativo_base: string | null;
  rr_bruto: number | null;
  rr_liquido_estimado: number | null;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.7, doc §18): strings
  // prontas ("1:%.2f") calculadas uma única vez no backend — nunca mais reconstruídas com
  // .toFixed(2) no frontend.
  rr_bruto_exibir: string | null;
  rr_liquido_exibir: string | null;
  rr_aviso: string | null;
  // V6.6 (E04/F01): número puro de referência — o bloco de convicção (único lugar onde RR aparece
  // agora, DF-02) monta a observação "abaixo do recomendado" a partir destes dois campos.
  rr_minimo_referencia: number | null;
  rr_abaixo_do_minimo: boolean;
  custos_bps: Record<string, number>;
  entrada_ts: string | null;
  // V6.5 (G15, Decisão 8 do PO): 4 fatores de LOCALIZAÇÃO de QualidadeEntradaService.
  // item 13.6: UNAVAILABLE — os 4 fatores aparecem sempre agora, nunca somem por falta de insumo.
  qualidade_entrada: { fator: string; avaliacao: 'BOM' | 'MEDIO' | 'RUIM' | 'UNAVAILABLE'; detalhe: string }[] | null;
  // V6.7 (A-13): campos novos do contrato do stop.
  stop_status: StopStatus;
  stop_ancora: StopAncora | null;
  stop_buffer: StopBuffer | null;
  stop_motivo: string | null;
  // V6.7 (B-20): verificação de segurança de liquidação — null quando não há stop.
  verificacao: 'SEGURO' | 'INSEGURO' | null;
  verificacao_motivo: string | null;
  // D1 (V6.9): distingue LIQ_ANTES_DO_STOP de LIQ_FOLGA_CURTA quando verificacao === 'INSEGURO'.
  liquidacao_classificacao: 'LIQ_ANTES_DO_STOP' | 'LIQ_FOLGA_CURTA' | null;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 8/9/11, doc §13/§16): mesmos campos
  // novos de PlanoSetup abaixo — candidate_setup (Plano A) carrega o mesmo objeto praticamente.
  recommended: boolean;
  reason_code: string | null;
  motivo: string | null;
  alvo_que_atende: string | null;
  rr_por_alvo: RrPorAlvo;
  capital_base_usd: number | null;
  margem_comprometida_usd: number | null;
  margem_comprometida_pct_capital: number | null;
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
  tp1_rotulo: string | null;
  tp2: number | null;
  tp2_fonte: string | null;
  tp2_motivo: string | null;
  tp2_rotulo: string | null;
  tp3: number | null;
  tp3_fonte: string | null;
  tp3_motivo: string | null;
  tp3_rotulo: string | null;
  alavancagem: number | null;
  alavancagem_info: AlavancagemInfo | null;
  liquidacao: number | null;
  liquidacao_rotulo: string | null;
  risco_preco_pct: number | null;
  risco_pct_capital_base: number | null;
  risco_pct_margem: number | null;
  risco_usd_estimado: number | null;
  nocional_estimado: number | null;
  quantidade_base_estimada: number | null;
  ativo_base: string | null;
  rr_bruto: number | null;
  rr_liquido_estimado: number | null;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.7, doc §18): strings
  // prontas ("1:%.2f") calculadas uma única vez no backend — nunca mais reconstruídas com
  // .toFixed(2) no frontend.
  rr_bruto_exibir: string | null;
  rr_liquido_exibir: string | null;
  rr_aviso: string | null;
  // V6.6 (E04/F01): número puro de referência — o bloco de convicção (único lugar onde RR aparece
  // agora, DF-02) monta a observação "abaixo do recomendado" a partir destes dois campos.
  rr_minimo_referencia: number | null;
  rr_abaixo_do_minimo: boolean;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.8/11.9/11.10, doc §16):
  // cada plano ganha sua PRÓPRIA recomendação (antes só existia uma, em execution.recommended,
  // implicitamente do Plano A) e o risco-retorno de TP2/TP3 pronto do backend (antes recalculado
  // no cliente, utils/riscoRetorno.ts — apagado, ver AnalysisResult.tsx).
  recommended: boolean;
  reason_code: string | null;
  motivo: string | null;
  alvo_que_atende: string | null;
  rr_por_alvo: RrPorAlvo;
  // Fase 11, item 11.10: três linhas sempre distintas — capital-base, margem comprometida nesta
  // posição, e a segunda como % da primeira. Diferentes de risco_usd_estimado/
  // risco_pct_capital_base (acima), que medem risco se o stop for atingido, não margem travada.
  capital_base_usd: number | null;
  margem_comprometida_usd: number | null;
  margem_comprometida_pct_capital: number | null;
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
  // item 13.6: UNAVAILABLE — os 4 fatores aparecem sempre agora, nunca somem por falta de insumo.
  qualidade_entrada: { fator: string; avaliacao: 'BOM' | 'MEDIO' | 'RUIM' | 'UNAVAILABLE'; detalhe: string }[] | null;
  // V6.7 (A-13): campos novos do contrato do stop — presentes nos dois planos.
  stop_status: StopStatus;
  stop_ancora: StopAncora | null;
  stop_buffer: StopBuffer | null;
  stop_motivo: string | null;
  // V6.7 (B-20/B-21): verificação de segurança de liquidação — presente nos dois planos, cada um
  // calculado contra o próprio stop.
  verificacao: 'SEGURO' | 'INSEGURO' | null;
  verificacao_motivo: string | null;
  liquidacao_classificacao: 'LIQ_ANTES_DO_STOP' | 'LIQ_FOLGA_CURTA' | null;
}

export interface GenesisAnalysisResult {
  analysis_id: string;
  pair: string;
  analysis_version?: string | null;
  market_price?: number | null;
  // F9 (V6.9): variação do PRÓPRIO candle analisado — GraphicalAnalysisResult.candle_change_pct.
  candle_change_pct?: number | null;
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
    // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.14, doc §18): substitui
    // nota_cobertura (G5, V6.9) — GraphicalAnalysisResult.data_traceability.
    data_traceability?: DataTraceability | null;
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
    // A8 (V6.9): "TP2"/"TP3" quando um alvo posterior já atende o R/R mínimo mesmo com o plano
    // não recomendado — types/graphicalAnalysis.ts::ExecutionResult.alvo_que_atende.
    alvo_que_atende?: string | null;
    candidate_setup: CandidateSetup | null;
    executable_setup: CandidateSetup | null;
    planoB: ExecutionPlanB | null;
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
  score_basis?: ScoreBasis | null;
  // V6.6 (A04): figura gráfica identificada pelo decisor (visual_observations.patterns) — antes
  // chegava na resposta HTTP e era descartada no adaptador, sem nenhum componente exibindo.
  // V6.8 (spec genesis-v6-8-correcao-tecnica, Fase 7/P1-06): objects/fibonacci/vrvp também chegam
  // prontos da API e eram descartados junto — mesmo achado do P1-06 (VIX/DXY/S&P/Fear&Greed/
  // dominância do BTC), agora preservados também aqui.
  visual_observations?: { patterns: VisualPattern[]; objects: VisualObject[]; fibonacci: FibonacciObservation[]; vrvp: VrvpObservation | null };
  // V6.8 (Fase 7/P1-06): contexto de derivativos (funding/OI implícito na leitura do decisor) —
  // chegava pronto em GraphicalAnalysisResult.derivatives_context e nunca era repassado pelo
  // adaptador; nenhum componente da tela o exibia.
  derivatives_context?: GraphicalDerivativesContext | null;
  // E1 (V6.9): contradições objetivas entre a direção e DMI/ADX/Supertrend/figura/tempos maiores —
  // chega pronto em GraphicalAnalysisResult.contradicoes (DirectionCoherenceGate, backend).
  contradicoes?: DirectionContradiction[];
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
  // D10 (V6.9): nullable — sem o número real do backend (candidate_setup.liquidacao), a liquidação
  // fica indisponível, nunca recalculada no cliente por uma fórmula própria (ver
  // services/futuresCalculations.ts, calculateLiquidationPrice() removida).
  liquidationPrice: number | null;
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
  // V6.7 (F-41): os dois planos (A e B) com entrada/stop/alvos/desfecho PRÓPRIOS — antes o histórico
  // só lia as colunas achatadas de `genesis_analises` (entrada/take_profit_*/stop_loss), que a versão
  // atual não grava mais para análises novas (fonte real é `genesis_analise_planos` desde a V6.5).
  // `[]` (ou ausente) em análises legado — `entry_price`/`target_price`/`stop_loss` acima continuam a
  // única fonte nesse caso.
  planos?: HistoricoPlano[];
}

export interface HistoricoPlano {
  plano: 'A' | 'B';
  entrada: number | null;
  stop: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  rr: number | null;
  // V6.7 (F-42): rr_bruto/rr_liquido — null enquanto a migration não estiver aplicada em produção
  // (autorização de banco pendente) ou em linhas gravadas antes dela.
  rr_bruto: number | null;
  rr_liquido: number | null;
  alavancagem: number | null;
  liquidacao: number | null;
  liquidacao_rotulo: string | null;
  status_acionamento: string | null;
  desfecho: string | null;
}
