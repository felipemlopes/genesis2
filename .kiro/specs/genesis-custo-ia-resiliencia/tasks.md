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

- [x] 1. Fase 1 — Cache de contexto (macro 24h, sentimento por ativo)
  - [x] 1.1 **[API]** Dividir `GeminiContextService::tentarColeta()` em geração de macro (global) e de sentimento (por ativo), mantendo o formato de `context_payload`
    - _Requisitos: 3.1_
    - `tentarBloco()` + um prompt por bloco; o parser aceita resposta com os dois blocos e lê só o pedido. Macro gerado com os eventos CRITICAL/HIGH globais (sem excluir ativo); eventos exibidos continuam por análise
  - [x] 1.2 **[API]** `MacroContextCache`: TTL 24h, chave com data UTC + schema, lock, negative cache 15 min, `observed_at` do cache
    - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_
    - Implementado dentro do próprio `GeminiContextService` (`macro()`/`sentimento()`/`blocoCacheado()`), sem classes novas. TTL de 24h conta a partir da geração (chave sem data), não até a meia-noite UTC
    - Lock: `Cache::lock(...)->block(75s)`; lock ocupado além disso → `CONTEXT_CACHE_LOCK_TIMEOUT` (UNAVAILABLE, sem chamar)
  - [x] 1.3 **[API]** `SentimentContextCache`: por ativo, TTL `GENESIS_SENTIMENT_CACHE_TTL_MINUTES` (padrão 360 = 6h, decidido)
    - _Requisitos: 3.2, 3.3_
  - [x] 1.4 **[API]** `MacroController::today`/`sentimento` passam a ler dos mesmos caches
    - _Requisitos: 2.6, 7.3_
    - geradores próprios do controller removidos; formato da resposta mantido (+ `observed_at`)
  - [x] 1.5 **[API]** Comando `genesis:macro:refresh` (invalidação manual)
    - `--sentimento=SYMBOL` (repetível) e `--so-sentimento`; apaga também o cache negativo
  - [x] 1.6 **[FE]** Exibir no card "Macro e Geopolítico" a hora de geração do macro (`observed_at`), não a hora da análise
    - _Requisitos: 2.5_
    - "gerado em DD/MM às HH:MM" sob o resumo macro e sob a narrativa de sentimento
  - [x] 1.7 **[API]** Testes: hit/miss/falha/negative cache/lock com `Http::fake` contando chamadas
  - [x] 1.8 Checkpoint: suíte [API] verde
    - **Testes (25/09/2026):** `GeminiContextServiceCacheTest` (7, novo), `GeminiContextServiceTest` ajustado para 2 chamadas, `GeminiContextServicePromptContradictionTest` (+1), `MacroControllerRemovedTest` (+1), `__tests__/geminiService.test.ts` (+1); FE 476 verdes

- [x] 2. Fase 2 — Uma chamada por etapa
  - [x] 2.1 **[API]** `GENESIS_GEMINI_CONTEXT_ATTEMPTS=1` (config, `.env.example`, remoção do loop de retry por negócio)
    - _Requisitos: 4.1_
    - loop removido e chave `context_max_attempts` removida da config (1 chamada por bloco, sem knob); falha fica no cache negativo de 15 min da Fase 1
  - [x] 2.2 **[API]** Visão: retry só em erro de transporte (timeout/429/5xx), nunca por conteúdo, usando modelo reserva
    - _Requisitos: 4.2_
    - `GENESIS_GEMINI_VISION_FALLBACK_MODEL` (padrão `gemini-3.6-flash`); 4xx e JSON inválido falham na hora; consumo da 2ª tentativa sai como `failover`
  - [x] 2.2a **[API]** Visão sem resposta depois do retry interno: não reexecutar o job inteiro (encerrar com estorno)
    - _Requisitos: 4.2a_
    - `failure_reason_code=VISION_UNAVAILABLE`, mensagem pública sem estado interno
  - [x] 2.3 **[API]** `FailoverDecisionProvider`: 1 tentativa no primário antes do failover
    - _Requisitos: 4.3_
  - [x] 2.4 **[API]** `GENESIS_GEMINI_MAX_ATTEMPTS=2`
    - _Requisitos: 4.4_
    - padrão da config e `.env.example`; `.env` local (gitignored) também ajustado. **No deploy: ajustar o `.env` de produção**
  - [x] 2.5 **[API]** Conferir que o scan não tem retry além de primário + reserva
    - _Requisitos: 4.5_
    - conferido: `ChartMetadataScanService` = principal + `scan_fallback_model`, sem retry adicional
  - [x] 2.6 **[API]** Conferir e ajustar o limiar de `FinalizarAnalisesTravadas` com os novos valores
    - _Requisitos: 4.6_
    - o limiar deriva de `max_attempts × orcamentoTimeoutSegundos()` e se ajusta sozinho. **Achado:** o orçamento contava 1 chamada de decisão, mas o failover faz até 2 (antes até 4). Como `$timeout` do job = orçamento, o worker podia matar o job no meio do failover. Corrigido (decisão × 2 + espera do lock do contexto): 545s com decisor Gemini; `retry_after` 540 → **650** (config e `.env.example`). Boot loga `GENESIS_QUEUE_RETRY_AFTER_ABAIXO_DO_ORCAMENTO` se o decisor for trocado (OpenAI = 705s) sem subir o `retry_after`
  - [x] 2.7 **[API]** Teste feature: caminho feliz com exatamente 1 chamada por etapa
    - coberto por `test_consumo_de_tokens_por_etapa_no_caminho_feliz` (visão 1, decisão 1) + testes unitários de contexto (1 por bloco) e scan
  - [x] 2.8 Checkpoint: suíte [API] verde
    - **Testes (25/09/2026):** visão (+3: 503→reserva, JSON inválido e 400 sem repetir), failover (reescrito: direto pro reserva), contexto (3 reescritos sem retry), job (+1: visão indisponível encerra sem reexecutar; repairs agora 2)
    - **Achado de teste:** a suíte completa deixava jobs órfãos no sqlite de teste e a rodada isolada seguinte de `GraphicalAnalysisAttemptJobTest` falhava em cascata (os ~10 primeiros testes). O `setUp` agora remove só os órfãos. Verificado semeando 3 órfãos: 16/16

- [x] 3. Fase 3 — Dado indisponível nunca invalida
  - [x] 3.1 **[API]** Auditar `0` vs `null` (`safe(..., 0)`, `?? 0`, casts) em `MarketSnapshotService`, `TechnicalAnalysisService`, `DerivativesReadingService`, `SupplementalIndicatorsService`; uma subtarefa por caso real
    - _Requisitos: 5.1, 5.5_
    - Regra que tornava isso crítico: `EvidenceManifestBuilder` conta `0` como dado real (AVAILABLE) — só `null`/`''`/`[]` viram UNAVAILABLE
    - [x] 3.1.1 `MarketSnapshotService`: cálculo técnico falhando gravava `preco = 0` e `preco_variacao_pct = 0` → decisor recebia "Preço atual: 0". Preço cai para o fechamento real do último candle; variação sem cálculo = `null`
    - [x] 3.1.2 `TechnicalAnalysisService::analisarVolume()`: indisponível devolvia `ratio_atual/vol5/vol20 = 0` com `flow.volume` (DECISION) saindo AVAILABLE → agora `null` (UNAVAILABLE). Único consumidor é o manifesto
    - [x] 3.1.3 `detectarWyckoff()`: sem range, `teto/suporte = 0` em `structure.wyckoff` (DECISION) → `null`. E `classificarFase()` dava `MARKUP` para qualquer preço acima do "teto 0" (fase inventada) → comparação só com range calculado. Latente hoje: exige < 40 candles fechados e o coletor exige ≥ 60
    - Sem caso real: `DerivativesReadingService` (nenhum zero de preenchimento); `SupplementalIndicatorsService` (zeros matemáticos legítimos: multiplicador do CMF com vela sem amplitude, eficiência sem movimento); DM/DI do ADX (zero por definição)
  - [x] 3.2 **[API]** `CanonicalBundleBuilder` publica `availability.unavailable[]` no bundle da decisão
    - _Requisitos: 5.2_
    - `availability.unavailable_evidence_ids` + `availability.nao_citar` (termos). Fonte única: `NarrativeFidelityGate::termosIndisponiveis()`, a mesma regra que o validador aplica (indicador sem evidência AVAILABLE + LTA/LTB/canal/figura/POC/HVN/LVN que a visão não reportou). Fora do `manifest_hash`
  - [x] 3.3 **[API]** `GenesisPrompt`: regra de não citar/estimar itens indisponíveis
    - _Requisitos: 5.2_
  - [x] 3.4 **[API]** `DecisionMechanicalRepair`: remover frases que citam indisponíveis e revalidar (texto curto demais → repair normal)
    - _Requisitos: 5.3_
    - `NARRATIVE_MENTIONS_UNAVAILABLE[_VISUAL]` virou erro mecânico; citações numéricas da frase removida saem junto (e `NUMERIC_CITATION_EVIDENCE_INVALID/LITERAL_NOT_FOUND` são tolerados nesse lote — a revalidação completa decide)
  - [x] 3.5 **[API]** Confirmar que `CANDLES_UNAVAILABLE_OR_INSUFFICIENT` continua sendo o único encerramento por dado
    - _Requisitos: 5.4_
    - confirmado (todo o resto passa por `safe()`). **Achado:** Binance sem candles lançava `CANDLES_UNAVAILABLE` (sem o sufixo), que o job não reconhecia → rodava de novo à toa (o `BinanceService` já tenta 3 vezes) e terminava com o motivo genérico. Agora encerra como `MARKET_CANDLES_UNAVAILABLE` com estorno
  - [x] 3.6 **[API]** Teste feature: indicador forçado a falhar → `COMPLETED`, campo `null`, sem menção no texto
    - `test_indicador_indisponivel_citado_sai_do_texto_e_analise_conclui_sem_repair`: 1 chamada ao decisor, `nao_citar` contém ATR no pedido, texto final sem ATR
  - [x] 3.7 Checkpoint: suíte [API] verde
    - **Testes (25/09/2026):** `DecisionMechanicalRepairTest` (+3), `CanonicalBundleBuilderStage1Test` (+1), `TechnicalAnalysisServiceV65Test` (+2), `GraphicalAnalysisAttemptJobTest` (+1, 17/17 isolado)

- [x] 4. Fase 4 — Menos repair
  - [x] 4.1 **[API]** Fallback de stop já na 1ª tentativa (remover `attempts() > 1`)
    - _Requisitos: 6.1_
    - teste do job agora exige 1 chamada ao decisor e `stop_selection.candidate_id` nulo
  - [x] 4.2 Decisão do Felipe (25/09/2026): número que não bate → remover a frase inteira
  - [x] 4.3 **[API]** `DecisionMechanicalRepair`: remover a frase com número não rastreado/divergente (`UNACCOUNTED_NUMERIC_LITERAL`, `NUMERIC_CITATION_VALUE_MISMATCH`) e revalidar; texto curto demais → repair normal
    - _Requisitos: 6.1_
    - `UNACCOUNTED_NUMERIC_LITERAL` sem evidência que o sustente → frase sai (com evidência: continua ganhando a citação, task 6.5 do Brain V2)
    - `NUMERIC_CITATION_VALUE_MISMATCH`/`_EVIDENCE_INVALID` → frase e citação saem; `_LITERAL_NOT_FOUND` → só a citação sai (o número nem está no texto)
    - Comportamento antigo de 2 testes mudou de propósito: número inventado e número de evidência indisponível não devolvem mais a decisão intacta
  - [x] 4.4 **[API]** Confirmar a cobertura de `MONEY_FORMAT_RAW_NUMBER`/`TEXT_FORBIDDEN` pela correção mecânica
    - _Requisitos: 6.1_
    - `MONEY_FORMAT_*`: confirmado. **`TEXT_FORBIDDEN` NÃO estava coberto** — `PublicVocabularyService` só roda depois da validação, então palavra proibida pagava um repair. Agora `TECHNICAL_/SCORE_TEXT_FORBIDDEN[_SPOT|_CONFIRM_SYNONYM]`, `NON_TECHNICAL_TERM` e `TEXT_FORBIDDEN:{derivatives_summary|plan_a_risk_notes|plan_b_entry_notes}` tiram a frase, com a mesma forma de busca do validador (LONG/SHORT em `technical_analysis` por palavra inteira: "ao longo" fica)
  - [x] 4.5 **[API]** Teste: nenhuma correção mecânica altera direction/score/entrada/stop/alvos
    - _Requisitos: 6.3_
    - `test_correcao_mecanica_nunca_altera_direcao_score_plano_alvos_nem_stop`: todas as correções juntas; só texto livre e `numeric_citations` podem mudar
  - [x] 4.6 **[API]** Medir a taxa de repair antes/depois com `genesis:custo-ia`
    - _Requisitos: 6.4_
    - `genesis:custo-ia` ganhou a taxa de repair (concluídas com chamada `repair` ÷ concluídas, só consumo completo — o legado não guarda: `repair_last_errors` é limpo ao concluir) e, com `--log`, a classificação de cada `decisao_precisa_de_repair` (`DecisionMechanicalRepair::tratavelEmCodigo()`)
    - **Antes (log local, 9 repairs reais das análises 165-173):** 8 de 9 (89%) caem em famílias que o código trata hoje; só `TARGET_SELECTION_TOO_CLOSE_TO_PREVIOUS` continua indo para a IA. Limite: é um teto — em `score_description` (exatamente 2 frases) remover uma frase reprova na revalidação e vai para a IA mesmo assim
    - **Depois:** depende de análises reais novas (sem medição em produção, decisão do Felipe)
    - **Achado:** `genesis:custo-ia --log` estourava a memória (`fgets()` sem limite; o `laravel.log` local tem uma linha de ~250 MB). Leitura agora em pedaços de 64 KB
  - [x] 4.7 Checkpoint: suíte [API] verde

- [x] 5. Fase 5 — Consumidores fora da análise
  - [x] 5.1 **[FE]** + **[API]** Confirmar se `UtilityGeminiProxyController` tem consumidor real; remover a rota ou aplicar rate limit + telemetria
    - _Requisitos: 7.1_
    - Consumidor real: botão de busca por ativo do `components/OpportunityScanner.tsx` (`/v1/gemini-proxy` com google_search). Rota fica; telemetria já existia desde a Fase 0 (`genesis.ia.chamada`, etapa `utility_proxy`)
    - **Achado (afeta toda rota `genesis.auth`):** o limite NUNCA foi por usuário. O `$middlewarePriority` do Kernel põe `ThrottleRequests` antes de `SubstituteBindings` (do grupo `api`), e com isso todo `throttle:*` rodava ANTES do `genesis.auth` — sem usuário, o limite caía no IP. Corrigido: `VerifyGenesisAuthToken implements AuthenticatesRequests` (o marcador que a prioridade usa para rodar autenticação antes do throttle). Vale para `graphical-analysis` (10/min), `scangraph` (20/min), `gemini-proxy` (5/min), `reprice` (60/min) e o limitador `api` (60/min)
    - Efeito colateral a saber: token inválido agora recebe 401 antes de contar no limite do IP
    - Atenção para produção: `TrustProxies::$proxies` é null. Se o CloudPanel entrega a requisição ao PHP por proxy HTTP local, o IP visto era o do proxy e o limite antigo era um balde GLOBAL. Não verificado (sem acesso a produção)
    - `UtilityGeminiProxyLimitTest` (3): limite por usuário com contagem exata do cabeçalho (reprova sem a correção), consumo registrado, sem login não chama o Gemini
  - [x] 5.2 **[API]** Confirmar que `GET /v1/geo-events` só lê do banco
    - _Requisitos: 7.2_
    - confirmado: `GeoEventController::index` → `getUnnotifiedForUser` + `markAsNotified`, só banco. `GeoEventsPollSemIaTest`: 3 polls sem eventos, nenhuma chamada a Gemini/OpenAI
    - Observações: `GeoEventService::getContextoMacroSemanal()` dispara `fetchAndStore()` (Gemini) quando não há eventos, mas não tem nenhum chamador (código morto). O agendamento de `geo:fetch-events` está comentado em `Console/Kernel.php` — o banco de eventos só é preenchido rodando o comando à mão

- [x] 6. Fase 6 — Thinking por etapa
  - [x] 6.1 **[API]** Benchmark HIGH vs MEDIUM (decisão e visão) com `BenchmarkGenesisBrainV2`
    - _Requisitos: 8.1_
    - Comando ganhou `--thinking=`, tokens médios por rodada no relatório e `--vision-runs=N --vision-thinking=` (só visão, compara as leituras)
    - Rodado local em 25/09/2026, com o modelo de produção forçado por env (`GENESIS_GEMINI_DECISION_MODEL=gemini-3.7-flash`, reserva 3.6-flash; o `.env` local está em 3.5-flash). Bundle congelado de 23/09 (BTCUSDT 15m) — o mesmo para os dois níveis. Gemini instável (503/timeouts): várias rodadas caíram no 3.6-flash
    - **Decisão, só no 3.7-flash:** HIGH = SHORT 5 de 6 (score 65-70); MEDIUM = LONG 4 de 4 (score 65). MEDIUM muda a leitura majoritária, não é só ruído. No 3.6-flash os dois deram SHORT
    - **Decisão, tokens por chamada (3.7-flash):** thinking ~12 mil (HIGH) vs ~4,4 mil (MEDIUM); saída ~5 mil nos dois; entrada 172 mil (com o bundle repetido, ~170 mil vieram do cache implícito do Gemini — na 1ª chamada de uma análise real não há cache)
    - **Visão (3.6-flash, 5+5 leituras):** as 10 idênticas (preço 84,525, sem objetos nem padrões — o gráfico não tinha desenho, teste fraco para figuras). Thinking ~1.050 (HIGH) vs ~710 (MEDIUM): economia de ~335 tokens por análise, desprezível
    - Relatórios: `storage/app/benchmarks/fase6-*.log` e `brain-v2-20260925-*/`
    - Baseline HIGH já não passa no critério da Fonte §92 (qualquer flip reprova): 1 flip em 7 aqui, e flips nos benchmarks de 23/09 sobre o mesmo bundle
  - [ ] 6.2 Decisão do Felipe com base no benchmark
    - _Requisitos: 8.2_
    - Recomendação: manter HIGH na decisão (MEDIUM mudou a direção); visão pode ficar em HIGH (economia desprezível, e o teste não tinha figura desenhada)

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
