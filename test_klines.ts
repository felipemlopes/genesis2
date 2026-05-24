import { generateAdvancedContext } from './services/advancedAnalytics.ts';

const run = async () => {
   const data = await generateAdvancedContext('BTCUSDT', 'Binance', '15m', ['21', '50', '200']);
   console.log(data);
};

run();
