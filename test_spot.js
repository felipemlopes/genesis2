import fetch from 'node-fetch';
fetch('https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=5')
.then(res => res.json())
.then(data => console.log('DATA:', typeof data))
.catch(err => console.error('ERR:', err.message));
