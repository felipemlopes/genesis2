# Documento de Requisitos do Bugfix

## Introdução

Quando o usuário faz upload de uma imagem para análise na GenesisPage, o campo "Par" (`selectedPair`) é indevidamente limpo (resetado para string vazia) nos casos em que a IA não consegue detectar o par a partir da imagem ou quando ocorre um erro durante a análise. Isso apaga o valor que o usuário já havia digitado manualmente, forçando-o a redigitar a informação.

## Análise do Bug

### Comportamento Atual (Defeito)

1.1 QUANDO o usuário já possui um valor no campo "Par" E faz upload de uma imagem E a análise unificada (`unifiedChartAnalysis`) retorna um resultado onde `pair` é falsy ou igual a 'UNK' ENTÃO o sistema limpa o campo "Par" para string vazia, apagando o valor previamente digitado pelo usuário

1.2 QUANDO o usuário já possui um valor no campo "Par" E faz upload de uma imagem E a análise unificada (`unifiedChartAnalysis`) lança um erro/exceção ENTÃO o sistema limpa o campo "Par" para string vazia, apagando o valor previamente digitado pelo usuário

### Comportamento Esperado (Correto)

2.1 QUANDO o usuário já possui um valor no campo "Par" E faz upload de uma imagem E a análise unificada retorna um resultado onde `pair` é falsy ou igual a 'UNK' ENTÃO o sistema DEVERÁ preservar o valor existente no campo "Par" sem alterá-lo

2.2 QUANDO o usuário já possui um valor no campo "Par" E faz upload de uma imagem E a análise unificada lança um erro/exceção ENTÃO o sistema DEVERÁ preservar o valor existente no campo "Par" sem alterá-lo

2.3 QUANDO o campo "Par" está vazio E faz upload de uma imagem E a análise unificada retorna um par válido (não falsy e diferente de 'UNK') ENTÃO o sistema DEVERÁ preencher o campo "Par" com o par detectado pela IA

### Comportamento Inalterado (Prevenção de Regressão)

3.1 QUANDO o usuário faz upload de uma imagem E a análise unificada detecta um par válido (não falsy e diferente de 'UNK') ENTÃO o sistema DEVERÁ CONTINUAR A atualizar o campo "Par" com o par detectado pela IA

3.2 QUANDO o usuário faz upload de uma imagem E a análise unificada detecta a exchange corretamente ENTÃO o sistema DEVERÁ CONTINUAR A atualizar o campo de exchange normalmente

3.3 QUANDO o usuário faz upload de uma imagem E a análise unificada detecta o timeframe corretamente ENTÃO o sistema DEVERÁ CONTINUAR A atualizar o campo de timeframe normalmente

3.4 QUANDO o usuário não possui valor no campo "Par" E faz upload de uma imagem E a análise não detecta o par ENTÃO o sistema DEVERÁ CONTINUAR A manter o campo "Par" vazio (sem alteração)

---

## Derivação da Condição do Bug

### Função de Condição do Bug

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type UploadEvent { existingPair: string, analysisResult: AnalysisResult | Error }
  OUTPUT: boolean
  
  // Retorna true quando o usuário já tem um par digitado E a análise falha em detectar o par
  RETURN X.existingPair != '' AND (
    X.analysisResult IS Error OR
    X.analysisResult.pair IS falsy OR
    X.analysisResult.pair = 'UNK'
  )
END FUNCTION
```

### Especificação da Propriedade - Verificação do Fix

```pascal
// Propriedade: Verificação do Fix - Preservação do par existente
FOR ALL X WHERE isBugCondition(X) DO
  result ← handleFileChange'(X)
  ASSERT selectedPair = X.existingPair
END FOR
```

### Objetivo de Preservação

```pascal
// Propriedade: Verificação de Preservação
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT handleFileChange(X) = handleFileChange'(X)
END FOR
```

Isso garante que para todos os inputs não-bugados (quando a IA detecta o par com sucesso), o código corrigido se comporta de forma idêntica ao original.
