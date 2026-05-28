# Plano de Implementação

- [x] 1. Escrever teste exploratório da condição do bug
  - **Property 1: Bug Condition** - Preservação do Par Existente em Falha de Detecção
  - **CRITICAL**: Este teste DEVE FALHAR no código não corrigido - a falha confirma que o bug existe
  - **NÃO tente corrigir o teste ou o código quando ele falhar**
  - **NOTE**: Este teste codifica o comportamento esperado - ele validará a correção quando passar após a implementação
  - **GOAL**: Evidenciar contraexemplos que demonstram a existência do bug
  - **Scoped PBT Approach**: Para este bug determinístico, escopar a propriedade aos casos concretos de falha: `selectedPair` preenchido com análise retornando par falsy/UNK ou lançando exceção
  - Testar que `handleFileChange` preserva `selectedPair` quando `unifiedChartAnalysis` retorna `pair: null` e `selectedPair = 'BTCUSDT'`
  - Testar que `handleFileChange` preserva `selectedPair` quando `unifiedChartAnalysis` retorna `pair: 'UNK'` e `selectedPair = 'ETHUSDT'`
  - Testar que `handleFileChange` preserva `selectedPair` quando `unifiedChartAnalysis` lança exceção e `selectedPair = 'SOLUSDT'`
  - Condição do bug: `isBugCondition(input)` onde `input.existingPair != '' AND (analysisResult IS Error OR analysisResult.pair IS falsy OR analysisResult.pair = 'UNK')`
  - Asserções devem verificar que `selectedPair` mantém o valor original após execução de `handleFileChange`
  - Executar teste no código NÃO CORRIGIDO
  - **EXPECTED OUTCOME**: Teste FALHA (isso é correto - prova que o bug existe)
  - Documentar contraexemplos encontrados (ex: "handleFileChange com selectedPair='BTCUSDT' e pair=null resulta em selectedPair='' ao invés de manter 'BTCUSDT'")
  - Marcar tarefa como completa quando o teste estiver escrito, executado e a falha documentada
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Escrever testes de preservação baseados em propriedades (ANTES de implementar a correção)
  - **Property 2: Preservation** - Atualização do Par em Detecção Bem-Sucedida
  - **IMPORTANT**: Seguir metodologia observation-first
  - Observar: quando `unifiedChartAnalysis` retorna `pair: 'BTCUSDT'` (válido), `selectedPair` é atualizado para 'BTCUSDT' no código não corrigido
  - Observar: quando `unifiedChartAnalysis` retorna `exchange: 'binance'`, o estado `exchange` é atualizado para 'Binance' no código não corrigido
  - Observar: quando `unifiedChartAnalysis` retorna `timeframe: '4H'`, o estado `timeframe` é atualizado para '4h' no código não corrigido
  - Escrever teste baseado em propriedades: para todos os inputs onde `isBugCondition` retorna false (par válido detectado), verificar que `selectedPair` é atualizado com o par normalizado, `exchange` é atualizado corretamente, e `timeframe` é atualizado corretamente
  - Verificar que o fetch de dados das exchanges (Binance, Bybit, Bitget, OKX) é executado quando par válido é detectado
  - Executar testes no código NÃO CORRIGIDO
  - **EXPECTED OUTCOME**: Testes PASSAM (confirma comportamento baseline a preservar)
  - Marcar tarefa como completa quando os testes estiverem escritos, executados e passando no código não corrigido
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Correção do bug - Campo Par limpo indevidamente no upload

  - [x] 3.1 Implementar a correção
    - Remover `setSelectedPair('')` do branch `else` na verificação de par em `handleFileChange`
    - Remover `setSelectedPair('')` do bloco `catch` em `handleFileChange`
    - O bloco `else` pode ser removido completamente ou mantido vazio
    - O bloco `catch` deve manter o `console.error` e o `alert`, apenas removendo o `setSelectedPair('')`
    - _Bug_Condition: isBugCondition(input) onde input.existingPair != '' AND (analysisResult IS Error OR analysisResult.pair IS falsy OR analysisResult.pair = 'UNK')_
    - _Expected_Behavior: selectedPair deve manter o valor existente (input.existingPair) quando a condição do bug é verdadeira_
    - _Preservation: Quando a IA detecta par válido, selectedPair deve ser atualizado; exchange e timeframe continuam sendo atualizados normalmente_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verificar que o teste exploratório da condição do bug agora passa
    - **Property 1: Expected Behavior** - Preservação do Par Existente em Falha de Detecção
    - **IMPORTANT**: Re-executar o MESMO teste da tarefa 1 - NÃO escrever um novo teste
    - O teste da tarefa 1 codifica o comportamento esperado
    - Quando este teste passar, confirma que o comportamento esperado é satisfeito
    - Executar teste exploratório da condição do bug da etapa 1
    - **EXPECTED OUTCOME**: Teste PASSA (confirma que o bug foi corrigido)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verificar que os testes de preservação ainda passam
    - **Property 2: Preservation** - Atualização do Par em Detecção Bem-Sucedida
    - **IMPORTANT**: Re-executar os MESMOS testes da tarefa 2 - NÃO escrever novos testes
    - Executar testes de preservação baseados em propriedades da etapa 2
    - **EXPECTED OUTCOME**: Testes PASSAM (confirma que não há regressões)
    - Confirmar que todos os testes ainda passam após a correção (sem regressões)

- [x] 4. Checkpoint - Garantir que todos os testes passam
  - Garantir que todos os testes passam, perguntar ao usuário se surgirem dúvidas.
