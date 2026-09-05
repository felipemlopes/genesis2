# GÊNESIS V6.10 — DOCUMENTO DE IMPLEMENTAÇÃO

| Campo | Valor |
|---|---|
| Para | Felipe |
| De | Fabrício, PO |
| Data | 03/09/2026 |
| Backend | `genesis-api-genesis2` |
| Frontend | `genesis2-master` |
| Base auditada | pacote entregue em 02/09/2026 |
| Casos de prova | APTUSDT.P 1d, BTCUSDT.P 1d, SUIUSDT.P 1d |

---

# LEIA ISTO ANTES DE ABRIR QUALQUER ARQUIVO

## 1. Nunca apague nada sem testar antes

Este documento manda remover código. Várias vezes. **Nenhuma remoção pode ser feita direto.**

Para cada item que manda apagar, o procedimento é sempre este, nesta ordem:

1. `grep -rn` pelo símbolo em **todo o backend e todo o frontend**, incluindo testes
2. Listar cada consumidor encontrado
3. Rodar a suíte inteira **antes** de tocar em qualquer coisa e guardar a saída
4. Remover
5. Rodar a suíte de novo e comparar com a saída guardada
6. Se qualquer teste que passava parou de passar, **reverter e me perguntar**

Se um símbolo tiver consumidor que este documento não previu, **pare e pergunte**. Não improvise substituto, não comente o código "por segurança", não deixe o campo no payload devolvendo `null` sem avisar. Um campo que some sem que a tela saiba disso quebra a tela em produção, e a tela é o produto.

## 2. Ordem é obrigatória

As fases são cronológicas e têm dependência entre si. A Fase 3 desliga uma penalidade que a Fase 4 também menciona. A Fase 7 mexe no mesmo arquivo da Fase 5. Fazer fora de ordem cria conflito.

## 3. Teste antes de entregar, com gráficos diferentes

Não basta rodar a suíte. Antes de entregar, você roda o Gênesis em **pelo menos seis ativos diferentes**, sendo obrigatoriamente:

- Um em tendência de alta clara
- Um em tendência de baixa clara
- Um em range
- Um com dado de derivativos ausente ou incompleto
- Um de baixa liquidez
- Um dos três da mesa (BTC, APT ou SUI) para comparação direta

E confere, tela por tela, se **tudo** o que está neste documento aparece do jeito que está aqui. Inclusive o card de Sentimento da moeda e o card de Macro e Geopolítico, que hoje falham de forma intermitente e precisam aparecer com conteúdo próprio, fonte e horário, ou não aparecer.

O protocolo completo está na Fase 10. Ele faz parte da entrega. Entrega sem ele volta.

## 4. Desvio se comunica antes

Se algum item aqui não puder ser aplicado como está escrito, você me avisa **antes** de implementar diferente. Comentário no código não é canal de aprovação. Isso vale para escolha de fixture, troca de escopo e qualquer decisão que mude o que está especificado.

---

# FASE 1 — A suíte de verdade

**Nada abaixo tem prova sem isto. É o primeiro item por decisão, não por ordem alfabética.**

## 1.1 Destravar os aceites visuais

**Arquivo.** `tests/Feature/AceiteVisualV69Test.php`

**Hoje.** Os dois testes caem em `markTestSkipped()` porque `GENESIS_RUN_VISUAL_ACCEPTANCE` não é verdadeiro por padrão. As asserções que importam estão como `// TODO Fase 11`.

**O gate por variável de ambiente está certo e fica.** Ele existe para não gastar crédito de API em toda execução local, e isso é uma proteção legítima.

**O que muda.** As asserções param de ser TODO. A fixture recebe os valores reais.

```php
// Preencher com os valores da captura de referência (BTCUSDT.P 1d).
// Estes vêm da captura de 02/09/2026 15:40. Se trocar a captura, troca aqui.
private const ESPERADO_BTC = [
    'ema21'          => 74_090.6,
    'ema50'          => 69_981.6,
    'ema200'         => 72_285.9,
    'atr'            => 2_373.8,
    'rsi'            => 65.7,
    'adx'            => 43.2,
    'plus_di'        => 33.6,
    'minus_di'       => 12.1,
    'wyckoff'        => 'MARKUP',
];

public function test_indicadores_vem_de_vela_fechada(): void
{
    $payload = $this->analisar('BTCUSDT', '1d');

    foreach (self::ESPERADO_BTC as $campo => $esperado) {
        if (is_float($esperado)) {
            $this->assertEqualsWithDelta(
                $esperado,
                $payload['metricas'][$campo],
                abs($esperado) * 0.002,   // 0,2% de tolerância
                "Campo {$campo} fora da tolerância — suspeita de vela viva."
            );
            continue;
        }
        $this->assertSame($esperado, $payload['metricas'][$campo]);
    }
}
```

**Atenção à fixture.** A captura de referência mudou de 23/08 para 16/08 numa decisão registrada em comentário. **Volte para a captura combinada** ou me avise qual você quer usar e por quê, antes de implementar.

## 1.2 Criar o teste ponta a ponta no payload publicado

**Arquivo novo.** `tests/Feature/PayloadPublicadoTest.php`

Este é o teste que não existe e que teria pego quatro dos cinco bloqueadores. Ele não olha o retorno do serviço. Ele olha **o JSON que a tela recebe**.

```php
/**
 * Roda a análise inteira e valida o JSON público final, o mesmo que o
 * frontend consome. Nenhuma asserção aqui pode ler estado interno de
 * serviço: se não está no payload, não está sendo testado.
 */
final class PayloadPublicadoTest extends TestCase
{
    /** @dataProvider ativos */
    public function test_contrato_do_payload(string $symbol, string $timeframe): void
    {
        $p = $this->analisarPublico($symbol, $timeframe);

        // ---- Alvos ----
        $atr = $p['metricas']['atr'];
        $entrada = $p['planos'][0]['entrada'];
        $alvos = array_values(array_filter([
            $p['planos'][0]['tp1'], $p['planos'][0]['tp2'], $p['planos'][0]['tp3'],
        ]));

        $this->assertGreaterThanOrEqual(
            $atr * 0.25,
            abs($alvos[0] - $entrada),
            'TP1 abaixo do piso de 0,25 ATR.'
        );

        for ($i = 1; $i < count($alvos); $i++) {
            $this->assertGreaterThanOrEqual(
                $atr * 0.50,
                abs($alvos[$i] - $alvos[$i - 1]),
                "Espaçamento TP".($i)."—TP".($i + 1)." abaixo de 0,50 ATR."
            );
        }

        // ---- Stop ----
        $stop = $p['planos'][0]['stop'];
        if ($stop !== null) {
            $this->assertLessThanOrEqual(
                4.5,
                abs($entrada - $stop) / $atr,
                'Stop final acima do teto ampliado de 4,5 ATR.'
            );
        }

        // ---- Avisos por plano ----
        // Cada plano carrega os próprios avisos. Nada de lista somada.
        foreach ($p['planos'] as $plano) {
            $this->assertArrayHasKey('avisos', $plano);
        }

        // ---- Formato de dinheiro em texto público ----
        foreach ($this->textosPublicos($p) as $campo => $texto) {
            $this->assertDoesNotMatchRegularExpression(
                '/\$\s*\d{1,3}(\.\d{3})*,\d+/u',
                $texto,
                "Preço em formato pt-BR no campo {$campo}."
            );
            $this->assertDoesNotMatchRegularExpression(
                '/\b[A-Z][A-Z_]{3,}\b/u',
                $texto,
                "Código de estado em caixa alta no campo {$campo}."
            );
        }

        // ---- Manchete e corpo do plano ----
        if (($p['recomendacao']['reason_code'] ?? null) === 'CONVICCAO_ABAIXO_MINIMO') {
            $this->assertNull(
                $p['recomendacao']['alvo_que_atende'],
                'Manchete de alvo sobrevivendo ao rebaixamento por convicção.'
            );
        }

        // ---- null nunca vira zero ----
        foreach (['liquidacao_estimada', 'tp3', 'stop'] as $campo) {
            $valor = $p['planos'][0][$campo] ?? null;
            $this->assertNotSame(0, $valor, "Campo {$campo} zerado no lugar de null.");
            $this->assertNotSame(0.0, $valor, "Campo {$campo} zerado no lugar de null.");
        }
    }

    public static function ativos(): array
    {
        return [
            'BTC 1d' => ['BTCUSDT', '1d'],
            'APT 1d' => ['APTUSDT', '1d'],
            'SUI 1d' => ['SUIUSDT', '1d'],
        ];
    }
}
```

## 1.3 Rodar e guardar a saída

```bash
composer install --no-interaction
vendor/bin/phpunit --testdox > /tmp/suite_antes.txt 2>&1
```

**Guarde esse arquivo.** Toda fase daqui pra frente compara contra ele.

---

# FASE 2 — Os três bloqueadores de uma linha

Três correções pequenas, independentes entre si, alto impacto na tela.

## 2.1 [A1] O aviso do Plano B parando de aparecer no Plano A

**Arquivo.** `components/AnalysisResult.tsx`, linha 495

**Sintoma.** No BTC a tela mostra `Stop a 10.2% da entrada` logo acima de `DISTÂNCIA ATÉ O STOP 4.66%`.

**Causa.** O backend já faz certo: cada plano carrega `planos[].avisos`. Mas `execution.avisos` continua existindo como a união deduplicada dos dois, por compatibilidade (`ExecucaoService.php:661`). O frontend é o consumidor legado.

**Antes:**

```tsx
{/* F1: Avisos do reconciliador */}
{execution.avisos.length > 0 && (
  <div className="bg-amber-950/20 border border-amber-600/30 rounded-lg p-3 mb-6">
    {execution.avisos.map((a: string, i: number) => (
      <p key={i} className="text-[11px] text-amber-300 leading-relaxed">{a}</p>
    ))}
  </div>
)}
```

**Depois:**

```tsx
{/* F1: avisos do plano ativo. NUNCA execution.avisos, que é a união
    dos dois planos e vaza o aviso do Plano B para a tela do Plano A. */}
{(planoAtivo?.avisos ?? []).length > 0 && (
  <div className="bg-amber-950/20 border border-amber-600/30 rounded-lg p-3 mb-6">
    {(planoAtivo?.avisos ?? []).map((a: string, i: number) => (
      <p key={i} className="text-[11px] text-amber-300 leading-relaxed">{a}</p>
    ))}
  </div>
)}
```

**Antes de apagar:** `grep -rn "execution.avisos" ../genesis2-master`. Se houver outro consumidor além deste, migre também. O campo pode continuar no payload do backend.

**Como conferir na tela.** Numa análise em que os dois planos gerem avisos diferentes, alternar entre A e B troca as linhas da barra âmbar junto com os outros campos. Numa análise em que só o Plano B gera aviso, com o Plano A selecionado a barra não aparece.

## 2.2 [A4] A manchete que contradiz o próprio corpo

**Arquivo.** `app/Services/GraphicalAnalysis/PlanRecommendationService.php`, por volta da linha 84

**Sintoma.** No SUI, título `PLANO ATENDE O TP3` com corpo dizendo que a convicção está abaixo do limiar.

**Causa.** O ramo de R:R define `$alvoQueAtende = 'TP3'`. O bloco de convicção sobrescreve `reason_code` e `motivo`, mas não limpa `alvo_que_atende`. A manchete continua lendo o campo órfão.

**Antes:**

```php
if ($conviccao < $conviccaoMinima) {
    $recommended = false;
    $reasonCode = 'CONVICCAO_ABAIXO_MINIMO';
    $motivo = 'Existe uma direção provável, mas a convicção está abaixo do limiar de execução. Consulte os limitadores e as confirmações necessárias.';
}
```

**Depois:**

```php
if ($conviccao < $conviccaoMinima) {
    $recommended = false;
    $reasonCode = 'CONVICCAO_ABAIXO_MINIMO';
    $motivo = 'Existe uma direção provável, mas a convicção está abaixo do limiar de execução. Consulte os limitadores e as confirmações necessárias.';
    // O motivo mais severo vence, e os campos derivados do motivo anterior
    // vão junto. Sem esta linha a manchete anuncia um alvo que o corpo nega.
    $alvoQueAtende = null;
}
```

**Teste novo:**

```php
public function test_conviccao_baixa_limpa_o_alvo_que_atende(): void
{
    $r = $this->service->evaluate(
        rrLiquido: 0.31,      // TP1 abaixo do mínimo
        rrMinimo: 1.50,
        alvos: [/* TP3 com rr_liquido 1.59 */],
        conviccao: 35,        // abaixo do limiar
        conviccaoMinima: 50,
    );

    $this->assertSame('CONVICCAO_ABAIXO_MINIMO', $r['reason_code']);
    $this->assertNull($r['alvo_que_atende']);
}
```

## 2.3 [A3] Formato de preço

Três frentes no mesmo item. Todas obrigatórias.

### 2.3.1 O prompt

**Arquivo.** `app/Services/GraphicalAnalysis/GenesisPrompt.php`, linhas 48 e 136

**Antes:**

```
- A4 (V6.9): ao citar um preço em texto livre (score_description, technical_analysis),
  use SEMPRE cifrão + ponto de milhar + vírgula decimal, no formato exato "$ 65.370,92"
  (...) as casas decimais seguem a evidência de origem
```

**Depois:**

```
- A4: ao citar um preço em texto livre (score_description, technical_analysis),
  use SEMPRE o formato "$69,155.8": cifrão COLADO no número, vírgula separando
  milhar, ponto separando decimal. Nunca "$ 65.370,92", nunca espaço depois do
  cifrão, nunca vírgula decimal, nunca o número cru sem separador.
  O número de casas decimais vem do campo `tick_decimals` do contrato, que está
  no pacote. NUNCA da evidência de origem. Um contrato com tick_decimals 4
  jamais recebe um preço com 8 casas.
  Percentuais e taxas seguem o mesmo padrão de ponto decimal: "0.01%", "14.73%".
```

Aplicar nas duas linhas. Elas são quase idênticas e as duas alimentam o modelo.

### 2.3.2 O formatador do PHP

**Arquivo.** `app/Services/GraphicalAnalysis/PlanRecommendationService.php`, linha 141

**Regra do produto:** nem o backend nem a IA formatam número. Os dois mandam o valor puro e a tela formata.

**Antes:**

```php
private function formatarPreco(float $valor): string
{
    $casas = abs($valor) >= 1 ? 2 : (abs($valor) >= 0.01 ? 4 : 6);
    return '$ '.number_format($valor, $casas, ',', '.');
}
```

**Depois.** Apagar o método inteiro. O motivo passa a viajar com os valores puros à parte, como `lote_minimo_incompativel` e `nocional_minimo_incompativel` já fazem nesta mesma entrega:

```php
return [
    'recommended'      => $recommended,
    'reason_code'      => $reasonCode,
    'motivo'           => $motivo,          // sem preço embutido
    'alvo_que_atende'  => $alvoQueAtende,
    // Valores puros. A tela formata com o formatador único.
    'rr_liquido'       => $rrLiquido,
    'rr_minimo'        => $rrMinimo,
    'alvo_bom_preco'   => $alvoBom['alvo'] ?? null,
    'alvo_bom_rotulo'  => $alvoBom['rotulo'] ?? null,
    'alvo_bom_rr'      => $alvoBom['rr_liquido'] ?? null,
];
```

E o `number_format($rrLiquido, 2, ',', '.')` que monta o texto do motivo sai junto. O texto passa a ter marcadores e a tela preenche.

**Antes de apagar:** `grep -rn "formatarPreco" app/` e confira se algum outro ponto usa. Se usar, migre também.

### 2.3.3 O espaço depois do cifrão

**Arquivo.** `utils/canonicalMoney.ts`, linha 25

**Antes:**

```ts
'$ ' + value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
```

**Depois:**

```ts
'$' + value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
```

O padrão é `$69,155.8`, cifrão colado.

**E as casas por magnitude saem.** As linhas 19 a 21 (`if (abs >= 1) return 2; if (abs >= 0.01) return 4; return 8;`) são fallback e só podem valer quando o `tick_decimals` não vier. Quando vier, ele manda.

### 2.3.4 O formatador antigo

`services/cryptoApi.ts:44` exporta um `formatPrice` que ainda é usado por cinco componentes (`MarketWidget`, `OiLiquidationMonitor`, `NewListings`, `LiquidityMap`, `MarketTicker`).

**Não apague sem migrar.** Migre os cinco para `canonicalMoney` e só então remova. Se algum tiver comportamento próprio que o canônico não cobre, **pare e me pergunte**.

---

# FASE 3 — O novo modelo de score

Esta é a maior mudança do documento. Ela redefine quem decide a nota.

## 3.1 O princípio

**O PHP põe todos os dados na mesa. A IA olha tudo e decide direção, força e score. O PHP não ajusta a nota depois.**

Hoje é o contrário: o prompt manda a IA começar de 60 e somar cinco ajustes, e depois o código corrige o resultado dela três vezes. É por isso que o ADX consegue custar 25 pontos num modelo em que ele vale 3.

## 3.2 O que sai do prompt

**Arquivo.** `app/Services/GraphicalAnalysis/GenesisPrompt.php`

### Sai o ajuste A6 inteiro (linhas 65 a 80)

O bloco que começa com *"comece de uma base de 60 e ajuste por fatos contáveis"* e lista os cinco somatórios (ADX ≥ 25 soma +10, ADX < 20 subtrai 5, tempos maiores somam +5, figura soma +5, cobertura soma +5). Some inteiro.

### Sai a regra A9

A que impede a Etapa 1 de receber derivativos. Derivativos valem 28 de 100 na tabela de pesos. Sem eles na mesa a IA não consegue dizer a força.

**Em compensação, entra a regra escrita:**

```
- Derivativos medem a FORÇA da direção, nunca a escolhem. A direção sai da
  estrutura, do fluxo e do momentum. Se os derivativos apontarem para o lado
  contrário da estrutura, isso rebaixa a classificação da família Derivativos
  e portanto o score — nunca inverte a direção.
```

**Antes de derrubar a A9:** `grep -rn "A9\|DISPLAY_ONLY\|derivatives" app/Services/GraphicalAnalysis/CanonicalBundleBuilder.php` e confira o filtro que remove os tokens de derivativos do pacote da Etapa 1. Ele precisa ser desligado junto, senão o texto do prompt muda e o dado continua sem chegar.

## 3.3 O que entra no prompt

A IA passa a classificar **quatro famílias** em cinco níveis. Ela não escreve o número: ela escolhe quatro palavras e a tabela produz o número.

```
== COMO DAR A FORÇA (SCORE) ==

Você classifica CADA UMA das quatro famílias abaixo em exatamente um destes
níveis. Você NÃO calcula o score. Você classifica; o número sai da tabela.

Níveis:
  FORTE_A_FAVOR   a família confirma a direção de forma inequívoca
  A_FAVOR         a família confirma, com alguma ressalva
  NEUTRO          os dados vieram e não pendem para lado nenhum
  CONTRA          a família contraria a direção
  FORTE_CONTRA    a família contraria de forma inequívoca
  INDISPONIVEL    a família não tem dado suficiente para ser lida

NEUTRO e INDISPONIVEL são coisas diferentes e não podem ser confundidos.
NEUTRO é uma leitura: os dados chegaram e são ambíguos.
INDISPONIVEL é ausência de dado. Sai da conta inteira, não penaliza.
Use INDISPONIVEL só quando NÃO SOBROU NADA da família. Se o funding não veio
mas o open interest veio, Derivativos continua sendo classificada.

--- ESTRUTURA (peso 30) ---
Entra aqui: EMAs 21/50/200 e inclinação, Golden/Death Cross, Wyckoff,
figuras gráficas validadas, pivôs estruturais, evento de estrutura.

FORTE_A_FAVOR  tendência definida na direção; topos e fundos na ordem;
               preço do lado certo das três EMAs e elas empilhadas na ordem
               da tendência; Wyckoff em markup (LONG) ou markdown (SHORT).
A_FAVOR        tendência na direção mas com uma ressalva: EMA longa ainda do
               lado errado, ou empilhamento incompleto, ou Wyckoff em fase de
               acumulação (LONG) / distribuição (SHORT) sem markup confirmado.
NEUTRO         range sem evento; estrutura indefinida; preço entre as médias.
CONTRA         estrutura aponta para o lado oposto, mas sem força: tendência
               contrária perdendo inclinação, ou figura contrária não validada.
FORTE_CONTRA   tendência definida no sentido oposto, com preço do lado errado
               das três EMAs e Wyckoff na fase oposta.

--- ORDER FLOW (peso 28) ---
Entra aqui: CVD slope, divergência de CVD, volume, paredes do livro de ofertas.

FORTE_A_FAVOR  CVD acompanhando o preço na direção, com inclinação clara;
               volume expandindo nas velas a favor; livro sem parede contrária
               relevante no caminho até o primeiro alvo.
A_FAVOR        CVD na direção mas fraco, ou volume sem expansão clara.
NEUTRO         CVD lateral, volume médio, livro equilibrado.
CONTRA         CVD divergindo do preço contra a direção, ou parede relevante
               do lado contrário no caminho.
FORTE_CONTRA   CVD claramente contra, com volume confirmando o lado oposto.

--- DERIVATIVOS (peso 28) ---
Entra aqui: funding, open interest e variação, long/short ratio, clusters de
liquidação, quadrante preço x OI, crowding, risco de squeeze.

FORTE_A_FAVOR  quadrante e OI confirmando a direção; funding sem custo contra;
               lado lotado é o oposto ao seu, com squeeze a seu favor.
A_FAVOR        quadrante a favor mas com funding neutro ou OI ambíguo.
NEUTRO         funding neutro, OI estável, sem crowding relevante.
CONTRA         OI acumulando na direção oposta, ou funding cobrando do seu lado.
FORTE_CONTRA   crowding do seu lado com risco de squeeze contra você.

--- MOMENTUM (peso 14) ---
Entra aqui: RSI, ADX, MACD, DMI e divergências.
ADX mede FORÇA de tendência, não direção: ADX alto confirma qualquer direção,
ADX baixo enfraquece qualquer direção. O DMI cuida da direção. Cada indicador
entra UMA vez.

FORTE_A_FAVOR  ADX >= 25 e subindo, DMI na direção, MACD na direção,
               RSI acompanhando sem exaustão.
A_FAVOR        maioria dos quatro na direção, com uma ressalva.
NEUTRO         indicadores mistos ou sem leitura clara.
CONTRA         maioria contra a direção.
FORTE_CONTRA   ADX < 20 com DMI e MACD os dois contra.

== HIERARQUIA QUANDO AS FAMÍLIAS DISCORDAM ==
Os pesos são a ordem de precedência: Estrutura 30, Order Flow 28,
Derivativos 28, Momentum 14. Se Estrutura e Momentum apontarem para lados
opostos, quem dá o tom é a Estrutura. Momentum é confirmação secundária e
mais atrasada; ele nunca deve, sozinho, derrubar uma leitura estrutural limpa.
```

## 3.4 O que entra no schema

**Arquivo.** `app/Support/GenesisDecisionSchema.php`

```php
'score_familias' => [
    'type' => 'object',
    'required' => ['estrutura', 'order_flow', 'derivativos', 'momentum'],
    'properties' => [
        'estrutura'   => ['type' => 'string', 'enum' => self::NIVEIS],
        'order_flow'  => ['type' => 'string', 'enum' => self::NIVEIS],
        'derivativos' => ['type' => 'string', 'enum' => self::NIVEIS],
        'momentum'    => ['type' => 'string', 'enum' => self::NIVEIS],
    ],
],
```

```php
private const NIVEIS = [
    'FORTE_A_FAVOR', 'A_FAVOR', 'NEUTRO', 'CONTRA', 'FORTE_CONTRA', 'INDISPONIVEL',
];
```

O campo `score` numérico **sai do schema**. A IA não devolve mais número.

## 3.5 A tabela, em código

**Arquivo novo.** `app/Services/GraphicalAnalysis/ScoreFromFamilies.php`

Esta classe **não julga**. Ela transcreve a resposta da IA para número. É a única aritmética permitida aqui.

```php
final class ScoreFromFamilies
{
    /** Pesos aprovados pelo PO. Recalibrar = mudar aqui, nada mais. */
    private const PESOS = [
        'estrutura'   => 30,
        'order_flow'  => 28,
        'derivativos' => 28,
        'momentum'    => 14,
    ];

    /** Degraus iguais de 25 pontos nos dois sentidos. */
    private const FATORES = [
        'FORTE_A_FAVOR' => 1.00,
        'A_FAVOR'       => 0.75,
        'NEUTRO'        => 0.50,
        'CONTRA'        => 0.25,
        'FORTE_CONTRA'  => 0.00,
    ];

    private const TETO = 90;

    /** Abaixo disto a análise sai sem número. Ver 3.7. */
    public const COBERTURA_MINIMA = 0.50;

    /**
     * @param array<string,string> $classificacoes família => nível
     * @return array{score: ?int, cobertura: float, breakdown: array}
     */
    public function calcular(array $classificacoes): array
    {
        $somaPonderada = 0.0;
        $somaPesos = 0;
        $breakdown = [];

        foreach (self::PESOS as $familia => $peso) {
            $nivel = $classificacoes[$familia] ?? 'INDISPONIVEL';

            // Ausência sai do numerador E do denominador. O peso é
            // redistribuído entre as demais famílias por consequência
            // aritmética. Ausência NUNCA custa ponto.
            if ($nivel === 'INDISPONIVEL') {
                $breakdown[$familia] = [
                    'nivel' => 'INDISPONIVEL', 'peso' => $peso, 'contribuicao' => null,
                ];
                continue;
            }

            $fator = self::FATORES[$nivel];
            $contribuicao = $peso * $fator;

            $somaPonderada += $contribuicao;
            $somaPesos += $peso;

            $breakdown[$familia] = [
                'nivel' => $nivel, 'peso' => $peso,
                'fator' => $fator, 'contribuicao' => round($contribuicao, 2),
            ];
        }

        $cobertura = $somaPesos / array_sum(self::PESOS);

        if ($somaPesos === 0 || $cobertura < self::COBERTURA_MINIMA) {
            return ['score' => null, 'cobertura' => $cobertura, 'breakdown' => $breakdown];
        }

        $bruto = self::TETO * ($somaPonderada / $somaPesos);
        $score = (int) (round($bruto / 5) * 5);

        return [
            'score'     => max(0, min(self::TETO, $score)),
            'cobertura' => $cobertura,
            'breakdown' => $breakdown,
        ];
    }
}
```

### A conta, com o SUI de 02/09 como exemplo

| Família | Peso | Nível | Conta |
|---|---|---|---|
| Estrutura | 30 | NEUTRO (range sem evento) | 30 × 0,50 = 15,0 |
| Order Flow | 28 | A_FAVOR (CVD negativo acumulado) | 28 × 0,75 = 21,0 |
| Derivativos | 28 | CONTRA (OI comprado contra o setup) | 28 × 0,25 = 7,0 |
| Momentum | 14 | FORTE_CONTRA (DMI e Supertrend contra) | 14 × 0,00 = 0,0 |

```
soma = 43,0   divisor = 100
score = 90 × 43,0 / 100 = 38,7 → 40
cobertura = 100%
```

### A mesma conta sem derivativos

```
soma = 15,0 + 21,0 + 0,0 = 36,0
divisor = 30 + 28 + 14 = 72
score = 90 × 36,0 / 72 = 45
cobertura = 72%
```

O score **sobe**, porque a família que estava contra saiu da mesa. Isso está correto e é a regra: ausência reduz cobertura, nunca custa ponto.

### Teste obrigatório da regra de ausência

```php
public function test_ausencia_nao_penaliza(): void
{
    $comQuatro = $this->s->calcular([
        'estrutura' => 'FORTE_A_FAVOR', 'order_flow' => 'FORTE_A_FAVOR',
        'derivativos' => 'FORTE_A_FAVOR', 'momentum' => 'FORTE_A_FAVOR',
    ]);
    $semDerivativos = $this->s->calcular([
        'estrutura' => 'FORTE_A_FAVOR', 'order_flow' => 'FORTE_A_FAVOR',
        'derivativos' => 'INDISPONIVEL', 'momentum' => 'FORTE_A_FAVOR',
    ]);

    $this->assertSame(90, $comQuatro['score']);
    $this->assertSame(90, $semDerivativos['score']);   // MESMO score
    $this->assertSame(0.72, round($semDerivativos['cobertura'], 2));
}

public function test_extremos(): void
{
    $t = fn (string $n) => $this->s->calcular(array_fill_keys(
        ['estrutura', 'order_flow', 'derivativos', 'momentum'], $n
    ))['score'];

    $this->assertSame(90, $t('FORTE_A_FAVOR'));
    $this->assertSame(70, $t('A_FAVOR'));
    $this->assertSame(45, $t('NEUTRO'));
    $this->assertSame(20, $t('CONTRA'));
    $this->assertSame(0,  $t('FORTE_CONTRA'));
}
```

## 3.6 O que sai do código

### 3.6.1 A penalidade por contradição

**Arquivo.** `app/Services/GraphicalAnalysis/DirectionCoherenceGate.php`, linha 31

```php
public const PENALIDADE_POR_CONTRADICAO = 10;
```

**A constante sai e o uso dela no `ScoreFinalizer` sai.**

**A classe fica viva.** Ela continua produzindo a lista de contradições que alimenta o box "Pontos que pesam contra esta leitura", que é útil e fica na tela. Ela só para de mexer no número.

**Por quê.** A IA já olhou o DMI ao classificar Momentum. Descontar de novo é contar duas vezes o mesmo fato.

**Antes de apagar:** `grep -rn "PENALIDADE_POR_CONTRADICAO\|contradiction_penalty\|contradicoes" app/ tests/`. Vai haver teste asseverando a penalidade. Esse teste muda de asserção: passa a verificar que a lista de contradições é produzida, e que o score **não** muda por causa dela.

### 3.6.2 A penalidade de frescor

**Arquivo.** `app/Services/GraphicalAnalysis/ScoreFinalizer.php`

Sai `PENALIDADE_FRESCOR_MEDIO` e o `data_quality_penalty` do cálculo.

**Regra:** defasagem e ausência reduzem **cobertura**, nunca tiram ponto.

### 3.6.3 O modificador de derivativos

A Etapa 2 e o `derivatives_modifier` de −15 a +15 deixam de existir como mecanismo de score. Derivativos viram uma família como as outras.

**Isto é uma remoção grande. Faça o levantamento de consumidores com cuidado extra e me mostre a lista antes de remover.**

## 3.7 Piso de cobertura

Abaixo de 50% de cobertura a análise **não publica número**. Metade da mesa vazia não é convicção fraca, é análise sem base.

A tela mostra a direção, a análise técnica e um aviso de que não houve mesa suficiente para dar a força. O campo de score vem `null` e a tela não renderiza o número. **Nunca zero.**

## 3.8 Marcar a data de corte

Este bloco muda a escala. Análises anteriores deixam de ser comparáveis com as novas.

Grave a data de corte na base para a estatística de assertividade não misturar os dois modelos.

---

# FASE 4 — A régua do frescor

## 4.1 [A2] O preço deixa de nascer defasado

**Arquivo.** `app/Services/GraphicalAnalysis/FreshnessPolicy.php`, linha 30

**Sintoma.** Nos três prints, `Frescor das fontes: 88% (7/8)` e a frase `Dados desatualizados ou incompletos em: preço..` Sempre a mesma fonte, sempre o mesmo número.

**Causa.** O preço tem teto de 30 segundos, medido em `CanonicalBundleBuilder.php:117` contra `microtime()` do momento de montar o pacote, ou seja depois da coleta de mercado, da leitura visual e da coleta de contexto. Nenhuma execução fecha isso.

**Antes:**

```php
'price' => 30_000,
```

**Depois:**

```php
// O preço é coletado no início do pipeline e avaliado no fim, depois da
// leitura visual e da coleta de contexto. 30s era impossível de cumprir e
// marcava STALE em 100% das execuções. Escala com o gráfico, como candles.
'price' => $this->timeframeMs($timeframe) + 30_000,
```

**Alternativa aceitável**, se preferir: manter os 30 segundos e mudar o relógio, medindo contra o instante da coleta em vez do da montagem. Escolha uma das duas e me diga qual.

**A parte de "parar de tirar ponto" já foi feita na Fase 3.**

## 4.2 O texto público

A frase `Dados desatualizados ou incompletos em: preço` some do texto do score. Defasagem aparece na cobertura, não em prosa alarmando o membro sobre um preço que não está velho.

---

# FASE 5 — [E1] O plano primário

## 5.1 O problema

**Arquivo.** `app/Services/ExecucaoService.php`, linha 352

```php
'entrada' => $preco,
```

O Plano A é sempre a mercado. Sempre. Inclusive quando o preço está esticado ou no meio de um range.

No APT o sistema vendeu a mercado logo depois de uma vela verde de +2,6% quicando na linha de tendência. O Plano B, que espera o repique, estava ali do lado, desmarcado.

## 5.2 O efeito, com números da tela

Mesmo stop nos dois planos:

| | Plano A (mercado) | Plano B (nível) |
|---|---|---|
| APT TP1 | 1:0,22 | **1:0,57** |
| APT TP2 | 1:0,63 | **1:1,09** |
| BTC TP1 | 1:0,24 | **1:0,43** |
| BTC TP3 | 1:1,15 | **1:1,48** |
| SUI TP1 | 1:0,35 | **1:1,39** |
| SUI TP2 | 1:1,14 | **1:2,79** |

## 5.3 O que muda

A IA passa a declarar qual plano é o primário.

**No schema:**

```php
'plano_primario' => ['type' => 'string', 'enum' => ['A', 'B']],
```

**No prompt:**

```
- Você declara qual plano é o PRIMÁRIO, o que vem pré-selecionado na tela.
  Escolha "A" (entrada a mercado) quando o preço já estiver num nível que
  justifique entrar agora.
  Escolha "B" (entrada no nível) quando o preço estiver esticado da média,
  no meio de um range sem nível próximo, ou logo após um movimento forte
  que ainda não retestou.
  Um trader não entra a mercado no meio do range. Se a entrada boa é o
  repique, o primário é o B.
```

**No frontend:** o plano primário vem pré-selecionado e é o que alimenta o cabeçalho.

O Plano A continua existindo e continua clicável. Ninguém perde a opção de entrar a mercado.

---

# FASE 6 — Os sete da segunda ordem

## 6.1 [B1] Wyckoff cru na tela

**Arquivo.** `components/AnalysisResult.tsx`, linha 36

O dicionário tem 8 fases. O backend tem 11. Faltam quatro, e o fallback imprime a chave crua: no APT e no SUI aparece `RANGE_SEM_EVENTO`.

```ts
const WYCKOFF_LABEL: Record<string, string> = {
  DISTRIBUICAO_RANGE:  'Distribuição em range',
  DISTRIBUICAO_UAT:    'Distribuição (UAT)',
  DISTRIBUICAO_SPRING: 'Distribuição com spring',
  ACUMULACAO_RANGE:    'Acumulação em range',
  ACUMULACAO_SPRING:   'Acumulação com spring',
  ACUMULACAO_SC:       'Acumulação (clímax de venda)',   // NOVO
  ACUMULACAO_AR:       'Acumulação (repique automático)', // NOVO
  ACUMULACAO_ST:       'Acumulação (teste secundário)',   // NOVO
  RANGE_SEM_EVENTO:    'Range sem evento',                // NOVO
  MARKUP:              'Markup',
  MARKDOWN:            'Markdown',
  INDETERMINADO:       'Indeterminado',
};
```

E o fallback nunca imprime a chave:

```ts
const rotuloWyckoff = WYCKOFF_LABEL[fase] ?? 'Fase não classificada';
```

**Verificação obrigatória:** confira a lista canônica em `TechnicalAnalysisService` e garanta que o dicionário cobre **todas** as fases. Se o backend ganhar fase nova depois, isso quebra de novo.

## 6.2 [B2] Estado interno na tela

**Arquivo.** `components/AnalysisResult.tsx`, linha 1147

**Antes:**

```tsx
{publicText(macroInfo?.resumo) || "Contexto informativo indisponível para esta análise (orçamento de IA esgotado ou serviço fora do ar)."}
```

**Depois:**

```tsx
{publicText(macroInfo?.resumo) || "Contexto informativo indisponível para esta análise."}
```

Orçamento, serviço, fila e endpoint vão para o log, nunca para o membro.

## 6.3 [B3] Selo Indisponível sobre card com dado

No BTC e no SUI o card superior de Macro traz o selo `INDISPONÍVEL` enquanto o card de baixo mostra VIX 15,22, DXY e S&P reais. O selo segue só o score da narrativa.

O card só é indisponível quando **nada** chegou. Faltando só a narrativa, o card mostra os números que vieram.

## 6.4 [B4] Texto do score quebrado

**Arquivo.** `app/Services/GraphicalAnalysis/ScoreNarrativeBuilder.php`, linha 74 e o `juntarComE()` na 80

**Sintoma.** `contrário à direção. e Dados desatualizados ou incompletos em: preço..`

**Causa.** O `juntarComE()` cola itens que já terminam em ponto, e o `sprintf` envolve tudo em `'...: %s.'`.

```php
private function juntarComE(array $itens): string
{
    // Cada fator já vem com pontuação final própria. Sem normalizar,
    // a junção produz ". e" no meio e ".." no fim.
    $itens = array_values(array_filter(array_map(
        static fn (string $i): string => rtrim(trim($i), '.'),
        $itens
    )));

    $total = count($itens);
    if ($total === 0) { return ''; }
    if ($total === 1) { return $itens[0]; }

    $ultimo = array_pop($itens);

    return implode(', ', $itens).' e '.$ultimo;
}
```

## 6.5 [B5] Open Interest sem janela

**Arquivo.** `app/Services/GraphicalAnalysis/MarketSnapshotService.php`, método `oiChange()`

O APT publicou `aumento de 2224% no Open Interest`. O cálculo compara o primeiro e o último ponto da série inteira, que no diário são 30 dias, e o texto não diz isso.

Duas mudanças:

1. A janela vai junto do número, e o prompt manda citá-la: *"aumento de 2224% no Open Interest nos últimos 30 dias"*
2. Teto de sanidade. Acima dele a leitura de OI é marcada indisponível em vez de publicada. Sugiro começar em 500% e ajustar com dado real.

## 6.6 [B6] As três invalidações

O backend já publica `invalidacao_estrutura_nivel` e `invalidacao_tese_nivel` por plano (`ExecucaoService.php:362-365` e `:577-580`). **Os dois campos aparecem zero vezes no frontend.**

E o único nível exibido hoje é rotulado `A tese perde validade`, quando o que está ali é a invalidação **da operação**.

```tsx
{plano.invalidacao_operacao_nivel && (
  <Linha titulo="Invalidação da operação"
         texto="O preço nega a entrada." nivel={plano.invalidacao_operacao_nivel} />
)}
{plano.invalidacao_estrutura_nivel && (
  <Linha titulo="Invalidação da estrutura"
         texto="A estrutura que sustenta a leitura se quebra." nivel={plano.invalidacao_estrutura_nivel} />
)}
{plano.invalidacao_tese_nivel && (
  <Linha titulo="Invalidação da tese"
         texto="A tendência anterior é retomada." nivel={plano.invalidacao_tese_nivel} />
)}
```

Cada linha omitida quando o nível não existir. **Nunca a palavra "indisponível" no lugar.**

## 6.7 [B7] O arredondamento que come o risco

No BTC: risco configurado 1% de $1.000, ou seja $10,00. Quantidade exata 0,002777 BTC, arredondada para baixo até 0,002 pelo `stepSize`. Risco real $7,20, **28% abaixo do planejado**, e a tela mostra 0,7% sem nota.

Os quatro números do item 23 só aparecem quando a quantidade fica **abaixo do mínimo do contrato**, que não é este caso.

```php
$desvio = abs($riscoReal - $riscoPlanejado) / $riscoPlanejado;

if ($desvio > 0.10) {   // tolerância de 10%
    $payload['risco_planejado'] = $riscoPlanejado;
    $payload['risco_real']      = $riscoReal;
    $payload['risco_desvio_pct'] = round($desvio * 100, 1);
}
```

A tela mostra os dois lado a lado quando o desvio passar da tolerância.

---

# FASE 7 — A recalibração do fallback do stop

## 7.1 Por que isto existe

O item 10 da rodada anterior mandou a IA escolher o nível que protege a entrada, e ela faz isso. Mas o ponto 7 do mesmo item preservou um fallback: *"sem âncora específica, usa estrutura de proteção disponível"*.

**Esse fallback é o seletor automático antigo, e ele nunca foi recalibrado.** Ele disparou no SUI, com o texto na tela: *"Stop baseado em estrutura de proteção disponível. Não foi identificada uma âncora específica que invalide esta entrada."*

## 7.2 [C1] Curva de proximidade

**Arquivo.** `app/Services/NivelService.php`, linha 423

**Antes:**

```php
$notaProximidade = 1.0 / (1.0 + ($distanciaAtr / 5.0));
```

Com divisor 5,0, um nível a 3 ATR recebe 0,625 e um a 1 ATR recebe 0,833. Pouca diferença para muita distância.

**Depois:**

```php
// Divisor 1.5: a 1 ATR dá 0.600, a 3 ATR dá 0.333. A curva passa a punir
// distância de verdade. Com 5.0 um fundo de junho competia de igual para
// igual com um pivô da semana.
$notaProximidade = 1.0 / (1.0 + ($distanciaAtr / 1.5));
```

## 7.3 [C3] Recência contínua

**Arquivo.** `app/Services/NivelService.php`, linha 426

**Antes:**

```php
$notaRecencia = ($candlesAtras === null || $candlesAtras <= 120) ? 1.0 : 0.0;
```

Dois defeitos. É binário, e um nível **sem** data de nascimento recebe nota **máxima**. Cinco dos seis tipos do pool não carregam recência e ganham 15% de bônus automático.

**Depois:**

```php
// Contínua, e ausência de recência sai do cálculo em vez de ganhar nota
// cheia. Retorna null quando o tipo não carrega candles_atras; o chamador
// renormaliza os pesos restantes.
$notaRecencia = $candlesAtras === null
    ? null
    : max(0.0, 1.0 - ($candlesAtras / self::RECENCIA_JANELA_CANDLES));
```

E o somatório da nota renormaliza sobre os fatores que existem, mesma lógica da regra de ausência da Fase 3.

## 7.4 [C2] O tipo `tese` sai do pool autônomo

**Arquivo.** `app/Services/NivelService.php`, linhas 53 a 60 e 300

O tipo `tese` entra sozinho no pool valendo peso 10, o maior da tabela. É o mecanismo que faz um nível estrutural antigo ganhar do nível que realmente protege a entrada.

A `tese` continua existindo como **invalidação da tese**, que é o terceiro nível da Fase 6.6. Ela só para de competir como candidata a stop de operação.

**Antes de mexer:** rode os três casos da mesa com a mudança e me mostre qual stop cada um escolheria. Se algum ficar sem stop, **pare e me avise**.

---

# FASE 8 — As metades pendentes

## 8.1 [C4] O zero fabricado no monitor de OI

**Arquivo.** `services/oiLiquidationService.ts`, linhas 72, 74 e 91

Marcado como feito na rodada anterior, com a metade de frontend admitidamente não tocada.

**Antes:**

```ts
return { val: 0, history: [], chg5m: 0, chg1h: 0, chg24h: 0 };
...
return { price: 0, change: 0 };
```

**Depois:** `null`, e a tela mostra indisponível. Falha de coleta nunca vira leitura de zero.

**Antes de mudar:** o arquivo é consumido por `OiLiquidationMonitor` na `OiMonitorPage`. Confira que a tela trata `null` sem quebrar.

## 8.2 [C5] O grounding do contexto

O Macro veio no APT e não veio no BTC nem no SUI. O grounding novo com `google_search` nunca foi testado contra a API real do Gemini, só com resposta simulada.

**Teste ao vivo, três execuções seguidas por ativo, nos seis ativos do protocolo.** Sentimento e Macro precisam aparecer com fonte real, horário e conteúdo próprio, ou não aparecer.

## 8.3 [C7] O ícone do ativo

`AssetBadge.tsx` aponta para `assets.coincap.io`. Nos três prints o que renderiza é um círculo cinza.

Confira em ambiente real se a URL responde. Se não responder, troque a fonte. O fallback de iniciais já existe e está correto.

## 8.4 [C8] Qual cérebro está rodando

**Arquivo.** `config/genesis_graphical_v6.php`, linha 159

Hoje existem dois eixos. `AI_PROVIDER` liga o pipeline legado da V6.7, e o decisor vivo é `GENESIS_DECISION_PROVIDER`, com default `openai`, que **não bate** com a determinação de que o decisor é o Gemini 3.7.

Qual cérebro roda depende só do arquivo de ambiente, e a guarda de boot aceita os dois calada.

**O preflight passa a afirmar qual é o decisor e a falhar se for outro.** E me diga qual você quer no default antes de mexer.

---

# FASE 9 — A geometria do alvo

## 9.1 [E2] O alvo passa a conhecer o stop

Hoje o catálogo de alvos é montado **antes** de o stop existir. A IA escolhe os alvos na mesma resposta em que decide a direção, e o stop só é calculado depois. Por isso o TP1 nasce a 0,37 ATR do preço em três de três casos: ele é a barreira válida mais próxima, com piso de só 0,25 ATR.

O PHP já monta `stop_candidates` para os dois lados antes da decisão. Dá para calcular, por lado, a distância provisória do stop automático e carimbar cada candidata de alvo:

```php
$candidata['rr_provisorio'] = round(
    abs($candidata['preco'] - $precoAtual) / $stopProvisorioDistancia, 2
);
```

E no prompt:

```
- Prefira, para o TP1, a candidata mais próxima cujo rr_provisorio seja >= 1.0.
  Não havendo nenhuma, use a mais próxima válida e o plano dirá isso.
```

## 9.2 [E3] O cabeçalho reporta o R:R do plano

Uma operação com três alvos não tem um R:R, tem um R:R combinado.

```php
// Parciais declaradas. Configurável.
private const PARCIAIS = ['tp1' => 0.50, 'tp2' => 0.30, 'tp3' => 0.20];
```

No SUI, `0,50×0,35 + 0,30×1,14 + 0,20×1,67 = 0,85`. O cabeçalho mostra **1:0,85** em vez de 1:0,35, e cada alvo continua mostrando o seu.

O esquema de parciais aparece na tela, para o membro saber de onde saiu o número.

## 9.3 O rótulo alarmista

Hoje o APT mostra `PLANO NÃO RECOMENDADO` porque o TP1 dá 1:0,21. Um plano em que o TP2 paga 1:0,63 e o stop está bem colocado não é "não recomendado", é um plano de R:R modesto.

O rótulo passa a descrever o que o plano é. **O botão continua ativo em todos os casos**, como já é regra: risco e retorno abaixo do mínimo avisa, nunca bloqueia.

---

# FASE 10 — Protocolo de aceite

**Esta fase faz parte da entrega. Entrega sem ela volta.**

## 10.1 Suíte completa, com saída anexada

**Backend:**

```bash
composer install --no-interaction
composer audit --locked
vendor/bin/phpunit --testdox
php artisan genesis:graphical-preflight
```

**Frontend:**

```bash
npm ci
npm run lint
npm test
npm run build
npm audit --omit=dev
```

Anexe a saída dos nove comandos. Compare com `/tmp/suite_antes.txt` da Fase 1 e explique cada teste que mudou de status.

## 10.2 Smoke real em seis ativos diferentes

Rode o Gênesis em pelo menos seis ativos, obrigatoriamente cobrindo:

| Perfil | Por que este perfil |
|---|---|
| Tendência de alta clara | Estrutura FORTE_A_FAVOR, valida o teto da escala |
| Tendência de baixa clara | Mesmo, no sentido oposto |
| Range | Estrutura NEUTRO, valida o meio da escala |
| Derivativos ausentes ou incompletos | Valida a regra de ausência e a cobertura |
| Baixa liquidez | Valida tickSize, stepSize, lote mínimo e casas decimais |
| Um dos três da mesa | Comparação direta com 02/09 |

## 10.3 Conferência de tela, item por item

Para **cada um dos seis**, confira e registre:

**Score e famílias**
- [ ] As quatro famílias aparecem classificadas
- [ ] O score bate com a tabela aplicada às classificações
- [ ] Nenhuma penalidade pós-IA alterou o número
- [ ] Cobertura coerente com as famílias avaliadas
- [ ] Família ausente sai da conta e não derruba o score
- [ ] Cobertura abaixo de 50% publica sem número, nunca zero

**Planos e avisos**
- [ ] Alternar entre Plano A e Plano B troca também as linhas da barra de avisos
- [ ] Nenhuma tela mostra duas distâncias de stop diferentes ao mesmo tempo
- [ ] O plano primário vem pré-selecionado conforme a IA declarou
- [ ] Manchete e corpo do box do plano nunca falam de coisas diferentes
- [ ] Nenhuma frase aparece duas vezes na mesma tela

**Números**
- [ ] Zero preços com vírgula decimal em qualquer texto
- [ ] Zero preços com mais casas que o tickSize do contrato
- [ ] Cifrão colado, sem espaço, em toda a tela
- [ ] R:R do cabeçalho é o do plano, com as parciais visíveis
- [ ] Risco planejado e real lado a lado quando o desvio passar de 10%

**Texto**
- [ ] Nenhum código em caixa alta com underline em nenhum campo
- [ ] Nenhum texto nomeia serviço, orçamento, fila ou endpoint
- [ ] Texto do score sem ". e" e sem ".."
- [ ] Open Interest com a janela nomeada
- [ ] Nenhuma citação de preço defasado

**Cards obrigatórios**
- [ ] **Sentimento da moeda** com conteúdo próprio, fonte e horário, ou ausente
- [ ] **Macro e Geopolítico** com conteúdo próprio, fonte e horário, ou ausente
- [ ] Card marcado como indisponível não exibe dado ao mesmo tempo
- [ ] Três execuções seguidas do mesmo ativo: os dois cards aparecem nas três

**Estrutura**
- [ ] Os três níveis de invalidação com os nomes corretos, cada um omitido quando ausente
- [ ] O ícone do ativo carrega, ou cai nas iniciais
- [ ] O preflight afirma qual é o decisor

## 10.4 O que entregar

1. Os dois repositórios, exatamente a árvore que rodou a suíte
2. A saída dos nove comandos
3. Os seis JSONs públicos finais, um por ativo
4. Captura de tela dos seis
5. O checklist de 10.3 preenchido, seis vezes
6. A lista de consumidores levantada antes de cada remoção
7. A lista de qualquer desvio, **comunicado antes de implementar**

---

# RESUMO DAS DEPENDÊNCIAS

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

---

**Qualquer dúvida, pergunte antes de implementar. Um item mal interpretado custa mais caro que uma pergunta.**
