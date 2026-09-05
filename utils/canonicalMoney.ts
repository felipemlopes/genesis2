// V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.7, doc §16): formatador
// único de valores monetários — substitui `formatPrice()` (services/cryptoApi.ts), que decidia as
// casas decimais por uma HEURÍSTICA de magnitude (>= $1 → 2 casas, >= $0,01 → 4, abaixo → 8),
// sem relação com o tick real do contrato. `PriceNormalizer` (backend, item 8.6) já calcula
// `tick_decimals` real por símbolo — `kind: PRICE` usa esse valor quando disponível, nunca
// publica mais casas do que a corretora de fato aceita. `kind: USD_AMOUNT` (nocional, risco em
// dólar, margem) sempre usa 2 casas — é dinheiro, não preço de ativo, a mesma "regra imutável"
// que `formatPrice()` já aplicava pra valores >= $1.
//
// Degradação: sem `tickDecimals` (análise persistida antes deste item, ou símbolo sem filtro
// conhecido — `PriceNormalizer` também degrada nesse caso), `price()` cai na mesma heurística de
// magnitude que `formatPrice()` sempre usou — nunca perde precisão pra tokens de baixo valor
// (PEPE, SHIB) nem publica zeros à toa pra BTC.

export type MoneyKind = 'PRICE' | 'USD_AMOUNT';

const magnitudeDecimals = (value: number): number => {
  const abs = Math.abs(value);
  if (abs >= 1) return 2;
  if (abs >= 0.01) return 4;
  return 8;
};

const format = (value: number, decimals: number): string =>
  '$' + value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * Preço de ativo (entrada, stop, TP, liquidação, EMA, ATR...). Passe `tickDecimals` do plano
 * ativo (`planoAtivo?.tick_decimals`) sempre que disponível — é a mesma precisão real que a
 * corretora aceita para este símbolo, não uma estimativa por magnitude.
 */
export const price = (value: number | null | undefined, tickDecimals?: number | null): string => {
  if (value == null || Number.isNaN(value)) return '—';
  const decimals = tickDecimals ?? magnitudeDecimals(value);
  return format(value, decimals);
};

/** Valor em dólar que não é preço de ativo — nocional, risco estimado, margem, capital-base. */
export const usd = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return '—';
  return format(value, 2);
};

/**
 * Formata por `kind` explícito — usado quando o chamador já tem o valor e o tipo numa mesma
 * variável (ex.: iterando uma lista de campos monetários heterogêneos) e prefere não escolher
 * entre `price()`/`usd()` no ponto de chamada.
 */
export const formatMoney = (value: number | null | undefined, kind: MoneyKind, tickDecimals?: number | null): string =>
  kind === 'USD_AMOUNT' ? usd(value) : price(value, tickDecimals);
