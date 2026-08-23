
import React, { useEffect, useState } from 'react';
import { Waves, HelpCircle } from 'lucide-react';
import { fetchFlowTrackData, FlowTrackData } from '../services/flowTrackService';
import { TradeFlowWindow } from '../services/api';

/**
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 12, item 12.5, doc §17): SUBSTITUÍDO —
 * ver docblock de `flowTrackService.ts` para o histórico completo do que foi apagado (whale-alert
 * fake, blockchain/from/to/hash simulados, Math.random() em endereços ativos, barras de largura
 * fixa). Renomeado para "Fluxo agressor no Perpetual" — mostra só o que `TradeFlowService`
 * realmente calcula: buy/sell notional por janela, a partir do tape real da Binance USD-M Futures.
 */

const JANELAS_INTRADAY = [
  { timeframe: '1m', label: '1 minuto' },
  { timeframe: '5m', label: '5 minutos' },
  { timeframe: '1h', label: '1 hora' },
];

const rotuloJanela = (segundos: string): string => {
  const s = Number(segundos);
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)}h`;
};

const rotuloEstado: Record<string, string> = {
  AGRESSAO_COMPRADORA: 'Agressão compradora',
  AGRESSAO_VENDEDORA: 'Agressão vendedora',
  EQUILIBRIO: 'Equilíbrio',
  INDISPONIVEL: 'Indisponível',
};

const corEstado: Record<string, string> = {
  AGRESSAO_COMPRADORA: 'text-genesis-positive',
  AGRESSAO_VENDEDORA: 'text-genesis-negative',
  EQUILIBRIO: 'text-gray-400',
  INDISPONIVEL: 'text-gray-600',
};

const formatUsd = (v: number): string => {
  const abs = Math.abs(v);
  const sinal = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sinal}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sinal}$${(abs / 1_000).toFixed(1)}k`;
  return `${sinal}$${abs.toFixed(0)}`;
};

const FlowTrack: React.FC = () => {
  const [data, setData] = useState<FlowTrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('5m');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchFlowTrackData(selectedAsset, timeframe);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [selectedAsset, timeframe]);

  const displayAsset = selectedAsset.replace('USDT', '/USDT');
  const janelas: [string, TradeFlowWindow][] = data?.windows ? Object.entries(data.windows) : [];

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-genesis-accent/10 flex items-center justify-center border-genesis-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            <Waves size={20} className="text-genesis-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-thin text-white tracking-widest uppercase">Fluxo Agressor no Perpetual</h1>
            <p className="text-[10px] text-gray-500 font-mono">Buy/Sell notional real — Binance USD-M Futures</p>
          </div>
        </div>

        <div className="flex items-center gap-[16px]">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="bg-black rounded px-3 py-1.5 text-xs text-white uppercase font-bold focus:border-genesis-accent focus:outline-none cursor-pointer transition-all"
          >
            {JANELAS_INTRADAY.map((j) => (
              <option key={j.timeframe} value={j.timeframe}>{j.label}</option>
            ))}
          </select>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="bg-black rounded px-3 py-1.5 text-xs text-white uppercase font-bold focus:border-genesis-accent focus:outline-none cursor-pointer transition-all"
          >
            <option value="BTCUSDT">BTC/USDT</option>
            <option value="ETHUSDT">ETH/USDT</option>
            <option value="SOLUSDT">SOL/USDT</option>
          </select>
        </div>
      </div>

      {loading && !data ? (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-[16px]">
            <div className="w-12 h-12 rounded-full border-genesis-accent border-t-transparent animate-spin" />
            <span className="text-xs font-mono text-genesis-accent animate-pulse tracking-widest">CARREGANDO TAPE REAL...</span>
          </div>
        </div>
      ) : !data || data.status !== 'AVAILABLE' ? (
        <div className="h-full flex items-center justify-center p-8 text-gray-500 text-xs uppercase tracking-widest text-center">
          Indisponível para {displayAsset} em {timeframe}.
          <br />
          {data?.errorCode === 'TRADE_FLOW_FORA_DA_POLITICA_DE_TIMEFRAME'
            ? 'Fluxo agressor só existe para timeframes intraday (1m-1h).'
            : 'Fonte de dados fora do ar no momento.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-10">
            {janelas.map(([segundos, janela]) => {
              const total = janela.buy_notional + janela.sell_notional;
              const buyPct = total > 0 ? (janela.buy_notional / total) * 100 : 50;

              return (
                <div key={segundos} className="bg-genesis-card rounded-[10px] p-6 relative group">
                  <div className="absolute top-2 right-2 group/tip cursor-help z-20">
                    <HelpCircle size={14} className="text-gray-600 hover:text-white transition-colors" />
                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-black rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover/tip:opacity-100 group-hover/tip:visible transition-all z-[999999]">
                      <p className="text-[10px] text-gray-400 leading-relaxed font-sans">
                        Soma do notional (preço × quantidade) de negócios reais executados nesta janela, separados por quem agrediu o book — comprador ou vendedor. Puramente informativo, nunca decide direção.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-white">{rotuloJanela(segundos)}</h3>
                    <span className={`text-[10px] font-bold uppercase ${corEstado[janela.estado] ?? 'text-gray-400'}`}>
                      {rotuloEstado[janela.estado] ?? janela.estado}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white/5 rounded-lg p-3">
                      <span className="text-[9px] text-gray-500 uppercase font-bold">Compra (agressor)</span>
                      <div className="text-sm font-mono font-bold text-genesis-positive mt-1">{formatUsd(janela.buy_notional)}</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-3">
                      <span className="text-[9px] text-gray-500 uppercase font-bold">Venda (agressor)</span>
                      <div className="text-sm font-mono font-bold text-genesis-negative mt-1">{formatUsd(janela.sell_notional)}</div>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden flex mb-3">
                    <div className="h-full bg-genesis-positive transition-all duration-700" style={{ width: `${buyPct}%` }} />
                    <div className="h-full bg-genesis-negative transition-all duration-700" style={{ width: `${100 - buyPct}%` }} />
                  </div>

                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>Delta: <span className={janela.delta_notional >= 0 ? 'text-genesis-positive' : 'text-genesis-negative'}>{formatUsd(janela.delta_notional)}</span></span>
                    <span>{janela.trade_count} negócios</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 pt-6 pb-6 text-center opacity-70">
            <p className="text-[10px] text-gray-500 font-sans max-w-3xl mx-auto leading-relaxed">
              O Fluxo Agressor no Perpetual mostra apenas negócios reais já executados na Binance USD-M Futures, agregados por janela de tempo e separados por quem agrediu o livro de ofertas (comprador ou vendedor). Não é um indicador de direção — é puramente informativo sobre a pressão de negociação recente.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default FlowTrack;
