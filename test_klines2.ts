import { generateAdvancedContext } from './services/advancedAnalytics.ts';
async function run() {
   const data = await generateAdvancedContext('BTCUSDT', 'Binance', '1h', ['50', '200']);
   console.log('Result:', JSON.stringify(data.indicators, null, 2));
}
run();
