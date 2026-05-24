
import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, TrendingUp, TrendingDown, Zap, Activity } from 'lucide-react';
import { fetchWithProxy } from '../services/cryptoApi';

interface TrendQualityProps {
  symbol: string;
  exchange: string;
}

const TrendQuality: React.FC<TrendQualityProps> = ({ symbol, exchange }) => {
  const [premium, setPremium] = useState<number | null>(null);
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null); 
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    
    setPremium(null);
    setPriceChange24h(null);
    setLoading(true);
    setError(false);

    const loadTrendData = async () => {
      try {
        let rawSymbol = symbol.toUpperCase().replace('/', '').replace('-', '').replace('_', '');
        if (rawSymbol.includes('PERP')) rawSymbol = rawSymbol.replace('PERP', '');

        let base = rawSymbol;
        if (rawSymbol.endsWith('USDT')) base = rawSymbol.replace('USDT', '');
        else if (rawSymbol.endsWith('USD')) base = rawSymbol.replace('USD', '');
        
        let spotBase = base;
        if (spotBase.startsWith('1000000')) spotBase = spotBase.substring(7);
        else if (spotBase.startsWith('1000')) spotBase = spotBase.substring(4);
        else if (spotBase.startsWith('100')) spotBase = spotBase.substring(3);

        const spotSymbol = `${spotBase}USDT`;
        const futSymbol = `${base}USDT`; 

        let spotPrice = 0;
        let markPrice = 0;
        let change24h = 0;

        const t = Date.now();

        if (exchange === 'Binance') {
            const [tickerData, markData] = await Promise.all([
                fetchWithProxy(`https://api.binance.com/api/v3/ticker/24hr?symbol=${spotSymbol}`),
                fetchWithProxy(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${futSymbol}&_t=${t}`)
            ]);
            
            if (tickerData && tickerData.lastPrice) {
                spotPrice = parseFloat(tickerData.lastPrice);
                change24h = parseFloat(tickerData.priceChangePercent);
            }
            if (markData && markData.markPrice) {
                markPrice = parseFloat(markData.markPrice);
            }
        } 
        else if (exchange === 'Bybit') {
            const [spotJson, markJson] = await Promise.all([
                fetchWithProxy(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${spotSymbol}&_t=${t}`),
                fetchWithProxy(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${futSymbol}&_t=${t}`)
            ]);

            if (spotJson?.retCode === 0 && spotJson.result?.list?.[0]) {
                spotPrice = parseFloat(spotJson.result.list[0].lastPrice);
                change24h = parseFloat(spotJson.result.list[0].price24hPcnt) * 100;
            }
            if (markJson?.retCode === 0 && markJson.result?.list?.[0]) {
                markPrice = parseFloat(markJson.result.list[0].markPrice); 
            }
        }

        if (spotPrice > 0 && markPrice > 0) {
            const diff = ((markPrice - spotPrice) / spotPrice) * 100;
            if (isMounted) {
                setPremium(diff);
                setPriceChange24h(change24h);
            }
        } else {
            if (isMounted) setPremium(null);
        }

      } catch (err) {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadTrendData();

    return () => {
        isMounted = false;
    };
  }, [symbol, exchange]);

  if (loading) {
      return <div className="h-16 w-full mt-2 bg-white/5 animate-pulse rounded-lg " />;
  }

  const safeChange = priceChange24h !== null ? priceChange24h : 0;

  const getSqueezeDiagnosis = (prem: number | null) => {
      if (prem === null) return "Premium: Dados insuficientes para diagnóstico de arbitragem.";
      const isSpotBuying = prem < 0;
      const action = isSpotBuying ? "comprando (Sustentação)" : "vendendo (Distribuição)";
      const effect = isSpotBuying ? "dificultando a queda" : "criando divergência de baixa";
      const risk = isSpotBuying ? "Short Squeeze" : "Long Squeeze";
      return `Premium: O Spot está ${action}, ${effect}. Risco de ${risk} é o resultado provável desta estrutura.`;
  };

  const tooltipDiagnosis = getSqueezeDiagnosis(premium);

  const getAnalysis = (prem: number | null, change: number) => {
      const isUpTrend = change >= 0;
      if (prem === null) return {
          icon: <Activity size={14} />,
          label: "Aguardando Dados",
          color: "text-gray-500",
          borderColor: "",
          bg: "bg-white/5",
          legend: "Sincronizando prêmio entre Spot e Futuros."
      };

      if (isUpTrend) {
          if (prem <= 0.009) {
              return {
                  icon: <TrendingUp size={14} />,
                  label: "Surfando com as Baleias",
                  color: "text-genesis-positive",
                  borderColor: "border-genesis-positive/20",
                  bg: "bg-green-900/10",
                  legend: "Alta sólida impulsionada por compras Spot."
              };
          }
          if (prem >= 0.08) {
              return {
                  icon: <AlertTriangle size={14} />,
                  label: "Risco de Queda (Bolha)",
                  color: "text-genesis-negative",
                  borderColor: "border-genesis-negative/20",
                  bg: "bg-red-900/10",
                  legend: "Excesso de apostas alavancadas (Longs)."
              };
          }
          return {
              icon: <Activity size={14} />,
              label: "Alta Mista / Neutra",
              color: "text-yellow-400",
              borderColor: "border-yellow-500/20",
              bg: "bg-yellow-900/10",
              legend: "Dividida entre Spot e Futuros. Acompanhe."
          };
      } 
      else {
          if (prem <= -0.08) {
              return {
                  icon: <Zap size={14} />,
                  label: "Caça aos Ursos (Squeeze)",
                  color: "text-genesis-positive",
                  borderColor: "border-genesis-positive/20",
                  bg: "bg-green-900/10",
                  legend: "Excesso extremo de Shorts. Chance de repique."
              };
          }
          if (prem >= -0.04) {
               return {
                  icon: <TrendingDown size={14} />,
                  label: "Despejo Real",
                  color: "text-genesis-negative",
                  borderColor: "border-genesis-negative/20",
                  bg: "bg-red-900/10",
                  legend: "Venda forte no Spot. Tendência real de baixa."
              };
          }
          return {
              icon: <Activity size={14} />,
              label: "Atenção: Vendas Esticadas",
              color: "text-yellow-400",
              borderColor: "border-yellow-500/20",
              bg: "bg-yellow-900/10",
              legend: "Muitas apostas em Short entrando."
          };
      }
  };

  const analysis = getAnalysis(premium, safeChange);

  return (
    <div className="w-full mt-2 animate-in fade-in duration-500 group/trend relative cursor-help">
        <div className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 mt-3 w-80 p-5 bg-gray-950  rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] opacity-0 group-hover/trend:opacity-100 transition-all duration-300 pointer-events-none z-[999999] scale-95 group-hover/trend:scale-100 origin-top">
            <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider  pb-2 flex items-center gap-2">
                   <ShieldCheck size={14} className="text-genesis-accent" /> Premium Index
                </span>
                <p className="text-[10px] text-gray-300 leading-relaxed font-sans font-medium text-justify">
                    {tooltipDiagnosis}
                </p>
                <div className="mt-2 h-1 w-full bg-white/10 rounded overflow-hidden flex">
                    <div className={`h-full transition-all duration-500 ${(premium !== null && premium < 0) ? 'bg-genesis-positive w-1/2' : 'bg-transparent w-0'}`} />
                    <div className={`h-full transition-all duration-500 ml-auto ${(premium !== null && premium > 0) ? 'bg-genesis-negative w-1/2' : 'bg-transparent w-0'}`} />
                </div>
                <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase">
                    <span>Força Spot</span>
                    <span>Força Futuros</span>
                </div>
            </div>
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-950  transform rotate-45"></div>
        </div>

        <div className={`flex flex-col gap-1 p-3 rounded-xl transition-colors ${analysis.bg} ${analysis.borderColor}`}>
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${analysis.color}`}>
                {analysis.icon}
                <span>{analysis.label}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold text-white opacity-90">
                    Premium: {premium !== null ? `${premium > 0 ? '+' : ''}${premium.toFixed(4)}%` : 'N/A'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded bg-black/20 ${safeChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    24h: {safeChange > 0 ? '+' : ''}{safeChange.toFixed(2)}%
                </span>
            </div>
            <div className="text-[10px] text-gray-500 font-medium leading-tight pt-1 border-black/10 mt-1">
                {analysis.legend}
            </div>
        </div>
    </div>
  );
};

export default TrendQuality;
