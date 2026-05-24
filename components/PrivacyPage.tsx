
import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShieldCheck, Lock, ChevronDown, ChevronUp, Eye, FileText, UserCheck } from 'lucide-react';

interface PrivacyPageProps {
  onBack: () => void;
}

const FAQItem: React.FC<{ question: string; children: React.ReactNode }> = ({ question, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className=" last:border-0 overflow-hidden transition-all duration-300">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex items-center justify-between text-left group hover:bg-white/[0.01] transition-colors px-4 -mx-4"
      >
        <span className={`text-sm md:text-base font-medium tracking-tight transition-colors ${isOpen ? 'text-genesis-positive' : 'text-gray-300 group-hover:text-white'}`}>
          {question}
        </span>
        <div className={`p-1 rounded-full  transition-all ${isOpen ? 'rotate-180 bg-genesis-positive/10 border-genesis-positive/20 text-genesis-positive' : 'text-gray-600'}`}>
          <ChevronDown size={18} />
        </div>
      </button>
      <div className={`transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[500px] opacity-100 pb-8' : 'max-h-0 opacity-0'}`}>
        <div className="text-sm text-gray-400 leading-relaxed font-light pl-2 border-genesis-accent/30 ml-1">
          {children}
        </div>
      </div>
    </div>
  );
};

const PrivacyPage: React.FC<PrivacyPageProps> = ({ onBack }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-genesis-positive selection:text-black animate-in fade-in duration-700">
      {/* BACKGROUND DECORATION */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[30%] h-[40%] bg-genesis-accent/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[25%] h-[35%] bg-genesis-positive/5 rounded-full blur-[100px]"></div>
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
        <header className="mb-20">
          <div className="flex items-center gap-2 text-genesis-positive mb-4">
              <ShieldCheck size={20} />
              <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Segurança e Confiança</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-thin tracking-tighter text-white uppercase leading-tight mb-8">
            Privacidade e <span className="font-bold">proteção de dados</span>
          </h1>
          <p className="text-gray-400 leading-relaxed text-justify  pl-6 max-w-3xl">
            O Gênesis Labs respeita a privacidade dos usuários e trata os dados pessoais de forma responsável, transparente e em conformidade com a Lei Geral de Proteção de Dados. Esta página explica como as informações são coletadas, utilizadas e protegidas dentro da plataforma.
          </p>
        </header>

        {/* ACCORDION SECTION */}
        <div className="space-y-2 bg-genesis-input rounded-[8px] p-[12px_14px]  rounded-3xl p-6 md:p-10  shadow-2xl">
          
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
            <div className="p-[16px] bg-red-900/10 border-red-900/20 rounded-xl">
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

        {/* FOOTER DECORATION */}
        <div className="mt-20 pt-12  flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
           <div className="flex items-center gap-3">
              <Lock size={16} className="text-gray-500" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">Privacidade Criptografada</span>
           </div>
           <p className="text-[9px] font-mono text-gray-500 uppercase">Gênesis Labs v2.8 • Data Protection Protocol</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
