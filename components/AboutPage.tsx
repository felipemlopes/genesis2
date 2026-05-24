
import React, { useEffect } from 'react';
import { ArrowLeft, Target, Shield, BookOpen, Cpu } from 'lucide-react';

interface AboutPageProps {
  onBack: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onBack }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-genesis-positive selection:text-black animate-in fade-in duration-700">
      {/* BACKGROUND DECORATION */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[30%] h-[40%] bg-genesis-accent/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-5%] left-[-5%] w-[20%] h-[30%] bg-genesis-positive/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-20 relative z-10">
        {/* BACK BUTTON */}
        <button 
          onClick={onBack}
          className="flex items-center gap-3 text-[10px] font-bold text-gray-500 hover:text-genesis-accent uppercase tracking-[0.2em] transition-all mb-16 group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Voltar para a página inicial
        </button>

        {/* CONTENT HEADER */}
        <header className="mb-16">
          <div className="flex items-center gap-2 text-genesis-accent mb-4">
              <span className="w-12 h-[1px] bg-genesis-accent"></span>
              <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Institucional</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-thin tracking-tighter text-white uppercase leading-none mb-4">
            Sobre o <span className="font-bold">Gênesis Labs</span>
          </h1>
          <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Protocolo de Análise Educacional v2.8</p>
        </header>

        {/* MAIN TEXT BODY */}
        <div className="space-y-8 text-gray-300 leading-relaxed text-lg font-light">
          <p className="text-left">
            O Gênesis Labs é uma plataforma educacional de análise voltada ao mercado de criptomoedas, desenvolvida para auxiliar traders e investidores na leitura de mercado e na tomada de decisões mais conscientes, estruturadas e responsáveis.
          </p>

          <p className="text-left">
            A plataforma integra gráficos, indicadores técnicos avançados, leitura de contexto macroeconômico e geopolítico, além de análise de sentimento e comportamento de mercado. Essas informações são organizadas em um único ambiente analítico, com o objetivo de reduzir ruído, aumentar clareza e permitir uma compreensão mais profunda da dinâmica do mercado cripto.
          </p>

          <p className="text-left">
            O foco do Gênesis Labs não é substituir o julgamento humano, nem automatizar decisões. A proposta é educacional. A tecnologia atua como suporte analítico, fornecendo contexto, estrutura e organização para que o usuário desenvolva autonomia, disciplina e pensamento crítico ao longo do tempo.
          </p>

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

        {/* FOOTER DECORATION */}
        <div className="mt-24 pt-12  flex justify-between items-center opacity-40">
           <div className="flex items-center gap-3">
              <Shield size={16} className="text-gray-500" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">Transparência & Responsabilidade</span>
           </div>
           <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center ">
              <Target size={18} className="text-genesis-accent" />
           </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
