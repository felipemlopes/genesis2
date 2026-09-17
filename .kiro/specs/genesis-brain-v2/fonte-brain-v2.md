# Gênesis Brain V2
## Especificação técnica completa para implementação por Felipe

**Status:** especificação consolidada para implementação
**Base auditada:** backend `genesis-api-genesis2 (47)(1).zip` e frontend `genesis2-master (33)(1).zip`
**Objetivo:** tornar o Gênesis mais preditivo, mais simples no caminho decisório, menos sujeito a falhas artificiais e sem permitir que lógica legada interfira no novo Brain.

> Esta especificação substitui, para o Brain V2, regras anteriores que entrem em conflito com o que está definido aqui.
> Nenhuma regra legada deve continuar influenciando `direction`, `score`, Plano A, Plano B, stop, TPs ou recomendação operacional sem estar explicitamente aprovada neste documento.

---

# 1. Objetivo central

O Gênesis não deve tentar recriar em PHP o julgamento que contratamos a IA para fazer.

O fluxo estratégico passa a ser:

```text
DADOS REAIS
+
EVOLUÇÃO DOS DADOS
+
LEITURA VISUAL DO GRÁFICO
        |
        v
TRADER AI
        |
        +--> LONG ou SHORT
        +--> score de força direcional
        +--> regime e caráter do movimento
        +--> drivers a favor e contra
        +--> Plano A
        +--> Plano B
        +--> stop sugerido
        +--> ranking de alvos reais
        |
        v
BACKEND
matemática operacional determinística
        |
        +--> RR
        +--> sizing
        +--> margem
        +--> risco
        +--> liquidação
        +--> custos
        |
        v
FRONTEND
exibe somente o essencial
        |
        v
OUTCOMES
medem o que realmente aconteceu depois
```

Princípio obrigatório:

> **PHP calcula fatos e matemática. A IA interpreta o mercado. O PHP não volta a ser trader depois da IA.**

---

# 2. O que o Brain V2 NÃO será

O Brain V2 não pode virar o sistema antigo com nomes novos.

É proibido voltar para um fluxo como:

```text
Indicador
-> classificação fixa
-> peso
-> soma
-> score
-> direção
```

Também é proibido:

- atribuir peso fixo a EMA, RSI, CVD, OI, ADX, funding ou qualquer outro indicador;
- manter pesos globais como 30/28/28/14 para determinar score;
- somar indicadores bullish e bearish para decidir LONG ou SHORT;
- usar `score_familias` para reconstruir a opinião da IA;
- alterar a direção da IA depois dela ser aceita;
- reduzir automaticamente o score porque um indicador secundário não chegou;
- transformar dado ausente em zero;
- obrigar a existência de três TPs;
- fabricar stop ou alvo apenas para melhorar RR;
- refazer toda a análise porque o membro alterou alavancagem ou stop;
- deixar macro, geopolítica, sentimento ou Radar News alterarem silenciosamente a direção técnica.

---

# 3. Regra inviolável de direção

A IA deve sempre retornar:

```text
LONG
```

ou:

```text
SHORT
```

`NEUTRO` é proibido no Brain V2.

A IA decide a direção interpretando o conjunto completo das evidências disponíveis.

O backend pode validar o contrato, os fatos e a integridade da resposta, mas não pode recalcular a direção.

Regra de aceite:

> Depois que `direction` foi validado como `LONG` ou `SHORT`, nenhuma camada de score, RR, stop, alavancagem, target, macro, sentimento ou family weighting pode inverter esse campo.

Um RR ruim pode impedir a execução de um LONG. Ele não pode transformar LONG em SHORT.

---

# 4. Regra final do score

## 4.1 Semântica

O score representa o **grau de convicção relativa da direção vencedora** que a IA já escolheu entre LONG e SHORT.

O ponto teórico de equilíbrio é 50, mas ele nunca é publicado porque o Brain V2 precisa escolher um lado. A saída publicável começa em 55.

Exemplos:

```text
LONG 55
LONG 75
LONG 90

SHORT 55
SHORT 75
SHORT 90
```

`LONG 80` e `SHORT 80` possuem a mesma intensidade. Só muda a direção.

O score não é um eixo no qual zero significa SHORT e 100 significa LONG.

---

## 4.2 Valores válidos

O backend aceita exclusivamente:

```text
55
60
65
70
75
80
85
90
```

Regras:

```text
score >= 55
score <= 90
score % 5 == 0
```

O conjunto permitido deve ser fechado:

```php
public const GENESIS_V2_VALID_SCORES = [
    55, 60, 65, 70, 75, 80, 85, 90,
];
```

Validação:

```php
$score = $decision['score'] ?? null;

if (! in_array($score, self::GENESIS_V2_VALID_SCORES, true)) {
    throw new SemanticDecisionContractException(
        code: 'GENESIS_V2_INVALID_SCORE',
        repairable: true,
        field: 'score'
    );
}
```

Score inválido é **erro semântico reparável**, não falha de transporte e não motivo para repetir visão/coleta.

Exemplo:

```text
score = 73
```

deve gerar repair do output estruturado utilizando o mesmo bundle já validado.

---

## 4.3 Por que 50 não existe

`50` representa o ponto teórico de equilíbrio entre LONG e SHORT.

Como o Brain V2 não publica NEUTRO, `50` não é uma saída válida.

A menor vantagem relativa publicável da direção vencedora é `55`.

Isso não significa que 55 seja uma operação boa. Significa apenas que um lado venceu por pouco. O piso operacional continua sendo 60.

---

## 4.4 Teto

O Brain publica no máximo `90`.

O frontend pode continuar com barra visual de `0 a 100`.

Portanto:

```text
backend máximo = 90
frontend escala = 0 a 100
```

O espaço entre 90 e 100 representa visualmente a margem de incerteza que o Gênesis nunca elimina.

O frontend deve desenhar exatamente o valor recebido.

Não deve normalizar `90` para `100`.

---

## 4.5 Piso operacional

Piso padrão para uma operação ser considerada elegível:

```text
score >= 60
```

Isso NÃO significa autorização automática.

Uma operação com score 60 ou mais ainda depende de:

- stop válido;
- entrada válida;
- alvo elegível;
- RR mínimo;
- alavancagem válida;
- liquidação calculável quando aplicável;
- gatilho do plano, quando houver.

Exemplo:

```text
Direction: LONG
Score: 85
RR1: 0,42
```

Resultado correto:

```text
Direção: LONG
Força: 85
Execução atual: não elegível pelo RR
```

Resultado proibido:

```text
Mudar LONG para SHORT porque o RR é ruim.
```

---

## 4.6 Como a IA escolhe o score

A IA escolhe um dos oito valores válidos por julgamento contextual.

Não existe soma de pontos.

Ela deve considerar qualitativamente:

1. convergência das principais evidências;
2. existência de transição ou aceleração real;
3. timing do movimento;
4. relevância das evidências contrárias;
5. qualidade e suficiência do conjunto disponível;
6. coerência entre preço, fluxo, derivativos e estrutura;
7. risco de o sinal ser apenas atraso ou ruído.

Escala orientativa:

| Score | Interpretação |
|---:|---|
| 55 | vantagem direcional marginal, leitura muito fraca |
| 60 | leitura fraca, mas já existe vantagem operacional mínima |
| 65 | leitura moderada |
| 70 | leitura moderada para forte |
| 75 | leitura forte |
| 80 | leitura muito forte |
| 85 | convergência muito alta e poucas contradições relevantes |
| 90 | leitura excepcional, rara, máxima força permitida |

Isso é orientação sem aritmética.

É proibido fazer:

```text
CVD +10
OI +10
ADX +5
EMA -5
```

---

## 4.7 Score não calibrado não deve ser vendido como estatística comprovada

Neste momento o score é a força direcional estimada pelo Brain.

Ele ainda não é uma probabilidade estatística calibrada por histórico.

O frontend pode continuar chamando de `Score`.

Internamente, evitar prometer que `80` significa exatamente 80% de acerto.

No futuro, os outcomes permitirão calibrar a relação entre score e taxa real de acerto.

---

# 5. Zero, null, ausência e não aplicável

Esta distinção é obrigatória em todo o pipeline.

## 5.1 ZERO

Zero é um valor.

Exemplos possíveis:

```text
funding = 0
OI_delta = 0
MACD_histogram = 0
CMF = 0
return = 0
```

Se a fonte realmente entregou zero, o Brain deve receber zero.

---

## 5.2 NULL

`null` significa que o valor não foi obtido ou não pôde ser calculado.

Exemplo:

```json
{
  "status": "UNAVAILABLE",
  "value": null
}
```

`null` nunca pode ser convertido silenciosamente para zero.

---

## 5.3 NOT_PRESENT

Usado quando algo foi verificado e simplesmente não existe naquele contexto.

Exemplo:

```json
{
  "status": "NOT_PRESENT",
  "value": null
}
```

Casos:

- não existe Fibonacci desenhado;
- não existe figura gráfica clara;
- não existe Volume Profile visível;
- não existe LTA/LTB clara.

Isso não é falha técnica.

---

## 5.4 NOT_APPLICABLE

Usado quando o dado não faz sentido para aquela análise.

Exemplo:

```json
{
  "status": "NOT_APPLICABLE",
  "value": null
}
```

Exemplo de uso inicial:

- trade flow ultracurto em análise semanal.

---

## 5.5 Estados canônicos

Usar:

```text
AVAILABLE
UNAVAILABLE
NOT_PRESENT
NOT_APPLICABLE
```

Exemplo com zero válido:

```json
{
  "funding": {
    "status": "AVAILABLE",
    "value": 0
  }
}
```

Exemplo com falha:

```json
{
  "funding": {
    "status": "UNAVAILABLE",
    "value": null
  }
}
```

---

## 5.6 Padrões gráficos

Visão executou e não encontrou figura:

```json
{
  "patterns": {
    "status": "AVAILABLE",
    "value": []
  }
}
```

Visão falhou:

```json
{
  "patterns": {
    "status": "UNAVAILABLE",
    "value": null
  }
}
```

Esses estados não podem ser confundidos.

---

# 6. Auditoria obrigatória contra coerções de null para zero

Felipe deve procurar e revisar, em campos estratégicos:

### PHP

```php
(int) $value
(float) $value
empty($value)
$value ?: $fallback
```

### JavaScript/TypeScript

```ts
if (!value)
value || fallback
Number(null)
```

Nos casos em que zero é válido, usar verificações explícitas:

```php
$value === null
$value !== null
```

e:

```ts
value === null
value !== null
```

ou, preferencialmente, verificar `status`.

---

# 7. Bug já confirmado: score null vira zero

Na versão auditada:

`ScoreFromFamilies` pode produzir `score = null`.

Depois:

```php
$decision['score'] = $scoreResult['score'];
```

Mas em `AnalysisPersistenceService.php` existem casts como:

```php
(int) $decision['score']
```

Na versão auditada há pelo menos dois pontos estratégicos:

```text
AnalysisPersistenceService.php:150
AnalysisPersistenceService.php:226
```

O efeito do PHP é:

```php
(int) null === 0
```

Isso é proibido no V2.

Correção:

```php
$score = $decision['score'] ?? null;

if (! is_int($score) || ! in_array($score, GenesisDecisionSchema::GENESIS_V2_VALID_SCORES, true)) {
    throw new \RuntimeException('GENESIS_V2_SCORE_CONTRACT_INVALID');
}
```

Depois disso, passar `$score` sem cast destrutivo.

No V2, uma análise concluída deve necessariamente ter um score válido de 55 a 90.

Se a IA não devolver score válido, é erro de contrato da resposta, não score zero.

---

# 8. Regra de dados ausentes

A ausência de um indicador secundário:

- não invalida a análise;
- não gera zero;
- não gera voto contrário;
- não reduz automaticamente o score;
- não deve ser mencionada no texto público;
- gera log técnico no backend.

Exemplo:

```text
OI indisponível
```

Comportamento:

```text
não entra no bundle decisório como valor;
não aparece na narrativa;
fica no log;
a IA trabalha com os demais dados.
```

Dados mínimos realmente críticos devem ser poucos.

Recomendação inicial para uma análise ser tecnicamente possível:

- símbolo válido;
- timeframe válido;
- gráfico aceito quando a análise depende da imagem;
- candles suficientes;
- preço atual ou último preço válido;
- pelo menos estrutura técnica mínima suficiente para o Brain raciocinar.

Todo o restante deve degradar de forma segura.

---

# 9. Logs de dados ausentes

Formato mínimo:

```json
{
  "analysis_uuid": "uuid",
  "symbol": "BTCUSDT",
  "timeframe": "15m",
  "source": "open_interest",
  "status": "UNAVAILABLE",
  "error_code": "BINANCE_TIMEOUT",
  "provider": "BINANCE_USDM",
  "observed_at": null,
  "attempts": 3,
  "cache_age_seconds": null
}
```

O log deve ficar no backend.

Não adicionar ao texto público frases como:

```text
"Não foi possível obter OI."
```

---

# 10. Legacy Dependency Audit obrigatório

Esta etapa é obrigatória antes do Brain V2 assumir produção.

Todo componente que hoje toca em:

- direction;
- score;
- score_description;
- Plano A;
- Plano B;
- stop;
- targets;
- RR;
- recomendação operacional;

deve receber uma classificação:

```text
KEEP
REPLACE
REMOVE_FROM_DECISION_PATH
DELETE_AFTER_REPLACEMENT_VERIFIED
```

Modelo de tabela que Felipe deve preencher:

| Legado | Classificação | Substituto V2 | Consumidores migrados? | Testes verdes? | Pode excluir? |
|---|---|---|---|---|---|
| ScoreFromFamilies | DELETE_AFTER_REPLACEMENT_VERIFIED | score direto da Trader AI |  |  |  |
| score_familias | REMOVE_FROM_DECISION_PATH | drivers estruturados |  |  |  |
| score_breakdown legado | REMOVE_FROM_DECISION_PATH | decision_drivers |  |  |  |
| pesos 30/28/28/14 | DELETE_AFTER_REPLACEMENT_VERIFIED | nenhum |  |  |  |
| ScoreNarrativeBuilder legado | REPLACE | score_description V2 |  |  |  |

---

# 11. Regra de remoção segura do legado

Nenhum código deve ser apagado antes de provar que foi substituído.

Para cada remoção:

1. implementar o substituto;
2. criar testes do substituto;
3. migrar todos os consumidores;
4. buscar referências restantes com `rg`;
5. desativar o legado;
6. rodar testes;
7. executar análise completa;
8. confirmar que direção, score, planos e matemática V2 continuam funcionando;
9. confirmar compatibilidade de leitura de análises históricas;
10. só então deletar o código;
11. executar `rg` novamente;
12. confirmar que nenhum import, container binding, teste ou coluna ativa ainda depende dele.

Critério de aceite central:

> O Brain V2 deve conseguir executar uma análise completa com o mecanismo antigo de score desativado sem alterar `direction`, `score`, planos ou matemática operacional.

Se desativar a lógica antiga alterar o V2, ainda existe dependência escondida.

---

# 12. Regra contra campos legados ocultos

Nenhum campo legado pode ser lido pelo Brain V2 se ele não estiver declarado no contrato oficial de entrada V2.

Não aceitar dependência implícita.

Se um campo for mantido apenas para histórico ou shadow mode, usar nomes explícitos:

```text
legacy_direction
legacy_score
legacy_score_breakdown
```

Nunca:

```text
score
```

para dois significados diferentes.

---

# 13. Componentes legados específicos que precisam ser retirados do caminho V2

## 13.1 `ScoreFromFamilies.php`

Atual:

```text
estrutura = 30
order_flow = 28
derivativos = 28
momentum = 14
```

A classe não pode participar do V2.

Ação:

```text
REMOVE_FROM_DECISION_PATH imediatamente
DELETE_AFTER_REPLACEMENT_VERIFIED posteriormente
```

Se precisar temporariamente para benchmark, mover para namespace/pasta de legado ou chamar apenas de rotina explícita de comparação.

Nunca alimentar V2.

---

## 13.2 `score_familias`

Hoje é exigido pelo schema e validator.

No V2 deve sair do contrato obrigatório.

Substituir por:

- `score`;
- `primary_drivers`;
- `secondary_drivers`;
- `contrary_drivers`;
- `regime`;
- `movement_character`;
- `score_description`.

---

## 13.3 Pesos no `GenesisPrompt.php`

Remover instruções que dizem:

```text
Estrutura peso 30
Order Flow peso 28
Derivativos peso 28
Momentum peso 14
```

Remover também qualquer regra que force a IA a pensar nesses quatro blocos como votação numérica.

As famílias podem continuar como organização das evidências.

---

## 13.4 `ScoreNarrativeBuilder.php`

Se o microtexto continuar baseado em `score_breakdown` legado, deve sair do caminho V2.

Opções aprovadas:

1. a Trader AI devolve `score_description` curto e factual;
2. ou um renderer determinístico gera microtexto a partir de `primary_drivers`.

Não pode reconstruir score.

---

## 13.5 `DirectionCoherenceGate`

Pode permanecer apenas como:

```text
telemetria
auditoria
detecção de inconsistência
```

Não pode:

- mudar direction;
- reduzir score;
- aumentar score;
- virar voto posterior à IA.

Se não houver consumidor útil depois da migração, deletar após confirmação.

---

## 13.6 `RegimeService`

O regime final do Brain V2 é interpretação da IA.

O atual `RegimeService` pode, temporariamente, produzir um `regime_candidate` para auditoria, mas não pode decidir o regime final nem vetar direction.

Para reduzir ancoragem, a recomendação para produção V2 é:

- enviar as features objetivas de regime;
- deixar a IA interpretar;
- manter o antigo rótulo determinístico apenas em telemetria enquanto necessário.

---

## 13.7 `DerivativesReadingService`

Revisar qualquer campo subjetivo pré-julgado, como:

- crowding qualitativo;
- squeeze risk qualitativo;
- força derivada por regra fixa.

No Brain V2, priorizar:

- funding real;
- z-score real;
- OI real;
- delta OI;
- aceleração OI;
- preço x OI;
- CVD;
- agressão;
- liquidações;
- demais fatos.

Rótulos derivados podem existir como telemetria, mas não devem virar autoridade sobre a IA.

---

## 13.8 `TargetCandidateCatalog::strength`

Hoje há pesos de fonte e `strength`.

No V2:

- manter catálogo de níveis reais;
- manter origem;
- manter número de confluências;
- manter recência/toques quando objetivos;
- manter distância em ATR;
- manter candidate_id;
- retirar `strength` subjetivo como principal critério do Brain.

Se `strength` continuar existindo para legado, não enviá-lo como verdade decisória ao V2.

---

# 14. Arquitetura de dados do Brain V2

Separar o bundle em quatro ideias:

```text
FACTS
DERIVED_FEATURES
VISION
AVAILABILITY
```

## FACTS

Dados observados:

- candles;
- preço;
- OI;
- funding;
- volume;
- trades;
- order book;
- timestamps.

## DERIVED_FEATURES

Matemática objetiva:

- EMA;
- RSI;
- MACD;
- ADX/DMI;
- ATR;
- CMF;
- ER;
- CVD;
- slopes;
- deltas;
- aceleração;
- distância em ATR;
- z-score;
- estrutura calculável;
- métricas de volatilidade.

## VISION

Somente o que a IA visual realmente identificou na imagem.

## AVAILABILITY

Estado de cada fonte.

---

# 15. O que torna o Gênesis mais preditivo

Não será adicionar dezenas de indicadores novos.

Será extrair informação temporal dos indicadores que já existem.

A pergunta deixa de ser apenas:

```text
Onde o indicador está?
```

e passa a incluir:

```text
De onde ele veio?
Está acelerando?
Está desacelerando?
Divergiu do preço?
Saiu de compressão?
Está confirmando ou negando o movimento?
```

---

# 16. Indicadores e uso preditivo

## 16.1 EMA 21, 50 e 200

Já existem no projeto.

Acrescentar ao bundle V2:

- valor atual;
- valor anterior;
- slope;
- aceleração do slope;
- distância do preço para a EMA em ATR;
- distância entre EMAs em ATR;
- compressão das médias;
- expansão das médias;
- recuperação/perda recente.

Recomendação de normalização para slope de preço:

```text
ema_slope_atr_per_candle =
(EMA_t - EMA_t-k) / ATR_t / k
```

Compressão:

```text
ema_compression_atr =
(max(EMA21, EMA50, EMA200) - min(EMA21, EMA50, EMA200)) / ATR
```

Não transformar isso em pontos.

A IA interpreta.

---

## 16.2 RSI

Usar:

- valor atual;
- histórico curto;
- slope;
- recuperação/perda de regiões;
- divergência com preço.

Não usar regra simplista:

```text
RSI > 70 = SHORT
RSI < 30 = LONG
```

---

## 16.3 MACD

Usar:

- linha MACD;
- signal;
- histograma;
- histograma anterior;
- slope do histograma;
- aceleração;
- cruzamento em desenvolvimento.

Um MACD ainda negativo pode estar melhorando rapidamente.

Esse movimento é mais útil ao Brain do que apenas o sinal negativo atual.

---

## 16.4 ADX, +DI e -DI

Usar:

- ADX atual;
- ADX anterior;
- slope;
- aceleração;
- +DI;
- -DI;
- spread DI;
- expansão/contração do spread.

Exemplo de leitura útil:

```text
ADX: 17 -> 20 -> 23 -> 26
```

é diferente de:

```text
ADX = 26 parado
```

---

## 16.5 ATR e volatilidade

Usar:

- ATR atual;
- ATR anterior;
- mudança percentual;
- compressão;
- expansão;
- ATR relativo ou percentil, quando calculável com a própria série.

Objetivo:

detectar saída de compressão antes de um deslocamento já maduro.

---

## 16.6 Bollinger

Usar prioritariamente como informação de:

- compressão;
- expansão;
- bandwidth;
- mudança de bandwidth.

Não precisa virar bloco público na tela.

---

## 16.7 Volume

Usar:

- volume atual fechado;
- volume médio/mediano recente;
- volume relativo;
- expansão/contração;
- resposta do preço ao volume.

---

## 16.8 CMF

Usar:

- valor;
- slope;
- mudança de sinal;
- divergência com preço.

Não pontuar isoladamente.

---

## 16.9 Estocástico

Contextual.

Sobrecomprado não significa automaticamente venda.

Em tendência forte, pode permanecer sobrecomprado por vários candles.

---

## 16.10 Efficiency Ratio

Usar para ajudar a diferenciar:

- tendência eficiente;
- ruído;
- range;
- deslocamento direcional verdadeiro.

---

## 16.11 CVD

É uma das principais fontes de antecipação.

Usar:

- valor/estado;
- slope;
- aceleração;
- divergência com preço;
- falha em confirmar mínima;
- falha em confirmar máxima;
- recuperação durante preço lateral;
- deterioração durante preço ainda subindo.

O CVD existente baseado no volume agressor dos klines continua válido como visão acumulada por timeframe.

---

## 16.12 Open Interest

Usar:

- OI atual;
- delta curto;
- delta intermediário;
- aceleração;
- relação preço x OI;
- mudança de regime do OI.

Não basta:

```text
OI alto
```

Precisamos:

```text
OI crescendo?
caindo?
acelerando?
preço acompanha?
CVD confirma?
```

---

## 16.13 Funding

Usar:

- valor atual;
- histórico;
- média;
- desvio;
- z-score;
- mudança;
- extremos.

Funding sozinho nunca decide direção.

Funding combinado com preço, OI, CVD e fluxo pode participar da direção.

Regra antiga que dizia:

```text
Derivativos medem apenas força e nunca participam da direção
```

deve ser retirada do Brain V2.

Nova regra:

> Derivativos isolados não determinam a direção, mas podem participar da formação da direção quando combinados com preço, estrutura e fluxo.

---

## 16.14 Trade Flow real

O projeto já possui `TradeFlowService` e `aggTrades`.

Integrar ao Brain V2 principalmente em intraday.

Fase inicial recomendada:

```text
15m -> usar trade flow
1h -> usar trade flow com janelas controladas
4h -> não usar como representação do timeframe inteiro; no máximo timing recente se explicitamente rotulado
1d -> NOT_APPLICABLE
1w -> NOT_APPLICABLE
```

Para 15m, aproveitar janelas como:

```text
60s
300s
900s
```

Para 1h, utilizar janelas tecnicamente cobertas pela coleta real.

Se o número máximo de trades não cobrir toda a janela, não fingir cobertura completa.

Adicionar metadados:

```json
{
  "coverage_start_ms": 0,
  "coverage_end_ms": 0,
  "requested_window_seconds": 900,
  "truncated": false
}
```

Se a cobertura for insuficiente, o Brain precisa saber.

---

## 16.15 Order book

Usar apenas como complemento de timing/microestrutura.

Um snapshot isolado é frágil.

Não fazer dele autoridade direcional.

Se futuramente houver persistência temporal do imbalance, isso pode ganhar importância.

---

## 16.16 Estrutura

Manter:

- HH;
- HL;
- LH;
- LL;
- BOS;
- CHOCH;
- pivôs;
- falha em renovar máxima/mínima;
- recuperação/perda estrutural.

A IA deve interpretar transição, não apenas rótulo atual.

---

# 17. Serviço recomendado para features preditivas

Criar um serviço puro, sem nova chamada de rede:

```text
PredictiveFeatureService.php
```

Responsabilidade:

receber as séries já coletadas e calcular evolução.

Exemplo de contrato:

```php
return [
    'ema_dynamics' => [
        'ema21' => [
            'value' => $ema21,
            'slope_atr_per_candle' => $slope21,
            'acceleration' => $accel21,
            'price_distance_atr' => $distance21,
        ],
        'compression_atr' => $compression,
    ],
    'dmi_dynamics' => [
        'adx' => $adx,
        'adx_slope' => $adxSlope,
        'adx_acceleration' => $adxAcceleration,
        'di_spread' => $diSpread,
        'di_spread_change' => $diSpreadChange,
    ],
    'macd_dynamics' => [
        'histogram' => $histogram,
        'histogram_slope' => $histogramSlope,
        'histogram_acceleration' => $histogramAcceleration,
    ],
    'atr_dynamics' => [
        'atr' => $atr,
        'change_pct' => $atrChange,
        'compression_state' => $compressionState,
    ],
];
```

Nada disso precisa aparecer no frontend.

---

# 18. Frescor e fidelidade dos dados

## 18.1 Problema atual

Na versão auditada:

```php
'cache_ttl' => 300
```

e `BinanceService::get()` usa cache genérico.

Isso pode ser aceitável para algumas fontes, mas não para todas.

Uma política única de 300 segundos pode tornar microdados velhos demais.

---

## 18.2 Separar TTL por fonte

Criar configuração por fonte.

Exemplo inicial configurável:

```php
return [
    'cache_ttl' => [
        'price' => 2,
        'order_book' => 3,
        'open_interest_current' => 20,
        'funding_current' => 120,
        'funding_history' => 1800,
        'exchange_info' => 3600,
        'leverage_brackets' => 3600,
    ],
];
```

Os números devem ser configuráveis por ambiente.

Não usar um único TTL para tudo.

---

## 18.3 observed_at

`observed_at` precisa representar o momento real da observação da fonte.

Não pode ser atualizado para `now()` simplesmente porque um objeto saiu do cache.

Guardar:

```text
source_observed_at
cache_stored_at
cache_age_seconds
```

---

## 18.4 Candle fechado x preço vivo

Indicadores estáveis devem ser calculados sobre candles fechados.

Preço atual e candle parcial podem existir separadamente.

Não misturar silenciosamente candle ainda aberto com indicadores que o usuário acredita estarem fechados.

Contrato sugerido:

```json
{
  "last_closed_candle_at": "...",
  "live_price_observed_at": "...",
  "current_candle_state": "OPEN"
}
```

---

# 19. IA visual

A própria IA visual identifica figuras.

Não devemos deslocar essa responsabilidade para PHP.

A regra é:

> A IA pode identificar uma figura somente quando a geometria estiver claramente visível. Se for ambígua, incompleta ou exigir imaginação, a figura não existe para aquela análise.

---

# 20. Figuras gráficas

Podem incluir, quando claras:

- triângulo descendente;
- triângulo ascendente;
- triângulo simétrico;
- cunha;
- bandeira;
- OCO;
- OCO invertido;
- demais figuras previstas no catálogo fechado.

A IA nunca deve:

- completar uma figura parcial;
- criar figura por semelhança;
- inferir uma figura apenas pelo comportamento de preço;
- trocar uma figura por outra na narrativa;
- citar figura que não existe em `bundle.vision`.

Se nenhuma:

```json
"patterns": []
```

---

# 21. LTA, LTB e canais

A IA visual pode identificar:

- LTA;
- LTB;
- canal de alta;
- canal de baixa;
- canal de preço.

Exigir geometria suficiente.

Para linha inclinada, manter pelo menos dois pontos ancorados.

Sem geometria clara, omitir.

---

# 22. Fibonacci

Regra final:

> Fibonacci só entra se estiver visualmente desenhado no gráfico.

A IA não deve calcular Fibonacci.

Não deve escolher swing para criar Fibo.

Não deve estimar nível.

Se não houver Fibo desenhado:

```text
não entra no bundle decisório;
não aparece na análise;
não aparece como "não encontrado";
não participa de target;
```

A versão auditada já possui defesa de OCR/confiabilidade. Manter e fortalecer.

---

# 23. VRVP, POC, HVN e LVN

Só entram como informação visual se o perfil estiver realmente visível.

Nunca sintetizar POC/HVN/LVN e apresentar como se fosse leitura visual.

Se houver cálculo quantitativo separado de volume profile no futuro, usar namespace diferente.

Exemplo:

```text
visual.vrvp
```

versus:

```text
calculated.volume_profile
```

Não misturar.

---

# 24. Suporte e resistência

Separar dois conceitos:

```text
visual.support_resistance
```

e:

```text
structure.calculated_levels
```

Se a IA visual identificou linha/zona desenhada, isso é visual.

Se o backend calculou pivô, PDH, PDL ou nível estrutural, não chamar de "linha desenhada no gráfico".

A narrativa precisa respeitar a origem.

---

# 25. Validação de narrativa visual

Se:

```json
"patterns": []
```

a narrativa não pode falar:

```text
"o triângulo descendente..."
```

Se isso acontecer:

- não derrubar toda a análise;
- regenerar ou remover apenas a frase/campo;
- registrar erro;
- manter direction/score/plano válidos.

O mesmo vale para Fibo, VRVP e objetos visuais.

---

# 26. Multi-timeframe

O timeframe superior entra como contexto.

Não entra como peso.

Não entra como veto.

Não pode matar um setup atual válido.

Mapa inicial aprovado:

```text
5m  -> 15m
15m -> 1h
1h  -> 4h
4h  -> 1d
1d  -> 1w
1w  -> nenhum superior inicialmente
```

Remover do V2 a consulta automática a dois timeframes superiores para cada análise.

Exemplo válido:

```text
1h: BEARISH
15m: LONG
caráter: COUNTERTREND_REBOUND
```

Isso não é contradição.

---

# 27. Regra de decisão contextual

O Brain deve raciocinar, internamente, na seguinte ordem conceitual:

```text
REGIME
-> LOCALIZAÇÃO
-> TIMING
-> DIREÇÃO
-> GEOMETRIA
```

## Regime

Tendência, range, compressão, transição, reversão em tentativa etc.

## Localização

Onde o preço está dentro daquele ambiente.

## Timing

Há motivo para o movimento começar agora?

## Direção

LONG ou SHORT.

## Geometria

Existe uma operação utilizável neste preço?

Essa ordem não é uma matriz de pontos.

É um roteiro de raciocínio.

---

# 28. Direção e execução são coisas diferentes

Exemplo:

```text
Direction: LONG
Score: 80
```

mas:

```text
primeira barreira muito próxima;
RR1 insuficiente.
```

Resultado:

```text
direção continua LONG;
Plano A pode ficar indisponível;
Plano B pode ser preferível;
ou nenhuma execução agora.
```

Nunca alterar direction por geometria ruim.

---

# 29. Contrato JSON recomendado do Brain V2

Exemplo:

```json
{
  "schema_version": "decision-v7.0.0",
  "direction": "LONG",
  "score": 75,
  "regime": "REVERSAL_ATTEMPT",
  "movement_character": "COUNTERTREND_REBOUND",
  "primary_drivers": [
    {
      "evidence_id": "flow.cvd_dynamics",
      "reason": "Recuperação de fluxo enquanto o preço deixa de renovar mínima."
    },
    {
      "evidence_id": "derivatives.oi_dynamics",
      "reason": "Open Interest volta a expandir durante a recuperação."
    }
  ],
  "secondary_drivers": [
    {
      "evidence_id": "trend.ema_dynamics",
      "reason": "Preço recupera a EMA curta enquanto a inclinação negativa perde força."
    }
  ],
  "contrary_drivers": [
    {
      "evidence_id": "multi_timeframe.context",
      "reason": "O timeframe superior permanece vendedor."
    }
  ],
  "score_description": "Leitura compradora forte com melhora de fluxo e derivativos, embora o contexto superior ainda limite a tese.",
  "technical_analysis": "Texto curto para a área já existente no frontend.",
  "stop_selection": {
    "candidate_id": "sc_xxxxxxxxxxxxxxxx",
    "rationale": "A perda desta estrutura invalida a tese compradora."
  },
  "target_ranking": [
    "tc_1",
    "tc_2",
    "tc_3",
    "tc_4",
    "tc_5"
  ],
  "plan_b": {
    "enabled": true,
    "entry_candidate_id": "ec_x",
    "trigger_type": "RETEST",
    "trigger_level_candidate_id": "lc_x",
    "notes": "Aguardar reteste e sustentação da região."
  }
}
```

Observações:

- `score` já vem da IA;
- backend não cria outro score;
- drivers referenciam IDs existentes;
- números estratégicos devem vir de candidatos/fatos, não de invenção textual;
- `target_ranking` pode ter mais candidatos do que os três publicados;
- backend escolhe até três alvos elegíveis entre o ranking real depois da matemática.

---

# 30. Schema do score

Exemplo:

```php
'direction' => [
    'type' => 'string',
    'enum' => ['LONG', 'SHORT'],
],

'score' => [
    'type' => 'integer',
    'enum' => [55, 60, 65, 70, 75, 80, 85, 90],
],
```

Retirar `score_familias` do required V2.

---

# 31. Drivers

Drivers não são votos.

Eles servem para:

- explicação;
- auditoria;
- microtexto;
- telemetria.

`primary_drivers` não apaga dados que a IA não citou.

O bundle completo continua existindo.

A ausência de um indicador em `primary_drivers` não significa que ele deixou de existir.

---

# 32. Não contar evidências correlacionadas como sinais independentes

Adicionar regra ao prompt:

> Não aumente artificialmente a força apenas porque múltiplos indicadores correlacionados descrevem o mesmo fenômeno.

Exemplo:

```text
EMA21 bullish
EMA50 bullish
Supertrend bullish
MACD bullish
```

podem derivar do mesmo movimento de preço.

A IA deve interpretar contexto, não contar quantidade.

---

# 33. Stop sugerido pela IA

O stop inicial do plano deve ser sugerido pelo Brain a partir de candidatos reais.

A versão auditada já possui `stop_candidates`.

Manter essa arquitetura.

A IA escolhe:

```json
{
  "candidate_id": "sc_..."
}
```

Nunca inventa um preço.

O backend materializa o preço e os buffers objetivos necessários.

---

# 34. Stop V2: medir o fallback atual antes de removê-lo

Na versão auditada, `StopSelectionValidator` aceita `candidate_id = null` e `NivelService` pode escolher automaticamente outra âncora estrutural.

Antes de remover esse comportamento, executar medição nos logs atuais:

```text
percentual de análises com stop_selection.candidate_id = null
```

Registrar por:

- ativo;
- timeframe;
- provider/model;
- direção;
- período.

Objetivo:

descobrir se o problema é residual ou estrutural.

## Regra final de produto

O V2 deve chegar ao membro com um stop recomendado inicial.

A prioridade é:

```text
Trader AI / visão
-> stop técnico recomendado
-> membro pode ajustar via slider
```

O sistema não deve deixar o usuário sem referência de stop por uma dificuldade que já sabemos que existe hoje.

Se a IA falhar em selecionar um stop candidate durante a reestruturação:

1. registrar falha;
2. tentar repair semântico com o mesmo bundle;
3. se ainda falhar, usar apenas um fallback V2 explicitamente identificado e tecnicamente defensável, desde que esse fallback tenha sido auditado e aprovado antes do deploy;
4. marcar internamente `stop_source = SYSTEM_FALLBACK`;
5. nunca esconder que o stop não veio da escolha original da IA.

A meta da reestruturação é reduzir esse fallback ao mínimo.

Não apagar o fallback antigo antes de confirmar por medição que o substituto V2 cobre o volume necessário.

Se nenhum stop tecnicamente defensável puder ser obtido nem pela IA nem pelo fallback V2 auditado:

```text
análise pode existir
plano não pode ser confirmado
execution_state = BLOCKED_NO_VALID_STOP
```

Não fabricar preço arbitrário.

---

# 35. DP-03

Decisão final:

> O produto deve fazer o máximo para sempre entregar um stop técnico recomendado. O membro pode ajustá-lo manualmente. Somente quando nem a IA nem o fallback V2 auditado conseguirem produzir um stop tecnicamente defensável, a análise pode existir sem stop e o plano fica bloqueado.

Frontend precisa parar de considerar `null` como número válido.

Na versão auditada há lógica equivalente a:

```ts
Number.isFinite(Number(planoAtivo.stop))
```

Como:

```ts
Number(null) === 0
```

isso é perigoso.

Corrigir para algo como:

```ts
const hasValidNumber = (value: unknown): value is number =>
  value !== null &&
  value !== undefined &&
  Number.isFinite(Number(value));

const planoAtivoCompleto =
  !!planoAtivo &&
  hasValidNumber(planoAtivo.entrada) &&
  hasValidNumber(planoAtivo.stop) &&
  Number(planoAtivo.stop) > 0 &&
  hasValidNumber(planoAtivo.tp1);
```

Além disso, validar lado:

```text
LONG -> stop < entrada
SHORT -> stop > entrada
```

---

# 36. Slider de stop e régua visual de risco

Criar stop variável no frontend.

A dificuldade atual de obter um stop técnico perfeito não será tratada tentando engessar ainda mais o Brain.

A solução V2 é:

1. a IA visual/Trader AI entrega o **stop recomendado inicial**, com base no gráfico, estrutura e invalidação;
2. o stop recomendado já aparece aplicado no plano;
3. o membro pode reposicionar o stop com uma barra deslizante;
4. enquanto o membro move a barra, todos os dados dependentes do stop mudam em tempo real;
5. o sistema fornece uma indicação visual clara de risco de stop excessivamente curto e de stop excessivamente distante.

## Estado inicial

```text
stop_effective = stop_recommended
```

## Campos armazenados

```text
stop_recommended
stop_effective
stop_source
stop_distance_atr
distance_to_liquidation_pct
stop_risk_zone
```

`stop_source`:

```text
AI_RECOMMENDED
USER_ADJUSTED
```

---

## 36.1 Régua visual bidirecional

Não usar uma régua simples em que "mais distante" sempre fica verde.

Há risco nos dois extremos:

```text
STOP MUITO PRÓXIMO
-> risco de ruído / stop prematuro

STOP TECNICAMENTE ADEQUADO
-> zona preferencial

STOP MUITO DISTANTE
-> risco financeiro maior e aproximação relativa da liquidação
```

A representação correta é preferencialmente:

```text
VERMELHO -> AMARELO -> VERDE -> AMARELO -> VERMELHO
```

O primeiro vermelho representa **ruído**.

O segundo vermelho representa **risco excessivo / aproximação da liquidação / perda de eficiência operacional**.

Se o design final optar por uma linha de vermelho até verde por limitação visual, deve existir um segundo indicador explícito de distância da liquidação. A recomendação técnica é manter os dois riscos na mesma régua bidirecional.

---

## 36.2 Zonas da régua

A régua não deve ser baseada em porcentagens arbitrárias do slider.

As zonas precisam usar dados objetivos da própria operação.

### Lado curto do stop

Usar principalmente:

```text
stop_distance_atr
estrutura/pivô invalidante
microvolatilidade disponível
```

Aproximar demais o stop da entrada pode colocar o stop dentro do ruído normal do ativo.

### Zona preferencial

Centralizar a zona verde na região tecnicamente defensável em torno do stop recomendado e/ou da invalidação estrutural.

O stop recomendado da IA deve aparecer marcado visualmente:

```text
STOP GÊNESIS
```

### Lado distante

Usar:

```text
risco em moeda
risco percentual
distância até liquidação
maintenance margin real
alavancagem
```

Quanto mais o stop é afastado sem ganho técnico, piora a eficiência risco/retorno e pode aproximar a operação da liquidação antes que o stop seja útil, dependendo da alavancagem.

---

## 36.3 Estado visual recomendado

Exemplos de estados internos:

```text
TOO_CLOSE_NOISE
CAUTION_CLOSE
TECHNICAL_ZONE
CAUTION_WIDE
TOO_WIDE_LIQUIDATION_RISK
```

Microtexto curto possível:

```text
Muito próximo: maior risco de ruído.
```

```text
Zona técnica recomendada.
```

```text
Muito distante: risco elevado e menor margem até a liquidação.
```

Não encher a tela com explicações longas.

---

## 36.4 Parametrização da zona de ruído

Não fixar para sempre uma constante como verdade de mercado.

Criar configuração inicial e auditável usando ATR.

Exemplo de configuração inicial:

```php
'stop_slider' => [
    'noise_red_below_atr' => 0.50,
    'noise_yellow_below_atr' => 0.80,
],
```

Esses valores são guardrails iniciais e devem ser testáveis/configuráveis.

Eles não mudam direction nem score.

---

## 36.5 Parametrização do lado de liquidação

O lado distante deve usar a distância real até a liquidação calculada com `leverageBracket`.

Exemplo conceitual:

```text
liq_gap = abs(stop_effective - liquidation_price)
```

Normalizar para:

```text
liq_gap_pct_of_entry
```

e, quando possível:

```text
liq_gap_atr
```

A zona deve ficar mais crítica conforme o stop se aproxima do preço de liquidação ou o risco financeiro fica desproporcional.

Nunca usar maintenance margin estimada para colorir a régua em produção V2.

---

## 36.6 Restrições mínimas do slider

O slider não deve permitir posições matematicamente inválidas.

Para LONG:

```text
liquidation_price < stop_effective < entry
```

Para SHORT:

```text
entry < stop_effective < liquidation_price
```

Aplicar buffer operacional mínimo em relação à liquidação.

Se liquidação estiver `UNAVAILABLE`, o slider ainda pode funcionar para RR/risco, mas:

- zona de liquidação fica `UNAVAILABLE`;
- não fingir verde/vermelho com dado estimado;
- logar;
- exibir apenas a parte de ruído/técnica até o bracket real voltar, conforme decisão de produto.

---

## 36.7 Stop sugerido continua sendo referência, não prisão

A IA deve entregar o melhor stop que conseguir tecnicamente.

O membro pode alterá-lo.

A mudança manual:

- não muda direction;
- não muda score;
- não chama Brain;
- não altera a análise técnica original;
- muda apenas a configuração operacional do plano.

---

# 37. O que muda quando o stop é arrastado

Atualizar somente o que matematicamente depende do stop.

Sempre:

- RR1;
- RR2;
- RR3;
- distância entrada x stop;
- risco percentual.

Quando sizing é baseado em risco fixo:

- quantidade;
- nocional;
- margem;
- bracket;
- liquidação;
- risco em moeda.

Quando posição é fixa, não alterar artificialmente quantidade/margem se matematicamente não dependerem do stop.

---

# 38. Atualização em tempo real do slider

Para ficar fluido:

1. backend entrega parâmetros necessários;
2. frontend calcula preview local durante `onChange`;
3. usar a mesma fórmula pura do backend, quando possível compartilhada/testada;
4. no `onChangeEnd` ou debounce curto, chamar endpoint de repricing;
5. backend valida e vira fonte final.

Não chamar Trader AI.

---

# 39. Endpoint de repricing

Sugestão:

```http
POST /api/v1/analises/{uuid}/reprice
```

Request:

```json
{
  "plan": "A",
  "leverage": 10,
  "equity": 1000,
  "stop_effective": 77220.30
}
```

Response:

```json
{
  "analysis_uuid": "uuid",
  "plan": "A",
  "stop_recommended": 77450.00,
  "stop_effective": 77220.30,
  "stop_source": "USER_ADJUSTED",
  "stop_risk": {
    "zone": "TECHNICAL_ZONE",
    "distance_atr": 1.12,
    "distance_to_liquidation_pct": 8.35
  },
  "rr": {
    "tp1": 1.62,
    "tp2": 2.41,
    "tp3": 3.18
  },
  "risk": {
    "distance_pct": 1.14,
    "risk_usd": 10.00
  },
  "position": {
    "quantity": 0.00123,
    "notional": 98.50,
    "margin": 9.85
  },
  "liquidation": {
    "price": 70100.00,
    "status": "AVAILABLE"
  }
}
```

Nenhuma chamada de decisão AI nesse endpoint.

---

# 40. Plano A e Plano B

Precisam ser independentes.

Cada plano possui:

- entrada;
- stop recomendado;
- stop efetivo;
- TPs;
- RR por TP;
- sizing;
- margem;
- liquidação;
- gatilho, quando aplicável;
- estado operacional.

Se entrada B é diferente da entrada A, recalcular todos os campos dependentes.

É aceitável TP ou stop coincidir entre A e B somente quando a mesma estrutura real justificar isso.

Não copiar por conveniência.

---

# 41. Plano B, bug de estado vivo já confirmado

Na versão auditada:

`AnalysisPublicResponseBuilder` devolve:

```php
'execution' => $this->evidenceValue($analysis, 'pipeline.execution')
```

que é snapshot persistido.

`AcompanharPlanos` atualiza linhas de `genesis_analise_planos`.

O frontend consulta o estado dentro de `execution.planos[]`.

Se o response builder não fizer merge do estado vivo, o frontend pode continuar vendo estado antigo.

Correção:

- snapshot mantém a configuração original;
- estado dinâmico vem de `genesis_analise_planos`;
- `AnalysisPublicResponseBuilder` faz merge antes de responder;
- não sobrescrever a evidência histórica original;
- expor `trigger.estado`, `triggered_at`, `status_acionamento` e desfechos atuais.

---

# 42. Uma única fonte pública para Plano B

O frontend auditado ainda possui:

```text
execution.planoB
```

e:

```text
execution.planos[]
```

Convergir para:

```text
execution.planos[]
```

como fonte pública canônica.

Depois de migrar todos os consumidores:

```text
execution.planoB
```

deve ser removido do contrato público V2.

Antes de deletar, confirmar zero consumidores.

---

# 43. Semântica real do gatilho do Plano B

Hoje o acompanhamento possui lógica baseada principalmente em toque de entrada por high/low.

Isso não representa todos os gatilhos.

Implementar máquina de estado por tipo.

## ROMPIMENTO

Exigir:

- candle fechado além do nível;
- direção correta;
- buffer/tolerância técnica configurável quando aplicável.

## RETESTE

Exigir:

1. rompimento confirmado;
2. retorno à região;
3. teste da zona;
4. sustentação/rejeição de acordo com a direção.

## RETORNO_A_ZONA

Exigir:

- entrada na zona definida;
- condição de confirmação do plano;
- estado persistido.

Um pavio tocando a entrada não pode representar todos os três.

---

# 44. Targets reais

Alvos devem vir de níveis reais.

Nunca inventar target para completar interface.

Nunca obrigar três.

Publicar:

```text
0 a 3 TPs
```

conforme existência de níveis elegíveis.

---

# 45. Piso de alvo em R

Um nível pode ser real e ainda assim ser um TP operacional ruim.

Exemplo:

```text
resistência real a 0,14R
```

Não apagar a resistência.

Ela continua sendo uma barreira real e deve permanecer no contexto.

Mas:

```text
tp_eligible = false
```

quando não atingir RR mínimo.

Regra:

```text
RR_target >= rr_minimo
```

O `rr_minimo` inicial pode continuar vindo de:

```php
config('genesis.rr_minimo', 1.5)
```

desde que configurável.

---

# 46. Catálogo completo x alvos elegíveis

Separar:

```text
target_candidates_all
```

de:

```text
target_candidates_tp_eligible
```

O Brain precisa conhecer barreiras reais mesmo quando não servem como TP.

O frontend só publica targets elegíveis.

---

# 47. Resolver `TARGET_SELECTION_TOO_CLOSE_TO_PREVIOUS`

Não gastar nova rodada de IA.

A IA deve devolver um ranking maior de níveis reais, por exemplo até 6 IDs:

```json
"target_ranking": [
  "tc_a",
  "tc_b",
  "tc_c",
  "tc_d",
  "tc_e",
  "tc_f"
]
```

Depois que stop/entrada forem conhecidos, backend seleciona os primeiros até 3 que atendam:

- lado correto;
- candidato real;
- RR mínimo;
- espaçamento mínimo;
- demais invariantes matemáticas.

O erro:

```text
TARGET_SELECTION_TOO_CLOSE_TO_PREVIOUS
```

deixa de ser uma razão normal de repair.

Se aparecer depois do novo selector, deve ser tratado como bug interno.

---

# 48. Espaçamento de TPs

Pode manter o piso atual de espaçamento em ATR se tecnicamente desejado:

```text
0,50 ATR
```

mas a seleção deve ser determinística antes da publicação.

Não pedir para a IA adivinhar o algoritmo.

---

# 49. `TargetSelectionValidator`

Refatorar.

Hoje ele calcula quantidade esperada e pode exigir que a IA devolva exatamente esse número.

V2:

- não exigir três;
- permitir zero a três publicados;
- validator vira assert final;
- selector determinístico faz filtragem;
- validator só confirma que o resultado publicado respeita contrato.

---

# 50. RR

Regra final:

- RR totalmente determinístico;
- RR1 individual;
- RR2 individual;
- RR3 individual;
- sem RR combinado;
- recalcular ao mudar entrada;
- recalcular ao mudar stop;
- RR nunca altera direction.

---

# 51. Alavancagem

Alavancagem não entra na direção.

Alavancagem não entra no score.

Alavancagem afeta apenas:

- margem;
- sizing quando aplicável;
- liquidação;
- exposição;
- risco operacional.

---

# 52. Alavancagens válidas por contrato

Não assumir que todo ativo suporta 125x.

Usar `leverageBracket`/metadados reais da Binance por símbolo.

Frontend deve apresentar somente alavancagens compatíveis com o contrato selecionado.

Backend deve validar novamente.

---

# 53. Liquidação precisa usar bracket real

Na versão auditada, `LiquidationCalculatorService` ainda possui fallback:

```php
MM_TIER1_FALLBACK
MATH_ESTIMATE_TIER1
```

com valores aproximados como:

```text
0,004
0,005
```

Isso conflita com a exigência de dado real/fidedigno.

Ação V2:

1. configurar corretamente `GENESIS_BINANCE_API_KEY`;
2. configurar `GENESIS_BINANCE_API_SECRET`;
3. testar `getLeverageBrackets()` em produção;
4. usar `maintMarginRatio` real do bracket pelo nocional;
5. remover fallback estimado da rota operacional;
6. se bracket real não vier, `liquidation.status = UNAVAILABLE`;
7. registrar log;
8. não fabricar manutenção estimada.

Antes de apagar o fallback, confirmar que bracket real funciona para os contratos utilizados.

---

# 54. Alterar alavancagem não chama Brain

Na versão auditada, `analysisIdempotency.ts` inclui alavancagem na assinatura.

Isso faz uma mudança de alavancagem parecer uma nova análise.

No V2:

```text
Brain identity
=
market bundle + image + symbol + timeframe + prompt/schema/model
```

Não incluir alavancagem.

Separar:

```text
analysis_identity_hash
```

de:

```text
execution_parameters_hash
```

Alavancagem altera apenas execution parameters.

---

# 55. Hash do bundle

Se o bundle canônico da decisão for exatamente igual:

- não chamar novamente a IA;
- reutilizar decisão já persistida.

Isso reduz:

- custo;
- latência;
- variação do LLM;
- flip sem mudança de mercado.

O hash não pode usar apenas screenshot.

Precisa refletir o bundle real que entrou no Brain.

---

# 56. Timeframes suportados

Na versão auditada há bug:

`allowed_timeframes` inclui `3h`.

`BinanceService::INTERVALOS_BINANCE` não inclui `3h`.

Unificar.

O conjunto canônico inicial do Brain V2 passa a ser:

```text
5m
15m
1h
4h
1d
1w
```

O `5m` é necessário para scalp e repiques curtos e deve receber `15m` como contexto superior.

Sugestão:

```php
final class GenesisSupportedTimeframes
{
    public const ALL = [
        '5m',
        '15m',
        '1h',
        '4h',
        '1d',
        '1w',
    ];
}
```

Usar a mesma autoridade em:

- request validator;
- Binance;
- MTF;
- outcomes;
- frontend via endpoint/config;
- expiração;
- telemetria.

Remover `3h` até haver suporte real ponta a ponta.

---

# 57. Macro, geopolítica e sentimento

Não entram no Brain direcional.

Manter fora do bundle de decisão.

A versão auditada já remove `context` no pacote efetivamente enviado ao decisor.

Manter teste que prove isso.

Eles continuam:

- nos cards inferiores;
- disponíveis ao membro;
- com aviso antes de confirmar posição.

---

# 58. Radar News

Continua módulo separado.

Função:

- notícias relevantes;
- Telegram;
- eventos;
- alertas.

Não alimentar automaticamente `direction` ou `score`.

---

# 59. Aviso antes da confirmação

Manter o aviso já existente para o membro verificar:

- macro;
- geopolítica;
- sentimento.

O cérebro continua técnico.

O membro recebe o contexto externo separadamente.

---

# 60. Frontend deve continuar simples

Não criar cards para:

- slope de EMA;
- aceleração de OI;
- z-score;
- CVD slope;
- delta de taker;
- ADX slope;
- ATR percentile;
- microestrutura;
- dezenas de evidências.

Tudo isso é cérebro de backend.

Frontend deve focar no essencial:

- LONG/SHORT;
- score;
- barra do score;
- microtexto do score;
- análise técnica curta;
- Plano A/B;
- entrada;
- stop;
- slider do stop;
- TPs;
- RR;
- informações operacionais essenciais;
- cards de contexto abaixo.

---

# 61. Score breakdown antigo no frontend

Qualquer bloco visual baseado no antigo `score_breakdown` deve ser revisado.

Não mostrar a nova decisão como se ainda fosse resultado de quatro famílias ponderadas.

Se existir componente como `ScoreBasisBars`, ele deve:

- ser removido;
- ou ser refeito para informação compacta sem pesos;
- ou permanecer somente se não sugerir cálculo legado.

Não adicionar mais texto à tela.

---

# 62. Microtexto do score

Manter curto.

Exemplo:

```text
CVD em recuperação, OI acelerando e preço defendendo estrutura fortalecem a leitura compradora.
```

Não mostrar matemática interna.

Não listar dez indicadores.

---

# 63. Falha de indicador não aparece na tela

Proibido:

```text
"Não foi possível obter Open Interest."
```

quando a análise conseguiu prosseguir.

Isso é log.

---

# 64. Provider failover

Problema atual confirmado:

`GeminiDecisionClient` declara explicitamente que não há fallback automático.

Implementar wrapper:

```text
FailoverDecisionProvider
```

Fluxo:

```text
Primary provider
-> retry de transporte
-> fallback provider
```

---

# 65. Diferenciar falha de transporte de erro semântico

## Transporte

Exemplos:

- 503;
- 502;
- 504;
- timeout;
- 429;
- conexão.

Tratamento:

- retry curto;
- backoff;
- fallback para provider secundário.

## Semântico

Exemplos:

- JSON inválido;
- campo fora do schema;
- score 73;
- candidate_id inexistente;
- narrativa inconsistente.

Tratamento:

- repair semântico;
- não consumir o mesmo orçamento de retry de transporte.

---

# 66. Provider fallback proposto

Config:

```php
'decision_provider_primary' => 'gemini',
'decision_provider_fallback' => 'openai',
```

ou o inverso por configuração.

Pseudocódigo:

```php
final class FailoverDecisionProvider implements DecisionProvider
{
    public function __construct(
        private DecisionProvider $primary,
        private DecisionProvider $fallback,
    ) {}

    public function decide(string $bundleJson, ?array $repair = null): array
    {
        try {
            return $this->primary->decide($bundleJson, $repair);
        } catch (TransportProviderException $e) {
            Log::warning('GENESIS_DECISION_PROVIDER_FAILOVER', [
                'reason' => $e->getMessage(),
            ]);

            return $this->fallback->decide($bundleJson, $repair);
        }
    }
}
```

Não usar exatamente `RuntimeException` genérica para tudo.

Criar exceções classificadas.

---

# 67. Não refazer visão porque decisão falhou

Se `GeminiVisionService` já concluiu a visão e o decisor falhou:

- reutilizar `bundle.vision`;
- reutilizar evidências;
- trocar apenas decisor.

Não pagar nem variar novamente a parte visual.

---

# 68. Erros narrativos não derrubam a análise

Exemplos já observados:

```text
NARRATIVE_MENTIONS_UNAVAILABLE_VISUAL
UNACCOUNTED_NUMERIC_LITERAL
MONEY_FORMAT_RAW_NUMBER
NUMERIC_CITATION_LITERAL_NOT_FOUND
```

Classificar erro por campo.

Se o problema estiver apenas no texto:

- reparar o campo;
- remover frase problemática;
- renderizar deterministicamente;
- registrar log.

Não invalidar direction/score/plano matematicamente válidos.

---

# 69. Fatos operacionais continuam rígidos

Relaxar narrativa não significa relaxar matemática.

Continuar rejeitando:

- candidate_id inexistente;
- stop no lado errado;
- target inexistente;
- score fora da enum;
- LONG/SHORT inválido;
- preço inventado;
- figura inexistente usada como fato;
- RR calculado errado;
- leverage inválido.

---

# 70. Histórico de análise

Backend já possui persistência e endpoints de listagem/busca.

Frontend precisa transformar isso em experiência recuperável.

Cada análise deve ter UUID permanente.

Sugestão de rota:

```text
/genesis/analise/{uuid}
```

Ao abrir:

```text
GET /v1/analises/{uuid}
```

---

# 71. Análise continua ativa ao navegar

Fluxo obrigatório:

1. usuário cria análise;
2. vai ao Radar de Oportunidades;
3. volta;
4. mesma análise continua aberta;
5. refresh não destrói;
6. histórico permite reabrir depois.

Não depender exclusivamente de state React.

---

# 72. Outcomes

Outcome significa medir o que aconteceu depois da análise.

Não participa da espera do membro.

Exemplo:

```text
14:00
LONG 75
Plano A
Plano B

depois:
mercado evolui

servidor registra o que aconteceu
```

---

# 73. Acompanhar Plano A e Plano B independentemente da escolha do membro

Sempre salvar e acompanhar os dois planos gerados.

Mesmo se usuário escolheu A:

- acompanhar A;
- acompanhar B.

Mesmo se usuário não entrou:

- acompanhar ambos.

Isso mede o Brain, não a decisão humana.

---

# 74. Timeline de outcomes

O atual `DesfechoService` retorna no primeiro evento terminal encontrado.

Isso impede estudar a trajetória completa.

Substituir por timeline/eventos.

Exemplo:

```text
ENTRY_TRIGGERED
TP1_HIT
TP2_HIT
STOP_HIT_AFTER_TP2
EXPIRED
```

ou:

```text
ENTRY_TRIGGERED
TP1_HIT
TP2_HIT
TP3_HIT
```

Não encerrar tracking automaticamente em TP1.

---

# 75. MFE e MAE normalizados

Guardar bruto e normalizado.

Definição:

```text
R = abs(entry - stop)
```

Depois:

```text
MFE_R = MFE / R
MAE_R = MAE / R
```

Também:

```text
MFE_ATR = MFE / ATR_at_analysis
MAE_ATR = MAE / ATR_at_analysis
```

Isso permite comparar BTC com POL, ZEC ou outro ativo.

---

# 76. Reconstrução temporal dos outcomes

Para saber se stop ou TP veio primeiro, usar granularidade inferior.

Preferência:

```text
1m
```

onde for viável.

Não usar um candle de 4h para decidir ordem intrabar se stop e TP foram tocados dentro da mesma vela.

Quando ainda assim for impossível resolver:

```text
AMBIGUOUS_INTRABAR
```

não inventar ordem.

---

# 77. Outcome direcional já existente

`EvaluateGenesisOutcomes` já permite medir direção em horizontes como:

```text
60 min
240 min
1440 min
```

Manter.

Isso já permite comparar Brain legado x Brain V2 em direção.

A timeline de planos adiciona qualidade operacional.

---

# 78. Dashboard futuro

Guardar dados suficientes para medir:

- ativo;
- timeframe;
- direction;
- score;
- Plano A;
- Plano B;
- plano acionado primeiro;
- taxa de acionamento;
- TP1;
- TP2;
- TP3;
- stop;
- MFE_R;
- MAE_R;
- MFE_ATR;
- MAE_ATR;
- tempo até evento;
- score x resultado;
- direção contrária;
- alavancagem e resultado operacional.

Observação:

alavancagem não mede qualidade da previsão direcional.

Ela mede qualidade/risco da execução.

---

# 79. Análise original nunca deve ser reescrita pelo outcome

Guardar imutável:

```text
decision_at_analysis
market_snapshot_at_analysis
plan_A_original
plan_B_original
stop_recommended_original
targets_original
```

Eventos posteriores ficam em tabelas/timeline separadas.

---

# 80. Stop manual e outcome

Guardar separadamente:

```text
stop_recommended
stop_user_adjusted
```

O dashboard deve poder medir:

1. performance da recomendação original do Gênesis;
2. performance da execução efetivamente escolhida pelo membro.

Não misturar.

---

# 81. Contrato de evidências e anti-alucinação

A IA nunca pode:

- alterar um número recebido;
- criar indicador ausente;
- criar candidate_id;
- criar nível;
- criar figura;
- criar Fibo;
- inventar POC/HVN/LVN;
- citar evidência não disponível;
- transformar `null` em zero.

A IA pode:

- interpretar;
- combinar;
- priorizar contexto;
- decidir LONG/SHORT;
- decidir score;
- avaliar contradições;
- decidir regime;
- decidir caráter do movimento;
- escolher stop candidate;
- ranquear targets reais;
- criar Plano B a partir de candidatos reais.

---

# 82. Texto público e números

Reduzir a quantidade de números livres gerados pelo LLM.

Quando possível:

- IA retorna evidence_id;
- backend formata o número já conhecido;
- narrativa usa apenas números rastreáveis.

Isso reduz:

```text
UNACCOUNTED_NUMERIC_LITERAL
MONEY_FORMAT_RAW_NUMBER
NUMERIC_CITATION_LITERAL_NOT_FOUND
```

---

# 83. Persistência da origem de cada dado

Para auditoria, cada fonte relevante deve ter:

```text
source
status
observed_at
value
```

quando aplicável.

Exemplo:

```json
{
  "value": 0.0087,
  "status": "AVAILABLE",
  "source": "BINANCE_USDM_FUNDING",
  "observed_at": "..."
}
```

---

# 84. Arquivos backend: instruções de mudança

## `app/Services/GraphicalAnalysis/ScoreFromFamilies.php`

Ação:

```text
REMOVE_FROM_DECISION_PATH
DELETE_AFTER_REPLACEMENT_VERIFIED
```

Não chamar no Job V2.

---

## `app/Jobs/GraphicalAnalysisAttemptJob.php`

Remover V2:

```php
$scoreResult = $scoreFromFamilies->calcular(...);
$decision['score'] = $scoreResult['score'];
```

Substituir por validação direta:

```php
$score = $decision['score'] ?? null;

if (! is_int($score) || ! in_array($score, GenesisDecisionSchema::GENESIS_V2_VALID_SCORES, true)) {
    throw new \RuntimeException('GENESIS_V2_INVALID_SCORE');
}
```

Remover construção de microtexto baseada no breakdown antigo.

Persistir drivers V2.

---

## `app/Support/GenesisDecisionSchema.php`

Mudar:

- adicionar `score` obrigatório enum 55..90;
- remover `score_familias` do required V2;
- adicionar drivers;
- adicionar regime/movement_character;
- alterar target selection para ranking;
- manter candidate IDs fechados.

---

## `app/Services/GraphicalAnalysis/DecisionResponseValidator.php`

Remover validação das quatro famílias como requisito V2.

Adicionar:

- direction LONG/SHORT;
- score enum;
- evidence_id dos drivers precisa existir;
- stop candidate existe;
- target ranking contém IDs reais;
- não há duplicados;
- limites de quantidade;
- visual mencionado precisa existir, quando estruturado.

---

## `app/Services/GraphicalAnalysis/GenesisPrompt.php`

Remover:

- pesos 30/28/28/14;
- votação por família;
- regra de derivativos apenas como força;
- obrigação de score_familias;
- instruções que forcem três alvos.

Adicionar:

- score discreto 55..90;
- julgamento holístico;
- foco em transições;
- não contar sinais correlacionados;
- derivativos podem participar da direção em conjunto;
- MTF como contexto sem veto;
- figura somente se validada no bundle;
- Fibo somente se visual;
- dados indisponíveis simplesmente ausentes;
- direction sempre LONG/SHORT.

---

## `app/Services/GraphicalAnalysis/AnalysisPersistenceService.php`

Remover casts destrutivos:

```php
(int) $decision['score']
```

Validar antes.

Persistir score V2 exato.

Garantir que `null` nunca se transforme em zero.

---

## `app/Services/GraphicalAnalysis/ScoreNarrativeBuilder.php`

Retirar do V2 se depender do breakdown antigo.

Substituir por:

```text
decision.score_description
```

ou renderer V2 baseado em drivers.

---

## `app/Services/GraphicalAnalysis/DirectionCoherenceGate.php`

Manter apenas audit/telemetria se útil.

Nunca alterar direction/score.

Deletar posteriormente se ficar sem consumidor.

---

## `app/Services/GraphicalAnalysis/CanonicalBundleBuilder.php`

Manter exclusão de macro/sentimento do bundle decisório.

Adicionar:

- predictive features;
- availability/status;
- timestamps corretos;
- trade flow quando aplicável;
- apenas um HTF de contexto;
- separar facts/derived/vision.

---

## `app/Services/GraphicalAnalysis/EvidenceCatalog.php`

Adicionar IDs para features preditivas.

Exemplos:

```text
trend.ema_dynamics
momentum.dmi_dynamics
momentum.macd_dynamics
volatility.atr_dynamics
flow.cvd_dynamics
flow.trade_flow
derivatives.oi_dynamics
derivatives.funding_dynamics
multi_timeframe.context
```

Não criar dezenas de IDs sem necessidade.

---

## Novo: `PredictiveFeatureService.php`

Criar serviço puro de transformação de séries.

Sem HTTP.

Sem julgamento LONG/SHORT.

---

## `app/Services/TradeFlowService.php`

Manter.

Adicionar metadados de cobertura.

Integrar ao bundle V2 intraday.

Não usar como se cobrisse timeframe inteiro quando a coleta estiver truncada.

---

## `app/Services/GraphicalAnalysis/MultiTimeframeSnapshotService.php`

Mudar mapa para um único HTF.

Remover `3h`.

Garantir candles fechados para indicadores de contexto.

Não produzir veto.

---

## `app/Services/BinanceService.php`

Mudar cache por fonte.

Manter retries de dados.

Garantir timestamps reais.

Manter `getLeverageBrackets()` e torná-lo requisito operacional para alavancagem/liquidação real.

---

## `config/binance.php`

Trocar TTL global como única regra por TTL por fonte.

Configurar chaves necessárias ao bracket.

---

## `config/genesis_graphical_v6.php`

Unificar timeframes.

Remover `3h` até suporte ponta a ponta.

Criar feature flag V2.

Exemplo:

```php
'brain_v2_enabled' => env('GENESIS_BRAIN_V2_ENABLED', false),
```

---

## `config/genesis.php`

Atualizar:

```php
'conviccao_min_execucao' => 60,
```

Revisar `conviccao_fraca_abaixo`.

No V2, a interpretação da escala está definida neste documento.

Manter `rr_minimo` configurável, inicialmente 1.50 salvo nova decisão de produto.

---

## `app/Services/GraphicalAnalysis/TargetCandidateCatalog.php`

Manter geração de níveis reais.

Retirar `strength` subjetivo do caminho decisório V2.

Manter:

- candidate_id;
- side;
- price;
- distance_atr;
- primary_source;
- sources;
- confluence_count;
- metadados objetivos.

---

## `app/Services/GraphicalAnalysis/TargetSelectionValidator.php`

Refatorar para assert final.

Não obrigar número exato de targets.

Não provocar repair normal por proximidade.

---

## Novo: `TargetEligibilityService.php` ou equivalente

Responsabilidade:

- receber ranking da IA;
- receber entrada;
- receber stop final;
- calcular RR por candidato;
- aplicar RR mínimo;
- aplicar espaçamento;
- publicar até 3;
- manter níveis rejeitados como barreiras de contexto.

---

## `app/Services/GraphicalAnalysis/StopSelectionValidator.php`

Mudar regra V2:

`candidate_id = null` deixa de significar "PHP escolhe sozinho" para plano operacional.

Null pode manter análise, mas bloqueia plano.

---

## `app/Services/NivelService.php`

Para V2:

- manter criação objetiva de stop_candidates;
- manter buffer técnico objetivo quando aplicável;
- não selecionar silenciosamente uma âncora estratégica se a IA não selecionou;
- retornar STOP_UNAVAILABLE para plano V2 sem candidato aprovado.

Se fallback continuar para legado, separar explicitamente.

---

## `app/Services/GraphicalAnalysis/ExecutionPipelineService.php`

Continuar sendo motor matemático.

Não recalcular direction.

Não recalcular score.

Aceitar stop_effective.

Recalcular Plano A/B de forma independente.

---

## `app/Services/ExecucaoService.php`

Manter matemática:

- RR;
- custos;
- sizing;
- margem;
- liquidação.

Remover qualquer conceito de RR combinado se ainda existir em caminho vivo.

Permitir 0..3 TPs.

---

## `app/Services/GraphicalAnalysis/PlanRecommendationService.php`

Piso score:

```text
60
```

Usar somente para elegibilidade operacional.

Não influenciar direction.

Critérios podem incluir:

- score >= 60;
- stop válido;
- target válido;
- RR mínimo;
- gatilho pronto.

---

## `app/Services/GraphicalAnalysis/PlanoBService.php`

Plano B próprio.

Entrada, stop, targets e RR independentes.

Persistir gatilho estruturado.

---

## `app/Services/GraphicalAnalysis/AnalysisPublicResponseBuilder.php`

Fazer merge de:

```text
snapshot imutável
+
estado vivo de genesis_analise_planos
```

Não devolver trigger congelado.

---

## `app/Console/Commands/AcompanharPlanos.php`

Substituir toque simples por máquina de estado semântica.

Continuar acompanhando A e B.

Usar granularidade adequada para eventos.

---

## `app/Services/DesfechoService.php`

Substituir modelo de primeiro evento terminal por timeline.

Registrar eventos cumulativos.

Adicionar MFE/MAE normalizados.

---

## `app/Console/Commands/EvaluateGenesisOutcomes.php`

Manter avaliação direcional.

Adicionar vínculos com score/brain_version.

Permitir comparação legado x V2.

---

## `app/Services/GraphicalAnalysis/GeminiDecisionClient.php`

Não implementar fallback dentro da classe.

Manter cliente de provider simples.

Fallback fica em wrapper.

---

## `app/Services/GraphicalAnalysis/OpenAiDecisionClient.php`

Manter como segundo provider compatível com mesmo schema.

---

## Novo: `FailoverDecisionProvider.php`

Implementar failover.

Separar transporte de semântica.

---

## `app/Providers/GenesisGraphicalServiceProvider.php`

Binding do `DecisionProvider` passa a resolver wrapper de failover.

Não deixar escolha de um único provider derrubar análise sem tentativa secundária.

---

## `app/Services/GraphicalAnalysis/LiquidationCalculatorService.php`

Eliminar do V2:

```text
MM_TIER1_FALLBACK
MM_TIER1_FALLBACK_PADRAO
MATH_ESTIMATE_TIER1
```

somente após bracket real estar funcionando.

Se bracket indisponível:

```text
status = UNAVAILABLE
```

Logar.

Não inventar maintenance margin.

---

# 85. Arquivos frontend: instruções de mudança

## `services/analysisIdempotency.ts`

Retirar `alavancagem` da identidade estratégica da análise.

Antes:

```ts
[symbol, timeframe, leverage, imageHash]
```

V2:

```ts
[symbol, timeframe, imageHash, canonicalMarketHash?]
```

O hash final decisório deve ser confirmado no backend.

---

## `components/AnalysisResult.tsx`

Mudar:

- validação de null;
- stop slider;
- repricing;
- `execution.planos[]` como fonte única;
- score direto;
- barra 0..100;
- remover dependência de breakdown legado;
- manter aviso macro/geopolítico;
- não adicionar novos blocos de indicadores.

---

## `services/geminiService.ts`

Atualizar mapping do schema V2.

Não reconstruir score.

Não criar fallback visual no frontend.

---

## `types.ts` e tipos relacionados

Adicionar:

- score enum/union;
- drivers;
- statuses;
- stop_recommended/effective/source;
- execution state;
- plan timeline/live trigger fields.

Retirar dependências obrigatórias de `score_familias` no V2.

---

## `pages/GenesisPage.tsx`

Permitir restauração por UUID.

Não depender apenas de state local.

---

## Router

Criar rota de análise recuperável.

Exemplo:

```text
/genesis/analise/:uuid
```

---

## Histórico

Usar endpoints já existentes para listar e buscar análises.

Evitar criar linha duplicada.

---

# 86. Schema de disponibilidade recomendado

TypeScript:

```ts
type DataStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'NOT_PRESENT'
  | 'NOT_APPLICABLE';

interface DataPoint<T> {
  status: DataStatus;
  value: T | null;
  source?: string | null;
  observed_at?: string | null;
}
```

PHP DTO equivalente recomendado.

---

# 87. Estados operacionais recomendados

Separar análise de execução.

Exemplos:

```text
READY
WAIT_TRIGGER
SCORE_BELOW_MIN
BLOCKED_NO_VALID_STOP
BLOCKED_NO_VALID_TARGET
BLOCKED_RR_BELOW_MIN
BLOCKED_LEVERAGE_UNAVAILABLE
```

Isso não muda LONG/SHORT.

---

# 88. Versão do Brain

Persistir em toda análise:

```text
brain_version
prompt_version
schema_version
provider
model
bundle_hash
```

Exemplo:

```text
brain_version = V2
schema_version = decision-v7.0.0
```

Isso é obrigatório para outcomes e auditoria.

---

# 89. Migração em uma única publicação

Esta reestruturação será entregue em **uma única publicação de produção**.

Não haverá sequência de releases parciais aguardando semanas de shadow mode para completar o V2.

Pode existir comparação interna e benchmark antes do deploy, mas o pacote liberado em produção deve conter conjuntamente:

- correções P0 já conhecidas;
- Brain V2;
- score V2;
- novas features preditivas;
- estado vivo e gatilhos corretos do Plano B;
- stop recomendado + stop ajustável;
- repricing;
- alavancagem desacoplada do Brain;
- brackets reais para liquidação;
- target eligibility;
- provider failover;
- persistência/histórico;
- outcomes/timeline necessários;
- limpeza ou isolamento comprovado do legado.

A feature flag pode ser mantida exclusivamente como mecanismo de rollback técnico emergencial, não como estratégia de implantação progressiva.

Regra:

> O código antigo não pode permanecer ativo ao lado do V2 influenciando a mesma análise. Se for preservado para histórico, benchmark ou rollback, deve estar isolado do decision path V2.

---

# 90. Ordem de trabalho para UMA ÚNICA publicação

A ordem abaixo é de implementação dentro da mesma branch/release. **Não representa releases separadas.**

O deploy só acontece quando todos os blocos obrigatórios estiverem concluídos e passarem pelo Release Gate da seção 90.11.

## 90.1 Primeiro: medir duas coisas antes de remover comportamento existente

Antes de alterar o stop e antes de fechar o score livre:

1. medir nos logs atuais a incidência de:
   ```text
   stop_selection.candidate_id = null
   ```
2. executar benchmark 20x do novo prompt/schema com bundles reais congelados.

Essas medições não atrasam a reestruturação. Elas devem ocorrer no início do trabalho e orientar a implementação que entrará no mesmo deploy.

Registrar:
- percentual de stop null;
- ativos/timeframes mais afetados;
- amplitude de score no benchmark;
- qualquer flip LONG/SHORT;
- provider/model/prompt/schema usados.

## 90.2 Corrigir imediatamente os P0 de produção

Dentro da mesma release:

- estado vivo do Plano B;
- semântica real dos gatilhos;
- `null` x zero;
- provider retry/failover;
- alavancagem fora da identidade do Brain;
- endpoint de repricing;
- timeframes canônicos;
- brackets reais de alavancagem/manutenção;
- fonte pública única `execution.planos[]`.

## 90.3 Implementar o Brain V2

Na mesma release:

- schema novo;
- prompt novo;
- score novo;
- drivers;
- regime/localização/timing/direção/geometria como raciocínio;
- retirada de pesos 30/28/28/14;
- retirada do score por famílias;
- anti-alucinação factual/visual;
- decisão LONG/SHORT exclusiva da Trader AI.

## 90.4 Implementar as features preditivas

Na mesma release:

- slopes;
- acelerações;
- compressão/expansão;
- CVD dynamics;
- OI dynamics;
- EMA dynamics;
- DMI/ADX dynamics;
- MACD dynamics;
- ATR dynamics;
- volume relativo;
- funding dynamics;
- trade flow intraday;
- freshness por fonte.

## 90.5 Implementar stop V2 e stop ajustável

Na mesma release:

- stop inicial sugerido pela IA;
- invalidação técnica;
- stop efetivo ajustável pelo membro;
- barra deslizante;
- régua de risco visual;
- repricing full time;
- persistência de stop recomendado e stop do usuário;
- bloqueios matemáticos mínimos.

## 90.6 Implementar targets e RR

Na mesma release:

- catálogo completo;
- candidatos TP elegíveis;
- RR mínimo;
- espaçamento;
- 0..3 TPs;
- sem RR combinado;
- sem `TARGET_SELECTION_TOO_CLOSE` como repair normal.

## 90.7 Implementar Plano A/B completo

Na mesma release:

- independência de A/B;
- recálculo integral por entrada;
- estado vivo;
- gatilhos;
- validação;
- stop/TP/RR próprios.

## 90.8 Implementar histórico e persistência de UX

Na mesma release:

- rota por UUID;
- restauração;
- navegar e voltar sem perder análise;
- refresh;
- histórico no servidor.

## 90.9 Implementar outcomes mínimos necessários para o novo cérebro

Na mesma release:

- A/B monitorados;
- timeline;
- TP1/2/3;
- stop;
- MFE/MAE;
- R/ATR;
- direção 60/240/1440;
- brain_version;
- score original.

## 90.10 Fazer limpeza do legado antes do deploy

Não deixar limpeza para uma release futura.

Para cada componente substituído:

1. confirmar substituto;
2. migrar consumidores;
3. desativar componente antigo;
4. rodar testes;
5. confirmar ausência de dependência;
6. apagar se seguro;
7. se precisar permanecer por compatibilidade histórica, isolar em namespace/adapter legacy sem acesso ao V2.

## 90.11 Release Gate único

O deploy de produção só pode ocorrer se TODOS os itens abaixo estiverem aprovados:

- [ ] P0 de produção corrigidos.
- [ ] Brain V2 completo.
- [ ] PredictiveFeatureService completo.
- [ ] Score V2 completo.
- [ ] Stop recomendado funcionando.
- [ ] Slider e régua de risco funcionando.
- [ ] Repricing funcionando sem nova IA.
- [ ] Plano A/B independentes.
- [ ] Plano B vivo na tela.
- [ ] Targets 0..3 e RR corretos.
- [ ] Failover de provider funcionando.
- [ ] Timeframes canônicos funcionando.
- [ ] Alavancagens/brackets reais funcionando.
- [ ] Histórico/UUID funcionando.
- [ ] Outcomes mínimos funcionando.
- [ ] Legado fora do decision path.
- [ ] Benchmark 20x aprovado.
- [ ] Suíte backend verde.
- [ ] Suíte frontend verde.
- [ ] Testes E2E críticos verdes.
- [ ] Auditoria final `rg` concluída.

Não promover partes isoladas.
Não deixar regra antiga ativa "temporariamente" dentro do caminho decisório novo.


# 91. Testes obrigatórios

## Score

- score 55 aceito;
- score 60 aceito;
- score 90 aceito;
- 50 rejeitado;
- 73 rejeitado;
- 95 rejeitado;
- null não vira zero;
- zero rejeitado como score;
- LONG/SHORT usam mesma escala.

## Direção

- nenhum PHP muda LONG/SHORT após decisão;
- RR ruim não muda direção;
- HTF contrário não muda automaticamente direção;
- derivativos podem influenciar contexto sem regra fixa.

## Dados ausentes

- funding zero permanece zero;
- funding null permanece null;
- OI faltando não invalida análise;
- indicador ausente não aparece na narrativa;
- erro aparece no log.

## Vision

- sem figura -> patterns vazio;
- figura ambígua -> omitida;
- Fibo não desenhado -> não existe;
- LTA com um ponto -> descartada;
- narrativa não pode mencionar visual inexistente;
- erro narrativo visual não derruba decisão inteira.

## Targets

- nível 0,14R continua barreira;
- nível 0,14R não vira TP se rr_minimo=1,5;
- pode publicar 0 TPs;
- pode publicar 1 TP;
- pode publicar 2 TPs;
- pode publicar 3 TPs;
- nunca exige exatamente 3;
- spacing aplicado deterministicamente;
- `TARGET_SELECTION_TOO_CLOSE_TO_PREVIOUS` não deve gerar repair normal.

## Stop

- null bloqueia confirmação;
- LONG stop acima/igual à entrada é rejeitado;
- SHORT stop abaixo/igual à entrada é rejeitado;
- slider não chama AI;
- mover stop recalcula RR;
- stop recomendado permanece salvo;
- stop manual fica separado.

## Alavancagem

- alterar leverage não gera nova decisão;
- leverage inválido para símbolo é rejeitado;
- bracket real usado;
- sem bracket -> liquidação UNAVAILABLE;
- nenhum fallback 0.004/0.005 em produção V2.

## Timeframes

- 5m funciona;
- 15m funciona;
- 1h funciona;
- 4h funciona;
- 1d funciona;
- 1w funciona;
- 3h é rejeitado antes de buscar candles;
- MTF usa apenas HTF mapeado.

## Provider

- Gemini 503 -> retry transporte -> OpenAI fallback;
- Gemini timeout -> fallback;
- erro semântico -> repair, não transport retry;
- fallback recebe mesmo bundle;
- visão não roda novamente.

## Plano B

- estado vivo chega ao frontend;
- rompimento exige rompimento;
- reteste exige sequência;
- retorno à zona exige retorno;
- toque de pavio não substitui qualquer semântica.

## Persistência

- navegar e voltar mantém análise;
- refresh mantém análise;
- UUID recupera análise;
- histórico lista;
- não cria análise duplicada.

## Outcomes

- A e B monitorados;
- TP1 não encerra tracking;
- TP2/TP3 registrados;
- stop posterior registrado;
- MFE_R calculado;
- MAE_R calculado;
- MFE_ATR calculado;
- MAE_ATR calculado;
- ambiguidade intrabar não é inventada.

## Macro

- macro não existe no bundle do decisor;
- sentimento não existe no bundle do decisor;
- cards continuam no frontend;
- aviso continua antes da confirmação.

---

# 92. Benchmark de estabilidade

Produção com bundle hash:

```text
mesmo bundle exato -> mesma decisão persistida
```

Benchmark bruto do provider, fora do cache:

- executar o mesmo bundle 20 vezes;
- zero flip LONG <-> SHORT;
- score deve permanecer em faixa estável;
- variação grande de score precisa ser investigada.

Critério de aceite:

```text
direction flip = bloqueia release
score range > 10 pontos no mesmo bundle = não liberar score livre sem correção
```

Se o score livre variar mais de 10 pontos no mesmo bundle após ajuste de prompt/schema, adotar ainda nesta mesma reestruturação um fallback categórico estável para o campo de força, sem reintroduzir pesos por indicador.

Exemplo de fallback possível:

```text
MARGINAL -> 55
FRACA -> 60
MODERADA -> 65/70
FORTE -> 75/80
MUITO_FORTE -> 85/90
```

A direção continua sendo da IA.

Não usar o benchmark para reintroduzir 30/28/28/14 nem soma de indicadores.

---

# 93. Teste que prova que o legado morreu

Criar teste/feature flag que:

1. desabilita `ScoreFromFamilies`;
2. desabilita score_breakdown antigo;
3. roda Brain V2;
4. confirma que:
   - direction existe;
   - score existe;
   - Plano A/B existem;
   - stop/targets funcionam;
   - RR funciona.

Se algo quebra, ainda há dependência legada.

---

# 94. Comandos de auditoria sugeridos

Exemplos:

```bash
rg -n "ScoreFromFamilies|score_familias|score_breakdown" app/ tests/
```

Depois da migração, ocorrências permitidas precisam estar explicitamente:

```text
Legacy
migration compatibility
historical reader
tests de histórico
```

Nenhuma ocorrência viva no pipeline V2.

Buscar casts:

```bash
rg -n "\(int\).*score|\(float\).*score|empty\(.*score" app/
```

Buscar zero/null frontend:

```bash
rg -n "Number\(.*stop|Number\(.*score|!.*stop|!.*score|\|\|" .
```

Buscar Plano B duplicado:

```bash
rg -n "execution\.planoB|planoB" .
```

Buscar 3h:

```bash
rg -n "'3h'|\"3h\"" app/ config/ routes/ tests/ ../frontend/
```

Buscar fallback de liquidação:

```bash
rg -n "MM_TIER1_FALLBACK|MATH_ESTIMATE_TIER1|0\.004|0\.005" app/
```

---

# 95. Critério final de auditoria de cada dado

Para qualquer campo que chega ao Brain, responder:

1. de onde veio?
2. qual timestamp real?
3. estava fresco?
4. zero é zero real?
5. null significa indisponível?
6. a IA recebeu exatamente esse valor?
7. alguma camada alterou o valor?
8. o texto público citou somente o que existia?

Se uma dessas respostas não puder ser provada, o campo não está pronto.

---

# 96. O que NÃO precisa aparecer no frontend

Não expor:

- EMA slope;
- EMA acceleration;
- OI acceleration;
- CVD slope;
- ADX slope;
- DI spread;
- ATR percentile;
- trade count;
- trade flow windows;
- funding zscore;
- regime internals;
- evidence IDs;
- provider logs;
- data status de indicador;
- cache age;
- falhas de fonte.

Tudo fica no backend/auditoria.

---

# 97. O que permanece na tela

Manter foco em:

```text
DIREÇÃO
SCORE
BARRA
MICROTEXTO DO SCORE
ANÁLISE TÉCNICA
PLANO A
PLANO B
ENTRADA
STOP
SLIDER DO STOP
TPs
RRs
INFORMAÇÕES OPERACIONAIS ESSENCIAIS
MACRO/GEOPOLÍTICA/SENTIMENTO ABAIXO
```

---

# 98. Definition of Done para Brain V2 e para a publicação única

Esta reestruturação só pode ser publicada quando o pacote completo estiver pronto.

Brain V2 só pode ser considerado pronto quando:

- não depende de ScoreFromFamilies;
- não depende de pesos 30/28/28/14;
- score vem da IA e respeita enum;
- score null não vira zero;
- indicadores ausentes não derrubam análise;
- predictive features chegam ao Brain;
- dados possuem frescor adequado;
- visual não inventa figura/Fibo;
- MTF não veta o timeframe principal;
- stop null bloqueia confirmação;
- slider funciona sem nova IA;
- targets respeitam RR e spacing sem inventar;
- Plano A/B independentes;
- estado vivo do B chega à tela;
- leverage não chama Brain;
- leverage usa bracket real;
- provider tem failover;
- narrativa não derruba decisão por erro cosmético;
- análise é recuperável por UUID;
- A/B têm outcomes;
- legado está isolado ou removido;
- stop ajustável possui régua de risco bidirecional funcional;
- benchmark 20x foi executado antes do deploy;
- medição de stop null foi executada e registrada;
- todos os testes críticos estão verdes;
- nenhum bloco obrigatório ficou programado para "próxima release".

---

# 99. CHECKLIST FINAL PARA FELIPE

(Ver documento completo entregue pelo cliente — reproduzido integralmente neste arquivo-fonte; o detalhamento operacional item a item foi convertido em `tasks.md` deste spec.)

---

# 100. Regra final para qualquer exclusão

Felipe deve seguir esta regra para toda remoção:

> **Nunca apagar porque "não parece mais usado". Primeiro identificar o substituto, migrar os consumidores, provar por teste e busca estática que o novo caminho funciona sem o antigo, desativar o antigo, testar novamente e somente então deletar.**

Para cada exclusão, registrar:

```text
LEGADO:
SUBSTITUTO:
CONSUMIDORES MIGRADOS:
TESTE QUE PROVA SUBSTITUIÇÃO:
BUSCA RG SEM REFERÊNCIA VIVA:
DATA DA REMOÇÃO:
```

Isso é obrigatório.

---

# 100.1 Regra de publicação única

A presente especificação deve ser tratada como uma única reestruturação de produção.

Não dividir em:

```text
release do P0
depois release do Brain
depois release do stop
depois release dos outcomes
```

A ordem de desenvolvimento pode ser interna, mas a promoção para produção é única.

Antes do deploy, Felipe deve entregar um relatório de conclusão contendo:

```text
ITEM:
STATUS:
ARQUIVOS ALTERADOS:
ARQUIVOS REMOVIDOS:
SUBSTITUTO:
TESTES EXECUTADOS:
RESULTADO:
RISCO RESIDUAL:
```

Qualquer item não concluído precisa ser explicitamente aprovado antes do deploy. O padrão é não publicar parcialmente.

---

# 101. Regra final do projeto

A nova fase do Gênesis deve obedecer a quatro responsabilidades claramente separadas:

## Dados

Trazer informação real, atual, rastreável e com semântica correta de zero/null.

## Brain

Interpretar como trader usando estado + evolução + gráfico.

## Matemática operacional

Calcular exatamente risco, RR, sizing, margem e liquidação sem reinterpretar direção.

## Outcomes

Medir posteriormente se a previsão e os planos funcionaram.

A simplificação não significa reduzir inteligência.

Significa remover engenharia redundante que tenta julgar duas vezes a mesma coisa.

O objetivo final é:

```text
menos travas contra raciocínio
+
mais travas contra alucinação
+
mais informação temporal
+
mais previsibilidade
+
menos pontos de falha
+
mais auditabilidade
```
