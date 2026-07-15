import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Share2, Activity, Download, ArrowRight, ArrowUp, ArrowDown, Target, BarChart2, Shield, RefreshCw, ShieldAlert,
  CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { GenesisAnalysisResult, AnalysisDirection, ExecutionStatus } from '../types';
import { selecionarZona, getMe } from '../services/api';
import { formatPrice } from '../services/cryptoApi';
import FamiliasTrader from './FamiliasTrader';

interface AnalysisResultProps {
  data: GenesisAnalysisResult;
  currentPrice?: string;
  change24h?: string;
  isPositiveChange?: boolean;
  onSaveTrade?: () => void;
  onReset?: () => void;
  analiseId?: string | null;
}

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

// R3.2 — Documento Mestre Seção 15.5: rótulo de cada estado de execução,
// exibido sempre, independentemente de a análise ser operável.
const executionLabel: Record<ExecutionStatus, string> = {
  EXECUTAVEL: 'Condições matemáticas atendidas',
  SHADOW_MODE: 'Homologação: análise registrada sem publicação operacional',
  NAO_RECOMENDADA_RR: 'Execução não recomendada: RR líquido abaixo do mínimo',
  NAO_RECOMENDADA_ALVO: 'Execução não recomendada: alvo sem barreira real',
  NAO_RECOMENDADA_CONVICCAO: 'Execução não recomendada: convicção limitada',
  NAO_RECOMENDADA_CONFIGURACAO: 'Execução não recomendada: configuração de risco ausente',
  BLOQUEADA_ANALISE_INCONSISTENTE: 'Análise em quarentena: resposta inconsistente',
  INDISPONIVEL: 'Motor indisponível',
};

const directionLabel: Record<AnalysisDirection, string> = {
  LONG: 'LONG',
  SHORT: 'SHORT',
  INDISPONIVEL: 'INDISPONÍVEL',
};

const limparTexto = (t: string) =>
  t.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim();

const getLogoUrl = (pair: string) => {
  const symbol = (pair || '').split('USDT')[0].toLowerCase();
  return `https://cryptologos.cc/logos/${symbol}-${symbol}-logo.png`;
};

const AnalysisResult: React.FC<AnalysisResultProps> = ({ data, currentPrice, change24h, isPositiveChange, onSaveTrade, onReset, analiseId }) => {
  const [showIndicators, setShowIndicators] = useState(false);
  const [selectedZone, setSelectedZone] = useState<'A' | 'B' | null>(null);
  const [zoneSaveStatus, setZoneSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [zoneSaveError, setZoneSaveError] = useState<string | null>(null);

  // Campos informativos que o PHP continua calculando de forma determinística
  // (wyckoff, sessão, multiTimeframe) — não fazem parte do contrato formal
  // analysis/execution, lidos de forma defensiva (any).
  const anyData = data as any;

  // R3.2 — Documento Mestre Seção 10.4: macro e sentimento vêm exclusivamente
  // de contexto_informativo (chamada Gemini única e consolidada). O antigo
  // `sentimentoAtivo` nunca foi migrado para o contrato novo (função morta no
  // backend) e `macroGeopolitica` era um resquício do cérebro duplicado — os
  // dois foram substituídos por este campo. contexto_informativo pode ser
  // `null` (sem orçamento de IA restante, ou GEMINI_API_KEY ausente).
  const contextoInfo = anyData.contexto_informativo as { macro?: any; sentimento?: any } | null;
  const macroInfo = contextoInfo?.macro ?? null;
  const sentimento = contextoInfo?.sentimento ?? {};

  const handleZoneSelect = async (zone: 'A' | 'B') => {
    setSelectedZone(zone);
    setZoneSaveStatus('idle');
    setZoneSaveError(null);

    let idToUse = analiseId;

    // Se não tem analiseId, buscar a última análise do usuário como fallback
    if (!idToUse) {
      try {
        const { fetchHistoricoAnalises } = await import('../services/api');
        const resp = await fetchHistoricoAnalises();
        const lista = resp?.data || resp || [];
        if (Array.isArray(lista) && lista.length > 0) {
          idToUse = String(lista[0].id);
        }
      } catch (_) {}
    }

    if (!idToUse) {
      setZoneSaveStatus('error');
      setZoneSaveError('Análise não encontrada no servidor. Tente analisar novamente.');
      return;
    }

    setZoneSaveStatus('saving');
    try {
      const user = await getMe();
      if (!user || !user.id) {
        setZoneSaveStatus('error');
        setZoneSaveError('Não foi possível identificar o usuário');
        return;
      }

      const result = await selecionarZona(idToUse, zone, user.id);
      if (result.success) {
        setZoneSaveStatus('success');
        // Auto-dismiss success after 3 seconds
        setTimeout(() => setZoneSaveStatus('idle'), 3000);
      } else {
        setZoneSaveStatus('error');
        setZoneSaveError(result.error || 'Erro ao salvar zona');
      }
    } catch (err: any) {
      setZoneSaveStatus('error');
      setZoneSaveError(err.message || 'Erro ao salvar zona');
    }
  };

  const handleShare = async () => {
    const element = document.getElementById('analysis-capture');
    if (element) {
      try {
        const canvas = await html2canvas(element, {
          backgroundColor: '#000000',
          scale: 2,
          logging: false,
          useCORS: true
        });

        const image = canvas.toDataURL('image/jpeg', 0.9);
        const link = document.createElement('a');
        link.href = image;
        link.download = `genesis-setup-${data.pair}.jpg`;
        link.click();
      } catch (error) {
        console.error('Erro ao gerar imagem:', error);
      }
    }
  };

  if (!data || !data.analysis || !data.execution) {
    return (
      <div className="p-8 text-center bg-black rounded-xl ">
         <p className="text-gray-400 font-mono">Processando leitura... Aguarde a confirmação de liquidez.</p>
      </div>
    );
  }

  const { analysis, execution } = data;
  const setup = execution.candidate_setup;
  const score = analysis.conviccao_modelo;
  const isCautela = analysis.leitura_fraca;

  // R3.2 — Seção 15.5: operável é definido exclusivamente por execution.executable
  // e execution.action, nunca pela string de direção.
  const isOperavel = execution.executable && execution.action !== null;

  const direction = analysis.direction;
  const isLong = direction === 'LONG';
  const isShort = direction === 'SHORT';

  const planoB = execution.planoB as { entrada?: number; descricao?: string; zona?: string } | null;

  const activeEntrada = selectedZone === 'B' && planoB?.entrada ? planoB.entrada : setup?.entrada;

  const badgeColor = isLong ? 'text-genesis-positive' : isShort ? 'text-genesis-negative' : 'text-yellow-500';
  const progressColor = isLong ? 'bg-genesis-positive' : isShort ? 'bg-genesis-negative' : 'bg-yellow-500/60';

  const invalidacaoAtiva = execution.zonaInteresse?.invalidacao || analysis.invalidacao_tese || null;

  // R3.2 — Adendo Seção 32: contrato canônico em inglês primeiro, com
  // fallback ao português legado. `execution.motivo` nunca alimenta a
  // justificativa do score — é um campo de execução, não de leitura.
  const scoreJustification = analysis.score_justification ?? analysis.justificativa_score ?? null;
  const technicalAnalysis = analysis.technical_analysis ?? analysis.narrativa_tecnica ?? null;
  const scoreContext = analysis.score_context ?? null;

  const naoOperavel = execution.status !== 'EXECUTAVEL';

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-transparent pb-4 border-b border-white/[0.02] ">
        <div className="flex items-center gap-3">
          <img
            src={getLogoUrl(data.pair)}
            alt={data.pair}
            className="w-8 h-8 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://cryptologos.cc/logos/tether-usdt-logo.png';
            }}
          />
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{data.pair}</h2>
            <span className="text-[10px] text-genesis-accent font-mono uppercase tracking-widest">{executionLabel[execution.status]}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onReset && (
            <button
              onClick={onReset}
              className="hidden sm:flex items-center gap-2 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white px-3 py-2 rounded-lg transition-colors  font-mono text-xs uppercase tracking-wider"
            >
              <RefreshCw size={14} />
              Reset
            </button>
          )}
          <button
            onClick={handleShare}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg transition-colors  font-mono text-xs uppercase tracking-wider"
          >
            <Download size={16} />
            Salvar Análise
          </button>
        </div>
      </div>

      <div id="analysis-capture" className="p-[16px] bg-black rounded-xl  relative">
        <div className="absolute top-[16px] right-4 flex items-center gap-2 opacity-30 -none z-10">
          <Share2 size={12} className="text-white" />
          <span className="text-[8px] tracking-widest font-mono text-white uppercase">Genesis v3.0</span>
        </div>

        {/* CAMADA 1: DECISÃO RÁPIDA */}
        <div className={`bg-[#0a0a0f] rounded-3xl shadow-2xl border border-white/[0.03] p-[16px] mb-6 shadow-2xl relative overflow-hidden mt-8`}>
          <div className={`absolute top-0 right-0 w-64 h-64 ${isLong ? 'bg-genesis-positive/5' : 'bg-genesis-negative/5'} blur-[100px] pointer-events-none rounded-full`} />

          {/* Header de Preço Dinâmico */}
          {currentPrice && (
            <div className="flex items-center gap-2 mb-4">
                <span className="text-[12px] font-bold text-genesis-text-secondary uppercase tracking-wider">
                  {data.pair?.replace('USDT', '').replace('/', '') || ''}
                </span>
                <span className="text-sm font-mono text-white tracking-wider">
                  {currentPrice}
                </span>
                {change24h && (
                    <div className={`flex items-center gap-1 text-[11px] font-bold ${isPositiveChange ? 'text-genesis-positive' : 'text-genesis-negative'}`}>
                        {isPositiveChange ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                        {change24h}%
                    </div>
                )}
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 relative z-10">
            <div className="flex items-center gap-[16px] mb-4 md:mb-0">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-1">Direção Provável</span>
                <div className="flex items-baseline gap-3">
                  <span className={`text-6xl font-bold ${badgeColor} tracking-tighter uppercase drop--[0_0_15px_rgba(0,0,0,0.5)]`}>
                    {directionLabel[direction] ?? direction}
                  </span>
                  {isOperavel && setup?.alavancagem != null && (
                    <span className={`px-3 py-1 rounded bg-white/5 text-xl font-bold font-mono ${badgeColor}`}>
                      {setup.alavancagem}x
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end w-full md:w-auto">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-1">Convicção do Modelo</span>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className={`text-4xl font-bold font-mono ${isCautela ? 'text-yellow-500' : badgeColor}`}>
                    {score ?? '—'}
                    {score != null && <span className="text-lg text-gray-600">/100</span>}
                  </span>
                </div>
              </div>
              <span className={`text-xs font-bold uppercase tracking-widest mt-1 px-2 py-0.5 rounded ${isCautela ? 'bg-yellow-900/20 text-yellow-500 border-yellow-500/30' : 'bg-green-900/20 text-genesis-positive border-genesis-positive/30'}`}>
                {isCautela ? 'Leitura com Cautela' : 'Leitura Confirmada'}
              </span>
            </div>
          </div>

          {score != null && (
            <div className="mb-5 relative z-10 w-full bg-gray-900 rounded-full h-2 overflow-hidden ">
              <div className={`h-full ${progressColor} transition-all duration-1000`} style={{width: `${score}%`}} />
            </div>
          )}

          <FamiliasTrader familias={analysis.score_familias ?? null} />

          {score != null && isCautela && scoreContext && (
            <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 relative z-10">
              <p className="text-xs font-semibold text-yellow-400">Leitura de baixa convicção</p>
              {scoreContext.limitations?.map((item) => (
                <p key={item} className="mt-1 text-xs text-gray-300 leading-relaxed">{item}</p>
              ))}
              {scoreContext.required_confirmation?.map((item) => (
                <p key={item} className="mt-1 text-xs text-gray-400 leading-relaxed">Confirmação: {item}</p>
              ))}
            </div>
          )}

          <div className="bg-white/5  rounded-lg p-[16px] relative z-10 flex items-start gap-3">
            <Target className={`${badgeColor} shrink-0 mt-0.5`} size={16} />
            <p className="text-sm text-gray-300 font-medium leading-relaxed">
              {scoreJustification || 'Justificativa do score indisponível.'}
            </p>
          </div>
        </div>

        {/* F1: Avisos do reconciliador */}
        {execution.avisos.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-600/30 rounded-lg p-3 mb-6">
            {execution.avisos.map((a: string, i: number) => (
              <p key={i} className="text-[11px] text-amber-300 leading-relaxed">{a}</p>
            ))}
          </div>
        )}

        {naoOperavel && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-6 mb-6">
            <div className="text-amber-400 font-bold text-lg tracking-widest">{executionLabel[execution.status]}</div>
            <p className="text-amber-200/80 text-sm mt-2">
              {execution.motivo || 'O cérebro travou a execução até o mercado oferecer uma condição válida.'}
            </p>
          </div>
        )}

        {/* R27: pipeline sempre visivel quando ha candidate_setup — TP/stop sao informativos
            mesmo quando nao executavel; o gate operacional fica no botao de confirmacao. */}
        {setup && setup.stop != null && (
        <>
        {/* CAMADA 2: RISCO-RETORNO */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] mb-6">
          <div className="bg-[#050505] rounded-[10px] p-[16px] flex flex-col justify-center items-center text-center cursor-help" title="Risco/retorno líquido estimado com base no primeiro alvo (TP1).">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">RISCO/RETORNO (TP1)</span>
            <span className="text-2xl font-mono text-white font-bold">
              {setup.rr_liquido_estimado != null ? `1:${setup.rr_liquido_estimado}` : '—'}
            </span>
          </div>

          <div className="bg-[#050505]  rounded-[10px] p-[16px] flex flex-col justify-center items-center text-center relative overflow-hidden">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Risco Máximo</span>
            <span className="text-2xl font-mono text-genesis-negative font-bold flex items-baseline gap-1">
              {setup.risco_preco_pct != null ? `${setup.risco_preco_pct}%` : '—'}
              {setup.risco_usd_estimado != null && <span className="text-[10px] text-gray-500"> (${setup.risco_usd_estimado})</span>}
            </span>
          </div>

          <div className="bg-[#050505]  rounded-[10px] p-[16px] flex flex-col justify-center items-center text-center col-span-2 md:col-span-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Liquidação (estimada)</span>
            <span className="text-xl font-mono text-orange-400 font-bold">
              {setup.liquidacao != null ? `$${formatPrice(Number(setup.liquidacao))}` : '—'}
            </span>
          </div>

          <div className="bg-[#050505]  rounded-[10px] p-[16px] flex flex-col justify-center col-span-2 md:col-span-1">
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-2 text-center md:text-left">Perfil da Operação</span>
            <div className="w-full bg-gray-900 rounded-full h-1.5 mb-2 overflow-hidden">
              <div
                className="h-full bg-orange-400 opacity-80"
                style={{ width: `${Math.min((setup.risco_margem_pct ?? 0), 100)}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-gray-400 text-center md:text-left">
              {(() => {
                const riscoMargemPct = setup.risco_margem_pct;
                if (riscoMargemPct == null) return 'Exposição não calculada';
                const label = riscoMargemPct > 50 ? 'Alta Exposição' : riscoMargemPct > 25 ? 'Exposição Moderada' : 'Baixa Exposição';
                return `${label} (${riscoMargemPct > 100 ? '>' : ''}${Math.min(riscoMargemPct, 100).toFixed(1)}% da margem)`;
              })()}
            </span>
          </div>
        </div>

        {/* Análise Técnica — narrativa do trader */}
        <div className="bg-[#050505] rounded-[10px] p-[16px] mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Análise Técnica</h3>
          <p className="text-sm text-gray-300 leading-relaxed text-left whitespace-normal break-normal" style={{ wordSpacing: 'normal', letterSpacing: 'normal', hyphens: 'none', lineHeight: 1.6 }}>
            {limparTexto(technicalAnalysis || "Análise técnica indisponível.")}
          </p>
        </div>

        {/* CAMADA 3: O PLANO DE AÇÃO */}
        <div className="bg-[#050505]  rounded-[10px] p-[16px] mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <Activity size={14} /> Pipeline de Execução
          </h3>

          <div className="flex flex-col lg:flex-row items-center gap-[16px] lg:gap-2">
            {/* Bloco 1: ENTRADA */}
            <div className="w-full lg:w-1/3 bg-white/[0.02] rounded-lg p-5 border-l-genesis-accent relative h-full min-h-[140px] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-genesis-accent uppercase tracking-widest block mb-3">Zona de Entrada</span>
                {/* Zone save feedback */}
                {zoneSaveStatus === 'saving' && (
                  <div className="flex items-center gap-1 mb-2 text-[9px] text-genesis-accent font-mono">
                    <div className="w-2 h-2 border border-genesis-accent border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </div>
                )}
                {zoneSaveStatus === 'success' && (
                  <div className="flex items-center gap-1 mb-2 text-[9px] text-genesis-positive font-mono">
                    <CheckCircle2 size={10} />
                    Zona salva com sucesso
                  </div>
                )}
                {zoneSaveStatus === 'error' && (
                  <div className="flex items-center gap-1 mb-2 text-[9px] text-genesis-negative font-mono">
                    <XCircle size={10} />
                    {zoneSaveError || 'Erro ao salvar zona'}
                  </div>
                )}
                <div className="space-y-3">
                  {/* Plano A */}
                  <button
                    disabled={naoOperavel}
                    onClick={() => handleZoneSelect('A')}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all duration-200 ${naoOperavel ? 'opacity-40 cursor-not-allowed' : ''} ${
                      selectedZone === 'A'
                        ? 'bg-genesis-accent/10 border-genesis-accent ring-1 ring-genesis-accent'
                        : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30'
                    }`}
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <span className={`text-[10px] font-bold ${selectedZone === 'A' ? 'text-genesis-accent' : 'text-gray-400'}`}>Plano A (Primário)</span>
                      <span className="font-mono font-bold text-sm text-white">{setup.entrada != null ? formatPrice(Number(setup.entrada)) : '—'}</span>
                    </div>
                    <p className="text-[9px] text-gray-400 font-mono tracking-wide leading-tight mt-1">
                      Entrada a mercado no preço analisado.
                    </p>
                  </button>

                  {/* Plano B */}
                  {planoB?.entrada != null && (
                    <button
                      disabled={naoOperavel}
                      onClick={() => handleZoneSelect('B')}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all duration-200 ${naoOperavel ? 'opacity-40 cursor-not-allowed' : ''} ${
                        selectedZone === 'B'
                          ? 'bg-genesis-accent/10 border-genesis-accent ring-1 ring-genesis-accent'
                          : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30'
                      }`}
                    >
                      <div className="flex justify-between items-baseline mb-1">
                        <span className={`text-[10px] font-bold ${selectedZone === 'B' ? 'text-genesis-accent' : 'text-gray-400'}`}>Plano B (Alternativo)</span>
                        <span className="font-mono font-bold text-xs text-white">{formatPrice(Number(planoB.entrada))}</span>
                      </div>
                      <p className="text-[9px] text-gray-400 font-mono tracking-wide leading-tight mt-1">
                        {planoB.descricao || 'Entrada alternativa calculada pelo motor de execução.'}
                      </p>
                    </button>
                  )}
                </div>
              </div>

              {/* Botão de Confirmação */}
              <div className="mt-4 pt-3 border-t border-white/5 relative group">
                <button
                  disabled={!isOperavel || !selectedZone}
                  onClick={() => { if (onSaveTrade) onSaveTrade(); }}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-mono uppercase tracking-wider font-bold transition-all duration-[180ms] ${
                    !selectedZone || !isOperavel
                      ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                      : 'bg-genesis-accent text-black hover:bg-[#39ff14] hover:text-black hover:shadow-[0_4px_16px_rgba(57,255,20,0.25)] active:scale-[0.98]'
                  }`}
                >
                  <Shield size={14} />
                  {!isOperavel ? 'Execução não disponível' : selectedZone ? 'Confirmar Posição' : 'Selecione um Plano'}
                </button>
                {selectedZone && isOperavel && (
                  <div className="confirmar-alerta absolute bottom-full left-0 z-[9999] flex gap-2 items-start mb-2 max-w-[300px] p-2.5 bg-[#2a2103] border border-[#b45309] rounded-[10px] text-[#fde68a] text-[12.5px] leading-relaxed opacity-0 invisible transition-opacity duration-150 pointer-events-none group-hover:opacity-100 group-hover:visible">
                    <span className="flex-shrink-0 mt-px">⚠️</span>
                    <span>Espera um segundo. Cheque o macro, o geopolítico e o sentimento da moeda no rodapé antes de entrar. O contexto pode reforçar ou enfraquecer esse setup.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="hidden lg:flex justify-center items-center w-8 text-gray-600">
              <ArrowRight size={20} strokeWidth={1.5} />
            </div>
            <div className="lg:hidden flex justify-center items-center h-8 text-gray-600">
              <ArrowDown size={20} strokeWidth={1.5} />
            </div>

            {/* Bloco 2: ALVOS */}
            <div className="w-full lg:w-1/3 bg-white/[0.02]  rounded-lg p-5 border-l-genesis-positive hover:bg-green-950/20 transition-colors relative h-full min-h-[140px]">
              <span className="text-[10px] font-bold text-genesis-positive uppercase tracking-widest block mb-4">Metas de Lucro (TP)</span>
              <div className="space-y-3">
                <div className="flex justify-between items-center group">
                    <span className="text-gray-500 text-[10px] font-bold">TP1</span>
                    <div className="text-right">
                      <span className="text-genesis-positive font-mono font-bold text-sm bg-genesis-positive/10 px-2 py-0.5 rounded">{setup.tp1 != null ? formatPrice(Number(setup.tp1)) : '—'}</span>
                      {setup.tp1_fonte && <div className="text-[8px] text-gray-500 mt-0.5">{setup.tp1_fonte}</div>}
                    </div>
                </div>
                <div className="flex justify-between items-center group">
                    <span className="text-gray-500 text-[10px] font-bold">TP2</span>
                    <div className="text-right">
                      <span className="text-genesis-positive font-mono font-bold text-sm bg-genesis-positive/10 px-2 py-0.5 rounded">{setup.tp2 != null ? formatPrice(Number(setup.tp2)) : '—'}</span>
                      {setup.tp2_fonte && <div className="text-[8px] text-gray-500 mt-0.5">{setup.tp2_fonte}</div>}
                    </div>
                </div>
                {setup.tp3 != null && (
                <div className="flex justify-between items-center group">
                    <span className="text-gray-500 text-[10px] font-bold">TP3</span>
                    <div className="text-right">
                      <span className="text-genesis-positive font-mono font-bold text-sm bg-genesis-positive/10 px-2 py-0.5 rounded">{formatPrice(Number(setup.tp3))}</span>
                      {setup.tp3_fonte && <div className="text-[8px] text-gray-500 mt-0.5">{setup.tp3_fonte}</div>}
                    </div>
                </div>
                )}
              </div>
            </div>

            <div className="hidden lg:flex justify-center items-center w-8 text-gray-600">
              <ArrowRight size={20} strokeWidth={1.5} />
            </div>
            <div className="lg:hidden flex justify-center items-center h-8 text-gray-600">
              <ArrowDown size={20} strokeWidth={1.5} />
            </div>

            {/* Bloco 3: STOP LOSS */}
            <div className="w-full lg:w-1/3 bg-white/[0.02]  rounded-lg p-5 border-l-genesis-negative hover:bg-red-950/20 transition-colors relative h-full min-h-[140px]">
              <span className="text-[10px] font-bold text-genesis-negative uppercase tracking-widest block mb-3">Defesa (Stop Loss)</span>
              <div className="mb-4 mt-2">
                <span className="text-2xl font-mono text-genesis-negative font-bold drop--[0_0_8px_rgba(239,68,68,0.4)]">{setup.stop != null ? `$${formatPrice(Number(setup.stop))}` : '—'}</span>
              </div>

              {/* BLOCO 2 - INVALIDAÇÃO DA TESE */}
              <div className="bg-red-950/30 p-3 rounded border-red-900/50 mt-1 mb-2">
                    <span className="text-[9px] font-bold text-genesis-negative/80 block mb-1.5 uppercase tracking-wider">
                      INVALIDAÇÃO DA TESE
                    </span>
                    <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                      {invalidacaoAtiva || "Zona de invalidação não calculada."}
                    </p>
              </div>

              <div className="bg-red-950/30 p-3 rounded border-red-900/50 mt-1">
                <span className="text-[9px] font-bold text-genesis-negative/80 block mb-1.5 uppercase tracking-wider">Condição de Disparo</span>
                <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                  {executionLabel[execution.status]}
                </p>
              </div>
            </div>
          </div>

          {/* BLOCO 6 - TAMANHO DE POSICAO SUGERIDO */}
          <div className="mt-6 pt-5 border-t border-white/[0.05]">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                TAMANHO SUGERIDO
              </span>

              {setup.tamanho_sugerido_texto ? (
                <span className="text-[10px] text-white font-mono">{setup.tamanho_sugerido_texto}</span>
              ) : (
                <span className="text-[10px] text-gray-500 italic">Informe o valor de entrada no formulário para calcular o tamanho da posição</span>
              )}
            </div>
          </div>

          {/* ALERTA VISUAL DE RISCO RETORNO — vem do backend, nao e recalculado no cliente */}
          {setup.rr_aviso && (
            <div className="mt-6 border border-yellow-500/30 bg-yellow-500/10 p-4 rounded-lg flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2">
              <ShieldAlert className="text-yellow-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-yellow-500 font-bold text-sm mb-1">Risco Retorno abaixo do recomendado.</h4>
                <p className="text-yellow-500/80 text-xs">
                  {setup.rr_aviso}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* CAMADA 4: FUNDAMENTAÇÃO (Avançada) */}
        <div className="bg-black/40  rounded-[10px] p-[16px] relative">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <BarChart2 size={12} /> Visão Quantitativa e Macro
            </h3>
            <button
                onClick={() => setShowIndicators(!showIndicators)}
                className="text-[9px] uppercase tracking-widest text-genesis-accent hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-full "
            >
                {showIndicators ? 'Ocultar Detalhes' : 'Revelar Matriz Completa'}
            </button>
          </div>

          {showIndicators && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px] pt-6 mt-6  animate-in fade-in slide-in- duration-300">
            {/* Coluna 1: Técnica */}
            <div className="bg-[#050505]  p-[16px] rounded-lg relative">
              <span className="text-[10px] text-genesis-accent font-bold uppercase tracking-widest mb-3 block  pb-2">Métricas Técnicas</span>
              {anyData.indicadores?.compressaoDetectada && (
                <div className="mb-3 w-full bg-blue-500/10 border border-blue-500/30 rounded px-3 py-2 flex items-center justify-between shadow-[0_0_15px_rgba(59,130,246,0.15)] pulse-slow">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">
                      COMPRESSÃO DETECTADA. ROMPIMENTO IMINENTE
                    </span>
                    <span className="text-[8px] text-blue-400/80 uppercase">
                      (Nível: {anyData.indicadores.nivelCompressao})
                    </span>
                  </div>
                  <Activity size={14} className="text-blue-500 animate-pulse" />
                </div>
              )}
              <div className="space-y-3 mt-3">
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">RSI (14)</span>
                    {anyData.indicadores?.fontes?.rsi === 'API' && <span className="text-[8px] bg-genesis-positive/20 text-genesis-positive border border-genesis-positive/30 px-1 py-0.5 rounded">API</span>}
                    {(anyData.indicadores?.fontes?.rsi === 'GRAFICO' || anyData.indicadores?.fontes?.rsi === 'OCR') && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1 py-0.5 rounded">OCR</span>}
                    {anyData.indicadores?.fontes?.rsi === 'INDISPONIVEL' && <span className="text-[8px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1 py-0.5 rounded">N/D</span>}
                  </div>
                  <span className="text-[10px] text-white font-mono">{anyData.indicadores?.rsi ? Number(anyData.indicadores.rsi).toFixed(1) : "N/A"}</span>
                </div>

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">ADX</span>
                    {anyData.indicadores?.fontes?.adx === 'API' && <span className="text-[8px] bg-genesis-positive/20 text-genesis-positive border border-genesis-positive/30 px-1 py-0.5 rounded">API</span>}
                    {(anyData.indicadores?.fontes?.adx === 'GRAFICO' || anyData.indicadores?.fontes?.adx === 'OCR') && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1 py-0.5 rounded">OCR</span>}
                    {anyData.indicadores?.fontes?.adx === 'INDISPONIVEL' && <span className="text-[8px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1 py-0.5 rounded">N/D</span>}
                  </div>
                  <span className="text-[10px] text-white font-mono">{anyData.indicadores?.adx ? Number(anyData.indicadores.adx).toFixed(1) : "N/A"}</span>
                </div>

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">ATR</span>
                    {anyData.indicadores?.fontes?.atr === 'API' && <span className="text-[8px] bg-genesis-positive/20 text-genesis-positive border border-genesis-positive/30 px-1 py-0.5 rounded">API</span>}
                    {(anyData.indicadores?.fontes?.atr === 'GRAFICO' || anyData.indicadores?.fontes?.atr === 'OCR') && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1 py-0.5 rounded">OCR</span>}
                    {anyData.indicadores?.fontes?.atr === 'INDISPONIVEL' && <span className="text-[8px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1 py-0.5 rounded">N/D</span>}
                  </div>
                  <span className="text-[10px] text-white font-mono">{anyData.indicadores?.atr != null ? `$${Number(anyData.indicadores.atr).toFixed(4)}` : "N/D"}</span>
                </div>

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">EMAs (21/50/200)</span>
                    {anyData.indicadores?.fontes?.ema21 === 'API' && <span className="text-[8px] bg-genesis-positive/20 text-genesis-positive border border-genesis-positive/30 px-1 py-0.5 rounded">API</span>}
                    {(anyData.indicadores?.fontes?.ema21 === 'GRAFICO' || anyData.indicadores?.fontes?.ema21 === 'OCR') && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1 py-0.5 rounded">OCR</span>}
                    {anyData.indicadores?.fontes?.ema21 === 'INDISPONIVEL' && <span className="text-[8px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1 py-0.5 rounded">N/D</span>}
                  </div>
                  <span className="text-[9px] text-white font-mono">{(anyData.indicadores?.ema21 != null || anyData.indicadores?.ema50 != null || anyData.indicadores?.ema200 != null) ? `${formatPrice(Number(anyData.indicadores?.ema21))} | ${formatPrice(Number(anyData.indicadores?.ema50))} | ${formatPrice(Number(anyData.indicadores?.ema200))}` : 'N/D'}</span>
                </div>

                {/* WYCKOFF */}
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Wyckoff</span>
                  </div>
                  <span className={`text-[10px] font-mono ${anyData.wyckoff?.cor || 'text-white'}`}>
                    {WYCKOFF_LABEL[anyData.wyckoff?.fase] || anyData.wyckoff?.fase || 'N/A'}
                  </span>
                </div>

                {/* SESSÃO */}
                <div className="flex justify-between items-center group">
                  <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Sessão</span>
                  <span className={`text-[10px] font-mono ${anyData.sessao?.cor || 'text-white'}`}>
                    {anyData.sessao?.nome || 'N/A'}
                  </span>
                </div>

                {/* CONFLUÊNCIA TEMPORAL */}
                {anyData.multiTimeframe && anyData.multiTimeframe.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5 col-span-full">
                    <span className="text-[10px] text-genesis-accent font-bold uppercase tracking-widest mb-3 block">
                      Confluência Temporal
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {anyData.multiTimeframe.map((tf: any, idx: number) => {
                        const biasColor = tf.bias === 'BULLISH' ? 'text-genesis-positive bg-genesis-positive/10 border-genesis-positive/20'
                          : tf.bias === 'BEARISH' ? 'text-genesis-negative bg-genesis-negative/10 border-genesis-negative/20'
                          : 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
                        return (
                          <div key={idx} className={`flex items-center gap-2 px-3 py-1.5 rounded border ${biasColor}`}>
                            <span className="text-[9px] font-bold uppercase">{tf.timeframe}</span>
                            <span className="text-[9px] font-mono font-bold">{tf.bias}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Coluna 2: Macro */}
            <div className="bg-[#050505] p-[16px] rounded-lg">
              <span className="text-[10px] text-genesis-positive font-bold uppercase tracking-widest mb-3 block pb-2 border-b border-white/5">
                MACRO E GEOPOLÍTICO
              </span>
              <p className={`text-[10px] text-gray-400 leading-relaxed mb-4 mt-3 ${!macroInfo?.resumo ? 'italic' : ''}`}>
                  {macroInfo?.resumo || "Contexto informativo indisponível para esta análise (orçamento de IA esgotado ou serviço fora do ar)."}
              </p>
              {macroInfo?.eventos && macroInfo.eventos.length > 0 && (
                <div className="space-y-3">
                  {macroInfo.eventos.map((evt: string, idx: number) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-genesis-accent mt-0.5">•</span>
                        <p className="text-[9.5px] text-gray-400 leading-relaxed font-mono">
                          {evt}
                        </p>
                      </div>
                  ))}
                </div>
              )}
            </div>

            {/* Coluna 3: Sentimento */}
            <div className="bg-[#050505]  p-[16px] rounded-lg">
              <div className="flex justify-between items-center  pb-2 mb-3">
                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest block">Sentimento</span>
                <span className={`text-[10px] font-bold font-mono px-2 rounded bg-white/5 ${sentimento?.score == null ? 'text-gray-500' : sentimento.score > 60 ? 'text-genesis-positive' : 'text-genesis-negative'}`}>{sentimento?.score == null ? 'Sem dado' : `${sentimento.score}/100`}</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed mb-4  pb-3 mt-3">
                  {sentimento?.narrativa || "Contexto informativo indisponível para esta análise."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[8px] text-gray-600 uppercase tracking-widest block mb-2 font-bold">Gatilhos (+)</span>
                    <ul className="text-[9.5px] text-genesis-positive/80 space-y-2">
                      {sentimento?.gatilhos_positivos?.slice(0,2)?.map((p: string, i: number) => <li key={i} className="leading-tight line-clamp-2">- {p}</li>)}
                      {(!sentimento?.gatilhos_positivos || sentimento.gatilhos_positivos.length === 0) && <li className="italic text-gray-600">Nenhum</li>}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[8px] text-gray-600 uppercase tracking-widest block mb-2 font-bold">Gatilhos (-)</span>
                    <ul className="text-[9.5px] text-genesis-negative/80 space-y-2">
                      {sentimento?.gatilhos_negativos?.slice(0,2)?.map((n: string, i: number) => <li key={i} className="leading-tight line-clamp-2">- {n}</li>)}
                      {(!sentimento?.gatilhos_negativos || sentimento.gatilhos_negativos.length === 0) && <li className="italic text-gray-600">Nenhum</li>}
                    </ul>
                  </div>
              </div>
            </div>
          </div>
          )}
        </div>
        </>)}
      </div>
    </div>
  );
};

export default AnalysisResult;
