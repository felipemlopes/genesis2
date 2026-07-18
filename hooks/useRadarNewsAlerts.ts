import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface RadarNewsItem {
    id: number;
    title: string;
    source: string;
    source_url: string | null;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    category: string | null;
    /** Nível 1 = destacado (crítico/acionável), Nível 2 = discreto. Nível 3 nunca chega aqui (C10). */
    nivel: 1 | 2;
    affected_assets: string[];
    market_bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    impact_summary: string | null;
    discovery_score: number | null;
    is_discovery: boolean;
    created_at: string;
    timestamp_local: number;
}

// ─── POLLING (singleton, mesmo padrao do useAlertas) ───
const POLL_INTERVAL = 10000; // 10 seconds

type RadarNewsListener = (news: RadarNewsItem) => void;

let pollInterval: NodeJS.Timeout | null = null;
let pollListeners: Set<RadarNewsListener> = new Set();
let lastNewsId: number = 0;

async function fetchNewRadarNews() {
    try {
        const token = localStorage.getItem('genesis_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${API_BASE}/v1/radar-news/poll`, { headers });
        if (!res.ok) return;

        const json = await res.json();
        const entries: any[] = json.data || [];

        for (const raw of entries) {
            if (raw.id > lastNewsId) {
                lastNewsId = raw.id;
                const item: RadarNewsItem = {
                    ...raw,
                    affected_assets: raw.affected_assets || [],
                    timestamp_local: Date.now(),
                };
                pollListeners.forEach(listener => listener(item));
            }
        }
    } catch {
        // Silencioso - nao interrompe se o servidor estiver fora
    }
}

function startPolling() {
    if (pollInterval) return;
    fetchNewRadarNews();
    pollInterval = setInterval(fetchNewRadarNews, POLL_INTERVAL);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

function subscribePolling(listener: RadarNewsListener) {
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

export const useRadarNewsAlerts = () => {
    const [news, setNews] = useState<RadarNewsItem[]>([]);
    const timersRef = useRef<{ [id: number]: NodeJS.Timeout }>({});

    const fecharNews = useCallback((id: number) => {
        setNews(prev => prev.filter(item => item.id !== id));
        if (timersRef.current[id]) {
            clearTimeout(timersRef.current[id]);
            delete timersRef.current[id];
        }
    }, []);

    const adicionarNews = useCallback((novoItem: RadarNewsItem) => {
        setNews(prev => {
            if (prev.some(n => n.id === novoItem.id)) return prev;
            const novaLista = [novoItem, ...prev].slice(0, 5);
            return novaLista;
        });

        timersRef.current[novoItem.id] = setTimeout(() => {
            fecharNews(novoItem.id);
        }, 15000); // 15s auto-dismiss
    }, [fecharNews]);

    useEffect(() => {
        const unsubscribe = subscribePolling(adicionarNews);
        return () => {
            unsubscribe();
            Object.values(timersRef.current).forEach(clearTimeout);
        };
    }, [adicionarNews]);

    return { news, fecharNews };
};
