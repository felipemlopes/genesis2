import React from "react";
import { motion } from "framer-motion";
import { Terminal, ArrowRight, Zap, Target } from "lucide-react";

interface VersionSelectorProps {
  onSelectVersion: (version: 1 | 2) => void;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({ onSelectVersion }) => {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0A0B] font-sans selection:bg-genesis-positive selection:text-black">
      {/* Refined Smooth Animated Background Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
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
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[70%] opacity-[0.06] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-genesis-positive via-genesis-positive/20 to-transparent blur-[120px] rounded-full"
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
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[70%] opacity-[0.05] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-genesis-accent via-genesis-accent/20 to-transparent blur-[120px] rounded-full"
        />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-6 lg:px-8 flex flex-col items-center">
        {/* Header/Logo Placeholder */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center mb-20 w-full"
        >
          {/* Logo Placeholder */}
          <div className="w-40 h-16 rounded-xl border border-white/5 flex items-center justify-center mb-10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] bg-black/20 backdrop-blur-md relative group overflow-hidden">
             {/* Efeito de brilho suave dentro do logo placeholder sobre hover */}
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
             <span className="text-white/40 tracking-[0.3em] text-xs font-medium relative z-10">LOGO AQUI</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-light text-white tracking-widest uppercase text-center" style={{ letterSpacing: "0.2em" }}>
            Selecione a versão
          </h1>
        </motion.div>

        {/* Big Buttons Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 w-full max-w-5xl">
          {/* Genesis Labs 1.0 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            whileHover={{ scale: 1.02 }}
            className="group relative flex flex-col items-center cursor-pointer"
            onClick={() => onSelectVersion(1)}
          >
            {/* Neon Glowing Border Setup */}
            <div className="absolute -inset-[1px] rounded-[24px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 group-hover:from-genesis-accent group-hover:to-genesis-accent/20 group-hover:blur-[6px]"></div>
            <div className="absolute -inset-[1px] rounded-[24px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 group-hover:from-genesis-accent group-hover:to-genesis-accent/5"></div>
            
            <div className="relative w-full h-[420px] rounded-[23px] bg-[#0c0c0e] p-10 flex flex-col items-center justify-between transition-all duration-500 overflow-hidden z-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] group-hover:shadow-[0_0_60px_-15px_rgba(99,102,241,0.25)]">
              {/* Internal Accent Lighting */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-genesis-accent/0 to-transparent group-hover:via-genesis-accent/50 transition-all duration-700"></div>
              <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 bg-genesis-accent rounded-full blur-[100px] opacity-0 group-hover:opacity-15 transition-opacity duration-700"></div>

              <div className="flex flex-col items-center text-center mt-8 z-20">
                <div className="w-16 h-16 rounded-full border border-white/5 bg-white/[0.01] flex items-center justify-center mb-8 text-white/30 group-hover:text-genesis-accent group-hover:border-genesis-accent/20 transition-all duration-500">
                  <Target strokeWidth={1} size={28} />
                </div>
                <h2 className="text-4xl md:text-5xl font-light text-white tracking-tight leading-none mb-3 group-hover:text-white transition-colors duration-300">
                  Genesis Labs<br />
                  <span className="font-medium text-white/80 group-hover:text-genesis-accent transition-colors duration-300 mt-2 block">1.0</span>
                </h2>
                <div className="h-px w-12 bg-white/10 mt-6 mb-2 group-hover:w-24 group-hover:bg-genesis-accent/50 transition-all duration-500"></div>
              </div>

              <div className="flex flex-col items-center w-full relative z-20">
                <div className="w-full h-14 flex items-center justify-center bg-white/[0.02] border border-white/5 group-hover:bg-genesis-accent/10 rounded-xl px-6 transition-all duration-500 group-hover:border-genesis-accent/30 overflow-hidden relative">
                   <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                   <span className="text-white/70 group-hover:text-white uppercase tracking-[0.2em] text-xs font-semibold mr-3 transition-colors">Acessar</span>
                   <ArrowRight size={16} className="text-white/30 group-hover:text-genesis-accent transition-colors transform group-hover:translate-x-1 duration-300" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Genesis Labs 2.0 Beta */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
            className="group relative flex flex-col items-center cursor-pointer"
            onClick={() => onSelectVersion(2)}
          >
            {/* Neon Glowing Border Setup */}
            <div className="absolute -inset-[1px] rounded-[24px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 group-hover:from-genesis-positive group-hover:to-genesis-positive/20 group-hover:blur-[6px]"></div>
            <div className="absolute -inset-[1px] rounded-[24px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 group-hover:from-genesis-positive group-hover:to-genesis-positive/5"></div>
            
             <div className="relative w-full h-[420px] rounded-[23px] bg-[#0c0c0e] p-10 flex flex-col items-center justify-between transition-all duration-500 overflow-hidden z-10 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] group-hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.25)]">
               {/* Internal Accent Lighting */}
               <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-genesis-positive/0 to-transparent group-hover:via-genesis-positive/50 transition-all duration-700"></div>
               <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-64 h-64 bg-genesis-positive rounded-full blur-[100px] opacity-0 group-hover:opacity-15 transition-opacity duration-700"></div>

              <div className="flex flex-col items-center text-center mt-8 z-20">
                 <div className="w-16 h-16 rounded-full border border-white/5 bg-white/[0.01] flex items-center justify-center mb-8 text-white/30 group-hover:text-genesis-positive group-hover:border-genesis-positive/20 transition-all duration-500">
                  <Zap strokeWidth={1} size={28} />
                </div>
                <h2 className="text-4xl md:text-5xl font-light text-white tracking-tight leading-none mb-3 group-hover:text-white transition-colors duration-300">
                  Genesis Labs<br />
                  <span className="font-medium text-white/80 group-hover:text-genesis-positive transition-colors duration-300 mt-2 block">2.0 <sup className="text-lg opacity-70 font-light">Beta</sup></span>
                </h2>
                <div className="h-px w-12 bg-white/10 mt-6 mb-2 group-hover:w-24 group-hover:bg-genesis-positive/50 transition-all duration-500"></div>
              </div>

              <div className="flex flex-col items-center w-full relative z-20">
                <p className="text-genesis-text-secondary text-[10px] uppercase tracking-widest mb-5 opacity-40 group-hover:opacity-100 transition-opacity">
                  Observação: Versão simplificada
                </p>
                <div className="w-full h-14 flex items-center justify-center bg-white/[0.02] border border-white/5 group-hover:bg-genesis-positive/10 rounded-xl px-6 transition-all duration-500 group-hover:border-genesis-positive/30 overflow-hidden relative">
                   <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                   <span className="text-white/70 group-hover:text-white uppercase tracking-[0.2em] text-xs font-semibold mr-3 transition-colors">Acessar Beta</span>
                   <ArrowRight size={16} className="text-white/30 group-hover:text-genesis-positive transition-colors transform group-hover:translate-x-1 duration-300" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 1 }}
          className="mt-24 opacity-40"
        >
           <p className="text-genesis-text-secondary text-xs tracking-[0.3em] uppercase">
            Sistema de Análise Gênesis Labs
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default VersionSelector;
