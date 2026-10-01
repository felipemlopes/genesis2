import { createHash } from 'crypto';

/**
 * V6.12 (§12.6): Content-Security-Policy do front, injetada no index.html só no build (o `vite` de
 * desenvolvimento injeta scripts inline próprios, que uma CSP estrita quebraria). Enquanto o token de
 * sessão fica em localStorage, a CSP é o que limita um XSS: só scripts deste site (+ o CDN do
 * Tailwind e o script inline de config, pelo hash) e conexões só para os domínios que o código já
 * usa — nunca para um domínio qualquer.
 *
 * `frame-ancestors` não vale em <meta> (o navegador ignora); a proteção contra iframe precisa ir
 * como cabeçalho HTTP no servidor web (X-Frame-Options: DENY ou CSP frame-ancestors 'none').
 */

// Domínios que o código do front chama hoje (levantamento de 30/09/2026). Acrescentar aqui antes de
// usar um domínio novo — senão o navegador bloqueia.
const CONEXOES = [
  'https://genesislabs.com.br',
  'https://*.genesislabs.com.br',
  'https://fapi.binance.com',
  'wss://fstream.binance.com',
  'https://api.binance.com',
  'https://api.bybit.com',
  'https://www.okx.com',
  'https://api.bitget.com',
  'https://www.deribit.com',
  'https://query1.finance.yahoo.com',
  'https://api.coingecko.com',
  'https://api.alternative.me',
  'https://min-api.cryptocompare.com',
  'https://economia.awesomeapi.com.br',
  'https://corsproxy.io',
  'https://api.allorigins.win',
  'https://api.codetabs.com',
];

function origem(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Hash sha256 (base64) de cada <script> inline sem `src` — permitidos um a um, nunca 'unsafe-inline'. */
function hashesDosScriptsInline(html: string): string[] {
  const hashes: string[] = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (m[1].trim() === '') continue;
    hashes.push(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  }
  return hashes;
}

export function montarCsp(html: string, env: Record<string, string | undefined>): string {
  const daApi = [env.VITE_API_URL, env.VITE_AUTH_API_URL, env.VITE_V1_URL].map(origem).filter((o): o is string => o !== null);
  const conexoes = Array.from(new Set(["'self'", ...daApi, ...CONEXOES]));

  return [
    "default-src 'self'",
    ["script-src 'self'", 'https://cdn.tailwindcss.com', ...hashesDosScriptsInline(html)].join(' '),
    // O Tailwind do CDN gera o CSS em tempo de execução (<style> injetado) — estilo inline é o custo.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    `connect-src ${conexoes.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

export function injetarCsp(html: string, env: Record<string, string | undefined>): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${montarCsp(html, env)}" />`;
  return html.replace(/<meta charset="UTF-8" \/>/, (m) => `${m}\n    ${meta}`);
}
