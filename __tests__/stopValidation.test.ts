import { describe, it, expect } from 'vitest';
import { hasValidNumber, isStopSideValid, isStopPositionValid } from '../utils/stopValidation';

/**
 * Genesis Brain V2 (Fase 4.1, item 12.4, Requisito 12.5, Fonte §35): `Number(null) === 0` é um
 * valor finito — qualquer checagem que dependa disso trata ausência como zero legítimo. Estes
 * testes provam que `hasValidNumber()` nunca cai nessa armadilha, e que a validação de lado (Fonte
 * §36.6) rejeita corretamente as posições matematicamente inválidas do slider de stop.
 */
describe('stopValidation', () => {
  describe('hasValidNumber()', () => {
    it('rejeita null e undefined explicitamente', () => {
      expect(hasValidNumber(null)).toBe(false);
      expect(hasValidNumber(undefined)).toBe(false);
    });

    it('rejeita NaN e Infinity', () => {
      expect(hasValidNumber(NaN)).toBe(false);
      expect(hasValidNumber(Infinity)).toBe(false);
      expect(hasValidNumber(-Infinity)).toBe(false);
    });

    it('rejeita string mesmo quando numericamente parseável (nunca coage)', () => {
      expect(hasValidNumber('65000')).toBe(false);
    });

    it('aceita zero real como número válido (zero legítimo não é ausência)', () => {
      expect(hasValidNumber(0)).toBe(true);
    });

    it('aceita um número real qualquer', () => {
      expect(hasValidNumber(65000.5)).toBe(true);
      expect(hasValidNumber(-1)).toBe(true);
    });
  });

  describe('isStopSideValid()', () => {
    it('LONG exige stop abaixo da entrada', () => {
      expect(isStopSideValid(64000, 65000, 'LONG')).toBe(true);
      expect(isStopSideValid(66000, 65000, 'LONG')).toBe(false);
      expect(isStopSideValid(65000, 65000, 'LONG')).toBe(false);
    });

    it('SHORT exige stop acima da entrada', () => {
      expect(isStopSideValid(66000, 65000, 'SHORT')).toBe(true);
      expect(isStopSideValid(64000, 65000, 'SHORT')).toBe(false);
      expect(isStopSideValid(65000, 65000, 'SHORT')).toBe(false);
    });
  });

  describe('isStopPositionValid()', () => {
    it('LONG: exige liquidation < stop < entry', () => {
      expect(isStopPositionValid(64000, 65000, 'LONG', 60000)).toBe(true);
      expect(isStopPositionValid(59000, 65000, 'LONG', 60000)).toBe(false);
      expect(isStopPositionValid(66000, 65000, 'LONG', 60000)).toBe(false);
    });

    it('SHORT: exige entry < stop < liquidation', () => {
      expect(isStopPositionValid(66000, 65000, 'SHORT', 70000)).toBe(true);
      expect(isStopPositionValid(71000, 65000, 'SHORT', 70000)).toBe(false);
      expect(isStopPositionValid(64000, 65000, 'SHORT', 70000)).toBe(false);
    });

    it('liquidação UNAVAILABLE (null): ainda valida o lado, nunca finge zona de liquidação', () => {
      expect(isStopPositionValid(64000, 65000, 'LONG', null)).toBe(true);
      expect(isStopPositionValid(66000, 65000, 'LONG', null)).toBe(false);
      expect(isStopPositionValid(64000, 65000, 'LONG', undefined)).toBe(true);
    });
  });
});
