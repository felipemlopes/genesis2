
import { Type } from "@google/genai";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
import { TradeSetup, TradeDirection, ChartMetadata } from "../types";
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
// ETAPA 1: OCR via Laravel backend
export const scanChartMetadata = async (file: File): Promise<ChartMetadata> => {
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('genesis_token');
  const res = await fetch(`${API_BASE}/v1/scangraph`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) throw new Error('Falha no scan do grafico');
  const data = await res.json();

  const content = data.content || '';
  let parsed: any;
  try {
    parsed = typeof content === 'string' ? JSON.parse(content) : content;
  } catch {
    parsed = {};
  }

  const symbolClean = (parsed.symbol || parsed.exchange || '')
    ? (parsed.symbol || '').toUpperCase().replace('/', '').replace('PERP', '').replace('.P', '').trim()
    : '';

  return {
    pair: symbolClean,
    exchange: parsed.exchange || 'Binance',
    timeframe: parsed.timeframe || '4h',
    symbol: symbolClean,
    price: parsed.price,
    detectedIndicators: parsed.detectedIndicators || [],
    detectedEMAs: parsed.detectedEMAs || [],
  } as ChartMetadata;
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

  const formData = new FormData();
  formData.append('image', file);
  formData.append('symbol', userPair);
  formData.append('timeframe', userTimeframe);
  formData.append('leverage', String(userLeverage));
  if (entryValue !== '' && entryValue !== 0) {
    formData.append('entry_value', String(entryValue));
  }

  const token = localStorage.getItem('genesis_token');
  const res = await fetch(`${API_BASE}/v1/analyze`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao processar analise tecnica');
  }

  const result = await res.json();
  return result as TradeSetup;
};
