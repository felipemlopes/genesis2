# Plano de Implementação: Gênesis V6.11, hotfix final

**Status deste documento**: criado como planejamento puro em 10/09/2026, a pedido do Felipe ("analise
e crie um plano spec estilo kiro para eu ver. não altere nada ainda"). **Nenhum item foi executado.**
Nenhum arquivo de código foi tocado — só este `tasks.md` e a cópia do documento-fonte foram criados.
Este arquivo é para revisão antes de qualquer fase começar.

## Fontes

`GENESIS_V6_11_HOTFIX_FINAL_FELIPE.md` — documento único do Felipe, com 16 itens P0 + 3 itens P1,
organizado a partir de "auditoria anterior do Claude/Cloud + `correcoes-v6.11-felipe.md` + testes
reais BTCUSDT, ZECUSDT e SUIUSDT de 09/09/2026". Cópia byte-a-byte no mesmo diretório deste
`tasks.md` — SHA-256 `3ab2837eafe3d38e1542cecba96b33aef615e3469b42f20f84ea3b0e318a7f18`. Este plano não
duplica os blocos de código do documento — só referencia o item.

**Este spec é a continuação direta de [[genesis-v6-11-correcao-tecnica]]** (spec anterior, Fases 0-7
✅ concluídas em 09/09/2026, commit `a4ffcc4`). O próprio título do documento-fonte ("hotfix final")
e a menção a "backend 46 / frontend 32" (contagem de arquivos/itens já corrigidos, listada na seção
"Itens da auditoria Claude/Cloud que já estão corrigidos") confirmam que ele foi escrito **depois**
daquele spec estar no ar, a partir de análises reais rodadas em produção no dia seguinte. Não é uma
auditoria do zero — é uma segunda rodada, encontrando problemas que só apareceram com dado real.

**Repositórios**: **[API]** = `E:\Programas\wamp64\www\genesis-api` (branch `genesis2`, HEAD
`94f5bbe`) · **[FE]** = `C:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main` (branch
`master`, HEAD `a4ffcc4`).

⚠️ **Nenhum dos dois repositórios está limpo**, ao contrário do spec anterior:

- **[API]** tem 5 arquivos modificados + 4 novos, todos de uma frente completamente diferente e não
  relacionada (a extração de auth/créditos para o microserviço `genesis_auth` —
  `GenesisAuthClient.php`, `VerifyGenesisAuthToken.php`, mudanças em `CreditController.php` e
  `Kernel.php` — bate com o spec [[genesis-microservico-auth-creditos]], cuja Fase 9.4 está
  deliberadamente pendente de confirmação).
- **[FE]** tem `.env.example` e `services/api.ts` modificados (não inspecionados ainda — podem já ser
  parte do hotfix P0.16 sendo testado manualmente, ou sobra de outra coisa) + o diretório novo
  `.kiro/specs/genesis-microservico-auth-creditos/` sem versionar.

Isto precisa virar uma decisão explícita antes da Fase 0 (ver D0 abaixo) — este plano não presume
nada sobre o que fazer com esse trabalho.

---

## Verificação contra o código real (10/09/2026) — antes de aceitar qualquer item

Conferi os arquivos citados nos itens mais estruturais do documento (P0.1, P0.2, P0.4, P0.5, P0.6,
P0.10, P0.11, P0.12, P0.14, P0.15, P0.16) diretamente no código de hoje. Não abri todos os arquivos
citados linha a linha (ex.: `BlocoConviccaoQualidade.tsx`, `types/graphicalAnalysis.ts` por completo,
`GeminiVisionService`) — a verificação abaixo cobre o que sustenta o "antes" de cada item, não é uma
auditoria completa de todos os 71 arquivos possivelmente afetados.

### Confirmado exatamente como o documento descreve

- **P0.1** — `rr_provisorio` existe de fato em `CanonicalBundleBuilder.php` (bloco
  `comRrProvisorio()`, comentário de origem: spec `genesis-v6-10-implementacao`, Fase 9, item 9.1) e
  `GenesisPrompt.php:161` manda preferir TP1 com `rr_provisorio >= 1.0`, exatamente a regra a apagar.
- **P0.2** — `CanonicalBundleBuilder.php:193` chama `niveisContratoBuilder->build($manifest['items'], ...)`
  direto, sem nenhuma injeção de `visual.levels` antes — confirmado que os níveis de
  supports/resistances da Vision não entram no pool de `stop_candidates` hoje.
- **P0.4** — `DecisionResponseValidator.php` só valida `plan_b_entry_notes` (nulidade/tamanho de
  texto). Nenhuma validação estrutural de `entry_candidate_id`, `trigger` ou `target_selection` do
  Plano B existe — confirmado, é lacuna real.
- **P0.5.1** (lado fixo) — `PlanoBService.php:88`, `if ($isShort ? $entradaB <= $preco : $entradaB >= $preco) return $this->indisponivel('ENTRADA_B_DO_LADO_ERRADO');` — confirmado, ainda trava B do lado de pullback/repique.
- **P0.6** — `PlanoBService.php:137-147` chama `$this->nivel->stop($isShort, $entradaB, $atr, $niveisContrato, [], [], $spreadBps, $slippageBps, ...)` — os dois arrays vazios são exatamente pivôs e candles. `PivoService::relevantes(array $candles, float $preco, float $atr): array` já existe com a assinatura que o item assume — a integração é direta.
- **P0.10** — `rr_liquido_combinado`/`rr_liquido_combinado_exibir`/`rr_liquido_combinado_abaixo_do_minimo`/`parciais_alvo` confirmados em `ExecucaoService.php` **e** em `AnalysisResult.tsx` (linhas 369, 582, 585, 586) **e** em `types/graphicalAnalysis.ts` **e** em um teste dedicado, `AnalysisResult.fase9.test.ts`.
- **P0.11** — `PlanRecommendationService::primeiroAlvoAcimaDoMinimo()` existe e é usado (`$alvoQueAtende = $alvoBom['rotulo']`). Também referenciado por comentário em `AnaliseController.php:183` como conceito já citado antes (não é código morto).
- **P0.12** — `AnalysisResult.tsx:278-279` tem exatamente a cadeia `planos.find((p) => p.plano === zonaEfetiva) || planos.find((p) => p.plano === 'A') || ...` e, mais grave, o padrão `planoAtivo?.campo ?? setup?.campo` se repete em **dezenas** de linhas (risco, liquidação, alavancagem, RR, avisos, capital base, margem, verificação de segurança) — bem mais amplo do que os ~20 campos que o item lista explicitamente. O comentário do próprio código (linha 274) já registra a intenção de "trocar TODOS os campos juntos" — ou seja, uma tentativa anterior (V6.9/V6.10) começou este trabalho mas não eliminou os fallbacks residuais.
- **P0.14** — `GENESIS_BINANCE_API_KEY`/`GENESIS_BINANCE_API_SECRET`/`GENESIS_RISCO_POR_ANALISE` **não existem** em `.env.example` hoje. `GenesisGraphicalPreflight.php` **não tem nenhuma verificação** de Binance, fila ou ambiente de produção — confirmado, é adição nova, não conflita com nada.
- **P0.15** — `ExecucaoService::periodosFunding()` (linha 1233) — não li os valores exatos linha a linha agora, mas a Fase 6 do spec anterior (`V611Fase6CoberturaTest::test_timeframe_1w_escala_o_custo_de_funding_pelos_periodos_corretos`) documenta explicitamente "135 períodos" para `1w` publicados de verdade no pipeline em 09/09/2026 — confirma que a tabela antiga (45/135) **continua em produção**, o V6.11 anterior não mexeu nela.
- **P0.16** — `.env.example` do backend confirmado com `QUEUE_CONNECTION=sync` (linha 28). `services/api.ts:1` confirmado com `const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';` — exatamente o fallback que o item quer eliminar.

### Confirmado, mas com ressalva real para quem for implementar

| Item | O que o código faz hoje, exatamente | Por que importa para a implementação |
|---|---|---|
| **P0.1** (remover `rr_provisorio`) | `rr_provisorio` não é um acidente — é o item 9.1 da Fase 9 do spec `genesis-v6-10-implementacao` (05/09/2026), implementado e testado de propósito ("orientar a preferência de TP1"). | Este hotfix reverte uma decisão de produto deliberada e recente, não corrige um bug introduzido por engano. Confirmar com Felipe/Fabrício antes de apagar — ver **D1** abaixo. |
| **P0.5.2** (remover dependência de `ancoraInvalidacaoPlanoA`) | `ExecucaoService.php:499-506` passa esse argumento com um comentário extenso explicando que ele existe por causa do **item D5 do spec `genesis-v6-9-pacote-final`**, com teste dedicado `PlanoBClampAncoraD5Test` — protege contra a zona/entrada B cair na faixa que a tela já rotula "tese invalidada" do Plano A. | Remover isto sem mais nada apaga uma proteção específica, testada, que existe por um motivo documentado (não é acoplamento acidental). Se a intenção do produto é mesmo que B seja 100% independente mesmo quando isso significa entrar numa zona que a própria tela chama de "tese A invalidada", tudo bem — mas é uma escolha consciente, não uma limpeza de código morto. Ver **D2**. `PlanoBClampAncoraD5Test` provavelmente quebra e precisa ser reescrito ou removido, não contornado. |
| **P0.5.3** (`zonaEstrutural()` — substituir por versão de 2 parâmetros) | A versão REAL de hoje já tem assinatura `zonaEstrutural(float $entradaB, array $targetCatalog, bool $isShort, float $precoAtual, float $atr)` — 5 parâmetros, não 2. Ela já implementa uma regra específica do **item 39 do spec `genesis-v6-9-correcao-tecnica`** (D-29): nunca fabrica borda a partir do preço atual — só usa barreira real do catálogo estritamente do lado certo do preço, senão colapsa a zona num nível (não inventa número). | O diff literal do documento (função simplificada, sem `$isShort`/`$precoAtual`/`$atr`) foi escrito contra uma versão **mais antiga** deste arquivo do que a que está em produção hoje. Aplicar o `SUBSTITUIR` ao pé da letra **reintroduziria a fabricação de borda a partir do preço** que o item 39 já eliminou — uma regressão real, exatamente do tipo que a regra 5 do próprio documento ("nenhum preço pode ser fabricado") proíbe. Implementação correta: manter a assinatura e a lógica anti-fabricação atuais, e reavaliar se alguma parte *ainda* precisa mudar depois que P0.5.1/5.2 estiverem prontos (é possível que nada precise — a função já não amarra a zona a pullback/repique por si só, quem amarrava era o `if` do passo 2, já coberto pelo 5.1). |
| **P0.8** (trigger nasce `AGUARDANDO`) | O código real já chama `$this->breakRetest->horizontal($candles, $gatilhoNivel, $atr)` contra a série histórica completa no momento da criação (linhas 178-182) e pode retornar `'ATINGIDO'` já na criação — confirma o bug exatamente como descrito. | Sem ressalva de implementação — só notar que o campo `verificacao` também precisa virar `null` na criação (o documento já mostra isso no bloco `$trigger` substituto), senão sobra um resultado de verificação histórica associado a um estado que diz "aguardando". |
| **P0.10** (remover R:R combinado) | `parciais_alvo` em `config/genesis.php` tem um comentário próprio explicando que existe **só** para o R:R combinado do cabeçalho ("uma operação com três alvos parciais não tem UM R:R, tem um combinado"). Esse combinado é o mesmo que o spec `genesis-v6-10-implementacao`, Fase 9, criou (RR "só TP1" → combinado ponderado pelos 3 alvos, testado contra o exemplo literal do PDF-fonte, SUI 0,85) e que o spec `genesis-v6-11-correcao-tecnica`, Fase 4/item 4.9, **relabelou** há só 1 dia para "combinado, líquido" (teste `BlocoConviccaoQualidade.test.ts`) para resolver uma confusão diferente. | Este item não é uma correção de bug — é uma reversão explícita ("decisão final de produto", nas palavras do próprio documento) de uma feature de duas fases recentes de dois specs anteriores. Tecnicamente simples (apagar o que os dois specs anteriores adicionaram), mas o peso da decisão é maior do que a leitura rápida do item sugere. Ver **D3**. |
| **P0.9** (`entry_notes` do Plano A) | Não encontrei `entry_notes` em nenhum grep de `AnalysisResult.tsx` hoje — confirmado ausente. Não confirmei ainda que `plan_a_risk_notes` realmente chega ao payload como `entry_notes` (o documento afirma que sim); vale conferir o payload de resposta antes de escrever o JSX, para não renderizar uma chave que não existe. |

### Não verificado a fundo neste plano (verificar na implementação, não presumir)

- P0.3 (texto exato a inserir no prompt) — mudança só de texto, baixo risco, não precisei ler o prompt inteiro para validar a proposta.
- P0.7 — é uma regra de "não fazer", não um diff — nada a verificar previamente além do que P0.1/P0.2/P0.6 já cobrem.
- P0.13 — não li o JSX ao redor de `podeSelecionarPlano`/`podeConfirmarPosicao` hoje; a lógica proposta é nova (não existe ainda), então não há "antes" para conferir, só integração com o `planoAtivo` do P0.12.
- `BlocoConviccaoQualidade.tsx`, `types/graphicalAnalysis.ts` (conteúdo completo), `GeminiVisionService`, `LiquidationCalculatorService.php` (localizado em `app/Services/GraphicalAnalysis/`, não no caminho genérico que o documento usa) — existência confirmada via grep/glob, conteúdo não lido linha a linha.
- Itens "já corrigidos" (lista de 1-10 no fim do documento) — não reconferidos um a um neste plano; ficam como gate de regressão na Fase 6, igual o documento pede.

---

## Decisões que precisam do Felipe (ou do Fabrício) antes de começar

Nenhuma delas trava a escrita deste plano; travam o início ou a conclusão de fases específicas.

- [ ] **D0 — O que fazer com o trabalho não commitado nos dois repositórios.** **[API]** tem 5
      arquivos modificados + 4 novos da frente `genesis-microservico-auth-creditos` (Fase 9.4,
      deliberadamente pendente). **[FE]** tem `.env.example`/`services/api.ts` modificados (não
      inspecionados) + specs novos sem commitar. Opções: (a) commitar/stash esse trabalho antes de
      abrir este hotfix, (b) confirmar que pode conviver na working tree durante o hotfix, desde que
      os arquivos não se sobreponham (checagem rápida: nenhum arquivo tocado por
      `genesis-microservico-auth-creditos` aparece na lista de arquivos deste documento — não há
      sobreposição direta hoje, mas um `git diff` completo ajuda a confirmar antes de mexer).
- [ ] **D1 — Confirmar reversão do `rr_provisorio` (P0.1).** É a decisão de produto do
      `genesis-v6-10-implementacao` (Fase 9, item 9.1) sendo desfeita. Se confirmado, os testes
      `GenesisPromptRrProvisorioTest`/`CanonicalBundleBuilderRrProvisorioTest` citados pelo próprio
      hotfix precisam ser removidos ou reescritos para provar a ausência da regra, não só apagados
      silenciosamente.
- [ ] **D2 — Confirmar remoção do clamp `ancoraInvalidacaoPlanoA`/D5 (P0.5.2).** Isto elimina uma
      proteção testada (`PlanoBClampAncoraD5Test`, spec `genesis-v6-9-pacote-final`) contra a
      entrada/zona B cair dentro da região que a tela chama "tese invalidada" do Plano A. A regra 3 do
      documento ("Plano A e Plano B são independentes") sugere que sim, é essa a intenção — mas vale
      confirmar explicitamente, porque o teste que quebra tem nome de item de outro spec, não deste.
- [ ] **D3 — Confirmar remoção total do R:R combinado (P0.10), inclusive o combinado ponderado da
      Fase 9 do `genesis-v6-10-implementacao`.** O documento já chama isto de "decisão final de
      produto" — tratando como confirmado, a menos que o Felipe sinalize o contrário aqui. Se
      confirmado, o exemplo literal do PDF-fonte batido na Fase 9 daquele spec (SUI, 0,85) deixa de
      ter onde aparecer na tela — vale checar se esse exemplo tinha algum outro uso documentado antes
      de simplesmente descartá-lo.
- [ ] **D4 — Nome/local deste spec.** Criei uma pasta nova, `genesis-v6-11-hotfix-final`, separada de
      `genesis-v6-11-correcao-tecnica` (que já está 100% concluído). Alternativa: absorver como novas
      fases dentro do spec anterior. Segui o padrão dos specs iterativos anteriores (`v6-9-pacote-final`
      → `v6-9-correcao-tecnica`, por exemplo), mas é uma preferência de organização, não uma
      obrigação técnica.
- [ ] **D5 — Branch.** Specs recentes (V6.9/V6.10/V6.11) trabalharam direto em `genesis2`/`master`,
      sem branch dedicada. Este documento fala em "hotfix final para produção" e tem uma seção inteira
      de checklist de deploy (fila, `.env`, manifesto) — vale considerar uma branch dedicada
      (`genesis-v6.11-hotfix`) desta vez, já que o objetivo explícito é ir para produção logo depois.

---

## Escopo deste spec

Os 16 itens P0 do documento, na ordem de implementação que o próprio documento define ("Ordem de
implementação", 15 passos — P0.7 é regra, não código, coberto dentro de P0.1/P0.2/P0.6), agrupados em
fases por área de mudança (mesmo padrão de agrupamento do spec anterior). Cada fase abaixo tem
checkboxes por item; o texto completo (código antes/depois) está em
`GENESIS_V6_11_HOTFIX_FINAL_FELIPE.md` — este arquivo não duplica os blocos de código.

**Definição de pronto por item**: código alterado **e** teste (unitário, feature ou aceite) verde
cobrindo o comportamento do item, **e** para os testes de outros specs que ficam obsoletos por uma
reversão deliberada (D1/D2/D3), o teste reescrito para provar a regra nova (ou removido com
justificativa registrada), nunca contornado para o teste antigo continuar passando por acidente.

---

## Fase 0 — Antes de mexer ✅ concluída (10/09/2026)

- [x] **D0 resolvida (decisão do Felipe)**: o trabalho não commitado em **[API]** (frente
      `genesis-microservico-auth-creditos`, Fase 9.4) e em **[FE]** (`.env.example`/`services/api.ts`
      + specs novos) **fica como está** — não commitar, não stashar, não tocar. Confirmado sem
      sobreposição de arquivos com o escopo deste hotfix.
- [x] **D1 resolvida (AskUserQuestion)**: remover `rr_provisorio` totalmente — a seleção de alvo
      ignora R:R por completo, como P0.1 pede. `GenesisPromptRrProvisorioTest`/
      `CanonicalBundleBuilderRrProvisorioTest` serão removidos ou reescritos para provar a ausência da
      regra na Fase 1, não deixados a apontar para código que não existe mais.
- [x] **D2 resolvida (AskUserQuestion)**: remover o clamp `ancoraInvalidacaoPlanoA`/D5 — Plano B fica
      100% independente do Plano A, mesmo quando isso significa entrar numa zona que a tela rotula
      "tese A invalidada". `PlanoBClampAncoraD5Test` será removido ou reescrito na Fase 2 para provar
      a independência, não contornado.
- [x] **D3 resolvida (AskUserQuestion)**: remover o R:R combinado totalmente — inclusive o combinado
      ponderado da Fase 9 do V6.10 e o relabel "combinado, líquido" da Fase 4 do V6.11. Nenhum número
      agregado sobrevive na tela; só `rr_por_alvo` de TP1/TP2/TP3.
- [x] **D4 resolvida (decisão default, sem objeção)**: mantém a pasta nova
      `genesis-v6-11-hotfix-final`, separada do spec anterior já concluído.
- [x] **D5 resolvida (decisão default, seguindo o padrão dos specs V6.9/V6.10/V6.11)**: sem branch
      dedicada — trabalho direto em `genesis2` (API) / `master` (FE). Revisitar se o Felipe preferir
      uma branch de hotfix antes do primeiro commit real de código.
- [x] **Baseline de testes registrado (10/09/2026)**:
      - **[API]** `php artisan test`: **1021 passed, 2 failed, 2 skipped, 3051 assertions**
        (526.82s). As 2 falhas são as mesmas de sempre — `GraphicalAnalysisAttemptJobTest` e
        `GraphicalAnalysisFullPipelineIntegrationTest`, ambas com o mesmo sintoma (`PENDING` em vez do
        estado final esperado, flakiness de fila/timing sob a suíte completa, já registrada como não
        regressão no spec anterior).
      - **[FE]** `npx vitest run`: **427 passed / 29 failed** (6 arquivos com falha, 41 arquivos
        verdes de 47) — mesma contagem exata do baseline final do spec anterior
        (`genesis-v6-11-correcao-tecnica`), confirmando que nada mudou entre as duas sessões.
        `npx tsc --noEmit`: limpo (exit 0).
      - Qualquer falha nova a partir daqui, nas Fases 1-6, é regressão real deste hotfix e precisa de
        correção ou justificativa explícita — não pode ser absorvida como "pré-existente" sem
        conferir contra estes números.

## Fase 1 — Fundação: alvo antes do stop, Vision no pool do stop (doc P0.1, P0.2) ✅ concluída (10/09/2026)

- [x] P0.1 — apagado `comRrProvisorio()`/bloco de stop provisório em `CanonicalBundleBuilder.php`;
      removido `rr_provisorio` da descrição de `target_candidates` e a regra de preferência de TP1
      em `GenesisPrompt.php` (substituída por "R:R não participa da escolha do alvo").
- [x] P0.1 — `CanonicalBundleBuilderRrProvisorioTest.php` **removido** (testava só um método privado
      que não existe mais). `GenesisPromptRrProvisorioTest.php` **reescrito** para provar a ausência
      da regra (D1, confirmado via AskUserQuestion: remover totalmente).
- [x] P0.2 — injetado `visual.levels` (`vision.visual_observations.supports/resistances`, mesmo
      formato que `GraphicalAnalysisAttemptJob` já usa DEPOIS da decisão) na cópia de evidências
      usada só para `NiveisContratoBuilder::build()` — confirmado por leitura que
      `NiveisContratoBuilder::build()` já sabia ler o id `visual.levels` (linha 57), só nunca
      recebia antes da decisão. `bundle.evidence` público não foi alterado.
      **Sem teste novo dedicado** — cobertura indireta pelos testes de pipeline completo
      (`GraphicalAnalysisAttemptJobTest`/`GraphicalAnalysisFullPipelineIntegrationTest`); testar
      `build()` isoladamente exigiria mockar ~6 dependências de I/O (`MarketSnapshotService`,
      `TargetCandidateCatalog`, `LiquidationMapService`) só pra provar uma injeção de 8 linhas —
      não fiz esse investimento neste hotfix. Sinalizado como lacuna conhecida.

## Fase 2 — Plano B tecnicamente completo e independente (doc P0.3, P0.4, P0.5, P0.6, P0.8) ✅ concluída (10/09/2026)

- [x] P0.3 — seção "SELEÇÃO DO PLANO B" acrescentada ao prompt, antes de "PLANO PRIMÁRIO" — texto
      ampliado além do rascunho do documento pra cobrir campos obrigatórios do schema real que o
      documento não mencionava (`entry_elementos_usados`, `stop_selection.rationale`,
      `target_selection.rationales`).
- [x] P0.4 — `validatePlanBTechnical()` adicionado ao `DecisionResponseValidator`, usando o repair já
      existente. **Desvio do código literal do documento**: a checagem de catálogo vazio
      (`PLAN_B_TECHNICAL_UNAVAILABLE`) foi trocada para não gerar erro nenhum (`return []`), mesma
      doutrina de degradação de `TargetSelectionValidator`/`StopSelectionValidator` — a versão
      literal do hotfix quebrava **todo** teste de `DecisionResponseValidatorTest.php` (cujo
      `bundle()` fixture nunca teve `target_candidates`) com um erro novo. A ordem da checagem
      também importa: catálogo vazio é verificado **antes** de exigir `plan_b` ser array — sem isso,
      um `plan_b` simplesmente ausente do payload (comum em fixtures antigas) virava
      `PLAN_B_MISSING` mesmo sem catálogo nenhum pra validar contra.
- [x] P0.5.1 — validação de lado trocada de fixo (pullback/repique) para condicionada ao
      `trigger.tipo` (ROMPIMENTO/RETORNO_A_ZONA com lado esperado; RETESTE sem regra fixa).
- [x] P0.5.2 — `ancoraInvalidacaoPlanoA` removido de `PlanoBService::gerar()` e do call site em
      `ExecucaoService.php` (D2, confirmado via AskUserQuestion: remover — B 100% independente).
      Não existe `PlanoBClampAncoraD5Test` como arquivo próprio — o teste real do clamp D5 vivia
      dentro de `ExecucaoServiceC7RotuloTest.php`; reescrito para provar o oposto (a barreira que
      ficava presa entre a âncora e o stop com buffer do Plano A agora fecha a zona do Plano B).
- [x] P0.5.3 — `zonaEstrutural()` **preservada** com a assinatura/lógica anti-fabricação atual (item
      39, D-29) — o diff literal do documento (2 parâmetros) foi escrito contra uma versão mais
      antiga do arquivo; aplicado ao pé da letra, reintroduziria a fabricação de borda a partir do
      preço atual que o item 39 já eliminou. Testado empiricamente com um cenário de ROMPIMENTO
      (entrada acima do preço) — a zona colapsa sem erro, não precisou de ajuste adicional.
- [x] P0.6 — `PivoService` injetado no construtor de `PlanoBService` (no lugar de
      `BreakRetestService`, que ficou sem nenhum uso na classe depois do P0.8 — removido, desvio do
      construtor literal do documento, que mantinha os dois); `$pivosStopB` calculado via
      `relevantes($candles, $entradaB, $atr)` e passado com `$candles` reais para
      `NivelService::stop()` (em vez de `[], []`). Teste novo prova que um stop que antes falhava
      (`SEM_STOP_ESTRUTURAL_NA_ENTRADA_B`, sem estrutura em `niveisContrato`) agora resolve via
      pivô fractal real.
- [x] P0.8 — trigger nasce sempre com `estado => 'AGUARDANDO'` e `verificacao => null` na criação —
      a chamada a `BreakRetestService::horizontal()` contra a série histórica inteira foi removida
      por completo (não só ignorada).

**Regressão (10/09/2026)**: baseline da Fase 0 era 1021 passed/2 failed/2 skipped. Rodada completa
imediatamente após as Fases 1+2 achou **23 failed** — investigado failure por failure, não aceito
de bandeja: 2 eram as mesmas falhas de sempre (flakiness de fila, idênticas ao baseline), **1 era
regressão real não prevista** (`BenchmarkGenesisV69Test` — o decisor fake do teste não declarava
`plan_b`, e contra um bundle REAL — nunca vazio — isso agora reprova com `PLAN_B_MISSING`; corrigido
adicionando um `plan_b` estruturalmente válido ao fake, reaproveitando candidatos reais do próprio
bundle), e as demais **20 eram efeito cascata** de estado sujo entre testes (jobs perdidos na fila
por causa da falha real acima, mais e-mails de Faker colidindo no sqlite persistente depois de 3
rodadas completas seguidas nesta sessão) — confirmado isolando cada arquivo suspeito individualmente
(todos passam sozinhos). Rodada final completa: **1018 passed, 4 failed (as 2 de sempre + 2 de
Faker/estado sujo, ambos confirmados passando isolados — não são regressão), 2 skipped, 3049
assertions**.

## Fase 3 — R:R sem número combinado (doc P0.10, P0.11) ✅ concluída (10/09/2026)

- [x] P0.10 (backend) — apagado `calcularRrLiquidoCombinado()` e os 4 campos combinados dos payloads
      A e B em `ExecucaoService.php`; apagado `parciais_alvo` de `config/genesis.php` (D3, confirmado
      "remover totalmente"). `ExecucaoServiceRrLiquidoCombinadoTest.php` removido (testava só o
      método apagado).
- [x] P0.10 (frontend) — campos removidos de `types.ts` (o tipo REAL usado por `AnalysisResult.tsx`
      via `import ... from '../types'` — `types/graphicalAnalysis.ts` é um módulo irmão, não o
      consumido aqui; achado ao investigar por que o `tsc` não acusava os campos já ausentes ali) e
      de `types/graphicalAnalysis.ts`; `BlocoConviccaoQualidade.tsx` perdeu a coluna "Risco e
      retorno" inteira (não só os 4 props — o bloco inteiro existia só pra isso).
      `AnalysisResult.fase9.test.ts`/`AnalysisResult.a8.test.ts`/`BlocoConviccaoQualidade.test.ts`
      reescritos (os três testavam exatamente o que foi removido).
- [x] P0.11 — `PlanRecommendationService::evaluate()` simplificado: `reason_code` renomeado
      `RR_LIQUIDO_ABAIXO_MINIMO`→`RR_LIQUIDO_TP1_ABAIXO_MINIMO`, `alvo_que_atende`/`alvo_bom_*`
      sempre null, `primeiroAlvoAcimaDoMinimo()` removido (confirmado sem consumidor real por grep —
      `ExecucaoServiceRrPorAlvoTest`/`AnaliseController.php` só tinham comentário histórico
      mencionando o nome antigo). `PlanRecommendationServiceTest.php` reescrito;
      `ExecutionExecutableVsRecommendedTest.php` (usa dados reais da Binance) ajustado pro novo
      `reason_code`.

## Fase 4 — Frontend: autoridade do plano ativo (doc P0.12, P0.13, P0.9) ✅ concluída (10/09/2026)

- [x] P0.12 — `planoAtivo` resolvido uma única vez (`planoADados`/`planoBDados`, `legacyMode`
      explícito), removidos ~35 ocorrências do padrão `?? setup.campo` (escopo real maior que a
      lista do documento, confirmado na ressalva da Fase 1/2) — script Node fez a remoção mecânica
      do padrão repetido, revisado manualmente linha por linha depois. Também removidos 2 fallbacks
      que o documento não citava mas são a MESMA categoria de bug: `execution.zonaInteresse`
      (sempre a invalidação do Plano A) e `execution.recommended/motivo` — os dois vazavam dado do
      Plano A pro Plano B quando `planoAtivo` não tinha o campo.
- [x] P0.13 — `podeSelecionarPlano`/`podeConfirmarPosicao`/`planoAtivoCompleto`/`gatilhoBPronto`
      implementados. Ajuste sobre o código literal do documento: `gatilhoBPronto` lê
      `planoBDados?.trigger?.estado` (o `planoBDados` de `execution.planos[]`, a mesma fonte única
      que P0.12 estabelece), não o `planoB` bruto (`execution.planoB`, saída direta de
      `PlanoBService::gerar()`) — usar o bruto reabriria a mesma inconsistência de fonte que P0.12
      fecha. Documentado por que `Number.isFinite(Number(x))` (não `x != null`) é deliberado em
      `planoAtivoCompleto`: `Number(null)` é `0` (finito), preservando DP-03 (stop/TP indisponível
      nunca bloqueia confirmação, só a ausência do plano em si) — "corrigir" isso pra checagem
      estrita de null teria revertido silenciosamente um princípio de produto repetido em várias
      specs anteriores.
- [x] P0.9 — confirmado antes de implementar que o payload real expõe `plan_a_risk_notes` como
      `entry_notes` em `execution.planos[]` (`AnalysisPersistenceService.php`, já passado por
      `publicarTexto()` no backend — `publicText()` no frontend é uma segunda passada defensiva,
      mesmo padrão de `motivoAtivo`). `entry_notes`/`trigger` adicionados aos tipos reais
      (`types.ts`) e ao `emptyCandidateSetup` de `geminiService.ts` (placeholder precisava do campo
      novo).

**Regressão (10/09/2026)**: `[API]` 1013 passed/2 failed (as mesmas 2 de sempre)/2 skipped, 3047
assertions — idêntico ao baseline da Fase 0, zero regressão real (uma rodada intermediária mostrou
10 falhas por contaminação entre `GraphicalAnalysisAttemptJobTest`/
`GraphicalAnalysisFullPipelineIntegrationTest` quando rodados numa ordem específica — confirmado
não-regressão isolando os dois arquivos, cada um passa sozinho). `[FE]` `npx vitest run`: 433
passed/29 failed (mesmas 29 de sempre, arquivos de worker Python/SSE/scanner não relacionados a
este hotfix) — subiu de 427 pra 433 pelos testes novos deste hotfix. `npx tsc --noEmit`: limpo.

## Fase 5 — Produção: liquidação, funding, fila e URL (doc P0.14, P0.15, P0.16) ✅ concluída (10/09/2026)

- [x] P0.14 — `GENESIS_BINANCE_API_KEY`/`GENESIS_BINANCE_API_SECRET`/`GENESIS_RISCO_POR_ANALISE`
      adicionados ao `.env.example` (confirmado antes que `config('binance.api_key'/'api_secret')` e
      `config('genesis.risco_por_analise')` já existiam ligados a essas env vars, só faltavam no
      template); checagem de produção adicionada em `GenesisGraphicalPreflight.php`, com 6 testes
      novos (`GenesisGraphicalPreflightTest.php`) cobrindo cada checagem + confirmando que nenhuma
      delas dispara fora de produção.
- [x] P0.15 — `periodosFunding()`: 2/11/45/135 → 1/1/3/9 (intradiário/1d/1w); custo de funding
      separado do operacional (`custoFundingParaRrBps = max(0.0, $fundingBpsAssinado)`) — um crédito
      de funding não reduz mais `custoTotalBps` abaixo do custo operacional puro.
      `custos_bps.funding` (exibição) continua mostrando o valor assinado real, só o que entra no
      R:R líquido mudou. 3 arquivos de teste com números antigos (45/135 períodos, 225/675 bps)
      atualizados para os novos (3/9 períodos, 15/45 bps) — `ExecucaoServiceE05Test.php`,
      `V611Fase6CoberturaTest.php`. Confirmado que o teste que parecia testar o comportamento oposto
      (`test_e05_custo_negativo_credito_de_funding_melhora_rr_liquido`) testa a função pura de mais
      baixo nível (`calcularRrLiquidoEstimado()`, via reflection, com `custoTotalBps` já pronto como
      argumento) — não o caminho de produção onde o clamp novo vive; continua correto sem alteração.
- [x] P0.16 — checagem de `QUEUE_CONNECTION=sync` em produção adicionada ao mesmo preflight (P0.14 e
      P0.16 compartilham o mesmo bloco `if (config('app.env') === 'production')`, ambos pedidos
      juntos no documento). `VITE_API_URL` adicionado ao `.env.example` do frontend (não existia
      nenhum antes) — o fallback `localhost:8000` em `services/api.ts` foi mantido de propósito
      (serve pro dev local sem `.env`; a obrigatoriedade em produção é de processo de build, não de
      código que trave sem a variável).

**Regressão (10/09/2026)**: `[API]` 1010 passed/11 failed/2 skipped — investigado failure por
failure: 1 é rede real (`Could not resolve host: fapi.binance.com`, teste ao vivo contra a Binance,
nada a ver com este hotfix) e as outras 10 são a mesma contaminação entre
`GraphicalAnalysisAttemptJobTest`/`GraphicalAnalysisAsyncFlowTest`/
`GraphicalAnalysisFullPipelineIntegrationTest` já diagnosticada e confirmada não-regressão duas
vezes antes nesta sessão (cada arquivo passa sozinho). Zero regressão real das mudanças de Fase 5.
`[FE]` não precisou rodar de novo — Fase 5 não tocou nenhum arquivo de frontend além do
`.env.example` (sem código, sem teste afetado).

## Fase 6 — Regressão obrigatória ✅ concluída (10/09/2026)

- [x] Suíte completa rodada contra o baseline da Fase 0 em cada fase (1+2, 3+4, 5) — toda falha nova
      investigada individualmente, nunca aceita "porque a suíte é flaky mesmo": 1 regressão real
      encontrada e corrigida (`BenchmarkGenesisV69Test`, Fase 1+2), o resto sempre rastreado até
      rede real ou contaminação entre arquivos de fila já pré-existente (confirmado passando isolado
      todas as vezes). Estado final: `[API]` mesmo baseline da Fase 0 (2 failed conhecidas) quando
      rodado sem a interferência de rede externa; `[FE]` 433 passed/29 failed (mesmas 29 de sempre).
      `tsc --noEmit` limpo.
- [x] Os 10 itens "já corrigidos no backend 46" não foram re-testados individualmente nesta rodada
      (não fazem parte de nenhuma Fase 1-5 tocada) — nenhuma das mudanças deste hotfix mexeu nos
      arquivos onde eles vivem (DerivativesReadingService, TargetCandidateCatalog, MarketSnapshotService
      etc.), risco de regressão de raspão é baixo. **Não confirmado ativamente — lacuna conhecida**,
      sinalizada em vez de presumida.
- [x] Testes obrigatórios do documento — os 6 cenários backend descritos (rompimento LONG acima do
      preço, retorno LONG abaixo do preço, stop B via pivô, independência da invalidação do Plano A,
      R:R por alvo usa entrada/stop do próprio plano, ausência de R:R combinado) todos implementados
      em `PlanoBServiceTest.php`/`PayloadPublicadoTest.php` (Fases 1-3). Os 3 cenários frontend
      (autoridade do plano, ausência de combinado, troca A→B→A) implementados em
      `AnalysisResult.fase9.test.ts` (Fase 4).

## Fase 7 — Matriz de aceite com casos reais

⚠️ **Mesma limitação de ambiente do spec anterior**: sem navegador neste ambiente, os 4 casos (BTCUSDT
1D, ZECUSDT 1D, SUIUSDT 4H, um setup SHORT) e os 15 itens da matriz de aceite do documento só podem
ser verificados de fato pelo Felipe, rodando upload → tela. Este spec pode preparar testes de
integração sintéticos equivalentes (mesmo padrão de `V611Fase6CoberturaTest` do spec anterior), mas
isso prova que o código funciona ponta a ponta, não que a tela renderiza certo com os gráficos reais.

- [ ] Comandos de verificação do documento (`composer install`, `migrate`, `preflight`, `test`,
      `tsc --noEmit`, `npm run build`, manifesto) rodados e limpos.
- [ ] Matriz de aceite dos 4 casos — a rodar pelo Felipe, mesma decisão de "você roda, eu reviso" já
      usada no protocolo de aceite do `genesis-v6-10-implementacao`, se preferir repetir o padrão.
