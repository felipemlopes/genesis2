# Documento de Requisitos — Correção das Vulnerabilidades de Segurança

## Introdução

Em 27/09/2026 o Felipe pediu uma análise de segurança e LGPD do ecossistema Gênesis. O resultado está no PDF `C:\Users\felip\Downloads\Relatorio-Seguranca-LGPD-Genesis-2026-09-27.pdf`: 18 achados de segurança (5 críticos, 5 altos, 6 médios, 2 baixos). Em 28/09/2026 ele pediu um plano para corrigir as vulnerabilidades.

Esta spec cobre **os 18 achados de segurança (S1–S18)**. Os itens de LGPD que não são falha técnica (política de privacidade, encarregado, direitos do titular, inventário de dados, procedimento de incidente) ficam para uma spec própria. Aqui só entra o que também é segurança: dados de cartão em log, retenção de log e exposição de dados na resposta da API.

Repositórios:
- **[AUTH]** `E:\Programas\wamp64\www\auth genesis` (Laravel, branch `master`): login, créditos, checkout e webhooks de pagamento
- **[API v2]** `E:\Programas\wamp64\www\genesis-api` (Laravel, produção em `genesis2`)
- **[API v1]** `E:\Programas\wamp64\www\genesis-api-v1` (Laravel, `master`)
- **[FE v2]** este repositório (React + servidor Node `server.ts`, produção em `master`)
- **[FE v1]** `E:\Projetos js\G-nesis-Labs-Oficial-1` (React, `main`)

Produção: VPS CloudPanel `72.62.138.174`. Em produção `GENESIS_AUTH_ENABLED=true` e `GENESIS_AUTH_CREDITS_FULL_ENABLED=true` na [API v2]: o saldo que vale é o do [AUTH].

A auditoria que embasa estes requisitos, com arquivo e linha, está em `design.md` → "Estado Atual Auditado".

## Glossário

- **Token de membro**: token Sanctum emitido pelo [AUTH] no login e guardado no `localStorage` do frontend.
- **Rota interna**: rota protegida por token de serviço (`internal.service`), chamada só de uma API para outra, nunca pelo navegador.
- **Fail-closed**: sem o segredo configurado, a rota recusa a requisição em vez de aceitar.
- **Prova de exploração**: teste automatizado que reproduz o ataque do relatório e hoje passa (o ataque funciona). Depois da correção, o mesmo teste precisa falhar no ataque, ou seja, confirmar a recusa.

## Requisitos

### Requisito 1: Crédito só pode ser criado pelo servidor (S1)

**User Story:** Como dono do produto, quero que nenhum membro consiga aumentar o próprio saldo, para que crédito só exista quando alguém pagou ou quando um admin concedeu.

#### Critérios de Aceitação

1. QUANDO um membro autenticado chamar `POST /api/credits/adjust` no [AUTH] com `direction=credit`, ENTÃO o [AUTH] DEVE recusar com 403 e não alterar o saldo.
2. O débito pela mesma rota (`direction=debit`) DEVE continuar funcionando como hoje, pois é usado pelo radar, pelos alertas e pelas análises.
3. Todo crédito que hoje passa pela rota de membro (bônus do quiz na [API v2]) DEVE passar a usar a rota interna `POST /api/credits/adjust-for-user`, com o valor definido no servidor.
4. O sistema DEVE ter uma consulta de auditoria que liste as transações de crédito criadas pela rota de membro desde que ela existe, para encontrar abusos já feitos.

### Requisito 2: Bônus do quiz resgatável uma única vez (S2)

**User Story:** Como dono do produto, quero que o bônus da certificação seja pago no máximo uma vez por membro, para que ele não vire fonte infinita de crédito.

#### Critérios de Aceitação

1. QUANDO `POST /v1/assessment/result` for chamado mais de uma vez pelo mesmo membro, ENTÃO só a primeira chamada DEVE gerar bônus ou penalidade. As seguintes respondem com o resultado já registrado, sem mexer no saldo.
2. A regra DEVE valer na [API v2] e na [API v1].
3. A garantia de "uma vez" DEVE resistir a chamadas simultâneas (índice único no banco ou chave de idempotência fixa por membro), não só a uma checagem antes de gravar.
4. O resultado do quiz NÃO DEVE depender só do que o navegador informa. Ver a decisão D1 no `design.md` sobre como calcular no servidor.

### Requisito 3: Webhooks de pagamento sempre autenticados (S3)

**User Story:** Como dono do produto, quero que só a LastLink e o Asaas consigam confirmar pagamentos, para que ninguém ative conta ou ganhe crédito com uma requisição forjada.

#### Critérios de Aceitação

1. QUANDO `LASTLINK_WEBHOOK_SECRET` ou `ASAAS_WEBHOOK_TOKEN` estiver vazio, ENTÃO o webhook correspondente no [AUTH] DEVE recusar toda requisição (503) e registrar um aviso no log (fail-closed, como era antes de 21/09/2026).
2. QUANDO o segredo estiver preenchido e a assinatura ou o token não bater, ENTÃO o webhook DEVE recusar com 401 (comportamento atual, mantido).
3. QUANDO o webhook do Asaas informar `PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED`, ENTÃO o [AUTH] DEVE confirmar o status e o valor da cobrança na API do Asaas antes de creditar.
4. O `genesis:preflight` (ou comando equivalente no [AUTH]) DEVE acusar erro quando os segredos estiverem vazios em `APP_ENV=production`.
5. Os webhooks recebidos sem assinatura desde 21/09/2026 DEVEM ser revisados (Fase 0) para identificar ativações ou créditos forjados.

### Requisito 4: Nenhum dado de cartão em log, Telescope ou resposta (S4, S6)

**User Story:** Como membro, quero que o número e o código de segurança do meu cartão nunca fiquem gravados no servidor, para não serem roubados de um log ou backup.

#### Critérios de Aceitação

1. Os checkouts por cartão e Pix da [API v1], da [API v2] e do [AUTH] NÃO DEVEM gravar em log o payload enviado ao Asaas nem a resposta crua. O log pode conter só o id da cobrança, o status e o `user_id`.
2. O Telescope da [API v2] DEVE ocultar `card_number`, `card_cvv`, `card_expiry_month`, `card_expiry_year`, `card_name`, `cpf`, `phone`, `password`, `password_confirmation`, `current_password`, `new_password` e `new_password_confirmation`, além do cabeçalho `authorization`, ou ficar desligado em produção (decisão D5).
3. Um teste DEVE provar que um checkout completo, com sucesso e com falha, não deixa `"ccv"`, o número do cartão ou o CPF em nenhum arquivo de log nem no Telescope.
4. Os dados de cartão já gravados nos logs, backups e `telescope_entries` de produção DEVEM ser apagados (Fase 9, com autorização).

### Requisito 5: Painel admin da API v1 só para admin (S5)

**User Story:** Como dono do produto, quero que só admins acessem o painel, para que um membro não consiga ver dados de outros usuários nem se promover a admin.

#### Critérios de Aceitação

1. Todas as rotas de `v1/admin/*` da [API v1], exceto `/login`, DEVEM exigir o middleware `admin`, como já acontece na [API v2].
2. QUANDO um token válido de quem não é admin chamar uma rota admin, ENTÃO a [API v1] DEVE responder 403.
3. Os tokens de `personal_access_tokens` da [API v1] que pertencem a quem não é admin DEVEM ser apagados (Fase 9, com autorização).

### Requisito 6: Tokens com validade e revogação (S9)

**User Story:** Como membro, quero que um token roubado pare de funcionar em algum momento e que trocar a senha derrube as sessões antigas.

#### Critérios de Aceitação

1. Os tokens emitidos pelo [AUTH] DEVEM expirar (prazo na decisão D3). As APIs v1 e v2 já validam o token no [AUTH], então herdam a validade.
2. QUANDO a senha for redefinida (`reset-password`) ou trocada (`password`), ENTÃO o [AUTH] DEVE apagar todos os tokens do usuário, exceto o da própria requisição de troca.
3. QUANDO qualquer chamada devolver 401, ENTÃO os dois frontends DEVEM apagar o token guardado e levar o membro para a tela de login, sem tela quebrada. **Este critério precisa estar em produção antes do critério 1.**
4. O stream de alertas NÃO DEVE receber o token pela URL (`?token=`).

### Requisito 7: Segredos fora do Git (S7)

**User Story:** Como dono do produto, quero que nenhuma chave nem dado de usuário fique no histórico do repositório.

#### Critérios de Aceitação

1. A chave do Google encontrada em `genesis_v6_4_proofs/pre-migration-4-dump.sql` DEVE ser revogada no Google Cloud.
2. O arquivo DEVE sair do repositório e do histórico (decisão D6, porque reescrever o histórico exige force push).
3. O CI ou um hook DEVE barrar commit com padrões de chave (`AIza…`, `sk-…`, `$aact_…`, token do Telegram) e com arquivos `.sql` de dump.

### Requisito 8: Remover o legado inseguro do servidor Node do FE v2 (S8, S17)

**User Story:** Como dono do produto, quero que o servidor do frontend v2 sirva só o site, sem rotas antigas de banco que ninguém usa.

#### Critérios de Aceitação

1. As rotas de `routes/api.js` (carteiras via MySQL e `/api/v1/alertas/stream`) DEVEM ser removidas do `server.ts`, porque o frontend usa a API Laravel.
2. O login por LastLink/JWT do `server.ts` (`/api/auth/login`) DEVE ser removido se a Fase 0 confirmar que não é usado.
3. O proxy `/api/bybit/*` DEVE ter limite de requisições por IP ou ser removido se não for usado.
4. O servidor NÃO DEVE mais exigir `JWT_SECRET` nem variáveis de MySQL para subir.

### Requisito 9: Login resistente a força bruta e sem vazar quem tem conta (S10, S11)

**User Story:** Como membro, quero que ninguém consiga adivinhar minha senha por tentativa e erro.

#### Critérios de Aceitação

1. `login`, `admin-login`, `forgot-password` e `reset-password` do [AUTH] e o `admin/login` das APIs v1 e v2 DEVEM limitar a 5 tentativas por minuto por combinação de e-mail e IP, e a 20 por minuto por IP.
2. Novas senhas DEVEM ter no mínimo 8 caracteres e não estar em vazamentos conhecidos (`Password::min(8)->uncompromised()`). Senhas antigas continuam valendo até a próxima troca.
3. `forgot-password` DEVE responder igual para e-mail existente e inexistente.
4. `admin-login` DEVE responder "Credenciais inválidas" tanto para senha errada quanto para senha certa de quem não é admin.

### Requisito 10: E-mail confirmado e vínculo pelo id (S12)

**User Story:** Como membro, quero que ninguém consiga assumir meus dados trocando o próprio e-mail para o meu.

#### Critérios de Aceitação

1. A troca de e-mail no [AUTH] DEVE só ter efeito depois de o membro clicar no link enviado para o novo endereço.
2. O middleware `VerifyGenesisAuthToken` das APIs v1 e v2 DEVE casar o usuário local pelo `user_id` do [AUTH] (coluna nova, preenchida na primeira vez pelo e-mail), e não mais só pelo e-mail.

### Requisito 11: Exposição mínima e custo de IA controlado (S13, S14, S15, S16, S18)

**User Story:** Como dono do produto, quero que a API devolva só o necessário e que ninguém gere conta de IA sem pagar.

#### Critérios de Aceitação

1. `POST /v1/macro/today` da [API v1] DEVE exigir login, como na [API v2].
2. `POST /api/v1/gemini-proxy` da [API v2] DEVE ter um teto diário por membro e/ou cobrar crédito (decisão D7).
3. As respostas de `login`, `register`, `updateProfile` e `adminLogin` DEVEM devolver só id, nome, e-mail, papel e status. `cpf`, `reference` e `terms` DEVEM entrar no `$hidden` do modelo `User` nas três APIs.
4. O CORS das três APIs DEVE aceitar só `https://*.genesislabs.com.br` (e `localhost` fora de produção).
5. Os `.env.example` DEVEM trazer `APP_DEBUG=false` e `LOG_LEVEL=warning`.
6. O canal de log padrão DEVE ser `daily`, com 14 dias de retenção, nas três APIs.
7. O upload do `scangraph` DEVE ter os mesmos limites de tamanho e tipo da análise gráfica.

### Requisito 12: Cada correção provada por teste

**User Story:** Como dono do produto, quero ter certeza de que cada falha foi fechada e não volta.

#### Critérios de Aceitação

1. Cada achado DEVE ter um teste de prova de exploração, escrito **antes** da correção, que reproduz o ataque do relatório. Com o código atual o ataque funciona; depois da correção o mesmo teste confirma a recusa.
2. As suítes das três APIs DEVEM continuar verdes, exceto as falhas conhecidas e documentadas.
3. Nenhum teste pode usar `RefreshDatabase` (regra do projeto: sqlite persistente + `DatabaseTransactions`).
