import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  RotateCcw,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { fetchMonitorStatus, fetchMonitorLog, resetMonitorAlerta } from '../services/api';

interface CarteiraStatus {
  ultimo_check: string | null;
  variacao_atual: number;
  ultimo_passo_disparado: number;
  direcao: 'valorizacao' | 'desvalorizacao' | null;
}

interface MonitorStatus {
  mae: CarteiraStatus;
  gemas: CarteiraStatus;
}

interface LogEntry {
  id: number;
  tipo_carteira: 'mae' | 'gemas';
  direcao: 'valorizacao' | 'desvalorizacao';
  passo: number;
  percentual: number;
  valor_atual: number;
  baseline: number;
  mensagem: string;
  enviado_com_sucesso: boolean;
  criado_em: string;
}

interface LogMeta {
  current_page: number;
  last_page: number;
}

const REFRESH_INTERVAL = 60_000;

function formatDatetime(dt: string | null): string {
  if (!dt) return '—';
  const date = new Date(dt);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatVariacao(variacao: number): { text: string; colorClass: string } {
  const sign = variacao >= 0 ? '+' : '';
  return {
    text: `${sign}${variacao.toFixed(2)}%`,
    colorClass: variacao >= 0 ? 'text-genesis-positive' : 'text-red-400',
  };
}

const MonitorStatusWidget: React.FC = () => {
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logMeta, setLogMeta] = useState<LogMeta>({ current_page: 1, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetchMonitorStatus();
      if (res.data) {
        setStatus(res.data);
      }
    } catch {
      // silently fail on auto-refresh
    }
  }, []);

  const loadLogs = useCallback(async (page?: number) => {
    try {
      const res = await fetchMonitorLog(page);
      if (res.data) {
        setLogs(res.data);
      }
      if (res.meta) {
        setLogMeta({ current_page: res.meta.current_page, last_page: res.meta.last_page });
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadStatus(), loadLogs()]);
      setLoading(false);
    }
    init();
  }, [loadStatus, loadLogs]);

  // Auto-refresh status every 60s
  useEffect(() => {
    const interval = setInterval(loadStatus, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadStatus]);

  async function handleReset(carteira: 'mae' | 'gemas') {
    const label = carteira === 'mae' ? 'Carteira Mãe' : 'Carteira Gema';
    const confirmed = window.confirm(
      `Tem certeza que deseja resetar os alertas da ${label}? Isso irá zerar o estado de passos disparados.`
    );
    if (!confirmed) return;

    try {
      setResetting(carteira);
      await resetMonitorAlerta(carteira);
      await loadStatus();
    } catch {
      // handle error silently
    } finally {
      setResetting(null);
    }
  }

  function handlePageChange(direction: 'prev' | 'next') {
    const newPage = direction === 'prev' ? logMeta.current_page - 1 : logMeta.current_page + 1;
    if (newPage < 1 || newPage > logMeta.last_page) return;
    loadLogs(newPage);
  }

  function renderStatusCard(title: string, carteira: 'mae' | 'gemas', data: CarteiraStatus) {
    const variacao = formatVariacao(data.variacao_atual);
    const isResetting = resetting === carteira;

    return (
      <div className="bg-[#0b0b0f] border border-white/5 rounded-2xl p-6 flex-1">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
            {title}
          </h3>
          <button
            type="button"
            onClick={() => handleReset(carteira)}
            disabled={isResetting}
            className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-400 text-[9px] uppercase font-bold tracking-widest rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Reset alertas ${title}`}
          >
            <RotateCcw size={10} className={isResetting ? 'animate-spin' : ''} />
            {isResetting ? 'Resetando...' : 'Reset'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Último Check */}
          <div className="flex items-center gap-2">
            <Clock size={12} className="text-gray-500" />
            <div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block">
                Último Check
              </span>
              <span className="text-xs text-white font-mono">
                {formatDatetime(data.ultimo_check)}
              </span>
            </div>
          </div>

          {/* Variação Atual */}
          <div className="flex items-center gap-2">
            {data.variacao_atual >= 0 ? (
              <TrendingUp size={12} className="text-genesis-positive" />
            ) : (
              <TrendingDown size={12} className="text-red-400" />
            )}
            <div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block">
                Variação Atual
              </span>
              <span className={`text-xs font-mono font-bold ${variacao.colorClass}`}>
                {variacao.text}
              </span>
            </div>
          </div>

          {/* Último Passo Disparado */}
          <div className="flex items-center gap-2">
            <Activity size={12} className="text-genesis-accent" />
            <div>
              <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block">
                Último Passo Disparado
              </span>
              <span className="text-xs text-white font-mono">
                {data.ultimo_passo_disparado > 0
                  ? `Passo ${data.ultimo_passo_disparado} (${data.direcao || '—'})`
                  : 'Nenhum'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-[#0b0b0f] border border-white/5 rounded-2xl p-8 flex items-center justify-center">
        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest animate-pulse">
          Carregando monitoramento...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-genesis-accent/10 rounded-lg flex items-center justify-center">
            <Activity size={14} className="text-genesis-accent" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <RefreshCw size={12} className="text-gray-500" />
              Status do Monitoramento
            </h2>
            <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">
              Atualização automática a cada 60 segundos
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { loadStatus(); loadLogs(logMeta.current_page); }}
          className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 text-[9px] uppercase font-bold tracking-widest rounded-lg px-3 py-1.5 transition-colors"
          aria-label="Atualizar status"
        >
          <RefreshCw size={10} />
          Atualizar
        </button>
      </div>

      {/* Status Cards */}
      {status && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderStatusCard('Carteira Mãe', 'mae', status.mae)}
          {renderStatusCard('Carteira Gema', 'gemas', status.gemas)}
        </div>
      )}

      {/* Log / History Section */}
      <div className="bg-[#0b0b0f] border border-white/5 rounded-2xl p-6">
        <h3 className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-4">
          Histórico de Alertas Enviados
        </h3>

        {logs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
              Nenhum alerta registrado
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-[9px] text-gray-500 uppercase font-bold tracking-widest pb-3 pr-4">Data</th>
                    <th className="text-[9px] text-gray-500 uppercase font-bold tracking-widest pb-3 pr-4">Carteira</th>
                    <th className="text-[9px] text-gray-500 uppercase font-bold tracking-widest pb-3 pr-4">Direção</th>
                    <th className="text-[9px] text-gray-500 uppercase font-bold tracking-widest pb-3 pr-4">Passo</th>
                    <th className="text-[9px] text-gray-500 uppercase font-bold tracking-widest pb-3 pr-4">Percentual</th>
                    <th className="text-[9px] text-gray-500 uppercase font-bold tracking-widest pb-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-white/5 last:border-b-0">
                      <td className="text-xs text-white font-mono py-3 pr-4">
                        {formatDatetime(log.criado_em)}
                      </td>
                      <td className="text-xs text-white py-3 pr-4">
                        {log.tipo_carteira === 'mae' ? 'Mãe' : 'Gema'}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-bold ${log.direcao === 'valorizacao' ? 'text-genesis-positive' : 'text-red-400'}`}>
                          {log.direcao === 'valorizacao' ? '↑ Val.' : '↓ Desval.'}
                        </span>
                      </td>
                      <td className="text-xs text-white font-mono py-3 pr-4">
                        {log.passo}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs font-mono font-bold ${log.direcao === 'valorizacao' ? 'text-genesis-positive' : 'text-red-400'}`}>
                          {log.percentual.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3">
                        {log.enviado_com_sucesso ? (
                          <span className="flex items-center gap-1 text-genesis-positive">
                            <CheckCircle size={12} />
                            <span className="text-[9px] uppercase font-bold tracking-widest">Enviado</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400">
                            <XCircle size={12} />
                            <span className="text-[9px] uppercase font-bold tracking-widest">Falha</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {logMeta.last_page > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => handlePageChange('prev')}
                  disabled={logMeta.current_page <= 1}
                  className="text-[9px] text-gray-400 uppercase font-bold tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest font-mono">
                  {logMeta.current_page} / {logMeta.last_page}
                </span>
                <button
                  type="button"
                  onClick={() => handlePageChange('next')}
                  disabled={logMeta.current_page >= logMeta.last_page}
                  className="text-[9px] text-gray-400 uppercase font-bold tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Próxima →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MonitorStatusWidget;
