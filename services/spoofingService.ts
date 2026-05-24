export interface SpoofEvent {
    type: 'BULLISH' | 'BEARISH'; // Bullish = Ask wall removed (fake resistance), Bearish = Bid wall removed (fake support)
    price: number;
    volumeUsd: number;
    timestamp: number;
}

const spoofHistory: Record<string, SpoofEvent[]> = {};
const activeSockets: Record<string, WebSocket> = {};

// Dynamic threshold based on asset liquidity
const getSpoofThreshold = (symbol: string) => {
    const s = symbol.toLowerCase();
    if (s.includes('btc') || s.includes('eth')) return 1000000; // $1M for majors
    if (s.includes('sol') || s.includes('bnb') || s.includes('xrp') || s.includes('sui')) return 300000; // $300k for mid-caps
    return 100000; // $100k for altcoins
};

export const startSpoofingMonitor = (symbol: string) => {
    const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    // Binance uses USDT for its main streams
    let streamSymbol = cleanSymbol;
    if (streamSymbol.endsWith('usd')) streamSymbol = streamSymbol.replace('usd', 'usdt');
    
    if (activeSockets[streamSymbol]) return;

    if (!spoofHistory[streamSymbol]) spoofHistory[streamSymbol] = [];

    const thresholdUsd = getSpoofThreshold(streamSymbol);

    try {
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${streamSymbol}@depth20@100ms`);
        activeSockets[streamSymbol] = ws;

        let prevBids = new Map<number, number>();
        let prevAsks = new Map<number, number>();
        let lastPrice = 0;

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (!data.bids || !data.asks) return;

            const currentBids = new Map<number, number>();
            const currentAsks = new Map<number, number>();

            // Update current price approximation (mid price)
            if (data.bids.length > 0 && data.asks.length > 0) {
                lastPrice = (parseFloat(data.bids[0][0]) + parseFloat(data.asks[0][0])) / 2;
            }

            data.bids.forEach((b: string[]) => currentBids.set(parseFloat(b[0]), parseFloat(b[1])));
            data.asks.forEach((a: string[]) => currentAsks.set(parseFloat(a[0]), parseFloat(a[1])));

            // Check for removed Bid walls (Bearish Spoofing - Fake Support Removed)
            prevBids.forEach((prevQty, price) => {
                const currentQty = currentBids.get(price) || 0;
                const removedQty = prevQty - currentQty;
                const removedUsd = removedQty * price;

                // If a large wall was removed and price didn't drop below this level (it wasn't executed)
                if (removedUsd > thresholdUsd && lastPrice > price) {
                    addSpoofEvent(streamSymbol, { type: 'BEARISH', price, volumeUsd: removedUsd, timestamp: Date.now() });
                }
            });

            // Check for removed Ask walls (Bullish Spoofing - Fake Resistance Removed)
            prevAsks.forEach((prevQty, price) => {
                const currentQty = currentAsks.get(price) || 0;
                const removedQty = prevQty - currentQty;
                const removedUsd = removedQty * price;

                // If a large wall was removed and price didn't rise above this level (it wasn't executed)
                if (removedUsd > thresholdUsd && lastPrice < price) {
                    addSpoofEvent(streamSymbol, { type: 'BULLISH', price, volumeUsd: removedUsd, timestamp: Date.now() });
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
        console.error("Spoofing Monitor Error:", e);
    }
};

const addSpoofEvent = (symbol: string, event: SpoofEvent) => {
    spoofHistory[symbol].unshift(event);
    // Keep only the last 10 events to avoid memory leaks
    if (spoofHistory[symbol].length > 10) spoofHistory[symbol].pop(); 
};

export const stopSpoofingMonitor = (symbol: string) => {
    const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    let streamSymbol = cleanSymbol;
    if (streamSymbol.endsWith('usd')) streamSymbol = streamSymbol.replace('usd', 'usdt');

    if (activeSockets[streamSymbol]) {
        activeSockets[streamSymbol].close();
        delete activeSockets[streamSymbol];
    }
};

export const getRecentSpoofs = (symbol: string, timeWindowMs = 300000): SpoofEvent[] => {
    const cleanSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    let streamSymbol = cleanSymbol;
    if (streamSymbol.endsWith('usd')) streamSymbol = streamSymbol.replace('usd', 'usdt');

    const history = spoofHistory[streamSymbol] || [];
    const now = Date.now();
    return history.filter(e => now - e.timestamp < timeWindowMs);
};
