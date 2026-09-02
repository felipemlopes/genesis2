# Plano de Implementação: Gênesis V6.9 — Correção Técnica (41 itens)

**Status deste documento**: criado como planejamento puro em 01/09/2026, a pedido do Felipe
("analise esses documentos e o código e crie um plano spec estilo kiro para eu ver"). **Nenhum item
foi executado ainda.** Este arquivo é para revisão antes de qualquer fase começar.

## Fontes

1. `GENESIS_V6_9_IMPLEMENTACAO_FELIPE.md` — documento técnico do PO (Fabrício), 24/08/2026, com
   arquivo, linha, código antes/depois e "como testar" para cada um dos 41 itens. Cópia completa no
   mesmo diretório deste `tasks.md`.
2. `GENESIS_V6_9_ORIENTACOES_TESTE_FELIPE.md` — protocolo de entrega (mesma data), extraído do PDF
   de 3 páginas. Explica por que o item 41 vem primeiro, lista as cinco regras de entrega e os 17
   comportamentos que precisam de teste unitário. Cópia completa no mesmo diretório.

**Repositórios**: **[API]** = `E:\Programas\wamp64\www\genesis-api` (branch `genesis2`) · **[FE]** =
`c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main` (mesma convenção dos specs anteriores).

---

## Linhagem — por que este NÃO é o quarto spec V6.9 do zero

Existem três specs V6.9 nesta pasta. Ler nesta ordem antes de começar qualquer fase:

| Spec | Data | O que era | Situação real |
|---|---|---|---|
| `genesis-v6-9-correcao-completa` | 18-19/08/2026 | Auditoria em blocos A-H, 50+ itens | Planejamento. Não confirmado como executado. |
| `genesis-v6-9-pacote-final` | 20/08/2026 | 98 itens, §5-19, doc nunca copiado por completo (arquivo tem aviso "AVISO — ainda NÃO contém o corpo completo") | **Foi implementado e commitado** — ver abaixo. Tinha um conflito não resolvido (modelo `gemini-3.6-flash` vs `3.7-flash`). |
| **`genesis-v6-9-correcao-tecnica`** (este) | 24/08/2026 | 41 itens, auditoria **sobre o que o pacote final entregou** | Planejamento, começando agora. |

**Achado ao verificar o código** (não estava em nenhuma memória/spec anterior): o histórico do `[API]`
mostra que `genesis-v6-9-pacote-final` foi de fato implementado, na branch `genesis2`:

```
85da85e V6.9 pacote final: Fases 12-19 (ferramentas laterais, limpeza, testes/provas, deploy)
4076bb1 V6.9: Fases 1-7 completas (candle vivo, riscos/execucao, coerencia da decisao, texto e interface)
```

Isso muda a leitura de tudo abaixo: **este documento de 24/08 é um segundo round de auditoria, feito
depois da entrega do pacote final**, não uma reformulação do zero. É por isso que vários itens citam
"nesta mesma versão"/"foi entregue no mesmo pacote" (itens 7 e a nota sobre a Regra 5 no protocolo de
teste) — eles estão descrevendo lacunas dentro do que `85da85e`/`4076bb1` já entregaram, não dívida
antiga. O conflito de modelo (`gemini-3.6-flash` vs `3.7-flash`) registrado em
`genesis-v6-9-pacote-final/MATRIZ_DE_ACEITE_V6_9.md` **não aparece em nenhum dos 41 itens deste
documento** — fora de escopo aqui; a decisão do Felipe de 19/08 (manter `3.7-flash`) continua de pé e
não deve ser tocada por este spec.

---

## Verificação contra o código atual (01/09/2026) — antes de aceitar qualquer item

Conferido item por item, arquivo e linha, nos dois repositórios, antes de escrever as fases abaixo.
Amostra de ~40% dos itens (todos os de maior risco/impacto arquitetural); os demais são edições
locais de baixo risco (mensagens de texto, formatação, um `const`) e não foram conferidos
individualmente — conferir na Fase 0 antes de cada um.

| # | Item | Situação real confirmada | Evidência |
|---|---|---|---|
| 1 | TP colado no preço | **Confirmado.** `if ($valor == $preco) { continue; }` — igualdade exata de float, sem piso. | `TargetCandidateCatalog.php:98` |
| 6 | EMA como origem de alvo | **Confirmado.** `'ema' => 5` na tabela `PESOS`. | `TargetCandidateCatalog.php:45` |
| 7 | Zona de liquidação fora do catálogo | **Confirmado, e a alegação do comentário procede.** `LiquidationMapService.php` já tem `LIMIT_OI = 500` (linha 46) e bins por `tickSize` real (linha 138) — a Fase 10 do pacote final realmente já entregou o mapa real. Nada bloqueia wirar a 4ª fonte de confluência hoje. | `app/Services/LiquidationMapService.php:46,138` |
| 8 | Segunda validação da escolha da IA | **Parcialmente já existe — item precisa reformular, não criar do zero.** `TargetSelectionValidator.php` já roda depois da IA e já confere lado, duplicidade, ordem de distância e alinhamento do `rationale`. **Não confere piso/teto** — confia que todo `candidate_id` presente em `$candidates` já é elegível, porque hoje é o catálogo (item 1/2, sem piso/teto ainda) quem filtraria isso. Depois que 1/2 adicionarem piso/teto ao catálogo, este item vira "adicionar uma segunda checagem independente de piso/teto aqui", não "criar o validador". | `app/Services/GraphicalAnalysis/TargetSelectionValidator.php` (arquivo inteiro, 89 linhas) |
| 9 | Teto do stop em % fixo | **Confirmado.** `TETO_BANDA_PCT = 0.20` e `TETO_CAMADA3_PCT = 0.30`. | `NivelService.php` |
| 16, 18 | Margem de manutenção `0.005` fixa | **Confirmado, é a mesma causa raiz dos dois itens.** `calcularLiquidacao(..., float $mm = 0.005)` e `maiorAlavancagemSegura()` chama `self::calcularLiquidacao($entrada, $direcao, $alav, 0.005, $symbol)` explicitamente — o bracket real nunca é consultado nesta função. | `MotorExecucaoService.php:73,219` |
| 22, 35 | `number_format`/`toFixed(4)` cru, catch devolvendo 0 | **Confirmado nos três arquivos.** `number_format($nocional, 2, ',', '.')` dentro de string pública; `.toFixed(4)` cru no ATR; `{ val: 0, ... }` e `{ price: 0, change: 0 }` nos dois catches. | `ExecucaoService.php:842`, `AnalysisResult.tsx:997`, `oiLiquidationService.ts:72,74,91` |
| 25 | Squeeze sem evidências mínimas | **Confirmado.** `squeezeRisk(array $crowding)` só recebe o crowding (derivado só do z-score do funding) — sem preço, sem Open Interest. | `DerivativesReadingService.php:100-113` |
| 27 | Faixa morta `> 3`/`< -3` | **Confirmado.** `$modifier > 3 => 'STRENGTHENS', $modifier < -3 => 'WEAKENS'`. | `DerivativesReadingService.php:157-158` |
| 28 | Prompt se contradiz ("NÃO atribui score" + pede score) | **Confirmado, ambos os trechos no mesmo arquivo.** "NÃO atribui score" na linha 305; "SCORE DO SENTIMENTO" na 319; "SCORE MACRO" na 330. | `GeminiContextService.php:305,319,330` |
| 29 | Sentimento/Macro sem busca própria | **Confirmado, e a fonte de restauração foi localizada** (ver seção "Achado" abaixo) — o doc diz "está no histórico do repositório" sem apontar onde; aqui aponta. | `GeminiContextService.php` (método `separarEventos()`, linha 164) |
| 39 | `PlanoBService` zona artificial | **Confirmado.** `$zonaAte = min($zonaAte, round($precoAtual * 0.999, 8));`. | `PlanoBService.php:198` |
| 41 | `assertTrue(true)` + caminho absoluto | **Confirmado, e mais detalhado do que o doc registra.** O arquivo real tem um comentário extenso explicando que o teste é "temporário... existe só para produzir a prova desta fase [18 do pacote final]. Removido depois do aceite" — ou seja, ele nunca foi pensado como suíte permanente; vai precisar ser reescrito, não só ter a asserção trocada. Nenhuma imagem de aceite está versionada (`tests/Proof` só tem PNGs de um spec antigo, `r3.2`, não deste). | `tests/Feature/AceiteVisualV69Test.php` (89 linhas) |

**Nenhum item verificado é falso.** Onde há drift, é só número de linha (±1 a ±13 linhas — natural
depois de duas fases de commits desde 24/08) — a essência de cada "Hoje" bate com o código real.

### Segunda leva de verificação (Fase 0 executada, 01/09/2026)

| # | Item | Situação real confirmada | Evidência |
|---|---|---|---|
| 9, 11 | Teto do stop em %, testado só na âncora | **Confirmado com precisão.** `NivelService` filtra elegibilidade (`$eligivel`) comparando a âncora contra `$preco * TETO_BANDA_PCT`/`TETO_CAMADA3_PCT` **antes** de somar o buffer — o `$nivel` final (âncora + buffer) nunca é reclassificado contra teto nenhum. Confirma os itens 9 e 11 juntos: não existe noção de ATR aqui, só %, e só na âncora. | `NivelService.php:95-165` |
| 10 | IA escolhe o stop | **Confirmado, e o esforço é maior do que uma correção pontual.** Hoje `NivelService::stop()` é 100% automático: monta um pool de âncoras candidatas e escolhe a de maior `notaQualidadeAncora()` (peso 40% + confluência 25% + proximidade 20% + recência 15%) — a IA não participa da escolha em nenhum ponto. Implementar o item 10 como descrito (IA recebe níveis reais do lado contrário e escolhe um `id`, PHP valida) é uma mudança de fluxo, não uma troca de constante — envolve novo campo no `GenesisDecisionSchema.php`/prompt e um validador equivalente ao `TargetSelectionValidator` (item 8), só que para stop. | `NivelService.php:79-166` |
| 12 | Buffer nunca é cortado | **Sem bug hoje, porque não existe nada que possa cortar.** `calcularBuffer()` sempre devolve `max(atr×0.5, pavios, spread, slippage)` — não há nenhum caminho de código que reduza esse valor. O item vira "adicionar o teto pós-buffer do item 11 sem tocar em `calcularBuffer()`", não "remover um corte existente". | `NivelService.php:346-365` |
| 20 | `last_closed_candle_at` | **Já implementado por completo — item 20 já está pronto.** Coluna na migration, `$fillable`/cast no model, preenchido em `MarketSnapshotService.php:181`, exposto em `CanonicalBundleBuilder.php:180` e `AnalysisPublicResponseBuilder.php:77`, e já existe teste (`MarketSnapshotClosedCandlesTest.php:63`) asserindo que não é nulo. Nenhuma ação de código necessária — só confirmar no aceite visual (Fase 1b) que o campo continua presente. | `app/Models/Analise.php:102,152`, `MarketSnapshotService.php:181`, `tests/Feature/MarketSnapshotClosedCandlesTest.php:63` |
| 23 | Preço de rompimento de figura | **Parcialmente já feito — escopo real é menor que o documento descreve.** A camada de VISÃO (`GeminiVisionService::normalizarPatterns()`, chamada de verdade no pipeline vivo, linha 139) já faz os 8 passos do item: valida o ID contra `GenesisVisualCatalogV6::PATTERNS`, valida geometria (topo>base>0), exige `preco_rompimento` para estados BREAKING/RETESTING/CONFIRMED, confere coerência com o viés da figura e com o preço visível atual, descarta e loga tudo que falha. **O que falta de verdade**: `GenesisPrompt.php` e `GenesisDecisionSchema.php` (os arquivos vivos, não os `V67Baseline`) não têm nenhuma referência a `preco_rompimento`/`preco_topo`/`preco_base` — os dados chegam validados até `bundle.vision.patterns[]`, mas a camada de decisão não os expõe nem pede pra IA. O item 23 vira "wirar os 3 campos já validados no prompt/schema de decisão", não "construir a validação". | `GeminiVisionService.php:139,168-249` (feito) vs. `GenesisPrompt.php`/`GenesisDecisionSchema.php` (grep zero ocorrências — falta) |
| 26 | Modificador de derivativos vira 0, não null | **Confirmado, precisamente.** Quando `crowding['level'] === 'UNAVAILABLE'` e `quadrant === 'INDISPONIVEL'`, o método devolve `['modifier' => 0, 'classification' => 'UNAVAILABLE', ...]` — o `0` está explícito no código, exatamente a ambiguidade que o item 26 aponta. | `DerivativesReadingService.php:125-126` |
| 30 | Gate roda em "três lugares" | **Contagem não bate — só achei 2 chamadas de `->validar(`, não 3**, ambas em `GraphicalAnalysisAttemptJob.php` (linha 269, narrativa; linha 475, `score_description`). Não é motivo pra duvidar do item (a direção — "aplicar em mais superfícies" — continua certa), só a contagem específica do "hoje" pode estar desatualizada ou contando diferente (talvez macro+sentimento contem como 1 chamada com 2 textos). Conferir de novo ao implementar, não assumir 3 sites fixos. | `GraphicalAnalysisAttemptJob.php:269,475` |
| 31 | Confluências cruas no texto | **Confirmado, código idêntico ao citado.** `return $confluentes === [] ? $base : $base.' · coincide com '.implode(' e ', $confluentes);` — `$confluentes` vem direto de `$grupo['fontes']` (chaves internas tipo `pdh_pdl`/`hvn`), sem passar pelo `match` de tradução que `$base` usa. | `TargetCandidateCatalog.php:283-307` |
| 32 | `structure_event` nunca chega ao gate | **Confirmado, mas é um deferral deliberado e documentado, não um bug esquecido.** O comentário no próprio código explica: o formato real de `bundle.evidence.estrutura.event` é `{type, level, close, confirmed}`, sem campo de "direção" pronto pra comparar contra a narrativa sem risco de leitura errada — e o gate **já tem teste passando** (`PublishedOutputGateTest`) esperando por quando esse formato existir. O item 32 precisa de uma decisão de design primeiro (como derivar direção de `type`/`level`/`close` com segurança), não só "passar o valor que já existe". | `GraphicalAnalysisAttemptJob.php:466-471`, `PublishedOutputGate.php:38,70,95-98` |
| 33 | CHoCH só quando validado | **Detector já existe e é substancial.** `MarketStructureService.php` já produz eventos tipados `CHOCH_UP`/`CHOCH_DOWN`/`BOS_UP`/`BOS_DOWN`. O que falta verificar (não confirmado ainda) é se esses eventos só entram no contexto da IA quando `confirmed: true`, ou se algum consumidor os usa antes da confirmação — checar na implementação da Fase 10, não achado aqui. | `MarketStructureService.php:179,193` |
| 36 | Chips `1W`/`1M` crus | **Arquivo real identificado — não é `AnalysisResult.tsx`.** O componente de chips/timeframe é `pages/GenesisPage.tsx` (linhas 185, 331-332, 345) — tem toda a lógica de normalização de sinônimos (`WEEKLY`→`1w`, `MONTHLY`→`1M`) mas guarda o valor interno `1w`/`1M`, não um rótulo por extenso; a exibição ao usuário provavelmente usa esse mesmo valor cru no chip. Confirmar o ponto exato de renderização do label antes de codar o item. | `pages/GenesisPage.tsx:185,331-332,345` |
| 37 | Funding "COMPRADA"/"VENDIDA" | **Confirmado** (já visto na primeira leva, repetido aqui por completude): `$side = ... ($fundingRate > 0 ? 'COMPRADA' : 'VENDIDA')`. | `DerivativesReadingService.php:83` |
| 38 | Ícone do ativo ausente | **Confirmado.** `{data.pair?.replace('USDT', '').replace('/', '') || ''}` — extrai o texto puro do par, nenhum componente de ícone por perto. | `components/AnalysisResult.tsx:354` |

**Itens ainda não conferidos individualmente** (baixo risco — texto/produto, sem "Hoje" técnico
específico para verificar): 2, 3, 4, 5, 13, 17, 24, 34, 39 (já confirmado na 1ª leva), 40. Conferir
ao entrar em cada fase respectiva, não represar mais a Fase 0 por eles.

### Achado — de onde restaurar o item 29

O documento diz "a versão em que isso funcionava está no histórico do repositório" sem indicar o
commit. Localizado:

```
3ac66eb  Fase 9: remove InformativeNarrativeService (código morto)
6ab4c00  Adendo genesis-v6-4-contexto-informativo: restaura narrativa de macro/sentimento
```

`InformativeNarrativeService.php` (`app/Services/GraphicalAnalysis/`) foi a implementação restaurada
pelo spec `genesis-v6-4-contexto-informativo` — a que fazia busca em fontes próprias por ativo e por
macro, cada uma com seu resumo. Ela foi removida como "código morto" na Fase 9 do V6.8
(`genesis-v6-8-correcao-tecnica`) porque, naquele momento, nada mais a chamava — o rewiring do V6.8/V6.9
(Fase 5, visão→contexto→decisão) tinha migrado tudo para `GeminiContextService::separarEventos()`, que
só lê a tabela do Radar News. A remoção fez sentido como limpeza de dead code **na época**; o item 29
está pedindo para trazer aquele comportamento de volta, agora dentro de/ao lado de
`GeminiContextService`.

**Recuperação do conteúdo antigo**: `git show 3ac66eb~1:app/Services/GraphicalAnalysis/InformativeNarrativeService.php`
no repositório `[API]`. Ler também `.kiro/specs/genesis-v6-4-contexto-informativo/{requirements,design}.md`
no `[FE]` para o desenho original (fontes usadas, formato do score, como o micro-resumo era montado)
antes de reimplementar — não é para copiar o arquivo antigo de volta cru (o pipeline mudou desde
então: agora é visão→contexto→decisão, e o contexto não pode mais tocar direção/score técnico), é
para usar como referência de "quais fontes, que formato de busca, que shape de resposta".

---

## Decisões que precisam do Felipe antes de começar

Regra 5 do protocolo de teste é explícita: desvio exige aprovação antes, não comentário no código
depois. Estas quatro travam fases específicas — nenhuma trava a escrita deste plano.

- [x] **D1/D2 — Imagens de aceite (BTCUSDT 23/08 vs 16/08, e ENAUSDT).** **Resolvida 01/09/2026,
      Felipe: "as imagens de teste deixa para depois."** As duas fixtures (versionar no repo,
      decidir qual captura de BTCUSDT é a canônica, escrever as asserções exatas de EMA/variação do
      aceite visual) ficam **adiadas** — não bloqueiam mais o resto do spec. Isso divide a Fase 1
      em duas partes (ver Fase 1 abaixo): a suíte real (remover `assertTrue(true)`, escrever os 17
      testes unitários) segue agora; os dois testes de aceite visual (BTCUSDT/ENAUSDT) esperam essa
      decisão.
- [x] **D3 — Escopo do item 29.** Ainda em aberto (não veio resposta explícita) — mas não bloqueia
      mais que as fases anteriores, então mantido como está: confirmar antes da Fase 9 que
      "restaurar" significa reativar/adaptar `InformativeNarrativeService` (achado acima) dentro do
      pipeline atual, não desenhar uma busca nova do zero.
- [x] **D4 — Modelo de decisão. Resolvida 01/09/2026, Felipe: "vai usar gemini 3.7 flash."**
      Confirma o que já está ativo em `config/genesis_graphical_v6.php:189` — nenhuma mudança de
      código necessária. Nenhum dos 41 itens deste documento toca em modelo (conferido por grep no
      arquivo-fonte, zero ocorrências de `gemini-3.x`/`GENESIS_MODEL`); o conflito 3.6 vs 3.7-flash
      é de um documento anterior (`genesis-v6-9-pacote-final`, seção 18.9) e não é reaberto aqui.
      Só fica como lembrete pra Fase 9 não encostar nisso sem querer, já que edita o mesmo arquivo
      (`GeminiContextService.php`) por outro motivo (itens 28/29).

---

## Escopo deste spec

Os 41 itens do documento técnico, na ordem de execução que ele mesmo define (tabela "ORDEM DE
EXECUÇÃO"). Cada item abaixo tem checkbox próprio; o texto completo (código antes/depois) está em
`GENESIS_V6_9_IMPLEMENTACAO_FELIPE.md` — este arquivo não duplica os blocos de código, só referencia
o número do item.

**Definição de pronto por item**: código alterado **e** teste (unitário ou de aceite) verde cobrindo
o "Como testar" daquele item. Nenhum item é marcado `[x]` só por conferência manual — é a mesma regra
que os dois documentos-fonte impõem para a entrega inteira.

---

## Fase 0 — Verificação completa (antes de tocar em código) ✅ executada 01/09/2026

**Nota de arquivo**: o documento cita `app/Support/GenesisPrompt.php` e `app/Support/GenesisDecisionSchema.php`
juntos no item 23 — no repositório real, `GenesisPrompt.php` mora em
`app/Services/GraphicalAnalysis/`, não em `app/Support/`. Só `GenesisDecisionSchema.php` e
`GenesisVisualCatalogV6.php` estão de fato em `app/Support/`. Path errado no documento, não bug de
código.

- [x] Conferir itens 9, 10, 11, 12, 20, 23, 26, 30, 31, 32, 33, 36, 37, 38 — resultado na tabela
      "Segunda leva de verificação" acima. Três reclassificações importantes que mudam as fases
      seguintes: **item 20 já está pronto** (nenhuma ação de código), **item 23 tem escopo bem menor
      que o descrito** (só falta wirar 3 campos já validados no prompt/schema de decisão, a
      validação em si já existe), **item 32 precisa de uma decisão de design antes de codar** (não é
      só "passar o valor" — o formato de `structure_event` ainda não tem uma direção segura pra
      comparar).
- [ ] Itens ainda não conferidos individualmente (baixo risco, conferir ao entrar em cada fase, não
      represar mais a Fase 0 por eles): 2, 3, 4, 5, 13, 17, 24, 34, 40
- [ ] Resolver D3 com o Felipe antes da Fase 9 (D1/D2/D4 já resolvidas — ver seção acima)

## Fase 1 — Item 41 (teste real primeiro)

Regra 1 do protocolo: sem isso, nenhum outro item é avaliado. **Dividida em 1a (segue agora) e 1b
(adiada — depende de D1/D2, decisão do Felipe em 01/09/2026: "as imagens de teste deixa para
depois").**

### Fase 1a — segue agora, não depende das fixtures ✅ reescrita executada 01/09/2026

- [x] Reescrever `AceiteVisualV69Test.php` — `assertTrue(true)` apagado dos dois testes, nenhum
      caminho absoluto de máquina local (`C:\Users\felip\Downloads\...`) restante no arquivo. Os
      dois testes checam a presença da fixture (`tests/Proof/v69/fixtures/{BTC,ENA}USDT.P.png`,
      caminho relativo ao repo) e, sem ela, chamam `markTestSkipped()` com o motivo (D1/D2
      pendentes) — não apagados, não com asserção disfarçada. `rodarAceite()` passou a devolver o
      payload decodificado (`array`), para as asserções da Fase 1b não precisarem reabrir o JSON
      gravado em disco. Rodado isoladamente: `vendor/bin/phpunit tests/Feature/AceiteVisualV69Test.php`
      → `OK, but some tests were skipped! Tests: 2, Assertions: 0, Skipped: 2` — skip limpo, zero
      erro.
- [ ] Escrever os 17 testes unitários da tabela do protocolo de teste (piso/teto de alvo,
      espaçamento, origem EMA proibida, segunda validação, teto de stop, buffer integral, ausência
      vs zero, lote mínimo, tickSize, retry/backoff/timeout, frescor, degradação de derivativos,
      modificador null, catálogo das 50 figuras, rollover de vela, contradição factual) —
      **cada um nasce junto com o item correspondente, nas fases 2-9** (não dá pra escrever um
      teste que comprove um comportamento que o código ainda não tem); esta linha só fecha quando
      a última fase (10) fechar a última dessas 17
- [ ] Suíte completa (exceto os dois testes de aceite visual, skipados) roda do início ao fim sem
      falha, sem caminho absoluto de máquina local — conferir de novo ao fechar a Fase 10, esta
      checagem isolada de hoje (ver nota abaixo) só cobre o arquivo reescrito

### Fase 1b — plumbing feito 01/09/2026, execução real fica pra Fase 11

**D1 resolvida** (AskUserQuestion, 01/09/2026): sem imagem de 23/08 disponível, usar a de 16/08 já
existente como fixture de trabalho — os valores exatos de EMA/variação do documento (que são da
fixture de 23/08) não valem para ela e ficam de fora até uma execução real.

- [x] Imagem definitiva do BTCUSDT: a de 16/08/2026 (decisão acima). ENAUSDT: a de 20/08/2026, sem
      objeção.
- [x] Versionadas as duas imagens: `tests/Proof/v69/fixtures/BTCUSDT.P.png` e `.../ENAUSDT.P.png`
      (ainda não commitadas — arquivos novos no working tree, aguardando o Felipe pedir o commit)
- [x] Gate duplo escrito nos dois testes: arquivo de imagem presente **e**
      `GENESIS_RUN_VISUAL_ACCEPTANCE=true` no ambiente (mesmo padrão de
      `GeminiInteractionsLiveContractTest`/`GENESIS_RUN_LIVE_CONTRACT`) — sem isso, `markTestSkipped()`
      explica qual dos dois motivos falta. **Nenhum crédito real de API foi gasto**: rodei
      `vendor/bin/phpunit tests/Feature/AceiteVisualV69Test.php` depois de versionar as imagens e os
      dois continuam pulando (env var não setada) — confirma que o gate funciona antes de qualquer
      execução real acontecer sem pedido explícito.
- [x] Asserções estruturais escritas (não dependem de valores exatos de fixture): HTTP 200,
      `analysis_status = COMPLETED`, nenhum campo de tamanho/risco/margem zerado quando o stop é
      válido, varredura de código interno (`numero_redondo`, `pdh_pdl`, `hvn`,
      `open_interest_history`, `candidate_id`, `STOP_UNAVAILABLE`, `TARGET_SELECTION`) no payload
      público inteiro, não só nos campos já mapeados
- [ ] **Pendente pra Fase 11**: valores exatos de EMA/variação (BTCUSDT) e as asserções específicas
      do ENAUSDT (Fibonacci/linhas/VRVP/tickSize/derivativos) — precisam das fases 2-10 prontas e de
      uma execução real (`GENESIS_RUN_VISUAL_ACCEPTANCE=true`, gasta crédito, pedir explicitamente
      quando chegar a hora)

## Fase 2 — Itens 1, 2, 3, 8 (TP1 colado e R:R zerado) ✅ executada 01/09/2026

- [x] Item 1 — piso de distância (`max(tickSize×4, ATR×0.25)`) em `TargetCandidateCatalog::build()`,
      substituindo o `if ($valor == $preco) continue;` original
- [x] Item 2 — teto de distância (`ATR × horizonte do timeframe`), mesmo loop. Novo
      `TargetCandidateCatalog::horizonAtr(string $timeframe): float` (`public static`) — tabela
      **restaurada de `AlvoService::TETO_ATR_POR_TIMEFRAME`/`tetoPorTimeframe()`**, removidos por
      completo na Fase 6 do pacote final quando a seleção virou 100% por `candidate_id` (achado via
      `git show 4076bb1:app/Services/AlvoService.php` — mesmos valores calibrados daquele item,
      1m/3m=6 … 1d=15 … 1M=25, padrão 15)
- [x] Item 3 — espaçamento mínimo de 0,50 ATR entre alvos **consecutivos da seleção da IA**, não
      "entre TP1/TP2/TP3" dentro do catálogo — o catálogo não seleciona mais TP1-3 desde a Fase 6 do
      pacote final (a IA escolhe `candidate_ids`), então a checagem entrou em
      `TargetSelectionValidator::validate()`, junto do item 8 (mesmo lugar natural: os dois
      recalculam algo sobre a sequência já escolhida pela IA)
- [x] Item 8 — `TargetSelectionValidator::validate()` ganhou um 4º parâmetro (`string $timeframe`,
      default `'1d'` para não quebrar chamadores que não migraram) e recalcula piso (0,25 ATR — só a
      parcela em ATR do item 1, o validador não recebe tickSize) e teto
      (`TargetCandidateCatalog::horizonAtr()`) por candidato selecionado, descartando mesmo o que a
      IA escolheu (`TARGET_SELECTION_OUT_OF_BOUNDS`). Call site real
      (`DecisionResponseValidator.php:121-126`) atualizado pra passar
      `data_get($bundle, 'request.timeframe')`.
- [x] Testes: 7 novos (`TargetCandidateCatalogTest` +3: piso, teto, tabela `horizonAtr` por
      timeframe; `TargetSelectionValidatorTest` +4: piso/teto na segunda validação, alvos colados
      rejeitados, espaçamento exato de 0,50 ATR aceito). **28/28 verdes** nos dois arquivos
      (21 preexistentes + 7 novos, zero regressão). `DecisionResponseValidatorTest` (24 testes,
      cobre a mudança de assinatura do call site) também verde.

**Regressão real encontrada e corrigida pela suíte completa** (exatamente o que o item 41 existe
para pegar): `BenchmarkGenesisV69Test::test_benchmark_roda_o_pipeline_v69_real_e_grava_prova`
começou a falhar depois do item 3 — o decisor fake desse teste (`fakeDecisionProvider()`) escolhia
os 3 candidatos mais próximos do catálogo real (candles reais de APTUSDT/1w) sem checar
espaçamento, e a validação nova (`TargetSelectionValidator`) passou a rejeitar seleções com dois
alvos colados. Confirmado com `git stash`/`stash pop` que o teste passava antes e falhava depois —
não era flakiness. **Corrigido no próprio teste** (`tests/Feature/BenchmarkGenesisV69Test.php`):
seleção gulosa que só aceita o próximo candidato quando já respeita os 0,50 ATR do último aceito —
o mesmo que uma IA real precisa fazer sob a regra nova. Reconfirmado 4x seguidas (dado real de
mercado, não fixture fixa) — verde nas 4.

**Achado sobre o ambiente de teste, importante para todas as fases seguintes**: esta máquina tem um
processo `php.exe` permanente (confirmado pelo Felipe — "é meu, deixa rodando") cujo consumo de
memória cresce ao longo do tempo, e a suíte completa (840 testes) compete por recurso com ele. Rodar
`vendor/bin/phpunit` sem filtro várias vezes seguidas em pouco tempo faz o número de falhas
**crescer a cada rodada** (2 → 5 → 9 → 12), todas do mesmo formato — status esperado
`FAILED`/`COMPLETED`/`REJECTED_IMAGE` vindo como `PENDING` — em testes de fila/job assíncrono
(`GraphicalAnalysisAttemptJobTest`, `GraphicalAnalysisFullPipelineIntegrationTest`). **Isolado com
`--filter`, cada um desses testes passa individualmente**, sempre. **Suíte completa não é mais o
critério de fechamento de fase daqui pra frente** — usar `--filter` nos arquivos/testes relevantes de
cada item, mais `git stash`/`stash pop` como A/B quando uma falha for suspeita de regressão real
(foi assim que a regressão do `BenchmarkGenesisV69Test` acima foi confirmada e diferenciada disto).

**Um achado catalogado à parte, real mas pré-existente, não causado por este spec**:
`GraphicalAnalysisAttemptJobTest::test_sucesso_apos_repair_1_primeira_tentativa_precisa_de_repair`
falha isolado (`--filter`, rápido, 1.5s, não é timeout) com `repair_last_errors` chegando `null`
onde deveria vir populado. Confirmado com `git stash`/`stash pop` (mesma metodologia) que **falha
identicamente com e sem as mudanças deste spec** — bug de outra origem, fora do escopo dos itens 1/2/3/8.
Registrado aqui só para não ser confundido com regressão nova numa fase futura; não faz parte deste
spec corrigir.

**Ponto de atenção registrado, não corrigido nesta fase** (fora do escopo dos itens 1/2/3/8 como
descritos, mas nasceu da interação entre eles): `TargetSelectionValidator`'s
`$esperado = min(3, $disponiveisLadoCerto)` conta candidatos elegíveis por LADO, sem saber se dá pra
espaçar 3 deles em >= 0,50 ATR — num catálogo real com poucos candidatos muito próximos entre si,
uma IA que selecione corretamente (respeitando o espaçamento) pode ficar com menos alvos do que
`$esperado` exige, e ser rejeitada por `TARGET_SELECTION_COUNT_INVALID` mesmo fazendo tudo certo.
Não reproduzido nos testes desta fase (o dado real do benchmark sempre teve candidatos suficientes),
mas é uma tensão real entre os itens 3 e 8 que vale revisar se aparecer na Fase 11 (aceite visual)
ou em produção.

## Fase 3 — Itens 9, 10, 11, 12 (stop a 19.46%) — 9/11/12 executados 01/09/2026, item 10 pendente

**Item 10 é o maior esforço desta fase** (ver "Segunda leva de verificação") — hoje o stop é 100%
automático (`NivelService::stop()` pontua e escolhe sozinho); vira "IA recebe níveis reais do lado
contrário e escolhe um id, PHP valida" — precisa de campo novo no schema/prompt de decisão e um
validador equivalente ao `TargetSelectionValidator` (item 8), só que para stop. Fazer depois dos
itens 9/11/12 (mais simples, mudam só `NivelService`) para não misturar o redesenho de fluxo com o
ajuste de constantes.

- [x] Item 9 — `TETO_BANDA_PCT`/`TETO_CAMADA3_PCT` (% do preço) apagados, substituídos por
      `TETO_ATR_NORMAL = 3.0` / `TETO_ATR_AMPLIADO = 4.5` (múltiplos de ATR). As janelas de busca das
      3 camadas passaram a usar `$atr * TETO_ATR_NORMAL`/`$atr * TETO_ATR_AMPLIADO` em vez de
      `$preco * 0.20`/`$preco * 0.30`.
- [x] Item 11 — teto verificado no STOP FINAL (âncora + buffer completo), não mais só na âncora. A
      classificação `VALID`/`VALID_WIDE`/`STOP_UNAVAILABLE` foi movida pra depois de calcular
      `$nivel = $ancora + buffer` — antes dependia de qual camada achou a âncora (`$camada === 3`),
      que podia estar errado quando o buffer empurrava o stop de "normal" pra "ampliado" sem
      ninguém perceber (exatamente o exemplo do documento: âncora a 2,80 ATR + buffer de 0,5 ATR =
      stop final a 3,30 ATR, ampliado). `$camada` virou write-only depois dessa mudança e foi
      removida (dead code, junto com um `$pool = $poolZoom` que já era inalcançável antes desta
      fase — achado incidental, não regressão).
- [x] Item 12 — confirmado sem código a alterar (`calcularBuffer()` não tinha nenhum caminho de
      redução antes desta fase, e continua sem ter). Comentário no código deixa explícito o porquê.
- [~] Item 10 — IA escolhe nível real do lado contrário, PHP valida (redesenho de fluxo). **Em
      andamento (01/09/2026)**, decisão do Felipe de seguir com calma na mesma sessão (AskUserQuestion).
      Desenho final (validado contra o código real antes de escrever): candidatos de stop com ID
      (mesmo padrão de `TargetCandidateCatalog`/item 8), expostos no bundle ANTES da decisão; a IA
      escolhe `stop_selection.candidate_id` na MESMA resposta que já decide `direction` e
      `target_selection` (não uma chamada extra — mesma solução que o item 8 já usa pro problema de
      "candidatos dos dois lados antes de saber qual lado"); `StopSelectionValidator` confere depois;
      `NivelService::stop()` usa a escolha quando válida, cai no sistema automático (itens 9/11/12,
      já prontos) quando não há escolha ou ela falha — nunca "sem stop", sempre "sem âncora
      específica, usa estrutura de proteção disponível" (ponto 7 do item). Plano B fica de fora
      deliberadamente (âncora em `entradaB`, referência de preço diferente da atual — escopo, não
      esquecimento).

      **Progresso**:
      - [x] `NiveisContratoBuilder` (novo) — extraiu ~90 linhas que viviam soltas dentro de
            `ExecutionPipelineService::generate()` (resistências/suportes validados, HVN/POC,
            PDH-PDL, PWH-PWL, tese) pra uma classe reusável. Precisa rodar duas vezes com o MESMO
            resultado (antes da decisão, pra montar os candidatos; depois, pro cálculo real) —
            deixar a lógica em dois lugares seria arriscar divergência silenciosa. `ExecutionPipelineService`
            reescrito pra chamar a classe nova em vez da lógica inline; ganhou também o parâmetro
            `?string $stopCandidateId`, repassado até `ExecucaoService::montar()` → `NivelService::stop()`.
            `HvnFaixasTest.php` (testava por reflection um método privado que migrou de classe)
            atualizado para apontar pra `NiveisContratoBuilder`. Teste novo dedicado,
            `NiveisContratoBuilderTest.php` (5 testes) + os 11 testes indiretos que já exercitavam
            `ExecutionPipelineService` fim a fim — todos verdes, zero regressão da extração em si.
      - [x] `NivelService::candidatos()` — expõe o mesmo pool que a seleção automática já usa, com ID
            determinístico (`sc_` + hash de tipo/valor/side, mesmo espírito de
            `TargetCandidateCatalog::candidateId()`, sem símbolo/timeframe — candidatos de stop nunca
            são comparados entre análises diferentes)
      - [x] `NivelService::stop()` — novo parâmetro `?string $candidateIdEscolhido`: usado direto
            quando encontrado no pool E dentro do teto ampliado (item 9); cai no sistema automático
            de 3 camadas em qualquer outro caso (ausente, id inexistente, fora do teto) — nunca
            rejeita o stop inteiro por causa de uma escolha ruim. 6 testes novos
            (`NivelServiceStopCandidateSelectionTest.php`): IDs determinísticos, a escolha da IA
            vencendo o candidato de maior peso automático, fallback nos 3 casos de escolha inválida.
            37 testes Unit relacionados a `NivelService` rodados juntos — verde, zero regressão.
      - [x] `StopSelectionValidator` (novo, mirroring `TargetSelectionValidator`) — 8 testes,
            `STOP_SELECTION_UNKNOWN`/`STOP_SELECTION_WRONG_SIDE`/`STOP_SELECTION_INVALID_FORMAT`
            (a IA devolvendo um preço em vez de um ID) + `candidate_id=null` tratado como resposta
            válida (ponto 7 do item)
      - [x] `GenesisDecisionSchema.php` — campo `stop_selection` (objeto sempre presente,
            `candidate_id`/`rationale` nullable — mesma forma de `target_selection`, só 1 candidato
            em vez de até 3)
      - [x] `DecisionResponseValidator.php` — `StopSelectionValidator` wirado, mesma ordem que
            `target_selection` (depois da direção). **8 arquivos de teste precisaram do fixture novo**
            (`'stop_selection' => ['candidate_id' => null, 'rationale' => null]`, ao lado de todo
            `target_selection` já existente) — mesmo padrão de descoberta de escopo do item 9 (campo
            obrigatório novo quebra todo fixture que constrói uma decisão completa):
            `DecisionResponseValidatorTest.php` (+ construtor manual, ganhou `StopSelectionValidator`
            como 7º parâmetro), `GenesisDecisionSchemaD02Test.php`,
            `GraphicalAnalysisFullPipelineIntegrationTest.php`,
            `GraphicalAnalysisImageCleanupTest.php`, `GraphicalAnalysisOpenAiProviderFlowTest.php`,
            `GraphicalAnalysisAttemptJobTest.php` (2 fixtures) e `BenchmarkGenesisV69Test.php` (o
            decisor fake, que já tinha ganhado a correção de espaçamento do item 3). Os testes
            estruturais de schema (`GenesisDecisionSchemaOpenAiTest.php` — confere `required`==
            `properties` em toda a árvore, genérico, sem lista hardcoded de campos) passaram sem
            edição nenhuma. **29+ arquivos de teste rodados, tudo verde**, incluindo os dois
            historicamente flaky (`GraphicalAnalysisAttemptJobTest`/`FullPipelineIntegrationTest`,
            isolados — passaram limpo desta vez).
      - [x] `GenesisPrompt.php` — bloco "SELEÇÃO DE STOP (stop_selection)" novo, espelhando o de
            alvo: lado por direção, nunca inventa preço, `candidate_id=null` é resposta válida sem
            âncora que proteja esta entrada especificamente, interpretar qual nível protege — não é
            sempre o de maior peso. Teste novo, `GenesisPromptStopSelectionTest.php` (4 testes).
      - [x] `CanonicalBundleBuilder.php` — monta `bundle.stop_candidates` (dois lados, LONG=BELOW +
            SHORT=ABOVE, mesma solução de "candidatos dos dois lados antes de saber qual lado" que
            `target_candidates` já usa) ANTES da decisão, via `NiveisContratoBuilder` (mesma
            extração que `ExecutionPipelineService` usa depois) + `NivelService::candidatos()` para
            cada lado. `forStage2()` confirmado que já exclui (monta o pacote da Etapa 2 do zero).
      - [x] Fio até `AnalysisPersistenceService` — `decision['stop_selection']['candidate_id']`
            (já validado antes da decisão ser aceita) extraído e repassado pro `$stopCandidateId`
            de `ExecutionPipelineService::generate()` → `ExecucaoService::montar()` →
            `NivelService::stop()`, mesmo padrão de `$selectedTargetIds`.

      **Item 10 completo.** Verificação final: `tests/Unit` inteiro (710 testes, subiu de 687 com os
      novos desta fase) rodado depois de toda a fiação — **710/710 verde, zero falhas, zero erros.**
- [x] Teste novo: `tests/Unit/NivelServiceStopFinalAtrTest.php` (7 testes) — `NivelService::stop()`
      **nunca tinha teste unitário direto** (achado real, grep vazio antes desta fase). Cobre os 3
      pontos do "Como testar" do item 9 (2.50/3.80/4.80 ATR → normal/ampliado/rejeitado), o exemplo
      central do item 11 (âncora normal + buffer = stop ampliado) e o item 12 (buffer íntegro mesmo
      no cenário rejeitado).
- [x] **5 arquivos de teste pré-existentes corrigidos** (fixtures com âncora a 5-1000 ATR de
      distância — válidas sob o teto antigo em %, muito além do novo teto ampliado de 4,5 ATR;
      mesma classe de achado do `BenchmarkGenesisV69Test` na Fase 2, fixture desatualizada, não bug
      de produção): `NivelServiceE03Test.php` (3 dos 4 testes — o 4º, com 1 ATR de distância, não
      precisou; o teste do "piso do ATR muito baixo" precisou de um ATR maior, não só reaproximar a
      âncora — ver nota no próprio arquivo, o buffer mínimo por si só já excede o teto ampliado
      quando ATR fica abaixo de ~0,011 nesta combinação de preço/constantes, interação real entre o
      piso de pavio do item E03 e o teto do item 9, documentada, não contornada às pressas),
      `tests/Unit/Services/PlanoBServiceTest.php` (2 testes),
      `tests/Unit/Services/ExecucaoServiceCapitalMargemTest.php` (1 teste) e
      `tests/Unit/Services/PlanoBServiceRegressaoTest.php` (**29 dos 30 testes do arquivo** — os dois
      helpers compartilhados `planoBLong()`/`planoBShort()` tinham a mesma âncora a 5 ATR da entrada,
      então quase o arquivo inteiro dependia dela; corrigido num lugar só, os 29 voltaram a passar
      juntos). **`tests/Unit` completo (687 testes) rodado duas vezes — verde nas duas, 0 falhas, 0
      erros** — confirma que os 6 arquivos acima eram os únicos afetados pela mudança de % pra ATR.

## Fase 4 — Itens 14, 15 (tamanho zerado e risco zero) ✅ executada 01/09/2026

- [x] Item 15 — `calcularTamanhoSugerido()` (`ExecucaoService.php`): quando a quantidade arredondada
      pro stepSize fica abaixo do `minQty`, as 3 colunas oficiais (`nocional`/`risco_usd`/
      `quantidade_base`) saem `null` (antes saíam zeradas, só com um aviso de texto) e um bloco novo
      `lote_minimo_incompativel` expõe os 4 números do documento (quantidade calculada — pré-
      arredondamento, mínimo do contrato, risco planejado, risco se usasse o lote mínimo). Campo
      propagado pros dois planos (`candidate_setup` e `planoBCompleto`). Teste pré-existente que
      **esperava a quantidade zerada** (`test_d6_quantidade_abaixo_do_minqty_gera_aviso_sem_bloquear`)
      reescrito com os números corretos calculados à mão e conferidos batendo; teste novo confirma
      que o bloco sai `null` no caso normal.
- [x] Item 14 — `$riscoPreco` (`ExecucaoService.php`) trocado de `0.0` para `null` no ramo sem stop.
      **Achado real ao investigar**: os consumidores públicos (`risco_usd_estimado` via
      `$tamanhoA['risco_usd']`, já `null` desde a Fase anterior a este spec) já não vazavam esse
      zero — o `0.0` era código morto, nunca lido no caminho sem stop. Corrigido mesmo assim (a
      variável existia como uma armadilha esperando um consumidor futuro que confiasse nela sem
      saber que era um placeholder). Teste novo (`ExecucaoServiceStopUnavailableTest.php`) roda
      `ExecucaoService::montar()` inteiro com `STOP_UNAVAILABLE` de propósito e confere os 11 campos
      dependentes um a um — nenhum sai `0`, todos `null`; `capital_base_usd` (não depende do stop)
      continua um número real, confirmando que a análise técnica continua existindo (item 10, ponto 9).
- [x] Testes: 78 testes Unit relacionados a `ExecucaoService`/`PlanoBService`/`MotorExecucaoService`
      rodados juntos — verde.

## Fase 5 — Itens 19, 20 (tela alinhada com o gráfico do membro) ✅ item 19 executado 01/09/2026

## Fase 5 — Itens 19, 20 (tela alinhada com o gráfico do membro)

- [x] Item 19 — **achado central da fase**: o código atual (`MarketSnapshotService.php`) tinha uma
      correção deliberada e recente (comentário "A1 (V6.9)") que fazia exatamente o OPOSTO do que
      este item pede — misturava o candle vivo na série de cálculo de propósito, "pra bater com o
      TradingView". O item 19 reverte essa decisão especificamente, com uma prova concreta (a mesma
      mistura de séries é o que produz o "Hoje" do documento). Implementado como uma reversão
      documentada, não uma edição silenciosa: `calcular()` volta a rodar sobre `$candlesFechados`
      para todos os indicadores (EMA/RSI/MACD/ADX/ATR/CMF/Estocástico/CVD/Wyckoff/zonas/estrutura —
      a mesma lista que o comentário A1 já enumerava); `preco`/`preco_variacao_pct`/`preco_subindo`
      continuam vivos (uma segunda chamada a `calcular($candlesBrutos)`, só pra extrair esses 3
      campos — "variação da vela" é literalmente open/close da vela em formação, não dá pra vir de
      uma série fechada). `MarketStructureService::analyze()` e `CvdSeriesService::fromKlines()`
      também passam a receber candles fechados (`$precoVivo` continua chegando separado, já
      preparado desde H-48/H-49 pra isso). `collect()['candles']` (usado por entrada/stop/alvos/
      execução) continua sendo a série bruta — não muda.
      **Teste real contra a Binance ao vivo** (`A1CandleEmFormacaoTest.php`, reescrito — antes
      provava exatamente o comportamento que este item reverte): EMA21 do snapshot batendo com EMA21
      recalculada por fora só sobre candles fechados (desvio < 0,1%), preço/variação continuando
      vivos, candle_em_formacao continuando true, `collect()['candles']` continuando a série bruta.
      4/4 verde contra dado real. Mais 15 testes de arquivos adjacentes
      (`CandlesReuseTest`/`CvdDivergenceWiringTest`/`CvdTimeframeCoherenceTest`/
      `MarketSnapshotClosedCandlesTest`/`OpenInterestWindowTest`/`OrderBookWallsAvailabilityTest`/
      `MarketSnapshotPrecoSubindoNaJanelaTest`) + pipeline completo
      (`GraphicalAnalysisAttemptJobTest`/`GraphicalAnalysisFullPipelineIntegrationTest`/
      `BenchmarkGenesisV69Test`, este último também contra dado real) — todos verdes.
      **Teste de rollover nos 4 instantes** (`MarketSnapshotRolloverTest.php`, novo, 4 testes) —
      `candlesFechados()` (o filtro que separa as duas séries) testado via reflection com candles
      sintéticos cujo `close_time` é relativo ao `microtime()` real do teste (o filtro usa o relógio
      real do processo, não um relógio injetável): 1s antes do fechamento (vela ainda em formação,
      excluída), logo depois do fechamento (já conta como fechada), 15s depois (vela antiga fechada +
      vela nova de 14s excluída, sem misturar as duas) e confirmação de que o filtro não afeta a
      série bruta que o preço vivo usa. 4/4 verde — **item 19 completo.**
- [x] Item 20 — **já implementado, nenhuma ação de código.** `last_closed_candle_at` já existe na
      migration, no model, é preenchido pelo `MarketSnapshotService` e exposto no bundle/resposta
      pública, com teste próprio já verde (`MarketSnapshotClosedCandlesTest.php:63`). Só confirmar
      presença no aceite visual (Fase 1b).

**Verificação de fechamento das Fases 4-5**: `tests/Unit` completo, 712 testes (sem os 4 de
`MarketSnapshotRolloverTest.php`, criado depois desta rodada) — 712/712 verde, zero falhas, zero
erros. Segunda rodada, já com `MarketSnapshotRolloverTest.php` incluído: **716/716 verde, 1852
assertions, zero falhas, zero erros. Fases 4 e 5 fechadas.**

## Fase 6 — Itens 16, 17, 18 (liquidação e alavancagem) ✅ executada 01/09/2026

- [x] Item 16 — `MotorExecucaoService::calcularLiquidacao()` virou função pura (4 parâmetros,
      `$mm` sem valor padrão, nenhuma resolução de bracket própria) — bracket real é autoridade
      única em quem chama (`LiquidationCalculatorService` por nocional, `maiorAlavancagemSegura()`
      por alavancagem candidata). `mmPorBracket()` perdeu o parâmetro `$nocional` (ficou morto —
      único caller de verdade nunca o usava; a seleção por nocional real é 100% de
      `LiquidationCalculatorService::bracketPorNocional()` desde o pacote final). Grep por `0.005`
      no arquivo só acha comentários históricos (V6.5/E12, D2), nenhum caminho de cálculo.
- [x] Item 17 — `liquidation_classificacao` (`LIQ_ANTES_DO_STOP`/`LIQ_FOLGA_CURTA`) já existia; somado
      `distancia_stop_liquidacao_usd`/`_atr` (só quando SEGURO) e `perda_estimada_liquidacao_usd`
      (par de `risco_usd_estimado`, mesma fórmula) em `LiquidationCalculatorService::
      withStopVerification()`/`ExecucaoService::montar()`, Plano A e B. Validação de lado adverso
      documentada como garantida por construção (liquidação pela própria fórmula, stop pelo pool
      de `NivelService::candidatos()`, já side-aware desde o item 10) — comentário adicionado em
      `verificarSegurancaLiquidacao()`, sem checagem redundante em runtime.
- [x] Item 18 — `maiorAlavancagemSegura()` virou `?float`: `null` sempre que o bracket real não é
      confirmável (símbolo ausente ou API/credenciais indisponíveis), nunca mais aproxima com
      manutenção fixa. `NivelService::alavancagemSegura()` propaga o null (`excede_seguro=false`,
      `motivo=null` nesse caso) e o texto do aviso parou de chamar o número de "faixa segura"
      (proibido pelo item) — descreve o fato calculável.
- [x] Testes: reescritos `MotorExecucaoServiceE12Test`/`D2Test`/`D3Test` (testavam exatamente o
      fallback de 0,005 que o item apagou — D3 vira teste de assinatura, cobertura real de nocional
      já é de `LiquidationCalculatorServiceTest`), `NivelServiceE09E10Test` (bracket sintético via
      mock de `BinanceService`, novo teste do caminho sem bracket). Novos: 4 testes de distância
      stop×liquidação em `LiquidationCalculatorServiceTest`. `tests/Unit` completo: 733/733 verde.

## Fase 7 — Itens 4, 5, 6, 7, 13 (completam alvos e stop) ✅ executada 01/09/2026

- [x] Item 4 — como a seleção de alvo é 100% da IA nesta arquitetura (nenhum motor de desempate em
      PHP), o desempate virou instrução de prompt: "força estrutural é o critério principal...
      piso/teto elegibilidade, não critério... empate de força, mais próxima primeiro (parcial de
      segurança), mais distantes depois." Testado por conteúdo do prompt
      (`GenesisPromptTargetSelectionTest`), mesmo padrão do item 10.
- [x] Item 5 — já satisfeito pela arquitetura do pacote final: `TargetSelectionValidator` só aceita
      `count(ids) === min(3, disponíveis)`, `AlvoService::calcularAlvos()` nunca preenche por
      geometria (`tp2_motivo`/`tp3_motivo` quando ausente). Item fecha com um teste novo provando o
      cenário exato do doc (duas zonas válidas → TP1+TP2, TP3 ausente sem preço fabricado).
- [x] Item 6 — `TargetCandidateCatalog::PESOS['ema']` 5→0. EMA sozinha (sem nível estrutural na
      mesma região) não vira mais candidata; continua reforçando (confluência) quando colada a uma
      fonte real. `test_pdh_pdl_e_ema_...` (pré-existente) reescrito — assumia EMA sozinha válida,
      regressão real encontrada e corrigida durante a implementação.
- [x] Item 7 — `LiquidationMapService` injetado em `CanonicalBundleBuilder` (nunca dentro do
      catálogo — mesmo padrão de niveisContrato/stopCandidates, que já buscam dado antes de
      `build()`), best-effort (nunca bloqueia a análise). `TargetCandidateCatalog::build()` ganhou
      `$liquidationZones`, nova fonte `'liquidacao' => 0` no PESOS, piso de intensidade 0,70
      (`LIQUIDATION_CONFLUENCE_MIN_INTENSITY`). Docblock "desvio do documento" da Fase 6 do pacote
      final removido (não é mais desvio).
- [x] Item 13 — `NiveisContratoBuilder::build()` ganhou `estrutura_candidatos`/`tese_candidatos`
      (mesmo conteúdo de `tese`, separado — `tese` combinado continua intocado, alimentando o pool
      de stop). Novo `ExecucaoService::invalidacaoAdicional()`: candidato mais próximo do lado
      adverso da PRÓPRIA entrada de cada plano — Plano A e B podem divergir. 4 campos novos por
      plano (`invalidacao_estrutura_*`/`invalidacao_tese_*`), `null` quando ausente, nunca
      "indisponível". Achado real durante o teste: 'tese' tem o MAIOR peso do pool de stop
      (`NivelService::PESO_TIPO_ANCORA['tese']=10`) — um candidato de estrutura/tese perto o
      bastante pode virar a própria âncora do stop, então o teste isola os três com distâncias
      ATR diferentes (documentado no arquivo de teste, não é bug, é o pool funcionando certo).
- [x] Testes: `ExecucaoServiceInvalidacoesTest` (novo, 3 testes), `NiveisContratoBuilderTest` (+2),
      `AlvoServiceCalcularAlvosTest` (+1), `GenesisPromptTargetSelectionTest` (+1),
      `TargetCandidateCatalogTest` (+5, 1 reescrito). `tests/Unit` completo: 733/733 verde
      (mesma rodada da Fase 6, mudanças de ambas as fases juntas). `tests/Feature` completo:
      **160/160 verde, 682 assertions, 2 skipped (os 2 de sempre — AceiteVisualV69Test, gate
      D1/D2/GENESIS_RUN_VISUAL_ACCEPTANCE, ver Fase 1b), zero falhas.**

**Decisão de escopo (itens 17/18)**: os textos proibidos do item 17 ("você perde toda a margem" sem
cálculo, "movimento de um dia normal", adjetivos de conforto) e o texto público do item 18 não
existem hoje em nenhuma string gerada pelo backend (grep confirmado) — são responsabilidade de
prosa do FRONTEND (fora do escopo desta fase, que só lista arquivos backend nos itens 16-18). Os
dois campos numéricos novos (distância/perda) e a mudança de texto de `NivelService::motivo` (que
sim é backend) cobrem a parte deste repositório.

## Fase 8 — Itens 21, 22, 23, 24 (dados e tempo) ✅ executada 01/09/2026

- [x] Item 21 — `FreshnessPolicy::limits()`: `open_interest_history` deixou de ser teto fixo de 12h,
      agora 2× a granularidade real da série por timeframe (`oiHistoryGranularityMs()`, mesmo
      mapeamento de `MarketSnapshotService::oiPeriod()`, duplicado de propósito). `funding_history`
      continua fixo — cadência real da Binance (8h) não depende do timeframe do gráfico.
- [x] Item 22 — 3 constantes novas em `BinanceService` (`DATA_FETCH_MAX_ATTEMPTS=3`,
      `DATA_FETCH_RETRY_BACKOFF_MS=[250,500]`, `DATA_FETCH_TIMEOUT_SECONDS=5`), aplicadas no `get()`
      compartilhado (funding/OI/book/long-short/aggTrades/preço) e nas 3 chamadas HTTP fora dele
      (`getCandlesStrict` — realinhada, era 2 tentativas/500ms fixo — `getLeverageBrackets`,
      `exchangeInfoTodosSimbolos`). Parte de frontend (`oiLiquidationService.ts`) não tocada nesta
      fase. **Nota de 02/09/2026**: essa decisão de escopo (e a mesma repetida no item 29 abaixo)
      partiu de um engano meu — tratei "esta sessão vinha trabalhando só em `[API]`" como se fosse
      "sem acesso a `[FE]`", quando o workspace sempre teve os dois. Corrigido nos itens 34/36/38
      (Fase 10); este item 22 e o item 29 ainda não tiveram sua metade de frontend revisitada —
      pendente, perguntar ao Felipe antes de assumir que continua fora de escopo.
- [x] Item 23 — `visual.pattern_breakout` (novo item em `bundle.evidence`, papel DECISION): preço de
      rompimento da figura de maior confiança, já validado por
      `GeminiVisionService::normalizarPatterns()`, citável via `numeric_citations` (antes, um preço
      de rompimento citado sempre seria `UNACCOUNTED_NUMERIC_LITERAL` — `NarrativeFidelityGate` só
      resolve citação contra `bundle.evidence`, nunca contra `bundle.vision` direto). Coverage
      recalculada em `CanonicalBundleBuilder` pra incluir o item novo. `GenesisDecisionSchema.php`
      não precisou de mudança estrutural (`evidence_id` já era string livre, sem enum) — só
      comentário documentando o novo evidence_id válido.
- [x] Item 24 — em grande parte já satisfeito por construção (todo piso/teto/tolerância já é
      múltiplo de ATR, e ATR já é sempre da série do timeframe selecionado; tempos superiores já
      mapeados corretamente por timeframe desde B07/V6.5). Fechado com prova real ponta a ponta
      (rede real, BTCUSDT 15m vs 1d): ATR e teto absoluto de alvo diferem entre os dois.
- [x] Testes: `FreshnessPolicyTest` (novo, 3), `BinanceServiceRetryTest` (novo, 4, com sleep real de
      retry — sub-segundo), `CanonicalBundleBuilderPatternBreakoutTest` (novo, 4, reflection),
      `GenesisPromptPatternBreakoutTest` (novo, 2), `Item24TimeframeScalingTest` (novo, 1, rede
      real). `tests/Unit` completo: 746/746 verde (rodada antes das mudanças de item 25-29, linha
      de base confirmada). Nenhuma regressão nos testes de Binance/derivativos já existentes.

## Fase 9 — Itens 25, 26, 27, 28, 29 (derivativos e contexto) ✅ executada 01/09/2026 (todos os 5 itens)

- [x] Item 25 — `DerivativesReadingService::squeezeRisk()` reescrito: exige as 4 evidências mínimas
      simultâneas (funding esticado, OI subindo — `oiChanges.current > 0`, preço rompendo/perdendo
      nível — `abs(priceChangePctNaJanela) >= 0.5%` configurável, liquidez relevante do lado OPOSTO
      ao lado lotado — `orderBookWalls`, novo parâmetro de `ler()`). Novo campo `status`
      (`EVALUATED`/`NOT_EVALUATED`/`UNAVAILABLE`). `MarketSnapshotService::derivatives()` reordenado
      — `orderBookWalls()` agora roda ANTES de `derivativesReading->ler()` (antes vinha depois, só
      pra exibição). Cenário exato do doc (funding 0,08%, OI caindo 15%, preço lateral) testado e
      confirmado: squeeze não ativa.
- [x] Item 26 — `effect()`: `modifier` vira `null` (nunca mais `0` fabricado) quando funding E
      quadrante estão indisponíveis; campos aditivos `avaliado`/`aplicar_modificador` (`classification`
      mantido, contrato que `GenesisPrompt.php`/`DecisionStage2ResponseValidator` já liam). "Só
      funding"/"só Open Interest" já degradavam graciosamente por construção (squeeze e quadrante
      são independentes) — confirmado com 2 testes novos, não era bug. **Regressão real encontrada e
      corrigida na mesma fase**: `DecisionStage2ResponseValidator`'s comparação
      `$modifier !== $esperado['modifier']` comparava direto contra o novo `null`, rejeitando como
      mismatch uma resposta CORRETA da IA (que devolve 0 nesse caso, pela regra 6 do prompt) — corrigido
      pra `$modifier !== ($esperado['modifier'] ?? 0)`.
- [x] Item 27 — faixa morta `>3`/`<-3` removida de `effect()` (classificação por sinal: `>0`
      STRENGTHENS, `<0` WEAKENS, só `0` é NEUTRAL de verdade — testado com o cenário exato do doc,
      SHORT_COVERING+LONG produz modifier=-3 determinístico, agora WEAKENS em vez de NEUTRAL).
      `ScoreNarrativeBuilder`: achado real — a frase pública citava a pontuação interna entre
      parênteses ("Derivativos não alteram o cenário (-3 pontos)", o exemplo literal do doc,
      confirmado no código); removida do texto, o número continua auditável em
      `Analise::score_breakdown` (persistido), só não é mais narrado.
- [x] Item 28 — `GeminiContextService::systemPrompt()`: "NÃO atribui score" → "NÃO atribui score
      técnico" + frase explícita autorizando os scores de sentimento/macro pedidos linhas abaixo.
- [x] **Item 29 — D3 resolvida (AskUserQuestion, 01/09/2026): "restaurar agora, adaptada ao
      pipeline atual".** Investigação mudou o desenho: o `InformativeNarrativeService` recuperado
      via `git show 3ac66eb~1` NÃO fazia busca real nenhuma (só perguntava ao Gemini sem nenhuma
      fonte/ferramenta) — foi exatamente esse defeito que a V6.8 corrigiu ao criar
      `GeminiContextService` (grounding obrigatório via Radar News). Copiar o arquivo antigo cru
      teria REVERTIDO essa correção. Implementado em vez disso: ferramenta `google_search` real
      (mesma que `GeoEventService.php` já usa nesta base, grounding de verdade) religada na MESMA
      chamada de `GeminiContextService::collect()` — nunca uma segunda chamada — como fonte de
      grounding somada às notícias pré-verificadas do Radar News, não como substituto da disciplina
      anti-alucinação (o prompt continua proibindo qualquer afirmação sem fonte verificável — só
      deixou de ser exclusivamente a lista injetada). `responseMimeType`/`thinkingConfig` retirados
      desta chamada (combo com `tools` sem precedente testado nesta base; `GeoEventService`, único
      outro consumidor de `google_search` aqui, também não usa `responseMimeType` — segue o padrão
      já comprovado). **Comportamento real contra a API do Gemini não pôde ser verificado nesta
      sessão** (ambiente sem acesso à rede do Gemini, mesmo achado do spec
      `genesis-v6-8-openai-migration`) — coberto por testes com `Http::fake()`, mas o par
      grounding+JSON-sem-responseMimeType precisa de uma chamada real antes do aceite final.
      Escopo de tela (cards proporcionais, truncamento) é frontend — fora deste repositório
      backend, mesmo padrão de decisão do item 22.
- [x] Testes: `DerivativesReadingServiceTest` (+8, incl. o cenário exato do doc),
      `DecisionStage2ResponseValidatorTest` (+2, cobrindo a regressão encontrada),
      `ScoreNarrativeBuilderTest` (2 reescritos), `GeminiContextServicePromptContradictionTest`
      (novo, 4, item 28), `GeminiContextServiceGroundingTest` (novo, 5, item 29).
      `tests/Unit`/`tests/Feature` completos rodando (rodada final incluindo Fases 8+9 completas,
      item 29 incluso): **763/763 verde (Unit, 2006 assertions) + 161/161 verde (Feature, 687
      assertions, 2 skipped de sempre), zero falhas nas duas. Fases 8 e 9 fechadas por completo.**

## Fase 10 — Itens 30 a 40 (texto, tela e planos) ✅ executada por completo 01-02/09/2026 ([API] + [FE])

**Nota sobre o escopo**: a primeira passagem desta fase (01/09) tratou 34/36/38 como "fora deste
repositório backend", repetindo o mesmo padrão de decisão dos itens 17/18/22/29. Isso era um engano
— o `[FE]` está no mesmo workspace desta sessão, com acesso completo de leitura/escrita; "esta sessão
vinha trabalhando só no backend" nunca significou "sem acesso ao frontend". O Felipe apontou o erro
no mesmo dia e os três itens foram executados logo em seguida — ver os itens 34/36/38 abaixo pro
resultado real.

- [x] Item 30 — `PublishedOutputGate`/`PublicVocabularyService` passam a cobrir `technical_analysis`
      (antes só whitespace) e os textos por plano (`motivo`, `microanalise.risk_factors`) — antes só
      macro/sentimento/score_description (item 13.5 do pacote final) passavam pelos dois. Novo
      helper `AnalysisPersistenceService::publicarTexto()`. **Achado real**: `AnalisePlano::microanalise`
      (coluna `text`) nunca tinha `$casts['microanalise'] = 'array'` — qualquer array real gravado
      quebrava a query com "Array to string conversion"; corrigido (nenhum consumidor lia o campo
      ainda, por isso nunca foi percebido). `avisos`/`target_details`/Plano B `descricao` ficam fora
      desta rodada (avisos são strings hardcoded do PHP, nunca interpoladas com dado cru — risco
      nulo; descricao ganhou seu próprio achado real, ver item 40).
- [x] Item 31 — confluências (`TargetCandidateCatalog::rotulo()`) e chaves de frescor
      (`ScoreFinalizer::avaliarQualidade()`) traduzidas pelo mesmo tradutor da fonte primária — antes
      "coincide com pdh_pdl e hvn" e "Dados desatualizados... em: open_interest_history" vazavam
      cru.
- [x] Item 32 — resolvido sem precisar de decisão de design: `structure.event.type` já carrega a
      direção no próprio sufixo (`_UP`/`_DOWN`, confirmado em `MarketStructureService::latestBreakEvent()`),
      só precisava ser traduzido, não inferido. Novo `AnalysisPersistenceService::structureEventParaGate()`
      — só ativa quando `confirmed===true` (evento não confirmado nunca entra na checagem, nem pra
      aprovar nem pra reprovar), wirado em `resumo_analise`/`technical_analysis`. `score_description`
      continua sem essa checagem (nunca produz esse tipo de frase, `ScoreNarrativeBuilder` é
      templated, grep confirmado).
- [x] Item 33 — nova regra de prompt (`GenesisPrompt::system()`): BOS/CHOCH só pode ser citado como
      fato consumado enquanto o rompimento não tiver sido desfeito (o preço não voltou a cruzar o
      nível) — nunca projeta continuidade. Backstop de código é o item 32 acima. **Achado real**: a
      primeira redação usava a palavra "confirmed"/"confirmado" na explicação — quebrava
      `GenesisPromptContractTest` (o próprio radical banido reaparecendo em prosa do prompt,
      reproduzindo o bug P0-02); reescrita sem o radical, pega pela suíte completa antes do commit.
- [x] Item 34 — **retomado 02/09/2026** (achado do Felipe: o `[FE]` está no mesmo workspace, nunca
      foi "fora de alcance" de verdade — correção do meu próprio engano de escopo). Backend (gate
      dos itens 30/31) já cobria vazamento de código interno por STRING; o que faltava era a
      RENDERIZAÇÃO condicional. `NivelService::stop()` ganhou um sinal novo (`$ancoraEscolhidaPelaIa`,
      só true quando o `candidate_id` de `stop_selection` — item 10 — foi de fato usado) pra
      distinguir os dois textos que o documento pede: `stop_motivo` (backend) agora traz o texto
      "fallback estrutural" quando o stop é válido mas veio do sistema automático (nunca da escolha
      específica da IA), e `null` quando veio da escolha da IA (nada a avisar). Texto de stop
      indisponível trocado pro literal exato do documento (nenhum teste tinha asserção sobre o
      texto antigo, grep confirmado nos dois repositórios). `AnalysisResult.tsx`: bloco novo
      renderiza `stop_motivo` mesmo com stop VÁLIDO (antes só era lido no ramo STOP_UNAVAILABLE);
      texto de fallback local do frontend alinhado ao literal do backend. Teste estático novo
      (`noInternalCodeInPublicUi.test.ts`, mesmo padrão de `forbiddenProductionCode.test.ts` já
      existente no repo) — confirma que `candidate_id`/`error_code`/`reason_code` nunca aparecem em
      código do componente, e que códigos de estado internos (`STOP_UNAVAILABLE` etc.) só aparecem
      como lado de uma comparação, nunca soltos.
- [x] Item 35 — **backend + frontend, ambos fechados**. Backend: aviso de nocional abaixo do
      mínimo do contrato tinha `number_format(...,',','.')` (formato pt-BR) embutido na frase —
      removido, valores puros movidos pra `nocional_minimo_incompativel` (mesmo padrão do
      `lote_minimo_incompativel` do item 15). **Achado real, bônus**: `ExecucaoService::formatarPreco()`
      era dead code (zero chamadores em produção, só existia pra 2 testes via reflection que
      provavam exatamente o formato pt-BR que este item proíbe) — removido junto dos 2 testes.
      Frontend: `AnalysisResult.tsx:997` (ATR, `toFixed(4)` cru) trocado pelo formatador canônico
      já existente no projeto (`utils/canonicalMoney.ts`, criado num pacote anterior — item 11.7 do
      pacote final, já usado em entrada/stop/TPs, só não tinha chegado ao ATR).
- [x] Item 36 — **retomado 02/09/2026**, faltava até na própria lista deste arquivo (achado ao
      revisar depois da correção de escopo). Chip de confluência temporal (`AnalysisResult.tsx`,
      "CONFLUÊNCIA TEMPORAL") mostrava `tf.timeframe` cru com CSS `uppercase` — "1M" (mês) fica
      visualmente idêntico a "1m" (minuto) depois da transformação. Novo `rotularTimeframe()`
      (`utils/rotulos.ts`, mesmo arquivo/padrão de `rotularFonte()`/`rotularComponenteBuffer()`)
      expande só os dois códigos ambíguos ("1M"→Mensal, "1w"→Semanal); o resto (15m/1h/4h/1d...)
      não muda, nunca colide com outra unidade. Comparação de "1M" feita ANTES do `toLowerCase()`
      pra nunca confundir com "1m" de minuto. Teste novo `rotulos.test.ts` (6 casos).
- [x] Item 37 — funding nunca afirma maioria de contratos: nova regra em `GenesisPrompt::systemStage2()`
      (custo/lotação relativa, nunca contagem de compradores/vendedores) + backstop de código em
      `PublishedOutputGate` (`FUNDING_MAIORIA_DE_CONTRATOS`, mesma doutrina de defesa em
      profundidade do resto do gate).
- [x] Item 38 — **retomado 02/09/2026**. Achado real: já existia um componente de ícone real e
      completo (`AssetBadge.tsx`, busca o logo real via `coincap.io`, cai num monograma de 2 letras
      se a imagem falhar — construído na V6.5, itens G12-G13, "DET-7 do PO") e já era usado no
      cabeçalho principal da tela (`AnalysisResult.tsx`, Action Bar). O item 38 não precisava de
      componente novo — só uma SEGUNDA ocorrência do nome do ativo, dentro do bloco "CAMADA 1:
      DECISÃO RÁPIDA", que nunca tinha sido migrada pro `AssetBadge` (ficou como texto puro,
      exatamente a linha que a Fase 0 deste spec citou). Corrigido — mesmo componente, tamanho `sm`.
- [x] Item 39 — `PlanoBService::zonaEstrutural()` reescrito: nunca mais deriva uma borda de
      `precoAtual × 0,999/1,001` — sem uma segunda barreira real do catálogo entre a entrada e o
      preço atual, a zona colapsa pra um NÍVEL (zona_de === zona_ate === a própria entrada, um
      número real). `ExecucaoService::montar()`: avisos separados por plano
      (`$avisosA`/`$avisosB`/`$avisosComuns`), cada plano com seu próprio campo `avisos`
      deduplicado; `execution.avisos` legado continua existindo, agora deduplicado (fecha o exemplo
      literal do documento — "os dois deram tamanho zero... a tela imprimiu quatro linhas"). **2
      achados reais**: o aviso de alavancagem do Plano B nunca era acrescentado a lista nenhuma
      antes desta correção (só o do Plano A chegava a algum lugar); `PlanoBService::gerar()` nunca
      devolvia o `aviso` de distância do próprio stop do Plano B (só `stop_status`/`stop_ancora`/
      `stop_buffer`/`stop_motivo` — o aviso de distância existia, só nunca saía do método).
- [x] Item 40 — construído por completo (decisão do Felipe via AskUserQuestion: "construir agora",
      não adiar). **Achado real ao investigar**: `PlanoBService::descricao()` escrevia a palavra crua
      "LONG"/"SHORT" numa frase pública (`'reforçando a entrada em '.($isShort?'SHORT':'LONG')`) —
      exatamente o que `GenesisPrompt`/`PublicVocabularyService` proíbem em toda narrativa da IA, só
      que esta é composta pelo backend e nunca passava por nenhum dos dois filtros; corrigido pra
      "reforçando esta direção". Feature nova: dois campos no schema de decisão da Etapa 1 —
      `plan_a_risk_notes` (riscos de entrar a mercado agora, nullable — "quando existirem") e
      `plan_b_entry_notes` (o que precisa acontecer antes da entrada do Plano B, contextual, nunca
      uma regra universal) — a IA escreve os dois na MESMA chamada que já decide direção/score
      (nunca uma chamada extra). Novo `DecisionResponseValidator::validarNotaPorPlano()` (nullable de
      propósito — ausência é resposta válida, por isso NÃO entram no `$required` deste validador,
      só no schema JSON enviado à API; mesmas proibições de conteúdo de technical_analysis/
      score_description: radical CONFIRM e sinônimos, LONG/SHORT, spot/à vista, formato monetário).
      Prompt novo com exemplos de linguagem ADAPTADOS dos exemplos literais do documento (vários
      continham o radical CONFIRM ou sinônimos já banidos — ex. "confirmação de reteste"/"confirmação
      de sustentação" — reescritos preservando a intenção, nunca copiados cru). Persistência: migration
      nova (`2026_09_02_000000`, coluna `entry_notes` em `genesis_analise_planos`, nullable) +
      `AnalysisPersistenceService::computeAttributes()` mescla as duas notas da decisão em
      `execution.planos[]` por letra do plano, `planoRow()` aplica o mesmo gate/vocabulário do item
      30. **Achado real durante os testes**: nomear o campo `plan_b_confirmation_notes` (nome
      original) fazia o próprio PROMPT reintroduzir o radical CONFIRM em prosa (a referência ao nome
      do campo) — renomeado pra `plan_b_entry_notes` antes de qualquer coisa depender do nome antigo.
- [x] Testes `[API]`: `TargetCandidateCatalogTest`/`ScoreFinalizerTest` (+confluência/frescor
      traduzidos, item 31), `PublishedOutputGateTest` (+3, item 37), `PlanoBServiceTest`/
      `PlanoBServiceRegressaoTest` (+3 novos, vários reescritos, itens 39/40), `ExecucaoServiceD6D7Test`
      (+1, item 35), `ExecucaoServiceAvisosPorPlanoTest` (novo, item 39), `ExecucaoServiceRrPorAlvoTest`
      (-2, dead code removido junto do método, item 35), `AnalysisPersistenceServiceGateTest` (novo,
      5, itens 30/32), `AnalysisPersistenceServiceEntryNotesTest` (novo, 2, item 40 ponta a ponta),
      `GenesisPromptChochConfirmadoTest` (novo, 2, item 33), `GenesisPromptContractTest` (+1 par de
      asserções, cobre o achado real do item 33), `DecisionResponseValidatorTest` (+7, item 40),
      `AcentuacaoTextosTest` (achado real do item 40 corrigido), `NivelServiceStopFinalAtrTest` (+1,
      item 34), `NivelServiceStopCandidateSelectionTest` (+3, item 34). `tests/Unit` completo:
      **789/789 verde, 2080 assertions, zero falhas.**
- [x] Testes `[FE]`: `rotulos.test.ts` (novo, 6, item 36), `noInternalCodeInPublicUi.test.ts` (novo,
      2, item 34, mesmo padrão de `forbiddenProductionCode.test.ts` já existente no repo). Os 6
      arquivos diretamente relevantes aos itens 34/35/36/38 rodados juntos: **35/35 verde.** Suíte
      `[FE]` completa tem 28 falhas pré-existentes fora do escopo desta spec (ver Fase 11 pro
      detalhe e a confirmação via `git stash`).

## Fase 11 — Fechamento ✅ conferida 02/09/2026, revisada no mesmo dia depois da correção de escopo (itens 34/36/38 executados)

**Nota sobre o escopo backend-only**: a primeira passagem desta fase tinha itens 34/36/38 marcados
como "fora deste repositório" — engano meu, não uma limitação real. O `[FE]`
(`c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main`) sempre esteve neste mesmo workspace,
com leitura e escrita completas; eu tratei "esta sessão trabalhou só no backend até agora" como se
fosse "não tenho acesso ao frontend", o que nunca foi verdade. O Felipe corrigiu isso e os três
itens foram executados na mesma sessão — ver Fase 10 acima para o detalhe de cada um.

- [x] Suíte completa roda do início ao fim. **`[API]`: 789/789 `tests/Unit` (2080 assertions) +
      161/161 `tests/Feature`, zero falhas reais, 2 skipped (os de sempre — `AceiteVisualV69Test`,
      gate D1/D2/`GENESIS_RUN_VISUAL_ACCEPTANCE`, ver Fase 1b). `[FE]`: 6 arquivos/35 testes
      diretamente relevantes aos itens 34/35/36/38 (`canonicalMoney`, `publicVocabulary`, `rotulos`
      novo, `noInternalCodeInPublicUi` novo, `forbiddenProductionCode`, `analysisResultNarrative`)
      100% verdes.** A rodada combinada `[API]` (`tests/Unit tests/Feature` juntos) mostrou 10
      falhas em `GraphicalAnalysisAttemptJobTest`/`GraphicalAnalysisFullPipelineIntegrationTest` —
      mesmo padrão documentado desde a Fase 2 desta spec (o `php.exe` permanente desta máquina
      disputa recurso com a suíte, status esperado `COMPLETED`/`FAILED`/`REJECTED_IMAGE` vem
      `PENDING` em teste de fila assíncrona). Confirmado de novo, não é regressão: os dois arquivos
      isolados (`--filter`, sem concorrência) rodaram 100% verdes duas vezes seguidas. A suíte `[FE]`
      completa (`npx vitest run`, todos os arquivos) tem **28 falhas pré-existentes, em arquivos que
      esta spec nunca tocou** (`bugConditionExploration.property.test.ts`,
      `emaCandle-bugCondition.exploration.test.ts`, `infrastructure.preservation.test.ts`,
      `integration.e2e.test.ts`, `geminiService.test.ts` — testes de propriedade escritos
      deliberadamente pra provar bugs *ainda não corrigidos* noutros módulos: scanner de
      oportunidades, worker de alertas Radar/SSE, sanitização de símbolo, fallback de EMA; fora do
      escopo dos 41 itens). Confirmado via `git stash` dos dois arquivos que toquei
      (`AnalysisResult.tsx`/`utils/rotulos.ts`) — as mesmas 28 falhas persistem sem minhas mudanças,
      não são causadas por elas. Nenhum caminho absoluto de máquina local no código de teste (grep
      confirmado nos dois repositórios, só sobra em `tests/Proof/_archive_v4_3_r3_2/*.md/*.txt`,
      registro histórico de um spec antigo, não código).
- [x] Checklist do protocolo de teste (`GENESIS_V6_9_ORIENTACOES_TESTE_FELIPE.md`, seção "Checklist
      antes de entregar") conferido item a item:
      - [x] `assertTrue(true)` apagado (Fase 1a)
      - [x] Imagens de aceite versionadas no repositório — presentes no working tree
            (`tests/Proof/v69/fixtures/{BTC,ENA}USDT.P.png`), **ainda não commitadas** (aguardando
            pedido explícito do Felipe, mesma decisão da Fase 1b)
      - [x] Nenhum caminho absoluto de máquina local no código de teste
      - [x] Os 17 comportamentos da tabela têm teste unitário — conferido um a um: piso de alvo
            (`TargetCandidateCatalogTest`), teto de alvo (idem), espaçamento entre alvos
            (`TargetSelectionValidatorTest`), segunda validação (idem), origem EMA proibida
            (`TargetCandidateCatalogTest`), teto de stop normal/ampliado/rejeitado
            (`NivelServiceStopFinalAtrTest`), buffer íntegro (idem), ausência vs. zero
            (`ExecucaoServiceStopUnavailableTest`+outros), lote mínimo (`ExecucaoServiceD6D7Test`),
            tickSize (`PriceNormalizerTest`), retry/backoff/timeout (`BinanceServiceRetryTest`),
            frescor por timeframe (`FreshnessPolicyTest`), degradação parcial de derivativos
            (`DerivativesReadingServiceTest`), modificador null (idem), catálogo das 50 figuras
            (`GenesisVisualCatalogV6ViesTest`/`GeminiVisionServiceTest`), rollover de vela
            (`MarketSnapshotRolloverTest`), contradição factual não publicada
            (`AnalysisPersistenceServiceGateTest`, item 32, fechado nesta fase)
      - [ ] **Pendente do Felipe**: aceite do BTCUSDT roda e passa — precisa de
            `GENESIS_RUN_VISUAL_ACCEPTANCE=true` (gasta crédito real de API), Fase 1b nunca rodou
      - [ ] **Pendente do Felipe**: aceite do ENAUSDT roda e passa — mesmo motivo
      - [x] A suíte inteira roda do início ao fim sem falha real (ver acima, com os skips conhecidos)
      - [~] **Sentimento do Ativo traz conteúdo próprio** — implementado (item 29, busca real via
            `google_search`), coberto por `Http::fake()`, mas **nunca verificado contra a API real
            do Gemini** (ambiente sem acesso a essa rede) — mesma ressalva já registrada na Fase 9
      - [~] **Macro e Geopolítico traz conteúdo próprio** — mesmo item 29, mesma ressalva acima
      - [ ] **Cards mantêm proporção com o resto da tela** — proporção/layout visual de verdade
            (medição de pixels/breakpoints) não foi conferida; os itens de CONTEÚDO desses cards
            (34/38, texto/ícone) foram
      - [x] Nenhum código interno aparece em texto público — **backend e frontend agora, ambos
            fechados** (itens 30/31/32/34/37: `PublishedOutputGate` cobre technical_analysis/
            motivo/microanálise/notas por plano/confluências/chaves de frescor; frontend —
            `noInternalCodeInPublicUi.test.ts`, novo — confirma que `AnalysisResult.tsx` nunca
            renderiza `candidate_id`/`error_code`/`reason_code`/código de estado solto)
      - [x] Um único formato monetário — **backend e frontend, ambos fechados** (item 35:
            `number_format` pt-BR removido do backend, `formatarPreco()` morto removido; ATR do
            frontend migrado pro formatador canônico único que o resto da tela já usava)
      - [x] Nenhum campo numérico sai zerado por ausência de dado (itens 14/15/26, fases anteriores,
            reconfirmado sem regressão pela suíte completa)
      - [x] O código entregue é o mesmo que rodou na suíte (`git status` conferido nos dois
            repositórios — só os arquivos dentro do escopo dos 41 itens, nada avulso)
      - [x] Nenhum item foi desviado sem aprovação prévia — D1-D4 resolvidas, item 40 resolvido via
            `AskUserQuestion` explícito. O único desvio real (tratar 34/36/38 como fora de escopo
            sem perguntar) foi corrigido na mesma sessão assim que o Felipe apontou o engano — não
            ficou sem resolução.
- [ ] Tabela "O RESULTADO NA TELA DO BTCUSDT" do documento técnico conferida campo a campo — **bloqueada
      pela Fase 1b** (precisa da execução real), não conferida nesta sessão.

### Decisões pendentes do Felipe (fecham a spec por completo)

1. **Fase 1b (aceite visual)** — rodar de verdade custa crédito de API real; só com pedido explícito
   (`GENESIS_RUN_VISUAL_ACCEPTANCE=true`).
2. **Commit** das duas imagens de aceite (`tests/Proof/v69/fixtures/*.png`, `[FE]`) e de todo o
   trabalho desta spec nos dois repositórios — nada foi commitado ainda, tudo está no working tree.
3. **Verificação ao vivo do item 29** (busca real via `google_search` contra a API real do Gemini,
   já que este ambiente não alcança essa rede) — rodar uma análise real antes de confiar no grounding
   em produção.
4. **Proporção visual de verdade dos cards** (item 34/38 parcialmente cobrem conteúdo, não medição
   de layout) — precisa de revisão visual humana ou de um teste de screenshot, nenhum dos dois
   coberto nesta sessão.

**Fase 1b pode fechar em sessão separada, depois de tudo o mais** — ela não bloqueia nenhuma fase
2-10 (é só o teste de ponta a ponta, não código de produto), então "spec completo" e "aceite visual
completo" podem ser dois marcos diferentes se o Felipe preferir.

**Estado da spec ao fechar esta fase**: 40 dos 41 itens implementados e testados — só falta a
execução real da Fase 1b (itens 5/6 do checklist acima). `[API]`: nada commitado ainda (`git log`
confirma — o commit mais recente continua sendo `85da85e`/pacote-final), todo o trabalho das Fases
0-11 está no working tree. `[FE]`: só `components/AnalysisResult.tsx` e `utils/rotulos.ts` mudaram
(itens 34/36/38), também não commitados.

---

## Riscos e observações

- **Ordem importa mais do que nos specs anteriores.** O próprio documento amarra a ordem de execução
  a dependências reais (ex.: Fase 4 dimensionamento depende da Fase 3 ter um stop confiável; Fase 6
  alavancagem depende da Fase 6 liquidação usar bracket real). As fases acima seguem exatamente a
  tabela "ORDEM DE EXECUÇÃO" do documento técnico — não reordenar sem revisar as dependências
  descritas item a item.
- **Item 29 é o único que precisa de escopo de produto, não só código** — sem D3 resolvida, o risco
  é reimplementar busca própria com uma fonte/formato diferente do que o Fabrício tem em mente e
  descobrir isso só no aceite visual.
- **Item 41 é simultaneamente o primeiro (regra 1) e o último a fechar de verdade** — cada fase
  seguinte adiciona suas próprias asserções a ele; só fecha "pronto" na Fase 11.
- **Nenhum item deste spec toca `server.ts`/`routes/api.js`, `OkxService`/`BybitService`/
  `BitgetService`, nem o modelo de decisão (`gemini-3.7-flash`)** — mesmas exclusões que o
  `pacote-final` já tinha registrado, e nada nos 41 itens contradiz isso.
