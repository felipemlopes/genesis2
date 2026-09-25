# Plano de Implementação: Custo de IA e Resiliência da Análise

## Visão Geral

Ordem: **medir → cachear contexto → cortar retries → parar de invalidar → cortar repair → consumidores externos → thinking**. A Fase 0 vem antes de tudo porque dá a linha de base para provar economia. As Fases 1 e 2 são as de maior retorno esperado.

Repositórios: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** = `c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main`.

Regras: sem `RefreshDatabase` (sqlite persistente + `DatabaseTransactions`); nenhuma migração/seed sem perguntar; marcar este arquivo conforme concluir.

## Tarefas

- [ ] 0. Fase 0 — Medição e linha de base
  - [ ] 0.1 **[API]** Padronizar `provider_telemetry.{scan,vision,context,decision}` com `usage` (in/out/thinking), `http_calls`, `grounded`, `model`
    - _Requisitos: 1.1_
  - [ ] 0.2 **[API]** Log `genesis.ia.chamada` em todos os clientes HTTP de IA (incluindo `UtilityGeminiProxyController`, `MacroController`, `GeoEventService`, `ChartMetadataScanService`)
    - _Requisitos: 1.2_
  - [ ] 0.3 **[API]** Comando `genesis:custo-ia --desde=` agregando por etapa/modelo/dia e chamadas por análise concluída
    - _Requisitos: 1.3_
  - [ ] 0.4 **[API]** Rodar em produção (com autorização) e registrar a linha de base em `design.md`
    - _Requisitos: 1.4_
  - [ ] 0.5 Checkpoint: revisar com o Felipe onde está o maior custo antes de seguir

- [ ] 1. Fase 1 — Cache de contexto (macro 24h, sentimento por ativo)
  - [ ] 1.1 **[API]** Dividir `GeminiContextService::tentarColeta()` em geração de macro (global) e de sentimento (por ativo), mantendo o formato de `context_payload`
    - _Requisitos: 3.1_
  - [ ] 1.2 **[API]** `MacroContextCache`: TTL 24h, chave com data UTC + schema, lock, negative cache 15 min, `observed_at` do cache
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ] 1.3 **[API]** `SentimentContextCache`: por ativo, TTL `GENESIS_SENTIMENT_CACHE_TTL_MINUTES` (padrão 60, confirmar)
    - _Requisitos: 3.2, 3.3_
  - [ ] 1.4 **[API]** `MacroController::today`/`sentimento` passam a ler dos mesmos caches
    - _Requisitos: 2.6, 7.3_
  - [ ] 1.5 **[API]** Comando `genesis:macro:refresh` (invalidação manual)
  - [ ] 1.6 **[FE]** Exibir no card "Macro e Geopolítico" a hora de geração do macro (`observed_at`), não a hora da análise
    - _Requisitos: 2.5_
  - [ ] 1.7 **[API]** Testes: hit/miss/falha/negative cache/lock com `Http::fake` contando chamadas
  - [ ] 1.8 Checkpoint: suíte [API] verde

- [ ] 2. Fase 2 — Uma chamada por etapa
  - [ ] 2.1 **[API]** `GENESIS_GEMINI_CONTEXT_ATTEMPTS=1` (config, `.env.example`, remoção do loop de retry por negócio)
    - _Requisitos: 4.1_
  - [ ] 2.2 **[API]** Visão: retry só em erro de transporte (timeout/429/5xx), nunca por conteúdo
    - _Requisitos: 4.2_
  - [ ] 2.3 **[API]** `FailoverDecisionProvider`: 1 tentativa no primário antes do failover
    - _Requisitos: 4.3_
  - [ ] 2.4 **[API]** `GENESIS_GEMINI_MAX_ATTEMPTS=2`
    - _Requisitos: 4.4_
  - [ ] 2.5 **[API]** Conferir que o scan não tem retry além de primário + reserva
    - _Requisitos: 4.5_
  - [ ] 2.6 **[API]** Conferir e ajustar o limiar de `FinalizarAnalisesTravadas` com os novos valores
    - _Requisitos: 4.6_
  - [ ] 2.7 **[API]** Teste feature: caminho feliz com exatamente 1 chamada por etapa
  - [ ] 2.8 Checkpoint: suíte [API] verde

- [ ] 3. Fase 3 — Dado indisponível nunca invalida
  - [ ] 3.1 **[API]** Auditar `0` vs `null` (`safe(..., 0)`, `?? 0`, casts) em `MarketSnapshotService`, `TechnicalAnalysisService`, `DerivativesReadingService`, `SupplementalIndicatorsService`; uma subtarefa por caso real
    - _Requisitos: 5.1, 5.5_
  - [ ] 3.2 **[API]** `CanonicalBundleBuilder` publica `availability.unavailable[]` no bundle da decisão
    - _Requisitos: 5.2_
  - [ ] 3.3 **[API]** `GenesisPrompt`: regra de não citar/estimar itens indisponíveis
    - _Requisitos: 5.2_
  - [ ] 3.4 **[API]** `DecisionMechanicalRepair`: remover frases que citam indisponíveis e revalidar (texto curto demais → repair normal)
    - _Requisitos: 5.3_
  - [ ] 3.5 **[API]** Confirmar que `CANDLES_UNAVAILABLE_OR_INSUFFICIENT` continua sendo o único encerramento por dado
    - _Requisitos: 5.4_
  - [ ] 3.6 **[API]** Teste feature: indicador forçado a falhar → `COMPLETED`, campo `null`, sem menção no texto
  - [ ] 3.7 Checkpoint: suíte [API] verde

- [ ] 4. Fase 4 — Menos repair
  - [ ] 4.1 **[API]** Fallback de stop já na 1ª tentativa (remover `attempts() > 1`)
    - _Requisitos: 6.1_
  - [ ] 4.2 Decisão do Felipe: número não rastreado → remover frase ou rebaixar a aviso
  - [ ] 4.3 **[API]** Implementar a decisão 4.2 em `DecisionMechanicalRepair`
    - _Requisitos: 6.1_
  - [ ] 4.4 **[API]** Confirmar a cobertura de `MONEY_FORMAT_RAW_NUMBER`/`TEXT_FORBIDDEN` pela correção mecânica
    - _Requisitos: 6.1_
  - [ ] 4.5 **[API]** Teste: nenhuma correção mecânica altera direction/score/entrada/stop/alvos
    - _Requisitos: 6.3_
  - [ ] 4.6 **[API]** Medir a taxa de repair antes/depois com `genesis:custo-ia`
    - _Requisitos: 6.4_
  - [ ] 4.7 Checkpoint: suíte [API] verde

- [ ] 5. Fase 5 — Consumidores fora da análise
  - [ ] 5.1 **[FE]** + **[API]** Confirmar se `UtilityGeminiProxyController` tem consumidor real; remover a rota ou aplicar rate limit + telemetria
    - _Requisitos: 7.1_
  - [ ] 5.2 **[API]** Confirmar que `GET /v1/geo-events` só lê do banco
    - _Requisitos: 7.2_

- [ ] 6. Fase 6 — Thinking por etapa
  - [ ] 6.1 **[API]** Benchmark HIGH vs MEDIUM (decisão e visão) com `BenchmarkGenesisBrainV2`
    - _Requisitos: 8.1_
  - [ ] 6.2 Decisão do Felipe com base no benchmark
    - _Requisitos: 8.2_

- [ ] 7. Aceite
  - [ ] 7.1 Rodar `genesis:custo-ia` em produção 3–7 dias após o deploy e comparar com a linha de base (0.4)
  - [ ] 7.2 Felipe roda análises reais no navegador (incluindo um ativo com indicador faltando) e confirma o resultado
