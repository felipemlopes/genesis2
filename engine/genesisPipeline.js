const { BinanceAdapter } = require('../adapters/binance');
const { BybitAdapter } = require('../adapters/bybit');
const { MotorTecnico } = require('./motorTecnico');
const { MotorDerivativos } = require('./motorDerivativos');
const { EnsembleGenesis } = require('./ensembleGenesis');
const { MotorExecucao } = require('./motorExecucao');

class GenesisPipeline {
  constructor(exchange = 'binance') {
    this.exchange = exchange;
    this.adapters = {
      binance: new BinanceAdapter(),
      bybit: new BybitAdapter()
    };
  }

  async analisar(symbol, interval = '1d', elementosVisuais = null, macroScore = 0.5) {
    const adapter = this.adapters[this.exchange] || this.adapters.binance;

    const candles = await adapter.getKlines(symbol, interval);
    const motorTec = new MotorTecnico(candles);

    const funding = await adapter.getFundingRate?.(symbol).catch(() => 0);
    const oi = await adapter.getOpenInterest?.(symbol).catch(() => 0);
    const ticker = await adapter.getTicker24h?.(symbol).catch(() => ({ 
      lastPrice: candles[candles.length - 1].close, 
      priceChangePercent: 0 
    }));

    const derivData = {
      fundingRate: funding,
      openInterest: oi,
      oiChange24h: 0,
      lsRatio: 1.0,
      liquidationClusters: { above: [], below: [] },
      volume24h: ticker.volume || candles[candles.length - 1].volume,
      cvdSlope: 'FLAT'
    };

    const motorDeriv = new MotorDerivativos(
      derivData.fundingRate,
      derivData.openInterest,
      derivData.oiChange24h,
      derivData.lsRatio,
      derivData.liquidationClusters,
      derivData.volume24h,
      derivData.cvdSlope
    );

    const ensemble = new EnsembleGenesis(motorTec, motorDeriv, macroScore);
    const priceChange = ticker.priceChangePercent || 0;
    const resultadoEnsemble = ensemble.calcular(priceChange / 100);

    const vp = motorTec.getVolumeProfile();

    const last = motorTec.getUltimo();
    const execucao = MotorExecucao.gerarSetup(
      last.close,
      resultadoEnsemble.direcao,
      resultadoEnsemble.score,
      resultadoEnsemble.confianca,
      last.atr14,
      resultadoEnsemble.regime,
      vp.hvn,
      vp.lvn,
      derivData.liquidationClusters,
      vp.poc,
      elementosVisuais
    );

    return {
      ensemble: resultadoEnsemble,
      execucao,
      indicadores: {
        preco: last.close,
        rsi: last.rsi,
        adx: last.adx,
        plusDI: last.plusDI,
        minusDI: last.minusDI,
        macdHist: last.macdHist,
        ema21: last.ema21,
        ema50: last.ema50,
        ema200: last.ema200,
        atr: last.atr14,
        cvd: last.cvd
      },
      volumeProfile: vp,
      derivativos: derivData,
      contextoVisual: elementosVisuais
    };
  }
}

module.exports = { GenesisPipeline };
