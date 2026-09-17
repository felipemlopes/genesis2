import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { ActiveTrade, ChartMetadata, GenesisAnalysisResult } from '../types';
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
import { getMe, isAuthenticated as checkAuth, getLeverageBracket } from '../services/api';

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
  // V6.7 (B-22): aviso quando a troca de corretora ajustou a alavancagem escolhida — null quando
  // não há aviso pendente (dispensado pela tela depois de mostrado).
  avisoAlavancagem: string | null;
  setAvisoAlavancagem: React.Dispatch<React.SetStateAction<string | null>>;
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

  analysisResult: GenesisAnalysisResult | null;
  setAnalysisResult: React.Dispatch<React.SetStateAction<GenesisAnalysisResult | null>>;
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
  // Genesis Brain V2 (Fase 6, item 20.4, Fonte §52): teto real do contrato Binance pro símbolo
  // selecionado (via GET /v1/leverage-brackets/{symbol}) — null quando indisponível (sem bracket
  // real, ou corretora selecionada não é Binance) ou ainda não avaliado; nesse caso a lista fixa
  // por exchange (leverageOptions acima) vale sem corte nenhum, nunca bloqueado por esta consulta.
  const [binanceMaxLeverage, setBinanceMaxLeverage] = useState<number | null>(null);
  // V6.7 (B-22): aviso visível quando a troca de corretora força um ajuste na alavancagem escolhida
  // (a corretora nova não oferece o valor atual) — null quando não há aviso pendente.
  const [avisoAlavancagem, setAvisoAlavancagem] = useState<string | null>(null);

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

  const [analysisResult, setAnalysisResult] = useState<GenesisAnalysisResult | null>(null);
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
    if (!isAuthenticated) {
      setIsAdmin(false);
      return;
    }

    let cancelado = false;

    // Achado real em produção (11/09/2026): getMe() falhava de forma intermitente (401
    // esporádico contra um token válido, confirmado no log — o mesmo token voltava a
    // funcionar segundos depois sem nenhuma ação do usuário). Antes, QUALQUER falha aqui
    // derrubava a sessão inteira (setIsAuthenticated(false) -> ProtectedRoute manda pro
    // /login) mesmo com o token continuando válido — ficou mais visível com F5 porque um
    // reload sempre dispara esta checagem de novo, enquanto navegar dentro da SPA não.
    //
    // Não é validade de token: [AUTH] cria os tokens sem expiração nenhuma (config/sanctum.php,
    // `expiration => null`; confirmado também no banco, `expires_at` sempre NULL) e um teste
    // direto e controlado (25 chamadas seguidas com o mesmo token, sem intervalo) devolveu
    // 200 em todas — a origem exata da instabilidade pontual não foi isolada, mas não é o
    // backend rejeitando um token válido de forma sistemática. Reforço extra de margem aqui:
    // 2 tentativas (3 no total) em vez de 1, com backoff crescente.
    const tentar = async (tentativasRestantes: number, tentativaAtual: number = 0): Promise<void> => {
      try {
        const user = await getMe();
        if (cancelado) return;
        if (!user) {
          setIsAuthenticated(false);
        } else {
          setIsAdmin(user.role === 'admin');
        }
      } catch (err) {
        if (cancelado) return;
        if (tentativasRestantes > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500 * (tentativaAtual + 1)));
          if (!cancelado) await tentar(tentativasRestantes - 1, tentativaAtual + 1);
        } else {
          setIsAuthenticated(false);
        }
      }
    };

    tentar(2);

    return () => {
      cancelado = true;
    };
  }, [isAuthenticated]);

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
      // V6.7 (B-22): antes caía num padrão fixo (5x, ou o primeiro valor da lista) em silêncio quando
      // a corretora nova não tinha a alavancagem atual — o membro só descobria olhando o seletor.
      // Agora escolhe o valor válido mais próximo PARA BAIXO (nunca inventa um padrão) e avisa.
      if (!options.includes(leverage)) {
        const maisProximoParaBaixo = [...options].reverse().find((opt) => opt <= leverage) ?? options[0];
        setAvisoAlavancagem(
          `${exchange} não oferece ${leverage}x — alavancagem ajustada para ${maisProximoParaBaixo}x.`
        );
        setLeverage(maisProximoParaBaixo);
      } else {
        setAvisoAlavancagem(null);
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

  // Genesis Brain V2 (Fase 6, item 20.4, Fonte §52): a análise gráfica em si sempre roda contra
  // Binance USD-M, independente da corretora escolhida aqui pro dashboard de preços — então o
  // teto real do contrato só se aplica (e só vale a pena consultar) quando `exchange==='Binance'`.
  // Trocar de par sempre reavalia; nunca bloqueia a tela enquanto a consulta está em andamento.
  useEffect(() => {
    if (!isAuthenticated || exchange !== 'Binance' || !selectedPair) {
      setBinanceMaxLeverage(null);
      return;
    }
    let cancelado = false;
    getLeverageBracket(selectedPair).then((resultado) => {
      if (!cancelado) {
        setBinanceMaxLeverage(resultado.available ? resultado.max_leverage : null);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [exchange, selectedPair, isAuthenticated]);

  // Lista efetiva oferecida ao membro — a base por exchange (getLeverageOptions), estreitada pelo
  // teto real do contrato quando disponível. Nunca amplia, só corta; nunca fica vazia (garante ao
  // menos o menor valor da base, mesmo abaixo do teto real, pra nunca travar o seletor sem opção).
  const effectiveLeverageOptions = useMemo(() => {
    if (binanceMaxLeverage === null || leverageOptions.length === 0) return leverageOptions;
    const filtradas = leverageOptions.filter((opt) => opt <= binanceMaxLeverage);
    return filtradas.length > 0 ? filtradas : [leverageOptions[0]];
  }, [leverageOptions, binanceMaxLeverage]);

  // Mesma disciplina do ajuste por troca de exchange (B-22, acima) — nunca inventa um padrão,
  // sempre avisa quando o teto real do contrato força a leitura atual pra baixo.
  useEffect(() => {
    if (effectiveLeverageOptions.length === 0 || effectiveLeverageOptions.includes(leverage)) return;
    const maisProximoParaBaixo = [...effectiveLeverageOptions].reverse().find((opt) => opt <= leverage) ?? effectiveLeverageOptions[0];
    setAvisoAlavancagem(
      `${selectedPair} aceita no máximo ${binanceMaxLeverage}x neste contrato — alavancagem ajustada para ${maisProximoParaBaixo}x.`
    );
    setLeverage(maisProximoParaBaixo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLeverageOptions]);

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
        leverageOptions: effectiveLeverageOptions,
        avisoAlavancagem,
        setAvisoAlavancagem,
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
