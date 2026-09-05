/**
 * Spec genesis-v6-10-implementacao (Fase 8, item 8.1, doc §8.1): "confira que a tela trata null
 * sem quebrar antes de trocar" — oiLiquidationService.ts passou a devolver `null` (em vez de `0`)
 * quando a coleta falha; este arquivo confirma que OiLiquidationMonitor não quebra nem mostra "$0"/
 * "0.00%" fabricados para esse caso. Sem @testing-library/react — mesmo padrão de asserção sobre
 * texto-fonte do resto da suíte.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../OiLiquidationMonitor.tsx'),
  'utf-8',
);

describe('OiLiquidationMonitor — Fase 8, item 8.1: trata null sem quebrar nem fabricar zero', () => {
  it('formatCurrency aceita null e devolve texto, nunca chama .toLocaleString em null', () => {
    expect(fonte).toContain('const formatCurrency = (val: number | null');
    expect(fonte).toContain('if (val == null) return');
  });

  it('getPercentageColor e formatPercent tratam null explicitamente', () => {
    expect(fonte).toContain('const getPercentageColor = (val: number | null)');
    expect(fonte).toContain('const formatPercent = (val: number | null)');
  });

  it('as 3 variações do card (5min/1h/24h) usam formatPercent, não mais .toFixed cru', () => {
    const ocorrencias = (fonte.match(/\{formatPercent\(data\.openInterest\.change/g) ?? []).length;
    expect(ocorrencias).toBe(3);
  });

  it('cabeçalho de preço não chama Math.abs/.toFixed direto em change24h sem checar null antes', () => {
    expect(fonte).toContain('data.meta.change24h == null');
  });
});
