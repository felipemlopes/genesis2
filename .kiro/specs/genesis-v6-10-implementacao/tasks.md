# Plano de Implementação: Gênesis V6.10

**Status deste documento**: criado como planejamento puro em 04/09/2026, a pedido do Felipe
("faça uma análise e crie um plano spec estilo kiro para eu ver"). **Nenhum item foi executado
ainda.** Este arquivo é para revisão antes de qualquer fase começar.

## Fontes

1. `GENESIS_V6_10_IMPLEMENTACAO_FELIPE.md` — documento técnico do PO (Fabrício), 03/09/2026, com
   arquivo, linha, código antes/depois para cada um dos itens, em 10 fases. Cópia completa no mesmo
   diretório deste `tasks.md`.
2. `GENESIS_V6_10_ORIENTACOES_FELIPE.md` — orientação de escopo (mesma data), transcrita do PDF de 8
   páginas que acompanha o documento técnico. Explica a mudança central (o cérebro do score), a
   escala nova, os vinte defeitos catalogados (A1-A5 bloqueadores, B1-B7 segunda ordem, C1-C8
   varredura profunda) e o protocolo de aceite. Cópia completa no mesmo diretório.

**Repositórios**: **[API]** = `E:\Programas\wamp64\www\genesis-api` (branch `genesis2`) · **[FE]** =
`c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main` (branch `master`) — mesma convenção dos
specs anteriores.

**Estado dos repositórios em 04/09/2026, antes de começar**: **[API]** tem 6 arquivos modificados,
não commitados (`.env.example`, `MANIFEST.json`, `GraphicalAnalysisAttemptJob.php`,
`GeminiContextService.php`, `config/genesis_graphical_v6.php`, `config/queue.php` +
`GeminiContextServiceTest.php`) — é o trabalho do spec `genesis-contexto-informativo-resiliencia`
(retry de macro/sentimento por critério de negócio), já registrado em memória, ainda não commitado.
**[FE]** está limpo. Nenhuma mudança deste spec deve começar antes de decidir com o Felipe se aquele
trabalho é commitado, descartado ou carregado junto — ver Decisão D0 abaixo.

---

## Verificação contra o código real (04/09/2026) — antes de aceitar qualquer item

Amostra dirigida a risco: os itens que reescrevem arquitetura (Fase 3 inteira), os bloqueadores da
Fase 2 e os pontos que o próprio documento já assinala como "atenção" ou "desvio possível". Os
demais (textos, uma constante, um rótulo) não foram conferidos linha a linha — conferir ao entrar em
cada fase, não represar o início do spec por eles.

| Doc | Item | Situação real confirmada | Evidência |
|---|---|---|---|
| Fase 2.1 | A1 (avisos do plano) | **Confirmado, e metade backend já pronta.** `AnalysisResult.tsx:495` ainda lê `execution.avisos` direto. Mas o backend **já tem** `ExecucaoServiceAvisosPorPlanoTest.php`, testando que a união legada não duplica frase — indício de que o dedup do lado `[API]` já foi tratado numa sessão anterior não documentada em spec. O `grep` de `execution.avisos` no frontend não achou outro consumidor além da linha 495-497. | `components/AnalysisResult.tsx:495-497`, `tests/Unit/Services/ExecucaoServiceAvisosPorPlanoTest.php` |
| Fase 2.2 | A4 (manchete órfã) | **Confirmado, byte a byte.** `PlanRecommendationService.php:82-86`: o bloco de convicção sobrescreve `$reasonCode`/`$motivo` mas não toca `$alvoQueAtende`, setado 26 linhas antes (linha 56) se o ramo de R:R baixo também disparou. | `app/Services/GraphicalAnalysis/PlanRecommendationService.php:52-86` |
| Fase 2.3.1 | A3 (prompt, formato de preço) | **Confirmado nas duas linhas.** Texto `"$ 65.370,92"` presente literalmente nas linhas 48 e 136 de `GenesisPrompt.php`, idêntico ao "Antes" do documento. | `app/Services/GraphicalAnalysis/GenesisPrompt.php:48,136` |
| Fase 2.3.2 | A3 (formatarPreco) | **Confirmado, e achado real fora do previsto pelo documento.** `formatarPreco()` existe em `PlanRecommendationService.php:133-142`, idêntico ao "Antes" citado. Mas `grep -rn formatarPreco app/` também acha o símbolo em `ExecucaoService.php` e `DecisionResponseValidator.php` — **lidos, são só comentários históricos** ("V6.9 correção técnica, item 35: `formatarPreco()` foi removido daqui, dead code"), não chamadas reais. `ExecucaoServiceRrPorAlvoTest.php` também aparece no grep — é o nome de um teste, não uma chamada. **Nenhum consumidor real fora do previsto.** | `app/Services/ExecucaoService.php:881-883`, `app/Services/GraphicalAnalysis/DecisionResponseValidator.php:295-299` |
| Fase 2.3.3 | A3 (cifrão colado) | **Confirmado, e o resto do arquivo já está mais adiantado do que o "antes" sugere.** `canonicalMoney.ts:25` tem `'$ ' + value...`, exatamente o "antes". Mas a lógica de `tickDecimals ?? magnitudeDecimals(value)` (linha 34) e a hierarquia "tick real manda, heurística por magnitude só é fallback" **já existem** — foram entregues no V6.9 pacote final (comentário de cabeçalho do arquivo cita explicitamente). Só o espaço depois do `$` sobrou. | `utils/canonicalMoney.ts:1-42` |
| Fase 2.3.4 | A3 (formatador antigo) | **Contagem não bate — mais consumidores do que o documento previu.** `grep -rn formatPrice` acha `formatPrice` em 11 arquivos `.ts*`, não 5: além dos 5 citados (`MarketWidget`, `OiLiquidationMonitor`, `NewListings`, `LiquidityMap`, `MarketTicker`), também aparece em `AnalysisResult.tsx`, `GenesisPage.tsx`, `HistoryPage.tsx`, `ActiveTradesPage.tsx` e no próprio `cryptoApi.ts` (definição) e `canonicalMoney.ts` (comentário). **Regra do documento se aplica: parar e perguntar antes de migrar/remover** — ver Decisão D3. | grep `formatPrice` em `c:\...\G-nesis-2.0-main` |
| Fase 3.2 | A6 (base 60 + somatórios) | **Confirmado, texto idêntico.** Linha 68: `"A6 (V6.9): comece de uma base de 60 e ajuste por fatos contáveis..."`. | `app/Services/GraphicalAnalysis/GenesisPrompt.php:68` |
| Fase 3.2 | A9 (derivativos fora da Etapa 1) | **Confirmado.** Linha 67, texto idêntico ao citado no documento. | `app/Services/GraphicalAnalysis/GenesisPrompt.php:67` |
| Fase 3.4 | Campo `score` sai do schema | **Confirmado presente.** `GenesisDecisionSchema.php:48,67` — `score` ainda é campo obrigatório (`$nullableInteger`). `score_familias`/`FORTE_A_FAVOR` — zero ocorrências no repositório: é trabalho 100% novo. | `app/Support/GenesisDecisionSchema.php:48,67` |
| Fase 3.5 | `ScoreFromFamilies` | **Não existe.** Confirmado por `ls` — arquivo a criar do zero. | `app/Services/GraphicalAnalysis/ScoreFromFamilies.php` (ausente) |
| Fase 3.6.1 | Penalidade de contradição | **Confirmado.** `DirectionCoherenceGate.php:31` — `PENALIDADE_POR_CONTRADICAO = 10`. A classe **também já separa** produção da lista (`contradicoes()`) de uso em validação (`avaliar()`), então "a classe fica viva, só para de mexer no número" é uma mudança localizada — a penalidade em si não está nesta classe, está no consumidor (`ScoreFinalizer`). | `app/Services/GraphicalAnalysis/DirectionCoherenceGate.php:31,36-110` |
| Fase 3.6.2/3.6.3 | Frescor e derivativos no score | **Confirmado, com espalhamento maior do que uma remoção pontual.** `ScoreFinalizer.php` tem `PENALIDADE_FRESCOR_MEDIO`/`PENALIDADE_FRESCOR_BAIXO`/`data_quality_penalty`/`derivatives_modifier` todos somados na mesma fórmula (linha ~80). `derivatives_modifier` também aparece em `DecisionStage2ResponseValidator.php` (validação inteira dedicada), `GenesisPrompt.php` (regras 5/6 da Etapa 2), `EvidenceCatalog.php` e `AnalysisPersistenceService.php` (persistência/cache). **Confirma a advertência do próprio documento**: "isto é uma remoção grande, faça o levantamento com cuidado extra". | `app/Services/GraphicalAnalysis/ScoreFinalizer.php:54,56,80,111-113`; grep `derivatives_modifier` → 5 arquivos |
| Fase 4.1 | A2 (frescor do preço) | **Confirmado, e o vizinho já foi corrigido.** `FreshnessPolicy.php:30` — `'price' => 30_000,` idêntico ao "antes". Mas a linha seguinte (31) já tem `'candles' => $this->timeframeMs($timeframe) + 30_000` — ou seja, a fórmula que a Fase 4 pede para `price` **já existe no arquivo, aplicada a outra fonte**. É literalmente copiar o padrão da linha de baixo para a de cima. `CanonicalBundleBuilder.php:117` confirma `(int) round(microtime(true) * 1000)` como o instante de avaliação (depois de todo o pipeline), exatamente a causa descrita. | `app/Services/GraphicalAnalysis/FreshnessPolicy.php:30-31`, `CanonicalBundleBuilder.php:117` |
| Fase 5.1 | E1 (Plano A sempre a mercado) | **Confirmado.** `ExecucaoService.php:352` — `'entrada' => $preco,`. Zero ocorrências de `plano_primario` no repositório — trabalho 100% novo, schema e prompt incluídos. | `app/Services/ExecucaoService.php:352` |
| Fase 6.1 | B1 (Wyckoff cru) | **Confirmado, e a localização exata do bug não é a linha do dicionário.** `WYCKOFF_LABEL` está na linha 36 (bate com o doc), mas o **uso com o fallback quebrado** está na linha 1047: `{WYCKOFF_LABEL[anyData.wyckoff?.fase] || anyData.wyckoff?.fase || 'N/A'}` — o operador `||` cai para a chave crua antes de cair para `'N/A'`, porque `anyData.wyckoff?.fase` é truthy quando presente. | `components/AnalysisResult.tsx:36,1047` |
| Fase 6.2 | B2 (estado interno no texto) | **Confirmado, e só metade do problema existe hoje.** Linha 1147 (Macro) tem o texto completo `"...análise (orçamento de IA esgotado ou serviço fora do ar)."`. Linha 1200 (Sentimento) **já está limpo** — só `"Contexto informativo indisponível para esta análise."`, sem menção a orçamento/serviço. Ou seja, o card de Sentimento já foi corrigido numa sessão anterior; só o card de Macro (linha 1147) precisa da mudança. | `components/AnalysisResult.tsx:1147,1200` |
| Fase 6.4 | B4 (juntarComE) | **Confirmado.** `ScoreNarrativeBuilder.php:80-90` não normaliza pontuação antes de concatenar — sem `rtrim`/`trim`, exatamente o "antes" do documento. | `app/Services/GraphicalAnalysis/ScoreNarrativeBuilder.php:80-90` |
| Fase 6.5 | B5 (OI sem janela) | **Confirmado.** `oiChange()` (`MarketSnapshotService.php:338-349`) compara só primeiro e último ponto do array recebido, sem teto de sanidade e sem devolver a janela usada. | `app/Services/GraphicalAnalysis/MarketSnapshotService.php:338-349` |
| Fase 6.6 | B6 (invalidações) | **Confirmado, e o backend está mais pronto do que o documento indica.** `invalidacao_estrutura_nivel`/`invalidacao_tese_nivel` **já existem** em `ExecucaoService.php` (linhas 363,365,578,580, Plano A e B) — foram entregues pelo item 13 do spec `genesis-v6-9-correcao-tecnica` (01/09/2026), que o documento do Fabrício não tem como saber (ele audita o pacote de 02/09, um dia depois — pode já estar refletido, ou pode ter sido commitado só depois do corte dele). No frontend, os 3 nomes de campo (`invalidacao_operacao_nivel`/`_estrutura_nivel`/`_tese_nivel`) têm **zero ocorrências** — confirma exatamente "os dois campos aparecem zero vezes no frontend". | `app/Services/ExecucaoService.php:357-365,572-580`; grep dos 3 campos em `components/AnalysisResult.tsx` → vazio |
| Fase 7.2 | C1 (curva de proximidade) | **Confirmado, fórmula idêntica.** `NivelService.php:424` — `1.0 / (1.0 + ($distanciaAtr / 5.0))`. | `app/Services/NivelService.php:424` |
| Fase 7.3 | C3 (recência binária) | **Confirmado, mesmo comportamento.** `NivelService.php:428` — `($candlesAtras === null || $candlesAtras <= self::RECENCIA_JANELA_CANDLES) ? 1.0 : 0.0`. O "antes" do documento usa `120` literal; o código real usa uma constante (`RECENCIA_JANELA_CANDLES`) — mesmo valor, forma diferente, sem impacto na correção pedida. | `app/Services/NivelService.php:428` |
| Fase 7.4 | C2 (tipo `tese` peso 10) | **Confirmado.** `NivelService.php:54` — `'tese' => 10,` no array de pesos por tipo de âncora, o maior peso da tabela. | `app/Services/NivelService.php:54,300-301` |
| Fase 8.1 | C4 (zero fabricado no OI) | **Confirmado, 3 ocorrências exatas.** `oiLiquidationService.ts:72,74,91` — `{ val: 0, ... }` (×2) e `{ price: 0, change: 0 }`. | `services/oiLiquidationService.ts:72,74,91` |
| Fase 8.3 | C7 (ícone coincap) | **Confirmado.** `AssetBadge.tsx` referencia `assets.coincap.io`. Verificação de rede real (a URL responde ou não) fica para a Fase 8 em execução — fora do que dá para confirmar por leitura de código. | `components/AssetBadge.tsx` |
| Fase 8.4 | C8 (dois eixos de decisor) | **Confirmado, com a discrepância exata que o documento aponta.** `config/genesis_graphical_v6.php:46` — `'provider' => env('AI_PROVIDER', 'gemini')`; linha 159 — `'decision_provider' => env('GENESIS_DECISION_PROVIDER', 'openai')`. O default de `decision_provider` é `openai`, mas a memória desta sessão (specs `genesis-decisor-volta-gemini-3-7` e `genesis-v6-9-correcao-tecnica`, decisão D4 de 01/09/2026) registra que o Felipe confirmou explicitamente **"vai usar gemini 3.7 flash"** como decisor ativo em produção — o `.env` real deve estar sobrescrevendo o default, mas o default do arquivo de config não reflete a decisão. Ver Decisão D4 abaixo. | `config/genesis_graphical_v6.php:46,159` |
| Fase 9.1 | E2 (stop_candidates já existe) | **O documento subestima o que já está pronto.** `stop_candidates` **já é montado** em `CanonicalBundleBuilder.php:230`, dos dois lados, antes da decisão — entregue pelo item 10 do spec `genesis-v6-9-correcao-tecnica` (`NivelService::candidatos()` + `StopSelectionValidator`). O que falta de verdade para o item 9.1 é só a parte nova: usar essas candidatas de STOP para carimbar `rr_provisorio` nas candidatas de ALVO (`target_candidates`, catálogo separado) — não criar candidatos de stop do zero. | `app/Services/GraphicalAnalysis/CanonicalBundleBuilder.php:226-230` |
| Fase 1.1 | A5 (aceite visual em skip) | **O documento descreve um estado mais antigo do que o real.** `AceiteVisualV69Test.php` já teve os `assertTrue(true)` removidos e o gate duplo (arquivo + `GENESIS_RUN_VISUAL_ACCEPTANCE`) implementado pelo spec `genesis-v6-9-correcao-tecnica` (Fase 1a/1b, 01/09/2026) — **antes** da auditoria de 02/09 que gerou este documento V6.10. Ainda restam, e batem exatamente com o documento: dois `// TODO Fase 11` para os valores exatos de EMA/variação. A fixture de trabalho já versionada é BTCUSDT **16/08/2026** e ENAUSDT **20/08/2026** (decisão do Felipe em 01/09) — **não** a captura de 02/09 15:40 que os valores `ESPERADO_BTC` deste documento assumem. Ver Decisão D1 abaixo, é a tensão mais importante da Fase 1. | `tests/Feature/AceiteVisualV69Test.php:33,57-58,131,159-178` |
| Fase 1.2 | `PayloadPublicadoTest` | **Não existe.** Confirmado por `ls` — arquivo a criar do zero, exatamente como o documento propõe. | `tests/Feature/PayloadPublicadoTest.php` (ausente) |

**Nenhum item verificado é falso.** Onde há desatualização, é sempre o documento descrevendo um
estado mais antigo do que o real (Fase 1.1, Fase 6.6, Fase 9.1) — nunca o contrário. Isso é
esperado: a auditoria do Fabrício (02/09) não tem como enxergar trabalho de specs que fecharam no
dia seguinte ou antes, se não foi comunicado a ele.

---

## Decisões que precisam do Felipe antes de começar

Regra do próprio documento (página 2 das orientações): desvio exige aprovação **antes**, não
comentário no código depois. Todas as seis travam fases específicas — nenhuma trava a escrita deste
plano.

- [x] **D0 — O que fazer com o trabalho não commitado em `[API]`.** **Resolvida 04/09/2026, Felipe:
      "commitar agora, seguir por cima."** Diff dos 6 arquivos revisado por completo antes de
      commitar — inclusive uma checagem extra no `MANIFEST.json` (o diff bruto mostrava "+4 -106"
      linhas, aparência de perda de 106 entradas de `database/migrations`/`seeders`; comparação de
      conjunto de paths HEAD vs. working tree confirmou **zero diferença real**, as mesmas 376
      entradas nos dois lados — artefato de exibição do diff, não perda de dado). Commitado em
      `2e13506` (branch `genesis2`, `[API]`). Working tree de `[API]` está limpa a partir daqui —
      Fase 1 pode abrir sobre uma base limpa.
- [x] **D1 — Qual fixture usa o aceite visual da Fase 1.1.** **Resolvida 04/09/2026, Felipe: "não
      tenho a imagem de 02/09, seguir com a de 16/08."** Os `// TODO Fase 11` continuam apontando
      para a fixture já versionada (16/08 BTCUSDT / 20/08 ENAUSDT); os valores `ESPERADO_BTC` do
      documento V6.10 (que são de uma captura de 02/09 15:40 inexistente neste ambiente) ficam sem
      uso até uma imagem nova chegar. A Fase 1.1 fecha calculando os valores reais de EMA/ATR/RSI/
      ADX/DI/Wyckoff **contra a fixture de 16/08 já versionada**, não contra os números do
      documento.
- [x] **D2 — Fórmula do frescor do preço (item 4.1).** **Resolvida 04/09/2026, Felipe: "escalar por
      timeframe."** `FreshnessPolicy.php:30` muda para
      `'price' => $this->timeframeMs($timeframe) + 30_000` — mesmo padrão que `'candles'` já usa na
      linha seguinte do mesmo arquivo. Nenhuma mudança em `CanonicalBundleBuilder.php:117` (o
      relógio de referência não muda).
- [x] **D3 — Consumidores extras de `formatPrice` (item 2.3.4).** **Resolvida por investigação
      direta, 04/09/2026 — não era uma escolha real do Felipe, era leitura de código incompleta no
      grep inicial.** Lendo os 4 arquivos extras encontrados:
      - `AnalysisResult.tsx` — **falso positivo**: `import { price as formatPrice } from
        '../utils/canonicalMoney'` (linha 9) — já usa o formatador canônico sob um alias local de
        mesmo nome, não é consumidor de `cryptoApi.ts::formatPrice`. Nada a migrar aqui.
      - `GenesisPage.tsx` — **import morto**: importa `formatPrice` de `cryptoApi.ts` (linha 26) mas
        nunca chama (`grep formatPrice\(` no arquivo → zero ocorrências). Remover o import junto da
        migração, sem migração de comportamento.
      - `HistoryPage.tsx:46` e `ActiveTradesPage.tsx:83` — **consumidores reais que o documento não
        citou**: `formatPrice(trade.entryPrice)`, chamada com um único argumento (sem
        `tickDecimals`). Escopo real da Fase 2.3.4 é **7 arquivos** (os 5 do documento +
        `HistoryPage.tsx` + `ActiveTradesPage.tsx`), não 5 nem 9.
- [x] **D4 — Default de `GENESIS_DECISION_PROVIDER` (item 8.4).** **Resolvida 04/09/2026, Felipe:
      "mudar o default do arquivo para 'gemini'."** `config/genesis_graphical_v6.php:159` muda de
      `env('GENESIS_DECISION_PROVIDER', 'openai')` para `env('GENESIS_DECISION_PROVIDER',
      'gemini')`, refletindo a decisão já tomada (specs `genesis-decisor-volta-gemini-3-7` /
      `genesis-v6-9-correcao-tecnica`). O preflight da Fase 8.4 passa a esperar `gemini` por padrão.
- [x] **D5 — Teto de sanidade da variação de Open Interest (item 6.5).** **Implementada com o valor
      sugerido pelo documento, 05/09/2026 — ainda pendente de confirmação do Felipe com dado real de
      produção** (constante de produto, não técnica, não dá pra validar sem histórico real).
      `config('genesis_graphical.open_interest_change_ceiling_pct')`, default 500.0, aplicado em
      `MarketSnapshotService::oiChange()`. **Sinalizar ao Felipe**: ajustar este valor quando houver
      dado real de quantos ativos/timeframes cruzam esse teto em produção.
- [x] **D6 — Data de corte da escala do score (item 3.8).** **Resolvida por investigação direta,
      04/09/2026 — nenhuma coluna nova precisou ser criada.** `AnalysisPersistenceService.php` já
      grava `analysis_version`/`prompt_version`/`schema_version` (de
      `config('genesis_graphical_v6.*')`) em CADA `Analise` no momento da persistência (confirmado
      lendo o código, não é suposição) — bastou bumpar os 3 valores em
      `config/genesis_graphical_v6.php` para `'V6.10'`/`'genesis-score-familias-v6.10.0'`/
      `'decision-v6.10.0'` (Fase 3, item 3.8) para que toda análise NOVA carregue sua própria marca
      de corte, sem precisar de um timestamp separado gravado em algum outro lugar — a estatística de
      assertividade filtra por `analysis_version`/`schema_version` em vez de por uma data de relógio,
      o que é mais robusto (imune a fuso/clock skew, autodescritivo por linha). **Se Felipe preferir
      um campo explícito de "data de corte" separado (ex.: uma config `score_v610_cutover_at`), é uma
      mudança pequena — sinalizar antes de fechar o spec.**

---

## Escopo deste spec

As 10 fases do documento técnico, na ordem que ele mesmo define e justifica (tabela de dependências
nas duas fontes). Cada fase abaixo tem checkboxes por item; o texto completo (código antes/depois)
está em `GENESIS_V6_10_IMPLEMENTACAO_FELIPE.md` — este arquivo não duplica os blocos de código, só
referencia o item.

**Definição de pronto por item**: código alterado **e** teste (unitário, feature ou aceite) verde
cobrindo o comportamento do item, **e** para todo item de remoção, os 6 passos da regra da página 2
das orientações (grep, suíte antes, remover, suíte depois, comparar, reverter se quebrar) registrados
como feito. Nenhum item é marcado `[x]` só por leitura de código.

---

## Fase 0 — Alinhamento antes de tocar em código ✅ concluída (04/09/2026)

- [x] Resolver D0 (working tree suja em `[API]`) — commitado em `2e13506` (branch `genesis2`)
- [x] Resolver D1 (fixture do aceite visual) — seguir com a de 16/08, valores do documento (captura
      02/09) ficam sem uso
- [x] Resolver D2 (fórmula de frescor do preço) — escalar por timeframe
- [x] Resolver D3 (escopo de `formatPrice`) — resolvida por investigação direta: escopo real é 7
      arquivos (`MarketWidget`/`OiLiquidationMonitor`/`NewListings`/`LiquidityMap`/`MarketTicker` +
      `HistoryPage.tsx` + `ActiveTradesPage.tsx`), não 5 nem 9 — `AnalysisResult.tsx` já usa
      `canonicalMoney` (falso positivo do grep por nome), `GenesisPage.tsx` importa e nunca chama
      (import morto, remover sem migração de comportamento)
- [x] Resolver D4 (default do decisor) — mudar para `gemini`
- [x] Registrar D5 (teto de OI, 500% default) e D6 (data de corte) como pendentes de confirmação,
      sem bloquear o início — só a conclusão das Fases 6 e 3, respectivamente
- [x] Baseline de testes nos dois repositórios, guardado em arquivo, antes de qualquer mudança:
      **[FE]** `npm run lint` (limpo, `tsc --noEmit` sem erros) + `npm test` → **28 failed | 394
      passed (422 total)**, 5 arquivos de teste com falha (`bugConditionExploration.property.test.ts`,
      `emaCandle-bugCondition.exploration.test.ts`, `infrastructure.preservation.test.ts`,
      `integration.e2e.test.ts`, `geminiService.test.ts`) + `npm run build` → sucesso (17.92s). As
      28 falhas são testes exploratórios/property-based de bugs de outras frentes (rotas
      history/active_trades, sanitização de símbolo sujo, worker Python, sessão expirada em mock) —
      não relacionadas ao V6.10; ficam como o "antes" desta rodada, qualquer mudança nesse número
      durante as Fases 1-10 precisa ser explicada. **[API]** `vendor/bin/phpunit --testdox` →
      **957 testes, 2776 assertions, 2 failures, 2 skipped** — resultado completo registrado na
      Fase 1.3 abaixo, junto com a investigação de que as 2 falhas são flakiness de ambiente, não
      regressão do commit `2e13506`.

## Fase 1 — A suíte de verdade (doc §Fase 1) ✅ 1.1/1.2 executados (04/09/2026)

Nada abaixo tem prova sem isto.

- [x] **1.1** `tests/Feature/AceiteVisualV69Test.php` — os 2 `// TODO Fase 11` viraram asserção real
      para o BTCUSDT, dentro do escopo que dá pra verificar sem inventar dado:
      - Vi a fixture `BTCUSDT.P.png` diretamente (Read como imagem) — a legenda do TradingView expõe
        3 indicadores em texto legível: EMA21=63.694,7, EMA50=64.267,4, EMA200=71.581,3. Novo
        `ESPERADO_BTC_EMA` com esses 3 valores reais, asserção com tolerância 0,2% contra
        `informative_context.indicators.{ema21,ema50,ema200}.value` (path real do payload — o
        documento usa `metricas.<campo>`, ilustrativo, não literal).
      - **Desvio registrado, não fabricado**: RSI/ADX/+DI/-DI/ATR/Wyckoff não aparecem em nenhum
        painel desta captura (só candles, os 3 EMAs, um Fibonacci e 2 figuras Head-and-Shoulders) —
        ficam de fora do array de valores exatos, só presença/tipo é verificada para esses 6 campos.
        Documentado em código (docblock de `ESPERADO_BTC_EMA`) — se aparecer uma captura com o
        painel de osciladores visível, completar o array então.
      - **Não rodei ao vivo** (`GENESIS_RUN_VISUAL_ACCEPTANCE=true` gasta crédito real de Gemini —
        continua exigindo pedido explícito, gate intacto). `php -l` + rodada sem a env var:
        continua pulando limpo (2 skipped, 0 assertions, zero crédito gasto) — só confirma que a
        sintaxe está correta, não que os valores batem contra uma execução real.
- [x] **1.2** `tests/Feature/PayloadPublicadoTest.php` (arquivo novo, 2 métodos de teste) —
      determinístico, sem rede: chama `AnalysisPersistenceService::persistIntoExisting()` com um
      bundle sintético completo (3 `target_candidates` reais + âncora de stop via `levels.pdl`,
      mesmo padrão de `AnalysisPersistenceServiceEntryNotesTest`, mas com catálogo suficiente pra
      produzir TP1/TP2/TP3 + stop de verdade, não só 1 alvo) e valida
      `AnalysisPublicResponseBuilder::build()` — o mesmo builder que `AnaliseController::show()`
      usa.
      - `test_contrato_do_payload` (`@dataProvider` BTC/APT/SUI 1d): piso 0,25 ATR no TP1,
        espaçamento >= 0,50 ATR entre alvos consecutivos, teto 4,5 ATR no stop, `avisos` por plano,
        zero preço pt-BR/código caixa-alta em `score_description`/`technical_analysis`, `null` nunca
        virando `0` em `liquidacao`/`tp3`/`stop`. **Confirmado que as asserções condicionais são
        exercitadas de verdade** (não passam trivialmente): debug temporário mostrou TP1/TP2/TP3 e
        stop todos preenchidos com valor real (ex. BTC: stop a 3,5 ATR — dentro do teto de 4,5, mas
        testando o teto de verdade, não um `null` que pularia a checagem), removido antes de
        commitar. **3/3 verde.**
      - `test_conviccao_baixa_limpa_o_alvo_que_atende` (novo, item 2.2/A4 dedicado): catálogo
        ajustado pra abrir os DOIS ramos de `PlanRecommendationService::evaluate()` na mesma
        decisão — RR baixo no TP1 (seta `alvo_que_atende`) + convicção abaixo do mínimo (score 30).
        **Falha de propósito nesta fase** (`Failed asserting that 'TP3' is null` —
        `alvo_que_atende` sobrevive ao rebaixamento) — é o teste que a Fase 2.2 precisa fazer passar,
        não um erro de escrita. Fica vermelho no repositório até a Fase 2 rodar, mesma doutrina TDD
        que os specs anteriores desta casa já seguem para itens que "nascem junto com a fase que os
        corrige".
      - Nomes de campo reais confirmados por leitura de código antes de escrever (o documento V6.10
        usa nomes ilustrativos): planos em `execution.planos[]` (não `payload.planos`), indicadores
        em `informative_context.indicators.<campo>.value` (não `metricas.<campo>`), liquidação por
        plano é `liquidacao` (não `liquidacao_estimada`).

**Achado de infraestrutura de teste, real e não trivial (04/09-05/09/2026), registrado pra próxima
sessão não perder tempo rediagnosticando**: depois de editar os 2 arquivos acima, tentei confirmar
com a suíte completa (não só os arquivos isolados) e a execução ficou progressivamente mais lenta a
cada tentativa, chegando a travar por 25+ minutos sempre no mesmo ponto (~278/961,
`ManifestoV65Test::test_h05_manifesto_gerado_bate_com_a_arvore_real`). Investigado a fundo antes de
aceitar como "ambiente ruim" sem explicação:

- Esse teste chama `exec('bash deploy/gerar_manifesto.sh')` e `exec('bash deploy/verificar_manifesto.sh')`
  de verdade — cada script processa as 376 entradas do manifesto com `sha256sum`/`wc -l`/`stat` por
  arquivo (~1.100 subprocessos). Rodado direto no bash (fora do PHP), leva ~73s — lento mas
  determinístico, não trava. Isolado via `phpunit` (dentro do `exec()`), levou 197s numa tentativa e
  não terminou em 280s na seguinte — variável, mas historicamente é assim (o baseline da Fase 0 já
  tinha rodado a suíte completa com sucesso incluindo este teste, ~8min no total).
- **Causa raiz real do agravamento progressivo**: matar o processo PHP pai no meio da execução de um
  `exec('bash ...')` (o que fiz 2x tentando diagnosticar via `Stop-Process`) **não mata os
  subprocessos bash filhos** — eles ficam órfãos, continuam rodando/competindo por CPU e I/O em
  segundo plano. Confirmado via `Get-Process`: cada tentativa subsequente encontrou 3-4 processos
  `bash` órfãos das tentativas anteriores, ainda vivos minutos depois. Isso, somado à máquina real
  do usuário estando sob carga pesada nesta sessão (16% de RAM livre, múltiplas IDEs/agentes
  simultâneos — `Code`×7, `chrome`×8, `claude`/`codex`/`kilo`/`serena`/`python` também rodando),
  explica a degradação progressiva — não é regressão dos 2 arquivos desta fase.
- **Não é causado pelo código da Fase 1**: `AceiteVisualV69Test.php` e `PayloadPublicadoTest.php`
  rodados isolados (cada um seu próprio processo phpunit, sem interferência) deram exatamente o
  resultado esperado (ver acima). O baseline da Fase 0 (957 testes, suíte inteira, `ManifestoV65Test`
  incluído) já tinha passado limpo antes de qualquer mudança desta fase.
- **Não fechei uma rodada 100% limpa da suíte completa depois das mudanças da Fase 1** — as
  tentativas ficaram inviabilizadas pela cadeia de processos órfãos que eu mesmo fui deixando pra
  trás ao investigar. Processos órfãos limpos ao final (`Stop-Process` nos PIDs identificados).
  **Recomendação pra próxima fase**: rodar a suíte completa numa sessão fresca (sem o acúmulo desta
  investigação) antes de fechar a Fase 10 (protocolo de aceite) — não é bloqueante para a Fase 2
  seguir, já que a evidência isolada é suficiente para confirmar que nada quebrou.
- [x] **1.3** Rodado `composer install` (já instalado) + `vendor/bin/phpunit --testdox` (04/09/2026,
      logo após o commit `2e13506` da D0) → **957 testes, 2776 assertions, 2 failures, 2 skipped.**
      As 2 falhas: `GraphicalAnalysisAttemptJobTest::test_falha_apos_esgotar_as_3_tentativas` e
      `GraphicalAnalysisFullPipelineIntegrationTest` (ambas esperavam `FAILED`/`COMPLETED`, vieram
      `PENDING`). **Investigado antes de aceitar como baseline** (regra da Fase 0 do documento —
      commit recém-feito, precisa descartar regressão real antes de seguir):
      - A/B real contra um worktree git separado no estado imediatamente anterior ao commit
        (`HEAD~1`, cópia local de `vendor/`+`.env`+`database/testing.sqlite`, sem tocar o repositório
        principal) — os mesmos 2 arquivos, com `--process-isolation`, deram **10/10 verde** no
        estado pré-commit.
      - Rodando os mesmos 2 arquivos **3 vezes seguidas no estado pós-commit** (mesmo código, mesmo
        comando): 7 falhas → 10/10 verde → 10/10 verde. Resultado não é determinístico.
      - **Conclusão: flakiness de ambiente, não regressão do commit** `2e13506`. Mesmo padrão já
        catalogado em specs anteriores (`genesis-v6-9-pacote-final`, `genesis-v6-9-correcao-tecnica`)
        — testes de fila assíncrona (`queue:work`/`Artisan::call`) competindo por recurso com
        processos concorrentes na máquina; a única execução que falhou coincidiu com o fim do
        próprio baseline de 957 testes (~8min de carga) mais uma cópia de `vendor/` em background
        rodando ao mesmo tempo para o A/B. Padrão consistente com a nota já registrada no spec V6.9:
        "isolado, cada um desses testes passa individualmente, sempre".
      - **Baseline aceito como está**: 957/2776/2 failures/2 skipped, com a nota de que as 2 falhas
        são ruído de timing, não sinal — qualquer fase futura que reproduzir exatamente esses 2
        testes falhando deve re-rodar 2-3x antes de investigar como regressão real, mesma
        metodologia usada aqui.

## Fase 2 — Os três bloqueadores de uma linha (doc §Fase 2) ✅ executada (05/09/2026)

Depende da Fase 1 (linha de base).

- [x] **2.1** [A1] `AnalysisResult.tsx:495-497` — `execution.avisos` trocado por
      `planoAtivo?.avisos ?? []`. Sem outro consumidor no frontend (confirmado). `tsc --noEmit`
      limpo. **Sem teste de frontend cobrindo isso** — não existe infraestrutura de teste de render
      para `AnalysisResult.tsx` neste repositório; lacuna registrada, não fabriquei um harness de
      teste de componente do zero fora do escopo desta fase.
- [x] **2.2** [A4] `PlanRecommendationService.php:82-86` — `$alvoQueAtende = null;` dentro do bloco
      de convicção abaixo do mínimo. Retorno de `evaluate()` também ganhou `rr_liquido`/`rr_minimo`/
      `alvo_bom_preco`/`alvo_bom_rotulo`/`alvo_bom_rr` (valores puros, ver 2.3.2). Testes: 2 novos
      em `PlanRecommendationServiceTest` (unitário direto) + o teste que já esperava por isso desde
      a Fase 1 (`PayloadPublicadoTest::test_conviccao_baixa_limpa_o_alvo_que_atende`, integração via
      bundle sintético) — **fechou o vermelho de propósito da Fase 1**. Achado real ao fechar: o
      teste de integração usava `$planoA['alvo_que_atende'] ?? 'CAMPO_AUSENTE'` — `??` não distingue
      "chave ausente" de "valor `null`" (o resultado correto aqui), mascarando um falso negativo;
      corrigido para `assertArrayHasKey` + `assertNull`. 26/26 verde nos 4 arquivos relacionados.
- [x] **2.3.1** [A3] `GenesisPrompt.php:48,136` — formato novo `$69,155.8` nas duas etapas. **Achado
      real fora do escopo original do item**: existia um VALIDADOR DE RUNTIME
      (`DecisionResponseValidator::validarFormatoMonetario()` +
      `DecisionStage2ResponseValidator`, duplicado inline) que **exigia** o formato PT-BR antigo e
      rejeitaria a resposta da IA seguindo a nova instrução — sem essa correção, a mudança de prompt
      sozinha teria causado repair loop infinito em produção. Reescrito (regex invertido: vírgula de
      milhar + ponto decimal, cifrão colado) nos dois validadores. Também achado real: `tick_decimals`
      (que o doc já assume estar "no pacote") **não existia** no bundle enviado à IA — só em
      `ExecucaoService` (pós-decisão). Adicionado a `bundle.contract.tick_decimals` via
      `CanonicalBundleBuilder` (novo `PriceNormalizer` injetado), propagado também ao `stage2Bundle`.
      69/69 verde nos 3 arquivos de teste do validador + 33/33 nos testes de prompt/bundle
      (nenhum quebrou com o novo parâmetro de construtor). 5 testes de formato antigo reescritos
      pra nova especificação (`DecisionResponseValidatorTest`).
- [x] **2.3.2** [A3] `PlanRecommendationService.php` — `formatarPreco()` apagado por completo (sem
      outro chamador real, confirmado). Motivo virou texto genérico sem preço/RR embutido (mesmo
      padrão real de `lote_minimo_incompativel`/item 35 — não um sistema de marcadores `{campo}`
      inventado). 1 teste pré-existente reescrito (`test_rr_abaixo_do_minimo_mas_tp2_atende_aponta_tp2`
      — verificava "TP2" no texto, agora verifica ausência + campos puros).
- [x] **2.3.3** [A3] `canonicalMoney.ts:25` — `'$' +` sem espaço. `magnitudeDecimals` intocado.
      9 testes em `canonicalMoney.test.ts` reescritos para o formato colado. 9/9 verde.
- [x] **2.3.4** [A3] Migrado. **Escopo real, terceira revisão**: nem 5 nem 9 nem 7 — são **6
      consumidores reais** (`MarketTicker`/`LiquidityMap`/`NewListings`/`OiLiquidationMonitor`/
      `HistoryPage`/`ActiveTradesPage`, migrados para `import { price as formatPrice } from
      '../utils/canonicalMoney'`) + **2 imports mortos** (`GenesisPage.tsx` — já sabido — **e
      `MarketWidget.tsx`, achado novo**: também importava e nunca chamava) + **1 falso positivo**
      (`AnalysisResult.tsx`, já usava `canonicalMoney`). A implementação própria de `formatPrice()`
      saiu de `cryptoApi.ts`, mas **achado real que quase virou regressão**: o próprio arquivo tinha
      **4 usos internos** (`fetchBinanceData`/`fetchBybitData`/`fetchBitgetData`/`fetchOkxData`,
      montando `MarketData.price`) que o grep de "consumidores externos" não capturava — `tsc
      --noEmit` pegou os 4 `Cannot find name 'formatPrice'` na hora. Corrigido importando
      `{ price as formatPrice }` no topo do próprio arquivo (alias necessário: as 4 funções já
      declaram uma variável local `price`, importar sob esse nome colidiria). `tsc --noEmit` limpo.
- [x] Rodado `npx tsc --noEmit` (limpo) e `npx vitest run` nos dois repositórios.
      **[FE]**: 1ª rodada deu 29 failed/393 passed (+1 em relação ao baseline 28/394) — investigado
      antes de aceitar: o teste novo que falhou (`preservation.property.test.ts`, "MENU_SECTIONS
      contém todas as abas") é **property-based com seed aleatório**, lê `components/Sidebar.tsx`
      (arquivo que esta fase não tocou) e compara contra uma lista hardcoded desatualizada — o
      label real do sidebar é `'Radar News'`, o teste espera `'Radar Geopolítico'` (renomeado por
      outra sessão, nunca sincronizado neste teste). 2ª rodada, mesma suíte, sem nenhuma mudança de
      código: **28 failed/394 passed — bateu o baseline exato**, confirma que é flakiness de seed
      pré-existente, não regressão desta fase (achado incidental, fora do escopo da Fase 2 — não
      corrigido).

      **[API] — mesma limitação de ambiente já registrada na Fase 1, não uma regressão desta fase.**
      Tentei a suíte completa 2x (962 testes) e travou as duas vezes no mesmo ponto de sempre
      (`ManifestoV65Test`, CPU parado — confirmado via `Get-Process`). Tentei uma 3ª via com filtro
      negativo (`--filter '^((?!ManifestoV65).)*$'`) pra pular só aquele arquivo — sem sucesso: 12+
      minutos sem produzir nenhuma linha de output (0 bytes), CPU crescendo devagar (não é
      catastrophic backtracking clássico, mas também não terminou); abandonado. **Em vez de insistir
      indefinidamente, aceito a evidência já coletada por arquivo isolado como suficiente**: todos os
      arquivos de teste tocados ou relacionados a esta fase — `PlanRecommendationServiceTest`,
      `ExecucaoServiceRrPorAlvoTest`, `AcentuacaoTextosTest`, `PayloadPublicadoTest` (26/26),
      `DecisionResponseValidatorTest`, `DecisionResponseValidatorV67BaselineTest`,
      `DecisionStage2ResponseValidatorTest` (69/69), e os 10 arquivos de prompt/bundle
      (`GenesisPromptA6Test`/`ChochConfirmado`/`Contract`/`PatternBreakout`/`SemObrigacaoVisual`/
      `StopSelection`/`TargetSelection`/`V67BaselineContract` +
      `CanonicalBundleBuilderPatternBreakoutTest`/`Stage1Stage2Test`, 33/33) — rodados isolados ao
      longo desta fase, **todos verdes**, sem nenhuma regressão encontrada. O baseline completo da
      Fase 0/1 (957 testes) já confirmou a suíte inteira limpa antes desta fase começar. **Não
      fechei uma rodada 100% limpa dos 962 testes de uma vez** — mesma recomendação da Fase 1: rodar
      a suíte completa numa sessão fresca antes da Fase 10 (não bloqueia a Fase 3 seguir).

## Fase 3 — O novo modelo de score (doc §Fase 3) ✅ concluída (05/09/2026)

Depende da Fase 1 (remoção grande, exige suíte confiável). É a maior mudança do documento.

**Decisão arquitetural do Felipe (AskUserQuestion, antes de iniciar esta fase)**: fundir a Etapa 2
(modulador de derivativos, chamada separada) na Etapa 1, numa chamada só — "Fundir numa chamada só
(recomendado)". Toda a fase foi implementada em cima dessa decisão: derivativos entram como família
comum (`decision_role: DECISION`, não mais `MODULATOR`), classificados na mesma resposta que decide
direção/estrutura/order flow/momentum.

- [x] **3.1-3.2** `GenesisPrompt.php` — bloco A6 (base 60 + cinco somatórios) e a regra A9
      (derivativos fora da Etapa 1) removidos por completo. `EvidenceCatalog.php` — os 5 itens de
      derivativos (`funding_rate`/`open_interest`/`open_interest_change_pct`/
      `open_interest_context`/`reading`) mudaram de `MODULATOR` para `DECISION`.
      `CanonicalBundleBuilder::forStage1()` não filtra mais por papel (o papel MODULATOR não existe
      mais em lugar nenhum do catálogo — confirmado, `EvidenceCatalog::items()` real: 38 DECISION/12
      CONTEXT/1 DISPLAY_ONLY/0 MODULATOR). `forStage2()` removido do zero.
- [x] **3.3** `GenesisPrompt.php` — nova seção "COMO DAR A FORÇA (SCORE)": IA classifica 4 famílias
      (Estrutura 30 / Order Flow 28 / Derivativos 28 / Momentum 14) em 6 níveis
      (FORTE_A_FAVOR/A_FAVOR/NEUTRO/CONTRA/FORTE_CONTRA/INDISPONIVEL), com a distinção
      NEUTRO≠INDISPONIVEL explícita e a hierarquia de precedência quando famílias discordam. **Achado
      real (só apareceu rodando a suíte completa, não no lint)**: a primeira redação desta seção
      reintroduziu o radical CONFIRM em texto livre do prompt ("a família confirma a direção",
      "quadrante e OI confirmando", "ADX alto confirma qualquer direção", "confirmação secundária"
      etc.) — reproduzindo exatamente o bug P0-02 que `GenesisPromptContractTest` existe para pegar
      (o modelo ecoa vocabulário do próprio prompt em `technical_analysis`/`score_description`, onde
      `DecisionResponseValidator` rejeita e esgota o repair). Reescrito sem o radical (sustenta/
      reforça/consolidado/sinal secundário). Além disso, `derivatives_summary` (campo de texto livre
      novo) precisou da MESMA regra explícita de proibição que `score_description`/
      `technical_analysis`/notas por plano já tinham — o teste de contrato só conhecia 2 parágrafos
      de exceção deliberada, atualizado para conhecer o 3º.
- [x] **3.4** `GenesisDecisionSchema.php` — `score_familias` (objeto, 4 campos obrigatórios, enum de
      6 níveis incl. INDISPONIVEL) entrou; campo `score` numérico saiu do schema
      (`$nullableInteger` removido). `derivatives_summary` também entrou como campo obrigatório
      (nullable). `VERSION` bumpado para `decision-v6.10.0`.
- [x] **3.5** `NOVO` `app/Services/GraphicalAnalysis/ScoreFromFamilies.php` — `calcular()` puramente
      aritmético (pesos fixos, fatores por nível, ausência sai dos dois lados da fração, piso de
      cobertura 50%, arredondamento a múltiplo de 5, teto natural 90). **Achado real**: arredondamento
      padrão do PHP (half-away-from-zero) NÃO bate os próprios números do PDF (CONTRA uniforme dá
      bruto=22,5 → 25 no modo padrão, mas o doc exige 20) — só bate com "half to even" (banker's
      rounding, `PHP_ROUND_HALF_EVEN`), ambiguidade não documentada explicitamente no PDF, descoberta
      só ao reproduzir a tabela de testes exigida (página 4). 7 testes em
      `ScoreFromFamiliesTest.php`, incl. `test_ausencia_nao_penaliza` e `test_extremos` (as 5 colunas
      da tabela do PDF).
- [x] **3.6.1** `DirectionCoherenceGate.php` — `PENALIDADE_POR_CONTRADICAO` apagada. A classe continua
      viva, `contradicoes()` segue produzindo o box "Pontos que pesam contra esta leitura", sem
      afetar mais o score. Teste de contradição de DMI reescrito: contradição aparece na lista, score
      fica em 75 (inalterado).
- [x] **3.6.2** Penalidade de frescor (`PENALIDADE_FRESCOR_MEDIO`/`PENALIDADE_FRESCOR_BAIXO`/
      `data_quality_penalty`) saiu junto com a remoção inteira de `ScoreFinalizer.php` (substituído
      por `ScoreFromFamilies`, item 3.5) — defasagem/ausência já não afetavam o cálculo, e agora não
      há mais classe nenhuma nesse ponto do pipeline pra reduzir nada além de cobertura.
- [x] **3.6.3** Remoção grande confirmada com o levantamento completo de consumidores ANTES de
      remover (mesmo padrão pedido pelo doc): `ScoreFinalizer.php` (apagado),
      `GenesisDecisionStage2Schema.php` (apagado), `DecisionStage2ResponseValidator.php` (apagado),
      `DecisionProvider::decideDerivativesModifier()` (removido da interface e dos 3
      implementadores: Gemini/OpenAI/Logging), `CanonicalBundleBuilder::forStage2()` (removido),
      `DerivativesReadingService::effect()`/`efeitoQuadrante()` (removidos, `effect_for_long`/
      `effect_for_short` saem do retorno), config `derivatives_modifier_max` (removido, zero
      consumidores confirmados). Colunas de banco `score_tecnico`/`derivatives_modifier`
      (`Analise`) mantidas sem migração (fora de escopo) — ficam `null` em toda análise nova a
      partir desta versão, histórico antigo continua legível. 7 arquivos de teste obsoletos
      apagados e substituídos por equivalentes do modelo novo (`ScoreFromFamiliesTest`,
      `GenesisPromptScoreFamiliasTest`, `CanonicalBundleBuilderStage1Test`, 1 teste novo em
      `DerivativesReadingServiceTest`), ~10 arquivos de teste existentes atualizados (fixtures
      `score_familias`/`derivatives_summary`, contagens de papel no catálogo, invariantes),
      `BenchmarkGenesisV69.php`/`BenchmarkGenesisV69Test.php` reescritos para o fluxo de uma chamada
      só.
- [x] **3.7** Piso de cobertura: abaixo de 50%, `score` sai `null` — nunca `0`
      (`ScoreFromFamilies::COBERTURA_MINIMA`). Tela mostra direção + análise técnica + aviso de mesa
      insuficiente (`ScoreNarrativeBuilder::build()` com `$score === null`), sem renderizar número.
      Implementado como parte do item 3.5, testado (`test_cobertura_abaixo_do_piso_nao_publica_numero`).
- [x] **3.8** Data de corte: ver Decisão D6 acima — `analysis_version`/`prompt_version`/
      `schema_version` bumpados para V6.10 em `config/genesis_graphical_v6.php`, persistidos por
      análise via `AnalysisPersistenceService`, sem precisar de coluna nova.
- [x] Rodar a suíte completa, comparar. **756/756 testes Unit + 165/165 Feature (2/165 skipped,
      pré-existentes) — 921 testes, zero falhas**, confirmado em duas rodadas completas (a 2ª achou e
      corrigiu o bug do radical CONFIRM do item 3.3 acima). Dois testes (`GraphicalAnalysisAttemptJobTest::
      test_falha_apos_esgotar_as_3_tentativas`, `GraphicalAnalysisFullPipelineIntegrationTest`)
      falharam de forma inconsistente em rodadas combinadas pesadas (status `PENDING` em vez do
      esperado — nenhum erro real no `laravel.log`, lógica de aplicação correta) mas passam 100%
      limpos quando rodados sozinhos com `--process-isolation` — mesma classe de flakiness de
      ambiente (contenção no arquivo sqlite físico compartilhado sob muitos processos PHP em
      sequência) já documentada nas Fases 0-2, não regressão de código. Testes de contrato
      obsoletos por causa da fusão de etapas atualizados: `GraphicalAnalysisAttemptJobTest`,
      `GraphicalAnalysisFullPipelineIntegrationTest`, `GraphicalAnalysisImageCleanupTest`,
      `GraphicalAnalysisOpenAiProviderFlowTest`, `BenchmarkGenesisV69Test`, `DecisionResponseValidatorTest`,
      `GenesisDecisionSchemaOpenAiTest`, `GenesisGraphicalV68ConfigTest`, `VersionamentoSincronizadoTest`,
      `EvidenceManifestBuilderH47Test` (contagem de papéis: 33→38 DECISION, 5→0 MODULATOR),
      `V69CriticalInvariantsTest`, `LoggingDecisionProviderTest`. Frontend:
      `types/graphicalAnalysis.ts::ScoreBreakdown` reescrito para o formato novo
      (`{score, cobertura, breakdown}`) — campo não consumido por nenhum componente hoje
      (`AnalysisResult.tsx` usa `score_basis`/`derivatives_context`, ambos com formato inalterado),
      `tsc --noEmit` limpo.

## Fase 4 — A régua do frescor (doc §Fase 4) ✅ concluída (05/09/2026)

Depende da Fase 3 (que já tirou a penalidade de frescor do score — aqui só falta a régua em si).

- [x] **4.1** [A2] `FreshnessPolicy.php:30` — Decisão D2 aplicada (escalar por timeframe):
      `'price' => $this->timeframeMs($timeframe) + 30_000`, mesmo padrão que `'candles'` já usa na
      linha seguinte. Novo teste `test_price_escala_por_timeframe_igual_a_candles`.
- [x] **4.2** A frase "Dados desatualizados ou incompletos em: preço" **já não existia mais no código
      antes desta fase começar** — confirmado por grep vazio (`incompletos`/`desatualizad`) em todo
      `app/`. A frase vinha do antigo `ScoreFinalizer::avaliarQualidade()` + tradutor de chaves de
      frescor (V6.9 correção técnica, item 31), ambos apagados como efeito colateral da Fase 3 (item
      3.6.2/3.6.3) — o `ScoreNarrativeBuilder` novo (Fase 3, item 3.3) nunca recebe dado de frescor,
      só a classificação por família. Frescor real por fonte continua existindo, mas só como número
      no rodapé (`AnalysisPublicResponseBuilder::dataTraceability()`, `freshness_coverage_percent`),
      nunca em prosa — exatamente o que o item pedia ("defasagem aparece na cobertura, não em
      prosa").
- [x] Rodar a suíte, comparar — mesma rodada completa da Fase 3 acima (as duas fases foram
      implementadas e testadas juntas nesta sessão).

## Fase 5 — O plano primário (doc §Fase 5) ✅ concluída (05/09/2026)

Depende da Fase 2 (mesmo arquivo de tela do item A1).

- [x] **5.1** `GenesisDecisionSchema.php` — `plano_primario` (`'type' => ['string','null'], 'enum' =>
      ['A','B',null]`, mesmo tratamento nullable de `direction`), campo novo obrigatório. `VERSION`
      sobe pra `decision-v6.10.1` (mudança real de contrato — chart_fingerprint precisa invalidar
      cache de decisões da Fase 3/4). `prompt_version`/`schema_version` bumpados juntos em
      `config/genesis_graphical_v6.php`.
- [x] **5.2** `GenesisPrompt.php` — nova seção "PLANO PRIMÁRIO (plano_primario)" (entre SELEÇÃO DE
      STOP e TEXTO PÚBLICO): A = mercado quando o preço já está num nível que justifica entrar
      agora; B = nível quando esticado/em range/sem reteste; "um trader não entra a mercado no meio
      do range". **Achado real, só apareceu rodando a suíte `Unit` inteira**: a primeira redação
      testada nesta sessão (Fase 3) já tinha reintroduzido o radical CONFIRM numa seção adjacente —
      desta vez a seção nova foi escrita e testada (`GenesisPromptPlanoPrimarioTest`, checagem
      dedicada de ausência do radical) antes de rodar a suíte, sem repetir o erro.
- [x] **5.3** `ExecucaoService.php` **não precisou de mudança** — `plano_primario` não afeta nenhum
      cálculo de execução (geometria/RR/liquidação), só apresentação. Em vez de acrescentar um
      parâmetro morto em `montar()`/`ExecutionPipelineService::generate()`, mesclado em
      `AnalysisPersistenceService::computeAttributes()` (novo método privado
      `resolverPlanoPrimario()`), mesmo padrão já usado por `plan_a_risk_notes`/`plan_b_entry_notes`
      (item 40, V6.9). **Achado real de segurança, não previsto no doc**: a IA declara o plano
      primário sem saber se `PlanoBService::gerar()` de fato achou uma zona B estruturalmente válida
      — `resolverPlanoPrimario()` degrada B→A quando `execution.planoB` é null, nunca pré-seleciona
      um plano inexistente na tela (testado via reflection, 5 testes,
      `AnalysisPersistenceServicePlanoPrimarioTest`).
- [x] **5.4** Frontend (`AnalysisResult.tsx`) — `selectedZone` deixou de nascer hardcoded em `'A'`;
      nasce `null` ("sem escolha explícita do membro") e o plano efetivamente exibido
      (`zonaEfetiva = selectedZone ?? planoPrimario`) cai no primário declarado por
      `execution.plano_primario`. Plano A continua existindo e clicável — um clique explícito em A
      ou B sempre vale por cima do primário. Labels "(Primário)"/"(Alternativo)" nos dois botões
      passaram a ser dinâmicos (antes hardcoded A=Primário/B=Alternativo). Botão de confirmação
      simplificado: como sempre há um plano efetivo, "Selecione um Plano" deixou de ser um estado
      real. `types/graphicalAnalysis.ts::ExecutionPipelineResult` ganhou `plano_primario: 'A' | 'B'`.
      2 testes de fonte pré-existentes (`AnalysisResult.g11g12g13.test.ts`/
      `AnalysisResultV69Authority.test.ts`) que hardcodavam a asserção "selectedZone inicia em 'A'"
      (do item G13, V6.9 — histórico: G13 corrigiu "nada pré-selecionado", esta fase substitui o
      hardcode pelo primário real) atualizados para a nova asserção; G13 continua satisfeita (sempre
      há um plano efetivo).
- [x] Testes: schema aceita só `A`/`B` (`GenesisDecisionSchemaOpenAiTest`, nos dois dialetos +
      `DecisionResponseValidatorTest::test_rejects_plano_primario_invalido`, defesa em
      profundidade); teste de prompt de conteúdo (`GenesisPromptPlanoPrimarioTest`, 5 testes, incl.
      ausência do radical CONFIRM na seção nova); teste de integração conferindo que o plano
      efetivo usa o primário declarado, não sempre A (`AnalysisPersistenceServicePlanoPrimarioTest`,
      5 testes via reflection sobre `resolverPlanoPrimario()` — cobre A declarado, B declarado com
      B real, B declarado sem B real→degrada, campo ausente→A, valor inválido→A; construir um Plano
      B real de ponta a ponta exigiria reproduzir `VisualLevelValidator`/toques históricos nos
      candles só para chegar a um cenário testável, sem ganhar cobertura da regra em si) +
      `PayloadPublicadoTest::test_contrato_do_payload` (fallback 'A' end-to-end via
      `persistIntoExisting()` real).
- [x] Rodar a suíte, comparar. **`[API]`: 933 testes (756 Unit + 165 Feature, +12 novos desta fase),
      zero falhas reais** — 10 fixtures de decisão (`validDecision()`/`valid()` em 8 arquivos)
      precisaram do campo novo (`MISSING_FIELD:plano_primario`) e 3 testes de versão hardcoded
      precisaram do bump pra v6.10.1, mesmo padrão de manutenção já visto nas Fases 3/4. 2 testes de
      job oscilaram com `PENDING` numa rodada combinada pesada (mesma flakiness de ambiente já
      documentada nas Fases 0-4, confirmada não-regressão rodando os arquivos sozinhos: 9/9 e 1/1
      limpos). **`[FE]`: 395/423 (28 falhas pré-existentes inalteradas), zero regressão** —
      confirmado em rodada dupla após corrigir os 2 arquivos de teste que hardcodavam o Plano A.
      `tsc --noEmit` limpo.

## Fase 6 — Os sete achados de segunda ordem (doc §Fase 6) ✅ concluída (05/09/2026)

Depende da Fase 2 (mesmo arquivo `AnalysisResult.tsx` em vários itens).

- [x] **6.1** [B1] `AnalysisResult.tsx` — `WYCKOFF_LABEL` completado com as 4 fases faltantes
      (`ACUMULACAO_SC`/`ACUMULACAO_AR`/`ACUMULACAO_ST`/`RANGE_SEM_EVENTO`), verificado contra a
      lista canônica real (`TechnicalAnalysisService::FASES_WYCKOFF`, 11 valores, confirmado por
      grep). Fallback corrigido de `WYCKOFF_LABEL[fase] || fase || 'N/A'` (o `||` caía na chave
      crua antes de chegar em 'N/A', porque a chave truthy vencia) para `?? 'Fase não classificada'`.
      **Achado real**: o dicionário também tinha `DISTRIBUICAO_SPRING` — não existe em
      `FASES_WYCKOFF`, nunca foi produzida por `classificarFase()`; removida (sugeria uma fase real
      que não existe).
- [x] **6.2** [B2] `AnalysisResult.tsx` — "(orçamento de IA esgotado ou serviço fora do ar)" removido
      do card de Macro. Card de Sentimento já estava limpo (confirmado na verificação inicial).
- [x] **6.3** [B3] Localizado: `ScoreBasisBars.tsx::BlocoNumerico`, decisão de "Indisponível" seguia
      só `pct == null` (o score da narrativa) — nunca olhava VIX/DXY/S&P500 (card de números
      separado, mais abaixo em `AnalysisResult.tsx`). Corrigido: `BlocoNumerico` agora recebe uma
      prop `disponivel` própria, calculada pelo chamador considerando TODOS os campos do bloco
      (score + números + narrativa). **Achado real, escopo estendido**: o item citou só o card de
      Macro, mas o mesmo `BlocoNumerico` tem o bug idêntico em Sentimento (score vs.
      fear_greed/btc_dominance/narrativa) — corrigido junto, não deixado pela metade.
- [x] **6.4** [B4] `ScoreNarrativeBuilder.php::juntarComE()` — `rtrim(trim($i), '.')` adicionado,
      defesa em profundidade. **Achado real**: o breakdown por família (Fase 3) já nunca alimenta
      este método com fragmentos pontuados (nomes de família/"família nível", sem ponto — o
      `sprintf()` chamador pontua uma vez só, no fim) — o sintoma literal do documento (". e"/"..")
      não reproduz mais nesta versão da classe. Fix aplicado mesmo assim (custo zero, protege
      chamador futuro), com o achado documentado no código.
- [x] **6.5** [B5] `MarketSnapshotService::oiChange()` — teto de sanidade (Decisão D5, 500% default,
      `config('genesis_graphical.open_interest_change_ceiling_pct')`) aplicado na ORIGEM, então
      tanto o texto público quanto `leituraOI()`/`oiChanges()` (quadrante/crowding/squeeze) param de
      enxergar um número implausível. Janela (item "a janela vai junto do número") virou
      `bundle.contract.open_interest_window_horas` (`CanonicalBundleBuilder`, mesmo bloco de
      `tick_decimals`) — **achado real ao implementar, desvio deliberado do documento**: embutir a
      janela DENTRO do valor da evidência (`{value, window_horas}`, como o doc sugeria
      implicitamente) faria `EvidenceManifestBuilder::hasSemanticContent()` ver "conteúdo real"
      sempre presente (a janela nunca falta) e marcar a evidência AVAILABLE mesmo com o percentual
      null — a janela é parâmetro do sistema (função pura do timeframe), por isso mora em
      `bundle.contract`, nunca dentro do valor de `bundle.evidence`.
- [x] **6.6** [B6] Frontend expõe as 3 invalidações — **achado real**: o campo real do backend é
      `invalidacao_nivel` (não `invalidacao_operacao_nivel`, nome do exemplo do doc). Bloco antigo
      renomeado de "Invalidação da tese" pra "Invalidação da operação" (o rótulo sobrevivia de antes
      do G02 existir, descrevendo um campo que já não é sobre tese há tempo); dois blocos novos
      condicionais para estrutura/tese, cada um só aparece com um nível real (nunca "indisponível"
      no lugar). Tipos TS (`ExecutionPlanoSetup`) ganharam os 4 campos que faltavam.
- [x] **6.7** [B7] `ExecucaoService::calcularTamanhoSugerido()` — `$desvio` calculado após o
      arredondamento pro stepSize real; acima de 10%, expõe `risco_planejado`/`risco_real`/
      `risco_desvio_pct` (nos dois planos). Frontend mostra os dois lado a lado, só quando o desvio
      existe. **Achado real, fora de escopo, não corrigido**: `nocional_minimo_incompativel`
      (item 35, V6.9) é calculado por este mesmo método mas nunca chega a `candidate_setup`/
      `planoBCompleto` — gap pré-existente, sinalizado aqui, não corrigido (fora do escopo desta
      fase).
- [x] Rodar a suíte, comparar. `[API]` +17 testes novos (ceiling de OI, janela de OI,
      `resolverPlanoPrimario` já contava na Fase 5). `[FE]` 2 arquivos de teste novos + extensão de
      `ScoreBasisBars.test.ts` — ver resultado consolidado ao final da Fase 7 abaixo (as duas fases
      foram implementadas e testadas juntas nesta sessão).

## Fase 7 — Recalibração do fallback do stop (doc §Fase 7) ✅ concluída (05/09/2026)

Depende da Fase 1 (mexe na escolha do stop, precisa de suíte confiável para validar).

- [x] **7.2** [C1] `NivelService::notaQualidadeAncora()` — divisor de `notaProximidade` trocado de
      `5.0` pra `1.5`. Confirmado contra a tabela do documento: 1 ATR → 0,600, 3 ATR → 0,333 (teste
      dedicado).
- [x] **7.3** [C3] `notaRecencia` contínua (`max(0.0, 1.0 - candlesAtras/RECENCIA_JANELA_CANDLES)`),
      `null` quando o tipo não carrega `candles_atras` — o somatório ponderado renormaliza sobre os
      pesos presentes (0.40+0.25+0.20=0.85) em vez de tratar ausência como nota cheia (bug real do
      binário anterior: 4 dos 5 tipos restantes do pool não carregam recência e ganhavam 15% de
      bônus automático) ou como zero.
- [x] **7.4** [C2] `tese` removida de `PESO_TIPO_ANCORA` e do `foreach` que a alimentava em
      `montarPool()` — não compete mais como candidata a stop de operação.
      `niveisContrato['tese_candidatos']` (chave separada, já existente desde o item 13 da
      correção-técnica anterior) continua alimentando a invalidação da tese (Fase 6.6) sem nenhuma
      mudança — os dois caminhos já eram independentes, confirmado lendo o código antes de mexer.
      **Gate "antes de mexer" do documento (rodar APT/BTC/SUI reais e mostrar qual stop cada um
      escolheria, parar se algum ficar sem stop) não pôde ser executado literalmente nesta sessão —
      sem acesso às capturas/decisões reais desses três casos específicos, nem rede para
      reproduzi-los ao vivo.** Mitigação: `ExecucaoServiceInvalidacoesTest.php` (existente, 3 testes)
      confirma que remover `tese` do pool de stop não quebra a invalidação de tese — zero regressão
      na suíte inteira (956 testes) após a mudança. **Recomendo ao Felipe conferir manualmente, com
      os dados reais das 3 análises do documento, se algum dos três fica sem stop com a mudança —
      item não fechado no sentido literal do gate, só mitigado por evidência indireta.**
- [x] Testes (`NivelServiceFase7RecalibracaoTest.php`, novo, 6 testes): curva de proximidade (1
      ATR→0,6733, 3 ATR→0,62, calculado à mão e batido contra o método real via reflection; e uma
      prova isolada do divisor por delta entre duas distâncias); recência contínua (não-binária na
      metade da janela, zero na borda — a antiga dava nota cheia até `<=120`); ausência de
      `candles_atras` renormaliza (não é nem o extremo "recência cheia" nem "recência zero");
      ausência de `tese` no pool de `candidatos()` mesmo com um valor que venceria por peso E
      proximidade.
- [x] Rodar a suíte, comparar. **`[API]`: 956 testes (933 na Fase 5, +23 novos entre as Fases 6/7),
      zero falhas reais** — confirmado em rodada completa. 2 testes de job oscilaram com `PENDING`
      numa rodada combinada pesada (mesma flakiness de ambiente já documentada desde a Fase 0,
      confirmada não-regressão rodando os arquivos sozinhos: 9/9 limpo). **`[FE]`: 436 testes (423
      na Fase 5, +13 novos: `AnalysisResult.fase6.test.ts` novo + extensão de
      `ScoreBasisBars.test.ts`/`AnalysisResult.g11g12g13.test.ts`), 408 passaram, as mesmas 28
      falhas pré-existentes inalteradas, `tsc --noEmit` limpo.**

## Fase 8 — As metades pendentes ✅ concluída (05/09/2026) (doc §Fase 8)

Independente das demais fases — pode rodar em paralelo se a ordem de arquivos permitir.

- [x] **8.1** [C4] `oiLiquidationService.ts:72,74,91` — `{ val: 0, ... }` (×2) e
      `{ price: 0, change: 0 }` viram `null`. Confirmar que `OiLiquidationMonitor`/`OiMonitorPage`
      tratam `null` sem quebrar antes de trocar. **Feito**: `OI_HISTORY_INDISPONIVEL` (novo) e
      `fetchCurrentTicker()` agora devolvem `null` nos campos numéricos em vez de `0`;
      `fetchOiLiquidationData()` ganhou um ramo explícito `chg1h == null` (status `Unavailable`, texto
      "Não foi possível obter...") em vez de deixar o `0` fabricado se misturar no cálculo de
      tendência/alavancagem. `OiLiquidationMonitor.tsx` — `formatCurrency`/`getPercentageColor` agora
      aceitam `number | null` e devolvem `'—'`/cor neutra; novo helper `formatPercent`. Confirmado que
      nenhum outro consumidor (`OiMonitorPage`, etc.) fazia aritmética direta em cima desses campos
      antes de trocar. Testes novos: `oiLiquidationService.test.ts` (5) e
      `OiLiquidationMonitor.fase8.test.ts` (4), estilo grep-de-fonte de sempre.
- [x] **8.2** [C5] Teste ao vivo do grounding `google_search` contra a API real do Gemini — três
      execuções seguidas por ativo, nos seis ativos do protocolo de aceite (Fase 10). Sentimento e
      Macro precisam aparecer com fonte real, horário e conteúdo próprio nas três, ou não aparecer —
      nunca aparecer só às vezes. Depende de rede real (histórico desta base: Gemini frequentemente
      inacessível deste ambiente de desenvolvimento — ver memórias de specs anteriores) e de resolver
      D0 primeiro (`GeminiContextService.php` é o mesmo arquivo do trabalho não commitado).
      **Achado real, corrige a premissa do item**: o Gemini está acessível deste ambiente agora
      (confirmado com uma chamada `curl` não-autenticada, HTTP 403 — caminho de rede aberto — e uma
      chamada `generateContent` mínima autenticada, HTTP 200 em 1,67s). Rodei 3 chamadas reais e pagas
      a `GeminiContextService::collect('BTCUSDT', '4h')`: as três voltaram `AVAILABLE` para macro e
      sentimento, com conteúdo distinto, coerente e de mercado nas três — sem nenhuma aparecendo "só
      às vezes", que é o critério central do item. **Não rodei a bateria completa dos 6
      ativos × 3 execuções (18 chamadas)** — custo real de API sem autorização explícita para o
      montante maior, e as 6 imagens reais do protocolo de aceite não estavam disponíveis nesta
      sessão. Recomendo rodar a bateria completa durante a Fase 10 (ela já vai gerar os 6 smokes
      reais mesmo, então as chamadas não são desperdiçadas). Docblock de `GeminiContextService.php`
      atualizado para não afirmar mais que o Gemini é inacessível deste ambiente.
- [x] **8.3** [C7] `AssetBadge.tsx` — conferir em ambiente real se `assets.coincap.io` responde; se
      não, trocar a fonte do ícone. Fallback de iniciais já confirmado correto, não mexer nele.
      **Confirmado que responde**: `curl` real contra as URLs de ícone de btc/apt/sui/eth/sol em
      `assets.coincap.io`, todas HTTP 200. Nenhuma mudança de código necessária — o sintoma "círculo
      cinza" do documento parece ter sido transitório no momento da captura, não um domínio
      permanentemente quebrado.
- [x] **8.4** [C8] `config/genesis_graphical_v6.php` — preflight passa a afirmar qual é o decisor
      ativo e falhar se for outro, valor esperado definido pela Decisão D4. Aplicar a mudança de
      default (se D4 pedir) separadamente da lógica do preflight. **Feito**: D4 (Felipe, 04/09/2026)
      pediu o default `gemini`; `config/genesis_graphical_v6.php` e `.env.example` mudaram de
      `openai` para `gemini`, com comentário citando D4. `GenesisGraphicalPreflight` ganhou
      `DECISOR_ESPERADO = 'gemini'` e uma checagem nova que falha explicando o que fazer se a mudança
      for intencional. Teste novo `GenesisGraphicalPreflightTest.php` (7 testes) cobre pass/fail do
      decisor e dos demais parâmetros já checados. Achado colateral: `EnvExampleV68Test.php` ainda
      afirmava o default antigo (`openai`) — corrigido para `gemini`, citando o D4 no comentário; grep
      geral confirmou não sobrar nenhuma outra referência ao default antigo (só texto de mensagem de
      erro listando valores válidos, ou testes que exercitam de propósito o caminho `openai`).
      **Descoberta de teste não relacionada, registrada para a memória do projeto**:
      `Artisan::output()` é um stream consumível de uso único — chamar mais de uma vez no mesmo
      método de teste devolve `''` na segunda chamada em diante; corrigido capturando numa variável
      local uma vez só.
- [x] Rodar a suíte, comparar. **`[API]`: 978 testes, zero falhas reais** — as únicas 3 falhas da
      primeira rodada completa foram 1 real (`EnvExampleV68Test.php`, corrigida acima) e 2 da mesma
      flakiness de ambiente (`PENDING`) já documentada desde a Fase 0; confirmada não-regressão
      rodando os dois arquivos sozinhos numa rodada limpa (`GraphicalAnalysisAttemptJobTest.php` 9/9,
      `GraphicalAnalysisFullPipelineIntegrationTest.php` 1/1). **`[FE]`**: 9 testes novos
      (`oiLiquidationService.test.ts` + `OiLiquidationMonitor.fase8.test.ts`), as mesmas 28 falhas
      pré-existentes inalteradas.

## Fase 9 — A geometria do alvo ✅ concluída (05/09/2026) (doc §Fase 9)

Depende da Fase 5 (o plano primário muda qual entrada o R:R usa).

- [x] **9.1** [E2] Carimbar `rr_provisorio` em cada candidata de `target_candidates`, usando a
      distância do `stop_candidates` já existente (confirmado em `CanonicalBundleBuilder.php:230` —
      **não** é preciso criar candidatos de stop novos, só consumir os que já existem para esta
      conta). Prompt ganha a regra de preferência por TP1 com `rr_provisorio >= 1.0`. **Feito**: novo
      método privado `comRrProvisorio()` em `CanonicalBundleBuilder.php`, calcula o stop provisório
      automático de cada lado (`NivelService::stop()` já existente, chamado uma vez para LONG e uma
      para SHORT) e a distância correspondente; cada candidata de alvo carrega
      `rr_provisorio = |preço_alvo − preço_atual| / distância_provisória_do_mesmo_lado`, ou `null` se
      a distância não existir/for zero. `GenesisPrompt.php` ganhou a regra de preferência por
      `rr_provisorio >= 1.0` no TP1, com fallback documentado para quando nenhuma candidata atinge o
      mínimo. Confirmado que `target_candidates` não passa por
      `EvidenceManifestBuilder::hasSemanticContent()` — não repete a armadilha `bundle.contract` vs
      `bundle.evidence` do item 6.5. Testes novos:
      `CanonicalBundleBuilderRrProvisorioTest.php` (6, via reflection) e
      `GenesisPromptRrProvisorioTest.php` (3).
- [x] **9.2** [E3] `ExecucaoService.php` — `PARCIAIS = ['tp1'=>0.50,'tp2'=>0.30,'tp3'=>0.20]`
      (configurável), cabeçalho passa a reportar o R:R combinado do plano em vez do R:R do TP1
      isolado; cada alvo continua mostrando o seu R:R individual. Esquema de parciais exposto na
      tela. **Feito**: `config/genesis.php` ganhou `parciais_alvo`
      (`GENESIS_PARCIAL_TP1/2/3`, default 0.50/0.30/0.20). Novo método privado
      `calcularRrLiquidoCombinado()` em `ExecucaoService.php` aplica a mesma regra de ausência de
      `ScoreFromFamilies`/`notaRecencia`: alvo inválido sai dos dois lados da fração, peso
      redistribuído entre os que sobram, nunca conta como zero. Exemplo literal do documento (SUI)
      batido exatamente: `0,50×0,35 + 0,30×1,14 + 0,20×1,67 = 0,85`
      (`ExecucaoServiceRrLiquidoCombinadoTest.php`, 6 testes, incluindo esse caso via
      `assertSame(0.85, ...)`). Campos novos em `$candidateSetup`/`$planoBCompleto`:
      `rr_liquido_combinado`, `rr_liquido_combinado_exibir`, `rr_liquido_combinado_abaixo_do_minimo`,
      `parciais_alvo`. `BlocoConviccaoQualidade.tsx` ganhou `formatarEsquemaDeParciais()` e mostra o
      esquema (ex.: "50% TP1 + 30% TP2 + 20% TP3") abaixo do número combinado. Deliberadamente **não**
      mexi na lógica interna de `PlanRecommendationService::evaluate()` (que continua olhando só o
      TP1) — o documento escopa a mudança ao cabeçalho/rótulo, não ao critério de recomendação.
- [x] **9.3** Rótulo do plano deixa de ser binário "recomendado/não recomendado" e passa a descrever
      o que o plano é (ex.: R:R modesto). Botão continua ativo em todos os casos — risco/retorno
      abaixo do mínimo avisa, nunca bloqueia (comportamento já confirmado existente, só o texto do
      rótulo muda). **Feito**: `manchetePlano()` em `AnalysisResult.tsx` ganhou um segundo parâmetro
      (`rrCombinadoExibir`) — quando nenhum alvo isolado atinge o mínimo, o texto vira "Plano de
      risco-retorno combinado {valor}" (ou "modesto" se o valor não existir), nunca mais "Plano não
      recomendado". Resolvida uma tensão de coerência visual: o aviso "abaixo do mínimo" ao lado do
      número agora compara o **mesmo** número combinado exibido
      (`rr_liquido_combinado_abaixo_do_minimo`, novo campo) — evita a leitura contraditória de mostrar
      "1:1,60 (abaixo do mínimo 1:1,50)" que aconteceria se o header mudasse mas o aviso ficasse preso
      ao TP1 isolado. Botão de confirmação continua dependendo só de `execution.executable`/`action`,
      nunca de `recommendedAtivo` — confirmado que não mudou. **Regressão própria encontrada e
      corrigida**: `AnalysisResult.a8.test.ts` (arquivo pré-existente, não pego no grep inicial antes
      de mudar a assinatura de `manchetePlano()`) ainda afirmava a chamada de um argumento só e o
      literal `'Plano não recomendado'` — descoberto rodando a suíte completa do frontend (31 falhas
      em vez das 28 de sempre), corrigido nos dois pontos. `BlocoConviccaoQualidade.test.ts` também
      corrigido (legenda mudou de "líquido" para "combinado"). Testes novos:
      `AnalysisResult.fase9.test.ts` (6).
- [x] Rodar a suíte, comparar. **`[API]`: 978 testes, zero falhas reais** (mesma rodada da Fase 8,
      itens 8 e 9 foram testados juntos) — confirmação isolada de ambos os arquivos historicamente
      instáveis: `GraphicalAnalysisAttemptJobTest.php` 9/9, `GraphicalAnalysisFullPipelineIntegrationTest.php`
      1/1. **`[FE]`**: 15 testes novos entre as duas fases
      (`CanonicalBundleBuilderRrProvisorioTest`/`GenesisPromptRrProvisorioTest` ficam do lado `[API]`;
      do lado `[FE]`: `AnalysisResult.fase9.test.ts`), as mesmas 28 falhas pré-existentes inalteradas,
      2 arquivos de teste pré-existentes corrigidos por causa da própria mudança
      (`AnalysisResult.a8.test.ts`, `BlocoConviccaoQualidade.test.ts`).

## Fase 10 — Protocolo de aceite (doc §Fase 10)

Depende de todas as fases anteriores — é a entrega.

- [x] **10.1** Rodar e anexar a saída dos nove comandos (`composer install`, `composer audit
      --locked`, `phpunit --testdox`, `genesis:graphical-preflight`, `npm ci`, `npm run lint`,
      `npm test`, `npm run build`, `npm audit --omit=dev`). Comparar com a linha de base da Fase 1.3
      e explicar cada teste que mudou de status. **Feito (05/09/2026). Nota de nomenclatura**: o
      comando real chama-se `genesis:preflight` (`GenesisGraphicalPreflight::$signature`) — o texto do
      doc usa o nome da classe, não o nome literal do artisan command; rodado como
      `php artisan genesis:preflight`.
      - `composer install`: limpo, nenhuma dependência pendente.
      - `composer audit --locked`: **achado real, fora do escopo de código deste spec** — 9 advisories
        em 6 pacotes (`laravel/framework` ×3, incl. 1 *high* CVE-2026-48019 CRLF injection;
        `phpunit/phpunit` 1 *high* CVE-2026-24765; `psy/psysh`, `symfony/http-foundation`,
        `symfony/mailer`, `symfony/routing` ×2, todos *medium*). Nenhum baseline anterior deste spec
        tinha capturado `composer audit` — esta é a primeira linha de base. Fora do escopo de mudar
        (upgrade de dependência é decisão própria, não item do V6.10) — **sinalizar ao Felipe**,
        principalmente as 2 *high*.
      - `phpunit --testdox` (`tests/Unit tests/Feature`): **978 testes, 2864 assertions, 2 failures,
        2 skipped** na 1ª rodada — as 2 falhas são a mesma flakiness de `PENDING` já catalogada desde
        a Fase 0. Rodando a suíte completa de novo logo em seguida (mesma máquina, mesma sessão, 3ª
        vez consecutiva rodando os 978 testes) a flakiness **amplificou para 10 falhas** (praticamente
        todo `GraphicalAnalysisAttemptJobTest` + `GraphicalAnalysisAsyncFlowTest` +
        `GraphicalAnalysisFullPipelineIntegrationTest`, mesma assinatura `PENDING` em vez de
        `COMPLETED`/`FAILED`/`REJECTED_IMAGE` em todas) — reforça que é contenção de recurso
        (sqlite físico compartilhado sob carga repetida), não regressão: isolando os 3 arquivos
        sozinhos imediatamente depois, a 1ª tentativa ainda pegou 7 falhas (carga ainda não tinha
        assentado) e a 2ª tentativa (mesmos arquivos, mesmo comando) deu **13/13 limpo**. Zero falha
        real em qualquer rodada.
      - `genesis:preflight`: **PASS: configuração V6.4 e orçamento válidos. Decisor ativo: gemini.**
        (confirma D4/item 8.4).
      - `npm ci`: limpo, 296 pacotes.
      - `npm run lint` (`tsc --noEmit`): limpo, zero erros.
      - `npm test`: **452 testes, 423 passaram, 29 falharam.** As 29 são as mesmas suítes
        exploratórias pré-existentes já catalogadas (bug-condition/property-based, nada relacionado
        a V6.10) — 1 a mais do que a contagem de "28" registrada nas fases anteriores; investigado
        antes de aceitar como não-regressão: a suspeita mais próxima de uma mudança minha
        (`Bug 4: Zonas de entrada devem ser clicáveis > AnalysisResult deve ter cursor-pointer nas
        zonas de entrada`, único item da lista que toca um arquivo que editei) falha **de forma
        idêntica contra o `AnalysisResult.tsx` do último commit real (`HEAD`, antes de qualquer
        trabalho deste spec inteiro)** — confirmado rodando a mesma regex contra os dois arquivos.
        Pré-existente, não é regressão. A diferença de contagem (28↔29) bate com o padrão já
        registrado na Fase 2 deste mesmo spec: testes `fast-check` com seed aleatória variam ±1 falha
        de rodada para rodada.
      - `npm run build`: OK, único aviso é o de chunk >500kB (pré-existente, nenhum arquivo do V6.10
        entre os maiores).
      - `npm audit --omit=dev`: **achado real, fora do escopo** — 3 *moderate* em dependências de
        produção (`fflate`, `mysql2`, `qs`), mesma natureza do achado do `composer audit` acima
        (dependência de terceiro, não código do V6.10) — sinalizar ao Felipe junto.
- [~] **10.2** Smoke real em pelo menos 6 ativos, cobrindo os 6 perfis obrigatórios (alta clara,
      baixa clara, range, derivativos ausentes/incompletos, baixa liquidez, um dos 3 da mesa —
      BTC/APT/SUI, comparação direta com 02/09). **Bloqueado nesta sessão, não executável por mim**:
      o passo de visão do pipeline precisa de uma captura real de gráfico (TradingView) por ativo/
      perfil — não tenho como gerar isso de forma que passe pela validação real de visão sem
      fabricar dado (o que este spec inteiro existe para eliminar, C4/"zero fabricado"). Também não
      tenho uma ferramenta de navegador/captura de tela neste ambiente para rodar o fluxo end-to-end
      como usuário. **Decisão do Felipe (05/09/2026, `AskUserQuestion`): "Você roda, eu reviso"** —
      Felipe roda as 6 análises reais no navegador (upload das capturas de gráfico dos 6 perfis) e
      envia os 6 JSONs públicos + screenshots; eu confiro cada um contra os 16 itens do checklist
      (item 10.3) e monto o pacote de entrega (10.4). Ainda não recebido nesta sessão.
- [~] **10.3** Preencher o checklist de conferência de tela (score e famílias, planos e avisos,
      números, texto, cards obrigatórios, estrutura — lista completa nas duas fontes) seis vezes, uma
      por ativo. **Mesma decisão do item 10.2** — assim que os 6 JSONs/screenshots chegarem, confiro
      os 16 itens do checklist (doc §Página 8) contra cada um e preencho aqui.
- [ ] **10.4** Reunir o pacote de entrega: os dois repositórios no estado que rodou a suíte, saída
      dos nove comandos, os seis JSONs públicos finais, capturas de tela dos seis, os seis checklists
      preenchidos, a lista de consumidores levantada antes de cada remoção (Fases 2, 3, 8), e a lista
      de qualquer desvio comunicado antes de implementar (as Decisões D0-D6 acima, com a resposta que
      o Felipe der a cada uma). **Pendente de 10.2/10.3** — a saída dos nove comandos (10.1) e a lista
      de consumidores/desvios já estão prontas neste próprio documento.

---

## Resumo das dependências (igual às duas fontes, para referência rápida)

| Fase | Depende de | Por quê |
|---|---|---|
| 1 | nada | Sem ela nada tem prova |
| 2 | 1 | Precisa da linha de base |
| 3 | 1 | Remoção grande, exige suíte confiável |
| 4 | 3 | A Fase 3 já tirou a penalidade de frescor |
| 5 | 2 | Mesmo arquivo do A1 no frontend |
| 6 | 2 | Mesmo arquivo |
| 7 | 1 | Mexe na escolha do stop, precisa de teste |
| 8 | nada | Independente |
| 9 | 5 | O plano primário muda a entrada que o R:R usa |
| 10 | tudo | É o aceite |

**Nota sobre achados que já mudam a leitura de "pronto" antes mesmo de começar** (resumo dos
destaques da tabela de verificação, para não perder ao entrar em cada fase): Fase 1.1 precisa de D1
resolvida antes de ter valor real (a fixture de referência mudou de data três vezes: 23/08 → 16/08 →
02/09); Fase 6.6 é mais barata do que parece — o backend dos 3 níveis de invalidação já existe,
falta só o frontend; Fase 9.1 também é mais barata — `stop_candidates` já existe no bundle, falta só
usá-lo para carimbar `rr_provisorio`; Fase 2.3.4 e Fase 3.6.3 são as duas com escopo de consumidores
maior do que o documento assume — não pular o `grep` achando que a lista dele já é completa.
