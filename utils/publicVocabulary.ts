// V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.13, doc §16): defesa em
// profundidade para termos técnicos em inglês que às vezes escapam pra dentro de texto livre
// (narrativa técnica, descrição de plano, legendas) — mesmo princípio já usado pra banir o radical
// CONFIRM em texto público (GenesisPrompt::system(), backend): a instrução do prompt reduz a
// chance de acontecer, mas não impede fisicamente; a defesa real fica no ponto de exibição.
//
// LONG/SHORT especificamente: o prompt já proíbe o decisor de escrevê-los em prosa
// (GenesisPrompt::system(), "a direção já aparece separada na interface") — se um deles escapar
// mesmo assim, mostrar a palavra de novo dentro do texto (ou, pior, uma direção desatualizada/
// contraditória num repair) é mais confuso do que omitir; por isso os dois são removidos, não
// traduzidos. 1W/1M são o par ambíguo que o resto do sistema já trata com cuidado (1M mês vs.
// 1m minuto, ver BinanceService no backend) — expandidos por extenso quando aparecem citados em
// texto livre, nunca deixados como código cru.
//
// `publicText()` só troca token INTEIRO (fronteira de palavra), preservando maiúsculas/minúsculas
// do resto da frase — nunca mexe em substring dentro de outra palavra.

const SUBSTITUICOES: ReadonlyArray<[RegExp, string]> = [
  [/\bLONG\b/g, ''],
  [/\bSHORT\b/g, ''],
  [/\bOPEN INTEREST\b/gi, 'Open Interest'],
  [/\bSQUEEZE\b/g, 'squeeze'],
  [/\bCHOCH\b/gi, 'CHoCH'],
  [/\bMARKUP\b/g, 'Markup'],
  [/\bMARKDOWN\b/g, 'Markdown'],
  [/\bWYCKOFF\b/gi, 'Wyckoff'],
  // V6.9 pacote final (Fase 13, item 13.5, achado real ao portar esta lógica pro backend): sem o
  // (?!\)) negativo, normalizar um texto já normalizado re-expande o próprio "1W"/"1M" que a
  // substituição acabou de colocar dentro dos parênteses — "semanal (1W)" virava "semanal (semanal
  // (1W))" numa segunda passada, quebrando a idempotência que este arquivo promete no docblock.
  [/\b1W\b(?!\))/g, 'semanal (1W)'],
  [/\b1M\b(?!\))/g, 'mensal (1M)'],
];

/**
 * Aplica antes de renderizar qualquer narrativa/legenda/descrição de plano vinda do backend
 * (technical_analysis, score_description, macro.resumo, sentiment.narrativa, descrição do
 * Plano B). Idempotente — chamar de novo sobre um texto já processado não muda nada.
 */
export const publicText = (texto: string | null | undefined): string => {
  if (!texto) return texto ?? '';

  let resultado = texto;
  for (const [padrao, substituto] of SUBSTITUICOES) {
    resultado = resultado.replace(padrao, substituto);
  }

  // LONG/SHORT viram string vazia (removidos, não traduzidos, ver docblock acima) — pode deixar
  // espaço duplo ou pontuação solta onde a palavra estava; normaliza espaçamento sem tocar o
  // resto da pontuação da frase.
  return resultado.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([,.;:!?])/g, '$1').trim();
};
