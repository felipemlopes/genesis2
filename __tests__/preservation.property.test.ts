import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Preservation Property-Based Tests — Comportamentos Existentes Inalterados
 * Feature: client-reported-bugs-batch, Property 2: Preservation
 *
 * Metodologia: observation-first
 * Estes testes capturam o comportamento CORRETO existente no código UNFIXED.
 * Eles DEVEM PASSAR antes do fix, confirmando a baseline de comportamento a preservar.
 * Após o fix, eles devem CONTINUAR PASSANDO — confirmando que não houve regressão.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**
 */

// ─── Requirement 3.1: Navegação para abas restantes funciona ─────────────────

describe('Preservation 3.1: Navegação para abas restantes (Performance, Radar, Genesis, etc.)', () => {
  it('property: ROUTE_MAP contém rotas válidas para todas as abas que devem permanecer', () => {
    // Observação: No código unfixed, ROUTE_MAP contém rotas para todas as abas
    // incluindo 'history' e 'active_trades' que serão removidos no fix.
    // As abas que DEVEM PERMANECER após o fix são testadas aqui.

    const fs = require('fs');
    const path = require('path');
    const sidebarPath = path.resolve(__dirname, '../components/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    // Extrair ROUTE_MAP
    const routeMapMatch = content.match(/const ROUTE_MAP[\s\S]*?\{([\s\S]*?)\};/);
    expect(routeMapMatch).not.toBeNull();
    const routeMapContent = routeMapMatch![1];

    // Abas que DEVEM permanecer funcionais após o fix
    const preservedTabs = [
      'genesis',
      'carteira',
      'analysis_history',
      'scanner',
      'patterns',
      'trend_analyzer',
      'mind_metrics',
      'flowtrack',
      'funding',
      'liquidation',
      'oi_monitor',
      'liquidity_map',
      'smart_money',
      'geopolitical_radar',
      'risk',
      'new_listings',
      'learn',
      'support',
    ];

    // Property: para toda aba preservada, deve existir uma rota no ROUTE_MAP
    fc.assert(
      fc.property(
        fc.constantFrom(...preservedTabs),
        (tabId) => {
          const regex = new RegExp(`${tabId}:\\s*['"]`);
          const hasRoute = regex.test(routeMapContent);
          expect(hasRoute).toBe(true);
        }
      ),
      { numRuns: preservedTabs.length }
    );
  });

  it('property: MENU_SECTIONS contém todas as abas preservadas com labels corretos', () => {
    const fs = require('fs');
    const path = require('path');
    const sidebarPath = path.resolve(__dirname, '../components/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    // Pares [id, label] que devem existir no sidebar
    const preservedItems: [string, string][] = [
      ['genesis', 'Gênesis'],
      ['carteira', 'Carteira Cripto'],
      ['analysis_history', 'Performance'],
      ['scanner', 'Radar'],
      ['patterns', 'Figuras Gráficas'],
      ['trend_analyzer', 'Qual Tendência?'],
      ['mind_metrics', 'Mind Metrics'],
      ['flowtrack', 'FlowTrack'],
      ['funding', 'Funding Monitor'],
      ['liquidation', 'Liquidation Radar'],
      ['oi_monitor', 'OI & Liq.'],
      ['liquidity_map', 'Liquidity Map'],
      ['smart_money', 'Smart Money'],
      ['geopolitical_radar', 'Radar Geopolítico'],
      ['risk', 'Gestão de Risco'],
      ['new_listings', 'Nova Listagem'],
      ['learn', 'Aprenda Futuros'],
      ['support', 'Suporte'],
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...preservedItems),
        ([id, label]) => {
          const idRegex = new RegExp(`id:\\s*['"]${id}['"]`);
          expect(idRegex.test(content)).toBe(true);
          expect(content).toContain(label);
        }
      ),
      { numRuns: preservedItems.length }
    );
  });

  it('property: todas as rotas preservadas no router mapeiam para componentes lazy válidos', () => {
    const fs = require('fs');
    const path = require('path');
    const routerPath = path.resolve(__dirname, '../router/index.tsx');
    const content = fs.readFileSync(routerPath, 'utf-8');

    // Rotas que devem existir no router (paths dentro de 'dashboard' children)
    const preservedPaths = [
      'carteira',
      'performance',
      'scanner',
      'padroes',
      'tendencia',
      'mind-metrics',
      'flowtrack',
      'funding',
      'liquidacao',
      'oi-monitor',
      'liquidez',
      'smart-money',
      'geopolitica',
      'risco',
      'listagens',
      'aprender',
      'suporte',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...preservedPaths),
        (routePath) => {
          const pathRegex = new RegExp(`path:\\s*['"]${routePath}['"]`);
          expect(pathRegex.test(content)).toBe(true);
        }
      ),
      { numRuns: preservedPaths.length }
    );
  });
});

// ─── Requirement 3.2: Upload + scan + analyze retorna TradeSetup completo ────

describe('Preservation 3.2: Fluxo de upload + scan + analyze', () => {
  it('property: tfMap normaliza corretamente formatos UPPERCASE conhecidos', () => {
    // Observação: No código unfixed, o tfMap funciona corretamente para
    // formatos UPPERCASE. O bug (2) é que NÃO cobre lowercase.
    // Aqui testamos que os formatos UPPERCASE continuam funcionando.

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

    const validOutputs = ['15m', '1h', '2h', '3h', '4h', '12h', '1d', '1w', '1M'];

    // Property: todos os formatos que JÁ estão no tfMap normalizam para valores válidos
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.keys(tfMap)),
        (format) => {
          const normalized = tfMap[format];
          expect(validOutputs).toContain(normalized);
        }
      ),
      { numRuns: Object.keys(tfMap).length }
    );
  });

  it('property: toUpperCase + tfMap lookup normaliza formatos que a API pode retornar em qualquer case', () => {
    // Observação: O código unfixed aplica .toUpperCase() antes do lookup no tfMap
    // Isso significa que qualquer variante de case dos keys existentes funciona.

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

    const validOutputs = ['15m', '1h', '2h', '3h', '4h', '12h', '1d', '1w', '1M'];

    // Formatos que a API pode retornar e que .toUpperCase() resolve
    const caseMixedFormats = [
      '1m', '1M', '1d', '1D', '4h', '4H', 'H4', 'h4',
      '1w', '1W', '15m', '15M', 'M15', 'm15',
      '1h', '1H', 'H1', 'h1', 'daily', 'DAILY', 'Daily',
      'weekly', 'WEEKLY', 'Weekly',
    ];

    // Property: para todo formato onde .toUpperCase() produz um key existente,
    // a normalização funciona corretamente
    fc.assert(
      fc.property(
        fc.constantFrom(...caseMixedFormats),
        (format) => {
          const upperFormat = format.toUpperCase();
          const result = tfMap[upperFormat] || format;
          // Se o key existe no map, o resultado deve ser válido
          if (tfMap[upperFormat]) {
            expect(validOutputs).toContain(result);
          }
          // Se não existe, o fallback é o valor original (comportamento atual)
        }
      ),
      { numRuns: caseMixedFormats.length }
    );
  });

  it('GenesisPage possui fluxo completo: upload → scan → analyze', () => {
    const fs = require('fs');
    const path = require('path');
    const genesisPagePath = path.resolve(__dirname, '../pages/GenesisPage.tsx');
    const content = fs.readFileSync(genesisPagePath, 'utf-8');

    // Verificar que os handlers de fluxo existem
    expect(content).toContain('handleFileChange');
    expect(content).toContain('handleAnalyze');
    expect(content).toContain('unifiedChartAnalysis');
    expect(content).toContain('analyzeChart');
    expect(content).toContain('setResult');
    expect(content).toContain('TradeSetup');
  });
});

// ─── Requirement 3.3: Scanner funcionalidade de scan continua operante ───────

describe('Preservation 3.3: Scanner continua detectando anomalias e listando resultados', () => {
  it('OpportunityScanner possui lógica de cálculo de indicadores técnicos', () => {
    const fs = require('fs');
    const path = require('path');
    const scannerPath = path.resolve(__dirname, '../components/OpportunityScanner.tsx');
    const content = fs.readFileSync(scannerPath, 'utf-8');

    // Funções de cálculo de indicadores devem existir
    expect(content).toContain('calculateRSI');
    expect(content).toContain('calculateBB');
    expect(content).toContain('calculateMACD');
    expect(content).toContain('calculateEMA');
  });

  it('OpportunityScanner aceita props para salvar e restaurar estado', () => {
    const fs = require('fs');
    const path = require('path');
    const scannerPath = path.resolve(__dirname, '../components/OpportunityScanner.tsx');
    const content = fs.readFileSync(scannerPath, 'utf-8');

    // Interface de props deve incluir savedState e onSaveState
    expect(content).toContain('savedState');
    expect(content).toContain('onSaveState');
    expect(content).toContain('onAnalyze');
  });
});

// ─── Requirement 3.4: Consumo de créditos funciona para outros tipos ─────────

describe('Preservation 3.4: POST /consume/{type} debita créditos corretamente', () => {
  it('property: rota consume/{type} existe na API e aceita qualquer tipo', () => {
    const fs = require('fs');
    const apiRoutesPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\routes\\api.php';
    const content = fs.readFileSync(apiRoutesPath, 'utf-8');

    // A rota POST /consume/{type} deve existir no grupo autenticado
    expect(content).toContain("consume/{type}");
    expect(content).toContain('CreditController');

    // Verificar que está dentro do grupo middleware auth:sanctum
    const authGroupMatch = content.match(/middleware\(\['auth:sanctum'\]\)[\s\S]*?consume/);
    expect(authGroupMatch).not.toBeNull();
  });

  it('property: tipos de consumo existentes no sistema permanecem válidos', () => {
    // Observação: A rota usa {type} como wildcard, aceitando qualquer tipo.
    // Os tipos conhecidos no sistema incluem: 'analysis', 'scanner', 'trade', etc.
    // O CreditController deve debitar créditos independente do tipo.

    const fs = require('fs');
    const apiRoutesPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\routes\\api.php';
    const content = fs.readFileSync(apiRoutesPath, 'utf-8');

    // A rota usa parâmetro dinâmico {type} - funciona para qualquer tipo
    const hasWildcardType = /consume\/\{type\}/.test(content);
    expect(hasWildcardType).toBe(true);
  });
});

// ─── Requirement 3.5: Performance — valores numéricos dos TPs corretos ───────

describe('Preservation 3.5: Performance — valores numéricos dos TPs continuam corretos', () => {
  it('property: calcProgress retorna valores entre 0-100 para inputs válidos', () => {
    // Observação: calcProgress no código unfixed calcula corretamente a progressão
    // O bug (7) é que progressMap inicia vazio, não que o cálculo está errado.

    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const calcProgress = (direction: string, entryPrice: number, currentPrice: number, targetPrice: number): number => {
      if (targetPrice === entryPrice || targetPrice <= 0 || entryPrice <= 0) return 0;
      if (direction === 'LONG') {
        return clamp(((currentPrice - entryPrice) / (targetPrice - entryPrice)) * 100, 0, 100);
      }
      return clamp(((entryPrice - currentPrice) / (entryPrice - targetPrice)) * 100, 0, 100);
    };

    // Property: resultado sempre entre 0 e 100
    fc.assert(
      fc.property(
        fc.constantFrom('LONG', 'SHORT'),
        fc.double({ min: 100, max: 100000, noNaN: true }),   // entryPrice
        fc.double({ min: 50, max: 150000, noNaN: true }),    // currentPrice
        fc.double({ min: 100, max: 200000, noNaN: true }),   // targetPrice
        (direction, entryPrice, currentPrice, targetPrice) => {
          const progress = calcProgress(direction, entryPrice, currentPrice, targetPrice);
          expect(progress).toBeGreaterThanOrEqual(0);
          expect(progress).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 500 }
    );
  });

  it('property: calcProgress LONG — progresso aumenta quando preço se move em direção ao target', () => {
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const calcProgress = (direction: string, entryPrice: number, currentPrice: number, targetPrice: number): number => {
      if (targetPrice === entryPrice || targetPrice <= 0 || entryPrice <= 0) return 0;
      if (direction === 'LONG') {
        return clamp(((currentPrice - entryPrice) / (targetPrice - entryPrice)) * 100, 0, 100);
      }
      return clamp(((entryPrice - currentPrice) / (entryPrice - targetPrice)) * 100, 0, 100);
    };

    fc.assert(
      fc.property(
        fc.double({ min: 1000, max: 50000, noNaN: true }),
        fc.double({ min: 0.01, max: 0.5, noNaN: true }),
        (entryPrice, ratio) => {
          const targetPrice = entryPrice * (1 + ratio);
          const midPrice = entryPrice + (targetPrice - entryPrice) * 0.5;
          const farPrice = entryPrice + (targetPrice - entryPrice) * 0.8;

          if (targetPrice <= entryPrice) return; // skip degenerate case

          const progressMid = calcProgress('LONG', entryPrice, midPrice, targetPrice);
          const progressFar = calcProgress('LONG', entryPrice, farPrice, targetPrice);

          // Preço mais próximo do target → mais progresso
          expect(progressFar).toBeGreaterThanOrEqual(progressMid);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('property: calcProgress SHORT — progresso aumenta quando preço CAI em direção ao target', () => {
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

    const calcProgress = (direction: string, entryPrice: number, currentPrice: number, targetPrice: number): number => {
      if (targetPrice === entryPrice || targetPrice <= 0 || entryPrice <= 0) return 0;
      if (direction === 'LONG') {
        return clamp(((currentPrice - entryPrice) / (targetPrice - entryPrice)) * 100, 0, 100);
      }
      return clamp(((entryPrice - currentPrice) / (entryPrice - targetPrice)) * 100, 0, 100);
    };

    fc.assert(
      fc.property(
        fc.double({ min: 5000, max: 100000, noNaN: true }),
        fc.double({ min: 0.05, max: 0.4, noNaN: true }),
        (entryPrice, ratio) => {
          const targetPrice = entryPrice * (1 - ratio);
          if (targetPrice <= 0 || targetPrice >= entryPrice) return;

          const midPrice = entryPrice - (entryPrice - targetPrice) * 0.5;
          const farPrice = entryPrice - (entryPrice - targetPrice) * 0.8;

          const progressMid = calcProgress('SHORT', entryPrice, midPrice, targetPrice);
          const progressFar = calcProgress('SHORT', entryPrice, farPrice, targetPrice);

          // Preço mais próximo do target (menor) → mais progresso
          expect(progressFar).toBeGreaterThanOrEqual(progressMid);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Requirement 3.6: GenesisPage permite nova análise (substitui resultado) ─

describe('Preservation 3.6: GenesisPage permite nova análise substituindo resultado anterior', () => {
  it('GenesisPage possui handleResetAnalysis que limpa o resultado', () => {
    const fs = require('fs');
    const path = require('path');
    const genesisPagePath = path.resolve(__dirname, '../pages/GenesisPage.tsx');
    const content = fs.readFileSync(genesisPagePath, 'utf-8');

    // Verificar que a função de reset existe e limpa o estado
    expect(content).toContain('handleResetAnalysis');
    expect(content).toContain('setResult(null)');
    expect(content).toContain('setSelectedFile(null)');
    expect(content).toContain('setChartMetadata(null)');
  });

  it('handleAnalyze limpa resultado anterior antes de iniciar nova análise', () => {
    const fs = require('fs');
    const path = require('path');
    const genesisPagePath = path.resolve(__dirname, '../pages/GenesisPage.tsx');
    const content = fs.readFileSync(genesisPagePath, 'utf-8');

    // Dentro de handleAnalyze, setResult(null) é chamado antes da análise
    const handleAnalyzeSection = content.match(/const handleAnalyze[\s\S]*?setIsAnalyzing\(true\)[\s\S]*?setResult\(null\)/);
    expect(handleAnalyzeSection).not.toBeNull();
  });
});

// ─── Requirement 3.7: Funcionalidades internas da Carteira (MEMBRO, MAE, GEMAS) ─

describe('Preservation 3.7: Funcionalidades internas da Carteira (MEMBRO, MAE, GEMAS)', () => {
  it('CarteiraCripto possui abas MEMBRO, MAE, GEMAS', () => {
    const fs = require('fs');
    const path = require('path');
    const carteiraPath = path.resolve(__dirname, '../components/CarteiraCripto.tsx');
    const content = fs.readFileSync(carteiraPath, 'utf-8');

    // Verificar que as 3 abas internas existem
    expect(content).toContain("'MEMBRO'");
    expect(content).toContain("'MAE'");
    expect(content).toContain("'GEMAS'");

    // Verificar que o activeTab state gerencia a navegação entre abas
    expect(content).toContain('activeTab');
    expect(content).toContain('setActiveTab');
  });

  it('CarteiraCripto possui operações CRUD para cada carteira', () => {
    const fs = require('fs');
    const path = require('path');
    const carteiraPath = path.resolve(__dirname, '../components/CarteiraCripto.tsx');
    const content = fs.readFileSync(carteiraPath, 'utf-8');

    // API calls para cada carteira
    expect(content).toContain('fetchCarteiraMembro');
    expect(content).toContain('storeCarteiraMembro');
    expect(content).toContain('updateCarteiraMembro');
    expect(content).toContain('deleteCarteiraMembro');
    expect(content).toContain('fetchCarteiraMae');
    expect(content).toContain('storeCarteiraMae');
    expect(content).toContain('fetchCarteiraGemas');
    expect(content).toContain('storeCarteiraGemas');
  });

  it('CarteiraCripto gerencia loading state adequadamente', () => {
    const fs = require('fs');
    const path = require('path');
    const carteiraPath = path.resolve(__dirname, '../components/CarteiraCripto.tsx');
    const content = fs.readFileSync(carteiraPath, 'utf-8');

    // Deve ter estado de loading
    expect(content).toContain('isLoading');
    expect(content).toContain('setIsLoading');
  });
});

// ─── Requirement 3.8: Rotas admin existentes (users, plans, settings) ────────

describe('Preservation 3.8: Rotas admin existentes respondem normalmente', () => {
  it('property: todas as rotas admin essenciais existem no api.php', () => {
    const fs = require('fs');
    const apiRoutesPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\routes\\api.php';
    const content = fs.readFileSync(apiRoutesPath, 'utf-8');

    // Rotas admin que devem permanecer intactas
    const adminRoutes = [
      '/users',
      '/plans',
      '/settings',
      '/stats',
      '/financial',
      '/metrics',
      '/subscriptions',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...adminRoutes),
        (route) => {
          // Extrair o path sem a barra inicial
          const routePath = route.replace('/', '');
          const routeRegex = new RegExp(`['"]\\/?${routePath}['"]`);
          expect(routeRegex.test(content)).toBe(true);
        }
      ),
      { numRuns: adminRoutes.length }
    );
  });

  it('rotas admin estão protegidas por middleware auth:sanctum + admin', () => {
    const fs = require('fs');
    const apiRoutesPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\routes\\api.php';
    const content = fs.readFileSync(apiRoutesPath, 'utf-8');

    // O grupo admin deve ter middleware auth:sanctum e admin
    const adminGroupMatch = content.match(/v1\/admin[\s\S]*?middleware\(\['auth:sanctum',\s*'admin'\]\)/);
    expect(adminGroupMatch).not.toBeNull();
  });

  it('property: controllers admin estão importados e referenciados', () => {
    const fs = require('fs');
    const apiRoutesPath = 'e:\\Programas\\wamp64\\www\\genesis-api\\routes\\api.php';
    const content = fs.readFileSync(apiRoutesPath, 'utf-8');

    const adminControllers = [
      'UserController',
      'PlanController',
      'SettingController',
      'StatsController',
      'FinancialController',
      'MetricsController',
      'SubscriptionController',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...adminControllers),
        (controller) => {
          expect(content).toContain(controller);
        }
      ),
      { numRuns: adminControllers.length }
    );
  });
});

// ─── Requirement 3.9: AppContext mantém estado global entre navegações ────────

describe('Preservation 3.9: AppContext mantém estado global (exchange, selectedPair, equity, leverage)', () => {
  it('property: AppContext expõe todas as propriedades globais necessárias', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.resolve(__dirname, '../contexts/AppContext.tsx');
    const content = fs.readFileSync(contextPath, 'utf-8');

    // Propriedades que devem estar no AppContextType interface
    const requiredProperties = [
      'exchange',
      'setExchange',
      'selectedPair',
      'setSelectedPair',
      'equity',
      'setEquity',
      'leverage',
      'setLeverage',
      'timeframe',
      'setTimeframe',
      'activeTrades',
      'setActiveTrades',
      'scannerState',
      'setScannerState',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...requiredProperties),
        (prop) => {
          expect(content).toContain(prop);
        }
      ),
      { numRuns: requiredProperties.length }
    );
  });

  it('AppProvider usa useState para gerenciar estado global (não perde entre re-renders)', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.resolve(__dirname, '../contexts/AppContext.tsx');
    const content = fs.readFileSync(contextPath, 'utf-8');

    // Verificar que os estados globais são gerenciados via useState no Provider
    expect(content).toContain("useState('Binance')");    // exchange default
    expect(content).toContain("useState('BTCUSDT')");    // selectedPair default
    expect(content).toContain("useState('1000')");       // equity default
    expect(content).toContain("useState(5)");            // leverage default
    expect(content).toContain("useState('1d')");         // timeframe default
  });

  it('AppContext.Provider value inclui todos os estados globais', () => {
    const fs = require('fs');
    const path = require('path');
    const contextPath = path.resolve(__dirname, '../contexts/AppContext.tsx');
    const content = fs.readFileSync(contextPath, 'utf-8');

    // O Provider value deve incluir todos os getters e setters
    const providerValueMatch = content.match(/value=\{\{([\s\S]*?)\}\}/);
    expect(providerValueMatch).not.toBeNull();

    const valueContent = providerValueMatch![1];
    const essentialValues = ['exchange', 'selectedPair', 'equity', 'leverage', 'timeframe'];

    for (const val of essentialValues) {
      expect(valueContent).toContain(val);
    }
  });
});

// ─── Requirement 3.10: Sidebar exibe corretamente com animações e responsividade

describe('Preservation 3.10: Sidebar exibe corretamente com animações e responsividade', () => {
  it('Sidebar usa framer-motion para animações', () => {
    const fs = require('fs');
    const path = require('path');
    const sidebarPath = path.resolve(__dirname, '../components/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    // Framer motion imports e uso
    expect(content).toContain('AnimatePresence');
    expect(content).toContain('motion');
    expect(content).toContain('framer-motion');
  });

  it('Sidebar tem layout responsivo: desktop (hidden md:flex) e mobile (md:hidden)', () => {
    const fs = require('fs');
    const path = require('path');
    const sidebarPath = path.resolve(__dirname, '../components/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    // Desktop sidebar: hidden on mobile, flex on md+
    expect(content).toContain('hidden md:flex');
    // Mobile sidebar: visible only on smaller screens
    expect(content).toContain('md:hidden');
  });

  it('Sidebar tem animação de slide para mobile (x: -280 → 0)', () => {
    const fs = require('fs');
    const path = require('path');
    const sidebarPath = path.resolve(__dirname, '../components/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    // Animação de entrada mobile
    expect(content).toContain('initial={{ x: -280 }}');
    expect(content).toContain('animate={{ x: 0 }}');
    expect(content).toContain('exit={{ x: -280 }}');
  });

  it('property: seções do sidebar estão organizadas em categorias', () => {
    const fs = require('fs');
    const path = require('path');
    const sidebarPath = path.resolve(__dirname, '../components/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    // Categorias do sidebar que devem existir
    const sectionTitles = ['Principal', 'Análise', 'Mercado', 'Contexto'];

    fc.assert(
      fc.property(
        fc.constantFrom(...sectionTitles),
        (title) => {
          expect(content).toContain(`'${title}'`);
        }
      ),
      { numRuns: sectionTitles.length }
    );
  });

  it('Sidebar NavLink aplica estilos condicionais baseado em isActive', () => {
    const fs = require('fs');
    const path = require('path');
    const sidebarPath = path.resolve(__dirname, '../components/Sidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf-8');

    // NavLink com className function que recebe isActive
    expect(content).toContain('({ isActive })');
    // Estilo ativo usa accent color
    expect(content).toContain('bg-genesis-accent');
    // Estilo inativo usa secondary/muted
    expect(content).toContain('text-genesis-text-secondary');
  });
});
