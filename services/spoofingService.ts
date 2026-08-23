/**
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 12, item 12.8, doc §17): dois achados
 * reais aqui. (1) O WebSocket apontava para `stream.binance.com:9443` — mercado Spot; o Gênesis
 * só opera Futures perpétuo (mesma doutrina A10). Migrado para `fstream.binance.com` (Futures).
 * (2) O nome público "Spoofing Detection"/`SpoofEvent` afirma certeza de manipulação de mercado a
 * partir de um único sinal (parede grande removida do book) — sem conciliar contra o tape de
 * negócios reais (uma parede que foi EXECUTADA por um negócio real não é spoofing, é liquidez
 * consumida legitimamente; este serviço não checa isso). Renomeado para o que o dado realmente
 * prova: retirada suspeita de parede — `WallWithdrawalEvent`/`getRecentWallWithdrawals`. A lógica
 * de detecção (limiar por liquidez do ativo, parede grande removida sem o preço ter cruzado o
 * nível) é inalterada — só o nome e a apresentação deixam de afirmar "spoofing" como fato.
 */

export interface WallWithdrawalEvent {
    type: 'BULLISH' | 'BEARISH'; // Bullish = Ask wall removed (possível resistência falsa), Bearish = Bid wall removed (possível suporte falso)
    price: number;
    volumeUsd: number;
    timestamp: number;
}

const withdrawalHistory: Record<string, WallWithdrawalEvent[]> = {};
const activeSockets: Record<string, WebSocket> = {};

// Dynamic threshold based on asset liquidity
const getWithdrawalThreshold = (symbol: string) => {
    const s = symbol.toLowerCase();
    if (s.includes('btc') || s.includes('eth')) return 1000000; // $1M for majors
    if (s.includes('sol') || s.includes('bnb') || s.includes('xrp') || s.includes('sui')) return 300000; // $300k for mid-caps
    return 100000; // $100k for altcoins
};

export const startWallWithdrawalMonitor = (symbol: string) => {
    const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    // Binance uses USDT for its main streams
    let streamSymbol = cleanSymbol;
    if (streamSymbol.endsWith('usd')) streamSymbol = streamSymbol.replace('usd', 'usdt');

    if (activeSockets[streamSymbol]) return;

    if (!withdrawalHistory[streamSymbol]) withdrawalHistory[streamSymbol] = [];

    const thresholdUsd = getWithdrawalThreshold(streamSymbol);

    try {
        const ws = new WebSocket(`wss://fstream.binance.com/ws/${streamSymbol}@depth20@100ms`);
        activeSockets[streamSymbol] = ws;

        let prevBids = new Map<number, number>();
        let prevAsks = new Map<number, number>();
        let lastPrice = 0;

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (!data.bids || !data.asks) return; // Partial Book Depth Stream (@depth20@100ms):
            // mesmo formato {lastUpdateId, bids, asks} no Spot e no Futures — só o host muda.

            const currentBids = new Map<number, number>();
            const currentAsks = new Map<number, number>();

            // Update current price approximation (mid price)
            if (data.bids.length > 0 && data.asks.length > 0) {
                lastPrice = (parseFloat(data.bids[0][0]) + parseFloat(data.asks[0][0])) / 2;
            }

            data.bids.forEach((b: string[]) => currentBids.set(parseFloat(b[0]), parseFloat(b[1])));
            data.asks.forEach((a: string[]) => currentAsks.set(parseFloat(a[0]), parseFloat(a[1])));

            // Check for removed Bid walls (possível suporte falso removido)
            prevBids.forEach((prevQty, price) => {
                const currentQty = currentBids.get(price) || 0;
                const removedQty = prevQty - currentQty;
                const removedUsd = removedQty * price;

                // If a large wall was removed and price didn't drop below this level (it wasn't executed)
                if (removedUsd > thresholdUsd && lastPrice > price) {
                    addWithdrawalEvent(streamSymbol, { type: 'BEARISH', price, volumeUsd: removedUsd, timestamp: Date.now() });
                }
            });

            // Check for removed Ask walls (possível resistência falsa removida)
            prevAsks.forEach((prevQty, price) => {
                const currentQty = currentAsks.get(price) || 0;
                const removedQty = prevQty - currentQty;
                const removedUsd = removedQty * price;

                // If a large wall was removed and price didn't rise above this level (it wasn't executed)
                if (removedUsd > thresholdUsd && lastPrice < price) {
                    addWithdrawalEvent(streamSymbol, { type: 'BULLISH', price, volumeUsd: removedUsd, timestamp: Date.now() });
                }
            });

            prevBids = currentBids;
            prevAsks = currentAsks;
        };

        ws.onerror = () => {
            ws.close();
        };

        ws.onclose = () => {
            delete activeSockets[streamSymbol];
        };
    } catch (e) {
        console.error("Wall Withdrawal Monitor Error:", e);
    }
};

const addWithdrawalEvent = (symbol: string, event: WallWithdrawalEvent) => {
    withdrawalHistory[symbol].unshift(event);
    // Keep only the last 10 events to avoid memory leaks
    if (withdrawalHistory[symbol].length > 10) withdrawalHistory[symbol].pop();
};

export const stopWallWithdrawalMonitor = (symbol: string) => {
    const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    let streamSymbol = cleanSymbol;
    if (streamSymbol.endsWith('usd')) streamSymbol = streamSymbol.replace('usd', 'usdt');

    if (activeSockets[streamSymbol]) {
        activeSockets[streamSymbol].close();
        delete activeSockets[streamSymbol];
    }
};

export const getRecentWallWithdrawals = (symbol: string, timeWindowMs = 300000): WallWithdrawalEvent[] => {
    const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    let streamSymbol = cleanSymbol;
    if (streamSymbol.endsWith('usd')) streamSymbol = streamSymbol.replace('usd', 'usdt');

    const history = withdrawalHistory[streamSymbol] || [];
    const now = Date.now();
    return history.filter(e => now - e.timestamp < timeWindowMs);
};
