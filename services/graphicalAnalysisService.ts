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

export function newAnalysisIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ga_${crypto.randomUUID()}`;
  }
  return `ga_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}
