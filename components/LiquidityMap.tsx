
import React, { useEffect, useState } from 'react';
import { Layers, HelpCircle, ArrowUp, ArrowDown, RefreshCw, AlertTriangle, Target, Activity } from 'lucide-react';
import { fetchLiquidityMapData, LiquidityMapData, LiquidityLevel } from '../services/liquidityMapService';
import { formatPrice } from '../services/cryptoApi';

const LiquidityMap: React.FC = () => {
  const [data, setData] = useState<LiquidityMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState('BTCUSDT'); 

  const loadData = async () => {
    setLoading(true);
    try {
        const res = await fetchLiquidityMapData(asset);
        setData(res);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const shorts = data?.levels?.filter(l => l.side === 'Short') || [];
  const longs = data?.levels?.filter(l => l.side === 'Long') || [];

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // 5s refresh as requested
    return () => clearInterval(interval);
  }, [asset]);

  // --- SUB-COMPONENTS ---

  const Tooltip: React.FC<{ level: LiquidityLevel; children: React.ReactNode }> = ({ level, children }) => (
      <div className="absolute inset-0 group cursor-help z-10">
          <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 w-72 p-[16px] bg-black  rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[999999] pointer-events-none scale-95 group-hover:scale-100 origin-right">
              <span className="block text-xs font-bold text-white uppercase mb-2  pb-1 flex items-center gap-2">
                  <Target size={12} className="text-genesis-accent" /> Alvo: {formatPrice(level.price)}
              </span>
              <div className="space-y-1.5 text-[10px] text-gray-400 font-sans">
                  <div className="flex justify-between"><span>Volume Estimado:</span> <span className="text-white font-mono font-bold">${level.volumeUsd.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span></div>
                  <div className="flex justify-between"><span>Origem:</span> <span className={level.cluster ? 'text-genesis-accent font-bold' : 'text-gray-500'}>{level.cluster ? 'Cluster de Alta Densidade' : 'Liquidez Dispersa'}</span></div>
                  
                  <p className="mt-2 text-gray-500 italic  pt-2 leading-relaxed">
                      "Este nível representa concentração relevante de liquidações prováveis caso o preço atinja a região."
                  </p>
              </div>
              <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-black  rotate-45"></div>
          </div>
          {children}
      </div>
  );

  const LiquidityRow: React.FC<{ level: LiquidityLevel }> = ({ level }) => {
      const isShort = level.side === 'Short';
      return (
          <div className={`flex justify-between items-center text-[10px] p-2 rounded transition-colors group relative cursor-help mb-1 ${
              isShort ? 'bg-red-900/5 border-red-500/10 hover:border-red-500/30' : 'bg-green-900/5 border-green-500/10 hover:border-green-500/30'
          }`}>
              <Tooltip level={level}><div className="absolute inset-0"></div></Tooltip>
              
              <div className="flex items-center gap-2 w-1/4">
                  <span className="font-mono text-white font-bold">{formatPrice(level.price)}</span>
              </div>
              
              <div className="flex items-center gap-2 w-1/4 justify-end">
                  <span className={`font-mono font-bold ${isShort ? 'text-red-300' : 'text-green-300'}`}>
                      ${(level.volumeUsd/1000).toFixed(0)}k
                  </span>
              </div>

              <div className="flex items-center justify-center w-1/4">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                      level.intensity === 'Alta' ? 'bg-white/10 text-white' : (level.intensity === 'Média' ? 'text-gray-300' : 'text-gray-500')
                  }`}>
                      {level.intensity}
                  </span>
              </div>

              <div className="flex items-center justify-end w-1/4 gap-1">
                  <span className={`text-[9px] font-bold ${level.cluster ? 'text-genesis-accent' : 'text-gray-600'}`}>
                      {level.cluster ? 'SIM' : 'NÃO'}
                  </span>
                  {level.cluster && <AlertTriangle size={8} className="text-genesis-accent" />}
              </div>
          </div>
      );
  };

  const LiquidityHeatmapBar: React.FC<{ level: LiquidityLevel, maxVol: number }> = ({ level, maxVol }) => {
      const widthPct = Math.min((level.volumeUsd / maxVol) * 100, 100);
      const isShortLiq = level.side === 'Short'; 
      const colorClass = isShortLiq ? '  ' : '  ';
      
      return (
          <div className="relative w-full h-4 flex items-center mb-0.5 hover:bg-white/5 transition-colors group">
              <Tooltip level={level}><div className="w-full h-full absolute"></div></Tooltip>
              <div className="w-16 text-[9px] font-mono text-gray-500 text-right pr-2 shrink-0">
                  {level.price.toFixed(2)}
              </div>
              <div className="flex-1 h-full relative bg-gray-900/50 rounded-r-sm overflow-hidden">
                   <div 
                      className={`h-full absolute top-0 left-0 transition-all duration-500 ${colorClass} opacity-80`}
                      style={{ width: `${widthPct}%` }}
                   ></div>
              </div>
          </div>
      );
  };

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8  pb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-genesis-accent/10 flex items-center justify-center border-genesis-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                    <Layers size={20} className="text-genesis-accent" />
                </div>
                <div>
                    <h1 className="text-2xl font-thin text-white tracking-widest uppercase">LiquidMap</h1>
                    <p className="text-[10px] text-gray-500 font-mono">Mapa de Liquidez (Clusters)</p>
                </div>
            </div>
            
            <div className="flex items-center gap-[16px]">
                 <select 
                    value={asset}
                    onChange={(e) => setAsset(e.target.value)}
                    className="bg-black  rounded px-3 py-1.5 text-xs text-white uppercase font-bold focus:border-genesis-accent focus:outline-none cursor-pointer hover: transition-all"
                >
                    <option value="BTCUSDT">BTC/USDT</option>
                    <option value="ETHUSDT">ETH/USDT</option>
                    <option value="SOLUSDT">SOL/USDT</option>
                </select>
                <button 
                  onClick={loadData}
                  className="bg-white/5 p-2 rounded hover:bg-white/10 text-white transition-colors"
                >
                   <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
        </div>

        {loading && !data ? (
             <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-[16px]">
                    <div className="w-12 h-12 rounded-full border-genesis-accent border-t-transparent animate-spin"></div>
                    <span className="text-xs font-mono text-genesis-accent animate-pulse tracking-widest">MAPEANDO LIQUIDEZ...</span>
                </div>
            </div>
        ) : data ? (
            <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
                    
                    {/* COL 1: HEATMAP VISUALIZER (Visual Only) */}
                    <div className="lg:col-span-1 bg-genesis-card  rounded-[10px] p-6 relative flex flex-col min-h-[500px]">
                        <div className="flex items-center gap-2 text-genesis-accent mb-4">
                            <Activity size={16} />
                            <span className="text-xs font-bold uppercase tracking-widest">Mapa Gráfico</span>
                        </div>

                        {/* PRICE LADDER CONTAINER */}
                        <div className="flex-1 bg-black/40  rounded-lg p-2 relative overflow-y-auto custom-scrollbar flex flex-col justify-center">
                            
                            {/* SHORTS (ABOVE PRICE) */}
                            <div className="flex flex-col-reverse gap-px pb-2  min-h-[150px] justify-end">
                                {shorts.map((level, i) => (
                                    <LiquidityHeatmapBar key={i} level={level} maxVol={Math.max(...shorts.map(s => s.volumeUsd), 1000)} />
                                ))}
                            </div>

                            {/* CURRENT PRICE SPREAD */}
                            <div className="py-2 text-center bg-genesis-accent/5 my-1 border-y border-genesis-accent/20">
                                <span className="text-sm font-mono font-bold text-white tracking-widest text--glow">
                                    {formatPrice(data.currentPrice)}
                                </span>
                            </div>

                            {/* LONGS (BELOW PRICE) */}
                            <div className="flex flex-col gap-px pt-2  min-h-[150px] justify-start">
                                {longs.map((level, i) => (
                                    <LiquidityHeatmapBar key={i} level={level} maxVol={Math.max(...longs.map(l => l.volumeUsd), 1000)} />
                                ))}
                            </div>
                        
                        </div>
                    </div>

                    {/* COL 2 & 3: DETAILED LISTS */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        
                        {/* SHORT LIQUIDITY LIST */}
                        <div className="bg-genesis-card  rounded-[10px] p-5 flex-1 flex flex-col">
                            <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-4  pb-2 flex items-center gap-2">
                                <ArrowUp size={12} /> Liquidação Acima (Short Liquidity)
                            </h4>
                            
                            {/* Table Header */}
                            <div className="flex justify-between px-2 pb-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                                <span className="w-1/4">Preço Alvo</span>
                                <span className="w-1/4 text-right">Volume Est.</span>
                                <span className="w-1/4 text-center">Intensidade</span>
                                <span className="w-1/4 text-right">Cluster</span>
                            </div>

                            <div className="space-y-1 overflow-y-auto custom-scrollbar max-h-[220px]">
                                {shorts.slice(0, 8).map((l, i) => (
                                    <LiquidityRow key={i} level={l} />
                                ))}
                            </div>
                        </div>

                         {/* LONG LIQUIDITY LIST */}
                         <div className="bg-genesis-card  rounded-[10px] p-5 flex-1 flex flex-col">
                            <h4 className="text-[10px] font-bold text-green-400 uppercase tracking-widest mb-4  pb-2 flex items-center gap-2">
                                <ArrowDown size={12} /> Liquidação Abaixo (Long Liquidity)
                            </h4>

                             {/* Table Header */}
                             <div className="flex justify-between px-2 pb-2 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                                <span className="w-1/4">Preço Alvo</span>
                                <span className="w-1/4 text-right">Volume Est.</span>
                                <span className="w-1/4 text-center">Intensidade</span>
                                <span className="w-1/4 text-right">Cluster</span>
                            </div>

                            <div className="space-y-1 overflow-y-auto custom-scrollbar max-h-[220px]">
                                {longs.slice(0, 8).map((l, i) => (
                                    <LiquidityRow key={i} level={l} />
                                ))}
                            </div>
                        </div>
                        
                        {/* AUTOMATIC INTERPRETATION TEXT (FIXED BOTTOM) */}
                        <div className="mt-auto pt-4 ">
                            <div className="flex items-start gap-3 bg-white/5 p-[16px] rounded-lg ">
                                <div className="mt-0.5 p-1 bg-genesis-accent/10 rounded border-genesis-accent/20 shrink-0">
                                    <Target size={14} className="text-genesis-accent" />
                                </div>
                                <p className="text-[11px] text-gray-300 leading-relaxed font-sans text-justify">
                                    {data.interpretation}
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </>
        ) : null}
    </div>
  );
};

export default LiquidityMap;
