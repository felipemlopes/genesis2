import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isModelOverloadOrTimeout } from '../services/geminiService';

/**
 * Unit tests for model fallback behavior (Task 3.2)
 * Feature: genesis-moderate-fixes, Property 7: Fallback de modelo em erro
 *
 * Validates: Requisito 4.3
 * IF o modelo gemini-2.5-pro-preview-05-06 retorna erro ou timeout,
 * THEN THE Leitura_Visual SHALL fazer fallback para gemini-2.0-flash com log de aviso
 */

describe('isModelOverloadOrTimeout', () => {
  it('retorna true para status 503', () => {
    expect(isModelOverloadOrTimeout(null, 503)).toBe(true);
  });

  it('retorna false para status 200', () => {
    expect(isModelOverloadOrTimeout(null, 200)).toBe(false);
  });

  it('retorna false para status 500 (não é 503)', () => {
    expect(isModelOverloadOrTimeout(null, 500)).toBe(false);
  });

  it('retorna true para Error com mensagem "timeout"', () => {
    expect(isModelOverloadOrTimeout(new Error('Request timeout'))).toBe(true);
  });

  it('retorna true para Error com mensagem "timed out"', () => {
    expect(isModelOverloadOrTimeout(new Error('Connection timed out'))).toBe(true);
  });

  it('retorna true para Error com mensagem contendo "503"', () => {
    expect(isModelOverloadOrTimeout(new Error('HTTP 503 Service Unavailable'))).toBe(true);
  });

  it('retorna true para TypeError de fetch (network error)', () => {
    expect(isModelOverloadOrTimeout(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('retorna false para Error genérico sem timeout/503', () => {
    expect(isModelOverloadOrTimeout(new Error('Something went wrong'))).toBe(false);
  });

  it('retorna false para null sem status', () => {
    expect(isModelOverloadOrTimeout(null)).toBe(false);
  });

  it('retorna false para undefined', () => {
    expect(isModelOverloadOrTimeout(undefined)).toBe(false);
  });
});

// V6.6 (H01): describe('unifiedChartAnalysis fallback behavior', ...) removido — testava a função
// unifiedChartAnalysis(), que chamava /v1/unified-scan (rota que não existe mais no backend real,
// só no pacote V6.4 arquivado). Nenhum código de produção chamava a função.

describe('analyzeChart fallback behavior', () => {
  let originalFetch: typeof globalThis.fetch;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('faz fallback com model=flash quando /v1/analyze retorna 503', async () => {
    const { analyzeChart } = await import('../services/geminiService');

    let callCount = 0;
    globalThis.fetch = vi.fn(async (_url: any, options: any) => {
      callCount++;
      if (callCount === 1) {
        return new Response(JSON.stringify({ error: 'Service Unavailable' }), { status: 503 });
      }
      // Fallback call
      const body = options.body as FormData;
      expect(body.get('model')).toBe('flash');
      return new Response(JSON.stringify({
        direction: 'long',
        score: 75,
      }), { status: 200 });
    }) as any;

    const mockFile = new File(['test'], 'chart.png', { type: 'image/png' });
    const metadata = { pair: 'BTCUSDT', exchange: 'Binance', timeframe: '4h' } as any;
    const marketData = {} as any;

    const result = await analyzeChart(mockFile, metadata, '1000', marketData, 'Binance', 10, null);

    expect(callCount).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('fallback para gemini-2.0-flash')
    );
    expect(result).toHaveProperty('direction', 'long');
  });

  it('faz fallback com model=flash quando fetch lança timeout error', async () => {
    const { analyzeChart } = await import('../services/geminiService');

    let callCount = 0;
    globalThis.fetch = vi.fn(async (_url: any, options: any) => {
      callCount++;
      if (callCount === 1) {
        throw new TypeError('Failed to fetch');
      }
      const body = options.body as FormData;
      expect(body.get('model')).toBe('flash');
      return new Response(JSON.stringify({
        direction: 'short',
        score: 60,
      }), { status: 200 });
    }) as any;

    const mockFile = new File(['test'], 'chart.png', { type: 'image/png' });
    const metadata = { pair: 'ETHUSDT', exchange: 'Binance', timeframe: '1h' } as any;
    const marketData = {} as any;

    await analyzeChart(mockFile, metadata, '500', marketData, 'Binance', 5, null);

    expect(callCount).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('fallback para gemini-2.0-flash')
    );
  });

  it('não faz fallback para erros não-503/não-timeout no analyze', async () => {
    const { analyzeChart } = await import('../services/geminiService');

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 422 });
    }) as any;

    const mockFile = new File(['test'], 'chart.png', { type: 'image/png' });
    const metadata = { pair: 'BTCUSDT', exchange: 'Binance', timeframe: '4h' } as any;
    const marketData = {} as any;

    await expect(
      analyzeChart(mockFile, metadata, '1000', marketData, 'Binance', 10, null)
    ).rejects.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

/**
 * V6.8 (spec genesis-v6-8-correcao-tecnica, Fase 7, CODE-P1-06/P1-07/P1-08, 14/08/2026) — o
 * adaptador (mapGraphicalToLegacy, privado neste arquivo) descartava VIX/DXY/S&P 500/Fear&Greed/
 * dominância do BTC/+DI-DI/derivatives_context/objects/fibonacci/vrvp mesmo a API sempre devolvendo
 * tudo pronto. `analyzeChart()` é o único ponto de entrada público — testado ponta a ponta (POST
 * mockado já resolvido como COMPLETED, sem poll) em vez de exportar a função privada só pro teste.
 */
describe('analyzeChart preserva evidências antes descartadas (Fase 7)', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('token-teste'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  const respostaCompleta = () => ({
    analysis_id: 'analise-teste-fase7',
    status: 'COMPLETED',
    pair: 'BTCUSDT',
    exchange: 'BINANCE',
    market: 'FUTURES',
    timeframe: '4h',
    direction: 'LONG',
    score: 70,
    score_description: 'desc',
    score_basis: {
      technical_coherence: 'HIGH',
      structure_clarity: 'CLEAR',
      derivatives_confirmation: 'SUPPORTS',
      contradiction_level: 'LOW',
      data_quality: 'HIGH',
    },
    technical_analysis: 'texto',
    derivatives_context: { strength: 'STRENGTHENS', squeeze_risk: 'NONE', summary: 'resumo derivativos' },
    visual_observations: {
      patterns: [],
      objects: [{ type: 'trendline', confidence: 0.9, bbox: { x: 0, y: 0, width: 1, height: 1 } }],
      fibonacci: [{ label: '0.618', visible_price: 100, confidence: 0.8 }],
      vrvp: { presente: true, confianca: 0.7, poc: 99, hvn: [98], lvn: [95] },
    },
    coverage_percent: 80,
    snapshot_observed_at: null,
    market_price: 100,
    display_only: { long_short_ratio: null },
    informative_context: {
      indicators: {
        rsi14: { value: 55, unit: 'index', status: 'AVAILABLE' },
        adx14: { value: 20, unit: 'index', status: 'AVAILABLE' },
        plus_di14: { value: 0, unit: 'index', status: 'AVAILABLE' },
        minus_di14: { value: 22.4, unit: 'index', status: 'AVAILABLE' },
        adx_rising: { value: false, unit: 'boolean', status: 'AVAILABLE' },
        atr14: { value: 1.5, unit: 'USD', status: 'AVAILABLE' },
        ema21: { value: null, unit: 'USD', status: 'UNAVAILABLE' },
        ema50: { value: null, unit: 'USD', status: 'UNAVAILABLE' },
        ema200: { value: null, unit: 'USD', status: 'UNAVAILABLE' },
        wyckoff: { value: null, unit: null, status: 'UNAVAILABLE' },
        session: { value: null, unit: null, status: 'UNAVAILABLE' },
        multi_timeframe: { value: null, unit: null, status: 'UNAVAILABLE' },
      },
      macro: {
        vix: { value: 18.58, unit: 'index', status: 'AVAILABLE' },
        dxy_change_pct: { value: -0.49, unit: '%', status: 'AVAILABLE' },
        sp500_change_pct: { value: -1.16, unit: '%', status: 'AVAILABLE' },
        narrative: { value: null, unit: null, status: 'UNAVAILABLE' },
      },
      sentiment: {
        fear_greed: { value: 26, unit: 'index', status: 'AVAILABLE' },
        btc_dominance: { value: 56.46, unit: '%', status: 'AVAILABLE' },
        narrative: { value: null, unit: null, status: 'UNAVAILABLE' },
      },
    },
    execution: null,
    created_at: '2026-08-14T00:00:00Z',
  });

  it('preserva +DI/-DI/ADX em elevação (zero é valor, não vira N/D)', async () => {
    const { analyzeChart } = await import('../services/geminiService');
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(respostaCompleta()), { status: 200 })) as any;

    const mockFile = new File(['test'], 'chart.png', { type: 'image/png' });
    const metadata = { pair: 'BTCUSDT', exchange: 'Binance', timeframe: '4h' } as any;
    const result = await analyzeChart(mockFile, metadata, '', {} as any, 'Binance', 10, null);

    expect(result.indicadores?.plus_di).toBe(0);
    expect(result.indicadores?.minus_di).toBe(22.4);
    expect(result.indicadores?.adx_subindo).toBe(false);
  });

  it('preserva VIX/DXY/S&P 500 e Fear&Greed/dominância do BTC mesmo sem narrativa', async () => {
    const { analyzeChart } = await import('../services/geminiService');
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(respostaCompleta()), { status: 200 })) as any;

    const mockFile = new File(['test'], 'chart.png', { type: 'image/png' });
    const metadata = { pair: 'BTCUSDT', exchange: 'Binance', timeframe: '4h' } as any;
    const result = await analyzeChart(mockFile, metadata, '', {} as any, 'Binance', 10, null);

    const ctx = result.contexto_informativo as any;
    expect(ctx.macro.vix).toBe(18.58);
    expect(ctx.macro.dxy_change_pct).toBe(-0.49);
    expect(ctx.macro.sp500_change_pct).toBe(-1.16);
    expect(ctx.sentimento.fear_greed).toBe(26);
    expect(ctx.sentimento.btc_dominance).toBe(56.46);
  });

  it('preserva derivatives_context e visual_observations.objects/fibonacci/vrvp', async () => {
    const { analyzeChart } = await import('../services/geminiService');
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(respostaCompleta()), { status: 200 })) as any;

    const mockFile = new File(['test'], 'chart.png', { type: 'image/png' });
    const metadata = { pair: 'BTCUSDT', exchange: 'Binance', timeframe: '4h' } as any;
    const result = await analyzeChart(mockFile, metadata, '', {} as any, 'Binance', 10, null);

    expect(result.derivatives_context?.strength).toBe('STRENGTHENS');
    expect(result.visual_observations?.objects).toHaveLength(1);
    expect(result.visual_observations?.fibonacci).toHaveLength(1);
    expect(result.visual_observations?.vrvp?.poc).toBe(99);
  });
});
