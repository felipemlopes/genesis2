# Documento de Requisitos — Microserviço de Autenticação e Créditos (Gênesis)

## Introdução

Hoje existem duas gerações do sistema Gênesis coexistindo:

- **Frontend**: uma "v2.0" nova (este repositório) ao lado do frontend anterior (fora deste workspace).
- **API**: o repositório `genesis-api` tem a branch `master` (versão antiga, em produção) e a branch `genesis2`
  (versão atual, em desenvolvimento) — sem intenção de merge entre elas, ou seja, são forks permanentes a partir
  de agora.

Decisão do usuário (2026-09-09): as duas gerações de frontend e de API devem **rodar em paralelo em produção por
um tempo**, cada uma com seu próprio banco de dados — exceto por um recorte que deve ficar **centralizado em um
novo microserviço**: identidade do usuário (usuário/senha) e saldo de créditos, incluindo a compra de pacotes de
créditos. Tudo o mais (análises, radar, alertas, etc.) continua separado por sistema/banco.

Repositórios:
- **[AUTH]** `E:\Programas\wamp64\www\auth genesis` (novo, Laravel 10, atualmente uma pasta vazia)
- **[API]** `E:\Programas\wamp64\www\genesis-api`, branch `genesis2` (escopo de execução deste spec — a branch
  `master` não é tocada por este spec, ver Requisito 9)
- **[FE]** este repositório (frontend v2.0)

## Achado que motiva este spec

Auditoria do estado atual (2026-09-09) em `genesis-api` (branch `genesis2`):

- `User` implementa `Bavix\Wallet\Interfaces\Wallet` com `HasWallet`/`HasWalletFloat`/`HasWallets` — o saldo de
  créditos **já é um ledger real** (pacote `bavix/laravel-wallet` ^10.1, tabelas `wallets`/`transactions`), não uma
  coluna solta. Isso deve ser preservado, não reinventado.
- `AuthController` concentra login, registro, `me`, `balance`, `history`, `updateProfile`, `changePassword` **e
  também** checkout de compra de créditos (cartão via `store()`, PIX via `pix()`) usando o gateway **Asaas**
  (split de pagamento incluso).
- `CreditController::consume()` debita créditos por tipo de operação (`radar`, `liquidation`, `oiliq`, `figure`,
  `tendency`, `mindmetrics`, `micro_radar`), com proteção de idempotência (`idempotency_key` + janela de 20s).
- `Plan`/`Subscription` modelam os pacotes de créditos hoje comprados (campo `credits` por plano).
- `LastLinkWebhookController` recebe webhooks de uma plataforma externa (LastLink) que também credita saldo
  automaticamente (`Product_Access_Started` → `depositFloat`) e controla o campo `status` (`active`/`expired`) do
  usuário — hoje é outra via de entrada de crédito além do Asaas, e afeta se o usuário pode logar.
- `[FE]` usa um único token Bearer (`localStorage['genesis_token']`), chamando `/v1/login`, `/v1/credits`,
  `/v1/credits/consume/:type` diretamente no `genesis-api`.
- Recurso `CarteiraMae`/`CarteiraMembro`/`CarteiraGemas` (portfólio/gamificação) é um domínio **não relacionado**
  ao saldo de créditos de IA — fica fora do escopo deste spec.

## Decisões de escopo (confirmadas com o usuário em 2026-09-10, Fase 0 de `tasks.md`)

1. **Mecanismo de validação de token entre serviços: endpoint interno + cache curto.** `[AUTH]` expõe
   `/internal/verify-token`, `[API]` chama e faz cache do resultado por ~45s. Preserva fielmente o comportamento
   atual (`status <> "active"` bloqueia login, `logout` invalida token de verdade), ao custo de uma chamada de
   rede por token não cacheado. JWT stateless foi descartado — eliminaria a chamada de rede, mas perderia
   revogação instantânea (logout/inativação só refletiriam depois do token expirar).
2. **Coluna legada `credits` em `User` não é migrada.** No `[AUTH]`, saldo tem uma única fonte: o ledger
   (`bavix/laravel-wallet`, `balanceFloat`).
3. **Endereço local do novo serviço: `localhost:8001`** — usado em `VITE_AUTH_API_URL` (`[FE]`) e
   `services.genesis_auth.url` (`[API]`).
4. **Modelo de pacote de créditos mantém o nome `Plan`** (sem renomear para `CreditPackage`).

**Migração da branch `master`/frontend antigo.** Fora do escopo de execução deste spec (ver Requisito 9) — o
contrato do microserviço é desenhado para ser consumido por qualquer geração, mas a integração de fato com
`master` e com o frontend antigo é um spec futuro.

## Requisitos

### Requisito 1: Novo microserviço Laravel 10, dono único de identidade e saldo

**User Story:** Como responsável pelo sistema, eu quero um serviço isolado que seja a única fonte da verdade para
usuário/senha e saldo de créditos, para que as duas gerações de frontend/API não precisem sincronizar essas
informações entre si.

#### Critérios de Aceitação

1. THE `[AUTH]` SHALL ser um projeto Laravel 10 novo, com banco de dados próprio (não compartilhado com
   `genesis-api`).
2. THE `[AUTH]` SHALL usar `laravel/sanctum` para emissão de token e `bavix/laravel-wallet` para saldo de
   créditos — mesmos pacotes já usados em `genesis-api`, para minimizar risco de migração de dados e de
   comportamento (mesmo formato de tabela `wallets`/`transactions`).
3. THE `[AUTH]` SHALL possuir seu próprio `User` model (email, senha, status de ativação, campos hoje usados por
   `AuthController`/`LastLinkWebhookController`: `status`, `role`, `start_at`, `end_at`, `renew_at`, `reference`
   [id do cliente no Asaas], `lastlinkStatus`, `activationMode`).
4. THE `genesis-api` (branch `genesis2`) SHALL NOT manter seu próprio `personal_access_tokens`/`wallets` como
   fonte da verdade após a migração (Requisito 6) — pode manter uma cópia local somente leitura se necessário
   para performance, nunca como autoridade.

### Requisito 2: Autenticação entre serviços sem acoplar toda a API à disponibilidade do microserviço

**User Story:** Como usuário do sistema, eu quero que uma instabilidade pontual no serviço de auth não derrube
completamente a API de análises, para que o impacto de uma falha fique contido.

#### Critérios de Aceitação

1. THE `[AUTH]` SHALL expor um endpoint interno (ex.: `GET /internal/verify-token`) que recebe o Bearer token e
   retorna `{ user_id, email, status, role }` ou 401.
2. THE `[API]` SHALL validar tokens chamando esse endpoint, com cache do resultado por um TTL curto (ex.: 30-60s)
   por hash do token — chamadas subsequentes dentro do TTL SHALL NOT gerar nova requisição de rede.
3. WHEN o `[AUTH]` está indisponível E não há cache válido para o token, THE `[API]` SHALL retornar 401/503 de
   forma explícita (nunca autenticar "no escuro" nem cair para uma cópia local desatualizada como fallback
   silencioso).
4. WHEN um usuário faz logout ou tem o `status` alterado para inativo, THE Sistema SHALL refletir isso em, no
   máximo, o TTL do cache configurado — este limite SHALL ser documentado e aceito explicitamente pelo usuário
   antes da implementação (é uma troca deliberada, não uma falha).

### Requisito 3: Saldo de créditos como ledger, com consumo idempotente equivalente ao atual

**User Story:** Como usuário, eu quero que meu saldo de créditos seja preciso e auditável, para confiar que nunca
fui cobrado duas vezes pela mesma operação.

#### Critérios de Aceitação

1. THE `[AUTH]` SHALL portar `balance()`, `history()` e `consume(string $type)` de `CreditController`, com a
   mesma tabela de custos por tipo de operação (`radar`, `liquidation`, `oiliq`, `figure`, `tendency`,
   `mindmetrics`, `micro_radar`) e a mesma proteção de idempotência (`idempotency_key` + janela de tempo).
2. THE `[API]` (branch `genesis2`) SHALL chamar o `[AUTH]` para consumir créditos em vez de debitar localmente.
3. THE Sistema SHALL preservar o comportamento de erro 402 ("Créditos insuficientes") quando o saldo for
   insuficiente para o tipo de operação solicitado.

### Requisito 4: Compra de pacotes de créditos migrada para o microserviço

**User Story:** Como usuário, eu quero comprar créditos por um único fluxo, independente de qual versão do
frontend/API estou usando, para não ter que gerenciar saldo em dois lugares.

#### Critérios de Aceitação

1. THE `[AUTH]` SHALL portar o checkout de cartão (`AuthController::store()`) e PIX (`AuthController::pix()`) via
   Asaas, incluindo o cálculo de split e taxas hoje existente.
2. THE `[AUTH]` SHALL portar `Plan`/`Subscription` (renomeáveis para "pacote de créditos", mantendo o campo
   `credits` por pacote) como o catálogo de pacotes disponíveis para compra.
3. THE catálogo de pacotes SHALL ser consultável por versão/cliente (ex.: um parâmetro ou client-id), para
   permitir que `genesis2`/frontend v2 e uma futura integração com `master`/frontend antigo tenham catálogos
   diferentes sem exigir mudança de código no microserviço.
4. THE Sistema SHALL NOT processar dados de cartão além do necessário para repassar ao Asaas — nenhum dado de
   cartão SHALL ser persistido em banco próprio.

### Requisito 5: Webhooks de crédito automático migrados, preservando efeito atual

**User Story:** Como responsável pelo sistema, eu quero que confirmações de pagamento (Asaas) e de acesso externo
(LastLink) continuem creditando o usuário automaticamente, sem depender de qual API está no ar no momento.

#### Critérios de Aceitação

1. THE `[AUTH]` SHALL portar o webhook do Asaas (`PAYMENT_RECEIVED`/`PAYMENT_CONFIRMED` → `depositFloat`,
   `PAYMENT_REFUNDED` → `withdrawFloat`) e o webhook do LastLink (`LastLinkWebhookController`), incluindo a
   verificação de assinatura/token hoje existente (`VerifyAsaasToken`, `VerifyLastLinkSignature`,
   `WebhookIdempotency`).
2. THE Sistema SHALL manter os mesmos eventos/mapeamentos de status já existentes (`activeEvents`/
   `expiredEvents` do LastLink) sem alteração de comportamento.
3. THE Sistema SHALL manter proteção de idempotência de webhook (evitar creditar duas vezes o mesmo evento em
   caso de retry do provedor).

### Requisito 6: `genesis-api` (branch `genesis2`) deixa de ser dono de identidade/saldo

**User Story:** Como responsável pelo sistema, eu quero que a API de análises trate identidade e saldo como um
serviço externo, para que a separação de responsabilidades seja real, não só documental.

#### Critérios de Aceitação

1. THE `[API]` (branch `genesis2`) SHALL substituir o middleware `auth:sanctum` local (para as rotas que hoje
   dependem dele) por um middleware que valida o token contra `[AUTH]` (Requisito 2).
2. THE `[API]` SHALL substituir a leitura/escrita local de saldo (`balanceFloat`, `withdrawFloat`, `depositFloat`
   no `User` local) por chamadas ao `[AUTH]` (Requisito 3).
3. THE `[API]` SHALL manter, sem alteração de comportamento, tudo o que não é identidade/saldo (análises, radar,
   alertas, `CarteiraMae/Membro/Gemas`, etc.) — este spec SHALL NOT tocar nesses domínios além do necessário para
   trocar a fonte de auth/saldo.
4. THE Sistema SHALL definir explicitamente o que acontece com as tabelas locais `users`/`wallets`/`transactions`
   de `genesis-api` após o corte (arquivar vs remover) — ver Requisito 8, decisão gated, não silenciosa.

### Requisito 7: Frontend v2 aponta autenticação/créditos para o novo microserviço

**User Story:** Como usuário do frontend v2, eu quero continuar logando e vendo meu saldo normalmente, sem notar
que a arquitetura mudou por trás.

#### Critérios de Aceitação

1. THE `[FE]` SHALL introduzir uma nova variável de ambiente (ex.: `VITE_AUTH_API_URL`) apontando para `[AUTH]`.
2. THE `[FE]` SHALL trocar `login`/`logout`/`getCredits`/`consumeCredits` (`services/api.ts`) para chamar
   `[AUTH]` em vez de `genesis-api`, mantendo o mesmo contrato de retorno (`access_token`, `credits`) para não
   exigir mudança nos componentes que já consomem essas funções.
3. THE `[FE]` SHALL manter todas as demais chamadas (análises, radar, etc.) apontando para `genesis-api` como
   hoje, usando o mesmo token Bearer (emitido por `[AUTH]`) nessas chamadas.

### Requisito 8: Migração de dados existentes — gated, requer autorização explícita

**User Story:** Como responsável pelo sistema, eu quero que dados reais de produção (usuários, saldo, histórico
de transações, assinaturas) só sejam migrados com autorização explícita, para não repetir o incidente já
registrado de comando destrutivo em banco de produção.

#### Critérios de Aceitação

1. THE Sistema SHALL NOT migrar/tocar dados de produção (`users`, `wallets`, `transactions`, `plans`,
   `subscriptions`, `last_link_webhooks`, `last_link_access`) sem confirmação explícita do usuário, mesmo que o
   restante do spec já esteja implementado e testado.
2. THE plano de migração SHALL incluir um script de exportação/importação auditável (não comandos manuais ad-hoc
   contra o banco de produção) e um plano de rollback.
3. THE Sistema SHALL rodar em modo de leitura dupla ou período de validação (a definir na Fase correspondente)
   antes de `genesis-api` (branch `genesis2`) parar de aceitar login local, para permitir reverter sem perda de
   acesso de usuários reais.

### Requisito 9: Convivência com a branch `master`/frontend antigo — fora do escopo de execução

**User Story:** Como responsável pelo sistema, eu quero que este spec não introduza risco para a versão em
produção (`master` + frontend antigo), mesmo definindo uma arquitetura pensada para eventualmente incluí-la.

#### Critérios de Aceitação

1. THE Sistema SHALL NOT alterar código da branch `master` de `genesis-api` nem do frontend antigo como parte
   deste spec.
2. THE contrato de `[AUTH]` (Requisito 1-5) SHALL ser desenhado de forma genérica o suficiente (sem acoplamento a
   detalhes específicos de `genesis2`) para que uma integração futura de `master`/frontend antigo seja um spec
   novo de integração, não uma reescrita do microserviço.

### Requisito 10: Não regressão

**User Story:** Como responsável pelo sistema, eu quero que a migração não quebre nada que já funciona hoje.

#### Critérios de Aceitação

1. THE Sistema SHALL manter suíte de testes de `genesis-api` (branch `genesis2`) e do `[FE]` passando, sem
   regressão de comportamento fora do escopo deste spec.
2. THE `[AUTH]` SHALL ter cobertura de teste própria para login, registro, consumo de crédito, checkout
   (Asaas mockado, nunca chamada real em teste) e os dois webhooks.
3. THE Sistema SHALL confirmar, com pelo menos um fluxo real de ponta a ponta (login → consumir crédito →
   análise), que a nova arquitetura funciona antes de considerar a migração de dados de produção (Requisito 8).
