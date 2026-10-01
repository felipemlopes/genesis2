/**
 * V6.12 (§7, §15): o slider de stop manda na tela inteira. Prova, sobre a lógica pura de
 * `utils/planoEfetivo.ts`, o contrato do stop do lado do front, e confere no texto-fonte que o
 * `AnalysisResult`/`StopSlider` estão ligados a ela (sem `@testing-library/react` neste projeto,
 * mesmo padrão de `AnalysisResult.g7.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { PlanoSetup } from '../types';
import type { RepriceResponse } from '../services/api';
import {
  aplicarReprice, criarGuardaDeSequencia, repriceConsistente, respostaDoStopAtual, textoEsperaReprice, REPRICE_IDLE,
} from '../utils/planoEfetivo';

// Plano A do APT 1w (print de 28/09): entrada 0,8175, stop 0,4193, TP1 1,1549.
const base = {
  plano: 'A',
  entrada: 0.8175,
  stop: 0.4193,
  stop_recommended: 0.4193,
  stop_effective: 0.4193,
  stop_source: 'AI_RECOMMENDED',
  tp1: 1.1549, tp2: null, tp3: null,
  tp1_fonte: 'resistencia_suporte',
  rr_bruto: 0.85, rr_liquido_estimado: 0.84, rr_bruto_exibir: '1:0.85', rr_liquido_exibir: '1:0.84',
  rr_por_alvo: {
    tp1: { alvo: 1.1549, fonte: 'resistencia_suporte', rr_bruto: 0.85, rr_liquido: 0.84, rr_bruto_exibir: '1:0.85', rr_liquido_exibir: '1:0.84', custo_bps: 10, valido: true, motivo_ausencia: null },
    tp2: { alvo: null, fonte: null, rr_bruto: null, rr_liquido: null, rr_bruto_exibir: null, rr_liquido_exibir: null, custo_bps: null, valido: false, motivo_ausencia: 'SEM_ALVO' },
    tp3: { alvo: null, fonte: null, rr_bruto: null, rr_liquido: null, rr_bruto_exibir: null, rr_liquido_exibir: null, custo_bps: null, valido: false, motivo_ausencia: 'SEM_ALVO' },
  },
  risco_preco_pct: 48.71,
  risco_usd_estimado: 10,
  risco_pct_capital_base: 1,
  risco_pct_margem: 243.6,
  quantidade_base_estimada: 25.1,
  nocional_estimado: 20.53,
  margem_comprometida_usd: 4.1,
  margem_comprometida_pct_capital: 0.41,
  liquidacao: 0.6581,
  verificacao: 'INSEGURO',
  liquidacao_classificacao: 'LIQ_ANTES_DO_STOP',
} as unknown as PlanoSetup;

const resposta = (stop: number, extra: Partial<RepriceResponse> = {}): RepriceResponse => ({
  analysis_uuid: 'uuid-apt',
  plan: 'A',
  stop_recommended: 0.4193,
  stop_effective: stop,
  stop_source: 'USER_ADJUSTED',
  stop_risk: { zone: 'TECHNICAL_ZONE', distance_atr: 1.2, distance_to_liquidation_pct: 30 },
  rr: { tp1: 4.1, tp2: null, tp3: null },
  rr_bruto: { tp1: 4.2, tp2: null, tp3: null },
  risk: { distance_pct: 10.03, risk_usd: 10, pct_capital_base: 1, pct_margem: 49.8, stop_alem_da_liquidacao: false },
  position: { quantity: 122.3, notional: 99.7, margin: 19.94, margin_pct_capital: 1.99 },
  liquidation: { price: 0.6581, status: 'ESTIMATED', verification: 'SEGURO', classification: null },
  ...extra,
});

describe('aplicarReprice — contrato do stop (§15)', () => {
  const efetivo = aplicarReprice(base, resposta(0.7355))!;

  it('mover o stop não muda a entrada', () => {
    expect(efetivo.entrada).toBe(base.entrada);
  });

  it('mover o stop não muda os preços de TP1/TP2/TP3', () => {
    expect([efetivo.tp1, efetivo.tp2, efetivo.tp3]).toEqual([base.tp1, base.tp2, base.tp3]);
    expect(efetivo.tp1_fonte).toBe(base.tp1_fonte);
  });

  it('mover o stop muda o R:R de TP1 (bruto e líquido, número e texto)', () => {
    expect(efetivo.rr_por_alvo.tp1.rr_liquido).toBe(4.1);
    expect(efetivo.rr_por_alvo.tp1.rr_liquido_exibir).toBe('1:4.10');
    expect(efetivo.rr_por_alvo.tp1.rr_bruto).toBe(4.2);
    expect(efetivo.rr_liquido_exibir).toBe('1:4.10');
    expect(efetivo.rr_por_alvo.tp1.alvo).toBe(1.1549);
  });

  it('mover o stop muda a distância até o stop', () => {
    expect(efetivo.risco_preco_pct).toBe(10.03);
  });

  it('mover o stop muda o risco em USD e em % do capital e da margem', () => {
    expect(efetivo.risco_usd_estimado).toBe(10);
    expect(efetivo.risco_pct_capital_base).toBe(1);
    expect(efetivo.risco_pct_margem).toBe(49.8);
  });

  it('mover o stop muda quantidade e nocional', () => {
    expect(efetivo.quantidade_base_estimada).toBe(122.3);
    expect(efetivo.nocional_estimado).toBe(99.7);
  });

  it('mover o stop muda a margem comprometida', () => {
    expect(efetivo.margem_comprometida_usd).toBe(19.94);
    expect(efetivo.margem_comprometida_pct_capital).toBe(1.99);
  });

  it('mover o stop muda a liquidação quando o nocional muda', () => {
    const outra = aplicarReprice(base, resposta(0.7355, { liquidation: { price: 0.66, status: 'AVAILABLE', verification: 'SEGURO', classification: null } }))!;
    expect(outra.liquidacao).toBe(0.66);
  });

  it('"liquida antes do stop" acende e apaga com o stop', () => {
    expect(base.verificacao).toBe('INSEGURO');
    expect(efetivo.verificacao).toBe('SEGURO');
    const deVolta = aplicarReprice(base, resposta(0.4193, {
      liquidation: { price: 0.6581, status: 'ESTIMATED', verification: 'INSEGURO', classification: 'LIQ_ANTES_DO_STOP' },
    }))!;
    expect(deVolta.verificacao).toBe('INSEGURO');
    expect(deVolta.liquidacao_classificacao).toBe('LIQ_ANTES_DO_STOP');
  });

  it('mover o stop muda a zona da régua (e com ela o aviso de stop largo)', () => {
    expect(efetivo.stop_risk_zone).toBe('TECHNICAL_ZONE');
    expect(efetivo.stop_distance_atr).toBe(1.2);
    const largo = aplicarReprice(base, resposta(0.5, { stop_risk: { zone: 'CAUTION_WIDE', distance_atr: 3.58, distance_to_liquidation_pct: null } }))!;
    expect(largo.stop_risk_zone).toBe('CAUTION_WIDE');
  });

  it('o stop exibido e confirmado é o stop_effective do reprice', () => {
    expect(efetivo.stop).toBe(0.7355);
    expect(efetivo.stop_effective).toBe(0.7355);
    expect(efetivo.stop_source).toBe('USER_ADJUSTED');
  });

  it('sem resposta, o plano original fica igual', () => {
    expect(aplicarReprice(base, null)).toBe(base);
    expect(aplicarReprice(null, resposta(0.7))).toBeNull();
  });
});

describe('botão de confirmar espera a matemática', () => {
  it('reprice pendente desabilita e diz "Recalculando..."', () => {
    const pendente = { pending: true, error: null, response: null };
    expect(repriceConsistente(pendente)).toBe(false);
    expect(textoEsperaReprice(pendente)).toBe('Recalculando...');
  });

  it('reprice com erro desabilita e diz "Reprecificação indisponível"', () => {
    const erro = { pending: false, error: 'falhou', response: null };
    expect(repriceConsistente(erro)).toBe(false);
    expect(textoEsperaReprice(erro)).toBe('Reprecificação indisponível');
  });

  it('parado (sem mexer) ou confirmado libera', () => {
    expect(repriceConsistente(REPRICE_IDLE)).toBe(true);
    expect(repriceConsistente({ pending: false, error: null, response: resposta(0.7355) })).toBe(true);
    expect(textoEsperaReprice(REPRICE_IDLE)).toBeNull();
  });
});

describe('resposta fora de ordem é descartada', () => {
  it('só a requisição mais recente vale', () => {
    const guarda = criarGuardaDeSequencia();
    const primeira = guarda.proxima();
    const segunda = guarda.proxima();
    expect(guarda.ehAtual(primeira)).toBe(false);
    expect(guarda.ehAtual(segunda)).toBe(true);
  });

  it('resposta de outro stop não conta', () => {
    expect(respostaDoStopAtual(resposta(0.7355), 0.7355, 0.8175)).toBe(true);
    expect(respostaDoStopAtual(resposta(0.7), 0.7355, 0.8175)).toBe(false);
  });
});

describe('ligação no componente', () => {
  const analysis = readFileSync(resolve(__dirname, '../components/AnalysisResult.tsx'), 'utf-8');
  const slider = readFileSync(resolve(__dirname, '../components/StopSlider.tsx'), 'utf-8');

  it('StopSlider avisa o pai e descarta resposta velha', () => {
    expect(slider).toContain('onRepriceState?:');
    expect(slider).toContain('guardaRef.current.ehAtual(seq)');
    expect(slider).toContain('respostaDoStopAtual(');
  });

  it('AnalysisResult guarda o reprice por plano, zera ao trocar de análise e usa planoEfetivo', () => {
    expect(analysis).toContain('const [repriceA, setRepriceA] = useState<RepriceState>(REPRICE_IDLE)');
    expect(analysis).toContain('const [repriceB, setRepriceB] = useState<RepriceState>(REPRICE_IDLE)');
    expect(analysis).toContain('aplicarReprice(planoAtivo, repriceAtivo.response)');
    expect(analysis).toContain('onRepriceState={setRepriceAtivo}');
    expect(analysis).toMatch(/useEffect\(\(\) => \{ setRepriceA\(REPRICE_IDLE\); setRepriceB\(REPRICE_IDLE\); \}, \[analiseIdentidade\]\)/);
  });

  it('o botão confirma o plano efetivo e só com a matemática consistente', () => {
    expect(analysis).toContain("onSaveTrade(planoEfetivo, zonaEfetiva === 'B' ? 'B' : 'A')");
    expect(analysis).not.toContain('onSaveTrade(planoAtivo)');
    expect(analysis).toContain('&& repriceConsistente(repriceAtivo)');
    expect(analysis).toContain('textoEsperaReprice(repriceAtivo)');
  });

  it('números de risco leem o plano efetivo', () => {
    for (const campo of ['risco_preco_pct', 'liquidacao', 'risco_pct_margem', 'risco_usd_estimado', 'margem_comprometida_usd', 'verificacao']) {
      expect(analysis, campo).toContain(`planoEfetivo?.${campo}`);
      expect(analysis, campo).not.toContain(`planoAtivo?.${campo})`);
    }
    expect(analysis).toContain('const rrPorAlvo = planoEfetivo?.rr_por_alvo ?? null;');
  });

  it('régua única: aviso de stop largo segue a zona do plano efetivo e o slider usa os limiares do servidor', () => {
    expect(analysis).toContain("const stopLargo = zonaStopEfetiva === 'CAUTION_WIDE' || zonaStopEfetiva === 'TOO_WIDE_LIQUIDATION_RISK'");
    expect(analysis).toContain('{stopLargo && (');
    expect(analysis).not.toContain("{stopStatusAtivo === 'VALID_WIDE' && (");
    expect(analysis).toContain('limiares={limiaresRegua}');
    expect(slider).toContain('classifyStopRiskZone(stopDistanceAtrLocal, liqGapPctLocal, limiares)');
    const adaptador = readFileSync(resolve(__dirname, '../services/geminiService.ts'), 'utf-8');
    expect(adaptador).toContain('stop_slider_limiares: exec.stop_slider_limiares ?? null');
  });

  it('planoAtivoCompleto continua com Number.isFinite(Number(...)) (DP-03)', () => {
    expect(analysis).toContain('Number.isFinite(Number(planoAtivo.stop))');
  });
});
