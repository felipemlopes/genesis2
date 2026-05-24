import React from 'react';
import { History } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { formatPrice } from '../services/cryptoApi';

const HistoryPage: React.FC = () => {
  const { closedTrades } = useAppContext();

  return (
    <div className="bg-[#0b0b0f] rounded-2xl p-4 shadow-inner white/.0.05. rounded-[10px] p-4 shadow-[0_0_30px_rgba(139,92,246,0.05)] h-full flex flex-col">
      <div className="flex items-center gap-2 mb-8">
        <History className="text-genesis-text-secondary" />
        <h2 className="text-xl text-[11px] uppercase tracking-[0.10em] font-bold text-genesis-text-muted uppercase">Histórico</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-white/5 text-[10px] font-bold text-genesis-text-secondary uppercase tracking-widest">
              <th className="py-4">Data</th>
              <th className="py-4">Exchange</th>
              <th className="py-4">Ativo</th>
              <th className="py-4">Op.</th>
              <th className="py-4">Entrada</th>
              <th className="py-4">Status</th>
              <th className="py-4">P&L Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {closedTrades.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-genesis-text-muted text-xs uppercase tracking-widest">
                  Sem histórico.
                </td>
              </tr>
            ) : (
              closedTrades.map((trade) => (
                <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 text-xs text-genesis-text-secondary font-mono">{trade.date}</td>
                  <td className="py-4 text-xs text-genesis-text-secondary">{trade.exchange}</td>
                  <td className="py-4 text-xs text-white font-bold">{trade.asset}</td>
                  <td className="py-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${trade.direction === 'SHORT' ? 'border-red-500/20 text-red-400' : 'border-green-500/20 text-green-400'}`}>
                      {trade.direction}
                    </span>
                  </td>
                  <td className="py-4 text-xs font-mono text-genesis-text-secondary">{formatPrice(trade.entryPrice)}</td>
                  <td className="py-4">
                    <span className={`text-[9px] uppercase font-bold ${trade.status === 'FECHADO' || trade.status === 'Meta Atingida' ? 'text-genesis-positive' : 'text-genesis-text-secondary'}`}>
                      {trade.status === 'FECHADO' ? 'Meta Atingida' : trade.status}
                    </span>
                  </td>
                  <td className={`py-4 text-xs font-mono font-bold ${trade.pnl.includes('+') ? 'text-green-400' : trade.pnl.includes('-') ? 'text-red-400' : 'text-genesis-text-secondary'}`}>
                    {trade.pnl}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryPage;
