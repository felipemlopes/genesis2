# Plano de Implementação: Radar News — Correção dos Achados da Revisão de 03/09/2026

## Visão Geral

Fonte: revisão de código feita em 03/09/2026 sobre `monitor/` (pipeline Radar News), a pedido do
Felipe, com o relatório entregue diretamente no chat (sem alterar nenhum arquivo). A revisão cruzou
o código atual com o histórico já registrado em `.kiro/specs/radar-news-v1-1-monitor/tasks.md` e
rodou `python -m pytest monitor/tests/` (só leitura, nenhuma escrita em banco) para confirmar o
estado real da suíte.

**Este plano cobre só os achados NOVOS dessa revisão.** Não repete nem reabre os itens já cobertos,
aceitos ou explicitamente deixados pendentes em `radar-news-v1-1-monitor/tasks.md` — RT-01 a RT-08
(ratificação do Fabrício), A6 (fontes RSS novas, Reuters Business morta), a exceção documentada do
grep de `impact_summary`, e a dependência externa de migrations que já foram criadas e aplicadas
desde então. Esses continuam exatamente como estavam.

**Escopo:** `monitor/ai_classifier.py`, `monitor/worker_radar_news.py`,
`monitor/tests/test_radar_news_v1.py`. Nenhum arquivo fora de `monitor/` é tocado por este plano.

**Status (03/09/2026): as 4 fases foram executadas nesta sessão**, a pedido explícito do Felipe
("execute as tasks"). `python -m pytest monitor/tests/` → **130 passed** (122 antes + 8 testes novos
desta execução). Nenhum commit foi criado por mim — ver nota na Fase 1 sobre o que já estava
commitado antes desta sessão começar.

---

## Achados que este plano resolve (resumo, ver relatório completo no chat de 03/09/2026)

| # | Achado | Severidade | Arquivo:linha |
|---|---|---|---|
| 1 | Suíte de testes quebrada — 2 de 122 testes falham contra o código atual | Alta | `monitor/tests/test_radar_news_v1.py:1249,1276` |
| 2 | Cooldown por tema em `_pode_disparar` conta por `created_at`, não por `telegram_sent_at` | Média-alta | `monitor/worker_radar_news.py:384` |
| 3 | `_gerar_conclusao_do_dia` herda `responseMimeType: application/json` de `_call_gemini` sem precisar | Média | `monitor/ai_classifier.py:608`, `monitor/worker_radar_news.py:941-956` |
| 4 | `dispatch_key` pode colidir entre duas notícias diferentes quando falta `event_key` | Baixa (edge case) | `monitor/worker_radar_news.py:442-443` |

---

## FASE 1 — 🔒 Suíte de testes quebrada (bloqueante, prioridade máxima)

**Por quê primeiro:** enquanto a suíte não estiver 100% verde, qualquer outra mudança neste plano
fica sem um baseline confiável para provar que não introduziu regressão. Além disso, o achado #1 é
sobre uma correção de bug real (`created_at`/`updated_at` nunca eram gravados) que já está no
working tree, só não commitada — precisa ser resolvida antes de qualquer coisa.

- [x] **1.1/1.2** — **Já estava feito antes desta execução**: ao começar a implementar, `git status`
      mostrou que a mudança de `created_at`/`updated_at` em `persist_classified` já tinha sido
      commitada pelo Felipe fora desta sessão (commit `72f19ff`). Nenhuma ação necessária aqui.
- [x] **1.3/1.4/1.5** — Em vez do ajuste de índice posicional planejado originalmente (`params[-2]`/
      `params[-1]`), apliquei direto a alternativa da 1.5: os dois testes P11
      (`test_radar_news_v1.py`, função `_insert_params_by_column`, adicionada logo antes deles) agora
      leem os nomes das colunas direto da `sql` capturada e montam `dict(zip(colunas, params))`,
      testando por nome (`cols['title_original']`, `cols['piso_aplicado']`, `cols['created_at']` como
      `datetime`, etc.) em vez de posição. Decisão tomada por conta própria: para só 2 testes o custo
      extra é mínimo e elimina de vez o risco de quebrar de novo a cada coluna nova no `INSERT` — não
      é over-engineering dado que esse exato tipo de quebra já aconteceu uma vez.
- [x] **1.6** — `python -m pytest monitor/tests/ -v` → **130 passed** (122 + 8 testes novos desta
      execução, contando as 4 fases).

**Prova:** pytest 130/130 verde; diff dos dois testes em `test_radar_news_v1.py`.

---

## FASE 2 — Cooldown por tema em `_pode_disparar` usar `telegram_sent_at`

**Depende de:** nada tecnicamente, mas roda depois da Fase 1 para não misturar num teste que já está
sendo tocado ali por outro motivo.

- [x] **2.1** Feito — `worker_radar_news.py`, query de tema dentro de `_pode_disparar` trocada de
      `created_at` para `telegram_sent_at >= NOW() - INTERVAL %s HOUR`, com comentário explicando a
      mesma razão das duas queries acima.
- [x] **2.2** Dois testes novos em `test_radar_news_v1.py`:
      `test_e2_pode_disparar_tema_cooldown_conta_por_telegram_sent_at` (confirma que a 3ª query
      executada por `_pode_disparar` usa `telegram_sent_at`, não `created_at`) e
      `test_e2_pode_disparar_tema_cooldown_bloqueia_mesmo_tema_recente` (com `tema=1` vindo do banco,
      `_pode_disparar` recusa). Também reforcei o teste já existente
      `test_e2_pode_disparar_conta_por_telegram_sent_at` com `assert 'created_at >=' not in src` —
      trava de regressão pra não sobrar nenhuma contagem de orçamento por `created_at` no método.
- [x] **2.3** `pytest` completo — verde, nenhum teste de E2/orçamento pré-existente quebrou.

**Prova:** `python -m pytest tests/test_radar_news_v1.py -k "e2_pode_disparar"` → 3 passed.

---

## FASE 3 — `_gerar_conclusao_do_dia` não deve forçar `responseMimeType: application/json`

**Depende de:** nada.

- [x] **3.1** `_call_gemini` em `ai_classifier.py` ganhou `response_json: bool = True`; quando
      `False`, `responseMimeType` não entra no `generationConfig` (`thinkingConfig` continua sempre
      presente — não tem relação com o formato de saída, só limita o orçamento de raciocínio, é
      desejável nos dois casos).
- [x] **3.2** `_gerar_conclusao_do_dia` (`worker_radar_news.py`) agora chama
      `self.ai_classifier._call_gemini(prompt, response_json=False)`.
- [x] **3.3** Sanitização defensiva adicionada: se a linha vier entre aspas duplas nas duas pontas,
      remove antes de devolver.
- [x] **3.4** Quatro testes novos em `test_radar_news_v1.py`:
      `test_call_gemini_response_json_true_inclui_response_mime_type` /
      `test_call_gemini_response_json_false_omite_response_mime_type` (mockando
      `ai_classifier.requests.post` de verdade, não só a função inteira — confirma o payload real) e
      `test_gerar_conclusao_do_dia_texto_plano_passa_direto` /
      `test_gerar_conclusao_do_dia_remove_aspas_sobrando`, mais
      `test_gerar_conclusao_do_dia_chama_call_gemini_com_response_json_false` (inspeção de código).
- [x] **3.5** `pytest` completo — verde.

**Prova:** `python -m pytest tests/test_radar_news_v1.py -k "call_gemini or gerar_conclusao"` →
5 passed. Prova real (chamada de verdade ao Gemini) continua fora deste plano, como já previsto.

---

## FASE 4 (prioridade baixa / opcional) — `dispatch_key` não depender de `title_hash` não-único

**Por quê é opcional:** é um caso de borda (exige `event_key` nulo/malformado duas vezes com o mesmo
`title_hash`, ou seja, a mesma manchete exata reaparecendo fora da janela de dedup de 24h do
coletor). Baixa probabilidade, mas o efeito quando acontece é ruim (notícia trava silenciosamente
para sempre, sem log de erro nem `supressao` marcada). Felipe decide se entra neste ciclo ou fica
para depois.

- [x] **4.1** `_reservar_despacho` (`worker_radar_news.py`) — `dispatch_key` agora é
      `sha256(f"{row['id']}|{event_key or title_hash or ''}|nivel1")`, com comentário explicando o
      cenário de colisão que isso fecha.
- [x] **4.2** Confirmado: `row['id']` é estável entre tentativas da mesma notícia (é a PK do registro,
      nunca muda), então o retry de `FAILED` continua produzindo o mesmo `dispatch_key` de antes — os
      testes D2 pré-existentes de retry (`test_d2_reservar_despacho_failed_com_uma_tentativa_libera_retry`
      etc.) continuam verdes sem alteração.
- [x] **4.3** Teste novo `test_d2_reservar_despacho_news_id_evita_colisao_por_title_hash_igual`: duas
      linhas com `title_hash` igual e `event_key` nulo, ambas reservam despacho com sucesso e com
      `_dispatch_key` diferente.
- [x] **4.4** `pytest` completo — verde.

**Prova:** `python -m pytest tests/test_radar_news_v1.py -k "d2_reservar"` → 6 passed.

---

## Fora de escopo deste plano (decisões que não são minhas)

- **`genesis_carteira_tokens` possivelmente ainda vazia** (seeder nunca rodado, conforme auditoria de
  05/08 e memória de projeto de 21/08): não verifiquei o banco nesta revisão nem neste plano — exige
  autorização explícita do Felipe antes de rodar qualquer seed/migração, mesmo em banco de dev.
- **RT-01 a RT-08**: seguem pendentes de ratificação do Fabrício, sem qualquer mudança proposta aqui.
- **A6 (Reuters Business morta)**: aguardando decisão de substituto ou aceitar só 4 das 5 fontes
  novas propostas — não é tocado por este plano.
- **Reversão do Aviso 2** (chamada direta à API pública do Google): decisão já tomada e documentada
  no código em 13/08/2026 — este plano não reabre essa discussão.

---

## Commits

Nada foi commitado nesta sessão. `git status` neste momento mostra `monitor/ai_classifier.py`,
`monitor/worker_radar_news.py` e `monitor/tests/test_radar_news_v1.py` modificados (Fases 2, 3 e 4 —
a mudança da Fase 1 no `ai_classifier.py` já estava commitada antes, como registrado acima). Não
commitei por conta própria porque a regra geral deste projeto é só commitar quando pedido
explicitamente — as 3 fases de código ficaram prontas e testadas (130/130), aguardando o Felipe
decidir o agrupamento dos commits (ex.: um por fase, como o plano original sugeria para a Fase 1, ou
tudo junto).

## Ordem sugerida e independência entre fases

- **Fase 1 é bloqueante** para as demais só no sentido de "arrumar a casa primeiro" (suíte verde
  antes de somar mudança nova) — não há dependência técnica real entre o fix de `created_at` e as
  Fases 2-4.
- **Fases 2, 3 e 4 são independentes entre si** e podem ser feitas em qualquer ordem, inclusive em
  paralelo se for o caso.
- Nenhuma fase deste plano depende de migration nova, tabela nova ou coluna nova — todas mexem só em
  lógica Python já existente sobre schema que já existe.
