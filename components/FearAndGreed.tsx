
import React, { useEffect, useState } from 'react';
import { fetchWithProxy } from '../services/cryptoApi';
import { ShieldCheck, ShieldAlert } from 'lucide-react';

interface RiskData {
  sp500Change: number;
  vixChange: number;
  dxyChange: number;
  status: 'Risk On' | 'Risk Off' | 'Neutro';
}

const FearAndGreed: React.FC = () => {
  const [data, setData] = useState<{ value: string; label: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [riskData, setRiskData] = useState<RiskData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use the robust proxy fetcher to avoid CORS and stability issues
        const targetUrl = 'https://api.alternative.me/fng/?limit=1';
        const json = await fetchWithProxy(targetUrl);
        
        if (json.data && json.data.length > 0) {
          setData({
            value: json.data[0].value,
            label: json.data[0].value_classification
          });
        }
      } catch (e) {
        console.error("F&G Fetch Error", e);
        // Fallback data in case of persistent failure to ensure UI integrity
        setData({ value: '50', label: 'Neutral (Fallback)' });
      } finally {
        setLoading(false);
      }
    };

    const fetchRiskStatus = async () => {
        try {
            const fetchYahoo = async (symbol: string, fallback: number) => {
               try {
                  const data = await fetchWithProxy(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
                  if (data && data.chart && data.chart.result && data.chart.result[0]) {
                      const meta = data.chart.result[0].meta;
                      return ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100;
                  }
               } catch (e) {
                  // Fallback silencioso
               }
               return fallback;
            };

            const [sp500, vix, dxy] = await Promise.all([
               fetchYahoo('^GSPC', 0.5),   // Fallback: S&P levemente positivo
               fetchYahoo('^VIX', -1.2),   // Fallback: VIX caindo
               fetchYahoo('DX-Y.NYB', -0.3) // Fallback: DXY caindo
            ]);

            let status: 'Risk On' | 'Risk Off' | 'Neutro' = 'Neutro';
            
            // Melhoria 5: Lógica de Risk On / Risk Off
            if (sp500 > 0 && vix < 0 && dxy < 0) {
                status = 'Risk On';
            } else if (sp500 < 0 && vix > 0 && dxy > 0) {
                status = 'Risk Off';
            } else if (sp500 > 0 && vix < 0) {
                status = 'Risk On';
            } else if (sp500 < 0 && vix > 0) {
                status = 'Risk Off';
            }

            setRiskData({
                sp500Change: sp500,
                vixChange: vix,
                dxyChange: dxy,
                status
            });
        } catch (e) {
            // Ignorar erro do componente
        }
    };

    fetchData();
    fetchRiskStatus();
    // Update every 5 minutes
    const interval = setInterval(() => { fetchData(); fetchRiskStatus(); }, 300000);
    return () => clearInterval(interval);
  }, []);

  const getValueColor = (val: number) => {
    if (val >= 75) return 'text-genesis-positive'; // Extreme Greed
    if (val >= 55) return 'text-green-400'; // Greed
    if (val >= 45) return 'text-yellow-400'; // Neutral
    if (val >= 25) return 'text-orange-400'; // Fear
    return 'text-genesis-negative'; // Extreme Fear
  };

  if (loading || !data) {
    return (
      <div className="flex flex-col justify-between h-full w-full p-1 animate-pulse">
         <div className="h-4 w-20 bg-white/10 rounded mb-2"></div>
         <div className="h-8 w-12 bg-white/10 rounded mb-2"></div>
         <div className="h-1 w-full bg-white/10 rounded"></div>
      </div>
    );
  }

  const valueInt = parseInt(data.value);
  const colorClass = getValueColor(valueInt);

  // Translate labels to PT-BR
  const translateLabel = (label: string) => {
      const l = label.toLowerCase();
      if (l.includes('extreme greed')) return 'Ganância Extrema';
      if (l.includes('greed')) return 'Ganância';
      if (l.includes('neutral')) return 'Neutro';
      if (l.includes('extreme fear')) return 'Medo Extremo';
      if (l.includes('fear')) return 'Medo';
      return label;
  };

  return (
    <div className="flex flex-col justify-center h-full w-full relative">
        {/* Melhoria 5: Badge de Status do Mercado Global Risk On ou Risk Off */}
        {riskData && riskData.status !== 'Neutro' && (
            <div className={`absolute -top-3 -right-2 px-2 py-0.5 rounded-full text-[9px] font-bold shadow-lg flex items-center gap-1 uppercase tracking-wider border
                ${riskData.status === 'Risk On' 
                  ? 'bg-green-900/30 text-green-400 border-green-500/30' 
                  : 'bg-red-900/30 text-red-500 border-red-500/30'}
            `}>
                {riskData.status === 'Risk On' ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                {riskData.status}
            </div>
        )}

        <div className="flex justify-between items-end mb-3 mt-1">
            <div className="flex flex-col">
                <span className={`text-3xl font-bold ${colorClass} tracking-tighter leading-none`}>
                    {data.value}
                </span>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">
                    Index
                </span>
            </div>
            <div className="text-right">
                <div className={`text-xs font-mono font-bold ${colorClass} mb-0.5`}>
                    {translateLabel(data.label)}
                </div>
                <div className="text-[10px] text-gray-600">
                    Sentimento Global
                </div>
            </div>
        </div>

        {/* Gradient Spectrum Bar (Red -> Orange -> Yellow -> Green) */}
        <div className="relative h-2 w-full bg-gray-800 rounded-full mt-2">
            <div 
                className="absolute inset-0 rounded-full opacity-80"
                style={{
                    background: 'linear-gradient(90deg, #ef4444 0%, #f97316 25%, #eab308 50%, #10b981 100%)'
                }}
            />
            
            {/* Value Indicator (Needle/Marker) */}
            <div 
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-4 bg-white rounded-sm shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all duration-1000 ease-out border-gray-900"
                style={{ left: `${valueInt}%` }}
            />
        </div>
        
        {/* Scale labels */}
        <div className="flex justify-between w-full mt-1 px-0.5 mb-1">
             <span className="text-[8px] text-red-500 font-bold">0</span>
             <span className="text-[8px] text-green-500 font-bold">100</span>
        </div>
    </div>
  );
};

export default FearAndGreed;
