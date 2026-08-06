# Matriz de Aceite — Radar News V1.1 (escopo `monitor/`)

Preenchida em 05/08/2026, ao final das 8 fases do plano `radar-news-v1-1-monitor/tasks.md`. Mapeia
as provas P01-P24 (seção 10 do documento) e os greps obrigatórios (seção 11) contra o estado real do
código e dos testes — não uma cópia do que cada fase já tinha reportado.

**Convenção de status** (mesma do padrão já usado no projeto):

- **REAL** — comando real, função pura exercitada com entrada real, leitura real de banco, ou chamada
  de rede real. Nenhuma simulação de rede/banco envolvida.
- **TESTE** — teste automatizado passando que prova a lógica corretamente, mas simula (via
  `unittest.mock`) uma peça externa (conexão MySQL, resposta HTTP) que eu não tenho credencial ou
  autorização pra acionar de verdade neste ambiente.
- **BLOQUEADO** — não dá pra produzir a prova real: falta credencial (`GENESIS_AI_URL` real) ou a
  tabela/coluna do banco não existe (confirmado por leitura real do schema, não suposição).
- **PARCIAL** — parte real, parte bloqueada.

Todas as provas REAL e os logs de TESTE estão salvos em `provas/` (arquivos `.txt` com comando e
saída, gerados nesta sessão — não reconstituídos de memória).

---

## Achado que muda o que "bloqueado" significa aqui

Havia uma conexão MySQL real acessível neste ambiente (`monitor/.env`, banco de dev). Fiz **só
leitura** (nenhum INSERT/UPDATE/DDL) pra confirmar o estado real do schema antes de escrever esta
matriz — ver `provas/db-schema-real-readonly.txt`. Não segui além disso sem autorização, porque é
um banco real com dado real (98 linhas em `genesis_radar_news`).

Dois achados dessa leitura:

1. **Confirmado com dado real, não com leitura de migration:** `genesis_radar_dispatch`,
   `genesis_radar_resumo` e `genesis_radar_telemetria` não existem. `genesis_radar_news` não tem
   `title_original`, `supressao`, `adiado_ate` nem `piso_aplicado`. É por isso que P03, P13, P20-P23
   ficam BLOQUEADO de verdade, não por burocracia.
2. **Achado novo, fora do escopo desta auditoria mas com impacto direto no Radar News:**
   `genesis_carteira_tokens` **existe** (migration aplicada) mas está **vazia** —
   `SELECT COUNT(*) WHERE ativo = 1` devolveu **0**, não 15. O seeder nunca rodou neste banco. Na
   prática, `load_carteira_tokens()` devolve lista vazia agora, o que esvazia `_alias_map` (normalização
   de ticker) e a checagem `toca_carteira` em `calcular_nivel` — o funil ainda funciona pelo caminho
   sistêmico (E1), mas a carteira Cripto.ico como critério de disparo está inoperante até alguém rodar
   o seeder. Não rodei o seeder — é escrita em banco real, decisão sua.

---

## Provas de aceite (seção 10 do documento)

| # | Cenário | Status | Evidência |
|---|---|:---:|---|
| P01 | `grep -rn "generativelanguage" monitor/` → zero | **REAL** | `provas/greps-secao-11.txt` |
| P02 | Subir com `GENESIS_AI_URL` vazia → log CRITICAL, sem chamar o Google | **REAL** | `provas/p02-genesis-ai-url-vazia.txt` |
| P03 | Classificar 3 notícias via API interna real, log com `gemini-3.6-flash` | **BLOQUEADO** | Preciso de `GENESIS_AI_URL`/`GENESIS_AI_TOKEN` reais — não tenho |
| P04 | Derrubar a API interna no meio do lote → ERROR + reprocessamento individual, nenhuma perdida em silêncio | **TESTE** | `provas/p04-lote-falho-reprocessamento.txt` (`_call_gemini` mockado só na chamada de rede) |
| P05 | `grep -n "source = %s" monitor/rss_collector.py` → zero | **REAL** | `provas/greps-secao-11.txt` |
| P06 | Mesma notícia por 3 fontes, títulos diferentes → 1 registro, 2 bloqueadas | **TESTE** (parcial) | `test_a3_same_title_different_sources_same_cycle_blocked_by_hash` prova o hash global (sem filtro de fonte); a variação "títulos diferentes contando o mesmo fato" depende da similaridade, coberta por P07 com o mesmo mock |
| P07 | Manchete parafraseada 2h depois → bloqueada no coletor, antes de classificar | **TESTE** | `test_a3_similar_title_72h_blocked_at_collector` (conexão MySQL mockada) |
| P08 | `event_key` com acento/espaço → normalizado maiúsculo sem acento | **REAL** | `test_a4_normalizar_event_key_accents_and_spaces` — função pura, sem mock |
| P09 | `event_key` fora do formato de 3 partes → nulo, WARNING, notícia entra mesmo assim | **REAL** | `test_a4_normalizar_event_key_malformed_returns_none` — função pura |
| P10 | Colisão do índice único → log ERROR com título e chave, nunca DEBUG | **TESTE** | `test_a4_integrity_error_logs_at_error_level` (`IntegrityError` simulado via mock, já que não vou forçar colisão real no banco de dev) |
| P11 | Notícia há 45min, outra há 10min, outra sem data → só a de 10min aceita | **REAL** | `test_c1_concrete_45min_rejected_10min_accepted` + `test_c1_no_timestamp_is_fail_closed` — comportamento pré-existente (C1), função pura com `FakeEntry` |
| P12 | Feed 403 por 20 ciclos seguidos → log ERROR "FONTE MUDA" com o nome do feed | **REAL** | `test_p12_feed_mudo_20_ciclos_loga_fonte_muda` — chama `_registrar_saude()` real 20x, sem mock nenhum |
| P13 | 20 manchetes fixas, antes/depois do Bloco B, tabela comparativa | **BLOQUEADO** | Exige chamada real ao modelo (mesma dependência de P03) — não dá pra simular sem fabricar o julgamento do Gemini |
| P14 | "Binance suspends withdrawals..." → CRITICAL, Nível 1 | **REAL** | `provas/p14-p19-bloco-c-piso.txt` |
| P15 | "MicroStrategy sells 12,000 BTC" → CRITICAL | **REAL** | idem |
| P16 | "MicroStrategy buys 4,000 BTC" → HIGH, não CRITICAL | **REAL** | idem |
| P17 | "Tether USDT depegs to $0.94" → CRITICAL mesmo fora da carteira | **REAL** | idem |
| P18 | "Protocol X exploited for $340 million" → CRITICAL (limiar US$ 25mi) | **REAL** | idem — só passou depois da correção do bug de regex "million"≠"mil" (Fase 3) |
| P19 | "Analyst says Bitcoin could reach $200k" → `acionavel: false`, Nível 3 | **REAL** | idem |
| P20 | Notícia já enviada reaparece com título diferente, mesmo `event_key` → suprimida | **TESTE** | `test_d1_event_key_ja_enviado_e_suprimido` (mock) — real depende da coluna `supressao` |
| P21 | Matar o processo entre `INSERT` do despacho e o POST, reiniciar → sem 2ª mensagem | **TESTE** | `test_d2_reservar_despacho_sucesso`/`_ja_existe_bloqueia` (mock) — real depende de `genesis_radar_dispatch` |
| P22 | 5 Nível 1 + 1 CRÍTICA → 3 disparam por `impact_score`, 2 adiadas, CRÍTICA fura o teto | **TESTE** | `test_e2_orcamento_estourado_dentro/fora_da_janela` (mock) — real depende da coluna `adiado_ate` |
| P23 | Reiniciar às 20h30 depois do resumo já enviado → nenhum 2º resumo | **TESTE** | `test_d4_reservar_resumo_do_dia_sucesso`/`_ja_enviado_bloqueia` (mock) — real depende de `genesis_radar_resumo` |
| P24 | Mesmo fato duas vezes → resumo com 10 itens distintos, ordenado por `impact_score` | **TESTE** | `test_d3_query_usa_row_number_partition_e_severity_ord` + `_limites_dia_brt_converte_para_utc` — a query em si só usa colunas que já existem; não rodei contra o banco real por decisão de não escrever dados de teste lá sem perguntar |

**18 de 24 provas fechadas (REAL ou TESTE completo). 2 bloqueadas por falta de credencial (P03,
P13). 6 têm a mecânica 100% testada mas a prova real de ponta a ponta depende de colunas/tabelas que
não existem no banco (confirmado por leitura real, não suposição) — P06/P07/P10/P20-P24 na prática
teriam status real se eu tivesse autorização pra escrever dados de teste no banco de dev.**

---

## Greps obrigatórios (seção 11)

Rodados nesta sessão, saída completa em `provas/greps-secao-11.txt`.

| Grep | Esperado | Resultado |
|---|:---:|---|
| `generativelanguage.googleapis.com` | zero | ✅ zero |
| `translate.googleapis.com` | zero | ✅ zero |
| `source = %s` (rss_collector.py) | zero | ✅ zero |
| `hours=3` | zero | ✅ zero |
| `discovery_score\|send_discovery_alert` | zero | ✅ zero |
| `threading.Timer` | zero | ✅ zero |
| `monitor_worker` (F11) | zero | ✅ zero |
| `impact_summary` | zero | ❌ **não-zero, exceção documentada** (ver abaixo) |
| `GENESIS_AI_URL` | presente | ✅ presente |
| `gemini-3.6-flash` (.env.example) | presente | ✅ presente |
| `normalizar_event_key` | presente | ✅ presente |
| `piso_de_severidade` | presente | ✅ presente (2 arquivos) |
| `_ja_foi_ao_telegram` | presente | ✅ presente |
| `_reservar_despacho` | presente | ✅ presente |
| `GATILHOS_POR_CATEGORIA` | presente | ✅ presente |
| `adiado_ate` | presente | ✅ presente |

**Exceção documentada — `impact_summary`:** o documento pede zero, mas a coluna real do banco
(migration original, fora do escopo de `monitor/`) se chama literalmente `impact_summary` — o SQL e
as leituras de linha crua do banco precisam do nome real da coluna pra funcionar. Satisfazer esse
grep exigiria uma migration renomeando a coluna, que este documento não dá e que não estava no meu
escopo. O que eu fiz: zerei a *duplicação* em memória (`impacto_pt` é a única fonte antes de
persistir); o nome da coluna em si permanece.

---

## Banco de dados — leitura real (sem escrita)

Ver `provas/db-schema-real-readonly.txt`. Resumo:

- `genesis_radar_news`: 98 linhas reais, sem `title_original`/`supressao`/`adiado_ate`/`piso_aplicado`.
- `genesis_radar_dispatch`, `genesis_radar_resumo`, `genesis_radar_telemetria`: não existem.
- `genesis_carteira_tokens`: existe, mas com **0 ativos** (esperado 15 — seeder nunca rodou).

Nenhum `INSERT`/`UPDATE`/`DDL` foi executado. Se você quiser prova real de P06/P07/P10/P20-P24,
preciso de autorização explícita pra escrever linhas de teste em `genesis_radar_news` (e depois
limpar) — não fiz isso por conta própria.

---

## A6 — validação das 5 fontes RSS propostas (RT-05)

Ver `provas/a6-validacao-fontes-rss.txt`. SEC, CFTC, Federal Reserve e CoinDesk respondem 200 (direto
ou via redirect que o `feedparser` segue sozinho). **Reuters Business é link morto de verdade**
(301 → 404) — não wireado em `RSS_FEEDS`, conforme o próprio documento manda fazer nesse caso.

---

## Suíte de testes completa

`provas/pytest-full-verbose.txt` — `python -m pytest tests/ -v`, **97 passed** (68 do Radar News +
29 da suíte pré-existente do worker de derivativos, confirmando que nada foi quebrado ali).
