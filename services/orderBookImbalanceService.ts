export interface OrderBookImbalanceSnapshot {
  ratio: number;
  sinal: 'PRESSAO_COMPRADORA' | 'PRESSAO_VENDEDORA' | 'NEUTRO';
  ativo: boolean;
}

export class OrderBookImbalanceService {
  private static instances: Map<string, OrderBookImbalanceService> = new Map();
  private ws: WebSocket | null = null;
  private symbol: string;
  private isConnecting: boolean = false;
  
  private history: number[] = [];
  private currentRatio: number = 0;
  private currentSinal: 'PRESSAO_COMPRADORA' | 'PRESSAO_VENDEDORA' | 'NEUTRO' = 'NEUTRO';
  private pingInterval: any = null;

  private constructor(symbol: string) {
    this.symbol = symbol.toLowerCase();
    this.connect();
  }

  public static getInstance(symbol: string): OrderBookImbalanceService {
    const cleanSymbol = symbol.replace('/', '').toLowerCase();
    if (!this.instances.has(cleanSymbol)) {
      this.instances.set(cleanSymbol, new OrderBookImbalanceService(cleanSymbol));
    }
    return this.instances.get(cleanSymbol)!;
  }

  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(`wss://fstream.binance.com/ws/${this.symbol}@depth20@500ms`);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ method: "ping" }));
          }
        }, 1000 * 60 * 3);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.b && data.a) {
            const bids = data.b.slice(0, 10);
            const asks = data.a.slice(0, 10);
            
            let sumBids = 0;
            let sumAsks = 0;
            
            for (const bid of bids) sumBids += parseFloat(bid[1]);
            for (const ask of asks) sumAsks += parseFloat(ask[1]);
            
            const total = sumBids + sumAsks;
            if (total > 0) {
                this.currentRatio = (sumBids - sumAsks) / total;
            } else {
                this.currentRatio = 0;
            }

            this.history.push(this.currentRatio);
            if (this.history.length > 5) {
                this.history.shift();
            }

            let pressureCountPositive = 0;
            let pressureCountNegative = 0;

            for (const ratio of this.history) {
                if (ratio > 0.35) pressureCountPositive++;
                else if (ratio < -0.35) pressureCountNegative++;
            }

            if (pressureCountPositive >= 2) {
                this.currentSinal = 'PRESSAO_COMPRADORA';
            } else if (pressureCountNegative >= 2) {
                this.currentSinal = 'PRESSAO_VENDEDORA';
            } else {
                this.currentSinal = 'NEUTRO';
            }
          }
        } catch (e) {
          // ignore
        }
      };

      this.ws.onerror = () => {
        this.reconnect();
      };

      this.ws.onclose = () => {
        this.reconnect();
      };
    } catch (e) {
      this.isConnecting = false;
      this.reconnect();
    }
  }

  private reconnect() {
    this.isConnecting = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    setTimeout(() => {
      this.connect();
    }, 5000);
  }

  public getSnapshot(): OrderBookImbalanceSnapshot {
    return {
      ratio: this.currentRatio,
      sinal: this.currentSinal,
      ativo: this.currentSinal !== 'NEUTRO'
    };
  }
}
