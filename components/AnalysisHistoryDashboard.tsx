import React, { useState, useEffect, useMemo } from 'react';
import { SavedAnalysis } from '../types';
import { Trash2, TrendingUp, TrendingDown, Target, Clock, Filter, Activity, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { fetchHistoricoAnalises } from '../services/api';

const LOCAL_STORAGE_KEY = 'genesis_analysis_history';

export const saveAnalysisToHistory = (analysis: SavedAnalysis) => {
  try {
    const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
    const history: SavedAnalysis[] = existing ? JSON.parse(existing) : [];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([analysis, ...history]));
    window.dispatchEvent(new Event('analysis_history_updated'));
  } catch (error) {
    console.error('Failed to save analysis to history', error);
  }
};

const AnalysisHistoryDashboard: React.FC = () => {
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [filterTF, setFilterTF] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadHistory = async () => {
    try {
      const data = await fetchHistoricoAnalises();
      if (data.data && data.data.length > 0) {
        const serverHistory = data.data.map((row: any) => ({
          id: row.id.toString(),
          timestamp: row.created_at || row.criado_em,
          symbol: row.ativo,
          interval: row.timeframe,
          direction: row.direcao === 'SHORT' ? 'SHORT' : 'LONG',
          score: row.score,
          rsi: 0,
          ema200: 0,
          adx: 0,
          entry_price: 0,
          target_price: parseFloat(row.take_profit_1) || 0,
          stop_loss: parseFloat(row.stop_loss) || 0,
          status: row.resultado === 'PENDENTE' ? 'PENDENTE' : (row.resultado?.includes('TP') ? 'ACERTOU' : 'ERROU')
        }));
        setHistory(serverHistory);
        return;
      }
    } catch (error) {
      console.warn("Erro ao buscar historico do servidor. Usando fallback local.", error);
    }
    
    // Fallback para cache local
    try {
      const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (existing) {
        setHistory(JSON.parse(existing));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadHistory();
    const handleUpdate = () => loadHistory();
    window.addEventListener('analysis_history_updated', handleUpdate);
    return () => window.removeEventListener('analysis_history_updated', handleUpdate);
  }, []);

  // Auto-monitoramento de preços para fechar análises (sem custo Gemini)
  useEffect(() => {
    const checkPrices = async () => {
      // Find all symbols that are still pending
      const pendingAnalyses = history.filter(h => h.status === 'PENDENTE');
      if (pendingAnalyses.length === 0) return;

      const symbols = [...new Set(pendingAnalyses.map(h => h.symbol.replace('/', '').toUpperCase()))];
      
      try {
        // Fetch current prices from Binance public API (100% free, no Gemini used)
        const response = await fetch('https://api.binance.com/api/v3/ticker/price');
        if (!response.ok) return;
        const data = await response.json();
        
        const priceMap: Record<string, number> = {};
        data.forEach((item: {symbol: string, price: string}) => {
          priceMap[item.symbol] = parseFloat(item.price);
        });

        let updated = false;
        const newHistory = [...history];

        newHistory.forEach(analysis => {
          if (analysis.status !== 'PENDENTE') return;

          const symbol = analysis.symbol.replace('/', '').toUpperCase();
          const currentPrice = priceMap[symbol];
          
          if (!currentPrice || currentPrice <= 0) return;

          if (analysis.direction === 'LONG') {
             if (analysis.target_price > 0 && currentPrice >= analysis.target_price) {
                analysis.status = 'ACERTOU';
                updated = true;
             } else if (analysis.stop_loss > 0 && currentPrice <= analysis.stop_loss) {
                analysis.status = 'ERROU';
                updated = true;
             }
          } else if (analysis.direction === 'SHORT') {
             if (analysis.target_price > 0 && currentPrice <= analysis.target_price) {
                analysis.status = 'ACERTOU';
                updated = true;
             } else if (analysis.stop_loss > 0 && currentPrice >= analysis.stop_loss) {
                analysis.status = 'ERROU';
                updated = true;
             }
          }
        });

        if (updated) {
           setHistory(newHistory);
           localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newHistory));
           window.dispatchEvent(new Event('analysis_history_updated'));
        }

      } catch (err) {
         console.warn("Failed to auto-check prices for history:", err);
      }
    };

    // Check every 15 seconds
    const intervalId = setInterval(checkPrices, 15000);
    checkPrices(); // Initial check
    
    return () => clearInterval(intervalId);
  }, [history]);


  const updateStatus = (id: string, newStatus: 'ACERTOU' | 'ERROU') => {
    const updatedHistory = history.map(item => 
      item.id === id ? { ...item, status: newStatus } : item
    );
    setHistory(updatedHistory);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    if (confirm("Tem certeza que deseja apagar todo o histórico de análises?")) {
      setHistory([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const completed = history.filter(h => h.status === 'ACERTOU' || h.status === 'ERROU');
    const hits = completed.filter(h => h.status === 'ACERTOU').length;
    const total = completed.length;
    const winRate = total > 0 ? (hits / total) * 100 : 0;

    const tfStats = completed.reduce((acc, curr) => {
      if (!acc[curr.interval]) acc[curr.interval] = { total: 0, hits: 0 };
      acc[curr.interval].total += 1;
      if (curr.status === 'ACERTOU') acc[curr.interval].hits += 1;
      return acc;
    }, {} as Record<string, { total: number; hits: number }>);

    let bestTf = '-';
    let bestTfRate = 0;

    Object.entries(tfStats).forEach(([tf, stats]) => {
      const s = stats as { total: number; hits: number };
      const rate = (s.hits / s.total) * 100;
      if (rate > bestTfRate || (rate === bestTfRate && s.total > ((tfStats[bestTf] as {total:number})?.total || 0))) {
        bestTfRate = rate;
        bestTf = tf;
      }
    });

    return { total: history.length, completedTotal: total, hits, winRate, tfStats, bestTf, bestTfRate };
  }, [history]);

  // Filtering
  const filteredHistory = useMemo(() => {
    let result = history;
    if (filterSymbol) result = result.filter(h => h.symbol.toLowerCase().includes(filterSymbol.toLowerCase()));
    if (filterTF) result = result.filter(h => h.interval === filterTF);
    if (filterStatus) result = result.filter(h => h.status === filterStatus);
    return result;
  }, [history, filterSymbol, filterTF, filterStatus]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const currentData = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // DEV - CONECTAR: Esta seção depende do resultVerifierService estar ativo no servidor.
  const [sysStats, setSysStats] = useState<any>(null);
  useEffect(() => {
      const loadSysStats = async () => {
          try {
              const res = await fetch('/api/estatisticas-sistema', {
                  headers: { 'authorization': `Bearer ${localStorage.getItem('genesis_token')}` }
              });
              if (res.ok) {
                  const json = await res.json();
                  if (json.success) setSysStats(json.data);
              }
          } catch(e) {
              console.warn("Erro ao buscar estatisticas-sistema", e);
          }
      };
      loadSysStats();
  }, []);

  return (
    <div className="flex flex-col gap-6 pb-10">

      {/* DASHBOARD SECTION EXCL. ESTATISTICAS */}
      {sysStats && (
        <div className="bg-[#0a0a0f] border border-white/5 p-6 rounded-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute -right-10 -top-10 opacity-5">
             <Target size={200} className="text-genesis-positive" />
          </div>
          <h2 className="text-[12px] font-bold text-white uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Activity size={16} className="text-genesis-accent" /> Estatísticas do Sistema (Últimos 30 dias)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
             <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Taxa de Acerto Geral</span>
                <span className="text-3xl font-mono text-genesis-positive">{sysStats.taxaAcertoGeral.toFixed(1)}%</span>
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Risco:Retorno Médio</span>
                <span className="text-xl font-mono text-white mt-1">{sysStats.rrMedio > 0 ? sysStats.rrMedio.toFixed(2) : 'N/A'}</span>
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Melhor Sequência</span>
                <span className="text-xl font-mono text-white mt-1">{sysStats.melhorSequencia} acertos</span>
             </div>
             <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Total de Análises</span>
                <span className="text-xl font-mono text-white mt-1">{sysStats.totalAnalises} / {sysStats.totalResolvidas} Resolvidas</span>
             </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
             <div className="text-center">
                <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">TP1</div>
                <div className="text-sm font-mono text-white">{sysStats.tp1Pct.toFixed(1)}%</div>
             </div>
             <div className="text-center">
                <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">TP2</div>
                <div className="text-sm font-mono text-white">{sysStats.tp2Pct.toFixed(1)}%</div>
             </div>
             <div className="text-center">
                <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">TP3</div>
                <div className="text-sm font-mono text-white">{sysStats.tp3Pct.toFixed(1)}%</div>
             </div>
             <div className="text-center">
                <div className="text-[9px] text-red-500/70 uppercase font-bold tracking-widest">STOP</div>
                <div className="text-sm font-mono text-red-500/90">{sysStats.stopPct.toFixed(1)}%</div>
             </div>
          </div>
        </div>
      )}
      
      {/* DASHBOARD SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[16px]">
        
        {/* Total Metric */}
        <div className="bg-genesis-input rounded-[8px] p-[12px_14px]   rounded-[10px] p-[16px] shadow-lg flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2 opacity-70">
              <Activity size={18} className="text-gray-400" />
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total de Análises</h3>
            </div>
            <div className="text-3xl font-mono text-white mt-1">{metrics.total}</div>
            <div className="text-[10px] text-gray-500 mt-2 font-mono">{metrics.completedTotal} avaliadas</div>
        </div>

        {/* Win Rate */}
        <div className="bg-genesis-input rounded-[8px] p-[12px_14px]   rounded-[10px] p-[16px] shadow-lg flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -right-4 -top-[16px] opacity-5">
               <Target size={100} className="text-genesis-positive" />
            </div>
            <div className="flex items-center gap-3 mb-2 opacity-70">
              <Target size={18} className="text-genesis-positive" />
              <h3 className="text-[10px] font-bold text-genesis-positive uppercase tracking-widest">Taxa de Acerto</h3>
            </div>
            <div className="text-3xl font-mono text-white mt-1">
               {metrics.winRate.toFixed(1)}<span className="text-xl text-gray-500">%</span>
            </div>
            <div className="text-[10px] text-gray-500 mt-2 font-mono">{metrics.hits} acertos de {metrics.completedTotal}</div>
        </div>

        {/* Best Timeframe */}
        <div className="bg-genesis-input rounded-[8px] p-[12px_14px]   rounded-[10px] p-[16px] shadow-lg flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2 opacity-70">
              <Clock size={18} className="text-genesis-accent" />
              <h3 className="text-[10px] font-bold text-genesis-accent uppercase tracking-widest">Melhor Timeframe</h3>
            </div>
            <div className="text-3xl font-mono text-white mt-1">{metrics.bestTf}</div>
            <div className="text-[10px] text-gray-500 mt-2 font-mono">
               {metrics.bestTf !== '-' ? `${metrics.bestTfRate.toFixed(1)}% de acerto` : 'Aguardando dados'}
            </div>
        </div>

        {/* TF Breakdown */}
        <div className="bg-genesis-input rounded-[8px] p-[12px_14px]   rounded-[10px] p-[16px] shadow-lg overflow-y-auto max-h-[140px] custom-scrollbar">
            <h3 className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-3 sticky top-0 bg-[#050505]/90 py-1">Performance por TF</h3>
            <div className="space-y-3">
               {Object.entries(metrics.tfStats)
                   .sort((a,b) => (b[1] as any).total - (a[1] as any).total)
                   .map(([tf, stats]) => {
                  const s = stats as { hits: number, total: number };
                  const r = (s.hits / s.total) * 100;
                  return (
                    <div key={tf} className="flex flex-col gap-1">
                       <div className="flex justify-between items-center text-xs font-mono">
                         <span className="text-white bg-white/5 px-2 rounded-sm">{tf}</span>
                         <span className={r >= 50 ? 'text-genesis-positive' : 'text-red-400'}>{r.toFixed(0)}%</span>
                       </div>
                       <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                          <div 
                             className={`h-full ${r >= 50 ? 'bg-genesis-positive' : 'bg-red-500'}`} 
                             style={{ width: `${r}%` }}
                          />
                       </div>
                    </div>
                  );
               })}
               {Object.keys(metrics.tfStats).length === 0 && (
                  <div className="text-xs text-gray-600 font-mono text-center mt-4">Sem dados</div>
               )}
            </div>
        </div>
      </div>

      {/* HISTORY TABLE SECTION */}
      <div className="bg-genesis-input rounded-[8px] p-[12px_14px]   rounded-[10px] p-[16px] shadow-2xl flex flex-col flex-1">
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-[16px]">
             <div className="flex items-center gap-3">
                <Clock className="text-gray-400" size={20} />
                <h2 className="text-lg font-light text-white tracking-widest uppercase">Histórico de Análises</h2>
             </div>

             <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                 <div className="flex items-center bg-black  rounded-lg px-3 py-2">
                    <Filter size={14} className="text-gray-500 mr-2" />
                    <input 
                       type="text" 
                       placeholder="Ativo (ex: BTC)" 
                       value={filterSymbol}
                       onChange={(e) => setFilterSymbol(e.target.value)}
                       className="bg-transparent border-none text-xs text-white focus:outline-none w-24 font-mono uppercase"
                    />
                 </div>
                 <select 
                    value={filterTF} 
                    onChange={(e) => setFilterTF(e.target.value)}
                    className="bg-black  rounded-lg px-3 py-2.5 text-xs text-gray-400 focus:outline-none focus:border-genesis-accent transition-colors appearance-none"
                 >
                    <option value="">Todos TF</option>
                    <option value="15m">15m</option>
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                    <option value="1d">1d</option>
                 </select>
                 <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-black  rounded-lg px-3 py-2.5 text-xs text-gray-400 focus:outline-none focus:border-genesis-accent transition-colors appearance-none"
                 >
                    <option value="">Todo Status</option>
                    <option value="PENDENTE">Pendente</option>
                    <option value="ACERTOU">Acertou</option>
                    <option value="ERROU">Errou</option>
                 </select>

                 <button 
                    onClick={clearHistory}
                    className="bg-red-900/10 hover:bg-red-900/30 text-red-500 border-red-900/20 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors uppercase ml-auto md:ml-2"
                 >
                    <Trash2 size={14} /> <span className="hidden sm:inline">Limpar</span>
                 </button>
             </div>
         </div>

         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className=" text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                     <th className="py-4 px-2 tracking-widest whitespace-nowrap">Data / Hora</th>
                     <th className="py-4 px-2 tracking-widest text-center">Ativo</th>
                     <th className="py-4 px-2 tracking-widest text-center">TF</th>
                     <th className="py-4 px-2 tracking-widest text-center">Direção</th>
                     <th className="py-4 px-2 tracking-widest text-center">Entrada</th>
                     <th className="py-4 px-2 tracking-widest text-center">Alvo</th>
                     <th className="py-4 px-2 tracking-widest text-center">Score</th>
                     <th className="py-4 px-2 tracking-widest text-center">Status</th>
                     <th className="py-4 px-2 tracking-widest text-right">Resultado</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {currentData.length === 0 ? (
                     <tr>
                        <td colSpan={9} className="py-12 text-center">
                           <div className="flex flex-col items-center justify-center text-gray-600">
                               <AlertCircle size={32} className="mb-3 opacity-50" />
                               <span className="text-xs uppercase tracking-widest font-bold">Nenhum registro encontrado</span>
                               <span className="text-[10px] mt-1 font-mono">As análises ficarão salvas aqui.</span>
                           </div>
                        </td>
                     </tr>
                  ) : (
                     currentData.map((item) => {
                        const dateObj = new Date(item.timestamp);
                        const dateStr = `${dateObj.getDate().toString().padStart(2,'0')}/${(dateObj.getMonth()+1).toString().padStart(2,'0')} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
                        
                        return (
                           <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                              <td className="py-4 px-2 text-xs text-gray-500 font-mono whitespace-nowrap">{dateStr}</td>
                              <td className="py-4 px-2 text-xs font-bold text-white text-center tracking-wider">{item.symbol.replace('USDT', '')}</td>
                              <td className="py-4 px-2 text-xs text-gray-400 font-mono text-center bg-black/40 rounded">{item.interval}</td>
                              <td className="py-4 px-2 text-center flex justify-center mt-[10px]">
                                 <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide flex items-center justify-center gap-1 w-fit ${item.direction === 'LONG' ? 'border-green-500/30 text-green-400 bg-green-500/5' : 'border-red-500/30 text-red-400 bg-red-500/5'}`}>
                                    {item.direction === 'LONG' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                    {item.direction}
                                 </span>
                              </td>
                              <td className="py-4 px-2 text-[11px] font-mono text-gray-400 text-center">{item.entry_price ? item.entry_price.toLocaleString() : '-'}</td>
                              <td className="py-4 px-2 text-[11px] font-mono text-gray-400 text-center">{item.target_price ? item.target_price.toLocaleString() : '-'}</td>
                              <td className="py-4 px-2 text-center">
                                 <span className="text-xs font-mono font-bold text-genesis-accent">{item.score}/100</span>
                              </td>
                              <td className="py-4 px-2 text-center">
                                 {item.status === 'PENDENTE' ? (
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-yellow-500 border-yellow-500/30 px-2 py-1 rounded bg-yellow-500/5">Pendente</span>
                                 ) : item.status === 'ACERTOU' ? (
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-genesis-positive border-genesis-positive/30 px-2 py-1 rounded bg-genesis-positive/5">Acertou</span>
                                 ) : (
                                    <span className="text-[10px] font-bold tracking-widest uppercase text-red-500 border-red-500/30 px-2 py-1 rounded bg-red-500/5">Errou</span>
                                 )}
                              </td>
                              <td className="py-4 px-2 text-right">
                                  <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-50 group-hover:opacity-100 transition-opacity">
                                      {item.status !== 'ACERTOU' && (
                                          <button 
                                            onClick={() => updateStatus(item.id, 'ACERTOU')}
                                            title="Marcar como ACERTO"
                                            className="p-1.5 rounded bg-black border-green-500/20 text-gray-500 hover:text-green-400 hover:border-green-500/50 hover:bg-green-500/10 transition-all"
                                          >
                                              <CheckCircle size={16} />
                                          </button>
                                      )}
                                      {item.status !== 'ERROU' && (
                                          <button 
                                            onClick={() => updateStatus(item.id, 'ERROU')}
                                            title="Marcar como ERRO"
                                            className="p-1.5 rounded bg-black border-red-500/20 text-gray-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 transition-all"
                                          >
                                              <XCircle size={16} />
                                          </button>
                                      )}
                                  </div>
                              </td>
                           </tr>
                        );
                     })
                  )}
               </tbody>
            </table>
         </div>

         {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between  pt-4">
               <div className="text-[10px] text-gray-500 font-mono">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, filteredHistory.length)} de {filteredHistory.length}
               </div>
               <div className="flex items-center gap-2">
                  <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="px-3 py-1.5 rounded bg-black  text-xs text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white transition-colors"
                  >
                     Anterior
                  </button>
                  <div className="text-xs text-genesis-accent font-mono bg-genesis-accent/10 px-3 py-1.5 rounded border-genesis-accent/20">
                     {currentPage} / {totalPages}
                  </div>
                  <button 
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages}
                     className="px-3 py-1.5 rounded bg-black  text-xs text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 hover:text-white transition-colors"
                  >
                     Próximo
                  </button>
               </div>
            </div>
         )}
      </div>

    </div>
  );
};

export default AnalysisHistoryDashboard;
