const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// --- TIPAGEM E CATEGORIAS ---
export type Category = 'WAR' | 'ENERGY' | 'SHIPPING' | 'CENTRAL_BANK' | 'SANCTIONS' | 'SUPPLY_CHAIN' | 'CYBER' | 'ELECTION' | 'CIVIL_UNREST' | 'TRADE' | 'MILITARY' | 'DIPLOMACY' | 'COMMODITIES';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MarketBias = 'BULLISH' | 'BEARISH' | 'RISK_OFF' | 'RISK_ON' | 'INFLATIONARY' | 'DEFLATIONARY' | 'SUPPLY_SHOCK' | 'NEUTRAL';

export interface GeoEvent {
  id: string;
  title: string;
  summary: string;
  category: Category;
  coordinates: [number, number];
  location: string;
  region: string;
  severity: Severity;
  market_impact: {
    signal: MarketBias;
    asset: string;
    impacted_assets: string[];
    us_market_impact?: string;
    crypto_impact?: string;
  };
  timestamp: number;
  marketWeight: number; // 1-100
  relevance: number; // 1-10
  confidence: number; // 0-1
  status: 'ESCALATING' | 'STABLE' | 'COOLING';
  sourceUrl: string;
  isNew?: boolean;
}

// --- ENGINE DE PROCESSAMENTO (POLLING BACKEND) ---
class GeopoliticalEngine {
  private events: GeoEvent[] = [];
  private listeners: Set<(events: GeoEvent[], delta: GeoEvent | null) => void> = new Set();
  private interval: ReturnType<typeof setInterval> | null = null;
  private pollInterval: number = 30000; // 30 segundos

  constructor() {
    // Nao inicia automaticamente
  }

  public start() {
    if (this.isActive()) return;
    this.poll();
    this.interval = setInterval(() => this.poll(), this.pollInterval);
  }

  public stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  public isActive(): boolean {
    return this.interval !== null;
  }

  private async poll() {
    try {
      const token = localStorage.getItem('genesis_token');
      const response = await fetch(`${API_BASE}/v1/geo-events`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`GET /api/v1/geo-events failed: ${response.status}`);
      }

      const json = await response.json();
      const newEvents: GeoEvent[] = (json.data || []).map((e: any) => ({
        ...e,
        isNew: true,
      }));

      for (const event of newEvents) {
        this.events = [event, ...this.events].slice(0, 100);
        this.notify(event);
      }
    } catch (err) {
      console.error('[GeoEngine] Polling error:', err);
      // Retry no proximo ciclo de 30s sem interromper o radar
    }
  }

  private notify(delta: GeoEvent | null) {
    this.listeners.forEach(l => l([...this.events], delta));
  }

  public subscribe(listener: (events: GeoEvent[], delta: GeoEvent | null) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getEvents() {
    return this.events;
  }
}

export const geoEngine = new GeopoliticalEngine();
