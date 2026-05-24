import fetch from 'node-fetch';
fetch('https://corsproxy.io/?' + encodeURIComponent('https://fapi.binance.com/fapi/v1/allForceOrders?symbol=BTCUSDT&limit=5'))
.then(res => res.json())
.then(data => console.log('DATA:', JSON.stringify(data).substring(0, 500)))
.catch(err => console.error('ERR:', err.message));
