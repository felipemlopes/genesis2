
import { Type } from "@google/genai";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
import { GenesisAnalysisResult, TradeDirection, ChartMetadata, UnifiedChartResult } from "../types";
import { ExchangeData, fetchWithProxy } from "./cryptoApi";
import { normalizarPar } from "./normalizarPar";

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
): Promise<GenesisAnalysisResult> => {
  // R3.2 — Adendo Secao 28: sem defaults silenciosos. Par, timeframe e
  // corretora precisam ter sido resolvidos antes de enviar a analise.
  if (!metadata.pair || !metadata.timeframe || !activeExchange) {
    throw new Error('Metadados obrigatórios ausentes. Refaça a leitura do gráfico.');
  }
  const userPair = metadata.pair;
  const userTimeframe = metadata.timeframe;

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
      return result as GenesisAnalysisResult;
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
    return result as GenesisAnalysisResult;
  }

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Falha ao processar analise tecnica');
  }

  const result = await res.json();
  return result as GenesisAnalysisResult;
};
