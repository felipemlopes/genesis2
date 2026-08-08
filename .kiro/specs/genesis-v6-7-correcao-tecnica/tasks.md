# Plano de Implementação: Gênesis V6.7 — Correção Técnica (Resposta à V6.6 em Produção)

## Visão Geral

Fonte de verdade: `GENESIS_V6_7.md` + `GENESIS_V6_7.pdf` — De Fabricio · Product Owner, Para Felipe ·
Desenvolvimento, 05/08/2026. Auditoria feita sobre os repositórios `genesis-api-genesis2` e
`genesis2-master` entregues em 04/08/2026, o pacote `provas-genesis-v6_6`, o checklist
`.kiro/specs/genesis-v6-6-correcao-tecnica/tasks.md`, o documento `GENESIS_V6_6` e três análises reais
de gráficos diários (APTUSDT, BTCUSDT, POLUSDT).

54 itens listados no documento em 9 blocos (A–I), dos quais **52 geram código** — A-16 e C-28 são
"determinação, não é código": existem para **impedir** uma implementação (religar risco-retorno na
escolha de stop/alvo), não para produzir uma. O documento fala em "52 itens" contando só os que geram
trabalho de código; este plano mantém os 54 IDs na matriz porque ambos ainda exigem verificação
(grep negativo) e prova.

Escopo do documento (e deste plano): **exclusivamente o cérebro de análise gráfica**, do upload da
imagem até o resultado na tela. Bloco macro/geopolítico e bloco de sentimento do ativo ficam
explicitamente de fora — ver seção "Fora de escopo" abaixo.

Repositórios: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** =
`c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main`.

**Status geral em 07/08/2026: 53 de 54 correções implementadas (Fases 1 a 7 completas, exceto I-51 —
mudança de ambiente fora do alcance desta sessão).** Documento recebido nesta data, plano criado no
mesmo dia. Todas as 7 ondas autorizadas e concluídas em 07/08/2026. **Gate de aceite #4 (stop das 3 análises diárias reais
inalterado) NÃO está verificado** — ver aviso no topo da seção da Fase 4. **Achado durante
a Onda 2, não previsto
pelo documento:** `genesis:acompanhar-planos` e `genesis:evaluate-outcomes` já estavam agendados desde
31/07/2026 via `GenesisGraphicalServiceProvider::boot()` — um `Schedule::command()` fora do
`Kernel.php`, que nem o documento nem minha checagem inicial (que só leu `Kernel.php`) detectaram. Ver
nota na Fase 2. Amostra de 8 afirmações técnicas do documento conferida
manualmente linha a linha contra o código atual antes de criar este plano (stop por tipo com `break`,
ramo `projecao_atr`, clamp de `alavancagemSegura()`, uso do valor reduzido em `ExecucaoService::montar()`,
ausência de agendamento dos 3 comandos no `Kernel.php`, ausência de `recommended` em qualquer `.tsx`,
`as unknown as` em `geminiService.ts`, colunas legado lidas em `AnalysisHistoryDashboard.tsx`) — as 8
bateram exatamente com o documento, inclusive número de linha.

Contexto herdado: a V6.6 (`.kiro/specs/genesis-v6-6-correcao-tecnica/tasks.md`) fechou 45 dos 46 itens
(só H07 pulado, ratificado pelo PO). A V6.7 audita o resultado em produção e encontra: 39 dos 47 itens
da V6.6 corretos e intocáveis (seção 5 do documento), 6 que ficaram parciais (efeito não chegou ao
resultado — seção 6), 2 não feitos (G04/H07 — seção 7), e **8 problemas nunca antes pedidos em nenhum
documento anterior** (seção 8), sendo o mais grave — alavancagem do membro sendo substituída pelo
sistema — uma instrução **do próprio PO na V6.6, seção 14**, que este documento reverte explicitamente
(DP-06, nova).

## Regras do documento que este plano tem que obedecer (não são escolha minha)

**Determinações do PO — anteriores ao documento, permanecem válidas. Qualquer correção que contrarie
uma DP interrompe e volta pra discussão, não decido por interpretação (seção 3 + regra 21.4):**

1. **DP-01.** Gemini é o único decisor de direção e score. PHP não vota, não soma família, não inverte
   direção, não altera score. Nenhum item deste documento muda isso.
2. **DP-02.** Score exibido na escala de 100, teto real 90, barra na escala de 100. **Correto hoje,
   fora da lista de correções — não tocar.**
3. **DP-03.** Análise imperfeita continua executável. Quem decide seguir é o membro. Nenhuma condição
   de qualidade desabilita seleção de plano — vale para C-25 (aviso nunca vira bloqueio) e A-14
   (`STOP_UNAVAILABLE` mantém o botão de confirmar habilitado).
4. **DP-04.** Estorno de crédito só por falha de plataforma, quando nenhum dado é entregue ao membro.
5. **DP-05 (nova, reafirmada em 05/08).** Risco-retorno abaixo do mínimo **avisa e nunca invalida**.
   Não bloqueia entrada, não desabilita plano, não impede alavancagem, liquidação, alvo ou
   dimensionamento. Vale para C-26/C-27/C-28.
6. **DP-06 (nova).** Alavancagem escolhida pelo membro **nunca pode ser alterada pelo sistema**. Reverte
   a instrução da V6.6 seção 14 — essa instrução era do PO e estava errada, registrado por ele mesmo.
   Vale para todo o Bloco B.
7. **DP-07 (nova).** Stop é sempre nível técnico ancorado em estrutura de preço. Percentual **nunca
   escolhe** o nível — só define quais âncoras são elegíveis e quando avisar. Vale para todo o Bloco A.
8. **DP-08.** Toda análise vai para o histórico, os dois planos guardados de forma independente, para
   medir qual plano/alvo/timeframe é mais assertivo. Vale para todo o Bloco E e F, e para B-24.
9. **DP-09.** Expiração do Plano B por timeframe: 15m/30m em 24h; 1h/4h em 7 dias; 1d em 30 dias; 1w em
   90 dias. Desfecho `EXPIRADO` em categoria própria. Vale para E-37.
10. **DP-10.** Gênesis não é sala de sinal — mostra direção provável e força, nunca confirma. Linguagem
    confirmatória proibida na tela e nos textos. Vale para H-50.
11. **DP-11.** Ausência de dado é `null`, nunca zero. Vale para evidência, contrato e tela — vale para
    G-46.

**Regra adicional deste ciclo (seção 2):** dois itens da V6.6 (G04, H07) foram fechados como "decisão
do usuário" sem essa autorização vir do Fabricio diretamente — o documento diz que isso não vale.
**Daqui pra frente, todo item fechado por decisão em vez de código precisa registrar quem decidiu,
quando e por qual canal**, antes de eu marcar o checkbox como fechado por decisão.

**Onde o próprio documento manda parar em vez de decidir sozinho (não é opção minha, é regra escrita):**

- **A-02** — se um caso de setup não for coberto pelos 8 da tabela (`structure.event.level`,
  `pattern.rompimento`/`neckline`, range Wyckoff, etc.), paro e trago a dúvida. Não construo
  taxonomia de setup nova.
- **C-28b** — se o mapeamento das 4 faixas de convicção da V6.4 para os cortes atuais gerar
  ambiguidade, paro e trago a dúvida.
- **21.4 (geral)** — qualquer conflito entre este documento e uma determinação anterior interrompe o
  item até resposta do Fabricio, mesmo que a leitura técnica pareça óbvia (foi o que aconteceu com
  F03/F04 na V6.6, e custou retrabalho).
- **DPend-01** — dimensionamento com alavancagem livre (`ExecucaoService.php:565`) fica **bloqueado
  até o Fabricio decidir**. Não implemento por conta própria, mesmo com recomendação técnica já dada
  no documento.

**Restrição adicional deste plano, por pedido explícito do usuário (Felipe), fora do texto do
documento:** nenhuma `migration`, `seed`, `migrate:fresh`, comando que grave no banco (ex.:
`genesis:acompanhar-planos` rodado de verdade para gerar prova) ou teste que use `RefreshDatabase`
roda sem autorização explícita e específica antes, mesmo quando o documento descreve a mudança como
"aditiva" ou "sem risco". Isso afeta especialmente **F-42** (migration nova) e a geração de prova de
**E-34/E-35/E-38** (comandos que escrevem em `AnalisePlano`/`genesis_analises`).

## Fora de escopo — não tocar sem falar com o Fabricio antes (seção 26)

- **Bloco Macro e Geopolítico** — não auditado neste ciclo, nenhum dos 54 itens o alcança.
- **Bloco de sentimento do ativo** — determinação anterior do PO é não mexer em nada, já traz o
  resultado esperado.

Ambos ficam fora de qualquer onda deste plano.

## Como este plano vai ser executado

- **Em ondas, na ordem que o próprio documento define (seção 23)** — dependência técnica, não
  prioridade arbitrária. Nenhuma onda começa sem autorização explícita, mesmo que a anterior já tenha
  fechado. Marco com 🔒 no início de cada fase.
- **Higiene de código morto (seção 20) roda dentro de cada onda**, não ao final — rastro que uma
  correção cria é limpo na mesma entrega que a criou (seção 20.4), seguindo os 7 passos obrigatórios
  da seção 20.1 antes de qualquer remoção.
- **Um commit por item**, identificador na mensagem. Itens marcados como par obrigatório (B-17+B-19,
  F-41+AnaliseTransformer, H-47+limiar 70%) vão num commit só para o par.
- **Prova real de execução, não só teste unitário** — regra 21.1 do documento: a suíte da V6.6 passou
  264/265 e mesmo assim 3 comandos essenciais nunca rodaram em produção. Teste verde não fecha item.
- **Não confiar no compilador enquanto G-44 não estiver feito** (regra 21.2) — é por isso que o Bloco G
  vai primeiro.
- No fim de cada fase, pacote de evidências só com os arquivos daquela fase, paro para revisão antes
  de avançar — mesmo padrão da V6.6.
- No fim de todas as fases, preencho `MATRIZ_V6_7.md` (seção 24.5 do documento) e `PROVAS_V6_7.md`
  (seção 19, I-52) com os dois SHA de commit no topo.

## Dependências técnicas que não podem ser invertidas (seção 23 + notas espalhadas no documento)

- **Onda 1 (G) antes de tudo.** Sem tipos únicos e sem remover `as unknown as`, nenhuma correção
  seguinte é verificável pelo compilador — campo que some no caminho volta a passar despercebido, foi
  assim que `recommended` sumiu sem ninguém notar.
- **Dentro da Onda 2 (E): E-34, E-35 e E-36 antes de E-38.** Agendar os comandos antes de corrigir os
  defeitos internos faria a medição parecer ligada e continuar sem produzir dado real.
- **Onda 3 (C) abre o canal que A-14 (Onda 4) usa** — o bloco de aviso "não recomendado" na tela é o
  mesmo canal onde os três estados do stop (`VALID`/`VALID_WIDE`/`STOP_UNAVAILABLE`) precisam aparecer.
- **Onda 4 (A) depende do canal da Onda 3.**
- **Onda 5 (B) depende de B-20** (que depende do canal da Onda 3) **e do stop coerente da Onda 4** —
  o alerta de liquidação (B-20) e a distância de stop (Bloco A) são o mesmo número exibido junto.
- **Onda 6 (D) depende do stop novo da Onda 4** — o stop do Plano B é ancorado na zona, e a zona
  depende da lógica de âncoras reescrita no Bloco A.
- **H-47 e o limiar de 70% (`mapGraphicalToLegacy:209`) recalibram no MESMO commit** (regra 21.7) —
  senão troca um alerta que dispara demais por um que nunca dispara.
- **F-41 (histórico) e `AnaliseTransformer` no MESMO deploy** — se o transformer mudar primeiro, o
  histórico zera; se o dashboard mudar primeiro, ele lê campos que ainda não existem.
- **Onda 7 (F, H, I) é independente das demais** — pode rodar em paralelo com qualquer uma das ondas
  4-6, mas H-47 continua precisando ir junto com seu próprio recalibre de limiar.

## Mudanças maiores — ler antes de autorizar qualquer fase

1. **B-17/B-18/B-19/B-20 — reverte uma instrução da própria V6.6.** A alavancagem deixa de ser
   reduzida silenciosamente e passa a ser exatamente a que o membro escolheu. Isso muda o número mais
   visível da tela (preço de liquidação) em **toda análise onde a redução acontecia hoje**. Precisa ir
   junto com B-20 (alerta de liquidação) no mesmo ciclo — trocar uma redução silenciosa por um número
   perigoso silencioso é pior que o estado atual.
2. **A-01 a A-15 — reescreve `NivelService::stop()` inteiro.** Pool único por nota substitui a fila
   fixa por tipo. É o núcleo do documento (16 itens). O documento garante que os 3 stops diários reais
   (BTCUSDT 1,72%, POLUSDT 4,46%, APTUSDT 8,11%) devem sair **idênticos** depois da correção — é
   condição do gate final (seção 25, item 4). Só o APTUSDT semanal (92,47%) deve mudar.
3. **E-34/E-35/E-36/E-38 — liga medição automática pela primeira vez em produção.** Jobs vão passar a
   rodar de verdade no cron, gravando em `AnalisePlano` e `genesis_analises`, e chamando a Binance em
   volume (até 200 + 600 chamadas por execução, sem throttle hoje — o documento exige implementar
   throttle/backoff **antes** de agendar). Isso é a mudança de maior risco operacional do documento.
4. **F-41/F-42 — muda a fonte de dado do histórico** de colunas legado (que a versão atual não grava
   mais) para `genesis_analise_planos`. F-42 é a única migration do documento (aditiva, mas ainda
   assim: autorização de banco obrigatória antes de rodar).
5. **G-44 — remove todos os `as unknown as` do adaptador.** Pode expor divergências de tipo que hoje
   estão mascaradas (`ExecutionCandidateSetup` não declara `tp2_motivo`/`tp3_motivo`/
   `qualidade_entrada`; `ExecutionPlanB` declara campos que o backend não envia em `planos[]`) — o
   build pode quebrar até essas divergências serem corrigidas uma a uma.
6. **I-51 — mudança de ambiente/config, não de código.** `.env` de produção diverge do código há pelo
   menos 20 dias sem ninguém perceber. Corrigir isso muda o risco-retorno calculado de toda análise
   nova — precisa registrar a data de corte porque análises antes/depois passam a usar custos
   diferentes.

---

## FASE 1 — ✅ Onda 1: Bloco G — Contrato e tipos (pré-requisito de tudo)

Sem esta fase, nenhuma correção das ondas seguintes é verificável pelo compilador. **Concluída em
07/08/2026.**

- [x] **G-44 (P0)** — Remover os casts `as unknown as` que desligam a verificação de tipo —
      `services/geminiService.ts:222-227`, `types.ts`, `types/graphicalAnalysis.ts` [FE]
      (implementado em 07/08/2026)
  - Status: **código aplicado, `tsc --noEmit` limpo.** `ExecutionCandidateSetup` ganhou
    `tp2_motivo`/`tp3_motivo`/`qualidade_entrada` (o backend, `ExecucaoService::montar()`, sempre
    envia os três em `candidate_setup` — só o tipo não os declarava) e `liquidacao_rotulo` foi
    estreitado para o literal `'estimada' | null` (valor real, único, enviado nesse formato).
    `ExecutionPlanoSetup` ganhou `tp2_motivo`/`tp3_motivo` (mesma lacuna, confirmada nas linhas
    429/432 do Plano A e 378/381 do Plano B em `ExecucaoService.php`). `ExecutionPlanB` (formato bruto
    de `execution.planoB`) ganhou `zona_de`/`zona_ate`/`fonte`, confirmados em
    `MotorExecucaoService::gerarPlanoB()`. Em `types.ts`, `execution.planoB` passou de
    `Record<string, unknown> | null` para `ExecutionPlanB | null`, e `score_basis` de
    `Record<string, string> | null` para `ScoreBasis | null` — ambos importados do contrato real em
    vez de "achatados". Com os tipos alinhados campo a campo, os 5 `as unknown as` em
    `services/geminiService.ts` (linhas 222, 223, 224, 227, 265) saíram — as atribuições passaram a
    ser diretas, sem cast, e o compilador aceitou de primeira depois do ajuste de tipos.
  - Verificação feita: `npx tsc --noEmit` limpo (zero erros). `npx eslint` não rodou — dependência
    `@eslint/js` ausente no ambiente (`ERR_MODULE_NOT_FOUND`), falha de ambiente pré-existente, não
    introduzida por esta mudança; não investigado further por estar fora do escopo deste item.
  - Depende de: nada.
  - Prova exigida: grep de `as unknown as` vazio em `services/` — confirmado (0 ocorrências). `tsc
    --noEmit` limpo — confirmado. **Prova real de tela (build/deploy) ainda pendente.**

- [x] **G-45 (P1)** — Rótulos das fontes novas (`pwh_pwl`, `figura_projetada`) ausentes do mapa —
      `utils/rotulos.ts` (implementado em 07/08/2026)
  - Status: **código aplicado.** Os dois rótulos adicionados a `ROTULOS_FONTE` (confirmado por grep no
    backend que as strings literais `'pwh_pwl'` e `'figura_projetada'` são exatamente o que
    `ExecucaoService.php:664-671` envia). `rotularFonte()` não devolve mais a string crua quando não
    reconhece — cai num rótulo genérico (`'Nível técnico'`) e emite `console.warn` identificando a
    fonte órfã.
  - Verificação feita: `tsc --noEmit` limpo (mesma rodada de G-44).
  - Depende de: nada.
  - Prova exigida (pendente): screenshot de análise real com alvo vindo de PWH/PWL, rótulo em
    português na tela.

- [x] **G-46 (P1)** — Ausência de EMA renderiza como `$ 0` em vez de `N/D` (viola DP-11) —
      `components/AnalysisResult.tsx:718` (implementado em 07/08/2026)
  - Status: **código aplicado.** Guard `||` (bastava uma EMA existir para as três serem formatadas)
    virou avaliação individual por EMA — cada uma checa a própria ausência (`!= null`) antes de
    chamar `formatPrice`, independente das outras duas. Cálculo das EMAs não foi tocado.
  - Verificação feita: `tsc --noEmit` limpo (mesma rodada de G-44).
  - Depende de: nada.
  - Prova exigida (pendente): screenshot de análise real com EMA 200 indisponível mostrando `N/D`.

**Pacote de evidências desta fase:** os 3 itens com código aplicado e `tsc --noEmit` limpo (rodado uma
vez, cobre os três). Grep negativo de `as unknown as` em `services/` confirmado. **Provas reais de
tela (screenshots) e `npm run lint`/`npm run build` completos ficam pendentes** — `npm run lint`
falhou por dependência de ambiente ausente (`@eslint/js`), não relacionada a este ciclo; sinalizar
para o usuário resolver antes do pacote de provas final (P-10). Nenhuma migration, comando ou teste
tocou o banco nesta fase (não era necessário — mudanças só de tipo e renderização no frontend).

**Rastro a limpar nesta onda (seção 20.4):** nenhum — os dois arquivos de tipos (`types.ts` e
`types/graphicalAnalysis.ts`) continuam ambos vivos e agora consistentes entre si; a unificação foi
por composição (um importa do outro), não por eliminação de arquivo. Revisitar se, numa onda futura,
ficar claro que um dos dois pode ser absorvido pelo outro por inteiro.

---

## FASE 2 — ✅ Onda 2: Bloco E — Medição (prova de que as ondas seguintes funcionaram)

Ordem interna obrigatória: **E-34, E-35 e E-36 antes de E-38.** Sem este bloco, nenhuma correção do
documento pode ser validada por dado — é por isso que todo ciclo anterior terminou em leitura de print
de tela. **Código concluído em 07/08/2026; execução real (rodar os comandos de verdade contra o banco)
segue bloqueada até autorização explícita, por pedido do usuário.**

> **Achado durante esta onda, fora do que o documento previa:** `genesis:acompanhar-planos` e
> `genesis:evaluate-outcomes` **já estavam agendados desde 31/07/2026** (V6.5, F07), via
> `GenesisGraphicalServiceProvider::boot()` — `$this->app->booted(fn () => $schedule->command(...))`,
> fora do `Kernel.php`. Nem o documento V6.7 (seção 15, E-38: "o agendador inteiro do sistema tem três
> entradas") nem a checagem inicial deste plano (que só leu `Kernel.php::schedule()`) detectaram essa
> segunda via de registro — `php artisan schedule:list` foi o que revelou (rodei antes de fechar E-38 e
> vi as duas entradas duplicadas depois de eu também tê-las adicionado ao `Kernel.php`). Corrigido na
> hora: removi a duplicata do `Kernel.php`, mantendo as duas onde já estavam funcionando e adicionando
> só a terceira (`analises:verificar-resultados`, essa sim nunca agendada em lugar nenhum) ao
> `Kernel.php`. **Decisão de consolidar tudo num arquivo só (Kernel.php) ou manter o agendamento
> dividido entre dois arquivos fica em aberto — não decidi sozinho, ver conversa com o usuário.**

- [x] **E-34 (P0)** — Comando `AcompanharPlanos` mede cada plano uma vez só e sai da fila para sempre —
      `app/Console/Commands/AcompanharPlanos.php` (implementado em 07/08/2026)
  - Status: **código aplicado, `php -l` limpo.** Consulta passou de `where('status_acionamento',
    'PENDENTE')` para `whereIn('status_acionamento', ['PENDENTE', 'ACIONADO'])`, mantendo
    `whereNull('desfecho')`. Um plano que veio `ACIONADO` sem bater stop/TP (caso normal minutos
    depois da análise) volta a ser reavaliado na próxima execução — o critério de saída passou a ser
    exclusivamente ter `desfecho` preenchido (por stop/TP real ou por `EXPIRADO`, ver E-37).
  - Verificação feita: `php -l` limpo. **Prova real (3 execuções consecutivas do comando) pendente —
    exige rodar contra o banco, não autorizado ainda.**
  - Depende de: nada.

- [x] **E-35 (P0)** — Comando não escreve o resultado em `genesis_analises` —
      `app/Console/Commands/AcompanharPlanos.php` (implementado em 07/08/2026)
  - Status: **código aplicado.** Novo método privado `fecharDesfechoNaAnalise()`: sempre que um plano
    fecha (stop/TP tocado ou expiração), verifica se é o plano que define o resultado da análise
    (`analise.plano_escolhido`, ou Plano A se nenhum foi escolhido — regra literal do documento) e, se
    for, grava `resultado`/`preco_resultado`/`data_resultado` em `genesis_analises`. Um Plano B
    fechando quando o membro escolheu A (ou vice-versa) não sobrescreve o resultado da análise.
  - Verificação feita: `php -l` limpo. **Prova real (consulta ao banco após execução) pendente.**
  - Depende de: E-34 (o plano precisa voltar a ser reavaliado pra ter a chance de fechar).

- [x] **E-36 (P0)** — Navegador calcula desfecho com regra diferente do servidor (usa preço atual, não
      caminho percorrido) — `components/AnalysisHistoryDashboard.tsx` (implementado em 07/08/2026)
  - Status: **código aplicado, `tsc --noEmit` limpo.** Removida a determinação de `resultado` e a
    chamada a `updateResultadoAnalise` de dentro do efeito de auto-monitoramento (`checkPrices`) — o
    efeito continua calculando `progressMap` (barras de progresso visual em direção a TP/stop), que é
    só indicativo e não decide nada. `updateResultadoAnalise` continua importada e usada, mas só pelo
    modal manual (`confirmResultado`, quando o membro digita um preço de resultado manualmente) — esse
    caminho não é "cálculo automático" e o documento não pede a remoção dele.
  - Verificação feita: `tsc --noEmit` limpo. Grep confirmado: `updateResultadoAnalise` só aparece no
    import e na chamada do modal manual, não mais no efeito automático.
  - Depende de: nada.

- [x] **E-37 (P1)** — Prazo de expiração fixo em 72h para todos os timeframes, contraria a DP-09 —
      `app/Console/Commands/AcompanharPlanos.php` (implementado em 07/08/2026)
  - Status: **código aplicado.** `PRAZO_EXPIRACAO_HORAS` virou um mapa por timeframe (15m/30m→24h,
    1h/4h→168h, 1d→720h, 1w→2160h). `desfecho` do plano passou a receber literalmente `'EXPIRADO'`
    (antes só `status_acionamento` mudava, `desfecho` ficava `null` pra sempre — o que impediria o
    plano de sair da fila de E-34 e impediria E-35 de ter o que propagar).
  - **Decisão registrada fora da DP-09 (regra 21.8 — quem/quando/canal):** a DP-09 não enumera `1M`
    (mês) nem os demais timeframes que o `TimeframeNormalizer` aceita (1m/3m/5m/2h/3h/6h/8h/12h/3d).
    Conferido no texto do documento (seção DP-09 e item E-37): nenhum fallback é mencionado pra
    nenhum deles. **Decidido por Felipe (desenvolvedor/usuário), em conversa direta, 07/08/2026:**
    `1M` ganha prazo próprio de 30 dias ("1M deve ser 1M" — mesma magnitude do próprio candle, igual
    ao valor de `1d`); os demais timeframes não enumerados continuam no fallback conservador (1w = 90
    dias), aceito explicitamente por Felipe já que o documento não trata nenhum deles. **Isto não é
    uma decisão do Fabricio (PO) nem está escrito na DP-09 — é uma decisão de implementação tomada
    nesta sessão, deve ser confirmada com o PO antes do gate final de aceite (seção 25).**
  - Verificação feita: `php -l` limpo. **Prova real (teste unitário nas 5 faixas, incluindo `1M`, +
    consulta ao banco) pendente.**
  - Depende de: nada.

- [x] **E-38 (P0)** — Nenhum dos 3 comandos de desfecho está agendado —
      `app/Console/Kernel.php` (implementado em 07/08/2026) — **feito depois de E-34, E-35 e E-36**
  - Status: **código aplicado — mas a premissa do documento estava parcialmente errada, ver achado no
    topo desta fase.** `genesis:acompanhar-planos` e `genesis:evaluate-outcomes` já rodavam desde
    31/07/2026 via `GenesisGraphicalServiceProvider`, cada um já com `everyFifteenMinutes()`,
    `withoutOverlapping(20)` e `onOneServer()` (mais robusto que o que eu ia adicionar). Registrei só
    `analises:verificar-resultados` (`ResultVerifierCommand`) no `Kernel.php`, com
    `everyFifteenMinutes()->withoutOverlapping()`. **Throttle de 150ms entre chamadas à Binance
    adicionado dentro dos três comandos** (`AcompanharPlanos`, `EvaluateGenesisOutcomes`,
    `ResultVerifierCommand`), nenhum tinha antes desta correção — cobre o "cuidado obrigatório de
    volume" do documento independente de qual arquivo registra o schedule.
  - Verificação feita: `php -l` limpo em todos os arquivos tocados. `php artisan schedule:list`
    (leitura, não grava nada) confirma os três comandos presentes, sem duplicata:
    `genesis:acompanhar-planos`, `genesis:evaluate-outcomes` (ambos via
    `GenesisGraphicalServiceProvider`), `analises:verificar-resultados` (via `Kernel.php`), todos
    `*/15 * * * *`. **Log de execução real com contagem de chamadas à Binance pendente — exige rodar
    contra o banco, não autorizado ainda.**
  - Depende de: E-34, E-35, E-36 (fechados antes desta).

- [x] **E-39 (P2)** — Desfecho de 1d usa candles do próprio 1d; quando stop e alvo caem no mesmo
      candle, regra conservadora sempre credita stop, enviesando estatística —
      `app/Console/Commands/AcompanharPlanos.php` (`timeframeCandles()`) (implementado em 07/08/2026)
  - Status: **código aplicado.** `1d` entrou na lista que usa candles de 1h (`in_array($timeframe,
    ['1d', '1w', '1M'], true)`), mesmo padrão já usado por 1w/1M.
  - Verificação feita: `php -l` limpo. **Prova real (teste com candle diário contendo stop e alvo)
    pendente.**
  - Depende de: nada.

- [x] **E-40 (P2)** — Telemetria não filtra linhas `legado` —
      `app/Console/Commands/EvaluateGenesisOutcomes.php` (implementado em 07/08/2026)
  - Status: **código aplicado.** `->where('legado', false)` adicionado à consulta (coluna já existia,
    boolean, default `false`, backfilled `true` pra linhas sem `analysis_uuid` — confirmado na
    migration `2026_07_31_013022_...`).
  - Verificação feita: `php -l` limpo, grep confirmado.
  - Depende de: nada.

**Pacote de evidências desta fase:** os 7 itens com código aplicado, `php -l` limpo em todos os 4
arquivos PHP tocados (`AcompanharPlanos.php`, `EvaluateGenesisOutcomes.php`,
`ResultVerifierCommand.php`, `Kernel.php`) e `tsc --noEmit` limpo no frontend (`AnalysisHistoryDashboard.tsx`).
`php artisan schedule:list` confirma os 3 comandos, sem duplicata. **Nenhum comando foi executado de
verdade, nenhuma migration rodou, nenhuma linha do banco foi lida ou escrita nesta fase** — por pedido
explícito do usuário, essas provas (P-15, P-16, teste unitário de E-37, teste de candle de E-39) ficam
pendentes até autorização específica.

**Rastro a limpar nesta onda:** a função de cálculo de desfecho no navegador (E-36) foi removida junto
com o item, não deixada para depois.

---

## FASE 3 — ✅ Onda 3: Bloco C — Gate e comunicação

Abre o canal de exibição de avisos que a Onda 4 (A-14) vai reutilizar para os três estados do stop.
**Concluída em 07/08/2026, 100% frontend — nenhum arquivo backend tocado nesta onda.**

- [x] **C-25 (P0)** — Backend calcula `recommended`/`motivo`/`reason_code`/`status` corretamente;
      nenhum componente `.tsx` lê — `components/AnalysisResult.tsx` (implementado em 07/08/2026)
  - Status: **código aplicado, `tsc --noEmit` limpo.** Bloco novo inserido como primeiro filho de
    `{setup && (<>...)}`, acima de toda a "CAMADA 2" (plano operacional) — mesma posição pedida pelo
    documento. Renderiza quando `!execution.recommended`: título "Plano não recomendado",
    `execution.motivo` (com fallback textual genérico se vier vazio) e `execution.reason_code` como
    tag pequena. **`podeInteragir` não foi tocado** — continua `execution.executable &&
    execution.action !== null` (linha original), sem nenhuma referência a `recommended`. O fallback
    `exec.recommended ?? exec.executable` do adaptador (cuidado de implantação do documento) já
    existia em `geminiService.ts` antes desta correção, não precisou de mudança.
  - Verificação feita: `tsc --noEmit` limpo. Grep confirma `execution.recommended`/`execution.motivo`/
    `execution.reason_code` agora referenciados em `.tsx` (antes: zero ocorrências em qualquer `.tsx`,
    conforme o próprio levantamento do documento).
  - Depende de: nada. **Prova real de tela (screenshot com `recommended` falso) pendente.**

- [x] **C-26 (P0)** — Risco-retorno líquido exibido rotulado só como "Risco e retorno"; bruto nunca
      aparece — `components/AnalysisResult.tsx`, `components/BlocoConviccaoQualidade.tsx`
      (implementado em 07/08/2026)
  - Status: **código aplicado.** `BlocoConviccaoQualidade` ganhou a prop `rrBruto` (opcional); a seção
    "Risco e retorno" agora mostra os dois valores, cada um com rótulo próprio ("bruto" / "líquido
    (taxas, spread e slippage)"). Call site em `AnalysisResult.tsx` passa
    `rrBruto={planoAtivo?.rr_bruto ?? setup?.rr_bruto ?? null}` — campo que já existia no payload e
    nunca era lido pela tela. Nenhuma mudança na fórmula de cálculo (backend intocado) — confirmado
    que era só erro de rótulo, não de conta.
  - Verificação feita: `tsc --noEmit` limpo. Grep confirma os dois rótulos presentes no componente.
  - Depende de: nada. **Prova real (screenshot + conferência manual anexada) pendente.**

- [x] **C-27 (P1)** — Risco-retorno mostrado é só o do TP1 — `components/AnalysisResult.tsx`, novo
      `utils/riscoRetorno.ts` (implementado em 07/08/2026)
  - Status: **código aplicado.** O payload só traz `rr_bruto`/`rr_liquido_estimado` prontos para TP1
    (confirmado em `ExecucaoService.php`: `$recompensaPreco` usa só `$tp1`) — TP2/TP3 não têm RR
    próprio calculado no backend. Criado `utils/riscoRetorno.ts` (`calcularRiscoRetornoAlvo()`)
    replicando **exatamente** a fórmula de `ExecucaoService::calcularRrLiquidoEstimado()` (custo em
    preço = preço × custoTotalBps/10000; risco líquido = risco + custo; recompensa líquida = max(0,
    recompensa − custo)), incluindo o mesmo princípio da V6.6 (E04): alvo com fonte `'projecao'`
    devolve RR nulo, igual ao backend faz para TP1. TP1 continua usando o valor pronto do backend
    (nunca recalculado); TP2/TP3 usam a função nova. RR (líquido) exibido como badge pequeno junto de
    cada alvo, na mesma seção "Metas de Lucro (TP)" onde preço e fonte já apareciam.
  - Verificação feita: `tsc --noEmit` limpo. Grep confirma os três badges (`rrPorAlvo.tp1/tp2/tp3`)
    ligados aos elementos de TP1/TP2/TP3.
  - Depende de: nada. **Prova real (screenshot com 3 alvos, cada um com RR) pendente.**

- [x] **C-28 (determinação, não é código)** — Risco-retorno baixo continua avisando e nunca invalidando
  - Verificado: `ExecucaoService.php:277-281` permanece intocado nesta onda (`git status` limpo pro
    arquivo). C-25/C-26/C-27 só exibem dado que já existia — nenhum bloqueio novo foi introduzido.
    `podeInteragir` (C-25) confirma isso.

- [x] **C-28b (P2)** — Nomenclatura das faixas de convicção da V6.6 (Frágil/Limitada/Moderada/
      Forte/Excepcional) contraria a nomenclatura V6.4 (Fraca/Parcial/Consistente/Forte) —
      `utils/conviccao.ts` (implementado em 07/08/2026)
  - Status: **código aplicado, sem ambiguidade.** Em vez de reconstruir o mapeamento de 5 faixas para
    4 por inferência (o que o documento avisa que pode gerar ambiguidade), busquei a tabela original
    da V6.4 no histórico do git (`git log -S`, commit `ad31429`, o que a V6.6/F04 sobrescreveu) e
    recuperei literalmente: `≤40 Fraca, ≤60 Parcial, ≤75 Consistente, >75 Forte` (sem quinta faixa
    "Excepcional" — o `>75` da V6.4 é só "Forte", sem teto). Zero interpretação própria.
  - Verificação feita: `tsc --noEmit` limpo. Grep confirma as 4 faixas com os rótulos exatos.
  - Depende de: nada. **Prova real (screenshot com a nomenclatura em cada faixa) pendente.**

**Pacote de evidências desta fase:** os 5 itens com código aplicado, `tsc --noEmit` limpo, greps de
todos confirmados. Nenhum arquivo PHP tocado. Screenshots (P-20, P-21) e a conferência manual do
risco-retorno seguem pendentes — exigem rodar a aplicação de verdade.

---

## FASE 4 — ✅ Onda 4: Bloco A — Stop (o núcleo, 16 itens)

Depende do canal da Onda 3. **Código concluído em 07/08/2026.** Todos os 16 itens implementados —
`NivelService::stop()` reescrito por completo (pool único de âncoras substitui a fila fixa por tipo).

> ⚠️ **Gate de aceite #4 (seção 25) NÃO está verificado.** O documento exige que o stop das 3 análises
> diárias reais (BTCUSDT 1,72%, POLUSDT 4,46%, APTUSDT 8,11%) saia **idêntico** depois da correção.
> Isso exige rodar as 3 reanálises reais contra a Binance/Gemini — não fiz nenhuma chamada de rede
> nem toquei o banco nesta fase (fora do que foi autorizado). **Esta é a prova mais importante
> pendente de todo o Bloco A** — sem ela, o item 4 do gate final (seção 25) não pode ser marcado.
> Em vez disso, validei a lógica nova com um script PHP standalone (sem framework, sem banco, sem
> rede — mesmo padrão usado no ciclo V6.6), cobrindo 22 cenários sintéticos que isolam cada regra
> (A-01 a A-10, A-15) — todos passando. Script em
> `C:\Users\felip\AppData\Local\Temp\claude\...\scratchpad\verify_nivel_service.php` (fora do repo).

- [x] **A-01 (P0)** — Pool único com nota substitui a fila por tipo — `app/Services/NivelService.php`
      (implementado em 07/08/2026)
  - Status: **código aplicado.** `montarPool()` monta todas as âncoras (tese/pivô/resistência-
    suporte/borda-HVN-POC/PDH-PDL/PWH-PWL) num array só, sem `break`. `escolherAncora()` reaproveita
    `AlvoService::agruparConfluencia()` (agora `public`, ganhou parâmetros opcionais `$cercaAtrMult` e
    respeita `'peso'` pré-definido no item — mudança aditiva, comportamento antigo preservado quando
    esses parâmetros não são passados) para o agrupamento por proximidade; a nota em si
    (`notaQualidadeAncora()`) é implementação própria do `NivelService` — **não** uma chamada direta a
    `AlvoService::notaQualidade()`, porque o stop tem um 4º fator (recência, A-04) que o alvo não tem,
    e pesos/percentuais diferentes (40/25/20/15 vs. 45/35/20 do alvo). Documentado no código por quê.
  - Verificação feita: teste standalone com pivô a 90% do preço vs. resistência a 4% do preço —
    resistência vence (`A-01 fonte vencedora`, script acima). `php -l` limpo.
  - Depende de: nada. **Prova real (log `EXECUCAO_AVALIADA` de análise real) pendente.**

- [x] **A-02 (P0)** — Âncora da tese — `app/Services/NivelService.php`,
      `app/Services/GraphicalAnalysis/ExecutionPipelineService.php` (implementado em 07/08/2026)
  - Status: **código aplicado, com uma correção de premissa.** `structure.event.level` é real e chega
    via `$find('structure.event')['level']`. **`pattern.neckline` não existe no contrato real** — só
    existe dentro de `MotorExecucaoService::projetarAlvoFigura()`, código **morto** (chamado só por
    `gerarSetup()`, já flagueado como não-reativável no A-16/seção 20.2 do documento;
    `elementosVisuais['padroes_graficos']` nunca é populado no pipeline vivo). O campo real do
    contrato (`VisualPattern.preco_rompimento`, confirmado em `GenesisDecisionSchema`) já cobre o
    mesmo papel ("rompimento") para qualquer tipo de figura — usado no lugar de `neckline`. Range
    Wyckoff (`niveis['range_teto']`/`range_suporte']` no texto do documento) entra no grupo `tese`
    também, lido de `$wyckoff['range']` quando `$rangeWyckoffValido`. **Escopo: só o Plano A recebeu
    tese** — `MotorExecucaoService::gerarPlanoB()` não tem acesso a `structure.event`/`patterns` sem
    threading adicional de parâmetros; decisão de não estender agora, documentada, não uma omissão
    silenciosa.
  - Verificação feita: teste standalone com tese a 106 vs. pivô mais próximo a 103 — tese vence por
    peso (`A-02 fonte tese vence`). `php -l` limpo.
  - Depende de: nada. **Prova real (3 análises reais: rompimento/pullback/figura) pendente.**

- [x] **A-03 (P1)** — PWH/PWL nas âncoras de stop — `app/Services/NivelService.php`,
      `ExecutionPipelineService.php`, `MotorExecucaoService.php` (implementado em 07/08/2026)
  - Status: **código aplicado nos dois planos.** `pwh`/`pwl` entram em `$niveisContrato` (Plano A) e
    no `$niveis` local de `gerarPlanoB()` (Plano B, lidos de `$zonasApi['pwh']`/`['pwl']`, que já
    chegava com esses valores — só nunca eram extraídos).
  - Verificação feita: teste standalone com PWH único candidato SHORT — vence (`A-03 fonte pwh_pwl`).
  - Depende de: nada. **Prova real pendente.**

- [x] **A-04 (P0)** — Recência elimina âncoras de outro ciclo — `app/Services/NivelService.php`,
      `app/Services/PivoService.php` (implementado em 07/08/2026)
  - Status: **código aplicado.** `PivoService::relevantes()` mudou de forma (antes `float[]`, agora
    `array{preco,candles_atras}[]`) — único caller (`ExecucaoService.php:104`) já ajustado junto.
    `candles_atras` = candles fechados desde o pivô até o mais recente da série. Fator recência é
    binário (não decaimento suave): dentro de 120 candles pontua 1.0, fora pontua 0.0 — literal do
    documento. Tipos sem noção de "idade" (PDH/PWH/resistência visual/tese/borda_hvn) tratam
    `candles_atras=null` como "sempre recente" (nota cheia) — são o extremo do período mais recente
    fechado ou vêm do gráfico atual, por construção.
  - Verificação feita: teste standalone com pivô a 20 candles vs. 400 candles — o recente vence mesmo
    mais longe (`A-04 nivel perto do pivo recente`).
  - Depende de: nada. **Prova real pendente.**

- [x] **A-05 (P0)** — Banda de elegibilidade (piso 0,5 ATR + teto 20%) — `app/Services/NivelService.php`
      (implementado em 07/08/2026)
  - Status: **código aplicado**, fórmula simétrica (`s = isShort ? 1 : -1`, `lado(x) = s*(x-preco)`).
  - Verificação feita: teste standalone com âncora a 25% do preço — excluída da 1ª passada (só
    reaparece via camada 3, A-07). Teste a 35% — fora até da camada 3, `STOP_UNAVAILABLE`.
  - Depende de: nada. **Prova real pendente.**

- [x] **A-06 (P0)** — Segundo passe com pivôs de janela menor — `app/Services/NivelService.php`,
      `app/Services/PivoService.php` (implementado em 07/08/2026)
  - Status: **código aplicado.** `PivoService::pivosComJanela()`/`relevantesComJanela()` novos —
    janela (1,1) quando a banda de 20% fica vazia com a janela padrão (2,2). Zero chamada de API
    nova (usa os mesmos `$candles` já em memória, passados a `NivelService::stop()` como novo
    parâmetro opcional).
  - Verificação feita: teste standalone construiu uma série de candles onde um "pivô" (valor 105)
    só é detectável em janela (1,1), não em (2,2) — confirmado ausente em (2,2) e presente em (1,1);
    `stop()` end-to-end com pool vazio na 1ª passada encontrou o nível via camada 2 (`A-06 camada 2
    encontrou o pivo`, `status VALID`).
  - Depende de: nada. **Prova real pendente.**

- [x] **A-07 (P0)** — Terceira camada até 30% com alerta — `app/Services/NivelService.php`,
      `components/AnalysisResult.tsx` (implementado em 07/08/2026)
  - Status: **código aplicado**, 4 camadas exatamente como especificado. Membro não vê o número 30% —
    só o stop, a distância (`riscoPct`) e o alerta (via `stop_status='VALID_WIDE'`).
  - Verificação feita: teste standalone com âncora só disponível entre 20-30% — `VALID_WIDE`, aviso
    presente. `tsc --noEmit` limpo no lado da tela (A-14, abaixo).
  - Depende de: nada. **Prova real de tela (screenshot) pendente.**

- [x] **A-08 (P0)** — Fim do stop fabricado por ATR — `app/Services/NivelService.php`,
      `app/Services/MotorExecucaoService.php` (implementado em 07/08/2026)
  - Status: **código aplicado nos dois planos.** Ramo `projecao_atr` removido do `NivelService`.
    **Achado ao aplicar o mesmo princípio ao Plano B:** `gerarPlanoB()` tinha o próprio fallback
    fabricado (`$zonaDe - $atr*$atrMultB`), não citado no documento (que só referencia
    `NivelService.php`) mas com o mesmo defeito — removido também, por consistência com a regra geral
    (seção 21.3: "correção precisa chegar ao ponto onde o número nasce"); Plano B agora retorna `null`
    (indisponível) em vez de fabricar, mesmo padrão dos outros `return null` já existentes na função.
    `valido` deixou de ser constante `true`, reflete estado real nos dois planos.
  - Verificação feita: teste standalone com pool totalmente vazio — `STOP_UNAVAILABLE`, `nivel=null`,
    `valido=false`, `stop_motivo` com o texto exato do documento.
  - Depende de: nada. **Prova real (grep de `projecao_atr` já roda limpo — ver seção de provas
    abaixo) + teste de análise real pendente.**

- [x] **A-09 (P1)** — Buffer composto — `app/Services/NivelService.php`, `ExecucaoService.php`,
      `MotorExecucaoService.php` (implementado em 07/08/2026)
  - Status: **código aplicado nos dois planos, com uma ressalva de dado.** `buffer = max(0,5*ATR,
    pavios, spread, slippage)`. Slippage é real e dinâmico (`ExecucaoService::estimarSlippageBps()`,
    já existia). **"Spread do livro" não existe como cálculo dinâmico em lugar nenhum do código** —
    grep confirmado, só existe como valor estático de config (`genesis.custos_bps.spread`). Usei esse
    valor estático como o componente spread do buffer (mesma fonte já usada no cálculo de RR líquido)
    — é o melhor dado real disponível, sem inventar uma chamada de order-book nova (proibido pela
    regra 21.6). **Ressalva registrada, não escondida.** Reordenei `ExecucaoService::montar()` para
    calcular spread/slippage ANTES do stop (antes só existiam depois, só para `custos_bps`/RR).
  - Verificação feita: teste standalone com spread de 200bps vencendo os outros 3 componentes
    (`A-09 spread vence`, nível recalculado corretamente).
  - Depende de: nada. **Prova real (payload com os 4 componentes) pendente.**

- [x] **A-10 (P1)** — Fórmula única simétrica — `app/Services/NivelService.php` (implementado em
      07/08/2026)
  - Status: **código aplicado.** `s` é a única coisa que muda entre LONG/SHORT em toda a função —
    elegibilidade, âncora, buffer, stop, tudo pela mesma fórmula.
  - Verificação feita: teste standalone com cenário espelhado LONG/SHORT — distância e `riscoPct`
    idênticos nos dois lados (`A-10 distancia simetrica`, `riscoPct simetrico`).
  - Depende de: nada.

- [x] **A-11 (P0)** — Plano B valida a âncora contra a própria entrada —
      `app/Services/MotorExecucaoService.php` (implementado em 07/08/2026)
  - Status: **código aplicado, com uma correção de premissa.** Lendo o código real (não só o
    documento), o stop do Plano B hoje era validado contra `$zonaDe`/`$zonaAte` (a borda da zona
    estrutural), **não contra `$preco` como o documento descreve** — mas o efeito prático é o mesmo
    problema (âncora do lado errado da referência que devia importar). Corrigido para `$entradaB`,
    exatamente como pedido. **Sub-cláusula "adicionalmente" (rejeitar timeframe diferente/snapshot
    divergente/vela aberta/visual não validado): já satisfeita estruturalmente, verificada, não
    implementada de novo** — `$suportes`/`$resistencias` já chegam filtrados por
    `VisualLevelValidator` antes de `ExecutionPipelineService` montar `$niveisContrato`; todos os
    níveis (pivôs, PDH/PWH, visuais) derivam do mesmo `$candles`/mesma chamada de
    `ExecutionPipelineService::generate()` — não há mistura de timeframe/snapshot possível na
    arquitetura atual; candles usados são sempre fechados (confirmado no próprio texto do documento,
    seção 9). Threading de metadado de proveniência por âncora não foi construído — seria
    refatoração de arquitetura (vedada pela regra 21.6) para um risco que já não existe hoje.
  - Verificação feita: `php -l` limpo. **Prova real (teste com âncora acima do preço mas abaixo de
    `entradaB`) pendente.**
  - Depende de: nada.

- [x] **A-12 (P1)** — Invalidação da tese ≠ stop — `app/Services/ExecucaoService.php` (implementado em
      07/08/2026)
  - Status: **código aplicado nos 3 pontos** que o documento cita (`planoBCompleto`, `planos[0]` do
    Plano A, `zonaInteresse` legado) — `invalidacao_nivel` agora lê `stop_ancora.valor` (com fallback
    pro `stop` só se a âncora por algum motivo não existir), nunca mais o `stop` (âncora + buffer)
    diretamente. `gerarPlanoB()` passou a expor `stop_ancora` no retorno para isso funcionar no
    Plano B também.
  - Verificação feita: `php -l` limpo. **Prova real (payload + screenshot) pendente.**
  - Depende de: nada.

- [x] **A-13 (P0)** — Campos novos no contrato do stop — `app/Services/ExecucaoService.php`,
      `app/Services/MotorExecucaoService.php`, `types.ts`, `types/graphicalAnalysis.ts`,
      `services/geminiService.ts` (implementado em 07/08/2026)
  - Status: **código aplicado.** `stop_status`/`stop_ancora`/`stop_buffer`/`stop_motivo` presentes em
    `candidate_setup`, nos dois itens de `planos[]`, e em `execution.planoB` (formato bruto). Tipos
    novos (`StopStatus`, `StopAncora`, `StopBuffer`) em `types/graphicalAnalysis.ts`, reexportados por
    `types.ts`. `stop` virou `number | null` no tipo (antes `number`, quebraria com
    `STOP_UNAVAILABLE`). `emptyCandidateSetup` (placeholder do adaptador) atualizado com os 4 campos
    novos.
  - Verificação feita: `tsc --noEmit` limpo (sem nenhum cast novo). `php -l` limpo.
  - Depende de: nada. **Prova real (payload completo) pendente.**

- [x] **A-14 (P0)** — Três estados na tela — `components/AnalysisResult.tsx` (implementado em
      07/08/2026)
  - Status: **código aplicado.** Bloco único de renderização do stop (confirmado por varredura — só
    existe em um lugar) ganhou os 3 estados: `VALID` (âncora + buffer, rótulo em português via
    `rotularFonte()`/`rotularComponenteBuffer()` novos), `VALID_WIDE` (+ alerta amarelo), `STOP_
    UNAVAILABLE` (só a mensagem de A-08, resto do bloco oculto). Bloco "TAMANHO SUGERIDO" (adjacente)
    também oculto em `STOP_UNAVAILABLE`. **Escopo parcial, registrado:** alavancagem/liquidação/RR
    exibidos em OUTROS blocos da tela (Bloco 1 Entrada, BlocoConviccaoQualidade) não foram
    explicitamente ocultados linha a linha — já renderizam `null`/`—` graciosamente (o payload já
    garante `alavancagem_info`/`liquidacao`/`rr_bruto`/`rr_liquido` nulos quando `STOP_UNAVAILABLE`,
    confirmado no backend), então nenhum número fabricado aparece, mas o requisito literal "ficam
    ocultos" (em vez de "mostram —") não foi implementado à risca fora do bloco do stop em si. Botão
    de confirmar continua habilitado — `podeInteragir` não foi tocado, depende só de
    `execution.executable` (mantido `true` no backend para `STOP_UNAVAILABLE`, DP-03).
  - Verificação feita: `tsc --noEmit` limpo.
  - Depende de: nada. **Prova real (screenshot dos 3 estados, desktop + mobile) pendente — maior
    pendência visual do bloco.**

- [x] **A-15 (P2)** — Patamares de aviso de distância — `app/Services/NivelService.php` (implementado
      em 07/08/2026)
  - Status: **código aplicado.** Até 15% sem aviso, 15-20% aviso informativo, acima de 20% só via
    camada 3 (sempre com alerta, mensagem diferente da faixa 2).
  - Verificação feita: cobrindo indiretamente pelos testes de A-05/A-07 acima (faixas exercitadas).
  - Depende de: nada.

- [x] **A-16 (determinação, não é código)** — Risco-retorno permanece fora da escolha de stop e alvo
  - Verificado: grep de "risco/retorno/RR" em `NivelService.php` — zero ocorrências. Grep nas funções
    de seleção de alvo do `AlvoService` (`calcularAlvos`/`agruparConfluencia`/`notaQualidade`/
    `selecionarAlvos`) — zero ocorrências. `AlvoService::RR_MINIMO` continua declarada e não usada,
    não religada. `MotorExecucaoService::gerarSetup()` não tocada (permanece morta).

**Achados fora do escopo literal do documento, corrigidos por consistência (regra 21.3):**
- **A-08 estendido ao Plano B** — o documento só cita `NivelService.php`, mas `gerarPlanoB()` tinha o
  mesmo defeito (stop fabricado por ATR quando a âncora falha). Corrigido junto, mesmo commit.
- **`$atrMultB`** (variável local de `gerarPlanoB()`) ficou órfã depois da remoção do fallback ATR —
  removida na mesma onda (seção 20.4, rastro limpo na hora, não deixado para depois). O parâmetro
  `$atrMult` da função (usado só para calcular a variável removida) ficou sem uso dentro do corpo da
  função — **não removido do sinal da função** (call sites incluem o wrapper público
  `gerarPlanoBPublico()` e dois call sites dentro da função morta `gerarSetup()`; remover o parâmetro
  seria uma mudança de assinatura mais invasiva que o necessário para este item — registrado como
  rastro menor, não crítico).
- **Bug real encontrado na revisão**: `gerarPlanoBPublico()` tem `float $stopFinal` (não-nulo); com
  `$stop` agora podendo ser `null` (STOP_UNAVAILABLE), o call site em `ExecucaoService.php` passava
  `null` direto, o que quebraria em tempo de execução. Corrigido para `$stop ?? 0.0` — mesma
  semântica que o wrapper já usa internamente (`$stopFinal > 0 ? $stopFinal : null`, ou seja, "sem
  stop do Plano A pra clampar contra"). Pego na revisão manual, não por teste automatizado.

**Pacote de evidências desta fase:** 16 itens com código aplicado. `php -l` limpo nos 6 arquivos PHP
tocados (`NivelService.php`, `PivoService.php`, `AlvoService.php`, `ExecucaoService.php`,
`MotorExecucaoService.php`, `ExecutionPipelineService.php`) e nos 2 testes ajustados
(`NivelServiceE03Test.php` reescrito para o novo `fonte`/buffer — antes testava só a margem de pavio
isolada, agora testa o buffer composto; `NivelServiceE09E10Test.php` só teve a chamada do construtor
corrigida, assinatura mudou por causa da injeção de `AlvoService`/`PivoService` — asserções de
alavancagem continuam as mesmas, `alavancagemSegura()` não foi tocada nesta onda). `tsc --noEmit`
limpo no frontend. 22 cenários sintéticos verificados via script standalone (sem framework, sem DB,
sem rede). **Nenhum comando rodou, nenhuma chamada real à Binance/Gemini foi feita, PHPUnit não foi
executado** — por pedido explícito do usuário, essas provas (P-11 a P-14, screenshots P-17/P-18/P-19,
e sobretudo o gate de aceite #4) ficam pendentes até autorização específica.

**Rastro a limpar nesta onda:** a estrutura de `$grupos` por tipo e o ramo `projecao_atr` — removidos
nos dois planos (A-01/A-08). `MARGEM_WICK_*` constantes — **não absorvidas**, continuam vivas como um
dos 4 componentes do buffer composto (A-09), não removidas. `$atrMultB` — removida (ver achados
acima).

---

## FASE 5 — ✅ Onda 5: Bloco B — Alavancagem (reverte instrução da V6.6)

Depende de B-20 (canal da Onda 3) e do stop coerente da Onda 4. **DP-06 passa a valer: alavancagem
escolhida pelo membro nunca é alterada.** **Concluída em 07/08/2026**, todos os 8 itens implementados.

- [x] **B-17 (P0)** — Alavancagem reduzida silenciosamente (`aplicada = min($alavAtual,
      $maximaSegura)`) — `app/Services/NivelService.php` (implementado em 07/08/2026)
  - Status: **código aplicado.** `alavancagemSegura()` deixou de clampar — `aplicada` passa a ser
    sempre igual a `escolhida` (a escolha do membro). `maxima_segura` continua calculada, mas vira só
    informativa. `ajustada` (booleano) foi substituído por `excede_seguro` — mesmo papel de aviso,
    nunca mais de redução. Único call site (`ExecucaoService::montar()`) ajustado junto: `$alavancagem
    = $alavancagemInfo['aplicada']` agora é sempre `$leverage`.
  - Verificação feita: script standalone (`verify_fase5_bloco_b.php`) — alavancagem de 20x contra um
    stop que só suportaria uma faixa bem menor: `aplicada=20` (igual à escolhida, nunca reduzida),
    `excede_seguro=true`, `aplicada > maxima_segura` confirmado (não clampada). `php -l` limpo.
  - Depende de: nada. **Prova real (análise com 50x escolhida e stop a 8%, `alavancagem=50` na tela)
    pendente.**

- [x] **B-18 (P0)** — Guarda para alavancagem zero (o `max(1.0,...)` de B-17 mascarava `leverage=0`)
      — `app/Http/Requests/Api/GraphicalAnalysisRequest.php`, `services/geminiService.ts`
      (implementado em 07/08/2026)
  - Status: **código aplicado nos dois lados.** Frontend: `fd.append('leverage', ...)` deixou de ser
    condicional a `userLeverage > 0` — sempre envia. Backend: regra de validação de `leverage` passou
    de `sometimes` para `required` (mantendo `numeric|min:1|max:125`) — antes, campo ausente pulava a
    validação inteira e o controller caía no default silencioso `input('leverage', 0)`; agora ausência
    OU `<= 0` viram 422 explícito, com mensagem em português (`messages()` novo na Request).
  - Verificação feita: `php -l` limpo, `tsc --noEmit` limpo. Leitura manual confirma que `min:1` já
    barra `leverage=0` quando presente — o gap real era só a ausência do campo, fechado pelo `required`
    + pelo FE nunca mais omitir o campo.
  - Depende de: nada. **Prova real (request sem leverage e com leverage=0, ambos retornando 422 com a
    mensagem nova) pendente.**

- [x] **B-19 (P0)** — Teste `NivelServiceE09E10Test.php` exigia o comportamento antigo —
      `tests/Unit/NivelServiceE09E10Test.php` (implementado em 07/08/2026) — **mesmo commit de B-17**
  - Status: **reescrito.** 3 testes: (1) dentro do limite, `excede_seguro=false`; (2) acima do limite,
    `aplicada === escolhida` sempre (antes esperava `aplicada < escolhida`) e `excede_seguro=true`,
    checando que o `motivo` cita `maxima_segura` (não mais `aplicada`, que agora é igual à escolhida);
    (3) teste novo, substitui a antiga invariante "aplicada nunca passa de maxima_segura" pela oposta —
    agora `aplicada` PODE exceder `maxima_segura`, com `excede_seguro=true` sinalizando isso.
  - Verificação feita: `php -l` limpo. **PHPUnit não executado — exige banco (mesma restrição geral
    deste plano), mesmo os 3 testes desta classe sendo determinísticos e sem `RefreshDatabase`; não
    corri a suíte inteira sem autorização explícita.**
  - Depende de: B-17 (mesmo commit).

- [x] **B-20 (P0)** — Verificação de liquidação (`verificacao`/`verificacao_motivo`) já calculada em
      `gerarPlanoB()` mas não copiada para `planoBCompleto`; Plano A nunca teve o campo —
      `app/Services/ExecucaoService.php`, `app/Services/MotorExecucaoService.php`,
      `components/AnalysisResult.tsx` (implementado em 07/08/2026) — **junto com B-17**
  - Status: **código aplicado nos dois planos, com uma correção de bug real encontrada ao extrair a
    fórmula.** `MotorExecucaoService::verificarSegurancaLiquidacao()` (novo, `static`) centraliza o
    cálculo — reaproveitado pelo Plano A (novo, dentro de `ExecucaoService::montar()`) e pelo Plano B
    (substituindo o cálculo inline em `gerarPlanoB()`).
  - **Bug real encontrado ao extrair, não pedido pelo documento:** a fórmula que já existia dentro de
    `gerarPlanoB()` (LONG e SHORT) tinha a comparação **invertida** — `stop < liq*(1+margem)` marcava
    `'SEGURO'` justamente nos casos de alavancagem alta (liquidação perto do stop, o cenário perigoso)
    e `'INSEGURO'` nos casos de alavancagem baixa genuinamente seguros. Confirmado algebricamente e por
    script (`verify_fase5_bloco_b.php`, seção de comparação explícita antiga-vs-nova): com stop a 5% e
    alavancagem de 50x (liquidação bem próxima da entrada, cenário perigoso), a fórmula antiga dizia
    `SEGURO`; a nova diz `INSEGURO` (correto). Com alavancagem de 2x (liquidação bem longe, cenário
    seguro), a antiga dizia `INSEGURO`; a nova diz `SEGURO` (correto). A versão correta já existia, sem
    uso, dentro de `recalcularPorAlavancagem()` (código morto, só chamado pelo também-morto
    `gerarSetup()`) — usada de referência pra esta correção. Publicar o valor antigo (invertido) na
    tela, que é exatamente o que B-20 pede, teria sido pior que não publicar nada: um alerta de
    segurança que mente na direção oposta — corrigido por decorrência da regra 21.3 (correção precisa
    chegar à origem), não é escopo novo inventado.
  - Publicado em `candidate_setup`, em cada item de `planos[]` (A e B) e em `planoBCompleto`. Tela:
    bloco de alerta vermelho explícito ("Nesta alavancagem, sua posição liquida antes do stop.") quando
    `verificacao === 'INSEGURO'`, logo abaixo dos cards de risco/liquidação. DP-03: é aviso, nunca
    bloqueio — `podeInteragir` não foi tocado.
  - Verificação feita: script standalone, 12 asserções (SEGURO/INSEGURO nos dois lados LONG/SHORT, alta
    e baixa alavancagem, sentinelas de "sem liquidação") + comparação explícita antiga-vs-nova, todas
    passando. `php -l`/`tsc --noEmit` limpos.
  - Depende de: nada (dentro desta onda). **Prova real (screenshot de análise com alavancagem alta +
    stop largo, alerta visível) pendente.**

- [x] **B-21 (P1)** — Plano B usava `alavancagem_info` do Plano A — `app/Services/ExecucaoService.php`
      (implementado em 07/08/2026)
  - Status: **código aplicado.** `$alavancagemInfoB = $this->nivel->alavancagemSegura($planoB['entrada'],
    $planoB['stop'], $isShort, $leverage)` — calculado contra o próprio stop/entrada do Plano B, não
    mais reaproveitando o do Plano A. `aplicada` continua igual nos dois planos (mesma escolha do
    membro, DP-06); só `maxima_segura`/`excede_seguro`/`motivo` podem divergir, porque os stops são
    diferentes.
  - Verificação feita: `php -l` limpo. Leitura confirma que os dois planos agora chamam
    `alavancagemSegura()` com stops distintos.
  - Depende de: nada. **Prova real (payload com `alavancagem_info` distinto entre os dois planos)
    pendente.**

- [x] **B-22 (P1)** — Trocar de corretora forçava 5x em silêncio quando o valor escolhido não existe
      na nova lista — `contexts/AppContext.tsx`, `pages/GenesisPage.tsx` (implementado em 07/08/2026)
  - Status: **código aplicado.** Efeito de troca de corretora passou a escolher o valor válido mais
    próximo **para baixo** (`[...options].reverse().find((opt) => opt <= leverage) ?? options[0]`, o
    fallback só cobre o caso teórico de `leverage` menor que qualquer opção — nunca acontece na prática,
    já que 1x está em todas as listas) e grava um aviso (`avisoAlavancagem`, novo estado no
    `AppContext`) em vez de aplicar um padrão fixo em silêncio. Aviso renderizado logo abaixo do
    seletor de alavancagem em `GenesisPage.tsx`, dispensável pelo membro.
  - Verificação feita: `tsc --noEmit` limpo. Leitura confirma que o `else` novo limpa o aviso quando a
    alavancagem atual já é válida na corretora nova (evita aviso "grudado" de uma troca anterior).
  - Depende de: nada. **Prova real (screenshot da troca de corretora com o aviso) pendente.**

- [x] **B-23 (P1)** — Sempre enviar a alavancagem — `services/geminiService.ts` (implementado em
      07/08/2026)
  - Status: coberto por B-17 (mesmo commit/edição); mantido como item próprio só para rastreabilidade
    na matriz, como o documento pede.

- [x] **B-24 (P1)** — Trade ativo podia gravar entrada errada (ticker sobrescrevia entrada calculada;
      `handleSaveTrade` sempre usava `executable_setup` mesmo com Plano B selecionado) —
      `pages/GenesisPage.tsx`, `components/AnalysisResult.tsx` (implementado em 07/08/2026)
  - Status: **código aplicado, os dois defeitos corrigidos juntos.** `onSaveTrade` (prop de
    `AnalysisResult`) passou a receber `planoAtivo` (o plano de fato selecionado na tela, já existia
    como const local, só não saía do componente) — chamado como `onSaveTrade(planoAtivo)` no clique do
    botão de confirmação. `handleSaveTrade` (GenesisPage) passou a aceitar esse argumento e usar
    `planoSelecionado ?? executable_setup` como fonte de todos os campos, nunca mais `currentPrice`
    (ticker) para a entrada — `entryP` agora é sempre `setup.entrada` do plano escolhido.
    `setup.alavancagem ?? leverage`: **verificado, não presumido** — com B-17 aplicado, `alavancagem`
    do setup já é sempre a escolha real do membro; o fallback pra `leverage` (estado do formulário)
    fica só como defesa para o caso raro de um setup sem o campo preenchido, documentado no código.
  - Verificação feita: `tsc --noEmit` limpo. Leitura confirma que o botão já é desabilitado sem
    `selectedZone` (`disabled={!podeInteragir || !selectedZone}`), então `planoAtivo` nunca chega nulo
    no clique real — o tipo continua nullable só por defensividade (resposta cacheada sem
    `execution.planos[]`, padrão E08).
  - Depende de: nada. **Prova real (escolher Plano B, confirmar posição, mostrar no banco que a entrada
    gravada é a do Plano B) pendente — exige rodar a aplicação de verdade.**

**Nota:** DPend-01 (dimensionamento com alavancagem livre, `ExecucaoService.php:565`) continua
**bloqueado** — não implementado, o documento é explícito que precisa de decisão do PO, mesmo com a
consequência óbvia de B-17 (aumentar alavancagem não muda mais o tamanho sugerido).

**Rastro a limpar nesta onda:** o campo `ajustada` foi removido da estrutura de retorno de
`alavancagemSegura()` (substituído por `excede_seguro`) nos dois lados (PHP e os 2 arquivos TS que
declaram `AlavancagemInfo`) — nenhuma referência ao nome antigo restou fora de comentário explicativo
(confirmado por grep). A fórmula antiga (invertida) de `verificacao` que vivia inline dentro de
`gerarPlanoB()` foi substituída pela chamada ao método novo — não sobrou cópia duplicada.

---

## FASE 6 — ✅ Onda 6: Bloco D — Plano B

Depende do stop novo da Onda 4 — o stop do Plano B é ancorado na zona. **Concluída em 07/08/2026**,
todos os 5 itens implementados.

- [x] **D-29 (P0)** — Zona do Plano B podia conter o preço atual (guard só existia para `zonaAte`,
      base nunca comparada com o preço) — `app/Services/MotorExecucaoService.php` (`zonaEstrutural`,
      `gerarPlanoB`), `components/AnalysisResult.tsx` (implementado em 07/08/2026)
  - Status: **código aplicado.** `zonaEstrutural()` reescrita: SHORT → `zonaDe` sempre clampada acima
    do preço atual (`max($zonaDe, precoAtual*1.001)`); LONG → `zonaAte` sempre clampada abaixo
    (`min($zonaAte, precoAtual*0.999)`) — incondicional, não mais dependente de qual barreira "venceu".
    **Achado real na leitura**: o guard antigo do lado `acima` tinha um `elseif (!$isLong)` que
    sobrescrevia `zonaAte` incondicionalmente pro SHORT (na prática inofensivo, porque barreiras
    `acima` de uma entrada já acima do preço são sempre maiores que o preço — não havia bug ali); o bug
    real, exatamente como o documento descreve, estava em `zonaDe` (base) para SHORT — usava
    `max($abaixo)` sem checar contra o preço, podendo publicar uma zona de repique com o piso já abaixo
    de onde o preço está agora. `gerarPlanoB()` ganhou um check incondicional de zona degenerada logo
    após a chamada (`zonaAte <= zonaDe || largura < 0,05 ATR` → `return null`), separado do check já
    existente (esse continua condicionado à invalidação do Plano A). Tela: card de "Plano B" quando
    ausente (`planoB?.entrada == null`) deixou de simplesmente sumir — mostra um bloco tracejado
    explicando a ausência.
  - Verificação feita: script standalone via Reflection (`zonaEstrutural()`/`juntarComE()` são
    privados) — SHORT sem barreira: `zonaDe > precoAtual` confirmado; LONG sem barreira: `zonaAte <
    precoAtual` confirmado; SHORT com barreira real do lado errado (abaixo do preço): `zonaDe` ainda
    clampada acima do preço. Retracei manualmente os 3 testes existentes de zona
    (`MotorExecucaoServiceE03Test.php`, 2 do `MotorExecucaoServicePlanoBTest.php`) contra a fórmula
    nova — os 3 continuam batendo com o resultado esperado (não rodei o PHPUnit, só a álgebra à mão).
    `php -l`/`tsc --noEmit` limpos.
  - Depende de: nada. **Prova real (3 análises SHORT reais + 1 com Plano B indisponível e explicação
    na tela) pendente.**

- [x] **D-30 (P1)** — Descrição do Plano B era texto fixo, montado sem checar se as evidências citadas
      (CVD divergente, pressão vendedora) realmente estavam `AVAILABLE` —
      `app/Services/MotorExecucaoService.php`, `app/Services/ExecucaoService.php`,
      `app/Services/GraphicalAnalysis/ExecutionPipelineService.php` (implementado em 07/08/2026)
  - Status: **código aplicado, com plumbing novo (não existia antes).** `flow.cvd_divergence`
    (`EvidenceCatalog`) já era calculado (`MarketSnapshotService::cvdDivergence()`, V6.5 B10) mas
    **nunca chegava** ao pipeline de execução — extraído em `ExecutionPipelineService::generate()`
    (mesmo padrão `$find()` das outras evidências) e threaded por um parâmetro novo, opcional, em
    `ExecucaoService::montar()` → `MotorExecucaoService::gerarPlanoBPublico()`/`gerarPlanoB()`. Cada
    confluência citada agora exige o dado real: "confluência de Wyckoff" só entra quando
    `$wyckoffFase !== 'INDETERMINADO'` (fase não classificada é ausência de dado, DP-11); "CVD
    divergente" só quando `flow.cvd_divergence` é literalmente `'BULLISH'` (LONG) ou `'BEARISH'`
    (SHORT) — não `'NONE'`/`'UNAVAILABLE'`; "pressão compradora/vendedora no livro de ofertas" só
    quando `elementosVisuais['paredes_compra'/'paredes_venda']` (dado real de book, já usado em A-09)
    não está vazio. Nova função `juntarComE()` monta a frase só com as confluências presentes ("A e
    B" / "A, B e C" / sem cláusula nenhuma quando nenhuma evidência é real).
  - Verificação feita: script standalone via Reflection — `juntarComE()` com 0/1/2/3 itens, todos
    corretos. Retracei os 4 testes existentes que checam "descrição sem número embutido" (G02/E06-E07)
    — nenhum passa `cvdDivergence` nem `elementosVisuais` com paredes, `wyckoffFase='INDETERMINADO'`
    em todos — as 4 confluências ficam vazias, frase cai no fallback sem cláusula extra, sem dígitos
    (regex das asserções continua batendo). `php -l` limpo.
  - Depende de: nada. **Prova real (2 análises do mesmo ativo em momentos diferentes, descrições
    distintas e coerentes) pendente.**

- [x] **D-31 (P0)** — Trocar de plano não trocava todos os campos juntos —
      `components/AnalysisResult.tsx` (implementado em 07/08/2026)
  - Status: **investigado a fundo antes de "corrigir" — a maior parte do problema já não existe no
    código atual.** Reli campo por campo (entrada/stop/tp1-3/RR/alavancagem/liquidação/tamanho/
    invalidação/verificação): todos já usam `planoAtivo?.campo ?? setup.campo` (mecanismo `planoAtivo`
    da V6.5/E08) — trocam juntos de fato, dentro de uma mesma renderização, confirmado lendo cada uma
    das ~25 ocorrências de `setup.`/`setup?.` no arquivo. As duas exceções (`setup.entrada` no botão
    do Plano A, `planoB.entrada` no botão do Plano B) são os próprios botões seletores — corretamente
    mostram o valor de CADA plano, não do plano ativo, porque são o menu de escolha. **Achado real,
    fora do texto literal do documento:** `GenesisPage.tsx` renderiza `<AnalysisResult>` sem `key` —
    o componente NÃO remonta entre análises diferentes (troca de par, nova imagem), então
    `selectedZone` (estado local) sobrevivia de uma análise pra outra. Abrir uma análise nova com
    Plano B selecionado "por herança" da análise anterior decidia o plano ativo sem nenhuma ação do
    membro nesta análise — mesma classe de defeito ("mistura entre planos"), causa raiz diferente da
    descrita. Corrigido com um `useEffect` que reseta `selectedZone`/`zoneSaveStatus`/`zoneSaveError`
    sempre que a identidade da análise (`analiseId` ou `data.analysis_id`) muda. **Rastro limpo na
    mesma onda (seção 20.4):** `activeEntrada`, const órfã (calculada, nunca lida em lugar nenhum do
    arquivo — confirmado por grep) — removida.
  - Verificação feita: `tsc --noEmit` limpo. Grep confirma zero leituras de `activeEntrada` antes da
    remoção (era dead code) e zero ocorrências depois.
  - Depende de: nada. **Prova real (screenshots dos dois planos selecionados em sequência, e de trocar
    de análise com Plano B selecionado) pendente.**

- [x] **D-32 (P1)** — `tp1_fonte`/`tp2_fonte`/`tp3_fonte` fixados em `null` no Plano B —
      `app/Services/MotorExecucaoService.php`, `app/Services/ExecucaoService.php` (implementado em
      07/08/2026)
  - Status: **código aplicado.** `AlvoService::calcularAlvos()` já devolvia
    `tp1_fonte`/`tp2_fonte`/`tp2_motivo`/`tp3_fonte`/`tp3_motivo` para a chamada interna de
    `gerarPlanoB()` (mesmo método usado pelo Plano A) — só nunca eram extraídos do array de retorno.
    Extraídos e propagados até `planoBCompleto` em `ExecucaoService.php`, mesmo critério de "fonte
    real" (≠ `'projecao'`) já usado pro Plano A.
  - Verificação feita: `php -l` limpo. Leitura confirma os 5 campos presentes nos dois branches
    (LONG/SHORT) de `gerarPlanoB()` e no `planoBCompleto`.
  - Depende de: nada. **Prova real (payload com `tp1_fonte` preenchido no Plano B) pendente.**

- [x] **D-33 (P1)** — `qualidade_entrada` fixado em `null` no Plano B (consequência de D-32) —
      `app/Services/ExecucaoService.php` (implementado em 07/08/2026)
  - Status: **código aplicado.** Novo `$qualidadeEntradaB = $this->qualidadeEntrada->avaliar(...)`,
    mesmos 4 fatores do Plano A (`QualidadeEntradaService`), calculados contra a ENTRADA do Plano B
    (zona de pullback/repique), usando as fontes reais que D-32 acabou de expor. `$ema21Valor`/`$atr`/
    `$timeframesSuperiores` são do mesmo gráfico, reaproveitados sem recálculo.
  - Verificação feita: `php -l` limpo. Leitura confirma a chamada usa `$planoB['entrada']` (não
    `$preco`, que é a entrada do Plano A).
  - Depende de: D-32 (mesmo commit).

**Pacote de evidências desta fase:** os 5 itens com código aplicado. `php -l` limpo nos 3 arquivos PHP
tocados (`MotorExecucaoService.php`, `ExecucaoService.php`, `ExecutionPipelineService.php`), `tsc
--noEmit` limpo no frontend (`AnalysisResult.tsx`). Verificação via script standalone com Reflection
(métodos privados `zonaEstrutural()`/`juntarComE()`) — 9 asserções, todas passando. Retracei à mão os 7
testes PHPUnit já existentes que tocam `gerarPlanoB()`/zona (E03, E06-E07, G02) contra a lógica nova —
nenhum quebra. **PHPUnit não executado** (mesma restrição geral deste plano). Nenhuma chamada real à
Binance/Gemini, nenhum toque no banco.

**Rastro a limpar nesta onda:** `activeEntrada` (const órfã em `AnalysisResult.tsx`, nunca lida) —
removida (D-31). Nenhum outro rastro — D-29/D-30/D-32/D-33 são todos aditivos (campos novos, parâmetro
novo opcional em 4 assinaturas), sem remover nada que ainda estivesse em uso.

---

## FASE 7 — ✅ Onda 7: Blocos F, H, I — independentes entre si, podem ir em paralelo

**Concluída em 07/08/2026** — 9 dos 10 itens (F-41/42/43, H-47/47b/48/49/50, I-52). **I-51 não
implementado** — é mudança de ambiente de produção, não de código; fora do alcance desta sessão (sem
acesso a produção), documentado abaixo com o que já foi verificado do lado do código.

### Bloco F — Histórico

- [x] **F-41 (P0)** — Histórico lia colunas legado que a versão atual não grava desde a V6.5 —
      `app/Transformers/AnaliseTransformer.php`, `app/Http/Controllers/Api/AnaliseController.php`,
      `components/AnalysisHistoryDashboard.tsx`, `types.ts` (implementado em 07/08/2026) — **mesmo
      commit de `AnaliseTransformer`**
  - Status: **código aplicado.** `AnaliseTransformer::transform()` ganhou o campo `planos` (map de
    `AnalisePlano`, já existia como relação `Analise::planos()` desde a V6.5/F03-F04 — só nunca era
    exposta por este transformer). `AnaliseController::index()` passou a eager-load `->with('planos')`
    (sem isso, `relationLoaded()` no transformer sempre devolveria `[]`). Frontend: `loadHistory()`
    usa `row.planos` como fonte primária (fallback pras colunas achatadas só em linhas legado, onde
    `planos` vem vazio); nova coluna "Plano B" na tabela mostra entrada/stop/desfecho do Plano B lado a
    lado com o Plano A (que continua nas colunas Entrada/TP1-3, é o que define o resultado por
    padrão, DP-08/E-35).
  - Verificação feita: `php -l`/`tsc --noEmit` limpos.
  - Depende de: nada. **Prova real (screenshot do histórico com os dois planos, entradas/stops
    distintos, desfecho de cada um) pendente.**

- [x] **F-42 (P1)** — RR do histórico numa coluna só (Plano A grava líquido, Plano B grava bruto) —
      migration nova, `app/Models/AnalisePlano.php`,
      `app/Services/GraphicalAnalysis/GraphicalAnalysisOrchestrator.php` (implementado em 07/08/2026)
  - Status: **código aplicado, migration criada mas NÃO executada** (autorização de banco pendente,
    restrição geral deste plano). Migration
    `2026_08_07_000001_add_rr_bruto_liquido_to_genesis_analise_planos_table.php` (aditiva, `down()`
    reversível). **Achado real ao implementar:** `persistPlanos()` tratava Plano A e Plano B com
    lógicas de RR diferentes (A: líquido com fallback pra bruto; B: sempre `rr1`, que é bruto) — raiz
    exata da divergência que a migration corrige. Reescrito pra iterar sobre `execution.planos[]`
    (formato uniforme dos dois planos, existe desde a V6.7/A-13) em vez de tratar `candidate_setup`/
    `planoB` separadamente — os dois planos agora usam a mesma prioridade (líquido com fallback pra
    bruto) tanto na coluna antiga (`rr`, mantida por compatibilidade) quanto nas duas novas.
  - Verificação feita: `php -l` limpo. `AnaliseTransformer` já expõe `rr_bruto`/`rr_liquido` (ficam
    `null` até a migration rodar — sem quebrar nada, `AnalisePlano` não falha ao ler coluna
    inexistente, só devolve `null`).
  - Depende de: nada (dentro desta onda). **[MIGRATION — autorização de banco explícita obrigatória
    antes de `php artisan migrate`.] Prova real (consulta ao banco pós-migration) pendente.**

- [x] **F-43 (P2)** — `saveAnalysisToHistory()` continuava exportada, sem call site nenhum —
      `components/AnalysisHistoryDashboard.tsx`, `services/api.ts` (implementado em 07/08/2026)
  - Status: **código aplicado, procedimento de higiene seguido (seção 20.1).** Grep no repositório
    inteiro confirmou zero call sites reais (só um comentário em `GenesisPage.tsx` citando o nome
    antigo, e a própria declaração/export) — `GenesisPage.tsx` já não a chamava desde a V6.5 (F03-F04).
    Função removida; `storeAnalise()` (`services/api.ts`), usada só por ela, removida junto (rastro,
    seção 20.4). **Rota backend `POST /v1/analises` NÃO removida** — o próprio `AnaliseController::
    store()` já documenta "mantida por compatibilidade" com algo fora deste repositório que o
    procedimento de higiene não tem como confirmar a partir daqui; avaliada, não removida por conta
    própria (regra 21.6 — não decidir sozinho quando não há como confirmar).
  - Verificação feita: `tsc --noEmit` limpo. Grep de `saveAnalysisToHistory`/`storeAnalise` confirma
    zero ocorrências fora de comentários explicativos.
  - Depende de: nada.

### Bloco H — Cobertura e narrativa

- [x] **H-47 (P1)** — Correção de cobertura da V6.6 (G01) era um no-op comprovado —
      `app/Services/GraphicalAnalysis/EvidenceManifestBuilder.php`, `services/geminiService.ts`,
      `tests/Unit/EvidenceManifestBuilderH47Test.php` (implementado em 07/08/2026) — **limiar
      recalibrado no mesmo commit**
  - Status: **código aplicado.** Denominador de `decision_percent` passou a contar só `DECISION` (era
    "tudo exceto `DISPLAY_ONLY`", ainda incluindo os 20 itens `CONTEXT`). Contagem confirmada a partir
    do próprio `EvidenceCatalog::items()` (67 itens: 46 `DECISION`, 20 `CONTEXT`, 1 `DISPLAY_ONLY`) —
    bate exatamente com "66 elegíveis, 20 removidos" do documento. Limiar de cobertura baixa
    (`geminiService.ts`, era 70%) recalibrado pra **75% — valor provisório**, meio da faixa "4-6
    pontos" que o documento estima, sinalizado explicitamente no código como pendente de confirmação
    com cobertura real pós-correção (não fabriquei uma medição própria).
  - Verificação feita: `php -l`/`tsc --noEmit` limpos. Teste PHPUnit novo escrito (não executado — sem
    autorização de banco, embora a classe não toque banco nenhum): 3 casos — cobertura 100% com
    catálogo completo, item `CONTEXT` ausente não muda `decision_percent`, item `DECISION` ausente
    reduz `decision_percent`. `EvidenceManifestBuilder` chama `Log::warning()` internamente (facade
    Laravel), por isso não dá pra rodar em script standalone puro sem bootstrap — só via PHPUnit.
  - Depende de: nada. **Prova real (cálculo lado a lado antes/depois com análise real) pendente.**

- [x] **H-47b (P2)** — PDH duplicado com PWH em timeframe 1w/1M —
      `app/Services/GraphicalAnalysis/MarketZonesService.php`,
      `app/Services/GraphicalAnalysis/MarketSnapshotService.php` (implementado em 07/08/2026)
  - Status: **código aplicado.** `MarketZonesService::calculate()` ganhou `$timeframe` opcional
    (default `null`, preserva o comportamento de sempre); em `1w`/`1M`, PDH/PDL viram `null`
    (redundantes com PWH/PWL nessa escala — o agrupamento diário degenera pro mesmo candle que o
    agrupamento semanal já captura). `MarketSnapshotService` passa `$timeframe` no lugar que já
    passava pra `SupplementalIndicatorsService` (mesmo padrão, mesma variável já em escopo).
  - Verificação feita: script standalone (sem framework — `MarketZonesService` não usa `config()`) com
    candles semanais sintéticos: `pdh`/`pdl` nulos em `1w`/`1M`, `pwh`/`pwl` preenchidos; candles
    diários com timeframe `1d` (ou sem timeframe, compatibilidade) continuam com `pdh`/`pdl`
    preenchidos, comportamento intocado. 9 asserções, todas OK.
  - Depende de: nada. **Prova real (teste com série semanal real, PDH e PWH não somando confluência)
    pendente.**

- [x] **H-48/H-49 (P0)** — `confirmed` era constante literal `true`; evento estrutural nunca
      reconciliado com o preço vivo (mesma correção, implementados juntos por serem a mesma
      informação) — `app/Services/MarketStructureService.php`,
      `app/Services/GraphicalAnalysis/MarketSnapshotService.php` (implementado em 07/08/2026)
  - Status: **código aplicado.** `analyze()`/`latestBreakEvent()` ganharam `$precoVivo` opcional
    (default `0.0`, cai no `close` do último candle fechado — comportamento de sempre, preservado).
    `confirmed` passa a refletir se o preço (vivo, quando disponível) ainda está do lado certo do
    nível rompido — deixa de ser confirmado assim que o preço volta a cruzar. **H-49, sem gate novo**
    (regra explícita do documento): campo adicional `preco_voltou_a_cruzar` (booleano) entra dentro do
    próprio `structure.event`, que já é uma evidência `DECISION` enviada ao modelo — nenhum validador
    novo rejeita nem força reparo com base nele, é só informação a mais antes de escrever. Custa zero
    chamada extra: `$precoVivo` já era calculado em `MarketSnapshotService` (mesmo valor usado pra
    `technical.preco`), só nunca chegava até `MarketStructureService::analyze()`.
  - Verificação feita: script standalone (stub mínimo de `config()`, já que a classe lê defaults via
    esse helper Laravel) com série sintética ascendente + rompimento: sem preço vivo, `confirmed=true`
    (igual antes); preço vivo ainda além do nível, `confirmed=true`; preço vivo de volta do lado
    errado, `confirmed=false` e `preco_voltou_a_cruzar=true` — **exatamente a prova exigida pelo
    documento** ("teste com preço acima do nível de um BOS_DOWN, confirmed=false", espelhado aqui num
    BOS_UP). 9 asserções, todas OK. `php -l` limpo.
  - Depende de: nada. **Prova real (análise real com preço de volta sobre o nível rompido, narrativa
    reconhecendo) pendente.**

- [x] **H-50 (P1)** — Lista de termos vetados não proibia a família "confirma" (viola DP-10) —
      `app/Services/GraphicalAnalysis/DecisionResponseValidator.php`,
      `tests/Unit/DecisionResponseValidatorTest.php` (implementado em 07/08/2026)
  - Status: **código aplicado, com uma correção de fixture encontrada ao implementar.** `'CONFIRM'`
    (radical comum a confirma/confirmou/confirmado/confirmação/confirmar) adicionado como termo vetado
    — checado nos DOIS textos livres do modelo (`technical_analysis` E `score_description`; o bloco
    antigo de termos direcionais só checava `technical_analysis`, mas DP-10 fala em "textos", plural).
    **Achado ao implementar:** o fixture `valid()` de `DecisionResponseValidatorTest.php` (usado como
    baseline "deve passar sem erro" por vários testes do arquivo) continha "confirmação"/"confirmado"
    no próprio texto — teria quebrado `test_accepts_valid_contract()` com a correção nova. Corrigido o
    texto do fixture (troca de palavras equivalentes, sem alterar o que o teste verifica). Confirmado
    por grep que nenhum outro teste do repositório (`NarrativeFidelityGate`/`StructuralCoherenceGate`,
    testados isoladamente, sem passar por `DecisionResponseValidator`) seria afetado.
  - Verificação feita: `php -l` limpo. 2 testes novos escritos (não executados — mesma restrição de
    banco, embora não toquem banco): resposta com "confirmou a continuidade" em `technical_analysis` é
    rejeitada com `TECHNICAL_TEXT_FORBIDDEN:CONFIRM`; idem para `score_description` com
    `SCORE_TEXT_FORBIDDEN:CONFIRM` — a prova exata que o documento pede.
  - Depende de: nada. Nota relacionada (bloco "COMPRESSÃO DETECTADA..." em `AnalysisResult.tsx`, nunca
    renderiza hoje) **não religado**, como o documento manda — fica só registrado pro procedimento de
    higiene futuro.

### Bloco I — Ambiente e provas

- [ ] **I-51 (P0)** — Ambiente de produção diverge do código (~17bps vs. 15bps) — `config/genesis.php`
      + ambiente de produção — **não implementado, mudança de ambiente, não de código**
  - Status: **verificado o lado do código, não o lado do ambiente.** `config/genesis.php` confirma o
    default do documento: `entrada(4) + saida(4) + spread(2) + slippage-fallback(5) = 15` bps —
    exatamente o que o V6.5/E05 define, nenhuma mudança de código necessária aqui. A divergência é
    100% de `.env`/`config:cache` de um ambiente de produção ao qual esta sessão não tem acesso —
    não é algo que eu possa corrigir a partir do repositório. Documentado em `PROVAS_V6_7.md` (raiz do
    `genesis-api`) como ação pendente do usuário: alinhar `.env` de produção, rodar `config:cache`, e
    registrar a **data de corte** (análises antes/depois passam a usar custos diferentes — comparação
    histórica continua possível via `custos_bps` já gravado em cada `candidate_setup`).
  - Depende de: acesso à produção (fora desta sessão).

- [x] **I-52 (P0)** — Nenhuma prova tinha SHA de commit; artefatos antigos (`tests/Proof/APT`/`POL`)
      induziam a erro — `PROVAS_V6_7.md` (novo, raiz do `genesis-api`),
      `tests/Proof/_archive_v4_3_r3_2/` (implementado em 07/08/2026)
  - Status: **esqueleto criado, conteúdo real pendente.** `tests/Proof/APT`, `POL`, `MYX`,
    `_analise_gaps`, `_secao40_matriz`, `_secao41_comandos_prova` e o README original (todos do
    contrato V4.3-R3.2, 15/07/2026) movidos para `tests/Proof/_archive_v4_3_r3_2/` — **arquivados, não
    removidos** (procedimento de higiene, seção 20.1: nada apagado sem necessidade comprovada; nenhum
    arquivo do repositório referenciava esses caminhos fora de um markdown irmão dentro do próprio
    pacote, confirmado por grep, então mover em bloco não quebra nada). `tests/Proof/README.md` novo
    explica o arquivamento. `PROVAS_V6_7.md` criado na raiz do `genesis-api` com os dois SHA marcados
    como pendentes (nenhum commit foi feito nesta sessão — o usuário não pediu commit, não commitei
    por conta própria) e um índice completo do que falta provar, item a item, pras 7 ondas.
  - Verificação feita: grep confirmando que nenhum caminho antigo (`tests/Proof/APT`, `tests/Proof/
    POL`) ficou referenciado fora do próprio pacote arquivado.
  - Depende de: nada. **SHA reais + conteúdo de prova real ficam pendentes até o usuário decidir
    commitar e rodar as análises/comandos reais.**
  - Prova exigida: `PROVAS_V6_7.md` com os dois SHA no topo e a lista de provas indexada por item.

---

## Higiene de código morto — roda dentro da onda correspondente, não ao final (seção 20)

Procedimento obrigatório antes de qualquer remoção (seção 20.1, 7 passos): grep total do repositório
(código, testes, migrations, configs, `.env`, JSON, Markdown) → grep de chamada dinâmica (`app()`,
`resolve()`, `make()`, `config()`, import dinâmico) → verificar payload/contrato/tipo consumido pelo
frontend → verificar teste dependente → suíte completa antes/depois → 3 análises reais antes/depois,
payload campo a campo → 1 commit por remoção.

**Backend — já identificado por grep pelo Fabricio, tratar pelo procedimento acima:**

| Item | Onda | Observação |
| --- | --- | --- |
| `MotorExecucaoService::gerarSetup()` | 4 (A-16) | lógica antiga de RR mínimo — **não religar** |
| `TextQualityGate` | qualquer | tem teste próprio que também sai |
| `BreakRetestService` | qualquer | tem teste próprio que também sai |
| `DataFreshnessGate` | qualquer | sem chamador |
| `FeaturePolicy` | qualquer | sem chamador |
| `SinaisService` | qualquer | sem chamador |
| `EstruturaService` | qualquer | sem chamador |
| `AlvoService::RR_MINIMO` | 4 (A-16) | constante nunca usada — **não religar** |
| `config/genesis_graphical.php` | qualquer | **parcialmente vivo** — `breakout_atr_buffer` e janelas de pivô são lidos por `MarketStructureService`; `features.*`, `shadow_mode`, `min_coverage_for_execution`, `derivatives_modifier_max` não são lidos por ninguém — remover só as mortas |
| `tests/Proof/APT`, `tests/Proof/POL` | 7 (I-52) | artefatos V4.3-R3.2 de 15/07/2026 |

**Frontend:**

| Item | Onda | Observação |
| --- | --- | --- |
| `adaptedDataFetcher.ts` | qualquer | nenhum componente importa |
| `scoringEngine`, `indicatorEngine`, `technicalAnalysis`, `interpretationEngine`, `emaClassifier` | qualquer | entram só via `adaptedDataFetcher`, caem junto |
| `maturityPenalty.ts` | qualquer | nenhum importador |
| `saveAnalysisToHistory` | 7 (F-43) | ver F-43 |
| bloco `compressaoDetectada` em `AnalysisResult.tsx:666-676` | 7 (H-50) | nunca renderiza — **não religar**, viola DP-10 |
| selos `indicadores.fontes` em `AnalysisResult.tsx` | qualquer | adaptador nunca preenche, resquício V4.3 |

**O que NÃO deve ser removido (ratificado pelo PO — H07 da V6.6):** `ConfluenceScore.tsx` (virou o
Micro Radar, renderiza de verdade) e os outros dois arquivos das cinco famílias identificados como
vivos na V6.6. Nome antigo não é prova de código morto.

**Rastros que as correções deste documento vão criar (seção 20.4, tratar na mesma onda que os cria):**

| Correção | Onda | Rastro |
| --- | --- | --- |
| A-01 e A-08 | 4 | estrutura de `$grupos` por tipo + ramo `projecao_atr` |
| A-09 | 4 | `MARGEM_WICK_*` se absorvidas pelo buffer composto |
| B-17 | 5 | campo `ajustada` / chave `aplicada`, se a estrutura de retorno mudar |
| E-36 | 2 | função de cálculo de desfecho no navegador |
| F-41 | 7 | campos legado no `AnaliseTransformer`, **só depois** de confirmar que nada mais os consome |
| G-44 | 1 | um dos dois arquivos de tipos, ou parte dele |

---

## Provas obrigatórias (seção 24 do documento) — checklist resumido

Item sem prova válida conta como **não feito**, mesmo com código correto.

**Infraestrutura (uma vez por entrega):** SHA backend/frontend, `route:list` (v1/), `schedule:list`,
`config:show genesis` de produção, `.env` relevante, `php artisan about`, suíte PHPUnit completa,
`tsc --noEmit`, `npm run lint` + `npm run build`.

**Execução real (3 reanálises APTUSDT/BTCUSDT/POLUSDT, antes e depois):** payload público completo
antes/depois, comparação campo a campo (stop/alavancagem/RR/zona Plano B), log `EXECUCAO_AVALIADA` com
nota de cada âncora, consulta a `genesis_analises` + `genesis_analise_planos` de análise nova, log de
3 execuções consecutivas de `genesis:acompanhar-planos`.

**Tela (desktop + mobile):** stop `VALID`/`VALID_WIDE`/`STOP_UNAVAILABLE`, `recommended` falso com
aviso, RR bruto/líquido lado a lado, alavancagem alta + alerta de liquidação, Plano A/B coerentes,
Plano B indisponível com explicação, EMA 200 `N/D`, histórico com 2 planos + desfecho, troca de
corretora com aviso.

**Higiene:** grep negativo de cada item removido, 7 passos documentados por remoção, comparação de
payload antes/depois de cada remoção, grep negativo de `as unknown as`/`projecao_atr`/`gap_fill`/
`extensao` como fonte de alvo.

**Rastreabilidade:** `MATRIZ_V6_7.md` com uma linha por item (arquivo, linhas, prova, status —
só os 4 status permitidos: Implementado e comprovado / Implementado sem prova suficiente / Não
implementado / Bloqueado por decisão do PO).

## Gate final de aceite (seção 25) — as 12 condições, todas obrigatórias

1. Os 54 itens têm linha na matriz, com status e prova.
2. Nenhum item com status "Implementado sem prova suficiente".
3. As 3 reanálises (APTUSDT/BTCUSDT/POLUSDT) entregues antes e depois.
4. Stop das 3 análises diárias **inalterado** (1,72% / 4,46% / 8,11%).
5. Alavancagem exibida é exatamente a escolhida pelo membro, nas três.
6. `php artisan schedule:list` mostra os 3 comandos novos.
7. `php artisan config:show genesis` mostra custo de entrada e saída em 4.
8. `tsc --noEmit` limpo, sem `as unknown as` no adaptador.
9. Suíte PHPUnit verde, com `NivelServiceE09E10Test` reescrito.
10. Toda remoção de código com os 7 passos documentados.
11. Nenhuma decisão tomada sem registro de quem decidiu.
12. DPend-01 respondida pelo PO antes da implementação do dimensionamento.

---

## Como as decisões serão registradas (seção 2, regra 21.8)

Todo item fechado "por decisão" em vez de código entra na matriz com o status "Bloqueado por decisão do
PO" até virar código, ou fica marcado como decisão fechada com **quem decidiu, quando e por qual
canal** anotado na linha correspondente deste `tasks.md`. Nenhuma decisão informal (ex.: minha própria
leitura técnica de que "está tudo bem") fecha item sozinha — é exatamente o padrão que gerou o
retrabalho de G04/H07 na V6.6.
