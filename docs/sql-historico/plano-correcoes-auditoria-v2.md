# Plano de Correções — Auditoria da Persistência v2

## Diagnóstico Central

A **Edição 0 foi aplicada com sucesso** (serviços ligados, direção correta, stop dentro do teto). Mas a **costura virou uma ilha**: ela corrige `$result['execucao']` (reconciliado), porém a descrição do plano, o risco máximo, a narrativa e outros trechos continuam lendo `$setupMatematico` (motor antigo). Isso gera **fonte dupla** — o card mostra stop `$16,5294` e a descrição mostra `$26,255` com risco 88,94%.

### O que já estava correto (Edição 0)

- 4 serviços injetados e rodando
- Direção vindo do EstruturaService (SHORT correto)
- Stop do card respeitando teto de 20%
- Acentuação melhorada
- Cache do sentimento por ativo com janela de 45 min

### Regras de ouro

- **Nada se apaga.** Só se troca a fonte de leitura ou se adiciona código
- `MotorExecucaoService` permanece intacto — ele ainda fornece entrada e direção
- Motor paralelo do front (scoringEngine.ts) **NÃO se remove agora** — quebra a suite de testes
- Validar com LABUSDT SHORT e APTUSDT SHORT como regressão

---

## Arquivos afetados

| Arquivo | Correções |
|---------|-----------|
| `app/Services/GeminiAnalysisService.php` | C1, C2, C3, C7, C8, C11 |
| `app/Services/SetupReconciler.php` | C4, C5 |
| `app/Services/AlvoService.php` | C6, C9 |
| `app/Services/ScoringService.php` | C10, C12, C13, C14, C15 |
| `app/Services/ContextBuilderService.php` | C12, C13 |

---

## Ordem de Execução

### Fase 1 — Eliminar fonte dupla (maior impacto)

---

### C1 (CRÍTICO) — Fazer a tela inteira ler o setup reconciliado

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php`

Após a costura, trocar TODAS as leituras de `$setupMatematico` pelo reconciliado `$result['execucao']`:

**(a) L632 — Entrada do Plano A**
```php
// DE:
$result['entradaSugerida']['planoA'] = $setupMatematico['setup']['entrada'] ?? 0;
// PARA:
$result['entradaSugerida']['planoA'] = $result['execucao']['setup']['entrada'] ?? 0;
```

**(b) L643-644 — Stop e risco usados na descrição do Plano A**
```php
// DE:
$stopVal  = $setupMatematico['setup']['stop'] ?? 0;
$riscoPct = $setupMatematico['setup']['riscoPct'] ?? 0;
// PARA:
$stopVal  = $result['execucao']['setup']['stop'] ?? 0;
$riscoPct = $result['execucao']['setup']['riscoPct'] ?? 0;
```

**(c) L663 — Plano B**
```php
// DE:
$pb = $setupMatematico['planoB'] ?? [];
// PARA:
$pb = $result['execucao']['planoB'] ?? [];
```

**(d) L680-686 — Alavancagem, entrada e risco (cálculo de tamanho e risco máximo)**
```php
// DE:
$alavReal     = (float) ($setupMatematico['setup']['alavancagem'] ?? $leverage);
$precoEntrada = (float) ($setupMatematico['setup']['entrada'] ?? 0);
$riscoStop    = abs($precoEntrada - (float) ($setupMatematico['setup']['stop'] ?? $precoEntrada));
// PARA:
$alavReal     = (float) ($result['execucao']['setup']['alavancagem'] ?? $leverage);
$precoEntrada = (float) ($result['execucao']['setup']['entrada'] ?? 0);
$riscoStop    = abs($precoEntrada - (float) ($result['execucao']['setup']['stop'] ?? $precoEntrada));
```

---

### C11 (ALTO) — Gravar riscoPct reconciliado na costura

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php` — costura, bloco do stop (~L590)

No bloco onde `$stopRes['valido']` é true, adicionar gravação do `riscoPct`:
```php
if ($stopRes['valido']) {
    $result['execucao']['setup']['stop']     = $stopRes['nivel'];
    $result['execucao']['setup']['riscoPct'] = $stopRes['riscoPct'];   // ← ADICIONAR
    $result['execucao']['zonaInteresse']['invalidacao'] =
        'A tese sera invalidada se o preco fechar '
        . ($isShort ? 'acima' : 'abaixo') . ' de $' . $stopRes['nivel'];
}
```

---

### C8 (ALTO) — Recalcular RR depois da costura

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php` — costura, após gravar alvos (~L617)

Após os alvos serem gravados e antes do SetupReconciler, recalcular `rr1`:
```php
$entR  = (float) ($result['execucao']['setup']['entrada'] ?? 0);
$stopR = (float) ($result['execucao']['setup']['stop'] ?? 0);
$tp1R  = (float) ($result['execucao']['setup']['tp1'] ?? 0);
if ($entR > 0 && $stopR > 0 && $tp1R > 0) {
    $riscoR   = abs($entR - $stopR);
    $retornoR = abs($tp1R - $entR);
    $result['execucao']['setup']['rr1'] = $riscoR > 0 ? round($retornoR / $riscoR, 2) : 0;
}
```

---

### Fase 2 — Narrativa coerente

---

### C2 (CRÍTICO) — Passar setup reconciliado para a narrativa

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php` — L692

```php
// DE:
$narrativas = $this->gerarNarrativa($symbol, $indicadores, $score, $setupMatematico, $wyckoffResult, $derivativos, $elementosVisuais, $zonas, $contexto, $direcaoSetup);
// PARA:
$narrativas = $this->gerarNarrativa($symbol, $indicadores, $score, $result['execucao'], $wyckoffResult, $derivativos, $elementosVisuais, $zonas, $contexto, $direcaoSetup);
```

---

### C3 (ALTO) — Modelo repete invalidação pronta, não calcula

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php` — Prompt 1 da narrativa

**(a) Extrair a frase de invalidação do setup reconciliado (antes do prompt):**
```php
$fraseInvalidacao = $setup['zonaInteresse']['invalidacao'] ?? '';
```

**(b) Substituir a linha 9 do prompt (que manda o modelo formular):**
```php
// DE:
"9. Invalidacao condicional: a tese sera invalidada se o preco fechar acima/abaixo de $X.\n\n"
// PARA:
"9. Use EXATAMENTE esta frase de invalidacao, sem recalcular: \"{$fraseInvalidacao}\".\n\n"
```

**(c) Remover a regra de linguagem que ensina o modelo a formular invalidação:**
```php
// REMOVER esta linha:
"- Invalidacao sempre condicional e clara: A tese sera invalidada se o preco fechar acima de $X.\n"
```

---

### Fase 3 — Reconciliador que bloqueia

---

### C4 (ALTO) — Gate de risco-retorno mínimo

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\SetupReconciler.php`

**(a) Adicionar constante na classe:**
```php
const RR_MINIMO = 1.5;
```

**(b) Adicionar chamada no método `reconciliar()`:**
```php
public function reconciliar(array $setup, string $contexto, array $indicadores = [], array $score = []): array
{
    $setup = $this->corrigirDirecao($setup, $score);
    $setup = $this->validarStopAntesLiquidacao($setup);
    $setup = $this->validarTPs($setup);
    $setup = $this->gateRiscoRetorno($setup);   // ← NOVO
    return $setup;
}
```

**(c) Novo método `gateRiscoRetorno()`:**
```php
private function gateRiscoRetorno(array $setup): array
{
    $entrada = (float) ($setup['setup']['entrada'] ?? 0);
    $stop    = (float) ($setup['setup']['stop'] ?? 0);
    $tp1     = (float) ($setup['setup']['tp1'] ?? 0);
    if ($entrada == 0 || $stop == 0 || $tp1 == 0) return $setup;

    $risco   = abs($entrada - $stop);
    $retorno = abs($tp1 - $entrada);
    $rr = $risco > 0 ? $retorno / $risco : 0;
    $setup['setup']['rr1'] = round($rr, 2);

    if ($rr < self::RR_MINIMO) {
        $setup['acao'] = 'AGUARDAR';
        $setup['setup']['verificacao'] = 'INSEGURO';
        $setup['avisos'][] = 'RR de 1:' . round($rr, 2) . ' abaixo do minimo 1:' . self::RR_MINIMO . '. Setup nao operavel.';
    }

    return $setup;
}
```

---

### C5 (ALTO) — Stop nunca bloqueia, só dimensiona risco

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\SetupReconciler.php` — `validarStopAntesLiquidacao()`

Remover qualquer `$setup['acao'] = 'AGUARDAR'` vindo do stop. Stop inseguro vira apenas aviso e `perfilRisco`:
```php
if (!$stopSeguro) {
    // NUNCA mexer em $setup['acao']. Apenas sinalizar o risco ao trader.
    $setup['setup']['perfilRisco'] = 'ALTO';
    $setup['avisos'][] = 'Stop proximo da liquidacao. Risco alto: reduza o tamanho ou a alavancagem.';
}
```

---

### Fase 4 — Alvos

---

### C6 (MÉDIO) — Alvos sem colar em ativo volátil

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\AlvoService.php` — `projetarAlvos()`

Substituir o método:
```php
private function projetarAlvos(bool $isShort, float $preco, float $atr): array
{
    // perna limitada: nunca passa de 8% do preco por alvo de referencia
    $perna = min(max($atr * 1.5, $preco * 0.01), $preco * 0.08);
    $m = [1.0, 1.618, 2.618];
    $pisoShort = $preco * 0.80;

    $t = $isShort
        ? array_map(fn($k) => max($preco - $perna * $k, $pisoShort), $m)
        : array_map(fn($k) => $preco + $perna * $k, $m);

    // se colaram, separa em degraus minimos
    $t = $this->separarDegraus($t, $preco, $isShort);

    return [
        'tp1' => round($t[0], 4), 'tp1_fonte' => 'projecao',
        'tp2' => round($t[1], 4), 'tp2_fonte' => 'projecao',
        'tp3' => round($t[2], 4), 'tp3_fonte' => 'projecao',
    ];
}
```

**(b) Novo método `separarDegraus()`:**
```php
private function separarDegraus(array $t, float $preco, bool $isShort): array
{
    $minGap = $preco * 0.01;
    sort($t);
    if ($isShort) { rsort($t); }
    for ($i = 1; $i < count($t); $i++) {
        if (abs($t[$i] - $t[$i-1]) < $minGap) {
            $t[$i] = $isShort ? $t[$i-1] - $minGap : $t[$i-1] + $minGap;
        }
    }
    return $t;
}
```

---

### C9 (MÉDIO) — Garantir sempre 3 alvos

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\AlvoService.php` — final de `calcularAlvos()`

Substituir o return final:
```php
$tp1v = $tp1 ? $tp1['valor'] : null;
$tp2v = $tp2 ? $tp2['valor'] : ($tp1v !== null ? ($this->projetarExtensao($preco, $tp1v, $isShort)['valor'] ?? null) : null);
$tp3v = $tp3 ? $tp3['valor'] : ($tp2v !== null ? ($this->projetarExtensao($preco, $tp2v, $isShort)['valor'] ?? null) : null);

// se ainda faltou algum, cair no projetarAlvos (que ja devolve os 3 separados)
if ($tp1v === null || $tp2v === null || $tp3v === null) {
    return $this->projetarAlvos($isShort, $preco, $atr);
}

return [
    'tp1' => round($tp1v, 4), 'tp1_fonte' => $tp1['fonte'] ?? 'projecao',
    'tp2' => round($tp2v, 4), 'tp2_fonte' => $tp2['fonte'] ?? 'extensao',
    'tp3' => round($tp3v, 4), 'tp3_fonte' => $tp3['fonte'] ?? 'extensao',
];
```

---

### Fase 5 — Acabamento de saída

---

### C7 (BAIXO) — Formatar números antes do texto

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php` — montagem do contexto (antes do Prompt 1)

```php
$fmt = fn($v, $casas = 4) => is_numeric($v) ? number_format((float) $v, $casas, '.', '') : $v;
$indicadoresFmt = $indicadores;
foreach (['macd','macdSignal','macdHist','rsi','adx','plusDI','minusDI','cvd','atr'] as $k) {
    if (isset($indicadoresFmt[$k])) $indicadoresFmt[$k] = $fmt($indicadoresFmt[$k], 2);
}
// usar $indicadoresFmt para montar o texto do contexto/narrativa
```

---

### Fase 6 — Derivativos e calibração

---

### C12 (ALTO) — Corrigir unidade do L/S ratio

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\ScoringService.php` (~L386-396)

Trocar limiares de fração para escala de razão:
```php
if (isset($d['long_short_ratio']) && $d['long_short_ratio'] !== null) {
    $ls = (float) $d['long_short_ratio'];   // razao: 1.0 = equilibrio
    if ($ls > 1.30) {                       // muito mais longs → contrarian bear
        $add('derivativos', 0, 5);
        $flags[] = 'MERCADO_SOBRECOMPRADO';
    } elseif ($ls < 0.77) {                 // muito mais shorts → contrarian bull
        $add('derivativos', 5, 0);
        $flags[] = 'MERCADO_SOBREVENDIDO';
    } else {                                // ~0.77 a 1.30 = equilibrado, NAO pontua direcao
        $add('derivativos', 1, 1);
    }
}
```

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\ContextBuilderService.php` (~L303-308)
```php
if (!empty($der['long_short_ratio'])) {
    $ls = (float) $der['long_short_ratio'];
    $r .= 'L/S Ratio=' . $ls;
    if ($ls > 1.30)      $r .= ' - Excesso de longs. Sinal contrario fraco.';
    elseif ($ls < 0.77)  $r .= ' - Excesso de shorts. Risco de short squeeze.';
    else                 $r .= ' - Posicionamento equilibrado, sem vies.';
    $r .= "\n";
}
```

---

### C13 (MÉDIO) — Faixas de funding na escala decimal

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\ScoringService.php` (~L353-366)

Substituir bloco de funding:
```php
if (isset($d['funding_rate']) && $d['funding_rate'] !== null) {
    $fr = (float) $d['funding_rate'];          // decimal: 0.0001 = 0,01%

    // neutro: -0,01% a +0,01%
    if ($fr >= -0.0001 && $fr <= 0.0001) {
        $add('derivativos', 4, 4);             // simetrico, sem vies
    }
    // LONG squeeze (funding positivo) → risco baixista
    elseif ($fr > 0.0015)  { $add('derivativos', 0, 8); $flags[] = 'FUNDING_LONG_EXTREMO'; }
    elseif ($fr > 0.00075) { $add('derivativos', 0, 6); $flags[] = 'FUNDING_LONG_ELEVADO'; }
    elseif ($fr > 0.0003)  { $add('derivativos', 0, 4); $flags[] = 'FUNDING_LONG_MEDIO'; }
    // SHORT squeeze (funding negativo) → risco altista
    elseif ($fr < -0.0015) { $add('derivativos', 8, 0); $flags[] = 'FUNDING_SHORT_EXTREMO'; }
    elseif ($fr < -0.00075){ $add('derivativos', 6, 0); $flags[] = 'FUNDING_SHORT_ELEVADO'; }
    elseif ($fr < -0.0003) { $add('derivativos', 4, 0); $flags[] = 'FUNDING_SHORT_MEDIO'; }
}
```

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\ContextBuilderService.php` (~L282-289)
```php
if (!empty($der['funding_rate'])) {
    $fr = (float) $der['funding_rate'];
    $r .= 'Funding Rate=' . $der['funding_rate'];
    if ($fr > 0.0015)        $r .= ' - Positivo EXTREMO (>0,15%). Longs lotados, risco alto de long squeeze.';
    elseif ($fr > 0.00075)   $r .= ' - Positivo elevado (>0,075%). Excesso forte de longs.';
    elseif ($fr > 0.0003)    $r .= ' - Positivo medio. Excesso moderado de longs.';
    elseif ($fr < -0.0015)   $r .= ' - Negativo EXTREMO (<-0,15%). Shorts lotados, risco alto de short squeeze.';
    elseif ($fr < -0.00075)  $r .= ' - Negativo elevado (<-0,075%). Excesso forte de shorts.';
    elseif ($fr < -0.0003)   $r .= ' - Negativo medio. Excesso moderado de shorts.';
    else                     $r .= ' - Neutro. Assimetria baixa, sem vies de posicionamento.';
    $r .= "\n";
}
```

---

### C14 (MÉDIO) — Flag de squeeze só por confluência

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\ScoringService.php` — após os blocos de funding, OI, L/S e cluster

```php
// CORRECAO 14: flag de squeeze SO por confluencia (regra oficial).
// Funding, OI, L/S e cluster ISOLADOS nunca acendem squeeze. A flag so sobe
// quando funding + OI + estrutura de preco + liquidez apontam para o MESMO risco.

$fundLongElevado  = in_array('FUNDING_LONG_ELEVADO', $flags)  || in_array('FUNDING_LONG_EXTREMO', $flags);
$fundShortElevado = in_array('FUNDING_SHORT_ELEVADO', $flags) || in_array('FUNDING_SHORT_EXTREMO', $flags);
$oiSubindo        = !empty($d['oi_subindo']);
$perdendoSuporte  = !$precoSubindo;                    // preco cedendo
$rompendoResist   = $precoSubindo;                     // preco subindo contra os vendidos
$liqAbaixo        = in_array('CLUSTER_ABAIXO', $flags);
$liqAcima         = in_array('CLUSTER_ACIMA', $flags);

// LONG SQUEEZE (baixista): funding+ elevado E OI subindo E preco perdendo suporte E liquidez abaixo
if ($fundLongElevado && $oiSubindo && $perdendoSuporte && $liqAbaixo) {
    $flags[] = 'LONG_SQUEEZE_IMINENTE';
}
// SHORT SQUEEZE (altista): funding- elevado E OI subindo E preco rompendo resistencia E liquidez acima
if ($fundShortElevado && $oiSubindo && $rompendoResist && $liqAcima) {
    $flags[] = 'SHORT_SQUEEZE_IMINENTE';
}
```

---

### C10 (ALTO) — Converter score em convicção na direção decidida

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\ScoringService.php` — `agregarFamilias()`

A direção já vem da Estrutura. O score vira **convicção** (0-100) na direção escolhida:

```php
// $isShort vem do EstruturaService (direcao ja decidida)
$pesoMaxTotal = 0; $favor = 0;
foreach (self::PESOS_FAMILIA as $nome => $peso) {
    $f = $familias[$nome] ?? null;
    if (!$f || empty($f['presente'])) continue;
    $pesoMaxTotal += $peso;
    $bull = (float)($f['bull'] ?? 0);
    $bear = (float)($f['bear'] ?? 0);
    $total = $bull + $bear;
    if ($total == 0) continue;
    // quanto desta familia esta A FAVOR da direcao decidida
    $aFavor = $isShort ? ($bear / $total) : ($bull / $total);
    if (in_array($nome, ['estrutura','momentum'], true)) $aFavor *= $volMult;
    $favor += $peso * $aFavor;
}
// CONVICCAO: 0 = nenhum sinal a favor, 100 = todos os sinais a favor do lado escolhido
$score = $pesoMaxTotal > 0 ? (int) round(($favor / $pesoMaxTotal) * 100) : 50;
```

**ATENÇÃO:** `$isShort` precisa ser passado para `agregarFamilias()` ou para `calcular()`. A assinatura deve ser ajustada:
```php
// DE:
private function agregarFamilias(array $familias, float $volMult = 1.0): array
// PARA:
private function agregarFamilias(array $familias, float $volMult = 1.0, bool $isShort = false): array
```
E a chamada em `calcular()`:
```php
// DE:
$raw = $this->agregarFamilias($fam, $volMult);
// PARA:
$raw = $this->agregarFamilias($fam, $volMult, $isShort);
```
Onde `$isShort` deve ser derivado da direção já decidida (EstruturaService) e passado para `calcular()` via parâmetro adicional ou via campo no array `$d`.

---

### C15 (MÉDIO) — Recalibração das famílias

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\ScoringService.php`

**(a) Atualizar `PESOS_FAMILIA`:**
```php
private const PESOS_FAMILIA = [
    'estrutura'   => 30,   // dominante, decide a direcao
    'orderflow'   => 28,   // confirma agressao real
    'derivativos' => 28,   // confirma alavancagem / risco de squeeze
    'momentum'    => 14,   // confirmacao secundaria, mais atrasado
];
```

**(b) Atualizar inicialização das famílias em `calcular()`:**
```php
$fam = [
    'estrutura'   => ['bull'=>0,'bear'=>0,'presente'=>false,'pesoMax'=>30],
    'orderflow'   => ['bull'=>0,'bear'=>0,'presente'=>false,'pesoMax'=>28],
    'derivativos' => ['bull'=>0,'bear'=>0,'presente'=>false,'pesoMax'=>28],
    'momentum'    => ['bull'=>0,'bear'=>0,'presente'=>false,'pesoMax'=>14],
];
```

**(c) Distribuição interna (tetos por sub-sinal):**
```
ESTRUTURA (30):  EMAs/empilhamento 8 | Golden/Death Cross 4 | Wyckoff 10 | Figuras 8
ORDERFLOW (28):  CVD slope 9 | Divergencia CVD 9 | Volume 5 | Book imbalance 5
DERIVATIVOS (28): Funding 8 | Open Interest 10 | L/S Ratio 4 | Clusters liquidacao 6
MOMENTUM (14):   RSI 4 | ADX 3 | MACD 4 | DMI+divergencia 3
```

**Destaques:**
- Open Interest passa a ser o MAIOR peso de derivativos (10)
- L/S Ratio cai para 4 (era 5): mais manipulável, nunca gatilho isolado
- Clusters de liquidação sobem para 6
- Momentum achatado (14): mais atrasado, confirmação secundária

---

## Validação

Rodar **LABUSDT SHORT** e **APTUSDT SHORT**. Verificar:

- [ ] Card, descrição e narrativa mostram o **mesmo stop**
- [ ] Risco Máximo bate com o stop do card
- [ ] **Uma única** invalidação na tela (sem terceiro valor inventado)
- [ ] RR abaixo de 1.5 → setup marcado `AGUARDAR`
- [ ] Stop inseguro vira aviso, nunca bloqueio
- [ ] TP1 ≠ TP2, ambos plausíveis
- [ ] 3 alvos sempre presentes na tela
- [ ] Números curtos na análise técnica (sem MACD comprido)
- [ ] Score de short forte agora é ALTO (não 30/100)
- [ ] L/S ratio ~1.0 é lido como neutro, não overlong
- [ ] Funding lido na escala decimal correta
- [ ] Squeeze só acende com 4 condições alinhadas

---

## Notas finais

- **Nenhuma correção apaga arquivo ou método.** Todas trocam fonte de leitura, recalculam campo ou adicionam código.
- `MotorExecucaoService` permanece intacto — ainda fornece entrada e direção.
- Motor paralelo do front (scoringEngine.ts, interpretationEngine.ts, adaptedDataFetcher.ts) fica como está — remoção só no fim, com os testes.
- Após todas as correções, a única fonte de verdade para o setup é `$result['execucao']` (reconciliado).
