export interface CVDSnapshot {
  currentCandleDelta: number;
  cvdSlope: number;
  isDivergenceActive: boolean;
  divergenceDirection: 'BULLISH' | 'BEARISH' | 'NONE';
  symbol: string;
}

export class RealtimeCVDService {
  private static instances: Map<string, RealtimeCVDService> = new Map();
  private ws: WebSocket | null = null;
  private symbol: string;
  private isConnecting: boolean = false;
  
  private currentCandleDelta: number = 0;
  private closedDeltas: number[] = [];
  private currentPrice: number = 0;
  private startPrice: number = 0;
  private divergenceCount: number = 0;
  private activeDivergence: 'BULLISH' | 'BEARISH' | 'NONE' = 'NONE';
  private pingInterval: any = null;

  private constructor(symbol: string) {
    this.symbol = symbol.toLowerCase();
    this.connect();
  }

  public static getInstance(symbol: string): RealtimeCVDService {
    const cleanSymbol = symbol.replace('/', '').toLowerCase();
    if (!this.instances.has(cleanSymbol)) {
      this.instances.set(cleanSymbol, new RealtimeCVDService(cleanSymbol));
    }
    return this.instances.get(cleanSymbol)!;
  }

  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(`wss://fstream.binance.com/ws/${this.symbol}@aggTrade`);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.pingInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ method: "ping" }));
          }
        }, 1000 * 60 * 3); // Keep-alive 3 min
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.e === 'aggTrade') {
            const price = parseFloat(data.p);
            const qty = parseFloat(data.q);
            const isBuyerMaker = data.m; // true = aggressive sell, false = aggressive buy
            
            if (this.startPrice === 0) this.startPrice = price;
            this.currentPrice = price;

            if (isBuyerMaker) {
               // Agressão de venda
               this.currentCandleDelta -= qty;
            } else {
               // Agressão de compra
               this.currentCandleDelta += qty;
            }

            this.checkDivergence();
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

  // Recebe deltas fechados de candles recém finalizados para o histórico (via API ou mock simulado por nós para ter slope)
  // Como simplificação, injetaremos 10 candles aleatorios / ou vindos da base. 
  // O Service mantém o histórico dos últimos 10 deltas passados
  public populateHistory(pastDeltas: number[]) {
    this.closedDeltas = pastDeltas.slice(-10);
  }

  private calculateSlope(): number {
    const data = [...this.closedDeltas, this.currentCandleDelta];
    const n = data.length;
    if (n < 2) return 0;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += data[i];
        sumXY += i * data[i];
        sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private checkDivergence() {
    const slope = this.calculateSlope();
    const priceChange = this.currentPrice - this.startPrice;

    // Divergência detectada:
    // Preço subindo mas CVD slope negativo = BEARISH
    if (priceChange > 0 && slope < 0) {
      if (this.activeDivergence !== 'BEARISH') {
        this.divergenceCount++;
        if (this.divergenceCount >= 3) {
          this.activeDivergence = 'BEARISH';
        }
      }
    } 
    // Preço caindo mas CVD slope positivo = BULLISH
    else if (priceChange < 0 && slope > 0) {
      if (this.activeDivergence !== 'BULLISH') {
        this.divergenceCount++;
        if (this.divergenceCount >= 3) {
          this.activeDivergence = 'BULLISH';
        }
      }
    } else {
      this.divergenceCount = 0;
      this.activeDivergence = 'NONE';
    }
  }

  public getSnapshot(): CVDSnapshot {
    return {
      currentCandleDelta: this.currentCandleDelta,
      cvdSlope: this.calculateSlope(),
      isDivergenceActive: this.activeDivergence !== 'NONE',
      divergenceDirection: this.activeDivergence,
      symbol: this.symbol
    };
  }
}
