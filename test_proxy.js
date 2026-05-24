import fetch from 'node-fetch';
async function test() {
    const urls = [
        "https://api.allorigins.win/get?url=" + encodeURIComponent("https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=15&limit=1000"),
        "https://corsproxy.io/?" + encodeURIComponent("https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=15&limit=1000"),
        "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent("https://api.bybit.com/v5/market/kline?category=linear&symbol=BTCUSDT&interval=15&limit=1000")
    ];

    for (const url of urls) {
        try {
            console.log("Fetching:", url);
            const res = await fetch(url);
            const text = await res.text();
            console.log(text.slice(0, 100));
        } catch (e) {
            console.error(e.message);
        }
    }
}
test();
