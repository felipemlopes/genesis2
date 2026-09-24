/**
 * Genesis Brain V2 (Fonte §56): conjunto canônico de timeframes — espelho de
 * `App\Support\GenesisSupportedTimeframes::ALL` na API. Qualquer outro valor (2h, 3h, 12h, 1M…)
 * é rejeitado pelo backend antes de reservar crédito; a tela não deve oferecê-lo nem aceitá-lo
 * via URL/leitura do gráfico.
 */
export const SUPPORTED_TIMEFRAMES = ['5m', '15m', '1h', '4h', '1d', '1w'] as const;

export type SupportedTimeframe = (typeof SUPPORTED_TIMEFRAMES)[number];

export const isSupportedTimeframe = (value: string): value is SupportedTimeframe =>
  (SUPPORTED_TIMEFRAMES as readonly string[]).includes(value);
