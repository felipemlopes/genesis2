# Lote de Bugs Reportados pelo Cliente — Design de Bugfix

## Overview

Este documento formaliza a abordagem técnica para corrigir 10 bugs reportados pelo cliente na plataforma Genesis 2.0. Os bugs abrangem: remoção de abas obsoletas do sidebar, correção de detecção de timeframe, implementação de paywall no Scanner, interatividade de zonas de entrada com persistência no servidor, preservação de estado de análise via AppContext, atualização em tempo real dos progress rings de TPs, correção do estado ativo do NavLink no sidebar, endpoint admin para verificação de TPs, e correção de carregamento da Carteira Cripto.

A estratégia de fix é mínima e cirúrgica — cada bug é isolado e corrigido sem impactar funcionalidades adjacentes.

## Glossário

- **Bug_Condition (C)**: Condição composta que identifica as 10 situações defeituosas — presença de abas removidas, timeframe não atualizado, scanner revelando ativos sem pagamento, zonas não clicáveis, perda de estado, progress rings em 0%, aba ativa incorreta, ausência de endpoint admin, e carteira que não abre
- **Property (P)**: Comportamento correto após o fix — abas removidas, timeframe sincronizado, paywall funcional, zonas clicáveis com persistência, estado preservado, rings em tempo real, aba ativa visual correta, endpoint admin disponível, carteira carregando
- **Preservation**: Comportamento existente inalterado — navegação de demais abas, fluxo de upload/análise, consumo de créditos, valores numéricos de TPs, AppContext global, estilo/responsividade do sidebar, rotas admin existentes
- **MENU_SECTIONS**: Array em `components/Sidebar.tsx` que define todos os itens de menu com ids
- **AppContext**: Contexto global React em `contexts/AppContext.tsx` com estado compartilhado (exchange, selectedPair, timeframe, etc.)
- **progressMap**: Estado local em `AnalysisHistoryDashboard.tsx` que armazena progresso percentual de TPs por análise
- **NavLink**: Componente do react-router-dom que aplica estilo `isActive` baseado na rota atual

## Bug Details

### Bug Condition

Os bugs se manifestam quando: (1) o sidebar renderiza itens que deveriam ter sido removidos; (2) o scan de metadados detecta um timeframe mas a condição de normalização não o cobre; (3) o Scanner revela detalhes do ativo sem exigir créditos; (4) as zonas de entrada são estáticas (sem onClick); (5) o estado `result` é local ao GenesisPage e se perde na desmontagem; (6) os progress rings dependem de `progressMap` que inicia vazio e só popula após o primeiro ciclo de polling de 15s; (7) o NavLink para `/dashboard` (index route) usa `isActive` sem `end` prop e match-a todas as sub-rotas; (8) não existe endpoint admin para listar TPs de membros; (9) o componente CarteiraCripto falha ao carregar.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UserInteraction
  OUTPUT: boolean

  RETURN
    (input.action = "view_sidebar" AND input.menuItemId IN ['history', 'active_trades']) OR
    (input.action = "upload_chart" AND input.detectedTf NOT IN tfMap.keys
       AND input.detectedTf ≠ 'UNK') OR
    (input.action = "view_scanner_results" AND input.assetRevealed = true
       AND input.creditsConsumed = false) OR
    (input.action = "click_entry_zone" AND input.zoneClickable = false) OR
    (input.action = "navigate_away" AND input.source = "GenesisPage"
       AND input.analysisResult ≠ null AND input.resultPreserved = false) OR
    (input.action = "view_performance" AND input.tpProgressValue = 0
       AND input.priceMovement > 0) OR
    (input.action = "navigate_to_subroute" AND input.genesisStillHighlighted = true) OR
    (input.action = "admin_verify_tp" AND input.endpointAvailable = false) OR
    (input.action = "open_carteira" AND input.componentLoads = false)
END FUNCTION
```

### Exemplos

- **Bug 1/6**: Usuário abre sidebar → vê "Histórico Exec." e "Ativos" que não deveriam estar presentes
- **Bug 2**: Upload de gráfico 1D retornando `timeframe: "1d"` do scan → sistema mantém `4h` porque o valor retornado da API já é lowercase `"1d"` e `tfMap` mapeia apenas `"1D"` (uppercase) → match falha
- **Bug 5**: Usuário faz análise, navega para Performance, retorna → resultado zerado (componente remontado, useState reinicializado)
- **Bug 7**: Primeiro render dos progress rings mostra 0% porque `progressMap` é `{}` e o polling de `checkPrices` demora 15s para popular — se `entry_price = 0` (não persistido corretamente), o cálculo também retorna 0
- **Bug 8**: Usuário clica em "Performance" → navega para `/dashboard/performance` mas NavLink de Genesis (`to="/dashboard"`) fica ativo porque sem `end` prop, `/dashboard` é prefixo de `/dashboard/performance`

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Navegação para todas as abas exceto "Histórico Exec." e "Ativos" continua funcional
- Fluxo de upload + scan + analyze continua retornando TradeSetup completo
- Consumo de créditos via POST `/consume/{type}` permanece inalterado
- Valores numéricos dos TPs na Performance continuam corretos
- AppContext mantém estado global (exchange, selectedPair, equity, leverage)
- Estilo visual, animações e responsividade do sidebar preservados
- Rotas admin existentes (users, plans, settings) inalteradas
- GenesisPage permite nova análise (substitui resultado anterior)
- Funcionalidades internas da Carteira (MEMBRO, MAE, GEMAS) preservadas

**Scope:**
Inputs que NÃO envolvem os 10 bugs (navegação normal, clicks em mouse, rotas já existentes, CRUD de carteira) devem ser completamente inalterados.

## Hypothesized Root Cause

1. **Bugs 1 & 6 — Abas não removidas**: Array `MENU_SECTIONS` em `Sidebar.tsx` ainda contém os itens `{ id: 'history' }` e `{ id: 'active_trades' }`. Solução: remover os objetos do array.

2. **Bug 2 — Timeframe não atualizado**: A função `unifiedChartAnalysis` pode retornar o timeframe em lowercase (ex: `"1d"`) mas o `tfMap` só possui keys em uppercase (`"1D"`). O `.toUpperCase()` é aplicado, mas se a API retorna algo como `"Daily"` ou um formato inesperado, não há match. Root cause provável: o tfMap não cobre todos os formatos possíveis retornados pela API de scan (Gemini Vision).

3. **Bug 3 — Scanner revelando ativo**: `OpportunityScanner` renderiza os resultados completos sem layer de paywall. Não existe lógica de créditos no fluxo do Scanner.

4. **Bug 4 — Zonas não clicáveis**: `AnalysisResult.tsx` renderiza as zonas como texto estático (divs sem onClick). Não há endpoint para salvar seleção de zona.

5. **Bug 5 — Perda de estado**: `const [result, setResult] = useState<TradeSetup | null>(null)` é local ao `GenesisPage`. Quando o componente desmonta (navegação), o state é perdido. Solução: mover `result` para AppContext ou usar um mecanismo de cache.

6. **Bug 7 — Progress rings em 0%**: O `progressMap` é inicializado como `{}` e só é populado pelo `useEffect` com `checkPrices()`. Se `entry_price` é 0 (campo não persistido corretamente no store), `calcProgress` retorna 0 sempre. Causa raiz dupla: (a) polling demora para iniciar, (b) `entry_price` pode não estar sendo salvo corretamente na API.

7. **Bug 8 — NavLink ativo incorreto**: O NavLink de Genesis usa `to="/dashboard"` que é a index route. Sem a prop `end`, o react-router considera que `/dashboard` é prefixo de `/dashboard/performance`, `/dashboard/scanner`, etc., mantendo-o sempre ativo.

8. **Bug 9 — Falta endpoint admin**: Não existe rota em `routes/api.php` para listar TPs/zonas selecionadas pelos membros.

9. **Bug 10 — Carteira não abre**: `CarteiraPage.tsx` simplesmente renderiza `<CarteiraCripto />`. Possíveis causas: (a) erro de runtime dentro do componente CarteiraCripto, (b) dependência faltante, (c) falta de ErrorBoundary fazendo a tela ficar em branco.

## Correctness Properties

Property 1: Bug Condition — Remoção de abas obsoletas (Bugs 1, 6)

_For any_ renderização do sidebar, os itens com id `history` e `active_trades` SHALL NOT estar presentes no DOM renderizado.

**Validates: Requirements 2.1, 2.8**

Property 2: Bug Condition — Detecção de timeframe no upload (Bug 2)

_For any_ upload de gráfico onde o scan retorna um timeframe válido (em qualquer formato: uppercase, lowercase, verbose), o sistema SHALL atualizar o estado `timeframe` do AppContext para o valor normalizado correspondente.

**Validates: Requirements 2.2**

Property 3: Bug Condition — Paywall do Scanner (Bug 3)

_For any_ resultado do Scanner/Radar, o sistema SHALL ocultar o ativo até que o usuário consuma créditos via POST `/consume/scanner`, revelando o detalhe somente após débito confirmado.

**Validates: Requirements 2.3**

Property 4: Bug Condition — Zonas de entrada interativas (Bug 4)

_For any_ análise com zonas de entrada, o sistema SHALL permitir click em cada zona, salvar a seleção no servidor (associada ao user_id), e registrar todas as zonas para consulta admin.

**Validates: Requirements 2.4, 2.5, 2.6**

Property 5: Bug Condition — Persistência do resultado de análise (Bug 5)

_For any_ navegação que saia e retorne ao GenesisPage, o sistema SHALL preservar o último resultado de análise (`TradeSetup`) no estado global, exibindo-o novamente sem necessidade de novo upload.

**Validates: Requirements 2.7**

Property 6: Bug Condition — Progress rings atualizados (Bug 7)

_For any_ análise pendente com `entry_price > 0` e preço atual disponível, os progress rings SHALL refletir o percentual de progresso calculado como `(currentPrice - entry) / (target - entry) * 100` (LONG) ou equivalente SHORT.

**Validates: Requirements 2.9**

Property 7: Bug Condition — NavLink ativo correto (Bug 8)

_For any_ navegação para uma sub-rota do dashboard, apenas o NavLink correspondente à rota ativa SHALL estar visualmente destacado; o NavLink de Genesis SHALL estar inativo quando a rota atual não é `/dashboard` exatamente.

**Validates: Requirements 2.10**

Property 8: Bug Condition — Endpoint admin de verificação de TPs (Bug 9)

_For any_ requisição admin autenticada para verificação de TPs, o sistema SHALL retornar a lista de zonas/TPs selecionados pelos membros com dados de user_id, análise e seleção.

**Validates: Requirements 2.11**

Property 9: Bug Condition — Carteira Cripto carrega (Bug 10)

_For any_ navegação para `/dashboard/carteira`, o componente CarteiraCripto SHALL renderizar corretamente sem erro de runtime.

**Validates: Requirements 2.12**

Property 10: Preservation — Comportamentos existentes inalterados

_For any_ input onde a bug condition NÃO se aplica (navegação normal, clicks em mouse, operações de CRUD, rotas admin existentes), o sistema SHALL produzir exatamente o mesmo comportamento que a versão atual.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

## Fix Implementation

### Changes Required

**Bug 1 & 6 — Remoção de abas**

**File**: `components/Sidebar.tsx`
**Function**: Constante `MENU_SECTIONS`

**Specific Changes**:
1. Remover `{ id: 'active_trades', icon: PlayCircle, label: 'Ativos' }` da seção "Principal"
2. Remover `{ id: 'history', icon: History, label: 'Histórico Exec.' }` da seção "Principal"
3. Remover imports de `PlayCircle` e `History` de lucide-react (se não usados em outro lugar)
4. Opcionalmente remover as rotas correspondentes em `router/index.tsx` (`trades`, `historico`) e os lazy imports

---

**Bug 2 — Timeframe não atualizado**

**File**: `pages/GenesisPage.tsx`
**Function**: `handleFileChange`

**Specific Changes**:
1. Expandir o `tfMap` para cobrir formatos lowercase e variantes verbosas adicionais:
   - Adicionar: `'1d': '1d'`, `'4h': '4h'`, `'1h': '1h'`, `'15m': '15m'`, etc.
   - Adicionar variantes: `'DIARIO': '1d'`, `'SEMANAL': '1w'`, `'daily': '1d'`
2. Aplicar fallback: se `normalizedTf` não está na lista permitida mas é um formato reconhecido, usar regex para extrair número + unidade
3. Garantir que o `.toUpperCase()` + fallback lowercase cubra 100% dos formatos possíveis da Gemini Vision

---

**Bug 3 — Paywall do Scanner**

**File**: `components/OpportunityScanner.tsx` (e novo wrapper em `pages/ScannerPage.tsx`)

**Specific Changes**:
1. Adicionar estado `revealedAssets: Set<string>` no componente OpportunityScanner
2. Renderizar cada resultado com ativo ofuscado (ex: `"???USDT"` ou blur) por padrão
3. Adicionar botão "Revelar" que chama POST `/api/v1/consume/scanner`
4. Somente após resposta 200 (crédito consumido), adicionar o ativo ao `revealedAssets` e exibir detalhes
5. Tratar erro 402/403 (créditos insuficientes) com mensagem ao usuário

---

**Bug 4 — Zonas de entrada clicáveis**

**File**: `components/AnalysisResult.tsx`

**Specific Changes**:
1. Tornar os divs de "Plano A" e "Plano B" clicáveis com `onClick` + cursor-pointer + feedback visual (borda/highlight)
2. Adicionar estado local `selectedZone: 'A' | 'B' | null`
3. Ao clicar, chamar novo endpoint POST `/api/v1/analises/{id}/zona-selecionada` com `{ zona: 'A' | 'B', user_id }`

**File**: `genesis-api/routes/api.php`

**Specific Changes**:
4. Adicionar rota `POST /analises/{id}/zona-selecionada` no grupo autenticado
5. Adicionar rota `POST /analises` deve salvar TODAS as zonas (Plano A e B) nos campos da análise

**File**: `genesis-api/app/Http/Controllers/Api/AnaliseController.php`

**Specific Changes**:
6. Adicionar método `selecionarZona` que salva a escolha (zona, user_id, analise_id) no banco
7. Garantir que o `store` da análise já persiste os valores de `planoA` e `planoB`

---

**Bug 5 — Persistência de análise**

**File**: `contexts/AppContext.tsx`

**Specific Changes**:
1. Adicionar `analysisResult: TradeSetup | null` e `setAnalysisResult` ao AppContextType
2. Adicionar `useState<TradeSetup | null>(null)` no AppProvider
3. Expor no Provider value

**File**: `pages/GenesisPage.tsx`

**Specific Changes**:
4. Substituir `const [result, setResult] = useState(null)` por uso de `analysisResult` / `setAnalysisResult` do AppContext
5. Manter a lógica de reset (setAnalysisResult(null)) em `handleResetAnalysis` e início de nova análise

---

**Bug 7 — Progress rings travados em 0%**

**File**: `components/AnalysisHistoryDashboard.tsx`

**Specific Changes**:
1. Executar `checkPrices()` imediatamente no mount (já está com chamada direta, verificar se executa)
2. Investigar se `entry_price` está sendo persistido corretamente — o `store` de análise já envia o campo; verificar mapeamento na API
3. Se o problema é que `entry_price = 0` vindo do servidor: corrigir o `store` no AnaliseController para garantir que o campo `entrada` é salvo
4. Adicionar loading state aos rings (skeleton/spinner) enquanto `progressMap` é vazio, para não mostrar 0% falso
5. Reduzir intervalo inicial de polling ou disparar imediatamente ao montar

**File**: `genesis-api/app/Http/Controllers/Api/AnaliseController.php`

**Specific Changes**:
6. Garantir que o campo `entrada` (entry_price) é persistido corretamente no `store`

---

**Bug 8 — NavLink ativo incorreto**

**File**: `components/Sidebar.tsx`

**Specific Changes**:
1. Adicionar prop `end` ao NavLink de Genesis: `<NavLink to="/dashboard" end ...>`
2. Alternativa: usar render prop customizado com `useLocation()` para verificar rota exata
3. A prop `end` garante que `/dashboard` só match-a quando a rota é exatamente `/dashboard` e não sub-rotas

---

**Bug 9 — Endpoint admin para verificação de TPs**

**File**: `genesis-api/routes/api.php`

**Specific Changes**:
1. Adicionar no grupo admin: `Route::get('/analises/zonas', [AnaliseController::class, 'zonasAdmin'])`
2. Adicionar: `Route::get('/analises/tps', [AnaliseController::class, 'tpsAdmin'])`

**File**: `genesis-api/app/Http/Controllers/Api/AnaliseController.php`

**Specific Changes**:
3. Criar método `zonasAdmin()` que retorna lista de zonas selecionadas com join no user
4. Criar método `tpsAdmin()` que retorna todas as análises com TPs, entrada, stop e resultado

---

**Bug 10 — Carteira não abre**

**File**: `components/CarteiraCripto.tsx`

**Specific Changes**:
1. Investigar e corrigir erro de runtime (provavelmente acesso a propriedade de `null/undefined` na carga inicial)
2. Adicionar tratamento de erro/loading state adequado
3. Envolver com ErrorBoundary ou try/catch em useEffect de dados

**File**: `pages/CarteiraPage.tsx`

**Specific Changes**:
4. Adicionar ErrorBoundary ou Suspense com fallback de erro amigável

## Testing Strategy

### Validation Approach

A estratégia segue duas fases: (1) surfacing de contraexemplos nos bugs antes do fix, (2) verificação de que o fix resolve todos os casos e não regride comportamentos existentes.

### Exploratory Bug Condition Checking

**Goal**: Surfacear contraexemplos que demonstrem cada bug ANTES da implementação do fix. Confirmar ou refutar a análise de root cause.

**Test Plan**: Escrever testes que simulem cada condição de bug no código UNFIXED e observar falhas.

**Test Cases**:
1. **Sidebar Items Test**: Renderizar Sidebar e verificar que itens com id `history` e `active_trades` existem no DOM (confirmará bug 1/6 — falhará após fix)
2. **Timeframe Detection Test**: Simular `handleFileChange` com metadata retornando `"1d"` lowercase — verificar se `setTimeframe` é chamado (falhará no código atual se tfMap não cobre)
3. **Scanner Paywall Test**: Renderizar OpportunityScanner com resultados — verificar se ativo é visível sem consumo de créditos (confirmará bug 3)
4. **Entry Zone Click Test**: Renderizar AnalysisResult com zonas — tentar click event e verificar que nada acontece (confirmará bug 4)
5. **State Persistence Test**: Montar GenesisPage com resultado, desmontar, remontar — verificar que `result` é null (confirmará bug 5)
6. **Progress Ring Initial Test**: Renderizar AnalysisHistoryDashboard com análises pendentes — verificar progressMap vazio no primeiro render (confirmará bug 7)
7. **NavLink Active Test**: Renderizar Sidebar com rota `/dashboard/performance` — verificar que NavLink de Genesis está ativo (confirmará bug 8)

**Expected Counterexamples**:
- Items "Histórico Exec." e "Ativos" presentes no DOM
- `setTimeframe` não chamado para formatos lowercase
- Ativo completo visível sem consumo de créditos
- Click em zona não dispara handler
- Estado zerado após navegação

### Fix Checking

**Goal**: Verificar que para todos os inputs onde a bug condition se aplica, o sistema fixado produz o comportamento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := Platform_fixed(input)
  ASSERT correctBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos os inputs onde a bug condition NÃO se aplica, o sistema fixado produz o mesmo resultado que o original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT Platform_original(input) = Platform_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing recomendado para preservation checking porque:
- Gera muitos casos de teste automaticamente pelo domínio de inputs
- Captura edge cases que testes manuais perderiam
- Garante fortemente que comportamento é inalterado para inputs não-buggy

**Test Plan**: Observar comportamento no código UNFIXED para navegação normal, clicks, e operações de CRUD, depois escrever property-based tests capturando esse comportamento.

**Test Cases**:
1. **Navigation Preservation**: Verificar que clicks em todas as abas restantes (Performance, Radar, Genesis, etc.) continuam navegando corretamente após remoção de itens
2. **Upload Flow Preservation**: Verificar que upload + scan + analyze continua retornando TradeSetup completo
3. **Credit Consumption Preservation**: Verificar que POST `/consume/{type}` para tipos não-scanner continua funcionando
4. **AppContext State Preservation**: Verificar que navegação entre abas mantém exchange, selectedPair, equity, leverage inalterados
5. **Admin Routes Preservation**: Verificar que rotas admin existentes (users, plans, settings) respondem normalmente

### Unit Tests

- Renderizar Sidebar e assertar ausência de items removidos
- Testar `tfMap` com todos os formatos possíveis de timeframe
- Testar `calcProgress` com entry_price, currentPrice e targetPrice variados
- Testar NavLink `end` prop com diferentes rotas
- Testar componente de paywall do Scanner (renderiza blur, click revela após API success)
- Testar click em zonas de entrada e chamada à API

### Property-Based Tests

- Gerar timeframes aleatórios em formatos variados e verificar que todos normalizam para valores válidos
- Gerar estados aleatórios de análise e verificar que persistência via AppContext funciona em mount/unmount
- Gerar preços aleatórios e verificar que `calcProgress` retorna valores entre 0-100 e progress rings refletem corretamente
- Gerar combinações de rotas e verificar que apenas o NavLink correspondente fica ativo

### Integration Tests

- Fluxo completo: upload → scan → detect timeframe → analyze → ver resultado → navegar → voltar → resultado preservado
- Fluxo Scanner: scan → ver resultados ocultos → click revelar → consumir créditos → ver ativo
- Fluxo Zonas: análise → click zona A → verificar POST enviado → verificar admin endpoint retorna seleção
- Fluxo Performance: análise pendente com entry_price → preço muda → rings atualizam em tempo real
- Fluxo Carteira: click na aba → componente carrega sem erro → abas internas funcionam
