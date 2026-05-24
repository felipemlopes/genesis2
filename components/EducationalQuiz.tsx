
import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, ShieldAlert, ArrowRight } from 'lucide-react';

interface EducationalQuizProps {
  onComplete: () => void;
}

const DECLARATIONS = [
  {
    id: 1,
    title: "Caráter Educacional",
    text: "O Gênesis Labs é uma plataforma educacional de análise voltada ao mercado de criptoativos. As informações, ferramentas e visualizações apresentadas têm finalidade exclusivamente educacional e complementar, servindo como apoio à leitura de mercado e ao desenvolvimento do raciocínio analítico individual do usuário.",
  },
  {
    id: 2,
    title: "Ciência de Riscos",
    text: "O mercado de criptoativos envolve riscos elevados, alta volatilidade e possibilidade de perdas financeiras. Nenhuma ferramenta, tecnologia ou análise é capaz de eliminar esses riscos, que são inerentes à dinâmica do mercado.",
  },
  {
    id: 3,
    title: "Ausência de Garantia de Resultados",
    text: "As ferramentas, indicadores e análises disponibilizadas pelo Gênesis Labs não garantem resultados, não asseguram desempenho futuro e não constituem recomendações de investimento, devendo ser utilizadas exclusivamente como suporte educacional à análise individual.",
  },
  {
    id: 4,
    title: "Responsabilidade do Usuário",
    text: "Todas as decisões tomadas a partir das informações apresentadas são de responsabilidade exclusiva do usuário. O Gênesis Labs não se responsabiliza por perdas financeiras decorrentes do uso da plataforma ou das decisões tomadas com base em seus conteúdos.",
  },
  {
    id: 5,
    title: "Conformidade e Aceite",
    text: "Ao prosseguir, o usuário declara compreender o caráter educacional da plataforma, estar ciente dos riscos envolvidos e aceitar integralmente os termos de uso, assumindo total responsabilidade por suas decisões no mercado de criptoativos.",
  }
];

const EducationalQuiz: React.FC<EducationalQuizProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleNext = () => {
    if (!isConfirmed) return;
    
    if (currentStep < DECLARATIONS.length - 1) {
      setCurrentStep(prev => prev + 1);
      setIsConfirmed(false);
    } else {
      setIsFinished(true);
    }
  };

  const progress = ((currentStep + 1) / DECLARATIONS.length) * 100;

  if (isFinished) {
    return (
      <div className="flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-genesis-positive/10 rounded-full flex items-center justify-center mb-8 border-genesis-positive/20">
          <CheckCircle2 size={40} className="text-genesis-positive animate-pulse" />
        </div>
        <h2 className="text-2xl font-light text-white uppercase tracking-[0.2em] mb-4">Consciência Validada</h2>
        <p className="text-gray-400 text-sm max-w-sm mb-10 leading-relaxed">
          Você concluiu o protocolo educacional. O ambiente profissional do Gênesis Labs agora está disponível para sua análise.
        </p>
        <button 
          onClick={onComplete}
          className="bg-white text-black hover:bg-genesis-positive transition-all px-10 py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] flex items-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
        >
          Acessar Terminal <ArrowRight size={14} />
        </button>
      </div>
    );
  }

  const q = DECLARATIONS[currentStep];

  return (
    <div className="w-full max-w-md animate-in slide-in- fade-in duration-500">
      <div className="flex justify-between items-end mb-8">
        <div>
          <span className="text-[10px] font-bold text-genesis-accent uppercase tracking-widest block mb-1">Passo {currentStep + 1} de {DECLARATIONS.length}</span>
          <h3 className="text-lg font-bold text-white uppercase tracking-wider">{q.title}</h3>
        </div>
        <div className="text-[10px] text-gray-500 font-mono">{progress.toFixed(0)}%</div>
      </div>

      <div className="w-full h-1 bg-white/5 rounded-full mb-10 overflow-hidden">
        <div className="h-full bg-genesis-accent transition-all duration-500" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="bg-white/[0.02]  p-6 rounded-xl mb-10">
        <p className="text-gray-300 text-sm leading-relaxed text-left">
          {q.text}
        </p>
      </div>

      <div className="space-y-6">
        <label className="flex items-center gap-[16px] p-5 rounded-xl  bg-black hover:border-genesis-accent/30 transition-all cursor-pointer group">
          <div className="relative w-6 h-6 flex-shrink-0">
            <input 
              type="checkbox" 
              checked={isConfirmed}
              onChange={() => setIsConfirmed(!isConfirmed)}
              className="absolute inset-0 opacity-0 cursor-pointer z-10" 
            />
            <div className={`w-6 h-6 rounded transition-all flex items-center justify-center ${isConfirmed ? 'bg-genesis-positive border-genesis-positive' : 'bg-black  group-hover:'}`}>
               {isConfirmed && <CheckCircle2 size={14} className="text-black" />}
            </div>
          </div>
          <span className={`text-xs font-bold uppercase tracking-widest select-none ${isConfirmed ? 'text-white' : 'text-gray-500'}`}>
            Li e estou ciente.
          </span>
        </label>

        <button
          onClick={handleNext}
          disabled={!isConfirmed}
          className={`w-full p-5 rounded-xl transition-all flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-[0.2em]
            ${isConfirmed 
              ? 'bg-white text-black hover:bg-genesis-positive  shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
              : 'bg-white/5  text-gray-600 cursor-not-allowed'}`}
        >
          {currentStep === DECLARATIONS.length - 1 ? 'Finalizar Protocolo' : 'Próximo Passo'}
          <ChevronRight size={14} />
        </button>
      </div>
      
      <div className="mt-12 flex items-start gap-3 opacity-40">
        <ShieldAlert size={14} className="text-gray-500 shrink-0 mt-0.5" />
        <p className="text-[9px] text-gray-500 uppercase leading-relaxed font-mono">
          Este protocolo de ciência é obrigatório para garantir o uso responsável das ferramentas educacionais do Gênesis Labs.
        </p>
      </div>
    </div>
  );
};

export default EducationalQuiz;
