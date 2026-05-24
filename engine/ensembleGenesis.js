class EnsembleGenesis {
  static THRESHOLD_LONG = 65;
  static THRESHOLD_SHORT = 35;
  static THRESHOLD_CONFIANCA = 60;

  constructor(motorTecnico, motorDerivativos, macroScore = 0.5) {
    this.tec = motorTecnico;
    this.deriv = motorDerivativos;
    this.macro = Math.max(0, Math.min(1, macroScore));
    this.regime = this.tec.detectarRegime();
  }

  _getPesos() {
    if (this.regime.includes('STRONG')) {
      return { tecnico: 0.55, derivativos: 0.30, macro: 0.15 };
    }
    if (this.regime.includes('WEAK')) {
      return { tecnico: 0.40, derivativos: 0.40, macro: 0.20 };
    }
    return { tecnico: 0.30, derivativos: 0.45, macro: 0.25 };
  }

  _scoreTecnico() {
    const last = this.tec.getUltimo();
    let score = 0.5;

    if (this.regime.includes('UP')) score += 0.15;
    else if (this.regime.includes('DOWN')) score -= 0.15;

    if (last.close > last.ema21 && last.ema21 > last.ema50) score += 0.10;
    else if (last.close < last.ema21 && last.ema21 < last.ema50) score -= 0.10;

    if (last.rsi > 55 && last.macdHist > 0) score += 0.10;
    else if (last.rsi < 45 && last.macdHist < 0) score -= 0.10;

    if (last.delta > 0) score += 0.05;
    else score -= 0.05;

    const recent = this.tec.getTodos().slice(-10);
    const hh = recent[recent.length - 1].high > Math.max(...recent.slice(0, -1).map(c => c.high));
    const hl = recent[recent.length - 1].low > Math.min(...recent.slice(0, -1).map(c => c.low));
    if (hh && hl) score += 0.10;

    return Math.max(0, Math.min(1, score));
  }

  calcular(priceChange24h = 0) {
    const scoreTec = this._scoreTecnico();
    const scoreDeriv = this.deriv.calcularScore(priceChange24h);
    const pesos = this._getPesos();

    const scoreFinal = scoreTec * pesos.tecnico + 
                       scoreDeriv * pesos.derivativos + 
                       this.macro * pesos.macro;

    const diff = Math.abs(scoreTec - scoreDeriv);
    let direcao = 'LONG'; // PADRÃO: sempre LONG se em dúvida

    // REGRA: NUNCA neutro. Sempre LONG ou SHORT.
    if (scoreFinal > 0.50) {
      direcao = 'LONG';
    } else {
      direcao = 'SHORT';
    }

    // Se divergência forte, reduz score mas mantém direção
    const confianca = Math.max(0, (1 - diff * 2)) * 100;
    let scoreAjustado = Math.round(scoreFinal * 100);
    
    // Se confiança baixa, score cai mas direção permanece
    if (confianca < 50) {
      scoreAjustado = Math.max(35, Math.min(65, scoreAjustado));
    }

    return {
      score: scoreAjustado,
      direcao,
      confianca: Math.round(confianca),
      regime: this.regime,
      componentes: {
        tecnico: Math.round(scoreTec * 100),
        derivativos: Math.round(scoreDeriv * 100),
        macro: Math.round(this.macro * 100)
      },
      pesos,
      divergencia: diff > 0.3,
      alerta: confianca < 50 ? 'ALTA DIVERGÊNCIA — OPERAR COM CAUTELA' : null
    };
  }
}

module.exports = { EnsembleGenesis };

