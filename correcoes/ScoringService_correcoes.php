<?php
/**
 * CORRECOES DO ScoringService.php
 * Substituir o bloco RSI (linhas 46-57) pelo codigo abaixo.
 * O restante do arquivo permanece identico.
 */

// ============================================================
// CORRECAO 1 — Linhas 46-57: substituir bloco RSI integralmente
// Problema: RSI em sobrevenda extrema recebia apenas 3pts bullish
// (mesmo valor que sobrecompra moderada). Escala invertida.
// ============================================================

// ERA (REMOVER):
// if (isset($d['rsi']) && $d['rsi'] !== null) {
//     $rsi = (float) $d['rsi'];
//     if (50 <= $rsi && $rsi <= 65) { $tcBullish += 7; }
//     elseif (35 <= $rsi && $rsi < 50) { $tcBearish += 7; }
//     elseif ($rsi > 70) { $tcBearish += 3; }
//     elseif ($rsi < 30) { $tcBullish += 3; }
// }

// SUBSTITUIR POR:
if (isset($d['rsi']) && $d['rsi'] !== null) {
    $rsi = (float) $d['rsi'];
    if ($rsi < 20) {
        $tcBullish += 10;
        $flags[] = 'RSI_SOBREVENDA_EXTREMA';
    } elseif ($rsi < 30) {
        $tcBullish += 8;
        $flags[] = 'RSI_SOBREVENDA';
    } elseif ($rsi < 45) {
        $tcBullish += 4;
    } elseif ($rsi <= 55) {
        $tcBullish += 1;
        $tcBearish += 1;
    } elseif ($rsi <= 70) {
        $tcBullish += 5;
    } elseif ($rsi <= 80) {
        $tcBearish += 7;
        $flags[] = 'RSI_SOBRECOMPRA';
    } else {
        $tcBearish += 10;
        $flags[] = 'RSI_SOBRECOMPRA_EXTREMA';
    }
}
