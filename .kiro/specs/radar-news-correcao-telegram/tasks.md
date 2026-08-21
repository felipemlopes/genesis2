# Plano de Implementação: Radar News — Correção P0 (geração e envio ao Telegram)

**Status deste documento**: criado como planejamento puro (21/08/2026), a partir do documento
`CORRECAO_RADAR_NEWS_TELEGRAM.md` (Felipe, 20/08/2026). A Fase 0 (verificação contra o código
real) foi feita na escrita deste plano.

**Atualização (21/08/2026, execução) — Fases 1-10 de código implementadas e testadas na mesma
sessão.** Tudo que não escreve no banco/produção está feito: 3 migrations novas criadas (código),
model Laravel atualizado, validação de env/schema/Telegram no startup, persistência de
`title_original`/`piso_aplicado`, máquina de estados do despacho e do resumo diário, reordenação
do loop, teste de congelamento, `.conf` do Supervisor atualizado. `python -m pytest tests/` →
**122 passed** (93 no arquivo principal, +25 novos desta correção, zero regressão nos outros 2
arquivos de teste). PHP: `php -l` limpo nos 3 migrations + no model. **Dois itens ficam
propositalmente não executados, aguardando sua autorização explícita** (🔒-DB/🔒-INFRA, ver Fase 1
e Fase 9 abaixo): rodar `php artisan migrate` para as 3 tabelas novas, e rodar o seeder da
carteira (a leitura de diagnóstico já mostrou 0 linhas na tabela real — ver Fase 9).

## Fontes

1. `CORRECAO_RADAR_NEWS_TELEGRAM.md` — documento de Felipe, 20/08/2026, P0/bloqueio de produção.
   Não copiado para o repositório (mesma convenção dos specs anteriores — fica como fonte
   externa); este plano referencia as seções dele pelo número.
2. `.kiro/specs/radar-news-v1-1-monitor/tasks.md` — spec anterior (05/08/2026) que implementou
   D1-D4/E1-E2/Bloco G só com teste mockado e deixou registradas, sem resolver, exatamente as
   duas tensões que este documento agora resolve: D2 (retry de `FAILED` inviável com o INSERT
   literal daquele momento) e D4 (resumo sem segunda tentativa). Este spec é a continuação direta
   daquele, não um recomeço.

**Repositórios**: **[FE]** = `c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main`
(contém `monitor/`, o worker Python) · **[API]** = `E:\Programas\wamp64\www\genesis-api`
(Laravel — migrations e `RadarNews.php`).

## Por que este plano existe

O spec anterior deixou o código Python pronto e testado por mock, mas registrou 3 tabelas e 4
colunas como dependência externa nunca criada, e duas tensões de desenho (D2/D4) não resolvidas.
Este documento assume que é hora de fechar essas duas frentes juntas: criar o schema que falta
*e* reescrever `_reservar_despacho`/`_reservar_resumo_do_dia` para uma máquina de estados de
verdade (`PENDING/SENT/FAILED/UNCERTAIN`) em vez do INSERT-único que bloqueava reenvio para
sempre. Também aponta 2 bugs novos não cobertos pelo spec anterior: `GENESIS_AI_TOKEN` nunca
validado no startup (P0.4) e `title_original`/`piso_aplicado` nunca persistidos apesar das
colunas existirem na migration (P1.1).

## Verificação preliminar (21/08/2026) — Fase 0

Todos os 8 achados P0/P1 do documento foram conferidos linha a linha contra o código real antes
de aceitar este plano. **Nenhuma divergência encontrada — o documento descreve o código atual com
precisão** (diferente do V6.9, que já achou 1 item desatualizado antes da Fase 0):

| Achado | Confirmado em | Realidade batida com o documento? |
|---|---|---|
| P0.1 — envio só existe em `worker_radar_news.py`/`telegram_dispatcher.py`, não em `monitor_worker.py` | `monitor_worker.py` grava com `self.gravar_banco(alerta, False)`, sem chamada a Telegram | Sim |
| P0.2 — fila consulta `adiado_ate`, coluna não confirmada em produção | [worker_radar_news.py:426](../../../monitor/worker_radar_news.py#L426) usa `adiado_ate` na query da fila | Sim — migration existe como arquivo (`2026_08_13_000001_...php`, [API]) mas meu registro anterior é que **ainda não foi rodada** (ver Fase 1, precisa reconfirmar sem assumir) |
| P0.3 — faltam `genesis_radar_dispatch`/`genesis_radar_resumo`/`genesis_radar_telemetria` | `find database/migrations -iname "*radar*"` em [API] só lista as 4 migrations de `genesis_radar_news`; nenhuma das 3 tabelas | Sim |
| P0.4 — `GENESIS_AI_TOKEN` não é exigido no startup | [worker_radar_news.py:144-151](../../../monitor/worker_radar_news.py#L144-L151) — `required_vars` tem `GENESIS_AI_URL`, não tem `GENESIS_AI_TOKEN` | Sim |
| P0.5 — reserva de despacho é INSERT único, sem estado para retry | [worker_radar_news.py:370-396](../../../monitor/worker_radar_news.py#L370-L396) — `_reservar_despacho` atual já tem o comentário reconhecendo essa tensão, sem resolvê-la | Sim (o próprio código já documentava a limitação) |
| P0.6 — resumo diário sem máquina de estados | [worker_radar_news.py:544-558](../../../monitor/worker_radar_news.py#L544-L558) — `_reservar_resumo_do_dia` é INSERT único + `IntegrityError` | Sim |
| P1.1 — `title_original`/`piso_aplicado` não persistidos | [ai_classifier.py:482-509](../../../monitor/ai_classifier.py#L482-L509) — `INSERT` de `persist_classified` não lista as duas colunas | Sim |
| P1.2 — coleta/IA e consumo da fila na mesma thread | [worker_radar_news.py:702-717](../../../monitor/worker_radar_news.py#L702-L717) — `rodar()`: `_run_rss_cycle()` roda síncrono antes de `_drain_telegram_queue()` no mesmo `while` | Sim |

**Tabela de filtros congelados (seção 2 do documento) — também conferida, 100% batendo com o
código atual**, zero divergência: frescor 30min ([rss_collector.py:243](../../../monitor/rss_collector.py#L243)), similaridade coleta 85%/72h
([rss_collector.py:29-30](../../../monitor/rss_collector.py#L29-L30)), similaridade Telegram 88%/72h e caps 3/hora,10/dia,
cooldown 2h, janela útil 6h, adiamento 45min (todos em [worker_radar_news.py:56-66](../../../monitor/worker_radar_news.py#L56-L66)). Isso
significa que o teste de congelamento proposto na seção 17.1 do documento pode ser escrito
literalmente — os nomes de variável e os valores default já são exatamente esses.

**[API] `RadarNews.php`** ([app/Models/RadarNews.php:15-46]) confirmado sem `title_original`,
`supressao`, `adiado_ate`, `piso_aplicado` no `$fillable`/`$casts` — bate com a seção 7.

## Regra obrigatória: filtros congelados

Nenhuma tarefa deste plano muda os valores da tabela abaixo (seção 2 do documento). Qualquer
tarefa que pareça exigir isso deve parar e voltar para discussão, não seguir por conta própria:

Frescor 30min · similaridade coleta 85%/72h · similaridade Telegram 88%/72h · Nível 1: 3/hora,
10/dia · cooldown por tema 2h · janela útil 6h · adiamento 45min · só Nível 1 dispara na hora ·
CRITICAL fura teto de orçamento (nunca de dedup) · promocional/previsão/opinião continua não
acionável.

Também congelados: `calcular_nivel()`, `calcular_impact_score()`, `GATILHOS_POR_CATEGORIA`,
`piso_de_severidade()`, `RSS_FEEDS` (nenhuma fonte nova nesta correção).

## 🔒 Portão de autorização — ler antes de codar qualquer fase

Duas categorias de bloqueio cruzam várias fases abaixo. Nenhuma tarefa marcada com 🔒-DB ou
🔒-INFRA deve ser executada (só planejada/escrita) sem passar por este portão primeiro.

**🔒-DB — banco de dados (`genesisteste`, MySQL, [API]).** Regra já registrada e válida para todo
o projeto: mexer no banco do `genesis-api` — mesmo o de desenvolvimento — exige perguntar antes
de rodar qualquer coisa que escreva (migrate, seed, UPDATE manual). Este plano segue a mesma
regra: **posso escrever os arquivos de migration (código, versionado, reversível por `down()`)
sem pedir a cada arquivo, mas não rodo `php artisan migrate` nem `db:seed` sem sua confirmação
explícita, mesmo contra `genesisteste`.** A migration de 13/08 (`title_original`/`supressao`/
`adiado_ate`/`piso_aplicado`) já existe como arquivo desde a sessão anterior e **eu não sei se já
foi rodada** — isso precisa ser conferido com `php artisan migrate:status` (comando de leitura,
não escreve nada) antes de decidir se a Fase 1 aplica 1 migration nova ou 4.

**🔒-INFRA — Supervisor, `.env` real, credenciais de produção, chat de teste do Telegram.** Este
ambiente (sandbox de desenvolvimento) não tem acesso ao servidor de produção, ao `venv` real, ao
Supervisor real, nem a `GENESIS_AI_TOKEN`/`TELEGRAM_BOT_TOKEN` reais. Tarefas de deploy (Fases
10, 12, 13) ficam com o código/checklist pronto, mas **execução real fica bloqueada até você
rodar no servidor** — mesmo padrão já usado nos specs V6.7/V6.8 para itens sem acesso.

---

## FASE 1 — 🔒-DB Migrations Laravel (schema que falta)

- [x] **1.1** — Confirmado (21/08/2026, `php artisan migrate:status`, leitura): a migration de
      13/08 já está `Ran`. As 4 colunas (`title_original`/`supressao`/`adiado_ate`/
      `piso_aplicado`) já existem em `genesisteste`. Fase 1 só precisou das 3 tabelas novas.
- [x] **1.2** — 3 migrations criadas (código literal da seção 5, sem alteração), datadas
      `2026_08_21` (próxima livre depois de `2026_08_20_000001`, sem colisão):
      - `database/migrations/2026_08_21_000001_create_genesis_radar_dispatch_table.php`
      - `database/migrations/2026_08_21_000002_create_genesis_radar_resumo_table.php`
      - `database/migrations/2026_08_21_000003_create_genesis_radar_telemetria_table.php`
  - `php -l` limpo nos 3 arquivos. **Só o arquivo foi criado — nada rodado no banco.**
- [ ] **1.3** (🔒-DB, aguardando sua autorização) — Rodar `php artisan migrate --force` (ou sem
      `--force` em dev) e validar com os 7 `SHOW COLUMNS`/`SHOW TABLES` da seção 6 do documento
      (4 já confirmados via 1.1; faltam as 3 tabelas novas). **Não executado ainda.**

---

## FASE 2 — Model Laravel `RadarNews.php`

- [x] **2.1** — `$fillable`/`$casts` atualizados em [app/Models/RadarNews.php] com os 4 campos +
      `'adiado_ate' => 'datetime'`. `php -l` limpo. Como as 4 colunas já existem no banco (1.1),
      isso já é funcional agora, não só preparado.

---

## FASE 3 — Validação de ambiente e schema no startup do worker (P0.4)

- [x] **3.1** — Import trocado, `GENESIS_AI_TOKEN` entrou em `required_vars`
      ([worker_radar_news.py:32-38,144-152]).
- [x] **3.2** — `validate_connection()` adicionada a `telegram_dispatcher.py`, chamada no fim de
      `_validate_env()`.
- [x] **3.3** — `_validate_schema(conn)` adicionada e chamada em `_validate_env()`, antes da
      validação do Telegram, com `_reconcile_stale_dispatches` (Fase 5.5) logo em seguida.
  - **Consequência confirmada, não hipotética**: com as 3 tabelas novas ainda não migradas (1.3
    pendente), rodar o worker de verdade agora aborta no startup por `Tabelas ausentes` — esperado
    e correto, é exatamente o que P0.4 pedia.
- [x] **3.4** — 7 testes novos (`test_p04_*`): variável ausente aborta com `SystemExit`; schema
      faltando tabela/coluna levanta `RuntimeError`; schema completo não levanta; `getMe`/`getChat`
      chamados e `sendMessage` nunca chamado; bot_token/chat_id vazios retornam `(False, motivo)`
      sem tocar rede.

---

## FASE 4 — Persistir `title_original` e `piso_aplicado` (P1.1)

- [x] **4.1** — SQL/params de `persist_classified()` reescritos (17 colunas/17 `%s`,
      `title_original` = `entry['title']` cru, `piso_aplicado` = `entry.get('piso_aplicado')`).
      Como a coluna já existe no banco (1.1), isso já persiste de verdade, não só prepara.
- [x] **4.2** — 2 testes novos (`test_p11_*`): `title_original` grava o texto bruto do RSS
      (diferente de `titulo_pt`); `title_original`/`piso_aplicado` gravam `None` quando ausentes
      do dict em memória.

---

## FASE 5 — Máquina de estados do despacho ao Telegram (P0.5, resolve a tensão D2 do spec anterior)

- [x] **5.1** — `error` adicionado aos 3 retornos de `_send_message_detailed()`.
- [x] **5.2** — `_reservar_despacho()` reescrito literal (SELECT...FOR UPDATE + INSERT/UPDATE de
      retry). Resolve a tensão D2 do spec anterior.
- [x] **5.3** — Query da fila trocada pelo `LEFT JOIN genesis_radar_dispatch` literal.
- [x] **5.4** — Bloco de resultado atualizado (`last_error`/`next_attempt_at` em FAILED/UNCERTAIN).
- [x] **5.5** — `_reconcile_stale_dispatches()` adicionada, chamada em `_validate_env()` logo após
      `_validate_schema` (antes do `conn.close()`).
- [x] **5.6** — 6 testes novos (`test_d2_*`) cobrindo os 5 estados (nova reserva, SENT bloqueia,
      UNCERTAIN bloqueia, FAILED com 1 tentativa libera, FAILED com 2 não libera, FAILED fora da
      janela de retry não libera) + 1 checando `error` no retorno do dispatcher. Os 4 testes D1
      antigos (dedup) continuam intactos, sem mudança — cobrem uma função diferente
      (`_ja_foi_ao_telegram`) que esta fase não tocou.

---

## FASE 6 — Máquina de estados do resumo diário (P0.6, resolve a tensão D4 do spec anterior)

- [x] **6.1** — `send_resumo_diario()` agora delega a `_send_message_detailed()`, devolve dict.
- [x] **6.2** — `_reservar_resumo_do_dia()` reescrito com a mesma máquina de estados de 5.2,
      aplicada a `genesis_radar_resumo`. Resolve a tensão D4 do spec anterior.
- [x] **6.3** — `_run_resumo_diario()` reescrito: usa o dict de `send_resumo_diario`, chama novo
      método `_atualizar_estado_resumo()` (reabre conexão própria, mesmo padrão da seção 12.3) —
      SENT/FAILED/UNCERTAIN e o caso de dia vazio (SENT com itens=0, sem chamar Telegram).
- [x] **6.4** — 9 testes novos (`test_d4_*`): reserva nova, SENT bloqueia, FAILED com 1 tentativa
      libera, FAILED com 2 não libera, dia vazio marca SENT sem enviar, UNCERTAIN não reprocessa
      no mesmo dia, FAILED devolve `False` (permite retry no próximo tick) + 1 teste de
      `_atualizar_estado_resumo` conferindo os campos gravados no SENT. Teste de `ROW_NUMBER()`/
      `PARTITION BY` do spec anterior continua verde, intacto.

---

## FASE 7 — Desacoplar consumo da fila do ciclo RSS (P1.2, correção mínima)

- [x] **7.1** — `worker_radar_news.py::rodar()`: reordenar o loop principal pelo literal da seção
      13 — `_drain_telegram_queue()` e `_maybe_send_resumo_diario()` passam a rodar **antes** da
      checagem do ciclo RSS a cada tick, não depois.
  - **Limite real desta correção, não escondido**: isso resolve o caso em que a fila fica parada
    esperando o ciclo RSS terminar sua *próxima* iteração, mas não resolve o caso em que o ciclo
    RSS já está *em execução* (fetch de feed lento, retries do Gemini) — o worker é uma única
    thread, então enquanto `_run_rss_cycle()` está rodando, nada mais roda, reordenação nenhuma
    muda isso. O próprio documento (seção 13) chama a separação em 2 processos de "correção
    definitiva" e deixa fora do escopo P0 — este plano faz o mesmo: registra a tarefa de
    separação como Fase P1 futura, não tenta resolver aqui.
- [x] **7.2** — 1 teste novo (`test_p12_*`): confirma via posição no código-fonte que a chamada
      real `self._drain_telegram_queue()` vem antes de `self._run_rss_cycle()` no `while`. (Usei
      `inspect.getsource` com o prefixo `self.` para não colidir com a menção ao método dentro do
      comentário explicativo da própria linha — sem o prefixo o teste dava falso-negativo, achado
      e corrigido durante a verificação.)

---

## FASE 8 — Testes de congelamento (seção 17.1)

- [x] **8.1** — `test_filtros_operacionais_permanecem_congelados()` adicionada, literal, verde de
      primeira (confirma a Fase 0: nenhum valor havia mudado).

---

## FASE 9 — Carteira Cripto.ico (seção 14)

- [x] **9.1** — Rodado (leitura, `php artisan tinker`): **0 linhas na tabela `genesis_carteira_tokens`**
      (confirmado tanto `WHERE ativo = 1` quanto contagem total — a tabela está inteiramente vazia,
      não é só um filtro de `ativo` zerando o resultado).
- [ ] **9.2** (🔒-DB, aguardando sua autorização — 9.1 confirmou que precisa) — `php artisan db:seed
      --class=GenesisCarteiraTokensSeeder --force`. O documento é explícito: só restaurar a lista
      já aprovada, não adicionar ativo novo. **Não executado ainda** — sem a carteira, o Radar News
      roda sem nenhum ativo pra vincular notícia (`ativo_tema`/normalização de ticker ficam vazios
      em toda classificação até isso ser resolvido).

---

## FASE 10 — 🔒-INFRA Ambiente Python e Supervisor (seção 16)

Fora do alcance deste ambiente de desenvolvimento (sem acesso ao servidor). Preparo apenas:

- [x] **10.1** — `monitor/genesis-radar-news.conf` atualizado pro padrão da seção 16.2.
- [ ] **10.2** (checklist para execução manual sua, não minha) — criar `venv`, instalar
      `requirements.txt`, copiar o `.conf` atualizado para `/etc/supervisor/conf.d/`,
      `supervisorctl reread && update && restart genesis-radar-news`, confirmar `RUNNING`.

---

## FASE 11 — Teste real controlado (seção 17.4) — 🔒-INFRA, bloqueado

Precisa de: banco de homologação, `GENESIS_AI_TOKEN` real, `TELEGRAM_BOT_TOKEN` real e um chat
privado de teste — nenhum disponível neste ambiente. Código/checklist já fica pronto pelas Fases
1-8; a execução dos 10 passos da seção 17.4 fica registrada como pendente até você rodar em
homologação. **Proibição explícita do documento, repetida aqui**: não inserir notícia artificial
direto no chat de produção para testar.

---

## Critérios finais de aceite (seção 20 do documento — usar esta lista para fechar o plano)

`[x]` abaixo = código pronto e confirmado por teste automatizado (mock), não prova real de
produção — essa distinção importa, ela é o próprio critério do documento (seção 21, último item).

- [ ] `genesis-radar-news` `RUNNING` no Supervisor (🔒-INFRA, bloqueado)
- [x] Startup falha claramente com variável obrigatória ausente (Fase 3, mock-verificado)
- [x] Startup falha claramente com tabela/coluna ausente (Fase 3, mock-verificado)
- [ ] `GENESIS_AI_TOKEN` presente, 1 classificação real concluída (🔒-INFRA, bloqueado)
- [x] `getMe`/`getChat` confirmam sem enviar mensagem (Fase 3, mock-verificado)
- [ ] 3 tabelas novas existem (Fase 1.2 escrita, **1.3 rodar migrate ainda não autorizado**)
- [x] 4 colunas da migration de 13/08 existem (Fase 1.1, confirmado real via `migrate:status`)
- [x] `title_original` preenchido em linhas novas (Fase 4, mock-verificado — INSERT real
      depende de 1.3)
- [x] `piso_aplicado` preenchido quando aplicável (Fase 4, mock-verificado — idem)
- [ ] 1 notícia Nível 1 chega uma única vez ao chat de teste (Fase 11, 🔒-INFRA, bloqueado)
- [x] Níveis 2/3 não disparam na hora (já coberto antes deste plano, sem mudança)
- [x] Falha confirmada permite no máximo 1 segunda tentativa (Fase 5/6, mock-verificado)
- [x] Desfecho incerto nunca reenviado (Fase 5/6, mock-verificado)
- [x] Linha travada não bloqueia as seguintes (Fase 5.3, verificado por inspeção do SQL —
      não há teste de integração completo do `_drain_telegram_queue` com 2 linhas reais)
- [x] Resumo diário com estado persistente, sem duplicar (Fase 6, mock-verificado)
- [x] Limites 3/hora, 10/dia, 2h, 6h, 45min iguais (Fase 8, freeze test verde)
- [x] Thresholds 85/88 iguais (Fase 8, freeze test verde)
- [x] Nenhuma fonte RSS nova (nenhuma fase deste plano tocou `RSS_FEEDS`)
- [x] Nenhum critério de nível/severidade/acionabilidade alterado (`calcular_nivel`/
      `calcular_impact_score`/`GATILHOS_POR_CATEGORIA`/`piso_de_severidade` intactos)
- [ ] Teste RSS→IA→banco→fila→Telegram registrado de ponta a ponta (Fase 11, 🔒-INFRA, bloqueado)

**Pacote de evidências desta execução (21/08/2026):** `python -m pytest monitor/tests/` → **122
passed**, zero falhas, zero regressão nos 2 arquivos de teste que este plano não tocou. `php -l`
limpo nos 3 migrations + model. 3 arquivos Python editados (`worker_radar_news.py`,
`ai_classifier.py`, `telegram_dispatcher.py`), 1 arquivo `.conf` atualizado, 3 migrations e 1
model criados/editados em [API]. **Dois pontos seguem explicitamente aguardando você**: autorizar
`php artisan migrate` (Fase 1.3) e decidir sobre rodar o seeder da carteira Cripto.ico, que a
Fase 9.1 confirmou estar zerada (Fase 9.2).

## Proibições (seção 21 — valem para todas as fases deste plano)

Não remover filtro para fazer teste passar · não virar Nível 2/3 em envio imediato · não
aumentar teto de disparo · não reduzir cooldown/janela de dedup · não mudar gatilho editorial ·
não adicionar fonte RSS · não reenviar `UNCERTAIN` · não marcar `telegram_sent=1` antes da
confirmação real do Telegram · não copiar credencial para o repositório · **não rodar migration
nem seed em `genesisteste` sem autorização explícita, mesmo sendo banco de dev** (regra do
projeto, reforçada aqui) · não considerar teste com mock prova final de produção.
