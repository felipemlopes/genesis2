
import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronDown, Milestone, CheckCircle2, Clock, ShieldCheck, Target, Zap } from 'lucide-react';

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
    title: "Expansão Técnica e Inteligência Aplicada",
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
    title: "Ecossistema Educacional Avançado",
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
    <div className="min-h-screen bg-black text-white selection:bg-genesis-positive selection:text-black animate-in fade-in duration-1000">
      {/* BACKGROUND DECORATION */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-genesis-accent/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-genesis-positive/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-20 relative z-10">
        {/* BACK BUTTON */}
        <button 
          onClick={onBack}
          className="flex items-center gap-3 text-[10px] font-bold text-gray-500 hover:text-genesis-accent uppercase tracking-[0.2em] transition-all mb-16 group animate-in slide-in- duration-700"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Voltar para a página inicial
        </button>

        {/* HEADER SECTION */}
        <header className="mb-20 animate-in slide-in- duration-1000">
          <div className="flex items-center gap-2 text-genesis-accent mb-4">
              <Milestone size={20} />
              <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Visão de Futuro</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-thin tracking-tighter text-white uppercase leading-none mb-6 text-left">
            Roadmap <span className="font-bold text-genesis-accent">Gênesis</span>
          </h1>
          <p className="text-gray-400 leading-relaxed text-left  pl-6 max-w-2xl font-light">
            O Roadmap do Gênesis Labs reflete nosso compromisso com a evolução tecnológica contínua, infraestrutura educacional e inteligência aplicada ao mercado de criptomoedas.
          </p>
        </header>

        {/* TIMELINE CONTAINER */}
        <div className="relative pl-8 md:pl-12  space-y-12 pb-20">
          {ROADMAP_DATA.map((milestone, index) => {
            const isExpanded = expandedIndex === index;
            const isCompleted = milestone.status === 'completed';

            return (
              <div 
                key={index} 
                className="relative group reveal-item"
                style={{ animationDelay: `${(index + 1) * 150}ms` }}
              >
                {/* TIMELINE NODE */}
                <div className={`absolute left-[-37px] md:left-[-53px] top-0 w-4 h-4 rounded-full transition-all duration-500 z-20 ${
                  isCompleted ? 'bg-genesis-positive border-genesis-positive shadow-[0_0_15px_rgba(57,255,20,0.3)]' : 
                  'bg-black border-genesis-accent shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                }`}>
                   {!isCompleted && (
                     <div className="absolute inset-0 rounded-full animate-ping bg-genesis-accent/20 scale-150"></div>
                   )}
                </div>

                {/* CONTENT CARD */}
                <div 
                  className={`bg-genesis-card rounded-2xl transition-all duration-500 cursor-pointer overflow-hidden ${
                    isExpanded ? 'border-genesis-accent/30 bg-white/[0.02] shadow-2xl scale-[1.01]' : ' hover: hover:bg-white/[0.01]'
                  }`}
                  onClick={() => toggleExpand(index)}
                >
                  <div className="p-6 md:p-8">
                    <div className="flex justify-between items-start gap-[16px]">
                      <div className="text-left">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${isCompleted ? 'text-genesis-positive' : 'text-genesis-accent'}`}>
                            {milestone.period} · {isCompleted ? 'CONCLUÍDO' : (index === 1 ? 'EM DESENVOLVIMENTO' : 'PLANEJAMENTO')}
                          </span>
                          {isCompleted ? (
                            <CheckCircle2 size={12} className="text-genesis-positive" />
                          ) : (
                            <div className="relative w-3 h-3 text-genesis-accent animate-clock-rotate">
                               <Clock size={12} />
                            </div>
                          )}
                        </div>
                        <h2 className={`text-xl md:text-2xl font-bold tracking-tight uppercase transition-colors text-left ${isExpanded ? 'text-white' : 'text-gray-400'}`}>
                          {milestone.title}
                        </h2>
                      </div>
                      <div className={`p-2 rounded-full  transition-transform duration-300 ${isExpanded ? 'rotate-180 text-genesis-accent' : 'text-gray-600'}`}>
                        <ChevronDown size={20} />
                      </div>
                    </div>
                    
                    {!isExpanded && (
                      <p className="text-gray-500 text-sm mt-4 line-clamp-1 font-light italic text-left">
                        {milestone.description}
                      </p>
                    )}

                    <div className={`transition-all duration-700 ease-in-out ${isExpanded ? 'max-h-[1200px] opacity-100 mt-8' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                      <p className="text-gray-400 text-sm mb-8 leading-relaxed text-left">
                        {milestone.description}
                      </p>

                      <div className="space-y-4">
                        <div className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.2em] mb-4  pb-2 text-left">Status da Implementação</div>
                        {milestone.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="flex flex-col gap-1 group/item">
                            <div className="flex items-start gap-3">
                                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${isCompleted ? 'bg-genesis-positive' : 'bg-genesis-accent opacity-60'}`}></div>
                                <span className={`text-sm md:text-base transition-all text-left ${
                                  isCompleted ? 'text-gray-500 line-through decoration-genesis-positive/40' : 'text-gray-300'
                                }`}>
                                  {item.text}
                                </span>
                            </div>
                            {item.description && isExpanded && (
                                <p className="ml-4.5 pl-3  text-[11px] text-gray-500 font-sans leading-relaxed text-left">
                                    {item.description}
                                </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER DECORATION */}
        <div className="mt-20 pt-12  flex flex-col md:flex-row justify-between items-center gap-6 opacity-40 animate-in fade-in duration-1000 delay-500">
           <div className="flex items-center gap-3">
              <ShieldCheck size={16} className="text-gray-500" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500 text-left">Desenvolvimento Ético & Educacional</span>
           </div>
           <p className="text-[9px] font-mono text-gray-500 uppercase text-left">Gênesis Labs • v2.8 PRODUCT ROADMAP</p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes clock-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes reveal-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-clock-rotate {
          animation: clock-rotate 10s linear infinite;
        }
        .reveal-item {
          opacity: 0;
          animation: reveal-up 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </div>
  );
};

export default RoadmapPage;
