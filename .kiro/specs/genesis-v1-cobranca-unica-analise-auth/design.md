# Design — Cobrança Única da Análise V1 no Auth

## Visão Geral

O fluxo atual possui duas autoridades funcionais cobrando o mesmo serviço. O design novo transforma
`IAGatewayController::analyze()` no único orquestrador da cobrança e remove qualquer efeito financeiro de
`TradeController::store()`.

O `[AUTH]` continua sendo a única fonte de verdade do saldo. A `[API V1]` apenas orquestra o ciclo já suportado
pelos endpoints de reserva do `[AUTH]`: reservar, capturar ou liberar.

## Estado atual confirmado em produção

```text
[FE V1] handleAnalyze()
    |
    +--> POST /analyze
    |       +--> [API V1] adjustCredit(debit, 100, idempotency=null)
    |       +--> [AUTH] débito 100
    |       +--> provedor de IA
    |
    +--> POST /trades
            +--> [API V1] adjustCredit(debit, 100, idempotency=null)
            +--> [AUTH] débito 100

Resultado atual: 200 créditos por uma análise cujo preço correto é 100.
```

## Arquitetura proposta

```mermaid
sequenceDiagram
    participant FE as FE V1
    participant API as API V1 /analyze
    participant AUTH as Microserviço Auth
    participant AI as Provedor de IA

    FE->>API: POST /analyze + Idempotency-Key
    API->>AUTH: reserve(100, key, v1-analysis)
    alt saldo insuficiente ou Auth indisponível
        AUTH-->>API: 402/erro
        API-->>FE: erro sem chamar IA
    else reserva criada ou já existente
        AUTH-->>API: reservation_uuid
        API->>AI: executar análise
        alt resultado válido
            AI-->>API: resultado
            API->>AUTH: capture(reservation_uuid)
            API-->>FE: resultado
            FE->>API: POST /trades
            Note over API: persiste somente; zero crédito
        else erro/timeout/resposta inválida
            AI-->>API: falha
            API->>AUTH: release(reservation_uuid)
            API-->>FE: erro com saldo restaurado
        end
    end
```

## Decisões Arquiteturais

| Decisão | Justificativa |
|---|---|
| Cobrança pertence a `/analyze`, nunca a `/trades` | `/analyze` representa o serviço pago; `/trades` é persistência posterior e pode ser chamado ou repetido independentemente. |
| Usar reserva/captura/liberação, não `adjust` direto | Evita cobrança definitiva quando o provedor falha e reaproveita infraestrutura já existente no `[AUTH]`. |
| `[AUTH]` é a única carteira | As flags de produção já estão ligadas; fallback local criaria novamente duas fontes de saldo. |
| Preço continua vindo da regra V1, fixado em 100 e coberto por teste | Este spec corrige duplicidade, não redefine preço comercial. |
| Chave de idempotência nasce no frontend | É o único componente que sabe se um clique é retry da mesma intenção ou uma nova análise deliberada. |
| `/trades` mantém o contrato atual, mas sem efeitos financeiros | Minimiza risco no frontend e permite implantação compatível. |
| Restituição histórica é fase gated | Mexe em saldo real; primeiro gera relatório somente leitura, depois exige aprovação explícita. |
| Compatibilidade com a V2 é um gate de implantação | V1 e V2 compartilham o `[AUTH]`; nenhuma correção da V1 pode quebrar contratos ou regras consumidos pela V2. |
| Alteração no `[AUTH]` é o último recurso | Se reserva/captura/liberação já atenderem à V1, somente a `[API V1]` muda sua integração. |

## Componentes afetados

### `[FE V1]`

Arquivos principais:

- `App.tsx`: coordena `analyzeChart()` e o `POST /trades` automático.
- `services/geminiService.ts`: envia `POST /analyze`.
- Novo helper de idempotência, preferencialmente isolado em `services/analysisIdempotency.ts`.

Responsabilidades:

1. Criar uma chave estável para a tentativa.
2. Enviar a chave no header `Idempotency-Key`.
3. Reutilizá-la em retry de rede.
4. Encerrar a chave quando a tentativa chegar a estado terminal.
5. Continuar chamando `/trades` para persistência, sem pressupor cobrança nessa rota.

### `[API V1]`

Arquivos principais:

- `app/Http/Controllers/Api/IAGatewayController.php`
- `app/Http/Controllers/Api/TradeController.php`
- `app/Services/GenesisAuthClient.php`
- Requests e testes relacionados.

Responsabilidades:

1. Validar `Idempotency-Key` em `/analyze`.
2. Reservar 100 no `[AUTH]` antes de chamar a IA.
3. Capturar uma única vez após resultado válido.
4. Liberar a reserva em qualquer falha terminal.
5. Nunca debitar carteira local.
6. Tornar `/trades` financeiramente neutro.

### `[AUTH]`

Infraestrutura existente a reutilizar:

- `POST /api/credits/reservations`
- `POST /api/credits/reservations/{uuid}/capture`
- `POST /api/credits/reservations/{uuid}/release`
- Restrição única `(user_id, idempotency_key)` em `credit_reservations`.

Alterações no `[AUTH]` só são necessárias se os contratos atuais não devolverem estado suficiente para retry,
reconciliação e observabilidade. Não criar um segundo mecanismo de débito para a V1.

### Compatibilidade do `[AUTH]` com a V2

A V2 é consumidora do mesmo microserviço e deve permanecer funcional. Portanto:

1. Primeiro, caracterizar com testes os contratos do `[AUTH]` usados atualmente pela V2.
2. Reutilizar os endpoints existentes sem alterar o comportamento observado pela V2.
3. Se uma extensão for indispensável, adicionar campos opcionais ou novos endpoints versionados; nunca remover,
   renomear ou tornar obrigatório um campo existente.
4. Preservar autenticação, autorização, status HTTP e formatos de resposta usados pela V2.
5. Manter namespaces de idempotência separados: `v1-analysis:<uuid>` para a V1 e o contexto já usado pela V2.
6. Qualquer migração deve ser aditiva e retrocompatível, com defaults seguros e sem reescrever o ledger existente.
7. Não mudar as regras comerciais da V2: análise 150, Radar 150 e acumulação inalterada.
8. A suíte de regressão V2 é bloqueante para qualquer publicação do `[AUTH]`.

Fluxos mínimos da V2 a proteger:

| Fluxo V2 | Invariante |
|---|---|
| Login e renovação de token | Mesmos contratos e comportamento de autenticação. |
| Consulta de usuário e saldo | Mesma resposta e saldo consistente. |
| Análise concluída | Débito líquido exatamente 150. |
| Falha de análise | Comportamento financeiro existente preservado; nenhum débito novo causado pela correção V1. |
| Radar concluído | Débito líquido exatamente 150. |
| Retry/idempotência | Nenhuma colisão com chaves prefixadas por `v1-analysis`. |
| Histórico/ledger | Registros anteriores continuam legíveis e nenhuma migração remove dados. |

## Contrato HTTP proposto

### Frontend → API V1

```http
POST /analyze
Authorization: Bearer <token>
Idempotency-Key: <uuid-estável-da-tentativa>
Content-Type: multipart/form-data
```

Respostas relevantes:

- `200`: análise concluída e reserva capturada.
- `402`: saldo insuficiente; IA não chamada.
- `409`: chave encerrada/incompatível com nova tentativa.
- `502/503`: dependência indisponível; sem débito definitivo.

### API V1 → Auth

Reserva:

```json
{
  "idempotency_key": "v1-analysis:<uuid>",
  "amount": 100,
  "description": "Análise V1"
}
```

Captura e liberação usam o `reservation_uuid` devolvido pelo `[AUTH]` e o token interno de serviço já configurado.

## Máquina de estados

```text
NEW
  -> RESERVED
      -> CAPTURED   (resultado válido; débito líquido 100)
      -> RELEASED   (falha terminal; débito líquido 0)
```

Transições repetidas devem ser idempotentes:

- `reserve` com a mesma chave devolve a mesma reserva.
- `capture(CAPTURED)` não cobra novamente.
- `release(RELEASED)` não credita novamente.
- `capture(RELEASED)` e `release(CAPTURED)` não podem movimentar saldo e devem produzir resposta explícita.

## Idempotência e concorrência

Invariantes:

1. Mesmo usuário + mesma chave identifica uma única tentativa lógica.
2. Banco do `[AUTH]` garante unicidade, não apenas código PHP.
3. Reserva e débito acontecem sob transação e `lockForUpdate`.
4. `/trades` não participa da idempotência financeira porque não movimenta créditos.
5. Chaves diferentes representam análises diferentes e podem cobrar 100 cada.

## Tratamento de falhas

| Falha | Comportamento esperado |
|---|---|
| Saldo menor que 100 | 402; não chama IA. |
| Auth indisponível antes da reserva | 503; não chama IA; sem fallback local. |
| Timeout/erro da IA | libera reserva; saldo volta ao original. |
| Resposta inválida da IA | libera reserva; não persiste trade. |
| Falha ao capturar após sucesso da IA | não devolver sucesso ao frontend; manter tentativa reconciliável e repetir captura com a mesma reserva. |
| Conexão do frontend cai após sucesso | retry com a mesma chave não cria novo débito. |
| Processo morre com reserva aberta | reconciliador identifica reserva vencida e libera de forma idempotente, salvo evidência de resultado concluído. |

## Observabilidade

Logs estruturados sem token, senha, conteúdo integral do gráfico ou segredo interno:

- `v1.analysis.credit_reserved`
- `v1.analysis.credit_captured`
- `v1.analysis.credit_released`
- `v1.analysis.credit_reconciliation_needed`

Campos mínimos: `user_id`, hash/chave de tentativa, `reservation_uuid`, valor, estado e código da falha.

## Auditoria histórica e restituição

A auditoria deve ser somente leitura e considerar:

1. Duas transações de débito de 100 com descrição `Análise` para o mesmo usuário.
2. Proximidade temporal entre os débitos.
3. Uma requisição/resultado de análise e um trade criado no mesmo intervalo.
4. Janela iniciando na implantação do código que passou a cobrar também em `TradeController`.

Saída esperada:

```text
user_id | email mascarado | análise/data | débito_1 | débito_2 | confiança | valor_a_restituir
```

Restituição não faz parte do relatório. Após aprovação, cada crédito de 100 usa chave única
`refund:v1:double-analysis:<id-estável>` e registra referência aos débitos originais.

## Implantação e rollback

1. Implementar e testar localmente nos três repositórios necessários.
2. Implantar primeiro no ambiente de teste.
3. Confirmar saldo `1000 -> 900` após análise e `900 -> 900` após `/trades`.
4. Confirmar falha com saldo retornando ao valor inicial.
5. Executar a suíte de regressão V2 e confirmar análise 150, Radar 150 e contratos do `[AUTH]` intactos.
6. Criar referências imutáveis dos commits de produção antes do corte.
7. Implantar frontend e API de forma compatível; nenhuma alteração em Nginx.
8. Se o `[AUTH]` precisar mudar, publicar somente depois dos testes locais e do ambiente de teste passarem para V1
   e V2.
9. Rollback é feito por versão da aplicação, nunca apagando ledger ou transações novas.

## Fora de escopo

- Alterar preço da análise V1 (100).
- Alterar preço do Radar V1 (50).
- Alterar acúmulo ou renovação de créditos.
- Alterar regras ou preços da V2; a verificação de compatibilidade da V2 faz parte obrigatória do escopo.
- Alterar Nginx, CloudPanel, banco de produção ou saldos durante a implementação local.
- Executar restituições sem autorização explícita posterior.
