/**
 * V6.12 (§12.6): único lugar do front que lê, grava ou apaga o token de sessão. O token ainda fica
 * em `localStorage` (qualquer XSS o lê — por isso a CSP no index.html); a migração para cookie
 * HttpOnly (decisão 6 do PO) passa a ser uma mudança só aqui.
 */
const CHAVE = 'genesis_token';

export function lerToken(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function gravarToken(token: string): void {
  localStorage.setItem(CHAVE, token);
}

export function apagarToken(): void {
  localStorage.removeItem(CHAVE);
}
