
import React, { useEffect, useState } from 'react';
import { Briefcase, Activity, TrendingUp, TrendingDown, HelpCircle, Info, Lock } from 'lucide-react';
import { fetchSmartMoneyData, SmartMoneyData } from '../services/smartMoneyService';

interface SmartMoneyProps {
  selectedPair: string;
}

const SmartMoney: React.FC<SmartMoneyProps> = ({ selectedPair }) => {
  const [data, setData] = useState<SmartMoneyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Helper to check valid pairs
  const isValidPair = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(selectedPair);

  const loadData = async () => {
    if (!isValidPair) return;
    
    setLoading(true);
    setError(false);
    try {
        const res = await fetchSmartMoneyData(selectedPair);
        setData(res);
    } catch (e) {
        setError(true);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (isValidPair) {
        loadData();
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);
    } else {
        setData(null);
    }
  }, [selectedPair]);

  const Tooltip: React.FC<{ title: string; text: string }> = ({ title, text }) => (
      <div className="absolute top-2 right-2 group cursor-help z-20">
          <HelpCircle size={14} className="text-gray-600 hover:text-white transition-colors" />
          <div className="absolute right-0 top-full mt-2 w-64 p-[16px] bg-black  rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[999999]">
              <span className="block text-xs font-bold text-white uppercase mb-2  pb-1">{title}</span>
              <p className="text-[10px] text-gray-400 leading-relaxed font-sans text-justify">{text}</p>
              <div className="absolute -top-1 right-2 w-2 h-2 bg-black  rotate-45"></div>
          </div>
      </div>
  );

  // BLOCKING SCREEN
  if (!isValidPair) {
      return (
          <div className="h-full flex flex-col items-center justify-center p-8 bg-black animate-in fade-in">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <Lock size={32} className="text-gray-500" />
              </div>
              <h2 className="text-xl text-white font-light tracking-widest uppercase mb-2">Acesso Restrito</h2>
              <p className="text-sm text-gray-500 font-mono">
                  Smart Money disponível apenas para BTC, ETH e SOL.
              </p>
          </div>
      );
  }

  if (loading && !data) {
      return (
        <div className="h-full flex items-center justify-center bg-black">
            <div className="flex flex-col items-center gap-[16px]">
                <div className="w-12 h-12 rounded-full border-genesis-accent border-t-transparent animate-spin"></div>
                <span className="text-xs font-mono text-genesis-accent animate-pulse tracking-widest">ANALISANDO FLUXO INSTITUCIONAL...</span>
            </div>
        </div>
      );
  }

  if (!data) return null;

  const isInstInflow = data.institutionalFlow.contractsChange > 0;
  const isDirBuy = data.directionalFlow.delta > 0;

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8  pb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-genesis-accent/10 flex items-center justify-center border-genesis-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                    <Briefcase size={20} className="text-genesis-accent" />
                </div>
                <div>
                    <h1 className="text-2xl font-thin text-white tracking-widest uppercase">Smart Money</h1>
                    <p className="text-[10px] text-gray-500 font-mono">Monitoramento Institucional: <span className="text-genesis-accent font-bold">{data.asset}</span></p>
                </div>
            </div>
            
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded ">
                <div className="w-2 h-2 rounded-full bg-genesis-positive animate-pulse"></div>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    Atualizado: {data.lastUpdate}
                </span>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
            
            {/* CARD 1: FLUXO INSTITUCIONAL */}
            <div className="bg-genesis-card  rounded-[10px] p-6 relative group hover: transition-colors">
                <Tooltip title="Fluxo Institucional" text={data.institutionalFlow.description} />
                
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-genesis-accent">
                        <Activity size={16} />
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">Fluxo Institucional</h3>
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded ">{data.asset}</span>
                </div>

                <div className="bg-black/40 rounded-[10px] p-[16px]  text-center mb-6">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-2">Status do Capital</span>
                    <div className={`text-sm font-bold uppercase tracking-wide px-3 py-1 rounded inline-block ${isInstInflow ? 'text-green-400 border-green-500/20 bg-green-900/10' : 'text-red-400 border-red-500/20 bg-red-900/10'}`}>
                        {data.institutionalFlow.status}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-xs font-mono text-gray-400  pb-2">
                        <span>Variação Contratos</span>
                        <span className={data.institutionalFlow.contractsChange > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                            {data.institutionalFlow.contractsChange > 0 ? '+' : ''}{data.institutionalFlow.contractsChange.toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex justify-between text-xs font-mono text-gray-400">
                        <span>Ratio (L/S)</span>
                        <span className="text-white font-bold">{data.institutionalFlow.longRatio.toFixed(1)}% L / {data.institutionalFlow.shortRatio.toFixed(1)}% S</span>
                    </div>
                </div>
            </div>

            {/* CARD 2: FLUXO DIRECIONAL */}
            <div className="bg-genesis-card  rounded-[10px] p-6 relative group hover: transition-colors">
                <Tooltip title="Fluxo Direcional" text={data.directionalFlow.description} />
                
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-genesis-accent">
                        {isDirBuy ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">Fluxo Direcional</h3>
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded ">{data.asset}</span>
                </div>

                <div className="bg-black/40 rounded-[10px] p-[16px]  text-center mb-6">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-2">Direção Agressiva</span>
                    <div className={`text-xs font-bold uppercase tracking-wide px-3 py-1 rounded inline-block ${
                        data.directionalFlow.status.includes('comprador') ? 'text-green-400 border-green-500/20 bg-green-900/10' : 
                        (data.directionalFlow.status.includes('vendedor') ? 'text-red-400 border-red-500/20 bg-red-900/10' : 'text-gray-400 border-gray-500/20')
                    }`}>
                        {data.directionalFlow.status}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-green-900/10 border-green-500/10 p-2 rounded text-center">
                        <span className="block text-[8px] text-green-500 uppercase font-bold">Compra Agressiva</span>
                        <span className="text-[10px] text-white font-mono font-bold">${(data.directionalFlow.buyVol / 1000000).toFixed(1)}M</span>
                    </div>
                    <div className="bg-red-900/10 border-red-500/10 p-2 rounded text-center">
                        <span className="block text-[8px] text-red-500 uppercase font-bold">Venda Agressiva</span>
                        <span className="text-[10px] text-white font-mono font-bold">${(data.directionalFlow.sellVol / 1000000).toFixed(1)}M</span>
                    </div>
                </div>
                
                <div className="text-center mt-2">
                    <span className="text-[9px] text-gray-500 uppercase">Delta Líquido: </span>
                    <span className={`text-[9px] font-mono font-bold ${data.directionalFlow.delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                         {data.directionalFlow.delta > 0 ? '+' : ''}${(data.directionalFlow.delta / 1000).toFixed(0)}k
                    </span>
                </div>
            </div>

            {/* CARD 3: ATIVIDADE INSTITUCIONAL */}
            <div className="bg-genesis-card  rounded-[10px] p-6 relative group hover: transition-colors">
                <Tooltip title="Atividade Institucional" text={data.activity.description} />
                
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-genesis-accent">
                        <Info size={16} />
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">Atividade Institucional</h3>
                    </div>
                    <span className="text-[9px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded ">{data.asset}</span>
                </div>

                 <div className="flex flex-col items-center justify-center py-6">
                    <div className="relative w-24 h-24 flex items-center justify-center">
                         <div className="absolute inset-0 rounded-full border-4 border-gray-800"></div>
                         <div 
                            className="absolute inset-0 rounded-full border-4 border-genesis-accent border-t-transparent border-l-transparent transition-all duration-1000"
                            style={{ transform: `rotate(${data.activity.score * 3.6}deg)` }}
                         ></div>
                         <div className="text-center">
                             <div className="text-2xl font-bold text-white">{data.activity.score.toFixed(0)}</div>
                             <div className="text-[8px] text-gray-500 uppercase font-bold">Score</div>
                         </div>
                    </div>
                    <div className="mt-4 text-center">
                        <span className="text-[9px] text-gray-500 uppercase font-bold block">Intensidade</span>
                        <span className={`text-sm font-bold uppercase ${data.activity.intensity === 'Alta' ? 'text-genesis-negative' : 'text-white'}`}>
                            {data.activity.intensity}
                        </span>
                    </div>
                 </div>
            </div>

        </div>

        {/* Footer */}
        <div className="mt-auto  pt-6 text-center opacity-70">
            <p className="text-[10px] text-gray-500 font-sans max-w-4xl mx-auto leading-relaxed">
                Smart Money identifica o comportamento institucional através da análise de contratos futuros, fluxo direcional de ordens e posicionamento líquido em mercados regulados. Ele revela quando grandes players estão entrando, saindo ou revertendo tendência.
            </p>
        </div>
    </div>
  );
};

export default SmartMoney;
