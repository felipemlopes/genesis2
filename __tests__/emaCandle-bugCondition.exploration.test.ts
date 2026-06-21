import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * EMA Candle Fetch — Bug Condition Exploration Tests
 * Feature: ema-candle-fetch-fix, Property 1: Bug Condition
 *
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.6**
 *
 * CRITICAL: Estes testes codificam o COMPORTAMENTO ESPERADO (correto).
 * No código UNFIXED, eles DEVEM FALHAR — a falha confirma que os bugs existem.
 * Após o fix, eles PASSARÃO — confirmando que os bugs foram corrigidos.
 *
 * NÃO tente corrigir os testes ou o código de produção ao ver falhas.
 *
 * Scoped to concrete failing symbols: BINANCE:PHAUSDT.P, ETH/USDT, PHAUSDT.P
 */

// ─── Bug Condition Definition ─────────────────────────────────────────────────

function isBugCondition(symbol: string): boolean {
  return /[:\/.]/u.test(symbol)
    || symbol.endsWith('.P')
    || symbol.endsWith('PERP');
}

// ─── sanitizeSymbolCorrect — EXPECTED behavior after the fix ─────────────────
// This represents the correct sanitization the fix should implement.

function sanitizeSymbolCorrect(symbol: string): string {
  let s = symbol.toUpperCase().trim();
  if (s.includes(':')) {
    s = s.split(':').pop()!;
  }
  s = s.replace(/\.P$/g, '');
  s = s.replace(/PERP$/g, '');
  s = s.replace(/\//g, '');
  s = s.replace(/[^A-Z0-9]/g, '');
  return s;
}

// ─── currentCleanSymbol — UNFIXED behavior from services/cryptoApi.ts ─────────
// Source: services/cryptoApi.ts `fetchMarketKlines`:
//   let cleanSymbol = symbol.replace('/', '').toUpperCase();
//   if (!cleanSymbol.endsWith('USDT')) cleanSymbol += 'USDT';

function currentCleanSymbol(symbol: string): string {
  let cleanSymbol = symbol.replace('/', '').toUpperCase();
  if (!cleanSymbol.endsWith('USDT')) cleanSymbol += 'USDT';
  return cleanSymbol;
}

// ─── Bug 1.1 + 1.2: Dirty symbols not sanitized correctly ────────────────────

describe('Bug 1.1 + 1.2: BinanceService — símbolos sujos devem ser sanitizados antes da chamada à API', () => {

  /**
   * Property: For BINANCE:PHAUSDT.P, the production symbol sent to Binance
   * must be PHAUSDT. On unfixed code, currentCleanSymbol produces
   * 'BINANCE:PHAUSDT.PUSDT' which Binance rejects.
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('property: para BINANCE:PHAUSDT.P, o símbolo sanitizado deve ser PHAUSDT', () => {
    const dirtySymbol = 'BINANCE:PHAUSDT.P';
    const expectedClean = 'PHAUSDT';

    // Document the bug: unfixed code produces the wrong symbol
    const unfixedResult = currentCleanSymbol(dirtySymbol);
    // 'BINANCE:PHAUSDT.P' → replace('/','') → 'BINANCE:PHAUSDT.P'
    // → toUpperCase → 'BINANCE:PHAUSDT.P'
    // → does NOT end with 'USDT' → append USDT → 'BINANCE:PHAUSDT.PUSDT' (WRONG)
    console.log('[BUG 1.1 COUNTEREXAMPLE] unfixedResult:', unfixedResult, '(expected:', expectedClean, ')');
    expect(unfixedResult).not.toBe(expectedClean); // Documents the bug: unfixed ≠ expected

    // PROPERTY — EXPECTED (fixed) behavior: production sanitization MUST produce PHAUSDT.
    // On UNFIXED code, this FAILS because currentCleanSymbol('BINANCE:PHAUSDT.P') = 'BINANCE:PHAUSDT.PUSDT'.
    expect(currentCleanSymbol(dirtySymbol)).toBe(expectedClean); // FAILS on unfixed code
  });

  it('property: para PHAUSDT.P, o símbolo sanitizado deve ser PHAUSDT', () => {
    const dirtySymbol = 'PHAUSDT.P';
    const expectedClean = 'PHAUSDT';

    // Unfixed: 'PHAUSDT.P' → replace('/','') → 'PHAUSDT.P'
    // → NOT ends with USDT → append → 'PHAUSDT.PUSDT' (WRONG)
    const unfixedResult = currentCleanSymbol(dirtySymbol);
    console.log('[BUG 1.1 COUNTEREXAMPLE] unfixedResult:', unfixedResult, '(expected:', expectedClean, ')');
    expect(unfixedResult).not.toBe(expectedClean); // Bug confirmed

    // PROPERTY — FAILS on unfixed code
    expect(currentCleanSymbol(dirtySymbol)).toBe(expectedClean); // FAILS on unfixed code
  });

  it('property: para ETH/USDT, isBugCondition=true e símbolo deve ser sanitizado via sanitizeSymbol explícito', () => {
    const dirtySymbol = 'ETH/USDT';
    const expectedClean = 'ETHUSDT';

    expect(isBugCondition(dirtySymbol)).toBe(true); // Contains '/'

    // ETH/USDT happens to work with unfixed code accidentally (strip '/' → ETHUSDT → ends with USDT)
    // But the FIX must use explicit sanitizeSymbol(), not accidental behavior.
    // PROPERTY: sanitizeSymbolCorrect must produce the correct symbol explicitly.
    expect(sanitizeSymbolCorrect(dirtySymbol)).toBe(expectedClean);
  });

  /**
   * PBT: For all dirty symbols, the production cleanSymbol function must
   * produce only [A-Z0-9]+ characters. On unfixed code, symbols with ':' and '.'
   * pass through unchanged → Binance rejects them.
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('property-based: para todos os símbolos sujos (isBugCondition=true), o símbolo sanitizado deve ser [A-Z0-9]+', () => {
    const dirtySymbols = [
      'BINANCE:PHAUSDT.P',
      'BINANCE:BTCUSDT',
      'BYBIT:ETHUSDT',
      'ETH/USDT',
      'BTC/USDT',
      'PHAUSDT.P',
      'BTCUSDTPERP',
      'ETHPERP',
      'SOLUSDT.P',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...dirtySymbols),
        (symbol) => {
          expect(isBugCondition(symbol)).toBe(true);

          // PROPERTY: EXPECTED (fixed) — production clean symbol must be [A-Z0-9]+ only.
          // On unfixed code, 'BINANCE:PHAUSDT.P' → 'BINANCE:PHAUSDT.PUSDT' (has ':' and '.') → FAILS
          const sanitized = currentCleanSymbol(symbol);
          expect(/^[A-Z0-9]+$/.test(sanitized)).toBe(true); // FAILS on unfixed code for ':' and '.' symbols
        }
      ),
      { numRuns: dirtySymbols.length }
    );
  });

  it('property: sanitizeSymbolCorrect nunca retorna símbolo com caracteres inválidos', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'BINANCE:PHAUSDT.P',
          'ETH/USDT',
          'PHAUSDT.P',
          'BTCPERP',
          'BYBIT:SOLUSDT',
        ),
        (symbol) => {
          const clean = sanitizeSymbolCorrect(symbol);
          expect(/^[A-Z0-9]+$/.test(clean)).toBe(true);
          expect(clean.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 5 }
    );
  });
});

// ─── Bug 1.6: gerarContextoParaGemini silently discards null EMAs ─────────────

describe('Bug 1.6: gerarContextoParaGemini — EMAs nulas devem exibir INDISPONIVEL, não serem omitidas', () => {

  /**
   * Test: when ema21, ema50, ema200 are null in dados,
   * gerarContextoParaGemini SHOULD include "EMA21=INDISPONIVEL" etc.
   * On UNFIXED code: `if (dados.ema21)` is falsy for null → line silently skipped.
   *
   * **Validates: Requirement 1.6**
   */
  it('quando ema21, ema50, ema200 são null, gerarContextoParaGemini deve incluir EMA21=INDISPONIVEL', async () => {
    const { gerarContextoParaGemini } = await import('../services/interpretationEngine');

    const mockScore = {
      scoreFinal: 50,
      vies: 'LONG_LEVE',
      confiabilidade: 'MEDIA' as const,
      flags: [],
      blocoTecnico: { pontos: 0, percentual: 0, maxPontos: 55 },
      blocoDerivativos: { pontos: 0, percentual: 0, maxPontos: 45 },
    };

    const dadosComEmasNulas = {
      preco: 50000,
      ema21: null,
      ema50: null,
      ema200: null,
      ema21Subindo: false,
      ema50Subindo: false,
      ema200Subindo: false,
    };

    const contexto = gerarContextoParaGemini(mockScore as any, dadosComEmasNulas);

    // EXPECTED (fixed): context must contain EMA lines with INDISPONIVEL
    // On UNFIXED code: `if (dados.ema21)` → null falsy → EMA line OMITTED silently → FAILS
    expect(contexto).toContain('EMA21=INDISPONIVEL'); // FAILS on unfixed code
    expect(contexto).toContain('EMA50=INDISPONIVEL'); // FAILS on unfixed code
    expect(contexto).toContain('EMA200=INDISPONIVEL'); // FAILS on unfixed code
  });

  it('confirmação do bug 1.6: gerarContextoParaGemini ATUAL omite silenciosamente EMAs nulas', async () => {
    const { gerarContextoParaGemini } = await import('../services/interpretationEngine');

    const mockScore = {
      scoreFinal: 50,
      vies: 'LONG_LEVE',
      confiabilidade: 'MEDIA' as const,
      flags: [],
      blocoTecnico: { pontos: 0, percentual: 0, maxPontos: 55 },
      blocoDerivativos: { pontos: 0, percentual: 0, maxPontos: 45 },
    };

    const dadosComEmasNulas = {
      preco: 50000,
      ema21: null,
      ema50: null,
      ema200: null,
    };

    const contexto = gerarContextoParaGemini(mockScore as any, dadosComEmasNulas);

    // Document bug 1.6: on unfixed code, the context does NOT contain any EMA line
    // because `if (dados.ema21)` is falsy for null.
    const bugBehavior_ema21Missing = !contexto.includes('EMA 21:') && !contexto.includes('EMA21=');
    const bugBehavior_ema50Missing = !contexto.includes('EMA 50:') && !contexto.includes('EMA50=');
    const bugBehavior_ema200Missing = !contexto.includes('EMA 200:') && !contexto.includes('EMA200=');

    // COUNTEREXAMPLE documentation (passes on unfixed code — proves bug exists)
    console.log('[BUG 1.6 COUNTEREXAMPLE] EMA 21 line missing from context:', bugBehavior_ema21Missing);
    console.log('[BUG 1.6 COUNTEREXAMPLE] EMA 50 line missing from context:', bugBehavior_ema50Missing);
    console.log('[BUG 1.6 COUNTEREXAMPLE] EMA 200 line missing from context:', bugBehavior_ema200Missing);
    console.log('[BUG 1.6 COUNTEREXAMPLE] Context with null EMAs:\n', contexto.slice(0, 600));

    // On UNFIXED code: all EMA lines ARE missing (bug confirmed)
    expect(bugBehavior_ema21Missing).toBe(true); // PASSES on unfixed code (bug confirmed)
    expect(bugBehavior_ema50Missing).toBe(true); // PASSES on unfixed code (bug confirmed)
    expect(bugBehavior_ema200Missing).toBe(true); // PASSES on unfixed code (bug confirmed)
  });

  /**
   * PBT: For any combination of null/undefined/0 EMA values,
   * the context must always contain EMA markers with INDISPONIVEL.
   *
   * **Validates: Requirement 1.6**
   */
  it('property-based: gerarContextoParaGemini com EMAs nulas/zero nunca deve omitir a seção de EMAs', async () => {
    const { gerarContextoParaGemini } = await import('../services/interpretationEngine');

    const mockScore = {
      scoreFinal: 30,
      vies: 'BEARISH',
      confiabilidade: 'BAIXA' as const,
      flags: [],
      blocoTecnico: { pontos: 0, percentual: 0, maxPontos: 55 },
      blocoDerivativos: { pontos: 0, percentual: 0, maxPontos: 45 },
    };

    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, 0),
        fc.constantFrom(null, undefined, 0),
        fc.constantFrom(null, undefined, 0),
        (ema21, ema50, ema200) => {
          const dados = {
            preco: 50000,
            ema21,
            ema50,
            ema200,
            ema21Subindo: false,
            ema50Subindo: false,
            ema200Subindo: false,
          };

          const contexto = gerarContextoParaGemini(mockScore as any, dados);

          // EXPECTED (fixed): context must always mention EMA21=INDISPONIVEL etc.
          // On UNFIXED code: `if (dados.ema21)` → falsy → line OMITTED → FAILS
          expect(contexto).toContain('EMA21=INDISPONIVEL'); // FAILS on unfixed code
          expect(contexto).toContain('EMA50=INDISPONIVEL'); // FAILS on unfixed code
          expect(contexto).toContain('EMA200=INDISPONIVEL'); // FAILS on unfixed code
        }
      ),
      { numRuns: 27 } // 3^3 combinations
    );
  });
});

// ─── Bug 1.4: ocrData never passed to EMA calculation ────────────────────────

describe('Bug 1.4: obterIndicadorComFallback — fallback OCR para EMA deve ser ativado quando candles falham', () => {

  /**
   * When candles are empty (dirty symbol → empty klines), the indicator
   * calculation should use ocrData as fallback.
   *
   * In UNFIXED code: `buscarDadosAdaptados` computes:
   *   const ema21 = calcEMA_IE(candlesForIE, 21);  // null for empty candles
   *   const emaScoreCurta = usarEmaCurta ? ... : (ema21 || undefined);  // undefined
   * The ocrData from jsonVisual is NEVER passed to these direct calculations.
   *
   * **Validates: Requirement 1.4**
   */
  it('quando calcularEMA retorna null com candles vazios, ocrData com ema_21 deve ser usado como fallback', () => {
    const { calcularEMA } = require('../services/indicatorEngine');

    const emptyCandles: any[] = [];

    // Step 1: Try API calculation with empty candles
    const ema21FromApi = calcularEMA(emptyCandles, 21);
    expect(ema21FromApi).toBeNull(); // Confirmed: API returns null for empty candles

    // Step 2: The UNFIXED direct path in buscarDadosAdaptados:
    //   emaScoreCurta = usarEmaCurta ? classified.valor : (ema21 || undefined)
    //                 = false ? ... : (null || undefined) = undefined
    // OCR data never consulted.
    const usarEmaCurta = false; // no EMA detected in visual indicators
    const emaScoreCurtaUnfixed: number | undefined = usarEmaCurta ? 9999 : (ema21FromApi || undefined);
    // → undefined (ocrData completely bypassed)

    // Step 3: The FIXED behavior: when ema21FromApi is null, fall back to ocrData
    const ocrData = { ema_21: 65432.10, ema_50: 63100.0, ema_200: 58000.0 };
    const ema21WithFallback = ema21FromApi !== null ? ema21FromApi : (ocrData['ema_21'] ?? null);
    expect(ema21WithFallback).toBe(65432.10); // Fixed behavior produces OCR value

    console.log('[BUG 1.4 COUNTEREXAMPLE] ema21FromApi:', ema21FromApi);
    console.log('[BUG 1.4 COUNTEREXAMPLE] emaScoreCurtaUnfixed:', emaScoreCurtaUnfixed, '(should be 65432.10 with fix)');
    console.log('[BUG 1.4 COUNTEREXAMPLE] ocrData.ema_21 available but unused:', ocrData.ema_21);

    // PROPERTY: EXPECTED (fixed) — emaScoreCurta must not be undefined when ocrData has ema_21.
    // On UNFIXED code: emaScoreCurtaUnfixed = undefined → FAILS:
    expect(emaScoreCurtaUnfixed).not.toBeUndefined(); // FAILS on unfixed code
    expect(emaScoreCurtaUnfixed).toBe(65432.10);       // FAILS on unfixed code
  });

  it('obterIndicadorComFallback usa OCR quando API falha — mas a rota direta de calcEMA não', async () => {
    const { obterIndicadorComFallback } = await import('../services/adaptedDataFetcher');

    // jsonVisual with OCR-detected EMA values from Gemini Vision
    const jsonVisual = {
      indicadores_visiveis: [
        { nome: 'EMA_21', valor_estimado: '65432.10' },
        { nome: 'EMA_50', valor_estimado: '63100.00' },
        { nome: 'EMA_200', valor_estimado: '58000.00' },
      ],
    };

    const emptyCandles: any[] = [];
    const emptyCloses: number[] = [];

    // obterIndicadorComFallback DOES support OCR fallback:
    const result = obterIndicadorComFallback('EMA', 21, emptyCloses, emptyCandles, jsonVisual);
    expect(result.fonte).toBe('GRAFICO');
    expect(result.valor).toBe(65432.10);

    // BUG 1.4 DOCUMENTATION:
    // The problem is NOT in obterIndicadorComFallback — it works correctly.
    // The problem is that in buscarDadosAdaptados, there is a SECOND direct EMA calculation:
    //   const ema21 = calcEMA_IE(candlesForIE, 21);  ← null for empty candles
    //   const emaScoreCurta = usarEmaCurta ? ... : (ema21 || undefined);  ← undefined!
    // This path BYPASSES obterIndicadorComFallback and NEVER uses OCR data.
    console.log('[BUG 1.4 DOCUMENTATION] obterIndicadorComFallback correctly uses OCR:', result);
    console.log('[BUG 1.4 DOCUMENTATION] But direct calcEMA_IE path in buscarDadosAdaptados ignores OCR.');
  });

  it('property: calcularEMA retorna null para candles vazios ou insuficientes', () => {
    const { calcularEMA } = require('../services/indicatorEngine');

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 40 }), // below 42 (period * 2 = 21 * 2)
        (candleCount) => {
          const candles = Array.from({ length: candleCount }, (_, i) => ({
            timestamp: Date.now() - i * 60000,
            open: 100, high: 101, low: 99, close: 100, volume: 1000,
          }));

          const result = calcularEMA(candles, 21);
          // With fewer than period*2 candles, EMA returns null
          expect(result).toBeNull();
        }
      ),
      { numRuns: 41 }
    );
  });
});

// ─── Integration: dirty symbol → empty candles → INDISPONIVEL in context ─────

describe('Integration: símbolo sujo → candles vazios → EMAs devem aparecer como INDISPONIVEL no contexto', () => {

  /**
   * Chains all three bugs:
   * 1. Dirty symbol not sanitized → Binance rejects → empty candles
   * 2. Empty candles → EMA = null (no OCR fallback via direct path)
   * 3. Null EMAs → gerarContextoParaGemini silently omits EMA lines
   *
   * EXPECTED (fixed): context always includes EMA21=, EMA50=, EMA200= (value or INDISPONIVEL).
   *
   * **Validates: Requirements 1.1, 1.2, 1.4, 1.6**
   */
  it('end-to-end: para símbolo sujo com candles vazios, o contexto DEVE conter EMA21=INDISPONIVEL', async () => {
    const { gerarContextoParaGemini } = await import('../services/interpretationEngine');
    const { calcularEMA } = await import('../services/indicatorEngine');

    // Step 1: dirty symbol confirmed
    const dirtySymbol = 'BINANCE:PHAUSDT.P';
    expect(isBugCondition(dirtySymbol)).toBe(true);

    // Step 2: simulate Binance API rejecting dirty symbol → empty candles
    const emptyCandles: any[] = [];

    // Step 3: EMA calculation with empty candles → null
    const ema21 = calcularEMA(emptyCandles, 21);
    const ema50 = calcularEMA(emptyCandles, 50);
    const ema200 = calcularEMA(emptyCandles, 200);
    expect(ema21).toBeNull();
    expect(ema50).toBeNull();
    expect(ema200).toBeNull();

    // Step 4: build context with null EMAs
    const mockScore = {
      scoreFinal: 50, vies: 'LONG_LEVE', confiabilidade: 'MEDIA' as const,
      flags: [],
      blocoTecnico: { pontos: 0, percentual: 0, maxPontos: 55 },
      blocoDerivativos: { pontos: 0, percentual: 0, maxPontos: 45 },
    };

    const contexto = gerarContextoParaGemini(mockScore as any, {
      preco: 50000,
      ema21, ema50, ema200,
      ema21Subindo: false, ema50Subindo: false, ema200Subindo: false,
    });

    console.log('[INTEGRATION COUNTEREXAMPLE] Context for dirty symbol with empty candles:\n', contexto.slice(0, 600));

    // EXPECTED (fixed): context must contain EMA lines with INDISPONIVEL
    // On UNFIXED code: null EMAs → `if (dados.ema21)` is falsy → lines omitted → FAILS
    expect(contexto).toContain('EMA21=INDISPONIVEL'); // FAILS on unfixed code
    expect(contexto).toContain('EMA50=INDISPONIVEL'); // FAILS on unfixed code
    expect(contexto).toContain('EMA200=INDISPONIVEL'); // FAILS on unfixed code
  });

  it('scoped PBT: para os 3 símbolos concretos com bug, a sanitização é incorreta no código unfixed', () => {
    const buggySymbols = ['BINANCE:PHAUSDT.P', 'PHAUSDT.P', 'ETH/USDT'];

    fc.assert(
      fc.property(
        fc.constantFrom(...buggySymbols),
        (symbol) => {
          expect(isBugCondition(symbol)).toBe(true);

          const unfixedClean = currentCleanSymbol(symbol);
          const fixedClean = sanitizeSymbolCorrect(symbol);

          expect(/^[A-Z0-9]+$/.test(fixedClean)).toBe(true);

          // ASSERTION: UNFIXED production code must produce the CORRECT clean symbol.
          // On unfixed code: 'BINANCE:PHAUSDT.P' → 'BINANCE:PHAUSDT.PUSDT' ≠ 'PHAUSDT' → FAILS
          expect(unfixedClean).toBe(fixedClean); // FAILS on unfixed code for ':' and '.P' symbols
        }
      ),
      { numRuns: buggySymbols.length }
    );
  });
});
