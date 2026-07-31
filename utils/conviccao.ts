// V6.5 (G06): Gênesis não é sala de sinal — "Leitura Confirmada" era o único termo da tela que
// podia ser lido como recomendação. faixaDeConviccao() troca o rótulo binário confirmado/cautela
// por uma faixa qualitativa derivada só do score (teto 90, ver G05), sem depender de flag do backend.
export const faixaDeConviccao = (score: number | null | undefined): string => {
  if (score == null) return 'Sem leitura';
  if (score <= 40) return 'Convicção Fraca';
  if (score <= 60) return 'Convicção Parcial';
  if (score <= 75) return 'Convicção Consistente';
  return 'Convicção Forte';
};
