# Documento de Requisitos — Gênesis V4.3-R3.2: Implementação e Correção

## Introdução

Este documento especifica o trabalho necessário para levar o Gênesis à conformidade com o **Documento Único Universal V4.3-R3.2** (`GENESIS_V4_3_R3_2_DOCUMENTO_UNICO_UNIVERSAL_DEV_2026-07-12.md`, doravante "Documento Mestre"), responsável de produto Fabrício Marcílio, data-base 12/07/2026.

Este spec nasceu de uma auditoria de código real (não apenas leitura do Documento Mestre) feita em 2026-07-13 contra dois repositórios:

- **Backend Laravel**: `E:\Programas\wamp64\www\genesis-api`
- **Frontend React/TypeScript + Node**: `c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main` (este repositório)

A auditoria encontrou um **bug fatal em produção** (chamada a métodos estáticos inexistentes em `ExecucaoService`), várias violações ativas das invariantes do Documento Mestre (cérebro duplicado, S/R bruto do OCR definindo alvo, configuração morta) e uma migração de frontend que não avançou além da camada de transporte. Os requisitos abaixo cobrem o fechamento completo desse gap, na ordem de risco/dependência.

## Regras Invioláveis

Herdadas do Documento Mestre (Seção 2) e não renegociáveis nesta implementação:

- `analysis.direction` só aceita `LONG`, `SHORT` ou `INDISPONIVEL`. Não existe `NEUTRO` no contrato R3.2.
- O Gemini decide LONG ou SHORT. Nenhum `if`, soma ou fallback do PHP pode trocar a direção declarada.
- `ANALISE_INCONSISTENTE` é quarentena analítica, nunca alias de `INDISPONIVEL`.
- `INDISPONIVEL` só ocorre por falha técnica (chave ausente, timeout, HTTP, JSON/schema inválido após tentativas).
- O orçamento máximo por análise é 5 requisições de IA; retry e correção consomem o mesmo orçamento.
- Não existe fallback automático para OpenAI. Contingência é troca manual e versionada de variável de ambiente.
- LSR é proibido em `montarFolhaDecisao()`, prompt, payload do trader, event store decisório e score.
- Todo cálculo numérico pertence ao PHP; toda interpretação pertence ao Gemini.
- O frontend exibe o contrato do backend. Não inventa LONG, não converte `null` em zero, não calcula decisão.
- Nenhum código legado decisório permanece morto (nem vivo) no pacote entregue.
- Código sem prova (testes, greps, logs, pacote de aceite) é item não feito.

## Glossário

- **Documento Mestre**: `GENESIS_V4_3_R3_2_DOCUMENTO_UNICO_UNIVERSAL_DEV_2026-07-12.md`, fonte normativa de todo código-alvo citado neste spec.
- **genesis-api**: repositório Laravel em `E:\Programas\wamp64\www\genesis-api`.
- **Frontend**: este repositório (`G-nesis-2.0-main`), React + TypeScript + servidor Node (`server.ts`, `routes/api.js`).
- **AnalysisContext**: `app/Support/AnalysisContext.php` — orçamento de requisições de IA por análise.
- **TraderAuditor**: `app/Services/TraderAuditor.php` — valida schema/coerência da resposta do Gemini.
- **ExecucaoService**: `app/Services/ExecucaoService.php` — calcula stop, alvos, RR e estados de execução.
- **candidate_setup / executable_setup**: setup matemático calculado sempre vs. setup exposto somente quando `execution.executable=true`.
- **shadow_mode**: modo em que o pipeline roda por inteiro, mas `execution.action` permanece nulo e nenhuma interface mostra botão operacional.
- **CONTROL / CANDIDATE**: duas variantes da mesma folha de fatos (sem e com enriquecimento Binance) comparadas sob o mesmo `experiment_group_id`.
- **Auditoria 2026-07-13**: as duas investigações de código (backend e frontend) que embasam os requisitos abaixo; citadas como "Auditoria" nos critérios.

## Requisitos

### Requisito 1: Corrigir o crash fatal em `ExecucaoService`

**User Story:** Como desenvolvedor, eu quero que `GeminiAnalysisService` nunca chame métodos inexistentes em `ExecucaoService`, para que análises com falha técnica ou quarentena não derrubem a requisição com um erro fatal do PHP.

**Nota (Auditoria):** `GeminiAnalysisService.php:809` e `:818` chamam `ExecucaoService::indisponivel($reasonCode)` e `ExecucaoService::inconsistente($reasonCode)`, que **não existem** em `app/Services/ExecucaoService.php`. Qualquer análise que termine em `falhaTecnica` ou `analiseInconsistente` lança `Error: Call to undefined method`.

#### Critérios de Aceitação

1. THE ExecucaoService SHALL expose a static method `indisponivel(string $reason): array` matching the shape from Documento Mestre Seção 14.1 (`status=INDISPONIVEL`, `executable=false`, `action=null`, `candidate_setup=null`, `executable_setup=null`).
2. THE ExecucaoService SHALL expose a static method `inconsistente(string $reason): array` matching the shape from Documento Mestre Seção 14.1 (`status=BLOQUEADA_ANALISE_INCONSISTENTE`, `executable=false`, `action=null`, `candidate_setup=null`).
3. WHEN `GeminiAnalysisService::analisar()` reaches the `$falhaTecnica` branch, THE Sistema SHALL call `ExecucaoService::indisponivel($reasonCode)` without a fatal PHP error.
4. WHEN `GeminiAnalysisService::analisar()` reaches the `$analiseInconsistente` branch, THE Sistema SHALL call `ExecucaoService::inconsistente($reasonCode)` without a fatal PHP error.
5. THE Sistema SHALL have a passing test (`ExecucaoContratoTest::test_falha_tecnica_e_unico_indisponivel` and `test_quarentena_nao_e_indisponivel`, per Documento Mestre Seção 18.5) that exercises both static methods directly.

### Requisito 2: Reescrever o contrato de execução completo

**User Story:** Como responsável de produto, eu quero que `ExecucaoService::montar()` implemente o contrato de estados da Seção 14.1 (incluindo RR líquido com custos reais), para que uma análise nunca seja apresentada como executável sem ter passado por todos os filtros de risco.

**Nota (Auditoria):** o `ExecucaoService.php` atual é o motor R3.1 antigo — usa campo `acao` (`AGUARDAR`/`AGUARDAR_PLANO_B`), não tem o enum de status novo, calcula RR bruto sem custos (`config('genesis.custos_bps.*')` nunca é lido em nenhum lugar do `app/`), não lança `LogicException` em direção inválida e não aplica `shadow_mode`.

#### Critérios de Aceitação

1. THE ExecucaoService::montar() SHALL throw a `LogicException` WHEN `$direcao` is not `LONG` or `SHORT`.
2. THE ExecucaoService::montar() SHALL compute `rr_liquido_estimado` using the formula `(recompensa_preco - custo_preco) / (risco_preco + custo_preco)`, where `custo_preco` is derived from `config('genesis.custos_bps')` summed and applied to `preco`, exactly as in Documento Mestre Seção 14.1 `calcularRrLiquidoEstimado()`.
3. THE ExecucaoService::montar() SHALL return `status` as one of exactly: `EXECUTAVEL`, `SHADOW_MODE`, `NAO_RECOMENDADA_RR`, `NAO_RECOMENDADA_ALVO`, `NAO_RECOMENDADA_CONVICCAO`, `NAO_RECOMENDADA_CONFIGURACAO`, `INDISPONIVEL`, `BLOQUEADA_ANALISE_INCONSISTENTE`.
4. WHEN `config('genesis.risco_por_analise')` is missing or outside `(0, 0.05]`, THE ExecucaoService SHALL return `status=NAO_RECOMENDADA_CONFIGURACAO` and SHALL NOT compute a position size.
5. WHEN `tp1_fonte` indicates a projected (non-real) barrier, THE ExecucaoService SHALL return `status=NAO_RECOMENDADA_ALVO` while still populating `candidate_setup` with informative (non-actionable) levels.
6. WHEN `rr_liquido_estimado` is below `config('genesis.rr_minimo')`, THE ExecucaoService SHALL return `status=NAO_RECOMENDADA_RR` and SHALL populate `candidate_setup.rr_aviso` with a human-readable message including the computed ratio and the minimum.
7. WHEN `conviccao` is below `config('genesis.conviccao_min_execucao')`, THE ExecucaoService SHALL return `status=NAO_RECOMENDADA_CONVICCAO`.
8. WHEN all prior checks pass AND `config('genesis.shadow_mode')` is true, THE ExecucaoService SHALL downgrade `status` from `EXECUTAVEL` to `SHADOW_MODE` and SHALL set `reason_code=HOMOLOGACAO_SHADOW_MODE`.
9. THE ExecucaoService SHALL only set `execution.action` to `LONG` or `SHORT` WHEN `status=EXECUTAVEL`; in every other status, `action` SHALL be `null`.
10. THE ExecucaoService SHALL only populate `executable_setup` WHEN `executable=true`; `candidate_setup` SHALL always be populated when a stop/alvo could be computed, regardless of status.
11. THE Sistema SHALL have a passing `ExecucaoContratoTest::test_rr_baixo_preserva_candidato_mas_nao_publica_acao` (Documento Mestre Seção 18.5) verifying `candidate_setup` survives a `NAO_RECOMENDADA_RR` outcome while `executable_setup` is null.

### Requisito 3: Remover o cérebro Gemini legado duplicado

**User Story:** Como responsável de produto, eu quero que exista apenas uma chamada de decisão Gemini por análise, para que o Gemini 3.5 Flash seja de fato o único cérebro decisório e o orçamento de IA não seja gasto com um motor legado paralelo.

**Nota (Auditoria):** `callGemini()` (linha 1220), `buildPrompt()` (linha 1081), `buildTradeSetup()` (linha 1286) e `buscarGeopoliticaFresca()` (linha 1127/2143) de `GeminiAnalysisService.php` são chamados de verdade dentro de `analisar()` (linhas 583, 597, 600) — uma segunda chamada Gemini de contrato antigo (`direcaoProvavel`, `execucao.setup`) rodando só para alimentar campos de narrativa. Isso viola a Seção 17 (remoção definitiva) e a invariante "Gemini é o único cérebro decisório".

#### Critérios de Aceitação

1. THE GeminiAnalysisService::analisar() SHALL NOT call `buildPrompt()`, `callGemini()`, or `buildTradeSetup()` anywhere in its execution path.
2. IF informative/narrative context (macro, sentiment, events) is still required, THEN THE Sistema SHALL obtain it exclusively through `gerarContextoInformativoUnico()` (Documento Mestre Seção 10.4), consuming the `informative` budget slot, never a second full decision call.
3. THE Sistema SHALL delete `buildPrompt()`, `callGemini()`, `buildTradeSetup()`, `buscarGeopoliticaFresca()` (when used only by the legacy path), `promptTrader()`, `schemaTrader()`, `callTraderIA()`, `callOpenAITrader()`, `callGeminiTrader()`, and `viesDaFigura()` from `GeminiAnalysisService.php`.
4. THE Sistema SHALL delete `FiguraService::identificar()` and its private helpers (`medirGeometria`, `calcularPivos`, `verificarOCO`, `verificarTopoFundoDuplo`, `verificarXicara`, `projetarAlvo`, `nivelDeConfirmacao`) since they are confirmed dead code superseded by `validarReportada()`.
5. WHEN running `grep -RInE "callGemini\(|buildPrompt|buildTradeSetup|buscarGeopoliticaFresca" app/` from the genesis-api root, THE Sistema SHALL return no matches outside test/proof artifacts (Documento Mestre Seção 19.2).
6. WHEN running `grep -RInE "thinkingBudget|temperature|top_p|top_k" app/ config/`, THE Sistema SHALL return no matches (removes the dead `temperature => 0` in the deleted `callOpenAITrader`/`callGeminiTrader`).

### Requisito 4: Barreiras de alvo somente com S/R validado semanticamente

**User Story:** Como responsável de produto, eu quero que `montarBarreiras()` nunca use suporte/resistência bruto do OCR, para que TP1 nunca seja definido por um nível que não passou pela validação semântica.

**Nota (Auditoria):** `ExecucaoService::montarBarreiras()` ainda adiciona `resistencia_suporte` a partir de `$ev['resistencias']`/`$ev['suportes']` (elementos visuais brutos do OCR), violando o item 22 do aceite binário do Documento Mestre.

#### Critérios de Aceitação

1. THE ExecucaoService::montarBarreiras() SHALL only accept post-`validarNiveisSemanticos()` support/resistance collections (i.e. the `$zonas['suportes']`/`$zonas['resistencias']` output, not `$ev['suportes']`/`$ev['resistencias']`).
2. THE ExecucaoService::montarBarreiras() SHALL NOT receive or read a raw LVN parameter for TP barrier purposes (LVN stays available only as Plano B context).
3. THE Sistema SHALL have a passing `FolhaIntegridadeTest::test_barreiras_ignoram_sr_bruto_e_usam_somente_sr_validado` (Documento Mestre Seção 18.3) proving raw OCR levels never appear in the barrier list while validated levels do.
4. WHEN running `grep -RInE "elementosVisuais.*(suportes|resistencias)|\$ev\['(suportes|resistencias)'\]" app/Services/ExecucaoService.php`, THE Sistema SHALL return no matches.

### Requisito 5: Contrato estruturado do book da Binance

**User Story:** Como desenvolvedor, eu quero que `BinanceService::getOrderBookWalls()` retorne o contrato estruturado `{preco, qtd, notional, qualidade, scoring_enabled}`, para que nenhum consumidor precise adivinhar o tipo de um nível de book.

**Nota (Auditoria):** `getOrderBookWalls()` (linhas 332-350) retorna arrays de floats escalares (`paredes_compra: [float, ...]`), não o contrato estruturado da Seção 12.1.

#### Critérios de Aceitação

1. THE BinanceService::getOrderBookWalls() SHALL return `paredes_compra`/`paredes_venda` as arrays of `{preco: float, qtd: float, notional: float}`, filtered by the mean-quantity threshold (`qtd > media * 5`), exactly as in Documento Mestre Seção 12.1.
2. THE BinanceService::getOrderBookWalls() SHALL return top-level `qualidade` (`SNAPSHOT_REST` or `INDISPONIVEL`) and `scoring_enabled` (bool, from `config('genesis.book_scoring_enabled')`).
3. THE Sistema SHALL update every consumer of `getOrderBookWalls()` (including `MotorExecucaoService` and `montarBookFolha()`) atomically to the new contract in the same change, throwing `\UnexpectedValueException` on a scalar/legacy shape (Documento Mestre Seção 12.3).
4. THE Sistema SHALL have a passing `BookContractTest::test_rejects_scalar_wall` (Documento Mestre Seção 18.4/18.6).

### Requisito 6: Feature flags e shadow mode aplicados de fato

**User Story:** Como responsável de produto, eu quero que as flags declaradas em `config/genesis.php` (`shadow_mode`, `features.*`, `book_scoring_enabled`) controlem comportamento real, para que eu possa ligar/desligar recursos sem deploy de código.

**Nota (Auditoria):** `config('genesis.shadow_mode')`, `config('genesis.features.*')` e `config('genesis.book_scoring_enabled')` são declaradas mas **nunca lidas** em nenhum lugar de `app/` (confirmado por grep) — são configuração morta.

#### Critérios de Aceitação

1. THE ExecucaoService SHALL read `config('genesis.shadow_mode')` and apply the EXECUTAVEL→SHADOW_MODE downgrade described in Requisito 2.8.
2. THE BinanceService::getOrderBookWalls() SHALL read `config('genesis.book_scoring_enabled')` and propagate it into the returned `scoring_enabled` field.
3. THE FeaturePolicy (Requisito 9) SHALL read `config('genesis.features.trade_flow')`, `config('genesis.features.streaming_book_collect')`, and `config('genesis.features.streaming_book_brain')` to gate each capability per timeframe.
4. THE Sistema SHALL have a passing `ControlCompatibilityTest` (Documento Mestre Seção 18.7) proving that with every `genesis.features.*` flag disabled, the resulting folha is byte-identical to the R3.1 folha except for version/experiment metadata.

### Requisito 7: Boot com falha rápida em configuração crítica ausente

**User Story:** Como operador de produção, eu quero que o backend recuse iniciar (ou recuse servir `/v1/analyze`) quando a configuração crítica estiver ausente, para que uma análise nunca rode com risco mal configurado silenciosamente.

**Nota (Auditoria):** `AppServiceProvider::boot()` só usa `Log::critical()`/`Log::warning()`; nada impede o boot de servir requisições com `GEMINI_API_KEY` ausente ou `risco_por_analise` inválido.

#### Critérios de Aceitação

1. WHEN `config('services.gemini_key')` is blank AND `config('services.ai_trader_provider') === 'gemini'`, THE Sistema SHALL prevent `/v1/analyze` from producing a decision (fail closed, not just log).
2. WHEN `config('genesis.risco_por_analise')` is not numeric or outside `(0, 0.05]`, THE Sistema SHALL log critically AND the resulting analysis SHALL surface as `NAO_RECOMENDADA_CONFIGURACAO` (per Requisito 2.4) rather than silently proceeding.
3. THE AppServiceProvider::boot() SHALL continue to log the `GENESIS BOOT` line with `documento_versao`, `trader_model_solicitado`, `thinking_level`, `prompt_versao`, `schema_versao`, `ai_max_requests`, `risk_configured`.

### Requisito 8: Suite de testes do backend corrigida e ampliada

**User Story:** Como desenvolvedor, eu quero que a suite de testes reflita o contrato atual do `TraderAuditor` e cubra os casos do Documento Mestre Seção 18, para que `php artisan test` seja um sinal confiável de regressão.

**Nota (Auditoria):** `tests/Unit/TraderAuditoriaTest.php` testa um contrato obsoleto (`$aud['score']`, aceita `NEUTRO` como válido) que não bate com `TraderAuditor::auditar()` atual e provavelmente falha se executado.

#### Critérios de Aceitação

1. THE Sistema SHALL rewrite `tests/Unit/TraderAuditoriaTest.php` to assert `conviccao_modelo` (not `score`) and to assert `NEUTRO` is rejected (`ok=false`), matching Documento Mestre Seção 18.1 verbatim.
2. THE Sistema SHALL add `tests/Unit/AnalysisContextTest.php` per Documento Mestre Seção 18.2.
3. THE Sistema SHALL add `GeminiTraderClientTest`, `GeminiFailureMappingTest`, `BookContractTest`, `FiguraServiceTest`, `OcrCacheKeyTest` per Documento Mestre Seções 18.4/18.6.
4. THE Sistema SHALL add `LsrIsolationTest` asserting `lsr`, `long_short`, `getLongShortRatio` never appear in `montarFolhaDecisao()` output, the trader prompt, `TraderAuditor`, or `AnalysisEventStore` snapshots.
5. THE Sistema SHALL add `BinanceOnlyBrainTest` asserting no Bybit/OKX/Bitget/Deribit/ExchangeRouter class is resolved during `/v1/analyze` (Documento Mestre item 39).
6. WHEN `php artisan test` runs, THE Sistema SHALL report all tests passing on the same commit hash used for the proof package.

### Requisito 9: Camada de enriquecimento Binance (regime, fluxo, derivativos, frescor, política de feature)

**User Story:** Como responsável de produto, eu quero uma camada de contexto adicional (regime, fluxo real, derivativos enriquecidos, qualidade temporal) construída sobre dados públicos da Binance, para que o Gemini receba mais contexto sem que o backend vire um segundo cérebro decisório.

**Nota (Auditoria):** nenhum destes serviços existe hoje em `app/Services/`.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/DataFreshnessGate.php` implementing `avaliar()` exactly as Documento Mestre Seção 12.8, marking sources `OK`/`STALE`/`SEQUENCE_GAP` and excluding non-`OK` sources from the folha as evidence.
2. THE Sistema SHALL create `app/Services/RegimeService.php` implementing `classificar()` per Seção 12.9, reusing existing EMA/ATR/ADX/compression indicators, and it SHALL NOT return `direcao`, `LONG`, or `SHORT`.
3. THE Sistema SHALL create `app/Services/TradeFlowService.php` implementing `resumir()` per Seção 12.10, returning only windowed aggregates (never a raw trade stream) to the folha.
4. THE Sistema SHALL create `app/Services/DerivativesEnrichmentService.php` implementing `enriquecer()` per Seção 12.11, using `_POSSIVEL` suffixes for all inferred movement labels.
5. THE Sistema SHALL create `app/Services/FeaturePolicy.php` implementing `forTimeframe()` per Seção 12.7, marking intraday-only microstructure as `INFORMATIVO`/`IGNORAR` for swing/daily/weekly timeframes.
6. THE Sistema SHALL extend `montarFolhaDecisao()` with the optional trailing arguments (`$dataQuality`, `$regime`, `$tradeFlow`, `$derivativosEnriquecidos`, `$featurePolicy`) per Seção 12.13, without altering `TraderSchema`, the four family limits, or the public contract.
7. THE Sistema SHALL add the corresponding prompt rules 11–18 from Seção 12.13 to `GeminiTraderClient::prompt()`.
8. THE Sistema SHALL have passing tests `IncrementalBrainTest` (all sub-cases in Documento Mestre Seção 18.7).

### Requisito 10: Coleta do book WebSocket sem peso decisório

**User Story:** Como responsável de produto, eu quero coletar o book via WebSocket para medir persistência e integridade de sequência, sem que ele influencie a decisão até prova de contribuição.

**Nota (Auditoria):** `BinancePublicStreamService.php` não existe.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/BinancePublicStreamService.php` maintaining snapshot + deltas with sequence validation, per Documento Mestre Seção 12.12.
2. WHILE `GENESIS_STREAMING_BOOK_BRAIN_ENABLED=false`, THE Sistema SHALL ensure no field derived from the WebSocket book collector alters `score_familias` or `direcao`.
3. THE Sistema SHALL have a passing `StreamingBookShadowTest` proving collection-on/brain-off leaves direction and score unchanged (Documento Mestre Seção 18.7).

### Requisito 11: Event store auditável e shadow mode mensurável

**User Story:** Como responsável de produto, eu quero que toda análise seja persistida com folha, resposta do trader, auditoria e execução, para que eu possa medir CONTROL vs. CANDIDATE e decidir quando desligar o shadow mode com dados reais.

**Nota (Auditoria):** nem a migration `genesis_analysis_events` nem `AnalysisEventStore.php` existem.

#### Critérios de Aceitação

1. THE Sistema SHALL create the migration `create_genesis_analysis_events_table` with all columns from Documento Mestre Seção 16.1, including `analysis_id` (unique), `experiment_group_id`, `brain_variant`, `features_version`, outcome fields.
2. THE Sistema SHALL create `app/Services/AnalysisEventStore.php` implementing `persist()` per Seção 16.2, called after the public response is assembled and before the HTTP return, with persistence failure logged critically but never mutating an already-concluded analysis.
3. THE Sistema SHALL create `app/Services/OutcomeLabeler.php` implementing `rotular()` per Seção 16.4, distinguishing `TP1_FIRST`, `STOP_FIRST`, `TIMEOUT`, `AMBIGUOUS_SAME_CANDLE` without look-ahead.
4. THE Sistema SHALL have a passing `AnalysisEventStoreTest` asserting `analysis_id` uniqueness and full snapshot persistence.
5. THE Sistema SHALL have a passing `OutcomeLabeler` test asserting same-candle TP+stop hits are labeled `AMBIGUOUS_SAME_CANDLE`, never resolved by assumed intrabar order (Documento Mestre Seção 18.7, `test_outcome_same_candle_is_ambiguous`).

### Requisito 12: Geometria e confirmação de figuras

**User Story:** Como responsável de produto, eu quero que uma figura só seja `CONFIRMADA` quando a geometria (paralelismo/convergência, toques mínimos) e o fechamento além da borda projetada forem comprovados matematicamente, para que o Gemini nunca receba uma figura confirmada por engano do OCR.

**Nota (Auditoria):** `FiguraService.php` só tem `validarReportada()`, um validador simplificado (tolerância de 3×ATR sobre pontos de linha) sem as funções de geometria da Seção 13.2.

#### Critérios de Aceitação

1. THE FiguraService SHALL implement `timeframeMs`, `inclinacaoLogDia`, `projetarLinha`, `ultimoCandleFechado`, `classificarLinhasNoTempo`, `contarToques`, `checarGeometria`, `checarConfirmacao` exactly as Documento Mestre Seção 13.2.
2. THE FiguraService::validarReportada() SHALL accept a `string $timeframe` argument and SHALL downgrade `estado` from `CONFIRMADA` to `EM_DESENVOLVIMENTO` WHEN `checarGeometria()` or `checarConfirmacao()` returns a non-null reason, logging the reason via `FIGURA_GEOMETRIA_DEGRADADA`/`FIGURA_CONFIRMACAO_DEGRADADA`.
3. THE Sistema SHALL move `VIES`/`CONFIRMACAO` maps into `GenesisVisualCatalog` as the single source of truth per Seção 13.1.
4. THE Sistema SHALL have a passing `FiguraServiceTest` covering wedges, triangles, flags, insufficient touches, open candle, and false breakout (Documento Mestre Seção 18.6).

### Requisito 13: Contrato de tipos do frontend

**User Story:** Como desenvolvedor frontend, eu quero que `types.ts` reflita exatamente o contrato público R3.2, para que nenhum componente precise inventar ou adivinhar a forma dos dados vindos do backend.

**Nota (Auditoria):** `types.ts` não tem nenhum dos tipos novos (`AnalysisDirection`, `ExecutionStatus`, `ScoreFamilias`, `CandidateSetup`, `GenesisAnalysisResult`); ainda tem `confianca`, `regime`, `ensemble`, blocos de macro/sentimento.

#### Critérios de Aceitação

1. THE types.ts SHALL define `AnalysisDirection = 'LONG' | 'SHORT' | 'INDISPONIVEL'` with no `NEUTRO` variant.
2. THE types.ts SHALL define `AnalysisStatus`, `ExecutionStatus` (all 8 values), `ScoreFamilias`, `ScoreContexto`, `CandidateSetup`, `GenesisAnalysisResult`, `SavedAnalysis` exactly as Documento Mestre Seção 15.2.
3. THE types.ts SHALL NOT contain `confianca`, `regime`, `ensemble`, `scoreDetalhado`, `blocoMacro`, `blocoSentimento`, or `barras` as field names anywhere in the file.
4. THE Sistema SHALL update every importer of the removed/renamed types (compile-time TypeScript check) as part of the same change, not deferred.

### Requisito 14: `GenesisPage.tsx` sem defaults falsos e com gate de salvamento

**User Story:** Como membro, eu quero que o frontend nunca mascare um dado ausente do backend como `0` ou `'LONG'`, e que eu não consiga salvar uma operação que o backend marcou como não executável, para que eu nunca opere em cima de um dado inventado pela interface.

**Nota (Auditoria):** `GenesisPage.tsx` tem 18+ ocorrências de `|| 0`/`|| 'LONG'`/`parseFloat(...) || 0` em campos de análise; `handleSaveTrade()` só checa `if (!result) return` — não verifica `execution.executable`.

#### Critérios de Aceitação

1. THE GenesisPage.tsx SHALL implement `toNullableNumber(value: unknown): number | null` per Documento Mestre Seção 15.3, and SHALL use it for every numeric field extracted from `execution.candidate_setup`/`analysis`.
2. THE GenesisPage.tsx SHALL NOT contain `|| 'LONG'`, `|| 0`, or `parseFloat(...) || 0` applied to any `analysis.*` or `execution.*` field.
3. WHEN `handleSaveTrade()` is invoked AND `!result.execution.executable || !result.execution.executable_setup`, THE GenesisPage.tsx SHALL display `result.execution.motivo` and SHALL NOT persist a trade.
4. THE GenesisPage.tsx SHALL build `SavedAnalysis` exclusively from `execution.executable_setup` fields (never `candidate_setup`) when saving an operational trade.

### Requisito 15: `AnalysisResult.tsx` exibindo o contrato de execução novo

**User Story:** Como membro, eu quero ver claramente por que uma análise não é operável (RR baixo, convicção baixa, quarentena) com o texto exato que o backend forneceu, para que eu não precise adivinhar o motivo a partir de um cálculo feito no próprio navegador.

**Nota (Auditoria):** `AnalysisResult.tsx` lê `data.confianca`/`data.execucao.acao`/`data.ensemble` (contrato legado); o aviso de RR é recalculado no cliente com threshold hardcoded 1.5 em vez de usar `execution.candidate_setup.rr_aviso`; `isOperavel` é calculado pela direção, não por `execution.executable`.

#### Critérios de Aceitação

1. THE AnalysisResult.tsx SHALL read `data.analysis.conviccao_modelo`, `data.analysis.leitura_fraca`, `data.execution.status`, `data.execution.executable`, `data.execution.candidate_setup` as its sole data source (no `data.confianca`/`data.execucao`/`data.ensemble`).
2. THE AnalysisResult.tsx SHALL define and use an `executionLabel: Record<ExecutionStatus, string>` map covering all 8 status values from Documento Mestre Seção 15.5.
3. WHEN `analysis.leitura_fraca === true`, THE AnalysisResult.tsx SHALL render the "Leitura de baixa convicção" block showing `analysis.justificativa_score` verbatim.
4. WHEN `execution.candidate_setup.rr_aviso` is non-null, THE AnalysisResult.tsx SHALL render it verbatim; the component SHALL NOT compute its own RR threshold client-side.
5. THE AnalysisResult.tsx SHALL compute `isOperavel` as `execution.executable && execution.action !== null`, and SHALL gate the leverage badge and operational button on this flag exclusively.

### Requisito 16: Tratamento de erro HTTP explícito no cliente API

**User Story:** Como desenvolvedor frontend, eu quero que toda chamada de API lance um erro explícito em resposta HTTP não-OK, para que uma falha de rede ou servidor nunca seja silenciosamente tratada como sucesso vazio.

**Nota (Auditoria):** a maioria das funções de `services/api.ts` faz `return res.json()` sem checar `res.ok`; as que checam retornam `null`/`{success:false}` em vez de lançar.

#### Critérios de Aceitação

1. THE services/api.ts SHALL throw an `Error` containing HTTP status and response body (truncated to 300 chars) WHEN any request returns `!res.ok`, per Documento Mestre Seção 15.6.
2. THE Sistema SHALL apply this pattern to every exported function in `api.ts`, not only the subset that currently checks `res.ok`.
3. THE Sistema SHALL update every caller of `api.ts` functions to handle the thrown error (try/catch or error boundary) as part of the same change.

### Requisito 17: Segurança do servidor Node

**User Story:** Como responsável de produto, eu quero que o servidor Node nunca aceite um login administrativo fixo nem use um segredo JWT previsível, para que a autenticação dependa exclusivamente do mecanismo autorizado.

**Nota (Auditoria):** `server.ts:70` aceita `admin`/`Admin`/`admin` sem checagem externa; `server.ts:14,19` e `routes/api.js:24` usam o fallback literal `'fallback_secret_only_for_dev_if_missing'` para `JWT_SECRET`.

#### Critérios de Aceitação

1. THE Sistema SHALL remove the hardcoded `admin`/`Admin` login branch from `server.ts` entirely.
2. THE Sistema SHALL remove every occurrence of the literal `'fallback_secret_only_for_dev_if_missing'` from `server.ts` and `routes/api.js`.
3. WHEN `process.env.JWT_SECRET` is unset, THE Sistema SHALL throw an error at server startup (`if (!secret) throw new Error(...)`) rather than falling back to a default.
4. THE Sistema SHALL NOT log tokens, passwords, or API keys anywhere in `server.ts` or `routes/api.js`; the stray `test_env.js` (root) logging `GEMINI_API_KEY`/`API_KEY` SHALL be deleted per Requisito 18.

### Requisito 18: Remoção do motor de decisão legado do Node e limpeza de código morto

**User Story:** Como desenvolvedor, eu quero que não exista nenhum caminho de decisão client-side ou Node-side paralelo ao backend Laravel, e que o repositório não carregue artefatos soltos irrelevantes, para que fique impossível confundir qual camada decide LONG/SHORT.

**Nota (Auditoria):** `routes/api.js` ainda define `/analisar` com um motor de decisão completo (`GenesisPipeline`/`EnsembleGenesis`, cálculo de `confianca`/`regime`/`direcao`); os imports `require('../engine/genesisPipeline')` e `require('../engine/ensembleGenesis')` apontam para uma pasta `engine/` inexistente (a rota provavelmente falha ao montar, mas o código não foi apagado); `genesisPipeline.js` continua na raiz; vários serviços "Engine" legados seguem no repo, alguns órfãos, alguns ainda importados só por tipos mortos em `geminiService.ts`.

#### Critérios de Aceitação

1. THE Sistema SHALL delete the `/analisar` route handler from `routes/api.js` in its entirety.
2. THE Sistema SHALL delete `require('../engine/genesisPipeline')` and `require('../engine/ensembleGenesis')` (and the `global.EnsembleGenesis` assignment) from `routes/api.js`.
3. THE Sistema SHALL delete the root file `genesisPipeline.js`.
4. THE Sistema SHALL delete `services/scoringEngine.ts`, `services/interpretationEngine.ts`, `services/indicatorEngine.ts`, `services/validationEngine.ts`, `services/adaptedDataFetcher.ts` (confirmed orphaned chain) and their now-unused test files.
5. THE Sistema SHALL remove the dead-type-only imports of `entryPlannerService`, `predictiveEntryPlannerService`, `probabilityScoreEngine` from `services/geminiService.ts`, deleting those service files if no other live importer remains after the removal.
6. THE Sistema SHALL delete `services/microstructureEngine.ts` if confirmed to have zero importers after Requisitos 18.4–18.5.
7. WHEN running the greps from Documento Mestre Seção 19.2 adapted to this repo (`engine/|/analisar` in `routes/`, `server.ts`), THE Sistema SHALL return no matches.

### Requisito 19: Limpeza de artefatos soltos e verificação de isolamento do LSR

**User Story:** Como desenvolvedor, eu quero que a raiz do repositório contenha apenas código vivo, e que o widget de LSR (Micro Radar) esteja comprovadamente isolado do fluxo de decisão do Gênesis, para reduzir ruído e confirmar a invariante de proibição do LSR na decisão.

**Nota (Auditoria):** raiz tem 1 `.zip`, 2 PDFs antigos, 22 scripts `.cjs` soltos, 21+ `test_*.js`, `__pycache__/`, `dist_test/`, `scratch/`. `advancedAnalytics.ts` (importado ao vivo por `geminiService.ts`) não foi totalmente verificado quanto a vazar dado de LSR para o contexto enviado ao Gemini.

#### Critérios de Aceitação

1. THE Sistema SHALL delete `Genesis_Patch_Todas_Correcoes (1).zip`, the two loose PDFs at repo root, all root-level `.cjs` one-off scripts (keeping only `ecosystem.config.cjs`), all root `test_*.js`/`test.js` files, `__pycache__/`, `dist_test/`, and `scratch/`.
2. THE Sistema SHALL read `services/advancedAnalytics.ts` in full and confirm WHETHER any LSR-derived value reaches `geminiService.ts`'s request payload to the backend.
3. IF `advancedAnalytics.ts` is confirmed to inject LSR data into the Gemini-bound payload, THEN THE Sistema SHALL remove that data path, leaving LSR display-only within `MicroRadarPanel.tsx`/`LongShortRatio.tsx`.
4. THE Sistema SHALL have a passing `LsrIsolationTest`-equivalent frontend check (manual grep acceptable) confirming no `lsr`/`long_short`/`getLongShortRatio` value is included in any payload sent to `/v1/analyze`.

### Requisito 20: Protocolo de prova, greps de remoção e pacote de aceite

**User Story:** Como responsável de produto, eu quero o pacote de prova completo (Documento Mestre Seção 19.3) e os 50 itens do aceite binário (Seção 20) avaliados, para decidir formalmente se o Gênesis R3.2 pode sair do shadow mode.

#### Critérios de Aceitação

1. WHEN all Requisitos 1–19 are complete, THE Sistema SHALL run every grep listed in Documento Mestre Seção 19.2 and record the (expected-empty) output in `greps-backend.txt`/`greps-frontend.txt`.
2. THE Sistema SHALL assemble `GENESIS-V4.3-R3.2-PROVA.zip` with the exact structure from Documento Mestre Seção 19.3, including reanalysis of ETHUSDT, POLUSDT, SUIUSDT with `ocr.json`, `folha.json`, `trader.json`, `auditoria.json`, `execucao.json`, `resposta-publica.json`, `tela.png`, `log.txt`.
3. THE Sistema SHALL evaluate all 50 items of Documento Mestre Seção 20 as `APROVADO`/`REPROVADO` in `matriz-aceite.md`, with no partial verdicts.
4. THE Sistema SHALL keep `GENESIS_SHADOW_MODE=true` until the quantitative acceptance criteria of Documento Mestre Seção 21.4 are met and formally signed off by the responsável de produto.
