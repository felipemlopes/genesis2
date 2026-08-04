// V6.5 (G06): Gênesis não é sala de sinal — "Leitura Confirmada" era o único termo da tela que
// podia ser lido como recomendação. faixaDeConviccao() troca o rótulo binário confirmado/cautela
// por uma faixa qualitativa derivada só do score (teto 90, ver G05).
//
// V6.6 (F04): a tabela anterior aqui (Fraca até 40, Parcial até 60, Consistente até 75, Forte
// acima de 75) divergia do corte que o prompt já usa em GenesisPrompt.php ("Referência
// qualitativa: 0-30 frágil; 35-50 limitada; 55-65 moderada; 70-80 forte; 85-90 excepcional") —
// um score 75 (emitido pelo modelo como "forte", caso comum nas análises reais de 01/08/2026)
// aparecia na tela como "Consistente". Tabela única, mesmo corte dos dois lados.
export const FAIXAS_CONVICCAO = [
  { ate: 30, rotulo: 'Convicção Frágil' },
  { ate: 50, rotulo: 'Convicção Limitada' },
  { ate: 65, rotulo: 'Convicção Moderada' },
  { ate: 80, rotulo: 'Convicção Forte' },
  { ate: 90, rotulo: 'Convicção Excepcional' },
] as const;

export const faixaDeConviccao = (score: number | null | undefined): string => {
  if (score == null) return 'Sem leitura';
  return FAIXAS_CONVICCAO.find(f => score <= f.ate)?.rotulo ?? 'Convicção Frágil';
};
