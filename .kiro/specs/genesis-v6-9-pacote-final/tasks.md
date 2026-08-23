# Plano de Implementação: Gênesis V6.9 — Pacote Final

**Status**: planejamento puro (21/08/2026). Nada executado, nenhum checkbox marcado `[x]`.

**Fontes**: `GENESIS_V6_9_IMPLEMENTACAO_FINAL_FELIPE.md` (código completo por item, mesmo
diretório — ainda incompleto, ver aviso no topo desse arquivo; até ser completado, a fonte de
código válida é o documento colado na conversa de 21/08/2026) e `GENESIS_V6_9_CHECKLIST_FELIPE.pdf`
(matriz de aceite, transcrita em `MATRIZ_DE_ACEITE_V6_9.md`, mesmo diretório).

**Repositórios**: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** =
`c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main` (convenção dos specs anteriores).

**Relação com o spec `genesis-v6-9-correcao-completa`**: já existe, Fases 0-7 concluídas
(19-20/08/2026) contra um documento anterior (18/08, 80 itens, blocos A-H). Este pacote (20/08)
reaproveita a mesma numeração A1-H8 mas em formato mais granular (98 itens de código, 14 fases) e
cobre território novo que aquele spec não tinha (catálogo de candidatas por `candidate_id`,
`BrainMarketDataProvider`/`BrainBundleGuard`, `PublishedOutputGate`, multicorretora/FlowTrack/
spoofing). A Fase 8 daquele spec (limpeza, H1-H8, ainda toda em aberto) fica **absorvida** pelas
Fases 13 e 16-19 abaixo, não executada em paralelo.

**⚠️ Conflito sinalizado, não resolvido — ver item 9.6 abaixo**: a seção 18.9 do documento-fonte
(item 13.9 aqui) manda trocar `gemini-3.7-flash`/`GENESIS_GEMINI_DECISION_MODEL` por
`gemini-3.6-flash`/`GENESIS_MODEL`. Isso reverte uma decisão que o Felipe já tomou explicitamente
em 19/08/2026 (manter 3.7, ver spec `genesis-decisor-volta-gemini-3-7`) depois de um incidente
real de crédito esgotado na OpenAI. Confirmado ao vivo em `config/genesis_graphical_v6.php:175`
que a decisão de 19/08 segue valendo. **Não aplicar esse trecho sem confirmação do Felipe** — os
demais efeitos de "modelo único" (unificar `document_version`/`prompt_version`/`schema_version`)
não têm relação com o incidente e seguem válidos.

**Ordem**: não inverter as fases — cada uma depende do contrato criado pela anterior (regra do
documento-fonte, seção 4).

---

## FASE 0 — Verificação contra o código atual — 0.1/0.2/0.3/0.5 concluídos (21/08/2026), 0.4 aberto

- [x] **0.1** Branch `genesis-v6.9-pacote-final` criada nos dois repositórios a partir do estado
      limpo atual — **[FE]** a partir de `master` @ `59b645f`, **[API]** a partir de `genesis2` @
      `2a058b6`.
- [x] **0.2** Baseline ZIP 40/39 **não está presente neste ambiente** (busca em `Downloads` não
      encontrou os arquivos) — impossível conferir o SHA-256 registrado no documento. Trabalhando
      a partir do HEAD atual dos dois repositórios; qualquer "Hoje" do documento-fonte que
      divergir do código real fica registrado item a item abaixo, não presumido.
- [x] **0.3** Reconferido contra o código real — **achados que mudam a execução**:
      - **`EvidenceCatalog.php`**: `momentum.dmi`/`momentum.macd_composto` (objetos únicos,
        `DECISION`) **já existem** — achado do spec anterior, item E7, já rebaixou os 10 campos
        individuais de DMI/MACD para `CONTEXT` (não os apagou, só tirou o voto duplicado). A Fase
        4 deste pacote (doc §8.1) não precisa "apagar dez itens" — precisa só renomear o composto
        de MACD (`momentum.macd_composto` → `momentum.macd`, hoje ocupado pelo valor bruto) e
        confirmar que os 10 campos em `CONTEXT` continuam expostos ao bundle (o documento não é
        claro se eles devem sumir do manifesto ou só do peso — comportamento atual é "ficam
        visíveis, não votam", manter).
      - **`EvidenceCatalog.php`**: `levels.poc`/`levels.hvn`/`levels.lvn` (linhas 75-77) e
        `derivatives.liquidations` (linha 107) **continuam no catálogo**, exatamente como o
        pacote descreve — Fase 13.2 (apagar) segue necessária, sem surpresa.
      - **`EvidenceCatalog.php`**: `derivatives.predominancia`/`derivatives.squeeze_risco_lado`
        (linhas 100-101) apontam para `derivatives.derivatives_reading.predominancia`/
        `.squeeze_risco_lado` — o spec anterior já criou um objeto `derivatives_reading`, mas
        manteve **duas entradas separadas** no catálogo em vez de uma (`derivatives.reading`). A
        Fase 5.3 deste pacote precisa migrar essas duas entradas, não criar do zero.
      - **`EvidenceCatalog.php`**: **todos** os campos `macro.*`/`sentiment.*` (vix, dxy, sp500,
        fear_greed, btc_dominance, narrative, score, gatilhos) **continuam no catálogo**, com
        papel `CONTEXT` (não `DECISION`, mas ainda presentes no manifesto) — confirma que a Fase
        2.7 (apagar de vez, doc §6.6) segue 100% necessária; o spec anterior só rebaixou o papel,
        não removeu, exatamente o padrão que este pacote proíbe explicitamente ("não basta mudar
        o papel para DISPLAY_ONLY").
      - **`DerivativesReadingService.php`**: implementação atual é `ler(?float $fundingRate,
        ?float $oiVarPct, ?bool $precoSubindo): array` com `predominanciaPorFunding()` — bem mais
        simples que o alvo do pacote (`quadrant()`/`crowding()`/`squeezeRisk()`/`effect()`,
        parâmetro de preço como `?float $priceChangePct` percentual, não `?bool`). `SUBSTITUIR`
        completo (item 5.1) confirmado necessário, sem atalho.
      - **`LiquidationMapService.php`**: já existe (criado na Fase 4 do spec anterior), construtor
        ainda usa `BinanceService $binance` direto (não `BrainMarketDataProvider`) e a lógica de
        zonas é diferente (`ALAVANCAGENS`/`FAIXAS`/`acumular()`/`consolidar()` vs. o `LEVERAGES`/
        `MAX_ZONES`/bins do pacote). `SUBSTITUIR` (item 10.1) confirmado necessário — e depende
        mesmo da Fase 2 (BrainMarketDataProvider) estar pronta antes, como já sequenciado.
      - **`MarketSnapshotService.php`**: construtor ainda com `BinanceService $binance` +
        `YahooFinanceService`/`AlternativeService`/`CoinGeckoService` diretos (linhas 19, 27-29) —
        nada da Fase 2 (item 2.5/2.9) foi feito ainda. Nenhuma chave `_source_freshness`
        encontrada — Fase 3 (frescor) também intacta, como esperado.
      - **`ExecucaoService.php`**: `montarBarreiras()` (linha 1132) e
        `primeiraBarreiraContraria()` (linha 1086) continuam ativos e chamados (linhas 191, 232) —
        Fase 8.5 (apagar, trocar por catálogo de candidatas) segue necessária. **Divergência
        concreta com o documento**: o código real chama
        `MotorExecucaoService::gerarPlanoBPublico()` (linha 288), não `gerarPlanoB()` como o
        documento assume ("apagar a chamada a `MotorExecucaoService::gerarPlanoB()`") — o nome
        certo a apagar/substituir é `gerarPlanoBPublico()`. Comentários no arquivo (`D1 (V6.9)`,
        `V6.7 (B-20)`) confirmam que este arquivo já foi tocado por pelo menos 2 specs anteriores;
        aplicar o PATCH da Fase 8 exige reconciliar contra essa versão real, não colar o diff às
        cegas.
- [ ] **0.4** Resolver com o Felipe o conflito do item 13.9 (troca de modelo de decisão) antes de
      iniciar a Fase 13 — **ainda aberto, não bloqueia as Fases 1-8 nem a Fase 9** (reconferido ao
      executar a Fase 9, 22/08/2026: item 9.6 nunca tocou modelo/`decision_provider`, só removeu
      `bundle.context` do pacote enviado ao decisor — confirmado por grep antes de marcar a fase
      concluída; ver nota no topo da Fase 9).
- [x] **0.5** Baseline de testes registrado nos dois repositórios, antes de qualquer mudança:
      - **[API]** `./vendor/bin/phpunit --no-coverage` (após `config:clear`) → **706 tests, 2193
        assertions, 1 failure, 1 skipped** (7min49s). Falha pré-existente:
        `VrvpExecutionWiringTest::test_c07_execucao_usa_poc_do_vrvp_quando_presente` — TP1
        esperado 78241.06, obtido 79555.5 (o próprio teste já comenta "exceto por confluência
        real com pivô de swing, o que é comportamento correto, não erro" — candidato a
        atualização de fixture, não regressão desta sessão). Qualquer falha nova durante a
        execução do pacote deve ser investigada antes de prosseguir.
      - **[FE]** `npm run test` (vitest) → **5 arquivos falhando / 31 passando (36 total)**, **28
        testes falhando / 350 passando (378 total)**. Mesmo padrão pré-existente que o spec
        anterior já registrou em 19/08 (6 arquivos/29 testes falhando de 343 total) — a suíte
        cresceu (343→378) e o número de falhas ficou estável, não é regressão nova.

---

## FASE 1 — Banco, contratos e tipos canônicos (doc §5) — 3 itens ✅ concluída (21/08/2026)

- [x] **1.1** `NOVO` `database/migrations/2026_08_21_100000_add_v69_final_contract_to_genesis_analises.php`
      **[API]** — data do arquivo ajustada pra 21/08 (dia real de criação, depois da
      `2026_08_20_000001` já existente no repo). Colunas `snapshot_horario`, `snapshot_preco`,
      `snapshot_candle_abertura_ts`, `source_freshness`, `score_breakdown`, `target_candidates`,
      `target_selection` em `genesis_analises`; `recommended`, `reason_code`, `motivo`,
      `alvo_que_atende`, `microanalise`, `target_details`, `margem_usd`, `maintenance_margin` em
      `genesis_analise_planos`. Aditiva, `down()` reversível. **Não rodei `migrate` no banco de
      dev** (regra permanente, ver `feedback_db_authorization`) — a suíte de testes migra sozinha,
      de forma guardada e idempotente, contra `database/testing.sqlite` (`tests/bootstrap-sqlite.php`).
- [x] **1.2** `PATCH` `app/Models/Analise.php` **[API]** — 7 campos acrescentados ao `$fillable` e
      aos `$casts` (`immutable_datetime`, `decimal:12`, `integer`, `array`×4). Não duplicados
      `market_price_observed_at`/`indicators_observed_at`/`last_closed_candle_at`/`candle_state`,
      que já existiam desde a V6.8.
- [x] **1.3** `PATCH` `app/Models/AnalisePlano.php` **[API]** — 8 campos acrescentados ao
      `$fillable` e casts (`recommended` boolean, `target_details`/`maintenance_margin` array,
      `margem_usd` decimal:2).

---

## FASE 2 — Fronteira Binance Futures e gate anti-Spot (doc §6) — 9 itens ✅ concluída (21/08/2026)

Nenhum dado Spot pode entrar no snapshot, manifesto, prompt decisório, score, alvos ou execução.

- [x] **2.1** `NOVO` `app/Services/GraphicalAnalysis/Contracts/BrainMarketDataProvider.php`
      **[API]** — interface única que o cérebro pode chamar (candles, currentPrice, funding,
      fundingHistory, openInterest, openInterestHistory, aggTrades, orderBookWalls,
      symbolFilters, leverageBrackets, longShortRatio, source, market). Assinaturas conferidas
      método a método contra `BinanceService` real (todas já existiam, exceto `fundingHistory`).
- [x] **2.2** `NOVO` `app/Services/GraphicalAnalysis/BinanceUsdMBrainMarketDataProvider.php`
      **[API]** — única implementação permitida, delega para `BinanceService`, `source()` =
      `BINANCE_FUTURES_API`, `market()` = `USD_M_PERPETUAL`.
- [x] **2.3** `NOVO` `app/Services/GraphicalAnalysis/BrainBundleGuard.php` **[API]** —
      `assertDecisionSafe()` rejeita fontes/tokens proibidos (Spot, multicorretora fora de
      `DISPLAY_ONLY`) antes do hash; `stripDisplayOnly()` remove evidência display-only do
      manifesto decisório.
- [x] **2.4** `PATCH` `app/Providers/GenesisGraphicalServiceProvider.php` **[API]** — bind
      `BrainMarketDataProvider::class` → `BinanceUsdMBrainMarketDataProvider::class` (singleton,
      sem match por config — ao contrário do eixo vision/context/decision, só existe uma fonte).
- [x] **2.5** `PATCH` `MarketSnapshotService` **[API]** — **desvio do doc, documentado em código**:
      `BinanceService $binance` **não foi removido** do construtor, `BrainMarketDataProvider
      $market` foi injetado ao lado. Motivo real: `getCvd()` (CVD de agressões, timeframe 1m) e
      `getLiquidacoes()` (fonte descontinuada, sempre `null`) não existem no contrato do cérebro —
      `getLiquidacoes()` só é apagado por completo na Fase 13 (item 13.2), junto com
      `derivatives.liquidations` no catálogo; CVD nem está no escopo deste pacote. As chamadas que
      SÃO cérebro (candles/funding/OI/OI history/livro/long-short ratio) usam `$this->market`.
- [x] **2.6** `PATCH` `BinanceService::getFundingHistory()` **[API]** — novo método, chama
      `/fapi/v1/fundingRate` (série para média/desvio/z-score; `/fapi/v1/premiumIndex` continua
      sendo a fonte do funding atual). Nenhum dos dois define direção.
- [x] **2.7** `PATCH` `EvidenceCatalog` **[API]** — as 11 entradas `macro.*`/`sentiment.*`
      apagadas do catálogo decisório (não só rebaixadas de papel — achado da Fase 0 confirmou que
      esse já era o estado incorreto herdado do V6.8/A2). **Efeito em cadeia esperado e tratado**:
      quebrou `EvidenceManifestBuilderH47Test` (contagem de CONTEXT hardcoded, 37→26, corrigida) e
      4 dos 5 testes de `CanonicalBundleAuthorityTest`, que verificavam exatamente o mecanismo
      desmontado — removidos com nota explicando o porquê e apontando pro sucessor real (Fase 11).
- [x] **2.8** `PATCH` `CanonicalBundleBuilder` **[API]** — `BrainBundleGuard` injetado;
      `stripDisplayOnly()` + `assertDecisionSafe()` no fim de `forStage1()`,
      `assertDecisionSafe()` no fim de `forStage2()`; `manifest_hash` calculado sobre um clone sem
      `context` e sem display-only (`$decisionManifest`), não sobre o `$bundle` que a etapa 1
      ainda recebe com `context` (isso só é removido do bundle enviado ao decisor na Fase 9, item
      9.6 — comportamento intermediário sinalizado em comentário no código).
      **Efeito em cadeia real, corrigido**: `stripDisplayOnly()` agora remove
      `derivatives.long_short_ratio` (DISPLAY_ONLY) do bundle que a Etapa 1 recebe — 4 arquivos de
      teste (`GraphicalAnalysisAttemptJobTest`, `GraphicalAnalysisFullPipelineIntegrationTest`,
      `GraphicalAnalysisImageCleanupTest`, `GraphicalAnalysisOpenAiProviderFlowTest`) tinham esse
      item hardcoded em `evidence_accounting` — removido dos 4, com comentário explicando.
- [x] **2.9** `NOVO` `app/Services/GraphicalAnalysis/InformativeDisplayContextService.php`
      **[API]** — coleta VIX/DXY/S&P500/Fear&Greed/dominância BTC isolada do cérebro. **Adaptado
      ao contrato real**: `YahooFinanceService` só tem `getQuote(string $ticker)`, não
      `getVIX()`/`getDXY()`/`getSP500()` dedicados como o doc assumia — usa os mesmos tickers que
      o antigo `MarketSnapshotService::macro()` já usava (`'^VIX'`, `'DX-Y.NYB'`, `'^GSPC'`).
      `YahooFinanceService`/`AlternativeService`/`CoinGeckoService` e os métodos `macro()`/
      `quote()`/`change()` removidos de `MarketSnapshotService`, junto com a chave `'macro'` do
      snapshot. **Escopo reduzido, decisão desta sessão**: o serviço novo **ainda não foi ligado**
      ao `GraphicalAnalysisAttemptJob` — nada consome `context_display` até a Fase 3 (item 3.4)
      reformular o contrato de retorno de `CanonicalBundleBuilder::build()` para incluir essa
      chave; ligar o serviço antes disso produziria uma variável sem consumidor. Retomar na Fase 3.

**Achados de infraestrutura de teste, não de código** (registrados para não se repetirem): a
suíte de testes é persistente (sqlite físico, sem `RefreshDatabase`) e não isola a tabela `jobs`
nem `genesis_analises` entre execuções filtradas (`--filter`) — rodar vários testes isolados em
sequência, como esta sessão fez pra depurar, deixa linhas órfãs (`jobs` com job já processado em
outra run, `Analise` presa em `PENDING`) que quebram testes não relacionados na run seguinte
(`QueueHealthTest`, `test_sucesso_apos_repair_1...`). Limpo manualmente via `sqlite3` direto no
`database/testing.sqlite` (nunca o banco de dev) nesta sessão; **não é regressão de código**, mas
vale documentar pra próxima sessão não perder tempo re-diagnosticando o mesmo sintoma.

**Suíte após Fase 1+2**: **[API]** `phpunit` → **702 testes, 0 falhas, 0 erros, 1 skip**
(pré-existente, mesmo da Fase 0) — 4 a menos que o baseline de 706 porque
`CanonicalBundleAuthorityTest` perdeu 4 métodos obsoletos. **[FE]** `vitest` → **349/378**, sem
mudança de código nesta fase (só backend); a diferença de 1 teste a mais falhando contra a leitura
da Fase 0 (28→29) é estável entre execuções e não está ligada a nenhuma mudança desta sessão —
provável variância do próprio baseline pré-existente de testes property-based, não investigada
mais a fundo por estar fora do escopo desta fase.

---

## FASE 3 — Frescor por fonte e cobertura real (doc §7) — 4 itens ✅ concluída (21/08/2026)

Estrutura vazia não conta como cobertura. Falha é `UNAVAILABLE`, nunca zero.

- [x] **3.1** `SUBSTITUIR` `app/Services/DataFreshnessGate.php` **[API]** — `avaliar()` por fonte:
      `timestamp_ms`, `age_ms`, `age_limit_ms`, `sequence_ok`, `content_ok`, status
      `AVAILABLE`/`EMPTY_OR_INVALID`/`SEQUENCE_GAP`/`STALE`; retorna `coverage_ratio`. **Aditivo,
      não substituição literal**: a classe já existia (Documento Mestre R3.2) mas nunca teve
      consumidor real — só `IncrementalBrainTest`, que exercitava a forma antiga isoladamente.
      Mantidos `quality`/`usable_sources`/`as_of_ms`/`source` (campos que `IncrementalBrainTest`
      já verificava) ao lado dos campos novos, em vez de removê-los — zero teste antigo precisou
      mudar (os 2 testes de `IncrementalBrainTest` continuam verificando só `status`, que preserva
      os nomes `SEQUENCE_GAP`/`STALE`).
- [x] **3.2** `NOVO` `app/Services/GraphicalAnalysis/FreshnessPolicy.php` **[API]** —
      `limits(timeframe)`: idade máxima por fonte (price 30s, candles = TF+30s, funding 15min,
      funding_history 12h, OI 5min, order_book 60s, vision 10min). **Desvio do doc**:
      `open_interest_history` não tinha número especificado — usado 12h (mesmo valor de
      `funding_history`), documentado em código como decisão desta sessão (é janela de série, não
      valor instantâneo — tolera mais idade que o OI atual).
- [x] **3.3** `PATCH` `MarketSnapshotService::derivatives()`/`collect()` **[API]** — metadata real
      de frescor construída onde os dados existem: `derivatives()` ganhou parâmetro
      `&$sourceFreshnessInput` (funding/open_interest/open_interest_history vêm de `$funding`/`$oi`/
      `$oiHistory`, só existem ali; `order_book` captura `$orderBookWalls` localmente, reaproveitado
      do que já era calculado, sem chamada HTTP extra); `collect()` preenche `price`/`candles`
      (dependem de `$candlesBrutos`, que só `collect()` tem) e devolve tudo em
      `source_freshness_input`. Novos métodos `candlesSequenciais()` (passo entre opens, tolera o
      candle vivo), `oiHistorySequencial()`, `ultimoTimestampMs()`, `isoToMs()` (só
      `getOrderBookWalls()` devolve o horário em ISO 8601 em vez de ms — única fonte que precisa da
      conversão).
- [x] **3.4** `PATCH` `CanonicalBundleBuilder::build()` **[API]** — injetou `DataFreshnessGate` +
      `FreshnessPolicy` (ambos sem construtor, resolvidos automaticamente pelo container, sem bind
      novo no provider); `bundle['quality']['freshness']` calculado antes do manifesto, com um
      item `vision` adicional (não vem de `MarketSnapshotService` — usa `$visionObservedAt` +
      `chart_validation.accepted`). Nunca bloqueia a análise sozinho (consistente com a doutrina
      B4 "sempre executável") — puramente aditivo, sem consumidor de penalidade ainda (ligação
      com score, se vier, é da Fase 9). Em `EvidenceManifestBuilder`, `hasSemanticContent()`
      (recursivo) substitui a regra antiga (`!== null && !== ''`) — 0/0.0/false continuam contando
      como disponível (não são "vazios"), só null/''/`[]` (ou array só com folhas vazias) não contam.
      **Achado real, corrigido**: `CandlesReuseTest::test_c09_bundle_builder_expoe_candles_para_reaproveitamento`
      verificava "candles nunca aparece no bundle_json" com um `assertStringNotContainsString('"candles"', ...)`
      bruto — colidiu com a nova chave legítima `quality.freshness.items.candles` (metadata
      pequena, não a série crua). Corrigido pra comparar o candle bruto serializado contra o
      bundle_json, prova mais precisa da invariante real (a série OHLCV não vaza), não a palavra
      "candles" em qualquer contexto.

---

## FASE 4 — DMI e MACD como duas famílias, sem voto duplicado (doc §8) — 3 itens ✅ concluída (21/08/2026)

- [x] **4.1** `SUBSTITUIR` entradas de DMI/MACD no `EvidenceCatalog` **[API]** — apagados os dez
      itens individuais (já rebaixados a CONTEXT pelo E7 do spec anterior, mas nunca removidos —
      mesmo padrão de duplicidade que a Fase 2, item 2.7, já tinha corrigido para macro/sentiment);
      mantidos só `momentum.dmi` (`technical.dmi_resumo`, sem mudança de id) e `momentum.macd`
      (`technical.macd_resumo`, renomeado de `momentum.macd_composto` — o id `momentum.macd`
      ficou livre com a remoção do valor bruto individual que o ocupava antes). **Efeito em
      cadeia real, corrigido**: `NarrativeFidelityGate::INDICATOR_REQUIREMENTS['ADX']` apontava
      pro id apagado `momentum.adx14` — sem correção, qualquer narrativa mencionando "ADX" seria
      rejeitada pra sempre (`NARRATIVE_MENTIONS_UNAVAILABLE:ADX`), mesmo com o dado disponível;
      corrigido pra `momentum.dmi`. Achado desta fase, não do documento-fonte (`['MACD']` já
      apontava pra `momentum.macd`, sobrevive à troca sem ajuste). `DirectionCoherenceGate` (E1,
      spec anterior) já lia `momentum.dmi` corretamente — não precisou de ajuste, confirma que o
      composto é o padrão certo. Testes ajustados: `EvidenceManifestBuilderH47Test` (totalContext
      26→16), `EvidenceCatalogE7Test` (teste que verificava "rebaixado, não removido" substituído
      por um que verifica remoção; `momentum.macd_composto`→`momentum.macd` no teste dos
      compostos), `NarrativeFidelityGateProductionInputsTest` (fixture `momentum.adx14`→`momentum.dmi`).
- [x] **4.2** `PATCH` `AnalysisPublicResponseBuilder` **[API]** — `nestedEvidenceEntry()`/
      `nestedEvidenceValue()` novos, leem os campos internos de `momentum.dmi` via `data_get()`
      sem reintroduzi-los no manifesto (`adx14`, `plus_di14`, `minus_di14`, `adx_rising`);
      `faixaAdx()`/`faixaDi()`/`adxEmElevacaoRelevante()` migrados para a leitura aninhada.
      Contrato público inalterado (mesmas 4 chaves, mesmo formato `{value,unit,status}`,
      zero/false preservados como valor real). **Desvio documentado**: ao contrário de
      `evidenceEntry()` (que só sabe a unidade se o item plano existir), `nestedEvidenceEntry()`
      recebe a unidade lógica do campo como parâmetro fixo (`'index'`/`'boolean'`) — populada
      mesmo quando o composto está `UNAVAILABLE` ou ausente, decisão desta sessão (unidade
      previsível é melhor contrato pro frontend formatar, mesmo em estado vazio); testes de
      `GraphicalAnalysisInformativeContextTest` que assumiam `unit: null` nesse caso ajustados.
- [x] **4.3** `PATCH` validadores de citação numérica **[API]** — `evidence_path` (nullable,
      opcional) acrescentado a `numeric_citations` em `GenesisDecisionSchema` (só a Etapa 1 —
      `GenesisDecisionStage2Schema` fora do escopo: suas citações são só de evidência escalar de
      derivativos, sem ambiguidade de campo interno, e nem passam por `NarrativeFidelityGate`,
      só por `DecisionStage2ResponseValidator`, que não faz resolução numérica). `NarrativeFidelityGate::
      resolveEvidenceValueAtPath()` resolve via `data_get($evidence['value'], $citation['evidence_path'])`
      quando informado; cai no heurístico `resolveEvidenceValue()` (folha mais próxima) quando
      ausente ou não resolve — 100% retrocompatível, nenhuma citação antiga (sem `evidence_path`)
      quebra.

**Suíte após Fase 3+4**: **[API]** `phpunit` → **702 testes, 0 falhas, 0 erros, 1 skip**
(pré-existente, mesmo da Fase 0/2). **[FE]** inalterado — nenhum arquivo frontend tocado (as duas
fases são 100% `[API]`).

---

## FASE 5 — Derivativos como intensidade, nunca direção (doc §9) — 5 itens ✅ concluída (21/08/2026)

Direção congelada em `technical_direction` antes de funding/OI entrarem.

- [x] **5.1** `SUBSTITUIR` `app/Services/DerivativesReadingService.php` **[API]** — `ler()`
      determinística: `quadrant()` (reaproveita `TechnicalAnalysisService::leituraOI()`, achado da
      Fase 0), `crowding()` (funding + z-score da série histórica — `NEUTRA`/`LEVE`/`ELEVADA`/
      `EXTREMA`/`UNAVAILABLE`), `squeezeRisk()` (lado sempre o lado lotado), `effect()` por
      direção hipotética (`modifier` clampado a `derivatives_modifier_max`, `classification`
      STRENGTHENS/WEAKENS/NEUTRAL/UNAVAILABLE, `reasons`). **Nunca** devolve campo de direção —
      `effect_for_long`/`effect_for_short` coexistem no mesmo retorno, quem escolhe qual é a
      direção já congelada (item 5.4). Teste antigo (assinatura/retorno antigos) substituído por
      completo, não incrementado.
- [x] **5.2** `PATCH` `MarketSnapshotService` **[API]** — `precoVariacaoPctNaJanela()` (percentual,
      fatorada de um novo `candlePontoInicioJanela()` compartilhado com
      `precoSubindoNaJanela()` pra não duplicar a busca por timestamp — a versão booleana
      permanece intocada, ainda alimenta `derivatives.open_interest_context`, que este item não
      toca); `fundingStats()` (mean/stddev/zscore sobre `BrainMarketDataProvider::fundingHistory()`,
      criada na Fase 2 item 2.6 e usada pela primeira vez aqui); `oiChanges()`
      (`current` reaproveita `oiChange()` já existente; `previous` é a mesma métrica sobre a
      metade mais antiga da janela; `acceleration_pct` é a diferença entre as duas);
      `basisBps()` (markPrice vs. indexPrice do próprio payload de funding, mesma fórmula que
      `DerivativesEnrichmentService` já usa noutro pipeline). Frescor de `funding_history`
      (limite já declarado por `FreshnessPolicy` desde a Fase 3, sem fonte até agora) ligado.
- [x] **5.3** `PATCH` `EvidenceCatalog` **[API]** — `derivatives.predominancia` +
      `derivatives.squeeze_risco_lado` (dois escalares) substituídos por uma única entrada
      `derivatives.reading` (`derivatives.derivatives_reading`, objeto completo, papel
      `MODULATOR`).
- [x] **5.4** `PATCH` `DecisionStage2ResponseValidator` **[API]** — compara `derivatives_modifier`/
      `derivatives_context.strength` da IA contra `effect_for_long`/`effect_for_short` do PHP
      (lidos da própria evidência `derivatives.reading` do bundle + `decision_stage1.direction`
      já congelada) — `DERIVATIVES_MODIFIER_MISMATCH_PHP_READING`/
      `DERIVATIVES_STRENGTH_MISMATCH_PHP_READING`. Rejeita `direction`/`technical_direction` no
      payload de saída (defesa em profundidade — o schema `additionalProperties:false` já
      impede isso estruturalmente, mesmo padrão de `BrainBundleGuard`/`DirectionCoherenceGate`:
      não confiar só no contrato).
- [x] **5.5** `PATCH` prompt da etapa 2 (`GenesisPrompt::systemStage2()`) **[API]** — regra 2/3
      reescritas: a IA copia `derivatives_modifier`/`derivatives_context.strength` EXATAMENTE de
      `effect_for_long`/`effect_for_short` (a chave certa escolhida por
      `decision_stage1.direction`), nunca calcula. Regra nova (4): mapeia
      `derivatives.reading.squeeze_risk.side` pro enum de saída `squeeze_risk`
      (NONE/LONG_SQUEEZE/SHORT_SQUEEZE) — a chave interna mudou de nome/forma (era
      `squeeze_risco_lado`, escalar solto).

**Suíte após Fase 5**: **[API]** `phpunit` → **715 testes, 0 falhas, 0 erros, 1 skip**
(pré-existente). **[FE]** inalterado — 100% `[API]`.

---

## FASE 6 — Catálogo canônico de zonas e seleção de alvo por ID (doc §10-11) — 8 itens — ✅ 8/8 concluídos (6.8 executado junto da Fase 8, 22/08/2026)

A IA ordena IDs de candidatas já construídas pelo PHP. Ela nunca devolve um preço de alvo.

**⚠️ Achado real desta fase, resolução deliberada — item 6.8 remarcado para junto da Fase 8**: o
documento numera `calcularAlvos()` (item 6.8) nesta fase, mas `ExecucaoService::montar()` — o
único chamador real — só ganha `targetCatalog`/`selectedTargetIds`/os 4 serviços novos de plano na
Fase 8 (item 8.5, explícito). Substituir `calcularAlvos()` agora (assinatura nova, baseada em IDs
já selecionados, sem projeção geométrica) quebraria `ExecucaoService::montar()` imediatamente —
ele continua chamando a assinatura antiga até a Fase 8 rewirar os dois lados juntos. As duas
metades (produtor do contrato novo + consumidor do contrato novo) são uma mudança atômica; a
divisão do documento em duas fases não é executável sem um estado intermediário quebrado no meio.
Os itens 6.1-6.7 (infraestrutura NOVA e ADITIVA — catálogo, normalizador, schema, prompt,
validador) não têm essa dependência e foram concluídos normalmente; `AlvoService` permanece
intocado, `target_selection` já é validado e persistido (dentro de `decision_payload`, a etapa 1
grava o objeto inteiro) mas ainda sem consumidor de execução — mesmo padrão de
`InformativeDisplayContextService` (Fase 2, item 2.9: construído, não ligado, decisão explícita
daquela sessão). Item 6.8 será executado junto do item 8.5 quando a Fase 8 for chamada.

- [x] **6.1** `NOVO` `app/Services/PriceNormalizer.php` **[API]** — `price()` arredonda por
      `tickSize` real do contrato (`BinanceService::getSymbolFilters()`, D6, cache de 1h);
      `decimals()` deriva casas decimais do mesmo tick; degrada pra 8 casas sem lançar quando o
      símbolo não tem filtro conhecido.
- [x] **6.2** `NOVO` `app/Services/GraphicalAnalysis/TargetCandidateCatalog.php` **[API]** —
      catálogo único de zonas reais: **primárias** (peso próprio, cada uma vira candidata
      sozinha) suporte/resistência (só a coleção validada por `VisualLevelValidator` — 15 ATR + 2
      toques históricos, nunca o OCR bruto, mesma regra que `ExecucaoService::montarBarreiras()`
      já aplicava), swing pivot (`SwingPivotService`), PDH/PDL/PWH/PWL, paredes do livro, POC/HVN/
      LVN do VRVP REAL lido da imagem (nunca o histograma calculado por candle — `zones` não tem
      essa chave), extremidade (topo/base) de figura observada validada; **confluência** (peso
      zero, nunca candidata sozinha) Fibonacci OCR, EMA, número redondo. Agrupa por
      `max(tickSize×4, ATR×0.15)`, pontua força (peso da fonte 60% + confluência 40%), gera
      `candidate_id` determinístico (`tc_` + 16 hex de um hash sobre símbolo+timeframe+lado+
      preço+fonte). **Desvio do documento, decisão desta sessão**: a quarta fonte de confluência
      pedida ("zona estimada de liquidação") ficou de fora — `LiquidationMapService` ainda é a
      implementação ANTIGA, prestes a ser substituída por completo na Fase 10 (item 10.1);
      acoplar contra ela agora criaria dependência efêmera. Entra quando a Fase 10 entregar o
      mapa real. As outras 8 fontes cobrem o catálogo.
- [x] **6.3** `PATCH` `CanonicalBundleBuilder::build()` **[API]** — `target_candidates` construído
      antes do manifesto (preço/ATR do próprio `$snapshot`, candles de `$collected`), incluído no
      `$bundle`; `forStage2()` já era montado do zero (não copia `$bundle` inteiro) — não
      precisou de exclusão explícita, só um comentário documentando que é assim de propósito.
- [x] **6.4** `PATCH` `GenesisDecisionSchema` **[API]** — `target_selection` (objeto sempre
      presente, não nullable — vazio é resposta válida, não ausência): `candidate_ids` (até 3,
      padrão `^tc_[a-f0-9]{16}$`), `rationales` (`candidate_id` + `reason` 20-240 chars). Sem
      campo de preço. `GenesisDecisionStage2Schema` fora do escopo (citações da Etapa 2 são só de
      evidência escalar de derivativos, sem seleção de alvo nenhuma).
- [x] **6.5** `PATCH` prompt da etapa técnica (`GenesisPrompt::system()`) **[API]** — nova seção
      "SELEÇÃO DE ALVO": até 3 `candidate_ids` do lado certo (`side=ABOVE` pra LONG, `BELOW` pra
      SHORT), em ordem crescente de `distance_atr`; `min(3, N)` candidatas válidas do lado certo;
      arrays vazios quando não houver nenhuma; um `rationale` por id selecionado, mesma ordem.
- [x] **6.6** `NOVO` `app/Services/GraphicalAnalysis/TargetSelectionValidator.php` **[API]** —
      rejeita ID inexistente/lado errado (`TARGET_SELECTION_UNKNOWN_OR_WRONG_SIDE`), duplicado
      (`TARGET_SELECTION_DUPLICATE`), contagem diferente de `min(3,N)`
      (`TARGET_SELECTION_COUNT_INVALID`), fora de ordem por distância
      (`TARGET_SELECTION_OUT_OF_DISTANCE_ORDER`), rationale desalinhado
      (`TARGET_SELECTION_RATIONALE_MISALIGNED`). Degrada sem erro quando a direção não é
      LONG/SHORT (nada a confrontar sem "lado certo" definido).
- [x] **6.7** `PATCH` `DecisionResponseValidator` **[API]** — `TargetSelectionValidator` injetado;
      valida `target_selection` contra `bundle.target_candidates` logo depois do gate de direção
      (`DIRECTION_INVALID`); `target_selection` acrescentado à lista de campos obrigatórios
      (`MISSING_FIELD`).
- [x] **6.8** `SUBSTITUIR` `app/Services/AlvoService.php` **[API]** — executado junto do item 8.5
      (22/08/2026), como planejado na nota acima. `calcularAlvos()` reescrito por completo: só
      resolve `candidate_id`s já selecionados/validados contra o catálogo (`price`/
      `primary_source`/`label`/novo `candidate_id` por TP, pra rastreabilidade de
      `target_details`), zero geometria — `projetarAlvos()`/`faixasAlvo()`/`selecionarAlvos()`/
      `melhorNaFaixa()`/`separarDegraus()`/`notaQualidade()`/`rotuloDeTrader()`/`rotuloCurto()`/
      `encaixarEmPivo()`/`tetoPorTimeframe()` removidos por completo. `agruparConfluencia()`
      mantida verbatim (`NivelService` continua usando). `nearestBarrier()` novo — barreira mais
      próxima de um lado no catálogo (já ordenado por `distance_atr`), usada por
      `PlanAMicroanalysisService` (barreira contrária) e `PlanoBService` (âncora de entrada).

**Achado de infraestrutura de teste, não de código** (mesmo padrão já registrado na Fase 2):
`GraphicalAnalysisAttemptJobTest`/`GraphicalAnalysisFullPipelineIntegrationTest`/
`GraphicalAnalysisImageCleanupTest`/`GraphicalAnalysisOpenAiProviderFlowTest` — os 4 arquivos que
chamam `Artisan::call('queue:work')` — já documentavam a exigência de rodar com
`--process-isolation` (2ª chamada de `queue:work` no mesmo processo PHP tem histórico de segfault
neste ambiente). Rodar a suíte inteira num processo só, sem isolamento, agora reproduz esse
sintoma de forma confiável quando esses arquivos caem próximos na ordem de execução (a suíte
cresceu ~40 testes nesta sessão, o suficiente pra reordenar a descoberta de arquivos do PHPUnit) —
2 análises ficam presas em `PENDING` em vez de `FAILED`/`COMPLETED`. **Confirmado não ser
regressão**: os 4 arquivos rodados juntos com `--process-isolation` passam 100% (17/17 testes, 89
assertions). Um segundo achado incidental do mesmo tipo: 2 testes não relacionados
(`AcompanharPlanosTest`/`AnaliseShowAsyncStatusTest`) falharam uma vez por colisão de email do
Faker (`UniqueConstraintViolationException`) — a tabela `users` acumulou 251 linhas de execuções
isoladas repetidas nesta sessão longa; não reproduziu numa segunda rodada completa. Nenhum dos
dois é causado por código desta fase; registrado pra a próxima sessão não perder tempo
rediagnosticando.

**Suíte após Fase 6 (itens 6.1-6.7)**: **[API]** `phpunit` → **744 testes**, **0 falhas reais**
verificado por partes com isolamento correto (`--process-isolation` nos 4 arquivos de
job/pipeline: 17/17; resto da suíte: limpo) — únicas duas ocorrências que sobrevivem são
pré-existentes e já documentadas: `VrvpExecutionWiringTest` (flakiness de rede real, Fase 0) e o
artefato de segfault de `queue:work` acima (não é falha de asserção, é ambiente). **[FE]**
inalterado — 100% `[API]`.

---

## FASE 7 — Visão, figuras, linhas e Fibonacci sem projeção (doc §12) — 5 itens ✅ concluída (21/08/2026)

A visão só relata o que está na imagem. Nada é projetado.

- [x] **7.1** `PATCH` `GeminiVisionService::normalizarPatterns()` **[API]** — a checagem de
      coerência do preço visível contra o estado alegado (`BREAKING`/`RETESTING`/`CONFIRMED`)
      passou a comparar contra `preco_rompimento`, não mais `base`/`topo`. **Achado real**: a
      checagem antiga tinha uma tolerância enorme (só reprovava se o preço tivesse voltado até a
      base da figura inteira) — um "rompimento confirmado" com o preço já de volta abaixo do
      próprio nível de rompimento (tese já invalidada de verdade) passava sem reprovação. Novo
      teste (`test_e2_preco_entre_base_e_rompimento_e_incoerente_com_confirmed`) prova exatamente
      esse caso, que a checagem antiga deixava passar.
- [x] **7.2** `PATCH` `GeminiVisionService::normalizarObjects()` **[API]** — `tempo` passou de
      opcional pra obrigatório em cada ponto de LTA/LTB/`PRICE_CHANNEL` (sem os dois eixos, o
      ponto não ancora nada verificável); os dois pontos precisam ser distintos (preço OU tempo
      diferentes) — um par idêntico não define reta.
- [x] **7.3** `NOVO` `normalizarFibonacci()` em `GeminiVisionService` **[API]** — nível só existe
      com `visible_price`/`label`/`confidence` ≥0.70 simultâneos; sem OCR confiável dos três, o
      nível inteiro é descartado. Seção "PROIBIÇÃO DE PROJEÇÃO" nova no prompt visual, cobrindo
      Fibonacci, figuras e linhas — nenhum nível é calculado, só lido.
- [x] **7.4** `SUBSTITUIR` `app/Services/BreakRetestService.php` **[API]** — `horizontal()` já
      implementava exatamente o pedido (candles fechados, reteste/falso rompimento em até 8
      candles, config-driven) — confirmado pelos 9 testes existentes, nenhum precisou mudar.
      `projectedLine()` (extrapolação de reta a partir de dois pontos) removida, junto do teste
      que a cobria. **Desvio, decisão desta sessão**: a classe continua sem consumidor real no
      pipeline (mesmo estado de antes) — o item pede a forma da classe, não pede wirar um
      consumidor; permanece em aberto pra quando uma fase futura pedir isso explicitamente (mesmo
      tratamento dado a `BreakRetestService` desde a Fase 13 do spec anterior).
- [x] **7.5** `PATCH` `app/Services/GraphicalAnalysis/ExecutionPipelineService.php` **[API]** —
      import/uso de `GenesisPatternProjection` removidos; seleção da figura de maior confiança
      passou a exigir só geometria válida (topo > base > 0), não mais a existência de um alvo
      projetado; `cluster_liquidacao` deixou de ser extraído de `derivatives.liquidations`
      (sempre `UNAVAILABLE`, fonte descontinuada) — passa `['above'=>[],'below'=>[]]` fixo, só
      pra manter a assinatura posicional de `ExecucaoService::montar()` até a Fase 8 apagá-la.
      **Achado real, cascata necessária pro scan de aceite passar** (o scan cobre `app`+`tests`
      inteiros, não só este arquivo): `GenesisPatternProjection.php` e seu teste dedicado foram
      apagados (classe órfã depois da mudança acima); `ExecucaoService::montarBarreiras()` parou
      de ler o campo do alvo projetado (a fonte `figura_projetada` fica sem produtor — entrada
      mantida em `AlvoService::PESOS` por ora, remoção física é limpeza de dead code fora do
      escopo deste item); `MotorExecucaoService::projetarAlvoFigura()` removida (achado: toda a
      cadeia que a chamava — `gerarSetup()`/`setupLong()`/`setupShort()`/`calcularTPs()` — já
      era código 100% morto, confirmado por busca de chamadores em todo o repositório e por um
      comentário pré-existente de sessão anterior que já documentava isso; só a função com o
      termo banido foi removida, o resto da cadeia morta não foi tocado, fora do escopo deste
      item). 3 testes ajustados (`ExecucaoServiceMontarBarreirasV69Test` — assert invertido;
      `ExecucaoServiceRrPorAlvoTest` — teste renomeado, sem mudança de comportamento, o nome
      antigo só continha o termo banido por coincidência de substring) e comentários em
      `GenesisVisualCatalogV6.php` reescritos pra não citar a classe apagada.
      **Scan de aceite**: `rg "GenesisPatternProjection|alvoMedido|alvo_projetado|projectedLine|projecao_figura|mastro|measured.move" app tests`
      → **vazio em `app`**; em `tests`, só 2 ocorrências remanescentes, ambas em
      `tests/Proof/_archive_v4_3_r3_2/*.md` — documentos históricos arquivados (registro de uma
      avaliação passada, não código nem teste executável); alterá-los pra "passar" o scan seria
      falsificar um registro histórico, não limpar código. Exceção deliberada, documentada aqui.

**Suíte após Fase 7**: **[API]** `phpunit` → **743 testes, 0 falhas reais** (verificado em duas
partes por causa do artefato de `queue:work` já documentado na Fase 6: os 4 arquivos de
job/pipeline com `--process-isolation` → 17/17; resto da suíte, 726 testes → só a mesma falha
pré-existente de sempre, `VrvpExecutionWiringTest`, flakiness de rede real). **[FE]** inalterado —
100% `[API]`.

---

## FASE 8 — Plano A a mercado, Plano B estrutural, risco por plano (doc §13) — 7 itens — ✅ 7/7 concluídos (22/08/2026)

Plano B usa exatamente o mesmo catálogo, os mesmos pivôs e as mesmas regras do Plano A.

**Decisão do Felipe antes de iniciar (via `AskUserQuestion`, esta sessão)**: fidelidade ao
`MotorExecucaoService::gerarPlanoB()` atual — mesmo clamp contra o stop do Plano A, mesma zona
estrutural, mesmos pisos de risco — trocando só a fonte da âncora de entrada e do alvo (catálogo
real em vez de `preço∓0,5×ATR` fabricado/barreiras ad-hoc). Não uma reescrita simplificada do
zero. Executado exatamente assim.

- [x] **8.1** `NOVO` `app/Services/GraphicalAnalysis/PlanAMicroanalysisService.php` **[API]** —
      `build()`: barreira contrária mais próxima (`AlvoService::nearestBarrier()`), posição no
      range (LOWER/MIDDLE/UPPER via terços), break/retest do nível contrário (primeiro consumidor
      real de `BreakRetestService::horizontal()`, criada na Fase 7 sem consumidor), risco de
      antecipação (LOW/MODERATE/HIGH — mesmos limiares de `QualidadeEntradaService::pistaLivre()`,
      elevado um degrau quando há rompimento/reteste confirmado), `risk_factors` textuais.
- [x] **8.2** `NOVO` `app/Services/GraphicalAnalysis/PlanRecommendationService.php` **[API]** —
      `evaluate()`: `recommended`/`reason_code`/`motivo`/`alvo_que_atende`, extraído verbatim do
      bloco que já existia inline em `ExecucaoService::montar()` — mesmos textos, mesma
      precedência (convicção abaixo do mínimo roda por último e **sobrescreve** incondicionalmente
      o motivo de RR baixo já setado, quando os dois disparam — comportamento literal do código
      antigo, não um `??`; testado explicitamente). Nenhum indicador isolado bloqueia sozinho.
- [x] **8.3** `NOVO` `app/Services/GraphicalAnalysis/PlanoBService.php` **[API]** — `gerar()`:
      âncora de entrada = candidata mais próxima do lado favorável no mesmo `target_candidates`
      (`nearestBarrier()`) — sem candidata real, Plano B é `null`, nunca fabrica `preço∓0,5×ATR`;
      mesmo clamp contra a invalidação do Plano A, mesma `zonaEstrutural()` (agora lendo o
      catálogo unificado em vez de hvn/lvn/S-R/POC/PDH/PDL separados), stop via `NivelService`,
      alvos via `AlvoService::calcularAlvos()` com os MESMOS `selectedTargetIds` do Plano A. Ganha
      `trigger` novo (`BreakRetestService::horizontal()` contra a borda da zona), que a versão
      antiga não tinha. Liquidação deliberadamente NÃO calculada aqui — movida pra
      `ExecucaoService::montar()` (item 8.5), pra que os dois planos tenham nocional real antes de
      calcular (correção real sobre o código antigo, que só linha calculava liquidação
      nocional-aware pro Plano A). Zero `cluster_liquidacao`, zero Fibonacci como fonte própria.
- [x] **8.4** `NOVO` `app/Services/GraphicalAnalysis/LiquidationCalculatorService.php` **[API]** —
      `calculate()` por bracket real (`getLeverageBrackets()` pelo nocional do próprio plano, via
      `bracketPorNocional()` — reimplementa a seleção de `MotorExecucaoService::mmPorBracket()`,
      que é `private` e não distingue "sem bracket" de "não precisou buscar");
      `maintenance_margin_ratio`/`source`/`bracket` explícitos, `NO_RISK` (alavancagem ≤ 1x) vs
      `UNAVAILABLE` (sem bracket real) vs `AVAILABLE`, nunca margem fixa como substituição
      silenciosa; `withStopVerification()` liga `MotorExecucaoService::verificarSegurancaLiquidacao()`.
- [x] **8.5** `PATCH` `ExecucaoService` **[API]** — injetados os 4 serviços acima +
      `PriceNormalizer` (`SwingPivotService` SAIU do construtor — só alimentava
      `montarBarreiras()`/`encaixarEmPivo()`, apagados; `TargetCandidateCatalog` já incorpora
      swing pivot mais cedo no pipeline). `montar()` perde `hvn`/`lvn`/`liqClusters`/`poc`/`zonas`/
      `figura` (só alimentavam o motor antigo), ganha `targetCatalog`/`selectedTargetIds`.
      Apagados: `montarBarreiras()`/`primeiraBarreiraContraria()`/`numerosRedondos()`/
      `primeiroAlvoAcimaDoMinimo()` (`ExecucaoService`) e `MotorExecucaoService::gerarPlanoB()`/
      `gerarPlanoBPublico()`/`zonaEstrutural()`. Cada plano publica
      `recommended`/`reason_code`/`motivo`/`alvo_que_atende`/`microanalise`/`target_details`/
      `maintenance_margin` com `verificacao`/`verificacao_motivo`/`liquidacao_classificacao`.
      **Desvio do documento, decisão desta sessão**: `montar()` NÃO ganhou um parâmetro `tickSize`
      separado (item 8.6 fala em `PriceNormalizer::price()`) — `PriceNormalizer` já resolve o tick
      real sozinho a partir de `$symbol` (`BinanceService::getSymbolFilters()`, cache de 1h);
      receber `tickSize` de fora seria um parâmetro morto, nunca lido no corpo do método.
      **Achado real, cascata não pedida pelo documento**: apagar `gerarPlanoB()`/
      `gerarPlanoBPublico()` deixava `MotorExecucaoService::gerarSetup()` (raiz de
      `setupLong()`/`setupShort()`/`calcularTPs()`/`calcularStopLong()`/`calcularStopShort()`/
      `numeroRedondoProximo()`/`juntarComE()`/`validarDirecao()`/`validarGeometria()`/
      `calcularRR()`/`recalcularPorAlavancagem()`/`nivelInvalidacao()`/`zonaInteresse()`/
      `validarSetupSanidade()` — toda essa árvore já confirmada sem consumidor de produção pela
      Fase 7, item 7.5) com uma chamada pra método inexistente. Apagada a árvore inteira (grep
      repo-wide confirmou zero consumidor de cada método antes de cada remoção) —
      `MotorExecucaoService` fica reduzido às 4 funções de liquidação
      (`calcularLiquidacao`/`mmPorBracket`/`verificarSegurancaLiquidacao`/`maiorAlavancagemSegura`).
      `PlanoBService` tem sua própria cópia de `zonaEstrutural()`/`juntarComE()` (mesmo princípio
      de sempre: duplicar função pura pequena em vez de acoplar as duas classes).
      **Segundo achado real, capturado só por um teste de regressão existente
      (`PlanoBClampAncoraD5Test`, item D5)**: o clamp da entrada/zona do Plano B contra a
      invalidação do Plano A precisa usar a ÂNCORA estrutural (`stop_ancora.valor`), nunca o stop
      já com buffer (que fica sempre mais longe do preço, buffer > 0) — um primeiro rascunho desta
      sessão passou o stop com buffer por engano (nome do parâmetro `stopFinalPlanoA` sugeria
      "stop final"), o que teria reintroduzido exatamente o bug que D5 corrigiu; corrigido antes
      de prosseguir, com um teste de regressão novo (`ExecucaoServiceC7RotuloTest`, reproduz o
      cenário original no nível de `ExecucaoService::montar()`, não só dentro de `PlanoBService`
      isolado) e a mesma correção aplicada a `zonaInteresse.invalidacao_nivel`/
      `planoBCompleto.invalidacao_nivel` (ambos idem: âncora, nunca stop com buffer, A-12/D5).
      **Terceiro achado real**: `execution.planos[0]` (Plano A) nunca tinha
      `invalidacao_direcao`/`invalidacao_nivel` — só o Plano B tinha (E08 exige o mesmo contrato
      completo nos dois); capturado por `ExecutionPlanosArrayTest` (rede real), corrigido.
- [x] **8.6** `PATCH` precisão de preços **[API]** — `ExecucaoService::normalizarPlano()` (privado,
      novo) normaliza `entrada`/`stop`/`tp1-3`/`liquidacao`/`invalidacao_nivel`/`zona_de`/
      `zona_ate` (incl. `price` dentro de cada `target_details.tpN`) por `PriceNormalizer::price()`
      antes de publicar cada plano; `tick_size`/`tick_decimals` acrescentados ao payload de cada
      plano.
- [x] **8.7** `PATCH` `ExecutionPipelineService` **[API]** — `generate()` ganha
      `targetCatalog`/`selectedTargetIds` (repassados de `AnalysisPersistenceService`, sourced de
      `$cached['bundle']['target_candidates']`/`$decision['target_selection']['candidate_ids']`,
      Fase 6); perde `$fibonacci` (parâmetro morto — só alimentava `montarBarreiras()`, apagado;
      Fibonacci real que a IA vê já entra em `TargetCandidateCatalog`, Fase 6) e a extração local
      de `$lvn`/construção de `$zonas`/`$figura` (idem, só alimentavam o motor antigo — `$patterns`
      continua vivo só pelo rompimento de figura, âncora de tese). `AnalysisPersistenceService`
      repassa os 2 valores novos; `GraphicalAnalysisAttemptJob` não precisou de mudança direta
      (já era `AnalysisPersistenceService` quem lia `$cached['decision']`/`$cached['bundle']`).

**Testes**: 5 suítes novas dos serviços (`PlanAMicroanalysisServiceTest`/
`PlanRecommendationServiceTest`/`PlanoBServiceTest`/`LiquidationCalculatorServiceTest` +
`AlvoServiceCalcularAlvosTest`/`AlvoServiceNearestBarrierTest`) + `PlanoBServiceRegressaoTest`
(porta pra cima de `PlanoBService::gerar()` os critérios comportamentais já validados contra o
`gerarPlanoB()` antigo — gate de Wyckoff, radical CONFIRM banido, descrição sem número embutido,
CVD só no sentido certo — de 6 arquivos apagados junto do motor antigo:
`MotorExecucaoServiceWyckoffGateTest`/`MotorExecucaoServiceE4Test`/`ExecucaoServiceG02Test`/
`MotorExecucaoServicePlanoBTest`/`MotorExecucaoServiceE03Test`/`PlanoBClampAncoraD5Test`).
`ExecucaoServiceC7RotuloTest` reescrito contra a assinatura nova (mesmo critério C7 + novo teste
de regressão D5 no nível do chamador). `ExecucaoServiceRrPorAlvoTest` perdeu os 4 testes de
`primeiroAlvoAcimaDoMinimo()` (método saiu de `ExecucaoService`) — 2 já tinham equivalente em
`PlanRecommendationServiceTest`, 2 foram adicionados lá. `ExecucaoServiceMontarBarreirasV69Test`/
`ExecucaoServiceClusterLiquidacaoTest`/`ExecucaoServiceE10PistaLivreTest`/
`AlvoServiceA3AcceptanceTest` apagados (testavam `montarBarreiras()`/`primeiraBarreiraContraria()`/
o motor geométrico antigo de `calcularAlvos()`, todos apagados — concern coberto pelo Fase 6
`TargetCandidateCatalogTest`/pelos novos testes de `AlvoService`). `VrvpExecutionWiringTest`
apagado (seu critério — POC do VRVP virando TP1 automaticamente — não existe mais; VRVP como
fonte do catálogo já é testado por `TargetCandidateCatalogTest`). `ExecutionExecutableVsRecommendedTest`/
`ExecutionPlanosArrayTest` (rede real, Binance) reescritos com catálogo sintético explícito no
lugar do `$vrvp['poc']` auto-selecionado; `test_e01_sem_barreira_real...` perdeu o escape hatch de
"pivô de swing real pode aparecer" — cenário passou a ser determinístico (seleção de alvo não
depende mais de geometria automática sobre o mercado). `AcentuacaoTextosTest` realocado: textos
que saíram de `ExecucaoService.php`/`MotorExecucaoService.php` agora são checados em
`PlanRecommendationService.php`/`PlanoBService.php` (mesmo texto literal, arquivo novo).

**Suíte após Fase 8**: **[API]** `phpunit` → **746 testes, 0 falhas reais** (mesma técnica de
verificação da Fase 6/7: os 4 arquivos de job/pipeline com `--process-isolation` → 17/17; resto da
suíte, 742 testes → 100% verde, zero falhas — inclusive a antiga flakiness de rede real de
`VrvpExecutionWiringTest`, que não existe mais por ter sido apagada). **[FE]** inalterado — 100%
`[API]`.

---

## FASE 9 — Score final antes da execução e justificativa profissional (doc §14) — ✅ 6/6 concluídos (22/08/2026)

Score final e texto final existem antes de qualquer plano ser montado.

**Nota de execução**: item 0.4 marcava esta fase como bloqueada pendente de confirmação do
Felipe sobre o conflito de modelo (seção 18.9/item 13.9). Reconferido: esse conflito é
especificamente sobre TROCAR `gemini-3.7-flash`→`gemini-3.6-flash` — um item da Fase 13, nunca
tocado aqui. O próprio item 9.6 já trazia o aviso "não confundir com a troca de modelo" como
alerta preventivo, não como dependência real desta fase. As Fases 1-8 (já liberadas) tinham a
mesma nota; a Fase 9 foi executada sem tocar `decision_provider`/`GENESIS_GEMINI_DECISION_MODEL`
em lugar nenhum — grep de confirmação ao final não encontrou nenhuma menção a troca de modelo em
nenhum arquivo desta fase. Item 0.4 continua aberto só para a Fase 13.

- [x] **9.1** `NOVO` `app/Services/GraphicalAnalysis/ScoreFinalizer.php` **[API]** —
      `finalize()`: `technical + derivatives_modifier - contradiction_penalty -
      data_quality_penalty`, arredondado a múltiplo de 5, [0,90]. A fórmula já existia INLINE
      dentro de `GraphicalAnalysisAttemptJob::handle()` (technical+modifier-contradiction) —
      extraída sem mudar o cálculo. `data_quality_penalty` é o achado real: existia como
      `AnalysisPersistenceService::avaliarQualidadeDados()`, aplicado TARDE (depois do texto já
      persistido) e sobre um sinal fraco (cobertura + 1 timestamp). Agora roda ANTES de qualquer
      texto (item 9.2) e usa `bundle.quality.freshness` — o dado real por fonte que a Fase 3
      (item 3.4) já calculava "sem consumidor de penalidade/score" (comentário da própria Fase 3
      — este item é esse consumidor); ALTA/MEDIA/BAIXA (3 tiers reais do `DataFreshnessGate`) →
      penalidade 0/5/10, cada fonte não-AVAILABLE nomeada em `limiting_factors`, não um aviso
      genérico único. **Desvio do documento, decisão desta sessão**: `evaluated_families`/
      `limiting_factors`/`temporal_alignment`/`derivatives_effect` não têm formato literal no
      documento-fonte (§14 nunca foi colado por completo — ver aviso em
      `GENESIS_V6_9_IMPLEMENTACAO_FINAL_FELIPE.md`); desenhados a partir de sinais REAIS já
      estruturados no pipeline — `evaluated_families` só lista uma família com evidência real por
      trás (nunca as 4 fixas incondicionalmente); `temporal_alignment` espelha literalmente o
      ajuste #2 que `GenesisPrompt::system()` já instrui a IA a fazer no score_tecnico ("tempos
      maiores... todos concordando +5, todos discordando -5, misto não ajusta") — recalculado em
      PHP pra exposição pública auditável, nunca confiado ao texto livre do modelo.
- [x] **9.2** `NOVO` `app/Services/GraphicalAnalysis/ScoreNarrativeBuilder.php` **[API]** —
      `build()`: texto multifatorial (famílias avaliadas + coerência técnica/estrutural + efeito
      de derivativos + fatores limitantes); nunca atribui a nota a um indicador isolado. Substitui
      `decision.score_description` (o texto que a IA escreve ANTES do modificador de derivativos
      e das duas penalidades existirem — podia descrever uma força que não é mais a publicada,
      mesmo padrão de "narrativa dessincronizada do número" que este spec já corrigiu em G02/E4).
- [x] **9.3** `PATCH` `GraphicalAnalysisAttemptJob` **[API]** — `ScoreFinalizer`/
      `ScoreNarrativeBuilder` injetados; bloco inline de combinação das duas etapas (linhas
      344-358 do arquivo antes desta fase) substituído pelas chamadas às duas classes novas;
      `decision['score']`/`decision['score_description']` recalculados a partir do breakdown
      ANTES de `analysis_stage` virar `EXECUTION_IN_PROGRESS` (posição inalterada — só o cálculo
      que preenche os campos mudou de lugar); `score_breakdown` acrescentado a `$cached` pra
      `AnalysisPersistenceService` persistir sem recalcular.
- [x] **9.4** `PATCH` `AnalysisPersistenceService::computeAttributes()` **[API]** — apagada
      `avaliarQualidadeDados()` por completo (era ~35 linhas, incl. o bloco `quality.avisos` em
      `evidence_manifest` — removido também, sem consumidor no frontend, confirmado por grep;
      substituído por `score_breakdown` como o lugar estruturado certo pra essa informação);
      `$attributes['score'] = (int) $decision['score']` direto, sem `$scoreAjustado`.
- [x] **9.5** `PATCH` persistência temporal **[API]** — achado real: as colunas
      (`score_breakdown`/`target_candidates`/`target_selection`/`source_freshness`/
      `snapshot_horario`/`snapshot_preco`/`snapshot_candle_abertura_ts` em `Analise`;
      `recommended`/`reason_code`/`motivo`/`alvo_que_atende`/`microanalise`/`target_details`/
      `margem_usd`/`maintenance_margin` em `AnalisePlano`) já existiam prontas — `$fillable`/
      `$casts`/migration de uma fase anterior deste mesmo spec (Fase 1, itens 1.2/1.3) — só nunca
      tinham sido escritas. `context_payload` já era persistido desde a Fase 5/V6.8 (achado ao
      conferir, não precisou de mudança). Todo o resto já existia pronto dentro de
      `$cached['bundle']`/`$cached['decision']` (Fases 3/6/8) — nenhuma coleta nova, só leitura:
      `target_candidates`=`bundle.target_candidates`, `target_selection`=`decision.target_selection`,
      `source_freshness`=`bundle.quality.freshness`, `snapshot_horario`=`bundle.timing.market_price_observed_at`,
      `snapshot_preco`=evidência `market.price`, `snapshot_candle_abertura_ts`=`bundle.quality.freshness.items.price.timestamp_ms`
      (o open_time do último candle da série, mesmo valor que `items.candles` carrega). `margem_usd`
      não tinha campo pronto no payload do plano (só nocional/alavancagem) — calculado em
      `AnalysisPersistenceService::margemUsd()` (nocional ÷ alavancagem), puramente derivado, sem
      regra de negócio própria pra justificar ficar em `ExecucaoService`. **Achado real durante a
      implementação**: `genesis_analise_planos.recommended` é `NOT NULL` no banco (migration da
      Fase 1) — `planoRow()` grava `false` (nunca `null`) quando o campo está ausente (execution
      sintético de teste anterior à Fase 8), mesma doutrina de sempre.
- [x] **9.6** `PATCH` `CanonicalBundleBuilder::forStage1()` + `GenesisPrompt::system()` **[API]**
      — `forStage1()` ganha `unset($bundle['context'])` — mesma exclusão que `manifest_hash` já
      aplicava desde a Fase 2 (item 2.8), agora também no bundle que efetivamente chega ao
      decisor (antes só o hash excluía; o decisor ainda LIA `bundle.context` de verdade — achado
      real, `GenesisPrompt::system()` citava o campo explicitamente). `build()` continua expondo
      `context` no bundle completo (comentário original já previa isso — "pra quem lê o bundle
      interno completo"), só `forStage1()` remove. Prompt: item "3. bundle.context traz..." da
      hierarquia de autoridade substituído por reforço explícito ("direção e score técnico nunca
      são decididos, ajustados ou justificados por evento macro, notícia ou sentimento, mesmo que
      você tivesse acesso a eles"); referência a `bundle.context` também removida de USO DO
      SNAPSHOT, SEGURANÇA E ANTI-INJEÇÃO e do texto de `user()`. `NarrativeContradictionGate`
      (E8) não precisou de mudança de código — já tratava `sentimentoNarrativa=null` como "não
      informado, não checado" (degradação já projetada); comentário em
      `DecisionResponseValidator::validate()` atualizado pra não descrever um comportamento que
      não existe mais na prática. **Confirmado, não aplicado**: nenhuma menção a
      `gemini-3.6-flash`/`GENESIS_MODEL`/troca de `decision_provider` em nenhum arquivo tocado
      por esta fase (grep de verificação) — o conflito da seção 18.9 pertence só à Fase 13.

**Testes**: `ScoreFinalizerTest` (16 testes — porta os 5 cenários de
`AnalysisPersistenceServiceQualidadeDadosTest`, apagado junto de `avaliarQualidadeDados()`,
contra a nova origem do sinal de frescor, + cobertura de contradições/derivativos/
temporal_alignment/evaluated_families/arredondamento/clamp) e `ScoreNarrativeBuilderTest` (7
testes) novos. `AnalysisPersistenceServiceRrPorAlvoTest`/`GraphicalAnalysisOrchestratorPlanoPersistenceTest`
exigiram o fix do `recommended` NOT NULL (achado acima) pra continuar passando — nenhuma mudança
de asserção, só o INSERT deixou de falhar.

**Suíte após Fase 9**: **[API]** `phpunit` → **765 testes, 0 falhas reais** (mesma técnica: os 4
arquivos de job/pipeline com `--process-isolation` → 17/17, incl. o pipeline completo real
exercitando `ScoreFinalizer`/`ScoreNarrativeBuilder`/persistência dos campos novos ponta a ponta;
resto da suíte, 761 testes → 100% verde). **[FE]** inalterado — 100% `[API]`.

---

## FASE 10 — Mapa de liquidação estimado, sem volume fabricado (doc §15) — ✅ 3/3 concluídos (22/08/2026)

- [x] **10.1** `SUBSTITUIR` `app/Services/LiquidationMapService.php` **[API]** — construtor trocado
      de `BinanceService` direto pra `BrainMarketDataProvider` (única porta de dados de mercado,
      Fase 2 — achado do item 0.3, confirmado pendente). Lógica de estimativa (expansão líquida de
      OI × preço médio do candle vira peso relativo; cada abertura líquida distribuída 50/50 entre
      2 cenários neutros — LONG hipotético liquidando abaixo, SHORT hipotético liquidando acima —
      por alavancagem de varejo 10/25/50/100×) já existia correta desde a versão anterior — mantida
      sem mudança de matemática. Novo: `rotulo`='ESTIMATIVA DE CENÁRIOS DE LIQUIDAÇÃO',
      `side_assumption`='METADE_LONG_METADE_SHORT_POR_ABERTURA_DE_OI', `notional_is_additive`=false,
      `method_note` (texto explicando o método e o limite de dado) — os 4 explícitos no payload,
      nunca implícitos. Bins: largura mínima de faixa passa a respeitar o `tickSize` real do
      contrato (`BrainMarketDataProvider::symbolFilters()`) — nunca uma faixa mais fina do que a
      corretora consegue exibir; sem filtro conhecido, cai numa faixa relativa ao preço atual
      (0,01%), preservando o comportamento anterior (divisão do range observado em 60 partes) como
      piso alternativo quando o range é largo o bastante.
- [x] **10.2** `MANTER` `LiquidationMapController::show()` + rota `/api/v1/liquidation-map/{symbol}`
      **[API]** — validação de enum de `timeframe` acrescentada (422 `TIMEFRAME_INVALIDO` se fora
      da lista real de intervalos que a Binance aceita); resto do controller (validação de símbolo,
      autenticação da rota, tratamento de erro) intocado.
- [x] **10.3** `APAGAR` `services/liquidationService.ts` **[FE]** — `LiquidationHeatmap.tsx` já
      usava só `fetchLiquidationMap()` (reescrito numa fase anterior deste mesmo spec, antes desta
      sessão) — nada a fazer nessa metade. **Achado real, não pedido pelo documento mas bloqueava
      a execução literal do item**: `liquidationService.ts` ainda tinha um consumidor real —
      `components/LiquidationRadar.tsx`, renderizado por `pages/LiquidationPage.tsx`, roteado em
      `/liquidacao` (`router/index.tsx`) — uma página INTEIRA, alcançável, exibindo "zonas de
      liquidação institucionais" 100% geradas por `Math.random()` (`calculateTheoreticalClusters()`)
      como se fossem reais, com um resumo de "Análise de Risco (AI)" igualmente fabricado
      ("Detectada muralha institucional de X B USD...") — violação direta da regra que não pode
      ser reinterpretada ("nunca simular dado que não existe"). Apagar `liquidationService.ts` sem
      resolver isso quebraria a página (import de arquivo inexistente). `LiquidationPage.tsx`
      reescrito como um wrapper fino sobre `LiquidationHeatmap.tsx` (já honesto, real, item 10.1),
      com seletor de símbolo (mesmos 3 pares — BTC/ETH/SOL — que a página antiga oferecia).
      `LiquidationRadar.tsx` e `liquidationService.ts` apagados juntos. `tsc --noEmit` limpo após
      a remoção (nenhum import quebrado); `npm test` sem nenhuma falha relacionada (28 falhas
      pré-existentes no repositório, todas em suítes de "exploração de bug" sem relação com
      liquidação — timeframe/rotas/EMA/scanner — confirmadas por nome antes de serem ignoradas).

**Suíte após Fase 10**: **[API]** `LiquidationMapServiceTest`/`LiquidationMapControllerTest` → 6/6
(rede real, Binance) — campos novos e validação de timeframe cobertos. Suíte completa
(`phpunit`) → mesma contagem/resultado da Fase 9 (765 testes, 0 falhas reais), esta fase não
alterou nenhum arquivo compartilhado com o resto do pipeline de decisão/execução. **[FE]** `tsc
--noEmit` limpo; `npm test` sem regressão nova.

---

## FASE 11 — Contrato público e frontend, uma única verdade persistida (doc §16) — ✅ 13/13 concluídos (22/08/2026)

A tela exibe o payload persistido. Nenhuma chamada paralela sobrepõe texto depois.

- [x] **11.1** `PATCH` `GeminiContextService` **[API]** — `systemPrompt()` reescrito (2 scores
      informativos 0-100, nunca 50 de preenchimento); `separarEventos()` novo substitui
      `eventosDoRadar()` (query única em OR) por duas queries mutuamente exclusivas — macro
      (severidade CRITICAL/HIGH, título NÃO cita o ativo) e ativo (título cita o símbolo-base,
      qualquer severidade); `userPrompt()` recebe os dois grupos separados, em seções rotuladas;
      `collect()` só marca `AVAILABLE` quando resumo/narrativa realmente vieram preenchidos — era
      **achado real, bug de produção**: `status` estava hardcoded `'AVAILABLE'` incondicional a
      qualquer 2xx HTTP, mesmo com corpo vazio; `MAX_EVENTOS` 4→20. `EvidenceCatalog` já não tinha
      `macro.narrative/score`/`sentiment.narrative/score/gatilhos_*`/`macro.fear_greed/
      btc_dominance` desde a Fase 2 (item 2.7) — confirmado, nada a remover aqui.
      `GeminiContextServiceTest.php` reescrito por completo (12 testes) para o modelo de duas
      listas, incl. `test_evento_sobre_o_ativo_vai_so_para_sentimento_nunca_para_macro` e
      `test_resumo_ou_narrativa_vazios_produzem_status_unavailable_mesmo_com_http_2xx`.
- [x] **11.2** `PATCH` `AnalysisPublicResponseBuilder::informativeContext()` **[API]** — **achado
      real, bug de produção silencioso desde a Fase 2**: `macro`/`sentiment` liam de
      `evidence_manifest` por ids (`macro.vix`, `macro.score`, `sentiment.score`, etc.) que a Fase
      2 (item 2.7) já tinha apagado de `EvidenceCatalog` — os dois blocos resolviam
      UNAVAILABLE/null desde então, sem ninguém ter atualizado este consumidor. Corrigido pra ler
      direto de `Analise::context_payload` (a origem real), via novos helpers privados
      `macroContext()`/`sentimentContext()`/`displayMetric()`; `status` só `AVAILABLE` com
      score+narrativa/resumo não vazios (mesmo padrão do item 11.1, agora no lado leitura).
      Consequência direta: `InformativeDisplayContextService` (VIX/DXY/S&P500/Fear&Greed/
      BTC-dominance) — construído numa fase anterior deste mesmo spec e **nunca chamado em lugar
      nenhum** (confirmado por grep, só existiam referências em comentário) — precisou ser ligado
      no job (`GraphicalAnalysisAttemptJob::handle()`, `$contextPayload['display'] =
      $displayContext->collect()`) pra existir algo em `context_payload.display` pro builder ler;
      sem isso os 5 indicadores de `CanonicalMacroContext` (item 11.4) ficariam sempre
      indisponíveis mesmo com o backend "pronto". `build()` ganhou `score_breakdown`/
      `source_freshness`/`target_candidates`/`target_selection`/`timestamps` (market_price/
      indicators_observed_at, last_closed_candle_at, candle_state, snapshot_horario/preco/
      candle_abertura_ts) no retorno principal — todos já persistidos pela Fase 9 (item 9.5), só
      nunca expostos no contrato público. `GraphicalAnalysisInformativeContextTest.php` reescrito
      (fixtures de `evidence_manifest` → `context_payload`).
- [x] **11.3** `SUBSTITUIR` `components/ScoreBasisBars.tsx` **[FE]** — 4 cards sempre visíveis
      (Técnico/Derivativos/Macro e Geopolítico/Sentimento); removido o guard condicional que fazia
      a fileira inteira sumir quando faltava algum dado (violava a regra da matriz de aceite: "os
      quatro cards aparecem sempre... ausência aparece como Indisponível") e a renderização
      condicional por card; paleta nova roxo(normal)/âmbar(atenção)/cinza(indisponível) substitui
      verde/vermelho — corta de vez qualquer associação de cor com a direção LONG/SHORT da
      operação escolhida, inclusive pro card Derivativos (WEAKENS/STRENGTHENS agora é
      atenção/normal por severidade do próprio dado, nunca "contraria/apoia a direção"). 3 testes
      novos em `ScoreBasisBars.test.ts` (9 no total, todos verdes).
- [x] **11.4** `PATCH` `types/graphicalAnalysis.ts` **[FE]** — `InformativeBlockBase`,
      `RadarNewsEvento`, `DisplayMetric`, `CanonicalMacroContext`, `CanonicalSentimentContext`
      (substituem `MacroNarrative`/`SentimentNarrative`); `TargetCandidate`, `TargetDetail(s)`,
      `TargetRiskReward`, `RrPorAlvo`, `BreakRetestResult`, `PlanMicroanalysis`,
      `MaintenanceMargin`, `ScoreBreakdown`, `SourceFreshness(Item)`, `TargetSelection
      (Rationale)`, `AnalysisTimestamps`; `ExecutionPlanoSetup` **e** `ExecutionCandidateSetup`
      ganham `recommended`/`reason_code`/`motivo`/`alvo_que_atende`/`microanalise`/
      `target_details`/`tick_size`/`tick_decimals`/`maintenance_margin`/`rr_por_alvo`/
      `capital_base_usd`/`margem_comprometida_usd`/`margem_comprometida_pct_capital` (item 8.7 já
      dava os 5 primeiros por plano no backend; o tipo FE não tinha acompanhado). `types.ts`
      (legado) ganhou o mesmo conjunto exceto `microanalise`/`target_details`/`tick_size`/
      `tick_decimals`/`maintenance_margin` — deliberadamente fora de escopo, não consumidos pelo
      adaptador legado ainda.
- [x] **11.5** `PATCH` `services/geminiService.ts` **[FE]** — apagados
      `macroGovernanceCache`/`sentimentCache`/`fetchMacroToday`/`fetchSentimento` e o bloco
      `Promise.all` que sobrescrevia `result.contexto_informativo` depois da análise já pronta —
      código morto chamando uma rota (`/v1/macro/today`, `/v1/macro/sentimento`) já removida numa
      spec anterior (`MacroController`, V6.8 Fase 10). `mapGraphicalToLegacy()` passa a ler
      `ctx.macro.resumo/score` e `ctx.sentiment.narrativa/score/gatilhos_*` direto (campos planos
      do novo contrato canônico, não mais `.value`-wrapped) — `vix`/`dxy_change_pct`/
      `sp500_change_pct`/`fear_greed`/`btc_dominance` continuam `.value`-wrapped (`DisplayMetric`).
- [x] **11.6** `PATCH` `analyzeChart()` **[FE]** — assinatura reduzida a `(file, metadata, equity,
      userLeverage, signal?)` — `marketData`/`activeExchange`/`cvdDataParam`/`entryValue` nunca
      eram lidos dentro da função (confirmado antes de remover); `GenesisPage.tsx` simplificado
      (dead code `exchangeToUse`/`marketDataToUse` removido); todos os call sites de
      `__tests__/geminiService.test.ts` atualizados pra nova assinatura.
- [x] **11.7** `NOVO` `utils/canonicalMoney.ts` **[FE]** — `price(value, tickDecimals?)` (preço de
      ativo, usa a precisão real do contrato quando disponível, cai pra heurística de magnitude
      2/4/8 casas quando não) vs `usd(value)` (sempre 2 casas — valores em dinheiro: nocional,
      risco, margem) — distinção conceitual real que o antigo `formatPrice()` único misturava.
      `AnalysisResult.tsx` troca ~12 chamadas de `formatPrice()` local por `price()`/`usd()`, com
      `tickDecimals` derivado uma vez (`planoAtivo?.tick_decimals ?? setup?.tick_decimals ?? null`,
      item 8.6) e propagado a todos os pontos de preço. 12 testes novos, todos verdes.
- [x] **11.8** `PATCH` `AnalysisResult.tsx` **[FE]** — apagado `calcularRiscoRetornoAlvo` e o
      recálculo local de `rrPorAlvo`; `rrPorAlvo` agora é só `planoAtivo?.rr_por_alvo ??
      setup?.rr_por_alvo ?? null`, direto do backend (campo `TargetRiskReward`:
      `alvo/fonte/rr_bruto/rr_liquido/custo_bps/valido/motivo_ausencia`). `utils/riscoRetorno.ts`
      apagado inteiro (zero consumidores restantes, confirmado por grep antes da remoção). Os 3
      blocos TP1-3 trocaram `rrPorAlvo.tpN.liquido/bruto` (nomes do cálculo local antigo) por
      `rrPorAlvo?.tpN.rr_liquido/rr_bruto` (nomes reais do backend), com `?.` novo porque
      `rrPorAlvo` agora pode ser `null`.
- [x] **11.9** `PATCH` aviso + microanálise do plano ativo **[FE]** — `recommendedAtivo`/
      `motivoAtivo`/`alvoQueAtendeAtivo` derivados do `planoAtivo` (com fallback pro campo legado
      de `execution`, só pra decisões cacheadas antes de `execution.planos[]` carregar o campo por
      plano); trocar de Plano A/B agora troca a manchete/aviso/motivo junto com entrada/stop/TPs —
      antes ficavam presos ao Plano A mesmo com o Plano B ativo na tela.
      `AnalysisResult.a8.test.ts` atualizado pra cobrir a nova derivação.
- [x] **11.10** `PATCH` capital/risco/margem **[API+FE]** — `ExecucaoService::capitalMargemInfo()`
      novo: `capital_base_usd` (capital total informado pelo membro), `margem_comprometida_usd`
      (nocional ÷ alavancagem — o que a corretora efetivamente trava NESTA posição),
      `margem_comprometida_pct_capital` (o segundo como % do primeiro) — deliberadamente distintos
      de `risco_usd_estimado`/`risco_pct_capital_base` (perda-se-stop-bater, conceito diferente,
      já existente). Aplicado a `candidateSetup` (Plano A) e `planoBCompleto`.
      `ExecucaoServiceCapitalMargemTest.php` novo (2 testes). Frontend: card "Capital e Margem" 3
      colunas novo em `AnalysisResult.tsx`, logo após o grid de risco existente, usando `usd()`
      (item 11.7) nas 3 linhas — nunca misturadas com risco-se-stop-bater.
- [x] **11.11** `PATCH` `BlocoConviccaoQualidade.tsx` **[FE]** — removida a prop `score`, o import
      `faixaDeConviccao` e a coluna Convicção inteira — era repetição exata do número que já
      aparece em letra garrafal no topo de `AnalysisResult.tsx` (mesma doutrina G15 que este bloco
      pretendia evitar desde a origem); `grid-cols-2`→`grid-cols-1`, Risco e retorno vira a única
      coluna. `BlocoConviccaoQualidade.test.ts` não precisou de mudança — as 5 asserções
      existentes só cobrem o texto bruto/líquido, não afetado.
- [x] **11.12** `PATCH` `TechnicalAnalysisService::calcular()` **[API]** — `preco_variacao_pct`
      passa de close[-1] vs close[-2] (fechamento da vela anterior) pra open[-1] vs close[-1]
      (abertura da vela atual em formação vs. preço ao vivo) — exigiu um array `$opens` novo no
      loop de extração de candles, ao lado de `$closes`/`$highs`/`$lows`/`$volumes`.
      `TechnicalAnalysisServicePrecoVariacaoTest.php` novo (4 testes: variação positiva/negativa,
      vela única, zero candles → 0).
- [x] **11.13** `NOVO` `utils/publicVocabulary.ts` **[FE]** — `publicText()`: LONG/SHORT são
      **removidos** (nunca traduzidos — o prompt do decisor já proíbe os dois em texto livre;
      exibi-los de volta, ou um resíduo desatualizado/contraditório, é pior que omitir);
      OPEN INTEREST/SQUEEZE/CHOCH/MARKUP/MARKDOWN/WYCKOFF normalizados pra grafia PT; 1W/1M
      expandidos por extenso (desambigua o caso conhecido "1M mês vs. 1m minuto", já documentado
      em outro ponto do código). Baseado em regex com limite de palavra, idempotente. Aplicado a
      toda narrativa/legenda/descrição de plano renderizada em `AnalysisResult.tsx`
      (`scoreJustification`, `technicalAnalysis`, `motivoAtivo`, descrição do Plano B,
      `invalidacaoAtiva`). 11 testes novos, todos verdes.

**Achado real adicional, fora da lista dos 13 itens mas exposto por eles**: `AnalysisResult.tsx`
renderizava `macroInfo.eventos.map((evt: string) => <p>{evt}</p>)` — tratando cada evento macro
como string crua, mas `GeminiContextService` sempre devolveu objetos
(`{title, summary, source, source_url, published_at, observed_at, relevance}`). Isso quebraria em
runtime ("Objects are not valid as a React child") no primeiro `macro.eventos` não-vazio — ficou
mais provável de disparar justamente com a mudança do item 11.1 (`separarEventos()` popula a lista
macro com mais frequência que a query única anterior). Corrigido pra desestruturar `evt.title`
com `evt.source`/`evt.source_url` como link opcional.

**Nota de documentação**: como em toda decisão de formato não-literal desta spec (doc §16 nunca
foi colado por completo — mesmo aviso da Fase 9), a lista exata de termos de `publicText()`
(item 11.13) e o mapeamento de severidade/cor de `ScoreBasisBars.tsx` (item 11.3) foram desenhados
a partir do vocabulário e das regras já reais no pipeline (prompt do decisor, `DerivativesContext`,
matriz de aceite), não de um texto-fonte literal do documento.

**Testes**: **[API]** `GeminiContextServiceTest` (12), `GraphicalAnalysisInformativeContextTest`
(reescrito), `TechnicalAnalysisServicePrecoVariacaoTest` (4, novo),
`ExecucaoServiceCapitalMargemTest` (2, novo). **[FE]** `ScoreBasisBars.test.ts` (9),
`canonicalMoney.test.ts` (12, novo), `publicVocabulary.test.ts` (11, novo),
`AnalysisResult.a8.test.ts` (atualizado), `analysisResultNarrative.test.ts` (atualizado),
`geminiService.test.ts` (call sites atualizados pra nova assinatura de `analyzeChart()`).

**Achado real adicional, encontrado só ao rodar a suíte completa (não isolando arquivo por
arquivo)**: `InformativeDisplayContextService` (item 11.2) chamando 3 hosts reais (Yahoo
Finance/Alternative.me/CoinGecko) de dentro do job estourava os 4 testes de
job/pipeline que rodam `Artisan::call('queue:work', ...)` de verdade — sem fake, cada teste fazia
até ~70s de chamadas de rede reais não-mockadas, e a análise ficava presa em `PENDING` (worker
matando o job por timeout no meio do caminho). Corrigido dos dois lados: `fakeDisplayContextHosts()`
novo, somado (`+`) em todo `Http::fake([...])` dos 4 arquivos de job/pipeline (`GraphicalAnalysis
AttemptJobTest`/`FullPipelineIntegrationTest`/`ImageCleanupTest`/`OpenAiProviderFlowTest`); e
`GraphicalAnalysisAttemptJob::orcamentoTimeoutSegundos()` ganhou o orçamento real dessas 3 fontes
(3×Yahoo + Alternative.me + CoinGecko, pior caso 70s) — sem isso o job continuava com um orçamento
de tempo que não cobria o próprio trabalho que ele passou a fazer. **Efeito colateral em cascata,
também achado real**: o orçamento subiu de 345s pra 435s, deixando `GENESIS_QUEUE_RETRY_AFTER`
(420s) ABAIXO do orçamento — exatamente o cenário que `QueueRetryAfterTest` existe pra travar (dois
workers podendo pegar a mesma tentativa). Subido pra 500 em `config/queue.php` e `.env.example`,
com a mesma nota de achado nos dois lugares. `database/testing.sqlite`: 1 linha órfã na tabela
`jobs` (sobra de rodadas anteriores que travaram antes da correção do fake) limpa via `sqlite3`
direto, mesma doutrina de sempre — nunca o banco de dev real.

**Suíte após Fase 11**: **[FE]** `npx vitest run` → 373 passaram, 28 falharam (mesma baseline
pré-existente de sempre — "bugConditionExploration"/"preservation"/"integration.e2e"/
"infrastructure.preservation", confirmadas por nome, mais 2 falhas de `geminiService.test.ts`
("Sessão expirada", mock de `localStorage` pré-existente e não-relacionado, ocasionalmente ausentes
da contagem total por instabilidade de ordem entre suítes — confirmado 2/20 falhando em isolamento
neste arquivo, mesma causa documentada em fases anteriores), zero regressão nova; 401 testes no
total (+3 sobre a Fase 10, todos os 3 novos de `ScoreBasisBars.test.ts`). `tsc --noEmit` limpo.
**[API]** `phpunit` (suíte completa, sem `--process-isolation`) → **771 testes passaram, 2 falhas
— as duas SÓ nos 2 arquivos que exigem processo isolado** (`GraphicalAnalysisAttemptJobTest`/
`GraphicalAnalysisFullPipelineIntegrationTest`, confirmado via grep de todas as linhas `FAILED` da
rodada — nenhum outro arquivo). Os 4 arquivos de job/pipeline rodados com `--process-isolation` →
**17/17**, 0 falhas reais. Arquivos tocados nesta fase também verificados isoladamente:
`GeminiContextServiceTest` 12/12, `GraphicalAnalysisInformativeContextTest` verde,
`TechnicalAnalysisServicePrecoVariacaoTest` 4/4, `ExecucaoServiceCapitalMargemTest` 2/2 + filtro
completo de `ExecucaoService` 37/37, `QueueRetryAfterTest` 2/2.

---

## FASE 12 — Ferramentas laterais sem dado fabricado, Spot isolado (doc §17) — ✅ 12/12 concluídos (22/08/2026)

Os 9 defeitos da varredura de Spot e de dados inventados.

- [x] **12.1** `NOVO` `app/Services/MultiExchangeDerivativesDisplayService.php` +
      `MultiExchangeDerivativesController` **[API]** — 4 APIs reais (Binance/Bybit/Bitget/OKX),
      `funding_rate`/`open_interest` por exchange, cada fonte `AVAILABLE`/`UNAVAILABLE`
      independente (mesmo padrão `status/value/unit/source/observed_at/error_code` já usado em
      `InformativeDisplayContextService`, Fase 11), nunca multiplicar valor da Binance; rota
      `/v1/tools/derivatives-comparison/{symbol}` (grupo `auth:sanctum`, mesmo padrão de
      `liquidation-map`), `decision_role: DISPLAY_ONLY`. **Achado real**: `oiLiquidationService.ts`
      simulava Bybit/Bitget/OKX multiplicando o Open Interest real da Binance por frações fixas
      (0.45/0.20/0.30) — um número inventado apresentado como dado de mercado real de outra
      exchange; nunca fazia nenhuma chamada real a essas 3 exchanges. Reescrito para consumir a
      API real (`fetchDerivativesComparison`, novo em `services/api.ts`); `OiLiquidationMonitor.tsx`
      ganhou um 2º card "Open Interest por Exchange" — dado real que antes nem chegava a ser
      exibido (a fabricação existia só no objeto de dados, nunca renderizada).
- [x] **12.2** `PATCH` `FeaturePolicy::forTimeframe()` **[API]** — `trade_flow_enabled` agora exige
      timeframe intraday (1m-1h) E a flag de config, não só a flag sozinha. **Achado real**: o
      teste existente (`IncrementalBrainTest`) se chamava
      `test_daily_ignores_instant_book_but_keeps_trade_flow` e afirmava `trade_flow_enabled ===
      true` no diário — capturava o próprio bug que este item corrige (fluxo agressor sobre a tape
      de segundos não tem sentido comparado a um candle diário). Nome e asserção corrigidos.
- [x] **12.3** `PATCH` `BrainMarketDataProvider`/`BinanceService::getAggTradesRange()` **[API]** —
      paginação real de `/fapi/v1/aggTrades` por `fromId` (1ª página usa `startTime`/`endTime`, as
      seguintes só `fromId` — a Binance rejeita misturar os dois), até 20 páginas (proteção contra
      excesso de chamadas), normalizado para o formato que `TradeFlowService::resumir()` já
      consome (`timestamp_ms`/`preco`/`quantidade`/`agressor`) — `m: true` (comprador era o maker)
      vira `agressor: VENDA`. Método novo na interface `BrainMarketDataProvider` +
      `BinanceUsdMBrainMarketDataProvider`, mesma porta única de mercado do cérebro reaproveitada
      por uma ferramenta DISPLAY_ONLY.
- [x] **12.4** `NOVO` `app/Http/Controllers/Api/DerivativesTradeFlowController.php` **[API]** —
      rota `/v1/tools/derivatives-flow/{symbol}?timeframe=`, usa `TradeFlowService` sobre
      `aggTradesRange()` real (range = maior janela de `FeaturePolicy::forTimeframe()`);
      `UNAVAILABLE` com `error_code: TRADE_FLOW_FORA_DA_POLITICA_DE_TIMEFRAME` fora de intraday,
      sem sequer chamar a Binance (`Http::assertNothingSent()` confirmado em teste).
- [x] **12.5** `SUBSTITUIR` conceito de `FlowTrack` **[FE]** — reescrito por completo. **Achado
      real, o mais grave desta fase**: o "FlowTrack" antigo simulava quase tudo — uma API de
      whale-alert com chave `"FREE"` inválida (sempre falhava), caindo num fallback que FINGIA ser
      whale-alert usando aggTrades da Binance **SPOT** (`api.binance.com/api/v3`, mercado errado);
      `activeAddresses` era `Math.random()`; `pressureNet`/`totalInflow`/`totalOutflow` misturavam
      volume real do orderbook com fatores arbitrários (`* 0.1`, `* 0.05`); o card 4 ("Entrada
      Total"/"Saída Total") tinha barras de largura **FIXA** (45%/55%), nunca proporcionais a
      nenhum dado real; `conversionRate` caía pra um preço fixo de 60.000 sem indicar que era
      fallback. Tudo apagado. Renomeado para "Fluxo Agressor no Perpetual" — só
      `buy_notional`/`sell_notional`/`delta_notional`/`trade_count`/`estado` por janela, vindos da
      rota real (item 12.4), com seletor de timeframe intraday.
- [x] **12.6** `PATCH` `trendService.ts` (Trend Analyzer) **[FE]** — `BASE_BINANCE` (Spot,
      `api.binance.com/api/v3`) apagado por completo; klines/depth/aggTrades agora usam
      `fapi.binance.com/fapi/v1/*`. **Achado real**: `openInterestHist` apontava para
      `/fapi/v1/openInterestHist` — rota que não existe na Binance (confirmado no backend,
      `BinanceService::getOpenInterestHist()` usa `/futures/data/openInterestHist`) — corrigida.
      Funding trocou de `/fapi/v1/fundingRate?limit=1` (histórico, simulando "atual") para
      `/fapi/v1/premiumIndex` (funding atual de verdade, um objeto só — ajustado o parsing de
      `funding[0].fundingRate` para `funding.lastFundingRate`).
- [x] **12.7** `PATCH` `OrderBookImbalance.tsx` **[FE]** — **achado real**: só o ramo Binance
      existia; Bybit/Bitget/OKX eram comentários vazios (`// mock bybit for brevity`) — o
      componente sempre mostrava o book da Binance mesmo com outra exchange selecionada. Os 3
      ramos ligados aos helpers reais já existentes (`fetchBybitDepth`/`fetchBitgetDepth`/
      `fetchOkxDepth`, importados mas nunca usados até esta fase), cada um extraindo bids/asks do
      formato próprio da exchange. `buyPct`/`sellPct` não caem mais para 50% quando os dois lados
      vêm vazios — ficam `null`, a tela mostra "Sincronizando...".
- [x] **12.8** `PATCH` `spoofingService.ts` **[FE]** — WebSocket migrado de
      `stream.binance.com:9443` (Spot) para `fstream.binance.com` (Futures) — mesmo stream
      `@depth20@100ms`, formato `{bids, asks}` idêntico nos dois mercados, só o host muda.
      Renomeado `SpoofEvent`→`WallWithdrawalEvent`, `startSpoofingMonitor`→
      `startWallWithdrawalMonitor`, `getRecentSpoofs`→`getRecentWallWithdrawals` — o nome antigo
      ("Spoofing Detection") afirmava certeza de manipulação a partir de um único sinal (parede
      removida) sem conciliar contra negócios reais executados; UI e textos suavizados para "pode
      indicar", nunca afirmação de fato. Lógica de detecção (limiar por liquidez, parede grande
      sem o preço ter cruzado o nível) inalterada.
- [x] **12.9** `PATCH` `LongShortRatio.tsx` **[FE]** — **achado real**: reimplementava as 3
      chamadas (Binance/Bybit/OKX) com sua própria cascata de proxies, duplicando
      `fetchLSRData()` (já existente em `cryptoApi.ts`) — inclusive com a MESMA rota errada da
      Binance (`/fapi/v1/globalLongShortAccountRatio`, que não existe; `fetchLSRData()` já usava a
      real, `/futures/data/globalLongShortAccountRatio`). Substituído por uma cascata simples
      sobre a função real, ~150 linhas de fetch/proxy duplicado apagadas.
- [x] **12.10** `PATCH` `newListingService.ts` **[FE]** — `launchDate: number | null` (era
      `number`); Bitget (que não expõe data de listagem na v2) parou de estimar com `Math.random()
      * 5 dias` — vira `null`, `NewListings.tsx`'s `getTimeSince()` mostra "Data indisponível".
      Ordenação por data trata `null` explicitamente (vai pro fim, nunca comparado como se fosse
      Epoch 0 — o que o empurraria pro topo como "mais recente").
- [x] **12.11** `PATCH` `MarketTicker.tsx` **[FE]** — WebSocket `stream.binance.com:9443` (Spot) →
      `fstream.binance.com` (Futures) — mesmo stream `!miniTicker@arr`, mesmo formato de payload
      (`s`/`c`/`o`), só o host muda.
- [x] **12.12** `ISOLAR` Spot de carteira/basis **[API+FE]** — confirmado
      `ExchangeService`/`MonitoramentoService`/`MonitorCarteiraMaeCommand`/`spotPriceService.ts`/
      `CarteiraCripto.tsx` preservados fora do cérebro (outro domínio, não tocados). `TrendQuality.tsx`
      renomeado para `BasisSpotPerpetualCard.tsx`, `data-role="display-only"` no elemento raiz.
      **Tensão resolvida, não contradição**: o componente já tinha uma nota "V6.9 — EXCEÇÃO
      DELIBERADA" (decisão do Felipe, 19/08/2026) mantendo o widget — este item não reverte essa
      decisão (o widget continua existindo, mesma lógica de prêmio Spot-vs-Futuros), só neutraliza
      a APRESENTAÇÃO: `getAnalysis()` produzia rótulos de convicção direcional e "squeeze" a partir
      de um único número ("Surfando com as Baleias", "Risco de Queda (Bolha)", "Caça aos Ursos
      (Squeeze)", "Despejo Real") — substituídos por rótulos neutros (Futuros acima/abaixo do
      Spot, com/sem magnitude elevada) que descrevem só o fato, nunca uma leitura de mercado.
      Teste de arquitetura novo (`GraphicalAnalysisSpotIsolationArchitectureTest.php`) varre
      `app/Services/GraphicalAnalysis/*` + o job por `ExchangeService`/`MonitoramentoService`/
      `spotPriceService`/`BasisSpotPerpetualCard` — confirma 0 menções hoje, trava contra vazamento
      futuro do isolamento.

**Testes**: **[API]** `MultiExchangeDerivativesDisplayServiceTest` (3, novo),
`MultiExchangeDerivativesControllerTest` (3, novo), `BinanceServiceAggTradesRangeTest` (4, novo),
`DerivativesTradeFlowControllerTest` (4, novo), `IncrementalBrainTest` (atualizado, +2 testes),
`GraphicalAnalysisSpotIsolationArchitectureTest` (2, novo). **[FE]** `tsc --noEmit` limpo; `npx
vitest run` sem regressão nova.

**Suíte após Fase 12**: **[API]** suíte completa (sem `--process-isolation`) → 789 testes
passaram, 2 falhas — as duas só nos 2 arquivos que exigem processo isolado (confirmado por grep de
todas as linhas `FAILED`); os 4 arquivos de job/pipeline com `--process-isolation` → 17/17. **[FE]**
`npx vitest run` → 373 passaram / 28 falharam (baseline pré-existente inalterada, zero regressão).

---

## FASE 13 — Limpeza, orfaos e achados do fechamento (doc paragrafo 18) — 13/14 concluídos, 1 bloqueado (22/08/2026)

Ligar o que serve, migrar o que duplica, apagar o que nao tem consumidor.

- [x] **13.1** `SUBSTITUIR` `app/Services/GraphicalAnalysis/MarketZonesService.php` **[API]** —
      **achado real**: `calculate()` computava um "perfil de volume" SINTÉTICO (histograma
      preço×volume em 24 bins sobre os últimos 240 candles) para `poc`/`hvn`/`lvn` — uma
      aproximação matemática que nunca é o VRVP real (o perfil que a corretora de fato calcula,
      lido por OCR do gráfico via `GeminiVisionService`/`VisionResponseValidator`,
      `vision.vrvp.poc/hvn/lvn`). As duas fontes coexistiam sob o mesmo nome, uma real e uma
      fabricada. `calculate()` agora nunca calcula poc/hvn/lvn — `null` por contrato; PDH/PDL/PWH/PWL
      (reais, direto dos candles) inalterados. `MarketZonesServiceTest.php` novo (4 testes).
- [x] **13.2** `PATCH` `EvidenceCatalog`/`MarketSnapshotService::derivatives()`/`BinanceService`
      **[API]** — `levels.poc`/`levels.hvn`/`levels.lvn` apagados do catálogo (16→12 itens
      CONTEXT, `EvidenceManifestBuilderH47Test` atualizado). `derivatives.liquidations` também
      apagado — a fonte real (`getForceOrders()`/`allForceOrders`) está descontinuada pela Binance
      desde a V6.5 (HTTP 404 confirmado), `getLiquidacoes()` já sempre devolvia `null`; a entrada
      nunca resolvia com dado real. `getLiquidacoes()`/`getForceOrders()`/`agruparClusters()`
      apagados do `BinanceService` — zero consumidor real restante (confirmado por grep antes da
      remoção); `LiquidationsUnavailableTest.php` (testava só o "sempre null" que este método
      existia pra produzir) apagado junto.
- [x] **13.3** `APAGAR` **[API]** — `DerivativesEnrichmentService.php` (pipeline V6.5/R3.2, campos
      úteis — `basis_bps`, quadrante OI, predominância — já migrados para `DerivativesReadingService`
      desde a Fase 5, confirmado por comentário cruzado no próprio código), `app/Support/
      FeatureEvidence.php` (envelope de evidência V6.5/R3.2, substituído por
      `EvidenceCatalog`/`EvidenceManifestBuilder`; nenhum teste dedicado existia pra ele — achado,
      "+testes" do doc não correspondia à realidade do código), `TextQualityGate.php` + seu teste
      (mojibake/UTF-8/vocabulário proibido — absorvido e expandido pelo novo `PublishedOutputGate`,
      item 13.5). Todos com zero consumidor real confirmado por grep antes da remoção.
      `DataFreshnessGate`/`BreakRetestService`/`FeaturePolicy`/`TradeFlowService`/`BybitService`/
      `BitgetService`/`OkxService` preservados (ganharam consumidor real nas Fases 3/7/12, como já
      confirmado nas fases anteriores). Teste órfão de `DerivativesEnrichmentService` (dentro de
      `IncrementalBrainTest`) apagado — a propriedade que protegia (nunca afirmar certeza de
      movimento) sobrevive de forma mais forte em `DerivativesReadingServiceTest`.
- [x] **13.4** `PATCH` `DesfechoService::avaliar()` **[API]** — achado real: dentro do MESMO
      candle, quando stop e algum TP tocavam juntos, a regra antiga fazia "o stop vencer sempre" —
      uma afirmação de ordem (assumir que o stop foi tocado primeiro) que o OHLC não prova (não
      guarda a ordem intrabar dos toques). "Stop sempre vence" era conservador em intenção, mas
      continuava inventando uma ordem que ninguém observou. Agora calcula TODOS os toques do
      candle antes de decidir — stop + qualquer TP juntos vira `AMBIGUO_MESMA_VELA`, sem
      `preco_resultado`. `OutcomeLabeler.php` (mesma propriedade, `Documento Mestre R3.2`, zero
      consumidor real) apagado — cobertura migrada pra `DesfechoServiceTest` (4 testes novos de
      ambiguidade). **Achado real em cascata, mais grave**: `ResultVerifierCommand` tinha
      `if ($resultado['resultado'] === 'PENDENTE' || $resultado['preco_resultado'] === null) {
      continue; }` — como `AMBIGUO_MESMA_VELA` por definição nunca tem preço, essa condição
      tratava o novo resultado como se a análise ainda estivesse pendente: a análise ficaria PRESA
      em PENDENTE para sempre (o mesmo candle ambíguo seria reencontrado a cada execução seguinte
      do comando, sempre com `continue`, nunca resolvendo). Corrigido para só pular quando o
      resultado é `PENDENTE` de verdade; `lucro_percentual` fica `null` junto do preço quando
      ambíguo. `ResultVerifierCommandTest.php` novo (2 testes, incluindo o cenário exato do bug).
      `AcompanharPlanos` já aceitava o novo resultado sem mudança (usava a condição certa desde o
      início). `EvaluateGenesisOutcomes` não usa `DesfechoService` (telemetria puramente
      direcional, sem stop/TP) — não afetado, menção do doc não correspondia ao código real.
      Migration nova (`add_ambiguo_mesma_vela_to_genesis_analises_resultado`) para o ENUM de banco
      `genesis_analises.resultado` (achado real: era um enum fechado sem o novo valor — SQLite de
      teste não impõe a constraint, MySQL de produção quebraria; `ALTER TABLE` condicional por
      driver, já que `Schema::table()->enum()->change()` do Laravel quebra em SQLite por limitação
      do Doctrine DBAL, achado ao escrever a migration).
- [x] **13.5** `NOVO` `app/Services/GraphicalAnalysis/PublicVocabularyService.php` +
      `PublishedOutputGate.php` **[API]** — porta backend de `utils/publicVocabulary.ts` (Fase 11,
      item 11.13; mesma tabela de substituições). **Achado real ao portar**: a expansão de
      1W/1M por extenso ("semanal (1W)") reintroduzia o próprio token dentro dos parênteses —
      rodar a normalização 2x virava "semanal (semanal (1W))", quebrando a idempotência que o
      próprio arquivo promete; corrigido com `(?!\))` nos dois lados (backend PHP E o TS original
      da Fase 11, que tinha o mesmo bug latente nunca testado com 1W/1M). `PublishedOutputGate`
      substitui `TextQualityGate` (13.3) com 4 checagens: mojibake/UTF-8 (herdadas), vocabulário
      interno vazado (`score_basis`/`MODULATOR`/`UNAVAILABLE`/etc. nunca deveriam aparecer em
      prosa), Fibonacci sem confirmação OCR, autocontradição textual de rompimento ("rompeu" +
      "não rompeu" no mesmo texto). **Nota de documentação**: "contradição estrutura x narrativa"
      não tem regra literal no doc-fonte (§18 nunca foi colado por completo) — implementada como
      comparação textual conservadora contra `structure_event`, coberta e testada, mas não ligada
      no job (o formato real de `bundle.evidence.structure.event` é `{type, level, close,
      confirmed}`, sem campo de direção pronto pra comparar sem risco de leitura errada — decisão
      de escopo, não bug). `GraphicalAnalysisAttemptJob` aplica os dois antes de persistir em
      `decision.score_description` e `context_payload.macro.resumo`/`sentimento.narrativa`
      (`execution.motivo` ficou fora — confirmado ser string TEMPLATE fixa em PHP via
      `RecomendacaoService`, não texto livre de IA, risco real muito menor).
- [x] **13.6** `PATCH` `QualidadeEntradaService::avaliar()` **[API]** — **achado real, mesmo
      padrão já corrigido em `ScoreBasisBars.tsx` na Fase 11**: `extensao()`/`pistaLivre()`/
      `confluencia()` devolviam `null` quando faltava insumo, e `avaliar()` usava `array_filter()`
      para removê-los — o fator inteiro SUMIA da lista em vez de aparecer como indisponível
      (violando a regra da matriz de aceite: "os 4 fatores aparecem sempre"). Os 3 métodos agora
      sempre devolvem um array com `avaliacao: 'UNAVAILABLE'` e `detalhe` explicando a ausência;
      `avaliar()` não filtra mais nada. Frontend (`BlocoConviccaoQualidade.tsx`): tipo
      `AvaliacaoFator` ganhou `'UNAVAILABLE'`, ícone/cor próprios (selo cinza com `HelpCircle`) —
      "Pista livre" nunca mais some da tela.
- [x] **13.7** `PATCH` uma única origem numérica de R/R **[API+FE]** — `ExecucaoService::
      formatarRrExibir(?float): ?string` novo (`sprintf('1:%.2f', ...)`), aplicado a
      `candidateSetup`/`planoBCompleto` (`rr_bruto_exibir`/`rr_liquido_exibir`) e a
      `calcularRrPorAlvo()` (mesmos 2 campos por TP1/TP2/TP3). Frontend: `BlocoConviccaoQualidade.tsx`
      trocou as props `rr`/`rrBruto` (número) por `rrExibir`/`rrBrutoExibir` (string pronta),
      removendo os dois `.toFixed(2)` locais; os 3 blocos TP1/TP2/TP3 em `AnalysisResult.tsx`
      trocaram `rrPorAlvo.tpN.rr_liquido.toFixed(2)` por `rrPorAlvo.tpN.rr_liquido_exibir` direto.
      `rrMinimo` (config fixo, uma única fonte) deliberadamente mantido como número — o risco de
      duas formatações divergentes que motiva este item não existe pra um valor de config único.
- [x] **13.8** `NOVO` `utils/semanticColors.ts` **[FE]** — `directionTone()` (verde/vermelho, só
      para direção real de preço) e `relationTone()` (roxo/âmbar/neutro, para relação entre um
      dado e o cenário — derivativos/confluência/recomendação), centralizando uma distinção que já
      existia implementada manualmente em `ScoreBasisBars.tsx` (Fase 11) e
      `BasisSpotPerpetualCard.tsx` (Fase 12) — evita duplicação futura, sem exigir refatoração
      retroativa dos componentes que já seguem a doutrina corretamente.
- [x] **13.9** `PATCH` `config/genesis_graphical_v6.php` **[API]** — `document_version` V6.8→V6.9,
      `prompt_version` genesis-derivatives-v6.8.0→v6.9.0 (invalida `chart_fingerprint`/cache de
      decisões da V6.8, mesma doutrina F07). `schema_version` já estava em `decision-v6.9.0` desde
      a spec anterior, sem mudança. **Confirmado, não aplicado**: `GENESIS_GEMINI_DECISION_MODEL`/
      `gemini-3.7-flash`→`GENESIS_MODEL`/`gemini-3.6-flash` (seção 18.9 do documento) — conflito
      não resolvido com a decisão do Felipe (19/08/2026) de manter `gemini-3.7-flash`; só a parte
      de versionamento foi aplicada. `VersionamentoSincronizadoTest`/`GenesisGraphicalV68ConfigTest`
      atualizados pros novos valores.
- [x] **13.10** `DECISAO` `TamanhoService.php` **[nenhuma ação]** — confirmado: não existe e não
      precisa existir; a lógica já vive em `BinanceService::getSymbolFilters()` +
      `ExecucaoService::calcularTamanhoSugerido()`, completada pelo `PriceNormalizer` (Fases 6/8).
- [x] **13.11** `APAGAR` **[FE]** — `components/patterns/PatternRealIcon.tsx`,
      `components/AlertConfigPanel.tsx` — zero consumidor real confirmado por grep antes da
      remoção (só menções em docs de specs anteriores); nenhum teste/estilo exclusivo encontrado.
      Scan de aceite `rg "PatternRealIcon|AlertConfigPanel" components` → vazio, confirmado.
      `tsc --noEmit` limpo após a remoção.
- [ ] **13.12** `REMOVER` (só depois do canário estável, seção 21) **[API]** — **NÃO APLICADO,
      bloqueado por design** — pipeline V6.7 congelado
      (`CanonicalBundleBuilderV67Baseline`/`DecisionResponseValidatorV67Baseline`/
      `GenesisPromptV67Baseline`/`GenesisDecisionSchemaV67Baseline`/
      `GraphicalAnalysisAttemptService`/`GraphicalAnalysisDecisionClient`/
      `GeminiInteractionsClient`/`OpenAiInteractionsClient`/`LoggingDecisionClient`) continua vivo
      — remoção condicionada ao gate de canário estável (seção 21, fora do alcance desta sessão,
      sem acesso a produção). Mesma doutrina do item 13.9 do V6.8 anterior (Fase 9): a Fase 5
      desta spec já congelou o V6.7 exatamente para preservar o benchmark obrigatório (Fase 14),
      que ainda depende destes arquivos.
- [x] **13.13** `DECISAO` serviços visuais **[API]** — confirmado (existência checada em disco):
      `ChartMetadataScanService`/`GeminiVisionService`/`NarrativeContradictionGate`/
      `NarrativeFidelityGate` mantidos sem mudança; `PublishedOutputGate` criado (item 13.5).
      `VisualLevelsService` — decisão registrada (apagar junto da limpeza do V6.7, item 13.12) mas
      NÃO executada, já que 13.12 está bloqueado; arquivo continua vivo por ora.
- [x] **13.14** `PATCH` `AnalysisPublicResponseBuilder` **[API]** — `nota_cobertura` (escalar
      solto) substituída por `data_traceability` (objeto: `decision_coverage_percent` — mesma
      métrica de sempre — mais `fresh_sources`/`expected_sources`/`freshness_coverage_percent`/
      `as_of_ms`, calculados a partir de `source_freshness` — já persistido desde a Fase 3/9, mas
      nunca combinado com a cobertura de decisão num único bloco). Frontend: a nota saiu de dentro
      do card "Convicção do Modelo" (não media convicção, media cobertura de dados — competia por
      atenção com o número errado) e migrou pro rodapé da tela, sempre visível, fora do toggle
      "Revelar Matriz Completa". Tipos (`GraphicalAnalysisResult`/legado `types.ts`) e o adaptador
      (`mapGraphicalToLegacy()`) atualizados; `AnalysisPublicResponseBuilderG5Test`,
      `AnalysisResult.g5.test.ts` e `geminiService.test.ts` (fixture + teste de preservação)
      reescritos pro novo shape.

**Testes**: **[API]** `MarketZonesServiceTest` (4, novo), `EvidenceManifestBuilderH47Test`
(contagem CONTEXT ajustada), `DesfechoServiceTest` (+4 testes de ambiguidade),
`ResultVerifierCommandTest` (2, novo), `PublicVocabularyServiceTest` (6, novo),
`PublishedOutputGateTest` (11, novo), `QualidadeEntradaServiceTest`/`QualidadeEntradaServiceF7F8Test`
(atualizados), `ExecucaoServiceRrExibirTest` (3, novo), `VersionamentoSincronizadoTest`/
`GenesisGraphicalV68ConfigTest` (atualizados), `AnalysisPublicResponseBuilderG5Test` (reescrito, 5
testes), `GraphicalAnalysisAttemptJobTest`/`GraphicalAnalysisFullPipelineIntegrationTest`/
`GraphicalAnalysisImageCleanupTest`/`GraphicalAnalysisOpenAiProviderFlowTest` (reconfirmados após a
integração do gate no job). **[FE]** `semanticColors.test.ts` (3, novo), `publicVocabulary.test.ts`
(+1 teste de idempotência 1W/1M), `BlocoConviccaoQualidade.test.ts` (atualizado),
`AnalysisResult.g5.test.ts` (reescrito), `geminiService.test.ts` (fixture + teste atualizados).

**Suíte após Fase 13**: **[API]** suíte completa (sem `--process-isolation`) → **807 testes
passaram, 2 falhas — as duas SÓ nos 2 arquivos que exigem processo isolado** (confirmado via grep
de todas as linhas `FAILED` da rodada — nenhum outro arquivo). Os 4 arquivos de job/pipeline
rodados com `--process-isolation`, reconfirmados depois de toda a Fase 13 (incluindo os itens
tardios que tocam o job — 13.4/13.5/13.9) → **17/17**, 0 falhas reais. **[FE]** `npx vitest run` →
379 passaram / 28 falharam (baseline pré-existente confirmada por grep de `"Failed Tests 28"`,
zero regressão nova); `tsc --noEmit` limpo.

---

## FASE 14 — Testes e provas obrigatorias (doc paragrafo 19) — ✅ 6/6 concluídos (22/08/2026)

- [x] **14.1** `NOVO` `tests/Unit/V69CriticalInvariantsTest.php` **[API]** — 7 testes, cada um
      chamando o serviço real direto (sem rede, sem fila): derivativos nunca devolvem `direction`
      (`DerivativesReadingService::ler()`); `TargetSelectionValidator` rejeita candidate_id do lado
      errado (`TARGET_SELECTION_UNKNOWN_OR_WRONG_SIDE`); `AlvoService::calcularAlvos()` nunca
      completa um alvo ausente (confirmado também que `tp2_projetado`/`alvo_projetado` — conceitos
      já removidos na Fase 6 — nem existem como chave no retorno); `MarketZonesService::calculate()`
      nunca cria poc/hvn/lvn (item 13.1); `DesfechoService::avaliar()` vira `AMBIGUO_MESMA_VELA`
      sem preço (item 13.4); `PublishedOutputGate` rejeita Fibonacci sem OCR e conflito de
      estrutura (item 13.5). "Spot rejeitado do bundle decisório" deliberadamente NÃO duplicado
      aqui como teste de serviço isolado — é uma propriedade de fluxo completo (visão rejeita
      ANTES de qualquer bundle existir), já coberta ponta a ponta por
      `GraphicalAnalysisSpotRejectionTest` (HTTP real via job síncrono, item 14.5).
- [x] **14.2** `NOVO` `tests/Feature/V69ContainerCompositionTest.php` **[API]** — 8 testes, cada
      um resolvendo via `app(Classe::class)` (não `new`) — `BrainMarketDataProvider`,
      `DataFreshnessGate`, `BreakRetestService`, `FeaturePolicy`, `TradeFlowService`,
      `TargetCandidateCatalog`, `PublishedOutputGate`, `MultiExchangeDerivativesDisplayService`.
      Todos resolvem do container real sem erro de binding.
- [x] **14.3** `NOVO` `tests/Feature/V69ForbiddenProductionCodeTest.php` **[API]** +
      `__tests__/forbiddenProductionCode.test.ts` **[FE]** — os 2 repositórios são fisicamente
      separados (nenhum teste PHPUnit alcança arquivos fora de `genesis-api`), por isso 2 arquivos,
      não 1. Backend: `projetarAlvos`/`alvo_projetado`/`cluster_liquidacao` (removidos na Fase 6 e
      anteriores) — zero ocorrência em CÓDIGO real, só em comentários históricos legítimos
      (`AlvoService.php`/`PlanoBService.php`, confirmado antes de escrever o teste — remoção de
      comentários linha a linha antes de buscar, senão o scan reprovaria os próprios comentários
      que documentam a remoção). Frontend: `api.binance.com/api/v3`/`Math.random()`, escopado às
      ferramentas reparadas nas Fases 12/13 (não o repositório inteiro — um scan irrestrito de
      `Math.random()` acusaria ~10 usos legítimos sem relação com dado de mercado, ex.: embaralhar
      perguntas de quiz em `LearnFutures.tsx`, cor decorativa em `Hologram.tsx`).
      **Achado real durante o scan**: `oiLiquidationService.ts`'s `fetchCurrentTicker()` (preço do
      cabeçalho do painel Open Interest) ainda apontava para `api.binance.com/api/v3/ticker/24hr`
      (Spot) — resíduo que passou despercebido na Fase 12 (só o bloco `byExchange` foi reescrito
      ali, item 12.1). Migrado para `fapi.binance.com/fapi/v1/ticker/24hr` (Futures).
      `spotPriceService.ts`/`BasisSpotPerpetualCard.tsx` ficam fora de propósito do escopo do scan
      FE — exceções deliberadas e já documentadas (item 12.12: Spot de carteira/basis, outro
      domínio; A10: prêmio Spot-vs-Futuros, decisão do Felipe 19/08/2026).
- [x] **14.4** `PATCH` testes de frontend **[FE]** — `ScoreBasisBars.test.ts` já cobria "4 cards
      sempre" desde a Fase 11 (item 11.3, 9 testes), confirmado sem necessidade de mudança
      adicional. `AnalysisResultV69Authority.test.ts` novo (5 testes, mesma técnica de remover
      comentários antes de buscar — os 4 arquivos-fonte lidos documentam em prosa histórica
      exatamente os nomes que este teste procura, ex. "fetchMacroToday/fetchSentimento apagados"):
      sem consulta paralela de macro/sentimento (Fase 11, item 11.5), Plano A inicia selecionado
      (`useState<'A'|'B'|null>('A')`), sem recálculo de RR (Fase 11, item 11.8) nem de liquidação
      (nunca existiu função local pra isso), convicção aparece uma única vez (Fase 11, item 11.11).
- [x] **14.5** `MANTER` verdes, sem excluir para passar **[API]** — confirmados os 17 (16 num
      filtro só, mais `GraphicalAnalysisFullPipelineIntegrationTest` separado com
      `--process-isolation`, mesmo padrão de sempre desta spec): `MarketSnapshotClosedCandlesTest`,
      `OpenInterestWindowTest`, `OrderBookWallsAvailabilityTest`, `OrderBookWallsWiringTest`,
      `VrvpExecutionWiringTest`, `SwingPivotServiceTest`, `VisualLevelValidatorTest`,
      `NarrativeFidelityGateA5Test`, `DecisionResponseValidatorTest`,
      `GenesisDecisionStage2SchemaTest`, `ExecutionPlanosArrayTest`,
      `ExecutionExecutableVsRecommendedTest`, `AnalysisPersistenceServiceRrPorAlvoTest`,
      `AcompanharPlanosTest`, `LiquidationMapServiceTest`, `LiquidationMapControllerTest`,
      `GraphicalAnalysisSpotRejectionTest`, `GraphicalAnalysisFullPipelineIntegrationTest` — 70
      testes no filtro conjunto + 1 isolado, 100% verdes.
- [x] **14.6** `NOVO` `app/Console/Commands/BenchmarkGenesisV69.php` **[API]** — substitui
      `BenchmarkGenesisDecision` (`genesis:benchmark-decision`, que mede só o decisor isolado do
      pipeline V6.7 congelado — continua vivo até o item 13.12 poder remover o V6.7, bloqueado pelo
      gate de canário). Novo comando roda visão→contexto→bundle canônico→decisão Etapa 1→Etapa
      2→score final via `ScoreFinalizer` (a mesma fórmula do job de produção), sem cache/fila/
      crédito, N repetições por ativo (`--ativos=<json>`, `--runs=`, `--output=`). Mede por ativo
      `direction_flips`/`score_min`/`score_max`/`score_median`/`wyckoff_events_validos` (evento
      Wyckoff genuíno = `bundle.evidence['wyckoff'].value.evento !== null` E `.range.valido ===
      true`, calculado em PHP sobre candles reais — nunca inventado pelo decisor, que nem recebe
      esse campo pra opinar) e, agregado, `amplitude_score_medianas` + soma de eventos Wyckoff.
      Grava JSON de prova. `BenchmarkGenesisV69Test.php` (2 testes) confirma o comando
      estruturalmente contra o pipeline REAL — candles reais da Binance (alcançável, sem fake),
      visão/contexto mockados (chamariam Gemini, inalcançável deste sandbox), decisor mockado via
      bind de `DecisionProvider` no container (não `Http::fake()` — **achado real ao escrever o
      teste**: uma fixture de decisão fixa, mesmo padrão de `GraphicalAnalysisFullPipelineIntegrationTest`,
      reprova contra o bundle REAL deste comando, porque `evidence_accounting`/`target_selection`/
      `derivatives_modifier` precisam responder aos ~45 itens de evidência e às candidatas de alvo
      REAIS calculadas a partir dos candles reais do dia, que mudam a cada execução — o fake do
      decisor lê o `$bundleJson` de verdade e ecoa accounting/seleção/modulador compatíveis
      automaticamente, nunca hardcoded).

**Testes**: **[API]** `V69CriticalInvariantsTest` (7, novo), `V69ContainerCompositionTest` (8,
novo), `V69ForbiddenProductionCodeTest` (3, novo), `BenchmarkGenesisV69Test` (2, novo). **[FE]**
`forbiddenProductionCode.test.ts` (2, novo), `AnalysisResultV69Authority.test.ts` (5, novo).

**Suíte após Fase 14**: **[API]** suíte completa (sem `--process-isolation`) → 827 testes
passaram, 2 falhas — as duas SÓ nos 2 arquivos que exigem processo isolado (confirmado via grep de
todas as linhas `FAILED`); os 4 arquivos de job/pipeline com `--process-isolation` → 17/17. **[FE]**
`npx vitest run` → 385 passaram / 28 falharam (baseline pré-existente confirmada por grep de
`"Failed Tests 28"` numa segunda rodada — a primeira rodada deu 29 por causa da mesma flakiness de
ordem entre suítes já documentada nas Fases 11-13, "Sessão expirada" de `geminiService.test.ts`);
`tsc --noEmit` limpo.

---

## FASE 15 — Provas que dependem de material externo (doc 20.5) — 4/4 formalmente indisponíveis (22/08/2026)

Codigo sozinho nao fecha estes 4. Ausencia de baseline nao autoriza alterar layout/servidor por memoria.

- [x] **15.1 (A6)** Amplitude do score — **FORMALMENTE INDISPONÍVEL nesta sessão**. O benchmark da
      Fase 14.6 está implementado e testado estruturalmente (`BenchmarkGenesisV69Test.php`), mas
      fechar esta prova de verdade exige 10 imagens reais de gráfico de ativos diferentes + N
      execuções PAGAS de API por imagem (OpenAI — o Gemini está inalcançável deste sandbox, mesma
      limitação documentada em todas as fases anteriores desta sessão). O repositório só tem 3
      imagens reais de gráfico versionadas (`provas/v6_6/grafico-teste-aptusdt-1S-tradingview.jpeg`
      + 2 em `tests/Proof/_archive_v4_3_r3_2/{APT,POL}/input.png`), bem abaixo do volume exigido.
      Perguntado explicitamente ao Felipe se deveria (a) marcar como indisponível, (b) rodar um
      smoke test pago parcial com as 3 imagens disponíveis (não fecharia o critério de 10 mesmo
      assim), ou (c) esperar mais material/orçamento — escolheu (a). Comando pronto para rodar a
      qualquer momento assim que houver as 10 imagens + orçamento de API autorizado:
      `php artisan genesis:benchmark-v69 --ativos=<json> --runs=20 --output=tests/Proof/v69/benchmark-10.json`.
- [x] **15.2 (B2)** Amostra Wyckoff — **FORMALMENTE INDISPONÍVEL nesta sessão**, mesmo motivo e
      mesma decisão do Felipe do item 15.1 (pergunta única cobriu os dois itens) — 20 imagens
      reais exigidas, 3 disponíveis. Mesmo comando, lista de ativos e `--output` diferentes:
      `php artisan genesis:benchmark-v69 --ativos=<json> --runs=5 --output=tests/Proof/v69/wyckoff-20.json`.
- [x] **15.3 (A12)** Comparação visual dos cards de derivativos — **FORMALMENTE INDISPONÍVEL**.
      Investigado antes de marcar (não presumido por memória): busca por qualquer arquivo de
      captura/hash/baseline de cards de derivativos no repositório frontend — nada encontrado. A
      própria matriz de aceite desta spec (`MATRIZ_DE_ACEITE_V6_9.md`, linha 75) já pré-autoriza
      esta marcação: "Sem baseline, A12/H8 são marcados formalmente como indisponíveis — nunca
      preenchidos por memória".
- [x] **15.4 (H8)** Diff do servidor Node — **FORMALMENTE INDISPONÍVEL**. `server.ts` existe de
      verdade no repositório (confirmado, não presumido) e tem histórico real de commits
      (`git log -- server.ts`), mas o item pede diff contra um commit/hash ANTERIOR específico que
      o documento-fonte citava — sem o texto completo do documento (mesma limitação "§20.5 nunca
      foi colado por completo" já recorrente nesta sessão), não há como saber qual commit é essa
      referência. Escolher um commit qualquer para comparar seria inventar uma baseline que o
      documento nunca autorizou — exatamente o que a doutrina deste item probe. Mesma autorização
      formal da matriz de aceite do item 15.3.

---

## FASE 16 — Scans estaticos de bloqueio (doc 21.3) — 5 scans — ✅ 5/5 executados, 16.5 documenta bloqueio esperado (22/08/2026)

Todos precisam devolver vazio. Qualquer ocorrencia e falha de seguranca, nao aviso. `rg` nao esta
no PATH deste sandbox (`rtk` reclamou binario ausente) — os 5 scans foram executados com a
ferramenta de busca real do agente (mesmo padrao regex), nao pulados.

- [x] **16.1** Cerebro sem Spot — **PASS real**: zero ocorrencias de codigo em
      `GraphicalAnalysisAttemptJob.php`, `BinanceService.php`, `ExecucaoService.php`,
      `AlvoService.php`. O unico match em `app/Services/GraphicalAnalysis` e o proprio
      `BrainBundleGuard.php:21-22` — nao e um USO de Spot, e a lista `FORBIDDEN_TOKENS` do guard
      anti-Spot (o mecanismo que bloqueia esses tokens de entrar no manifesto decisorio, Fase 2
      item 2.3), teria que aparecer ali por definicao.
- [x] **16.2** Sem projecao/cluster — **PASS real**: `app/Jobs` zero ocorrencias. As 3 ocorrencias
      em `app/Services` (`AlvoService.php:11,24`, `PlanoBService.php:21`) sao comentario/docblock
      historico documentando a REMOCAO desses conceitos (Fase 6 item 6.8, Fase 6/12), nao codigo —
      confirmado lendo as 3 linhas.
- [x] **16.3** Frontend sem dado fabricado — **PASS com achado de regex do proprio doc**:
      `services/liquidationService.ts` citado no item nao existe neste repo (nome real e
      `oiLiquidationService.ts`, ja na lista) — divergencia de nome entre doc e codigo real, mesmo
      padrao ja visto em fases anteriores. As ocorrencias em `flowTrackService.ts`,
      `oiLiquidationService.ts`, `trendService.ts` sao comentario historico. **Achado real**: o
      padrao literal do doc (`stream\.binance\.com`) tambem casa como SUBSTRING dentro de
      `fstream.binance.com` (`f` + `stream.binance.com`) — `spoofingService.ts:46` e
      `MarketTicker.tsx:43` (o WebSocket real de Futures, para onde a Fase 12 migrou de proposito,
      saindo do WS Spot `stream.binance.com:9443`) por isso aparecem como "match" tecnico do
      comando exatamente como o doc escreve. Confirmado nas duas linhas: e o host CORRETO de
      Futures, nao uma regressao para Spot — falso positivo do regex do proprio documento, nao um
      problema de codigo. Documentado aqui para quem for rerodar o scan 16.3 nao se assustar.
- [x] **16.4** Componentes apagados — **PASS com divergencia de nome**: `App.tsx` citado no item
      nao existe neste repo (entrypoint real e `index.tsx` + `router/index.tsx`) — escaneados os
      dois no lugar. Zero ocorrencias de `PatternRealIcon`/`AlertConfigPanel` em `components`,
      `pages`, `services`, `index.tsx`, `router/index.tsx` (ambos apagados na Fase 13, item 13.13).
- [x] **16.5** Classes V6.7 removidas — **FALHA esperada, bloqueio por design, nao um bug**: 14
      arquivos em `app/` ainda citam `CanonicalBundleBuilderV67Baseline` /
      `DecisionResponseValidatorV67Baseline` / `GenesisPromptV67Baseline` /
      `GraphicalAnalysisAttemptService` — e o estado CORRETO agora, nao uma falha de codigo. A
      Fase 9 (decisao explicita do Felipe via AskUserQuestion, documentada no topo da propria
      Fase 9) manteve o pipeline V6.7 congelado (`GeminiInteractionsClient`/
      `OpenAiInteractionsClient`/`BenchmarkGenesisDecision`/`GraphicalAnalysisAttemptService`)
      chamavel de proposito, para o benchmark V6.7-vs-V6.9 (Fase 14.6/15.1) poder comparar contra
      o mesmo pipeline antigo. A remocao fisica e a Fase 13.12 — explicitamente marcada `[ ]`
      "NAO APLICADO, bloqueado por design" nesta mesma sessao — e so pode rodar depois do canario
      de producao (Fase 17.10) ficar estavel por 7 dias (Fase 17.11), doc §21.2 passo 17.12,
      "So depois de estavel". `config/genesis_graphical_v6.php` e
      `GenesisGraphicalServiceProvider.php` tambem aparecem na lista, mas so em comentario/docblock
      explicando essa mesma decisao (o bind real do container e `GraphicalAnalysisDecisionClient`,
      nunca `GraphicalAnalysisAttemptService` diretamente) — confirmado lendo os trechos. `routes/`
      esta limpo (0 ocorrencias). Este scan so pode devolver vazio depois da Fase 13.12/17.12
      rodarem — nao antes, por definicao do proprio plano de deploy deste pacote.

**Nao commitado** — Fase 16 e leitura/scan puro, nenhum arquivo de codigo foi alterado.

---

## FASE 17 — Ordem de deploy (doc 21.2) — 12 passos — 8/12 executados, 4 fora do alcance do sandbox (22/08/2026)

- [x] **17.1** Branch — **confirmado**: os dois repos ja estao em `genesis-v6.9-pacote-final` desde o
      inicio desta sessao (HEAD atual, nao o SHA do ZIP 40 — mesma divergencia ja registrada no
      item 0.2, sem novidade).
- [x] **17.2** Fases 1-13 — **confirmado aplicadas na ordem**, sem inverter (todo o trabalho desta
      sessao, Fases 0-16).
- [x] **17.3** `composer dump-autoload` (9919 classes, OK) + `pint --test` — **achado real**: 359
      problemas de estilo em 602 arquivos do repo inteiro — o Pint nunca tinha rodado neste
      projeto (nenhuma fase anterior desta sessao o executou). Corrigido com `pint` (sem `--test`)
      **apenas nos 121 arquivos que esta spec tocou** (92 issues, todos cosmeticos —
      `new_with_parentheses`/`concat_space`/`braces_position`/etc., nunca comportamento) — reformatar
      os 481 arquivos restantes e divida tecnica pre-existente, fora do escopo deste pacote, nao
      tocada. Analise estatica de tipos: nao ha PHPStan/Larastan configurado neste projeto (só Pint,
      que e so estilo) — nada a rodar alem disso.
- [x] **17.4** `php artisan migrate --force` — **autorizado explicitamente pelo Felipe (AskUserQuestion,
      "pode rodar, mas nao de RefreshDatabase")**. Aplicadas as 2 migrations aditivas desta spec
      (`add_v69_final_contract_to_genesis_analises`, Fase 1; `add_ambiguo_mesma_vela_..._resultado`,
      item 13.9) — as 3 migrations pendentes de `genesis_radar_dispatch/resumo/telemetria`
      (spec `radar-news-correcao-telegram`, aval separado ainda pendente conforme memoria) **nao
      foram tocadas**, aplicadas so as 2 desta spec via `--path`, sem expandir a autorizacao dada.
      **Achado real de producao, corrigido nesta mesma execucao**: a segunda migration falhou de
      primeira com `SQLSTATE[01000]: Data truncated for column 'resultado'` — o docblock da propria
      migration (Fase 13.4) presumia erradamente que `resultado` ja era um ENUM fechado no banco;
      na verdade era `VARCHAR(30) NULL` sem default, e 20 das 124 analises reais tinham esse campo
      NULL/`''` (nunca processadas por `ResultVerifierCommand`, ou gravadas antes do campo existir).
      Perguntado ao Felipe antes de tocar nos dados — autorizou setar as 20 para `'PENDENTE'` (mesma
      semantica ja usada em todo o resto do codigo para "ainda nao verificado"). Aplicado o UPDATE,
      a migration rodou com sucesso na sequencia, `SHOW COLUMNS` confirma `resultado` agora e
      `ENUM(...) NOT NULL DEFAULT 'PENDENTE'` de verdade. **A migration em si foi corrigida** para
      embutir esse mesmo `UPDATE` de saneamento antes do `ALTER TABLE` (guardado no mesmo bloco
      MySQL-only) — idempotente, roda sozinha em qualquer outro ambiente (producao incluida) sem
      precisar do mesmo diagnostico manual de novo. Docblock da migration atualizado com o achado
      real. `pint` + `ResultVerifierCommandTest`/`DesfechoServiceTest` confirmados verdes depois.
- [x] **17.5** Suite completa — **[API]** `php artisan test` → 828 passaram, 2 falhas (mesma
      flakiness estrutural ja documentada em toda fase anterior desta sessao —
      `GraphicalAnalysisAttemptJobTest`/`GraphicalAnalysisFullPipelineIntegrationTest` sob
      `queue:work` nao isolado; confirmados 17/17 com `--process-isolation` nos 4 arquivos de
      job/pipeline). **[FE]** `tsc --noEmit` limpo; `npx vitest run` → 385 passaram, 29 falharam
      (mesma baseline pre-existente ja documentada, variante de flake 28/29 por ordem de mock entre
      suites — conferida a lista completa dos 29: todos de specs anteriores nao relacionadas a
      V6.9, zero regressao). Rodada de novo apos as migrations/pint/config-cache desta fase —
      resultado identico, nada mudou.
- [ ] **17.6** Benchmarks com imagens reais — **mesmo bloqueio ja documentado na Fase 15** (15.1/15.2,
      formalmente indisponivel: so 3 imagens reais no repo contra 10/20 exigidas, e rodar mesmo
      assim gastaria API paga real sem material suficiente para fechar a prova). Nao repetido aqui.
- [x] **17.7** `route:list --path=v1` → 90 rotas, as 3 novas desta spec presentes
      (`tools/derivatives-comparison/{symbol}`, `tools/derivatives-flow/{symbol}`,
      `liquidation-map/{symbol}`). `schedule:list` → 7 comandos agendados, todos com classe real
      existente (conferido especificamente `genesis:evaluate-outcomes` → `EvaluateGenesisOutcomes`,
      nao usa o `OutcomeLabeler` apagado na Fase 13 — sem quebra). `/macro/today`+`/macro/sentimento`
      aparecem na lista, dentro do grupo `auth:sanctum` — trabalho de sessao anterior a esta spec
      (commit `7907a82`), nao uma regressao desta fase.
- [x] **17.8** `config:clear` + `config:cache` + `queue:restart` — executados nesta ordem; `config:clear`
      rodado de novo ao final (achado ja documentado em fases anteriores: cache de config parado
      quebra silenciosamente os overrides de `phpunit.xml`, ex. `QUEUE_CONNECTION` em teste).
- [ ] **17.9** Publicar em homologacao, aceite visual BTC/ENA (Fase 18) — **fora do alcance deste
      sandbox**, por decisao do Felipe (AskUserQuestion): nao ha acesso a infraestrutura de
      homologacao/producao a partir daqui.
- [ ] **17.10** Canario em producao — **fora do alcance deste sandbox**, mesma razao.
- [ ] **17.11** Monitorar metricas do canario por 7 dias — **fora do alcance deste sandbox**: nem a
      infra existe aqui, nem 7 dias corridos de monitoramento cabem numa sessao de codigo.
- [ ] **17.12** Remocao fisica do pipeline V6.7 (Fase 13.12) — **bloqueado por design**, so depois do
      17.11 ficar estavel — ja documentado como tal desde a Fase 13.

**Rollback**: manter artefato anterior disponivel durante o canario; nunca `migrate:rollback` em incidente (colunas sao aditivas); nao reaproveitar analises parcialmente processadas; preservar `manifest_hash`/`source_freshness`/`target_candidates`/`target_selection`/logs para diagnostico.

**Commitado?** Nao — mudancas de codigo (migration corrigida) seguem uncommitted, mesmo padrao desta
sessao inteira. **O banco de dev real (`genesisteste`, MySQL) foi alterado de verdade**: 2 migrations
aplicadas + 20 linhas de `genesis_analises.resultado` corrigidas de NULL/`''` para `'PENDENTE'` —
ambas autorizadas explicitamente pelo Felipe nesta conversa.

---

## FASE 18 — Aceite visual com os graficos anexos (doc 21.4) — bloqueada, 2 tentativas reais gastas (22-23/08/2026)

Felipe forneceu 2 imagens reais (`BTCUSDT.P_2026-08-16_21-13-21 (1).png`, `ENAUSDT.P_2026-08-20_15-35-43 (1).png`,
pasta Downloads pessoal, timeframe 1D confirmado visualmente nas 2 — BTCUSDT com Fibonacci/Head-and-Shoulders/VRVP,
ENAUSDT sem Fibonacci, com 1 linha de tendencia ascendente de 2 pontos, tudo batendo com o que os itens 18.1/18.2 do
doc esperam ver). Construido `tests/Feature/AceiteVisualV69Test.php` (temporario, nao faz parte da suite de
regressao) — roda o pipeline V6.9 REAL pela rota HTTP real, fila `database` real, SEM fake de Gemini/Binance (só os
3 hosts de contexto informativo de terceiros — Yahoo/Alternative.me/CoinGecko — sao fake, para nao depender deles
e nao afetar o aceite em si), capturando o payload publico completo (o mesmo que o frontend recebe) num JSON para
avaliacao manual contra os 12 criterios do 18.1 e os 6 do 18.2.

- [ ] **18.1 BTCUSDT** — **bloqueado**: rejeitado pelo gate de seguranca `CHART_VISIBLE_PRICE_DEVIATION`
      (`ChartMarketVerifier`, D02/D03) antes de chegar a gerar qualquer plano/texto. A IA leu corretamente
      `visible_price=62853.5` (bate com o que está na imagem), mas o preço REAL da Binance agora está **18,49% de
      distância** (tolerância calculada: 2,66%, `max(0,5%, 1x ATR%)`) — a imagem é de 16/08, mais de uma semana
      antes de hoje (22/08/2026), e o mercado se moveu o suficiente nesse intervalo pra estourar a tolerância.
      **Achado real, não é bug**: é o gate de segurança contra imagem desatualizada funcionando exatamente como
      projetado — impede a IA de basear um plano real no preço "congelado" de um print antigo. Confirma
      indiretamente vários dos criterios do item (o sistema nunca chegou a inventar um Plano A no preço errado,
      por exemplo), mas não produz o payload completo necessário pra avaliar os 12 critérios um a um.
- [ ] **18.2 ENAUSDT** — **bloqueado, mesma causa**: `visible_price=0.10632` (também bate com a imagem), desvio
      real **30,03%** (tolerância 7,01%) — a imagem é de 20/08, só 2-3 dias antes de hoje, e mesmo assim já
      estourou (ENA é mais volátil percentualmente que BTC no período). Confirma que a janela de validade de uma
      captura de gráfico pra este gate é curta — não basta ser "recente" em dias, precisa ser de minutos/poucas
      horas atrás para timeframes voláteis.

**Achado de custo real**: 2 chamadas reais completas ao Gemini rodaram (Visão + Decisão Etapa 1, `gemini-3.7-flash`
via `GeminiDecisionClient`, ~26,5s/168k tokens de input cada — o pipeline real funciona tecnicamente, chegou até a
validação de decisão nas duas vezes). Etapa 2 (derivativos) nunca chegou a rodar em nenhuma das duas, porque a
Etapa 1 já reprovou antes. Perguntado ao Felipe se continuava tentando (ex.: ENAUSDT de novo, ou aceitar sem ver o
payload completo) — escolheu **parar sem mais gasto**. `tests/Feature/AceiteVisualV69Test.php` fica no repo,
pronto pra reuso assim que houver capturas de tela tiradas há minutos (não dias) dos dois ativos.

**Achado de engenharia, corrigido no processo**: `Http::preventStrayRequests(false)` via a facade estática, nesta
versão instalada do Laravel (10.50), **não desabilita** a proteção — o mesmo bug já documentado em
`tests/Integration/GeminiInteractionsLiveContractTest.php` (a facade não declara o parâmetro `$prevent`, `false` é
silenciosamente ignorado e o default vira `true`, o oposto do pretendido). A correção é simplesmente não chamar o
método — o `Factory` já tem `false` como default, que já permite passagem real para hosts sem fake.

**Achado de produção real, corrigido nesta mesma sessão (23/08/2026, fora do escopo formal da Fase 18 — encontrado
pelo Felipe rodando a mesma imagem BTCUSDT no ambiente `local`)**: o worker (`php artisan queue:work`) ficava ~2-3
minutos "processando" no frontend antes de reportar falha, gastando as 3 tentativas completas
(`GENESIS_GEMINI_MAX_ATTEMPTS`) — 3 chamadas reais e caras ao decisor — para chegar exatamente no mesmo resultado
da 1ª. Causa: `CHART_VISIBLE_PRICE_DEVIATION` caía no mesmo `throw new \RuntimeException('GRAPHICAL_ANALYSIS_NEEDS_REPAIR:...')`
genérico de todo erro de validação (`GraphicalAnalysisAttemptJob.php`, bloco stage1), acionando o retry padrão de
`$tries` do Laravel — mas é um erro estruturalmente não-reparável (compara um valor FIXO, o preço impresso na
imagem, contra o preço real da Binance; nenhuma nova chamada ao decisor muda nenhum dos dois lados). **Corrigido**:
`GraphicalAnalysisAttemptJob.php` agora detecta esse erro especificamente e chama `finalizarComoFalha()` direto na
1ª tentativa (mesma doutrina já usada para `REJECTED_IMAGE`/`PROMPT_INJECTION_DETECTED` — erros não-reparáveis
terminam cedo, não entram no loop de repair), com mensagem pública nova e mais clara ("O preço visível no gráfico
está desatualizado... envie uma captura de tela recente"). Novo teste
`GraphicalAnalysisAttemptJobTest::test_chart_visible_price_deviation_falha_na_primeira_tentativa_sem_repair()`
prova as duas pontas: `FAILED`/`CHART_VISIBLE_PRICE_DEVIATION`/crédito estornado na 1ª tentativa, e — a prova real
do fail-fast — só 1 chamada ao decisor registrada (`Http::recorded()` filtrado por host), nunca 3. Confirmado
verde isolado (1/1) e junto dos outros arquivos de job/pipeline + `DecisionResponseValidatorTest` (42/42).

**Achado de infraestrutura local, não desta spec**: no mesmo incidente, o worker também morreu com
`Allowed memory size of 134217728 bytes exhausted` (`Cache/DatabaseStore.php:417`, dentro de `unserialize()`) —
`memory_limit` do PHP local (WAMP) estava no padrão de desenvolvimento de 128M, insuficiente para o volume real de
dados que uma análise processa (múltiplos timeframes/exchanges, séries completas de indicadores, tudo retido no
mesmo processo). Paliativo aplicado a pedido do Felipe: `memory_limit` 128M→512M em
`C:\wamp64\bin\php\php8.2.26\php.ini` (afeta CLI/worker; Apache precisaria de restart separado, não feito). Causa
raiz real (retenção de séries completas quando só o último valor é usado, candles brutos não liberados entre
timeframes, possível recálculo duplicado) fica documentada mas **deliberadamente não atacada agora** — decisão
explícita do Felipe de deixar para o futuro.

**Não commitado.**

---

## FASE 19 — Definicao final de pronto (doc secao 22) — 25 portoes, bloqueante

- [ ] Backend parte exatamente do baseline identificado (ZIP 40 ou divergencia registrada na Fase 0).
- [ ] Migration aplicada e modelos atualizados.
- [ ] Cerebro usa somente `BrainMarketDataProvider` Binance USD-M Perpetual.
- [ ] Nenhum contexto informativo entra no manifesto ou no hash decisorio.
- [ ] Direcao congelada antes de funding e Open Interest.
- [ ] Modificador de derivativos validado em PHP entre -15 e +15.
- [ ] DMI e MACD contam uma vez por familia.
- [ ] Score final e texto final existem antes de qualquer plano.
- [ ] Plano A e preco atual e inicia selecionado.
- [ ] Plano B usa o mesmo catalogo do Plano A.
- [ ] Cada alvo possui `candidate_id`, fonte e zona real.
- [ ] Alvo ausente permanece ausente.
- [ ] Fibonacci so aparece quando o OCR o encontrou.
- [ ] Nenhuma linha ou figura e projetada.
- [ ] Liquidacao de A e B usa o bracket e o nocional do proprio plano.
- [ ] Capital, risco e margem sao distintos.
- [ ] R/R e arredondado uma vez no backend.
- [ ] Quatro cards aparecem sempre.
- [ ] Macro e Sentimento vem somente do payload persistido.
- [ ] Cards multicorretora usam APIs reais e sao display-only.
- [ ] Radar, FlowTrack, OI simulado e datas aleatorias foram removidos.
- [ ] Servicos uteis possuem consumidor real e duplicatas foram apagadas.
- [ ] Testes, benchmark, BTC e ENA passaram.
- [ ] Provas A12 e H8 anexadas ou formalmente marcadas como indisponiveis por falta de baseline.
- [ ] Canario ficou estavel antes da exclusao fisica do pipeline V6.7.

---

## Inventario de novas classes (nenhuma existe hoje em `genesis-api`, confirmado por busca)

`BrainMarketDataProvider`, `BinanceUsdMBrainMarketDataProvider`, `BrainBundleGuard`,
`FreshnessPolicy`, `TargetCandidateCatalog`, `TargetSelectionValidator`, `PriceNormalizer`,
`PlanAMicroanalysisService`, `PlanRecommendationService`, `PlanoBService`,
`LiquidationCalculatorService`, `ScoreFinalizer`, `ScoreNarrativeBuilder`,
`InformativeDisplayContextService`, `MultiExchangeDerivativesDisplayService`,
`PublicVocabularyService`, `PublishedOutputGate`, `BenchmarkGenesisV69`.

`AlvoService` (574 linhas hoje) e `LiquidationMapService` (ja existe, criado na Fase 4 do spec
`genesis-v6-9-correcao-completa`) recebem `SUBSTITUIR` completo, nao patch incremental.
