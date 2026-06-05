import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ActiveTrade, ChartMetadata, TradeSetup } from '../types';
import {
  fetchBinancePairs,
  fetchBybitPairs,
  fetchBitgetPairs,
  fetchOkxPairs,
  fetchBinanceData,
  fetchBybitData,
  fetchBitgetData,
  fetchOkxData,
  getLeverageOptions,
  fetchCVDData,
  ExchangeData,
} from '../services/cryptoApi';
import { calculateFuturesPnL } from '../services/futuresCalculations';
import { getMe, isAuthenticated as checkAuth } from '../services/api';

interface AppContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: (v: boolean) => void;
  isAdmin: boolean;

  theme: 'dark' | 'light';
  toggleTheme: () => void;

  exchange: string;
  setExchange: (v: string) => void;
  selectedPair: string;
  setSelectedPair: (v: string) => void;
  pairsList: string[];
  isLoadingPairs: boolean;
  marketData: ExchangeData;
  cvdData: { delta: number; priceChangePercent: number } | null;
  currentPrice: string | undefined;
  change24h: string | undefined;
  isPositiveChange: boolean;
  refreshTrigger: number;
  setRefreshTrigger: React.Dispatch<React.SetStateAction<number>>;
  isDataLoading: boolean;

  timeframe: string;
  setTimeframe: (v: string) => void;
  equity: string;
  setEquity: (v: string) => void;
  targetProfit: string;
  setTargetProfit: (v: string) => void;
  leverage: number;
  setLeverage: (v: number) => void;
  leverageOptions: number[];
  marginMode: string;
  setMarginMode: (v: string) => void;
  entryValue: number | '';
  setEntryValue: React.Dispatch<React.SetStateAction<number | ''>>;

  activeTrades: ActiveTrade[];
  setActiveTrades: React.Dispatch<React.SetStateAction<ActiveTrade[]>>;
  closedTrades: ActiveTrade[];
  setClosedTrades: React.Dispatch<React.SetStateAction<ActiveTrade[]>>;
  targetHitPopup: { show: boolean; trade: ActiveTrade | null };
  setTargetHitPopup: React.Dispatch<React.SetStateAction<{ show: boolean; trade: ActiveTrade | null }>>;

  scannerState: {
    hasScanned: boolean;
    opportunities: any[];
    lastTimeframe: string;
    scanOffset: number;
  };
  setScannerState: React.Dispatch<React.SetStateAction<{
    hasScanned: boolean;
    opportunities: any[];
    lastTimeframe: string;
    scanOffset: number;
  }>>;

  analysisResult: TradeSetup | null;
  setAnalysisResult: React.Dispatch<React.SetStateAction<TradeSetup | null>>;
  currentAnaliseId: string | null;
  setCurrentAnaliseId: React.Dispatch<React.SetStateAction<string | null>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => checkAuth());
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [exchange, setExchange] = useState('Binance');
  const [selectedPair, setSelectedPair] = useState('BTCUSDT');
  const [pairsList, setPairsList] = useState<string[]>([]);
  const [marketData, setMarketData] = useState<ExchangeData>({ binance: null, bybit: null, bitget: null });
  const [cvdData, setCvdData] = useState<{ delta: number; priceChangePercent: number } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isLoadingPairs, setIsLoadingPairs] = useState(false);

  const [timeframe, setTimeframe] = useState('1d');
  const [equity, setEquity] = useState('1000');
  const [targetProfit, setTargetProfit] = useState('150');
  const [leverage, setLeverage] = useState(5);
  const [entryValue, setEntryValue] = useState<number | ''>('');
  const [marginMode, setMarginMode] = useState('Isolada');
  const [leverageOptions, setLeverageOptions] = useState<number[]>([]);

  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [closedTrades, setClosedTrades] = useState<ActiveTrade[]>([]);
  const [targetHitPopup, setTargetHitPopup] = useState<{ show: boolean; trade: ActiveTrade | null }>({ show: false, trade: null });

  const [scannerState, setScannerState] = useState<{
    hasScanned: boolean;
    opportunities: any[];
    lastTimeframe: string;
    scanOffset: number;
  }>({
    hasScanned: false,
    opportunities: [],
    lastTimeframe: '4h',
    scanOffset: 0,
  });

  const [analysisResult, setAnalysisResult] = useState<TradeSetup | null>(null);
  const [currentAnaliseId, setCurrentAnaliseId] = useState<string | null>(null);

  const currentPrice = marketData[exchange.toLowerCase() as keyof ExchangeData]?.price;
  const change24h = marketData[exchange.toLowerCase() as keyof ExchangeData]?.change24h;
  const isPositiveChange = change24h && !change24h.startsWith('-');

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    if (isAuthenticated) {
      getMe().then(user => {
        if (!user) {
          setIsAuthenticated(false);
        } else {
          setIsAdmin(user.role === 'admin');
        }
      });
    }
  }, []);

  useEffect(() => {
    if (equity) {
      setTargetProfit(Math.floor(Number(equity) * 0.15).toString());
    }
  }, [equity]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadExchangeSettings = async () => {
      setIsLoadingPairs(true);
      const options = getLeverageOptions(exchange);
      setLeverageOptions(options);
      if (!options.includes(leverage)) {
        setLeverage(options.includes(5) ? 5 : options[0]);
      }

      let pairs: string[] = [];
      switch (exchange) {
        case 'Binance': pairs = await fetchBinancePairs(); break;
        case 'Bybit': pairs = await fetchBybitPairs(); break;
        case 'Bitget': pairs = await fetchBitgetPairs(); break;
        case 'OKX': pairs = await fetchOkxPairs(); break;
        default: pairs = ['BTCUSDT'];
      }
      setPairsList(pairs);
      setIsLoadingPairs(false);

      if (!pairs.includes(selectedPair)) {
        if (pairs.length > 0 && (!selectedPair || selectedPair === 'BTCUSDT')) {
          setSelectedPair(pairs[0]);
        }
      }
    };
    loadExchangeSettings();
  }, [exchange, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (selectedPair) setIsDataLoading(true);

    const loadMarketData = async () => {
      try {
        const [binance, bybit, bitget, okx] = await Promise.all([
          fetchBinanceData(selectedPair),
          fetchBybitData(selectedPair),
          fetchBitgetData(selectedPair),
          fetchOkxData(selectedPair),
        ]);
        setMarketData({ binance, bybit, bitget, okx });
      } finally {
        setIsDataLoading(false);
      }
    };

    if (selectedPair) loadMarketData();
    else setIsDataLoading(false);
  }, [selectedPair, refreshTrigger, isAuthenticated]);

  useEffect(() => {
    if (!selectedPair || !isAuthenticated) return;
    const intervalId = setInterval(() => {
      const loadMarketData = async () => {
        const [binance, bybit, bitget, okx] = await Promise.all([
          fetchBinanceData(selectedPair),
          fetchBybitData(selectedPair),
          fetchBitgetData(selectedPair),
          fetchOkxData(selectedPair),
        ]);
        setMarketData({ binance, bybit, bitget, okx });
      };
      loadMarketData();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [selectedPair, isAuthenticated]);

  useEffect(() => {
    if (!selectedPair || !isAuthenticated) return;
    setCvdData(null);
    const loadCVD = async () => {
      try {
        const cvd = await fetchCVDData(selectedPair);
        setCvdData(cvd);
      } catch (e) {
        setCvdData(null);
      }
    };
    loadCVD();
    const i = setInterval(loadCVD, 60000);
    return () => clearInterval(i);
  }, [selectedPair, refreshTrigger, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeTrades.length === 0 || !currentPrice) return;

    const parsePrice = (p: string) => {
      if (!p || p === '-' || p === '---') return 0;
      return parseFloat(p.replace(/[^0-9,.-]+/g, '').replace(',', '.'));
    };

    const currentPriceNum = parsePrice(currentPrice);
    if (currentPriceNum <= 0) return;

    const cleanCurrentAsset = selectedPair.replace('/', '').toUpperCase();

    setActiveTrades((prevTrades) =>
      prevTrades.map((trade) => {
        const cleanTradeAsset = trade.asset.replace('/', '').toUpperCase();
        if (cleanTradeAsset !== cleanCurrentAsset) return trade;
        if (trade.status === 'FECHADO' || trade.status === 'Finalizada') return trade;

        const entry = trade.entryPrice;
        const margin = trade.amount;
        const lev = parseFloat(trade.leverage.replace('x', ''));
        const direction = trade.direction as 'LONG' | 'SHORT';

        const { pnl, roe } = calculateFuturesPnL(entry, currentPriceNum, margin, lev, direction, trade.exchange);

        const pnlDisplay = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${roe.toFixed(2)}%)`;
        const financialTarget = trade.financialTarget || 0;

        let newStatus = trade.status;

        if (trade.status === 'Executada' && financialTarget > 0 && pnl >= financialTarget) {
          newStatus = 'FECHADO';
          return { ...trade, status: newStatus, pnl: pnlDisplay, currentPriceStr: currentPrice };
        }

        return { ...trade, status: newStatus, currentPriceStr: currentPrice, pnl: pnlDisplay };
      })
    );
  }, [currentPrice, isAuthenticated]);

  useEffect(() => {
    const closedTradesFound = activeTrades.filter((t) => t.status === 'FECHADO');

    if (closedTradesFound.length > 0) {
      setClosedTrades((prev) => [...closedTradesFound, ...prev]);
      setActiveTrades((prev) => prev.filter((t) => t.status !== 'FECHADO'));

      const trade = closedTradesFound[0];
      if (!targetHitPopup.show) {
        setTargetHitPopup({
          show: true,
          trade: { ...trade, status: 'Meta Atingida' },
        });
      }
    }
  }, [activeTrades]);

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        isAdmin,
        theme,
        toggleTheme,
        exchange,
        setExchange,
        selectedPair,
        setSelectedPair,
        pairsList,
        isLoadingPairs,
        marketData,
        cvdData,
        currentPrice,
        change24h,
        isPositiveChange: !!isPositiveChange,
        refreshTrigger,
        setRefreshTrigger,
        isDataLoading,
        timeframe,
        setTimeframe,
        equity,
        setEquity,
        targetProfit,
        setTargetProfit,
        leverage,
        setLeverage,
        leverageOptions,
        marginMode,
        setMarginMode,
        entryValue,
        setEntryValue,
        activeTrades,
        setActiveTrades,
        closedTrades,
        setClosedTrades,
        targetHitPopup,
        setTargetHitPopup,
        scannerState,
        setScannerState,
        analysisResult,
        setAnalysisResult,
        currentAnaliseId,
        setCurrentAnaliseId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};
