import React, { useEffect, useState } from 'react';
import { useAlertas, AlertaGenesis } from '../hooks/useAlertas';
import { X, Activity, Zap, TrendingUp, TrendingDown, Eye, AlertTriangle, ShieldAlert, BarChart3, Database } from 'lucide-react';

const ICONS_MAP = {
    'SPIKE_VOLUME': BarChart3,
    'MOVIMENTO_BRUSCO': Zap,
    'CVD_DIVERGENCIA': Eye,
    'FUNDING_EXTREMO': AlertTriangle,
    'OI_SPIKE': Database,
    'BOOK_IMBALANCE': ShieldAlert,
};

const AlertaCard: React.FC<{ alerta: AlertaGenesis, onClose: (id: number) => void }> = ({ alerta, onClose }) => {
    const Icon = ICONS_MAP[alerta.tipo] || Activity;
    const isBullish = alerta.direcao === 'BULLISH';
    const isBearish = alerta.direcao === 'BEARISH';
    
    // Cores dinâmicas de acordo com a direção (mantendo paleta genesis)
    const colorBg = isBullish ? 'bg-genesis-positive/10' : isBearish ? 'bg-genesis-negative/10' : 'bg-genesis-accent/10';
    const colorText = isBullish ? 'text-genesis-positive' : isBearish ? 'text-genesis-negative' : 'text-genesis-accent';
    const colorBorder = isBullish ? 'border-genesis-positive/30' : isBearish ? 'border-genesis-negative/30' : 'border-genesis-accent/30';
    const glow = isBullish ? 'shadow-[0_0_15px_rgba(16,185,129,0.2)]' : isBearish ? 'shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'shadow-[0_0_15px_rgba(139,92,246,0.2)]';

    return (
        <div className={`relative flex flex-col pointer-events-auto bg-[#0a0a0f] border ${colorBorder} rounded-xl p-4 mb-3 w-[350px] shadow-2xl ${glow} animate-in slide-in-from-right fade-in duration-500 overflow-hidden`}>
            {/* Countdown / Progresso baseado nos 12 segundos */}
            <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full animate-[progress_12s_linear_forwards] origin-left" />
            
            <button onClick={() => onClose(alerta.id)} className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">
                <X size={16} />
            </button>

            <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colorBg}`}>
                    <Icon size={16} className={colorText} />
                </div>
                <div className="flex flex-col flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base tracking-widest">{alerta.ativo}</span>
                        <span className="text-[9px] bg-white/10 text-gray-300 font-bold px-1.5 py-0.5 rounded uppercase">{alerta.corretora}</span>
                        {alerta.is_teste && <span className="text-[9px] bg-genesis-accent text-white font-bold px-1.5 py-0.5 rounded uppercase">TESTE</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${colorText}`}>
                            {alerta.direcao}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase">&bull; {alerta.tipo.replace('_', ' ')}</span>
                    </div>
                </div>
            </div>

            <p className="text-gray-300 text-xs mt-2 leading-relaxed mb-3">
                {alerta.mensagem}
            </p>

            <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Preço Atual</span>
                    <span className="font-mono text-white text-sm font-bold">
                        ${alerta.preco_atual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </span>
                </div>
                
                <div className="flex flex-col items-end">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Horário</span>
                    <span className="font-mono text-gray-400 text-xs">
                        {new Date(alerta.criado_em).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                </div>
            </div>
            
            <style>{`
                @keyframes progress {
                    from { transform: scaleX(1); }
                    to { transform: scaleX(0); }
                }
            `}</style>
        </div>
    );
};

// ============================================================================
// PAINEL DE PREVIEW DE ALERTAS (Apenas com ?preview=alertas na URL)
// ============================================================================
const PreviewPanel: React.FC<{ 
    dispararAlertaTeste: (d?: any) => void; 
    limparAlertasTeste: () => void;
}> = ({ dispararAlertaTeste, limparAlertasTeste }) => {
    
    // Dados fixtícios sugeridos
    const mocks = {
        ativos: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT'],
        corretoras: ['BINANCE', 'BYBIT', 'OKX', 'BITGET'],
        precos: [43250.00, 2340.50, 98.75, 312.40, 0.5212, 0.4855]
    };

    const rng = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

    const gerarAleatorio = (tipo: string, direcao: string) => {
        const idx = Math.floor(Math.random() * mocks.ativos.length);
        return {
            ativo: mocks.ativos[idx],
            preco_atual: mocks.precos[idx],
            corretora: rng(mocks.corretoras),
            tipo: tipo,
            direcao: direcao
        };
    };

    return (
        <div className="fixed bottom-4 left-4 z-[999999] bg-[#0a0a0f] border border-genesis-accent/30 rounded-xl p-4 shadow-2xl w-[320px] pointer-events-auto">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-3">
                <div className="flex items-center gap-2">
                    <Zap size={14} className="text-genesis-accent" />
                    <span className="font-bold text-xs uppercase tracking-widest text-white">Preview de Alertas</span>
                </div>
                <span className="text-[10px] bg-genesis-accent/20 text-genesis-accent px-1.5 rounded">DEV</span>
            </div>

            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                <button onClick={() => dispararAlertaTeste({ ...gerarAleatorio('SPIKE_VOLUME', 'BULLISH'), mensagem: "Volume de compra atingiu pico anormal." })} className="text-[10px] text-left p-1.5 bg-white/5 hover:bg-white/10 rounded">Spike Volume (BULL)</button>
                <button onClick={() => dispararAlertaTeste({ ...gerarAleatorio('SPIKE_VOLUME', 'BEARISH'), mensagem: "Despejo massivo identificado." })} className="text-[10px] text-left p-1.5 bg-white/5 hover:bg-white/10 rounded">Spike Volume (BEAR)</button>
                <button onClick={() => dispararAlertaTeste({ ...gerarAleatorio('MOVIMENTO_BRUSCO', 'BULLISH'), mensagem: "Pump violentíssimo nos últimos 60s." })} className="text-[10px] text-left p-1.5 bg-white/5 hover:bg-white/10 rounded">Movimento Brusco (BULL)</button>
                <button onClick={() => dispararAlertaTeste({ ...gerarAleatorio('MOVIMENTO_BRUSCO', 'BEARISH'), mensagem: "Queda rápida de preço. Crash local." })} className="text-[10px] text-left p-1.5 bg-white/5 hover:bg-white/10 rounded">Movimento Brusco (BEAR)</button>
                <button onClick={() => dispararAlertaTeste({ ...gerarAleatorio('CVD_DIVERGENCIA', 'BULLISH'), mensagem: "Absorção compradora. CVD sugere reversão." })} className="text-[10px] text-left p-1.5 bg-white/5 hover:bg-white/10 rounded">Divergência CVD</button>
                <button onClick={() => dispararAlertaTeste({ ...gerarAleatorio('FUNDING_EXTREMO', 'BEARISH'), mensagem: "Risco altíssimo de Long Squeeze." })} className="text-[10px] text-left p-1.5 bg-white/5 hover:bg-white/10 rounded">Funding Extremo</button>
                <button onClick={() => dispararAlertaTeste({ ...gerarAleatorio('OI_SPIKE', 'NEUTRO'), mensagem: "Injeção anormal de contratos futuros." })} className="text-[10px] text-left p-1.5 bg-white/5 hover:bg-white/10 rounded">Spike de Open Interest</button>
                <button onClick={() => dispararAlertaTeste({ ...gerarAleatorio('BOOK_IMBALANCE', 'BULLISH'), mensagem: "Parede de Bids engolindo Asks." })} className="text-[10px] text-left p-1.5 bg-white/5 hover:bg-white/10 rounded">Desequilíbrio de Book</button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/5">
                <button 
                  onClick={() => {
                      const tipos = ['SPIKE_VOLUME', 'MOVIMENTO_BRUSCO', 'CVD_DIVERGENCIA', 'FUNDING_EXTREMO', 'OI_SPIKE', 'BOOK_IMBALANCE'];
                      const dirs = ['BULLISH', 'BEARISH', 'NEUTRO'];
                      dispararAlertaTeste({ ...gerarAleatorio(rng(tipos), rng(dirs)), mensagem: "Alerta aleatório gerado pelo preview."});
                  }} 
                  className="bg-genesis-accent text-white text-[9px] font-bold py-1.5 rounded hover:bg-purple-600 transition-colors uppercase tracking-widest text-center">
                  Aleatório
                </button>
                
                <button 
                  onClick={() => {
                      dispararAlertaTeste({...gerarAleatorio('SPIKE_VOLUME', 'BULLISH'), urgencia: 'MEDIA'});
                      setTimeout(() => dispararAlertaTeste({...gerarAleatorio('OI_SPIKE', 'NEUTRO'), urgencia: 'ALTA'}), 2000);
                      setTimeout(() => dispararAlertaTeste({...gerarAleatorio('MOVIMENTO_BRUSCO', 'BULLISH'), urgencia: 'ALTA'}), 4000);
                  }} 
                  className="bg-purple-900 border border-genesis-accent/50 text-white text-[9px] font-bold py-1.5 rounded hover:bg-purple-800 transition-colors uppercase tracking-widest text-center">
                  Simular Combo
                </button>
            </div>

            <button onClick={limparAlertasTeste} className="w-full mt-2 border border-white/10 text-gray-400 text-[9px] font-bold py-1.5 rounded hover:bg-white/5 hover:text-white transition-colors uppercase tracking-widest text-center">
               Limpar Todos
            </button>
        </div>
    );
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
const AlertaPopup: React.FC = () => {
    const { alertas, fecharAlerta, dispararAlertaTeste, limparAlertasTeste } = useAlertas();
    const [showPreview, setShowPreview] = useState(false);

    // Habilita modo preview pela URL
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hasPreviewString = window.location.search.includes('preview=alertas');
            if (hasPreviewString) setShowPreview(true);
        }
    }, []);

    return (
        <>
            {/* O container deve ter pointer-events-none para não bloquear cliques na tela inteira.
                Os cards terão pointer-events-auto. Z-index altissimo. */}
            <div className="fixed top-24 right-4 z-[999999] pointer-events-none flex flex-col items-end">
                {alertas.map(alerta => (
                    <AlertaCard key={alerta.id} alerta={alerta} onClose={fecharAlerta} />
                ))}
            </div>

            {/* Renderiza o painel de preview do dev se solicitado */}
            {showPreview && (
                <PreviewPanel 
                   dispararAlertaTeste={dispararAlertaTeste} 
                   limparAlertasTeste={limparAlertasTeste} 
                />
            )}
        </>
    );
};

export default AlertaPopup;
