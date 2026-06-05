import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, Lock } from 'lucide-react';
import { AlertaGenesis } from '../hooks/useAlertas';
import { revealAlerta } from '../services/api';

interface AlertCardProps {
    alerta: AlertaGenesis;
    onReveal?: (alertId: number) => Promise<void>;
}

const direcaoIcon = {
    BULLISH: <TrendingUp size={12} className="text-emerald-400" />,
    BEARISH: <TrendingDown size={12} className="text-red-400" />,
    NEUTRO: <Minus size={12} className="text-gray-400" />,
};

const direcaoColor = {
    BULLISH: 'text-emerald-400',
    BEARISH: 'text-red-400',
    NEUTRO: 'text-gray-400',
};

const tipoLabel: Record<string, string> = {
    SPIKE_VOLUME: 'Spike Volume',
    MOVIMENTO_BRUSCO: 'Mov. Brusco',
    CVD_DIVERGENCIA: 'CVD Diverg.',
    FUNDING_EXTREMO: 'Funding Ext.',
    OI_SPIKE: 'OI Spike',
    BOOK_IMBALANCE: 'Book Imbal.',
};

function getConfluenceBadge(timeframes: string[]): { label: string | null; colorClass: string; pulse: boolean } | null {
    const count = timeframes?.length ?? 0;
    if (count <= 0) return null;
    if (count === 1) return { label: null, colorClass: 'bg-emerald-500', pulse: false };
    if (count === 2) return { label: 'CONFLUÊNCIA', colorClass: 'bg-yellow-500', pulse: false };
    if (count === 3) return { label: 'CONFLUÊNCIA FORTE', colorClass: 'bg-orange-500', pulse: false };
    return { label: 'CONFLUÊNCIA MÁXIMA', colorClass: 'bg-red-500', pulse: true };
}

function isExpired(alerta: AlertaGenesis): boolean {
    const now = Date.now();
    // Prefer expires_at if available, otherwise compute from criado_em + 4h
    if (alerta.expires_at) {
        const expiresAt = new Date(alerta.expires_at).getTime();
        return expiresAt < now;
    }
    if (alerta.criado_em) {
        const criadoEm = new Date(alerta.criado_em).getTime();
        const fourHoursMs = 4 * 60 * 60 * 1000;
        return (criadoEm + fourHoursMs) < now;
    }
    return false;
}

function formatTimestamp(criado_em: string): string {
    try {
        const date = new Date(criado_em);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '--:--';
    }
}

export const AlertCard: React.FC<AlertCardProps> = ({ alerta, onReveal }) => {
    const { id, score, tipo, direcao, motivos, timeframes, criado_em, ativo, corretora, preco_atual, revelado } = alerta;
    const [revealing, setRevealing] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorType, setErrorType] = useState<'credits' | 'network' | null>(null);
    const [idempotencyKey] = useState(() => crypto.randomUUID());
    const navigate = useNavigate();

    const isRevealed = revelado === true || (ativo != null && corretora != null);
    const expired = isExpired(alerta);

    const handleRevealClick = () => {
        setShowConfirm(true);
    };

    const handleConfirm = async () => {
        setShowConfirm(false);
        if (revealing) return;
        setRevealing(true);
        setError(null);
        setErrorType(null);

        try {
            if (onReveal) {
                await onReveal(id);
                return;
            }

            const result = await revealAlerta(id, idempotencyKey);

            if (!result.success) {
                const msg = result.error || 'Créditos insuficientes';
                const isCreditsError = msg.toLowerCase().includes('crédit') || msg.toLowerCase().includes('insuficiente');
                setError(msg);
                setErrorType(isCreditsError ? 'credits' : 'network');
                return;
            }

            const symbol = result.ativo;
            const exchange = result.corretora;
            const timeframe = result.timeframes?.[0] || timeframes?.[0] || '1h';
            const radarId = id;

            navigate(`/dashboard?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}&timeframe=${encodeURIComponent(timeframe)}&radar_id=${radarId}`);
        } catch (err: any) {
            setError('Erro de rede. Tente novamente.');
            setErrorType('network');
        } finally {
            setRevealing(false);
        }
    };

    return (
        <div className={`bg-[#0b0b0f] rounded-lg p-2.5 border border-white/5 shadow-inner transition-all duration-300 ${expired ? 'opacity-50' : ''}`}>
            {/* Expiration badge */}
            {expired && (
                <div className="mb-2">
                    <span className="inline-flex items-center text-[8px] font-bold px-2 py-0.5 rounded-full text-white bg-gray-600">
                        EXPIRADO
                    </span>
                </div>
            )}

            {/* Header: score + tipo + direcao + timestamp */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{score}</span>
                    <span className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">
                        {tipoLabel[tipo] || tipo}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold uppercase ${direcaoColor[direcao]}`}>
                        {direcao}
                    </span>
                    {direcaoIcon[direcao]}
                </div>
            </div>

            {/* Motivos badges */}
            {motivos && motivos.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {motivos.map((motivo, idx) => (
                        <span
                            key={idx}
                            className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-gray-300 border border-white/10"
                        >
                            {motivo.label}
                        </span>
                    ))}
                </div>
            )}

            {/* Confluence badge */}
            {(() => {
                const badge = getConfluenceBadge(timeframes);
                if (!badge) return null;
                if (!badge.label) {
                    // 1 timeframe: small green dot indicator
                    return (
                        <div className="mb-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                        </div>
                    );
                }
                return (
                    <div className="mb-2">
                        <span
                            className={`inline-flex items-center text-[8px] font-bold px-2 py-0.5 rounded-full text-white ${badge.colorClass} ${badge.pulse ? 'animate-pulse' : ''}`}
                        >
                            {badge.label}
                        </span>
                    </div>
                );
            })()}

            {/* Timeframes + timestamp */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex gap-1">
                    {timeframes && timeframes.map((tf) => (
                        <span
                            key={tf}
                            className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-genesis-accent/10 text-genesis-accent border border-genesis-accent/20"
                        >
                            {tf}
                        </span>
                    ))}
                </div>
                <span className="text-[8px] text-gray-500 font-mono">
                    {formatTimestamp(criado_em)}
                </span>
            </div>

            {/* Paywall state: revealed vs hidden */}
            {isRevealed ? (
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    <span className="text-[10px] font-mono text-genesis-accent font-bold">{ativo}</span>
                    <span className="text-[9px] text-gray-400">{corretora}</span>
                    {preco_atual != null && (
                        <span className="text-[9px] text-white ml-auto font-mono">${preco_atual}</span>
                    )}
                </div>
            ) : (
                <div className="pt-1 border-t border-white/5">
                    <button
                        onClick={handleRevealClick}
                        disabled={revealing}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-genesis-accent/10 hover:bg-genesis-accent/20 border border-genesis-accent/30 text-genesis-accent text-[10px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Lock size={10} />
                        {revealing ? 'Revelando...' : 'Revelar e Analisar — 50 créditos'}
                    </button>
                    {error && (
                        <div className="mt-1.5 text-center">
                            <p className={`text-[9px] ${errorType === 'credits' ? 'text-amber-400' : 'text-red-400'}`}>
                                {error}
                            </p>
                            {errorType === 'network' && (
                                <button
                                    onClick={handleConfirm}
                                    disabled={revealing}
                                    className="mt-1 text-[9px] text-genesis-accent underline hover:text-genesis-accent/80 disabled:opacity-50"
                                >
                                    Tentar novamente
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Confirmation modal */}
            {showConfirm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }}>
                    <style>{`
                        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                    `}</style>
                    <div className="bg-[#0d0d12] border border-genesis-accent/30 rounded-xl p-6 max-w-[320px] w-full mx-4 shadow-[0_0_40px_rgba(139,92,246,0.15)]" style={{ animation: 'scaleIn 0.2s ease-out' }}>
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-genesis-accent/10 border border-genesis-accent/30 flex items-center justify-center mb-4">
                                <Lock size={20} className="text-genesis-accent" />
                            </div>
                            <h3 className="text-sm font-bold text-white mb-1">Confirmar Revelação</h3>
                            <p className="text-[11px] text-gray-400 mb-4">
                                Serão debitados <span className="text-genesis-accent font-bold">50 créditos</span> da sua conta para revelar o ativo e preencher a análise automaticamente.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setShowConfirm(false)}
                                    className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-gray-400 hover:bg-white/10 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="flex-1 py-2 rounded-lg bg-genesis-accent/20 border border-genesis-accent/40 text-[11px] font-bold text-genesis-accent hover:bg-genesis-accent/30 transition-colors"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default AlertCard;
