import React, { useState, useRef } from 'react';
import { BrainCircuit, RefreshCw, Activity, CheckCircle, AlertTriangle, Target, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const QUESTIONS_DATA = [
  { title: "O PESO DA REALIZAÇÃO", text: "Fecho lucros pequenos por medo de o mercado virar, mas seguro posições perdedoras longas na esperança de voltarem.", desc: "Avalia se você tem pressa para garantir qualquer lucro, mas não aceita assumir o prejuízo financeiro." },
  { title: "FUGA DA LIQUIDAÇÃO", text: "Adiciono margem (preço médio para trás) em uma posição perdedora para afastar meu preço de liquidação.", desc: "Avalia a sua tendência de aumentar o risco em uma operação ruim apenas para evitar o stop." },
  { title: "CEGUEIRA FINANCEIRA", text: "Foco mais no valor financeiro negativo em dólares (PNL) do que na estrutura gráfica quando estou perdendo.", desc: "Mede o quanto olhar para o dinheiro sumindo distorce a sua capacidade de ler o gráfico friamente." },
  { title: "ASSIMETRIA EMOCIONAL", text: "Sinto uma dor psicológica muito maior ao tomar um stop loss do que a alegria ao atingir um take profit do mesmo valor.", desc: "Verifica se a dor da perda destrói o seu psicológico com mais força do que a vitória o motiva." },
  { title: "SOBRECARGA DE ESTRESSE", text: "Sinto taquicardia, suor ou tensão muscular ao operar com alavancagem alta ou posição grande.", desc: "Avalia como o seu corpo responde fisicamente sob a pressão do excesso de alavancagem." },
  { title: "REFLEXO DO PÂNICO", text: "Fecho operações no susto só porque vi um candle de 1 minuto ir contra minha posição.", desc: "Mede a impulsividade de fechar uma ordem motivada apenas pelo susto de um movimento de curtíssimo prazo." },
  { title: "PESO DA MÃO", text: "Minha clareza mental e leitura gráfica pioram significativamente quando aumento o tamanho da minha mão.", desc: "Verifica se colocar muito dinheiro ou alavancagem na mesa afeta o seu julgamento técnico." },
  { title: "PARALISIA DECISÓRIA", text: "Fico paralisado e não consigo agir quando o mercado dá um pico repentino contra mim.", desc: "Avalia se você sofre de congelamento mental e incapacidade de clicar diante de extrema volatilidade." },
  { title: "VÍCIO OPERACIONAL", text: "Continuo abrindo novas operações mesmo após já ter atingido minha meta diária.", desc: "Mede a sua incapacidade de parar de operar, caracterizando vício ou overtrading." },
  { title: "SÍNDROME DA TELA ATIVA", text: "Abro operações por tédio ou impaciência quando o mercado está lateralizado, inventando setups.", desc: "Avalia a propensão a criar falsas entradas motivadas puramente pela vontade de clicar." },
  { title: "IMPULSO DE VINGANÇA", text: "Após tomar um stop loss, abro outra ordem em menos de 5 minutos tentando recuperar o dinheiro perdido.", desc: "Mede a urgência emocional de recuperar o capital imediatamente após uma perda." },
  { title: "FADIGA DE DECISÃO", text: "Devolvo os lucros da manhã porque não consigo fechar a plataforma à tarde ou à noite.", desc: "Verifica a perda de disciplina gerada pelo cansaço mental de ficar muito tempo olhando o gráfico." },
  { title: "TRANSFERÊNCIA DE CULPA", text: "Quando tomo um stop, minha primeira reação é culpar a manipulação do mercado ou a corretora.", desc: "Avalia a dificuldade do seu ego em assumir a responsabilidade por um erro puramente técnico." },
  { title: "ILUSÃO DO MERCADO", text: "Após dias seguidos de lucro, aumento minha alavancagem desproporcionalmente achando o mercado fácil.", desc: "Mede o excesso de confiança injustificado e o relaxamento do gerenciamento de risco." },
  { title: "QUEBRA DE CONFIANÇA", text: "Após uma sequência de perdas, perco totalmente a confiança e não clico nem quando meu setup aparece.", desc: "Verifica o excesso de hesitação e o medo de executar a técnica após dias ruins." },
  { title: "EGO OPERACIONAL", text: "Acredito que meu controle emocional é superior ao da maioria, mesmo quando minha conta fecha no negativo.", desc: "Avalia o grau de autoconfiança ilusória em contraste com os resultados reais da sua conta." }
];

interface MindMetricsResult {
  score_operacional: number;
  perfil_identificado: string;
  sub_perfil: string;
  diagnostico_executivo: string;
  pontos_fortes: string[];
  pontos_fracos: string[];
  plano_acao_estrategico: {
    gestao_capital: string;
    disciplina_operacional: string;
    regra_bloqueio: string;
  };
  embasamento_tecnico: {
    teoria_aplicada: string;
    explicacao: string;
  };
  dados_grafico_pizza: {
    aversao_perda_percentual: number;
    controle_estresse_percentual: number;
    fadiga_decisao_percentual: number;
    ilusao_competencia_percentual: number;
  };
  raw_scores?: {
    p1: number;
    p2: number;
    p3: number;
    p4: number;
  };
}

const generateResult = (answers: number[]): MindMetricsResult => {
  // 1. Raw Scores (4 to 20 per pillar)
  const rawP1 = answers.slice(0, 4).reduce((a, b) => a + b, 0);
  const rawP2 = answers.slice(4, 8).reduce((a, b) => a + b, 0);
  const rawP3 = answers.slice(8, 12).reduce((a, b) => a + b, 0);
  const rawP4 = answers.slice(12, 16).reduce((a, b) => a + b, 0);

  // 2. Consistency Index (1.2)
  let inconsistencies = 0;
  if (Math.abs(answers[0] - answers[3]) > 2) inconsistencies++;
  if (Math.abs(answers[8] - answers[11]) > 2) inconsistencies++;
  if (Math.abs(answers[12] - answers[15]) > 2) inconsistencies++;
  const reliabilityFactor = 1 - (inconsistencies * 0.05); // Max 15% penalty

  // 3. Structural vs Momentary (1.3)
  const structuralRisk = (rawP1 + rawP4) / 40; // 0.2 to 1.0
  const momentaryRisk = (rawP2 + rawP3) / 40; // 0.2 to 1.0

  // 4. Adaptive Weights (3.1, 3.2)
  let wP1 = 1, wP2 = 1, wP3 = 1, wP4 = 1;
  if (rawP3 >= 15) { wP3 = 1.5; wP2 = 1.2; } // Fadiga eleva peso do estresse e dela mesma
  if (rawP4 >= 15) { wP4 = 1.3; } // Excesso de confiança

  const totalWeight = wP1 + wP2 + wP3 + wP4;
  const weightedRisk = ((rawP1 * wP1) + (rawP2 * wP2) + (rawP3 * wP3) + (rawP4 * wP4)) / totalWeight;

  // 5. Final Score Calculation (2.1)
  let baseScore = 100 - ((weightedRisk - 4) / 16) * 100;
  baseScore = baseScore * reliabilityFactor;
  
  // Simulated real data integration penalty (Divergence between discourse and behavior)
  if (answers[15] >= 4 && structuralRisk > 0.6) {
    baseScore -= 5;
  }

  const score_operacional = Math.max(0, Math.min(100, Math.round(baseScore)));

  // Sub-levels
  let severity = '';
  if (score_operacional <= 40) severity = 'Risco Crítico';
  else if (score_operacional <= 60) severity = 'Instável';
  else if (score_operacional <= 75) severity = 'Vulnerável';
  else if (score_operacional <= 85) severity = 'Controlado';
  else severity = 'Blindado';

  const pilares = [
    { id: 1, name: 'Aversão à Perda', score: rawP1, theory: 'Aversão Assimétrica à Perda', desc: 'A dor de perder dinheiro afeta o cérebro com muito mais força do que a alegria de ganhar, fazendo o trader segurar operações ruins na esperança de empatar.' },
    { id: 2, name: 'Controle de Estresse', score: rawP2, theory: 'Sequestro da Amígdala', desc: 'O excesso de risco ativa o instinto de sobrevivência do cérebro, bloqueando o raciocínio lógico e forçando reações impulsivas de fuga ou paralisia.' },
    { id: 3, name: 'Fadiga de Decisão', score: rawP3, theory: 'Esgotamento Cognitivo', desc: 'O cérebro consome muita energia para tomar decisões. Ficar muito tempo na tela esgota essa energia, destruindo a disciplina e levando ao overtrading.' },
    { id: 4, name: 'Ilusão de Competência', score: rawP4, theory: 'Viés de Confirmação', desc: 'A mente humana tende a ignorar os próprios erros e superestimar suas habilidades, criando uma falsa sensação de controle que leva a riscos desproporcionais.' }
  ];

  let bestPilar = pilares[0];
  let worstPilar = pilares[0];

  pilares.forEach(p => {
    if (p.score < bestPilar.score) bestPilar = p;
    if (p.score > worstPilar.score) worstPilar = p;
  });

  // Overtrading Subclassification
  let overtraderType = '';
  if (rawP3 >= 14) {
    if (answers[10] >= 4) overtraderType = 'Overtrader por Recuperação (Revenge Trading)';
    else if (answers[9] >= 4) overtraderType = 'Overtrader Emocional (Síndrome da Tela Ativa)';
    else if (answers[13] >= 4) overtraderType = 'Overtrader por Excesso de Confiança';
    else overtraderType = 'Overtrader Técnico (Fadiga Crônica)';
  }

  let perfil_identificado = '';
  let sub_perfil = '';
  let diagnostico_executivo = '';
  let gestao_capital = '';
  let disciplina_operacional = '';
  let regra_bloqueio = '';

  if (worstPilar.id === 1) {
    perfil_identificado = 'Mártir da Esperança';
    sub_perfil = 'Aversão à Perda';
    diagnostico_executivo = `Causa Central: Dificuldade em aceitar o risco financeiro.\nMecanismo: Incapacidade crônica de aceitar perdas pequenas, resultando em rebaixamentos severos e corte prematuro de lucros.\nImpacto Financeiro: Drenagem de capital por recusa em acionar stops técnicos.\nSeveridade: ${severity}.`;
    gestao_capital = 'Redução obrigatória de alavancagem em 50%. Utilização exclusiva de margem ISOLADA. Proibição de fazer preço médio contra a tendência.';
    disciplina_operacional = 'Protocolo de Execução: Após posicionar a ordem e definir o Stop/Gain, feche a interface gráfica. Revise o trade apenas com o mercado fechado.';
    regra_bloqueio = 'Gatilho de Bloqueio: Atingir o Stop Diário aciona suspensão operacional de 24 horas. Afaste-se do gráfico imediatamente.';
  } else if (worstPilar.id === 2) {
    perfil_identificado = 'Reativo Emocional';
    sub_perfil = 'Sobrecarga de Estresse';
    diagnostico_executivo = `Causa Central: Operação acima do limite de conforto psicológico.\nMecanismo: Resposta emocional automática sob pressão devido ao tamanho inadequado da posição, prejudicando a clareza analítica.\nImpacto Financeiro: Saídas prematuras e paralisia diante da volatilidade.\nSeveridade: ${severity}.`;
    gestao_capital = 'Exposição máxima limitada a 2% do capital total por operação. Teto de alavancagem fixado em 5x até estabilização emocional.';
    disciplina_operacional = 'Protocolo de Execução: Defina o tamanho da posição baseado na volatilidade do ativo, ignorando o valor financeiro flutuante durante o trade.';
    regra_bloqueio = 'Gatilho de Bloqueio: Sentir taquicardia ou tensão muscular exige zerar a posição a mercado e fazer uma pausa obrigatória de 2 horas.';
  } else if (worstPilar.id === 3) {
    perfil_identificado = overtraderType || 'Overtrader Compulsivo';
    sub_perfil = 'Fadiga de Decisão';
    diagnostico_executivo = `Causa Central: Cansaço mental por superexposição ao mercado.\nMecanismo: Perda de autocontrole levando a entradas de baixa qualidade e devolução de lucros conquistados.\nImpacto Financeiro: Erosão de capital por excesso de taxas e operações fora do plano.\nSeveridade: ${severity}.`;
    gestao_capital = 'Manter o tamanho da mão constante. Proibição absoluta de dobrar a posição para tentar recuperar perdas.';
    disciplina_operacional = 'Protocolo de Execução: Limite máximo de 3 operações por sessão. Ao atingir a meta diária (Gain ou Loss), encerre as atividades.';
    regra_bloqueio = 'Gatilho de Bloqueio: 2 stops consecutivos ou atingir a meta diária acionam bloqueio operacional até o próximo dia.';
  } else {
    perfil_identificado = 'Especulador Iludido';
    sub_perfil = 'Viés de Confiança';
    diagnostico_executivo = `Causa Central: Desconexão entre autoavaliação e resultados reais.\nMecanismo: Atribuição de falhas a fatores externos e superestimação da própria habilidade após sequências de ganho.\nImpacto Financeiro: Aumento desproporcional de risco levando a devoluções rápidas e severas de capital.\nSeveridade: ${severity}.`;
    gestao_capital = 'Manter o tamanho da posição fixo, independentemente de sequências de vitórias. Proibido aumentar o lote após dias de lucro consecutivo.';
    disciplina_operacional = 'Protocolo de Execução: Obrigatório registrar o motivo técnico da entrada no diário de trade ANTES de executar a ordem.';
    regra_bloqueio = 'Gatilho de Bloqueio: Um dia de perda máxima (Daily Stop) exige pausa de 24 horas para reavaliação técnica.';
  }

  const getPontoForteText = (pilarId: number) => {
    switch(pilarId) {
      case 1: return 'Aceita perdas pequenas com naturalidade e deixa os lucros correrem.';
      case 2: return 'Mantém a clareza mental e a calma mesmo sob alta volatilidade.';
      case 3: return 'Respeita os limites de tela e evita operar por impulso ou tédio.';
      case 4: return 'Reconhece seus limites técnicos e evita o excesso de confiança.';
      default: return '';
    }
  };

  const getPontoFracoText = (pilarId: number) => {
    switch(pilarId) {
      case 1: return 'Dificuldade em aceitar o prejuízo, segurando posições perdedoras por esperança.';
      case 2: return 'Dificuldade em manter a clareza sob pressão, agindo por impulso ou pânico.';
      case 3: return 'Excesso de operações e incapacidade de parar após atingir metas ou limites.';
      case 4: return 'Excesso de confiança injustificado, ignorando erros e culpando o mercado.';
      default: return '';
    }
  };

  const pontos_fortes = bestPilar.score <= 10 
    ? [getPontoForteText(bestPilar.id)]
    : [`Ainda não apresenta comportamentos de alta performance consolidados. Todas as áreas necessitam de atenção, sendo a ${bestPilar.name} a menos crítica.`];

  const pontos_fracos = [
    getPontoFracoText(worstPilar.id)
  ];

  const totalRaw = rawP1 + rawP2 + rawP3 + rawP4;
  const dados_grafico_pizza = {
    aversao_perda_percentual: Math.round((rawP1 / totalRaw) * 100),
    controle_estresse_percentual: Math.round((rawP2 / totalRaw) * 100),
    fadiga_decisao_percentual: Math.round((rawP3 / totalRaw) * 100),
    ilusao_competencia_percentual: Math.round((rawP4 / totalRaw) * 100),
  };

  return {
    score_operacional,
    perfil_identificado,
    sub_perfil,
    diagnostico_executivo,
    pontos_fortes,
    pontos_fracos,
    plano_acao_estrategico: {
      gestao_capital,
      disciplina_operacional,
      regra_bloqueio
    },
    embasamento_tecnico: {
      teoria_aplicada: worstPilar.theory,
      explicacao: worstPilar.desc
    },
    dados_grafico_pizza,
    raw_scores: {
      p1: rawP1,
      p2: rawP2,
      p3: rawP3,
      p4: rawP4
    }
  };
};

const DonutChart = ({ data }: { data: { label: string, value: number, color: string }[] }) => {
  let cumulativePercent = 0;
  
  return (
    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
      {data.map(slice => {
        const strokeDasharray = `${slice.value} 100`;
        const strokeDashoffset = -cumulativePercent;
        cumulativePercent += slice.value;
        
        return (
          <circle
            key={slice.label}
            r="15.91549430918954"
            cx="18"
            cy="18"
            fill="transparent"
            stroke={slice.color}
            strokeWidth="4"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        );
      })}
    </svg>
  );
};

const MindMetrics: React.FC = () => {
  const [hasStarted, setHasStarted] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [report, setReport] = useState<MindMetricsResult | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleAnswer = (value: number) => {
    const newAnswers = [...answers, value];
    setAnswers(newAnswers);
    
    if (currentQuestionIndex < 15) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setReport(generateResult(newAnswers));
    }
  };

  const handleReset = () => {
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setReport(null);
    setHasStarted(false);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#050505',
        scale: 2,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('MindMetrics_Relatorio.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF', error);
    }
  };

  if (!hasStarted) {
    return (
      <div className="bg-[#050505] h-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 mb-12">
          <BrainCircuit className="text-genesis-accent w-8 h-8" />
          <div>
            <h2 className="text-2xl font-light text-white tracking-widest uppercase">Mind Metrics</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Análise Comportamental e Psicométrica</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center items-center">
          <div className="bg-[#0a0a0a] border-[#1a1a1a] p-12 rounded-2xl shadow-2xl relative overflow-hidden w-full max-w-3xl flex flex-col items-center">
            <div className="absolute top-0 left-0 w-full h-0.5   primary/30 "></div>
            
            <div className="text-genesis-positive/80 text-xs font-bold tracking-[0.2em] uppercase mb-6 text-center">
              ANÁLISE COMPORTAMENTAL
            </div>

            <h3 className="text-2xl text-white font-light leading-relaxed text-center mb-10">
              Mind Metrics
            </h3>

            <div className="text-gray-400 text-sm font-light text-center max-w-xl mb-12 space-y-6">
              <p>
                Mind Metrics é um mapa de comportamento operacional.<br />
                Ele identifica padrões que aparecem quando você está sob pressão, com dinheiro em risco e pouco tempo para decidir.
              </p>
              <p>
                Você responderá 16 afirmações rápidas, marcando de 1 a 5 conforme a frequência.<br />
                Ao final, você receberá um relatório com score operacional, perfil identificado e pontos de ajuste para reduzir erros repetidos.
              </p>
              <div className="text-xs space-y-2 pt-2">
                <p className="text-genesis-accent font-medium">
                  Aviso: este teste é educacional.
                </p>
                <p className="text-gray-300">
                  Ele melhora clareza e consistência, mas não substitui técnica, gerenciamento de risco ou responsabilidade individual.<br />
                  Se você julga ter dificuldades emocionais, busque um profissional.<br />
                  Cuidar da saúde mental é parte do jogo, principalmente em ambientes de pressão constante, como o mercado de derivativos.
                </p>
              </div>
            </div>
            
            <button
              onClick={() => setHasStarted(true)}
              className="bg-genesis-accent/10 hover:bg-genesis-accent hover:text-[#0a0a0a] text-genesis-accent border-genesis-accent/20 hover:border-genesis-accent px-8 py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 uppercase tracking-widest w-full max-w-md"
            >
              Iniciar análise de perfil
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (report) {
    const pieData = [
      { label: 'AVERSÃO À PERDA', value: report.dados_grafico_pizza.aversao_perda_percentual, color: '#ef4444' }, // red-500
      { label: 'CONTROLE DE ESTRESSE', value: report.dados_grafico_pizza.controle_estresse_percentual, color: '#f97316' }, // orange-500
      { label: 'FADIGA DE DECISÃO', value: report.dados_grafico_pizza.fadiga_decisao_percentual, color: '#eab308' }, // yellow-500
      { label: 'ILUSÃO DE COMPETÊNCIA', value: report.dados_grafico_pizza.ilusao_competencia_percentual, color: '#8b5cf6' } // violet-500
    ];

    return (
      <div className="bg-[#050505] h-full flex flex-col p-8 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BrainCircuit className="text-genesis-accent w-8 h-8" />
            <div>
              <h2 className="text-2xl font-light text-white tracking-widest uppercase">Mind Metrics</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Análise Comportamental e Psicométrica</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExportPDF}
              className="bg-genesis-accent/10 hover:bg-genesis-accent/20 text-genesis-accent border-genesis-accent/20 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors uppercase tracking-wider"
            >
              <Download size={14} />
              Exportar PDF
            </button>
            <button 
              onClick={handleReset}
              className="bg-white/5 hover:bg-white/10 text-gray-300  px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors uppercase tracking-wider"
            >
              <RefreshCw size={14} />
              Refazer
            </button>
          </div>
        </div>

        <div ref={reportRef} className="max-w-5xl mx-auto w-full space-y-6 pb-12">
          
          {/* Top Row: Score & Profile */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-4 bg-[#0a0a0a] border-[#1a1a1a] rounded-[10px] p-[16px] relative overflow-hidden flex flex-col justify-center items-center">
              <div className="absolute top-0 right-0 w-32 h-32 bg-genesis-accent/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-4">Score Operacional</div>
              <div className="flex items-baseline gap-2">
                <span className={`text-6xl font-sans font-bold ${report.score_operacional >= 70 ? 'text-genesis-positive' : report.score_operacional >= 40 ? 'text-red-500' : 'text-genesis-negative'}`}>
                  {report.score_operacional}
                </span>
                <span className="text-gray-500 text-sm">/ 100</span>
              </div>
            </div>
            <div className="md:col-span-8 bg-[#0a0a0a] border-[#1a1a1a] rounded-[10px] p-[16px] flex flex-col justify-center">
              <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-4">Perfil Identificado</div>
              <div className="text-3xl font-light text-white">{report.perfil_identificado}</div>
              <div className="text-sm font-light text-genesis-positive/80 mt-1">{report.sub_perfil}</div>
            </div>
          </div>

          {/* Middle Row: Diagnosis & Chart */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 bg-[#0a0a0a] border-[#1a1a1a] rounded-[10px] p-[16px]">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity size={18} className="text-genesis-accent" />
                Diagnóstico
              </h3>
              <p className="text-gray-300 leading-relaxed text-sm">
                {report.diagnostico_executivo}
              </p>
            </div>
            <div className="md:col-span-4 bg-[#0a0a0a] border-[#1a1a1a] rounded-[10px] p-[16px] flex flex-col items-center">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6 w-full text-center">Impacto por Pilar</h3>
              <div className="w-32 h-32 relative mb-6">
                <DonutChart data={pieData} />
              </div>
              <div className="w-full space-y-3">
                {pieData.map(slice => (
                  <div key={slice.label} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }}></div>
                      <span className="text-gray-400 uppercase">{slice.label}</span>
                    </div>
                    <span className="text-white font-mono">{slice.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#0a0a0a] border-genesis-positive/20 rounded-[10px] p-[16px]">
              <h3 className="text-sm font-bold text-genesis-positive uppercase tracking-widest mb-6 flex items-center gap-2">
                <CheckCircle size={18} />
                [+] Pontos Fortes
              </h3>
              <ul className="space-y-3">
                {report.pontos_fortes.map((ponto, idx) => (
                  <li key={idx} className="text-gray-300 leading-relaxed text-sm flex items-start gap-3">
                    <span className="text-genesis-positive mt-1 text-xs">●</span>
                    <span>{ponto}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#0a0a0a] border-red-500/20 rounded-[10px] p-[16px]">
              <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                <AlertTriangle size={18} />
                [-] Pontos Fracos
              </h3>
              <ul className="space-y-3">
                {report.pontos_fracos.map((ponto, idx) => (
                  <li key={idx} className="text-gray-300 leading-relaxed text-sm flex items-start gap-3">
                    <span className="text-red-500 mt-1 text-xs">●</span>
                    <span>{ponto}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Action Plan */}
          <div className="bg-[#0a0a0a] border-[#1a1a1a] rounded-[10px] p-[16px]">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-8 flex items-center gap-2">
              <Target size={18} className="text-genesis-accent" />
              Plano de Ação Estratégico
            </h3>
            <div className="space-y-8">
              <div>
                <div className="text-[10px] text-genesis-accent uppercase font-bold tracking-widest mb-2">Gestão de Capital</div>
                <div className="text-gray-300 text-sm leading-relaxed">{report.plano_acao_estrategico.gestao_capital}</div>
              </div>
              <div className="w-full h-px bg-[#1a1a1a]"></div>
              <div>
                <div className="text-[10px] text-genesis-accent uppercase font-bold tracking-widest mb-2">Disciplina Operacional</div>
                <div className="text-gray-300 text-sm leading-relaxed">{report.plano_acao_estrategico.disciplina_operacional}</div>
              </div>
              <div className="w-full h-px bg-[#1a1a1a]"></div>
              <div>
                <div className="text-[10px] text-genesis-accent uppercase font-bold tracking-widest mb-2">Regra de Bloqueio</div>
                <div className="text-gray-300 text-sm leading-relaxed">{report.plano_acao_estrategico.regra_bloqueio}</div>
              </div>
            </div>
          </div>

          {/* Technical Basis */}
          <div className="bg-[#0a0a0a] border-[#1a1a1a] rounded-[10px] p-[16px]">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Embasamento Técnico Vinculado</h3>
            <div className="text-gray-300 text-sm">
              <span className="font-bold text-white">{report.embasamento_tecnico.teoria_aplicada}:</span> {report.embasamento_tecnico.explicacao}
            </div>
          </div>

        </div>
      </div>
    );
  }

  const progress = ((currentQuestionIndex) / 16) * 100;

  return (
    <div className="bg-[#050505] h-full flex flex-col p-8">
      <div className="flex items-center gap-3 mb-12">
        <BrainCircuit className="text-genesis-accent w-8 h-8" />
        <div>
          <h2 className="text-2xl font-light text-white tracking-widest uppercase">Mind Metrics</h2>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Análise Comportamental e Psicométrica</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        {/* Progress Bar */}
        <div className="mb-16">
          <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">
            <span>Progresso</span>
            <span>{currentQuestionIndex + 1} / 16</span>
          </div>
          <div className="w-full h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div 
              className="h-full bg-genesis-accent transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Question Card */}
        <div className="flex-1 flex flex-col justify-center items-center">
          <div className="bg-[#0a0a0a] border-[#1a1a1a] p-12 rounded-2xl shadow-2xl relative overflow-hidden w-full max-w-3xl flex flex-col items-center">
            <div className="absolute top-0 left-0 w-full h-0.5   primary/30 "></div>
            
            <div className="text-genesis-positive/80 text-xs font-bold tracking-[0.2em] uppercase mb-6 text-center">
              {QUESTIONS_DATA[currentQuestionIndex].title}
            </div>

            <h3 className="text-2xl text-white font-light leading-relaxed text-center mb-6">
              "{QUESTIONS_DATA[currentQuestionIndex].text}"
            </h3>

            <div className="text-gray-500 text-sm font-light text-center max-w-xl mb-12">
              {QUESTIONS_DATA[currentQuestionIndex].desc}
            </div>
            
            <div className="grid grid-cols-5 gap-[16px] w-full">
              {[
                { val: 1, label: "Nunca" },
                { val: 2, label: "Raramente" },
                { val: 3, label: "Às vezes" },
                { val: 4, label: "Frequentemente" },
                { val: 5, label: "Sempre" }
              ].map((item) => (
                <button
                  key={item.val}
                  onClick={() => handleAnswer(item.val)}
                  className="flex flex-col items-center justify-center py-6 px-2 rounded-xl bg-[#050505] border-[#1a1a1a] hover: hover:bg-[#111] transition-all duration-200 group"
                >
                  <span className="text-3xl font-mono font-bold text-gray-400 group-hover:text-white mb-2 transition-colors">{item.val}</span>
                  <span className="text-[9px] uppercase tracking-widest font-bold text-gray-600 group-hover:text-gray-400 transition-colors text-center">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MindMetrics;
