import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Activity, BarChart2, Download, RefreshCcw, Share2, ShieldCheck, Target,
} from 'lucide-react';
import type { GraphicalAnalysisResult as Result } from '../types/graphicalAnalysis';

interface Props {
  data: Result;
  onReset: () => void;
}

// Spec genesis-v6-4-contexto-informativo, Tarefa 3.1: reusa literalmente os rótulos/mapas do
// components/AnalysisResult.tsx original (V4.3-R3.2) para a coluna de indicadores.
const WYCKOFF_LABEL: Record<string, string> = {
  DISTRIBUICAO_RANGE: 'Distribuição em range',
  DISTRIBUICAO_UAT: 'Distribuição (UAT)',
  DISTRIBUICAO_SPRING: 'Distribuição com spring',
  ACUMULACAO_RANGE: 'Acumulação em range',
  ACUMULACAO_SPRING: 'Acumulação com spring',
  MARKUP: 'Markup',
  MARKDOWN: 'Markdown',
  INDETERMINADO: 'Indeterminado',
};

const strengthLabel: Record<string, string> = {
  WEAKENS: 'Enfraquece', NEUTRAL: 'Neutro', STRENGTHENS: 'Fortalece', UNAVAILABLE: 'Indisponível',
};

const squeezeLabel: Record<string, string> = {
  NONE: 'Sem risco dominante', LONG_SQUEEZE: 'Risco de long squeeze',
  SHORT_SQUEEZE: 'Risco de short squeeze', BOTH: 'Risco bilateral', UNAVAILABLE: 'Indisponível',
};

const biasColor: Record<string, string> = {
  BULLISH: 'text-genesis-positive bg-genesis-positive/10 border-genesis-positive/20',
  BEARISH: 'text-genesis-negative bg-genesis-negative/10 border-genesis-negative/20',
  MIXED: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
};

const humanize = (value: string) => value
  .toLowerCase()
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

// Formata um EvidenceValue como o componente antigo fazia: "N/D" quando indisponível, nunca "0" nem inventado.
const fmt = (entry: { value: unknown; status: string } | undefined, suffix = '', digits = 2): string => {
  if (!entry || entry.status !== 'AVAILABLE' || entry.value == null || typeof entry.value !== 'number') {
    return 'N/D';
  }
  return `${entry.value.toFixed(digits)}${suffix}`;
};

const GraphicalAnalysisResult: React.FC<Props> = ({ data, onReset }) => {
  const [showIndicators, setShowIndicators] = useState(false);
  const isLong = data.direction === 'LONG';
  const badgeColor = isLong ? 'text-genesis-positive' : 'text-genesis-negative';
  const progressColor = isLong ? 'bg-genesis-positive' : 'bg-genesis-negative';

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

  const ctx = data.informative_context;
  const wyckoffFase = ctx?.indicators.wyckoff.status === 'AVAILABLE'
    ? String((ctx.indicators.wyckoff.value as Record<string, unknown> | null)?.fase ?? (ctx.indicators.wyckoff.value as Record<string, unknown> | null)?.type ?? '')
    : '';
  const sessionName = ctx?.indicators.session.status === 'AVAILABLE'
    ? (ctx.indicators.session.value as { name?: string } | null)?.name ?? null
    : null;
  const multiTimeframe = ctx?.indicators.multi_timeframe.status === 'AVAILABLE'
    ? (ctx.indicators.multi_timeframe.value as Array<{ timeframe: string; bias: string | null }> | null) ?? []
    : [];

  const handleShare = async () => {
    const element = document.getElementById('analysis-capture');
    if (!element) return;
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#000000', scale: 2, logging: false, useCORS: true,
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.download = `genesis-setup-${data.pair}.jpg`;
      link.click();
    } catch (error) {
      console.error('Erro ao gerar imagem:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Bar — mesmo padrão do AnalysisResult.tsx original */}
      <div className="flex items-center justify-between border-b border-white/[0.02] bg-transparent pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">{data.pair}</h2>
          <span className="text-[10px] uppercase tracking-widest text-genesis-accent font-mono">
            {data.timeframe} · Binance Futures
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="hidden items-center gap-2 rounded-lg bg-transparent px-3 py-2 font-mono text-xs uppercase tracking-wider text-gray-400 transition-colors hover:bg-white/5 hover:text-white sm:flex"
          >
            <RefreshCcw size={14} /> Nova análise
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2 font-mono text-xs uppercase tracking-wider text-white transition-colors hover:bg-white/10"
          >
            <Download size={16} /> Salvar Análise
          </button>
        </div>
      </div>

      <div id="analysis-capture" className="relative rounded-xl bg-black p-[16px]">
        <div className="pointer-events-none absolute right-4 top-[16px] z-10 flex items-center gap-2 opacity-30">
          <Share2 size={12} className="text-white" />
          <span className="font-mono text-[8px] uppercase tracking-widest text-white">Gênesis V6.4</span>
        </div>

        {/* CAMADA 1: DECISÃO RÁPIDA — mesma estrutura visual do componente original */}
        <div className="relative mt-8 mb-6 overflow-hidden rounded-3xl border border-white/[0.03] bg-[#0a0a0f] p-[16px] shadow-2xl">
          <div className={`pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full ${isLong ? 'bg-genesis-positive/5' : 'bg-genesis-negative/5'} blur-[100px]`} />

          <div className="relative z-10 mb-6 flex flex-col items-start justify-between md:flex-row md:items-center">
            <div className="mb-4 flex items-center gap-[16px] md:mb-0">
              <div className="flex flex-col">
                <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Direção Interpretada</span>
                <span className={`text-6xl font-bold uppercase tracking-tighter ${badgeColor}`}>{data.direction}</span>
              </div>
            </div>
            <div className="flex w-full flex-col items-start md:w-auto md:items-end">
              <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Score Contextual</span>
              <span className={`font-mono text-4xl font-bold ${badgeColor}`}>
                {data.score}<span className="text-lg text-gray-600">/90</span>
              </span>
            </div>
          </div>

          <div className="relative z-10 mb-5 h-2 w-full overflow-hidden rounded-full bg-gray-900">
            <div className={`h-full ${progressColor} transition-all duration-1000`} style={{ width: `${Math.min((data.score / 90) * 100, 100)}%` }} />
          </div>

          <div className="relative z-10 flex items-start gap-3 rounded-lg bg-white/5 p-[16px]">
            <Target className={`${badgeColor} mt-0.5 shrink-0`} size={16} />
            <p className="text-sm font-medium leading-relaxed text-gray-300">
              {data.score_description || 'Justificativa do score indisponível.'}
            </p>
          </div>
        </div>

        {/* Análise Técnica */}
        <div className="mb-6 rounded-[10px] bg-[#050505] p-[16px]">
          <div className="mb-4 flex items-center gap-2 text-genesis-positive">
            <BarChart2 size={14} />
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Análise Técnica</h3>
          </div>
          <p className="text-sm leading-relaxed text-gray-300">{data.technical_analysis}</p>
        </div>

        {/* Derivativos e Leitura Visual — específicos do V6.4, mesma paleta escura */}
        <div className="mb-6 grid gap-[16px] md:grid-cols-2">
          <div className="rounded-[10px] bg-[#050505] p-[16px]">
            <div className="mb-2 flex items-center gap-2 text-purple-300">
              <Activity size={15} />
              <h3 className="text-[10px] font-bold uppercase tracking-[0.16em]">Derivativos</h3>
            </div>
            <p className="text-xs text-gray-300">{data.derivatives_context?.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
              <span className="rounded bg-purple-500/10 px-2 py-1 text-purple-200">
                {strengthLabel[data.derivatives_context?.strength] ?? 'Indisponível'}
              </span>
              <span className="rounded bg-white/5 px-2 py-1 text-gray-300">
                {squeezeLabel[data.derivatives_context?.squeeze_risk] ?? 'Indisponível'}
              </span>
            </div>
            <p className="mt-3 text-[10px] text-gray-500">
              Long/Short Ratio (informativo, fora da decisão): {longShortRatio ?? 'indisponível'}
            </p>
          </div>
          <div className="rounded-[10px] bg-[#050505] p-[16px]">
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-genesis-positive">Leitura visual</h3>
            {patterns.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {patterns.map((pattern) => (
                  <span key={`${pattern.id}-${pattern.state}`} className="rounded bg-green-500/10 px-2 py-1 text-[10px] text-green-200">
                    {humanize(pattern.id)} · {humanize(pattern.state)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Nenhuma figura clara foi identificada.</p>
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
              <p className="mt-3 text-[10px] text-gray-500">
                Fibo desenhado: {fibonacci.map((item) => item.label).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* CAMADA 4: FUNDAMENTAÇÃO (Avançada) — indicadores/macro/sentimento, restaurado nesta correção
            (spec genesis-v6-4-contexto-informativo). Valores brutos, sem narrativa — ver requirements.md,
            "Decisão de escopo necessária": não existe mais chamada de IA dedicada a gerar essa narrativa
            no V6.4 (decisor único, Seção 4 do Oficial Mestre.pdf). */}
        <div className="relative rounded-[10px] bg-black/40 p-[16px]">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
              <BarChart2 size={12} /> Visão Quantitativa e Macro
            </h3>
            <button
              onClick={() => setShowIndicators(!showIndicators)}
              className="rounded-full bg-white/5 px-3 py-1.5 text-[9px] uppercase tracking-widest text-genesis-accent transition-colors hover:text-white"
            >
              {showIndicators ? 'Ocultar Detalhes' : 'Revelar Matriz Completa'}
            </button>
          </div>

          {showIndicators && ctx && (
            <div className="grid animate-in fade-in slide-in-from-top-2 grid-cols-1 gap-[16px] pt-6 duration-300 md:grid-cols-3">
              {/* Coluna 1: Métricas Técnicas */}
              <div className="rounded-lg bg-[#050505] p-[16px]">
                <span className="mb-3 block border-b border-white/5 pb-2 text-[10px] font-bold uppercase tracking-widest text-genesis-accent">
                  Métricas Técnicas
                </span>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">RSI (14)</span>
                    <span className="font-mono text-[10px] text-white">{fmt(ctx.indicators.rsi14, '', 1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">ADX</span>
                    <span className="font-mono text-[10px] text-white">{fmt(ctx.indicators.adx14, '', 1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">ATR</span>
                    <span className="font-mono text-[10px] text-white">
                      {ctx.indicators.atr14.status === 'AVAILABLE' && typeof ctx.indicators.atr14.value === 'number' ? `$${ctx.indicators.atr14.value.toFixed(4)}` : 'N/D'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">EMAs (21/50/200)</span>
                    <span className="font-mono text-[9px] text-white">
                      {fmt(ctx.indicators.ema21)} | {fmt(ctx.indicators.ema50)} | {fmt(ctx.indicators.ema200)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Wyckoff</span>
                    <span className="font-mono text-[10px] text-white">
                      {WYCKOFF_LABEL[wyckoffFase] ?? (wyckoffFase ? humanize(wyckoffFase) : 'N/D')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Sessão</span>
                    <span className="font-mono text-[10px] text-white">{sessionName ?? 'N/D'}</span>
                  </div>
                  {multiTimeframe.length > 0 && (
                    <div className="col-span-full mt-4 border-t border-white/5 pt-4">
                      <span className="mb-3 block text-[10px] font-bold uppercase tracking-widest text-genesis-accent">
                        Confluência Temporal
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {multiTimeframe.map((tf, idx) => (
                          <div key={idx} className={`flex items-center gap-2 rounded border px-3 py-1.5 ${biasColor[tf.bias ?? ''] ?? biasColor.MIXED}`}>
                            <span className="text-[9px] font-bold uppercase">{tf.timeframe}</span>
                            <span className="font-mono text-[9px] font-bold">{tf.bias ?? 'N/D'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna 2: Macro e Geopolítico */}
              <div className="rounded-lg bg-[#050505] p-[16px]">
                <span className="mb-3 block border-b border-white/5 pb-2 text-[10px] font-bold uppercase tracking-widest text-genesis-positive">
                  Macro e Geopolítico
                </span>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">VIX</span>
                    <span className="font-mono text-[10px] text-white">{fmt(ctx.macro.vix, '', 2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Variação DXY</span>
                    <span className="font-mono text-[10px] text-white">{fmt(ctx.macro.dxy_change_pct, '%', 4)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Variação S&amp;P 500</span>
                    <span className="font-mono text-[10px] text-white">{fmt(ctx.macro.sp500_change_pct, '%', 4)}</span>
                  </div>
                </div>
                {/* Correção pós-entrega (2026-07-26): narrativa restaurada, mesmo padrão do AnalysisResult.tsx original */}
                <p className={`mb-4 mt-4 pt-3 border-t border-white/5 text-[10px] leading-relaxed text-gray-400 ${ctx.macro.narrative.status !== 'AVAILABLE' ? 'italic' : ''}`}>
                  {ctx.macro.narrative.status === 'AVAILABLE' && ctx.macro.narrative.value?.resumo
                    ? ctx.macro.narrative.value.resumo
                    : 'Contexto informativo indisponível para esta análise (orçamento de IA esgotado ou serviço fora do ar).'}
                </p>
                {ctx.macro.narrative.status === 'AVAILABLE' && (ctx.macro.narrative.value?.eventos?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    {ctx.macro.narrative.value!.eventos.map((evt, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="mt-0.5 text-genesis-accent">•</span>
                        <p className="font-mono text-[9.5px] leading-relaxed text-gray-400">{evt}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Coluna 3: Sentimento */}
              <div className="rounded-lg bg-[#050505] p-[16px]">
                <span className="mb-3 block border-b border-white/5 pb-2 text-[10px] font-bold uppercase tracking-widest text-purple-400">
                  Sentimento
                </span>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Fear &amp; Greed</span>
                    <span className="font-mono text-[10px] text-white">{fmt(ctx.sentiment.fear_greed, '/100', 0)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Dominância BTC</span>
                    <span className="font-mono text-[10px] text-white">{fmt(ctx.sentiment.btc_dominance, '%', 2)}</span>
                  </div>
                </div>
                {/* Correção pós-entrega (2026-07-26): narrativa restaurada, mesmo padrão do AnalysisResult.tsx original */}
                {ctx.sentiment.narrative.status === 'AVAILABLE' && ctx.sentiment.narrative.value ? (
                  <>
                    <div className="mb-3 mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Score da narrativa</span>
                      <span className={`rounded bg-white/5 px-2 font-mono text-[10px] font-bold ${
                        ctx.sentiment.narrative.value.score == null ? 'text-gray-500'
                          : ctx.sentiment.narrative.value.score > 60 ? 'text-genesis-positive' : 'text-genesis-negative'
                      }`}>
                        {ctx.sentiment.narrative.value.score == null ? 'Sem dado' : `${ctx.sentiment.narrative.value.score}/100`}
                      </span>
                    </div>
                    <p className="mb-4 text-[10px] leading-relaxed text-gray-400">
                      {ctx.sentiment.narrative.value.narrativa || 'Contexto informativo indisponível para esta análise.'}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="mb-2 block text-[8px] font-bold uppercase tracking-widest text-gray-600">Gatilhos (+)</span>
                        <ul className="space-y-2 text-[9.5px] text-genesis-positive/80">
                          {ctx.sentiment.narrative.value.gatilhos_positivos.slice(0, 2).map((p, i) => (
                            <li key={i} className="line-clamp-2 leading-tight">- {p}</li>
                          ))}
                          {ctx.sentiment.narrative.value.gatilhos_positivos.length === 0 && (
                            <li className="italic text-gray-600">Nenhum</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <span className="mb-2 block text-[8px] font-bold uppercase tracking-widest text-gray-600">Gatilhos (-)</span>
                        <ul className="space-y-2 text-[9.5px] text-genesis-negative/80">
                          {ctx.sentiment.narrative.value.gatilhos_negativos.slice(0, 2).map((n, i) => (
                            <li key={i} className="line-clamp-2 leading-tight">- {n}</li>
                          ))}
                          {ctx.sentiment.narrative.value.gatilhos_negativos.length === 0 && (
                            <li className="italic text-gray-600">Nenhum</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="mb-4 mt-4 border-t border-white/5 pt-3 text-[10px] italic leading-relaxed text-gray-400">
                    Contexto informativo indisponível para esta análise (orçamento de IA esgotado ou serviço fora do ar).
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <p className="text-[9px] uppercase tracking-[0.14em] text-genesis-text-muted">
          Score contextual; não representa probabilidade de acerto. Dados: {data.snapshot_observed_at ?? 'horário indisponível'}.
        </p>
        <div className="flex items-center gap-2 text-genesis-accent">
          <ShieldCheck size={12} />
        </div>
      </div>
    </div>
  );
};

export default GraphicalAnalysisResult;
