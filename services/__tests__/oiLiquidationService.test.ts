/**
 * Spec genesis-v6-10-implementacao (Fase 8, item 8.1, doc §8.1): "o zero fabricado no monitor de
 * OI" — falha de coleta (exceção, array vazio) devolvia `{ val: 0, ... }`/`{ price: 0, change: 0 }`,
 * indistinguível de "o dado real é zero" pra tela (`OiLiquidationMonitor`). `fetchWithProxy`
 * (`cryptoApi.ts`) faz corrida real contra proxies com timeouts próprios — mockar isso de forma
 * determinística custaria mais do que a fase pede; mesmo padrão de asserção sobre texto-fonte já
 * usado no resto desta suíte pra arquivos sem harness de rede (ex. AnalysisResult.g11g12g13.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../oiLiquidationService.ts'),
  'utf-8',
);

describe('oiLiquidationService — Fase 8, item 8.1: falha de coleta nunca vira zero fabricado', () => {
  it('não fabrica mais { val: 0, ... }/{ price: 0, change: 0 } nos fallbacks de falha', () => {
    expect(fonte).not.toContain('{ val: 0,');
    expect(fonte).not.toContain('{ price: 0, change: 0 }');
  });

  it('os dois fetchers devolvem null nos campos numéricos quando a coleta falha', () => {
    expect(fonte).toContain('val: null, history: [], chg5m: null, chg1h: null, chg24h: null');
    expect(fonte).toContain('return { price: null, change: null };');
  });

  it('a interface pública é nullable nos campos que dependem de rede', () => {
    expect(fonte).toContain('price: number | null;');
    expect(fonte).toContain('binanceTotalUsd: number | null;');
    expect(fonte).toContain("trend: 'Rising' | 'Falling' | 'Stable' | 'Unavailable';");
  });

  it('não interpreta chg1h nulo como "diminuiu"/"estabilidade" (ausência tratada como caso próprio, antes do resto da lógica)', () => {
    expect(fonte).toContain('if (chg1h == null) {');
    expect(fonte).toContain("status = 'Unavailable';");
  });

});

/**
 * Spec genesis-v6-11-correcao-tecnica (Fase 4, item 4.11, decisão D3 do Felipe "parar de somar,
 * renomear o campo"): `byExchange.*.value` está em CONTRATOS — unidades diferentes por exchange
 * (ver MultiExchangeDerivativesDisplayService, backend), nunca somável em dólar. A soma antiga
 * (`somaExchanges`) sobrescrevia o único valor genuinamente em USD (`binanceData.val`, do
 * endpoint openInterestHist/sumOpenInterestValue da própria Binance) sempre que qualquer exchange
 * tinha dado disponível — o teste anterior desta suíte (Fase 8, item 8.1) até documentava esse
 * fallback como comportamento correto, sem perceber que a ORDEM de preferência estava invertida.
 */
describe('oiLiquidationService — Fase 4, item 4.11: sem soma cross-exchange, só a fonte real em USD', () => {
  it('não soma mais byExchange (contratos heterogêneos) — usa direto o Open Interest nocional da Binance', () => {
    expect(fonte).not.toContain('somaExchanges');
    expect(fonte).toContain('const binanceTotalUsd = binanceData.val;');
  });
});
