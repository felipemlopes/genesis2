# Documento de Requisitos — Custo de IA e Resiliência da Análise

## Introdução

O Felipe reportou (25/09/2026) que o gasto com IA disparou e que análises estão sendo "invalidadas" quando deveriam seguir com os dados disponíveis. Pedido explícito:

- trazer cada etapa para **uma chamada só** no caminho normal (hoje são até 3 tentativas por etapa);
- tratar falha de um indicador como **nulo, não zero**, sem travar a análise e sem a análise mencionar o indicador que faltou ("se trouxe 15 de 20, trabalha com 15");
- descobrir **o que realmente está consumindo** — "não acho que é só as tentativas";
- **macro com cache de 24 horas**.

Repositórios:
- **[API]** `E:\Programas\wamp64\www\genesis-api` (Laravel)
- **[FE]** este repositório (React/TypeScript)

A auditoria de código que embasa estes requisitos está em `design.md` → "Estado Atual Auditado".

## Glossário

- **Etapa de IA**: uma das chamadas pagas do pipeline da análise gráfica: Scan (leitura de par/timeframe no upload), Visão, Contexto (macro + sentimento), Decisão.
- **Repair**: nova chamada completa ao decisor, disparada quando `DecisionResponseValidator` reprova a resposta. Hoje ela reexecuta o job (`$tries`).
- **Retry de transporte**: nova chamada disparada por falha de rede, timeout, 429 ou 5xx.
- **Dado indisponível**: indicador ou bloco com status `UNAVAILABLE`/`null`. Nunca `0`.

## Requisitos

### Requisito 1: Medição de custo por etapa

**User Story:** Como dono do produto, quero saber quanto cada etapa de IA custa por análise, para cortar o que realmente pesa, não o que parece pesar.

#### Critérios de Aceitação

1. **Cada análise DEVE registrar os tokens gastos em cada etapa** (Scan, Visão, Contexto, Decisão) em `provider_telemetry.{etapa}` (coluna JSON já existente, sem migração), com:
   - `input_tokens`, `output_tokens`, `thought_tokens`, `cached_tokens`;
   - `model` e `provider`;
   - `http_calls`: número real de chamadas HTTP feitas;
   - `grounding_queries`: número de buscas `google_search` (cobradas por consulta, não por token, por isso contadas à parte);
   - `cache_hit`: `true` quando a etapa veio do cache (tokens = 0).
1a. Os tokens DEVEM ser **acumulados** entre todas as chamadas da etapa: retries internos, retries de transporte, failover para o modelo reserva e repairs do job. Nenhuma tentativa pode sobrescrever a anterior (hoje só a última chamada fica registrada).
1b. Além do total acumulado, cada etapa DEVE guardar a lista `calls[]` (modelo, tokens, status HTTP, latência, motivo: `primeira`/`retry`/`failover`/`repair`), para mostrar de onde veio o gasto extra.
1c. Chamadas que falharam (timeout, 5xx, JSON inválido) DEVEM entrar em `calls[]` e no `http_calls`, com os tokens que o provedor tiver devolvido (`null` se não devolveu nada, nunca `0`).
1d. O Contexto DEVE registrar também `thought_tokens` (hoje só registra entrada e saída).
1e. O Scan roda no upload, antes de a análise existir. O consumo dele DEVE ser guardado em cache pela `image_hash` e anexado a `provider_telemetry.scan` quando a análise for criada com a mesma imagem.
1f. A análise DEVE ter um total geral `provider_telemetry.total` (soma dos tokens de todas as etapas + `http_calls` + `grounding_queries`).
1g. O registro DEVE ser feito também quando a análise terminar em `FAILED`/`REJECTED_IMAGE`, porque essas também custaram.
2. O SISTEMA DEVE registrar também as chamadas de IA que não pertencem a uma análise (Scan, `UtilityGeminiProxyController`, `MacroController`, `GeoEventService`), com um log estruturado único por chamada (`genesis.ia.chamada`).
3. O SISTEMA DEVE oferecer um comando artisan (`genesis:custo-ia`) que agrega por etapa, modelo e dia: nº de chamadas, tokens e chamadas por análise concluída; e, com `--analise=ID`, mostra o detalhamento por etapa de uma análise.
4. ANTES de qualquer mudança dos Requisitos 2–6 ir para produção, a medição DEVE ser rodada contra a base de produção e anexada ao `design.md` como linha de base.

### Requisito 2: Macro com cache de 24 horas

**User Story:** Como dono do produto, quero que o resumo macro seja gerado uma vez por dia, porque ele não muda de análise para análise.

#### Critérios de Aceitação

1. O SISTEMA DEVE gerar o contexto macro no máximo **uma vez a cada 24 horas**, compartilhado entre todas as análises e todos os ativos.
2. QUANDO uma análise precisar de macro e houver cache válido, O SISTEMA DEVE usar o cache sem chamar a IA.
3. QUANDO a geração do macro falhar, O SISTEMA NÃO DEVE gravar a falha no cache de 24h. Ele deve devolver `UNAVAILABLE` para aquela análise e permitir nova tentativa depois de um intervalo curto (negative cache, padrão 15 min), para não chamar a IA a cada análise enquanto o provedor estiver fora.
4. O cache DEVE ser protegido por lock, para que N análises simultâneas com o cache expirado gerem **uma** chamada, não N.
5. A análise DEVE mostrar a data e hora em que o macro foi gerado (`observed_at` do cache, não a hora da análise).
6. O `MacroController::today` e o bloco macro da análise DEVEM usar a mesma fonte de cache, sem duas gerações diferentes do "macro do dia".

### Requisito 3: Sentimento por ativo com cache curto

**User Story:** Como dono do produto, quero evitar uma busca no Google por análise quando vários membros analisam o mesmo ativo no mesmo intervalo.

#### Critérios de Aceitação

1. O SISTEMA DEVE separar a geração de sentimento (por ativo) da geração de macro (global). Hoje as duas saem da mesma chamada.
2. O sentimento DEVE ter cache por ativo com TTL configurável (`GENESIS_SENTIMENT_CACHE_TTL_MINUTES`, padrão **360** = 6 horas, decisão do Felipe em 25/09/2026).
3. Falha segue a mesma regra do Requisito 2.3 (não cacheia falha longa, fica `UNAVAILABLE`).

### Requisito 4: Uma chamada por etapa no caminho normal

**User Story:** Como dono do produto, quero que cada etapa faça uma chamada e, se falhar, siga com o que tem, em vez de repetir a análise inteira.

#### Critérios de Aceitação

1. Contexto (macro/sentimento): **1 chamada** (`GENESIS_GEMINI_CONTEXT_ATTEMPTS=1`). Resposta vazia ou inválida vira `UNAVAILABLE` e a análise segue. Isso já é o comportamento pós-retry, só que sem o retry.
2. Visão: **1 chamada**, com no máximo 1 retry **apenas** em erro de transporte (timeout/429/5xx). Nunca por conteúdo. O retry DEVE usar um **modelo reserva** (como já fazem decisão e scan), não o mesmo modelo que acabou de falhar.
2a. Falha de transporte da visão que já esgotou o retry interno NÃO DEVE reexecutar o job inteiro (hoje: 2 internas × 3 do job = 6 chamadas por análise, medido em 25/09/2026).
3. Decisão: o retry de transporte no mesmo provedor cai de 3 para **1** tentativa antes do failover (hoje são 3 no primário mais o fallback).
4. Job: `GENESIS_GEMINI_MAX_ATTEMPTS` cai de 3 para **2** (proposta do Felipe na transcrição).
5. Scan: no máximo 2 chamadas (modelo primário + reserva, já implementado em `37aebff`). Nenhum retry adicional.
6. O limiar de `FinalizarAnalisesTravadas` DEVE ser recalculado a partir dos novos valores (ele deriva de `max_attempts × timeouts`).

### Requisito 5: Dado indisponível nunca invalida a análise

**User Story:** Como membro, quero receber a análise mesmo quando algum indicador não veio, sem texto falando do que faltou.

#### Critérios de Aceitação

1. QUANDO um indicador, bloco de derivativos, visão parcial ou contexto vier indisponível, O SISTEMA DEVE representá-lo como `null`/`UNAVAILABLE` no bundle, **nunca `0`**, e seguir para a decisão.
2. O bundle enviado ao decisor DEVE listar explicitamente os campos indisponíveis (`availability.unavailable[]`), e o prompt DEVE instruir a IA a não citá-los.
3. QUANDO a resposta da IA mencionar um dado indisponível (`NARRATIVE_MENTIONS_UNAVAILABLE_VISUAL:*` e equivalentes), O SISTEMA DEVE **remover ou neutralizar a frase em código** (`DecisionMechanicalRepair`) e revalidar, sem disparar repair via IA.
4. A única falha de dados que continua encerrando a análise (com estorno) é `CANDLES_UNAVAILABLE_OR_INSUFFICIENT` (menos de 60 candles fechados da Binance Futures), porque sem candles nenhum indicador pode ser calculado.
5. Uma auditoria DEVE confirmar que nenhum `safe()`/fallback do `MarketSnapshotService`, `CanonicalBundleBuilder` e serviços técnicos devolve `0` onde deveria devolver `null`. Cada caso encontrado vira uma tarefa.

### Requisito 6: Menos repair por erros que o código consegue resolver

**User Story:** Como dono do produto, quero que erros de formato na resposta da IA sejam corrigidos por código, não pagos com uma nova chamada.

#### Critérios de Aceitação

1. Os erros abaixo DEVEM ser tratados em código (correção mecânica, fallback ou rebaixamento a aviso), sem nova chamada à IA:
   - `STOP_SELECTION_UNKNOWN` / erros de seleção de stop → fallback automático do `NivelService` **já na 1ª tentativa** (hoje só a partir da 2ª);
   - `NARRATIVE_MENTIONS_UNAVAILABLE_VISUAL:*` → Requisito 5.3;
   - `UNACCOUNTED_NUMERIC_LITERAL` / `NUMERIC_CITATION_VALUE_MISMATCH` → **remover a frase inteira** que contém o número que não bate e revalidar (decisão do Felipe, 25/09/2026). Nunca corrigir o número nem rebaixar a aviso;
   - `MONEY_FORMAT_RAW_NUMBER`, `TEXT_FORBIDDEN` → já cobertos por `DecisionMechanicalRepair`/`PublicVocabularyService`, confirmar.
2. Repair via IA fica reservado para erros estruturais que o código não resolve (ex.: `MISSING_FIELD:plano_primario`, `PLAN_B_MISSING`, score fora do enum).
3. Nenhuma correção mecânica pode alterar `direction`, `score`, entrada, stop ou alvos escolhidos pela IA (regra inviolável do Brain V2).
4. A taxa de repair (análises com mais de 1 chamada ao decisor ÷ análises concluídas) DEVE ser medida antes e depois (Requisito 1).

### Requisito 7: Consumidores de IA fora da análise

**User Story:** Como dono do produto, quero garantir que nenhuma rota ou poll esteja gerando custo escondido.

#### Critérios de Aceitação

1. O SISTEMA DEVE confirmar se `UtilityGeminiProxyController` ainda tem consumidor real no [FE]. Se não tiver, a rota sai. Se tiver, ganha rate limit por usuário e entra na telemetria do Requisito 1.2.
2. O SISTEMA DEVE confirmar que `GET /v1/geo-events` (poll de 30s do `geopoliticalEngine.ts`) só lê do banco e nunca dispara `GeoEventService::fetchAndStore()`/Gemini.
3. `MacroController::sentimento` DEVE compartilhar o cache do Requisito 3.

### Requisito 8: Thinking level por etapa

**User Story:** Como dono do produto, quero pagar thinking alto só onde ele muda o resultado.

#### Critérios de Aceitação

1. Com a medição do Requisito 1 em mãos, O SISTEMA DEVE rodar o benchmark existente (`BenchmarkGenesisBrainV2`) comparando `decision_thinking_level` HIGH vs MEDIUM e `vision_thinking_level` HIGH vs MEDIUM.
2. O nível só é reduzido em produção se o benchmark mostrar direção/score equivalentes, com a decisão registrada pelo Felipe.

### Requisito 9: Tamanho do bundle da decisão (achado da Fase 0)

**User Story:** Como dono do produto, quero que a IA de decisão receba só o que ela usa, porque a entrada da decisão é o maior custo por análise.

#### Critérios de Aceitação

1. `flow.cvd_series` (série de CVD bruta, ~1.500 pontos) NÃO DEVE ir inteira para o decisor. O decisor DEVE receber um resumo calculado em PHP (tendência, divergência, últimos N pontos; N a definir) ou a série DEVE passar a `DISPLAY_ONLY`.
2. `structure.local_pivots`, `structure.labels` e `structure.structural_pivots` DEVEM ser auditados com o mesmo critério: o decisor recebe o que ele cita/usa, não o histórico inteiro.
3. A redução NÃO PODE mudar direção/score de forma relevante: validar com o benchmark existente (`BenchmarkGenesisBrainV2`) antes/depois.
4. A medição (Req. 1) DEVE mostrar a entrada média por chamada de decisão antes e depois.
