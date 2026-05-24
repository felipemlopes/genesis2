class BybitAdapter {
    async getKlines() {
        return [{ close: 40000, volume: 100 }];
    }
}
module.exports = { BybitAdapter };
