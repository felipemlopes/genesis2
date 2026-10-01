import { describe, it, expect } from 'vitest';
import { classifyStopRiskZone, liqGapPctOfEntryToLiquidation, STOP_SLIDER_THRESHOLDS, limiaresDoServidor } from '../utils/stopRiskZone';

/**
 * Genesis Brain V2 (Fase 4.2, item 13.2, Requisito 12.7, Fonte §36.1-§36.5): régua bidirecional —
 * VERMELHO -> AMARELO -> VERDE -> AMARELO -> VERMELHO. O primeiro vermelho é ruído (ATR curto
 * demais); o segundo é risco financeiro/aproximação da liquidação (% real, nunca estimado).
 */
describe('stopRiskZone', () => {
  describe('liqGapPctOfEntryToLiquidation()', () => {
    it('100% quando o stop está exatamente na entrada (folga máxima)', () => {
      expect(liqGapPctOfEntryToLiquidation(65000, 65000, 60000)).toBe(100);
    });

    it('0% quando o stop está exatamente na liquidação (folga nenhuma)', () => {
      expect(liqGapPctOfEntryToLiquidation(60000, 65000, 60000)).toBe(0);
    });

    it('50% no meio do caminho entre entrada e liquidação', () => {
      expect(liqGapPctOfEntryToLiquidation(62500, 65000, 60000)).toBe(50);
    });

    it('null quando liquidação é UNAVAILABLE (null ou undefined)', () => {
      expect(liqGapPctOfEntryToLiquidation(64000, 65000, null)).toBeNull();
      expect(liqGapPctOfEntryToLiquidation(64000, 65000, undefined)).toBeNull();
    });

    it('null quando entrada e liquidação coincidem (distância total zero, indefinido)', () => {
      expect(liqGapPctOfEntryToLiquidation(65000, 65000, 65000)).toBeNull();
    });
  });

  describe('classifyStopRiskZone()', () => {
    it('TOO_CLOSE_NOISE abaixo do limiar vermelho de ruído', () => {
      expect(classifyStopRiskZone(0.3, null)).toBe('TOO_CLOSE_NOISE');
      expect(classifyStopRiskZone(STOP_SLIDER_THRESHOLDS.noiseRedBelowAtr - 0.01, 80)).toBe('TOO_CLOSE_NOISE');
    });

    it('CAUTION_CLOSE entre os dois limiares de ruído', () => {
      expect(classifyStopRiskZone(0.65, null)).toBe('CAUTION_CLOSE');
    });

    it('TECHNICAL_ZONE acima do ruído e longe o bastante da liquidação (ou liquidação indisponível)', () => {
      expect(classifyStopRiskZone(1.5, null)).toBe('TECHNICAL_ZONE');
      expect(classifyStopRiskZone(1.5, 50)).toBe('TECHNICAL_ZONE');
    });

    it('CAUTION_WIDE quando a folga até a liquidação já está reduzida', () => {
      expect(classifyStopRiskZone(3.0, 25)).toBe('CAUTION_WIDE');
    });

    it('TOO_WIDE_LIQUIDATION_RISK quando a folga até a liquidação está crítica', () => {
      expect(classifyStopRiskZone(4.0, 10)).toBe('TOO_WIDE_LIQUIDATION_RISK');
    });

    it('ruído sempre vence risco de liquidação quando os dois disparariam ao mesmo tempo (lado curto é checado primeiro)', () => {
      // Distância curta (ruído) mas, hipoteticamente, uma liq_gap_pct também baixa — não deveria
      // acontecer na prática (stop perto da entrada normalmente está longe da liquidação), mas a
      // ordem de checagem precisa ser determinística mesmo assim.
      expect(classifyStopRiskZone(0.2, 5)).toBe('TOO_CLOSE_NOISE');
    });

    // V6.12 (§9): mesma régua em ATR do backend — sem liquidação, só a distância decide.
    it('sem liquidação, a régua em ATR ainda julga o stop largo', () => {
      expect(classifyStopRiskZone(10.0, null)).toBe('TOO_WIDE_LIQUIDATION_RISK');
      expect(classifyStopRiskZone(2.5, null)).toBe('TECHNICAL_ZONE');
    });

    it('régua única: 3,58 ATR é CAUTION_WIDE, 5 ATR é TOO_WIDE, 2 ATR é zona técnica', () => {
      expect(classifyStopRiskZone(3.58, null)).toBe('CAUTION_WIDE');
      expect(classifyStopRiskZone(3.58, 60)).toBe('CAUTION_WIDE');
      expect(classifyStopRiskZone(5.0, 60)).toBe('TOO_WIDE_LIQUIDATION_RISK');
      expect(classifyStopRiskZone(2.0, 60)).toBe('TECHNICAL_ZONE');
      expect(classifyStopRiskZone(2.0, 10)).toBe('TOO_WIDE_LIQUIDATION_RISK');
    });

    it('usa os limiares do servidor quando vierem no payload', () => {
      const doServidor = limiaresDoServidor({
        noise_red_below_atr: 0.5, noise_yellow_below_atr: 0.8, liq_danger_below_pct: 15, liq_caution_below_pct: 30,
        wide_caution_above_atr: 2.0, wide_red_above_atr: 3.0,
      });
      expect(classifyStopRiskZone(2.5, null, doServidor)).toBe('CAUTION_WIDE');
      expect(classifyStopRiskZone(3.5, null, doServidor)).toBe('TOO_WIDE_LIQUIDATION_RISK');
    });

    it('payload sem limiares (análise antiga) cai nos padrões', () => {
      expect(limiaresDoServidor(null)).toEqual(STOP_SLIDER_THRESHOLDS);
      expect(limiaresDoServidor({ noise_red_below_atr: 'x' })).toEqual(STOP_SLIDER_THRESHOLDS);
    });

    it('respeita limiares customizados quando informados', () => {
      const thresholds = { ...STOP_SLIDER_THRESHOLDS, noiseRedBelowAtr: 1.0, noiseYellowBelowAtr: 2.0, liqDangerBelowPct: 40, liqCautionBelowPct: 60 };
      expect(classifyStopRiskZone(0.5, null, thresholds)).toBe('TOO_CLOSE_NOISE');
      expect(classifyStopRiskZone(1.5, null, thresholds)).toBe('CAUTION_CLOSE');
      expect(classifyStopRiskZone(2.5, 50, thresholds)).toBe('CAUTION_WIDE');
    });
  });
});
