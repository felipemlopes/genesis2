# Design: cobrança centralizada no `[AUTH]`

## Visão geral

```
[FE v1] ──┐                      ┌──> Asaas (cobrança + split p/ ASAAS_WALLETID)
          ├──> [AUTH] /api/packages, /api/checkout/*, /api/purchases
[FE v2] ──┘          │                      │
                     │   <── webhook ───────┘  /api/webhooks/asaas (token obrigatório)
                     └──> credit_purchases + carteira do membro (bavix wallet)

[API v1] / [API v2]: /plans e /subscription/* desligadas após o corte. Tabelas mantidas.
```

O `[AUTH]` já tem catálogo, checkout e webhook. O trabalho é transformar isso em fonte única:
registro de compra completo, preço em R$, split configurável, crédito idempotente e os dois
frontends chamando só ele.

## Dados

### `plans` (alterar)
| Coluna nova | Tipo | Uso |
|---|---|---|
| `price_brl` | decimal(10,2) null | Preço cobrado (D1). Enquanto nulo, cai em `price × GENESIS_USD_RATE`. |
| `active` | boolean default true | Some do catálogo sem apagar. |
| `sort_order` | integer default 0 | Ordem na tela. |

`price`, `price_per_credit`, `client`, `popular` continuam.

### `credit_purchases` (nova)
| Coluna | Tipo |
|---|---|
| `id` | bigint |
| `uuid` | uuid único (id exposto ao front) |
| `user_id` | fk users |
| `plan_id` | fk plans (restrict, não cascade) |
| `plan_name` | string (cópia do nome do pacote no momento da compra, D7) |
| `client` | string(10): `v1`/`v2`/null (null = histórico sem origem conhecida) |
| `source` | string(20): `checkout` (novo), `legacy_auth`, `legacy_v1` |
| `legacy_subscription_id` | bigint null (id na tabela de origem; único junto com `source`) |
| `credits` | integer (cópia do pacote no momento da compra) |
| `amount` | decimal(10,2) (R$ cobrado; no histórico, `price × 5,40` estimado) |
| `billing_type` | `PIX`/`CREDIT_CARD` |
| `split_wallet_id` | string |
| `split_value` | decimal(10,2) |
| `asaas_payment_id` | string único null |
| `external_reference` | string único |
| `idempotency_key` | string único null (por usuário) |
| `status` | `pending`/`paid`/`refunded`/`failed`/`expired` |
| `paid_at`, `refunded_at`, `expired_at` | timestamp null |
| `last_event` | string null (último evento Asaas aplicado) |
| timestamps | |

`subscriptions` do `[AUTH]` fica como está (webhook antigo continua achando cobranças criadas
antes do deploy, ver "Transição").

## Componentes no `[AUTH]`

- **`PricingService`**: `precoDoPacote(Plan)` e `calcularSplit(valor)`. Regra idêntica à de hoje
  (D2): `liquido = valor − (valor × percent/100) − (valor × fee/100)`;
  `split = round(liquido × split_percent/100, 2)`. Config: `GENESIS_ASAAS_PERCENT=1.99`,
  `GENESIS_ASAAS_FEE=0.49`, `GENESIS_SPLIT_PERCENT=20`, `ASAAS_WALLETID`. Lança exceção se a
  carteira estiver vazia.
- **`genesis:purchases:import-legacy`** (D7): lê `subscriptions` do `[AUTH]` e um arquivo exportado
  da `subscriptions` da v1 (com e-mail do membro, para achar o usuário no `[AUTH]`), mapeia o pacote
  pelo nome (v1 `id 1–4` = `[AUTH]` `id 5–8`), grava em `credit_purchases` com `source` e
  `legacy_subscription_id`. Status: `starts_at` preenchido → `paid`; `canceled_at` → `refunded`;
  sem `starts_at` → `expired`. Não credita nada, não mexe em saldo. Rodar duas vezes não duplica.
  Tem `--dry-run`.
- **`CheckoutService`**: cria/reaproveita cliente Asaas (`users.reference`), cria a compra
  `pending` **antes** da chamada ao Asaas (com `external_reference` = `uuid`), chama o Asaas, grava
  `asaas_payment_id`. Falha do Asaas → `failed`. Mesma `idempotency_key` do mesmo usuário devolve
  a compra existente.
- **`PurchaseWebhookHandler`**: localiza por `asaas_payment_id` (ou `externalReference`), dentro de
  transação com `lockForUpdate()`, aplica a transição permitida e credita/estorna na carteira.
  Transições: `pending→paid`, `pending→expired`, `pending→failed`, `paid→refunded`. Qualquer outra
  é ignorada (idempotente).
- **Controllers**:
  - `GET /api/packages?client=` → só `active`, ordenado, com `price_brl` calculado.
  - `POST /api/checkout/pix` `{plan_id, client, cpf}` + header `Idempotency-Key`.
  - `POST /api/checkout/card` `{plan_id, client, cartão, titular}` + `Idempotency-Key`.
  - `GET /api/purchases` (paginado, do próprio membro).
  - `GET /api/purchases/{uuid}` (status; só do dono).
  - Admin (`auth:sanctum` + admin): `GET/POST/PUT /api/admin/packages`, `GET /api/admin/purchases`.
- **Webhook**: `LastLinkWebhookController::asaas()` passa a delegar ao `PurchaseWebhookHandler`
  e só cai no fluxo antigo de `subscriptions` se não achar a compra nova.
- **`VerifyAsaasToken`**: volta a exigir token (D4), com uma flag
  `ASAAS_WEBHOOK_TOKEN_REQUIRED` para ligar no momento do corte.

### Respostas

Contrato implementado na Fase 3:

```jsonc
// GET /api/packages?client=v2
[{ "id": 7, "name": "PLANO 3", "credits": 8000, "price": "30.00", "price_brl": "162.00",
   "price_per_credit": "0.0087", "popular": true, "client": null }]

// POST /api/checkout/pix   { plan_id, client: "v1"|"v2", cpf }   + header Idempotency-Key
// → 201 (200 se a chave já existia)
{ "purchase_id": "uuid", "status": "pending", "plan_id": 7, "plan_name": "PLANO 3",
  "credits": 8000, "amount": "162.00", "billing_type": "PIX", "client": "v2",
  "created_at": "...", "paid_at": null, "refunded_at": null, "expired_at": null,
  "approved": false,
  "pix": { "qr_code": "...", "qr_code_base64": "...", "expires_at": "..." } }

// POST /api/checkout/card  { plan_id, client, cpf, card_*, phone, cep, street, number,
//                            complement?, neighborhood, city, state }
// → mesmo corpo, sem "pix"; "approved": true quando o Asaas já confirmou o cartão.
//   "status" continua "pending" até o webhook (único lugar que credita).

// GET /api/purchases          → { "data": [ ...compra... ], "links": {...}, "meta": {...} }
// GET /api/purchases/{uuid}   → { "data": { ...compra... } }
```

Erros: 422 (validação ou cartão recusado; neste caso com `purchase_id` e `status: failed`), 409
(pacote inativo ou de outra versão), 503 (sem carteira de split, ou Asaas fora do ar com a compra
`failed`), 429 (mais de 10 checkouts por minuto). Mensagem genérica para o membro, detalhe só no
log, nunca com dados de cartão.

## Frontends

### `[FE v2]`
- `services/billing.ts`: `listarPacotes()`, `comprarPix()`, `comprarCartao()`, `statusCompra()`,
  `minhasCompras()`, sempre via `authPath()`/`AUTH_API_BASE` e `tokenStorage`.
- `pages/CreditsPage.tsx` (rota `/creditos` em `router/index.tsx`, item no `AppLayout.tsx`):
  grade de pacotes → escolha PIX/cartão → QR com polling de `statusCompra` a cada 5 s por até
  30 min (para ao sair da página) → saldo atualizado. Aba "Minhas compras".
- Aviso de saldo insuficiente ganha botão "Comprar créditos".
- CSP do build (`csp.config.ts`): conferir `connect-src` para o domínio do `[AUTH]` e `img-src`
  com `data:` para o QR.

### `[FE v1]`
- `SubscriptionPage.tsx`: troca as três chamadas para o `[AUTH]` (URL absoluta via
  `AUTH_API_URL`, mesmo padrão de `authPath()`), envia `client: 'v1'`, remove a cotação
  awesomeapi, mostra `price_brl`, faz polling do PIX.

## Transição

1. Deploy do `[AUTH]` com tabelas novas e webhook compatível com as duas origens (compras novas em
   `credit_purchases`, antigas em `subscriptions`).
2. Cadastrar pacotes reais (D8) com `price_brl` e importar o histórico (D7).
3. Ligar v2 (página nova) → validar uma compra PIX real de valor baixo com split conferido no
   painel Asaas.
4. Ligar v1.
5. Ligar `ASAAS_WEBHOOK_TOKEN_REQUIRED` com o token cadastrado no painel Asaas.
6. Desligar `/plans` e `/subscription/*` em v1/v2 (responder 410 com mensagem), sem apagar tabelas.

## Testes

- `[AUTH]` (PHPUnit, sqlite persistente + `DatabaseTransactions`, nunca `RefreshDatabase`):
  cálculo de split (tabela de casos), checkout com Asaas falso (`Http::fake`), idempotência do
  checkout, webhook repetido/concorrente credita uma vez, estorno, token obrigatório, pacote de
  outra versão recusado, sem carteira → 503 sem cobrança.
- `[FE v2]` (vitest): `billing.ts` monta URL/headers certos; polling para em `paid`/`expired`.
- Ponta a ponta em sandbox Asaas (`ASAAS_ENV=sandbox`) antes de produção.
