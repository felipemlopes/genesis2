# Documento de Requisitos — Cobrança Única da Análise V1 no Auth

## Introdução

Este spec corrige exclusivamente o fluxo de cobrança da **análise gráfica da V1**. A auditoria de código e a
verificação somente leitura em produção, realizadas em 19/09/2026, confirmaram que uma única ação do usuário
gera hoje dois débitos no microserviço `[AUTH]`:

1. `[FE V1]` chama `POST /analyze`; `[API V1]::IAGatewayController::analyze()` debita 100 créditos no `[AUTH]`.
2. Depois de receber o resultado, `[FE V1]` chama automaticamente `POST /trades`;
   `[API V1]::TradeController::store()` debita outros 100 créditos no mesmo `[AUTH]`.

O preço correto da análise V1 é **100 créditos**. O preço correto do Radar V1 é **50 créditos** e não deve ser
alterado. O acúmulo periódico de créditos é uma decisão do proprietário e está fora do escopo.

## Repositórios e versões auditadas

- **[FE V1]** `E:\Projetos js\G-nesis-Labs-Oficial-1`, branch `main`, commit auditado `a6bc004`.
- **[API V1]** `E:\Programas\wamp64\www\genesis-api-v1`, branch `master`, commit em produção `ca516e8`.
- **[AUTH]** `E:\Programas\wamp64\www\auth genesis`, branch `master`, commit em produção `21fac21`.
- **[API V2]** branch de produção `genesis2`, commit auditado `845ed82d`; consumidora do mesmo `[AUTH]`.
- Em produção, `GENESIS_AUTH_ENABLED=true` e `GENESIS_AUTH_CREDITS_FULL_ENABLED=true` na `[API V1]`.
- Em produção, `cost_analisys_credits=100` e o consumo real já é encaminhado ao `[AUTH]`.

## Decisões de escopo confirmadas

1. A análise V1 custa exatamente **100 créditos**.
2. O Radar V1 custa exatamente **50 créditos**.
3. A movimentação financeira da análise V1 ocorre exclusivamente no `[AUTH]`.
4. `POST /analyze` é o único ponto funcional responsável pelo ciclo de cobrança da análise.
5. `POST /trades` apenas persiste a operação e nunca movimenta créditos.
6. Uma falha da IA não pode deixar débito líquido no usuário.
7. Retry ou duplo clique da mesma tentativa não pode gerar novo débito.
8. Nenhuma fase deste spec autoriza alteração de Nginx.
9. Auditoria e restituição em produção são fases separadas e exigem autorização explícita.
10. A V2 deve continuar funcional durante e depois da correção da V1.
11. Os preços da V2 permanecem: análise **150 créditos** e Radar **150 créditos**.
12. Alterações no `[AUTH]`, quando realmente necessárias, devem ser aditivas e retrocompatíveis.

## Requisitos

### Requisito 1: Uma análise concluída gera exatamente um débito de 100

**User Story:** Como usuário da V1, eu quero pagar uma única vez pela análise solicitada, para que meu saldo
represente exatamente o serviço entregue.

#### Critérios de Aceitação

1. WHEN uma análise V1 termina com resultado válido, THE Sistema SHALL produzir débito líquido de exatamente
   100 créditos no `[AUTH]`.
2. THE Sistema SHALL NOT debitar créditos da carteira local da `[API V1]`.
3. THE Sistema SHALL NOT produzir um segundo débito ao persistir o trade derivado da análise.
4. FOR ALL análises concluídas, a diferença entre o saldo anterior e posterior SHALL ser exatamente 100.
5. THE descrição e os metadados da transação SHALL identificar produto `v1`, operação `analysis` e a chave de
   idempotência da tentativa.

### Requisito 2: `/trades` não possui responsabilidade financeira

**User Story:** Como responsável pelo sistema, eu quero separar persistência de trade de cobrança, para que salvar
o resultado de uma análise nunca cobre novamente o usuário.

#### Critérios de Aceitação

1. WHEN `POST /trades` é chamado, THE `[API V1]` SHALL apenas validar e persistir o trade.
2. `TradeController::store()` SHALL NOT chamar `GenesisAuthClient`, `withdrawFloat`, `depositFloat` ou consultar
   saldo para decidir se pode salvar.
3. Repetir `POST /trades` SHALL NOT criar nenhuma transação de crédito, independentemente do resultado da
   persistência.
4. A remoção da cobrança de `/trades` SHALL NOT alterar os campos e o contrato HTTP atualmente consumidos pelo
   `[FE V1]`.

### Requisito 3: Reserva, captura e liberação no Auth

**User Story:** Como usuário, eu quero receber de volta os créditos quando a análise falhar, para não pagar por um
resultado que não foi entregue.

#### Critérios de Aceitação

1. BEFORE chamar o provedor de IA, THE `[API V1]` SHALL solicitar ao `[AUTH]` uma reserva de 100 créditos.
2. IF o saldo for insuficiente, THE Sistema SHALL retornar 402 e SHALL NOT chamar o provedor de IA.
3. WHEN a IA devolve um resultado válido, THE `[API V1]` SHALL capturar a reserva sem realizar novo débito.
4. IF ocorrer timeout, exceção, resposta inválida ou erro do provedor, THE `[API V1]` SHALL liberar a reserva e o
   saldo líquido SHALL voltar ao valor anterior.
5. IF o `[AUTH]` estiver indisponível, THE `[API V1]` SHALL falhar de forma explícita e SHALL NOT usar a carteira
   local como fallback.
6. Reservas presas por encerramento abrupto SHALL possuir reconciliação segura e idempotente.

### Requisito 4: Idempotência de ponta a ponta

**User Story:** Como usuário, eu quero poder repetir uma solicitação após uma falha de rede sem ser cobrado de
novo.

#### Critérios de Aceitação

1. THE `[FE V1]` SHALL gerar uma `Idempotency-Key` por tentativa lógica de análise.
2. Retries da mesma tentativa SHALL reutilizar a mesma chave.
3. Uma nova análise deliberada SHALL receber uma nova chave.
4. THE `[API V1]` SHALL validar e encaminhar a chave ao `[AUTH]`.
5. FOR ALL N requisições concorrentes com o mesmo usuário e a mesma chave, THE débito líquido SHALL ser no máximo
   100 créditos.
6. A unicidade SHALL ser garantida por restrição persistente no banco, não apenas por consulta anterior ao débito
   ou janela de tempo.

### Requisito 5: Preservação das regras não relacionadas

**User Story:** Como proprietário, eu quero corrigir somente a duplicidade da análise, sem alterar preços ou
regras comerciais já aprovadas.

#### Critérios de Aceitação

1. O preço da análise V1 SHALL permanecer 100 créditos.
2. O preço do Radar V1 SHALL permanecer 50 créditos.
3. O acúmulo periódico de créditos SHALL permanecer inalterado.
4. Checkout, planos, webhooks, quiz e demais consumos SHALL permanecer fora do escopo.
5. Regras funcionais da V2 SHALL permanecer fora do escopo de alteração deste spec, mas sua compatibilidade é
   requisito obrigatório de aceitação.

### Requisito 6: Auditoria e restituição dos débitos históricos

**User Story:** Como responsável pelo sistema, eu quero identificar cobranças duplicadas comprováveis, para
restituir exatamente o valor cobrado a mais sem criar novos créditos indevidos.

#### Critérios de Aceitação

1. THE Sistema SHALL disponibilizar uma auditoria somente leitura que correlacione usuário, duas transações de
   100, proximidade temporal, solicitação de análise e trade criado.
2. O relatório SHALL separar casos confirmados, prováveis e inconclusivos.
3. Nenhuma restituição SHALL ocorrer durante a geração do relatório.
4. Cada restituição aprovada SHALL devolver exatamente 100 créditos por análise duplicada confirmada.
5. Cada restituição SHALL possuir chave única, como `refund:v1:double-analysis:<identificador>`, para impedir
   repetição.
6. A execução das restituições em produção SHALL exigir aprovação explícita posterior do proprietário.

### Requisito 7: Implantação segura e reversível

**User Story:** Como proprietário, eu quero validar a correção antes da produção, para reduzir o risco operacional.

#### Critérios de Aceitação

1. THE implementação SHALL ser feita e testada localmente primeiro.
2. THEN a correção SHALL ser validada no ambiente de teste com usuário e saldo controlados.
3. BEFORE produção, SHALL existir tag ou referência imutável dos commits atualmente implantados.
4. A implantação SHALL possuir smoke test de saldo inicial, análise, persistência do trade e saldo final.
5. Nenhuma etapa SHALL alterar Nginx.
6. Rollback SHALL restaurar aplicação e frontend sem apagar transações ou dados produzidos depois da implantação.

### Requisito 8: Compatibilidade obrigatória com a V2

**User Story:** Como proprietário, eu quero corrigir a cobrança duplicada da V1 sem interromper ou alterar a V2,
para que os usuários da versão atual continuem usando autenticação, saldo, análise e Radar normalmente.

#### Critérios de Aceitação

1. Os contratos HTTP do `[AUTH]` atualmente consumidos pela V2 SHALL permanecer compatíveis em rota, método,
   autenticação, campos obrigatórios, semântica, códigos de resposta e formato de resposta.
2. A análise V2 SHALL continuar cobrando exatamente 150 créditos por execução válida.
3. O Radar V2 SHALL continuar cobrando exatamente 150 créditos por execução válida.
4. Login, renovação de token, consulta de usuário, consulta de saldo e histórico da V2 SHALL permanecer funcionais.
5. Chaves, reservas e transações da V1 SHALL usar namespace/contexto `v1-analysis` e SHALL NOT colidir com
   operações da V2.
6. Qualquer migração no `[AUTH]` SHALL ser aditiva, retrocompatível e aplicável sem remover, renomear ou tornar
   obrigatório um campo usado pela V2.
7. IF os endpoints atuais de reserva já atenderem integralmente à V1, THEN o `[AUTH]` SHALL NOT ser alterado.
8. BEFORE publicar qualquer mudança do `[AUTH]`, uma suíte de regressão da V2 SHALL validar os fluxos descritos
   neste requisito em ambiente local e no ambiente de teste.
9. IF qualquer teste obrigatório da V2 falhar, THEN a implantação SHALL ser bloqueada até que a causa seja
   corrigida e toda a suíte seja executada novamente.
10. A correção da V1 SHALL NOT alterar acumulação, planos, renovação ou quaisquer outras regras comerciais da V2.
