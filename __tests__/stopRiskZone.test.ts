import { describe, it, expect } from 'vitest';
import { classifyStopRiskZone, liqGapPctOfEntryToLiquidation, STOP_SLIDER_THRESHOLDS } from '../utils/stopRiskZone';

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

    it('liquidação UNAVAILABLE nunca finge zona de risco no lado distante', () => {
      expect(classifyStopRiskZone(10.0, null)).toBe('TECHNICAL_ZONE');
    });

    it('respeita limiares customizados quando informados', () => {
      const thresholds = { noiseRedBelowAtr: 1.0, noiseYellowBelowAtr: 2.0, liqDangerBelowPct: 40, liqCautionBelowPct: 60 };
      expect(classifyStopRiskZone(0.5, null, thresholds)).toBe('TOO_CLOSE_NOISE');
      expect(classifyStopRiskZone(1.5, null, thresholds)).toBe('CAUTION_CLOSE');
      expect(classifyStopRiskZone(2.5, 50, thresholds)).toBe('CAUTION_WIDE');
    });
  });
});
