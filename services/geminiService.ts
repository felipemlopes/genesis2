
import { Type } from "@google/genai";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
import { GenesisAnalysisResult, TradeDirection, ChartMetadata, UnifiedChartResult, CandidateSetup, ExecutionStatus } from "../types";
import { ExchangeData, fetchWithProxy } from "./cryptoApi";
import { normalizarPar } from "./normalizarPar";
import type { GraphicalAnalysisResult } from "../types/graphicalAnalysis";
import { newAnalysisIdempotencyKey } from "./graphicalAnalysisService";

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
 * unifiedChartAnalysis — Leitura visual unificada.
 * Faz UMA ÚNICA chamada ao backend, retornando tanto metadata (par, exchange, timeframe)
 * quanto dados visuais detalhados (suportes, resistências, trendlines, fibonacci, padrões).
 * Elimina a perda de dados entre leituras separadas.
 */
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

export const unifiedChartAnalysis = async (file: File, selectedExchange?: string): Promise<UnifiedChartResult> => {
  const buildFormData = (withFlashModel = false): FormData => {
    const fd = new FormData();
    fd.append('image', file);
    if (selectedExchange) fd.append('exchange', selectedExchange);
    if (withFlashModel) fd.append('model', 'flash');
    return fd;
  };

  const token = localStorage.getItem('genesis_token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/unified-scan`, {
      method: 'POST',
      headers,
      body: buildFormData(false),
    });
  } catch (networkError) {
    if (isModelOverloadOrTimeout(networkError)) {
      console.warn('[Genesis] Leitura visual: modelo pro indisponível (network error), ativando fallback para gemini-2.0-flash');
      res = await fetch(`${API_BASE}/v1/unified-scan`, {
        method: 'POST',
        headers,
        body: buildFormData(true),
      });
      if (!res.ok) throw new Error('Falha na leitura visual unificada (fallback flash)');
    } else {
      throw networkError;
    }
  }

  if (res!.status === 503) {
    console.warn('[Genesis] Leitura visual: modelo pro retornou 503, ativando fallback para gemini-2.0-flash');
    res = await fetch(`${API_BASE}/v1/unified-scan`, {
      method: 'POST',
      headers,
      body: buildFormData(true),
    });
    if (!res.ok) throw new Error('Falha na leitura visual unificada (fallback flash)');
  }

  if (!res!.ok) {
    const errorBody = await res!.text().catch(() => 'Unable to read response body');
    console.error('[SCAN-DEBUG] ❌ unified-scan failed:', {
      status: res!.status,
      statusText: res!.statusText,
      body: errorBody,
    });
    throw new Error(`Falha na leitura visual unificada (HTTP ${res!.status}: ${errorBody.substring(0, 200)})`);
  }
  const data = await res!.json();

  const content = data.content || '';
  let parsed: any;
  try {
    let cleanContent = typeof content === 'string' ? content.trim() : '';
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    parsed = cleanContent ? JSON.parse(cleanContent) : (typeof content === 'object' ? content : {});
  } catch (e) {
    console.error('[SCAN-DEBUG] Failed to parse unified-scan content:', content, e);
    parsed = {};
  }

  const symbolRaw = (parsed.symbol || '').toUpperCase().replace('/', '').replace('PERP', '').replace('.P', '').trim();
  const symbolClean = symbolRaw ? normalizarPar(parsed.symbol || '') : '';

  return {
    pair: symbolClean,
    exchange: selectedExchange || parsed.exchange || 'Binance',
    timeframe: parsed.timeframe || '4h',
    symbol: symbolClean,
    detectedIndicators: parsed.detectedIndicators || [],
    supports: parsed.supports || [],
    resistances: parsed.resistances || [],
    trendlines: parsed.trendlines || [],
    fibonacci: parsed.fibonacci || [],
    patterns: parsed.patterns || [],
  } as UnifiedChartResult;
};

// R3.2 — Adendo Secao 28: OCR 1 estrito, somente metadados (symbol/timeframe/
// exchange/market/confidence). Nao chama unifiedChartAnalysis — nao le nem
// devolve elementos visuais. Dispara na selecao do arquivo, antes do clique
// em Analisar (Invariante 2.3.1/2.3.2 do Adendo).
export interface StrictChartMetadata {
  pair: string;
  symbol: string;
  timeframe: string;
  exchange: string;
  // R3.2: market não bloqueia o scan — analyzeChart() não usa este campo hoje
  // (o backend hardcoda FUTURES internamente). Continua sendo lido quando o
  // OCR consegue, só deixou de ser obrigatório.
  market: 'SPOT' | 'FUTURES' | null;
  confidence: number;
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
    throw new Error(errData.error || `Falha no OCR de metadados: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const raw = payload.content ?? payload;
  const parsed = typeof raw === 'string'
    ? JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim())
    : raw;

  const symbol = normalizarPar(String(parsed.symbol ?? ''));
  const timeframe = String(parsed.timeframe ?? '').trim().toLowerCase();
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
  tp2: null, tp2_fonte: null,
  tp3: null, tp3_fonte: null,
  alavancagem: null,
  liquidacao: null,
  liquidacao_rotulo: null,
  risco_preco_pct: null,
  risco_margem_pct: null,
  risco_usd_estimado: null,
  nocional_estimado: null,
  tamanho_sugerido_texto: null,
  rr_bruto: null,
  rr_liquido_estimado: null,
  rr_aviso: null,
  custos_bps: {},
  entrada_ts: null,
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
    analysis: {
      direction: v64.direction,
      status: 'CONCLUIDA',
      conviccao_modelo: v64.score,
      leitura_fraca: false,
      reason_code: null,
      justificativa_score: v64.score_description,
      score_justification: v64.score_description,
      narrativa_tecnica: v64.technical_analysis,
      technical_analysis: v64.technical_analysis,
      conviction: v64.score,
      base_conviction: v64.score,
    },
    execution: exec ? {
      status: exec.status as ExecutionStatus,
      executable: exec.executable,
      action: exec.action,
      direction_reference: exec.direction_reference,
      reason_code: exec.reason_code,
      motivo: exec.motivo,
      candidate_setup: (exec.candidate_setup as unknown as CandidateSetup) ?? emptyCandidateSetup,
      executable_setup: exec.executable_setup as unknown as CandidateSetup | null,
      planoB: exec.planoB as unknown as Record<string, unknown> | null,
      zonaInteresse: exec.zonaInteresse,
      avisos: exec.avisos,
      stop_ancora: exec.stop_ancora,
    } : {
      status: 'INDISPONIVEL',
      executable: false,
      action: null,
      direction_reference: v64.direction,
      reason_code: 'V6_4_EXECUCAO_INDISPONIVEL',
      motivo: 'Não foi possível calcular o setup de entrada/stop/TP para esta análise (preço ou ATR indisponível).',
      candidate_setup: emptyCandidateSetup,
      executable_setup: null,
      planoB: null,
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
    score_basis: v64.score_basis as unknown as Record<string, string> | null,
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
  if (userLeverage > 0) fd.append('leverage', String(userLeverage));
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
    throw new Error(errData.error || `Falha ao processar analise tecnica (HTTP ${res.status})`);
  }

  const result = (await res.json()) as GraphicalAnalysisResult;
  return mapGraphicalToLegacy(result);
};
