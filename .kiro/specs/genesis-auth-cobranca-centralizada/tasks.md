# Plano de implementação: cobrança centralizada no `[AUTH]` + compra de créditos na v2

**Status**: planejamento (07/10/2026). Nenhum item executado. Requisitos em `requirements.md`,
desenho em `design.md`. Nenhuma migração ou seed roda sem autorização explícita do Felipe.

Repositórios: `[AUTH]` = `auth genesis` (`master`), `[FE v2]` = este repo (`staging`),
`[FE v1]` = `G-nesis-Labs-Oficial-1` (`main`), `[API v1]` = `genesis-api-v1` (`master`),
`[API v2]` = `genesis-api` (`staging`).

## Fase 0: decisões e levantamento (executada em 07/10/2026)

Fonte: dumps de produção de 05/10 (`Downloads/auth.sql`, `v1.sql`, `v2.sql`), lidos direto do
arquivo, sem importar em banco nenhum.

- [x] 0.1 D1–D8 respondidas (tabela em `requirements.md`).
- [x] 0.2 Pacotes em produção. _R1, D8_

  | Pacote | Créditos | USD | Cobrado hoje (×5,40) | Popular | id v1 | id `[AUTH]` |
  |---|---|---|---|---|---|---|
  | PLANO 1 | 2.000 | 10,00 | R$ 54,00 | | 1 | 5 |
  | PLANO 2 | 4.000 | 18,00 | R$ 97,20 | | 2 | 6 |
  | PLANO 3 | 8.000 | 30,00 | R$ 162,00 | sim | 3 | 7 |
  | PLANO 4 | 20.000 | 60,00 | R$ 324,00 | | 4 | 8 |

  - v1 e `[AUTH]` têm os mesmos 4 pacotes, com ids diferentes. `client` é nulo nos 4 (valem para as
    duas versões).
  - **v2 não tem nenhum pacote** e nenhuma compra (`plans` e `subscriptions` vazias): coerente com a
    falta de página de compra.
  - `price_brl` = o mesmo valor que se cobra hoje (coluna "Cobrado hoje"): **R$ 54,00 / 97,20 /
    162,00 / 324,00**. Confirmado pelo Felipe em 07/10.
- [x] 0.3 Compras depois do corte (10/09). _Problema 1_
  - v1: **1 compra** (02/10, PLANO 3, R$ 162, cobrança `pay_tx1j…`). Na v1 ficou sem pagamento
    registrado, e a cobrança não existe no `[AUTH]`, então o webhook não creditou. No `[AUTH]` há um
    depósito de 8.000 créditos para o mesmo membro às 22h35 do mesmo dia, com a descrição "Compra
    pacote R$162 (crédito manual)". **O membro recebeu, mas por crédito manual.** É o único crédito
    manual de compra no `[AUTH]`.
  - v2: nenhuma compra.
  - `[AUTH]`: 211 compras antigas (11/01 a 31/08, importadas do sistema antigo), 10 delas nunca
    pagas. São o histórico a importar (D7), junto com a compra da v1.
  - **Não verificável daqui**: compras entre 31/08 e 10/09 nos sites antigos (`api`/`testeapi`), e
    se houve pagamento no Asaas sem registro em nenhum banco. Os dois só se fecham olhando o painel
    Asaas (0.4).
- [x] 0.4 Carteira do split: o Felipe configura `ASAAS_WALLETID` no `.env` do `[AUTH]` depois
      (07/10). **Pré-requisito da Fase 9**: sem ela o checkout recusa a cobrança (R3.4), então a 9.3
      não passa sem isso. _R3_
  - Fica em aberto, fora do caminho crítico: cruzar as cobranças recebidas no Asaas desde 31/08
    com os bancos (só o Fabrício tem o painel).
- [x] 0.5 `git status` em 07/10:
  - `[AUTH]` (`master`): 15 arquivos alterados + 4 testes novos, não commitados (correções da spec
    `genesis-seguranca-correcoes`, S1/S10/S11/S14/S15). Tocam `routes/api.php`, `CreditController`,
    `User`, `Cobranca`, que esta spec também altera. **Commitar antes da Fase 1**, para não misturar.
  - `[API v1]` (`master`): 10 arquivos alterados + 5 testes novos, mesma situação (S2/S4/S10/S11/S13/S15).
  - `[API v2]` (`staging`): só `MANIFEST.json` e o backup `.env.antes-teste-fallback` (fica fora).
  - `[FE v1]` (`main`): `README.md` e `components/LandingPage.tsx` alterados.
  - `[FE v2]` (`staging`): só esta spec.

## Fase 1: dados no `[AUTH]` (feita em 07/10/2026, não commitada; migrações só no sqlite de teste)
- [x] 1.1 `2026_10_07_000008_add_catalog_fields_to_plans_table`: `price_brl` (nulo), `active`
      (default true), `sort_order` (default 0). `Plan` com os campos novos e `active` boolean. _R1_
- [x] 1.2 `2026_10_07_000009_create_credit_purchases_table` (ver `design.md`). Únicos:
      `uuid`, `asaas_payment_id`, `external_reference`, (`user_id`, `idempotency_key`),
      (`source`, `legacy_subscription_id`). `plan_id` com `restrictOnDelete`: pacote com compra não
      pode ser apagado (só desativado). _R4_
- [x] 1.3 `App\Models\CreditPurchase`: constantes de status e origem, `uuid`/`status`/`source`
      automáticos na criação, rota por `uuid`, `podeIrPara()` com as transições do design.
- [x] 1.4 `genesis:packages:sync [--rate=5.40] [--dry-run]`: `price_brl = round(price × 5,40, 2)` só
      onde está nulo, e numera `sort_order` por preço se nenhum pacote tiver ordem. Em produção
      resulta em 54,00 / 97,20 / 162,00 / 324,00. **Não rodado** (roda na 9.2, com autorização).
- [x] 1.5 `genesis:purchases:import-legacy [--v1-json=] [--skip-auth] [--paid-ref=*] [--rate=5.40]
      [--dry-run]` (`App\Services\LegacyPurchaseImporter`). Não mexe em saldo, não duplica.
      Status: `canceled_at` → `refunded`; `starts_at` → `paid`; sem `starts_at` → `expired` se tiver
      mais de 3 dias, senão `pending`. `--paid-ref` marca como `paid` cobranças pagas por fora: é o
      caso da compra da v1 de 02/10 (`pay_tx1j597gq1yyw8pq`), creditada à mão. A v1 entra pelo JSON
      do `genesis-auth:convert-legacy-dump v1.sql` (testado contra o dump real de 05/10: 1 compra,
      4 pacotes, e-mail do membro presente). **Não rodado** (roda na 9.2). _R4.5, R4.6_
- [x] 1.6 `tests/Feature/CobrancaFase1Test.php` (14 testes). Suíte completa do `[AUTH]`: 105/105.

**Nota para a Fase 4**: as compras importadas têm `asaas_payment_id` e `source` ≠ `checkout`.
O handler novo do webhook só deve agir em `source = checkout`; para as importadas, segue o fluxo
antigo de `subscriptions` (que já tem a trava `starts_at == null`), para não creditar de novo uma
compra antiga.

## Fase 2: preço e split (feita em 07/10/2026, não commitada)
- [x] 2.1 `App\Services\Billing\PricingService::precoDoPacote()`: `price_brl`, senão
      `price × GENESIS_USD_RATE` (5,40). _R1.4, D1_
- [x] 2.2 `calcularSplit()` com a fórmula antiga intacta (D2): `GENESIS_ASAAS_PERCENT=1.99`,
      `GENESIS_ASAAS_FEE=0.49` (como %), `GENESIS_SPLIT_PERCENT=20`, em `config/genesis.php`. _R3.1, R3.2_
- [x] 2.3 `ASAAS_WALLETID` vazio → `SplitWalletAusente` → checkout responde 503 sem criar compra nem
      chamar o Asaas. _R3.4_
- [x] 2.4 `tests/Feature/PricingServiceTest.php`: os 4 pacotes de produção conferidos centavo por
      centavo contra a fórmula copiada do checkout antigo. Split: R$ 10,53 / 18,96 / 31,60 / 63,19.
- [x] 2.5 `.env.example` com as variáveis novas.

## Fase 3: checkout e registro (feita em 07/10/2026, não commitada)
- [x] 3.1 `App\Services\Billing\CheckoutService`: valida pacote → preço e split → compra `pending`
      com `external_reference` = uuid → cliente Asaas (reaproveita `users.reference`) → cobrança com
      `split` → grava `asaas_payment_id`. **Não credita**: crédito só no webhook (Fase 4). _R2, R4.1_
- [x] 3.2 `CheckoutController::pix()/card()` reescritos sobre o serviço. `client` (`v1`/`v2`)
      obrigatório; header `Idempotency-Key` opcional (mesma chave → mesma compra, sem nova cobrança;
      corrida resolvida pelo índice único). Pacote inativo ou de outra versão → 409. _R2.2–R2.4_
- [x] 3.3 Resposta (`CreditPurchaseResource` + `approved` + `pix`): 201 na criação, 200 na repetição
      por chave; 422 cartão recusado (compra `failed`); 503 Asaas fora do ar (compra `failed`) ou sem
      carteira de split. `approved` = o Asaas já confirmou o cartão; o `status` segue `pending` até o
      webhook. _R2.5, R2.6_
- [x] 3.4 `GET /api/purchases` (paginado, 20) e `GET /api/purchases/{uuid}`; compra de outro membro
      → 404. Resposta nunca leva id sequencial, carteira de split nem chave de idempotência. _R4.3_
- [x] 3.5 `GET /api/packages`: só ativos, por `sort_order`, com `price_brl` calculado. _R1_
- [x] 3.6 Logs do checkout só com ids e status. `S4CartaoNoLogTest` ajustado ao contrato novo
      (`client` + carteira) e passando.
- [x] 3.7 `tests/Feature/CheckoutTest.php` reescrito (13 testes). Extra: limite `throttle:checkout`
      de 10/min por membro, contra teste de cartão em massa.

Suíte completa do `[AUTH]` depois das Fases 1–3: **121/121**.

**Publicar a Fase 3 sempre junto com a Fase 4**: o checkout novo grava em `credit_purchases` e não
cria mais linha em `subscriptions`. Quem credita essas compras é o handler da Fase 4.

## Fase 4: webhook (feita em 07/10/2026, não commitada)
- [x] 4.1 `App\Services\Billing\PurchaseWebhookHandler`: relê a compra com `lockForUpdate` na
      transação e só aplica transição permitida. _R5.1–R5.3_
      - `PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → `paid`: credita os créditos do pedido.
      - `PAYMENT_REFUNDED`/`PAYMENT_CHARGEBACK_REQUESTED` → `refunded`: retira com
        `forceWithdrawFloat`. Se o membro já gastou, o saldo fica negativo, em vez de o estorno
        falhar e o webhook se perder.
      - `PAYMENT_OVERDUE`/`PAYMENT_DELETED` → `expired`.
      - `PAYMENT_REPROVED_BY_RISK_ANALYSIS`/`PAYMENT_CREDIT_CARD_CAPTURE_REFUSED` → `failed`.
      - A transação na carteira leva `purchase_uuid` e a descrição "Compra de créditos - <pacote>".
- [x] 4.2 `asaas()` passa primeiro pelo handler. O que não é compra do checkout novo (inclusive as
      importadas `legacy_*`) segue o fluxo antigo de `subscriptions`. Acha a compra pelo id do Asaas
      ou, se o webhook chegar antes, pela `externalReference` (= uuid). O log do webhook deixou de
      gravar o corpo inteiro (nome, CPF e e-mail do pagador): agora só evento e ids.
- [x] 4.3 `ASAAS_WEBHOOK_TOKEN_REQUIRED` (default false): ligado e sem token → 503 em tudo. _R5.4, D4_
- [x] 4.4 Cobrança que não é nossa → 200 sem efeito. _R5.5_
- [x] 4.5 `tests/Feature/CompraWebhookTest.php` (15 testes): confirmed + received credita uma vez,
      reenvio idêntico, handler chamado duas vezes, estorno com saldo gasto, estorno de compra não
      paga ignorado, expirada não credita depois, fallback antigo, token errado, token obrigatório.
- [x] 4.6 (achado) `WebhookIdempotency` gravava a chave anti-reenvio **antes** de processar: um erro
      500 fazia o reenvio automático do Asaas cair como "já processado", e o crédito se perdia.
      Agora erro de servidor (exceção ou status ≥ 500) libera a chave.

## Fase 5: admin (feita em 07/10/2026, não commitada)
- [x] 5.1 `GET/POST /api/admin/packages`, `PUT /api/admin/packages/{id}` (middleware novo `admin`
      = `role admin`, token de `/api/auth/admin-login`). Sem DELETE: desativar com `active=false`.
      `price` (USD) e `price_per_credit` derivados do preço em R$ quando o admin não informa. Mudar
      pacote não altera pedido já feito. _R8.1_
- [x] 5.2 `GET /api/admin/purchases?email=&status=&client=&source=&from=&to=&per_page=` (50 por
      página, até 200), com nome/e-mail do membro, split e id do Asaas. _R8.2_
- [x] 5.3 `tests/Feature/AdminCobrancaTest.php` (9 testes): membro comum → 403 em todas, sem login →
      401, validação, desativar não mexe em preço, compra antiga intacta, filtros.
- [ ] 5.4 (D6) Tela no painel: fica para quando o painel for apontado ao `[AUTH]`.

Suíte completa do `[AUTH]` depois das Fases 1–5: **145/145**.

## Fase 6: página de compra na v2 (feita em 07/10/2026, não commitada)
- [x] 6.1 `services/billing.ts`: tudo no `[AUTH]` (`VITE_AUTH_API_URL`), token via `tokenStorage`.
      Sem `VITE_AUTH_API_URL` a compra responde "indisponível", porque não existe caminho legado na
      API v2. Chave de idempotência nova a cada clique em pagar. Mensagens por status (401, 422, 429,
      rede). _R6_
- [x] 6.2 `pages/CreditsPage.tsx` na rota `/dashboard/creditos`, item "Comprar Créditos" no menu
      (seção Principal) e botão "+ Comprar" ao lado do saldo no cabeçalho. Pacotes do
      `[AUTH]` (`?client=v2`), destaque "Mais escolhido" no `popular`. _R6.1, R6.2_
- [x] 6.3 PIX: QR, copia e cola e acompanhamento do status a cada 5 s por até 30 min (para ao sair da
      página). Quando a compra fica paga, dispara `refreshCredits` e o saldo do cabeçalho atualiza. _R6.3_
- [x] 6.4 Cartão: mesmos campos da v1. Aprovado mostra "Pagamento aprovado" e acompanha até o
      webhook confirmar. Recusado mostra a mensagem do servidor. _R6.4_
- [x] 6.5 "Minhas compras" (data, pacote, créditos, valor, forma, status). _R6.5_
- [x] 6.6 Sem saldo: a análise gráfica (402) leva para `/dashboard/creditos` depois do aviso, e o
      Micro Radar mostra o link "Comprar créditos". _R6.1_
- [x] 6.7 CSP: nada a mudar. `connect-src` já inclui a origem de `VITE_AUTH_API_URL` e
      `*.genesislabs.com.br`, e `img-src` já aceita `data:` (QR do PIX).
- [x] 6.8 `__tests__/billing.test.ts` (18 testes). Suíte vitest 537 passando, `tsc` limpo, build ok.
      Os testes acharam 1 bug meu, já corrigido: a mensagem "indisponível" virava "sem conexão".

## Fase 7: v1 no `[AUTH]` (feita em 07/10/2026, não commitada)
- [x] 7.1 `components/SubscriptionPage.tsx` chama `/api/packages?client=v1`, `/api/checkout/pix`,
      `/api/checkout/card` e `/api/purchases/{uuid}` do `[AUTH]` (URL absoluta com `AUTH_API_URL`, mesmo
      axios e token de sempre), com `client: 'v1'` e `Idempotency-Key`. _R7.1_
- [x] 7.2 Cotação awesomeapi removida; preço em R$ (`price_brl`) no card e no checkout. "Finalizar
      Assinatura" virou "Finalizar Compra". _R7.2_
- [x] 7.3 Acompanhamento igual ao da v2. Quando a compra fica paga: `refreshCredits`, aviso com os
      créditos e volta para o Gênesis. Fechar o checkout para o acompanhamento.
- [x] 7.4 `services/billing.ts` (funções puras) + `tests/billing.test.mjs` (7 testes):
      `test:baseline` 14/14. `tsc`: os mesmos 3 erros antigos de antes (App.tsx, AppErrorBoundary,
      MindMetrics), nenhum novo. Build ok. A v1 não tem CSP.

**Ainda não visto no navegador**: para isso o `[AUTH]` precisa rodar local com as migrações novas
no MySQL local (pedir autorização), ou ir direto para o ensaio em sandbox da Fase 8.

## Fase 8: ensaio em sandbox
- [ ] 8.1 `[AUTH]` local com `ASAAS_ENV=sandbox` e carteira de split de sandbox.
- [ ] 8.2 Compra PIX e cartão pela v2 e pela v1; conferir no painel sandbox a cobrança e o split.
- [ ] 8.3 Simular webhook pago, repetido, estorno; conferir saldo e `credit_purchases`.

## Fase 9: corte em produção (só com autorização)
- [ ] 9.0 Conferir `ASAAS_WALLETID` preenchido no `.env` do `[AUTH]` de produção + `config:cache`.
- [ ] 9.1 Backup dos bancos (`clpctl db:backup`).
- [ ] 9.2 Deploy `[AUTH]` + migrate (autorizado) + `price_brl` nos pacotes + importação do
      histórico (`--dry-run` primeiro):
      ```bash
      php artisan genesis:packages:sync --dry-run && php artisan genesis:packages:sync
      php artisan genesis-auth:convert-legacy-dump <dump-atual-da-v1>.sql --out=v1.json
      php artisan genesis:purchases:import-legacy --v1-json=v1.json --paid-ref=pay_tx1j597gq1yyw8pq --dry-run
      php artisan genesis:purchases:import-legacy --v1-json=v1.json --paid-ref=pay_tx1j597gq1yyw8pq
      ```
      Usar um dump da v1 tirado no dia (não o de 05/10) e conferir se surgiram compras novas pagas
      à mão, que também entram em `--paid-ref`.
- [ ] 9.3 Deploy `[FE v2]`; compra PIX real de menor valor; conferir crédito e split no painel Asaas.
- [ ] 9.4 Deploy `[FE v1]`; mesma verificação.
- [ ] 9.5 Cadastrar token no painel Asaas, preencher `ASAAS_WEBHOOK_TOKEN` e ligar
      `ASAAS_WEBHOOK_TOKEN_REQUIRED`.
- [ ] 9.6 `[API v1]`/`[API v2]`: `/plans` e `/subscription/*` respondem 410. Tabelas mantidas.
      _R7.3, R4.4_
- [ ] 9.7 Acompanhar 7 dias: compras `pending` antigas, webhooks recusados no log.

## Rollback
- Fases 6/7: voltar o commit do front (`git checkout` + build). O `[AUTH]` aceita os dois fluxos.
- Fase 9.6: reativar as rotas antigas das APIs.
- Migrações da Fase 1 só adicionam colunas/tabela: `migrate:rollback` é seguro enquanto não houver
  compras reais em `credit_purchases`. Depois disso, não reverter (perde registro de compra).
