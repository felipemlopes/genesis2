import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Bug Condition Exploration Tests — Lote de Bugs Reportados pelo Cliente
 * Feature: client-reported-bugs-batch, Property 1: Bug Condition
 *
 * CRITICAL: Estes testes codificam o COMPORTAMENTO ESPERADO (correto).
 * No código UNFIXED, eles DEVEM FALHAR — a falha confirma que os bugs existem.
 * Após o fix, eles devem PASSAR — confirmando que os bugs foram corrigidos.
 *
 * NÃO tente corrigir o teste ou o código quando ele falhar.
 */

// ─── Bug 1 & 6: Abas obsoletas no sidebar ───────────────────────────────────

describe('Bug 1 & 6: MENU_SECTIONS não deve conter itens removidos', () => {
  it('MENU_SECTIONS NÃO deve conter item com id "history"', async () => {
    // Importar o módulo do sidebar para inspecionar MENU_SECTIONS
    // Usamos leitura direta do arquivo fonte para verificar a presença dos itens
    const fs = await import('fs');
    const path = await import('path');
    const sidebarPath = path.resolve(__dirname, '../components/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    // O item "history" NÃO deveria estar no MENU_SECTIONS
    const hasHistoryItem = /\{\s*id:\s*['"]history['"]/.test(content);
    expect(hasHistoryItem).toBe(false);
  });

  it('MENU_SECTIONS NÃO deve conter item com id "active_trades"', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const sidebarPath = path.resolve(__dirname, '../components/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    // O item "active_trades" NÃO deveria estar no MENU_SECTIONS
    const hasActiveTradesItem = /\{\s*id:\s*['"]active_trades['"]/.test(content);
    expect(hasActiveTradesItem).toBe(false);
  });

  it('ROUTE_MAP NÃO deve conter entradas para "history" e "active_trades"', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const sidebarPath = path.resolve(__dirname, '../components/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    const hasHistoryRoute = /active_trades:\s*['"]/.test(content);
    const hasActiveTradesRoute = /history:\s*['"]/.test(content);
    expect(hasHistoryRoute).toBe(false);
    expect(hasActiveTradesRoute).toBe(false);
  });
});

// ─── Bug 8: NavLink ativo incorreto ──────────────────────────────────────────

describe('Bug 8: NavLink de Genesis deve usar prop "end" para match exato', () => {
  it('NavLink to="/dashboard" deve ter prop "end" para não ativar em sub-rotas', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const sidebarPath = path.resolve(__dirname, '../components/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    // O NavLink que renderiza todas as rotas do ROUTE_MAP (incluindo genesis → '/dashboard')
    // precisa de tratamento especial para a index route /dashboard:
    // Sem `end` prop, /dashboard fica ativo em TODAS as sub-rotas como /dashboard/performance
    //
    // Soluções aceitas:
    // 1. Prop `end` no NavLink (global ou condicional para item.id === 'genesis')
    // 2. Lógica customizada com useLocation para match exato
    //
    // Verificar se existe a prop `end` aplicada ao NavLink OU lógica de match condicional

    // Verifica se `end` é usado como prop no componente NavLink (não apenas a substring "end" em qualquer contexto)
    const hasEndPropOnNavLink = /\bend\b(?=[\s\n]*[}\/>])|\bend={/.test(content);
    
    // Alternativa: lógica customizada para genesis match exato
    const hasCustomExactMatch = /item\.id\s*===\s*['"]genesis['"][\s\S]*?end|genesis[\s\S]*?exact/i.test(content);
    
    expect(hasEndPropOnNavLink || hasCustomExactMatch).toBe(true);
  });
});

// ─── Bug 2: tfMap não normaliza formatos lowercase ───────────────────────────

describe('Bug 2: tfMap deve normalizar formatos lowercase e variantes', () => {
  it('tfMap deve cobrir formatos lowercase como "1d", "4h", "1h", "15m"', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const genesisPagePath = path.resolve(__dirname, '../pages/GenesisPage.tsx');
    const content = fs.readFileSync(genesisPagePath, 'utf-8');

    // Extrair o bloco do tfMap
    const tfMapMatch = content.match(/const tfMap[\s\S]*?\{([\s\S]*?)\};/);
    expect(tfMapMatch).not.toBeNull();
    const tfMapContent = tfMapMatch![1];

    // Formatos lowercase que DEVEM estar no map para normalização direta
    // (sem depender apenas de .toUpperCase())
    const lowercaseFormats = ['1d', '4h', '1h', '15m', '1w'];
    
    // Verificar se o tfMap possui variantes verbosas em português
    const hasVerboseFormats = /['"]diario['"]|['"]semanal['"]|['"]daily['"]|['"]weekly['"]|['"]DIARIO['"]|['"]SEMANAL['"]|['"]DAILY['"]|['"]WEEKLY['"]/i.test(tfMapContent);
    
    // O tfMap atual usa .toUpperCase() antes do lookup, então "1d" → "1D" → match
    // MAS o problema é que a API pode retornar formatos verbosos como "Daily" ou "Diário"
    // que .toUpperCase() converte para "DAILY" mas tfMap não tem essa key
    
    // Verificar que há cobertura adequada de variantes
    expect(hasVerboseFormats).toBe(true);
  });

  it('property: qualquer formato de timeframe válido deve normalizar para valor do contexto', () => {
    // Formatos que a Gemini Vision pode retornar
    const possibleFormats = [
      '1d', '1D', 'D', 'daily', 'DAILY', 'Daily', 'diario', 'DIARIO', 'Diário',
      '4h', '4H', 'H4', '4hr',
      '1h', '1H', 'H1', '60m', '60M',
      '15m', '15M', 'M15',
      '1w', '1W', 'W', 'weekly', 'WEEKLY', 'semanal', 'SEMANAL',
      '1M', 'monthly', 'MONTHLY',
    ];

    const validOutputs = ['15m', '1h', '2h', '3h', '4h', '12h', '1d', '1w', '1M'];

    // Simular o tfMap atual (extraído do código)
    const tfMap: Record<string, string> = {
      '1M': '1M', 'MONTHLY': '1M', 'M': '1M', 'MONTH': '1M',
      '1W': '1w', 'WEEKLY': '1w', 'W': '1w', 'WEEK': '1w',
      '1D': '1d', 'DAILY': '1d', 'D': '1d', 'DAY': '1d',
      '12H': '12h', 'H12': '12h',
      '4H': '4h', 'H4': '4h',
      '3H': '3h', 'H3': '3h',
      '2H': '2h', 'H2': '2h', '120M': '2h',
      '1H': '1h', 'H1': '1h', '60M': '1h',
      '15M': '15m', 'M15': '15m',
    };

    // Testar que TODOS os formatos possíveis normalizam para um valor válido
    const failures: string[] = [];
    for (const fmt of possibleFormats) {
      const normalized = tfMap[fmt.toUpperCase()] || fmt;
      if (!validOutputs.includes(normalized)) {
        failures.push(`"${fmt}" → "${normalized}" (não está em validOutputs)`);
      }
    }

    // Esperamos ZERO falhas — todos os formatos devem normalizar corretamente
    expect(failures).toEqual([]);
  });
});

// ─── Bug 5: Resultado de análise perde-se na desmontagem ─────────────────────

describe('Bug 5: Resultado de análise deve persistir no AppContext (não useState local)', () => {
  it('GenesisPage NÃO deve usar useState local para armazenar result/TradeSetup', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const genesisPagePath = path.resolve(__dirname, '../pages/GenesisPage.tsx');
    const content = fs.readFileSync(genesisPagePath, 'utf-8');

    // Se `result` é armazenado via useState local, perde-se ao desmontar
    // O comportamento correto é usar AppContext
    const hasLocalResultState = /const \[result,\s*setResult\]\s*=\s*useState/.test(content);
    
    // ESPERADO: NÃO deve ter useState local para result
    // (deve usar AppContext: useAppContext().analysisResult)
    expect(hasLocalResultState).toBe(false);
  });

  it('AppContext deve expor analysisResult e setAnalysisResult', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const contextPath = path.resolve(__dirname, '../contexts/AppContext.tsx');
    const content = fs.readFileSync(contextPath, 'utf-8');

    const hasAnalysisResult = /analysisResult/.test(content);
    const hasSetAnalysisResult = /setAnalysisResult/.test(content);

    expect(hasAnalysisResult).toBe(true);
    expect(hasSetAnalysisResult).toBe(true);
  });
});

// ─── Bug 7: Progress rings travados em 0% ───────────────────────────────────

describe('Bug 7: Progress rings devem refletir progresso real no primeiro render', () => {
  it('checkPrices deve ser chamado imediatamente no mount (sem delay)', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dashboardPath = path.resolve(__dirname, '../components/AnalysisHistoryDashboard.tsx');
    const content = fs.readFileSync(dashboardPath, 'utf-8');

    // O useEffect que faz checkPrices deve executar imediatamente
    // e não apenas após um intervalo de 15s
    // Verificar se checkPrices() é chamado fora do setInterval
    // (antes ou independente do intervalo)
    const hasImmediateCall = /checkPrices\(\)[\s\S]*?setInterval|useEffect[\s\S]*?checkPrices\(\)/m.test(content);

    expect(hasImmediateCall).toBe(true);
  });

  it('deve exibir loading state enquanto progressMap está vazio', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const dashboardPath = path.resolve(__dirname, '../components/AnalysisHistoryDashboard.tsx');
    const content = fs.readFileSync(dashboardPath, 'utf-8');

    // Deve haver um loading/skeleton state para rings quando progressMap[id] é undefined
    const hasLoadingState = /loading|skeleton|spinner|carregando/i.test(content) && 
                           /progressMap/.test(content);
    
    // Alternativa: verificar se há conditional render para progressMap vazio
    const hasConditionalRender = /progressMap\[.*\]\s*\?\s*\?|progressMap\[.*\]\s*\|\|\s*0/.test(content);
    
    // O bug é: rings mostram 0% porque progressMap é {} no primeiro render
    // O fix deve mostrar loading ou executar checkPrices imediatamente
    // Para não mostrar 0% falso, deve haver um loading state
    const hasSkeletonForRings = /skeleton|animate-pulse|loading/i.test(content);
    
    expect(hasSkeletonForRings).toBe(true);
  });

  it('property: calcProgress não deve retornar 0 quando entry_price > 0, target > 0 e preço moveu', () => {
    // Simular o calcProgress conforme implementado
    const calcProgress = (direction: string, entryPrice: number, currentPrice: number, targetPrice: number): number => {
      if (targetPrice === entryPrice || targetPrice <= 0 || entryPrice <= 0) return 0;
      const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
      if (direction === 'LONG') {
        return clamp(((currentPrice - entryPrice) / (targetPrice - entryPrice)) * 100, 0, 100);
      }
      return clamp(((entryPrice - currentPrice) / (entryPrice - targetPrice)) * 100, 0, 100);
    };

    fc.assert(
      fc.property(
        fc.constantFrom('LONG', 'SHORT'),
        fc.double({ min: 1000, max: 100000, noNaN: true }),
        fc.double({ min: 0.01, max: 0.3, noNaN: true }), // movement ratio (max 30% to ensure target > 0)
        (direction, entryPrice, movementRatio) => {
          const targetPrice = direction === 'LONG'
            ? entryPrice * (1 + movementRatio * 2)
            : entryPrice * (1 - movementRatio); // SHORT target closer to entry to stay > 0
          const currentPrice = direction === 'LONG'
            ? entryPrice * (1 + movementRatio)
            : entryPrice * (1 - movementRatio * 0.5);

          // Precondition: target > 0 and target ≠ entry
          if (targetPrice <= 0 || targetPrice === entryPrice) return;

          const progress = calcProgress(direction, entryPrice, currentPrice, targetPrice);
          
          // Se entry > 0 e preço moveu na direção do target, progress > 0
          expect(progress).toBeGreaterThan(0);
          expect(progress).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 200 }
    );
  });
});


// ─── Bug 4: Zonas de entrada não clicáveis ──────────────────────────────────

describe('Bug 4: Zonas de entrada devem ser clicáveis', () => {
  it('AnalysisResult deve ter onClick handler nos divs de Plano A e Plano B', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const analysisResultPath = path.resolve(__dirname, '../components/AnalysisResult.tsx');
    const content = fs.readFileSync(analysisResultPath, 'utf-8');

    // Encontrar a seção de "Zona de Entrada" / "Plano A" / "Plano B"
    // e verificar se os divs correspondentes possuem onClick
    const zonaEntradaSection = content.match(/Zona de Entrada[\s\S]*?Plano A[\s\S]*?Plano B[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
    
    expect(zonaEntradaSection).not.toBeNull();

    // Verificar que existe onClick no container de cada plano
    const sectionContent = zonaEntradaSection![0];
    const hasOnClick = /onClick/.test(sectionContent);
    
    expect(hasOnClick).toBe(true);
  });

  it('AnalysisResult deve ter cursor-pointer nas zonas de entrada', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const analysisResultPath = path.resolve(__dirname, '../components/AnalysisResult.tsx');
    const content = fs.readFileSync(analysisResultPath, 'utf-8');

    // Zonas de entrada devem ter cursor-pointer para indicar clicabilidade
    const zonaEntradaSection = content.match(/Zona de Entrada[\s\S]*?Plano A[\s\S]*?Plano B/);
    expect(zonaEntradaSection).not.toBeNull();
    
    const sectionContent = zonaEntradaSection![0];
    const hasCursorPointer = /cursor-pointer/.test(sectionContent);
    
    expect(hasCursorPointer).toBe(true);
  });
});

// ─── Bug 3: Scanner revela ativo sem consumo de créditos ─────────────────────

describe('Bug 3: Scanner deve ocultar ativo até consumo de créditos', () => {
  it('OpportunityScanner deve ter lógica de ofuscação/reveal de ativos', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const scannerPath = path.resolve(__dirname, '../components/OpportunityScanner.tsx');
    const content = fs.readFileSync(scannerPath, 'utf-8');

    // O scanner deve ter lógica de paywall: ocultar o ativo até pagamento
    const hasPaywall = /revealedAssets|ofusca|blur.*pair|mask.*symbol|\?\?\?/i.test(content);
    const hasConsumeCall = /consume.*scanner|\/consume\/scanner/i.test(content);

    // ESPERADO: deve existir lógica de ofuscação E consumo de créditos
    expect(hasPaywall).toBe(true);
    expect(hasConsumeCall).toBe(true);
  });

  it('OpportunityScanner NÃO deve exibir pair/symbolRaw diretamente sem gate de crédito', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const scannerPath = path.resolve(__dirname, '../components/OpportunityScanner.tsx');
    const content = fs.readFileSync(scannerPath, 'utf-8');

    // No render dos resultados, o par/ativo NÃO deve ser exibido diretamente
    // Deve haver uma condição (revealedAssets.has(opp.id)) antes de mostrar
    const renderSection = content.match(/\{opp\.pair\}/g);
    
    // Se opp.pair é renderizado sem condicional, o ativo é revelado sem crédito
    // Após fix: deve ser condicional (ex: revealedAssets.has(opp.id) ? opp.pair : '???/USDT')
    const hasConditionalReveal = /revealedAssets.*\?.*pair|revealed.*\?.*symbol/i.test(content);
    
    expect(hasConditionalReveal).toBe(true);
  });
});

// ─── Bug 10: CarteiraCripto não renderiza corretamente ───────────────────────

describe('Bug 10: CarteiraCripto deve carregar sem erro de runtime', () => {
  it('CarteiraPage deve envolver CarteiraCripto com ErrorBoundary ou Suspense', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const carteiraPagePath = path.resolve(__dirname, '../pages/CarteiraPage.tsx');
    const content = fs.readFileSync(carteiraPagePath, 'utf-8');

    // O componente deve ter um ErrorBoundary ou Suspense com fallback
    const hasErrorBoundary = /ErrorBoundary|error.*boundary/i.test(content);
    const hasSuspenseWithFallback = /Suspense.*fallback/i.test(content);
    const hasTryCatch = /try\s*\{[\s\S]*?catch/m.test(content);

    expect(hasErrorBoundary || hasSuspenseWithFallback || hasTryCatch).toBe(true);
  });

  it('CarteiraCripto deve ter guards contra null/undefined na carga inicial', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const carteiraCriptoPath = path.resolve(__dirname, '../components/CarteiraCripto.tsx');
    const content = fs.readFileSync(carteiraCriptoPath, 'utf-8');

    // Deve haver tratamento de loading state adequado
    const hasLoadingState = /isLoading|loading|carregando/i.test(content);
    const hasNullGuards = /\?\.|if\s*\(!.*data|if\s*\(!.*response/i.test(content);
    const hasErrorState = /error|erro/i.test(content);

    // Pelo menos loading state E null guards devem existir
    expect(hasLoadingState).toBe(true);
    expect(hasNullGuards || hasErrorState).toBe(true);
  });
});

// ─── Bug 9: Falta endpoint admin para verificação de TPs ────────────────────

describe('Bug 9: Endpoint admin para verificação de TPs deve existir', () => {
  it('API deve ter rota GET /admin/analises/zonas', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const apiRoutesPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\routes\\api.php';
    const content = fs.readFileSync(apiRoutesPath, 'utf-8');

    const hasZonasRoute = /analises\/zonas|analises.*zonas/i.test(content);
    expect(hasZonasRoute).toBe(true);
  });

  it('API deve ter rota GET /admin/analises/tps', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const apiRoutesPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\routes\\api.php';
    const content = fs.readFileSync(apiRoutesPath, 'utf-8');

    const hasTpsRoute = /analises\/tps|analises.*tps/i.test(content);
    expect(hasTpsRoute).toBe(true);
  });
});
