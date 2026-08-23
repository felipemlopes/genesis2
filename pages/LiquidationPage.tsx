import React, { useState } from 'react';
import { Skull } from 'lucide-react';
import LiquidationHeatmap from '../components/LiquidationHeatmap';

/**
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 10, item 10.3, doc §15): reescrito.
 * Achado real ao executar o item (não pedido pelo documento, mas bloqueava a execução literal
 * dele): esta página renderizava `LiquidationRadar` (agora apagado), que consumia
 * `services/liquidationService.ts` (também apagado) — volumes "institucionais" 100% gerados por
 * `Math.random()`, exibidos como zonas reais de liquidação e acompanhados de um resumo de
 * "Análise de Risco (AI)" igualmente fabricado. Violava diretamente a regra que não pode ser
 * reinterpretada ("nunca simular dado que não existe") — `LiquidationHeatmap.tsx` já existe como
 * a versão honesta (estimativa real a partir de Open Interest, `LiquidationMapService`/item 10.1),
 * só nunca tinha uma página própria fora do fluxo de análise. Esta página passa a ser um wrapper
 * fino sobre ela, com seletor de símbolo (mesmos 3 pares que o componente antigo oferecia).
 */
const LiquidationPage: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-genesis-accent/10 flex items-center justify-center border border-genesis-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            <Skull size={20} className="text-genesis-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-thin text-white tracking-widest uppercase">Mapa de Liquidação</h1>
            <p className="text-[10px] text-gray-500 font-mono">Estimativa a partir do Open Interest real — nunca liquidação observada</p>
          </div>
        </div>

        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-black border border-white/10 rounded px-3 py-1.5 text-xs text-white uppercase font-bold focus:border-genesis-accent focus:outline-none cursor-pointer hover:border-white/20 transition-all"
        >
          <option value="BTCUSDT">BTC/USDT</option>
          <option value="ETHUSDT">ETH/USDT</option>
          <option value="SOLUSDT">SOL/USDT</option>
        </select>
      </div>

      <div className="max-w-2xl w-full mx-auto">
        <LiquidationHeatmap symbol={symbol} timeframe="1d" />
      </div>
    </div>
  );
};

export default LiquidationPage;
