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

// Descreve a mistura de fatores sem sintetizar nota nova nenhuma — só contagem e o R:R já calculado.
const montarConclusao = (rr: number | null, fatores: FatorQualidadeEntrada[]): string => {
  const rrTexto = rr != null ? `R:R de 1:${rr.toFixed(2)}` : 'R:R indisponível';

  if (fatores.length === 0) {
    return `Sem dados de localização suficientes para avaliar a qualidade da entrada. ${rrTexto}. A decisão é sua.`;
  }

  const bons = fatores.filter((f) => f.avaliacao === 'BOM').length;
  const ruins = fatores.filter((f) => f.avaliacao === 'RUIM').length;

  if (bons === fatores.length) {
    return `Todos os ${fatores.length} fatores de localização são favoráveis a este preço de entrada, com ${rrTexto}. A decisão é sua.`;
  }
  if (ruins >= 2) {
    return `${ruins} de ${fatores.length} fatores de localização pesam contra este preço de entrada, com ${rrTexto}. A decisão é sua.`;
  }
  return `${bons} de ${fatores.length} fatores de localização são favoráveis a este preço de entrada, com ${rrTexto}. A decisão é sua.`;
};

export const BlocoConviccaoQualidade: React.FC<Props> = ({ score, rr, fatores, direcao }) => (
  <section className="bg-black/40 rounded-lg p-[16px] border border-white/[0.05] relative z-10 mb-5">
    <div className="grid grid-cols-2 gap-4 mb-4">
      <div>
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Convicção</span>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <strong className="text-lg font-mono text-white">{score ?? '—'}</strong>
          {score != null && <small className="text-gray-600 text-xs">/90</small>}
          <em className="text-[10px] text-gray-400 not-italic ml-1">{faixaDeConviccao(score)}</em>
        </div>
      </div>
      <div>
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Risco e retorno</span>
        <div className="mt-0.5">
          <strong className="text-lg font-mono text-white">1:{rr?.toFixed(2) ?? '—'}</strong>
        </div>
      </div>
    </div>

    <div className="border-t border-white/[0.05] pt-3">
      <h4 className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-2">
        Qualidade da entrada {direcao === 'SHORT' ? '(SHORT)' : '(LONG)'}
      </h4>
      {fatores.length === 0 ? (
        <p className="text-xs text-gray-500">Sem dados de localização suficientes para os quatro fatores.</p>
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
