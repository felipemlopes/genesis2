# Documento de Requisitos — OpenAI como Fallback do Gemini

## Introdução

O Felipe pediu (27/09/2026) um plano para usar a OpenAI como **fallback** das chamadas de IA que hoje dependem só do Gemini, com o modelo **Luna** (barato), e quis saber o custo.

Hoje o Gemini é o provedor primário de todas as etapas da análise gráfica. A única reserva existente é **outro modelo Gemini** (`gemini_secondary`, 3.6-flash na decisão; `vision_fallback_model` na visão; `scan_fallback_model` no scan). Quando o Google fica sobrecarregado (503/timeout, visto várias vezes no benchmark do 3.7-flash), os dois modelos costumam cair juntos, e a análise falha e estorna o crédito.

Repositórios:
- **[API]** `E:\Programas\wamp64\www\genesis-api` (Laravel)
- **[FE]** este repositório (React/TypeScript) — **nenhuma mudança prevista**; o frontend só fala com a API.

A auditoria que embasa estes requisitos está em `design.md` → "Estado Atual Auditado".

## Glossário

- **Primário**: provedor/modelo configurado para a etapa (hoje Gemini em todas).
- **Reserva interna**: segundo modelo Gemini que a própria etapa já tenta (`gemini_secondary`, `vision_fallback_model`, `scan_fallback_model`).
- **Fallback OpenAI**: terceira camada, acionada só depois que primário e reserva interna falharam por **transporte**.
- **Falha de transporte**: timeout, erro de conexão, 429 ou 5xx. **Não** inclui JSON inválido, schema reprovado, 4xx de requisição ou chave ausente.
- **Luna**: família de modelos baratos da OpenAI. Ver Requisito 1 sobre qual ID usar.

## Requisitos

### Requisito 1: Modelo e pré-requisitos

**User Story:** Como dono do produto, quero que o fallback use o modelo Luna certo e que a conta OpenAI esteja pronta, para não descobrir em produção que o fallback não funciona.

#### Critérios de Aceitação

1. O modelo é **`gpt-6-luna`** (decisão do Felipe, 27/09/2026; `gpt-6.6-luna` não existe na tabela oficial). Preço (27/09/2026, contexto curto): US$ 0,10 entrada / US$ 0,01 cache / US$ 0,50 saída por 1M tokens; busca web US$ 10/1.000 chamadas + conteúdo da busca cobrado como entrada.
2. O modelo DEVE ser configurável só por env (`GENESIS_OPENAI_FALLBACK_MODEL`), sem deploy de código para trocar.
3. A conta OpenAI DEVE ter crédito ativo. O comentário em `config/genesis_graphical_v6.php` (linha ~216) registra que a conta estava sem crédito; isso precisa ser verificado com uma chamada real antes de ligar o fallback.
4. O modelo DEVE ser validado com imagem (visão/scan), com o schema estrito da decisão (`GenesisDecisionSchema::forOpenAi()`) e com a ferramenta `web_search` (contexto) antes de ser ligado em cada etapa.

### Requisito 2: Fallback OpenAI na Decisão

**User Story:** Como membro, quero que minha análise saia mesmo quando o Google estiver fora, em vez de falhar e estornar.

#### Critérios de Aceitação

1. A decisão DEVE seguir a cadeia **primário → reserva interna → OpenAI**, configurável por env (`GENESIS_DECISION_PROVIDER_CHAIN`, ex.: `gemini,gemini_secondary,openai`).
2. Cada elo DEVE ter **uma** tentativa; só falha de transporte passa para o próximo (mesma regra atual do `FailoverDecisionProvider`).
3. Erro semântico (JSON inválido, schema reprovado) NÃO DEVE acionar o próximo elo — continua indo para o repair do job.
4. Repair DEVE ir primeiro ao **primário** da cadeia, não ao elo que respondeu por último.
5. O fallback da decisão DEVE usar configuração **própria** (`GENESIS_OPENAI_FALLBACK_*`), sem alterar `GENESIS_OPENAI_DECISION_MODEL`, que continua servindo ao pipeline V6.7 preservado.
6. A ausência de `GENESIS_DECISION_PROVIDER_CHAIN` DEVE manter o comportamento atual (primário + `GENESIS_DECISION_PROVIDER_FALLBACK`).

### Requisito 3: Fallback OpenAI na Visão

**User Story:** Como membro, quero que a leitura do gráfico não seja o ponto que derruba a análise quando o Gemini cai.

#### Critérios de Aceitação

1. DEVE existir uma implementação OpenAI de `VisionProvider` (`OpenAiVisionService`) que devolve o mesmo formato de `GeminiVisionService::read()` e passa pelo mesmo `VisionResponseValidator`.
2. O binding de `VisionProvider` DEVE envolver primário e fallback num `FailoverVisionProvider`, acionado só depois que o Gemini (incluindo `vision_fallback_model`) terminou em falha de transporte.
3. `VisionProviderException` DEVE indicar se a falha foi de transporte, para o failover decidir sem interpretar a mensagem.
4. O fallback de visão DEVE poder ser desligado sozinho (`GENESIS_VISION_PROVIDER_FALLBACK=` vazio).

### Requisito 4: Fallback OpenAI no Scan

**User Story:** Como membro, quero que o upload reconheça par e timeframe mesmo com o Gemini fora, sem cair no "digite o par manualmente".

#### Critérios de Aceitação

1. `ChartMetadataScanService` DEVE tentar a OpenAI depois dos modelos Gemini atuais, com a mesma regra: só falha de transporte avança.
2. O prompt e o JSON de saída do scan DEVEM ser os mesmos nos dois provedores.

### Requisito 5: Fallback OpenAI no Contexto (macro e sentimento)

**User Story:** Como membro, quero ver macro e sentimento mesmo quando o Gemini estiver fora, em vez de "indisponível" (decisão do Felipe, 27/09/2026).

#### Critérios de Aceitação

1. Macro e sentimento DEVEM, cada um separadamente, tentar a OpenAI (`gpt-6-luna` + ferramenta `web_search`) quando a chamada Gemini do bloco terminar em falha de transporte (timeout, conexão, 429, 5xx).
2. JSON inválido, bloco vazio (`CONTEXT_MACRO_EMPTY`/`CONTEXT_SENTIMENT_EMPTY`) e chave Gemini ausente NÃO DEVEM acionar a OpenAI (mesma regra das outras etapas).
3. O fallback DEVE rodar **dentro** do cache/lock atual (`blocoCacheado`): um processo só gera o bloco, e o resultado da OpenAI é cacheado com o mesmo TTL (macro 24h global, sentimento 6h por ativo) e com `model` = modelo OpenAI real.
4. O cache negativo (`:falha`, 15 min) só DEVE ser gravado quando **Gemini e OpenAI** falharem.
5. O prompt, o JSON esperado e o parse (`decodificarContexto`) DEVEM ser os mesmos nos dois provedores; a saída para o frontend não muda.
6. Os consumidores fora da análise (`MacroController::today`/`sentimento`, `genesis:macro-refresh`) DEVEM herdar o fallback sem mudança própria, porque passam pelo mesmo service.
7. O fallback do contexto DEVE poder ser desligado sozinho (`GENESIS_CONTEXT_OPENAI_FALLBACK=false`).
8. Falha dos dois provedores continua virando "indisponível" sem travar a análise (comportamento atual).

### Requisito 6: Custo visível

**User Story:** Como dono do produto, quero ver quanto o fallback está custando, em dólar.

#### Critérios de Aceitação

1. Toda chamada OpenAI do fallback DEVE ser registrada no `AiUsageRecorder` com motivo `failover`, provedor `openai` e o modelo real devolvido pela API; no contexto, também o número de buscas web (`web_search_call` no `output`), no mesmo campo `grounding_queries` usado pelo Gemini.
2. `genesis:custo-ia` DEVE mostrar custo estimado em US$ por etapa e modelo, a partir de uma tabela de preços em config (`config/genesis_ai_prices.php`), separando entrada, cache, saída (raciocínio conta como saída na OpenAI) e buscas web (preço por 1.000).
3. Modelo sem preço na tabela DEVE aparecer como "sem preço" (nunca US$ 0).
4. `genesis:custo-ia` DEVE mostrar quantas análises usaram o fallback OpenAI no período.

### Requisito 7: Orçamento de tempo do job

**User Story:** Como operador, não quero que a fila libere uma tentativa para outro worker enquanto a original ainda está esperando o fallback.

#### Critérios de Aceitação

1. `GraphicalAnalysisAttemptJob::orcamentoTimeoutSegundos()` DEVE somar o timeout de **todos** os elos da cadeia de decisão, de visão e de contexto (pior caso), não só o do primário.
1a. A espera do lock do contexto (`context_cache_lock_wait_seconds`) DEVE cobrir Gemini + OpenAI; senão um segundo processo desiste antes do primeiro terminar o fallback.
2. A guarda de boot `GENESIS_QUEUE_RETRY_AFTER_ABAIXO_DO_ORCAMENTO` DEVE continuar valendo com o novo orçamento, e o `.env` de produção DEVE ter `GENESIS_QUEUE_RETRY_AFTER` ajustado antes da ativação.
3. `FinalizarAnalisesTravadas` DEVE continuar usando o mesmo método (sem fórmula própria).

### Requisito 8: Guardas e preflight

#### Critérios de Aceitação

1. O boot DEVE logar crítico se algum elo da cadeia usar OpenAI e `GENESIS_OPENAI_FALLBACK_KEY` estiver vazia.
2. `genesis:graphical-preflight` DEVE listar a cadeia ativa de cada etapa e fazer uma chamada mínima à OpenAI quando pedido (`--ping-openai`).
3. Valor desconhecido na cadeia DEVE falhar cedo, com a lista de valores aceitos (padrão atual).

### Requisito 9: Fora de escopo

1. `VisualLevelsService` e o pipeline V6.7 (`GeminiInteractionsClient`/`OpenAiInteractionsClient`): órfãos, só o benchmark usa.
2. `GeoEventService`, `UtilityGeminiProxyController` (`/gemini-proxy`) e o monitor Python (`monitor/ai_classifier.py`): periféricos à análise, ficam para uma spec futura.
3. Trocar o primário para OpenAI. O Gemini continua primário em todas as etapas.
