import React from 'react';

type Familias = { estrutura: number; order_flow: number; derivativos: number; momentum: number };

const LIMITES: Record<keyof Familias, number> = {
  estrutura: 30, order_flow: 28, derivativos: 28, momentum: 14,
};

const NOMES: Record<keyof Familias, string> = {
  estrutura: 'Estrutura', order_flow: 'Order Flow', derivativos: 'Derivativos', momentum: 'Momentum',
};

/** Barra bipolar: vendedor a esquerda, comprador a direita, zero no centro. */
export default function FamiliasTrader({ familias }: { familias: Familias | null }) {
  if (!familias) return null;

  return (
    <div className="mb-5 relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
      {(Object.keys(NOMES) as (keyof Familias)[]).map((k) => {
        const v = Number(familias[k] ?? 0);
        const lim = LIMITES[k];
        const pct = Math.min(Math.abs(v) / lim, 1) * 50;
        const comprador = v > 0;
        const neutro = v === 0;

        return (
          <div key={k} className="bg-black/40 rounded p-3 border border-white/[0.05]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{NOMES[k]}</span>
              <span className={`text-[10px] font-mono font-bold ${
                neutro ? 'text-yellow-500' : comprador ? 'text-genesis-positive' : 'text-genesis-negative'
              }`}>{v > 0 ? `+${v}` : v} / ±{lim}</span>
            </div>
            <div className="relative w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
              <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
              {!neutro && (
                <div
                  className={`absolute top-0 h-full ${comprador ? 'bg-genesis-positive' : 'bg-genesis-negative'}`}
                  style={comprador
                    ? { left: '50%', width: `${pct}%` }
                    : { right: '50%', width: `${pct}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
