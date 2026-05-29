import React, { useEffect, useState } from 'react';
import { Activity, ArrowRight, Loader2 } from 'lucide-react';
import { useAlertas, AlertaGenesis } from '../hooks/useAlertas';
import { consumeCredits } from '../services/api';

interface ConfluenceScoreProps {
    onAnalyzeAnomaly?: (ex: string, pair: string, tf: string) => void;
}

export const ConfluenceScore: React.FC<ConfluenceScoreProps> = ({ onAnalyzeAnomaly }) => {
    const { alertas } = useAlertas();
    const [currentAlerta, setCurrentAlerta] = useState<AlertaGenesis | null>(null);
    const [isDebiting, setIsDebiting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (alertas.length > 0) {
            setCurrentAlerta(alertas[0]);
        } else {
            setCurrentAlerta(null);
        }
    }, [alertas]);

    const handleAnalyze = async () => {
        if (isDebiting || !onAnalyzeAnomaly || !currentAlerta) return;
        setIsDebiting(true);
        setErrorMsg(null);

        const idempotencyKey = crypto.randomUUID();
        try {
            const result = await consumeCredits('micro_radar', idempotencyKey);
            if (!result.success) {
                setErrorMsg(result.error || 'Créditos insuficientes');
                return;
            }
            // Débito ok — navegar para análise
            onAnalyzeAnomaly(
                currentAlerta.corretora || 'BINANCE',
                currentAlerta.ativo,
                currentAlerta.timeframe || '1h'
            );
            setTimeout(() => {
                document.querySelector('[data-analysis-form]')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 100);
        } catch {
            setErrorMsg('Erro de rede. Tente novamente.');
        } finally {
            setIsDebiting(false);
        }
    };

    return (
        <div className="bg-genesis-card rounded-[10px] p-[16px] xl:p-[20px] relative overflow-hidden group border border-white/5 w-full transition-all duration-600 ease-in-out col-span-full md:col-span-2 lg:col-span-3 xl:col-span-2">
            <style>{`
                @keyframes sweep {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse-opacity-radar {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.2; }
                }
                .radar-sweep {
                    animation: sweep 3s linear infinite;
                    transform-origin: 50px 50px;
                }
                .blinking-line-radar {
                    animation: pulse-opacity-radar 2s ease-in-out infinite;
                }
            `}</style>

            <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-genesis-accent to-transparent blinking-line-radar" />

            <div className="flex flex-row items-center w-full h-full gap-4">
                <div className="flex flex-col justify-start w-[60%] min-h-full">
                    <div className="mb-2">
                        <span className="text-[9px] font-bold text-genesis-text-secondary uppercase tracking-widest block whitespace-nowrap">
                            Micro Radar
                        </span>
                    </div>

                    <div className="mb-4">
                        <span className="text-xs text-gray-400 font-mono tracking-wider block whitespace-nowrap">
                            {currentAlerta ? 'OPORTUNIDADE DETECTADA' : 'MONITORANDO OPORTUNIDADES'}
                        </span>
                    </div>

                    <div className="bg-[#0b0b0f] rounded-lg p-3 border border-white/5 relative mt-auto shadow-inner flex flex-col justify-between">
                        {currentAlerta ? (
                            <>
                                <div className="mb-3 whitespace-nowrap">
                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                                        {currentAlerta.corretora} — {currentAlerta.timeframe || '1h'}
                                    </span>
                                </div>

                                <button
                                    onClick={handleAnalyze}
                                    disabled={isDebiting}
                                    className="w-full flex items-center justify-center gap-2 bg-genesis-accent hover:bg-genesis-accent/90 text-white font-bold py-1.5 rounded-md text-[9px] uppercase tracking-wider transition-all mb-1.5 focus:outline-none focus:ring-1 focus:ring-genesis-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isDebiting ? (
                                        <><Loader2 size={10} className="animate-spin" /> Debitando...</>
                                    ) : (
                                        <>Analisar Agora <ArrowRight size={10} /></>
                                    )}
                                </button>

                                {errorMsg && (
                                    <div className="text-center mb-1">
                                        <span className="text-[8px] text-red-400 font-mono">{errorMsg}</span>
                                    </div>
                                )}

                                <div className="text-center relative group/cost cursor-help">
                                    <span className="text-[8px] text-gray-500 font-mono tracking-wide">75 creditos</span>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 p-2.5 bg-black border border-white/5 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover/cost:opacity-100 group-hover/cost:visible transition-all duration-300 pointer-events-none z-[999999] scale-95 group-hover/cost:scale-100 origin-bottom text-center">
                                        <span className="text-[10px] text-gray-300 leading-relaxed">Cada análise do Micro Radar consome 75 créditos do seu saldo.</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-4">
                                <Activity size={16} className="text-gray-600 animate-pulse mb-2" />
                                <span className="text-[10px] text-gray-500 font-mono tracking-wider">Aguardando oportunidades...</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex w-[40%] items-center justify-center relative aspect-square max-h-[140px]">
                    <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                        <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                        <circle cx="50" cy="50" r="19" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                        <circle cx="50" cy="50" r="6" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                        <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                        <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

                        <g className="radar-sweep" style={{ transformOrigin: '50px 50px' }}>
                            <path d="M50 50 L50 5 A45 45 0 0 1 95 50 Z" fill="url(#radarGradient)" />
                            <line x1="50" y1="50" x2="50" y2="5" stroke="url(#sweepLineGradient)" strokeWidth="1.5" />
                        </g>

                        {currentAlerta && (
                            <circle cx="50" cy="50" r="3" fill="#10b981" opacity="0.8">
                                <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                            </circle>
                        )}

                        <defs>
                            <radialGradient id="sweepLineGradient" cx="50%" cy="100%" r="100%">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
                            </radialGradient>
                            <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        <circle cx="50" cy="50" r="1.5" fill="#10b981" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default ConfluenceScore;
