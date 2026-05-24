
import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, TrendingDown, AlertTriangle, BookOpen, CheckCircle2, HelpCircle } from 'lucide-react';

interface RiskCalculatorModalProps {
  // onClose Removed as it is now a full tab view
  currentPrice?: string;
  exchange?: string;
}

// CONFIGURAÇÃO DE TEMAS E LÓGICA (BROKER ENGINE)
const BROKER_THEMES: Record<string, { color: string; mmr: number }> = {
  'Binance': { 
    color: '#FCD535', // Amarelo
    mmr: 0.004 // 0.40%
  },
  'Bybit': { 
    color: '#FFB119', // Laranja
    mmr: 0.005 // 0.50%
  },
  'Bitget': { 
    color: '#00F0FF', // Ciano Neon
    mmr: 0.005 // 0.50%
  }
};

// HELPERS DE PARSE E FORMATAÇÃO (PRECISÃO CORRIGIDA)
const parseLocalFloat = (value: string) => {
  if (!value) return 0;
  // Remove currency symbols and whitespace
  let clean = value.replace(/[^0-9.,]/g, '');
  
  // Handle PT-BR format (1.000,00) vs US format (1,000.00)
  if (clean.includes(',') && clean.includes('.')) {
      if (clean.lastIndexOf(',') > clean.lastIndexOf('.')) {
          // PT-BR: Dots are thousands, Comma is decimal
          clean = clean.replace(/\./g, '').replace(',', '.');
      } else {
          // US: Commas are thousands, Dot is decimal
          clean = clean.replace(/,/g, '');
      }
  } else if (clean.includes(',')) {
      // Assume Comma is decimal
      clean = clean.replace(',', '.');
  }
  
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// Formatter that respects high precision for low value assets
const formatResult = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
};

const RiskCalculatorModal: React.FC<RiskCalculatorModalProps> = ({ currentPrice, exchange = 'Binance' }) => {
  
  // --- THEME STATE ---
  const initialExchange = Object.keys(BROKER_THEMES).find(k => k.toLowerCase() === exchange.toLowerCase()) || 'Binance';
  const [selectedExchange, setSelectedExchange] = useState(initialExchange);
  const currentBrokerTheme = BROKER_THEMES[selectedExchange] || BROKER_THEMES['Binance'];

  // --- INPUTS STATE ---
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [marginStr, setMarginStr] = useState('1000');
  const [leverage, setLeverage] = useState<number>(10);
  const [riskPct, setRiskPct] = useState<number>(10);
  const [entryStr, setEntryStr] = useState('');

  // --- OUTPUTS STATE ---
  const [stopPrice, setStopPrice] = useState(0);
  const [liqPrice, setLiqPrice] = useState(0);
  const [financialLoss, setFinancialLoss] = useState(0);
  const [liquidationRisk, setLiquidationRisk] = useState(false);

  // Auto-fill Entry based on market price
  useEffect(() => {
    if (currentPrice) {
        // Strip symbols, keep raw format for editing
        const clean = currentPrice.replace(/[^0-9.,]/g, '');
        setEntryStr(clean);
    }
  }, [currentPrice]);

  // --- ENGINE DE CÁLCULO V3 (CORRIGIDO PARA BAIXA COTAÇÃO) ---
  useEffect(() => {
    const margin = parseLocalFloat(marginStr);
    const entry = parseLocalFloat(entryStr);
    
    if (margin <= 0 || entry <= 0 || leverage <= 0) {
        setStopPrice(0);
        setLiqPrice(0);
        setFinancialLoss(0);
        setLiquidationRisk(false);
        return;
    }

    // 1. Calcular Perda Financeira ($)
    const lossValue = margin * (riskPct / 100);
    setFinancialLoss(lossValue);

    // 2. Calcular Preço do Stop Loss
    // Fórmula: Entry * (1 ± (Risk% / Leverage))
    const distPct = (riskPct / 100) / leverage;
    
    let calculatedStop = 0;
    if (direction === 'LONG') {
        calculatedStop = entry * (1 - distPct);
    } else {
        calculatedStop = entry * (1 + distPct);
    }
    setStopPrice(calculatedStop);

    // 3. Calcular Preço de Liquidação (Isolated Margin + MMR Dinâmico)
    const mmr = currentBrokerTheme.mmr;
    
    let calculatedLiq = 0;
    if (direction === 'LONG') {
        // Liq = Entry * (1 - 1/Lev + MMR)
        calculatedLiq = entry * (1 - (1 / leverage) + mmr);
    } else {
        // Liq = Entry * (1 + 1/Lev - MMR)
        calculatedLiq = entry * (1 + (1 / leverage) - mmr);
    }
    setLiqPrice(Math.max(0, calculatedLiq));

    // 4. Verificar Colisão (Liquidação antes do Stop)
    let isRisky = false;
    if (direction === 'LONG') {
        if (calculatedLiq >= calculatedStop) isRisky = true;
    } else {
        if (calculatedLiq <= calculatedStop && calculatedLiq > 0) isRisky = true;
    }
    setLiquidationRisk(isRisky);

  }, [marginStr, leverage, riskPct, entryStr, direction, selectedExchange]);

  const handleRawInput = (val: string, setter: (s: string) => void) => {
    // Permitir apenas números, ponto e vírgula. Sem máscara forçada.
    const valid = val.replace(/[^0-9.,]/g, '');
    setter(valid);
  };

  const TooltipTrigger: React.FC<{ label: string; text: string }> = ({ label, text }) => (
    <div className="flex items-center gap-1.5 mb-1.5 w-fit relative group cursor-help">
        <label className="text-[10px] uppercase font-bold text-gray-400 group-hover:text-white transition-colors tracking-wide">
            {label}
        </label>
        <HelpCircle size={10} className="text-gray-600 group-hover:text-white transition-colors shrink-0" />
        <div className="absolute top-[calc(100%+10px)] left-0 mt-2 w-48 p-2.5 bg-gray-900  rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[999999] pointer-events-none">
            <p className="text-[10px] text-gray-200 leading-relaxed font-sans font-medium">
                {text}
            </p>
            <div className="absolute -bottom-1 left-2 w-2 h-2 bg-gray-900  rotate-45"></div>
        </div>
    </div>
  );

  return (
    <div className="bg-genesis-input rounded-[8px] p-[12px_14px]   rounded-[10px] p-[16px] shadow-2xl h-full flex flex-col overflow-visible animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8  pb-4 shrink-0">
            <div className="flex items-center gap-2">
                <Calculator className="text-orange-400" />
                <h2 className="text-xl font-light text-white tracking-widest uppercase">Gestão de Risco</h2>
            </div>
            
            {/* Quick Direction Toggle in Header */}
            <div className="flex gap-1 bg-black/40 p-1 rounded-lg ">
                <button 
                    onClick={() => setDirection('LONG')}
                    className={`px-4 py-1.5 text-[10px] font-bold rounded-md uppercase flex items-center justify-center gap-2 transition-all ${direction === 'LONG' ? 'bg-genesis-positive text-black shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'text-gray-500 hover:text-white'}`}
                >
                    <TrendingUp size={12} /> Long
                </button>
                <button 
                    onClick={() => setDirection('SHORT')}
                    className={`px-4 py-1.5 text-[10px] font-bold rounded-md uppercase flex items-center justify-center gap-2 transition-all ${direction === 'SHORT' ? 'bg-genesis-negative text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-gray-500 hover:text-white'}`}
                >
                    <TrendingDown size={12} /> Short
                </button>
            </div>
        </div>

        {/* 2-Column Full Height Layout */}
        <div className="flex flex-col lg:flex-row gap-8 overflow-hidden h-full pb-4">
            
            {/* COLUMN 1: INPUTS & CALCULATOR */}
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                 
                 {/* Exchange Selector */}
                 <div>
                    <div className="flex gap-2 mb-4">
                        {Object.keys(BROKER_THEMES).map(ex => {
                            const isActive = selectedExchange === ex;
                            const theme = BROKER_THEMES[ex];
                            return (
                                <button
                                    key={ex}
                                    onClick={() => setSelectedExchange(ex)}
                                    className={`flex-1 py-2 text-xs font-bold rounded uppercase transition-all duration-300`}
                                    style={{
                                        borderColor: isActive ? theme.color : 'rgba(255,255,255,0.1)',
                                        color: isActive ? theme.color : '#6b7280',
                                        backgroundColor: isActive ? `${theme.color}1a` : 'transparent',
                                    }}
                                >
                                    {ex}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-5">
                    {/* LEVERAGE */}
                    <div className="bg-black/20 p-[16px] rounded-xl ">
                        <TooltipTrigger label="Alavancagem" text="Multiplicador. Cuidado: Reduz a distância para liquidação." />
                        <div className="relative group">
                            <input 
                                type="number" 
                                value={leverage}
                                onChange={(e) => setLeverage(Number(e.target.value))}
                                className="w-full bg-black/40  rounded-lg py-3 px-3 text-white font-mono font-bold text-lg focus:outline-none transition-all focus:border-genesis-accent"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 font-bold text-xs pointer-events-none">x</span>
                        </div>
                    </div>

                    {/* MARGIN */}
                    <div className="bg-black/20 p-[16px] rounded-xl ">
                        <TooltipTrigger label="Margem ($)" text="Capital real (colateral) que você colocará nesta operação." />
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs pointer-events-none">$</span>
                            <input 
                                type="text" 
                                value={marginStr}
                                onChange={(e) => handleRawInput(e.target.value, setMarginStr)}
                                className="w-full bg-black/40  rounded-lg py-3 pl-6 pr-3 text-white font-mono font-bold text-lg focus:outline-none transition-all focus:border-genesis-accent"
                            />
                        </div>
                    </div>

                    {/* ENTRY PRICE */}
                    <div className="col-span-2 bg-black/20 p-[16px] rounded-xl ">
                        <TooltipTrigger label="Preço de Entrada" text="Preço do ativo no momento da abertura da posição." />
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs pointer-events-none">$</span>
                            <input 
                                type="text" 
                                value={entryStr}
                                onChange={(e) => handleRawInput(e.target.value, setEntryStr)}
                                className="w-full bg-black/40  rounded-lg py-3 pl-6 pr-3 text-white font-mono font-bold text-2xl focus:outline-none transition-all focus:border-genesis-accent"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* RISK SLIDER */}
                    <div className="col-span-2 bg-white/[0.03] rounded-[10px] p-[16px] ">
                        <div className="flex justify-between mb-4 items-end">
                            <TooltipTrigger label="Risco Aceitável (%)" text="Quanto % da sua margem você aceita perder." />
                            <span className={`font-mono font-bold text-lg ${riskPct > 50 ? 'text-genesis-negative' : 'text-genesis-accent'}`}>{riskPct}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="1" 
                            max="100" 
                            value={riskPct} 
                            onChange={(e) => setRiskPct(parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-genesis-accent mt-2"
                        />
                        <div className="flex justify-between text-[9px] text-gray-600 font-mono uppercase font-bold tracking-wider">
                            <span>1% (Conservador)</span>
                            <span>100% (All-In)</span>
                        </div>
                    </div>
                </div>

                 {/* RESULT CARD - HIGHLIGHT */}
                 <div className={`p-6 bg-[#0a0a0a] rounded-2xl relative mt-auto ${liquidationRisk ? 'border-red-500/50 bg-red-900/10' : 'border-genesis-accent/20'}`}>
                    {liquidationRisk && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-2 animate-pulse">
                            <AlertTriangle size={12} /> RISCO DE LIQUIDAÇÃO!
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div>
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">Seu Stop Loss deve ser</div>
                            <div className="text-5xl font-bold text-white font-mono tracking-tighter">
                                {formatResult(stopPrice)}
                                <span className="text-lg text-gray-600 font-sans font-normal opacity-50 ml-2">$</span>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex justify-between items-center p-3 rounded bg-black/40 ">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">Preço Liq.</span>
                                <span className={`font-mono font-bold text-sm ${liquidationRisk ? 'text-red-500' : 'text-orange-500'}`}>
                                    {formatResult(liqPrice)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center p-3 rounded bg-black/40 ">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">Perda Max ($)</span>
                                <span className="font-mono font-bold text-sm text-gray-300">
                                    - {financialLoss.toLocaleString('pt-BR', { minimumFractionDigits: 2, style: 'currency', currency: 'USD' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* COLUMN 2: EDUCATIONAL / LOGIC */}
            <div className="w-full lg:w-[400px] bg-black/20  rounded-[10px] p-[16px] flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar">
                 <div className="flex items-center gap-3 text-genesis-accent mt-2  pb-4">
                    <BookOpen size={20} />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white">Manual V3</h3>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                    Esta ferramenta calcula o Stop Loss matematicamente. O objetivo é proteger seu capital em Dólares ($), não em pontos gráficos arbitrários.
                </p>

                <div className="bg-blue-900/10 rounded-lg p-5 border-blue-500/20">
                    <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mt-3 flex items-center gap-2">
                        <CheckCircle2 size={14} /> Como funciona?
                    </h4>
                    <p className="text-xs text-gray-300 leading-relaxed mb-4">
                        Se você tem uma Margem de <strong>$1.000</strong> e aceita arriscar <strong>10%</strong>, a calculadora encontra o preço exato onde sua perda será de <strong>$100</strong>.
                    </p>
                    <div className="text-[10px] text-blue-300/60 font-mono">
                        Fórmula: Entry * (1 ± (Risco% / Alavancagem))
                    </div>
                </div>

                <div className="bg-yellow-900/10 rounded-lg p-5 border-yellow-500/20 mt-auto">
                    <h4 className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider mt-2 flex items-center gap-2">
                        <AlertTriangle size={14} /> Regra de Ouro
                    </h4>
                    <p className="text-xs text-gray-300 leading-relaxed">
                        Nunca opere se o Preço de Liquidação estiver antes do seu Stop Loss. Se o alerta vermelho aparecer, diminua a alavancagem imediatamente.
                    </p>
                </div>
            </div>

        </div>
    </div>
  );
};

export default RiskCalculatorModal;
