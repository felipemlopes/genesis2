# Documento de Requisitos — Gênesis V4.3-R3.2: Cérebro de Análise Gráfica

## Introdução

Este spec traduz o documento do cliente `GENESIS_V4_3_R3_2_ADENDO_FINAL_CEREBRO_GRAFICO_DEV_2026-07-14` (doravante "Adendo") em requisitos rastreáveis. O Adendo é vinculante: produção do cérebro gráfico fica bloqueada até 100% dos critérios de aceite binário (Seção 40 do Adendo) e das provas reais (POL/APT/MYX) estarem cumpridos, com prova de execução real — não basta declarar que o código existe.

Repositórios:
- **[API]** `E:\Programas\wamp64\www\genesis-api` (Laravel)
- **[FE]** este repositório (React/TypeScript + Node)

Auditoria de código real (não só leitura do Adendo) feita em 2026-07-14 contra `genesis-api` — resultado completo no `design.md` deste spec.

## Regras Invioláveis

Herdadas do Adendo Seção 2.3 (invariantes de produto):

1. OCR 1 identifica somente par, timeframe, corretora e mercado (SPOT/FUTURES). Nunca indicadores, direção, suporte, resistência, figura ou score.
2. OCR 2 só roda depois do clique em analisar, em paralelo com a obtenção de dados brutos.
3. Derivativos nunca escolhem LONG ou SHORT — só reforçam/enfraquecem a convicção já definida pelas famílias gráficas.
4. LSR não participa do cérebro decisório em nenhuma hipótese.
5. Indicador ausente não vale zero e não invalida a análise — reduz cobertura, gera status/motivo auditável.
6. Valor matemático reproduzível (EMA, RSI, MACD, ATR, ADX...) nunca é transcrito do gráfico por OCR.
7. Elemento visual não confirmado é excluído, não degradado para participar mesmo assim.
8. Não existe Fibo automática — só participa quando desenhada, com âncoras validadas contra candles reais.
9. Não existe fallback silencioso de corretora, timeframe, ou Futures→Spot.
10. O score explica convicção; não substitui a análise técnica (`score_justification` ≠ `technical_analysis`, textos diferentes).
11. Texto público em português do Brasil, com acentuação correta, vocabulário de trader (Seção 12.4 do Adendo).
12. Novas features (VWAP, CMF, OBV, Ichimoku, Supertrend, Efficiency Ratio, Fibo desenhada, elementos visuais SMC) entram com peso zero até promoção formal por CONTROL vs CANDIDATE.

## Glossário

- **Adendo**: `GENESIS_V4_3_R3_2_ADENDO_FINAL_CEREBRO_GRAFICO_DEV_2026-07-14`, fonte normativa deste spec.
- **Documento Mestre (2026-07-12)**: especificação anterior, já parcialmente implementada pelo spec irmão `genesis-r3-2-implementacao`. O Adendo é uma correção/extensão específica do cérebro gráfico sobre esse mesmo produto — não o substitui inteiramente.
- **FeatureEvidence**: contrato de origem/status/valor por feature (Adendo Seção 16), com fontes permitidas `API_DIRECT | DERIVED_FROM_API | OCR_VALIDATED | UNAVAILABLE`.
- **Famílias gráficas**: `structure` (30), `trend` (20), `momentum` (20), `technical_flow` (20), `visual_confluence` (10) — únicas que podem determinar LONG/SHORT (Adendo Seção 8.1).
- **shadow mode**: recurso calculado e logado, mas com peso decisório zero até promoção.
- **CONTROL / CANDIDATE**: comparação da mesma folha de fatos sem e com um recurso novo, sob o mesmo `experiment_group_id`.

## Requisitos

### Requisito 1: Congelar e re-rotular a fonte dos indicadores centrais

**User Story:** Como responsável de produto, eu quero que EMA21/50/200, RSI14, MACD, ATR14 e Bollinger continuem calculados exatamente como hoje, mas com a fonte corretamente rotulada, para que o congelamento do Adendo Seção 1.1 seja respeitado sem esconder o fallback matemático por OCR que ainda existe.

**Nota (Auditoria 2026-07-14):** `TechnicalAnalysisService::calcular(array $candles, array $ocrData = [])` ainda tem fallback para `$ocrData` quando o cálculo local falha, e rotula a fonte como `"API"`/`"OCR"`/`"GRAFICO"` — não usa o vocabulário `API_DIRECT`/`DERIVED_FROM_API`/`OCR_VALIDATED`/`UNAVAILABLE` exigido.

#### Critérios de Aceitação

1. THE TechnicalAnalysisService::calcular() SHALL NOT read `$ocrData` as a fallback for EMA21/50/200, RSI, MACD, ATR, or ADX when the local calculation fails or returns null (Adendo Seção 17.1).
2. WHEN a locked indicator's local calculation succeeds, THE TechnicalAnalysisService SHALL label its `fonte` as `DERIVED_FROM_API`.
3. WHEN a locked indicator's local calculation fails or has insufficient history, THE TechnicalAnalysisService SHALL return `null` for the value and label `fonte` as `UNAVAILABLE`, never substituting an OCR-read value (Adendo Seção 17.3).
4. THE Sistema SHALL create `tests/Fixtures/ohlcv/locked-candles.json` and `locked-indicators.json` as golden fixtures BEFORE any change to indicator source selection, committed and reviewed.
5. THE Sistema SHALL have a passing `LockedIndicatorsRegressionTest` (Adendo Seção 37.1) proving EMA21/50/200, RSI, MACD, MACD signal/histogram, ATR, and Bollinger are numerically identical to the golden fixture, AND proving OCR-supplied values (`ema_21=999` etc.) never override the locked calculation.

### Requisito 2: Origem de candles sem mistura silenciosa Futures/Spot

**User Story:** Como responsável de produto, eu quero que a análise gráfica nunca troque Futures por Spot (ou vice-versa) sem autorização explícita, para que a origem dos candles seja sempre rastreável e nunca inferida silenciosamente.

**Nota (Auditoria 2026-07-14):** `BinanceService::getCandlesResiliente()` (linhas 128-144) faz fallback silencioso Futures→Spot. `GeminiAnalysisService::analisar()` chama esse método. Não existe `getCandlesStrict()` no código.

#### Critérios de Aceitação

1. THE Sistema SHALL implement `BinanceService::getCandlesStrict(string $symbol, string $interval, string $market, int $limit)` per Adendo Seção 18, validating `$market` is exactly `FUTURES` or `SPOT` and throwing on any other value.
2. THE GeminiAnalysisService::analisar() SHALL call `getCandlesStrict()`, not `getCandlesResiliente()`, in the graphical brain path.
3. WHEN `$exchange` is not `BINANCE`, THE Sistema SHALL throw `UNSUPPORTED_EXCHANGE` and block the analysis rather than falling back to another exchange or market.
4. THE Sistema SHALL keep `getCandlesResiliente()` out of the graphical brain call graph; `grep "getCandlesResiliente" app/Services/GeminiAnalysisService.php` SHALL return empty once this requirement is complete (Adendo Seção 41).

### Requisito 3: Contrato de origem dos dados (FeatureEvidence)

**User Story:** Como desenvolvedor, eu quero um contrato único de origem/status/valor por feature, para que toda evidência da folha gráfica seja auditável e nenhuma feature ausente seja tratada como zero.

**Nota (Auditoria 2026-07-14):** não existe `app/Support/FeatureEvidence.php` nem `config/genesis_graphical.php` no código auditado.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Support/FeatureEvidence.php` implementing `make()`/`usable()` exactly as Adendo Seção 16, restricting `source` to `API_DIRECT|DERIVED_FROM_API|OCR_VALIDATED|UNAVAILABLE` and `status` to the 12 values of Adendo Seção 7.2.
2. THE FeatureEvidence::make() SHALL force `value=null` whenever `status !== 'OK'`, regardless of what value was passed in.
3. THE Sistema SHALL create `config/genesis_graphical.php` per Adendo Seção 15, with `shadow_mode` defaulting to `true` and every new feature flag (`market_structure_v2`, `break_retest_v1`, `visual_fibo_v1`, `vwap`, `cmf`, `obv`, `ichimoku`, `supertrend`, `efficiency_ratio`) defaulting to `false`.
4. THE Sistema SHALL persist a `feature_manifest` (one FeatureEvidence entry per feature) in the event store for every analysis, per Adendo Seção 16.1.

### Requisito 4: Remover derivativos da soma direcional (segundo cérebro de score)

**User Story:** Como responsável de produto, eu quero que derivativos nunca decidam LONG/SHORT, para que a invariante "derivativos nunca escolhem direção" (Adendo 2.3.4) deixe de ser violada pelo motor de score determinístico.

**Nota (Auditoria 2026-07-14):** `ScoringService` tem uma família `derivativos` com peso máximo 28 que soma bull/bear a partir de funding rate e OI, e essa soma **influencia diretamente** o score final/direção (linhas ~359-404, ~514-515). Isto é o problema crítico #3 do Adendo Seção 13.1, e continua presente apesar de o spec irmão `genesis-r3-2-implementacao` já ter removido o *segundo cérebro baseado em Gemini* (`callGemini()`/`buildTradeSetup()`) — são dois problemas distintos; remover um não removeu o outro.

#### Critérios de Aceitação

1. THE ScoringService SHALL NOT include a `derivativos` family (or any derivative-derived value) in the signed sum that determines LONG/SHORT.
2. THE Sistema SHALL implement the family schema from Adendo Seção 21 (`structure` ±30, `trend` ±20, `momentum` ±20, `technical_flow` ±20, `visual_confluence` ±10) as the only families capable of setting direction.
3. WHEN running `grep -RInE "long_short|longShort|LSR" app/Services/GeminiAnalysisService.php app/Services/GeminiTraderClient.php`, THE Sistema SHALL return no matches (Adendo Seção 41).
4. THE Sistema SHALL have a passing `DerivativesDirectionIsolationTest` (Adendo Seção 37.2) proving a maximally negative derivatives modifier cannot flip a LONG conclusion to SHORT.

### Requisito 5: Auditor único de score gráfico (fonte canônica de convicção)

**User Story:** Como responsável de produto, eu quero um único auditor determinístico que calcule convicção a partir das famílias gráficas, para que não existam dois números de score divergentes publicados ao mesmo tempo.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/GraphicalScoreAuditor.php` implementing `audit()` exactly as Adendo Seção 22, computing `signed_sum`, `available_weight`, `coverage`, `alignment`, `base_conviction` per the formula in Adendo Seção 8.3.
2. WHEN a family is marked unavailable in `$familyAvailability` AND its declared score is non-zero, THE GraphicalScoreAuditor SHALL return `ok=false` with an explicit error.
3. WHEN the declared `direction` does not match the sign of `signed_sum`, THE GraphicalScoreAuditor SHALL return `ok=false`; THE Sistema SHALL resend the trader response for correction at most twice before publishing `BLOQUEADA_ANALISE_INCONSISTENTE` (Adendo Seção 22, post-code note).
4. WHEN `coverage < 0.50`, THE Sistema SHALL still publish a direction but SHALL set `execution_coverage_ok=false`, blocking execution.
5. THE GraphicalScoreAuditor SHALL be the only source of the publicly returned conviction number; THE Sistema SHALL NOT simultaneously publish `scoreProbabilidade`, `scoreFinal`, `conviccao_modelo`, and `conviction` with different values (Adendo Seção 31.1).

### Requisito 6: Derivativos como modificador de convicção pós-direção

**User Story:** Como trader, eu quero que o contexto de derivativos (funding, OI, basis, liquidações, zonas de liquidez) só ajuste a convicção depois que a direção gráfica já está fechada, para que ele nunca vire critério de escolha de lado.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/DerivativesContextService.php` implementing `evaluate(string $direction, array $data)` exactly as Adendo Seção 23, returning only `REFORCA|ENFRAQUECE|NEUTRO|INDISPONIVEL` classifications.
2. THE DerivativesContextService::evaluate() SHALL clamp its modifier to `±config('genesis_graphical.derivatives_modifier_max', 15)`.
3. THE Sistema SHALL call `DerivativesContextService::evaluate()` only after `GraphicalScoreAuditor::audit()` has produced a pre-audit `direction`, never before.
4. THE Sistema SHALL NOT pass derivatives data into `buildGraphicalDecisionSheet()` or into the `GeminiTraderClient` payload (Adendo Seção 31.1).
5. LSR data SHALL NOT appear anywhere in `DerivativesContextService`'s input or output (Adendo Seção 8.5, "LSR: Proibido no cérebro decisório").

### Requisito 7: Motor canônico de pivôs e estrutura de mercado

**User Story:** Como responsável de produto, eu quero um único serviço de pivôs com dois níveis (local 2+2, estrutural 5+5), para que HH/HL/LH/LL/BOS/CHOCH parem de depender de configurações concorrentes espalhadas por `PivoService`/`FiguraService`/`EstruturaService`/`SinaisService`.

**Nota (Auditoria 2026-07-14):** `MarketStructureService` não existe. `PivoService`/`FiguraService`/`SinaisService` (mencionados no organograma atual do Adendo, Seção 4) recalculam pivôs cada um com seus próprios parâmetros.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/MarketStructureService.php` implementing `analyze()`/`pivots()` exactly as Adendo Seção 19, with local pivots at 2+2 candles and structural pivots at 5+5 candles, both configurable via `config('genesis_graphical.*_pivot_left/right')`.
2. THE MarketStructureService::analyze() SHALL label structural pivots `HH|LH|HL|LL|EQH|EQL|H|L` using ATR-normalized tolerance (`equal_pivot_atr_tolerance`), and SHALL classify overall `structure` as `BULLISH|BEARISH|MIXED` from the last 8 labels.
3. THE MarketStructureService::analyze() SHALL return `status=INSUFFICIENT_HISTORY` WHEN fewer than 30 closed candles or `$atr <= 0` are available, never fabricating pivots from insufficient data.
4. THE Sistema SHALL migrate `PivoService`, `FiguraService`, and `SinaisService` to consume `MarketStructureService`'s output instead of recalculating pivots with their own parameters.
5. THE Sistema SHALL have passing tests proving: HH/HL → `BULLISH`, LH/LL → `BEARISH`, EQH/EQL respect ATR tolerance, BOS fires with structure, CHOCH fires against structure, and no other service recalculates pivots outside this canonical engine (Adendo Seção 37.4).

### Requisito 8: Rompimento, falso rompimento e reteste determinísticos

**User Story:** Como trader, eu quero que rompimento/reteste/falso rompimento só sejam confirmados em candle fechado, calculados sobre um nível conhecido com buffer/tolerância normalizados por ATR, para que a leitura estrutural não dependa de interpretação subjetiva de pavio.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/BreakRetestService.php` implementing `horizontal()`/`projectedLine()` exactly as Adendo Seção 20, using `buffer = max(ATR14 * breakout_atr_buffer, tick_size * 2)` and an analogous `tolerance` for retest.
2. THE BreakRetestService::horizontal() SHALL only confirm `BREAK_UP_CONFIRMED`/`BREAK_DOWN_CONFIRMED`/`FALSE_BREAK_UP`/`FALSE_BREAK_DOWN`/`RETEST_*_CONFIRMED` from closed candles; an open candle SHALL NOT produce a `CONFIRMED` outcome (only `PENDING` upstream, per Adendo Seção 10.3).
3. THE Sistema SHALL have passing tests for: resistance break on closed candle, wick above resistance without close, support break, retest confirmed up/down, false break up/down, open candle not confirming, and LTA/LTB without two anchors returning `VALIDATION_FAILED` (Adendo Seção 37.3).
4. THE Sistema SHALL NOT hardcode a single ATR-buffer parametrization as universal across timeframes; parameters SHALL be versioned in `config('genesis_graphical.*')` and are baseline-only until per-timeframe backtest (Adendo Seção 20, closing note).

### Requisito 9: CVD baseado em série válida por timeframe

**User Story:** Como trader, eu quero que o CVD e sua divergência usem uma série cumulativa derivada dos próprios klines do timeframe analisado, para que o indicador não trate os últimos 1.000 trades como representativos de qualquer timeframe.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/CvdSeriesService.php` implementing `fromKlines()`/`slope()`/`divergence()` exactly as Adendo Seção 25, deriving buy/sell volume from kline index 5 (total volume) and index 9 (taker buy base volume).
2. IF the aggressor-imbalance data is sourced from `aggTrades`, THEN THE Sistema SHALL name that field `aggressor_imbalance_ratio`, never `book_imbalance_ratio` (Adendo Seção 13.3.4, Seção 25 closing note).
3. THE CvdSeriesService::divergence() SHALL compare CVD at the last two same-type pivots (from `MarketStructureService`, Requisito 7) and SHALL return `UNAVAILABLE` WHEN fewer than 2 pivots exist, never inferring a divergence from a single point.

### Requisito 10: Fibo somente desenhada e validada

**User Story:** Como trader, eu quero que a Fibonacci só participe da leitura quando estiver desenhada no gráfico e com âncoras confirmadas contra candles reais, para que nenhuma Fibo automática contamine a direção ou os alvos.

**Nota (Auditoria 2026-07-14):** `SinaisService::fib()` existe; nenhuma chamada ativa foi encontrada no restante do código durante a auditoria — provável código órfão, mas precisa de confirmação e teste de call-graph antes de remover.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/VisualFiboValidator.php` implementing `validate()` exactly as Adendo Seção 26, requiring exactly 2 numeric anchors, snapping each to the nearest candle extreme within `atr * 0.25`, and returning `NOT_VISIBLE`/`VALIDATION_FAILED` on any failure.
2. THE Sistema SHALL remove all call sites of `SinaisService::fib()`; the method MAY remain temporarily as dead legacy code, but a test SHALL assert it never appears in the graphical brain call graph.
3. THE Sistema SHALL have passing tests for: absent Fibo not participating, single-anchor failure, anchors without timestamp failing, an anchor far from any high/low failing, and two valid anchors recalculating levels correctly (Adendo Seção 37.5).
4. THE Fibo family score in `visual_confluence` SHALL only be non-zero WHEN `VisualFiboValidator::validate()` returns `status=OK`.

### Requisito 11: Correção do viés das cunhas e validação de figuras

**User Story:** Como trader, eu quero que o catálogo visual de figuras use o viés correto para cunhas e que figuras invalidadas nunca votem, para que a confluência visual não conte um fato geometricamente errado.

**Nota (Auditoria 2026-07-14) — DECISÃO PENDENTE:** `GenesisVisualCatalog::VIES` atual tem `CUNHA_DESCENDENTE => 'baixa'`, `CUNHA_ASCENDENTE => 'alta'`. O Adendo pede o oposto: `CUNHA_DESCENDENTE => 'alta'`, `CUNHA_ASCENDENTE => 'baixa'`. Antes de aplicar a troca, é preciso confirmar com o responsável de produto qual convenção é a correta — inverter às cegas pode publicar viés errado em produção se o código atual já estiver certo e for o Adendo que está equivocado (ou vice-versa).

#### Critérios de Aceitação

1. THE Sistema SHALL NOT change `GenesisVisualCatalog::VIES['CUNHA_DESCENDENTE']`/`['CUNHA_ASCENDENTE']` until the product owner explicitly confirms which mapping is correct.
2. WHEN the correct mapping is confirmed, THE Sistema SHALL update `GenesisVisualCatalog.php` accordingly and SHALL add a regression test pinning the confirmed values.
3. THE Sistema SHALL ensure a figure only reaches `CONFIRMED` when geometry, minimum touch count, time-separated points, required prior trend, and correct-edge break on a closed candle are all satisfied (Adendo Seção 11.2) — a figure named by OCR without sufficient lines/pivots SHALL NOT participate in direction.
4. THE Sistema SHALL reject (not degrade) an invalid figure's vote; THE Sistema SHALL have a passing test proving an invalid figure contributes zero to `visual_confluence` (Adendo item 16 of Seção 40).

### Requisito 12: Schema direcional e prompt do trader sem derivativos

**User Story:** Como desenvolvedor, eu quero que o schema JSON e o prompt enviados ao Gemini não contenham nenhum campo de derivativos, para que a IA decisória nunca receba um caminho de desempate baseado em dados que o Adendo proíbe.

#### Critérios de Aceitação

1. THE Sistema SHALL replace `TraderSchema::gemini()` with the schema from Adendo Seção 21, requiring `direction`, `family_scores` (the 5 families only), `score_justification`, `technical_analysis`, `thesis_invalidation`, `score_context`.
2. THE Sistema SHALL replace the trader's decision prompt with the text from Adendo Seção 24, verbatim in UTF-8 Portuguese, including the 15 numbered rules.
3. THE GeminiTraderClient::call() payload SHALL NOT contain any key related to derivatives, macro, or sentiment.
4. THE Sistema SHALL have a passing test asserting the schema's `additionalProperties: false` rejects any payload containing a `derivativos`/`funding`/`open_interest` key at the top or `family_scores` level.

### Requisito 13: OCR 1 e OCR 2 separados e com contrato estrito

**User Story:** Como membro, eu quero que o reconhecimento de metadados (par/timeframe/corretora/mercado) aconteça antes e independente da leitura visual, para que a análise nunca assuma "Binance" ou "4h" quando o OCR não teve certeza.

**Nota (Auditoria 2026-07-14):** frontend com `services/geminiService.ts`/`components/AnalysisResult.tsx` não está em `genesis-api` — confirmar em qual checkout do repositório frontend (provavelmente este repositório, já trabalhado pelo spec `genesis-r3-2-implementacao`) essas seções 28/32/33 do Adendo devem ser aplicadas antes de iniciar a Fase P3 de frontend.

#### Critérios de Aceitação

1. THE Sistema SHALL implement `scanChartMetadata()` per Adendo Seção 28, returning `StrictChartMetadata` and throwing WHEN `symbol`/`timeframe`/`exchange` are missing, `market` is not `SPOT|FUTURES`, or `confidence < 0.85`.
2. THE Sistema SHALL remove every default fallback (`|| 'Binance'`, `|| '4h'`, `|| 'BTCUSDT'`, `|| '1D'`) from the metadata OCR path; `grep "\|\| 'Binance'\|\|\| '4h'\|\|\| '1D'\|\|\| 'BTCUSDT'"` across `services/pages/components` SHALL return empty.
3. THE Sistema SHALL replace `IAGatewayController::scangraph()`'s prompt with the metadata-only prompt from Adendo Seção 29, validated by the Laravel rules listed there (regex on symbol, `min:0.85` confidence).
4. THE Sistema SHALL implement OCR 2's strict JSON contract from Adendo Seção 30, and OCR 2 SHALL NOT return `exchange`, `symbol`, `timeframe`, or any locked mathematical indicator.
5. IF a user manually overrides the exchange detected by OCR 1, THEN THE Sistema SHALL record the origin as `USER_CONFIRMED` and require explicit UI confirmation.

### Requisito 14: Integração da folha de decisão gráfica

**User Story:** Como desenvolvedor, eu quero um único ponto de montagem da folha gráfica que orquestre indicadores, estrutura, CVD, suplementares e evidência visual antes de chamar o trader, para que a ordem de chamadas do Adendo Seção 31 seja respeitada e nada decisório escape do pré-auditor.

#### Critérios de Aceitação

1. THE GeminiAnalysisService::analisar() SHALL call, in order: `getCandlesStrict()` → indicators → `MarketStructureService::analyze()` → `CvdSeriesService::fromKlines()` → `SupplementalIndicatorsService::calculate()` → visual extraction/validation → `buildGraphicalDecisionSheet()` → `GeminiTraderClient::call()` → pre-audit (modifier=0) → `DerivativesContextService::evaluate()` → final audit (Adendo Seção 31 code block).
2. WHEN the pre-audit (`GraphicalScoreAuditor::audit()` with `derivativesModifier=0`) returns `ok=false`, THE Sistema SHALL throw `GRAPHICAL_ANALYSIS_INCONSISTENT` and SHALL NOT proceed to evaluate derivatives context.
3. THE Sistema SHALL persist `feature_manifest` from `buildGraphicalDecisionSheet()` in the event store per Requisito 3.4.
4. THE public response's `analysis` block SHALL expose exactly the fields listed in Adendo Seção 31 (`direction`, `status`, `base_conviction`, `conviction`, `coverage`, `family_scores`, `score_justification`, `technical_analysis`, `score_context`, `thesis_invalidation`), with `derivatives_context` and `feature_manifest` as sibling top-level keys.

### Requisito 15: Interface sem repetição de narrativa (frontend)

**User Story:** Como membro, eu quero que a justificativa do score e a análise técnica apareçam uma única vez cada, com textos diferentes, para que eu não veja a mesma narrativa duplicada em dois blocos da tela.

**Nota:** aplica-se ao mesmo `AnalysisResult.tsx` já parcialmente reescrito pelo spec `genesis-r3-2-implementacao` (Requisito 15 daquele spec) — este requisito estende esse trabalho para o contrato gráfico específico do Adendo, não o substitui.

#### Critérios de Aceitação

1. THE AnalysisResult.tsx SHALL read `scoreJustification = analysis.score_justification ?? analysis.justificativa_score ?? null` and `technicalAnalysis = analysis.technical_analysis ?? analysis.narrativa_tecnica ?? null` per Adendo Seção 32, never falling back to `execution.motivo` for the score justification.
2. THE AnalysisResult.tsx SHALL render `score_context.limitations` and `score_context.required_confirmation` in the low-conviction warning block, SHALL NOT repeat `scoreJustification` there.
3. THE types.ts SHALL add `GraphicalFamilyScores`, `GraphicalScoreContext`, `DerivativesContext`, `GraphicalAnalysis` exactly as Adendo Seção 33.
4. THE Sistema SHALL have a passing test asserting `scoreJustification` and `technicalAnalysis` are never equal for the same analysis payload (Adendo Seção 37.6).

### Requisito 16: Persistência canônica sem defaults e sem campos legados

**User Story:** Como desenvolvedor, eu quero que a persistência de uma análise nunca assuma `BINANCE` nem leia campos de resposta legados, para que o histórico reflita fielmente exchange/market validados pelo OCR 1.

#### Critérios de Aceitação

1. THE IAGatewayController::analyze() SHALL persist `corretora`/`market` from the validated OCR 1 output, never a hardcoded `BINANCE` default.
2. THE Sistema SHALL read `$analysis['conviction']`/`$analysis['direction']`/`$analysis['technical_analysis']` (canonical contract) instead of legacy fields (`scoreProbabilidade`, `direcaoProvavel`, `analiseTecnica`, `entradaSugerida`) per Adendo Seção 34.
3. THE Sistema SHALL serialize every response with `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES` and `Content-Type: application/json; charset=UTF-8` (Adendo Seção 35.1); THE Sistema SHALL NOT call `utf8_encode()`/`utf8_decode()` on model-returned content.

### Requisito 17: Gate de qualidade textual (UTF-8 e vocabulário)

**User Story:** Como responsável de produto, eu quero um gate automático que rejeite mojibake, texto sem acentuação e vocabulário proibido, para que nenhum texto público saia fora do padrão de trader em português do Brasil.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/TextQualityGate.php` implementing `validate()` exactly as Adendo Seção 35.2, checking UTF-8 validity, mojibake patterns, missing-accent heuristics, and forbidden vocabulary (`linha horizontal`, `linha vertical`, `fibonacci`).
2. WHEN `TextQualityGate::validate()` fails, THE Sistema SHALL allow exactly one regeneration attempt using the same facts (no recalculation); WHEN it fails again, THE Sistema SHALL publish `TEXT_QUALITY_FAILED` and SHALL NOT substitute the text with another field's content.

### Requisito 18: Indicadores suplementares em shadow mode

**User Story:** Como responsável de produto, eu quero VWAP/CMF/OBV/Ichimoku/Supertrend/Efficiency Ratio calculados e logados sem peso decisório, para que eu possa avaliar ganho real antes de promovê-los.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/SupplementalIndicatorsService.php` implementing `calculate()` exactly as Adendo Seção 27, computing `vwap`, `cmf20`, `obv`, `efficiency_ratio_10`, `ichimoku`, `supertrend`.
2. WHILE the corresponding `config('genesis_graphical.features.*')` flag is `false`, THE Sistema SHALL ensure no supplemental indicator value alters `family_scores` or `direction`.
3. THE Sistema SHALL compare supplemental indicator output against an independent technical library and fixed fixtures BEFORE any flag is flipped to `true` (Adendo Seção 27 closing note).
4. No item from the Adendo Seção 6.3 shadow-mode table (HH/HL/LH/LL, EQH/EQL, BOS/CHOCH, break/retest/false-break, VWAP, CMF, OBV, Ichimoku, Supertrend, Efficiency Ratio, drawn Fibo, LuxAlgo/SMC, Supply/Demand, OB/FVG, Liquidity Pool/Sweep) SHALL receive non-zero weight without a CONTROL vs CANDIDATE comparison, ablation, golden cases, and prospective shadow run.

### Requisito 19: Conexão dos serviços incrementais já existentes

**User Story:** Como responsável de produto, eu quero que `DataFreshnessGate`, `TradeFlowService`, `DerivativesEnrichmentService` e o book WebSocket sejam conectados ao fluxo real quando houver dados válidos, para que o trabalho já construído pelo spec irmão não fique isolado sem uso.

**Nota (cruzamento com `genesis-r3-2-implementacao`):** `DataFreshnessGate` **não foi criado** (task 8.1 daquele spec, pendente). `RegimeService` e `FeaturePolicy` já estão conectados. `DerivativesEnrichmentService` e `TradeFlowService` existem mas **não estão conectados** — faltam mark/index price e o stream de trades, respectivamente. `BinancePublicStreamService` não existe; aquele spec registra isso como bloqueado por decisão de infraestrutura (biblioteca WebSocket ainda não escolhida) pendente de decisão explícita do usuário.

#### Critérios de Aceitação

1. THE Sistema SHALL create `app/Services/DataFreshnessGate.php` (Adendo Seção 36.1) and SHALL call `avaliar()` before assembling the graphical decision sheet, excluding `STALE`/`SEQUENCE_GAP` sources from evidence.
2. THE Sistema SHALL connect `TradeFlowService` only WHEN trades carry timestamp, price, quantity, and aggressor; for `1d`/`1w` timeframes, the instantaneous flow SHALL NOT outweigh timeframe structure.
3. THE Sistema SHALL connect `DerivativesEnrichmentService` only after `mark_price` and `index_price` are collected upstream; basis SHALL remain `UNAVAILABLE` (never zero) when either is missing.
4. THE Sistema SHALL NOT promote REST order book data to a vote until `BinancePublicStreamService` exists with sequence validation, timestamp, resync, and health check (Adendo Seção 36.4) — this sub-item requires an explicit infrastructure decision (WebSocket client library, long-running worker process) before implementation, consistent with the open gap already flagged in `genesis-r3-2-implementacao`.
5. THE Sistema SHALL generate the same `experiment_group_id` for CONTROL and CANDIDATE analyses of the same symbol/timeframe/image-hash/`as_of`.

### Requisito 20: Testes de propriedade e regressão obrigatórios

**User Story:** Como desenvolvedor, eu quero as propriedades do Adendo Seção 37 cobertas por teste, para que regressões de invariante sejam pegas automaticamente, não descobertas em produção.

#### Critérios de Aceitação

1. THE Sistema SHALL have passing tests for every sub-item of Adendo Seções 37.1–37.7 (locked indicators, derivatives isolation, break/retest, structure, Fibo, text/frontend, origin/freshness).
2. WHEN `php artisan test` runs, THE Sistema SHALL report all graphical-brain tests passing on the same commit hash used for any proof package.

### Requisito 21: Prova real e protocolo de aceite (POL/APT/MYX)

**User Story:** Como responsável de produto, eu quero reanálises reais de POL, APT e MYX com o pacote de artefatos completo, para decidir formalmente se o cérebro gráfico sai do shadow mode.

#### Critérios de Aceitação

1. THE Sistema SHALL reanalyze POL and prove: direction follows the graphical family sum, derivatives cannot flip a positive graphical sum to SHORT, upper resistance/EMA200 limit conviction without auto-inverting short-term structure, and the score explains why conviction is low/moderate (Adendo Seção 38.1).
2. THE Sistema SHALL reanalyze APT and prove: seller structure below EMAs, support proximity reduces conviction and can block execution, score and technical analysis use different texts, correct accentuation, no unvalidated Fibo (Adendo Seção 38.2).
3. THE Sistema SHALL reanalyze MYX and prove: absence of prior public analysis does not authorize an invented expectation, structure/support/LTB/indicators are processed with origin logging, illegible visual items are excluded (Adendo Seção 38.3).
4. THE Sistema SHALL produce, per case, all 14 artifacts listed in Adendo Seção 38.4 (`input.png` through `log.jsonl`).
5. THE Sistema SHALL evaluate all applicable items of Adendo Seção 40 (36 binary acceptance criteria) with no partial verdict, and SHALL keep `GENESIS_GRAPHICAL_SHADOW_MODE=true` until every item is `APROVADO`.

---

## Seção opcional (avaliação futura do usuário) — Saneamento de legado, histórico e caches

**Esta seção fica deliberadamente por último e fora da ordem de execução P0–P5. Não iniciar nenhuma tarefa aqui sem autorização explícita do usuário — inclui migration em `genesis_analises`/`genesis_analysis_events` e um comando que arquiva registros em massa.** Corresponde à Seção 43 do Adendo.

### Requisito OPC-1: Segregação de histórico legado sem destruição de auditoria

**User Story:** Como responsável de produto, eu quero (quando decidido) que análises anteriores ao contrato R3.2 saiam do histórico atual sem serem apagadas, para auditar o passado sem contaminar o cérebro novo.

#### Critérios de Aceitação (avaliar antes de implementar)

1. IF the user authorizes this section, THEN THE Sistema SHALL create the migration adding `analysis_id`, `analysis_contract_version`, `record_status`, `direction_eligible`, `visible_in_current_history`, `invalidated_at`, `invalidation_reason` to `genesis_analises` and `decision_eligible`/`contract_status`/`invalidated_at`/`invalidation_reason` to `genesis_analysis_events`, per Adendo Seção 43.5.
2. THE Sistema SHALL NOT execute `TRUNCATE`, `DROP TABLE`, `FLUSHALL`, `FLUSHDB`, `Cache::flush()`, or `php artisan cache:clear` as a generic solution; cache purge SHALL be limited to the two explicit prefixes in Adendo Seção 43.9 (`app:gemini:visuais:`, `app:binance:candles_r:`).
3. THE `genesis:graph:sanitize-legacy` command SHALL default to dry-run (count-only) and SHALL require `--apply`, `--backup-ref`, and an explicit `--cutover` before mutating any row, per Adendo Seção 43.8.
4. THE Sistema SHALL preserve `genesis_analysis_events` snapshots (`facts_snapshot`, `trader_response`, `audit_snapshot`, `public_response`) immutably; sanitization marks `decision_eligible=false`, it never rewrites snapshot content.
5. THE Sistema SHALL NOT send any legacy analysis (direction, score, narrative, setup, outcome) to the Gemini trader prompt; THE Sistema SHALL have a passing `test_prompt_nao_contem_historico_legado`-equivalent test per Adendo Seção 43.10.

**Antes de qualquer trabalho aqui: gerar backup verificável do banco e obter autorização explícita, por linha, do usuário — este requisito toca dados de produção de forma irreversível sem o backup.**
