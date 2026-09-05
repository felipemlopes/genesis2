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
  // V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 13, item 13.7, doc §18): achado real —
  // este componente fazia seu próprio `rr.toFixed(2)`/`rrBruto.toFixed(2)`, uma segunda origem de
  // formatação além do backend (ExecucaoService::formatarRrExibir()) — mesmo padrão de risco já
  // eliminado em outros pontos da tela (canonicalMoney.ts, Fase 11). Agora recebe as strings
  // prontas ("1:%.2f") direto do payload, nunca reconstrói.
  rrExibir: string | null;
  rrBrutoExibir?: string | null;
  // V6.6 (F01, DF-02): risco e retorno passa a existir só aqui — dentro do mínimo, mostra só o
  // número; abaixo do mínimo, o número ganha a observação entre parênteses. rrMinimo/rrAbaixoDoMinimo
  // vêm prontos do backend (rr_minimo_referencia/rr_abaixo_do_minimo, ver E04) — nunca recalculados.
  // rrMinimo continua número puro (não string pronta): é config fixo (genesis.rr_minimo), uma
  // única fonte, sem o risco de duas formatações divergentes que motivou o resto desta mudança.
  rrMinimo?: number | null;
  rrAbaixoDoMinimo?: boolean;
  // Spec genesis-v6-10-implementacao (Fase 9, item 9.2, doc §9.2): rrExibir agora é o R:R
  // COMBINADO dos três alvos (parciais configuráveis) — "o esquema de parciais aparece na tela,
  // para o membro saber de onde saiu o número". null quando o backend não populou (decisão
  // antiga/cacheada anterior a esta fase); nesse caso a legenda simplesmente não aparece.
  parciaisAlvo?: Record<string, number> | null;
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
const montarConclusao = (rrExibir: string | null, fatores: FatorQualidadeEntrada[]): string => {
  const total = fatores.length;

  if (total === 0) {
    return 'Sem dados suficientes para avaliar a localização desta entrada. A decisão é sua.';
  }

  const favoraveis = fatores.filter((f) => f.avaliacao === 'BOM').length;
  const plural = total === 1 ? 'fator' : 'fatores';
  const verbo = favoraveis === 1 ? 'é favorável' : 'são favoráveis';

  const base = `${favoraveis} de ${total} ${plural} de localização ${verbo} a este preço de entrada`;
  const comRr = rrExibir !== null ? `${base}, com R:R de ${rrExibir}` : base;

  return `${comRr}. A decisão é sua.`;
};

// Item 9.2 (doc §9.2): "50% TP1 + 30% TP2 + 20% TP3" — a ordem segue tp1/tp2/tp3 sempre, não a
// ordem de inserção do objeto (que o backend não garante).
const ORDEM_ALVO = ['tp1', 'tp2', 'tp3'] as const;
const ROTULO_ALVO: Record<string, string> = { tp1: 'TP1', tp2: 'TP2', tp3: 'TP3' };
const formatarEsquemaDeParciais = (parciaisAlvo: Record<string, number> | null | undefined): string | null => {
  if (!parciaisAlvo) return null;
  const partes = ORDEM_ALVO
    .filter((chave) => parciaisAlvo[chave] != null)
    .map((chave) => `${Math.round(parciaisAlvo[chave] * 100)}% ${ROTULO_ALVO[chave]}`);

  return partes.length > 0 ? partes.join(' + ') : null;
};

export const BlocoConviccaoQualidade: React.FC<Props> = ({ rrExibir, rrBrutoExibir, rrMinimo, rrAbaixoDoMinimo, parciaisAlvo, fatores, direcao }) => (
  <section className="bg-black/40 rounded-lg p-[16px] border border-white/[0.05] relative z-10 mb-5">
    <div className="grid grid-cols-1 gap-4 mb-4">
      <div>
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Risco e retorno</span>
        {/* V6.7 (C-26): bruto e líquido lado a lado, cada um rotulado — nenhum dos dois some. */}
        <div className="mt-0.5 space-y-0.5">
          {rrExibir == null && rrBrutoExibir == null ? (
            <span className="text-sm text-gray-500">sem alvo ancorado em barreira real</span>
          ) : (
            <>
              {rrBrutoExibir != null && (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <strong className="text-sm font-mono text-gray-300">{rrBrutoExibir}</strong>
                  {/* V6.8 (CODE-P1-11, Adendo A.2, determinação do PO): a observação sobre custos
                      sai do líquido e vem para o bruto. "Líquido" já significa, por definição,
                      valor com tudo descontado — a legenda ali só repetia a palavra. Quem precisa
                      de explicação é o bruto: o membro vê 1:0,72 acima de 1:0,65 e a legenda diz
                      por quê. */}
                  <span className="text-[9px] text-gray-500">bruto (não considera taxas, spread e slippage)</span>
                </div>
              )}
              {rrExibir != null && (
                <>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <strong className="text-lg font-mono text-white">{rrExibir}</strong>
                    <span className="text-[9px] text-gray-500">combinado</span>
                    {rrAbaixoDoMinimo && (
                      <span className="text-[10px] text-amber-500">
                        (cuidado, risco retorno abaixo do recomendado, 1:{(rrMinimo ?? 0).toFixed(2)})
                      </span>
                    )}
                  </div>
                  {/* Item 9.2 (doc §9.2): "O esquema de parciais aparece na tela, para o membro
                      saber de onde saiu o número" — só quando o backend populou (decisão nova). */}
                  {formatarEsquemaDeParciais(parciaisAlvo) && (
                    <span className="text-[9px] text-gray-500 block">{formatarEsquemaDeParciais(parciaisAlvo)}</span>
                  )}
                </>
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
      {montarConclusao(rrExibir, fatores)}
    </p>
  </section>
);

export default BlocoConviccaoQualidade;
