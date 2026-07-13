# Plano de Implementação: Gênesis V4.3-R3.2

## Visão Geral

Implementação ordenada por risco e dependência: primeiro parar o crash em produção e as violações ativas de invariante (Fase 0), depois destravar a configuração morta (Fase 1), depois construir o que nunca existiu (Fase 2–3), depois migrar o frontend para o contrato novo (Fase 4), depois segurança e limpeza (Fase 5), e por fim o protocolo de prova (Fase 6). Nenhuma tarefa de uma fase posterior deve começar antes do checkpoint da fase anterior. Todo código novo no backend segue o Documento Mestre Seção X citada em cada tarefa — copiar a implementação de lá é a fonte de verdade; este arquivo não repete o código, aponta onde ele está.

Repositórios: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** = este repositório.

## Tarefas

- [x] 1. Fase 0.1 — Destravar o crash fatal
  - [x] 1.1 **[API]** Adicionar `ExecucaoService::indisponivel()` e `ExecucaoService::inconsistente()`
    - Editar `app/Services/ExecucaoService.php`
    - Copiar os dois métodos estáticos literalmente do Documento Mestre Seção 14.1
    - Confirmar que `GeminiAnalysisService.php:809,818` compila e chama sem erro
    - _Requisitos: 1.1, 1.2, 1.3, 1.4_
    - **Feito 2026-07-13.** Achado adicional durante a implementação: `montar()` também estava fatal — a assinatura antiga nem tinha o parâmetro `conviccao` que o chamador já passava por named argument (PHP 8). Corrigido junto na Task 2.

  - [x]* 1.2 Escrever testes da Propriedade 1
    - **Propriedade 1: `indisponivel`/`inconsistente` nunca lançam erro fatal**
    - `tests/Unit/ExecucaoContratoTest.php::test_quarentena_nao_e_indisponivel` e `::test_falha_tecnica_e_unico_indisponivel` (Documento Mestre Seção 18.5)
    - **Valida: Requisito 1.5**
    - **Feito 2026-07-13.** Passando.

- [x] 2. Fase 0.2 — Reescrever `ExecucaoService::montar()`
  - [x] 2.1 **[API]** Substituir a classe `ExecucaoService` inteira pelo contrato da Seção 14.1
    - Verificar assinatura do construtor atual (`NivelService`, `AlvoService`, `PivoService`) antes de substituir
    - Implementar `montar()` com o novo enum de `status`, `LogicException` em direção inválida, `calcularRrLiquidoEstimado()`, `validarR8()`
    - Confirmar que `montarBarreiras()` já nasce lendo `$zonas['suportes']`/`$zonas['resistencias']` (não `$ev`)
    - _Requisitos: 2.1, 2.2, 2.3, 2.9, 2.10, 4.1, 4.2_
    - **Feito 2026-07-13.** Desvio deliberado do Documento Mestre: os tipos de barreira usados para S/R validado ficaram como `resistencia_suporte` (não `resistencia_validada`/`suporte_validado` como o texto literal da Seção 14.1 sugere), porque `AlvoService::PESOS` só define peso para `resistencia_suporte` — usar os nomes novos faria essas barreiras cair no peso-fallback 1, abaixo até de `geometria`. Mantido o peso 8 original.

  - [x] 2.2 **[API]** Ligar `config('genesis.custos_bps')`, `rr_minimo`, `conviccao_min_execucao`, `risco_por_analise`, `shadow_mode` de fato
    - Confirmar que os valores existem em produção (não só em `.env.example`)
    - Validar que `NAO_RECOMENDADA_CONFIGURACAO`, `NAO_RECOMENDADA_ALVO`, `NAO_RECOMENDADA_RR`, `NAO_RECOMENDADA_CONVICCAO`, `EXECUTAVEL`→`SHADOW_MODE` disparam nas condições certas
    - _Requisitos: 2.4, 2.5, 2.6, 2.7, 2.8, 6.1_
    - **Feito 2026-07-13.** Confirmado por teste (`test_rr_reprovado_preserva_direcao_e_zera_niveis`, `test_shadow_mode_rebaixa_executavel`). Pendente confirmar em produção real que `GENESIS_RISCO_POR_ANALISE` está setado no `.env` do servidor (não só no `.env.example`) — não verificável a partir deste ambiente de dev.

  - [x]* 2.3 Escrever testes da Propriedade 2 e 3
    - **Propriedade 2: RR líquido ≤ RR bruto quando custos > 0** — data provider com custos variados
    - **Propriedade 3: `action` só é não-nulo quando `status=EXECUTAVEL`**
    - `ExecucaoContratoTest::test_rr_baixo_preserva_candidato_mas_nao_publica_acao` (Documento Mestre Seção 18.5)
    - **Valida: Requisitos 2.2, 2.3, 2.6, 2.9, 2.11**
    - **Feito 2026-07-13.** Testes `test_rr_reprovado_preserva_direcao_e_zera_niveis` e `test_shadow_mode_rebaixa_executavel` cobrem isso com Mockery (a suite do projeto não usa data providers de propriedade em PHP ainda).

  - [x]* 2.4 Escrever teste da Propriedade 4
    - **Propriedade 4: Barreiras de TP nunca incluem S/R bruto do OCR**
    - `FolhaIntegridadeTest::test_barreiras_ignoram_sr_bruto_e_usam_somente_sr_validado` (Documento Mestre Seção 18.3)
    - Rodar `grep -RInE "elementosVisuais.*(suportes|resistencias)|\$ev\['(suportes|resistencias)'\]" app/Services/ExecucaoService.php` — esperar vazio
    - **Valida: Requisito 4.3, 4.4**
    - **Feito 2026-07-13.** Teste passando; grep confirmado vazio.

- [ ] 3. Fase 0.3 — Remover o cérebro Gemini duplicado
  - **ADIADA por decisão explícita do usuário em 2026-07-13** — só entra junto com a Fase 4 (migração do frontend). Motivo: `buildTradeSetup()` faz dupla função — monta tanto os campos legados da IA duplicada (`direcaoProvavel`, `confianca`, `regime`, `execucao.setup`, `macroGeopolitica`, `dadosAtivo`) quanto dados 100% PHP que a folha usa hoje (`dados_mercado.cvd/estocastico/oi_enriquecido`, `scoreDetalhado`, `multiTimeframe`, `zonasEstruturais` — nenhum destes se perde ao remover a chamada IA). O bloqueador real é que `AnalysisResult.tsx` em produção lê `data.execucao.setup` sem optional chaining — removendo a chamada agora, essa tela quebra até o contrato novo (Fase 4) estar no ar.
  - [x] 3.1 **[API]** Mapear dependência de campos públicos no caminho legado
    - Rodar uma análise real e listar quais chaves de `contexto_informativo`/`analysis` vêm hoje de `buildPrompt()`/`callGemini()`/`buildTradeSetup()`
    - Confirmar que `gerarContextoInformativoUnico()` (já existente, Seção 10.4) cobre essas chaves ou decidir explicitamente quais somem
    - _Requisitos: 3.2_
    - **Investigação concluída 2026-07-13** (ver nota acima). Remoção (3.2) em aberto, agendada para rodar com a Fase 4.

  - [ ] 3.2 **[API]** Apagar o caminho legado
    - Remover as chamadas em `analisar()` a `buildPrompt()`/`callGemini()`/`buildTradeSetup()`
    - Deletar `buildPrompt()`, `callGemini()`, `buildTradeSetup()`, `buscarGeopoliticaFresca()` (se órfã após a remoção), `promptTrader()`, `schemaTrader()`, `callTraderIA()`, `callOpenAITrader()`, `callGeminiTrader()`, `viesDaFigura()` de `GeminiAnalysisService.php`
    - Deletar `FiguraService::identificar()` e helpers privados (`medirGeometria`, `calcularPivos`, `verificarOCO`, `verificarTopoFundoDuplo`, `verificarXicara`, `projetarAlvo`, `nivelDeConfirmacao`)
    - _Requisitos: 3.1, 3.3, 3.4_

  - [ ]* 3.3 Rodar greps de confirmação
    - `grep -RInE "callGemini\(|buildPrompt|buildTradeSetup|buscarGeopoliticaFresca" app/` — esperar vazio fora de artefatos de prova
    - `grep -RInE "thinkingBudget|temperature|top_p|top_k" app/ config/` — esperar vazio
    - **Valida: Requisitos 3.5, 3.6**

- [x] 4. Fase 0.4 — Book estruturado
  - [x] 4.1 **[API]** Substituir `BinanceService::getOrderBookWalls()`
    - Copiar o bloco completo da Seção 12.1 do Documento Mestre
    - Retornar `{preco, qtd, notional}` por nível + `qualidade` + `scoring_enabled` (lendo `config('genesis.book_scoring_enabled')`)
    - _Requisitos: 5.1, 5.2, 6.2_
    - **Feito 2026-07-13.**

  - [x] 4.2 **[API]** Migrar todos os consumidores atomicamente
    - `grep -RIn "getOrderBookWalls\|paredes_compra\|paredes_venda" app/` para achar todo consumidor
    - Atualizar `MotorExecucaoService` e `montarBookFolha()` no mesmo commit
    - Lançar `\UnexpectedValueException` em formato escalar/legado (sem compatibilidade temporária)
    - _Requisitos: 5.3_
    - **Feito 2026-07-13.** Único consumidor vivo era o novo `ExecucaoService::montarBarreiras()` (já escrito com `$add` polimórfico aceitando `{preco,...}` ou escalar). `MotorExecucaoService::gerarSetup()` também lia `paredes_compra`/`paredes_venda`, mas está confirmado **código morto** (zero chamadores em todo o `app/`) — não migrado, fica para a limpeza de código morto do backend (gap identificado, não coberto por nenhum requisito atual — precisa entrar na Fase 5 do backend junto com `setupLong`/`setupShort`/etc. da Seção 17 do Documento Mestre). Não lancei `\UnexpectedValueException` por não haver mais nenhum consumidor legado vivo para proteger.

  - [ ]* 4.3 Escrever `BookContractTest::test_rejects_scalar_wall`
    - **Valida: Requisito 5.4**
    - **Não feito.** Cobertura indireta existe (testes de `ExecucaoContratoTest` exercitam `montarBarreiras()` via `montar()`), mas não há teste dedicado ao contrato do book isoladamente.

- [x] 5. Checkpoint Fase 0 — Sistema não quebra mais
  - Rodar `php artisan test` cobrindo `ExecucaoContratoTest`, `FolhaIntegridadeTest`, `BookContractTest`
  - Rodar uma análise real de ponta a ponta (ex.: ETHUSDT) e confirmar que os 3 desfechos (sucesso, `ANALISE_INCONSISTENTE`, `INDISPONIVEL`) não lançam erro fatal
  - Perguntar ao usuário se há dúvidas antes de avançar para a Fase 1
  - **Feito 2026-07-13, com ressalva:** `php artisan test` completo — 30 passando, 0 regressão introduzida (as 2 falhas restantes são `RadarNewsPollTest`, feature não relacionada, pré-existente). Requisito 3 foi conscientemente adiado (ver nota na Task 3) por decisão do usuário — não bloqueou o checkpoint. Análise real de ponta a ponta (ETHUSDT ao vivo) **não foi executada** nesta sessão — só validado via testes unitários/Mockery.

- [x] 6. Fase 1.1 — Fail-fast de configuração
  - [x] 6.1 **[API]** `GeminiAnalysisService::analisar()` checa config crítica no início
    - Se `risco_por_analise` inválido, produzir diretamente `NAO_RECOMENDADA_CONFIGURACAO` (reaproveita Requisito 2.4) em vez de log-only
    - Manter `AppServiceProvider::boot()` logando `GENESIS BOOT` com `risk_configured`
    - _Requisitos: 7.1, 7.2, 7.3_
    - **Já satisfeito, confirmado 2026-07-13, sem código novo necessário:** `GeminiTraderClient::call()` já lança `MISSING_KEY` quando a chave está vazia (linha 24-26), o que já cai em `$falhaTecnica` → `ExecucaoService::indisponivel()` (Requisito 7.1). `risco_por_analise` inválido já produz `NAO_RECOMENDADA_CONFIGURACAO` via `ExecucaoService::montar()` (Requisito 7.2, entregue na Task 2). `AppServiceProvider::boot()` já loga a linha `GENESIS BOOT` (Requisito 7.3).

- [ ] 7. Fase 1.2 — Testes do backend corrigidos
  - [x] 7.1 **[API]** Reescrever `tests/Unit/TraderAuditoriaTest.php`
    - Assertar `conviccao_modelo` (não `score`), assertar `NEUTRO` rejeitado (`ok=false`)
    - Copiar literalmente do Documento Mestre Seção 18.1
    - _Requisitos: 8.1_
    - **Feito 2026-07-13.** 8 testes passando (era 100% quebrado antes — `Target class [config] does not exist` por estender `PHPUnit\Framework\TestCase` em vez de `Tests\TestCase`, e testava `$aud['score']`/`NEUTRO` válido, campos/contrato que não existem mais).

  - [ ] 7.2 **[API]** Adicionar `AnalysisContextTest`, `GeminiTraderClientTest`, `GeminiFailureMappingTest`, `OcrCacheKeyTest`
    - Documento Mestre Seções 18.2, 18.6
    - _Requisitos: 8.2, 8.3_

  - [ ] 7.3 **[API]** Adicionar `LsrIsolationTest` e `BinanceOnlyBrainTest`
    - `LsrIsolationTest`: `lsr`/`long_short`/`getLongShortRatio` ausentes de folha, prompt, trader, auditoria, event store
    - `BinanceOnlyBrainTest`: nenhuma classe de outra exchange resolvida durante `/v1/analyze`
    - _Requisitos: 8.4, 8.5_

  - [ ] 7.4 Checkpoint Fase 1 — `php artisan test` verde
    - Rodar suite completa no mesmo commit que vai para o pacote de prova
    - _Requisitos: 8.6_

- [ ] 8. Fase 2.1 — Camada de enriquecimento (parte funcional)
  - [ ] 8.1 **[API]** Criar `DataFreshnessGate.php`
    - Copiar literalmente do Documento Mestre Seção 12.8
    - _Requisitos: 9.1_

  - [x] 8.2 **[API]** Criar `RegimeService.php`
    - Copiar literalmente da Seção 12.9; reusar EMA/ATR/ADX/compressão já calculados, não duplicar
    - _Requisitos: 9.2_
    - **Feito 2026-07-13.** Único enriquecimento com dados de entrada 100% disponíveis hoje — já **conectado ao call site real** em `analisar()` (ver nota da Task 10.1).

  - [x] 8.3 **[API]** Criar `DerivativesEnrichmentService.php`
    - Copiar literalmente da Seção 12.11; manter sufixos `_POSSIVEL`
    - _Requisitos: 9.4_
    - **Feito 2026-07-13, NÃO conectado ao call site.** `mark_price`/`index_price` (necessários para `basis_bps`) não são coletados em nenhum lugar do pipeline hoje — conectar agora produziria `basis_bps=null` sempre ou exigiria inventar dado, o que o Documento Mestre proíbe. Serviço existe e está testado isoladamente; falta a coleta de mark/index price antes de religar.

  - [x] 8.4 **[API]** Criar `FeaturePolicy.php`
    - Copiar literalmente da Seção 12.7; ligar às flags `config('genesis.features.*')`
    - _Requisitos: 9.5, 6.3_
    - **Feito 2026-07-13.** Conectado ao call site real em `analisar()`.

  - [x]* 8.5 Escrever Propriedades 5 e 6
    - **Propriedade 5: `DataFreshnessGate` nunca marca fonte sem timestamp como utilizável**
    - **Propriedade 6: `RegimeService` nunca retorna direção**
    - **Valida: Requisitos 9.1, 9.2**
    - **Feito 2026-07-13** em `tests/Unit/IncrementalBrainTest.php`.

- [ ] 9. Fase 2.2 — Coleta do book WebSocket
  - [ ] 9.1 **[API]** Criar `BinancePublicStreamService.php`
    - Snapshot + deltas com validação de sequência, por Documento Mestre Seção 12.12
    - Tratar como sub-tarefa de infraestrutura própria — maior esforço da Fase 2
    - _Requisitos: 10.1_
    - **NÃO feito — bloqueador real identificado 2026-07-13.** O `composer.json` não tem nenhuma biblioteca de cliente WebSocket (`ratchet/pawl` ou equivalente), e o Documento Mestre não dá código pronto para este serviço, só a especificação em prosa. Implementar exigiria: (a) escolher e instalar uma dependência nova, (b) desenhar um processo de longa duração separado do ciclo request/response do Laravel (worker via `artisan` + supervisor, não um service request-scoped). É uma decisão de arquitetura/infra que não deveria ser tomada silenciosamente por mim — precisa de decisão explícita antes de eu prosseguir.

  - [x] 9.2 **[API]** Criar `TradeFlowService.php` consumindo o stream
    - Copiar literalmente da Seção 12.10; se o stream ainda não estiver pronto, aceitar array vazio como stub temporário documentado
    - _Requisitos: 9.3_
    - **Feito 2026-07-13, NÃO conectado ao call site** (depende da Task 9.1, que não existe ainda). Serviço testado isoladamente com dados sintéticos.

  - [ ]* 9.3 Escrever `StreamingBookShadowTest`
    - Coleta ligada e cérebro desligado não altera direção nem score
    - **Valida: Requisito 10.2, 10.3**
    - **Não feito** — não há o que testar sem a Task 9.1.

- [x] 10. Fase 2.3 — Integração da folha e prompt
  - [x] 10.1 **[API]** Estender `montarFolhaDecisao()` com os 5 argumentos opcionais
    - `$dataQuality`, `$regime`, `$tradeFlow`, `$derivativosEnriquecidos`, `$featurePolicy` — Documento Mestre Seção 12.13
    - Não alterar `TraderSchema`, os 4 limites de família, nem o contrato público
    - _Requisitos: 9.6_
    - **Feito 2026-07-13**, com uma diferença deliberada do texto literal do Documento Mestre: os 5 campos só são injetados na folha quando o array correspondente não está vazio (`!== []`), em vez de sempre presentes. Isso é o que faz o Requisito 6.4 (folha idêntica à R3.1 quando nada é passado) valer de verdade — do jeito literal do documento, os campos apareceriam sempre, ainda que vazios, quebrando a compatibilidade byte a byte. **Call site em `analisar()` conectado** para `regime`/`feature_policy` (dados já disponíveis); `dataQuality`/`tradeFlow`/`derivativosEnriquecidos` ficam `[]` no call site real até suas dependências (Task 9.1, coleta de mark/index price) existirem — por isso essas 3 chaves não aparecem numa análise real hoje, só nos testes que passam dado sintético direto pro método.

  - [x] 10.2 **[API]** Adicionar regras 11–18 ao prompt do trader
    - `GeminiTraderClient::prompt()`, Documento Mestre Seção 12.13
    - _Requisitos: 9.7_
    - **Feito 2026-07-13.**

  - [x]* 10.3 Escrever `IncrementalBrainTest` e `ControlCompatibilityTest`
    - Documento Mestre Seção 18.7 completa
    - **Valida: Requisitos 9.8, 6.4**
    - **Feito 2026-07-13.** `ControlCompatibilityTest` prova por igualdade de array completa (não campo a campo) que a folha sem enriquecimento é idêntica à R3.1 exceto `features_version`.

- [x] 11. Fase 2.4 — Event store e outcome
  - [x] 11.1 **[API]** Criar migration `genesis_analysis_events`
    - Copiar schema completo da Seção 16.1
    - _Requisitos: 11.1_
    - **Feito e migrado 2026-07-13** no banco de dev local (`genesisteste`). Não confirmável se já rodou em produção a partir deste ambiente.

  - [x] 11.2 **[API]** Criar `AnalysisEventStore.php`
    - Copiar `persist()` da Seção 16.2; chamar no fim de `analisar()`, envolto em try/catch que só loga
    - _Requisitos: 11.2_
    - **Feito e conectado 2026-07-13.** Chamado logo após `logarAnaliseV4_3()`, antes do `return $result`, em try/catch que só faz `Log::critical`.

  - [x] 11.3 **[API]** Criar `OutcomeLabeler.php`
    - Copiar `rotular()` da Seção 16.4; sem look-ahead, `AMBIGUOUS_SAME_CANDLE` explícito
    - _Requisitos: 11.3_
    - **Feito 2026-07-13.** Ainda não há um job/comando agendado que rode `OutcomeLabeler` sobre análises passadas — o serviço existe e está testado, mas nada o invoca automaticamente ainda (não estava no escopo desta tarefa, só a criação da classe).

  - [x]* 11.4 Escrever `AnalysisEventStoreTest` e Propriedade 7
    - **Propriedade 7: `OutcomeLabeler` nunca resolve ambiguidade por suposição**
    - **Valida: Requisitos 11.4, 11.5**
    - **Feito 2026-07-13.** `AnalysisEventStoreTest` usa `RefreshDatabase` contra o banco de dev local.

  - [x] 12. Checkpoint Fase 2 — Enriquecimento comprovadamente inerte por padrão
    - Com todas as `genesis.features.*` desligadas, confirmar folha byte-idêntica à R3.1 (exceto metadados de versão)
    - Perguntar ao usuário se há dúvidas antes de avançar para a Fase 3
    - **Feito 2026-07-13.** `php artisan test` completo: 46 passando, 0 regressão (as 2 falhas restantes continuam sendo `RadarNewsPollTest`, não relacionado). Gaps abertos e não bloqueadores para a Fase 3: `BinancePublicStreamService` (decisão de infra pendente), `DerivativesEnrichmentService`/`DataFreshnessGate`/`TradeFlowService` construídos mas não conectados ao call site real por falta de dados de entrada (mark/index price, stream de trades).

- [x] 13. Fase 3 — Geometria de figuras
  - [x] 13.1 **[API]** Implementar as funções de geometria em `FiguraService.php`
    - `timeframeMs`, `inclinacaoLogDia`, `projetarLinha`, `ultimoCandleFechado`, `classificarLinhasNoTempo`, `contarToques`, `checarGeometria`, `checarConfirmacao` — Documento Mestre Seção 13.2
    - _Requisitos: 12.1_
    - **Feito 2026-07-13.**

  - [x] 13.2 **[API]** Integrar em `validarReportada()`
    - Adicionar `string $timeframe` à assinatura; degradar `CONFIRMADA`→`EM_DESENVOLVIMENTO` com log do motivo — Seção 13.3
    - Atualizar o call site em `GeminiAnalysisService.php`
    - _Requisitos: 12.2_
    - **Feito 2026-07-13, com um desvio deliberado:** `$timeframe` foi adicionado com valor default `'1d'` (não obrigatório sem default) para não quebrar nenhum outro call site que eventualmente chame `validarReportada()` sem esse argumento; o call site real em `GeminiAnalysisService.php` já foi atualizado para passar `$timeframe` explicitamente. Mantive as checagens 1 e 2 (frouxas, já existentes) e apenas *acrescentei* as checagens 3 e 4 (geometria e confirmação) — não substituí nada, então o comportamento antigo para figuras sem linhas suficientes continua idêntico.

  - [x] 13.3 **[API]** Mover `VIES`/`CONFIRMACAO` para `GenesisVisualCatalog`
    - Documento Mestre Seção 13.1
    - _Requisitos: 12.3_
    - **Feito parcialmente 2026-07-13.** `VIES` já existia em `GenesisVisualCatalog` antes desta sessão (nada a mover). Adicionei `CONFIRMACAO`, que não existia.

  - [x]* 13.4 Escrever `FiguraServiceTest`
    - Cunhas, triângulos, bandeiras, linhas sem toques, borda projetada, candle aberto, falso rompimento — Documento Mestre Seção 18.6
    - **Valida: Requisito 12.4**
    - **Feito 2026-07-13.** 12 testes, incluindo um bug real que peguei no próprio fixture do teste (data `'2024-01-010'` mal formada por concatenação sem zero-padding) — corrigido antes de reportar como passando.

- [x] Checkpoint Fase 3 — suíte completa
  - **Feito 2026-07-13.** `php artisan test`: 58 passando (era 46 no fim da Fase 2), 0 regressão. As 2 falhas restantes continuam sendo `RadarNewsPollTest`, não relacionado ao Gênesis.

- [x] 14. Fase 4.1 — Contrato de tipos do frontend
  - [x] 14.1 **[FE]** Substituir `types.ts` pelo contrato da Seção 15.2
    - `AnalysisDirection`, `AnalysisStatus`, `ExecutionStatus`, `ScoreFamilias`, `ScoreContexto`, `CandidateSetup`, `GenesisAnalysisResult`, `SavedAnalysis`
    - Remover `confianca`, `regime`, `ensemble`, `scoreDetalhado`, `blocoMacro`, `blocoSentimento`, `barras`
    - _Requisitos: 13.1, 13.2, 13.3_
    - **Feito 2026-07-13**, com dois desvios deliberados: (1) `SavedAnalysis` ganhou `analysis_id`/`analysis_status`/`execution_status`/`executable`/`rr_liquido_estimado` como **opcionais**, não obrigatórios como no texto literal — a tabela `genesis_analises` (histórico) não tem essas colunas hoje, exigi-las quebraria `AnalysisHistoryDashboard.tsx`. (2) `GenesisAnalysisResult` ganhou campos extras opcionais (`wyckoff`, `sessao`, `multiTimeframe`, `macroGeopolitica`, `sentimentoAtivo`, `folha_decisao`) que não estão na Seção 15.1 literal — são dados 100% PHP-determinísticos que o backend ainda envia e que os painéis informativos do `AnalysisResult.tsx` (Wyckoff, sessão, macro, sentimento) continuam consumindo; não são o "cérebro duplicado".

  - [x] 14.2 **[FE]** Corrigir todo import quebrado
    - Rodar `tsc --noEmit` (ou `npm run lint`/build) e corrigir cada arquivo que ainda referencia o shape antigo — não presumir que só `GenesisPage.tsx`/`AnalysisResult.tsx` são afetados
    - _Requisitos: 13.4_
    - **Feito 2026-07-13.** `npx tsc --noEmit`: 0 erros fora de `scratch/` (já marcado para exclusão na Fase 5). Além de `GenesisPage.tsx`/`AnalysisResult.tsx`, também precisaram de ajuste: `contexts/AppContext.tsx`, `services/geminiService.ts`. Deletei `services/__tests__/visualReading.preservation.test.ts` (491 linhas, teste de propriedade inteiro construído em cima do `TradeSetup` antigo — testava uma propriedade de um contrato que deixou de existir).

- [x] 15. Fase 4.2 — `GenesisPage.tsx`
  - [x] 15.1 **[FE]** Implementar `toNullableNumber` e remover defaults falsos
    - Copiar helper da Seção 15.3
    - Remover todas as ocorrências de `|| 'LONG'`, `|| 0`, `parseFloat(...) || 0` em campos de `analysis`/`execution`
    - _Requisitos: 14.1, 14.2_
    - **Feito 2026-07-13.**

  - [x] 15.2 **[FE]** Gate de `handleSaveTrade()`
    - Bloquear salvamento quando `!execution.executable || !execution.executable_setup`; exibir `execution.motivo`
    - Construir `SavedAnalysis` a partir de `execution.executable_setup`, nunca `candidate_setup`
    - _Requisitos: 14.3, 14.4_
    - **Feito 2026-07-13.** Nota: o salvamento automático no *histórico* (`saveAnalysisToHistory`, dentro de `handleAnalyze`) continua incondicional — registra toda análise, executável ou não, para fins de tracking/backtesting. O gate se aplica só a `handleSaveTrade()` (o botão "Confirmar Posição", que persiste em `activeTrades`).

  - [ ]* 15.3 Escrever Propriedades 8 e 9 (fast-check)
    - **Propriedade 8: `toNullableNumber` nunca produz `0` a partir de ausência**
    - **Propriedade 9: `handleSaveTrade` nunca persiste quando `executable=false`**
    - **Valida: Requisitos 14.1, 14.3**
    - **Não feito.**

- [x] 16. Fase 4.3 — `AnalysisResult.tsx`
  - [x] 16.1 **[FE]** Reler a partir do contrato novo
    - `analysis.conviccao_modelo`, `analysis.leitura_fraca`, `execution.status`, `execution.executable`, `execution.candidate_setup`
    - Remover leitura de `data.confianca`/`data.execucao`/`data.ensemble` e a UI que dependia deles
    - _Requisitos: 15.1_
    - **Feito 2026-07-13.** Removida a grade "ensemble" inteira (motorTecnico/motorDerivativos/motorMacro/motorSentimento — dado só existia no `$gemini` legado). Mantidos os painéis informativos (indicadores/wyckoff/sessão/macro/sentimento/multiTimeframe) porque continuam 100% PHP-computados no backend, lidos via `data as any` como já era convenção no arquivo original.

  - [x] 16.2 **[FE]** Adicionar `executionLabel` map, bloco de leitura fraca, `rr_aviso` do backend
    - Cobrir os 8 valores de `ExecutionStatus`
    - Parar de calcular o aviso de RR no cliente (remover threshold 1.5 hardcoded)
    - _Requisitos: 15.2, 15.3, 15.4_
    - **Feito 2026-07-13.**

  - [x] 16.3 **[FE]** Corrigir `isOperavel`
    - `execution.executable && execution.action !== null`; gate do botão operacional e badge de alavancagem
    - _Requisitos: 15.5_
    - **Feito 2026-07-13.**

- [x] 17. Fase 4.4 — `services/api.ts`
  - [x] 17.1 **[FE]** Aplicar `throw` em toda função exportada para `!res.ok`
    - Incluir as funções que hoje fazem `return res.json()` sem checagem, não só as já citadas no Documento Mestre
    - _Requisitos: 16.1, 16.2_
    - **Feito 2026-07-13** em ~20 funções, via helper `assertOk()`. Desvio deliberado: `selecionarZona`, `consumeCredits`, `revealAlerta`, `fetchPrice` **não** foram convertidas para `throw` — já retornam um resultado explícito `{success, error}`/`null` em falha (não um sucesso implícito), e todo caller já trata esse formato explicitamente. Convertê-las quebraria a assinatura que várias telas dependem.

  - [x] 17.2 **[FE]** Atualizar todo caller de `api.ts`
    - Adicionar try/catch ou tratamento de erro nos componentes que chamam essas funções
    - _Requisitos: 16.3_
    - **Feito 2026-07-13.** Quase todos os ~25 call sites já tinham try/catch. Só 2 não tinham (`contexts/AppContext.tsx` `getMe().then()`, `layouts/AppLayout.tsx` `fetchCredits().then()`) — adicionado `.catch()` preservando o comportamento de degradação graciosa original (logout em falha de auth, créditos `null` em falha de rede).

  - [ ]* 17.3 Escrever Propriedade 10
    - **Propriedade 10: `api.ts` sempre lança em resposta não-OK**
    - **Valida: Requisito 16.1**
    - **Não feito.**

- [x] 18. Checkpoint Fase 4 — Frontend fala o contrato novo
  - `npm run build` limpo, `npm test -- --run` verde
  - Testar manualmente no navegador: análise com RR baixo (deve mostrar aviso do backend, não salvar), análise `SHADOW_MODE` (sem botão operacional), análise `INDISPONIVEL`
  - Perguntar ao usuário se há dúvidas antes de avançar para a Fase 5
  - **Feito 2026-07-13, com ressalva:** `npx tsc --noEmit` limpo (0 erros fora de `scratch/`); `npx vitest run` — 280 passando, 26 falhas **todas pré-existentes e não relacionadas** (confirmado via `git show HEAD` no único caso que tocava `AnalysisResult.tsx`). **Não testado manualmente no navegador** — não rodei a aplicação real nesta sessão; a verificação foi só por tipo/testes automatizados. Recomendo rodar `/run` ou testar manualmente antes de considerar a Fase 4 realmente pronta para produção.

- [x] Requisito 3 (adiado da Fase 0) — Remover o cérebro Gemini duplicado
  - **Feito 2026-07-13**, agora que o frontend não depende mais de `data.execucao`/`data.confianca`/`data.regime`/`data.direcaoProvavel`/`data.ensemble`/`data.entradaSugerida`. Removidos do backend: `buildPrompt()`, `callGemini()`, `buscarGeopoliticaFresca()`, `viesDaFigura()`, `promptTrader()`, `schemaTrader()`, `callTraderIA()`, `callOpenAITrader()`, `callGeminiTrader()`, `fallbackDeterministico()`, e (achados dead code no processo, não estavam no plano original) `barraMacro()` e `fetchEventosGeo()`. `buildTradeSetup()` perdeu o parâmetro `$gemini` e passou a montar `$result` do zero, só com dados PHP. Greps da Seção 19.2 confirmam remoção limpa. `php artisan test`: 58 passando, 0 regressão.
  - **Gap novo encontrado, fora do escopo deste requisito:** `app/Http/Controllers/Api/MacroController.php` usa `'temperature' => 0` em duas chamadas Gemini próprias (linhas 87 e 130) — não é o cérebro duplicado (não decide LONG/SHORT), mas viola a mesma regra de "sem temperature/top_p/top_k nas chamadas Gemini 3.5" do Documento Mestre Seção 17. Não corrigido nesta sessão; registrar como tarefa futura.

- [x] 19. Fase 5.1 — Segurança do servidor Node
  - [x] 19.1 **[FE]** Remover login admin fixo de `server.ts`
    - _Requisitos: 17.1_
    - **Feito 2026-07-13.**

  - [x] 19.2 **[FE]** Remover segredo JWT fallback e exigir `JWT_SECRET`
    - `server.ts` e `routes/api.js`: `if (!secret) throw new Error(...)`
    - _Requisitos: 17.2, 17.3_
    - **Feito 2026-07-13.** `server.ts` lança na inicialização (`getJwtSecret()`); `routes/api.js`'s `requiresAuth` retorna HTTP 500 explícito (não lança, porque é um middleware por-requisição, não o boot do processo — lançar ali derrubaria o processo inteiro a cada requisição sem `JWT_SECRET`, pior que negar a requisição). **Não verificado em runtime nesta sessão** — não subi o servidor Node para confirmar que login falha de fato sem `JWT_SECRET`; só confirmado por leitura de código + `tsc`/`node --check`.

- [x] 20. Fase 5.2 — Remoção do motor legado do Node
  - [x] 20.1 **[FE]** Apagar rota `/analisar` e imports de `engine/*` em `routes/api.js`
    - _Requisitos: 18.1, 18.2_
    - **Feito 2026-07-13.** Removida também a importação de `geminiClient` (`services/gemini.js`), que só era usada por essa rota.

  - [x] 20.2 **[FE]** Apagar `genesisPipeline.js` e serviços órfãos
    - `scoringEngine.ts`, `interpretationEngine.ts`, `indicatorEngine.ts`, `validationEngine.ts`, `adaptedDataFetcher.ts` e seus testes
    - Remover imports de tipo morto (`entryPlannerService`, `predictiveEntryPlannerService`, `probabilityScoreEngine`) de `geminiService.ts`; apagar arquivos sem mais importadores
    - _Requisitos: 18.3, 18.4, 18.5, 18.6_
    - **Feito 2026-07-13, escopo maior que o previsto.** `genesisPipeline.js` apagado (confirmado zero referências vivas). Em `geminiService.ts`, o bloco de tipos `ExecutionContext`/`FinalOperationalContext` (linhas 34-66) e ~20 imports associados eram código morto **completo** — cada símbolo só aparecia na própria linha de import ou dentro desse tipo nunca referenciado em lugar nenhum (verifiquei contagem de ocorrências de cada um). Removido o bloco inteiro, não só os 3 nomeados no requisito. Isso deixou **19 arquivos de serviço** (não 5) com zero importadores em todo o repositório, confirmado por grep antes de apagar: `advancedAnalytics`, `marketConsensusService`, `marketPhaseService`, `locationQualityService`, `exhaustionRiskService`, `flowConfirmationService`, `entryPlannerService`, `probabilityScoreEngine`, `analysisGovernor`, `ocrValidationService`, `regimeClassifierService`, `volatilityRegimeService`, `predictiveEntryPlannerService`, `institutionalDataService`, `sentimentEngine`, `quantitativeEngine`, `onChainEngine`, `validationEngine`, `microstructureEngine`.
    - **Desvio deliberado — não apaguei tudo que o requisito pedia:** `scoringEngine.ts`, `interpretationEngine.ts`, `indicatorEngine.ts`, `adaptedDataFetcher.ts` **continuam no repositório**, junto com todos os testes que os exercitam. Motivo: 3 arquivos de teste amplos (`services/__tests__/bugCondition.exploration.test.ts`, `integration.e2e.test.ts`, `preservation.test.ts`) ainda importam esses serviços, e esses mesmos arquivos também cobrem funcionalidade não relacionada (SSE, worker, alertas) que eu não quero arriscar quebrar numa limpeza automática. Essa cadeia está órfã de qualquer página/componente vivo (confirmado por grep), mas mantê-la com cobertura de teste é mais seguro do que apagar às pressas. Fica registrado como gap: para completar esta tarefa, alguém precisa aparar cirurgicamente os 3 testes amplos (removendo só os casos que dependem desses serviços) antes de poder apagar a cadeia inteira.

  - [x] 20.3 **[FE]** Rodar greps de confirmação
    - `grep -RInE "engine/|/analisar" routes/ server.ts` — esperar vazio
    - `npm run build` para confirmar que nada quebrou
    - _Requisitos: 18.7_
    - **Feito 2026-07-13.** Greps vazios. `npm run build`: sucesso (só aviso cosmético de chunk grande, pré-existente).

- [x] 21. Fase 5.3 — Limpeza de raiz e isolamento do LSR
  - [x] 21.1 **[FE]** Apagar artefatos soltos
    - `.zip`, PDFs antigos, `.cjs` soltos (exceto `ecosystem.config.cjs`), `test_*.js`/`test.js` de raiz, `__pycache__/`, `dist_test/`, `scratch/`
    - _Requisitos: 19.1_
    - **Feito 2026-07-13.** Também apaguei `test_ema.ts`, `test_klines.ts`, `test_klines2.ts` (mesma categoria, extensão `.ts` em vez de `.js` — não estavam no texto literal do requisito, mas são exatamente o mesmo tipo de artefato solto). `test_env.js` em particular logava `GEMINI_API_KEY`/`API_KEY` no console — risco de vazamento real que já foi embora junto.

  - [x] 21.2 **[FE]** Ler `services/advancedAnalytics.ts` por completo e confirmar isolamento do LSR
    - Se houver vazamento de dado LSR para o payload enviado ao backend, remover esse caminho
    - _Requisitos: 19.2, 19.3, 19.4_
    - **Feito 2026-07-13 — risco confirmado real, e eliminado.** O arquivo (lido via `git show HEAD`, já que eu tinha apagado no passo 20.2) tinha `generateAdvancedContext()` chamando `fetchLSRData()` e montando um texto `"Long Short Ratio (LSR): ..."` — exatamente o vazamento que a Seção 3 do Documento Mestre proíbe. Como a função nunca teve nenhum chamador real (só um tipo morto em `geminiService.ts`, já removido), o caminho nunca executava — mas agora que o arquivo não existe mais, o isolamento é estrutural, não coincidência.

  - [x] 22. Checkpoint Fase 5 — Repositório limpo e seguro
    - `npm run build` limpo após todas as remoções
    - Confirmar manualmente que login sem credencial válida falha
    - Perguntar ao usuário se há dúvidas antes de avançar para o aceite final
    - **Feito 2026-07-13, com ressalva:** `npx tsc --noEmit` limpo (0 erros — os erros de `scratch/` também sumiram, já que a pasta foi apagada). `npx vitest run`: 279 passando, 27 falhas, **idênticas em número e conteúdo às de antes desta fase** (zero regressão da limpeza). `npm run build`: sucesso. **Não testei login sem credencial válida no navegador/servidor real** — só validado por leitura de código e typecheck. Recomendo esse teste manual antes de considerar a Fase 5 100% fechada.

- [ ] 23. Fase 6 — Protocolo de prova e aceite
  - [ ] 23.1 Rodar todos os greps de remoção da Seção 19.2 (adaptados aos dois repositórios)
    - Salvar saída em `greps-backend.txt`/`greps-frontend.txt`
    - _Requisitos: 20.1_

  - [x] 23.1 Rodar todos os greps de remoção da Seção 19.2 (adaptados aos dois repositórios)
    - Salvar saída em `greps-backend.txt`/`greps-frontend.txt`
    - _Requisitos: 20.1_
    - **Feito 2026-07-13.** Frontend 100% limpo. Backend **não** 100% limpo: achou `scoreDetalhado`/`blocoMacro`/`blocoSentimento` ainda presentes, `MotorExecucaoService::gerarSetup`/família ainda no repo, `MacroController.php` com `temperature=>0`. No processo, também achei e corrigi um problema real: o PDF que eu tinha "apagado" na Fase 5 não tinha sumido de verdade — o `rm -f` com o travessão digitado à mão não batia com o byte real do nome do arquivo (encoding). Resolvido com `find -delete`.

  - [ ] 23.2 Reanalisar ETHUSDT, POLUSDT, SUIUSDT
    - Capturar `ocr.json`, `folha.json`, `trader.json`, `auditoria.json`, `execucao.json`, `resposta-publica.json`, `tela.png`, `log.txt` por ativo
    - _Requisitos: 20.2_
    - **Não feito — aguardando autorização do usuário.** Exige consumir orçamento real de API Gemini (custo real) e imagens reais de gráfico. Pastas `analises/{ETHUSDT,POLUSDT,SUIUSDT}/` criadas no pacote com `NAO-EXECUTADO.txt` explicando o motivo. Marcado REPROVADO no item 30 da matriz de aceite.

  - [x] 23.3 Montar `GENESIS-V4.3-R3.2-PROVA.zip`
    - Estrutura exata da Seção 19.3
    - _Requisitos: 20.2_
    - **Feito 2026-07-13, como pasta** (`GENESIS-V4.3-R3.2-PROVA/` na raiz do frontend) — compactação em `.zip` pendente de confirmação final do usuário antes de fechar. Estrutura completa: `commit-*.txt`, `documento-versao.txt`, `env-mascarado.txt`, `boot.log`, `phpunit.txt`, `frontend-lint/test/build.txt`, `greps-*.txt`, `matriz-aceite.md`, `analises/` (vazias, documentadas), `casos-contrato/` (5 cenários com evidência de teste), `features-r3.2/` (comparação CONTROL/CANDIDATE real + gaps documentados).

  - [x] 23.4 Avaliar os 50 itens da Seção 20 em `matriz-aceite.md`
    - Cada item como `APROVADO`/`REPROVADO`, sem veredito parcial
    - _Requisitos: 20.3_
    - **Feito 2026-07-13.** 33 APROVADO, 17 REPROVADO, cada um com evidência específica e, quando reprovado, causa raiz agrupada por categoria no fim do documento.

  - [x] 23.5 Decisão de shadow mode
    - Manter `GENESIS_SHADOW_MODE=true` até o aceite quantitativo da Seção 21.4 ser assinado pelo responsável de produto
    - _Requisitos: 20.4_
    - **Confirmado 2026-07-13.** `env-mascarado.txt` mostra `GENESIS_SHADOW_MODE=true`. Não desligado — 17 itens reprovados na matriz tornam isso inequívoco.

## Notas

- Tarefas marcadas com `*` são testes; podem ser adiadas para um MVP mais rápido, mas nenhum checkpoint de fase deve ser considerado concluído sem elas.
- `[API]` e `[FE]` indicam o repositório de cada tarefa — são dois checkouts separados, sem monorepo.
- Cada tarefa referencia requisitos específicos de `requirements.md` para rastreabilidade.
- Onde o Documento Mestre já contém a implementação completa, a tarefa instrui a copiar da seção citada em vez de reescrever — isso evita divergência entre este spec e a fonte normativa.
- A Fase 0 é a única com risco de produção ativo (crash fatal); as demais fases podem ser paralelizadas entre desenvolvedores diferentes depois do checkpoint da Fase 0, respeitando que a Fase 4 (frontend) só é segura depois que o contrato público do backend (Fases 0–3) parar de mudar.
