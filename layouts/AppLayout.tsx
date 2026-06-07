import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Trophy, X, Menu } from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import { fetchCredits } from '../services/api';
import Sidebar from '../components/Sidebar';
import MarketTicker from '../components/MarketTicker';
import MarketWidget from '../components/MarketWidget';
import GlobalGeopoliticalAlert from '../components/GlobalGeopoliticalAlert';
import GeoNotificationToast from '../components/GeoNotificationToast';
import RadarNewsPopup from '../components/RadarNewsPopup';
import AdminPanel from '../components/AdminPanel';
import MicroRadarPanel from '../components/MicroRadarPanel';

const AppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    targetHitPopup,
    setTargetHitPopup,
    isAuthenticated,
    setIsAuthenticated,
    exchange, setExchange,
    selectedPair, setSelectedPair,
    timeframe, setTimeframe,
    marketData,
    cvdData,
  } = useAppContext();

  const [logoClicks, setLogoClicks] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    fetchCredits().then(setCredits);
  }, [isAuthenticated]);

  const showMarket = location.pathname === '/dashboard';

  const handleLogoClick = () => {
    setLogoClicks((prev) => {
      const newCount = prev + 1;
      if (newCount === 5) {
        setShowAdmin(true);
        return 0;
      }
      return newCount;
    });
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
  };

  const handleConfirmProfitLocal = () => {
    if (targetHitPopup.trade) {
      setTargetHitPopup({ show: false, trade: null });
    }
  };

  return (
    <div className="flex h-screen bg-genesis-base text-genesis-text-primary overflow-hidden font-sans selection:bg-genesis-positive selection:text-black animate-in fade-in duration-1000">
      <GlobalGeopoliticalAlert onNavigateToRadar={() => navigate('/dashboard/geopolitica')} />
      <GeoNotificationToast onNavigateToRadar={() => navigate('/dashboard/geopolitica')} />

      {targetHitPopup.show && targetHitPopup.trade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-in fade-in zoom-in duration-300">
          <div className="bg-genesis-card backdrop-blur-xl genesis-positive rounded-[10px] p-4 max-w-sm w-full shadow-[0_0_50px_rgba(16,185,129,0.1)] relative">
            <button
              onClick={() => setTargetHitPopup({ show: false, trade: null })}
              className="absolute top-4 right-4 text-genesis-text-secondary hover:text-white"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-genesis-positive/10 rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <Trophy size={32} className="text-genesis-positive" />
              </div>
              <h2 className="text-xl font-light text-white uppercase tracking-widest mb-2">Meta Atingida</h2>
              <p className="text-genesis-text-secondary text-xs mb-6">
                Operação em <span className="text-white font-bold">{targetHitPopup.trade.asset}</span> finalizada.
              </p>
              <div className="bg-black/40 rounded-lg p-4 w-full mb-6 white/5">
                <div className="text-[10px] text-genesis-text-secondary uppercase font-bold tracking-widest mb-1">Lucro Realizado</div>
                <div className="text-3xl font-mono font-bold text-genesis-positive">
                  {(targetHitPopup.trade.pnl || '$0.00').split(' ')[0]}
                </div>
              </div>
              <button
                onClick={handleConfirmProfitLocal}
                className="w-full bg-genesis-positive hover:bg-emerald-500 text-black font-bold py-3 rounded text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
              >
                Confirmar Lucro
              </button>
            </div>
          </div>
        </div>
      )}

      <Sidebar onLogoClick={handleLogoClick} onLogout={handleLogout} isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-black">
        <header className="h-[46px] border-white/[0.03] flex items-center justify-between px-8 bg-genesis-surface backdrop-blur-2xl border-white/.0.05. z-0 relative">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-genesis-text-secondary hover:text-white transition-colors"
            >
              <Menu size={20} />
            </button>
            <span className="w-1.5 h-1.5 rounded-full bg-genesis-positive shadow-[0_0_15px_rgba(57,255,20,0.8)] animate-pulse"></span>
            <span className="text-[9px] font-bold text-genesis-text-muted tracking-[0.14em] uppercase">Terminal Ativo</span>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none flex items-baseline gap-2">
            <h1 className="text-[18px] font-bold text-white" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em' }}>
              Gênesis
            </h1>
            <span className="text-[11px] font-medium uppercase text-genesis-text-muted" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: '0.14em' }}>
              Labs
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <div className="text-[9px] text-genesis-text-secondary uppercase tracking-widest font-bold">Créditos</div>
                <div className="text-xs font-mono text-genesis-positive">
                  {credits !== null ? credits.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
                </div>
              </div>
            </div>
            <button onClick={handleLogout} className="text-genesis-text-secondary hover:text-white transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <MarketTicker />

        <div className="px-4 md:px-8 pt-4">
          <MicroRadarPanel />
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative custom-scrollbar bg-black">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="w-full flex-1 flex flex-col"
            >
              {showMarket && (
                <>
                  <div className="flex items-center gap-2 mb-6 opacity-60">
                    <span className="w-1 h-1 rounded-full bg-gray-500"></span>
                    <span className="text-[9px] font-bold text-genesis-text-secondary uppercase tracking-[0.2em]">LIVE DATA FEED</span>
                  </div>
                  <MarketWidget
                    selectedPair={selectedPair}
                    activeExchange={exchange}
                    data={marketData}
                    cvdData={cvdData}
                    onAnalyzeAnomaly={(ex, pair, tf) => { setExchange(ex); setSelectedPair(pair); setTimeframe(tf); }}
                  />
                </>
              )}

              <Outlet />
            </motion.div>
          </AnimatePresence>

          <footer className="mt-12 mb-6 border-white/5 pt-6 text-center max-w-4xl mx-auto px-4 space-y-3">
            <p className="text-[9px] text-white/60 leading-relaxed font-mono animate-pulse">
              AVISO: O Gênesis Labs é uma ferramenta exclusivamente educacional e instrutiva. A responsabilidade sobre ganhos e perdas pertence única e exclusivamente ao investidor, que é o responsável final por todas as suas decisões de trade.
            </p>
            <p className="text-[9px] text-white/40 font-mono">CNPJ: 47.610.776/0001-97</p>
          </footer>
        </div>
      </main>

      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      <RadarNewsPopup />
    </div>
  );
};

export default AppLayout;
