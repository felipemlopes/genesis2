import React from 'react';
import { PlayCircle, Trash2 } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { formatPrice } from '../services/cryptoApi';

const ActiveTradesPage: React.FC = () => {
  const { activeTrades, setActiveTrades, closedTrades, setClosedTrades } = useAppContext();

  const handleClearTrades = () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico de operações ATIVAS?')) {
      setActiveTrades([]);
    }
  };

  const handleExecuteTrade = (tradeId: string) => {
    setActiveTrades((prev) =>
      prev.map((t) => {
        if (t.id === tradeId) {
          return { ...t, status: 'Executada' };
        }
        return t;
      })
    );
  };

  const handleCloseTrade = (tradeId: string) => {
    const trade = activeTrades.find((t) => t.id === tradeId);
    if (!trade) return;
    const finalTrade = { ...trade, status: 'Finalizada' };
    setClosedTrades((prev) => [finalTrade, ...prev]);
    setActiveTrades((prev) => prev.filter((t) => t.id !== tradeId));
  };

  return (
    <div className="bg-[#0b0b0f] rounded-2xl p-4 shadow-inner white/.0.05. rounded-[10px] p-4 shadow-[0_0_30px_rgba(139,92,246,0.05)] h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <PlayCircle className="text-genesis-positive" />
          <h2 className="text-xl text-[11px] uppercase tracking-[0.10em] font-bold text-genesis-text-muted uppercase">Operações Ativas</h2>
        </div>
        <button
          onClick={handleClearTrades}
          className="bg-red-900/10 hover:bg-red-900/30 text-red-500 red-900/20 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors uppercase tracking-wider"
        >
          <Trash2 size={14} /> Limpar
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-white/5 text-[10px] font-bold text-genesis-text-secondary uppercase tracking-widest">
              <th className="py-4">Data</th>
              <th className="py-4">Exchange</th>
              <th className="py-4">Ativo</th>
              <th className="py-4">Alav.</th>
              <th className="py-4">Op.</th>
              <th className="py-4">Entrada</th>
              <th className="py-4">Atual</th>
              <th className="py-4">Status</th>
              <th className="py-4">P&L</th>
              <th className="py-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {activeTrades.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-genesis-text-muted text-xs uppercase tracking-widest">
                  Nenhuma operação ativa.
                </td>
              </tr>
            ) : (
              activeTrades.map((trade) => (
                <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-4 text-xs text-genesis-text-secondary font-mono">{(trade.date || '').split(',')[0]}</td>
                  <td className="py-4 text-xs text-genesis-accent">{trade.exchange}</td>
                  <td className="py-4 text-xs text-white font-bold">{trade.asset}</td>
                  <td className="py-4 text-xs text-genesis-text-secondary">{trade.leverage}</td>
                  <td className="py-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${trade.direction === 'SHORT' ? 'border-red-500/30 text-red-400' : 'border-green-500/30 text-green-400'}`}>
                      {trade.direction}
                    </span>
                  </td>
                  <td className="py-4 text-xs font-mono text-genesis-text-secondary">{formatPrice(trade.entryPrice)}</td>
                  <td className="py-4 text-xs font-mono text-white font-bold animate-pulse">{trade.currentPriceStr || '-'}</td>
                  <td className="py-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                        trade.status === 'Meta Atingida' || trade.status === 'FECHADO'
                          ? 'border-green-500/30 text-green-400'
                          : trade.status === 'Executada'
                          ? 'border-blue-500/30 text-blue-400'
                          : 'border-yellow-500/30 text-yellow-400'
                      }`}
                    >
                      {trade.status === 'FECHADO' ? 'Meta Atingida' : trade.status}
                    </span>
                  </td>
                  <td className={`py-4 text-xs font-mono ${trade.pnl.includes('+') ? 'text-green-400' : trade.pnl.includes('-') ? 'text-red-400' : 'text-genesis-text-secondary'}`}>
                    {trade.pnl}
                  </td>
                  <td className="py-4 text-right">
                    {trade.status === 'Pendente' ? (
                      <button
                        onClick={() => handleExecuteTrade(trade.id)}
                        className="text-green-500 hover:text-green-400 text-[10px] font-bold uppercase tracking-wider green-500/30 px-3 py-1 rounded hover:bg-green-500/10 transition-colors"
                      >
                        Executar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCloseTrade(trade.id)}
                        className="text-red-500 hover:text-red-400 text-[10px] font-bold uppercase tracking-wider red-500/30 px-3 py-1 rounded hover:bg-red-500/10 transition-colors"
                      >
                        Fechar
                      </button>
                    )}
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

export default ActiveTradesPage;
