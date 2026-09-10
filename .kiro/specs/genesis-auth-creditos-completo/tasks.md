# Plano de Implementação: fechar o consumo/estorno de crédito com o `[AUTH]`

**Status deste documento**: criado como planejamento puro em 10/09/2026, a pedido do Felipe ("cria
um plano spec estilo kiro pra fazer funcionar"). **Nenhum item foi executado.** Continuação direta
de **[[genesis-auth-integracao-v1-v2]]** (Fases 0-4 concluídas no mesmo dia — login/autenticação
das duas APIs já cortado de verdade pro `[AUTH]`, em produção). Este plano cobre o que aquela Fase 4
**não cobria**: tudo que mexe em crédito além do `/v1/consume/{type}` simples, que já foi ativado.

## Por que este plano existe

Depois do corte de login, o Felipe perguntou "o consumo/estorno já tá pronto?". Resposta encontrada
lendo o código real: **não, só uma fatia pequena está**. `CreditController::consume()` (as duas
APIs) já manda pro `[AUTH]` quando a flag está ligada — mas é o ÚNICO ponto do sistema que faz isso.
Todo o resto que debita ou credita a carteira do usuário continua batendo direto na carteira LOCAL
(`$user->withdrawFloat()`/`depositFloat()` nas duas APIs), que hoje está desconectada da identidade
real da pessoa (que agora vive no `[AUTH]`). Consequência prática: alguém que comprar créditos de
verdade hoje corre o risco de o crédito cair na carteira errada.

## Verificação contra o código real (10/09/2026)

### Achado 1 — o mapa completo de tudo que mexe em crédito, nas duas APIs

| Onde | O quê | Padrão | Já vai pro `[AUTH]`? |
|---|---|---|---|
| `CreditController::consume()` (v1 e v2) | radar/liquidation/oiliq/figure/tendency/mindmetrics/micro_radar | débito simples, na hora | ✅ Sim (Fase 4 do spec anterior) |
| `AlertaController::reveal()` (v2) | revelar alerta (paywall) | débito simples | ❌ Não |
| `RadarController` (v2) | revelar Micro Radar | débito simples | ❌ Não |
| `TradeController::store()` (v2) | análise de trade (`setting('cost_analisys_credits')`) | débito simples | ❌ Não |
| `UserAnswerController::result()` (v2) | bônus/penalidade de 200 no quiz final | débito/crédito simples | ❌ Não |
| `IAGatewayController` (v1) | scangraph/analyze | débito simples | ❌ Não |
| `Admin\UserController::credits()` (v1) | admin credita manualmente um usuário | crédito simples | ❌ Não |
| `CreditReservationService` + `GraphicalAnalysisController`/`GraphicalAnalysisAttemptJob` (v2) | análise gráfica (o produto principal) | **reserva → captura (sucesso) ou libera/estorna (falha)**, três estados | ❌ Não |
| `EstornarReservasOrfas`/`FinalizarAnalisesTravadas` (v2, comandos agendados) | limpeza de reservas travadas/órfãs | chamam `release()` da mesma `CreditReservationService` | ❌ Não |
| `LastLinkWebhookController`/Asaas webhook (v1 e v2) | crédito de compra real | depósito simples | ❌ Não — **mas ver Achado 2** |

`[API v1]` não tem o padrão de reserva/captura (só débito simples via `IAGatewayController`) — o
produto de análise gráfica com reserva é exclusivo de `[API v2]`.

### Achado 2 — a parte de compra real (LastLink/Asaas) pode já não precisar de código nenhum

`[AUTH]` **já tem seu próprio webhook do LastLink e do Asaas, funcionando, portado do spec anterior**
(`genesis-microservico-auth-creditos`) — `app/Http/Controllers/Webhooks/LastLinkWebhookController.php`
de lá já credita/estorna a carteira certa (a do `[AUTH]`), com a mesma lógica de mapeamento de
eventos que genesis-api sempre teve. Os middlewares `webhook.lastlink`/`webhook.asaas`/
`webhook.idempotency` também já existem lá, prontos.

**O que falta não é código — é infraestrutura/coordenação**:
1. `.env` do `[AUTH]` em produção está com `ASAAS_WEBHOOK_TOKEN`/`LASTLINK_WEBHOOK_SECRET` em
   branco (deploy de hoje, decisão deliberada — "sem esse valor o webhook rejeita tudo, comportamento
   seguro"). Precisa dos valores reais.
2. **Pergunta que só o Felipe responde**: os painéis do LastLink e do Asaas hoje mandam o webhook
   pra onde? Se ainda apontam pras URLs antigas (`v1api`/`v2api`/os sites antigos `api`/`testeapi`),
   uma compra real continua creditando a carteira local errada, não importa o que a gente faça no
   código — precisa reapontar lá nos painéis externos pra
   `https://auth.genesislabs.com.br/api/webhooks/lastlink` e `/api/webhooks/asaas`.

Isso vira a Fase 1 deste plano — quase sem código, mas bloqueante pros dois lados (Felipe faz a
parte de fora, eu confirmo a parte de dentro).

### Achado 3 — que forma dar pro "débito simples" que falta (Achado 1, linhas com débito/crédito simples)

`[AUTH]`'s `CreditController::consume()` hoje só aceita os 7 tipos fixos com custo vindo de
`config('genesis.credit_costs')`. As linhas que faltam têm valores DIFERENTES desse padrão: quiz é
fixo em 200 (bônus e penalidade, os dois sentidos), trade usa `setting('cost_analisys_credits')`
(configurável em runtime hoje, via painel — o `[AUTH]` não tem esse painel, usa `config/genesis.php`
estático), admin credita um valor arbitrário que o admin digita na hora. Forçar tudo pro formato
"tipo fixo com custo fixo" do `consume()` não encaixa bem — vira a Decisão D1.

## Decisões que precisam do Felipe antes de qualquer fase avançar

- [ ] **D1 — Formato do endpoint de débito/crédito simples que falta.** Duas opções:
      - **(a) Endpoint genérico** `POST /api/credits/adjust` no `[AUTH]` — recebe `amount` (positivo
        credita, negativo debita) + `description` + `idempotency_key` opcional, sem lista fixa de
        tipos. Mais simples de estender, mas quem chama decide o valor (menos controle central).
      - **(b) Estender a lista fixa** do `consume()` — adiciona `quiz_bonus`/`quiz_penalty`/
        `trade_analysis`/`admin_grant` com custo em `config/genesis.php`, mantém o formato atual.
        Mais consistente com o que já existe, mas `trade_analysis` hoje é configurável em runtime
        (`setting()`) e `admin_grant` por natureza é um valor arbitrário — os dois não cabem bem
        numa tabela de custo fixo.
      Recomendação: (a), só pra este punhado de casos que não têm custo fixo por natureza — o
      `consume()` de tipo fixo continua existindo do jeito que está pros 7 tipos que já usam.
- [ ] **D2 — O que fazer com os webhooks antigos do LastLink/Asaas que ainda estão de pé em
      `[API v1]`/`[API v2]`** (creditam a carteira local, hoje desconectada). Mesmo tratamento do
      login antigo (Fase 4 anterior — comentar as rotas, não apagar), ou deixar de pé como
      caminho de reserva enquanto o reapontamento externo (Achado 2) não é confirmado 100%?
- [ ] **D3 — Doutrina de ativação**: "construído, não ativado" (flag nova, só liga depois de testar
      com dinheiro/crédito de teste, mesmo protocolo de sempre) pros Buckets B e C, ou — já que o
      corte de login saiu direto ativado por causa dos bancos ainda vazios — ativar direto também,
      já que continua sendo o mesmo cenário de baixo risco (poucos ou nenhum usuário real ainda)?
      Recomendação: construído-e-testado-e-só-então-ativado mesmo assim pra esta parte
      especificamente, porque mexe em DINHEIRO de verdade (Asaas produção já está ligado desde hoje
      cedo) de um jeito que autenticação sozinha não mexe.
- [ ] **D4 — Confirmado, não é bem uma pergunta**: `[API v1]` não participa do Bucket C (reserva/
      captura/estorno) — não tem esse padrão no código, só débito simples (Bucket B). Confirmar que
      não tem nenhum outro fluxo de reserva escondido em v1 que eu não tenha achado.

## Escopo em 3 baldes

### Bucket A — Compras reais (LastLink + Asaas)

- [ ] Felipe fornece (ou gera nos painéis) `ASAAS_WEBHOOK_TOKEN`/`LASTLINK_WEBHOOK_SECRET` reais;
      preencher no `.env` do `[AUTH]` em produção.
- [ ] Felipe confirma/reaponta, nos painéis externos do LastLink e do Asaas, o webhook pra
      `https://auth.genesislabs.com.br/api/webhooks/{lastlink,asaas}`.
- [ ] Teste real: uma cobrança de teste de verdade (valor baixo) e conferir que o crédito cai na
      carteira do `[AUTH]`, não na local.
- [ ] D2 resolvida e aplicada (comentar ou manter os webhooks antigos das duas APIs).

### Bucket B — Débito/crédito simples restante

- [ ] D1 resolvida, endpoint novo construído no `[AUTH]` (`/api/credits/adjust` ou os tipos novos no
      `consume()`, conforme a decisão) — com teste automatizado cobrindo: débito com saldo
      suficiente, débito com saldo insuficiente (402), crédito, idempotência.
- [ ] `AlertaController::reveal()`, `RadarController` (Micro Radar), `TradeController::store()`,
      `UserAnswerController::result()` (v2) e `IAGatewayController` + `Admin\UserController::credits()`
      (v1) — cada um ganha o mesmo desvio condicional que `CreditController::consume()` já tem
      (`if (config('services.genesis_auth.enabled')) { ... }`), chamando o endpoint novo do
      `[AUTH]` em vez de `withdrawFloat()`/`depositFloat()` local.
- [ ] Teste automatizado por controller, mesmo padrão de `CreditControllerGenesisAuthTest.php`
      (Fase 2 do spec anterior) — cobre o caminho novo com `Http::fake()`.

### Bucket C — Reserva/captura/estorno da análise gráfica (só `[API v2]`)

- [ ] Desenhar e construir no `[AUTH]`: `POST /api/credits/reservations` (reserva — debita na hora,
      idempotente por `idempotency_key`, devolve um identificador de reserva), `POST
      /api/credits/reservations/{id}/capture` (marca capturada, sem mexer no saldo — o dinheiro já
      saiu na reserva), `POST /api/credits/reservations/{id}/release` (estorna — devolve o valor,
      marca liberada). Precisa de uma tabela nova no `[AUTH]` pra rastrear essas reservas (mesmo
      esqueleto de `AnalysisCreditReservation`, mas só a parte de crédito — status/valor/dono/chave
      de idempotência) e dos mesmos travamentos (`lockForUpdate`) que `CreditReservationService`
      já usa hoje, pra não duplicar reserva sob concorrência.
- [ ] `CreditReservationService` (v2) ganha um caminho condicional: com a flag ligada,
      `reserve()`/`capture()`/`release()` chamam o `[AUTH]` (guardando o id da reserva remota na
      linha local de `AnalysisCreditReservation`, que continua existindo pra orquestração do job —
      só o movimento de dinheiro muda de lugar); com a flag desligada, comportamento de hoje
      (intocado).
- [ ] `EstornarReservasOrfas`/`FinalizarAnalisesTravadas` — conferir que continuam chamando
      `release()` da mesma service (não deveriam precisar de mudança própria, só herdam o
      comportamento novo por baixo).
- [ ] Teste automatizado cobrindo: reserva com saldo insuficiente, reserva idempotente (mesma
      chave duas vezes não debita duas vezes), captura depois de reserva, release depois de reserva,
      release/capture chamados fora de ordem (idempotentes, não fazem nada — mesmo comportamento
      documentado hoje na versão local).

### Fase de validação (todas as flags ligadas, com dinheiro/crédito de teste real)

- [ ] Mesmo protocolo já usado no corte de login: usuário de teste real, saldo de teste real,
      exercitar cada balde com HTTP de verdade contra produção, conferir aritmética exata, limpar
      os dados de teste depois. Só então considerar a Fase 4 (login) + este spec juntos como "o
      sistema de crédito inteiro fala com o `[AUTH]`".

## Fora de escopo deste plano

- Painel de admin pra editar `credit_costs`/settings em runtime no `[AUTH]` (hoje é `config/genesis.php`
  estático, decisão já registrada lá) — nenhuma mudança nisso aqui.
- Qualquer coisa em `genesis-api-v1` além do que está mapeado no Bucket B (confirmado, não tem
  reserva/captura lá).

## ✅ Buckets B e C EXECUTADOS e implantados (10/09/2026) — construído, testado, NÃO ativado

D1 = endpoint genérico `/api/credits/adjust` (recomendação seguida). D2 = webhooks antigos NÃO
tocados ainda (dependem do Felipe confirmar reapontamento externo primeiro). D3 = flag NOVA e
separada (`GENESIS_AUTH_CREDITS_FULL_ENABLED`, default `false`) — confirmada `false` em produção
depois do deploy. D4 = confirmado, `[API v1]` só tem débito simples mesmo.

**Achado crítico descoberto e corrigido durante a execução, já implantado**: o produto principal
(`/api/v1/graphical-analysis`, análise gráfica) vive num arquivo de rotas separado
(`routes/genesis_graphical_v6.php`, carregado via `GenesisGraphicalServiceProvider`) que **ficou
de fora do corte de login da Fase 4** — continuava em `auth:sanctum` local, inacessível pra
qualquer usuário logando pelo `[AUTH]` (o único jeito de logar desde a Fase 4). Mesmo achado em
`/v1/alertas/stream` (SSE). Os dois corrigidos e confirmados com token real de produção (200) —
ver [[project_auth_integracao_v1_v2_spec]] pra esse detalhe (é uma extensão da Fase 4, não deste
spec, mas foi achado fazendo este trabalho).

**Achado de design real durante a implementação**: `capture()`/`release()` da reserva rodam de
dentro de `GraphicalAnalysisAttemptJob` (job em fila, sem requisição HTTP nem bearer token do
usuário disponível nesse momento) — só `reserve()` podia usar o token do usuário. Resolvido com um
segundo mecanismo de autenticação no `[AUTH]` (`internal.service`, `GENESIS_AUTH_INTERNAL_TOKEN`,
segredo compartilhado só entre `[API v2]` e `[AUTH]`, já gerado e configurado nos dois `.env` de
produção).

**Entregue**: `[AUTH]` ganhou `POST /api/credits/adjust` e `POST /api/credits/reservations`
(+ `/capture`, `/release`) — 12 testes novos, 43/43 na suíte inteira. `[API v2]` ganhou o desvio
condicional em `AlertaController`, `RadarController`, `TradeController`, `UserAnswerController` e
`CreditReservationService` — 15 testes novos (Bucket B+C), todos passando. `[API v1]` ganhou o
mesmo em `IAGatewayController` — `Admin\UserController::credits()` NÃO portado de propósito
(credita usuário alheio, não encaixa no padrão de repassar o bearer token de quem chama; precisa de
mecanismo diferente, documentado no código). Migração nova (`credit_reservations` no `[AUTH]`,
`auth_reservation_uuid` em `analysis_credit_reservations` no `[API v2]`) rodada em produção com
autorização explícita, tabelas vazias. Tudo implantado nos 3 sistemas, flag confirmada `false`.

**Achado tardio, ainda sem solução, escopo maior que este plano**: rodar a suíte completa de
`[API v2]` (não rodada de ponta a ponta desde a Fase 4 de manhã) revelou **56 testes
pré-existentes falhando** — quase todos usam `$this->actingAs($user)` (helper de teste do Laravel)
contra rotas que agora exigem `genesis.auth`, incompatível com esse helper. Não é o mesmo tipo de
bug real que a análise gráfica/SSE eram — já confirmado com curl+token real que essas rotas
funcionam de verdade; é a suíte de testes que ficou desatualizada. Corrigir isso é trabalho
separado (cada teste precisa migrar pro padrão `Http::fake()` usado neste spec) — parqueado, fora
do escopo original deste documento, registrado em [[project_producao_cloudpanel_deploy]] como
pendência.
