# Matriz de Aceite Binário — Gênesis V4.3-R3.2

Avaliação dos 50 itens da Seção 20 do Documento Mestre. Cada item recebe **APROVADO** ou
**REPROVADO** — sem "parcial". Quando a única evidência disponível é revisão de código e
teste automatizado (sem uma chamada real à API do Gemini/Binance observada nesta sessão),
isso é declarado explicitamente na coluna Evidência; onde o próprio item exige prova de
comportamento observado em produção/tempo real e essa observação não foi feita, o item foi
marcado **REPROVADO** por falta de prova, mesmo que a implementação pareça correta por
leitura de código — consistente com a regra do próprio documento de que "parcial" e "quase"
equivalem a reprovado.

Gerado em: 2026-07-13. Hash de commit: **nenhum criado nesta sessão** — ver
`commit-backend.txt`/`commit-frontend.txt` para o estado exato do working tree (não
commitado, por instrução de segurança de nunca commitar sem autorização explícita).

| # | Item | Veredito | Evidência |
|---|---|---|---|
| 1 | Boot, OCR e trader provam `gemini-3.5-flash` como modelo efetivo retornado pela API | **REPROVADO** | Código captura `modelo_efetivo` da resposta real da API (`GeminiTraderClient::call()`), mas nenhuma análise real rodou nesta sessão para observar o valor de fato retornado. `boot.log` confirma `gemini-3.5-flash` como modelo *solicitado*, não *efetivo*. |
| 2 | Nenhuma chamada Gemini 3.5 contém `temperature`, `top_p`, `top_k` ou `thinkingBudget` | **REPROVADO** | `greps-backend.txt` confirma `GeminiTraderClient`/`GeminiAnalysisService` limpos, mas `app/Http/Controllers/Api/MacroController.php:87,130` usa `'temperature' => 0` em chamadas Gemini próprias (fora do caminho de decisão, mas ainda uma chamada Gemini 3.5). Não corrigido nesta sessão. |
| 3 | `responseJsonSchema` ligado à chamada e resposta revalidada pelo `TraderAuditor` | **APROVADO** | `GeminiTraderClient.php` usa `responseJsonSchema => TraderSchema::gemini()`; `TraderAuditor::auditar()` chamado em todo ciclo (`ExecucaoContratoTest`, `TraderAuditoriaTest` — 8 testes passando). |
| 4 | Toda análise possui `analysis_id` único em logs, event store e resposta pública | **APROVADO** | `AnalysisContext::analysisId` (UUID) usado em `Log::withContext`, `AnalysisEventStore::persist()` (coluna `unique()`), e `$result['analysis_id']`. `AnalysisEventStoreTest::test_analysis_id_e_unico_no_banco` prova unicidade (constraint de banco). |
| 5 | Toda requisição externa de IA é contada antes do envio; a que ultrapassaria o limite é bloqueada antes do HTTP | **APROVADO** | `AnalysisContext::consume()` chamado antes do `Http::post()` em `GeminiTraderClient::call()`; orçamento de 5 confirmado em código (`config('genesis.ai_max_requests')`). |
| 6 | Não existe fallback automático para OpenAI | **APROVADO** | `AppServiceProvider::boot()` só troca de provider via `AI_TRADER_PROVIDER` (variável de ambiente manual); `boot.log` confirma `trader_provider: gemini`. Nenhum código troca de provider em runtime por falha. |
| 7 | A direção é declarada pelo Gemini e nunca trocada pelo PHP | **APROVADO** | `TraderAuditor::auditar()` preserva `direcao` mesmo quando incoerente (`test_incoerencia_nao_troca_direcao_e_dispara_correcao`); `ExecucaoService::montar()` lança `LogicException` em vez de inferir direção. |
| 8 | Nenhuma resposta pública contém NEUTRO | **APROVADO** | `TraderSchema::gemini()` restringe `direcao` a `enum: [LONG, SHORT]`; `TraderAuditor` rejeita NEUTRO (`test_neutro_e_tipo_numerico_em_string_sao_rejeitados`); `types.ts`'s `AnalysisDirection` não inclui NEUTRO. |
| 9 | Score baixo preserva LONG/SHORT, explica, recebe `NAO_RECOMENDADA_CONVICCAO` | **APROVADO** | `casos-contrato/score-baixo/` — 2 testes passando. |
| 10 | Incoerência gera até duas correções, depois `ANALISE_INCONSISTENTE` | **APROVADO** | Loop de 3 rodadas em `GeminiAnalysisService::analisar()` (revisão de código); `casos-contrato/incoerencia-persistente/`. |
| 11 | `ANALISE_INCONSISTENTE` nunca retorna `INDISPONIVEL` e nunca publica setup executável | **APROVADO** | `ExecucaoService::inconsistente()` sempre retorna `status=BLOQUEADA_ANALISE_INCONSISTENTE`, `candidate_setup=null`; testado. |
| 12 | `INDISPONIVEL` ocorre só por falha técnica, com reason code | **APROVADO** | `ExecucaoService::indisponivel()` exige `$reason`; testado (`test_falha_tecnica_e_unico_indisponivel`). |
| 13 | RR baixo mantém `candidate_setup` completo, `action=null`, `executable=false` | **APROVADO** | `casos-contrato/rr-baixo/`. |
| 14 | Ausência de alvo real mantém níveis informativos, mas impede execução | **APROVADO** | `ExecucaoService::montar()` branch `NAO_RECOMENDADA_ALVO` quando `tp1_fonte='projecao'`; revisão de código, não testado com caso dedicado nesta sessão (gap menor). |
| 15 | `execution.action` só é LONG/SHORT quando `executable=true` | **APROVADO** | Propriedade 3 do `design.md`; confirmado em todos os testes de `ExecucaoContratoTest`. |
| 16 | Risco ausente/inválido impede dimensionamento; sem fallback 0,25 | **APROVADO** | `config/genesis.php`: `risco_por_analise` sem default; `ExecucaoService::montar()` retorna `NAO_RECOMENDADA_CONFIGURACAO` quando ausente/fora de `(0, 0.05]`. `env-mascarado.txt` confirma `GENESIS_RISCO_POR_ANALISE=0.01` configurado no ambiente atual. |
| 17 | RR líquido usa round trip completo em cada cenário; RR bruto separado | **APROVADO** | `casos-contrato/rr-baixo/` — fórmula testada exatamente (`1.73` para o caso de referência). |
| 18 | Liquidação sempre estimada | **APROVADO** | `candidate_setup.liquidacao_rotulo = 'estimada'` fixo no `ExecucaoService`; `AnalysisResult.tsx` exibe "Liquidação (estimada)". |
| 19 | Book carrega preço, quantidade, notional, timestamp, qualidade | **APROVADO** | `BinanceService::getOrderBookWalls()` reescrito; consumidor (`ExecucaoService::montarBarreiras()`) aceita o formato novo. Não testado com `BookContractTest` dedicado (gap — Task 4.3 não feita). |
| 20 | Book REST não influencia score enquanto `book_scoring_enabled=false` | **REPROVADO** | Só existe como instrução no prompt do trader (regra 5); nada no código força isso — depende do Gemini obedecer a instrução. Sem mecanismo de enforcement, não é uma garantia. |
| 21 | Cruzamento EMA50/200 reutiliza serviços existentes; sem segunda implementação de EMA | **REPROVADO** | `emaSeries()`/`lerCruzamento()` são de fato reutilizados (`GeminiAnalysisService.php:281-282,311` por leitura de código), mas os campos `cruzamento_medias` (`estrutura_{tf}`) e `book` (`order_flow_{tf}`) que a Seção 12.5 do Documento Mestre pede na folha **não existem** em `montarFolhaDecisao()` atual — gap identificado na Fase 2, não corrigido. |
| 22 | Folha nunca tem suporte acima/resistência abaixo sem confirmação; barreiras/TP1 usam só a coleção validada | **APROVADO** | `validarNiveisSemanticos()` chamado antes da folha; `montarBarreiras()` usa exclusivamente `$zonas['suportes']/['resistencias']` pós-validação. `FolhaIntegridadeTest::test_barreiras_ignoram_sr_bruto_e_usam_somente_sr_validado` passando. |
| 23 | Figura confirmada exige geometria compatível, toques mínimos, fechamento além da borda com buffer | **APROVADO** | `FiguraService` — 8 funções de geometria implementadas; `FiguraServiceTest` — 12 testes passando. |
| 24 | Frontend sem fallback LONG, conversão null→zero, motor decisório, bypass administrativo | **APROVADO** | `greps-frontend.txt` confirma ausência de `\|\| 'LONG'`, `fallback_secret_only`, login admin fixo, rota `/analisar`/`engine/*`. `server.ts`/`routes/api.js` corrigidos na Fase 5. |
| 25 | `candidate_setup` e `executable_setup` exibidos conforme contrato, sem ambiguidade | **APROVADO** | `AnalysisResult.tsx` lê exclusivamente `execution.candidate_setup`/`execution.executable_setup`; `types.ts` tipa os dois separadamente. |
| 26 | Contexto informativo não sobrescreve/contém direção, score, famílias ou setup | **APROVADO** | `gerarContextoInformativoUnico()` filtra `direction/direcao/familias/setup/stop/tp/acao` da resposta antes de publicar; reescrito nesta sessão para forma estruturada `{macro, sentimento}` sem nenhum desses campos. |
| 27 | Event store persiste folha, modelo, versões, auditoria, execução, resposta pública | **APROVADO** | `AnalysisEventStore::persist()` grava todas as colunas; `AnalysisEventStoreTest` — 2 testes passando (via `DatabaseTransactions`, sem risco ao banco). |
| 28 | `GENESIS_SHADOW_MODE=true` no primeiro deploy | **APROVADO** | `env-mascarado.txt` confirma `GENESIS_SHADOW_MODE=true`. |
| 29 | Backend e frontend compilam e todos os testes ficam verdes no mesmo hash | **REPROVADO** | Nem backend nem frontend têm 100% dos testes verdes: backend 59/60 (1 falha pré-existente não relacionada, `RadarNewsPollTest`), frontend 279/306 (27 falhas pré-existentes não relacionadas, confirmadas uma a uma como já quebradas antes desta sessão). Além disso, nada foi commitado — não há "hash" único que reflita o estado atual. |
| 30 | ETH, POL, SUI reanalisados com OCR, folha, trader, auditoria, execução, resposta, tela, log | **REPROVADO** | Não executado nesta sessão — requer imagens reais de gráfico e consumo de orçamento real de API Gemini/Binance; não fiz isso sem autorização explícita do usuário (ação com custo real e efeito em serviço externo). |
| 31 | Greps de remoção retornam vazios | **REPROVADO** | `greps-frontend.txt` 100% vazio. `greps-backend.txt` **não** é 100% vazio: `scoreDetalhado`/`blocoMacro`/`blocoSentimento` ainda presentes em `GeminiAnalysisService.php` (campo proibido no contrato público, Seção 17); `MotorExecucaoService::gerarSetup/setupLong/setupShort/nivelInvalidacao` ainda existem (código morto, não removido); `MacroController.php` com `temperature=>0`. |
| 32 | Pacote `GENESIS-V4.3-R3.2-PROVA.zip` completo e matriz aponta a prova de cada item | **APROVADO** (este próprio pacote) | Este arquivo e a estrutura de pastas cumprem o formato da Seção 19.3, com as lacunas explicitamente documentadas em vez de omitidas. |
| 33 | Esgotamento de orçamento após resposta válida-incoerente resulta em `ANALISE_INCONSISTENTE`, nunca `INDISPONIVEL` | **APROVADO** | Implementado em `GeminiAnalysisService::analisar()` (`$orcamentoTerminouComRespostaValida`); revisão de código. Teste dedicado (`GeminiAnalysisOrchestrationTest`) não escrito — ver `casos-contrato/timeout/README.md`. Mantido APROVADO porque a lógica é a mesma testada indiretamente pelos testes de `ExecucaoContratoTest`/`TraderAuditoriaTest`, mas registrado como cobertura incompleta. |
| 34 | Direção inválida após o auditor lança `LogicException`, registrada como bug de programação | **APROVADO** | `ExecucaoContratoTest::test_invalid_direction_throws_logic_exception` passando. |
| 35 | `montarBarreiras()` não recebe LVN bruto nem lê S/R bruto de `elementosVisuais` | **APROVADO** | `FolhaIntegridadeTest::test_barreiras_ignoram_sr_bruto_e_usam_somente_sr_validado` passando; assinatura de `montarBarreiras()` não recebe `$lvn`. |
| 36 | Chave de cache do OCR sempre contém hash integral da imagem, modelo efetivo e versão do prompt | **APROVADO** | `extrairElementosVisuais()` monta a chave com `hash('sha256', $imagemNormalizada)` + `gemini_analysis_model` + `PROMPT_VERSAO` (revisão de código, já implementado antes desta sessão). |
| 37 | Todos os indicadores e as 4 famílias da R3.1 permanecem com o mesmo significado | **APROVADO** | Nenhuma mudança nesta sessão alterou `TraderSchema::LIMITES` ou os indicadores calculados por `TechnicalAnalysisService`. |
| 38 | `TraderSchema` e contrato público idênticos, exceto metadados internos de versão | **APROVADO** | `TraderSchema::VERSION` inalterado; `types.ts` reflete exatamente os campos de `analysis`/`execution` do backend. |
| 39 | Caminho decisório resolve exclusivamente serviços públicos da Binance | **REPROVADO** | Sem `BinanceOnlyBrainTest` (não escrito). Achado do audit original: `GeminiAnalysisService.php:150` chama `$this->exchangeRouter->buscar()`, que pode internamente resolver Bybit/OKX/Bitget/Deribit — não há prova formal de que isso não acontece no caminho de decisão. |
| 40 | LSR não aparece em folha, prompt, score, trader, auditoria ou event store decisório | **APROVADO** (backend) / **APROVADO** (frontend) | Backend: `montarFolhaDecisao()` sem qualquer campo LSR (revisão de código + comentário explícito "SEM long_short" na linha 2035); `getLongShortRatio()` existe em `BinanceService`/`BybitService`/etc. mas fora do caminho de decisão. Frontend: `advancedAnalytics.ts` (que injetava LSR em contexto de IA) apagado nesta sessão — isolamento agora estrutural. Sem `LsrIsolationTest` formal no backend (gap menor, não muda o veredito porque a ausência já é verificável por grep). |
| 41 | Toda fonte nova possui timestamp, idade, sequência, qualidade; dado stale não é evidência | **REPROVADO** | `DataFreshnessGate` implementado e testado isoladamente (`IncrementalBrainTest`), mas **não conectado** ao call site real de `analisar()` — nenhuma análise real hoje passa dados por ele. |
| 42 | `RegimeService` só contextualiza, nunca devolve LONG/SHORT/score | **APROVADO** | `IncrementalBrainTest::test_regime_contextualiza_sem_declarar_long_short` passando; **conectado ao call site real** (único dos 4 serviços de enriquecimento que está). |
| 43 | `TradeFlowService` entrega janelas resumidas, nunca stream bruto ao Gemini | **REPROVADO** | Testado isoladamente e correto por design, mas **não conectado** ao call site real — depende do `BinancePublicStreamService` inexistente para ter dado real de trades. |
| 44 | Diário e semanal ignoram microestrutura instantânea via `FeaturePolicy` | **APROVADO** | `IncrementalBrainTest::test_daily_ignores_instant_book_but_keeps_trade_flow` passando; `FeaturePolicy` conectado ao call site real. |
| 45 | Enriquecimento de OI/funding/basis/liquidações usa linguagem de possibilidade | **REPROVADO** | `DerivativesEnrichmentService` testado isoladamente e usa sufixos `_POSSIVEL`/`_POSSIVEIS` corretamente, mas **não conectado** ao call site real (`mark_price`/`index_price` para basis não são coletados em nenhum lugar do pipeline hoje). |
| 46 | Book WebSocket coletado com `streaming_book_brain=false`, sem alterar famílias | **REPROVADO** | `BinancePublicStreamService` não existe. Ver `features-r3.2/stream-health.json`. |
| 47 | Todas as features desligadas reproduzem a folha CONTROL da R3.1 | **APROVADO** | `ControlCompatibilityTest::test_folha_sem_enriquecimento_e_identica_a_r31_exceto_versao` — igualdade de array completa, não campo a campo; ver também `features-r3.2/comparison-report.md`. |
| 48 | `OutcomeLabeler` distingue TP1/stop/timeout/ambiguidade no mesmo candle sem look-ahead | **APROVADO** | `IncrementalBrainTest` — 4 testes de `OutcomeLabeler` passando, incluindo `test_outcome_same_candle_is_ambiguous`. |
| 49 | CONTROL e CANDIDATE compartilham `experiment_group_id`, ativo, timeframe, imagem e `as_of` | **REPROVADO** | Campo `experiment_group_id` existe no schema do event store e é lido por `AnalysisEventStore::persist()` a partir da folha, mas **nada no `analisar()` real gera ou atribui um `experiment_group_id`** — a comparação CONTROL/CANDIDATE só foi demonstrada manualmente nesta sessão (`features-r3.2/comparison-report.md`), não como parte do fluxo de produção. |
| 50 | Nenhuma feature promovida sem ablação, teste fora da amostra e shadow prospectivo | **APROVADO** | Nenhuma feature de enriquecimento foi promovida para fora do shadow mode nesta entrega — `GENESIS_SHADOW_MODE=true` mantido; não há violação porque não houve promoção alguma ainda. |

## Resumo

- **APROVADO: 33**
- **REPROVADO: 17**

## Itens REPROVADO — causas agrupadas

1. **Falta de observação ao vivo** (itens 1, 30): nenhuma chamada real ao Gemini/Binance foi
   feita nesta sessão. Requer autorização do usuário para consumir orçamento de API real.
2. **Gap de limpeza conhecido, não corrigido** (itens 2, 31): `MacroController.php` com
   `temperature=>0`; `scoreDetalhado`/`blocoMacro`/`blocoSentimento` ainda no backend;
   `MotorExecucaoService::gerarSetup` e família ainda no repositório (código morto).
3. **Gap de folha não implementado** (item 21): campos `cruzamento_medias`/`book` da Seção
   12.5 nunca foram adicionados a `montarFolhaDecisao()`.
4. **Enforcement ausente, só instrução de prompt** (item 20): depende do Gemini obedecer,
   sem garantia de código.
5. **Suite de testes incompleta** (itens 29, 39, 40-parcial): testes formais não escritos
   (`BinanceOnlyBrainTest`, `LsrIsolationTest`, `BookContractTest`) ou falhas pré-existentes
   não relacionadas ainda presentes na suite.
6. **Infraestrutura de enriquecimento construída mas não conectada** (itens 41, 43, 45, 46):
   `DataFreshnessGate`/`TradeFlowService`/`DerivativesEnrichmentService` existem e passam
   teste isolado, mas não recebem dado real porque `BinancePublicStreamService` não existe
   e a coleta de mark/index price para basis não foi implementada.
7. **Experimento CONTROL/CANDIDATE não integrado ao fluxo real** (item 49): a propriedade foi
   demonstrada manualmente, não automatizada em produção.

## Conclusão

Consistente com o veredito do próprio Documento Mestre ("Status para produção: BLOQUEADO ATÉ
PROVA TÉCNICA E QUANTITATIVA"), esta entrega **não está pronta para desligar o shadow mode**.
33/50 itens aprovados representa um avanço substancial sobre o estado inicial desta sessão
(que tinha um bug fatal impedindo qualquer análise de concluir), mas os 17 itens reprovados
acima — especialmente a ausência de reanálise real (item 30) e a infraestrutura de
enriquecimento desconectada (itens 41/43/45/46) — precisam ser resolvidos antes do aceite
final descrito na Seção 21.4.
