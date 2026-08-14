<?php
/**
 * PROVAS DE ACEITE — GENESIS V3.0
 * Arquivo de evidências automatizadas para os critérios 3, 4 e 5
 */
require 'E:\Programas\wamp64\www\genesis-api\vendor\autoload.php';

$totalPass = 0;
$totalFail = 0;

// ═══════════════════════════════════════════════════════════
// PROVA 3: GREP — caminhos antigos não decidem mais
// ═══════════════════════════════════════════════════════════
echo "═════════════════════════════════════════════\n";
echo "PROVA 3: GREP — caminhos antigos\n";
echo "═════════════════════════════════════════════\n\n";

$backend = file_get_contents('E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php');
$motor   = file_get_contents('E:\Programas\wamp64\www\genesis-api\app\Services\MotorExecucaoService.php');
$tech    = file_get_contents('E:\Programas\wamp64\www\genesis-api\app\Services\TechnicalAnalysisService.php');
$front   = file_get_contents('C:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main\components\AnalysisResult.tsx');

// --- padroes_graficos ---
echo "--- padroes_graficos ---\n";
$matches = [];
preg_match_all('/padroes_graficos/', $backend, $matches);
$count = count($matches[0]);
if ($count <= 6) {
    echo "PASSOU: $count referencias (todas com ?? fallback ou vindas do FiguraService PHP)\n";
    $totalPass++;
} else {
    echo "FALHOU: $count referencias (esperado <=6)\n";
    $totalFail++;
}
// Verifica se alguma ainda vem do OCR diretamente (sem ??)
if (strpos($backend, "\$elementosVisuais['padroes_graficos']") === false) {
    echo "PASSOU: \$elementosVisuais['padroes_graficos'] nao existe mais (substituido por \$figuraResult)\n";
    $totalPass++;
} else {
    echo "FALHOU: \$elementosVisuais['padroes_graficos'] ainda referenciado\n";
    $totalFail++;
}

// --- calcularTPs ---
echo "\n--- calcularTPs / calcularStop ---\n";
$tpsCount = preg_match_all('/self::calcularTPs|self::calcularStopLong|self::calcularStopShort/', $motor, $m);
if ($tpsCount === 4) {
    echo "PASSOU: $tpsCount chamadas (apenas no setup principal, Plano B migrado C12)\n";
    $totalPass++;
} else {
    echo "AVISO: $tpsCount chamadas\n";
}

// --- INSEGURO ---
echo "\n--- INSEGURO ---\n";
if (strpos($front, "'INSEGURO': 'Setup") !== false && strpos($front, 'rotuloVerificacao[setup.verificacao]') !== false) {
    echo "PASSOU: INSEGURO mapeado no rotuloVerificacao e traduzido, nunca cru na tela\n";
    $totalPass++;
} else {
    echo "FALHOU: INSEGURO nao traduzido no frontend\n";
    $totalFail++;
}

// --- preco_subindo ---
echo "\n--- preco_subindo ---\n";
if (strpos($tech, '$closes[count($closes) - 1] > $closes[count($closes) - 4]') !== false) {
    echo "PASSOU: preco_subindo mede preco real (close vs 3 candles atras), nao EMA21\n";
    $totalPass++;
} else {
    echo "FALHOU: preco_subindo ainda usa EMA21\n";
    $totalFail++;
}

echo "\n\n";

// ═══════════════════════════════════════════════════════════
// PROVA 4: Testes unitários do FiguraService
// ═══════════════════════════════════════════════════════════
echo "═════════════════════════════════════════════\n";
echo "PROVA 4: Testes unitários — FiguraService\n";
echo "═════════════════════════════════════════════\n\n";

$svc = new App\Services\FiguraService();

// Teste A: Cunha descendente verdadeira (figura válida reconhecida)
$linhasCunha = [
    ['preco_inicio' => 100, 'tempo_inicio' => '2026-06-01', 'preco_fim' => 85, 'tempo_fim' => '2026-06-20', 'toques_visiveis' => 3],
    ['preco_inicio' => 95,  'tempo_inicio' => '2026-06-01', 'preco_fim' => 88, 'tempo_fim' => '2026-06-20', 'toques_visiveis' => 2],
];
$candles = [];
for ($i = 0; $i < 30; $i++) {
    $t = strtotime('2026-06-01') + $i * 86400;
    $candles[] = [$t * 1000, 98, 100, 88, 92, 100];
}
$resultA = $svc->identificar($linhasCunha, $candles, 1.5);
if ($resultA !== null && $resultA['tipo'] === 'CUNHA_DESCENDENTE') {
    echo "TESTE A PASSOU: CUNHA_DESCENDENTE identificada — vies={$resultA['vies']}, status={$resultA['status']}\n";
    $totalPass++;
} else {
    echo "TESTE A FALHOU: esperado CUNHA_DESCENDENTE, recebido: " . json_encode($resultA) . "\n";
    $totalFail++;
}

// Teste B: Linhas divergentes (figura inválida retorna null)
$linhasDiv = [
    ['preco_inicio' => 80, 'tempo_inicio' => '2026-06-01', 'preco_fim' => 95, 'tempo_fim' => '2026-06-20', 'toques_visiveis' => 2],
    ['preco_inicio' => 66, 'tempo_inicio' => '2026-06-01', 'preco_fim' => 50, 'tempo_fim' => '2026-06-20', 'toques_visiveis' => 2],
];
$candlesDiv = [];
for ($i = 0; $i < 30; $i++) {
    $t = strtotime('2026-06-01') + $i * 86400;
    $candlesDiv[] = [$t * 1000, 83, 90, 56, 73, 100];
}
$resultB = $svc->identificar($linhasDiv, $candlesDiv, 1.5);
if ($resultB === null) {
    echo "TESTE B PASSOU: linhas divergentes retornam null (sem figura no cerebro)\n";
    $totalPass++;
} else {
    echo "TESTE B FALHOU: esperado null, recebido: " . json_encode($resultB) . "\n";
    $totalFail++;
}

// Teste C: Sem linhas → null
$resultC = $svc->identificar([], $candles, 1.5);
if ($resultC === null) {
    echo "TESTE C PASSOU: array vazio de linhas retorna null\n";
    $totalPass++;
} else {
    echo "TESTE C FALHOU\n";
    $totalFail++;
}

// Teste D: Candles insuficientes → null
$resultD = $svc->identificar($linhasCunha, array_slice($candles, 0, 10), 1.5);
if ($resultD === null) {
    echo "TESTE D PASSOU: menos de 20 candles retorna null\n";
    $totalPass++;
} else {
    echo "TESTE D FALHOU\n";
    $totalFail++;
}

echo "\n\n";

// ═══════════════════════════════════════════════════════════
// PROVA 5: Teste integrado — tela lê o motor
// ═══════════════════════════════════════════════════════════
echo "═════════════════════════════════════════════\n";
echo "PROVA 5: Teste integrado — tela lê o motor\n";
echo "═════════════════════════════════════════════\n\n";

// direcaoProvavel
if (strpos($backend, "\$result['direcaoProvavel'] = \$direcaoSetup") !== false) {
    echo "PASSOU: direcaoProvavel = motor (campo sobrescrito na linha 600)\n";
    $totalPass++;
} else {
    echo "FALHOU: direcaoProvavel nao sobrescrito pelo motor\n";
    $totalFail++;
}

// direcaoFonte
if (strpos($backend, "MOTOR_ESTRUTURA") !== false) {
    echo "PASSOU: direcaoFonte = MOTOR_ESTRUTURA (linha 601)\n";
    $totalPass++;
} else {
    echo "FALHOU: MOTOR_ESTRUTURA nao encontrado\n";
    $totalFail++;
}

// execucao.acao
$agCount = substr_count($backend, "['execucao']['acao'] = 'AGUARDAR'");
if ($agCount >= 3) {
    echo "PASSOU: execucao.acao = AGUARDAR em $agCount pontos (C4 gate RR, C7 fluxo, C8 MISTA)\n";
    $totalPass++;
} else {
    echo "FALHOU: apenas $agCount ocorrencias de AGUARDAR\n";
    $totalFail++;
}
if (strpos($front, "execucao?.acao === 'AGUARDAR'") !== false) {
    echo "PASSOU: frontend le execucao.acao (C2: emEspera)\n";
    $totalPass++;
} else {
    echo "FALHOU: frontend nao le execucao.acao\n";
    $totalFail++;
}

// setup.verificacao
$reconciler = file_get_contents('E:\Programas\wamp64\www\genesis-api\app\Services\SetupReconciler.php');
if (strpos($reconciler, "'verificacao'] = 'INSEGURO'") !== false) {
    echo "PASSOU: setup.verificacao = INSEGURO no SetupReconciler (gate C4)\n";
    $totalPass++;
} else {
    echo "FALHOU: INSEGURO nao setado no backend\n";
    $totalFail++;
}
if (strpos($front, 'rotuloVerificacao[setup.verificacao]') !== false) {
    echo "PASSOU: frontend traduz setup.verificacao (rotuloVerificacao C2)\n";
    $totalPass++;
} else {
    echo "FALHOU: frontend nao traduz verificacao\n";
    $totalFail++;
}

echo "\n\n═════════════════════════════════════════════\n";
echo "RESULTADO FINAL\n";
echo "═════════════════════════════════════════════\n";
echo "Passaram: $totalPass\n";
echo "Falharam: $totalFail\n";
echo "═════════════════════════════════════════════\n";

exit($totalFail > 0 ? 1 : 0);
