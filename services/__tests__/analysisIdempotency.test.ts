/**
 * Unit Tests — analysisIdempotency (CODE-P0-19, spec genesis-v6-8-correcao-tecnica)
 *
 * O ambiente de teste roda em Node ('environment: node' no vitest.config.ts), sem
 * `sessionStorage` nativo (é uma API de navegador). Um polyfill mínimo em memória é instalado no
 * `beforeEach`/removido no `afterEach` — é exatamente o mesmo contrato (getItem/setItem/
 * removeItem) que o módulo usa, e o teste de "sessionStorage indisponível" remove esse polyfill de
 * propósito para provar que o módulo não lança mesmo sem storage nenhum.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encerrarChaveIdempotencia, hashDaImagem, obterChaveIdempotencia, type SubmissaoAnalise } from '../analysisIdempotency';

function criarSessionStorageEmMemoria(): Storage {
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

const submissaoBase: SubmissaoAnalise = {
  symbol: 'BTCUSDT',
  timeframe: '1d',
  alavancagem: 10,
  imagemHash: 'hash-fixo-de-teste',
};

describe('obterChaveIdempotencia / encerrarChaveIdempotencia', () => {
  let storageOriginal: Storage | undefined;

  beforeEach(() => {
    storageOriginal = (globalThis as any).sessionStorage;
    (globalThis as any).sessionStorage = criarSessionStorageEmMemoria();
  });

  afterEach(() => {
    (globalThis as any).sessionStorage = storageOriginal;
  });

  it('duas chamadas com a mesma submissão devolvem a mesma chave', () => {
    const chave1 = obterChaveIdempotencia(submissaoBase);
    const chave2 = obterChaveIdempotencia({ ...submissaoBase });
    expect(chave2).toBe(chave1);
  });

  it('submissão com timeframe diferente devolve chave diferente', () => {
    const chave1 = obterChaveIdempotencia(submissaoBase);
    const chave2 = obterChaveIdempotencia({ ...submissaoBase, timeframe: '4h' });
    expect(chave2).not.toBe(chave1);
  });

  it('submissão com símbolo diferente devolve chave diferente', () => {
    const chave1 = obterChaveIdempotencia(submissaoBase);
    const chave2 = obterChaveIdempotencia({ ...submissaoBase, symbol: 'ETHUSDT' });
    expect(chave2).not.toBe(chave1);
  });

  it('submissão com hash de imagem diferente devolve chave diferente', () => {
    const chave1 = obterChaveIdempotencia(submissaoBase);
    const chave2 = obterChaveIdempotencia({ ...submissaoBase, imagemHash: 'outro-hash' });
    expect(chave2).not.toBe(chave1);
  });

  it('após encerrarChaveIdempotencia, a próxima chamada gera chave nova', () => {
    const chave1 = obterChaveIdempotencia(submissaoBase);
    encerrarChaveIdempotencia(submissaoBase);
    const chave2 = obterChaveIdempotencia(submissaoBase);
    expect(chave2).not.toBe(chave1);
  });

  it('chave expira após a janela de validade (30min) e uma nova é gerada', () => {
    const agora = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(agora);
    const chave1 = obterChaveIdempotencia(submissaoBase);

    spy.mockReturnValue(agora + 31 * 60 * 1000);
    const chave2 = obterChaveIdempotencia(submissaoBase);

    expect(chave2).not.toBe(chave1);
    spy.mockRestore();
  });

  it('com sessionStorage indisponível (lança em getItem/setItem), ainda devolve uma chave válida', () => {
    (globalThis as any).sessionStorage = {
      getItem: () => {
        throw new Error('sessionStorage indisponível');
      },
      setItem: () => {
        throw new Error('sessionStorage indisponível');
      },
      removeItem: () => {
        throw new Error('sessionStorage indisponível');
      },
    };

    const chave = obterChaveIdempotencia(submissaoBase);
    expect(typeof chave).toBe('string');
    expect(chave.length).toBeGreaterThan(0);

    // Não deve lançar mesmo sem storage nenhum.
    expect(() => encerrarChaveIdempotencia(submissaoBase)).not.toThrow();
  });

  it('sem sessionStorage definido no ambiente (undefined), ainda devolve uma chave válida', () => {
    delete (globalThis as any).sessionStorage;
    const chave = obterChaveIdempotencia(submissaoBase);
    expect(typeof chave).toBe('string');
    expect(chave.length).toBeGreaterThan(0);
  });
});

describe('hashDaImagem', () => {
  it('mesmo conteúdo produz o mesmo hash', async () => {
    const blob1 = new Blob(['conteudo-identico'], { type: 'image/png' });
    const blob2 = new Blob(['conteudo-identico'], { type: 'image/png' });
    const hash1 = await hashDaImagem(blob1);
    const hash2 = await hashDaImagem(blob2);
    expect(hash1).toBe(hash2);
  });

  it('conteúdo diferente produz hash diferente', async () => {
    const blob1 = new Blob(['conteudo-a'], { type: 'image/png' });
    const blob2 = new Blob(['conteudo-b'], { type: 'image/png' });
    const hash1 = await hashDaImagem(blob1);
    const hash2 = await hashDaImagem(blob2);
    expect(hash1).not.toBe(hash2);
  });
});
