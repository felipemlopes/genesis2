class MotorTecnico {
    constructor(candles) {
        this.candles = candles || [];
    }
    getVolumeProfile() {
        return { hvn: [], lvn: [], poc: 40000 };
    }
    detectarRegime() {
        return "ALTA_VOLATILIDADE";
    }
    getTodos() {
        return [this.getUltimo()];
    }
    getUltimo() {
        return {
            close: 40000,
            rsi: 50,
            adx: 20,
            plusDI: 20,
            minusDI: 20,
            macdHist: 0,
            ema21: 40000,
            ema50: 40000,
            ema200: 40000,
            atr14: 100,
            cvd: 0
        };
    }
}
module.exports = { MotorTecnico };
