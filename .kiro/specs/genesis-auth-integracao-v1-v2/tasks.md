# Plano de Implementação: Integração `[AUTH]` nas duas APIs e nos dois frontends

**Status deste documento**: criado como planejamento puro em 10/09/2026, a pedido do Felipe ("crie
um plano spec estilo kiro para eu ver mas não altera nada ainda"). **Nenhum item foi executado.**
Nenhum arquivo de código foi tocado — só este `tasks.md` foi criado, a partir de investigação real
(leitura) nos quatro repositórios envolvidos. Este arquivo é para revisão antes de qualquer fase
começar.

## Fontes

Não existe um documento-fonte externo desta vez — este plano nasce da conversa desta sessão
(separação de `genesis-api` em v1/v2, extração da landing, e a pergunta "a integração `[AUTH]` já
está pronta?") mais a investigação de código feita agora, linha por linha, nos quatro
repositórios. Continuação direta de **[[genesis-microservico-auth-creditos]]** (spec já existente,
`.kiro/specs/genesis-microservico-auth-creditos/`) — aquele spec cobre `[AUTH]` + `genesis-api`
(só a v2); este cobre o que falta pra v1 (frontend e API) também funcionarem com `[AUTH]`.

## Repositórios envolvidos

| Codinome | Caminho | Git | Branch/HEAD |
|---|---|---|---|
| **[API v2]** | `E:\Programas\wamp64\www\genesis-api` | sim | `genesis2` — trabalho do hotfix desta sessão ainda não commitado |
| **[API v1]** | `E:\Programas\wamp64\www\genesis-api-v1` | sim (clone local de [API v2], criado hoje) | `master` — sem commits próprios, é o ponto de onde `genesis2` nasceu |
| **[FE v2]** | `C:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main` | sim | `master` |
| **[FE v1]** | `E:\Projetos js\G-nesis-Labs-Oficial-1` | sim, **repositório totalmente independente**, histórico próprio | `main`, HEAD `669ba27` |
| **[AUTH]** | `E:\Programas\wamp64\www\auth genesis` | **não é repositório git** (achado novo, ver abaixo) | — |

---

## Verificação contra o código real (10/09/2026) — antes de aceitar qualquer item

### Achado crítico 1 — `[AUTH]` nunca foi versionado

`E:\Programas\wamp64\www\auth genesis` **não tem `.git`** — `git branch` devolve `fatal: not a
git repository`. Isto é verdade apesar do serviço estar, pela memória de specs anteriores,
"construído e testado de ponta a ponta" com 31 testes e uma migração real de 205 usuários/19,8k
transações. Ou seja: todo esse trabalho existe só no disco desta máquina, sem histórico, sem
backup de versão, sem possibilidade de comparar mudanças. Isto é um risco em si mesmo, independente
da integração v1 — sinalizado como item de Fase 0.

### Achado crítico 2 — `[API v1]` não tem NENHUM código de integração com `[AUTH]`

Confirmado por grep: `config/services.php` de `[API v1]` **não tem** a chave `genesis_auth`.
`GenesisAuthClient.php`/`VerifyGenesisAuthToken.php` **não existem** nesse repositório. Faz sentido:
esses arquivos foram criados na sessão do spec `genesis-microservico-auth-creditos`, direto na
branch `genesis2`, e **nunca foram commitados** (continuam como `?? ` no `git status` de
`[API v2]` até hoje) — `master` (de onde `[API v1]` foi clonado) nunca teve chance de recebê-los,
commitados ou não. `[API v1]` hoje autentica 100% via Sanctum local, exatamente como sempre foi.

### Achado crítico 3 — `[FE v1]` também não tem nenhuma noção de `[AUTH]`

`E:\Projetos js\G-nesis-Labs-Oficial-1\services\api.ts` (arquivo inteiro, 18 linhas) é um cliente
axios simples: `baseURL: process.env.API_BASE_URL` (hoje, no `.env` local, aponta pra
`http://127.0.0.1:8000/api/v1` — ou seja, `[API v1]`/`[API v2]` compartilhado pela mesma porta em
dev, nunca `[AUTH]`), com um interceptor que injeta `Authorization: Bearer <token>` a partir de
`localStorage.getItem('auth_token')`. Sem `VITE_AUTH_API_URL` nem equivalente — 13 arquivos
(`App.tsx`, `CreditsHistory.tsx`, `SubscriptionPage.tsx` etc.) chamam a API através desse cliente
único, então qualquer mudança de mecanismo de auth só precisa mexer neste um arquivo + no fluxo de
login, não nos 13.

### Achado crítico 4 — por que "trocar pra `genesis.auth`" quebraria `[FE v1]` especificamente

`[AUTH]` (`routes/api.php`) emite **seus próprios tokens Sanctum**, num banco (`genesis_auth`)
inteiramente separado do banco de `[API v1]`/`[API v2]`. `[AUTH]` também expõe
`GET /internal/verify-token`, documentado no próprio arquivo como "consumido só por outras APIs do
sistema (ex.: genesis-api), nunca pelo frontend" — é o endpoint que
`VerifyGenesisAuthToken`/`genesis.auth` (em `[API v2]`) chama pra validar um token.

Consequência direta: um token emitido pelo `/login` de `[API v1]` ou `[API v2]` (Sanctum LOCAL,
banco de cada API) **não existe** no banco do `[AUTH]` — `verify-token` reprovaria. Por isso o
item 9.4 do spec anterior ("trocar `auth:sanctum`→`genesis.auth` nas rotas reais") só pode
acontecer, para um frontend específico, **depois** desse frontend passar a logar contra `[AUTH]`
diretamente (como `[FE v2]` já faz, opcionalmente, via `VITE_AUTH_API_URL` — ver
`services/api.ts:9-13` de `[FE v2]`) — nunca antes.

### Achado crítico 5 — a pergunta "bancos separados" não tem resposta local pra v1

`[API v2]` real (`.env` local): `DB_DATABASE=genesisteste`. `[AUTH]`: `DB_DATABASE=genesis_auth`
— confirmadamente **dois bancos diferentes já hoje**, por desenho (a migração do spec anterior foi
justamente `genesisteste` → `genesis_auth`).

`[API v1]`, porém, **não tem `.env` nenhum** — só `.env.example` com um placeholder genérico
(`DB_DATABASE=laravel`). Como `.env` nunca é versionado (correto, é segredo), o clone local não
carrega nenhuma pista de qual banco a implantação REAL de v1 (ex.: o que serve
`teste.genesislabs.com.br`) usa hoje. **Não dá pra responder essa pergunta lendo código — só o
Felipe sabe se a implantação real de v1 aponta pro MESMO servidor/banco de `genesisteste`
(histórico comum, já que `master` é literalmente o ponto de onde `genesis2` nasceu) ou pra um banco
próprio.** Isto vira a Decisão D1 abaixo — é o item central que bloqueia o resto do plano de dado.

### Confirmado do spec anterior (`genesis-microservico-auth-creditos`), reconferido nesta sessão

- Item 9.4 (o corte real) segue **não executado**, por decisão explícita do Felipe (repetida nesta
  conversa: "não é pra excluir nem fazer nada" nas tabelas locais — mais conservador ainda que o
  texto original do item, que previa "arquivar").
- Achado de segurança da Fase 10 daquele spec, **ainda não corrigido**: nem `[API v1]` (então
  ainda só a branch `master` dentro do mesmo repositório) tem os middlewares de proteção de webhook
  (`webhook.lastlink`/`webhook.asaas`/`webhook.idempotency`) nem idempotência no `CreditController`.
  Felipe já sinalizou nesta conversa que quer tratar isso depois, separado — mantido fora do
  escopo deste plano, só repetido aqui pra não se perder.

---

## Decisões que precisam do Felipe antes de qualquer fase avançar

**Todas resolvidas na Fase 0 (10/09/2026, via AskUserQuestion) — ver detalhe lá.** Resumo: D1 =
bancos separados; D2 = frontend v1 loga direto no `[AUTH]`; D3 = sim, versionar `[AUTH]`; D4 =
manter branch `master` em `[API v1]`; D5 = segue o default (construído, não ativado).

- [x] **D1 — De onde vem o banco de dados real de `[API v1]` em produção?** Compartilha o MESMO
      servidor/schema que `[API v2]` usa hoje (`genesisteste` ou o nome real de produção), ou é um
      banco próprio, já separado? Sem essa resposta não dá pra saber se existe uma segunda base de
      usuários pra migrar pro `[AUTH]` (como a Fase 9 do spec anterior fez pra v2) ou se os
      usuários de v1 e v2 já são literalmente as mesmas linhas.
- [x] **D2 — `[FE v1]` deve logar direto no `[AUTH]`** (replicando o padrão que `[FE v2]` já tem
      via `VITE_AUTH_API_URL`), **ou deve continuar logando em `[API v1]`**, que por sua vez
      proxyaria pro `[AUTH]` internamente (replicando o `GenesisAuthClient` que `[API v2]` já tem,
      só que para login também, não só consumo de crédito)? As duas funcionam; mudam onde o
      trabalho de integração se concentra (frontend vs backend de v1).
- [x] **D3 — `[AUTH]` deve virar um repositório git próprio antes de qualquer mudança nele?**
      Recomendação forte: sim, antes de tocar em qualquer linha — hoje uma mudança errada não tem
      como ser revertida (`git checkout`/`git diff` não existem sem `.git`). Baixo risco, poucos
      minutos.
- [x] **D4 — Nome/branch de `[API v1]` daqui pra frente.** Hoje é `master`, mesmo nome de sempre —
      confirmar se fica assim ou se ganha um nome próprio agora que é um repositório fisicamente
      separado (evita confusão com o "master" antigo, que só existia como branch dentro do mesmo
      repositório de `[API v2]`).
- [x] **D5 — Ordem de exposição:** a integração de `[FE v1]`/`[API v1]` com `[AUTH]` deve ficar
      **pronta e testada, mas com a mesma flag "construído, não ativado"** que a v2 usa hoje
      (`GENESIS_AUTH_ENABLED`/`VITE_AUTH_API_URL` continuam `false`/vazio até segunda ordem), ou
      existe alguma pressão pra v1 já nascer ativada? Presumindo a primeira opção (mesmo padrão já
      usado em todo o resto deste projeto) até o Felipe dizer o contrário.

---

## Escopo deste plano

Fechar a lacuna real: hoje só `[API v2]` tem código de integração (não ativado) com `[AUTH]`;
`[API v1]`, `[FE v1]` e `[FE v2]` (login) não têm nada rodando de verdade ainda. O objetivo é
todos os quatro chegarem no mesmo estado — **construído e testado, flag desligada** — pra o corte
real (Fase 9.4 do spec anterior, expandida aqui pra incluir v1) virar uma decisão de configuração,
não mais de código.

**Definição de pronto por fase**: código escrito **e** teste automatizado cobrindo o caminho novo
(feliz e de erro) **e** confirmação de que a flag correspondente continua desligada por padrão —
nenhuma fase deste plano liga `GENESIS_AUTH_ENABLED`/equivalente em produção.

---

## Fase 0 — Antes de mexer ✅ concluída (10/09/2026)

- [x] **D1 resolvida (AskUserQuestion): bancos separados.** v1 e v2 têm bancos próprios, já hoje —
      confirma que existe uma segunda base de usuários real, que a Fase 2 (item condicional do
      `GenesisAuthExport`) precisa migrar pro `[AUTH]` quando chegar a hora — não é o mesmo caso de
      "usuários já estão lá" que seria verdade se fosse o mesmo banco.
- [x] **D2 resolvida (AskUserQuestion): `[FE v1]` loga direto no `[AUTH]`** — mesmo padrão que
      `[FE v2]` já tem pronto (`VITE_AUTH_API_URL`), replicado lá. A Fase 3 abaixo já estava
      desenhada pra este caminho como principal; fica confirmado, não mais hipótese.
- [x] **D3 resolvida (AskUserQuestion): sim, pode inicializar git em `[AUTH]`** — vira o primeiro
      passo real da Fase 1.
- [x] **D4 resolvida (AskUserQuestion): `[API v1]` mantém o nome de branch `master`** — sem
      renomear.
- [x] **D5 — sem pergunta separada, seguido o default já proposto no plano**: a integração nova
      (Fases 1-3) nasce com a mesma doutrina "construído, não ativado" que `[API v2]`/`[FE v2]` já
      usam hoje — nenhuma flag liga sozinha em nenhuma fase deste plano.
- [x] **Git status dos quatro repositórios, checado agora**: `[API v2]` 31 arquivos não commitados
      (esperado — é o hotfix desta sessão, Fases 1-6, nenhum deles conflita com o que este plano
      toca). `[API v1]` limpo (0). `[FE v2]` 11 não commitados (mesmo hotfix, mesmo raciocínio).
      `[FE v1]` limpo (0). Nenhum conflito real com as Fases 1-3 abaixo (que tocam só `[AUTH]`,
      `[API v1]` e `[FE v1]` — nunca escrevem em `[API v2]`/`[FE v2]`, só leem deles como fonte pra
      copiar).
- [x] **Baseline de testes, checado agora**: `[API v1]` tem `tests/Feature`/`tests/Unit` (herdados
      do clone), mas **sem `.env` nenhum** — rodar a suíte de lá provavelmente precisa do mesmo tipo
      de bootstrap sqlite que `[API v2]` já usa (ver [[feedback_db_authorization]]); não confirmado
      ainda se roda hoje, verificar na Fase 2 antes de escrever testes novos lá. `[FE v1]` **não tem
      nenhum script de teste** no `package.json` nem arquivo `*.test.*` — sem suíte automatizada;
      qualquer verificação da Fase 3 ali precisa ser manual (documentada), não pode prometer
      cobertura automatizada que não existe.

## Fase 1 — `[AUTH]` sob controle de versão (achado crítico 1) ✅ concluída (10/09/2026)

- [x] `.gitignore` já existente conferido antes de qualquer coisa — já adequado (exclui `.env`,
      `vendor/`, `node_modules/`, `storage/*.key`, o sqlite de teste dedicado; até já tem um
      comentário citando `[[feedback_db_authorization]]`, sinal de que foi escrito seguindo a mesma
      disciplina de outras partes do projeto). Não precisou de ajuste.
- [x] `git init` rodado. `git add -A` + checagem explícita de que nenhum `.env` real entrou no
      commit (só `.env.example`) — confirmado antes de commitar, não depois.
- [x] Primeiro commit: `857f3f3` (branch `master`, padrão do `git init` do Laravel), 122 arquivos,
      14.385 inserções — o estado atual do serviço, nada de conteúdo alterado.
- [x] Sem remote — local só, conforme D3/mesmo padrão adotado pra `[API v1]` nesta sessão.

## Fase 2 — Portar a integração de `[API v2]` pra `[API v1]` (achado crítico 2) ✅ concluída (10/09/2026)

- [x] Copiado (adaptando o que era específico de v2) `app/Services/GenesisAuthClient.php`,
      `app/Http/Middleware/VerifyGenesisAuthToken.php`, a entrada `genesis_auth` em
      `config/services.php`, e a chave `genesis.auth` em `app/Http/Kernel.php` de `[API v2]` pra
      `[API v1]` — cada arquivo levou um docblock citando a proveniência e o que foi conferido antes
      de copiar (ex.: `users.role`/`users.status` existem nas duas bases, confirmado via
      `2014_10_12_000000_create_users_table.php` de `[API v1]` antes de portar
      `VerifyGenesisAuthToken`).
- [x] **Não aplicado a nenhuma rota** — mesmo estado "construído, não ativado" que `[API v2]` tem
      hoje (`GENESIS_AUTH_URL`/`GENESIS_AUTH_ENABLED=false` só em `.env.example` novo de
      `[API v1]`; `CreditController::consume()` ganhou o desvio condicional no topo do método, igual
      a `[API v2]`, mas o resto do método — a via Bavix Wallet local — segue intocado e é o único
      caminho que roda de verdade hoje).
- [x] Portados (idênticos a `[API v2]`, rota `/api/v1/consume/{type}` confirmada igual nas duas
      bases) os testes `CreditControllerGenesisAuthTest.php` e `VerifyGenesisAuthTokenTest.php` pra
      `[API v1]` — **7/7 passando** (`php artisan test --filter=...`).
- [x] `GenesisAuthExport.php` portado com um desvio real e documentado: `lastlink_accesses`
      (existe em `[API v2]`) **não existe** nas migrations de `[API v1]` — removido da lista antes
      de portar (confirmado por grep nas migrations, não por suposição). As outras seis tabelas
      (`users`/`wallets`/`transactions`/`plans`/`subscriptions`/`last_link_webhooks`) existem nas
      duas bases. Comando não foi executado (é a ferramenta que a Fase 4/migração de dados usaria,
      fora de escopo rodar agora) — só construído e revisado.
- [x] **Achado de infraestrutura de teste, resolvido nesta fase**: `[API v1]` nunca teve
      `vendor/` (composer nunca rodado) nem `tests/bootstrap-sqlite.php`/config sqlite dedicada no
      `phpunit.xml` (`DB_CONNECTION`/`DB_DATABASE` vinham comentados) — ou seja, a suíte de testes
      deste repositório nunca tinha sido de fato executável. Corrigido replicando exatamente o
      padrão de `[[feedback_db_authorization]]` já usado em `[API v2]`: `composer install` rodado,
      `tests/bootstrap-sqlite.php` copiado verbatim, `phpunit.xml` apontado pra ele + env
      `sqlite`/`database/testing.sqlite` habilitado, `/database/testing.sqlite` no `.gitignore`.
      Nenhum teste usa `RefreshDatabase` (`DatabaseTransactions` nos dois arquivos novos).
- [x] Suíte completa rodada depois de tudo — **8 passed / 1 failed**, e a única falha
      (`Tests\Feature\ExampleTest`, o teste de exemplo padrão do Laravel, `MissingAppKeyException`)
      é **pré-existente e sem relação com esta fase**: `[API v1]` nunca teve um `.env` real (só
      `.env.example`), então `APP_KEY` nunca foi gerada — isso já seria verdade com ou sem qualquer
      mudança desta fase (o erro vem do `EncryptionServiceProvider`, nada a ver com sqlite/rotas/
      middleware novos). Sinalizado, não corrigido — gerar um `.env`/`APP_KEY` reais é decisão de
      setup do Felipe, fora do escopo desta fase.

## Fase 3 — `[FE v1]` ganha capacidade de logar via `[AUTH]` (achado crítico 3) ✅ concluída (10/09/2026)

D2 confirmada: `[FE v1]` loga DIRETO no `[AUTH]` (não via proxy de `[API v1]`).

- [x] `services/api.ts` de `[FE v1]` ganhou `authPath(path)` (mesmo princípio de `authPath()` em
      `[FE v2]`, mais simples aqui porque os nomes de segmento são iguais nos dois lados —
      `/login`, `/register`, `/forgot-password`, `/reset-password`): retorna o `path` local sem
      mudança quando `AUTH_API_URL` está vazio (default), ou uma URL absoluta
      `${AUTH_API_URL}/api/auth${path}` quando setado — uma URL absoluta como argumento do axios já
      ignora o `baseURL` da instância sozinha, não precisou de uma segunda instância. Variável nova
      segue a convenção REAL deste projeto (confirmada lendo `vite.config.ts`/`.env` antes de
      escrever qualquer código): `AUTH_API_URL` sem prefixo `VITE_`, exposta via `define` em
      `vite.config.ts`, igual a `API_BASE_URL`/`AI_GATEWAY` — não a convenção `VITE_*` de `[FE v2]`.
- [x] Confirmado contra o código real de `[AUTH]` (`routes/api.php`) antes de escrever: existem de
      fato `/api/auth/login`, `/register`, `/forgot-password`, `/reset-password`, e
      `AuthController::login/register` devolvem `{ access_token, token_type, user }` — o MESMO
      formato que `LandingPage.tsx` já desestrutura hoje. Zero mudança de parsing necessária nos
      quatro handlers (`handleStartLogin`, `finalizeRegistration`, `handleForgotPassword`,
      `handleResetPassword`).
- [x] `LandingPage.tsx` (único ponto real de login/registro/senha em `[FE v1]`, confirmado por
      grep — `AdminPanel.tsx`/`RoadmapPage.tsx` só tinham a palavra "login" em texto estático) —
      as quatro chamadas (`api.post('/login', ...)` etc.) trocadas por
      `api.post(authPath('/login'), ...)` etc.
- [x] `.env` local ganhou `AUTH_API_URL=` (vazio — comportamento de hoje preservado). Criado
      `.env.example` — **não existia nenhum antes nesta fase**, documentando as variáveis já
      existentes (sem segredo real, todas já vazias no `.env` local) mais a nova.
- [x] `[FE v1]` confirmado sem suíte de teste automatizado (sem script `test`, sem `*.test.*`) —
      verificação feita por dois meios objetivos em vez de "parece certo": (1) `npx tsc --noEmit`
      antes/depois do diff (`git stash`) mostra os MESMOS 2 erros pré-existentes
      (`App.tsx:604`, `MindMetrics.tsx:209`, nenhum relacionado a esta fase) — zero erro novo; (2)
      `vite build` real rodado duas vezes: com `AUTH_API_URL` vazio o literal `api/auth` **some**
      do bundle (esbuild eliminou o branch morto — prova que o estado "não ativado" é
      genuinamente inerte, não só "parece" desligado); com `AUTH_API_URL` setado pra um valor de
      teste o literal `api/auth` **aparece** no bundle (prova que o caminho novo é real e
      alcançável). `.env` restaurado ao estado original (`AUTH_API_URL=` vazio) depois do teste.
      Isto substitui, com uma garantia mais forte que a prevista no plano original, o "teste manual
      documentado" — mas **não substitui um clique real** (login de verdade contra `[AUTH]` rodando)
      antes da Fase 4.

## Fase 4 — Corte real expandido (era só a Fase 9.4 do spec anterior, agora cobre os 4)

**Planejamento detalhado feito em 10/09/2026, a pedido do Felipe ("planejar a Fase 4 em detalhe
primeiro"), D6 resolvida (corte seco) — depois, autorizado a executar ("pode executar, mas não
pode dar refresh no banco de dados em hipótese nenhuma").**

### ⚠️ Achado que bloqueou o corte real de verdade nesta sessão — pré-voo (4.2) reprovado

Antes de tocar em qualquer flag real, o pré-voo achou dois problemas que impedem o corte de
produção **hoje**, a partir deste ambiente:

1. **`[AUTH]` não estava rodando** (porta 8001 sem nada escutando).
2. **Este ambiente (`E:\Programas\wamp64\www\...`, `E:\Projetos js\...`) parece ser só
   desenvolvimento local nesta máquina, não o servidor de produção real** — `APP_URL` de
   `[API v2]` aponta pra `localhost:8000`, não existe vhost do Apache/WAMP pra nenhuma das APIs
   Genesis, e não foi encontrado nenhum script/config de deploy (Forge, Envoyer, CI, SSH) em
   nenhum dos quatro repositórios. **Achado extra, fora do escopo direto mas relevante**: a porta
   8000 (que `[API v1]`/`[FE v1]` presumem ser `[API v2]` via `API_BASE_URL`) está, na verdade,
   sendo usada por um processo de OUTRO projeto (`E:\Projetos js\neural\backend`), sem relação com
   Gênesis — confirmado pelo stack trace de uma resposta 404. Não é um problema deste spec, só
   uma pegadinha de porta que valeu registrar.

Diante disso, Felipe escolheu (via `AskUserQuestion`) **"ensaio local completo"**: validar o
mecanismo inteiro de ponta a ponta, 100% local, sem tocar em produção nenhuma. Isso foi feito e
**deu certo em cheio** — ver abaixo. **O corte real de produção (a janela de 4.3 de verdade)
continua não executado** — só o ensaio.

### ✅ Ensaio local completo executado (10/09/2026) — mecanismo provado de ponta a ponta

Passo a passo real, sem mock, no par v2:

1. `[AUTH]` subido localmente (`php artisan serve --port=8001`, antes fora do ar).
2. `[API v2]` subido localmente (`php artisan serve --port=8002` — não deu pra usar 8000, ocupada
   pelo projeto `neural` alheio, ver achado acima).
3. Usuário de ensaio criado via `/api/auth/register` real do `[AUTH]`
   (`rehearsal-fase4-teste@genesislabs.com.br`) — nasceu inativo (regra de negócio real: precisa
   de um webhook Lastlink ou ativação manual), ativado com uma única `UPDATE` direta por email
   (não é refresh de banco — é uma escrita pontual na própria linha que acabou de ser criada,
   igual ao que a suíte de testes já faz).
4. Login real via `/api/auth/login` do `[AUTH]` → token Sanctum real emitido pelo banco
   `genesis_auth`.
5. **Rota de `[API v2]` temporariamente trocada pra `genesis.auth`** (só localmente, um `git diff`
   de uma linha, revertido ao final) + `GENESIS_AUTH_ENABLED=true` só no `.env` local: sem token →
   `401`; **com o token do `[AUTH]` → `200`, autenticou e materializou um usuário local novo por
   email**, exatamente como `VerifyGenesisAuthToken` promete desde a Fase 2.
6. `POST /v1/consume/radar` com o mesmo token: sem crédito → `402 "Créditos insuficientes!"`
   (real, veio do `[AUTH]`); depositado R$10 de crédito de teste (`depositFloat`, uma escrita
   pontual no wallet do usuário de ensaio) → `402 "Saldo: 10.00, necessário: 50"` (prova que o
   valor certo do radar está sendo checado de verdade); depositado mais R$100 → **`200
   {"credits":"60.00"}`** — `110 - 50 = 60`, exato. **Prova completa: registro → login → token do
   `[AUTH]` → autenticação no `[API v2]` → consumo de crédito repassado, tudo com dados e HTTP
   reais, zero `Http::fake()`.**
7. **Limpeza feita ao final, confirmada por query**: código revertido (`routes/api.php`/`.env` de
   `[API v2]` voltaram ao estado exato de antes — `git status` mostra os mesmos 31 arquivos
   pré-existentes, nenhum a mais); usuário/wallet/transactions/tokens de ensaio apagados dos dois
   bancos (`genesis_auth` e o local de `[API v2]`), confirmado por contagem zerada depois; os dois
   servidores locais (portas 8001/8002) parados, incluindo um processo filho do `php artisan
   serve` que sobreviveu ao primeiro `TaskStop` e precisou de `taskkill` explícito.
8. `[API v1]`/`[FE v1]` **não passaram por um ensaio ao vivo simétrico** — `[API v1]` não tem
   nenhum `.env` real (achado da Fase 2, banco de dev próprio desconhecido), então não dá pra
   subir um servidor de verdade pra ele sem inventar uma configuração de banco nova, o que não foi
   pedido nem parece prudente fazer de graça. A confiança no lado v1 continua vindo dos 7/7 testes
   automatizados da Fase 2 (mesmo código, portado byte a byte) — não de uma chamada HTTP real como
   aconteceu aqui pro par v2.

**Conclusão do ensaio**: o mecanismo de corte seco funciona exatamente como desenhado. O que falta
pra rodar de verdade em produção não é mais código — é (a) achar/confirmar onde o `[AUTH]` real
vai rodar em produção e subir ele lá, e (b) repetir a Fase 4.2 (pré-voo) contra esse ambiente real,
não contra este local. Autorização pra começar esta fase é separada da aprovação deste plano, e é
dada sub-fase por sub-fase (4.1, 4.2, ...), não de uma vez.

### Achado central desta análise — por que "rota por rota" sozinho não é seguro

A leitura de `Achado crítico 4` (acima) tem uma consequência que o texto original da Fase 4 não
tinha capturado: um usuário só passa a ter um token aceito por `[AUTH]`/`genesis.auth` **depois**
de logar de novo contra `[AUTH]`. Se o frontend correspondente troca de fonte de login e, no mesmo
instante, só ALGUMAS rotas daquela API trocam pra `genesis.auth` (as outras continuam em
`auth:sanctum` local), qualquer usuário que релogar puxa um token que as rotas ainda-não-trocadas
vão rejeitar — porque esse token nunca existiu no banco Sanctum local. Ou seja, "rota por rota"
dentro de uma mesma API só funciona se as rotas ficarem crescentemente **compatíveis com os dois
tipos de token ao mesmo tempo**, não se elas simplesmente alternam entre um guarda e outro.

### D6 — Mecanismo do corte — ✅ resolvida (10/09/2026, via AskUserQuestion): **corte seco**

Felipe escolheu corte seco em vez de aceitação dupla (a opção recomendada, mas com mais código
novo pra construir e testar antes de cortar). Consequência aceita conscientemente: no minuto em
que as rotas autenticadas de uma API trocam de `auth:sanctum` pra `genesis.auth`, **todo mundo com
sessão local ativa naquela API recebe 401 até logar de novo** — não tem meio-termo gradual. Não
precisa de nenhum middleware novo — usa o `VerifyGenesisAuthToken`/`genesis.auth` que já existe nas
duas APIs desde a Fase 2, só falta aplicá-lo às rotas de verdade.

### Achado operacional importante do corte seco — por que backend e frontend têm que virar juntos

`/login` continua sendo uma rota PÚBLICA em `[API v1]`/`[API v2]` (não passa por `auth:sanctum` nem
vai passar por `genesis.auth` — login em si nunca exige token). Isso cria uma armadilha se as duas
metades de um par virarem em momentos diferentes:

- Se as rotas autenticadas da API virarem `genesis.auth` **antes** do frontend trocar a fonte de
  login: qualquer pessoa que logar nesse intervalo (via `/login` local, que continua de pé) recebe
  um token Sanctum LOCAL novinho — que as rotas recém-trocadas vão rejeitar igual às sessões
  antigas. Login parece funcionar (200 OK) e trava no primeiro clique seguinte.
- Se o frontend trocar a fonte de login **antes** da API trocar as rotas: o token que volta do
  `[AUTH]` ainda não é aceito por nenhuma rota da API (que continua em `auth:sanctum` local) — 401
  imediato pra todo mundo que logar nesse intervalo, mesmo sendo um login "bem-sucedido" no
  `[AUTH]`.

Não tem uma ordem seguro entre os dois lados de um par — **as duas metades têm que fazer deploy na
mesma janela de manutenção, o mais próximo possível uma da outra**, aceitando alguns minutos onde
login pode falhar pra quem tentar bem no meio da troca. Isso é inerente à escolha do corte seco, e
o Felipe já escolheu essa opção sabendo do trade-off.

### Sub-fases

- [ ] **4.1 — Ordem entre os dois pares**: `[API v2]`/`[FE v2]` primeiro (é o par com a integração
      mais madura e mais testada até aqui — `GenesisAuthClient`/`VerifyGenesisAuthToken` existem lá
      desde o spec anterior, não só desde ontem), `[API v1]`/`[FE v1]` só depois do par v2 provar
      estável por um período (Felipe define quanto tempo — sugestão: pelo menos alguns dias de uso
      real sem incidente). Nunca os dois pares no mesmo dia.
- [ ] **4.2 — Pré-voo do par v2, antes de agendar a janela**: reconfirmar que `[AUTH]` está de pé e
      respondendo (`/api/auth/login`, `/internal/verify-token`), reconfirmar que os 205
      usuários/19,8k transações migrados na Fase 9 do spec anterior ainda batem
      (`genesis-microservico-auth-creditos`), rodar de novo a suíte de `[API v2]` inteira uma
      última vez antes do dia combinado.
- [ ] **4.3 — Janela de corte do par v2** (evento único, agendado, de preferência horário de baixo
      tráfego; avisar usuários antes é decisão do Felipe, não deste plano):
      1. Deploy de `[API v2]`: TODAS as rotas autenticadas trocam `auth:sanctum` → `genesis.auth`
         de uma vez (não dá pra fazer gradual sob corte seco — ver achado acima), e
         `GENESIS_AUTH_ENABLED=true` junto (o `CreditController::consume()` só faz sentido com
         tokens já vindos do `[AUTH]`).
      2. Deploy de `[FE v2]` com `VITE_AUTH_API_URL` setado, o mais imediatamente possível depois
         do passo 1 (mesma janela, não no dia seguinte).
      3. Verificação imediata pós-deploy: login real de uma conta de teste, um consumo de crédito
         real de teste, checagem de logs por pico anômalo de 401 nos primeiros minutos.
      Critério de rollback: qualquer coisa fora do esperado no passo 3 → reverter os dois deploys
      (env volta ao estado anterior + `config:clear` nas duas pontas). **Assimetria importante pro
      Felipe saber**: um rollback não é 100% limpo — qualquer usuário que tiver logado via `[AUTH]`
      durante a janela também vai precisar logar de novo depois do rollback, porque o token dele
      (emitido pelo `[AUTH]`) não vai ser aceito de volta pelo `auth:sanctum` local.
- [ ] **4.4 — Repetir 4.2-4.3 pro par v1**, só depois do 4.1 confirmar que v2 está estável.
- [ ] **4.5 — Descontinuação do caminho antigo** (só depois dos dois pares estáveis por um tempo
      que o Felipe definir): revogar os tokens Sanctum locais que ainda sobrarem (de quem não abriu
      o app desde o corte) pra forçar a última leva de usuários a passar pelo `[AUTH]` no próximo
      login. **Nunca inclui excluir ou arquivar as tabelas locais** (`users`/`wallets`/
      `transactions` de `[API v2]`) — instrução direta do Felipe, já registrada acima; elas só
      páram de ser a fonte de verdade. Vale também remover/redirecionar o `/login` local de cada
      API nesse momento, já que ele fica um beco sem saída depois do corte (autentica contra o
      banco local mas nenhuma rota mais aceita o token resultante).

## ✅ Fase 4 EXECUTADA DE VERDADE em produção (10/09/2026) — corte real, não mais ensaio

Contexto que mudou o plano acima: no mesmo dia, um deploy real de produção inteiro foi feito num
VPS novo (CloudPanel, ver [[project_producao_cloudpanel_deploy]]) — `[API v1]`, `[API v2]` e
`[AUTH]` subiram em bancos **novos, vazios, zero usuário real**, bem diferente do cenário original
desta Fase 4 (que presumia a base antiga com 205 usuários reais migrados). Diante disso, e com
autorização explícita do Felipe ("pode colocar como true o GENESIS_AUTH_ENABLED" +
`AskUserQuestion` escolhendo "corte completo agora"), **os dois pares (v1 e v2) foram cortados
juntos, no mesmo dia** — diferente do 4.1/4.4 originais (v2 primeiro, esperar dias, só depois v1).
Justificativa: sem usuário real em nenhum dos dois bancos, o risco que motivava esperar
(quebrar sessão de gente de verdade) não existia — não tinha ninguém pra quebrar.

**Achado que quase virou incidente, pego antes de causar dano**: ao tentar fazer o corte, descobriu-se
que **nem `[API v1]` nem `[API v2]` tinham o código da Fase 2/da integração `[AUTH]` commitado no
GitHub** — os dois estavam só locais nesta máquina (mesmo achado já registrado em
[[project_auth_integracao_v1_v2_spec]] pro lado v1, mas o lado v2 tinha o MESMO problema,
descoberto só agora). Ou seja, os sites recém-clonados em produção não tinham
`GenesisAuthClient`/`VerifyGenesisAuthToken`/o alias `genesis.auth` nem o `authPath()` dos
frontends. Resolvido: cada arquivo relevante foi commitado **isolado** do resto do trabalho pendente
(hotfix V6.11 do v2, que continua intocado/não commitado) e enviado ao servidor via
`git bundle`+`git pull` (sem gastar token do GitHub de novo), atualizando os clones já existentes
com fast-forward limpo.

**O que foi feito de verdade, nos dois pares, no dia**:
- `[API v2]` e `[API v1]`: `Route::middleware(['auth:sanctum'])` → `['genesis.auth']` só no grupo
  principal de rotas de membro (`/v1/...`) — **os grupos `/v1/admin` ficaram intocados, em
  `auth:sanctum` local de propósito** (fora do escopo desta fase, painel admin não foi discutido).
  `GENESIS_AUTH_ENABLED=true` + `GENESIS_AUTH_URL=https://auth.genesislabs.com.br` nos dois `.env`.
- `[FE v1]` e `[FE v2]`: `AUTH_API_URL`/`VITE_AUTH_API_URL=https://auth.genesislabs.com.br`,
  rebuild, `pm2 restart` — confirmado por grep que a URL do `[AUTH]` está de verdade no bundle
  buildado (não só no `.env`, no JS que o navegador baixa).
- **Verificação de ponta a ponta, com dado e HTTP reais** (mesmo protocolo do ensaio local da Fase
  4, mas agora contra produção de verdade): registro real via `/api/auth/register` do `[AUTH]`
  pros dois pares → ativação manual (`status=active`, igual sempre acontece pra conta sem webhook
  Lastlink) → login real → token real → `GET /v1/me` (200, autenticou e materializou usuário local
  por email) → `POST /v1/consume/radar` (200, `{"credits":"150.00"}`, aritmética exata
  `200 - 50 = 150`) — **nos dois pares, v1 e v2**.
- Limpeza completa depois: os 2 usuários de teste + wallets/transactions/tokens apagados dos 3
  bancos (`auth`, `v1`, `v2`), confirmado.

**Itens 4.5 (descontinuação do `/login` antigo) e a proteção de webhooks continuam pendentes,
fora do escopo desta execução** — o `/login` local de cada API continua de pé (não é mais o
caminho principal, mas ainda funciona e emite token que as rotas de membro já não aceitam mais,
exatamente o "beco sem saída" que o 4.5 original previa corrigir). Sinalizado, não corrigido ainda.

## Fora de escopo deste plano (parqueado, por pedido do Felipe)

- **Tabelas locais de `[API v2]`** (`users`/`wallets`/`transactions`): ficam como estão, sem
  arquivar nem excluir — só param de ser a fonte de verdade quando a Fase 4 (corte real) rodar.
  Nenhuma ação sobre elas em nenhuma fase deste plano.
- **Segurança de webhooks em `[API v1]`** (Lastlink/Asaas/idempotência ausentes): sinalizado,
  tratado depois, separado — não bloqueia nem faz parte deste plano.
