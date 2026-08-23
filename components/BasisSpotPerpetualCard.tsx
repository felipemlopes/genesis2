
import React, { useEffect, useState } from 'react';
import { ShieldCheck, Activity } from 'lucide-react';
import { fetchWithProxy } from '../services/cryptoApi';

/**
 * A10 (V6.9) — EXCEÇÃO DELIBERADA à determinação "nenhum dado de Spot em nenhuma camada".
 * Decisão do Felipe (19/08/2026): o "prêmio" mostrado por este widget é a diferença entre o preço
 * à vista (Spot) e o mark price de Futuros — zerar o Spot não ajustaria a fonte, apagaria a
 * métrica inteira (a diferença sempre daria ~0). O A10 mira dado de Spot usado na ANÁLISE do
 * Gênesis (que decide direção/entrada/stop/alvo); este componente não alimenta a decisão — é um
 * indicador auxiliar de estrutura de mercado (base/contango) que só existe comparando os dois
 * mercados. Mantido como está.
 *
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 12, item 12.12, doc §17): renomeado de
 * `TrendQuality` para `BasisSpotPerpetualCard` — o nome antigo sugeria "qualidade de tendência",
 * que este card nunca mediu (só compara dois preços). `data-role="display-only"` marcado
 * explicitamente no elemento raiz — teste de arquitetura (`V69ForbiddenProductionCodeTest`,
 * backend) falha se qualquer arquivo do cérebro decisório importar este componente por nome.
 * Achado real: `getAnalysis()` produzia rótulos de convicção direcional e "squeeze" a partir de um
 * único número ("Surfando com as Baleias", "Risco de Queda (Bolha)", "Caça aos Ursos (Squeeze)",
 * "Despejo Real") — a regra do item 12.12 ("sem direção/squeeze/frases de convicção") pede
 * apresentação neutra: só o fato (o sinal e a magnitude do prêmio), nunca uma leitura de mercado.
 */

interface BasisSpotPerpetualCardProps {
  symbol: string;
  exchange: string;
}

type Faixa = 'ALINHADO' | 'FUTUROS_ACIMA' | 'FUTUROS_ACIMA_FORTE' | 'FUTUROS_ABAIXO' | 'FUTUROS_ABAIXO_FORTE';

const BasisSpotPerpetualCard: React.FC<BasisSpotPerpetualCardProps> = ({ symbol, exchange }) => {
  const [premium, setPremium] = useState<number | null>(null);
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    setPremium(null);
    setPriceChange24h(null);
    setLoading(true);

    const loadBasisData = async () => {
      try {
        let rawSymbol = symbol.toUpperCase().replace('/', '').replace('-', '').replace('_', '');
        if (rawSymbol.includes('PERP')) rawSymbol = rawSymbol.replace('PERP', '');

        let base = rawSymbol;
        if (rawSymbol.endsWith('USDT')) base = rawSymbol.replace('USDT', '');
        else if (rawSymbol.endsWith('USD')) base = rawSymbol.replace('USD', '');

        let spotBase = base;
        if (spotBase.startsWith('1000000')) spotBase = spotBase.substring(7);
        else if (spotBase.startsWith('1000')) spotBase = spotBase.substring(4);
        else if (spotBase.startsWith('100')) spotBase = spotBase.substring(3);

        const spotSymbol = `${spotBase}USDT`;
        const futSymbol = `${base}USDT`;

        let spotPrice = 0;
        let markPrice = 0;
        let change24h = 0;

        const t = Date.now();

        if (exchange === 'Binance') {
            const [tickerData, markData] = await Promise.all([
                fetchWithProxy(`https://api.binance.com/api/v3/ticker/24hr?symbol=${spotSymbol}`),
                fetchWithProxy(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${futSymbol}&_t=${t}`)
            ]);

            if (tickerData && tickerData.lastPrice) {
                spotPrice = parseFloat(tickerData.lastPrice);
                change24h = parseFloat(tickerData.priceChangePercent);
            }
            if (markData && markData.markPrice) {
                markPrice = parseFloat(markData.markPrice);
            }
        }
        else if (exchange === 'Bybit') {
            const [spotJson, markJson] = await Promise.all([
                fetchWithProxy(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${spotSymbol}&_t=${t}`),
                fetchWithProxy(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${futSymbol}&_t=${t}`)
            ]);

            if (spotJson?.retCode === 0 && spotJson.result?.list?.[0]) {
                spotPrice = parseFloat(spotJson.result.list[0].lastPrice);
                change24h = parseFloat(spotJson.result.list[0].price24hPcnt) * 100;
            }
            if (markJson?.retCode === 0 && markJson.result?.list?.[0]) {
                markPrice = parseFloat(markJson.result.list[0].markPrice);
            }
        }

        if (spotPrice > 0 && markPrice > 0) {
            const diff = ((markPrice - spotPrice) / spotPrice) * 100;
            if (isMounted) {
                setPremium(diff);
                setPriceChange24h(change24h);
            }
        } else {
            if (isMounted) setPremium(null);
        }

      } catch (err) {
        if (isMounted) setPremium(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadBasisData();

    return () => {
        isMounted = false;
    };
  }, [symbol, exchange]);

  if (loading) {
      return <div data-role="display-only" className="h-16 w-full mt-2 bg-white/5 animate-pulse rounded-lg " />;
  }

  const safeChange = priceChange24h !== null ? priceChange24h : 0;

  // item 12.12: só descreve o fato observável (sinal + magnitude do prêmio), nunca uma leitura de
  // mercado, direção ou "convicção". Limiares mantidos da versão anterior — só o rótulo mudou.
  const faixa = (prem: number | null): Faixa | null => {
      if (prem === null) return null;
      if (prem >= 0.08) return 'FUTUROS_ACIMA_FORTE';
      if (prem > 0.009) return 'FUTUROS_ACIMA';
      if (prem <= -0.08) return 'FUTUROS_ABAIXO_FORTE';
      if (prem < -0.009) return 'FUTUROS_ABAIXO';
      return 'ALINHADO';
  };

  const APRESENTACAO: Record<Faixa, { label: string; color: string; borderColor: string; bg: string; legend: string }> = {
      ALINHADO: {
          label: 'Alinhado',
          color: 'text-gray-300',
          borderColor: '',
          bg: 'bg-white/5',
          legend: 'Futuros e Spot próximos, sem diferença relevante entre os dois mercados.',
      },
      FUTUROS_ACIMA: {
          label: 'Futuros acima do Spot',
          color: 'text-genesis-accent',
          borderColor: 'border-genesis-accent/20',
          bg: 'bg-white/5',
          legend: 'Prêmio positivo — o mark price de Futuros negocia acima do preço à vista.',
      },
      FUTUROS_ACIMA_FORTE: {
          label: 'Futuros bem acima do Spot',
          color: 'text-genesis-accent',
          borderColor: 'border-genesis-accent/30',
          bg: 'bg-white/5',
          legend: 'Prêmio positivo elevado — diferença maior que o usual entre Futuros e Spot.',
      },
      FUTUROS_ABAIXO: {
          label: 'Futuros abaixo do Spot',
          color: 'text-yellow-400',
          borderColor: 'border-yellow-500/20',
          bg: 'bg-yellow-900/10',
          legend: 'Prêmio negativo — o mark price de Futuros negocia abaixo do preço à vista.',
      },
      FUTUROS_ABAIXO_FORTE: {
          label: 'Futuros bem abaixo do Spot',
          color: 'text-yellow-400',
          borderColor: 'border-yellow-500/30',
          bg: 'bg-yellow-900/10',
          legend: 'Prêmio negativo elevado — diferença maior que o usual entre Futuros e Spot.',
      },
  };

  const faixaAtual = faixa(premium);
  const apresentacao = faixaAtual
      ? APRESENTACAO[faixaAtual]
      : { label: 'Indisponível', color: 'text-gray-500', borderColor: '', bg: 'bg-white/5', legend: 'Dados insuficientes para calcular o prêmio Spot/Futuros.' };

  return (
    <div data-role="display-only" className="w-full mt-2 animate-in fade-in duration-500 group/basis relative cursor-help">
        <div className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 mt-3 w-80 p-5 bg-gray-950  rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] opacity-0 group-hover/basis:opacity-100 transition-all duration-300 pointer-events-none z-[999999] scale-95 group-hover/basis:scale-100 origin-top">
            <div className="flex flex-col gap-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider  pb-2 flex items-center gap-2">
                   <ShieldCheck size={14} className="text-genesis-accent" /> Prêmio Futuros vs. Spot
                </span>
                <p className="text-[10px] text-gray-300 leading-relaxed font-sans font-medium text-justify">
                    Diferença percentual entre o mark price de Futuros e o preço à vista (Spot). Apenas informativo — não indica direção nem probabilidade de movimento.
                </p>
                <div className="mt-2 h-1 w-full bg-white/10 rounded overflow-hidden flex">
                    <div className={`h-full transition-all duration-500 ${(premium !== null && premium < 0) ? 'bg-yellow-500 w-1/2' : 'bg-transparent w-0'}`} />
                    <div className={`h-full transition-all duration-500 ml-auto ${(premium !== null && premium > 0) ? 'bg-genesis-accent w-1/2' : 'bg-transparent w-0'}`} />
                </div>
                <div className="flex justify-between text-[8px] font-bold text-gray-500 uppercase">
                    <span>Futuros abaixo</span>
                    <span>Futuros acima</span>
                </div>
            </div>
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-950  transform rotate-45"></div>
        </div>

        <div className={`flex flex-col gap-1 p-3 rounded-xl transition-colors ${apresentacao.bg} ${apresentacao.borderColor}`}>
            <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${apresentacao.color}`}>
                <Activity size={14} />
                <span>{apresentacao.label}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold text-white opacity-90">
                    Prêmio: {premium !== null ? `${premium > 0 ? '+' : ''}${premium.toFixed(4)}%` : 'N/A'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded bg-black/20 ${safeChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    24h: {safeChange > 0 ? '+' : ''}{safeChange.toFixed(2)}%
                </span>
            </div>
            <div className="text-[10px] text-gray-500 font-medium leading-tight pt-1 border-black/10 mt-1">
                {apresentacao.legend}
            </div>
        </div>
    </div>
  );
};

export default BasisSpotPerpetualCard;
