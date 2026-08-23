import React, { useEffect, useState } from 'react';
import { fetchBinanceDepth, fetchBybitDepth, fetchBitgetDepth, fetchOkxDepth } from '../services/cryptoApi';
import { Activity, AlertTriangle, Fingerprint, Layers } from 'lucide-react';
import { startWallWithdrawalMonitor, stopWallWithdrawalMonitor, getRecentWallWithdrawals, WallWithdrawalEvent } from '../services/spoofingService';

interface OrderBookImbalanceProps {
  symbol: string;
  exchange: string;
}

const OrderBookImbalance: React.FC<OrderBookImbalanceProps> = ({ symbol, exchange }) => {
  const [buyPct, setBuyPct] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [displayPair, setDisplayPair] = useState<string>('');
  const [wallWithdrawals, setWallWithdrawals] = useState<WallWithdrawalEvent[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setBuyPct(null);
    setWallWithdrawals([]);

    const loadOrderBook = async () => {
      try {
        let targetSymbol = symbol.toUpperCase().replace('/', '');
        let isFiatMapped = false;
        if (targetSymbol.endsWith('BRL')) { targetSymbol = targetSymbol.replace('BRL', 'USDT'); isFiatMapped = true; }
        else if (targetSymbol.endsWith('EUR')) { targetSymbol = targetSymbol.replace('EUR', 'USDT'); isFiatMapped = true; }
        if (isMounted) setDisplayPair(isFiatMapped ? targetSymbol : '');

        // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 12, item 12.7, doc §17): achado
        // real — só o ramo Binance existia; Bybit/Bitget/OKX eram comentários vazios ("mock ... for
        // brevity"), então o componente sempre mostrava o book da Binance mesmo quando o usuário
        // selecionava outra exchange. Os 4 ramos agora usam os helpers reais já existentes em
        // cryptoApi.ts (fetchBybitDepth/fetchBitgetDepth/fetchOkxDepth, já importados aqui, nunca
        // usados até esta fase). Cada exchange devolve bids/asks em chaves/formatos próprios.
        let bids: any[] = [];
        let asks: any[] = [];
        if (exchange === 'Binance') {
            const data = await fetchBinanceDepth(targetSymbol);
            if (data) { bids = data.bids || []; asks = data.asks || []; }
        } else if (exchange === 'Bybit') {
            const data = await fetchBybitDepth(targetSymbol);
            if (data?.retCode === 0 && data.result) { bids = data.result.b || []; asks = data.result.a || []; }
        } else if (exchange === 'Bitget') {
            const data = await fetchBitgetDepth(targetSymbol);
            if (data?.code === '00000' && data.data) { bids = data.data.bids || []; asks = data.data.asks || []; }
        } else if (exchange === 'OKX') {
            const data = await fetchOkxDepth(targetSymbol);
            if (data?.code === '0' && data.data?.[0]) { bids = data.data[0].bids || []; asks = data.data[0].asks || []; }
        }

        const sumVol = (arr: any[]) => arr.reduce((acc, item) => acc + (parseFloat(item[1]) || 0), 0);
        const bidVol = sumVol(bids);
        const askVol = sumVol(asks);
        const total = bidVol + askVol;

        // item 12.7: buyPct nunca cai para 50% de fallback — total=0 (os dois lados vazios, fonte
        // indisponível) deixa buyPct em null, e a tela mostra "Sincronizando..." em vez de metade.
        if (total > 0 && isMounted) {
            const calculatedBuyPct = (bidVol / total) * 100;
            if (!isNaN(calculatedBuyPct)) setBuyPct(calculatedBuyPct);
        }
      } catch (error) {
        console.error("Erro no cálculo:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadOrderBook();

    startWallWithdrawalMonitor(symbol);
    const withdrawalInterval = setInterval(() => { if (isMounted) setWallWithdrawals(getRecentWallWithdrawals(symbol)); }, 2000);
    return () => { isMounted = false; clearInterval(withdrawalInterval); stopWallWithdrawalMonitor(symbol); };
  }, [symbol, exchange]);

  // item 12.7: sem fallback de 50% — só existe quando buyPct existe (a UI já cai em
  // "Sincronizando..." quando buyPct é null, este valor nunca chega a ser renderizado nesse caso).
  const sellPct = buyPct !== null ? 100 - buyPct : null;
  const formatVol = (v: number) => v >= 1000000 ? `${(v/1000000).toFixed(2)}M` : `${(v/1000).toFixed(0)}k`;

  return (
    <div className="w-full flex flex-col gap-6 relative z-10 py-2">
      {/* Imbalance Header */}
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
              <div className="bg-[#0f0f15] p-2 rounded-xl shadow-md">
                <Layers size={14} className="text-genesis-accent opacity-80" />
              </div>
              <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-white tracking-wide">Liquidez do Book (Bid vs Ask)</span>
                  <span className="text-[9px] text-gray-500">{exchange} • {displayPair || symbol}</span>
              </div>
          </div>
          <div className="flex items-center gap-3">
             {buyPct !== null && (
                 <>
                    <div className="flex flex-col items-end">
                       <span className="text-[10px] text-green-400 font-bold uppercase">Bids</span>
                       <span className="text-xs font-mono text-white">{buyPct.toFixed(1)}%</span>
                    </div>
                    <div className="w-[1px] h-4 bg-gray-800"></div>
                    <div className="flex flex-col items-start">
                       <span className="text-[10px] text-red-500 font-bold uppercase">Asks</span>
                       <span className="text-xs font-mono text-white">{sellPct!.toFixed(1)}%</span>
                    </div>
                 </>
             )}
          </div>
      </div>

      {/* Modern Center Flow Bar */}
      <div className="w-full h-12 bg-[#050508] rounded-2xl overflow-visible relative shadow-inner">
          {loading || buyPct === null ? (
              <div className="absolute inset-0 flex items-center justify-center">
                 <span className="text-[10px] text-gray-600 uppercase tracking-widest font-mono animate-pulse">Sincronizando Profundidade...</span>
              </div>
          ) : (
              <div className="flex w-full h-full relative group cursor-crosshair">
                  {/* Tooltip */}
                  <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-64 bg-[#0a0a0f] p-4 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-[999999]">
                      <p className="text-[10px] text-gray-400 font-sans">
                         A pressão atual do livro mostra que {buyPct > 55 ? "os compradores estão absorvendo ordens passivas" : buyPct < 45 ? "a força vendedora esmaga as intenções de compra" : "há um cabo de guerra sem direção clara"}.
                      </p>
                  </div>

                  {/* Buy Background Intensity */}
                  <div className="h-full relative overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] rounded-l-2xl" style={{ width: `${buyPct}%`, backgroundColor: 'rgba(57, 255, 20, 0.05)' }}>
                      <div className="absolute top-0 right-0 h-full w-[2px] bg-green-500 shadow-[0_0_15px_rgba(57,255,20,0.8)] z-10"></div>
                      {/* Sub-bars representing liquidity pockets */}
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-end gap-1 opacity-20" style={{ height: '70%', paddingRight: '8px' }}>
                          <div className="w-1 bg-green-500 rounded-full" style={{ height: '40%' }}></div>
                          <div className="w-1 bg-green-500 rounded-full" style={{ height: '70%' }}></div>
                          <div className="w-1 bg-green-500 rounded-full" style={{ height: '100%' }}></div>
                      </div>
                  </div>

                  {/* Sell Background Intensity */}
                  <div className="h-full relative overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] rounded-r-2xl" style={{ width: `${100 - buyPct}%`, backgroundColor: 'rgba(255, 0, 60, 0.05)' }}>
                      {/* Sub-bars representing liquidity pockets */}
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex items-end gap-1 opacity-20" style={{ height: '70%', paddingLeft: '8px' }}>
                          <div className="w-1 bg-red-600 rounded-full" style={{ height: '100%' }}></div>
                          <div className="w-1 bg-red-600 rounded-full" style={{ height: '70%' }}></div>
                          <div className="w-1 bg-red-600 rounded-full" style={{ height: '40%' }}></div>
                      </div>
                  </div>

                  {/* Center Line Indicator */}
                  <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-gray-800 z-0"></div>
              </div>
          )}
      </div>

      {/* item 12.8: nome/linguagem não afirmam mais "spoofing" com certeza — só o fato observável
          (uma parede grande sumiu do book sem o preço ter cruzado o nível). */}
      <div className={`mt-2 p-4 rounded-3xl transition-all duration-500 flex flex-col gap-3 relative overflow-hidden ${wallWithdrawals.length > 0 ? 'bg-[#140505]' : 'bg-[#09090b]'}`}>
          <div className="flex items-center justify-between z-10 relative">
             <div className="flex items-center gap-3">
                 <div className={`p-1.5 rounded-full ${wallWithdrawals.length > 0 ? 'bg-red-500/10 text-red-500' : 'bg-gray-800 text-gray-500'}`}>
                    <Fingerprint size={14} />
                 </div>
                 <div>
                    <h3 className={`text-[11px] font-bold ${wallWithdrawals.length > 0 ? 'text-white' : 'text-gray-300'}`}>Monitor de Book</h3>
                    <p className="text-[9px] text-gray-500 tracking-wider">Retirada suspeita de parede</p>
                 </div>
             </div>

             {wallWithdrawals.length > 0 ? (
                 <div className="flex items-center gap-2">
                     <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                     </span>
                     <span className="text-[10px] text-white font-mono shadow-sm bg-red-500/20 px-2 py-0.5 rounded text-red-300">
                        Drop ${formatVol(wallWithdrawals[0].volumeUsd)} {wallWithdrawals[0].type === 'BULLISH' ? 'ASK' : 'BID'}
                     </span>
                 </div>
             ) : (
                 <span className="text-[9px] text-green-500 uppercase tracking-widest bg-green-500/5 px-2 py-1 rounded">Fluxo Orgânico</span>
             )}
          </div>

          {wallWithdrawals.length > 0 && (
             <div className="text-[10px] text-gray-400 italic z-10 px-1 border-l-2 border-red-500/30 pl-3">
                 {wallWithdrawals[0].type === 'BULLISH' ?
                 "Parede vendedora grande foi retirada sem ser executada — pode indicar tentativa de empurrar o preço, mas o livro sozinho não confirma isso." :
                 "Parede compradora grande foi retirada sem ser executada — pode indicar um suporte falso, mas o livro sozinho não confirma isso."}
             </div>
          )}
          
          {/* Subtle Ambient Glow inside the wall-withdrawal card */}
          {wallWithdrawals.length > 0 && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-red-500/5 blur-[50px] pointer-events-none"></div>}
      </div>

    </div>
  );
};

export default OrderBookImbalance;
