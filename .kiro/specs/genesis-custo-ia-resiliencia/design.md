# Design — Custo de IA e Resiliência da Análise

## Visão Geral

Duas metas ligadas:

1. **Custo:** medir o que gasta, cachear o que não muda por análise (macro 24h, sentimento por ativo) e cortar chamadas repetidas.
2. **Resiliência:** dado que falta vira `null` e a análise segue. A resposta da IA que só erra detalhe de texto é corrigida em código, não paga de novo.

As duas convergem: grande parte do custo extra vem de **repair** (o validador reprova a resposta e o job refaz a decisão inteira), não de indicador faltando.

## Estado Atual Auditado (2026-09-25)

Auditoria do código em `genesis-api` (`staging`, depois de `37aebff`) e contagem no `storage/logs/laravel.log` local (1,5 GB, mistura testes/benchmarks: **mostra padrões, não volume de produção**).

### Chamadas de IA por análise (pior caso)

| Etapa | Onde | Retry hoje | Custo por chamada |
|---|---|---|---|
| Scan | `ChartMetadataScanService` | primário + reserva 3.5 (`37aebff`) | imagem |
| Visão | `GeminiVisionService` | `vision_max_attempts=2` × job `$tries=3` | imagem alta + thinking HIGH |
| Contexto | `GeminiContextService` | `context_max_attempts=2`, retry por **negócio** (macro E sentimento preenchidos) | **google_search** + thinking MEDIUM |
| Decisão | `FailoverDecisionProvider` | 3 no primário → fallback, × job `$tries=3` (repair) | bundle completo + thinking HIGH |

`VisionProviderException` é relançada para o job, então a visão pode chegar a 2 × 3 = 6 chamadas. A decisão pode chegar a 3 repairs × (3 + fallback).

### Contagem no log local

| Evento | Qtd |
|---|---|
| `genesis.v68.decisao_precisa_de_repair` | 467 |
| `genesis.v68.contexto.retry` | 442 |
| `genesis.v68.visao.http_falhou` | 102 |
| `GENESIS_DECISION_PROVIDER_FAILOVER` | 72 |
| `decisao_reutilizada_por_bundle_hash` (cache hit) | 12 |
| `MARKET_CANDLES_UNAVAILABLE` | 0 |

Erros de repair mais frequentes: `STOP_SELECTION_UNKNOWN` (20), `MISSING_FIELD:plano_primario`+`PLANO_PRIMARIO_INVALID` (8), `PLAN_B_MISSING` (4), `NARRATIVE_MENTIONS_UNAVAILABLE_VISUAL:LTA` (3+), `UNACCOUNTED_NUMERIC_LITERAL`/`NUMERIC_CITATION_VALUE_MISMATCH` (vários).

### Achados que mudam a estratégia

1. **O contexto não entra na decisão.** `CanonicalBundleBuilder` faz `unset($bundle['context'])` e o `manifest_hash` também o exclui. Macro/sentimento (a etapa com `google_search`) servem **só para exibição**, mas rodam por análise, sem cache nenhum, com até 2 tentativas. É o candidato mais claro a corte, e o cache de 24h do macro vem direto disso.
2. **Macro e sentimento saem da mesma chamada.** Para cachear macro por 24h (global) e sentimento por ativo, a chamada precisa ser dividida em duas.
3. **Indicador faltando já não trava a análise.** `MarketSnapshotService::safe()` e o contexto já degradam para `UNAVAILABLE`. O que "invalida" é o `DecisionResponseValidator` reprovando a resposta da IA, e um dos motivos é justamente a IA **citar** um dado indisponível (`NARRATIVE_MENTIONS_UNAVAILABLE_VISUAL`).
4. **Candles** vêm da API pública da Binance Futures (não da nossa API, sem custo de IA). São o único bloqueio real (menos de 60 fechados) e **não vão para o bundle** da IA (V6.5 C09). Não são causa de custo.
5. **`MacroController::today`** já tem `Cache::remember` até o fim do dia, mas é outra geração, separada da análise. São dois "macros do dia" diferentes.
6. **Consumidores fora da análise:** `UtilityGeminiProxyController` (proxy genérico com google_search opcional, sem rate limit visível), `MacroController::sentimento` (cache 1h), `GeoEventService` (o schedule está comentado; o poll de 30s do FE bate em `/v1/geo-events`, a confirmar que só lê do banco).

## Arquitetura

### Contexto em duas camadas de cache

```
GeminiContextService::collect($symbol, $timeframe)
 ├─ MacroContextCache::get()                  ← global, TTL 24h
 │    Cache::lock('genesis:macro:lock')->block(…)
 │    hit → payload + observed_at
 │    miss → 1 chamada (google_search) → ok: put 24h | falha: put negativo 15min → UNAVAILABLE
 └─ SentimentContextCache::get($symbol)       ← por ativo, TTL 60min (config)
      mesma mecânica, chave genesis:sentiment:{SYMBOL}
```

- Store: o driver de cache atual (`database`). Payload pequeno (texto + eventos), sem risco de memória como o do `pending_bundle`.
- Chave do macro inclui a data UTC e `schema_version` do contexto, para invalidar numa mudança de prompt.
- `MacroController::today`/`sentimento` passam a ler dos mesmos caches (Req. 2.6, 7.3).
- Negative cache evita martelar o provedor quando ele está fora (Req. 2.3).

### Uma chamada por etapa

Mudanças só de config e loop, sem mudar o contrato:

| Config | Hoje | Novo |
|---|---|---|
| `GENESIS_GEMINI_CONTEXT_ATTEMPTS` | 2 | 1 |
| `GENESIS_GEMINI_VISION_ATTEMPTS` | 2 | 2, mas só transporte (conteúdo inválido não repete) |
| `FailoverDecisionProvider::RETRY_BACKOFF_MS` | `[250, 500]` (3 tentativas) | `[]`: 1 tentativa, depois failover |
| `GENESIS_GEMINI_MAX_ATTEMPTS` (job) | 3 | 2 |

`FinalizarAnalisesTravadas` já calcula o limiar a partir da config e precisa só ser conferido.

### Dado indisponível como `null`

- `CanonicalBundleBuilder` publica `availability.unavailable[]` no bundle da decisão (lista de caminhos/rótulos indisponíveis).
- `GenesisPrompt` ganha uma regra: "campos em `availability.unavailable` não existem para esta análise; não os cite, não os estime".
- `DecisionMechanicalRepair` ganha um passo novo: remover as frases que citam os itens de `availability.unavailable` e revalidar. Se o texto ficar abaixo do mínimo exigido, cai no repair normal.
- Auditoria de `0` vs `null`: varrer `safe(..., 0)`, `?? 0` e `(float)` casts em `MarketSnapshotService`, `TechnicalAnalysisService`, `DerivativesReadingService` e `SupplementalIndicatorsService`. Exceção legítima: `preco_variacao_pct` da vela viva, que é 0 de verdade quando não houve variação.

### Menos repair

Ordem no job após a decisão:

1. `DecisionResponseValidator::validate()` (uma vez só, como hoje).
2. `DecisionMechanicalRepair::attempt()`, estendido com:
   - remoção de menções a dados indisponíveis;
   - números não rastreados: remover a frase ou rebaixar a aviso (**decisão pendente**, ver abaixo).
3. Fallback de stop (`StopSelectionValidator::apenasErrosDeSelecao`) **sem** a condição `attempts() > 1`.
4. Só então repair via IA, para erros estruturais.

### Telemetria

- `provider_telemetry.{etapa}` passa a ter `usage` (tokens in/out/thinking), `http_calls` e `grounded`. Parte disso já existe em `comTelemetria()` e precisa ser padronizada.
- Log `genesis.ia.chamada` em todo cliente HTTP de IA (`GeminiInteractionsClient`, `OpenAiInteractionsClient`, `ChartMetadataScanService`, `UtilityGeminiProxyController`, `MacroController`, `GeoEventService`).
- `php artisan genesis:custo-ia --desde=YYYY-MM-DD` agrega a partir de `analises.provider_telemetry` mais o log.

## Decisões Pendentes (Felipe)

1. **TTL do sentimento por ativo**: 60 min proposto.
2. **Números não rastreados no texto**: remover a frase (texto mais curto, sempre consistente) **ou** rebaixar a aviso (texto intacto, pode publicar um número sem evidência).
3. **Contexto na análise**: se, com o cache, ainda valer a pena manter a busca de sentimento por análise ou só mostrar o do cache/última geração.
4. **Thinking**: reduzir só depois do benchmark (Req. 8).

## Riscos

- **Macro de 24h pode ficar velho** num evento macro grande no meio do dia. Mitigação: `observed_at` visível e um comando `genesis:macro:refresh` para invalidar na mão.
- **Menos tentativas = mais `UNAVAILABLE` visível.** É o comportamento pedido. A medição (Req. 1) mostra a taxa real.
- **Remover frases em código** pode deixar o texto curto demais. Nesse caso cai no repair normal, sem publicar texto quebrado.
- Não usar `RefreshDatabase` nos testes novos (banido repo-wide): sqlite persistente + `DatabaseTransactions`.
- Nenhuma migração/seed sem autorização explícita. Esta spec não prevê migração (tudo vive em cache e em JSON já existente).

## Estratégia de Testes

- Unit: `MacroContextCache`/`SentimentContextCache` (hit, miss, falha não cacheada 24h, negative cache, lock), com `Http::fake` contando chamadas.
- Unit: `DecisionMechanicalRepair` (menção a indisponível removida, revalida limpo; texto curto demais cai no repair).
- Feature: job completo com `Http::fake` garantindo **exatamente 1 chamada por etapa** no caminho feliz, e 0 chamadas de contexto com cache quente.
- Feature: indicador forçado a falhar → análise `COMPLETED`, campo `null`, nenhum texto citando o indicador.
- Regressão: suíte completa do [API] verde.
