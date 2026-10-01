/**
 * V6.12 (§8.3): a posição confirmada é gravada no servidor com o plano e o stop efetivo, e a tela de
 * posições recarrega do servidor (sobrevive ao F5). Lógica pura em `utils/posicoes.ts`; a ligação nos
 * componentes é conferida no texto-fonte (sem `@testing-library/react` neste projeto).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { tradeDoServidor, separarPorStatus, type TradeDoServidor } from '../utils/posicoes';

const doServidor: TradeDoServidor = {
  id: 42,
  analysis_uuid: 'uuid-apt',
  plano: 'B',
  exchange: 'binance',
  date: '2026-09-30T14:05:00+00:00',
  asset: 'APTUSDT',
  leverage: '5',
  direction: 'LONG',
  status: 'Pendente',
  pnl: null,
  entryPrice: '0.80980000',
  currentPriceStr: null,
  targetPrice: '0.87490000',
  financialTarget: null,
  liquidationPrice: '0.6519',
  amount: '51.28',
  stopPrice: 0.7355,
  stopRecommended: 0.6974,
  stopSource: 'USER_ADJUSTED',
};

describe('tradeDoServidor', () => {
  const t = tradeDoServidor(doServidor);

  it('traz o plano e o stop confirmado', () => {
    expect(t.plano).toBe('B');
    expect(t.stopPrice).toBe(0.7355);
    expect(t.stopSource).toBe('USER_ADJUSTED');
    expect(t.analysisUuid).toBe('uuid-apt');
  });

  it('converte os números que o servidor guarda como texto', () => {
    expect(t.entryPrice).toBe(0.8098);
    expect(t.targetPrice).toBe(0.8749);
    expect(t.liquidationPrice).toBe(0.6519);
    expect(t.amount).toBe(51.28);
  });

  it('formata ativo, alavancagem, id e P&L como a tela já mostrava', () => {
    expect(t.id).toBe('42');
    expect(t.asset).toBe('APT/USDT');
    expect(t.leverage).toBe('5x');
    expect(t.pnl).toBe('$0.00 (0.00%)');
    expect(t.date).toMatch(/^\d{2}\/\d{2}\/2026, \d{2}:\d{2}$/);
  });

  it('liquidação ausente continua ausente, nunca zero', () => {
    expect(tradeDoServidor({ ...doServidor, liquidationPrice: null }).liquidationPrice).toBeNull();
  });
});

describe('separarPorStatus', () => {
  it('Finalizada vai para o histórico; o resto fica ativo', () => {
    const lista = [
      tradeDoServidor({ ...doServidor, id: 1, status: 'Pendente' }),
      tradeDoServidor({ ...doServidor, id: 2, status: 'Executada' }),
      tradeDoServidor({ ...doServidor, id: 3, status: 'Finalizada' }),
    ];
    const { ativas, encerradas } = separarPorStatus(lista);
    expect(ativas.map((x) => x.id)).toEqual(['1', '2']);
    expect(encerradas.map((x) => x.id)).toEqual(['3']);
  });
});

describe('ligação', () => {
  const ler = (p: string) => readFileSync(resolve(__dirname, p), 'utf-8');
  const genesis = ler('../pages/GenesisPage.tsx');
  const analysis = ler('../components/AnalysisResult.tsx');
  const ativas = ler('../pages/ActiveTradesPage.tsx');
  const historico = ler('../pages/HistoryPage.tsx');
  const api = ler('../services/api.ts');

  it('api.ts tem as quatro chamadas da posição', () => {
    expect(api).toContain('/v1/analises/${analiseId}/confirmar-posicao');
    expect(api).toContain('export async function listarPosicoes(');
    expect(api).toContain('export async function atualizarStatusPosicao(');
    expect(api).toContain('export async function removerPosicao(');
  });

  it('confirmar grava no servidor antes de mostrar a posição', () => {
    const corpo = genesis.slice(genesis.indexOf('const handleSaveTrade'), genesis.indexOf("navigate('/dashboard/performance')"));
    expect(corpo).toContain('await confirmarPosicao(');
    expect(corpo.indexOf('await confirmarPosicao(')).toBeLessThan(corpo.indexOf('setActiveTrades('));
    expect(corpo).toContain('tradeDoServidor(');
  });

  it('AnalysisResult informa o plano e trava o botão enquanto grava', () => {
    expect(analysis).toContain("onSaveTrade(planoEfetivo, zonaEfetiva === 'B' ? 'B' : 'A')");
    expect(analysis).toContain('salvandoPosicao');
  });

  it('as duas telas carregam do servidor e as ações persistem', () => {
    for (const pagina of [ativas, historico]) {
      expect(pagina).toContain('useCarregarPosicoes()');
    }
    expect(ativas).toContain("atualizarStatusPosicao(tradeId, 'Executada')");
    expect(ativas).toContain("atualizarStatusPosicao(tradeId, 'Finalizada')");
    expect(ativas).toContain('removerPosicao(');
  });
});
