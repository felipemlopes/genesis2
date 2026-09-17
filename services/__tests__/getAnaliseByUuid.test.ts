/**
 * Genesis Brain V2 (Fase 7.2, item 22.6, Requisito 25.1, Fonte §70): `getAnaliseByUuid()` —
 * restaura uma análise pelo UUID direto do servidor (GET /v1/analises/{uuid}), a peça que faz
 * /dashboard/genesis/analise/:uuid funcionar sem depender só de state React. Mesmo ambiente Node
 * sem `localStorage` nativo de `analysisIdempotency.test.ts` — polyfill mínimo em memória.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAnaliseByUuid } from '../api';

function criarLocalStorageEmMemoria(): Storage {
  const dados = new Map<string, string>();
  return {
    getItem: (chave: string) => (dados.has(chave) ? dados.get(chave)! : null),
    setItem: (chave: string, valor: string) => {
      dados.set(chave, valor);
    },
    removeItem: (chave: string) => {
      dados.delete(chave);
    },
    clear: () => dados.clear(),
    key: (i: number) => Array.from(dados.keys())[i] ?? null,
    get length() {
      return dados.size;
    },
  } as Storage;
}

describe('getAnaliseByUuid', () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    (global as any).localStorage = criarLocalStorageEmMemoria();
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it('busca GET /v1/analises/{uuid} com o token de autenticação e devolve o corpo bruto', async () => {
    const corpoFake = { analysis_id: 'uuid-123', status: 'COMPLETED', pair: 'BTCUSDT' };
    localStorage.setItem('genesis_token', 'token-de-teste');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(corpoFake),
    });
    global.fetch = fetchMock as any;

    const resultado = await getAnaliseByUuid('uuid-123');

    expect(resultado).toEqual(corpoFake);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/analises/uuid-123');
    expect(options.headers.Authorization).toBe('Bearer token-de-teste');
  });

  it('devolve null (nunca lança) quando a resposta não é ok — 404, análise de outro dono ou inexistente', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    global.fetch = fetchMock as any;

    const resultado = await getAnaliseByUuid('uuid-que-nao-existe');

    expect(resultado).toBeNull();
  });

  it('codifica o uuid na URL — nunca interpola um valor não sanitizado direto no path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    global.fetch = fetchMock as any;

    await getAnaliseByUuid('uuid com espaço');

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(encodeURIComponent('uuid com espaço'));
  });
});
