<?php
/**
 * CORRECOES DO TechnicalAnalysisService.php
 * Substituir os metodos abaixo pelos correspondentes no arquivo original.
 * Cada metodo indica exatamente onde substituir.
 */

// ============================================================
// CORRECAO 1 — Linha 127: substituir metodo ema() integralmente
// Problema: threshold $period + 10 rejeita altcoins com historico menor
// ============================================================
public function ema(array $closes, int $period): ?float
{
    // Threshold corrigido: period + 1 (minimo matematico real)
    if (count($closes) < $period + 1) return null;
    $k   = 2.0 / ($period + 1);
    $ema = array_sum(array_slice($closes, 0, $period)) / $period;
    for ($i = $period; $i < count($closes); $i++) {
        $ema = ($closes[$i] - $ema) * $k + $ema;
    }
    return is_finite($ema) && $ema > 0 ? $ema : null;
}

// ============================================================
// CORRECAO 2 — Linha 229: substituir metodo macd() integralmente
// Problema: signal = macdLine * 0.9 — nao e EMA9 real da serie MACD
// ============================================================
private function macd(array $closes): ?array
{
    if (count($closes) < 35) return null;

    $k12 = 2.0 / 13;
    $k26 = 2.0 / 27;
    $k9  = 2.0 / 10;

    $ema12 = array_sum(array_slice($closes, 0, 12)) / 12;
    $ema26 = array_sum(array_slice($closes, 0, 26)) / 26;

    // Inicializar EMA12 ate o candle 26
    for ($i = 12; $i < 26; $i++) {
        $ema12 = ($closes[$i] - $ema12) * $k12 + $ema12;
    }

    // Gerar serie MACD
    $series = [];
    for ($i = 26; $i < count($closes); $i++) {
        $ema12    = ($closes[$i] - $ema12) * $k12 + $ema12;
        $ema26    = ($closes[$i] - $ema26) * $k26 + $ema26;
        $series[] = $ema12 - $ema26;
    }

    if (count($series) < 9) return null;

    // EMA9 real da serie MACD = signal line
    $signal = array_sum(array_slice($series, 0, 9)) / 9;
    for ($i = 9; $i < count($series); $i++) {
        $signal = ($series[$i] - $signal) * $k9 + $signal;
    }

    $current = end($series);
    return [
        'macd'      => round($current, 8),
        'signal'    => round($signal,  8),
        'histogram' => round($current - $signal, 8),
    ];
}

// ============================================================
// CORRECAO 3 — Linha 114: substituir linha preco_subindo no return de calcular()
// Problema: compara apenas dois candles consecutivos
// ============================================================
// Substituir APENAS esta linha no array de retorno do metodo calcular():
// ERA:
//   "preco_subindo" => count($closes) >= 2 ? $closes[count($closes)-1] > $closes[count($closes)-2] : false,
// CORRIGIR PARA:
//   "preco_subindo" => ($ema21 !== null && $prevEma21 !== null)
//       ? $ema21 > $prevEma21
//       : (count($closes) >= 2 ? $closes[count($closes)-1] > $closes[count($closes)-2] : false),

// ============================================================
// CORRECAO 4 — Labels OCR: linhas 29, 35, 41
// Problema: exibe 'GRAFICO' quando dado vem do OCR. Deve exibir 'OCR'.
// ============================================================
// Substituir nas tres ocorrencias dentro de calcular():
// ERA:   $ema21_fonte  = 'GRAFICO';
// PARA:  $ema21_fonte  = 'OCR';
// ERA:   $ema50_fonte  = 'GRAFICO';
// PARA:  $ema50_fonte  = 'OCR';
// ERA:   $ema200_fonte = 'GRAFICO';
// PARA:  $ema200_fonte = 'OCR';

// ============================================================
// CORRECAO 5 — Linha 348: substituir metodo detectarDivergenciaRSI()
// Problema: thresholds 60/40 geram falsos positivos
// ============================================================
private function detectarDivergenciaRSI(array $closes, ?float $rsiAtual): string
{
    if ($rsiAtual === null || count($closes) < 30) return 'NENHUMA';

    $recent = array_slice($closes, -14);
    $prev   = array_slice($closes, -28, 14);
    if (count($prev) < 14) return 'NENHUMA';

    // BEARISH: preco faz nova maxima mas RSI nao confirma (RSI < 70 = nao sobrecomprado)
    if (max($recent) > max($prev) && $rsiAtual < 70) return 'BEARISH';

    // BULLISH: preco faz nova minima mas RSI nao confirma (RSI > 30 = nao sobrevendido)
    if (min($recent) < min($prev) && $rsiAtual > 30) return 'BULLISH';

    return 'NENHUMA';
}

// ============================================================
// ADICIONAR — Metodo analisarVolume() — adicionar apos detectarDivergenciaRSI()
// ============================================================
public function analisarVolume(array $candles): array
{
    if (count($candles) < 20) {
        return ['tendencia' => 'INDISPONIVEL', 'divergencia' => 'NENHUMA', 'ratio_atual' => 0, 'vol5' => 0, 'vol20' => 0];
    }

    $vols   = array_map(fn($c) => (float) $c[5], $candles);
    $closes = array_map(fn($c) => (float) $c[4], $candles);

    $vol5     = array_sum(array_slice($vols, -5))  / 5;
    $vol10    = array_sum(array_slice($vols, -10)) / 10;
    $vol20    = array_sum(array_slice($vols, -20)) / 20;
    $volAtual = end($vols);

    $tendencia = $vol5 > $vol10 ? 'CRESCENTE' : ($vol5 < $vol10 * 0.8 ? 'DECRESCENTE' : 'ESTAVEL');
    $ratio     = $vol20 > 0 ? round($volAtual / $vol20, 2) : 0;

    $preco5ini  = $closes[count($closes) - 5];
    $precoAtual = end($closes);
    $precoSubiu = $precoAtual > $preco5ini;

    $divergencia = 'NENHUMA';
    if ($precoSubiu && $tendencia === 'DECRESCENTE')  $divergencia = 'PRECO_SOBE_VOLUME_CAI';
    if (!$precoSubiu && $tendencia === 'DECRESCENTE') $divergencia = 'PRECO_CAI_VOLUME_CAI';
    if ($precoSubiu && $tendencia === 'CRESCENTE')    $divergencia = 'CONFIRMACAO_ALTA';
    if (!$precoSubiu && $tendencia === 'CRESCENTE')   $divergencia = 'CONFIRMACAO_BAIXA';

    return [
        'tendencia'   => $tendencia,
        'divergencia' => $divergencia,
        'ratio_atual' => $ratio,
        'vol5'        => round($vol5,  2),
        'vol20'       => round($vol20, 2),
    ];
}

// ============================================================
// ADICIONAR ao metodo calcular() — apos linha 86 (apos detectarCompressao)
// Adicionar dentro do try/catch existente:
// ============================================================
// try {
//     $volumeAnalise = $this->analisarVolume($candles);
// } catch (\Throwable $e) {
//     $volumeAnalise = ['tendencia'=>'INDISPONIVEL','divergencia'=>'NENHUMA','ratio_atual'=>0,'vol5'=>0,'vol20'=>0];
// }
//
// E adicionar ao array de retorno do calcular():
// "volume" => $volumeAnalise,
