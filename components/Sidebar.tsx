import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Terminal,
  Zap,
  BarChart2,
  Wallet,
  Radar,
  Shapes,
  Compass,
  Activity,
  Waves,
  Percent,
  Skull,
  LineChart,
  Layers,
  Briefcase,
  Globe,
  Calculator,
  GraduationCap,
  Headphones,
  LogOut,
  X,
} from 'lucide-react';

const ROUTE_MAP: Record<string, string> = {
  genesis: '/dashboard',
  carteira: '/dashboard/carteira',
  active_trades: '/dashboard/trades',
  analysis_history: '/dashboard/performance',
  scanner: '/dashboard/scanner',
  patterns: '/dashboard/padroes',
  trend_analyzer: '/dashboard/tendencia',
  mind_metrics: '/dashboard/mind-metrics',
  flowtrack: '/dashboard/flowtrack',
  funding: '/dashboard/funding',
  liquidation: '/dashboard/liquidacao',
  oi_monitor: '/dashboard/oi-monitor',
  liquidity_map: '/dashboard/liquidez',
  smart_money: '/dashboard/smart-money',
  geopolitical_radar: '/dashboard/geopolitica',
  risk: '/dashboard/risco',
  new_listings: '/dashboard/listagens',
  learn: '/dashboard/aprender',
  support: '/dashboard/suporte',
};

interface MenuItem {
  id: string;
  icon: React.ElementType;
  label: string;
}

const MENU_SECTIONS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Principal',
    items: [
      { id: 'genesis', icon: Zap, label: 'Gênesis' },
      { id: 'carteira', icon: Wallet, label: 'Carteira Cripto' },
      { id: 'analysis_history', icon: BarChart2, label: 'Performance' },
    ],
  },
  {
    title: 'Análise',
    items: [
      { id: 'scanner', icon: Radar, label: 'Radar' },
      { id: 'patterns', icon: Shapes, label: 'Figuras Gráficas' },
      { id: 'trend_analyzer', icon: Compass, label: 'Qual Tendência?' },
      { id: 'mind_metrics', icon: Activity, label: 'Mind Metrics' },
    ],
  },
  {
    title: 'Mercado',
    items: [
      { id: 'flowtrack', icon: Waves, label: 'FlowTrack' },
      { id: 'funding', icon: Percent, label: 'Funding Monitor' },
      { id: 'liquidation', icon: Skull, label: 'Liquidation Radar' },
      { id: 'oi_monitor', icon: LineChart, label: 'OI & Liq.' },
      { id: 'liquidity_map', icon: Layers, label: 'Liquidity Map' },
      { id: 'smart_money', icon: Briefcase, label: 'Smart Money' },
    ],
  },
  {
    title: 'Contexto',
    items: [
      { id: 'geopolitical_radar', icon: Globe, label: 'Radar News' },
      { id: 'risk', icon: Calculator, label: 'Gestão de Risco' },
      { id: 'new_listings', icon: Zap, label: 'Nova Listagem' },
      { id: 'learn', icon: GraduationCap, label: 'Aprenda Futuros' },
      { id: 'support', icon: Headphones, label: 'Suporte' },
    ],
  },
];

interface SidebarProps {
  onLogoClick: () => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const SidebarContent: React.FC<{ onLogoClick: () => void; onLogout: () => void; onNavigate?: () => void }> = ({
  onLogoClick,
  onLogout,
  onNavigate,
}) => {
  return (
    <>
      <div className="h-20 flex items-center px-6 border-white/[0.03]">
        <div className="flex items-center gap-3 cursor-pointer select-none" onClick={onLogoClick}>
          <div className="w-7 h-7 rounded-md white/.0.05. flex items-center justify-center bg-white/[0.03]">
            <Terminal size={18} className="text-genesis-accent" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-lg text-white" style={{ letterSpacing: '-0.01em' }}>Gênesis</span>
            <span className="bg-genesis-accent-dim text-genesis-accent genesis-accent-text-[9px] uppercase px-[6px] py-[2px] rounded-[4px] font-bold">LABS</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        {MENU_SECTIONS.map((section, sectionIndex) => (
          <React.Fragment key={section.title}>
            {sectionIndex > 0 && <div className="border-white/[0.03] mx-1" />}
            <div>
              <div className="text-[9px] font-bold text-gray-700 uppercase tracking-[0.14em] px-2 mb-1">
                {section.title}
              </div>
              {section.items.map((item) => (
                <NavLink
                  key={item.id}
                  to={ROUTE_MAP[item.id]}
                  end={ROUTE_MAP[item.id] === '/dashboard'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 group mb-[2px] ${
                      isActive
                        ? 'bg-genesis-accent/[0.1] text-white shadow-[0_0_15px_rgba(176,38,255,0.1)]'
                        : 'text-genesis-text-secondary hover:text-white hover:bg-genesis-accent/[0.05]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={15}
                        className={`flex-shrink-0 transition-all duration-300 ${
                          isActive
                            ? 'text-genesis-accent drop-shadow-[0_0_8px_rgba(176,38,255,0.8)]'
                            : 'text-genesis-text-muted group-hover:text-genesis-accent group-hover:drop-shadow-[0_0_5px_rgba(176,38,255,0.4)]'
                        }`}
                      />
                      <span className="text-[12px] font-medium tracking-wide">{item.label}</span>
                      {isActive && <span className="ml-auto w-1 h-1 rounded-full bg-genesis-accent flex-shrink-0" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </React.Fragment>
        ))}
      </nav>

      <div className="p-4 border-white/[0.03] flex gap-2">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-2 py-[7px] rounded-md text-genesis-text-muted hover:text-genesis-negative hover:bg-genesis-negative/10 transition-all duration-150 group"
        >
          <LogOut size={18} className="group-hover:text-genesis-negative transition-colors" />
          <span className="font-light text-xs tracking-widest uppercase">Sair</span>
        </button>
      </div>
    </>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ onLogoClick, onLogout, isOpen, onClose }) => {
  const location = useLocation();

  useEffect(() => {
    //onClose();
  }, [location.pathname]);

  return (
    <>
      <aside className="w-[240px] border-white/[0.03] flex-col bg-[#050505] shadow-[10px_0_30px_rgba(0,0,0,0.6)] z-30 hidden md:flex relative">
        <SidebarContent onLogoClick={onLogoClick} onLogout={onLogout} />
      </aside>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-[#050505] shadow-[10px_0_30px_rgba(0,0,0,0.6)] z-50 flex flex-col md:hidden"
            >
              <button
                onClick={onClose}
                className="absolute top-5 right-4 text-genesis-text-secondary hover:text-white transition-colors z-10"
              >
                <X size={20} />
              </button>
              <SidebarContent onLogoClick={onLogoClick} onLogout={onLogout} onNavigate={onClose} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
