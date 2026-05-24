import fetch from 'node-fetch';
async function test() {
    const res = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=1500");
    const json = await res.json();
    console.log(Array.isArray(json) ? json.length : json);
}
test();
