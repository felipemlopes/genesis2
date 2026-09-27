# Design — OpenAI como Fallback do Gemini

## Visão Geral

O Gemini continua primário em tudo. A OpenAI (`gpt-6-luna`) entra como **último elo** nas quatro etapas: **Decisão, Visão, Scan e Contexto** (macro e sentimento, cada bloco separado; incluído por decisão do Felipe em 27/09/2026).

Princípio único para todas as etapas: **só falha de transporte avança na cadeia**. Erro de conteúdo continua indo para o repair do job, como hoje.

## Estado Atual Auditado (27/09/2026)

Código em `genesis-api` (`staging`).

| Etapa | Onde | Cadeia hoje | Onde a cadeia é montada |
|---|---|---|---|
| Scan | `ChartMetadataScanService` | modelo principal → `scan_fallback_model` (Gemini) | laço `foreach ($modelos ...)` dentro do service |
| Visão | `GeminiVisionService` | modelo → `vision_fallback_model` (Gemini), `vision_max_attempts` | dentro do service; binding em `GenesisGraphicalServiceProvider` é só `match` |
| Contexto | `GeminiContextService` | 1 chamada Gemini por bloco (`tentarBloco`), com `google_search`; cache macro 24h global / sentimento 6h por ativo, lock por chave, cache negativo 15 min | `blocoCacheado()` dentro do service; binding é só `match` |
| Decisão | `FailoverDecisionProvider` | `decision_provider` → `decision_provider_fallback` (hoje `gemini` → `gemini_secondary`) | binding em `GenesisGraphicalServiceProvider`, **só 2 elos** |

Achados que mudam o design:

1. **`FailoverDecisionProvider` aceita exatamente 2 provedores** (construtor `primary`, `fallback`). Colocar a OpenAI como terceiro elo exige generalizar para uma lista.
2. **`OpenAiDecisionClient` já existe e funciona** com a Responses API, schema estrito (`GenesisDecisionSchema::forOpenAi()`), classificação transporte/semântico e registro no `AiUsageRecorder`. Mas lê `genesis_graphical_v6.openai_model`, a **mesma chave** do pipeline V6.7 preservado. Por isso o fallback precisa de config própria (Req. 2.5).
3. **`orcamentoTimeoutSegundos()` conta só o timeout do decisor primário.** Com failover, o pior caso real já soma primário + reserva hoje. Com um terceiro elo o descompasso cresce (Req. 7).
4. **`VisionProviderException` não diz se a falha foi de transporte.** O código de erro vai só na mensagem (`VISION_INVALID_JSON:...`, `VISION_GEMINI_API_KEY_MISSING`...).
5. **`AiUsageRecorder::usoOpenAi()` já existe** e lê `usage.input_tokens`, `output_tokens` e `input_tokens_details.cached_tokens`. Falta converter tokens em dólar.
6. **O contexto já centraliza cache e lock em `blocoCacheado()`,** e a chamada fica isolada em `tentarBloco()`. `tentarBloco()` já distingue timeout (`CONTEXT_TIMEOUT`), HTTP (`CONTEXT_HTTP_{status}`), JSON inválido e bloco vazio. Então o fallback cabe inteiro ali, sem mexer no cache nem nos consumidores (`MacroController`, `genesis:macro-refresh`).
7. **A conta OpenAI estava sem crédito** (comentário na config, linha ~216). Foi por isso que o fallback atual virou `gemini_secondary`.

## Arquitetura

```
                 ┌─────────── LoggingDecisionProvider ───────────┐
Job ── decide ──►│ ChainDecisionProvider                          │
                 │   gemini ──(transporte)──► gemini_secondary    │
                 │                  ──(transporte)──► openai_fallback
                 └────────────────────────────────────────────────┘

Job ── read ───► FailoverVisionProvider
                   GeminiVisionService (já tenta vision_fallback_model)
                     ──(transporte)──► OpenAiVisionService

Upload ── scan ─► ChartMetadataScanService
                   gemini principal → scan_fallback_model ──(transporte)──► OpenAI

Job / MacroController / macro-refresh ──► GeminiContextService
                   blocoCacheado(macro | sentimento)   [cache + lock inalterados]
                     tentarBloco: Gemini + google_search
                       ──(transporte)──► OpenAI + web_search
```

### 1. Decisão: `ChainDecisionProvider`

- **Nasce de uma generalização.** É o `FailoverDecisionProvider` recebendo `DecisionProvider[]` em vez de dois.
- **Sem quebrar o que existe.** `FailoverDecisionProvider` vira um alias fino (ou é substituído) sem mudar o comportamento de 2 elos. Os testes existentes continuam válidos.
- **Regra de avanço.** A cada `TransportProviderException`: `Log::warning('GENESIS_DECISION_PROVIDER_FAILOVER', ['de' => ..., 'para' => ..., 'reason' => ...])`, depois `marcarProximaComo('failover')`, e segue para o próximo elo. Se o último elo falhar, relança a última exceção.
- **Repair.** O job chama `decide()` de novo; a cadeia recomeça no primário (Req. 2.4) sem código extra.
- **Novo braço `openai_fallback` no `match` do binding.** Ele instancia `OpenAiDecisionClient` com overrides de config (modelo, chave, esforço de raciocínio, timeout). Hoje o client lê tudo de `config()` direto. Proposta: construtor opcional com `?array $overrides = null`, mesmo padrão de `new GeminiDecisionClient($modelo)`.
- **Leitura da env de cadeia:**

```php
$cadeia = array_filter(array_map('trim', explode(',', (string) config('genesis_graphical_v6.decision_provider_chain'))));
if ($cadeia === []) {
    $cadeia = [config('genesis_graphical_v6.decision_provider'), config('genesis_graphical_v6.decision_provider_fallback')];
}
```

### 2. Visão: `OpenAiVisionService` + `FailoverVisionProvider`

- **`OpenAiVisionService implements VisionProvider`.** Usa a Responses API com `input_image` (`data:{mime};base64,...`), `detail` configurável, o mesmo prompt de visão e saída em `json_schema` estrito, se o schema de visão couber no dialeto da OpenAI (verificar na tarefa 0.3). Se não couber, usa `json_object` e deixa o `VisionResponseValidator` cobrir.
- **Mesmo formato de retorno do Gemini:** `payload, model, provider='openai', latency_ms, attempts, usage`.
- **`VisionProviderException` ganha `public readonly bool $transporte`.** `GeminiVisionService` marca `true` quando a última falha foi timeout, conexão, 429 ou 5xx. `KEY_MISSING`, JSON inválido e validação reprovada ficam `false`.
- **`FailoverVisionProvider`:** tenta o primário e, só se `$e->transporte`, tenta o fallback. `GENESIS_VISION_PROVIDER_FALLBACK` vazio desliga.

### 3. Scan

- **O laço de modelos vira uma lista de `[provedor, modelo]`.** O elo OpenAI monta o payload da Responses API com a imagem e o **mesmo** `$prompt`, e extrai o texto do `output`.
- **A regra de "transitório" continua a mesma:** 429 ou ≥500, e exceção de conexão.
- **Client compartilhado.** Para não duplicar HTTP e extração de texto entre visão e scan, extrair um **`OpenAiResponsesClient`** pequeno (`post(array $payload, string $etapa, int $timeout): array{body, status, latency_ms}` + `extrairTexto()`), que registra no `AiUsageRecorder`. O `OpenAiDecisionClient` **não** é migrado para ele nesta spec (já está testado; risco sem ganho).

### 4. Contexto (macro e sentimento)

- **O fallback fica dentro do `GeminiContextService`,** não em um `FailoverContextProvider`. O cache, o lock e o cache negativo moram nesse service. Envolver por fora faria a OpenAI rodar fora do lock, gerando o bloco em paralelo e gravando cache duplicado.
- **Onde exatamente:** `gerarBloco()` passa a ser:

```php
$gemini = $this->tentarBloco($bloco, $symbol, $eventos, $apiKey);
if ($gemini['dados'] !== null || ! $this->falhaDeTransporte($gemini['error_code']) || ! $this->fallbackOpenAiLigado()) {
    return $gemini;
}
app(AiUsageRecorder::class)->marcarProximaComo('failover');
Log::warning('genesis.contexto.failover_openai', ['bloco' => $bloco, 'motivo' => $gemini['error_code']]);

return $this->tentarBlocoOpenAi($bloco, $symbol, $eventos);
```

- **O que conta como transporte:** `CONTEXT_TIMEOUT`, `CONTEXT_HTTP_429` e `CONTEXT_HTTP_5xx`. Não contam `CONTEXT_INVALID_JSON`, `*_EMPTY` nem os demais 4xx.
- **`tentarBlocoOpenAi()`** usa o `OpenAiResponsesClient` (§3) com:
  - `instructions` = `systemPrompt($bloco)` e `input` = `userPrompt($bloco, $symbol, $eventos)`, os mesmos textos do Gemini;
  - `tools: [{type: "web_search"}]`, o equivalente ao `google_search`;
  - `reasoning.effort` próprio (`GENESIS_OPENAI_FALLBACK_CONTEXT_REASONING_EFFORT`, padrão `low`) e `max_output_tokens`.
  - **Sem `text.format` estrito,** mesma escolha já feita no Gemini ("tools + JSON estrito sem precedente testado"). O parse usa o mesmo `decodificarContexto()`, e a montagem de `dados` (macro: `resumo`/`score`; sentimento: `narrativa`/`score`/gatilhos) é extraída para um método comum aos dois provedores.
- **Cache e chave:**
  - O retorno tem o mesmo formato (`dados, error_code, observed_at, cache_hit, attempts, model, usage`), então `blocoCacheado()` cacheia sem mudança. `model` = modelo OpenAI real, o que deixa visível no cache e na telemetria que o bloco veio do fallback.
  - O cache negativo só é gravado quando `dados === null` depois dos dois provedores. Isso já é consequência do `if` atual em `blocoCacheado()`.
  - **Chave Gemini ausente:** hoje `blocoCacheado()` e `collect()` retornam `CONTEXT_GEMINI_API_KEY_MISSING` antes de gerar. Isso continua igual (Req. 5.2): é erro de configuração, não queda do Google.
- **Telemetria:** `AiUsageRecorder::consultasOpenAi($body)` conta os itens `type === "web_search_call"` do `output`, no mesmo campo que `consultasGemini()` alimenta.
- **Lock:** `context_cache_lock_wait_seconds` precisa ser ≥ timeout do Gemini no contexto + timeout da OpenAI no contexto. A guarda de boot avisa se não for (Req. 7.1a).

### 5. Config

Arquivo `config/genesis_graphical_v6.php`:

```php
'decision_provider_chain' => env('GENESIS_DECISION_PROVIDER_CHAIN', ''),
'vision_provider_fallback' => env('GENESIS_VISION_PROVIDER_FALLBACK', ''),
'scan_openai_fallback' => (bool) env('GENESIS_SCAN_OPENAI_FALLBACK', false),
'context_openai_fallback' => (bool) env('GENESIS_CONTEXT_OPENAI_FALLBACK', false),

'openai_fallback' => [
    'api_key' => env('GENESIS_OPENAI_FALLBACK_KEY'),
    'base_url' => env('GENESIS_OPENAI_FALLBACK_BASE_URL', 'https://api.openai.com/v1'),
    'model' => env('GENESIS_OPENAI_FALLBACK_MODEL', 'gpt-6-luna'),
    'reasoning_effort' => env('GENESIS_OPENAI_FALLBACK_REASONING_EFFORT', 'medium'),
    'decision_timeout_seconds' => (int) env('GENESIS_OPENAI_FALLBACK_DECISION_TIMEOUT', 120),
    'vision_timeout_seconds' => (int) env('GENESIS_OPENAI_FALLBACK_VISION_TIMEOUT', 60),
    'scan_timeout_seconds' => (int) env('GENESIS_OPENAI_FALLBACK_SCAN_TIMEOUT', 45),
    'context_timeout_seconds' => (int) env('GENESIS_OPENAI_FALLBACK_CONTEXT_TIMEOUT', 60),
    'context_reasoning_effort' => env('GENESIS_OPENAI_FALLBACK_CONTEXT_REASONING_EFFORT', 'low'),
    'context_max_output_tokens' => (int) env('GENESIS_OPENAI_FALLBACK_CONTEXT_MAX_OUTPUT_TOKENS', 4096),
    'image_detail' => env('GENESIS_OPENAI_FALLBACK_IMAGE_DETAIL', 'high'),
],
```

- **Prefixo próprio (`GENESIS_OPENAI_FALLBACK_*`).** Evita colisão com as `OPENAI_*` genéricas (squatting já confirmado nesta máquina) e com `GENESIS_OPENAI_DECISION_*` (V6.7).
- **Tudo desligado por padrão:** cadeia vazia, fallback de visão vazio, scan e contexto `false`. Fazer deploy do código não muda nada até alguém mexer nas envs.

### 6. Orçamento de tempo

`orcamentoTimeoutSegundos()` passa a somar:

- **Decisão:** a soma do timeout (com connect) de cada elo da cadeia resolvida.
- **Visão:** o pior caso do Gemini (já calculado) mais `openai_fallback.vision_timeout_seconds` quando o fallback de visão estiver ligado.
- **Contexto:** 2 blocos × (timeout Gemini + `openai_fallback.context_timeout_seconds`) quando o fallback de contexto estiver ligado. Conferir antes se o orçamento atual já conta o contexto; se não contar, é um achado a registrar aqui.

Consequência: o `retry_after` da fila precisa subir **antes** de ligar a cadeia em produção. A guarda de boot já avisa.

### 7. Custo em dólar

`config/genesis_ai_prices.php` (US$ por 1M tokens, preços de 27/09/2026, contexto curto; busca por 1.000 chamadas):

| Modelo | entrada | cache | saída | busca |
|---|---|---|---|---|
| `gpt-6-luna` | 0,10 | 0,01 | 0,50 | 10,00 |
| `gpt-5.6-terra` | 2,00 | 0,20 | 12,00 | 10,00 |
| modelos Gemini em uso | preencher pela tabela do Google na tarefa 6.1 | | | |

- **Como calcular:** `custo = (entrada − cache) × p_entrada + cache × p_cache + (saída + raciocínio) × p_saída + buscas × p_busca / 1000`.
- **Onde aparece:** `genesis:custo-ia` ganha as colunas `US$` e `análises com fallback OpenAI`.

### Estimativa de custo (por acionamento do fallback)

Tokens da linha de base medida na spec `genesis-custo-ia-resiliencia` (tokenizador do Gemini; o da OpenAI conta diferente, então é ordem de grandeza).

| Etapa | Tokens por chamada | `gpt-6-luna` |
|---|---|---|
| Decisão | ~38 mil de entrada + ~17 mil de saída/raciocínio | ~US$ 0,012 |
| Visão | ~6 mil (inclui imagem) | ~US$ 0,001 |
| Scan | ~2–3 mil (inclui imagem) | < US$ 0,001 |
| Contexto (por bloco) | ~1 mil de prompt + ~5–10 mil de conteúdo da busca + 1–3 buscas | **~US$ 0,01–0,03** (quase tudo busca) |

- **Pior caso por análise com fallback:** decisão com 3 repairs, todos caindo na OpenAI, dá cerca de **US$ 0,04**.
- **Custo real = valor acima × taxa de failover.** Mil failovers de decisão ≈ US$ 12.
- **O contexto é pago por janela de cache, não por análise.** O macro é global e gera no máximo 1 vez a cada 24h (~30/mês). O sentimento gera 1 vez a cada 6h por ativo (4/dia). Pior caso, com o Gemini fora o mês inteiro e 20 ativos analisados: ~30 + 2.400 blocos ≈ **US$ 25–75/mês**. Num mês normal, com falhas pontuais, fica perto de zero.
- **Qualidade conta no custo.** Se o Luna precisar de mais repairs que o Gemini, cada repair é outra chamada inteira. Por isso o benchmark da tarefa 0.4 decide se a decisão entra na cadeia.

## Testes

- **Sem `RefreshDatabase`:** sqlite persistente + `DatabaseTransactions`.
- **Tudo com `Http::fake`**, sem rede real nos testes automatizados.
- **Decisão:**
  - cadeia com 3 elos: 1º e 2º dão 503, o 3º responde → `calls[]` com 3 registros (`primeira`, `failover`, `failover`);
  - erro semântico no 1º não avança;
  - cadeia vazia = comportamento antigo.
- **Visão:**
  - timeout no Gemini (depois da reserva interna) → OpenAI responde;
  - JSON inválido no Gemini não aciona a OpenAI;
  - fallback vazio = só Gemini.
- **Scan:** 503 nos dois Gemini → OpenAI lê; 400 no primeiro não avança.
- **Contexto (macro e sentimento, cada um):**
  - timeout e 503 no Gemini → OpenAI preenche, cacheado com TTL normal e `model` da OpenAI;
  - JSON inválido e bloco vazio no Gemini não acionam a OpenAI;
  - os dois falham → cache negativo gravado uma vez;
  - flag `false` = comportamento atual;
  - `web_search_call` contado em `grounding_queries`;
  - `MacroController::today` com Gemini fora devolve o macro da OpenAI.
- **Orçamento:** soma correta para as combinações de cadeia.
- **Custo:** cálculo em US$ e "sem preço" para modelo desconhecido.

## Ativação

1. Staging: ligar só a decisão (`GENESIS_DECISION_PROVIDER_CHAIN=gemini,gemini_secondary,openai_fallback`) e ajustar `retry_after`.
2. Forçar falha (chave Gemini inválida no staging) e conferir que a análise sai pela OpenAI, com custo em `genesis:custo-ia`.
3. Ligar a visão, depois o scan e depois o contexto, um de cada vez. No contexto, limpar o cache macro/sentimento (`genesis:macro-refresh`) antes do teste, para forçar a geração.
4. Produção: mesma ordem, só trocando envs. Rollback = esvaziar as envs.
