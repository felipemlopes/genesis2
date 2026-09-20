import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const source = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

describe('atualizacao do saldo sem recarregar a pagina', () => {
  it('o cabecalho escuta cobrancas e tambem sincroniza ao voltar para a aba', () => {
    const layout = source('layouts/AppLayout.tsx');

    expect(layout).toContain("window.addEventListener('refreshCredits', handleRefreshCredits)");
    expect(layout).toContain("window.addEventListener('focus', handleRefreshCredits)");
    expect(layout).toContain("document.addEventListener('visibilitychange', handleVisibilityChange)");
    expect(layout).toContain('const balance = await fetchCredits()');
    expect(source('services/api.ts')).toContain("cache: 'no-store'");
  });

  it.each([
    'pages/GenesisPage.tsx',
    'components/AlertCard.tsx',
    'components/MicroRadarPanel.tsx',
  ])('%s solicita a sincronizacao depois de uma acao que cobra creditos', (path) => {
    expect(source(path)).toContain("window.dispatchEvent(new Event('refreshCredits'))");
  });
});
