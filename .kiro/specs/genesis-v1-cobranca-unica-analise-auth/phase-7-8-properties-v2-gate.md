# Evidências das Fases 7 e 8

Data: 2026-09-20

Escopo: execução exclusivamente local. Nenhum commit, push, deploy, acesso ao servidor, alteração de banco de
produção ou mudança de Nginx foi realizado.

## Resultado executivo

- Fase 7: concluída.
- Fase 8: executada, porém bloqueada pelos itens 8.4 e 8.5.
- A implementação V1 não está autorizada a avançar aos ambientes de teste ou produção enquanto o gate V2 não
  for corrigido e repetido integralmente.

## Fase 7 — propriedades e integração V1

Foi criado `tests/Feature/V1AnalysisCreditPropertiesTest.php` no `[AUTH]`. Resultado: 6 testes aprovados e 53
assertions:

- sucesso terminal: saldo `300 -> 200`, com uma única retirada de 100;
- falha terminal: saldo `300 -> 300`, após liberação da reserva;
- mesma chave repetida 20 vezes: uma única reserva e débito líquido máximo de 100;
- duas chaves válidas diferentes: dois débitos de 100;
- Radar V1: débito exato de 50;
- namespace `v1-analysis:<uuid>` não colide com uma chave V2 sem o prefixo.

O teste de `/trades` foi ampliado para cinco chamadas sucessivas. Resultado: 3 testes aprovados e 18 assertions;
as cinco operações são persistidas sem chamada financeira ao `[AUTH]` e sem transação na carteira local.

### Suítes executadas

| Projeto | Comando/escopo | Resultado |
|---|---|---|
| FE V1 | `npm run test:baseline` | 6 testes aprovados |
| FE V1 | `npm run build` | aprovado; somente aviso de chunk acima de 500 kB |
| API V1 | suíte completa | 26 aprovados, 1 falhou, 95 assertions |
| AUTH | suíte completa | 68 aprovados, 239 assertions |

A única falha da suíte completa da API V1 foi `Tests\\Feature\\ExampleTest`, causada por
`MissingAppKeyException` no ambiente local. O teste direcionado de `/trades` passou separadamente. A falha não
foi alterada ou ocultada nesta fase.

## Fase 8 — compatibilidade V2

### Contrato do AUTH

O diff confirma que os contratos já consumidos pela V2 não tiveram rota, verbo, autenticação, campo obrigatório,
código HTTP ou formato nominal de resposta removido. A única rota nova é aditiva:

`POST /api/credits/reservations/{reservation}/result-completed`

A migração `2026_09_20_000007_add_result_completed_at_to_credit_reservations_table.php` apenas adiciona a coluna
nullable `result_completed_at`. Ela não remove ou reescreve ledger, saldos, reservas ou transações existentes.

O reconciliador atua somente em reservas cujo namespace começa com `v1-analysis:`. O teste com o mesmo UUID nos
namespaces V1 e V2 confirmou duas reservas independentes, nos valores 100 e 150.

O contrato atual não possui endpoint de renovação de token. Conforme decidido na Fase 1, nenhum endpoint de
refresh foi inventado. Login, logout, usuário, verificação de token, saldo e histórico foram cobertos pelos testes
do `[AUTH]` e da API V2.

### Testes diretamente afetados na V2

Os testes direcionados abaixo passaram: 14 testes e 29 assertions.

- `CreditReservationServiceGenesisAuthTest`;
- `CreditosCompletoRadarControllerTest`;
- `CreditControllerGenesisAuthTest`;
- `VerifyGenesisAuthTokenTest`.

Os cenários de análise e Radar passam quando o teste sobrescreve explicitamente os dois custos para 150. Isso
prova que os caminhos de integração aceitam o preço correto, mas não prova que a instalação local esteja
configurada corretamente.

### Bloqueio de preço

A aplicação passou a ler os dois preços exclusivamente da tabela `settings`, sem fallback numérico. Os valores
persistidos encontrados na API V2 local continuam incompatíveis com a regra 150/150:

- análise V2: 100 (`cost_analisys_credits`);
- Radar V2: 75 (`cost_micro_radar_credits`).

Portanto, os itens 8.4 e 8.5 não foram aprovados e o gate 8.8 foi acionado. Nenhum nome ou valor de key foi
alterado; a atualização dos valores de produção ficou reservada ao usuário.

### Suíte completa da API V2

A suíte completa foi executada na branch local `staging`: 1223 testes aprovados, 13 ignorados e 6 falhas, com
3572 assertions em 473,05 segundos. A branch informada como produção é `genesis2`; seus contratos com o `[AUTH]`
foram auditados por leitura, sem checkout e sem alteração do worktree.

Falhas registradas:

- `GeminiModelUnicoTest`: 1 falha porque o Bash não resolveu o caminho Windows do script;
- `ManifestoV65Test`: 2 falhas pelo mesmo problema de caminho Windows/Bash;
- `GraphicalAnalysisAttemptJobTest`: 2 falhas, análises permaneceram `PENDING` em vez de `FAILED`/`COMPLETED`;
- `GraphicalAnalysisFullPipelineIntegrationTest`: 1 falha, análise permaneceu `PENDING`.

Essas seis falhas ficam registradas separadamente porque não pertencem ao conjunto diretamente afetado pelo
`[AUTH]`. Ainda assim, não foram classificadas como irrelevantes nem corrigidas silenciosamente.

## Condição para reabrir o gate

1. Corrigir, em uma fase explicitamente autorizada, a configuração V2 para análise 150 e Radar 150.
2. Repetir os testes de preço sem sobrescrever os valores efetivos da instalação.
3. Reexecutar todo o gate da Fase 8 e registrar o resultado.
4. Manter bloqueadas as fases de ambiente de teste e produção até todos os itens 8.1–8.7 passarem.
