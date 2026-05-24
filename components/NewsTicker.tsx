
import React, { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Clock, RefreshCw, Radio, AlertCircle } from 'lucide-react';
import { fetchWithProxy } from '../services/cryptoApi';

interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  published_at: number; // Unix Timestamp
  categories?: string;
}

const MOCK_NEWS: NewsItem[] = [
  {
    id: 'm1',
    title: 'Bitcoin consolida acima de suporte chave enquanto volume institucional cresce em derivativos.',
    url: '#',
    source: 'Gênesis Intelligence',
    published_at: Math.floor(Date.now() / 1000) - 300
  },
  {
    id: 'm2',
    title: 'Análise Macro: Correlação entre S&P 500 e Cripto atinge mínima histórica neste trimestre.',
    url: '#',
    source: 'Market Update',
    published_at: Math.floor(Date.now() / 1000) - 1800
  },
  {
    id: 'm3',
    title: 'Ethereum: Atualização de rede promete reduzir taxas de Layer 2 drasticamente nas próximas semanas.',
    url: '#',
    source: 'Tech Protocol',
    published_at: Math.floor(Date.now() / 1000) - 3600
  },
  {
    id: 'm4',
    title: 'BlackRock e Fidelity expandem fundos tokenizados em redes públicas de blockchain.',
    url: '#',
    source: 'Institutional',
    published_at: Math.floor(Date.now() / 1000) - 7200
  },
  {
    id: 'm5',
    title: 'Volume de DEXs na rede Solana ultrapassa Ethereum em período de 24h pela primeira vez.',
    url: '#',
    source: 'DeFi Pulse',
    published_at: Math.floor(Date.now() / 1000) - 10000
  }
];

const NewsTicker: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const t = Date.now();
      const data = await fetchWithProxy(`https://min-api.cryptocompare.com/data/v2/news/?lang=EN&_t=${t}`);

      // Se a API falhar silenciosamente ou retornar erro explícito (Rate Limit)
      if (!data || (data.Response === "Error")) {
        console.warn("News API Rate Limit/Error. Using backup feed.");
        setNews(MOCK_NEWS);
        return;
      }

      if (data.Data && Array.isArray(data.Data)) {
        const rawItems = data.Data.slice(0, 15); 
        
        const processedItems = rawItems.map((item: any) => ({
          id: item.id || Math.random().toString(),
          title: item.title || "No Title", 
          url: item.url || "#",
          source: item.source_info?.name || item.source || "Unknown Source",
          published_at: item.published_on || (Date.now() / 1000),
          categories: item.categories
        }));
        
        if (processedItems.length > 0) {
          setNews(processedItems);
        } else {
          setNews(MOCK_NEWS);
        }
      } else {
        setNews(MOCK_NEWS);
      }
    } catch (error: any) {
      console.warn("News Network Error, switching to backup:", error);
      // Fallback silencioso para garantir UX
      setNews(MOCK_NEWS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 60000); 
    return () => clearInterval(interval);
  }, []);

  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() / 1000) - timestamp);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  };

  return (
    <div className="bg-genesis-card  rounded-[10px] p-5 shadow-2xl flex flex-col h-[380px] relative overflow-hidden group">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 z-10 relative">
        <div className="flex items-center gap-2 text-genesis-accent">
           <Newspaper size={16} />
           <span className="text-[10px] font-bold uppercase tracking-widest text-white">Notícias em Tempo Real</span>
        </div>
        <div className="flex items-center gap-1.5 bg-blue-900/10 px-2 py-0.5 rounded border-blue-500/10">
           <Radio size={10} className="text-blue-400 animate-pulse" />
           <span className="text-[9px] text-blue-400 font-mono font-bold uppercase">LIVE FEED</span>
        </div>
      </div>

      {/* Infinite Scroll Content */}
      <div className="flex-1 overflow-hidden relative">
        {loading && news.length === 0 ? (
             <div className="flex flex-col gap-[16px] mt-4 animate-pulse">
                 {[1,2,3].map(i => (
                     <div key={i} className="h-20 bg-white/5 rounded-lg "></div>
                 ))}
             </div>
        ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-[16px]">
                <AlertCircle size={24} className="text-red-400 mb-2" />
                <span className="text-red-400 text-xs font-bold mb-2">Conexão Interrompida</span>
                <p className="text-gray-500 text-[10px] mb-4 line-clamp-2 px-4">{error}</p>
                <button 
                  onClick={fetchNews}
                  className="bg-white/5 hover:bg-white/10 text-white px-3 py-1.5 rounded text-xs  flex items-center gap-2 transition-colors uppercase tracking-wider"
                >
                   <RefreshCw size={12} /> Reconectar
                </button>
            </div>
        ) : (
            <div className={`flex flex-col gap-3 py-2 ${news.length > 0 ? 'animate-vertical-scroll hover:pause-animation' : ''}`} style={{ animationDuration: '60s' }}>
            {/* Duplicating array inline for seamless loop */}
            {[...news, ...news].map((item, index) => {
                // Logic: The first item in the visible list (index 0) gets the highlight.
                // In the duplicated list, we highlight the head of both sets to ensure consistency during scroll.
                const isHighlight = index === 0 || index === news.length; 
                
                return (
                    <a 
                    key={`${item.id}-${index}`} 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`block p-[16px] rounded-xl transition-all duration-500 group/item relative overflow-hidden
                        ${isHighlight 
                            ? 'bg-genesis-accent/5 border-genesis-accent/30 opacity-100 scale-100 shadow-[0_0_15px_rgba(139,92,246,0.15)] z-10' 
                            : ' hover: hover:bg-white/5 opacity-90 hover:opacity-100 hover:scale-[1.02]'
                        }
                    `}
                    >
                        {isHighlight && (
                            <div className="absolute top-2 right-2 flex items-center gap-1.5">
                                <span className="text-[8px] font-bold text-genesis-accent uppercase tracking-widest bg-black/40 px-1.5 rounded">MANCHETE</span>
                                <span className="flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-genesis-accent opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-genesis-accent"></span>
                                </span>
                            </div>
                        )}

                        <div className="flex justify-between items-start mb-2 pr-12">
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold uppercase truncate max-w-[120px] px-1.5 py-0.5 rounded tracking-wider ${isHighlight ? 'bg-genesis-accent text-white' : 'text-genesis-accent bg-genesis-accent/10'}`}>
                                    {item.source}
                                </span>
                                {/* Badge de relevância */}
                                {(() => {
                                    const textStr = `${item.title} ${item.categories || ''}`.toLowerCase();
                                    const highKeywords = ['sec', 'fed', 'reserve', 'halving', 'etf', 'blackrock', 'regulação', 'crash', 'falência', 'hack', 'liquidação', 'jerome powell', 'cpi', 'inflação', 'juros'];
                                    const mediumKeywords = ['parceria', 'integração', 'adoção institucional', 'upgrade', 'atualização', 'mainnet', 'protocolo'];
                                    
                                    if (highKeywords.some(kw => textStr.includes(kw.toLowerCase()))) {
                                        return <span className="text-[8px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded tracking-widest uppercase">ALTA</span>;
                                    }
                                    if (mediumKeywords.some(kw => textStr.includes(kw.toLowerCase()))) {
                                        return <span className="text-[8px] bg-yellow-500 text-black font-bold px-1.5 py-0.5 rounded tracking-widest uppercase">MÉDIA</span>;
                                    }
                                    return <span className="text-[8px] bg-gray-500/20 text-gray-400 font-bold px-1.5 py-0.5 rounded tracking-widest uppercase border border-gray-500/20">BAIXA</span>;
                                })()}
                            </div>
                        </div>
                        
                        <h4 className={`text-xs font-medium leading-relaxed mb-2 font-sans ${isHighlight ? 'text-white font-bold' : 'text-gray-200 group-hover/item:text-white'}`}>
                            {item.title}
                        </h4>

                        <div className="flex justify-between items-center mt-2  pt-2">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] text-gray-500 font-mono flex items-center gap-1">
                                    <Clock size={10} /> {timeAgo(item.published_at)}
                                </span>
                            </div>
                            <ExternalLink size={10} className={`${isHighlight ? 'text-genesis-accent' : 'text-gray-600 group-hover/item:text-white'}`} />
                        </div>
                    </a>
                );
            })}
            </div>
        )}
      </div>
      
    </div>
  );
};

export default NewsTicker;
