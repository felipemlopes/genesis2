# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Preço de Entrada Auto-Preenchido e Investimento Não Persistido
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to two concrete failing cases:
    - Bug 1: After calling `selectAtivo()` with any asset, `formData.preco_entrada` should remain empty (but currently gets filled with spot price)
    - Bug 2: After POST `/api/carteira` with `investimento: <any positive number>`, the response should include `investimento` with the sent value (but currently returns null)
  - Test assertions (Expected Behavior from design):
    - After `selectAtivo(symbol, name)`: `formData.preco_entrada === ''` AND `formCurrentPrice === spotPrice`
    - After POST with investimento: `response.investimento === input.investimento`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples:
    - `selectAtivo('BTC', 'Bitcoin')` with spot=67500 → `preco_entrada` becomes "67500" instead of remaining empty
    - POST with `investimento: 500` → response returns `investimento: null` (field not persisted)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Comportamentos Existentes Não Afetados
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code:
    - Submit form with `preco_entrada` empty and spot available → system uses spot as fallback (saves spot value)
    - Edit existing asset with `preco_entrada = 2.50` → form pre-fills with "2.50"
    - Run `carteira:monitorar-mae` → only `preco_atual` is updated, `preco_entrada` unchanged
    - Save asset with corretora/tipo/alvos filled → all fields persisted normally
  - Write property-based tests capturing observed behavior patterns:
    - For all submissions where `preco_entrada` is empty and spot exists: saved `preco_entrada` equals spot value (fallback behavior)
    - For all existing assets edited: form pre-fills with saved `preco_entrada` value
    - For all scheduler cycles: `preco_entrada` before cycle === `preco_entrada` after cycle
    - For all submissions with non-investimento fields: those fields are persisted unchanged
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix for portfolio entry values (preco_entrada auto-fill and investimento persistence)

  - [x] 3.1 Remove auto-fill in selectAtivo() and add fallback on submit (CarteiraCripto.tsx)
    - Remove lines that set `preco_entrada` from spot price in `selectAtivo()` (lines 316-318)
    - Keep `setFormCurrentPrice(preco)` for visual reference display
    - In `saveAtivo()`, add fallback: if `formData.preco_entrada` is empty and `formCurrentPrice` has value, use `formCurrentPrice` as `preco_entrada` in the payload
    - _Bug_Condition: isBugCondition(input) where input.ativoSelecionadoViaSearch = true AND precoEntradaCampo = precoSpotNoMomentoDaSelecao_
    - _Expected_Behavior: After selectAtivo(), formData.preco_entrada remains empty; spot shown as reference only; fallback applied at submit time_
    - _Preservation: Fallback spot no submit quando campo vazio (Req 3.3); edição pré-preenche com dados salvos (Req 3.2)_
    - _Requirements: 1.1, 2.1, 3.2, 3.3_

  - [x] 3.2 Create Laravel migration to add investimento column to 3 tables
    - Create new migration file: `add_investimento_to_carteiras.php`
    - Add column `investimento` decimal(20,8) nullable after `preco_atual` in `genesis_carteira_mae`
    - Add column `investimento` decimal(20,8) nullable after `preco_atual` in `genesis_carteira_membro`
    - Add column `investimento` decimal(20,8) nullable after `preco_atual` in `genesis_carteira_gemas`
    - _Bug_Condition: isBugCondition(input) where input.investimento != null AND input.investimento > 0_
    - _Expected_Behavior: Column exists and accepts decimal values for investimento_
    - _Preservation: Existing rows get null for investimento (no data loss)_
    - _Requirements: 1.2, 2.2_

  - [x] 3.3 Update 3 Models: add investimento to $fillable and $casts
    - `CarteiraMae.php`: add `'investimento'` to `$fillable` array and `'investimento' => 'decimal:8'` to `$casts`
    - `CarteiraMembro.php`: add `'investimento'` to `$fillable` array and `'investimento' => 'decimal:8'` to `$casts`
    - `CarteiraGemas.php`: add `'investimento'` to `$fillable` array and `'investimento' => 'decimal:8'` to `$casts`
    - _Bug_Condition: Mass assignment ignores investimento field without fillable entry_
    - _Expected_Behavior: Model accepts and casts investimento on create/update_
    - _Preservation: Existing fillable fields unchanged; other casts unchanged_
    - _Requirements: 1.2, 2.2_

  - [x] 3.4 Update StoreCarteiraRequest: add investimento validation rule
    - Add `'investimento' => 'nullable|numeric'` to the rules array in `StoreCarteiraRequest.php`
    - _Bug_Condition: Field stripped by FormRequest when not in validation rules_
    - _Expected_Behavior: investimento accepted and validated as nullable numeric_
    - _Preservation: All existing validation rules unchanged_
    - _Requirements: 1.2, 2.2_

  - [x] 3.5 Update UpdateCarteiraRequest: add investimento validation rule
    - Add `'investimento' => 'nullable|numeric'` to the rules array in `UpdateCarteiraRequest.php`
    - _Bug_Condition: Field stripped by FormRequest when not in validation rules_
    - _Expected_Behavior: investimento accepted on update and validated as nullable numeric_
    - _Preservation: All existing validation rules unchanged_
    - _Requirements: 1.2, 2.2_

  - [x] 3.6 Update 3 Transformers: add investimento to response
    - `CarteiraMaeTransformer.php`: add `'investimento' => $item->investimento ? (float) $item->investimento : null`
    - `CarteiraMembroTransformer.php`: add `'investimento' => $item->investimento ? (float) $item->investimento : null`
    - `CarteiraGemasTransformer.php`: add `'investimento' => $item->investimento ? (float) $item->investimento : null`
    - _Bug_Condition: API response omits investimento even if persisted_
    - _Expected_Behavior: API response includes investimento field with correct value_
    - _Preservation: All existing transformer fields unchanged_
    - _Requirements: 1.3, 2.3_

  - [x] 3.7 Verify bug condition exploration test now passes [x] 3.6 Update 3 Transformers: add investimento to response
    - `CarteiraMaeTransformer.php`: add `'investimento' => $item->investimento ? (float) $item->investimento : null`
    - `CarteiraMembroTransformer.php`: add `'investimento' => $item->investimento ? (float) $item->investimento : null`
    - `CarteiraGemasTransformer.php`: add `'investimento' => $item->investimento ? (float) $item->investimento : null`
    - _Bug_Condition: API response omits investimento even if persisted_
    - _Expected_Behavior: API response includes investimento field with correct value_
    - _Preservation: All existing transformer fields unchanged_
    - _Requirements: 1.3, 2.3_

  - [x] 3.9 ~~Create Laravel migration to add alvo_saida column~~ (SKIPPED - columns already exist in all 3 tables)
    - Confirmed via phpMyAdmin: `genesis_carteira_mae`, `genesis_carteira_gemas`, and `genesis_carteira_membro` all have `alvo_saida` column
    - No migration needed

  - [x] 3.10 Update CarteiraMae and CarteiraGemas models: add alvo_saida to $fillable and $casts
    - `CarteiraMae.php`: add `'alvo_saida'` to `$fillable` array and `'alvo_saida' => 'decimal:8'` to `$casts`
    - `CarteiraGemas.php`: add `'alvo_saida'` to `$fillable` array and `'alvo_saida' => 'decimal:8'` to `$casts`
    - Note: `CarteiraMembro.php` already has alvo_saida in fillable/casts
    - _Bug_Condition: Mass assignment ignores alvo_saida field without fillable entry_
    - _Expected_Behavior: Model accepts and casts alvo_saida on create/update_
    - _Preservation: Existing fillable fields unchanged_
    - _Requirements: 1.5, 2.5_

  - [x] 3.11 Update CarteiraMaeTransformer and CarteiraGemasTransformer: add alvo_saida to response
    - `CarteiraMaeTransformer.php`: add `'alvo_saida' => $item->alvo_saida ? (float) $item->alvo_saida : null`
    - `CarteiraGemasTransformer.php`: add `'alvo_saida' => $item->alvo_saida ? (float) $item->alvo_saida : null`
    - Note: `CarteiraMembroTransformer.php` already returns alvo_saida
    - _Bug_Condition: API response omits alvo_saida for carteira_mae and gemas_
    - _Expected_Behavior: API response includes alvo_saida field with correct value_
    - _Preservation: All existing transformer fields unchanged_
    - _Requirements: 1.6, 2.6_

  - [x] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Preço de Entrada Não Auto-Preenchido e Investimento Persistido
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied:
      - `selectAtivo()` no longer auto-fills `preco_entrada`
      - `investimento` is persisted and returned in API response
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Comportamentos Existentes Não Afetados
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm: fallback spot on submit works, edit pre-fill works, scheduler unchanged, other fields unaffected

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to verify no regressions
  - Verify bug condition test (Property 1) passes
  - Verify preservation tests (Property 2) pass
  - Ensure migration can be rolled back cleanly
  - Ask the user if questions arise
