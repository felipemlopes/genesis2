# Gênesis v6.11, hotfix final para produção

**Para:** Felipe  
**Base auditada:** backend `genesis-api-genesis2 (46)` + frontend `genesis2-master (32)`  
**Referências cruzadas:** auditoria anterior do Claude/Cloud + `correcoes-v6.11-felipe.md` + testes reais BTCUSDT, ZECUSDT e SUIUSDT de 09/09/2026.  
**Objetivo:** corrigir o fluxo operacional sem reescrever o cérebro do Gênesis.

## 0. Resultado esperado

O Gênesis continua fazendo a mesma leitura de mercado, direção, score, estrutura, indicadores, derivativos e leitura visual.

O que muda é o fechamento operacional da análise:

```text
ANÁLISE
  ↓
Plano A, entrada a mercado + alvos técnicos
Plano B, entrada técnica condicionada + alvos técnicos
  ↓
Stop A calculado para a configuração A
Stop B calculado para a configuração B
  ↓
R:R individual de TP1, TP2 e TP3 de cada plano
  ↓
Dimensionamento, margem e liquidação de cada plano
  ↓
Frontend alterna A/B sem misturar campos
```

Regras que não podem ser quebradas:

1. O stop é consequência da configuração já gerada. Stop não pode alterar entrada ou alvos.
2. R:R nunca escolhe stop e nunca escolhe alvo.
3. Plano A e Plano B são independentes.
4. Plano B não é sinônimo de pullback. É entrada com condição técnica.
5. Nenhum preço pode ser fabricado para fazer a configuração fechar.
6. PHP/API calculam primeiro. A leitura Vision/OCR já feita no mesmo upload entra como fonte visual quando a estrutura objetiva não basta.
7. Não fazer uma nova chamada de OCR desnecessária. A Vision já foi executada e seus níveis devem ser reaproveitados.
8. R:R combinado deixa de existir por decisão de produto.

---

# P0.1, retirar o stop provisório da escolha dos alvos

## Problema atual

`CanonicalBundleBuilder.php` cria `rr_provisorio` a partir de um stop automático antes da decisão. Depois `GenesisPrompt.php` manda preferir TP1 com `rr_provisorio >= 1.0`.

Isto faz o stop influenciar a seleção do alvo. A regra final do produto é o contrário: a análise escolhe os alvos técnicos e o stop é calculado depois para proteger aquela configuração.

## Arquivos

- `app/Services/GraphicalAnalysis/CanonicalBundleBuilder.php`
- `app/Services/GraphicalAnalysis/GenesisPrompt.php`
- testes `GenesisPromptRrProvisorioTest.php`
- testes `CanonicalBundleBuilderRrProvisorioTest.php`

## Alteração

APAGAR de `CanonicalBundleBuilder::build()` o bloco que calcula:

```php
$stopProvisorioLong = $this->nivelService->stop(...);
$stopProvisorioShort = $this->nivelService->stop(...);
$distanciaProvisoriaPorLado = [...];
$targetCandidates = $this->comRrProvisorio(...);
```

APAGAR também o método privado:

```php
private function comRrProvisorio(...)
```

Em `GenesisPrompt.php`, trocar a descrição de `target_candidates` para remover `rr_provisorio`:

```text
bundle.target_candidates traz níveis reais construídos em PHP a partir do gráfico e das APIs. Cada candidata possui candidate_id, side, price, distance_atr, strength, elementos e label. Selecione os alvos pela coerência técnica da estrutura, confluência e contexto da análise. R:R não participa da escolha do alvo. Nunca invente preço.
```

APAGAR a regra:

```text
Para o primeiro alvo (TP1), prefira a candidata mais próxima cujo rr_provisorio seja >= 1.0...
```

## Impacto

Os alvos deixam de ser deslocados para fazer o R:R parecer melhor. Entrada e TPs passam a nascer da análise técnica. O stop e os R:R são derivados depois.

---

# P0.2, fazer os níveis Vision/OCR participarem dos candidatos de stop antes da decisão

## Problema atual

O backend 46 já lê suporte e resistência em `vision.visual_observations.supports/resistances`. O cálculo de execução recebe `visual.levels` depois da decisão, mas `CanonicalBundleBuilder` monta `stop_candidates` antes dessa evidência ser adicionada.

Resultado: o PHP final pode enxergar S/R visual para stop, mas a IA pode não enxergar estes mesmos níveis como `stop_candidates` quando escolhe a âncora.

## Arquivo

`app/Services/GraphicalAnalysis/CanonicalBundleBuilder.php`

## Alteração mínima

Logo antes de chamar `NiveisContratoBuilder::build()`, criar uma cópia das evidências apenas para o motor de stop:

```php
$evidenceParaStop = $manifest['items'];
$evidenceParaStop[] = [
    'id' => 'visual.levels',
    'value' => [
        'suportes' => array_values(array_filter(
            (array) data_get($vision, 'visual_observations.supports', []),
            'is_numeric'
        )),
        'resistencias' => array_values(array_filter(
            (array) data_get($vision, 'visual_observations.resistances', []),
            'is_numeric'
        )),
    ],
    'unit' => 'object',
    'source' => 'GEMINI_VISION',
    'decision_role' => 'CONTEXT',
    'status' => 'AVAILABLE',
    'observed_at' => $visionObservedAt,
    'error_code' => null,
];

$niveisContrato = $this->niveisContratoBuilder->build(
    $evidenceParaStop,
    $vrvpParaStop,
    (array) ($vision['visual_observations']['patterns'] ?? []),
    $precoAtual,
    $atrAtual,
    $collected['candles'],
);
```

Não é necessário alterar o `bundle.evidence` público neste ponto. O objetivo é somente construir `stop_candidates` com as mesmas referências visuais que o cálculo final já recebe.

## Impacto

O fallback visual passa a existir sem uma segunda chamada de IA/OCR. O mesmo gráfico já lido fornece suporte e resistência para a escolha do stop.

---

# P0.3, Plano B precisa ser realmente técnico no prompt

## Problema atual

O schema possui `decision.plan_b`, porém o prompt detalha muito mais `target_selection` e `stop_selection` do Plano A do que a construção do objeto completo do Plano B. O modelo pode entregar campos nulos e o PHP encerra com `ENTRADA_B_NAO_SELECIONADA`.

## Arquivo

`app/Services/GraphicalAnalysis/GenesisPrompt.php`

## Adicionar antes de `PLANO PRIMÁRIO`

```text
SELEÇÃO DO PLANO B (plan_b)
- Plano B é uma segunda configuração técnica, condicionada a uma condição real antes da entrada. Não é preenchimento obrigatório sem lastro e não é sinônimo de pullback.
- Use somente candidate_id já existente em bundle.target_candidates e bundle.stop_candidates. Nunca invente preço ou id.
- entry_candidate_id é o nível técnico da entrada B.
- entry_rationale explica por que este nível e este gatilho formam uma entrada tecnicamente defensável nesta análise.
- trigger.tipo deve ser ROMPIMENTO, RETESTE ou RETORNO_A_ZONA conforme a estrutura real.
- ROMPIMENTO pode ficar acima do preço atual em uma operação LONG e abaixo do preço atual em uma operação SHORT.
- RETORNO_A_ZONA normalmente fica abaixo do preço atual em LONG e acima em SHORT.
- RETESTE pode estar de qualquer lado do preço atual. O que manda é a estrutura que foi rompida e que será testada novamente.
- trigger.nivel_candidate_id deve apontar para nível real do catálogo.
- trigger.descricao descreve objetivamente o que precisa acontecer antes da entrada.
- stop_selection.candidate_id é a melhor âncora conhecida para proteger a entrada B. Pode ser null se o motor PHP tiver estrutura melhor no cálculo final.
- target_selection.candidate_ids são os alvos próprios do Plano B. Nunca herdar os IDs do Plano A por conveniência.
- Se não existir estrutura técnica defensável, não invente. O validador fará nova tentativa com as mesmas evidências do gráfico.
```

## Impacto

Plano B deixa de ser um texto alternativo e passa a ser um setup completo declarado na mesma decisão que já existe hoje.

---

# P0.4, validar tecnicamente o Plano B e usar o repair que já existe

## Objetivo

Não criar nova cadeia de IA. Reutilizar o repair atual do `DecisionResponseValidator`. Se a resposta vier com Plano B vazio ou incoerente, o mesmo decisor recebe os erros e corrige uma vez dentro do mecanismo já existente.

## Arquivo

`app/Services/GraphicalAnalysis/DecisionResponseValidator.php`

## Chamada

Depois da validação de direção e dos catálogos, acrescentar:

```php
$errors = array_merge(
    $errors,
    $this->validatePlanBTechnical($decision, $bundle)
);
```

## Método

```php
private function validatePlanBTechnical(array $decision, array $bundle): array
{
    $errors = [];
    $direction = $decision['direction'] ?? null;
    $planB = $decision['plan_b'] ?? null;

    if (! is_array($planB)) {
        return ['PLAN_B_MISSING'];
    }

    $catalog = (array) ($bundle['target_candidates'] ?? []);
    if ($catalog === []) {
        return ['PLAN_B_TECHNICAL_UNAVAILABLE'];
    }

    $porId = [];
    foreach ($catalog as $candidate) {
        if (is_array($candidate) && is_string($candidate['candidate_id'] ?? null)) {
            $porId[$candidate['candidate_id']] = $candidate;
        }
    }

    $entryId = $planB['entry_candidate_id'] ?? null;
    if (! is_string($entryId) || ! isset($porId[$entryId])) {
        $errors[] = 'PLAN_B_ENTRY_INVALID';
    }

    $entryRationale = $planB['entry_rationale'] ?? null;
    if (! is_string($entryRationale) || mb_strlen(trim($entryRationale)) < 20) {
        $errors[] = 'PLAN_B_RATIONALE_MISSING';
    }

    $trigger = $planB['trigger'] ?? null;
    $tipo = is_array($trigger) ? ($trigger['tipo'] ?? null) : null;
    if (! in_array($tipo, ['ROMPIMENTO', 'RETESTE', 'RETORNO_A_ZONA'], true)) {
        $errors[] = 'PLAN_B_TRIGGER_INVALID';
    }

    $triggerId = is_array($trigger) ? ($trigger['nivel_candidate_id'] ?? null) : null;
    if (! is_string($triggerId) || ! isset($porId[$triggerId])) {
        $errors[] = 'PLAN_B_TRIGGER_LEVEL_INVALID';
    }

    $triggerDescricao = is_array($trigger) ? ($trigger['descricao'] ?? null) : null;
    if (! is_string($triggerDescricao) || mb_strlen(trim($triggerDescricao)) < 20) {
        $errors[] = 'PLAN_B_TRIGGER_DESCRIPTION_MISSING';
    }

    if (is_string($entryId) && isset($porId[$entryId]) && in_array($direction, ['LONG', 'SHORT'], true)) {
        $side = $porId[$entryId]['side'] ?? null;

        if ($tipo === 'ROMPIMENTO') {
            $esperado = $direction === 'LONG' ? 'ABOVE' : 'BELOW';
            if ($side !== $esperado) {
                $errors[] = 'PLAN_B_BREAKOUT_SIDE_INVALID';
            }
        }

        if ($tipo === 'RETORNO_A_ZONA') {
            $esperado = $direction === 'LONG' ? 'BELOW' : 'ABOVE';
            if ($side !== $esperado) {
                $errors[] = 'PLAN_B_RETURN_SIDE_INVALID';
            }
        }
        // RETESTE não recebe regra fixa de lado.
    }

    $targetIds = array_values(array_filter(
        (array) data_get($planB, 'target_selection.candidate_ids', []),
        'is_string'
    ));

    if ($targetIds === []) {
        $errors[] = 'PLAN_B_TARGETS_MISSING';
    }

    foreach ($targetIds as $id) {
        if (! isset($porId[$id])) {
            $errors[] = 'PLAN_B_TARGET_INVALID';
            break;
        }
    }

    return array_values(array_unique($errors));
}
```

## Impacto

Não força conteúdo genérico. Força coerência de contrato. Se a IA omitir o Plano B ou usar id inexistente, o repair atual corrige a mesma análise com os mesmos dados.

---

# P0.5, remover o conceito de Plano B como simples pullback

## Problemas atuais em `PlanoBService.php`

Existem três dependências que ainda amarram o Plano B ao Plano A/pullback:

1. LONG B só pode ficar abaixo do preço e SHORT B só acima.
2. A entrada/zona B é rejeitada se cair na região invalidada pelo Plano A.
3. `zonaEstrutural()` força a zona a permanecer do lado de pullback/repique em relação ao preço atual.

Isto contraria a regra de planos independentes e elimina setups válidos de rompimento e reteste.

## Arquivo

`app/Services/GraphicalAnalysis/PlanoBService.php`

## 5.1 Trocar a validação de lado

APAGAR:

```php
if ($isShort ? $entradaB <= $preco : $entradaB >= $preco) {
    return $this->indisponivel('ENTRADA_B_DO_LADO_ERRADO');
}
```

SUBSTITUIR por:

```php
$tipoGatilho = $planB['trigger']['tipo'] ?? null;
$ladoEntrada = $ancora['side'] ?? null;

if ($tipoGatilho === 'ROMPIMENTO') {
    $ladoEsperado = $isShort ? 'BELOW' : 'ABOVE';
    if ($ladoEntrada !== $ladoEsperado) {
        return $this->indisponivel('ENTRADA_B_INCOMPATIVEL_COM_ROMPIMENTO');
    }
}

if ($tipoGatilho === 'RETORNO_A_ZONA') {
    $ladoEsperado = $isShort ? 'ABOVE' : 'BELOW';
    if ($ladoEntrada !== $ladoEsperado) {
        return $this->indisponivel('ENTRADA_B_INCOMPATIVEL_COM_RETORNO');
    }
}

// RETESTE não recebe regra fixa de lado.
```

## 5.2 Remover dependência da invalidação do Plano A

Remover o parâmetro:

```php
?float $ancoraInvalidacaoPlanoA,
```

Remover os dois blocos que comparam `$entradaB`, `$zonaDe` e `$zonaAte` com a invalidação do A.

No `ExecucaoService.php`, remover da chamada de `PlanoBService::gerar()` o argumento:

```php
$stopDisponivel ? ($stopRes['stop_ancora']['valor'] ?? $stop) : null,
```

Plano B tem sua própria entrada, stop e invalidação. Ele não deve morrer porque o Plano A seria invalidado naquela região.

## 5.3 Simplificar a zona estrutural em torno da Entrada B

SUBSTITUIR `zonaEstrutural()` por:

```php
private function zonaEstrutural(float $entradaB, array $targetCatalog): array
{
    $barreiras = array_values(array_filter(array_map(
        static fn (array $c): ?float => is_numeric($c['price'] ?? null)
            ? (float) $c['price']
            : null,
        $targetCatalog
    ), static fn (?float $v): bool => $v !== null));

    sort($barreiras);

    $abaixo = array_values(array_filter($barreiras, static fn (float $v): bool => $v < $entradaB));
    $acima = array_values(array_filter($barreiras, static fn (float $v): bool => $v > $entradaB));

    $zonaDe = $abaixo !== [] ? max($abaixo) : $entradaB;
    $zonaAte = $acima !== [] ? min($acima) : $entradaB;

    return [round($zonaDe, 4), round($zonaAte, 4)];
}
```

Chamada:

```php
[$zonaDe, $zonaAte] = $this->zonaEstrutural($entradaB, $targetCatalog);
```

## Impacto

Plano B passa a aceitar rompimento, reteste e retorno a zona sem herdar limitações do Plano A.

---

# P0.6, corrigir definitivamente o stop do Plano B

## Problema atual confirmado

Plano A chama `NivelService::stop()` com pivôs e candles.

Plano B chama o mesmo motor com:

```php
[],
[],
```

Isto elimina pivôs e desliga o segundo passe fractal do motor de stop.

## Arquivo

`app/Services/GraphicalAnalysis/PlanoBService.php`

## Alteração

Adicionar import:

```php
use App\Services\PivoService;
```

Adicionar ao construtor:

```php
public function __construct(
    private AlvoService $alvos,
    private NivelService $nivel,
    private BreakRetestService $breakRetest,
    private PivoService $pivoService,
) {}
```

Antes de calcular o stop B:

```php
$pivosStopB = $this->pivoService->relevantes(
    $candles,
    $entradaB,
    $atr
);
```

SUBSTITUIR a chamada do stop por:

```php
$stopRes = $this->nivel->stop(
    $isShort,
    $entradaB,
    $atr,
    $niveisContrato,
    $pivosStopB,
    $candles,
    $spreadBps,
    $slippageBps,
    is_string($stopCandidateIdB) ? $stopCandidateIdB : null,
);
```

## Impacto

Stop B passa a usar exatamente o mesmo motor estrutural do Stop A, porém recalculado em relação à Entrada B. Não herda stop A e não usa os pivôs errados da Entrada A.

---

# P0.7, regra definitiva do stop A e B

## Não criar outro motor

`NivelService` continua sendo o único autor numérico do stop.

Fluxo:

```text
Plano pronto
  ↓
NivelService usa API + candles + pivôs + níveis estruturais
  ↓
se houver suporte/resistência da Vision, eles participam do mesmo pool
  ↓
seleciona âncora técnica
  ↓
aplica buffer existente
  ↓
stop final
```

Não alterar entrada e não alterar TPs para melhorar o resultado.

## Se ainda vier STOP_UNAVAILABLE

Não fabricar stop por percentual. Não usar 5%, 10% ou um R:R desejado.

No curto prazo, o comportamento deve ser:

```php
if (! $stopRes['valido']) {
    // Não dimensionar e não liberar confirmação de posição.
    // A análise pode permanecer visível para diagnóstico, mas não pode parecer operacional.
}
```

No Plano B, `PlanoBService` já retorna `SEM_STOP_ESTRUTURAL_NA_ENTRADA_B`. Depois do P0.2 e P0.6, este estado deve ser exceção real.

## Impacto

O stop passa a ser consequência do setup e deixa de existir a tentativa de adaptar o setup ao stop.

---

# P0.8, Plano B nasce aguardando, não pode aparecer como atingido por candle histórico

## Problema atual

`PlanoBService` chama `BreakRetestService` usando a série histórica inteira no momento em que o plano acabou de ser criado. Um evento antigo pode marcar o novo Plano B como `ATINGIDO`.

O monitor de planos já é a camada correta para acompanhar eventos após a criação.

## Arquivo

`app/Services/GraphicalAnalysis/PlanoBService.php`

## Alteração

No momento da criação, substituir o cálculo histórico do estado por:

```php
$trigger = [
    'tipo' => $planB['trigger']['tipo'] ?? null,
    'nivel' => round($gatilhoNivel, 8),
    'descricao' => $planB['trigger']['descricao'] ?? null,
    'estado' => 'AGUARDANDO',
    'verificacao' => null,
];
```

O monitor posterior é quem muda para atingido quando houver evento real depois da criação.

## Impacto

Elimina o erro de mostrar "Zona alcançada" em um Plano B que acabou de ser criado e cujo preço ainda está longe da entrada.

---

# P0.9, usar a justificativa técnica do Plano A na tela

## Problema atual

`plan_a_risk_notes` já é gerado, persistido como `entry_notes`, mas o card A mostra apenas a frase fixa "Entrada a mercado no preço analisado".

## Frontend

`components/AnalysisResult.tsx`

No card do Plano A, após a frase fixa:

```tsx
{planoA?.entry_notes && (
  <p className="text-[9px] text-gray-400 font-mono tracking-wide leading-tight mt-1">
    {publicText(planoA.entry_notes)}
  </p>
)}
```

## Impacto

O membro entende por que a entrada a mercado é válida e qual risco técnico está aceitando ao não esperar o Plano B.

---

# P0.10, remover totalmente o R:R combinado

## Decisão final de produto

Não existe mais:

```text
rr_combinado
rr_liquido_combinado
rr_liquido_combinado_exibir
rr_liquido_combinado_abaixo_do_minimo
parciais_alvo para cálculo de R:R
```

Cada alvo mostra exclusivamente o R:R calculado contra a entrada e o stop do plano ativo.

## Backend

### `app/Services/ExecucaoService.php`

APAGAR:

```php
$rrCombinadoA = $this->calcularRrLiquidoCombinado($rrPorAlvoA);
$rrCombinadoB = $this->calcularRrLiquidoCombinado($rrPorAlvoB);
```

APAGAR dos payloads A e B:

```php
'rr_liquido_combinado' => ...,
'rr_liquido_combinado_exibir' => ...,
'rr_liquido_combinado_abaixo_do_minimo' => ...,
'parciais_alvo' => ...,
```

APAGAR o método:

```php
private function calcularRrLiquidoCombinado(array $rrPorAlvo): ?float
```

### `config/genesis.php`

APAGAR:

```php
'parciais_alvo' => [
    'tp1' => ...,
    'tp2' => ...,
    'tp3' => ...,
],
```

## Frontend

Remover os campos combinados de:

- `types/graphicalAnalysis.ts`
- interfaces duplicadas de execução/plano
- `AnalysisResult.tsx`
- `BlocoConviccaoQualidade.tsx`
- testes que exigem combinado

No bloco de qualidade, remover o R:R agregado. Os R:R permanecem somente nos cards de TP1, TP2 e TP3.

## Fórmula única

```php
$rr = abs($alvo - $entrada) / abs($entrada - $stop);
```

O backend já possui esta lógica em `calcularRrPorAlvo()`. Não recriar no frontend.

## Impacto

Cada plano apresenta três números objetivos e não existe um quarto número agregado capaz de mascarar a configuração.

---

# P0.11, não usar um alvo posterior para "consertar" o R:R do TP1

## Problema de apresentação

`PlanRecommendationService` hoje pode informar que o TP1 está abaixo da referência e que um alvo posterior "atende". Isto é matematicamente possível, mas visualmente parece que o TP2 torna o TP1 melhor.

Não criar nova lógica de probabilidade de alvo agora.

## Alteração mínima

Em `PlanRecommendationService::evaluate()`, quando o TP1 estiver abaixo do mínimo, usar texto simples:

```php
if ($rrLiquido !== null && $rrLiquido < $rrMinimo) {
    $recommended = false;
    $reasonCode = 'RR_LIQUIDO_TP1_ABAIXO_MINIMO';
    $alvoQueAtende = null;
    $motivo = 'O R:R do TP1 está abaixo da referência configurada. '
        .'TP2 e TP3 mantêm seus próprios R:R e não alteram a avaliação do TP1.';
}
```

Não precisa apagar `primeiroAlvoAcimaDoMinimo()` neste hotfix se houver outros consumidores. Se grep confirmar que ficou sem uso, remover junto.

## Impacto

A tela deixa de sugerir que um alvo distante "corrige" um primeiro alvo com R:R baixo.

---

# P0.12, frontend precisa trocar o plano inteiro, nunca campo por campo

## Problema atual confirmado

`AnalysisResult.tsx` possui fallback do plano ativo para A e dezenas de expressões como:

```tsx
planoAtivo?.stop ?? setup.stop
planoAtivo?.tp1 ?? setup.tp1
planoAtivo?.liquidacao ?? setup.liquidacao
```

Se B tiver um campo nulo, a tela pode misturar Entrada B com Stop A ou qualquer outro campo de A.

## Arquivo

`components/AnalysisResult.tsx`

## Substituir a resolução de planos

```tsx
const planos = Array.isArray(execution.planos) ? execution.planos : [];
const legacyMode = planos.length === 0;

const planoA = planos.find((p) => p.plano === 'A')
  ?? (legacyMode ? execution.candidate_setup : null);

const planoB = planos.find((p) => p.plano === 'B') ?? null;

const planoAtivo = zonaEfetiva === 'B' ? planoB : planoA;
```

APAGAR:

```tsx
|| planos.find((p) => p.plano === 'A')
|| planos[0]
```

## Regra de renderização

Depois de `planoAtivo` estar resolvido, todos os campos operacionais usam somente ele:

```tsx
planoAtivo?.entrada
planoAtivo?.stop
planoAtivo?.tp1
planoAtivo?.tp2
planoAtivo?.tp3
planoAtivo?.rr_por_alvo
planoAtivo?.alavancagem
planoAtivo?.liquidacao
planoAtivo?.risco_preco_pct
planoAtivo?.risco_pct_capital_base
planoAtivo?.risco_pct_margem
planoAtivo?.risco_usd_estimado
planoAtivo?.nocional_estimado
planoAtivo?.quantidade_base_estimada
planoAtivo?.invalidacao_nivel
planoAtivo?.invalidacao_estrutura_nivel
planoAtivo?.invalidacao_tese_nivel
planoAtivo?.qualidade_entrada
planoAtivo?.avisos
planoAtivo?.entry_notes
```

Não usar `?? setup.campo` depois dessa resolução.

## Impacto

Clicou A, tudo é A. Clicou B, tudo é B. Não existe configuração híbrida.

---

# P0.13, separar "selecionar plano" de "confirmar posição"

O usuário deve conseguir clicar no Plano B para ver a configuração mesmo enquanto o gatilho está aguardando. A confirmação de posição, porém, depende do plano ativo estar completo.

## Frontend

Após resolver `planoAtivo`:

```tsx
const planoAtivoCompleto = !!planoAtivo
  && Number.isFinite(Number(planoAtivo.entrada))
  && Number.isFinite(Number(planoAtivo.stop))
  && Number.isFinite(Number(planoAtivo.tp1));

const gatilhoBPronto = zonaEfetiva !== 'B'
  || planoB?.trigger?.estado === 'ATINGIDO';

const podeSelecionarPlano = execution.action !== null;
const podeConfirmarPosicao = execution.action !== null
  && planoAtivoCompleto
  && gatilhoBPronto;
```

Usar `podeSelecionarPlano` nos botões A/B.

Usar `podeConfirmarPosicao` somente no botão de confirmação.

## Impacto

O membro consegue estudar B antes do gatilho, mas não confirma uma entrada B que ainda não aconteceu.

---

# P0.14, liquidação em branco, corrigir configuração de produção

## Estado do código atual

`LiquidationCalculatorService` já está ligado ao Plano A e ao Plano B e exige bracket real da Binance. O endpoint de leverage bracket é autenticado. Sem chave/secret, o serviço retorna `UNAVAILABLE` e a tela mostra `,`.

## Backend `.env.example`

Adicionar:

```dotenv
GENESIS_BINANCE_API_KEY=
GENESIS_BINANCE_API_SECRET=
GENESIS_RISCO_POR_ANALISE=0.01
```

O valor de risco acima é apenas exemplo. Produção deve usar o valor decidido pelo produto.

## `GenesisGraphicalPreflight.php`

Adicionar:

```php
if (config('app.env') === 'production') {
    if (blank(config('binance.api_key'))) {
        $errors[] = 'GENESIS_BINANCE_API_KEY ausente, liquidação ficará indisponível';
    }

    if (blank(config('binance.api_secret'))) {
        $errors[] = 'GENESIS_BINANCE_API_SECRET ausente, liquidação ficará indisponível';
    }

    if (! is_numeric(config('genesis.risco_por_analise'))
        || (float) config('genesis.risco_por_analise') <= 0) {
        $errors[] = 'GENESIS_RISCO_POR_ANALISE deve ser numérico e maior que zero';
    }
}
```

## Aceite

Para A e B:

```text
maintenance_margin.status = AVAILABLE
liquidacao != null, quando alavancagem > 1
liquidacao_rotulo = estimada
```

## Impacto

A liquidação deixa de aparecer vazia quando o problema é apenas ambiente incompleto.

---

# P0.15, corrigir custo de funding que distorce o R:R líquido

## Problema atual

`periodosFunding()` usa:

```php
'1d' => 45,
'1w' => 135,
```

Isto presume 15 dias de funding para um setup 1D e 45 dias para 1W. O custo pode dominar o R:R.

Além disso, funding favorável pode tornar o custo total negativo e fazer o R:R líquido aparecer maior que o bruto.

## Hotfix simples

Trocar por:

```php
private static function periodosFunding(?string $timeframe): int
{
    return match ($timeframe) {
        '15m', '30m', '1h', '2h', '3h', '4h', '6h', '8h', '12h' => 1,
        '1d' => 3,
        '1w' => 9,
        default => 1,
    };
}
```

E separar custo de crédito de funding:

```php
$fundingBpsAssinado = $isShort ? -$fundingBpsBruto : $fundingBpsBruto;

$custoOperacionalBps = (float) ($custosConfig['entrada'] ?? 0)
    + (float) ($custosConfig['saida'] ?? 0)
    + $spreadBps
    + $slippageBps;

$custoFundingParaRrBps = max(0.0, $fundingBpsAssinado);
$custoTotalBps = $custoOperacionalBps + $custoFundingParaRrBps;
```

Funding a favor pode continuar sendo mostrado como informação separada, mas não deve melhorar um R:R denominado "líquido".

## Impacto

R:R líquido continua conservador, mas deixa de ser dominado por uma hipótese arbitrária de permanência e nunca fica melhor que o bruto por crédito projetado.

---

# P0.16, configuração de produção e fila

## Problemas atuais

Backend `.env.example` ainda traz:

```dotenv
QUEUE_CONNECTION=sync
```

Frontend usa fallback:

```ts
import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
```

Em produção isto não pode depender de fallback local.

## Backend

Produção:

```dotenv
QUEUE_CONNECTION=database
GENESIS_QUEUE_RETRY_AFTER=540
APP_DEBUG=false
GENESIS_SHADOW_MODE=false
```

Adicionar no `genesis:preflight`:

```php
if (config('app.env') === 'production' && config('queue.default') === 'sync') {
    $errors[] = 'QUEUE_CONNECTION não pode ser sync em produção';
}
```

Garantir worker permanente:

```bash
php artisan queue:work --queue=default --sleep=1 --tries=1 --timeout=500
```

E scheduler:

```bash
* * * * * cd /caminho/do/backend && php artisan schedule:run >> /dev/null 2>&1
```

## Frontend

Criar/atualizar `.env.example`:

```dotenv
VITE_API_URL=https://SEU-DOMINIO-API/api
```

No deploy, `VITE_API_URL` é obrigatório antes de `npm run build`.

## Impacto

Evita análise longa rodando dentro da requisição web e evita build de produção chamando `localhost` no computador do membro.

---

# Itens da auditoria Claude/Cloud que já estão corrigidos no backend 46

Não reimplementar estes pontos. Somente manter testes de regressão:

1. PDH/PDL já recebem candles brutos em `MarketSnapshotService`, corrigindo o período anterior.
2. LTA, LTB e canal já entram no `TargetCandidateCatalog` como `linha_tendencia`.
3. Fibonacci de peso zero já não é apagado antes da IA.
4. VRVP abaixo de 0,70 já entra marcado com sua própria confiança no catálogo de alvos.
5. Figuras já carregam id/estado/viés no catálogo.
6. Plano B já possui `target_selection` próprio, não precisa voltar a herdar alvos do A.
7. O antigo preço fabricado por `stop × 0,995/1,005` já foi removido. Não trazer de volta.
8. Squeeze já usa o lado correto do book e o sinal correto do movimento do preço em `DerivativesReadingService`.
9. `plano_b_contrato` já é persistido no fluxo atual.
10. Qualidade de entrada do Plano B já é chamada usando a Entrada B.

Estes itens continuam no gate de regressão porque podem quebrar durante o hotfix.

---

# P1, não bloqueadores do núcleo, mas verificar antes de liberar geral

## Frescor de fontes

Se um bloco como sentimento estiver indisponível, a tela não deve afirmar frescor 100% de todas as fontes sem explicar o denominador. Não mexer no cérebro para isto. Corrigir apenas o denominador/exibição se o caso ainda aparecer.

## Arredondamento de lote

O arredondamento conservador para baixo está correto. Não alterar o risco para forçar o lote. Apenas reduzir ruído visual quando o desvio estiver dentro do limiar aceito pelo produto.

## Score 90/100 com teto interno 90

Não alterar o score neste hotfix. Se o teto matemático continuar 90, ajustar somente a representação posteriormente. Não bloquear o deploy do núcleo operacional por isto.

---

# Ordem de implementação

Aplicar nesta ordem para evitar vai e volta:

```text
1. P0.1  Remover rr_provisorio da escolha dos alvos
2. P0.2  Vision/OCR nos candidatos de stop
3. P0.3  Prompt do Plano B técnico
4. P0.4  Validador do Plano B usando repair existente
5. P0.5  Remover regra de pullback e dependência do Plano A
6. P0.6  Pivôs/candles próprios no Stop B
7. P0.8  Plano B nasce AGUARDANDO
8. P0.10 Remover R:R combinado
9. P0.11 Simplificar mensagem de R:R do TP1
10. P0.12 Troca integral A/B no frontend
11. P0.13 Separar seleção de plano e confirmação
12. P0.9  Exibir entry_notes do Plano A
13. P0.14 Liquidação/env/preflight
14. P0.15 Funding
15. P0.16 Produção/fila/VITE_API_URL
```

---

# Contrato final do backend

`execution.planos` precisa ter dois objetos independentes quando a análise é aceita operacionalmente:

```json
[
  {
    "plano": "A",
    "entrada": 0,
    "stop": 0,
    "tp1": 0,
    "tp2": 0,
    "tp3": 0,
    "rr_por_alvo": {
      "tp1": {"rr_bruto": 0, "rr_liquido": 0, "rr_bruto_exibir": "1:0.00", "rr_liquido_exibir": "1:0.00"},
      "tp2": {"rr_bruto": 0, "rr_liquido": 0, "rr_bruto_exibir": "1:0.00", "rr_liquido_exibir": "1:0.00"},
      "tp3": {"rr_bruto": 0, "rr_liquido": 0, "rr_bruto_exibir": "1:0.00", "rr_liquido_exibir": "1:0.00"}
    },
    "liquidacao": 0,
    "risco_usd_estimado": 0,
    "nocional_estimado": 0,
    "quantidade_base_estimada": 0,
    "entry_notes": "..."
  },
  {
    "plano": "B",
    "entrada": 0,
    "stop": 0,
    "tp1": 0,
    "tp2": 0,
    "tp3": 0,
    "rr_por_alvo": {
      "tp1": {"rr_bruto": 0, "rr_liquido": 0, "rr_bruto_exibir": "1:0.00", "rr_liquido_exibir": "1:0.00"},
      "tp2": {"rr_bruto": 0, "rr_liquido": 0, "rr_bruto_exibir": "1:0.00", "rr_liquido_exibir": "1:0.00"},
      "tp3": {"rr_bruto": 0, "rr_liquido": 0, "rr_bruto_exibir": "1:0.00", "rr_liquido_exibir": "1:0.00"}
    },
    "trigger": {
      "tipo": "RETESTE",
      "nivel": 0,
      "descricao": "...",
      "estado": "AGUARDANDO"
    },
    "liquidacao": 0,
    "risco_usd_estimado": 0,
    "nocional_estimado": 0,
    "quantidade_base_estimada": 0,
    "entry_notes": "..."
  }
]
```

Os zeros acima representam valores numéricos de exemplo do contrato, não valores a publicar.

Não existe nenhum campo de R:R combinado.

---

# Testes obrigatórios do hotfix

## Backend

Atualizar/adicionar testes:

### Plano B rompimento LONG acima do preço

```php
public function test_plano_b_long_rompimento_pode_ficar_acima_do_preco(): void
{
    // preço atual 100, entrada B real 103, trigger ROMPIMENTO.
    // Deve gerar plano, não ENTRADA_B_DO_LADO_ERRADO.
}
```

### Plano B retorno LONG abaixo do preço

```php
public function test_plano_b_long_retorno_a_zona_pode_ficar_abaixo_do_preco(): void
{
    // preço atual 100, entrada B 96, trigger RETORNO_A_ZONA.
}
```

### Stop B usa pivôs e candles

```php
public function test_stop_b_usa_pivos_relativos_a_entrada_b_e_candles(): void
{
    // montar cenário onde o stop só existe via pivô/zoom.
    // Antes falhava com SEM_STOP_ESTRUTURAL_NA_ENTRADA_B.
    // Depois precisa retornar stop válido.
}
```

### Plano B não depende da invalidação A

```php
public function test_plano_b_nao_e_rejeitado_por_invalidacao_do_plano_a(): void
{
    // A e B são configurações independentes.
}
```

### R:R individual

```php
public function test_rr_por_alvo_usa_entrada_e_stop_do_proprio_plano(): void
{
    // Plano A e B com entradas/stops diferentes.
    // rr_por_alvo precisa divergir mesmo se algum alvo absoluto for igual.
}
```

### R:R combinado não existe

```php
$this->assertArrayNotHasKey('rr_liquido_combinado', $planoA);
$this->assertArrayNotHasKey('rr_liquido_combinado_exibir', $planoA);
$this->assertArrayNotHasKey('parciais_alvo', $planoA);
```

### Trigger novo nasce aguardando

```php
$this->assertSame('AGUARDANDO', $planoB['trigger']['estado']);
```

## Frontend

Adicionar teste de autoridade do plano:

```tsx
it('Plano B nunca usa campo do Plano A como fallback', () => {
  // B selecionado com entrada/stop/TPs próprios.
  // Todos os valores renderizados precisam vir de B.
});
```

Adicionar teste de ausência de combinado:

```tsx
expect(fonte).not.toContain('rr_liquido_combinado');
expect(fonte).not.toContain('parciais_alvo');
```

Adicionar teste de troca:

```text
A selecionado -> entrada/stop/TP/RR/liquidação A
B selecionado -> entrada/stop/TP/RR/liquidação B
volta A -> todos os valores voltam para A
```

---

# Matriz de aceite com os casos reais

Rodar novamente do upload até a tela:

1. BTCUSDT 1D
2. ZECUSDT 1D
3. SUIUSDT 4H
4. Um setup SHORT

Para CADA ativo confirmar:

```text
[ ] Plano A aparece
[ ] Stop A existe e tem stop_ancora
[ ] TP1/TP2/TP3 A são técnicos
[ ] cada TP A mostra seu R:R
[ ] não existe R:R combinado
[ ] Plano B aparece com entrada e trigger técnicos
[ ] Plano B não é forçado a ser pullback
[ ] Stop B existe e é calculado a partir da Entrada B
[ ] TP1/TP2/TP3 B são próprios do B
[ ] cada TP B mostra seu R:R
[ ] selecionar B troca stop, TPs, R:R, risco, tamanho, margem e liquidação
[ ] voltar A restaura todos os dados A
[ ] plano B novo começa AGUARDANDO
[ ] liquidação aparece quando leverage > 1 e bracket Binance está disponível
[ ] nenhuma tela usa campo de A para preencher B
```

---

# Comandos de verificação

Backend:

```bash
composer install --no-dev --prefer-dist --optimize-autoloader
php artisan migrate --force
php artisan optimize:clear
php artisan genesis:preflight
php artisan test
php artisan schedule:list
php artisan queue:restart
```

Frontend:

```bash
npm ci
npx tsc --noEmit
npm test
npm run build
```

Manifesto da release, sobre a árvore FINAL que foi testada:

```bash
bash deploy/gerar_manifesto.sh
bash deploy/verificar_manifesto.sh
```

Só liberar se o manifesto passar sem divergência.

---

# Critério final de liberação

A versão está apta para subir quando o comportamento for este:

```text
Plano A selecionado
  -> Entrada A
  -> Stop A
  -> TP1 A + R:R TP1 A
  -> TP2 A + R:R TP2 A
  -> TP3 A + R:R TP3 A
  -> risco/tamanho/margem/liquidação A

Seleciona Plano B
  -> Entrada B
  -> Trigger B
  -> Stop B
  -> TP1 B + R:R TP1 B
  -> TP2 B + R:R TP2 B
  -> TP3 B + R:R TP3 B
  -> risco/tamanho/margem/liquidação B
```

Nenhum cálculo de R:R combinado.

Nenhum fallback silencioso de B para A.

Nenhum stop alterando entrada ou alvo.

Nenhum Plano B fabricado.

Nenhum preço inventado.

O objetivo deste hotfix é fechar o fluxo operacional existente, não redesenhar o cérebro do Gênesis.
