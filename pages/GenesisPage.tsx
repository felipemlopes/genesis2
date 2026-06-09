import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Zap,
  ChevronDown,
  Upload,
  ScanEye,
  X,
  CheckCircle,
  BarChart2,
  Quote,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useAppContext } from '../contexts/AppContext';
import AnalysisResult from '../components/AnalysisResult';
import NewsTicker from '../components/NewsTicker';
import OrderBookImbalance from '../components/OrderBookImbalance';
import TrendQuality from '../components/TrendQuality';
import LiquidationHeatmap from '../components/LiquidationHeatmap';
import SectorSentiment from '../components/SectorSentiment';
import { analyzeChart, scanChartMetadata, unifiedChartAnalysis } from '../services/geminiService';
import { normalizarPar } from '../services/normalizarPar';
import { TradeSetup, ChartMetadata, SavedAnalysis, UnifiedChartResult } from '../types';
import { fetchBinanceData, fetchBybitData, fetchBitgetData, fetchOkxData, formatPrice, ExchangeData } from '../services/cryptoApi';
import { calculateLiquidationPrice } from '../services/futuresCalculations';
import { saveAnalysisToHistory } from '../components/AnalysisHistoryDashboard';

const TRADING_QUOTES = [
  "Lucro bom é lucro no bolso.",
  "Nunca deixe dinheiro na mesa se a tendência virou.",
  "O mercado é uma ferramenta para transferir dinheiro dos impacientes para os pacientes.",
  "Lucro não quebra ninguém. Proteja seu capital.",
  "A tendência é sua amiga até que ela termine.",
  "Compre ao som de canhões, venda ao som de violinos.",
  "Não tente adivinhar o fundo, espere a confirmação.",
  "Gerenciamento de risco é mais importante que a análise.",
  "O mercado desconta tudo, menos suas emoções.",
  "Em futuros, a alavancagem pode ser sua melhor amiga ou sua pior inimiga.",
  "Não opere o que você quer ver, opere o que o gráfico mostra.",
  "Stop Loss não é prejuízo, é custo operacional.",
  "O medo de perder faz você perder mais.",
  "A ganância destrói mais contas do que gráficos ruins.",
  "Preço é o que você paga, valor é o que você leva.",
  "Se você não sabe quem é a liquidez da mesa, a liquidez é você.",
  "Trading é 10% técnica e 90% psicologia.",
  "Nunca adicione margem a uma posição perdedora.",
  "Corte as perdas cedo e deixe os lucros correrem.",
  "Um trader profissional não tem viés, tem plano.",
  "O mercado sempre dá uma segunda chance. Não faça FOMO.",
  "Volume precede o preço.",
  "Padrões gráficos são a psicologia das massas em tempo real.",
  "Não lute contra o Fed (ou contra a tendência macro).",
  "Cash is King: Estar fora do mercado também é uma posição.",
  "A disciplina é a ponte entre metas e resultados.",
  "Sempre verifique o Funding Rate antes de abrir swing trades.",
  "Liquidez atrai preço como um ímã.",
  "Divergências no RSI costumam antecipar reversões.",
  "O mercado sobe de escada e desce de elevador.",
  "Mantenha seu diário de trade atualizado.",
  "Vingança no trading é o caminho mais rápido para a liquidação.",
  "Se o trade tira seu sono, sua posição está muito grande.",
  "Siga o fluxo institucional, não tente ser o herói.",
  "Médias móveis são suportes e resistências dinâmicos.",
  "Notícias movem o mercado, mas o gráfico mostra o verdade.",
  "Bull markets nascem no pessimismo e morrem na euforia.",
  "Gerencie o risco, o lucro cuidará de si mesmo.",
  "Consistência vence a sorte no longo prazo.",
  "Não confunda genialidade com um bull market.",
  "Analise o Bitcoin antes de operar qualquer Altcoin.",
  "Falsos rompimentos são armadilhas de liquidez.",
  "O mercado cripto funciona 24/7, mas você não precisa operar 24/7.",
  "Entenda a correlação entre Dólar (DXY) e Cripto.",
  "O suporte de ontem é a resistência de hoje.",
  "Baleias não operam rompimentos, elas criam liquidez.",
  "Seja um sniper, não uma metralhadora.",
  "A paciência paga dividendos.",
  "Planeje o trade e opere o plano.",
  "O sucesso deixa rastros no gráfico."
];

const GenesisPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    exchange, setExchange,
    selectedPair, setSelectedPair,
    pairsList, isLoadingPairs,
    marketData, cvdData,
    currentPrice, change24h, isPositiveChange,
    timeframe, setTimeframe,
    equity, setEquity,
    targetProfit, setTargetProfit,
    leverage, setLeverage,
    leverageOptions,
    entryValue, setEntryValue,
    isDataLoading,
    refreshTrigger, setRefreshTrigger,
    activeTrades, setActiveTrades,
    analysisResult, setAnalysisResult,
    currentAnaliseId, setCurrentAnaliseId,
  } = useAppContext();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [chartMetadata, setChartMetadata] = useState<ChartMetadata | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hoverAnalyze, setHoverAnalyze] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const result = analysisResult;
  const setResult = setAnalysisResult;
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [radarId, setRadarId] = useState<string | null>(null);
  const analysisFormRef = useRef<HTMLDivElement>(null);

  // Pre-fill form from URL query params (e.g. after reveal redirect from AlertCard)
  useEffect(() => {
    const symbol = searchParams.get('symbol');
    const exchangeParam = searchParams.get('exchange');
    const timeframeParam = searchParams.get('timeframe');
    const radarIdParam = searchParams.get('radar_id');

    if (!symbol && !exchangeParam && !timeframeParam && !radarIdParam) return;

    if (symbol) {
      setSelectedPair(symbol.toUpperCase());
      setRefreshTrigger((prev) => prev + 1);
    }

    if (exchangeParam) {
      // Normalize exchange value to match dropdown options
      const exchangeMap: Record<string, string> = {
        binance: 'Binance',
        bybit: 'Bybit',
        bitget: 'Bitget',
        okx: 'OKX',
      };
      const resolvedExchange = exchangeMap[exchangeParam.toLowerCase()] || exchangeParam.charAt(0).toUpperCase() + exchangeParam.slice(1).toLowerCase();
      setExchange(resolvedExchange);
    }

    if (timeframeParam) {
      const validTimeframes = ['15m', '1h', '2h', '3h', '4h', '12h', '1d', '1w', '1M'];
      if (validTimeframes.includes(timeframeParam)) {
        setTimeframe(timeframeParam);
      }
    }

    if (radarIdParam) {
      setRadarId(radarIdParam);
    }

    // Clean up query params from URL after reading them
    setSearchParams({}, { replace: true });

    // Scroll to form and focus exchange select so user notices the pre-fill
    setTimeout(() => {
      const el = document.getElementById('exchange-select');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => el.focus(), 400);
      }
    }, 150);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isAnalyzing) {
      setQuoteIndex(Math.floor(Math.random() * TRADING_QUOTES.length));
      const interval = setInterval(() => {
        setQuoteIndex((prev) => (prev + 1) % TRADING_QUOTES.length);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isAnalyzing]);

  const handleAnalyze = async (
    fileOverride?: File,
    metadataOverride?: ChartMetadata,
    exchangeOverride?: string,
    pairOverride?: string,
    marketDataOverride?: ExchangeData
  ) => {
    const fileToUse = fileOverride || selectedFile;
    const metaToUse = metadataOverride || chartMetadata;
    const exchangeToUse = exchangeOverride || exchange;
    const pairToUse = pairOverride || selectedPair;
    const marketDataToUse = marketDataOverride || marketData;

    if (isAnalyzing && !fileOverride) return;

    if (!fileToUse) {
      alert("Por favor, faça upload de um gráfico.");
      return;
    }
    if (!pairToUse || pairToUse.trim() === "") {
      alert("Por favor, digite o nome do par (ex: SUIUSDT) no campo Par antes de analisar.");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const analysisMetadata: ChartMetadata = {
        ...(metaToUse || {}),
        pair: pairToUse,
        timeframe: metaToUse?.timeframe || timeframe,
      } as ChartMetadata;

      const data = await analyzeChart(
        fileToUse,
        analysisMetadata,
        equity,
        marketDataToUse,
        exchangeToUse,
        leverage,
        cvdData,
        entryValue
      );

      if (data) {
        if (data.pair && data.pair !== selectedPair) {
          setSelectedPair(data.pair.toUpperCase().replace('/', ''));
        }

        const extractNum = (val: any) => {
          if (!val) return 0;
          if (typeof val === 'number') return val;
          const s = String(val).split('\n')[0].replace(/[^0-9,.-]+/g, '').replace(',', '.');
          return parseFloat(s) || 0;
        };

        const score = data.scoreProbabilidade || 0;
        const savedAnalysis: SavedAnalysis = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          symbol: data.pair || pairToUse,
          interval: analysisMetadata.timeframe || timeframe,
          direction: data.direcaoProvavel || 'LONG',
          score: score,
          rsi: data.indicadores?.rsi || 0,
          ema200: data.indicadores?.ema200 || 0,
          adx: data.indicadores?.adx || 0,
          entry_price: extractNum(data.execucao?.setup?.entrada || data.entradaSugerida?.planoA || 0),
          target_price: extractNum(data.execucao?.setup?.tp1 || 0),
          stop_loss: extractNum(data.execucao?.setup?.stop || 0),
          status: 'PENDENTE',
        };
        const entradaValue = extractNum(data.execucao?.setup?.entrada || data.entradaSugerida?.planoA || data.execucao?.setup?.tp1 || 0);
        const savedId = await saveAnalysisToHistory(savedAnalysis, {
          corretora: exchange || 'BINANCE',
          vies: data.vies || data.viés || data.confluenciaRecomendada || '',
          alavancagem: data.gestaoRisco?.alavancagemRecomendada || '',
          resumo_analise: (data.sinteseDaAnalise || '').substring(0, 500),
          setup_entrada: JSON.stringify(data.execucao?.setup || {}).substring(0, 500),
          entrada: entradaValue,
          plano_a: extractNum(data.entradaSugerida?.planoA || 0),
          plano_b: extractNum(data.entradaSugerida?.planoB || 0),
          take_profit_2: extractNum(data.execucao?.setup?.tp2 || 0),
          take_profit_3: extractNum(data.execucao?.setup?.tp3 || 0),
          risco_retorno: data.execucao?.setup?.rr1 || '',
        });
        setCurrentAnaliseId(savedId);
      }

      setResult(data);
    } catch (error: any) {
      console.error('Analysis Error:', error);
      alert(error.message || 'Falha ao processar análise técnica. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setChartMetadata(null);
      setResult(null);

      setIsScanning(true);
      try {
        const unifiedResult = await unifiedChartAnalysis(file);
        setChartMetadata(unifiedResult);

        let newExchange = exchange;
        if (unifiedResult.exchange && unifiedResult.exchange !== 'UNK') {
          const cleanEx = unifiedResult.exchange.toLowerCase();
          if (cleanEx.includes('binance')) newExchange = 'Binance';
          else if (cleanEx.includes('bybit')) newExchange = 'Bybit';
          else if (cleanEx.includes('bitget')) newExchange = 'Bitget';
          else if (cleanEx.includes('okx')) newExchange = 'OKX';
          setExchange(newExchange);
        }

        let newPair = '';
        if (unifiedResult.pair && unifiedResult.pair !== 'UNK') {
          const cleanPair = normalizarPar(unifiedResult.pair);
          newPair = cleanPair;
          setSelectedPair(cleanPair);
          setRefreshTrigger((prev) => prev + 1);
        }

        if (unifiedResult.timeframe && unifiedResult.timeframe !== 'UNK') {
          const tfMap: Record<string, string> = {
            '1M': '1M', 'MONTHLY': '1M', 'M': '1M', 'MONTH': '1M',
            '1W': '1w', 'WEEKLY': '1w', 'W': '1w', 'WEEK': '1w', 'SEMANAL': '1w',
            '1D': '1d', 'DAILY': '1d', 'D': '1d', 'DAY': '1d', 'DIARIO': '1d', 'DIÁRIO': '1d',
            '12H': '12h', 'H12': '12h',
            '4H': '4h', 'H4': '4h',
            '3H': '3h', 'H3': '3h',
            '2H': '2h', 'H2': '2h', '120M': '2h',
            '1H': '1h', 'H1': '1h', '60M': '1h', 'HOURLY': '1h',
            '15M': '15m', 'M15': '15m',
            '5M': '5m', 'M5': '5m',
          };
          const rawTf = unifiedResult.timeframe;
          const upperTf = rawTf.toUpperCase().trim();
          const normalizedTf = tfMap[upperTf] || rawTf.toLowerCase().trim();
          const validTimeframes = ['15m', '5m', '1h', '2h', '3h', '4h', '12h', '1d', '1w', '1M'];

          console.log('[TF-DEBUG] Raw timeframe from scan:', JSON.stringify(rawTf));
          console.log('[TF-DEBUG] Uppercase lookup key:', JSON.stringify(upperTf));
          console.log('[TF-DEBUG] tfMap result:', JSON.stringify(tfMap[upperTf]));
          console.log('[TF-DEBUG] Final normalizedTf:', JSON.stringify(normalizedTf));
          console.log('[TF-DEBUG] Is valid?', validTimeframes.includes(normalizedTf));
          console.log('[TF-DEBUG] Current timeframe before set:', timeframe);

          if (validTimeframes.includes(normalizedTf)) {
            console.log('[TF-DEBUG] ✅ Setting timeframe to:', normalizedTf);
            setTimeframe(normalizedTf);
          } else {
            // Fallback: try regex extraction for formats like "1d", "4h", etc.
            const regexMatch = rawTf.match(/^(\d+)(m|h|d|w|M)$/i);
            if (regexMatch) {
              const fallbackTf = `${regexMatch[1]}${regexMatch[2].toLowerCase()}`;
              console.log('[TF-DEBUG] Regex fallback matched:', fallbackTf);
              if (validTimeframes.includes(fallbackTf)) {
                console.log('[TF-DEBUG] ✅ Setting timeframe via regex fallback:', fallbackTf);
                setTimeframe(fallbackTf);
              } else {
                console.warn('[TF-DEBUG] ❌ Regex fallback not in valid list:', fallbackTf);
              }
            } else {
              console.warn('[TF-DEBUG] ❌ No match found for timeframe:', rawTf);
            }
          }
        } else {
          console.log('[TF-DEBUG] ⚠️ No timeframe detected or UNK. Raw value:', unifiedResult?.timeframe);
        }

        if (newPair) {
          const [bn, by, bg, ok] = await Promise.all([
            fetchBinanceData(newPair),
            fetchBybitData(newPair),
            fetchBitgetData(newPair),
            fetchOkxData(newPair),
          ]);
        }
      } catch (err: any) {
        console.error('Auto-scan failed', err);
        alert('Não foi possível detectar automaticamente a moeda do gráfico. Por favor, digite manualmente no campo Par.');
      } finally {
        setIsScanning(false);
      }
    }
  };

  const handleResetAnalysis = () => {
    setResult(null);
    setSelectedFile(null);
    setChartMetadata(null);
    setCurrentAnaliseId(null);
  };

  const handleSaveTrade = () => {
    if (!result) return;

    const now = new Date();
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const parsePrice = (p: string | number) => {
      if (!p || p === '-' || p === '---') return 0;
      if (typeof p === 'number') return p;
      const firstPart = String(p).split('\n')[0];
      return parseFloat(firstPart.replace(/[^0-9,.-]+/g, '').replace(',', '.'));
    };

    const entryVal = result.execucao?.setup?.entrada || result.entradaSugerida?.planoA || 0;
    const entryP = currentPrice ? parsePrice(currentPrice) : parsePrice(entryVal as string | number);

    const targetValue = result.execucao?.setup?.tp1 || 0;
    const targetP = parsePrice(targetValue as string | number);

    const levVal = result.execucao?.setup?.alavancagem || leverage;
    const direction = (result.direcaoProvavel || 'LONG') as 'LONG' | 'SHORT';
    const liqPrice = result.execucao?.setup?.liquidacao
      ? parsePrice(result.execucao.setup.liquidacao as string | number)
      : calculateLiquidationPrice(entryP, levVal, direction, exchange);

    const newTrade = {
      id: Date.now().toString(),
      exchange: exchange,
      date: formattedDate,
      asset: selectedPair.includes('/') ? selectedPair : selectedPair.replace('USDT', '/USDT'),
      leverage: `${levVal}x`,
      direction: direction,
      status: 'Pendente',
      pnl: '$0.00 (0.00%)',
      entryPrice: entryP,
      currentPriceStr: currentPrice || '-',
      targetPrice: targetP,
      financialTarget: parseFloat(targetProfit) || 0,
      liquidationPrice: liqPrice,
      amount: parseFloat(equity),
    };

    setActiveTrades((prev) => [newTrade, ...prev]);
    navigate('/dashboard/trades');
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 pb-10 w-full mt-6">
        <div className="w-full lg:w-[640px] xl:w-[720px] flex-shrink-0 flex flex-col gap-6">
          <div ref={analysisFormRef} className="bg-[#060608] rounded-[24px] p-6 lg:p-8 flex flex-col relative overflow-visible shadow-[0_12px_40px_rgba(0,0,0,1)]" data-analysis-form>
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-genesis-accent to-transparent opacity-50"></div>

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-genesis-accent">
                <Zap size={16} className="drop--[0_0_5px_rgba(139,92,246,0.5)]" />
                <h2 className="font-light text-sm text-white uppercase tracking-widest">Nova Análise</h2>
              </div>

              {currentPrice && (
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 bg-white/5 white/.0.05. rounded px-2 py-1">
                    <span className="text-[10px] font-bold text-genesis-text-secondary uppercase tracking-wider">
                      {selectedPair.replace('USDT', '').replace('/', '')}
                    </span>
                    <span className="text-xs font-mono text-white">{currentPrice}</span>
                  </div>
                  {change24h && (
                    <div className={`flex items-center gap-1 text-[10px] font-bold mt-1 ${isPositiveChange ? 'text-genesis-positive' : 'text-genesis-negative'}`}>
                      {isPositiveChange ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                      {change24h}%
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-5 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-genesis-text-secondary uppercase mb-2 tracking-wider">Corretora</label>
                  <div className="relative">
                    <select
                      id="exchange-select"
                      value={exchange}
                      onChange={(e) => setExchange(e.target.value)}
                      className="w-full bg-[#050505] border border-white/5 rounded-md px-3 py-2.5 text-xs text-white appearance-none focus:border-white/20 focus:outline-none transition-all uppercase tracking-wide"
                    >
                      <option value="Binance">Binance</option>
                      {/* <option value="Bybit">Bybit</option> */}
                      {/* <option value="Bitget">Bitget</option> */}
                      {/* <option value="OKX">OKX</option> */}
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 text-genesis-text-muted pointer-events-none" size={14} />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-genesis-text-secondary uppercase mb-2 tracking-wider">
                    Par
                    {isLoadingPairs && <span className="text-genesis-accent ml-1 animate-pulse">...</span>}
                  </label>
                  <div className="relative">
                    <input
                      list="pairs-list"
                      type="text"
                      value={selectedPair}
                      onChange={(e) => setSelectedPair(e.target.value.toUpperCase())}
                      className="w-full bg-[#050505] border border-white/5 rounded-md px-3 py-2.5 text-xs text-white focus:border-white/20 focus:outline-none transition-all placeholder-gray-700 font-mono appearance-none"
                      placeholder="BTCUSDT"
                    />
                    {isDataLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-genesis-positive opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-genesis-positive"></span>
                        </span>
                      </div>
                    )}
                    <datalist id="pairs-list">
                      {pairsList.map((pair) => (
                        <option key={pair} value={pair} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-genesis-text-secondary uppercase mb-2 tracking-wider">Timeframe</label>
                  <div className="relative">
                    <select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      className="w-full bg-[#050505] border border-white/5 rounded-md px-3 py-2.5 text-xs text-white appearance-none focus:border-white/20 focus:outline-none transition-all"
                    >
                      <option value="15m">15m</option>
                      <option value="1h">1h</option>
                      <option value="4h">4h</option>
                      <option value="1d">1d</option>
                      <option value="1w">1w</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 text-genesis-text-muted pointer-events-none" size={14} />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-genesis-text-secondary uppercase mb-2 tracking-wider">Alavancagem</label>
                  <div className="relative">
                    <select
                      value={leverage}
                      onChange={(e) => setLeverage(Number(e.target.value))}
                      className="w-full bg-[#050505] border border-white/5 rounded-md px-3 py-2.5 text-xs text-white appearance-none focus:border-white/20 focus:outline-none transition-all font-mono"
                    >
                      {leverageOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}x</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3.5 text-genesis-text-muted pointer-events-none" size={14} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-genesis-text-secondary uppercase mb-2 tracking-wider">Valor de Entrada (Opcional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 font-mono text-xs">$</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={entryValue}
                    onChange={(e) => setEntryValue(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Ex: 100"
                    className="w-full bg-[#050505] border border-white/5 rounded-md pl-7 pr-3 py-2.5 text-xs text-white focus:border-white/20 focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-genesis-text-secondary uppercase mb-2 tracking-wider">Gráfico (Upload)</label>
                <div
                  id="chart-upload-container"
                  className={`dashed ${selectedFile ? 'border-genesis-positive bg-green-900/5' : 'border-white/10 hover:border-white/30 hover:bg-white/5'} rounded-xl transition-all h-20 flex flex-col items-center justify-center relative cursor-pointer group`}
                >
                  <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  {isScanning ? (
                    <div className="flex flex-col items-center gap-1 text-genesis-accent">
                      <ScanEye className="animate-pulse" size={18} />
                      <span className="text-[9px] font-mono tracking-wider">LENDO METADADOS...</span>
                    </div>
                  ) : selectedFile ? (
                    <div className="flex items-center gap-2 text-genesis-positive text-xs font-medium">
                      <CheckCircle size={14} />
                      {selectedFile.name.substring(0, 15)}...
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-genesis-text-muted group-hover:text-genesis-text-secondary transition-colors">
                      <Upload size={16} />
                      <span className="text-[9px] uppercase tracking-widest font-bold">Arraste ou Clique</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col mt-4 gap-4">
              <OrderBookImbalance symbol={selectedPair} exchange={exchange} />
              <TrendQuality symbol={selectedPair} exchange={exchange} />
              <LiquidationHeatmap />
              <SectorSentiment />
            </div>

            <button
              onClick={() => handleAnalyze()}
              onMouseEnter={() => setHoverAnalyze(true)}
              onMouseLeave={() => setHoverAnalyze(false)}
              disabled={isScanning}
              className={`mt-4 w-full py-3.5 rounded-lg font-bold tracking-widest text-[11px] flex items-center justify-center gap-3 transition-all duration-300 relative overflow-hidden group ${
                isAnalyzing
                  ? hoverAnalyze
                    ? 'bg-red-900/10 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                    : 'bg-black border-genesis-positive text-genesis-positive shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                  : 'bg-white text-black hover:bg-genesis-positive hover:border-genesis-positive hover:text-black hover:-[0_0_30px_rgba(16,185,129,0.4)]'
              }`}
            >
              {isAnalyzing ? (
                hoverAnalyze ? (
                  <>
                    <X size={16} className="text-red-500" />
                    CANCELAR ANÁLISE
                  </>
                ) : (
                  <>
                    <div className="w-4 h-4 genesis-positive border-t-transparent rounded-full animate-spin"></div>
                    ANALISANDO PROJETO...
                  </>
                )
              ) : (
                <>
                  <Zap size={16} className={`transition-colors ${isAnalyzing ? 'hidden' : 'fill-current'}`} />
                  ANALISAR AGORA
                </>
              )}
            </button>
          </div>
          <NewsTicker />
        </div>

        <div className="w-full bg-genesis-card backdrop-blur-xl white/.0.05. shadow-[0_8px_32px_rgba(0,0,0,0.4)] white/.0.05. rounded-xl p-2 relative min-h-[700px] flex flex-col">
          <div className="absolute top-0 right-0 p-4 opacity-20 pointer-events-none">
            <BarChart2 size={100} className="text-white" strokeWidth={0.5} />
          </div>

          <div className="h-full bg-[#050505] rounded-lg white/.0.05. p-4 md:p-8 overflow-hidden relative shadow-inner">
            {isAnalyzing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/80">
                <div className="w-24 h-24 relative mb-8">
                  <div className="absolute inset-0 border-[0.5px] border-white/10 rounded-full"></div>
                  <div className="absolute inset-0 genesis-positive border-t-transparent rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Quote className="text-genesis-positive animate-pulse" size={32} />
                  </div>
                </div>
                <h3 className="text-xl font-light text-white uppercase tracking-widest mb-4">Processando Dados</h3>
                <div key={quoteIndex} className="animate-in fade-in slide-in- duration-500">
                  <p className="text-genesis-text-secondary font-mono text-xs text-center max-w-md italic border-white/5 py-4 px-6">
                    "{TRADING_QUOTES[quoteIndex]}"
                  </p>
                </div>
              </div>
            ) : result ? (
              <AnalysisResult
                data={result}
                currentPrice={currentPrice}
                change24h={change24h}
                isPositiveChange={!!isPositiveChange}
                onSaveTrade={handleSaveTrade}
                onReset={handleResetAnalysis}
                analiseId={currentAnaliseId}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-white/5 roundedshadow-[0_0_30px_rgba(139,92,246,0.05)] flex items-center justify-center mb-6 white/.0.05. group-hover:border-genesis-accent/30 transition-all shadow-[0_0_30px_rgba(139,92,246,0.05)]">
                  <BarChart2 size={32} className="text-gray-700" />
                </div>
                <h2 className="textshadow-[0_0_30px_rgba(139,92,246,0.05)] font-thin text-white uppercase tracking-[0.2em] mb-4">Terminal Gênesis</h2>
                <p className="text-genesis-text-secondary text-sm max-w-md leading-relaxed mb-8 font-light">
                  Aguardando input. Configure os parâmetros à esquerda ou carregue um gráfico para iniciar a matriz de análise.
                </p>
                <div className="grid grid-cols-2 gap-4 max-w-lg w-full opacity-60">
                  <div className="p-4 bg-white/5 rounded white/.0.05. text-left">
                    <div className="flex items-center gap-2 mb-2 text-gray-300">
                      <ScanEye size={14} /> <span className="text-[10px] font-bold uppercase tracking-widest">OCR Vision</span>
                    </div>
                    <p className="text-[10px] text-genesis-text-muted">Detecção automática via imagem.</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded white/.0.05. text-left">
                    <div className="flex items-center gap-2 mb-2 text-gray-300">
                      <Zap size={14} /> <span className="text-[10px] font-bold uppercase tracking-widest">Sniper Mode</span>
                    </div>
                    <p className="text-[10px] text-genesis-text-muted">Setup completo com Risco/Retorno.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default GenesisPage;
