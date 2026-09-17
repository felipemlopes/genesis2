import React, { useEffect, useMemo, useRef, useState } from 'react';
import { hasValidNumber, isStopSideValid, type PlanoDirecao } from '../utils/stopValidation';
import { classifyStopRiskZone, liqGapPctOfEntryToLiquidation, STOP_RISK_ZONE_MICROTEXT, type StopRiskZone } from '../utils/stopRiskZone';
import { price as formatPrice } from '../utils/canonicalMoney';
import { reprecificar, type RepriceResponse } from '../services/api';

/**
 * Genesis Brain V2 (Fase 4.2/4.3, item 13.1-13.3/14.2, Requisito 12.6-12.9/13.3, Fonte §36/§38):
 * slider de stop com posição inicial `stop_recommended` ("STOP GÊNESIS", marcado visualmente),
 * régua bidirecional de 5 zonas e bloqueio de posições matematicamente inválidas. `stop_effective`
 * é sempre preview LOCAL primeiro (useState, `onChange` — nunca chama rede a cada pixel arrastado,
 * item 13.4/Requisito 12.9: mover o stop não chama Brain/IA, não muda direction/score, não
 * re-executa análise técnica). Quando `analysisUuid` está disponível, um debounce curto (Fonte
 * §38, "onChangeEnd ou debounce curto") chama `POST /reprice` (Fase 4.3, task 14) — matemática
 * pura, mesma ausência de IA — e o RR/risco/liquidação exibidos passam a ser a resposta do
 * backend (fonte final, Fonte §38 ponto 5) em vez do preview local puro. Sem `analysisUuid`
 * (preview sem análise persistida ainda), o componente funciona só com o preview local, como na
 * Fase 4.2 original.
 */

const DEBOUNCE_MS = 450;

export interface StopSliderProps {
  entrada: number;
  stopRecommended: number;
  direcao: PlanoDirecao;
  atr: number | null | undefined;
  liquidacao: number | null | undefined;
  tickDecimals?: number | null;
  /** Chamado a cada movimento local — o chamador decide o que fazer com o preview. */
  onStopEffectiveChange?: (stopEffective: number) => void;
  /** Presente => habilita o repricing real (debounce -> POST /reprice). Ausente => só preview local. */
  analysisUuid?: string | null;
  plan?: 'A' | 'B';
  leverage?: number | null;
  equity?: number | null;
}

const ZONE_COLOR: Record<StopRiskZone, string> = {
  TOO_CLOSE_NOISE: '#ef4444',
  CAUTION_CLOSE: '#f59e0b',
  TECHNICAL_ZONE: '#22c55e',
  CAUTION_WIDE: '#f59e0b',
  TOO_WIDE_LIQUIDATION_RISK: '#ef4444',
};

/** Extremo do slider do lado oposto à entrada — liquidação real (com buffer mínimo) quando
 *  disponível, senão um teto de 6 ATR (bem além da zona TOO_WIDE, nunca alcançável de forma útil,
 *  só existe pra dar ao range input um limite finito). Fonte §36.6: "aplicar buffer operacional
 *  mínimo em relação à liquidação" — nunca deixa o slider alcançar o próprio preço de liquidação. */
const limiteDistante = (entrada: number, direcao: PlanoDirecao, atrSeguro: number, liquidacao: number | null | undefined): number => {
  const bufferMinimo = atrSeguro * 0.1;
  if (hasValidNumber(liquidacao)) {
    return direcao === 'LONG' ? liquidacao + bufferMinimo : liquidacao - bufferMinimo;
  }

  return direcao === 'LONG' ? entrada - atrSeguro * 6 : entrada + atrSeguro * 6;
};

export const StopSlider: React.FC<StopSliderProps> = ({
  entrada, stopRecommended, direcao, atr, liquidacao, tickDecimals, onStopEffectiveChange,
  analysisUuid, plan, leverage, equity,
}) => {
  const [stopEffective, setStopEffective] = useState<number>(stopRecommended);
  const [reprice, setReprice] = useState<RepriceResponse | null>(null);
  const [repricing, setRepricing] = useState(false);
  const [repriceErro, setRepriceErro] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fonte §38: debounce curto, nunca uma chamada por pixel arrastado. Cancela o timer anterior a
  // cada novo valor — só a ÚLTIMA posição depois de DEBOUNCE_MS parado dispara o /reprice real.
  useEffect(() => {
    if (!analysisUuid || !plan || !hasValidNumber(leverage) || !hasValidNumber(equity)) {
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      const executar = async (): Promise<void> => {
        setRepricing(true);
        setRepriceErro(null);
        const resultado = await reprecificar(analysisUuid, plan, leverage, equity, stopEffective);
        if (resultado.success === false) {
          setRepriceErro(resultado.error);
        } else {
          setReprice(resultado.data);
        }
        setRepricing(false);
      };
      void executar();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopEffective, analysisUuid, plan, leverage, equity]);

  // ATR "seguro" pra matemática do componente (nunca 0/negativo/ausente) — sem ATR real, o slider
  // ainda funciona (limite distante cai no fallback de liquidação/6x um ATR sintético pequeno),
  // mas a régua de ruído não tem dado objetivo pra classificar o lado curto.
  const atrSeguro = hasValidNumber(atr) && atr > 0 ? atr : null;

  const { min, max } = useMemo(() => {
    const distante = limiteDistante(entrada, direcao, atrSeguro ?? entrada * 0.02, liquidacao);
    const pertoDaEntrada = entrada * 0.0001; // buffer mínimo — nunca deixa o stop encostar na entrada.

    return direcao === 'LONG'
      ? { min: distante, max: entrada - pertoDaEntrada }
      : { min: entrada + pertoDaEntrada, max: distante };
  }, [entrada, direcao, atrSeguro, liquidacao]);

  const stopDistanceAtrLocal = atrSeguro ? Math.abs(entrada - stopEffective) / atrSeguro : null;
  const liqGapPctLocal = liqGapPctOfEntryToLiquidation(stopEffective, entrada, liquidacao);
  const zonaLocal: StopRiskZone | null = stopDistanceAtrLocal !== null ? classifyStopRiskZone(stopDistanceAtrLocal, liqGapPctLocal) : null;
  const ladoValido = isStopSideValid(stopEffective, entrada, direcao);
  const ajustadoPeloMembro = Math.abs(stopEffective - stopRecommended) > (entrada * 1e-9);

  // Fonte §38 ponto 5: "backend valida e vira fonte final" — quando a resposta confirmada já
  // corresponde à posição atual do slider (mesmo valor, tolerância de ponto flutuante), usa os
  // números do servidor em vez do preview local puro; senão (ainda não chegou, ou o membro já
  // moveu de novo desde a última confirmação), continua no preview local.
  const repriceConfere = reprice !== null && Math.abs(reprice.stop_effective - stopEffective) <= Math.max(entrada * 1e-6, 1e-6);
  const zona = repriceConfere ? reprice!.stop_risk.zone : zonaLocal;
  const stopDistanceAtr = repriceConfere ? reprice!.stop_risk.distance_atr : stopDistanceAtrLocal;

  const handleChange = (raw: string): void => {
    const valor = Number(raw);
    if (!hasValidNumber(valor)) {
      return;
    }
    setStopEffective(valor);
    onStopEffectiveChange?.(valor);
  };

  // STOP GÊNESIS: posição do marcador do stop recomendado, em % ao longo do range do slider.
  const genesisMarkerPct = useMemo(() => {
    const total = max - min;
    if (total === 0) return 50;
    const pct = ((stopRecommended - min) / total) * 100;
    return Math.min(100, Math.max(0, pct));
  }, [min, max, stopRecommended]);

  if (!hasValidNumber(entrada) || !hasValidNumber(stopRecommended) || min >= max) {
    return null;
  }

  return (
    <div className="mt-3 mb-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Ajustar stop</span>
        <span className="text-[10px] font-mono text-white font-bold">
          {formatPrice(stopEffective, tickDecimals)}
          {ajustadoPeloMembro && <span className="ml-1 text-[8px] text-genesis-accent font-bold uppercase">ajustado</span>}
        </span>
      </div>

      <div className="relative pt-3 pb-1">
        {/* Marcador "STOP GÊNESIS" — o stop recomendado pela IA, fixo, visual, nunca se move. */}
        <div
          className="absolute top-0 flex flex-col items-center -translate-x-1/2"
          style={{ left: `${genesisMarkerPct}%` }}
        >
          <span className="text-[7px] font-bold text-genesis-accent uppercase tracking-wider whitespace-nowrap">Stop Gênesis</span>
          <div className="w-px h-2 bg-genesis-accent" />
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={(max - min) / 1000}
          value={stopEffective}
          onChange={(e) => handleChange(e.target.value)}
          aria-label="Ajustar stop de proteção"
          aria-valuetext={formatPrice(stopEffective, tickDecimals)}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer mt-2"
          style={{
            background: zona ? ZONE_COLOR[zona] : '#374151',
            accentColor: zona ? ZONE_COLOR[zona] : undefined,
          }}
        />
      </div>

      {zona && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] font-mono" style={{ color: ZONE_COLOR[zona] }}>
            {STOP_RISK_ZONE_MICROTEXT[zona]}
          </span>
          {stopDistanceAtr !== null && (
            <span className="text-[8px] text-gray-500 font-mono">{stopDistanceAtr.toFixed(2)} ATR</span>
          )}
        </div>
      )}

      {!ladoValido && (
        <p className="text-[9px] text-genesis-negative font-mono mt-1">
          Posição inválida: {direcao === 'LONG' ? 'o stop precisa ficar abaixo da entrada.' : 'o stop precisa ficar acima da entrada.'}
        </p>
      )}

      {analysisUuid && plan && (
        <div className="mt-1.5 flex items-center gap-2">
          {repricing && <span className="text-[8px] text-gray-500 font-mono italic">recalculando…</span>}
          {!repricing && repriceConfere && (
            <span className="text-[8px] text-gray-500 font-mono">
              RR TP1 {reprice!.rr.tp1 !== null ? reprice!.rr.tp1.toFixed(2) : '—'}
              {' · '}Risco {reprice!.risk.risk_usd !== null ? formatPrice(reprice!.risk.risk_usd) : '—'}
              {reprice!.liquidation.status === 'AVAILABLE' && reprice!.liquidation.price !== null && (
                <> · Liquidação {formatPrice(reprice!.liquidation.price, tickDecimals)}</>
              )}
            </span>
          )}
          {!repricing && repriceErro && (
            <span className="text-[8px] text-genesis-negative font-mono">Não foi possível recalcular: {repriceErro}</span>
          )}
        </div>
      )}

      {!hasValidNumber(liquidacao) && (
        <p className="text-[8px] text-gray-600 font-mono mt-1">Liquidação indisponível — zona de risco por liquidação não avaliada.</p>
      )}
    </div>
  );
};

export default StopSlider;
