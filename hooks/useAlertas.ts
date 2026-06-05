import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface AlertaGenesis {
    id: number;
    tipo: 'SPIKE_VOLUME' | 'MOVIMENTO_BRUSCO' | 'CVD_DIVERGENCIA' | 'FUNDING_EXTREMO' | 'OI_SPIKE' | 'BOOK_IMBALANCE';
    mensagem: string;
    direcao: 'BULLISH' | 'BEARISH' | 'NEUTRO';
    urgencia: 'ALTA' | 'MEDIA' | 'BAIXA';
    timeframe: string;
    score: number;
    variacao_pct: number;
    created_at: string;
    criado_em: string;
    timestamp_local: number;
    // New required fields
    motivos: { label: string; value: string }[];
    timeframes: string[];
    expires_at: string;
    // Paywall — optional until revealed
    ativo?: string;
    corretora?: string;
    preco_atual?: number;
    revelado?: boolean;
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

    const fecharAlerta = useCallback((id: number) => {
        setAlertas(prev => prev.filter(alerta => alerta.id !== id));
    }, []);

    const adicionarAlerta = useCallback((novoAlerta: AlertaGenesis) => {
        setAlertas(prev => {
            if (prev.some(a => a.id === novoAlerta.id)) return prev;
            // Only keep the latest alert — new one replaces all previous
            return [novoAlerta];
        });
    }, []);

    useEffect(() => {
        const unsubscribe = subscribePolling(adicionarAlerta);
        return () => {
            unsubscribe();
        };
    }, [adicionarAlerta]);

    return { 
        alertas, 
        fecharAlerta
    };
};
