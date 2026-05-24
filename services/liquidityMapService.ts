export type LiquidityMapInput = {
  currentPrice: number;
  visibleHigh?: number;
  visibleLow?: number;
  poc?: number;
  hvn?: number;
  lvn?: number;
  lhm?: number;
  recentHigh?: number;
  recentLow?: number;
  structuralBias: "long" | "short";
  marketPhase: "building" | "breakout" | "executing" | "stretched" | "exhausted" | "range" | "neutral";
};

// --- UI Component Types ---
export type LiquidityLevel = {
  price: number;
  volumeUsd: number;
  intensity: 'Alta' | 'Média' | 'Baixa';
  cluster: boolean;
  side: 'Long' | 'Short';
};

export type LiquidityMapData = {
  asset: string;
  currentPrice: number;
  levels: LiquidityLevel[];
};

export async function fetchLiquidityMapData(asset: string): Promise<LiquidityMapData> {
  // Mock implementation to satisfy the UI component
  const basePrice = asset.includes('BTC') ? 65000 : asset.includes('ETH') ? 3500 : 150;
  return {
    asset,
    currentPrice: basePrice,
    levels: [
      { price: basePrice * 1.02, volumeUsd: 15000000, intensity: 'Alta', cluster: true, side: 'Short' },
      { price: basePrice * 1.01, volumeUsd: 5000000, intensity: 'Média', cluster: false, side: 'Short' },
      { price: basePrice * 0.99, volumeUsd: 8000000, intensity: 'Média', cluster: false, side: 'Long' },
      { price: basePrice * 0.98, volumeUsd: 20000000, intensity: 'Alta', cluster: true, side: 'Long' },
    ]
  };
}
// --------------------------

export type LiquidityTarget = {
  price: number;
  type: "poc" | "hvn" | "lvn" | "lhm" | "recent_high" | "recent_low" | "visible_high" | "visible_low";
  priority: number;
  rationale: string;
};

export type LiquidityMapResult = {
  primaryTarget?: LiquidityTarget;
  secondaryTarget?: LiquidityTarget;
  nextOperationalZone?: number;
  comments: string[];
};

export function buildLiquidityMap(input: LiquidityMapInput): LiquidityMapResult {
  const targets: LiquidityTarget[] = [];
  const comments: string[] = [];

  const addTarget = (price: number | undefined | null, type: LiquidityTarget["type"], priority: number, rationale: string) => {
    if (price !== undefined && price !== null) {
      targets.push({ price, type, priority, rationale });
    }
  };

  if (input.structuralBias === "long") {
    if (input.poc && input.poc < input.currentPrice) addTarget(input.poc, "poc", 1, "POC como zona de aceitação e reentrada");
    if (input.hvn && input.hvn < input.currentPrice) addTarget(input.hvn, "hvn", 2, "HVN inferior como suporte");
    if (input.recentLow && input.recentLow < input.currentPrice) addTarget(input.recentLow, "recent_low", 3, "Bolsão de liquidez inferior");
    if (input.lvn && input.lvn < input.currentPrice) addTarget(input.lvn, "lvn", 4, "LVN como zona de deslocamento rápido");
    if (input.lhm && input.lhm < input.currentPrice) addTarget(input.lhm, "lhm", 5, "LHM como zona de deslocamento rápido");
  } else {
    if (input.poc && input.poc > input.currentPrice) addTarget(input.poc, "poc", 1, "POC como zona de aceitação e reentrada");
    if (input.hvn && input.hvn > input.currentPrice) addTarget(input.hvn, "hvn", 2, "HVN superior como resistência");
    if (input.recentHigh && input.recentHigh > input.currentPrice) addTarget(input.recentHigh, "recent_high", 3, "Bolsão de liquidez superior");
    if (input.lvn && input.lvn > input.currentPrice) addTarget(input.lvn, "lvn", 4, "LVN como zona de deslocamento rápido");
    if (input.lhm && input.lhm > input.currentPrice) addTarget(input.lhm, "lhm", 5, "LHM como zona de deslocamento rápido");
  }

  targets.sort((a, b) => a.priority - b.priority);

  const primaryTarget = targets.length > 0 ? targets[0] : undefined;
  const secondaryTarget = targets.length > 1 ? targets[1] : undefined;
  const nextOperationalZone = primaryTarget?.price;

  if (primaryTarget) {
    comments.push(`Provável busca de liquidez em ${primaryTarget.price} (${primaryTarget.type}) antes de nova oportunidade.`);
  }

  return {
    primaryTarget,
    secondaryTarget,
    nextOperationalZone,
    comments
  };
}
