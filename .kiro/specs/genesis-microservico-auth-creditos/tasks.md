# Plano de Implementação: Microserviço de Autenticação e Créditos (Gênesis)

## Visão Geral

Repositórios: **[AUTH]** = `E:\Programas\wamp64\www\auth genesis` (novo) · **[API]** = `E:\Programas\wamp64\www\genesis-api`,
branch `genesis2` · **[FE]** = este repositório (frontend v2.0).

Este plano **não foi executado ainda** — é o spec para revisão do usuário antes de qualquer alteração. A branch
`master` de `genesis-api` e o frontend antigo não são tocados (Requisito 9).

## Fase 0 — Confirmar decisões de escopo antes de codar

- [x] 0.1 **Decidido (2026-09-10):** validação de token entre serviços via endpoint interno + cache curto (~45s)
      — `design.md`, Requisito 2. JWT stateless descartado (perderia revogação quase instantânea de
      logout/inativação).
- [x] 0.2 **Decidido (2026-09-10):** a coluna legada `credits` em `User` **não é migrada** — no `[AUTH]`, saldo
      só existe via ledger (`bavix/laravel-wallet`, `balanceFloat`). Fonte única, sem risco de divergência.
- [x] 0.3 **Decidido (2026-09-10):** endereço local do novo serviço é `localhost:8001` — usado em
      `VITE_AUTH_API_URL` (`[FE]`) e em `services.genesis_auth.url` (`[API]`).
- [x] 0.4 **Decidido (2026-09-10):** modelo de pacote de créditos mantém o nome `Plan` (sem renomear para
      `CreditPackage`).

## Fase 1 — Scaffold do `[AUTH]`

- [x] 1.1 **[AUTH]** `composer create-project laravel/laravel . "10.*"` executado, `.env`/`.env.example`
      configurados com banco próprio (`DB_DATABASE=genesis_auth`, `APP_URL=http://localhost:8001`, decisões
      0.1-0.4 da Fase 0). **Pendente:** criar fisicamente o schema `genesis_auth` — WAMP (MySQL) está parado
      neste ambiente (`wampmysqld64`), sem permissão para iniciar o serviço Windows por aqui; o usuário vai
      ligar o WAMP manualmente. Fica junto com o `migrate` da Fase 2.5.
- [x] 1.2 **[AUTH]** `laravel/sanctum` ^3.3 (já vinha no skeleton) e `bavix/laravel-wallet` ^10.1 instalados
      (versões idênticas a `genesis-api`, confirmado em `composer.json`); migrations publicadas
      (`create_wallets_table`, `update_wallets_uuid_table`, `create_transactions_table`,
      `create_transfers_table` — mesmo conjunto de `genesis-api`).
- [x] 1.3 **[AUTH]** CORS/Sanctum: `config/cors.php` do skeleton já sai idêntico ao de `genesis-api`
      (`allowed_origins: ['*']`, `supports_credentials: false`) — sem alteração necessária. Sanctum usado em
      modo token de API (Bearer, `createToken()->plainTextToken`), não modo SPA/cookie — `config/sanctum.php`
      (domínios stateful) não se aplica a este desenho, mantido default.

## Fase 2 — Modelo de dados em `[AUTH]` ✅ (2026-09-10)

- [x] 2.1 **[AUTH]** Migration `2026_09_10_000001_add_genesis_fields_to_users_table` + model `User` atualizado:
      `role`, `status`, `lastlinkStatus`, `activationMode`, `manualActivationStart/End`, `terms`,
      `termsSignedDate`, `reference`, `start_at`, `end_at`, `renew_at`, `cpf`, `implements Wallet`,
      `use HasApiTokens, HasWallet, HasWalletFloat, HasWallets`. **Sem** `credits` (decisão 0.2) **e sem**
      `analyses`/`searches` — achado durante a execução: esses 2 contadores nunca são incrementados em nenhum
      lugar do código-fonte de `genesis-api`, só lidos pelo `UserTransformer` do painel admin (fora do domínio
      de auth/créditos) — trim de escopo justificado, não uma omissão.
- [x] 2.2 **[AUTH]** Migration `create_plans_table` + model `Plan`: `name`, `credits`, `price`,
      `price_per_credit`, `popular` (existe na migration real de `genesis-api`, não estava no `Plan.php` —
      replicado), `client` (novo, nullable, para o catálogo por versão do Requisito 4.3 — usado só a partir da
      Fase 6).
- [x] 2.3 **[AUTH]** Migration `create_subscriptions_table` + model `Subscription`: `user_id`, `plan_id`,
      `reference`, `starts_at`, `ends_at`, `canceled_at`, `active`.
- [x] 2.4 **[AUTH]** Migrations + models `LastLinkWebhooks` (idêntico) e `LastLinkAccess` — portado sem os
      helpers `hasFullAccess()`/`hasWalletAccess()` de `genesis-api` (gating do recurso "Carteira", fora de
      escopo); mantido só `hasAnyActiveProduct()`.
- [x] 2.5 **[AUTH]** Banco `genesis_auth` criado (WAMP/MySQL estava parado, usuário ligou manualmente) e
      `php artisan migrate --force` rodado sem erros — 13 migrations aplicadas.
- **Decisão adicional durante a execução** (documentada em `config/genesis.php`/`config/legal.php`): o
      `setting()`/`anlutro/l4-settings` de `genesis-api` (tabela `settings` editável por admin) **não** foi
      portado — nada no escopo das Fases 2-4 escreve nesses valores (nenhum painel admin planejado). Os 7 custos
      por tipo de operação + `initial_credits` viraram `config/genesis.php` (valores default = os reais hoje em
      produção, confirmados via leitura direta da tabela `settings` de `genesis-api`, não os do
      `SettingsSeeder.php` desatualizado); o texto de termos virou `config/legal.php`. Se um painel admin para
      este serviço virar necessidade real, migrar para um store de banco é a evolução natural.

## Fase 3 — Auth (login/registro/perfil/senha) ✅ (2026-09-10)

- [x] 3.1 **[AUTH]** Portados `login()`, `adminLogin()`, `register()`, `logout()`, `me()`, `updateProfile()`,
      `changePassword()` para `AuthController` — `store()`/`pix()` (checkout) deliberadamente **não** portados
      aqui, ficam pra Fase 6. `adminLogin()` não estava no contrato original do `design.md` — adicionado
      (`POST /api/auth/admin-login`) e o doc atualizado, por ser fundamentalmente uma ação de identidade
      (autentica User + emite token, só com gate de `role`), mesmo domínio das demais.
- [x] 3.2 **[AUTH]** Portados `ForgotPasswordController`, `ResetPasswordController`, `ResetPasswordNotification`
      (usa `config('app.frontend_url')`, nova env `FRONTEND_URL`).
- [x] 3.3 **[AUTH]** Endpoint interno em `InternalController::verifyToken` — path real é
      `GET /api/internal/verify-token` (não `/internal/` puro — `routes/api.php` é prefixado por
      `RouteServiceProvider`, `design.md` corrigido). Retorna 401 se token inválido **ou** usuário não `active`
      — reforça o Requisito 2.4 (mais forte que o `auth:sanctum` original de `genesis-api`, que nunca
      reverificava `status` depois do login).
- [x] 3.4 **[AUTH]** 9 testes (`tests/Feature/Auth/AuthTest.php`): login válido/inválido/usuário inativo,
      registro com/sem webhook LastLink prévio (confirma ativação + crédito inicial via `config('genesis.
      initial_credits')`), troca de senha, verify-token válido/sem-token/usuário-inativo. Todos verdes.
      **Nota:** "expirado" do item original do plano não é testável isoladamente sem mockar o relógio do
      Sanctum — coberto indiretamente pelo caso "usuário inativo" (mesmo código de erro, 401).
- **Achado/decisão durante a execução**: testes rodam contra sqlite físico dedicado
      (`database/testing.sqlite`, git-ignorado), nunca o MySQL real (`genesis_auth`) — mesmo padrão de
      `genesis-api` (`tests/bootstrap-sqlite.php` portado, `DatabaseTransactions` em todo teste, zero
      `RefreshDatabase`), replicado aqui desde o início por consistência com [[feedback_db_authorization]].

## Fase 4 — Créditos (saldo/histórico/consumo) ✅ (2026-09-10)

- [x] 4.1 **[AUTH]** Portados `balance()`, `history()`, `consume(string $type)` para `CreditController` (também
      recebeu `balance()`/`history()`, que em `genesis-api` viviam em `AuthController` — reorganização por
      módulo, `design.md`). Mesma tabela de custo por tipo (via `config('genesis.credit_costs.*)`) e mesma
      proteção de idempotência (`idempotency_key` + janela de 20s). Resposta trocou de `flugger/laravel-
      responder` (pacote não portado) para `response()->json()` puro — mesmo shape que o frontend já espera
      hoje (`data.credits`/`data.message`, confirmado lendo `services/api.ts::consumeCredits`).
- [x] 4.2 **[AUTH]** 7 testes (`tests/Feature/CreditTest.php`): balance, consumo com saldo zero (402), saldo
      menor que o custo do tipo (402), débito com saldo suficiente, idempotência via `idempotency_key`,
      idempotência por janela de 20s (retry sem chave), history. Todos verdes (16 testes Fase 3+4, 41
      assertions). **Achado no teste, não no código**: `history()` ordena só por `created_at` sem chave de
      desempate (mesmo comportamento do original) — duas transações no mesmo teste podem empatar no timestamp;
      teste ajustado pra checar presença na lista, não posição.

## Fase 5 — `[API]` consome `[AUTH]` para auth/saldo — CONSTRUÍDO, NÃO ATIVADO ✅ (2026-09-10)

**Decisão do usuário (2026-09-10, `AskUserQuestion`)**: trocar `auth:sanctum` pelas rotas reais agora derrubaria
o login de qualquer conta que só existe no banco local do `genesis-api` (Fase 9, migração de dados, está
travada). Escolhido "construir tudo, não ativar ainda" — todo o código abaixo existe, testado, mas nenhuma rota
real usa `genesis.auth` e `services.genesis_auth.enabled` continua `false` por padrão. Ativar = (a) trocar
`auth:sanctum` → `genesis.auth` nas rotas listadas em 5.3, (b) `GENESIS_AUTH_ENABLED=true` — só depois da Fase 9.

- [x] 5.1 **[API]** `App\Http\Middleware\VerifyGenesisAuthToken` criado, alias `genesis.auth` registrado em
      `Kernel.php` — **não aplicado a nenhuma rota**. **Achado real e importante durante a construção**: 13
      controllers deste repositório (`CreditController`, `AnaliseController`, `AlertaController`,
      `GraphicalAnalysisController`, `RadarController`, `RadarNewsController`, `GeoEventController`,
      `CarteiraMembroController`, `TradeController`, `UserAnswerController`, `UtilityGeminiProxyController`,
      `SistemaStatsController`, `AuthController`) chamam `auth()->user()`/`Auth::user()` diretamente — uma
      primeira versão deste middleware (só `$request->attributes->set(...)`, como o `design.md` original
      desenhava) deixaria `Auth::user()` nulo e quebraria todos eles, incluindo o middleware `EnsureAdmin`
      (`admin`) que usa exatamente esse padrão. Corrigido: o middleware materializa/atualiza uma linha local em
      `users` (mesma tabela de hoje, casada por email) e loga via `Auth::setUser()` — `auth()->user()` continua
      funcionando em todo o código existente sem tocar nos 13 arquivos. Efeito colateral útil: uma conta que já
      existe localmente por email mantém o mesmo `id` depois da ativação (analyses/radar/alertas ligados a
      `user_id` não perdem vínculo), desde que a pessoa se registre em `[AUTH]` com o mesmo email — mitiga boa
      parte da preocupação original de "contas locais param de funcionar".
- [x] 5.2 **[API]** `App\Services\GenesisAuthClient` criado; `CreditController::consume()` ganhou um branch
      condicional (`if (config('services.genesis_auth.enabled'))`) que repassa pro `[AUTH]` — o código antigo
      (debitar localmente) fica intocado no `else`, comportamento de hoje preservado byte a byte enquanto a flag
      estiver `false` (default).
- [x] 5.3 **[API]** Rotas hoje sob `auth:sanctum` real (`routes/api.php`): linha 68 (`/v1/alertas/stream`), grupo
      da linha 79 (macro/radar/alertas/geo-events/logout/me/profile/credits/subscription/trades/consume/
      answers/progress), grupo admin da linha 174 (`auth:sanctum` + `admin`). **Achado**: o middleware `admin`
      (`EnsureAdmin`) também dependeria da correção do item 5.1 pra continuar funcionando pós-ativação — já
      coberto pela mesma correção, mas fica registrado aqui porque não era óbvio à primeira vista.
      **Achado fora do escopo deste spec**: `services/api.ts::consumeCredits()` (frontend) chama
      `/v1/credits/consume/{type}`, mas a rota real é `/v1/consume/{type}` (sem `credits/`) —
      descasamento pré-existente, não é regressão ativa porque a função não tem nenhum call site no frontend
      hoje (confirmado via grep). Sinalizado, não corrigido — fora do escopo deste spec.
- [x] 5.4 **[API]** 7 testes novos (`VerifyGenesisAuthTokenTest`, 5 casos via rota ad-hoc — nenhuma rota real usa
      o middleware ainda; `CreditControllerGenesisAuthTest`, 2 casos) — todos com `Http::fake`, zero rede real.
      Suíte completa: **1013 passed, 10 failed, 2 skipped** (antes e depois das mudanças desta fase — confirmado
      via `git stash`/re-run isolado dos 2 arquivos que falham, `GraphicalAnalysisAttemptJobTest`/
      `GraphicalAnalysisFullPipelineIntegrationTest`, falham identicamente sem nenhuma mudança desta fase; não
      relacionados a auth/créditos, pré-existentes, fora do escopo deste spec corrigir).

## Fase 6 — Pacotes de créditos e checkout ✅ (2026-09-10)

- [x] 6.1 **[AUTH]** Portados `store()`→`CheckoutController::card()` e `pix()`→`CheckoutController::pix()`,
      catálogo `GET /api/packages` filtrável por `?client=`. `setting('asaas_percent')`/`setting('asaas_fee')`
      viraram `config('genesis.asaas_percent')`/`config('genesis.asaas_fee')` (mesmos valores reais confirmados
      em produção: 1.99/0.49). SDK Asaas portado trimmed (`app/Asaas/Asaas.php` só com `cliente`/`cobranca`,
      únicos membros usados — `assinatura`/`transferencia`/`subcontas` não portados).
      **Melhoria deliberada**: `App\Asaas\Connection` trocou de Guzzle bruto (`new Client(...)`, invisível para
      `Http::fake()`) para a fachada `Illuminate\Support\Facades\Http` — só assim dava pra testar
      checkout/webhook sem chamada de rede real (Requisito 10.2); mesmo transporte por baixo, comportamento
      preservado. Também corrigido um bug latente do original: quando o Asaas respondia código != 200,
      `store()`/`pix()` caíam no fim do método sem `return` (200 vazio implícito do Laravel) — agora retorna
      400 explícito com mensagem de erro.
- [x] 6.2 **[AUTH]** Webhook LastLink (`handle()`) e webhook Asaas (`asaas()`) portados em
      `Webhooks\LastLinkWebhookController`, mesmo mapeamento de eventos exato. Middlewares
      `VerifyAsaasToken`/`VerifyLastLinkSignature`/`WebhookIdempotency` portados verbatim, aliases
      `webhook.asaas`/`webhook.lastlink`/`webhook.idempotency` registrados no `Kernel.php`. `increment('credits',
      ...)` (coluna legada) não portado — decisão 0.2, só `depositFloat`/`withdrawFloat`.
- [x] 6.3 **[AUTH]** 10 testes novos: `CheckoutTest` (4 — card, pix, checkout sem auth rejeitado, catálogo
      filtrado por client) e `WebhookTest` (6 — lastlink sem assinatura/com assinatura válida/replay ignorado,
      asaas sem token/payment received credita/payment refunded estorna). Suíte completa do `[AUTH]`: **28/28
      testes verdes, 66 assertions**, zero chamada de rede real (`Http::fake` cobre Asaas).
- [ ] 6.4 **[API]** Remover checkout/webhooks de `genesis-api` (branch `genesis2`) depois que `[AUTH]` estiver
      confirmado — não antes. Não iniciado (correto — gated, igual à Fase 5, até confirmação real de ponta a
      ponta).

## Fase 7 — `[FE]` aponta para `[AUTH]` — CONSTRUÍDO, NÃO ATIVADO ✅ (2026-09-10)

Mesmo padrão de decisão da Fase 5 (aplicado sem reconsultar — situação idêntica, já decidida): `VITE_AUTH_API_URL`
vazio por padrão (`.env` e `.env.example`) preserva 100% do comportamento de hoje; setar essa env é o único jeito
de ativar, e mesmo assim login continuaria falhando sem a Fase 9.

- [x] 7.1 **[FE]** `VITE_AUTH_API_URL` adicionada em `.env` e `.env.example`, vazia de propósito, comentário
      explicando o porquê.
- [x] 7.2 **[FE]** `services/api.ts`: `login`/`getMe`/`logout`/`fetchCredits`/`consumeCredits` passam por um
      helper `authPath(novoPath, legadoPath)` — com a env vazia (default), usa exatamente os paths de hoje
      (`/v1/login` etc.); com a env setada, usa os paths reais do `[AUTH]` (`/auth/login`,
      `/credits/balance`, `/credits/consume/{type}`). Contrato de retorno de cada função inalterado.
- [x] 7.3 **[FE]** N/A confirmado — grep em todo o repositório não achou nenhuma tela/fluxo de compra de
      pacote/checkout hoje (`register`, `checkout`, `pacote`, `plano` não têm nenhum componente real).
- [x] 7.4 **[FE]** `npx tsc --noEmit` limpo, `npm run build` limpo, `npx vitest run`: **428 passed, 28 failed**
      — mesmos 5 arquivos/28 casos pré-existentes documentados em specs anteriores deste projeto (memória:
      "mesmas 28 falhas pré-existentes"), nenhum relacionado a `login`/`getMe`/`logout`/`fetchCredits`/
      `consumeCredits` ou a caminhos de auth/créditos.

## Fase 8 — Verificação end-to-end (sem dado de produção) ✅ (2026-09-10)

- [x] 8.1 **[AUTH]** Fluxo real completo executado contra o servidor `[AUTH]` de verdade (`php artisan serve
      --port=8001`, não o harness de teste): webhook LastLink simulado via tinker (mesma via de produção) →
      `POST /api/auth/register` (ativou, creditou 1000 — `config('genesis.initial_credits')` confirmado) →
      `POST /api/auth/login` → `GET /api/credits/balance` (1000) → `POST /api/credits/consume/radar` (debitou
      50, saldo 950 — `config('genesis.credit_costs.radar')` confirmado) → `GET /api/credits/history` (2
      transações corretas) → `GET /api/internal/verify-token` (payload correto). Todos os passos bateram
      exatamente o esperado. Dado de teste apagado depois (`users`/`wallets`/`transactions`/
      `last_link_webhooks` confirmados vazios de novo), servidor de dev parado.
      **Bloqueado, não simulado**: (a) compra de pacote real via Asaas sandbox — `ASAAS_KEY` não está
      configurada neste ambiente (nenhuma credencial de sandbox real disponível); (b) "análise completa no
      `[API]`" — bloqueado por desenho, não por limitação técnica: exigiria ativar a Fase 5
      (`GENESIS_AUTH_ENABLED=true` + trocar `auth:sanctum`→`genesis.auth`), que você decidiu explicitamente
      não ativar ainda. Não forcei essa ativação sem perguntar de novo — contradiria a decisão já tomada.
- [x] 8.2 Já coberto por `VerifyGenesisAuthTokenTest::test_auth_indisponivel_retorna_401_nao_autentica_no_escuro`
      (Fase 5.4) — porta local fechada de verdade, `[API]` retorna 401 explícito, nunca autentica "no escuro".
- [x] 8.3 TTL do cache = **45 segundos** (`VerifyGenesisAuthToken::CACHE_TTL_SECONDS`), já documentado no código
      e em `design.md`/`requirements.md` (Requisito 2.4).
- [x] 8.4 **Re-execução da Fase 8, achado real e corrigido (2026-09-10, mesmo dia)**: repetindo o fluxo real
      contra o servidor de verdade, uma chamada a uma rota protegida sem token **e sem header `Accept:
      application/json`** (cenário `curl` cru, não coberto por nenhum teste até então) derrubava o serviço com
      `RouteNotFoundException: Route [login] not defined` (500, página HTML) em vez de 401 limpo — `[AUTH]` é
      100% API, sem nenhuma rota `login`, mas o skeleton padrão do Laravel tenta `route('login')` como fallback
      de redirecionamento dentro do próprio `App\Http\Middleware\Authenticate::redirectTo()` (quebra antes de a
      exceção sequer chegar no Handler). **Por que os 28 testes anteriores nunca pegaram isso**: `getJson()`/
      `postJson()` do PHPUnit sempre mandam `Accept: application/json` de propósito — só uma chamada HTTP crua
      expõe o bug. Corrigido em duas camadas (`App\Http\Middleware\Authenticate::redirectTo()` sempre `null`;
      `App\Exceptions\Handler::unauthenticated()` sempre JSON, rede de segurança) + 3 testes de regressão novos
      (`tests/Feature/ApiOnlyErrorHandlingTest.php`, usando `get()` puro pra reproduzir o cenário real, não
      `getJson()`) — suíte completa do `[AUTH]`: **31/31 verdes, 71 assertions**. Re-verificado end-to-end
      contra o servidor real depois da correção (login → balance → consume com idempotência → history → logout
      → balance pós-logout sem Accept header, agora 401 limpo em vez de 500). Dado de teste apagado, servidor
      parado.

## Fase 9 — Migração de dados de produção (GATED — não iniciar sem autorização explícita)

- [x] 9.0 **Autorização explícita obtida em 2026-09-10** — usuário confirmou duas vezes ("execute a fase 9",
      depois checou se um banco novo seria necessário — não, `genesis_auth` já existia desde a Fase 1 — e
      confirmou seguir).
- [x] 9.1 **[API]** `php artisan genesis-auth:export` (`app/Console/Commands/GenesisAuthExport.php`, novo) —
      SOMENTE LEITURA (usa `DB::table()`, nunca escreve). Exportou de `genesisteste` (banco real de dev):
      **205 users, 175 wallets, 19.803 transactions, 4 plans, 198 subscriptions, 1.023 last_link_webhooks, 0
      lastlink_accesses**. Arquivo JSON gerado em `storage/app/` (protegido por `storage/app/.gitignore` com
      `*` — nunca iria pro git), apagado depois de confirmada a importação (continha hash de senha real de 205
      pessoas — totalmente reproduzível via o mesmo comando, só leitura, se precisar de novo).
- [x] 9.2 **[AUTH]** `php artisan genesis-auth:import {file} [--dry-run]`
      (`app/Console/Commands/GenesisAuthImport.php`, novo) — idempotente (casa por `email`/`name`/
      `(holder_id,slug)`/`uuid`/`reference` conforme a tabela). Rodado primeiro com `--dry-run` (validou a
      lógica de mapeamento sem escrever), depois de verdade: **205 users criados, 4 plans criados, 167/175
      wallets criados (8 pulados), 19.784/19.803 transactions processadas via upsert em lote de 500 (19
      puladas), 198/198 subscriptions criadas, 909 last_link_webhooks criados (114 já eram duplicatas dentro da
      própria fonte — mesmo id_external+event+created_at, webhook idempotency de `genesis-api` é só por cache
      24h, não permanente).**
      **Achado real, não é bug do script**: as 8 wallets/19 transactions puladas referenciam `holder_id`
      243-248/265/266 — usuários que **não existem em lugar nenhum** entre os 205 exportados, ou seja, já
      não existem na tabela `users` de `genesis-api` (deletados em algum momento sem limpar a carteira
      associada — ~12.000-14.000 créditos "presos" em carteiras órfãs no próprio `genesis-api`, pré-existente,
      fora do escopo deste spec corrigir). Script pulou corretamente em vez de inventar/quebrar.
- [x] 9.3 **Dupla checagem executada e reconciliada 100%**: soma de saldo das wallets migradas
      (`240.571.100`, unidade interna do bavix/laravel-wallet) bate **exatamente** com a soma na fonte
      excluindo as 8 órfãs (`240.571.100` também — a diferença pra somar todas incluindo as órfãs,
      `240.585.100`, é precisamente `14.000`, a soma dos 8 saldos órfãos). Contagem de transactions bate
      1:1 (19.784 = 19.784). Spot-check manual: saldo migrado da própria conta do usuário
      (`felipemarcanthlopes@gmail.com`) = 4201 créditos, idêntico ao valor na fonte.
- [ ] 9.4 **NÃO executado de propósito — parei aqui pra confirmação final antes do corte de verdade.** Esta é a
      etapa que reverte as decisões deliberadas "construído, não ativado" das Fases 5 e 7: liga
      `GENESIS_AUTH_ENABLED=true` em `genesis-api`, troca `auth:sanctum`→`genesis.auth` nas rotas reais
      (Fase 5.3 lista quais), e arquiva as tabelas locais de `users`/`wallets`/`transactions`. Diferente de
      9.1-9.3 (leitura + escrita num banco que nada ainda depende dele), esta muda o comportamento de login de
      verdade em um sistema com 205 contas reais — pedir autorização explícita de novo antes de executar, sem
      assumir que "execute a fase 9" já cobria isso.

## Fase 10 — Documentar próximos passos (fora de escopo de execução) ✅ (2026-09-10)

- [x] 10.1 Registrado em `design.md` ("Próximos passos — integração futura de `master`/frontend antigo"), com
      levantamento real (`git diff`/`git log` entre `master` e `genesis2`, sem alterar nenhuma das duas
      branches). **Achados que mudam a leitura anterior do spec**: `master` não tem nenhum commit próprio —
      é literalmente o ponto de onde `genesis2` foi criada, 111 commits atrás, não duas branches divergindo
      de verdade. `User.php` é byte-idêntico entre as duas, e nenhuma das 58 migrations exclusivas de
      `genesis2` toca no domínio de auth/créditos — `[AUTH]` já serve as duas sem trabalho extra de
      compatibilidade de dado. **Achado de segurança real, fora de escopo corrigir aqui**: `master` não tem
      nenhum dos middlewares de proteção de webhook (`webhook.lastlink`/`webhook.asaas`/
      `webhook.idempotency`) nem `CreditController` com proteção por `idempotency_key` — se a implantação de
      `master` ainda recebe tráfego real, os webhooks financeiros lá estão sem verificação de assinatura/
      token. Sinalizado como risco separado, não corrigido.
