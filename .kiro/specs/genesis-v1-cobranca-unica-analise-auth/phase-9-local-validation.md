# Evidências da Fase 9 — Validação local

Data: 2026-09-20

## Resultado

A validação local dos itens 9.1 a 9.6 foi concluída. O item 9.7 permanece bloqueado pelo gate da Fase 8; por
consequência, as Fases 10 e 11 não foram iniciadas.

Nenhum teste apontou para produção. O `[AUTH]` e a `[API V1]` usam `APP_ENV=testing`, banco SQLite e o arquivo
local `database/testing.sqlite`. Chamadas HTTP externas foram substituídas por fakes e requisições não previstas
foram bloqueadas pelos próprios testes.

## Critérios validados

| Item | Evidência | Resultado |
|---|---|---|
| 9.2 | Reserva e captura V1 partindo de 1000 créditos | saldo final 900 |
| 9.3 | Cinco chamadas sucessivas a `/trades` depois do saldo inicial 900 | saldo final 900; nenhuma nova transação financeira |
| 9.4 | Erro HTTP, resposta inválida e timeout da IA | reserva liberada; captura não executada; débito líquido zero |
| 9.5 | `[AUTH]` responde 402 por saldo insuficiente | provedor de IA e captura não são chamados |
| 9.6 | Mesma chave repetida 20 vezes e retry no frontend | uma reserva e um débito máximo de 100; mesma chave reaproveitada |

## Execuções

- `[AUTH]`: `V1AnalysisCreditPropertiesTest` e `CreditReservationTest` — 16 testes aprovados, 86 assertions.
- `[API V1]`: `IAGatewayReservationFlowTest`, `CreditosCompletoIAGatewayControllerTest`,
  `CreditosCompletoTradeControllerTest` e `CobrancaDuplicadaAnaliseBaselineTest` — 12 testes aprovados,
  59 assertions.
- `[FE V1]`: `npm run test:baseline` — 6 testes aprovados.

## Gate não satisfeito

O item 9.7 exige evidência de que a V2 permanece funcional com os preços aprovados. Essa evidência não existe
enquanto os valores locais da tabela `settings` continuarem em análise 100 e Radar 75, contra a regra obrigatória
150/150. O código já lê essas keys do banco sem fallback; nenhum valor persistido foi alterado.

A autorização do usuário para executar as Fases 10 e 11 foi registrada, porém a própria spec determina que
autorização operacional não substitui o gate técnico. Ambiente de teste e produção continuam bloqueados até:

1. corrigir a configuração V2 em uma fase autorizada;
2. repetir integralmente a Fase 8;
3. aprovar o item 9.7;
4. só então executar as Fases 10 e 11 na ordem.
