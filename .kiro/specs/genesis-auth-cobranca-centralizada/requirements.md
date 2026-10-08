# Requisitos: cobrança centralizada no `[AUTH]` + página de compra de créditos na v2

**Status**: planejamento (07/10/2026). Nada executado. Pedido do Felipe: "criar página de compra de
pacotes de créditos na v2. O pacote de planos vai centralizar tudo no auth e o registro de compras
também. A v1 tem que utilizar esses mesmos endpoints do auth. Deve manter o split no Asaas."

## Situação atual (levantada no código em 07/10/2026)

| Onde | O que existe |
|---|---|
| `[AUTH]` (`auth genesis`) | `GET /api/packages` (público, filtro `?client=`), `POST /api/checkout/card` e `/api/checkout/pix` (Sanctum), webhook `POST /api/webhooks/asaas` que credita na carteira do `[AUTH]`. Tabelas `plans` (com `client`, `popular`) e `subscriptions`. Split já portado (`CheckoutController`). **Nenhum frontend chama isso hoje.** |
| `[API v1]` / `[API v2]` | Cada uma tem a sua cópia: `GET /plans`, `POST /subscription/checkout` e `/subscription/pix` (`AuthController::store()/pix()`), tabelas `plans`/`subscriptions` próprias, split com `setting('asaas_percent')`/`setting('asaas_fee')`. As rotas de webhook Asaas/LastLink das duas estão comentadas (o webhook já é do `[AUTH]`). |
| `[FE v1]` | `components/SubscriptionPage.tsx` chama `/plans`, `/subscription/pix`, `/subscription/checkout` da `[API v1]`. |
| `[FE v2]` | **Não tem página de compra.** Saldo já vem do `[AUTH]` (`services/api.ts`, `/credits/balance`). |

### Problemas encontrados que a spec precisa resolver

1. **Cobrança em três lugares e crédito em um.** As cobranças criadas pela v1/v2 gravam
   `subscriptions` no banco da própria API, mas o webhook que credita roda no `[AUTH]` e procura a
   cobrança em `subscriptions` **do `[AUTH]`**. **Confirmado na Fase 0**: a única compra feita pela
   v1 depois do corte (02/10, PLANO 3, R$ 162) não foi creditada pelo webhook; alguém creditou à
   mão 8 horas depois ("Compra pacote R$162 (crédito manual)"). Toda compra nova pela v1 hoje
   depende de crédito manual.
2. **Preço mostrado ≠ preço cobrado.** O `SubscriptionPage.tsx` da v1 converte USD→BRL com a
   cotação do dia (awesomeapi) e o backend cobra `price × 5.40` fixo.
3. **Taxa fixa do Asaas tratada como percentual.** `asaas_fee = 0.49` (R$ 0,49 por cobrança) entra
   no cálculo como `price × 0.49 / 100`. Isso muda o valor do split. **Decisão D2: manter assim.**
4. **Webhook Asaas sem token aceita qualquer chamada** (decisão de 21/09: `ASAAS_WEBHOOK_TOKEN`
   vazio deixa passar). Com a cobrança toda no `[AUTH]`, quem conseguir um `payment.id` pendente
   credita sem pagar.
5. **Dados de cartão passam pelo nosso servidor** (número e CVV vão do front para a API e daí para o
   Asaas).
6. **Sem registro de compra de verdade**: `subscriptions` não guarda valor cobrado, forma de
   pagamento, split, status, origem (v1/v2) nem datas de pagamento/estorno.

## Glossário

- **Pacote**: item do catálogo (`plans`): nome, créditos, preço.
- **Compra**: uma tentativa de pagamento de um pacote por um membro, com uma cobrança no Asaas.
- **Split**: parte do valor repassada pelo próprio Asaas para a carteira `ASAAS_WALLETID`.
- **client**: origem da compra, `v1` ou `v2`.

## Requisitos

### R1. Catálogo único no `[AUTH]`
1. O `[AUTH]` é a única fonte de pacotes. v1 e v2 listam pacotes só por `GET /api/packages`.
2. Cada pacote pode valer para as duas versões (`client` nulo) ou só para uma (`v1`/`v2`).
3. Pacote pode ser desativado sem ser apagado (compras antigas continuam apontando para ele).
4. O preço exibido é o preço cobrado, em reais, calculado no servidor (ver D1).

### R2. Checkout único no `[AUTH]`
1. v1 e v2 criam cobrança só por `POST /api/checkout/pix` e `POST /api/checkout/card` do `[AUTH]`,
   com o token de login do `[AUTH]` que os dois frontends já usam.
2. O pedido informa o pacote e a origem (`client`). O `[AUTH]` recusa pacote inativo ou de outra
   versão.
3. O valor é calculado no servidor. Nada de preço vindo do front.
4. Pedido repetido (duplo clique, reenvio) não gera duas cobranças: chave de idempotência.
5. PIX devolve QR code, copia-e-cola, validade e o id da compra.
6. Cartão devolve o resultado (aprovado/recusado/em análise) e o id da compra.

### R3. Split no Asaas mantido
1. Toda cobrança leva `split` para `ASAAS_WALLETID` com a mesma regra de hoje, sem alterar a
   fórmula (D2): `liquido = valor − valor×1,99% − valor×0,49%`, `split = round(liquido × 20%, 2)`.
2. Percentual do split e taxas ficam em configuração (`config/genesis.php`/`.env`), não no código.
3. O valor do split enviado fica gravado na compra.
4. Sem `ASAAS_WALLETID` configurado, o checkout **não cria cobrança** (erro claro no log, 503 ao
   membro), para nunca cobrar sem split.

### R4. Registro de compras no `[AUTH]`
1. Cada compra grava: membro, pacote, créditos, valor cobrado (R$), split (carteira e valor),
   forma de pagamento, `client`, id da cobrança no Asaas, referência externa, status, datas de
   criação/pagamento/estorno.
2. Status: `pending`, `paid`, `refunded`, `failed`, `expired`.
3. O membro vê o próprio histórico (`GET /api/purchases`) e o status de uma compra
   (`GET /api/purchases/{id}`), usado para acompanhar o PIX.
4. Tabelas antigas de v1/v2 não são apagadas (regra do Felipe: param de ser usadas, não somem).
5. Cada compra guarda o pacote como era no momento da compra: id, nome, créditos e preço (D7).
   Mudar ou desativar o pacote depois não altera o pedido.
6. O histórico antigo (`subscriptions` do `[AUTH]` e da v1) é copiado para `credit_purchases`,
   marcado com a origem, sem duplicar e sem mexer em saldo (D7).

### R5. Crédito pelo webhook, uma vez só
1. `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` creditam os créditos do pacote uma única vez, mesmo com
   webhook repetido ou concorrente (trava na linha da compra + transição de status).
2. `PAYMENT_REFUNDED` (e chargeback) retira os créditos uma única vez e marca `refunded`.
3. `PAYMENT_OVERDUE`/expiração do PIX marca `expired`, sem crédito.
4. Webhook só é aceito com `asaas-access-token` válido (ver D4).
5. Evento de cobrança que não é nossa é ignorado com 200 (para o Asaas não reenviar).

### R6. Página de compra na v2
1. Nova página "Comprar créditos" no `[FE v2]`, acessível pelo menu e pelo aviso de saldo
   insuficiente.
2. Lista pacotes do `[AUTH]` (`?client=v2`), destaca o `popular`, mostra preço em R$ e créditos.
3. PIX: mostra QR e copia-e-cola, acompanha o status e atualiza o saldo quando pagar.
4. Cartão: formulário com os mesmos campos de hoje da v1 (ver D5).
5. Histórico de compras do membro.
6. Visual no padrão da v2.

### R7. v1 usando o `[AUTH]`
1. `SubscriptionPage.tsx` passa a chamar `/api/packages?client=v1`, `/api/checkout/*` e
   `/api/purchases` do `[AUTH]`.
2. Remove a cotação do dólar no front (preço vem pronto em R$).
3. As rotas `/plans` e `/subscription/*` das APIs v1/v2 são desligadas depois do corte (Fase 7).

### R8. Administração dos pacotes
1. Admin cria, edita e desativa pacotes no `[AUTH]` (ver D6 sobre qual painel).
2. Admin consulta compras (filtro por membro, status, `client`, período).

## Decisões (respondidas pelo Felipe em 07/10/2026, Fase 0)

| # | Pergunta | Decisão |
|---|---|---|
| D1 | Preço do pacote | **Preço em R$ no pacote** (`price_brl`). Sem cotação no front nem no servidor. |
| D2 | `asaas_fee` (0,49) no cálculo do split | **Manter idêntico a hoje**: `valor × 1,99% + valor × 0,49%` como custo Asaas, split = 20% do restante. Só muda de lugar (vai para o `[AUTH]`). |
| D3 | Saldo | **Saldo único** por membro, valendo na v1 e na v2 (como já é no `[AUTH]`). Pacote pode ser exclusivo de uma versão pelo `client`. |
| D4 | Token do webhook Asaas | **Exigir token** no corte (reverte a decisão de 21/09). |
| D5 | Cartão | **Manter o fluxo atual** (formulário próprio → `[AUTH]` → Asaas, sem logar cartão). |
| D6 | Admin dos pacotes | **Endpoints admin no `[AUTH]` agora**; tela no painel depois. Até lá, cadastro por comando. |
| D7 | Histórico antigo | **Copiar para o `[AUTH]`**: compras antigas entram em `credit_purchases`, e todo pedido (novo ou importado) guarda o pacote comprado (id + nome + créditos + preço no momento da compra). |
| D8 | Pacotes reais | Levantados nos dumps de 05/10 (ver `tasks.md`, 0.2): os mesmos 4 pacotes em v1 e `[AUTH]`; v2 não tem nenhum. |
