import React from 'react';
import { Check, Minus, X } from 'lucide-react';
import { faixaDeConviccao } from '../utils/conviccao';

/**
 * V6.5 (G15, Decisão 8 do PO): a tela tinha 2 números medindo coisas diferentes — a convicção
 * (direção) em letra garrafal no topo, e o R:R (qualidade do preço de entrada) escondido em letra
 * pequena. O membro batia o olho no número grande e lia "operação aprovada". Este bloco separa as
 * 3 perguntas (Convicção: pra onde o mercado vai? / Qualidade da entrada: este preço é bom? /
 * Risco e retorno: quanto pago pelo risco?) e mostra a Qualidade da entrada como 4 fatores de
 * LOCALIZAÇÃO abertos e verificáveis no próprio gráfico — nunca uma nota composta ou porcentagem
 * inventada. Os fatores vêm prontos de QualidadeEntradaService (backend); este componente só
 * exibe.
 */

export type AvaliacaoFator = 'BOM' | 'MEDIO' | 'RUIM';

export interface FatorQualidadeEntrada {
  fator: string;
  avaliacao: AvaliacaoFator;
  detalhe: string;
}

interface Props {
  score: number | null;
  rr: number | null;
  // V6.7 (C-26): risco-retorno bruto passa a ser exibido ao lado do líquido, cada um rotulado —
  // antes só o líquido (rr) era mostrado, sem dizer que já descontava taxas/spread/slippage, sob o
  // rótulo genérico "Risco e retorno" (quem conferia na régua encontrava o bruto e via o líquido na
  // tela). Não há erro de cálculo, só de rótulo — os dois números já existiam no payload.
  rrBruto?: number | null;
  // V6.6 (F01, DF-02): risco e retorno passa a existir só aqui — dentro do mínimo, mostra só o
  // número; abaixo do mínimo, o número ganha a observação entre parênteses. rrMinimo/rrAbaixoDoMinimo
  // vêm prontos do backend (rr_minimo_referencia/rr_abaixo_do_minimo, ver E04) — nunca recalculados.
  rrMinimo?: number | null;
  rrAbaixoDoMinimo?: boolean;
  fatores: FatorQualidadeEntrada[];
  direcao: 'LONG' | 'SHORT';
}

const ICONE: Record<AvaliacaoFator, React.ReactNode> = {
  BOM: <Check size={12} />,
  MEDIO: <Minus size={12} />,
  RUIM: <X size={12} />,
};

const COR: Record<AvaliacaoFator, string> = {
  BOM: 'text-genesis-positive',
  MEDIO: 'text-purple-400',
  RUIM: 'text-genesis-negative',
};

// V6.6 (F09): antes a conclusão alternava entre duas gramáticas ("pesam contra" quando 2+ fatores
// eram ruins, "são favoráveis" nos outros casos) e o bloco vazio citava "os quatro fatores" mesmo
// quando só existiam três (contagem sempre dinâmica em produção, nunca fixa em quatro). Gramática
// única e contagem dinâmica, mesmo texto para qualquer combinação de fatores.
const montarConclusao = (rr: number | null, fatores: FatorQualidadeEntrada[]): string => {
  const total = fatores.length;

  if (total === 0) {
    return 'Sem dados suficientes para avaliar a localização desta entrada. A decisão é sua.';
  }

  const favoraveis = fatores.filter((f) => f.avaliacao === 'BOM').length;
  const plural = total === 1 ? 'fator' : 'fatores';
  const verbo = favoraveis === 1 ? 'é favorável' : 'são favoráveis';

  const base = `${favoraveis} de ${total} ${plural} de localização ${verbo} a este preço de entrada`;
  const comRr = rr !== null ? `${base}, com R:R de 1:${rr.toFixed(2)}` : base;

  return `${comRr}. A decisão é sua.`;
};

export const BlocoConviccaoQualidade: React.FC<Props> = ({ score, rr, rrBruto, rrMinimo, rrAbaixoDoMinimo, fatores, direcao }) => (
  <section className="bg-black/40 rounded-lg p-[16px] border border-white/[0.05] relative z-10 mb-5">
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Convicção</span>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <strong className="text-lg font-mono text-white">{score ?? '—'}</strong>
          {/* V6.6 (F03, DP-02): mesma correção de escala do rótulo em AnalysisResult.tsx — este
              componente tinha a mesma ocorrência de /90, não citada no documento, mas é a mesma
              regra (score na escala de 100, teto real 90). */}
          {score != null && <small className="text-gray-600 text-xs">/100</small>}
          <em className="text-[10px] text-gray-400 not-italic ml-1">{faixaDeConviccao(score)}</em>
        </div>
      </div>
      <div>
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Risco e retorno</span>
        {/* V6.7 (C-26): bruto e líquido lado a lado, cada um rotulado — nenhum dos dois some. */}
        <div className="mt-0.5 space-y-0.5">
          {rr == null && rrBruto == null ? (
            <span className="text-sm text-gray-500">sem alvo ancorado em barreira real</span>
          ) : (
            <>
              {rrBruto != null && (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <strong className="text-sm font-mono text-gray-300">1:{rrBruto.toFixed(2)}</strong>
                  <span className="text-[9px] text-gray-500">bruto</span>
                </div>
              )}
              {rr != null && (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <strong className="text-lg font-mono text-white">1:{rr.toFixed(2)}</strong>
                  <span className="text-[9px] text-gray-500">líquido (taxas, spread e slippage)</span>
                  {rrAbaixoDoMinimo && (
                    <span className="text-[10px] text-amber-500">
                      (cuidado, risco retorno abaixo do recomendado, 1:{(rrMinimo ?? 0).toFixed(2)})
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    <div className="border-t border-white/[0.05] pt-3">
      <h4 className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">
        Qualidade da entrada {direcao === 'SHORT' ? '(SHORT)' : '(LONG)'}
      </h4>
      {fatores.length === 0 ? (
        <p className="text-xs text-gray-500">Sem dados de localização suficientes para avaliar esta entrada.</p>
      ) : (
        <ul className="space-y-1.5">
          {fatores.map((f) => (
            <li key={f.fator} className="flex items-start gap-2 text-xs">
              <span className={`shrink-0 mt-0.5 ${COR[f.avaliacao]}`}>{ICONE[f.avaliacao]}</span>
              <span className="text-gray-300">
                <span className="font-semibold text-white">{f.fator}:</span> {f.detalhe}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>

    <p className="text-[10px] text-gray-500 mt-3 pt-3 border-t border-white/[0.05]">
      {montarConclusao(rr, fatores)}
    </p>
  </section>
);

export default BlocoConviccaoQualidade;
