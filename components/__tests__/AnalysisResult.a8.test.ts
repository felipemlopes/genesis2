/**
 * A8 (V6.9, spec genesis-v6-9-correcao-completa, Fase 7): código interno (reason_code) sai da
 * tela. Sem `@testing-library/react` — mesmo padrão de asserção sobre texto-fonte.
 *
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 11, item 11.9, doc §16) e spec
 * genesis-v6-10-implementacao (Fase 9, item 9.3, doc §9.3): histórico de duas gerações da
 * manchete (nomear um alvo posterior que atende o mínimo; depois, descrever o R:R combinado como
 * fallback) — ambas superadas.
 *
 * Hotfix V6.11 final (spec genesis-v6-11-hotfix-final, Fase 3/4, itens P0.10/P0.11, 10/09/2026):
 * as duas gerações de manchete "mais favorável" (nomear alvo posterior, descrever R:R combinado)
 * foram REMOVIDAS por decisão de produto — nenhum TP posterior "conserta" o TP1, e o R:R combinado
 * não existe mais. A manchete volta a ser genérica de propósito (o motivo real, exibido logo
 * abaixo, é quem explica o porquê) — cobertura detalhada de P0.10/P0.11/P0.12/P0.13 vive em
 * AnalysisResult.fase9.test.ts; este arquivo mantém só o critério A8 original que continua válido.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const fonte = readFileSync(
  resolve(__dirname, '../AnalysisResult.tsx'),
  'utf-8',
);

describe('AnalysisResult — manchete coerente do plano (A8)', () => {
  it('não renderiza mais execution.reason_code', () => {
    expect(fonte).not.toContain('{execution.reason_code}');
  });

  it('manchetePlano() é genérica — não nomeia alvo posterior nem cita R:R combinado', () => {
    const fonteAposDef = fonte.slice(fonte.indexOf('const manchetePlano'));
    expect(fonteAposDef.slice(0, 300)).not.toContain('Plano atende o');
    expect(fonteAposDef.slice(0, 300)).not.toContain('risco-retorno combinado');
    expect(fonte).toContain('{manchetePlano()}');
  });
});
