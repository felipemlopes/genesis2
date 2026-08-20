/**
 * Item A11 do Gênesis V6.9 — a versão antiga chamava `/fapi/v1/allForceOrders` (descontinuado
 * pela Binance) e, ao falhar, gerava números aleatórios exibidos como liquidação real. Tinha
 * dois símbolos fixos (BTC/ETH), nunca o ativo que o membro estava analisando. Sem
 * `@testing-library/react` neste projeto — mesmo padrão de asserção sobre texto-fonte de
 * `ScoreBasisBars.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../LiquidationHeatmap.tsx'),
  'utf-8',
);

describe('LiquidationHeatmap — mapa estimado por Open Interest, não mais allForceOrders', () => {
  it('não chama mais o endpoint descontinuado nem gera dado aleatório', () => {
    // 'allForceOrders' e 'Math.random()' ainda aparecem no docblock, como histórico do porquê
    // da reescrita — o que importa é que não há chamada de rede nem geração de número aleatório
    // FORA de comentários. Remove todo comentário /** ... */ e // antes de checar.
    const semComentarios = fonte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(semComentarios).not.toContain('allForceOrders');
    expect(semComentarios).not.toContain('Math.random()');
  });

  it('recebe o símbolo por propriedade, não hardcoded', () => {
    expect(fonte).toMatch(/symbol\s*[,:]/);
    expect(fonte).not.toContain("'BTCUSDT'");
    expect(fonte).not.toContain("'ETHUSDT'");
  });

  it('consome fetchLiquidationMap (backend), não fetchWithProxy direto na Binance', () => {
    expect(fonte).toContain('fetchLiquidationMap');
    expect(fonte).not.toContain('fetchWithProxy');
  });

  it('rotula explicitamente como estimativa, nunca como liquidação observada', () => {
    expect(fonte).toContain('Estimado a partir do Open Interest');
  });
});
