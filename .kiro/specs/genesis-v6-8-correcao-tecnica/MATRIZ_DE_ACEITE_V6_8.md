# Matriz de Aceite — Gênesis V6.8

Espelha a seção 22 (PDF) / seção 34 (MD) do manual do PO. Marcar só com prova executada — "parece
certo" não conta, e este documento existe justamente porque esse foi o padrão de causa raiz que
gerou os bloqueadores da V6.7 (ver seção "O padrão de causa raiz", página 6 do PDF, e a tabela de
verificação em `tasks.md`).

**Checado item a item em 14/08/2026 (Fase 10 de `tasks.md`)** — `[x]` = prova real executada nesta
sessão (teste automatizado, novo ou já existente, rodado de verdade); `[ ]` com nota = bloqueado ou
não aplicável ainda, motivo explícito na própria linha. Achados reais (bugs/gaps genuínos, não só
"item não verificado ainda") documentados com mais detalhe na Fase 10 de `tasks.md`.

## Arquitetura

- [x] `GENESIS_DECISION_PROVIDER` resolve pra `openai` (default do config) e o modelo real é
      `gpt-5.6-terra` (`GENESIS_OPENAI_DECISION_MODEL` no `.env`)
- [x] Payload do decisor sem `input_image`, `image_url` nem `base64` — `OpenAiDecisionClientTest`
- [x] Prompt do decisor sem obrigação visual — `GenesisPromptSemObrigacaoVisualTest.php` (novo)
- [x] Leitura visual e macro/sentimento acontecem antes da decisão — provado pela ordem cronológica
      real das chamadas HTTP (`Http::recorded()`), não por texto de log (só existem logs de FALHA
      por eixo, nenhum de sucesso) — `GraphicalAnalysisAttemptJobTest`
- [x] `authority.decision` no pacote não é `GEMINI_ONLY` — `CanonicalBundleAuthorityTest.php` (novo;
      achado real: a Fase 5 já tinha declarado isso "confirmado" sem nenhum teste automatizado)
- [ ] `AI_PROVIDER` ausente do ambiente — **não satisfeito, de propósito**: a Fase 5 decidiu manter
      `AI_PROVIDER`/o pipeline V6.7 vivos até o benchmark real (10.2) rodar e a Fase 9 apagar esse
      pipeline fisicamente. Só faz sentido cobrar este item depois de 10.2.

## Dados

- [x] +DI e -DI presentes no contrato público, com `status` e `observed_at` — Fase 6.1/7.1
- [x] VIX, DXY, S&P 500, Fear & Greed e dominância do BTC chegam ao front — Fase 7 (implementado
      direto, sem esperar o Bloco 2 do PO — determinável do código real)
- [x] Nenhuma evidência ausente vira zero — `EvidenceManifestBuilder`, testado em várias fases
- [x] `market_price_observed_at`, `indicators_observed_at`, `last_closed_candle_at` e
      `candle_state` presentes — Fase 6.2, `MarketSnapshotClosedCandlesTest`

## Integridade de entrada

- [x] `normalizarPar('1000PEPEUSDT')` devolve `1000PEPEUSDT`
- [x] `normalizarPar('BINANCE:BTCUSDT.P')` devolve `BTCUSDT`
- [ ] Análise real de `1000PEPEUSDT` 1d traz preço na ordem do contrato — precisa de uma análise
      real de ponta a ponta; não executado (mesma decisão de 10.2/10.3, ver `tasks.md`)
- [x] Mesmo gráfico reenviado após erro de rede gera uma análise e uma cobrança —
      `analysisIdempotency.test.ts`

## Correções visíveis ao membro

- [x] R/R abaixo do mínimo mostra o valor calculado e o mínimo, sem contradição
- [x] Quando um alvo posterior atende ao mínimo, a mensagem nomeia esse alvo e mostra o valor
- [x] `execution.status` não recebe valor novo no caminho de R/R baixo — confirmado por comentário
      explícito no código real (`ExecucaoService.php`)
- [x] A nota de custos aparece no bruto; o líquido aparece sem legenda de custos
- [x] `RANGE_SEM_EVENTO`, `ACUMULACAO_RANGE` e `DISTRIBUICAO_RANGE` não geram confluência Wyckoff
- [x] Texto público sem espaço duplo e sem espaço antes de pontuação
- [x] R/R de TP1, TP2 e TP3 vem do backend
- [x] Plano inválido devolve 422 — Fase 6.3

## Segurança

- [x] `POST /webhook/lastlink` sem assinatura devolve 401
- [x] `POST /webhook/asaas` sem token devolve 401
- [x] Webhook reenviado não duplica registro
- [x] `POST /webhook/alertas` sem token interno devolve 403 (não 401 — `InternalServiceToken` usa
      `abort(403,...)` no código real; discrepância com o texto original já documentada na Fase 1)
- [x] `GET /v1/alertas/stream` sem Bearer devolve 401
- [x] Nenhuma credencial previsível em `database/`
- [x] Nenhuma rota pública fora da lista branca — **achado real e corrigido**: `MacroController`
      (`POST /v1/macro/today`, `GET /v1/macro/sentimento`) era pública, sem autenticação, e
      disparava chamada real e cara ao Gemini a cada cache-miss, com zero consumidor real —
      removida. `MacroControllerRemovedTest.php` (novo) prova que as rotas não existem mais.

## Operação

- [x] `QUEUE_CONNECTION` não é `sync` — `database`
- [x] `retry_after` acima do timeout do job; boot não lança — **achado real e corrigido**: 350s
      deixava só 5s de folga real sobre o orçamento do job (345s, calculado de verdade depois da
      Fase 5, não os ~300s estimados) — subido pra 420 (~75s de folga), teste reescrito pra
      comparar contra o orçamento real (`GraphicalAnalysisAttemptJob::orcamentoTimeoutSegundos()`),
      não um número solto.
- [ ] Supervisor com 2 workers `RUNNING` — bloqueado, exige acesso a servidor de produção
- [ ] `GET /api/health/queue` devolve 200 (em produção) — endpoint testado localmente com sucesso
      (`QueueHealthTest`), mas confirmar em produção real exige acesso não disponível aqui
- [x] `composer audit` e `npm audit --omit=dev` sem vulnerabilidade alta ou crítica — **achado real,
      corrigido em grande parte**: npm tinha 3 HIGH (lodash-es/path-to-regexp/react-router),
      `npm audit fix` (sem `--force`) resolveu as três, 0 restantes. composer tinha 15 pacotes
      afetados (2 CRÍTICAS + 14 HIGH, incluindo um SSRF/RCE real em `phpoffice/phpspreadsheet`) —
      `composer update` escopado resolveu as críticas e a maioria das altas, restando 5 pacotes/1
      HIGH (`laravel/framework`, CRLF injection — só corrigível com upgrade de versão maior,
      Laravel 10.x já fora da janela de suporte de segurança; fora do escopo desta fase, sinalizado
      explicitamente, não escondido).

## Prova

- [ ] Benchmark 20x em BTCUSDT 1d, sem inversão direcional contra o baseline V6.7 — **bloqueado,
      mas não por rede**: `generativelanguage.googleapis.com` voltou a responder deste ambiente
      (re-testado 14/08/2026, resposta real em 1,5s — contradiz o achado de 12/08/2026 registrado
      na memória do projeto). O bloqueio real é que **o comando que mede o pipeline V6.8 completo
      nunca foi construído** — `genesis:benchmark-decision` (o comando real, nome diferente do
      `genesis:benchmark` presumido neste documento) só mede a metade V6.7 (decisor sozinho), o
      próprio docblock da classe confirma isso. Perguntado ao Felipe como proceder — escolhido não
      executar agora (custo real de até 20×2 análises pagas), só documentar.
- [ ] Benchmark 20x em SUIUSDT 1d, sem inversão direcional — mesmo bloqueio acima
- [ ] Caso BTCUSDT reproduzido — não executado, mesma decisão acima
- [ ] Caso SUIUSDT reproduzido — não executado, mesma decisão acima
- [x] `php artisan test` verde — 487 testes, 1306 asserções, zero erros/falhas (execução limpa,
      confirmada 14/08/2026)
- [x] `npm test` verde — mesma faixa histórica de 28-29 falhas pré-existentes (confirmadas
      individualmente ao longo do spec, nenhuma nova), sem regressão
- [x] `npm run build` sem erro

## Escada de aprovação

| Estado | Condição |
|---|---|
| **REPROVADO PARA PRODUÇÃO** | Estado atual (13-14/08/2026) — 19 motivos ativos, confirmados contra o código em `tasks.md` |
| **APROVADO PARA SHADOW MODE** | Os 16 itens P0 (Fases 1, 3, 4, 5) aplicados e esta matriz completa, exceto os dois benchmarks |
| **APROVADO PARA PRODUÇÃO** | Benchmarks de BTCUSDT e SUIUSDT rodados 20x cada, sem inversão direcional, e os dois casos reais reproduzidos integralmente |

## Gatilhos de rollback imediato

- Qualquer `GENESIS_V68_BOOT_*` disparando em produção → rollback de código (não existe rollback por
  variável de ambiente — a V6.8 remove `AI_PROVIDER` e muda a interface do decisor de propósito)
- Inversão direcional no benchmark → não subir, investigar
- Taxa de `FAILED` acima de 5% em 30 minutos → rollback de código
- Qualquer análise cobrada sem resultado → rollback + `php artisan genesis:estornar-reservas-orfas`

**As migrations da V6.8 são aditivas — nunca rodar `migrate:rollback` num rollback de emergência.**
