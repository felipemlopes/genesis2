# Plano de Implementação: decisor volta para o Gemini (gemini-3.7-flash)

**Status deste documento**: criado como planejamento puro (15/08/2026, "crie um plano spec para eu
ver"), depois executado fase a fase na mesma sessão, a pedido explícito ("execute fase N"). **Fases
1-6 implementadas e testadas (16/08/2026) — o decisor real já roda no Gemini
(`gemini-3.7-flash`)**, `.env` real com `GENESIS_DECISION_PROVIDER=gemini`, suíte completa verde
(Unit 378 + Feature 124, 0 falhas). Rollback documentado no fim do arquivo, pronto se necessário.

## Contexto — por que este spec existe

Na sessão de hoje (15/08/2026), duas análises reais falharam (#138 APT, #143 OP). Investigando, a
causa do #143 foi isolada e **confirmada ao vivo, duas vezes**: a chave
`GENESIS_OPENAI_DECISION_KEY` (usada pelo decisor único, `OpenAiDecisionClient`, modelo
`gpt-5.6-terra`) está sem crédito na OpenAi —

```
HTTP 429 — "code": "credit_balance_exhausted"
"message": "You have no credits remaining. Add credits to continue using the API..."
```

reproduzido batendo direto em `POST https://api.openai.com/v1/chat/completions` com a chave e o
modelo reais, agora, fora de qualquer log.

**Pedido do Felipe**: parar de depender da OpenAI no decisor — voltar para o Gemini, usando o
modelo mais recente disponível (`gemini-3.7-flash`, não o `gemini-3.6-flash` que a visão/contexto já
usam).

**Repositório único deste spec**: `E:\Programas\wamp64\www\genesis-api` (backend). Não há mudança de
frontend prevista — o contrato de resposta da análise (`AnalysisPublicResponseBuilder`) não muda,
troca de provedor decisório é transparente para quem consome a API.

## Pré-checagens já feitas ao vivo (15/08/2026, antes de escrever este plano)

| Checagem | Resultado |
|---|---|
| `gemini-3.7-flash` existe na conta configurada (`GEMINI_API_KEY`)? | ✅ Confirmado via `GET /v1beta/models` — está na lista, ativo. |
| A chave `GEMINI_API_KEY` responde chamadas reais de `generateContent`? | ✅ `HTTP 200`, resposta coerente. |
| O schema JSON que o decisor exige (`GenesisDecisionSchema`) já tem uma versão pro dialeto Gemini? | ✅ **Já existe** — `GenesisDecisionSchema::forGemini()` (`app/Support/GenesisDecisionSchema.php:112-115`), escrito na Fase 5 do spec V6.8 "reservado para o dia em que `decision_provider` puder ser `gemini`". Não precisa escrever nem alterar o schema. |
| `forGemini()` é aceito pelo `gemini-3.7-flash` via `generationConfig.responseSchema`? | ✅ Testado ao vivo agora: `HTTP 200`, o modelo devolveu JSON 100% aderente ao schema (todos os campos obrigatórios, enums corretos, `schema_version` certo). |
| `GenesisPrompt::system()`/`user()` (o prompt real do decisor) dependem de algo específico da OpenAI? | ❌ Não — é texto puro, já é consumido só via `GenesisPrompt::system()`/`user()` pelo `OpenAiDecisionClient::payload()`, sem nenhuma referência a Structured Outputs/Responses API dentro do próprio texto. Reaproveitável sem alteração. |
| `DecisionResponseValidator::validate()` depende de algo específico da OpenAI? | ❌ Não — valida só o array `$decision` decodificado, é agnóstico de provedor. Reaproveitável sem alteração. |
| O orçamento de timeout do job (`GraphicalAnalysisAttemptJob::orcamentoTimeoutSegundos()`) já sabe lidar com decisor não-OpenAI? | ⚠️ **Achado real**: já existe um `if ($decisionProvider === 'openai') {...} else {...}` (linha 92-95), mas o `else` aponta para as chaves de config **antigas e planas** (`genesis_graphical_v6.timeout_seconds`/`connect_timeout_seconds`, do pipeline V6.7 congelado/`GeminiInteractionsClient`), não para um orçamento dedicado do novo decisor Gemini. Precisa de ajuste (Fase 1). |

## Escopo explícito

Só o **decisor** (o que hoje é `OpenAiDecisionClient`) muda de provedor. `vision_provider` e
`context_provider` continuam `gemini`/`gemini-3.6-flash`, sem alteração — não foi pedido, e
`GeminiVisionService`/`GeminiContextService` não têm nenhum problema conhecido hoje.

A infraestrutura de dois provedores (`OpenAiDecisionClient` + toda a config `GENESIS_OPENAI_DECISION_*`)
**não é removida** — fica como rollback de 1 variável de ambiente (`GENESIS_DECISION_PROVIDER=openai`),
mesmo padrão que o spec `genesis-devolucao-v6-7-e-migracao-openai` já usou pra manter os dois lados
vivos. Faz sentido: se a OpenAI receber crédito de novo no futuro, o Felipe pode voltar num flip só.

Fora de escopo (nada disto é tocado): `GeminiInteractionsClient`/`OpenAiInteractionsClient` (pipeline
V6.7 congelado, usado só pelo benchmark), `BenchmarkGenesisDecision`, `ChartMetadataScanService`
(scan de metadados, já usa Gemini, não relacionado ao decisor), frontend.

## Risco operacional — ler antes de aprovar

- **Chave reaproveitada, sem chave nova**: diferente da migração pra OpenAI (que precisou de um
  prefixo exclusivo pra não colidir com uma chave de outro subsistema já squatting nas env vars
  genéricas), aqui a mesma `GEMINI_API_KEY` que a visão e o contexto já usam serve para o decisor —
  é a mesma conta Google, sem risco de colisão de nome. Efeito colateral a monitorar: as 3 chamadas
  do job (visão + contexto + decisão) passam a competir pela **mesma cota/rate-limit** da mesma
  chave, o que não acontecia com OpenAI (chave separada). Se a cota da conta Gemini for baixa, isso
  pode criar contenção que não existia antes — vale checar o rate limit da chave antes de ir pra
  produção (Fase 6).
- **`gemini-3.7-flash` não foi testado sob carga real do prompt completo** — a checagem acima usou um
  prompt de exemplo minúsculo, não o `bundle_json` real (que é grande: evidence completo, vision,
  context). Schema aceito não é garantia de latência/comportamento aceitáveis com o payload real —
  Fase 5 (prova real) existe exatamente pra fechar essa lacuna antes de virar padrão.
- **`thinkingConfig.thinkingLevel`** — `GeminiVisionService`/`GeminiContextService` já usam esse
  parâmetro contra o mesmo endpoint (`:generateContent`), então o formato está confirmado correto
  pela própria base de código; não é um risco novo, só reaproveitar o padrão certo (ver Fase 2).

---

## FASE 1 — Config: timeout dedicado + guarda de boot ✅ concluída (15/08/2026)

- [x] **1.1** `config/genesis_graphical_v6.php` — dentro do bloco `'gemini' => [...]` (o aninhado,
      Fase 4/5 da V6.8), adicionadas: `decision_model` (`GENESIS_GEMINI_DECISION_MODEL`, default
      `gemini-3.7-flash`), `decision_timeout_seconds` (`GENESIS_GEMINI_DECISION_TIMEOUT`, default 90),
      `decision_connect_timeout_seconds` (`GENESIS_GEMINI_DECISION_CONNECT_TIMEOUT`, default 10),
      `decision_thinking_level` (`GENESIS_GEMINI_DECISION_THINKING`, default `HIGH`).
- [x] **1.2** `GraphicalAnalysisAttemptJob::orcamentoTimeoutSegundos()` — ramo `match` com 3 casos
      explícitos agora: `openai` (inalterado), `gemini` (usa as chaves novas da 1.1), e `default`
      que **lança** `RuntimeException` para qualquer valor desconhecido (não cai mais
      silenciosamente nas chaves antigas do pipeline V6.7 congelado — o achado real documentado no
      plano). Testado via tinker: `openai` continua em 345s (sem regressão), `gemini` calcula
      265s (110 visão + 35 contexto + 100 decisão + 20 margem), valor inválido lança a exceção
      esperada com a mensagem certa.
- [x] **1.3** `GenesisGraphicalServiceProvider::validateConfiguration()` — guarda trocada para aceitar
      `['openai', 'gemini']`. Guarda de `gemini_api_key` ausente confirmada como já cobrindo este
      caso (vision/context sempre usam Gemini), sem alteração necessária ali.
- [x] **1.4** `.env.example` — as 4 variáveis novas adicionadas com comentário explicando a decisão
      de reaproveitar `GEMINI_API_KEY` (sem chave nova) e o motivo do timeout maior que vision/context.

**Achado de execução, fora do escopo original da Fase 1**: `bootstrap/cache/config.php` estava com
cache stale (mesmo problema já documentado neste projeto) — as chaves novas só passaram a existir de
verdade depois de `php artisan config:clear`. Sem isso, `orcamentoTimeoutSegundos()` calculava um
orçamento gemini errado (165s, faltando os 100s da etapa de decisão) silenciosamente, porque
`(int) config(...)` de uma chave ausente vira `0` em vez de erro. Rodado e confirmado corrigido.

**Regressão**: suíte `Unit` completa rodada após as 4 mudanças — **368 passed (896 assertions), 0
falhas**.

## FASE 2 — `GeminiDecisionClient` (nova classe, implementa `DecisionProvider`) ✅ concluída (15/08/2026)

- [x] **2.1** `app/Services/GraphicalAnalysis/GeminiDecisionClient.php` criado, modelado em
      `GeminiContextService::collect()` + `OpenAiDecisionClient::decide()` como planejado.
- [x] **2.2** `payload()` implementado exatamente como especificado (`system_instruction`/`contents`/
      `generationConfig` com `responseMimeType`+`responseSchema`+`thinkingConfig`).
- [x] **2.3** Tratamento de erro HTTP implementado com prefixo `GEMINI_`. **Achado real, testado ao
      vivo antes de fechar a fase**: diferente da OpenAI (401/403 para chave inválida), a API do
      Gemini devolve chave inválida como **HTTP 400** com `error.details[].reason=API_KEY_INVALID`
      no corpo — sem checar isso, caía no branch genérico `GEMINI_HTTP_400`, perdendo a categoria
      (o texto completo do erro já ia pro log de qualquer forma, só a categoria ficava imprecisa).
      Corrigido: `mapHttpError()` agora decodifica o corpo e trata esse caso especificamente como
      `GEMINI_AUTH_FAILED`. Confirmado ao vivo com chave propositalmente inválida.
- [x] **2.4** Sanitização de caracteres de controle reaproveitada de `GeminiInteractionsClient`.
- [x] **2.5** Shape de retorno conforme o contrato — confirmado com dado real, não só planejado.

**Prova real (não estava no escopo mínimo da fase, mas foi feita antes de prosseguir)**: chamei
`GeminiDecisionClient::decide()` de verdade contra a API, ainda sem estar ligada no container
(instanciada direto via `new`), com um bundle mínimo:
- ✅ `HTTP 200`, decisão completa, todas as chaves do schema presentes, `schema_version` correto.
- `provider=gemini`, `model=gemini-3.7-flash` (lido de `modelVersion` da resposta real).
- `latency_ms=8732` (~8,7s) — bem dentro do orçamento de 90s da Fase 1, mas é um bundle mínimo, não
  o `bundle_json` real e grande do pipeline — não substitui a prova real de ponta a ponta da Fase 5.
- `usage` populado de verdade: `input_tokens=1662, output_tokens=274, thought_tokens=2494`.
- Caminho de erro confirmado também (chave inválida → `GEMINI_AUTH_FAILED:400:...` com o corpo real
  do erro do Google no log) — mensagem clara e específica, não um código genérico.

## FASE 3 — Ligação (service provider) ✅ concluída (16/08/2026)

- [x] **3.1** Braço `'gemini' => $app->make(GeminiDecisionClient::class)` adicionado ao `match` do
      binding de `DecisionProvider::class`, ao lado do `'openai'` já existente. `decision_provider`
      continua `openai` no `.env` real — nada de produção mudou de comportamento.

**Prova real via container** (não só leitura de código): com `decision_provider` forçado pra
`gemini` em runtime, resolvi `DecisionProvider::class` pelo container de verdade —
`LoggingDecisionProvider` envolvendo `GeminiDecisionClient`, confirmado via reflection. Chamei
`decide()` através dessa cadeia completa (container → decorator → client → API real do Gemini):
`HTTP 200`, decisão válida, e o log gerado por essa chamada já sai com o formato certo:

```
[2026-08-16 17:56:54] local.INFO: genesis.v68.decisor.ok {"provider":"gemini","model":"gemini-3.7-flash",
"latency_ms":9947,"repair":false,"status":"OK","usage":{"input_tokens":1662,"output_tokens":383,
"thought_tokens":3556,"cached_tokens":null},"interaction_id":null,"observed_at":"..."}
```

Testado também: `openai` continua resolvendo normalmente (sem regressão), e um valor inválido
continua lançando a exceção clara de sempre.

**Regressão**: suíte `Unit` completa — **368 passed (896 assertions), 0 falhas**, mesmo resultado de
antes da fase.

## FASE 4 — Corrigir um bug real encontrado de passagem ✅ concluída (16/08/2026)

- [x] **4.1** `LoggingDecisionProvider::decide()` — `model` no ramo de erro agora resolvido
      condicionalmente por `decision_provider` (mesmo padrão de `match` que
      `orcamentoTimeoutSegundos()` já usa), em vez de sempre ler `openai_model`. Testado ao vivo:
      forcei um erro real de autenticação com `decision_provider=gemini` e o log gerado saiu
      correto —
      `{"provider":"gemini","model":"gemini-3.7-flash",...,"error":"GEMINI_AUTH_FAILED:400:..."}`
      — antes desta correção mostraria `"model":"gpt-5.6-terra"` mesmo nesse cenário.
      Teste existente (`LoggingDecisionProviderTest`) não assumia o valor antigo do campo `model` no
      ramo de erro — passou sem alteração, **3 passed**.

## FASE 5 — Prova real (antes de virar padrão) ✅ concluída (16/08/2026)

- [x] **5.3** `tests/Unit/Services/GeminiDecisionClientTest.php` criado, 9 testes (payload sem
      imagem, `responseSchema`/`responseMimeType` presentes, sem chave lança antes de rede, mapa de
      erro HTTP incluindo o achado real da Fase 2 — 400/`API_KEY_INVALID`→`GEMINI_AUTH_FAILED` vs 400
      genérico→`GEMINI_HTTP_400` —, decisão válida decodificada, texto vazio lança erro claro).
      **9 passed (19 assertions)**, sem chamada de rede real (`Http::fake()`).
- [x] **5.2** Suíte `Unit` completa: **377 passed (915 assertions), 0 falhas** (368 de antes + 9
      novos da 5.3). Zero regressão.
- [x] **5.1** Prova real de ponta a ponta, sem criar registro em `analises` nem token de auth (a
      criação de token foi bloqueada pelo classificador de permissões numa fase anterior desta mesma
      sessão — contornado chamando os providers reais diretamente via `app()`, só leitura de imagem +
      chamadas reais de API, nenhuma escrita em banco). `decision_provider` forçado pra `gemini` em
      runtime, sem tocar o `.env` real.

      **3 imagens reais tentadas, 2 fecharam o pipeline completo:**

      | Caso | Resultado |
      |---|---|
      | **POL** (`tests/Proof/_archive_v4_3_r3_2/POL/input.png`, real, já usado em benchmark anterior) | ✅ Sucesso de primeira: visão (16,9s) → contexto (4,8s) → decisão `gemini-3.7-flash` (27,1s, `latency_ms=27075`) → validação **OK sem repair**. `SHORT score=65`, `score_description`=218 chars (limite 180-260 ✅), `technical_analysis`=563 chars (limite 400-600 ✅). |
      | **OP** (`WhatsApp Image 2026-08-15 at 16.30.51.jpeg`, imagem real da sessão de hoje — a mesma família de gráfico da análise #143 que abriu esta investigação) | ⚠️→✅ Tentativa 1: visão/contexto/decisão OK, mas validação reprovou com `NUMERIC_CITATION_VALUE_MISMATCH` (o texto citou um número que não bateu com o valor real da evidência). **Rodei o loop de repair de verdade** (mesmo padrão do job: `validation_errors`+`previous_output` de volta pro decisor) — **tentativa 2 passou limpo**, `SHORT score=75`. Achado real e útil: o `gemini-3.7-flash` erra citação numérica com alguma frequência na 1ª tentativa, mas o mecanismo de repair já existente resolve — mesmo padrão que a migração pra OpenAI já tinha documentado (spec `genesis-devolucao-v6-7-e-migracao-openai`, Fase 1.7). |
      | **APT** (`tests/Proof/_archive_v4_3_r3_2/APT/input.png`) | ❌ Não fechou — rejeitado na visão duas vezes, mas **por causa dos meus próprios palpites errados de metadado**, não por bug: o timeframe real da imagem é 4h (chutei 1d), e depois de corrigir, a visão apontou que o gráfico é **SPOT**, não FUTURES. É uma imagem antiga (arquivo de benchmark de uma versão anterior do sistema) — não é um candidato válido pra este teste hoje. Não substituí por uma terceira imagem por já ter 2 provas completas reais (uma limpa, uma via repair) e a evidência já ser suficiente pra fase — documentado aqui em vez de forçar um terceiro caso.

      **Conclusões da prova real:**
      - Nenhum erro de schema em nenhuma tentativa (`SCHEMA_VERSION_MISMATCH` ou campo faltando)
        — o `responseSchema` cumpriu o esperado, o Gemini nunca fugiu da estrutura.
      - Latência real do decisor: 17,8s a 27,1s por chamada — bem dentro do orçamento de 90s da
        Fase 1 (folga generosa, não precisa recalibrar pra baixo nem pra cima por enquanto).
      - Nenhuma ocorrência do radical `CONFIRM` proibido em nenhum dos textos gerados.
      - Textos livres respeitaram os limites de tamanho/frase nas duas tentativas que chegaram lá.
      - O ponto de atenção real é `NUMERIC_CITATION_VALUE_MISMATCH` na 1ª tentativa — não é
        bloqueante (o repair resolve), mas vale observar a taxa disso numa amostra maior antes do
        corte pra produção (Fase 6), já que cada repair custa uma chamada extra ao decisor.

## FASE 6 — Corte (env real) ✅ concluída (16/08/2026)

- [x] **6.1** `.env` real: `GENESIS_DECISION_PROVIDER=gemini` adicionado (a chave não existia antes —
      o `.env` real nunca tinha esse eixo explícito, caía no default do config). `AI_PROVIDER`
      (eixo V6.7 congelado, linha separada) confirmado intocado — continua `openai`, preservado pra
      `BenchmarkGenesisDecision`. Bloco `GENESIS_OPENAI_DECISION_*` mantido intacto no `.env`
      (rollback de 1 variável).
- [x] **6.2** Sem endpoint de cota exposto pela API do Gemini (confirmado: nenhum header
      `x-ratelimit-*`/`quota` na resposta real, diferente da OpenAI) — não dá pra confirmar
      programaticamente. Evidência empírica coletada ao longo das Fases 1-6 desta sessão: dezenas de
      chamadas reais na mesma `GEMINI_API_KEY` (schema, client, pipeline completo, testes de erro),
      **zero HTTP 429** encontrado. Sinal razoável pra seguir, mas não é uma confirmação formal de
      cota — vale monitorar nos primeiros dias reais de uso.
- [x] **6.3** `config:clear` rodado. Confirmado ao vivo, sem nenhum override manual: `decision_provider`
      resolve `gemini` puro do `.env`, `AI_PROVIDER` continua `openai`, o container resolve
      `GeminiDecisionClient` de verdade, orçamento do job recalcula pra **265s**.

**Achado real importante, fora do escopo original da fase**: ativar `gemini` como padrão real do
ambiente quebrou **9 testes Feature** (`GraphicalAnalysisAttemptJobTest`, 7 casos;
`GraphicalAnalysisImageCleanupTest`, 2 casos) e **2 testes Unit**
(`GenesisGraphicalServiceProviderV68BindingTest`, `GenesisGraphicalV68ConfigTest`). Causa raiz, dois
tipos diferentes:

1. **Unit**: dois testes verificavam "o padrão é openai" sem setar `config()` explicitamente —
   dependiam implicitamente do valor real do `.env`. Corrigidos para refletir o novo padrão
   (`gemini`), com um teste novo adicionado pra provar que `openai` continua selecionável
   explicitamente (cobertura do caminho de rollback preservada).
2. **Feature, mais sério**: `GraphicalAnalysisAttemptJobTest`/`GraphicalAnalysisImageCleanupTest`
   mockam `Http::fake(['api.openai.com/*' => ...])` mas **nunca fixavam `decision_provider`
   explicitamente** — com o padrão real virando `gemini`, o job passou a chamar
   `generativelanguage.googleapis.com`, uma URL **fora do fake configurado**. Como `Http::fake()`
   com padrões específicos deixa passar pra rede real qualquer URL não coberta, esses testes
   passaram a fazer **chamadas reais e não-determinísticas à API do Gemini** em vez de usar o mock —
   gastando cota de verdade e produzindo resultados inconsistentes (alguns "sucessos" inesperados
   onde o teste esperava um erro específico simulado do lado OpenAI). Corrigido adicionando
   `setUp()` com `config(['genesis_graphical_v6.decision_provider' => 'openai'])` explícito nos dois
   arquivos — restaura o isolamento do teste em relação ao ambiente, e é literalmente o que o
   docblock da classe já dizia ser a intenção ("só o decisor OpenAI é mockado nesses cenários").

**Regressão final, depois de todas as correções**: suíte `Unit` — **378 passed (916 assertions)**;
suíte `Feature` completa — **124 passed (423 assertions)**. Zero falhas nas duas.

---

## Rollback

Um único flip: `GENESIS_DECISION_PROVIDER=openai` de volta (+ `config:clear`). Nenhum código precisa
ser revertido — `OpenAiDecisionClient` continua existindo e ligado, só passa a não ser o braço ativo
do `match`. Único pré-requisito pro rollback funcionar de verdade: crédito de novo na conta da OpenAI
(a causa raiz de hoje) — sem isso, voltar pra `openai` reproduz o mesmo `429` de agora.

## Pendências que ficam para depois deste spec (não incluídas de propósito)

- Atualizar `BenchmarkGenesisDecision` pra comparar os três decisores (Gemini V6.7 congelado / OpenAI
  V6.8 / Gemini V6.8 novo) — só faz sentido depois da Fase 5 provar que o novo caminho é estável.
- Considerar mover `vision_provider`/`context_provider` para `gemini-3.7-flash` também (hoje
  `gemini-3.6-flash`) — não foi pedido, fora de escopo deste spec.
