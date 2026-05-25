import React, { useEffect, useState } from 'react';
import { useAlertas, AlertaGenesis } from '../hooks/useAlertas';
import { X, Target, ArrowRight } from 'lucide-react';

interface OportunidadePopupProps {
    onAnalyze?: (corretora: string, pair: string, timeframe: string) => void;
}

const OportunidadeCard: React.FC<{
    alerta: AlertaGenesis;
    onClose: (id: number) => void;
    onAnalyze?: (corretora: string, pair: string, timeframe: string) => void;
}> = ({ alerta, onClose, onAnalyze }) => {
    const borderColor = 'border-genesis-accent/30';
    const glow = 'shadow-[0_0_20px_rgba(139,92,246,0.15)]';

    const handleAnalyze = () => {
        if (onAnalyze) {
            onAnalyze(alerta.corretora || 'BINANCE', alerta.ativo, alerta.timeframe || '1h');
        }
        onClose(alerta.id);
    };

    return (
        <div className={`relative flex flex-col pointer-events-auto bg-[#0a0a0f] border ${borderColor} rounded-xl p-4 mb-3 w-[340px] shadow-2xl ${glow} animate-in slide-in-from-bottom fade-in duration-500 overflow-hidden`}>
            <button onClick={() => onClose(alerta.id)} className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">
                <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-genesis-accent/10">
                    <Target size={18} className="text-genesis-accent" />
                </div>
                <div className="flex flex-col flex-1">
                    <span className="text-[10px] font-bold text-genesis-accent uppercase tracking-widest">OPORTUNIDADE</span>
                    <span className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">{alerta.corretora} &mdash; {alerta.timeframe || '1h'}</span>
                </div>
            </div>

            <button onClick={handleAnalyze} className="w-full flex items-center justify-center gap-2 bg-genesis-accent hover:bg-genesis-accent/90 text-white font-bold py-2 rounded-lg text-[10px] uppercase tracking-wider transition-all focus:outline-none focus:ring-1 focus:ring-genesis-accent">
                Analisar Agora <ArrowRight size={12} />
            </button>

            <div className="text-center mt-2">
                <span className="text-[8px] text-gray-500 font-mono tracking-wide">50 creditos</span>
            </div>
        </div>
    );
};

const OportunidadePopup: React.FC<OportunidadePopupProps> = ({ onAnalyze }) => {
    const { alertas } = useAlertas();
    const [oportunidades, setOportunidades] = useState<AlertaGenesis[]>([]);

    useEffect(() => {
        const highScore = alertas.filter(a => (a.score || 0) >= 68);
        if (highScore.length > 0) {
            setOportunidades(prev => {
                const existingIds = new Set(prev.map(o => o.id));
                const newOnes = highScore.filter(a => !existingIds.has(a.id));
                if (newOnes.length === 0) return prev;
                return [...newOnes, ...prev].slice(0, 3);
            });
        }
    }, [alertas]);

    const handleClose = (id: number) => {
        setOportunidades(prev => prev.filter(o => o.id !== id));
    };

    if (oportunidades.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[999998] pointer-events-none flex flex-col items-end">
            {oportunidades.map(op => (
                <OportunidadeCard key={op.id} alerta={op} onClose={handleClose} onAnalyze={onAnalyze} />
            ))}
        </div>
    );
};

export default OportunidadePopup;
