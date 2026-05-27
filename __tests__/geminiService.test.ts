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

describe('unifiedChartAnalysis fallback behavior', () => {
  let originalFetch: typeof globalThis.fetch;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Mock localStorage
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

  it('faz fallback com model=flash quando backend retorna 503', async () => {
    const { unifiedChartAnalysis } = await import('../services/geminiService');

    let callCount = 0;
    globalThis.fetch = vi.fn(async (_url: any, options: any) => {
      callCount++;
      if (callCount === 1) {
        // First call: simulate 503
        return new Response(JSON.stringify({ error: 'Service Unavailable' }), { status: 503 });
      }
      // Second call (fallback): verify model=flash is in the body and return success
      const body = options.body as FormData;
      expect(body.get('model')).toBe('flash');
      return new Response(JSON.stringify({
        content: JSON.stringify({ symbol: 'BTCUSDT', exchange: 'Binance', timeframe: '4h' })
      }), { status: 200 });
    }) as any;

    const mockFile = new File(['test'], 'chart.png', { type: 'image/png' });
    const result = await unifiedChartAnalysis(mockFile);

    expect(callCount).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('fallback para gemini-2.0-flash')
    );
    expect(result.exchange).toBe('Binance');
  });

  it('faz fallback com model=flash quando fetch lança TypeError (network timeout)', async () => {
    const { unifiedChartAnalysis } = await import('../services/geminiService');

    let callCount = 0;
    globalThis.fetch = vi.fn(async (_url: any, options: any) => {
      callCount++;
      if (callCount === 1) {
        throw new TypeError('Failed to fetch');
      }
      // Fallback call
      const body = options.body as FormData;
      expect(body.get('model')).toBe('flash');
      return new Response(JSON.stringify({
        content: JSON.stringify({ symbol: 'ETHUSDT', exchange: 'Binance', timeframe: '1h' })
      }), { status: 200 });
    }) as any;

    const mockFile = new File(['test'], 'chart.png', { type: 'image/png' });
    await unifiedChartAnalysis(mockFile);

    expect(callCount).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('fallback para gemini-2.0-flash')
    );
  });

  it('não faz fallback para erros não-503/não-timeout', async () => {
    const { unifiedChartAnalysis } = await import('../services/geminiService');

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'Bad Request' }), { status: 400 });
    }) as any;

    const mockFile = new File(['test'], 'chart.png', { type: 'image/png' });

    await expect(unifiedChartAnalysis(mockFile)).rejects.toThrow('Falha na leitura visual unificada');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('retorna resultado normal quando backend responde 200 sem erro', async () => {
    const { unifiedChartAnalysis } = await import('../services/geminiService');

    globalThis.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({
        content: JSON.stringify({ symbol: 'BTCUSDT', exchange: 'Bybit', timeframe: '15m' })
      }), { status: 200 });
    }) as any;

    const mockFile = new File(['test'], 'chart.png', { type: 'image/png' });
    const result = await unifiedChartAnalysis(mockFile);

    expect(result.exchange).toBe('Bybit');
    expect(result.timeframe).toBe('15m');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

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
