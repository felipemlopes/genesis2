# GÊNESIS V6.9, DOCUMENTO DE IMPLEMENTAÇÃO

**41 correções. Arquivo, linha, o que muda, o que apagar e como testar.**

> Cópia de referência salva no spec em 01/09/2026, a partir do documento colado pelo Felipe na
> conversa que abriu `genesis-v6-9-correcao-tecnica`. Reencodada (o arquivo original chegou com a
> acentuação corrompida — UTF-8 lido como Latin-1). Conteúdo tratado como fonte de verdade
> item a item; `tasks.md`, no mesmo diretório, indexa os 41 itens em fases rastreáveis por
> checkbox e não duplica o código — quando um item tiver bloco de código, ele está aqui.

| Campo | Valor |
|---|---|
| Data | 24/08/2026 |
| PO | Fabrício |
| Dev | Felipe |
| Backend | `genesis-api-genesis2` |
| Frontend | `genesis2-master` |
| Caso de prova | BTCUSDT.P 1d, gráfico de 23/08/2026 às 20:58:34, análise às 21:00:14 |
| Situação | Fechado. Nenhum item depende de decisão pendente |

---

# LEIA ANTES DE COMEÇAR

**Nenhuma correção deste documento pode ser entregue sem teste que a comprove.**

O item 41 vem primeiro por um motivo prático: hoje o teste de aceite é `assertTrue(true)` apontando
para uma pasta que só existe na sua máquina. Ele passa com qualquer resultado. Sem uma suíte real,
as correções críticas deixam de ter evidência automática de não regressão e o aceite volta a
depender excessivamente de conferência manual.

**A entrega só é aceita com a suíte rodando e passando.** Cada correção tem, neste documento, uma
seção "Como testar" com o comportamento que a asserção precisa verificar.

**Sobre os cards de Sentimento do Ativo e Macro e Geopolítico:** os dois precisam voltar a funcionar
e continuar funcionando depois de todas as outras mudanças. Isso é o item 29 e não é opcional. Ele é
restauração de comportamento que já existiu, não desenvolvimento novo.

---

# ARQUITETURA

```
PHP + APIs + visão
        ↓
dados, cálculos, estruturas e figuras validadas
        ↓
IA funciona como o trader
        ↓
interpreta o conjunto
        ↓
LONG ou SHORT + intensidade + Plano A + Plano B + stop + alvos + justificativa
```

**A IA é o cérebro da análise. O PHP coleta, calcula, organiza e valida fatos. A IA interpreta esses
fatos.**

## As oito regras globais

Toda correção obedece a estas oito. Onde houver conflito, a regra global vence.

**1.** A IA é o trader. Recebe o conjunto de evidências válidas e interpreta como um profissional
faria. A direção é sempre LONG ou SHORT.

**2.** A IA interpreta, nunca inventa. Não pode criar preço, nível, suporte, resistência, pivô,
figura, rompimento, reteste, indicador, volume, funding, Open Interest, liquidação, stop, alvo ou
timestamp que não tenham sido fornecidos e validados.

**3.** Dado ausente nunca vira zero. Falha produz `null` e `UNAVAILABLE`. Zero é um dado.
Indisponível é ausência de dado.

**4.** Falha parcial não derruba a análise. Dez fontes, duas falharam, trabalha com oito.

**5.** Toda indisponibilidade gera log com `source`, `symbol`, `timeframe`, `service`, `endpoint`,
`attempts`, `latency_ms`, `error_code`, `error_message`, `status` e `observed_at`.

**6.** Backend nunca aparece no frontend. Nenhum código interno, ID, endpoint, nome de serviço,
stack trace ou status técnico chega ao membro.

**7.** As 50 figuras são validadas pelo PHP contra `GenesisVisualCatalogV6.php`. Só figura validada
entra no contexto da IA.

**8.** A vela é evidência, não o centro da arquitetura. A inconsistência temporal é corrigida, mas a
análise nunca é bloqueada porque uma vela está aberta.

---

# RESUMO DO QUE APAGAR

Estes trechos saem do código. Não desativar, não comentar: apagar.

| Arquivo | O que apagar |
|---|---|
| `tests/Feature/AceiteVisualV69Test.php` | `self::assertTrue(true);` e os caminhos `C:\Users\felip\Downloads\` |
| `app/Services/NivelService.php` | `TETO_BANDA_PCT = 0.20` e `TETO_CAMADA3_PCT = 0.30` |
| `app/Services/MotorExecucaoService.php` | Todo caminho de cálculo com margem de manutenção `0.005` fixa |
| `app/Services/ExecucaoService.php:841-842` | `number_format(..., 2, ',', '.')` dentro de string pública |
| `app/Services/DerivativesReadingService.php:157-159` | A faixa `> 3` e `< -3` na classificação |
| `app/Services/GraphicalAnalysis/ScoreNarrativeBuilder.php:63` | A impressão do modificador numérico no texto público |
| `app/Services/GraphicalAnalysis/GeminiContextService.php:305` | A expressão "NÃO atribui score" da instrução |
| `app/Services/GraphicalAnalysis/PlanoBService.php:198` | O clamp `round($precoAtual * 0.999, 8)` como borda de zona |
| `components/AnalysisResult.tsx:997` | O `toFixed(4)` cru do ATR |
| `services/oiLiquidationService.ts:73` e `:91` | Os retornos `{ val: 0, ... }` e `{ price: 0, change: 0 }` no catch |

---

# BLOCO 1: ALVOS

## 1. Alvo colado no preço é descartado

**Arquivo.** `app/Services/GraphicalAnalysis/TargetCandidateCatalog.php:97`

**Hoje.**

```php
if ($valor == $preco) { continue; }
```

Igualdade exata de float. Qualquer nível colado no preço passa. Foi assim que a parede de ofertas
em $77,720.30, a $1.10 da entrada de $77,719.20, virou TP1 e o R:R saiu 1:0.00.

**Muda para.**

```php
$minDistance = max($tickSize * 4, $atr * 0.25);
if (abs($valor - $preco) < $minDistance) { continue; }
```

A regra já está escrita no normativo V6.9, linhas 1601 e 1932. Nunca foi implementada.

**Resultado no caso auditado.** O piso vira $510.97. A parede de ofertas é descartada.

**Como testar.** Candidata a 0.10 ATR da entrada é descartada. Candidata a 0.30 ATR é aceita. Nenhum
alvo publicado abaixo de `max(tickSize × 4, ATR × 0.25)`.

---

## 2. Alvo distante demais é descartado

**Arquivo.** `TargetCandidateCatalog.php`, mesma função

**Hoje.** Não existe teto de distância.

**Muda para.**

```php
$maxDistance = $atr * $this->horizonAtr($timeframe);
if (abs($valor - $preco) > $maxDistance) { continue; }
```

**Regra.** O ATR organiza o horizonte. O ATR nunca cria preço.

**Como testar.** Candidata além do horizonte do timeframe é descartada. Nenhum alvo publicado acima
do teto.

---

## 3. Alvos não podem sair colados

**Arquivo.** `TargetCandidateCatalog.php`, seleção dos três alvos

**Hoje.** O piso e o teto medem a partir da entrada. Nada mede de um alvo para o outro.

**Muda para.**

```
TP2 precisa estar >= 0.50 ATR além do TP1
TP3 precisa estar >= 0.50 ATR além do TP2
```

**As três medidas de ATR têm funções distintas:**

```
0.15 ATR   agrupa a mesma região
0.25 ATR   afasta da entrada
0.50 ATR   separa uma parcial da outra
```

**Como testar.** Com TP1 em $79,137.40, um candidato em $79,520.00 é rejeitado, porque está a
$382.60 e o mínimo é $1,021.94.

---

## 4. Desempate entre alvos

**Arquivo.** `TargetCandidateCatalog.php`, ordenação

**Regra.** A força estrutural continua sendo o critério principal. **O piso e o teto são filtros de
elegibilidade, não critério de escolha.**

Só em empate de força:

```
TP1  ->  candidato mais próximo, é a parcial de segurança
TP2  ->  candidato mais distante
TP3  ->  candidato mais distante
```

**Como testar.** Duas resistências de força igual em $82,100 e $85,900, com TP1 em $79,100: o TP3
fica em $85,900.

---

## 5. Nunca completar alvo por cálculo

**Arquivo.** `TargetCandidateCatalog.php`

**Regra.** Existindo dois níveis válidos, publica dois e informa. Nunca completar por cálculo
artificial.

**Como testar.** Ativo com apenas duas zonas válidas publica TP1 e TP2, e o TP3 sai como
indisponível. Nenhum preço fabricado.

---

## 6. EMA deixa de originar alvo

**Arquivo.** `TargetCandidateCatalog::PESOS`

**Hoje.**

```php
'ema' => 5,
```

Isso permite a uma EMA originar um alvo sozinha. O normativo põe a EMA em `$addConfluence`, linha
1554, junto com Fibonacci e número redondo. Média móvel muda de lugar todo dia, mesmo com o preço
parado.

**Muda para.**

```php
'ema' => 0,
```

**Regra explícita.**

```
EMA:
  origem de alvo  =  proibida
  confluência     =  permitida
```

A EMA continua sendo exibida e continua reforçando suporte, resistência, pivô, nó de volume ou
outro nível estrutural real, **quando já existir um nível válido naquela região**.

**Como testar.** Criar caso com uma EMA sem nenhum nível estrutural correspondente. **Nenhum
`target_candidate` pode ter origem exclusiva EMA.**

---

## 7. Zona de liquidação reforça níveis

**Arquivo.** `TargetCandidateCatalog.php:23-28`

**Hoje.** O comentário declara o desvio:

> "a quarta fonte de confluência que o item 6.2 pede fica de fora, `LiquidationMapService` ainda é
> a implementação ANTIGA... esta entra quando a Fase 10 entregar o mapa real."

A Fase 10 foi entregue nesta mesma versão. O `LiquidationMapService` está reescrito, com `LIMIT_OI`
corrigido para 500 e bins por tickSize real.

**Muda para.** Entra como quarta fonte de confluência.

```
peso de origem       = 0
função               = confluência
intensidade mínima   = LIQUIDATION_CONFLUENCE_MIN_INTENSITY (0.70)
```

**Regra.** A zona estimada de liquidação pode reforçar um nível estrutural quando atingir a
intensidade mínima de 0.70, mas nunca origina um alvo sozinha.

**Como testar.** Nó de volume em $63,700 com zona de intensidade 0.82 no mesmo lugar recebe reforço.
Zona de intensidade 0.45 é ignorada.

---

## 8. Segunda validação depois da escolha da IA

**Arquivo.** `app/Services/GraphicalAnalysis/TargetSelectionValidator.php`

**Hoje.** O piso e o teto rodam apenas na montagem do catálogo. Se a IA seleciona um `candidate_id` e
ninguém confere depois, o defeito volta por outro caminho.

**Muda para.**

```
1. PHP monta os candidatos
2. PHP filtra: lado, piso, teto, preço válido, tickSize
3. A IA recebe somente IDs existentes
4. A IA seleciona candidate_ids
5. TargetSelectionValidator RECALCULA lado, piso, teto e tickSize
6. Candidato inválido é descartado mesmo tendo sido escolhido pela IA
```

**Regra.** A escolha da IA nunca supera a validação do PHP.

**Como testar.** Injetar um ID válido mas fora do piso na seleção e confirmar que é descartado antes
da publicação.

---

# BLOCO 2: STOP

## 9. Teto do stop em ATR

**Arquivo.** `app/Services/NivelService.php`

**Hoje.**

```php
private const TETO_BANDA_PCT   = 0.20;   // 20% do preço
private const TETO_CAMADA3_PCT = 0.30;   // 30% do preço
```

No BTC, 20% de $77,719.20 são $15,543.84, e o fundo de junho, a $14,102.40, coube. Percentual fixo
não se adapta à volatilidade nem ao tempo gráfico: 20% num gráfico de 15 minutos é um universo.

**Apagar as duas constantes. Muda para.**

```
até 3.0 ATR                   faixa normal
acima de 3.0 e até 4.5 ATR    faixa ampliada
acima de 4.5 ATR              candidato rejeitado
```

Os mesmos valores para todos os tempos gráficos, porque o ATR já é calculado no tempo analisado.

**Resultado no caso auditado.** 3.0 ATR marcam $6,131.67. O fundo de junho, a 6.90 ATR, fica acima do
limite ampliado e é rejeitado.

**Como testar.** Stop final a 2.50 ATR é normal. A 3.80 ATR é ampliado. A 4.80 ATR é rejeitado.

---

## 10. A IA escolhe qual nível protege a entrada

**Arquivo.** `NivelService.php` e o contrato de decisão

**Hoje.** O sistema pergunta "qual é a barreira estrutural mais forte dentro de 20% do preço" e
responde com um fundo de junho. Isso responde "quando a tendência de baixa volta", não "quando esta
entrada falhou".

**Muda para.**

```
1. A IA definiu LONG ou SHORT
2. O PHP fornece os níveis estruturais reais do lado contrário
3. A IA interpreta o setup e escolhe qual nível real melhor protege a entrada
4. A IA nunca cria preço de stop
5. O PHP valida o nível escolhido
6. O PHP aplica o buffer e as regras matemáticas
7. Sem âncora específica, usa estrutura de proteção disponível
8. Sem stop confiável, stop = null e os dependentes ficam indisponíveis
9. A análise técnica continua existindo
```

A IA pode escolher, conforme o caso: nível rompido, suporte, resistência, pivô, mínima ou máxima
relevante, nível de figura validada, região estrutural ou VRVP.

**A mínima da vela de rompimento pode ser relevante em alguns setups. Não é obrigatória em todos.**

**Regra.** O sistema deixa de selecionar automaticamente um nível estrutural antigo apenas por força
e passa a usar um nível real que sustenta ou invalida a entrada atual. O valor final do stop é
determinado pelos dados do setup no momento da análise e deve respeitar as faixas de ATR.

**Como testar.** A IA devolve um ID que não existe na lista: rejeitado. A IA devolve um preço em vez
de um ID: rejeitado.

---

## 11. Teto verificado no stop final

**Arquivo.** `NivelService.php`, função de elegibilidade

**Hoje.** O teto é testado na âncora, antes do colchão. Como o colchão nunca é menor que 0.5 ATR, o
stop final pode ultrapassar o próprio teto sem ninguém perceber.

**Muda para.**

```
âncora  +  buffer completo  =  stop final
                                    ↓
                    calcular distância em ATR
                                    ↓
                classificar normal / ampliado / rejeitado
```

**Como testar.** Âncora a 2.80 ATR com buffer de 0.5 ATR produz stop final a 3.30 ATR e é
classificado como ampliado, não como normal.

---

## 12. Colchão nunca é cortado

**Arquivo.** `NivelService::calcularBuffer()`

**Regra.** Proibido encolher o colchão para o stop caber no teto. Se o stop final ficar fora do
limite, o candidato não serve.

**Como testar.** Stop final a 4.80 ATR com teto de 4.5 é rejeitado, e o buffer sai íntegro no log.
Nenhum caminho de código reduz o buffer para fazer o stop caber.

---

## 13. Três invalidações, quando existirem

**Arquivo.** `ExecucaoService.php` e contrato de saída

**Regra.** A invalidação da operação define o stop. As outras duas aparecem **como contexto, quando
houver nível real e justificável.**

```
Invalidação da operação    o nível que sustenta esta entrada
Invalidação da estrutura   o nível que desfaz a mudança de caráter
Invalidação da tese        o nível que retoma a tendência anterior
```

**Não criar três motores independentes para preencher três linhas.** Os três saem do mesmo catálogo
de níveis observados. Nunca de indicador isolado: EMA, RSI, ADX ou MACD. Não existindo nível válido,
**a linha não aparece**, e nunca aparece a palavra "indisponível" no lugar.

**Como testar.** Ativo sem nível estrutural intermediário exibe apenas a invalidação da operação.

---

## 14. Sem stop, o risco fica indisponível

**Arquivo.** `app/Services/ExecucaoService.php:238`

**Hoje.**

```php
$riscoPreco = $stopDisponivel ? abs($preco - $stop) : 0.0;
```

Sem stop, o risco vira **zero** e o dimensionamento é calculado em cima disso.

**Muda para.**

```
risco             = null
tamanho           = null
margem dependente = null
R:R dependente    = null
```

Nunca zero. A análise técnica continua existindo.

**Como testar.** Forçar `STOP_UNAVAILABLE` e confirmar que nenhum campo dependente sai como `0`.

---

# BLOCO 3: RISCO E LIQUIDAÇÃO

## 15. Tamanho da posição nunca zera silenciosamente

**Arquivo.** `app/Services/ExecucaoService.php:817`

**Hoje.** Capital de $1,000, risco de 1%, stop a 19.46%:

```
nocional    = min(10 / 0.1946 ; 1000 × 5)  =  $51.39
quantidade  = 51.39 / 77,719.2             =  0.000661 BTC
arredondada = floor(0.000661 / 0.001) × 0.001  =  0
```

Quantidade zero, nocional zero, risco zero, margem zero, liquidação impossível. E o botão de
confirmar continuou ativo.

**Muda para.** Quando a quantidade calculada ficar abaixo do lote mínimo, exibir os quatro números:

```
Quantidade calculada      0.000661 BTC
Mínimo do contrato        0.001 BTC
Risco planejado           $10.00
Risco com o lote mínimo   $15.12
```

Com alerta de incompatibilidade.

**O lote mínimo nunca é rotulado como "tamanho sugerido".** Isso converteria um orçamento de 1% em
outro valor sem o membro perceber.

**Como testar.** Rodar o mesmo setup e confirmar que nenhum campo de tamanho, risco, margem ou
nocional aparece zerado.

---

## 16. Uma única margem de manutenção

**Arquivos.** `app/Services/MotorExecucaoService.php` e
`app/Services/GraphicalAnalysis/LiquidationCalculatorService.php`

**Hoje.** Duas contas para a mesma variável:

```php
// MotorExecucaoService
private function calcularLiquidacao(..., float $mm = 0.005)
// maiorAlavancagemSegura() chama com 0.005 fixo
```

Na análise auditada a tela disse "faixa segura 4.2x" com a conta chutada e mostrou travessão na
liquidação, porque a conta boa não rodou. Afirmou saber e não saber ao mesmo tempo.

**Muda para.** Bracket real como autoridade única. **Apagar o caminho com `0.005` fixo.** Sem
bracket, a liquidação fica indisponível e nunca é substituída por margem fixa.

**Como testar.** Buscar `0.005` no `MotorExecucaoService` e não encontrar caminho de cálculo com
esse valor.

---

## 17. Espaço entre stop e liquidação

**Arquivo.** `ExecucaoService.php` e `LiquidationCalculatorService.php`

**Hoje.** Não existe verificação entre o stop e o ponto de liquidação. No BTC o stop ficou em
$62,594.90 e a liquidação em torno de $62,486.00, cerca de cem dólares entre um e outro.

**Muda para.** Dois estados objetivos, sem adjetivo.

**A regra de comparação, válida para LONG e para SHORT.**

```
d_stop = abs(entry - stop)
d_liq  = abs(entry - liquidation)

se d_liq <= d_stop:
    a liquidação acontece antes ou no mesmo ponto do stop

se d_liq > d_stop:
    o stop é alcançado antes da liquidação
```

**Antes da comparação, validar que stop e liquidação estão no lado adverso correto da entrada para a
direção da operação.** A comparação usa as distâncias adversas, nunca os preços absolutos. Num LONG
os dois ficam abaixo da entrada, num SHORT os dois ficam acima.

**Liquidação depois do stop:**

```
Stop: $75,077.00
3.40% da entrada

Liquidação: $74,455.00
4.20% da entrada

Distância entre stop e liquidação:
$622.00 | 0.30 ATR
```

**Liquidação antes ou no mesmo ponto do stop:**

> A liquidação está antes ou no mesmo ponto do stop. A posição pode ser liquidada antes que a
> proteção seja executada conforme planejado.

Havendo cálculo monetário confiável, exibir o risco planejado e a perda estimada até a liquidação
lado a lado.

**Proibido** afirmar "você perde toda a margem" sem cálculo real. **Proibido** usar seguro, adequado,
confortável, próximo, distante ou normal. **Proibido** traduzir o ATR em frases como "movimento de um
dia normal".

**Como testar.** Rodar com 5x, 15x e 30x no mesmo setup e conferir os textos dos dois estados.

---

## 18. Alavancagem máxima com bracket real

**Arquivo.** `MotorExecucaoService::maiorAlavancagemSegura()`

**Hoje.** O número sai do `0.005` fixo.

**Muda para.**

```
1. Obter o bracket real da Binance para o símbolo
2. Usar a margem de manutenção correspondente ao nocional
3. Testar cada alavancagem candidata
4. Recalcular a liquidação para cada uma
5. Devolver a maior em que a liquidação fica depois do stop
```

Texto público:

> maior alavancagem calculada em que a liquidação permanece depois do stop

**Proibido** regra de três, proporção simples ou reaproveitamento de cálculo aproximado. **Proibido**
chamar de segura, ideal, recomendada ou confortável.

**O sistema nunca altera a alavancagem escolhida pelo membro.**

**Como testar.** Comparar o número devolvido com o cálculo manual usando a tabela de brackets da
Binance.

---

# BLOCO 4: DADOS E TEMPO

## 19. Consistência temporal dos indicadores

**Arquivo.** `app/Services/GraphicalAnalysis/MarketSnapshotService.php:61`

**Hoje.** O cálculo roda sobre `$candlesBrutos`, que inclui a vela viva. O gráfico foi capturado às
20:58:34, faltando 1min27s para a vela diária fechar. A análise rodou às 21:00:14, quatorze segundos
depois de abrir uma vela nova.

**Prova.** Aplicando exatamente um passo adicional de EMA sobre os valores do gráfico com o preço
vivo, chega-se aos três valores do backend com erro abaixo de $2.

**Resultado esperado da fixture do BTCUSDT.P auditado:**

| | Hoje | Esperado |
|---|---|---|
| Variação | 0.00% | +0.85% |
| EMA 21 | $69,155.8 | $68,301.6 |
| EMA 50 | $66,769.9 | $66,323.9 |
| EMA 200 | $71,764.3 | $71,704.7 |

**Estes números pertencem ao caso auditado. Não são promessa de que toda execução futura terá
exatamente estes valores.**

**Regra geral.** Os indicadores do Gênesis devem coincidir com a referência do TradingView quando
ambos utilizarem a mesma série, o mesmo timeframe e a mesma referência temporal, dentro da
tolerância de cálculo e formatação definida.

**Muda para.** Os indicadores usam a série correta. O preço vivo continua sendo usado em entrada,
stop, alvos, distâncias e execução.

**O objetivo é impedir mistura de séries, não transformar fechamento de vela em motor do sistema. A
análise nunca é bloqueada porque uma vela está aberta.**

**Como testar.** Teste de rollover com quatro instantes: `20:59:59`, `21:00:00`, `21:00:01` e
`21:00:15`. O preço vivo pode mudar imediatamente. Os indicadores continuam baseados na última vela
totalmente fechada.

---

## 20. Registrar qual vela foi usada

**Arquivo.** Persistência da análise

**Muda para.** Um campo persistido:

```
last_closed_candle_at
```

Serve para auditoria e diagnóstico. **Não é regra de decisão. Não aparece para o membro.**

**Como testar.** O campo existe no registro e traz a data e hora da última vela fechada.

---

## 21. Frescor acompanha o tempo gráfico

**Arquivo.** `app/Services/GraphicalAnalysis/FreshnessPolicy.php:28`

**Hoje.**

```php
'open_interest_history' => 43_200_000,   // 12 horas, fixo
```

Apenas `candles` escala com o timeframe. Num diário, um dado de 13 horas atrás é normal. Foi assim
que o score levou "Frescor das fontes: 88% (7/8)" e perdeu pontos por uma regra calibrada para
gráfico de minutos.

**Muda para.** A tolerância escala com o tempo gráfico, como já acontece com os candles.

**E se o dado realmente não vier, ele sai da conta e reduz a cobertura, nunca tira ponto do score.**

**Como testar.** Rodar BTCUSDT 1d e confirmar que o Open Interest histórico não aparece mais como
defasado.

---

## 22. Falha nunca vira zero

**Arquivos.** `app/Services/BinanceService.php` e `services/oiLiquidationService.ts`

**Hoje, verificado no código.** Apenas a chamada de candles tem retry, em `BinanceService.php:122`,
com `retry(2, 500)`. Funding, Open Interest, livro de ofertas, brackets e filtros do contrato têm
**uma** tentativa e timeout de 10 segundos. No frontend, `oiLiquidationService.ts:73` e `:91` devolvem
zero em falha.

**Muda para.**

```
DATA_FETCH_MAX_ATTEMPTS      = 3
DATA_FETCH_RETRY_BACKOFF_MS  = [250, 500]
DATA_FETCH_TIMEOUT_MS        = 5000
```

Falhando as três:

```
valor  = null
status = UNAVAILABLE
```

Com log completo. A IA continua com os demais dados.

**Apagar** os retornos `{ val: 0, ... }` e `{ price: 0, change: 0 }` dos catch do frontend.

**Como testar.** Simular falha do Open Interest e confirmar que a análise sai completa, com o Open
Interest indisponível e o log registrado. Confirmar que três tentativas foram feitas.

---

## 23. Preço do rompimento de figura

**Arquivos.** `app/Support/GenesisDecisionSchema.php`,
`app/Services/GraphicalAnalysis/GenesisPrompt.php` e `app/Support/GenesisVisualCatalogV6.php`

**Hoje.** Os campos `preco_base`, `preco_topo` e `preco_rompimento` só existem nos arquivos
congelados `V67Baseline`. No pipeline vivo, a IA pode dizer "triângulo rompido" e ninguém confere
onde.

**Muda para.** O fluxo completo das figuras:

```
1. A visão identifica uma possível figura
2. O PHP valida o ID contra o catálogo fechado das 50 figuras
3. O PHP valida geometria, confiança e campos obrigatórios
4. Figura não validada é descartada e registrada no log
5. Figura validada pode fornecer o preço visual de rompimento
6. Se o preço não puder ser observado com segurança, fica null
7. O PHP valida a coerência do preço de rompimento
8. A IA interpreta a figura validada junto com o restante
```

**A visão observa o preço da figura. O backend valida. O backend nunca cria o preço visual.**

**Como o PHP valida.** Contra os dados reais de mercado, a geometria da figura e a estrutura
disponível. **O fechamento da vela pode ser usado como evidência adicional quando tecnicamente
pertinente, mas não é condição universal para reconhecer ou interpretar um rompimento.**

**Regra sobre ausência.**

```
preco_rompimento = null

NÃO significa   rompimento = false
SIGNIFICA       rompimento não validado ou não avaliado
```

A figura pode continuar registrada como figura observada. **Ausência de informação não é resultado
negativo.**

**Como testar.** Injetar um ID de figura fora do catálogo e confirmar que é descartado e registrado.
Injetar figura válida com `preco_rompimento = null` e confirmar que o rompimento fica não avaliado,
não negado.

---

## 24. Tudo respeita o tempo gráfico escolhido

**Arquivos.** Vários

**Muda para.** Derivados do tempo gráfico analisado:

```
velas, indicadores, ATR, pivôs, estrutura, níveis, horizonte,
piso e espaçamento de alvo, teto de alvo e de stop,
tempos superiores, tolerância de agrupamento
```

**Como testar.** Rodar o mesmo ativo em 15m e em 1d e confirmar que os pisos, tetos e pivôs são
diferentes.

---

# BLOCO 5: DERIVATIVOS E CONTEXTO

## 25. Squeeze exige evidências mínimas

**Arquivo.** `app/Services/DerivativesReadingService.php`, método `squeezeRisk()`

**Hoje.** O método recebe apenas `$crowding`, derivado só do z-score do funding. Nem preço nem Open
Interest entram. Funding esticado com Open Interest caindo é gente fechando posição, o contrário de
squeeze. E o squeeze pesa 10 pontos contra 5 do quadrante: é o sinal de maior peso e o pior
condicionado.

**Muda para.** Squeeze exige as evidências mínimas: funding esticado, mais Open Interest alto ou
subindo, mais preço rompendo ou perdendo nível, mais liquidez relevante do outro lado.

Faltando evidência:

```
squeeze = NOT_EVALUATED
ou
squeeze = UNAVAILABLE
```

**Isso não impede análise técnica, direção, intensidade, stop, alvos, Plano A ou Plano B.**

**Como testar.** Funding em 0.08% com Open Interest caindo 15% e preço lateral não ativa a flag.

---

## 26. Derivativos degradam por parte

**Arquivo.** `DerivativesReadingService.php`

**Hoje.** É tudo ou nada. Faltando um pedaço, o bloco inteiro vai para indisponível.

**Muda para.**

| O que veio | O que continua funcionando |
|---|---|
| Funding e Open Interest | quadrante completo e squeeze completo |
| Só funding | leitura de lotação, squeeze não avaliado |
| Só Open Interest | leitura de posicionamento, sem lotação |
| Nada | ver abaixo |

**Quando nada estiver disponível:**

```
bloco                = UNAVAILABLE
modificador          = null
aplicar_modificador  = false
```

**Nunca `modificador = 0`.** Zero significa que os derivativos foram avaliados e o efeito é neutro.
Ausência de dado é outra coisa, e guardar as duas como o mesmo número torna impossível distinguir
uma da outra depois.

Dois campos separados na saída: `avaliado` e `resultado`.

**Como testar.** Remover o Open Interest e confirmar que o funding continua sendo lido. Remover os
dois e confirmar que o modificador sai como `null`, não como `0`.

---

## 27. Derivativos deixam de se contradizer

**Arquivos.** `DerivativesReadingService.php:157-159` e `ScoreNarrativeBuilder.php:63`

**Hoje.**

```php
$modifier > 3  => 'STRENGTHENS',
$modifier < -3 => 'WEAKENS',
default        => 'NEUTRAL',
```

A faixa morta de −3 a +3 não existe no normativo, linha 1177, que manda classificar por sinal. Daí a
frase "Derivativos não alteram o cenário (−3 pontos)", que se nega.

**Muda para.**

```
efeito positivo  ->  reforça a intensidade
efeito negativo  ->  reduz a intensidade
efeito zero      ->  neutro
```

**E a pontuação interna sai da tela.** Fica no log. Na tela fica só a leitura de intensidade.

**Como testar.** Um modificador de −3 produz texto de redução de intensidade, sem número. Nenhum
texto público contém pontuação interna.

---

## 28. Instrução de contexto sem contradição

**Arquivo.** `app/Services/GraphicalAnalysis/GeminiContextService.php:305`

**Hoje.** A instrução abre com:

> "Você NÃO decide direção, **NÃO atribui score**, NÃO sugere entrada..."

E doze linhas depois pede "SCORE DO SENTIMENTO (0 a 100)" e "SCORE MACRO (0 a 100)". O modelo obedece
à proibição e os dois cards ficam vazios.

**Muda para.** A proibição vira específica:

> "não decide direção nem atribui score técnico"

Os scores de contexto ficam explicitamente autorizados.

**Isso não afeta o cérebro, que continua decidindo direção e intensidade normalmente.**

**Regra.** Prompt corrigido **não significa** fonte sempre disponível. Quando houver dados de
contexto disponíveis, a correção permite que Macro e Sentimento sejam preenchidos normalmente. Se a
fonte estiver indisponível, o card permanece como Indisponível e a causa fica registrada no log.

**Como testar.** Rodar com o contexto populado e confirmar que os dois cards trazem score. Rodar com
a fonte fora e confirmar que os cards saem como Indisponível com log.

---

## 29. RESTAURAR SENTIMENTO DO ATIVO E MACRO E GEOPOLÍTICO

**Este item não é opcional e precisa continuar funcionando depois de todas as outras mudanças.**

**Arquivo.** `app/Services/GraphicalAnalysis/GeminiContextService.php`

**Hoje.** Um único serviço lê a tabela do Radar News, separa em dois montes por `separarEventos()` e
manda os dois numa chamada só. **Não existe busca em fóruns, redes sociais nem fontes macro
próprias.** Nenhuma ferramenta de busca é passada ao modelo. Se o Radar News não tem matéria da
janela, os dois cards ficam vazios.

**Muda para.** Restaurar o comportamento da versão anterior em que os dois blocos buscavam em fontes
próprias, cada um com seu micro-resumo.

**É restauração, não desenvolvimento novo.** A versão em que isso funcionava está no histórico do
repositório.

```
Card Sentimento do Ativo
  busca em fontes próprias sobre o ativo analisado
  score do ativo
  prós e contras
  micro-resumo

Card Macro e Geopolítico
  busca em fontes próprias de contexto macro
  score macro
  micro-resumo

Bloco superior de sentimento de mercado
  permanece exatamente como está
  apenas visual
  não alimenta os dois cards do rodapé
```

**Regras obrigatórias.**

```
1. Macro e Sentimento não entram na direção
2. Não entram no score técnico
3. Não entram nos alvos nem na execução
4. Falha de fonte gera UNAVAILABLE com log detalhado, nunca dado inventado
5. O frontend nunca busca um segundo contexto para sobrescrever o persistido
```

**Exigência visual.** Os textos restaurados respeitam a fonte, os tamanhos e a paleta já em uso.
**Nenhum card pode ficar desproporcional em relação aos demais**, como já ocorreu em entregas
anteriores. O micro-resumo é curto por definição: se o texto crescer além do espaço do card, ele é
truncado, e não é o card que se expande.

**Como testar.** Os dois cards trazem conteúdo próprio quando as fontes estão disponíveis. Com a
fonte fora, saem como Indisponível. O layout permanece proporcional em ambos os casos.

---

# BLOCO 6: TEXTO E TELA

## 30. Filtro público em todas as superfícies

**Arquivo.** `app/Jobs/GraphicalAnalysisAttemptJob.php`

**Hoje.** O `PublishedOutputGate` roda em três lugares: resumo macro, narrativa de sentimento e
descrição do score.

**Muda para.** Aplicar em:

```
análise técnica
textos dos alvos
Plano A
Plano B
avisos e limitadores
microanálises
demais textos públicos
```

Continua **não bloqueando a análise inteira**, só limpando e registrando.

**Como testar.** Nenhum código interno chega à tela em qualquer superfície.

---

## 31. Códigos internos traduzidos

**Arquivos.** `TargetCandidateCatalog.php:307` e `ScoreFinalizer.php:143`

**Hoje.**

```php
// TargetCandidateCatalog:307
return $confluentes === [] ? $base : $base.' · coincide com '.implode(' e ', $confluentes);
```

O `match` acima traduz somente a fonte primária. As confluências entram cruas. E
`ScoreFinalizer:143` despeja as chaves de evidência.

**Muda para.** As confluências e as chaves passam pelo mesmo `match`.

```
Hoje:    coincide com pdh_pdl e hvn e numero_redondo
Depois:  coincide com máxima do dia anterior, nó de alto volume e número redondo
```

**Como testar.** Buscar `numero_redondo`, `pdh_pdl`, `hvn` e `open_interest_history` em qualquer
campo público e não encontrar.

---

## 32. Contradição factual não é publicada

**Arquivos.** `GraphicalAnalysisAttemptJob.php:466` e `PublishedOutputGate.php`

**Hoje.** A regra que compara o texto escrito com a estrutura calculada recebe o `structure_event`
sempre nulo, e `contradizEstrutura()` retorna `false` na primeira linha quando é nulo. **Nunca
executou.** Por isso "o CHoCH acima de $65,482.70 projeta continuidade da fase de markup" nunca foi
conferido.

**Muda para.** O `structure_event` passa a ser entregue ao gate no formato esperado. E, quando houver
contradição factual:

```
1. a análise inteira não é derrubada
2. a ocorrência é registrada no log
3. a afirmação conflitante não é publicada como está
4. somente aquela afirmação é removida ou neutralizada
5. o restante válido da análise continua
```

**Exemplo.**

```
Backend:      CHoCH = não confirmado
Texto da IA:  "Houve CHoCH em $65,500.00."

Correto:      a frase não chega ao frontend como fato confirmado
              a ocorrência vai para o log
              o restante da análise continua
```

**Princípio.** O gate continua não bloqueando a análise inteira, **mas não pode permitir que uma
afirmação factual contraditória seja publicada sem tratamento.**

A IA tem liberdade de interpretação. Ela pode interpretar que existe pressão compradora. Mas
afirmação factual precisa estar sustentada pelos dados recebidos.

**Como testar.** Injetar texto afirmando rompimento de baixa com estrutura calculada de alta e
confirmar que a afirmação não é publicada e a ocorrência é registrada.

---

## 33. CHoCH somente quando validado

**Arquivo.** `app/Services/MarketStructureService.php` e o contexto da IA

**Muda para.**

```
detector PHP confirmou  ->  entra no contexto
não confirmou           ->  não entra
```

Simples assim. **Não criar nova dependência universal de candle para toda a análise.**

A linguagem registra o que aconteceu:

> O fechamento acima de $65,482.70 caracteriza mudança de estrutura de baixa para alta.

Nunca projeta.

**Como testar.** CHoCH não confirmado não aparece em nenhum texto público, e a tela não avisa que
faltou.

---

## 34. Backend nunca aparece na tela

**Arquivos.** `components/AnalysisResult.tsx` e contrato de saída

**Muda para.** Quatro comportamentos separados, para não esconder o que o membro precisa:

| Situação | Comportamento |
|---|---|
| Campo opcional ausente | a linha não renderiza |
| Card obrigatório sem dado | o card aparece com "Indisponível" |
| Stop indisponível | o código some, o aviso humano aparece |
| Fallback estrutural | o código some, a consequência aparece |

**Stop indisponível:**

> Stop estrutural indisponível. Não foi identificado um nível de proteção com lastro dentro do
> horizonte operacional desta análise. Se decidir executar a entrada, defina o stop de acordo com a
> sua estratégia antes de dimensionar a posição.

**Fallback estrutural:**

> Stop baseado em estrutura de proteção disponível. Não foi identificada uma âncora específica que
> invalide esta entrada. Atenção: confirme se esse nível é compatível com a sua estratégia e com o
> risco que pretende assumir antes de executar.

**Regra.** Código interno some. Informação necessária para a decisão do membro não some.

**Como testar.** Nenhuma ocorrência de código de estado, `candidate_id`, `error_code`, nome de
serviço ou endpoint em texto destinado ao usuário.

---

## 35. Um único formato de dinheiro

**Arquivos.** `ExecucaoService.php:841-842` e `components/AnalysisResult.tsx:997`

**Hoje.** Quatro formatos na mesma tela:

```
$ 77,719.2      americano, correto
$ 0,00          brasileiro, de number_format(2, ',', '.') dentro de frase
$ 69.155,82     brasileiro, escrito pela IA
$2043.8896      toFixed(4) cru, sem separador
```

O mesmo número aparece de dois jeitos: a EMA 21 sai `$ 69,155.8` nas métricas e `$ 69.155,82` no
texto.

**Muda para.** Formatador canônico único e precisão pelo `tickSize` do contrato.

```
BTCUSDT    tickSize 0.1         $69,155.8
ETHUSDT    tickSize 0.01        $3,241.57
ENAUSDT    tickSize 0.0001      $0.4182
PEPEUSDT   tickSize 0.0000001   $0.0000200
```

**Nem o backend nem a IA formatam número.** Mandam o valor puro, a tela formata.

**Apagar** o `number_format` do backend dentro de strings públicas e o `toFixed(4)` do ATR.

**Atenção.** A abreviação em K, como `$75.5K`, vale **apenas para documentos e exemplos
explicativos**, para evitar que alguém leia `$77.5` como setenta e sete dólares e cinquenta. **Ela
não vale para os campos numéricos da interface.**

**Como testar.** Um único formato em toda a tela. O ATR sai como `$2,043.9`, não `$2043.8896`.

---

## 36. Timeframes por extenso

**Arquivo.** Componente de chips do frontend

**Hoje.** Os chips mostram `1W` e `1M`, e `1M` é ambíguo com um minuto. O normalizador só alcança
texto livre.

**Muda para.**

```
1W  ->  semanal
1M  ->  mensal
```

**Como testar.** Nenhum chip com `1M` cru na tela.

---

## 37. Funding com a semântica correta

**Arquivo.** `DerivativesReadingService::crowding()`

**Hoje.**

```php
$side = ... ($fundingRate > 0 ? 'COMPRADA' : 'VENDIDA');
```

Todo contrato de futuro tem uma ponta compradora e uma vendedora. Nunca há mais de um lado.

**Muda para.** A linguagem reflete custo e lotação relativa do lado comprado, não maioria de
contratos.

**Como testar.** Nenhum texto público afirma que há mais compradores que vendedores.

---

## 38. Ícone da criptomoeda

**Arquivo.** `components/AnalysisResult.tsx`

**Hoje.** A tela mostra "BTC" em texto puro. Determinação de 28/07, nunca recolhida.

**Muda para.** Ícone do ativo ao lado do nome.

**Como testar.** O ícone aparece.

---

# BLOCO 7: PLANOS

## 39. Cada plano com seus próprios números

**Arquivos.** `ExecucaoService.php:301` e `:416`, e `PlanoBService.php:198`

**Hoje.** As duas linhas jogam os avisos do Plano A e do Plano B na mesma lista global, sem
deduplicação. Os dois deram tamanho zero, geraram as mesmas duas frases, e a tela imprimiu quatro
linhas.

E `PlanoBService.php:198`:

```php
$zonaAte = min($zonaAte, round($precoAtual * 0.999, 8));
```

$77,719.20 × 0.999 = $77,641.48. A tela rotulou a faixa inteira como "Fundo/topo do swing de
18/05/2026".

**Muda para.** Cada plano carrega seus próprios:

```
entrada, stop, alvos, risco, liquidação, R:R,
avisos, microanálise, limitadores, recomendação
```

Com deduplicação. Clicar no Plano B troca tudo junto.

**Apagar** o clamp `precoAtual * 0.999` como borda de zona. **Proibido** criar borda artificial e
rotular como nível estrutural real. Cada borda carrega sua origem. Havendo apenas uma referência
estrutural, é nível e não zona.

**Como testar.** O bloco de limitadores nunca repete a mesma frase. Nenhuma borda de zona é derivada
do preço atual.

---

## 40. Plano A e Plano B

### Plano A

**Plano A é a entrada no preço atual.**

A IA deve deixar claros os riscos de entrar naquele momento, quando existirem:

```
entrada sem validação suficiente
rompimento ainda sem confirmação suficiente
reteste ainda não confirmado
preço esticado após movimento forte
barreira estrutural próxima
entrada dentro ou próxima de VRVP ou HVN
risco de antecipação
```

**Exemplos de linguagem:**

> Entrada no preço atual, porém ainda sem confirmação suficiente de reteste.

> Entrada a mercado em região tecnicamente esticada após o movimento de alta.

> Entrada no preço atual com resistência próxima, reduzindo o espaço imediato da operação.

**Plano A não é o plano errado. É a entrada a mercado com os riscos daquele momento explicitados.**

### Plano B

**Plano B é o plano técnico com confirmação.**

**Ele não depende de uma única regra universal de fechamento de vela.** A confirmação depende do
contexto que a IA está interpretando.

A IA pode considerar: rompimento, reteste, reação em suporte, rejeição em resistência, recuperação de
nível, figura validada, VRVP, HVN, LVN, volume, fluxo, estrutura, momentum e demais evidências reais
disponíveis.

**O nível ou região de entrada precisa ser real e fornecido pelo backend.** A IA explica o que
precisa acontecer antes da entrada.

**Exemplos de linguagem:**

> Aguardar reação compradora na região de suporte antes da entrada.

> Aguardar reteste da região rompida com confirmação de sustentação antes da entrada.

> Aguardar rejeição na região de resistência antes de considerar a entrada vendida.

> Aguardar retorno à região de HVN e resposta compradora antes da entrada.

> Aguardar reteste da figura rompida e confirmação de continuidade antes da entrada.

**Regra.** A IA define a confirmação técnica conforme os fatos disponíveis. O backend não impõe uma
confirmação universal para todos os setups.

O Gênesis é analítico e educacional. Ele não precisa virar um motor automático de execução de ordens.

**Como testar.** Rodar cinco setups diferentes e confirmar que as confirmações do Plano B variam
conforme o contexto.

---

# BLOCO 8: TESTE

## 41. Teste de aceite real

**Arquivo.** `tests/Feature/AceiteVisualV69Test.php`

**Hoje.**

```php
public function test_aceite_visual_btcusdt(): void {
    $this->rodarAceite('BTCUSDT','1d',
        'C:\\Users\\felip\\Downloads\\BTCUSDT.P_2026-08-16_21-13-21 (1).png',
        'aceite-btcusdt.json');
    self::assertTrue(true);
}
```

Dois problemas: a asserção é `assertTrue(true)`, então passa com qualquer resultado, e o caminho
aponta para uma pasta que não existe no repositório, então o teste nunca roda em outra máquina.

**Muda para.**

```
1. Apagar assertTrue(true)
2. Versionar as imagens de aceite no repositório
3. Asserções que verificam comportamentos reais
4. Testes unitários para as funções matemáticas críticas
```

**O teste visual não substitui os testes matemáticos.** Funções que precisam de teste unitário
próprio:

```
piso e teto de alvo
espaçamento entre alvos
validação de alvo depois da escolha da IA
origem exclusiva EMA proibida
teto de stop: normal, ampliado e rejeitado
buffer integral e proibição de corte
ausência versus zero
dimensionamento abaixo do lote mínimo
tickSize e casas decimais
retry, backoff e timeout
frescor por timeframe
degradação parcial dos derivativos
modificador null quando derivativos indisponíveis
validação de figura contra o catálogo das 50
rollover de vela
contradição factual não publicada
```

**Formulação correta do resultado.** A suíte comprova somente os comportamentos cobertos por suas
asserções. Ela dá evidência automática dos comportamentos críticos cobertos, e qualquer regressão nas
regras testadas quebra a suíte. Ela não é prova de algo que não possui asserção correspondente.

**Como testar.** Quebrar deliberadamente cada uma das regras acima e confirmar que a suíte acusa.

---

# PARÂMETROS DE CONFIGURAÇÃO

Todos recalibráveis sem tarefa de desenvolvimento. Nenhum aparece na tela.

| Parâmetro | Valor |
|---|---|
| Piso do alvo | `max(tickSize × 4, ATR × 0.25)` |
| Espaçamento entre alvos | 0.50 ATR |
| Agrupamento de níveis | 0.15 ATR |
| Teto do alvo | ATR × horizonte do timeframe |
| Teto do stop, normal | 3.0 ATR |
| Teto do stop, ampliado | 4.5 ATR |
| `LIQUIDATION_CONFLUENCE_MIN_INTENSITY` | 0.70 |
| `DATA_FETCH_MAX_ATTEMPTS` | 3 |
| `DATA_FETCH_RETRY_BACKOFF_MS` | [250, 500] |
| `DATA_FETCH_TIMEOUT_MS` | 5000 |
| `RECENCY_WINDOW_CANDLES` | 120 · parâmetro existente e aprovado, mantido como está |
| Piso do pool de fallback do stop | 0.5 ATR |

---

# ORDEM DE EXECUÇÃO

| Ordem | Itens | Motivo |
|---|---|---|
| 1 | 41 | Sem teste real, nada do resto é verificável |
| 2 | 1, 2, 3, 8 | Corrigem o TP1 colado e o R:R zerado |
| 3 | 9, 10, 11, 12 | Corrigem o stop a 19.46% |
| 4 | 15, 14 | Corrigem o tamanho zerado e o risco zero |
| 5 | 19, 20 | Alinham a tela com o gráfico do membro |
| 6 | 16, 17, 18 | Fecham liquidação e alavancagem |
| 7 | 4, 5, 6, 7, 13 | Completam alvos e stop |
| 8 | 21, 22, 23, 24 | Dados e tempo |
| 9 | 25, 26, 27, 28, **29** | Derivativos e contexto |
| 10 | 30 a 40 | Texto, tela e planos |

**Os itens 1, 9, 10, 11, 15 e 19 concentram os maiores defeitos visíveis do caso auditado.** Outros
itens também alteram a interface, entre eles 17, 27, 29, 31, 35, 38, 39 e 40.

---

# O RESULTADO NA TELA DO BTCUSDT

| Campo | Hoje | Depois |
|---|---|---|
| Variação | 0.00% | +0.85% |
| EMA 21 | $69,155.8 | $68,301.6 |
| TP1 | $77,720.3, a $1.10 da entrada | nível estrutural válido selecionado pela força, respeitando o piso |
| R:R | 1:0.00 | valor real |
| Stop | $62,594.9, a 19.46% | nível real que sustenta ou invalida a entrada, dentro das regras de ATR |
| Quantidade | 0 BTC | quantidade real, ou os quatro números |
| Risco | $0.00 | valor real, ou nulo |
| Margem | $0.00 | valor real, ou nulo |
| Liquidação | — | valor com bracket real quando disponível; Indisponível quando a fonte não estiver |
| Limitadores | quatro linhas repetidas | duas linhas, do plano ativo |
| Textos dos alvos | `numero_redondo`, `pdh_pdl e hvn` | português |
| Formatos de dinheiro | quatro na mesma tela | um |
| Macro e Sentimento | INDISPONÍVEL | conteúdo próprio quando disponível; Indisponível em caso de falha |
| Derivativos | "não alteram (−3 pontos)" | texto coerente com o efeito calculado, sem pontuação e sem contradição |
| Ícone do ativo | ausente | presente |

---

# CLASSIFICAÇÃO DE MUDANÇAS FUTURAS

Qualquer sugestão nova precisa ser classificada antes de virar requisito.

**A. BUG REAL.** Corrigir obrigatoriamente. Exemplos: TP colado na entrada, risco virando zero, Open
Interest ausente virando zero, margem de manutenção duplicada, IA inventando preço, backend
aparecendo no frontend, Plano A e Plano B misturando dados, figura não validada entrando no contexto.

**B. REGRA DE PRODUTO.** Implementar conforme decisão do PO. Exemplos: Plano A a mercado, Plano B
técnico com confirmação, LONG ou SHORT obrigatório, derivativos modulando intensidade.

**C. COMPLEXIDADE ADICIONAL.** Não transformar automaticamente em requisito nem em bloqueador.
Exemplos: máquina extensa de estados para Plano B, motor independente para cada tipo de invalidação,
dependência universal de fechamento de vela, subsistema novo sem relação direta com bug identificado.

**Desvio do normativo passa a exigir aprovação explícita, não comentário no código.**

---

# FORMULAÇÃO FINAL

> O Gênesis coleta, calcula e valida dados reais. A visão identifica elementos do gráfico e o PHP
> valida as figuras contra o catálogo fechado das 50 figuras. Tudo que estiver validado e disponível
> é entregue à IA. A IA funciona como o trader: interpreta o conjunto, relaciona as evidências e
> decide LONG ou SHORT com sua intensidade. Ela nunca pode inventar fatos, preços, níveis, figuras,
> indicadores, stops ou alvos. Se uma fonte falhar, o valor fica null ou UNAVAILABLE, nunca zero, a
> falha é registrada detalhadamente nos logs e a análise continua utilizando as demais evidências.
> Nenhuma informação técnica interna do backend aparece no frontend. A vela é uma evidência da
> análise, não uma pré-condição universal para o funcionamento do sistema. Plano A representa a
> entrada no preço atual com seus riscos explicitados. Plano B representa a alternativa técnica, em
> nível ou região real, com a confirmação definida pela IA conforme o contexto técnico efetivamente
> observado.

---

*Documento gerado em 24/08/2026. 41 correções, todas com o defeito localizado no código, o que muda,
o que apagar e como testar.*
