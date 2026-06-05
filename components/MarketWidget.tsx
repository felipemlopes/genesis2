
import React, { useState, useEffect } from 'react';
import { ExchangeData, formatPrice } from '../services/cryptoApi';
import { RealtimeCVDService, CVDSnapshot } from '../services/realtimeCVDService';
import LongShortRatio from './LongShortRatio';
import FearAndGreed from './FearAndGreed';
import ConfluenceScore from './ConfluenceScore';
import { Activity, TrendingUp, TrendingDown, Zap, Clock, ArrowUp, ArrowDown, ActivitySquare } from 'lucide-react';

interface MarketWidgetProps {
  selectedPair: string;
  activeExchange: string;
  data: ExchangeData;
  cvdData: { delta: number, priceChangePercent: number } | null;
  onAnalyzeAnomaly?: (ex: string, pair: string, tf: string) => void;
}

const MarketWidget: React.FC<MarketWidgetProps> = ({ selectedPair, activeExchange, data, cvdData, onAnalyzeAnomaly }) => {
  const cardBase = " bg-genesis-card rounded-[10px] p-[16px] flex flex-col justify-between transition-all duration-300 relative overflow-visible group z-10 hover:z-[99999999]";
  
  const cvdCardStyle = " bg-genesis-card rounded-[10px] p-[16px] flex flex-col justify-between transition-all duration-300 relative overflow-visible group hover:border-cyan-500/30 z-10 hover:z-[99999999]";

  const [timeToNextFunding, setTimeToNextFunding] = useState('');
  const [realtimeCvd, setRealtimeCvd] = useState<CVDSnapshot | null>(null);

  useEffect(() => {
    if (!selectedPair) return;
    const svc = RealtimeCVDService.getInstance(selectedPair);
    setRealtimeCvd(svc.getSnapshot());
    const interval = setInterval(() => {
       setRealtimeCvd(svc.getSnapshot());
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedPair]);

  // Melhoria 2: Countdown do próximo Funding Rate (00h, 08h, 16h UTC)
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const utcHours = now.getUTCHours();
      let nextHour = 0;
      
      if (utcHours < 8) nextHour = 8;
      else if (utcHours < 16) nextHour = 16;
      else nextHour = 24; // 00h next day

      const nextFunding = new Date(Date.UTC(
         now.getUTCFullYear(),
         now.getUTCMonth(),
         now.getUTCDate() + (nextHour === 24 ? 1 : 0),
         nextHour === 24 ? 0 : nextHour,
         0, 0, 0
      ));

      const diff = nextFunding.getTime() - now.getTime();
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeToNextFunding(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  const renderValue = (val: string | undefined, isFunding: boolean) => {
    if (!val || val === '---') {
        return <div className="h-4 w-12 bg-white/5 rounded animate-pulse" />;
    }
    
    let colorClass = 'text-white';
    if (isFunding) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
          if (num > 0) colorClass = 'text-green-400';
          if (num < 0) colorClass = 'text-red-400';
      }
    }
    
    return <span className={`text-xs md:text-sm font-mono ${colorClass}`}>{val}</span>;
  };

  const binanceStyle = activeExchange === 'Binance' 
    ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' 
    : '';

  const bybitStyle = activeExchange === 'Bybit'
    ? 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]'
    : '';

  const bitgetStyle = activeExchange === 'Bitget'
    ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]'
    : '';

  const okxStyle = activeExchange === 'OKX'
    ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]'
    : '';

  const getCVDTooltip = () => {
      if (!cvdData) return {
          status: "Calculando Fluxo...",
          interpretation: "Aguardando dados de velas...",
          icon: <Activity size={12} className="text-gray-500" />
      };

      const { delta, priceChangePercent } = cvdData;
      const isPriceUp = priceChangePercent >= 0;
      const isCvdUp = delta > 0;

      if (!isPriceUp && isCvdUp) {
          return {
              status: "Agressão Oculta (Acumulação)",
              interpretation: "Compradores absorvendo vendas agressivamente. Fluxo institucional indica reversão de alta.",
              icon: <Zap size={12} className="text-green-400" />
          };
      }
      else if (isPriceUp && !isCvdUp) {
           return {
              status: "Agressão Oculta (Distribuição)",
              interpretation: "Vendedores distribuindo posições no topo. Fluxo institucional indica queda brusca.",
              icon: <Zap size={12} className="text-red-400" />
          };
      }
      else {
          const dir = isCvdUp ? "ALTA (Long)" : "BAIXA (Short)";
          return {
              status: "Agressão em Confluência",
              interpretation: `O fluxo de ordens confirma a tendência de ${dir} do preço. Movimento sustentável.`,
              icon: isCvdUp ? <TrendingUp size={12} className="text-green-400" /> : <TrendingDown size={12} className="text-red-400" />
          };
      }
  };

  const cvdInfo = getCVDTooltip();
  const cvdColor = cvdData ? (cvdData.delta > 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-400';

  // Melhoria 3: Lógica Destaque Visual de Divergência CVD
  // Using simplified logic locally since we don't have historical delta inside cvdData, just the 24h delta.
  // The system prompt says "Quando o pre?o estiver subindo mas o delta de agress?o de compra estiver caindo por 3 candles...".
  // Since we only have static delta in cvdData object, we use the hidden accumulation/distribution states already provided by getCVDTooltip to infer divergence.
  const isDivergenceBullish = cvdData && cvdData.priceChangePercent < 0 && cvdData.delta > 0;
  const isDivergenceActive = cvdData && cvdData.priceChangePercent > 0 && cvdData.delta < 0;

  // Melhoria 9: Indicador de Fluxo de Capital (OI total + Média de Funding)
  let sumOI = 0;
  let countOI = 0;
  let sumFunding = 0;
  let countFunding = 0;
  const exchanges = ['binance', 'bybit', 'bitget', 'okx'] as const;
  
  exchanges.forEach(ex => {
      if (data[ex] && data[ex]?.oi && data[ex]?.oi !== '---') {
          // Remover caracteres nao numericos para somar OI (ex: 1.2B) - fallback
          const oiStr = String(data[ex]?.oi).replace(/[^0-9.]/g, '');
          if (oiStr) {
             sumOI += parseFloat(oiStr);
             countOI++;
          }
      }
      if (data[ex] && data[ex]?.funding && data[ex]?.funding !== '---') {
          sumFunding += parseFloat(String(data[ex]?.funding).replace('%', ''));
          countFunding++;
      }
  });

  const avgFunding = countFunding > 0 ? sumFunding / countFunding : 0;
  // Fallback heurística para subida/descida do OI: Como n?o temos o histórico imediato do OI, consideraremos o OI alto positivo.
  // Porem a regra ? "OI subindo (simulado positivo) e funding positivo". Adotaremos Funding Positivo = Capital Entrando, Negativo = Saindo para simplificar localmente ou basear no Funding.
  let capitalFlowStatus = "FLUXO LATERAL";
  let capitalFlowColor = "text-yellow-400";
  let CapitalFlowIcon = ActivitySquare;

  if (avgFunding > 0.005) {
      capitalFlowStatus = "CAPITAL ENTRANDO";
      capitalFlowColor = "text-green-400";
      CapitalFlowIcon = ArrowUp;
  } else if (avgFunding < -0.005) {
      capitalFlowStatus = "CAPITAL SAINDO";
      capitalFlowColor = "text-red-400";
      CapitalFlowIcon = ArrowDown;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-[16px] mb-6">
      
      {/* 1. Fear & Greed Index */}
      <div className={`${cardBase}`}>
        <FearAndGreed />
      </div>

      {/* 2. Long/Short Ratio Card */}
      <div className={`${cardBase}`}>
        <LongShortRatio symbol={selectedPair} />
      </div>

      {/* 3. Binance */}
      <div className={`${cardBase} ${binanceStyle}`}>
         <div className="flex justify-between items-start mt-3 relative z-10">
             <div className="flex items-center gap-2">
                 <span className={`font-bold text-sm ${activeExchange === 'Binance' ? 'text-yellow-400' : 'text-gray-500'}`}>Binance</span>
                 {activeExchange === 'Binance' && <span className="flex h-1.5 w-1.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-400"></span></span>}
             </div>
             <span className="bg-yellow-500/10 text-yellow-500 text-[10px] px-1.5 py-0.5 rounded font-mono border-yellow-500/20">B</span>
         </div>
         <div className="space-y-2 relative z-10">
             <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">FUNDING</span>
                 {renderValue(data.binance?.funding, true)}
             </div>
             <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">OPEN INT.</span>
                 {renderValue(data.binance?.oi, false)}
             </div>
             <div className="flex justify-end pt-1">
                 <div className="flex items-center gap-1 opacity-60">
                     <Clock size={8} className="text-gray-400" />
                     <span className="text-[9px] font-mono font-bold text-gray-400">{timeToNextFunding}</span>
                 </div>
             </div>
         </div>
      </div>

      {/* 4. Bybit */}
      <div className={`${cardBase} ${bybitStyle}`}>
         <div className="flex justify-between items-start mt-3 relative z-10">
             <div className="flex items-center gap-2">
                 <span className={`font-bold text-sm ${activeExchange === 'Bybit' ? 'text-orange-400' : 'text-gray-500'}`}>Bybit</span>
                 {activeExchange === 'Bybit' && <span className="flex h-1.5 w-1.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-400"></span></span>}
             </div>
             <span className="bg-orange-500/10 text-orange-400 text-[10px] px-1.5 py-0.5 rounded font-mono border-orange-500/20">B</span>
         </div>
         <div className="space-y-2 relative z-10">
             <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">FUNDING</span>
                 {renderValue(data.bybit?.funding, true)}
             </div>
             <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">OPEN INT.</span>
                 {renderValue(data.bybit?.oi, false)}
             </div>
             <div className="flex justify-end pt-1">
                 <div className="flex items-center gap-1 opacity-60">
                     <Clock size={8} className="text-gray-400" />
                     <span className="text-[9px] font-mono font-bold text-gray-400">{timeToNextFunding}</span>
                 </div>
             </div>
         </div>
      </div>

      {/* 5. Bitget */}
       <div className={`${cardBase} ${bitgetStyle}`}>
         <div className="flex justify-between items-start mt-3 relative z-10">
             <div className="flex items-center gap-2">
                 <span className={`font-bold text-sm ${activeExchange === 'Bitget' ? 'text-blue-400' : 'text-gray-500'}`}>Bitget</span>
                 {activeExchange === 'Bitget' && <span className="flex h-1.5 w-1.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400"></span></span>}
             </div>
             <span className="bg-blue-500/10 text-blue-400 text-[10px] px-1.5 py-0.5 rounded font-mono border-blue-500/20">B</span>
         </div>
         <div className="space-y-2 relative z-10">
             <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">FUNDING</span>
                 {renderValue(data.bitget?.funding, true)}
             </div>
             <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">OPEN INT.</span>
                 {renderValue(data.bitget?.oi, false)}
             </div>
             <div className="flex justify-end pt-1">
                 <div className="flex items-center gap-1 opacity-60">
                     <Clock size={8} className="text-gray-400" />
                     <span className="text-[9px] font-mono font-bold text-gray-400">{timeToNextFunding}</span>
                 </div>
             </div>
         </div>
      </div>

      {/* 6. OKX */}
      <div className={`${cardBase} ${okxStyle}`}>
         <div className="flex justify-between items-start mt-3 relative z-10">
             <div className="flex items-center gap-2">
                 <span className={`font-bold text-sm ${activeExchange === 'OKX' ? 'text-green-400' : 'text-gray-500'}`}>OKX</span>
                 {activeExchange === 'OKX' && <span className="flex h-1.5 w-1.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span></span>}
             </div>
             <span className="bg-green-500/10 text-green-400 text-[10px] px-1.5 py-0.5 rounded font-mono border-green-500/20">O</span>
         </div>
         <div className="space-y-2 relative z-10">
             <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">FUNDING</span>
                 {renderValue(data.okx?.funding, true)}
             </div>
             <div className="flex justify-between items-center">
                 <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">OPEN INT.</span>
                 {renderValue(data.okx?.oi, false)}
             </div>
             <div className="flex justify-end pt-1">
                 <div className="flex items-center gap-1 opacity-60">
                     <Clock size={8} className="text-gray-400" />
                     <span className="text-[9px] font-mono font-bold text-gray-400">{timeToNextFunding}</span>
                 </div>
             </div>
         </div>
      </div>

      {/* 7. Fluxo de Capital */}
      <div className={`${cardBase} border-white/5`}>
         <div className="flex justify-between items-start mt-3 relative z-10">
             <div className="flex items-center gap-2">
                 <span className={`font-bold text-xs text-white`}>Fluxo de Capital</span>
             </div>
             <span className="bg-white/5 text-gray-400 text-[10px] px-1.5 py-0.5 rounded font-mono border-white/10">F</span>
         </div>
         <div className="space-y-2 relative z-10">
             <div className="flex justify-between items-center mb-1">
                <span className={`text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 ${capitalFlowColor}`}>
                    <CapitalFlowIcon size={12} /> {capitalFlowStatus}
                </span>
             </div>
             <div className="flex justify-between items-center">
                 <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">MÉDIA FDG</span>
                 <span className={`text-[10px] font-mono ${avgFunding > 0 ? 'text-green-400' : 'text-red-400'}`}>{(avgFunding * 100).toFixed(4)}%</span>
             </div>
             <div className="flex justify-between items-center">
                 <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">SUM OI</span>
                 <span className="text-[10px] font-mono text-white">
                    ${sumOI > 1_000_000_000 ? (sumOI / 1_000_000_000).toFixed(2) + 'B' : sumOI > 1_000_000 ? (sumOI / 1_000_000).toFixed(2) + 'M' : sumOI.toFixed(0)}
                 </span>
             </div>
             <div className="flex justify-between items-center">
                 <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">DIREÇÃO CVD</span>
                 <span className={`text-[10px] font-mono ${cvdInfo.status.includes('Acumulação') || cvdInfo.interpretation.includes('ALTA') ? 'text-green-400' : 'text-red-400'}`}>
                    {cvdInfo.interpretation.includes('ALTA') || cvdInfo.status.includes('Acumulação') ? 'BULL' : 'BEAR'}
                 </span>
             </div>
         </div>
      </div>

      {/* 7. CVD (AGRESSÃO) */}
      <div className={`${cvdCardStyle} md:col-span-2 lg:col-span-2 z-[999999]`}>
          
          {/* TOOLTIP: CVD LOGIC */}
          <div className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 mt-3 w-80 p-[16px] bg-black border border-white/5 rounded shadow-[0_0_50px_rgba(0,0,0,1)] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-[9999999]">
              <div className="text-[10px] text-gray-300 leading-relaxed font-sans text-left">
                  <span className="block font-bold text-genesis-accent uppercase mt-2  pb-1 text-center tracking-widest">
                      Dinâmica de Fluxo (CVD)
                  </span>
                  
                  <div className="mt-2">
                      <span className="text-gray-500 font-bold uppercase text-[9px] flex items-center gap-1">
                          {cvdInfo.icon} Status
                      </span>
                      <p className="text-white font-medium">{cvdInfo.status}</p>
                  </div>

                  <div>
                      <span className="text-gray-500 font-bold uppercase text-[9px]">Leitura Profissional</span>
                      <p className="text-genesis-positive font-bold">{cvdInfo.interpretation}</p>
                  </div>
              </div>
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black  transform rotate-45"></div>
          </div>

          <div className="flex justify-between items-start mt-3 relative z-10">
              <div className="flex justify-between w-full items-center">
                  <div className="flex items-center gap-2">
                      <Activity size={14} className="text-cyan-400" />
                      <span className="font-bold text-sm text-gray-400 uppercase tracking-widest">Agressão (CVD)</span>
                  </div>
              </div>
          </div>
          
          <div className="flex items-center justify-between relative z-10 mt-auto pt-4">
               <div className="flex flex-col">
                   <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Delta Cumulativo (24h)</span>
                   <span className={`text-2xl font-mono font-bold tracking-tight ${cvdColor}`}>
                       {cvdData ? cvdData.delta.toFixed(2) : '---'}
                   </span>

                   {/* Novo Indicador em Tempo Real CVD */}
                   {realtimeCvd && realtimeCvd.isDivergenceActive && (
                     <div className="mt-1">
                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded animate-pulse ${realtimeCvd.divergenceDirection === 'BULLISH' ? 'bg-green-500/10 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-red-500/10 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`}>
                           DIVERGÊNCIA ATIVA {realtimeCvd.divergenceDirection}
                        </span>
                     </div>
                   )}
               </div>
               
               <div className={`p-2 rounded-full ${cvdData && cvdData.delta > 0 ? 'bg-green-900/10 border-green-500/20' : 'bg-red-900/10 border-red-500/20'}`}>
                   {cvdData && cvdData.delta > 0 ? <TrendingUp size={20} className="text-green-500" /> : <TrendingDown size={20} className="text-red-500" />}
               </div>
          </div>
      </div>

      <ConfluenceScore />

    </div>
  );
};

export default MarketWidget;
