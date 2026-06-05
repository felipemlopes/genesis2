# Plano de Implementação

- [x] 1. Escrever teste exploratório de bug condition (ANTES do fix)
  - **Property 1: Bug Condition** - Lote de Bugs Reportados pelo Cliente
  - **CRITICAL**: Este teste DEVE FALHAR no código unfixed — a falha confirma que os bugs existem
  - **NÃO tente corrigir o teste ou o código quando ele falhar**
  - **NOTE**: Este teste codifica o comportamento esperado — ele validará o fix quando passar após a implementação
  - **GOAL**: Surfacear contraexemplos que demonstrem a existência dos bugs
  - **Scoped PBT Approach**: Testar condições específicas de cada bug isoladamente
  - Testar que `MENU_SECTIONS` contém itens com id `history` e `active_trades` (confirma Bug 1/6)
  - Testar que NavLink de Genesis (`to="/dashboard"`) fica ativo em sub-rotas como `/dashboard/performance` (confirma Bug 8)
  - Testar que `tfMap` não normaliza formatos lowercase como `"1d"`, `"4h"` (confirma Bug 2)
  - Testar que `result` (TradeSetup) em GenesisPage é local (useState) e perde-se na desmontagem (confirma Bug 5)
  - Testar que `progressMap` inicia vazio e progress rings mostram 0% no primeiro render (confirma Bug 7)
  - Testar que zonas de entrada não possuem onClick handler (confirma Bug 4)
  - Testar que Scanner revela ativo sem exigir consumo de créditos (confirma Bug 3)
  - Testar que CarteiraCripto não renderiza corretamente (confirma Bug 10)
  - Testar que não existe endpoint admin para verificação de TPs (confirma Bug 9)
  - Executar testes no código UNFIXED
  - **EXPECTED OUTCOME**: Testes FALHAM (isto está correto — prova que os bugs existem)
  - Documentar contraexemplos encontrados para entender root cause
  - Marcar tarefa como completa quando testes escritos, executados, e falha documentada
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12_

- [x] 2. Escrever testes de preservação (ANTES do fix)
  - **Property 2: Preservation** - Comportamentos Existentes Inalterados
  - **IMPORTANT**: Seguir metodologia observation-first
  - Observar: navegação para abas restantes (Performance, Radar, Genesis, etc.) funciona no código unfixed
  - Observar: upload + scan + analyze retorna TradeSetup completo no código unfixed
  - Observar: POST `/consume/{type}` debita créditos corretamente
  - Observar: AppContext mantém estado global (exchange, selectedPair, equity, leverage) entre navegações
  - Observar: rotas admin existentes (users, plans, settings) respondem normalmente
  - Observar: sidebar exibe corretamente com animações e responsividade
  - Observar: funcionalidades internas da Carteira (MEMBRO, MAE, GEMAS) funcionam
  - Escrever property-based tests capturando padrões de comportamento observados
  - Verificar que testes PASSAM no código UNFIXED
  - **EXPECTED OUTCOME**: Testes PASSAM (confirma baseline de comportamento a preservar)
  - Marcar tarefa como completa quando testes escritos, executados, e passando no código unfixed
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [ ] 3. Fix Bugs 1 & 6 — Remover abas obsoletas do sidebar

  - [x] 3.1 Remover item `{ id: 'history', icon: History, label: 'Histórico Exec.' }` de MENU_SECTIONS em `components/Sidebar.tsx`
    - Remover também import de `History` de lucide-react se não usado em outro lugar
    - _Bug_Condition: isBugCondition(X) where X.action = "view_sidebar" AND X.menuItem = 'history'_
    - _Expected_Behavior: item NÃO presente no DOM renderizado_
    - _Requirements: 2.1_

  - [x] 3.2 Remover item `{ id: 'active_trades', icon: PlayCircle, label: 'Ativos' }` de MENU_SECTIONS em `components/Sidebar.tsx`
    - Remover também import de `PlayCircle` de lucide-react se não usado em outro lugar
    - _Bug_Condition: isBugCondition(X) where X.action = "view_sidebar" AND X.menuItem = 'active_trades'_
    - _Expected_Behavior: item NÃO presente no DOM renderizado_
    - _Requirements: 2.8_

  - [ ] 3.3 Remover rotas correspondentes (`trades`, `historico`) e lazy imports em `router/index.tsx`
    - Remover imports de ActiveTradesPage e HistoryPage
    - Remover paths `trades` e `historico` do array de children
    - _Preservation: Navegação das demais abas continua funcional_
    - _Requirements: 2.1, 2.8, 3.1_

  - [ ] 3.4 Remover entradas de ROUTE_MAP para `active_trades` e `history` em `components/Sidebar.tsx`
    - _Requirements: 2.1, 2.8_

- [ ] 4. Fix Bug 8 — Corrigir estado ativo do NavLink no sidebar

  - [ ] 4.1 Adicionar prop `end` ao NavLink de Genesis em `components/Sidebar.tsx`
    - O NavLink `to="/dashboard"` deve usar `end` para match exato
    - Garantir que `/dashboard` só fica ativo quando rota é exatamente `/dashboard`
    - _Bug_Condition: isBugCondition(X) where X.action = "select_sidebar_tab" AND X.visuallyActiveTab ≠ X.actualRoute_
    - _Expected_Behavior: apenas NavLink correspondente à rota ativa fica destacado_
    - _Requirements: 2.10_

  - [ ] 4.2 Testar navegação entre sub-rotas e verificar destaque visual correto
    - Navegar para `/dashboard/performance`, `/dashboard/scanner`, etc.
    - Confirmar que NavLink de Genesis não fica ativo em sub-rotas
    - _Preservation: Estilo e responsividade do sidebar preservados_
    - _Requirements: 2.10, 3.10_

- [ ] 5. Fix Bug 2 — Corrigir detecção de timeframe no upload

  - [ ] 5.1 Expandir `tfMap` em `pages/GenesisPage.tsx` para cobrir formatos lowercase e variantes
    - Adicionar keys lowercase: `'1d'`, `'4h'`, `'1h'`, `'15m'`, `'5m'`, `'1w'`
    - Adicionar variantes verbosas: `'daily'`, `'diario'`, `'semanal'`, `'weekly'`
    - Aplicar `.toLowerCase()` no valor retornado antes do lookup
    - _Bug_Condition: isBugCondition(X) where X.detectedTimeframe ≠ X.currentContextTimeframe_
    - _Expected_Behavior: timeframe do contexto atualizado para valor detectado normalizado_
    - _Requirements: 2.2_

  - [ ] 5.2 Adicionar fallback com regex para extrair número + unidade de formatos não mapeados
    - Se tfMap não contém a key, tentar regex `/(\d+)(m|h|d|w)/i`
    - Garantir que `setTimeframe` é chamado com valor normalizado
    - _Preservation: Fluxo de upload + scan + analyze continua funcional_
    - _Requirements: 2.2, 3.2_

- [ ] 6. Fix Bug 5 — Persistir estado de análise no AppContext

  - [ ] 6.1 Adicionar `analysisResult` e `setAnalysisResult` ao AppContext em `contexts/AppContext.tsx`
    - Tipo: `TradeSetup | null`
    - Inicializar com `null`
    - Expor no Provider value
    - _Bug_Condition: isBugCondition(X) where X.action = "navigate_away_from_genesis" AND X.analysisResult ≠ null_
    - _Expected_Behavior: resultado preservado no estado global entre navegações_
    - _Requirements: 2.7_

  - [ ] 6.2 Substituir `useState` local por AppContext em `pages/GenesisPage.tsx`
    - Usar `analysisResult` / `setAnalysisResult` do contexto em vez de state local
    - Manter lógica de reset (`setAnalysisResult(null)`) em nova análise
    - _Preservation: GenesisPage permite nova análise substituindo resultado anterior_
    - _Requirements: 2.7, 3.6, 3.9_

- [ ] 7. Fix Bug 10 — Corrigir carregamento da Carteira Cripto

  - [ ] 7.1 Investigar e corrigir erro de runtime em `components/CarteiraCripto.tsx`
    - Verificar acesso a propriedades de `null/undefined` na carga inicial
    - Adicionar guards/optional chaining onde necessário
    - Adicionar tratamento de loading e error state adequado
    - _Bug_Condition: isBugCondition(X) where X.action = "open_carteira_cripto" AND X.pageLoads = false_
    - _Expected_Behavior: componente renderiza corretamente sem erro de runtime_
    - _Requirements: 2.12_

  - [ ] 7.2 Adicionar ErrorBoundary em `pages/CarteiraPage.tsx`
    - Envolver `<CarteiraCripto />` com ErrorBoundary ou Suspense com fallback amigável
    - _Preservation: Funcionalidades internas da Carteira (MEMBRO, MAE, GEMAS) preservadas_
    - _Requirements: 2.12, 3.7_

- [ ] 8. Fix Bug 7 — Corrigir progress rings dos TPs na Performance

  - [ ] 8.1 Executar `checkPrices()` imediatamente no mount em `components/AnalysisHistoryDashboard.tsx`
    - Garantir que useEffect dispara `checkPrices()` sem delay no primeiro render
    - Adicionar loading state (skeleton) aos rings enquanto `progressMap` é vazio
    - _Bug_Condition: isBugCondition(X) where X.action = "view_performance_tp_rings" AND X.progressValue = 0_
    - _Expected_Behavior: rings refletem % de progresso real baseado no preço atual_
    - _Requirements: 2.9_

  - [ ] 8.2 Verificar persistência de `entry_price` na API
    - Garantir que `AnaliseController@store` salva campo `entrada` (entry_price) corretamente
    - Se `entry_price = 0` no servidor, corrigir mapeamento no controller
    - _Bug_Condition: entry_price = 0 causa calcProgress retornar 0 sempre_
    - _Expected_Behavior: entry_price persistido e usado no cálculo de progresso_
    - _Requirements: 2.9, 3.5_

  - [ ] 8.3 Corrigir cálculo de `calcProgress` para edge cases
    - Tratar caso onde `entry_price = 0` ou `target = entry` (divisão por zero)
    - Garantir retorno entre 0-100%
    - _Preservation: Valores numéricos dos TPs continuam corretos_
    - _Requirements: 2.9, 3.5_

- [ ] 9. Fix Bug 3 — Implementar paywall no Scanner

  - [ ] 9.1 Adicionar estado `revealedAssets` e lógica de ofuscação em `components/OpportunityScanner.tsx`
    - Criar `revealedAssets: Set<string>` no estado do componente
    - Renderizar cada resultado com ativo ofuscado (`"???USDT"` ou blur CSS)
    - _Bug_Condition: isBugCondition(X) where X.action = "view_scanner_results" AND X.creditNotConsumed = true_
    - _Expected_Behavior: ativo oculto até consumo de créditos_
    - _Requirements: 2.3_

  - [ ] 9.2 Implementar botão "Revelar" com consumo de créditos
    - Botão chama POST `/api/v1/consume/scanner`
    - Somente após resposta 200, adicionar ativo ao `revealedAssets` e exibir detalhes
    - Tratar erro 402/403 (créditos insuficientes) com mensagem ao usuário
    - _Preservation: Consumo de créditos para outros tipos continua funcional_
    - _Requirements: 2.3, 3.3, 3.4_

- [ ] 10. Fix Bug 4 — Tornar zonas de entrada clicáveis + persistência na API

  - [x] 10.1 Tornar zonas de entrada clicáveis em `components/AnalysisResult.tsx`
    - Adicionar `onClick` + `cursor-pointer` + feedback visual (borda/highlight) nos divs de Plano A e Plano B
    - Adicionar estado local `selectedZone: 'A' | 'B' | null`
    - _Bug_Condition: isBugCondition(X) where X.action = "view_analysis_result" AND X.entryZonesClickable = false_
    - _Expected_Behavior: zonas clicáveis com feedback visual_
    - _Requirements: 2.4_

  - [x] 10.2 Implementar chamada à API ao selecionar zona
    - Ao clicar, chamar POST `/api/v1/analises/{id}/zona-selecionada` com `{ zona: 'A' | 'B', user_id }`
    - Feedback visual de sucesso após resposta 200
    - _Expected_Behavior: escolha salva no banco associada ao membro_
    - _Requirements: 2.5_

  - [x] 10.3 Criar endpoint POST `/analises/{id}/zona-selecionada` no backend
    - Adicionar rota em `genesis-api/routes/api.php` no grupo autenticado
    - Criar método `selecionarZona` em `AnaliseController`
    - Salvar zona, user_id, analise_id no banco
    - _Expected_Behavior: dados de zona persistidos para consulta admin_
    - _Requirements: 2.5, 2.6_

  - [x] 10.4 Garantir que `store` da análise salva TODAS as zonas (Plano A e B)
    - Verificar que AnaliseController@store persiste valores de `planoA` e `planoB`
    - _Requirements: 2.6_

- [ ] 11. Fix Bug 9 — Implementar endpoint admin para verificação de TPs

  - [ ] 11.1 Criar rota GET `/admin/analises/zonas` em `genesis-api/routes/api.php`
    - Adicionar no grupo admin autenticado
    - _Bug_Condition: isBugCondition(X) where X.action = "admin_verify_tp_data" AND X.endpointExists = false_
    - _Expected_Behavior: endpoint disponível para admin verificar zonas/TPs dos membros_
    - _Requirements: 2.11_

  - [ ] 11.2 Criar rota GET `/admin/analises/tps` em `genesis-api/routes/api.php`
    - Adicionar no grupo admin autenticado
    - _Requirements: 2.11_

  - [ ] 11.3 Implementar método `zonasAdmin()` em `AnaliseController`
    - Retornar lista de zonas selecionadas com join no user (user_id, nome, zona, analise_id, data)
    - _Requirements: 2.11_

  - [ ] 11.4 Implementar método `tpsAdmin()` em `AnaliseController`
    - Retornar todas as análises com TPs, entrada, stop e resultado
    - Incluir dados do membro (user_id, nome)
    - _Preservation: Rotas admin existentes (users, plans, settings) inalteradas_
    - _Requirements: 2.11, 3.8_

- [ ] 12. Verificar teste de bug condition agora passa

  - [ ] 12.1 Re-executar teste de bug condition (Property 1)
    - **Property 1: Expected Behavior** - Todos os Bugs Corrigidos
    - **IMPORTANT**: Re-executar o MESMO teste da tarefa 1 — NÃO escrever novo teste
    - O teste da tarefa 1 codifica o comportamento esperado
    - Quando este teste passar, confirma que o comportamento esperado é satisfeito
    - **EXPECTED OUTCOME**: Teste PASSA (confirma que bugs foram corrigidos)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

  - [ ] 12.2 Re-executar testes de preservação (Property 2)
    - **Property 2: Preservation** - Comportamentos Existentes Inalterados
    - **IMPORTANT**: Re-executar os MESMOS testes da tarefa 2 — NÃO escrever novos testes
    - **EXPECTED OUTCOME**: Testes PASSAM (confirma que não houve regressão)
    - Confirmar que todos os testes continuam passando após fix
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [ ] 13. Checkpoint — Garantir que todos os testes passam
  - Executar suíte completa de testes
  - Verificar que nenhum teste de preservação regrediu
  - Verificar que todos os testes de bug condition agora passam
  - Caso haja dúvidas, perguntar ao usuário antes de prosseguir
