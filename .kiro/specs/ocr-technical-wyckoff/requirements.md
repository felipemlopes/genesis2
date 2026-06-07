# Documento de Requisitos — OCR Visual, TechnicalAnalysis e Wyckoff Completo

## Introdução

Este documento especifica os requisitos para três áreas de alta prioridade do sistema Genesis de análise de trading:

1. **Etapa 2 — OCR Visual**: Remoção do método legado `extrairIndicadoresOCR()`, atualização do prompt de `extrairElementosVisuais()` com extração expandida (padrões gráficos, indicadores visuais como VRVP, Order Blocks SMC, CMF, Estocástico), migração para modelo gemini-3.5-flash e aplicação de regras de linguagem.

2. **Etapa 5a — TechnicalAnalysisService**: Implementação de Volume Profile (POC, HVN, LVN), detecção de padrões de candle, cálculo de divergência CVD e correção do multi-timeframe para usar RSI + EMA50 + EMA200.

3. **Etapa 5b — Wyckoff Completo**: Substituição da detecção primitiva de Wyckoff por implementação completa com 9 fases, 7 eventos, identificação de range e geração de narrativa em português.

## Glossário

- **GeminiAnalysisService**: Serviço orquestrador principal que coordena análise via API Gemini, OCR visual e cálculos técnicos
- **TechnicalAnalysisService**: Serviço responsável por cálculos de indicadores técnicos (EMA, RSI, ADX, MACD, ATR, Bollinger, Wyckoff)
- **MotorExecucaoService**: Serviço que recebe dados calculados (POC, HVN, LVN) e gera setups de execução
- **OCR_Visual**: Subsistema de extração de elementos visuais de imagens de gráficos via Gemini Vision
- **Volume_Profile**: Distribuição de volume por faixa de preço, identificando POC (Point of Control), HVN (High Volume Nodes) e LVN (Low Volume Nodes)
- **POC**: Point of Control — faixa de preço com maior volume negociado
- **HVN**: High Volume Nodes — faixas de preço com volume significativamente acima da média
- **LVN**: Low Volume Nodes — faixas de preço com volume significativamente abaixo da média (gaps de liquidez)
- **CVD**: Cumulative Volume Delta — volume acumulado ponderado pela direção (compra vs venda)
- **Wyckoff**: Metodologia de análise técnica que identifica fases de acumulação/distribuição institucional
- **Spring**: Evento Wyckoff onde preço rompe suporte brevemente com volume baixo e retorna rapidamente
- **UAT**: Upthrust After Distribution — evento Wyckoff onde preço rompe resistência brevemente e retorna
- **VRVP**: Volume Range Visible Profile — indicador visual de distribuição de volume por preço
- **Order_Blocks_SMC**: Blocos de ordens institucionais identificáveis no gráfico (Smart Money Concepts)
- **CMF**: Chaikin Money Flow — indicador de pressão de compra/venda
- **Candles**: Array de dados OHLCV onde cada elemento é [timestamp, open, high, low, close, volume]

## Requisitos

### Requisito 1: Remoção do OCR de Indicadores Numéricos

**User Story:** Como desenvolvedor do Genesis, quero remover o método legado `extrairIndicadoresOCR()`, para que o sistema não dependa de leitura visual imprecisa de valores numéricos de indicadores.

#### Critérios de Aceitação

1. WHEN o GeminiAnalysisService processar uma análise, THE GeminiAnalysisService SHALL executar sem invocar o método `extrairIndicadoresOCR()`
2. THE GeminiAnalysisService SHALL não conter o método `extrairIndicadoresOCR()` no código fonte
3. THE GeminiAnalysisService SHALL não conter a chamada ao método `extrairIndicadoresOCR()` nas linhas de orquestração (anteriormente linhas 57-67)
4. WHEN indicadores técnicos forem necessários, THE TechnicalAnalysisService SHALL calculá-los exclusivamente via dados da API (candles OHLCV)

### Requisito 2: Atualização do Prompt de Extração Visual

**User Story:** Como analista de trading, quero que a extração visual identifique padrões gráficos e indicadores visuais avançados, para que a análise considere elementos desenhados no gráfico com maior abrangência.

#### Critérios de Aceitação

1. WHEN uma imagem de gráfico for processada, THE OCR_Visual SHALL extrair suportes, resistências, linhas de tendência, fibonacci e anotações (funcionalidade existente)
2. WHEN uma imagem de gráfico for processada, THE OCR_Visual SHALL extrair padrões gráficos identificáveis (`padroes_graficos`)
3. WHEN uma imagem de gráfico for processada, THE OCR_Visual SHALL extrair indicadores visuais presentes incluindo VRVP, Order Blocks SMC, CMF e Estocástico (`indicadores_visiveis`)
4. THE OCR_Visual SHALL utilizar o modelo "gemini-3.5-flash" para processamento de imagens
5. THE OCR_Visual SHALL retornar resultado em formato JSON com campos: suportes, resistencias, linhas_tendencia, fibonacci, anotacoes, padroes_graficos, indicadores_visiveis

### Requisito 3: Regras de Linguagem na Extração Visual

**User Story:** Como analista de trading, quero que os textos extraídos sigam as regras de linguagem do sistema, para que a saída seja consistente e profissional.

#### Critérios de Aceitação

1. THE OCR_Visual SHALL não utilizar hífens em termos compostos na saída (usar underscore ou palavras separadas)
2. THE OCR_Visual SHALL não utilizar o termo "resistencia superior" em nenhuma saída
3. THE OCR_Visual SHALL não utilizar o termo "suporte inferior" em nenhuma saída
4. THE GeminiAnalysisService SHALL utilizar o modelo "gemini-3.5-flash" para geração de narrativa

### Requisito 4: Implementação do Volume Profile

**User Story:** Como analista de trading, quero que o sistema calcule Volume Profile a partir de candles, para que eu tenha informações de POC, HVN e LVN na análise técnica.

#### Critérios de Aceitação

1. THE TechnicalAnalysisService SHALL implementar o método `calcularVolumeProfile(array $candles, int $bins = 50)` retornando array com chaves: poc (float), hvn (array de floats), lvn (array de floats)
2. WHEN candles válidos forem fornecidos, THE TechnicalAnalysisService SHALL calcular o POC como o preço médio da faixa (bin) com maior volume acumulado
3. WHEN candles válidos forem fornecidos, THE TechnicalAnalysisService SHALL identificar HVN como faixas com volume acima de 1.5 vezes a média de volume por faixa
4. WHEN candles válidos forem fornecidos, THE TechnicalAnalysisService SHALL identificar LVN como faixas com volume abaixo de 0.5 vezes a média de volume por faixa
5. IF o array de candles contiver menos dados do que necessário para cálculo, THEN THE TechnicalAnalysisService SHALL retornar valores padrão (poc: 0, hvn: [], lvn: [])
6. THE MotorExecucaoService SHALL receber POC, HVN e LVN calculados pelo Volume Profile para cálculo de setups

### Requisito 5: Detecção de Padrões de Candle

**User Story:** Como analista de trading, quero que o sistema detecte padrões de candle automaticamente, para que padrões de reversão e continuação sejam identificados na análise técnica.

#### Critérios de Aceitação

1. THE TechnicalAnalysisService SHALL implementar o método `detectarPadraoCandle(array $candles)` retornando string com o nome do padrão detectado
2. WHEN um candle Doji for identificado (corpo menor que 10% do range total), THE TechnicalAnalysisService SHALL retornar "DOJI"
3. WHEN um candle Engolfo Altista for identificado (candle atual engolfa o anterior, fechamento acima da abertura), THE TechnicalAnalysisService SHALL retornar "ENGOLFO_ALTISTA"
4. WHEN um candle Engolfo Baixista for identificado (candle atual engolfa o anterior, fechamento abaixo da abertura), THE TechnicalAnalysisService SHALL retornar "ENGOLFO_BAIXISTA"
5. WHEN um candle Martelo for identificado (sombra inferior maior que 2x o corpo, sombra superior pequena), THE TechnicalAnalysisService SHALL retornar "MARTELO"
6. WHEN um candle Estrela Cadente for identificado (sombra superior maior que 2x o corpo, sombra inferior pequena), THE TechnicalAnalysisService SHALL retornar "ESTRELA_CADENTE"
7. WHEN um candle Pin Bar for identificado (sombra longa em uma direção representando rejeição), THE TechnicalAnalysisService SHALL retornar "PIN_BAR"
8. IF nenhum padrão for identificado, THEN THE TechnicalAnalysisService SHALL retornar "NENHUM"

### Requisito 6: Cálculo de Divergência CVD

**User Story:** Como analista de trading, quero que o sistema calcule divergência entre preço e CVD, para que eu identifique divergências de fluxo que indicam possível reversão.

#### Critérios de Aceitação

1. THE TechnicalAnalysisService SHALL implementar o método `calcularDivergenciaCVD(array $candles, array $cvdData)` retornando string "BULLISH", "BEARISH" ou "NENHUMA"
2. WHEN o preço fizer novas mínimas enquanto o CVD fizer mínimas mais altas, THE TechnicalAnalysisService SHALL retornar "BULLISH"
3. WHEN o preço fizer novas máximas enquanto o CVD fizer máximas mais baixas, THE TechnicalAnalysisService SHALL retornar "BEARISH"
4. IF não houver divergência identificável, THEN THE TechnicalAnalysisService SHALL retornar "NENHUMA"
5. IF dados de CVD forem insuficientes ou inválidos, THEN THE TechnicalAnalysisService SHALL retornar "NENHUMA"

### Requisito 7: Correção do Multi-Timeframe

**User Story:** Como analista de trading, quero que o cálculo multi-timeframe utilize RSI, EMA21, EMA50 e EMA200 para determinar bias, para que a confluência de timeframes seja mais precisa.

#### Critérios de Aceitação

1. WHEN o bias de um timeframe superior for calculado, THE GeminiAnalysisService SHALL utilizar RSI, EMA21, EMA50 e EMA200 para determinação
2. WHEN RSI estiver acima de 50 E preço estiver acima da EMA50 E preço estiver acima da EMA200, THE GeminiAnalysisService SHALL classificar o bias como "BULLISH"
3. WHEN RSI estiver abaixo de 50 E preço estiver abaixo da EMA50 E preço estiver abaixo da EMA200, THE GeminiAnalysisService SHALL classificar o bias como "BEARISH"
4. IF as condições de BULLISH ou BEARISH não forem satisfeitas completamente, THEN THE GeminiAnalysisService SHALL classificar o bias como "NEUTRO"
5. IF dados insuficientes para calcular os indicadores, THEN THE GeminiAnalysisService SHALL classificar o bias como "N/D"

### Requisito 8: Implementação Completa do Wyckoff

**User Story:** Como analista de trading, quero que o sistema detecte fases e eventos Wyckoff de forma completa, para que a análise identifique acumulação/distribuição institucional com precisão.

#### Critérios de Aceitação

1. THE TechnicalAnalysisService SHALL implementar o método `detectarWyckoff(array $candles)` aceitando apenas candles como parâmetro
2. THE TechnicalAnalysisService SHALL detectar 9 fases Wyckoff: MARKUP, MARKDOWN, ACUMULACAO_SPRING, DISTRIBUICAO_UAT, ACUMULACAO_ST, ACUMULACAO_AR, ACUMULACAO_SC, DISTRIBUICAO_RANGE, ACUMULACAO_RANGE
3. THE TechnicalAnalysisService SHALL detectar 7 eventos Wyckoff: SC (Selling Climax), AR (Automatic Rally), ST (Secondary Test), Spring, UAT (Upthrust After Distribution), SOS (Sign of Strength), SOB (Sign of Weakness)
4. THE TechnicalAnalysisService SHALL retornar array com chaves: fase (string), evento (string ou null), narrativa (string em português), gatilho (string com condição de disparo), range (array com teto e suporte)
5. WHEN um range lateral for identificado nos últimos N candles, THE TechnicalAnalysisService SHALL definir teto e suporte do range
6. WHEN volume de um candle exceder 2x a média dos últimos 20 candles com queda brusca de preço, THE TechnicalAnalysisService SHALL classificar como evento SC (Selling Climax)
7. WHEN após um SC o preço subir rapidamente com volume decrescente, THE TechnicalAnalysisService SHALL classificar como evento AR (Automatic Rally)
8. WHEN o preço retornar ao nível do SC com volume menor que o SC original, THE TechnicalAnalysisService SHALL classificar como evento ST (Secondary Test)
9. WHEN o preço romper brevemente o suporte do range com volume baixo e retornar rapidamente, THE TechnicalAnalysisService SHALL classificar como evento Spring
10. WHEN o preço romper brevemente o teto do range com volume baixo e retornar rapidamente, THE TechnicalAnalysisService SHALL classificar como evento UAT (Upthrust After Distribution)

### Requisito 9: Métodos Auxiliares do Wyckoff

**User Story:** Como desenvolvedor do Genesis, quero que o Wyckoff seja implementado com métodos auxiliares modulares, para que cada responsabilidade seja isolada e testável.

#### Critérios de Aceitação

1. THE TechnicalAnalysisService SHALL implementar `identificarRange(array $candles)` para detectar range lateral (teto e suporte)
2. THE TechnicalAnalysisService SHALL implementar `detectarEventos(array $candles, array $range)` para identificar eventos Wyckoff dentro do range
3. THE TechnicalAnalysisService SHALL implementar `classificarFase(array $eventos, array $range, float $precoAtual)` para determinar a fase Wyckoff atual
4. THE TechnicalAnalysisService SHALL implementar `gerarNarrativaWyckoff(string $fase, ?string $evento, array $range)` retornando texto descritivo em português
5. THE TechnicalAnalysisService SHALL implementar `ultimoEvento(array $eventos)` retornando o evento mais recente detectado

### Requisito 10: Integração do Wyckoff no Fluxo de Análise

**User Story:** Como analista de trading, quero que a detecção Wyckoff seja integrada no fluxo completo de análise e na narrativa, para que a informação esteja disponível no resultado final.

#### Critérios de Aceitação

1. WHEN o GeminiAnalysisService invocar detecção Wyckoff, THE GeminiAnalysisService SHALL passar o array de candles diretamente (sem EMAs separadas)
2. WHEN a narrativa for gerada via Gemini, THE GeminiAnalysisService SHALL incluir contexto Wyckoff (fase, evento, narrativa) no prompt de geração
3. THE GeminiAnalysisService SHALL incluir o campo `wyckoff` no resultado final da análise contendo fase, evento, narrativa, gatilho e range
4. IF a detecção Wyckoff falhar, THEN THE GeminiAnalysisService SHALL retornar fase "INDETERMINADO" sem interromper o fluxo de análise
