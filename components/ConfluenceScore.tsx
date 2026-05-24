import React, { useState } from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface ConfluenceScoreProps {
  onAnalyzeAnomaly?: (ex: string, pair: string, tf: string) => void;
}

export const ConfluenceScore: React.FC<ConfluenceScoreProps> = ({ onAnalyzeAnomaly }) => {
    // DEV - CONECTAR DADOS REAIS: Este componente deve receber os dados reais do sistema de monitoramento via SSE endpoint já implementado. Substituir os dados simulados pelos dados reais da tabela genesis_alertas quando o sistema de monitoramento estiver ativo.
    const [anomaly] = useState<any>({
        detected: true, // Placeholder DEMO visível
        asset: "SOLUSDT",
        exchange: "BINANCE",
        timeframe: "4H"
    });

    const handleAnalyze = () => {
        if (onAnalyzeAnomaly && anomaly.detected) {
            onAnalyzeAnomaly(anomaly.exchange, anomaly.asset, anomaly.timeframe);
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

            {/* Linha piscante acima do container */}
            <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-genesis-accent to-transparent blinking-line-radar" />

            <div className="flex flex-row items-center w-full h-full gap-4">
                
                {/* Coluna esquerda: Textos e Card */}
                <div className="flex flex-col justify-start w-[60%] min-h-full">
                    {/* título MICRO RADAR em uma linha usando a tipografia dos títulos dos cards existentes */}
                    <div className="mb-2">
                        <span className="text-[9px] font-bold text-genesis-text-secondary uppercase tracking-widest block whitespace-nowrap">
                            Micro Radar
                        </span>
                    </div>

                    {/* subtítulo MONITORANDO ANOMALIAS em texto completo sem corte usando tipografia secundária */}
                    <div className="mb-4">
                        <span className="text-xs text-gray-400 font-mono tracking-wider block whitespace-nowrap truncate">
                            MONITORANDO ANOMALIAS
                        </span>
                    </div>

                    {anomaly.detected && (
                        <div className="bg-[#0b0b0f] rounded-lg p-3 border border-white/5 relative mt-auto shadow-inner flex flex-col justify-between">
                            {/* O badge DEMO pequeno discreto no canto superior direito */}
                            <span className="absolute top-1 right-1 text-[7px] font-bold bg-yellow-500/10 text-yellow-500/80 border border-yellow-500/20 px-1 py-0.5 rounded uppercase tracking-wider">DEMO</span>
                            
                            {/* OPORTUNIDADE DETECTADA em uma linha com ícone */}
                            <div className="flex items-center gap-1.5 mb-2.5 whitespace-nowrap">
                                <AlertTriangle size={12} className="text-genesis-positive flex-shrink-0" />
                                <span className="text-[10px] font-bold text-genesis-positive uppercase tracking-[0.1em] truncate">OPORTUNIDADE DETECTADA</span>
                            </div>
                            
                            {/* corretora e timeframe como BINANCE — 4H */}
                            <div className="mb-3 whitespace-nowrap">
                                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{anomaly.exchange} — {anomaly.timeframe}</span>
                            </div>

                            {/* botão ANALISAR AGORA seguindo estilo do botão já existente no projeto */}
                            <button 
                                onClick={handleAnalyze}
                                className="w-full flex items-center justify-center gap-2 bg-genesis-accent hover:bg-genesis-accent/90 text-white font-bold py-1.5 rounded-md text-[9px] uppercase tracking-wider transition-all mb-1.5 focus:outline-none focus:ring-1 focus:ring-genesis-accent"
                            >
                                Analisar Agora <ArrowRight size={10} />
                            </button>

                            {/* 50 créditos em tipografia pequena */}
                            <div className="text-center">
                                <span className="text-[8px] text-gray-500 font-mono tracking-wide">50 créditos</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Coluna direita: Radar centralizado (Exclusivamente SVG) */}
                <div className="flex w-[40%] items-center justify-center relative aspect-square max-h-[140px]">
                    <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        {/* 4 círculos concêntricos com stroke de baixa opacidade */}
                        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                        <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                        <circle cx="50" cy="50" r="19" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                        <circle cx="50" cy="50" r="6" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                        
                        {/* Duas linhas de grade cruzando o centro */}
                        <line x1="50" y1="5" x2="50" y2="95" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                        <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

                        {/* Linha de varredura partindo do centro até a borda + Rastro em forma de fatia de 30% */}
                        <g className="radar-sweep" style={{ transformOrigin: '50px 50px' }}>
                            {/* Rastro gradient (approximate slice using a polygon or CSS conic-gradient) */}
                            {/* Para um SVG puro do rastro fatiado: */}
                            <path d="M50 50 L50 5 A45 45 0 0 1 95 50 Z" fill="url(#radarGradient)" />
                            
                            {/* Linha de varredura principal */}
                            <line x1="50" y1="50" x2="50" y2="5" stroke="url(#sweepLineGradient)" strokeWidth="1.5" />
                        </g>

                        {/* Definition of gradients */}
                        <defs>
                            <radialGradient id="sweepLineGradient" cx="50%" cy="100%" r="100%">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
                            </radialGradient>
                            
                            {/* This simulates the 30% trailing slice fade. Note: pure SVG conic is tricky, so we use linear/radial approximation or mask */}
                            <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {/* Ponto central discreto */}
                        <circle cx="50" cy="50" r="1.5" fill="#10b981" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default ConfluenceScore;
