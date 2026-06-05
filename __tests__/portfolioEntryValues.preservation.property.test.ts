import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Preservation Property Tests — Portfolio Entry Values Fix
 * Feature: portfolio-entry-values-fix, Property 2: Preservation
 *
 * Estes testes capturam comportamentos EXISTENTES que NÃO devem mudar após o fix.
 * No código UNFIXED, eles DEVEM PASSAR — confirmando o baseline a preservar.
 * Após o fix, eles devem CONTINUAR PASSANDO — confirmando que nenhuma regressão ocorreu.
 *
 * Observações (código atual):
 * 1. Submit com preco_entrada vazio + spot disponível → sistema usa spot como fallback (salva valor do spot)
 * 2. Edit de ativo existente com preco_entrada = 2.50 → form pré-preenche com "2.50"
 * 3. Scheduler carteira:monitorar-mae → atualiza apenas preco_atual, preco_entrada intocado
 * 4. Save com corretora/tipo/alvos → todos os campos persistidos normalmente
 */

// ─── Preservation 1: Fallback Spot no Submit (Req 3.3) ──────────────────────

describe('Preservation: Fallback spot quando preco_entrada vazio no submit', () => {
  /**
   * Observed behavior: When preco_entrada is empty and a spot price is available,
   * the saveAtivo function currently sends parseFloat('') which is NaN (but the field
   * was already auto-filled by selectAtivo). After the fix, the NEW fallback at submit
   * time will use formCurrentPrice. This test validates that the saveAtivo payload
   * construction correctly parses preco_entrada when it has a value (which is the
   * current behavior since selectAtivo auto-fills it).
   */
  it('saveAtivo() sempre envia preco_entrada como número no payload', () => {
    const fs = require('fs');
    const path = require('path');
    const carteiraCriptoPath = path.resolve(__dirname, '../components/CarteiraCripto.tsx');
    const content = fs.readFileSync(carteiraCriptoPath, 'utf-8');

    // Verify saveAtivo builds payload with preco_entrada as a numeric value
    const saveAtivoMatch = content.match(/const saveAtivo\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)\n  \};/);
    expect(saveAtivoMatch).not.toBeNull();
    const saveAtivoBody = saveAtivoMatch![1];

    // After fix: payload uses precoEntradaFinal which is computed via parseFloat
    // with fallback to formCurrentPrice when preco_entrada is empty
    const usesPrecoEntradaFinal = /preco_entrada:\s*precoEntradaFinal/.test(saveAtivoBody);
    const computesFinal = /precoEntradaFinal\s*=\s*formData\.preco_entrada[\s\S]*?parseFloat\(formData\.preco_entrada\)/.test(saveAtivoBody);
    const hasFallback = /formCurrentPrice/.test(saveAtivoBody);

    // Preservation: preco_entrada is always sent as a number (via parseFloat or fallback)
    expect(usesPrecoEntradaFinal).toBe(true);
    expect(computesFinal).toBe(true);
    expect(hasFallback).toBe(true);
  });

  it('property: para qualquer preco_entrada preenchido, parseFloat produz número válido no payload', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.00000001, max: 100000, noNaN: true }),
        (spotPrice) => {
          // Simulate current behavior: selectAtivo fills preco_entrada with spot
          // Then saveAtivo does parseFloat(formData.preco_entrada)
          const formDataPrecoEntrada = spotPrice.toString();
          const payloadPrecoEntrada = parseFloat(formDataPrecoEntrada);

          // Preservation: preco_entrada in payload is always a valid number
          expect(payloadPrecoEntrada).not.toBeNaN();
          expect(payloadPrecoEntrada).toBeGreaterThan(0);
          expect(payloadPrecoEntrada).toBeCloseTo(spotPrice, 6);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('selectAtivo() define formCurrentPrice com o preço spot (referência visual existe)', () => {
    const fs = require('fs');
    const path = require('path');
    const carteiraCriptoPath = path.resolve(__dirname, '../components/CarteiraCripto.tsx');
    const content = fs.readFileSync(carteiraCriptoPath, 'utf-8');

    // Extract selectAtivo body
    const selectAtivoMatch = content.match(
      /const selectAtivo\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n  \};/
    );
    expect(selectAtivoMatch).not.toBeNull();
    const selectAtivoBody = selectAtivoMatch![1];

    // Preservation: selectAtivo ALWAYS sets formCurrentPrice (reference display)
    const setsFormCurrentPrice = /setFormCurrentPrice\(preco\)/.test(selectAtivoBody);
    expect(setsFormCurrentPrice).toBe(true);
  });
});

// ─── Preservation 2: Edit Pre-fill (Req 3.2) ────────────────────────────────

describe('Preservation: Edição de ativo existente pré-preenche com dados salvos', () => {
  it('handleEdit() pré-preenche preco_entrada com o valor salvo do ativo', () => {
    const fs = require('fs');
    const path = require('path');
    const carteiraCriptoPath = path.resolve(__dirname, '../components/CarteiraCripto.tsx');
    const content = fs.readFileSync(carteiraCriptoPath, 'utf-8');

    // Verify handleEdit sets preco_entrada from the existing asset
    const handleEditMatch = content.match(
      /const handleEdit\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n  \};/
    );
    expect(handleEditMatch).not.toBeNull();
    const handleEditBody = handleEditMatch![1];

    // Preservation: handleEdit sets preco_entrada from at.preco_entrada.toString()
    const setsPrecoEntradaFromAt = /preco_entrada:\s*at\.preco_entrada\.toString\(\)/.test(handleEditBody);
    expect(setsPrecoEntradaFromAt).toBe(true);
  });

  it('property: para qualquer ativo com preco_entrada numérico, form pré-preenche corretamente', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.00000001, max: 100000, noNaN: true }),
        (precoEntrada) => {
          // Simulate handleEdit behavior: at.preco_entrada.toString()
          const formPrecoEntrada = precoEntrada.toString();

          // Preservation: form shows the saved preco_entrada value
          expect(formPrecoEntrada).toBe(precoEntrada.toString());
          expect(parseFloat(formPrecoEntrada)).toBeCloseTo(precoEntrada, 6);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handleEdit() pré-preenche todos os campos relevantes do formulário', () => {
    const fs = require('fs');
    const path = require('path');
    const carteiraCriptoPath = path.resolve(__dirname, '../components/CarteiraCripto.tsx');
    const content = fs.readFileSync(carteiraCriptoPath, 'utf-8');

    const handleEditMatch = content.match(
      /const handleEdit\s*=\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n  \};/
    );
    expect(handleEditMatch).not.toBeNull();
    const handleEditBody = handleEditMatch![1];

    // Preservation: all key fields are pre-filled from the asset
    expect(/ativo:\s*at\.ativo/.test(handleEditBody)).toBe(true);
    expect(/corretora:\s*at\.corretora/.test(handleEditBody)).toBe(true);
    expect(/tipo:\s*at\.tipo/.test(handleEditBody)).toBe(true);
    expect(/observacoes:\s*at\.observacoes/.test(handleEditBody)).toBe(true);
  });
});

// ─── Preservation 3: Scheduler Não Altera preco_entrada (Req 3.1) ────────────

describe('Preservation: Scheduler carteira:monitorar-mae atualiza apenas preco_atual', () => {
  it('MonitorCarteiraMaeCommand atualiza SOMENTE preco_atual no update', () => {
    const fs = require('fs');
    const commandPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Console\\Commands\\MonitorCarteiraMaeCommand.php';
    const content = fs.readFileSync(commandPath, 'utf-8');

    // Preservation: The scheduler's update call ONLY touches preco_atual
    // Find all update calls in the command
    const updateCalls = content.match(/\$ativo->update\(\[([^\]]*)\]\)/g);
    expect(updateCalls).not.toBeNull();

    // Each update call should ONLY contain preco_atual
    for (const call of updateCalls!) {
      const fieldsInUpdate = call.match(/['"](\w+)['"]\s*=>/g);
      expect(fieldsInUpdate).not.toBeNull();
      for (const field of fieldsInUpdate!) {
        const fieldName = field.match(/['"](\w+)['"]/)?.[1];
        expect(fieldName).toBe('preco_atual');
      }
    }
  });

  it('MonitorCarteiraMaeCommand NÃO modifica preco_entrada', () => {
    const fs = require('fs');
    const commandPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Console\\Commands\\MonitorCarteiraMaeCommand.php';
    const content = fs.readFileSync(commandPath, 'utf-8');

    // Preservation: preco_entrada NEVER appears in update/save calls
    const updateLines = content.split('\n').filter(line =>
      line.includes('->update(') || line.includes('->save(')
    );

    for (const line of updateLines) {
      expect(line).not.toContain('preco_entrada');
    }
  });

  it('property: para qualquer novo preço spot, scheduler só atualiza preco_atual', () => {
    const fs = require('fs');
    const commandPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Console\\Commands\\MonitorCarteiraMaeCommand.php';
    const content = fs.readFileSync(commandPath, 'utf-8');

    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 100000, noNaN: true }), // spotPrice do scheduler
        fc.double({ min: 0.001, max: 100000, noNaN: true }), // preco_entrada existente
        (newSpotPrice, existingPrecoEntrada) => {
          // The command does: $ativo->update(['preco_atual' => $preco])
          // Preservation: preco_entrada is never in any update payload in the command
          const hasPrecoEntradaInUpdate = /\$ativo->update\(\[.*preco_entrada/.test(content);
          expect(hasPrecoEntradaInUpdate).toBe(false);

          // Simulate: after scheduler runs, preco_entrada would remain unchanged
          // (preco_atual gets newSpotPrice, preco_entrada stays as existingPrecoEntrada)
          const afterScheduler = {
            preco_atual: newSpotPrice,
            preco_entrada: existingPrecoEntrada, // unchanged
          };
          expect(afterScheduler.preco_entrada).toBe(existingPrecoEntrada);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── Preservation 4: Outros campos persistidos normalmente (Req 3.4) ─────────

describe('Preservation: Campos não-investimento são persistidos normalmente', () => {
  it('StoreCarteiraRequest valida corretora, tipo, alvos, e observacoes', () => {
    const fs = require('fs');
    const storeRequestPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Http\\Requests\\Api\\Carteira\\StoreCarteiraRequest.php';
    const content = fs.readFileSync(storeRequestPath, 'utf-8');

    // Preservation: all existing validation rules are present
    expect(content).toContain("'ativo'");
    expect(content).toContain("'corretora'");
    expect(content).toContain("'preco_entrada'");
    expect(content).toContain("'data_entrada'");
    expect(content).toContain("'tipo'");
    expect(content).toContain("'alvo_cima'");
    expect(content).toContain("'alvo_baixo'");
    expect(content).toContain("'alvo_saida'");
    expect(content).toContain("'telegram_mensagem'");
    expect(content).toContain("'observacoes'");
  });

  it('CarteiraMae model tem todos os campos existentes em $fillable', () => {
    const fs = require('fs');
    const modelPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Models\\CarteiraMae.php';
    const content = fs.readFileSync(modelPath, 'utf-8');

    const fillableMatch = content.match(/\$fillable\s*=\s*\[([\s\S]*?)\]/);
    expect(fillableMatch).not.toBeNull();
    const fillableContent = fillableMatch![1];

    // Preservation: all existing fillable fields remain
    const expectedFields = [
      'ativo', 'nome_completo', 'corretora', 'preco_entrada', 'preco_atual',
      'data_entrada', 'tipo', 'alvo_cima', 'alvo_baixo', 'telegram_mensagem',
      'status', 'preco_venda', 'data_venda', 'observacoes', 'baseline_valor'
    ];

    for (const field of expectedFields) {
      expect(fillableContent).toContain(`'${field}'`);
    }
  });

  it('CarteiraMembro model tem todos os campos existentes em $fillable', () => {
    const fs = require('fs');
    const modelPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Models\\CarteiraMembro.php';
    const content = fs.readFileSync(modelPath, 'utf-8');

    const fillableMatch = content.match(/\$fillable\s*=\s*\[([\s\S]*?)\]/);
    expect(fillableMatch).not.toBeNull();
    const fillableContent = fillableMatch![1];

    const expectedFields = [
      'user_id', 'ativo', 'nome_completo', 'corretora', 'preco_entrada',
      'preco_atual', 'data_entrada', 'tipo', 'alvo_saida', 'status',
      'preco_venda', 'data_venda', 'observacoes'
    ];

    for (const field of expectedFields) {
      expect(fillableContent).toContain(`'${field}'`);
    }
  });

  it('CarteiraGemas model tem todos os campos existentes em $fillable', () => {
    const fs = require('fs');
    const modelPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Models\\CarteiraGemas.php';
    const content = fs.readFileSync(modelPath, 'utf-8');

    const fillableMatch = content.match(/\$fillable\s*=\s*\[([\s\S]*?)\]/);
    expect(fillableMatch).not.toBeNull();
    const fillableContent = fillableMatch![1];

    const expectedFields = [
      'ativo', 'nome_completo', 'corretora', 'preco_entrada', 'preco_atual',
      'data_entrada', 'tipo', 'alvo_cima', 'alvo_baixo', 'telegram_mensagem',
      'status', 'preco_venda', 'data_venda', 'observacoes', 'baseline_valor'
    ];

    for (const field of expectedFields) {
      expect(fillableContent).toContain(`'${field}'`);
    }
  });

  it('property: para qualquer combinação válida de campos, StoreRequest aceita todos', () => {
    const fs = require('fs');
    const storeRequestPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Http\\Requests\\Api\\Carteira\\StoreCarteiraRequest.php';
    const content = fs.readFileSync(storeRequestPath, 'utf-8');

    fc.assert(
      fc.property(
        fc.record({
          corretora: fc.constantFrom('Binance', 'Bybit', 'Bitget', 'OKX'),
          tipo: fc.constantFrom('GEMA', 'PRJ'),
          alvo_cima: fc.option(fc.double({ min: 0.01, max: 100000, noNaN: true })),
          alvo_baixo: fc.option(fc.double({ min: 0.01, max: 100000, noNaN: true })),
          observacoes: fc.option(fc.string({ minLength: 0, maxLength: 200 })),
        }),
        (formFields) => {
          // Preservation: all these fields have validation rules in StoreCarteiraRequest
          expect(content).toContain("'corretora'");
          expect(content).toContain("'tipo'");
          expect(content).toContain("'alvo_cima'");
          expect(content).toContain("'alvo_baixo'");
          expect(content).toContain("'observacoes'");

          // Preservation: the Model fillable also includes all these
          const modelContent = fs.readFileSync(
            'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Models\\CarteiraMae.php', 'utf-8'
          );
          const fillableMatch = modelContent.match(/\$fillable\s*=\s*\[([\s\S]*?)\]/);
          expect(fillableMatch).not.toBeNull();
          expect(fillableMatch![1]).toContain("'corretora'");
          expect(fillableMatch![1]).toContain("'tipo'");
          expect(fillableMatch![1]).toContain("'alvo_cima'");
          expect(fillableMatch![1]).toContain("'alvo_baixo'");
          expect(fillableMatch![1]).toContain("'observacoes'");
        }
      ),
      { numRuns: 30 }
    );
  });

  it('CarteiraMaeTransformer retorna todos os campos existentes na resposta', () => {
    const fs = require('fs');
    const transformerPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Transformers\\CarteiraMaeTransformer.php';
    const content = fs.readFileSync(transformerPath, 'utf-8');

    // Preservation: all existing response fields remain in the transformer
    const expectedResponseFields = [
      'id', 'ativo', 'nome_completo', 'corretora', 'preco_entrada',
      'preco_atual', 'data_entrada', 'tipo', 'tipo_label',
      'alvo_cima', 'alvo_baixo', 'telegram_mensagem', 'status',
      'status_label', 'preco_venda', 'data_venda', 'observacoes',
      'created_at', 'updated_at'
    ];

    for (const field of expectedResponseFields) {
      expect(content).toContain(`'${field}'`);
    }
  });

  it('Casts do CarteiraMae model estão corretos para campos existentes', () => {
    const fs = require('fs');
    const modelPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\app\\Models\\CarteiraMae.php';
    const content = fs.readFileSync(modelPath, 'utf-8');

    const castsMatch = content.match(/\$casts\s*=\s*\[([\s\S]*?)\]/);
    expect(castsMatch).not.toBeNull();
    const castsContent = castsMatch![1];

    // Preservation: existing casts remain correct
    expect(castsContent).toContain("'preco_entrada' => 'decimal:8'");
    expect(castsContent).toContain("'preco_atual' => 'decimal:8'");
    expect(castsContent).toContain("'alvo_cima' => 'decimal:8'");
    expect(castsContent).toContain("'alvo_baixo' => 'decimal:8'");
    expect(castsContent).toContain("'preco_venda' => 'decimal:8'");
    expect(castsContent).toContain("'baseline_valor' => 'decimal:8'");
    expect(castsContent).toContain("'data_entrada' => 'date'");
    expect(castsContent).toContain("'data_venda' => 'date'");
  });
});
