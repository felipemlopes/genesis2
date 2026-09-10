import React from 'react';
import { Check, Minus, X, HelpCircle } from 'lucide-react';

/**
 * V6.5 (G15, Decisão 8 do PO): a tela tinha 2 números medindo coisas diferentes — a convicção
 * (direção) em letra garrafal no topo, e o R:R (qualidade do preço de entrada) escondido em letra
 * pequena. O membro batia o olho no número grande e lia "operação aprovada". Este bloco separa as
 * 3 perguntas (Convicção: pra onde o mercado vai? / Qualidade da entrada: este preço é bom? /
 * Risco e retorno: quanto pago pelo risco?) e mostra a Qualidade da entrada como 4 fatores de
 * LOCALIZAÇÃO abertos e verificáveis no próprio gráfico — nunca uma nota composta ou porcentagem
 * inventada. Os fatores vêm prontos de QualidadeEntradaService (backend); este componente só
 * exibe.
 *
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.11, doc §16): a coluna
 * Convicção saiu daqui — era uma repetição exata do número que já aparece em letra garrafal no
 * topo de AnalysisResult.tsx (com o mesmo faixaDeConviccao()), a duplicação que a doutrina G15
 * original já pretendia evitar. Risco e retorno passa a ser a única coluna, grid-cols-2 →
 * grid-cols-1.
 *
 * Hotfix V6.11 final (spec genesis-v6-11-hotfix-final, Fase 3, item P0.10, 10/09/2026): a coluna
 * "Risco e retorno" (R:R combinado dos três alvos, spec genesis-v6-10-implementacao Fase 9 item
 * 9.2) foi REMOVIDA por completo — decisão de produto. Cada alvo mostra exclusivamente o próprio
 * R:R nos cards de TP1/TP2/TP3 (AnalysisResult.tsx, rrPorAlvo.tp1/tp2/tp3); este bloco volta a ser
 * só sobre Qualidade da entrada.
 */

// V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.6, doc §18): achado real —
// QualidadeEntradaService::avaliar() (backend) escondia um fator inteiro da lista quando faltava
// insumo (array_filter removia o null) — o card sumia em vez de aparecer como indisponível,
// violando a mesma regra já corrigida para os 4 cards de ScoreBasisBars.tsx (Fase 11): "os fatores
// aparecem sempre, ausência vira um selo explícito, nunca a ausência do card inteiro". Backend
// agora sempre devolve os 4; UNAVAILABLE é o novo valor que representa essa ausência.
export type AvaliacaoFator = 'BOM' | 'MEDIO' | 'RUIM' | 'UNAVAILABLE';

export interface FatorQualidadeEntrada {
  fator: string;
  avaliacao: AvaliacaoFator;
  detalhe: string;
}

interface Props {
  fatores: FatorQualidadeEntrada[];
  direcao: 'LONG' | 'SHORT';
}

const ICONE: Record<AvaliacaoFator, React.ReactNode> = {
  BOM: <Check size={12} />,
  MEDIO: <Minus size={12} />,
  RUIM: <X size={12} />,
  UNAVAILABLE: <HelpCircle size={12} />,
};

const COR: Record<AvaliacaoFator, string> = {
  BOM: 'text-genesis-positive',
  MEDIO: 'text-purple-400',
  RUIM: 'text-genesis-negative',
  UNAVAILABLE: 'text-gray-500',
};

// V6.6 (F09): antes a conclusão alternava entre duas gramáticas ("pesam contra" quando 2+ fatores
// eram ruins, "são favoráveis" nos outros casos) e o bloco vazio citava "os quatro fatores" mesmo
// quando só existiam três (contagem sempre dinâmica em produção, nunca fixa em quatro). Gramática
// única e contagem dinâmica, mesmo texto para qualquer combinação de fatores.
// Hotfix V6.11 final (item P0.10): não cita mais o R:R (combinado, removido) — só os fatores de
// localização, que são o que este bloco de fato mede.
const montarConclusao = (fatores: FatorQualidadeEntrada[]): string => {
  const total = fatores.length;

  if (total === 0) {
    return 'Sem dados suficientes para avaliar a localização desta entrada. A decisão é sua.';
  }

  const favoraveis = fatores.filter((f) => f.avaliacao === 'BOM').length;
  const plural = total === 1 ? 'fator' : 'fatores';
  const verbo = favoraveis === 1 ? 'é favorável' : 'são favoráveis';

  return `${favoraveis} de ${total} ${plural} de localização ${verbo} a este preço de entrada. A decisão é sua.`;
};

export const BlocoConviccaoQualidade: React.FC<Props> = ({ fatores, direcao }) => (
  <section className="bg-black/40 rounded-lg p-[16px] border border-white/[0.05] relative z-10 mb-5">
    <div>
      {/* Item 4.12: cabeçalho e itens sobem de tamanho junto do R:R acima — mesmo eixo de
          hierarquia visual, sem virar porcentagem nem mudar layout/interação. */}
      <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
        Qualidade da entrada {direcao === 'SHORT' ? '(SHORT)' : '(LONG)'}
      </h4>
      {fatores.length === 0 ? (
        <p className="text-sm text-gray-500">Sem dados de localização suficientes para avaliar esta entrada.</p>
      ) : (
        <ul className="space-y-2">
          {fatores.map((f) => (
            <li key={f.fator} className="flex items-start gap-2 text-sm">
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
      {montarConclusao(fatores)}
    </p>
  </section>
);

export default BlocoConviccaoQualidade;
