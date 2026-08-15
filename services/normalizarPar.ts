/**
 * normalizarPar — normaliza a representação de um par para Binance Futures USDT.
 *
 * V6.8 (CODE-P0-18): a versão anterior removia o prefixo "1000" e documentava isso como
 * comportamento desejado. Era o defeito de maior alcance do sistema: 1000PEPEUSDT é um contrato
 * REAL e distinto na Binance Futures, com preço mil vezes o do token. PEPEUSDT não existe naquele
 * mercado. Toda análise de um contrato 1000* saía com snapshot, indicadores, stop, alvos e
 * risco-retorno de um ativo diferente do gráfico enviado.
 *
 * Também corrigido: o prefixo de corretora ("BINANCE:") não era removido, e os sufixos ".P" e
 * "PERP" eram removidos de qualquer posição da string (regex global, não ancorada) em vez de
 * apenas do fim — "PERP" no meio de um símbolo legítimo também seria corrompido.
 *
 * Exemplos:
 *   BINANCE:BTCUSDT.P  → BTCUSDT
 *   SOLUSD.P           → SOLUSDT
 *   BTC/USDC           → BTCUSDT
 *   ETHBUSD            → ETHUSDT
 *   1000PEPEUSDT       → 1000PEPEUSDT   (preservado)
 *   BTCUSDT            → BTCUSDT
 */
const QUOTES_CONHECIDAS = ['USDT', 'USDC', 'BUSD', 'TUSD', 'DAI', 'USD'] as const;

export function normalizarPar(rawPair: string): string {
  let symbol = rawPair.trim().toUpperCase();
  if (!symbol) {
    throw new Error('Par de negociação vazio.');
  }

  // Prefixo de corretora: BINANCE:BTCUSDT.P → BTCUSDT.P
  if (symbol.includes(':')) {
    symbol = symbol.slice(symbol.lastIndexOf(':') + 1);
  }

  // Sufixos de perpétuo, ancorados no FIM, e barra de par (BTC/USDT).
  symbol = symbol
    .replace(/\.P$/i, '')
    .replace(/[_-]?PERP$/i, '')
    .replace(/[^A-Z0-9]/g, '');

  if (!symbol) {
    throw new Error('Par de negociação inválido.');
  }

  // O prefixo econômico "1000" faz parte do nome do contrato e NÃO é removido — ver CODE-P0-18.
  const quote = QUOTES_CONHECIDAS.find((candidata) => symbol.endsWith(candidata));
  const base = quote ? symbol.slice(0, -quote.length) : symbol;
  if (!base) {
    throw new Error('Ativo-base ausente.');
  }

  const normalizado = `${base}USDT`;
  if (!/^[A-Z0-9]+USDT$/.test(normalizado)) {
    throw new Error(`Par inválido após normalização: ${rawPair}`);
  }

  return normalizado;
}

/**
 * V6.8 (CODE-P0-18): normalização de timeframe no mesmo módulo. "1M" (maiúsculo) é mensal e "1m" é
 * um minuto — a distinção é preservada.
 */
export function normalizarTimeframe(raw: string): string {
  const valor = raw.trim();

  // Único par sensível a maiúsculas/minúsculas do mapeamento inteiro: "1M" (mensal) x "1m" (1
  // minuto). Precisa ser resolvido ANTES de uppercasar — uppercasar os dois primeiro (como a
  // primeira versão deste arquivo fazia) faz "1m" e "1M" colidirem na mesma chave e
  // normalizarTimeframe('1m') volta '1M' por engano.
  if (valor === '1M') {
    return '1M';
  }
  if (valor === '1m') {
    return '1m';
  }

  const chave = valor.toUpperCase();

  const mapa: Record<string, string> = {
    MONTHLY: '1M', MONTH: '1M',
    '1W': '1w', W: '1w', WEEK: '1w', WEEKLY: '1w', SEMANAL: '1w',
    '3D': '3d', '1D': '1d', D: '1d', DAY: '1d', DAILY: '1d', DIARIO: '1d', 'DIÁRIO': '1d',
    '12H': '12h', H12: '12h', '8H': '8h', H8: '8h', '6H': '6h', H6: '6h',
    '4H': '4h', H4: '4h', '3H': '3h', H3: '3h',
    '2H': '2h', H2: '2h', '120M': '2h', '1H': '1h', H1: '1h', '60M': '1h', HOURLY: '1h',
    '30M': '30m', M30: '30m', '15M': '15m', M15: '15m',
    '5M': '5m', M5: '5m', '3M': '3m', M3: '3m', '1MIN': '1m', M1: '1m',
  };

  const normalizado = mapa[chave] ?? valor;
  const permitidos = new Set(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '3h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']);

  if (!permitidos.has(normalizado)) {
    throw new Error(`Timeframe inválido: ${raw}`);
  }

  return normalizado;
}
