import { describe, it, expect } from 'vitest';
import { publicText } from '../utils/publicVocabulary';

/**
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.13, doc §16): defesa em
 * profundidade contra termos técnicos em inglês escapando pra dentro de narrativa/legenda/
 * descrição de plano. Escrito nesta sessão (2026-08-22), não é transcrição do documento.
 */
describe('publicText()', () => {
  it('remove LONG/SHORT (nunca traduz — o prompt já proíbe, isto é defesa em profundidade)', () => {
    expect(publicText('O ativo está em LONG forte.')).toBe('O ativo está em forte.');
    expect(publicText('Estrutura favorável a SHORT.')).toBe('Estrutura favorável a.');
  });

  it('normaliza OPEN INTEREST para title case', () => {
    expect(publicText('OPEN INTEREST em expansão.')).toBe('Open Interest em expansão.');
  });

  it('normaliza SQUEEZE para minúsculo', () => {
    expect(publicText('Risco de SQUEEZE elevado.')).toBe('Risco de squeeze elevado.');
  });

  it('normaliza CHOCH para a grafia canônica CHoCH', () => {
    expect(publicText('Ocorreu um CHOCH na estrutura.')).toBe('Ocorreu um CHoCH na estrutura.');
  });

  it('normaliza MARKUP/MARKDOWN para título', () => {
    expect(publicText('Fase de MARKUP identificada.')).toBe('Fase de Markup identificada.');
    expect(publicText('Fase de MARKDOWN identificada.')).toBe('Fase de Markdown identificada.');
  });

  it('normaliza WYCKOFF para nome próprio', () => {
    expect(publicText('Estrutura de WYCKOFF observada.')).toBe('Estrutura de Wyckoff observada.');
  });

  it('expande 1W/1M por extenso (ambiguidade 1M mês vs 1m minuto)', () => {
    expect(publicText('Tempos maiores em 1W confirmam.')).toBe('Tempos maiores em semanal (1W) confirmam.');
    expect(publicText('No timeframe 1M o viés é de alta.')).toBe('No timeframe mensal (1M) o viés é de alta.');
  });

  it('nunca troca substring dentro de outra palavra (fronteira de palavra)', () => {
    expect(publicText('SHORTAGE de liquidez no livro.')).toBe('SHORTAGE de liquidez no livro.');
    expect(publicText('O termo LONGEVIDADE não muda.')).toBe('O termo LONGEVIDADE não muda.');
  });

  it('idempotente — aplicar de novo sobre texto já processado não muda nada', () => {
    const original = 'OPEN INTEREST em expansão, WYCKOFF confirma fase de MARKUP.';
    const primeira = publicText(original);
    expect(publicText(primeira)).toBe(primeira);
  });

  // V6.9 pacote final (Fase 13, item 13.5, achado real): 1W/1M especificamente, porque a expansão
  // por extenso reintroduz o próprio token dentro dos parênteses — o teste acima não cobria isso.
  it('idempotente também para 1W/1M — a expansão não reintroduz o próprio token', () => {
    const primeira = publicText('Tempos maiores em 1W e 1M confirmam.');
    expect(publicText(primeira)).toBe(primeira);
    expect(primeira).toBe('Tempos maiores em semanal (1W) e mensal (1M) confirmam.');
  });

  it('null/undefined/string vazia degradam sem lançar', () => {
    expect(publicText(null)).toBe('');
    expect(publicText(undefined)).toBe('');
    expect(publicText('')).toBe('');
  });

  it('texto sem nenhum termo técnico passa intacto', () => {
    const texto = 'O preço testou a resistência e recuou com volume decrescente.';
    expect(publicText(texto)).toBe(texto);
  });
});
