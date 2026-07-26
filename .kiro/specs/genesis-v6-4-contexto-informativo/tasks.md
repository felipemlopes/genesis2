# Plano de Implementação: Restaurar Indicadores, Macro e Sentimento (V6.4)

## Visão Geral

Corrige a lacuna encontrada em 2026-07-26: a "CAMADA 4" do `AnalysisResult.tsx` original (indicadores técnicos,
macro/geopolítico, sentimento) nunca foi recriada na migração pro fluxo V6.4. Confirmado com o usuário que o
estilo visual do componente antigo deveria ter continuado igual; os blocos de execução (zona de entrada, TP,
stop, tamanho de posição) continuam **fora**, por decisão já tomada na Tarefa 0.1 do plano `genesis-v6-4-implantacao`
e reconfirmada nesta conversa — este plano não reabre essa decisão.

Repositórios: **[API]** = `E:\Programas\wamp64\www\genesis-api` · **[FE]** = `c:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main`.

Pré-requisito já satisfeito: Tarefas 1-11 do plano `genesis-v6-4-implantacao` completas (ver `tasks.md` daquele
spec) — este plano assume o backend/frontend V6.4 já instalado e funcionando.

**Concluído em 2026-07-26**, todas as tarefas, autorizado explicitamente pelo usuário ("execute todas tasks").

## Adendo (2026-07-26, mesmo dia) — narrativa de macro/sentimento

Depois da entrega, o usuário testou e reportou que faltava o **texto** explicando macro/geopolítica/sentimento
(não só os números) — era assim antes do V6.4 (`GeminiAnalysisService::gerarContextoInformativoUnico()`, arquivo
apagado na Tarefa 9 do plano de implantação). Confirmado pelo usuário: "tem que deixar como antes por que ele
[Fabrício] vai reclamar".

Restaurado com uma chamada Gemini **completamente separada** do decisor único do V6.4 (não toca em
`GenesisPrompt.php`, `GenesisDecisionSchema.php` nem `GeminiInteractionsClient.php` — respeitando a instrução já
dada nesta sessão de nunca mexer no prompt de decisão):

- **[API]** `app/Services/GraphicalAnalysis/InformativeNarrativeService.php` (novo) — porta literal da lógica
  antiga (prompt, endpoint `v1beta/models/{model}:generateContent`, parsing defensivo), chamado só depois da
  decisão principal já validada, nunca antes — não afeta `bundle_json` enviado ao decisor nem `manifest_hash`.
- **[API]** `GraphicalAnalysisOrchestrator`: narrativa injetada como 2 itens sintéticos
  (`macro.narrative`/`sentiment.narrative`, `decision_role: DISPLAY_ONLY`) no `evidence_manifest` persistido —
  **sem migration**, reaproveita a coluna JSON já existente. `informativeContext()` estendido pra expor os 2
  campos novos.
- **[FE]** `types/graphicalAnalysis.ts`: `MacroNarrative`/`SentimentNarrative`, campo `narrative` em
  `informative_context.macro`/`.sentiment`.
- **[FE]** `GraphicalAnalysisResult.tsx`: renderização da narrativa restaurada, mesmo padrão visual do
  `AnalysisResult.tsx` original (resumo + eventos pra macro; score badge + narrativa + gatilhos ± pra sentimento).

**Verificado:** chamada isolada ao `InformativeNarrativeService` (real) e fluxo completo `analyze()` (real, mesma
imagem HYPEUSDT) — os 2 campos vieram `AVAILABLE` com texto real nos dois casos. Suíte completa (backend + testes
`GraphicalAnalysis*`) e suíte frontend (build/tsc/vitest) confirmadas sem regressão, mesma baseline de falhas
pré-existentes. Registro de teste e crédito da verificação end-to-end estornados/apagados depois.

**Custo real assumido:** mais uma chamada Gemini por análise nova (não usa cache — roda de novo a cada geração
fresca), best-effort (nunca derruba a análise principal se falhar).

## Tarefas

- [x] 1. Backend — expor `informative_context` na resposta pública
  - [x] 1.1 **[API]** Adicionado `informativeContext()`/`evidenceEntry()` a `GraphicalAnalysisOrchestrator.php`,
        chamado por `publicResponse()`
    - `persist()`/`generate()` não foram tocados — o dado já estava em `evidence_manifest`, só lido e formatado.
    - Os 12 evidence IDs exatos usados: `momentum.rsi14`, `momentum.adx14`, `volatility.atr14`, `trend.ema21`,
      `trend.ema50`, `trend.ema200`, `structure.wyckoff`, `market.session`, `timeframes.context`, `macro.vix`,
      `macro.dxy_change_pct`, `macro.sp500_change_pct`, `sentiment.fear_greed`, `sentiment.btc_dominance`.
    - _Requisito 1_
  - [x] 1.2 **[API]** Teste novo: `tests/Feature/GraphicalAnalysisInformativeContextTest.php` — 3/3 passando
    - Os 3 casos do requisito cobertos via reflection sobre `publicResponse()` (método privado), determinístico,
      sem chamada de rede.
    - **Achado corrigido no processo:** o teste, como a maioria dos testes deste projeto/pacote (nenhum usa
      `RefreshDatabase`), deixava linhas residuais na tabela `genesis_analises` do banco de dev real a cada
      execução. Adicionado `tearDown()` com limpeza explícita (`createdAnalysisIds`/`createdUserIds`) — os 6
      registros de teste já deixados por uma primeira execução foram identificados com precisão e apagados.
    - _Requisito 1, Requisito 4.2_
  - [x] 1.3 **[API]** Suíte completa (`php artisan test`): 96 passando, 1 falha pré-existente e não relacionada
        (`RadarNewsPollTest`), 1 skip (live-contract, esperado fora de homologação) — zero regressão.
    - _Requisito 4.1_

- [x] 2. Frontend — tipos
  - [x] 2.1 **[FE]** Adicionados `EvidenceValue<T>`, `MultiTimeframeEntry`, `InformativeContext` a
        `types/graphicalAnalysis.ts`, e o campo `informative_context` a `GraphicalAnalysisResult`
    - _Requisito 2_
  - [x] 2.2 **[FE]** `npx tsc --noEmit` limpo
    - _Requisito 2, Requisito 4.1_

- [x] 3. Frontend — redesign visual do componente de resultado
  - [x] 3.1 **[FE]** `components/GraphicalAnalysisResult.tsx` reescrito reusando a paleta/estrutura do
        `AnalysisResult.tsx` original (fundo `#0a0a0f`/`#050505`, glow radial por direção, barra de progresso do
        score, tipografia mono) para cabeçalho, score e análise técnica
    - Assinatura de props mantida (`data`, `onReset`).
    - _Requisito 3.1_
  - [x] 3.2 **[FE]** Seção colapsável "Revelar Matriz Completa" adicionada, 3 colunas lendo de
        `data.informative_context`
    - Métricas Técnicas: RSI(14), ADX, ATR, EMAs 21/50/200, Wyckoff (com fallback `humanize()` pra fases não
      mapeadas em `WYCKOFF_LABEL`, ex.: `RANGE_SEM_EVENTO` confirmado numa chamada real), Sessão, Confluência
      multi-timeframe.
    - Macro: VIX, variação DXY, variação S&P500 — valor numérico, sem narrativa (decisão de escopo do
      `requirements.md`).
    - Sentimento: Fear & Greed, dominância BTC — valor numérico, sem narrativa.
    - "N/D" quando `status !== 'AVAILABLE'`.
    - **Achado corrigido durante a verificação real (Tarefa 4.1):** `dxy_change_pct` veio `-0.0049` numa chamada
      real — arredondar pra 2 casas decimais mostrava "-0.00%", perdendo a informação. Ajustado pra 4 casas
      decimais nos dois campos de variação percentual de macro (`dxy_change_pct`, `sp500_change_pct`).
    - _Requisito 3.2, 3.3, 3.4, 3.5_
  - [x] 3.3 **[FE]** `handleShare`/`html2canvas` ("Salvar Análise") reintegrado sobre `#analysis-capture`
    - _Requisito 3.7_
  - [x] 3.4 **[FE]** Confirmado por `grep` (não só visual): zero ocorrência de
        `stop|take_profit|tp1|tp2|tp3|entrada|alavancagem|leverage|liquidacao|Confirmar Posição|tamanho de
        posição` no componente novo.
    - _Requisito 3.6_

- [x] 4. Verificação end-to-end
  - [x] 4.1 **[API][FE]** Análise real rodada (`HYPEUSDT.P_2026-06-18_10-55-16.png`, `HYPEUSDT`, `1d`) — os 14
        campos de `informative_context` vieram `AVAILABLE` com valores reais (RSI 41.97, ADX 15.02, ATR 3.43,
        EMAs 21/50/200, Wyckoff `RANGE_SEM_EVENTO`, sessão `NEW_YORK`, 2 timeframes de confluência, VIX 18.58,
        DXY -0.0049%, S&P500 -1.1599%, Fear&Greed 26, dominância BTC 56.43%). Validador confirmou `ok=true`.
    - _Requisito 4.3_
  - [x] 4.2 **[FE]** `npm run build` limpo; `npx vitest run`: 282 passando, mesmos 5 arquivos pré-existentes e
        não relacionados já documentados no plano `genesis-v6-4-implantacao` (Tarefa 6.4) — nenhum arquivo novo
        falhando.
    - _Requisito 4.1_
  - [x] 4.3 **[API][FE]** Commits separados por repositório, referenciando este spec.
