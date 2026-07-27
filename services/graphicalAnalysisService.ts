import type {
  GraphicalAnalysisErrorPayload,
  GraphicalAnalysisResult,
} from '../types/graphicalAnalysis';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export class GraphicalAnalysisApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reasonCode?: string,
  ){
    super(message);
    this.name = 'GraphicalAnalysisApiError';
  }
}

export async function analyzeGraphicalChart(params: {
  image: File;
  symbol: string;
  timeframe: string;
  idempotencyKey: string;
  signal?: AbortSignal;
}): Promise<GraphicalAnalysisResult> {
  const token = localStorage.getItem('genesis_token');
  if (!token) {
    throw new GraphicalAnalysisApiError('Sessão expirada. Entre novamente.', 401);
  }

  const form = new FormData();
  form.append('image', params.image);
  form.append('symbol', params.symbol);
  form.append('timeframe', params.timeframe);
  const response = await fetch(`${API_BASE}/v1/graphical-analysis`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': params.idempotencyKey,
    },
    body: form,
    signal: params.signal,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as GraphicalAnalysisErrorPayload;
    throw new GraphicalAnalysisApiError(
      payload.error || `Falha ao processar análise (HTTP ${response.status}).`,
      response.status,
      payload.reason_code,
    );
  }
  const result = (await response.json()) as GraphicalAnalysisResult;
  if (
    result.status !== 'COMPLETED'
    || !['LONG', 'SHORT'].includes(result.direction)
    || !Number.isInteger(result.score)
    || result.score < 0
    || result.score > 90
    || result.score % 5 !== 0
  ){
    throw new GraphicalAnalysisApiError('O servidor retornou um contrato de análise inválido.', 502, 'INVALID_PUBLIC_CONTRACT');
  }
  return result;
}

// Restauração pós-entrega (2026-07-26): OCR de metadados (symbol/timeframe/exchange/market),
// disparado na seleção do arquivo, antes do clique em Analisar. Endpoint separado do decisor
// único V6.4, não cobra crédito.
export interface ScannedChartMetadata {
  symbol: string;
  timeframe: string;
  exchange: string;
  market: 'SPOT' | 'FUTURES' | null;
  confidence: number;
}

export async function scanChartMetadata(file: File, selectedExchange?: string): Promise<ScannedChartMetadata> {
  const token = localStorage.getItem('genesis_token');
  if (!token) {
    throw new GraphicalAnalysisApiError('Sessão expirada. Entre novamente.', 401);
  }

  const form = new FormData();
  form.append('image', file);
  if (selectedExchange) form.append('exchange', selectedExchange);

  const response = await fetch(`${API_BASE}/v1/scangraph`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as GraphicalAnalysisErrorPayload;
    throw new GraphicalAnalysisApiError(
      payload.error || `Falha no OCR de metadados (HTTP ${response.status}).`,
      response.status,
      payload.reason_code,
    );
  }
  const payload = await response.json();
  const raw = payload.content ?? payload;
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

  return {
    symbol: String(parsed.symbol ?? ''),
    timeframe: String(parsed.timeframe ?? ''),
    exchange: String(parsed.exchange ?? ''),
    market: parsed.market === 'SPOT' || parsed.market === 'FUTURES' ? parsed.market : null,
    confidence: Number(parsed.confidence ?? 0),
  };
}

export function newAnalysisIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ga_${crypto.randomUUID()}`;
  }
  return `ga_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}
