
import React, { useState } from 'react';
import { Activity, Search, TrendingUp, TrendingDown, Minus, Zap, BarChart3, Globe, ShieldCheck } from 'lucide-react';
import { analyzeTrend, TrendResult } from '../services/trendService';

const TrendAnalyzer: React.FC = () => {
  const [asset, setAsset] = useState<'BTC' | 'ETH'>('BTC');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrendResult | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await analyzeTrend(asset);
      // Artificial delay for high-perf analysis feel
      setTimeout(() => {
        setResult(data);
        setLoading(false);
      }, 1200);
    } catch (e) {
      setLoading(false);
    }
  };

  const getMetricColor = (score: number) => {
    if (score > 0) return 'text-genesis-positive';
    if (score < 0) return 'text-genesis-negative';
    return 'text-gray-500';
  };

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex items-center gap-[16px] mb-10  pb-6">
          <div className="w-12 h-12 rounded-xl bg-genesis-accent/10 flex items-center justify-center border-genesis-accent/20 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
              <Activity size={24} className="text-genesis-accent" />
          </div>
          <div>
              <h1 className="text-2xl font-thin text-white tracking-[0.2em] uppercase">Qual Tendência?</h1>
              <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Motor de Confluência Institucional</p>
          </div>
      </div>

      {/* ASSET SELECTOR */}
      <div className="max-w-xl mx-auto w-full flex flex-col items-center gap-8 mb-12">
          <div className="flex gap-[16px] p-1.5 bg-white/5 rounded-2xl  w-full -inner">
              <button 
                  onClick={() => setAsset('BTC')}
                  className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${asset === 'BTC' ? 'bg-genesis-accent text-black shadow-[0_0_20px_rgba(139,92,246,0.3)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
              >
                  <img src="https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=025" className="w-5 h-5" alt="btc" />
                  Bitcoin
              </button>
              <button 
                  onClick={() => setAsset('ETH')}
                  className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${asset === 'ETH' ? 'bg-genesis-accent text-black shadow-[0_0_20px_rgba(139,92,246,0.3)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
              >
                  <img src="https://cryptologos.cc/logos/ethereum-eth-logo.png?v=025" className="w-5 h-5" alt="eth" />
                  Ethereum
              </button>
          </div>

          <button 
              onClick={handleSearch}
              disabled={loading}
              className="group relative px-16 py-5 bg-transparent border-genesis-accent text-genesis-accent hover:bg-genesis-accent hover:text-black transition-all duration-500 rounded-xl overflow-hidden disabled:opacity-50"
          >
              <div className="absolute inset-0 bg-genesis-accent/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center gap-3 font-bold text-sm uppercase tracking-[0.3em] relative z-10">
                  {loading ? (
                      <>
                          <div className="w-4 h-4 border-current border-t-transparent rounded-full animate-spin"></div>
                          CALCULANDO MATRIZ...
                      </>
                  ) : (
                      <>
                          <Search size={18} /> BUSCAR TENDÊNCIA
                      </>
                  )}
              </div>
          </button>
      </div>

      {/* RESULTS */}
      {result && !loading && (
          <div className="max-w-4xl mx-auto w-full space-y-8 animate-in slide-in- duration-700">
              
              {/* MAIN RESULT BOX */}
              <div className="bg-genesis-card  rounded-3xl p-10 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-1.5   primary  opacity-30"></div>
                  
                  <div className="flex flex-col md:flex-row items-center gap-10">
                      <div className="text-center md:text-left shrink-0">
                          <span className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.2em] block mb-3">Direção Institucional</span>
                          <div className={`text-6xl font-bold uppercase tracking-tighter flex items-center gap-[16px] ${
                              result.trend === 'Alta' ? 'text-genesis-positive ' : 
                              (result.trend === 'Baixa' ? 'text-genesis-negative drop--[0_0_15px_rgba(255,7,58,0.5)]' : 'text-gray-400')
                          }`}>
                              {result.trend === 'Alta' && <TrendingUp size={56} />}
                              {result.trend === 'Baixa' && <TrendingDown size={56} />}
                              {result.trend === 'Neutra' && <Minus size={56} />}
                              {result.trend}
                          </div>
                          <div className="mt-4 flex items-center gap-2">
                              <span className="text-[10px] font-mono text-gray-600 bg-white/5 px-2 py-1 rounded">SCORE AGREGADO: {result.score.toFixed(1)}</span>
                          </div>
                      </div>

                      <div className="flex-1 bg-black/60 rounded-2xl p-8  shadow-2xl relative">
                          <div className="absolute -top-3 -left-3 bg-genesis-accent text-black p-1.5 rounded-lg">
                              <Zap size={14} className="fill-current" />
                          </div>
                          <h4 className="text-genesis-accent text-[10px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                              Justificativa Técnica
                          </h4>
                          <p className="text-base text-gray-300 leading-loose font-light text-justify">
                              {result.justification}
                          </p>
                      </div>
                  </div>
              </div>

              {/* INDICATORS MINI GRID */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
                  {[
                      { label: 'CVD Aggression', val: result.metrics.cvd, icon: BarChart3 },
                      { label: 'Delta Volume', val: result.metrics.delta, icon: Activity },
                      { label: 'Open Interest', val: result.metrics.oi, icon: Zap },
                      { label: 'Funding Pressure', val: result.metrics.funding, icon: Globe },
                      { label: 'Book Imbalance', val: result.metrics.imbalance, icon: ShieldCheck },
                      { label: 'ATR/Volatility', val: result.metrics.volatility, icon: Activity },
                      { label: 'VWAP Position', val: result.metrics.vwap, icon: Search },
                      { label: 'Price Structure', val: result.metrics.structure, icon: TrendingUp },
                  ].map((m, i) => (
                      <div key={i} className="bg-genesis-card  p-5 rounded-2xl flex flex-col items-center gap-3 group/item hover: transition-all">
                          <div className="p-2 rounded-lg bg-white/5 text-gray-500 group-hover/item:text-genesis-accent transition-colors">
                              <m.icon size={16} />
                          </div>
                          <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest text-center">{m.label}</span>
                          <span className={`text-xs font-mono font-bold ${getMetricColor(m.val)}`}>
                              {m.val > 0 ? 'BULLISH' : (m.val < 0 ? 'BEARISH' : 'NEUTRAL')}
                          </span>
                          <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden flex">
                              <div 
                                  className={`h-full ${m.val > 0 ? 'bg-genesis-positive' : 'bg-genesis-negative'} transition-all duration-1000`} 
                                  style={{ width: `${Math.abs(m.val) * 50}%`, marginLeft: m.val < 0 ? 'auto' : '0' }}
                              />
                          </div>
                      </div>
                  ))}
              </div>

              {/* DISCLAIMER */}
              <div className="pt-6 opacity-30 text-center">
                  <p className="text-[9px] text-gray-500 font-mono uppercase tracking-[0.2em]">
                      Gênesis Matrix V1.4 • APIs: Binance, Bybit, OKX • Real-time confluency engine
                  </p>
              </div>

          </div>
      )}

    </div>
  );
};

export default TrendAnalyzer;
