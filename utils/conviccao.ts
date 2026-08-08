// V6.5 (G06): Gênesis não é sala de sinal — "Leitura Confirmada" era o único termo da tela que
// podia ser lido como recomendação. faixaDeConviccao() troca o rótulo binário confirmado/cautela
// por uma faixa qualitativa derivada só do score (teto 90, ver G05).
//
// V6.7 (C-28b): a V6.6 (F04) tinha unificado esta tabela com o corte de referência que
// GenesisPrompt.php usa pro próprio modelo ("0-30 frágil; 35-50 limitada; 55-65 moderada; 70-80
// forte; 85-90 excepcional"), renomeando as faixas pra Frágil/Limitada/Moderada/Forte/Excepcional —
// mas essa nomenclatura contraria a determinação da V6.4: Convicção Fraca, Parcial, Consistente e
// Forte. Você seguiu o documento (F04), que era o comportamento certo; o documento é que estava fora
// de sincronia com a determinação anterior. Tabela e rótulos abaixo recuperados literalmente do
// histórico do repositório (commit anterior a F04, ad31429), não reconstruídos de memória — sem
// ambiguidade no mapeamento de 5 faixas para 4: são os 3 cortes originais (40/60/75), o resto (>75)
// é só "Forte", sem uma quinta faixa "Excepcional".
export const FAIXAS_CONVICCAO = [
  { ate: 40, rotulo: 'Convicção Fraca' },
  { ate: 60, rotulo: 'Convicção Parcial' },
  { ate: 75, rotulo: 'Convicção Consistente' },
] as const;

export const faixaDeConviccao = (score: number | null | undefined): string => {
  if (score == null) return 'Sem leitura';
  return FAIXAS_CONVICCAO.find(f => score <= f.ate)?.rotulo ?? 'Convicção Forte';
};
