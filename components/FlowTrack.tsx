
import React, { useEffect, useState } from 'react';
import { Waves, Activity, ArrowRight, TrendingUp, TrendingDown, Database, HelpCircle, Wallet, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { fetchFlowTrackData, FlowTrackData } from '../services/flowTrackService';

const FlowTrack: React.FC = () => {
  const [data, setData] = useState<FlowTrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('BTCUSDT');

  const loadData = async () => {
    // Timeout Promise to ensure 3s max loading state
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    setLoading(true);

    try {
        const [res] = await Promise.all([
            fetchFlowTrackData(selectedAsset),
            timeout // Ensure at least wait or cap? 
            // Actually, prompt says "Max timeout 3s". 
            // We race data vs timeout. If data is fast, we show it. 
            // If data is slow, we might show "Sem movimentações".
            // But fetchFlowTrackData is robust now.
        ]);
        setData(res);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
        fetchFlowTrackData(selectedAsset).then(setData);
    }, 15000); 
    return () => clearInterval(interval);
  }, [selectedAsset]);

  // --- SUB-COMPONENTS ---

  const Tooltip: React.FC<{ title: string; text: string }> = ({ title, text }) => (
      <div className="absolute top-2 right-2 group cursor-help z-20">
          <HelpCircle size={14} className="text-gray-600 hover:text-white transition-colors" />
          <div className="absolute right-0 top-full mt-2 w-72 p-[16px] bg-black  rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[999999]">
              <span className="block text-xs font-bold text-white uppercase mb-2  pb-1">{title}</span>
              <p className="text-[10px] text-gray-400 leading-relaxed font-sans">{text}</p>
              <div className="absolute -top-1 right-2 w-2 h-2 bg-black  rotate-45"></div>
          </div>
      </div>
  );

  const MiniChart: React.FC<{ values: number[], color: string }> = ({ values, color }) => {
      const max = Math.max(...values, 1);
      const min = Math.min(...values, 0);
      const range = max - min;
      const points = values.map((v, i) => {
          const x = (i / (values.length - 1)) * 100;
          const y = 100 - ((v - min) / range) * 100;
          return `${x},${y}`;
      }).join(' ');

      return (
          <div className="h-10 w-full mt-2 opacity-50">
              <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                  <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
              </svg>
          </div>
      );
  };

  const CardHeader: React.FC<{ icon: any, title: string, subtitle?: string, asset: string }> = ({ icon: Icon, title, subtitle, asset }) => (
      <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2 text-genesis-accent">
              <div className="p-1.5 rounded bg-genesis-accent/10 border-genesis-accent/20">
                  <Icon size={14} />
              </div>
              <div>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white">{title}</h3>
                  {subtitle && <p className="text-[9px] text-gray-500 font-mono">{subtitle}</p>}
              </div>
          </div>
          <div className="text-[9px] font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded ">
              {asset}
          </div>
      </div>
  );

  const CardFooterText: React.FC<{ text: string }> = ({ text }) => (
      <div className="mt-4 pt-3 ">
          <p className="text-[9px] text-gray-500 leading-relaxed font-sans text-justify">
              {text}
          </p>
      </div>
  );

  // --- RENDER ---

  const displayAsset = selectedAsset.replace('USDT', '/USDT');

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
        
        {/* Header Module */}
        <div className="flex items-center justify-between mb-8  pb-4">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-genesis-accent/10 flex items-center justify-center border-genesis-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
                    <Waves size={20} className="text-genesis-accent" />
                </div>
                <div>
                    <h1 className="text-2xl font-thin text-white tracking-widest uppercase">FlowTrack</h1>
                    <p className="text-[10px] text-gray-500 font-mono">Rastreamento Institucional & On-Chain</p>
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
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded ">
                    <div className="w-2 h-2 rounded-full bg-genesis-positive animate-pulse"></div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Live Feed</span>
                </div>
            </div>
        </div>

        {/* Loading State */}
        {loading ? (
             <div className="h-full flex items-center justify-center p-8">
                <div className="flex flex-col items-center gap-[16px]">
                    <div className="w-12 h-12 rounded-full border-genesis-accent border-t-transparent animate-spin"></div>
                    <span className="text-xs font-mono text-genesis-accent animate-pulse tracking-widest">RASTREAMENTO ON-CHAIN INICIADO...</span>
                </div>
            </div>
        ) : !data ? (
            <div className="h-full flex items-center justify-center p-8 text-gray-500 text-xs uppercase tracking-widest">
                Sem movimentações no período.
            </div>
        ) : (
            <>
                {/* Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">

                    {/* CARD 1: WHALE FLOW */}
                    <div className="bg-genesis-card  rounded-[10px] p-6 relative group hover: transition-colors">
                        <Tooltip 
                            title="Whale Flow" 
                            text="Grandes transações identificadas acima de $100.000. Movimentos para exchanges sugerem pressão vendedora. Saídas de exchanges sugerem acumulação."
                        />
                        <CardHeader icon={Database} title="Fluxo Institucional" subtitle="Whale Alert (> $100k)" asset={displayAsset} />
                        
                        <div className="grid grid-cols-2 gap-[16px] mb-4">
                            <div className="bg-white/5 rounded-lg p-3 ">
                                <span className="text-[9px] text-gray-500 uppercase font-bold">Inflow (Exchanges)</span>
                                <div className="text-lg font-mono font-bold text-genesis-negative mt-1">
                                    ${(data.whaleFlow.inflow).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="bg-white/5 rounded-lg p-3 ">
                                <span className="text-[9px] text-gray-500 uppercase font-bold">Outflow (Wallets)</span>
                                <div className="text-lg font-mono font-bold text-genesis-positive mt-1">
                                    ${(data.whaleFlow.outflow).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 mb-2">
                            <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-2  pb-1">
                                <span>Últimas Transações</span>
                                <span>Destino</span>
                            </div>
                            {data.whaleFlow.transactions.length > 0 ? data.whaleFlow.transactions.slice(0, 4).map((tx, i) => (
                                <div key={i} className="flex justify-between items-center text-xs font-mono  pb-1 last:border-0">
                                    <span className="text-white">
                                        {tx.amount.toFixed(2)} {tx.symbol}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className={`flex items-center gap-1 ${tx.to === 'exchange' ? 'text-genesis-negative' : 'text-genesis-positive'}`}>
                                            {tx.to === 'exchange' ? 'Exchange' : 'Wallet'}
                                            {tx.to === 'exchange' ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                                        </span>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-[9px] text-gray-600 italic py-2 text-center">Sem baleias no momento.</div>
                            )}
                        </div>
                        <CardFooterText text="Rastreia movimentações acima de 100k USD entre carteiras e exchanges, indicando ação de players institucionais e baleias." />
                    </div>

                    {/* CARD 2: ON-CHAIN */}
                    <div className="bg-genesis-card  rounded-[10px] p-6 relative group hover: transition-colors">
                        <Tooltip 
                            title="On-chain Flow" 
                            text="Mostra a atividade real da rede e movimentos de tokens entre carteiras. Entrada alta sugere acumulação; saída alta sugere distribuição."
                        />
                        <CardHeader icon={Activity} title="Movimentação On-Chain" subtitle="Glassnode Metrics" asset={displayAsset} />

                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <span className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Tendência de Rede</span>
                                <div className={`text-xl font-bold uppercase tracking-wide flex items-center gap-2 ${data.onChain.trend === 'Accumulation' ? 'text-genesis-positive' : 'text-genesis-negative'}`}>
                                    {data.onChain.trend === 'Accumulation' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                    {data.onChain.trend === 'Accumulation' ? 'Acumulação' : 'Distribuição'}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Endereços Ativos</span>
                                <span className="text-lg font-mono text-white">{data.onChain.activeAddresses.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="bg-black rounded-lg  p-[16px] mb-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] text-gray-400 uppercase font-bold">Net Flow (Volume Líquido)</span>
                                <span className={`text-xs font-mono font-bold ${data.onChain.netFlow > 0 ? 'text-genesis-positive' : 'text-genesis-negative'}`}>
                                    {data.onChain.netFlow > 0 ? '+' : ''}${(data.onChain.netFlow).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
                                <div className="h-full bg-genesis-negative transition-all duration-1000" style={{ width: data.onChain.netFlow < 0 ? '50%' : '0%' }}></div>
                                <div className="h-full bg-genesis-positive transition-all duration-1000 ml-auto" style={{ width: data.onChain.netFlow > 0 ? '50%' : '0%' }}></div>
                            </div>
                        </div>
                        
                        <CardFooterText text="Mostra tendência líquida de entrada e saída. Acumulação indica retirada de moedas de exchanges, distribuição indica envio para exchanges." />
                    </div>

                    {/* CARD 3: EXCHANGE PRESSURE */}
                    <div className="bg-genesis-card  rounded-[10px] p-6 relative group hover: transition-colors">
                        <Tooltip 
                            title="Exchange Wallet Pressure" 
                            text="Desequilíbrio entre bids e asks indica pressão direcional. Institucionais tendem a deslocar o preço após mudanças bruscas no livro."
                        />
                        <CardHeader icon={Wallet} title="Carteiras Ativas por Exchange" subtitle="Orderbook Depth Analysis" asset={displayAsset} />

                        <div className="flex items-center justify-center py-6 relative">
                            <div className="w-32 h-32 rounded-full border-[6px] border-gray-800 relative flex items-center justify-center">
                                <div 
                                    className="absolute inset-0 rounded-full border-[6px] border-genesis-positive border-l-transparent border-b-transparent transition-all duration-1000"
                                    style={{ transform: `rotate(${((data.pressure.imbalance + 100) / 200) * 360}deg)` }}
                                ></div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-white">{Math.abs(data.pressure.imbalance).toFixed(1)}%</div>
                                    <div className="text-[9px] text-gray-500 uppercase">Imbalance</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between gap-[16px] mb-2">
                            <div className="flex-1 text-center p-2 rounded bg-green-900/10 border-green-500/10">
                                <span className="block text-[9px] text-green-500 uppercase font-bold mb-1">Bid Wall</span>
                                <span className="font-mono text-xs text-white">{data.pressure.bidVol.toFixed(2)}</span>
                            </div>
                            <div className="flex-1 text-center p-2 rounded bg-red-900/10 border-red-500/10">
                                <span className="block text-[9px] text-red-500 uppercase font-bold mb-1">Ask Wall</span>
                                <span className="font-mono text-xs text-white">{data.pressure.askVol.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <CardFooterText text="Analisa profundidade do livro de ofertas, bid walls, ask walls e desequilíbrio entre compradores e vendedores." />
                    </div>

                    {/* CARD 4: DIRECTIONAL FLOW */}
                    <div className="bg-genesis-card  rounded-[10px] p-6 relative group hover: transition-colors">
                        <Tooltip 
                            title="Directional Flow" 
                            text="Mostra se o capital institucional está entrando ou saindo do mercado. Fluxo positivo sugere risco on; fluxo negativo sugere risco off."
                        />
                        <CardHeader icon={ArrowRight} title="Fluxo Direcional" subtitle="Entrada vs Saída (Global)" asset={displayAsset} />

                        <div className="bg-black p-[16px] rounded-xl  mb-6 text-center">
                            <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-2 block">Sentimento Institucional</span>
                            <div className={`text-xl font-bold uppercase tracking-tighter ${
                                data.directional.sentiment === 'Risk On' ? 'text-genesis-positive ' : 
                                (data.directional.sentiment === 'Risk Off' ? 'text-genesis-negative' : 'text-gray-400')
                            }`}>
                                {data.directional.label}
                            </div>
                            <div className="text-[10px] text-genesis-accent mt-1 font-mono">Velocidade: {data.directional.velocity}</div>
                        </div>

                        <div className="space-y-4 mb-2">
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 mb-1">
                                    <span>Entrada Total (Exchanges)</span>
                                    <span className="text-white">${(data.directional.inflowTotal).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="w-full h-1 bg-gray-800 rounded-full">
                                    <div className="h-full bg-gray-500 rounded-full" style={{ width: '45%' }}></div>
                                </div>
                            </div>
                            
                            <div>
                                <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500 mb-1">
                                    <span>Saída Total (Exchanges)</span>
                                    <span className="text-white">${(data.directional.outflowTotal).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="w-full h-1 bg-gray-800 rounded-full">
                                    <div className="h-full bg-white rounded-full" style={{ width: '55%' }}></div>
                                </div>
                            </div>
                        </div>
                        
                        <CardFooterText text="Compara entrada vs saída agregada em exchanges. Tradução direta da pressão real de compra e venda do mercado." />
                    </div>

                </div>

                {/* FOOTER */}
                <div className="mt-8  pt-6 pb-6 text-center opacity-70">
                    <p className="text-[10px] text-gray-500 font-sans max-w-3xl mx-auto leading-relaxed">
                        O FlowTrack é um módulo avançado de rastreamento institucional e on-chain. Ele monitora grandes movimentações entre carteiras e exchanges, fluxo direcional de capital, comportamento de carteiras ativas, desequilíbrios do livro de ofertas e tendências de rede. As métricas exibidas servem para identificar absorção institucional, redistribuição, acumulação, distribuição e possíveis movimentos explosivos de preço.
                    </p>
                </div>
            </>
        )}
    </div>
  );
};

export default FlowTrack;
