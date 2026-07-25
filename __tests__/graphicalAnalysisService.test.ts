import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzeGraphicalChart, GraphicalAnalysisApiError } from '../services/graphicalAnalysisService';

const validResponse = {
  analysis_id: '7fc20390-2fdb-4a3a-9fe6-e59434fd9ab0', status: 'COMPLETED',
  pair: 'BTCUSDT', exchange: 'BINANCE', market: 'FUTURES', timeframe: '4h',
  direction: 'LONG', score: 75, score_description: 'Descrição válida.',
  technical_analysis: 'Análise válida.',
  derivatives_context: { strength: 'STRENGTHENS', squeeze_risk: 'NONE', summary: 'Contexto.' },
  visual_observations: { patterns: [], objects: [], fibonacci: [] },
  coverage_percent: 94.2,
  snapshot_observed_at: '2026-07-22T12:00:00Z',
  display_only: { long_short_ratio: null },
  created_at: '2026-07-22T12:00:00Z',
};

describe('graphicalAnalysisService', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('envia uma única chamada com Idempotency-Key e sem dados de execução', async () => {
    localStorage.setItem('genesis_token', 'token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(validResponse), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const file = new File(['image'], 'chart.png', { type: 'image/png' });
    await analyzeGraphicalChart({ image: file, symbol: 'BTCUSDT', timeframe: '4h',idempotencyKey: 'ga_1234567890123456' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect((options?.headers as Record<string,string>)['Idempotency-Key']).toBe('ga_1234567890123456');
    const form = options?.body as FormData;
    expect(form.has('leverage')).toBe(false);
    expect(form.has('entry_value')).toBe(false);
    expect(form.has('equity')).toBe(false);
  });

  it('bloqueia contrato público com score 95', async () => {
    localStorage.setItem('genesis_token', 'token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({...validResponse, score: 95 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const promise = analyzeGraphicalChart({
      image: new File(['image'], 'chart.png', { type: 'image/png' }),
      symbol: 'BTCUSDT', timeframe: '4h', idempotencyKey: 'ga_1234567890123456',
    });
    await expect(promise).rejects.toBeInstanceOf(GraphicalAnalysisApiError);
  });
});
