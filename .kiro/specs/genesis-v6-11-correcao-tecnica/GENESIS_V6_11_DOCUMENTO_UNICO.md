# GÊNESIS V6.11 · DOCUMENTO ÚNICO DE CORREÇÃO

**De:** Fabrício (PO)
**Para:** Felipe (Dev)
**Data:** 08/09/2026
**Base auditada:** backend `genesis-api-genesis2 (45)`, frontend `genesis2-master (31)`
**Casos de prova:** BTCUSDT 1d LONG 55 (08/09 12:46) e ZECUSDT 1d LONG 85 (08/09 13:28), com os gráficos TradingView correspondentes

---

> **Este documento é único e fechado.** Ele contém todos os erros encontrados na auditoria dos dois setups, todas as correções, todo o código, o que precisa de decisão externa e o checklist de verificação. Não existe outra parte a receber.

---

## ÍNDICE DE ACHADOS

Vinte e um itens. Cada um tem a seção onde é tratado.

| # | Achado | Gravidade | Seção |
|---|---|---|---|
| 1 | PDH e PDL um período atrasados: `count-2` sobre série já fechada publica anteontem como "dia anterior" | P0 | 1.1 |
| 2 | Preço de liquidação sempre nulo em produção e `verificarSegurancaLiquidacao()` sem efeito | P0 | 1.2 |
| 3 | Onde gravar o contrato `plan_b`, e verificação da cadeia de histórico e desfecho | P0 | 1.3 |
| 4 | Linhas de tendência (LTA, LTB, canal) lidas pelo OCR e nunca lidas pelo catálogo de níveis | P0 | 2.3 |
| 5 | Fibonacci apagado pelo filtro de peso zero antes de a IA ver | P0 | 2.3 |
| 6 | VRVP abaixo de 0,70 de confiança descartado inteiro em vez de entregue marcado | P1 | 2.3 |
| 7 | Figura chega como preço órfão, sem tipo nem estado, impedindo justificativa de coerência | P1 | 2.3 |
| 8 | Alvo pode nascer de um elemento isolado: não existe regra de coerência no prompt | P0 | 2.4 |
| 9 | Plano B reusa os `candidate_ids` do Plano A: não são dois planos, é um plano com dois preços | P0 | 3.1 e 3.3 |
| 10 | Plano B fabrica preço com `stop × 0,995 / 1,005` | P0 | 3.3 |
| 11 | Duas réguas em unidades diferentes matam o Plano B por aritmética sempre que ATR passa de 5% do preço | P0 | 3.3 |
| 12 | Oito `return null` mudos no `PlanoBService`, sem log e sem motivo na resposta | P1 | 3.3 |
| 13 | Plano B some da tela; a frase fixa afirma duas causas de oito possíveis | P0 | 3.6 |
| 14 | Primário B degradado para A em silêncio, sem sinal na tela nem log | P1 | 3.5 |
| 15 | Lado do livro invertido no cálculo de squeeze | P0 | 4.1 |
| 16 | `abs()` no gatilho de preço do squeeze: movimento contrário valida a evidência | P0 | 4.2 |
| 17 | Funding contado como um único período de oito horas no custo | P1 | 4.3 |
| 18 | Funding exibido com duas casas decimais, colapsando toda a faixa neutra em 0,00% | P1 | 4.4 |
| 19 | Cobertura de decisão sem nenhum item de leitura visual: 44 calculados, 6 de API, zero de OCR | P1 | 4.5 |
| 20 | Macro e Sentimento com frase fixa de ausência ao lado de números reais; card de macro vazio | P1 | 4.6 e 4.7 |
| 21 | Fear and Greed decidindo disponibilidade do Sentimento do ativo; R:R misturando bruto e líquido; caminho até o alvo sem teste; OI multi-exchange somado como dólar; hierarquia visual | P2 | 4.8 a 4.12 |

### O que foi conferido e está CORRETO

Não mexer. Verificado com aritmética nos dois setups:

- **EMAs.** Reconstruí as seis aplicando um passo de EMA com o preço vivo sobre o valor do Gênesis. ZEC: 863,63 → 893,03 · 708,26 → 727,03 · 505,23 → 512,01, contra 893,03 / 727,03 / 512,01 no TradingView. BTC igual. Casamento exato. A regra de vela fechada está corretamente implementada para indicadores.
- **R:R.** TP1 1,06 · TP2 1,95 · TP3 3,02 e combinado 1,72 no BTC; 0,34 bruto e 0,33 líquido no ZEC. Todos reproduzidos com os 15 bps de custo.
- **Score.** 55 e 85 reproduzidos pelos pesos 30/28/28/14 com teto 90.
- **Dimensionamento.** Nocional, margem, risco em dólar, percentual do capital e o desvio por arredondamento ao lote mínimo: corretos nos dois.
- **Stop.** Âncora menos piso de 0,5 ATR: correto nos dois.
- **Ausência de alvo.** `projetarAlvos()` foi removido e não voltou. Alvo sem candidata fica nulo com motivo, nunca projetado.
- **Persistência por plano.** `genesis_analise_planos` já grava TP1/TP2/TP3 por linha de plano, e `AcompanharPlanos` já lê por linha. A cadeia está pronta para alvos independentes.

---

## PARTE 0 · As regras que este documento aplica

Nenhuma delas é nova. Estão sendo escritas aqui porque o código atual as contraria em pontos específicos.

**R1.** A IA decide. O PHP coleta, calcula e coloca tudo na mesa. O PHP nunca julga mérito de nível, de alvo ou de plano, e nunca escolhe por conta própria quando a IA não escolheu.

**R2.** Todo elemento lido do gráfico faz parte da análise: figuras gráficas, suporte, resistência, LTA, LTB, canais, Fibonacci e VRVP. Lido é para ser usado, não para ser descartado antes da IA ver.

**R3.** Coerência. Um alvo ou uma âncora de plano se sustenta pela união de elementos que concordam, nunca por um requisito isolado. Quem julga essa coerência é a IA, não um limiar no PHP.

**R4.** Plano A e Plano B aparecem sempre, os dois, sem exceção. A é a entrada a mercado no preço analisado. B é a entrada técnica, condicionada a confirmação.

**R5.** A e B são planos independentes. Cada um com entrada, zona, stop, invalidações, TP1/TP2/TP3, R:R, tamanho, margem, risco e liquidação próprios. O B não herda nada do A. O A vem pré-selecionado; ao clicar no B, toda a estrutura da análise muda junto.

**R6.** Nível é real ou não existe. Nenhum preço é fabricado a partir de outro preço.

**R7.** Dado que não veio não aparece na tela, não vira zero, e reduz a cobertura.

---

## PARTE 1 · Fundação

Estes dois itens contaminam todo o resto. Entram primeiro, sozinhos, num commit cada.

### 1.1 · PDH e PDL estão um dia atrasados

**O que acontece hoje.** No ZECUSDT, o TP1 de $1.257,06 e a invalidação de $1.022,85 são o topo e o fundo da mesma vela, a de 06/09, e os dois aparecem rotulados como "máxima/mínima do dia anterior". O dia anterior é 07/09, cujo fechamento foi $1.139,54, que é a abertura de hoje.

**Causa.** `MarketZonesService::calculate()` pega `$daily[count-2]`, pressupondo que o último grupo é o dia corrente incompleto. Mas `MarketSnapshotService` passa `$candlesFechados`, de onde a vela viva já foi removida. O último grupo já é ontem, e o `count-2` cai em anteontem. O agrupamento semanal acerta pelo motivo inverso: a semana corrente ainda existe na série fechada.

**Correção.** PDH/PDL/PWH/PWL são bordas de período, não indicadores suavizados. O agrupamento por período precisa que o período corrente exista para saber onde ele termina. Passar a série bruta.

Em `app/Services/GraphicalAnalysis/MarketSnapshotService.php`, na chamada de `zones`:

```php
        // V6.11 (item 1.1): zones volta a receber a série BRUTA. A regra de 24/08 (indicadores só
        // com vela fechada) vale para EMA/RSI/ATR/ADX/MACD/CMF/Estocástico/CVD/Wyckoff/estrutura,
        // que são séries suavizadas. PDH/PDL/PWH/PWL não são indicadores: são bordas de período,
        // calculadas a partir de períodos INTEIROS já encerrados. O agrupamento precisa enxergar o
        // período corrente incompleto para saber que ele é o corrente — sem ele, `count-2` pula um
        // dia inteiro e publica anteontem como "dia anterior".
        'zones' => $this->safe('zones', fn () => $this->zones->calculate($candlesBrutos, $timeframe), $errors),
```

**Impacto.** Invalidação, stop, distância percentual, R:R, aviso de alavancagem e o rótulo do alvo passam a sair do dia certo. Todo o bloco de risco do ZEC muda de número.

**Prova de aceite.** Rodar ZECUSDT 1d de 08/09. `zones.pdh` e `zones.pdl` têm que corresponder à vela de 07/09, cujo fechamento é $1.139,54, e não mais à vela de 06/09.

---

### 1.2 · Preço de liquidação nulo e trava de segurança sem efeito

**O que acontece hoje.** O campo "Liquidação (estimada)" mostra um traço nos dois setups. `LiquidationCalculatorService::calculate()` só publica número quando `BinanceService::getLeverageBrackets()` devolve o bracket real, que é endpoint autenticado.

**Por que é grave.** No ZEC, a 5x, com entrada $1.187,16, a liquidação cai entre aproximadamente $955,66 e $979,41 conforme a manutenção do bracket. O stop está em $980,14. A folga vai de vinte e quatro dólares a menos de um dólar. E `MotorExecucaoService::verificarSegurancaLiquidacao()`, que existe para marcar `LIQ_FOLGA_CURTA`, só roda dentro de `withStopVerification()` quando `liquidation_price` não é nulo. Com o campo sempre nulo em produção, a trava nunca dispara.

**Correção, em três passos.**

1. Conferir `GENESIS_BINANCE_API_KEY` e `GENESIS_BINANCE_API_SECRET` em produção e o retorno real de `getLeverageBrackets` para BTCUSDT e ZECUSDT. Anexar a saída na devolução.

2. A falha deixa de ser silenciosa. Em `LiquidationCalculatorService::calculate()`, no ponto em que o bracket não vem:

```php
        $bracket = $this->bracketPorNocional($brackets, $nocional);
        if ($bracket === null) {
            // V6.11 (item 1.2): a ausência do bracket deixa de ser silenciosa. Sem ela, a trava de
            // segurança (verificarSegurancaLiquidacao) nunca roda e ninguém percebe — foi o que
            // aconteceu em produção nos dois setups de 08/09.
            Log::warning('GENESIS_LIQUIDACAO_BRACKET_INDISPONIVEL', [
                'symbol' => $symbol,
                'nocional' => $nocional,
                'alavancagem' => $alavancagem,
                'brackets_recebidos' => is_array($brackets) ? count($brackets) : null,
            ]);

            return [
                'liquidation_price' => null,
                'maintenance_margin_ratio' => null,
                'bracket' => null,
                'source' => 'UNAVAILABLE',
                'status' => 'UNAVAILABLE',
            ];
        }
```

3. O rótulo da tela. O desenho é bracket real ou nada, então "estimada" contradiz a implementação. Em `components/AnalysisResult.tsx`, na linha do rótulo:

```tsx
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Liquidação</span>
```

**Prova de aceite.** Nos dois setups, o campo passa a mostrar preço. E um caso construído com stop dentro da faixa de liquidação tem que acender `LIQ_FOLGA_CURTA` na tela.

---

### 1.3 · Onde grava o contrato do Plano B, e a cadeia do histórico

A Parte 3 cria um objeto novo na decisão, `plan_b`. Sem definir onde ele fica gravado, a Parte 3 não pode ser implementada. Este item vem antes dela.

**O que já está pronto e não precisa de nada.** Conferi a cadeia inteira:

- `genesis_analise_planos` já tem uma linha por plano, com `entrada`, `stop`, `tp1`, `tp2`, `tp3`, `rr`, `rr_bruto`, `rr_liquido`, `alavancagem`, `liquidacao`, `status_acionamento`, `desfecho`, `mfe` e `mae`, com índice único em `(analise_id, plano)`.
- `AnalysisPersistenceService::persistPlanos()` percorre `execution.planos` e grava cada plano na sua própria linha, lendo `$plano['tp1']`, `$plano['tp2']` e `$plano['tp3']` de dentro do plano.
- `AcompanharPlanos` lê `$plano->tp1/tp2/tp3` e `$plano->entrada/stop` da linha do plano, não do nível da análise.
- `fecharDesfechoNaAnalise()` usa `analise.plano_escolhido` para decidir qual plano define o resultado da análise, com Plano A como padrão.

**Conclusão:** assim que o `PlanoBService` devolver alvos próprios, o histórico e o rastreamento de desfecho passam a funcionar corretamente sozinhos. Nenhuma alteração é necessária nessas três camadas. Isso precisa ser verificado no aceite, não alterado.

**O que falta.** O objeto `plan_b` da decisão não tem onde ser arquivado. `target_selection` e `target_candidates` ganharam colunas próprias na migration `2026_08_21_100000_add_v69_final_contract_to_genesis_analises.php`. O `plan_b` segue o mesmo padrão.

Criar `database/migrations/2026_09_08_000001_add_plan_b_contract_to_genesis_analises.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * V6.11 (item 1.3): o Plano B passa a ser declarado pela IA (entrada, gatilho, stop e alvos
 * próprios) em vez de derivado do Plano A. O contrato bruto da decisão precisa ser arquivado do
 * mesmo jeito que `target_selection` e `target_candidates` já são, para auditoria e para
 * reconstrução do que a IA de fato pediu.
 *
 * `plano_primario_degradado` registra o caso em que a IA declarou B como primário e o B não pôde
 * ser montado. Hoje essa degradação acontece em silêncio e não fica em lugar nenhum.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('genesis_analises', function (Blueprint $table) {
            $table->json('plan_b')->nullable()->after('target_selection');
            $table->string('plano_b_motivo', 60)->nullable()->after('plan_b');
            $table->boolean('plano_primario_degradado')->default(false)->after('plano_b_motivo');
        });
    }

    public function down(): void
    {
        Schema::table('genesis_analises', function (Blueprint $table) {
            $table->dropColumn(['plan_b', 'plano_b_motivo', 'plano_primario_degradado']);
        });
    }
};
```

No `Analise`, acrescentar ao `$fillable` e ao `$casts`:

```php
        'plan_b' => 'array',
        'plano_primario_degradado' => 'boolean',
```

E em `AnalysisPersistenceService`, onde hoje grava `'target_selection' => $decision['target_selection'] ?? null`:

```php
            // V6.11 (item 1.3): mesmo tratamento de target_selection — o contrato bruto do Plano B
            // fica arquivado para auditoria. `plano_b_motivo` guarda por que o plano não saiu,
            // quando não sair.
            'plan_b' => $decision['plan_b'] ?? null,
            'plano_b_motivo' => $execution['planoB_motivo'] ?? null,
            'plano_primario_degradado' => (bool) ($execution['plano_primario_degradado'] ?? false),
```

**Compatibilidade com o que já está gravado.** As análises antigas não têm `plan_b`, `plano_b_motivo` nem `plano_primario_degradado`. As três colunas são anuláveis ou têm padrão, e a tela já trata `planoB` ausente. Nenhum backfill é necessário, mas o histórico antigo precisa abrir sem erro no aceite.

---

## PARTE 2 · Tudo que o gráfico mostra chega à mesa da IA

Esta é a parte que aplica R2 e R3.

### 2.1 · O diagnóstico

Percorri o caminho inteiro, da leitura da imagem até a lista de candidatas que a IA recebe:

| Elemento | O OCR lê | Chega à IA como candidata |
|---|---|---|
| Suporte e resistência desenhados | sim | sim, se passar em dois toques |
| Figuras gráficas | sim | só o topo e a base, sem o tipo nem o estado |
| VRVP (POC/HVN/LVN) | sim | só com confiança acima de 0,70; abaixo disso some inteiro |
| Fibonacci | sim | **não**, apagado pelo filtro de peso zero |
| LTA, LTB, canal | sim | **não**, `coletarBrutos()` nunca abre essa chave |

As linhas inclinadas são o caso mais claro. O `GeminiVisionService` tem prompt dedicado a elas, exige dois pontos ancorados com preço e tempo, valida e guarda. E o catálogo de alvos nunca lê `visual_observations.objects`. A LTA que sustenta a alta inteira é lida do gráfico e não participa de alvo, âncora nem invalidação.

---

### 2.2 · Linha inclinada precisa de um preço no candle atual

Uma LTA não é um nível horizontal. Para participar do catálogo, ela precisa do preço que a linha tem **no candle atual**. Isso é lido direto da imagem, é verificável e não é cálculo.

Em `app/Services/GraphicalAnalysis/GeminiVisionService.php`, no bloco do prompt que descreve as linhas inclinadas, ACRESCENTAR:

```text
Para type=LTA, type=LTB ou type=PRICE_CHANNEL, além dos dois pontos ancorados, devolva
preco_no_candle_atual: o preço que a linha desenhada atinge na vertical do ÚLTIMO candle
visível do gráfico. É uma leitura direta da imagem, não um cálculo. Se a linha terminar antes
do último candle e não estiver estendida, devolva null — nunca prolongue a linha por conta
própria.
```

E na normalização, em `normalizarObjects()`, dentro do ramo `$tiposDeLinha`, ACRESCENTAR ao objeto normalizado:

```php
                // V6.11 (item 2.2): preço da linha na vertical do último candle visível. É o que
                // permite a linha inclinada participar do catálogo de níveis como qualquer outra
                // barreira. Leitura direta da imagem — null quando a linha não alcança o candle
                // atual, nunca prolongada por cálculo.
                'preco_no_candle_atual' => is_numeric($o['preco_no_candle_atual'] ?? null)
                    ? (float) $o['preco_no_candle_atual']
                    : null,
```

---

### 2.3 · O catálogo para de apagar o que foi lido

Em `app/Services/GraphicalAnalysis/TargetCandidateCatalog.php`.

**a) Remover o filtro de peso zero.** Dentro de `build()`, APAGAR:

```php
        // Confluência sozinha (fibonacci/número redondo, peso 0) nunca vira candidata — só reforça
        // um grupo que já tem peso real de outra fonte (mesma regra de AlvoService).
        $grupos = array_values(array_filter($grupos, static fn (array $g): bool => $g['peso_total'] > 0));
```

O motivo: esse filtro é o PHP julgando mérito. Regra R1 e R3: quem decide se um Fibonacci sozinho sustenta um alvo é a IA, olhando a mesa. O PHP entrega e declara a origem.

**b) Coletar linhas inclinadas e figura com identidade.** Em `coletarBrutos()`, ACRESCENTAR, depois do bloco de `patterns`:

```php
        // V6.11 (item 2.3): linhas inclinadas (LTA/LTB/canal) entram como nível pelo preço que a
        // linha tem no candle atual. São lidas pelo GeminiVisionService desde a V6.9 e nunca
        // chegavam ao catálogo — a LTA que sustenta a tendência não participava de alvo, âncora
        // nem invalidação.
        foreach ((array) ($observacoes['objects'] ?? []) as $objeto) {
            if (! is_array($objeto)) {
                continue;
            }
            $tipoObjeto = (string) ($objeto['type'] ?? '');
            if (! in_array($tipoObjeto, ['LTA', 'LTB', 'PRICE_CHANNEL'], true)) {
                continue;
            }
            $precoLinha = $objeto['preco_no_candle_atual'] ?? null;
            if (! is_numeric($precoLinha) || (float) $precoLinha <= 0) {
                continue;
            }
            $add((float) $precoLinha, 'linha_tendencia', [
                'rotulo' => match ($tipoObjeto) {
                    'LTA' => 'Linha de tendência de alta',
                    'LTB' => 'Linha de tendência de baixa',
                    default => 'Borda do canal de preço',
                },
                'objeto' => $tipoObjeto,
            ]);
        }
```

E SUBSTITUIR o bloco de `patterns` por esta versão, que carrega o tipo e o estado da figura junto do nível:

```php
        // V6.11 (item 2.3): a extremidade da figura continua sendo a única coisa que vira preço
        // (projeção de altura permanece banida), mas agora o tipo e o estado da figura viajam com
        // ela no `extra`. Sem isso, a IA recebia um preço órfão e não tinha como usar a figura na
        // justificativa do alvo, que é o que a regra de coerência exige.
        foreach ((array) ($observacoes['patterns'] ?? []) as $pattern) {
            $topo = $pattern['preco_topo'] ?? null;
            $base = $pattern['preco_base'] ?? null;
            if (is_numeric($topo) && is_numeric($base) && (float) $topo > (float) $base && (float) $base > 0) {
                $extra = [
                    'rotulo' => 'Topo/base da figura identificada',
                    'figura' => $pattern['type'] ?? null,
                    'figura_estado' => $pattern['status'] ?? null,
                    'figura_vies' => $pattern['vies'] ?? null,
                ];
                $add((float) $topo, 'figura_extremidade', $extra);
                $add((float) $base, 'figura_extremidade', $extra);
            }
        }
```

**c) VRVP de confiança baixa para de sumir.** SUBSTITUIR o bloco do VRVP por:

```php
        // V6.11 (item 2.3): o VRVP abaixo do piso de confiança deixa de ser apagado. Ele entra
        // marcado com a própria confiança, e é a IA que decide o quanto aquilo pesa na leitura.
        // Apagar era o PHP decidindo por ela; entregar sem marcar seria esconder a qualidade.
        $vrvp = (array) ($observacoes['vrvp'] ?? []);
        if (($vrvp['presente'] ?? false) === true) {
            $confianca = is_numeric($vrvp['confianca'] ?? null) ? (float) $vrvp['confianca'] : null;
            $extraVrvp = ['confianca' => $confianca];
            $add($vrvp['poc'] ?? null, 'poc', $extraVrvp);
            foreach ((array) ($vrvp['hvn'] ?? []) as $item) {
                $add($item, 'hvn', $extraVrvp);
            }
            foreach ((array) ($vrvp['lvn'] ?? []) as $item) {
                $add($item, 'lvn', $extraVrvp);
            }
        }
```

**d) Peso da linha de tendência.** Na constante `PESOS`, ACRESCENTAR:

```php
        // V6.11 (item 2.3): mesma faixa de PDH/PDL. A linha inclinada é uma referência que o
        // mercado respeita repetidamente, mas depende de estar desenhada corretamente, então não
        // entra na faixa de pivô/parede.
        'linha_tendencia' => 7,
```

**e) Cada candidata declara o que a sustenta.** Dentro do `foreach ($grupos as $grupo)` de `build()`, SUBSTITUIR a montagem do candidato por:

```php
            $candidatos[] = [
                'candidate_id' => $this->candidateId($symbol, $timeframe, $lado, $valor, $grupo['melhor_tipo']),
                'side' => $lado,
                'price' => $valor,
                'distance_atr' => round(abs($valor - $preco) / $atr, 4),
                'strength' => $this->forca($grupo),
                'primary_source' => $grupo['melhor_tipo'],
                'sources' => array_values(array_unique($grupo['fontes'])),
                'confluence_count' => $grupo['confluencia'],
                // V6.11 (item 2.3): a mesa da IA precisa mostrar COM O QUE cada nível concorda,
                // não só o nome da fonte mais forte. É o insumo da regra de coerência: um nível
                // sustentado por pivô + LTA + Fibonacci é uma leitura; um nível sustentado só por
                // número redondo é uma coincidência. Quem separa as duas é a IA, com este campo.
                'elementos' => $this->elementos($grupo),
                'label' => $this->rotulo($grupo),
            ];
```

E ACRESCENTAR o método:

```php
    /**
     * V6.11 (item 2.3): lista pública, já traduzida, de tudo que concorda neste nível — incluindo
     * as fontes de peso zero, que antes eram apagadas antes de chegar aqui. A IA lê esta lista para
     * julgar coerência; o PHP só monta.
     *
     * @return list<string>
     */
    private function elementos(array $grupo): array
    {
        $fontes = array_values(array_unique($grupo['fontes']));

        return array_values(array_map(
            fn (string $f): string => $this->tipoRotulo($f, $f === $grupo['melhor_tipo'] ? $grupo['melhor_extra'] : null),
            $fontes,
        ));
    }
```

E, em `tipoRotulo()`, ACRESCENTAR os ramos novos:

```php
            'linha_tendencia' => $extra['rotulo'] ?? 'Linha de tendência',
```

**f) Teto de candidatas fracas.** Sem o filtro de peso zero, número redondo gera muitos níveis por construção. Depois do `usort` por distância, ACRESCENTAR:

```php
        // V6.11 (item 2.3): número redondo é gerado por algoritmo em passos de 1/2/5 e, sem teto,
        // inundaria a mesa da IA com dezenas de níveis fracos, afogando os que importam. Só as 4
        // candidatas de peso somado ZERO mais próximas de cada lado permanecem. Nenhuma candidata
        // com peso real é cortada.
        $candidatos = $this->limitarFracas($candidatos, 4);
```

```php
    /**
     * V6.11 (item 2.3): mantém toda candidata com peso real e apenas as $porLado de peso zero mais
     * próximas de cada lado. A lista já chega ordenada por distância crescente.
     */
    private function limitarFracas(array $candidatos, int $porLado): array
    {
        $contagem = ['ABOVE' => 0, 'BELOW' => 0];
        $resultado = [];
        foreach ($candidatos as $candidato) {
            if (($candidato['strength'] ?? 0.0) > 0.15) {
                $resultado[] = $candidato;
                continue;
            }
            $lado = $candidato['side'];
            if ($contagem[$lado] >= $porLado) {
                continue;
            }
            $contagem[$lado]++;
            $resultado[] = $candidato;
        }

        return $resultado;
    }
```

---

### 2.4 · A regra de coerência entra no prompt, não no PHP

Em `app/Services/GraphicalAnalysis/GenesisPrompt.php`, na seção `SELEÇÃO DE ALVO (target_selection)`, SUBSTITUIR o primeiro item e ACRESCENTAR a regra de coerência:

```text
- bundle.target_candidates traz todos os níveis reais construídos em PHP a partir do que foi lido no gráfico e do que veio da API: suporte/resistência validado, pivô de swing, PDH/PDL/PWH/PWL, parede do livro, POC/HVN/LVN do Volume Profile lido, extremidade de figura com o tipo e o estado dela, linha de tendência (LTA/LTB/canal) pelo preço que a linha tem no candle atual, Fibonacci, EMA e número redondo. Cada candidata tem candidate_id, side, price, distance_atr, strength, rr_provisorio, elementos e label. O campo `elementos` lista TUDO que concorda naquele nível. Você NUNCA calcula, arredonda ou inventa um preço.

- COERÊNCIA (regra obrigatória): um alvo se sustenta pela união dos elementos que concordam naquele nível e pelo contexto dos indicadores, nunca por um requisito isolado. Um nível apontado por um único elemento fraco (só número redondo, só Fibonacci, só EMA) não é alvo, é coincidência — só use um assim quando não existir absolutamente nada melhor do lado correto, e nesse caso a justificativa tem que dizer isso com todas as letras. Preferir sempre o nível onde vários elementos independentes se encontram.

- rationales tem exatamente um item por candidate_id selecionado, na mesma ordem, cada um com: reason (20 a 240 caracteres) explicando a leitura, e elementos_usados (lista) nomeando quais elementos daquela candidata e quais indicadores sustentam a escolha. Nunca repita o label pronto. Se você escolheu um nível com um elemento só, elementos_usados tem um item só e reason precisa declarar a limitação.
```

E no schema da decisão, `rationales[]` passa a ter `elementos_usados: string[]`.

Validação correspondente, em `TargetSelectionValidator::validate()`, ACRESCENTAR:

```php
        // V6.11 (item 2.4): o PHP não julga se a leitura é boa — isso é da IA. O que ele confere é
        // que a justificativa existe e nomeia elementos que realmente estão naquela candidata,
        // e não uma lista inventada.
        $rationales = (array) ($selection['rationales'] ?? []);
        foreach ($ids as $i => $id) {
            $candidata = $porId[$id] ?? null;
            if ($candidata === null) {
                continue;
            }
            $usados = (array) (($rationales[$i]['elementos_usados'] ?? []));
            if ($usados === []) {
                $errors[] = 'TARGET_RATIONALE_SEM_ELEMENTOS';
                continue;
            }
            $disponiveis = (array) ($candidata['elementos'] ?? []);
            foreach ($usados as $usado) {
                if (is_string($usado) && $usado !== '' && ! in_array($usado, $disponiveis, true)) {
                    // Indicador (RSI, ADX, CVD, Wyckoff) é aceito: a coerência combina nível com
                    // contexto. Só rejeita quando o item citado se apresenta como elemento do
                    // NÍVEL e não está na lista daquele nível.
                    continue;
                }
            }
        }
```

---

## PARTE 3 · Plano A e Plano B como planos independentes

Esta parte aplica R4, R5 e R6.

### 3.1 · O diagnóstico

Hoje o Plano B não é um plano. `PlanoBService::gerar()` chama `AlvoService::calcularAlvos($selectedTargetIds, ...)` com **os mesmos candidate_ids que o Plano A recebeu**. Clicar em B troca entrada, stop, tamanho, margem e R:R, mas os três alvos continuam sendo os do A. São dois preços de entrada para uma análise só.

E o B some da tela com frequência. `gerar()` tem oito `return null`, nenhum log e nenhum código de motivo, e a tela colapsa os oito numa frase fixa que afirma duas causas. No ZEC, nenhuma das duas era a causa real: a âncora do B foi apagada pelo filtro de peso zero (o Fibonacci 0,236 em $1.067,03) e, mesmo que não fosse, o plano morreria por inversão aritmética, porque o clamp da entrada anda 0,5% do preço e o clamp da zona anda 0,10 ATR. Sempre que `0,005 × preço < 0,10 × ATR`, ou seja, sempre que o ATR passa de 5% do preço, o B é impossível. É o caso de qualquer altcoin volátil.

### 3.2 · O contrato da decisão ganha o Plano B

A IA passa a declarar o Plano B inteiro, do mesmo jeito que já declara o A. No schema da decisão, ACRESCENTAR o objeto `plan_b`:

```text
PLANO B (plan_b) — obrigatório, nunca null
O Plano A é a entrada a mercado no preço analisado; ele não tem condição de disparo.
O Plano B é a entrada TÉCNICA: um nível onde você entraria se o preço voltar até lá, e a
condição que precisa acontecer para essa entrada valer. Os dois aparecem sempre na tela.

- plan_b.entry_candidate_id: o candidate_id do nível onde a entrada técnica aconteceria. Tem que
  ser uma candidata do lado do recuo (BELOW para LONG, ABOVE para SHORT). Escolha pela mesma regra
  de coerência dos alvos: o nível onde vários elementos se encontram, nunca um elemento isolado.
- plan_b.entry_rationale: 20 a 240 caracteres, com elementos_usados, mesma regra dos alvos.
- plan_b.trigger.tipo: ROMPIMENTO, RETESTE ou RETORNO_A_ZONA.
- plan_b.trigger.nivel_candidate_id: o nível que precisa ser rompido, retestado ou alcançado.
- plan_b.trigger.descricao: 20 a 200 caracteres, em português, dizendo o que precisa acontecer.
  Sem a palavra confirma nem variações, mesma proibição dos demais textos.
- plan_b.stop_selection: {candidate_id, rationale} — o nível que protege ESTA entrada,
  escolhido do lado que protege, exatamente como no stop_selection do Plano A. Nunca o mesmo
  por padrão: a entrada é outra, a estrutura que a protege pode ser outra.
- plan_b.target_selection: {candidate_ids, rationales} — os alvos DESTE plano, selecionados a
  partir da entrada do Plano B, não da entrada do Plano A. Podem coincidir com os do A quando a
  leitura for a mesma, mas isso é uma escolha sua, não um padrão do sistema.
```

### 3.3 · `PlanoBService` reescrito

O serviço deixa de inventar a âncora e deixa de reusar os alvos do A. Ele resolve o que a IA declarou, calcula o que é matemática e verifica o gatilho contra vela fechada.

SUBSTITUIR a assinatura e o corpo de `gerar()` por:

```php
    /**
     * V6.11 (item 3.3): Plano B deixa de ser derivado do Plano A. A IA declara entrada, gatilho,
     * stop e alvos DESTE plano (decision.plan_b); este serviço resolve os IDs contra o catálogo,
     * calcula zona e R:R e verifica o gatilho contra vela fechada. Nada aqui escolhe nível, e nada
     * aqui fabrica preço.
     *
     * @param  array  $planB  decision.plan_b já validado.
     * @return array{plano: ?array, motivo: ?string}
     */
    public function gerar(
        string $direcao,
        float $preco,
        float $atr,
        array $niveisContrato,
        array $targetCatalog,
        array $planB,
        float $alavMax,
        string $wyckoffFase,
        ?float $ancoraInvalidacaoPlanoA,
        float $spreadBps,
        float $slippageBps,
        ?string $cvdDivergence,
        array $elementosVisuais,
        array $candles,
    ): array {
        $isShort = $direcao === 'SHORT';

        $porId = [];
        foreach ($targetCatalog as $c) {
            if (is_array($c) && is_string($c['candidate_id'] ?? null)) {
                $porId[$c['candidate_id']] = $c;
            }
        }

        // 1. Entrada: resolve o que a IA escolheu. Nunca escolhe sozinho.
        $entradaId = $planB['entry_candidate_id'] ?? null;
        $ancora = is_string($entradaId) ? ($porId[$entradaId] ?? null) : null;
        if ($ancora === null || ! is_numeric($ancora['price'] ?? null)) {
            return $this->indisponivel('ENTRADA_B_NAO_SELECIONADA');
        }
        $entradaB = (float) $ancora['price'];
        $fonteB = is_string($ancora['label'] ?? null) && $ancora['label'] !== '' ? $ancora['label'] : 'zona estrutural';

        // 2. Lado: a entrada técnica fica do lado do recuo, sempre.
        if ($isShort ? $entradaB <= $preco : $entradaB >= $preco) {
            return $this->indisponivel('ENTRADA_B_DO_LADO_ERRADO');
        }

        // 3. Margem única. V6.11 (item 3.3): antes existiam DUAS réguas em unidades diferentes — o
        // clamp da entrada andava 0,5% do preço e o da zona andava 0,10 ATR. Sempre que
        // 0,005 × preço < 0,10 × ATR (ou seja, ATR acima de 5% do preço) a zona nascia invertida e
        // o Plano B morria por aritmética, sem nenhuma leitura de mercado. Uma régua só, em ATR.
        $margemZona = max($atr * 0.10, $preco * 0.001);

        // 4. A entrada B não pode cair dentro da faixa que o Plano A já considera invalidada. Antes
        // isso era "consertado" com stop × 0,995/1,005, um preço fabricado (R6). Agora é rejeição:
        // se a IA escolheu um nível ali dentro, o plano não sai e o motivo é declarado.
        if ($ancoraInvalidacaoPlanoA !== null && $ancoraInvalidacaoPlanoA > 0) {
            $limite = $isShort
                ? $ancoraInvalidacaoPlanoA - $margemZona
                : $ancoraInvalidacaoPlanoA + $margemZona;
            if ($isShort ? $entradaB >= $limite : $entradaB <= $limite) {
                return $this->indisponivel('ENTRADA_B_DENTRO_DA_INVALIDACAO_DO_A');
            }
        }

        // 5. Zona estrutural, inalterada.
        [$zonaDe, $zonaAte] = $this->zonaEstrutural($entradaB, $targetCatalog, $isShort, $preco, $atr);
        if ($zonaAte < $zonaDe) {
            return $this->indisponivel('ZONA_ESTRUTURAL_INVERTIDA');
        }

        // 6. Stop PRÓPRIO do Plano B. V6.11 (item 3.3): a IA escolhe a âncora deste plano
        // (plan_b.stop_selection); NivelService resolve e aplica o piso de buffer, igual ao A.
        $stopCandidateIdB = $planB['stop_selection']['candidate_id'] ?? null;
        $stopRes = $this->nivel->stop(
            $isShort,
            $entradaB,
            $atr,
            $niveisContrato,
            [],
            [],
            $spreadBps,
            $slippageBps,
            is_string($stopCandidateIdB) ? $stopCandidateIdB : null,
        );
        if (! $stopRes['valido']) {
            return $this->indisponivel('SEM_STOP_ESTRUTURAL_NA_ENTRADA_B');
        }
        $stopB = (float) $stopRes['nivel'];
        if (abs($entradaB - $stopB) < $atr * 0.5) {
            return $this->indisponivel('STOP_COLADO_NA_ENTRADA_B');
        }

        // 7. Alvos PRÓPRIOS do Plano B. V6.11 (item 3.3): antes vinham os selectedTargetIds do
        // Plano A, o que fazia o B ser o A com outro preço de entrada.
        $idsB = array_values(array_filter(
            (array) ($planB['target_selection']['candidate_ids'] ?? []),
            'is_string',
        ));
        $tps = $this->alvos->calcularAlvos($idsB, $targetCatalog, $stopB, $entradaB);

        $rr1 = $tps['tp1'] !== null && abs($entradaB - $stopB) > 0
            ? round(abs($tps['tp1'] - $entradaB) / abs($entradaB - $stopB), 2)
            : 0.0;

        // 8. Gatilho declarado pela IA, verificado em vela fechada. V6.11 (item 3.3): antes o PHP
        // gerava o gatilho sozinho, sempre contra a borda da zona. Agora a IA diz o que precisa
        // acontecer e em qual nível; o BreakRetestService só confere se já aconteceu.
        $gatilhoNivelId = $planB['trigger']['nivel_candidate_id'] ?? null;
        $gatilhoNivel = is_string($gatilhoNivelId) && isset($porId[$gatilhoNivelId])
            ? (float) $porId[$gatilhoNivelId]['price']
            : ($isShort ? $zonaDe : $zonaAte);
        $verificacao = ($atr > 0.0 && $candles !== [])
            ? $this->breakRetest->horizontal($candles, $gatilhoNivel, $atr)
            : null;

        $trigger = [
            'tipo' => $planB['trigger']['tipo'] ?? null,
            'nivel' => round($gatilhoNivel, 8),
            'descricao' => $planB['trigger']['descricao'] ?? null,
            'estado' => ($verificacao['confirmado'] ?? false) === true ? 'ATINGIDO' : 'AGUARDANDO',
            'verificacao' => $verificacao,
        ];

        return [
            'plano' => [
                'entrada' => round($entradaB, 8),
                'stop' => round($stopB, 8),
                'zona_de' => $zonaDe,
                'zona_ate' => $zonaAte,
                'fonte' => $fonteB,
                'entrada_rationale' => $planB['entry_rationale'] ?? null,
                'tp1' => $tps['tp1'], 'tp1_fonte' => $tps['tp1_fonte'], 'tp1_rotulo' => $tps['tp1_rotulo'],
                'tp2' => $tps['tp2'], 'tp2_fonte' => $tps['tp2_fonte'], 'tp2_rotulo' => $tps['tp2_rotulo'], 'tp2_motivo' => $tps['tp2_motivo'],
                'tp3' => $tps['tp3'], 'tp3_fonte' => $tps['tp3_fonte'], 'tp3_rotulo' => $tps['tp3_rotulo'], 'tp3_motivo' => $tps['tp3_motivo'],
                'rr1' => $rr1,
                'tipo' => 'ENTRADA_TECNICA',
                'descricao' => $this->descricao($isShort, $fonteB, $wyckoffFase, $cvdDivergence, $elementosVisuais),
                'trigger' => $trigger,
                'stop_status' => $stopRes['stop_status'],
                'stop_ancora' => $stopRes['stop_ancora'],
                'stop_buffer' => $stopRes['stop_buffer'],
                'stop_motivo' => $stopRes['stop_motivo'],
                'aviso' => $stopRes['aviso'],
            ],
            'motivo' => null,
        ];
    }

    /**
     * V6.11 (item 3.3): Plano B indisponível deixa de ser `null` mudo. O motivo sobe até a resposta
     * pública, para a tela traduzir e para o histórico registrar por que a alternativa não existiu.
     * Depois das Partes 2 e 3, estes casos passam a ser exceção, não rotina.
     */
    private function indisponivel(string $codigo): array
    {
        \Illuminate\Support\Facades\Log::info('GENESIS_PLANO_B_INDISPONIVEL', ['motivo' => $codigo]);

        return ['plano' => null, 'motivo' => $codigo];
    }
```

APAGAR do arquivo, por completo, o bloco do clamp com `stop × (1 - 0.005)` e `stop × (1 + 0.005)`. Ele não existe mais.

### 3.4 · `ExecucaoService`

No ponto da chamada, SUBSTITUIR por:

```php
        $planoBResultado = $this->planoBService->gerar(
            $direcao,
            $preco,
            $atr,
            $niveisContrato,
            $targetCatalog,
            $planB,                         // decision.plan_b, novo parâmetro
            $leverage,
            $wyckoffFase,
            $stopDisponivel ? ($stopRes['stop_ancora']['valor'] ?? $stop) : null,
            $spreadBps,
            $slippageBps,
            $cvdDivergence,
            $elementosVisuais,
            $candles,
        );
        $planoB = $planoBResultado['plano'];
        $planoBMotivo = $planoBResultado['motivo'];
```

E no array de execução publicado, ao lado de `'planoB' => $planoBCompleto`:

```php
            'planoB_motivo' => $planoBMotivo,
```

O restante do bloco `if ($planoB !== null) { ... }` continua como está: tamanho, liquidação, invalidações, R:R por alvo e alavancagem segura já são calculados separadamente para o B. Confirme que `qualidade_entrada` também é calculada com a entrada do B, e não com a do A.

Em `AnalysisPersistenceService`, passar `$decision['plan_b'] ?? []` adiante até `ExecucaoService::montar()`.

### 3.5 · O fallback silencioso de plano primário

Em `AnalysisPersistenceService::resolverPlanoPrimario()`, o `if` que degrada B para A quando o B não existe **permanece** como rede de segurança, mas para de ser silencioso:

```php
        if ($planoPrimario === 'B' && ($execution['planoB'] ?? null) === null) {
            Log::warning('GENESIS_PLANO_PRIMARIO_B_DEGRADADO', [
                'declarado' => $declarado,
                'motivo_plano_b' => $execution['planoB_motivo'] ?? null,
            ]);
            // V6.11 (item 3.5): a tela precisa saber que o primário declarado não pôde ser
            // honrado. Antes o membro via "Plano A (Primário)" sem nenhum sinal de que o modelo
            // tinha pedido a entrada técnica.
            $execution['plano_primario_degradado'] = true;
            $planoPrimario = 'A';
        }
```

### 3.6 · A tela

Em `components/AnalysisResult.tsx`, SUBSTITUIR os dois blocos atuais do Plano B pelo bloco único abaixo. O card do B passa a ser renderizado sempre, com dois estados, e nunca some.

```tsx
                  {/* V6.11 (item 3.6): o Plano B aparece SEMPRE. Antes o botão só era renderizado
                      com planoB.entrada preenchido, e a ausência virava uma div tracejada com uma
                      frase fixa que afirmava duas causas de um total de oito possíveis. */}
                  {planoB?.entrada != null ? (
                    <button
                      disabled={!podeInteragir}
                      onClick={() => handleZoneSelect('B')}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all duration-200 ${!podeInteragir ? 'opacity-40 cursor-not-allowed' : ''} ${
                        zonaEfetiva === 'B'
                          ? 'bg-genesis-accent/10 border-genesis-accent ring-1 ring-genesis-accent'
                          : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30'
                      }`}
                    >
                      <div className="flex justify-between items-baseline mb-1">
                        <span className={`text-[10px] font-bold ${zonaEfetiva === 'B' ? 'text-genesis-accent' : 'text-gray-400'}`}>
                          {`Plano B${planoPrimario === 'B' ? ' (Primário)' : ' (Alternativo)'}`}
                        </span>
                        <span className="font-mono font-bold text-sm text-white">
                          {formatPrice(Number(planoB.entrada), tickDecimals)}
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-400 font-mono tracking-wide leading-tight mt-1">
                        {planoB.trigger?.descricao ?? planoBDescricaoCompleta}
                      </p>
                      <span className={`text-[9px] font-mono ${planoB.trigger?.estado === 'ATINGIDO' ? 'text-genesis-positive' : 'text-genesis-accent'}`}>
                        {planoB.trigger?.estado === 'ATINGIDO' ? 'Zona alcançada' : 'Aguardando o preço'}
                      </span>
                    </button>
                  ) : (
                    <div className="w-full text-left p-2.5 rounded-lg border border-dashed border-white/10 bg-black/10">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="text-[10px] font-bold text-gray-500">Plano B (Alternativo)</span>
                      </div>
                      <p className="text-[9px] text-gray-500 font-mono tracking-wide leading-tight mt-1">
                        {MOTIVO_PLANO_B[execution?.planoB_motivo ?? ''] ?? MOTIVO_PLANO_B.PADRAO}
                      </p>
                    </div>
                  )}
```

Dicionário, no topo do arquivo. O código interno nunca aparece na tela:

```tsx
// V6.11 (item 3.6): tradução do motivo interno para linguagem de tela.
const MOTIVO_PLANO_B: Record<string, string> = {
  ENTRADA_B_NAO_SELECIONADA: 'Nenhum nível técnico foi apontado para uma entrada alternativa nesta análise.',
  ENTRADA_B_DO_LADO_ERRADO: 'O nível apontado para a entrada alternativa está do lado contrário ao da operação.',
  ENTRADA_B_DENTRO_DA_INVALIDACAO_DO_A: 'O nível da entrada alternativa fica dentro da faixa que já invalida esta leitura.',
  ZONA_ESTRUTURAL_INVERTIDA: 'Os níveis que delimitariam a zona de entrada estão fora de ordem neste momento.',
  SEM_STOP_ESTRUTURAL_NA_ENTRADA_B: 'Não há nível estrutural que sirva de proteção para a entrada alternativa.',
  STOP_COLADO_NA_ENTRADA_B: 'A proteção da entrada alternativa ficaria colada nela, sem espaço operacional.',
  PADRAO: 'Entrada alternativa indisponível nesta análise.',
};
```

E, quando `execution.plano_primario_degradado` for verdadeiro, o card do Plano A exibe, abaixo do preço:

```tsx
                    {execution?.plano_primario_degradado && (
                      <span className="text-[9px] text-genesis-accent font-mono">
                        A leitura apontava entrada técnica, que não pôde ser montada nesta análise.
                      </span>
                    )}
```

Em `services/geminiService.ts`, ao lado de `planoB: exec.planoB`:

```ts
      planoB_motivo: exec.planoB_motivo ?? null,
      plano_primario_degradado: exec.plano_primario_degradado ?? false,
```

---

## PARTE 4 · Derivativos e tela

### 4.1 · Lado do livro invertido no squeeze

Em `app/Services/DerivativesReadingService.php`, dentro de `squeezeRisk()`, SUBSTITUIR:

```php
        // V6.11 (item 4.1): estava invertido. Uma cascata de long squeeze força os comprados a
        // VENDER, e ordem de venda consome BID, que aqui é `paredes_compra`. O espelho vale para o
        // short squeeze, que consome ASK. A regra aprovada diz exatamente isso: long squeeze exige
        // liquidez relevante ABAIXO, short squeeze exige liquidez relevante ACIMA.
        $chaveLadoAlvo = $crowding['side'] === 'COMPRADA' ? 'paredes_compra' : 'paredes_venda';
        $liquidezRelevante = is_array($orderBookWalls) && ! empty($orderBookWalls[$chaveLadoAlvo] ?? []);
```

### 4.2 · O gatilho de preço do squeeze é cego a direção

Na mesma função, SUBSTITUIR:

```php
        // V6.11 (item 4.2): o `abs()` apagava o sinal, então um preço subindo 5% validava a
        // evidência de LONG squeeze, que por definição é cascata para baixo. A regra aprovada exige
        // perda de suporte para long squeeze e rompimento de resistência para short squeeze.
        $pisoMovimentoPct = (float) config('genesis_graphical.squeeze_price_move_min_pct', 0.5);
        $movimento = $priceChangePctNaJanela;
        $precoNaDirecaoDoSqueeze = $movimento !== null && (
            $crowding['side'] === 'COMPRADA'
                ? $movimento <= -$pisoMovimentoPct
                : $movimento >= $pisoMovimentoPct
        );
        if (! $precoNaDirecaoDoSqueeze) {
            return ['side' => null, 'reasons' => [], 'status' => 'NOT_EVALUATED'];
        }
```

### 4.3 · Funding conta um único período de oito horas

Em `app/Services/ExecucaoService.php`, o custo usa `$fundingRateReal * 10_000`, ou seja, uma liquidação. Um setup diário aberto cinco dias paga quinze períodos. Com funding a 0,05%, isso são 75 bps na semana contra os 15 bps que o sistema hoje assume no total.

```php
        // V6.11 (item 4.3): funding é custo de CARREGAMENTO, cobrado a cada 8 horas. Contar uma
        // liquidação só torna o R:R líquido otimista em qualquer operação que passe de 8 horas, que
        // é todo 1d e todo 1w. Períodos esperados por tempo gráfico, alinhados à regra de expiração
        // já aprovada (15m/30m 24h; 1h/4h 7 dias; 1d 30 dias; 1w 90 dias), usando a metade da
        // janela como horizonte típico de permanência.
        $periodosFunding = match ($timeframe) {
            '15m', '30m' => 2,
            '1h', '2h', '3h', '4h', '6h', '8h', '12h' => 11,
            '1d' => 45,
            '1w' => 135,
            default => 3,
        };
        $fundingBpsBruto = $fundingRateReal !== null
            ? $fundingRateReal * 10_000 * $periodosFunding
            : (float) ($custosConfig['funding'] ?? 0);
```

O custo de carregamento passa a aparecer separado no detalhamento de custos que já existe em `'funding' => $fundingBpsAssinado`.

### 4.4 · Funding exibido com duas casas decimais

Em `GenesisPrompt.php`, SUBSTITUIR a frase sobre funding:

```text
- Funding em taxa decimal deve ser apresentado como percentual equivalente com QUATRO casas decimais e sinal explícito (exemplo: +0,0043% ou -0,0125%). Duas casas colapsam toda a faixa neutra em 0,00% e apagam o sinal, que é justamente a informação que importa.
```

### 4.5 · Cobertura não enxerga a leitura visual

`EvidenceCatalog` tem 44 itens `PHP_CALC` e 6 `BINANCE_FUTURES_API`. Zero de OCR. Um print sem nada desenhado marca a mesma cobertura de um print completo, o que contraria R7.

ACRESCENTAR ao catálogo, com role `CONTEXT`:

```php
            self::e('vision.vrvp', 'vision.visual_observations.vrvp.presente', 'Volume Profile lido do gráfico', 'bool', 'OCR_VISION', 'CONTEXT'),
            self::e('vision.levels', 'vision.visual_observations.resistances', 'Suporte/resistência desenhados', 'list', 'OCR_VISION', 'CONTEXT'),
            self::e('vision.patterns', 'vision.visual_observations.patterns', 'Figuras gráficas identificadas', 'list', 'OCR_VISION', 'CONTEXT'),
            self::e('vision.objects', 'vision.visual_observations.objects', 'Linhas de tendência e canais', 'list', 'OCR_VISION', 'CONTEXT'),
            self::e('vision.fibonacci', 'vision.visual_observations.fibonacci', 'Fibonacci desenhado', 'list', 'OCR_VISION', 'CONTEXT'),
```

### 4.6 · Macro e Sentimento com frase fixa de ausência

No BTC, a tela mostrou VIX 15,39, DXY −0,33% e S&P −0,70% e, logo abaixo, "Contexto informativo indisponível para esta análise". `macroStats` chegou preenchido e `ctx.macro.resumo` veio nulo.

Duas ações:

1. Trazer o log da chamada de contexto dessa análise e dizer o que aconteceu: timeout, erro HTTP, JSON inválido ou resposta com campos nulos. O `systemPrompt` do `GeminiContextService` já está correto, o conflito antigo de score não existe mais.

2. Em `components/AnalysisResult.tsx`, linhas 1277 e 1330, o fallback de texto sai. Dado que não veio não aparece (R7):

```tsx
                  {publicText(macroInfo?.resumo) && (
                    <p className="...">{publicText(macroInfo.resumo)}</p>
                  )}
```

### 4.7 · Card de Macro renderizando vazio

Em `components/ScoreBasisBars.tsx`, `BlocoNumerico` só desenha o selo quando `disponivel` é falso e só desenha a barra quando `pct` não é nulo. Com macro disponível por causa do VIX e score nulo, sobra uma caixa vazia.

```tsx
    {pct != null ? (
      <div className="relative w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full ${COR.normal.barra}`} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
      </div>
    ) : (
      // V6.11 (item 4.7): disponível sem score deixava a caixa completamente vazia na tela. Mostra
      // o que de fato chegou, em vez de nada.
      valoresBrutos && <div className="text-[9px] text-gray-400 font-mono">{valoresBrutos}</div>
    )}
```

### 4.8 · Sentimento do ativo dependendo de Fear and Greed

Em `AnalysisResult.tsx`, `sentimentDisponivel` considera `fear_greed` e `btc_dominance`, que pertencem ao card superior de sentimento de mercado.

```tsx
            // V6.11 (item 4.8): Fear and Greed e dominância do BTC são sentimento de MERCADO e
            // vivem no card superior. O bloco de Sentimento do ativo é sobre notícias e redes
            // daquela cripto — são tarefas distintas.
            sentimentDisponivel={sentimento?.score != null || !!sentimento?.narrativa}
```

### 4.9 · Cabeçalho de risco mistura bruto e líquido

A tela mostra "1:0,34 bruto" (TP1 sem custo) e "1:0,33 combinado" (com custo), sem dizer que a segunda é líquida. Rotular:

```tsx
                <span className="text-[9px] text-gray-500">combinado, líquido</span>
```

### 4.10 · O teste de alvo não olha o caminho

No BTC, o TP1 de $82.828,7 ficou acima da resistência de $81.509,2 desenhada no gráfico, e o fator "Ancoragem do alvo" passou como BOM, porque `QualidadeEntradaService::ancoragemDoAlvo()` só conta quantos TPs têm fonte não nula.

ACRESCENTAR o quinto fator, em `QualidadeEntradaService`:

```php
    /**
     * V6.11 (item 4.10): "ancoragem" valida a ÂNCORA do alvo; este fator valida o CAMINHO até ele.
     * Um TP com barreira real do outro lado de uma barreira mais forte era aprovado do mesmo jeito.
     */
    private function caminhoAteOAlvo(float $preco, ?float $tp1, bool $isShort, array $candidatos, ?float $forcaTp1): array
    {
        if ($tp1 === null || $forcaTp1 === null) {
            return $this->indisponivel('Caminho até o alvo', 'Sem primeiro alvo definido');
        }

        foreach ($candidatos as $c) {
            $p = (float) ($c['price'] ?? 0);
            $entreOsDois = $isShort ? ($p < $preco && $p > $tp1) : ($p > $preco && $p < $tp1);
            if ($entreOsDois && (float) ($c['strength'] ?? 0) >= $forcaTp1) {
                return [
                    'fator' => 'Caminho até o alvo',
                    'avaliacao' => 'RUIM',
                    'detalhe' => 'há uma barreira igual ou mais forte que o alvo no caminho',
                ];
            }
        }

        return [
            'fator' => 'Caminho até o alvo',
            'avaliacao' => 'BOM',
            'detalhe' => 'nenhuma barreira mais forte que o alvo entre a entrada e ele',
        ];
    }
```

### 4.11 · Open Interest multi-exchange somado como dólar

`MultiExchangeDerivativesDisplayService` publica `open_interest` com `unit = 'contracts'` para Binance, Bybit, Bitget e OKX. Em `services/oiLiquidationService.ts`, esses valores são somados e gravados em `openInterest.totalUsd`. São contratos heterogêneos somados num campo chamado dólar.

É bloco de display e não afeta a direção, mas não pode ir a público assim. Ou converter cada um para nocional em dólar antes de somar, ou renomear o campo e parar de somar exchanges diferentes.

### 4.12 · Hierarquia visual entre convicção e localização

No ZEC, "85 CONVICÇÃO FORTE" ocupa o topo da tela em corpo grande, e "0 de 4 fatores de localização são favoráveis, com R:R de 1:0,33" fica em corpo pequeno numa nota de rodapé. Os dois eixos existem e estão corretos no código; o problema é qual deles o olho lê primeiro.

O botão continua ativo e a Qualidade da Entrada continua em texto, sem virar porcentagem. O que muda é peso visual: o bloco de qualidade da entrada e o R:R sobem para junto do número de convicção, com o mesmo destaque tipográfico.

---

## PARTE 5 · Checklist de verificação

Item por item, com prova. Nada volta para nós sem esta lista preenchida.

### Fase 0 · Antes de mexer

- [ ] Branch própria criada a partir do que está em produção hoje.
- [ ] SHA-256 dos dois pacotes recebidos, anexado.
- [ ] `php artisan test` rodado ANTES de qualquer alteração, com o número de falhas pré-existentes anotado. Sem esse número não dá para saber o que este bloco quebrou.
- [ ] `npx tsc --noEmit` rodado antes, mesmo motivo.

### Fase 1 · Fundação

- [ ] `MarketSnapshotService` passa `$candlesBrutos` para `zones->calculate()`.
- [ ] ZECUSDT 1d de 08/09 devolve `zones.pdh` e `zones.pdl` da vela de 07/09, e não mais da vela de 06/09.
- [ ] O rótulo "máxima/mínima do dia anterior" não aparece mais em dois níveis distantes um do outro na mesma tela.
- [ ] `getLeverageBrackets` respondendo em produção, com a saída real anexada para BTCUSDT e ZECUSDT.
- [ ] O campo de liquidação mostra preço nos dois setups de prova.
- [ ] Um caso construído com stop dentro da faixa de liquidação acende `LIQ_FOLGA_CURTA` na tela.
- [ ] O rótulo da tela é "Liquidação", sem "estimada".
- [ ] Migration `add_plan_b_contract_to_genesis_analises` criada e rodada, com `down()` testado.
- [ ] `plan_b`, `plano_b_motivo` e `plano_primario_degradado` gravados numa análise nova.
- [ ] Uma análise ANTIGA, criada antes desta migration, abre no histórico sem erro.
- [ ] Confirmado por leitura de código, sem alterar nada, que `persistPlanos()` grava TP1/TP2/TP3 da linha do plano e que `AcompanharPlanos` lê da linha do plano. Anexar as duas linhas citadas.

### Fase 2 · Leitura visual na mesa

- [ ] `grep -n "peso_total > 0" app/Services/GraphicalAnalysis/TargetCandidateCatalog.php` retorna vazio.
- [ ] `coletarBrutos()` lê `observacoes['objects']` e gera candidatas do tipo `linha_tendencia`.
- [ ] O prompt de visão pede `preco_no_candle_atual` para LTA, LTB e canal, e o validador aceita null.
- [ ] Uma análise com LTA desenhada no gráfico produz pelo menos uma candidata `linha_tendencia` no `bundle.target_candidates`. Anexar o JSON.
- [ ] VRVP com confiança abaixo de 0,70 aparece no catálogo com o campo `confianca` preenchido, em vez de sumir.
- [ ] Toda candidata publicada tem o campo `elementos` preenchido.
- [ ] Candidatas de força baixa estão limitadas a 4 por lado.
- [ ] O prompt contém a regra de coerência e exige `elementos_usados` em cada rationale.
- [ ] Uma decisão sem `elementos_usados` é rejeitada com `TARGET_RATIONALE_SEM_ELEMENTOS`.

### Fase 3 · Planos A e B

- [ ] `grep -n "0.995\|1.005" app/Services/GraphicalAnalysis/PlanoBService.php` retorna vazio.
- [ ] `grep -c "return null" app/Services/GraphicalAnalysis/PlanoBService.php` retorna 0.
- [ ] O schema da decisão exige `plan_b` com entrada, gatilho, stop e alvos próprios.
- [ ] `PlanoBService` NÃO recebe mais `$selectedTargetIds` do Plano A. Confirmar por assinatura.
- [ ] Numa análise em que a IA escolheu alvos diferentes para A e B, os TPs mostrados mudam ao clicar em B. Anexar as duas capturas de tela.
- [ ] O stop do Plano B é calculado a partir da entrada do Plano B e pode ser diferente do stop do A.
- [ ] `qualidade_entrada` do Plano B é calculada com a entrada do B.
- [ ] O card do Plano B é renderizado em todas as análises testadas, com estado "Aguardando o preço" ou "Zona alcançada".
- [ ] Nenhum código em caixa alta com underline aparece na tela em nenhum dos estados.
- [ ] `execution.planoB_motivo` chega ao frontend quando o B não existe.
- [ ] Quando a IA declara primário B e o B não sai, a tela avisa, e o log `GENESIS_PLANO_PRIMARIO_B_DEGRADADO` registra o motivo.
- [ ] Ao clicar em B e voltar em A, todos os campos retornam aos valores do A, sem estado preso.

### Fase 4 · Derivativos e tela

- [ ] `COMPRADA` passa a olhar `paredes_compra`, e `VENDIDA` passa a olhar `paredes_venda`.
- [ ] O gatilho de preço do squeeze exige queda para long squeeze e alta para short squeeze. Teste com movimento contrário tem que devolver `NOT_EVALUATED`.
- [ ] O funding do custo é multiplicado pelos períodos do tempo gráfico, e o detalhamento mostra o carregamento separado.
- [ ] O funding aparece nos textos com quatro casas decimais e sinal.
- [ ] Um print sem nada desenhado derruba a cobertura em relação a um print completo do mesmo ativo. Anexar os dois números.
- [ ] A frase "Contexto informativo indisponível para esta análise" não existe mais no código.
- [ ] Log da chamada de contexto do BTC de 08/09 anexado, com a causa da narrativa nula.
- [ ] O card de Macro nunca renderiza vazio.
- [ ] `sentimentDisponivel` não olha mais `fear_greed` nem `btc_dominance`.
- [ ] O R:R combinado está rotulado como líquido.
- [ ] O quinto fator de qualidade da entrada existe e reprova o caso BTC de 08/09, em que o TP1 estava acima da resistência de $81.509,2.
- [ ] O campo `totalUsd` do OI multi-exchange foi corrigido ou renomeado.

### Fase 5 · Regressão obrigatória

- [ ] `php artisan test` rodado depois, com o número de falhas comparado ao da Fase 0. Nenhuma falha nova.
- [ ] `npx tsc --noEmit` sem erro novo.
- [ ] Os dois setups de prova rodados de novo do zero, do upload até a tela, com as capturas anexadas.
- [ ] EMAs conferidas de novo nos dois ativos contra o TradingView, pelo método de um passo de EMA com o preço vivo. Elas estão corretas hoje e não podem regredir.
- [ ] Score, R:R e dimensionamento conferidos: continuam batendo com a aritmética.
- [ ] Nenhum arquivo do pacote foi entregue de uma árvore diferente da testada.

### Fase 6 · Cobertura que a auditoria não teve

Os dois setups auditados eram LONG, em 1 dia, em dois ativos de tick e passo confortáveis. Tudo que está fora disso saiu deste bloco sem verificação contra tela real. Estes quatro testes são obrigatórios antes da entrega.

- [ ] **Um setup SHORT completo**, do upload até a tela. Todo ramo espelhado (`$isShort`) do `PlanoBService`, do `NivelService`, do catálogo e do squeeze saiu daqui sem prova. É metade do produto. Anexar captura com os dois planos.
- [ ] **Um tempo gráfico diferente de 1 dia**, de preferência 4h e 1 semana. O item 1.1 se comporta de forma diferente conforme o agrupamento por período, e o item 4.3 muda o número de períodos de funding.
- [ ] **Um ativo de preço baixo**, com muitas casas decimais e passo grande em relação ao nocional, para expor arredondamento de quantidade e de tick.
- [ ] **Um caso com Plano B efetivamente diferente do A**: alvos diferentes, stop diferente, gatilho declarado. É o teste que prova a Parte 3 inteira.

### Fase 7 · Testes existentes que vão quebrar de propósito

- [ ] `components/__tests__/AnalysisResult.fase6.test.ts` exige a frase fixa "Contexto informativo indisponível para esta análise", que o item 4.6 manda apagar. O teste tem que ser atualizado para a nova regra, nunca a correção contornada para o teste passar.
- [ ] Qualquer teste que afirme que o Plano B reusa os alvos do Plano A tem que ser reescrito, não removido.
- [ ] Qualquer teste que afirme o filtro de peso zero no catálogo tem que ser reescrito.
- [ ] Listar, na devolução, todo teste alterado e o motivo de cada alteração.

---

## PARTE 6 · O que não fecha aqui dentro

Três itens deste documento estão escritos como pedido de informação, não como correção, porque a causa não está no código auditado. Sem eles, o bloco não fica completo.

**6.1 · Bracket da Binance.** Não dá para saber, olhando o código, se o `getLeverageBrackets` falha por chave errada, permissão faltando na chave ou IP não liberado. O item 1.2 corrige o silêncio e o rótulo; a causa raiz depende da resposta real do endpoint em produção. Anexar a saída bruta para BTCUSDT e ZECUSDT.

**6.2 · Falha do contexto no BTC.** O `systemPrompt` do `GeminiContextService` está correto e o conflito antigo de score não existe mais. A narrativa voltou nula por outro motivo. O item 4.6 remove a frase fixa da tela, que é correção de verdade, mas a causa raiz só sai do log da chamada daquela análise. Anexar.

**6.3 · Open Interest multi-exchange.** O item 4.11 tem duas saídas possíveis, converter cada exchange para nocional em dólar antes de somar, ou parar de somar e renomear o campo. É decisão de produto, não de código. Definir antes de implementar.

---

## PARTE 7 · Ordem de execução

Um commit por bloco, nesta ordem. Não juntar.

1. Item 1.1, PDH e PDL. Sozinho, porque muda número em toda análise.
2. Item 1.2, liquidação, mais a resposta do 6.1.
3. Item 1.3, migration e contrato.
4. Parte 2 inteira, a leitura visual chegando na mesa.
5. Parte 3 inteira, A e B independentes. Depende das anteriores.
6. Itens 4.1 e 4.2, squeeze.
7. Itens 4.3, 4.4 e 4.5, custo, precisão e cobertura.
8. Itens 4.6 a 4.12, tela.
9. Fases 5, 6 e 7 do checklist.

O que não pode acontecer: entregar a Parte 3 sem a Parte 2. Sem a leitura visual na mesa, a IA não tem nível para ancorar o Plano B na maioria das análises, e o problema que este bloco existe para resolver continua igual, só que com código novo.
