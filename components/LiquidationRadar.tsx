
import React, { useEffect, useState } from 'react';
import { Skull, HelpCircle, AlertTriangle, Crosshair, RefreshCw } from 'lucide-react';
import { fetchLiquidationData, LiquidationRadarData } from '../services/liquidationService';
import { formatPrice } from '../services/cryptoApi';

const LiquidationRadar: React.FC = () => {
  const [data, setData] = useState<LiquidationRadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('BTCUSDT');

  const loadData = async () => {
    setLoading(true);
    try {
        const res = await fetchLiquidationData(selectedAsset);
        setData(res);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [selectedAsset]);

  const Tooltip: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
      <div className="absolute top-1 right-1 group cursor-help z-20">
          <HelpCircle size={12} className="text-gray-600 hover:text-white transition-colors" />
          <div className="absolute right-0 top-full mt-2 w-64 p-[16px] bg-black  rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[999999]">
              <span className="block text-xs font-bold text-white uppercase mb-2  pb-1">{title}</span>
              <div className="text-[10px] text-gray-400 leading-relaxed font-sans">{children}</div>
              <div className="absolute -top-1 right-2 w-2 h-2 bg-black  rotate-45"></div>
          </div>
      </div>
  );

  const formatBigVolume = (vol: number) => {
      if (vol >= 1_000_000_000) return `$${(vol / 1_000_000_000).toFixed(2)}B`;
      if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(0)}M`;
      return `$${(vol / 1_000).toFixed(0)}k`;
  };

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8  pb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-genesis-accent/10 flex items-center justify-center border-genesis-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                    <Skull size={20} className="text-genesis-accent" />
                </div>
                <div>
                    <h1 className="text-2xl font-thin text-white tracking-widest uppercase">Liquidation Radar</h1>
                    <p className="text-[10px] text-gray-500 font-mono">Monitoramento de Zonas de Liquidação</p>
                </div>
            </div>
            
            <div className="flex items-center gap-[16px]">
                 <select 
                    value={selectedAsset}
                    onChange={(e) => setSelectedAsset(e.target.value)}
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
                    <span className="text-xs font-mono text-genesis-accent animate-pulse tracking-widest">RASTREAMENTO INICIADO...</span>
                </div>
            </div>
        ) : data ? (
            <div className="flex flex-col gap-6">
                
                {/* AI SUMMARY BLOCK */}
                <div className="bg-genesis-card  rounded-[10px] p-6 relative">
                     <div className="flex items-center gap-2 mb-3 text-genesis-accent">
                         <AlertTriangle size={16} />
                         <span className="text-xs font-bold uppercase tracking-widest">Análise de Risco (AI)</span>
                     </div>
                     <p className="text-sm text-gray-300 font-light leading-relaxed">
                         {data.summary}
                     </p>
                </div>

                {/* HEATMAP VISUALIZER */}
                <div className="bg-genesis-card  rounded-[10px] p-8 min-h-[400px] flex flex-col relative overflow-visible">
                    <div className="absolute top-[16px] right-4 flex flex-col items-end">
                        <span className="text-[9px] font-bold text-gray-500 uppercase  px-2 py-1 rounded mb-1">
                            Price Ladder ({selectedAsset})
                        </span>
                        <span className="text-[8px] text-gray-600 font-mono">FILTRO ATIVO: &gt; $100M</span>
                    </div>

                    {/* Central Price Line */}
                    <div className="flex-1 flex flex-col justify-center relative py-10">
                        
                        {/* Short Clusters (Above) */}
                        <div className="flex flex-col-reverse items-center gap-1.5 mb-4">
                            {data.clusters.filter(c => c.type === 'Short').map((cluster, idx) => {
                                const isBillion = cluster.volume >= 1_000_000_000;
                                const isHalfBillion = cluster.volume >= 500_000_000;
                                
                                return (
                                    <div key={idx} className="w-full max-w-3xl flex items-center gap-[16px] group relative">
                                        <div className={`flex-1 text-right text-[10px] font-mono ${isBillion ? 'text-white font-bold' : 'text-gray-500'} group-hover:text-white`}>
                                            {formatPrice(cluster.priceLevel).replace('$', '')}
                                        </div>
                                        
                                        {/* BARRA VISUAL */}
                                        <div className={`w-[60%] h-5 bg-gray-900 rounded-sm relative overflow-visible ${isBillion ? 'border-red-500/50' : ''}`}>
                                             <Tooltip title={`Zona de Short Squeeze Massiva`}>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex justify-between"><span>Faixa:</span> <span className="text-white font-bold">{formatPrice(cluster.priceLevel)}</span></div>
                                                    <div className="flex justify-between"><span>Vol Est.:</span> <span className="text-genesis-negative font-bold">{formatBigVolume(cluster.volume)}</span></div>
                                                    <div className="flex justify-between"><span>Tipo:</span> <span className="text-red-400">Liquidação Institucional</span></div>
                                                    {isBillion && <p className="mt-1 text-genesis-positive font-bold text-center  pt-1">️ BARREIRA BILIONÁRIA</p>}
                                                </div>
                                             </Tooltip>
                                             
                                             <div 
                                                className={`h-full transition-all duration-1000 ${
                                                    isBillion 
                                                        ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)] animate-pulse' 
                                                        : (isHalfBillion ? '  ' : '   opacity-60')
                                                }`}
                                                style={{ width: `${cluster.intensity}%` }}
                                             ></div>
                                        </div>
                                        
                                        <div className={`w-20 text-[10px] font-bold ${isBillion ? 'text-white text--glow' : 'text-red-500'}`}>
                                            {formatBigVolume(cluster.volume)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Current Price Marker */}
                        <div className="w-full flex items-center justify-center gap-[16px] my-6 py-3 bg-genesis-accent/5 border-y border-genesis-accent/20  z-10">
                            <Crosshair size={16} className="text-genesis-accent animate-pulse" />
                            <span className="text-xl font-mono font-bold text-white tracking-widest text--glow">
                                {formatPrice(data.currentPrice)}
                            </span>
                        </div>

                        {/* Long Clusters (Below) */}
                         <div className="flex flex-col items-center gap-1.5 mt-4">
                            {data.clusters.filter(c => c.type === 'Long').map((cluster, idx) => {
                                const isBillion = cluster.volume >= 1_000_000_000;
                                const isHalfBillion = cluster.volume >= 500_000_000;

                                return (
                                    <div key={idx} className="w-full max-w-3xl flex items-center gap-[16px] group relative">
                                        <div className={`flex-1 text-right text-[10px] font-mono ${isBillion ? 'text-white font-bold' : 'text-gray-500'} group-hover:text-white`}>
                                            {formatPrice(cluster.priceLevel).replace('$', '')}
                                        </div>
                                        
                                        {/* BARRA VISUAL */}
                                        <div className={`w-[60%] h-5 bg-gray-900 rounded-sm relative overflow-visible ${isBillion ? 'border-green-500/50' : ''}`}>
                                             <Tooltip title={`Zona de Long Squeeze Massiva`}>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex justify-between"><span>Faixa:</span> <span className="text-white font-bold">{formatPrice(cluster.priceLevel)}</span></div>
                                                    <div className="flex justify-between"><span>Vol Est.:</span> <span className="text-genesis-positive font-bold">{formatBigVolume(cluster.volume)}</span></div>
                                                    <div className="flex justify-between"><span>Tipo:</span> <span className="text-green-400">Liquidação Institucional</span></div>
                                                    {isBillion && <p className="mt-1 text-genesis-positive font-bold text-center  pt-1">️ SUPORTE BILIONÁRIO</p>}
                                                </div>
                                             </Tooltip>
                                             
                                             <div 
                                                className={`h-full transition-all duration-1000 ${
                                                    isBillion 
                                                        ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] animate-pulse' 
                                                        : (isHalfBillion ? '  ' : '   opacity-60')
                                                }`}
                                                style={{ width: `${cluster.intensity}%` }}
                                             ></div>
                                        </div>
                                        
                                        <div className={`w-20 text-[10px] font-bold ${isBillion ? 'text-white text--glow' : 'text-green-500'}`}>
                                            {formatBigVolume(cluster.volume)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="mt-4  pt-6 text-center opacity-70">
                    <p className="text-[10px] text-gray-500 font-sans max-w-3xl mx-auto leading-relaxed">
                        O Liquidation Radar identifica regiões onde ordens de liquidação se acumulam no mercado futuro. Essas zonas tendem a gerar movimentos bruscos quando atingidas. As informações aqui apresentadas ajudam o trader a antecipar volatilidade e possíveis squeezes.
                    </p>
                </div>
            </div>
        ) : null}
    </div>
  );
};

export default LiquidationRadar;
