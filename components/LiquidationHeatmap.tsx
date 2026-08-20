import React, { useEffect, useState } from 'react';
import { Flame, AlertCircle } from 'lucide-react';
import { fetchLiquidationMap, LiquidationMapZona } from '../services/api';

/**
 * A11 (V6.9) — reescrito. A versão anterior chamava `/fapi/v1/allForceOrders`, endpoint que a
 * Binance descontinuou — a chamada sempre falhava e caía num "fallback" que GERAVA números
 * aleatórios (`Math.random()`), exibidos como se fossem liquidações reais. Tinha ainda dois
 * símbolos fixos no código (BTC/ETH), então nem era do ativo que o membro estava analisando.
 *
 * Agora consome `LiquidationMapService` (backend) — estimativa construída a partir do histórico
 * público de Open Interest + candles de futuros, pelo par que a análise atual está usando.
 * SEMPRE rotulado como estimativa, nunca como liquidação observada.
 */

interface LiquidationHeatmapProps {
  symbol: string;
  timeframe?: string;
}

const formatVol = (val: number) => {
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + 'M';
  if (val >= 1_000) return (val / 1_000).toFixed(2) + 'K';
  return val.toFixed(2);
};

const formatPreco = (val: number) => `$ ${val.toLocaleString('pt-BR', { maximumFractionDigits: val >= 100 ? 0 : 4 })}`;

const LiquidationHeatmap: React.FC<LiquidationHeatmapProps> = ({ symbol, timeframe = '1d' }) => {
  const [zonas, setZonas] = useState<LiquidationMapZona[] | null>(null);
  const [precoAtual, setPrecoAtual] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(false);
    setZonas(null);

    const carregar = async () => {
      const resultado = await fetchLiquidationMap(symbol, timeframe);
      if (!isMounted) return;

      if (!resultado || !resultado.disponivel || !resultado.zonas || resultado.zonas.length === 0) {
        setError(true);
        setLoading(false);
        return;
      }

      setZonas(resultado.zonas);
      setPrecoAtual(resultado.preco_atual ?? null);
      setLoading(false);
    };

    carregar();
    // Histórico de OI se move devagar — 5 minutos é suficiente, evita bater a rota sem necessidade.
    const interval = setInterval(carregar, 300_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [symbol, timeframe]);

  if (loading) {
    return (
      <div className="bg-genesis-card p-4 rounded-xl border border-white/5 animate-pulse min-h-[160px]">
        <div className="h-4 w-32 bg-white/10 rounded mb-4" />
        <div className="h-8 w-full bg-white/10 rounded mb-2" />
        <div className="h-8 w-full bg-white/10 rounded" />
      </div>
    );
  }

  if (error || !zonas || precoAtual === null) {
    return (
      <div className="bg-genesis-card p-4 rounded-xl border border-white/5 min-h-[160px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <AlertCircle size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Dados Indisponíveis</span>
        </div>
      </div>
    );
  }

  const acima = zonas.filter((z) => z.preco_de >= precoAtual).sort((a, b) => a.preco_de - b.preco_de).slice(0, 3);
  const abaixo = zonas.filter((z) => z.preco_de < precoAtual).sort((a, b) => b.preco_de - a.preco_de).slice(0, 3);

  return (
    <div className="bg-genesis-card p-4 rounded-xl border border-white/5 shadow-lg relative overflow-hidden">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Flame size={16} className="text-orange-500" />
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mapa de Liquidações</h3>
        </div>
      </div>
      {/* A11: rótulo obrigatório — nunca deixar parecer liquidação observada. */}
      <p className="text-[8px] text-gray-600 uppercase tracking-wide mb-3">
        Estimado a partir do Open Interest — últimos 30 dias
      </p>

      <div className="flex flex-col gap-2 relative">
        <div className="flex flex-col gap-1.5">
          {acima.length === 0 && <span className="text-[9px] text-gray-600 italic">Sem zona estimada acima do preço.</span>}
          {acima.map((zona, idx) => (
            <div key={`above-${idx}`} className="flex items-center justify-between bg-red-500/5 border border-red-500/10 rounded px-2 py-1 relative overflow-hidden group">
              <div className="absolute left-0 top-0 h-full bg-red-500" style={{ width: `${Math.max(4, zona.intensidade * 100)}%`, opacity: 0.15 }} />
              <div className="flex flex-col pl-2 relative">
                <span className="text-[8px] text-red-400 font-bold tracking-widest uppercase">Zona estimada acima</span>
                <span className="text-xs text-white font-mono">{formatPreco(zona.preco_de)}–{formatPreco(zona.preco_ate)}</span>
              </div>
              <span className="text-xs text-red-200 font-mono font-bold relative">${formatVol(zona.nocional)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 my-1 opacity-50">
          <div className="h-px w-full bg-blue-500/30" />
          <span className="text-[9px] text-blue-400 font-mono font-bold whitespace-nowrap">{formatPreco(precoAtual)} PREÇO</span>
          <div className="h-px w-full bg-blue-500/30" />
        </div>

        <div className="flex flex-col gap-1.5">
          {abaixo.length === 0 && <span className="text-[9px] text-gray-600 italic">Sem zona estimada abaixo do preço.</span>}
          {abaixo.map((zona, idx) => (
            <div key={`below-${idx}`} className="flex items-center justify-between bg-green-500/5 border border-green-500/10 rounded px-2 py-1 relative overflow-hidden group">
              <div className="absolute left-0 top-0 h-full bg-green-500" style={{ width: `${Math.max(4, zona.intensidade * 100)}%`, opacity: 0.15 }} />
              <div className="flex flex-col pl-2 relative">
                <span className="text-[8px] text-green-400 font-bold tracking-widest uppercase">Zona estimada abaixo</span>
                <span className="text-xs text-white font-mono">{formatPreco(zona.preco_de)}–{formatPreco(zona.preco_ate)}</span>
              </div>
              <span className="text-xs text-green-200 font-mono font-bold relative">${formatVol(zona.nocional)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiquidationHeatmap;
