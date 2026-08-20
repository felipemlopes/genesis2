// V6.5 (G03): rótulos de fonte de alvo (tp1_fonte/tp2_fonte/tp3_fonte) chegavam em snake_case cru
// do backend (ex.: "resistencia_suporte", "cluster_liquidacao") e eram exibidos direto na tela, sem
// tradução — valores internos de AlvoService::PESOS, nunca pensados como texto de apresentação.
const ROTULOS_FONTE: Record<string, string> = {
  cluster_liquidacao: 'Cluster de liquidação',
  parede_book: 'Parede do book',
  range_wyckoff: 'Borda do range (Wyckoff)',
  resistencia_suporte: 'Suporte/resistência visual',
  pdh_pdl: 'Máxima/mínima do dia anterior',
  // V6.7 (G-45): faltavam desde a V6.6 (itens B02/B03) — o backend já envia essas duas fontes
  // (ExecucaoService.php: $add(..., 'pwh_pwl'); $add($figura['alvo_projetado'], 'figura_projetada')),
  // mas sem rótulo aqui a tela mostrava a string crua ("pwh_pwl" no POLUSDT).
  pwh_pwl: 'Máxima/mínima do período anterior',
  figura_projetada: 'Alvo projetado pela figura gráfica',
  poc: 'POC (maior volume)',
  hvn: 'Nó de alto volume (HVN)',
  ema: 'Média móvel (EMA)',
  geometria: 'Fibonacci',
  projecao: 'Projeção (sem barreira real)',
  // C1/C3/C4/C5 (V6.9): novas fontes de barreira de alvo — fallback pra quando tp*_rotulo (C7, o
  // rótulo completo vindo do backend) não está presente (decisão cacheada antes deste item).
  pivo_swing: 'Fundo/topo de swing',
  lvn: 'Nó de baixo volume (LVN)',
  figura_extremidade: 'Extremidade da figura identificada',
  fibonacci: 'Fibonacci',
  numero_redondo: 'Número redondo',
  // V6.7 (A-01/A-13): tipos do pool de âncoras de STOP (NivelService) — distintos das fontes de
  // ALVO acima (mesmo nome de arquivo, tabelas de peso diferentes, ver NivelService::PESO_TIPO_ANCORA).
  tese: 'Nível que definiu a direção (estrutura/rompimento)',
  pivo: 'Pivô de preço (topo/fundo)',
  borda_hvn: 'Borda de volume (HVN/POC)',
};

// V6.7 (G-45): antes "?? fonte" devolvia a string crua do backend quando não reconhecida — foi assim
// que "gap_fill" (string que não existe em nenhum arquivo do repositório) chegou à tela do POLUSDT, e
// "extensao" (tp3_fonte legado, V4.3) apareceu em provas antigas. Fonte desconhecida agora vira um
// rótulo genérico legível, e um aviso no console torna a fonte órfã detectável em vez de silenciosa.
export function rotularFonte(fonte: string | null | undefined): string | null {
  if (!fonte) return null;
  const rotulo = ROTULOS_FONTE[fonte];
  if (rotulo) return rotulo;
  console.warn(`[genesis] fonte de alvo sem rótulo mapeado em utils/rotulos.ts: "${fonte}"`);
  return 'Nível técnico';
}

// V6.7 (A-14): componente vencedor do buffer composto do stop (NivelService::calcularBuffer()) —
// mesma ideia de rotularFonte(), mapa próprio porque são chaves diferentes (não são fonte de nível).
const ROTULOS_BUFFER: Record<string, string> = {
  atr_0_5: 'piso de 0,5 ATR',
  pavios: 'margem de pavio',
  spread: 'spread',
  slippage: 'slippage',
};

export function rotularComponenteBuffer(componente: string | null | undefined): string {
  if (!componente) return 'margem de segurança';
  return ROTULOS_BUFFER[componente] ?? componente;
}
