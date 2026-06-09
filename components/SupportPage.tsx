
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, MessageCircle, Send, CheckCircle2, Clock, ShieldCheck, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

interface SupportPageProps {
  onBack?: () => void; // Opcional para quando acessado via Landing Page
}

const SupportPage: React.FC<SupportPageProps> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    
    // Simulação de envio profissional
    setTimeout(() => {
      setIsSending(false);
      setIsSuccess(true);
      setEmail('');
      setSubject('');
      setMessage('');
      
      setTimeout(() => setIsSuccess(false), 5000);
    }, 1500);
  };

  const handleWhatsApp = () => {
    window.open('https://wa.me/5548996407481', '_blank');
  };

  return (
    <div className={`min-h-screen bg-[#0A0A0B] text-white selection:bg-genesis-positive selection:text-black font-sans relative overflow-x-hidden ${onBack ? 'pt-0' : 'p-0'}`}>
      
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

      <div className="max-w-5xl mx-auto px-6 py-12 md:py-20 relative z-10">
        
        {/* BACK BUTTON (Apenas se vier da Landing) */}
        {onBack && (
          <motion.button 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            onClick={onBack}
            className="flex items-center gap-3 text-[10px] font-semibold text-white/50 hover:text-genesis-accent uppercase tracking-[0.2em] transition-all mb-16 group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Voltar
          </motion.button>
        )}

        {/* HEADER SECTION */}
        <motion.header 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 text-genesis-accent mb-6">
              <ShieldCheck size={16} />
              <span className="w-10 h-px bg-gradient-to-r from-genesis-accent/80 to-transparent"></span>
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-80">Canal Oficial</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white uppercase leading-tight mb-4">
            Suporte <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/60">Gênesis</span>
          </h1>
          <p className="text-genesis-text-secondary font-mono text-[10px] uppercase tracking-[0.3em]">
            Canal oficial de atendimento e suporte educacional
          </p>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* BLOCO 1: INFORMAÇÕES DE CONTATO (LEFT) - EXPANDIDO PARA LG:COL-SPAN-5 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="lg:col-span-5 space-y-6"
          >
            <div className="relative group">
              <div className="absolute -inset-[1px] rounded-[24px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 group-hover:from-white/20"></div>
              <div className="relative bg-[#0c0c0e] rounded-[23px] overflow-hidden z-10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-white/[0.02] p-8">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 group-hover:via-white/30 to-transparent transition-all duration-700"></div>

                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-8 pb-2 border-b border-white/5">Contatos Diretos</h3>
                
                <div className="space-y-8">
                  <div className="flex items-start gap-[16px] group/item">
                    <div className="p-3 border border-white/5 bg-white/[0.02] rounded-xl group-hover/item:border-genesis-accent/30 group-hover/item:bg-genesis-accent/10 transition-all shrink-0">
                      <Mail size={18} className="text-genesis-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[9px] text-white/40 font-bold uppercase tracking-[0.2em] mb-1">E-mail</span>
                      <a href="mailto:suporte@criptoico.com.br" className="text-sm text-white/80 hover:text-white transition-colors font-mono whitespace-nowrap block tracking-wide">
                        suporte@criptoico.com.br
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-[16px] group/item">
                    <div className="p-3 border border-white/5 bg-white/[0.02] rounded-xl group-hover/item:border-genesis-positive/30 group-hover/item:bg-genesis-positive/10 transition-all shrink-0">
                      <MessageCircle size={18} className="text-genesis-positive" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[9px] text-white/40 font-bold uppercase tracking-[0.2em] mb-1">WhatsApp</span>
                      <span className="text-sm text-white/80 font-mono block whitespace-nowrap tracking-wide">
                        (48) 9 9640-7481
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-[16px] group/item">
                    <div className="p-3 border border-white/5 bg-white/[0.02] rounded-xl transition-all shrink-0">
                      <Clock size={18} className="text-white/60" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[9px] text-white/40 font-bold uppercase tracking-[0.2em] mb-1">Horário</span>
                      <span className="text-sm text-white/80 font-mono block leading-relaxed tracking-wide">
                        Seg - Sex, <span className="whitespace-nowrap">09h às 18h</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTÃO WHATSAPP (AÇÃO DIRETA) */}
            <button 
              onClick={handleWhatsApp}
              className="w-full bg-genesis-positive/10 hover:bg-genesis-positive/20 border border-genesis-positive/20 text-genesis-positive p-5 rounded-2xl flex items-center justify-center gap-3 transition-all group"
            >
              <MessageCircle size={20} className="group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Falar via WhatsApp</span>
            </button>
          </motion.div>

          {/* BLOCO 2: FORMULÁRIO DE CONTATO (RIGHT) - AJUSTADO PARA LG:COL-SPAN-7 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="lg:col-span-7"
          >
            <div className="relative group h-full">
              <div className="absolute -inset-[1px] rounded-[32px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 group-hover:from-genesis-accent group-hover:to-genesis-accent/5"></div>
              <div className="relative bg-[#0c0c0e] rounded-[31px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-10 h-full p-8 md:p-10 flex flex-col">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 group-hover:via-genesis-accent/40 to-transparent transition-all duration-700"></div>

                <div className="mb-10">
                  <h2 className="text-xl font-light text-white uppercase tracking-widest mb-2 flex items-center gap-3">
                    <Headphones size={20} className="text-genesis-accent" />
                    Mensagem para a Equipe
                  </h2>
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] font-mono">Tempo médio de resposta: 4 horas</p>
                </div>

                {isSuccess ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center flex-grow text-center"
                  >
                    <div className="w-16 h-16 bg-genesis-positive/10 border border-genesis-positive/30 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle2 size={32} className="text-genesis-positive" />
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Mensagem Enviada</h3>
                    <p className="text-white/60 text-sm max-w-xs font-light">Sua solicitação foi encaminhada para nossa central de suporte.</p>
                  </motion.div>
                ) : (
                  <form className="space-y-6 flex-grow flex flex-col justify-between" onSubmit={handleSubmit}>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Seu E-mail</label>
                          <input 
                            required
                            type="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#0A0A0B] border border-white/5 rounded-xl py-4 px-4 text-sm text-white focus:outline-none focus:border-genesis-accent transition-all font-mono placeholder:text-white/20"
                            placeholder="nome@email.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Assunto</label>
                          <input 
                            required
                            type="text" 
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full bg-[#0A0A0B] border border-white/5 rounded-xl py-4 px-4 text-sm text-white focus:outline-none focus:border-genesis-accent transition-all font-mono placeholder:text-white/20"
                            placeholder="Ex: Dúvida técnica"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] ml-1">Mensagem</label>
                        <textarea 
                          required
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={6}
                          className="w-full bg-[#0A0A0B] border border-white/5 rounded-xl py-4 px-4 text-sm text-white focus:outline-none focus:border-genesis-accent transition-all font-mono resize-none placeholder:text-white/20 max-h-[200px]"
                          placeholder="Descreva sua dúvida ou problema detalhadamente..."
                        />
                      </div>
                    </div>

                    <button 
                      type="submit"
                      disabled={isSending}
                      className="w-full mt-8 py-5 bg-white text-black hover:bg-white/90 rounded-xl font-bold text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(255,255,255,0.05)]"
                    >
                      {isSending ? (
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          ENVIAR MENSAGEM <Send size={14} />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
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
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">Atendimento Seguro & Educacional</span>
           </div>
           <div className="flex flex-col items-center md:items-end gap-1">
             <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Gênesis Protocol • v2.8 SUPPORT HUB</p>
             <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest">CNPJ: 47.610.776/0001-97</p>
           </div>
        </motion.div>
      </div>
    </div>
  );
};

export default SupportPage;
