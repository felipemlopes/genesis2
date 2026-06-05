# Bugfix Requirements Document

## Introduction

Ao adicionar uma criptomoeda na carteira (portfolio), o "valor de entrada" (preco_entrada) informado pelo usuário é sobrescrito pelo preço spot atual da moeda, e o "valor do investimento" (investimento) não é persistido nem exibido corretamente. Isso ocorre por duas falhas distintas:

1. O frontend pré-preenche automaticamente o campo `preco_entrada` com o preço de mercado ao selecionar o ativo, e esse valor acaba sendo persistido mesmo quando o usuário queria informar um preço diferente (compra passada).
2. O campo `investimento` não existe nas tabelas do banco de dados (confirmado via migrations do Laravel: `genesis_carteira_mae`, `genesis_carteira_membro`, `genesis_carteira_gemas` — nenhuma possui coluna `investimento`), e o backend não inclui esse campo no INSERT/UPDATE.
3. O campo `alvo_saida` não existe nas tabelas `genesis_carteira_mae` e `genesis_carteira_gemas` (só existe em `genesis_carteira_membro`). O frontend envia `alvo_saida` no payload para todas as carteiras, mas o dado é silenciosamente ignorado nas tabelas que não possuem a coluna. A coluna "PROGRESSO/ALVO" na listagem fica vazia.

**Nota:** O campo `preco_atual` é `nullable` e atualizado periodicamente pelo command `carteira:monitorar-mae` (scheduler Laravel). Ele estar NULL após criação é comportamento esperado até o scheduler executar o primeiro ciclo — não é bug de código.

O impacto é que o usuário perde a informação real de quanto pagou e quanto investiu, tornando os cálculos de lucro/prejuízo da carteira incorretos.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN o usuário seleciona um ativo no formulário de adicionar à carteira THEN o sistema auto-preenche o campo `preco_entrada` com o preço spot atual, sobrescrevendo silenciosamente qualquer intenção do usuário de informar um preço de compra diferente

1.2 WHEN o usuário informa um valor no campo "Investimento ($)" e salva o ativo THEN o sistema NÃO persiste o valor de investimento no banco de dados (campo `investimento` não existe nas tabelas `genesis_carteira_mae`, `genesis_carteira_membro`, `genesis_carteira_gemas` — confirmado pelas migrations do Laravel)

1.3 WHEN a carteira é carregada após salvar um ativo com investimento informado THEN o sistema exibe "–" ou vazio na coluna "Investimento" porque o valor não existe no banco

1.4 WHEN o ativo é salvo com o preco_entrada auto-preenchido pelo spot THEN os cálculos de variação (P/L%) são baseados no preço de mercado no momento da adição ao invés do preço real de compra do usuário

1.5 WHEN o usuário informa um valor no campo "ALVO ($)" na Carteira Mãe ou Carteira de Gemas e salva THEN o sistema NÃO persiste o valor de `alvo_saida` no banco de dados (coluna não existe em `genesis_carteira_mae` nem `genesis_carteira_gemas` — só existe em `genesis_carteira_membro`)

1.6 WHEN a carteira é carregada após salvar um ativo com alvo_saida informado THEN a coluna "PROGRESSO/ALVO" exibe "–" porque o valor retornado é null

### Expected Behavior (Correct)

2.1 WHEN o usuário seleciona um ativo no formulário THEN o sistema SHALL exibir o preço spot atual apenas como referência visual (label informativa), sem preencher automaticamente o campo `preco_entrada`, permitindo que o usuário informe livremente o preço de compra real

2.2 WHEN o usuário informa um valor no campo "Investimento ($)" e salva o ativo THEN o sistema SHALL persistir o campo `investimento` no banco de dados (nova coluna decimal nas 3 tabelas de carteira + backend incluir no INSERT/UPDATE)

2.3 WHEN a carteira é carregada após salvar um ativo com investimento informado THEN o sistema SHALL exibir corretamente o valor de investimento na coluna "Investimento" da tabela

2.4 WHEN o ativo é salvo com o preco_entrada informado pelo usuário THEN os cálculos de variação (P/L%) SHALL ser baseados no preço de entrada real informado pelo usuário

2.5 WHEN o usuário informa um valor no campo "ALVO ($)" em qualquer carteira e salva THEN o sistema SHALL persistir o campo `alvo_saida` no banco de dados (nova coluna nas tabelas `genesis_carteira_mae` e `genesis_carteira_gemas` + backend incluir no INSERT/UPDATE/Transform)

2.6 WHEN a carteira é carregada após salvar um ativo com alvo_saida informado THEN a coluna "PROGRESSO/ALVO" SHALL exibir corretamente o progresso em relação ao alvo

### Unchanged Behavior (Regression Prevention)

3.1 WHEN o preço spot é buscado periodicamente pelo command `carteira:monitorar-mae` THEN o sistema SHALL CONTINUE TO atualizar apenas o campo `preco_atual` sem alterar o `preco_entrada` salvo

3.2 WHEN o usuário edita um ativo existente THEN o sistema SHALL CONTINUE TO pré-preencher o formulário com os dados salvos (incluindo preco_entrada original)

3.3 WHEN o usuário adiciona um ativo e NÃO informa um preço de entrada manualmente (campo vazio) THEN o sistema SHALL CONTINUE TO usar o preço spot como fallback para preco_entrada (manter comportamento de conveniência, mas agora opt-in ao invés de auto-preenchido)

3.4 WHEN o resumo financeiro é calculado (Total Investido, Valor Atual, Lucro/Prejuízo) THEN o sistema SHALL CONTINUE TO usar os valores corretos de preco_entrada como base para os cálculos

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type CarteiraFormSubmission
  OUTPUT: boolean
  
  // Bug 1: preco_entrada sobrescrito pelo spot no momento da seleção
  LET spotOverwrite = (X.ativoSelecionadoViaSearch = true 
                       AND X.precoEntradaCampo = X.precoSpotNoMomentoDaSelecao)
  
  // Bug 2: investimento informado mas não persistido (coluna inexistente)
  LET investimentoLost = (X.investimento != null AND X.investimento > 0)
  
  // Bug 3: alvo_saida informado mas não persistido em carteira_mae/gemas
  LET alvoSaidaLost = (X.alvo_saida != null AND X.alvo_saida > 0 
                        AND X.tipoCarteira IN ['MAE', 'GEMAS'])
  
  RETURN spotOverwrite OR investimentoLost OR alvoSaidaLost
END FUNCTION
```

```pascal
// Property: Fix Checking - Preço de Entrada preservado
FOR ALL X WHERE X.ativoSelecionadoViaSearch = true DO
  result ← saveAtivo'(X)
  IF X.precoEntradaInformadoPeloUsuario != null THEN
    ASSERT result.preco_entrada = X.precoEntradaInformadoPeloUsuario
  ELSE
    ASSERT result.preco_entrada = X.precoSpotAtual  // fallback quando vazio
  END IF
END FOR
```

```pascal
// Property: Fix Checking - Investimento persistido
FOR ALL X WHERE X.investimento != null AND X.investimento > 0 DO
  result ← saveAtivo'(X)
  stored ← fetchAtivo(result.id)
  ASSERT stored.investimento = X.investimento
END FOR
```

```pascal
// Property: Preservation Checking - preco_atual não afetado
FOR ALL ativos A WHERE A.status = 'ATIVO' DO
  AFTER executarCicloMonitoramento()
  ASSERT A.preco_entrada = A.preco_entrada_antes_do_ciclo
  // preco_atual pode mudar, preco_entrada nunca
END FOR
```

```pascal
// Property: Fix Checking - alvo_saida persistido em carteira_mae e gemas
FOR ALL X WHERE X.alvo_saida != null AND X.alvo_saida > 0 AND X.tipoCarteira IN ['MAE', 'GEMAS'] DO
  result ← saveAtivo'(X)
  stored ← fetchAtivo(result.id)
  ASSERT stored.alvo_saida = X.alvo_saida
END FOR
```

---

## Root Cause Summary

| # | Bug | Local | Causa-raiz |
|---|-----|-------|------------|
| 1 | preco_entrada sobrescrito | Frontend (`CarteiraCripto.tsx` → `selectAtivo()`) | Auto-preenche preco_entrada com preço spot ao selecionar ativo |
| 2 | investimento não salvo | Backend + DB (migrations Laravel) | Coluna `investimento` não existe nas 3 tabelas de carteira; backend não inclui no payload |
| 3 | alvo_saida não salvo (Carteira Mãe e Gemas) | DB (migrations Laravel) | Coluna `alvo_saida` só existe em `genesis_carteira_membro`; falta nas tabelas `mae` e `gemas`; `CarteiraMaeTransformer` e `CarteiraGemasTransformer` não retornam o campo |

## Files Involved

**Frontend:**
- `components/CarteiraCripto.tsx` (ou equivalente) — função `selectAtivo()` que auto-preenche o campo

**Backend (genesis-api):**
- `app/Http/Requests/Api/Carteira/StoreCarteiraRequest.php` — validação do store
- `app/Http/Requests/Api/Carteira/UpdateCarteiraRequest.php` — validação do update
- `app/Models/CarteiraMae.php` — fillable/casts
- `app/Models/CarteiraMembro.php` — fillable/casts
- `app/Models/CarteiraGemas.php` — fillable/casts
- `app/Transformers/CarteiraMaeTransformer.php` — serialização da resposta
- `app/Transformers/CarteiraMembroTransformer.php`
- `app/Transformers/CarteiraGemasTransformer.php`

**Migrations necessárias:**
- Nova migration: `add_investimento_to_carteiras` — adiciona coluna `investimento` decimal(20,8) nullable nas 3 tabelas
- Nova migration: `add_alvo_saida_to_carteira_mae_and_gemas` — adiciona coluna `alvo_saida` decimal(20,8) nullable em `genesis_carteira_mae` e `genesis_carteira_gemas`
