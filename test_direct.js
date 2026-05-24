const fetch = require('node-fetch');
fetch('https://fapi.binance.com/fapi/v1/allForceOrders?symbol=BTCUSDT&limit=5')
.then(res => res.json())
.then(data => console.log('DATA:', data ? 'OK' : 'FAIL', typeof data, data.length))
.catch(err => console.error('ERR:', err.message));
