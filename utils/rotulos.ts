// V6.5 (G03): rótulos de fonte de alvo (tp1_fonte/tp2_fonte/tp3_fonte) chegavam em snake_case cru
// do backend (ex.: "resistencia_suporte", "cluster_liquidacao") e eram exibidos direto na tela, sem
// tradução — valores internos de AlvoService::PESOS, nunca pensados como texto de apresentação.
const ROTULOS_FONTE: Record<string, string> = {
  cluster_liquidacao: 'Cluster de liquidação',
  parede_book: 'Parede do book',
  range_wyckoff: 'Borda do range (Wyckoff)',
  resistencia_suporte: 'Suporte/resistência visual',
  pdh_pdl: 'Máxima/mínima do dia anterior',
  poc: 'POC (maior volume)',
  hvn: 'Nó de alto volume (HVN)',
  ema: 'Média móvel (EMA)',
  geometria: 'Fibonacci',
  projecao: 'Projeção (sem barreira real)',
};

export function rotularFonte(fonte: string | null | undefined): string | null {
  if (!fonte) return null;
  return ROTULOS_FONTE[fonte] ?? fonte;
}
