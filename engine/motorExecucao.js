class MotorExecucao {
  static RISCO_MAX_CONTA = 0.02;
  static ALAV_MAX = 10.0;
  static MARGEM_SEG_LIQ = 0.05;

  static calcularLiquidacao(entrada, direcao, alavancagem, mm = 0.005) {
    if (alavancagem <= 1) {
      return direcao === 'LONG' ? 0 : Infinity;
    }
    if (direcao === 'LONG') {
      return entrada * (1 - 1/alavancagem + mm);
    }
    return entrada * (1 + 1/alavancagem - mm);
  }

  static gerarSetup(preco, direcaoEnsemble, score, confianca, atr,
                    regime, hvn, lvn, liqClusters, poc, elementosVisuais = null) {
    
    // SEMPRE gera setup. Nunca bloqueia.
    // Se score/confiança baixos, reduz alavancagem e aumenta stop.
    
    let alavancagemMax = MotorExecucao.ALAV_MAX;
    let atrMultiplicador = 2.5;
    
    // Ajuste de risco baseado no score
    if (score < 50) {
      alavancagemMax = 2.0;
      atrMultiplicador = 3.5;
    } else if (score < 65) {
      alavancagemMax = 3.0;
      atrMultiplicador = 3.0;
    } else if (score < 75) {
      alavancagemMax = 5.0;
      atrMultiplicador = 2.5;
    }
    
    // Ajuste baseado na confiança
    if (confianca < 50) {
      alavancagemMax = Math.min(alavancagemMax, 2.0);
    }

    const setup = direcaoEnsemble === 'LONG' 
      ? this._setupLong(preco, atr, hvn, liqClusters, poc, visuais, atrMultiplicador, alavancagemMax)
      : this._setupShort(preco, atr, lvn, liqClusters, poc, hvn, visuais, atrMultiplicador, alavancagemMax);

    return {
      acao: direcaoEnsemble,
      motivo: score < 65 ? `Score ${score}/100 — Operar com cautela. Alavancagem reduzida.` : `Setup confirmado. Score ${score}/100.`,
      setup,
      zonaInteresse: this._zonaInteresse(regime, preco, atr, poc, hvn)
    };
  }

  static _setupLong(preco, atr, hvnLevels, liqClusters, poc, visuais, atrMult, alavMax) {
    let stop = preco - (atrMult * atr);
    stop = Math.max(stop, poc * 0.97);

    if (visuais?.suportes?.length) {
      const suportesValidos = visuais.suportes.filter(s => s < preco);
      if (suportesValidos.length) {
        stop = Math.max(stop, Math.max(...suportesValidos) * 0.995);
      }
    }

    const targetsAbove = hvnLevels.filter(h => h > preco);
    let tp1 = targetsAbove.length ? Math.min(...targetsAbove) : preco * 1.06;
    const liqAbove = (liqClusters.above || []).filter(l => l > preco);
    let tp2 = liqAbove.length ? Math.min(...liqAbove) : preco * 1.10;
    let tp3 = tp2 * 1.08;

    // GUARDA PÓS-LOOP: nunca do lado errado após qualquer reajuste
    if (tp1 <= preco || tp2 <= preco) {
      console.warn('MOTOR-SANITY-POS-LOOP: TP LONG abaixo da entrada', { tp1, tp2, entrada: preco });
      tp1 = preco * 1.06;
      tp2 = preco * 1.10;
      tp3 = preco * 1.18;
    }

    const risco = (preco - stop) / preco;
    let alav = Math.min(MotorExecucao.RISCO_MAX_CONTA / risco, alavMax);
    alav = Math.max(alav, 1.0);

    let liq = this.calcularLiquidacao(preco, 'LONG', alav);
    let tentativas = 0;
    while (liq > 0 && stop <= liq * (1 + MotorExecucao.MARGEM_SEG_LIQ) && alav > 1.0 && tentativas < 20) {
      alav -= 0.5;
      liq = this.calcularLiquidacao(preco, 'LONG', alav);
      tentativas++;
    }

    alav = Math.max(alav, 1.0);
    liq = this.calcularLiquidacao(preco, 'LONG', alav);

    return {
      entrada: parseFloat(preco.toFixed(4)),
      stop: parseFloat(stop.toFixed(4)),
      tp1: parseFloat(tp1.toFixed(4)),
      tp2: parseFloat(tp2.toFixed(4)),
      tp3: parseFloat(tp3.toFixed(4)),
      alavancagem: parseFloat(alav.toFixed(1)),
      liquidacao: liq > 0 ? parseFloat(liq.toFixed(4)) : 'N/A (1x)',
      riscoPct: parseFloat((risco * 100).toFixed(2)),
      rr1: preco !== stop ? parseFloat(((tp1 - preco) / (preco - stop)).toFixed(2)) : 0,
      verificacao: stop < (liq > 0 ? liq * (1 + MotorExecucao.MARGEM_SEG_LIQ) : Infinity) ? '✓ SEGURO' : '✗ INSEGURO'
    };
  }

  static _setupShort(preco, atr, lvnLevels, liqClusters, poc, hvnLevels, visuais, atrMult, alavMax) {
    let stop = preco + (atrMult * atr);
    const resistencias = (hvnLevels || []).filter(h => h > preco);
    stop = Math.min(stop, resistencias.length ? Math.max(...resistencias) : preco * 1.10);

    if (visuais?.resistencias?.length) {
      const resValidas = visuais.resistencias.filter(r => r > preco);
      if (resValidas.length) {
        stop = Math.min(stop, Math.min(...resValidas) * 1.005);
      }
    }

    const targetsBelow = (lvnLevels || []).filter(l => l < preco);
    let tp1 = targetsBelow.length ? Math.max(...targetsBelow) : preco * 0.94;
    const liqBelow = (liqClusters.below || []).filter(l => l < preco);
    let tp2 = liqBelow.length ? Math.max(...liqBelow) : preco * 0.90;
    let tp3 = tp2 * 0.92;

    // GUARDA PÓS-LOOP: nunca do lado errado após qualquer reajuste
    if (tp1 >= preco || tp2 >= preco) {
      console.warn('MOTOR-SANITY-POS-LOOP: TP SHORT acima da entrada', { tp1, tp2, entrada: preco });
      tp1 = preco * 0.94;
      tp2 = preco * 0.88;
      tp3 = preco * 0.82;
    }

    const risco = (stop - preco) / preco;
    let alav = Math.min(MotorExecucao.RISCO_MAX_CONTA / risco, alavMax);
    alav = Math.max(alav, 1.0);

    let liq = this.calcularLiquidacao(preco, 'SHORT', alav);
    let tentativas = 0;
    while (liq < Infinity && stop >= liq * (1 - MotorExecucao.MARGEM_SEG_LIQ) && alav > 1.0 && tentativas < 20) {
      alav -= 0.5;
      liq = this.calcularLiquidacao(preco, 'SHORT', alav);
      tentativas++;
    }

    alav = Math.max(alav, 1.0);
    liq = this.calcularLiquidacao(preco, 'SHORT', alav);

    return {
      entrada: parseFloat(preco.toFixed(4)),
      stop: parseFloat(stop.toFixed(4)),
      tp1: parseFloat(tp1.toFixed(4)),
      tp2: parseFloat(tp2.toFixed(4)),
      tp3: parseFloat(tp3.toFixed(4)),
      alavancagem: parseFloat(alav.toFixed(1)),
      liquidacao: liq < Infinity ? parseFloat(liq.toFixed(4)) : 'N/A (1x)',
      riscoPct: parseFloat((risco * 100).toFixed(2)),
      rr1: stop !== preco ? parseFloat(((preco - tp1) / (stop - preco)).toFixed(2)) : 0,
      verificacao: stop > (liq < Infinity ? liq * (1 - MotorExecucao.MARGEM_SEG_LIQ) : 0) ? '✓ SEGURO' : '✗ INSEGURO'
    };
  }

  static _zonaInteresse(regime, preco, atr, poc, hvn) {
    if (regime.includes('BULLISH') || regime.includes('UP')) {
      return {
        tipo: 'PULLBACK',
        zona: `${Math.max(poc, preco - 1.5 * atr).toFixed(4)} - ${(preco - 0.5 * atr).toFixed(4)}`,
        invalidacao: `Abaixo de ${(poc * 0.95).toFixed(4)}`
      };
    }
    if (regime.includes('BEARISH') || regime.includes('DOWN')) {
      const maxHvn = hvn.length ? Math.max(...hvn) : preco * 1.10;
      return {
        tipo: 'REPICO',
        zona: `${(preco + 0.5 * atr).toFixed(4)} - ${Math.min(maxHvn, preco + 1.5 * atr).toFixed(4)}`,
        invalidacao: `Acima de ${(maxHvn * 1.05).toFixed(4)}`
      };
    }
    return {
      tipo: 'RANGE',
      zona: `Aguardar rompimento de ${poc.toFixed(4)}`,
      invalidacao: null
    };
  }
}

module.exports = { MotorExecucao };
