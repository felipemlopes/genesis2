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

// V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.4, doc §16): substitui
// MacroNarrative/SentimentNarrative (formato antigo, aninhado dentro de EvidenceValue — o backend
// nunca publicou de fato esse formato pros dois blocos, ver AnalysisPublicResponseBuilder). Bloco
// status/error_code é do BLOCO inteiro (macro ou sentimento), não mais por campo individual —
// GeminiContextService (backend) só marca AVAILABLE quando o texto (resumo/narrativa) realmente
// veio preenchido; score pode ser null legitimamente sem derrubar o status do bloco.
export interface InformativeBlockBase {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  error_code: string | null;
}

// Evento do Radar News, com fonte e URL reais — nunca inventado pela IA (GeminiContextService,
// backend, grounding obrigatório).
export interface RadarNewsEvento {
  title: string;
  summary: string;
  source: string;
  source_url: string;
  published_at: string;
  observed_at: string;
  relevance: 'HIGH' | 'MEDIUM';
}

// Indicador de mercado global (InformativeDisplayContextService, backend) — nunca entra no
// bundle/evidence/manifest_hash decisório, só exibição.
export interface DisplayMetric {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  value: number | null;
  unit: string | null;
  source: string | null;
  observed_at: string | null;
  error_code: string | null;
}

export interface CanonicalMacroContext extends InformativeBlockBase {
  resumo: string | null;
  score: number | null;
  eventos: RadarNewsEvento[];
  vix: DisplayMetric;
  dxy_change_pct: DisplayMetric;
  sp500_change_pct: DisplayMetric;
  // A2 (V6.9): fear_greed/btc_dominance vivem em macro — mercado global, não do ativo.
  fear_greed: DisplayMetric;
  btc_dominance: DisplayMetric;
}

export interface CanonicalSentimentContext extends InformativeBlockBase {
  narrativa: string | null;
  score: number | null;
  eventos: RadarNewsEvento[];
  gatilhos_positivos: string[];
  gatilhos_negativos: string[];
}

export interface InformativeContext {
  indicators: {
    rsi14: EvidenceValue;
    adx14: EvidenceValue;
    // V6.8 (spec genesis-v6-8-correcao-tecnica, Fase 6.1/CODE-P1-01, Fase 7.1/P1-07): DMI completo —
    // AnalysisPublicResponseBuilder.php (backend) já publica os três ao lado de adx14; só faltava o
    // contrato do front conhecê-los. EvidenceValue<boolean> porque adx_rising é booleano
    // (ausência=null/UNAVAILABLE, valor real pode ser `false`, nunca confundir os dois).
    plus_di14: EvidenceValue;
    minus_di14: EvidenceValue;
    adx_rising: EvidenceValue<boolean>;
    // F2 (V6.9): faixas de referência prontas em português (FaixasIndicador, backend) — texto já
    // pronto pra tela, não um EvidenceValue (não é evidência do bundle, é derivado dela).
    adx_faixa: string | null;
    di_faixa: string | null;
    adx_em_elevacao_relevante: boolean;
    rsi_faixa: string | null;
    cmf_faixa: string | null;
    atr14: EvidenceValue;
    ema21: EvidenceValue;
    ema50: EvidenceValue;
    ema200: EvidenceValue;
    wyckoff: EvidenceValue<Record<string, unknown>>;
    session: EvidenceValue<{ name: string; utc_hour: number }>;
    multi_timeframe: EvidenceValue<MultiTimeframeEntry[]>;
  };
  macro: CanonicalMacroContext;
  sentiment: CanonicalSentimentContext;
}

// Restauração pós-entrega (2026-07-27): justificativa estruturada que o próprio decisor já devolve
// junto da decisão — não é um cálculo novo, só nunca tinha sido exposto na resposta pública. Usado
// pra colorir os blocos Técnico/Derivativos sem recalcular nada em paralelo ao Gemini.
// A9 (V6.9): derivatives_confirmation saiu daqui — a Etapa 1 (que produz score_basis) nunca mais
// recebe evidência de derivativos. O equivalente agora é `DerivativesContext.strength`, resposta da
// Etapa 2 (chamada separada, nunca decide direção — ver GenesisDecisionStage2Schema no backend).
export interface ScoreBasis {
  technical_coherence: 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
  structure_clarity: 'UNCLEAR' | 'PARTIAL' | 'CLEAR' | 'VERY_CLEAR';
  contradiction_level: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH';
  data_quality: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
}

// E1 (V6.9): uma contradição objetiva entre a direção decidida e um indicador que o pipeline já
// calcula (DMI, ADX fraco, Supertrend, viés de figura, tempos maiores) — ver
// DirectionCoherenceGate no backend, única fonte desta lista.
export interface DirectionContradiction {
  tipo: 'DMI' | 'ADX_FRACO' | 'SUPERTREND' | 'FIGURA' | 'MULTI_TIMEFRAME';
  detalhe: string;
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
  // C7 (V6.9): rótulo em linguagem de trader (AlvoService::rotuloDeTrader()) — nunca "suporte/
  // resistência visual" genérico, descreve a origem real (fundo de swing, parede do book, etc.).
  tp1_rotulo: string | null;
  tp2: number | null;
  tp2_fonte: string | null;
  tp2_motivo: string | null;
  tp2_rotulo: string | null;
  tp3: number | null;
  tp3_fonte: string | null;
  tp3_motivo: string | null;
  tp3_rotulo: string | null;
  alavancagem: number;
  alavancagem_info: AlavancagemInfo | null;
  liquidacao: number | null;
  liquidacao_rotulo: 'estimada' | null;
  risco_preco_pct: number | null;
  // D7 (V6.9): renomeado de 'risco_margem_pct' — sempre foi risco sobre o capital-base (saldo
  // total), nunca a margem de fato comprometida nesta posição especificamente.
  risco_pct_capital_base: number | null;
  // D7 (V6.9): novo — risco / margem desta posição (nocional/alavancagem).
  risco_pct_margem: number | null;
  risco_usd_estimado: number | null;
  nocional_estimado: number | null;
  quantidade_base_estimada: number | null;
  ativo_base: string | null;
  // Spec genesis-v6-10-implementacao (Fase 6, item 6.7, doc §6.7): o arredondamento da quantidade
  // pro stepSize real do contrato pode reduzir o risco realizado bem abaixo do planejado —
  // populados só quando o desvio passa de 10%, null nos demais casos.
  risco_planejado: number | null;
  risco_real: number | null;
  risco_desvio_pct: number | null;
  rr_bruto: number | null;
  rr_liquido_estimado: number | null;
  // item 13.7: strings prontas ("1:%.2f"), mesma doutrina de TargetRiskReward acima.
  rr_bruto_exibir: string | null;
  rr_liquido_exibir: string | null;
  // Spec genesis-v6-10-implementacao (Fase 9, item 9.2, doc §9.2): R:R combinado dos três alvos
  // pelas parciais configuradas (ExecucaoService::calcularRrLiquidoCombinado()) — é o número que o
  // cabeçalho (BlocoConviccaoQualidade) exibe agora, não mais rr_liquido_estimado (TP1 isolado,
  // que continua existindo aqui e em rr_por_alvo.tp1, sem mudança).
  rr_liquido_combinado: number | null;
  rr_liquido_combinado_exibir: string | null;
  rr_liquido_combinado_abaixo_do_minimo: boolean;
  parciais_alvo: Record<string, number>;
  rr_aviso: string | null;
  rr_minimo_referencia: number | null;
  rr_abaixo_do_minimo: boolean;
  custos_bps: Record<string, number>;
  entrada_ts: string;
  // item 13.6: UNAVAILABLE — os 4 fatores aparecem sempre agora, nunca somem por falta de insumo.
  qualidade_entrada: { fator: string; avaliacao: 'BOM' | 'MEDIO' | 'RUIM' | 'UNAVAILABLE'; detalhe: string }[] | null;
  // V6.7 (A-13): campos novos do contrato do stop.
  stop_status: StopStatus;
  stop_ancora: StopAncora | null;
  stop_buffer: StopBuffer | null;
  stop_motivo: string | null;
  // V6.7 (B-20): verificação de segurança de liquidação (stop cai antes ou depois da liquidação) —
  // null quando não há stop (STOP_UNAVAILABLE), mesmo padrão de alavancagem_info/liquidacao acima.
  verificacao: 'SEGURO' | 'INSEGURO' | null;
  verificacao_motivo: string | null;
  // D1 (V6.9): distingue LIQ_ANTES_DO_STOP de LIQ_FOLGA_CURTA quando verificacao === 'INSEGURO'.
  liquidacao_classificacao: 'LIQ_ANTES_DO_STOP' | 'LIQ_FOLGA_CURTA' | null;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 8/9/11, doc §13/§16): candidate_setup
  // (Plano A) carrega os mesmos campos novos que execution.planos[0] — mesmo objeto, praticamente
  // idêntico ao Plano A dentro de planos[] (mantido por compatibilidade com decisões cacheadas
  // anteriores a planos[] existir).
  recommended: boolean;
  reason_code: string | null;
  motivo: string | null;
  alvo_que_atende: string | null;
  microanalise: PlanMicroanalysis | null;
  target_details: TargetDetails;
  rr_por_alvo: RrPorAlvo;
  tick_size: number | null;
  tick_decimals: number | null;
  maintenance_margin: MaintenanceMargin | null;
  capital_base_usd: number | null;
  margem_comprometida_usd: number | null;
  margem_comprometida_pct_capital: number | null;
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
  tp1_rotulo: string | null;
  tp2: number | null;
  tp2_rotulo: string | null;
  tp3: number | null;
  tp3_rotulo: string | null;
  alavancagem: number;
  liquidacao: number | string | null;
  riscoPct: number;
  rr1: number;
  verificacao: 'SEGURO' | 'INSEGURO';
  verificacao_motivo: string | null;
  liquidacao_classificacao: 'LIQ_ANTES_DO_STOP' | 'LIQ_FOLGA_CURTA' | null;
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

// V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.4, doc §16): zona real do
// catálogo (TargetCandidateCatalog, backend) — a IA seleciona candidate_id, nunca devolve preço.
export interface TargetCandidate {
  candidate_id: string;
  side: 'ABOVE' | 'BELOW';
  price: number;
  distance_atr: number;
  // Spec genesis-v6-10-implementacao (Fase 9, item 9.1, doc §9.1): distância até esta candidata
  // dividida pela distância do stop automático provisório do mesmo lado (calculado antes de
  // qualquer decisão da IA) — a IA usa isto pra preferir, no TP1, uma candidata que já pague pelo
  // menos 1:1 de risco-retorno, em vez de sempre a barreira mais próxima disponível. `null` quando
  // não há stop automático provisório desse lado (ex.: sem nenhuma âncora elegível no pool).
  rr_provisorio: number | null;
  primary_source: string;
  label: string;
}

// Rastreabilidade completa de um TP até o item exato do catálogo que o originou
// (AlvoService::calcularAlvos(), backend) — null quando o alvo correspondente está ausente.
export interface TargetDetail {
  candidate_id: string | null;
  price: number | null;
  source: string | null;
  label: string | null;
}

export interface TargetDetails {
  tp1: TargetDetail | null;
  tp2: TargetDetail | null;
  tp3: TargetDetail | null;
}

// Risco-retorno de UM alvo (ExecucaoService::calcularRrPorAlvo(), backend) — valido=false nunca
// tem rr_bruto/rr_liquido preenchidos, sempre motivo_ausencia.
export interface TargetRiskReward {
  alvo: number | null;
  fonte: string | null;
  rr_bruto: number | null;
  rr_liquido: number | null;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.7, doc §18): string pronta
  // ("1:%.2f") calculada uma única vez no backend — o frontend nunca mais faz .toFixed(2) sozinho.
  rr_bruto_exibir: string | null;
  rr_liquido_exibir: string | null;
  custo_bps: number | null;
  valido: boolean;
  motivo_ausencia: string | null;
}

export interface RrPorAlvo {
  tp1: TargetRiskReward;
  tp2: TargetRiskReward;
  tp3: TargetRiskReward;
}

// BreakRetestService::horizontal() (backend) — rompimento/reteste real por candle fechado, nunca
// projeção. status=UNAVAILABLE quando não há candles/nível suficiente para avaliar.
export interface BreakRetestResult {
  status: 'UNAVAILABLE' | 'OK';
  event: 'NO_BREAK' | 'FALSE_BREAK_UP' | 'FALSE_BREAK_DOWN' | 'RETEST_UP_CONFIRMED' | 'RETEST_DOWN_CONFIRMED' | 'BREAK_UP_CONFIRMED' | 'BREAK_DOWN_CONFIRMED' | null;
  level?: number;
  break_index?: number;
  confirmation_offset?: number | null;
}

// PlanAMicroanalysisService (backend) — barreira contrária mais próxima, posição no range,
// break/retest, risco de antecipação. Hoje só o Plano A tem (null no Plano B).
export interface PlanMicroanalysis {
  nearest_contrary_barrier: TargetCandidate | null;
  range_position: 'LOWER' | 'MIDDLE' | 'UPPER' | null;
  break_retest: BreakRetestResult | null;
  anticipation_risk: 'LOW' | 'MODERATE' | 'HIGH' | 'UNAVAILABLE';
  risk_factors: string[];
}

// LiquidationCalculatorService (backend) — liquidação por bracket real, nunca margem fixa como
// substituição silenciosa. status=UNAVAILABLE quando o bracket real não veio (nunca um número
// calculado com manutenção inventada como se fosse real).
export interface MaintenanceMargin {
  liquidation_price: number | null;
  maintenance_margin_ratio: number | null;
  bracket: number | null;
  source: string;
  status: 'NO_RISK' | 'UNAVAILABLE' | 'AVAILABLE';
  verification: 'SEGURO' | 'INSEGURO' | null;
  verification_reason: string | null;
  liquidation_classification: 'LIQ_ANTES_DO_STOP' | 'LIQ_FOLGA_CURTA' | null;
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
  // C7 (V6.9): mesmo campo de ExecutionCandidateSetup acima — execution.planos[] é o formato
  // completo que a tela usa pra alternar entre Plano A e B, precisa carregar tudo que o outro tem.
  tp1_rotulo: string | null;
  tp2: number | null;
  tp2_fonte: string | null;
  // V6.7 (G-44): faltavam — ExecucaoService::montar() sempre inclui tp2_motivo/tp3_motivo em cada
  // item de 'planos' (linhas 429/432 do Plano A, 378/381 do Plano B, ambos podendo ser null).
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
  // Spec genesis-v6-10-implementacao (Fase 6, item 6.7, doc §6.7): o arredondamento da quantidade
  // pro stepSize real do contrato pode reduzir o risco realizado bem abaixo do planejado —
  // populados só quando o desvio passa de 10%, null nos demais casos.
  risco_planejado: number | null;
  risco_real: number | null;
  risco_desvio_pct: number | null;
  rr_bruto: number | null;
  rr_liquido_estimado: number | null;
  // item 13.7: strings prontas ("1:%.2f"), mesma doutrina de TargetRiskReward acima.
  rr_bruto_exibir: string | null;
  rr_liquido_exibir: string | null;
  // Spec genesis-v6-10-implementacao (Fase 9, item 9.2, doc §9.2): mesmo contrato de
  // ExecutionCandidateSetup acima.
  rr_liquido_combinado: number | null;
  rr_liquido_combinado_exibir: string | null;
  rr_liquido_combinado_abaixo_do_minimo: boolean;
  parciais_alvo: Record<string, number>;
  rr_aviso: string | null;
  rr_minimo_referencia: number | null;
  rr_abaixo_do_minimo: boolean;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.10, doc §16): três linhas
  // SEMPRE distintas — capital-base, margem comprometida nesta posição, e a segunda como % da
  // primeira. Diferentes de risco_usd_estimado/risco_pct_capital_base (acima), que medem RISCO se
  // o stop for atingido, não margem travada.
  capital_base_usd: number | null;
  margem_comprometida_usd: number | null;
  margem_comprometida_pct_capital: number | null;
  // V6.5 (G02): substituem 'invalidacao' (string, número cru embutido) — direção + nível numéricos.
  // Invalidação DA OPERAÇÃO — a âncora estrutural que, se rompida, nega a entrada em si.
  invalidacao_direcao: 'acima' | 'abaixo' | null;
  invalidacao_nivel: number | null;
  // V6.9 correção técnica (item 13, backend); spec genesis-v6-10-implementacao (Fase 6, item 6.6,
  // doc §6.6): já existiam no backend (ExecucaoService.php), zero ocorrências no frontend até esta
  // fase. Invalidação DA ESTRUTURA — a estrutura que sustenta a leitura se quebra (contexto, não
  // decide a operação sozinha). Invalidação DA TESE — a tendência anterior é retomada. Cada uma só
  // aparece quando existe um nível real e justificável do mesmo catálogo; ausência é null, nunca
  // "indisponível" na tela.
  invalidacao_estrutura_direcao: 'acima' | 'abaixo' | null;
  invalidacao_estrutura_nivel: number | null;
  invalidacao_tese_direcao: 'acima' | 'abaixo' | null;
  invalidacao_tese_nivel: number | null;
  zona_de: number | null;
  zona_ate: number | null;
  fonte: string | null;
  descricao: string | null;
  custos_bps: Record<string, number>;
  entrada_ts: string | null;
  // V6.5 (G15): 4 fatores de LOCALIZAÇÃO de QualidadeEntradaService — null quando não computado
  // (hoje, sempre null no Plano B: ver ExecucaoService.php).
  // item 13.6: UNAVAILABLE — os 4 fatores aparecem sempre agora, nunca somem por falta de insumo.
  qualidade_entrada: { fator: string; avaliacao: 'BOM' | 'MEDIO' | 'RUIM' | 'UNAVAILABLE'; detalhe: string }[] | null;
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
  liquidacao_classificacao: 'LIQ_ANTES_DO_STOP' | 'LIQ_FOLGA_CURTA' | null;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 8/9/11, doc §13/§16): cada plano
  // (A e B) ganha sua PRÓPRIA recomendação — antes só existia uma, no nível de
  // ExecutionPipelineResult (Plano A implicitamente). item 11.9: a tela lê estes campos do
  // planoAtivo, não mais de execution.recommended/motivo/alvo_que_atende.
  recommended: boolean;
  reason_code: string | null;
  motivo: string | null;
  alvo_que_atende: string | null;
  // null no Plano B hoje (PlanAMicroanalysisService só roda pro Plano A, ver ExecucaoService).
  microanalise: PlanMicroanalysis | null;
  target_details: TargetDetails;
  rr_por_alvo: RrPorAlvo;
  // PriceNormalizer (backend, item 8.6) — tick real do contrato usado pra arredondar todo preço
  // deste plano; null quando o símbolo não tem filtro conhecido (degrada pra 8 casas no backend).
  tick_size: number | null;
  tick_decimals: number | null;
  maintenance_margin: MaintenanceMargin | null;
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
  // A8 (V6.9): "TP2"/"TP3" quando um alvo posterior já atende o R/R mínimo mesmo com o plano não
  // recomendado (TP1 abaixo do mínimo) — null quando nenhum atende ou o plano é recomendado.
  alvo_que_atende: string | null;
  candidate_setup: ExecutionCandidateSetup | null;
  executable_setup: ExecutionCandidateSetup | null;
  planoB: ExecutionPlanB | null;
  // V6.5 (E08): 1 ou 2 itens, mesmo formato completo pros dois planos.
  planos: ExecutionPlanoSetup[];
  // Spec genesis-v6-10-implementacao (Fase 5, item 5.1/5.3, doc §5.3): qual plano (A/B) a IA
  // declarou como primário — o que vem pré-selecionado na tela e alimenta o cabeçalho. O outro
  // plano continua existindo e clicável. 'A' é o valor de uma decisão antiga/cacheada sem o campo
  // (mesmo fallback aplicado no backend, AnalysisPersistenceService).
  plano_primario: 'A' | 'B';
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

// Spec genesis-v6-10-implementacao (Fase 3, item 3.5) — substitui o breakdown de
// `ScoreFinalizer::finalize()` (backend, Fase 9 item 9.1, V6.9). A Etapa 2 separada e o conceito
// de "modulador"/penalidades pós-IA deixaram de existir (decisão do Felipe via AskUserQuestion:
// fundir numa chamada só) — o score final agora é puramente aritmético sobre a classificação que
// a IA deu a cada uma das 4 famílias (`ScoreFromFamilies::calcular()`), persistido sem recálculo
// em `Analise::score_breakdown`. Nenhum componente consome este campo hoje (ver `score_basis`/
// `derivatives_context` em `AnalysisResult.tsx`, que cobrem a UI atual) — mantido em sincronia com
// o contrato real da API para quem vier a exibi-lo.
export interface ScoreFamilyBreakdown {
  nivel: 'FORTE_A_FAVOR' | 'A_FAVOR' | 'NEUTRO' | 'CONTRA' | 'FORTE_CONTRA' | 'INDISPONIVEL';
  peso: number;
  fator?: number;
  contribuicao: number | null;
}

export interface ScoreBreakdown {
  score: number | null;
  cobertura: number;
  breakdown: {
    estrutura: ScoreFamilyBreakdown;
    order_flow: ScoreFamilyBreakdown;
    derivativos: ScoreFamilyBreakdown;
    momentum: ScoreFamilyBreakdown;
  };
}

// DataFreshnessGate::avaliar() (backend, Fase 3 item 3.4) — idade/sequência/conteúdo real por
// fonte, persistido em Analise::source_freshness.
export interface SourceFreshnessItem {
  timestamp_ms: number | null;
  age_ms: number | null;
  age_limit_ms: number | null;
  sequence_ok: boolean;
  content_ok: boolean;
  status: 'AVAILABLE' | 'STALE' | 'SEQUENCE_GAP' | 'EMPTY_OR_INVALID';
}

export interface SourceFreshness {
  as_of_ms: number;
  source: string;
  quality: 'ALTA' | 'MEDIA' | 'BAIXA';
  coverage_ratio: number;
  usable_sources: string[];
  items: Record<string, SourceFreshnessItem>;
}

// target_selection.candidate_ids que a IA escolheu (GenesisDecisionSchema, backend) — os mesmos
// IDs que geraram execution.planos[*].target_details.
export interface TargetSelectionRationale {
  candidate_id: string;
  reason: string;
}

export interface TargetSelection {
  candidate_ids: string[];
  rationales: TargetSelectionRationale[];
}

export interface AnalysisTimestamps {
  market_price_observed_at: string | null;
  indicators_observed_at: string | null;
  last_closed_candle_at: string | null;
  candle_state: string | null;
  // Fase 9 (item 9.5): snapshot que decidiu (horário/preço/candle de abertura da série real).
  snapshot_horario: string | null;
  snapshot_preco: number | null;
  snapshot_candle_abertura_ts: number | null;
}

// V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.14, doc §18):
// AnalysisPublicResponseBuilder::dataTraceability() — junta cobertura de decisão (mesma métrica
// que a antiga `nota_cobertura`) com o frescor real por fonte (source_freshness, DataFreshnessGate).
export interface DataTraceability {
  decision_coverage_percent: number | null;
  fresh_sources: number | null;
  expected_sources: number | null;
  freshness_coverage_percent: number | null;
  as_of_ms: number | null;
}

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
  // E1 (V6.9): contradições objetivas entre a direção e DMI/ADX/Supertrend/figura/tempos maiores —
  // [] quando nenhuma foi encontrada (DirectionCoherenceGate, backend).
  contradicoes: DirectionContradiction[];
  visual_observations: VisualObservations;
  coverage_percent: number | null;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.14, doc §18): substitui
  // `nota_cobertura` (G5, V6.9, escalar solto) — junta a mesma cobertura de decisão com o frescor
  // real por fonte (source_freshness) num único bloco pro rodapé.
  data_traceability: DataTraceability | null;
  snapshot_observed_at: string | null;
  market_price: number | null;
  // F9 (V6.9): variação do PRÓPRIO candle analisado (fechamento vs fechamento anterior real) —
  // diferente do ticker de 24h.
  candle_change_pct: number | null;
  display_only: {
    long_short_ratio: unknown;
  };
  informative_context: InformativeContext;
  execution: ExecutionPipelineResult | null;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.2, doc §16): já
  // persistidos desde a Fase 9 (item 9.5), só agora expostos no contrato público.
  score_breakdown: ScoreBreakdown | null;
  source_freshness: SourceFreshness | null;
  target_candidates: TargetCandidate[];
  target_selection: TargetSelection | null;
  timestamps: AnalysisTimestamps;
  created_at: string;
}

export interface GraphicalAnalysisErrorPayload {
  error?: string;
  reason_code?: string;
}
