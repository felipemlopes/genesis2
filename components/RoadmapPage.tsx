
import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronDown, Milestone, CheckCircle2, Clock, ShieldCheck, Target, Zap } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

interface RoadmapPageProps {
  onBack: () => void;
}

interface RoadmapItem {
  period: string;
  title: string;
  status: 'completed' | 'in-progress' | 'planned';
  items: { text: string; done: boolean; description?: string }[];
  description: string;
}

const ROADMAP_DATA: RoadmapItem[] = [
  {
    period: "2025",
    title: "Fundação e Consolidação",
    status: "completed",
    description: "Estabelecimento da infraestrutura base e validação do ecossistema analítico.",
    items: [
      { text: "Registro de domínios do ecossistema Gênesis Labs", done: true },
      { text: "Registro de marca Gênesis Labs", done: true },
      { text: "Consolidação jurídica da plataforma", done: true },
      { text: "Testes iniciais realizados com membros da comunidade cripto.ico", done: true },
      { text: "Validação prática de dados e métricas de mercado", done: true },
      { text: "Desenvolvimento e consolidação da arquitetura via Dev", done: true },
      { text: "Integração de gateway de pagamento", done: true },
      { text: "Integração com Telegram", done: true },
      { text: "Integração com Last Link", done: true },
      { text: "Implementação de acesso via login e autenticação de usuários", done: true }
    ]
  },
  {
    period: "2026",
    title: "Expansão Técnica e Inteligência",
    status: "in-progress",
    description: "Foco em escala e aprofundamento das camadas de inteligência artificial.",
    items: [
      { text: "Integração com novas inteligências artificiais especializadas em leitura gráfica", done: false },
      { text: "Ampliação da capacidade de processamento para análises simultâneas", done: false },
      { text: "Integração com novas APIs de mercado e derivativos globais", done: false },
      { text: "Evolução do radar com filtros de confluência institucional", done: false },
      { text: "Aprimoramento do sistema de score educacional baseado em dados on-chain", done: false }
    ]
  },
  {
    period: "2027",
    title: "Ecossistema Avançado",
    status: "planned",
    description: "Maturação tecnológica, utilidade do ecossistema e automação total.",
    items: [
      { 
        text: "Criação do Token Gênesis", 
        done: false, 
        description: "Desenvolvimento do Token Gênesis como ativo utilitário para alimentar a infraestrutura e o ecossistema tecnológico do Gênesis Labs." 
      },
      { text: "Consolidação do Gênesis Labs como hub educacional internacional", done: false },
      { text: "Integração com novas arquiteturas de IA conforme evolução tecnológica", done: false },
      { text: "Expansão das camadas de segurança e descentralização de dados", done: false },
      { text: "Evolução contínua de UX e performance para baixa latência", done: false }
    ]
  }
];

const RoadmapPage: React.FC<RoadmapPageProps> = ({ onBack }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white selection:bg-genesis-positive selection:text-black font-sans relative overflow-x-hidden">
      {/* Animated 3D/Gradient Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          animate={{
            transform: [
              "translate3d(0px, 0px, 0) scale(1)",
              "translate3d(50px, -20px, 0) scale(1.05)",
              "translate3d(-20px, 40px, 0) scale(0.95)",
              "translate3d(0px, 0px, 0) scale(1)",
            ],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[70%] opacity-[0.05] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-genesis-accent via-genesis-accent/20 to-transparent blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            transform: [
              "translate3d(0px, 0px, 0) scale(1)",
              "translate3d(-60px, 30px, 0) scale(1.1)",
              "translate3d(30px, -50px, 0) scale(0.9)",
              "translate3d(0px, 0px, 0) scale(1)",
            ],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[70%] opacity-[0.04] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-genesis-positive via-genesis-positive/20 to-transparent blur-[120px] rounded-full"
        />
      </div>

      <div className="max-w-4xl mx-auto px-6 py-20 relative z-10">
        {/* BACK BUTTON */}
        <motion.button 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          onClick={onBack}
          className="flex items-center gap-3 text-[10px] font-semibold text-white/50 hover:text-genesis-accent uppercase tracking-[0.2em] transition-all mb-16 group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Voltar para a página inicial
        </motion.button>

        {/* HEADER SECTION */}
        <motion.header 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.8, delay: 0.2 }}
           className="mb-20"
        >
          <div className="flex items-center gap-3 text-genesis-accent mb-6">
              <Milestone size={16} />
              <span className="w-10 h-px bg-gradient-to-r from-genesis-accent/80 to-transparent"></span>
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-80">Visão de Futuro</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-light tracking-tight text-white uppercase leading-none mb-6 text-left">
            Roadmap <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/60">Gênesis</span>
          </h1>
          <p className="text-genesis-text-secondary leading-relaxed text-left max-w-2xl font-light">
            O Roadmap do Gênesis Labs reflete nosso compromisso com a evolução tecnológica contínua, infraestrutura educacional e inteligência aplicada ao mercado de criptomoedas.
          </p>
        </motion.header>

        {/* TIMELINE CONTAINER */}
        <div className="relative pl-8 md:pl-12 space-y-12 pb-20">
          {ROADMAP_DATA.map((milestone, index) => {
            const isExpanded = expandedIndex === index;
            const isCompleted = milestone.status === 'completed';

            return (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="relative group"
              >
                {/* TIMELINE NODE */}
                <div className={`absolute left-[-37px] md:left-[-53px] top-6 w-4 h-4 rounded-full transition-all duration-500 z-20 ${
                  isCompleted ? 'bg-genesis-positive border border-genesis-positive/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 
                  'bg-[#0A0A0B] border-2 border-genesis-accent shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                }`}>
                   {!isCompleted && (
                     <div className="absolute inset-0 rounded-full animate-ping bg-genesis-accent/30 scale-150 duration-1000"></div>
                   )}
                </div>

                {/* Vertical Line Connecting Nodes (Except last one) */}
                {index < ROADMAP_DATA.length - 1 && (
                  <div className="absolute left-[-30px] md:left-[-46px] top-10 bottom-[-48px] w-px bg-gradient-to-b from-white/10 to-transparent"></div>
                )}

                {/* CONTENT CARD - Styled matching the version selector/login forms */}
                <div 
                   className="relative"
                   onClick={() => toggleExpand(index)}
                >
                  <div className={`absolute -inset-[1px] rounded-[24px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 ${isExpanded ? 'from-genesis-accent to-genesis-accent/5' : 'group-hover:from-white/20'}`}></div>
                  
                  <div className={`relative bg-[#0c0c0e] rounded-[23px] transition-all duration-500 cursor-pointer overflow-hidden z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] ${isExpanded ? 'shadow-[0_0_40px_-15px_rgba(139,92,246,0.15)] bg-white/[0.02]' : 'hover:bg-white/[0.02]'}`}>
                    
                    {/* Top Lighting Line */}
                    <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent ${isExpanded ? 'via-genesis-accent/50' : 'via-white/10 group-hover:via-white/30'} to-transparent transition-all duration-700`}></div>

                    <div className="p-6 md:p-8">
                      <div className="flex justify-between items-start gap-[16px]">
                        <div className="text-left w-full">
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.2em] ${isCompleted ? 'text-genesis-positive' : 'text-genesis-accent'}`}>
                              {milestone.period} <span className="opacity-50 mx-1">•</span> {isCompleted ? 'CONCLUÍDO' : (index === 1 ? 'EM DESENVOLVIMENTO' : 'PLANEJAMENTO')}
                            </span>
                          </div>
                          <h2 className={`text-xl md:text-2xl font-light tracking-widest uppercase transition-colors text-left ${isExpanded ? 'text-white' : 'text-white/70'}`}>
                            {milestone.title}
                          </h2>
                        </div>
                        <div className={`p-2 rounded-full border border-white/5 bg-white/[0.02] transition-all duration-500 flex-shrink-0 mt-1 ${isExpanded ? 'rotate-180 text-genesis-accent border-genesis-accent/30' : 'text-white/40 group-hover:text-white group-hover:border-white/20'}`}>
                          <ChevronDown strokeWidth={1.5} size={16} />
                        </div>
                      </div>
                      
                      {!isExpanded && (
                        <p className="text-genesis-text-secondary text-sm mt-4 line-clamp-1 font-light italic text-left opacity-70">
                          {milestone.description}
                        </p>
                      )}

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-8">
                              <p className="text-white/80 text-sm mb-8 leading-relaxed text-left font-light border-l-2 border-genesis-accent/30 pl-4">
                                {milestone.description}
                              </p>

                              <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-6">
                                  <div className="h-px bg-white/10 flex-grow"></div>
                                  <div className="text-[9px] font-bold text-white/40 uppercase tracking-[0.3em] pb-1 px-4">Status da Implementação</div>
                                  <div className="h-px bg-white/10 flex-grow"></div>
                                </div>

                                {milestone.items.map((item, itemIdx) => (
                                  <div key={itemIdx} className="flex flex-col gap-2 group/item bg-[#0A0A0B] rounded-xl p-4 border border-white/5 transition-colors hover:border-white/10">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-0.5">
                                          {isCompleted ? (
                                             <CheckCircle2 size={16} className="text-genesis-positive" />
                                          ) : (
                                             <div className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-genesis-accent/50"></div>
                                             </div>
                                          )}
                                        </div>
                                        <span className={`text-sm tracking-wide transition-all text-left font-light ${
                                          isCompleted ? 'text-white/40 line-through decoration-genesis-positive/30' : 'text-white/80'
                                        }`}>
                                          {item.text}
                                        </span>
                                    </div>
                                    {item.description && (
                                        <p className="ml-8 text-[11px] text-genesis-text-secondary font-mono leading-relaxed text-left opacity-70">
                                            {item.description}
                                        </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* FOOTER DECORATION */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6"
        >
           <div className="flex items-center gap-4">
              <ShieldCheck size={16} className="text-white/60" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60 text-left">Desenvolvimento Ético & Educacional</span>
           </div>
           <p className="text-[9px] font-mono text-white/40 uppercase text-left tracking-widest">Gênesis Labs • v2.8 PRODUCT ROADMAP</p>
        </motion.div>
      </div>
    </div>
  );
};

export default RoadmapPage;
