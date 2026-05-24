import { Type } from "@google/genai";

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

// --- ENGINE DE PROCESSAMENTO ---
class GeopoliticalEngine {
  private events: GeoEvent[] = [];
  private eventCache: Map<string, GeoEvent> = new Map();
  private listeners: Set<(events: GeoEvent[], delta: GeoEvent | null) => void> = new Set();
  private interval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  private lastFetchTime: number = 0;
  private lastSynthesisTime: number = 0;
  private fetchInterval: number = 180000; // 3 minutos
  private synthesisInterval: number = 180000; // 3 minutos

  private retryCount: number = 0;
  private maxRetries: number = 3;

  constructor() {
    // Não inicia automaticamente
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

  // Utilitário para retry com exponential backoff
  private async withRetry<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        return await fn();
      } catch (e: any) {
        if (e.message?.includes('429') || e.status === 'RESOURCE_EXHAUSTED') {
          const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000;
          console.warn(`[${label}] Cota excedida. Tentativa ${attempt + 1} em ${Math.round(delay)}ms`);
          await new Promise(r => setTimeout(r, delay));
          attempt++;
        } else {
          console.error(`[${label}] Erro não recuperável:`, e);
          return null;
        }
      }
    }
    return null;
  }

  // 1. CAMADA DE COLETA (FAST - Gemini 2.5 Flash com Grounding Search)
  private async fetchRawSignals(): Promise<any[]> {
    return this.withRetry(async () => {
      
      const promptText = `Faça uma busca pelas notícias geopolíticas e macroeconômicas mais críticas e recentes (últimas 24h) com impacto no mercado financeiro global e criptomoedas. Retorne exatamente 3 ou 4 eventos mais relevantes.

RETORNE ESTRITAMENTE EM FORMATO JSON UM ARRAY DE OBJETOS COM AS SEGUINTES PROPRIEDADES:
[
  {
    "title": "string",
    "summary": "string",
    "category": "WAR | ENERGY | SHIPPING | CENTRAL_BANK | SANCTIONS | SUPPLY_CHAIN | CYBER | ELECTION | CIVIL_UNREST | TRADE | MILITARY | DIPLOMACY | COMMODITIES",
    "region": "MIDDLE_EAST | EUROPE | ASIA | NORTH_AMERICA | SOUTH_AMERICA | AFRICA | RUSSIA | CHINA",
    "location": "string",
    "severity": "LOW | MEDIUM | HIGH | CRITICAL",
    "bias": "BULLISH | BEARISH | RISK_OFF | RISK_ON | INFLATIONARY | DEFLATIONARY | SUPPLY_SHOCK | NEUTRAL",
    "asset": "string",
    "impacted_assets": ["string"],
    "us_market_impact": "string",
    "crypto_impact": "string",
    "sourceUrl": "string"
  }
]

Retorne apenas o JSON, sem nenhum texto adicional.`;

      try {
        const response = await fetch('/api/gemini-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemini-2.5-flash',
            contents: promptText,
            config: {
              tools: [{ googleSearch: {} }]
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Proxy request failed: ${response.status}`);
        }

        const jsonResponse = await response.json();
        let text = jsonResponse.text;
        if (!text) return this.getFallbackData();
        
        text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        return JSON.parse(text);
      } catch (err) {
        console.warn("[GeoEngine] Falha na chamada via proxy. Usando dados estáticos.", err);
        return this.getFallbackData();
      }
    }, "GeopoliticalScan");
  }

  private getFallbackData() {
    return [
      {
        title: "Aperto Monetário no BCE",
        summary: "Sinalização de política mais contracionista afeta perspectiva de liquidez.",
        category: "CENTRAL_BANK",
        region: "EUROPE",
        location: "Frankfurt",
        severity: "MEDIUM",
        bias: "BEARISH",
        asset: "EURUSD",
        impacted_assets: ["EUR", "DE30", "BTC"],
        us_market_impact: "Força no índice DXY pelo enfraquecimento do Euro.",
        crypto_impact: "Efeito de liquidez moderadamente negativo no mercado crypto europeu.",
        sourceUrl: "#"
      }
    ];
  }

  // 2. CAMADA DE NORMALIZAÇÃO, DEDUPLICAÇÃO E CACHE
  private normalizeAndProcess(rawEvents: any[]): GeoEvent[] {
    if (!rawEvents || rawEvents.length === 0) return [];
    
    const newEvents: GeoEvent[] = [];

    for (const e of rawEvents) {
      // Deduplicação simples por título
      const cacheKey = e.title.toLowerCase().trim();
      if (this.eventCache.has(cacheKey)) {
        const cached = this.eventCache.get(cacheKey)!;
        // Atualizar apenas timestamp e severidade se necessário
        cached.timestamp = Date.now();
        cached.severity = e.severity as Severity;
        continue;
      }

      const lat = typeof e.lat === 'number' ? e.lat : null;
      const lng = typeof e.lng === 'number' ? e.lng : null;
      const coords = (lat !== null && lng !== null) ? [lat, lng] as [number, number] : this.getCoordinatesForRegion(e.region, e.location);

      const event: GeoEvent = {
        id: `geo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: e.title,
        summary: e.summary,
        category: e.category as Category,
        coordinates: coords,
        location: e.location,
        region: e.region,
        severity: e.severity as Severity,
        market_impact: { 
          signal: e.bias as MarketBias, 
          asset: e.asset,
          impacted_assets: e.impacted_assets,
          us_market_impact: e.us_market_impact,
          crypto_impact: e.crypto_impact
        },
        timestamp: Date.now(),
        marketWeight: this.calculateMarketWeight(e.severity, e.bias),
        relevance: this.calculateRelevance(e.category, e.severity),
        confidence: 0.85,
        status: 'STABLE',
        sourceUrl: e.sourceUrl,
        isNew: true
      };

      this.eventCache.set(cacheKey, event);
      newEvents.push(event);
    }

    return newEvents;
  }

  private getCoordinatesForRegion(region: string, location: string): [number, number] {
    // Mapeamento básico de regiões para coordenadas centrais
    const regions: Record<string, [number, number]> = {
      'MIDDLE_EAST': [29.2985, 42.5510],
      'EUROPE': [48.5260, 15.2551],
      'ASIA': [34.0479, 100.6197],
      'NORTH_AMERICA': [37.0902, -95.7129],
      'SOUTH_AMERICA': [-14.2350, -51.9253],
      'AFRICA': [1.0231, 18.7322],
      'RUSSIA': [61.5240, 105.3188],
      'CHINA': [35.8617, 104.1954]
    };
    
    const base = regions[region.toUpperCase()] || [0, 0];
    // Adicionar um pequeno jitter para não sobrepor exatamente no mesmo ponto
    return [base[0] + (Math.random() - 0.5) * 5, base[1] + (Math.random() - 0.5) * 5];
  }

  private calculateMarketWeight(severity: string, bias: string): number {
    let weight = 50;
    if (severity === 'CRITICAL') weight += 40;
    else if (severity === 'HIGH') weight += 25;
    if (bias !== 'NEUTRAL') weight += 10;
    return Math.min(100, weight);
  }

  private calculateRelevance(category: string, severity: string): number {
    let rel = 5;
    const priorityCategories = ['WAR', 'ENERGY', 'CENTRAL_BANK', 'SANCTIONS'];
    if (priorityCategories.includes(category)) rel += 3;
    if (severity === 'CRITICAL' || severity === 'HIGH') rel += 2;
    return Math.min(10, rel);
  }

  // 3. CAMADA DE ANÁLISE ESTRATÉGICA (Gemini 2.5 Pro - Final Synthesis)
  private async synthesizeWithGemini(events: GeoEvent[]): Promise<void> {
    // DESATIVADO A PEDIDO DO USUÁRIO
    return;
  }

  public start() {
    if (this.isActive()) return;
    this.processPipeline();
    // Simulate updating events
    this.interval = setInterval(() => {
      this.processPipeline();
    }, this.fetchInterval);
  }

  private async processPipeline() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    
    try {
      const raw = await this.fetchRawSignals();
      const processed = this.normalizeAndProcess(raw);
      
      // Ordenar por prioridade (severidade e categoria)
      const sorted = [...processed].sort((a, b) => b.relevance - a.relevance);

      for (const event of sorted) {
        this.events = [event, ...this.events].slice(0, 100);
        this.notify(event);
        // Pequeno delay entre notificações para o frontend processar suavemente
        await new Promise(r => setTimeout(r, 1000));
      }
      
      if (this.events.length > 0) {
        await this.synthesizeWithGemini(this.events);
      }
    } catch (e) {
      console.error("Pipeline error:", e);
    } finally {
      this.isProcessing = false;
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
