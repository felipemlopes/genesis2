# Plano de Implementação: Fila assíncrona para a análise gráfica (job + polling)

## Contexto — por que isso existe

Cliente reportou (08/08/2026) erro `500` sem corpo nenhum na resposta ao enviar gráficos reais do
BTC e do SUI pra `/api/v1/graphical-analysis` (o APT, terceiro gráfico, foi corretamente rejeitado
por ser da OKX — não é bug). Investigação real (não suposição — commit `a7cb38d` documenta a
descoberta) achou a causa: o endpoint é 100% síncrono, e pode fazer até `max_attempts` (3) chamadas
sequenciais ao Gemini dentro da mesma requisição HTTP, cada uma com até `timeout_seconds +
connect_timeout_seconds` (70s) — pior caso ~210s. Isso ultrapassa o `max_execution_time` do PHP
(120s neste ambiente de dev, tipicamente 30-120s em produção). Um timeout de PHP é fatal de verdade,
**não é capturável por `catch(\Throwable)`** — o script morre no meio, sem o Laravel conseguir montar
resposta nenhuma. Já tinha acontecido 2x antes por outro motivo (comentário pré-existente no código,
`V6.6/E02`, 40 créditos perdidos) — mesma classe de bug, causa raiz nova.

**Confirmado que piorou com a V6.7**: o commit `a085adc` (H-50) acrescentou 2 checks novos no
validador (`TECHNICAL_TEXT_FORBIDDEN:CONFIRM`, `SCORE_TEXT_FORBIDDEN:CONFIRM`) — mais um jeito da 1ª
resposta do Gemini falhar e precisar de repair, aumentando a chance estatística de cair no pior caso
de tempo.

**Mitigação já aplicada** (commits `9557a65`, `a7cb38d`, ainda em produção como paliativo, não como
solução definitiva): `set_time_limit()` desacopla o endpoint do teto padrão do servidor, e o
`register_shutdown_function` tenta entregar uma mensagem JSON ao cliente antes do processo morrer.
Isso reduz o dano mas **não resolve a causa raiz** — só empurra o mesmo limite pra mais tarde, o que
o usuário rejeitou explicitamente como solução ("não adianta ficar aumentando tempo").

**O que este spec propõe**: eliminar a causa raiz estrutural. Nenhuma chamada ao Gemini deve rodar
dentro de uma requisição HTTP viva. Cada tentativa de análise vira um job de fila independente, com
seu próprio orçamento de tempo curto (cobre só 1 chamada, nunca 3 empilhadas), usando o mecanismo
nativo de retry do Laravel para as tentativas de repair. O frontend passa a consultar o andamento por
polling em vez de esperar dentro de uma única requisição.

**Repositórios**: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** =
`c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main`.

## Risco operacional — ler antes de aprovar

Esta mudança **exige um worker de fila rodando 24/7 em produção** (`php artisan queue:work`,
gerenciado por Supervisor/systemd/Agendador de Tarefas — não existe hoje, `QUEUE_CONNECTION=sync` no
`.env` atual, sem tabela `jobs`, sem `app/Jobs/` no projeto). Eu não tenho acesso a produção pra
configurar nem verificar esse processo (mesma limitação já registrada no item I-51 da V6.7). Se o
worker não estiver rodando quando isso for pro ar, **a funcionalidade de análise gráfica para de
funcionar por completo** para todo mundo (pior que o bug atual, que só afeta análises que precisam de
repair) — os jobs ficam empilhados na tabela `jobs` pra sempre, sem erro nenhum visível.
**Recomendação: fazer o cutover em duas etapas** — (1) subir o worker em produção e confirmar via
`php artisan queue:work --once` manual que processa um job de teste; só depois (2) trocar
`QUEUE_CONNECTION=sync` por `database` no `.env` de produção. Nunca implantar os dois passos juntos
sem confirmação manual entre eles.

## Arquitetura

```
POST /v1/graphical-analysis
  → valida (GraphicalAnalysisRequest, inalterado)
  → reserva crédito (CreditReservationService::reserve(), inalterado)
  → idempotência: Analise::where('credit_reservation_id', $reservation->id)->first()
    já existe? devolve o estado atual (mesmo padrão de hoje)
  → NÃO existe: guarda a imagem em disco (Storage), cria a Analise já
    (analysis_status='PENDING'), despacha o job, responde rápido (202)

GraphicalAnalysisAttemptJob (1 job = 1 tentativa, não as 3 juntas)
  → tries=3 (mesmo max_attempts de hoje), timeout≈90s (1 chamada + folga, NUNCA 3×)
  → tentativa >1: lê o repair_context persistido no banco (não em variável local —
    job novo, memória nova a cada retry do Laravel)
  → 1 chamada ao Gemini (GeminiInteractionsClient::decide(), inalterado)
  → válida e aceita → persiste (reusa ExecutionPipelineService/persist(), captura crédito)
  → validamente rejeitada (ex.: corretora errada) → finaliza como REJECTED_IMAGE,
    estorna crédito — não é falha do job, é um resultado válido e final
  → inválida, sobra tentativa → grava repair_context, lança exceção →
    Laravel re-executa o job do zero, com orçamento de tempo novo
  → esgotou as 3 tentativas (por validação OU por timeout OU por crash) →
    failed() roda: marca Analise FAILED com motivo, estorna crédito

GET /v1/analises/{uuid}  (endpoint já existente, AnaliseController::show — reusado, não novo)
  → PENDING: {status:'PENDING'}
  → COMPLETED/REJECTED_IMAGE: mesmo payload de hoje (AnaliseTransformer + o que
    já é exposto por publicResponse() — reconciliar os dois formatos, ver Fase 2)
  → FAILED: {status:'FAILED', reason_code, motivo} (mesmo formato de erro que
    GraphicalAnalysisException já usa hoje, pra reaproveitar tratamento no FE)

Frontend: analyzeChart() deixa de ser 1 fetch que espera — vira dispatch + poll
  (helper novo, intervalo curto, para no primeiro estado terminal)
```

---

## FASE 1 — Infraestrutura de fila (backend, sem mudar comportamento ainda) ✅ concluída (11/08/2026)

- [x] **1.1** Migration `jobs` (schema padrão do Laravel: `queue:table`). `job_batches` não foi
      necessária (nenhum uso de `Bus::batch` planejado). `failed_jobs` já existia, não mexida.
      Aplicada de verdade via `php artisan migrate --force`
      (`database/migrations/2026_08_11_000001_create_jobs_table.php`).
- [x] **1.2** `config/queue.php`: `retry_after` da conexão `database` subiu de 90 pra 150
      (`env('GENESIS_QUEUE_RETRY_AFTER', 150)`) — acima do `$timeout` do job (90s), evita dois
      workers pegando a mesma tentativa ao mesmo tempo.
- [x] **1.3** `app/Jobs/GraphicalAnalysisAttemptJob.php` criado — skeleton: `$tries`/`$timeout`
      calculados no construtor a partir de `config('genesis_graphical_v6.*')`, não chumbados.
      `handle()` ainda é só um log de smoke test (Fase 1) — lógica real de negócio (Gemini, persist,
      repair, `failed()`) entra na Fase 3, ainda não escrita.
- [x] **1.4** `.env.example`: comentário acima de `QUEUE_CONNECTION` avisando que só pode virar
      `database` em produção depois de confirmar manualmente que existe worker rodando 24/7 lá —
      sem isso a análise gráfica para de funcionar por completo, não só o caso de timeout.
      `GENESIS_QUEUE_RETRY_AFTER=150` documentado também.
- [x] **1.5** Prova real (11/08/2026): job despachado explicitamente na conexão `database`
      (`GraphicalAnalysisAttemptJob::dispatch(999999)->onConnection('database')`, sem mudar o
      `QUEUE_CONNECTION` padrão do app, que continua `sync`) — `php artisan queue:work database
      --once` processou: `RUNNING` → `DONE` (93ms). Tabela `jobs` voltou a 0 linhas depois,
      `failed_jobs` continuou em 0. Log confirma os valores calculados corretamente: `tries=3`
      (= `max_attempts`), `timeout=90` (= 60 + 10 + 20 de margem), `attempt=1`. Suíte PHPUnit Unit
      completa (203 testes) rodada de novo depois da mudança em `config/queue.php` — limpa.
      Commit: `3cc1825` (genesis-api).

## FASE 2 — Persistência e estados novos (backend) ✅ concluída (11/08/2026)

- [x] **2.1** Migration aditiva em `genesis_analises`: `image_storage_path`, `image_mime_type`,
      `failure_reason_code`, `failure_message`, `repair_last_errors` (json), `repair_last_decision`
      (json), e mais `pending_bundle` (json — achado durante a Fase 3, ver nota lá). Todas
      nullable/aditivas, aplicadas de verdade (`php artisan migrate --force`):
      `2026_08_11_000002_add_async_fields_to_genesis_analises_table.php` +
      `2026_08_11_000003_add_pending_bundle_to_genesis_analises_table.php`.
- [x] **2.2** `analysis_status` documentado no model (`app/Models/Analise.php`) com os valores novos
      (`PENDING`/`FAILED`, além de `COMPLETED`/`REJECTED_IMAGE` já existentes) — sem migration de
      schema, como previsto.
- [x] **2.3** `AnaliseTransformer` expõe `analysis_status`/`failure_reason_code`/`failure_message`.
- [x] **2.4** Decisão tomada (mais conservadora que a recomendação original, depois de revisar o
      código de verdade): `AnaliseController::show()` faz um atalho enxuto (sem `AnaliseTransformer`)
      pra `PENDING`/`FAILED`/`REJECTED_IMAGE` — nenhum dos três tem `decision_payload`/
      `evidence_manifest` preenchido, não vale a pena montar o payload rico. `COMPLETED` e linhas
      legado continuam exatamente como antes (zero risco pra quem já consome `/analises` hoje).
      `publicResponse()`/`persist()`/`persistPlanos()`/`planoRow()` foram extraídos do orchestrator
      pra duas classes novas reusáveis (`AnalysisPublicResponseBuilder`,
      `AnalysisPersistenceService`) — usadas tanto pelo fluxo síncrono quanto pelo job (Fase 3),
      sem duplicar lógica. Decisão de unificar de vez os dois formatos de resposta (rico vs.
      transformer) para o caso `COMPLETED` via polling fica em aberto pra Fase 5 (depende de mapear
      todo consumo do endpoint no frontend antes de mudar o shape compartilhado).
- [x] **2.5** Prova real: `tests/Feature/AnaliseShowAsyncStatusTest.php` (4 testes) — grava uma
      Analise em cada estado e confirma o shape exato de `GET /api/v1/analises/{uuid}` pra cada um.
      Rodado contra o banco de dev real, limpo.

**Achado ao implementar (fora do escopo original do spec):** `CanonicalBundleBuilder::build()`
recebia `UploadedFile $image` só pra recalcular o fingerprint internamente — único uso real era
extrair `image_hash`/`chart_fingerprint`. Como o fluxo assíncrono nunca tem um `UploadedFile` (não
sobrevive à serialização da fila), a assinatura mudou pra receber o fingerprint já calculado —
`AnalysisFingerprintService` sai do `CanonicalBundleBuilder`, o cálculo passa pro chamador (que já
fazia isso de qualquer forma). 3 call sites atualizados:
`GraphicalAnalysisOrchestrator::generate()`, `BenchmarkGenesisDecision` (comando),
`CandlesReuseTest` (teste). Suíte completa (Unit 203 + Feature/Integration 46) rodada de novo depois
dessa mudança — limpa.

## FASE 3 — O job em si ✅ concluída (11/08/2026)

- [x] **3.1** `GraphicalAnalysisAttemptJob::handle()` recebe só `Analise->id`. Idempotente: retorna
      sem fazer nada se `analysis_status` já é `COMPLETED`/`REJECTED_IMAGE`/`FAILED`.
- [x] **3.2** Repair context lido/gravado em `repair_last_errors`/`repair_last_decision` (banco), não
      em variável local. **Achado ao implementar**: o bundle (`bundle_json`/`manifest_hash`/
      `candles`) também precisa sobreviver entre tentativas — o prompt assume "SNAPSHOT_CANONICO"
      igual em todas as tentativas de repair, e reconstruir a cada execução do job arriscaria pegar
      dados de mercado diferentes minutos depois. Coluna nova `pending_bundle` (json) resolve isso:
      construído só na 1ª tentativa, reaproveitado nas seguintes, limpo ao concluir.
- [x] **3.3** 1 chamada ao Gemini por execução — via `GraphicalAnalysisAttemptService::attempt()`
      (extraído do corpo do loop de `GraphicalAnalysisOrchestrator::generate()`, sem mudar
      comportamento; o loop em si continua só no fluxo síncrono, que decide repetir in-process).
      `GeminiInteractionsClient`/`DecisionResponseValidator` inalterados.
- [x] **3.4** Caminho de sucesso usa `AnalysisPersistenceService::persistIntoExisting()` (novo método
      — a Analise já existe como `PENDING`, só precisa ser preenchida; `persist()`, usado pelo fluxo
      síncrono, continua criando uma linha nova). Os dois compartilham `computeAttributes()`
      (privado) — mesma lógica de cálculo (pipeline de execução, evidence_manifest, hashes), sem
      duplicação.
- [x] **3.5** Rejeição válida finaliza como `REJECTED_IMAGE` + estorna crédito, sem lançar exceção
      (não conta como tentativa falhada).
- [x] **3.6** Repair necessário grava contexto e lança `\RuntimeException` — Laravel re-executa via
      `$tries` nativo.
- [x] **3.7** `failed(Throwable $exception)` marca `FAILED` + estorna crédito, com `reason_code`
      distinguindo `MODEL_OUTPUT_INVALID_AFTER_REPAIR` (esgotou por validação) de
      `ANALYSIS_UNAVAILABLE` (qualquer outra causa — timeout, crash).
- [x] **3.8** Prova real: `tests/Feature/GraphicalAnalysisAttemptJobTest.php` (5 testes) — sucesso na
      1ª tentativa, sucesso na 2ª após repair (dividido em 2 métodos, ver achado abaixo), rejeição
      válida na 1ª, falha após esgotar as 3 tentativas (`FAILED` + estorno + linha em `failed_jobs`
      confirmados no banco). Dispatch real na conexão `database` + `php artisan queue:work` via
      `Artisan::call()` no mesmo processo (só assim `Http::fake()` é compartilhado). Rodado 3x
      seguidas, limpo todas as vezes.

**Achados reais ao implementar/testar (fora do escopo original do spec):**
- Uma 2ª chamada a `Artisan::call('queue:work', ...)` no mesmo processo PHP — mesmo em métodos de
  teste diferentes — **segfaulta** nesta versão/ambiente do Laravel/PHP (reproduzido isolado,
  confirmado não ser bug deste job). Contornado com `--process-isolation` no PHPUnit (cada método
  ganha processo novo) + `--stop-when-empty` (processa múltiplas tentativas num loop interno de uma
  só chamada, quando cabem no mesmo método) + split em 2 métodos sequenciais pra o único cenário que
  não coube nesse padrão (repair então sucesso, que também segfaultava mesmo com
  `--stop-when-empty` — causa não identificada a fundo, decisão foi contornar em vez de investigar
  mais, dado que a lógica do job já estava provada correta pelos outros 3 testes). **Rodar sempre
  com `--process-isolation`** — documentado no docblock do arquivo de teste.
- `LIKE` do MySQL trata `\` como caractere de escape — filtrar `failed_jobs`/`jobs` por um payload
  serializado que contém `\"` literal não funciona com `LIKE` direto (precisaria escapar o próprio
  escape). Resolvido filtrando em PHP (`str_contains()` sobre os payloads já buscados) em vez de
  tentar acertar o escaping do SQL.
- `AnalysisPersistenceService::persist()` (fluxo síncrono, cria linha nova) e
  `persistIntoExisting()` (fluxo assíncrono, preenche linha `PENDING` existente) precisaram ser
  duas entradas públicas distintas — a Analise do fluxo assíncrono já nasce com `analysis_uuid`/
  `user_id`/`credit_reservation_id`/`ativo`/`corretora`/`timeframe` preenchidos pelo controller
  (Fase 4), não faz sentido recriá-los.

Suíte completa (Unit 203 + Feature/Integration 46) rodada de novo depois de toda a Fase 3 — limpa.

## FASE 4 — Controller e endpoint de disparo

- [ ] **4.1** `GraphicalAnalysisController`: mantém validação (`GraphicalAnalysisRequest`, inalterada)
      e reserva de crédito (inalterada). Muda o que acontece depois: salva a imagem em
      `Storage::disk(...)` (path gravado na Analise, coluna nova da Fase 2), cria a `Analise` com
      `analysis_status='PENDING'` (pré-populando `ativo`/`timeframe`/`alavancagem_membro`/
      `margem_membro`/`credit_reservation_id`/`analysis_uuid` — todos já existem no fillable),
      despacha `GraphicalAnalysisAttemptJob::dispatch($analise->id)`, responde **202** com
      `{analysis_id: uuid, status: 'PENDING'}`.
- [ ] **4.2** Idempotência: mantém o padrão já existente (`Analise::where('credit_reservation_id',
      ...)->first()`) — se já existe uma Analise pra essa reserva, devolve o estado atual dela em vez
      de despachar de novo.
- [ ] **4.3** Segurança de crédito órfão: `EstornarReservasOrfas` (comando existente, 15 min) **já não
      precisa mudar** — como a `Analise` agora nasce junto com a reserva (antes do dispatch), a
      condição `whereDoesntHave('analise')` desse comando nunca mais vai bater pra reservas em
      processamento assíncrono (confirmado por leitura do comando). **Precisa de um comando novo**
      pra cobrir o caso que não existia antes: `Analise` presa em `PENDING` por tempo demais (worker
      caiu, nunca pegou o job) — mesmo padrão do `EstornarReservasOrfas`, mas filtrando
      `analysis_status='PENDING'` e `created_at` antigo, finalizando como `FAILED` + estornando.
- [ ] **4.4** Prova: teste real do fluxo completo, POST → 202 → poll até COMPLETED, rodando com
      `QUEUE_CONNECTION=sync` neste ambiente de dev (job roda inline, sem precisar de worker separado
      pra validar a lógica — só o *comportamento*, não a infra de produção).

## FASE 5 — Frontend

- [ ] **5.1** `types/graphicalAnalysis.ts`: `GraphicalAnalysisResult.status` deixa de ser só o literal
      `'COMPLETED'` — precisa aceitar `'PENDING' | 'COMPLETED' | 'REJECTED_IMAGE' | 'FAILED'`.
- [ ] **5.2** `services/geminiService.ts::analyzeChart()`: muda de "1 fetch que espera" pra "POST
      dispara, depois poll". Novo helper de poll **não reusa** `hooks/useAlertas.ts`/
      `useRadarNewsAlerts.ts` como estão (são polling de feed com cursor incremental, esse caso é
      "consultar 1 job específico até estado terminal" — forma diferente, escrever helper novo,
      simples: intervalo curto, para no primeiro estado terminal, timeout de poll no cliente também
      (ex.: desiste depois de N minutos com mensagem clara, não fica polling pra sempre)).
- [ ] **5.3** Tratamento de erro por status code: hoje `analyzeChart()` não distingue 422/402/409/503
      entre si (achado da exploração, gap pré-existente) — no fluxo novo, a resposta do POST inicial
      (falha de validação/crédito) e a resposta do poll (`FAILED`) vêm de pontos diferentes; vale
      corrigir esse gap agora já que os dois caminhos precisam de tratamento explícito de qualquer
      forma.
- [ ] **5.4** `pages/GenesisPage.tsx::handleAnalyze()`: `isAnalyzing` (boolean) vira um estado com mais
      fases (ex.: `'idle' | 'queued' | 'processing' | 'done' | 'error'`) pra UI poder mostrar algo
      melhor que "Processando Dados" fixo por até 3 minutos. O botão "CANCELAR ANÁLISE" (hoje só
      visual, sem `onClick`) pode ganhar função de verdade aqui: parar o polling (não cancela o job no
      servidor, só para de esperar por ele no cliente).
- [ ] **5.5** Prova: teste manual/e2e do fluxo completo na tela — disparo, tela de processando, chegada
      do resultado via poll, e um caso de falha mostrando mensagem clara.

## FASE 6 — Migração seguindo o risco operacional (ver seção no topo)

- [ ] **6.1** Confirmar com o usuário (Felipe) que existe (ou será criado) processo de worker
      persistente em produção antes de qualquer cutover — **fora do meu alcance verificar sozinho**.
- [ ] **6.2** Deploy do código com `QUEUE_CONNECTION` ainda em `sync` — nada muda em produção ainda
      (a fila roda inline, mesmo comportamento de hoje, só a estrutura de código já no lugar).
- [ ] **6.3** Subir o worker, confirmar manualmente que processa (`queue:work --once` num job de
      teste real).
- [ ] **6.4** Só então trocar `QUEUE_CONNECTION=database` em produção.
- [ ] **6.5** Monitorar `failed_jobs` e a tabela `jobs` nos primeiros dias — não existe alerta
      automático configurado nesse projeto hoje, precisa ser checado manualmente ou o usuário decidir
      se quer configurar algo (fora do escopo deste spec).

---

## Testes existentes que quebram e precisam de rework

- `tests/Feature/GraphicalAnalysisLoadTest.php` e `GraphicalAnalysisSpotRejectionTest.php` (únicos que
  fazem round-trip completo com `Http::fake`) — assumem resposta síncrona completa no POST. Com
  `QUEUE_CONNECTION=sync` no ambiente de teste isso deve continuar funcionando quase sem mudança
  (job roda inline na mesma requisição de teste), só as asserções de shape/status code do POST
  (202 + PENDING, em vez do resultado final) precisam atualizar.
- `GraphicalAnalysisImageValidationTest.php`: caso de aceite (`test_accepts_mobile_portrait_screenshot_dimensions`)
  só verifica `status() !== 422` — vai continuar válido (still not 422, agora é 202), sem mudança.
- Os outros 3 arquivos de teste do pacote (`GraphicalAnalysisOrchestratorPlanoPersistenceTest`,
  `VersionTest`, `MarketPriceTest`) testam lógica pós-persistência via reflection direta — não
  dependem do fluxo HTTP, não deveriam quebrar.

## Fora de escopo deste spec

- Configurar/monitorar o worker de produção de fato (infraestrutura fora do meu alcance).
- Redis/SQS ou qualquer driver de fila além de `database` (mais simples, sem infra nova além da
  tabela — suficiente pro volume atual, sem indicação de que precise de mais).
- Cancelamento de verdade do job no servidor quando o membro fecha a tela (Fase 5 só para o polling
  no cliente — o job continua rodando no servidor até terminar; cancelamento server-side ficaria
  pra uma iteração futura se o usuário achar necessário).
