import { calculateEMA } from './services/tradingViewIndicators.ts';
async function test() {
   const closes = Array.from({length: 300}, (_, i) => i + 1);
   console.log("200 on 300 points:", calculateEMA(closes, 200));
   console.log("400 on 300 points:", calculateEMA(closes, 400));
}
test();
