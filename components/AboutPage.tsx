
import React, { useEffect } from 'react';
import { ArrowLeft, Target, Shield, BookOpen, Layers } from 'lucide-react';
import { motion } from "framer-motion";

interface AboutPageProps {
  onBack: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
          className="absolute top-[-20%] right-[-10%] w-[50%] h-[70%] opacity-[0.06] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-genesis-accent via-genesis-accent/20 to-transparent blur-[120px] rounded-full"
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
          className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[70%] opacity-[0.05] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-genesis-positive via-genesis-positive/20 to-transparent blur-[120px] rounded-full"
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

        {/* CONTENT HEADER */}
        <motion.header 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 text-genesis-accent mb-6">
              <span className="w-10 h-px bg-gradient-to-r from-genesis-accent/80 to-transparent"></span>
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-80">Institucional</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-light tracking-tight text-white uppercase leading-none mb-6">
            Sobre o <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/60">Gênesis Labs</span>
          </h1>
          <p className="text-genesis-text-secondary font-mono text-[10px] uppercase tracking-[0.3em]">Protocolo de Análise Educacional v2.8</p>
        </motion.header>

        {/* MAIN TEXT BODY WITH STYLING MATCHING VERSION SELECTOR */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative group"
        >
          {/* Neon Style Box Outline for Text container */}
          <div className="absolute -inset-[1px] rounded-[32px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 group-hover:from-genesis-accent group-hover:to-genesis-accent/5 group-hover:blur-[8px]"></div>
          <div className="absolute -inset-[1px] rounded-[32px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500"></div>

          <div className="relative bg-[#0c0c0e] rounded-[31px] p-10 md:p-14 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-10">
              {/* Top Accent lighting */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-700"></div>

              <div className="space-y-8 text-genesis-text-secondary leading-relaxed text-base font-light">
                <p className="text-left text-white/80">
                  O Gênesis Labs é uma plataforma educacional de análise voltada ao mercado de criptomoedas, desenvolvida para auxiliar traders e investidores na leitura de mercado e na tomada de decisões mais conscientes, estruturadas e responsáveis.
                </p>

                <p className="text-left">
                  A plataforma integra gráficos, indicadores técnicos avançados, leitura de contexto macroeconômico e geopolítico, além de análise de sentimento e comportamento de mercado. Essas informações são organizadas em um único ambiente analítico, com o objetivo de reduzir ruído, aumentar clareza e permitir uma compreensão mais profunda da dinâmica do mercado cripto.
                </p>

                <div className="py-6 my-8 border-y border-white/5 relative">
                  <div className="absolute left-0 top-0 w-1 h-full bg-genesis-accent/50"></div>
                  <p className="text-left pl-6 italic text-white/90">
                    O foco do Gênesis Labs não é substituir o julgamento humano, nem automatizar decisões. A proposta é educacional. A tecnologia atua como suporte analítico, fornecendo contexto, estrutura e organização para que o usuário desenvolva autonomia, disciplina e pensamento crítico ao longo do tempo.
                  </p>
                </div>

                <p className="text-left">
                  O Gênesis Labs foi concebido como um ambiente de aprendizado contínuo. Cada ferramenta, indicador e visualização existe para ensinar o usuário a interpretar dados, identificar cenários, compreender riscos e reconhecer limitações. O processo decisório permanece sempre sob responsabilidade individual, respeitando o perfil, a estratégia e o nível de experiência de cada usuário.
                </p>

                <p className="text-left">
                  A plataforma não fornece sinais de compra ou venda, não promete resultados e não induz comportamentos operacionais. Seu papel é oferecer um ecossistema educacional robusto, onde o conhecimento é construído por meio da prática, da observação e da análise contextual.
                </p>

                <p className="text-left">
                  Desenvolvido com foco em tecnologia, inovação e design atemporal, o Gênesis Labs mantém uma experiência minimalista, profissional e funcional. O ambiente prioriza clareza visual, organização da informação e profundidade analítica, evitando excessos gráficos ou estímulos comerciais.
                </p>

                <p className="text-left">
                  O Gênesis Labs existe para quem busca evoluir no mercado de criptomoedas com método, responsabilidade e visão de longo prazo, entendendo que consistência é consequência de conhecimento bem estruturado, e não de atalhos.
                </p>
              </div>
          </div>
        </motion.div>

        {/* FOOTER DECORATION */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-20 pt-10 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6"
        >
           <div className="flex items-center gap-4">
              <Shield size={16} className="text-white/60" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">Transparência & Responsabilidade</span>
           </div>
           <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center bg-white/[0.02]">
              <Target size={18} className="text-genesis-accent" />
           </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AboutPage;
