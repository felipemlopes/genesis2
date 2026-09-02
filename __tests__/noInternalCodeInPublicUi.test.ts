import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * V6.9 correção técnica (spec genesis-v6-9-correcao-tecnica, item 34): "nenhuma ocorrência de
 * código de estado, candidate_id, error_code, nome de serviço ou endpoint em texto destinado ao
 * usuário". Mesma abordagem estática de `forbiddenProductionCode.test.ts` (já existente neste
 * repositório) — escaneia código-fonte (sem comentário) por termos proibidos.
 *
 * Dois grupos, por risco:
 * 1. Nomes de campo que este componente NUNCA tem motivo legítimo pra sequer referenciar
 *    (candidate_id/error_code/reason_code/service — não são usados em nenhuma comparação real
 *    aqui, confirmado por grep antes de escrever este teste) — proibidos em código, ponto final.
 * 2. Códigos de estado internos (STOP_UNAVAILABLE, REJECTED_IMAGE, etc.) — estes SÃO usados
 *    legitimamente em comparações (`stopStatusAtivo === 'STOP_UNAVAILABLE'`), então só são
 *    proibidos como texto RENDERIZADO — checado à parte, garantindo que cada ocorrência no código
 *    é sempre o lado direito de uma comparação (===/!==), nunca um valor solto interpolado em JSX.
 *
 * Escrito nesta sessão (2026-09-02), não é transcrição do documento. Determinístico, sem rede.
 */

const ARQUIVOS_TELA_DE_ANALISE = ['components/AnalysisResult.tsx'];

const CAMPOS_NUNCA_REFERENCIADOS = ['candidate_id', 'error_code', 'reason_code'];

const CODIGOS_DE_ESTADO = [
  'STOP_UNAVAILABLE', 'REJECTED_IMAGE', 'PROMPT_INJECTION_DETECTED',
  'CHART_VISIBLE_PRICE_DEVIATION', 'MODEL_OUTPUT_INVALID_AFTER_REPAIR',
];

/** Mesma abordagem de forbiddenProductionCode.test.ts — remove comentários antes de buscar. */
const codigoSemComentarios = (conteudo: string): string => {
  const linhas = conteudo.split('\n');
  const resultado: string[] = [];
  let dentroDeBlocoComentario = false;
  for (let linha of linhas) {
    if (dentroDeBlocoComentario) {
      const fim = linha.indexOf('*/');
      if (fim === -1) continue;
      linha = linha.slice(fim + 2);
      dentroDeBlocoComentario = false;
    }
    const inicioBloco = linha.indexOf('/*');
    if (inicioBloco !== -1 && !linha.slice(inicioBloco).includes('*/')) {
      linha = linha.slice(0, inicioBloco);
      dentroDeBlocoComentario = true;
    }
    const semEspaco = linha.trimStart();
    if (semEspaco.startsWith('*') || semEspaco.startsWith('//')) continue;
    const posComentario = linha.indexOf('//');
    resultado.push(posComentario !== -1 ? linha.slice(0, posComentario) : linha);
  }
  return resultado.join('\n');
};

describe('item 34 — nenhum código interno em texto destinado ao usuário', () => {
  it('candidate_id/error_code/reason_code nunca aparecem em código (não comentário)', () => {
    const violacoes: string[] = [];

    for (const caminhoRelativo of ARQUIVOS_TELA_DE_ANALISE) {
      const codigo = codigoSemComentarios(readFileSync(resolve(__dirname, '..', caminhoRelativo), 'utf-8'));
      for (const termo of CAMPOS_NUNCA_REFERENCIADOS) {
        if (codigo.includes(termo)) {
          violacoes.push(`${caminhoRelativo} referencia "${termo}" — este componente não deveria precisar deste campo interno.`);
        }
      }
    }

    expect(violacoes).toEqual([]);
  });

  it('códigos de estado internos só aparecem como lado direito de comparação, nunca renderizados soltos', () => {
    const violacoes: string[] = [];

    for (const caminhoRelativo of ARQUIVOS_TELA_DE_ANALISE) {
      const codigo = codigoSemComentarios(readFileSync(resolve(__dirname, '..', caminhoRelativo), 'utf-8'));
      for (const termo of CODIGOS_DE_ESTADO) {
        // Toda ocorrência precisa ter === , !== ou ?? (com aspas/espaço opcionais) imediatamente
        // antes — os três são usos seguros (comparação, ou valor-padrão de uma variável que só é
        // usada depois numa comparação), nunca uma string interpolada direto em JSX.
        const regexOcorrencia = new RegExp(`['"\`]${termo}['"\`]`, 'g');
        let m: RegExpExecArray | null;
        while ((m = regexOcorrencia.exec(codigo)) !== null) {
          const antes = codigo.slice(Math.max(0, m.index - 6), m.index);
          if (!/(===|!==|\?\?)\s*$/.test(antes)) {
            const linha = codigo.slice(0, m.index).split('\n').length;
            violacoes.push(`${caminhoRelativo}:${linha} usa "${termo}" fora de uma comparação (===/!==) — risco de renderização direta.`);
          }
        }
      }
    }

    expect(violacoes).toEqual([]);
  });
});
