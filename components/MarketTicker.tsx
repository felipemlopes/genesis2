
import React, { useEffect, useState, memo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { formatPrice, fetchWithProxy } from '../services/cryptoApi';

interface TickerData {
  s: string; // symbol
  c: string; // close price
  o: string; // open price (Required for calculation)
}

interface TradTickerData {
  s: string;
  c: number;
  p: number;
  isCurrency?: boolean;
}

interface DominanceData {
  btc: number;
  usdt: number;
  btcChange: number;
  usdtChange: number;
}

const MAJORS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'PAXGUSDT'];
const TRAD_MAJORS = ['USD/BRL', 'Nasdaq', 'S&P 500', 'B3', 'Prata', 'Petróleo'];

// Cache para a API do CoinGecko
let cachedDominanceData: DominanceData | null = null;
let lastDominanceFetchTime = 0;

const MarketTicker: React.FC = () => {
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [tradTickers, setTradTickers] = useState<TradTickerData[]>([]);
  const [dominance, setDominance] = useState<DominanceData | null>(null);

  useEffect(() => {
    // Public Binance Stream (!miniTicker is lighter than !ticker)
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const filtered = data.filter((t: any) => MAJORS.includes(t.s));

        if (filtered.length > 0) {
            setTickers(prev => {
              // Merge new data with existing data to prevent items from disappearing
              const map = new Map(prev.map(t => [t.s, t]));
              filtered.forEach((t: any) => map.set(t.s, t));
              
              // Always return in the exact fixed order to prevent jumping
              return MAJORS.map(m => map.get(m)).filter(Boolean) as TickerData[];
            });
        }
      } catch (e) {
        // Silent fail for ticker noise
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchTradMarkets = async () => {
      try {
        const results: TradTickerData[] = [];

        // USD/BRL
        try {
          const usdRes = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
          if (usdRes.ok) {
            const usdData = await usdRes.json();
            if (usdData && usdData.USDBRL) {
              results.push({
                s: 'USD/BRL',
                c: parseFloat(usdData.USDBRL.bid),
                p: parseFloat(usdData.USDBRL.pctChange),
                isCurrency: true
              });
            }
          }
        } catch (e) {}

        // Yahoo Finance helper
        const fetchYahoo = async (symbol: string, name: string) => {
          try {
            const data = await fetchWithProxy(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
            if (data && data.chart && data.chart.result && data.chart.result[0]) {
              const meta = data.chart.result[0].meta;
              const currentPrice = meta.regularMarketPrice;
              const previousClose = meta.chartPreviousClose;
              const pctChange = ((currentPrice - previousClose) / previousClose) * 100;
              return { s: name, c: currentPrice, p: pctChange };
            }
          } catch (e) {}
          return null;
        };

        const [nasdaq, sp500, b3, prata, petroleo] = await Promise.all([
          fetchYahoo('^IXIC', 'Nasdaq'),
          fetchYahoo('^GSPC', 'S&P 500'),
          fetchYahoo('^BVSP', 'B3'),
          fetchYahoo('SI=F', 'Prata'),
          fetchYahoo('CL=F', 'Petróleo')
        ]);

        if (nasdaq) results.push(nasdaq);
        if (sp500) results.push(sp500);
        if (b3) results.push(b3);
        if (prata) results.push(prata);
        if (petroleo) results.push(petroleo);

        if (isMounted && results.length > 0) {
          setTradTickers(prev => {
            // Merge to prevent blinking
            const map = new Map(prev.map(t => [t.s, t]));
            results.forEach(t => map.set(t.s, t));
            
            // Always return in the exact fixed order
            return TRAD_MAJORS.map(m => map.get(m)).filter(Boolean) as TradTickerData[];
          });
        }
      } catch (e) {}
    };

    const fetchDominance = async () => {
      try {
        const now = Date.now();
        // 3 minutos de cache (180000 ms)
        if (cachedDominanceData && now - lastDominanceFetchTime < 180000) {
          if (isMounted) setDominance(cachedDominanceData);
          return;
        }

        const res = await fetch('https://api.coingecko.com/api/v3/global');
        if (res.ok) {
          const data = await res.json();
          if (data && data.data && data.data.market_cap_percentage) {
             const btcDom = data.data.market_cap_percentage.btc || 0;
             const usdtDom = data.data.market_cap_percentage.usdt || 0;
             // CoinGecko global n?o retorna a variacao de dominancia diretamente de forma facil. 
             // Como fallback, usaremos 0 para evitar erros, ou podemos simular leve mudanca para UI.
             // Para ser fidedigno aos dados, consideraremos variao 0 caso nao tenhamos hist?rico, ou deixaremos sem seta.
             const newData = { btc: btcDom, usdt: usdtDom, btcChange: 0, usdtChange: 0 };
             cachedDominanceData = newData;
             lastDominanceFetchTime = now;
             if (isMounted) setDominance(newData);
          }
        }
      } catch (e) {
        if (isMounted && cachedDominanceData) setDominance(cachedDominanceData);
      }
    };

    fetchTradMarkets();
    fetchDominance();
    const interval = setInterval(fetchTradMarkets, 60000); // Update every 60s
    const domInterval = setInterval(fetchDominance, 180000); // 3 mins

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearInterval(domInterval);
    };
  }, []);

  if (tickers.length === 0 && tradTickers.length === 0) return null;

  const renderItems = (suffix: string) => (
    <>
      {tickers.map((t) => {
        const currentPrice = parseFloat(t.c);
        const openPrice = parseFloat(t.o);
        
        // PROFESSOR FIX: Calculate Percentage manually because miniTicker doesn't have 'P'
        // Formula: ((Close - Open) / Open) * 100
        const changePercent = ((currentPrice - openPrice) / openPrice) * 100;
        
        const isPos = changePercent >= 0;
        const isZero = changePercent === 0;

        const displayName = t.s === 'PAXGUSDT' ? 'Ouro' : t.s.replace('USDT','');

        return (
          <div key={`crypto-${t.s}-${suffix}`} className="flex items-center gap-2 text-[14px] font-mono tabular-nums min-w-max">
            <span className="font-bold text-gray-400">{displayName}</span>
            <span className="text-white font-bold">{formatPrice(currentPrice)}</span>
            <span className={`flex items-center ${isPos ? 'text-genesis-positive' : 'text-genesis-negative'} font-medium`}>
              {!isZero && (isPos ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
              {Math.abs(changePercent).toFixed(2)}%
            </span>
          </div>
        );
      })}
      {tradTickers.map((t) => {
        const isPos = t.p >= 0;
        const isZero = t.p === 0;

        let formattedPrice = '';
        if (t.isCurrency) {
          formattedPrice = `R$ ${t.c.toFixed(4)}`;
        } else {
          formattedPrice = t.c.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        return (
          <div key={`trad-${t.s}-${suffix}`} className="flex items-center gap-2 text-[14px] font-mono tabular-nums min-w-max">
            <span className="font-bold text-gray-400">{t.s}</span>
            <span className="text-white font-bold">{formattedPrice}</span>
            <span className={`flex items-center ${isPos ? 'text-genesis-positive' : 'text-genesis-negative'} font-medium`}>
              {!isZero && (isPos ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
              {Math.abs(t.p).toFixed(2)}%
            </span>
          </div>
        );
      })}
      {dominance && (
        <>
          <div key={`dom-btc-${suffix}`} className="flex items-center gap-2 text-[14px] font-mono tabular-nums min-w-max">
            <span className="font-bold text-gray-400">BTC.D</span>
            <span className="text-white font-bold">{dominance.btc.toFixed(2)}%</span>
            {dominance.btcChange !== 0 && (
              <span className={`flex items-center ${dominance.btcChange >= 0 ? 'text-genesis-positive' : 'text-genesis-negative'} font-medium`}>
                {dominance.btcChange >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                {Math.abs(dominance.btcChange).toFixed(2)}%
              </span>
            )}
          </div>
          <div key={`dom-usdt-${suffix}`} className="flex items-center gap-2 text-[14px] font-mono tabular-nums min-w-max">
            <span className="font-bold text-gray-400">USDT.D</span>
            <span className="text-white font-bold">{dominance.usdt.toFixed(2)}%</span>
            {dominance.usdtChange !== 0 && (
              <span className={`flex items-center ${dominance.usdtChange >= 0 ? 'text-genesis-positive' : 'text-genesis-negative'} font-medium`}>
                {dominance.usdtChange >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                {Math.abs(dominance.usdtChange).toFixed(2)}%
              </span>
            )}
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="w-full bg-genesis-base/95  overflow-hidden py-2 flex items-center">
      <style>
        {`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .animate-marquee {
            animation: marquee 60s linear infinite;
          }
          .animate-marquee:hover {
            animation-play-state: paused;
          }
        `}
      </style>
      <div className="flex w-max animate-marquee whitespace-nowrap">
        {/* We render 4 identical blocks. The animation translates by -50%, covering exactly 2 blocks before seamlessly looping. */}
        <div className="flex gap-16 pr-16">{renderItems('1')}</div>
        <div className="flex gap-16 pr-16">{renderItems('2')}</div>
        <div className="flex gap-16 pr-16">{renderItems('3')}</div>
        <div className="flex gap-16 pr-16">{renderItems('4')}</div>
      </div>
    </div>
  );
};

export default memo(MarketTicker);
