# Plano de Implementação: OpenAI como Fallback do Gemini

## Visão Geral

Ordem: **decisão → visão → scan → contexto → orçamento → custo → guardas → testes reais (0.2–0.5) → ativação**. A decisão vem primeiro porque o client OpenAI já existe e é a etapa que mais derruba análise. Cada fase entra desligada (envs vazias/`false`) e só é ligada na Fase 8.

**Decisão do Felipe (27/09/2026):** a conta OpenAI está sem crédito, então as Fases 1–7 são implementadas e testadas só com `Http::fake`, e os testes reais da Fase 0 (0.2–0.5) rodam no fim, **antes da Fase 8**. Riscos aceitos: o schema de visão pode não caber no modo estrito (cai para `json_object`); o benchmark 0.4 pode reprovar o Luna na decisão (a etapa fica sem `openai_fallback` na cadeia); o parse do contexto pode precisar de ajuste.

Modelo: **`gpt-6-luna`** (decisão do Felipe, 27/09/2026).

Repositórios: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** = `c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main` (sem mudanças previstas).

Regras: sem `RefreshDatabase` (sqlite persistente + `DatabaseTransactions`); nenhuma migração/seed sem perguntar; marcar este arquivo conforme concluir; releia-o a cada nova fase.

## Tarefas

- [x] 0. Fase 0 — Pré-requisitos (0.2–0.5 rodados em 27/09/2026 depois da Fase 7, com chave nova do Felipe)
  - [x] 0.1 Modelo definido: `gpt-6-luna` (`gpt-6.6-luna` não existe)
    - _Requisitos: 1.1_
  - [x] 0.2 Confirmar crédito na conta OpenAI com uma chamada mínima real (`/responses`, 1 frase), usando a chave que será `GENESIS_OPENAI_FALLBACK_KEY`
    - _Requisitos: 1.3_
    - 27/09/2026 (1ª tentativa): `GENESIS_OPENAI_DECISION_KEY` → `insufficient_quota` / `credit_balance_exhausted`
    - **27/09/2026: OK** com a chave nova do Felipe em `GENESIS_OPENAI_FALLBACK_KEY` (`.env` local): `genesis:preflight --ping-openai` → "OpenAI OK: modelo gpt-6-luna, 2914 ms"
  - [x] 0.3 Chamada real com imagem de gráfico + prompt de visão: modelo aceita `input_image`? schema de visão cabe no `json_schema` estrito?
    - _Requisitos: 1.4, 3.1_
    - Imagem: `tests/Proof/v69/fixtures/BTCUSDT.P.png` (BTCUSDT.P 1D Binance, 3737×1508, Fibonacci/OCO/suporte 62.329/VRVP desenhados). Scripts em scratchpad (`fase0_visao*.php`)
    - `input_image` aceito. Identificação (par/timeframe/exchange/mercado) sempre certa, `VisionResponseValidator` aprovou todas
    - **Schema estrito: não se aplica** — a visão do Gemini também não usa schema (só `responseMimeType`); não existe schema de visão para reaproveitar. Fica `json_object` + `normalizar()`
    - **Achado — leitura instável com `detail: high`:** a mesma imagem deu uma leitura quase vazia (sem preço, sem Fibonacci) numa chamada e completa na seguinte. Com `detail: original` (3 rodadas): preço 62.853,5 e suporte 62.329 3/3; resistência 63.716,9 2/3; Fibonacci 5 níveis 2/3; OCO descartado 3/3 pela normalização (o Luna não dá `preco_topo`/`preco_base` — descarte seguro, regra E2); **POC do VRVP instável** (null / 67.000 / 63.000; Gemini leu 63.700, 67.000 está errado). Entrada 4,5k → 8,4k tokens (+~US$ 0,0004)
    - **Decisão: padrão de `GENESIS_OPENAI_FALLBACK_IMAGE_DETAIL` mudou de `high` para `original`** (config + `.env.example`)
    - Gemini na mesma imagem (comparação): leitura completa, OCO com topo/base, POC 63.700; 36,6s — o `gemini-3.5-flash` deu 503 real durante o teste e a reserva 3.6 respondeu
    - Scan pela OpenAI: `{"symbol":"BTCUSDT","timeframe":"1d","exchange":"Binance","market":"FUTURES","confidence":0.99}` em 4,1s
    - Conclusão: visão do Luna como fallback é **mais pobre, quase sempre correta no que lê**; ponto fraco é o POC do VRVP
  - [x] 0.4 Benchmark da decisão com o Luna (`genesis:benchmark-brain-v2 --bundle=storage/app/benchmarks/fase8-bundle-recortado.json --runs=10`, decisor forçado para OpenAI/`gpt-6-luna` por env): taxa de repair, erros do validador, tokens e latência vs. Gemini
    - `BenchmarkGenesisDecision` NÃO serve: mede o pipeline V6.7 (`GraphicalAnalysisDecisionClient`), não o decisor real
    - Se a taxa de repair for muito maior que a do Gemini, decidir com o Felipe se a decisão entra na cadeia
    - _Requisitos: 1.4_
    - Rodado 27/09/2026 com `GENESIS_DECISION_PROVIDER_CHAIN=openai_fallback` (esforço `medium`). Logs: `storage/app/benchmarks/fallback-openai-0.4-gpt-6-luna.log`, relatório `brain-v2-20260927-221430/report.json`, repair `fallback-openai-0.4-repair.log`
    - **Direção:** SHORT 10/10, score 65 em todas, 0 erro de transporte — mesma leitura do Gemini no mesmo bundle (SHORT 7/7, 65-70, Fase 8)
    - **Validade de primeira: 1/10.** Erros: `STOP_SELECTION_WRONG_SIDE` 4/10 (stop do lado errado — o validador pega), `NUMERIC_CITATION_*` 4/10, `UNACCOUNTED_NUMERIC_LITERAL` "200"/"50" 5/10 (períodos de EMA soltos no texto), `TEXT_LENGTH` 2/10 (poucos caracteres acima), 1 `TEXT_FORBIDDEN` ("LONG" nas notas de um plano SHORT), 1 alvo com elemento inventado, 1 `EVIDENCE_ACCOUNTING_UNKNOWN_IDS`
    - Pós-processamento do job sobre as 10 (script `fase0_decisao_reparo.php`, sem IA): reparo mecânico e fallback de stop **não resgataram nenhuma** — mesmo nos lotes classificados como mecânicos (#3, #7) o texto não muda. Hipótese não confirmada: tirar a frase com o número deixaria o texto abaixo do mínimo, e o reparo desiste de propósito
    - **Repair real** (1 chamada por inválida, com erros + saída anterior, como o job faz; script `fase0_decisao_repair.php`): **resolveu 6/9** (3 de primeira, 2 após mecânico, 1 após fallback de stop). Sobraram: `TEXT_LENGTH` 264/260, `TEXT_FORBIDDEN` LONG, literais 50/200
    - **Resultado: 7/10 válidas em até 2 chamadas** (o job permite até `max_attempts`)
    - Tokens por chamada: ~30,8k entrada / 7,1k saída (1ª), ~34k / 5k (repair) → **~US$ 0,006-0,007 por chamada, ~US$ 0,013 por decisão** (média de ~2 chamadas). Latência ~20-32s por chamada
    - Comparação com o Gemini neste bundle não é limpa: as 7 do Gemini (Fase 8) saíram todas inválidas por `CHART_VISIBLE_PRICE_DEVIATION` (efeito do bundle congelado de 23/09), que o Luna não teve
    - **Decisão (27/09/2026, Felipe delegou: "faz o que for melhor"): o Luna ENTRA como último elo da decisão.** Motivos: direção estável e igual à do Gemini; o validador barra toda saída ruim antes de chegar ao membro; 7/10 válidas em até 2 chamadas a ~US$ 0,013 por decisão; a alternativa, sem ele, é a análise falhar e estornar sempre que os dois Gemini caem. Cadeia da Fase 8 fica `gemini,gemini_secondary,openai_fallback`
    - Débito anotado (fora desta spec): o reparo mecânico não resgata as decisões do Luna nem nos lotes que ele classifica como mecânicos — investigar se é o piso de tamanho do texto
  - [x] 0.5 Chamada real de contexto (prompt macro e prompt sentimento de `GeminiContextService`) com `tools: [{type: "web_search"}]`: `decodificarContexto()` aceita a saída? quantas buscas e tokens por bloco?
    - _Requisitos: 1.4, 5.1, 5.5_
    - `tentarBlocoOpenAi()` real (script `fase0_contexto.php`): macro 8,1s e sentimento 6,7s, `error_code` null nos dois, parse sem ajuste. 1 busca por bloco; ~13,5k tokens de entrada (conteúdo da busca), ~300-400 de saída → **~US$ 0,012 por bloco** (US$ 0,01 é a busca)
    - Conteúdo coerente e datado (OCDE set/2026, Coinbase/USDC, exploit da Liquid Network)
    - **Achado corrigido:** a OpenAI põe a fonte em markdown dentro do texto — `... ativos de risco. ([oecd.org](https://...?utm_source=openai))` — e o frontend mostraria o link cru. `GeminiContextService::semCitacoesMarkdown()` remove a citação (e deixa só o texto de link solto) em todo texto do bloco, só no caminho OpenAI. Teste com o texto real em `GeminiContextServiceOpenAiFallbackTest`

- [x] 1. Fase 1 — **[API]** Decisão em cadeia (27/09/2026, nada commitado)
  - [x] 1.1 Config: `decision_provider_chain` e bloco `openai_fallback` em `config/genesis_graphical_v6.php`; envs em `.env.example`
    - _Requisitos: 1.2, 2.1, 2.5_
    - Só as chaves que a decisão usa (`api_key`, `base_url`, `model`=`gpt-6-luna`, `reasoning_effort`=`medium`, `decision_timeout_seconds`=120). As de visão/scan/contexto entram nas fases delas
  - [x] 1.2 `OpenAiDecisionClient`: construtor opcional com overrides (modelo, chave, base_url, esforço, timeout); sem overrides = comportamento atual
    - _Requisitos: 2.5_
    - Helper `config()` com mapa `CONFIG_PADRAO`; `connect_timeout_seconds` continua global
  - [x] 1.3 `ChainDecisionProvider` (lista nomeada de `DecisionProvider`): avança só em `TransportProviderException`, loga `GENESIS_DECISION_PROVIDER_FAILOVER` com `de`/`para`/`reason`, `marcarProximaComo('failover')`, relança a última
    - _Requisitos: 2.2, 2.3_
    - **Decisão:** `FailoverDecisionProvider` NÃO foi alterado nem removido — com a cadeia vazia o binding monta exatamente o mesmo objeto de antes, e os testes dele (e os de binding que leem `primary`/`fallback` por reflection) seguem valendo sem mudança
  - [x] 1.4 Binding: braço `openai_fallback` no `match`; cadeia lida da env, vazia = `[decision_provider, decision_provider_fallback]`
    - _Requisitos: 2.1, 2.6, 8.3_
    - `GenesisGraphicalServiceProvider::DECISION_PROVIDERS` (lista única de valores aceitos, usada na mensagem de erro e na guarda de boot do `_fallback`, que agora aceita `openai_fallback`) + `decisionProviderChain()` (parse da env, ignora espaços/vazios)
    - Validação da cadeia no **boot** fica para a 7.1; na resolução, valor desconhecido já lança com a lista de aceitos
  - [x] 1.5 Testes (`Http::fake`): 3 elos com 503/503/200; semântico no 1º não avança; cadeia vazia igual a hoje; repair recomeça no primário; `calls[]` com motivos corretos
    - _Requisitos: 2.1–2.6, 6.1_
    - `ChainDecisionProviderTest` (8), +2 em `OpenAiDecisionClientTest` (overrides; override sem chave), +3 em `GenesisGraphicalServiceProviderV68BindingTest` (cadeia na ordem com `gpt-6-luna` e não Terra; cadeia vazia = failover; valor desconhecido)
    - Com clients reais + `Http::fake`: `calls[]` = `primeira/failover/failover`, provedores `gemini/gemini/openai`, status `503/503/200`
    - Suíte completa: **1297 passaram, 4 falharam, 13 skipped** (751s). Nenhuma falha vem da Fase 1:
      - `GenesisGraphicalV68ConfigTest::bloco_gemini_aninhado...` e `GeminiModelUnicoTest::h01_h02...` esperam `gemini-3.6-flash`, mas o `.env` local tem `GENESIS_GEMINI_MODEL=gemini-3.5-flash` (falham igual com as mudanças em stash)
      - `GraphicalAnalysisAttemptJobTest::falha_apos_esgotar...` e `::consumo_acumula_os_repairs...` só falham na suíte inteira (dependem de ordem); isolados, passam com e sem as mudanças
    - `MANIFEST.json` foi regenerado pela suíte com os hashes dos arquivos alterados
    - **Pendência para a Fase 5:** `orcamentoTimeoutSegundos()` ainda lê só `decision_provider`; com a cadeia ligada, o orçamento não soma os elos

- [x] 2. Fase 2 — **[API]** Visão com fallback (27/09/2026, nada commitado)
  - [x] 2.1 `VisionProviderException`: propriedade `transporte`; `GeminiVisionService` marca `true` em timeout/conexão/429/5xx na última falha
    - _Requisitos: 3.3_
    - Construtor `(message, transporte = false, previous)` — os `new VisionProviderException('...')` existentes seguem `false`. No Gemini só o `throw` depois do laço é transporte (o laço só dá `continue` em timeout/429/5xx; o resto lança lá dentro)
    - `motivoLegivel()` reconhece `VISION_OPENAI_API_KEY_MISSING`
  - [x] 2.2 `OpenAiResponsesClient` (HTTP + extração de texto + registro no `AiUsageRecorder`), compartilhado por visão, scan e contexto
    - _Requisitos: 6.1_
    - Nunca lança por falha da API: devolve `ok`/`transporte`/`erro`/`texto`/`usage`; lê `GENESIS_OPENAI_FALLBACK_*`; `store: false`
    - **Adiantado da 4.5:** `AiUsageRecorder::consultasOpenAi()` (conta `web_search_call` no `output`) — o client já registra as buscas
  - [x] 2.3 `OpenAiVisionService implements VisionProvider`: mesmo prompt, mesmo formato de retorno, `VisionResponseValidator`
    - _Requisitos: 3.1_
    - Prompt e normalização extraídos de `GeminiVisionService` para o trait `LeituraVisualCompartilhada` (movidos por script, sem alteração; os 29 testes do Gemini passaram antes de qualquer outra mudança)
    - `text.format = json_object`, não `json_schema` estrito — a 0.3 (chamada real) decide se dá para usar o estrito
    - Config: `openai_fallback.vision_timeout_seconds` (60), `openai_fallback.image_detail` (`high`); esforço de raciocínio compartilhado com a decisão (`openai_fallback.reasoning_effort`)
  - [x] 2.4 `FailoverVisionProvider` + binding; `GENESIS_VISION_PROVIDER_FALLBACK` vazio = só Gemini
    - _Requisitos: 3.2, 3.4_
    - Log `GENESIS_VISION_PROVIDER_FAILOVER` + `marcarProximaComo('failover')`; valor inválido lança com a lista de aceitos
  - [x] 2.5 Testes: transporte no Gemini → OpenAI; JSON inválido não aciona; chave ausente não aciona; fallback vazio desliga
    - _Requisitos: 3.1–3.4_
    - `OpenAiVisionServiceTest` (9): payload com `input_image` + prompt idêntico ao do Gemini; leitura normalizada; 503 = transporte e 400 não; timeout de conexão = transporte, registrado com tokens `null`; JSON inválido; sem chave não chama; failover Gemini 503/503 → OpenAI com `calls[]` `primeira/failover/failover`; JSON inválido e chave ausente no Gemini não chamam a OpenAI
    - +2 em `GeminiVisionServiceTest` (marca de transporte), +2 no binding, +1 em `AiUsageRecorderTest`
    - Timeout simulado com porta local fechada (`127.0.0.1:1`): `Http::fake` lançando `ConnectionException` dá segfault do PHP neste Windows (já documentado em `OpenAiInteractionsClientTest`)
    - Suíte completa: 1310 passaram, 5 falharam, 13 skipped — as 4 conhecidas da Fase 1 + `GeminiInteractionsLiveContractTest` (chama a API real do Gemini, endpoint V6.7; cURL timeout de 60s na rede, sem relação com a mudança)

- [x] 3. Fase 3 — **[API]** Scan com fallback (27/09/2026, nada commitado)
  - [x] 3.1 `ChartMetadataScanService`: elo OpenAI via `OpenAiResponsesClient`, mesmo prompt; ligado por `GENESIS_SCAN_OPENAI_FALLBACK`
    - _Requisitos: 4.1, 4.2_
    - **Mudança do plano:** o laço de modelos Gemini NÃO virou lista `[provedor, modelo]` — continua igual; quando o último modelo Gemini falha por transporte (exceção de conexão ou 429/5xx), `tentarOpenAi()` roda antes de lançar a mensagem de sempre. Menos mudança no código que já tinha teste, mesmo efeito
    - Saída só como texto: o parse, o `TimeframeNormalizer` e a validação (FUTURES, confiança ≥ 0,85) são os mesmos para os dois provedores
    - `text.format = json_object`; config `openai_fallback.scan_timeout_seconds` (45) e `scan_reasoning_effort` (`low`, OCR simples — chave nova, não estava no design)
    - 4xx no Gemini continua lançando na hora, sem OpenAI; OpenAI falhando também devolve "Falha ao processar imagem. Tente novamente."
  - [x] 3.2 Testes: 503 nos dois Gemini → OpenAI lê; 400 no primeiro não avança; flag `false` = comportamento atual
    - _Requisitos: 4.1_
    - `ChartMetadataScanOpenAiFallbackTest` (6): OpenAI lê e "1S" vira `1w` (normalização vale), `calls[]` `gemini/gemini/openai` com `failover`; leitura SPOT da OpenAI continua reprovada; flag desligada; 400 não avança; OpenAI 503 → mensagem de sempre; sem chave não tenta. `ChartMetadataScanFallbackTest` antigo passa sem mudança

- [x] 4. Fase 4 — **[API]** Contexto (macro e sentimento) com fallback (27/09/2026, nada commitado)
  - [x] 4.1 Config: `context_openai_fallback` + `openai_fallback.context_*` (timeout 60, esforço `low`, max_output_tokens 8192)
    - _Requisitos: 5.7_
    - `max_output_tokens` 8192 em vez dos 4096 do design: na OpenAI o raciocínio conta dentro desse teto (o Gemini já truncou JSON por esse motivo, V6.10)
  - [x] 4.2 `GeminiContextService`: extrair a montagem de `dados` (macro/sentimento) de `tentarBloco()` para um método comum aos dois provedores
    - _Requisitos: 5.5_
    - `montarDados()` devolve `[dados, código de vazio]`; os testes de contexto existentes (cache, grounding, prompt) passam sem mudança
  - [x] 4.3 `tentarBlocoOpenAi()`: mesmos `systemPrompt`/`userPrompt`, `web_search`, parse por `decodificarContexto()`, mesmo formato de retorno com `model` da OpenAI
    - _Requisitos: 5.1, 5.5_
    - Códigos de falha próprios: `CONTEXT_OPENAI_TIMEOUT`, `CONTEXT_OPENAI_HTTP_{status}` (é o que vai para o cache negativo quando os dois caem)
    - `source` do bloco (`GEMINI_CONTEXT...`) não muda: o frontend não lê esse campo; quem veio da OpenAI fica visível no `model` do cache e na telemetria
  - [x] 4.4 `gerarBloco()`: Gemini → se falha de transporte (`CONTEXT_TIMEOUT`, `CONTEXT_HTTP_429`, `CONTEXT_HTTP_5xx`) e flag ligada → OpenAI; log `genesis.contexto.failover_openai` + `marcarProximaComo('failover')`
    - _Requisitos: 5.1, 5.2_
    - Chave Gemini ausente continua saindo antes (em `collect()`/`blocoCacheado()`), sem OpenAI (Req. 5.2)
  - [x] 4.5 `AiUsageRecorder::consultasOpenAi()`: conta `web_search_call` no `output`, registrado em `grounding_queries`
    - _Requisitos: 6.1_
    - Feito na 2.2 (o `OpenAiResponsesClient` já registra as buscas de toda chamada)
  - [x] 4.6 Conferir que `blocoCacheado()` cacheia o resultado OpenAI com o TTL do bloco e só grava `:falha` quando os dois falham (sem mudança esperada; cobrir com teste)
    - _Requisitos: 5.3, 5.4_
    - Confirmado sem mudança em `blocoCacheado()`: o fallback roda dentro do `$gerar`, que já está sob o lock
  - [x] 4.7 Testes, para macro **e** sentimento: timeout/503 → OpenAI preenche e cacheia; JSON inválido/vazio não aciona; os dois falham → cache negativo único; flag `false` = hoje; `MacroController::today` e `sentimento` com Gemini fora devolvem o bloco da OpenAI
    - _Requisitos: 5.1–5.8_
    - `GeminiContextServiceOpenAiFallbackTest` (7): 503 → OpenAI nos dois blocos com `tools: web_search`, `calls[]` `gemini/openai/gemini/openai` e `grounding_queries` = 2; cacheado com `model` `gpt-6-luna` e 2ª análise sem chamadas; os dois falhando → um cache negativo com `CONTEXT_OPENAI_HTTP_500`; JSON inválido, bloco vazio e 400 não acionam; flag desligada; **timeout real** do Gemini (porta fechada, só a OpenAI stubada) → OpenAI preenche
    - +1 em `MacroControllerRemovedTest`: `/macro/today` e `/macro/sentimento` autenticados com Gemini 503 devolvem o texto da OpenAI
    - Suíte completa (Fases 3+4): 1322 passaram, 7 falharam — as 5 já conhecidas + 2 de `AnaliseIdorTest` por `UNIQUE constraint failed: users.email` (e-mail aleatório do Faker colidindo com usuários que ficaram gravados no sqlite persistente; isolado, o teste passa 8/8). Nenhuma ligada ao fallback

- [ ] 5. Fase 5 — **[API]** Orçamento de tempo
  - [x] 5.1 `orcamentoTimeoutSegundos()`: soma dos timeouts de todos os elos da cadeia de decisão + fallback de visão + fallback de contexto (2 blocos) quando ligados
    - _Requisitos: 7.1_
    - **Achado:** o orçamento JÁ contava o contexto (2 blocos + espera do lock). O que faltava: a decisão era "primário × 2", certo só quando a reserva tem o mesmo timeout (gemini → gemini_secondary); com reserva `openai` (180s) já subestimava. Agora é a soma por elo (cadeia, ou par primário + reserva)
    - Visão: + OpenAI (60+10) quando `vision_provider_fallback` ligado. Contexto: + OpenAI (60+10) por bloco quando `context_openai_fallback` ligado (`geracaoDeBlocoDeContextoSegundos()`)
    - Com o `.env` local (fallbacks desligados): 545s, igual a antes; `retry_after` 650. **Com tudo ligado (padrões): 545 + 130 + 70 + 140 = 885s → `GENESIS_QUEUE_RETRY_AFTER` ≥ 935 antes da Fase 8** (a guarda de boot já avisa)
  - [x] 5.2 Guarda de boot: `context_cache_lock_wait_seconds` ≥ timeout Gemini do contexto + timeout OpenAI do contexto quando o fallback estiver ligado
    - _Requisitos: 7.1a_
    - Log crítico `GENESIS_CONTEXT_LOCK_WAIT_ABAIXO_DA_GERACAO`. Com os padrões: 25+10+60+10 = 105 > 75 atuais → **`GENESIS_CONTEXT_CACHE_LOCK_WAIT_SECONDS` ≥ 105 ao ligar o contexto** (documentado no `.env.example`)
  - [x] 5.3 Conferir que `FinalizarAnalisesTravadas` e a guarda `GENESIS_QUEUE_RETRY_AFTER_ABAIXO_DO_ORCAMENTO` usam o novo valor; testes para as combinações
    - _Requisitos: 7.2, 7.3_
    - Os dois já chamam `orcamentoTimeoutSegundos()` (sem fórmula própria); `FinalizarAnalisesTravadasTest` e `QueueRetryAfterTest` passam sem mudança
    - `OrcamentoTimeoutFallbackOpenAiTest` (8): par gemini/gemini_secondary igual a antes; reserva `openai` usa 180 e não "× 2"; cadeia soma cada elo; visão e contexto somam; elo desconhecido lança; guarda do lock avisa/fica quieta

- [x] 6. Fase 6 — **[API]** Custo em dólar (27/09/2026, nada commitado)
  - [x] 6.1 `config/genesis_ai_prices.php` com `gpt-6-luna`, `gpt-5.6-terra` (design §7) e os Gemini em uso (preencher pela tabela oficial do Google, com data), incluindo preço de busca
    - _Requisitos: 6.2_
    - Gemini (ai.google.dev/gemini-api/docs/pricing, página de 24/09/2026): 3.6/3.7/3.8-flash US$ 0,75 entrada / 0,075 cache / 3,75 saída até 31/12/2026, **dobra em 01/01/2027** (1,50/0,15/7,50); 3.5-flash 1,50/0,15/9,00; busca US$ 14/1.000 (5.000 grátis/mês compartilhadas, ignoradas — a estimativa é teto)
    - Preço com `periodos` (`desde`) para o reajuste de 2027 entrar sozinho; `saida_inclui_raciocinio` por modelo
    - `gpt-5.6-luna` não entrou (não é usado)
  - [x] 6.2 `genesis:custo-ia`: colunas US$ por etapa/modelo (tokens + buscas), "sem preço" para modelo fora da tabela, contagem de análises com fallback OpenAI
    - _Requisitos: 6.2, 6.3, 6.4_
    - Coluna US$ na tabela por dia/etapa/modelo, no resumo por etapa e no `--analise=ID` (por chamada + total); linha "Custo estimado no período"; "Análises que usaram o fallback OpenAI: N"
    - `AiPriceTable`: nome exato ou nome + sufixo de versão/data (`-001`, `-2026-09-23`, `-latest`, `-preview`); `gemini-3.6-flash-lite` NÃO casa com o 3.6-flash (outro modelo)
    - **Bug preexistente corrigido:** o resumo por etapa somava entrada + saída + raciocínio para todo modelo — na OpenAI o raciocínio (`output_tokens_details.reasoning_tokens`) já está dentro de `output_tokens`, então era contado duas vezes. Afetava as linhas do Terra no histórico
    - Rodado no banco local (só leitura), desde 20/09: US$ 0,1274 no período; uma decisão bem-sucedida no 3.6-flash (38k entrada, 2,7k saída, 6,8k raciocínio) ≈ **US$ 0,065** — no `gpt-6-luna` a mesma decisão sairia ≈ US$ 0,012
  - [x] 6.3 Testes do cálculo (entrada − cache, cache, saída + raciocínio, buscas)
    - _Requisitos: 6.2, 6.3_
    - `AiPriceTableTest` (7): raciocínio não conta duas vezes na OpenAI; Gemini soma raciocínio na saída e tool_use na entrada; cache; reajuste de 2027; sufixo de versão casa e `-lite` não; sem preço = null; tokens null = 0
    - `GenesisCustoIaCommandTest` (2, primeiro teste do comando): relatório do período e `--analise` com custo por linha, "sem preço", contagem de fallback e o resumo sem contagem dupla (57.000, não 69.000)

- [x] 7. Fase 7 — **[API]** Guardas e preflight (27/09/2026, nada commitado)
  - [x] 7.1 Boot: crítico se algum elo/etapa usa OpenAI sem `GENESIS_OPENAI_FALLBACK_KEY`; valida valores da cadeia e do fallback de visão
    - _Requisitos: 8.1, 8.3_
    - Logs críticos `GENESIS_FALLBACK_BOOT_OPENAI_KEY_MISSING` (com a lista de etapas), `GENESIS_FALLBACK_BOOT_INVALID_DECISION_CHAIN`, `GENESIS_FALLBACK_BOOT_INVALID_VISION_FALLBACK`
    - Helpers no provider, usados pelo boot e pelo preflight: `etapasComFallbackOpenAi()`, `decisorPrimarioEfetivo()`, `VISION_PROVIDER_FALLBACKS`
  - [x] 7.2 `genesis:preflight` (o nome real do comando; a spec dizia `genesis:graphical-preflight`): mostrar cadeia ativa por etapa (decisão, visão, scan, contexto); `--ping-openai` faz chamada mínima
    - _Requisitos: 8.2_
    - Bloqueia release com: valor desconhecido na cadeia/fallback de visão; OpenAI ligada sem chave; espera do lock do contexto < geração de um bloco; `retry_after` < orçamento do job + 50
    - **Achado:** a checagem do decisor esperado (Decisão D4, `gemini`) lia `GENESIS_DECISION_PROVIDER`, mas com a cadeia setada quem manda no binding é o primeiro elo dela — agora confere o primário efetivo
    - `--ping-openai`: `Reply only: ok` via `OpenAiResponsesClient` (`acumular: false`); falha mostra o erro da API (ex.: `credit_balance_exhausted`). É o jeito de fazer a 0.2 na Fase 8
    - Rodado local: `decisão: gemini → gemini_secondary · visão/scan: 3.5-flash → 3.6-flash · contexto: 3.5-flash` → PASS
    - Testes: +9 em `GenesisGraphicalPreflightTest` (cadeias com a OpenAI no fim; sem chave lista as etapas; valor desconhecido; D4 no primeiro elo da cadeia; lock; retry_after; ping OK / sem crédito / sem chave), +2 guardas de boot em `OrcamentoTimeoutFallbackOpenAiTest`
    - **`deploy/guarda_modelo.sh` ganhou uma exceção:** a guarda de CI (DET-2) barra qualquer `gemini-3.5-flash` em `app/config/routes`, e a tabela de preços da Fase 6 tem esse nome. Exceção só para `config/genesis_ai_prices.php` (tabela de preço, não faz chamada; há chamadas reais ao 3.5 na telemetria pela reserva do scan). Achado pela suíte da Fase 6 (`GeminiModelUnicoTest::h02`)
  - [x] 7.3 Suíte completa verde (`php artisan test`)
    - **1350 passaram, 7 falharam, 13 skipped** (708s). Nenhuma falha vem do fallback — todas se repetiram sem relação nas fases anteriores:
      - `GenesisGraphicalV68ConfigTest` e `GeminiModelUnicoTest::h01_h02` — o `.env` local tem `gemini-3.5-flash`, os testes esperam 3.6 (falham igual sem as mudanças)
      - `GraphicalAnalysisAttemptJobTest` (2) — dependem da ordem da suíte; isolados passam
      - `GeminiInteractionsLiveContractTest` — chama a API real do Gemini (V6.7), timeout de rede
      - 2 por `UNIQUE constraint failed: users.email` — e-mail aleatório do Faker colidindo com usuários que ficaram gravados no sqlite persistente; muda de teste a cada rodada (desta vez `MultiExchangeDerivativesControllerTest` e `SistemaStatsLegadoFilterTest`, isolados 5/5)
    - Não é "verde" no sentido literal por causa dessas 7; ficam registradas como débito preexistente, fora do escopo desta spec

- [ ] 8. Fase 8 — Ativação (só com autorização do Felipe)
  - [x] 8.0 **Teste local de ponta a ponta (27/09/2026, pedido do Felipe)** — `.env` local com tudo ligado + Gemini simulado fora do ar (`GENESIS_GEMINI_GENERATE_URL=http://127.0.0.1:1`; backup em `.env.antes-teste-fallback`)
    - `genesis:preflight` barrou `GENESIS_QUEUE_RETRY_AFTER=935`: com os timeouts do `.env` local o orçamento é 915s (não os 885s dos padrões) → subido para 1000. **Em produção o mínimo é o que o preflight calcular com o `.env` de lá**, não um número fixo
    - Análise 179 (BTCUSDT 15m, pelo navegador) **COMPLETED**: scan, visão, macro, sentimento e decisão todos pela OpenAI depois dos Gemini falharem; decisão válida de primeira (48s); 13 chamadas, **US$ 0,029**, ~1min30s
    - Worker local (`queue:work` sem `--memory`) saiu com código 12 (limite de 128 MB) depois do job — religado com `--memory=1024`. Conferir o limite do worker em produção
  - [ ] 8.1 Staging: `GENESIS_DECISION_PROVIDER_CHAIN=gemini,gemini_secondary,openai_fallback` + `GENESIS_QUEUE_RETRY_AFTER` ajustado; forçar falha do Gemini e conferir análise saindo pela OpenAI com custo em `genesis:custo-ia`
  - [ ] 8.2 Staging: ligar visão, depois scan, depois contexto, um de cada vez, repetindo o teste de falha forçada (no contexto, limpar o cache macro/sentimento antes)
  - [ ] 8.3 Produção: mesma ordem, só envs; rollback = esvaziar as envs
  - [ ] 8.4 Após 7 dias: `genesis:custo-ia` com taxa de failover e custo real do fallback por etapa, registrado aqui

## Fora de escopo (Req. 9)

- `VisualLevelsService` e pipeline V6.7 (órfãos).
- `GeoEventService`, `/gemini-proxy`, monitor Python — spec futura.
