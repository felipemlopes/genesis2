# Plano de Implementação: Devolução técnica V6.7 (Fabrício) + migração multi-provedor Gemini/OpenAI

**Status deste documento**: criado como planejamento puro (12/08/2026, "não altere nada"), depois
executado fase a fase na mesma sessão, a pedido explícito ("execute fase N"). **Fases 1-11
implementadas e testadas** (código real, 230/230 Unit + suíte Feature relevante verdes). **Fase 12
é um checklist pronto pra execução, não executável neste ambiente** (sem acesso a produção nem a
rede que sustente uma chamada real de provedor nenhum) — ver "Status final" no fim do documento
pras pendências reais que sobram.

## Contexto — por que este spec existe

Dois gatilhos na mesma data (12/08/2026):

1. **Devolução técnica consolidada do Fabrício** (PDF `DEVOLUCAO_GENESIS_V6_7_FELIPE.pdf`) — aponta 4
   achados P0 e 4 achados P1 bloqueando/arriscando a análise gráfica em produção.
2. **Pedido do Felipe**: substituir o Gemini pela OpenAI (Responses API, modelo `gpt-5.6-terra`) como
   provedor do decisor único, mantendo o Gemini disponível como rollback via uma única variável de
   ambiente.

Antes de planejar, o estado real de cada achado do PDF foi conferido contra o código de
`E:\Programas\wamp64\www\genesis-api` (não contra o texto do PDF isoladamente — o PDF pode estar
desatualizado em relação a trabalho feito no mesmo dia):

| Achado PDF | Status confirmado em 12/08/2026 | Evidência |
|---|---|---|
| **P0-01** retry inoperante sob `QUEUE_CONNECTION=sync` | ✅ **já resolvido** — spec `genesis-analise-grafica-fila-assincrona` (concluído hoje, Fases 1-6) trocou pra fila `database` + `GraphicalAnalysisAttemptJob` (1 execução = 1 tentativa) + worker via Supervisor, runbook documentado. | `.env` real: `QUEUE_CONNECTION=database`. `.env.example` mantém `sync` como padrão seguro de dev, com aviso. |
| **P0-02** prompt instrui radical `CONFIRM`, validador reprova | ❌ **ainda ativo** | `GenesisPrompt.php:19,40,57` ("confirmação", "confirmada", "confirmação ou oposição"); `DecisionResponseValidator.php:145-149` reprova o radical nos dois campos de texto livre. |
| **P0-03** orçamento de tempo do job insuficiente | ❌ **ainda ativo** | `GraphicalAnalysisAttemptService::attempt()` chama `InformativeNarrativeService`/`VisualLevelsService` (best-effort) **antes** de devolver `outcome=accepted`, dentro do mesmo `$timeout` do job (`60+10+20=90`, calculado só a partir da chamada ao decisor). |
| **P0-04** exceção de dispatch ocultada | ⚠️ **parcialmente endereçado** | `GraphicalAnalysisController::__invoke()` já dá `refresh()` e devolve o estado atual após o `catch(\Throwable){}` do `dispatch()`, mas o comentário do próprio código (linhas 99-105) assume que só acontece sob `sync` — não trata explicitamente o caso de falha real de enfileiramento sob `database` (ex.: banco fora do ar), que deixaria a `Analise` presa em `PENDING` sem log/estorno. |
| **P1-01** Orchestrator/cache/lock fora do fluxo vivo | ❌ **ainda ativo** | `GraphicalAnalysisOrchestrator` só aparece em comentário/testes/benchmark, nenhuma rota viva chama `generate()`. |
| **P1-02** timeout do frontend (300s) menor que o pior caso do backend | ❌ **ainda ativo** | `services/geminiService.ts:42` — `POLL_TIMEOUT_MS = 5 * 60 * 1000`. |
| **P1-03** imagens pendentes não são removidas | ❌ **ainda ativo** | Nenhum `Storage::disk('local')->delete(...)` de `graphical-analysis-pending/` encontrado em `app/Jobs`, `app/Console`, `app/Services/GraphicalAnalysis`. |
| **P1-04** benchmark não mede o Orchestrator | ❌ **ainda ativo** (não conferido linha a linha, mas nada mudou no comando desde o PDF) | `app/Console/Commands/BenchmarkGenesisDecision.php`. |

**Repositórios**: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** =
`c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main`.

## Escopo explícito da migração de provedor

O pedido do Felipe fala em "substituir o Gemini pela OpenAI nas análises" — existem **5 pontos de
chamada ao Gemini** distintos no backend hoje:

1. `GeminiInteractionsClient` (Interactions API) — **o decisor único** da análise gráfica. **Este é o
   escopo desta migração.**
2. `InformativeNarrativeService` — narrativa macro/sentimento, `generateContent`, best-effort.
3. `VisualLevelsService` — níveis visuais de suporte/resistência, best-effort.
4. `ChartMetadataScanService` — scan de metadados do gráfico.
5. `MacroController` / `GeoEventService` / `UtilityGeminiProxyController` — módulos não relacionados à
   análise gráfica (macro geral, eventos geopolíticos, proxy utilitário do frontend).

**Decisão de escopo proposta**: migrar somente o item 1 (o decisor único, que é literalmente "a
análise"). Os itens 2-5 continuam no Gemini, sem nenhuma mudança, nesta entrega — são chamadas
best-effort com prompts/schemas próprios, migrá-las não foi pedido e ampliaria a superfície de risco
sem necessidade. Se o Felipe/Fabrício quiserem incluir algum desses depois, é um adendo a este spec,
não parte dele. **Confirmar esta leitura de escopo antes de começar a Fase 4.**

## Risco operacional — ler antes de aprovar

- Mesma limitação já registrada no spec V6.7 (item I-51) e no spec de fila assíncrona: **não há
  acesso a produção** para configurar `.env`, rodar `config:clear` ou reiniciar o worker Supervisor —
  a Fase 12 (corte pra produção) depende de alguém com esse acesso executar os passos.
- **Achado colateral durante o levantamento**: o `.env` real de `genesis-api` já tem um par
  `AI_TRADER_PROVIDER` / `GENESIS_OPENAI_KEY` / `GENESIS_OPENAI_MODEL` (hoje `gpt-4o`) — mas é de um
  **subsistema diferente** (trader/IA de operação, não a análise gráfica), com uma chave OpenAI real
  já gravada em `.env` (não `.env.example`). A variável nova pedida pelo Felipe (`AI_PROVIDER`) e as
  novas `OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_BASE_URL` **não devem reaproveitar nem colidir** com
  essas — nomes parecidos, propósitos diferentes, provedores configurados independentemente. Deixar
  isso documentado em comentário no `.env.example` pra não confundir quem for configurar produção. A
  chave já existente não foi reproduzida neste documento nem em nenhum log desta sessão.
- Trocar de provedor sem ter corrigido o P0-02 (radical `CONFIRM`) só reproduz o mesmo bug com o
  GPT-5.6-terra no lugar do Gemini — por isso a Fase 1 (P0-02) vem antes da Fase 5 (cliente OpenAI) na
  ordem de execução recomendada, mesmo que sejam times/PRs diferentes.

---

## FASE 1 — P0-02: eliminar o conflito prompt × validador (radical `CONFIRM`) ✅ 1.1-1.6 concluídas (12/08/2026)

*Prioridade máxima do PDF (seção 11, item 1) — bloqueia produção com qualquer provedor, não só OpenAI.*

- [x] **1.1** `GenesisPrompt.php` — "...correlação, evento ou confirmação." trocado por
      "...correlação, evento ou validação inexistente.".
- [x] **1.2** `GenesisPrompt.php` — "formando, testando, rompendo, retestando ou confirmada"
      trocado por "formando, testando, rompendo, retestando ou sustentada".
- [x] **1.3** `GenesisPrompt.php` — "confirmação ou oposição dos derivativos" trocado por
      "sustentação ou oposição dos derivativos".
- [x] **1.4** Regra explícita nova adicionada em `system()`, seção TEXTO PÚBLICO EM PT-BR: proíbe o
      radical `CONFIRM` (`confirma`, `confirmar`, `confirmado`, `confirmada`, `confirmação`) em
      `score_description`/`technical_analysis`, com exemplos de alternativa aceita.
- [x] **1.5** Confirmado e documentado em comentário PHP no topo do arquivo: os 2 usos estruturais
      do enum `CONFIRMED` (exemplo de JSON e lista de valores válidos de
      `visual_observations.patterns.state`) permanecem intocados — só texto livre foi alterado.
- [x] **1.6** `tests/Unit/GenesisPromptContractTest.php` criado — 2 testes, 5 assertions, todos
      verdes: confirma que a regra explícita existe, remove as 2 exceções estruturais permitidas
      (a regra em si + o enum `CONFIRMED`) e falha se sobrar qualquer ocorrência do radical
      `confirm` (case-insensitive) fora delas. Rodado: `php artisan test --filter
      GenesisPromptContractTest` → `2 passed (5 assertions)`. Suíte `Unit` completa rodada de novo
      depois da mudança (`php artisan test --testsuite=Unit`) → **205 passed (503 assertions)**,
      sem nenhuma regressão.
- [ ] **1.7** Prova real: 5 análises reais consecutivas (gráficos de verdade) sem
      `TECHNICAL_TEXT_FORBIDDEN:CONFIRM` nem `SCORE_TEXT_FORBIDDEN:CONFIRM` no resultado (prova #06
      do PDF).
      **Atualização (12/08/2026, chave real da OpenAI configurada — ver Fase 12): 1/5 rodada com
      sucesso.** `api.openai.com` responde em ~1s deste ambiente (diferente do Gemini, que trava) —
      1 chamada real via `GraphicalAnalysisDecisionClient` (decorator de log incluído) contra
      `BTCUSDT.P_2026-08-10_10-14-56.png`: `model=gpt-5.6-terra` confirmado na conta real,
      `interaction_id=resp_0796e4bd...`, 109529 tokens de entrada, 3030 de saída, 28,6s de duração,
      tudo logado por `LoggingDecisionClient` exatamente como projetado (Fase 6.2) —
      **nenhum `TECHNICAL_TEXT_FORBIDDEN:CONFIRM`/`SCORE_TEXT_FORBIDDEN:CONFIRM`** (a correção da
      Fase 1.1-1.6 se sustenta contra o modelo real). A resposta falhou validação por 3 outros
      motivos, nenhum ligado a CONFIRM: `CHART_VISIBLE_PRICE_DEVIATION` (chart de 10/08, preço de
      mercado real 2 dias depois — esperado, não é bug), `TEXT_LENGTH:technical_analysis:624:
      expected_400_600` (achado real: `gpt-5.6-terra` não obedeceu o limite de 600 caracteres numa
      chamada isolada — Structured Outputs não garante `maxLength` durante a geração, só a
      estrutura; exatamente o cenário que o mecanismo de repair existe pra corrigir, já provado
      funcionando via mock nas Fases 1.6/2.5/6.4, ainda não confirmado com repair real da OpenAI),
      `UNACCOUNTED_NUMERIC_LITERAL`. Faltam 4/5 chamadas reais sem erro de validação nenhum (não só
      sem CONFIRM) pra fechar a prova #06 por completo — não executado ainda, decisão de gastar mais
      crédito real é do Felipe.
      **Histórico da tentativa original (bloqueada, sem a chave real ainda), preservado abaixo**:
      usando as 3 imagens reais do Downloads (`BTCUSDT.P_2026-08-10_10-14-56.png`,
      `SUIUSDT.P_2026-08-10_10-22-50.png` — Binance Futures 1D, casos que deveriam ser aceitos —
      e `APTUSDT.P_2026-08-10_10-20-23.png` — OKX, caso de rejeição correta, as mesmas 3 do
      incidente original de 08/08/2026) via `php artisan genesis:benchmark-decision` (não grava
      `Analise`/crédito nenhum — chama `GeminiInteractionsClient`/`DecisionResponseValidator`
      direto, mesmo padrão já usado nas sessões anteriores de benchmark). Toda chamada real ao
      Gemini (`https://generativelanguage.googleapis.com/v1beta/interactions`) trava em
      `cURL error 28: Operation timed out after 60012ms with 0 bytes received` — TCP/TLS conecta
      (descartado: bloqueio de rede/proxy — `curl` puro, inclusive com POST de ~450KB de payload
      binário real, responde em ~1s com HTTP 403 pro mesmo host/endpoint), a variável de ambiente
      `HTTPS_PROXY` não está de fato setada (a suspeita inicial era um falso positivo do phpinfo,
      que só reporta um *feature flag* do build do curl, não um proxy configurado), e o tamanho do
      payload não é o problema. A única diferença observada é especificamente a chamada feita pelo
      client HTTP do Laravel (Guzzle/curl via PHP) contra esse endpoint com a `GEMINI_API_KEY`
      configurada — aponta pra chave inválida/expirada fazendo o backend do Google entrar num
      caminho que nunca responde (em vez de rejeitar rápido com 401/403), ou alguma
      particularidade do binário PHP/curl deste ambiente Windows nessa combinação específica de
      TLS/host. **Não é causado pelas mudanças da Fase 1** (o prompt nem chega a ser validado — a
      chamada HTTP nunca recebe resposta). Fica pendente pra alguém com uma `GEMINI_API_KEY`
      confirmadamente válida rodar (localmente ou em homologação) e confirmar a prova #06.

## FASE 2 — P0-03: orçamento de tempo do job / separar enriquecimentos opcionais ✅ concluída (12/08/2026)

**Achado real ao implementar (muda a solução em relação ao texto literal do PDF)**: o PDF sugere
mover narrativa *e* níveis visuais pra fora do caminho crítico igualmente. Investigando o código
real, `visual.levels` (`VisualLevelsService`) **não é** puramente informativo — ele alimenta
`ExecutionPipelineService::generate()` → `ExecucaoService::montarBarreiras()`, usado no cálculo real
dos planos A/B (suporte/resistência com preço real). Adiar essa chamada pra depois da persistência
mudaria o plano de execução calculado — uma regressão de comportamento, não só de timing. Só
`InformativeNarrativeService` (narrativa macro/sentimento, `decision_role=DISPLAY_ONLY`, nunca lida
por nenhum cálculo) saiu do caminho crítico. Documentado em comentário nos 3 arquivos tocados.

- [x] **2.1** `InformativeNarrativeService` extraída de `GraphicalAnalysisAttemptService::attempt()`
      pra um job novo, `app/Jobs/GraphicalAnalysisNarrativeEnrichmentJob.php` (`$tries=1`,
      `$timeout=25`) — despachado por `GraphicalAnalysisAttemptJob::handle()` **depois** de
      `persistIntoExisting()` + `credits->capture()`, no branch `accepted`. `VisualLevelsService`
      permanece dentro de `GraphicalAnalysisAttemptService::attempt()` (caminho crítico), pelo
      motivo acima.
- [x] **2.2** Por construção: a `Analise` já está `COMPLETED` e o crédito já está `CAPTURED` antes do
      enriquecimento sequer começar a rodar. O job de enriquecimento só atualiza
      `evidence_manifest`/`stored_manifest_hash`; nunca toca `analysis_status` nem crédito. Se ele
      falhar (`failed()`), só loga (`genesis.async.enriquecimento_narrativa_falhou`) — não há
      `finalizarComoFalha()` nem estorno nesse caminho.
- [x] **2.3** `GraphicalAnalysisAttemptJob::__construct()`: `$timeout` agora é
      `timeout_seconds(60) + connect_timeout_seconds(10) + visual_levels_timeout_seconds(20) + 15`
      margem = **105s** (era `90s`, sem contar níveis visuais nem narrativa — a causa raiz real do
      P0-03). Nova config `genesis_graphical_v6.visual_levels_timeout_seconds` (env
      `GENESIS_VISUAL_LEVELS_TIMEOUT`, default `20`) — único lugar de verdade, `VisualLevelsService`
      passou a ler o mesmo valor em vez de `Http::timeout(20)` hardcoded.
- [x] **2.4** `retry_after` da conexão `database` (`config/queue.php`, hoje `150`) revisado contra o
      novo `$timeout` (105s) — ainda folgado (45s de margem), não precisou mudar. **Achado
      colateral**: o runbook do Supervisor de produção documentado no spec
      `genesis-analise-grafica-fila-assincrona` (Fase 6) usa `--timeout=120`/`stopwaitsecs=130`,
      calculados sobre o `$timeout` antigo (90s) — com o novo valor (105s) a folga cai de 30s pra
      15s. Recomendo subir pra `--timeout=150`/`stopwaitsecs=160` no próximo deploy; não alterei o
      runbook do outro spec (já marcado concluído) nem tenho acesso a produção pra aplicar — deixado
      como item de atenção pra Fase 12 (corte pra produção) deste spec.
- [x] **2.5** Teste de caminho lento — `tests/Feature/GraphicalAnalysisNarrativeEnrichmentJobTest.php`
      (4 testes novos): narrativa bem-sucedida anexa `macro.narrative`/`sentiment.narrative` ao
      `evidence_manifest` e recalcula `stored_manifest_hash`; **narrativa falhando (HTTP 500
      simulado) não altera `analysis_status`/crédito da análise já `COMPLETED`/`CAPTURED`**
      (prova #07 do PDF, reformulada pro desenho novo — não há mais "timeout" a simular, já que
      narrativa está estruturalmente fora do caminho crítico); enriquecimento ignora análise que
      não chegou a `COMPLETED`; reentrega do job não duplica as 2 entradas no manifesto. Suíte
      completa relevante rodada limpa: `GraphicalAnalysisAttemptJobTest` (5),
      `GraphicalAnalysisAsyncFlowTest` (2), `GraphicalAnalysisInformativeContextTest` (3),
      `GeminiModelUnicoTest` (4), `GraphicalAnalysisNarrativeEnrichmentJobTest` (4) — **18/18**. Full
      suíte `Unit` (205 testes) sem regressão.

**Achados de ambiente durante a verificação (nada relacionado ao código desta fase, documentados pra
não confundir quem investigar de novo)**: `bootstrap/cache/config.php` estava com config em cache
neste ambiente, fazendo `QUEUE_CONNECTION` resolver sempre pra `database` mesmo durante
`php artisan test` (que espera `sync` via `phpunit.xml`) — corrigido com `php artisan config:clear`
(o próprio pedido de migração OpenAI do Felipe já pede esse comando depois de qualquer mudança de
config, então isso é higiene esperada, não um hack pontual). Além disso, a tabela `jobs` local tinha
jobs travados (sem worker rodando) e o `users` tinha pelo menos 2 linhas de teste órfãs (Faker,
`@example.com`, sem crédito/análise) de sessões anteriores colidindo com a sequência determinística
do Faker — limpos com autorização explícita durante a sessão.

## FASE 3 — P0-04: falha real de dispatch não pode ficar oculta ✅ concluída (12/08/2026)

- [x] **3.1** `GraphicalAnalysisController::__invoke()`, bloco `catch (\Throwable $exception)` em
      torno de `GraphicalAnalysisAttemptJob::dispatch()`: depois do `$analise->refresh()`, se
      `analysis_status` continua `PENDING` (não foi o caminho síncrono que já resolveu o estado),
      trata como falha real de enfileiramento — loga (`genesis.async.dispatch_falhou`, antes
      descartada em silêncio por `catch (\Throwable) {}`), marca `FAILED` com
      `failure_reason_code=ANALYSIS_ENQUEUE_FAILED`, estorna o crédito (`$credits->release()`). A
      limpeza da imagem pendente **não** entrou aqui — deixada como `// TODO (Fase 8...)` explícito
      no código, exatamente como o item já previa ("depende da Fase 8"), pra não implementar limpeza
      de imagem duas vezes de formas divergentes.
- [x] **3.2** `tests/Feature/GraphicalAnalysisAsyncFlowTest.php::test_falha_real_no_dispatch_marca_
      failed_estorna_credito_e_nao_deixa_pending_orfao` — força `queue.default=database` (mesmo
      padrão já usado pelo teste de idempotência vizinho no mesmo arquivo) e faz
      `Queue::shouldReceive('connection')->andThrow(...)` simular uma falha real de infraestrutura
      (banco fora do ar/tabela `jobs` ausente) através do POST real
      (`/api/v1/graphical-analysis`). Confirma: resposta `200` com `status=FAILED` +
      `reason_code=ANALYSIS_ENQUEUE_FAILED` (nunca um 500 cru nem um `202/PENDING` mentiroso),
      `Analise` nunca fica `PENDING`, crédito volta ao saldo original, e nenhuma linha órfã em
      `jobs` (prova #09 do PDF). Suíte relevante rodada limpa depois: 24 testes (Attempt/AsyncFlow/
      InformativeContext/GeminiModelUnico/NarrativeEnrichment/SpotRejection/ImageValidation/
      MarketPrice) — **24/24**.

## FASE 4 — Camada de abstração de provedor de IA (pré-requisito da migração) ✅ concluída (12/08/2026)

- [x] **4.1** `App\Services\GraphicalAnalysis\GraphicalAnalysisDecisionClient` (interface nova, no
      mesmo namespace dos implementadores — este projeto não tem convenção de `app/Contracts`, então
      não criei uma só pra isso) com `decide(bundleJson, imageBase64, imageMimeType, ?repair,
      ?modelOverride): array` — mesma assinatura e mesmo shape de retorno
      (`decision`/`raw_text`/`interaction_id`/`usage`/`model`) que `GeminiInteractionsClient::
      decide()` já tinha.
- [x] **4.2** `GeminiInteractionsClient implements GraphicalAnalysisDecisionClient` — só a
      declaração + docblock, corpo da classe intocado.
- [x] **4.3** `config/genesis_graphical_v6.php`: `'provider' => env('AI_PROVIDER', 'gemini')`.
- [x] **4.4** Binding em `GenesisGraphicalServiceProvider::register()` (provider dedicado já
      existente do módulo, não precisou de um novo nem mexer no `AppServiceProvider` genérico —
      esse já tem lógica não-relacionada, de `AI_TRADER_PROVIDER`, e misturar os dois ficaria
      confuso): resolve `gemini` → `GeminiInteractionsClient`; `openai` → lança
      `RuntimeException` explícito ("ainda não implementado — Fase 5") em vez de cair pro Gemini em
      silêncio; qualquer outro valor → lança explicando os 2 valores aceitos. `bind()` (não
      `singleton()`) de propósito — reavalia `config('genesis_graphical_v6.provider')` a cada
      resolução, então testes que trocam a config em runtime funcionam sem precisar reiniciar o
      container. Validação espelhada em `validateConfiguration()` (`boot()`), pra aparecer no log
      assim que a aplicação sobe, não só quando a 1ª análise for tentada.
- [x] **4.5** `GraphicalAnalysisAttemptService` e `BenchmarkGenesisDecision` (único outro consumidor
      real — `ChartMetadataScanService`/`InformativeNarrativeService` mencionam
      `GeminiInteractionsClient.php` só em comentário, não importam a classe) passaram a injetar a
      interface. Descrição do comando `genesis:benchmark-decision` atualizada pra deixar claro que
      mede o decisor **ativo** (`AI_PROVIDER`), não fixo em Gemini — adianta parte do que a Fase
      11.1 (P1-04) pede.
- [x] **4.6** Confirmado por grep real (`GeminiInteractionsClient` só aparece como import/type-hint
      em `BenchmarkGenesisDecision.php` e `GraphicalAnalysisAttemptService.php` — os outros 2 hits
      eram comentário) — nenhuma mudança em `InformativeNarrativeService`, `VisualLevelsService`,
      `ChartMetadataScanService`, `MacroController`, `GeoEventService`,
      `UtilityGeminiProxyController`.
- [x] **Prova real**: `tests/Unit/GraphicalAnalysisDecisionClientBindingTest.php` (4 testes) —
      `provider=gemini` resolve `GeminiInteractionsClient`; `provider=openai` lança com a mensagem
      certa; provider inválido lança; `GraphicalAnalysisAttemptService` continua resolvendo normal
      via container. `php artisan about`/`genesis:benchmark-decision --help` confirmam que o boot da
      aplicação não quebra. Suíte relevante rodada limpa: **48/48** (Attempt/AsyncFlow/
      InformativeContext/GeminiModelUnico/NarrativeEnrichment/SpotRejection/ImageValidation/
      MarketPrice/DecisionClientBinding/DecisionResponseValidator/GenesisPromptContract).

## FASE 5 — Cliente OpenAI Responses API ✅ concluída (12/08/2026)

**🔴 Achado real crítico, leia antes de mexer no `.env` de qualquer ambiente**: esta máquina de dev
já tinha variáveis de ambiente **reais do sistema operacional** chamadas `OPENAI_BASE_URL`,
`OPENAI_API_KEY` e `OPENAI_MODEL` — nada relacionado a este projeto (apontam pra
`opengateway.gitlawb.com`, chave `ogw_live_...`, modelo `mimo-v2.5-pro`; confirmado via `getenv()`,
não é `.env` nem cache de config). Um teste com `Http::fake()` de host específico não interceptou
por isso, e uma chamada real saiu com um payload de teste pra esse domínio desconhecido antes de eu
perceber (nenhum dado sensível de verdade — só fixture de teste — mas o request saiu). Diagnosticado
e decidido junto com o Felipe: **as env vars deste módulo usam o prefixo exclusivo
`GENESIS_OPENAI_DECISION_*`**, não as genéricas `OPENAI_*` do pedido original (que colidem nesta
máquina, e potencialmente em qualquer outra com alguma ferramenta de IA genérica instalada) nem
`GENESIS_OPENAI_KEY`/`GENESIS_OPENAI_MODEL` (já usadas por `AI_TRADER_PROVIDER`,
`config/services.php` — subsistema diferente). `AI_PROVIDER` continua sem prefixo (confirmado
ausente do sistema). **Isso muda o `.env` de produção em relação ao pedido original** — ver mapeamento
completo na Fase 7.3.

- [x] **5.1** `app/Services/GraphicalAnalysis/OpenAiInteractionsClient.php`, implementando
      `GraphicalAnalysisDecisionClient` (Fase 4.1).
- [x] **5.2** `POST {config('genesis_graphical_v6.openai_base_url')}/responses` — default
      `https://api.openai.com/v1/responses`.
- [x] **5.3** Modelo obrigatório `gpt-5.6-terra`. Checagem dupla: `OpenAiInteractionsClient::
      MODELO_PROIBIDO` (cobre `$modelOverride`, ex.: benchmark) + guarda eager em
      `GenesisGraphicalServiceProvider::validateConfiguration()` (cobre o valor de config, falha no
      boot se `AI_PROVIDER=openai` e `GENESIS_OPENAI_DECISION_MODEL=gpt-5.6`).
- [x] **5.4** Payload implementado conforme a documentação pública da Responses API — `model`,
      `instructions=GenesisPrompt::system()`, `input=[{role:user, content:[input_text,
      input_image]}]`, `reasoning.effort`, `store:false`, `text.format` (Structured Outputs). `detail`
      do `input_image` é `config('genesis_graphical_v6.openai_image_detail')` (default `"original"`,
      pedido literal do PO) — **não confirmado contra a API real** (ambiente sem acesso de rede
      sustentável, ver Fase 1.7/12.2), deixado configurável de propósito (troca de 1 linha se a API
      rejeitar; `"high"` é o valor documentado mais próximo se `"original"` não for aceito).
- [x] **5.5** `GenesisDecisionSchema::forOpenAi()` implementado — transformação recursiva genérica
      (`additionalProperties:false` + `required`=todas as chaves, em todo nível), mais simples que
      `forGemini()` porque o dialeto base já é standard JSON Schema. Mantida a estrutura aninhada
      COMPLETA de `visual_observations` (sem achatar como o Gemini precisou) — **não confirmado
      contra API real**, mesmo aviso de incerteza documentado no código. Prova determinística:
      `GenesisDecisionSchemaOpenAiTest` (3 testes, 34 assertions) — percorre a árvore inteira do
      schema confirmando `additionalProperties`/`required` em cada objeto aninhado.
- [x] **5.6** `$timeout` de `GraphicalAnalysisAttemptJob` agora é por provedor **ativo**: Gemini
      ~105s (inalterado da Fase 2), OpenAI ~215s (`openai_timeout_seconds`=180 + níveis visuais 20 +
      margem 15). `retry_after` (`config/queue.php`) subiu de 150→250s — precisa cobrir o PIOR caso
      dos dois provedores possíveis, não só o ativo agora (a troca é 1 variável, sem deploy).
- [x] **5.7** Conversão de resposta implementada — `extractText()` percorre `output[].type=message`
      → `content[].type=output_text` (paralelo a `steps[].content[]` do Gemini), com fallback pro
      `output_text` agregado (não confirmado se existe na resposta crua, ver docblock). Usage
      mapeado: `usage.input_tokens`→`input_tokens`, `usage.output_tokens`→`output_tokens`,
      `usage.output_tokens_details.reasoning_tokens`→`thought_tokens`,
      `usage.input_tokens_details.cached_tokens`→`cached_tokens`.
- [x] **5.8** Mesma sanitização de caracteres de controle + `json_decode` com
      `JSON_THROW_ON_ERROR` replicada em `OpenAiInteractionsClient`.
- [x] **5.9** Confirmado com prova real (não só leitura de código): `GraphicalAnalysisAttemptJobTest`
      passa com `AI_PROVIDER=gemini`; `GraphicalAnalysisOpenAiProviderFlowTest` (novo) roda o MESMO
      pipeline completo (job → `GraphicalAnalysisAttemptService` → `DecisionResponseValidator` →
      `AnalysisPersistenceService`) com `AI_PROVIDER=openai` e payload no formato Responses API —
      `COMPLETED`, direção/score corretos, `model_id=gpt-5.6-terra`, crédito `CAPTURED` — zero
      mudança em validador/persistência entre os dois provedores.
- [x] **Prova real (testes novos)**: `OpenAiInteractionsClientTest` (7 testes — payload shape via
      `Http::assertSent`, mapeamento de usage, guarda de modelo proibido via config e via
      `$modelOverride`, erro de chave ausente, erro HTTP com status+corpo, sanitização UTF-8 inválida
      via reflection), `GenesisDecisionSchemaOpenAiTest` (3 testes), `GraphicalAnalysisOpenAiProviderFlowTest`
      (1 teste, ponta a ponta). `GraphicalAnalysisDecisionClientBindingTest` atualizado (Fase 4 dizia
      "openai ainda não implementado" — agora resolve `OpenAiInteractionsClient` de verdade). Suíte
      relevante completa: **61/61**.

## FASE 6 — Erros, observabilidade e idempotência do provedor OpenAI ✅ concluída (12/08/2026)

- [x] **6.1** `OpenAiInteractionsClient::mapHttpError()` — 401/403→`OPENAI_AUTH_FAILED`,
      429→`OPENAI_RATE_LIMITED`, 5xx→`OPENAI_UNAVAILABLE`, outros→`OPENAI_HTTP_{status}` genérico,
      todos no formato `PREFIXO:{status}:{corpo truncado}`. Timeout de cliente (sem HTTP response
      nenhum — `ConnectionException` do Guzzle) capturado separadamente e mapeado pra
      `OPENAI_TIMEOUT:{mensagem}`.
- [x] **6.2** `app/Services/GraphicalAnalysis/LoggingDecisionClient.php` (decorator novo) — envolve
      o client resolvido (Gemini ou OpenAI) no binding (`GenesisGraphicalServiceProvider`), loga
      `genesis.decisor.chamada_concluida` (provider/model/interaction_id/duration_ms/usage) em
      sucesso e `genesis.decisor.chamada_falhou` (provider/duration_ms/exceção) em erro — cobre as
      duas classes de chamada (1ª tentativa e repair, via `is_repair`), não só o caminho de repair
      que já existia. Decorator em vez de duplicar a lógica em cada client: cobre os dois provedores
      com um código só, e qualquer provedor futuro automaticamente.
- [x] **6.3** Confirmado por design + teste: o decorator só recebe o array que `decide()` devolve
      (nunca a chave — nenhum dos dois clients a inclui no retorno), e nunca loga `decision`/
      `raw_text` (podem ser grandes, sem necessidade operacional). `LoggingDecisionClientTest::
      test_nunca_loga_chave_de_api` configura uma chave de teste plausível e confirma que não
      aparece em nenhum log emitido.
- [x] **6.4** Confirmado com teste real (não só leitura de código):
      `GraphicalAnalysisOpenAiProviderFlowTest::test_reentrega_do_job_apos_completed_via_openai_
      nao_chama_api_de_novo` — despacha o job 2x pra uma `Analise` já `COMPLETED` via OpenAI,
      confirma que o endpoint `/responses` foi chamado exatamente 1 vez no total (a guarda do topo
      de `handle()` já barra a reentrega, provedor nenhum precisou de lógica extra).
- [x] **Prova real**: `LoggingDecisionClientTest` (3 testes), `OpenAiInteractionsClientTest`
      expandido (+6 testes de mapeamento de erro: 401, 403, 429, 5xx, genérico, timeout de cliente —
      achado real ao escrever: `Http::fake(function(){ throw ...})` causa **segfault do PHP** neste
      ambiente Windows, contornado apontando pra uma porta local fechada em vez de simular via fake),
      `GraphicalAnalysisDecisionClientBindingTest` atualizado pra inspecionar o client interno via
      reflection (o binding agora sempre devolve o decorator, não mais o client concreto direto).
      Suíte relevante completa: **70/70**.

## FASE 7 — Paridade dual-provider (Gemini como rollback real) ⚠️ 7.1-7.3 concluídos, 7.4 bloqueado (12/08/2026)

- [x] **7.1** `tests/Unit/GraphicalAnalysisDecisionClientContractTest.php` (3 testes) — mesmo bundle/
      imagem de fixture, roda contra os dois clients concretos (HTTP mockado no formato nativo de
      cada provedor) e confirma: mesmo conjunto de chaves em `decide()` (`decision`,
      `interaction_id`, `model`, `raw_text`, `usage`), mesmo conjunto de chaves em `usage`
      (`input_tokens`/`output_tokens`/`thought_tokens`/`cached_tokens`), e `decision` decodificada
      idêntica quando os dois "concordam" na mesma decisão simulada. **Achado real ao escrever**:
      duas chamadas separadas a `Http::fake(['*' => ...])` no mesmo método NÃO se substituem — a 1ª
      registrada continua respondendo mesmo depois de uma 2ª chamada (mesma classe de armadilha já
      documentada na Fase 5) — corrigido registrando os dois stubs de uma vez, cada um com o padrão
      de host real do provedor (seguro aqui porque a config de cada provedor é fixada explicitamente
      no teste antes da chamada, não depende de nenhum valor ambiente).
- [x] **7.2** Já coberto por `GraphicalAnalysisDecisionClientBindingTest` (Fase 4, atualizado na
      Fase 6) — `config(['genesis_graphical_v6.provider' => 'openai'])` dentro do teste, sem tocar
      em código, confirma que o binding resolve o client interno certo.
- [x] **7.3** `.env.example` atualizado — bloco novo com `AI_PROVIDER` + `GENESIS_OPENAI_DECISION_*`
      (nomes corrigidos na Fase 5, não os genéricos do pedido original) lado a lado com o bloco
      `GENESIS_GEMINI_*` já existente, com o aviso completo sobre a colisão de nomes descoberta e a
      recomendação de rodar `getenv()` antes de configurar em qualquer máquina nova. Também
      documentado `GENESIS_VISUAL_LEVELS_TIMEOUT` (Fase 2), que tinha ficado só no `config/` sem
      entrar no `.env.example`.
- [ ] **7.4** **Bloqueado** — mesma limitação da Fase 1.7/12.2: este ambiente não tem acesso de rede
      que sustente uma chamada real (Gemini já travou em timeout de 60s repetidamente, ver Fase 1).
      Não dá pra rodar "1 análise real" com `AI_PROVIDER=gemini` nem `AI_PROVIDER=openai` de
      verdade. A suíte automatizada substitui a prova real na medida do possível (7.1/7.2 provam a
      troca de provedor e a paridade de contrato via mock) — a prova de ponta a ponta com API de
      verdade fica pendente pra quem tiver acesso, junto com 1.7.

## FASE 8 — P1-03: limpeza de imagens pendentes

## FASE 8 — P1-03: limpeza de imagens pendentes ✅ concluída (12/08/2026)

- [x] **8.1** `GraphicalAnalysisAttemptJob::apagarImagemPendente()` (helper novo, privado) — chamado
      em `finalizarComoFalha()` (cobre `FAILED`), no branch `REJECTED_IMAGE`, e no branch `accepted`
      logo após persistir+capturar crédito. Zera `image_storage_path` no banco junto (evita path
      apontando pra arquivo que não existe mais). Branch `needs_repair` intocado de propósito —
      imagem continua no disco pra próxima tentativa reler.
- [x] **8.1 (controller)**: TODO deixado na Fase 3 resolvido —
      `GraphicalAnalysisController::__invoke()` agora apaga a imagem também no catch de falha real
      de dispatch (`ANALYSIS_ENQUEUE_FAILED`), mesmo padrão do job.
- [x] **8.2** Localizado: `app/Console/Commands/FinalizarAnalisesTravadas.php`
      (`genesis:finalizar-analises-travadas`, agendado a cada 2min). Passou a apagar a imagem
      também. **Achado real ao revisar**: o limiar de "travada" (`timeout_seconds +
      connect_timeout_seconds`, só Gemini) tinha ficado desatualizado desde as Fases 2 e 5 deste
      spec — não contava níveis visuais nem o timeout maior do OpenAI. Corrigido pra espelhar o
      mesmo cálculo por provedor que `GraphicalAnalysisAttemptJob::__construct()` já usa — sem essa
      correção, `AI_PROVIDER=openai` em produção faria este comando marcar como "travada" (e agora
      apagar a imagem de) uma análise ainda dentro do prazo real do job.
- [x] **8.3** `tests/Feature/GraphicalAnalysisImageCleanupTest.php` (6 testes) — imagem some em
      `COMPLETED`, `REJECTED_IMAGE`, `FAILED` (tentativas esgotadas), `FAILED` (dispatch real) e no
      comando de análises travadas (prova #12); imagem **permanece** entre 1ª tentativa inválida e o
      repair seguinte (prova #13). Verificação via `Storage::exists()` do arquivo específico, não
      listagem bruta do diretório (mais preciso, imune a outros testes escrevendo na mesma pasta
      compartilhada). **Achado ao escrever**: `created_at` não está em `$fillable` de `Analise`
      (proteção de mass assignment) — `update(['created_at' => ...])` é descartado em silêncio;
      corrigido com atribuição direta + `save()`. Suíte relevante completa: **79/79**.

## FASE 9 — P1-02: alinhar timeout de polling do frontend ✅ concluída (12/08/2026)

- [x] **9.1** `services/geminiService.ts` — `POLL_TIMEOUT_MS` recalculado com os números reais
      pós Fases 2/5 (não os ~450s do PDF, que eram só do Gemini pré-migração) e subido de
      `5 * 60 * 1000` pra `15 * 60 * 1000`. O frontend não sabe qual provedor está ativo, então
      precisa cobrir o pior caso dos dois: Gemini `3×~105s≈315s` (~5,25min), **OpenAI
      `3×~215s≈645s` (~10,75min) — pior caso real hoje**. 15min dá margem real sobre o pior caso
      legítimo; o caminho de "análise travada" (worker caído) pode ultrapassar isso num cenário de
      falha de infra real, aceitável (o membro vê a mensagem de demora, não perde o crédito — a
      análise trava e o `FinalizarAnalisesTravadas` ainda vai resolver do lado do backend). Suíte
      `__tests__/geminiService.test.ts` rodada antes/depois da mudança: 11 passed/2 failed nos dois
      casos — as 2 falhas são pré-existentes (`localStorage`/token ausente no teste, nada a ver com
      `POLL_TIMEOUT_MS`), confirmado revertendo a mudança e rodando de novo. `tsc --noEmit` limpo.
- [x] **9.2** Decisão registrada: a alternativa melhor (backend devolver `poll_expires_at` real no
      payload `PENDING`, calculado a partir do provedor/timeout de cada análise, em vez do frontend
      manter essa conta duplicada) **não entrou nesta entrega** — mudaria o contrato de
      `AsyncAnalysisResponse::lightweightBody()` no backend e o consumo aqui, escopo maior que só
      ajustar a constante. Documentado como item futuro explícito no comentário do código, não só
      neste spec — quem for implementar a Fase 12 (corte pra produção) ou revisar isso depois não
      precisa vir procurar aqui pra lembrar que essa alternativa existe.

## FASE 10 — P1-01: decisão sobre Orchestrator/cache/lock ✅ concluída (12/08/2026)

- [x] **10.1** **Decisão tomada (Felipe, 12/08/2026): remover.** Confirmado por grep real antes de
      perguntar (não `use`/`::class`/comentário — só código que de fato instancia/importa) que o
      único chamador vivo de `GraphicalAnalysisOrchestrator`/`DecisionCache` era
      `tests/Feature/GraphicalAnalysisLoadTest.php` — nenhuma rota, nenhum job, nenhum comando.
      Motivo registrado: integrar dedup por `chart_fingerprint` ao fluxo assíncrono seria trabalho
      de desenvolvimento real (o lock hoje é pensado pra fluxo síncrono in-process, precisaria ser
      repensado pro contexto de fila), com risco de bugs novos, pra recuperar só uma otimização de
      custo (evitar 2ª chamada real ao decisor quando a MESMA imagem é enviada de novo com
      Idempotency-Key diferente) — não uma correção, e não algo que a prioridade atual (migração
      OpenAI) precisa. Sem essa peça, cada submissão é cobrada e processada corretamente, só sem
      esse desconto específico. Fabrício (PO) ainda precisa confirmar formalmente — decisão tomada
      com o Felipe (dev), registrada aqui pra não ficar em aberto, mas o item original pedia os
      dois.
- [x] **10.2** Removidos: `app/Services/GraphicalAnalysis/GraphicalAnalysisOrchestrator.php`,
      `app/Services/GraphicalAnalysis/DecisionCache.php`. Configs mortas removidas de
      `config/genesis_graphical_v6.php` (`cache_store`, `cache_ttl_seconds`, `lock_seconds`,
      `lock_wait_seconds`) e de `.env.example` (`GENESIS_DECISION_CACHE_*`,
      `GENESIS_DECISION_LOCK_*`). `GenesisGraphicalServiceProvider::validateConfiguration()`
      perdeu a checagem `GENESIS_V64_DECISION_LOCK_TOO_SHORT` e o aviso de cache não-Redis em
      produção (exclusivos de DecisionCache). `GenesisGraphicalPreflight` (`genesis:preflight`)
      perdeu a checagem de lock mínimo e o teste de lock atômico do cache central (nenhum teste
      dependia disso — confirmado, nenhum arquivo cobre este comando). Comentário desatualizado em
      `GraphicalAnalysisController.php` ("ainda intacto/testado") corrigido pra refletir a remoção
      real. `GraphicalAnalysisLoadTest.php`: 3 dos 4 testes originais (E01/E03/E04 — lock ocupado,
      lease perto de expirar, estouro de tentativas via `Orchestrator::analyze()`) removidos; E03
      (estouro de tentativas com estorno) já tinha cobertura equivalente em
      `GraphicalAnalysisAttemptJobTest::test_falha_apos_esgotar_as_3_tentativas` (fluxo
      assíncrono real) — confirmado, não precisou portar. Só o teste de idempotência (E02, não
      depende de Orchestrator/DecisionCache) permanece. Suíte relevante completa: **80/80**
      (incluindo `GraphicalAnalysisOrchestratorPlanoPersistenceTest`, `AnaliseManifestHashSplitTest`,
      `CandlesReuseTest`, `GraphicalAnalysisVersionTest` — nomes/comentários mencionavam
      Orchestrator historicamente, confirmado que nenhum depende de fato da classe removida).

## FASE 11 — P1-04: correção da documentação do benchmark ✅ concluída (12/08/2026)

- [x] **11.1** Não encontrei nenhuma afirmação escrita no repositório (grep em `.php`/`.md`, incluindo
      `CHANGELOG.md`/`PROVAS_V6_7.md`) dizendo que o benchmark mede o Orchestrator — a única
      correção real já tinha sido feita na Fase 4 (`$description` do comando, atualizada quando
      trocou pra injetar a interface). Reforçado agora com um docblock de classe completo em
      `BenchmarkGenesisDecision.php`, listando explicitamente o que ele NÃO cobre (crédito, fila,
      repair via `$tries`, persistência, narrativa/níveis visuais, polling, limpeza de imagem) e
      apontando pro teste da Fase 11.2 como o complemento.
- [x] **11.2** `tests/Feature/GraphicalAnalysisFullPipelineIntegrationTest.php` — 1 teste consolidado
      rodando pela rota HTTP real (não direto no job), `QUEUE_CONNECTION=database` de verdade,
      `AI_PROVIDER=openai`: dispatch pela rota → fila real (`queue:work --stop-when-empty`, que
      processa o job principal E o de enriquecimento na mesma chamada) → persistência → narrativa
      (roda sem quebrar a análise) → polling (`GET /analises/{uuid}` devolve o mesmo estado) →
      limpeza de imagem (arquivo E coluna). Repair/retry ficou deliberadamente fora (já provado a
      fundo em `GraphicalAnalysisAttemptJobTest`; combinar `Http::sequence()` com múltiplas rodadas
      de `queue:work` no mesmo teste é o padrão que já segfaultou nesse arquivo — não valia o risco
      só pra consolidar algo já provado). **Achado real ao escrever**: indo pela rota HTTP de
      verdade (diferente dos outros testes deste spec, que despacham o job direto com
      `pending_bundle` pré-populado), o job tentava construir o bundle de verdade contra a Binance
      real — mesma fragilidade já documentada em `GraphicalAnalysisAttemptJobTest`/
      `GraphicalAnalysisAsyncFlowTest` (evidence_accounting batendo 1:1 com dado real de forma
      determinística é frágil em teste); resolvido pré-populando `pending_bundle` direto no banco
      depois que o POST real já criou a `Analise` `PENDING`, mesma saída que os outros arquivos já
      usam. Suíte relevante completa: **81/81**.

## FASE 12 — Corte para produção ⚠️ checklist pronto, execução bloqueada (12/08/2026)

**Bloqueio igual ao item I-51 da V6.7 e às provas #06/#7.4 deste spec: não tenho acesso a produção
nem a rede que sustente uma chamada real de nenhum provedor daqui** (Gemini travou em timeout
repetidamente, ver Fase 1). Os 3 itens abaixo não puderam ser EXECUTADOS nesta sessão — o que segue
é o checklist mais preciso e específico possível pra quem tiver esse acesso rodar, com todos os
valores reais levantados nas Fases 1-11 (não genéricos).

### 12.1 — Checklist de implantação

1. **Antes de mexer no `.env` de produção**: confirmar que `GENESIS_OPENAI_DECISION_KEY` (e as
   outras 5 variáveis do bloco) não colidem com nada já setado no nível de sistema operacional
   dessa máquina — mesmo achado real que aconteceu na máquina de dev (Fase 5): `OPENAI_BASE_URL`/
   `OPENAI_API_KEY`/`OPENAI_MODEL` genéricos já estavam ocupados por outra ferramenta, sem relação
   com este projeto. Rodar (via SSH na própria máquina de produção):
   ```bash
   env | grep -i "GENESIS_OPENAI_DECISION\|^AI_PROVIDER"
   ```
   Só prosseguir se vier vazio (ou com valores que você reconhece como certos).
2. Adicionar ao `.env` de produção (nunca commitar a chave real em lugar nenhum do repositório):
   ```env
   AI_PROVIDER=gemini
   GENESIS_OPENAI_DECISION_KEY=<chave real da OpenAI>
   GENESIS_OPENAI_DECISION_MODEL=gpt-5.6-terra
   GENESIS_OPENAI_DECISION_BASE_URL=https://api.openai.com/v1
   GENESIS_OPENAI_DECISION_REASONING_EFFORT=medium
   GENESIS_OPENAI_DECISION_TIMEOUT=180
   GENESIS_OPENAI_DECISION_IMAGE_DETAIL=original
   ```
   **`AI_PROVIDER=gemini` de propósito neste passo** — mesmo padrão de corte em duas etapas já usado
   pro `QUEUE_CONNECTION` (Fase 6 do spec `genesis-analise-grafica-fila-assincrona`): aplicar a
   config nova sem trocar o comportamento ainda, confirmar que o boot não quebra, só DEPOIS virar a
   chave. Nunca os dois passos juntos sem confirmação manual entre eles.
3. `php artisan config:clear`. **Não pular este passo** — achado real da Fase 2 deste spec: config
   em cache neste tipo de ambiente já mascarou um comportamento (fez `QUEUE_CONNECTION` ignorar o
   valor real do `.env`) de um jeito que só foi descoberto por acidente, investigando outra coisa.
4. Confirmar boot limpo: `php artisan about` (ou qualquer request real) sem
   `GENESIS_V64_BOOT_INVALID_AI_PROVIDER`/`GENESIS_V64_BOOT_OPENAI_KEY_MISSING` no log
   (`GenesisGraphicalServiceProvider::validateConfiguration()`, Fases 4-5).
5. **Atualizar o Supervisor ANTES de virar `AI_PROVIDER=openai`** — achado real ao revisar (Fase 5):
   o runbook de produção documentado (`/etc/supervisor/conf.d/genesis-queue-worker.conf`, spec
   `genesis-analise-grafica-fila-assincrona` Fase 6) usa `--timeout=120`/`stopwaitsecs=130`,
   calculados só pro Gemini (job timeout ~90-105s). Com `AI_PROVIDER=openai`, o timeout do job sobe
   pra ~215s (`GraphicalAnalysisAttemptJob::__construct()`, Fase 5.6) — `--timeout=120` mataria
   TODA tentativa OpenAI no meio do caminho, antes até do próprio timeout de 180s configurado pro
   provedor. Subir pra `--timeout=250`/`stopwaitsecs=260` (cobre o pior caso dos dois provedores,
   não só o que está ativo agora — mesmo raciocínio já aplicado ao `GENESIS_QUEUE_RETRY_AFTER`,
   Fase 5) antes de qualquer teste com OpenAI, `sudo supervisorctl reread && sudo supervisorctl
   update && sudo supervisorctl restart genesis-queue-worker:*`.
6. Confirmar `GENESIS_QUEUE_RETRY_AFTER` de produção: se houver um valor customizado sobrescrevendo
   o default (250s, Fase 5), confirmar que ainda é maior que o novo `--timeout` do worker (passo 5)
   com folga. Se não houver customização, o default já está correto.
7. Só então: `AI_PROVIDER=openai` no `.env`, `php artisan config:clear` de novo, reiniciar os
   workers de novo (`sudo supervisorctl restart genesis-queue-worker:*`).

### 12.2 — Piloto controlado (10 gráficos reais)

Não executável daqui — procedimento pra quem tiver acesso:

1. Com `AI_PROVIDER=openai` já aplicado (12.1 completo), enviar pelo menos 10 gráficos reais e
   variados pela interface normal (símbolos/timeframes diferentes), incluindo:
   - ao menos 1 gráfico que deveria ser rejeitado (corretora errada, ex.: OKX em vez de Binance —
     mesmo padrão do `APTUSDT.P` usado como fixture nas Fases 1/7 deste spec);
   - ao menos 1 caso que force repair (difícil de garantir de propósito; se não ocorrer
     naturalmente nos 10, não é bloqueante — o caminho de repair já tem prova própria determinística
     na Fase 1.6/2.5/6.4).
2. **A instrumentação pra coletar tokens/duração/status/request id já existe e roda
   automaticamente** (`LoggingDecisionClient`, Fase 6.2) — não precisa de nada novo, só filtrar o
   log de produção por `genesis.decisor.chamada_concluida`/`genesis.decisor.chamada_falhou` no
   período do piloto:
   ```bash
   grep "genesis.decisor.chamada_" storage/logs/laravel.log | grep '"provider":"openai"'
   ```
3. Confirmar pra cada uma das 10: upload → uma única chamada real à OpenAI (não múltiplas por
   tentativa) → validação (`DecisionResponseValidator`) → persistência (`analysis_status`
   correto) → exibição correta no frontend (poll `GET /analises/{uuid}` refletindo o mesmo estado).
4. Confirmar que nenhuma das 10 acionou `TECHNICAL_TEXT_FORBIDDEN:CONFIRM`/
   `SCORE_TEXT_FORBIDDEN:CONFIRM` (fecha a prova #06 do PDF, que ficou pendente desde a Fase 1 por
   falta de acesso de rede daqui).
5. Confirmar limpeza de imagem (Fase 8) pros 10 casos: `graphical-analysis-pending/` sem sobra
   depois de cada estado terminal.

### 12.3 — Rollback testado de verdade

Não executável daqui — procedimento:

1. `AI_PROVIDER=gemini` no `.env` de produção.
2. `php artisan config:clear`.
3. `sudo supervisorctl restart genesis-queue-worker:*` (o `--timeout=250` do passo 12.1.5 já cobre
   o Gemini também, com folga maior ainda — não precisa reverter o Supervisor).
4. Enviar 1 análise real, confirmar que processa normalmente com o Gemini (mesmo comportamento de
   antes desta migração inteira).
5. Registrar aqui os dois resultados lado a lado (Gemini antes, OpenAI durante o piloto, Gemini
   depois do rollback) — prova de que a troca de provedor é reversível de verdade, não só na teoria.

**Nenhum dos 3 itens acima foi marcado como concluído** — ficam como checklist pronto pra execução,
não como trabalho feito. Quem executar deve preencher os resultados reais aqui (ou num documento de
prova separado, seguindo o padrão de `PROVAS_V6_7.md`) antes de considerar a Fase 12 encerrada.

---

## Provas de aceite (consolidado — PDF seção 10 + itens novos da migração OpenAI)

| # | Prova exigida |
|---|---|
| 01 | Ambiente de homologação com `QUEUE_CONNECTION=database`, migrations aplicadas, worker persistente — **já cumprida** (spec de fila assíncrona). |
| 02 | ✅ 1ª resposta inválida, 2ª válida → `COMPLETED`, `attempt=2`, contexto de repair enviado — `GraphicalAnalysisAttemptJobTest` (par `sucesso_apos_repair_1`/`_2`). |
| 03 | ✅ Uma única chamada decisória por execução do job, em qualquer provedor — garantido por design (`GraphicalAnalysisAttemptJob` = 1 tentativa = 1 chamada, `$tries` nativo do Laravel decide se roda de novo) e confirmado em `GraphicalAnalysisOpenAiProviderFlowTest`/`GraphicalAnalysisFullPipelineIntegrationTest` (contagem de chamadas ao `/responses`). |
| 04 | ✅ Teste garantindo que tentativas internas e retries nativos não se multiplicam — `GraphicalAnalysisAttemptJobTest::test_falha_apos_esgotar_as_3_tentativas` (exatamente 3 tentativas, nunca mais). |
| 05 | ✅ Teste determinístico de contrato entre prompt e validador (Fase 1.6) — `GenesisPromptContractTest`. |
| 06 | ⏳ 5 análises reais consecutivas sem `TECHNICAL_TEXT_FORBIDDEN:CONFIRM`/`SCORE_TEXT_FORBIDDEN:CONFIRM` (Fase 1.7) — **1/5 feita com a OpenAI real, zero CONFIRM**; faltam 4, ver nota na Fase 1. |
| 07 | ✅ Teste de caminho lento: decisão válida não se perde com falha no enriquecimento opcional (Fase 2.5) — `GraphicalAnalysisNarrativeEnrichmentJobTest`. |
| 08 | ✅ Evidência de `job timeout < retry_after` pros dois provedores: Gemini 105s, OpenAI ~215s, `retry_after=250s` cobre o pior caso dos dois (Fase 2.3/2.4, atualizado na Fase 5.6) — **atenção**: o Supervisor de produção ainda usa `--timeout=120`, insuficiente pro caso OpenAI; corrigir isso é o passo 12.1.5, ainda não executado. |
| 09 | ✅ Simulação de falha no `dispatch()` sob `database`: `FAILED`, crédito estornado, sem `PENDING` órfão (Fase 3.2). |
| 10 | ✅ Decisão registrada sobre cache, lock e Orchestrator — removido (Fase 10.1). |
| 11 | ✅ Frontend aguardando mais que o pior prazo do backend — 15min > ~10,75min (pior caso OpenAI) (Fase 9.1). |
| 12 | ✅ Imagem some em cada estado terminal (Fase 8.3) — `GraphicalAnalysisImageCleanupTest`. |
| 13 | ✅ Imagem permanece presente entre 1ª tentativa inválida e o repair seguinte (Fase 8.3). |
| 14 *(novo)* | Teste de contrato confirmando shape idêntico entre `decide()` do Gemini e da OpenAI (Fase 7.1). |
| 15 *(novo)* | ✅ Troca de provedor só via config, testada via mock (Fase 7.2). ⏳ Testada com API real nos dois sentidos: bloqueado, checklist pronto na Fase 12.3, não executado. |
| 16 *(novo)* | ✅ Falha de configuração `OPENAI_MODEL=gpt-5.6` (sem sufixo `-terra`) é barrada de forma explícita — dupla guarda, boot + client (Fase 5.3). |
| 17 *(novo)* | ⏳ 10 gráficos reais processados de ponta a ponta com `AI_PROVIDER=openai`: instrumentação pronta e testada (log de tokens/duração/status/request id automático via `LoggingDecisionClient`, chave nunca aparece — Fase 6.2/6.3), execução real bloqueada, checklist pronto na Fase 12.2. |
| 18 *(novo)* | ✅ Erros de autenticação/timeout/rate limit/indisponibilidade da OpenAI resultam em `reason_code` específico (`OPENAI_AUTH_FAILED`/`OPENAI_RATE_LIMITED`/`OPENAI_TIMEOUT`/`OPENAI_UNAVAILABLE`), nunca em exceção não tratada — testado com respostas HTTP reais simuladas e uma `ConnectionException` real (porta fechada local) (Fase 6.1). |

## Ordem de prioridade recomendada

1. Corrigir o conflito prompt × validador (Fase 1) — vale para os dois provedores, base de tudo.
2. Corrigir orçamento de timeout e separar enriquecimentos opcionais (Fase 2).
3. Corrigir o tratamento de falha real no dispatch (Fase 3).
4. Construir a camada de abstração de provedor (Fase 4) — pré-requisito estrutural da migração.
5. Implementar o cliente OpenAI (Fase 5) e seu tratamento de erro/observabilidade (Fase 6).
6. Validar paridade dual-provider e rollback (Fase 7).
7. Implementar limpeza de imagens (Fase 8).
8. Alinhar o polling do frontend (Fase 9).
9. Decidir sobre cache, lock e Orchestrator (Fase 10) e corrigir a documentação do benchmark (Fase 11)
   — podem rodar em paralelo com as fases 5-8, não bloqueiam a migração de provedor.
10. Corte para produção (Fase 12), só depois de 1-8 fechadas e com acesso confirmado ao ambiente real.

*(P0-01, item 2 da priorização original do PDF, já está feito — removido da sequência acima.)*

---

## Status final (12/08/2026)

**Fases 1-11: implementadas, testadas, código real.** Fase 12: checklist pronto, execução
bloqueada — sem acesso a produção nem a rede que sustente uma chamada real de provedor nenhum
neste ambiente (mesma limitação das provas #06/#17 e do item I-51 da V6.7).

**Atualização (12/08/2026, mesma sessão): chave real da OpenAI configurada em `.env` — ver Fase 12.
Diferente do Gemini, `api.openai.com` é alcançável deste ambiente (~1s de resposta).** 1 chamada
real já rodou com sucesso (Fase 1.7): zero problema de `CONFIRM`, pipeline completo funcionando
(bundle real da Binance, chamada real à OpenAI, log completo via `LoggingDecisionClient`). Isso
reabre bastante coisa que estava marcada como "bloqueada por rede" — o bloqueio real era só o
Gemini, não o ambiente como um todo.

Pendências reais que sobram:
1. **Prova #06/1.7** — faltam 4/5 análises reais sem erro de validação (1/5 feita, zero `CONFIRM`).
2. **Prova #17/12.2** — piloto de 10 gráficos reais com `AI_PROVIDER=openai` — agora executável
   deste ambiente, não rodado ainda por completo (decisão de gastar crédito real é do Felipe).
3. **Prova #15/12.3** — rollback testado com API real nos dois sentidos — Gemini continua
   inalcançável deste ambiente, então só a metade OpenAI é executável daqui.
4. **12.1.5** — Supervisor de produção com `--timeout=120` (calculado só pro Gemini) precisa subir
   pra `--timeout=250`/`stopwaitsecs=260` **antes** de qualquer teste com `AI_PROVIDER=openai` —
   senão todo attempt OpenAI morre no meio do caminho, antes até do timeout de 180s do próprio
   provedor.
5. **Fabrício** ainda não confirmou formalmente a decisão de remover Orchestrator/cache/lock (Fase
   10.1) — decisão tomada com o Felipe, registrada, mas o item original pedia os dois.

Suíte automatizada como rede de segurança: **230/230 Unit** + toda a suíte Feature relevante deste
spec (81 testes) verdes na última verificação. Nenhuma dessas pendências bloqueia a suíte — só
bloqueiam a confirmação com API/ambiente real.
