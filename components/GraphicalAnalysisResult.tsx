import React from 'react';
import { Activity, BarChart3, RefreshCcw, ShieldCheck } from 'lucide-react';
import type { GraphicalAnalysisResult as Result } from '../types/graphicalAnalysis';

interface Props {
  data: Result;
  onReset: () => void;
}

const strengthLabel: Record<string, string> = {
  WEAKENS: 'Enfraquece', NEUTRAL: 'Neutro', STRENGTHENS: 'Fortalece', UNAVAILABLE: 'Indisponível',
};

const squeezeLabel: Record<string, string> = {
  NONE: 'Sem risco dominante', LONG_SQUEEZE: 'Risco de long squeeze',
  SHORT_SQUEEZE: 'Risco de short squeeze', BOTH: 'Risco bilateral', UNAVAILABLE: 'Indisponível',
};

const humanize = (value: string) => value
  .toLowerCase()
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const GraphicalAnalysisResult: React.FC<Props> = ({ data, onReset }) => {
  const isLong = data.direction === 'LONG';
  const patterns = data.visual_observations?.patterns ?? [];
  const objects = data.visual_observations?.objects ?? [];
  const fibonacci = data.visual_observations?.fibonacci ?? [];
  const longShortRows = Array.isArray(data.display_only?.long_short_ratio)
    ? data.display_only.long_short_ratio
    : [];
  const latestLongShort = longShortRows.length > 0
    ? longShortRows[longShortRows.length - 1] as Record<string, unknown>
    : null;
  const longShortRatio = latestLongShort && typeof latestLongShort.longShortRatio === 'string'
    ? latestLongShort.longShortRatio
    : null;
  return (
    <article className="relative z-10 flex h-full flex-col gap-5 text-white">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-genesis-text-secondary">
            {data.pair} · {data.timeframe} · Binance Futures
          </p>
          <div className="mt-2 flex items-end gap-3">
            <h2 className={`text-4xl font-semibold tracking-tight ${isLong ? 'text-genesis-positive' : 'text-red-400'}`}>
              {data.direction}
            </h2>
            <span className="mb-1 text-xs text-genesis-text-secondary">direção interpretada</span>
          </div>
        </div>
        <div className="rounded-xl border border-genesis-accent/30 bg-genesis-accent/10 px-5 py-3 text-right">
          <p className="text-[9px] uppercase tracking-[0.2em] text-genesis-text-secondary">Score contextual</p>
          <p className="font-mono text-3xl font-bold text-genesis-accent">{data.score}<span className="text-sm">/90</span></p>
        </div>
      </header>
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center gap-2 text-genesis-accent">
          <ShieldCheck size={16} />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em]">Força do score</h3>
        </div>
        <p className="text-sm leading-6 text-gray-200">{data.score_description}</p>
      </section>
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="mb-3 flex items-center gap-2 text-genesis-positive">
          <BarChart3 size={16} />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em]">Análise técnica</h3>
        </div>
        <p className="text-sm leading-6 text-gray-200">{data.technical_analysis}</p>
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-2 flex items-center gap-2 text-purple-300">
            <Activity size={15} />
            <h3 className="text-[10px] font-bold uppercase tracking-[0.16em]">Derivativos</h3>
          </div>
          <p className="text-xs text-gray-200">{data.derivatives_context?.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            <span className="rounded bg-purple-500/10 px-2 py-1 text-purple-200">
              {strengthLabel[data.derivatives_context?.strength] ?? 'Indisponível'}
            </span>
            <span className="rounded bg-white/5 px-2 py-1 text-gray-300">
              {squeezeLabel[data.derivatives_context?.squeeze_risk] ?? 'Indisponível'}
            </span>
          </div>
          <p className="mt-3 text-[10px] text-genesis-text-secondary">
            Long/Short Ratio (informativo, fora da decisão): {longShortRatio ?? 'indisponível'}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-genesis-positive">Leitura visual</h3>
          {patterns.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {patterns.map((pattern) => (
                <span key={`${pattern.id}-${pattern.state}`} className="rounded bg-green-500/10 px-2 py-1 text-[10px] text-green-200">
                  {humanize(pattern.id)} · {humanize(pattern.state)}
                </span>
              ))}
            </div>
          ):(
            <p className="text-xs text-genesis-text-secondary">Nenhuma figura clara foi identificada.</p>
          )}
          {objects.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {objects.map((object, index) => (
                <span key={`${object.type}-${index}`} className="rounded bg-purple-500/10 px-2 py-1 text-[10px] text-purple-200">
                  {humanize(object.type)}
                </span>
              ))}
            </div>
          )}
          {fibonacci.length > 0 && (
            <p className="mt-3 text-[10px] text-genesis-text-secondary">
              Fibo desenhado: {fibonacci.map((item) => item.label).join(', ')}
            </p>
          )}
        </div>
      </section>
      <footer className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
        <p className="text-[9px] uppercase tracking-[0.14em] text-genesis-text-muted">
          Score contextual; não representa probabilidade de acerto. Dados: {data.snapshot_observed_at ?? 'horário indisponível'}.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-300 hover:border-genesis-accent/50 hover:text-white"
        >
          <RefreshCcw size={13} /> Nova análise
        </button>
      </footer>
    </article>
  );
};

export default GraphicalAnalysisResult;
