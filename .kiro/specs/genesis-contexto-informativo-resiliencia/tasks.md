# Plano: Retry no Gemini de Macro/Sentimento

**Status deste documento**: ✅ **executado e testado por completo em 02/09/2026**, a pedido do
Felipe, a partir de uma investigação ao vivo (produção real,
`teste.genesislabs.com.br`/`testeapi.genesislabs.com.br`). Escopo reduzido a pedido do Felipe: só
`GeminiContextService` (macro + sentimento, a mesma chamada) — Yahoo/Alternative/CoinGecko e o
`MacroController` órfão ficam de fora deste spec (registrados como possível continuação futura).

**Repositório**: **[API]** = `E:\Programas\wamp64\www\genesis-api` (branch `genesis2`).

---

## O problema

Em produção, "Macro e Geopolítico" e "Sentimento" aparecem indisponíveis na primeira análise de um
ativo, e corretos na segunda análise do mesmo ativo — mesmo já com o deploy atual (descartado:
frontend antigo chamando `MacroController`; descartado: bloqueio de rede/firewall, que falharia
sempre, não só na primeira vez).

Causa raiz: `GeminiContextService::collect()`
(`app/Services/GraphicalAnalysis/GeminiContextService.php:90-115`) — a mesma chamada que gera
`macro.resumo` E `sentimento.narrativa` juntos — faz **uma única tentativa HTTP contra o Gemini, sem
retry nenhum**. Se essa tentativa falhar ou demorar demais (conexão "fria" com o host, latência de
rede momentânea), os dois campos ficam `UNAVAILABLE` pra sempre, dentro daquela análise — sem
segunda chance no mesmo job. A "segunda análise do mesmo ativo" só funciona por ser uma rodada nova
inteira, não porque o ativo em si importa.

Compare com a Binance: toda chamada à Binance já tem 3 tentativas com backoff progressivo
(`BinanceService.php`, item 22 do spec `genesis-v6-9-correcao-tecnica`, `DATA_FETCH_MAX_ATTEMPTS=3`,
250/500ms) — nunca falha por uma instabilidade pontual. O Gemini nunca teve essa mesma proteção.

---

## Decisões — resolvidas pelo Felipe (02/09/2026)

- [x] **D1 — Critério de retry: se macro e sentimento não voltarem preenchidos, tenta de novo.** Não
      é o critério HTTP (status/exceção) que eu tinha proposto — é o RESULTADO de negócio: depois de
      parsear a resposta, se `macro.resumo` ou `sentimento.narrativa` vier null (por falha de
      conexão, HTTP não-2xx, JSON inválido, ou até uma resposta 2xx tecnicamente válida mas vazia),
      tenta de novo. Implicação técnica: não dá pra usar só o `.retry()` do Laravel (que decide por
      status HTTP/exceção, antes de qualquer parse) — precisa de um laço manual em volta da chamada
      + parse inteiros, não só da chamada HTTP crua. Ver Fase 1.
- [x] **D2 — 2 tentativas no total** (1 original + 1 retry), não 3.

---

## Fase 0 — Verificação ✅

- [x] Timeout total do job (`GraphicalAnalysisAttemptJob::orcamentoTimeoutSegundos()`) não contava a
      2ª tentativa do Gemini — corrigido junto da Fase 1 (novo `context_max_attempts`, mesmo padrão
      de `vision_max_attempts`). Orçamento real subiu de 435s pra 470s.
- [x] Nenhum teste existente assumia tentativa única de um jeito que quebrasse com o retry — os que
      usavam `Http::fake()` com resposta única continuam válidos (Laravel devolve a mesma resposta
      pra toda chamada repetida; os cenários "sempre falha" simplesmente passaram a fazer 2 chamadas
      em vez de 1, chegando no mesmo resultado final esperado).

## Fase 1 — Retry no Gemini (critério de negócio, D1/D2) ✅

- [x] `GeminiContextService::collect()` reestruturado: laço de até `context_max_attempts` (=2)
      tentativas, cada uma delegada a um novo método privado `tentarColeta()` (chamada HTTP + parse
      completos, extraído do corpo antigo de `collect()`). Só retorna sucesso quando
      `payload.macro.resumo` E `payload.sentimento.narrativa` vierem os dois não-null. Time
      esgotado sem preencher os dois → devolve a última tentativa como está (nunca fabrica texto).
- [x] Backoff de 400ms entre tentativas (`RETRY_BACKOFF_MS`), só antes de uma 2ª chamada real
      (nunca depois da última).
- [x] `attempts` no resultado final agora reflete o número real de tentativas usadas (1 ou 2), não
      mais fixo em 1 — e um log `genesis.v68.contexto.retry` registra quando uma 2ª tentativa é
      necessária, com o motivo (macro/sentimento ainda vazios).
- [x] `config('genesis_graphical_v6.gemini.context_max_attempts')` novo (env
      `GENESIS_GEMINI_CONTEXT_ATTEMPTS`, default 2) — mesmo padrão de `vision_max_attempts`.
- [x] Testes novos em `GeminiContextServiceTest.php` (+5): retry quando a 1ª vem vazia e a 2ª
      preenche os dois; retry quando a 1ª falha por HTTP 500 e a 2ª sucede; as duas tentativas
      esgotadas continuam `UNAVAILABLE`, nunca texto fabricado (confirma o teto de 2, nunca uma 3ª);
      1ª tentativa completa nunca dispara uma 2ª chamada (não gasta crédito à toa). Todos os 16
      testes do arquivo (11 preexistentes + 5 novos) verdes.

## Fase 2 — Fechamento ✅

- [x] `retry_after` (fila `database`) precisava subir junto do orçamento novo — `QueueRetryAfterTest`
      pegou isso na hora (era 500, precisava de >= 520 com margem de 50s). Subido pra 540
      (`config/queue.php` + `.env.example`, `GENESIS_QUEUE_RETRY_AFTER`).
- [x] Suíte completa: **`tests/Unit` + `tests/Feature`, 956 testes, 2773 assertions, zero falhas
      reais, 2 skipped de sempre.** A rodada combinada mostrou 2 falhas nos mesmos dois arquivos de
      fila assíncrona já documentados como flaky sob concorrência (`GraphicalAnalysisAttemptJobTest`/
      `GraphicalAnalysisFullPipelineIntegrationTest`, spec `genesis-v6-9-correcao-tecnica` desde a
      Fase 2) — confirmado de novo que não é regressão: os dois isolados passam 100% limpos.

---

## Fora de escopo deste spec (a pedido do Felipe)

- Retry em Yahoo Finance/Alternative.me/CoinGecko (VIX/DXY/S&P500/Fear&Greed/dominância do BTC) —
  mesmo problema estrutural, mas fora do escopo pedido agora.
- `MacroController` (rota órfã, sem consumidor real) — fica como está.
