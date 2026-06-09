<?php
/**
 * CORRECOES DO MotorExecucaoService.php
 * Tres correcoes cirurgicas. Indicado onde adicionar em cada metodo.
 */

// ============================================================
// CORRECAO 1 — calcularStopLong(): adicionar ao FINAL do metodo,
// antes do return final (linha ~210)
// Problema: PDL acima do preco era usado como stop sem validar
// ============================================================
// Adicionar ANTES do ultimo return do metodo calcularStopLong():

if ($stop >= $preco) {
    // Stop geometricamente invalido — forcando ATR como fallback seguro
    $stop      = $preco - ($atr * $atrMult);
    $hierarquia = 'ATR_FORCADO';
}

// ============================================================
// CORRECAO 2 — calcularStopShort(): adicionar ao FINAL do metodo,
// antes do return final (linha ~270)
// Problema: stop podia ficar abaixo da entrada em SHORT
// ============================================================
// Adicionar ANTES do ultimo return do metodo calcularStopShort():

if ($stop <= $preco) {
    // Stop geometricamente invalido — forcando ATR como fallback seguro
    $stop      = $preco + ($atr * $atrMult);
    $hierarquia = 'ATR_FORCADO';
}

// ============================================================
// CORRECAO 3 — calcularTPs(): adicionar ao FINAL do metodo,
// antes do return (linha ~316)
// Problema: TPs podiam ficar abaixo da entrada em LONG (ou acima em SHORT)
// ============================================================
// Adicionar ANTES do return de calcularTPs():

if ($direcao === 'LONG') {
    if ($tp1 <= $entrada) $tp1 = $entrada * 1.06;
    if ($tp2 <= $tp1)     $tp2 = $tp1 * 1.04;
    if ($tp3 <= $tp2)     $tp3 = $tp2 * 1.08;
} else {
    // SHORT
    if ($tp1 >= $entrada) $tp1 = $entrada * 0.94;
    if ($tp2 >= $tp1)     $tp2 = $tp1 * 0.96;
    if ($tp3 >= $tp2)     $tp3 = $tp2 * 0.92;
}
