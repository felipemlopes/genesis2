
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
import { GenesisAnalysisResult, TradeDirection, ChartMetadata, CandidateSetup, ExecutionStatus, PlanoSetup } from "../types";
import { ExchangeData, fetchWithProxy } from "./cryptoApi";
import { normalizarPar } from "./normalizarPar";
import type { GraphicalAnalysisResult } from "../types/graphicalAnalysis";

// V6.5 (G10-G11): antes importado de services/graphicalAnalysisService.ts (o cliente duplicado
// deletado neste item) — única exportação daquele arquivo que o cliente real (analyzeChart, abaixo)
// de fato usava. Movida para cá para não perder a dependência real na deleção.
function newAnalysisIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ga_${crypto.randomUUID()}`;
  }
  return `ga_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

/* INIT: API Key injection */

// --- GOVERNANCE LAYER CACHE ---
let macroGovernanceCache = {
  date: '',
  content: ''
};

// Isolated cache per asset for sentiment
let sentimentCache: Record<string, any> = {};

const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// ETAPA 1: O "OLHO" (Processamento Visual / OCR)
// Modelo: gemini-3.1-pro-preview (Alta precisão visual)
// ETAPA 1: Leitura Visual Unificada via Laravel backend

/**
 * Verifica se um erro é 503 ou timeout, indicando necessidade de fallback para modelo flash.
 */
export function isModelOverloadOrTimeout(error: unknown, status?: number): boolean {
  if (status === 503) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('503')) return true;
  }
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  return false;
}

// V6.6 (H01): unifiedChartAnalysis() removida — chamava /v1/unified-scan, rota que não existe mais
// no backend (só o pacote V6.4 arquivado ainda tinha essa rota), e o fallback pra gemini-2.0-flash
// contrariava a regra de modelo único (DET-2 do PO). Nenhum código de produção chamava a função —
// só testes a exercitavam contra a rota morta (removidos junto, ver __tests__/geminiService.test.ts
// e services/__tests__/integration.e2e.test.ts).

// R3.2 — Adendo Secao 28: OCR 1 estrito, somente metadados (symbol/timeframe/
// exchange/market/confidence). Nao chama unifiedChartAnalysis — nao le nem
// devolve elementos visuais. Dispara na selecao do arquivo, antes do clique
// em Analisar (Invariante 2.3.1/2.3.2 do Adendo).
export interface StrictChartMetadata {
  pair: string;
  symbol: string;
  timeframe: string;
  exchange: string;
  // V6.5 (D01): 'market' agora bloqueia o scan no backend (ChartMetadataScanService exige FUTURES) —
  // um gráfico SPOT ou não identificado nunca chega a devolver metadados aqui, cai no catch abaixo como
  // ChartMetadataBlockedError. Este campo nunca mais chega como 'SPOT' ou null quando o scan tem sucesso.
  market: 'SPOT' | 'FUTURES' | null;
  confidence: number;
}

// V6.5 (D01): erro distinguível do genérico "falha no OCR" — sinaliza que o próprio backend recusou
// o gráfico por não ser FUTURES (SPOT detectado ou mercado não identificado com segurança), pra a tela
// bloquear o clique em "Analisar" e não gastar crédito numa análise que já se sabe que vai falhar.
export class ChartMetadataBlockedError extends Error {
  constructor(message: string, public readonly blockedReason: string) {
    super(message);
    this.name = 'ChartMetadataBlockedError';
  }
}

export const scanChartMetadata = async (file: File, selectedExchange?: string): Promise<StrictChartMetadata> => {
  const formData = new FormData();
  formData.append('image', file);
  if (selectedExchange) formData.append('exchange', selectedExchange);

  const token = localStorage.getItem('genesis_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${API_BASE}/v1/scangraph`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    if (errData.blocked_reason === 'MARKET_NOT_FUTURES') {
      throw new ChartMetadataBlockedError(
        errData.error || 'Este gráfico não é de mercado FUTURES.',
        errData.blocked_reason
      );
    }
    throw new Error(errData.error || `Falha no OCR de metadados: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const raw = payload.content ?? payload;
  const parsed = typeof raw === 'string'
    ? JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim())
    : raw;

  const symbol = normalizarPar(String(parsed.symbol ?? ''));
  // V6.6 (D01): o backend é a autoridade de normalização de timeframe agora (TimeframeNormalizer),
  // capaz de distinguir "1M" (mês, pt-BR) de "1m" (minuto) pelo rótulo. .toLowerCase() aqui destruía
  // essa distinção antes mesmo do valor chegar à API — repassa o valor lido, sem transformar.
  const timeframe = String(parsed.timeframe ?? '').trim();
  const exchange = String(parsed.exchange ?? '').trim().toUpperCase();
  const market = String(parsed.market ?? '').trim().toUpperCase();
  const confidence = Number(parsed.confidence ?? 0);

  if (!symbol || !timeframe || !exchange) {
    throw new Error('Par, timeframe ou corretora não foram identificados com segurança.');
  }

  if (!Number.isFinite(confidence) || confidence < 0.85) {
    throw new Error('A confiança do OCR de metadados ficou abaixo do mínimo.');
  }

  return {
    pair: symbol,
    symbol,
    timeframe,
    exchange,
    market: (market === 'SPOT' || market === 'FUTURES') ? market : null,
    confidence,
  };
};
// Placeholder visual (2026-07-27): o motor V6.4 não calcula entrada/stop/TP (só direção,
// score e contexto informativo) — nenhum valor é calculado no frontend, é literalmente um
// objeto vazio (todos os campos null) só para a Zona de Entrada/Metas/Stop aparecerem na
// tela com "—"/"N/A". Os dados reais entram depois, quando o backend voltar a mandá-los.
const emptyCandidateSetup: CandidateSetup = {
  entrada: null,
  stop: null,
  tp1: null, tp1_fonte: null,
  tp2: null, tp2_fonte: null, tp2_motivo: null,
  tp3: null, tp3_fonte: null, tp3_motivo: null,
  alavancagem: null,
  alavancagem_info: null,
  liquidacao: null,
  liquidacao_rotulo: null,
  risco_preco_pct: null,
  risco_margem_pct: null,
  risco_usd_estimado: null,
  nocional_estimado: null,
  quantidade_base_estimada: null,
  ativo_base: null,
  rr_bruto: null,
  rr_liquido_estimado: null,
  rr_aviso: null,
  rr_minimo_referencia: null,
  rr_abaixo_do_minimo: false,
  custos_bps: {},
  entrada_ts: null,
  qualidade_entrada: null,
  // V6.7 (A-13): placeholder também precisa dos campos novos do contrato do stop.
  stop_status: 'STOP_UNAVAILABLE',
  stop_ancora: null,
  stop_buffer: null,
  stop_motivo: null,
  // V6.7 (B-20): idem, placeholder também precisa dos campos novos de verificação de liquidação.
  verificacao: null,
  verificacao_motivo: null,
};

// Adaptador (2026-07-27): traduz a resposta do motor V6.4 (rota /v1/graphical-analysis) para o
// contrato antigo que AnalysisResult.tsx espera. Restauração pós-entrega (mesmo dia): quando o
// backend manda v64.execution (pipeline restaurado — ExecucaoService/MotorExecucaoService, calculado
// DEPOIS da decisão do Gemini, sem alterar direção/score), usa os dados reais; senão cai no
// placeholder vazio (motor sem dado disponível para essa análise específica).
const mapGraphicalToLegacy = (v64: GraphicalAnalysisResult): GenesisAnalysisResult => {
  const ctx = v64.informative_context;
  const macroNarrative = ctx?.macro?.narrative?.value ?? null;
  const sentimentNarrative = ctx?.sentiment?.narrative?.value ?? null;
  const exec = v64.execution;

  return {
    analysis_id: v64.analysis_id,
    pair: v64.pair,
    analysis_version: v64.analysis_version,
    market_price: v64.market_price,
    snapshot_observed_at: v64.snapshot_observed_at,
    analysis: {
      direction: v64.direction,
      status: 'CONCLUIDA',
      conviccao_modelo: v64.score,
      reason_code: null,
      justificativa_score: v64.score_description,
      score_justification: v64.score_description,
      narrativa_tecnica: v64.technical_analysis,
      technical_analysis: v64.technical_analysis,
      conviction: v64.score,
      coverage: v64.coverage_percent ?? undefined,
      // V6.5 (G14): antes leitura_fraca vinha chumbado em false e base_conviction reintroduzia o
      // score final com outro nome — nenhum dos dois refletia dado real. cobertura_baixa é derivado
      // de coverage_percent de verdade.
      // V6.7 (H-47): limiar recalibrado de 70 para 75 no MESMO commit que mudou o denominador de
      // coverage_percent (EvidenceManifestBuilder.php) de "tudo menos DISPLAY_ONLY" (66 itens, ainda
      // contava os 20 CONTEXT) para "só DECISION" (46 itens) — o documento descreve que isso sobe a
      // cobertura estruturalmente 4-6 pontos pra qualquer análise (itens CONTEXT tendem a faltar mais
      // que os DECISION: fontes macro/sentimento/derivativos secundários). 75 é o meio da faixa
      // estimada — **valor provisório, precisa de confirmação com cobertura real de análises pós-
      // correção antes do gate final (seção 25)**, não uma medição própria (não rodei análise real
      // nesta sessão).
      cobertura_baixa: v64.coverage_percent != null ? v64.coverage_percent < 75 : undefined,
    },
    execution: exec ? {
      status: exec.status as ExecutionStatus,
      executable: exec.executable,
      // V6.5 (E02): campo novo do backend — default true (equivalente ao comportamento antigo, onde
      // executable já implicava recomendado) só quando a resposta vier de uma decisão cacheada antes
      // deste campo existir.
      recommended: exec.recommended ?? exec.executable,
      action: exec.action,
      direction_reference: exec.direction_reference,
      reason_code: exec.reason_code,
      motivo: exec.motivo,
      // V6.7 (G-44): tipos unificados com o contrato real do backend (types/graphicalAnalysis.ts) —
      // ExecutionCandidateSetup/ExecutionPlanoSetup/ExecutionPlanB são estruturalmente compatíveis com
      // CandidateSetup/PlanoSetup/ExecutionPlanB (types.ts) depois da correção, sem precisar de cast.
      candidate_setup: exec.candidate_setup ?? emptyCandidateSetup,
      executable_setup: exec.executable_setup,
      planoB: exec.planoB,
      // V6.5 (E08): campo novo do backend — vazio quando a resposta vier de uma decisão cacheada
      // antes deste campo existir (a tela cai no fallback de candidate_setup/planoB nesse caso).
      planos: exec.planos ?? [],
      zonaInteresse: exec.zonaInteresse,
      avisos: exec.avisos,
      stop_ancora: exec.stop_ancora,
    } : {
      status: 'INDISPONIVEL',
      executable: false,
      recommended: false,
      action: null,
      direction_reference: v64.direction,
      reason_code: 'V6_4_EXECUCAO_INDISPONIVEL',
      motivo: 'Não foi possível calcular o setup de entrada/stop/TP para esta análise (preço ou ATR indisponível).',
      candidate_setup: emptyCandidateSetup,
      executable_setup: null,
      planoB: null,
      planos: [],
      zonaInteresse: null,
      avisos: [],
      stop_ancora: null,
    },
    contexto_informativo: (macroNarrative || sentimentNarrative) ? {
      macro: macroNarrative,
      sentimento: sentimentNarrative,
    } : null,
    ai_meta: {},
    indicadores: {
      rsi: ctx?.indicators?.rsi14?.value ?? null,
      adx: ctx?.indicators?.adx14?.value ?? null,
      atr: ctx?.indicators?.atr14?.value ?? null,
      ema21: ctx?.indicators?.ema21?.value ?? null,
      ema50: ctx?.indicators?.ema50?.value ?? null,
      ema200: ctx?.indicators?.ema200?.value ?? null,
    },
    wyckoff: (ctx?.indicators?.wyckoff?.value as Record<string, unknown> | null) ?? undefined,
    sessao: ctx?.indicators?.session?.value
      ? { nome: ctx.indicators.session.value.name, cor: 'text-white' }
      : undefined,
    multiTimeframe: (ctx?.indicators?.multi_timeframe?.value as { timeframe: string; bias: string }[] | null) ?? [],
    // V6.7 (G-44): ScoreBasis importado do contrato real, sem cast.
    score_basis: v64.score_basis,
    // V6.6 (A04): visual_observations.patterns chegava na resposta e era descartado aqui — nenhum
    // componente da tela renderizava figura, mesmo com o Gemini identificando um padrão claro.
    visual_observations: {
      patterns: v64.visual_observations?.patterns ?? [],
    },
  };
};

// ETAPA 2: Analise completa via Laravel backend (motor V6.4)
export const analyzeChart = async (
  file: File,
  metadata: ChartMetadata,
  equity: string,
  marketData: ExchangeData,
  activeExchange: string,
  userLeverage: number,
  cvdDataParam: { delta: number, priceChangePercent: number } | null,
  entryValue: number | '' = ''
): Promise<GenesisAnalysisResult> => {
  // R3.2 — Adendo Secao 28: sem defaults silenciosos. Par e timeframe
  // precisam ter sido resolvidos antes de enviar a analise.
  if (!metadata.pair || !metadata.timeframe) {
    throw new Error('Metadados obrigatórios ausentes. Refaça a leitura do gráfico.');
  }

  const token = localStorage.getItem('genesis_token');
  if (!token) {
    throw new Error('Sessão expirada. Entre novamente.');
  }

  const fd = new FormData();
  fd.append('image', file);
  fd.append('symbol', metadata.pair);
  fd.append('timeframe', metadata.timeframe);
  // V6.7 (B-18/B-23): antes só enviava quando > 0 — se o estado de alavancagem no app zerasse por
  // qualquer motivo, o campo simplesmente sumia da requisição e o backend caía no default
  // silencioso (0). Agora sempre envia; leverage <= 0 volta como erro de requisição explícito do
  // backend (GraphicalAnalysisRequest::rules()), nunca um 1x aplicado sem avisar.
  fd.append('leverage', String(userLeverage));
  if (equity && Number(equity) > 0) fd.append('equity', equity);

  const res = await fetch(`${API_BASE}/v1/graphical-analysis`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': newAnalysisIdempotencyKey(),
    },
    body: fd,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    // V6.6 (D01): num 422 o Laravel devolve { message, errors }, não { error } — a leitura antiga
    // sempre caía no fallback genérico e o membro nunca descobria qual campo falhou (ex.: timeframe
    // não reconhecido).
    const detalhe =
      errData.error ??
      errData.message ??
      (errData.errors ? Object.values(errData.errors).flat().join(' ') : null);
    throw new Error(detalhe || `Falha ao processar a análise técnica (HTTP ${res.status})`);
  }

  const result = (await res.json()) as GraphicalAnalysisResult;
  return mapGraphicalToLegacy(result);
};
