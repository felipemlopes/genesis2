# Design — Correção das Vulnerabilidades de Segurança

## Visão Geral

São 18 correções pequenas espalhadas em cinco repositórios. A ordem é pelo dano possível hoje:

1. **Dinheiro:** crédito livre, quiz, webhooks (S1–S3).
2. **Dados de cartão:** logs e Telescope (S4, S6, S16).
3. **Acesso indevido:** admin da v1, tokens, Git (S5, S9, S7).
4. **O resto.**

Cada correção começa por um teste que reproduz o ataque (prova de exploração), exatamente como descrito no relatório.

Nenhuma mudança exige migração, exceto:
- a marca de "quiz já resgatado" (S2);
- a coluna `auth_user_id` (S12).

As duas precisam de autorização antes de rodar.

## Estado Atual Auditado (27/09/2026)

| ID | Onde | O que acontece hoje |
|---|---|---|
| S1 | [AUTH] `routes/api.php:42` → `CreditController::adjust()` (`app/Http/Controllers/Api/CreditController.php:104`) | Rota de membro aceita `direction=credit` com qualquer `amount`. Quem chama com `credit` no código: só o `UserAnswerController::result()` da [API v2] (linhas 93-107). Radar, alertas e análises usam `debit`. O admin usa `adjustCreditForUser()` (interno). |
| S2 | `UserAnswerController::result()`: [API v2] linha 82, [API v1] linha 81 | `correct`/`wrong` vêm do navegador; `wrong=0` credita 200 a cada chamada. Na [API v2], com `CREDITS_FULL_ENABLED=true` (produção), o crédito vai para o [AUTH] via S1. Na [API v1] vai para a carteira local. As respostas (`user_answers`) também guardam `correct` enviado pelo navegador; o gabarito está só no frontend (`LearnFutures.tsx` no FE v1). |
| S3 | [AUTH] `VerifyLastLinkSignature`, `VerifyAsaasToken` (commits `559bce3`, `cde181a`, 21/09) | Segredo vazio → aceita sem verificar. `LastLinkWebhookController::handle()` grava o acesso e `register()` ativa a conta e deposita os créditos iniciais se achar um `Product_Access_Started` para o e-mail. `asaas()` credita o plano ao achar a `Subscription` pelo id da cobrança. |
| S4 | `AuthController::store()`/`pix()`: [API v1] linhas 348, 397, 400, 505, 512, 523; [API v2] 348, 397, 400, 498, 505, 516. [AUTH] `CheckoutController` só loga a mensagem de erro, **mas `app/Asaas/Cobranca.php` (linha 44 no [AUTH], 87 nas APIs) grava a cobrança inteira com cartão** — achado na execução da Fase 3 (28/09) | `Log::info(json_encode($cobranca))` grava cartão, CVV, CPF, endereço e telefone. O FE v1 usa `/subscription/checkout` (`SubscriptionPage.tsx:289`). |
| S5 | [API v1] `routes/api.php:85-87` | Grupo `v1/admin` só com `auth:sanctum`, sem `admin`. `UserController::update` promove a admin (`is_admin`, linha 44). `config/sanctum.php` com `expiration => null`. |
| S6 | [API v2] `TelescopeServiceProvider` | Em produção grava requisições com falha e esconde só `_token`. `TELESCOPE_ENABLED` não está no `.env` de produção, então vale o padrão (`true`). |
| S7 | [API v2] `genesis_v6_4_proofs/pre-migration-4-dump.sql` (desde 26/07/2026) | 1 chave `AIza…`, `users`, `wallets`, `transactions`, `personal_access_tokens`, `telescope_entries`. |
| S8 | [FE v2] `routes/api.js:115` (PUT), `:208` (SSE); `server.ts` | `SET ${key} = ?` com chaves do corpo (injeção de SQL); SSE sem autenticação. O frontend chama a API Laravel, não essas rotas. |
| S9 | `config/sanctum.php` das três APIs; [FE v2] `services/api.ts:495` | Tokens sem validade; `reset-password` e `changePassword` não revogam tokens; token do SSE vai na URL. **Nenhum dos dois frontends trata 401** (conferido em `services/api.ts`). |
| S10 | [AUTH] `routes/api.php` grupo `auth`; `RouteServiceProvider:27` | Só o limite genérico `api` (60/min por IP ou usuário). Senha mínima 6. |
| S11 | [AUTH] `ForgotPasswordController` (200 vs 400); `adminLogin` das três APIs (404 para não-admin com senha certa) | Revela se o e-mail existe e se a senha está certa. |
| S12 | [AUTH] `AuthController::updateProfile()`; `VerifyGenesisAuthToken` ([API v1] e [API v2]) | Troca de e-mail sem confirmação; casamento local por `User::firstOrCreate(['email' => ...])`. |
| S13 | [API v2] `genesis_graphical_v6.php:38` (`gemini-proxy`, 5/min, sem crédito); [API v1] `routes/api.php:57` (`macro/today` público) | Custo de IA sem cobrança. |
| S14 | `login`/`register`/`updateProfile`/`adminLogin` devolvem `'user' => $user` | `$hidden` só tem `password` e `remember_token`. |
| S15 | `config/cors.php` das três APIs; `.env.example` do [AUTH] e da [API v1] | `allowed_origins => ['*']`; `APP_DEBUG=true` no modelo. |
| S16 | `config/logging.php` das três APIs | `stack` → `single`; o log local da v2 tem 2,3 GB e 108 payloads da LastLink. |
| S17 | [FE v2] `server.ts` `/api/bybit/*` | Proxy público sem limite. |
| S18 | [API v2] `ChartMetadataScanController:17` | Regra só `image`, sem tamanho. |

## Decisões Pendentes (Felipe)

| ID | Pergunta | Recomendação |
|---|---|---|
| D1 | Quiz: basta limitar a uma vez por membro, ou também levar o gabarito para o servidor? | **Uma vez por membro agora** (fecha o crédito infinito). Levar o gabarito para o servidor fica como melhoria. Com o limite, o pior caso é alguém ganhar 200 uma vez sem acertar. |
| D2 | LastLink: há como gerar o segredo do webhook no painel da LastLink? | Se houver: preencher `LASTLINK_WEBHOOK_SECRET` e voltar ao fail-closed. Se não houver: confirmar o evento consultando a API da LastLink antes de ativar a conta. **Não** manter a rota aceitando sem verificação. |
| D3 | Validade dos tokens | **7 dias**. Com o tratamento de 401 nos frontends, o membro só refaz o login. |
| D4 | Checkout por cartão da [API v1]: manter (sem logs) ou migrar para o checkout do [AUTH]/tokenização do Asaas? | **Agora:** tirar os logs. **Depois:** tokenização do Asaas, para o cartão não passar pelo servidor. |
| D5 | Telescope em produção: desligar ou só esconder campos? | **Desligar** (`TELESCOPE_ENABLED=false`) e também esconder os campos (defesa se alguém religar). O gate de produção já está vazio, então ninguém usa o Telescope lá. |
| D6 | Reescrever o histórico do `genesis-api` para tirar o dump? **(Atenção: em 30/07/2026 o Felipe já decidiu que não — ver `.gitignore` e `provas/a04-dump-removido.txt`. Só muda se ele rever.)** | **Sim**, com `git filter-repo` e force push em todas as branches, avisando quem tem clone. O servidor de produção precisa de `git fetch` + `reset --hard` depois. Revogar a chave resolve o risco da chave mesmo sem reescrever; os dados de usuário só saem com a reescrita. |
| D7 | `gemini-proxy`: cobrar crédito ou só limitar? | **Teto diário** (ex.: 30 chamadas/dia por membro) sem cobrar. Cobrar exige mexer na experiência do Opportunity Scanner. |
| D8 | Comunicação de incidente (S3/S4) à ANPD e aos titulares | Fora do código. Depende do resultado da Fase 0 e de parecer jurídico. Registrado aqui para não se perder. |

## Solução por Achado

### S1 — `adjust` só debita

- **[AUTH] `CreditController::adjust()`:** `direction=credit` → 403 `{"message":"Crédito só pelo servidor."}`. A validação continua aceitando os dois valores, para o erro ser claro e não um 422 genérico.
- **[API v2] `UserAnswerController::result()`:** o ramo `credit` passa a chamar `GenesisAuthClient::adjustCreditForUser($user->email, 'credit', 200, ..., "cert-final:{$user->email}")`, já existente e usado pelo admin. O ramo `debit` (penalidade) pode continuar em `adjustCredit()` com o token do membro, mas usa a mesma chave de idempotência.
- **Testes:** `CreditAdjustTest` do [AUTH] ganha o caso "credit pela rota de membro → 403, saldo igual" e perde os casos que creditavam pela rota de membro.
- **Auditoria:** consulta SQL (só leitura) em `transactions` do [AUTH] com `type='deposit'` e `meta` sem `reservation_uuid` e sem descrição de compra ou de admin, agrupada por usuário.

### S2 — Quiz uma vez

- **Migração nova** nas duas APIs (autorização antes de rodar): tabela `user_certifications (user_id unique, correct, wrong, resultado, created_at)`.
- **`result()`:** `firstOrCreate` dentro de transação. Se a linha já existia, devolve o resultado gravado sem mexer em saldo. Se foi criada agora, aplica o bônus ou a penalidade uma vez, com a chave de idempotência `cert-final:{user_id}` no [AUTH].
- **Membros que já resgataram:** a migração **não** preenche nada; o primeiro resgate depois do deploy vale. Os abusos antigos aparecem na auditoria do S1.

### S3 — Webhooks fail-closed e Asaas confirmado

- Os dois middlewares voltam ao comportamento anterior aos commits `559bce3`/`cde181a`: segredo vazio → 503 + `Log::warning`. **Isso é reverter uma decisão do Felipe de 21/09**, então só com o segredo já preenchido em produção (senão os webhooks reais começam a falhar).
- **`LastLinkWebhookController::asaas()`:** antes de `depositFloat`, chamar `GET /v3/payments/{id}` via SDK `Asaas`. Só credita se o status for `RECEIVED`/`CONFIRMED` e o valor bater com a cobrança criada. Caso contrário, `Log::warning` e 200 (para o Asaas não reenviar).
- **LastLink:** conforme D2.
- **Preflight do [AUTH]:** comando `auth:preflight` novo (não existe hoje) que acusa segredo vazio em produção.

### S4 / S6 / S16 — Cartão fora de logs

- **[API v1] e [API v2] `AuthController::store()`/`pix()`:**
  - trocar `Log::info(json_encode($cobranca))`, `Log::info(json_encode($cliente))` e `Log::error('ASAAS RESPONSE RAW', ...)` por `Log::info('checkout.asaas', ['user_id' => ..., 'cobranca_id' => ..., 'status' => ...])`;
  - no Pix, tirar também os logs de `$responseData` e `$pix`.
- **`app/Asaas/Cobranca.php` dos três repositórios (inclusive [AUTH]):** remover o `Log::info(json_encode($this->cobranca))` do `setCobranca()` — achado na execução da Fase 3.
- **Telescope:** `hideRequestParameters([...lista do Requisito 4.2...])` e `hideRequestHeaders([... 'authorization'])`; `TELESCOPE_ENABLED=false` no `.env` de produção e `.env.example`.
- **`config/logging.php`:** `stack` → `['daily']`, `days` 14, nas três APIs. Os valores ficam no `config` e não dependem de env.
- **Teste:** checkout com `Http::fake` para o Asaas (sucesso e erro 400). Depois, `grep` no arquivo de log do teste e em `telescope_entries` por `"ccv"`, pelo número do cartão e pelo CPF: nenhum resultado.

### S5 — Admin da v1

- `Route::middleware(['auth:sanctum', 'admin'])` no grupo `v1/admin` da [API v1]. O middleware `admin` já existe (`EnsureAdmin`); confirmar o alias no `Kernel`.
- **Limpeza em produção (Fase 9):** `DELETE FROM personal_access_tokens WHERE tokenable_id NOT IN (SELECT id FROM users WHERE role='admin')`, só com autorização.

### S9 — Validade e revogação

1. **Frontends primeiro:** interceptor/`fetch` wrapper nos dois fronts; em 401, apagar `genesis_token` e ir para `/login` (FE v2) ou para a tela de login do FE v1. Deploy antes do passo 2.
2. **[AUTH]:** `sanctum.expiration = 10080` (7 dias, D3). Como as APIs v1/v2 validam via `/internal/verify-token` com cache de 45 s, um token vencido para de valer em até 45 s.
3. **[AUTH]:** `ResetPasswordController` → `$user->tokens()->delete()`; `changePassword` → apagar os outros tokens (`where id != currentAccessToken()->id`).
4. **SSE:** o endpoint Laravel `/v1/alertas/stream` já lê o token do cabeçalho. No FE v2, trocar `EventSource` com `?token=` por `fetch` com cabeçalho `Authorization` e leitura do stream, ou por polling (o `/alertas/poll` já existe). Decidir na execução pelo que for menor.

### S7 — Git

- Revogar a chave no Google Cloud (Felipe).
- `git rm` do arquivo e commit.
- Reescrita do histórico conforme D6.
- Workflow `secret-scan` no `.github/workflows` do [API v2] com `gitleaks`. Nos outros repositórios, que não têm CI, um `pre-commit` documentado.

### S8 / S17 — Node do FE v2

- Tirar do `server.ts` o `import("./routes/api.js")`, o `/api/auth/login`, `gerarToken`/`validarToken` e a exigência de `JWT_SECRET`. Apagar `routes/api.js` e `services/database.ts` se nada mais os importar.
- Proxy Bybit: `express-rate-limit` (já é dependência, usado no login) com 60/min por IP. Se a Fase 0 mostrar que o front não usa, remover.

### S10 / S11 — Login

- `RateLimiter::for('login', fn ($r) => [Limit::perMinute(5)->by(strtolower($r->input('email')).'|'.$r->ip()), Limit::perMinute(20)->by($r->ip())])` no [AUTH]. Aplicar `throttle:login` em `login`, `admin-login`, `forgot-password` e `reset-password`. Fazer o mesmo no `admin/login` das APIs v1 e v2.
- `RegisterRequest`, `changePassword` e `resetPassword`: `Password::min(8)->uncompromised()`. O `uncompromised()` consulta a API do Have I Been Pwned por k-anonimato; se ela estiver fora do ar, a checagem passa, o que é o comportamento padrão do Laravel.
- `ForgotPasswordController`: sempre 200 com a mesma mensagem.
- `adminLogin`: o caso "não é admin" passa a lançar a mesma `ValidationException` de credencial inválida.

### S12 — E-mail e vínculo

- **[AUTH]:** `updateProfile` guarda o e-mail novo em `pending_email` e envia um link assinado (`URL::temporarySignedRoute`, 60 min). A rota de confirmação troca o e-mail. Migração nova (`pending_email`), com autorização.
- **APIs v1/v2:** coluna `auth_user_id` (nullable, unique) em `users`. O middleware procura primeiro por `auth_user_id`; se não achar, procura pelo e-mail, grava o `auth_user_id` e segue. Migração nova, com autorização.

### S13 / S14 / S15 / S18

- **[API v1] `macro/today`:** mover para dentro do grupo `genesis.auth`.
- **`gemini-proxy`:** `RateLimiter::for('gemini-proxy', fn ($r) => Limit::perDay(30)->by($r->user()->id))` além do `throttle:5,1`.
- **Modelo `User` das três APIs:** `$hidden` inclui `cpf`, `reference` e `terms`. Os controllers de login devolvem `['id','name','email','role','status']` montado à mão, como `me()`.
- **`config/cors.php`:** `allowed_origins => array_filter(explode(',', env('CORS_ALLOWED_ORIGINS', '')))` + `allowed_origins_patterns => ['#^https://([a-z0-9-]+\.)?genesislabs\.com\.br$#']`. Em `local`, incluir `localhost`.
- **`.env.example` do [AUTH] e da [API v1]:** `APP_DEBUG=false`, `APP_ENV=production`, `LOG_LEVEL=warning`.
- **`ChartMetadataScanController`:** reaproveitar as regras de `image` de `GraphicalAnalysisRequest` (mimetypes e max vindos de config).

## Ordem de Deploy

1. **[AUTH]** com S1 + S3 (este último só com os segredos já preenchidos) + S10/S11 + revogação de token (S9.3), sem a validade ainda.
2. **[API v2] e [API v1]** com S2, S4, S5, S6, S13, S14, S15, S16, S18 (+ migrações autorizadas).
3. **FE v1 e FE v2** com o tratamento de 401 (S9.1) e a limpeza do Node (S8/S17).
4. **[AUTH]** com `sanctum.expiration` (S9.2), só depois do passo 3 no ar.
5. **Limpezas de produção** (Fase 9), cada uma com autorização.
6. **Reescrita do Git** (S7), por último e combinada, porque exige re-clonar ou dar reset no servidor.

## Riscos e Rollback

- **S3 fail-closed com segredo errado:** pagamentos reais deixam de ativar. Mitigação: conferir no painel do Asaas/LastLink e mandar um webhook de teste logo após o deploy. Rollback: esvaziar o segredo **não** é mais rollback (vira 503); o rollback é reverter o commit.
- **S9 validade antes do front:** membros ficam presos em telas de erro. Mitigação: ordem de deploy acima.
- **S1 quebra o quiz em produção** se a [API v2] não for publicada junto com o [AUTH]: o bônus passa a dar 403. Mitigação: publicar [API v2] (S2) antes ou junto do [AUTH] (S1).
- **Migrações (S2, S12):** aditivas (tabela ou coluna nova, nullable). Rollback com `migrate:rollback` do lote.
- **CORS restrito:** se algum domínio legítimo ficar de fora (ex.: `dashboard`/`sandbox` antigos), ele passa a receber erro de CORS. Conferir a lista de sites na Fase 0.

## Testes

- Prova de exploração por achado, na suíte do repositório afetado. Nomes com o ID: `S1CreditoLivreTest`, `S2QuizUmaVezTest`, etc.
- [FE v2]: vitest para o tratamento de 401 e para o `server.ts` sem as rotas antigas (`supertest` ou chamada direta ao app).
- Regressão completa das três APIs ao fim de cada fase.
