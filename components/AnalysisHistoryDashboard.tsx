import React, { useState, useEffect, useMemo } from 'react';
import { SavedAnalysis } from '../types';
import { Trash2, TrendingUp, TrendingDown, Target, Clock, Filter, Activity, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { fetchHistoricoAnalises, storeAnalise, updateResultadoAnalise, deleteAllAnalises, fetchEstatisticas, fetchPrice } from '../services/api';

// Salva análise via API — sem localStorage
// Aceita dados extras opcionais para enviar campos completos ao servidor
export const saveAnalysisToHistory = async (analysis: SavedAnalysis, extraData?: Record<string, any>): Promise<string | null> => {
  try {
    const response = await storeAnalise({
      ativo: analysis.symbol,
      timeframe: analysis.interval,
      direcao: analysis.direction,
      score: analysis.score,
      stop_loss: analysis.stop_loss,
      take_profit_1: analysis.target_price,
      ...extraData,
    });
    window.dispatchEvent(new Event('analysis_history_updated'));
    // Return the server-generated analysis ID if available
    const serverId = response?.data?.id || response?.id;
    if (!serverId) {
      console.warn('[saveAnalysisToHistory] API não retornou ID. Response:', JSON.stringify(response));
    }
    return serverId ? String(serverId) : null;
  } catch (error) {
    console.error('Falha ao salvar análise via API', error);
    return null;
  }
};

const AnalysisHistoryDashboard: React.FC = () => {
  const [history, setHistory] = useState<SavedAnalysis[]>([]);
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [filterTF, setFilterTF] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Carrega histórico exclusivamente do servidor (MySQL)
  const loadHistory = async () => {
    try {
      const data = await fetchHistoricoAnalises();
      if (data.data && data.data.length > 0) {
        const serverHistory = data.data.map((row: any) => {
          // Fallback: extrair entrada do setup_entrada JSON se campo entrada/plano_a vazio
          let entryPrice = parseFloat(row.entrada) || parseFloat(row.plano_a) || 0;
          if (entryPrice === 0 && row.setup_entrada) {
            try {
              const setupJson = JSON.parse(row.setup_entrada);
              entryPrice = parseFloat(setupJson.entrada) || 0;
            } catch (_) {}
          }

          return {
            id: row.id.toString(),
            timestamp: row.created_at || row.criado_em,
            symbol: row.ativo,
            interval: row.timeframe,
            direction: row.direcao === 'SHORT' ? 'SHORT' : 'LONG',
            score: row.score,
            rsi: 0,
            ema200: 0,
            adx: 0,
            entry_price: entryPrice,
            target_price: parseFloat(row.take_profit_1) || 0,
            target_price2: parseFloat(row.take_profit_2) || 0,
            target_price3: parseFloat(row.take_profit_3) || 0,
            stop_loss: parseFloat(row.stop_loss) || 0,
            status: row.resultado === 'PENDENTE' ? 'PENDENTE' : (row.resultado?.includes('TP') ? 'ACERTOU' : 'ERROU')
          };
        });
        setHistory(serverHistory);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error("Erro ao buscar histórico do servidor.", error);
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
    const handleUpdate = () => loadHistory();
    window.addEventListener('analysis_history_updated', handleUpdate);
    return () => window.removeEventListener('analysis_history_updated', handleUpdate);
  }, []);

  // Estado de progresso percentual para cada análise pendente
  const [progressMap, setProgressMap] = useState<Record<string, { tp1: number; tp2: number; tp3: number; stop: number }>>({});

  // Função utilitária: clamp entre 0 e 100
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  // Calcula progresso percentual de um alvo
  const calcProgress = (direction: string, entryPrice: number, currentPrice: number, targetPrice: number): number => {
    if (targetPrice === entryPrice || targetPrice <= 0 || entryPrice <= 0) return 0;
    if (direction === 'LONG') {
      return clamp(((currentPrice - entryPrice) / (targetPrice - entryPrice)) * 100, 0, 100);
    }
    // SHORT
    return clamp(((entryPrice - currentPrice) / (entryPrice - targetPrice)) * 100, 0, 100);
  };

  // Auto-monitoramento de preços via proxy do servidor (sem chamada direta a exchanges)
  useEffect(() => {
    let cancelled = false;

    const checkPrices = async () => {
      // Busca análises pendentes
      const pendingAnalyses = history.filter((h: SavedAnalysis) => h.status === 'PENDENTE');
      if (pendingAnalyses.length === 0) return;

      // Símbolos únicos para consultar
      const uniqueSymbols = Array.from(new Set<string>(pendingAnalyses.map((h: SavedAnalysis) => h.symbol.replace('/', '').toUpperCase())));

      // Busca preços via proxy do servidor (GET /api/price/:symbol)
      const priceMap: Record<string, number> = {};
      await Promise.all(
        uniqueSymbols.map(async (symbol) => {
          try {
            const result = await fetchPrice(symbol);
            if (result && result.price > 0) {
              priceMap[symbol] = result.price;
            }
          } catch {
            // Falha silenciosa — tenta novamente no próximo ciclo
          }
        })
      );

      if (cancelled) return;

      let updated = false;
      const newHistory = [...history];
      const newProgressMap: Record<string, { tp1: number; tp2: number; tp3: number; stop: number }> = {};

      for (const analysis of newHistory) {
        if (analysis.status !== 'PENDENTE') continue;

        const symbol = analysis.symbol.replace('/', '').toUpperCase();
        const currentPrice = priceMap[symbol];
        if (!currentPrice || currentPrice <= 0) continue;

        const entryPrice = analysis.entry_price || 0;
        if (entryPrice <= 0) continue;

        // Calcula progresso para cada alvo
        const tp1Progress = analysis.target_price > 0
          ? calcProgress(analysis.direction, entryPrice, currentPrice, analysis.target_price) : 0;
        const tp2Progress = analysis.target_price2 > 0
          ? calcProgress(analysis.direction, entryPrice, currentPrice, analysis.target_price2) : 0;
        const tp3Progress = analysis.target_price3 > 0
          ? calcProgress(analysis.direction, entryPrice, currentPrice, analysis.target_price3) : 0;
        const stopProgress = analysis.stop_loss > 0
          ? calcProgress(analysis.direction === 'LONG' ? 'SHORT' : 'LONG', entryPrice, currentPrice, analysis.stop_loss) : 0;

        newProgressMap[analysis.id] = { tp1: tp1Progress, tp2: tp2Progress, tp3: tp3Progress, stop: stopProgress };

        // Verifica se algum alvo foi atingido (progresso >= 100%)
        let resultado: string | null = null;
        if (analysis.direction === 'LONG') {
          if (analysis.target_price > 0 && currentPrice >= analysis.target_price) {
            resultado = 'TP1_ATINGIDO';
          } else if (analysis.target_price2 > 0 && currentPrice >= analysis.target_price2) {
            resultado = 'TP2_ATINGIDO';
          } else if (analysis.target_price3 > 0 && currentPrice >= analysis.target_price3) {
            resultado = 'TP3_ATINGIDO';
          } else if (analysis.stop_loss > 0 && currentPrice <= analysis.stop_loss) {
            resultado = 'STOP_ATINGIDO';
          }
        } else {
          if (analysis.target_price > 0 && currentPrice <= analysis.target_price) {
            resultado = 'TP1_ATINGIDO';
          } else if (analysis.target_price2 > 0 && currentPrice <= analysis.target_price2) {
            resultado = 'TP2_ATINGIDO';
          } else if (analysis.target_price3 > 0 && currentPrice <= analysis.target_price3) {
            resultado = 'TP3_ATINGIDO';
          } else if (analysis.stop_loss > 0 && currentPrice >= analysis.stop_loss) {
            resultado = 'STOP_ATINGIDO';
          }
        }

        if (resultado) {
          analysis.status = resultado.includes('TP') ? 'ACERTOU' : 'ERROU';
          updated = true;

          // Envia PUT para persistir resultado no servidor
          try {
            await updateResultadoAnalise(parseInt(analysis.id), {
              resultado,
              preco_resultado: currentPrice,
            });
          } catch (e) {
            console.warn('Falha ao sync resultado:', e);
          }
        }
      }

      if (cancelled) return;

      setProgressMap(newProgressMap);
      if (updated) {
        setHistory(newHistory);
      }
    };

    // Verifica a cada 15 segundos
    const intervalId = setInterval(checkPrices, 15000);
    checkPrices(); // Verificação inicial

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [history]);

  // Modal de preço resultado
  const [priceModal, setPriceModal] = useState<{ show: boolean; id: string; status: 'ACERTOU' | 'ERROU' } | null>(null);
  const [priceInput, setPriceInput] = useState('');

  // Atualiza status via API — sem localStorage
  const updateStatus = async (id: string, newStatus: 'ACERTOU' | 'ERROU') => {
    setPriceModal({ show: true, id, status: newStatus });
    setPriceInput('');
  };

  const confirmResultado = async () => {
    if (!priceModal) return;
    const precoResultado = parseFloat(priceInput.replace(',', '.'));
    if (isNaN(precoResultado) || precoResultado <= 0) return;

    const updatedHistory = history.map(h => 
      h.id === priceModal.id ? { ...h, status: priceModal.status } : h
    );
    setHistory(updatedHistory);
    setPriceModal(null);

    try {
      await updateResultadoAnalise(parseInt(priceModal.id), {
        resultado: priceModal.status === 'ACERTOU' ? 'TP1_ATINGIDO' : 'STOP_ATINGIDO',
        preco_resultado: precoResultado,
      });
    } catch (e) {
      console.warn('Falha ao atualizar resultado no servidor:', e);
    }
  };

  // Limpa histórico via API — sem localStorage
  const clearHistory = async () => {
    if (confirm("Tem certeza que deseja apagar todo o histórico de análises?")) {
      try {
        await deleteAllAnalises();
        setHistory([]);
      } catch (e) {
        console.error('Falha ao limpar histórico no servidor:', e);
        setHistory([]);
      }
    }
  };

  // Cálculo de métricas
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

  // Filtragem
  const filteredHistory = useMemo(() => {
    let result = history;
    if (filterSymbol) result = result.filter(h => h.symbol.toLowerCase().includes(filterSymbol.toLowerCase()));
    if (filterTF) result = result.filter(h => h.interval === filterTF);
    if (filterStatus) result = result.filter(h => h.status === filterStatus);
    return result;
  }, [history, filterSymbol, filterTF, filterStatus]);

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const currentData = filteredHistory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Estatísticas do sistema via API
  const [sysStats, setSysStats] = useState<any>(null);
  useEffect(() => {
      const loadSysStats = async () => {
          try {
              const json = await fetchEstatisticas();
              if (json.success) setSysStats(json.data);
          } catch(e) {
              console.warn("Erro ao buscar estatisticas-sistema", e);
          }
      };
      loadSysStats();
  }, []);

  return (
    <div className="flex flex-col gap-6 pb-10">

      {/* Modal de preço resultado */}
      {priceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-6 w-[320px] shadow-2xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-1">
              {priceModal.status === 'ACERTOU' ? 'Registrar Acerto' : 'Registrar Erro'}
            </h3>
            <p className="text-[10px] text-gray-500 mb-4 font-mono">Informe o preço de saída da operação</p>
            <input
              type="text"
              value={priceInput}
              onChange={(e) => {
                // Máscara: formato decimal válido (ex: 0.8150, 65000.50)
                let val = e.target.value.replace(/[^0-9.,]/g, '');
                // Substituir vírgula por ponto
                val = val.replace(',', '.');
                // Só permitir um ponto
                const parts = val.split('.');
                if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                // Limitar decimais a 8 casas
                if (parts.length === 2 && parts[1].length > 8) val = parts[0] + '.' + parts[1].slice(0, 8);
                // Remover zeros à esquerda (exceto "0." ou "0")
                if (val.length > 1 && val[0] === '0' && val[1] !== '.') val = val.replace(/^0+/, '') || '0';
                setPriceInput(val);
              }}
              onKeyDown={(e) => e.key === 'Enter' && confirmResultado()}
              placeholder="0.0000"
              autoFocus
              className="w-full bg-black border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:border-genesis-accent focus:outline-none focus:ring-1 focus:ring-genesis-accent/50 placeholder-gray-600"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setPriceModal(null)}
                className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-gray-400 text-xs font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmResultado}
                disabled={!priceInput || isNaN(parseFloat(priceInput.replace(',', '.'))) || parseFloat(priceInput.replace(',', '.')) <= 0}
                className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                  priceModal.status === 'ACERTOU' 
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-30' 
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-30'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
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

      {/* SEÇÃO DASHBOARD */}
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

      {/* SEÇÃO TABELA DE HISTÓRICO */}
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
                     <th className="py-4 px-2 tracking-widest text-center">TP1</th>
                     <th className="py-4 px-2 tracking-widest text-center">TP2</th>
                     <th className="py-4 px-2 tracking-widest text-center">TP3</th>
                     <th className="py-4 px-2 tracking-widest text-center">Score</th>
                     <th className="py-4 px-2 tracking-widest text-center">Status</th>
                     <th className="py-4 px-2 tracking-widest text-right">Resultado</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {currentData.length === 0 ? (
                     <tr>
                        <td colSpan={11} className="py-12 text-center">
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
                              <td className="py-4 px-2 text-center">
                                {item.target_price !== undefined && item.target_price !== null ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="relative w-8 h-8">
                                      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="#22c55e" strokeWidth="3"
                                          strokeDasharray={`${(progressMap[item.id]?.tp1 || 0) * 0.9425} 94.25`}
                                          strokeLinecap="round" />
                                      </svg>
                                      <span className="absolute inset-0 flex items-center justify-center text-[7px] font-mono text-white">
                                        {Math.round(progressMap[item.id]?.tp1 || 0)}%
                                      </span>
                                    </div>
                                    <span className="text-[9px] font-mono text-gray-500">{item.target_price.toLocaleString()}</span>
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="py-4 px-2 text-center">
                                {item.target_price2 !== undefined && item.target_price2 !== null ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="relative w-8 h-8">
                                      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="#22c55e" strokeWidth="3"
                                          strokeDasharray={`${(progressMap[item.id]?.tp2 || 0) * 0.9425} 94.25`}
                                          strokeLinecap="round" />
                                      </svg>
                                      <span className="absolute inset-0 flex items-center justify-center text-[7px] font-mono text-white">
                                        {Math.round(progressMap[item.id]?.tp2 || 0)}%
                                      </span>
                                    </div>
                                    <span className="text-[9px] font-mono text-gray-500">{item.target_price2.toLocaleString()}</span>
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="py-4 px-2 text-center">
                                {item.target_price3 !== undefined && item.target_price3 !== null ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <div className="relative w-8 h-8">
                                      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                                        <circle cx="18" cy="18" r="15" fill="none" stroke="#22c55e" strokeWidth="3"
                                          strokeDasharray={`${(progressMap[item.id]?.tp3 || 0) * 0.9425} 94.25`}
                                          strokeLinecap="round" />
                                      </svg>
                                      <span className="absolute inset-0 flex items-center justify-center text-[7px] font-mono text-white">
                                        {Math.round(progressMap[item.id]?.tp3 || 0)}%
                                      </span>
                                    </div>
                                    <span className="text-[9px] font-mono text-gray-500">{item.target_price3.toLocaleString()}</span>
                                  </div>
                                ) : '-'}
                              </td>
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

         {totalPages >= 1 && (
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
