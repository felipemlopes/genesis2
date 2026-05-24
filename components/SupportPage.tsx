
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, MessageCircle, Send, CheckCircle2, Clock, ShieldCheck, Headphones } from 'lucide-react';

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
    <div className={`min-h-screen bg-black text-white selection:bg-genesis-positive selection:text-black animate-in fade-in duration-700 ${onBack ? 'pt-0' : 'p-0'}`}>
      
      {/* BACKGROUND DECORATION */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-genesis-accent/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-genesis-positive/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 md:py-20 relative z-10">
        
        {/* BACK BUTTON (Apenas se vier da Landing) */}
        {onBack && (
          <button 
            onClick={onBack}
            className="flex items-center gap-3 text-[10px] font-bold text-gray-500 hover:text-genesis-accent uppercase tracking-[0.2em] transition-all mb-16 group"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Voltar
          </button>
        )}

        {/* HEADER SECTION */}
        <header className="mb-16">
          <div className="flex items-center gap-2 text-genesis-accent mb-4">
              <ShieldCheck size={20} />
              <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Canal Oficial</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-thin tracking-tighter text-white uppercase leading-tight mb-4">
            Suporte <span className="font-bold">Gênesis</span>
          </h1>
          <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">
            Canal oficial de atendimento e suporte educacional
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* BLOCO 1: INFORMAÇÕES DE CONTATO (LEFT) - EXPANDIDO PARA LG:COL-SPAN-5 */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-genesis-card  rounded-2xl p-8 hover: transition-all">
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-8  pb-2">Contatos Diretos</h3>
              
              <div className="space-y-8">
                <div className="flex items-start gap-[16px] group">
                  <div className="p-3 bg-white/5 rounded-xl  group-hover:border-genesis-accent/30 transition-all shrink-0">
                    <Mail size={18} className="text-genesis-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[9px] text-gray-600 font-bold uppercase tracking-widest mb-1">E-mail</span>
                    <a href="mailto:suporte@criptoico.com.br" className="text-sm text-gray-300 hover:text-white transition-colors font-mono whitespace-nowrap block">
                      suporte@criptoico.com.br
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-[16px] group">
                  <div className="p-3 bg-white/5 rounded-xl  group-hover:border-genesis-positive/30 transition-all shrink-0">
                    <MessageCircle size={18} className="text-genesis-positive" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[9px] text-gray-600 font-bold uppercase tracking-widest mb-1">WhatsApp</span>
                    <span className="text-sm text-gray-300 font-mono block whitespace-nowrap">
                      (48) 9 9640-7481
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-[16px] group">
                  <div className="p-3 bg-white/5 rounded-xl  transition-all shrink-0">
                    <Clock size={18} className="text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[9px] text-gray-600 font-bold uppercase tracking-widest mb-1">Horário</span>
                    <span className="text-sm text-gray-300 font-mono block leading-relaxed">
                      Seg - Sex, <span className="whitespace-nowrap">09h às 18h</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTÃO WHATSAPP (AÇÃO DIRETA) */}
            <button 
              onClick={handleWhatsApp}
              className="w-full bg-genesis-positive/10 hover:bg-genesis-positive/20 border-genesis-positive/20 text-genesis-positive p-5 rounded-2xl flex items-center justify-center gap-3 transition-all group"
            >
              <MessageCircle size={20} className="group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Falar via WhatsApp</span>
            </button>
          </div>

          {/* BLOCO 2: FORMULÁRIO DE CONTATO (RIGHT) - AJUSTADO PARA LG:COL-SPAN-7 */}
          <div className="lg:col-span-7">
            <div className="bg-genesis-card  rounded-3xl p-8 md:p-10 relative overflow-hidden h-full">
              <div className="absolute top-0 left-0 w-full h-1   primary/40  opacity-50"></div>
              
              <div className="mb-10">
                <h2 className="text-xl font-light text-white uppercase tracking-widest mb-2 flex items-center gap-3">
                  <Headphones size={20} className="text-genesis-accent" />
                  Mensagem para a Equipe
                </h2>
                <p className="text-gray-500 text-[10px] uppercase tracking-widest font-mono">Tempo médio de resposta: 4 horas</p>
              </div>

              {isSuccess ? (
                <div className="flex flex-col items-center justify-center h-64 text-center animate-in fade-in zoom-in duration-500">
                  <div className="w-16 h-16 bg-genesis-positive/10 rounded-full flex items-center justify-center mb-6 border-genesis-positive/20">
                    <CheckCircle2 size={32} className="text-genesis-positive animate-pulse" />
                  </div>
                  <h3 className="text-lg font-bold text-white uppercase tracking-widest mb-2">Mensagem Enviada</h3>
                  <p className="text-gray-500 text-sm max-w-xs">Sua solicitação foi encaminhada para nossa central de suporte.</p>
                </div>
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1">Seu E-mail</label>
                      <input 
                        required
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-black  rounded-xl py-4 px-4 text-sm text-white focus:outline-none focus:border-genesis-accent transition-all font-mono"
                        placeholder="nome@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1">Assunto</label>
                      <input 
                        required
                        type="text" 
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full bg-black  rounded-xl py-4 px-4 text-sm text-white focus:outline-none focus:border-genesis-accent transition-all font-mono"
                        placeholder="Ex: Dúvida técnica"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-1">Mensagem</label>
                    <textarea 
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={6}
                      className="w-full bg-black  rounded-xl py-4 px-4 text-sm text-white focus:outline-none focus:border-genesis-accent transition-all font-mono resize-none"
                      placeholder="Descreva sua dúvida ou problema detalhadamente..."
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={isSending}
                    className="w-full py-5 bg-white text-black hover:bg-genesis-positive rounded-xl font-bold text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(255,255,255,0.05)]"
                  >
                    {isSending ? (
                      <div className="w-4 h-4 border-black border-t-transparent rounded-full animate-spin"></div>
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
        </div>

        {/* FOOTER DECORATION */}
        <div className="mt-20 pt-12  flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
           <div className="flex items-center gap-3">
              <ShieldCheck size={16} className="text-gray-500" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">Atendimento Seguro & Educacional</span>
           </div>
           <div className="flex flex-col items-end gap-1">
             <p className="text-[9px] font-mono text-gray-500 uppercase text-right">Gênesis Protocol • v2.8 SUPPORT HUB</p>
             <p className="text-[9px] font-mono text-gray-500 uppercase text-right">CNPJ: 47.610.776/0001-97</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
