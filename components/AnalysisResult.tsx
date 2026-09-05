import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import {
  Share2, Activity, Download, ArrowRight, ArrowUp, ArrowDown, Target, BarChart2, Shield, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { GenesisAnalysisResult, AnalysisDirection, PlanoSetup } from '../types';
import { selecionarZona, getMe } from '../services/api';
import { price as formatPrice, usd as formatUsd } from '../utils/canonicalMoney';
import { publicText } from '../utils/publicVocabulary';
import { rotularFonte, rotularComponenteBuffer, rotularTimeframe } from '../utils/rotulos';
import { faixaDeConviccao } from '../utils/conviccao';
import AssetBadge from './AssetBadge';
import BlocoConviccaoQualidade from './BlocoConviccaoQualidade';
import ScoreBasisBars from './ScoreBasisBars';
import BlocoFiguraGrafica from './BlocoFiguraGrafica';

interface AnalysisResultProps {
  data: GenesisAnalysisResult;
  // V6.7 (B-24): antes não recebia argumento nenhum — o chamador (GenesisPage) não tinha como saber
  // qual plano (A ou B) estava selecionado na tela, e sempre gravava o Plano A (executable_setup),
  // mesmo com o Plano B visivelmente selecionado. Agora recebe o plano ativo no momento do clique.
  onSaveTrade?: (planoAtivo: PlanoSetup | null) => void;
  onReset?: () => void;
  analiseId?: string | null;
}

// D8 (V6.9): teto de referência da barra de "Risco de Capital" — antes a barra escalava contra
// literal 100% (largura quase sempre invisível, já que risco_pct_capital_base real fica na casa de
// 1-2% na prática, o teto configurado de risco por análise) enquanto o rótulo ao lado usava limiares
// (25%/50%) calibrados pra uma escala 0-100 que a barra nunca alcançava — os dois nunca concordavam
// visualmente sobre o que é "alto". Agora os dois usam o MESMO teto (2%, a referência usual de risco
// por análise) como 100% da barra.
const TETO_RISCO = 2;

// Spec genesis-v6-10-implementacao (Fase 6, item 6.1, doc §6.1): dicionário completo contra a
// lista canônica real (TechnicalAnalysisService::FASES_WYCKOFF, backend, 11 valores) — faltavam 4
// (ACUMULACAO_SC/AR/ST, RANGE_SEM_EVENTO), que caíam no fallback quebrado abaixo e apareciam crus
// na tela (ex.: "RANGE_SEM_EVENTO" no APT e no SUI). 'DISTRIBUICAO_SPRING' removido — não existe em
// FASES_WYCKOFF (confirmado por grep no backend), nunca foi produzido por classificarFase(); tê-lo
// aqui sugeria uma fase real que não existe.
const WYCKOFF_LABEL: Record<string, string> = {
  DISTRIBUICAO_RANGE: 'Distribuição em range',
  DISTRIBUICAO_UAT: 'Distribuição (UAT)',
  ACUMULACAO_RANGE: 'Acumulação em range',
  ACUMULACAO_SPRING: 'Acumulação com spring',
  ACUMULACAO_SC: 'Acumulação (clímax de venda)',
  ACUMULACAO_AR: 'Acumulação (repique automático)',
  ACUMULACAO_ST: 'Acumulação (teste secundário)',
  RANGE_SEM_EVENTO: 'Range sem evento',
  MARKUP: 'Markup',
  MARKDOWN: 'Markdown',
  INDETERMINADO: 'Indeterminado',
};

const directionLabel: Record<AnalysisDirection, string> = {
  LONG: 'LONG',
  SHORT: 'SHORT',
  INDISPONIVEL: 'INDISPONÍVEL',
};

// G7 (V6.9): bias de tempo maior (multiTimeframe) chegava cru em inglês na tela ("BULLISH"/
// "BEARISH"/"MIXED") — único ponto do arquivo que ainda mostrava o valor bruto do backend sem
// passar por um dicionário (Wyckoff já tinha o dele, WYCKOFF_LABEL acima).
const BIAS_LABEL: Record<string, string> = {
  BULLISH: 'ALTA',
  BEARISH: 'BAIXA',
  MIXED: 'MISTO',
};

// A8 (V6.9): manchete deixa de ser fixa "Plano não recomendado" — quando existe um alvo posterior
// (TP2/TP3) que já atende o R/R mínimo, nomeia esse alvo em vez de soar como reprovação total do
// plano (execution.alvo_que_atende, ExecucaoService::primeiroAlvoAcimaDoMinimo() no backend).
// Spec genesis-v6-10-implementacao (Fase 9, item 9.3, doc §9.3): quando NENHUM alvo isolado atinge
// o mínimo (nem TP1 nem um posterior — o caso que ainda caía no fallback "Plano não recomendado"),
// o rótulo passa a descrever o plano pelo R:R combinado real (item 9.2), nunca mais um veredito
// "não recomendado" — achado real do documento: um plano com TP2 pagando 1:0,63 e stop bem
// colocado não é reprovado, é um plano de R:R modesto. O botão continua ativo nos dois casos
// (podeInteragir nunca depende de recommendedAtivo, ver bloco condicional abaixo).
const manchetePlano = (alvoQueAtende: string | null | undefined, rrCombinadoExibir: string | null | undefined): string => {
  if (alvoQueAtende) return `Plano atende o ${alvoQueAtende}`;

  return rrCombinadoExibir ? `Plano de risco-retorno combinado ${rrCombinadoExibir}` : 'Plano de risco-retorno modesto';
};

// G12 (V6.9): Fear & Greed chegava só como número (0-100), sem a faixa qualitativa que dá
// significado a ele (a maioria dos membros não decora os limiares do índice de cor).
const faixaFearGreed = (valor: number): string => {
  if (valor <= 24) return 'Medo extremo';
  if (valor <= 44) return 'Medo';
  if (valor <= 55) return 'Neutro';
  if (valor <= 75) return 'Ganância';
  return 'Ganância extrema';
};

// G7 (V6.9): sessão de mercado (MarketSnapshotService::marketSession(), backend) devolve o nome
// cru em inglês (ASIA/LONDON/NEW_YORK/OVERNIGHT) — mesmo tratamento dos outros dicionários acima.
const SESSAO_LABEL: Record<string, string> = {
  ASIA: 'Ásia',
  LONDON: 'Londres',
  NEW_YORK: 'Nova York',
  OVERNIGHT: 'Overnight',
};

const limparTexto = (t: string) =>
  t.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim();

const AnalysisResult: React.FC<AnalysisResultProps> = ({ data, onSaveTrade, onReset, analiseId }) => {
  const [showIndicators, setShowIndicators] = useState(false);
  // G13 (V6.9): Plano A pré-selecionado — o backend já publica os dois planos completos e
  // paritários (ExecucaoService::montar(), $planoBCompleto com os mesmos 9 campos de A), só a
  // seleção inicial ficava em null, deixando "Selecione um Plano" mesmo com A pronto pra uso.
  // Spec genesis-v6-10-implementacao (Fase 5, item 5.4, doc §5.3): `null` agora significa "o membro
  // ainda não escolheu explicitamente" — o plano efetivamente exibido (`zonaEfetiva`, abaixo, só
  // calculável depois que `execution` existe) cai em `execution.plano_primario` (declarado pela
  // IA), nunca mais hardcoded em 'A'. Um clique explícito em A ou B sempre grava aqui e passa a
  // valer por cima do primário declarado.
  const [selectedZone, setSelectedZone] = useState<'A' | 'B' | null>(null);
  const [zoneSaveStatus, setZoneSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [zoneSaveError, setZoneSaveError] = useState<string | null>(null);

  // V6.7 (D-31): GenesisPage renderiza este componente sem `key` — o mesmo componente sobrevive entre
  // análises diferentes (troca de par/upload), então `selectedZone` (e o feedback de salvar zona)
  // continuavam com o valor da análise ANTERIOR. Resultado: abrir uma análise nova com Plano B
  // selecionado "por herança" da análise passada — plano ativo (e todos os campos que dependem dele)
  // decidido sem nenhuma ação do membro nesta análise. Reseta sempre que a identidade da análise muda.
  const analiseIdentidade = analiseId ?? data?.analysis_id ?? null;
  useEffect(() => {
    // Fase 5 (item 5.4): reseta pra "sem escolha explícita" — o render deriva o plano efetivamente
    // exibido (`zonaEfetiva`) a partir do primário declarado por ESTA análise, nunca herdado de uma
    // escolha manual feita na análise anterior.
    setSelectedZone(null);
    setZoneSaveStatus('idle');
    setZoneSaveError(null);
  }, [analiseIdentidade]);

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

    // V6.6 (F10): sem analiseId, o código buscava o histórico e assumia lista[0] — com duas abas
    // abertas ou duas análises próximas no tempo, a seleção podia gravar na análise errada. O
    // identificador confiável é sempre o da própria resposta (analysis_uuid/analiseId); sem ele,
    // erra explicitamente em vez de adivinhar.
    const idToUse = analiseId;

    if (!idToUse) {
      console.error('Análise sem identificador. Seleção de plano não registrada.');
      setZoneSaveStatus('error');
      setZoneSaveError('Não foi possível registrar a escolha. Recarregue a análise.');
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
  // Spec genesis-v6-10-implementacao (Fase 5, item 5.1/5.3/5.4, doc §5.3): plano que a IA declarou
  // como primário (pré-selecionado na tela) — 'A' é o fallback de uma decisão antiga/cacheada sem o
  // campo, mesmo padrão do backend (AnalysisPersistenceService). `zonaEfetiva` é o plano realmente
  // exibido: a escolha explícita do membro (`selectedZone`) quando existir, senão o primário — o
  // Plano A continua existindo e clicável, ninguém perde a opção de entrar a mercado.
  const planoPrimario: 'A' | 'B' = execution.plano_primario === 'B' ? 'B' : 'A';
  const zonaEfetiva: 'A' | 'B' = selectedZone ?? planoPrimario;
  const setup = execution.candidate_setup;
  const score = analysis.conviccao_modelo;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.14, doc §18): a antiga
  // nota de rastreabilidade (G5, V6.9), um número solto, virou este objeto — cobertura de decisão
  // + frescor real por fonte, exibido no rodapé (não mais dentro do card de convicção).
  const dataTraceability = analysis.data_traceability ?? null;
  // V6.5 (G14): antes lido de analysis.leitura_fraca, que o adaptador sempre chumbava em false
  // (nunca refletia a leitura real). Removido o campo falso — cautela agora deriva do próprio score,
  // mesma faixa "Fraca/Parcial" (<=60) usada por faixaDeConviccao() (G06).
  const isCautela = score != null && score <= 60;

  // V6.5 (E02): renomeado de isOperavel — antes, RR baixo ou convicção baixa também zeravam
  // execution.executable (bloqueio total). Agora executable só significa "a matemática fechou";
  // podeInteragir continua definido por execution.executable + execution.action, mas isso já não
  // inclui mais RR/convicção baixos, que viram aviso (temAviso) em vez de bloqueio.
  const podeInteragir = execution.executable && execution.action !== null;

  const direction = analysis.direction;
  const isLong = direction === 'LONG';
  const isShort = direction === 'SHORT';

  const planoB = execution.planoB as { entrada?: number; descricao?: string; zona?: string } | null;

  // V6.5 (E08): antes só a 'entrada' trocava ao selecionar o Plano B — stop/TP1-3/RR/alavancagem/
  // liquidação/tamanho/invalidação continuavam mostrando os números do Plano A, mesmo com "Plano B"
  // selecionado na tela. planoAtivo troca TODOS os 9 campos juntos, lendo de execution.planos[]
  // (formato completo e independente pros dois planos) — cai em candidate_setup só se a resposta for
  // de uma decisão cacheada antes deste campo existir (planos ausente/vazio).
  const planos = execution.planos ?? [];
  const planoAtivo = planos.find((p) => p.plano === zonaEfetiva)
    || planos.find((p) => p.plano === 'A')
    || planos[0]
    || null;
  const planoBDados = planos.find((p) => p.plano === 'B') ?? null;
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.7, doc §16): tick real do
  // contrato (PriceNormalizer, backend) — mesmo tick pro par inteiro, reaproveitado em toda
  // formatação de PREÇO desta análise (entrada/stop/TP/EMAs/etc.), não só no plano ativo.
  const tickDecimals = planoAtivo?.tick_decimals ?? setup?.tick_decimals ?? null;
  // V6.5 (G02): zona_de/zona_ate chegam numéricos agora (antes vinham embutidos na frase de
  // 'descricao', sem separador de milhar) — formatados aqui, junto do texto qualitativo do backend.
  const planoBDescricaoCompleta = (() => {
    const texto = publicText(planoBDados?.descricao) || 'Entrada alternativa calculada pelo motor de execução.';
    if (planoBDados?.zona_de != null && planoBDados?.zona_ate != null) {
      return `Zona entre ${formatPrice(planoBDados.zona_de, tickDecimals)} e ${formatPrice(planoBDados.zona_ate, tickDecimals)}. ${texto}`;
    }
    return texto;
  })();

  // V6.5 (E11): antes o backend montava a frase inteira, usando o par completo como se fosse a
  // unidade da quantidade ("0.05 BTCUSDT" — errado, a unidade real é só o ativo base, BTC). Backend
  // agora só devolve os números; a frase é montada aqui.
  const tamanhoSugeridoTexto = (() => {
    const nocional = planoAtivo?.nocional_estimado ?? setup?.nocional_estimado;
    const quantidadeBase = planoAtivo?.quantidade_base_estimada ?? setup?.quantidade_base_estimada;
    const ativoBase = planoAtivo?.ativo_base ?? setup?.ativo_base;
    const riscoUsd = planoAtivo?.risco_usd_estimado ?? setup?.risco_usd_estimado;
    // D7 (V6.9): renomeado de 'risco_margem_pct' — sempre foi risco sobre o capital-base (saldo
    // total), não sobre a margem desta posição. Texto atualizado pra dizer o nome certo.
    const riscoPctCapitalBase = planoAtivo?.risco_pct_capital_base ?? setup?.risco_pct_capital_base;
    if (nocional == null || quantidadeBase == null || !ativoBase) return null;
    // V6.9 pacote final (Fase 11, item 11.7): nocional/risco são valores em DÓLAR, não preço de
    // ativo — usd() (sempre 2 casas), nunca price() (casas do tick do ativo).
    const base = `${formatUsd(nocional)} de nocional, equivalente a ${quantidadeBase} ${ativoBase}`;
    if (riscoUsd == null || riscoPctCapitalBase == null) return `${base}.`;
    return `${base}. Risco estimado até o stop: ${formatUsd(riscoUsd)} (${riscoPctCapitalBase}% do capital-base).`;
  })();

  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.8, doc §16): risco-retorno
  // por alvo chega pronto do backend (ExecucaoService::calcularRrPorAlvo(), TP2/TP3 incluídos) —
  // utils/riscoRetorno.ts (recálculo local, sem validação de lado do alvo) apagado.
  const rrPorAlvo = planoAtivo?.rr_por_alvo ?? setup?.rr_por_alvo ?? null;

  const badgeColor = isLong ? 'text-genesis-positive' : isShort ? 'text-genesis-negative' : 'text-yellow-500';
  const progressColor = isLong ? 'bg-genesis-positive' : isShort ? 'bg-genesis-negative' : 'bg-yellow-500/60';

  // V6.5 (E08): antes vinha só de execution.zonaInteresse (sempre a invalidação do Plano A, mesmo com
  // Plano B selecionado) — agora troca junto com o plano ativo.
  // V6.5 (G02): backend para de montar a frase com o nível cru embutido (ex.: "$65370.9262", sem
  // separador de milhar) — direção + nível chegam numéricos, o texto é montado aqui com formatPrice().
  // Spec genesis-v6-10-implementacao (Fase 6, item 6.6, doc §6.6): este é o nível que invalida a
  // OPERAÇÃO (a âncora estrutural do stop, "o preço nega a entrada") — renomeado de "a tese perde
  // validade" (rótulo antigo, de antes do G02 existir, que sobrou descrevendo um campo que já não
  // é mais sobre tese). "Invalidação da tese" de verdade é um conceito PRÓPRIO agora
  // (invalidacaoTese, abaixo), nunca mais confundido com este.
  const invalidacaoDirecao = planoAtivo?.invalidacao_direcao ?? execution.zonaInteresse?.invalidacao_direcao ?? null;
  const invalidacaoNivel = planoAtivo?.invalidacao_nivel ?? execution.zonaInteresse?.invalidacao_nivel ?? null;
  const invalidacaoAtiva = invalidacaoDirecao && invalidacaoNivel != null
    ? `O preço nega a entrada com fechamento ${invalidacaoDirecao} de ${formatPrice(invalidacaoNivel, tickDecimals)}.`
    : (publicText(analysis.invalidacao_tese) || null);

  // Fase 6 (item 6.6): dois níveis de invalidação já publicados pelo backend
  // (ExecucaoService.php, item 13 de correção-tecnica) e nunca consumidos aqui — zero ocorrências
  // confirmadas antes desta fase. Cada um só existe quando há um nível real e justificável do
  // mesmo catálogo; omitido (não "indisponível") quando ausente.
  const invalidacaoEstruturaDirecao = planoAtivo?.invalidacao_estrutura_direcao ?? null;
  const invalidacaoEstruturaNivel = planoAtivo?.invalidacao_estrutura_nivel ?? null;
  const invalidacaoEstruturaTexto = invalidacaoEstruturaDirecao && invalidacaoEstruturaNivel != null
    ? `A estrutura que sustenta a leitura se quebra com fechamento ${invalidacaoEstruturaDirecao} de ${formatPrice(invalidacaoEstruturaNivel, tickDecimals)}.`
    : null;
  const invalidacaoTeseDirecao = planoAtivo?.invalidacao_tese_direcao ?? null;
  const invalidacaoTeseNivel = planoAtivo?.invalidacao_tese_nivel ?? null;
  const invalidacaoTeseTexto = invalidacaoTeseDirecao && invalidacaoTeseNivel != null
    ? `A tendência anterior é retomada com fechamento ${invalidacaoTeseDirecao} de ${formatPrice(invalidacaoTeseNivel, tickDecimals)}.`
    : null;

  // V6.7 (A-14): três estados do stop — troca junto com o plano ativo, mesmo padrão de
  // invalidacaoDirecao/invalidacaoNivel acima.
  const stopStatusAtivo = planoAtivo?.stop_status ?? setup?.stop_status ?? 'STOP_UNAVAILABLE';
  const stopAncoraAtiva = planoAtivo?.stop_ancora ?? setup?.stop_ancora ?? null;
  const stopBufferAtivo = planoAtivo?.stop_buffer ?? setup?.stop_buffer ?? null;
  const stopMotivoAtivo = planoAtivo?.stop_motivo ?? setup?.stop_motivo ?? null;

  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.9, doc §16): cada plano
  // tem sua PRÓPRIA recomendação agora (ExecucaoService::montar()/PlanRecommendationService,
  // Fase 8) — antes só existia uma, em execution.recommended/motivo/alvo_que_atende, implicitamente
  // do Plano A, que não trocava ao selecionar o Plano B na tela.
  const recommendedAtivo = planoAtivo?.recommended ?? setup?.recommended ?? execution.recommended;
  const motivoAtivo = planoAtivo?.motivo ?? setup?.motivo ?? execution.motivo;
  const alvoQueAtendeAtivo = planoAtivo?.alvo_que_atende ?? setup?.alvo_que_atende ?? execution.alvo_que_atende;
  // Item 9.3 (doc §9.3): usado no rótulo (manchetePlano) quando nenhum alvo isolado atinge o mínimo.
  const rrLiquidoCombinadoExibirAtivo = planoAtivo?.rr_liquido_combinado_exibir ?? setup?.rr_liquido_combinado_exibir ?? null;

  // R3.2 — Adendo Seção 32: contrato canônico em inglês primeiro, com
  // fallback ao português legado. `execution.motivo` nunca alimenta a
  // justificativa do score — é um campo de execução, não de leitura.
  const scoreJustification = publicText(analysis.score_justification ?? analysis.justificativa_score ?? null) || null;
  const technicalAnalysis = publicText(analysis.technical_analysis ?? analysis.narrativa_tecnica ?? null) || null;
  const scoreContext = analysis.score_context ?? null;

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="flex justify-between items-center bg-transparent pb-4 border-b border-white/[0.02] ">
        <div className="flex items-center gap-3">
          <AssetBadge symbol={data.pair} size="md" mostrarNome={false} />
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">{data.pair}</h2>
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
          <span className="text-[8px] tracking-widest font-mono text-white uppercase">Gênesis {data.analysis_version ?? 'v6.5'}</span>
        </div>

        {/* CAMADA 1: DECISÃO RÁPIDA */}
        <div className={`bg-[#0a0a0f] rounded-3xl shadow-2xl border border-white/[0.03] p-[16px] mb-6 shadow-2xl relative overflow-hidden mt-8`}>
          <div className={`absolute top-0 right-0 w-64 h-64 ${isLong ? 'bg-genesis-positive/5' : 'bg-genesis-negative/5'} blur-[100px] pointer-events-none rounded-full`} />

          {/* V6.5 (G09): preço do snapshot — o mesmo sobre o qual o setup foi calculado — em vez do
              preço vivo do polling (AppContext), que evitava 3 preços diferentes na mesma tela
              (header, entrada do Plano A, TradingView no momento do print). O preço ao vivo continua
              só no ticker geral da plataforma, fora do bloco de análise. */}
          {data.market_price != null && (
            <div className="flex items-center gap-2 mb-1">
                {/* V6.9 correção técnica (item 38): esta segunda ocorrência do nome do ativo (a
                    primeira, na Action Bar acima, já usa AssetBadge desde a V6.5/G12-G13) ainda
                    era texto puro extraído do par — mesmo componente único de ícone, tamanho
                    pequeno pra caber ao lado do preço. */}
                <AssetBadge symbol={data.pair} size="sm" mostrarNome={false} />
                <span className="text-[12px] font-bold text-genesis-text-secondary uppercase tracking-wider">
                  {data.pair?.replace('USDT', '').replace('/', '') || ''}
                </span>
                <span className="text-sm font-mono text-white tracking-wider">
                  {formatPrice(data.market_price, tickDecimals)}
                </span>
                {/* F9 (V6.9): variação do PRÓPRIO candle analisado (data.candle_change_pct,
                    fechamento vs fechamento anterior real) — antes usava change24h (prop vinda do
                    ticker de 24h ao vivo, sem relação com o timeframe/candle desta análise, ao
                    lado de um preço — market_price acima — que já era o da própria análise). */}
                {data.candle_change_pct != null && (
                    <div className={`flex items-center gap-1 text-[11px] font-bold ${data.candle_change_pct >= 0 ? 'text-genesis-positive' : 'text-genesis-negative'}`}>
                        {data.candle_change_pct >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                        {Math.abs(data.candle_change_pct).toFixed(2)}%
                    </div>
                )}
            </div>
          )}
          {data.snapshot_observed_at && (
            <p className="text-[9px] text-gray-500 mb-4">
              preço no momento da análise · {new Date(data.snapshot_observed_at).toLocaleTimeString('pt-BR')}
            </p>
          )}

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 relative z-10">
            <div className="flex items-center gap-[16px] mb-4 md:mb-0">
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-1">Direção Provável</span>
                <div className="flex items-baseline gap-3">
                  <span className={`text-6xl font-bold ${badgeColor} tracking-tighter uppercase drop--[0_0_15px_rgba(0,0,0,0.5)]`}>
                    {directionLabel[direction] ?? direction}
                  </span>
                  {/* V6.5 (E09-E10): antes só aparecia com podeInteragir (RR/convicção baixos escondiam
                      a alavancagem inteira da tela) — agora sempre visível quando há um valor calculado.
                      V6.7 (B-17, DP-06): o número exibido é sempre a escolha do membro (o sistema não
                      reduz mais) — o alerta agora significa "acima da faixa segura", não "foi reduzida". */}
                  {(planoAtivo?.alavancagem ?? setup?.alavancagem) != null && (
                    <span
                      className={`px-3 py-1 rounded bg-white/5 text-xl font-bold font-mono ${badgeColor} inline-flex items-center gap-1.5`}
                      title={(planoAtivo?.alavancagem_info ?? setup?.alavancagem_info)?.motivo ?? undefined}
                    >
                      {planoAtivo?.alavancagem ?? setup?.alavancagem}x
                      {(planoAtivo?.alavancagem_info ?? setup?.alavancagem_info)?.excede_seguro && (
                        <AlertTriangle size={14} className="text-yellow-500" />
                      )}
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
                    {/* V6.6 (F03, DP-02): rótulo passa a exibir a escala de 100 — a barra de
                        preenchimento abaixo já usava a escala correta, não precisou mudar. */}
                    {score != null && <span className="text-lg text-gray-600">/100</span>}
                  </span>
                </div>
              </div>
              <span className={`text-xs font-bold uppercase tracking-widest mt-1 px-2 py-0.5 rounded ${isCautela ? 'bg-yellow-900/20 text-yellow-500 border-yellow-500/30' : 'bg-green-900/20 text-genesis-positive border-genesis-positive/30'}`}>
                {faixaDeConviccao(score)}
              </span>
            </div>
          </div>

          {/* V6.5 (G06): aviso permanente — convicção mede coerência entre dados, não é
              probabilidade nem recomendação. Gênesis não é sala de sinal. */}
          <p className="text-[9px] text-gray-500 mb-4 relative z-10">
            Convicção mede a coerência entre os dados observados. Não é probabilidade nem recomendação. A decisão é sua.
          </p>

          {score != null && (
            <div className="mb-5 relative z-10 w-full bg-gray-900 rounded-full h-2 overflow-hidden ">
              <div className={`h-full ${progressColor} transition-all duration-1000`} style={{width: `${score}%`}} />
            </div>
          )}

          <ScoreBasisBars
            scoreBasis={anyData.score_basis ?? null}
            derivativesContext={anyData.derivatives_context ?? null}
            direction={direction}
            macroScore={macroInfo?.score ?? null}
            sentimentScore={sentimento?.score ?? null}
            // Spec genesis-v6-10-implementacao (Fase 6, item 6.3, doc §6.3): disponível quando
            // QUALQUER campo do bloco chegou — score, números reais (VIX/DXY/S&P500,
            // Fear&Greed/dominância do BTC) ou a própria narrativa. Faltando só o score/narrativa,
            // o selo "Indisponível" não aparece mais (antes seguia só o score).
            macroDisponivel={
              macroInfo?.score != null || macroInfo?.vix != null
              || macroInfo?.dxy_change_pct != null || macroInfo?.sp500_change_pct != null
              || !!macroInfo?.resumo
            }
            sentimentDisponivel={
              sentimento?.score != null || sentimento?.fear_greed != null
              || sentimento?.btc_dominance != null || !!sentimento?.narrativa
            }
          />

          {/* V6.5 (G14): cobertura_baixa é derivado de verdade (coverage_percent < 70), nunca
              chumbado — antes a tela nem mostrava a cobertura de dados desta leitura. */}
          {analysis.cobertura_baixa && (
            <p className="mb-4 text-xs text-yellow-400 bg-yellow-500/5 border border-yellow-500/30 rounded-lg p-3 relative z-10">
              Cobertura de dados em {analysis.coverage != null ? `${analysis.coverage.toFixed(0)}%` : 'nível reduzido'}. Parte dos indicadores não estava disponível no momento desta leitura.
            </p>
          )}

          {/* V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.14, doc §18):
              a nota de rastreabilidade (G5, V6.9) saiu do card de convicção — não media nada sobre
              convicção, media cobertura de DADOS, um conceito diferente que não deveria competir
              por atenção com o número de convicção logo acima. Migrou inteira pro rodapé da tela
              como `data_traceability` (bloco DataTraceabilityFooter, mais abaixo), junto do
              frescor real por fonte que nunca tinha sido exposto antes. */}

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

          {/* V6.5 (G15, Decisão 8 do PO): separa as 3 perguntas que a tela misturava — convicção
              (direção), qualidade da entrada (localização do preço) e risco/retorno — em vez do
              membro ler o número gigante do topo como "operação aprovada". */}
          {/* Spec genesis-v6-10-implementacao (Fase 9, item 9.2, doc §9.2): cabeçalho mostra o R:R
              COMBINADO dos três alvos (parciais configuráveis, default 50/30/20), não mais o R:R
              do TP1 isolado — cada alvo continua com o seu próprio R:R nos cards abaixo
              (rrPorAlvo.tp1/tp2/tp3), sem mudança. rrAbaixoDoMinimo compara o mesmo número exibido
              aqui (combinado), nunca o TP1 isolado — evitaria a incoerência de mostrar "1:1,60
              (abaixo do mínimo)" com o aviso calculado sobre outro número. */}
          <BlocoConviccaoQualidade
            rrExibir={planoAtivo?.rr_liquido_combinado_exibir ?? setup?.rr_liquido_combinado_exibir ?? null}
            rrBrutoExibir={planoAtivo?.rr_bruto_exibir ?? setup?.rr_bruto_exibir ?? null}
            rrMinimo={planoAtivo?.rr_minimo_referencia ?? setup?.rr_minimo_referencia ?? null}
            rrAbaixoDoMinimo={planoAtivo?.rr_liquido_combinado_abaixo_do_minimo ?? setup?.rr_liquido_combinado_abaixo_do_minimo ?? false}
            parciaisAlvo={planoAtivo?.parciais_alvo ?? setup?.parciais_alvo ?? null}
            fatores={planoAtivo?.qualidade_entrada ?? setup?.qualidade_entrada ?? []}
            direcao={direction === 'SHORT' ? 'SHORT' : 'LONG'}
          />

          <div className="bg-white/5  rounded-lg p-[16px] relative z-10 flex items-start gap-3">
            <Target className={`${badgeColor} shrink-0 mt-0.5`} size={16} />
            <p className="text-sm text-gray-300 font-medium leading-relaxed">
              {scoreJustification || 'Justificativa do score indisponível.'}
            </p>
          </div>
        </div>

        {/* F1: avisos do plano ativo. NUNCA execution.avisos, que é a união dos dois planos e
            vaza o aviso do Plano B para a tela do Plano A (item 2.1, A1). */}
        {(planoAtivo?.avisos ?? []).length > 0 && (
          <div className="bg-amber-950/20 border border-amber-600/30 rounded-lg p-3 mb-6">
            {(planoAtivo?.avisos ?? []).map((a: string, i: number) => (
              <p key={i} className="text-[11px] text-amber-300 leading-relaxed">{a}</p>
            ))}
          </div>
        )}

        {/* Análise Técnica — narrativa do trader. Fora do gate de setup: o motor V6.4
            manda technical_analysis mesmo sem candidate_setup (sem stop/TP calculado). */}
        <div className="bg-[#050505] rounded-[10px] p-[16px] mb-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-4">Análise Técnica</h3>
          <p className="text-sm text-gray-300 leading-relaxed text-left whitespace-normal break-normal" style={{ wordSpacing: 'normal', letterSpacing: 'normal', hyphens: 'none', lineHeight: 1.6 }}>
            {limparTexto(technicalAnalysis || "Análise técnica indisponível.")}
          </p>
          {/* V6.6 (A04): figura gráfica identificada pelo decisor — sem figura clara no gráfico
              (DP-07), o bloco não renderiza nada. */}
          <BlocoFiguraGrafica figuras={anyData.visual_observations?.patterns ?? []} />
        </div>

        {/* E1 (V6.9): contradições objetivas entre a direção decidida e DMI/ADX/Supertrend/figura/
            tempos maiores (DirectionCoherenceGate, backend) — cada uma já custou 10 pontos reais do
            score final; a tela precisa deixar claro por quê, não só mostrar o número menor. */}
        {(anyData.contradicoes ?? []).length > 0 && (
          <div className="bg-genesis-negative/10 border border-genesis-negative/30 rounded-lg p-3 mb-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-genesis-negative shrink-0" />
              <p className="text-[11px] font-bold text-genesis-negative uppercase tracking-wider">Pontos que pesam contra esta leitura</p>
            </div>
            <ul className="space-y-1.5">
              {(anyData.contradicoes ?? []).map((c: { tipo: string; detalhe: string }, i: number) => (
                <li key={i} className="text-[11px] text-gray-300 leading-relaxed pl-3 border-l-2 border-genesis-negative/40">
                  {c.detalhe}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* R27: pipeline sempre visível (mesmo com candidate_setup vazio) — cada campo cai em
            "—"/"N/A" sozinho quando null; o gate operacional fica no botão de confirmação. */}
        {setup && (
        <>
        {/* V6.7 (C-25): recommended/motivo/reason_code chegavam no payload desde a V6.5 (E02) e
            nenhum componente lia — SEM_BARREIRA_REAL, RR_LIQUIDO_ABAIXO_MINIMO e
            CONVICCAO_ABAIXO_MINIMO ficavam invisíveis para o membro. Restrição obrigatória (DP-03/
            DP-05): este bloco só avisa, nunca desabilita nada — podeInteragir continua amarrado
            exclusivamente a execution.executable, não a recommendedAtivo.
            A8 (V6.9): reason_code (código interno tipo "RR_LIQUIDO_ABAIXO_MINIMO") saiu da tela —
            continua no payload/banco para histórico e estatística, só não é mais exibido. Manchete
            deixa de ser fixa "Plano não recomendado" quando existe um alvo posterior que já atende
            o R/R mínimo — manchetePlano() nomeia esse alvo em vez de soar como reprovação total.
            V6.9 pacote final (Fase 11, item 11.9): recommended/motivo/alvo_que_atende agora vêm do
            PLANO ATIVO (recommendedAtivo/motivoAtivo/alvoQueAtendeAtivo) — troca junto com A/B, não
            fica preso ao Plano A quando o membro seleciona o B. */}
        {!recommendedAtivo && (
          <div className="bg-amber-950/20 border border-amber-600/30 rounded-lg p-3 mb-6 flex items-start gap-2.5">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1">{manchetePlano(alvoQueAtendeAtivo, rrLiquidoCombinadoExibirAtivo)}</p>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                {publicText(motivoAtivo) || 'Esta configuração não atingiu os limiares recomendados de risco-retorno ou convicção. A decisão de seguir é sua.'}
              </p>
            </div>
          </div>
        )}

        {/* CAMADA 2: RISCO-RETORNO */}
        {/* V6.6 (F01, DF-02): card "RISCO/RETORNO (TP1)" removido — RR passa a existir só no bloco
            de convicção (ver BlocoConviccaoQualidade acima). */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-[16px] mb-6">
          {/* V6.5 (E13, resolve também G07): antes chamado "Risco Máximo", mostrando a distância até
              o stop como se fosse o risco de capital — os dois são coisas diferentes (a distância em %
              não diz quanto do saldo está em jogo; isso depende também do tamanho da posição). O risco
              de capital real fica no card "Risco de Capital (real)", com o rótulo correto. */}
          <div className="bg-[#050505]  rounded-[10px] p-[16px] flex flex-col justify-center items-center text-center relative overflow-hidden cursor-help" title="Distância percentual entre a entrada e o stop — não é quanto do seu saldo está em risco (ver Risco de Capital).">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Distância até o Stop</span>
            <span className="text-2xl font-mono text-genesis-negative font-bold">
              {(planoAtivo?.risco_preco_pct ?? setup.risco_preco_pct) != null ? `${planoAtivo?.risco_preco_pct ?? setup.risco_preco_pct}%` : '—'}
            </span>
          </div>

          <div className="bg-[#050505]  rounded-[10px] p-[16px] flex flex-col justify-center items-center text-center col-span-2 md:col-span-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Liquidação (estimada)</span>
            <span className="text-xl font-mono text-orange-400 font-bold">
              {(planoAtivo?.liquidacao ?? setup.liquidacao) != null ? formatPrice(Number(planoAtivo?.liquidacao ?? setup.liquidacao), tickDecimals) : '—'}
            </span>
          </div>

          {/* V6.5 (E13, resolve também G07): antes rotulado "Perfil da Operação" — este é o risco de
              capital de verdade (% do saldo/margem-base efetivamente em jogo, não a distância geométrica
              até o stop). Rótulo explícito pra não confundir com o card de Distância até o Stop. */}
          {/* D7 (V6.9): 'risco_margem_pct' renomeado pra 'risco_pct_capital_base' — o número sempre
              foi risco sobre o CAPITAL-BASE (saldo total informado), nunca a margem de fato
              comprometida nesta posição especificamente (nocional/alavancagem) — nome antigo
              ("margem") confundia os dois. 'risco_pct_margem' (novo) é esse número que faltava. */}
          <div className="bg-[#050505]  rounded-[10px] p-[16px] flex flex-col justify-center col-span-2 md:col-span-1" title="Risco sobre o capital-base (seu saldo total) e sobre a margem desta posição especificamente — os dois só coincidem sem alavancagem.">
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-2 text-center md:text-left">Risco de Capital (real)</span>
            <div className="w-full bg-gray-900 rounded-full h-1.5 mb-2 overflow-hidden">
              <div
                className="h-full bg-orange-400 opacity-80"
                style={{ width: `${Math.min(((planoAtivo?.risco_pct_capital_base ?? setup.risco_pct_capital_base ?? 0) / TETO_RISCO) * 100, 100)}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-gray-400 text-center md:text-left">
              {(() => {
                const riscoPctCapitalBase = planoAtivo?.risco_pct_capital_base ?? setup.risco_pct_capital_base;
                const riscoPctMargem = planoAtivo?.risco_pct_margem ?? setup.risco_pct_margem;
                const riscoUsd = planoAtivo?.risco_usd_estimado ?? setup.risco_usd_estimado;
                if (riscoPctCapitalBase == null) return 'Exposição não calculada';
                const usdSufixo = riscoUsd != null ? ` (${formatUsd(riscoUsd)})` : '';
                const margemTexto = riscoPctMargem != null ? ` · ${riscoPctMargem.toFixed(1)}% da margem desta posição` : '';
                return `${riscoPctCapitalBase.toFixed(1)}% do capital-base${usdSufixo}${margemTexto}`;
              })()}
            </span>
          </div>
        </div>

        {/* Spec genesis-v6-10-implementacao (Fase 6, item 6.7, doc §6.7): o arredondamento da
            quantidade pro stepSize real do contrato pode reduzir o risco realizado bem abaixo do
            planejado sem nenhum aviso (sintoma real do documento: $10,00 planejados viram $7,20
            realizados, 28% abaixo, e a tela mostrava só "0,7%" sem nota). Só aparece quando o
            desvio passa de 10% — abaixo disso é ruído normal de arredondamento. */}
        {(planoAtivo?.risco_desvio_pct ?? setup.risco_desvio_pct) != null && (
          <div className="bg-amber-950/20 border border-amber-600/30 rounded-[10px] p-[16px] mb-6 flex items-start gap-2" title="O arredondamento da quantidade para o lote mínimo negociável do contrato reduziu o risco realizado em relação ao planejado.">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider mb-1">Risco realizado divergente do planejado</p>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Planejado: {formatUsd(Number(planoAtivo?.risco_planejado ?? setup.risco_planejado))} · Realizado: {formatUsd(Number(planoAtivo?.risco_real ?? setup.risco_real))} ({(planoAtivo?.risco_desvio_pct ?? setup.risco_desvio_pct)}% de desvio, por causa do arredondamento da quantidade para o lote mínimo negociável).
              </p>
            </div>
          </div>
        )}

        {/* V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.10, doc §16): três
            linhas SEMPRE distintas, nunca misturadas na mesma frase — diferente do card "Risco de
            Capital (real)" acima, que mede quanto se PERDE se o stop for atingido; este mede
            quanto está TRAVADO nesta posição agora, independente de o stop ser atingido ou não. */}
        {(planoAtivo?.capital_base_usd ?? setup.capital_base_usd) != null && (
          <div className="bg-[#050505]  rounded-[10px] p-[16px] mb-6 grid grid-cols-3 gap-[16px]" title="Capital-base é o seu saldo total informado. Margem comprometida é o que esta posição especificamente trava na corretora (nocional ÷ alavancagem).">
            <div className="text-center">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Capital-base</span>
              <span className="text-sm font-mono text-white font-bold">{formatUsd(planoAtivo?.capital_base_usd ?? setup.capital_base_usd)}</span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Margem comprometida</span>
              <span className="text-sm font-mono text-white font-bold">
                {(planoAtivo?.margem_comprometida_usd ?? setup.margem_comprometida_usd) != null ? formatUsd(planoAtivo?.margem_comprometida_usd ?? setup.margem_comprometida_usd) : '—'}
              </span>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">% do capital-base</span>
              <span className="text-sm font-mono text-white font-bold">
                {(planoAtivo?.margem_comprometida_pct_capital ?? setup.margem_comprometida_pct_capital) != null ? `${(planoAtivo?.margem_comprometida_pct_capital ?? setup.margem_comprometida_pct_capital)!.toFixed(1)}%` : '—'}
              </span>
            </div>
          </div>
        )}

        {/* V6.7 (B-20): alerta explícito de liquidação — antes calculado (gerarPlanoB()) mas nunca
            publicado nem exibido. DP-03: é aviso, nunca bloqueio — o botão de confirmar continua
            habilitado, a decisão de seguir é do membro.
            D1 (V6.9): a mensagem afirmava sempre "sua posição liquida antes do stop" pros dois
            cenários de INSEGURO — mesmo quando o stop seria atingido primeiro (só sem a folga mínima
            de segurança). liquidacao_classificacao distingue os dois casos reais. */}
        {(planoAtivo?.verificacao ?? setup.verificacao) === 'INSEGURO' && (
          <div className="mb-6 -mt-3 p-3 rounded-md bg-red-950/30 border border-red-500/30 flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-red-400 leading-relaxed">
              {(planoAtivo?.liquidacao_classificacao ?? setup.liquidacao_classificacao) === 'LIQ_FOLGA_CURTA'
                ? 'Nesta alavancagem, o stop deve ser atingido primeiro, mas sem a folga mínima de segurança até a liquidação.'
                : 'Nesta alavancagem, sua posição liquida antes do stop.'}
            </p>
          </div>
        )}

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
                    disabled={!podeInteragir}
                    onClick={() => handleZoneSelect('A')}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all duration-200 ${!podeInteragir ? 'opacity-40 cursor-not-allowed' : ''} ${
                      zonaEfetiva === 'A'
                        ? 'bg-genesis-accent/10 border-genesis-accent ring-1 ring-genesis-accent'
                        : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30'
                    }`}
                  >
                    <div className="flex justify-between items-baseline mb-1">
                      <span className={`text-[10px] font-bold ${zonaEfetiva === 'A' ? 'text-genesis-accent' : 'text-gray-400'}`}>{`Plano A${planoPrimario === 'A' ? ' (Primário)' : ' (Alternativo)'}`}</span>
                      <span className="font-mono font-bold text-sm text-white">{setup.entrada != null ? formatPrice(Number(setup.entrada), tickDecimals) : '—'}</span>
                    </div>
                    <p className="text-[9px] text-gray-400 font-mono tracking-wide leading-tight mt-1">
                      Entrada a mercado no preço analisado.
                    </p>
                  </button>

                  {/* Plano B */}
                  {planoB?.entrada != null && (
                    <button
                      disabled={!podeInteragir}
                      onClick={() => handleZoneSelect('B')}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all duration-200 ${!podeInteragir ? 'opacity-40 cursor-not-allowed' : ''} ${
                        zonaEfetiva === 'B'
                          ? 'bg-genesis-accent/10 border-genesis-accent ring-1 ring-genesis-accent'
                          : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/30'
                      }`}
                    >
                      <div className="flex justify-between items-baseline mb-1">
                        <span className={`text-[10px] font-bold ${zonaEfetiva === 'B' ? 'text-genesis-accent' : 'text-gray-400'}`}>{`Plano B${planoPrimario === 'B' ? ' (Primário)' : ' (Alternativo)'}`}</span>
                        <span className="font-mono font-bold text-xs text-white">{formatPrice(Number(planoB.entrada), tickDecimals)}</span>
                      </div>
                      <p className="text-[9px] text-gray-400 font-mono tracking-wide leading-tight mt-1">
                        {planoBDescricaoCompleta}
                      </p>
                    </button>
                  )}
                  {/* V6.7 (D-29): antes a ausência do Plano B só ocultava o botão, sem explicação —
                      o membro não tinha como saber se era "não existe" ou "ainda não carregou". Com
                      D-29 (zona sempre do lado certo do preço), Plano B fica indisponível com mais
                      frequência — a tela agora explica por quê, em vez de só sumir. */}
                  {planoB?.entrada == null && (
                    <div className="w-full text-left p-2.5 rounded-lg border border-dashed border-white/10 bg-black/10">
                      <span className="text-[10px] font-bold text-gray-500">Plano B (Alternativo)</span>
                      <p className="text-[9px] text-gray-500 font-mono tracking-wide leading-tight mt-1">
                        Sem espaço estrutural para uma entrada alternativa nesta análise — a zona de
                        pullback/repique ficaria colada no preço atual ou sem uma âncora técnica
                        confiável do lado certo.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Botão de Confirmação */}
              <div className="mt-4 pt-3 border-t border-white/5 relative group">
                <button
                  disabled={!podeInteragir}
                  onClick={() => { if (onSaveTrade) onSaveTrade(planoAtivo); }}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-mono uppercase tracking-wider font-bold transition-all duration-[180ms] ${
                    !podeInteragir
                      ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                      : 'bg-genesis-accent text-black hover:bg-[#39ff14] hover:text-black hover:shadow-[0_4px_16px_rgba(57,255,20,0.25)] active:scale-[0.98]'
                  }`}
                >
                  <Shield size={14} />
                  {/* Fase 5 (item 5.4): sempre há um plano efetivo pré-selecionado (zonaEfetiva) —
                      "Selecione um Plano" nunca é mais um estado real, só "disponível"/"indisponível". */}
                  {!podeInteragir ? 'Execução não disponível' : 'Confirmar Posição'}
                </button>
                {podeInteragir && (
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
                      <span className="text-genesis-positive font-mono font-bold text-sm bg-genesis-positive/10 px-2 py-0.5 rounded">{(planoAtivo?.tp1 ?? setup.tp1) != null ? formatPrice(Number(planoAtivo?.tp1 ?? setup.tp1), tickDecimals) : '—'}</span>
                      {/* C7 (V6.9): tp1_rotulo (linguagem de trader, com toques/confluências) tem prioridade — rotularFonte(tp1_fonte) so como fallback pra decisao cacheada anterior a este item. */}
                      {(planoAtivo?.tp1_rotulo ?? setup.tp1_rotulo ?? rotularFonte(planoAtivo?.tp1_fonte ?? setup.tp1_fonte)) && <div className="text-[8px] text-gray-500 mt-0.5">{planoAtivo?.tp1_rotulo ?? setup.tp1_rotulo ?? rotularFonte(planoAtivo?.tp1_fonte ?? setup.tp1_fonte)}</div>}
                      {/* V6.7 (C-27): RR por alvo — antes só o RR do TP1 (geral) era visível na tela.
                          V6.9 pacote final (Fase 11, item 11.8): rr_por_alvo vem pronto do backend agora
                          (campos rr_bruto/rr_liquido, não bruto/liquido — utils/riscoRetorno.ts apagado).
                          Fase 13, item 13.7: rr_liquido_exibir já vem formatado ("1:%.2f") — sem
                          .toFixed(2) local, nunca duas origens de formatação divergindo. */}
                      {rrPorAlvo?.tp1.rr_liquido_exibir != null && <div className="text-[8px] text-genesis-positive/80 font-mono mt-0.5">RR {rrPorAlvo.tp1.rr_liquido_exibir}</div>}
                    </div>
                </div>
                <div className="flex justify-between items-center group">
                    <span className="text-gray-500 text-[10px] font-bold">TP2</span>
                    <div className="text-right">
                      <span className="text-genesis-positive font-mono font-bold text-sm bg-genesis-positive/10 px-2 py-0.5 rounded">{(planoAtivo?.tp2 ?? setup.tp2) != null ? formatPrice(Number(planoAtivo?.tp2 ?? setup.tp2), tickDecimals) : '—'}</span>
                      {(planoAtivo?.tp2 ?? setup.tp2) != null
                        ? ((planoAtivo?.tp2_rotulo ?? setup.tp2_rotulo ?? rotularFonte(planoAtivo?.tp2_fonte ?? setup.tp2_fonte)) && <div className="text-[8px] text-gray-500 mt-0.5">{planoAtivo?.tp2_rotulo ?? setup.tp2_rotulo ?? rotularFonte(planoAtivo?.tp2_fonte ?? setup.tp2_fonte)}</div>)
                        : ((planoAtivo?.tp2_motivo ?? setup.tp2_motivo) && <div className="text-[8px] text-gray-500 mt-0.5">{planoAtivo?.tp2_motivo ?? setup.tp2_motivo}</div>)}
                      {rrPorAlvo?.tp2.rr_liquido_exibir != null && <div className="text-[8px] text-genesis-positive/80 font-mono mt-0.5">RR {rrPorAlvo.tp2.rr_liquido_exibir}</div>}
                    </div>
                </div>
                <div className="flex justify-between items-center group">
                    <span className="text-gray-500 text-[10px] font-bold">TP3</span>
                    <div className="text-right">
                      <span className="text-genesis-positive font-mono font-bold text-sm bg-genesis-positive/10 px-2 py-0.5 rounded">{(planoAtivo?.tp3 ?? setup.tp3) != null ? formatPrice(Number(planoAtivo?.tp3 ?? setup.tp3), tickDecimals) : '—'}</span>
                      {(planoAtivo?.tp3 ?? setup.tp3) != null
                        ? ((planoAtivo?.tp3_rotulo ?? setup.tp3_rotulo ?? rotularFonte(planoAtivo?.tp3_fonte ?? setup.tp3_fonte)) && <div className="text-[8px] text-gray-500 mt-0.5">{planoAtivo?.tp3_rotulo ?? setup.tp3_rotulo ?? rotularFonte(planoAtivo?.tp3_fonte ?? setup.tp3_fonte)}</div>)
                        : ((planoAtivo?.tp3_motivo ?? setup.tp3_motivo) && <div className="text-[8px] text-gray-500 mt-0.5">{planoAtivo?.tp3_motivo ?? setup.tp3_motivo}</div>)}
                      {rrPorAlvo?.tp3.rr_liquido_exibir != null && <div className="text-[8px] text-genesis-positive/80 font-mono mt-0.5">RR {rrPorAlvo.tp3.rr_liquido_exibir}</div>}
                    </div>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex justify-center items-center w-8 text-gray-600">
              <ArrowRight size={20} strokeWidth={1.5} />
            </div>
            <div className="lg:hidden flex justify-center items-center h-8 text-gray-600">
              <ArrowDown size={20} strokeWidth={1.5} />
            </div>

            {/* Bloco 3: DEFESA DA OPERAÇÃO — V6.7 (A-14): único ponto de renderização do stop da
                análise, três estados (VALID/VALID_WIDE/STOP_UNAVAILABLE). Plano A e Plano B são
                avaliados separadamente — pode existir A VALID com B STOP_UNAVAILABLE.
                D4 (V6.9): invalidação da tese e stop de proteção são dois conceitos DIFERENTES (a
                tese perde validade num nível estrutural; o stop fica um colchão de segurança além
                dele, pra não ser tirado por ruído) que a tela mostrava em duas caixas separadas, sem
                dizer que um é derivado do outro — reorganizado num bloco só, com a relação explícita
                (stop = invalidação + colchão de segurança). */}
            <div className="w-full lg:w-1/3 bg-white/[0.02]  rounded-lg p-5 border-l-genesis-negative hover:bg-red-950/20 transition-colors relative h-full min-h-[140px]">
              <span className="text-[10px] font-bold text-genesis-negative uppercase tracking-widest block mb-3">Defesa da Operação</span>

              {stopStatusAtivo === 'STOP_UNAVAILABLE' ? (
                // Sem stop, alavancagem/liquidação/tamanho/RR não existem (todos null no payload,
                // já renderizam '—' sozinhos nos outros blocos). O botão de confirmar continua
                // habilitado (DP-03) — podeInteragir depende só de execution.executable.
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  {/* V6.9 correção técnica (item 34): texto de fallback local alinhado ao literal
                      exato do backend (NivelService::MENSAGEM_STOP_INDISPONIVEL) — na prática
                      nunca é usado (o backend sempre preenche stop_motivo neste status), mantido
                      só como defesa contra uma decisão cacheada de antes desta correção. */}
                  {stopMotivoAtivo || 'Stop estrutural indisponível. Não foi identificado um nível de proteção com lastro dentro do horizonte operacional desta análise. Se decidir executar a entrada, defina o stop de acordo com a sua estratégia antes de dimensionar a posição.'}
                </p>
              ) : (
                <>
                  {/* D4: invalidação primeiro — é o nível estrutural que define tudo o resto (o
                      "porquê"); o stop (abaixo) é a consequência prática dele (o "como operar").
                      Spec genesis-v6-10-implementacao (Fase 6, item 6.6, doc §6.6): "Invalidação da
                      tese" (rótulo antigo) renomeado pra "Invalidação da operação" — é a âncora que
                      nega ESTA entrada, nunca foi sobre a tese de mercado em si (esse conceito
                      próprio vem nos dois blocos condicionais abaixo). */}
                  <div className="bg-red-950/30 p-3 rounded border-red-900/50 mb-2">
                    <span className="text-[9px] font-bold text-genesis-negative/80 block mb-1.5 uppercase tracking-wider">
                      Invalidação da operação
                    </span>
                    <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                      {invalidacaoAtiva || "Zona de invalidação não calculada."}
                    </p>
                    {stopAncoraAtiva && (
                      <p className="text-[9px] text-gray-500 font-mono mt-1">
                        Nível: {rotularFonte(stopAncoraAtiva.tipo)} em {formatPrice(stopAncoraAtiva.valor, tickDecimals)}
                      </p>
                    )}
                  </div>

                  {/* Fase 6 (item 6.6): dois níveis a mais, já publicados pelo backend — cada um só
                      aparece quando existe um nível real (nunca "indisponível" no lugar). */}
                  {invalidacaoEstruturaTexto && (
                    <div className="bg-red-950/20 p-3 rounded border-red-900/30 mb-2">
                      <span className="text-[9px] font-bold text-genesis-negative/60 block mb-1.5 uppercase tracking-wider">
                        Invalidação da estrutura
                      </span>
                      <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                        {invalidacaoEstruturaTexto}
                      </p>
                    </div>
                  )}
                  {invalidacaoTeseTexto && (
                    <div className="bg-red-950/20 p-3 rounded border-red-900/30 mb-2">
                      <span className="text-[9px] font-bold text-genesis-negative/60 block mb-1.5 uppercase tracking-wider">
                        Invalidação da tese
                      </span>
                      <p className="text-[10px] text-gray-400 font-mono leading-relaxed">
                        {invalidacaoTeseTexto}
                      </p>
                    </div>
                  )}

                  <div className="mb-1 mt-2 flex items-baseline gap-2">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Stop de proteção</span>
                    <span className="text-2xl font-mono text-genesis-negative font-bold drop--[0_0_8px_rgba(239,68,68,0.4)]">{(planoAtivo?.stop ?? setup.stop) != null ? formatPrice(Number(planoAtivo?.stop ?? setup.stop), tickDecimals) : '—'}</span>
                  </div>

                  {/* D4: relação explícita — o stop nunca é um número solto, é sempre a invalidação
                      mais um colchão de segurança contra ruído/pavio. */}
                  {stopAncoraAtiva && stopBufferAtivo && (
                    <p className="text-[9px] text-gray-500 font-mono mb-2">
                      = invalidação ({formatPrice(stopAncoraAtiva.valor, tickDecimals)}) {invalidacaoDirecao === 'abaixo' ? '−' : '+'} colchão de {formatPrice(stopBufferAtivo.valor, tickDecimals)} ({rotularComponenteBuffer(stopBufferAtivo.componente_vencedor)})
                    </p>
                  )}

                  {stopStatusAtivo === 'VALID_WIDE' && (
                    <div className="mb-2 flex items-start gap-1.5 bg-amber-950/20 border border-amber-600/30 rounded px-2 py-1.5">
                      <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-[9px] text-amber-300 leading-relaxed">Stop mais largo que o normal. Reduza o tamanho e a alavancagem.</span>
                    </div>
                  )}
                  {/* V6.9 correção técnica (item 34): "fallback estrutural" — o stop existe, mas não
                      veio da escolha específica da IA (stop_motivo só vem preenchido nesse caso,
                      NivelService::stop()); o código interno some, só a consequência em linguagem
                      humana aparece. */}
                  {stopMotivoAtivo && (
                    <div className="mb-2 flex items-start gap-1.5 bg-white/[0.03] border border-white/10 rounded px-2 py-1.5">
                      <AlertTriangle size={11} className="text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-[9px] text-gray-400 leading-relaxed">{stopMotivoAtivo}</span>
                    </div>
                  )}
                  {/* V6.6 (F08): "Condição de Disparo" mostrava executionLabel[execution.status] —
                      repetição do status pela terceira vez na tela (F01 já removeu as outras duas), e
                      nenhuma das duas frases do status ("Execução não recomendada...", "Condições
                      matemáticas atendidas") é de fato uma condição de disparo. O conteúdo real da
                      condição de entrada do Plano B (zona + descrição do motor) já aparece no card do
                      seletor de plano acima (planoBDescricaoCompleta) — campo removido daqui em vez de
                      duplicado. */}
                </>
              )}
            </div>
          </div>

          {/* BLOCO 6 - TAMANHO DE POSICAO SUGERIDO */}
          {stopStatusAtivo !== 'STOP_UNAVAILABLE' && (
          <div className="mt-6 pt-5 border-t border-white/[0.05]">
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                TAMANHO SUGERIDO
              </span>

              {tamanhoSugeridoTexto ? (
                <span className="text-[10px] text-white font-mono">{tamanhoSugeridoTexto}</span>
              ) : (
                <span className="text-[10px] text-gray-500 italic">Informe o valor de entrada no formulário para calcular o tamanho da posição</span>
              )}
            </div>
          </div>
          )}

        </div>
        </>)}

        {/* CAMADA 4: FUNDAMENTAÇÃO (Avançada). Fora do gate de setup: indicadores,
            macro e sentimento vêm de informative_context, independente de haver
            candidate_setup (o motor V6.4 não calcula entrada/stop/TP). */}
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
                {/* F2 (V6.9): faixa de referência em português (FaixasIndicador, backend) — número
                    cru não diz nada pra quem não decorou os limiares padrão do indicador. */}
                {anyData.indicadores?.rsi_faixa && (
                  <p className="text-[8px] text-gray-500 -mt-2">{anyData.indicadores.rsi_faixa}</p>
                )}

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">ADX</span>
                    {anyData.indicadores?.fontes?.adx === 'API' && <span className="text-[8px] bg-genesis-positive/20 text-genesis-positive border border-genesis-positive/30 px-1 py-0.5 rounded">API</span>}
                    {(anyData.indicadores?.fontes?.adx === 'GRAFICO' || anyData.indicadores?.fontes?.adx === 'OCR') && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1 py-0.5 rounded">OCR</span>}
                    {anyData.indicadores?.fontes?.adx === 'INDISPONIVEL' && <span className="text-[8px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1 py-0.5 rounded">N/D</span>}
                  </div>
                  <span className="text-[10px] text-white font-mono">{anyData.indicadores?.adx ? Number(anyData.indicadores.adx).toFixed(1) : "N/A"}</span>
                </div>
                {anyData.indicadores?.adx_faixa && (
                  <p className="text-[8px] text-gray-500 -mt-2">{anyData.indicadores.adx_faixa}</p>
                )}

                {/* V6.8 (spec genesis-v6-8-correcao-tecnica, Fase 7, CODE-P1-07): DMI completo —
                    antes só o ADX chegava à tela; +DI/-DI/inclinação ficam presos no gate de
                    "zero não é null" (DP-11), mesmo padrão do resto do painel. */}
                <div className="flex justify-between items-center group">
                  <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">+DI / -DI</span>
                  <span className="text-[10px] text-white font-mono">
                    {anyData.indicadores?.plus_di != null ? Number(anyData.indicadores.plus_di).toFixed(1) : "N/D"}
                    {' / '}
                    {anyData.indicadores?.minus_di != null ? Number(anyData.indicadores.minus_di).toFixed(1) : "N/D"}
                  </span>
                </div>
                {anyData.indicadores?.di_faixa && (
                  <p className="text-[8px] text-gray-500 -mt-2">{anyData.indicadores.di_faixa}</p>
                )}

                {/* F2 (V6.9): selo só aparece quando o ADX já está em tendência estabelecida
                    (≥ 20) E subindo — antes mostrava "Sim"/"Não" mesmo com ADX 13, sugerindo
                    relevância que o dado não tinha (FaixasIndicador::adxEmElevacaoRelevante()). */}
                {anyData.indicadores?.adx_em_elevacao_relevante && (
                  <div className="flex justify-between items-center group">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">ADX em elevação</span>
                    <span className="text-[10px] font-mono text-genesis-positive">Sim</span>
                  </div>
                )}

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">ATR</span>
                    {anyData.indicadores?.fontes?.atr === 'API' && <span className="text-[8px] bg-genesis-positive/20 text-genesis-positive border border-genesis-positive/30 px-1 py-0.5 rounded">API</span>}
                    {(anyData.indicadores?.fontes?.atr === 'GRAFICO' || anyData.indicadores?.fontes?.atr === 'OCR') && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1 py-0.5 rounded">OCR</span>}
                    {anyData.indicadores?.fontes?.atr === 'INDISPONIVEL' && <span className="text-[8px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1 py-0.5 rounded">N/D</span>}
                  </div>
                  {/* V6.9 correção técnica (item 35): toFixed(4) cru removido — mesmo formatador
                      canônico (utils/canonicalMoney.ts) que entrada/stop/TPs já usam, com o
                      mesmo tickDecimals real do contrato, nunca uma precisão fixa arbitrária. */}
                  <span className="text-[10px] text-white font-mono">{anyData.indicadores?.atr != null ? formatPrice(Number(anyData.indicadores.atr), tickDecimals) : "N/D"}</span>
                </div>

                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">EMAs (21/50/200)</span>
                    {anyData.indicadores?.fontes?.ema21 === 'API' && <span className="text-[8px] bg-genesis-positive/20 text-genesis-positive border border-genesis-positive/30 px-1 py-0.5 rounded">API</span>}
                    {(anyData.indicadores?.fontes?.ema21 === 'GRAFICO' || anyData.indicadores?.fontes?.ema21 === 'OCR') && <span className="text-[8px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1 py-0.5 rounded">OCR</span>}
                    {anyData.indicadores?.fontes?.ema21 === 'INDISPONIVEL' && <span className="text-[8px] bg-gray-500/20 text-gray-400 border border-gray-500/30 px-1 py-0.5 rounded">N/D</span>}
                  </div>
                  {/* V6.7 (G-46): guard antigo era "||" — bastava 1 EMA existir pras 3 serem formatadas,
                      e Number(null) é 0, então EMA ausente virava "$ 0" (viola DP-11: ausência é null,
                      nunca zero). Cada EMA agora é avaliada individualmente; ausente renderiza N/D. */}
                  <span className="text-[9px] text-white font-mono">
                    {anyData.indicadores?.ema21 != null ? formatPrice(Number(anyData.indicadores.ema21), tickDecimals) : 'N/D'}
                    {' | '}
                    {anyData.indicadores?.ema50 != null ? formatPrice(Number(anyData.indicadores.ema50), tickDecimals) : 'N/D'}
                    {' | '}
                    {anyData.indicadores?.ema200 != null ? formatPrice(Number(anyData.indicadores.ema200), tickDecimals) : 'N/D'}
                  </span>
                </div>

                {/* WYCKOFF */}
                <div className="flex justify-between items-center group">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Wyckoff</span>
                  </div>
                  <span className={`text-[10px] font-mono ${anyData.wyckoff?.cor || 'text-white'}`}>
                    {/* Fase 6 (item 6.1): `||` caía pra chave crua (`anyData.wyckoff?.fase`) antes
                        de chegar em 'N/A', porque a chave truthy vencia o operador — nunca chegava
                        a proteger contra fase desconhecida. `??` só cai no fallback quando a busca
                        no dicionário for null/undefined. */}
                    {WYCKOFF_LABEL[anyData.wyckoff?.fase] ?? 'Fase não classificada'}
                  </span>
                </div>

                {/* SESSÃO */}
                <div className="flex justify-between items-center group">
                  <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Sessão</span>
                  <span className={`text-[10px] font-mono ${anyData.sessao?.cor || 'text-white'}`}>
                    {(anyData.sessao?.nome && SESSAO_LABEL[anyData.sessao.nome]) || anyData.sessao?.nome || 'N/A'}
                  </span>
                </div>

                {/* DERIVATIVOS — V6.8 (Fase 7, CODE-P1-06): derivatives_context sempre chegou pronto
                    da API (força/risco de squeeze) e nenhum componente da tela o exibia. */}
                {anyData.derivatives_context && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">Derivativos</span>
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                        anyData.derivatives_context.strength === 'STRENGTHENS' ? 'text-genesis-positive bg-genesis-positive/10'
                        : anyData.derivatives_context.strength === 'WEAKENS' ? 'text-genesis-negative bg-genesis-negative/10'
                        : 'text-gray-400 bg-white/5'
                      }`}>
                        {anyData.derivatives_context.strength === 'STRENGTHENS' ? 'Reforça a leitura'
                          : anyData.derivatives_context.strength === 'WEAKENS' ? 'Enfraquece a leitura'
                          : anyData.derivatives_context.strength === 'NEUTRAL' ? 'Neutro'
                          : 'Indisponível'}
                      </span>
                    </div>
                    {anyData.derivatives_context.squeeze_risk && anyData.derivatives_context.squeeze_risk !== 'NONE' && anyData.derivatives_context.squeeze_risk !== 'UNAVAILABLE' && (
                      <div className="mb-2 flex items-center gap-1.5 text-yellow-500">
                        <AlertTriangle size={10} />
                        <span className="text-[9px] font-mono uppercase">
                          Risco de squeeze: {anyData.derivatives_context.squeeze_risk === 'BOTH' ? 'ambos os lados' : anyData.derivatives_context.squeeze_risk === 'LONG_SQUEEZE' ? 'squeeze de comprados' : 'squeeze de vendidos'}
                        </span>
                      </div>
                    )}
                    {anyData.derivatives_context.summary && (
                      <p className="text-[9.5px] text-gray-400 leading-relaxed">{anyData.derivatives_context.summary}</p>
                    )}
                  </div>
                )}

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
                            {/* V6.9 correção técnica (item 36): "1M" cru era visualmente idêntico a
                                "1m" (minuto) depois do CSS uppercase — rotularTimeframe() expande
                                1W/1M por extenso, o resto (15m/1h/4h/1d...) não muda. */}
                            <span className="text-[9px] font-bold uppercase">{rotularTimeframe(tf.timeframe)}</span>
                            <span className="text-[9px] font-mono font-bold">{BIAS_LABEL[tf.bias] ?? '—'}</span>
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
              {/* V6.8 (Fase 7, CODE-P1-08): números brutos (VIX/DXY/S&P 500) ao lado da narrativa —
                  antes só o texto resumido chegava à tela, os valores em si nunca apareciam. */}
              {(macroInfo?.vix != null || macroInfo?.dxy_change_pct != null || macroInfo?.sp500_change_pct != null) && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {/* G11 (V6.9): VIX é nível (não variação) — ao lado de dois indicadores em %
                      sem rótulo de grandeza, o número cru sugeria a mesma unidade dos outros dois. */}
                  <div className="bg-black/40 rounded px-2 py-1.5 text-center">
                    <span className="text-[8px] text-gray-600 uppercase font-bold block">VIX (nível)</span>
                    <span className="text-[10px] text-white font-mono">{macroInfo?.vix != null ? Number(macroInfo.vix).toFixed(2) : 'N/D'}</span>
                  </div>
                  <div className="bg-black/40 rounded px-2 py-1.5 text-center">
                    <span className="text-[8px] text-gray-600 uppercase font-bold block">DXY (var. 24h)</span>
                    <span className={`text-[10px] font-mono ${macroInfo?.dxy_change_pct == null ? 'text-white' : macroInfo.dxy_change_pct >= 0 ? 'text-genesis-positive' : 'text-genesis-negative'}`}>
                      {macroInfo?.dxy_change_pct != null ? `${Number(macroInfo.dxy_change_pct) >= 0 ? '+' : ''}${Number(macroInfo.dxy_change_pct).toFixed(2)}%` : 'N/D'}
                    </span>
                  </div>
                  <div className="bg-black/40 rounded px-2 py-1.5 text-center">
                    <span className="text-[8px] text-gray-600 uppercase font-bold block">S&P 500 (var. 24h)</span>
                    <span className={`text-[10px] font-mono ${macroInfo?.sp500_change_pct == null ? 'text-white' : macroInfo.sp500_change_pct >= 0 ? 'text-genesis-positive' : 'text-genesis-negative'}`}>
                      {macroInfo?.sp500_change_pct != null ? `${Number(macroInfo.sp500_change_pct) >= 0 ? '+' : ''}${Number(macroInfo.sp500_change_pct).toFixed(2)}%` : 'N/D'}
                    </span>
                  </div>
                </div>
              )}
              {/* Spec genesis-v6-10-implementacao (Fase 6, item 6.2, doc §6.2): "(orçamento de IA
                  esgotado ou serviço fora do ar)" removido — estado interno (orçamento, serviço,
                  fila, endpoint) vai pro log, nunca pro membro. Card de Sentimento (abaixo) já
                  estava limpo desde uma sessão anterior; só este de Macro ainda vazava o motivo. */}
              <p className={`text-[10px] text-gray-400 leading-relaxed mb-4 mt-3 ${!macroInfo?.resumo ? 'italic' : ''}`}>
                  {publicText(macroInfo?.resumo) || "Contexto informativo indisponível para esta análise."}
              </p>
              {/* V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.1/11.4, doc §16):
                  achado real — eventos sempre foram objetos com fonte/URL/horário reais
                  (GeminiContextService, backend), nunca strings soltas; renderizar {evt} direto
                  quebraria assim que macro.eventos viesse populado (React não renderiza objeto cru
                  como filho). Mostra o título com a fonte, linkado quando há source_url. */}
              {macroInfo?.eventos && macroInfo.eventos.length > 0 && (
                <div className="space-y-3">
                  {macroInfo.eventos.map((evt, idx: number) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-genesis-accent mt-0.5">•</span>
                        <p className="text-[9.5px] text-gray-400 leading-relaxed font-mono">
                          {evt.title}
                          {evt.source && (
                            <span className="text-gray-600">
                              {' — '}
                              {evt.source_url ? (
                                <a href={evt.source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-genesis-accent">{evt.source}</a>
                              ) : evt.source}
                            </span>
                          )}
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
              {/* V6.8 (Fase 7, CODE-P1-08): Fear & Greed (índice do mercado, alternative.me) e
                  dominância do BTC — números distintos do score de narrativa acima, nunca chegavam
                  à tela apesar de sempre virem prontos da API. */}
              {(sentimento?.fear_greed != null || sentimento?.btc_dominance != null) && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-black/40 rounded px-2 py-1.5 text-center">
                    <span className="text-[8px] text-gray-600 uppercase font-bold block">Fear &amp; Greed</span>
                    <span className="text-[10px] text-white font-mono">
                      {sentimento?.fear_greed != null ? `${sentimento.fear_greed}/100 · ${faixaFearGreed(sentimento.fear_greed)}` : 'N/D'}
                    </span>
                  </div>
                  <div className="bg-black/40 rounded px-2 py-1.5 text-center">
                    <span className="text-[8px] text-gray-600 uppercase font-bold block">Dominância BTC</span>
                    <span className="text-[10px] text-white font-mono">{sentimento?.btc_dominance != null ? `${Number(sentimento.btc_dominance).toFixed(1)}%` : 'N/D'}</span>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-gray-400 leading-relaxed mb-4  pb-3 mt-3">
                  {publicText(sentimento?.narrativa) || "Contexto informativo indisponível para esta análise."}
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

          {/* V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.14, doc §18):
              rastreabilidade completa de dados no rodapé — o número solto de cobertura que antes
              morava dentro do card de convicção agora vive aqui, junto do frescor real por fonte.
              Sempre visível (fora de showIndicators), nunca disputa atenção com o score. */}
          {dataTraceability && (
            <div className="mt-6 pt-4  text-[9px] text-gray-500 relative z-10 flex flex-wrap gap-x-4 gap-y-1">
              {dataTraceability.decision_coverage_percent != null && (
                <span>Cobertura de decisão: {dataTraceability.decision_coverage_percent}/100</span>
              )}
              {dataTraceability.freshness_coverage_percent != null && dataTraceability.fresh_sources != null && dataTraceability.expected_sources != null && (
                <span>Frescor das fontes: {dataTraceability.freshness_coverage_percent}% ({dataTraceability.fresh_sources}/{dataTraceability.expected_sources})</span>
              )}
              {dataTraceability.as_of_ms != null && (
                <span>Referência: {new Date(dataTraceability.as_of_ms).toLocaleString('pt-BR')}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisResult;
