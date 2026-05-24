
import React, { useEffect, useState } from 'react';
import { Percent, TrendingUp, TrendingDown, Minus, Info, Clock, HelpCircle } from 'lucide-react';
import { fetchFundingMonitorData, FundingData } from '../services/fundingMonitorService';

const FundingMonitor: React.FC = () => {
  const [data, setData] = useState<FundingData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchFundingMonitorData();
      setData(res);
    } catch (e) {
      console.error("Funding Monitor Error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, []);

  const getLogoUrl = (sym: string) => {
      const clean = sym.replace('USDT', '').toLowerCase();
      return `https://cryptologos.cc/logos/${clean === 'sol' ? 'solana-sol' : (clean === 'eth' ? 'ethereum-eth' : 'bitcoin-btc')}-logo.png?v=025`;
  };

  const formatRate = (val: number) => `${(val * 100).toFixed(4)}%`;

  const Tooltip: React.FC<{ title: string; text: string }> = ({ title, text }) => (
      <div className="absolute top-2 right-2 group cursor-help z-20">
          <HelpCircle size={14} className="text-gray-600 hover:text-white transition-colors" />
          <div className="absolute right-0 top-full mt-2 w-64 p-[16px] bg-black  rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[999999]">
              <span className="block text-xs font-bold text-white uppercase mb-2  pb-1">{title}</span>
              <p className="text-[10px] text-gray-400 leading-relaxed font-sans">{text}</p>
              <div className="absolute -top-1 right-2 w-2 h-2 bg-black  rotate-45"></div>
          </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8  pb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-genesis-accent/10 flex items-center justify-center border-genesis-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                    <Percent size={20} className="text-genesis-accent" />
                </div>
                <div>
                    <h1 className="text-2xl font-thin text-white tracking-widest uppercase">Funding Monitor</h1>
                    <p className="text-[10px] text-gray-500 font-mono">Monitoramento de Taxas em Tempo Real</p>
                </div>
            </div>
            
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded ">
                <Clock size={12} className="text-gray-400" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Update: {data.length > 0 ? new Date(data[0].lastUpdate).toLocaleTimeString() : '--:--:--'}
                </span>
            </div>
        </div>

        {/* Loading State */}
        {loading && data.length === 0 ? (
             <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-[16px]">
                    <div className="w-12 h-12 rounded-full border-genesis-accent border-t-transparent animate-spin"></div>
                    <span className="text-xs font-mono text-genesis-accent animate-pulse tracking-widest">COLETANDO TAXAS...</span>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8">
                {data.map((item) => {
                    const isPositive = item.averageCurrent > 0;
                    const trendColor = item.trend === 'Rising' ? 'text-genesis-positive' : (item.trend === 'Falling' ? 'text-genesis-negative' : 'text-gray-500');
                    const trendIcon = item.trend === 'Rising' ? <TrendingUp size={16} /> : (item.trend === 'Falling' ? <TrendingDown size={16} /> : <Minus size={16} />);

                    return (
                        <div key={item.symbol} className="bg-genesis-card  rounded-[10px] p-6 relative group hover: transition-colors shadow-lg">
                            <Tooltip 
                                title={`Funding ${item.symbol.replace('USDT','')}`}
                                text="Taxa média agregada das exchanges. Positiva indica compradores pagando vendedores (Viés de Alta). Negativa indica vendedores pagando compradores (Viés de Baixa)."
                            />
                            
                            {/* Card Header */}
                            <div className="flex items-center gap-3 mb-6">
                                <img src={getLogoUrl(item.symbol)} alt={item.symbol} className="w-8 h-8 rounded-full bg-white/5 p-1" />
                                <div>
                                    <h3 className="text-sm font-bold text-white tracking-wide">{item.symbol.replace('USDT', '/USDT')}</h3>
                                    <span className="text-[9px] text-gray-500 font-mono uppercase">Perpetual Futures</span>
                                </div>
                            </div>

                            {/* Main Rate */}
                            <div className="text-center mb-6 bg-black/40 rounded-[10px] p-[16px] ">
                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Funding Rate Atual (Média)</span>
                                <div className={`text-3xl font-mono font-bold tracking-tighter ${isPositive ? 'text-genesis-positive ' : 'text-genesis-negative'}`}>
                                    {formatRate(item.averageCurrent)}
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-4 gap-2 mb-6">
                                <div className="text-center p-2 rounded bg-white/5 ">
                                    <div className="text-[8px] text-gray-500 uppercase font-bold mb-1">Binance</div>
                                    <div className={`text-[10px] font-mono font-bold ${item.currentRates.binance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatRate(item.currentRates.binance)}
                                    </div>
                                </div>
                                <div className="text-center p-2 rounded bg-white/5 ">
                                    <div className="text-[8px] text-gray-500 uppercase font-bold mb-1">Bybit</div>
                                    <div className={`text-[10px] font-mono font-bold ${item.currentRates.bybit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatRate(item.currentRates.bybit)}
                                    </div>
                                </div>
                                <div className="text-center p-2 rounded bg-white/5 ">
                                    <div className="text-[8px] text-gray-500 uppercase font-bold mb-1">Bitget</div>
                                    <div className={`text-[10px] font-mono font-bold ${item.currentRates.bitget > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatRate(item.currentRates.bitget)}
                                    </div>
                                </div>
                                <div className="text-center p-2 rounded bg-white/5 ">
                                    <div className="text-[8px] text-gray-500 uppercase font-bold mb-1">OKX</div>
                                    <div className={`text-[10px] font-mono font-bold ${item.currentRates.okx > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatRate(item.currentRates.okx)}
                                    </div>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="flex justify-between items-center pt-4 ">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] text-gray-500 uppercase font-bold">Média 24h</span>
                                    <span className="text-xs text-white font-mono">{formatRate(item.average24h)}</span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[9px] text-gray-500 uppercase font-bold">Tendência</span>
                                    <div className={`flex items-center gap-1 text-xs font-bold uppercase ${trendColor}`}>
                                        {trendIcon}
                                        {item.trend === 'Rising' ? 'Subindo' : (item.trend === 'Falling' ? 'Caindo' : 'Estável')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* Footer Pedagogico */}
        <div className="mt-auto pt-8  text-center">
            <div className="flex items-center justify-center gap-2 mb-4 text-genesis-accent opacity-80">
                <Info size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Guia de Interpretação</span>
            </div>
            <p className="text-[10px] text-gray-500 font-sans max-w-4xl mx-auto leading-relaxed text-justify md:text-center">
                Funding Rate é a taxa periódica paga entre compradores e vendedores no mercado futuro perpétuo. Funding positivo indica que o mercado está pressionando para cima, com traders comprando agressivamente e pagando taxa. Funding negativo indica pressão de venda ou busca por proteção. Mudanças bruscas no funding podem sinalizar momentos de desequilíbrio, possíveis squeezes e reversões de curto prazo.
            </p>
            <div className="flex justify-center gap-8 mt-6 opacity-60">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-genesis-positive"></div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Taxa {'>'} 0: Longs pagam Shorts</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-genesis-negative"></div>
                    <span className="text-[9px] text-gray-400 font-bold uppercase">Taxa {'<'} 0: Shorts pagam Longs</span>
                 </div>
            </div>
        </div>

    </div>
  );
};

export default FundingMonitor;
