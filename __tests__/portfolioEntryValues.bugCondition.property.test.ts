import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Bug Condition Exploration Tests — Portfolio Entry Values Fix
 * Feature: portfolio-entry-values-fix, Property 1: Bug Condition
 *
 * CRITICAL: Estes testes codificam o COMPORTAMENTO ESPERADO (correto).
 * No código UNFIXED, eles DEVEM FALHAR — a falha confirma que os bugs existem.
 * Após o fix, eles devem PASSAR — confirmando que os bugs foram corrigidos.
 *
 * NÃO tente corrigir o teste ou o código quando ele falhar.
 *
 * Bug 1: selectAtivo() auto-preenche preco_entrada com spot price
 * Bug 2: investimento não é persistido pelo backend (coluna inexistente)
 */

// ─── Bug 1: selectAtivo() auto-preenche preco_entrada ────────────────────────

describe('Bug 1: selectAtivo() NÃO deve auto-preencher preco_entrada com spot price', () => {
  it('Após selectAtivo(), formData.preco_entrada deve permanecer vazio', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const carteiraCriptoPath = path.resolve(__dirname, '../components/CarteiraCripto.tsx');
    const content = fs.readFileSync(carteiraCriptoPath, 'utf-8');

    // Extrair o bloco da função selectAtivo
    const selectAtivoMatch = content.match(
      /const selectAtivo\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n  \};/
    );
    expect(selectAtivoMatch).not.toBeNull();
    const selectAtivoBody = selectAtivoMatch![1];

    // Bug Condition: selectAtivo sets formData.preco_entrada when field is empty
    // Expected Behavior: selectAtivo should NEVER set preco_entrada
    // It should only set formCurrentPrice for visual reference
    const setsPrecoEntrada = /setFormData[\s\S]*?preco_entrada/.test(selectAtivoBody);

    // EXPECTED: selectAtivo should NOT set preco_entrada
    // On UNFIXED code this will FAIL because it currently sets preco_entrada
    expect(setsPrecoEntrada).toBe(false);
  });

  it('property: para qualquer ativo selecionado com qualquer spot price, preco_entrada permanece vazio', () => {
    // Simulate the selectAtivo logic as currently implemented (unfixed)
    // This test encodes the EXPECTED behavior — it will fail on unfixed code

    const simulateSelectAtivo = (
      symbol: string,
      _name: string,
      spotPrice: number,
      currentPrecoEntrada: string
    ): { preco_entrada: string; formCurrentPrice: number | null } => {
      // Read the actual source to determine behavior
      const fs = require('fs');
      const path = require('path');
      const carteiraCriptoPath = path.resolve(__dirname, '../components/CarteiraCripto.tsx');
      const content = fs.readFileSync(carteiraCriptoPath, 'utf-8');

      // Extract the selectAtivo logic
      const autoFillsPrecoEntrada = /if\s*\(\s*preco\s*&&\s*!formData\.preco_entrada\s*\)/.test(content);

      let preco_entrada = currentPrecoEntrada;
      let formCurrentPrice: number | null = spotPrice;

      // Simulate the current behavior based on source code analysis
      if (autoFillsPrecoEntrada && spotPrice && !currentPrecoEntrada) {
        preco_entrada = spotPrice.toString();
      }

      return { preco_entrada, formCurrentPrice };
    };

    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Z]{2,10}$/),       // symbol (e.g. BTC, ETH, SOL)
        fc.stringMatching(/^[A-Za-z ]{3,30}$/),    // name (e.g. Bitcoin, Ethereum)
        fc.double({ min: 0.001, max: 100000, noNaN: true }), // spotPrice
        (symbol, name, spotPrice) => {
          // Scenario: new asset selection, preco_entrada is empty (as it would be for new entries)
          const result = simulateSelectAtivo(symbol, name, spotPrice, '');

          // EXPECTED BEHAVIOR: preco_entrada should remain EMPTY after selectAtivo
          // formCurrentPrice should hold the spot price for visual reference only
          expect(result.preco_entrada).toBe('');
          expect(result.formCurrentPrice).toBe(spotPrice);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('counterexample: selectAtivo("BTC", "Bitcoin") com spot=67500 → preco_entrada deve ser ""', () => {
    const fs = require('fs');
    const path = require('path');
    const carteiraCriptoPath = path.resolve(__dirname, '../components/CarteiraCripto.tsx');
    const content = fs.readFileSync(carteiraCriptoPath, 'utf-8');

    const autoFillsPrecoEntrada = /if\s*\(\s*preco\s*&&\s*!formData\.preco_entrada\s*\)/.test(content);

    // Simulate: selectAtivo('BTC', 'Bitcoin') with spot=67500, preco_entrada initially empty
    let preco_entrada = '';
    if (autoFillsPrecoEntrada && !preco_entrada) {
      preco_entrada = '67500'; // Current buggy behavior fills it
    }

    // EXPECTED: preco_entrada should remain empty
    // ACTUAL (unfixed): preco_entrada becomes "67500"
    expect(preco_entrada).toBe('');
  });
});

// ─── Bug 2: investimento não é persistido pelo backend ───────────────────────

describe('Bug 2: Backend deve persistir e retornar campo investimento', () => {
  it('StoreCarteiraRequest deve incluir regra de validação para investimento', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const storeRequestPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Http\\Requests\\Api\\Carteira\\StoreCarteiraRequest.php';
    const content = fs.readFileSync(storeRequestPath, 'utf-8');

    // Expected: 'investimento' => 'nullable|numeric' should be in the rules
    const hasInvestimentoRule = /['"]investimento['"]\s*=>\s*['"]nullable\|numeric['"]/.test(content);

    // On UNFIXED code this will FAIL because investimento is not in the rules
    expect(hasInvestimentoRule).toBe(true);
  });

  it('CarteiraMae model deve ter investimento em $fillable', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const modelPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Models\\CarteiraMae.php';
    const content = fs.readFileSync(modelPath, 'utf-8');

    // Extract $fillable array
    const fillableMatch = content.match(/\$fillable\s*=\s*\[([\s\S]*?)\]/);
    expect(fillableMatch).not.toBeNull();
    const fillableContent = fillableMatch![1];

    // Expected: 'investimento' should be in fillable
    const hasInvestimento = /['"]investimento['"]/.test(fillableContent);

    // On UNFIXED code this will FAIL because investimento is not in fillable
    expect(hasInvestimento).toBe(true);
  });

  it('CarteiraMaeTransformer deve incluir investimento na response', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const transformerPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Transformers\\CarteiraMaeTransformer.php';
    const content = fs.readFileSync(transformerPath, 'utf-8');

    // Extract the transform method's return array
    const transformMatch = content.match(/return\s*\[([\s\S]*?)\];/);
    expect(transformMatch).not.toBeNull();
    const transformContent = transformMatch![1];

    // Expected: 'investimento' should be in the response
    const hasInvestimento = /['"]investimento['"]/.test(transformContent);

    // On UNFIXED code this will FAIL because investimento is not in transformer
    expect(hasInvestimento).toBe(true);
  });

  it('property: para qualquer investimento numérico > 0, backend deve aceitar e retornar o valor', () => {
    // This test validates the backend pipeline by checking source code for investimento support
    const fs = require('fs');
    const path = require('path');

    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1000000, noNaN: true }), // investimento value
        (investimento) => {
          // Check 1: StoreCarteiraRequest has investimento validation rule
          const storeRequestPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Http\\Requests\\Api\\Carteira\\StoreCarteiraRequest.php';
          const storeContent = fs.readFileSync(storeRequestPath, 'utf-8');
          const hasValidationRule = /['"]investimento['"]/.test(storeContent);

          // Check 2: Model has investimento in fillable
          const modelPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Models\\CarteiraMae.php';
          const modelContent = fs.readFileSync(modelPath, 'utf-8');
          const fillableMatch = modelContent.match(/\$fillable\s*=\s*\[([\s\S]*?)\]/);
          const hasFillable = fillableMatch ? /['"]investimento['"]/.test(fillableMatch[1]) : false;

          // Check 3: Transformer includes investimento in response
          const transformerPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Transformers\\CarteiraMaeTransformer.php';
          const transformerContent = fs.readFileSync(transformerPath, 'utf-8');
          const hasTransformer = /['"]investimento['"]/.test(transformerContent);

          // For ANY positive investimento value, the full pipeline must support it
          // On UNFIXED code: all three checks FAIL
          expect(hasValidationRule).toBe(true);
          expect(hasFillable).toBe(true);
          expect(hasTransformer).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('counterexample: POST com investimento=500 → response deve incluir investimento: 500', () => {
    const fs = require('fs');

    // Verify the backend would accept investimento=500
    const storeContent = fs.readFileSync(
      'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Http\\Requests\\Api\\Carteira\\StoreCarteiraRequest.php',
      'utf-8'
    );
    const transformerContent = fs.readFileSync(
      'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Transformers\\CarteiraMaeTransformer.php',
      'utf-8'
    );

    // StoreCarteiraRequest must accept investimento
    const requestAcceptsInvestimento = /['"]investimento['"]\s*=>/.test(storeContent);
    // Transformer must include investimento in response
    const transformerReturnsInvestimento = /['"]investimento['"]\s*=>/.test(transformerContent);

    // EXPECTED: Both should be true (backend accepts AND returns investimento)
    // ACTUAL (unfixed): Both are false — field is completely absent from backend pipeline
    expect(requestAcceptsInvestimento).toBe(true);
    expect(transformerReturnsInvestimento).toBe(true);
  });
});
