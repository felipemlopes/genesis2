import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { 
  Share2, Activity, Download, ArrowRight, ArrowUp, ArrowDown, Target, BarChart2, Shield, RefreshCw, ShieldAlert,
  CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { TradeSetup } from '../types';
import { selecionarZona, getMe } from '../services/api';
import { formatPrice } from '../services/cryptoApi';

interface AnalysisResultProps {
  data: TradeSetup;
  currentPrice?: string;
  change24h?: string;
  isPositiveChange?: boolean;
  onSaveTrade?: () => void;
  onReset?: () => void;
  analiseId?: string | null;
}

const genesisFeatureFlags = {
  sessaoNoScore: false,
  invalidacaoPipeline: true,
  wyckoffSessaoMetricas: true,
  dominanciaMacro: false,
  multiTimeframeSentimento: false,
  tamanhoPosicao: true,
};

const MENSAGENS_PILAR: Record<string, string[]> = {
  tecnico: [
    "Estrutura tecnica fraca ou contra a direcao. Preco desalinhado das medias e sem confirmacao de figura.",
    "Estrutura tecnica indefinida. Sinais mistos entre medias, momentum e figura, sem leitura dominante.",
    "Estrutura tecnica favoravel. Medias e momentum comecam a alinhar com a direcao, com confirmacao parcial.",
    "Estrutura tecnica forte e alinhada. Medias empilhadas, figura confirmada e momentum a favor da direcao."
  ],
  derivativos: [
    "Derivativos contra a operacao. Funding e posicionamento sugerem pressao na direcao oposta.",
    "Derivativos neutros. Funding e OI sem vies claro, posicionamento equilibrado.",
    "Derivativos a favor. OI e funding acompanham a direcao, com posicionamento construtivo.",
    "Derivativos fortemente a favor. OI subindo na direcao, funding e posicionamento confirmam o fluxo."
  ],
  macro: [
    "Macro adverso. Cenario de risk-off pesando contra ativos de risco. Informativo, nao afeta a direcao.",
    "Macro neutro a cauteloso. Sem gatilho macro claro. Informativo.",
    "Macro construtivo. Ambiente de risco favoravel. Informativo.",
    "Macro fortemente favoravel. Risk-on amplo. Informativo."
  ],
  sentimento: [
    "Sentimento muito negativo no ativo. Medo e pressao vendedora. Informativo, nao afeta a direcao.",
    "Sentimento negativo a neutro. Comunidade dividida. Informativo.",
    "Sentimento positivo. Narrativa do ativo ganhando tracao. Informativo.",
    "Sentimento muito positivo. Euforia e forte interesse. Atencao a exageros. Informativo."
  ],
};

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

const reportarErroBlocoGenesis = (nome: string, erro: string) => {
  return `Nome da Funcionalidade: ${nome}. Erro: ${erro}`;
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

  const sentimento = (data as any).sentimentoAtivo || data.sentimentoNarrativa || {};
  
  // Variáveis para simular/receber as conexões, permitindo os 3 estados
  const [erroBloco, setErroBloco] = useState<Record<string, string | null>>({
    // sessaoNoScore: "Timeout na API de tempo", // Exemplo de uso para Estado 2
  });
  const [dadosBloco, setDadosBloco] = useState<Record<string, any>>({
    sessaoNoScore: { sessao: "Sessão Londres", liquidez: "Liquidez Crescente", colorClass: "bg-blue-900/20 text-blue-500 border-blue-500/30" },
    invalidacaoPipeline: { texto: "Tese inválida se fechar vela acima de $82.100 para setup short" },
    wyckoff: "Acumulação",
    wyckoffColorClass: "text-green-500",
    sessaoMetrica: "Sessão Londres. Liq. Crescente",
    sessaoMetricaColorClass: "text-blue-500",
    dominanciaMacro: "BTC.D em queda de 0.5% nas últimas 4 horas indica fluxo de capital fluindo para altcoins.",
    multiTimeframe: [{ timeframe: "1D", bias: "BULLISH" }, { timeframe: "4H", bias: "NEUTRO" }, { timeframe: "1H", bias: "BULLISH" }],
    tamanhoPosicao: "$1.500 em contratos. baseado em 2% de $5.000 de capital configurado."
  });

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

  if (!data || !data.execucao || !data.execucao.setup) {
    return (
      <div className="p-8 text-center bg-black rounded-xl ">
         <p className="text-gray-400 font-mono">Processando leitura... Aguarde a confirmação de liquidez.</p>
      </div>
    );
  }

  const { setup } = data.execucao;
  const score = data.scoreProbabilidade;
  const strengthScore = data.confianca;
  const isCautela = strengthScore < 65;

  const activeTp1 = selectedZone === 'B' && data.entradaSugerida?.planoB_tp1 ? data.entradaSugerida.planoB_tp1 : setup.tp1;
  const activeTp2 = selectedZone === 'B' && data.entradaSugerida?.planoB_tp2 ? data.entradaSugerida.planoB_tp2 : setup.tp2;
  const activeTp3 = selectedZone === 'B' && data.entradaSugerida?.planoB_tp3 ? data.entradaSugerida.planoB_tp3 : setup.tp3;
  const activeStop = selectedZone === 'B' && data.entradaSugerida?.planoB_stop ? data.entradaSugerida.planoB_stop : setup.stop;
  const activeRr1 = selectedZone === 'B' && data.entradaSugerida?.planoB_rr1 ? data.entradaSugerida.planoB_rr1 : setup.rr1;
  
  const emEspera = data.execucao?.acao === 'AGUARDAR';
  const rotuloVerificacao: Record<string, string> = {
    'SEGURO':   'Condições validadas para execução',
    'INSEGURO': 'Setup não operável: risco-retorno abaixo do mínimo de 1:1.5',
  };
  
  const isLong = data.direcaoProvavel?.toUpperCase() === 'LONG';
  const badgeColor = isLong ? 'text-genesis-positive' : 'text-genesis-negative';
  const borderColor = isLong ? '' : '';
  const progressColor = isLong ? 'bg-genesis-positive' : 'bg-genesis-negative';

  // Extract rationale short text 
  const mainRationale = data.rationalScore || data.execucao?.motivo || "Leitura acionada pelos modelos.";

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
            <span className="text-[10px] text-genesis-accent font-mono uppercase tracking-widest">{data.regime || 'Regime Neutro'}</span>
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
        <div className={`${borderColor} bg-[#0a0a0f] rounded-3xl shadow-2xl border border-white/[0.03] p-[16px] mb-6 shadow-2xl relative overflow-hidden mt-8`}>
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
                    {data.direcaoProvavel}
                  </span>
                  <span className={`px-3 py-1 rounded bg-white/5 ${borderColor} text-xl font-bold font-mono ${badgeColor}`}>
                    {setup.alavancagem}x
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col items-start md:items-end w-full md:w-auto">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-1">Score do Algoritmo</span>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className={`text-4xl font-bold font-mono ${isCautela ? 'text-yellow-500' : badgeColor}`}>
                    {score}
                    <span className="text-lg text-gray-600">/100</span>
                  </span>
                </div>
              </div>
              <span className={`text-xs font-bold uppercase tracking-widest mt-1 px-2 py-0.5 rounded ${isCautela ? 'bg-yellow-900/20 text-yellow-500 border-yellow-500/30' : 'bg-green-900/20 text-genesis-positive border-genesis-positive/30'}`}>
                {isCautela ? '️ Leitura com Cautela' : ' Leitura Confirmada'}
              </span>
            </div>
          </div>

          <div className="mb-5 relative z-10 w-full bg-gray-900 rounded-full h-2 overflow-hidden ">
            <div className={`h-full ${progressColor} transition-all duration-1000`} style={{width: `${score}%`}} />
          </div>

          {/* NOVO BLOCO DE DETALHAMENTO DO SCORE */}
          {(data as any).scoreDetalhado && (
            <div className="mb-5 relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {[
                { nome: 'Técnico', bloco: (data as any).scoreDetalhado.blocoTecnico },
                { nome: 'Derivativos', bloco: (data as any).scoreDetalhado.blocoDerivativos },
                { nome: 'Macro', bloco: (data as any).scoreDetalhado.blocoMacro },
                { nome: 'Sentimento', bloco: (data as any).scoreDetalhado.blocoSentimento }
              ].map((item, idx) => {
                const pct = item.bloco?.percentual || 0;
                const vies = item.bloco?.vies || 'neutro';
                const faixa = (p: number) => p < 25 ? 0 : p < 50 ? 1 : p < 75 ? 2 : 3;
                let colorClass = 'bg-yellow-500'; let Icon = AlertTriangle;       // neutro
                if (vies === 'alta')  { colorClass = 'bg-genesis-positive'; Icon = CheckCircle2; }
                if (vies === 'baixa') { colorClass = 'bg-genesis-negative'; Icon = XCircle; }
                
                return (
                  <div key={idx} className="bg-black/40 rounded p-3 border border-white/[0.05] cursor-help relative group" title={MENSAGENS_PILAR[item.nome.toLowerCase()]?.[faixa(pct)]}>
                    {item.bloco?.micro && (
                      <div className="absolute bottom-full left-0 mb-2 z-[9999] max-w-[260px] px-3 py-2.5 bg-[#0a0a0f] border border-white/[0.08] rounded-[10px] text-[12.5px] leading-relaxed text-gray-300 shadow-[0_8px_24px_rgba(0,0,0,0.18)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 pointer-events-none" role="tooltip">
                        {item.bloco.micro}
                      </div>
                    )}
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{item.nome}</span>
                        <Icon size={12} className={vies === 'alta' ? 'text-genesis-positive' : vies === 'baixa' ? 'text-genesis-negative' : 'text-yellow-500'} />
                    </div>
                    <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                       <div className={`h-full ${colorClass}`} style={{width: `${pct}%`}} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}



          <div className="bg-white/5  rounded-lg p-[16px] relative z-10 flex items-start gap-3">
            <Target className={`${badgeColor} shrink-0 mt-0.5`} size={16} />
            <p className="text-sm text-gray-300 font-medium leading-relaxed">
              {mainRationale}
            </p>
          </div>
        </div>

        {/* F1: Avisos do reconciliador */}
        {(data as any).avisos?.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-600/30 rounded-lg p-3 mb-6">
            {(data as any).avisos.map((a: string, i: number) => (
              <p key={i} className="text-[11px] text-amber-300 leading-relaxed">{a}</p>
            ))}
          </div>
        )}

        {emEspera && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-6 mb-6">
            <div className="text-amber-400 font-bold text-lg tracking-widest">AGUARDAR</div>
            <p className="text-amber-200/80 text-sm mt-2">
              O risco-retorno atual não atinge o mínimo de 1:1.5. O cérebro recalculará o setup quando o preço oferecer um ponto melhor.
            </p>
          </div>
        )}

        {/* CAMADA 2: RISCO-RETORNO */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] mb-6">
          <div className="bg-[#050505] rounded-[10px] p-[16px] flex flex-col justify-center items-center text-center cursor-help" title="Risco/retorno calculado com base no primeiro alvo (TP1).">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">RISCO/RETORNO (TP1)</span>
            <span className="text-2xl font-mono text-white font-bold">1:{activeRr1}</span>
          </div>
          
          <div className="bg-[#050505]  rounded-[10px] p-[16px] flex flex-col justify-center items-center text-center relative overflow-hidden">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Risco Máximo</span>
            <span className="text-2xl font-mono text-genesis-negative font-bold flex items-baseline gap-1">
              {setup.riscoPct}%
              {setup.riscoMaximoUsd && <span className="text-[10px] text-gray-500"> ({setup.riscoMaximoUsd})</span>}
            </span>
          </div>
          
          <div className="bg-[#050505]  rounded-[10px] p-[16px] flex flex-col justify-center items-center text-center col-span-2 md:col-span-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Liquidação</span>
            <span className="text-xl font-mono text-orange-400 font-bold">{typeof setup.liquidacao === 'number' ? `$${setup.liquidacao}` : setup.liquidacao}</span>
          </div>
          
          <div className="bg-[#050505]  rounded-[10px] p-[16px] flex flex-col justify-center col-span-2 md:col-span-1">
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-2 text-center md:text-left">Perfil da Operação</span>
            <div className="w-full bg-gray-900 rounded-full h-1.5 mb-2 overflow-hidden">
              <div 
                className="h-full bg-orange-400 opacity-80" 
                style={{ width: `${Math.min(setup.riscoPct * 5, 100)}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-gray-400 text-center md:text-left">
              {(() => {
                const riscoMargemPct = setup.riscoMargemPct ?? setup.riscoPct * (setup.alavancagem ?? 1);
                const label = riscoMargemPct > 50 ? 'Alta Exposição' : riscoMargemPct > 25 ? 'Exposição Moderada' : 'Baixa Exposição';
                return `${label} (${(riscoMargemPct as any) > 100 ? '>' : ''}${Math.min(riscoMargemPct, 100).toFixed(1)}% da margem)`;
              })()}
            </span>
          </div>
        </div>

        {/* Análise Técnica — prosa inteira (9 ideias) */}
        <div className="bg-[#050505] rounded-[10px] p-[16px] mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Análise Técnica</h3>
          <p className="text-sm text-gray-300 leading-relaxed text-left whitespace-normal break-normal" style={{ wordSpacing: 'normal', letterSpacing: 'normal', hyphens: 'none', lineHeight: 1.6 }}>
            {limparTexto(data.narrativa || "Análise técnica indisponível.")}
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
                    disabled={emEspera}
                    onClick={() => handleZoneSelect('A')}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all duration-200 ${emEspera ? 'opacity-40 cursor-not-allowed' : ''} ${
                      selectedZone === 'A'
                        ? 'bg-genesis-accent/10 border-genesis-accent ring-1 ring-genesis-accent'
                        : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30'
                    }`}
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <span className={`text-[10px] font-bold ${selectedZone === 'A' ? 'text-genesis-accent' : 'text-gray-400'}`}>Plano A (Primário)</span>
                      <span className="font-mono font-bold text-sm text-white">{formatPrice(Number(data.entradaSugerida?.planoA || setup.entrada))}</span>
                    </div>
                    <p className="text-[9px] text-gray-400 font-mono tracking-wide leading-tight mt-1">
                      {data.entradaSugerida?.descricaoPlanoA || "Ponto de entrada primário conforme estrutura."}
                    </p>
                  </button>

                  {/* Plano B */}
                  {data.entradaSugerida?.planoB && (
                    <button
                      disabled={emEspera}
                      onClick={() => handleZoneSelect('B')}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all duration-200 ${emEspera ? 'opacity-40 cursor-not-allowed' : ''} ${
                        selectedZone === 'B'
                          ? 'bg-genesis-accent/10 border-genesis-accent ring-1 ring-genesis-accent'
                          : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30'
                      }`}
                    >
                      <div className="flex justify-between items-baseline mb-1">
                        <span className={`text-[10px] font-bold ${selectedZone === 'B' ? 'text-genesis-accent' : 'text-gray-400'}`}>Plano B (Alternativo)</span>
                        <span className="font-mono font-bold text-xs text-white">{formatPrice(Number(data.entradaSugerida.planoB))}</span>
                      </div>
                      <p className="text-[9px] text-gray-400 font-mono tracking-wide leading-tight mt-1">
                        {data.entradaSugerida.descricaoPlanoB}
                      </p>
                    </button>
                  )}
                </div>
              </div>

              {/* Botão de Confirmação */}
              <div className="mt-4 pt-3 border-t border-white/5 relative group">
                <button
                  disabled={emEspera || !selectedZone}
                  onClick={() => { if (onSaveTrade) onSaveTrade(); }}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-mono uppercase tracking-wider font-bold transition-all duration-[180ms] ${
                    !selectedZone
                      ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                      : 'bg-genesis-accent text-black hover:bg-[#39ff14] hover:text-black hover:shadow-[0_4px_16px_rgba(57,255,20,0.25)] active:scale-[0.98]'
                  }`}
                >
                  <Shield size={14} />
                  {selectedZone ? 'Confirmar Posição' : 'Selecione um Plano'}
                </button>
                {selectedZone && (
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
                      <span className="text-genesis-positive font-mono font-bold text-sm bg-genesis-positive/10 px-2 py-0.5 rounded">{formatPrice(Number(activeTp1))}</span>
                      {setup.tp1_fonte && <div className="text-[8px] text-gray-500 mt-0.5">{setup.tp1_fonte}</div>}
                    </div>
                </div>
                <div className="flex justify-between items-center group">
                    <span className="text-gray-500 text-[10px] font-bold">TP2</span>
                    <div className="text-right">
                      <span className="text-genesis-positive font-mono font-bold text-sm bg-genesis-positive/10 px-2 py-0.5 rounded">{formatPrice(Number(activeTp2))}</span>
                      {setup.tp2_fonte && <div className="text-[8px] text-gray-500 mt-0.5">{setup.tp2_fonte}</div>}
                    </div>
                </div>
                {Number(activeTp3) > 0 && (
                <div className="flex justify-between items-center group">
                    <span className="text-gray-500 text-[10px] font-bold">TP3</span>
                    <div className="text-right">
                      <span className="text-genesis-positive font-mono font-bold text-sm bg-genesis-positive/10 px-2 py-0.5 rounded">{formatPrice(Number(activeTp3))}</span>
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
                <span className="text-2xl font-mono text-genesis-negative font-bold drop--[0_0_8px_rgba(239,68,68,0.4)]">${activeStop}</span>
              </div>
              
              {/* BLOCO 2 - INVALIDAÇÃO DA TESE */}
              <div className="bg-red-950/30 p-3 rounded border-red-900/50 mt-1 mb-2">
                    <span className="text-[9px] font-bold text-genesis-negative/80 block mb-1.5 uppercase tracking-wider">
                      INVALIDAÇÃO DA TESE
                    </span>
                    <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                      {data.execucao?.zonaInteresse?.invalidacao || "Zona de invalidação não calculada."}
                    </p>
              </div>

              {(setup.verificacao || data.zonaInteresse?.invalidacao) && (
                <div className="bg-red-950/30 p-3 rounded border-red-900/50 mt-1">
                  <span className="text-[9px] font-bold text-genesis-negative/80 block mb-1.5 uppercase tracking-wider">Condição de Disparo</span>
                  <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                    {rotuloVerificacao[setup.verificacao] ?? setup.verificacao}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* BLOCO 6 - TAMANHO DE POSIÇÃO SUGERIDO */}
          <div className="mt-6 pt-5 border-t border-white/[0.05]">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                TAMANHO SUGERIDO
              </span>
              
              {data.execucao?.setup?.tamanhoSugerido ? (
                <span className="text-[10px] text-white font-mono">{data.execucao.setup.tamanhoSugerido}</span>
              ) : (
                <span className="text-[10px] text-gray-500 italic">Informe o valor de entrada no formulário para calcular o tamanho da posição</span>
              )}
            </div>
          </div>

          {/* ALERTA VISUAL DE RISCO RETORNO */}
          {setup.rr1 && setup.rr1 < 1.5 && (
            <div className="mt-6 border border-yellow-500/30 bg-yellow-500/10 p-4 rounded-lg flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2">
              <ShieldAlert className="text-yellow-500 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="text-yellow-500 font-bold text-sm mb-1">Risco Retorno abaixo do recomendado.</h4>
                <p className="text-yellow-500/80 text-xs">
                  RR atual de 1:{setup.rr1.toFixed(2)} está abaixo do mínimo de 1:1.5. Considere aguardar melhor ponto de entrada.
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


            {data.ensemble && (
              <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {[
                      { nome: 'Técnico', bloco: data.ensemble.motorTecnico },
                      { nome: 'Derivativos', bloco: data.ensemble.motorDerivativos },
                      { nome: 'Macro', bloco: data.ensemble.motorMacro },
                      { nome: 'Sentimento', bloco: data.ensemble.motorSentimento }
                  ].map((item, idx) => {
                      const pct = item.bloco?.score || 0;
                      let colorClass = 'bg-red-500';
                      let StatusIcon = XCircle;
                      if (pct >= 65) { colorClass = 'bg-genesis-positive'; StatusIcon = CheckCircle2; }
                      else if (pct >= 45) { colorClass = 'bg-yellow-500'; StatusIcon = AlertTriangle; }
                      
                      return (
                          <div key={idx} className="bg-black/40 rounded border border-white/[0.05] p-3 text-left">
                              <div className="flex justify-between items-center mb-2">
                       <span className={`text-[9px] font-bold uppercase tracking-wider ${pct >= 65 ? 'text-genesis-positive' : pct >= 45 ? 'text-yellow-500' : 'text-genesis-negative'}`}>{item.nome}</span>
                                  <StatusIcon size={12} className={pct >= 65 ? 'text-genesis-positive' : pct >= 45 ? 'text-yellow-500' : 'text-red-500'} />
                              </div>
                              <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden mb-1">
                                  <div className={`h-full ${colorClass}`} style={{width: `${pct}%`}} />
                              </div>
                              {item.bloco?.status && (
                                  <span className={`text-[8px] font-mono tracking-wider ${pct >= 65 ? 'text-green-500' : pct >= 45 ? 'text-yellow-500' : 'text-red-500'}`}>{item.bloco.status}</span>
                              )}
                          </div>
                      );
                  })}
              </div>
            )}

          {showIndicators && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px] pt-6 mt-6  animate-in fade-in slide-in- duration-300">
            {/* Coluna 1: Técnica */}
            <div className="bg-[#050505]  p-[16px] rounded-lg relative">
              <span className="text-[10px] text-genesis-accent font-bold uppercase tracking-widest mb-3 block  pb-2">Métricas Técnicas</span>
              {data.indicadores?.compressaoDetectada && (
                <div className="mb-3 w-full bg-blue-500/10 border border-blue-500/30 rounded px-3 py-2 flex items-center justify-between shadow-[0_0_15px_rgba(59,130,246,0.15)] pulse-slow">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">
                      COMPRESSÃO DETECTADA. ROMPIMENTO IMINENTE
                    </span>
                    <span className="text-[8px] text-blue-400/80 uppercase">
                      (Nível: {data.indicadores.nivelCompressao})
                    </span>
                  </div>
                  <Activity size={14} className="text-blue-500 animate-pulse" />
                </div>
              )}
              <div className="space-y-3 mt-3">
                <div className="flex justify-between items-center"><span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Regime</span> <span className="text-[10px] text-white font-mono">{data.regime || "N/A"}</span></div>
                
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">RSI (14)</span>
                    {data.indicadores?.fontes?.rsi === 'API' && <span className="text-[8px] bg-genesis-positive/20 text-genesis-positive border border-genesis-positive/30 px-1 py-0.5 rounded">API</span>}
                    {(data.indicadores?.fontes?.rsi === 'GRAFICO' || data.indicadores?.fontes?.rsi === 'OCR') && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1 py-0.5 rounded">OCR</span>}
                    {data.indicadores?.fontes?.rsi === 'INDISPONIVEL' && <span className="text-[8px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1 py-0.5 rounded">N/D</span>}
                  </div>
                  <span className="text-[10px] text-white font-mono">{data.indicadores?.rsi ? Number(data.indicadores.rsi).toFixed(1) : "N/A"}</span>
                </div>
                
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">ADX</span>
                    {data.indicadores?.fontes?.adx === 'API' && <span className="text-[8px] bg-genesis-positive/20 text-genesis-positive border border-genesis-positive/30 px-1 py-0.5 rounded">API</span>}
                    {(data.indicadores?.fontes?.adx === 'GRAFICO' || data.indicadores?.fontes?.adx === 'OCR') && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1 py-0.5 rounded">OCR</span>}
                    {data.indicadores?.fontes?.adx === 'INDISPONIVEL' && <span className="text-[8px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1 py-0.5 rounded">N/D</span>}
                  </div>
                  <span className="text-[10px] text-white font-mono">{data.indicadores?.adx ? Number(data.indicadores.adx).toFixed(1) : "N/A"}</span>
                </div>
                
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">ATR</span>
                    {data.indicadores?.fontes?.atr === 'API' && <span className="text-[8px] bg-genesis-positive/20 text-genesis-positive border border-genesis-positive/30 px-1 py-0.5 rounded">API</span>}
                    {(data.indicadores?.fontes?.atr === 'GRAFICO' || data.indicadores?.fontes?.atr === 'OCR') && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1 py-0.5 rounded">OCR</span>}
                    {data.indicadores?.fontes?.atr === 'INDISPONIVEL' && <span className="text-[8px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1 py-0.5 rounded">N/D</span>}
                  </div>
                  <span className="text-[10px] text-white font-mono">{data.indicadores?.atr != null ? `$${Number(data.indicadores.atr).toFixed(4)}` : "N/D"}</span>
                </div>
                
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">EMAs (21/50/200)</span>
                    {data.indicadores?.fontes?.ema21 === 'API' && <span className="text-[8px] bg-genesis-positive/20 text-genesis-positive border border-genesis-positive/30 px-1 py-0.5 rounded">API</span>}
                    {(data.indicadores?.fontes?.ema21 === 'GRAFICO' || data.indicadores?.fontes?.ema21 === 'OCR') && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1 py-0.5 rounded">OCR</span>}
                    {data.indicadores?.fontes?.ema21 === 'INDISPONIVEL' && <span className="text-[8px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1 py-0.5 rounded">N/D</span>}
                  </div>
                  <span className="text-[9px] text-white font-mono">{(data.indicadores?.ema21 != null || data.indicadores?.ema50 != null || data.indicadores?.ema200 != null) ? `${formatPrice(Number(data.indicadores?.ema21))} | ${formatPrice(Number(data.indicadores?.ema50))} | ${formatPrice(Number(data.indicadores?.ema200))}` : 'N/D'}</span>
                </div>
                
                {/* BLOCO 3 - WYCKOFF E SESSÃO */}
                
                {/* WYCKOFF */}
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Wyckoff</span>
                  </div>
                  <span className={`text-[10px] font-mono ${(data as any).wyckoff?.cor || 'text-white'}`}>
                    {WYCKOFF_LABEL[(data as any).wyckoff?.fase] || (data as any).wyckoff?.fase || 'N/A'}
                  </span>
                </div>

                {/* SESSÃO */}
                <div className="flex justify-between items-center group">
                  <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Sessão</span>
                  <span className={`text-[10px] font-mono ${(data as any).sessao?.cor || 'text-white'}`}>
                    {(data as any).sessao?.nome || 'N/A'}
                  </span>
                </div>

                {/* CONFLUÊNCIA TEMPORAL */}
                {data.multiTimeframe && data.multiTimeframe.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5 col-span-full">
                    <span className="text-[10px] text-genesis-accent font-bold uppercase tracking-widest mb-3 block">
                      Confluência Temporal
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {data.multiTimeframe.map((tf: any, idx: number) => {
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
              <p className={`text-[10px] text-gray-400 leading-relaxed mb-4 mt-3 ${!data.macroGeopolitica?.resumo ? 'italic' : ''}`}>
                  {data.macroGeopolitica?.resumo || "Resumo macro não processado."}
              </p>
              {data.macroGeopolitica?.eventos && data.macroGeopolitica.eventos.length > 0 && (
                <div className="space-y-3">
                  {data.macroGeopolitica.eventos.map((evt, idx) => (
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
                <span className={`text-[10px] font-bold font-mono px-2 rounded bg-white/5 ${(sentimento as any)?.semDados ? 'text-gray-500' : (sentimento?.score || 0) > 60 ? 'text-genesis-positive' : 'text-genesis-negative'}`}>{(sentimento as any)?.semDados ? 'Sem dado' : `${sentimento?.score || 0}/100`}</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed mb-4  pb-3 mt-3">
                  {sentimento?.narrativa || "Narrativa aprofundada não detectada."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[8px] text-gray-600 uppercase tracking-widest block mb-2 font-bold">Gatilhos (+)</span>
                    <ul className="text-[9.5px] text-genesis-positive/80 space-y-2">
                      {sentimento?.gatilhosPositivos?.slice(0,2)?.map((p, i) => <li key={i} className="leading-tight line-clamp-2">- {p}</li>)}
                      {(!sentimento?.gatilhosPositivos || sentimento.gatilhosPositivos.length === 0) && <li className="italic text-gray-600">Nenhum</li>}
                    </ul>
                  </div>
                  <div>
                    <span className="text-[8px] text-gray-600 uppercase tracking-widest block mb-2 font-bold">Gatilhos (-)</span>
                    <ul className="text-[9.5px] text-genesis-negative/80 space-y-2">
                      {sentimento?.gatilhosNegativos?.slice(0,2)?.map((n, i) => <li key={i} className="leading-tight line-clamp-2">- {n}</li>)}
                      {(!sentimento?.gatilhosNegativos || sentimento.gatilhosNegativos.length === 0) && <li className="italic text-gray-600">Nenhum</li>}
                    </ul>
                  </div>
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisResult;