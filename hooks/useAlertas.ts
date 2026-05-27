import { useState, useEffect, useCallback, useRef } from 'react';
import { connectAlertasSSE } from '../services/api';

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
    criado_em: string;
    timestamp_local: number;
    is_teste?: boolean;
}

export const useAlertas = () => {
    const [alertas, setAlertas] = useState<AlertaGenesis[]>([]);
    const temporizadoresRef = useRef<{ [id: number]: NodeJS.Timeout }>({});
    
    // Função para remover um alerta
    const fecharAlerta = useCallback((id: number) => {
        setAlertas(prev => prev.filter(alerta => alerta.id !== id));
        if (temporizadoresRef.current[id]) {
            clearTimeout(temporizadoresRef.current[id]);
            delete temporizadoresRef.current[id];
        }
    }, []);

    // Função interna para adicionar alertas recebidos
    const adicionarAlerta = useCallback((novoAlerta: AlertaGenesis) => {
        setAlertas(prev => {
            // Verifica se o ID já existe para não duplicar
            if (prev.some(a => a.id === novoAlerta.id)) return prev;
            
            // Mantém apenas os 5 mais recentes
            const novaLista = [novoAlerta, ...prev].slice(0, 5);
            return novaLista;
        });

        // Configura remoção automática após 12 segundos
        temporizadoresRef.current[novoAlerta.id] = setTimeout(() => {
            fecharAlerta(novoAlerta.id);
        }, 12000);
    }, [fecharAlerta]);

    useEffect(() => {
        // Desativado a pedido do usuário: O frontend não vai mais se comunicar com o SSE de alertas.
        /*
        let originEventSource: EventSource | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connectSSE = () => {
            originEventSource = connectAlertasSSE((data) => {
                adicionarAlerta({
                    ...data,
                    timestamp_local: Date.now()
                });
            });

            originEventSource.onerror = (error) => {
                console.error("Conexao SSE de alertas falhou, reconectando em 3s...", error);
                originEventSource?.close();
                reconnectTimeout = setTimeout(connectSSE, 3000);
            };
        };

        connectSSE();
        */

        // Cleanup da conexão e temporizadores ao desmontar o hook
        return () => {
            /*
            if (originEventSource) {
                originEventSource.close();
            }
            clearTimeout(reconnectTimeout);
            */
            // Limpa todos os temporizadores pendentes
            Object.values(temporizadoresRef.current).forEach(clearTimeout);
        };
    }, [adicionarAlerta]);

    // Função de preview: cria um alerta falso sem bater na API
    const dispararAlertaTeste = useCallback((mockDados?: Partial<AlertaGenesis>) => {
        const fakeId = Date.now() + Math.floor(Math.random() * 1000);
        
        const alertaMock: AlertaGenesis = {
            id: fakeId,
            ativo: mockDados?.ativo || 'BTCUSDT',
            tipo: mockDados?.tipo || 'SPIKE_VOLUME',
            mensagem: mockDados?.mensagem || 'Spike massivo detectado em simulação de teste.',
            direcao: mockDados?.direcao || 'BULLISH',
            urgencia: mockDados?.urgencia || 'ALTA',
            corretora: mockDados?.corretora || 'BINANCE',
            preco_atual: mockDados?.preco_atual || 65000.50,
            variacao_pct: mockDados?.variacao_pct || 2.5,
            criado_em: new Date().toISOString(),
            timestamp_local: Date.now(),
            is_teste: true,
            ...mockDados
        };

        adicionarAlerta(alertaMock);
    }, [adicionarAlerta]);
    
    // Preview extra: limpar tudo
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
