/**
 * F9 (V6.9, spec genesis-v6-9-correcao-completa, Fase 7): variação no cabeçalho passa a refletir
 * o PRÓPRIO candle analisado (data.candle_change_pct, TechnicalAnalysisService::calcular() no
 * backend), não mais o ticker de 24h (change24h, prop externa sem relação com o timeframe/candle
 * desta análise). Sem `@testing-library/react` — mesmo padrão de asserção sobre texto-fonte.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../AnalysisResult.tsx'),
  'utf-8',
);

describe('AnalysisResult — variação do candle analisado no cabeçalho (F9)', () => {
  it('usa data.candle_change_pct, não mais a prop change24h', () => {
    expect(fonte).toContain('data.candle_change_pct');
    // A prop foi removida da interface e da desestruturação — só sobrevive numa nota histórica
    // no comentário explicando a mudança (F9 acima), nunca mais como identificador de código.
    expect(fonte).not.toContain('change24h?:');
    expect(fonte).not.toContain('{ data, change24h');
    expect(fonte).not.toContain('{change24h}');
    expect(fonte).not.toContain('isPositiveChange');
  });
});
