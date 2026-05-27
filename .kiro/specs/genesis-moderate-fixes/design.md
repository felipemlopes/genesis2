# Design — Genesis Moderate Fixes

## Visão Geral

Este design aborda 4 correções de severidade moderada na plataforma Genesis Labs:

1. **Radar Geopolítico perde estado** — Migrar estado on/off para localStorage + GeoEngine para Context Provider
2. **EMAs fixas contaminam scoring** — Usar EMAs detectadas no gráfico como primárias, fixas como fallback
3. **Leitura visual usa modelo fraco** — Usar `gemini-2.5-pro-preview-05-06` para tarefas visuais
4. **Signal Line do MACD calculada errada** — Substituir `macdLine * 0.9` por EMA(9) da série MACD

## Arquitetura

### Diagrama de Componentes Afetados

```mermaid
graph TD
    subgraph "Contexto Global (Root)"
        GeoCtx[GeoEngineContext Provider]
        GeoEng[GeopoliticalEngine singleton]
    end

    subgraph "Componentes UI"
        Radar[GeopoliticalRadar.tsx]
        Alert[GlobalGeopoliticalAlert.tsx]
    end

    subgraph "Serviços de Dados"
        ADF[adaptedDataFetcher.ts]
        IE[indicatorEngine.ts]
        GS[geminiService.ts]
    end

    subgraph "Motor de Scoring"
        SE[scoringEngine.ts]
        EMAClass[EMA Classifier]
    end

    GeoCtx --> GeoEng
    Radar -->|useGeoEngine()| GeoCtx
    Alert -->|useGeoEngine()| GeoCtx
    ADF -->|EMAs detectadas| EMAClass
    EMAClass -->|curta/média/longa| SE
    ADF -->|MACD corrigido| SE
    GS -->|modelo pro para visual| ADF
```

### Decisões de Design

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Onde vive o GeoEngine | Context Provider em `contexts/` | Segue padrão existente (`AppContext.tsx`), engine sobrevive a unmounts |
| Persistência do estado | localStorage com chave `genesis_geo_radar_active` | Simples, síncrono, já usado no projeto |
| Classificação de EMAs | 3 faixas fixas (≤25, 26-100, >100) | Cobre os cenários comuns de curta/média/longa prazo |
| Modelo para visual | `gemini-2.5-pro-preview-05-06` | Maior precisão em análise de imagem; flash como fallback |
| Cálculo MACD | Usar `_calcularMACD` do indicatorEngine | Já implementa EMA(9) corretamente; o bug está no adaptedDataFetcher |

## Componentes e Interfaces

### 1. GeoEngineContext (`contexts/GeoEngineContext.tsx`)

Novo Context Provider que gerencia o ciclo de vida do GeoEngine.

```typescript
interface GeoEngineContextType {
  events: GeoEvent[];
  isScanning: boolean;
  chaosScore: number;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}
```

**Responsabilidades:**
- Manter referência ao singleton `geoEngine`
- Persistir/restaurar estado on/off via localStorage
- Expor estado reativo (events, isScanning) para consumidores
- Iniciar engine automaticamente se localStorage indica "ativo"

### 2. GeopoliticalRadar.tsx (Refatorado)

Remove lógica de estado própria e consome do contexto:
- Remove `useState(false)` para `isScanning`
- Usa `useGeoEngine()` para obter estado e controles
- Mantém lógica de UI (filtros, tour, mapa) inalterada

### 3. adaptedDataFetcher.ts — MACD Corrigido

Substitui o bloco de cálculo MACD inline:

```typescript
// ANTES (bug):
const macdLine = emaFast - emaSlow;
const signalLine = macdLine * 0.9; // ❌ Errado

// DEPOIS (correto):
// Usa calcularMACD do indicatorEngine que já faz EMA(9) da série
const macdResult = calcularMACD(candlesForIE);
if (macdResult) {
  calculado = { linha_macd: macdResult.macd, linha_sinal: macdResult.signal };
}
```

### 4. adaptedDataFetcher.ts — EMAs Dinâmicas

Nova função de classificação e seleção de EMAs:

```typescript
interface EMADetectada {
  periodo: number;
  valor: number;
}

interface EMAsClassificadas {
  curta: EMADetectada | null;   // período ≤ 25
  media: EMADetectada | null;   // período 26-100
  longa: EMADetectada | null;   // período > 100
}

function classificarEMAs(emas: EMADetectada[]): EMAsClassificadas;
```

### 5. geminiService.ts — Seleção de Modelo

O serviço já delega para o backend Laravel via `/api/v1/unified-scan` e `/api/v1/analyze`. A mudança de modelo é configurada no backend. No frontend, adicionamos fallback:

```typescript
// Se o backend retorna erro 503/timeout na leitura visual,
// retry com parâmetro model=flash
```

## Modelos de Dados

### localStorage Keys

| Chave | Tipo | Descrição |
|-------|------|-----------|
| `genesis_geo_radar_active` | `"true" \| "false"` | Estado on/off do radar |

### EMA Classification Input/Output

```typescript
// Input: EMAs detectadas pela leitura visual
type DetectedEMA = { periodo: number; valor: number };

// Output: Mapeamento para campos do DadosScore
type EMAsParaScore = {
  ema21: number | undefined;  // representante curta
  ema50: number | undefined;  // representante média
  ema200: number | undefined; // representante longa
  ema21Subindo: boolean;
  ema50Subindo: boolean;
  ema200Subindo: boolean;
};
```

### MACD Output (mantém interface existente)

```typescript
interface MACDResult {
  linha_macd: number;
  linha_sinal: number;  // Agora = EMA(9) da série MACD, não macdLine * 0.9
}
```

## Propriedades de Corretude

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema — essencialmente, uma declaração formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis por humanos e garantias de corretude verificáveis por máquina.*

### Propriedade 1: Round-trip do estado do Radar

*Para qualquer* valor booleano de estado (ativo/inativo), persistir o estado em localStorage e então restaurá-lo em uma nova montagem do componente deve produzir o mesmo valor original.

**Valida: Requisitos 1.1, 1.2**

### Propriedade 2: Engine sobrevive a unmount

*Para qualquer* instância do GeoEngine que está ativa, desmontar todos os componentes consumidores não deve alterar o estado `isActive()` do engine — ele deve continuar reportando `true`.

**Valida: Requisitos 1.3, 2.2**

### Propriedade 3: Eventos acumulados entregues ao subscriber

*Para qualquer* sequência de eventos processados pelo GeoEngine enquanto nenhum componente está inscrito, ao se inscrever novamente, o subscriber deve receber todos os eventos acumulados imediatamente.

**Valida: Requisitos 1.4, 2.3, 2.4**

### Propriedade 4: Classificação e seleção de EMAs

*Para qualquer* lista de EMAs com períodos positivos, a função de classificação deve: (a) categorizar cada EMA corretamente (curta ≤ 25, média 26-100, longa > 100), e (b) selecionar a de menor período como representante quando há múltiplas na mesma categoria.

**Valida: Requisitos 3.3, 3.4, 3.5**

### Propriedade 5: EMAs dinâmicas como fonte primária

*Para qualquer* conjunto de EMAs detectadas no gráfico (não vazio), o DadosScore deve usar os valores dessas EMAs classificadas ao invés de calcular EMAs fixas 21/50/200.

**Valida: Requisito 3.1**

### Propriedade 6: Tendência EMA (emaSubindo)

*Para qualquer* série de candles e período de EMA, o campo `emaSubindo` deve ser `true` se e somente se o valor da EMA calculada sobre a série completa é maior que o valor da EMA calculada sobre a série sem o último candle.

**Valida: Requisito 3.6**

### Propriedade 7: Fallback de modelo em erro

*Para qualquer* erro ou timeout retornado pelo modelo `gemini-2.5-pro-preview-05-06`, o sistema deve fazer fallback para `gemini-2.0-flash` e registrar um log de aviso, sem propagar o erro ao usuário.

**Valida: Requisito 4.3**

### Propriedade 8: Signal Line = EMA(9) da série MACD

*Para qualquer* série de preços com ≥ 35 candles, a Signal Line calculada deve ser igual à EMA de 9 períodos aplicada sobre a série histórica da MACD Line (EMA12 - EMA26), e não uma multiplicação por constante.

**Valida: Requisitos 5.1, 5.2**

### Propriedade 9: Invariante do histograma MACD

*Para qualquer* resultado de cálculo MACD, o valor do histograma deve ser exatamente igual a `MACD_Line - Signal_Line`.

**Valida: Requisito 5.3**

### Propriedade 10: Round-trip numérico do MACD

*Para qualquer* série de preços válida, formatar o resultado do MACD como JSON e re-parsear deve produzir valores numericamente equivalentes (diferença < 1e-10).

**Valida: Requisito 5.5**

### Propriedade 11: Score sempre no intervalo 0-100

*Para qualquer* DadosScore válido (com EMAs dinâmicas ou fixas), o `scoreFinal` retornado pelo Scoring Engine deve estar no intervalo [0, 100].

**Valida: Requisito 6.2**

### Propriedade 12: Fallback para OCR em falha de cálculo

*Para qualquer* indicador cujo cálculo via API falha (dados insuficientes ou erro), o sistema deve tentar fallback para leitura visual (OCR) antes de retornar INDISPONIVEL.

**Valida: Requisito 6.4**

### Propriedade 13: Engine inativo quando radar desativado

*Para qualquer* estado onde o radar está desativado, o GeoEngine deve reportar `isActive() === false` e não executar polling ou chamadas de API.

**Valida: Requisito 6.1**

## Tratamento de Erros

| Cenário | Comportamento |
|---------|---------------|
| localStorage indisponível (modo privado) | Radar inicia desativado, estado não persiste entre sessões |
| Modelo pro retorna 503/timeout | Fallback para flash com log de aviso |
| Menos de 35 candles para MACD | Retorna `null`, fallback para OCR |
| Nenhuma EMA detectada no gráfico | Usa EMAs fixas 21/50/200 (comportamento atual) |
| GeoEngine falha ao buscar eventos | Retry com backoff (já implementado), mantém eventos anteriores |
| Erro no cálculo de qualquer indicador | Tenta fallback OCR → INDISPONIVEL |

## Estratégia de Testes

### Abordagem Dual

O projeto usará testes unitários e testes baseados em propriedades de forma complementar:

- **Testes unitários**: Exemplos específicos, edge cases, integração entre componentes
- **Testes de propriedade**: Propriedades universais verificadas com inputs gerados aleatoriamente

### Biblioteca de Property-Based Testing

- **Biblioteca**: `fast-check` (TypeScript/JavaScript)
- **Configuração**: Mínimo 100 iterações por propriedade
- **Tagging**: Cada teste deve conter comentário `// Feature: genesis-moderate-fixes, Property N: <texto>`

### Distribuição de Testes

| Propriedade | Tipo de Teste | Arquivo |
|-------------|---------------|---------|
| P1: Round-trip estado radar | Property test | `__tests__/geoEngineContext.property.test.ts` |
| P2: Engine sobrevive unmount | Property test | `__tests__/geoEngineContext.property.test.ts` |
| P3: Eventos acumulados | Property test | `__tests__/geoEngineContext.property.test.ts` |
| P4: Classificação EMAs | Property test | `__tests__/emaClassifier.property.test.ts` |
| P5: EMAs dinâmicas primárias | Property test | `__tests__/adaptedDataFetcher.property.test.ts` |
| P6: Tendência EMA | Property test | `__tests__/emaClassifier.property.test.ts` |
| P7: Fallback modelo | Unit test (mock HTTP) | `__tests__/geminiService.test.ts` |
| P8: Signal Line EMA(9) | Property test | `__tests__/macd.property.test.ts` |
| P9: Histograma invariante | Property test | `__tests__/macd.property.test.ts` |
| P10: Round-trip numérico | Property test | `__tests__/macd.property.test.ts` |
| P11: Score 0-100 | Property test | `__tests__/scoringEngine.property.test.ts` |
| P12: Fallback OCR | Unit test | `__tests__/adaptedDataFetcher.test.ts` |
| P13: Engine inativo | Property test | `__tests__/geoEngineContext.property.test.ts` |

### Testes Unitários (Exemplos e Edge Cases)

- Estado padrão quando localStorage vazio (edge case 1.5)
- Fallback EMAs 21/50/200 quando nenhuma detectada (edge case 3.2)
- MACD com exatamente 34 candles retorna null (edge case 5.4)
- MACD com exatamente 35 candles retorna resultado válido
- Modelo correto usado para tarefa visual vs textual (exemplos 4.1, 4.2)

### Requisitos para Testes de Propriedade

- Cada propriedade de corretude DEVE ser implementada por UM ÚNICO teste de propriedade
- Mínimo 100 iterações por teste (configuração do fast-check)
- Cada teste DEVE conter tag: `// Feature: genesis-moderate-fixes, Property {N}: {texto}`
