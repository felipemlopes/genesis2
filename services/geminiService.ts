
import { Type } from "@google/genai";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
import { TradeSetup, TradeDirection, ChartMetadata, UnifiedChartResult } from "../types";
import { ExchangeData } from "./cryptoApi";
import { generateAdvancedContext } from "./advancedAnalytics";
import { fetchDexScreenerContext, fetchFredMacroContext, fetchDefiLlamaContext, fetchAlternativeMeContext, fetchCryptoCompareContext } from "./externalContextService";
import { fetchMarketConsensus } from "./marketConsensusService";
import { getRecentSpoofs } from "./spoofingService";
import { detectMarketPhase } from "./marketPhaseService";
import { evaluateLocationQuality } from "./locationQualityService";
import { evaluateExhaustionRisk } from "./exhaustionRiskService";
import { evaluateFlowConfirmation } from "./flowConfirmationService";
import { buildEntryPlan } from "./entryPlannerService";
import { calculateProbabilityScore } from "./probabilityScoreEngine";
import { buildAnalysisGovernance } from "./analysisGovernor";
import { detectLiquiditySweep, SweepDetectionOutput } from "./liquiditySweepDetector";
import { calculateMaturityPenalty, MaturityOutput } from "./maturityPenalty";
import { analyzeCvdDivergence, CvdAnalysisOutput } from "./cvdDivergenceAnalyzer";
import { validateOcrExtraction } from "./ocrValidationService";
import { buildLiquidityMap, LiquidityMapResult } from "./liquidityMapService";
import { classifyRegime, RegimeClassifierResult } from "./regimeClassifierService";
import { classifyVolatilityRegime, VolatilityRegimeResult } from "./volatilityRegimeService";
import { buildPredictiveEntryPlan, PredictiveEntryPlannerResult } from "./predictiveEntryPlannerService";
import { fetchWithProxy } from "./cryptoApi";
import { normalizarPar } from "./normalizarPar";
import { fetchInstitutionalFlow, InstitutionalFlowData } from "./institutionalDataService";
import { fetchIntermarketCorrelations, IntermarketData } from "./intermarketCorrelationService";
import { runSentimentEngine } from "./sentimentEngine";
import { runQuantitativeEngine } from "./quantitativeEngine";
import { runOnChainEngine } from "./onChainEngine";

export type FinalOperationalContext = {
  structuralBias: "long" | "short";
  currentEntryStatus: "valid" | "weak" | "invalid";
  bestPointAlreadyPassed: boolean;
  marketPhase: "building" | "breakout" | "executing" | "stretched" | "exhausted" | "range" | "neutral";
  finalScore: number;
  nearestDefense?: number;
  nearestAcceptanceZone?: number;
  nextLiquidityZone?: number;
  nextActionableZone?: number;
  nextActionCondition?: string;
  noTradeReason?: string;
};

export type ExecutionContext = {
  marketPhase: ReturnType<typeof detectMarketPhase>;
  locationQuality: ReturnType<typeof evaluateLocationQuality>;
  exhaustionRisk: ReturnType<typeof evaluateExhaustionRisk>;
  flowConfirmation: ReturnType<typeof evaluateFlowConfirmation>;
  entryPlan: ReturnType<typeof buildEntryPlan>;
  probabilityScore: ReturnType<typeof calculateProbabilityScore>;
  analysisGovernance: ReturnType<typeof buildAnalysisGovernance>;
  sweepDetection: SweepDetectionOutput;
  maturityPenalty: MaturityOutput;
  cvdDivergence: CvdAnalysisOutput;
  liquidityMap: LiquidityMapResult;
  predictiveEntryPlan: PredictiveEntryPlannerResult;
  regimeClassifierResult: RegimeClassifierResult;
  volatilityRegimeResult: VolatilityRegimeResult;
  finalOperationalContext?: FinalOperationalContext;
  institutionalFlow?: InstitutionalFlowData;
  intermarketCorrelations?: IntermarketData;
};

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
    price: parsed.price,
    detectedIndicators: parsed.detectedIndicators || [],
    detectedEMAs: parsed.detectedEMAs || [],
    supports: parsed.supports || [],
    resistances: parsed.resistances || [],
    trendlines: parsed.trendlines || [],
    fibonacci: parsed.fibonacci || [],
    patterns: parsed.patterns || [],
  } as UnifiedChartResult;
};

// scanChartMetadata — wrapper que extrai apenas metadata do resultado unificado
// Mantém compatibilidade com código que chama scanChartMetadata diretamente
export const scanChartMetadata = async (file: File): Promise<ChartMetadata> => {
  const unified = await unifiedChartAnalysis(file);
  return unified as ChartMetadata;
};
// ETAPA 2: Analise completa via Laravel backend
export const analyzeChart = async (
  file: File,
  metadata: ChartMetadata,
  equity: string,
  marketData: ExchangeData,
  activeExchange: string,
  userLeverage: number,
  cvdDataParam: { delta: number, priceChangePercent: number } | null,
  entryValue: number | '' = ''
): Promise<TradeSetup> => {
  const userPair = metadata.pair || "BTCUSDT";
  const userTimeframe = metadata.timeframe || "1D";

  const buildFormData = (withFlashModel = false): FormData => {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('symbol', userPair);
    fd.append('timeframe', userTimeframe);
    fd.append('leverage', String(userLeverage));
    fd.append('exchange', activeExchange);
    if (entryValue !== '' && entryValue !== 0) {
      fd.append('entry_value', String(entryValue));
    }
    if (withFlashModel) {
      fd.append('model', 'flash');
    }
    return fd;
  };

  const token = localStorage.getItem('genesis_token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/analyze`, {
      method: 'POST',
      headers,
      body: buildFormData(false),
    });
  } catch (networkError) {
    // Network error (timeout, connection refused) — try fallback with flash model
    if (isModelOverloadOrTimeout(networkError)) {
      console.warn('[Genesis] Análise visual: modelo pro indisponível (network error), ativando fallback para gemini-2.0-flash');
      res = await fetch(`${API_BASE}/v1/analyze`, {
        method: 'POST',
        headers,
        body: buildFormData(true),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao processar analise tecnica (fallback flash)');
      }
      const result = await res.json();
      return result as TradeSetup;
    }
    throw networkError;
  }

  // If response is 503, retry with flash model
  if (res.status === 503) {
    console.warn('[Genesis] Análise visual: modelo pro retornou 503, ativando fallback para gemini-2.0-flash');
    res = await fetch(`${API_BASE}/v1/analyze`, {
      method: 'POST',
      headers,
      body: buildFormData(true),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Falha ao processar analise tecnica (fallback flash)');
    }
    const result = await res.json();
    return result as TradeSetup;
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao processar analise tecnica');
  }

  const result = await res.json();
  return result as TradeSetup;
};
