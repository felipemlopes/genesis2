# Bugfix Design - Campo Par Limpo no Upload

## Visão Geral

O bug ocorre na função `handleFileChange` em `GenesisPage.tsx`. Quando o usuário faz upload de uma imagem para análise e a IA não consegue detectar o par de trading (retorna falsy ou 'UNK') ou quando ocorre um erro na análise, o sistema limpa indevidamente o campo "Par" (`selectedPair`), apagando o valor que o usuário já havia digitado manualmente. A correção consiste em remover as duas chamadas `setSelectedPair('')` que causam esse comportamento.

## Glossário

- **Bug_Condition (C)**: A condição que dispara o bug — quando o usuário já possui um valor no campo "Par" e a análise de IA falha em detectar o par (retorna falsy/UNK ou lança exceção)
- **Property (P)**: O comportamento desejado — o campo "Par" deve preservar seu valor existente quando a IA não consegue detectar um par válido
- **Preservation**: O comportamento existente que deve permanecer inalterado — quando a IA detecta um par válido, o campo deve ser atualizado normalmente; exchange e timeframe continuam sendo atualizados
- **handleFileChange**: A função em `pages/GenesisPage.tsx` que processa o upload de imagem e executa a análise unificada via IA
- **unifiedChartAnalysis**: Serviço que analisa a imagem do gráfico e retorna metadados (par, exchange, timeframe)
- **selectedPair**: Estado React que armazena o par de trading selecionado pelo usuário

## Detalhes do Bug

### Condição do Bug

O bug se manifesta quando o usuário já possui um valor digitado no campo "Par" e faz upload de uma imagem cuja análise pela IA não retorna um par válido (resultado falsy ou 'UNK') ou quando a análise lança uma exceção. A função `handleFileChange` executa `setSelectedPair('')` nesses cenários, apagando o valor existente.

**Especificação Formal:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { existingPair: string, analysisResult: UnifiedChartResult | Error }
  OUTPUT: boolean
  
  RETURN input.existingPair != ''
         AND (
           input.analysisResult IS Error
           OR input.analysisResult.pair IS falsy
           OR input.analysisResult.pair = 'UNK'
         )
END FUNCTION
```

### Exemplos

- Usuário digita "BTCUSDT" no campo Par, faz upload de imagem com gráfico ilegível → IA retorna `pair: null` → campo Par é limpo para '' (esperado: manter "BTCUSDT")
- Usuário digita "ETHUSDT" no campo Par, faz upload de imagem → IA retorna `pair: 'UNK'` → campo Par é limpo para '' (esperado: manter "ETHUSDT")
- Usuário digita "SOLUSDT" no campo Par, faz upload de imagem → análise lança exceção de rede → campo Par é limpo para '' (esperado: manter "SOLUSDT")
- Usuário digita "ADAUSDT" no campo Par, faz upload de imagem → IA retorna `pair: 'BTCUSDT'` → campo Par é atualizado para "BTCUSDT" (comportamento correto, não é bug)

## Comportamento Esperado

### Requisitos de Preservação

**Comportamentos Inalterados:**
- Quando a IA detecta um par válido (não falsy e diferente de 'UNK'), o campo "Par" deve continuar sendo atualizado com o par detectado
- A detecção e atualização do campo de exchange deve continuar funcionando normalmente
- A detecção e atualização do campo de timeframe deve continuar funcionando normalmente
- O fluxo de fetch de dados das exchanges (Binance, Bybit, Bitget, OKX) deve continuar sendo executado quando um par válido é detectado
- O estado `isScanning` deve continuar sendo gerenciado corretamente (true durante análise, false ao final)

**Escopo:**
Todos os inputs onde a IA detecta com sucesso um par válido devem ser completamente não afetados por esta correção. Isso inclui:
- Upload de imagem onde a IA retorna um par válido (não falsy e diferente de 'UNK')
- Atualização de exchange baseada na análise
- Atualização de timeframe baseada na análise
- Fetch de dados das exchanges quando par é detectado

## Causa Raiz Hipotética

Com base na análise do código, a causa raiz é clara e direta:

1. **Chamada explícita de `setSelectedPair('')` no branch else**: Na linha onde `unifiedResult.pair` é falsy ou igual a 'UNK', o código executa `setSelectedPair('')` incondicionalmente, sem verificar se já existe um valor no campo. Isso apaga qualquer valor previamente digitado pelo usuário.

2. **Chamada explícita de `setSelectedPair('')` no bloco catch**: Quando a análise lança uma exceção, o bloco catch executa `setSelectedPair('')` incondicionalmente, novamente sem verificar se já existe um valor no campo.

3. **Lógica de design original**: O código foi provavelmente escrito com a premissa de que o campo Par deveria sempre refletir o resultado da IA, sem considerar o cenário onde o usuário já havia preenchido o campo manualmente antes do upload.

## Propriedades de Corretude

Property 1: Bug Condition - Preservação do Par Existente em Falha de Detecção

_Para qualquer_ input onde a condição do bug é verdadeira (isBugCondition retorna true), a função handleFileChange corrigida DEVERÁ preservar o valor existente no campo "Par" (`selectedPair`) sem alterá-lo, mantendo o valor que o usuário digitou manualmente.

**Valida: Requisitos 2.1, 2.2**

Property 2: Preservation - Atualização do Par em Detecção Bem-Sucedida

_Para qualquer_ input onde a condição do bug NÃO é verdadeira (isBugCondition retorna false), a função corrigida DEVERÁ produzir o mesmo resultado que a função original, preservando a atualização do campo "Par" com o par detectado pela IA e mantendo o comportamento de exchange, timeframe e fetch de dados inalterado.

**Valida: Requisitos 3.1, 3.2, 3.3, 3.4**

## Implementação do Fix

### Alterações Necessárias

Assumindo que nossa análise de causa raiz está correta:

**Arquivo**: `G-nesis-2.0-main/pages/GenesisPage.tsx`

**Função**: `handleFileChange`

**Alterações Específicas**:

1. **Remover `setSelectedPair('')` do branch else**: Remover a linha `setSelectedPair('')` que está dentro do bloco `else` da verificação `if (unifiedResult.pair && unifiedResult.pair !== 'UNK')`. Quando a IA não detecta o par, simplesmente não fazer nada com o campo "Par".

2. **Remover `setSelectedPair('')` do bloco catch**: Remover a linha `setSelectedPair('')` que está dentro do bloco `catch`. Quando ocorre um erro na análise, preservar o valor existente no campo "Par".

3. **Manter o branch else vazio ou removê-lo**: O bloco `else` pode ser removido completamente ou mantido vazio, já que não há mais ação a ser executada quando o par não é detectado.

**Código antes:**
```typescript
if (unifiedResult.pair && unifiedResult.pair !== 'UNK') {
  const cleanPair = normalizarPar(unifiedResult.pair);
  newPair = cleanPair;
  setSelectedPair(cleanPair);
  setRefreshTrigger((prev) => prev + 1);
} else {
  setSelectedPair('');  // ← REMOVER
}
```

**Código depois:**
```typescript
if (unifiedResult.pair && unifiedResult.pair !== 'UNK') {
  const cleanPair = normalizarPar(unifiedResult.pair);
  newPair = cleanPair;
  setSelectedPair(cleanPair);
  setRefreshTrigger((prev) => prev + 1);
}
```

**Bloco catch antes:**
```typescript
} catch (err: any) {
  console.error('Auto-scan failed', err);
  setSelectedPair('');  // ← REMOVER
  alert('Não foi possível detectar automaticamente a moeda do gráfico. Por favor, digite manualmente no campo Par.');
}
```

**Bloco catch depois:**
```typescript
} catch (err: any) {
  console.error('Auto-scan failed', err);
  alert('Não foi possível detectar automaticamente a moeda do gráfico. Por favor, digite manualmente no campo Par.');
}
```

## Estratégia de Testes

### Abordagem de Validação

A estratégia de testes segue uma abordagem em duas fases: primeiro, evidenciar contraexemplos que demonstram o bug no código não corrigido, depois verificar que a correção funciona e preserva o comportamento existente.

### Verificação Exploratória da Condição do Bug

**Objetivo**: Evidenciar contraexemplos que demonstram o bug ANTES de implementar a correção. Confirmar ou refutar a análise de causa raiz. Se refutarmos, precisaremos re-hipotizar.

**Plano de Teste**: Escrever testes que simulam o upload de arquivo com diferentes resultados da análise de IA, verificando o estado de `selectedPair` após a execução. Executar estes testes no código NÃO CORRIGIDO para observar falhas.

**Casos de Teste**:
1. **Par existente + IA retorna null**: Simular upload com `selectedPair = 'BTCUSDT'` e `unifiedChartAnalysis` retornando `pair: null` (vai falhar no código não corrigido)
2. **Par existente + IA retorna 'UNK'**: Simular upload com `selectedPair = 'ETHUSDT'` e `unifiedChartAnalysis` retornando `pair: 'UNK'` (vai falhar no código não corrigido)
3. **Par existente + exceção na análise**: Simular upload com `selectedPair = 'SOLUSDT'` e `unifiedChartAnalysis` lançando erro (vai falhar no código não corrigido)
4. **Par vazio + IA retorna null**: Simular upload com `selectedPair = ''` e `unifiedChartAnalysis` retornando `pair: null` (pode não falhar, pois o campo já está vazio)

**Contraexemplos Esperados**:
- O valor de `selectedPair` é resetado para '' quando deveria manter o valor existente
- Causas possíveis: chamadas explícitas de `setSelectedPair('')` nos branches else e catch

### Verificação do Fix

**Objetivo**: Verificar que para todos os inputs onde a condição do bug é verdadeira, a função corrigida produz o comportamento esperado.

**Pseudocódigo:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleFileChange_fixed(input)
  ASSERT selectedPair = input.existingPair
END FOR
```

### Verificação de Preservação

**Objetivo**: Verificar que para todos os inputs onde a condição do bug NÃO é verdadeira, a função corrigida produz o mesmo resultado que a função original.

**Pseudocódigo:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleFileChange_original(input) = handleFileChange_fixed(input)
END FOR
```

**Abordagem de Teste**: Testes baseados em propriedades são recomendados para verificação de preservação porque:
- Geram muitos casos de teste automaticamente em todo o domínio de entrada
- Capturam casos extremos que testes unitários manuais podem perder
- Fornecem garantias fortes de que o comportamento é inalterado para todos os inputs não-bugados

**Plano de Teste**: Observar o comportamento no código NÃO CORRIGIDO primeiro para uploads com par válido detectado, depois escrever testes baseados em propriedades capturando esse comportamento.

**Casos de Teste**:
1. **Preservação de atualização de par válido**: Verificar que quando a IA detecta um par válido, o campo é atualizado corretamente tanto antes quanto depois da correção
2. **Preservação de atualização de exchange**: Verificar que a detecção de exchange continua funcionando após a correção
3. **Preservação de atualização de timeframe**: Verificar que a detecção de timeframe continua funcionando após a correção
4. **Preservação de fetch de dados**: Verificar que o fetch de dados das exchanges continua sendo executado quando par válido é detectado

### Testes Unitários

- Testar que `selectedPair` é preservado quando `unifiedChartAnalysis` retorna par falsy
- Testar que `selectedPair` é preservado quando `unifiedChartAnalysis` retorna 'UNK'
- Testar que `selectedPair` é preservado quando `unifiedChartAnalysis` lança exceção
- Testar que `selectedPair` é atualizado quando `unifiedChartAnalysis` retorna par válido
- Testar caso extremo: campo Par vazio + análise falha (deve permanecer vazio)

### Testes Baseados em Propriedades

- Gerar pares aleatórios como valor existente e verificar preservação quando análise falha
- Gerar resultados aleatórios de análise com par válido e verificar que atualização funciona
- Gerar combinações aleatórias de estado (par existente/vazio × resultado da análise) e verificar comportamento correto em todos os cenários

### Testes de Integração

- Testar fluxo completo de upload com par pré-preenchido e análise falhando
- Testar fluxo completo de upload com par pré-preenchido e análise detectando novo par
- Testar que o alerta de erro ainda é exibido quando análise falha (comportamento do catch preservado)
