# Plano de Implementação — Cobrança Única da Análise V1 no Auth

## Status

**EXECUÇÃO LOCAL EM ANDAMENTO — FASES 1 A 7 CONCLUÍDAS; FASE 8 BLOQUEADA; FASE 9 PARCIALMENTE CONCLUÍDA.**

Este documento não autoriza alteração de código, banco, produção, processos ou Nginx. Cada fase operacional de
teste e produção possui gate explícito.

## Fase 0 — Decisões fechadas

- [x] 0.1 Análise V1 custa 100 créditos.
- [x] 0.2 Radar V1 custa 50 créditos e fica inalterado.
- [x] 0.3 `[AUTH]` é a única carteira autorizada para cobrar a análise.
- [x] 0.4 `/analyze` é o único ponto funcional responsável pela cobrança.
- [x] 0.5 `/trades` deve apenas persistir a operação.
- [x] 0.6 Falha da IA deve liberar/estornar a reserva.
- [x] 0.7 Acúmulo de créditos é regra de negócio válida e está fora do escopo.
- [x] 0.8 Nenhuma fase mexe em Nginx.
- [x] 0.9 Análise V2 permanece em 150 créditos.
- [x] 0.10 Radar V2 permanece em 150 créditos.
- [x] 0.11 Compatibilidade da V2 é requisito bloqueante para qualquer alteração no `[AUTH]`.
- [x] 0.12 Se os contratos atuais do `[AUTH]` atenderem à V1, não haverá alteração no microserviço.

## Fase 1 — Baseline e testes de regressão antes da correção

- [x] 1.1 **[API V1]** Criar teste que reproduz o fluxo atual e comprova dois débitos de 100 quando `/analyze` é
      seguido por `/trades`.
- [x] 1.2 **[API V1]** Criar teste isolado comprovando que `IAGatewayController::analyze()` chama o `[AUTH]` com
      débito de 100.
- [x] 1.3 **[API V1]** Criar teste isolado comprovando que `TradeController::store()` também chama o `[AUTH]` com
      débito de 100 no código anterior à correção.
- [x] 1.4 **[FE V1]** Criar teste do fluxo `handleAnalyze`: `POST /analyze` seguido por `POST /trades`.
- [x] 1.5 Registrar os resultados do baseline sem editar banco ou chamar serviços reais; usar `Http::fake()` e
      banco de teste dedicado.
- [x] 1.6 **[API V2/AUTH]** Inventariar rotas, payloads, autenticação, códigos HTTP e respostas do `[AUTH]`
      atualmente consumidos pela V2.
- [x] 1.7 **[API V2/AUTH]** Criar testes de caracterização para login, logout, usuário, saldo, histórico,
      verificação de token, análise e Radar antes de qualquer mudança no `[AUTH]`. O contrato atual não possui
      endpoint de renovação de token; não inventar uma rota durante o baseline.
- [x] 1.8 Registrar o baseline financeiro V2: análise concluída debita 150 e Radar concluído debita 150.

## Fase 2 — Idempotência no frontend V1

- [x] 2.1 **[FE V1]** Criar helper `analysisIdempotency` que gera uma chave por tentativa lógica.
- [x] 2.2 Persistir temporariamente a chave em `sessionStorage` ou mecanismo equivalente para sobreviver a retry de
      rede e remontagem do componente.
- [x] 2.3 Enviar `Idempotency-Key` em `services/geminiService.ts` no `POST /analyze`.
- [x] 2.4 Reutilizar a mesma chave em retry; gerar nova chave somente quando o usuário inicia nova análise.
- [x] 2.5 Criar testes para mesma tentativa/mesma chave, nova tentativa/nova chave e storage indisponível.

## Fase 3 — Cliente de reservas no API V1

- [x] 3.1 **[API V1]** Estender `GenesisAuthClient` com `reserveCredit()`, `captureCredit()` e `releaseCredit()`,
      seguindo o contrato existente do `[AUTH]`.
- [x] 3.2 Usar bearer do usuário na reserva e token interno de serviço na captura/liberação.
- [x] 3.3 Definir timeout e tratamento explícito para 402, 409, 5xx e indisponibilidade de rede.
- [x] 3.4 Garantir que nenhuma falha do `[AUTH]` caia silenciosamente para `withdrawFloat()` local.
- [x] 3.5 Criar testes com `Http::fake()` para os três métodos e todos os estados relevantes.
- [x] 3.6 Antes de editar o `[AUTH]`, provar por teste se os endpoints existentes já atendem integralmente ao novo
      cliente da `[API V1]`; se atenderem, registrar a decisão de não alterar o `[AUTH]`.
- [x] 3.7 Se houver lacuna comprovada, desenhar somente extensão aditiva/versionada e registrar impacto sobre cada
      contrato utilizado pela V2 antes da implementação. **Não aplicável na Fase 3:** nenhuma lacuna foi
      encontrada para o cliente básico. O `[AUTH]` recebeu somente a extensão aditiva de recuperação da Fase 6;
      a V2 não foi alterada.

## Fase 4 — Cobrança única no `/analyze`

- [x] 4.1 **[API V1]** Validar a presença e formato de `Idempotency-Key` no request de análise.
- [x] 4.2 Reservar exatamente 100 créditos antes de qualquer chamada paga ao provedor de IA.
- [x] 4.3 Impedir a chamada à IA quando a reserva falhar ou o saldo for insuficiente.
- [x] 4.4 Capturar a reserva somente depois de validar o resultado final da IA.
- [x] 4.5 Liberar a reserva em timeout, exceção, HTTP não bem-sucedido e resposta estruturalmente inválida.
- [x] 4.6 Remover do caminho de análise qualquer débito local e qualquer chamada `adjustCredit(debit)` sem
      idempotência.
- [x] 4.7 Adicionar logs estruturados do ciclo, sem registrar tokens, segredos ou imagem.

## Fase 5 — Tornar `/trades` financeiramente neutro

- [x] 5.1 **[API V1]** Remover de `TradeController::store()` a chamada `GenesisAuthClient::adjustCredit()`.
- [x] 5.2 Remover `withdrawFloat()`, consulta de saldo e branches condicionadas às flags de crédito.
- [x] 5.3 Preservar validação, persistência e contrato HTTP do endpoint.
- [x] 5.4 Criar teste que chama `/trades` com saldo zero e confirma que a persistência não depende de saldo.
- [x] 5.5 Criar teste que chama `/trades` repetidamente e confirma zero movimentações no `[AUTH]` e na carteira
      local.

## Fase 6 — Concorrência e recuperação de reservas

- [x] 6.1 Confirmar que `(user_id, idempotency_key)` possui restrição única real no banco do `[AUTH]`.
- [x] 6.2 Criar teste concorrente: N requisições com mesma chave geram uma reserva e débito líquido máximo de 100.
- [x] 6.3 Definir e implementar reconciliação de reservas V1 presas após encerramento abrupto do processo.
- [x] 6.4 Garantir que o reconciliador não libere reserva cuja análise já tenha resultado concluído.
- [x] 6.5 Tornar a própria reconciliação idempotente e cobri-la com testes de repetição.

## Fase 7 — Testes de propriedade e integração

- [x] 7.1 Propriedade: sucesso terminal implica débito líquido exatamente 100.
- [x] 7.2 Propriedade: falha terminal implica débito líquido zero.
- [x] 7.3 Propriedade: repetir a mesma chave qualquer quantidade de vezes nunca aumenta o débito além de 100.
- [x] 7.4 Propriedade: chaves diferentes e análises válidas cobram 100 cada.
- [x] 7.5 Propriedade: qualquer chamada a `/trades` produz variação de saldo zero.
- [x] 7.6 Regressão: Radar V1 continua cobrando exatamente 50.
- [x] 7.7 Rodar suítes completas de `[FE V1]`, `[API V1]` e testes afetados no `[AUTH]`; documentar falhas
      preexistentes separadamente.

## Fase 8 — Gate obrigatório de compatibilidade V2

- [x] 8.1 **[AUTH]** Confirmar por diff que nenhuma rota, método, campo obrigatório, autenticação, código HTTP ou
      formato de resposta consumido pela V2 foi removido ou alterado de forma incompatível.
- [x] 8.2 **[AUTH]** Confirmar que qualquer migração é aditiva, retrocompatível e não reescreve nem remove ledger,
      saldos ou transações existentes.
- [x] 8.3 **[API V2/AUTH]** Executar testes de login, renovação de token, usuário, consulta de saldo e histórico.
      Login, usuário, saldo, histórico, logout e verificação passaram. Renovação é `N/A`: o contrato atual não
      possui endpoint de refresh e a Fase 1 proíbe inventá-lo.
- [ ] 8.4 **[API V2/AUTH]** Executar análise V2 controlada e confirmar débito líquido exatamente 150.
      O cenário com a key do banco em 150 passou, mas o valor local persistido continua em 100; item não aprovado.
- [ ] 8.5 **[API V2/AUTH]** Executar Radar V2 controlado e confirmar débito líquido exatamente 150.
      O cenário forçado em 150 passou, mas a configuração local efetiva da V2 continua em 75; item não aprovado.
- [x] 8.6 Confirmar que `v1-analysis:<uuid>` não colide com chaves ou transações da V2.
- [x] 8.7 Executar toda a suíte automatizada da V2 afetada pelo `[AUTH]` e registrar evidências.
- [x] 8.8 Se qualquer item 8.1–8.7 falhar, bloquear as fases de ambiente de teste e produção até correção e nova
      execução completa desta fase.
      **Gate bloqueado:** itens 8.4 e 8.5 não refletem 150/150 nos valores locais da tabela `settings`. A suíte completa da V2
      também terminou com 6 falhas fora do conjunto diretamente afetado, registradas na evidência da fase.

## Fase 9 — Validação local

- [x] 9.1 Usar bancos e credenciais locais/de teste; nunca apontar suíte para produção.
- [x] 9.2 Validar sucesso: saldo `1000 -> 900` após análise.
- [x] 9.3 Validar persistência: `/trades` mantém saldo `900 -> 900`.
- [x] 9.4 Validar falha da IA: saldo retorna ao valor inicial.
- [x] 9.5 Validar saldo insuficiente: IA não é chamada.
- [x] 9.6 Validar retry/duplo clique: somente uma reserva e um débito.
- [ ] 9.7 Anexar as evidências da Fase 8 comprovando que a V2 permanece funcional.
      **Bloqueado:** os valores locais da tabela `settings` ainda estão em análise 100 e Radar 75, em vez de 150/150.
- [x] 9.8 Entregar evidências ao usuário e aguardar autorização antes de qualquer deploy.
      A solicitação para executar as Fases 10 e 11 foi registrada, mas não supera os gates técnicos 8.8 e 9.7.

## Fase 10 — Ambiente de teste (GATE: autorização explícita)

**NÃO INICIADA:** bloqueada pelos itens 8.8 e 9.7. Nenhuma branch, serviço ou ambiente remoto foi alterado.

- [ ] 10.1 Criar tags de segurança dos commits atualmente implantados em FE V1, API V1, API V2 e AUTH.
- [ ] 10.2 Publicar primeiro em branches de teste, sem tocar nas branches de produção.
- [ ] 10.3 Confirmar `GENESIS_AUTH_ENABLED=true`, `GENESIS_AUTH_CREDITS_FULL_ENABLED=true` e token interno válido no
      ambiente de teste, sem exibir segredos.
- [ ] 10.4 Executar smoke test V1 com usuário controlado: análise cobra 100; `/trades` cobra zero.
- [ ] 10.5 Forçar falha controlada do provedor e confirmar liberação dos 100.
- [ ] 10.6 Validar histórico no `[AUTH]` e ausência de transação financeira local.
- [ ] 10.7 Reexecutar no ambiente de teste os fluxos V2: autenticação, saldo, análise 150 e Radar 150.
- [ ] 10.8 Bloquear produção se houver regressão V2, mesmo que todos os testes V1 tenham passado.
- [ ] 10.9 Obter aceite explícito do usuário antes da produção.

## Fase 11 — Produção (GATE: autorização explícita)

**NÃO INICIADA:** produção permanece bloqueada. Nenhum SSH, deploy, processo ou Nginx foi acessado ou alterado.

- [ ] 11.1 Confirmar branches, commits, backups lógicos e plano de rollback sem alterar Nginx.
- [ ] 11.2 Implantar versões aprovadas de FE V1 e API V1; alterar `[AUTH]` somente se a fase de testes provar que o
      contrato existente precisa de complemento.
- [ ] 11.3 Reiniciar somente processos da aplicação estritamente necessários; não tocar no Nginx.
- [ ] 11.4 Fazer uma análise V1 controlada e confirmar uma única reserva/captura de 100.
- [ ] 11.5 Confirmar que o `POST /trades` subsequente não altera o saldo.
- [ ] 11.6 Fazer smoke test V2 controlado: autenticação, saldo, análise 150 e Radar 150.
- [ ] 11.7 Monitorar erros V1/V2, reservas abertas e duplicidades durante a janela combinada.
- [ ] 11.8 Se algum critério V1 ou V2 falhar, interromper novas validações e executar rollback da aplicação sem
      apagar dados.

## Fase 12 — Auditoria histórica (somente leitura; GATE separado)

- [ ] 12.1 Determinar, por commit/deploy/log, a data inicial exata do período afetado.
- [ ] 12.2 Criar consulta/script read-only que encontre pares de débitos de 100 por usuário em intervalo compatível
      com uma única análise.
- [ ] 12.3 Correlacionar os pares com análise e trade, classificando `confirmado`, `provável` ou `inconclusivo`.
- [ ] 12.4 Gerar relatório mascarado com usuário, data, transações, evidência e valor proposto de restituição.
- [ ] 12.5 Conferir total de usuários e total de créditos sem alterar saldo.
- [ ] 12.6 Entregar o relatório ao proprietário e aguardar autorização explícita para restituição.

## Fase 13 — Restituição (GATE destrutivo/financeiro separado)

- [ ] 13.1 Criar snapshot/export auditável antes de movimentar qualquer saldo.
- [ ] 13.2 Restituir somente casos aprovados, exatamente 100 por duplicidade confirmada.
- [ ] 13.3 Usar chave única `refund:v1:double-analysis:<id-estável>` em cada restituição.
- [ ] 13.4 Executar primeiro em modo dry-run e comparar contagem/total com o relatório aprovado.
- [ ] 13.5 Executar a restituição uma única vez após nova autorização explícita.
- [ ] 13.6 Rodar novamente o dry-run e confirmar zero restituições pendentes/repetíveis.
- [ ] 13.7 Guardar relatório final com vínculo entre débitos originais e transação de devolução.

## Fase 14 — Encerramento

- [ ] 14.1 Atualizar esta spec com commits, testes, evidências e datas reais de cada ambiente.
- [ ] 14.2 Confirmar todos os critérios de aceitação de `requirements.md`, incluindo compatibilidade V2.
- [ ] 14.3 Registrar pendências não relacionadas sem incorporá-las silenciosamente ao escopo.
- [ ] 14.4 Marcar o spec como concluído somente após correção, produção validada e decisão explícita sobre a
      restituição histórica.
