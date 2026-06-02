import React from 'react';
import { useRadarNewsAlerts, RadarNewsItem } from '../hooks/useRadarNewsAlerts';
import { X, Newspaper, Search, ExternalLink } from 'lucide-react';

const SEVERITY_CONFIG = {
    CRITICAL: { emoji: '🔴', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.2)]' },
    HIGH: { emoji: '🟠', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.2)]' },
    MEDIUM: { emoji: '🟡', bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.2)]' },
    LOW: { emoji: '🟢', bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30', glow: 'shadow-[0_0_15px_rgba(34,197,94,0.2)]' },
};

const BIAS_LABEL: Record<string, { text: string; color: string }> = {
    BULLISH: { text: 'BULLISH', color: 'text-genesis-positive' },
    BEARISH: { text: 'BEARISH', color: 'text-genesis-negative' },
    NEUTRAL: { text: 'NEUTRAL', color: 'text-gray-400' },
};

const RadarNewsCard: React.FC<{ item: RadarNewsItem; onClose: (id: number) => void }> = ({ item, onClose }) => {
    const sev = SEVERITY_CONFIG[item.severity];
    const bias = BIAS_LABEL[item.market_bias] || BIAS_LABEL.NEUTRAL;
    const isDiscovery = item.is_discovery;

    return (
        <div className={`relative flex flex-col pointer-events-auto bg-[#0a0a0f] border ${sev.border} rounded-xl p-4 mb-3 w-[370px] shadow-2xl ${sev.glow} animate-in slide-in-from-right fade-in duration-500 overflow-hidden`}>
            {/* Auto-dismiss progress bar (15s) */}
            <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full animate-[radarProgress_15s_linear_forwards] origin-left" />

            <button onClick={() => onClose(item.id)} className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors" aria-label="Fechar notificação">
                <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${sev.bg}`}>
                    {isDiscovery ? <Search size={16} className={sev.text} /> : <Newspaper size={16} className={sev.text} />}
                </div>
                <div className="flex flex-col flex-1 pr-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold">{sev.emoji}</span>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>
                            {item.severity}
                        </span>
                        {isDiscovery && item.discovery_score != null && (
                            <span className="text-[9px] bg-genesis-accent/20 text-genesis-accent font-bold px-1.5 py-0.5 rounded">
                                Score {item.discovery_score}/10
                            </span>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${bias.color}`}>
                        {bias.text}
                    </span>
                </div>
            </div>

            {/* Title */}
            <p className="text-white text-sm font-bold leading-snug mb-2 pr-4">
                {item.title}
            </p>

            {/* Impact Summary */}
            {item.impact_summary && (
                <p className="text-gray-300 text-xs leading-relaxed mb-3">
                    {item.impact_summary.length > 200 ? item.impact_summary.slice(0, 200) + '...' : item.impact_summary}
                </p>
            )}

            {/* Affected Assets Tags */}
            {item.affected_assets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {item.affected_assets.map(asset => (
                        <span key={asset} className="text-[9px] bg-white/10 text-gray-200 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {asset}
                        </span>
                    ))}
                </div>
            )}

            {/* Footer: Source + Time */}
            <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">{item.source}</span>
                    {item.source_url && (
                        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-genesis-accent hover:text-white transition-colors" aria-label="Abrir fonte">
                            <ExternalLink size={12} />
                        </a>
                    )}
                </div>
                <span className="font-mono text-gray-500 text-[10px]">
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            <style>{`
                @keyframes radarProgress {
                    from { transform: scaleX(1); }
                    to { transform: scaleX(0); }
                }
            `}</style>
        </div>
    );
};

const RadarNewsPopup: React.FC = () => {
    const { news, fecharNews } = useRadarNewsAlerts();

    return (
        <div className="fixed top-24 right-4 z-[999998] pointer-events-none flex flex-col items-end">
            {news.map(item => (
                <RadarNewsCard key={item.id} item={item} onClose={fecharNews} />
            ))}
        </div>
    );
};

export default RadarNewsPopup;
