
import React, { useEffect, useState } from 'react';

interface LongShortRatioProps {
  symbol: string;
}

interface RatioData {
  long: number;
  short: number;
  ratio: number;
  timestamp: number;
}

const LongShortRatio: React.FC<LongShortRatioProps> = ({ symbol }) => {
  const [data, setData] = useState<RatioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [source, setSource] = useState<string>('Binance');

  useEffect(() => {
    let isMounted = true;
    
    // Reset state on symbol change
    setData(null);
    setLoading(true);
    setError(false);

    const cleanSymbol = symbol.replace('/', '').toUpperCase();

    // --- FETCH FUNCTIONS ---

    const fetchFromBinance = async (proxyUrlGen: (url: string) => string): Promise<RatioData> => {
       const targetUrl = `https://fapi.binance.com/fapi/v1/globalLongShortAccountRatio?symbol=${cleanSymbol}&period=1h&limit=1&_t=${Date.now()}`;
       const res = await fetch(proxyUrlGen(targetUrl));
       if (!res.ok) throw new Error('Binance fetch failed');
       const json = await res.json();
       
       if (Array.isArray(json) && json.length > 0 && json[0].longShortRatio) {
           const item = json[0];
           let long = parseFloat(item.longAccount);
           let short = parseFloat(item.shortAccount);
           // Normalize to 0-100
           if (long <= 1) long = long * 100;
           if (short <= 1) short = short * 100;
           
           return {
               long,
               short,
               ratio: parseFloat(item.longShortRatio),
               timestamp: Date.now()
           };
       }
       throw new Error('Binance invalid format');
    };

    const fetchFromBybit = async (proxyUrlGen: (url: string) => string): Promise<RatioData> => {
        // Bybit V5 Public Endpoint
        const targetUrl = `https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${cleanSymbol}&period=1h&limit=1&_t=${Date.now()}`;
        const res = await fetch(proxyUrlGen(targetUrl));
        if (!res.ok) throw new Error('Bybit fetch failed');
        const json = await res.json();

        if (json.retCode === 0 && json.result && json.result.list && json.result.list.length > 0) {
            const item = json.result.list[0];
            const buyRatio = parseFloat(item.buyRatio); // e.g. "0.54"
            const sellRatio = parseFloat(item.sellRatio); // e.g. "0.46"
            
            return {
                long: buyRatio * 100,
                short: sellRatio * 100,
                ratio: buyRatio / sellRatio,
                timestamp: parseInt(item.timestamp)
            };
        }
        throw new Error('Bybit invalid format');
    };

    const fetchFromOkx = async (proxyUrlGen: (url: string) => string): Promise<RatioData> => {
        const ccy = cleanSymbol.replace('USDT', '');
        const targetUrl = `https://www.okx.com/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=${ccy}&period=1H`;
        const res = await fetch(proxyUrlGen(targetUrl));
        if (!res.ok) throw new Error('OKX fetch failed');
        const json = await res.json();

        if (json.code === '0' && json.data && json.data.length > 0) {
            const ratio = parseFloat(json.data[0][1]);
            const long = (ratio * 100) / (1 + ratio);
            const short = 100 - long;
            
            return {
                long,
                short,
                ratio,
                timestamp: parseInt(json.data[0][0])
            };
        }
        throw new Error('OKX invalid format');
    };

    // --- ORCHESTRATOR ---

    const loadData = async () => {
        // List of proxies to try
        const proxies = [
            (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
            (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
        ];

        // Strategy: 
        // 1. Try Binance with all proxies
        // 2. If fail, Try Bybit with all proxies
        // 3. If fail, Try OKX with all proxies
        
        // Attempt Binance
        for (const proxy of proxies) {
            try {
                const result = await fetchFromBinance(proxy);
                if (isMounted) {
                    setData(result);
                    setSource('Binance');
                    setLoading(false);
                    return; // Success
                }
            } catch (e) {
                // Continue to next proxy
            }
        }

        // Attempt Bybit (Fallback)
        for (const proxy of proxies) {
            try {
                const result = await fetchFromBybit(proxy);
                if (isMounted) {
                    setData(result);
                    setSource('Bybit'); // Bybit is huge volume, good fallback
                    setLoading(false);
                    return; // Success
                }
            } catch (e) {
                // Continue
            }
        }

        // Attempt OKX (Fallback 2)
        for (const proxy of proxies) {
            try {
                const result = await fetchFromOkx(proxy);
                if (isMounted) {
                    setData(result);
                    setSource('OKX');
                    setLoading(false);
                    return; // Success
                }
            } catch (e) {
                // Continue
            }
        }

        if (isMounted) {
            setError(true);
            setLoading(false);
        }
    };

    loadData();
    const interval = setInterval(loadData, 10000); // Poll every 10s

    return () => {
        clearInterval(interval);
        isMounted = false;
    };
  }, [symbol]);

  // --- RENDER ---

  if (loading && !data) {
      return (
        <div className="flex items-center justify-between h-full w-full p-2 animate-pulse">
            <div className="w-12 h-12 rounded-full border-4 " />
            <div className="flex flex-col gap-2 w-1/2">
               <div className="h-2 w-full bg-white/5 rounded" />
               <div className="h-2 w-2/3 bg-white/5 rounded" />
            </div>
        </div>
      );
  }

  if (error && !data) {
      return (
        <div className="flex flex-col justify-center items-center h-full w-full text-center opacity-50">
             <span className="text-[10px] text-red-500 font-mono font-bold">CONEXÃO INSTÁVEL</span>
             <span className="text-[8px] text-gray-500">Tentando reconectar...</span>
        </div>
      );
  }

  const safeData = data || { long: 50, short: 50, ratio: 1.00 };
  const isBullish = safeData.ratio >= 1;

  // Chart Calculations
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const longOffset = circumference - ((safeData.long / 100) * circumference);

  return (
    <div className="flex flex-col justify-between h-full w-full px-1 relative group cursor-pointer z-10 hover:z-[9999999]">
       
       {/* TOOLTIP INFORMATIVO (Hover) */}
       <div className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 mb-3 w-60 p-3 bg-black border border-white/5 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,1)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-[9999999] text-center scale-95 group-hover:scale-100 origin-top">
           <div className="flex flex-col gap-1.5">
               <span className="text-xs font-bold text-white uppercase tracking-wider  pb-1">
                   O que é Long/Short Ratio?
               </span>
               <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
                   Compara o sentimento dos traders no par {symbol} na última 1 hora.
               </p>
               <div className="grid grid-cols-2 gap-2 mt-1">
                   <div className="bg-green-900/20 rounded p-1 border-green-500/20">
                       <span className="block text-[9px] text-green-400 font-bold">&gt; 1.0</span>
                       <span className="text-[8px] text-gray-500">Viés Altista</span>
                   </div>
                   <div className="bg-red-900/20 rounded p-1 border-red-500/20">
                       <span className="block text-[9px] text-red-400 font-bold">&lt; 1.0</span>
                       <span className="text-[8px] text-gray-500">Viés Baixista</span>
                   </div>
               </div>
           </div>
           {/* Seta do Tooltip */}
           <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black  transform rotate-45 border-l border-t border-white/5"></div>
       </div>

       {/* HEADER DO CARD */}
       <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">
                L/S RATIO (1H)
            </span>
            <div className="text-[9px] font-bold text-gray-600 flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                <span>FONTE:</span>
                {source === 'Binance' ? (
                     <span className="text-yellow-600">BINANCE</span>
                ) : (
                     <span className="text-orange-500">BYBIT</span>
                )}
            </div>
       </div>

       {/* CONTEÚDO PRINCIPAL (Gráfico + Dados) */}
       <div className="flex flex-col flex-1">
           <div className="flex items-center justify-between flex-1">
               {/* ESQUERDA: DONUT CHART */}
               <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90" viewBox="0 0 40 40">
                       <circle
                         cx="20" cy="20" r={radius}
                         fill="transparent"
                         stroke="#ef4444" 
                         strokeWidth="4"
                         className="opacity-80"
                       />
                       <circle
                         cx="20" cy="20" r={radius}
                         fill="transparent"
                         stroke="#10b981" 
                         strokeWidth="4"
                         strokeDasharray={circumference}
                         strokeDashoffset={longOffset}
                         strokeLinecap="round"
                         className="transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                       />
                   </svg>
                   
                   <div className="absolute inset-0 flex items-center justify-center">
                       <span className={`text-[11px] font-bold font-mono tracking-tighter ${isBullish ? 'text-green-400' : 'text-red-400'}`}>
                          {safeData.ratio.toFixed(2)}
                       </span>
                   </div>
               </div>

               {/* DIREITA: DETALHES PORCENTAGEM */}
               <div className="flex flex-col items-end justify-center flex-1 pl-3 gap-0.5">
                  <div className="flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-genesis-positive shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                     <span className="text-xs font-mono font-bold text-gray-200">{safeData.long.toFixed(1)}%</span>
                     <span className="text-[8px] text-gray-500 font-bold uppercase ml-0.5">L</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-genesis-negative shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                     <span className="text-xs font-mono font-bold text-gray-400">{safeData.short.toFixed(1)}%</span>
                     <span className="text-[8px] text-gray-600 font-bold uppercase ml-0.5">S</span>
                  </div>
               </div>
           </div>

           {/* Melhoria 4: Medidor visual Long vs Short (Barra Horizontal) */}
           <div className="w-full h-1.5 bg-red-500/20 rounded-full mt-2 overflow-hidden flex">
               <div 
                   className="h-full bg-green-500 transition-all duration-1000 ease-out"
                   style={{ width: `${safeData.long}%` }}
               />
               <div 
                   className="h-full bg-red-500 transition-all duration-1000 ease-out"
                   style={{ width: `${safeData.short}%` }}
               />
           </div>
       </div>

    </div>
  );
};

export default LongShortRatio;
