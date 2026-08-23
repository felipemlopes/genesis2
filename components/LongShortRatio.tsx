
import React, { useEffect, useState } from 'react';
import { fetchLSRData } from '../services/cryptoApi';

/**
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 12, item 12.9, doc §17): achado real —
 * este componente reimplementava as 3 chamadas (Binance/Bybit/OKX), cada uma com sua própria
 * cascata de 2 proxies, duplicando exatamente `fetchLSRData()` (já existente em `cryptoApi.ts`,
 * usado por outros consumidores) — inclusive com a MESMA rota errada da Binance
 * (`/fapi/v1/globalLongShortAccountRatio`, que não existe; a real é
 * `/futures/data/globalLongShortAccountRatio`, já corrigida em `fetchLSRData()`). Substituído por
 * uma cascata simples sobre a função real, sem reimplementar fetch/proxy/parsing.
 * `decision_role: DISPLAY_ONLY` — puramente informativo, nunca decide nada.
 */

interface LongShortRatioProps {
  symbol: string;
}

interface RatioData {
  long: number;
  short: number;
  ratio: number;
}

const FONTES = ['Binance', 'Bybit', 'OKX'] as const;

const LongShortRatio: React.FC<LongShortRatioProps> = ({ symbol }) => {
  const [data, setData] = useState<RatioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [source, setSource] = useState<string>('Binance');

  useEffect(() => {
    let isMounted = true;

    setData(null);
    setLoading(true);
    setError(false);

    const loadData = async () => {
      for (const fonte of FONTES) {
        try {
          const resultado = await fetchLSRData(symbol, fonte);
          if (resultado && isMounted) {
            setData(resultado);
            setSource(fonte);
            setLoading(false);
            return;
          }
        } catch {
          // tenta a próxima fonte
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
             <span className="text-[10px] text-red-500 font-mono font-bold">INDISPONÍVEL</span>
             <span className="text-[8px] text-gray-500">Nenhuma fonte respondeu.</span>
        </div>
      );
  }

  if (!data) return null;

  const isBullish = data.ratio >= 1;

  // Chart Calculations
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const longOffset = circumference - ((data.long / 100) * circumference);

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
                <span className="text-yellow-600">{source.toUpperCase()}</span>
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
                          {data.ratio.toFixed(2)}
                       </span>
                   </div>
               </div>

               {/* DIREITA: DETALHES PORCENTAGEM */}
               <div className="flex flex-col items-end justify-center flex-1 pl-3 gap-0.5">
                  <div className="flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-genesis-positive shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                     <span className="text-xs font-mono font-bold text-gray-200">{data.long.toFixed(1)}%</span>
                     <span className="text-[8px] text-gray-500 font-bold uppercase ml-0.5">L</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-genesis-negative shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                     <span className="text-xs font-mono font-bold text-gray-400">{data.short.toFixed(1)}%</span>
                     <span className="text-[8px] text-gray-600 font-bold uppercase ml-0.5">S</span>
                  </div>
               </div>
           </div>

           {/* Medidor visual Long vs Short (Barra Horizontal) */}
           <div className="w-full h-1.5 bg-red-500/20 rounded-full mt-2 overflow-hidden flex">
               <div
                   className="h-full bg-green-500 transition-all duration-1000 ease-out"
                   style={{ width: `${data.long}%` }}
               />
               <div
                   className="h-full bg-red-500 transition-all duration-1000 ease-out"
                   style={{ width: `${data.short}%` }}
               />
           </div>
       </div>

    </div>
  );
};

export default LongShortRatio;
