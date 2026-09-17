# Documento de Requisitos — Gênesis Brain V2

## Introdução

Este spec traduz o documento do cliente `fonte-brain-v2.md` (doravante "Fonte", especificação consolidada para implementação, sem data explícita no próprio documento) em requisitos rastreáveis. A Fonte é vinculante: nenhuma regra legada pode continuar influenciando `direction`, `score`, Plano A, Plano B, stop, TPs ou recomendação operacional sem estar explicitamente aprovada nela. A Fonte também mandata que a reestruturação inteira seja entregue em **uma única publicação de produção** (Fonte §89–90) — este spec preserva essa decisão de produto tal como recebida; ver `design.md` → "Decisões Arquiteturais" para o risco associado e como mitigá-lo sem violar o mandato.

Repositórios:
- **[API]** `E:\Programas\wamp64\www\genesis-api` (Laravel)
- **[FE]** este repositório (`c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main`, React/TypeScript) — confirmado pelo spec irmão `genesis-cerebro-grafico-r3-2` (task 15.3) como o frontend real do projeto.

Auditoria de código real (não só leitura da Fonte) feita em 2026-09-15 contra `genesis-api` e este frontend — resultado completo no `design.md` deste spec, incluindo achados que **divergem** do que a Fonte presume (ex.: exclusão de macro/sentimento do bundle decisório já implementada; `stop_motivo` de fallback já parcialmente rastreado; live-merge do Plano B pode já estar resolvido por um caminho diferente do que a Fonte aponta).

## Regras Invioláveis

Herdadas da Fonte (Seções 1–3, 81, 89, 100):

1. PHP calcula fatos e matemática. A IA interpreta o mercado. Nenhuma camada de PHP recalcula `direction` depois que a IA decidiu (Fonte §1, §3).
2. `NEUTRO` é proibido — a IA sempre retorna `LONG` ou `SHORT` (Fonte §3).
3. `score` é escolha categórica da IA entre 8 valores fechados (55–90, múltiplos de 5) — nunca soma de indicadores (Fonte §4).
4. Nenhum peso fixo por indicador ou família (30/28/28/14 ou qualquer outro esquema) pode decidir `direction` ou `score` (Fonte §2, §13.1, §13.3).
5. `null` nunca vira zero silenciosamente; ausência de indicador secundário não invalida a análise nem reduz o score automaticamente (Fonte §5–8).
6. Nenhuma figura, Fibonacci ou VRVP pode ser inventada, completada ou inferida — só participa se realmente visível e validada geometricamente (Fonte §19–25, §81).
7. Macro, geopolítica, sentimento e Radar News nunca alcançam o bundle decisório nem alteram `direction`/`score` silenciosamente (Fonte §57–59).
8. Alavancagem nunca entra na identidade da análise nem na decisão da IA — só afeta matemática operacional (margem, sizing, liquidação) (Fonte §51, §54).
9. Nenhum código legado pode ser apagado sem substituto provado, consumidores migrados e busca `rg` limpa (Fonte §11, §100).
10. A publicação em produção é única — o código antigo não pode ficar ativo ao lado do V2 influenciando a mesma análise; se preservado para histórico/benchmark/rollback, deve estar isolado do caminho decisório V2 (Fonte §89).

## Glossário

- **Fonte**: `fonte-brain-v2.md`, documento normativo deste spec, reproduzido integralmente no mesmo diretório.
- **Brain V2**: o conjunto de mudanças de contrato de decisão (schema, prompt, validator, drivers, regime) que substitui o score por famílias.
- **DataStatus**: `AVAILABLE | UNAVAILABLE | NOT_PRESENT | NOT_APPLICABLE` — vocabulário canônico de disponibilidade de dado (Fonte §5.5).
- **Drivers**: `primary_drivers` / `secondary_drivers` / `contrary_drivers` — evidências citadas pela IA para explicar a decisão, referenciando `evidence_id` já existente no bundle. Não são votos (Fonte §31).
- **stop_recommended / stop_effective / stop_source**: preço sugerido pela IA, preço efetivamente usado no plano (pode ter sido ajustado pelo membro via slider), e origem (`AI_RECOMMENDED` | `USER_ADJUSTED` | `SYSTEM_FALLBACK`) (Fonte §36, §80).
- **execution_state**: estado operacional do plano, independente de `direction` (`READY`, `WAIT_TRIGGER`, `BLOCKED_NO_VALID_STOP`, etc.) (Fonte §87).
- **brain_version / prompt_version / schema_version / bundle_hash**: metadados de proveniência persistidos em toda análise, obrigatórios para outcomes e auditoria (Fonte §88).
- **Release Gate**: checklist único de 21 itens (Fonte §90.11) que precisa estar 100% aprovado antes do deploy da publicação única.

## Requisitos

### Requisito 1: Contrato fechado do score V2 (enum 55–90, sem cast destrutivo)

**User Story:** Como responsável de produto, eu quero que o score publicado seja sempre um dos 8 valores fechados (55, 60, 65, 70, 75, 80, 85, 90) e que `null` nunca vire zero, para que a força direcional nunca seja fabricada ou perdida por um cast do PHP.

**Nota (Auditoria 2026-09-15):** confirmado em código real — `AnalysisPersistenceService.php:150` e `:226` fazem `(int) $decision['score']`, exatamente como a Fonte descreve (§7). `GenesisDecisionSchema.php` hoje declara `score_familias` como campo obrigatório (linhas 62 e 95), não o enum fechado de 8 valores.

#### Critérios de Aceitação

1. THE Sistema SHALL define `GenesisDecisionSchema::GENESIS_V2_VALID_SCORES = [55, 60, 65, 70, 75, 80, 85, 90]` and expose it as the single source of truth for score validation (Fonte §4.2).
2. WHEN `$decision['score']` is not an integer present in `GENESIS_V2_VALID_SCORES`, THE Sistema SHALL throw a repairable semantic exception (`GENESIS_V2_INVALID_SCORE`) that triggers a structured-output repair using the same already-validated bundle, never a transport retry (Fonte §4.2, §65).
3. THE AnalysisPersistenceService SHALL NOT cast `$decision['score']` with `(int)`/`(float)` before validation; THE Sistema SHALL validate the score as a closed-enum integer first, then persist it unmodified.
4. WHEN `$decision['score']` is `null` at persistence time, THE Sistema SHALL throw rather than silently persist `0`.
5. THE Sistema SHALL reject `50`, `0`, `100`, and any value not a multiple of 5 within [55,90] with the same `GENESIS_V2_INVALID_SCORE` semantic error (Fonte §4.2, §4.3).
6. THE frontend score bar SHALL render the backend value verbatim on a 0–100 scale, WITHOUT normalizing `90` to `100` (Fonte §4.4).

### Requisito 2: Direção imutável após a decisão da IA

**User Story:** Como responsável de produto, eu quero que nenhuma camada de score, RR, stop, alavancagem, target, macro ou family weighting inverta `direction` depois que a IA decidiu, para que um RR ruim possa bloquear execução mas nunca transformar um LONG em SHORT.

#### Critérios de Aceitação

1. THE Sistema SHALL treat `direction` as immutable once validated as `LONG` or `SHORT`; no downstream service (RR calculation, leverage, target eligibility, stop validation, macro/sentiment context) SHALL write to the persisted `direction` field.
2. WHEN RR/stop/target checks fail after a valid `direction`, THE Sistema SHALL set `execution_state` to a `BLOCKED_*` value (Requisito 21) WITHOUT altering `direction` or `score`.
3. THE Sistema SHALL have a passing property test proving that for any valid `family_scores`/`drivers` combination, no downstream computation flips `direction` (mirrors the already-existing pattern in `DerivativesDirectionIsolationTest` from the sibling spec `genesis-cerebro-grafico-r3-2`, adapted to the V2 contract).

### Requisito 3: Semântica canônica de zero, null, ausência e não aplicável

**User Story:** Como desenvolvedor, eu quero um vocabulário único de disponibilidade de dado (`AVAILABLE`/`UNAVAILABLE`/`NOT_PRESENT`/`NOT_APPLICABLE`) usado em todo o pipeline, para que zero legítimo, dado indisponível e "não existe neste contexto" nunca sejam confundidos.

#### Critérios de Aceitação

1. THE Sistema SHALL create a `DataStatus` PHP enum/const set (`AVAILABLE|UNAVAILABLE|NOT_PRESENT|NOT_APPLICABLE`) and an equivalent TypeScript `DataStatus` union (Fonte §5.5, §86), reused by every V2 evidence field.
2. WHEN a source genuinely returns `0` (funding, OI delta, MACD histogram, CMF, return), THE Sistema SHALL persist `status=AVAILABLE, value=0`, never coercing it to `UNAVAILABLE` or dropping it.
3. WHEN a source could not be obtained or computed, THE Sistema SHALL persist `status=UNAVAILABLE, value=null`, and SHALL NOT cast that `null` to `0` anywhere in the decision or persistence path (Fonte §5.2, §7).
4. THE Sistema SHALL audit and correct every destructive coercion on strategic fields: `(int)`/`(float)` casts, `empty()`, `?:` fallbacks in PHP; `!value`, `value || fallback`, `Number(null)` in TypeScript — replacing them with explicit `=== null`/`!== null` or `status` checks (Fonte §6).
5. THE Sistema SHALL have passing tests proving: zero funding stays zero, null funding stays null, missing OI does not invalidate the analysis, and a missing secondary indicator never appears in the public narrative (Fonte §91 "Dados ausentes").

### Requisito 4: Legacy Dependency Audit e classificação de todo componente legado

**User Story:** Como responsável de produto, eu quero uma tabela completa de todo componente que hoje toca `direction`/`score`/Plano A/Plano B/stop/target/RR, classificado como `KEEP`/`REPLACE`/`REMOVE_FROM_DECISION_PATH`/`DELETE_AFTER_REPLACEMENT_VERIFIED`, para que nenhuma remoção aconteça sem substituto provado.

#### Critérios de Aceitação

1. THE Sistema SHALL produce and maintain the Legacy Dependency Audit table (Fonte §10) before any removal, covering at minimum: `ScoreFromFamilies`, `score_familias`, legacy `score_breakdown`, the 30/28/28/14 weights, `ScoreNarrativeBuilder`, `DirectionCoherenceGate`, `RegimeService`, `DerivativesReadingService`, `TargetCandidateCatalog::strength`.
2. FOR EACH component classified `DELETE_AFTER_REPLACEMENT_VERIFIED`, THE Sistema SHALL NOT delete the file until: the replacement is implemented, tested, all consumers are migrated, a full analysis runs with the legacy mechanism disabled without changing `direction`/`score`/plans/math, and a follow-up `rg` search shows zero live references (Fonte §11).
3. THE Sistema SHALL record, per removal, the six fields required by Fonte §100 (`LEGADO`/`SUBSTITUTO`/`CONSUMIDORES MIGRADOS`/`TESTE QUE PROVA SUBSTITUIÇÃO`/`BUSCA RG SEM REFERÊNCIA VIVA`/`DATA DA REMOÇÃO`).
4. THE Sistema SHALL NOT read any legacy field not declared in the official V2 input contract; any field kept only for history/shadow mode SHALL be renamed with an explicit `legacy_` prefix (e.g. `legacy_direction`, `legacy_score`), never reusing `score`/`direction` for two different meanings (Fonte §12).

### Requisito 5: Remover `ScoreFromFamilies` e os pesos 30/28/28/14 do caminho decisório

**User Story:** Como responsável de produto, eu quero que o score deixe de ser calculado por soma de famílias ponderadas, para que a convicção publicada venha exclusivamente do julgamento holístico da IA.

**Nota (Auditoria 2026-09-15):** confirmado em código real — `ScoreFromFamilies.php:24-27` tem exatamente `'estrutura' => 30, 'order_flow' => 28, 'derivativos' => 28, 'momentum' => 14`. `GraphicalAnalysisAttemptJob.php:450` chama `$scoreFromFamilies->calcular((array) ($decision['score_familias'] ?? []))` diretamente no job de decisão — este é o ponto de injeção real a remover.

#### Critérios de Aceitação

1. THE `GraphicalAnalysisAttemptJob` SHALL NOT call `ScoreFromFamilies::calcular()` in the V2 decision path; `$decision['score']` SHALL be read and validated directly per Requisito 1.
2. THE Sistema SHALL remove `score_familias` from `GenesisDecisionSchema`'s required V2 fields, replacing it with `score`, `primary_drivers`, `secondary_drivers`, `contrary_drivers`, `regime`, `movement_character`, `score_description` (Fonte §13.2, §30).
3. THE `GenesisPrompt.php` SHALL NOT instruct the model with `Estrutura peso 30 / Order Flow peso 28 / Derivativos peso 28 / Momentum peso 14`, nor any rule forcing the four families to be treated as a numeric vote (Fonte §13.3).
4. WHILE the legacy mechanism is temporarily needed for benchmark comparison (Requisito 26), THE `ScoreFromFamilies` class MAY be invoked from an explicit, isolated comparison routine outside the live decision path, but SHALL NEVER feed `$decision['score']` in that path.
5. THE Sistema SHALL have a passing `rg -n "ScoreFromFamilies|score_familias|score_breakdown"` audit showing zero occurrences inside the live V2 decision call graph (only legacy/comparison/test references remain) (Fonte §94).

### Requisito 6: Rebaixar `DirectionCoherenceGate` e `RegimeService` a telemetria

**User Story:** Como desenvolvedor, eu quero que os gates deterministas de coerência e regime parem de poder alterar `direction`/`score`, para que só sirvam como auditoria e não como um segundo cérebro paralelo à IA.

**Nota (Auditoria 2026-09-15):** ambas as classes existem — `app/Services/GraphicalAnalysis/DirectionCoherenceGate.php` e `app/Services/RegimeService.php`. Comportamento atual (se altera ou não `direction`/`score` hoje) não foi confirmado nesta auditoria — requer leitura completa dos dois arquivos no início da implementação, antes de decidir se a mudança é "remover escrita" ou "já é só leitura".

#### Critérios de Aceitação

1. THE Sistema SHALL confirm, by reading the current implementation, whether `DirectionCoherenceGate` and `RegimeService` currently write to `direction`/`score`/`regime` in the live path; IF they do, THEN THE Sistema SHALL remove that write capability before Requisito 5 is considered complete.
2. THE `RegimeService` MAY continue producing a `regime_candidate` for telemetry/audit, but SHALL NOT decide the final `regime` field (which comes from the IA's `regime`/`movement_character` response) nor veto `direction` (Fonte §13.6).
3. THE `DirectionCoherenceGate` MAY remain only as audit/telemetry/inconsistency-detection; IF no useful consumer remains after migration, THEN THE Sistema SHALL delete it following Requisito 4.2 (Fonte §13.5).

### Requisito 7: Arquitetura de bundle FACTS/DERIVED_FEATURES/VISION/AVAILABILITY e features preditivas

**User Story:** Como desenvolvedor, eu quero um `PredictiveFeatureService` puro que calcule evolução temporal (slope, aceleração, compressão) dos indicadores já existentes, para que o Brain V2 seja mais preditivo sem adicionar dezenas de indicadores novos.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/GraphicalAnalysis/PredictiveFeatureService.php` as a pure transformation service (no HTTP, no LONG/SHORT judgment) computing `ema_dynamics`, `dmi_dynamics`, `macd_dynamics`, `atr_dynamics`, `cvd_dynamics`, `oi_dynamics`, `funding_dynamics` per Fonte §17 contract shape.
2. THE Sistema SHALL organize every bundle field under one of four conceptual groups — `FACTS` (observed data), `DERIVED_FEATURES` (objective math), `VISION` (only what the visual IA identified), `AVAILABILITY` (per-source status) — per Fonte §14.
3. THE `EvidenceCatalog.php` SHALL add IDs for the new predictive features (`trend.ema_dynamics`, `momentum.dmi_dynamics`, `momentum.macd_dynamics`, `volatility.atr_dynamics`, `flow.cvd_dynamics`, `flow.trade_flow`, `derivatives.oi_dynamics`, `derivatives.funding_dynamics`, `multi_timeframe.context`) without creating unnecessary extra IDs (Fonte §84 EvidenceCatalog).
4. THE frontend SHALL NOT render any card for slope/acceleration/z-score/individual predictive feature values — these remain backend/audit-only (Fonte §60, §96).
5. THE Sistema SHALL integrate `TradeFlowService` into the V2 bundle for `15m` (full) and `1h` (controlled windows), mark `1d`/`1w` as `NOT_APPLICABLE`, and persist `coverage_start_ms`/`coverage_end_ms`/`requested_window_seconds`/`truncated` metadata, never presenting truncated coverage as complete (Fonte §16.14).

### Requisito 8: Frescor por fonte (TTL configurável, `observed_at` real)

**User Story:** Como responsável de produto, eu quero um TTL de cache configurável por tipo de fonte, para que microdados (preço, order book, OI) não fiquem velhos sob a mesma política de 300 segundos usada para dados mais estáveis.

**Nota (Auditoria 2026-09-15):** confirmado em código real — `config/binance.php:9` tem uma única chave global `'cache_ttl' => env('BINANCE_CACHE_TTL', 300)`, exatamente o bug descrito na Fonte §18.1.

#### Critérios de Aceitação

1. THE Sistema SHALL replace the single global `cache_ttl` in `config/binance.php` with a per-source array (`price`, `order_book`, `open_interest_current`, `funding_current`, `funding_history`, `exchange_info`, `leverage_brackets`), each independently configurable via environment variable (Fonte §18.2).
2. THE `BinanceService` SHALL persist `source_observed_at`, `cache_stored_at`, and `cache_age_seconds` per fetched value, and SHALL NOT rewrite `observed_at` to `now()` merely because a value was served from cache (Fonte §18.3).
3. THE Sistema SHALL distinguish closed-candle indicators from live price/partial-candle state, exposing `last_closed_candle_at`, `live_price_observed_at`, and `current_candle_state` (Fonte §18.4).

### Requisito 9: Vision anti-alucinação (figuras, LTA/LTB, Fibonacci, VRVP só quando visíveis)

**User Story:** Como trader, eu quero que figuras, linhas de tendência, Fibonacci e VRVP só participem da análise quando realmente visíveis e geometricamente validados, para que nenhum elemento visual seja inventado, completado ou inferido pelo comportamento de preço.

#### Critérios de Aceitação

1. THE Sistema SHALL NOT allow the visual IA to complete a partial figure, infer a figure from price behavior alone, or cite a figure absent from `bundle.vision`; an ambiguous or incomplete figure SHALL be omitted (`patterns: []`), not degraded to participate anyway (Fonte §19–20).
2. THE Sistema SHALL require at least two anchored points for any LTA/LTB/channel; without sufficient geometry, THE Sistema SHALL omit it (Fonte §21).
3. Fibonacci SHALL only enter the bundle when visually drawn on the chart; THE Sistema SHALL NOT calculate, estimate, or auto-select a swing to synthesize a Fibonacci level (Fonte §22).
4. VRVP/POC/HVN/LVN SHALL only enter as visual information when the profile is genuinely visible; THE Sistema SHALL NOT synthesize a calculated volume profile and present it as visual reading — a future calculated volume profile MUST use a distinct namespace (`calculated.volume_profile` vs `visual.vrvp`) (Fonte §23).
5. THE Sistema SHALL keep `visual.support_resistance` (IA-drawn lines/zones) and `structure.calculated_levels` (backend-computed pivots/PDH/PDL) as distinct concepts; narrative text SHALL NOT call a calculated level "a line drawn on the chart" (Fonte §24).
6. WHEN the narrative mentions a visual element absent from `bundle.vision` (e.g., `patterns: []` but text says "the descending triangle..."), THE Sistema SHALL repair or remove only that phrase/field, log the error, and keep `direction`/`score`/plan valid — SHALL NOT invalidate the whole analysis (Fonte §25, §68).

### Requisito 10: Multi-timeframe como contexto único, sem veto

**User Story:** Como trader, eu quero que o timeframe superior entre só como contexto de um único HTF mapeado, para que ele nunca vete ou pese sobre um setup tático válido no timeframe atual.

**Nota (Auditoria 2026-09-15):** `MultiTimeframeSnapshotService.php` existe; o comportamento atual (quantos HTF são consultados, se algum vira veto) não foi confirmado nesta auditoria — ler o arquivo completo antes de iniciar esta fase.

#### Critérios de Aceitação

1. THE `MultiTimeframeSnapshotService` SHALL map each timeframe to exactly one higher timeframe (`5m→15m`, `15m→1h`, `1h→4h`, `4h→1d`, `1d→1w`, `1w→none`), removing any automatic query to two higher timeframes per analysis (Fonte §26).
2. THE HTF context SHALL NOT act as a weight or veto capable of blocking a valid current-timeframe setup; a countertrend setup against the HTF (e.g., `1h: BEARISH`, `15m: LONG`) SHALL be a valid, labelable outcome (`movement_character: COUNTERTREND_REBOUND`), not a contradiction to suppress (Fonte §26).
3. THE Sistema SHALL have a passing test proving a LONG tactical setup survives a bearish HTF context without direction being auto-reversed.

### Requisito 11: Contrato de decisão V2 (schema, prompt, validator)

**User Story:** Como desenvolvedor, eu quero o schema JSON, o prompt e o validator de resposta alinhados ao contrato V2 (direction/score/regime/movement_character/drivers/stop_selection/target_ranking/plan_b), para que a IA nunca seja solicitada a devolver `score_familias` nem seja avaliada contra os critérios das quatro famílias antigas.

#### Critérios de Aceitação

1. THE `GenesisDecisionSchema` SHALL require `direction` (enum `LONG|SHORT`), `score` (enum de 8 valores, Requisito 1), `regime`, `movement_character`, `primary_drivers`, `secondary_drivers`, `contrary_drivers`, `score_description`, `technical_analysis`, `stop_selection.candidate_id`, `target_ranking` (list of candidate IDs), and `plan_b` per the contract in Fonte §29.
2. THE `DecisionResponseValidator` SHALL NOT validate the four legacy families as a V2 requirement; IT SHALL instead validate: `direction` is `LONG`/`SHORT`, `score` is in the closed enum, every `evidence_id` in drivers exists in `EvidenceCatalog`, the stop candidate exists, every ID in `target_ranking` exists and has no duplicates, and any visual element mentioned in text exists in structured `bundle.vision` (Fonte §84 DecisionResponseValidator).
3. THE `GenesisPrompt` SHALL instruct: discrete score 55–90 with holistic judgment (no arithmetic); focus on transitions/acceleration; correlated signals SHALL NOT be counted as independent votes (Fonte §32); derivatives MAY participate in direction only combined with price/structure/flow, never alone (Fonte §16.13); MTF is context without veto; a figure/Fibo only exists if present in the structured bundle; missing data is simply absent (not zero, not penalized); direction is always `LONG`/`SHORT`.
4. THE Sistema SHALL reduce free-form numeric literals from the LLM: WHEN a number is traceable to a known fact, THE IA SHALL return an `evidence_id` and THE backend SHALL format the already-known number, reducing `UNACCOUNTED_NUMERIC_LITERAL`/`MONEY_FORMAT_RAW_NUMBER`/`NUMERIC_CITATION_LITERAL_NOT_FOUND` errors (Fonte §82).

### Requisito 12: Stop V2 — recomendado, efetivo, ajustável, com fallback auditado e transparente

**User Story:** Como membro, eu quero sempre receber um stop técnico recomendado inicial que eu possa ajustar manualmente, e saber quando o stop veio de um fallback do sistema em vez da IA, para confiar na referência de risco mesmo quando a IA falha em escolher um candidato.

**Nota (Auditoria 2026-09-15):** achado que diverge da Fonte — `StopSelectionValidator.php` já trata `candidate_id === null` como "resposta válida por definição" (comentário no código cita "item 10 (ponto 7)"), e `NivelService.php:82,235` já tem `MENSAGEM_STOP_FALLBACK_ESTRUTURAL` e persiste `stop_motivo` explicitamente quando `$ancoraEscolhidaPelaIa` é falso — ou seja, parte do mecanismo de "fallback estrutural rastreável" que a Fonte pede em §34-35 (item 3-5) **já existe hoje**, com nomenclatura diferente (`stop_motivo` em vez de `stop_source`). Este requisito é mais de reconciliação/rename do que de construção do zero — confirmar isso antes de assumir retrabalho maior.

#### Critérios de Aceitação

1. BEFORE removing any existing stop fallback behavior, THE Sistema SHALL measure, from current logs, the percentage of analyses with `stop_selection.candidate_id = null`, broken down by asset/timeframe/provider/direction/period (Fonte §34, §90.1).
2. THE Sistema SHALL persist `stop_recommended`, `stop_effective` (initialized equal to `stop_recommended`), and `stop_source` (`AI_RECOMMENDED|USER_ADJUSTED|SYSTEM_FALLBACK`) per plan; THE Sistema SHALL reconcile this with the already-existing `stop_motivo`/`MENSAGEM_STOP_FALLBACK_ESTRUTURAL` mechanism in `NivelService` rather than building a parallel one (Fonte §36).
3. WHEN the IA fails to select a stop candidate, THE Sistema SHALL attempt one semantic repair with the same bundle; IF that also fails, THEN THE Sistema MAY use an explicitly audited, technically defensible V2 fallback, marking `stop_source=SYSTEM_FALLBACK` and never hiding that the stop did not come from the IA's original choice (Fonte §34).
4. WHEN no technically defensible stop can be obtained from either the IA or the audited V2 fallback, THE Sistema SHALL allow the analysis to exist but SHALL set `execution_state=BLOCKED_NO_VALID_STOP`, and SHALL NOT fabricate an arbitrary price (Fonte §34, §35).
5. THE frontend SHALL replace `Number.isFinite(Number(planoAtivo.stop))`-style checks (which treat `Number(null)===0` as valid) with an explicit `hasValidNumber()` guard that rejects `null`/`undefined`, and SHALL validate side correctness (`LONG → stop < entrada`, `SHORT → stop > entrada`) (Fonte §35).
6. THE Sistema SHALL implement a draggable stop slider whose initial position is `stop_recommended`, updates `stop_effective` in real time via local preview (Requisito 13), and marks the AI-recommended price visually as "STOP GÊNESIS" (Fonte §36, §36.2).
7. THE risk ruler SHALL be bidirectional (`TOO_CLOSE_NOISE → CAUTION_CLOSE → TECHNICAL_ZONE → CAUTION_WIDE → TOO_WIDE_LIQUIDATION_RISK`), using `stop_distance_atr` for the close side (configurable `noise_red_below_atr`/`noise_yellow_below_atr`, e.g. 0.50/0.80) and real liquidation-bracket distance for the far side — never estimated maintenance margin (Fonte §36.1–36.5).
8. THE slider SHALL reject mathematically invalid positions (`LONG: liquidation_price < stop_effective < entry`; `SHORT: entry < stop_effective < liquidation_price`); WHEN liquidation is `UNAVAILABLE`, THE Sistema SHALL still allow RR/risk preview but SHALL NOT fake a green/red liquidation zone with estimated data (Fonte §36.6).
9. Moving the stop SHALL NOT call the Trader AI, SHALL NOT change `direction`/`score`, and SHALL NOT re-run the technical analysis — only the operational plan configuration changes (Fonte §36.7).

### Requisito 13: Endpoint de repricing determinístico

**User Story:** Como membro, eu quero que mover o slider de stop ou trocar alavancagem recalcule RR/margem/liquidação instantaneamente sem chamar a IA, para que o ajuste operacional seja fluido e barato.

#### Critérios de Aceitação

1. THE Sistema SHALL implement `POST /api/v1/analises/{uuid}/reprice` accepting `plan`, `leverage`, `equity`, `stop_effective`, and returning `stop_recommended`/`stop_effective`/`stop_source`/`stop_risk`/`rr`/`risk`/`position`/`liquidation` per the shape in Fonte §39.
2. THE `/reprice` endpoint SHALL NOT invoke any `DecisionProvider` (Gemini/OpenAI); it SHALL be pure deterministic math over already-persisted candidates and facts.
3. THE frontend SHALL compute a local preview during `onChange` using the same pure formula the backend uses (shared/tested where possible), and SHALL call `/reprice` on `onChangeEnd` or a short debounce, treating the backend response as the final source of truth (Fonte §38).
4. Recalculation on stop/entry change SHALL update RR1/RR2/RR3, entry-stop distance, and risk percentage always; quantity/notional/margin/liquidation/money-risk only when sizing is risk-based; fixed-position sizing SHALL NOT be artificially altered when it does not mathematically depend on the stop (Fonte §37).

### Requisito 14: Plano A e Plano B independentes, com estado vivo unificado

**User Story:** Como membro, eu quero que o Plano B tenha sua própria entrada/stop/targets/RR e que o estado de acionamento chegue atualizado na tela, para que eu não veja um plano congelado no snapshot da análise original.

**Nota (Auditoria 2026-09-15):** achado que diverge da Fonte — a classe que a Fonte aponta como responsável pelo merge (`AnalysisPublicResponseBuilder::evidenceValue($analysis, 'pipeline.execution')`) não foi localizada com esse padrão de código no `genesis-api` atual. Em vez disso, `AnaliseTransformer.php:18-34` monta `'planos' => $item->planos->map(...)` diretamente a partir do relacionamento Eloquent `planos` (que aponta para `genesis_analise_planos`, confirmado pela existência de `AnalisePlano.php`), incluindo `status_acionamento` — isso pode já ser a leitura ao vivo que a Fonte pede, não um snapshot congelado. Ao mesmo tempo, o frontend ainda referencia `planoB` em 7 arquivos (`services/geminiService.ts`, `types.ts`, `types/graphicalAnalysis.ts`, `components/AnalysisResult.tsx`, `components/AnalysisHistoryDashboard.tsx`, e 2 arquivos de teste) — uma superfície de migração maior do que a Fonte presume ao falar só de "duas fontes" (`execution.planoB` vs `execution.planos[]`). **Este requisito começa com uma investigação, não com a suposição de que o bug existe como descrito.**

#### Critérios de Aceitação

1. BEFORE implementing any merge logic, THE Sistema SHALL confirm which class is the actual live path for the public `planos`/Plano B response today — `AnaliseTransformer`, `AnalysisPublicResponseBuilder`, both, or neither — and SHALL document the finding before writing any fix.
2. IF a frozen-snapshot bug is confirmed (the public response does not reflect live `genesis_analise_planos` state), THEN THE Sistema SHALL make the live state (`trigger.estado`, `triggered_at`, `status_acionamento`, current outcomes) win over the immutable original snapshot's plan configuration, without overwriting the historical snapshot itself (Fonte §41).
3. THE Sistema SHALL converge the public contract onto a single source, `execution.planos[]`; THE Sistema SHALL migrate all 7 frontend consumers currently reading a separate `planoB`/`execution.planoB` shape before removing it, confirming zero remaining consumers via grep (Fonte §42).
4. Plano A and Plano B SHALL each carry independent entry/stop_recommended/stop_effective/TPs/RR-per-TP/sizing/margin/liquidation/trigger/execution_state; WHEN entry B differs from entry A, THE Sistema SHALL recalculate every dependent field for B — TP or stop MAY coincide between A and B only when the same real structure justifies it, never by convenience copy (Fonte §40).
5. THE Sistema SHALL implement a state machine per trigger type — `ROMPIMENTO` (closed candle beyond level + correct direction + configurable buffer), `RETESTE` (confirmed break → return to region → zone test → direction-consistent hold/reject), `RETORNO_A_ZONA` (entry into defined zone + confirmation condition + persisted state) — such that a wick touch alone SHALL NOT satisfy any of the three (Fonte §43).
6. THE Sistema SHALL always save and track both Plano A and Plano B outcomes, regardless of which plan (if any) the member chose to enter (Fonte §73).

### Requisito 15: Targets reais, elegibilidade por RR, sem obrigar três

**User Story:** Como trader, eu quero que os alvos publicados venham de um ranking real de candidatos, filtrado deterministicamente por RR mínimo e espaçamento, para que o sistema nunca invente um alvo nem exija exatamente três.

**Nota (Auditoria 2026-09-15):** confirmado em código real — `TargetCandidateCatalog.php:142,198` calcula `'strength' => $this->forca($grupo)` e usa esse valor como filtro (`if (($candidato['strength'] ?? 0.0) > 0.15)`), confirmando que `strength` hoje participa ativamente do caminho de decisão, exatamente o problema descrito na Fonte §13.8.

#### Critérios de Aceitação

1. THE IA response SHALL return `target_ranking` with up to 6 real candidate IDs (not just 3); AFTER stop/entry are known, THE Sistema SHALL deterministically select up to 3 eligible targets from that ranking via a new `TargetEligibilityService`, applying: correct side, real candidate, `RR_target >= config('genesis.rr_minimo', 1.5)`, and minimum ATR spacing (Fonte §45–48).
2. THE `TargetCandidateCatalog` SHALL stop using `strength` as a decision-path filter; `strength` MAY remain for legacy telemetry but SHALL NOT gate which candidates reach the V2 eligibility check (Fonte §13.8).
3. THE Sistema SHALL keep `target_candidates_all` (every real barrier, including ineligible ones) separate from `target_candidates_tp_eligible` (published set); a real barrier below RR minimum (e.g. `0.14R`) SHALL remain visible in context with `tp_eligible=false`, never deleted (Fonte §45–46).
4. THE public API SHALL publish between 0 and 3 TPs according to real eligible levels, never requiring exactly 3 (Fonte §44).
5. THE `TargetSelectionValidator` SHALL become a final assert (contract compliance of the published result) rather than a generator requiring an exact expected count; WHEN `TARGET_SELECTION_TOO_CLOSE_TO_PREVIOUS` occurs after the new deterministic selector is live, THE Sistema SHALL treat it as an internal bug, not a normal repair reason (Fonte §47, §49).

### Requisito 16: RR determinístico, individual por TP, sem RR combinado

**User Story:** Como desenvolvedor, eu quero RR1/RR2/RR3 calculados individual e deterministicamente pelo backend, para que nenhum conceito de RR combinado sobreviva no caminho vivo e a IA nunca precise adivinhar o número.

#### Critérios de Aceitação

1. THE Sistema SHALL compute RR1/RR2/RR3 individually and deterministically in PHP; THE Sistema SHALL remove any remaining "combined RR" concept from the live execution path (`ExecucaoService`/`ExecutionPipelineService`) if still present (Fonte §50, §84 ExecucaoService).
2. THE Sistema SHALL recalculate RR whenever entry or stop changes; RR calculation SHALL NEVER write to `direction`.

### Requisito 17: Alavancagem fora da identidade do Brain e da decisão

**User Story:** Como membro, eu quero trocar a alavancagem sem disparar uma nova análise de IA, para que ajustar risco operacional seja instantâneo e barato.

**Nota (Auditoria 2026-09-15):** confirmado em código real — `services/analysisIdempotency.ts:29` tem `[s.symbol, s.timeframe, String(s.alavancagem), s.imagemHash].join('|')`, exatamente o bug descrito na Fonte §54: alavancagem está na assinatura de idempotência.

#### Critérios de Aceitação

1. THE `analysisIdempotency.ts` SHALL remove `alavancagem` from the identity hash; the V2 identity SHALL be `[symbol, timeframe, imageHash, canonicalMarketHash?]`, confirmed server-side as the final decisive hash (Fonte §54, §85).
2. THE Sistema SHALL separate `analysis_identity_hash` (bundle + image + symbol + timeframe + prompt/schema/model) from `execution_parameters_hash` (includes leverage); changing leverage SHALL only invalidate the latter.
3. THE Sistema SHALL validate every selected leverage against real `leverageBracket` metadata per symbol from `BinanceService::getLeverageBrackets()`; THE frontend SHALL only offer leverage options compatible with the selected contract, and THE backend SHALL re-validate regardless of what the frontend sent (Fonte §52).

### Requisito 18: Liquidação com bracket real, sem fallback estimado em produção

**User Story:** Como membro, eu quero que o preço de liquidação venha do bracket real da Binance, para que a régua de risco e o cálculo de margem nunca usem uma manutenção de margem estimada e potencialmente errada.

**Nota (Auditoria 2026-09-15):** confirmado em código real — `LiquidationCalculatorService.php` contém `MM_TIER1_FALLBACK`/`MATH_ESTIMATE_TIER1`, exatamente como a Fonte descreve em §53.

#### Critérios de Aceitação

1. THE Sistema SHALL confirm `GENESIS_BINANCE_API_KEY`/`GENESIS_BINANCE_API_SECRET` are configured and `getLeverageBrackets()` works in production for the symbols in use, BEFORE removing any fallback (Fonte §53 steps 1–3).
2. THE Sistema SHALL use the real `maintMarginRatio` from the bracket by notional for liquidation math; THE Sistema SHALL remove `MM_TIER1_FALLBACK`/`MM_TIER1_FALLBACK_PADRAO`/`MATH_ESTIMATE_TIER1` from the live operational route only after the real-bracket path is confirmed working for the contracts in use.
3. WHEN a real bracket cannot be obtained, THE Sistema SHALL set `liquidation.status=UNAVAILABLE`, log it, and SHALL NOT fabricate an estimated maintenance margin value (Fonte §53).

### Requisito 19: Timeframes canônicos unificados (backend, frontend, MTF, outcomes)

**User Story:** Como desenvolvedor, eu quero uma única fonte de verdade para os timeframes suportados, para que `3h` pare de ser aceito pelo request validator sem ser suportado pela coleta real da Binance.

**Nota (Auditoria 2026-09-15):** confirmado em código real, e pior do que a Fonte descreve — `config/genesis_graphical_v6.php:152` tem `allowed_timeframes = ['1m','3m','5m','15m','30m','1h','2h','3h','4h','6h','8h','12h','1d','3d','1w','1M']` (16 valores), enquanto `BinanceService::INTERVALOS_BINANCE` (linhas 11-15) tem `['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M']` (15 valores, sem `3h`). O gap não é só `3h` — o conjunto canônico proposto pela Fonte (`5m,15m,1h,4h,1d,1w`, 6 valores) é uma redução bem maior do que os 15-16 valores aceitos hoje.

#### Critérios de Aceitação

1. THE Sistema SHALL create `GenesisSupportedTimeframes::ALL = ['5m','15m','1h','4h','1d','1w']` as the single canonical authority, replacing the current 15–16-value `allowed_timeframes`/`INTERVALOS_BINANCE` overlap (Fonte §56).
2. THE Sistema SHALL use this single authority in: request validator, `BinanceService`, MTF mapping (Requisito 10), outcomes evaluation, frontend timeframe selector (via endpoint/config), expiration logic, and telemetry.
3. THE Sistema SHALL reject `3h` (and every other now-unsupported value) before fetching candles, with a clear validation error, not a silent Binance API failure.
4. THE Sistema SHALL have passing tests confirming each of the 6 canonical timeframes works end-to-end, and that `3h` is rejected pre-fetch.

### Requisito 20: Macro/sentimento fora do bundle decisório (manter invariante já existente)

**User Story:** Como responsável de produto, eu quero uma garantia testada de que macro, geopolítica e sentimento nunca chegam ao decisor, para que o cérebro técnico nunca seja influenciado silenciosamente por contexto externo.

**Nota (Auditoria 2026-09-15):** achado que diverge da Fonte de um jeito favorável — `CanonicalBundleBuilder.php` já tem `unset($decisionManifest['context'])` (linha 314) e `unset($bundle['context'])` dentro de `forStage1()` (linha 351). A Fonte §57 afirma isso ("A versão auditada já remove `context` no pacote efetivamente enviado ao decisor") e a auditoria confirma que é verdade hoje. Este requisito é, portanto, majoritariamente sobre **manter e testar formalmente** a invariante existente, não construí-la — mas note que o mesmo arquivo (linhas 93-118) também grava `snapshot['macro']['score']`/`sentiment['score']`/`gatilhos_*` num `$snapshot` que alimenta o manifesto de evidências consumido por `EvidenceCatalog`/narrativa pública — confirmar durante a implementação que esse `$snapshot` de evidências é estritamente pós-`unset()` e nunca reintroduz o contexto pelo caminho do manifesto.

#### Critérios de Aceitação

1. THE `CanonicalBundleBuilder::forStage1()` (or whichever method assembles the payload actually sent to `DecisionProvider::decide()`) SHALL continue to `unset()` the `context` key before the AI call; THE Sistema SHALL add a regression test asserting the payload sent to `GeminiDecisionClient`/`OpenAiDecisionClient` never contains a `context`/`macro`/`sentiment`/`sentimento` key (Fonte §57, §91 "Macro").
2. THE Sistema SHALL confirm the evidence manifest built from `$snapshot['macro']`/`$snapshot['sentiment']` (used for the public narrative/context cards) is derived strictly from data already excluded from the decision call, and never leaks back into it.
3. THE frontend SHALL keep macro/geopolitical/sentiment cards below the technical result, with the existing pre-confirmation warning intact (Fonte §57–59).
4. Radar News SHALL remain a separate module that never automatically feeds `direction` or `score` (Fonte §58).

### Requisito 21: Estados operacionais e versão do Brain persistidos

**User Story:** Como desenvolvedor, eu quero estados operacionais explícitos (`READY`, `BLOCKED_NO_VALID_STOP`, etc.) e metadados de versão do Brain persistidos em toda análise, para que direção/execução fiquem sempre separadas e toda análise seja auditável e comparável entre versões do cérebro.

#### Critérios de Aceitação

1. THE Sistema SHALL persist an `execution_state` field distinct from `direction`, using values `READY|WAIT_TRIGGER|SCORE_BELOW_MIN|BLOCKED_NO_VALID_STOP|BLOCKED_NO_VALID_TARGET|BLOCKED_RR_BELOW_MIN|BLOCKED_LEVERAGE_UNAVAILABLE` (Fonte §87); this state changing SHALL NEVER change `direction`.
2. THE Sistema SHALL persist `brain_version`, `prompt_version`, `schema_version`, `provider`, `model`, `bundle_hash` on every analysis (Fonte §88).
3. THE Sistema SHALL update `config('genesis.conviccao_min_execucao')` from its current default of `50` to `60` per Fonte §4.5/§84 — **Nota (Auditoria 2026-09-15):** confirmado, `config/genesis.php:11` tem hoje `'conviccao_min_execucao' => (int) env('GENESIS_CONVICCAO_MIN_EXECUCAO', 50)`; `rr_minimo` já é configurável hoje (`config/genesis.php:4`, default `1.50`) and needs no structural change, only confirmation it stays configurable.

### Requisito 22: Reutilização de bundle por hash — evitar reanálise por IA quando nada mudou

**User Story:** Como responsável de produto, eu quero que o mesmo bundle canônico exato reutilize a decisão já persistida, para reduzir custo, latência e variação espúria do LLM sem mudança real de mercado.

#### Critérios de Aceitação

1. THE Sistema SHALL compute a `bundle_hash` that reflects the actual canonical bundle sent to the decision provider (facts + derived features + vision + availability), not merely the screenshot hash.
2. WHEN an incoming request's `bundle_hash` matches an already-persisted decision, THE Sistema SHALL reuse the persisted decision instead of calling the AI again (Fonte §55).

### Requisito 23: Provider failover com separação transporte/semântico

**User Story:** Como responsável de produto, eu quero que uma falha de transporte do provedor primário (Gemini) acione automaticamente o provedor secundário (OpenAI) sem refazer a visão, para que uma indisponibilidade momentânea não derrube a análise.

**Nota (Auditoria 2026-09-15):** confirmado em código real — `GeminiDecisionClient.php:32` tem o comentário explícito "Não existe fallback automático para a OpenAI. Se o Gemini falhar, o job esgota tentativas...". `OpenAiDecisionClient.php` já existe como segundo provider compatível.

#### Critérios de Aceitação

1. THE Sistema SHALL create `FailoverDecisionProvider` implementing `DecisionProvider`, wrapping a configurable `decision_provider_primary`/`decision_provider_fallback` pair (Fonte §66).
2. THE Sistema SHALL classify errors as transport (503/502/504/timeout/429/connection — short retry + backoff + fallback to secondary provider) vs semantic (invalid JSON, out-of-schema field, invalid score, nonexistent candidate_id, inconsistent narrative — semantic repair on the same provider/bundle, never consuming transport retry budget) (Fonte §65).
3. WHEN vision (`GeminiVisionService`) already succeeded and only the decision call fails, THE Sistema SHALL reuse `bundle.vision`/evidence and swap only the decision provider — SHALL NOT re-run or re-pay for vision (Fonte §67).
4. THE `GenesisGraphicalServiceProvider` binding for `DecisionProvider` SHALL resolve the failover wrapper, not a single provider directly (Fonte §84 GenesisGraphicalServiceProvider).
5. THE Sistema SHALL have passing tests: Gemini 503 → transport retry → OpenAI fallback with the same bundle and without re-running vision; Gemini timeout → fallback; a semantic error → repair, not transport retry (Fonte §91 "Provider").

### Requisito 24: Narrativa não derruba decisão matematicamente válida

**User Story:** Como responsável de produto, eu quero que erros cosméticos de narrativa (visual inexistente citado, número não rastreável) sejam reparados campo a campo, para que `direction`/`score`/plano continuem válidos mesmo quando só o texto tem problema.

#### Critérios de Aceitação

1. THE Sistema SHALL classify narrative errors (`NARRATIVE_MENTIONS_UNAVAILABLE_VISUAL`, `UNACCOUNTED_NUMERIC_LITERAL`, `MONEY_FORMAT_RAW_NUMBER`, `NUMERIC_CITATION_LITERAL_NOT_FOUND`) per field; WHEN the problem is text-only, THE Sistema SHALL repair the field, remove the problematic phrase, or render deterministically, logging the error, WITHOUT invalidating a mathematically valid `direction`/`score`/plan (Fonte §68).
2. THE Sistema SHALL continue rejecting (not repairing) hard operational facts: nonexistent `candidate_id`, stop on the wrong side, nonexistent target, score outside enum, invalid `LONG`/`SHORT`, fabricated price, a nonexistent figure used as fact, incorrectly computed RR, invalid leverage (Fonte §69).

### Requisito 25: Histórico recuperável por UUID e navegação persistente

**User Story:** Como membro, eu quero que uma análise continue acessível por UUID mesmo depois de navegar para o Radar de Oportunidades e voltar, ou dar refresh, para não perder o resultado que acabei de gerar.

#### Critérios de Aceitação

1. THE Sistema SHALL expose `GET /v1/analises/{uuid}` and a frontend route `/genesis/analise/:uuid` that restores the full analysis view from the server, not only from React state (Fonte §70).
2. WHEN the member navigates away (e.g., to Radar de Oportunidades) and back, or refreshes the page, THE Sistema SHALL restore the same open analysis via UUID rather than losing it (Fonte §71).
3. THE Sistema SHALL reuse the already-existing listing/search endpoints for history, and SHALL NOT create a duplicated row when an analysis is reopened (Fonte §70–71).

### Requisito 26: Outcomes como timeline cumulativa com MFE/MAE normalizados

**User Story:** Como responsável de produto, eu quero uma timeline completa de eventos (não só o primeiro evento terminal) para Plano A e Plano B, com MFE/MAE normalizados por R e por ATR, para poder comparar o desempenho do Brain entre ativos e ao longo do tempo.

**Nota (Auditoria 2026-09-15):** confirmado em código real — `DesfechoService.php` tem um `foreach` que retorna imediatamente no primeiro evento terminal encontrado (`STOP_ATINGIDO`/`TP3_ATINGIDO`/`TP2_ATINGIDO`/`TP1_ATINGIDO`, linhas 71-80), exatamente o comportamento que a Fonte §74 pede para substituir.

#### Critérios de Aceitação

1. THE Sistema SHALL replace `DesfechoService`'s first-terminal-event return with a cumulative timeline (`ENTRY_TRIGGERED`, `TP1_HIT`, `TP2_HIT`, `TP3_HIT` or `STOP_HIT_AFTER_TPn`, `EXPIRED`), NOT stopping tracking automatically at TP1 (Fonte §74).
2. THE Sistema SHALL compute and persist `MFE_R`/`MAE_R` (normalized by `R = abs(entry - stop)`) and `MFE_ATR`/`MAE_ATR` (normalized by ATR at analysis time), both raw and normalized (Fonte §75).
3. THE Sistema SHALL use 1-minute granularity where feasible to resolve stop-vs-TP intrabar ordering; WHEN ambiguity remains, THE Sistema SHALL record `AMBIGUOUS_INTRABAR` rather than inventing an order (Fonte §76).
4. THE Sistema SHALL keep the existing directional outcome evaluation (`EvaluateGenesisOutcomes`, horizons 60/240/1440 min) and add `score`/`brain_version` linkage to allow legacy-vs-V2 comparison (Fonte §77).
5. THE original analysis SHALL be immutable (`decision_at_analysis`, `market_snapshot_at_analysis`, `plan_A_original`, `plan_B_original`, `stop_recommended_original`, `targets_original`); subsequent events SHALL live in separate timeline tables, never rewriting the original (Fonte §79).
6. THE Sistema SHALL store `stop_recommended` and `stop_user_adjusted` separately, so the dashboard can measure the AI's original recommendation performance independently from the member's actual execution (Fonte §80).
7. Both Plano A and Plano B outcomes SHALL always be tracked, regardless of which the member entered or whether they entered at all (Fonte §73, Requisito 14.6).

### Requisito 27: Benchmark de estabilidade e teste que prova a morte do legado

**User Story:** Como responsável de produto, eu quero rodar o mesmo bundle 20 vezes contra o provider real antes do deploy, e confirmar que a análise completa funciona com o mecanismo antigo de score desativado, para ter evidência objetiva de estabilidade e de que o legado realmente saiu do caminho decisório.

#### Critérios de Aceitação

1. THE Sistema SHALL run the same frozen real bundle 20 times against the raw provider (outside cache) before deploy; ANY `LONG↔SHORT` flip across the 20 runs SHALL block the release (Fonte §92).
2. IF the score varies by more than 10 points across the 20 runs for the same bundle, THEN THE Sistema SHALL NOT release the free-form score without adopting, within this same restructuring, a stable categorical fallback (`MARGINAL→55, FRACA→60, MODERADA→65/70, FORTE→75/80, MUITO_FORTE→85/90`) for the strength field — WITHOUT reintroducing per-indicator weights (Fonte §92).
3. THE Sistema SHALL create a test/feature-flag combination that disables `ScoreFromFamilies` and the legacy `score_breakdown`, runs the V2 Brain, and confirms `direction`/`score`/Plano A/B/stop/targets/RR all still work — proving no hidden legacy dependency remains (Fonte §93).
4. THE Sistema SHALL run the audit commands from Fonte §94 (`ScoreFromFamilies|score_familias|score_breakdown`, destructive score casts, frontend `Number(null)`-style coercions, `execution.planoB`, `'3h'`, `MM_TIER1_FALLBACK|MATH_ESTIMATE_TIER1`) and confirm every remaining occurrence is explicitly legacy/test/historical, never live in the V2 path.

### Requisito 28: Publicação única — Release Gate e relatório de conclusão

**User Story:** Como responsável de produto, eu quero um gate único de 21 itens que precisa estar 100% aprovado antes de qualquer deploy, e um relatório de conclusão por item, para garantir que a reestruturação não vá para produção parcialmente.

#### Critérios de Aceitação

1. THE deploy to production SHALL NOT occur until all 21 items of the Release Gate (Fonte §90.11) are approved: P0 fixes, Brain V2, `PredictiveFeatureService`, Score V2, recommended stop, slider/risk ruler, repricing, independent Plano A/B, live Plano B, 0–3 targets with correct RR, provider failover, canonical timeframes, real leverage/brackets, UUID history, minimum outcomes, legacy out of decision path, 20x benchmark approved, backend suite green, frontend suite green, critical E2E tests green, final `rg` audit complete.
2. THE feature flag `GENESIS_BRAIN_V2_ENABLED` (`config/genesis_graphical_v6.php`) SHALL be usable exclusively as an emergency technical rollback mechanism, NOT as a progressive rollout strategy (Fonte §89) — see `design.md` for how staged internal validation (staging-only) can satisfy this without violating the single-release mandate.
3. BEFORE deploy, Felipe SHALL produce a completion report per item (`ITEM/STATUS/ARQUIVOS ALTERADOS/ARQUIVOS REMOVIDOS/SUBSTITUTO/TESTES EXECUTADOS/RESULTADO/RISCO RESIDUAL`) per Fonte §100.1; any incomplete item requires explicit approval before deploy — the default is not to publish partially.
4. THE Sistema SHALL NOT leave old direction/score/plan logic "temporarily" active inside the new decision path at deploy time (Fonte §90.11 closing rule).
