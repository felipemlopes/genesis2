# Evidências — Fases 5 e 6

Data: 20/09/2026

Escopo executado: somente código, migração aditiva e testes locais da API V1 e do Auth. Nenhum commit, push,
deploy, acesso ao servidor, alteração de produção ou alteração de Nginx foi realizado.

## Fase 5 — `/trades` financeiramente neutro

`TradeController::store()` agora apenas associa o usuário autenticado, preenche o mesmo modelo `Trade`, persiste
e devolve o mesmo contrato HTTP de sucesso. Foram removidos desse caminho:

- `GenesisAuthClient::adjustCredit()`;
- leitura de `cost_analisys_credits`;
- consulta de saldo local;
- `withdrawFloat()`;
- branches das flags de crédito.

Os testes comprovam que saldo local zero não bloqueia a persistência, a flag do Auth não muda o comportamento e
duas chamadas consecutivas criam dois trades sem qualquer requisição financeira ao Auth ou transação na carteira
local.

Resultado isolado da Fase 5: 4 testes aprovados, 22 asserções.

## Fase 6 — concorrência e recuperação

### Unicidade e concorrência

A migração original já contém a restrição única real `(user_id, idempotency_key)`. Além da prova direta de que o
banco rejeita uma duplicata, foi criado teste multiprocesso com cinco requisições HTTP simultâneas usando o mesmo
usuário e a mesma chave. O resultado persistido é uma reserva, uma transação de débito e saldo reduzido em somente
100 créditos.

O endpoint de reserva também passou a repetir transações atingidas por lock, deadlock ou corrida de índice único.
Se outra requisição vencer a corrida, a reserva já existente é devolvida sem novo débito.

### Evidência de resultado e reconciliador

Foi adicionada ao Auth uma migração compatível e aditiva com o campo anulável `result_completed_at`. A API V1
marca esse campo, usando o token interno, depois de validar o resultado da IA e antes de capturar a reserva.

O comando `credits:reconcile-v1-analysis-reservations` processa somente reservas `RESERVED`, antigas e com chave
`v1-analysis:*`:

- com `result_completed_at`: captura, pois existe evidência persistente de resultado concluído;
- sem `result_completed_at`: libera e estorna, pois a tentativa foi abandonada antes de concluir;
- `CAPTURED` e `RELEASED`: são terminais e não voltam a ser movimentadas.

Cada item é relido com `lockForUpdate` dentro de transação. Repetir o comando não cria nova captura nem novo
estorno. Existe opção `--dry-run`, limite por lote e execução agendada a cada cinco minutos com
`withoutOverlapping`; nenhuma agenda foi ativada em servidor nesta execução local.

O filtro de namespace ignora explicitamente reservas da V2 e de outros produtos.

## Testes e compatibilidade

- API V1, suíte direcionada das Fases 3–6: 16 testes aprovados, 73 asserções.
- Auth, suíte completa: 62 testes aprovados, 186 asserções.
- A suíte do Auth inclui login, logout, usuário, saldo, histórico, análise V2 em 150 créditos e Radar V2 em 150
  créditos.
- API V1, suíte completa: 26 testes aprovados e somente o `Feature/ExampleTest` padrão falhou antes de exercitar
  o código alterado por ausência de `APP_KEY` (`MissingAppKeyException`), limitação ambiental já registrada nas
  fases anteriores.
- Validação de sintaxe PHP aprovada e `git diff --check` sem erros nos dois repositórios.

## Alterações no Auth

A mudança do Auth é aditiva: uma coluna anulável, um endpoint interno novo, um comando novo e lógica de retry no
endpoint existente sem mudar rota, payload, autenticação ou resposta nominal. Nenhum campo existente foi removido
ou tornado obrigatório. A API V2 não foi editada e reservas fora do namespace `v1-analysis:*` não são processadas
pelo reconciliador.

## Próxima fase

As Fases 5 e 6 encerram a duplicidade funcional conhecida e protegem concorrência/queda abrupta localmente. A
Fase 7 ainda precisa executar as propriedades financeiras completas, regressão explícita do Radar V1 e todas as
suítes afetadas antes dos gates de compatibilidade e implantação.
