/**
 * V6.12 (§12.6): token de sessão acessado num lugar só (`services/tokenStorage.ts`) e CSP no build,
 * index.html enquanto o token continua em localStorage.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { lerToken, gravarToken, apagarToken } from '../services/tokenStorage';
import { montarCsp } from '../csp.config';

const raiz = resolve(__dirname, '..');

function arquivosDeCodigo(pasta: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    if (['node_modules', 'dist', '.kilo', '.kiro', 'docs', '.git', '__tests__'].includes(nome)) continue;
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosDeCodigo(caminho));
    else if (/\.(ts|tsx)$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

describe('token de sessão', () => {
  beforeEach(() => {
    // Ambiente de teste é Node: localStorage em memória.
    const dados = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (k: string) => dados.get(k) ?? null,
      setItem: (k: string, v: string) => { dados.set(k, String(v)); },
      removeItem: (k: string) => { dados.delete(k); },
      clear: () => dados.clear(),
    };
  });

  it('grava, lê e apaga', () => {
    expect(lerToken()).toBeNull();
    gravarToken('abc');
    expect(lerToken()).toBe('abc');
    apagarToken();
    expect(lerToken()).toBeNull();
  });

  it('nenhum arquivo além do tokenStorage acessa a chave direto', () => {
    const infratores = arquivosDeCodigo(raiz)
      .filter((f) => !f.endsWith(join('services', 'tokenStorage.ts')))
      .filter((f) => /localStorage\.(getItem|setItem|removeItem)\(\s*['"]genesis_token['"]/.test(readFileSync(f, 'utf-8')));
    expect(infratores).toEqual([]);
  });
});

describe('CSP do build', () => {
  const html = readFileSync(join(raiz, 'index.html'), 'utf-8');
  const env = { VITE_API_URL: 'https://api.genesislabs.com.br/api', VITE_AUTH_API_URL: 'https://auth.exemplo.com.br/api' };
  const csp = montarCsp(html, env);

  it('trava scripts: só o site, o CDN do Tailwind e o script inline pelo hash — nunca unsafe-inline', () => {
    const scripts = csp.split('; ').find((d) => d.startsWith('script-src')) ?? '';
    expect(scripts).toContain("'self'");
    expect(scripts).toContain('https://cdn.tailwindcss.com');
    expect(scripts).toMatch(/'sha256-[A-Za-z0-9+/=]+'/);
    expect(scripts).not.toContain('unsafe-inline');
    expect(scripts).not.toContain('unsafe-eval');
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it('conexões só para a API do Gênesis (das variáveis VITE_*) e os domínios que o código já usa', () => {
    const conexoes = csp.split('; ').find((d) => d.startsWith('connect-src')) ?? '';
    expect(conexoes).toContain('https://api.genesislabs.com.br');
    expect(conexoes).toContain('https://auth.exemplo.com.br');
    expect(conexoes).toContain('https://fapi.binance.com');
    expect(conexoes).not.toMatch(/\s\*(\s|$)/);
  });

  it('o hash acompanha o script inline do index.html', () => {
    const alterado = html.replace('tailwind.config = {', 'tailwind.config = { /* x */');
    expect(montarCsp(alterado, env)).not.toBe(csp);
  });

  it('o vite.config injeta a CSP só no build', () => {
    const vite = readFileSync(join(raiz, 'vite.config.ts'), 'utf-8');
    expect(vite).toContain("apply: 'build', transformIndexHtml: (html: string) => injetarCsp(html, env)");
  });
});
