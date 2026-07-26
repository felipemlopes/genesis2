# Documento de Requisitos — Gênesis V6.4: Restaurar Indicadores, Macro e Sentimento na Tela de Resultado

## Introdução

Na migração de `GenesisPage.tsx`/`AnalysisResult.tsx` (V4.3-R3.2) para `GenesisPage.tsx`/`GraphicalAnalysisResult.tsx`
(V6.4), a "Camada 4" da tela de resultado antiga — a seção colapsável "Revelar Matriz Completa" com métricas
técnicas (RSI, ADX, ATR, EMAs, Wyckoff, sessão, confluência multi-timeframe), macro/geopolítico (VIX, DXY, S&P500)
e sentimento (Fear & Greed, dominância BTC) — deixou de existir. Isso não foi uma decisão de produto: nem a versão
do componente novo escrita nesta sessão, nem a versão literal do `frontend/components/GraphicalAnalysisResult.tsx`
que está na Seção 22.63 do `Oficial Mestre.pdf` recriam essa seção.

**Confirmado com o Fabrício (usuário, 2026-07-26): o design da tela de resultado deveria continuar igual — a
seção de indicadores/macro/geopolítico/sentimento deveria continuar aparecendo.** Este spec corrige essa lacuna,
sem reabrir nenhuma decisão já fechada sobre escopo de execução (stop, alvo, entrada, alavancagem continuam fora,
por decisão explícita do usuário na Tarefa 0.1 do plano de implantação).

Repositórios:
- **[API]** `E:\Programas\wamp64\www\genesis-api` (Laravel)
- **[FE]** este repositório (React/TypeScript)

## Achado que motiva este spec

O componente antigo (`components/AnalysisResult.tsx`, linhas 587-752, "CAMADA 4: FUNDAMENTAÇÃO (Avançada)")
mostrava, atrás de um botão "Revelar Matriz Completa":

1. **Métricas Técnicas**: RSI(14), ADX, ATR, EMAs 21/50/200 (com badge de fonte API/OCR/N-D), Wyckoff, Sessão de
   mercado, Confluência multi-timeframe (bias por timeframe superior).
2. **Macro e Geopolítico**: resumo textual + lista de eventos, vindos de `contexto_informativo.macro`.
3. **Sentimento**: score 0-100 + narrativa + gatilhos positivos/negativos, vindos de `contexto_informativo.sentimento`.

Os itens 2 e 3 (texto narrativo) vinham de uma chamada Gemini **separada e dedicada** só para contexto
macro/sentimento, que não existe mais na arquitetura V6.4 (V6.4 faz uma única chamada de decisão — Seção 4 do
documento, "Gemini recebe imagem e bundle integral no mesmo processo e é o único decisor"). Os dados numéricos
brutos, porém, continuam sendo coletados pelo backend V6.4 e fazem parte do inventário oficial das 67 evidências
(Seção 8 do documento): `trend.ema21/50/200`, `momentum.rsi14`, `momentum.adx14`, `volatility.atr14`,
`structure.wyckoff`, `market.session`, `timeframes.context`, `macro.vix`, `macro.dxy_change_pct`,
`macro.sp500_change_pct`, `sentiment.fear_greed`, `sentiment.btc_dominance`. Eles são coletados, enviados ao
Gemini como evidência de papel `CONTEXT`, contabilizados em `evidence_accounting` — mas o `publicResponse()` do
`GraphicalAnalysisOrchestrator` nunca os inclui na resposta pública, então o frontend nunca teve como exibi-los
mesmo que quisesse.

## Decisão de escopo necessária (marcar antes de implementar)

**Os 5 itens de macro/sentimento não têm mais narrativa gerada por IA (resumo/eventos/gatilhos) — só o valor
numérico bruto e o status de disponibilidade.** Recriar a narrativa exigiria uma chamada de IA adicional, fora do
desenho V6.4 de "um único decisor" (Seção 4, Seção 6.4 — "Determinismo prático" já lista o custo de chamadas como
parâmetro controlado). Este spec assume que **mostrar o valor numérico bruto (ex.: "VIX: 18.58", "Fear & Greed:
26/100") é suficiente** para satisfazer o requisito confirmado ("continuar mostrando sentimento, geopolítica,
indicadores"). Se o Fabrício quiser a narrativa de volta, isso é um requisito novo (chamada de IA adicional), não
uma correção — precisa de decisão explícita antes de expandir este spec.

## Requisitos

### Requisito 1: Expor os dados de indicadores/macro/sentimento na resposta pública do backend

**User Story:** Como usuário do módulo de análise gráfica, eu quero ver os indicadores técnicos, dados de macro e
sentimento na tela de resultado, para ter o mesmo contexto informativo que a versão anterior sempre mostrou.

#### Critérios de Aceitação

1. THE `GraphicalAnalysisOrchestrator::publicResponse()` SHALL incluir um novo campo de nível superior
   `informative_context` na resposta JSON, montado a partir de `analysis.evidence_manifest` — nunca recalculado,
   nunca uma segunda chamada ao Gemini ou à Binance.
2. THE `informative_context.indicators` SHALL conter `rsi14`, `adx14`, `atr14`, `ema21`, `ema50`, `ema200`,
   `wyckoff`, `session`, `multi_timeframe` — cada um com `{ value, unit, status }`, extraído dos evidence IDs
   `momentum.rsi14`, `momentum.adx14`, `volatility.atr14`, `trend.ema21/50/200`, `structure.wyckoff`,
   `market.session`, `timeframes.context` respectivamente.
3. THE `informative_context.macro` SHALL conter `vix`, `dxy_change_pct`, `sp500_change_pct`, cada um com
   `{ value, unit, status }`, extraído de `macro.vix`, `macro.dxy_change_pct`, `macro.sp500_change_pct`.
4. THE `informative_context.sentiment` SHALL conter `fear_greed`, `btc_dominance`, cada um com
   `{ value, unit, status }`, extraído de `sentiment.fear_greed`, `sentiment.btc_dominance`.
5. WHEN um evidence item está `UNAVAILABLE` no manifesto, THE `informative_context` SHALL refletir
   `status: "UNAVAILABLE"` e `value: null` para aquele item — nunca omitir a chave nem inventar um valor.
6. THE Sistema SHALL NOT adicionar nenhum campo de execução (stop, alvo, entrada, alavancagem, tamanho de
   posição) a este contrato — este requisito é estritamente sobre dados informativos já coletados.

### Requisito 2: Tipos TypeScript para o novo contrato

**User Story:** Como desenvolvedor frontend, eu quero tipos fortes para `informative_context`, para que o
componente de resultado não precise usar `any`.

#### Critérios de Aceitação

1. THE `types/graphicalAnalysis.ts` SHALL adicionar `EvidenceValue<T>` (`{ value: T | null; unit: string | null;
   status: 'AVAILABLE' | 'UNAVAILABLE' }`) e `InformativeContext` (`{ indicators: {...}; macro: {...}; sentiment:
   {...} }`) exatamente com os campos do Requisito 1.
2. THE `GraphicalAnalysisResult` interface SHALL adicionar `informative_context: InformativeContext`.

### Requisito 3: Componente de resultado inteiro no mesmo design visual do antigo, seções de execução fora

**User Story:** Como usuário, eu quero que a tela de resultado nova use exatamente a mesma linguagem visual da
antiga (cards escuros `#0a0a0f`/`#050505`, cabeçalhos "CAMADA X" em caixa alta, cores por direção, tipografia
mono para números, o padrão "Revelar Matriz Completa" para conteúdo avançado), para que a troca de backend não
pareça uma troca de produto. Confirmado com o usuário (2026-07-26): é o estilo visual que deve ficar igual, não
os dados de execução — esses continuam fora, por decisão já tomada na Tarefa 0.1.

#### Critérios de Aceitação

1. THE `GraphicalAnalysisResult.tsx` SHALL reusar as classes/paleta/estrutura visual do `AnalysisResult.tsx`
   original (fundo `#0a0a0f`/`#050505`, bordas `border-white/[0.03]`, glow por direção, barra de progresso do
   score, tipografia `font-mono` para valores) para as seções que ainda existem: cabeçalho (par/timeframe/
   direção/score), "Análise Técnica" e a nova seção de indicadores/macro/sentimento — não a paleta genérica atual
   (`bg-white/[0.03]`, cards roxo/verde neutros) que foi escrita nesta sessão.
2. THE Sistema SHALL adicionar uma seção colapsável equivalente à "CAMADA 4: FUNDAMENTAÇÃO (Avançada)" original
   (`showIndicators`/"Revelar Matriz Completa", mesmo padrão de interação) com 3 colunas: "Métricas Técnicas",
   "Macro e Geopolítico", "Sentimento".
3. THE coluna "Métricas Técnicas" SHALL exibir RSI(14), ADX, ATR, EMAs 21/50/200, Wyckoff, Sessão de mercado e
   Confluência multi-timeframe, formatados como no componente antigo (rótulo + valor, "N/D" quando
   `status !== 'AVAILABLE'`).
4. THE coluna "Macro e Geopolítico" SHALL exibir VIX, variação do DXY e variação do S&P500 como valores
   numéricos rotulados — SHALL NOT tentar reconstruir o resumo textual/eventos do componente antigo (ver "Decisão
   de escopo necessária").
5. THE coluna "Sentimento" SHALL exibir o índice Fear & Greed e a dominância do BTC como valores numéricos
   rotulados — SHALL NOT tentar reconstruir a narrativa/gatilhos do componente antigo, pelo mesmo motivo.
6. THE Sistema SHALL NOT reintroduzir nenhum elemento de execução (zona de entrada, TP, stop, tamanho de posição,
   botão "Confirmar Posição", "CAMADA 2: RISCO-RETORNO", "CAMADA 3: PLANO DE AÇÃO") — confirmado explicitamente
   pelo usuário (2026-07-26) que a igualdade pedida é de estilo visual, não de dados de execução, que continuam
   fora por decisão da Tarefa 0.1.
7. THE botão de compartilhar/baixar imagem (`html2canvas`, "Salvar Análise") do componente antigo SHALL ser
   mantido no componente novo, aplicado ao conteúdo remanescente (sem os blocos de execução).

### Requisito 4: Não regredir nada que já funciona

**User Story:** Como responsável de produto, eu quero que esta correção não quebre o que já está funcionando no
fluxo V6.4, para que o conserto não vire uma nova rodada de bugs.

#### Critérios de Aceitação

1. THE Sistema SHALL manter os testes já existentes (`tests/Unit/DecisionResponseValidatorTest`,
   `tests/Unit/NarrativeFidelityGateTest`, `tests/Feature/GraphicalAnalysisLoadTest`, suíte frontend) passando
   sem alteração de comportamento fora do escopo deste spec.
2. THE Sistema SHALL adicionar um teste novo (`tests/Feature/GraphicalAnalysisInformativeContextTest.php` ou
   equivalente) provando que `informative_context` aparece na resposta pública com os 12 campos do Requisito 1,
   incluindo o caso de item `UNAVAILABLE`.
3. THE Sistema SHALL confirmar, com uma chamada real (não `Http::fake`), que os valores em `informative_context`
   batem com o que já foi confirmado manualmente nesta sessão via `tinker` (VIX, DXY, S&P500, Fear&Greed,
   dominância BTC de uma análise real).
