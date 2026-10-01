# Plano de Implementação: Correção das Vulnerabilidades de Segurança

## Visão Geral

Ordem: **verificação em produção → dinheiro (S1–S3) → cartão (S4, S6, S16) → acesso (S5, S9) → login (S10–S12) → exposição e custo (S13–S15, S17, S18) → Node do FE v2 (S8) → Git (S7) → limpeza de produção → aceite**.

Cada tarefa de correção começa pela **prova de exploração**: um teste que reproduz o ataque do relatório e confirma que hoje ele funciona. Só depois vem a correção, e o mesmo teste passa a confirmar a recusa.

Relatório de origem: `C:\Users\felip\Downloads\Relatorio-Seguranca-LGPD-Genesis-2026-09-27.pdf`.

Repositórios:
- **[AUTH]** `E:\Programas\wamp64\www\auth genesis` (`master`)
- **[API v2]** `E:\Programas\wamp64\www\genesis-api` (`staging` → produção `genesis2`)
- **[API v1]** `E:\Programas\wamp64\www\genesis-api-v1` (`master`)
- **[FE v2]** este repositório (`staging` → produção `master`)
- **[FE v1]** `E:\Projetos js\G-nesis-Labs-Oficial-1` (`main`)

Regras:
- sem `RefreshDatabase` (sqlite persistente + `DatabaseTransactions`);
- **nenhuma migração, seed ou comando em banco de produção sem perguntar antes**;
- nada em produção (deploy, `.env`, limpeza) sem autorização explícita;
- commit e push só quando o Felipe pedir;
- marcar este arquivo conforme concluir e relê-lo a cada fase.

Decisões pendentes: **D1–D8** em `design.md`. As fases que dependem delas estão marcadas.

## Tarefas

- [ ] 0. Fase 0 — Verificação em produção (só leitura; o Felipe roda ou autoriza)
  - [ ] 0.1 [AUTH] `.env` de produção: `LASTLINK_WEBHOOK_SECRET` e `ASAAS_WEBHOOK_TOKEN` estão preenchidos?
    - _Requisitos: 3.1, 3.5_
  - [ ] 0.2 [AUTH] Listar `last_link_webhooks` desde 21/09/2026 e cruzar com `users` ativados por `activationMode='lastlink'`. Há e-mails sem compra real na LastLink?
    - _Requisitos: 3.5_
  - [ ] 0.3 [AUTH] Auditoria de crédito (consulta do S1 no `design.md`): depósitos pela rota de membro e bônus "Certificação Final" repetidos por usuário
    - _Requisitos: 1.4, 2.1_
  - [ ] 0.4 [AUTH], [API v1] e [API v2]: logs de produção contêm `"ccv"`, `creditCard` ou `cpfCnpj`? Em quais arquivos, desde quando? Há backups com eles? Contar linhas, sem exibir conteúdo
    - _Requisitos: 4.4_
  - [ ] 0.5 [API v2] Contar linhas de `telescope_entries` com `card_` no conteúdo
    - _Requisitos: 4.4_
  - [ ] 0.6 [API v1] Contar tokens em `personal_access_tokens` de quem não é admin
    - _Requisitos: 5.3_
  - [ ] 0.7 [FE v2] O servidor Node de produção tem variáveis de MySQL, `LASTLINK_API_*` ou `ADMIN_USER_ID`? O front usa `/api/bybit` ou `/api/auth/login`?
    - _Requisitos: 8.1, 8.2, 8.3_
  - [ ] 0.8 Repositório `felipemlopes/genesis-api`: é privado? Quem tem acesso?
    - _Requisitos: 7.2_
  - [ ] 0.9 Lista de domínios que chamam as APIs pelo navegador (para o CORS): `v1`, `v2`, landing, `dashboard`/`sandbox` antigos?
    - _Requisitos: 11.4_
  - [ ] 0.10 Registrar o resultado aqui e levar ao Felipe a decisão D8 (comunicação de incidente) se 0.2, 0.3 ou 0.4 acharem algo

- [x] 1. Fase 1 — Crédito só pelo servidor (S1, S2) — executada 28/09/2026, nada commitado
  - **D1 (28/09/2026):** seguida a recomendação do design — bônus uma vez por membro agora; gabarito no servidor fica como melhoria futura (1.7).
  - [x] 1.1 [AUTH] Prova de exploração `S1CreditoLivreTest`: membro chama `/api/credits/adjust` com `credit` e o saldo sobe
    - _Requisitos: 1.1, 12.1_
    - Antes da correção: 2 casos de `credit` falharam com **200 em vez de 403** (ataque funcionava); o caso de débito passou
  - [x] 1.2 [API v2] e [API v1] Prova de exploração `S2QuizUmaVezTest`: duas chamadas a `/v1/assessment/result` com `wrong=0` dão +400
    - _Requisitos: 2.1, 12.1_
    - Antes da correção: 3 chamadas deram **600 em vez de 200** nas duas APIs; penalidade seguida de bônus deu 300 em vez de 100; na [API v2] com a flag ligada o bônus ia pela rota de membro `/api/credits/adjust`
  - [x] 1.3 ~~Migração `user_certifications`~~ **substituída — sem migração**
    - _Requisitos: 2.3_
    - `user_answers` não tem índice único (não serve de marca) e uma tabela nova exigiria autorização para migrar. Em vez disso: **chave de idempotência fixa `certificacao-final`** na transação (no [AUTH], o `adjust-for-user` já ignora a 2ª transação com a mesma chave para o mesmo usuário; na carteira local, `Transaction` com `meta->idempotency_key` é checada antes) + **`Cache::lock('certificacao-final:{user_id}')`** para duas chamadas simultâneas não passarem juntas
  - [x] 1.4 [API v2] e [API v1] `UserAnswerController::result()` com lock + chave fixa; bônus e penalidade via `adjustCreditForUser()` na [API v2] com a flag ligada
    - _Requisitos: 1.3, 2.1, 2.2_
    - [API v2]: erro do [AUTH] (>= 400) agora é repassado ao front (antes era ignorado); resposta `already_processed: true` quando a carteira local já tem a transação
    - [API v1]: só carteira local (o `result()` da v1 nunca usou o [AUTH])
    - `CreditosCompletoUserAnswerControllerTest` ([API v2]) atualizado para a rota interna + chave fixa
    - **Resíduo conhecido:** se a penalidade falhar por saldo insuficiente (402 no [AUTH] / exceção na carteira local), nenhuma transação é gravada e o membro ainda pode resgatar o bônus uma vez depois. Limite: 200 créditos, uma vez
  - [x] 1.5 [AUTH] `CreditController::adjust()`: `credit` → 403 `{"message":"Crédito só pelo servidor."}`; `CreditAdjustTest::test_credito_soma_ao_saldo` virou `test_credito_pela_rota_de_membro_e_recusado`
    - _Requisitos: 1.1, 1.2_
  - [x] 1.6 Rodar 1.1 e 1.2 de novo (agora confirmam a recusa) + suítes do [AUTH], [API v1] e [API v2]
    - _Requisitos: 12.1, 12.2_
    - Provas: [AUTH] 13/13 (S1 + `CreditAdjustTest` + `CreditAdjustForUserTest`), [API v2] 5/5 (S2 + quiz antigo), [API v1] 2/2
    - Suíte [AUTH]: **74/74**. Suíte [API v1]: **28/29** — a falha é `ExampleTest` (`MissingAppKeyException`: a v1 não tem `.env` local), preexistente e sem relação
    - Suíte [API v2]: **1356 passaram, 5 falharam, 13 skipped** — nenhuma regressão: 2 são as conhecidas do `.env` local com `gemini-3.5-flash`; as outras 3 (`ping openai sem chave`, `falha apos esgotar as tentativas`, `consumo acumula os repairs`) passam com o ambiente limpo (`GENESIS_OPENAI_FALLBACK_KEY` vazia e cadeia desligada) — era o `.env` local em modo de teste do fallback
  - [ ] 1.7 Gabarito no servidor — **melhoria futura** (D1): hoje `correct` de cada resposta vem do navegador; com o limite de uma vez, o pior caso é ganhar 200 uma vez sem acertar
    - _Requisitos: 2.4_

- [ ] 2. Fase 2 — Webhooks de pagamento (S3) — **depende de D2 e de 0.1**
  - [ ] 2.1 [AUTH] Prova de exploração `S3WebhookSemAssinaturaTest`: com segredo vazio, `Product_Access_Started` forjado + cadastro ativa a conta; `PAYMENT_RECEIVED` forjado credita
    - _Requisitos: 3.1, 12.1_
  - [ ] 2.2 [AUTH] `VerifyLastLinkSignature` e `VerifyAsaasToken`: segredo vazio → 503 + `Log::warning`
    - _Requisitos: 3.1, 3.2_
  - [ ] 2.3 [AUTH] `asaas()`: confirmar status e valor em `GET /v3/payments/{id}` antes de `depositFloat` (teste com `Http::fake` do Asaas: pago, pendente, valor diferente)
    - _Requisitos: 3.3_
  - [ ] 2.4 [AUTH] LastLink conforme D2: segredo no painel, ou confirmação pela API da LastLink
    - _Requisitos: 3.1_
  - [ ] 2.5 [AUTH] Comando `auth:preflight` acusando segredos vazios em produção
    - _Requisitos: 3.4_
  - [ ] 2.6 Rodar 2.1 de novo + `WebhookTest` + suíte do [AUTH]
    - _Requisitos: 12.1, 12.2_

- [x] 3. Fase 3 — Dados de cartão fora de logs e Telescope (S4, S6, S16) — executada 28/09/2026, nada commitado
  - **D4:** logs retirados agora; tokenização do Asaas fica para depois. **D5:** Telescope desligado por padrão no `.env.example` + campos ocultos (defesa se alguém religar).
  - **Achado novo (corrige o relatório):** o `Log::info(json_encode($this->cobranca))` dentro de `app/Asaas/Cobranca.php` também gravava a cobrança inteira (cartão, CVV, titular) — **inclusive no [AUTH]**, que o relatório tinha dado como limpo. É o checkout principal em produção. Corrigido nos três repositórios
  - [x] 3.1 Prova de exploração `S4CartaoNoLogTest` em [API v1], [API v2] e [AUTH]
    - _Requisitos: 4.3, 12.1_
    - [API v1]/[API v2]: a classe `Asaas` usa Guzzle direto (sem `Http::fake`) — o Asaas aponta para `127.0.0.1:1` e o teste captura o `MessageLogged`. Dois casos: cliente novo (log de `$cliente` com CPF) e cliente existente (log de `$cobranca` com cartão). Antes da correção: **CPF e número do cartão no log** nas duas APIs
    - [AUTH]: a classe `Asaas` usa o `Http` do Laravel — casos aprovado e recusado (400). Sem a correção do `Cobranca.php`: **número do cartão no log nos dois**
  - [x] 3.2 Logs de payload removidos
    - _Requisitos: 4.1_
    - [API v1] e [API v2] `AuthController::store()`/`pix()`: saíram `Log::info(json_encode($cliente))`, `Log::info(json_encode($cobranca))`, `Log::error('ASAAS RESPONSE RAW')`, `Log::info(json_encode($responseData))`, `Log::info(json_encode($pix))` e (v1) o stack trace. Entraram `checkout.asaas.cartao` / `checkout.asaas.pix` com `user_id`, `code`, `cobranca_id`, `status`
    - `app/Asaas/Cobranca.php` dos três repositórios: saiu o `Log::info` da cobrança. Nenhum outro `Log::info` nas classes `Asaas`
  - [x] 3.3 [API v2] `TelescopeServiceProvider`: ocultos os 12 campos do Requisito 4.2 e os cabeçalhos `authorization`, `cookie`, `x-csrf-token`, `x-xsrf-token`, `x-internal-token`; `TELESCOPE_ENABLED=false` no `.env.example`
    - _Requisitos: 4.2_
    - Só a [API v2] tem Telescope
    - **Correção do relatório:** o Telescope **já** escondia `authorization` por padrão (e `password`/`password_confirmation`). O que vazava era cartão, CPF, telefone, `current_password`/`new_password` e o `x-internal-token`
  - [x] 3.4 [API v2] `S6TelescopeOcultaDadosSensiveisTest` (unitário): confere as listas de ocultos — sem a correção falha em `card_number` e `x-internal-token`
    - _Requisitos: 4.3_
  - [x] 3.5 `config/logging.php` das três APIs: `stack` → `['daily']` (14 dias, já configurado)
    - _Requisitos: 11.6_
    - `genesis:custo-ia --log` lia `storage/logs/laravel.log` pelo nome — passou a ler também os `laravel-*.log` diários (`arquivosDeLog()`)
  - [x] 3.6 Rodar 3.1 de novo + suítes
    - _Requisitos: 12.1, 12.2_
    - Provas: [API v2] 2/2, [API v1] 2/2, [AUTH] 2/2; Telescope 2/2
    - Suíte [AUTH]: **76/76**. Suíte [API v1]: **30/31** (mesma `ExampleTest` sem `.env`)
    - Suíte [API v2]: **1361 passaram, 4 falharam, 13 skipped** — só as conhecidas (2 do `.env` local com `gemini-3.5-flash`; 2 do `GraphicalAnalysisAttemptJobTest` dependentes de ordem, que passam isoladas)
    - **Incidente de ambiente (28/09):** a 1ª rodada deu 47 falhas porque havia `bootstrap/cache/config.php` e `routes-v7.php` gerados às 11:04 (alguém rodou `optimize`/`config:cache` nesta máquina — nenhum teste ou comando do projeto faz isso). Com a config em cache o Laravel ignora o `phpunit.xml` e a suíte rodou contra o **MySQL local de desenvolvimento**. Cache limpo com `config:clear` + `route:clear` e suíte refeita. Testes sem `DatabaseTransactions` podem ter deixado linhas no MySQL local
  - **Pendente em produção (Fase 9):** `TELESCOPE_ENABLED=false` no `.env` da [API v2]; `LOG_CHANNEL` pode ficar `stack` (agora aponta para `daily`); apagar dos logs/backups/`telescope_entries` o que já foi gravado — **o [AUTH] também entra na lista (0.4)**

- [ ] 4. Fase 4 — Admin da v1 e tokens (S5, S9) — **depende de D3**
  - [ ] 4.1 [API v1] Prova de exploração `S5AdminSemPapelTest`: token de membro lê `/v1/admin/users` e promove a si mesmo
    - _Requisitos: 5.2, 12.1_
  - [ ] 4.2 [API v1] Middleware `admin` no grupo `v1/admin` (conferir o alias no `Kernel`)
    - _Requisitos: 5.1, 5.2_
  - [ ] 4.3 [AUTH] Prova de exploração: token antigo continua válido depois de `reset-password` e de `password`
    - _Requisitos: 6.2, 12.1_
  - [ ] 4.4 [AUTH] Revogar tokens em `ResetPasswordController` (todos) e `changePassword` (todos menos o atual)
    - _Requisitos: 6.2_
  - [ ] 4.5 [FE v2] e [FE v1] Tratar 401: apagar `genesis_token` e ir para o login (teste vitest no FE v2)
    - _Requisitos: 6.3_
  - [ ] 4.6 [FE v2] Stream de alertas sem `?token=` (cabeçalho via `fetch` ou troca por `/alertas/poll`)
    - _Requisitos: 6.4_
  - [ ] 4.7 [AUTH] `sanctum.expiration` = prazo de D3 — **só publicar depois de 4.5 em produção**
    - _Requisitos: 6.1_
  - [ ] 4.8 Rodar 4.1 e 4.3 de novo + suítes
    - _Requisitos: 12.1, 12.2_

- [ ] 5. Fase 5 — Login (S10, S11, S12) — 5.1–5.4 feitas em 28/09/2026, nada commitado; 5.5/5.6 aguardam autorização de migração
  - [x] 5.1 Provas de exploração: [AUTH] `S10S11LoginTest` (8 casos); [API v1] e [API v2] `S10S11AdminLoginTest` (3 casos)
    - _Requisitos: 9.1, 9.3, 9.4, 12.1_
    - Antes da correção: força bruta sem 429 (login e admin-login), `forgot-password` 200 vs 400, `admin-login` 404 com a senha certa de não-admin, senha de 7 caracteres aceita no cadastro e na troca
  - [x] 5.2 `RateLimiter::for('login')` (5/min por e-mail+IP, 20/min por IP) nas três APIs; `throttle:login` em `login`, `admin-login`, `forgot-password`, `reset-password` ([AUTH]) e `v1/admin/login` ([API v1] e [API v2])
    - _Requisitos: 9.1_
  - [x] 5.3 [AUTH] `Password::defaults()` no `AppServiceProvider`: mínimo 8 sempre; `uncompromised()` (Have I Been Pwned) **só em produção**, para os testes não dependerem de rede. Aplicado em cadastro, troca e redefinição
    - _Requisitos: 9.2_
    - Teste com `Http::fake` do HIBP simulando produção: senha vazada recusada
    - [FE v1] `LandingPage.tsx`: validação local do cadastro subiu de 6 para 8 (senão o membro só levaria o erro depois dos termos)
  - [x] 5.4 `forgot-password` sempre 200 com "Se o e-mail estiver cadastrado, você vai receber um link de recuperação." (o FE v1 já mostrava mensagem neutra); `adminLogin` das três APIs lança a mesma `ValidationException` de credencial inválida
    - _Requisitos: 9.3, 9.4_
  - [ ] 5.5 [AUTH] Migração `pending_email` + confirmação por link assinado — **aguardando autorização para migrar**
    - _Requisitos: 10.1_
  - [ ] 5.6 [API v1] e [API v2] Migração `users.auth_user_id` + `VerifyGenesisAuthToken` casando por id — **aguardando autorização para migrar**
    - _Requisitos: 10.2_
  - [ ] 5.7 Rodar 5.1 de novo + suítes
    - _Requisitos: 12.1, 12.2_
    - Provas: [AUTH] 8/8; [API v1] 3/3; [API v2] 3/3 (sem a correção: 2/3 falham nas duas APIs)
    - Suíte [AUTH]: **84/84**. Suíte [API v1]: **33/34** (mesma `ExampleTest` sem `.env`)
    - Suíte [API v2]: **não terminou** (a sessão caiu no meio) — rodar de novo
  - **Achado fora do escopo (FE v1, não corrigido):** `handleResetPassword` em `LandingPage.tsx` confere `newPassword`/`newPasswordConfirmation`, mas envia `password`/`password_confirmation` (os campos do formulário de cadastro) — a redefinição de senha pelo link provavelmente não funciona

- [x] 6. Fase 6 — Exposição e custo (S13, S14, S15, S18) — executada 29/09/2026, nada commitado
  - **D7:** teto de 30 chamadas/dia por membro, sem cobrar. **0.9:** CORS por padrão `https://*.genesislabs.com.br` (cobre os 6 sites e os antigos) + `localhost` fora de produção; extras por `CORS_ALLOWED_ORIGINS`
  - [x] 6.1 [API v1] `macro/today` dentro do grupo `genesis.auth` — `S13MacroExigeLoginTest`: sem token dava **200**, agora 401; com token continua funcionando
    - _Requisitos: 11.1_
    - O FE v1 nem chama essa rota; o controller já guardava a resposta em cache por dia (custo real era ~1 chamada/dia), mas a rota não precisava ser pública
  - [x] 6.2 [API v2] `RateLimiter::for('gemini-proxy-dia')` (30/dia por membro) + `throttle:gemini-proxy-dia` **depois** do `throttle:5,1` (o cabeçalho `X-RateLimit-*` continua o do limite por minuto) — `S13GeminiProxyTetoDiarioTest`: a 31ª chamada do dia passava, agora 429; outro membro não é afetado. `UtilityGeminiProxyLimitTest` (3) continua verde
    - _Requisitos: 11.2_
  - [x] 6.3 Três APIs: `$hidden` com `cpf`, `reference`, `terms`; `'user' => $user->only(['id','name','email','role','status'])` nas 4 respostas de cada `AuthController` (login, adminLogin, register, updateProfile)
    - _Requisitos: 11.3_
    - [AUTH] `S14RespostaMinimaTest` (3): antes o login/perfil devolviam o cadastro inteiro e `toArray()` tinha `cpf`. [API v1]/[API v2] `S10S11AdminLoginTest::test_login_admin_devolve_so_os_campos_publicos`
    - Nenhum frontend lê `cpf`/`reference` da resposta (FE v1 grava `auth_user` no localStorage mas ninguém lê). `GenesisAuthExport` usa `DB::table()`, não é afetado pelo `$hidden`
    - **Efeito colateral:** listagens do painel admin também deixam de trazer o CPF (nenhum painel deste código mostra CPF)
  - [x] 6.4 Três APIs: `config/cors.php` com `allowed_origins` de `CORS_ALLOWED_ORIGINS` + padrões `https://(sub.)genesislabs.com.br` e, fora de produção, `http://localhost|127.0.0.1:porta` — `S15CorsRestritoTest` (4) nas três: antes qualquer site recebia `*`; domínio parecido (`genesislabs.com.br.site-malicioso.com`) e `http://` recusados
    - _Requisitos: 11.4_
  - [x] 6.5 [AUTH] e [API v1] `.env.example`: `APP_ENV=production`, `APP_DEBUG=false`, `LOG_LEVEL=warning`
    - _Requisitos: 11.5_
  - [x] 6.6 [API v2] `ChartMetadataScanController`: mesmas regras de `image` da análise gráfica (`file`, `image`, `max_kb`, `mimetypes`) — `S18ScanLimiteDeImagemTest`: imagem acima do limite ia para a IA (502 do fake), agora 422 sem chamar a IA. `ChartMetadataScanMarketGateTest` (3) continua verde
    - _Requisitos: 11.7_
  - [x] 6.7 Suítes das três APIs
    - _Requisitos: 12.2_
    - [AUTH] **91/91**. [API v1] **40/41** (mesma `ExampleTest` sem `.env`). [API v2] **1370 passaram, 5 falharam** — só conhecidas: 2 do `.env` local com `gemini-3.5-flash`, 2 do `GraphicalAnalysisAttemptJobTest` (ordem), 1 colisão de e-mail do Faker no sqlite persistente (`f06 preco no horizonte`)

- [x] 7. Fase 7 — Servidor Node do FE v2 (S8, S17) — executada 29/09/2026, nada commitado
  - **0.7:** não confirmado em produção, mas o frontend não usa nenhuma das rotas removidas (chama a API Laravel e o [AUTH]; a Bybit vai direto, com proxies públicos de reserva) — remoção segura em qualquer caso
  - [x] 7.1 Prova de exploração `services/__tests__/s8LegadoNode.test.ts` (banco simulado no cache do `require`, rotas reais): o PUT de carteira levou `SELECT senha FROM users` **para dentro do SQL**; o stream respondeu **200 sem login**
    - _Requisitos: 8.1, 12.1_
  - [x] 7.2 `server.ts` reescrito: saíram `/api/auth/login` (LastLink + JWT), `gerarToken`/`verificarToken`, a exigência de `JWT_SECRET`, o `import("./routes/api.js")`; `git rm` de `routes/api.js`, `routes/package.json` e `services/database.ts`
    - _Requisitos: 8.1, 8.2, 8.4_
    - Dependências `mysql2` e `jsonwebtoken` ficaram no `package.json` (sem uso agora; tirar exige `npm install` e mexe no lockfile)
  - [x] 7.3 Proxy `/api/bybit/*` **removido** (sem uso)
    - _Requisitos: 8.3_
  - [x] 7.4 `vite build` OK; `tsc` sem erro no `server.ts`; `server.ts` sobe **sem `JWT_SECRET`**: `/` e `/dashboard` 200 com `<html lang="pt-BR" translate="no">`, `POST /api/auth/login` 404, `/api/v1/alertas/stream` e `/api/bybit/...` devolvem só a página do site (fallback SPA). Vitest: **472 passaram, 0 falhas**
    - _Requisitos: 12.2_
    - `s8LegadoNode.test.ts` agora tem um bloco que roda sempre (arquivos ausentes; `server.ts` sem as rotas antigas); a prova comportamental fica com `skipIf` (só roda se `routes/api.js` voltar)
    - Testes antigos ajustados: `infrastructure.exploration.test.ts` perdeu o bloco "SSE Endpoint 404" (3 testes que exigiam o SSE **no Node**); `integration.e2e.test.ts` perdeu 3 testes SSE do Node e as linhas que liam `routes/api.js` em 2 testes de timeframe (schema e worker continuam testados). O teste do frontend conectando no stream continua

- [ ] 8. Fase 8 — Segredos no Git (S7) — 8.2 e 8.3 feitas em 29/09/2026, nada commitado; 8.1 é do Felipe; 8.4 **contraria decisão anterior do Felipe**
  - **Achado:** em **30/07/2026 o Felipe decidiu explicitamente não reescrever o histórico** por causa deste dump (`.gitignore` linha 21 e `provas/a04-dump-removido.txt`), e em 31/07 não revogar os tokens daquela época. A recomendação D6 deste design foi escrita sem saber disso
  - [ ] 8.1 Felipe revoga a chave `AIza…` no Google Cloud (1 chave única no dump)
    - _Requisitos: 7.1_
  - [x] 8.2 `git rm --cached genesis_v6_4_proofs/pre-migration-4-dump.sql` — sai do repositório no próximo commit; **a cópia local (27 MB) fica** (as provas de restauração dependem dela) e o `.gitignore` (`genesis_v6_4_proofs/*.sql`) impede que volte. Não commitado
    - _Requisitos: 7.2_
  - [x] 8.3 [API v2] `.github/workflows/secret-scan.yml` (`gitleaks/gitleaks-action@v2`, só os commits do push/PR — o histórico antigo não é reprocessado); README do [AUTH], [API v1], [FE v1] e [FE v2] com a seção "Bloqueio de segredos no commit" (hook `pre-commit` com `gitleaks protect --staged`)
    - _Requisitos: 7.3_
  - [ ] 8.4 Reescrita do histórico — **não feita**; exige o Felipe rever a decisão de 30/07/2026
    - _Requisitos: 7.2_

- [ ] 9. Fase 9 — Deploy e limpeza de produção (cada item com autorização)
  - [ ] 9.1 Deploy na ordem do `design.md` ("Ordem de Deploy")
  - [ ] 9.2 `.env` de produção: `TELESCOPE_ENABLED=false` ([API v2]); segredos dos webhooks ([AUTH])
    - _Requisitos: 3.1, 4.2_
  - [ ] 9.3 Apagar linhas com cartão dos logs e backups de produção (lista da tarefa 0.4)
    - _Requisitos: 4.4_
  - [ ] 9.4 Limpar `telescope_entries` ([API v2])
    - _Requisitos: 4.4_
  - [ ] 9.5 Apagar tokens de quem não é admin em `personal_access_tokens` ([API v1])
    - _Requisitos: 5.3_
  - [ ] 9.6 Estornar créditos indevidos achados em 0.3 (lista revisada pelo Felipe)
    - _Requisitos: 1.4_
  - [ ] 9.7 Rodar `auth:preflight` e `genesis:preflight` em produção

- [ ] 10. Fase 10 — Aceite
  - [ ] 10.1 Repetir contra produção, com uma conta de teste, os ataques de S1, S2, S3, S5, S10 e S13 (6.1): todos recusados
    - _Requisitos: 12.1_
  - [ ] 10.2 Checkout real de baixo valor no FE v1 e confirmar que nada de cartão aparece no log do dia
    - _Requisitos: 4.1_
  - [ ] 10.3 Atualizar o relatório (PDF) com o status de cada achado
