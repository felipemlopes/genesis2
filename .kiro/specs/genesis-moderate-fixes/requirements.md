# Documento de Requisitos — Genesis Moderate Fixes

## Introdução

Este documento especifica os requisitos para correção de 4 problemas de severidade moderada na arquitetura de análise do Genesis Labs. Os problemas afetam: persistência de estado do Radar Geopolítico, cálculo de confluência com EMAs, modelo de IA para leitura visual, e cálculo da Signal Line do MACD.

## Glossário

- **Radar_Geopolítico**: Componente `GeopoliticalRadar.tsx` que monitora eventos geopolíticos em tempo real e exibe no mapa
- **GeoEngine**: Serviço singleton `GeopoliticalEngine` que busca, processa e distribui eventos geopolíticos via padrão pub/sub
- **Scoring_Engine**: Motor de pontuação que calcula score de confluência técnica usando indicadores (EMAs, RSI, ADX, MACD)
- **EMA**: Exponential Moving Average — média móvel exponencial com período configurável
- **Signal_Line**: Linha de sinal do MACD, calculada como EMA de 9 períodos da série histórica da MACD Line
- **MACD_Line**: Diferença entre EMA(12) e EMA(26) dos preços de fechamento
- **Leitura_Visual**: Processo de análise de imagem de gráfico via modelo de IA generativa (Gemini)
- **AdaptedDataFetcher**: Serviço `adaptedDataFetcher.ts` que busca dados de mercado e calcula indicadores técnicos
- **DadosScore**: Estrutura de dados que alimenta o Scoring_Engine com valores de indicadores para cálculo de confluência

## Requisitos

### Requisito 1: Persistência de Estado do Radar Geopolítico

**User Story:** Como trader, eu quero que o estado on/off do Radar Geopolítico seja preservado ao navegar entre abas, para que eu não precise reativar manualmente toda vez que volto à tela do radar.

#### Critérios de Aceitação

1. WHEN o usuário ativa ou desativa o Radar_Geopolítico, THE Radar_Geopolítico SHALL persistir o estado (ativo/inativo) em localStorage imediatamente
2. WHEN o componente Radar_Geopolítico é montado, THE Radar_Geopolítico SHALL restaurar o estado on/off previamente salvo em localStorage
3. WHILE o Radar_Geopolítico está ativo e o componente é desmontado por navegação, THE GeoEngine SHALL continuar executando independentemente do ciclo de vida do componente
4. WHEN o componente Radar_Geopolítico é remontado com estado salvo "ativo", THE Radar_Geopolítico SHALL reconectar ao GeoEngine e exibir os eventos acumulados durante a ausência
5. IF localStorage não contém estado salvo do Radar_Geopolítico, THEN THE Radar_Geopolítico SHALL iniciar no estado desativado (comportamento padrão atual)

### Requisito 2: Migração do GeoEngine para Contexto Global

**User Story:** Como desenvolvedor, eu quero que o GeoEngine viva fora do componente React, para que o motor geopolítico sobreviva a unmounts e mantenha dados consistentes entre navegações.

#### Critérios de Aceitação

1. THE GeoEngine SHALL ser gerenciado por um Context Provider (ou equivalente) no nível raiz da aplicação, independente do componente Radar_Geopolítico
2. WHEN o GeoEngine é iniciado via Context, THE GeoEngine SHALL manter sua execução até ser explicitamente parado pelo usuário, independente de montagem/desmontagem de componentes
3. WHEN qualquer componente se inscreve no GeoEngine via Context, THE GeoEngine SHALL fornecer o estado atual completo (eventos acumulados, status de scanning) imediatamente
4. WHILE o GeoEngine está ativo no Context, THE GeoEngine SHALL acumular eventos mesmo sem nenhum componente inscrito renderizado

### Requisito 3: Scoring com EMAs Dinâmicas do Gráfico

**User Story:** Como trader, eu quero que o score de confluência use as EMAs que eu realmente tenho no meu gráfico, para que a avaliação de "preço acima/abaixo das EMAs" reflita minha configuração real.

#### Critérios de Aceitação

1. WHEN o AdaptedDataFetcher detecta EMAs visíveis no gráfico do usuário (via leitura visual), THE Scoring_Engine SHALL usar essas EMAs detectadas como fonte primária para cálculo de confluência
2. IF nenhuma EMA é detectada no gráfico do usuário, THEN THE Scoring_Engine SHALL calcular EMAs 21, 50 e 200 como referência secundária (comportamento atual como fallback)
3. WHEN EMAs dinâmicas do gráfico são usadas no scoring, THE DadosScore SHALL mapear os campos `ema21`, `ema50`, `ema200` para as EMAs detectadas mais próximas em período (curta, média, longa)
4. THE Scoring_Engine SHALL classificar EMAs detectadas em 3 categorias: curta (período ≤ 25), média (período 26-100), longa (período > 100)
5. WHEN múltiplas EMAs da mesma categoria são detectadas, THE Scoring_Engine SHALL usar a de menor período como representante da categoria para o scoring
6. THE AdaptedDataFetcher SHALL calcular o campo `emaSubindo` (tendência) usando a EMA dinâmica selecionada, comparando valor atual com valor do candle anterior

### Requisito 4: Modelo Adequado para Leitura Visual

**User Story:** Como trader, eu quero que a leitura visual do gráfico (identificação de figuras, padrões de candle, indicadores visuais) use o modelo de IA com maior precisão visual, para que a detecção de padrões seja confiável.

#### Critérios de Aceitação

1. THE Leitura_Visual de análise de gráfico (identificação de padrões, figuras, candles) SHALL usar o modelo `gemini-2.5-pro-preview-05-06` para máxima precisão visual
2. WHEN tarefas puramente textuais são executadas (síntese, formatação, geração de texto sem imagem), THE Sistema SHALL usar o modelo `gemini-2.0-flash` para eficiência
3. IF o modelo `gemini-2.5-pro-preview-05-06` retorna erro ou timeout, THEN THE Leitura_Visual SHALL fazer fallback para `gemini-2.0-flash` com log de aviso

### Requisito 5: Cálculo Correto da Signal Line do MACD

**User Story:** Como trader, eu quero que a Signal Line do MACD seja calculada corretamente como EMA(9) da série histórica da MACD Line, para que os sinais de cruzamento MACD/Signal sejam confiáveis.

#### Critérios de Aceitação

1. THE AdaptedDataFetcher SHALL calcular a Signal_Line como EMA de 9 períodos aplicada sobre a série histórica completa da MACD_Line (não como multiplicação por constante)
2. WHEN o AdaptedDataFetcher calcula o MACD, THE AdaptedDataFetcher SHALL primeiro gerar a série histórica da MACD_Line para os últimos N candles disponíveis, e então aplicar EMA(9) sobre essa série
3. THE AdaptedDataFetcher SHALL calcular o histograma MACD como a diferença entre MACD_Line e Signal_Line calculada corretamente
4. IF o número de candles disponíveis é inferior a 35 (26 para EMA slow + 9 para Signal EMA), THEN THE AdaptedDataFetcher SHALL retornar fallback para leitura visual (OCR) ou INDISPONIVEL
5. FOR ALL séries de preços válidas, formatar e re-parsear o resultado do MACD SHALL produzir valores equivalentes (propriedade round-trip de consistência numérica)

### Requisito 6: Preservação de Comportamento Existente

**User Story:** Como desenvolvedor, eu quero garantir que as correções não introduzam regressões nos fluxos existentes que funcionam corretamente.

#### Critérios de Aceitação

1. WHILE o Radar_Geopolítico está desativado, THE GeoEngine SHALL permanecer parado e não consumir recursos (polling, API calls)
2. THE Scoring_Engine SHALL manter a escala de score 0-100 e a mesma lógica de flags independente da fonte das EMAs (dinâmicas ou fixas)
3. WHEN indicadores não-EMA (RSI, Bollinger, ADX, ATR) são calculados, THE AdaptedDataFetcher SHALL manter o comportamento atual sem alterações
4. THE AdaptedDataFetcher SHALL manter o fallback para leitura visual (OCR) quando cálculo via API falha, para todos os indicadores incluindo MACD
5. WHEN o MACD é calculado com dados suficientes (≥ 35 candles), THE AdaptedDataFetcher SHALL retornar objeto com campos `linha_macd`, `linha_sinal` e histograma implícito, mantendo interface compatível com consumidores downstream
