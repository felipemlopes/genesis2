/**
 * normalizarPar — Normaliza pares de criptomoedas para formato padrão USDT
 * 
 * Remove caracteres especiais (.P, PERP, /), prefixo 1000,
 * e sufixos de stablecoin (USDT, USDC, BUSD, USD, DAI, TUSD),
 * adicionando "USDT" ao símbolo base limpo.
 * 
 * Exemplos:
 *   BTCUSDC    → BTCUSDT
 *   SOLUSD.P   → SOLUSDT
 *   1000PEPEUSDT → PEPEUSDT
 *   BTCUSDT    → BTCUSDT (sem modificação)
 *   ETHBUSD    → ETHUSDT
 *   BTCUSDPERP → BTCUSDT
 */
export function normalizarPar(rawPair: string): string {
  // Uppercase and trim
  let clean = rawPair.toUpperCase().trim();

  // Remove special characters: .P, PERP, /
  clean = clean.replace(/\.P/g, '');
  clean = clean.replace(/PERP/g, '');
  clean = clean.replace(/\//g, '');

  // Remove prefix 1000 (e.g., 1000PEPEUSDT → PEPEUSDT)
  if (clean.startsWith('1000')) {
    clean = clean.slice(4);
  }

  // Remove stablecoin suffixes in order (longest first to avoid partial matches)
  // Order: USDT, USDC, BUSD, TUSD, DAI, USD (USD last because it's a substring of others)
  const stableSuffixes = ['USDT', 'USDC', 'BUSD', 'TUSD', 'DAI', 'USD'];
  for (const suffix of stableSuffixes) {
    if (clean.endsWith(suffix)) {
      clean = clean.slice(0, -suffix.length);
      break;
    }
  }

  // If base symbol is empty after cleanup, return original uppercased without specials
  if (!clean) {
    return rawPair.toUpperCase().replace(/\.P/g, '').replace(/PERP/g, '').replace(/\//g, '').trim();
  }

  // Add USDT to the clean base symbol
  return clean + 'USDT';
}
