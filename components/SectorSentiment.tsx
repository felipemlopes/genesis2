import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, PieChart } from 'lucide-react';
import { fetchWithProxy } from '../services/cryptoApi';

interface SectorData {
    id: string;
    name: string;
    market_cap_change_24h: number;
    market_cap: number;
}

const SectorSentiment: React.FC = () => {
    const [sectors, setSectors] = useState<SectorData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSectors = async () => {
            try {
                const res = await fetchWithProxy('https://api.coingecko.com/api/v3/coins/categories');
                if (res && res.length > 0) {
                    const validSectors = res.filter((c: any) => 
                        c.market_cap_change_24h !== null && 
                        c.market_cap > 0 && 
                        !c.name.toLowerCase().match(/(stock|equity|fiat|commodity|etf|index|ecosystem|lp|farming|sticker|time|wrapped|peg|tokenized|celsius|voyager|ftx|terra|bot|fans|meme)/i)
                    );

                    const sortedPos = [...validSectors]
                        .filter(c => c.market_cap_change_24h > 0)
                        .sort((a, b) => b.market_cap_change_24h - a.market_cap_change_24h)
                        .slice(0, 3);
                    
                    const sortedNeg = [...validSectors]
                        .filter(c => c.market_cap_change_24h < 0)
                        .sort((a, b) => a.market_cap_change_24h - b.market_cap_change_24h)
                        .slice(0, 2);

                    const combined = [...sortedPos, ...sortedNeg].map(c => {
                        let friendlyName = c.name
                            .replace(/ Ecosystem$/i, '')
                            .replace(/ Tokens$/i, '')
                            .replace(/ Coins$/i, '')
                            .replace(/^Decentralized /i, 'De')
                            .replace(/^Artificial Intelligence/i, 'AI')
                            .trim();

                        return {
                            id: c.id,
                            name: friendlyName,
                            market_cap_change_24h: c.market_cap_change_24h,
                            market_cap: c.market_cap
                        };
                    });

                    setSectors(combined);
                }
            } catch (e) {
                // Dim down noise
                console.error("Failed to fetch sector sentiment", e);
            } finally {
                setLoading(false);
            }
        };

        fetchSectors();
        const interval = setInterval(fetchSectors, 300000); // 5 mins
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="bg-genesis-card p-4 rounded-xl border border-white/5 shadow-lg relative overflow-visible animate-pulse">
                <div className="h-4 w-48 bg-white/10 rounded mb-2" />
                <div className="h-3 w-64 bg-white/10 rounded mb-4" />
                <div className="flex flex-wrap gap-2">
                    {[1,2,3,4,5].map(i => <div key={i} className="h-12 w-full md:w-[calc(20%-0.5rem)] bg-white/10 rounded" />)}
                </div>
            </div>
        );
    }

    if (sectors.length === 0) return null;

    const formatCap = (cap: number) => {
        if (cap >= 1_000_000_000) return (cap / 1_000_000_000).toFixed(1) + 'B';
        if (cap >= 1_000_000) return (cap / 1_000_000).toFixed(1) + 'M';
        return cap.toFixed(0);
    };

    return (
        <div className="bg-genesis-card p-4 rounded-xl border border-white/5 shadow-lg relative overflow-visible">
            <div className="flex items-center gap-2 mb-1">
                <PieChart size={16} className="text-genesis-accent" />
                <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">Narrativas em Destaque</h3>
            </div>
            <p className="text-[9px] text-gray-500 mb-4 tracking-wider">Temas com maior fluxo de capital no mercado cripto nas últimas 24h</p>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {sectors.map(sector => {
                    const isPos = sector.market_cap_change_24h >= 0;
                    return (
                        <div key={sector.id} className={`flex flex-col items-center justify-center p-2 rounded border relative group cursor-default z-10 hover:z-[99999999] ${isPos ? 'bg-green-900/10 border-green-500/20' : 'bg-red-900/10 border-red-500/20'}`}>
                            <span className="text-[9px] text-gray-300 font-bold uppercase tracking-wider text-center line-clamp-1 w-full truncate">
                                {sector.name}
                            </span>
                            <div className="flex flex-col items-center mt-1">
                                <span className={`flex items-center gap-0.5 text-xs font-mono font-bold ${isPos ? 'text-green-400' : 'text-red-400'}`}>
                                    {isPos ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                    {Math.abs(sector.market_cap_change_24h).toFixed(1)}%
                                </span>
                                <span className="text-[8px] text-gray-500 font-mono mt-0.5">${formatCap(sector.market_cap)} Cap</span>
                            </div>

                            {/* Tooltip */}
                            <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-48 p-2.5 bg-black border border-white/5 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,1)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none scale-95 group-hover:scale-100 origin-top text-center text-[10px] z-[99999999]">
                                <span className="block font-bold text-white mb-1">{sector.name}</span>
                                <span className="text-gray-400">Cap: ${formatCap(sector.market_cap)}<br/>Var 24h: {sector.market_cap_change_24h.toFixed(1)}%</span>
                                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black transform rotate-45 border-l border-t border-white/5"></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SectorSentiment;
