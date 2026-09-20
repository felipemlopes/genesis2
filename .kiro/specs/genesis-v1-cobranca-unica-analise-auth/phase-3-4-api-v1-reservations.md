# Evidências — Fases 3 e 4

Data: 20/09/2026

Escopo executado: somente código e testes locais da API V1. Nenhum commit, push, deploy, acesso ao servidor,
alteração de produção ou alteração de Nginx foi realizado.

## Resultado

- `GenesisAuthClient` passou a oferecer `reserveCredit()`, `captureCredit()` e `releaseCredit()`.
- A reserva usa o bearer do usuário; captura e liberação usam `GENESIS_AUTH_INTERNAL_TOKEN`.
- Todas as chamadas do cliente têm timeout de 10 segundos e preservam os status HTTP do Auth.
- `/api/v1/analyze` exige `Idempotency-Key` em formato UUID e usa no Auth a chave
  `v1-analysis:<uuid>`.
- A análise reserva exatamente 100 créditos antes de chamar o provedor pago.
- Falha na reserva impede a chamada ao provedor.
- Resposta válida do provedor é capturada; timeout, exceção, HTTP de erro, resposta vazia ou inválida liberam a
  reserva.
- Falha ou exceção na captura não libera a reserva automaticamente: gera log de reconciliação para evitar um
  estorno indevido depois de uma captura possivelmente concluída no Auth.
- O caminho `/analyze` não usa mais carteira local nem `adjustCredit(debit)`.
- Os logs do ciclo guardam somente identificadores operacionais e hash da tentativa, sem bearer, token interno ou
  imagem.

## Compatibilidade do Auth e V2

O Auth local já possuía os contratos necessários:

- `POST /api/credits/reservations`, autenticado pelo bearer do usuário;
- `POST /api/credits/reservations/{uuid}/capture`, autenticado por token interno;
- `POST /api/credits/reservations/{uuid}/release`, autenticado por token interno.

Por isso, nenhum arquivo do Auth e nenhum arquivo da API V2 foi alterado nas fases 3 e 4. A suíte existente de
reservas do Auth passou com 8 testes e 24 asserções, incluindo a caracterização da análise V2 em 150 créditos.

## Testes da API V1

Comando direcionado:

```text
php artisan test tests/Feature/GenesisAuthClientReservationTest.php tests/Feature/IAGatewayReservationFlowTest.php tests/Feature/CreditosCompletoIAGatewayControllerTest.php tests/Feature/CobrancaDuplicadaAnaliseBaselineTest.php tests/Feature/CreditosCompletoTradeControllerTest.php
```

Resultado: 15 testes aprovados, 63 asserções, zero falhas.

Também foi executada a suíte completa da API V1: 25 testes passaram e somente o `Feature/ExampleTest` padrão
falhou antes de exercitar o código alterado, por ausência de `APP_KEY` no ambiente de teste
(`MissingAppKeyException`). A configuração não foi alterada para esconder essa falha ambiental.

A validação de sintaxe (`php -l`) passou em todos os arquivos PHP modificados ou adicionados nestas fases, e
`git diff --check` não encontrou erros de whitespace.

## Limite atual e próxima fase

As fases 3 e 4 corrigem a cobrança de `/analyze`, mas ainda não concluem a correção financeira ponta a ponta.
`TradeController::store()` continua cobrando 100 créditos no `POST /trades`, conforme o baseline preservado. Até a
Fase 5 tornar `/trades` financeiramente neutro, o fluxo completo análise + persistência ainda pode totalizar 200
créditos. Essa pendência é intencional e não deve ser confundida com conclusão integral da spec.
