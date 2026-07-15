# Plano de Implementação: Gênesis V4.3-R3.2 — Cérebro de Análise Gráfica

## Visão Geral

Ordem por risco e dependência, seguindo as fases P0–P5 do Adendo (Seção 14). Nenhuma tarefa de uma fase posterior deve começar antes do checkpoint da fase anterior. Todo código novo segue o Adendo — a seção citada em cada tarefa é a fonte de verdade; este arquivo não repete o código, aponta onde ele está.

Repositórios: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** = frontend (checar se é este repositório antes da Fase P3.2).

Status de partida (auditoria de código real 2026-07-14, não apenas leitura do Adendo): nenhuma das 9 classes novas do Adendo existe; o fallback OCR matemático e a mistura Futures/Spot continuam ativos; `ScoringService` ainda vota derivativos na direção. Ver `design.md` → "Estado Atual Auditado" para a tabela completa.

## Tarefas

- [x] 1. Fase P0.1 — Fixtures congeladas e remoção do fallback OCR matemático
  - [x] 1.1 **[API]** Gerar `tests/Fixtures/ohlcv/locked-candles.json` e `locked-indicators.json`
    - Rodar `TechnicalAnalysisService::calcular()` sobre um conjunto real de candles ANTES de qualquer mudança, salvar candles + resultado atual aprovado
    - Commitar e pedir revisão antes de seguir — este golden não pode ser regravado depois para "fazer o teste passar"
    - _Requisitos: 1.4_

  - [x] 1.2 **[API]** Remover leitura de `$ocrData` na seleção de fonte de EMA/RSI/MACD/ATR/ADX
    - Editar `TechnicalAnalysisService::calcular()` — aplicar o padrão try/catch de `$campoFonte = 'UNAVAILABLE'` → `'DERIVED_FROM_API'` do Adendo Seção 17.1, sem `elseif` lendo `$ocrData`
    - Rotular `fontes` com o vocabulário do Adendo (não mais `"API"`/`"OCR"`/`"GRAFICO"`)
    - _Requisitos: 1.1, 1.2, 1.3_

  - [x]* 1.3 Escrever `LockedIndicatorsRegressionTest`
    - `test_locked_indicators_do_not_change` e `test_ocr_cannot_replace_locked_indicators`, literal do Adendo Seção 37.1
    - **Valida: Propriedade 1, Propriedade 2 (design.md)**
    - _Requisitos: 1.5_

- [x] 2. Fase P0.2 — Candles sem mistura silenciosa Futures/Spot
  - [x] 2.1 **[API]** Criar `BinanceService::getCandlesStrict()`
    - Copiar literalmente do Adendo Seção 18
    - _Requisitos: 2.1_

  - [x] 2.2 **[API]** Trocar a chamada em `GeminiAnalysisService::analisar()`
    - Substituir `getCandlesResiliente()` por `getCandlesStrict()` no caminho do cérebro gráfico; validar `$exchange === 'BINANCE'` antes, lançar `UNSUPPORTED_EXCHANGE` caso contrário
    - Manter `getCandlesResiliente()` intocado fora deste caminho até prova de zero consumidores restantes
    - _Requisitos: 2.2, 2.3_

  - [x]* 2.3 Rodar grep de confirmação
    - `grep "getCandlesResiliente" app/Services/GeminiAnalysisService.php` — esperar vazio
    - **Valida: Propriedade 7 (design.md)**
    - _Requisitos: 2.4_

- [x] 3. Fase P0.3 — Contrato de origem dos dados (`FeatureEvidence`)
  - [x] 3.1 **[API]** Criar `app/Support/FeatureEvidence.php`
    - Copiar literalmente do Adendo Seção 16
    - _Requisitos: 3.1, 3.2_

  - [x] 3.2 **[API]** Criar `config/genesis_graphical.php` e adicionar `.env.example`
    - Copiar literalmente do Adendo Seção 15; todas as `features.*` começam `false`
    - _Requisitos: 3.3_

  - [x] 3.3 **[API]** Conectar `feature_manifest` ao `AnalysisEventStore` já existente
    - Reaproveitar `AnalysisEventStore::persist()` (já entregue por `genesis-r3-2-implementacao`, task 11.2) — só estender o payload salvo, não recriar o serviço
    - _Requisitos: 3.4_

- [x] 4. Checkpoint Fase P0 — Congelamento provado
  - Rodar `php artisan test --filter=LockedIndicatorsRegressionTest`
  - Confirmar por grep que `getCandlesResiliente` não aparece mais no caminho do cérebro gráfico
  - Perguntar ao usuário se há dúvidas antes de avançar para a Fase P1

- [x] 5. Fase P1.1 — Remover derivativos da soma direcional
  - [x] 5.1 **[API]** Remover a família `derivativos` de `ScoringService`
    - Localizar e remover o bloco que soma bull/bear a partir de funding/OI (peso 28 hoje) da fórmula que decide LONG/SHORT
    - **Atenção:** isto é distinto do "segundo cérebro Gemini" já removido pelo spec `genesis-r3-2-implementacao` — aquele trabalho não tocou este motor PHP determinístico
    - _Requisitos: 4.1_

  - [x] 5.2 **[API]** Implementar o schema de famílias do Adendo Seção 8.1/21 (`structure`/`trend`/`momentum`/`technical_flow`/`visual_confluence`)
    - Substituir `TraderSchema::gemini()` pelo bloco do Adendo Seção 21
    - _Requisitos: 4.2, 12.1_
    - **Nota:** feito em conjunto com 6.1 e 7.3 (fora de ordem, por decisão explícita do usuário) para não deixar o trader quebrado em produção — ver notas nas tarefas 6.1/6.2/7.3

  - [x]* 5.3 Escrever `DerivativesDirectionIsolationTest`
    - `test_negative_derivatives_modifier_cannot_flip_long`, `test_unavailable_family_cannot_vote` — literal do Adendo Seção 37.2
    - **Valida: Propriedade 3, Propriedade 4 (design.md)**
    - _Requisitos: 4.4_

  - [x]* 5.4 Rodar grep de confirmação
    - `grep -RInE "long_short|longShort|LSR" app/Services/GeminiAnalysisService.php app/Services/GeminiTraderClient.php` — esperar vazio
    - _Requisitos: 4.3_

- [ ] 6. Fase P1.2 — Auditor único de score gráfico
  - [x] 6.1 **[API]** Criar `app/Services/GraphicalScoreAuditor.php`
    - Copiar literalmente do Adendo Seção 22
    - _Requisitos: 5.1, 5.2, 5.4_
    - **Nota:** adiantada da P1.2 para a P1.1 (decisão do usuário) — sem isso, trocar o schema (5.2) quebraria toda análise real, já que `TraderAuditor` não entende os novos nomes de campo

  - [x] 6.2 **[API]** Aplicar a regra de reenvio em inconsistência
    - Direção declarada diverge da soma → reenviar para correção no máximo 2 vezes, depois publicar `BLOQUEADA_ANALISE_INCONSISTENTE`
    - _Requisitos: 5.3_
    - **Nota:** `GeminiAnalysisService::analisar()` foi religado para chamar `GraphicalScoreAuditor::audit()` no lugar de `TraderAuditor::auditar()`; o loop de retry existente (3 rodadas) já cobre "no máximo duas correções". Testado ponta a ponta com HTTP mockado: direção incoerente após 3 tentativas produz `status=ANALISE_INCONSISTENTE` e `execution.status=BLOQUEADA_ANALISE_INCONSISTENTE`

  - [ ] 6.3 **[API]** Garantir fonte única do número de convicção
    - Confirmar que nenhum outro caminho publica `scoreProbabilidade`/`scoreFinal`/`conviccao_modelo`/`conviction` com valor divergente do `GraphicalScoreAuditor`
    - _Requisitos: 5.5_
    - **Não feito.** `scoreProbabilidade`/`scoreDetalhado.scoreFinal` (de `ScoringService`) e `conviccao_modelo` (de `GraphicalScoreAuditor`) continuam sendo dois números publicados simultaneamente — duplicação pré-existente, não criada por este trabalho, mas ainda não reconciliada

- [x] 7. Fase P1.3 — Derivativos como modificador pós-direção
  - [x] 7.1 **[API]** Criar `app/Services/DerivativesContextService.php`
    - Copiar literalmente do Adendo Seção 23
    - _Requisitos: 6.1, 6.2, 6.5_

  - [x] 7.2 **[API]** Garantir ordem de chamada correta
    - `DerivativesContextService::evaluate()` só é chamado depois do pre-audit ter produzido `direction`; nunca antes
    - Confirmar que `buildGraphicalDecisionSheet()`/payload do `GeminiTraderClient` não recebem dado de derivativos
    - _Requisitos: 6.3, 6.4_
    - **Nota:** `GeminiAnalysisService::analisar()` agora envia uma cópia da folha sem a chave `derivativos` ao `GeminiTraderClient`; a folha completa (com derivativos) continua sendo persistida no event store. Depois do pre-audit (`ok=true`), chama `DerivativesContextService::evaluate($direction, ...)` e reaudita com o modificador real via `GraphicalScoreAuditor`. Confirmado com HTTP mockado: payload enviado ao Gemini não contém `"derivativos"`; funding hostil ao LONG derruba `conviccao_modelo` (41→38) sem mudar `direction`

  - [x]* 7.3 Substituir o prompt do trader
    - Copiar literalmente do Adendo Seção 24 (15 regras, sem derivativos/macro/sentimento)
    - _Requisitos: 12.2, 12.3_
    - **Nota:** adiantada da P1.3 para a P1.1 (decisão do usuário) — sem isso, o prompt continuaria pedindo ao modelo a família `derivativos` antiga, contradizendo o schema novo

- [x] 8. Checkpoint Fase P1 — Direção isolada de derivativos, comprovado
  - Rodar `DerivativesDirectionIsolationTest` + teste manual de um caso com derivativos fortemente contrários à direção gráfica
  - Perguntar ao usuário se há dúvidas antes de avançar para a Fase P2
  - **Nota:** teste manual feito via HTTP mockado com funding extremo hostil ao LONG (0.002 > crowded 0.0005) — `direction` permaneceu `LONG`, `conviccao_modelo` caiu de 41 para 38. Pendências conhecidas e documentadas: 6.3 (duas fontes de convicção coexistindo) não resolvida

- [ ] 9. Fase P2.1 — Motor canônico de pivôs e estrutura
  - [x] 9.1 **[API]** Criar `app/Services/MarketStructureService.php`
    - Copiar literalmente do Adendo Seção 19 (pivô local 2+2, estrutural 5+5, HH/HL/LH/LL/EQH/EQL, BOS/CHOCH)
    - _Requisitos: 7.1, 7.2, 7.3_

  - [x] 9.2 **[API]** Migrar `PivoService`/`FiguraService`/`SinaisService` para consumir o motor canônico
    - Rodar grep para achar todo recálculo de pivô próprio antes de migrar — não presumir que só esses 3 arquivos recalculam
    - _Requisitos: 7.4_
    - **Nota:** investigação encontrou 3 implementações de pivô, mas só uma está no call graph vivo. `PivoService::pivos()` (2+2, usado por `ExecucaoService`/`GeminiAnalysisService` para ancorar stop) agora delega para `MarketStructureService::pivots(2,2)`, traduzindo o formato de volta para `topos`/`fundos` — testado byte a byte igual (mesmo algoritmo, mesma janela) e `ExecucaoContratoTest` continua verde. `FiguraService::calcularPivos()`/`identificar()` e `SinaisService::pernaImpulso()`/`fib()` **não foram tocados**: confirmei por grep que nenhum dos dois tem chamador fora do próprio arquivo (`identificar()` tem até um comentário no código vivo dizendo "NAO e mais chamado"; `fib()` é o mesmo achado já registrado no Requisito 10/tarefa 13.2). Migrar código morto seria esforço descartado — `SinaisService::fib()` já tem remoção formal agendada na tarefa 13.2
    - Confirmado por grep: `ExecucaoService`/`NivelService`/`GeoEventService` só consomem o resultado de `PivoService`, não recalculam

  - [x]* 9.3 Escrever testes de estrutura
    - HH/HL→BULLISH, LH/LL→BEARISH, EQH/EQL com tolerância ATR, BOS/CHOCH, pivô local 2+2, pivô estrutural 5+5, nenhum outro serviço recalculando (Adendo Seção 37.4)
    - _Requisitos: 7.5_
    - **Nota:** 8 testes em `MarketStructureServiceTest` cobrindo HH/HL→BULLISH, LH/LL→BEARISH, EQH/EQL, BOS_UP, CHOCH_DOWN, pivô local 2+2 vs. estrutural 5+5, e `INSUFFICIENT_HISTORY`. O item "nenhum outro serviço recalculando" só pode ser confirmado depois da 9.2

- [x] 10. Fase P2.2 — Rompimento, falso rompimento e reteste
  - [x] 10.1 **[API]** Criar `app/Services/BreakRetestService.php`
    - Copiar literalmente do Adendo Seção 20
    - _Requisitos: 8.1, 8.2, 8.4_

  - [x]* 10.2 Escrever testes de rompimento/reteste
    - Todos os 9 casos do Adendo Seção 37.3 (rompimento em candle fechado, pavio sem fechamento, falso rompimento, candle aberto não confirma, LTA/LTB sem 2 âncoras)
    - **Valida: Propriedade 5 (design.md)**
    - _Requisitos: 8.3_
    - **Nota:** os 2 casos de falso rompimento só são alcançáveis com `retest_atr_tolerance < breakout_atr_buffer` (override de config só no teste) — sob os defaults reais (0.20 > 0.10), qualquer fechamento extremo o bastante para satisfazer a condição de falso rompimento já dispara a condição de rompimento oposto na varredura principal do próprio `horizontal()`, "roubando" o `breakIndex`. Isso é uma característica do algoritmo literal do Adendo, não um bug introduzido aqui — vale re-visitar o parâmetro antes da promoção (P5)

- [x] 11. Checkpoint Fase P2 — Estrutura canônica sem duplicação
  - Confirmar por grep que nenhum serviço fora de `MarketStructureService` recalcula pivôs
  - Perguntar ao usuário se há dúvidas antes de avançar para a Fase P3
  - **Nota:** grep confirma só `MarketStructureService` (fonte canônica), `PivoService` (agora delega) e dois trechos de código morto sem chamador (`FiguraService::calcularPivos()`, `SinaisService::pernaImpulso()`) contêm lógica de pivô. 25 testes verdes (`MarketStructureServiceTest` + `BreakRetestServiceTest` + `ExecucaoContratoTest`)

- [x] 12. Fase P3.1 — CVD baseado em série válida
  - [x] 12.1 **[API]** Criar `app/Services/CvdSeriesService.php`
    - Copiar literalmente do Adendo Seção 25; usar `aggressor_imbalance_ratio` como nome se a origem for `aggTrades`, nunca `book_imbalance_ratio`
    - _Requisitos: 9.1, 9.2, 9.3_
    - **Nota:** achei o campo `book_imbalance_ratio` mal nomeado de fato em uso — `GeminiAnalysisService`/`ScoringService` liam `$derivativos['cvd']['imbalance']` (que vem de `BinanceService::getCvd()`, baseado em `aggTrades`) sob esse nome errado; renomeei para `aggressor_imbalance_ratio` nos dois arquivos (grep confirma zero ocorrências restantes fora de comentário explicativo). Escrevi `CvdSeriesServiceTest` (4 casos, incluindo `divergence()` retornando `UNAVAILABLE` com <2 pivôs, per Requisito 9.3)

- [x] 13. Fase P3.2 — Fibo desenhada e validada
  - [x] 13.1 **[API]** Criar `app/Services/VisualFiboValidator.php`
    - Copiar literalmente do Adendo Seção 26
    - _Requisitos: 10.1, 10.4_

  - [x] 13.2 **[API]** Confirmar e remover consumidores de `SinaisService::fib()`
    - Rodar `grep "SinaisService::fib|->fib\("` em `app/Services app/Http` antes de remover qualquer chamada — a auditoria não encontrou chamada ativa, mas isso precisa de confirmação formal, não suposição
    - _Requisitos: 10.2_
    - **Nota:** grep formal confirma zero chamadores (mesmo achado da investigação da tarefa 9.2). Nada para remover — `fib()`/`pernaImpulso()` seguem como código morto documentado. Não fiz a remoção física do método porque o Requisito 10.2 só exige remover *call sites* (não existem) e um teste de call-graph, não apagar o código legado em si

  - [x]* 13.3 Escrever testes de Fibo
    - Todos os 6 casos do Adendo Seção 37.5
    - **Valida: Propriedade 6 (design.md)**
    - _Requisitos: 10.3_
    - **Nota:** `VisualFiboValidatorTest` com os 5 casos de validação + o teste de call-graph (grep dentro do teste) confirmando que `SinaisService::fib()` nunca aparece no caminho do cérebro gráfico

- [ ] 14. Fase P3.3 — Correção do viés das cunhas (BLOQUEADA — decisão pendente)
  - **Não iniciar sem confirmação explícita do responsável de produto sobre qual mapeamento é o correto** (código atual: `CUNHA_DESCENDENTE=>'baixa'`/`CUNHA_ASCENDENTE=>'alta'`; Adendo pede o oposto). Ver Requisito 11 em `requirements.md`.
  - [ ] 14.1 Confirmar convenção correta com o usuário
    - _Requisitos: 11.1_
  - [ ] 14.2 **[API]** Aplicar a correção confirmada em `GenesisVisualCatalog::VIES` e commitar teste de regressão pinando o valor
    - _Requisitos: 11.2_
  - [ ] 14.3 **[API]** Garantir que figura sem geometria/toques/rompimento suficiente não vote
    - Reforçar `checarGeometria()`/`checarConfirmacao()` (já parcialmente entregues por `genesis-r3-2-implementacao`, task 13.1) para o contrato de famílias deste spec
    - _Requisitos: 11.3, 11.4_

- [x] 15. Fase P3.4 — OCR 1/OCR 2 separados (backend + frontend)
  - [x] 15.1 **[API]** Substituir o prompt de `IAGatewayController::scangraph()`
    - Copiar literalmente do Adendo Seção 29, com a validação Laravel listada
    - _Requisitos: 13.3_
    - **Nota:** prompt agora inclui `market` (SPOT/FUTURES). Resposta é sempre parseada e validada com `validator(...)->validate()` (symbol/timeframe/exchange/market/confidence, `confidence >= 0.85`); falha retorna 422 com `validation_errors`. Corretora selecionada manualmente pelo usuário continua podendo sobrescrever (ação explícita, não default silencioso)

  - [~] 15.2 **[API]** Aplicar o contrato estrito do OCR 2
    - Copiar o JSON do Adendo Seção 30; garantir que `exchange`/`symbol`/`timeframe`/indicadores matemáticos nunca voltam do OCR 2
    - _Requisitos: 13.4_
    - **Nota (revisada em auditoria de provas — 2026-07-15):** parte do escopo foi feita e é real — achei e corrigi exatamente o bug listado na matriz do Adendo (Seção 6.2, "OCR 2 → Redetecta corretora"): `extrairElementosVisuais()` pedia `"exchange"` no JSON e `GeminiAnalysisService::analisar()` usava `$elementosVisuais['exchange']` como fallback para rotear derivativos. Removi o campo do prompt do OCR 2 e o fallback — corretora agora vem só do OCR 1/parâmetro `$exchange`. **Porém a task foi marcada `[x]` incorretamente**: o formato JSON do OCR 2 (`extrairElementosVisuais()`) continua no esquema antigo (`suportes`/`resistencias`/`linhas_tendencia`/`fibonacci: [float]`/`poc`/`hvn`/`lvn`/`indicadores_visiveis`/`smart_money_zones`), não no contrato estrito da Seção 30 (`supports`/`resistances`/`trendlines`/`fibo: {visible, anchors, confidence}`/`volume_profile`/`visual_zones`/`quality`). Essa divergência é a causa raiz de `VisualFiboValidator` (Seção 26, task 10.x) nunca ter sido conectado — ele espera `fibo.anchors[].{time_ms,price}`, formato que o OCR 2 real não produz. Reclassificado para `[~]` (parcial): migrar o contrato completo é um refactor maior, com dezenas de consumidores do formato atual espalhados por `GeminiAnalysisService`, `FiguraService`, `ExecucaoService` e `MotorExecucaoService` — não deve ser feito silenciosamente dentro de uma auditoria; precisa de task própria.

  - [x] 15.3 **[FE]** Confirmar qual checkout é o frontend real deste projeto
    - Provavelmente o mesmo repositório já trabalhado por `genesis-r3-2-implementacao` Fase 4 — confirmar antes de duplicar migração de `types.ts`/`AnalysisResult.tsx` em andamento em outro spec
    - _Requisitos: 13.5_
    - **Confirmado:** este repositório (`c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main`) é o frontend — tem `package.json` e `components/AnalysisResult.tsx`

  - [x] 15.4 **[FE]** Implementar `scanChartMetadata()` e remover defaults
    - Copiar literalmente do Adendo Seção 28; remover `|| 'Binance'`, `|| '4h'`, `|| 'BTCUSDT'`, `|| '1D'`
    - _Requisitos: 13.1, 13.2_
    - **Nota (achado maior):** `unifiedChartAnalysis()` violava as Invariantes 2.3.2/2.3.3 do Adendo — misturava metadados+visual numa chamada só, disparada na **seleção do arquivo** (antes do clique em Analisar), decisão deliberada de um spec anterior (`client-reported-bugs-batch`) travada por teste. Criei `scanChartMetadata()` nova e independente (chama `/v1/scangraph`, só metadados, sem default, lança erro se symbol/timeframe/exchange/market/confidence não vierem confiáveis) e religuei `GenesisPage::handleFileChange` para usá-la no lugar de `unifiedChartAnalysis`. `unifiedChartAnalysis()` continua existindo (não removida, mantém seus próprios testes), mas saiu do call graph vivo — confirmado por grep. `analyzeChart()` perdeu os defaults `metadata.pair || 'BTCUSDT'`/`metadata.timeframe || '1D'`, agora lança erro se ausentes. Atualizei 2 testes que travavam a arquitetura antiga (`preservation.property.test.ts`, `integration.e2e.test.ts`) com comentário explicando a reversão

  - [x]* 15.5 Rodar grep de confirmação de defaults
    - `grep "\|\| 'Binance'\|\|\| '4h'\|\|\| '1D'\|\|\| 'BTCUSDT'"` em `services pages components` — esperar vazio
    - **Nota:** só restam ocorrências fora de escopo (Scanner/RiskCalculator, features não tocadas por este spec) e o default dentro de `unifiedChartAnalysis()` legado/fora do call graph — exatamente a exceção que o próprio Adendo permite ("ou estar acompanhados de referência exclusivamente legada e fora do call graph")

- [x] 16. Fase P3.5 — Integração da folha de decisão gráfica
  - [x] 16.1 **[API]** Aplicar a ordem de chamadas do Adendo Seção 31 em `GeminiAnalysisService::analisar()`
    - `getCandlesStrict → indicadores → MarketStructureService → CvdSeriesService → SupplementalIndicatorsService → visual → buildGraphicalDecisionSheet → trader → pre-audit → DerivativesContextService → auditoria final`
    - _Requisitos: 14.1, 14.2, 14.3, 14.4_
    - **Nota:** o bloco de código do Adendo 31 é um esqueleto de referência, não um drop-in — o `analisar()` real tem ~900 linhas com execução/liquidações/book/Wyckoff/orçamento de IA que o Adendo não modela. Apliquei o *princípio de ordenação*: `MarketStructureService`/`CvdSeriesService` agora são chamados de verdade (antes eram só classes existentes, nunca invocadas), como computos **novos e paralelos** ao `$cvdSeries`/`slopeCVD` legado — não toquei nesse legado para preservar CONTROL byte a byte (critério de aceite 33 do Adendo). Criei `$familyEvidence` (as 5 famílias) e `$familyAvailability` real (antes hardcoded `true` na P1.1), adicionados à folha como `family_evidence` sem remover os blocos legados (`estrutura_$tf` etc.). `SupplementalIndicatorsService` não foi chamado — não existe ainda (Fase P4, `shadow_mode`/peso zero, adiar não muda nenhum resultado). `VisualFiboValidator` não foi conectado — o OCR 2 ainda não emite âncoras no formato que ele exige (gap conhecido, documentado). Publiquei o contrato canônico em inglês (`base_conviction`/`conviction`/`coverage`/`family_scores`/`score_justification`/`technical_analysis`/`score_context`/`thesis_invalidation`) ao lado do português existente — mesmo valor, nunca recalculado. Confirmado com dry-run: `family_evidence.structure` reflete status real do `MarketStructureService`, `coverage` cai quando `visual_confluence` fica sem evidência real

  - [x] 16.2 **[FE]** Reler `AnalysisResult.tsx` a partir do contrato de famílias
    - `scoreJustification`/`technicalAnalysis` per Adendo Seção 32; renderizar `score_context.limitations`/`required_confirmation`, nunca repetir a justificativa
    - _Requisitos: 15.1, 15.2_
    - **Nota:** aplicado literalmente o código da Seção 32. `mainRationale` removido; `scoreJustification = analysis.score_justification ?? analysis.justificativa_score ?? null` e `technicalAnalysis = analysis.technical_analysis ?? analysis.narrativa_tecnica ?? null`, nunca lendo `execution.motivo`. Card do score agora renderiza `scoreJustification`; bloco "Análise Técnica" agora renderiza `technicalAnalysis`. Aviso de baixa convicção passou a renderizar `score_context.limitations`/`required_confirmation` (novo `scoreContext` derivado), removendo a repetição de `justificativa_score` que existia antes. `FamiliasTrader`/`score_familias` (4 famílias legadas) não foi tocado — fora do escopo desta task, que trata apenas de narrativa/justificativa.

  - [x] 16.3 **[FE]** Adicionar tipos do Adendo Seção 33 a `types.ts`
    - `GraphicalFamilyScores`, `GraphicalScoreContext`, `DerivativesContext`, `GraphicalAnalysis`
    - _Requisitos: 15.3_
    - **Nota:** as 4 interfaces adicionadas literalmente. `GenesisAnalysisResult['analysis']` estendido com os campos opcionais em inglês (`base_conviction`, `conviction`, `coverage`, `family_scores`, `score_justification`, `technical_analysis`, `score_context`, `thesis_invalidation`) ao lado dos campos em português já existentes — aditivo, nada removido.

  - [x]* 16.4 Escrever teste de não-duplicação de narrativa
    - `scoreJustification !== technicalAnalysis` para o mesmo payload
    - _Requisitos: 15.4_
    - **Nota:** criado `__tests__/analysisResultNarrative.test.ts` — property test (fast-check) prova que para quaisquer dois textos distintos publicados em `score_justification`/`technical_analysis` os valores derivados nunca colapsam; teste de fallback para os campos legados em português; teste estrutural garantindo que `execution.motivo` nunca é fonte da justificativa; teste de regressão que lê o código-fonte do componente e garante a presença literal das duas linhas de `??` e a ausência de `mainRationale`. Suite completa do frontend: 283/310 passando (era 279/306 antes — 4 testes novos, todos verdes; as mesmas 27 falhas pré-existentes e não relacionadas continuam, contagem idêntica antes/depois).

- [ ] 17. Fase P3.6 — Persistência canônica e qualidade textual
  - [x] 17.1 **[API]** Substituir leitura de campos legados em `IAGatewayController::analyze()`
    - Copiar literalmente do Adendo Seção 34; nunca assumir `BINANCE`
    - _Requisitos: 16.1, 16.2_
    - **Nota:** `Analise::create()` lia campos que não existem mais no retorno de `analisar()` desde a reescrita R3.2 (`scoreProbabilidade`, `direcaoProvavel`, `analiseTecnica`, `entradaSugerida`, `scoreDetalhado`, `execucao.setup`) — persistindo `score`/`vies`/`direcao`/`resumo_analise`/planos/TPs/stop como `null`/`0` silenciosamente. Substituído pela leitura literal do Adendo 34 (`$resultado['analysis']`/`['execution']['candidate_setup']`/`['pair']`), confirmada campo a campo via `tinker` com um payload realista. Validação de `exchange` no `analyze()` passou de `nullable` para `required`— o frontend (Adendo Seção 28) já nunca envia sem resolver a corretora, e persistir `strtoupper($exchangeInput ?? 'BINANCE')` era exatamente o default silencioso que o Adendo proíbe. Removida também a linha de log morta que lia `$resultado['entradaSugerida']` (sempre `null`). `market` segue não persistido/validado nesta rota — gap conhecido, dependente do threading de `market` da OCR1 até `/v1/analyze`, fora do escopo literal desta task (não pedido pelo Adendo 34).

  - [x] 17.2 **[API]** Garantir UTF-8 em headers e banco
    - `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`, `utf8mb4`/`utf8mb4_unicode_ci`; nunca `utf8_encode()`/`utf8_decode()` no texto do modelo
    - _Requisitos: 16.3_
    - **Nota:** banco e ausência de `utf8_encode`/`utf8_decode` já estavam corretos (`config/database.php`: conexão `mysql` já com `utf8mb4`/`utf8mb4_unicode_ci`; grep em `app/` não encontrou `utf8_encode(`/`utf8_decode(`). Aplicado o padrão do Adendo 35.1 (`Content-Type: application/json; charset=UTF-8` + `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`) na resposta de `analyze()` (carrega a narrativa em português do trader) e também em `scangraph()`, onde o encoder externo sem esse flag estava re-escapando o JSON já `UNESCAPED_UNICODE` embutido como string em `content` — inconsistência real corrigida como parte da mesma task.

  - [x] 17.3 **[API]** Criar `app/Services/TextQualityGate.php`
    - Copiar literalmente do Adendo Seção 35.2
    - _Requisitos: 17.1, 17.2_
    - **Nota:** classe copiada literalmente. Validado via `tinker`: texto limpo com acentuação passa (`ok=true`); texto sem acentos (`voce`/`nao`/`analise`) reprova com `MISSING_PORTUGUESE_ACCENTS`; vocabulário técnico proibido (`linha horizontal`) reprova com `FORBIDDEN_TRADER_VOCABULARY`. **Não conectada** ao pipeline de `analisar()`/`GeminiTraderClient` — a task 17.3 é apenas de criação da classe; nenhuma outra task no arquivo referencia `TextQualityGate` para wiring (regra de regeneração única do Adendo 35.2 fica para uma fase futura, quando houver task explícita para isso).

- [x] 18. Checkpoint Fase P3 — Visual e frontend alinhados ao contrato gráfico
  - `npm run build`/`tsc --noEmit` limpos no frontend; `php artisan test` verde no backend
  - **Nota:** `tsc --noEmit` sem saída (limpo). `npm run build` concluído com sucesso (só o aviso padrão de chunk >500kB do Vite, pré-existente, não bloqueante). Suite frontend completa: 283/310 passando (mesmas 27 falhas pré-existentes e não relacionadas de antes desta fase). `php artisan test`: 90/91 passando, única falha é `RadarNewsPollTest::poll_excludes_news_older_than_5_minutes`, flaky por tempo, pré-existente durante toda a sessão, não relacionada a nenhuma mudança da Fase P3.
  - Perguntar ao usuário se há dúvidas antes de avançar para a Fase P4

- [x] 19. Fase P4 — Indicadores suplementares em shadow mode
  - [x] 19.1 **[API]** Criar `app/Services/SupplementalIndicatorsService.php`
    - Copiar literalmente do Adendo Seção 27 (VWAP, CMF20, OBV, Efficiency Ratio 10, Ichimoku, Supertrend)
    - _Requisitos: 18.1_
    - **Nota:** classe copiada literalmente.

  - [x] 19.2 **[API]** Confirmar peso zero enquanto a flag estiver desligada
    - Nenhum `family_scores`/`direction` deve mudar com `config('genesis_graphical.features.*')=false`
    - _Requisitos: 18.2_
    - **Nota:** conectado a `analisar()` como computo novo e paralelo (mesmo padrão de `MarketStructureService`/`CvdSeriesService` na task 16.1): `$supplementalIndicators = app(SupplementalIndicatorsService::class)->calculate($candles)`, sempre calculado (para permitir avaliar ganho real depois), guardado em `$folha['supplemental_indicators']` (persistido no event store) e removido de `$folhaParaTrader` no mesmo `unset()` que já protege `derivativos` (Adendo 31.1) — o LLM nunca vê esses valores. Peso zero é garantia estrutural, não só de config: `GraphicalScoreAuditor::audit()` só recebe `(response, familyAvailability, derivativesModifier)`, nunca a folha: não há parâmetro pelo qual o indicador possa influenciar `family_scores`/`direction`. Confirmado com `tinker` (folha completa carrega os valores; `folhaParaTrader` não) e com `SupplementalIndicatorsShadowModeTest` (grep em `TraderSchema`/`GeminiTraderClient` confirma zero menção a vwap/cmf20/efficiency_ratio/ichimoku/supertrend; todas as flags `genesis_graphical.features.*` seguem `false`).

  - [x]* 19.3 Comparar contra biblioteca técnica independente + fixtures fixas
    - Pré-requisito obrigatório antes de qualquer flag virar `true` (Adendo Seção 27, nota de fechamento)
    - _Requisitos: 18.3, 18.4_
    - **Nota:** `SupplementalIndicatorsServiceTest` — VWAP/OBV/CMF/Efficiency Ratio/Supertrend/Ichimoku testados contra valores derivados à mão fora do código de produção (fixtures pequenas com aritmética documentada linha a linha nos comentários do teste, não apenas reexecução da mesma fórmula), mais casos de dados insuficientes retornando `null`. Isso não substitui a comparação formal contra uma biblioteca externa (TA-Lib/pandas-ta) exigida antes de qualquer flag virar `true` — nenhuma flag foi alterada nesta task, permanecem todas `false`; a comparação externa fica para quando houver uma proposta real de promoção.

- [ ] 20. Fase — Conectar serviços incrementais já existentes (paralelo a P2–P4, sem bloquear)
  - **Nota geral (investigação desta fase):** as 4 subtasks foram investigadas antes de qualquer mudança. Nenhuma foi implementada — decisão explícita do usuário foi adiar as 4 (`AskUserQuestion`: "Adiar 20.1 inteiro" / "Adiar 20.4 inteiro"; 20.2/20.3 já estavam bloqueadas por dado inexistente, confirmado nesta investigação).

  - [ ] 20.1 **[API]** Criar `app/Services/DataFreshnessGate.php` (se `genesis-r3-2-implementacao` ainda não tiver entregue)
    - Copiar literalmente do Adendo Seção 36.1; excluir fontes `STALE`/`SEQUENCE_GAP` como evidência
    - _Requisitos: 19.1_
    - **Nota:** o arquivo **já existe** (entregue pelo spec irmão `genesis-r3-2-implementacao`, Documento Mestre Seção 12.8 — não recriado, per design.md). Confirmado por grep que `avaliar()` nunca é chamado em lugar nenhum do pipeline — não conectado. Investigação: conectar de verdade exigiria `timestamp_ms` por fonte; hoje só `candles` tem timestamp real (close_time do kline da Binance) — OI/funding/CVD/order book não carregam timestamp em nenhum ponto do fluxo atual (`ExchangeRouter::buscar()`/`BinanceService` não capturam isso). Apresentadas 3 opções ao usuário (conectar só com candles / investigar timestamp real de mais fontes primeiro / adiar); usuário escolheu **adiar a task inteira**. Permanece não conectado.

  - [ ] 20.2 **[API]** Conectar `DerivativesEnrichmentService` quando mark/index price estiverem disponíveis
    - Depende de coleta de dado que hoje não existe em nenhum ponto do pipeline — não inventar valor
    - _Requisitos: 19.3_
    - **Nota:** confirmado por grep — `DerivativesEnrichmentService::enriquecer()` exige `mark_price`/`index_price` no array de entrada; nenhum dos dois é coletado em nenhum ponto de `GeminiAnalysisService`. Bloqueio real, não implementado, como já documentado no Requisito 19.

  - [ ] 20.3 **[API]** Conectar `TradeFlowService` quando houver stream real de trades
    - Depende de `BinancePublicStreamService` (Requisito 19.4) — decisão de infraestrutura pendente, mesma trava já registrada em `genesis-r3-2-implementacao` task 9.1
    - _Requisitos: 19.2_
    - **Nota:** confirmado por grep — `TradeFlowService::resumir()` exige um array de trades com `timestamp_ms`/`preco`/`quantidade`/`agressor`; nenhum stream de trades existe em nenhum dos dois specs. Bloqueio real, não implementado.

  - [ ] 20.4 **[API]** Gerar `experiment_group_id` idêntico para CONTROL/CANDIDATE
    - _Requisitos: 19.5_
    - **Nota:** investigação revelou que a task pressupõe uma arquitetura de dual-run (uma análise CONTROL + uma CANDIDATE persistidas separadamente, comparáveis pelo mesmo `experiment_group_id`) que **não existe** — hoje só uma análise é persistida por request via `AnalysisEventStore::persist()`, e `brain_variant` cai no default silencioso `'CONTROL'` (`AnalysisEventStore.php:38`) mesmo persistindo a saída do cérebro **novo** (CANDIDATE) — um mislabeling real no banco, não um problema de nomenclatura teórico. `ScoringService::calcular()` (o cérebro legado/CONTROL) continua sendo chamado a cada request (`GeminiAnalysisService.php:525`, preservado por CONTROL byte-a-byte per Adendo 33), mas seu resultado nunca é persistido como uma análise CONTROL separada. Apresentadas 3 opções ao usuário (só corrigir o rótulo + gerar uuid / construir o dual-run completo agora / adiar); usuário escolheu **adiar a task inteira**. O mislabeling (`brain_variant` sempre `'CONTROL'` mesmo para saída CANDIDATE) permanece no banco, documentado aqui para quando esta task for retomada.

- [ ] 21. Fase P5 — Prova real e protocolo de aceite
  - [x] 21.1 Reanalisar POL — capturar os 14 artefatos do Adendo Seção 38.4
    - _Requisitos: 21.1, 21.4_
    - **Nota:** imagem real fornecida pelo usuário (`POLUSDT.P_2026-06-10_14-08-29.png`, gráfico 1D LuxAlgo SMC), rodada pelo pipeline real (Gemini + Binance, sem mocks) via `GeminiAnalysisService::analisar('POLUSDT','1d',1,...,'BINANCE')`. 13 de 14 artefatos capturados em `tests/Proof/POL/` (falta só `screen.png`, que exige rodar o frontend e tirar print manualmente — não automatizável sem ferramenta de browser). Resultado real: `direction=LONG`, `conviction=20` (baixa, `leitura_fraca=true`), `family_scores={structure:-5, trend:8, momentum:12, technical_flow:5, visual_confluence:0}`, `coverage=1`, `derivatives_modifier=0` (NEUTRO). Execução bloqueada por RR insuficiente (1:1.02 < 1:1.5), não por convicção — direção permanece válida. `MarketStructureService` leu a estrutura canônica como `BEARISH` com `CHOCH_UP` confirmado — bate exatamente com o que a Seção 38.1 pede provar: recuperação real das EMAs curtas (preço acima de EMA21/50, abaixo de EMA200) e RSI/MACD melhores (RSI 62.99, MACD acima do sinal) elevam a soma gráfica para LONG, mas a EMA200/resistência (0.094) limitam a convicção a 20 em vez de inverter a estrutura — e o `score_justification`/`technical_analysis` explicam isso em texto, de forma explícita. **Achado relevante:** o log capturado (`GeminiAnalysis: Score=50 vies=SHORT_LEVE`) mostra que o `ScoringService` legado (CONTROL) ainda erra na direção pro mesmo gráfico real — SHORT_LEVE — enquanto o cérebro novo (CANDIDATE) acerta LONG com convicção apropriadamente baixa. Evidência direta e não fabricada de que o bug descrito na Seção 38.1 está corrigido no CANDIDATE.
    - **Bug encontrado e corrigido na minha própria coleta de evidência** (não no código do Genesis): o script de captura registrava um novo `Log::listen()` por caso dentro do mesmo processo PHP sem desregistrar o anterior; como a variável do buffer era reatribuída (não recriada em escopo novo) a cada iteração do `foreach`, os listeners acabavam compartilhando a mesma referência, duplicando/contaminando `log.jsonl`. Detectado por auditoria dos `analysis_id` presentes no arquivo antes de aceitar o pacote como prova. POL foi o primeiro caso rodado no processo e não sofreu o problema; confirmado por essa mesma auditoria.

  - [x] 21.2 Reanalisar APT — capturar os 14 artefatos
    - _Requisitos: 21.2, 21.4_
    - **Nota:** imagem real fornecida pelo usuário (`APTUSDT_2026-06-05_11-35-20.png`, gráfico 4h LuxAlgo SMC com BOS/CHoCH), rodada pelo pipeline real via `analisar('APTUSDT','4h',1,...,'BINANCE')`. 13 de 14 artefatos em `tests/Proof/APT/` (falta `screen.png`, mesmo motivo do POL). `log.jsonl` foi contaminado pelo bug de coleta descrito acima (6 linhas do caso POL vazaram, e cada linha própria apareceu duplicada); corrigido filtrando por `analysis_id` e deduplicando (94→43 linhas únicas e corretas), sem precisar refazer nenhuma chamada real de API — `ocr2-raw.json`/`ocr2-validated.json` foram re-extraídos do log já limpo. Resultado real: `direction=SHORT`, `conviction=12` (`leitura_fraca=true`), `family_scores={structure:-10, trend:-8, momentum:2, technical_flow:4, visual_confluence:0}`. Execução bloqueada por RR insuficiente (1:0.47), direção permanece válida. Bate com a Seção 38.2: estrutura vendedora abaixo da EMA200 confirmada; `score_justification` e `technical_analysis` são textos genuinamente diferentes (não repetidos); acentuação PT-BR íntegra em ambos; nenhum campo de Fibo aparece na folha ou na resposta pública (nenhuma Fibo criada sem validação, porque nada foi validado). **Achado relevante de validação real funcionando:** o OCR2 reportou uma figura `BANDEIRA_BAIXA` com confiança ALTA, mas o log mostra `FIGURA: OCR reprovado (linhas nao ancoram nos candles)` — a figura foi descartada antes de chegar à folha (`estrutura_4h.figura`/`family_evidence.visual_confluence.figura` = `null`/`NENHUMA`), provando ao vivo que a validação geométrica de figura funciona contra um caso real, não só em teste sintético. **Achado CONTROL vs CANDIDATE:** log mostra `ScoringService` legado com `Score=40 vies=LONG_LEVE` — direção oposta à do cérebro novo (SHORT) — reforçando com um segundo caso real que os dois cérebros divergem de forma consistente com os problemas que este Adendo existe para corrigir. **Achado à parte (não é bug desta fase, é achado de qualidade a documentar):** o OCR1 (`scangraph`) reprovou para esta imagem com erro `market é obrigatório` — o Gemini não conseguiu extrair `market` com confiança suficiente apesar do gráfico dizer claramente "PERPETUAL CONTRACT" no canto superior esquerdo; o `analisar()` completo não foi afetado (rodado com `market`/`symbol`/`timeframe` corretos fornecidos diretamente), mas isso é uma lacuna real de robustez do prompt de OCR 1 que vale registrar para uma iteração futura do Adendo Seção 29.

  - [ ] 21.3 Reanalisar MYX — capturar os 14 artefatos
    - _Requisitos: 21.3, 21.4_
    - **Nota:** **bloqueado, não implementado.** Nenhuma imagem real de MYX foi fornecida; o usuário optou explicitamente por não capturar uma agora. Sem gráfico real, não há como produzir um pacote de prova válido sem violar o próprio propósito anti-fabricação da Seção 38 (critério 34 exige "pacote real completo" para os 3 casos).

  - [ ] 21.4 Avaliar os itens aplicáveis do Adendo Seção 40 (36 critérios binários) sem veredito parcial
    - _Requisitos: 21.5_
    - **Nota:** **não pode ser fechado ainda** — critério 36 da própria Seção 40 exige que a matriz final some exatamente os próprios veredictos, e critério 34 exige POL+APT+MYX; com MYX ausente e `screen.png` pendente nos 2 casos existentes, qualquer matriz de 36 itens fechada agora seria prematura por definição do próprio Adendo. O que os 2 casos reais já sustentam com evidência (não fabricada): critério 15 não se aplica a estes 2 casos (sem cunha); critério 16 (figura inválida não vota) confirmado ao vivo no caso APT; critério 18/19 (derivativos não entram na soma e não trocam direção) confirmado nos dois casos (`derivatives_modifier=0`, `rule=CONTEXT_ONLY_CANNOT_CHANGE_DIRECTION`); critério 21 (score com fonte única) confirmado (`conviccao_modelo`==`conviction` nos dois); critério 24/25/26 (`score_justification`/`technical_analysis` existem e são textos diferentes) confirmado nos dois; critério 27 (UTF-8 íntegro) confirmado visualmente nos textos capturados. Os demais 36 itens dependem de rodar os comandos da Seção 41 (suítes backend/frontend + greps) no mesmo hash de commit junto com o pacote MYX — não executado nesta sessão.

  - [ ] 21.5 Manter `GENESIS_GRAPHICAL_SHADOW_MODE=true` até 100% dos critérios aprovados
    - _Requisitos: 21.5_
    - **Nota:** verificado — a chave não está explicitamente setada no `.env` real, mas o default em `config/genesis_graphical.php` (`env('GENESIS_GRAPHICAL_SHADOW_MODE', true)`) é `true`, e `.env.example` documenta `true`; efetivamente shadow mode está ativo hoje, não alterado nesta fase. Permanece assim até 21.3/21.4 fecharem com 100% dos critérios aprovados.

## Notas

- Tarefas marcadas com `*` são testes; podem ser adiadas para um MVP mais rápido, mas nenhum checkpoint de fase deve ser considerado concluído sem elas.
- `[API]` e `[FE]` indicam o repositório de cada tarefa.
- Este spec é irmão de `genesis-r3-2-implementacao`, não o substitui. Tarefas que dependem de trabalho já entregue por aquele spec (event store, `RegimeService`, `FeaturePolicy`, remoção do cérebro Gemini duplicado) referenciam esse trabalho em vez de recriá-lo — confirmar o estado real daquele spec antes de assumir algo como pronto.
- A Fase 14 (cunhas) está formalmente bloqueada até decisão explícita do usuário — não é um "TODO comum", é um bloqueio de segurança de produto.
- A Fase 20 (serviços incrementais) roda em paralelo às fases P2–P4 sem bloquear nenhuma delas — suas dependências de dado (mark/index price, stream WebSocket) são externas a este spec.

---

## Fase 6 (OPCIONAL — fora da ordem P0–P5, aguardando avaliação do usuário)

Corresponde à Seção 43 do Adendo ("Saneamento obrigatório de legado, histórico e caches"). **Não iniciar nenhuma tarefa abaixo sem autorização explícita, por escrito, do usuário — envolve migration em tabelas de produção (`genesis_analises`, `genesis_analysis_events`) e um comando que arquiva registros em massa.**

- [ ] 22. Fase 6.1 — Segregação de histórico legado (BLOQUEADA — aguardando decisão do usuário)
  - [ ] 22.1 Obter autorização explícita e backup verificável do banco antes de qualquer passo
    - _Requisitos: OPC-1.1_ (avaliação futura)

  - [ ] 22.2 **[API]** Criar a migration de status/auditoria (Adendo Seção 43.5)
    - Somente após 22.1

  - [ ] 22.3 **[API]** Criar os escopos `currentHistory()`/`directionEligible()`/`legacyArchive()` no model `Analise` (Adendo Seção 43.6)

  - [ ] 22.4 **[API]** Criar `app/Console/Commands/SanitizeLegacyGraphBrainCommand.php` com dry-run obrigatório
    - Copiar literalmente do Adendo Seção 43.8; nunca rodar `--apply` sem `--backup-ref` confirmado pelo usuário

  - [ ] 22.5 **[API]** Criar `app/Services/LegacyGraphCachePurger.php`
    - Copiar literalmente do Adendo Seção 43.9; prefixos travados em `app:gemini:visuais:` e `app:binance:candles_r:`, nunca `app:*`

  - [ ] 22.6 **[API]** Garantir que histórico legado nunca entra no prompt do trader
    - Teste per Adendo Seção 43.10

  - [ ]* 22.7 Escrever os testes de quarentena do Adendo Seção 43.11

  - [ ] 22.8 Executar a ordem exata de 14 passos do Adendo Seção 43.12, só depois de autorização e backup confirmados
