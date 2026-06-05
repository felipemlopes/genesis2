# Portfolio Entry Values Fix — Bugfix Design

## Overview

Dois bugs impedem o rastreio correto de preço de entrada e investimento na carteira de criptomoedas:
1. O frontend (`selectAtivo()`) auto-preenche `preco_entrada` com o preço spot ao selecionar o ativo, removendo a possibilidade de o usuário informar um preço diferente.
2. O campo `investimento` não é persistido porque a coluna não existe nas tabelas do banco e o backend não inclui o campo no pipeline de store/update/transform.

A correção envolve alterar o frontend para exibir o spot apenas como referência (sem auto-fill), criar uma migration adicionando a coluna `investimento` nas 3 tabelas, e atualizar models/requests/transformers do Laravel.

## Glossary

- **Bug_Condition (C)**: Condição que dispara o defeito — selecionar um ativo (auto-fill do spot) ou enviar investimento no payload
- **Property (P)**: Comportamento esperado — `preco_entrada` reflete valor digitado pelo usuário; `investimento` é persistido e retornado pela API
- **Preservation**: Comportamento que não deve mudar — scheduler `carteira:monitorar-mae` atualiza apenas `preco_atual`; edição pré-preenche formulário com dados salvos; fallback spot quando campo vazio
- **selectAtivo()**: Função em `CarteiraCripto.tsx` (linha 310) que busca preço spot e atualmente o insere no campo `preco_entrada`
- **CarteiraMae / CarteiraMembro / CarteiraGemas**: Models Eloquent mapeando as 3 tabelas de carteira
- **Transformers**: Classes Fractal que serializam a resposta JSON da API

## Bug Details

### Bug Condition

O bug se manifesta em dois cenários independentes:

1. Quando o usuário seleciona um ativo via busca, `selectAtivo()` chama `buscarPrecoSpot()` e, se `preco_entrada` estiver vazio, preenche o campo com o preço spot. Para novos registros o campo sempre está vazio, então o spot é sempre inserido.
2. Quando o usuário informa um valor de investimento e salva, o frontend envia `investimento` no payload, mas o backend ignora esse campo (não existe na validation, no fillable, nem na tabela).

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type CarteiraFormSubmission
  OUTPUT: boolean

  LET spotAutoFilled = (input.ativoSelecionadoViaSearch = true
                        AND input.precoEntradaCampo = input.precoSpotNoMomentoDaSelecao
                        AND input.precoEntradaDigitadoPeloUsuario = null)

  LET investimentoNotPersisted = (input.investimento != null
                                  AND input.investimento > 0)

  RETURN spotAutoFilled OR investimentoNotPersisted
END FUNCTION
```

### Examples

- Usuário seleciona BTC, spot = $67,500. Campo `preco_entrada` é preenchido com 67500 automaticamente. Usuário queria informar $65,000 (compra de ontem). **Atual:** salva 67500. **Esperado:** campo vazio, usuário digita 65000.
- Usuário preenche "Investimento: $500" e salva. **Atual:** API retorna `investimento: null`, coluna não existe. **Esperado:** API retorna `investimento: 500.00`.
- Usuário seleciona ETH, spot = $3,800. Não digita nada em preco_entrada e salva. **Atual e Esperado (fallback):** salva 3800 como preco_entrada (comportamento de conveniência mantido no submit, não no auto-fill).
- Usuário edita ativo existente com `preco_entrada = 2.50`. **Atual e Esperado:** formulário pré-preenche com 2.50.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- O scheduler `carteira:monitorar-mae` continua atualizando apenas `preco_atual` sem tocar em `preco_entrada`
- Edição de ativo existente pré-preenche o formulário com os dados já salvos (incluindo `preco_entrada` original)
- Cálculos de P/L% continuam usando `preco_entrada` como base e `preco_atual` como valor corrente
- Mouse clicks e interações com o formulário (corretora, tipo, alvos) continuam funcionando normalmente
- Busca de ativos e exibição de resultados na lista dropdown continuam inalterados

**Scope:**
Todas as interações que NÃO envolvem a seleção de ativo ou o campo investimento devem ser completamente inalteradas. Isso inclui:
- Salvamento de outros campos (corretora, tipo, alvos, observações)
- Listagem e filtros da carteira
- Gráficos e resumo financeiro (exceto que agora terão dados de investimento corretos)
- Venda de ativos e alteração de status

## Hypothesized Root Cause

Based on code analysis, the confirmed root causes are:

1. **Auto-fill no selectAtivo()** (CarteiraCripto.tsx:316-318): A condição `if (preco && !formData.preco_entrada)` faz com que o campo seja preenchido automaticamente com o spot ao selecionar qualquer ativo. Como o form é resetado antes da seleção (campo vazio), o preço spot sempre é inserido.

2. **Coluna `investimento` inexistente**: As migrations `create_genesis_carteira_mae_table`, `create_genesis_carteira_membro_table`, e `create_genesis_carteira_gemas_table` não definem a coluna `investimento`. O campo não está em `$fillable` de nenhum model, não está nas rules de `StoreCarteiraRequest`/`UpdateCarteiraRequest`, e não está nos transformers.

3. **Pipeline backend incompleto**: Mesmo que a coluna existisse, o backend rejeita silenciosamente o campo porque:
   - Não está nas validation rules → é stripped pelo FormRequest
   - Não está no `$fillable` → mass assignment o ignora
   - Não está no transformer → não seria retornado na response

## Correctness Properties

Property 1: Bug Condition - Preço de Entrada Não Auto-Preenchido

_For any_ seleção de ativo via busca no formulário, a função `selectAtivo()` SHALL NOT preencher automaticamente o campo `preco_entrada` com o preço spot. O preço spot será exibido apenas como referência visual (state separado `formCurrentPrice`), e o campo `preco_entrada` permanecerá vazio até o usuário digitar manualmente.

**Validates: Requirements 2.1**

Property 2: Bug Condition - Investimento Persistido

_For any_ payload de criação ou atualização que contenha `investimento` com valor numérico > 0, o backend SHALL persistir o valor na coluna `investimento` da tabela correspondente e retorná-lo na resposta da API.

**Validates: Requirements 2.2, 2.3**

Property 3: Preservation - Fallback Spot no Submit

_For any_ submissão do formulário onde `preco_entrada` está vazio E existe um preço spot disponível, o frontend SHALL usar o preço spot como fallback no momento do submit (não no momento da seleção), preservando o comportamento de conveniência.

**Validates: Requirements 3.3**

Property 4: Preservation - Scheduler Não Altera preco_entrada

_For any_ execução do command `carteira:monitorar-mae`, o sistema SHALL atualizar apenas `preco_atual` sem modificar `preco_entrada` ou `investimento` de nenhum ativo.

**Validates: Requirements 3.1**

## Fix Implementation

### Changes Required

**File**: `G-nesis-2.0-main/components/CarteiraCripto.tsx`

**Function**: `selectAtivo()`

**Specific Changes**:
1. **Remover auto-fill de preco_entrada**: Eliminar as linhas 316-318 que fazem `setFormData(prev => ({ ...prev, preco_entrada: preco.toString() }))`. Manter apenas `setFormCurrentPrice(preco)` para exibição como referência.

2. **Adicionar fallback no submit**: Na função `saveAtivo()`, antes de montar o payload, se `formData.preco_entrada` estiver vazio e `formCurrentPrice` tiver valor, usar `formCurrentPrice` como fallback.

---

**File**: `genesis-api/database/migrations/xxxx_add_investimento_to_carteiras.php` (nova)

**Specific Changes**:
3. **Nova migration**: Adicionar coluna `investimento` decimal(20,8) nullable nas 3 tabelas (`genesis_carteira_mae`, `genesis_carteira_membro`, `genesis_carteira_gemas`), após a coluna `preco_atual`.

---

**File**: `genesis-api/app/Models/CarteiraMae.php`, `CarteiraMembro.php`, `CarteiraGemas.php`

**Specific Changes**:
4. **Adicionar `investimento` ao $fillable** dos 3 models.
5. **Adicionar cast** `'investimento' => 'decimal:8'` nos 3 models.

---

**File**: `genesis-api/app/Http/Requests/Api/Carteira/StoreCarteiraRequest.php`

**Specific Changes**:
6. **Adicionar rule**: `'investimento' => 'nullable|numeric'`

**File**: `genesis-api/app/Http/Requests/Api/Carteira/UpdateCarteiraRequest.php`

**Specific Changes**:
7. **Adicionar rule**: `'investimento' => 'nullable|numeric'`

---

**File**: `genesis-api/app/Transformers/CarteiraMaeTransformer.php`, `CarteiraMembroTransformer.php`, `CarteiraGemasTransformer.php`

**Specific Changes**:
8. **Adicionar campo na response**: `'investimento' => $item->investimento ? (float) $item->investimento : null`

## Testing Strategy

### Validation Approach

A estratégia segue duas fases: primeiro, demonstrar os bugs no código atual (counterexamples), depois verificar que a correção funciona e não quebra nada.

### Exploratory Bug Condition Checking

**Goal**: Demonstrar os bugs no código não-corrigido para confirmar a análise de root cause.

**Test Plan**: Exercitar o fluxo de seleção de ativo e submissão com investimento no código atual.

**Test Cases**:
1. **Auto-fill Test**: Chamar `selectAtivo('BTC', 'Bitcoin')` com `preco_entrada` vazio → verificar que o campo é preenchido com spot (falha esperada no código atual)
2. **Investimento Store Test**: POST `/api/carteira` com `investimento: 500` → verificar que o campo NÃO é retornado na response (demonstra bug no código atual)
3. **Investimento DB Test**: Após POST com investimento, consultar DB diretamente → coluna não existe (demonstra bug)
4. **Edit Pre-fill Test**: GET ativo existente → verificar que `investimento` retorna null mesmo se enviado no POST

**Expected Counterexamples**:
- `selectAtivo()` preenche `preco_entrada` com spot price ao invés de manter vazio
- POST com `investimento` retorna `null` na response (campo ignorado)
- Coluna `investimento` não existe na tabela (SQL error se tentasse query direta)

### Fix Checking

**Goal**: Verificar que para todos os inputs onde a bug condition se aplica, o código corrigido produz o comportamento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  // Bug 1: selectAtivo não auto-preenche
  AFTER selectAtivo(input.symbol, input.name)
  ASSERT formData.preco_entrada = '' (campo permanece vazio)
  ASSERT formCurrentPrice = spotPrice (referência visual disponível)

  // Bug 2: investimento persistido
  result := POST /api/carteira (input com investimento)
  stored := SELECT investimento FROM tabela WHERE id = result.id
  ASSERT stored.investimento = input.investimento
  ASSERT result.response.investimento = input.investimento
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos os inputs onde a bug condition NÃO se aplica, o código corrigido produz o mesmo resultado que o original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT saveAtivo_original(input) = saveAtivo_fixed(input)
END FOR
```

**Testing Approach**: Testes manuais e automatizados para garantir que:
- Salvamento sem investimento continua funcionando
- Edição de ativos existentes pré-preenche corretamente
- Scheduler não toca em preco_entrada nem investimento
- Cálculos de P/L% continuam corretos

**Test Cases**:
1. **Fallback Preservation**: Submeter formulário com `preco_entrada` vazio → sistema usa spot como fallback (mesma conveniência de antes, agora no submit)
2. **Edit Pre-fill Preservation**: Editar ativo com `preco_entrada = 2.50` → formulário pré-preenche com 2.50
3. **Scheduler Preservation**: Executar `carteira:monitorar-mae` → apenas `preco_atual` é atualizado
4. **Other Fields Preservation**: Salvar ativo com corretora/tipo/alvos → todos persistidos normalmente

### Unit Tests

- Testar `selectAtivo()` não preenche `preco_entrada` (React component test)
- Testar `saveAtivo()` usa fallback spot quando preco_entrada vazio
- Testar que StoreCarteiraRequest valida e aceita campo `investimento`
- Testar que Models permitem mass-assignment de `investimento`
- Testar que Transformers retornam `investimento` na response

### Property-Based Tests

- Gerar payloads aleatórios com investimento numérico → verificar persistência e retorno correto
- Gerar cenários de seleção de ativo → verificar que preco_entrada nunca é auto-preenchido
- Gerar inputs sem investimento → verificar que comportamento existente é preservado

### Integration Tests

- Fluxo completo: selecionar ativo → informar preco_entrada manual → informar investimento → salvar → verificar listagem exibe valores corretos
- Fluxo fallback: selecionar ativo → NÃO informar preco_entrada → salvar → verificar que spot foi usado como fallback
- Fluxo edição: criar ativo → editar → verificar pré-preenchimento correto de preco_entrada e investimento
