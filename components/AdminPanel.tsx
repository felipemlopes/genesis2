
import React, { useState } from 'react';
import { 
  X, ShieldCheck, Activity, Users, Database, ArrowRight, 
  CreditCard, BookOpen, ClipboardList, BarChart3, 
  UserPlus, UserMinus, ShieldAlert, History, Settings2,
  CheckCircle2, AlertCircle, Clock
} from 'lucide-react';

interface AdminPanelProps {
  onClose: () => void;
}

type AdminTab = 'dashboard' | 'users' | 'credits' | 'content' | 'audit';

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');


  // Mock Data para visualização gerencial (Respeitando a estrutura do sistema)
  const stats = [
    { label: 'Usuários Ativos', value: '1.248', trend: '+5%', color: 'text-genesis-positive' },
    { label: 'Consumo (24h)', value: '14.500cr', trend: '+12%', color: 'text-genesis-accent' },
    { label: 'Novos Planos', value: '42', trend: '+2%', color: 'text-blue-400' },
    { label: 'Retenção Trimestral', value: '94%', trend: 'Estável', color: 'text-emerald-400' }
  ];

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <div key={i} className="bg-genesis-card p-6 rounded-xl  shadow-lg">
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2">{s.label}</div>
            <div className={`text-3xl font-bold ${s.color} mb-1`}>{s.value}</div>
            <div className="text-[10px] text-gray-500 font-mono">{s.trend} em relação ao período anterior</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-genesis-card rounded-xl  p-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <BarChart3 size={16} className="text-genesis-accent" /> Atividade das Funcionalidades
          </h3>
          <div className="space-y-4">
            {[
              { label: 'Análise Gênesis (Gemini Pro)', usage: 85, color: 'bg-genesis-accent' },
              { label: 'Radar de Oportunidades', usage: 65, color: 'bg-genesis-positive' },
              { label: 'FlowTrack On-Chain', usage: 45, color: 'bg-blue-500' },
              { label: 'Gestão de Risco', usage: 30, color: 'bg-orange-500' }
            ].map((f, i) => (
              <div key={i}>
                <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 mb-1.5">
                  <span>{f.label}</span>
                  <span>{f.usage}%</span>
                </div>
                <div className="h-1.5 w-full bg-black rounded-full overflow-hidden">
                  <div className={`h-full ${f.color}`} style={{ width: `${f.usage}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-genesis-card rounded-xl  p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-genesis-positive/10 rounded-full flex items-center justify-center mx-auto mb-4 border-genesis-positive/20">
              <ShieldCheck className="text-genesis-positive" size={32} />
            </div>
            <div className="text-gray-400 mb-1 text-[10px] font-bold uppercase">Saúde do Ecossistema</div>
            <div className="text-5xl font-bold text-white mb-2">100%</div>
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Todos os módulos operacionais</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="bg-genesis-card rounded-xl  overflow-hidden animate-in slide-in- duration-500">
      <div className="p-6  flex justify-between items-center bg-white/[0.02]">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Gestão de Alunos e Acessos</h3>
        <button className="bg-genesis-accent hover:bg-genesis-primaryHover text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2">
          <UserPlus size={14} /> Novo Cadastro
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[10px] font-bold text-gray-500 uppercase tracking-widest  bg-black/40">
              <th className="px-6 py-4">Usuário</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Plano</th>
              <th className="px-6 py-4">Créditos</th>
              <th className="px-6 py-4">Último Acesso</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[
              { name: 'ana.trader@email.com', status: 'Ativo', plan: 'Black Edition', credits: '1.250', last: 'Hoje, 14:20' },
              { name: 'marcos.crypto@email.com', status: 'Ativo', plan: 'Standard', credits: '120', last: 'Há 2 horas' },
              { name: 'jose.invest@email.com', status: 'Suspenso', plan: 'Elite', credits: '850', last: 'Há 3 dias' },
              { name: 'carla.futures@email.com', status: 'Ativo', plan: 'Black Edition', credits: '2.100', last: 'Ontem, 21:00' },
            ].map((user, i) => (
              <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-6 py-4 text-xs font-medium text-white">{user.name}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                    user.status === 'Ativo' ? 'border-green-500/30 text-green-400 bg-green-900/10' : 'border-red-500/30 text-red-400 bg-red-900/10'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-gray-400">{user.plan}</td>
                <td className="px-6 py-4 text-xs font-mono text-genesis-accent font-bold">{user.credits}</td>
                <td className="px-6 py-4 text-[10px] text-gray-500 font-mono">{user.last}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button title="Editar" className="p-1.5 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"><Settings2 size={14} /></button>
                    <button title="Bloquear" className="p-1.5 hover:bg-red-900/20 rounded text-gray-600 hover:text-red-400 transition-colors"><ShieldAlert size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCredits = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-genesis-card rounded-xl  p-6">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <History size={16} className="text-genesis-accent" /> Fluxo de Consumo Recente
          </h3>
          <div className="space-y-4">
             {[
               { user: 'ana.trader@email.com', action: 'Análise de Gráfico (SOL)', amount: '-15cr', time: 'Há 5 minutos' },
               { user: 'marcos.crypto@email.com', action: 'Varredura Radar (1h)', amount: '-5cr', time: 'Há 12 minutos' },
               { user: 'carla.futures@email.com', action: 'FlowTrack BTC', amount: '-10cr', time: 'Há 18 minutos' },
               { user: 'ana.trader@email.com', action: 'Recarga de Créditos', amount: '+500cr', time: 'Há 1 hora', bonus: true }
             ].map((log, i) => (
               <div key={i} className="flex justify-between items-center p-3 rounded bg-black/40 ">
                 <div>
                   <div className="text-[10px] font-bold text-white">{log.user}</div>
                   <div className="text-[9px] text-gray-500 uppercase">{log.action}</div>
                 </div>
                 <div className="text-right">
                   <div className={`text-xs font-mono font-bold ${log.amount.startsWith('+') ? 'text-genesis-positive' : 'text-genesis-negative'}`}>
                     {log.amount}
                   </div>
                   <div className="text-[9px] text-gray-600 font-mono">{log.time}</div>
                 </div>
               </div>
             ))}
          </div>
        </div>
        <div className="bg-genesis-card rounded-xl  p-6 flex flex-col">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Controle de Planos</h3>
          <div className="space-y-4 flex-1">
             {[
               { name: 'Elite', users: 145, price: 'R$ 297/mês', color: 'bg-emerald-500' },
               { name: 'Black Edition', users: 890, price: 'R$ 597/mês', color: 'bg-genesis-accent' },
               { name: 'Standard', users: 213, price: 'R$ 147/mês', color: 'bg-gray-500' }
             ].map((p, i) => (
               <div key={i} className="p-[16px] rounded-lg  bg-white/5">
                 <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-white uppercase">{p.name}</span>
                    <span className="text-[9px] text-gray-500 font-mono">{p.price}</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 bg-black rounded-full overflow-hidden">
                       <div className={`h-full ${p.color}`} style={{ width: '70%' }}></div>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">{p.users} alunos</span>
                 </div>
               </div>
             ))}
          </div>
          <button className="w-full mt-6 bg-white/5 hover:bg-white/10 text-white p-3 rounded text-[10px] font-bold uppercase tracking-widest  transition-all">
            Configurar Novos Planos
          </button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
      {[
        { title: 'Guia: OCO e OCOI', module: 'Análise Gráfica', status: 'Publicado', students: 1102 },
        { title: 'Dinâmica do Open Interest', module: 'Fluxo', status: 'Publicado', students: 845 },
        { title: 'Setup: Squeeze de Liquidez', module: 'Estratégias', status: 'Rascunho', students: 0 },
        { title: 'Psicologia em Futuros', module: 'Mindset', status: 'Publicado', students: 950 }
      ].map((item, i) => (
        <div key={i} className="bg-genesis-card  rounded-[10px] p-5 hover:border-genesis-accent/30 transition-all">
          <div className="flex justify-between items-start mb-4">
             <span className="text-[9px] font-bold text-genesis-accent bg-genesis-accent/10 px-2 py-0.5 rounded border-genesis-accent/20 uppercase">
               {item.module}
             </span>
             <span className={`text-[8px] font-bold uppercase ${item.status === 'Publicado' ? 'text-genesis-positive' : 'text-gray-500'}`}>
               {item.status}
             </span>
          </div>
          <h4 className="text-sm font-bold text-white mb-2">{item.title}</h4>
          <div className="flex items-center justify-between mt-6 pt-4 ">
             <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
               <Users size={12} /> {item.students} concluíram
             </div>
             <button className="text-genesis-accent hover:text-white transition-colors"><Settings2 size={16} /></button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAudit = () => (
    <div className="bg-genesis-card rounded-xl  overflow-hidden animate-in fade-in duration-500">
      <div className="p-6  bg-white/[0.02]">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Logs de Auditoria e Segurança</h3>
      </div>
      <div className="p-6 space-y-3">
        {[
          { icon: <CheckCircle2 size={14} className="text-genesis-positive" />, msg: 'Backup do banco de dados concluído com sucesso.', time: 'Hoje, 04:00', type: 'Sistema' },
          { icon: <AlertCircle size={14} className="text-orange-400" />, msg: 'Tentativa de login bloqueada: IP 182.xx.xx (Múltiplas falhas).', time: 'Hoje, 10:15', type: 'Segurança' },
          { icon: <Settings2 size={14} className="text-blue-400" />, msg: 'Alteração de plano: Usuário marcos.crypto movido para Elite.', time: 'Ontem, 16:45', type: 'Admin' },
          { icon: <Clock size={14} className="text-gray-500" />, msg: 'Expiração de 1.200 créditos inativos processada.', time: 'Há 2 dias', type: 'Créditos' }
        ].map((log, i) => (
          <div key={i} className="flex items-center gap-[16px] p-[16px] rounded bg-black/40  group hover: transition-colors">
            <div className="p-2 rounded bg-white/5 ">{log.icon}</div>
            <div className="flex-1">
               <div className="text-xs text-gray-300">{log.msg}</div>
               <div className="text-[9px] text-gray-600 font-mono uppercase mt-1">{log.type} • {log.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: Activity },
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'credits', label: 'Créditos & Planos', icon: CreditCard },
    { id: 'content', label: 'Conteúdo', icon: BookOpen },
    { id: 'audit', label: 'Auditoria', icon: ClipboardList }
  ];

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/95 shadow-xl p-[16px] animate-in fade-in zoom-in duration-300">
      <div className="w-full max-w-7xl h-[90vh] bg-genesis-base  rounded-2xl flex overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]">
        
        {/* Sidebar Administrativa */}
        <div className="w-72 bg-genesis-card  p-8 flex flex-col">
           <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 bg-genesis-accent/10 rounded-xl flex items-center justify-center border-genesis-accent/20">
                <ShieldCheck className="text-genesis-accent" size={24} />
              </div>
              <div>
                <span className="font-bold text-lg text-white block leading-none">ADMIN</span>
                <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Gênesis Labs</span>
              </div>
           </div>
           
           <nav className="space-y-1.5 flex-1">
             {navItems.map((item) => (
               <button
                 key={item.id}
                 onClick={() => setActiveTab(item.id as AdminTab)}
                 className={`w-full p-3.5 rounded-xl cursor-pointer flex items-center gap-[16px] transition-all duration-300 group
                   ${activeTab === item.id 
                     ? 'bg-genesis-accent/10 text-genesis-accent border-genesis-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]' 
                     : 'text-gray-500 hover:text-white hover:bg-white/5 '}`}
               >
                 <item.icon size={20} className={`transition-colors ${activeTab === item.id ? 'text-genesis-accent' : 'group-hover:text-white'}`} />
                 <span className="font-medium text-sm tracking-wide">{item.label}</span>
               </button>
             ))}
           </nav>

           <div className="mt-auto space-y-4">
             <div className="p-[16px] rounded-xl bg-white/[0.02] ">
                <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2">Sessão Segura</div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                   <div className="w-1.5 h-1.5 rounded-full bg-genesis-positive animate-pulse"></div>
                   Autenticado como SuperAdmin
                </div>
             </div>
             <button 
               onClick={onClose} 
               className="w-full bg-white text-black hover:bg-genesis-positive transition-all p-3.5 rounded-xl flex items-center justify-center gap-3 text-xs font-bold uppercase tracking-widest"
             >
               Voltar ao Terminal <ArrowRight size={14} />
             </button>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-black">
          <div className="h-20 px-10  flex items-center justify-between shrink-0 bg-genesis-base/50 ">
            <h1 className="text-xl font-thin text-white uppercase tracking-[0.2em]">
               {navItems.find(i => i.id === activeTab)?.label}
            </h1>
            <div className="flex items-center gap-6">
               <div className="hidden md:flex flex-col text-right">
                  <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Base de Dados</span>
                  <span className="text-xs font-mono text-genesis-positive">CONECTADO • REALTIME</span>
               </div>
               <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-white">
                  <X size={24} />
               </button>
            </div>
          </div>

          <div className="flex-1 p-10 overflow-y-auto custom-scrollbar bg-black">
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'credits' && renderCredits()}
            {activeTab === 'content' && renderContent()}
            {activeTab === 'audit' && renderAudit()}
          </div>
          
          <div className="h-12 px-10  flex items-center justify-between text-[9px] text-gray-700 font-mono uppercase tracking-[0.2em] bg-black/40">
             <span>Gênesis Labs Protocol v2.8</span>
             <span>© 2025 • Todos os direitos reservados à administração</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
