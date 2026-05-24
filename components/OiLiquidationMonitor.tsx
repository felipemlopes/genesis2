
import React, { useEffect, useState } from 'react';
import { LineChart, ArrowUp, ArrowDown, RefreshCw, HelpCircle, Layers, AlertOctagon } from 'lucide-react';
import { fetchOiLiquidationData, OiLiquidationData } from '../services/oiLiquidationService';
import { formatPrice } from '../services/cryptoApi';

const OiLiquidationMonitor: React.FC = () => {
  const [data, setData] = useState<OiLiquidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [asset, setAsset] = useState('BTCUSDT');

  const loadData = async () => {
    setLoading(true);
    try {
        const res = await fetchOiLiquidationData(asset);
        setData(res);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    setData(null); // Reset on asset change
    loadData();
    // REMOVED INTERVAL: Data must remain static once captured.
  }, [asset]);

  const formatCurrency = (val: number, compact: boolean = true) => {
      if (compact) {
        if (val >= 1000000000) return `$${(val / 1000000000).toFixed(2)}B`;
        if (val >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
      }
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Sub-component: Tooltip (Immutable Format)
  const Tooltip: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
      <div className="absolute top-2 right-2 group cursor-help z-20">
          <HelpCircle size={14} className="text-gray-600 hover:text-white transition-colors" />
          <div className="absolute right-0 top-full mt-2 w-72 p-[16px] bg-black  rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[999999]">
              <span className="block text-xs font-bold text-white uppercase mb-2  pb-1">{title}</span>
              <div className="text-[10px] text-gray-400 leading-relaxed font-sans space-y-1">{children}</div>
              <div className="absolute -top-1 right-2 w-2 h-2 bg-black  rotate-45"></div>
          </div>
      </div>
  );

  // Sub-component: Simple Sparkline
  const OiChart: React.FC<{ history: number[] }> = ({ history }) => {
      if (!history || history.length === 0) return null;
      const min = Math.min(...history);
      const max = Math.max(...history);
      const range = max - min || 1;
      
      const points = history.map((val, idx) => {
          const x = (idx / (history.length - 1)) * 100;
          const y = 100 - ((val - min) / range) * 100;
          return `${x},${y}`;
      }).join(' ');

      const isUp = history[history.length - 1] > history[0];

      return (
          <div className="w-full h-40 mt-6 relative overflow-hidden bg-black/20 rounded-lg ">
               <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isUp ? '#10b981' : '#ef4444'} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={isUp ? '#10b981' : '#ef4444'} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon points={`0,100 ${points} 100,100`} fill="url(#chartFill)" />
                  <polyline fill="none" stroke={isUp ? '#10b981' : '#ef4444'} strokeWidth="1.5" points={points} vectorEffect="non-scaling-stroke" />
               </svg>
          </div>
      );
  };

  const getPercentageColor = (val: number) => {
      if (val > 0) return 'text-genesis-positive';
      if (val < 0) return 'text-genesis-negative';
      return 'text-gray-400';
  };

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8  pb-4">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-genesis-accent/10 flex items-center justify-center border-genesis-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                    <LineChart size={20} className="text-genesis-accent" />
                </div>
                <div>
                    <h1 className="text-2xl font-thin text-white tracking-widest uppercase">Open Interest Monitor</h1>
                    <p className="text-[10px] text-gray-500 font-mono">Aggregated Open Interest</p>
                </div>
            </div>

            <div className="flex items-center gap-[16px]">
                {/* STATIC PRICE CAPTURE */}
                {data && (
                    <div className="flex items-center gap-2 bg-black/40  px-3 py-1.5 rounded animate-in fade-in">
                        <span className="text-sm font-mono font-bold text-white tracking-wide">
                            {formatPrice(data.meta.price)}
                        </span>
                        <div className={`flex items-center gap-1 text-[10px] font-bold ${data.meta.change24h >= 0 ? 'text-genesis-positive' : 'text-genesis-negative'}`}>
                            {data.meta.change24h >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                            {Math.abs(data.meta.change24h).toFixed(2)}%
                        </div>
                    </div>
                )}
                
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
                  onClick={() => { setData(null); loadData(); }}
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
                    <span className="text-xs font-mono text-genesis-accent animate-pulse tracking-widest">CARREGANDO DADOS PÚBLICOS...</span>
                </div>
            </div>
        ) : data ? (
            <>
                <div className="grid grid-cols-1 gap-6 pb-8">
                    
                    {/* CARD 1: OPEN INTEREST SUMMARY (FULL WIDTH) */}
                    <div className="w-full bg-genesis-card  rounded-[10px] p-8 relative group hover: transition-colors">
                        <Tooltip title="Open Interest Overview">
                            <div><strong>OI Change:</strong> Variação percentual do total de contratos.</div>
                            <div><strong>Interpretação:</strong> Aumento indica entrada de capital. Queda indica saída (realização).</div>
                        </Tooltip>
                        
                        <div className="flex items-center gap-2 mb-8">
                            <Layers size={16} className="text-genesis-accent" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-white">Open Interest (Aggregated)</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-8">
                            <div>
                                <span className="text-5xl font-mono font-bold text-white tracking-tighter block mb-2">
                                    {formatCurrency(data.openInterest.totalUsd)}
                                </span>
                                <div className="flex items-center gap-2 text-xs uppercase font-bold text-gray-500">
                                    <span>Total Value (USD)</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-[16px]">
                                <div className="bg-white/5 rounded-lg p-[16px] text-center ">
                                    <span className="text-[10px] text-gray-500 block mb-1">5 Min</span>
                                    <span className={`text-sm font-mono font-bold ${getPercentageColor(data.openInterest.change5m)}`}>
                                        {data.openInterest.change5m > 0 ? '+' : ''}{data.openInterest.change5m.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="bg-white/5 rounded-lg p-[16px] text-center ">
                                    <span className="text-[10px] text-gray-500 block mb-1">1 Hora</span>
                                    <span className={`text-sm font-mono font-bold ${getPercentageColor(data.openInterest.change1h)}`}>
                                        {data.openInterest.change1h > 0 ? '+' : ''}{data.openInterest.change1h.toFixed(2)}%
                                    </span>
                                </div>
                                <div className="bg-white/5 rounded-lg p-[16px] text-center ">
                                    <span className="text-[10px] text-gray-500 block mb-1">24 Horas</span>
                                    <span className={`text-sm font-mono font-bold ${getPercentageColor(data.openInterest.change24h)}`}>
                                        {data.openInterest.change24h > 0 ? '+' : ''}{data.openInterest.change24h.toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="text-[10px] font-bold uppercase text-gray-500 mb-2">Histórico 24h</div>
                        <OiChart history={data.openInterest.history} />
                    </div>

                </div>

                {/* ANALYTICAL SUMMARY & FOOTER */}
                <div className="bg-genesis-card  rounded-[10px] p-6 relative">
                     <div className="flex items-center gap-2 mb-3 text-genesis-accent">
                         <AlertOctagon size={16} />
                         <span className="text-xs font-bold uppercase tracking-widest">Análise de Open Interest (AI)</span>
                     </div>
                     <p className="text-sm text-gray-300 font-light leading-relaxed mb-6 border-genesis-accent pl-4">
                         {data.analysis.summary}
                     </p>
                     
                     <div className="mt-6 pt-6  text-center">
                        <p className="text-[10px] text-gray-500 font-sans max-w-4xl mx-auto leading-relaxed">
                            Este painel monitora o Open Interest Agregado, permitindo identificar a entrada ou saída de capital nos contratos futuros. O Open Interest mede a quantidade total de contratos em aberto. O aumento do OI sinaliza entrada de capital e possível tendência sustentável. A queda no OI indica realização de lucros ou fechamento de posições (limpeza de mercado). Use esta informação para medir o apetite de risco institucional.
                        </p>
                    </div>
                </div>
            </>
        ) : null}
    </div>
  );
};

export default OiLiquidationMonitor;
