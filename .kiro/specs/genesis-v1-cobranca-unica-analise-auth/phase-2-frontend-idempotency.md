# Evidências da Fase 2 — Idempotência no frontend V1

## Escopo

- Projeto: `E:\Projetos js\G-nesis-Labs-Oficial-1`.
- Branch mantida: `main`.
- Execução exclusivamente local.
- Nenhuma alteração em API V1, API V2, Auth, servidor, banco, CloudPanel ou Nginx nesta fase.

## Implementação

Foi criado `services/analysisIdempotency.ts` com as seguintes regras:

1. A tentativa lógica é identificada por arquivo, par, timeframe, exchange, alavancagem e equity.
2. A chave é um UUID v4 criado no frontend.
3. A tentativa ativa é persistida em `sessionStorage` sob `genesis:v1:analysis-attempt`.
4. Retry com o mesmo fingerprint reutiliza a mesma chave, inclusive após remontagem do componente.
5. Mudança dos parâmetros que identificam a intenção cria outra chave.
6. Sucesso de `/analyze` seguido de sucesso de `/trades` encerra a chave.
7. Reset explícito descarta a chave.
8. Falha durante o fluxo mantém a tentativa para permitir retry com a mesma chave.
9. Se o navegador bloquear `sessionStorage`, um fallback em memória preserva o retry sem derrubar o fluxo.

`App.tsx` agora obtém a chave antes de `analyzeChart()` e a encerra somente depois que o fluxo completo termina.
`services/geminiService.ts` envia o header `Idempotency-Key` nas duas integrações existentes do `POST /analyze`.

## Validação

| Verificação | Resultado |
|---|---|
| Mesma tentativa reutiliza a chave | aprovado |
| Chave persiste para remontagem | aprovado |
| Nova tentativa recebe outra chave | aprovado |
| Conclusão remove a chave | aprovado |
| Storage indisponível usa fallback | aprovado |
| Header presente nos dois caminhos de `/analyze` | aprovado |
| `npm run test:baseline` | 6 testes aprovados |
| `npm run build` | aprovado |

O build manteve apenas o aviso já existente de chunk acima de 500 kB.

`npx tsc --noEmit` continua encontrando dois erros preexistentes: o argumento textual passado ao cálculo de
liquidação em `App.tsx` e a propriedade `raw_scores` em `components/MindMetrics.tsx`. Ambos já estavam no código
anterior à Fase 2; nenhum erro foi apontado no helper ou na integração de idempotência.

## Limite desta fase

O frontend agora envia a chave, mas a API V1 ainda não a valida nem a encaminha ao Auth. Portanto, esta fase
isoladamente não elimina a duplicidade de cobrança; a proteção financeira passa a ser efetiva somente após as
fases da API V1 e do Auth previstas na sequência da spec.
