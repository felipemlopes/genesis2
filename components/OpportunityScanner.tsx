import React, { useEffect, useState, useRef } from 'react';
import { Radar, Zap, Activity, ChevronDown, Sparkles, BarChart2, Layers, ShieldCheck, Search } from 'lucide-react';
import { RSI, MACD, EMA, BollingerBands } from 'technicalindicators';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// --- ICONS ---
const BinanceLogo = () => (
  <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none"><path d="M16 0L9.07 6.93L16 13.86L22.93 6.93L16 0ZM4.8 11.2L0 16L4.8 20.8L9.6 16L4.8 11.2ZM27.2 11.2L22.4 16L27.2 20.8L32 16L27.2 11.2ZM16 18.14L9.07 25.07L16 32L22.93 25.07L16 18.14ZM16 14.9L12.09 18.81L16 22.72L19.91 18.81L16 14.9Z" fill="#F0B90B"/></svg>
);
const BybitLogo = () => (
  <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none"><path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#17181E"/><path d="M18.5 7H13.5V11H18.5V7Z" fill="#FFB119"/><path d="M18.5 13H13.5V25H18.5V13Z" fill="#FFB119"/><path d="M24.5 7H19.5V17H24.5V7Z" fill="#FFB119"/><path d="M12.5 15H7.5V25H12.5V15Z" fill="#FFB119"/></svg>
);
const BitgetLogo = () => (
  <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none"><path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#00F0FF"/><path d="M10 11H22V13H10V11ZM10 15H22V17H10V15ZM10 19H18V21H10V19Z" fill="black"/></svg>
);
const OkxLogo = () => (
  <svg viewBox="0 0 32 32" className="w-4 h-4" fill="none"><path d="M16 32C24.8366 32 32 24.8366 32 16C32 7.16344 24.8366 0 16 0C7.16344 0 0 7.16344 0 16C0 24.8366 7.16344 32 16 32Z" fill="#000000"/><path d="M21.5 10.5L16 16L10.5 10.5L8.5 12.5L16 20L23.5 12.5L21.5 10.5Z" fill="#FFFFFF"/></svg>
);

// --- INTERFACES ---
interface ScannerOpportunity {
  id: string;
  exchanges: string[];
  pair: string;
  symbolRaw: string;
  price: number;
  volume24h: string;
  scores: {
    relevance: number;
    flow: number;
    quality: number;
    final: number;
  };
  metrics: {
    rsi: number;
    openInterest: number;
    fundingRate: number;
    persistence: number;
    longShortRatio: number;
    takerBuySellRatio: number;
    orderBookImbalance: number;
  };
  justification: string;
  timestamp: string;
}

interface OpportunityScannerProps {
  onAnalyze: (ex: string, pair: string, tf: string) => void;
  savedState?: {
    hasScanned: boolean;
    opportunities: ScannerOpportunity[];
    lastTimeframe: string;
  };
  onSaveState?: (state: {
    hasScanned: boolean;
    opportunities: ScannerOpportunity[];
    lastTimeframe: string;
  }) => void;
}

// --- INDICATOR ENGINES ---
const calculateRSI = (closes: number[], period: number = 14): number => {
    const result = RSI.calculate({ period, values: closes });
    return result.length > 0 ? result[result.length - 1] : 50;
};

const calculateBB = (closes: number[], period: number = 20, stdDev: number = 2) => {
    const result = BollingerBands.calculate({ period, stdDev, values: closes });
    if (result.length === 0) return { upper: 0, middle: 0, lower: 0 };
    const last = result[result.length - 1];
    return { upper: last.upper, middle: last.middle, lower: last.lower };
};

const calculateMACD = (closes: number[]) => {
    const result = MACD.calculate({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false, values: closes });
    if (result.length === 0) return { hist: 0, macd: 0, signal: 0 };
    const last = result[result.length - 1];
    return { hist: last.histogram || 0, macd: last.MACD || 0, signal: last.signal || 0 };
};

const calculateEMA = (closes: number[], period: number): number | null => {
    const result = EMA.calculate({ period, values: closes });
    return result.length > 0 ? result[result.length - 1] : null;
};

// --- COMPONENTS ---
const ScoreBar = ({ score, colorClass }: { score: number, colorClass: string }) => (
    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden flex">
        <div className={`h-full ${colorClass} transition-all duration-1000`} style={{ width: `${score}%` }}></div>
    </div>
);

const OpportunityScanner: React.FC<OpportunityScannerProps> = ({ onAnalyze, savedState, onSaveState }) => {
  const [hasScanned, setHasScanned] = useState(savedState?.hasScanned || false);
  const [opportunities, setOpportunities] = useState<ScannerOpportunity[]>(savedState?.opportunities || []);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(savedState?.lastTimeframe || '4h');
  const [isScanning, setIsScanning] = useState(false);
  const [seenSymbols, setSeenSymbols] = useState<Set<string>>(new Set());
  const [activeTooltip, setActiveTooltip] = useState<{ type: string; data: any; rect: DOMRect; } | null>(null);
  const [searchInfo, setSearchInfo] = useState<Record<string, string>>({});
  const [isSearching, setIsSearching] = useState<Record<string, boolean>>({});
  const [activeSearch, setActiveSearch] = useState<string | null>(null);

  const fetchSearchInfo = async (symbol: string) => {
    if (searchInfo[symbol]) {
      setActiveSearch(symbol);
      return;
    }
    setIsSearching(prev => ({ ...prev, [symbol]: true }));
    try {
      const token = localStorage.getItem('genesis_token');
      const response = await fetch(`${API_BASE}/v1/gemini-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          contents: `What is currently happening with ${symbol} crypto project that might impact its price? Provide a concise summary.`,
          config: { tools: [{ googleSearch: {} }] }
        })
      });
      const data = await response.json();
      setSearchInfo(prev => ({ ...prev, [symbol]: data.text || 'No information found.' }));
      setActiveSearch(symbol);
    } catch (e) {
      setSearchInfo(prev => ({ ...prev, [symbol]: 'Error fetching information.' }));
      setActiveSearch(symbol);
    } finally {
      setIsSearching(prev => ({ ...prev, [symbol]: false }));
    }
  };

  useEffect(() => {
    if (onSaveState) {
        onSaveState({ hasScanned, opportunities, lastTimeframe: selectedTimeframe });
    }
  }, [hasScanned, opportunities, selectedTimeframe]);

  const performScan = async () => {
    setIsScanning(true);
    
    try {
        // 1. LIQUIDITY & UNIVERSE (Multi-Exchange)
        const [binanceRes, bybitRes, bitgetRes, okxRes] = await Promise.allSettled([
            fetch('https://fapi.binance.com/fapi/v1/ticker/24hr'),
            fetch('https://api.bybit.com/v5/market/tickers?category=linear'),
            fetch('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES'),
            fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP')
        ]);

        const liquidAssets = new Map<string, { vol: number, exchanges: Set<string> }>();
        
        if (binanceRes.status === 'fulfilled') {
            const data = await binanceRes.value.json();
            if (Array.isArray(data)) {
                data.forEach((t: any) => {
                    if (t.symbol.endsWith('USDT') && parseFloat(t.quoteVolume) > 10000000) {
                        liquidAssets.set(t.symbol, { vol: parseFloat(t.quoteVolume), exchanges: new Set(['Binance']) });
                    }
                });
            }
        }
        
        if (bybitRes.status === 'fulfilled') {
            const data = await bybitRes.value.json();
            if (data.retCode === 0 && data.result?.list) {
                data.result.list.forEach((t: any) => { 
                    const sym = t.symbol.replace('USDT', '') + 'USDT';
                    if (liquidAssets.has(sym)) liquidAssets.get(sym)?.exchanges.add('Bybit'); 
                });
            }
        }
        
        if (bitgetRes.status === 'fulfilled') {
            const data = await bitgetRes.value.json();
            if (data.code === '00000' && data.data) {
                data.data.forEach((t: any) => { 
                    const sym = t.symbol.replace('USDT', '') + 'USDT';
                    if (liquidAssets.has(sym)) liquidAssets.get(sym)?.exchanges.add('Bitget'); 
                });
            }
        }

        if (okxRes.status === 'fulfilled') {
            const data = await okxRes.value.json();
            if (data.code === '0' && data.data) {
                data.data.forEach((t: any) => { 
                    const sym = t.instId.replace('-USDT-SWAP', '') + 'USDT';
                    if (liquidAssets.has(sym)) liquidAssets.get(sym)?.exchanges.add('OKX'); 
                });
            }
        }

        const isStablePair = (symbol: string) => {
            const stables = ['USDT', 'USDC', 'BUSD', 'DAI', 'FDUSD', 'TUSD', 'USDP', 'EUR', 'GBP', 'ZAR', 'TRY'];
            // Check if it's a pair of two stables
            for (const s1 of stables) {
                for (const s2 of stables) {
                    if (s1 === s2) continue;
                    if (symbol === s1 + s2 || symbol === s2 + s1) return true;
                }
            }
            // Also check common stable-only symbols
            const commonStables = ['USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'USDPUSDT', 'BUSDUSDT', 'EURUSDT', 'DAIUSDT', 'GBPUSDT', 'USTCUSDT'];
            return commonStables.includes(symbol);
        };
        
        const candidates = Array.from(liquidAssets.entries())
            .filter(([symbol]) => !seenSymbols.has(symbol))
            .filter(([symbol]) => !isStablePair(symbol))
            .sort((a, b) => b[1].vol - a[1].vol)
            .slice(0, 60); // Scan more candidates to ensure we find 5 high-quality ones

        let results: ScannerOpportunity[] = [];
        
        const scanAsset = async ([symbol, meta]: [string, any]) => {
            try {
                // Fetch Klines (Binance as primary)
                const kUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${selectedTimeframe}&limit=220`;
                const kRes = await fetch(kUrl);
                const kData = await kRes.json();
                if (!Array.isArray(kData) || kData.length < 200) return;

                const closes = kData.map((k: any) => parseFloat(k[4]));
                const highs = kData.map((k: any) => parseFloat(k[2]));
                const lows = kData.map((k: any) => parseFloat(k[3]));
                const volumes = kData.map((k: any) => parseFloat(k[5]));
                
                const lastPrice = closes[closes.length - 1];
                
                // Technicals
                const rsi = calculateRSI(closes, 14);
                const bb = calculateBB(closes, 20, 2);
                const macd = calculateMACD(closes);
                const ema21 = calculateEMA(closes, 21) || lastPrice;
                const ema50 = calculateEMA(closes, 50) || lastPrice;
                const ema200 = calculateEMA(closes, 200) || lastPrice;

                // Flow Data (Binance Premium Index & Open Interest)
                let openInterest = 0;
                let fundingRate = 0;
                let premiumIndex = 0;
                let longShortRatio = 1;
                let takerBuySellRatio = 1;
                let orderBookImbalance = 0; // positive = more bids, negative = more asks
                let multiExchangeOI = 0;
                
                try {
                    const binancePromises = [
                        fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`),
                        fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`),
                        fetch(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`),
                        fetch(`https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=${symbol}&period=5m&limit=1`),
                        fetch(`https://fapi.binance.com/fapi/v1/depth?symbol=${symbol}&limit=20`)
                    ];

                    const [oiRes, piRes, lsRes, takerRes, depthRes] = await Promise.allSettled(binancePromises);

                    if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
                        const oiData = await oiRes.value.json();
                        openInterest = parseFloat(oiData.openInterest) * lastPrice;
                        multiExchangeOI += openInterest;
                    }
                    if (piRes.status === 'fulfilled' && piRes.value.ok) {
                        const piData = await piRes.value.json();
                        fundingRate = parseFloat(piData.lastFundingRate);
                        premiumIndex = parseFloat(piData.interestRate);
                    }
                    if (lsRes.status === 'fulfilled' && lsRes.value.ok) {
                        const lsData = await lsRes.value.json();
                        if (lsData && lsData.length > 0) longShortRatio = parseFloat(lsData[0].longShortRatio);
                    }
                    if (takerRes.status === 'fulfilled' && takerRes.value.ok) {
                        const takerData = await takerRes.value.json();
                        if (takerData && takerData.length > 0) takerBuySellRatio = parseFloat(takerData[0].buySellRatio);
                    }
                    if (depthRes.status === 'fulfilled' && depthRes.value.ok) {
                        const depthData = await depthRes.value.json();
                        const bidsVol = depthData.bids ? depthData.bids.reduce((acc: number, val: string[]) => acc + parseFloat(val[0]) * parseFloat(val[1]), 0) : 0;
                        const asksVol = depthData.asks ? depthData.asks.reduce((acc: number, val: string[]) => acc + parseFloat(val[0]) * parseFloat(val[1]), 0) : 0;
                        if (bidsVol + asksVol > 0) {
                            orderBookImbalance = (bidsVol - asksVol) / (bidsVol + asksVol);
                        }
                    }

                    // Fetch Bybit OI if available
                    if (meta.exchanges.has('Bybit')) {
                        try {
                            // const bybitOiRes = await fetch(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbol}`);
                            // if (bybitOiRes.ok) {
                            //     const bybitOiData = await bybitOiRes.json();
                            //     if (bybitOiData.retCode === 0 && bybitOiData.result?.list?.length > 0) {
                            //         multiExchangeOI += parseFloat(bybitOiData.result.list[0].openInterest) * lastPrice;
                            //     }
                            // }
                        } catch (e) {}
                    }

                    // Fetch Bitget OI if available
                    if (meta.exchanges.has('Bitget')) {
                        try {
                            const bitgetOiRes = await fetch(`https://api.bitget.com/api/v2/mix/market/open-interest?productType=USDT-FUTURES&symbol=${symbol}`);
                            if (bitgetOiRes.ok) {
                                const bitgetOiData = await bitgetOiRes.json();
                                if (bitgetOiData.code === '00000' && bitgetOiData.data?.length > 0) {
                                    multiExchangeOI += parseFloat(bitgetOiData.data[0].openInterest) * lastPrice;
                                }
                            }
                        } catch (e) {}
                    }
                } catch (e) {
                    // Fallback or ignore
                }

                // --- 1. SCORE DE RELEVÃƒâ€šNCIA (TÃƒÂ©cnico) ---
                let relevanceScore = 50;
                
                // RSI Extremes
                if (rsi < 30 || rsi > 70) relevanceScore += 20;
                else if (rsi < 40 || rsi > 60) relevanceScore += 10;
                
                // Bollinger Bands Interaction
                const bbWidth = (bb.upper - bb.lower) / bb.middle;
                if (lastPrice <= bb.lower || lastPrice >= bb.upper) relevanceScore += 15;
                if (bbWidth < 0.05) relevanceScore += 10; // Squeeze
                
                // MACD Momentum
                if (Math.abs(macd.hist) > 0) relevanceScore += 10;
                
                // EMA Alignment
                if ((lastPrice > ema21 && ema21 > ema50 && ema50 > ema200) || 
                    (lastPrice < ema21 && ema21 < ema50 && ema50 < ema200)) {
                    relevanceScore += 15;
                }

                relevanceScore = Math.min(100, Math.max(0, relevanceScore));

                // --- 2. SCORE DE FLUXO (Institucional) ---
                let flowScore = 50;
                
                // Open Interest Impact
                const totalOI = multiExchangeOI > 0 ? multiExchangeOI : openInterest;
                if (totalOI > 100000000) flowScore += 20; // > $100M OI
                else if (totalOI > 50000000) flowScore += 15;
                else if (totalOI > 10000000) flowScore += 5;
                
                // Funding Rate Extremes (Indicates crowded sides)
                if (Math.abs(fundingRate) > 0.0005) flowScore += 15;
                else if (Math.abs(fundingRate) > 0.0001) flowScore += 5;
                
                // Long/Short Ratio (Contrarian indicator)
                if (longShortRatio > 2.5 || longShortRatio < 0.5) flowScore += 10;
                else if (longShortRatio > 1.5 || longShortRatio < 0.8) flowScore += 5;

                // Taker Buy/Sell Ratio (Aggressive market orders)
                if (takerBuySellRatio > 1.2 || takerBuySellRatio < 0.8) flowScore += 10;

                // Order Book Imbalance
                if (Math.abs(orderBookImbalance) > 0.3) flowScore += 10;

                // Multi-Exchange Consensus
                flowScore += (meta.exchanges.size * 2.5); // Up to +10 for being on all 4

                flowScore = Math.min(100, Math.max(0, flowScore));

                // --- 3. SCORE DE QUALIDADE (Persistência & Ruído) ---
                let qualityScore = 50;
                let persistence = 0;
                
                // Check last 5 candles for trend persistence
                let upCandles = 0;
                let downCandles = 0;
                for (let i = closes.length - 5; i < closes.length; i++) {
                    if (closes[i] > closes[i-1]) upCandles++;
                    if (closes[i] < closes[i-1]) downCandles++;
                }
                
                if (upCandles >= 4 || downCandles >= 4) {
                    qualityScore += 20;
                    persistence = 80;
                } else if (upCandles >= 3 || downCandles >= 3) {
                    qualityScore += 10;
                    persistence = 50;
                } else {
                    qualityScore -= 10; // Choppy
                    persistence = 20;
                }
                
                // Volume confirmation
                const avgVol = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
                if (volumes[volumes.length - 1] > avgVol * 1.5) qualityScore += 15;
                if (volumes[volumes.length - 1] > avgVol * 2.0) qualityScore += 10;

                // Coherence between Technical and Flow
                const isPriceUp = closes[closes.length - 1] > closes[closes.length - 2];
                if ((isPriceUp && takerBuySellRatio > 1) || (!isPriceUp && takerBuySellRatio < 1)) {
                    qualityScore += 15;
                } else {
                    qualityScore -= 5; // Divergence
                }
                
                qualityScore = Math.min(100, Math.max(0, qualityScore));

                // --- SCORE FINAL ---
                // Weighted combination
                const finalScore = Math.round((relevanceScore * 0.4) + (flowScore * 0.4) + (qualityScore * 0.2));

                // Justification logic
                let justification = "Análise Quantitativa Padrão";
                if (relevanceScore > 80 && flowScore > 80) justification = "Confluência Técnica + Fluxo Intenso";
                else if (flowScore > 85) justification = "Anomalia de Fluxo e Open Interest";
                else if (relevanceScore > 85) justification = "Extremo Técnico Estrutural";
                else if (qualityScore > 85) justification = "Expansão com Alta Qualidade";
                else if (meta.exchanges.size === 4 && flowScore > 70) justification = "Consenso Multi-Exchange";

                // Only add if it's somewhat interesting
                if (finalScore >= 50) {
                    results.push({
                        id: symbol,
                        exchanges: Array.from(meta.exchanges as Set<string>),
                        pair: symbol.replace('USDT', '/USDT'),
                        symbolRaw: symbol.replace('USDT', '').replace('1000', ''),
                        price: lastPrice,
                        volume24h: `$${(meta.vol / 1000000).toFixed(1)}M`,
                        scores: {
                            relevance: Math.round(relevanceScore),
                            flow: Math.round(flowScore),
                            quality: Math.round(qualityScore),
                            final: finalScore
                        },
                        metrics: {
                            rsi: Math.round(rsi),
                            openInterest,
                            fundingRate,
                            persistence,
                            longShortRatio,
                            takerBuySellRatio,
                            orderBookImbalance
                        },
                        justification,
                        timestamp: new Date().toLocaleTimeString()
                    });
                }
            } catch (e) {}
        };

        // Scan in batches
        for (let i = 0; i < candidates.length; i += 10) {
            const batch = candidates.slice(i, i + 10);
            await Promise.all(batch.map(c => scanAsset(c)));
        }

        // Sort by final score and take exactly 5
        const finalBatch = results.sort((a, b) => b.scores.final - a.scores.final).slice(0, 5);
        
        setOpportunities(finalBatch);
        
        // Add new symbols to seen history to prevent repetition in future scans
        setSeenSymbols(prev => {
            const next = new Set(prev);
            finalBatch.forEach(o => next.add(o.id));
            return next;
        });
        
        setHasScanned(true);
    } catch (e) { 
        console.error("Scan error", e);
    } finally { 
        setIsScanning(false); 
    }
  };

  const handleResetScan = () => {
      setHasScanned(false);
      setOpportunities([]);
      // We don't clear seenSymbols here to maintain the "Never bring the same" rule across the session
  };

  const renderTooltip = () => {
    if (!activeTooltip) return null;
    const { type, data, rect } = activeTooltip;
    
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < 250 && rect.top > 250;
    
    const top = showAbove ? rect.top - 10 : rect.bottom + 10;
    const transform = showAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';
    
    const style: React.CSSProperties = { 
      position: 'fixed', 
      left: `${Math.max(160, Math.min(window.innerWidth - 160, rect.left + rect.width / 2))}px`, 
      top: `${top}px`, 
      transform, 
      zIndex: 999999 
    };
    
    let content = null;
    
    if (type === 'relevance') {
       content = (
          <>
             <span className="font-bold text-blue-400  pb-1 mb-2 block uppercase tracking-wider">Score de Relevância</span>
             <p className="text-gray-300 mb-2">Mede a força técnica do ativo baseada em indicadores clássicos de pressão.</p>
             <ul className="text-gray-400 space-y-1 list-disc pl-4">
                <li><strong className="text-white">RSI:</strong> {data.metrics.rsi} (Níveis extremos ganham mais pontos)</li>
                <li><strong className="text-white">Bandas de Bollinger:</strong> Proximidade das extremidades</li>
                <li><strong className="text-white">MACD & EMAs:</strong> Alinhamento de tendência</li>
             </ul>
          </>
       );
    } else if (type === 'flow') {
       content = (
          <>
             <span className="font-bold text-purple-400  pb-1 mb-2 block uppercase tracking-wider">Score de Fluxo</span>
             <p className="text-gray-300 mb-2">Mede a pressão institucional e o posicionamento do mercado em tempo real.</p>
             <ul className="text-gray-400 space-y-1 list-disc pl-4">
                <li><strong className="text-white">Open Interest:</strong> ${(data.metrics.openInterest / 1000000).toFixed(1)}M</li>
                <li><strong className="text-white">Funding Rate:</strong> {(data.metrics.fundingRate * 100).toFixed(4)}%</li>
                <li><strong className="text-white">Long/Short Ratio:</strong> {data.metrics.longShortRatio.toFixed(2)}</li>
             </ul>
          </>
       );
    } else if (type === 'quality') {
       content = (
          <>
             <span className="font-bold text-emerald-400  pb-1 mb-2 block uppercase tracking-wider">Score de Qualidade</span>
             <p className="text-gray-300 mb-2">Mede a ausência de ruído e a persistência do movimento atual.</p>
             <ul className="text-gray-400 space-y-1 list-disc pl-4">
                <li><strong className="text-white">Persistência:</strong> {data.metrics.persistence}% de velas na mesma direção</li>
                <li><strong className="text-white">Confirmação:</strong> Agressão de volume vs Pressão</li>
             </ul>
          </>
       );
    } else if (type === 'justification') {
       content = (
          <>
             <span className="font-bold text-genesis-accent  pb-1 mb-2 block uppercase tracking-wider">Justificativa Quantitativa</span>
             <p className="text-white font-bold mb-2">{data.justification}</p>
             <p className="text-gray-400">Esta é a principal razão maemática pela qual o radar destacou este ativo. Indica a convergência exata que disparou o alerta neste momento.</p>
          </>
       );
    } else if (type === 'finalScore') {
       content = (
          <>
             <span className="font-bold text-genesis-positive  pb-1 mb-2 block uppercase tracking-wider">Score Final: {data.scores.final}</span>
             <p className="text-gray-300 mb-2">O Score Final é a média ponderada da Relevância (40%), Fluxo (40%) e Qualidade (20%).</p>
             <p className="text-gray-400">Um score de <strong className="text-white">{data.scores.final}</strong> significa que o ativo apresenta uma assimetria {data.scores.final > 80 ? 'excelente' : 'muito boa'} para análise imediata.</p>
          </>
       );
    }

    if (!content) return null;

    return (
       <div style={style} className="p-[16px] bg-gray-950  rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] pointer-events-none animate-in fade-in zoom-in-95 duration-200 w-80 shadow-xl">
          <div className="text-xs font-sans leading-relaxed">
             {content}
          </div>
       </div>
    );
  };

  // ESTADO: Idle
  if (!hasScanned && !isScanning) {
      return (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700 bg-black">
              <div className="mb-10 relative group cursor-pointer" onClick={performScan}>
                  <div className="absolute inset-0 bg-genesis-positive/10 rounded-full blur-3xl opacity-50"></div>
                  <div className="relative w-40 h-40 rounded-full  flex items-center justify-center bg-black hover:border-genesis-positive transition-all duration-500 shadow-2xl">
                      <Radar size={64} className="text-gray-700 group-hover:text-genesis-positive transition-all duration-500" strokeWidth={0.5} />
                  </div>
              </div>
              <h1 className="text-4xl font-thin tracking-tighter text-white mb-4 uppercase">Radar <span className="font-bold text-genesis-positive ">Gênesis</span></h1>
              <p className="text-gray-500 text-xs font-mono mb-8 uppercase tracking-widest">Filtro Quantitativo Multi-Exchange</p>
              <div className="flex flex-col items-center gap-[16px] w-full max-w-xs">
                  <div className="relative w-full">
                    <select value={selectedTimeframe} onChange={(e) => setSelectedTimeframe(e.target.value)} className="w-full bg-black  rounded px-4 py-3 text-white text-center font-mono text-xs focus:border-genesis-positive transition-all uppercase appearance-none tracking-widest cursor-pointer">
                        <option value="15m">15 minutos Scalp</option>
                        <option value="30m">30 minutos Scalp</option>
                        <option value="1h">1 hora Intraday</option>
                        <option value="2h">2 horas Intraday</option>
                        <option value="4h">4 horas Swing</option>
                        <option value="12h">12 horas Swing</option>
                        <option value="1d">Diário Macro</option>
                        <option value="1w">Semanal Macro</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                  </div>
                  <button onClick={performScan} className="w-full py-3 bg-white text-black hover:bg-genesis-positive font-bold text-xs uppercase tracking-[0.2em] rounded transition-all shadow-lg flex items-center justify-center gap-2">BUSCAR OPORTUNIDADES <Zap size={12} /></button>
              </div>
          </div>
      );
  }

  // ESTADO: Loading
  if (isScanning) {
      return (
          <div className="h-full flex flex-col items-center justify-center p-8 bg-black relative animate-in fade-in duration-500">
              <div className="relative flex items-center justify-center mb-12">
                  <div className="absolute w-48 h-48 border-genesis-positive/10 rounded-full animate-[ping_4s_linear_infinite]"></div>
                  <div className="absolute w-32 h-32 border-genesis-positive/20 rounded-full animate-[ping_3s_linear_infinite]"></div>
                  <div className="relative w-24 h-24 bg-genesis-positive/5 rounded-full flex items-center justify-center border-genesis-positive/20 shadow-[0_0_30px_rgba(57,255,20,0.1)]">
                      <Radar size={44} className="text-genesis-positive animate-pulse" strokeWidth={0.5} />
                      <div className="absolute inset-0 border-genesis-positive/40 rounded-full animate-spin"></div>
                  </div>
                  <Sparkles className="absolute -top-12 left-10 text-genesis-positive/20 animate-bounce" size={12} />
                  <Sparkles className="absolute top-20 -right-8 text-genesis-positive/20 animate-pulse" size={16} />
              </div>
              <div className="text-center space-y-4">
                  <div className="flex flex-col items-center gap-2">
                      <h2 className="text-white text-base font-bold uppercase tracking-[0.5em] animate-pulse">Analisando Fluxo Multi-Exchange</h2>
                      <div className="h-[1px] w-24   success/40 "></div>
                  </div>
                  <p className="text-gray-500 font-mono text-[9px] uppercase tracking-[0.3em] opacity-80">Binance • Bybit • Bitget • OKX</p>
                  <div className="w-48 h-0.5 bg-white/5 rounded-full mx-auto overflow-hidden">
                      <div className="h-full bg-genesis-positive w-1/3 animate-[shimmer_2s_infinite]"></div>
                  </div>
              </div>
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes shimmer {
                  0% { transform: translateX(-150%); }
                  100% { transform: translateX(300%); }
                }
              `}} />
          </div>
      );
  }

  // ESTADO: Loaded
  return (
    <div className="h-full flex flex-col p-6 bg-black relative animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8  pb-4">
         <div className="flex items-center gap-[16px]">
             <h1 className="text-2xl font-thin text-white tracking-widest uppercase">Radar Gênesis</h1>
             <span className="text-[10px] font-bold text-genesis-positive bg-genesis-positive/5 px-2 py-1 rounded border-genesis-positive/20">TF: {selectedTimeframe}</span>
         </div>
         <button onClick={handleResetScan} className="px-6 py-2 bg-white/5 hover:bg-white/10  text-white rounded text-[10px] font-bold uppercase flex items-center gap-2 transition-all tracking-widest"><Radar size={12} /> Nova Busca</button>
      </div>

      {renderTooltip()}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        <div className="flex flex-col gap-3">
           {opportunities.map((opp) => (
              <div key={opp.id} className="group flex items-center justify-between p-5 rounded-xl  bg-transparent hover:bg-white/[0.02] transition-all duration-300">
                 
                 {/* 1. Asset & Liquidity */}
                 <div className="flex flex-col w-[15%]">
                    <span className="text-lg font-bold text-white font-mono tracking-tight">{opp.pair}</span>
                    <span className="text-[10px] text-gray-500 mt-1">Vol 24h: {opp.volume24h}</span>
                    <div className="flex items-center gap-2 mt-3">
                        {opp.exchanges.includes('Binance') && <div className="w-3.5 h-3.5 grayscale group-hover:grayscale-0 transition-all" title="Binance"><BinanceLogo /></div>}
                        {opp.exchanges.includes('Bybit') && <div className="w-3.5 h-3.5 grayscale group-hover:grayscale-0 transition-all" title="Bybit"><BybitLogo /></div>}
                        {opp.exchanges.includes('Bitget') && <div className="w-3.5 h-3.5 grayscale group-hover:grayscale-0 transition-all" title="Bitget"><BitgetLogo /></div>}
                        {opp.exchanges.includes('OKX') && <div className="w-3.5 h-3.5 grayscale group-hover:grayscale-0 transition-all" title="OKX"><OkxLogo /></div>}
                    </div>
                 </div>

                 {/* 2. Metrics */}
                 <div className="flex flex-col gap-3 w-[25%]">
                    <div className="cursor-help" onMouseEnter={(e) => setActiveTooltip({ type: 'relevance', data: opp, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setActiveTooltip(null)}>
                       <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                           <span className="text-gray-500 flex items-center gap-1"><BarChart2 size={12}/> Relevância</span>
                           <span className="text-white">{opp.scores.relevance}</span>
                       </div>
                       <ScoreBar score={opp.scores.relevance} colorClass="bg-blue-500" />
                    </div>
                    
                    <div className="cursor-help" onMouseEnter={(e) => setActiveTooltip({ type: 'flow', data: opp, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setActiveTooltip(null)}>
                       <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                           <span className="text-gray-500 flex items-center gap-1"><Activity size={12}/> Fluxo</span>
                           <span className="text-white">{opp.scores.flow}</span>
                       </div>
                       <ScoreBar score={opp.scores.flow} colorClass="bg-purple-500" />
                    </div>
                    
                    <div className="cursor-help" onMouseEnter={(e) => setActiveTooltip({ type: 'quality', data: opp, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setActiveTooltip(null)}>
                       <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                           <span className="text-gray-500 flex items-center gap-1"><ShieldCheck size={12}/> Qualidade</span>
                           <span className="text-white">{opp.scores.quality}</span>
                       </div>
                       <ScoreBar score={opp.scores.quality} colorClass="bg-emerald-500" />
                    </div>
                 </div>

                 {/* 3. Justification */}
                 <div className="flex flex-col gap-2 w-[30%] px-6 cursor-help" onMouseEnter={(e) => setActiveTooltip({ type: 'justification', data: opp, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setActiveTooltip(null)}>
                    <span className="text-xs text-genesis-accent font-bold uppercase tracking-wider leading-snug">{opp.justification}</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="text-[9px] text-gray-400 font-mono bg-white/5 px-2 py-1 rounded ">RSI: {opp.metrics.rsi}</span>
                        <span className="text-[9px] text-gray-400 font-mono bg-white/5 px-2 py-1 rounded ">L/S: {opp.metrics.longShortRatio.toFixed(2)}</span>
                        <span className="text-[9px] text-gray-400 font-mono bg-white/5 px-2 py-1 rounded ">Taker: {opp.metrics.takerBuySellRatio.toFixed(2)}</span>
                        <span className="text-[9px] text-gray-400 font-mono bg-white/5 px-2 py-1 rounded ">Imb: {(opp.metrics.orderBookImbalance * 100).toFixed(0)}%</span>
                    </div>
                 </div>

                 {/* 4. Final Score */}
                 <div className="flex flex-col items-center justify-center w-[15%] cursor-help" onMouseEnter={(e) => setActiveTooltip({ type: 'finalScore', data: opp, rect: e.currentTarget.getBoundingClientRect() })} onMouseLeave={() => setActiveTooltip(null)}>
                    <span className="text-[9px] text-gray-500 uppercase tracking-widest mb-2">Score Final</span>
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border-genesis-positive/30 bg-genesis-positive/10 group-hover:bg-genesis-positive/20 group-hover:border-genesis-positive/50 transition-all shadow-[0_0_15px_rgba(57,255,20,0.1)] group-hover:-[0_0_20px_rgba(57,255,20,0.2)]">
                        <span className="text-xl font-bold font-mono text-genesis-positive">{opp.scores.final}</span>
                    </div>
                 </div>

                 {/* 5. Action */}
                 <div className="flex justify-end gap-2 w-[15%]">
                    <button 
                        onClick={() => fetchSearchInfo(opp.symbolRaw)}
                        className={`bg-white/5 hover:bg-white/10 text-white p-3 rounded transition-all  ${isSearching[opp.symbolRaw] ? 'animate-pulse' : ''}`}
                        title="Pesquisar contexto do projeto"
                    >
                        <Search size={16} />
                    </button>
                    <button 
                        onClick={() => onAnalyze(opp.exchanges[0], opp.pair, selectedTimeframe)} 
                        className="bg-white/5 hover:bg-genesis-positive hover:text-black text-white px-6 py-3 rounded text-xs font-bold uppercase tracking-widest transition-all  hover:border-genesis-positive shadow-lg"
                    >
                        ANALISAR
                    </button>
                 </div>

              </div>
           ))}
           
           {activeSearch && (
             <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80  p-[16px]" onClick={() => setActiveSearch(null)}>
               <div className="bg-genesis-card  p-6 rounded-xl max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                 <h3 className="text-white font-bold mb-4 uppercase tracking-widest text-sm">Contexto: {activeSearch}</h3>
                 <div className="text-gray-300 text-sm leading-relaxed">{searchInfo[activeSearch]}</div>
                 <button onClick={() => setActiveSearch(null)} className="mt-6 w-full py-2 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold uppercase tracking-widest transition-all">Fechar</button>
               </div>
             </div>
           )}
           
           {opportunities.length === 0 && (
               <div className="py-12 text-center text-gray-500 text-xs uppercase tracking-widest">
                   Nenhuma oportunidade relevante encontrada neste timeframe.
               </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default OpportunityScanner;
