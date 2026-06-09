
import React, { useState } from 'react';
import { CheckCircle2, ChevronRight, ShieldAlert, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center text-center w-full max-w-md mx-auto"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="w-20 h-20 bg-genesis-positive/10 rounded-full flex items-center justify-center mb-10 border border-genesis-positive/30 relative"
        >
          <div className="absolute inset-0 rounded-full bg-genesis-positive/20 blur-xl animate-pulse"></div>
          <CheckCircle2 size={40} className="text-genesis-positive relative z-10" />
        </motion.div>
        
        <h2 className="text-2xl font-light text-white uppercase tracking-widest mb-4">Consciência Validada</h2>
        
        <p className="text-white/40 text-sm max-w-sm mb-12 leading-relaxed font-light">
          Você concluiu o protocolo educacional. O ambiente profissional do Gênesis Labs agora está disponível para sua análise.
        </p>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onComplete}
          className="relative group w-full p-[1px] rounded-xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-genesis-accent via-genesis-positive to-genesis-accent rounded-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500 bg-[length:200%_auto] animate-gradient-fast"></div>
          <div className="relative bg-[#0A0A0B] hover:bg-transparent transition-colors duration-500 rounded-xl px-10 py-5 flex items-center justify-center gap-3">
             <span className="font-bold text-xs uppercase tracking-[0.2em] text-white">Acessar Terminal</span>
             <ArrowRight size={16} className="text-white group-hover:translate-x-1 transition-transform" />
          </div>
        </motion.button>
      </motion.div>
    );
  }

  const q = DECLARATIONS[currentStep];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      key={`step-${currentStep}`}
      className="w-full max-w-md mx-auto"
    >
      <div className="flex justify-between items-end mb-6">
        <div>
          <span className="text-[10px] font-bold text-genesis-accent uppercase tracking-[0.2em] block mb-2 opacity-80">Passo {currentStep + 1} de {DECLARATIONS.length}</span>
          <h3 className="text-xl font-light text-white uppercase tracking-wider">{q.title}</h3>
        </div>
        <div className="text-[10px] text-white/40 font-mono tracking-widest">{progress.toFixed(0)}%</div>
      </div>

      <div className="w-full h-px bg-white/10 mb-10 overflow-hidden relative">
        <motion.div 
          initial={{ width: `${((currentStep) / DECLARATIONS.length) * 100}%` }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-genesis-accent to-genesis-positive" 
        />
      </div>

      <div className="relative group mb-10">
        <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-b from-white/10 to-transparent transition-all duration-500"></div>
        <div className="relative bg-[#0A0A0B] p-8 rounded-xl min-h-[160px] flex items-center">
            <AnimatePresence mode="wait">
              <motion.p 
                key={currentStep}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3 }}
                className="text-white/70 text-sm leading-relaxed text-left font-light"
              >
                {q.text}
              </motion.p>
            </AnimatePresence>
        </div>
      </div>

      <div className="space-y-6">
        <label className="flex items-center gap-[16px] p-5 rounded-xl border border-white/5 bg-[#0A0A0B] hover:bg-white/[0.02] hover:border-white/10 transition-all cursor-pointer group/checkbox">
          <div className="relative w-5 h-5 flex-shrink-0">
            <input 
              type="checkbox" 
              checked={isConfirmed}
              onChange={() => setIsConfirmed(!isConfirmed)}
              className="absolute inset-0 opacity-0 cursor-pointer z-10" 
            />
            <div className={`absolute inset-0 rounded transition-all duration-300 flex items-center justify-center border ${isConfirmed ? 'bg-genesis-positive border-genesis-positive' : 'bg-transparent border-white/20 group-hover/checkbox:border-genesis-positive/50'}`}>
               <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: isConfirmed ? 1 : 0, opacity: isConfirmed ? 1 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
               >
                 <CheckCircle2 size={12} className="text-[#0A0A0B]" strokeWidth={3} />
               </motion.div>
            </div>
            {isConfirmed && (
               <div className="absolute inset-0 bg-genesis-positive/30 blur-md rounded-full -z-10"></div>
            )}
          </div>
          <span className={`text-[11px] font-bold uppercase tracking-widest select-none transition-colors duration-300 ${isConfirmed ? 'text-white' : 'text-white/40 group-hover/checkbox:text-white/70'}`}>
            Li e estou ciente.
          </span>
        </label>

        <button
          onClick={handleNext}
          disabled={!isConfirmed}
          className={`relative group w-full overflow-hidden rounded-xl p-[1px] transition-all duration-300 ${!isConfirmed ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01]'}`}
        >
          {isConfirmed && (
             <div className="absolute inset-0 bg-gradient-to-r from-white/40 to-white/10 opacity-100 group-hover:from-white/60 group-hover:to-white/20 transition-all duration-500"></div>
          )}
          {!isConfirmed && (
             <div className="absolute inset-0 bg-white/5 disabled-bg"></div>
          )}
          <div className={`relative flex items-center justify-center gap-3 w-full py-5 rounded-xl transition-all duration-300 ${isConfirmed ? 'bg-[#0A0A0B] text-white group-hover:bg-[#111111]' : 'bg-[#0A0A0B] text-white/30'}`}>
            <span className="font-bold text-xs uppercase tracking-[0.2em]">
              {currentStep === DECLARATIONS.length - 1 ? 'Finalizar Protocolo' : 'Próximo Passo'}
            </span>
            <ChevronRight size={14} className={isConfirmed ? 'text-white/60 group-hover:text-white transition-colors' : 'text-white/20'} />
          </div>
        </button>
      </div>
      
      <div className="mt-12 flex items-start gap-4 p-4 rounded-xl border border-genesis-accent/10 bg-genesis-accent/5">
        <ShieldAlert size={16} className="text-genesis-accent shrink-0 mt-0.5 opacity-80" />
        <p className="text-[9px] text-genesis-text-secondary uppercase leading-relaxed font-mono">
          Este protocolo de ciência é obrigatório para garantir o uso responsável das ferramentas educacionais do Gênesis Labs.
        </p>
      </div>
    </motion.div>
  );
};

export default EducationalQuiz;
