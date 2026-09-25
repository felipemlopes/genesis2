# Plano de Implementação: Custo de IA e Resiliência da Análise

## Visão Geral

Ordem: **medir → cachear contexto → cortar retries → parar de invalidar → cortar repair → consumidores externos → thinking**. A Fase 0 vem antes de tudo porque dá a linha de base para provar economia. As Fases 1 e 2 são as de maior retorno esperado.

Repositórios: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** = `c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main`.

Regras: sem `RefreshDatabase` (sqlite persistente + `DatabaseTransactions`); nenhuma migração/seed sem perguntar; marcar este arquivo conforme concluir.

## Tarefas

- [ ] 0. Fase 0 — Medição e linha de base
  - [x] 0.1 **[API]** Tokens por etapa em cada análise
    - [x] 0.1.1 `AiUsageRecorder`: coletor que recebe o uso de **cada** chamada (sucesso ou falha) com motivo `primeira`/`retry`/`failover`/`repair`
    - [x] 0.1.2 `GeminiVisionService`, `GeminiContextService`, `GeminiDecisionClient`, `OpenAiDecisionClient`, `FailoverDecisionProvider`: reportar toda tentativa ao coletor, não só a final
      - `OpenAiInteractionsClient`/`GeminiInteractionsClient`/`VisualLevelsService`/`GraphicalAnalysisAttemptService` ficaram de fora: órfãos, só o benchmark usa
    - [x] 0.1.3 `GeminiContextService`: registrar `thought_tokens` e `grounding_queries` (`groundingMetadata.webSearchQueries`)
    - [x] 0.1.4 Job: merge acumulativo em `provider_telemetry.{etapa}` (soma + `calls[]`), acumulando entre repairs; `total` recalculado, inclusive em `finalizarComoFalha()`/`failed()`
      - `handle()` virou try/finally em volta de `processar()`: o `finally` grava o que sobrou em qualquer saída antecipada
    - [x] 0.1.5 Scan: guardar uso em cache por `image_hash` e anexar em `provider_telemetry.scan` na criação da análise
      - chave `genesis:scan_usage:{user_id}:{sha256}`, 1h; scans repetidos da mesma imagem somam
    - [~] 0.1.6 Etapa vinda do cache (macro/sentimento/decisão reutilizada) registra `cache_hit: true` e tokens 0
      - feito para a decisão reutilizada por `manifest_hash`; macro/sentimento entram junto com o cache da Fase 1
    - [x] 0.1.7 Testes com `Http::fake`: 1 chamada, retry, failover e repair produzem somas e `calls[]` corretos; chamada falha entra com tokens `null`
    - _Requisitos: 1.1, 1a–1g_
    - **Testes (25/09/2026):** `tests/Unit/AiUsageRecorderTest.php` (5), `ChartMetadataScanFallbackTest::test_consumo_registra_as_duas_tentativas`, `GraphicalAnalysisAttemptJobTest` (+2: caminho feliz e 3 repairs até FAILED, `--process-isolation`)
  - [x] 0.2 **[API]** Log `genesis.ia.chamada` em todos os clientes HTTP de IA (incluindo `UtilityGeminiProxyController`, `MacroController`, `GeoEventService`, `ChartMetadataScanService`)
    - _Requisitos: 1.2_
  - [x] 0.3 **[API]** Comando `genesis:custo-ia --desde=` agregando por etapa/modelo/dia e chamadas por análise concluída; `--analise=ID` detalha uma análise
    - _Requisitos: 1.3_
  - [~] 0.4 **[API]** Linha de base: **local**, não produção (decisão do Felipe, 25/09/2026: nada de medição em produção; deploy só com tudo pronto)
    - Legado local medido (design.md → "Linha de base local")
    - 2 análises reais locais (175 BTC, 176 APT) com o código novo: Gemini em 503/timeout na visão, nenhuma chegou à decisão. Falta repetir quando o Gemini estiver estável (`php artisan teste:v611-analise` + `queue:work --stop-when-empty`)
    - _Requisitos: 1.4_
  - [ ] 0.5 Checkpoint: revisar com o Felipe onde está o maior custo antes de seguir

- [ ] 1. Fase 1 — Cache de contexto (macro 24h, sentimento por ativo)
  - [ ] 1.1 **[API]** Dividir `GeminiContextService::tentarColeta()` em geração de macro (global) e de sentimento (por ativo), mantendo o formato de `context_payload`
    - _Requisitos: 3.1_
  - [ ] 1.2 **[API]** `MacroContextCache`: TTL 24h, chave com data UTC + schema, lock, negative cache 15 min, `observed_at` do cache
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ] 1.3 **[API]** `SentimentContextCache`: por ativo, TTL `GENESIS_SENTIMENT_CACHE_TTL_MINUTES` (padrão 360 = 6h, decidido)
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
  - [ ] 2.2 **[API]** Visão: retry só em erro de transporte (timeout/429/5xx), nunca por conteúdo, usando modelo reserva
    - _Requisitos: 4.2_
  - [ ] 2.2a **[API]** Visão sem resposta depois do retry interno: não reexecutar o job inteiro (encerrar com estorno)
    - _Requisitos: 4.2a_
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
  - [x] 4.2 Decisão do Felipe (25/09/2026): número que não bate → remover a frase inteira
  - [ ] 4.3 **[API]** `DecisionMechanicalRepair`: remover a frase com número não rastreado/divergente (`UNACCOUNTED_NUMERIC_LITERAL`, `NUMERIC_CITATION_VALUE_MISMATCH`) e revalidar; texto curto demais → repair normal
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

- [ ] 8. Fase 8 — Bundle da decisão menor (achado da Fase 0; candidata a vir antes da Fase 1)
  - [ ] 8.1 **[API]** Resumir `flow.cvd_series` em PHP para o decisor (ou mover para `DISPLAY_ONLY`), mantendo a série completa para exibição
    - _Requisitos: 9.1_
  - [ ] 8.2 **[API]** Auditar `structure.local_pivots`, `structure.labels` e `structure.structural_pivots` pelo mesmo critério
    - _Requisitos: 9.2_
  - [ ] 8.3 **[API]** Benchmark antes/depois (`BenchmarkGenesisBrainV2`): direção/score equivalentes
    - _Requisitos: 9.3_
  - [ ] 8.4 **[API]** Medir a entrada média por chamada de decisão antes/depois com `genesis:custo-ia`
    - _Requisitos: 9.4_

- [ ] 7. Aceite
  - [ ] 7.1 Rodar `genesis:custo-ia` em produção 3–7 dias após o deploy e comparar com a linha de base (0.4)
  - [ ] 7.2 Felipe roda análises reais no navegador (incluindo um ativo com indicador faltando) e confirma o resultado
