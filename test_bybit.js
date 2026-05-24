import fetch from 'node-fetch';
async function test() {
    const res = await fetch("https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=15&limit=1000");
    const json = await res.json();
    console.log(json.retCode === 0 ? json.result.list.length : json);
}
test();
