/**
 * Classificador de EMAs dinâmicas detectadas no gráfico do usuário.
 * Categoriza EMAs em curta (≤25), média (26-100) e longa (>100),
 * selecionando a de menor período como representante de cada categoria.
 */

export interface EMADetectada {
  periodo: number;
  valor: number;
}

export interface EMAsClassificadas {
  curta: EMADetectada | null;   // período ≤ 25
  media: EMADetectada | null;   // período 26-100
  longa: EMADetectada | null;   // período > 100
}

/**
 * Classifica uma lista de EMAs detectadas em 3 categorias (curta, média, longa)
 * e seleciona a de menor período como representante quando há múltiplas na mesma categoria.
 *
 * Regras:
 * - Curta: período ≤ 25
 * - Média: período entre 26 e 100 (inclusive)
 * - Longa: período > 100
 * - Se múltiplas EMAs caem na mesma categoria, a de menor período é escolhida.
 * - EMAs com período ≤ 0 são ignoradas.
 */
export function classificarEMAs(emas: EMADetectada[]): EMAsClassificadas {
  const resultado: EMAsClassificadas = {
    curta: null,
    media: null,
    longa: null,
  };

  for (const ema of emas) {
    if (ema.periodo <= 0) continue;

    if (ema.periodo <= 25) {
      if (resultado.curta === null || ema.periodo < resultado.curta.periodo) {
        resultado.curta = ema;
      }
    } else if (ema.periodo <= 100) {
      if (resultado.media === null || ema.periodo < resultado.media.periodo) {
        resultado.media = ema;
      }
    } else {
      if (resultado.longa === null || ema.periodo < resultado.longa.periodo) {
        resultado.longa = ema;
      }
    }
  }

  return resultado;
}
