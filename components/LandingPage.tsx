import React, { useState } from 'react';
import { Terminal, Zap, Layers, BarChart2, Mail, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion } from "framer-motion";
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
  
  // Production variables
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showVersionSelector, setShowVersionSelector] = useState(false);

  const handleStartLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms || !emailInput || !passwordInput) return;

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const result = await login(emailInput, passwordInput);
      if (!result.success) {
        throw new Error(result.message);
      }
      // Wait for localStorage update
      setTimeout(() => {
        onLogin();
      }, 500);
    } catch (err: any) {
      console.error(err);
      setLoginError(err.message || "Credenciais inválidas");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAcessarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowVersionSelector(true);
  };

  const scrollToAccess = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById('access');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    <div className="scroll-smooth min-h-screen text-white selection:bg-genesis-positive selection:text-black overflow-x-hidden font-sans" style={{ backgroundColor: '#0A0A0B' }}>
      
      {/* Animated 3D/Gradient Background (Matching VersionSelector) */}
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

      {/* HEADER / NAVIGATION */}
      <nav className="h-24 px-8 md:px-16 flex items-center justify-between relative z-[50] transition-all duration-500">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setShowAbout(false); setShowPrivacy(false); setShowSupport(false); setShowRoadmap(false); }}>
          <div className="w-10 h-10 rounded-xl border border-white/5 flex items-center justify-center bg-white/[0.01] transition-all duration-500 group-hover:border-genesis-accent/30 shadow-[0_0_15px_rgba(255,255,255,0.02)] group-hover:shadow-[0_0_20px_rgba(139,92,246,0.15)] relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-tr from-genesis-accent/0 to-genesis-accent/0 group-hover:to-genesis-accent/10 transition-all duration-500"></div>
            <Terminal size={18} className="text-white/70 group-hover:text-genesis-accent transition-colors duration-500 relative z-10" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-white tracking-widest text-sm uppercase">Gênesis</span>
            <span className="font-bold text-[9px] text-genesis-text-secondary group-hover:text-genesis-accent uppercase tracking-[0.2em] transition-colors duration-500">Labs</span>
          </div>
        </div>
        
        {/* ENHANCED NAVIGATION PILL */}
        <div className="flex gap-4 md:gap-6 items-center bg-[#0c0c0e]/80 border border-white/5 px-2 py-2 rounded-2xl backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
           <button 
             onClick={() => setShowAbout(true)} 
             className="relative px-4 py-2 text-[10px] font-semibold text-white/50 hover:text-white uppercase tracking-[0.2em] transition-colors duration-300 group rounded-xl hover:bg-white/[0.02]"
           >
             Sobre
             <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-px bg-gradient-to-r from-transparent via-genesis-accent to-transparent group-hover:w-1/2 transition-all duration-300 opacity-0 group-hover:opacity-100"></span>
           </button>
           <button 
             onClick={() => setShowRoadmap(true)} 
             className="relative px-4 py-2 text-[10px] font-semibold text-white/50 hover:text-white uppercase tracking-[0.2em] transition-colors duration-300 group rounded-xl hover:bg-white/[0.02]"
           >
             Roadmap
             <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-px bg-gradient-to-r from-transparent via-genesis-positive to-transparent group-hover:w-1/2 transition-all duration-300 opacity-0 group-hover:opacity-100"></span>
           </button>
           
           <div className="w-px h-6 bg-white/10 mx-1 hidden md:block"></div>
           
           <a 
             href="#access" 
             onClick={handleAcessarClick}
             className="group hidden md:flex items-center justify-center gap-2 relative bg-genesis-accent/10 hover:bg-genesis-accent/20 border border-genesis-accent/20 hover:border-genesis-accent/40 rounded-xl px-6 py-2 transition-all duration-500 overflow-hidden"
           >
             <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
             <span className="text-[10px] font-semibold text-genesis-accent group-hover:text-white uppercase tracking-[0.2em] transition-colors duration-300 relative z-10">
               Acessar
             </span>
             <ArrowRight size={12} className="text-genesis-accent group-hover:text-white transform group-hover:translate-x-1 transition-all duration-300 relative z-10" />
           </a>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative px-6 md:px-16 pt-20 md:pt-32 pb-20 z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3 text-genesis-accent mb-8">
                <span className="w-10 h-px bg-gradient-to-r from-genesis-accent/80 to-transparent"></span>
                <span className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-80">Plataforma Educacional</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-light tracking-tight mb-8 leading-[1.1] text-white">
              A Próxima<br/>
              <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/60">Fronteira</span> da Análise Cripto.
            </h1>
            <p className="text-genesis-text-secondary text-lg font-light leading-relaxed max-w-xl mb-12">
              Tecnologia avançada, Inteligência Artificial e indicadores profissionais integrados em um ecossistema educacional projetado para o investidor moderno.
            </p>
            <div className="flex flex-col sm:flex-row gap-6">
                <a 
                  href="#access" 
                  onClick={handleAcessarClick}
                  className="group relative h-14 flex items-center justify-center bg-white/[0.02] border border-white/5 hover:bg-genesis-accent/10 rounded-xl px-10 transition-all duration-500 hover:border-genesis-accent/30 overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  <span className="text-white/80 group-hover:text-white uppercase tracking-[0.2em] text-xs font-semibold mr-3 transition-colors relative z-10">Acessar o Gênesis</span>
                  <ArrowRight size={16} className="text-white/40 group-hover:text-genesis-accent transition-colors transform group-hover:translate-x-1 duration-300 relative z-10" />
                </a>
                <button 
                  onClick={() => setShowAbout(true)}
                  className="h-14 px-10 rounded-xl font-semibold text-xs uppercase tracking-[0.2em] transition-all duration-300 text-white/40 hover:text-white hover:bg-white/[0.02] border border-transparent hover:border-white/5"
                >
                  Conheça o Gênesis
                </button>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
            className="relative"
          >
             <Hologram />
          </motion.div>
        </div>
      </section>

      {/* DISCLAIMER BAR (Refined) */}
      <div className="py-4 bg-[#0c0c0e] border-y border-white/5 text-center px-4 overflow-hidden whitespace-nowrap relative group transition-colors duration-500 z-10">
         <div className="flex gap-16 animate-[marquee_60s_linear_infinite] opacity-40 group-hover:opacity-80 transition-opacity duration-500">
            {[...Array(10)].map((_, i) => (
              <span key={i} className="text-[9px] font-mono text-white/60 uppercase tracking-widest flex items-center gap-[16px]">
                <span className="w-1.5 h-1.5 border border-genesis-accent/50 rounded-full flex items-center justify-center">
                   <span className="w-0.5 h-0.5 bg-genesis-accent rounded-full"></span>
                </span>
                O Gênesis Labs não fornece recomendações de investimento • Plataforma estritamente educacional • Tome suas decisões com consciência
              </span>
            ))}
         </div>
      </div>

      {/* ABOUT CARDS (FILOSOFIA) - MATCHING VERSION SELECTOR HOVER */}
      <section className="py-32 px-6 md:px-16 bg-[#0A0A0B] relative z-10">
         <div className="max-w-7xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.8 }}
              className="text-center mb-24"
            >
               <h2 className="text-[10px] font-bold text-genesis-accent/80 uppercase tracking-[0.5em] mb-4">A Filosofia</h2>
               <p className="text-3xl md:text-4xl font-light text-white tracking-widest uppercase">Educação através da tecnologia</p>
               <div className="w-px h-16 bg-gradient-to-b from-genesis-accent/50 to-transparent mx-auto mt-12"></div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
               {[
                  { 
                    icon: Layers, 
                    title: "Análise Multidimensional", 
                    desc: "Visualize fluxos de dados, ordens institucionais e padrões on-chain em uma única interface profissional.",
                    extra: "A integração de múltiplas camadas de dados permite uma leitura de mercado mais profunda e contextualizada.",
                    theme: "accent"
                  },
                  { 
                    icon: Zap, 
                    title: "Inteligência Aplicada", 
                    desc: "IA treinada para identificar confluências técnicas e traduzir dados complexos em insights educacionais.",
                    extra: "Algoritmos desenhados para filtrar ruído e destacar estruturas de alta probabilidade técnica.",
                    theme: "positive"
                  },
                  { 
                    icon: BarChart2, 
                    title: "Autonomia do Trader", 
                    desc: "Não buscamos substituir sua mente, mas fornecer as ferramentas para que você domine o próprio caminho.",
                    extra: "O foco é o desenvolvimento de competência analítica individual, eliminando a dependência de terceiros.",
                    theme: "accent"
                  }
                ].map((card, i) => (
                 <motion.div 
                    key={i} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.6, delay: i * 0.2 }}
                    className="group relative flex flex-col items-center"
                 >
                    {/* Neon Glowing Border Setup */}
                    <div className={`absolute -inset-[1px] rounded-[24px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 ${card.theme === 'accent' ? 'group-hover:from-genesis-accent group-hover:to-genesis-accent/20' : 'group-hover:from-genesis-positive group-hover:to-genesis-positive/20'} group-hover:blur-[6px]`}></div>
                    <div className={`absolute -inset-[1px] rounded-[24px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 ${card.theme === 'accent' ? 'group-hover:from-genesis-accent group-hover:to-genesis-accent/5' : 'group-hover:from-genesis-positive group-hover:to-genesis-positive/5'}`}></div>
                    
                    <div className={`relative w-full h-[400px] rounded-[23px] bg-[#0c0c0e] p-10 flex flex-col justify-start transition-all duration-500 overflow-hidden z-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] ${card.theme === 'accent' ? 'group-hover:shadow-[0_0_40px_-15px_rgba(139,92,246,0.15)]' : 'group-hover:shadow-[0_0_40px_-15px_rgba(16,185,129,0.15)]'} text-left`}>
                       {/* Internal Accent Lighting */}
                       <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent ${card.theme === 'accent' ? 'via-genesis-accent/0 group-hover:via-genesis-accent/30' : 'via-genesis-positive/0 group-hover:via-genesis-positive/30'} to-transparent transition-all duration-700`}></div>
                       <div className={`absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 ${card.theme === 'accent' ? 'bg-genesis-accent' : 'bg-genesis-positive'} rounded-full blur-[100px] opacity-0 group-hover:opacity-[0.08] transition-opacity duration-700`}></div>

                       <div className={`w-14 h-14 rounded-full border border-white/5 bg-white/[0.02] flex items-center justify-center mb-10 text-white/30 ${card.theme === 'accent' ? 'group-hover:text-genesis-accent group-hover:border-genesis-accent/20' : 'group-hover:text-genesis-positive group-hover:border-genesis-positive/20'} transition-all duration-500`}>
                          <card.icon strokeWidth={1.5} size={24} />
                       </div>
                       
                       <h3 className="text-xl font-light text-white mb-6 uppercase tracking-widest">{card.title}</h3>
                       
                       <div className="space-y-4 flex-grow relative z-10">
                         <p className="text-genesis-text-secondary text-sm leading-relaxed font-light">{card.desc}</p>
                         <p className="text-genesis-text-secondary text-sm leading-relaxed font-light opacity-60 group-hover:opacity-100 transition-opacity duration-500">{card.extra}</p>
                       </div>
                    </div>
                 </motion.div>
               ))}
            </div>
         </div>
      </section>

      {/* ACCESS SECTION (LOGIN VISUAL) */}
      <section id="access" className="py-32 px-6 md:px-16 relative z-10">
         <div className="max-w-lg mx-auto">
            <motion.div 
               initial={{ opacity: 0, y: 30 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.8 }}
               className="group relative"
            >
                {/* Advanced Login Card Glow */}
                <div className="absolute -inset-[1px] rounded-[32px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 group-hover:from-genesis-accent group-hover:to-transparent group-hover:blur-[8px]"></div>
                <div className="absolute -inset-[1px] rounded-[32px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 group-hover:from-genesis-accent group-hover:to-transparent"></div>

                <div className="relative bg-[#0c0c0e] rounded-[31px] p-10 md:p-14 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-10">
                    
                    {/* Top Lighting Line */}
                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:via-genesis-accent/50 transition-all duration-700"></div>

                    <div className="text-center mb-12">
                       <h2 className="text-3xl font-light text-white tracking-widest mb-3">ACESSO</h2>
                       <p className="text-genesis-text-secondary text-[10px] uppercase tracking-[0.3em]">Terminal Educacional</p>
                    </div>

                    <form className="space-y-6" onSubmit={handleStartLogin}>
                       <div className="space-y-3">
                          <label className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.2em] ml-1">E-mail Corporativo</label>
                          <div className="relative group/input">
                             <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 transition-colors duration-300 group-focus-within/input:text-genesis-accent" size={16} />
                             <input 
                               type="text" 
                               value={emailInput}
                               onChange={(e) => setEmailInput(e.target.value)}
                               className="w-full bg-[#0A0A0B] border border-white/5 rounded-2xl py-4 pl-14 pr-4 text-sm text-white focus:outline-none focus:border-genesis-accent/50 transition-all duration-300 font-mono shadow-inner focus:shadow-[0_0_20px_rgba(139,92,246,0.1)] focus:bg-white/[0.02]"
                               placeholder="Email cadastrado"
                             />
                          </div>
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.2em] ml-1">Senha de Acesso</label>
                          <div className="relative group/input">
                             <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 transition-colors duration-300 group-focus-within/input:text-genesis-accent" size={16} />
                             <input 
                               type="password" 
                               value={passwordInput}
                               onChange={(e) => setPasswordInput(e.target.value)}
                               className="w-full bg-[#0A0A0B] border border-white/5 rounded-2xl py-4 pl-14 pr-4 text-sm text-white focus:outline-none focus:border-genesis-accent/50 transition-all duration-300 font-mono shadow-inner focus:shadow-[0_0_20px_rgba(139,92,246,0.1)] focus:bg-white/[0.02]"
                               placeholder="Senha"
                             />
                          </div>
                       </div>
                       
                       {loginError && (
                         <div className="text-red-500 text-xs mt-2 text-center font-medium">
                           {loginError}
                         </div>
                       )}

                       <div className="pt-6">
                          <label className="flex items-center gap-4 cursor-pointer group/checkbox">
                            <div className="relative w-5 h-5 flex-shrink-0">
                              <input 
                                type="checkbox" 
                                checked={acceptTerms}
                                onChange={() => setAcceptTerms(!acceptTerms)}
                                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                              />
                              <div className={`w-full h-full rounded border transition-all duration-300 flex items-center justify-center ${acceptTerms ? 'bg-genesis-positive/20 border-genesis-positive' : 'bg-[#0A0A0B] border-white/10 group-hover/checkbox:border-white/30'}`}>
                                 {acceptTerms && <CheckCircle2 size={12} className="text-genesis-positive" />}
                              </div>
                            </div>
                            <span className="text-[10px] text-white/40 uppercase font-semibold select-none tracking-widest transition-colors duration-300 group-hover/checkbox:text-white/70">Li e concordo com os Termos Educacionais</span>
                          </label>
                       </div>

                       <div className="pt-6">
                         <button 
                           type="submit"
                           disabled={!acceptTerms || isLoggingIn}
                           className={`relative w-full h-14 rounded-2xl font-bold text-[10px] uppercase tracking-[0.3em] transition-all duration-500 flex items-center justify-center gap-3 overflow-hidden
                             ${acceptTerms 
                               ? 'bg-white/[0.03] border border-genesis-positive/30 text-white shadow-[0_0_30px_rgba(16,185,129,0.1)] hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:border-genesis-positive/60' 
                               : 'bg-white/5 border border-transparent text-white/20 cursor-not-allowed'}`}
                         >
                           {acceptTerms && !isLoggingIn && <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>}
                           <span className="relative z-10">{isLoggingIn ? "Autenticando..." : "Entrar no Sistema"}</span> 
                           <Zap size={14} className={`relative z-10 transition-all duration-300 ${acceptTerms ? 'text-genesis-positive' : 'text-white/20'} ${isLoggingIn ? 'animate-pulse' : ''}`} />
                         </button>
                       </div>
                    </form>

                    <div className="mt-12 text-center pt-8 border-t border-white/5 relative">
                       <p className="text-[9px] text-white/30 font-mono uppercase leading-relaxed max-w-xs mx-auto">
                         Acesso via convite educacional • Segurança de dados criptografada
                       </p>
                    </div>
                </div>
            </motion.div>
         </div>
      </section>

      {/* FOOTER */}
      <footer className="py-20 px-6 relative z-10 border-t border-white/5 mt-10">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10 text-white/40">
            <div className="flex flex-col items-center md:items-start gap-1">
               <span className="font-semibold text-xs tracking-widest uppercase text-white/70">Gênesis Labs</span>
               <span className="text-[9px] font-mono tracking-widest text-genesis-accent">v2.8 PROTOCOL</span>
            </div>
            <div className="flex gap-10 text-[9px] font-bold uppercase tracking-[0.2em]">
               <button onClick={() => setShowAbout(true)} className="hover:text-white cursor-pointer transition-colors duration-300">Sobre</button>
               <button onClick={() => setShowPrivacy(true)} className="hover:text-white cursor-pointer transition-colors duration-300">Privacidade</button>
               <button onClick={() => setShowSupport(true)} className="hover:text-white cursor-pointer transition-colors duration-300">Suporte</button>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2">
              <p className="text-[9px] font-mono tracking-wider opacity-60">© 2025 • Educational Terminal</p>
              <p className="text-[9px] font-mono tracking-wider opacity-40">CNPJ: 47.610.776/0001-97</p>
            </div>
         </div>
      </footer>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }
      `}} />
    </div>
  );
};

export default LandingPage;
