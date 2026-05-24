
import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, ShieldCheck, Zap, Search, Activity } from 'lucide-react';
import { getNovasListagens, enrichListingData, NormalizedListing } from '../services/newListingService';
import { formatPrice } from '../services/cryptoApi';

const NewListings: React.FC = () => {
  const [allPool, setAllPool] = useState<NormalizedListing[]>([]);
  const [displayListings, setDisplayListings] = useState<NormalizedListing[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Inicialização do Pool (Executado apenas uma vez ao abrir a aba)
  const initializePool = async () => {
    try {
      const data = await getNovasListagens();
      setAllPool(data);
      return data;
    } catch (err) {
      console.error("Erro ao inicializar pool", err);
      return [];
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setHasStarted(true);
    
    try {
      let currentPool = allPool;
      if (currentPool.length === 0) {
        currentPool = await initializePool();
      }

      // 1. Filtrar o que NÃO foi visto
      let candidates = currentPool.filter(item => !seenIds.has(item.id));

      // 2. Se esgotar o universo, resetar a memória de vistos para permitir nova rotação
      if (candidates.length < 5) {
        const newSeen = new Set<string>();
        setSeenIds(newSeen);
        candidates = currentPool; // Volta ao pool completo
      }

      // 3. Selecionar exatamente 5 (Priorizando diversidade de exchange)
      // Embaralhamos levemente os candidatos do topo para evitar sempre os mesmos ativos grandes
      const topCandidates = candidates.slice(0, 15);
      const selection = topCandidates
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);

      // 4. Enriquecer apenas os 5 selecionados (Performance)
      const enriched = await Promise.all(selection.map(item => enrichListingData(item)));
      
      // 5. Atualizar estado de exibição e memória
      setDisplayListings(enriched);
      setSeenIds(prev => {
        const next = new Set(prev);
        enriched.forEach(e => next.add(e.id));
        return next;
      });

    } catch (err) {
      console.error("Erro na busca de listagens:", err);
    } finally {
      // Delay tático para percepção de processamento
      setTimeout(() => setLoading(false), 600);
    }
  };

  const getTimeSince = (ts: number) => {
    const diff = Date.now() - ts;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Menos de 1h';
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  const formatCurrency = (val: number) => {
    if (val === 0) return 'Sincronizando...';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact'
    }).format(val);
  };

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
      
      {/* HEADER TÉCNICO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8  pb-6 gap-[16px]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-genesis-accent/10 flex items-center justify-center border-genesis-accent/20 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
            <Zap size={24} className="text-genesis-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-thin text-white tracking-widest uppercase">Radar de Ativação</h1>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Varredura Factual de Snapshots</p>
          </div>
        </div>
        
        {hasStarted && (
          <div className="flex items-center gap-[16px]">
            <div className="text-right hidden md:block">
              <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Rotação Ativa</div>
              <div className="text-xs font-mono text-genesis-positive uppercase">Memória: {seenIds.size} vindo de {allPool.length}</div>
            </div>
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg  text-white text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar Pesquisa
            </button>
          </div>
        )}
      </div>

      {!hasStarted ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-700">
            <div className="w-24 h-24 bg-white/[0.02] rounded-full flex items-center justify-center mb-8  shadow-2xl">
                <Search size={40} className="text-gray-700" />
            </div>
            <h2 className="text-3xl font-thin text-white uppercase tracking-[0.2em] mb-4">Nova Varredura</h2>
            <p className="text-gray-500 text-sm max-w-md leading-relaxed mb-10 font-light italic">
                O módulo está pronto para escanear o universo de listagens. Inicie a varredura para identificar 5 eventos factuais e iniciar a rotação de oportunidades.
            </p>
            <button 
                onClick={handleSearch}
                className="bg-white text-black hover:bg-genesis-positive px-12 py-5 rounded-xl font-bold text-xs uppercase tracking-[0.3em] transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)] active:scale-95"
            >
                Buscar Novas Listagens
            </button>
        </div>
      ) : (
        <>
          <div className="bg-red-950/20 border-red-500/20 rounded-[10px] p-[16px] mb-8 flex items-start gap-[16px] animate-in slide-in-">
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
            <div className="space-y-1">
              <h4 className="text-[11px] font-bold text-red-500 uppercase tracking-wider">Protocolo de Risco Ativo</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Listagens recentes possuem liquidez reduzida. Este radar garante a visualização de projetos inéditos a cada busca, impedindo a repetição de dados e otimizando a detecção de fluxo inicial.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-genesis-accent border-t-transparent rounded-full animate-spin mb-4"></div>
              <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Varrendo Snapshots em 3 Exchanges...</span>
            </div>
          ) : displayListings.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 py-20">
               <Activity size={48} className="text-gray-700 mb-4" />
               <p className="text-xs uppercase tracking-widest text-gray-500">Nenhum evento detectado no momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-[16px] pb-20 animate-in fade-in duration-700">
              {displayListings.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="bg-genesis-card  rounded-2xl p-6 hover:border-genesis-accent/30 transition-all group relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full bg-genesis-accent opacity-20"></div>
                   <div className="flex flex-col md:flex-row items-center gap-8">
                      <div className="w-full md:w-1/4 flex items-center gap-[16px]">
                         <div className="w-10 h-10 rounded bg-white/5  flex items-center justify-center text-genesis-accent font-bold text-lg font-mono uppercase">
                            {item.symbol.charAt(0)}
                         </div>
                         <div>
                            <h3 className="text-lg font-bold text-white font-mono">{item.symbol}</h3>
                            <div className="flex items-center gap-2">
                               <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                 item.exchange === 'Binance' ? 'bg-yellow-500/10 text-yellow-500' : 
                                 (item.exchange === 'Bybit' ? 'bg-orange-500/10 text-orange-500' : 'bg-cyan-500/10 text-cyan-500')
                               }`}>{item.exchange}</span>
                               <span className="text-[9px] text-gray-500 font-mono">{getTimeSince(item.launchDate)}</span>
                            </div>
                         </div>
                      </div>

                      <div className="w-full md:w-1/4">
                         <span className="text-[9px] text-gray-500 font-bold uppercase block mb-1">Classificação</span>
                         <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${item.type === 'Nova Listagem' ? 'text-genesis-positive' : 'text-blue-400'}`}>
                            <ShieldCheck size={14} />
                            {item.type}
                         </div>
                      </div>

                      <div className="w-full md:w-1/2 grid grid-cols-3 gap-[16px]">
                         <div>
                            <span className="text-[9px] text-gray-600 font-bold uppercase block mb-1">Vol. Amostragem (24h)</span>
                            <span className="text-sm font-mono text-white font-bold">{formatCurrency(item.volume24h)}</span>
                         </div>
                         <div>
                            <span className="text-[9px] text-gray-600 font-bold uppercase block mb-1">Preço Atual</span>
                            <span className="text-sm font-mono text-gray-300">{item.price > 0 ? formatPrice(item.price) : '---'}</span>
                         </div>
                         <div className="text-right">
                            <span className="text-[9px] text-gray-600 font-bold uppercase block mb-1">Detecção</span>
                            <span className="text-[10px] font-mono text-genesis-positive bg-genesis-positive/5 px-2 py-1 rounded border-genesis-positive/10 uppercase font-bold">FACTUAL</span>
                         </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <footer className="mt-auto  pt-8 pb-4 text-center opacity-40">
        <p className="text-[9px] text-gray-500 font-mono uppercase leading-relaxed max-w-2xl mx-auto">
          Motor de Exclusão Ativo: Impedindo repetição em {seenIds.size} ativos. O pool global contém {allPool.length} candidatos monitorados via API oficial.
        </p>
      </footer>
    </div>
  );
};

export default NewListings;
