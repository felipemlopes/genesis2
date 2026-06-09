
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Zap, Layers, BarChart2, ShieldCheck, Mail, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import Hologram from './Hologram';
import EducationalQuiz from './EducationalQuiz';
import AboutPage from './AboutPage';
import PrivacyPage from './PrivacyPage';
import SupportPage from './SupportPage';
import RoadmapPage from './RoadmapPage';
import VersionSelector from './VersionSelector';
import { login } from '../services/api';

interface LandingPageProps {
  onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  const [showQuiz, setShowQuiz] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showVersionSelector, setShowVersionSelector] = useState(false);

  const handleStartLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!acceptTerms || !emailInput || !passwordInput) return;

    setIsLoggingIn(true);
    try {
      const result = await login(emailInput, passwordInput);
      if (result.success) {
        setShowQuiz(true);
      } else {
        setLoginError(result.message || "Assinatura não está ativa ou credenciais inválidas.");
      }
    } catch (err) {
      console.error(err);
      setLoginError("Erro ao comunicar com o servidor. Tente novamente.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAcessarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowVersionSelector(true);
  };

  // NAVEGAÇÃO CONDICIONAL
  if (showAbout) {
    return <AboutPage onBack={() => setShowAbout(false)} />;
  }

  if (showPrivacy) {
    return <PrivacyPage onBack={() => setShowPrivacy(false)} />;
  }

  if (showSupport) {
    return <SupportPage onBack={() => setShowSupport(false)} />;
  }

  if (showRoadmap) {
    return <RoadmapPage onBack={() => setShowRoadmap(false)} />;
  }

  if (showVersionSelector) {
    return (
      <VersionSelector 
        onSelectVersion={(v) => {
          if (v === 2) {
            setShowVersionSelector(false);
            setTimeout(() => {
              const element = document.getElementById('access');
              if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        }}
      />
    );
  }

  if (showQuiz) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <EducationalQuiz onComplete={onLogin} />
      </div>
    );
  }

  return (
    <div className="scroll-smooth min-h-screen bg-black text-white selection:bg-genesis-positive selection:text-black overflow-x-hidden animate-in fade-in duration-1000">
      
      {/* BACKGROUND DECORATION - Animated 3D Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[70%] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(176,38,255,0.06) 0%, transparent 70%)' }}
          animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0], scale: [1, 1.1, 0.95, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[70%] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(57,255,20,0.05) 0%, transparent 70%)' }}
          animate={{ x: [0, -25, 35, 0], y: [0, 30, -25, 0], scale: [1, 0.95, 1.08, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* HEADER / NAVIGATION - Pill with Glassmorphism */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-[999999] w-[90%] max-w-4xl">
        <div className="bg-[#0c0c0e]/80 backdrop-blur-xl border border-white/5 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setShowAbout(false); setShowPrivacy(false); setShowSupport(false); setShowRoadmap(false); }}>
            <div className="w-10 h-10 rounded-xl border border-white/5 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.2)] bg-genesis-accent/5 transition-all duration-500 group-hover:bg-gradient-to-tr group-hover:from-genesis-accent/10 group-hover:to-transparent group-hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]">
              <Terminal size={18} className="text-genesis-accent transition-transform duration-500 group-hover:scale-110" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-lg text-white" style={{ letterSpacing: '-0.01em' }}>Gênesis</span>
              <span className="font-medium text-[10px] uppercase" style={{ letterSpacing: '0.12em' }}>Labs</span>
            </div>
          </div>
          {/* Nav Links with animated underline */}
          <div className="flex items-center gap-6 md:gap-8">
             <button 
               onClick={() => setShowAbout(true)} 
               className="relative group"
             >
               <span className="text-[10px] font-bold text-gray-500 group-hover:text-white uppercase tracking-widest transition-colors duration-300">Sobre</span>
               <span className="absolute -bottom-1 left-0 h-px w-0 group-hover:w-full transition-all duration-300 bg-gradient-to-r from-genesis-accent to-genesis-positive" />
             </button>
             <button 
               onClick={() => setShowRoadmap(true)} 
               className="relative group"
             >
               <span className="text-[10px] font-bold text-gray-500 group-hover:text-white uppercase tracking-widest transition-colors duration-300">Roadmap</span>
               <span className="absolute -bottom-1 left-0 h-px w-0 group-hover:w-full transition-all duration-300 bg-gradient-to-r from-genesis-accent to-genesis-positive" />
             </button>
             {/* Botão Acessar com shimmer + ArrowRight */}
             <a 
               href="#access" 
               onClick={handleAcessarClick}
               className="relative overflow-hidden group bg-white/[0.02] border border-white/10 px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(176,38,255,0.3)] flex items-center gap-2"
             >
               <span className="shimmer-effect" />
               Acessar
               <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-1" />
             </a>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative px-6 md:px-16 pt-32 md:pt-44 pb-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="flex items-center gap-2 text-genesis-accent mb-6">
                <span className="w-8 h-[1px] bg-genesis-accent shadow-[0_0_10px_rgba(139,92,246,0.8)]"></span>
                <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Plataforma Educacional</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-thin tracking-tighter mb-8 leading-[1.1]">
              A Próxima <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-genesis-accent to-genesis-positive">Fronteira</span> da Análise Cripto.
            </h1>
            <p className="text-gray-400 text-lg md:text-xl font-light leading-relaxed max-w-xl mb-12">
              Tecnologia avançada, Inteligência Artificial e indicadores profissionais integrados em um ecossistema educacional projetado para o investidor moderno.
            </p>
            <div className="flex flex-wrap gap-6">
                <a 
                  href="#access" 
                  onClick={handleAcessarClick}
                  className="relative overflow-hidden bg-white/[0.02] border border-white/10 px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] text-white transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(176,38,255,0.3)] hover:-translate-y-0.5"
                >
                  <span className="shimmer-effect" />
                  Acessar o Gênesis
                </a>
                <button 
                  onClick={() => setShowAbout(true)}
                  className="hover:bg-white/5 px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all duration-300 text-gray-400 hover:text-white hover:-translate-y-0.5"
                >
                  Conheça o Gênesis
                </button>
            </div>
          </motion.div>
          
          <div className="relative animate-in fade-in duration-1000 delay-200">
             <Hologram />
          </div>
        </div>
      </section>

      {/* DISCLAIMER BAR (Refined with Hover) */}
      <div className="py-4 bg-white/[0.02] border-y  text-center px-4 overflow-hidden whitespace-nowrap relative group transition-colors duration-500 ">
         <div className="flex gap-12 animate-[marquee_60s_linear_infinite] opacity-60 group-hover:opacity-100 transition-opacity duration-500">
            {[...Array(10)].map((_, i) => (
              <span key={i} className="text-[9px] font-mono text-gray-500  uppercase tracking-widest flex items-center gap-[16px] transition-colors duration-500">
                <span className="w-1 h-1 bg-genesis-accent rounded-full  transition-colors duration-500"></span>
                O Gênesis Labs não fornece recomendações de investimento • Plataforma estritamente educacional • Tome suas decisões com consciência
              </span>
            ))}
         </div>
      </div>

      {/* ABOUT CARDS (FILOSOFIA) - UPDATED TEXT & HOVER */}
      <section className="py-32 px-6 md:px-16 bg-[#030303]">
         <div className="max-w-7xl mx-auto">
            <div className="text-center mb-24">
               <h2 className="text-[10px] font-bold text-genesis-accent uppercase tracking-[0.5em] mb-4">A Filosofia</h2>
               <p className="text-3xl md:text-4xl font-light text-white tracking-tight uppercase">Educação através da tecnologia</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               {[
                 { 
                   icon: Layers, 
                   title: "Análise Multidimensional", 
                   desc: "Visualize fluxos de dados, ordens institucionais e padrões on-chain em uma única interface profissional.",
                   extra: "A integração de múltiplas camadas de dados permite uma leitura de mercado mais profunda e contextualizada."
                 },
                 { 
                   icon: Zap, 
                   title: "Inteligência Aplicada", 
                   desc: "IA treinada para identificar confluências técnicas e traduzir dados complexos em insights educacionais.",
                   extra: "Algoritmos desenhados para filtrar ruído e destacar estruturas de alta probabilidade técnica."
                 },
                 { 
                   icon: BarChart2, 
                   title: "Autonomia do Trader", 
                   desc: "Não buscamos substituir sua mente, mas fornecer as ferramentas para que você domine o próprio caminho.",
                   extra: "O foco é o desenvolvimento de competência analítica individual, eliminando a dependência de terceiros."
                 }
               ].map((card, i) => (
                 <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.15, ease: 'easeOut' }}
                    className="relative group p-10 rounded-2xl bg-genesis-card overflow-hidden transition-all duration-500 hover:border-genesis-accent/50 hover:-translate-y-1"
                 >
                    {/* Borda neon com blur */}
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-genesis-accent/0 via-genesis-accent/20 to-genesis-accent/0 blur-[6px]" />
                    </div>
                    {/* Shimmer interno no hover */}
                    <div className="shimmer-hover" />

                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-8 transition-all duration-500">
                         <card.icon size={24} className="text-gray-500 group-hover:text-genesis-positive transition-colors duration-500" />
                      </div>
                      <h3 className="text-lg font-bold text-white mb-4 uppercase tracking-widest">{card.title}</h3>
                      <div className="space-y-4">
                        <p className="text-gray-500 text-sm leading-relaxed font-light">{card.desc}</p>
                        <p className="text-gray-500 text-sm leading-relaxed font-light">{card.extra}</p>
                      </div>
                    </div>
                 </motion.div>
               ))}
            </div>
         </div>
      </section>

      {/* ACCESS SECTION (LOGIN VISUAL) */}
      <section id="access" className="py-32 px-6 md:px-16 relative">
         <div className="max-w-xl mx-auto">
            <div className="bg-genesis-card  rounded-3xl p-10 md:p-16 shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-700">
                {/* EFEITO DE LUZ PULSANTE BICOLOR (ROXO/VERDE) */}
                <div className="absolute top-0 left-0 w-full h-1 animate-dual-neon"></div>
                
                <div className="text-center mb-12">
                   <h2 className="text-2xl font-light text-white uppercase tracking-widest mb-2">Entrar no Terminal</h2>
                   <p className="text-gray-500 text-[10px] uppercase tracking-widest font-mono">Ambiente de Análise Profissional</p>
                </div>

                <form className="space-y-6" onSubmit={handleStartLogin}>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                      <div className="relative group">
                         <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 transition-colors duration-300 group-focus-within:text-genesis-accent" size={16} />
                         <input 
                           type="text" 
                           value={emailInput}
                           onChange={(e) => { setEmailInput(e.target.value); setLoginError(""); }}
                           className="w-full bg-black border border-white/5 rounded-xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-genesis-accent transition-all duration-300 font-mono focus:shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                           placeholder="Email cadastrado na LastLink"
                         />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Senha de Acesso</label>
                      <div className="relative group">
                         <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 transition-colors duration-300 group-focus-within:text-genesis-accent" size={16} />
                         <input 
                           type="password" 
                           value={passwordInput}
                           onChange={(e) => { setPasswordInput(e.target.value); setLoginError(""); }}
                           className="w-full bg-black border border-white/5 rounded-xl py-4 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-genesis-accent transition-all duration-300 font-mono focus:shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                           placeholder="Senha"
                         />
                      </div>
                   </div>

                   <div className="pt-4">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative w-5 h-5">
                          <input 
                            type="checkbox" 
                            checked={acceptTerms}
                            onChange={() => setAcceptTerms(!acceptTerms)}
                            className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                          />
                          <div className={`w-5 h-5 rounded transition-all duration-300 flex items-center justify-center ${acceptTerms ? 'bg-genesis-positive border-genesis-positive' : 'bg-black border border-white/10 group-hover:border-genesis-accent'}`}>
                             {acceptTerms && <CheckCircle2 size={12} className="text-black" />}
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-500 uppercase font-bold select-none tracking-tight transition-colors duration-300 group-hover:text-gray-300">Li e concordo com os Termos Educacionais</span>
                      </label>
                   </div>

                   {loginError && (
                     <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-xs font-mono text-center">
                       {loginError}
                     </div>
                   )}

                   <button 
                     type="submit"
                     disabled={!acceptTerms || isLoggingIn}
                     className={`w-full py-5 rounded-xl font-bold text-xs uppercase tracking-[0.3em] transition-all duration-500 flex items-center justify-center gap-3 mt-6
                       ${acceptTerms && !isLoggingIn ? 'bg-white text-black  shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(57,255,20,0.3)] hover:-translate-y-0.5' : 'bg-white/5 text-gray-600 cursor-not-allowed '}`}
                   >
                     {isLoggingIn ? 'Autenticando...' : 'Entrar no Sistema'} <Zap size={14} className={`transition-all duration-300 ${acceptTerms && !isLoggingIn ? 'fill-current scale-110' : ''}`} />
                   </button>
                </form>

                <div className="mt-12 text-center  pt-8">
                   <p className="text-[9px] text-gray-600 font-mono uppercase leading-relaxed max-w-xs mx-auto">
                     Acesso via convite educacional • Segurança de dados criptografada ponta a ponta
                   </p>
                </div>
            </div>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="py-20 px-6 ">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-gray-600">
            <div className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity duration-300">
               <span className="font-bold text-sm tracking-tight">Gênesis Labs</span>
               <span className="text-[10px] font-mono">v2.8 PROTOCOL</span>
            </div>
            <div className="flex gap-8 text-[9px] font-bold uppercase tracking-widest">
               <button onClick={() => setShowAbout(true)} className="hover:text-white cursor-pointer transition-colors duration-300">Sobre</button>
               <button onClick={() => setShowPrivacy(true)} className="hover:text-white cursor-pointer transition-colors duration-300">Privacidade</button>
               <button onClick={() => setShowSupport(true)} className="hover:text-white cursor-pointer transition-colors duration-300">Suporte</button>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="text-[10px] font-mono">© 2025 • High-Performance Educational Terminal</p>
              <p className="text-[10px] font-mono opacity-60">CNPJ: 47.610.776/0001-97</p>
            </div>
         </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes dual-neon-breathe {
          0% {
            background: linear-gradient(90deg, transparent, #8b5cf6, transparent);
            box-shadow: 0 1px 20px rgba(139, 92, 246, 0.8);
            opacity: 1;
          }
          25% {
            background: linear-gradient(90deg, transparent, #8b5cf6, transparent);
            box-shadow: none;
            opacity: 0;
          }
          26% {
            background: linear-gradient(90deg, transparent, #39FF14, transparent);
            box-shadow: none;
            opacity: 0;
          }
          50% {
            background: linear-gradient(90deg, transparent, #39FF14, transparent);
            box-shadow: 0 1px 20px rgba(57, 255, 20, 0.8);
            opacity: 1;
          }
          75% {
            background: linear-gradient(90deg, transparent, #39FF14, transparent);
            box-shadow: none;
            opacity: 0;
          }
          76% {
            background: linear-gradient(90deg, transparent, #8b5cf6, transparent);
            box-shadow: none;
            opacity: 0;
          }
          100% {
            background: linear-gradient(90deg, transparent, #8b5cf6, transparent);
            box-shadow: 0 1px 20px rgba(139, 92, 246, 0.8);
            opacity: 1;
          }
        }
        .animate-dual-neon {
          animation: dual-neon-breathe 4s linear infinite;
        }
      `}} />
    </div>
  );
};

export default LandingPage;
