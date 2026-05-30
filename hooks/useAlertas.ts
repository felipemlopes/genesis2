import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface AlertaGenesis {
    id: number;
    ativo: string;
    tipo: 'SPIKE_VOLUME' | 'MOVIMENTO_BRUSCO' | 'CVD_DIVERGENCIA' | 'FUNDING_EXTREMO' | 'OI_SPIKE' | 'BOOK_IMBALANCE';
    mensagem: string;
    direcao: 'BULLISH' | 'BEARISH' | 'NEUTRO';
    urgencia: 'ALTA' | 'MEDIA' | 'BAIXA';
    corretora: string;
    timeframe: string;
    score: number;
    preco_atual: number;
    variacao_pct: number;
    created_at: string;
    criado_em: string;
    timestamp_local: number;
    is_teste?: boolean;
}

// ─── POLLING (substitui SSE para compatibilidade com artisan serve) ───
// Faz GET a cada 10s buscando alertas novos. Nao prende thread do servidor.
const POLL_INTERVAL = 10000;

type AlertaListener = (alerta: AlertaGenesis) => void;

let pollInterval: NodeJS.Timeout | null = null;
let pollListeners: Set<AlertaListener> = new Set();
let lastAlertId: number = 0;

async function fetchNewAlertas() {
    try {
        const token = localStorage.getItem('genesis_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/v1/alertas/poll`, { headers });
        if (!res.ok) return;

        const json = await res.json();
        const alertas: any[] = json.data || [];

        for (const raw of alertas) {
            if (raw.id > lastAlertId) {
                lastAlertId = raw.id;
                const alerta: AlertaGenesis = {
                    ...raw,
                    criado_em: raw.created_at || raw.criado_em,
                    timestamp_local: Date.now()
                };
                pollListeners.forEach(listener => listener(alerta));
            }
        }
    } catch {
        // Silencioso - nao trava nada se o servidor estiver fora
    }
}

function startPolling() {
    if (pollInterval) return;
    fetchNewAlertas(); // Busca imediata
    pollInterval = setInterval(fetchNewAlertas, POLL_INTERVAL);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

function subscribePolling(listener: AlertaListener) {
    pollListeners.add(listener);
    if (pollListeners.size === 1) {
        startPolling();
    }
    return () => {
        pollListeners.delete(listener);
        if (pollListeners.size === 0) {
            stopPolling();
        }
    };
}

// ─── HOOK ─────────────────────────────────────────────────────

export const useAlertas = () => {
    const [alertas, setAlertas] = useState<AlertaGenesis[]>([]);
    const temporizadoresRef = useRef<{ [id: number]: NodeJS.Timeout }>({});
    
    const fecharAlerta = useCallback((id: number) => {
        setAlertas(prev => prev.filter(alerta => alerta.id !== id));
        if (temporizadoresRef.current[id]) {
            clearTimeout(temporizadoresRef.current[id]);
            delete temporizadoresRef.current[id];
        }
    }, []);

    const adicionarAlerta = useCallback((novoAlerta: AlertaGenesis) => {
        setAlertas(prev => {
            if (prev.some(a => a.id === novoAlerta.id)) return prev;
            const novaLista = [novoAlerta, ...prev].slice(0, 5);
            return novaLista;
        });

        temporizadoresRef.current[novoAlerta.id] = setTimeout(() => {
            fecharAlerta(novoAlerta.id);
        }, 12000);
    }, [fecharAlerta]);

    useEffect(() => {
        const unsubscribe = subscribePolling(adicionarAlerta);
        return () => {
            unsubscribe();
            Object.values(temporizadoresRef.current).forEach(clearTimeout);
        };
    }, [adicionarAlerta]);

    const dispararAlertaTeste = useCallback((mockDados?: Partial<AlertaGenesis>) => {
        const fakeId = Date.now() + Math.floor(Math.random() * 1000);
        const alertaMock: AlertaGenesis = {
            id: fakeId,
            ativo: mockDados?.ativo || 'BTCUSDT',
            tipo: mockDados?.tipo || 'SPIKE_VOLUME',
            mensagem: mockDados?.mensagem || 'Spike massivo detectado em simulacao de teste.',
            direcao: mockDados?.direcao || 'BULLISH',
            urgencia: mockDados?.urgencia || 'ALTA',
            corretora: mockDados?.corretora || 'BINANCE',
            timeframe: mockDados?.timeframe || '1h',
            score: mockDados?.score || 85,
            preco_atual: mockDados?.preco_atual || 65000.50,
            variacao_pct: mockDados?.variacao_pct || 2.5,
            criado_em: new Date().toISOString(),
            timestamp_local: Date.now(),
            is_teste: true,
            ...mockDados
        };
        adicionarAlerta(alertaMock);
    }, [adicionarAlerta]);
    
    const limparAlertasTeste = useCallback(() => {
        setAlertas([]);
        Object.values(temporizadoresRef.current).forEach(clearTimeout);
        temporizadoresRef.current = {};
    }, []);

    return { 
        alertas, 
        fecharAlerta, 
        dispararAlertaTeste,
        limparAlertasTeste
    };
};
