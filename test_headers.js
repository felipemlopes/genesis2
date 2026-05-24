import fetch from 'node-fetch';
fetch('https://fapi.binance.com/fapi/v1/allForceOrders?symbol=BTCUSDT&limit=5')
.then(res => console.log('CORS:', res.headers.get('access-control-allow-origin')))
.catch(err => console.error('ERR:', err.message));
