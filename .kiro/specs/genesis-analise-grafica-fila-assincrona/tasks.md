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

## FASE 4 — Controller e endpoint de disparo ✅ concluída (11/08/2026)

- [x] **4.1** `GraphicalAnalysisController` reescrito: valida (inalterado), reserva crédito
      (inalterado), salva a imagem em `Storage::disk('local')`, cria a `Analise` `PENDING`, despacha
      `GraphicalAnalysisAttemptJob::dispatch()`. **Ajuste real em relação ao plano original**: em vez
      de responder sempre `202`/`PENDING`, relê a Analise depois do dispatch e devolve o estado
      ATUAL — com `QUEUE_CONNECTION=sync` (padrão deste ambiente) o job já rodou por completo nesse
      ponto, então mentir "PENDING" seria enganoso; `202` só sai quando genuinamente ainda está
      pendente (fila de verdade em produção).
- [x] **4.2** Idempotência real testada: duas requisições com a mesma `Idempotency-Key` não
      despacham o job 2x nem debitam 2x (`GraphicalAnalysisAsyncFlowTest`).
- [x] **4.3** `FinalizarAnalisesTravadas` (comando novo, agendado a cada 15min, mesmo padrão do
      `EstornarReservasOrfas`) cobre `Analise` presa em `PENDING`. Confirmado que
      `EstornarReservasOrfas` não precisou de nenhuma mudança.
- [x] **4.4** Prova real: `GraphicalAnalysisAsyncFlowTest` (2 testes) — fluxo completo via HTTP com
      `QUEUE_CONNECTION=sync` (resposta do POST já resolvida + poll confirma o mesmo estado) e
      idempotência forçando `QUEUE_CONNECTION=database` só nessa chamada (sem `queue:work` — só o
      `dispatch()`, pra pegar o estado genuinamente `PENDING` antes do job rodar).

**Achado real (bug de verdade, corrigido) — commit `497f3d0`:** com `QUEUE_CONNECTION=sync`, quando
o job precisa esgotar tentativas e lança exceção, `Illuminate\Queue\SyncQueue::handleException()`
chama `$job->failed()` corretamente (a `Analise` fica no estado `FAILED` certo) **mas relança a
exceção em seguida** — sem tratamento, isso quebraria a requisição com um 500 cru do handler padrão
do Laravel em vez da resposta explicada que `failed()` já tinha deixado pronta. Corrigido com um
catch silencioso ao redor do `dispatch()` (só acontece com `sync` — com fila de verdade, `dispatch()`
só enfileira, nunca lança dali).

**Achado real (decisão que a Fase 2.4 tinha deixado em aberto de propósito) — commit `12339c0`:**
confirmado por grep que nenhum código do frontend hoje chama `GET /analises/{id}` (só a lista) — sem
risco de quebrar consumidor real, `COMPLETED` não-legado passou a usar o formato rico
(`AnalysisPublicResponseBuilder`) em vez do `AnaliseTransformer` achatado, tanto no POST quanto no
polling. Sem isso, um poll que terminasse de verdade assíncrono devolveria bem menos dado do que uma
análise síncrona sempre devolveu — `mapGraphicalToLegacy()` (frontend) só sabe consumir o formato
rico. Linha legado continua com `AnaliseTransformer` (nunca teve `decision_payload` preenchido).

Testes existentes: só `GraphicalAnalysisSpotRejectionTest` quebrou de verdade (esperava `422`
direto, agora é `200` + `status`/`reason_code` — a rejeição acontece dentro do job). Confirmado
rodando que `GraphicalAnalysisImageValidationTest`/`GraphicalAnalysisLoadTest` **não precisaram de
nenhuma mudança** (nenhum dos dois dependia do formato antigo). Suíte completa (Unit 203 +
Feature/Integration 48) rodada de novo — limpa.

## FASE 5 — Frontend ✅ concluída (11/08/2026)

- [x] **5.1** `types/graphicalAnalysis.ts`: união discriminada nova
      (`GraphicalAnalysisPendingResult`/`TerminalWithoutDataResult`/`PollResult`/`TerminalResult`)
      em vez de simplesmente alargar `GraphicalAnalysisResult.status` — os outros 3 estados não têm
      nenhum dos campos ricos, exigi-los preenchidos seria enganoso.
- [x] **5.2** `services/geminiService.ts::analyzeChart()` virou "POST dispara, depois poll se
      preciso" — `pollAnalysisUntilTerminal()` (helper novo, não reusa `hooks/useAlertas.ts`/
      `useRadarNewsAlerts.ts` como previsto). Timeout de poll no cliente: 5 minutos, mensagem clara.
- [x] **5.3** `GraphicalAnalysisRequestError` (classe nova, mesmo padrão de `ChartMetadataBlockedError`
      já usado no scan): erros carregam `statusCode`/`reasonCode` do backend, não só a mensagem —
      tanto os síncronos (422/402/409, antes do dispatch) quanto os do poll (`FAILED`/
      `REJECTED_IMAGE`, mapeados pra 503/422 respectivamente).
- [x] **5.4** **Decisão de escopo, registrada aqui**: `isAnalyzing` continua `boolean`, não virou o
      enum de estados sugerido no plano original — a UI já tem vários condicionais amarrados nesse
      boolean (cores, animações, spinner) em `GenesisPage.tsx`; reescrever pra um enum seria uma
      mudança de UI bem maior sem ganho funcional além do que o `AbortController` já entrega. O que
      *foi* implementado de verdade: "CANCELAR ANÁLISE" (antes só hover visual, sem `onClick` —
      clicar durante a análise só retornava sem fazer nada) agora aborta o poll em andamento de
      verdade via `AbortController` — não cancela o job no servidor (crédito já debitado continua
      sendo processado lá), só para o cliente de continuar esperando.
- [x] **5.5** Verificação real: `tsc --noEmit` (`npm run lint` neste projeto) limpo, `npm run build`
      limpo (só o aviso pré-existente de chunk >500kB). Prova manual/e2e na tela real (clicar
      Analisar, ver o resultado chegar, cancelar no meio) não foi feita nesta sessão — precisa de
      sessão de navegador real, mesma limitação já registrada nas Ondas anteriores da V6.7 (sem
      ferramenta de automação de navegador disponível).

**Achado real ao compilar (TypeScript):** `if (status === 'A' || status === 'B') throw; return X;`
não estreitava a união discriminada corretamente depois do `throw` (o compilador mantinha o tipo
mais largo mesmo excluindo os dois literais possíveis) — `if (status !== 'C') throw; return X;`
(match positivo, invertido) resolveu. Não investigado a fundo o motivo exato (possível particularidade
desta versão do TypeScript com union narrowing depois de reatribuição de `let`/expressão ternária
combinada com `throw` dentro de `if`) — registrado aqui como referência caso reapareça em outro lugar
do código.

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

### Runbook real — worker via Supervisor no Ubuntu (CloudPanel)

Servidor real (informado pelo usuário 11/08/2026): `srv1257388`, site `testeapi.genesislabs.com.br`,
caminho `/home/genesislabs-testeapi/htdocs/testeapi.genesislabs.com.br/`, usuário do sistema
`genesislabs-testeapi` (padrão de isolamento por site do CloudPanel — **não** `www-data`).

**1. Instalar o Supervisor:**
```bash
sudo apt update && sudo apt install -y supervisor
```

**2. Confirmar o binário PHP real do site** (CloudPanel gerencia várias versões de PHP por site — o
`php` do `$PATH` pode não ser o mesmo que o painel configurou pra esse domínio):
```bash
su - genesislabs-testeapi -s /bin/bash -c 'which php'
```
Se devolver um caminho versionado (ex.: `/usr/bin/php8.2`), usar esse caminho completo no `command=`
abaixo em vez de só `php`.

**3. Config** — `/etc/supervisor/conf.d/genesis-queue-worker.conf`:
```ini
[program:genesis-queue-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /home/genesislabs-testeapi/htdocs/testeapi.genesislabs.com.br/artisan queue:work database --queue=default --sleep=3 --tries=3 --timeout=120 --max-time=3600
directory=/home/genesislabs-testeapi/htdocs/testeapi.genesislabs.com.br
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=genesislabs-testeapi
numprocs=2
redirect_stderr=true
stdout_logfile=/home/genesislabs-testeapi/htdocs/testeapi.genesislabs.com.br/storage/logs/queue-worker.log
stopwaitsecs=130
```

Valores calculados a partir da config real do job (`GraphicalAnalysisAttemptJob::__construct()`):
timeout por tentativa = `timeout_seconds(60) + connect_timeout_seconds(10) + 20`s de margem = 90s.
- `--timeout=120`: teto do worker, com folga sobre os 90s que o job já declara sozinho.
- `stopwaitsecs=130`: precisa ser maior que `--timeout`, senão o Supervisor mata à força no meio de
  uma tentativa em vez de deixar o Laravel fechar graciosamente.
- `numprocs=2`: ponto de partida — Laravel já trata concorrência com lock na tabela `jobs` (sem risco
  de duas cópias do worker pegarem a mesma análise), o número certo depende do rate limit real da
  conta Gemini. Subir se `jobs` acumular fila.

**Aviso futuro (spec `genesis-v6-8-correcao-tecnica`, Fase 1.6, 14/08/2026)**: `config/queue.php`
teve o `retry_after` do driver `database` subido de 250 para 350 antecipando a Fase 4/5 daquele
spec, que move a leitura visual e a coleta de contexto (hoje chamadas separadas/best-effort) para
DENTRO do mesmo job síncrono, antes da decisão — o orçamento real do job sobe de ~90-215s para
~300s. **Quando aquela fase for aplicada em produção, os valores REAIS deste runbook também
precisam subir** — `--timeout=120` para algo como `--timeout=300` e `stopwaitsecs=130` para
`stopwaitsecs=330` (ambos acima do novo orçamento, com a mesma folga proporcional que os valores
atuais já têm sobre os 90s de hoje) — senão o Supervisor mata o worker no meio de uma tentativa que
ainda está dentro do prazo esperado. Não alterado agora porque o job real ainda não mudou; fica
registrado aqui para não ser esquecido no dia do deploy daquela fase.
- `--max-time=3600`: reinicia o processo a cada 1h (evita memory leak de worker de longa duração).

**4. Aplicar e subir:**
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start genesis-queue-worker:*
sudo supervisorctl status genesis-queue-worker:*
```

**5. Validar (6.3) antes de virar a chave** — com `QUEUE_CONNECTION` ainda em `sync`:
```bash
su - genesislabs-testeapi -s /bin/bash -c 'php /home/genesislabs-testeapi/htdocs/testeapi.genesislabs.com.br/artisan queue:work database --once --queue=default'
```
Confirmar que processa um job de teste real sem erro antes do passo 6.4.

**6. Cutover (6.4)** — `.env` de produção: `QUEUE_CONNECTION=database`, depois:
```bash
php artisan config:clear
sudo supervisorctl restart genesis-queue-worker:*
```

**Operação do dia a dia:**
- Depois de todo deploy (o worker mantém código antigo em memória até reiniciar):
  ```bash
  php artisan queue:restart
  ```
  Sinaliza os workers a terminarem o job atual e reiniciarem — Supervisor sobe de novo sozinho
  (`autorestart=true`).
- Monitorar (6.5, sem alerta automático configurado):
  ```bash
  sudo supervisorctl status genesis-queue-worker:*
  tail -f /home/genesislabs-testeapi/htdocs/testeapi.genesislabs.com.br/storage/logs/queue-worker.log
  php artisan tinker --execute="echo DB::table('failed_jobs')->count();"
  ```

---

## Testes existentes que quebravam — resultado real (confirmado rodando, não só previsto)

- `GraphicalAnalysisSpotRejectionTest.php`: **quebrou de verdade**, atualizado. Esperava `422` direto
  no POST; agora a rejeição acontece dentro do job (assíncrono) — resposta virou `200` +
  `{status: 'REJECTED_IMAGE', reason_code: 'IMAGE_REJECTED'}`.
- `GraphicalAnalysisLoadTest.php`: **não quebrou, confirmado rodando sem mudança nenhuma** — os 3
  testes que importavam (`double_click`, `concurrent_requests`, `failure_after_repair_attempts`)
  testam `CreditReservationService`/`DecisionCache`/`GraphicalAnalysisOrchestrator::analyze()`
  diretamente, nunca passam pelo controller HTTP.
- `GraphicalAnalysisImageValidationTest.php`: **não quebrou, confirmado rodando sem mudança
  nenhuma** — `test_accepts_mobile_portrait_screenshot_dimensions` só verifica `!== 422` (segue
  válido, agora normalmente `200`/`202`); `test_rejects_extreme_strip_image` falha na validação do
  Form Request, antes do controller rodar, também inalterado.
- `GraphicalAnalysisOrchestratorPlanoPersistenceTest`/`VersionTest`/`MarketPriceTest`: não quebraram
  (testam via reflection/chamada direta, não HTTP) — mas 2 deles (`VersionTest`, `MarketPriceTest`)
  e o primeiro precisaram de um ajuste **não relacionado a HTTP**: a extração de
  `publicResponse()`/`persistPlanos()` do orchestrator pra `AnalysisPublicResponseBuilder`/
  `AnalysisPersistenceService` (Fase 2) tornou esses métodos públicos em outra classe — reflection
  sobre o método privado antigo parou de existir, trocado por chamada direta ao método público novo.

## Fora de escopo deste spec

- Configurar/monitorar o worker de produção de fato (infraestrutura fora do meu alcance).
- Redis/SQS ou qualquer driver de fila além de `database` (mais simples, sem infra nova além da
  tabela — suficiente pro volume atual, sem indicação de que precise de mais).
- Cancelamento de verdade do job no servidor quando o membro fecha a tela (Fase 5 só para o polling
  no cliente — o job continua rodando no servidor até terminar; cancelamento server-side ficaria
  pra uma iteração futura se o usuário achar necessário).
