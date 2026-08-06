# Plano de Implementação: Gênesis V6.6 — Correção Técnica (Resposta à V6.5 em Produção)

## Visão Geral

Fonte de verdade: `GENESIS_V6_6.pdf` + `GENESIS_V6_6.md` (Anexo A — código pronto para aplicar) — De
Fabrício · Product Owner, Para Felipe · Desenvolvimento, 01/08/2026. Auditoria feita sobre os
repositórios `genesis-api-genesis2` e `genesis2-master` entregues em 31/07/2026 (pacote
`GENESIS_V6_5_PROVAS`), mais três análises reais rodadas em 01/08/2026 (BTCUSDT, APTUSDT, SUIUSDT)
contra o sistema em produção.

46 correções (18 P0 bloqueantes) sobre a V6.5 já em produção, mais 9 Determinações do PO (algumas já
vigentes desde a V6.5, repetidas aqui) e 4 Decisões Fechadas nesta rodada. Os IDs deste plano (A01,
B03, C04, etc.) são os mesmos do documento e do Anexo A — não renumero.

Repositórios: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** =
`c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main`.

**Status geral em 03/08/2026: 0 de 46 correções implementadas.** Documento recebido nesta data, plano
recém-criado. Nenhuma fase autorizada ainda.

Diagnóstico do próprio documento sobre o estado herdado da V6.5: ~72% funcional. Três correções da
V6.5 (C07 rebaixando POC/HVN/LVN, mais o gate de figura) tiveram efeito líquido negativo porque a peça
substituta nunca chegou a funcionar — o motor de alvos hoje tem *menos* fontes de barreira do que
antes da V6.5. O catálogo de 50 figuras gráficas não produz nada em produção (4 bloqueios em série).
D01 (timeframe `1M`→`1m`) está quebrando análise paga agora, silenciosamente.

## Regras do documento que este plano tem que obedecer (não são escolha minha)

**Determinações do PO — anteriores ao documento, permanecem válidas. Qualquer correção que contrarie
uma DP interrompe e volta pra discussão, não decido por interpretação:**

1. **DP-01.** Gemini é o único decisor de direção e score. PHP não vota, não soma família, não
   inverte direção, não altera score. Nenhum item deste plano muda isso.
2. **DP-02.** Score exibido na escala de 100, teto real 90. Nunca chega a 100. Barra de progresso já
   está correta (F03 é só rótulo).
3. **DP-03.** Análise imperfeita continua executável. Quem decide seguir é o membro. Nenhuma condição
   de qualidade desabilita seleção de plano — é o que E01 corrige (regressão da própria V6.5).
4. **DP-04.** Estorno só por falha de plataforma, quando nenhum dado é entregue ao membro. Análise
   completa nunca estorna, mesmo com leitura ruim — E02 tem que deixar isso explícito em código e
   teste, não só corrigir o timeout.
5. **DP-05.** Política de candles não muda. Nenhuma alteração neste ciclo.
6. **DP-06.** Nada que funciona hoje pode deixar de funcionar. Bloco de sentimento do ativo e bloco
   macro/geopolítico continuam captados e exibidos como estão — são informativos, não entram em
   nenhuma correção de conteúdo. F06 e G03 só mexem em como o dado já existente é apresentado/blindado
   contra falha de parse, nunca no conteúdo em si. Antes de qualquer dúvida nesses dois blocos,
   interromper e perguntar antes de mexer.
7. **DP-07.** Gênesis nunca inventa figura. Sem figura clara no gráfico, campo vem vazio. Alucinar
   figura é falha crítica, não erro de grau — vale para A05 e para o prompt inteiro do Bloco A.
8. **DP-08.** Projeção de figura pode apontar alvo, mas nunca é regra. Os três alvos saem por
   relevância técnica dentro da escala de preço, entre todas as fontes — vale para C02 e para o peso
   deliberadamente baixo de `figura_projetada` em B05.
9. **DP-09.** Cálculo de risco e retorno não muda. Muda só a apresentação — vale pra F01.

**Decisões fechadas nesta rodada (DF), já definitivas, não é pra reabrir discussão:**

- **DF-01.** Liquidações: Binance descontinuou `/fapi/v1/allForceOrders`. Sem contratação de provedor
  pago. Peso 10 sai do modelo, hierarquia recalibrada entre fontes existentes (B05).
- **DF-02.** Risco e retorno aparece só no bloco de convicção, formato definido em F01.
- **DF-03.** Score não é recalibrado em função de risco e retorno neste ciclo. Reavaliação só depois,
  com dado real, após B e C corrigidos.
- **DF-04.** Os 11 objetos visuais do catálogo passam a ter consumidor (contextualização de figura,
  A05).

**Regras adicionais:**

- Nenhuma correção deste documento exige refatoração de arquitetura — é ligação, acabamento e regra de
  seleção. Se alguma implementação começar a parecer refatoração grande, é sinal de estar fazendo mais
  do que o pedido.
- **"Teste que injeta o dado de entrada não prova que o dado chega."** Critério do próprio documento
  para este ciclo, motivado por três correções da V6.5 que passaram em teste automatizado e não
  funcionam em produção. Sempre que possível, prova real de ponta a ponta, não só teste com dado
  injetado manualmente.
- Onde o documento define "Anexo A" com código pronto (lado a lado, atual vs. corrigido), a
  implementação segue esse código literalmente, sem reescrever por preferência própria — mesmo padrão
  já usado nos planos anteriores.
- Gate final: nada fecha enquanto qualquer linha `bloqueante: sim` da Matriz de Aceite (seção 13 do
  documento) estiver vermelha.

## Como este plano vai ser executado

- **Em ondas, na ordem que o próprio documento define (seção 12)** — não é ordem arbitrária minha, é
  dependência técnica e urgência de produção. Nenhuma onda começa sem autorização explícita, mesmo que
  a anterior já tenha fechado. Marco com 🔒 no início de cada fase.
- Onda 2 é a única que muda o que o membro recebe (figuras aparecendo, alvos coerentes). As demais
  garantem que o sistema não se contradiga e não colete dado sem destino.
- No fim de cada fase, pacote de evidências só com os arquivos daquela fase, paro para revisão antes
  de avançar.
- No fim de todas as fases, preencho `MATRIZ_DE_ACEITE_V6_6.md` (mesmo padrão do V6.5) e monto o pacote
  completo pra envio ao Fabrício.

## Dependências técnicas que não podem ser invertidas (do próprio Anexo A)

- **A01 → A02 → A03.** Schema aceitando `patterns` detalhado antes do validador não reprovar mais por
  confiança baixa, antes de reexigir as quatro chaves presentes. Fazer A03 sem A01+A02 recria o
  "aceitar vazio sem alarme" que já causou a regressão da V6.5.
- **A06 → B03.** Classificação de projeção das 50 figuras (`GenesisPatternProjection`) precisa existir
  antes do motor de barreiras conseguir calcular `alvo_projetado` a partir de uma figura identificada.
- **B01 → B03 (parcial).** VRVP chegando na resposta é o que faz `borda_hvn`/POC terem dado; B03 é a
  figura entrando como candidata separada. Ambos alimentam `montarBarreiras()`, mas são independentes
  entre si — só compartilham o mesmo ponto de entrada no código.
- **C01+C02 → C04.** `notaQualidade()` e `selecionarAlvos()` (C01/C02) precisam existir antes de C04
  poder chamar `selecionarAlvos()` no caminho de fallback do filtro de ruído. C04 sem C01/C02 não tem
  o que chamar.
- **E04 → F01.** RR saindo nulo sobre alvo projetado (E04) é pré-requisito pro card único de risco e
  retorno (F01) não publicar número calculado sobre alvo que não existe.
- **G01 depende do estado herdado da V6.5**, não deste documento — `levels.poc/hvn/lvn` já foram
  rebaixados para CONTEXT na V6.5 (C07); G01 faz o mesmo com `derivatives.liquidations` e
  `derivatives.cvd`. Independente das demais correções.

## Mudanças maiores — ler antes de autorizar qualquer fase

1. **E02 — estorno em erro fatal.** Introduz `register_shutdown_function` no orquestrador (nunca
   existiu no projeto) mais um `Command` novo de varredura de reservas órfãs, registrado no schedule
   (`everyFifteenMinutes`). Mexe em código que roda em toda análise, sem exceção.
2. **D01 — autoridade de normalização de timeframe migra pro backend.** O frontend hoje faz
   `.toLowerCase()` antes de enviar; a correção manda ele parar de transformar e deixar
   `TimeframeNormalizer::normalizar()` (novo, backend) decidir. Muda o contrato entre FE e API para
   esse campo.
3. **C01/C02 — reescreve a regra de seleção de alvo.** `ordenarPorDistancia()` sai,
   `notaQualidade()` + `selecionarAlvos()` entram. Isso muda **quais alvos aparecem pro membro em toda
   análise daqui pra frente**, não é ajuste cosmético — é o item que mais devolve valor perceptível ao
   produto (junto com o Bloco A de figuras).
4. **F01 — remove 4 pontos de exibição de risco/retorno na tela.** Banner de status, caixa de avisos,
   caixa amarela do fim do pipeline, card "RISCO/RETORNO (TP1)" saem todos; RR passa a existir só no
   bloco de convicção.
5. **B04 — profundidade da consulta ao order book sobe de 1000 pra 5000 níveis.** Mais uma chamada
   mais pesada à Binance por análise; vale monitorar latência depois de aplicado.

---

## FASE 1 — 🔒 Onda 1: quebrando análise paga neste momento (D01, E02, D02)

Prioridade máxima do documento — D01 está cobrando crédito e devolvendo análise errada sem erro
visível agora. Nenhuma outra onda começa antes desta fechar.

- [x] **D01 (P0, bloqueante)** — Timeframe localizado do TradingView (`1S`→`1s` rejeitado, `1M`→`1m`
      silencioso) — `ChartMetadataScanService.php`, `services/geminiService.ts:209`,
      `app/Http/Requests/Api/GraphicalAnalysisRequest.php:21,38` [API]/[FE] (implementado em
      03/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `app/Support/TimeframeNormalizer.php` novo
    [API] com mapa completo de rótulos pt-BR/en (`1S`/`S`/`SEMANA`→`1w`, `1M`/`M`/`MES`/`MN`→`1M`,
    etc.), comparação por conjunto de rótulos e não por caixa. `ChartMetadataScanService` normaliza
    logo após o `json_decode` (antes do validator), lançando `RuntimeException` legível quando não
    reconhece o rótulo; prompt do scan ganhou a tabela de tradução explícita.
    `GraphicalAnalysisRequest::prepareForValidation()` usa o mesmo normalizador, com fallback pro
    valor cru (deixa a regra `in:` existente reprovar com 422 claro em vez de aceitar silenciosamente
    algo não mapeado). Frontend (`services/geminiService.ts`) parou de fazer `.toLowerCase()` no
    metadado do scan e passou a ler `message`/`errors` do 422 do Laravel em vez de `errData.error`
    (campo que não existe nessa resposta).
  - Verificação feita: `php -l` em todos os arquivos PHP tocados (limpo) e `npx tsc --noEmit` no
    frontend (limpo, zero erro). **Nenhuma chamada real a Gemini/Binance rodada** — suíte de testes
    não executada nesta sessão (ver nota abaixo).
  - Depende de: nada.
  - Prova exigida (pendente): análise real completa sobre gráfico semanal em português, análise real
    completa sobre gráfico mensal em português com timeframe correto no log, captura de tela de um
    422 com mensagem específica.

- [x] **E02 (P0, bloqueante)** — Crédito cobrado e não estornado em erro fatal de timeout —
      `app/Services/GraphicalAnalysis/GraphicalAnalysisOrchestrator.php:39` [API] (implementado em
      03/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `register_shutdown_function` novo (não existia
    em `app/`, `bootstrap/` nem `public/`) registrado logo após `reserve()`, com flag `$entregue`
    (por referência) travando o estorno assim que `capture()` roda com sucesso, nos dois caminhos de
    saída normais (`Analise` já existente por idempotência, e o caminho novo via `DB::transaction`).
    Detecta `E_ERROR`/`E_PARSE`/`E_CORE_ERROR`/`E_COMPILE_ERROR`/`E_USER_ERROR` via
    `error_get_last()` — é o que escapa do `catch (\Throwable)` já existente no método (esse catch já
    cobria exceções normais; o gap era só erro fatal de verdade, ex.: `max_execution_time`). Comando
    novo `EstornarReservasOrfas` (reserva `RESERVED` sem `Analise` associada há mais de 15 min, via
    relação `analise()` nova em `AnalysisCreditReservation`) registrado no `Kernel.php` como
    `everyFifteenMinutes()` — rede de segurança adicional para o caso raro do próprio shutdown handler
    não rodar (ex.: estouro de memória).
  - Verificação feita: `php -l` limpo nos 4 arquivos tocados (`GraphicalAnalysisOrchestrator.php`,
    `EstornarReservasOrfas.php` novo, `Kernel.php`, `AnalysisCreditReservation.php`). **Timeout real
    não forçado** — exige ambiente controlado, não rodado nesta sessão.
  - Depende de: nada. Já causou 40 créditos reais perdidos em produção (duas ocorrências, antes desta
    correção).
  - Prova exigida (pendente): timeout forçado em ambiente controlado com log do estorno, mais teste
    automatizado comprovando que análise completa não estorna em nenhuma hipótese.

- [x] **D02 (P1, bloqueante)** — Tolerância de 0,15% do verificador de preço reprova print legítimo —
      `app/Services/GraphicalAnalysis/ChartMarketVerifier.php:254` [API] (implementado em 03/08/2026)
  - **Conflito encontrado e resolvido com o usuário antes de tocar no código:** o gate já estava
    desativado como bloqueio desde 31/07/2026, por decisão explícita registrada em comentário no
    próprio código (`DecisionResponseValidator.php`) — motivo: a tolerância fixa de 0,15% contra o
    cache padrão do `BinanceService` (até 300s) rejeitava análise legítima por defasagem do NOSSO
    cache, não por erro do usuário, confirmado em produção antes da V6.6 ser escrita. O documento
    V6.6 (baseado em análises de 01/08, um dia depois) descreve o item como se ainda bloqueasse.
    Perguntei antes de decidir por interpretação (regra do próprio documento, seção 14) — **decisão
    do usuário: reativar como bloqueio, com a tolerância nova proporcional**, entendendo que a
    correção certa para o falso positivo original é a tolerância proporcional, não a desativação do
    gate.
  - Status: **código aplicado, prova REAL pendente.** `MAX_DEVIATION` fixo saiu, `ChartMarketVerifier`
    agora usa `DESVIO_MINIMO` (piso 0,5%) e `DESVIO_ATR_MULT` (1 ATR), o maior dos dois, lendo
    `volatility.atr_percent` do bundle de evidências. Método `isConsistent()` mudou de `bool` para
    array (`ok`, `confianca_reduzida`, `desvio`, `tolerancia`) — `visible_price` nulo agora devolve
    `confianca_reduzida: true` em vez de aprovar o gate em silêncio, sem reprovar sozinho.
    `DecisionResponseValidator::validate()` voltou a adicionar `CHART_VISIBLE_PRICE_DEVIATION` a
    `$errors` quando o desvio estoura a tolerância — reentra no ciclo de reparo/estorno normal.
  - Testes existentes atualizados pra não quebrar com a mudança de assinatura:
    `tests/Unit/ChartMarketVerifierTest.php` (assinaturas `->isConsistent(...)['ok']`, 2 casos novos
    pra tolerância proporcional e confiança reduzida) e
    `tests/Unit/DecisionResponseValidatorTest.php` (o teste que antes provava "não bloqueia mais"
    virou `test_d02_desvio_grosseiro_de_preco_visivel_volta_a_bloquear`, mais um caso novo de desvio
    pequeno passando pela tolerância proporcional). **Testes escritos, não executados** — suíte roda
    contra o banco de dev (`genesisteste`); usuário optou por não rodar nesta sessão, só lint.
  - Verificação feita: `php -l` limpo em `ChartMarketVerifier.php`, `DecisionResponseValidator.php` e
    nos dois arquivos de teste atualizados.
  - Depende de: nada.
  - Prova exigida (pendente): dez prints reais com idades diferentes (do momento até dez minutos),
    resultado de cada um registrado.

**Pacote de evidências desta fase:** código de D01/E02/D02 aplicado e passando lint/typecheck
(`php -l` + `tsc --noEmit`, limpo). **Provas REAL (rede real, timeout forçado, prints reais) e
execução da suíte PHPUnit ficam pendentes** — não rodei `php artisan test` nesta sessão por decisão
do usuário (suíte toca o banco de dev `genesisteste`); ele roda quando quiser antes de fechar a fase
de fato. Reviso com o usuário antes de seguir pra Fase 2.

---

## FASE 2 — 🔒 Onda 2: Figuras e alvos (a onda que muda o produto)

Única onda que altera o que o membro recebe de fato. Bloco A primeiro (catálogo de 50 figuras não
produz nada hoje — 4 bloqueios em série), depois Bloco B (fontes de barreira mortas) e Bloco C (regra
de seleção que hoje escolhe mal mesmo com barreira disponível).

### Bloco A — Figuras gráficas

- [x] **A01 (P0, bloqueante)** — Catálogo de 50 figuras não chega ao modelo pelo canal que a API
      respeita — `app/Support/GenesisDecisionSchema.php:198`, método `forGemini()` [API]
      (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `forGemini()` reintroduz `patterns` detalhado
    (enum das 50 figuras via `GenesisVisualCatalogV6::PATTERNS`, `state`, `confidence`,
    `preco_topo`/`preco_base`/`preco_rompimento` substituindo `bbox`), mantendo `objects` e
    `fibonacci` como objetos rasos e `vrvp` como objeto solto (pré-requisito de B01). `schema()` (só
    usado por testes/pacote arquivado) não foi tocado — só o método real da chamada à API.
  - Depende de: nada.
  - Prova exigida (pendente): log bruto do payload enviado à API mostrando o enum das 50 figuras em
    `response_format`, mais chamada real bem-sucedida com esse schema.

- [x] **A02 (P0, bloqueante)** — Confiança baixa de figura reprova a análise inteira; omitir é grátis —
      `app/Services/GraphicalAnalysis/DecisionResponseValidator.php:178`,
      `app/Services/GraphicalAnalysis/GenesisPrompt.php:20` [API] (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `VISUAL_PATTERN_CONFIDENCE_LOW` saiu do conjunto
    de erros; `validateVisual()` agora filtra silenciosamente (removida de `patterns`, descarte contado
    e logado via `genesis.figura.descartada_por_confianca`). Figura fora do catálogo continua erro de
    contrato (`VISUAL_PATTERN_UNKNOWN`). Mudança de assinatura necessária pra filtragem persistir:
    `DecisionResponseValidator::validate()` e `validateVisual()` passam a receber `$decision` por
    referência — sem isso a figura filtrada só existia na cópia local do método, nunca chegava ao
    `$lastDecision` que o orquestrador cacheia/persiste. `tests/Unit/DecisionResponseValidatorTest.php`
    ganhou `test_a02_figura_baixa_confianca_nao_reprova_e_e_filtrada`,
    `test_a02_figura_confianca_alta_e_mantida`, `test_a02_figura_fora_do_catalogo_continua_reprovando`.
  - Depende de: A01 (schema precisa aceitar o campo antes do validador ter o que filtrar).
  - Prova exigida (pendente): teste com payload de confiança 0,60 demonstrando análise completando
    normalmente e figura não publicada como confirmada — teste escrito, suíte não executada nesta
    sessão (mesma decisão da Fase 1, banco de dev).

- [x] **A03 (P0, bloqueante)** — Resposta vazia foi legitimada em vez de investigada —
      `app/Services/GraphicalAnalysis/DecisionResponseValidator.php:166-168` [API]
      (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** A máscara "`visual_observations === []` equivale
    às três chaves vazias" (V6.5/D04) saiu — cada uma das quatro chaves ausente
    (`patterns`/`objects`/`fibonacci`/`vrvp`) agora vira `VISUAL_OBSERVATIONS_MISSING_KEY:<chave>`
    específico, gravado no próprio `$decision` (por referência, ver A02). Telemetria nova no fim de
    `persist()` do orquestrador: `Log::info('genesis.figura.telemetria', ...)` com `analysis_uuid`,
    `symbol`, `timeframe`, contagem de `patterns` e `vrvp_presente`.
    `test_d04_aceita_visual_observations_totalmente_vazio_como_as_tres_chaves_vazias` (provava o
    comportamento antigo) virou `test_a03_visual_observations_totalmente_vazio_volta_a_ser_reprovado`
    (prova o oposto, de propósito); fixture `valid()` ganhou a chave `vrvp` pra continuar válida.
  - Depende de: A01, A02. Sem eles, reexigir as chaves recria a reprovação de 15/15 que a V6.5 tentou
    mascarar aceitando vazio.
  - Prova exigida (pendente): log de 10 análises reais consecutivas com taxa de identificação de
    figura, mais uma análise sobre gráfico com padrão evidente com figura corretamente identificada.

- [x] **A04 (P0, bloqueante)** — Figura não chega à tela — `services/geminiService.ts`, função
      `mapGraphicalToLegacy` [FE] (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `mapGraphicalToLegacy` mapeia
    `visual_observations.patterns` (antes descartado); `types/graphicalAnalysis.ts` atualizou
    `VisualPattern` (bbox saiu, entraram `preco_topo`/`preco_base`/`preco_rompimento`; `state` ganhou
    `BREAKING`/`RETESTING` no lugar de `BREAKOUT`/`RETEST`, mesmo enum do schema corrigido em A01) e
    `VisualObservations` ganhou `vrvp`. Componente novo `components/BlocoFiguraGrafica.tsx` — não
    renderiza nada quando `patterns` vem vazio, tabela de tradução PT-BR completa das 50 figuras do
    catálogo (DF-04), monta dentro do bloco "Análise Técnica" em `AnalysisResult.tsx`.
  - Depende de: A01-A03 (sem o campo chegando preenchido, não há o que exibir).
  - Prova exigida (pendente): captura de tela de análise real com figura identificada e exibida.

- [x] **A05 (P0, bloqueante)** — Figura precisa ser contextualizada como um trader faria —
      `app/Services/GraphicalAnalysis/GenesisPrompt.php` [API] (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** Seção nova "LEITURA DE FIGURA GRÁFICA" no
    prompt, exigindo quando há figura clara: natureza (reversão/continuação, alta/baixa), posição do
    preço na estrutura, estado (formando/testando/rompendo/retestando/confirmada), proximidade das
    linhas em ATR quando <2 ATR, integração com os indicadores no mesmo parágrafo. Os 11 objetos
    visuais viram o vocabulário da contextualização. Bullet anti-alucinação existente reforçado com
    "Figura inventada é falha crítica" (DP-07).
  - Restrição inegociável (DP-07): só o que estiver visível e claro. Sem figura clara, campo vazio.
    Nunca deduzir, nunca completar por semelhança, nunca inventar.
  - Depende de: A01-A04 (contextualizar um campo que ainda não chega ou não aparece não tem efeito
    observável).
  - Prova exigida (pendente): três análises reais sobre gráficos com figura evidente + três sobre
    gráficos sem figura, demonstrando contextualização correta no primeiro grupo e campo vazio no
    segundo.

- [x] **A06 (P1, bloqueante)** — Classificação das 50 figuras quanto à projeção — arquivo novo
      `app/Support/GenesisPatternProjection.php` [API] (implementado em 04/08/2026)
  - Status: **código aplicado e testado.** Classe nova com os 4 grupos completos (`ALTURA` 20,
    `MASTRO` 4, `HARMONICO` 16, `NIVEL_EXISTENTE` 10 — 50 no total), `projeta()` e `alvoMedido()`
    (harmônico usa retração de 0,618 da perna, não altura cheia). `tests/Unit/
    GenesisPatternProjectionTest.php` cobre altura/mastro/harmônico/sem-projeção/âncora-ausente/
    altura-zero, com a conta do harmônico conferida manualmente e por script (`round(106.18,8) ===
    106.18`, ponto flutuante confirmado estável).
  - Depende de: nada (é peça isolada), mas é pré-requisito técnico de B03.
  - Prova exigida: teste unitário cobrindo uma figura de cada grupo, alvo calculado conferido
    manualmente contra a medida clássica — **feito** (suíte não executada nesta sessão, só `php -l`;
    matemática conferida manualmente linha a linha).

### Bloco B — Alvos, disponibilidade de barreiras

- [x] **B01 (P0, bloqueante)** — VRVP: prompt proíbe o campo que o resto do sistema espera —
      `app/Services/GraphicalAnalysis/GenesisPrompt.php:23-24` [API] (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** Trecho reescrito pra declarar quatro chaves
    obrigatórias em estrutura, `vrvp` opcional em conteúdo (`{"presente":false}` válido); exemplo
    atualizado. Schema (A01) e validador (A02/A03) já exigem a quarta chave — a cadeia completa
    prompt→schema→validador→pipeline (B02/B03) fica consistente. `ExecutionPipelineService`/
    `ExecucaoService`/`MotorExecucaoService` já liam `$vrvp`/`hvn`/`poc` corretamente (nenhuma mudança
    necessária ali) — o gap era só o campo nunca chegar preenchido.
  - Agravante: a correção C07 da V6.5 rebaixou `levels.poc/hvn/lvn` calculados por candle de DECISION
    pra CONTEXT corretamente, porque o VRVP do gráfico deveria substituí-los — o corte funcionou, a
    substituição nunca chegou. Motor ficou com menos barreiras do que antes da V6.5.
  - Depende de: nada.
  - Prova exigida (pendente): log bruto de 5 análises reais mostrando `vrvp` presente na resposta, ao
    menos uma com `presente: true` alimentando POC ou HVN como barreira.

- [x] **B02 (P1, não bloqueante)** — Máxima e mínima da semana anterior calculadas e nunca lidas —
      `app/Services/GraphicalAnalysis/ExecutionPipelineService.php:68-69` [API]
      (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `$pwh`/`$pwl` lidos via evidência
    `levels.pwh`/`levels.pwl` (já calculados por `MarketZonesService`, catalogados como CONTEXT em
    `EvidenceCatalog`, nunca lidos por este pipeline) e entram em `$zonas['pwh']`/`['pwl']`.
    `ExecucaoService::montarBarreiras()` ganhou dois `$add()` novos com fonte `pwh_pwl`, mesmo
    tratamento de `pdh_pdl`.
  - Depende de: nada.
  - Prova exigida (pendente): teste demonstrando alvo ancorado em PWH ou PWL com dado real.

- [x] **B03 (P0, bloqueante)** — Figura não chega ao motor de barreiras —
      `app/Services/GraphicalAnalysis/ExecutionPipelineService.php:168` [API]
      (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `$figura` saiu de `null` fixo — `generate()`
    ganhou parâmetro `array $patterns = []` (o orquestrador passa
    `$decision['visual_observations']['patterns']`, já filtrado por A02/A03), percorre cada padrão via
    `GenesisPatternProjection::alvoMedido()`, preserva a de maior confiança entre as que projetam.
    `ExecucaoService::montarBarreiras()` já lia `$figura['alvo_projetado']` — só a fonte mudou de
    `'geometria'` (compartilhada com Fibonacci desenhado) pra `'figura_projetada'` própria, necessária
    pro peso distinto de B05.
  - Depende de: A06 (classificação de projeção) e A01-A05 (figura precisa estar chegando na decisão).
  - Prova exigida (pendente): análise real sobre gráfico com figura, alvo projetado disponível como
    candidato a barreira.

- [x] **B04 (P1, não bloqueante)** — Paredes do livro caem sempre dentro da zona de ruído —
      `app/Services/BinanceService.php` (`getOrderBookWalls`), `app/Services/AlvoService.php:63-70`
      [API] (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `getOrderBookWalls()`: `limit` default de 1000
    pra 5000 (maior aceito pelo endpoint de futuros `/fapi/v1/depth`). Único call site
    (`MarketSnapshotService`) usa o default, não precisou de mudança separada.
  - Depende de: nada.
  - Prova exigida (pendente): comparação antes/depois em 10 pares reais do número de paredes
    sobrevivendo ao filtro.

- [x] **B05 (P1, bloqueante)** — Recalibragem de pesos sem a fonte de liquidações —
      `app/Services/AlvoService.php`, constante `PESOS` [API] (implementado em 04/08/2026)
  - Status: **código aplicado e testado.** `cluster_liquidacao` saiu da tabela (DF-01). Tabela
    recalibrada exatamente conforme o documento: `parede_book` 10, `range_wyckoff` 9, `poc` 8,
    `pdh_pdl` 7, `pwh_pwl` 7, `hvn` 6, `resistencia_suporte` 6, `ema` 5, `geometria` 4,
    `figura_projetada` 3 — cada posição com comentário de justificativa no próprio código. Fonte não
    catalogada (ex.: `cluster_liquidacao` residual em barreira antiga) cai no peso default 1 em vez de
    quebrar — coberto por `test_b05_fonte_descontinuada_cluster_liquidacao_nao_quebra_o_calculo`.
  - Depende de: B02 (chave `pwh_pwl` precisa existir antes de entrar na tabela de pesos) — ✅.
  - Prova exigida: tabela de pesos documentada com justificativa técnica de cada posição — **feito**,
    em comentário no código.

### Bloco C — Alvos, regra de seleção

- [x] **C01 (P0, bloqueante)** — Pesos calculados e não usados para escolher —
      `app/Services/AlvoService.php`, método `ordenarPorDistancia` [API] (implementado em 04/08/2026)
  - Status: **código aplicado e testado.** `ordenarPorDistancia()` removido (nada mais o chamava).
    `notaQualidade()` nova — peso da fonte mais forte do grupo (45%, derivado de `PESOS` por fonte,
    já que `agruparConfluencia()` armazena fontes agregadas, não barreiras individuais), confluência
    entre fontes distintas no mesmo nível (35%, teto em 3, via `array_unique($grupo['fontes'])`),
    proximidade em ATR com decaimento suave (20%). `test_c01_barreira_forte_mais_distante_pode_vencer_
    fraca_mais_proxima_em_confluencia` cobre o cenário forte-vs-fraca.
  - Depende de: nada, mas é base técnica de C02 e C04 (implementados juntos no Anexo A).
  - Prova exigida: teste com cenário construído (barreira forte vs. fraca competindo), resultado
    esperado documentado — **feito** (suíte não executada nesta sessão, só `php -l`; lógica conferida
    manualmente com a aritmética da nota).

- [x] **C02 (P0, bloqueante)** — Escala de distância é requisito, não critério de desempate —
      `app/Services/AlvoService.php`, método `calcularAlvos` [API] (implementado em 04/08/2026)
  - Status: **código aplicado e testado.** `selecionarAlvos()` nova — TP1 é o primeiro nível relevante
    no caminho do preço (proximidade pesa de verdade), TP2/TP3 exigem separação mínima de 1 ATR em
    relação ao anterior (`SEPARACAO_MINIMA_ATR`); dentro da mesma faixa, o de melhor nota (C01) fica.
    Projeção de figura entra como candidata comum via fonte `figura_projetada` (B03/B05), sem
    privilégio — mesmo teto/separação de qualquer outra fonte.
    `test_c02_separacao_minima_de_1_atr_entre_alvos_consecutivos` cobre o descarte de barreira colada.
  - Depende de: C01 (implementados como uma peça só no Anexo A — `notaQualidade` +
    `selecionarAlvos`) — ✅.
  - Prova exigida: dez análises reais com os três alvos, fonte + distância em ATR + nota registradas
    em log, revisadas manualmente — **pendente** (exige análises reais).

- [x] **C03 (P1, não bloqueante)** — Horizonte máximo fixo não escala com timeframe —
      `app/Services/AlvoService.php`, constante `TETO_ATR_MULT` [API] (implementado em 04/08/2026)
  - Status: **código aplicado e testado.** `TETO_ATR_POR_TIMEFRAME` novo (6 ATR em 1m/3m até 25 ATR em
    1M), `tetoPorTimeframe()` com fallback de 15 ATR (`TETO_ATR_PADRAO`) pra timeframe fora do mapa —
    `TETO_ATR_MULT` removida. `calcularAlvos()` ganhou parâmetro opcional `?string $timeframe = null`
    (default preserva o comportamento antigo pros dois call sites do Plano B em
    `MotorExecucaoService.php`, que não foram alterados — threading até lá seria mais que o item
    pede). Threado até o Plano A: `ExecutionPipelineService::generate()` (já recebia `$timeframe`) →
    `ExecucaoService::montar()` (parâmetro novo) → `AlvoService::calcularAlvos()`.
    `test_c03_teto_por_timeframe_escala_o_horizonte_do_alvo` cobre 15m vs. 1w com a mesma barreira.
  - Depende de: nada.
  - Prova exigida: tabela de teto por timeframe com justificativa, teste em 15m e em 1w — **feito**.

- [x] **C04 (P0, bloqueante)** — Barreira descartada por ruído cai direto na projeção geométrica —
      `app/Services/AlvoService.php:63-70` [API] (implementado em 04/08/2026)
  - Status: **código aplicado e testado.** `projetarAlvos()` só roda quando o filtro de ruído esvazia
    **todos** os grupos — antes disso, `notaQualidade()` de cada grupo restante + `selecionarAlvos()`
    normalmente. Variável morta `$isLong` removida (C05, adiantado junto — mesma região de código).
    `test_c04_unica_barreira_dentro_da_zona_de_ruido_cai_em_projecao` reproduz o padrão do caso
    APTUSDT (barreira única a 0,10 ATR, descartada, sem outra candidata → projeção é o resultado
    correto); `test_c04_barreira_de_ruido_descartada_nao_impede_selecionar_proxima_barreira_valida`
    prova o oposto do bug original (barreira de ruído descartada não derruba mais a seleção inteira
    quando existe outra barreira real disponível).
  - Depende de: C01, C02 (usa `notaQualidade()` e `selecionarAlvos()` diretamente), C03 (usa
    `tetoPorTimeframe()`) — ✅ todos aplicados.
  - Prova exigida: reprodução do caso APTUSDT com resultado corrigido — teste unitário reproduz o
    padrão; **reprodução com o par real (dado de mercado ao vivo) pendente**.

**Pacote de evidências desta fase:** payload + chamada bem-sucedida (A01), teste confiança 0,60 (A02),
log de 10 análises com taxa de figura (A03), captura de tela com figura exibida (A04), 3+3 análises com
e sem figura (A05), teste unitário por grupo (A06), log de 5 análises com `vrvp` presente (B01), teste
PWH/PWL (B02), análise com alvo projetado de figura (B03), comparação de paredes em 10 pares (B04),
tabela de pesos documentada (B05), teste forte-vs-fraca (C01), 10 análises com fonte/distância/nota
(C02), teste 15m/1w (C03), caso APTUSDT reproduzido (C04). Reviso antes de seguir pra Fase 3.

**Status em 04/08/2026: 15 de 15 itens da Fase 2 com código aplicado e passando `php -l` +
`tsc --noEmit` (limpo). Testes unitários escritos para A02, A03 (fixture atualizada), A06, B05, C01,
C02, C03, C04 — cobrindo especificamente os cenários que o documento pede prova (confiança baixa
filtrada, chave ausente reprovando, projeção por grupo, barreira forte vs. fraca, separação mínima,
teto por timeframe, caso-tipo APTUSDT). Suíte PHPUnit não executada nesta sessão (mesma decisão da
Fase 1: toca o banco de dev `genesisteste`); lógica de cada teste conferida manualmente linha a linha
contra a implementação antes de escrever a asserção. Nenhuma chamada real a Gemini/Binance rodada —
todas as "provas REAL" (payload bruto, capturas de tela, análises ao vivo, comparação de paredes em
pares reais) seguem pendentes, mesmo padrão da Fase 1.

**Decisões de escopo tomadas nesta implementação, fora do texto literal do Anexo A (documento é
ilustrativo com nomes/assinaturas diferentes da implementação real, mesma ressalva já registrada nos
testes B11/E04 da V6.5):**
- A01: só `forGemini()` foi alterado (o método realmente enviado à API); `schema()` continua com
  `bbox` — só usado por teste e pelo pacote arquivado `_v6_4_package`, fora do caminho real.
- A02/A03: `DecisionResponseValidator::validate()` e `validateVisual()` passaram a receber `$decision`
  por referência — mudança de assinatura necessária (não pedida explicitamente pelo Anexo A, mas
  citada como pré-requisito: "`$decision` precisa ser passado por referência para que a filtragem
  persista") pra que a figura filtrada e as chaves normalizadas cheguem ao `$lastDecision` que o
  orquestrador cacheia/persiste, em vez de se perderem numa cópia local do método.
- B02/B03: código real usa `ExecucaoService::montarBarreiras()` com `$zonas['pdh']/['pdl']`, não o
  `data_get($snapshot, 'zones.pdh')` ilustrativo do documento — PWH/PWL entraram no mesmo padrão de
  `$zonas` já existente, não como parâmetro novo de `montarBarreiras()`.
- B03: fonte da figura projetada mudou de `'geometria'` (só citada no texto do documento) pra
  `'figura_projetada'`, própria — sem isso o peso 3 de B05 não teria como ser distinto do peso 4 do
  Fibonacci desenhado, que já usa `'geometria'` no código real.
- C01-C04: `agruparConfluencia()` armazena fontes agregadas por grupo (`fontes[]`, `peso_total`), não
  uma lista de barreiras individuais como o pseudocódigo do documento assume — `notaQualidade()`
  deriva o peso máximo do grupo a partir de `PESOS[fonte]` sobre as fontes agregadas, resultado
  equivalente.
- C03: `calcularAlvos()` ganhou `?string $timeframe = null` (default preserva comportamento antigo).
  Threado até o Plano A (caminho principal); os dois call sites do Plano B em
  `MotorExecucaoService.php` continuam com o teto fixo de 15 ATR — threar até lá seria refatoração
  maior que o item pede (P1, não bloqueante).

---

## FASE 3 — 🔒 Onda 3: Contradições na tela (E01, E03, E04, F01, F02, F06)

Corrige o sistema se contradizendo na própria tela — não muda o que o motor calcula, muda o que ele diz
sobre o que calculou.

- [x] **E01 (P0, bloqueante)** — Análise sem barreira real trava a tela — `app/Services/
      ExecucaoService.php:256`, `components/AnalysisResult.tsx:170` [API]/[FE]
      (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `SEM_BARREIRA_REAL` e `RISCO_NAO_CONFIGURADO`
    agora alteram só `recommended`/`reason` — `executable` fica `true` e `status` fica `EXECUTAVEL`
    nos dois casos (antes desabilitava os dois planos). Motivo de `RISCO_NAO_CONFIGURADO` e
    `SEM_BARREIRA_REAL` reescritos com acentuação correta no mesmo bloco (F02). Teste
    `ExecutionExecutableVsRecommendedTest::test_e02_sem_barreira_real_continua_bloqueando_executable`
    (que provava exatamente a regressão que este item corrige) renomeado pra
    `test_e01_sem_barreira_real_nao_bloqueia_mais_apenas_avisa`, com as asserções invertidas — mesmo
    padrão usado no D02 da Fase 1.
  - Isso é regressão direta da própria DP-03 (E02 da V6.5 aplicou a regra certo pra RR e convicção,
    faltou aplicar aqui) e tira da base justamente as análises de leitura mais frágil, que são as mais
    informativas pra calibrar o sistema.
  - Depende de: nada.
  - Prova exigida (pendente): análise real sem barreira real, plano selecionado pelo membro, registro
    confirmado no banco.

- [x] **E03 (P0, bloqueante)** — Zona do Plano B atravessa a invalidação da tese —
      `app/Services/MotorExecucaoService.php`, método `gerarPlanoB`, linhas 152-160 [API]
      (implementado em 04/08/2026)
  - Status: **código aplicado e testado.** `zonaDe` (branch LONG) e `zonaAte` (branch SHORT — nosso
    código real tem os dois branches como blocos separados, não um único método com if/else como o
    pseudocódigo do Anexo A) limitadas contra `$stopFinalPlanoA`, com margem
    `max($atr*0.10, $entradaB*0.001)`. Zona degenerada após o limite (`zonaAte <= zonaDe` ou menor que
    0,10 ATR) devolve `null`. `tests/Unit/MotorExecucaoServiceE03Test.php` novo (3 testes: LONG não
    ultrapassa invalidação, SHORT não ultrapassa invalidação, zona degenerada vira indisponível) —
    matemática conferida por script PHP standalone antes de escrever as asserções. Testes existentes
    de Plano B (`MotorExecucaoServicePlanoBTest`, `ExecucaoServiceG02Test`) conferidos manualmente
    contra a correção — nenhum quebra (usam `stopFinal=0.0`/null, fora do novo caminho, ou o clamp de
    zona não altera o resultado esperado).
  - Caso real documentado: BTCUSDT 01/08/2026, invalidação em 63.974,41, zona publicada até 65.157,00
    — topo 1.182,59 acima do próprio nível que a tela declara como perda de validade da tese.
  - Depende de: nada.
  - Prova exigida (pendente): reprodução do caso BTCUSDT com zona corrigida usando dado real de
    mercado (o teste unitário reproduz o padrão, não os números exatos do caso real).

- [x] **E04 (P1, bloqueante)** — Risco e retorno calculado sobre alvo projetado —
      `app/Services/ExecucaoService.php:180-206` [API] (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `$recompensaPreco` (base de `rr_bruto` e,
    indiretamente, de `rr_liquido_estimado`) só é calculado quando `$tp1Real` é verdadeiro — sobre
    projeção geométrica os dois saem `null`. `rr_minimo_referencia` (número) e `rr_abaixo_do_minimo`
    (booleano) adicionados a `candidate_setup`, a cada item de `planos[]` (A e B) — Plano B calcula o
    próprio `rr_abaixo_do_minimo` a partir de `$rrLiquidoB`, já que não tem o conceito de `tp1Real`
    (Plano B nunca teve `tp1_fonte` próprio, sempre `null`, ver comentário G15 já existente no código).
  - Casos reais 01/08/2026: APTUSDT exibiu 1:0.56, SUIUSDT 1:1.09, ambos com os três alvos rotulados
    como projeção sem barreira real, na mesma tela que exibia o número.
  - Depende de: nada, mas é pré-requisito de F01.
  - Prova exigida (pendente): análise real sem barreira real, campo exibindo ausência em vez de
    número.

- [x] **F01 (P1, bloqueante)** — Risco e retorno em um único lugar — `components/AnalysisResult.tsx`,
      `components/BlocoConviccaoQualidade.tsx` [FE], `ExecucaoService.php` [API]
      (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** Removidos da tela: a faixa de status abaixo do
    par (`{executionLabel[execution.status]}` sob o ticker), o banner âmbar de status
    (`temAviso && ...`, variável `temAviso` também removida por ficar sem uso), o card "RISCO/RETORNO
    (TP1)" (grid ajustado de 4 pra 3 colunas) e a caixa amarela "Risco Retorno abaixo do recomendado"
    no fim do pipeline (`ShieldAlert` também removido do import por ficar sem uso). A caixa genérica de
    `execution.avisos` (F1) foi **mantida** — decisão de escopo: no código real (diferente do
    pseudocódigo do documento) essa caixa nunca foi exclusiva de RR, também carrega aviso de convicção
    baixa e de alavancagem reduzida por segurança; removê-la silenciaria esses dois avisos legítimos,
    que o documento não pede pra tirar. Como o backend (F01+E01) já para de empurrar texto de RR pra
    `avisos[]`, a caixa naturalmente nunca mais mostra RR, sem precisar ser removida. `NAO_RECOMENDADA_RR`
    não muda mais `status`/`avisos`/`motivo` — só `recommended`/`reason_code`. `BlocoConviccaoQualidade`
    ganhou `rrMinimo`/`rrAbaixoDoMinimo` (opcionais) e agora mostra "sem alvo ancorado em barreira real"
    quando `rr` é `null`, e a observação entre parênteses no padrão exato do documento quando abaixo do
    mínimo.
  - Restrição (DP-09): cálculo não muda, só apresentação — confirmado, nenhuma fórmula de RR foi
    alterada nesta implementação, só o gate de `!$tp1Real` (E04) e onde/como o resultado aparece.
  - Depende de: E04 (precisa do RR nulo/flag de abaixo-do-mínimo vindo certo do backend antes de
    montar a exibição única) — ✅.
  - Prova exigida (pendente): captura de tela com valor adequado e com valor abaixo do mínimo.

- [x] **F02 (P1, bloqueante)** — Textos do backend chegam à tela sem acentuação —
      `app/Services/ExecucaoService.php:29,53,113,236,255,261,269,275,288`,
      `app/Services/MotorExecucaoService.php:199-201` [API] (implementado em 04/08/2026)
  - Status: **código aplicado e testado.** Todas as cadeias member-facing dos dois arquivos
    acentuadas (`NivelService.php` já estava correto, conferido, nenhuma mudança). `descricaoB` do
    Plano B (LONG e SHORT) trocou também "orderbook" por "livro de ofertas", conforme o exemplo
    corrigido do documento. `tests/Unit/AcentuacaoTextosTest.php` novo — **não** reimplementa o
    scanner genérico do documento (regex sobre toda string de 20+ caracteres): testado contra o código
    real, esse regex tem dois falsos positivos estruturais (string capturada entre duas aspas não
    relacionadas quando há código curto entre duas literais na mesma linha; a palavra-suspeita
    "niveis" colide com o nome da variável `$niveis`, usada dezenas de vezes). O teste trava as
    strings específicas corrigidas nesta sessão em vez de um scanner genérico — todas as 24 asserções
    conferidas por script PHP standalone (sem framework, sem DB) antes de escrever o arquivo de teste.
  - Depende de: nada.
  - Prova exigida (pendente): captura de tela dos quatro estados de execução com textos corrigidos.

- [x] **F06 (P1, bloqueante)** — Barras de contexto apresentam macro como se influenciasse a direção —
      `components/ScoreBasisBars.tsx:83-91` [FE] (implementado em 04/08/2026)
  - Status: **código aplicado.** Barras de Macro e Sentimento perderam a polaridade em relação à
    direção (função `apoiaSe` removida, ficou sem uso) — usam a mesma cor neutra do bloco Técnico e
    legenda puramente informativa ("Contexto macro/geopolítico — informativo" /
    "Sentimento do ativo — informativo"), sem "favorece"/"contraria a leitura". Sem teste automatizado
    (componente visual sem lógica de cálculo — a prova real é a captura de tela pedida abaixo).
  - Restrição (DP-06): blocos de sentimento do ativo e macro/geopolítico (texto completo, componente
    separado) não foram alterados em conteúdo — só esta barra de resumo.
  - Depende de: nada.
  - Prova exigida (pendente): captura de tela com operação SHORT e macro altista, sem contradição
    visual.

**Pacote de evidências desta fase:** plano selecionado e gravado sem barreira (E01), caso BTCUSDT
reproduzido (E03), análise sem barreira com RR ausente (E04), capturas nos dois estados de RR (F01),
capturas dos quatro estados de execução com acentuação (F02), captura SHORT+macro altista (F06). Reviso
antes de seguir pra Fase 4.

**Status em 04/08/2026: 6 de 6 itens da Fase 3 com código aplicado, passando `php -l` + `tsc --noEmit`
(limpo). Testes unitários escritos/atualizados para E03 (novo) e F02 (novo); teste existente de E01
(`ExecutionExecutableVsRecommendedTest`) corrigido — duas das suas asserções provavam exatamente o
comportamento que E01/F01 revertem, mesmo padrão de teste-invertido usado no D02 da Fase 1. Testes de
Plano B pré-existentes (V6.5) conferidos manualmente contra a correção de E03, nenhum quebra. Suíte
PHPUnit não executada nesta sessão (mesma decisão das Fases 1 e 2 — banco de dev `genesisteste`);
lógica de cada teste novo/alterado conferida por scripts PHP standalone (sem framework, sem rede, sem
DB) antes de finalizar. Nenhuma chamada real a Gemini/Binance rodada — todas as "provas REAL" seguem
pendentes.**

---

## FASE 4 — 🔒 Onda 4: Coerência, dados e higiene

Nenhum destes muda o que o membro recebe diretamente (exceto pontualmente C06/F08/F09, cosméticos). Só
garante que o sistema não colete dado sem destino e não confunda quem lê.

### Restante do Bloco C

- [x] **C05 (P2, não bloqueante)** — Variável `$isLong` declarada e nunca usada —
      `app/Services/AlvoService.php:63` [API] (já implementado em 04/08/2026, junto de C04)
  - Status: **feito**. Confirmado via grep — `$isLong` não existe mais em `AlvoService.php`. Removida
    como parte da reescrita de `projetarAlvos()`/filtro de ruído do próprio C04 na Fase 2, exatamente
    como o item previa ("já sai como parte da reescrita de C04").
  - Depende de: C04 — ✅.
  - Prova exigida: revisão de código — feito.

- [x] **C06 (P2, não bloqueante)** — Alvo ausente precisa dizer qual faixa está vazia —
      `app/Services/AlvoService.php`, `components/AnalysisResult.tsx` [API]/[FE] (implementado em
      04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `AlvoService::calcularAlvos()` ganhou
    `tp2_motivo`/`tp3_motivo` (string quando o slot fica `null` por falta de barreira dentro do
    horizonte do timeframe — única causa possível nesse caminho — `null` quando preenchido), threado
    por `ExecucaoService.php` até `candidate_setup` e `planos[]` (Plano A; Plano B nunca deixa
    tp2/tp3 `null` individualmente — ou o plano inteiro é `null`, ou o próprio motor completa a
    escada via projeção, ver `MotorExecucaoService::gerarPlanoB`, por isso sem campo próprio ali,
    mantido `null` por consistência estrutural). FE: `types.ts`/`geminiService.ts` atualizados; TP3 em
    `AnalysisResult.tsx` deixou de desaparecer quando `null` (mesmo tratamento de TP2 agora — traço +
    motivo em vez de sumir do layout).
  - Depende de: C01-C04 — ✅.
  - Prova exigida (pendente): captura de análise com dois alvos e de análise com um alvo.

### Restante do Bloco D

- [x] **D03 (P2, não bloqueante)** — Motivo da rejeição de imagem não chega ao membro —
      `app/Http/Controllers/Api/GraphicalAnalysisController.php`,
      `app/Exceptions/GraphicalAnalysisException.php` [API] (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `GraphicalAnalysisException::motivoLegivel()`
    novo — mapa `MOTIVOS` por `$reason` (`ANALYSIS_UNAVAILABLE`, `MARKET_CANDLES_UNAVAILABLE`,
    `IMAGE_READ_FAILED`, `MODEL_OUTPUT_INVALID_AFTER_REPAIR`, `IMAGE_REJECTED`) com fallback genérico.
    Controller expõe `motivo` (sempre) e `details` (só com `config('app.debug')`, igual ao documento).
    Adaptação: nosso `IMAGE_REJECTED` não carrega um código fixo por checagem como o mapa `MOTIVOS`
    ilustrativo do documento (`CHART_MARKET_NOT_FUTURES` etc.) — essas seis checagens só existem no
    caminho `MODEL_OUTPUT_INVALID_AFTER_REPAIR` (`DecisionResponseValidator::validate()`). Pra
    `IMAGE_REJECTED`, `$details` já é o texto livre que o próprio modelo devolveu em
    `chart_validation.reasons` (`GenesisDecisionSchema`) — `motivoLegivel()` usa esse texto quando
    presente, em vez de reescrever um mapa fixo que não corresponde ao dado real disponível.
  - Depende de: nada.
  - Prova exigida (pendente): captura de tela de cada tipo de rejeição com mensagem específica.

### Restante do Bloco F

- [x] **F03 (P1, não bloqueante)** — Escala do score, só rótulo — `components/AnalysisResult.tsx`,
      `components/BlocoConviccaoQualidade.tsx` [FE] (implementado em 04/08/2026)
  - Status: **feito.** Barra de preenchimento não foi tocada (já correta, confirmado). Rótulo textual
    `/90` → `/100` em `AnalysisResult.tsx`. Adaptação: `BlocoConviccaoQualidade.tsx` tinha a mesma
    ocorrência de `/90` não citada pelo documento (mesma regra, DP-02) — corrigida junto, por
    consistência.
  - Depende de: nada.
  - Prova exigida (pendente): captura com score 90 e com score 40.

- [x] **F04 (P1, não bloqueante)** — Duas escalas de convicção coexistem —
      `app/Services/GraphicalAnalysis/GenesisPrompt.php`, `utils/conviccao.ts` [API]/[FE]
      (implementado em 04/08/2026)
  - Status: **feito.** `GenesisPrompt.php` já usava exatamente o corte do documento (0-30/35-50/55-
    65/70-80/85-90) — nenhuma mudança necessária no prompt. `utils/conviccao.ts` reescrito com
    `FAIXAS_CONVICCAO` (mesmo corte, mesmos rótulos) substituindo a tabela antiga (Fraca≤40/Parcial≤60/
    Consistente≤75/Forte>75) que divergia do prompt — exatamente o caso relatado (score 75 = "forte"
    no prompt, "Consistente" na tela).
  - Depende de: nada.
  - Prova exigida: tabela única documentada e aplicada nos dois lados — feito.

- [x] **F05 (P2, não bloqueante)** — Três formatos de valor monetário na mesma tela —
      `services/cryptoApi.ts` (`formatPrice`), `components/AnalysisResult.tsx` [FE] (implementado em
      04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `formatPrice()` aplicado no texto de tamanho
    sugerido (nocional + risco estimado) e na legenda de risco de capital — os três pontos que
    exibiam formato próprio (`$${x.toFixed(2)}`, `$${riscoUsd}` cru) agora usam o mesmo formatador dos
    preços gerais.
  - Depende de: nada.
  - Prova exigida (pendente): captura de tela com os três campos no mesmo padrão.

- [x] **F07 (P2, não bloqueante)** — Versão exibida desatualizada — `config/genesis_graphical_v6.php`,
      `app/Support/GenesisDecisionSchema.php` [API] (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `document_version`/`prompt_version`/
    `schema_version` → V6.6; `GenesisDecisionSchema::VERSION` acompanha (as duas precisam bater — a
    constante é o que o schema exige do modelo em `decision.schema_version`, o config é o que entra no
    `chart_fingerprint`). `tests/Feature/GraphicalAnalysisLoadTest.php` tinha `schema_version` da V6.4
    hardcoded numa fixture — trocado pra ler da constante, pra não quebrar de novo na próxima versão.
  - Depende de: nada — aplicado por último dentro desta fase, depois de todas as demais mudanças de
    Fase 4 já estarem no código, seguindo a ordem que o próprio item pede.
  - Prova exigida (pendente): captura do rodapé e log do fingerprint com versão nova.

- [x] **F08 (P2, não bloqueante)** — Campo "Condição de Disparo" repete rótulo de status —
      `components/AnalysisResult.tsx` [FE] (implementado em 04/08/2026)
  - Status: **código aplicado.** Campo removido (uma das duas opções que o próprio item permite:
    "conteúdo próprio, ou remoção do campo") — mostrava `executionLabel[execution.status]`, repetição
    do status pela terceira vez na tela (F01 da Fase 3 já tinha removido as outras duas). O conteúdo
    real da condição de entrada do Plano B (zona + descrição do motor) já aparece no card do seletor
    de plano (`planoBDescricaoCompleta`), então não havia conteúdo próprio novo a mostrar — duplicar
    seria pior que remover. `executionLabel` e o import de `ExecutionStatus` ficaram sem uso após a
    remoção, também removidos.
  - Depende de: nada.
  - Prova exigida: nenhuma especificada no documento — revisão de código.

- [x] **F09 (P2, não bloqueante)** — Conclusão do bloco de qualidade alterna duas gramáticas —
      `components/BlocoConviccaoQualidade.tsx` [FE] (implementado em 04/08/2026)
  - Status: **código aplicado.** `montarConclusao()` reescrita — gramática única
    (`${favoraveis} de ${total} ${fator/fatores} de localização ${é favorável/são favoráveis}`), sem
    mais o branch "pesam contra" (ruins≥2) nem a distinção "todos são favoráveis". Mensagem de estado
    vazio (sem fatores) trocou "os quatro fatores" fixo por texto sem número, igual ao caso de
    `montarConclusao` com `total===0`.
  - Depende de: nada.
  - Prova exigida (pendente): captura de tela.

- [x] **F10 (P2, bloqueante)** — Seleção de plano pode gravar na análise errada —
      `components/AnalysisResult.tsx` [FE] (implementado em 04/08/2026)
  - Status: **código aplicado.** `handleZoneSelect` parou de cair no fallback `fetchHistoricoAnalises()`
    → `lista[0]` quando `analiseId` está ausente — agora erra explicitamente ("Não foi possível
    registrar a escolha. Recarregue a análise."), igual ao Anexo A. Adaptação: a rota backend por
    `analysis_uuid` **já existia**, implementada na V6.5 (A01-A03, `AnaliseController::resolveAnalise()`
    aceita `id` numérico legado OU `analysis_uuid`, com filtro de dono) — não foi o gap real. O gap era
    só o fallback do frontend, que ignorava esse identificador confiável quando `analiseId` vinha nulo
    e adivinhava pelo histórico.
  - Depende de: nada.
  - Prova exigida (pendente): teste com duas análises concorrentes.

### Bloco G — Dados e cobertura

- [x] **G01 (P1, não bloqueante)** — Duas evidências impossíveis derrubam a cobertura de toda análise —
      `app/Services/GraphicalAnalysis/EvidenceCatalog.php` [API] (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `derivatives.cvd` e `derivatives.liquidations`
    rebaixados de DECISION pra CONTEXT — mesmo tratamento já dado a `levels.poc/hvn/lvn` na V6.5.
  - Depende de: nada.
  - Prova exigida (pendente): cobertura antes/depois em cinco análises reais.

- [x] **G02 (P2, não bloqueante)** — Normalização de `visual_observations` não é persistida —
      `app/Services/GraphicalAnalysis/DecisionResponseValidator.php` [API] (já implementado em
      04/08/2026, junto de A03 na Fase 2)
  - Status: **feito.** Confirmado via leitura de `validateVisual(array &$decision)` — a normalização
    das quatro chaves escreve direto em `$decision['visual_observations']` (linha final do método,
    `$decision['visual_observations'] = $visual;`), por referência, exatamente o que este item pede.
    Sem trabalho adicional nesta fase — item já resolvido como efeito colateral necessário de A03
    (documentado em A02/A03 na Fase 2: mudança de assinatura pra `&$decision` foi feita justamente
    pra isso).
  - Depende de: A03 — ✅.
  - Prova exigida: teste automatizado — coberto pelos testes de A02/A03 (`DecisionResponseValidatorTest.php`).

- [x] **G03 (P1, não bloqueante)** — Narrativa macro/sentimento desaparece em silêncio —
      `app/Services/GraphicalAnalysis/InformativeNarrativeService.php` [API] (implementado em
      04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** Limpeza de cercas de markdown antes do
    `json_decode` (mesmo padrão de `VisualLevelsService`/`ChartMetadataScanService`),
    `responseMimeType: application/json` adicionado ao `generationConfig` (nenhum dos dois serviços
    "equivalentes" citados pelo documento usa isso hoje, mas é a recomendação específica deste item —
    mantido). Log `genesis.narrativa_informativa.json_invalido` (symbol, erro, trecho) no lugar do
    `return null` silencioso.
  - Restrição (DP-06): não altera conteúdo dos blocos de macro/sentimento — confirmado, só a limpeza
    do texto bruto antes do parse, nenhum campo de conteúdo tocado.
  - Depende de: nada.
  - Prova exigida (pendente): log de 10 análises reais com o bloco presente em todas.

- [ ] **G04 (P2, não bloqueante)** — Regra de expiração incompleta —
      `config/genesis_graphical_v6.php`, `app/Console/Commands/EvaluateGenesisOutcomes.php` [API]
  - Status: **divergência encontrada, resolvida com o usuário, sem mudança de código.** O premissa do
    documento (tabela cobrindo 6 de 16 timeframes, os outros 10 "sem horizonte definido") não existe
    no código real. `EvaluateGenesisOutcomes.php` não tem tabela por timeframe nenhuma — desde a V6.5
    (F06) ele roda os mesmos 3 horizontes fixos (`outcome_horizons_minutes` = 60/240/1440 min) pra
    TODA análise, de qualquer timeframe. `AcompanharPlanos.php` (expiração do Plano B, conceito
    relacionado mas separado) também usa um prazo fixo único (`PRAZO_EXPIRACAO_HORAS = 72`) igual pra
    todos os timeframes. Ou seja, hoje nenhum timeframe fica sem regra — todos usam a mesma regra
    genérica, só que ela não escala com o timeframe da análise (1m e 1M usam os mesmos horizontes/
    prazo). Perguntei antes de decidir por interpretação (mesma regra do documento, seção 14) —
    **decisão do usuário: deixar como está, só documentar.** O sintoma exato do documento (timeframe
    "sem horizonte definido", telemetria pendente indefinidamente) não existe no código real.
  - Depende de: nada.
  - Prova exigida: não aplicável — sem mudança de comportamento.

- [x] **G05 (P2, não bloqueante)** — Máxima/mínima do período anterior erradas em timeframe alto —
      `app/Services/GraphicalAnalysis/MarketZonesService.php`,
      `app/Services/GraphicalAnalysis/EvidenceManifestBuilder.php`,
      `app/Services/GraphicalAnalysis/CanonicalBundleBuilder.php` [API] (implementado em 04/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `MarketZonesService::rotuloPeriodo(?string
    $timeframe)` novo — timeframe em `['1d','3d','1w','1M']` rotula "período anterior", abaixo disso
    "dia anterior" (`calculate()` em si não muda — o cálculo já era o candle anterior correto da série
    resampleada, só o rótulo mentia sobre o que era). Adaptação: o documento previa o rótulo entrando
    já dentro de `MarketZonesService::calculate()`, mas o rótulo de cada evidência é montado em
    `EvidenceManifestBuilder`, não em `MarketZonesService` (que só devolve valores numéricos) — o
    label de `levels.pdh`/`levels.pdl` é sobrescrito ali (`EvidenceManifestBuilder::build()` ganhou
    parâmetro `?string $timeframe = null`, default preserva rótulo antigo pro único call site de
    teste que não passa timeframe), threado por `CanonicalBundleBuilder` (que já tinha `$timeframe`
    em escopo).
  - Depende de: nada.
  - Prova exigida (pendente): teste em semanal.

### Bloco H — Higiene de código (nenhum item altera comportamento)

- [x] **H01 (P2, não bloqueante)** — Remover `unifiedChartAnalysis()` completa —
      `services/geminiService.ts` [FE] (implementado em 04/08/2026)
  - Status: **feito.** Função removida junto do JSDoc e do import de `UnifiedChartResult` (só usado
    ali). Confirmado via grep: chamava `/v1/unified-scan`, rota que não existe em nenhuma lugar do
    backend real (só citada no pacote `_v6_4_package` arquivado) — nenhum código de produção
    chamava a função, só testes. Testes que a exercitavam removidos/reescritos junto (ver H02) — suíte
    `npm test` conferida antes e depois: mesmas 29 falhas pré-existentes (não relacionadas), 0 falhas
    novas introduzidas.
  - Depende de: nada.
  - Prova exigida: revisão de código — feito.

- [x] **H02 (P2, não bloqueante)** — Remover `@google/genai` e `import { Type }` — `package.json`,
      `geminiService.ts` [FE] (implementado em 04/08/2026)
  - Status: **feito.** Import removido (`Type` não era usado em lugar nenhum do arquivo);
    `"@google/genai"` removida de `dependencies`; `npm install` rodado pra ressincronizar
    `package-lock.json` (74 pacotes removidos). Dois testes que dependiam de `unifiedChartAnalysis()`
    (removida em H01) tiveram que ser ajustados pra não quebrar: `__tests__/geminiService.test.ts`
    (describe block `unifiedChartAnalysis fallback behavior` removido, os outros dois describe blocks
    do arquivo intactos) e `services/__tests__/integration.e2e.test.ts` (teste que afirmava a
    existência da função reescrito pra afirmar só que `scanChartMetadata` é independente dela, sem
    citar o nome da função removida). `npx tsc --noEmit` limpo.
  - Depende de: nada.
  - Prova exigida: revisão de código — feito.

- [x] **H03 (P2, não bloqueante)** — Remover modelos antigos de `config/gemini.php` [API]
      (implementado em 04/08/2026)
  - Status: **feito, com adaptação.** Este `config/gemini.php` pertence a um pacote de terceiros
    (`hosseinhezami/laravel-gemini`) não referenciado em lugar nenhum de `app/` (grep confirmado) —
    não é o pipeline real do Gênesis (`GeminiInteractionsClient`/`genesis_graphical_v6.php`). Em vez
    de só remover os três nomes de modelo antigos deixando os campos vazios, atualizados pro modelo
    único vigente (`gemini-3.6-flash`, DET-2 do PO) — consistente com a correção do próprio H02.
  - Depende de: nada.
  - Prova exigida: revisão de código — feito.

- [x] **H04 (P2, não bloqueante)** — Remover linguagem confirmatória e escala errada —
      `MotorExecucaoService.php` [API] (implementado em 04/08/2026)
  - Status: **feito.** "Setup confirmado." removido; "/100" removido das quatro ocorrências (a
    original citada pelo documento mais duas em `validarDirecao()`, mesmo padrão, linhas reais
    deslocadas das do documento). Achado colateral: `gerarSetup()` (onde vivem as duas ocorrências) e
    `validarDirecao()` (privado, só chamado por `gerarSetup()`) não têm nenhum call site em `app/` —
    código morto, confirmado via grep. Corrigido mesmo assim (consistência do código, sem custo de
    risco por ser inalcançável).
  - Depende de: nada.
  - Prova exigida: revisão de código — feito.

- [x] **H05 (P2, não bloqueante)** — Remover blocos "DEBUG TEMPORÁRIO" —
      `GraphicalAnalysisOrchestrator.php`, `NarrativeFidelityGate.php` [API] (implementado em
      04/08/2026)
  - Status: **feito.** Bloco de `GraphicalAnalysisOrchestrator.php` (log `GENESIS_V64_DEBUG_
    IMAGE_REJECTED`) removido — a causa que o gerou (reason_code `IMAGE_REJECTED` nunca expondo
    `chart_validation` em lugar nenhum) foi resolvida de verdade por D03 nesta mesma fase, o log de
    diagnóstico não faz mais falta. Bloco de `NarrativeFidelityGate.php` (log `GENESIS_V64_DEBUG_
    NUMERIC_CITATION_VALUE_MISMATCH`) removido junto com o `use Illuminate\Support\Facades\Log;` que
    ficou sem uso depois.
  - Depende de: nada.
  - Prova exigida: revisão de código — feito.

- [x] **H06 (P2, não bloqueante)** — `PIPELINE.md` na raiz da API [API] (removido em 04/08/2026)
  - Status: **feito — removido** (uma das duas opções que o próprio item permite: "substituir pelo
    fluxo da V6 ou remover"). Documento descrevia uma arquitetura inteiramente obsoleta
    (`IAGatewayController`, `GeminiAnalysisService`, `ScoringService`, `POST /api/v1/analyze` chamando
    "Gemini 2.5 Flash") — nenhuma dessas classes/rotas existe no código real (pipeline atual é
    `GraphicalAnalysisOrchestrator`/`ExecutionPipelineService`). Escrever a substituição precisa
    (documentar ~15 passos do pipeline real) é além do escopo de higiene desta fase — removido em vez
    de deixar um documento ativamente enganoso no repositório. Nenhuma referência a `PIPELINE.md` em
    código ou outro documento (grep confirmado).
  - Depende de: nada.
  - Prova exigida: revisão de código — feito.

- [ ] **H07 (P2, não bloqueante)** — Remover resíduos das cinco famílias —
      `FamiliasTrader.tsx`, `ConfluenceScore.tsx`, `scoringEngine.ts`, `interpretationEngine.ts` [FE]
      — abandonados na V6.
  - Status: **pulado a pedido do usuário — divergência real encontrada entre documento e código.**
    Investigação: só `FamiliasTrader.tsx` está de fato órfão (zero imports em qualquer lugar do
    repositório). Os outros três estão vivos: `ConfluenceScore.tsx` foi reaproveitado — hoje é o
    widget "Micro Radar" (feed de alertas via `useAlertas`/`AlertCard`), renderizado de verdade em
    `MarketWidget.tsx`, sem nenhuma relação com scoring de famílias apesar do nome antigo do arquivo.
    `scoringEngine.ts`/`interpretationEngine.ts` são importados por `services/adaptedDataFetcher.ts` e
    têm 5+ arquivos de teste dedicados (`emaFallback.test.ts`, `emaClassifier.property.test.ts`,
    `macdMinCandles.test.ts`, etc.) — código ativo, não resíduo. Removê-los quebraria o Micro Radar e
    o `adaptedDataFetcher`. Perguntei antes de decidir por interpretação (mesma regra do documento,
    seção 14) — **decisão do usuário: pular o item inteiro por agora**, sem remover nenhum dos 4
    arquivos. Fica pendente pra revisão manual futura, com mais contexto sobre o que
    `adaptedDataFetcher`/Micro Radar realmente alimentam na tela hoje.
  - Depende de: nada.
  - Prova exigida: não aplicável — item não implementado nesta sessão.

- [x] **H08 (P2, não bloqueante)** — Corrigir condição com string inexistente —
      `AnalysisResult.tsx` [FE] (já resolvido antes desta fase)
  - Status: **já resolvido, sem código a corrigir.** Grep em todo o repositório confirma que
    `V6_4_SEM_EXECUCAO` não existe em lugar nenhum — nem em `AnalysisResult.tsx` (que hoje não tem
    nenhuma comparação com `reason_code`/`V6_4` na linha citada pelo documento nem em qualquer outra),
    nem em qualquer outro arquivo de código. Só `V6_4_EXECUCAO_INDISPONIVEL` (a string correta) é
    emitida, em `services/geminiService.ts:237`. A condição com a string errada que o documento
    descreve não existe mais no código real — resolvida em alguma revisão anterior a este ciclo.
  - Depende de: nenhum item do Bloco H depende de outro bloco. Todos podem rodar em qualquer ordem
    dentro desta fase.
  - Prova exigida: revisão de código — feito.

**Pacote de evidências desta fase:** capturas/tabelas/testes listados por item acima. Ao fechar,
preencher `MATRIZ_DE_ACEITE_V6_6.md` com as 46 linhas, mesmo padrão do V6.5, e montar pacote completo
pra revisão antes de envio ao Fabrício.

**Status em 04/08/2026: 21 de 23 itens da Fase 4 com código aplicado (ou já resolvidos/confirmados
sem mudança necessária), passando `php -l` + `tsc --noEmit` (limpo) + `npm test` (mesma linha de base
de 29 falhas pré-existentes, 0 novas). G04 documentado sem mudança de código (decisão do usuário —
premissa do documento não existe no código real). H07 pulado a pedido do usuário (3 dos 4 arquivos
citados estão vivos, não são resíduo — removê-los quebraria funcionalidade real). Nenhuma chamada real
a Gemini/Binance rodada nesta fase — "provas REAL" pendentes seguem o mesmo padrão das Fases 1-3.**

**Decisões de escopo tomadas nesta implementação, fora do texto literal do documento:**
- D03: `motivoLegivel()` usa o texto livre de `chart_validation.reasons` (já escrito pelo modelo) pra
  `IMAGE_REJECTED`, em vez do mapa fixo de códigos do documento — nosso `IMAGE_REJECTED` não carrega
  um código por checagem como o Anexo A assume; esse mapa fixo só se aplica ao caminho
  `MODEL_OUTPUT_INVALID_AFTER_REPAIR`, que já usa os códigos reais do validador.
- F08: campo removido (não recebeu conteúdo próprio) — o conteúdo que existiria já está coberto por
  `planoBDescricaoCompleta` no seletor de plano, duplicar seria pior que remover.
- F10: a rota backend por UUID com proteção de dono já existia desde a V6.5 (A01-A03) — o gap real
  era só o fallback do frontend pro histórico, não a rota (que o documento propõe criar do zero).
- G02: sem trabalho de código — já resolvido como efeito colateral necessário de A03 na Fase 2.
- G04: sem mudança de código — decisão do usuário após divergência real entre o documento e o código
  (regra atual já é uniforme pra todos os timeframes, não incompleta).
- G05: rótulo sobrescrito em `EvidenceManifestBuilder`, não dentro de `MarketZonesService::calculate()`
  como o documento sugere — é `EvidenceManifestBuilder` quem monta o label de cada evidência do
  manifesto, `MarketZonesService` só devolve números.
- H03: modelos antigos apontados pro modelo único vigente (`gemini-3.6-flash`) em vez de removidos/
  esvaziados — mantém o array `models` estruturalmente válido caso o pacote de terceiros (hoje não
  referenciado em `app/`) volte a ser usado.
- H04/H05: `gerarSetup()`/`validarDirecao()` (H04) não têm call site em `app/` — corrigidos mesmo
  assim, por higiene, sem risco (código inalcançável).
- H06: `PIPELINE.md` removido, não substituído — reescrever um pipeline de ~15 passos com precisão é
  além do escopo de higiene desta fase.
- H07: pulado inteiro — única exceção desta fase onde o item foi deixado sem qualquer ação, por
  decisão explícita do usuário diante de uma divergência de alto risco (remoção quebraria
  funcionalidade viva).

---

## Índice de rastreamento rápido (46 itens, por status nesta data)

**Implementados/resolvidos: 45 de 46 — só H07 sem ação nesta rodada.** Fases 1, 2, 3 e 4 completas em
código (ou documentadas como resolvidas/sem-necessidade-de-mudança), provas REAL pendentes onde
aplicável. Documento recebido e plano criado em 03/08/2026; Fase 1 implementada no mesmo dia; Fase 2 e
Fase 3 em 04/08/2026 (autorização explícita: "execute a fase 2" / "execute fase 3"); Fase 4 em
04/08/2026 (autorização explícita: "execute a fase 4"). D02 (Fase 1) e G04 (Fase 4) tiveram conflito
real entre o documento e o código/decisões anteriores do usuário — resolvidos perguntando antes de
decidir por interpretação (D02: gate reativado com tolerância proporcional; G04: código real já uniforme
por timeframe, sem mudança). H07 (Fase 4) teve divergência de alto risco (3 dos 4 arquivos citados como
"resíduo" estão vivos em produção) — único item da spec inteira deixado sem qualquer ação, por decisão
explícita do usuário. Suíte PHPUnit não executada em nenhuma das quatro fases de implementação (decisão
do usuário, banco de dev `genesisteste`); `php -l`/`tsc --noEmit` limpos em todos os arquivos tocados em
todas as fases; Fase 4 também rodou `npm test` (vitest) e conferiu que nenhuma falha nova foi introduzida
(mesma linha de base de 29 falhas pré-existentes, não relacionadas).

**Sessão de geração de prova (04/08/2026, pós-Fase 4, autorização explícita do usuário em duas etapas):**
suíte PHPUnit rodada pela primeira vez em todo o ciclo (autorizado com a condição explícita de nunca dar
refresh no banco — confirmado antes de rodar que nenhum teste usa `RefreshDatabase`/migrations, só
criação+limpeza manual de linhas, mesmo padrão do resto da suíte). **265 testes, 727 assertions, 264
passam.** Encontrado e corrigido 1 bug real nunca antes exercitado:
`DecisionResponseValidatorTest::test_accepts_valid_contract` quebrava ("Only variables should be passed
by reference") por passar o retorno de `valid()` direto pro parâmetro `&$decision` por referência de
A02/A03 — corrigido atribuindo a uma variável antes. 1 falha remanescente, pré-existente e não
relacionada (`RadarNewsPollTest`, feature de notícias do radar). Os 48 testes específicos dos itens da
V6.6 (9 arquivos, Fases 1-4) passam 100%. Depois, autorizada uma análise real ao vivo (gasto de crédito
real aceito): duas chamadas reais completas à API Gemini (`GraphicalAnalysisOrchestrator::analyze()`
chamado diretamente via comando Artisan temporário, mesmo código do controller real, símbolo APTUSDT,
timeframe 1w, conta admin@admin.com id 13, saldo 9160→9120, -40 créditos as duas), usando o gráfico real
fornecido pelo usuário (`grafico de teste.jpeg`, semanal "1S" do TradingView). Resultado determinístico
idêntico nas duas chamadas (seed fixa). Pacote completo de evidências em `provas/v6_6/` (ver
`provas/v6_6/README.txt`) — cobre D01 (normalizador com o rótulo real do gráfico), F07 (versão/
fingerprint V6.6 no boot log real), E01 (executable=true com SEM_BARREIRA_REAL), E04 (rr nulo sobre
alvo projetado), F01 (campos de referência de RR nos dois planos), F02 (acentuação em texto gerado ao
vivo, não fixture), D02 (gate não bloqueou análise legítima), e prova parcial de A02/A03/A05 (lado "sem
figura clara", DP-07). Ainda faltam: A04/A05 (lado "com figura") e B01 (lado "vrvp presente:true") —
o gráfico de teste usado não tinha padrão nem VRVP desenhado claros o suficiente, precisa de outro
gráfico; capturas de tela do frontend (exige subir servidor+navegador); C01-C04 com barreira real
disputando (esta análise caiu 100% em projeção, sem barreira disponível na faixa de preço); A01 (log
bruto do payload enviado), G01/G03 (comparação/volume de análises).

**Bloqueantes (18):** A01, A02, A03, A04, A05, A06, B01, B03, B05, C01, C02, C04, D01, D02, E01, E02,
E03, E04, F01, F02, F06, F10 — conferir contra a Matriz de Aceite do documento (seção 13) antes de
fechar; a lista de "sim" ali é a autoridade, este índice é só leitura rápida. **Todos os 18 bloqueantes
originais têm código aplicado**, incluindo F10 (Fase 4, concluído em 04/08/2026) — prova REAL de cada
um listada na fase correspondente, nenhuma rodada ainda.

**Ordem de autorização:** Fase 1 (Onda 1) → Fase 2 (Onda 2) → Fase 3 (Onda 3) → Fase 4 (Onda 4). Cada
fase exige autorização explícita antes de começar, mesmo com a anterior já fechada.
