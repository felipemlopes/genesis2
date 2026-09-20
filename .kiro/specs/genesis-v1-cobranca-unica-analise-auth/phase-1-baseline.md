# Evidências da Fase 1 — Baseline anterior à correção

## Escopo e segurança

- Execução exclusivamente local.
- Nenhum acesso a servidor, produção, CloudPanel ou Nginx.
- Nenhuma chamada HTTP real: integrações externas são interceptadas por `Http::fake()`.
- Testes Laravel usam o SQLite dedicado configurado em `tests/bootstrap-sqlite.php`.
- Nenhuma regra funcional foi corrigida nesta fase; os testes registram o comportamento anterior.

## Versões locais verificadas

| Componente | Pasta | Branch | Commit |
|---|---|---|---|
| FE V1 | `E:\Projetos js\G-nesis-Labs-Oficial-1` | `main` | `a6bc004` |
| API V1 | `E:\Programas\wamp64\www\genesis-api-v1` | `master` | `ca516e8` |
| AUTH | `E:\Programas\wamp64\www\auth genesis` | `master` | `21fac21` |
| API V2 local/teste | `E:\Programas\wamp64\www\genesis-api` | `staging` | `ecc8b61` |
| API V2 produção (referência local) | `E:\Programas\wamp64\www\genesis-api` | `genesis2`/`production` | `845ed82` |

Não houve troca de branch. O diff dos arquivos de integração com o `[AUTH]` entre `genesis2` e `staging` não
apresentou mudança; o único diff do conjunto consultado estava em `routes/api.php`.

## Contratos do Auth consumidos pela V2

### Frontend V2

| Operação | Método e rota | Autenticação | Resposta consumida |
|---|---|---|---|
| Login | `POST /api/auth/login` | pública | `access_token`, `token_type`, `user` |
| Usuário atual | `GET /api/auth/me` | bearer Sanctum | `id`, `name`, `email`, `credits`, `role`, `status` |
| Logout | `POST /api/auth/logout` | bearer Sanctum | mensagem de sucesso |
| Saldo | `GET /api/credits/balance` | bearer Sanctum | `credits` |
| Consumo tipado | `POST /api/credits/consume/{type}` | bearer Sanctum | `credits` ou erro |

O frontend V2 não chama endpoint de renovação de token. O `[AUTH]` também não declara rota de refresh; por isso o
baseline protege login, `me`, logout e verificação de token, sem criar contrato inexistente.

### API V2

| Operação | Método e rota no Auth | Payload/credencial relevante |
|---|---|---|
| Verificar usuário | `GET /api/internal/verify-token` | bearer do usuário |
| Ajustar crédito | `POST /api/credits/adjust` | `direction`, `amount`, `description`, `idempotency_key` |
| Reservar análise | `POST /api/credits/reservations` | bearer do usuário; chave, valor e descrição |
| Capturar análise | `POST /api/credits/reservations/{uuid}/capture` | token interno de serviço |
| Liberar análise | `POST /api/credits/reservations/{uuid}/release` | token interno de serviço |
| Ajuste administrativo | `POST /api/credits/adjust-for-user` | token interno; email e valor |

## Baseline financeiro

- V1: `POST /analyze` envia débito 100 com `idempotency_key=null`.
- V1: o `POST /trades` subsequente envia outro débito 100 com `idempotency_key=null`.
- Resultado caracterizado: uma intenção de análise produz duas solicitações de débito, totalizando 200.
- V2: com a regra aprovada configurada, a reserva de análise encaminha 150 ao `[AUTH]`.
- V2: com `cost_micro_radar_credits=150`, a revelação do Radar encaminha débito 150 ao `[AUTH]`.
- Os valores default presentes no código/seed da V2 não são evidência suficiente do valor efetivo de cada
  ambiente; os testes fixam explicitamente 150 para proteger a regra aprovada sem alterar configuração funcional.

## Arquivos de teste adicionados ou reforçados

- FE V1: `tests/analysis-flow.baseline.test.mjs`.
- API V1: `tests/Feature/CobrancaDuplicadaAnaliseBaselineTest.php` e asserções reforçadas nos testes isolados.
- API V2: asserções de 150 nos testes de reserva da análise e débito do Radar.
- AUTH: contratos V2 de `me` e logout, complementando testes existentes de login, verificação de token, saldo,
  histórico, ajuste e reservas.

## Resultado da execução

Execução local concluída em 20/09/2026:

| Componente | Comando/suíte | Resultado |
|---|---|---|
| FE V1 | `npm run test:baseline` | 2 testes aprovados |
| API V1 | baseline de duplicidade + testes isolados de análise/trade | 5 testes, 21 asserções aprovadas |
| API V2 | cliente/reserva, Radar, consumo e verificação de token | 14 testes, 29 asserções aprovadas |
| AUTH | autenticação, saldo/histórico, ajuste e reservas, incluindo preços V2 exatos | 32 testes, 83 asserções aprovadas |

Total: **53 testes aprovados**, sem chamada a serviço real e sem alteração de comportamento funcional.

O teste da API V1 comprovou o defeito atual: `/analyze` e `/trades` enviam, juntos, dois débitos de 100 sem chave
de idempotência. Os testes V2/Auth confirmaram os contratos protegidos e os valores aprovados de 150 para análise
e Radar quando as configurações de negócio correspondentes estão definidas.
