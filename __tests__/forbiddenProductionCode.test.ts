import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * V6.9 pacote final (spec genesis-v6-9-pacote-final, Fase 14, item 14.3, doc §19): scan estático —
 * falha se `api.binance.com/api/v3` (Spot direto) ou `Math.random()` (dado de mercado fabricado)
 * reaparecerem em CÓDIGO (não comentário — vários arquivos legitimamente documentam a remoção
 * citando os dois termos em prosa histórica, ex.: `trendService.ts`/`flowTrackService.ts`,
 * confirmado ao escrever este teste) dentro das ferramentas reparadas nas Fases 12/13.
 *
 * Escopo deliberadamente restrito às ferramentas reparadas — não o repositório inteiro: um scan
 * irrestrito de `Math.random()` acusaria ~10 usos legítimos e sem relação com dado de mercado
 * (embaralhar perguntas de quiz em `LearnFutures.tsx`, cor decorativa de partícula em
 * `Hologram.tsx`, fallback de chave de idempotência/React key, sorteio de citação de loading) —
 * o item 14.3 pede "arquivos do cérebro/ferramentas reparadas", não uma proibição absoluta do
 * padrão de linguagem em todo o app. `V69ForbiddenProductionCodeTest.php` (backend, mesma fase)
 * cobre `projetarAlvos`/`alvo_projetado`/`cluster_liquidacao`, que são conceitos de backend.
 *
 * `spotPriceService.ts`/`BasisSpotPerpetualCard.tsx` ficam FORA da lista de propósito — são
 * exceções deliberadas e documentadas (item 12.12: Spot de carteira/basis, outro domínio; A10:
 * prêmio Spot-vs-Futuros, decisão do Felipe 19/08/2026) — não são "arquivos reparados", são
 * arquivos que sempre tiveram Spot por definição do próprio conceito que medem.
 */

// `components/NewListings.tsx` fica FORA de propósito: tem um `Math.random()` real, mas usado só
// pra embaralhar a ORDEM de exibição de 5 entre os 15 candidatos mais recentes (evitar mostrar
// sempre os mesmos "grandes" ativos) — os dados em si (preço/data/volume) já são 100% reais desde
// a Fase 12 (`newListingService.ts`, que está na lista abaixo e não usa Math.random() nenhum).
// Mesma categoria de uso legítimo que embaralhar perguntas de quiz (LearnFutures.tsx) — rotação de
// apresentação, não fabricação de dado. Confirmado ao escrever este teste.
const ARQUIVOS_FERRAMENTAS_REPARADAS = [
  'services/oiLiquidationService.ts',
  'services/flowTrackService.ts',
  'services/trendService.ts',
  'services/newListingService.ts',
  'services/spoofingService.ts',
  'components/LongShortRatio.tsx',
  'components/OrderBookImbalance.tsx',
  'components/MarketTicker.tsx',
  'components/FlowTrack.tsx',
  'components/OiLiquidationMonitor.tsx',
  'components/TrendAnalyzer.tsx',
  'components/LiquidationHeatmap.tsx',
  'pages/LiquidationPage.tsx',
];

const TERMOS_PROIBIDOS = ['api.binance.com/api/v3', 'Math.random()'];

/** Mesma abordagem de V69ForbiddenProductionCodeTest.php (backend) — remove comentários antes de buscar. */
const codigoSemComentarios = (conteudo: string): string => {
  const linhas = conteudo.split('\n');
  const resultado: string[] = [];
  for (const linha of linhas) {
    const semEspaco = linha.trimStart();
    if (semEspaco.startsWith('*') || semEspaco.startsWith('//')) continue;
    const posComentario = linha.indexOf('//');
    resultado.push(posComentario !== -1 ? linha.slice(0, posComentario) : linha);
  }
  return resultado.join('\n');
};

describe('Fase 14, item 14.3 — código proibido nas ferramentas reparadas (frontend)', () => {
  it('nenhum termo proibido aparece em código (não comentário) nos arquivos reparados', () => {
    const violacoes: string[] = [];

    for (const caminhoRelativo of ARQUIVOS_FERRAMENTAS_REPARADAS) {
      const conteudo = readFileSync(resolve(__dirname, '..', caminhoRelativo), 'utf-8');
      const codigo = codigoSemComentarios(conteudo);
      for (const termo of TERMOS_PROIBIDOS) {
        if (codigo.includes(termo)) {
          violacoes.push(`${caminhoRelativo} usa "${termo}" em código (não comentário)`);
        }
      }
    }

    expect(violacoes).toEqual([]);
  });

  it('confirma que os arquivos-exceção documentados (Spot deliberado) não entram na lista escaneada', () => {
    expect(ARQUIVOS_FERRAMENTAS_REPARADAS).not.toContain('services/spotPriceService.ts');
    expect(ARQUIVOS_FERRAMENTAS_REPARADAS).not.toContain('components/BasisSpotPerpetualCard.tsx');
  });
});
