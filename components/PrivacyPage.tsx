
import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, Lock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";

interface PrivacyPageProps {
  onBack: () => void;
}

const FAQItem: React.FC<{ question: string; children: React.ReactNode }> = ({ question, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="last:border-0 overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group hover:bg-white/[0.02] transition-colors px-4 -mx-4 rounded-xl"
      >
        <span className={`text-sm md:text-base font-medium tracking-wide transition-colors ${isOpen ? 'text-genesis-positive' : 'text-white/80 group-hover:text-white'}`}>
          {question}
        </span>
        <div className={`p-1 rounded-full border border-white/5 bg-white/[0.02] transition-all duration-500 ${isOpen ? 'rotate-180 bg-genesis-positive/10 border-genesis-positive/30 text-genesis-positive' : 'text-white/40 group-hover:text-white group-hover:border-white/20'}`}>
          <ChevronDown size={18} />
        </div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="overflow-hidden"
          >
            <div className="text-sm text-genesis-text-secondary leading-relaxed font-light pl-4 border-l-2 border-genesis-positive/30 ml-2 pb-6 mt-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack }) => {
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

        {/* CONTENT HEADER */}
        <motion.header 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 text-genesis-positive mb-6">
              <ShieldCheck size={16} />
              <span className="w-10 h-px bg-gradient-to-r from-genesis-positive/80 to-transparent"></span>
              <span className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-80">Segurança e Confiança</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-white uppercase leading-tight mb-6">
            Privacidade e <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/60">proteção de dados</span>
          </h1>
          <p className="text-genesis-text-secondary leading-relaxed text-justify max-w-3xl font-light">
            O Gênesis Labs respeita a privacidade dos usuários e trata os dados pessoais de forma responsável, transparente e em conformidade com a Lei Geral de Proteção de Dados. Esta página explica como as informações são coletadas, utilizadas e protegidas dentro da plataforma.
          </p>
        </motion.header>

        {/* ACCORDION SECTION */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative group"
        >
          {/* Neon Style Box Outline for Text container */}
          <div className="absolute -inset-[1px] rounded-[32px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500 group-hover:from-genesis-positive group-hover:to-genesis-positive/5 group-hover:blur-[8px]"></div>
          <div className="absolute -inset-[1px] rounded-[32px] bg-gradient-to-b from-white/10 to-transparent opacity-100 transition-all duration-500"></div>

          <div className="relative bg-[#0c0c0e] rounded-[31px] p-8 md:p-14 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-10 flex flex-col gap-2 divide-y divide-white/5">
            {/* Top Accent lighting */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent transition-all duration-700 group-hover:via-genesis-positive/40"></div>
          
            <FAQItem question="Quais dados o Gênesis Labs coleta?">
              O Gênesis Labs coleta apenas os dados necessários para o funcionamento da plataforma educacional, como informações básicas de cadastro, dados de acesso e informações técnicas relacionadas ao uso do sistema, incluindo e-mail, data e horário de acesso, tipo de dispositivo, navegador e interações dentro da plataforma.
            </FAQItem>

            <FAQItem question="Quais dados o Gênesis Labs não coleta?">
              O Gênesis Labs não coleta dados bancários, não solicita acesso a contas de corretoras, não acessa saldos, não solicita chaves privadas, não executa operações financeiras e não tem qualquer controle sobre recursos do usuário em plataformas externas.
            </FAQItem>

            <FAQItem question="Para que os dados são utilizados?">
              Os dados coletados são utilizados exclusivamente para permitir o acesso à plataforma, garantir segurança, melhorar a experiência do usuário, aprimorar as ferramentas educacionais e assegurar o bom funcionamento do sistema. Nenhuma informação é utilizada para recomendação personalizada de investimentos ou tomada de decisão automatizada.
            </FAQItem>

            <FAQItem question="O Gênesis Labs compartilha ou vende dados pessoais?">
              Não. O Gênesis Labs não vende, não aluga e não compartilha dados pessoais com terceiros para fins comerciais. O compartilhamento de informações pode ocorrer apenas quando exigido por lei ou quando necessário para garantir a segurança e a integridade da plataforma.
            </FAQItem>

            <FAQItem question="Como o Gênesis Labs protege os dados dos usuários?">
              O Gênesis Labs adota medidas técnicas e organizacionais para proteger os dados pessoais, incluindo controle de acesso, monitoramento de atividades suspeitas e práticas de segurança compatíveis com plataformas digitais modernas. Nenhum sistema é totalmente imune a riscos, e o usuário também deve adotar boas práticas de proteção de suas credenciais.
            </FAQItem>

            <FAQItem question="Quem é responsável pela segurança do acesso à conta?">
              O acesso ao Gênesis Labs é pessoal e intransferível. O usuário é responsável por manter a confidencialidade de seu e-mail, senha e dispositivo de acesso. O Gênesis Labs não se responsabiliza por acessos indevidos decorrentes de negligência, compartilhamento de credenciais ou uso inadequado de dispositivos pessoais.
            </FAQItem>

            <FAQItem question="É permitido compartilhar o acesso com terceiros?">
              <p className="mb-4">Não. É expressamente proibido o compartilhamento de acesso ao Gênesis Labs com qualquer outra pessoa. A conta é de uso exclusivo do titular cadastrado e vinculada à sua participação na comunidade.</p>
              <div className="p-5 bg-red-900/10 border border-red-900/20 rounded-xl">
                <p className="text-red-400 font-medium">Caso seja identificado compartilhamento de acesso, uso por terceiros ou qualquer tentativa de burlar os controles da plataforma, a conta poderá ser encerrada de forma definitiva, com a remoção imediata do usuário da comunidade, sem direito a estorno de créditos e sem reembolso de valores pagos para acesso à plataforma.</p>
              </div>
            </FAQItem>

            <FAQItem question="O Gênesis Labs realiza decisões automáticas com base nos dados do usuário?">
              Não. O Gênesis Labs não realiza decisões automatizadas que impactem diretamente o usuário. As ferramentas e análises possuem caráter educacional e servem como apoio à análise individual, cabendo ao usuário interpretar e decidir como utilizá-las.
            </FAQItem>

            <FAQItem question="Quais são os direitos do usuário segundo a LGPD?">
              O usuário pode solicitar acesso, correção, atualização ou exclusão de seus dados pessoais, nos termos da legislação vigente, bem como obter informações sobre o tratamento de seus dados dentro da plataforma.
            </FAQItem>

            <FAQItem question="Por quanto tempo os dados são armazenados?">
              Os dados são armazenados apenas pelo tempo necessário para cumprir as finalidades para as quais foram coletados, respeitando obrigações legais, regulatórias e operacionais.
            </FAQItem>

            <FAQItem question="Esta política de privacidade pode ser atualizada?">
              Sim. Esta política pode ser atualizada para refletir melhorias na plataforma, mudanças legais ou ajustes operacionais. Sempre que houver alterações relevantes, o usuário será informado dentro da própria plataforma.
            </FAQItem>

          </div>
        </motion.div>

        {/* FOOTER DECORATION */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6"
        >
           <div className="flex items-center gap-4">
              <Lock size={16} className="text-white/60" />
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/60">Privacidade Criptografada</span>
           </div>
           <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest">Gênesis Labs v2.8 • Data Protection Protocol</p>
        </motion.div>
      </div>
    </div>
  );
};

export default PrivacyPage;
