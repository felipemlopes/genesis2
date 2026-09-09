# Plano de Implementação: Gênesis V6.11

**Status deste documento**: criado como planejamento puro em 09/09/2026, a pedido do Felipe ("analise
e crie um plano spec estilo kiro para eu ver. não altere nada ainda"). **Nenhum item foi executado.**
Nenhum arquivo de código foi tocado — só este `tasks.md` e a cópia do documento-fonte foram criados.
Este arquivo é para revisão antes de qualquer fase começar.

## Fontes

`GENESIS_V6_11_DOCUMENTO_UNICO.md` — documento único do PO (Fabrício), 08/09/2026, com 21 achados
organizados em 7 partes (Fundação, Leitura visual, Planos A/B, Derivativos e tela, checklist de
verificação, itens que não fecham sem informação externa, ordem de execução). Cópia completa,
byte-a-byte do original (conferido pelo encoding — o arquivo colado na conversa chegou com mojibake,
a cópia aqui foi feita direto do `.md` original do Felipe em `Downloads`, sem esse problema), no mesmo
diretório deste `tasks.md`. Este plano não duplica os blocos de código do documento — só referencia o
item.

**Repositórios**: **[API]** = `E:\Programas\wamp64\www\genesis-api` (branch `genesis2`, HEAD `7582afd`)
· **[FE]** = `c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main` (branch `master`, HEAD
`adb74f6`) — mesma convenção dos specs anteriores. **Ambos os repositórios estão limpos** (`git
status` sem alterações) em 09/09/2026, antes de qualquer trabalho deste spec — nenhuma decisão D0 de
"o que fazer com trabalho não commitado" é necessária desta vez.

---

## Verificação contra o código real (09/09/2026) — antes de aceitar qualquer item

Dois agentes de leitura, um por repositório, conferiram cada uma das ~35 alegações de "estado atual"
do documento linha a linha contra o código hoje (não julgaram se a correção proposta é boa — só se o
"antes" descrito bate com a realidade). Resultado: **nenhum item é falso na direção que importa** (o
documento nunca diz "está quebrado" quando na verdade já está corrigido, o que seria o tipo de erro
que faria a gente perder tempo reabrindo algo pronto). Onde há divergência, é sempre um detalhe de
como o bug se expressa, não a existência do bug.

### Confirmado exatamente como descrito (maioria dos itens)

1.1 (zones recebe `$candlesFechados`, `count-2` em ambos agrupamentos) · 1.2 (bracket nulo → status
`UNAVAILABLE`, trava gateada por `liquidation_price !== null`) · 1.3 (colunas de
`genesis_analise_planos`, `persistPlanos()`, `AcompanharPlanos`, `fecharDesfechoNaAnalise()`, migration
`2026_08_21_100000` — tudo pronto, nada a alterar) · 2.3a (filtro `peso_total > 0` existe,
`TargetCandidateCatalog.php:107`) · 2.3d (corte de confiança do VRVP existe) · 3.1 (`PlanoBService`
recebe e repassa `$selectedTargetIds` do Plano A) · 3.3b (exatamente 8 `return null`) · 3.4 (nem back
nem front publicam motivo quando B não existe) · 4.1/4.2 (lado do livro e `abs()` do squeeze, ambos
confirmados invertidos/cegos exatamente como descrito) · 4.3 (funding conta 1 período fixo) · 4.5 (44
`PHP_CALC` / 6 `BINANCE_FUTURES_API` / 0 OCR — bate) · 4.10 (4 fatores hoje, `ancoragemDoAlvo()` só
conta TPs não-nulos, "caminho até o alvo" não existe) · 4.11 backend e frontend (OI em `contracts`
somado como `totalUsd` nos dois lados) · **[FE]** 1.2 (rótulo "Liquidação (estimada)") · 3.6a/3.6b
(dois blocos, frase fixa com duas causas) · 4.6 (fallback fixo em macro E sentimento) · 4.9 (rótulo
"combinado" sem "líquido") · 4.12 (disparidade tipográfica real) · o teste
`AnalysisResult.fase6.test.ts` exige a frase fixa que o item 4.6 manda apagar (o próprio documento já
antecipa isso na Fase 7 do checklist).

### Confirmado, mas com ressalva real para quem for implementar

| Item | O que o código faz hoje, exatamente | Por que importa para a implementação |
|---|---|---|
| 3.3c (clamp) | `PlanoBService.php:82,88` escreve `(1 - 0.005)` / `(1 + 0.005)`, não os literais `"0.995"`/`"1.005"` | O item de checklist da Fase 3, `grep -n "0.995\|1.005" ... retorna vazio`, **já retorna vazio hoje, antes de qualquer correção** — é um falso-negativo pronto para acontecer. Trocar a prova de aceite para `grep -n "1 - 0.005\|1 + 0.005"`, ou simplesmente conferir por leitura que o bloco inteiro do clamp foi apagado. |
| 3.5 (log do fallback) | `AnalysisPersistenceService.php:302` **já loga**, só que em `Log::info`, não `Log::warning`, e `plano_primario_degradado` não existe em lugar nenhum (nem coluna, nem chave do array `execution`) | O documento descreve o fallback como "silencioso" — não é, já loga. O trabalho real do item 3.5 é (a) subir o nível pra `warning` e (b) criar a sinalização que hoje não existe. Ajustar a redação da prova de aceite. |
| 3.4 (assinatura de `gerar()`) | `PlanoBService.php:48` — 14 parâmetros hoje, com `$selectedTargetIds` em alguma posição; `ExecucaoService.php:471-493` passa 14 argumentos na mesma ordem | A nova assinatura do documento também tem 14 parâmetros, mas troca `$selectedTargetIds` por `$planB` **em outra posição da lista** (6º parâmetro na proposta). Antes de editar o call site, ler as duas assinaturas completas lado a lado — um replace posicional às cegas troca o tipo errado de argumento. |
| 4.4 (texto do funding no prompt) | `GenesisPrompt.php` não tem uma frase específica sobre casas decimais de funding para substituir — só uma regra genérica de "percentuais e taxas" (linha 55, exemplos com 2 casas) referenciada pela conversão de funding (linha 176) | O `SUBSTITUIR` do documento pressupõe uma frase que não existe isolada. Vira `ACRESCENTAR` uma regra nova e específica de funding perto da linha 176, não uma troca de frase. |
| 4.5 (contagem do catálogo) | 44 + 6 = 50, mas o catálogo real tem 51 itens — sobra `market.session` (source `SERVER_UTC`), que não é nem `PHP_CALC` nem API | Cosmético, não muda a conclusão ("zero OCR"), mas útil registrar pra prova de aceite não travar em "44+6=total". |
| **[FE]** 4.8 (`sentimentDisponivel`) | `AnalysisResult.tsx:509-512` **já considera `fear_greed` e `btc_dominance`** junto com `score`/`narrativa`, exatamente o bug que o documento descreve — mas essa mesma lógica foi tocada por uma fase de um spec anterior (V6.10, item 6.3: corrigiu o selo "Indisponível" aparecendo sobre Macro/Sentimento com dado real) | Bug confirmado, mas a correção mexe numa função que outra correção recente já depende para não regredir o bug do selo "Indisponível". Implementar com atenção redobrada: remover `fear_greed`/`btc_dominance` de `sentimentDisponivel` sem tocar a lógica irmã `macroDisponivel` (linhas 504-508), e reconferir manualmente que o selo "Indisponível" do V6.10 continua certo depois da mudança. |
| **[FE]** 4.7 (caixa vazia do `ScoreBasisBars`) | O comportamento atual (nada quando `disponivel=true` e `pct=null`) está documentado em comentário no próprio código (`ScoreBasisBars.tsx:94-98`) como decisão deliberada do V6.10, item 6.3 — não é descuido | O item 4.7 deste documento é uma extensão daquela decisão (mostrar `valoresBrutos` em vez de nada), não uma reversão. Sem conflito, só registrar que não é "consertar um esquecimento", é avançar uma decisão de design já tomada. |
| **[FE]** 4.9/4.12 (arquivo real) | O rótulo "combinado" e os tamanhos de fonte da disparidade tipográfica vivem em `components/BlocoConviccaoQualidade.tsx`, não em `AnalysisResult.tsx` como uma leitura rápida do documento sugere | Editar o arquivo certo — `BlocoConviccaoQualidade.tsx:132-166`. |

### Confirmado como ausente — é trabalho novo, não regressão (bate com o que o documento já assume que falta)

2.3b (`coletarBrutos()` nunca lê `observacoes['objects']`) · 2.3c (bloco de `patterns` só lê
topo/base, nunca `type`/`status`/`vies`) · 2.3e (campo `elementos` não existe no candidato) · 2.3f
(nenhum teto de candidatas fracas) · 2.2 (`preco_no_candle_atual` não existe em nenhum lugar do
repositório — nunca existiu, não é uma regressão) · 2.4 (nenhuma regra de coerência no prompt, nenhum
`elementos_usados`, nenhuma checagem no validador) · **[FE]** `MOTIVO_PLANO_B` e
`plano_primario_degradado`/`planoB_motivo` não existem em nenhum arquivo `.ts`/`.tsx` do frontend.

### Achado à parte, sobre o próprio texto do documento (não sobre o código atual)

O trecho de validação do item 2.4 (`TargetSelectionValidator::validate()`, o `foreach ($usados as
$usado) { if (...) { ...comentário...; continue; } }`) **não levanta erro em nenhum branch** — o
único erro real do bloco inteiro é `elementos_usados === []` → `TARGET_RATIONALE_SEM_ELEMENTOS`. O
`if` que verifica se `$usado` é uma string desconhecida (nem indicador, nem elemento da candidata)
só executa `continue`, igual ao caminho feliz — o comentário explica uma tolerância que o código não
implementa. Se a intenção for realmente permissiva (aceitar qualquer string não vazia, só exigir que a
lista não seja vazia), tudo bem, mas então o `if`/comentário são código morto e podem sair. Se a
intenção for rejeitar nome inventado que não seja indicador nem elemento real, falta o `$errors[] =
...` dentro daquele `if`. **Confirmar com o Fabrício antes de implementar o item 2.4**, para não copiar
um validador que parece checar algo e na prática não checa nada além de "lista não vazia".

### Outro ponto a sinalizar antes da Fase 1 (achado deste plano, não do documento)

A migration proposta no item 1.3 cria uma coluna `plan_b` (inglês, json). A tabela `genesis_analises`
**já tem** uma coluna `plano_b` (português, decimal — preço, existente desde `2026_06_04_000003`).
Nomes diferentes (`plan_b` vs `plano_b`), sem colisão técnica, mas os dois vão conviver na mesma
tabela com grafias quase idênticas e finalidades diferentes (uma é preço, a outra é o contrato JSON
inteiro) — risco real de confusão para quem ler o schema depois. Vale perguntar ao Fabrício/Felipe se
não é melhor nomear a coluna nova como `plano_b_contrato` (mantendo o padrão pt-BR já usado no resto
da tabela) antes de rodar a migration.

---

## Decisões que precisam do Felipe (ou do Fabrício) antes de fechar algumas fases

Nenhuma delas trava a escrita deste plano; travam a conclusão das fases indicadas.

- [ ] **D1 — Bracket da Binance em produção (item 1.2 / Parte 6.1).** Não dá para saber, lendo código
      daqui, se `getLeverageBrackets()` falha por chave errada, permissão faltando ou IP não liberado
      — isso só sai testando contra produção real. A correção de código (item 1.2) pode ser escrita e
      testada com mock sem essa resposta; o que fica pendente é a causa raiz e a confirmação de que o
      campo de liquidação realmente passa a mostrar preço nos dois casos de prova.
- [ ] **D2 — Log da chamada de contexto do BTC de 08/09 (item 4.6 / Parte 6.2).** Mesma situação: a
      correção de tela (tirar a frase fixa) não depende disso, mas a causa raiz da narrativa nula
      precisa do log real daquela análise específica em produção.
- [ ] **D3 — Unidade do Open Interest multi-exchange (item 4.11 / Parte 6.3).** Decisão de produto
      explicitamente sinalizada pelo próprio documento como não resolvida: converter cada exchange
      para nocional em dólar antes de somar, ou parar de somar e renomear o campo (`totalUsd` →
      algo como `totalContracts` por exchange, sem soma cross-exchange). Isso muda o formato dos dois
      lados (`MultiExchangeDerivativesDisplayService.php` e `oiLiquidationService.ts`) — decidir antes
      de tocar no item 4.11, não durante.
- [ ] **D4 — Nome da coluna nova do Plano B (achado deste plano, ver seção acima).** `plan_b` (como o
      documento propõe) ou `plano_b_contrato` (evitando a quase-colisão com a coluna `plano_b`
      existente)?
- [ ] **D5 — Intenção real do validador do item 2.4 (achado deste plano, ver seção acima).** O bloco
      de validação deve ser puramente permissivo (só exige lista não vazia, comentário e `if` saem) ou
      deve realmente rejeitar nomes inventados (adicionar o `$errors[]` que falta no `if`)?

---

## Escopo deste spec

As 9 etapas da Parte 7 do documento ("Ordem de execução"), cada uma um commit isolado, na ordem que o
próprio documento define e justifica (a mais importante: **Parte 3 depende da Parte 2** — sem leitura
visual chegando à mesa, a IA não tem nível para ancorar o Plano B). Cada fase abaixo tem checkboxes
por item; o texto completo (código antes/depois) está em `GENESIS_V6_11_DOCUMENTO_UNICO.md` — este
arquivo não duplica os blocos de código.

**Definição de pronto por item**: código alterado **e** teste (unitário, feature ou aceite) verde
cobrindo o comportamento do item, **e** para os testes que o próprio documento manda quebrar de
propósito (Fase 7), o teste reescrito para a regra nova, nunca a correção contornada para o teste
antigo continuar passando.

---

## Fase 0 — Antes de mexer ✅ concluída (09/09/2026)

- [x] Branch: Felipe decidiu (AskUserQuestion) trabalhar direto em `genesis2`/`master`, sem branch
      dedicada — mesmo padrão dos specs V6.9/V6.10, ao contrário do V6.8. Registrado, nenhuma branch
      nova criada.
- [x] SHA-256 do documento-fonte: `db2cf50ef5e09e002c979763db3ef0214b10a6c6e53c47982b19db3b69f6c6d0`
      (`GENESIS_V6_11_DOCUMENTO_UNICO.md`, cópia neste diretório).
- [x] D4 resolvida (AskUserQuestion): coluna nova do Plano B chama-se `plano_b_contrato`, não `plan_b`
      — evita a quase-colisão com a coluna `plano_b` (decimal, preço) que já existe desde
      `2026_06_04_000003`. D1/D2/D3/D5 seguem pendentes, sem bloquear a Fase 1 (nenhuma delas trava
      1.1/1.2/1.3 — D1/D2 precisam de produção real, D3 só trava o item 4.11, D5 só trava o item 2.4).
- [x] `vendor/bin/phpunit --testdox` rodado em **[API]** antes de qualquer alteração: **979 testes,
      2866 assertions, 3 failures, 2 skipped.**
- [x] `npx tsc --noEmit` (limpo) + `npx vitest run` rodados em **[FE]** antes: **29 failed | 423
      passed (452 total)**, TypeScript sem erros.

## Fase 1 — Fundação (doc Parte 1) ✅ concluída (09/09/2026)

Implementada em três blocos (1.1 · 1.2 · 1.3) — ainda não commitados separadamente (ver nota abaixo).

- [x] **1.1** `MarketSnapshotService.php:143` — `zones->calculate()` passa a receber `$candlesBrutos`
      (era `$candlesFechados`). Confirmado por leitura que `MarketZonesService::calculate()` só
      produz PDH/PDL/PWH/PWL (poc/hvn/lvn são sempre `null` desde a V6.9 pacote final) — nenhum outro
      indicador é afetado pela troca. Teste novo em `MarketZonesServiceTest.php` prova o bug e a
      correção lado a lado (série com dia corrente incompleto: bruta acerta "ontem", sem o candle de
      hoje cai em "anteontem" — documentado explicitamente como o comportamento ANTIGO). Não foi
      possível reproduzir com os dados reais de 08/09 do documento (sem acesso a produção/rede real
      de época) — a prova aqui é estrutural, sobre a mesma lógica de `count-2`.
- [x] **1.2** `LiquidationCalculatorService::calculate()` — `Log::warning('GENESIS_LIQUIDACAO_BRACKET_
      INDISPONIVEL', ...)` acrescentado no ponto em que o bracket não resolve, cobrindo o caso que o
      warning de exceção (linha existente) não cobria (array vazio sem exceção — achado da
      verificação: hoje só loga em exceção). Rótulo do frontend virou só "Liquidação"
      (`AnalysisResult.tsx:654`). Teste novo confirma o log no caso de array vazio; teste existente
      (`test_distancia_stop_liquidacao_fica_null_quando_inseguro`) reforçado para assertar
      `LIQ_FOLGA_CURTA` de verdade (antes só assertava `INSEGURO`, sem travar a classificação — é a
      prova de aceite do documento). D1 (causa raiz do bracket em produção) continua pendente, não
      bloqueava este código.
- [x] **1.3** Migration `2026_09_09_000001_add_plano_b_contrato_to_genesis_analises.php` (coluna
      `plano_b_contrato` — nome da D4, não `plan_b`), sem `->after()` (convenção deste repositório:
      nenhuma migration existente usa esse modificador, risco de incompatibilidade com SQLite).
      `Analise::$fillable`/`$casts` atualizados. `AnalysisPersistenceService::computeAttributes()`
      grava as três colunas lendo `$decision['plan_b']`/`$execution['planoB_motivo']`/
      `['plano_primario_degradado']` — todas ainda ausentes do pipeline real (só existirão a partir
      da Fase 3), então toda análise nova grava null/false por padrão até lá, sem erro. Dois testes
      novos em `PayloadPublicadoTest.php` provam isso (contrato arquivado quando presente; default
      nulo/falso quando ausente — cobre também "análise antiga abre sem erro", já que toda análise
      pós-migration recebe as 3 colunas com esse mesmo default). Verificado por leitura (sem alterar):
      `persistPlanos()`/`AcompanharPlanos`/`fecharDesfechoNaAnalise()` já leem tp1/tp2/tp3 e
      `plano_escolhido` da linha do plano — nada a mudar aqui, confirma a Parte 1.3 do documento.

**Regressão da Fase 1**: `vendor/bin/phpunit --testdox` (pós-edições) deu 982 testes/2845
assertions/**10 failures**/2 skipped — todas as 10 são os mesmos `GraphicalAnalysisAttemptJobTest`/
`GraphicalAnalysisFullPipelineIntegrationTest`/`GraphicalAnalysisAsyncFlowTest` (status fica `PENDING`
em vez de `COMPLETED`/`FAILED`/`REJECTED_IMAGE`) — **confirmado ambiente, não regressão**: os 3
arquivos, rodados sozinhos (sem concorrência de outros processos), deram **9/9, 4/4 e 1/1 verdes**,
respectivamente. Mesma classe de flakiness já catalogada nos specs V6.9/V6.10 (contenção no arquivo
sqlite físico compartilhado sob carga), só que atingindo mais métodos desta vez por eu ter rodado 3
suítes completas em sequência rápida sem intervalo. Os 3 arquivos de teste tocados diretamente
(`LiquidationCalculatorServiceTest`, `MarketZonesServiceTest`, `PayloadPublicadoTest`) passam 100%
mesmo dentro da rodada completa. **[FE]**: `npx vitest run` deu exatamente **29 failed | 423 passed
(452 total)** — idêntico ao baseline da Fase 0, `npx tsc --noEmit` limpo. Zero regressão nos dois
repositórios.

**Nada commitado ainda** — aguardando o Felipe revisar o diff desta Fase antes de qualquer commit
(nenhum commit foi pedido explicitamente ainda).

## Fase 2 — Leitura visual na mesa (doc Parte 2) ✅ concluída (09/09/2026)

- [x] **2.2** Prompt de visão pede `preco_no_candle_atual` para LTA/LTB/PRICE_CHANNEL
      (`GeminiVisionService.php`); `normalizarObjects()` normaliza o campo novo. 4 testes novos.
- [x] **2.3a** Filtro `peso_total > 0` removido de `TargetCandidateCatalog::build()`.
- [x] **2.3b** `coletarBrutos()` lê `observacoes['objects']` e gera candidatas `linha_tendencia`
      (peso 7, mesma faixa de PDH/PDL).
- [x] **2.3c** Bloco de `patterns` carrega o tipo/estado/viés da figura junto do preço. **Achado
      real**: os nomes de campo do documento (`type`/`status`/`vies`) não são os reais — o pattern
      normalizado usa `id`/`state`, e `vies` nem existia no retorno de
      `GeminiVisionService::normalizarPatterns()` (só numa variável local, usada só pra validar
      coerência do rompimento). Estendido `normalizarPatterns()` pra devolver
      `vies` de verdade (`GenesisVisualCatalogV6::viesDe($id)`, catálogo fechado, nunca lido da IA).
- [x] **2.3d** VRVP abaixo do piso de confiança não é mais descartado — entra com `confianca`
      exposta como campo próprio do candidato (não só embutida num rótulo de texto). Constante
      `CONFIANCA_MINIMA_VRVP` removida (ficou sem uso).
- [x] **2.3e** Campo `elementos` em cada candidata, mais o campo `confianca` (item 2.3d) exposto no
      nível do candidato.
- [x] **2.3f** Teto de 4 candidatas fracas por lado (`limitarFracas()`).
- [x] **2.4** Regra de coerência no prompt (`GenesisPrompt.php`) e `elementos_usados` obrigatório em
      cada rationale (`GenesisDecisionSchema.php` — `VERSION` subiu para `decision-v6.11.0`,
      `document_version`/`prompt_version`/`schema_version` do config atualizados em conjunto, 3
      arquivos de teste de sincronismo de versão ajustados). **D5 resolvida (AskUserQuestion):
      rejeitar nomes inventados** — `TargetSelectionValidator` aceita elemento real da candidata OU
      um indicador de contexto conhecido (RSI/ADX/CVD/Wyckoff/etc., lista fechada), rejeita o resto
      com `TARGET_RATIONALE_ELEMENTO_INVENTADO`; lista vazia rejeitada com
      `TARGET_RATIONALE_SEM_ELEMENTOS`.
- [x] Uma candidata sintética com `linha_tendencia` em `objects`/`preco_no_candle_atual` produz
      candidato real no catálogo — testado (`TargetCandidateCatalogTest`).
- [x] Uma decisão sem `elementos_usados` é rejeitada com `TARGET_RATIONALE_SEM_ELEMENTOS` — testado.

**Reescrita de testes (Fase 7 do checklist, adiantada aqui por necessidade)**: sem o filtro de peso
zero, `numerosRedondos()` (sempre roda, incondicional) passou a produzir candidatas de fundo em
praticamente todo cenário na escala `preco=100/atr=2` usada pela maioria dos testes existentes de
`TargetCandidateCatalogTest` — **12 dos 20 testes originais** precisaram filtrar por
`primary_source` em vez de contar o array inteiro, e os 4 testes de "confluência sozinha nunca vira
candidata" (fibonacci/EMA/liquidação — a premissa que o item 2.3a revoga) foram reescritos pra
provar o comportamento novo, 3 deles numa escala maior (preco=100.000/atr=1.000) pra isolar o
cenário sem concorrência com a grade de número redondo. Nenhum teste removido, todos reescritos.
`BenchmarkGenesisV69Test`'s fake decision provider também precisou de `elementos_usados` (campo
novo obrigatório do schema).

**Regressão**: 167/167 testes (backend, arquivos tocados por Fase 1+2 juntos).

## Fase 3 — Planos A e B independentes (doc Parte 3) ✅ concluída (09/09/2026)

- [x] **3.2** `GenesisDecisionSchema.php` ganha o objeto `plan_b` completo (entry_candidate_id,
      entry_rationale, entry_elementos_usados, trigger{tipo,nivel_candidate_id,descricao},
      stop_selection{candidate_id,rationale}, target_selection{candidate_ids,rationales}) —
      obrigatório (R4), campos internos nullable (indisponibilidade é resposta válida).
- [x] **3.3** `PlanoBService::gerar()` reescrito por completo: resolve `plan_b.entry_candidate_id`
      contra o catálogo (nunca fabrica âncora); régua única em ATR (`margemZona`) pro clamp da
      entrada e da zona; stop e alvos PRÓPRIOS do B (`plan_b.stop_selection`/`target_selection`,
      não mais os do A); gatilho declarado pela IA (`plan_b.trigger`), verificado contra vela
      fechada via `BreakRetestService::horizontal()` (real: shape é `{status, event}`, não
      `{confirmado}` como o pseudocódigo do documento assumia — mapeado pelos 4 eventos que
      significam reação real: `BREAK_UP/DOWN_CONFIRMED`, `RETEST_UP/DOWN_CONFIRMED`); indisponível
      vira `{plano: null, motivo: CODIGO}` + `Log::info`, nunca mais `null` mudo. Clamp antigo
      `(1∓0.005)` apagado por completo.
      **Achado real, bug do próprio rewrite (não do código antigo)**: o pseudocódigo do documento
      (e minha primeira versão) preservava a rejeição da ENTRADA dentro da faixa de invalidação do
      Plano A, mas **perdia o clamp das BORDAS da zona** contra essa mesma faixa — um bloco que
      existia no código antigo e que o documento não repete. Sem ele, uma barreira real "presa"
      entre a âncora de invalidação e o stop-com-buffer do Plano A voltava a poder fechar a zona do
      Plano B (exatamente o bug D5 que uma spec de 2026-08-22 já tinha corrigido uma vez). Pego pelo
      teste de regressão já existente (`ExecucaoServiceC7RotuloTest::test_d5_...`, não um teste
      novo) — restaurado.
- [x] **3.4** `ExecucaoService::montar()` ganha `array $planB = []` **no fim** da lista de
      parâmetros (nunca no meio — é chamado por posição em vários lugares; inserir no meio
      deslocaria argumentos seguintes sem erro de tipo pra avisar). `ExecutionPipelineService::
      generate()` e `AnalysisPersistenceService` repassam `decision['plan_b']` pela mesma regra.
      `planoB_motivo` publicado no array de execução (`ExecucaoService::indisponivel()`/
      `inconsistente()` também ganharam a chave, sempre `null`, pra manter o contrato uniforme).
- [x] **3.5** `resolverPlanoPrimario()` sobe de `Log::info` para `Log::warning`
      (`GENESIS_PLANO_PRIMARIO_B_DEGRADADO`, com `motivo_plano_b`). O método continua devolvendo
      só a string (contrato já testado por `AnalysisPersistenceServicePlanoPrimarioTest`, via
      reflection) — `plano_primario_degradado` é calculado à parte, no chamador, espelhando a MESMA
      condição (`declarado === 'B' && planoB === null`), sem duplicar nem arriscar divergir.
- [x] **3.6** Frontend: bloco único do Plano B (sempre renderiza — estado "Zona alcançada"/
      "Aguardando o preço" via `trigger.estado`) substituindo os dois blocos antigos; dicionário
      `MOTIVO_PLANO_B` (7 motivos + fallback); aviso no card do Plano A quando
      `plano_primario_degradado`; `geminiService.ts` mapeando os dois campos novos.
      **Achado real, bug pré-existente desde a V6.10, não desta fase**: `execution.plano_primario`
      já era lido em `AnalysisResult.tsx` desde o spec `genesis-v6-10-implementacao` (Fase 5), mas
      `mapGraphicalToLegacy()` (`geminiService.ts`) **nunca copiava esse campo** do payload real do
      backend pro objeto que a tela recebe — a tela sempre caía no fallback `'A'` em produção,
      **mesmo quando o backend declarava `'B'`**, silenciosamente, sem nenhum teste cobrindo a
      passagem por esse adaptador com um `execution` não-nulo. Corrigido junto (campo já existia em
      `types/graphicalAnalysis.ts::ExecutionPipelineResult`, só faltava ser copiado) — teste novo
      em `geminiService.test.ts` prova os três campos (`plano_primario`, novo `planoB_motivo`, novo
      `plano_primario_degradado`) sobrevivendo ao adaptador.
- [x] Alvos do Plano B são independentes dos do Plano A — testado
      (`PlanoBServiceTest::test_alvos_do_plano_b_sao_independentes_dos_do_plano_a`: declarar
      `target_selection.candidate_ids` diferentes produz TPs diferentes). Prova visual (capturas de
      tela reais, dois planos) fica pendente — não há navegador/captura neste ambiente.
- [ ] Ao clicar em B e voltar em A, todos os campos retornam aos valores do A, sem estado preso —
      comportamento inalterado por esta fase (`planoAtivo`/`zonaEfetiva` já tratam isso desde a
      V6.5, E08), mas não reverificado manualmente nesta sessão (sem navegador).

**Regressão**: suíte completa **[API]** — 999 testes, 2953 assertions, **1 falha real encontrada e
corrigida** (`PayloadPublicadoTest`, um teste da própria Fase 1 cujo nome já antecipava ficar
obsoleto — "antes da Fase 3" — corrigido pra refletir que `PlanoBService::gerar()` agora roda de
verdade e devolve `ENTRADA_B_NAO_SELECIONADA`, não mais `null`, quando `decision.plan_b` não é
declarado). As outras 2 falhas do primeiro run (`GraphicalAnalysisAttemptJobTest`/
`GraphicalAnalysisFullPipelineIntegrationTest`) confirmadas como a mesma flakiness de ambiente já
catalogada — 9/9 e 1/1 verdes rodando cada arquivo sozinho. **[FE]**: 424 passed / 29 failed
(452→453 total, +1 teste novo) — idêntico ao baseline da Fase 0, `npx tsc --noEmit` limpo.

## Fase 4 — Derivativos e tela (doc Parte 4) ✅ concluída (09/09/2026)

D3 resolvida (AskUserQuestion): parar de somar cross-exchange, renomear o campo.

- [x] **4.1** `squeezeRisk()` — `COMPRADA` passa a olhar `paredes_compra` (era `paredes_venda`).
- [x] **4.2** Gatilho de preço do squeeze exige direção (queda para long squeeze, alta para short
      squeeze) em vez de `abs()`. 15 testes, incl. movimento contrário → `NOT_EVALUATED` e os dois
      lados isolados (liquidez só do lado certo já basta, só do lado errado não conta).
- [x] **4.3** Funding multiplicado pelos períodos do timeframe — extraído para
      `ExecucaoService::periodosFunding()` (estático, testável) em vez de inline, pra não precisar
      de reflection sobre lógica anônima. Prova ponta a ponta via `montar()`: 1d/0,05% publica 225
      bps (45 períodos), não 5.
- [x] **4.4** Funding com 4 casas decimais e sinal explícito — `ACRESCENTADO` como frase nova perto
      da regra genérica de percentual (confirmado: não havia frase específica pra `SUBSTITUIR`, só a
      regra genérica de 2 casas, que continua existindo para os demais indicadores).
- [x] **4.5** `EvidenceCatalog` ganha os 5 itens `OCR_VISION`/`CONTEXT`. **Achado real**: os paths
      (`vision.visual_observations.*`) não resolviam contra nada — `vision` nunca fazia parte do
      `$snapshot` escaneado pelo manifesto (fica num parâmetro separado de
      `CanonicalBundleBuilder::build()`). Mesclado `$snapshot['vision'] = $vision` no mesmo ponto
      que já mescla `macro.narrative`/`sentiment.narrative` (padrão já estabelecido). Contagem real
      de `CONTEXT` no catálogo: 12→17 (teste de sincronismo de contagem, `EvidenceManifestBuilderH47Test`,
      atualizado).
- [x] **4.6** Frontend: fallback fixo de macro/sentimento removido — a frase inteira saiu do
      arquivo. `AnalysisResult.fase6.test.ts` reescrito (exigia a frase, agora exige a ausência
      dela + a renderização condicional).
- [x] **4.7** `ScoreBasisBars.tsx` — `BlocoNumerico` mostra `valoresBrutos` quando `pct` é nulo.
      Precisou de dois props novos (`macroValoresBrutos`/`sentimentValoresBrutos`), montados em
      `AnalysisResult.tsx` a partir de VIX/DXY/S&P500 e Fear&Greed/dominância — esses campos não
      chegavam a `ScoreBasisBars` antes (só o score numérico chegava).
- [x] **4.8** `sentimentDisponivel` para de olhar `fear_greed`/`btc_dominance`. `macroDisponivel`
      intocado. Teste reescrito (a asserção "arquivo inteiro nunca contém fear_greed" foi
      descartada — o item 4.7, mesma fase, passou a usar esses campos por um motivo legítimo
      diferente; a asserção da linha exata de `sentimentDisponivel` já prova o item sozinha).
- [x] **4.9** Rótulo "combinado, líquido" em `BlocoConviccaoQualidade.tsx`. Teste antigo (V6.10, que
      proibia "líquido" sozinho por medo de parecer o líquido de 1 alvo só) reescrito — "combinado,
      líquido" junto resolve as duas preocupações ao mesmo tempo, não é reversão da V6.10.
- [x] **4.10** Quinto fator "Caminho até o alvo" em `QualidadeEntradaService::avaliar()` — 3 novos
      parâmetros opcionais (`tp1`/`targetCatalog`/`forcaTp1`, default null/[]/null, chamador antigo
      não quebra). Precisou de um novo helper `ExecucaoService::forcaCandidato()` pra resolver a
      força do candidato do TP1 contra o catálogo (não existia antes). `PlanoBService` ganhou
      `tp1_candidate_id` no retorno (não tinha). Caso real do BTC (TP1 acima de resistência mais
      forte) reproduzido em teste dedicado, 6 cenários incl. espelho SHORT. 41/41 nos arquivos de
      `ExecucaoService` depois de conectado nos dois planos.
- [x] **4.11** D3 aplicada. **Achado real, backend já estava certo**: `MultiExchangeDerivativesDisplayService`
      já documentava (comentário) que nunca soma entre exchanges — o bug inteiro vivia só no
      frontend (`oiLiquidationService.ts`). **Achado real #2, mais sério**: a soma cross-exchange
      (contratos heterogêneos) estava *sobrescrevendo* o único valor genuinamente em dólar
      (`binanceData.val`, de `sumOpenInterestValue` — Binance devolve OI nocional real nesse
      endpoint específico) sempre que qualquer exchange tinha dado — a ordem de preferência estava
      invertida. Campo renomeado `totalUsd` → `binanceTotalUsd`, soma removida, card renomeado de
      "Open Interest (Aggregated)" para "Open Interest (Binance)".
- [x] **4.12** Hierarquia visual em `BlocoConviccaoQualidade.tsx` — R:R combinado `text-lg`→`text-3xl`,
      fatores de qualidade `text-xs`→`text-sm`. Sem verificação visual real (sem navegador neste
      ambiente) — mudança de classe Tailwind, não testada por render.

**Regressão**: **[FE]** 427 passed / 29 failed (453→456 total, +3 líquido) — idêntico ao baseline,
`npx tsc --noEmit` limpo. **[API]**: suíte completa dos arquivos tocados 100% verde durante a
implementação (ver detalhe por item); rodada completa da suíte inteira registrada na Fase 5 abaixo.

## Fase 5 — Regressão obrigatória (doc Parte 5, Fase 5) ⚠️ parcial (09/09/2026) — ver limitação abaixo

- [x] `vendor/bin/phpunit` rodado depois de Fases 1-4 completas: **1013 testes, 2986 assertions, 2
      failures, 2 skipped.** As 2 falhas são `GraphicalAnalysisAttemptJobTest`/
      `GraphicalAnalysisFullPipelineIntegrationTest` — a mesma flakiness de ambiente catalogada
      desde a Fase 1 (status `PENDING` sob concorrência) — confirmado rodando os dois arquivos
      juntos, isolados do resto da suíte: **10/10 verdes**. Nenhuma falha nova real. Baseline da
      Fase 0 era 979/2866/3/2 — crescimento de ~34 testes é o esperado (todos os testes novos
      escritos nas Fases 1-4).
- [x] `npx vitest run`: **427 passed / 29 failed** (mesmas 29 falhas pré-existentes da Fase 0,
      confirmadas arquivo por arquivo ao longo de cada fase). `npx tsc --noEmit`: limpo.
- [ ] **Os dois casos de prova (BTCUSDT, ZECUSDT) rodados de novo do zero, upload até tela, capturas
      anexadas — NÃO EXECUTADO.** Este ambiente não tem navegador nem acesso aos gráficos
      TradingView reais dos dois casos do documento (08/09/2026) — a mesma limitação já registrada
      no plano original deste spec (D1/D2, Parte 6 do documento). Verificação real depende do
      Felipe rodar os dois setups e conferir a tela.
- [ ] **EMAs conferidas de novo contra o TradingView — NÃO EXECUTADO**, mesma limitação (sem imagem
      real dos dois casos). Nenhum código de cálculo de EMA foi tocado por este spec (V6.11 não tem
      nenhum item sobre EMA) — risco de regressão real é baixo, mas não foi reverificado
      visualmente.
- [x] Score, R:R e dimensionamento: cobertos por testes unitários/integração ao longo das Fases 1-4
      (RR combinado, RR por alvo, custo de funding, dimensionamento — todos os arquivos de teste
      correspondentes rodados e verdes). Não há reverificação contra os dois casos reais específicos
      do documento (mesma limitação de ambiente acima) — a aritmética foi conferida contra cenários
      sintéticos determinísticos, não contra os números exatos de BTCUSDT/ZECUSDT de 08/09.

## Fase 6 — Cobertura que a auditoria não teve (doc Parte 5, Fase 6) ⚠️ parcial (09/09/2026)

**Limitação de ambiente, igual à Fase 5**: os 4 itens abaixo pedem literalmente "do upload até a
tela" com capturas reais — este ambiente não tem navegador. O que segue é a cobertura de integração
mais próxima possível sem isso: pipeline real e completo (`AnalysisPersistenceService` →
`ExecutionPipelineService` → `ExecucaoService` → `PlanoBService`/`NivelService`/
`TargetCandidateCatalog` → `AnalysisPublicResponseBuilder::build()`, o mesmo builder que a tela
consome) com bundles sintéticos determinísticos, mesmo padrão de `PayloadPublicadoTest` — prova que o
código funciona ponta a ponta, não prova que a tela renderiza certo.

- [x] **Um setup SHORT completo** — `V611Fase6CoberturaTest::
      test_setup_short_completo_com_plano_b_efetivamente_diferente_do_a`. Espelho `$isShort`
      verificado nos dois planos (Plano A entra no preço, stop protege ACIMA, alvo fica ABAIXO;
      Plano B entra no repique ACIMA do preço, stop também ACIMA da própria entrada).
- [x] **Um timeframe diferente de 1 dia** — `V611Fase6CoberturaTest::
      test_timeframe_1w_escala_o_custo_de_funding_pelos_periodos_corretos`, `timeframe='1w'`: 135
      períodos × 0,0005 × 10.000 = 675 bps publicado de verdade em `custos_bps.funding`, via o
      pipeline completo (não só a função isolada, já testada em `ExecucaoServiceE05Test`). 4h não
      testado separadamente — mesma tabela de períodos, já coberta exaustivamente no nível unitário
      (`test_item43_periodos_de_funding_escalam_por_timeframe`, todos os buckets).
- [x] **Um ativo de preço baixo** — adicionado como novo caso ao `dataProvider` existente de
      `PayloadPublicadoTest::test_contrato_do_payload` (`SHIBUSDT`, preço 0,00001234): passa por
      TODAS as asserções já existentes do teste (piso/teto/espaçamento em ATR, formato monetário,
      null-nunca-zero) sem precisar de ajuste — nenhum bug de arredondamento encontrado nesta
      escala sintética.
- [x] **Um caso com Plano B efetivamente diferente do A** — mesmo teste do setup SHORT acima:
      entrada, stop E alvo comprovadamente diferentes entre os dois planos (`assertNotEquals` nos
      três), gatilho declarado pela IA chega ao payload (`trigger.tipo`/`trigger.estado`). Achado
      ao escrever o teste: com só UMA âncora protetora real disponível no bundle, o sistema
      automático de stop resolvia pro MESMO valor numérico nos dois planos (correto — a doutrina
      "pode ser diferente" não é "tem que ser diferente" — mas não provava seleção independente de
      verdade); ajustado o fixture para ter uma segunda âncora real mais próxima da entrada do
      Plano B, e os dois stops resolveram para valores genuinamente diferentes.

**Regressão final (Fases 6+7 incluídas)**: **[API]** 1016 testes, 3028 assertions, 2 failures
(as mesmas 2 de sempre, `GraphicalAnalysisAttemptJobTest`/`GraphicalAnalysisFullPipelineIntegrationTest`
— flakiness de ambiente, não regressão), 2 skipped. **[FE]** 427 passed / 29 failed (idêntico ao
baseline), `npx tsc --noEmit` limpo.

## Fase 7 — Testes existentes que vão quebrar de propósito (doc Parte 5, Fase 7) ✅ concluída (09/09/2026)

Feita ao longo das Fases 1-4 (cada teste reescrito no mesmo commit lógico do item que o quebrou),
não como etapa separada no fim. Lista completa abaixo, por arquivo, motivo da alteração.

**[API] — 19 arquivos modificados, 3 novos:**

| Arquivo | Motivo |
|---|---|
| `tests/Unit/Services/LiquidationCalculatorServiceTest.php` | Item 1.2: +teste do log em array vazio sem exceção; reforçado o teste de `LIQ_FOLGA_CURTA` (antes só checava `INSEGURO`). |
| `tests/Unit/Services/MarketZonesServiceTest.php` | Item 1.1: +teste provando o bug (série sem candle de hoje cai em anteontem) e a correção lado a lado. |
| `tests/Feature/PayloadPublicadoTest.php` | Item 1.3: +2 testes de `plano_b_contrato`/`plano_b_motivo` (um reescrito na Fase 3, nome antigo previa ficar obsoleto). Fase 6: +1 caso de ativo de preço baixo no dataProvider. |
| `tests/Unit/Services/GeminiVisionServiceTest.php` | Item 2.2: +2 testes de `preco_no_candle_atual` (presente/inválido). |
| `tests/Unit/TargetCandidateCatalogTest.php` | Itens 2.3a-f: **reescrita ampla** — filtro de peso zero removido muda o resultado de ~12 dos 20 testes originais (precisaram filtrar por `primary_source` em vez de contar o array inteiro); 4 testes de "confluência sozinha nunca vira candidata" reescritos pra provar o comportamento novo (a premissa que o item 2.3a revoga); +6 testes novos (linha de tendência, elementos, teto de fracas, figura com tipo/estado/viés). |
| `tests/Unit/TargetSelectionValidatorTest.php` | Item 2.4: helper `selecao()` compartilhado ganhou `elementos_usados` (campo novo obrigatório) em todo fixture; +4 testes dedicados (vazio rejeitado, elemento inventado rejeitado, elemento real aceito, indicador de contexto aceito). |
| `tests/Unit/GenesisPromptRrProvisorioTest.php` | Item 2.4: lista de campos da candidata no prompt ganhou `price`/`strength`/`elementos` — assertion de substring exato atualizada. |
| `tests/Unit/VersionamentoSincronizadoTest.php` | Item 2.4: `schema_version`/`prompt_version`/`document_version` subiram para v6.11.0/V6.11 (contrato mudou de verdade). |
| `tests/Unit/Config/GenesisGraphicalV68ConfigTest.php` | Mesma razão — mesmas 3 versões, segundo lugar onde são hardcoded. |
| `tests/Unit/GenesisDecisionSchemaOpenAiTest.php` | Mesma razão — terceiro lugar. |
| `tests/Feature/BenchmarkGenesisV69Test.php` | Item 2.4: fake `DecisionProvider` ganhou `elementos_usados` no rationale (campo obrigatório novo) + campo `reason` corrigido (usava `motivo`, que nunca era lido por nada). |
| `tests/Unit/Services/PlanoBServiceTest.php` | Item 3.3: **reescrita completa** — assinatura mudou (`selectedTargetIds`→`planB`), retorno mudou (`?array`→`{plano,motivo}`). +4 testes de motivo de indisponibilidade, +2 de independência dos alvos. |
| `tests/Unit/Services/PlanoBServiceRegressaoTest.php` | Item 3.3: helpers `planoBLong()`/`planoBShort()` adaptados pro novo contrato — asserções de texto (Wyckoff/CVD/livro) intocadas. |
| `tests/Unit/Services/ExecucaoServiceAvisosPorPlanoTest.php` | Item 3.3: Plano B parou de se auto-resolver (`nearestBarrier`) — precisa de `planB` explícito no call site, senão vinha sempre `null`. |
| `tests/Unit/Services/ExecucaoServiceC7RotuloTest.php` | Item 3.3, mesma razão — o teste D5 (clamp de zona) parou de produzir Plano B sem `planB` explícito. |
| `tests/Unit/QualidadeEntradaServiceTest.php` | Item 4.10: quinto fator sempre presente — `assertCount(4,...)` virou `assertCount(5,...)` nos 2 testes que contavam fatores. |
| `tests/Unit/DerivativesReadingServiceTest.php` | Itens 4.1/4.2: sinal do preço nos fixtures de squeeze estava para o lado que o bug antigo exigia (agora exigiria o oposto); 2 testes de "liquidez do lado oposto" reescritos pro lado CERTO (a semântica inverteu). +4 testes novos. |
| `tests/Unit/ExecucaoServiceE05Test.php` | Item 4.3: +2 testes de `periodosFunding()`/custo publicado. |
| `tests/Unit/EvidenceManifestBuilderH47Test.php` | Item 4.5: contagem hardcoded de itens `CONTEXT` (12→17); +1 teste da prova de aceite (print sem nada desenhado derruba a cobertura). |
| `tests/Unit/GenesisPromptFundingFormatoTest.php` *(novo)* | Item 4.4. |
| `tests/Unit/QualidadeEntradaServiceCaminhoAoAlvoTest.php` *(novo)* | Item 4.10, incl. reprodução do caso real do BTC de 08/09. |
| `tests/Feature/V611Fase6CoberturaTest.php` *(novo)* | Fase 6. |

**[FE] — 4 arquivos de teste modificados:**

| Arquivo | Motivo |
|---|---|
| `components/__tests__/AnalysisResult.fase6.test.ts` | Item 4.6: exigia a frase fixa — reescrito pra exigir a ausência dela. Item 4.8: `sentimentDisponivel` mudou de olhar 4 campos pra 2 — teste reescrito; a asserção "arquivo nunca contém fear_greed" foi descartada por ficar over-broad contra o uso legítimo do item 4.7 nos mesmos campos. |
| `components/__tests__/BlocoConviccaoQualidade.test.ts` | Item 4.9: rótulo mudou de "combinado" pra "combinado, líquido" — o teste antigo (V6.10) proibia "líquido" sozinho por um motivo que continua válido; reescrito pra provar que os dois motivos (V6.10 + V6.11) coexistem na frase nova. |
| `services/__tests__/oiLiquidationService.test.ts` | Item 4.11: campo renomeado `totalUsd`→`binanceTotalUsd`; teste antigo que documentava o fallback (com a ordem de preferência invertida) removido, +1 teste provando a soma cross-exchange não existe mais. |
| `__tests__/geminiService.test.ts` | Item 3.6: +1 teste provando que `plano_primario`/`planoB_motivo`/`plano_primario_degradado` sobrevivem ao adaptador `mapGraphicalToLegacy()` — achado real, `plano_primario` nunca tinha sido testado nesse ponto específico (é onde o bug pré-V6.10-nunca-corrigido vivia). |
