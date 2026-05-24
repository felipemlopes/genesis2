class MotorDerivativos {
  constructor(fundingRate, openInterest, oiChange24h, lsRatio, 
              liquidationClusters = { above: [], below: [] }, 
              volume24h = 0, cvdSlope = 'FLAT') {
    this.funding = fundingRate;
    this.oi = openInterest;
    this.oiChange = oiChange24h;
    this.lsRatio = lsRatio;
    this.liqClusters = liquidationClusters;
    this.volume = volume24h;
    this.cvdSlope = cvdSlope;
  }

  calcularScore(priceChange24h = 0) {
    let score = 0.5;

    if (this.funding < -0.0005) {
      score += 0.15;
    } else if (this.funding > 0.001) {
      score -= 0.10;
    }

    if (this.oiChange > 0.05 && priceChange24h > 0) {
      score += 0.10;
    } else if (this.oiChange > 0.05 && priceChange24h < 0) {
      score -= 0.10;
    }

    if (this.lsRatio < 0.8) {
      score += 0.10;
    } else if (this.lsRatio > 2.0) {
      score -= 0.10;
    }

    if (this.cvdSlope === 'UP') {
      score += 0.05;
    } else if (this.cvdSlope === 'DOWN') {
      score -= 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  getLiquidationMap(currentPrice) {
    const above = this.liqClusters.above.filter(p => p > currentPrice);
    const below = this.liqClusters.below.filter(p => p < currentPrice);
    return {
      proximoAbove: above.length ? Math.min(...above) : null,
      proximoBelow: below.length ? Math.max(...below) : null,
      distanciaAbove: above.length ? ((Math.min(...above) - currentPrice) / currentPrice) : null,
      distanciaBelow: below.length ? ((currentPrice - Math.max(...below)) / currentPrice) : null
    };
  }

  getResumo() {
    return {
      fundingRate: this.funding,
      fundingAnual: (this.funding * 3 * 365 * 100).toFixed(2) + '%',
      openInterest: this.oi,
      oiChange24h: (this.oiChange * 100).toFixed(2) + '%',
      lsRatio: this.lsRatio,
      cvdSlope: this.cvdSlope,
      sentimentoFunding: this.funding < -0.0005 ? 'EXTREMO_SHORT' :
                          this.funding > 0.001 ? 'EXTREMO_LONG' :
                          this.funding < 0 ? 'LEVE_SHORT' :
                          this.funding > 0 ? 'LEVE_LONG' : 'NEUTRO'
    };
  }
}

module.exports = { MotorDerivativos };
