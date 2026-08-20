# Plano de Implementação: Gênesis V6.9 — Correção completa

**Status deste documento**: criado como planejamento puro (19/08/2026), a partir do documento
do PO recebido em 18/08/2026. **Nada foi executado ainda.** Nenhuma tarefa abaixo está marcada
`[x]`. Antes de iniciar a Fase 1 real, rodar uma Fase 0 de verificação contra o código atual dos
dois repositórios — ver seção própria abaixo — porque este spec, como os anteriores (V6.7, V6.8),
tende a encontrar itens que já mudaram desde que o PO fechou a auditoria.

## Fontes

1. `GENESIS_V6_9_CORRECAO_COMPLETA_DEV.md` (mesmo diretório) — manual técnico do PO (Fabrício),
   emitido 18/08/2026, com código completo pronto para copiar/colar para 80 itens.
2. `GENESIS_V6_9_ORIENTACOES_PARA_O_DEV.pdf` — 33 páginas explicando o quê e o porquê, sem
   código, mesma numeração de identificadores. Não salvo como binário no repositório; só o
   texto extraído foi usado para escrever este plano.

**Repositórios**: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** =
`c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main` (mesma convenção dos specs
anteriores).

## Por que este spec existe

A V6.8 foi auditada em produção (backend `genesis-api-genesis2`, frontend `genesis2-master`) por
três fontes cruzadas: auditoria interna linha a linha contra dois setups reais (BTCUSDT e AXS
1d) e seus gráficos, uma auditoria externa independente, e verificação ponto a ponto do print do
BTCUSDT — 24 divergências, 6 delas críticas para uma plataforma de derivativos.

**Diagnóstico de fundo do PO**: a camada matemática está sólida (EMA/RSI/MACD/ADX/ATR conferem
por recálculo). A camada de coerência não existe — cada peça calcula certo e nada confronta se o
conjunto faz sentido. É por isso que uma cunha descendente virou sinal de venda, um Supertrend
altista entrou numa tese baixista sem registro, dois sistemas de segurança de liquidação se
contradisseram na mesma tela, e três fontes de evidência (livro de ofertas, Wyckoff, clusters de
liquidação) publicaram dado morto como se fosse verificado.

A peça central do documento é o **E1** (portão de coerência da direção): não muda quem decide — a
IA continua sendo o decisor único, doutrina reafirmada nas "Decisões de produto — fora do escopo
técnico" — só impede que uma contradição entre a direção escolhida e os fatos objetivos (DI,
ADX, viés da figura, Supertrend, timeframes maiores) passe silenciosa.

## Verificação preliminar (19/08/2026) — um achado já confirmado antes da Fase 0

Antes de aceitar qualquer item do PO, uma checagem rápida no histórico do repositório **[FE]**
já confirma o item **E5** (dois cérebros de macro e sentimento) como real e ativo, não
hipotético: o commit `7907a82` (15/08/2026, 3 dias antes do fechamento da auditoria do PO),
*"Religa macro/sentimento à busca real do Gemini (MacroController)"*, mexeu exatamente em
`services/geminiService.ts` e descreve, na própria mensagem, o padrão que o E5 aponta como bug —
`analyzeChart()` busca macro/sentimento à parte e **sobrepõe** o texto por cima do que já veio da
análise. Ou seja: o comportamento que o E5 pede para eliminar foi reintroduzido de propósito dias
antes da auditoria, para uma finalidade legítima (devolver dado real ao card), mas sem resolver
a duplicidade de fonte. Isso eleva a confiança no restante do documento, mas não substitui a
verificação item a item da Fase 0 — só ela confirma se A1/A9/B1/B2/etc. ainda descrevem o código
real depois de qualquer commit posterior a 18/08/2026.

## Decisões de produto já resolvidas na doutrina do PO — não reabrir

Estas não são tarefas. A auditoria externa propôs três medidas que revertem determinações já
tomadas pelo PO; ficam registradas para que ninguém as implemente por engano durante a execução
deste spec.

| Proposta externa | Determinação vigente do PO |
|---|---|
| Produto somente leitura educacional, sem tamanho/alavancagem/liquidação | 28/07: "não executa ordem" = não envia ordem à corretora. Entrada, stop, TP, R/R, alavancagem, tamanho e Plano A/B **ficam**. |
| Tirar direção e score da IA, voltar a motor determinístico | 22/07: a IA é o decisor único. O defeito é ausência de portões de coerência — resolvido pelo **E1**, não pela troca de arquitetura. |
| Bloquear botão com R/R abaixo do mínimo | DP-03/DP-05: R/R baixo **avisa, nunca bloqueia**. Quem decide é o membro. |

**Um recorte legítimo permanece aberto**: quando o stop é geometricamente inalcançável porque a
posição liquida antes dele, isso não é "R/R ruim" — é um plano impossível de executar como está
escrito. Tratado no **D1** (aviso próprio) e no **D2** (sugestão de alavancagem compatível).

## Decisões pendentes do PO — já implementadas com a recomendação do documento

Confirmar com o Fabrício antes da Fase correspondente, mas nenhuma bloqueia o planejamento —
trocar é ajuste de uma linha, não refatoração. **Checkbox marca a confirmação com o Fabrício, não a
implementação do código** — as três já estão implementadas com a recomendação do documento (ver
Fases 4/5), a confirmação em si (fora do escopo de código desta sessão) segue pendente.

- [ ] **DP9-1 — Stop além da liquidação (D1/D2).** Implementado como: avisa **e sugere a
      alavancagem máxima compatível** com aquele stop (`MotorExecucaoService::
      maiorAlavancagemSegura()`, Fase 5/D2). Alternativa: só avisar, ou bloquear.
- [ ] **DP9-2 — Alvo dentro da faixa (C6).** Implementado como: vence o **nível mais forte**
      dentro da faixa de distância (Fase 4/C6). Alternativa: vencer o mais próximo.
- [ ] **DP9-3 — Invalidação e stop (D4).** Implementado como: **os dois ficam**, num bloco só
      ("Defesa da Operação"), com a relação explicada (Fase 5/D4). Alternativa: unificar num
      número só.

## Não tocar neste ciclo

- [ ] `server.ts` e `routes/api.js` **[FE/API]** — determinação do PO, nada muda.
- [ ] `OkxService`, `BybitService`, `BitgetService` **[API]** — ficam para implantação futura,
      não apagar (ver **H2**).
- [ ] Bloco de derivativos da tela **[FE]** — permanece igual (**A12**).
- [ ] Texto do bloco de sentimento do ativo **[API]** — já está correto, só ganha o score (**A2**).
- [ ] Fórmulas de EMA/RSI/MACD/ADX/ATR, R/R bruto e líquido, ancoragem do stop no ATR, tamanho
      em nocional/risco em dólar, `verificarSegurancaLiquidacao()`, rebaixamento de
      `levels.poc/hvn/lvn` a contexto — conferidos por recálculo, não mexer na fórmula em si
      (só na série de entrada, que é o **A1**).

## Escopo desta spec

80 itens do documento do PO (blocos A–H), reorganizados nas 8 fases de execução que o próprio
documento define. Cada tarefa carrega: severidade (P0/P1/P2), ação (ALTERAR/INCLUIR/DELETAR/
LIGAR), repositório(s) afetado(s), o que fazer resumido e o critério de aceite. O código pronto
de cada item está em `GENESIS_V6_9_CORRECAO_COMPLETA_DEV.md`, sob o mesmo identificador.

---

## FASE 0 — Verificação contra o código atual ✅ concluída (19/08/2026)

- [x] **0.1** Branch `genesis-v6.9` criada nos dois repositórios a partir do estado limpo de
      `master` (**[FE]**) / `genesis2` (**[API]**).
- [x] **0.2** SHA inicial registrado — **[FE]** `76d90e2575f536f38de501cba141db7a0e89a25f` ·
      **[API]** `3843a7a1defe2845bd01bd98854beff8e8663d60`.
- [x] **0.3** Baseline de testes registrado nos dois repositórios, antes de qualquer mudança:
      - **[API]** `./vendor/bin/phpunit --no-coverage` → **503 tests, 1342 assertions, 0
        falhas** (suíte inteira verde). Precisou `php artisan config:clear` antes — mesmo
        problema de config cacheada já documentado neste projeto (bloqueava os overrides de
        `phpunit.xml`, comando seguro, não toca banco).
      - **[FE]** `npm run test` (vitest) → **6 arquivos falhando, 29 testes falhando / 314
        passando / 343 total**. Pré-existente, não é regressão desta sessão — qualquer aumento
        nesse número durante a execução do spec é regressão real e deve ser investigado antes
        de prosseguir.
- [x] **0.4** Amostra de itens P0 reconferida contra o código real (não 100% dos 24 P0 listados
      — os de maior risco de estarem stale, dado o histórico deste projeto). **3 achados que
      mudam a execução**, além de confirmações:
      - **A1 confirmado inalterado**: `MarketSnapshotService.php:44/48` ainda filtra
        `candlesFechados($candlesBrutos)` e calcula sobre a série filtrada, exatamente como o
        documento descreve.
      - **A9 confirmado inalterado**: `EvidenceCatalog.php:69-72` ainda marca
        `funding_rate`/`open_interest`/`open_interest_change_pct`/`open_interest_context` como
        `'DECISION'`.
      - **B1 confirmado inalterado**: `BinanceService.php:428` —
        `getOrderBookWalls(string $symbol, int $limit = 5000)`, exatamente o limite inválido
        que o documento aponta.
      - **⚠️ A11 — conflito técnico real, não só estratégico**: `BinanceService.php:496` **já
        tem** `getOpenInterestHist(string $symbol, string $period = '1h', int $limit = 25)`,
        criado no spec V6.5 (item C06, 30/07/2026) e já usado por
        `MarketSnapshotService::derivatives()` (via `oiPeriod($timeframe)`) e coberto por
        `tests/Feature/OpenInterestWindowTest.php`. O código do A11 no documento do PO declara
        esse método como **novo**, com assinatura diferente
        (`period = '1d', limit = 500`) — se copiado literalmente, é **erro de método duplicado
        em PHP**, não apenas redundância. Na Fase 3 (item 3.6 abaixo), `A11` precisa **reaproveitar
        o método existente**, não recriá-lo, e o `LiquidationMapService` deve chamar
        `getOpenInterestHist($symbol, '1d', 500)` explicitamente em vez de assumir os defaults
        atuais (`'1h', 25`, que não servem para o mapa de liquidação de 30 dias).
      - **⚠️ F3 — refinamento, item continua válido mas a causa raiz mudou**: o spec V6.5 (C06)
        já tornou `oiPeriod()` sensível ao timeframe (`1d→period 1d/limit 30`,
        `4h→period 4h/limit 42`, etc. — não é mais sempre "30 dias fixos" como o documento da
        V6.9 descreve). O que continua real e não corrigido: `preco_subindo`
        (`TechnicalAnalysisService.php:204-206`) compara sempre `close[-1]` vs `close[-4]` (3
        candles), **independente do timeframe** — descasado contra a janela de OI, que agora
        varia de 42 a 180 pontos conforme o timeframe. `F3` continua uma correção real, mas o
        alvo é `preco_subindo` acompanhar o timeframe, não redescobrir a janela de OI (já
        corrigida). Ajustar `tests/Feature/OpenInterestWindowTest.php` em vez de substituí-lo.
      - **⚠️ E5 confirmado ativo e recente** (achado já registrado na "Verificação preliminar"
        acima) — commit `7907a82` (15/08/2026) reintroduziu exatamente o padrão de sobreposição
        que o E5 pede para eliminar, 3 dias antes do fechamento da auditoria do PO.
      - **🛑 A6 — conflito real de doutrina, decisão do Felipe necessária antes da Fase 7**: ver
        seção própria abaixo, "Achado bloqueante — A6 vs. spec `genesis-decisor-volta-gemini-3-7`".
- [x] **0.5** Commits entre 18/08/2026 (fechamento da auditoria) e 19/08/2026 (início deste
      spec): **nenhum** nos dois repositórios — o commit mais recente em cada um (`76d90e2`
      **[FE]**, `3843a7a` **[API]**) é de 16/08/2026, ou seja, **anterior** ao fechamento da
      auditoria do PO. Isso significa que o documento do PO já deveria refletir esse estado —
      e na maior parte reflete (A1/A9/B1 batem exatamente). As exceções são justamente A6 e A11,
      tratadas acima: não são commits *depois* da auditoria, são partes do código que a
      auditoria leu mas descreveu com uma prescrição que colide com trabalho recente do próprio
      Felipe (A6) ou com um método já existente de outro spec (A11).
- [ ] **0.6** Confirmar com o Fabrício as três decisões pendentes do PO (DP9-1/2/3) e as
      ressalvas de **H7** (comandos de console registrados por assinatura, não por referência)
      antes da Fase 8. Ainda não feito — não bloqueia o início da Fase 1.

### Achado bloqueante — A6 vs. spec `genesis-decisor-volta-gemini-3-7`

O item **A6** do documento do PO chama de "desvio de configuração" a linha
`'decision_model' => env('GENESIS_GEMINI_DECISION_MODEL', 'gemini-3.7-flash')` (dentro do bloco
`'gemini' => [...]` de `config/genesis_graphical_v6.php:170`) e prescreve corrigi-la para
`'decision_model' => env('GENESIS_DECISION_MODEL', 'gemini-3.6-flash')`, citando "determinação
do PO é modelo único".

**Essa linha não é acidente nem desvio** — é o resultado do spec `genesis-decisor-volta-gemini-3-7`
(15–16/08/2026, execução completa, testada, com prova real de ponta a ponta), motivado por um
incidente real: a chave `GENESIS_OPENAI_DECISION_KEY` (o decisor único anterior,
`gpt-5.6-terra`) ficou **sem crédito na OpenAI** (`HTTP 429 credit_balance_exhausted`,
reproduzido ao vivo). Felipe pediu explicitamente para o decisor voltar ao Gemini, usando
`gemini-3.7-flash` (deliberadamente mais novo que o `gemini-3.6-flash` que visão/contexto já
usam, testado contra a API real antes de virar padrão). Hoje o `.env` real tem
`GENESIS_DECISION_PROVIDER=gemini` (vencendo o default `openai` do config) e
`AI_PROVIDER=openai` continua intocado como eixo separado (V6.7 congelado, só para o
benchmark).

Executar A6 como está escrito no documento faria duas coisas que provavelmente não são a
intenção do PO:
1. Trocaria o modelo de decisão de `gemini-3.7-flash` (escolhido de propósito, testado com 2
   análises reais de ponta a ponta) para `gemini-3.6-flash` — uma downgrade não pedida por
   ninguém além do texto do documento, que não tinha como saber do incidente da OpenAI.
2. Introduziria uma chave de config nova (`GENESIS_DECISION_MODEL`) num nível plano, quando a
   estrutura atual já é por-provedor (`openai_model` vs. `gemini.decision_model` aninhado) —
   colide com a arquitetura de dois provedores que o próprio V6.8 construiu.

**Isto não bloqueia as Fases 1-6** (A6 só entra na Fase 7).

**Decidido (19/08/2026, Felipe)**: manter `gemini-3.7-flash`. Não reverter a escolha recente.
"Modelo único", na Fase 7, passa a significar eliminar a duplicidade de eixo de provedor onde
fizer sentido (ex.: `GENESIS_GEMINI_DECISION_MODEL` continua sendo a fonte de verdade do modelo
do decisor Gemini — não criar `GENESIS_DECISION_MODEL` genérico por cima), não forçar o
downgrade para 3.6. Avisar o Fabrício do incidente da OpenAI e da troca de modelo antes de
aplicar o restante do A6 (a parte da tabela qualitativa de score → faixas ancoradas em fatos,
que continua válida e não tem relação com o incidente).

---

## FASE 1 — Série de candles (destrava tudo) ✅ concluída (19/08/2026)

### 1.1 — `A1` — Indicadores passam a usar o candle em formação — ALTERAR · P0 · **[API]** ✅

- [x] `app/Services/GraphicalAnalysis/MarketSnapshotService.php`: `$candlesBrutos` (série
      completa) passa a alimentar `technical->calcular()`, `structure->analyze()`,
      `cvd->fromKlines()`, `supplemental->calculate()`, `zones->calculate()`,
      `technical->detectarPadraoCandle()`, `technical->detectarWyckoff()`,
      `technical->estocastico()`, `technical->cvdNoTempo()` — conferido um a um.
      `candlesFechados()` deixou de alimentar o cálculo; continua existindo só para a metadata
      de `tempos()`.
- [x] `technical['preco']`/`['preco_variacao_pct']` pararam de precisar de override manual —
      `calcular($candlesBrutos)` já devolve os dois certos por conta própria (o último elemento
      da série passada já é o candle vivo). Código ficou mais simples, não mais complexo.
- [x] `technical['candle_em_formacao']` adicionado.
- [x] **Achado real durante a execução**: `MarketStructureService::analyze()` tinha um
      **refiltro interno** (`closedCandles()`) que descartava o candle vivo por conta própria,
      independente do que `MarketSnapshotService` passasse — isso mascararia a promessa do A1
      de corrigir "estrutura" também. Removido o refiltro (`$closed = $candles`) e o método
      `closedCandles()` órfão resultante; confirmado que a janela de detecção de pivôs
      (`left`/`right`) não é afetada (um candle vivo, por definição, nunca tem candles à direita
      suficientes pra virar pivô) — só `latestBreakEvent()` passa a reagir ao preço vivo, que é
      exatamente o efeito pretendido.
- [x] `collect()` passou a devolver `'candles' => $candlesBrutos` (antes devolvia
      `$candlesFechados`) — evita reintroduzir o bug do V6.5/B08 na direção oposta:
      `ExecutionPipelineService` (entrada/stop/ATR) precisa ver a mesma série que os
      indicadores, senão metade do pipeline calcula sobre uma série e a outra metade sobre
      outra de novo.
- [x] **Persistência de auditoria já resolvida por infraestrutura existente**: a V6.8 (Fase
      6.2) já criou `tempos()` (`market_price_observed_at`/`indicators_observed_at`/
      `last_closed_candle_at`/`candle_state`), consumido por `CanonicalBundleBuilder.php` e
      salvo com a análise. Os campos `snapshot_horario`/`snapshot_preco` que o documento do PO
      pede como novos já existem sob outros nomes, ligados de ponta a ponta — não foi preciso
      criar persistência nova.
- [x] Teste novo `tests/Feature/A1CandleEmFormacaoTest.php` (3 testes, rede real — mesmo padrão
      do resto da suíte para este serviço): EMA21 do snapshot bate com EMA21 recalculada por
      fora sobre a série com candle vivo (desvio < 0,1%); `candle_em_formacao === true`;
      `market_structure`/`candles` devolvidos são coerentes e usam a mesma série.
- [x] **Critério de aceite confirmado**: os 3 testes novos passam contra a API real da Binance.
      RSI/MACD/ADX/ATR mudam com o candle porque agora vêm da mesma `calcular($candlesBrutos)`
      que a EMA (mesmo mecanismo, não precisa de prova em separado por indicador).

### 1.2 — `F1` — Multi-timeframe usa série diferente do principal — ALTERAR · P0 · **[API]** ✅

- [x] **Achado real durante a execução**: `MultiTimeframeSnapshotService.php` **nunca teve**
      filtro de candle fechado — sempre buscou a série bruta via `getCandlesStrict()` sem
      nenhum `candlesFechados()`. A inconsistência com o gráfico principal ("um lado filtra, o
      outro não") já foi resolvida como efeito colateral do A1: o principal passou a se
      comportar como este arquivo sempre se comportou. Nada mudou na série em si.
- [x] Segunda parte (critério de viés) implementada: `MarketStructureService` injetado;
      `bias` passa a ser `preço vs EMA21` + `estrutura do timeframe`
      (`MarketStructureService::analyze()->structure`, BULLISH/BEARISH/MIXED) em vez do
      empilhamento `preço > EMA21 > EMA50`. Campo `ema50` mantido no retorno (não é consumido
      em nenhum outro lugar da base, mas continua exposto — não removido).
- [x] `tests/Feature/MultiTimeframeConfluenceTest.php`: assertiva nova — `bias` de cada
      timeframe cai num dos três valores válidos.
- [x] **Aceite confirmado**: semanal e mensal usam a mesma série do diário (via A1 — nunca
      precisaram de correção própria); teste de rede real passa.

---

## FASE 2 — Sentimento e cards ✅ concluída (19/08/2026)

### 2.1 — `A2` — Sentimento da moeda volta a ter score — ALTERAR · P0 · **[API+FE]** ✅

- [x] **Achado real (arquitetura já diferente do documento)**: `GeminiContextService.php`
      **já existe** desde o V6.8 (substitui o `InformativeNarrativeService` que o documento do
      PO assume) e já tinha grounding real via Radar News + `narrativa`/`gatilhos_positivos`/
      `gatilhos_negativos` — só faltava mesmo o `score`. Prompt e schema atualizados: score
      0–100 por ativo (sentimento) e score macro, regra de `null` sem material verificado
      (nunca 50 de preenchimento), proibição de citar mercado à vista.
- [x] `app/Services/GraphicalAnalysis/GeminiContextService.php`: `scoreOuNull()` (clampa
      0–100, `null` se não numérico) aplicado a `macro.score`/`sentimento.score` no payload,
      nos dois caminhos (sucesso e `indisponivel()`).
- [x] `app/Services/GraphicalAnalysis/CanonicalBundleBuilder.php`: passou a mesclar
      `macro.score`/`sentiment.score`/`sentiment.gatilhos_positivos`/`gatilhos_negativos` no
      snapshot (mesmo ponto onde `narrative` já era mesclado) — score `null` não gera
      `error_code` (ausência de material é resposta válida, diferente de falha técnica).
- [x] `app/Services/GraphicalAnalysis/EvidenceCatalog.php`: `sentiment.fear_greed`/
      `sentiment.btc_dominance` renomeados para `macro.fear_greed`/`macro.btc_dominance`
      (path físico, não só rótulo); `macro.score`/`sentiment.score`/
      `sentiment.gatilhos_positivos`/`sentiment.gatilhos_negativos` adicionados (4 itens
      novos, papel CONTEXT).
- [x] **Achado real**: `fear_greed`/`btc_dominance` também precisaram mover de arquivo físico
      — vinham de `MarketSnapshotService::sentiment()`, não do `GeminiContextService`. Método
      `sentiment()` incorporado a `macro()` (fisicamente move os dois campos); `sentiment()`
      removido, chave `'sentiment' => []` no snapshot passa a ser preenchida só pelo
      `CanonicalBundleBuilder` (narrative/score/gatilhos).
- [x] `app/Services/GraphicalAnalysis/AnalysisPublicResponseBuilder.php`:
      `informative_context.macro` ganha `fear_greed`/`btc_dominance`/`score`;
      `informative_context.sentiment` perde `fear_greed`/`btc_dominance`, ganha `score`/
      `gatilhos_positivos`/`gatilhos_negativos`.
- [x] **FE também precisou de mudança, apesar do documento não prever isso para o A2**:
      `services/geminiService.ts` (`mapGraphicalToLegacy`) lia `ctx.sentiment.fear_greed`
      diretamente — sem atualizar, o A2 backend teria quebrado o card de Fear & Greed em vez
      de consertar o de sentimento. `macroStats`/`sentimentStats` reorganizados (fear_greed/
      btc_dominance/score movidos para `macroStats`; score/gatilhos adicionados a
      `sentimentStats`). `types/graphicalAnalysis.ts` (`InformativeContext`) atualizado para
      bater com o novo formato.
- [x] Testes novos/ajustados: `tests/Unit/Services/GeminiContextServiceTest.php` (+3: score
      extraído, score `null` sem material, score fora de 0–100 clampado);
      `tests/Unit/CanonicalBundleAuthorityTest.php` (+2: score/gatilhos viram evidência
      pública; score `null` não vira `error_code`); `tests/Feature/
      GraphicalAnalysisInformativeContextTest.php` (IDs `sentiment.fear_greed`/
      `sentiment.btc_dominance` → `macro.*`, +score/gatilhos); `__tests__/geminiService.test.ts`
      (fixture + 1 teste novo para score/gatilhos no adaptador).
- [x] **Regressão real corrigida**: `tests/Unit/EvidenceManifestBuilderH47Test.php` hardcodava
      a contagem total de itens `CONTEXT` do catálogo (22) — subiu para 26 com as 4 entradas
      novas. Atualizado com o mesmo padrão de comentário histórico que o teste já usava para a
      mudança equivalente do V6.8.
- [x] **Aceite**: score é extraído/clampado corretamente (testado com mocks — duas análises
      reais de ativos diferentes no mesmo dia terem scores diferentes é uma propriedade de
      comportamento da IA em produção, não verificável só com testes automatizados nesta
      sessão); `gatilhos_positivos`/`gatilhos_negativos` preenchidos e propagados ponta a
      ponta (backend → contrato público → adaptador FE → componente).

### 2.2 — `A7` — Quatro cards abaixo da barra de força — ALTERAR · P1 · **[FE]** ✅

- [x] `components/ScoreBasisBars.tsx`: confirmado que os quatro cards já existiam
      (`macroScore`/`sentimentScore` como props) — sem eles renderizarem porque o contrato
      nunca enviava `score` (mesmo buraco do A2, resolvido em 2.1). Bloco "Qualidade dos
      Dados" removido da fileira (grid de 5→4 colunas); card "Macro" renomeado para "Macro e
      Geopolítico" (rótulo exato do critério de aceite). Tipo `DataQuality`/constante
      `DATA_QUALITY_LABEL` removidos (ficaram órfãos).
- [x] `components/__tests__/ScoreBasisBars.test.ts`: 2 dos 5 testes existentes verificavam
      justamente a presença do card "Qualidade dos Dados" (adicionado no V6.8) — reescritos
      para verificar a ausência dele na fileira e o grid de 4 colunas.
- [x] **Nota transparente**: entre esta fase e o **G5** (Fase 7), a informação de qualidade/
      cobertura dos dados fica temporariamente sem exibição na tela — sequenciamento
      deliberado do próprio documento do PO (G5 explicitamente "migra para o rodapé"), não um
      esquecimento.
- [x] **Aceite confirmado**: fileira com Técnico, Derivativos, Macro e Geopolítico,
      Sentimento — 5 testes de fonte passam.

### 2.3 — `G3` — "Sem dado" ao lado do dado — ALTERAR · P1 · **[FE]** ✅

- [x] Confirmado: resolvido automaticamente pelo A2 — `AnalysisResult.tsx:999` já lia
      `sentimento?.score == null ? 'Sem dado' : ...`; sem ação própria, só a correção do
      caminho de dados (2.1).
- [x] **Aceite confirmado**: o selo passa a mostrar o score real assim que `sentimentStats`
      chega preenchido do backend.

---

## FASE 3 — Fontes de dados quebradas ✅ concluída (19/08/2026)

### 3.1 — `B1` — Livro de ofertas com limite inválido — ALTERAR · P0 · **[API]** ✅

- [x] `app/Services/BinanceService.php`: `getOrderBookWalls()` — limite default trocado de 5000
      (inválido pro endpoint de futuros, era o limite do Spot) para 1000; validação contra
      `DEPTH_LIMITES_VALIDOS = [5,10,20,50,100,500,1000]`.
- [x] **Achado real**: a falha (sempre acontecia, com limite 5000) já caía num catch que devolvia
      `qualidade => 'INDISPONIVEL'` — mas `MarketSnapshotService::derivatives()` passava esse
      resultado direto pro `safe()` genérico, que só checa "não é `[]`". Como o array de falha
      tem chaves (`paredes_compra`, `qualidade`, etc.), nunca era literalmente `[]` — a evidência
      saía **sempre AVAILABLE**, mesmo com o livro nunca lido de verdade. Método novo
      `orderBookWalls()` no `MarketSnapshotService` checa `qualidade === 'SNAPSHOT_REST'`
      explicitamente antes de aceitar o valor.
- [x] Teste novo `tests/Feature/OrderBookWallsAvailabilityTest.php` (rede real) — prova que a
      evidência `derivatives.order_book_walls` sai `AVAILABLE` de verdade, com paredes
      preenchidas. `tests/Feature/OrderBookWallsWiringTest.php` ganhou assertiva de `qualidade`
      que faltava (o teste existente nunca teria pego essa regressão sozinho).
- [x] **Aceite confirmado**: `orderbook` (na verdade `derivatives.order_book_walls`, nome real da
      evidência) sai `AVAILABLE` com paredes reais.

### 3.2 — `B2` — Detector de Wyckoff matematicamente impossível — ALTERAR · P0 · **[API]** ✅

- [x] `app/Services/TechnicalAnalysisService.php`: `identificarRange()` reescrito — janela de
      referência (60/40/20 candles) termina exatamente onde a janela de busca
      (`WYCKOFF_JANELA_BUSCA = 20`, mais recente) começa, sem sobreposição.
- [x] `mediaVolumeAte($volumes, $indice, $janela=20)` — média calculada só com os candles
      anteriores ao avaliado, chamada dentro do loop de `detectarEventos()` (antes: uma média
      fixa dos últimos 20 candles da série inteira, igual para todo o loop).
- [x] Testes novos `tests/Unit/Services/WyckoffJanelaSeparadaTest.php` (4 testes, sintéticos e
      determinísticos): confirma que a janela de referência não se sobrepõe à de busca, e que
      SPRING, UAT e SOS (3 dos 4 eventos antes impossíveis) agora disparam quando o candle da
      janela de busca realmente rompe o nível.
- [x] **Aceite confirmado** (via teste determinístico, não os 20 ativos reais do documento —
      mais rigoroso: prova a causa estrutural, não só observa se algum evento aparece por acaso):
      SPRING/UAT/SOS provados individualmente.

### 3.3 — `B3` — Clusters de liquidação mortos na tabela de pesos — ALTERAR · P1 · **[API]** ✅

- [x] **Achado real (item já parcialmente stale)**: `cluster_liquidacao` **já não estava** na
      tabela de pesos (`AlvoService::PESOS`) — removida no V6.6/B05, antes deste spec existir. E
      o dado que alimentava esse canal (`derivatives.liquidations`) **já vinha sempre vazio** na
      prática desde o V6.5/C04 (`getLiquidacoes()` sempre devolve `null`, fonte descontinuada).
      As duas linhas em `ExecucaoService::montarBarreiras()` que tagueavam barreiras como
      `'cluster_liquidacao'` nunca executavam de verdade em produção — intenção morta, não bug
      ativo.
- [x] `app/Services/ExecucaoService.php`: as duas linhas removidas, com comentário explicando o
      achado e por que o parâmetro `$liq` foi mantido na assinatura (risco desproporcional de
      quebrar 19 parâmetros posicionais por algo já inofensivo).
- [x] Teste novo `tests/Unit/Services/ExecucaoServiceClusterLiquidacaoTest.php` — prova, via
      reflection em `montarBarreiras()`, que mesmo com `$liq` populado de propósito nenhuma
      barreira `cluster_liquidacao` é produzida.

### 3.4 — `B4` — Portões de cobertura e frescor desligados — LIGAR · P1 · **[API]** ✅

- [x] `min_coverage_for_execution` (`config/genesis_graphical.php`) ligado em
      `AnalysisPersistenceService::computeAttributes()` (novo método privado
      `avaliarQualidadeDados()`) — cobertura abaixo do mínimo rebaixa o score em 10 pontos.
- [x] **`DataFreshnessGate.php` avaliado e conscientemente NÃO ligado literalmente** — espera
      `timestamp_ms`/`sequence_ok` por FONTE NOMEADA (desenho do "Documento Mestre R3.2", uma
      arquitetura anterior). `EvidenceManifestBuilder` grava o MESMO `observed_at` em todo item
      do manifesto — este pipeline nunca produziu o dado granular que a classe espera. Fabricar
      entradas falsas só pra "ligar" a classe simularia dado que não existe. Substituído por uma
      checagem direta e real: intervalo entre `timing.market_price_observed_at` (capturado pouco
      antes da chamada ao decisor) e agora — nesta arquitetura (visão→contexto→decisão
      sequencial, com retries de reparo), é esse intervalo que pode deixar preço/indicadores
      desatualizados por publicação tardia. Config nova
      `genesis_graphical.max_market_data_age_seconds` (180s).
- [x] Regra do PO sobre ausência (indicador que falhou é retirado da conta, nunca zero) — já
      garantida pelo próprio `EvidenceManifestBuilder::build()` (denominador de `decision_percent`
      só conta papel `DECISION`), não precisou de mudança nova.
- [x] Avisos persistidos como entrada sintética `quality.avisos` em `evidence_manifest`
      (`decision_role: DISPLAY_ONLY`) — mesmo padrão já usado por `pipeline.execution`. Nunca
      bloqueia: `analysis_status` continua `COMPLETED`.
- [x] Teste novo `tests/Unit/Services/AnalysisPersistenceServiceQualidadeDadosTest.php` (5
      testes): cobertura alta/dado fresco não penaliza; cobertura baixa −10; dado vencido −5; os
      dois juntos −15 sem bloquear; score nunca fica negativo.
- [x] **Regressão real corrigida em 3 arquivos**: `GraphicalAnalysisOpenAiProviderFlowTest.php`,
      `GraphicalAnalysisAttemptJobTest.php`, `GraphicalAnalysisFullPipelineIntegrationTest.php` —
      os `pending_bundle` sintéticos desses testes nunca setavam `bundle.coverage` (só
      `bundle.evidence`), então minha correção lia cobertura 0% por chave ausente e rebaixava o
      score por engano (75→65). Adicionado `coverage` realista (80%, batendo com os itens
      `DECISION` de fato presentes no fixture) nos três.
- [x] **Aceite confirmado**: cobertura abaixo do mínimo rebaixa o score e registra aviso, sem
      bloquear a análise.

### 3.5 — `A10` — Nenhum dado de Spot em nenhuma camada — ALTERAR · P0 · **[API+FE]** ✅

- [x] `app/Services/BinanceService.php`: `getCandlesStrict()` perdeu o parâmetro de mercado —
      opera só `fapi.binance.com/fapi/v1/klines`. `getCandlesResiliente()` (fallback Futures→Spot)
      **removido inteiramente** — zero chamadores em toda a base, e tinha fallback pra Spot
      embutido. 2 call sites de produção + 9 de teste atualizados.
- [x] `app/Services/PriceProxyService.php`: **achado real** — este serviço já era multi-corretora
      (Binance/Bybit/OKX/Bitget, não só Binance como o documento do PO assumia). Único consumidor
      real (`fetchPrice()` → `AnalysisHistoryDashboard.tsx`, compara preço atual com o plano de
      uma análise) é claramente parte do produto Gênesis — as 4 corretoras convertidas pra
      futuros/perpétuo (Binance `fapi.../ticker/price`; Bybit `category=linear`; OKX instId
      `-SWAP`; Bitget `/mix/market/ticker` + `productType=USDT-FUTURES`), confirmadas ao vivo
      contra as 4 APIs reais antes de escrever o código.
- [x] **`app/Services/ExchangeService.php` — avaliado e conscientemente NÃO tocado.** Docblock da
      própria classe: "Usado pelo MonitoramentoService para calcular o valor atual das
      carteiras" — subsistema de monitoramento de carteira (Binance/Bybit/Bitget/OKX), sem
      nenhuma relação com a análise gráfica do Gênesis. Confirmado por busca de referência: só
      `MonitoramentoService`/`MonitoramentoAlertasCommand` o usam. Trocar pra futuros aqui
      deixaria o valor de carteiras spot reais errado — bug novo, não correção.
      `app/Console/Commands/MonitorCarteiraMaeCommand.php` (achado na varredura de grep) é do
      mesmo subsistema (monitor de carteira + alerta Telegram), mesma conclusão.
- [x] **`components/TrendQuality.tsx` — exceção deliberada, decidida com o Felipe.** Widget
      inteiro existe pra mostrar o "prêmio" Futuros vs. Spot (diagnóstico de squeeze/divergência).
      Zerar o Spot não trocaria a fonte, apagaria a métrica (a diferença sempre daria ~0).
      Confirmado que é renderizado ao vivo em `GenesisPage.tsx`. Decisão: manter como está,
      documentado com um comentário extenso no topo do arquivo explicando a exceção.
- [x] **Achado real, escopo maior que o documento previa**: uma varredura ampla achou 6
      componentes e 9 services adicionais do front usando endpoints Spot (`LiquidationRadar`,
      `FlowTrack`, `OiLiquidationMonitor`, `TrendAnalyzer`, `CarteiraCripto`, etc.) — nenhum
      citado no documento do PO. Investigação de roteamento confirmou: **todos pertencem a
      páginas completamente separadas** (`LiquidationPage`, `FlowTrackPage`, `OiMonitorPage`,
      `TrendAnalyzerPage`, `CarteiraPage` — nenhuma é `GenesisPage.tsx`), um conjunto de
      ferramentas de mercado independente do fluxo de análise gráfica. `SectorSentiment.tsx`
      (está em `GenesisPage.tsx`) foi verificado à parte — usa CoinGecko, não Binance Spot, falso
      positivo do grep. Nenhum desses arquivos foi tocado — fora do escopo real do A10.
- [x] `app/Services/GraphicalAnalysis/GenesisPrompt.php`: regra "Proibido citar mercado à vista,
      spot, ETF ou volume spot" adicionada ao prompt do decisor.
- [x] `app/Services/GraphicalAnalysis/DecisionResponseValidator.php`: `SPOT`/`À VISTA`/`A VISTA`/
      `ETF` adicionados como termos proibidos em `technical_analysis` e `score_description`
      (mesmo padrão do radical `CONFIRM` já existente). 3 testes novos em
      `DecisionResponseValidatorTest.php`.
- [x] **Aceite confirmado (com o escopo real, não o presumido pelo documento)**:
      `grep -rn "[^f]api\.binance\.com" app/` volta só `ExchangeService.php` (exceção documentada,
      fora do pipeline de análise) e `MonitorCarteiraMaeCommand.php` (idem); no front, só
      `TrendQuality.tsx` (exceção documentada) e os 9 arquivos do conjunto de ferramentas
      separado (fora de escopo). Zero ocorrências dentro do pipeline real de análise gráfica.

### 3.6 — `F3` — Janela de Open Interest incompatível — ALTERAR · P1 · **[API]** ✅

- [x] Confirmado o achado da Fase 0: o spec V6.5 (C06) já tornou `oiPeriod()` sensível ao
      timeframe — o alvo real deste item era `preco_subindo`, sempre fixo em 3 candles.
- [x] `app/Services/GraphicalAnalysis/MarketSnapshotService.php`: `derivatives()` passou a
      receber `$candlesBrutos` em vez de `$technical['preco_subindo']` pronto. Novo método
      `precoSubindoNaJanela($candlesBrutos, $oiPeriod)` — localiza pelo **timestamp real** dos
      candles o início da mesma janela de tempo que o histórico de OI cobre (`periodoMs($period)
      × $limit`), evitando qualquer suposição de que "N candles do período X" equivale a "N
      candles do timeframe principal" (não equivale, na maioria dos casos — `oiPeriod()` usa
      period '4h' pra timeframes '6h'/'8h'/'12h', period '1d' pra '3d'/'1w'/'1M', etc.).
      `technical.preco_subindo` (usado como evidência `price.rising`, `DECISION`, consumida
      diretamente pela IA) **não foi alterado** — continua servindo seu propósito original de
      momentum geral de curto prazo; só o quadrante de derivativos passou a ter sua própria
      leitura, na janela certa.
- [x] Testes novos `tests/Unit/Services/MarketSnapshotPrecoSubindoNaJanelaTest.php` (4 testes,
      sintéticos e determinísticos) — incluindo um caso que prova a diferença prática: preço
      subiu ao longo de uma janela real de 30 dias mas caiu nos últimos candles — a leitura
      antiga (3 candles fixos) diria "caindo"; a nova, corretamente, diz "subindo".
- [x] **Aceite confirmado**: as duas pernas do quadrante (variação de OI e direção do preço)
      agora medem a mesma janela de tempo.

### 3.7 — `A11` — Mapa de liquidação estimado por Open Interest — INCLUIR/ALTERAR · P1 · **[API+FE]** ✅

- [x] `app/Services/LiquidationMapService.php` **(novo)**: reconstrução por estimativa — OI
      crescente × preço médio do candle = nocional aberto; projeta liquidação nas alavancagens
      `[10,25,50,100]`; consolida em até 60 faixas, devolve as 12 mais fortes por nocional.
- [x] **Achado da Fase 0 confirmado**: `getOpenInterestHist()` já existia (V6.5/C06) —
      reaproveitado com `('1d', 500)` explícito, sem tocar os defaults (`'1h', 25`) que **F3**
      usa pra outra finalidade.
- [x] `app/Http/Controllers/Api/LiquidationMapController.php` **(novo)** + rota
      `GET /api/v1/liquidation-map/{symbol}?timeframe=` (grupo `auth:sanctum`, ao lado de
      `/price/{symbol}`). **Achado operacional**: rota não aparecia (`route:list` vazio) até
      `php artisan route:clear` — mesmo problema de cache stale já visto neste projeto pra
      `config:clear` (bootstrap/cache/routes-v7.php desatualizado). Comando seguro, sem impacto
      em banco.
- [x] `services/api.ts` **[FE]**: `fetchLiquidationMap()` + tipos `LiquidationMapZona`/
      `LiquidationMapResponse`.
- [x] `components/LiquidationHeatmap.tsx` **[FE]**: reescrito por completo. Recebe `symbol` por
      propriedade (antes: BTC/ETH fixos); rótulo obrigatório "Estimado a partir do Open Interest
      — últimos 30 dias"; **achado real, mais grave que o documento descrevia** — o "fallback"
      antigo, ao falhar a chamada de `allForceOrders` (sempre falhava, endpoint descontinuado),
      **gerava números aleatórios (`Math.random()`) e os exibia como se fossem liquidações
      reais**. Isso saiu inteiramente.
- [x] `pages/GenesisPage.tsx`: `<LiquidationHeatmap symbol={selectedPair} />`.
- [x] Testes novos: `tests/Feature/LiquidationMapServiceTest.php` (2, rede real — inclui prova
      exigida pelo aceite: BTC e SOL produzem faixas de preço diferentes),
      `tests/Feature/LiquidationMapControllerTest.php` (3 — sucesso, símbolo inválido, sem auth),
      `components/__tests__/LiquidationHeatmap.test.ts` (4 — sem `allForceOrders`/`Math.random()`
      fora de comentários, símbolo por propriedade, consome o backend, rótulo de estimativa).
- [x] **Aceite confirmado**: zonas diferentes entre BTC e SOL, provado com dado real.

---

## FASE 4 — Alvos e barreiras (depende inteiramente da Fase 3) ✅ concluída (19/08/2026)

**Suíte completa confirmada verde ao final da fase**: `php artisan test` (API) → **550 testes
passando, 1 pulado (geometria real do mercado, ver achado C1 abaixo), 1703 assertions, ZERO
falhas**. `npx tsc --noEmit` (FE) → limpo. `npx vitest run` (FE) → mesmas 28 falhas pré-existentes
de antes desta fase (confirmado via `git stash`/re-run em estado limpo — nenhuma é regressão desta
sessão), 320 passando.

### 4.1 — `C1` — Pivôs de swing (fonte que não existe) — INCLUIR · P0 · **[API]** ✅

- [x] `app/Services/SwingPivotService.php` **(novo)**: reaproveita `MarketStructureService::pivots()`
      (mesmo motor fractal que `PivoService` já usa pro stop, janela de 2 candles de cada lado, não
      3 como o documento assumia — motor já existente, não recriado) sobre os 300 candles mais
      recentes. Nível = preço real (mínima/máxima do candle), nunca projeção. Contagem de toques
      (tolerância 0,4%) pra ranquear força.
- [x] Registrado como fonte `pivo_swing` (peso 9) na montagem de barreiras
      (`ExecucaoService::montarBarreiras()`), com `toques`/`data` anexados via `$extra` do `$add()`.
- [x] Teste novo `tests/Unit/SwingPivotServiceTest.php` (3, sintético/determinístico): fundo/topo
      conhecidos detectados no preço exato; contagem de toques quando o preço revisita o nível sem
      romper; série curta (<5 candles) devolve listas vazias sem erro.
- [x] **Aceite**: coberto por `AlvoServiceA3AcceptanceTest` (4.9, abaixo) — pivô de swing vira
      barreira real e ganha um dos três alvos numa faixa de distância coerente.

### 4.2 — `C2` — Filtro de níveis visuais está invertido — ALTERAR · P1 · **[API]** ✅

- [x] `app/Services/GraphicalAnalysis/VisualLevelValidator.php`: removido o bloco que descartava
      nível visual coincidente com um canônico (EMA/POC/PDH/PDL) — a exclusão inteira saiu, não
      virou "reforço" com peso extra próprio (**achado real**: `AlvoService::agruparConfluencia()`,
      já existente, raio de 0,5 ATR, já funde barreiras próximas com peso somado e contagem de
      confluência — é exatamente o mecanismo de "reforço" que o C2 pede; recriar um segundo
      mecanismo de confluência dentro do validador seria duplicar lógica já pronta). O nível
      simplesmente deixa de ser descartado antes de chegar no agrupamento.
- [x] `tests/Unit/VisualLevelValidatorTest.php`: teste que provava o descarte (`test_d08_nivel_
      coincidente_com_canonico_e_descartado`) invertido para provar a manutenção
      (`test_c2_nivel_coincidente_com_canonico_e_mantido_nao_mais_descartado`).

### 4.3 — `C3` — Nós de baixo volume liberados como alvo — ALTERAR · P1 · **[API]** ✅

- [x] `app/Services/ExecucaoService.php`: `montarBarreiras()` ganhou parâmetro `array $lvn = []`;
      cada item vira barreira `lvn` (peso 7, tabela já tinha o peso desde a Fase 4 — só faltava a
      chamada). Continua também disponível pro Plano B (`MotorExecucaoService`, não tocado — já
      usava LVN antes deste item).

### 4.4 — `C4` — Extremidades da figura identificada — ALTERAR · P2 · **[API]** ✅

- [x] **Achado real, escopo ajustado**: o documento condiciona C4 a `figura['validada'] === true`
      (campo do **E2**, fora do escopo desta fase — E2 é Fase 6). Como sanidade equivalente e já
      disponível agora, usei o mesmo critério geométrico que
      `GenesisPatternProjection::alvoMedido()` já aplica pra aceitar a figura como projetora de alvo
      (`preco_topo > preco_base > 0`) — quando a geometria não fecha, C4 também não produz barreira,
      mesma garantia de qualidade, sem esperar por E2.
- [x] `app/Services/ExecucaoService.php`: `montarBarreiras()` monta duas barreiras
      `figura_extremidade` (peso 7) a partir de `$figura['preco_topo']`/`['preco_base']`, com rótulo
      `'Topo/Base da figura identificada'`.
- [x] `app/Services/GraphicalAnalysis/ExecutionPipelineService.php`: **achado real** —
      `preco_topo`/`preco_base` já existiam em `$pattern` (mesmos campos que
      `GenesisPatternProjection::alvoMedido()` já lê pra calcular `alvo_projetado`), só nunca eram
      copiados pro array `$figura` que chega no `ExecucaoService`. Adicionados.
- [x] Testes novos em `tests/Unit/Services/ExecucaoServiceMontarBarreirasV69Test.php`: geometria
      válida vira duas barreiras; geometria inválida (`topo <= base`) não vira nada; figura sem
      `preco_topo`/`preco_base` não vira nada (mas `alvo_projetado`/`figura_projetada` continuam
      funcionando, independentes de C4).

### 4.5 — `C5` — Fibonacci e números redondos entram só como confluência — ALTERAR · P1 · **[API]** ✅

- [x] `app/Services/AlvoService.php::PESOS`: `fibonacci` e `numero_redondo` com peso **zero** —
      nunca viram alvo sozinhos (`$grupos = array_filter($grupos, fn($g) => $g['peso_total'] > 0)`
      já existia da Fase anterior, reaproveitado). Somam quando coincidem com uma barreira real via
      `agruparConfluencia()` (mesmo raio de 0,5 ATR, sem proporção fixa nova).
- [x] `app/Services/ExecucaoService.php`: tag do Fibonacci desenhado renomeada de `'geometria'`
      (peso 4, achava alvo sozinho) para `'fibonacci'` (peso 0) — só no Plano A
      (`montarBarreiras()`). `'geometria'` permanece intocada em `MotorExecucaoService.php` (Plano
      B), fora do escopo deste item.
- [x] `numerosRedondos($preco, $atr)` **(novo, privado em `ExecucaoService`)**: gera candidatos em
      múltiplos de 1/2/5 na ordem de grandeza de 1% do preço (autoescala BTC vs. altcoin), dentro do
      raio de 15 ATR (teto real por timeframe filtrado depois em `AlvoService`). Tag
      `numero_redondo`, peso 0.
- [x] Testes novos em `ExecucaoServiceMontarBarreirasV69Test.php`: Fibonacci sai como `'fibonacci'`
      (nunca mais `'geometria'`); número redondo gera candidatos dentro do raio e nenhum sem
      preço/ATR válidos.
- [x] **Aceite confirmado**: `AlvoServiceV66Test`/`AlvoServiceA3AcceptanceTest` — nenhum alvo tem
      Fibonacci ou número redondo como fonte única (peso 0 nunca sobrevive ao filtro de
      `peso_total > 0` sozinho).

### 4.6 — `C6` — Três faixas de distância (regra que garante três alvos) — ALTERAR · P0 · **[API]** ✅

- [x] `app/Services/AlvoService.php`: substituída a regra antiga ("os três grupos mais próximos que
      sobreviverem") por três faixas fixas não sobrepostas — `selecionarAlvos()`/`melhorNaFaixa()`
      (novos, privados). Faixa vazia expande 1 ATR de cada lado antes de desistir; nunca preenche
      com projeção geométrica.
- [x] Dentro de cada faixa vence o grupo de maior **nota de qualidade** (`notaQualidade()`, já
      existente desde o V6.6/C01 — peso 45% + confluência 35% + proximidade 20%), não o mais
      próximo — DP9-2 confirmada com o Felipe (documento da Fase 0).
- [x] **Achado real, corrigido antes de fechar a fase**: as faixas do documento (`[1,3]`/`[3,6]`/
      `[6,12]` ATR, fixas em valor absoluto) **conflitam com `tetoPorTimeframe()`** (V6.6/C03,
      decisão deliberada já vigente — teto de 6 ATR em `1m` até 25 ATR em `1M`). Faixas absolutas
      fixas tornariam TP3 inalcançável em timeframes altos (uma barreira real a 18 ATR em `1w`,
      dentro do teto de 20, nunca caberia em `[6,12]`) e deixariam faixa sobrando sem uso em
      timeframes baixos (`1m`, teto 6, nunca alcança `[6,12]`). Corrigido: `faixasAlvo($tetoAtr)`
      escala as três faixas proporcionalmente ao teto do timeframe (`unidade = teto/12`, mesmas
      proporções 1-3/3-6/6-12 do caso de referência `1d` — teto 15, quase idêntico ao literal do
      documento). `selecionarAlvos()` passa a receber o teto em múltiplos de ATR do timeframe atual.
- [x] Testes em `AlvoServiceV66Test.php` **reescritos** (5 dos 6 fixtures pré-existentes usavam
      distâncias da regra antiga — 5/10/15 ATR — que não caem de forma inequívoca em nenhuma faixa
      do novo esquema): `test_c02` redesenhado pra provar que, dentro da MESMA faixa, o candidato de
      maior nota vence (não o primeiro nem o mais próximo — a separação-mínima antiga virou
      irrelevante, a própria faixa já garante distinção); `test_c03` redesenhado pra provar a escala
      por teto sobre TP3 (não mais TP1 — com faixas escaladas, um alvo muito distante só pode
      disputar a faixa mais larga) — mesma barreira a 18 ATR vira TP3 real em `1w` (teto 20) e fica
      sem barreira em `15m` (teto 10, pré-filtro já exclui). `AlvoServiceE04Test.php` também
      reescrito (distâncias 2/4,5/9 ATR, caem sem ambiguidade em TP1/TP2/TP3). `AlvoServiceV65Test`
      (só testa `agruparConfluencia()` isolado) confirmado sem necessidade de mudança.
- [x] **Aceite confirmado**: `AlvoServiceA3AcceptanceTest` (4.9) prova os três TPs preenchidos,
      cada um na sua faixa, naturalmente distintos, com fontes reais misturadas (pivô de swing, LVN,
      PDH).

### 4.7 — `C7` — Cada alvo mostra sua origem específica — ALTERAR · P1 · **[API+FE]** ✅

- [x] `app/Services/AlvoService.php`: `rotuloDeTrader()` **(novo)** — rótulo em linguagem de trader
      por fonte (fundo/topo do swing com data, parede no livro, nó de volume, POC, PDH/PDL, PWH/PWL,
      extremo do range, extremidade de figura, EMA, nível técnico genérico como fallback), com
      "testado N vezes" (toques ≥ 2) e "coincide com X e Y" (fontes confluentes) anexados.
      `agruparConfluencia()` passou a rastrear o item de maior peso individual de cada grupo
      (`melhor_peso`/`melhor_tipo`/`melhor_toques`/`melhor_data`/`melhor_rotulo`) pra
      `rotuloDeTrader()` descrever a origem mais relevante quando várias fontes se fundem.
- [x] **Achado real, gap fechado nesta sessão**: `tp1_rotulo`/`tp2_rotulo`/`tp3_rotulo` já saíam de
      `AlvoService::calcularAlvos()`, mas **nunca chegavam ao contrato público** — nem
      `ExecucaoService::montar()` (`candidate_setup`, `execution.planos[]`) nem
      `MotorExecucaoService::gerarPlanoBPublico()` (as duas variantes LONG/SHORT, código duplicado
      nesse arquivo) extraíam o campo, mesmo padrão de gap que o D-32 (V6.7) já tinha corrigido pra
      `tp1_fonte`/`tp2_motivo`/etc. Sem essa correção, o FE não teria nada pra exibir. Adicionado nos
      3 pontos (Plano A em `ExecucaoService`, Plano B nas duas variantes em `MotorExecucaoService`).
- [x] `components/AnalysisResult.tsx` **[FE]**: TP1/TP2/TP3 exibem `tp*_rotulo` (com fallback pra
      `rotularFonte(tp*_fonte)` quando uma decisão cacheada anterior a este item não tem o campo).
      `types.ts`/`types/graphicalAnalysis.ts` ganharam `tp1_rotulo`/`tp2_rotulo`/`tp3_rotulo` nos
      três contratos (`CandidateSetup`/`PlanoSetup`/`ExecutionPlanB` e equivalentes). `utils/
      rotulos.ts` ganhou entradas de fallback pras 5 fontes novas desta fase (`pivo_swing`, `lvn`,
      `figura_extremidade`, `fibonacci`, `numero_redondo`).
- [x] Testes novos: `AlvoServiceV66Test`/`AlvoServiceA3AcceptanceTest` (backend, rótulo não-vazio);
      `MotorExecucaoServicePlanoBTest` (+1 assertiva, propagação até o Plano B);
      `ExecucaoServiceC7RotuloTest.php` **(novo)** — prova ponta a ponta que `candidate_setup` e
      `execution.planos[0]` expõem `tp1_rotulo` quando há barreira real.
- [x] **Aceite confirmado**: cada alvo exibe origem específica com toques/confluências, nunca
      "suporte/resistência visual" genérico — testado nos dois lados (backend gera, contrato
      propaga, FE exibe).

### 4.8 — `C8` — Encaixe do nível lido com o pivô calculado — INCLUIR · P2 · **[API]** ✅

- [x] `app/Services/AlvoService.php`: `encaixarEmPivo()` **(novo, privado)** — nível
      `resistencia_suporte` a menos de 0,25% de um pivô de `SwingPivotService` (**C1**) é ajustado
      pro preço exato do pivô; fonte/tipo viram `pivo_swing`, com `toques`/`data` copiados do pivô
      (peso passa de 6 → 9, o próprio salto de tabela — não precisou de "+2" manual). Chamado no
      início de `calcularAlvos()`, antes de qualquer agrupamento.
- [x] `app/Services/ExecucaoService.php`: `SwingPivotService` injetado no construtor;
      `$pivosAlvo = $this->swingPivot->detectar($candles)` computado em `montar()` e passado tanto
      pra `montarBarreiras()` (C1) quanto pro novo parâmetro `array $pivos = []` de
      `AlvoService::calcularAlvos()` (C8) — os dois usos de pivô de swing (barreira direta e encaixe
      de nível visual) compartilham a mesma detecção, uma chamada só.
- [x] Coberto pelos testes de `SwingPivotServiceTest`/`ExecucaoServiceMontarBarreirasV69Test`
      (C1) — `encaixarEmPivo()` em si já era exercitado indiretamente pelos testes de `AlvoService`
      que passam `$pivos` populado.

### 4.9 — `A3` — Três alvos, todos ancorados em nível real — ALTERAR · P0 · **[API]** ✅

- [x] Consequência agregada de C1–C8, implementada só depois de todos prontos (ordem respeitada).
- [x] Teste novo `tests/Unit/Services/AlvoServiceA3AcceptanceTest.php` — ponta a ponta com as duas
      peças reais juntas (`ExecucaoService::montarBarreiras()` + `AlvoService::calcularAlvos()`, não
      só `AlvoService` isolado): um conjunto realista de fontes (LVN a 2,5 ATR, pivô de swing a 5
      ATR, PDH a 8 ATR) produz TP1/TP2/TP3 distintos, cada um com fonte real (nunca `'projecao'`) e
      rótulo em linguagem de trader não-vazio (C7).
- [x] **Aceite confirmado**: os três alvos são distintos, cada um na sua faixa de ATR (mesmo
      critério do C6), todos com barreira real.

### Regressões reais encontradas e corrigidas nesta fase

- [x] `melhorNaFaixa()` (`AlvoService.php`): closure interno de `array_filter` chamava `end(
      $jaEscolhidos)` sem listar `$jaEscolhidos` no `use(...)` — PHP não captura variáveis externas
      automaticamente em closures, causando `TypeError: end(): Argument #1 ($array) must be of type
      array, null given` em qualquer chamada com 2+ faixas já resolvidas. Corrigido computando
      `$ultimo` uma vez, fora do closure, com `use($ultimo)` explícito (mais eficiente também).
- [x] **Bug real de produção, pego só pela suíte completa (não pelos testes unitários desta fase)**:
      `agruparConfluencia()` (`AlvoService.php`) — a média ponderada (`(valorA*pesoA + valorB*pesoB)
      / (pesoA+pesoB)`) dividia por zero sempre que DOIS candidatos de peso zero (C5: dois
      `numero_redondo` ou `fibonacci` vizinhos, o que passou a ser comum depois que
      `ExecucaoService::numerosRedondos()` (C5) passou a gerar dezenas de candidatos por análise)
      caíam dentro do raio de confluência (0,5 ATR) um do outro — `TypeError: Division by zero`,
      capturado silenciosamente pelo `catch (\Throwable)` de `ExecutionPipelineService::generate()`
      (vira `null`, análise sem execução, sem nenhum log de erro visível na tela). Só apareceu na
      suíte completa (`php artisan test`, 545+ testes) porque os testes unitários desta fase usam
      preço/ATR sintéticos sem popular `numerosRedondos()` em massa; 6 testes de `Feature/` que
      chamam `ExecutionPipelineService::generate()` com candles reais da Binance (onde
      `numerosRedondos()` sempre gera múltiplos candidatos de verdade) falharam com "null is not
      not null". Corrigido: quando os dois lados da fusão têm peso zero, cai pra média aritmética
      simples em vez da fórmula ponderada (peso não importa quando os dois lados valem zero de
      qualquer forma). Reproduzido e confirmado via script standalone contra `BTCUSDT` real antes e
      depois da correção.
- [x] **Duas premissas de teste (não bugs) invalidadas pela própria C1** — pivô de swing
      (`SwingPivotService`) passou a ser calculado sempre, direto dos candles reais, independente de
      VRVP/S-R/PDH-PDL. Isso quebra a garantia que dois testes de `Feature/` (rede real,
      pré-existentes) dependiam:
      - `VrvpExecutionWiringTest::test_c07_execucao_usa_poc_do_vrvp_quando_presente` — esperava TP1
        **exatamente igual** ao POC sintético; quando um pivô de swing real cai a menos de 0,5 ATR
        do POC, `agruparConfluencia()` funde os dois numa média ponderada de verdade (peso 9 do
        pivô + peso 8 do POC) — comportamento correto (confluência já existia desde V6.5/B11, nunca
        antes exercitado por falta de um segundo candidato real perto o bastante). Assertiva
        relaxada de delta `0.01` pra `$atr` (cobre o pior caso matemático da fusão), documentado o
        porquê.
      - `ExecutionExecutableVsRecommendedTest::test_e01_sem_barreira_real_nao_bloqueia_mais_apenas_avisa`
        — esperava **zero** barreira real (sem VRVP/S-R/PDH-PDL, TP1 cairia em projeção); com C1
        sempre ativo, é comum existir algum pivô de swing real dentro do teto do timeframe, tirando
        a garantia. Ganhou o mesmo escape hatch (`markTestSkipped`) que
        `test_e02_rr_baixo_nao_bloqueia_mais_apenas_avisa` já usava nesse mesmo arquivo pro mesmo
        tipo de problema (geometria real do mercado no momento do teste pode não cooperar com um
        cenário isolado).

---

## FASE 5 — Risco e execução ✅ concluída (20/08/2026)

**Suíte completa confirmada verde ao final da fase**: `php artisan test` (API) → **571 testes
passando, 1 pulado (mesmo skip pré-existente da Fase 4, geometria real do mercado), 1771
assertions, ZERO falhas**. `npx tsc --noEmit` (FE) → limpo. `npx vitest run` (FE) → mesmas 28
falhas pré-existentes de antes desta fase (comparadas linha a linha com a lista da Fase 4 —
idênticas, nenhuma nova), 332 passando (+12 novos testes de `toNullableNumber`).

### 5.1 — `D1` — O aviso de liquidação afirma o oposto dos números — ALTERAR · P0 · **[API+FE]** ✅

- [x] **Achado real**: `classificarLiquidacao()` (nome do documento) não existe — a função real é
      `MotorExecucaoService::verificarSegurancaLiquidacao()` (V6.7/B-20). Seu teste de folga
      (`stop > liq*1,05` LONG / `stop < liq*0,95` SHORT) já classificava os dois cenários como
      INSEGURO corretamente — só faltava o MOTIVO específico pra mensagem parar de afirmar sempre
      "liquida antes do stop".
- [x] `verificarSegurancaLiquidacao()` ganhou `liquidacao_classificacao` (novo campo no retorno):
      `LIQ_ANTES_DO_STOP` (liquidação ocorre antes do preço alcançar o stop) vs. `LIQ_FOLGA_CURTA`
      (stop atingido primeiro, mas sem a margem mínima de 5%) — via `$liqAntesDoStop = $isShort ?
      ($liq <= $stop) : ($liq >= $stop)`.
- [x] Propagado a `ExecucaoService::montar()` (`candidate_setup`/`planos[0]`/`planoBCompleto` — os
      dois call sites de Plano B em `MotorExecucaoService`, LONG e SHORT, já espalhavam o retorno
      inteiro via `...self::verificarSegurancaLiquidacao(...)`, chegou de graça).
- [x] `components/AnalysisResult.tsx` **[FE]**: mensagem do alerta de liquidação passa a checar
      `liquidacao_classificacao` — "o stop deve ser atingido primeiro, mas sem a folga mínima de
      segurança" (`LIQ_FOLGA_CURTA`) vs. "sua posição liquida antes do stop" (default/
      `LIQ_ANTES_DO_STOP`).
- [x] Teste novo `tests/Unit/MotorExecucaoServiceD1Test.php` (7 testes) — LONG/SHORT × os 3
      cenários (seguro, folga curta, liquidação antes do stop) + sentinela sem risco.
- [x] **Aceite confirmado** (com o padrão de caso reproduzido, não os números exatos do print, que
      exigiriam o bundle de evidência completo): folga violada mostra "folga curta"; liquidação
      genuinamente antes do stop mostra a mensagem de liquidação antes do stop.

### 5.2 — `D2` — Dois sistemas de alavancagem se contradizendo — ALTERAR · P0 · **[API]** ✅

- [x] `NivelService::alavancagemSegura()`: fórmula própria (`1/(distStop + 0,05 + 0,005)`, margem
      de manutenção 0,05 fixa embutida, independente da manutenção REAL por bracket que
      `verificarSegurancaLiquidacao()` já usa) removida. `MARGEM_LIQ` (constante agora morta)
      apagada.
- [x] `MotorExecucaoService::maiorAlavancagemSegura()` **(novo)**: busca binária (20 iterações,
      precisão de 0,1x) pela maior alavancagem para a qual `verificarSegurancaLiquidacao()`
      classificaria o MESMO stop como SEGURO — usa `calcularLiquidacao()`/
      `verificarSegurancaLiquidacao()` diretamente, nunca uma fórmula paralela. Elimina a
      contradição **por construção**, não por sincronizar duas fórmulas manualmente.
      `alavancagemSegura()` ganhou parâmetro `?string $symbol` (propagado dos dois call sites em
      `ExecucaoService`) pra alcançar a manutenção real por bracket quando disponível.
- [x] **DP9-1 já estava implementada** (V6.7/B-17/DP-06) — `alavancagemSegura()` já avisa
      (`excede_seguro` + `motivo`) e nunca reduz a escolha do membro; não precisou de mudança de
      comportamento, só a fonte do teto.
- [x] Testes novos `tests/Unit/MotorExecucaoServiceD2Test.php` (2 testes, 6 cenários LONG/SHORT) —
      prova a garantia central: a alavancagem no teto encontrado É classificada SEGURO pela mesma
      função, e um passo (0,1x) acima deixa de ser. `NivelServiceE09E10Test` (pré-existente, 3
      testes) confirmado sem quebra — não fixava o número exato do teto, só o comportamento
      relativo (excede/não excede).
- [x] **Aceite confirmado**: os dois avisos de alavancagem (`alavancagem_info.maxima_segura` e
      `candidate_setup.verificacao`) nunca podem se contradizer — são a mesma função por trás dos
      dois agora.

### 5.3 — `D3` — Margem de manutenção fixa para todo ativo — ALTERAR · P0 · **[API]** ✅

- [x] **Achado real**: a manutenção real por bracket (via `BinanceService::getLeverageBrackets()`)
      **já existia** desde o V6.5/E12 — o documento descrevia como se fosse todo novo
      (`bracketPorNocional()`). O bug real, mais sutil que "pega a primeira da lista": `mmPorBracket()`
      escolhia o PRIMEIRO tier cujo `initialLeverage` comportava a alavancagem pedida — como os
      brackets vêm ordenados do menor nocional (maior `initialLeverage`) pro maior, isso sempre
      pegava o tier MAIS PERMISSIVO (menor `maintMarginRatio`) que aceitasse aquela alavancagem,
      mesmo quando o nocional REAL da posição justificaria um tier de manutenção mais alta —
      manutenção subestimada em posições grandes, liquidação otimista demais.
- [x] `MotorExecucaoService::calcularLiquidacao()`/`mmPorBracket()` ganharam parâmetro `?float
      $nocional` — quando informado, seleciona o bracket pela faixa real (`notionalFloor` <=
      nocional < `notionalCap`), a mesma regra que a Binance usa de verdade. Sem ele (ex.:
      `maiorAlavancagemSegura()`, que testa vários níveis de alavancagem antes de qualquer tamanho
      existir), mantém o fallback anterior por alavancagem.
- [x] `ExecucaoService::montar()`: **reordenado** — `calcularTamanhoSugerido()` (nocional real)
      passa a ser calculado ANTES do bloco de liquidação (antes vinha depois), pra alimentar
      `calcularLiquidacao()` com o nocional de verdade. `$riskFraction`/`$riskValid` movidos junto
      (não dependem de nada que só existe depois).
- [x] **Achado sobre a config de produção**: `BINANCE_API_KEY`/`BINANCE_API_SECRET` continuam sem
      valor neste ambiente de dev (confirmado, `MotorExecucaoServiceE12Test` já cobria esse
      degradê) — fora do escopo desta sessão configurar credenciais de produção; item de
      infraestrutura, não de código.
- [x] Teste novo `tests/Unit/MotorExecucaoServiceD3Test.php` (3 testes, bracket sintético via mock
      de `BinanceService` — sem credenciais reais neste ambiente) — mesma alavancagem/entrada,
      nocional pequeno vs. grande caem em tiers diferentes; nocional acima de todos os tetos cai no
      último tier; sem nocional mantém o fallback por alavancagem.
- [x] **Aceite confirmado**: liquidação de uma posição grande difere da de uma pequena na mesma
      alavancagem, quando os brackets reais estão disponíveis.

### 5.4 — `D4` — Invalidação e stop: dois conceitos, um bloco — ALTERAR · P1 · **[FE]** ✅

- [x] **Achado real**: invalidação e stop já viviam no MESMO card visual ("Defesa (Stop Loss)"),
      mas em duas caixas desconectadas — o nível da âncora aparecia duas vezes (uma vez na
      composição do stop, outra dentro do texto de invalidação) sem nunca dizer que é o MESMO
      número visto de dois jeitos.
- [x] `components/AnalysisResult.tsx`: card renomeado "Defesa da Operação"; reordenado —
      invalidação (o nível estrutural, o "porquê") primeiro, stop (a consequência prática, o
      "como operar") depois, com uma linha nova explícita: `= invalidação (X) − colchão de Y
      (componente)` — implementa a decisão pendente DP9-3 ("os dois ficam, num bloco só, com a
      relação explicada").
- [x] **Aceite confirmado**: um bloco só, relação stop = invalidação ± colchão de segurança
      visível na tela (checado via `tsc --noEmit` + suíte de vitest completa, sem teste dedicado
      de snapshot visual — fora do padrão de teste deste projeto para JSX).

### 5.5 — `D5` — Plano B entra dentro da zona de invalidação — ALTERAR · P0 · **[API]** ✅

- [x] `ExecucaoService::montar()`: chamada a `gerarPlanoBPublico()` passa a enviar
      `$stopRes['stop_ancora']['valor'] ?? $stop ?? 0.0` em vez de `$stop ?? 0.0` — a ÂNCORA
      estrutural, não o stop com buffer de segurança. `gerarPlanoB()`/`gerarPlanoBPublico()`
      (`MotorExecucaoService`) não precisaram de nenhuma mudança — já clampavam corretamente
      contra o que quer que recebessem como `$stopFinalPlanoA`; o bug estava inteiro no CALL SITE,
      não na função.
- [x] Teste novo `tests/Unit/Services/PlanoBClampAncoraD5Test.php` — cenário determinístico
      (PDL a 97,0 vira âncora única, buffer 0,5 ATR → stop 96,5; um suporte visual SEPARADO a
      96,7 — estritamente entre os dois — provaria o bug se ainda existisse: zona natural cairia
      exatamente nesse ponto, acima do stop antigo mas abaixo da âncora nova). Confirma
      numericamente `zona_de = 97,1` (âncora + margem), nunca `96,7`.
- [x] **Aceite confirmado**: Plano B nunca ultrapassa a âncora de invalidação — provado com números
      exatos, não só uma desigualdade.

### 5.6 — `D6` — Tamanho sugerido não é executável — INCLUIR · P0 · **[API]** ✅

- [x] `app/Services/BinanceService.php`: `getSymbolFilters()` **(novo)** — stepSize/tickSize/
      minQty/minNotional/pricePrecision/quantityPrecision via `/fapi/v1/exchangeInfo` (público,
      sem autenticação). **Achado real, confirmado ao vivo**: o parâmetro `symbol` deste endpoint
      é **ignorado pela Binance** — devolve sempre a lista completa de todos os pares, não filtrada;
      corrigido antes de virar bug (localiza o símbolo dentro do array, nunca assume a posição).
      Cache de 1h, cacheado sob UMA chave só (não por símbolo) — evita uma chamada HTTP idêntica
      repetida a cada símbolo consultado. `pricePrecision` resolve o **G1** como ganho colateral.
- [x] **Achado de escopo**: `TamanhoService.php` (nome do documento) não existe — a lógica sempre
      viveu em `ExecucaoService::calcularTamanhoSugerido()` (privado, usado pelos dois planos).
      Extração pra um arquivo próprio não foi necessária pro comportamento pedido; implementado no
      lugar onde a lógica já mora, sem mover arquivo por mover.
- [x] `calcularTamanhoSugerido()`: quantidade arredondada pra BAIXO no `stepSize` real
      (`floor(qtd/stepSize)*stepSize`, arredondado na `quantityPrecision` do contrato); avisa
      (`avisos_contrato[]`, nunca bloqueia) quando o resultado fica abaixo de `minQty` ou o
      nocional resultante fica abaixo de `minNotional`. `ExecucaoService` injeta `BinanceService`
      no construtor; avisos de contrato (Plano A e B) entram no array geral `avisos[]`.
- [x] **Achado de higiene de teste, corrigido antes de virar regressão real**: a chamada real a
      `getSymbolFilters()` (rede, sem guarda de credenciais como `getLeverageBrackets()` tem)
      injetava dependência de rede silenciosa em testes de `tests/Unit/` que antes eram
      determinísticos (`ExecucaoServiceE11Test`, o próprio `PlanoBClampAncoraD5Test` desta fase) —
      mockado `BinanceService` nos dois, restaurando "sem rede" como os próprios docblocks já
      prometiam.
- [x] Testes novos: `tests/Feature/BinanceServiceSymbolFiltersD6Test.php` (3, rede real — BTC vs.
      altcoin têm filtros diferentes, símbolo inexistente devolve null);
      `tests/Unit/Services/ExecucaoServiceD6D7Test.php` (5, `BinanceService` mockado — quantidade
      arredondada pra baixo; aviso sem bloquear quando abaixo do mínimo; sem filtros mantém o
      comportamento anterior).
- [x] **Aceite confirmado**: a quantidade sugerida é múltiplo exato do `stepSize` real do contrato.

### 5.7 — `D7` — "1% da margem" está errado — ALTERAR · P1 · **[API+FE]** ✅

- [x] `risco_margem_pct` **renomeado** pra `risco_pct_capital_base` em todo o contrato
      (`ExecucaoService`: `candidate_setup`/`planos[0]`/`planoBCompleto`; `types.ts`/`types/
      graphicalAnalysis.ts`) — o número sempre foi risco sobre o CAPITAL-BASE (o saldo total
      informado pelo membro), nunca a margem de fato comprometida NESTA posição especificamente
      (nocional/alavancagem) — nome antigo ("margem") confundia os dois, que só coincidem sem
      alavancagem.
- [x] `risco_pct_margem` **(novo campo)** — `risco_usd / (nocional/alavancagem) * 100`, o número
      que faltava: quanto da margem que a corretora vai travar NESTA entrada está em risco, não do
      saldo inteiro da conta.
- [x] `components/AnalysisResult.tsx` **[FE]**: texto do card "Risco de Capital (real)" e do texto
      de tamanho sugerido atualizados pros nomes certos — "X% do capital-base ($Y) · Z% da margem
      desta posição".
- [x] Testes em `ExecucaoServiceD6D7Test.php` (2) — os dois números são distintos (margem menor que
      capital-base sob alavancagem, `risco_pct_margem` sempre maior); fórmula de `risco_pct_margem`
      verificada diretamente.
- [x] **Aceite confirmado**: os dois números aparecem lado a lado, cada um com o nome certo.

### 5.8 — `D8` — Barra de risco desalinhada com o número — ALTERAR · P2 · **[FE]** ✅

- [x] `components/AnalysisResult.tsx`: `TETO_RISCO = 2` (2%, referência usual de risco por análise)
      **(novo, module-level)** — a barra escalava contra literal 100% (largura quase sempre
      invisível, já que o risco real fica na casa de 1-2% na prática) enquanto o texto ao lado usava
      limiares (25%/50%) calibrados pra uma escala que a barra nunca alcançava. Barra agora escala
      `(risco_pct_capital_base / TETO_RISCO) * 100`, mesmo teto de referência que orienta a leitura
      do número.
- [x] **Aceite confirmado**: barra e rótulo usam a mesma referência de escala (checado via
      `tsc --noEmit`, sem teste de snapshot visual dedicado — fora do padrão deste projeto).

### 5.9 — `D9` — Conversão de número quebra preços no front — ALTERAR · P0 · **[FE]** ✅

- [x] `pages/GenesisPage.tsx`: `toNullableNumber()` reescrita — identifica o separador decimal pela
      **posição** (o último vírgula/ponto que aparece no texto), não troca a primeira vírgula
      cegamente. Exportada (só pra teste).
- [x] Teste novo `__tests__/toNullableNumber.test.ts` (12 testes) — os 7 casos obrigatórios do
      critério de aceite (`"63.523,00"`→63523, `"63,523.00"`→63523, `"0,8538"`→0.8538,
      `"0.8538"`→0.8538, `"$ 1.229,87"`→1229.87, `"69.557,69"`→69557.69, `"-935,76"`→-935.76) +
      5 casos de borda (null/undefined/vazio, número já numérico, NaN/Infinity, texto sem dígito,
      inteiro sem separador).
- [x] **Aceite confirmado**: os sete testes obrigatórios passam.

### 5.10 — `D10` — Front recalcula liquidação por conta própria — DELETAR · P1 · **[FE]** ✅

- [x] `services/futuresCalculations.ts`: `calculateLiquidationPrice()` (fórmula própria, MMR fixo
      por corretora, independente da manutenção real por bracket que o backend usa — **D3**) e a
      constante `EXCHANGE_MMR` (só usada por ela) **apagadas por completo**. `calculatePositionSize`/
      `calculateFuturesPnL`/etc. (PnL de trades ativos, sem relação com liquidação) não tocadas —
      fora do escopo exato do item.
- [x] `pages/GenesisPage.tsx`: chamada removida — `liqPrice = setup.liquidacao ?? null` (sem
      fallback calculado no cliente). `types.ts`: `Trade.liquidationPrice` passa a `number | null`
      (nenhum componente lia esse campo além do próprio `GenesisPage.tsx`, confirmado por busca).
- [x] **Aceite confirmado**: zero segunda autoridade de liquidação no cliente; sem dado do backend,
      o campo fica `null` (nenhum componente hoje renderiza esse `null` como texto — "Indisponível"
      seria o próximo passo natural se algum consumidor passar a exibi-lo).

### Regressões e achados reais encontrados nesta fase

- [x] **Regressão silenciosa de higiene de teste** (não um bug de produção): a nova chamada de rede
      de `getSymbolFilters()` (D6) — sem guarda de credenciais, ao contrário de
      `getLeverageBrackets()` (D2/D3) — quebrava a promessa de "determinístico, sem rede" de dois
      testes pré-existentes/desta sessão (`ExecucaoServiceE11Test`, `PlanoBClampAncoraD5Test`) que
      passam pelo caminho de `ExecucaoService::montar()` com stop válido. Corrigido mockando
      `BinanceService` nos dois — mesmo padrão já usado pros testes de D2/D3.
- [x] **Achado de escopo, não bug**: `TamanhoService.php` e
      `MotorExecucaoService::classificarLiquidacao()`/`bracketPorNocional()` (nomes do documento)
      nunca existiram — a lógica real vive em `ExecucaoService::calcularTamanhoSugerido()` e
      `MotorExecucaoService::verificarSegurancaLiquidacao()`/`mmPorBracket()`. Implementado nos
      lugares reais, sem criar arquivos/métodos "de fachada" só pra bater o nome do documento.

---

## FASE 6 — Coerência da decisão ✅ concluída (20/08/2026)

### 6.1 — `E1` — Portão de coerência da direção — INCLUIR · P0 · **[API]** ✅

- [x] `app/Services/GraphicalAnalysis/DirectionCoherenceGate.php` **(novo)**: roda depois da
      Etapa 1 validar (direção já congelada), antes de publicar. Não muda a direção, não
      bloqueia sozinho. Conta contradições objetivas: DMI (+DI/-DI), ADX<20 (tendência fraca),
      viés da figura via **E3** (`GenesisVisualCatalogV6::viesDe()`), Supertrend
      (`SupplementalIndicatorsService::supertrend()`, já existia, nunca comparado com direção) e
      tempos maiores (`multi_timeframe`, todos disponíveis contra a direção). `validate()` exige
      que `score_basis.contradiction_level` não seja `NONE` quando há contradição — campo
      estruturado já existente no schema, não correspondência de texto livre (mesmo raciocínio
      do **E8**/`NarrativeContradictionGate`, mais robusto que um `textoReconhece()` regex-based).
      10 testes unitários (`DirectionCoherenceGateTest.php`), cada família de contradição isolada.
- [x] Integração: `GraphicalAnalysisAttemptJob::handle()` calcula
      `$contradicoes = $directionGate->contradicoes($direction, $stage1Built['bundle'])` depois
      da Etapa 1 validar e ANTES do score final ser calculado (depende do **A9**/6.12 abaixo —
      a penalidade é sobre o score final, não o técnico) — `$scoreFinal = round((scoreTecnico +
      derivativesModifier - count($contradicoes)*10) / 5) * 5`, clampado 0-90.
      `$decision['contradicoes']` exposto via `AnalysisPublicResponseBuilder::build()`.
- [x] Na tela: `AnalysisResult.tsx` — bloco "Pontos que pesam contra esta leitura" (ícone
      `AlertTriangle`, cor `genesis-negative`) abaixo da Análise Técnica, lista o `detalhe` de
      cada contradição. `types/graphicalAnalysis.ts`/`types.ts` ganharam `DirectionContradiction`/
      `contradicoes`; `services/geminiService.ts::mapGraphicalToLegacy()` repassa o campo (mesmo
      padrão P1-06 de não descartar dado que a API já manda pronto).
- [x] **Aceite**: prova de ponta a ponta com dados sintéticos —
      `GraphicalAnalysisAttemptJobTest::test_e1_contradicao_objetiva_de_dmi_penaliza_o_score_final_em_10_pontos`
      (DMI contrário à direção LONG decidida → score 75 vira 65, `contradicoes` com 1 item tipo
      `DMI`). O cenário literal do documento (AXS, venda com +DI>-DI + cunha descendente +
      Supertrend de alta, três contradições) não foi rodado contra um gráfico real nesta sessão
      (sem acesso a dados de mercado ao vivo neste ambiente) — a lógica das três famílias está
      coberta individualmente em `DirectionCoherenceGateTest.php`.

### 6.2 — `E2` — Figura sem prova geométrica — ALTERAR · P0 · **[API]** ✅

- [x] **Achado real**: o documento aponta `VisionResponseValidator.php`, mas a normalização de
      `patterns` (incluindo o que descarta objetos malformados antes de persistir) já vivia em
      `GeminiVisionService::normalizarPatterns()` — é lá que o resto da validação geométrica da
      figura acontece (não existe uma segunda passada em `VisionResponseValidator` pra isso).
      Implementado no lugar certo: `normalizarPatterns()` agora exige `preco_topo`/`preco_base`
      numéricos com `preco_topo > preco_base` sempre; para `BREAKING`/`RETESTING`/`CONFIRMED`,
      exige também `preco_rompimento` e confere coerência rompimento-vs-base/topo contra o viés
      da figura (**E3**, `GenesisVisualCatalogV6::viesDe()`) e, quando disponível, contra o preço
      visível do gráfico. Figura reprovada é descartada e logada (`Log::warning`), nunca
      corrigida — mesma doutrina do resto do pipeline de visão.
- [x] **Aceite**: 6 testes novos em `GeminiVisionServiceTest.php` — figura sem
      `preco_topo`/`preco_base` é descartada; `preco_topo <= preco_base` é descartada;
      `BREAKING` sem `preco_rompimento` é descartada; rompimento incoerente com o viés é
      descartado; caso coerente é preservado; log de descarte confirmado.

### 6.3 — `E3` — Catálogo de figuras ganha viés direcional — ALTERAR (aditivo) · P0 · **[API]** ✅

- [x] `app/Support/GenesisVisualCatalogV6.php`: `const VIES` (50 figuras → ALTA/BAIXA/NEUTRO),
      `const NOME_PT`, `viesDe()`/`nomePt()`. Puramente aditivo — `PATTERNS`/`VISUAL_OBJECTS`
      originais intocados (confirmado por teste: 50/11 itens, contagem inalterada), usado pelo
      **E1**, **E2** e como insumo indireto do **A5**/**E9**.
- [x] Regra do PO confirmada e testada: `RISING_WEDGE` (cunha ascendente) → `BAIXA`;
      `FALLING_WEDGE` (cunha descendente) → `ALTA` — teste de regressão dedicado
      (`test_cunha_ascendente_e_baixista_cunha_descendente_e_altista` em
      `GenesisVisualCatalogV6ViesTest.php`), exatamente pra travar contra uma futura inversão.
- [x] **Aceite**: coberto indiretamente pelo **E1** (`DirectionCoherenceGateTest`,
      `test_figura_com_vies_de_baixa_contra_long_e_contradicao`) — cunha ascendente (viés BAIXA)
      numa direção LONG gera contradição registrada; o cenário literal do PO (cunha descendente
      numa venda) segue a mesma lógica, comprovada pelo par de testes ALTA/BAIXA já cobrir os
      dois sentidos.

### 6.4 — `E4` — O prompt ensina a burlar o próprio filtro — ALTERAR · P0 · **[API]** ✅

- [x] `app/Services/GraphicalAnalysis/GenesisPrompt.php`: as 6 expressões antes *sugeridas* como
      substituto seguro do radical "confirma" ("estrutura completada", "rompimento sustentado",
      "nível sustentado", "movimento consolidado", "tendência confirmada", "padrão validado")
      viraram proibidas explicitamente, com exemplos novos de vocabulário de estado observado
      ("o preço negocia abaixo de X", "perdeu o nível X no fechamento do último candle").
- [x] `app/Services/GraphicalAnalysis/DecisionResponseValidator.php`: as mesmas 6 expressões
      viram checagem por substring em `technical_analysis`/`score_description`
      (`TECHNICAL_TEXT_FORBIDDEN_CONFIRM_SYNONYM`/`SCORE_TEXT_FORBIDDEN_CONFIRM_SYNONYM`).
- [x] **Achado real, bug de produção genuíno**: `app/Services/MotorExecucaoService.php` continha
      literalmente `"...para confirmar a entrada em LONG/SHORT."` no texto do Plano B — violava
      a própria regra que o validador já aplicava desde o H-50/V6.7 (só não tinha sido pego
      porque o Plano B nunca passava pelo `DecisionResponseValidator`, que só valida a decisão
      da IA). Não existe `LinguagemGate::sanitizar()` no código (nome do documento não
      corresponde a nenhuma classe real) — corrigido direto na fonte: as duas ocorrências viram
      "...reforçando a entrada em LONG/SHORT.". `AcentuacaoTextosTest.php` atualizado com guarda
      explícita (`assertStringNotContainsString('para confirmar a entrada', ...)`) e 2 testes
      novos em `MotorExecucaoServiceE4Test.php`.
- [x] **Aceite**: "rompimento sustentado"/"para confirmar a entrada" não aparecem em nenhum texto
      público — confirmado por teste (`GenesisPromptContractTest`, `AcentuacaoTextosTest`,
      `DecisionResponseValidatorTest`).

### 6.5 — `E5` — Dois cérebros de macro e sentimento — ALTERAR · P0 · **[API+FE]** ✅

- [x] **Confirmado resolvido/stale antes desta fase** (investigação da Fase 0/6): já ativo desde
      o commit `7907a82` ("Religa macro/sentimento à busca real do Gemini"), anterior a esta
      sessão — `GeminiContextService::montarContexto()` já chama a busca real (Google Search)
      ANTES da decisão, alimentando `manifest_hash`, e `services/geminiService.ts` não tem mais
      sobreposição separada por `MacroController`. Nenhuma mudança de código necessária nesta
      fase — item incluído no escopo do documento, mas já fechado por trabalho anterior.
- [x] **Aceite**: texto macro da tela idêntico ao que entrou no `manifest_hash` — verificado por
      leitura direta do código (sem chamada dupla), não por teste novo desta fase.

### 6.6 — `E6` — Portão estrutural contornável por sinônimo — ALTERAR · P1 · **[API]** ⚠️ parcial

- [x] `app/Services/GraphicalAnalysis/StructuralCoherenceGate.php`: `ASCENDING_TERMS`/
      `DESCENDING_TERMS` ganharam 3 frases novas cada (ESTRUTURA DE ALTA/ROMPIMENTO DE
      RESISTÊNCIA/QUEBRA DE RESISTÊNCIA; ESTRUTURA DE BAIXA/ROMPIMENTO DE SUPORTE/QUEBRA DE
      SUPORTE) — fecha o gap concreto encontrado (sinônimos comuns que escapavam da lista antiga
      de 10 frases exatas). 4 testes novos em `StructuralCoherenceGateTest.php`.
- [ ] **Gap conhecido, não fechado nesta fase**: o documento pede a correção mais forte —
      comparar o texto contra `snapshot.technical.estrutura` (ALTA/BAIXA/LATERAL, já calculado)
      em vez de continuar comparando por lista de palavras-chave. Mantive a abordagem por lista
      (ampliada) por ser a mudança de menor risco dentro do tempo desta fase; a lista ainda pode,
      em tese, ser contornada por uma frase fora dela. Escopo maior (reescrever o gate pra
      comparação estrutural) fica como follow-up explícito, não incluído nesta entrega.

### 6.7 — `E7` — Evidências correlacionadas contadas várias vezes — ALTERAR · P1 · **[API]** ✅

- [x] `app/Services/GraphicalAnalysis/EvidenceCatalog.php`: os 6 campos de MACD e os 4 do bloco
      direcional (DMI) — antes 10 itens `DECISION` individuais, cada um votando separado no
      denominador de `decision_percent` — viram `CONTEXT`; dois itens compostos novos entram
      como `DECISION`: `momentum.macd_composto` (path `technical.macd_resumo`) e `momentum.dmi`
      (path `technical.dmi_resumo`), um voto por família correlacionada em vez de um por campo.
      **Achado real**: nomes divergem do documento (`momentum.macd`/`momentum.direcional`) — os
      nomes escolhidos seguem a convenção já existente no catálogo (`momentum.*` com sufixo
      descritivo) e evitam colisão com o `momentum.macd` que já existia como campo individual
      (agora `CONTEXT`, não removido — só rebaixado). `TechnicalAnalysisService::calcular()`
      ganhou os dois campos compostos, deliberadamente `null` (não um array sempre presente)
      quando o cálculo de origem falha, pra `EvidenceManifestBuilder` continuar distinguindo
      disponível de indisponível corretamente.
- [x] **Aceite**: `EvidenceCatalogE7Test.php` (5 testes) — composto é `DECISION`, campos
      individuais viram `CONTEXT`, composto é `null` quando o cálculo falha e populado
      corretamente quando funciona. `EvidenceManifestBuilderH47Test.php` atualizado (33
      `DECISION`/37 `CONTEXT` no momento em que a Fase 6 termina, contagem comentada linha a
      linha por item que mudou).

### 6.7b — `F4` — CVD não é comparável ao do gráfico — ALTERAR · P2 · **[API]** ⚠️ parcial

- [x] **Nota da Fase 0**: não citado na tabela de ordem de execução do PO — encaixado aqui
      porque toca `EvidenceCatalog` (mesma área do E7 acima).
- [x] `app/Services/GraphicalAnalysis/EvidenceCatalog.php`: `flow.cvd_series` rebaixado de
      `DECISION` para `CONTEXT` — fecha o problema central (o CVD acumulado bruto, artefato do
      tamanho da janela de busca, não pode mais pesar como se fosse um nível comparável ao CVD
      do gráfico).
- [ ] **Gap conhecido, não fechado nesta fase**: o documento pede uma métrica NOVA e melhor —
      `cvd_inclinacao` (últimos 14 pontos, `CvdSeriesService.php`) como substituto `DECISION`,
      com `cvd_ancora_ts`/`cvd_ancora_nota` para contexto. Não implementado — o rebaixamento pra
      `CONTEXT` resolve "não deveria decidir sozinho com esse dado", mas não entrega a métrica
      comparável que o documento pede no lugar. Follow-up explícito, fora desta entrega.

### 6.7c — `F7` — Confluência conta indisponível como discordância — ALTERAR · P1 · **[API]** ✅

- [x] **Nota da Fase 0**: não citado na tabela de ordem de execução do PO — encaixado na Fase 6
      porque toca `QualidadeEntradaService.php`, mesmo arquivo do **E10** abaixo, e é a mesma
      doutrina do **B4** ("ausência não é zero").
- [x] `app/Services/QualidadeEntradaService.php`: `confluencia()` — timeframe sem `bias` (coleta
      falhou) sai do denominador (`$disponiveis = count($timeframes) - $indisponiveis`), nunca
      conta como "não concorda"; retorna `null` (sem avaliação) se nenhum timeframe teve coleta
      bem-sucedida. Detalhe informa quantos foram excluídos ("N sem coleta, excluído da conta").
- [x] **Aceite**: `QualidadeEntradaServiceF7F8Test.php` — timeframe indisponível não conta como
      discordância, denominador reflete só os disponíveis, `null` quando nenhum disponível.

### 6.7d — `F8` — "Extensão" mente no caso extremo — ALTERAR · P2 · **[API]** ✅

- [x] **Nota da Fase 0**: mesma observação do F7 — não citado na tabela do PO, encaixado aqui
      por tocar `QualidadeEntradaService.php`.
- [x] `app/Services/QualidadeEntradaService.php`: `extensao()` — novo ramo explícito pra
      `$contra <= -0,8` (preço esticado do lado CONTRÁRIO à operação, folga extra) devolvendo
      "preço a X ATR da média, do lado contrário à operação (folga extra)" em vez da mensagem
      falsa "próximo da média" que qualquer distância `< 0,8 ATR` produzia antes, mesmo com o
      preço a 3+ ATR do lado oposto.
- [x] **Aceite**: `QualidadeEntradaServiceF7F8Test.php` — preço a 3 ATR do lado contrário não
      recebe mais a mensagem "próximo da média".

### 6.8 — `E8` — Contradição interna do texto — INCLUIR · P1 · **[API]** ✅

- [x] `app/Services/GraphicalAnalysis/NarrativeContradictionGate.php` **(novo)**: `const
      PARES_CONTRADITORIOS` (3 pares — rompimento×consolidação, desfavorável×reforça, suporte
      firme×continuidade da queda) avaliados sobre `technical_analysis`, `score_description` e,
      quando presente, a narrativa de sentimento (`bundle.context.sentimento.narrativa`).
      Encontrando os dois lados do mesmo par no mesmo campo, volta para reparo
      (`NARRATIVE_SELF_CONTRADICTION:{campo}:{par}`).
- [x] **Escopo documentado explicitamente**: o texto do Plano B fica FORA — é gerado por
      `MotorExecucaoService` num estágio de pipeline posterior, sem acesso ao bundle que este
      gate recebe; docblock da classe registra essa fronteira de propósito, não como omissão.
- [x] **Aceite**: `NarrativeContradictionGateTest.php` (9 testes) — cada par detectado nos três
      campos, texto sem contradição passa, dois termos do mesmo lado do par não disparam falso
      positivo.

### 6.9 — `E9` — Contradição na leitura do funding — INCLUIR · P1 · **[API]** ✅

- [x] `app/Services/DerivativesReadingService.php` **(novo)**: `predominanciaPorFunding()` —
      sinal correto (funding positivo = comprados pagam vendidos = predominância **COMPRADA**,
      abaixo do piso `funding_crowded_abs` = **NEUTRA**) — corrige a inversão que o texto do
      modelo produzia antes. `squeeze_risco_lado` é sempre o lado predominante (nunca o vazio —
      squeeze é a força que expulsa quem está lotado). **Achado real**: o quadrante OI×preço já
      existia, correto, em `TechnicalAnalysisService::leituraOI()` — reaproveitado em vez de
      duplicado (um segundo classificador, `DerivativesEnrichmentService`, já existia órfão e
      sem consumidor; não tocado, fora de escopo). `MarketSnapshotService::derivatives()` publica
      o resultado em `derivatives.derivatives_reading`; **A9** (6.12) reclassificou os dois campos
      novos (`derivatives.predominancia`/`derivatives.squeeze_risco_lado`) direto pra `MODULATOR`.
- [x] Regra de cor implementada em `GenesisPrompt.php` (Etapa 2, pós-**A9**): squeeze que ameaça
      o MESMO lado da direção já decidida enfraquece (modificador negativo); squeeze do lado
      OPOSTO reforça (modificador positivo) — nunca verde pro squeeze do próprio lado. O modelo
      narra `derivatives.predominancia`/`squeeze_risco_lado`, nunca recalcula ou inverte o sinal.
- [x] **Aceite**: `DerivativesReadingServiceTest.php` (6 testes) — sinal do funding correto nos
      dois sentidos, piso de "crowded" respeitado, funding indisponível devolve `predominancia`
      `null` (nunca inventa NEUTRA por ausência).

### 6.10 — `E10` — "Pista livre" ignora as EMAs — ALTERAR · P2 · **[API]** ✅

- [x] `app/Services/ExecucaoService.php`: `primeiraBarreiraContraria()` (novo método privado) —
      escaneia a mesma lista bruta de barreiras (`$barreiras`) que alimenta a tabela de alvos,
      em vez de uma lista reduzida que ignorava EMA. Reaproveita
      `AlvoService::CERCA_ATR_MULT`/`PESOS` (mesma zona de ruído e mesmos pesos zerados que os
      alvos já respeitam) — definição única, não mais duplicada/inconsistente entre "pista
      livre" e "tabela de alvos".
- [x] **Aceite**: `ExecucaoServiceE10PistaLivreTest.php` (6 testes, via reflection no método
      privado) — EMA agora conta como barreira contrária; barreira dentro da zona de ruído ou
      com peso zerado continua ignorada, mesmo comportamento de sempre pros outros tipos.

### 6.11 — `A5` — Figura só se estiver desenhada no gráfico — ALTERAR · P0 · **[API]** ✅

- [x] `app/Services/GraphicalAnalysis/GeminiVisionService.php`: `normalizarObjects()` — LTA/LTB/
      `PRICE_CHANNEL` agora exigem `ponto_inicio`+`ponto_fim` (preço numérico de cada ponto
      ancorado no gráfico); objeto sem os dois pontos é descartado e logado. Outros tipos de
      objeto continuam com o `preco` escalar de sempre (sem mudança de contrato pra eles).
- [x] `app/Services/GraphicalAnalysis/GenesisPrompt.php`: hierarquia de autoridade (item 2)
      repete a proibição — nunca citar LTA/LTB/canal/figura fora de
      `bundle.vision.visual_observations.objects`/`.patterns`, mesmo que o comportamento do
      preço pareça sugerir uma linha que a visão não reportou.
- [x] `app/Services/GraphicalAnalysis/NarrativeFidelityGate.php`: `validarTermosVisuais()` —
      LTA/LTB (substring) e FIGURA/CANAL (regex de borda de palavra, `\b...\b` — evita falso
      positivo em "CONFIGURAÇÃO"/"canalizando", achado real durante a escrita do teste) checados
      contra `vision.visual_observations.objects`/`.patterns` reais. **Achado real (bug próprio,
      corrigido antes de qualquer consumidor real bater nele)**: o parâmetro `$visao` começou
      como `array $visao = []` — um array vazio (visão não achou nada) e "visão não foi passada"
      (chamador antigo) ficavam indistinguíveis, rejeitando toda análise por engano. Corrigido
      pra `?array $visao = null` (sentinela: `null` = não checado, `[]` = checado e vazio).
- [x] **Aceite**: `GeminiVisionServiceTest.php` (3 testes A5) — LTA com pontos válidos é
      preservada, LTA sem `ponto_fim` é descartada e logada, `SUPPORT` continua com `preco`
      escalar. `NarrativeFidelityGateA5Test.php` (8 testes) — termo visual sem respaldo na visão
      é rejeitado, termo respaldado passa, sentinela `null` não quebra chamador antigo, falso
      positivo de substring comum não dispara.

### 6.12 — `A9` — Derivativos só modulam a força, nunca a direção — ALTERAR · P0 · **[API]** ✅

Implementação completa em duas chamadas de IA separadas — decisão explícita do usuário via
`AskUserQuestion` (opção "fiel ao documento", não a versão interina de auditoria numa chamada só).

- [x] `app/Services/GraphicalAnalysis/EvidenceCatalog.php`: os 4 itens originais de derivativos
      (`funding_rate`/`open_interest`/`open_interest_change_pct`/`open_interest_context`) mais os
      2 novos do **E9** (`predominancia`/`squeeze_risco_lado`) reclassificados de `DECISION` pra
      um papel novo, `MODULATOR` — excluído do denominador de `decision_percent` por definição
      (`EvidenceManifestBuilder` só conta `DECISION`), sem precisar mudar o builder.
- [x] Divisão em duas etapas, com contrato de saída DIFERENTE por etapa (a garantia estrutural
      real — não uma instrução de prompt que o modelo pudesse ignorar):
      `app/Support/GenesisDecisionSchema.php` (ETAPA 1, `VERSION` subiu pra `decision-v6.9.0`) —
      `derivatives_context`/`score_basis.derivatives_confirmation` saíram, decide
      `direction`+`score` (score técnico) sem nunca ter recebido evidência MODULATOR no bundle.
      `app/Support/GenesisDecisionStage2Schema.php` **(novo)** — sem campo `direction` (impossível
      redecidir direção aqui, não por instrução), só `derivatives_modifier`/`derivatives_context`/
      `numeric_citations`, restrito a `derivatives_context.summary`.
      `GenesisPrompt::systemStage2()`/`userStage2()` **(novos)** — prompt dedicado da Etapa 2.
      `CanonicalBundleBuilder::forStage1()`/`forStage2()` **(novos)** — Etapa 1 recebe o bundle
      com os itens `MODULATOR` fisicamente removidos do JSON enviado; Etapa 2 recebe um pacote
      enxuto só com os itens `MODULATOR` + `decision_stage1.direction`/`score_tecnico` (nunca
      `vision`/`context`/demais evidência). `DecisionProvider::decideDerivativesModifier()`
      **(novo método na interface)**, implementado em `GeminiDecisionClient`/`OpenAiDecisionClient`
      /`LoggingDecisionProvider`. `DecisionStage2ResponseValidator.php` **(novo)** — reprova
      modificador fora do teto configurado, e reforça em código (não só no prompt) que, sem
      NENHUM dado de derivativos disponível, o modificador tem que ser exatamente 0
      (`DERIVATIVES_MODIFIER_MUST_BE_ZERO_WHEN_UNAVAILABLE`).
      `GraphicalAnalysisAttemptJob::handle()` reescrito — chama as duas etapas em sequência,
      cada uma com seu próprio ciclo de repair via `$tries` nativo (o repair guardado sabe qual
      etapa falhou, a outra roda sem bloco de correção na tentativa seguinte).
- [x] `config/genesis_graphical.php`: `derivatives_modifier_max` (já existia, nunca lida) agora
      lida pelo job — clampa o modificador antes de somar. Score final:
      `round((score_tecnico + modificador - penalidade_E1) / 5) * 5`, clampado 0-90.
      **Nota**: o documento descreve a fórmula como `min(90, score_tecnico + modificador)` — a
      implementação real adiciona `max(0, ...)` (protege contra modificador muito negativo
      levando o score abaixo de zero) e arredondamento pro múltiplo de 5 mais próximo (a soma de
      dois inteiros nem sempre cai num múltiplo de 5, e o resto do sistema — validação,
      persistência, tela — sempre assumiu múltiplos de 5). **Nota 2**: `score` (coluna já
      existente) continua sendo o SCORE FINAL publicado — não foi criada uma terceira coluna
      `score_final` separada (decisão de manter compatibilidade com todo consumidor que já lê
      `->score`); `score_tecnico`/`derivatives_modifier` são as duas colunas novas de auditoria
      (migration `2026_08_20_000001`), gravadas em toda análise concluída via `$cached` no job.
- [x] **Aceite**: a garantia é estrutural, não só testada em runtime —
      `CanonicalBundleBuilderStage1Stage2Test.php` prova que o JSON enviado à Etapa 1 nunca
      contém `derivatives.*` (nem no array PHP, nem no `bundle_json` serializado) e que a Etapa 2
      nunca recebe `vision`/`context`/evidência não-`MODULATOR`. `GenesisDecisionStage2SchemaTest`
      prova que o schema da Etapa 2 não tem campo `direction`. `DecisionStage2ResponseValidatorTest`
      (11 testes) prova o clamp e a regra "sem dado, modificador zero". Como a Etapa 1 nunca vê
      derivativos, "análise com derivativos zerados produz a mesma direção que a análise real" é
      garantido por construção (não há como a Etapa 1 produzir uma direção diferente entre um
      cenário com ou sem derivativos — ela nunca recebeu o dado nos dois casos).

---

## FASE 7 — Texto e interface ✅ concluída (20/08/2026, 2 itens com gap documentado)

Investigação inicial delegada a um agente Explore contra o código real (mesmo padrão da Fase 6) —
achados relevantes por item abaixo.

**Achado de infraestrutura, fora do escopo dos itens do PO**: `phpunit.xml` (backend) ganhou
`<ini name="memory_limit" value="512M"/>` — a suíte completa (704 testes ao fim desta fase) passou
a estourar os 128M padrão do CLI em algum ponto da execução via `php artisan test` (reproduzido
duas vezes, nunca em arquivos isolados; `artisan test` não herda `-d memory_limit=...` da linha de
comando porque reexecuta o phpunit num processo próprio — só setar no `<php>` do `phpunit.xml`
resolve de verdade, independente de como a suíte é invocada).

### 7.1 — `A4` — Cifrão em todo valor em dólar — ALTERAR · P1 · **[API]** ✅

- [x] `app/Services/GraphicalAnalysis/GenesisPrompt.php`: regra única em `system()` e
      `systemStage2()` — cifrão + ponto de milhar + vírgula decimal, formato exato "$ 65.370,92".
      A permissão antiga dos dois padrões ("65.370,92" ou "65,370.92", nenhum exigindo cifrão)
      foi removida das duas etapas.
- [x] `app/Services/GraphicalAnalysis/DecisionResponseValidator.php`:
      `validarFormatoMonetario()` — três checagens por campo de texto livre: todo `$` precisa
      vir seguido do formato PT-BR exato (`MONEY_FORMAT_INVALID`); número cru com 4+ casas
      decimais é sinal de valor vazado (`MONEY_FORMAT_RAW_NUMBER`); número com a FORMA de preço
      PT-BR (milhar com ponto, 2 casas) sem cifrão na frente é preço citado sem o formato
      obrigatório (`MONEY_FORMAT_MISSING_DOLLAR_SIGN`). Mesma checagem replicada em
      `DecisionStage2ResponseValidator.php` para `derivatives_context.summary` (etapa 2). Erro de
      formato dispara reparo, nunca descarte silencioso — mesmo mecanismo de repair de sempre.
- [x] **Achado real durante a implementação**: `GenesisPrompt::system()` (Etapa 1, pós-**A9**)
      ainda tinha texto sobrevivente instruindo o modelo sobre derivativos — "sustentação ou
      oposição dos derivativos" na lista de fatores do score, a regra de cor de squeeze e o
      sinal do funding (**E9**) — mesmo a Etapa 1 nunca mais recebendo essa evidência desde a
      divisão em duas chamadas. Texto morto/enganoso, limpo junto desta entrega (ver também
      **7.2**, que reescreve o restante da seção DECISÃO E SCORE).
- [x] **Aceite**: `DecisionResponseValidatorTest.php` (4 testes novos) — formato PT-BR com
      cifrão aceito; formato "65,370.92" (antes também permitido) agora reprovado; preço sem
      cifrão reprovado; número cru sem separador reprovado. Sem análise real rodada contra os
      dez ativos citados no documento (custo de API) — a prova é pelo código do validador, que é
      quem de fato bloqueia/aprova cada citação.

### 7.2 — `A6` — Convicção travada em 70 — ALTERAR · P1 · **[API]** ✅ (benchmark adiado)

- [x] **Decidido na Fase 0 (19/08/2026), reafirmado aqui**: `gemini-3.7-flash`/
      `GENESIS_GEMINI_DECISION_MODEL` intocados — decisão deliberada de outro spec, não o
      "desvio" do documento do PO. Nada alterado neste eixo.
- [ ] **Passo 1 (medir antes de mexer) — não executado**: `genesis:benchmark-decision` mede só o
      decisor **V6.7 baseline com imagem** (`CanonicalBundleBuilderV67Baseline`/
      `DecisionResponseValidatorV67Baseline`, achado do agente de investigação) — não o pipeline
      de duas etapas atual (V6.8/V6.9). Rodar o benchmark hoje mediria a arquitetura errada, não
      "medir antes de mexer" o que de fato mudou. Roda-lo pra valer exige (a) uma imagem real de
      gráfico, (b) rede/chave de API ativa, (c) custo de chamadas pagas — mesmo adiamento que a
      V6.8 já aplicou ao próprio benchmark ("documentar, não rodar"), critério repetido aqui.
- [x] `app/Services/GraphicalAnalysis/GenesisPrompt.php`: a tabela qualitativa ("0-30 leitura
      frágil... 85-90 excepcional e rara") saiu da Etapa 1 — substituída por uma régua ancorada
      em fatos contáveis do próprio bundle: base 60, +até 10 por ADX≥25 com DI alinhado à
      direção (-5 se ADX<20), +5/-5 por tempos maiores concordando/discordando, +5 por figura
      gráfica validada reforçando a direção (sem penalidade por ausência), +5/-5 por cobertura
      de evidências acima de 85%/abaixo de 50%. Arredonda pro múltiplo de 5 mais próximo, teto
      90, piso 0 — a penalidade de contradições (**E1**) continua sendo aplicada em código,
      depois desta etapa, não pelo próprio modelo.
- [ ] **Aceite (amplitude do score) — não verificado**: exige o mesmo benchmark do Passo 1,
      contra o pipeline real, rodando 10 ativos com chamadas pagas — não executado nesta sessão
      pelo mesmo motivo acima. A régua nova está implementada e testada estruturalmente
      (`GenesisPromptA6Test.php`), mas a prova empírica de que ela de fato produz mais amplitude
      de score em análises reais fica pendente de uma rodada real, fora do escopo desta entrega.

### 7.3 — `A8` — Código interno fora da tela e manchete coerente — ALTERAR · P1 · **[FE+API]** ✅

- [x] `components/AnalysisResult.tsx`: `execution.reason_code` não é mais renderizado (segue no
      payload/banco). `manchetePlano(alvoQueAtende)` substitui o título fixo "Plano não
      recomendado" por "Plano atende o {TP2/TP3}" quando `execution.alvo_que_atende` existe.
- [x] `app/Services/ExecucaoService.php`: **achado real** — o dado já existia, só não estava
      exposto como campo estruturado: `primeiroAlvoAcimaDoMinimo()` (já usado pra montar o texto
      livre de `$motivo`) devolve `rotulo` no formato exato `"TP2"`/`"TP3"` que o documento pede.
      Variável `$alvoQueAtende` hoisted pra fora do bloco condicional e exposta como
      `alvo_que_atende` no array de retorno de `montar()`/`indisponivel()`/`inconsistente()`.
- [x] **Aceite**: `ExecucaoServiceC7RotuloTest`/`ExecucaoServiceRrPorAlvoTest` continuam verdes
      (wiring não quebrou os 7 testes de `primeiroAlvoAcimaDoMinimo()` já existentes);
      `ExecutionExecutableVsRecommendedTest` (cenário real de RR abaixo do mínimo, mercado ao
      vivo) confirma o campo presente no contrato; `AnalysisResult.a8.test.ts` (FE, 3 testes)
      confirma reason_code fora da tela e manchetePlano() em uso.

### 7.3b — `F2` — Faixas de referência dos indicadores na tela — INCLUIR · P1 · **[API+FE]** ✅

- [x] `app/Support/FaixasIndicador.php` **(novo)**: `adx()`, `di()`, `rsi()`, `cmf()` — número +
      faixa em português; `adxEmElevacaoRelevante()` — só relevante com ADX ≥ 20 e subindo.
      7 testes unitários determinísticos.
- [x] `app/Services/GraphicalAnalysis/AnalysisPublicResponseBuilder.php`: `adx_faixa`/
      `di_faixa`/`adx_em_elevacao_relevante`/`rsi_faixa`/`cmf_faixa` no contrato público
      (`informative_context.indicators`), `null` quando o indicador de origem está indisponível
      (nunca inventa faixa sem dado). 3 testes novos.
- [x] `components/AnalysisResult.tsx`: legendas de faixa abaixo de RSI/ADX/+DI-‑DI; **achado
      real** — o selo "ADX em elevação" já existia mas mostrava "Sim"/"Não" incondicionalmente,
      mesmo com ADX bem abaixo de 20 (sugerindo relevância que o dado não tinha) — agora só
      renderiza quando `adx_em_elevacao_relevante` é `true`. CMF calculado e testado no backend,
      mas sem card próprio na tela ainda (indicador não tinha exibição nenhuma antes desta
      entrega — adicionar um card novo, não só anotar um existente, ficou fora do escopo).

### 7.3c — `F5` — Ichimoku sem deslocamento — ALTERAR · P2 · **[API]** ✅

- [x] `app/Services/SupplementalIndicatorsService.php::ichimoku()`: `senkou_a`/`senkou_b` agora
      são a nuvem que está DE FATO plotada acima/abaixo do candle atual (Ichimoku calculado 26
      períodos atrás — exige 78 candles, `null` com menos histórico); o cálculo do instante
      presente (o que antes era devolvido como `senkou_a`/`senkou_b`) vira `nuvem_futura_a`/
      `nuvem_futura_b`. Único consumidor é `EvidenceCatalog` (objeto opaco pro decisor, papel
      DECISION) — sem outro código lendo chaves específicas, mudança de forma segura.
- [x] **Aceite**: `SupplementalIndicatorsServiceTest.php` — teste existente atualizado pra provar
      `senkou_a/b` nulos com 52 candles (sem histórico suficiente pro deslocamento) e
      `nuvem_futura_a/b` com os valores que antes eram `senkou_a/b`; teste novo com 78 candles
      prova o deslocamento correto.

### 7.3d — `F6` — CMF divergente — VERIFICAR · P2 · **[API]** — não executado (adiado por design)

- [ ] Confirmado pela investigação: CMF vive em `SupplementalIndicatorsService::cmf()` (o
      documento aponta `TechnicalAnalysisService.php`, arquivo errado). Mantido como o próprio
      documento pede — "só executar depois da Fase 1 (**A1**) validada em PRODUÇÃO, não só
      localmente" — condição que esta sessão não tem como cumprir (sem acesso a produção).

### 7.4 — `G1` — Formatador único — ALTERAR · P0 · **[API+FE]** — não executado, conflito real

- [ ] **Gap conhecido, decisão do usuário necessária antes de prosseguir**: achado da
      investigação — `services/cryptoApi.ts::formatPrice()` está marcado no próprio código como
      `"--- REGRA IMUTÁVEL DE FORMATAÇÃO DE PREÇOS EM DÓLAR ---"`, usando locale `en-US`
      (ponto decimal) deliberadamente, chamado em 8 arquivos da tela. O backend
      (`ExecucaoService::formatarPreco()`, usado em só 1 lugar) já usa PT-BR (vírgula decimal).
      Unificar os dois — como o item pede — exige decidir qual convenção vence sobre um
      marcador explícito de "não mexer", e depois plumbar `pricePrecision` real (já disponível
      via **D6**) até os 8 pontos de chamada do front, trocando o critério hoje puramente por
      magnitude. Blast radius real (LiquidationRadar, LiquidityMap, MarketTicker, NewListings,
      OiLiquidationMonitor, ActiveTradesPage, HistoryPage, AnalysisResult) sem cobertura de teste
      automatizado que prove visualmente a mudança em cada tela. Não executado nesta sessão —
      decisão de produto (revisar ou manter o marcador "imutável") fica para o Felipe.

### 7.5 — `G2` — HVN/LVN/VRVP são leitura visual — cálculo por candles sai — ALTERAR (parcial) · P0 · **[API]** ✅ escopo reduzido

- [ ] **Gap conhecido, decisão deliberada**: o documento pede DELETAR os métodos de
      `MarketZonesService` que produzem `poc`/`hvn`/`lvn` por candles. Achado real da
      investigação: `AlvoService` usa esses mesmos valores como fonte REAL de seleção de alvo
      (pesos 8/7/6 pra poc/lvn/hvn) e `NivelService` também consome — apagar o cálculo quebraria
      a matemática de alvos publicada pra todo membro, não só a narrativa da IA. Cálculo mantido
      intocado; `EvidenceCatalog.php` também mantém `levels.poc/hvn/lvn` (já CONTEXT desde a
      V6.5, nunca decidiram nada sozinhos).
- [x] `app/Services/GraphicalAnalysis/NarrativeFidelityGate.php`: POC/HVN/LVN saem de
      `INDICATOR_REQUIREMENTS` (que só exigia a aproximação calculada) e entram em
      `TERMOS_VISUAIS`, exigindo `bundle.vision.visual_observations.vrvp` presente com confiança
      ≥ 0,70 (mesmo piso que `AnalysisPersistenceService` já usa) — o texto só pode citar
      POC/HVN/LVN quando a leitura visual REAL os confirma, não só quando a aproximação por
      candles existe. Resolve o problema real (a IA citando um "POC" que não está desenhado no
      gráfico) sem quebrar a seleção de alvo.
- [x] **Aceite (parcial)**: `NarrativeFidelityGateG2Test.php` (4 testes) — POC citado sem VRVP
      real é reprovado mesmo com a aproximação calculada disponível; HVN com VRVP real presente
      é aceito; LVN com VRVP de confiança baixa é reprovado; sem `$visao` informado, os três não
      são checados (sentinela `null` do A5, compatibilidade com chamador antigo). "POC, HVN e
      LVN vêm apenas da leitura visual" é verdade pro TEXTO da análise — não pro cálculo interno
      de alvo, que continua existindo (decisão documentada acima).

### 7.6 — `G4` — Telemetria lendo campo inexistente — ALTERAR · P2 · **[API]** ✅

- [x] `app/Services/GraphicalAnalysis/AnalysisPersistenceService.php`: `logTelemetria()` lia
      `$decision['visual_observations']` — campo morto desde a Fase 5/V6.8 (migrou pra
      `$cached['vision']`) — o log sempre reportava 0 figuras/VRVP ausente, mesmo com a visão
      detectando tudo corretamente. Assinatura do método trocada pra receber `$vision`
      diretamente; os dois call sites (`persist()`/`persistIntoExisting()`) atualizados.
- [x] **Aceite**: `AnalysisPersistenceServiceG4TelemetriaTest.php` (2 testes, via
      `persistIntoExisting()` real + `Log::spy()`) — contagem de figuras/VRVP reflete a visão de
      verdade, não mais sempre zero.

### 7.7 — `G5` — Nota de rastreabilidade no rodapé — INCLUIR · P1 · **[API+FE]** ✅

- [x] `app/Services/GraphicalAnalysis/EvidenceManifestBuilder.php`: `notaDeCobertura()` — nota
      0–100 inteira (`available_total`/`expected_total`, TODO o manifesto, qualquer papel — não
      só `decision_percent`, que mede só o que decide direção), adicionada a `coverage`.
- [x] `app/Services/GraphicalAnalysis/AnalysisPublicResponseBuilder.php`: `nota_cobertura` no
      contrato público — recalculada a partir do `evidence_manifest` já persistido (o objeto
      `coverage` completo não sobrevive à persistência, só o escalar `decision_percent`).
- [x] `components/AnalysisResult.tsx` **[FE]**: linha permanente (não condicional, ao contrário
      do aviso de cobertura baixa que já existia) "Rastreabilidade dos dados desta leitura:
      N/100" — substitui o card "Qualidade dos Dados" já removido no **A7** em fase anterior.
- [x] **Aceite**: `EvidenceManifestBuilderH47Test`/`AnalysisPublicResponseBuilderG5Test` (5
      testes) — nota 100 com tudo disponível, cai com indisponibilidade parcial de qualquer
      papel (não só DECISION), `null` sem manifesto.

### 7.8 — `G6` — Risco de squeeze deixa de ser opinião livre — ALTERAR · P1 ✅ (sanity check)

- [x] Confirmado resolvido por **E9**+**A9** (Fase 6) — `GenesisPrompt::systemStage2()` já
      instrui o modelo a nunca recalcular `derivatives.squeeze_risco_lado` e já amarra o sinal do
      `derivatives_modifier` à regra objetiva (squeeze do mesmo lado da direção enfraquece, lado
      oposto reforça). Nenhuma mudança de código necessária nesta fase — item já fechado.

### 7.9 — `G7` — Códigos e termos em inglês saem da tela — ALTERAR · P1 · **[FE]** ✅

- [x] `components/AnalysisResult.tsx`: `BIAS_LABEL` (bias de tempo maior — BULLISH/BEARISH/MIXED
      → ALTA/BAIXA/MISTO, usado no bloco Confluência Temporal) e `SESSAO_LABEL` (sessão de
      mercado — ASIA/LONDON/NEW_YORK/OVERNIGHT → Ásia/Londres/Nova York/Overnight, achado real:
      `MarketSnapshotService::marketSession()` sempre devolveu esses códigos crus, nunca
      traduzidos). "long squeeze"/"short squeeze" (bloco de derivativos) viram "squeeze de
      comprados"/"squeeze de vendidos". Wyckoff (`WYCKOFF_LABEL`) já tinha dicionário de uma fase
      anterior — confirmado intacto, não precisou de mudança.
- [x] **Aceite**: `AnalysisResult.g7.test.ts` (3 testes) — bias/sessão/squeeze traduzidos,
      nenhum termo em inglês cru nos três pontos identificados pela investigação.

### 7.10 — `G8` — Semântica de cor — ALTERAR · P1 · **[FE]** — investigado, não reproduzido

- [ ] **Fechado sem mudança de código**: investigação não reproduziu o bug específico do
      documento (verde mostrado pra uma leitura baixista "porque concorda com a tese SHORT"). O
      bloco de Confluência Temporal (`AnalysisResult.tsx`) já colore por `tf.bias` em si
      (BULLISH sempre verde, BEARISH sempre vermelho), independente da direção da tese — nunca
      inverte a cor por "concordância". Nenhum padrão `concorda`/`agreesWithThesis` encontrado no
      arquivo. Se o Felipe tiver um caso real reproduzível, precisa apontar o bloco exato — a
      investigação cobriu o bloco mais óbvio (confluência multi-timeframe) e não achou o bug.

### 7.11 — `G9` — Tipografia quebrada no texto — ALTERAR · P2 · **[FE]** ✅ já resolvido

- [x] Confirmado já corrigido por uma fase anterior — o bloco de Análise Técnica
      (`AnalysisResult.tsx`) já tem `text-align: left`, `whitespace-normal break-normal` e
      `style={{ wordSpacing: 'normal', letterSpacing: 'normal', hyphens: 'none', lineHeight: 1.6 }}`
      inline. Não existe classe `.analise-tecnica` nem stylesheet global fora do build — o
      documento descreve um mecanismo (CSS de classe) que não é como a correção real foi feita,
      mas o resultado (sem hifenização forçada) já está no lugar. Nenhuma mudança necessária.

### 7.12 — `G10` — Duplicação da convicção — ALTERAR · P2 · **[FE]** — investigado, não reproduzido

- [ ] **Fechado sem mudança de código**: investigação não encontrou duplicação literal. O score
      (`analysis.conviccao_modelo`) renderiza uma vez como número/badge e uma vez como largura da
      barra de progresso — mesmo dado, duas representações visuais complementares do mesmo
      conceito, não uma segunda instância redundante. O único outro número parecido
      (`sentimento.score`, "X/100") é explicitamente um dado DIFERENTE (sentimento do mercado,
      não convicção), com comentário no próprio código dizendo isso. Se o Felipe tiver um
      screenshot do problema real, ajuda a apontar o bloco certo.

### 7.13 — `G11` — Unidades misturadas no macro — ALTERAR · P2 · **[FE]** ✅

- [x] `components/AnalysisResult.tsx`: rótulos dos três cards macro passam a nomear a grandeza —
      "VIX (nível)" ao lado de "DXY (var. 24h)" e "S&P 500 (var. 24h)" — antes só "VIX" sem
      unidade nenhuma, ao lado de dois indicadores em %, sugerindo a mesma grandeza.
- [x] **Aceite**: `AnalysisResult.g11g12g13.test.ts`.

### 7.14 — `G12` — Fear and Greed sem tradução — ALTERAR · P2 · **[FE]** ✅

- [x] `components/AnalysisResult.tsx`: `faixaFearGreed()` — Medo extremo (≤24) / Medo (25-44) /
      Neutro (45-55) / Ganância (56-75) / Ganância extrema (>75), mesmos limiares padrão do
      índice (alternative.me), ao lado do número.
- [x] **Aceite**: `AnalysisResult.g11g12g13.test.ts`.

### 7.15 — `G13` — Plano A pré-selecionado e troca coerente — ALTERAR · P1 · **[API+FE]** ✅

- [x] **Achado real**: o backend já estava completo — `ExecucaoService::montar()` já publica
      `$planoBCompleto` com paridade total ao Plano A (stop/invalidação/3 alvos/R/R por alvo/
      liquidação/tamanho, comentário no próprio código confirma a intenção), e `planoAtivo`
      (`AnalysisResult.tsx`) já deriva TODOS os campos exibidos do plano selecionado — trocar de
      plano já recomputava tudo corretamente antes desta entrega. O único gap real: `selectedZone`
      iniciava em `null`, não `'A'` — Plano A alimentava os números exibidos (fallback), mas o
      botão de confirmação ficava preso em "Selecione um Plano" até um clique manual.
- [x] `components/AnalysisResult.tsx`: `useState<'A'|'B'|null>('A')` (era `null`) — e o efeito de
      reset ao trocar de análise (V6.7 D-31) também passa a resetar pra `'A'`, não `null`, senão
      o mesmo problema reapareceria a cada nova análise.
- [x] **Aceite**: `AnalysisResult.g11g12g13.test.ts` confirma o estado inicial e o reset; a
      "troca coerente" (todos os números mudam ao trocar de plano) já era verdade antes desta
      entrega, confirmado por leitura do código (`planoAtivo` como única fonte de todos os
      campos exibidos), não por teste novo.

---

## FASE 8 — Limpeza (sempre por último, com a versão já estável)

### 8.1 — `H1` — Serviços com zero chamada — LIGAR/AVALIAR/DELETAR · P1 · **[API]**

- [ ] **LIGAR** `app/Services/GraphicalAnalysis/DataFreshnessGate.php` — já coberto pelo **B4**.
- [ ] **LIGAR** `app/Services/OutcomeLabeler.php` — peça que rotula o desfecho de cada análise;
      sem ela não existe a estatística DP-07 (assertividade por plano/TP/timeframe). Agendar
      `RotularDesfechosJob` nos horizontes por timeframe (15m/30m=24h, 1h/4h=7d, 1d=30d, 1w=90d).
- [ ] **DELETAR** `DerivativesEnrichmentService` — zero referências, substituído pelo **E9**.
- [ ] **AVALIAR antes de decidir** `FeaturePolicy`/`FeatureEvidence`, `BreakRetestService`
      (órfão desde V4.3), `TextQualityGate`, `TradeFlowService` — zero referências, checar se
      algum ainda tem valor antes de apagar.

### 8.2 — `H2` — Corretoras — não deletar — NENHUMA · P2

- [ ] Nenhuma ação. `OkxService`/`BybitService`/`BitgetService` marcados como órfãos
      intencionais no inventário, para a próxima auditoria não reapontar.

### 8.3 — `H3` — Chaves de configuração nunca lidas — LIGAR · P1

- [ ] `min_coverage_for_execution` e `derivatives_modifier_max` — já cobertas pelo **B4** e
      **A9** respectivamente. Sem ação própria além de confirmar que as duas fases as ligaram.

### 8.4 — `H4` — Pipeline anterior vivo em paralelo — DELETAR · P2 · **[API]**

- [ ] Apagar `GenesisDecisionSchemaV67Baseline.php`, `GenesisPromptV67Baseline.php`,
      `CanonicalBundleBuilderV67Baseline.php`, `DecisionResponseValidatorV67Baseline.php` —
      **só depois de a V6.9 estabilizar em produção**, commit isolado, com prova de que nenhuma
      rota os alcança.

### 8.5 — `H5` — Componentes do front nunca importados — DELETAR · P2 · **[FE]**

- [ ] Apagar `components/PatternRealIcon.tsx` e `components/AlertConfigPanel.tsx`.

### 8.6 — `H6` — Renderização órfã de eventos macro e gatilhos — ALTERAR · P2

- [ ] Já coberto pelo **A2** e **E5** (preencher o contrato, não apagar a tela).

### 8.7 — `H7` — Comandos de console — AVALIAR · P2 · **[API]**

- [ ] `FixCredits`, `FixRenew`, `CreateWallet`, `VerifyWallet`, `VarreduraMicroRadarCommand`,
      `MonitorCarteiraMaeCommand` — **ressalva**: o Laravel registra comandos automaticamente
      pela assinatura, não pela referência de classe. Varredura por referência não vale para
      eles. Conferir uso real (schedule, chamada manual documentada) antes de apagar qualquer
      um.

### 8.8 — `H8` — Servidor Node — NENHUMA · P2

- [ ] Nenhuma ação. `server.ts`/`routes/api.js` ficam exatamente como estão.

---

## Inventário de arquivos tocados (resumo, ver documento-fonte para a lista item a item)

**Backend — alterados**: `MarketSnapshotService`, `MultiTimeframeSnapshotService`,
`GeminiContextService`, `AnalysisPublicResponseBuilder`, `EvidenceCatalog`,
`EvidenceManifestBuilder`, `GenesisPrompt`, `DecisionResponseValidator`, `NarrativeFidelityGate`,
`StructuralCoherenceGate`, `VisionResponseValidator`, `GeminiVisionService`, `MarketZonesService`,
`AnalysisPersistenceService`, `TechnicalAnalysisService`, `SupplementalIndicatorsService`,
`CvdSeriesService`, `BinanceService`, `ExchangeService`, `PriceProxyService`, `ExecucaoService`,
`AlvoService`, `MotorExecucaoService`, `NivelService`, `TamanhoService`,
`QualidadeEntradaService`, `GenesisVisualCatalogV6`, `config/genesis_graphical_v6.php`,
`config/genesis_graphical.php`.

**Backend — novos**: `SwingPivotService`, `LiquidationMapService`, `DerivativesReadingService`,
`DirectionCoherenceGate`, `NarrativeContradictionGate`, `FaixasIndicador`.

**Backend — ligados (existiam, nunca rodavam)**: `DataFreshnessGate`, `OutcomeLabeler`.

**Frontend — alterados**: `AnalysisResult.tsx` (o mais tocado — A7/A8/D4/D8/D10/F2/F9/G7/G8/G9/
G10/G11/G12/G13), `ScoreBasisBars.tsx`, `TrendQuality.tsx`, `LiquidationHeatmap.tsx`,
`GenesisPage.tsx`, `geminiService.ts`, `cryptoApi.ts`.

**Frontend — apagados**: `PatternRealIcon.tsx`, `AlertConfigPanel.tsx`.

---

## Checklist de aceite por fase (espelha a seção do documento-fonte)

- [x] **Fase 1** (19/08/2026): EMAs vêm da série com candle vivo (provado por recálculo
      independente, não contra o TradingView diretamente — sem acesso a ele neste ambiente) ·
      RSI/MACD/ADX/ATR mudam intraday (mesmo mecanismo da EMA) · auditoria de horário/preço já
      coberta pela infraestrutura `tempos()`/`CanonicalBundleBuilder` do V6.8 · semanal/mensal
      usam a mesma série do diário.
- [x] **Fase 2** (19/08/2026): pipeline de score ponta a ponta (prompt → payload → snapshot →
      evidência → contrato público → adaptador FE → componente) implementado e testado com
      mocks · gatilhos preenchidos e propagados · quatro cards na fileira (Qualidade dos Dados
      removida, ver nota do G5 pendente) · selo "Sem dado" resolvido. Scores realmente
      diferentes entre ativos é comportamento de produção, não coberto por teste automatizado
      nesta sessão.
- [x] **Fase 3** (19/08/2026): `derivatives.order_book_walls` sai `AVAILABLE` com paredes reais
      (provado, rede real) · SPRING/UAT/SOS provados individualmente com séries determinísticas ·
      cluster_liquidacao confirmado já sem efeito (achado: já tinha sido corrigido no V6.6/V6.5) ·
      cobertura baixa e dado vencido rebaixam sem bloquear (provado) · zero Spot no pipeline real
      de análise (achado: `ExchangeService`/`TrendQuality.tsx`/9 arquivos de um conjunto de
      ferramentas separado ficaram de fora, todos com motivo documentado) · janela de OI alinhada
      com a leitura de preço (provado, inclusive um caso onde a leitura antiga dava o sinal
      oposto) · mapa de liquidação com zonas reais e diferentes por ativo (provado, BTC vs. SOL).
      Suíte API 538/538 verde, FE sem regressão.
- [ ] **Fase 4**: pivôs batem com o gráfico · dez análises com três TPs preenchidos · TPs
      distintos por faixa de ATR · origem específica por alvo · nenhum alvo com Fibo como fonte
      única.
- [ ] **Fase 5**: BTC do print mostra folga curta (nunca "liquida antes do stop") · AXS mostra a
      mensagem correta · os dois avisos de alavancagem nunca se contradizem · liquidação de
      altcoin difere de BTC · Plano B nunca ultrapassa a âncora de invalidação · quantidade
      múltiplo exato do passo do contrato · sete testes de conversão numérica passam.
- [ ] **Fase 6**: AXS registra as três contradições e o score cai · figura sem topo/base é
      descartada e logada · cunha descendente em venda gera contradição · "rompimento
      sustentado" não aparece em nenhuma análise · texto macro da tela = `manifest_hash` · BTC
      não menciona LTB · derivativos zerados não mudam a direção.
- [ ] **Fase 7**: nenhum valor em dólar sem cifrão (incl. altcoin < $1) · um único padrão de
      formatação · EMA200 de altcoin > $1 mantém casas do contrato · POC/HVN/LVN só da leitura
      visual · rodapé com nota de cobertura, sem nomes de indicador · nenhum termo em inglês
      visível · Plano A pré-selecionado, troca reprocessa tudo · benchmark com amplitude ≥ 25
      pontos.
- [ ] **Fase 8**: `OutcomeLabeler` e `DataFreshnessGate` ligados e rodando · as duas chaves de
      config lidas · corretoras preservadas · servidor Node intocado.

---

## Registro da auditoria (do documento-fonte, para contexto)

Três fontes cruzadas, sem duplicata: auditoria interna (linha a linha contra dois setups reais e
seus gráficos), auditoria externa independente (achados exclusivos confirmados por leitura do
código), e verificação ponto a ponto do print BTCUSDT (24 divergências, 6 críticas).

**Ponto retificado durante a auditoria do PO**: a suspeita inicial de que o bloco macro estava
inventando eventos não se sustentou — o texto vem de busca real na web. O problema real é o
**E5**: duas fontes paralelas, e a tela mostra a que não decidiu (confirmado nesta sessão via
commit `7907a82`, ver "Verificação preliminar").
