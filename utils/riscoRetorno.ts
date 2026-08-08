// V6.7 (C-27): o payload só traz rr_bruto/rr_liquido_estimado prontos para TP1
// (ExecucaoService::montar(), $recompensaPreco usa só $tp1) — TP2 e TP3 não têm risco-retorno
// próprio calculado no backend. Fórmula abaixo replica exatamente
// ExecucaoService::calcularRrLiquidoEstimado() (backend), para não divergir do número que o
// backend mostraria se calculasse: custo em preço = preco * (custoTotalBps / 10000); risco líquido
// = risco + custo; recompensa líquida = max(0, recompensa - custo); rr = recompensa / risco.
//
// Mesmo princípio de V6.6 (E04): risco-retorno só tem significado sobre barreira real, nunca sobre
// projeção geométrica pura ("o número parece medido e não é") — alvo com fonte 'projecao' devolve
// null, igual ao backend faz para TP1 (tp1Real).
export interface RiscoRetornoAlvo {
  bruto: number | null;
  liquido: number | null;
}

const arredondar2 = (valor: number): number => Math.round(valor * 100) / 100;

export function calcularRiscoRetornoAlvo(
  entrada: number | null | undefined,
  stop: number | null | undefined,
  alvo: number | null | undefined,
  fonte: string | null | undefined,
  custoTotalBps: number | null | undefined,
): RiscoRetornoAlvo {
  if (entrada == null || stop == null || alvo == null || fonte === 'projecao') {
    return { bruto: null, liquido: null };
  }

  const riscoPreco = Math.abs(entrada - stop);
  const recompensaPreco = Math.abs(alvo - entrada);
  if (riscoPreco <= 0) {
    return { bruto: null, liquido: null };
  }

  const bruto = arredondar2(recompensaPreco / riscoPreco);

  if (entrada <= 0 || custoTotalBps == null) {
    return { bruto, liquido: null };
  }

  const custoPreco = entrada * (custoTotalBps / 10_000);
  const riscoLiquido = riscoPreco + custoPreco;
  const recompensaLiquida = Math.max(0, recompensaPreco - custoPreco);
  const liquido = riscoLiquido > 0 ? arredondar2(recompensaLiquida / riscoLiquido) : null;

  return { bruto, liquido };
}
