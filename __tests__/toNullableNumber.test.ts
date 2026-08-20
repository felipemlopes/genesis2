import { describe, it, expect } from 'vitest';
import { toNullableNumber } from '../pages/GenesisPage';

/**
 * Item D9 do Gênesis V6.9 — toNullableNumber() (pages/GenesisPage.tsx) trocava a PRIMEIRA vírgula
 * por ponto, cegamente — "63.523,00" (formato BR, ponto=milhar, vírgula=decimal) virava
 * "63.523.00", e parseFloat() para no segundo ponto, devolvendo 63.523 em vez de 63523 (erro de
 * fator mil). Reescrito pra identificar o separador decimal pela POSIÇÃO (o último vírgula/ponto
 * que aparece no texto), nunca a primeira ocorrência cega. Os 7 casos abaixo são os exigidos pelo
 * critério de aceite do item. Escrito nesta sessão (2026-08-20), não é transcrição do documento.
 */
describe('D9 — toNullableNumber() identifica o separador decimal pela posição', () => {
  it.each([
    ['63.523,00', 63523],
    ['63,523.00', 63523],
    ['0,8538', 0.8538],
    ['0.8538', 0.8538],
    ['$ 1.229,87', 1229.87],
    ['69.557,69', 69557.69],
    ['-935,76', -935.76],
  ])('converte "%s" para %f', (entrada, esperado) => {
    expect(toNullableNumber(entrada)).toBeCloseTo(esperado as number, 6);
  });

  it('null/undefined/string vazia devolvem null', () => {
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber(undefined)).toBeNull();
    expect(toNullableNumber('')).toBeNull();
  });

  it('numero ja numerico passa direto', () => {
    expect(toNullableNumber(63523)).toBe(63523);
    expect(toNullableNumber(0.8538)).toBe(0.8538);
  });

  it('numero nao finito (NaN/Infinity) devolve null', () => {
    expect(toNullableNumber(NaN)).toBeNull();
    expect(toNullableNumber(Infinity)).toBeNull();
  });

  it('texto sem nenhum digito devolve null', () => {
    expect(toNullableNumber('$ —')).toBeNull();
  });

  it('inteiro sem separador nenhum passa direto', () => {
    expect(toNullableNumber('63523')).toBe(63523);
  });
});
