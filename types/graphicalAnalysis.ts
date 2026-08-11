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

// V6.6 (A01): bbox (coordenadas de pixel) sai de patterns — substituído por âncoras de preço lidas
// diretamente do modelo (preco_topo/preco_base/preco_rompimento), pré-requisito de A06/B03 (motor de
// barreiras precisa de preço, não de posição relativa na imagem).
export interface VisualPattern {
  id: string;
  confidence: number;
  state: 'FORMING' | 'TESTING' | 'BREAKING' | 'RETESTING' | 'CONFIRMED';
  preco_topo: number | null;
  preco_base: number | null;
  preco_rompimento: number | null;
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

// V6.6 (B01): quarta chave de visual_observations, lida por OCR do próprio gráfico — presente:false
// é resposta válida quando o Volume Profile não está desenhado.
export interface VrvpObservation {
  presente: boolean;
  confianca?: number;
  poc?: number | null;
  hvn?: number[];
  lvn?: number[];
}

export interface VisualObservations {
  patterns: VisualPattern[];
  objects: VisualObject[];
  fibonacci: FibonacciObservation[];
  vrvp: VrvpObservation;
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
// V6.5 (E09-E10): antes alavancagemSegura() só devolvia o número já reduzido, sem indicar que houve
// redução — o membro pedia 20x, o sistema aplicava 8x em silêncio.
// V6.7 (B-17, DP-06): 'aplicada' passa a ser sempre igual a 'escolhida' (o sistema nunca mais reduz
// a alavancagem do membro); 'ajustada' foi substituído por 'excede_seguro' — mesmo papel de aviso,
// nunca mais de redução.
export interface AlavancagemInfo {
  escolhida: number;
  aplicada: number;
  maxima_segura: number;
  excede_seguro: boolean;
  motivo: string | null;
}

// V6.7 (A-13): contrato novo do stop. stop_status distingue os três estados que a tela renderiza
// (A-14); stop_ancora é o nível estrutural puro (antes do buffer); stop_buffer expõe os quatro
// componentes calculados (A-09) e qual venceu; stop_motivo só existe quando stop_status é
// STOP_UNAVAILABLE (mensagem de A-08).
export type StopStatus = 'VALID' | 'VALID_WIDE' | 'STOP_UNAVAILABLE';

export interface StopAncora {
  tipo: string;
  valor: number;
  origem: 'API' | 'VISION';
  validada: boolean;
  nota: number;
}

export interface StopBuffer {
  valor: number;
  componente_vencedor: string;
  componentes: {
    atr_0_5: number;
    pavios: number;
    spread: number;
    slippage: number;
  };
}

// V6.7 (G-44): antes faltavam tp2_motivo/tp3_motivo/qualidade_entrada — o backend
// (ExecucaoService::montar(), candidate_setup) sempre enviou os três, mas o tipo do contrato não os
// declarava, e o adaptador (geminiService.ts) escondia a divergência com "as unknown as CandidateSetup"
// em vez de dar erro de compilação. liquidacao_rotulo é literal 'estimada' (nunca outra string) para
// este formato — só o formato de plano (ExecutionPlanoSetup, abaixo) aceita string livre, quando o
// Plano B publica o texto de liquidação indisponível.
export interface ExecutionCandidateSetup {
  entrada: number;
  // V6.7 (A-08/A-14): stop deixa de ser sempre um número — STOP_UNAVAILABLE (sem âncora estrutural
  // dentro da banda elegível) publica null em vez de um stop fabricado por ATR.
  stop: number | null;
  tp1: number | null;
  tp1_fonte: string | null;
  tp2: number | null;
  tp2_fonte: string | null;
  tp2_motivo: string | null;
  tp3: number | null;
  tp3_fonte: string | null;
  tp3_motivo: string | null;
  alavancagem: number;
  alavancagem_info: AlavancagemInfo | null;
  liquidacao: number | null;
  liquidacao_rotulo: 'estimada' | null;
  risco_preco_pct: number | null;
  risco_margem_pct: number | null;
  risco_usd_estimado: number | null;
  nocional_estimado: number | null;
  quantidade_base_estimada: number | null;
  ativo_base: string | null;
  rr_bruto: number | null;
  rr_liquido_estimado: number | null;
  rr_aviso: string | null;
  rr_minimo_referencia: number | null;
  rr_abaixo_do_minimo: boolean;
  custos_bps: Record<string, number>;
  entrada_ts: string;
  qualidade_entrada: { fator: string; avaliacao: 'BOM' | 'MEDIO' | 'RUIM'; detalhe: string }[] | null;
  // V6.7 (A-13): campos novos do contrato do stop.
  stop_status: StopStatus;
  stop_ancora: StopAncora | null;
  stop_buffer: StopBuffer | null;
  stop_motivo: string | null;
  // V6.7 (B-20): verificação de segurança de liquidação (stop cai antes ou depois da liquidação) —
  // null quando não há stop (STOP_UNAVAILABLE), mesmo padrão de alavancagem_info/liquidacao acima.
  verificacao: 'SEGURO' | 'INSEGURO' | null;
  verificacao_motivo: string | null;
}

// V6.7 (G-44): faltavam zona_de/zona_ate/fonte — MotorExecucaoService::gerarPlanoB() sempre devolveu
// os três (usados por ExecucaoService::montar() para montar zonaInteresse e planoBCompleto), mas o
// tipo não os declarava. Este é o formato bruto de execution.planoB (compatibilidade legado); o
// formato completo e verificado pela tela é execution.planos[] (ExecutionPlanoSetup, abaixo).
export interface ExecutionPlanB {
  entrada: number;
  stop: number;
  zona_de: number | null;
  zona_ate: number | null;
  fonte: string | null;
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
  // V6.7 (A-13): stop próprio do Plano B — gerarPlanoB() devolve null (Plano B indisponível) em vez
  // de publicar este objeto quando STOP_UNAVAILABLE, então aqui dentro stop_status é sempre 'VALID'
  // ou 'VALID_WIDE' na prática.
  stop_status: StopStatus;
  stop_ancora: StopAncora | null;
  stop_buffer: StopBuffer | null;
  stop_motivo: string | null;
}

// V6.5 (E08): formato único e completo compartilhado pelos dois planos em execution.planos[] — antes
// Plano A (ExecutionCandidateSetup) e Plano B (ExecutionPlanB, acima) tinham formatos diferentes, e
// Plano B nem tinha metade dos campos (tamanho sugerido, risco em dólar, RR líquido com custo).
export interface ExecutionPlanoSetup {
  plano: 'A' | 'B';
  entrada: number | null;
  stop: number | null;
  tp1: number | null;
  tp1_fonte: string | null;
  tp2: number | null;
  tp2_fonte: string | null;
  // V6.7 (G-44): faltavam — ExecucaoService::montar() sempre inclui tp2_motivo/tp3_motivo em cada
  // item de 'planos' (linhas 429/432 do Plano A, 378/381 do Plano B, ambos podendo ser null).
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
  rr_minimo_referencia: number | null;
  rr_abaixo_do_minimo: boolean;
  // V6.5 (G02): substituem 'invalidacao' (string, número cru embutido) — direção + nível numéricos.
  invalidacao_direcao: 'acima' | 'abaixo' | null;
  invalidacao_nivel: number | null;
  zona_de: number | null;
  zona_ate: number | null;
  fonte: string | null;
  descricao: string | null;
  custos_bps: Record<string, number>;
  entrada_ts: string | null;
  // V6.5 (G15): 4 fatores de LOCALIZAÇÃO de QualidadeEntradaService — null quando não computado
  // (hoje, sempre null no Plano B: ver ExecucaoService.php).
  qualidade_entrada: { fator: string; avaliacao: 'BOM' | 'MEDIO' | 'RUIM'; detalhe: string }[] | null;
  // V6.7 (A-13): campos novos do contrato do stop — presentes nos dois planos, cada um com sua
  // própria âncora/buffer (o stop do Plano B é ancorado na própria entrada dele, não na do Plano A).
  stop_status: StopStatus;
  stop_ancora: StopAncora | null;
  stop_buffer: StopBuffer | null;
  stop_motivo: string | null;
  // V6.7 (B-20/B-21): verificação de segurança de liquidação — presente nos dois planos, cada um
  // calculado contra o próprio stop (B-21: Plano B não reaproveita mais o do Plano A).
  verificacao: 'SEGURO' | 'INSEGURO' | null;
  verificacao_motivo: string | null;
}

export interface ExecutionPipelineResult {
  status: string;
  executable: boolean;
  // V6.5 (E02): 'executable' agora só diz que a matemática fechou; 'recommended' diz se também passou
  // nos limiares de RR e convicção — os dois deixaram de ser a mesma coisa.
  recommended: boolean;
  action: AnalysisDirection | null;
  direction_reference: AnalysisDirection | null;
  reason_code: string | null;
  motivo: string;
  candidate_setup: ExecutionCandidateSetup | null;
  executable_setup: ExecutionCandidateSetup | null;
  planoB: ExecutionPlanB | null;
  // V6.5 (E08): 1 ou 2 itens, mesmo formato completo pros dois planos.
  planos: ExecutionPlanoSetup[];
  zonaInteresse: { tipo: string; zona: string; invalidacao_direcao: 'acima' | 'abaixo' | null; invalidacao_nivel: number | null } | null;
  avisos: string[];
  stop_ancora: { tipo: string; valor: number } | null;
}

// Spec genesis-analise-grafica-fila-assincrona (Fase 5.1): POST /v1/graphical-analysis deixou de
// devolver sempre o resultado completo — o backend roda a análise fora da requisição agora (job em
// fila), então a resposta pode vir em qualquer um dos 4 estados abaixo, dependendo de quando a
// chegamos a checar (com fila de verdade em produção, quase sempre PENDING logo após o POST; com
// QUEUE_CONNECTION=sync em dev, o job já rodou e a resposta já vem resolvida). União discriminada
// por `status` em vez de simplesmente alargar o tipo do campo em GraphicalAnalysisResult — os
// outros 3 estados não têm nenhum dos campos ricos (direction/score/execution/etc.), então exigir
// esses campos preenchidos pra eles seria enganoso.
export interface GraphicalAnalysisPendingResult {
  analysis_id: string;
  status: 'PENDING';
}

// FAILED (tentativas esgotadas) e REJECTED_IMAGE (corretora errada, gráfico ilegível etc.) têm o
// mesmo shape enxuto — nenhum dos dois tem decision_payload/evidence_manifest preenchido no
// backend (ver AsyncAnalysisResponse.php).
export interface GraphicalAnalysisTerminalWithoutDataResult {
  analysis_id: string;
  status: 'FAILED' | 'REJECTED_IMAGE';
  reason_code: string | null;
  motivo: string | null;
}

// Só os 2 estados finais (nunca PENDING) — o shape real de retorno de quem faz o poll até resolver
// (services/geminiService.ts::pollAnalysisUntilTerminal()). Separado de GraphicalAnalysisPollResult
// pra o TypeScript conseguir estreitar `status` corretamente depois de um poll (sem isso, o
// compilador não sabe que a função nunca devolve 'PENDING' de verdade e reintroduz esse caso depois
// de qualquer reatribuição de variável).
export type GraphicalAnalysisTerminalResult =
  | GraphicalAnalysisTerminalWithoutDataResult
  | GraphicalAnalysisResult;

export type GraphicalAnalysisPollResult =
  | GraphicalAnalysisPendingResult
  | GraphicalAnalysisTerminalResult;

export interface GraphicalAnalysisResult {
  analysis_id: string;
  status: 'COMPLETED';
  pair: string;
  analysis_version?: string | null;
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
  market_price: number | null;
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
