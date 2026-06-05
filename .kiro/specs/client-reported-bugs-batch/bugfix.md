# Documento de Requisitos de Bugfix — Lote de Bugs Reportados pelo Cliente

## Introdução

Este documento consolida 10 bugs/issues reportados pelo cliente na plataforma Genesis 2.0 (crypto trading). Os problemas abrangem navegação incorreta, perda de estado, falhas de renderização, problemas de monetização no Scanner, e funcionalidades que não abrem ou não gravam dados corretamente. A correção deste lote é crítica para a experiência do usuário e para o modelo de monetização da plataforma.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 — Aba "Histórico Exec." presente no sidebar**
1.1 WHEN o usuário visualiza o sidebar THEN o sistema exibe a aba "Histórico Exec." (id: `history`) na seção "Principal", sendo que esta aba deveria ter sido removida

**Bug 2 — Gráfico não lê Time Frame correto**
1.2 WHEN o usuário faz upload de um gráfico de Bitcoin no timeframe Diário (1d) THEN o sistema mantém o timeframe padrão de 4H já existente no contexto, ignorando o timeframe detectado nos metadados do chart enviado

**Bug 3 — Radar mostrando sinais abertos (revelando o ativo)**
1.3 WHEN o Scanner/Radar detecta anomalias e exibe os resultados THEN o sistema mostra o sinal completo incluindo qual ativo possui a anomalia, sem exigir consumo de créditos para revelar o detalhe

**Bug 4 — Zonas de entrada não clicáveis**
1.4 WHEN o resultado da análise exibe zonas de entrada (entry zones) THEN o sistema não permite que o membro clique para selecionar uma zona de entrada específica
1.5 WHEN o membro seleciona uma zona de entrada THEN o sistema não salva essa escolha no banco de dados vinculada ao membro
1.6 WHEN qualquer análise é concluída com zonas de entrada THEN o sistema não registra os dados de TODAS as zonas no servidor para visualização pelos ADMs

**Bug 5 — Análise apaga ao trocar de aba**
1.7 WHEN o usuário sai da aba "Análise" (GenesisPage) para outra aba e retorna THEN o sistema perde o resultado da análise (`result` state), obrigando o usuário a refazer a análise

**Bug 6 — Aba "Ativos" presente no sidebar**
1.8 WHEN o usuário visualiza o sidebar THEN o sistema exibe a aba "Ativos" (id: `active_trades`) na seção "Principal", sendo que esta aba deveria ter sido removida

**Bug 7 — Círculos de progressão dos TPs travados em 0%**
1.9 WHEN a Performance (AnalysisHistoryDashboard) exibe os Take Profits com seus valores corretos THEN os círculos/progress rings permanecem em 0% e não refletem a variação do preço em tempo real

**Bug 8 — Aba selecionada não atualiza visualmente**
1.10 WHEN o usuário seleciona outra aba no sidebar THEN a aba "Genesis" permanece visualmente destacada como ativa, em vez de destacar apenas a aba realmente selecionada

**Bug 9 — Falta confirmação dos dados dos TPs no servidor**
1.11 WHEN o ADM precisa verificar se os dados dos TPs escolhidos pelos membros estão sendo gravados corretamente THEN o sistema não oferece endpoint ou painel de verificação para essa conferência

**Bug 10 — Carteira Cripto não abre**
1.12 WHEN o usuário clica na aba "Carteira Cripto" no sidebar THEN a tela/componente não carrega ou não abre corretamente

---

### Expected Behavior (Correct)

**Bug 1 — Remover aba "Histórico Exec."**
2.1 WHEN o usuário visualiza o sidebar THEN o sistema NÃO SHALL exibir a aba "Histórico Exec." (id: `history`) — ela deve ser completamente removida da navegação

**Bug 2 — Gráfico deve ler Time Frame correto**
2.2 WHEN o usuário faz upload de um gráfico e o scan de metadados detecta um timeframe (ex: "1d") THEN o sistema SHALL atualizar o estado `timeframe` do contexto para o valor detectado no arquivo enviado, sobrescrevendo qualquer valor anterior

**Bug 3 — Radar deve ocultar o ativo até pagamento**
2.3 WHEN o Scanner/Radar detecta anomalias e exibe os resultados THEN o sistema SHALL mostrar apenas que existe uma anomalia (sem revelar o ativo), e o usuário SHALL precisar clicar e consumir créditos (POST /consume/{type}) para ver o detalhe completo do sinal

**Bug 4 — Zonas de entrada clicáveis e dados persistidos**
2.4 WHEN o resultado da análise exibe zonas de entrada THEN o sistema SHALL tornar cada zona clicável para que o membro possa selecionar qual entrada deseja
2.5 WHEN o membro clica e seleciona uma zona de entrada THEN o sistema SHALL salvar essa escolha no banco de dados associada ao membro (user_id)
2.6 WHEN qualquer análise é concluída com zonas de entrada THEN o sistema SHALL registrar os dados de TODAS as zonas no servidor para que os ADMs possam consultar

**Bug 5 — Análise deve persistir ao trocar de aba**
2.7 WHEN o usuário sai da aba "Análise" (GenesisPage) e retorna THEN o sistema SHALL manter o resultado da última análise visível, sem perda de estado

**Bug 6 — Remover aba "Ativos"**
2.8 WHEN o usuário visualiza o sidebar THEN o sistema NÃO SHALL exibir a aba "Ativos" (id: `active_trades`) — ela deve ser completamente removida da navegação

**Bug 7 — Círculos de progressão dos TPs com atualização em tempo real**
2.9 WHEN a Performance exibe os Take Profits THEN os círculos/progress rings SHALL refletir a porcentagem de progresso em relação ao preço atual em tempo real (ex: se TP1 está a $100 e preço atual é $80, progresso = 80%)

**Bug 8 — Aba selecionada deve atualizar corretamente**
2.10 WHEN o usuário seleciona qualquer aba no sidebar THEN o sistema SHALL destacar visualmente apenas a aba correspondente à rota ativa atual, removendo o destaque de todas as outras abas

**Bug 9 — Endpoint/painel de verificação dos TPs para ADMs**
2.11 WHEN o ADM acessa o painel de verificação THEN o sistema SHALL fornecer um endpoint (ou tela admin) que liste os TPs escolhidos por cada membro, permitindo confirmar que os dados estão sendo gravados corretamente

**Bug 10 — Carteira Cripto deve abrir corretamente**
2.12 WHEN o usuário clica na aba "Carteira Cripto" no sidebar THEN o sistema SHALL carregar e renderizar o componente CarteiraCripto corretamente na rota `/dashboard/carteira`

---

### Unchanged Behavior (Regression Prevention)

**Navegação — demais abas do sidebar permanecem funcionais**
3.1 WHEN o usuário clica em qualquer aba que NÃO seja "Histórico Exec." ou "Ativos" (ex: Performance, Radar, Genesis, etc.) THEN o sistema SHALL CONTINUE TO navegar corretamente para a página correspondente

**Upload de gráfico — fluxo de análise completo**
3.2 WHEN o usuário faz upload de um gráfico e o scan de metadados funciona corretamente THEN o sistema SHALL CONTINUE TO realizar a análise completa (scan + analyze) retornando o TradeSetup com entry zones, TPs e stop loss

**Scanner — funcionalidade de scan continua operante**
3.3 WHEN o Scanner realiza o scan de oportunidades THEN o sistema SHALL CONTINUE TO detectar anomalias e listar os resultados (mesmo que agora com informação parcial até o pagamento)

**Créditos — consumo funciona para outros tipos**
3.4 WHEN o usuário consome créditos para outros tipos de operação (ex: análise) THEN o sistema SHALL CONTINUE TO debitar os créditos corretamente via POST /consume/{type}

**Performance — valores numéricos dos TPs continuam corretos**
3.5 WHEN a Performance exibe os dados dos trades THEN o sistema SHALL CONTINUE TO mostrar os valores numéricos corretos dos TPs, entrada e stop loss

**GenesisPage — fluxo de nova análise permanece funcional**
3.6 WHEN o usuário inicia uma nova análise (novo upload) THEN o sistema SHALL CONTINUE TO substituir o resultado anterior pelo novo resultado

**Carteira — funcionalidades internas preservadas**
3.7 WHEN a Carteira Cripto carrega corretamente THEN o sistema SHALL CONTINUE TO exibir as abas internas (MEMBRO, MAE, GEMAS), listar ativos, e permitir CRUD normalmente

**API Admin — rotas existentes preservadas**
3.8 WHEN o ADM acessa as rotas admin existentes (users, plans, settings, etc.) THEN o sistema SHALL CONTINUE TO funcionar normalmente sem impacto das novas rotas de verificação

**Estado global — AppContext preservado**
3.9 WHEN o usuário navega entre abas THEN o sistema SHALL CONTINUE TO manter o estado global (exchange, selectedPair, equity, leverage, activeTrades) inalterado no AppContext

**Sidebar — estilo e responsividade preservados**
3.10 WHEN o sidebar é renderizado em desktop ou mobile THEN o sistema SHALL CONTINUE TO exibir corretamente com animações, responsividade e estilo visual inalterados

---

## Derivação da Bug Condition

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type UserInteraction
  OUTPUT: boolean

  // Condições que disparam os bugs neste lote
  RETURN
    (X.action = "view_sidebar" AND X.menuItem IN ['history', 'active_trades']) OR
    (X.action = "upload_chart" AND X.detectedTimeframe ≠ X.currentContextTimeframe) OR
    (X.action = "view_scanner_results" AND X.creditNotConsumed = true) OR
    (X.action = "view_analysis_result" AND X.entryZonesClickable = false) OR
    (X.action = "navigate_away_from_genesis" AND X.analysisResult ≠ null) OR
    (X.action = "view_performance_tp_rings" AND X.progressValue = 0) OR
    (X.action = "select_sidebar_tab" AND X.visuallyActiveTab ≠ X.actualRoute) OR
    (X.action = "admin_verify_tp_data" AND X.endpointExists = false) OR
    (X.action = "open_carteira_cripto" AND X.pageLoads = false)
END FUNCTION
```

**Propriedade — Fix Checking:**
```pascal
// Property: Todos os bugs corrigidos para inputs que disparam a condição
FOR ALL X WHERE isBugCondition(X) DO
  result ← Platform'(X)
  ASSERT
    (X.menuItem NOT IN visibleSidebarItems) AND
    (X.timeframeAfterScan = X.detectedTimeframe) AND
    (X.scannerShowsAssetDetail = false UNTIL X.creditsConsumed) AND
    (X.entryZonesAreClickable = true) AND
    (X.selectedZoneSavedForMember = true) AND
    (X.allZonesSavedForAdmin = true) AND
    (X.analysisResultPreservedOnReturn = true) AND
    (X.tpProgressRings > 0 WHEN priceMovement > 0) AND
    (X.visuallyActiveTab = X.actualRoute) AND
    (X.adminTpVerificationEndpointExists = true) AND
    (X.carteiraPageLoads = true)
END FOR
```

**Propriedade — Preservation Checking:**
```pascal
// Property: Comportamento existente inalterado para inputs não-buggy
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT Platform(X) = Platform'(X)
END FOR
```
