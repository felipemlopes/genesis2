import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calcularScore, DadosScore } from '../services/scoringEngine';

/**
 * Property-based tests for Scoring Engine
 * Feature: genesis-moderate-fixes, Property 11: Score sempre no intervalo 0-100
 */

// Arbitrary for generating random DadosScore with all optional fields
const dadosScoreArb: fc.Arbitrary<DadosScore> = fc.record(
  {
    preco: fc.oneof(fc.constant(undefined), fc.double({ min: 0.01, max: 200000, noNaN: true })),
    bookImbalanceRatio: fc.oneof(fc.constant(undefined), fc.double({ min: -1, max: 1, noNaN: true })),
    ema21: fc.oneof(fc.constant(undefined), fc.double({ min: 0.01, max: 200000, noNaN: true })),
    ema50: fc.oneof(fc.constant(undefined), fc.double({ min: 0.01, max: 200000, noNaN: true })),
    ema200: fc.oneof(fc.constant(undefined), fc.double({ min: 0.01, max: 200000, noNaN: true })),
    ema21Subindo: fc.oneof(fc.constant(undefined), fc.boolean()),
    ema50Subindo: fc.oneof(fc.constant(undefined), fc.boolean()),
    ema200Subindo: fc.oneof(fc.constant(undefined), fc.boolean()),
    rsi: fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 100, noNaN: true })),
    divergenciaRSI: fc.oneof(fc.constant(undefined), fc.constantFrom('BULLISH', 'BEARISH', 'NONE')),
    adx: fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 100, noNaN: true })),
    adxSubindo: fc.oneof(fc.constant(undefined), fc.boolean()),
    macdAcimaSignal: fc.oneof(fc.constant(undefined), fc.boolean()),
    histogramaSubindo: fc.oneof(fc.constant(undefined), fc.boolean()),
    atrAtual: fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 10000, noNaN: true })),
    atrMedia20: fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 10000, noNaN: true })),
    bollingerLarguraSubindo: fc.oneof(fc.constant(undefined), fc.boolean()),
    compressaoDetectada: fc.oneof(fc.constant(undefined), fc.boolean()),
    nivelCompressao: fc.oneof(fc.constant(undefined), fc.constantFrom('SEVERA', 'MODERADA', 'LEVE')),
    cvdSlope: fc.oneof(fc.constant(undefined), fc.double({ min: -1000, max: 1000, noNaN: true })),
    divergenciaCVD: fc.oneof(fc.constant(undefined), fc.constantFrom('BULLISH', 'BEARISH', 'NONE')),
    fundingMedio: fc.oneof(fc.constant(undefined), fc.double({ min: -0.1, max: 0.1, noNaN: true })),
    oiVariacao: fc.oneof(fc.constant(undefined), fc.double({ min: -50, max: 50, noNaN: true })),
    oiSubindo: fc.oneof(fc.constant(undefined), fc.boolean()),
    precoSubindo: fc.oneof(fc.constant(undefined), fc.boolean()),
    lsRatioLongs: fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 1, noNaN: true })),
    clusterLiquidacaoAcima: fc.oneof(fc.constant(undefined), fc.double({ min: 0.01, max: 200000, noNaN: true })),
    clusterLiquidacaoAbaixo: fc.oneof(fc.constant(undefined), fc.double({ min: 0.01, max: 200000, noNaN: true })),
    vix: fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 80, noNaN: true })),
    dxyVariacao: fc.oneof(fc.constant(undefined), fc.double({ min: -5, max: 5, noNaN: true })),
    sp500Variacao: fc.oneof(fc.constant(undefined), fc.double({ min: -10, max: 10, noNaN: true })),
    btcDominanciaVariacao: fc.oneof(fc.constant(undefined), fc.double({ min: -5, max: 5, noNaN: true })),
    usdtDominanciaVariacao: fc.oneof(fc.constant(undefined), fc.double({ min: -2, max: 2, noNaN: true })),
    fearGreed: fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 100, noNaN: true })),
    geopoliticaScore: fc.oneof(fc.constant(undefined), fc.constantFrom(-3, -2, -1, 0, 1, 2, 3)),
    sentimentoMoedaScore: fc.oneof(fc.constant(undefined), fc.constantFrom(-3, -2, -1, 0, 1, 2, 3)),
    correlacaoBtc: fc.oneof(
      fc.constant(null),
      fc.constant(undefined),
      fc.record({
        correlacaoAtual: fc.double({ min: -1, max: 1, noNaN: true }),
        forca: fc.constantFrom('FORTE', 'MODERADA', 'FRACA'),
        descorrelacaoDetectada: fc.boolean(),
        tipoDescorrelacao: fc.constantFrom('FORCA_RELATIVA', 'FRAQUEZA_RELATIVA', 'NENHUMA'),
      })
    ),
  },
  { requiredKeys: [] }
);

describe('Scoring Engine - Property Tests', () => {
  // Feature: genesis-moderate-fixes, Property 11: Score sempre no intervalo 0-100
  it('P11: scoreFinal deve estar sempre no intervalo [0, 100] para qualquer DadosScore', () => {
    fc.assert(
      fc.property(dadosScoreArb, (dados) => {
        const resultado = calcularScore(dados);
        expect(resultado.scoreFinal).toBeGreaterThanOrEqual(0);
        expect(resultado.scoreFinal).toBeLessThanOrEqual(100);
        expect(Number.isFinite(resultado.scoreFinal)).toBe(true);
        expect(Number.isInteger(resultado.scoreFinal)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  // Additional invariant: ResultadoScore structure is always well-formed
  it('P11 (complementar): ResultadoScore deve ter estrutura válida para qualquer DadosScore', () => {
    fc.assert(
      fc.property(dadosScoreArb, (dados) => {
        const resultado = calcularScore(dados);

        // blocos percentuais devem estar em [0, 100]
        expect(resultado.blocoTecnico.percentual).toBeGreaterThanOrEqual(0);
        expect(resultado.blocoTecnico.percentual).toBeLessThanOrEqual(100);
        expect(resultado.blocoDerivativos.percentual).toBeGreaterThanOrEqual(0);
        expect(resultado.blocoDerivativos.percentual).toBeLessThanOrEqual(100);
        expect(resultado.blocoMacro.percentual).toBeGreaterThanOrEqual(0);
        expect(resultado.blocoMacro.percentual).toBeLessThanOrEqual(100);
        expect(resultado.blocoSentimento.percentual).toBeGreaterThanOrEqual(0);
        expect(resultado.blocoSentimento.percentual).toBeLessThanOrEqual(100);

        // vies deve ser um dos valores válidos
        expect([
          'LONG_FORTE', 'LONG_MODERADO', 'LONG_LEVE',
          'SHORT_LEVE', 'SHORT_MODERADO', 'SHORT_FORTE'
        ]).toContain(resultado.vies);

        // confiabilidade deve ser válida
        expect(['ALTA', 'MEDIA', 'BAIXA']).toContain(resultado.confiabilidade);
      }),
      { numRuns: 200 }
    );
  });
});
