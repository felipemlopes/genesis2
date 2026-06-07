# Documento de Requisitos — Genesis Cérebro Análise

## Introdução

Este documento especifica os requisitos do pipeline completo de análise do Genesis Labs, um sistema de análise de trading de criptomoedas. O pipeline compreende: upload de gráfico → reconhecimento (par/timeframe/corretora) → OCR visual → APIs multi-exchange → indicadores técnicos → scoring → narrativa Gemini AI → motor de execução → entrega da análise. O sistema inclui também o Micro Radar (monitoramento em tempo real via WebSocket) e o Motor de Execução com dois planos operacionais.

## Glossário

- **Pipeline**: Sequência de etapas de processamento desde o upload do gráfico até a entrega final da análise
- **ScoringEngine**: Motor de pontuação que calcula o score final composto por Bloco Técnico (55pts) + Bloco Derivativos (45pts)
- **IndicatorEngine**: Módulo Python responsável pelo cálculo dos indicadores técnicos (EMA, RSI, ADX, MACD, Bollinger, ATR, VWAP, compressão)
- **MonitorWorker**: Worker Python em tempo real que monitora pares via WebSocket e dispara alertas
- **ExchangeRouter**: Serviço PHP que roteia chamadas entre exchanges (Binance, Bybit, Bitget, OKX) com fallback automático
- **GeminiAnalysisService**: Serviço PHP principal que orquestra toda a análise usando Gemini AI para gerar a narrativa
- **MotorExecucao**: Serviço que gera setups de trade matemáticos com Plano A (antecipação) e Plano B (entrada técnica)
- **MicroRadar**: Sistema independente de detecção de anomalias em tempo real com WebSocket
- **CVD**: Cumulative Volume Delta — diferença acumulada entre volume de compra e venda agressivos
- **OI**: Open Interest — contratos em aberto nos mercados de derivativos
- **Wyckoff**: Metodologia de análise técnica baseada em fases de acumulação/distribuição institucional
- **HVN**: High Volume Node — nível de preço com concentração elevada de volume negociado
- **LVN**: Low Volume Node — nível de preço com baixa concentração de volume negociado
- **POC**: Point of Control — nível de preço com maior volume negociado no Volume Profile

## Requisitos

### Requisito 1: Reconhecimento Automático de Par, Timeframe e Corretora

**User Story:** Como trader, quero que o sistema reconheça automaticamente o par, timeframe e corretora a partir da imagem do gráfico, para que eu não precise inserir manualmente esses dados.

#### Critérios de Aceitação

1. WHEN uma imagem de gráfico é enviada, THE GeminiAnalysisService SHALL extrair o par de negociação (símbolo) a partir dos elementos visuais da imagem
2. WHEN uma imagem de gráfico é enviada, THE GeminiAnalysisService SHALL identificar o timeframe ativo no gráfico
3. WHEN uma imagem de gráfico é enviada, THE ExchangeRouter SHALL detectar a corretora de origem via texto OCR presente na imagem
4. IF a corretora não for identificada na imagem, THEN THE ExchangeRouter SHALL utilizar Binance como corretora padrão

### Requisito 2: Extração Visual OCR de Elementos Desenhados

**User Story:** Como trader, quero que o sistema reconheça linhas de suporte, resistência e outros elementos desenhados no gráfico, para que minha análise visual seja incorporada ao cálculo.

#### Critérios de Aceitação

1. WHEN elementos visuais são detectados na imagem, THE GeminiAnalysisService SHALL extrair níveis de suporte desenhados pelo usuário
2. WHEN elementos visuais são detectados na imagem, THE GeminiAnalysisService SHALL extrair níveis de resistência desenhados pelo usuário
3. WHEN suportes e resistências são extraídos, THE MotorExecucao SHALL incorporar esses níveis no cálculo de stop e alvos

### Requisito 3: Suporte Multi-Exchange com Fallback Automático

**User Story:** Como trader que opera em múltiplas corretoras, quero que o sistema busque dados derivativos da minha corretora com fallback para Binance, para que a análise nunca fique sem dados.

#### Critérios de Aceitação

1. THE ExchangeRouter SHALL suportar quatro exchanges: Binance, Bybit, Bitget e OKX
2. WHEN a exchange detectada não retorna dados de OI, THE ExchangeRouter SHALL buscar OI na Binance como fallback
3. WHEN a exchange detectada não retorna funding rate, THE ExchangeRouter SHALL buscar funding rate na Binance como fallback
4. WHEN a exchange detectada retorna OI igual a zero E funding rate igual a zero, THE ExchangeRouter SHALL ativar o aviso de liquidez insuficiente e realizar fallback total para Binance
5. WHEN dados são obtidos de mais de uma fonte, THE ExchangeRouter SHALL sinalizar alerta_hibrido como verdadeiro na resposta
6. THE ExchangeRouter SHALL normalizar os formatos de resposta de cada exchange para uma estrutura unificada contendo oi, funding_rate, long_short_ratio e cvd

### Requisito 4: Persistência de OI Histórico com Variação Percentual

**User Story:** Como trader, quero que o sistema persista o Open Interest ao longo do tempo e calcule a variação percentual, para que eu saiba se posições estão sendo abertas ou fechadas.

#### Critérios de Aceitação

1. THE MonitorWorker SHALL criar a tabela oi_historico no MySQL com colunas: id, symbol, exchange, oi_valor, created_at
2. WHEN um novo valor de OI é obtido, THE MonitorWorker SHALL persistir o valor no banco de dados com timestamp
3. WHEN um novo valor de OI é obtido, THE GeminiAnalysisService SHALL calcular a variação percentual em relação ao registro anterior do mesmo par e exchange
4. WHEN o MonitorWorker é iniciado, THE MonitorWorker SHALL carregar os últimos valores de OI do banco para o cache em memória

### Requisito 5: Cálculo de Indicadores Técnicos Completo

**User Story:** Como trader, quero indicadores técnicos calculados matematicamente via API com candles brutos, para que os dados sejam precisos e não dependam apenas do OCR.

#### Critérios de Aceitação

1. THE IndicatorEngine SHALL calcular EMA com períodos 21, 50 e 200, validando que o resultado está entre 10% e 1000% do preço atual
2. THE IndicatorEngine SHALL calcular RSI com período 14, retornando valores entre 1 e 99
3. THE IndicatorEngine SHALL calcular ADX com período 14, retornando adx, di_plus e di_minus
4. THE IndicatorEngine SHALL calcular MACD com períodos 12/26/9, retornando macd, signal e histogram
5. THE IndicatorEngine SHALL calcular ATR com período 14 usando True Range
6. THE IndicatorEngine SHALL calcular Bandas de Bollinger com período 20 e 2 desvios padrão
7. THE IndicatorEngine SHALL calcular VWAP intradiário baseado no dia corrente UTC
8. THE IndicatorEngine SHALL detectar compressão de volatilidade comparando ATR de 5 períodos com ATR de 20 períodos e estreitamento de Bollinger
9. THE IndicatorEngine SHALL detectar divergência de RSI comparando topos/fundos de preço com topos/fundos de RSI nos últimos 20 candles
10. THE IndicatorEngine SHALL calcular CVD slope usando regressão linear dos últimos 10 valores do buffer CVD
11. IF o cálculo de qualquer indicador falhar, THEN THE IndicatorEngine SHALL retornar None sem propagar exceção

### Requisito 6: Detecção de Preco Subindo via EMA21

**User Story:** Como analista técnico, quero que a direção do preço seja determinada pela inclinação da EMA21 (não por comparação de 2 candles), para maior precisão direcional.

#### Critérios de Aceitação

1. WHEN EMA21 está disponível, THE MonitorWorker SHALL determinar preco_subindo comparando EMA21 atual com EMA21 do candle anterior
2. IF EMA21 não está disponível, THEN THE MonitorWorker SHALL usar fallback de comparação do preço atual com o preço do candle anterior

### Requisito 7: ADX Proporcional sem Zona Morta

**User Story:** Como trader, quero que o ADX contribua proporcionalmente ao score em vez de ter zonas mortas, para que todos os níveis de ADX informem a análise.

#### Critérios de Aceitação

1. WHEN ADX é maior ou igual a 30, THE ScoringEngine SHALL atribuir 8 pontos na direção do preço
2. WHEN ADX está entre 25 e 29, THE ScoringEngine SHALL atribuir 5 pontos na direção do preço
3. WHEN ADX está entre 20 e 24, THE ScoringEngine SHALL atribuir 3 pontos na direção do preço
4. WHEN ADX é menor que 20, THE ScoringEngine SHALL atribuir 1 ponto para ambas as direções e adicionar flag RANGING_SEM_TENDENCIA

### Requisito 8: Detecção de Cruzamento MACD pela Linha Zero

**User Story:** Como trader, quero que o cruzamento do MACD pela linha zero gere pontos extras no score, para identificar mudanças de momentum significativas.

#### Critérios de Aceitação

1. WHEN MACD cruza de negativo para positivo, THE ScoringEngine SHALL atribuir 5 pontos bullish e adicionar flag MACD_ZERO_CROSS_BULL
2. WHEN MACD cruza de positivo para negativo, THE ScoringEngine SHALL atribuir 5 pontos bearish e adicionar flag MACD_ZERO_CROSS_BEAR
3. THE MonitorWorker SHALL detectar o cruzamento comparando o valor MACD do candle atual com o valor MACD do candle anterior

### Requisito 9: Arquitetura do ScoringEngine — Técnico (55pts) + Derivativos (45pts)

**User Story:** Como trader, quero que o score final seja composto apenas por Bloco Técnico (55pts) e Bloco Derivativos (45pts), com Macro e Sentimento exibidos separadamente como flags, para ter um score limpo e acionável.

#### Critérios de Aceitação

1. THE ScoringEngine SHALL calcular o Bloco Técnico com pontuação máxima de 55 pontos, composto por: EMA200 (8pts), RSI (7pts), Divergência RSI (3pts), ADX proporcional (8pts), MACD signal (7pts), MACD zero cross (5pts), Compressão/Volatilidade (7pts)
2. THE ScoringEngine SHALL calcular o Bloco Derivativos com pontuação máxima de 45 pontos, composto por: CVD slope (10pts), Book Imbalance (5pts), Divergência CVD (10pts), Funding (8pts), OI (8pts), L/S Ratio (5pts), Clusters Liquidação (2pts por lado)
3. THE ScoringEngine SHALL calcular o score final como: 50 + (pontos_bullish - pontos_bearish) / 2, limitado ao range 0-100
4. THE ScoringEngine SHALL arredondar o score final para o múltiplo de 5 mais próximo
5. THE ScoringEngine SHALL classificar o viés em 7 níveis: LONG_FORTE (>84), LONG_MODERADO (70-84), LONG_LEVE (55-69), NEUTRO (45-54), SHORT_LEVE (31-44), SHORT_MODERADO (16-30), SHORT_FORTE (<16)
6. THE ScoringEngine SHALL gerar flags informativas de Macro e Sentimento sem incluir esses dados na pontuação principal
7. THE ScoringEngine SHALL calcular confiabilidade como ALTA quando Técnico e Derivativos concordam na direção com diferença superior a 5 pontos cada, BAIXA quando discordam, e MEDIA nos demais casos

### Requisito 10: Regra Central — Nenhum Campo Zerado no ScoringEngine

**User Story:** Como desenvolvedor, quero garantir que nenhum campo chegue zerado ao ScoringEngine quando dados estão disponíveis, para evitar scores distorcidos.

#### Critérios de Aceitação

1. WHEN dados de funding estão disponíveis via API, THE GeminiAnalysisService SHALL garantir que funding_rate não seja zero no input do ScoringEngine
2. WHEN dados de OI estão disponíveis via API, THE GeminiAnalysisService SHALL garantir que oi_subindo reflita a variação real calculada
3. WHEN dados de CVD estão disponíveis via API, THE GeminiAnalysisService SHALL garantir que cvd_slope contenha o delta real calculado
4. WHEN dados de book estão disponíveis via API, THE GeminiAnalysisService SHALL garantir que book_imbalance_ratio contenha o imbalance real calculado
5. IF um campo de dados não estiver disponível, THEN THE GeminiAnalysisService SHALL passar None (não zero) para que o ScoringEngine ignore o bloco correspondente

### Requisito 11: Multiplicador de Sessão de Trading

**User Story:** Como trader, quero que o score seja ajustado com base na sessão de mercado ativa, para refletir a liquidez e volatilidade típicas de cada período.

#### Critérios de Aceitação

1. WHILE a sessão Ásia está ativa (00:00-08:00 UTC), THE ScoringEngine SHALL aplicar multiplicador 0.85 ao score
2. WHILE a sessão Londres está ativa (08:00-13:00 UTC), THE ScoringEngine SHALL aplicar multiplicador 0.95 ao score
3. WHILE a sessão Nova York está ativa (13:00-21:00 UTC), THE ScoringEngine SHALL aplicar multiplicador 1.00 ao score
4. WHILE a sessão Overnight está ativa (21:00-00:00 UTC), THE ScoringEngine SHALL aplicar multiplicador 0.90 ao score


### Requisito 12: Análise Wyckoff Completa

**User Story:** Como trader institucional, quero uma análise Wyckoff automatizada que identifique fases e eventos, para entender o comportamento de smart money.

#### Critérios de Aceitação

1. THE TechnicalAnalysisService SHALL identificar ranges laterais usando sliding window de 60, 40 e 20 candles, validando amplitude inferior a 8%
2. THE TechnicalAnalysisService SHALL detectar 7 eventos Wyckoff: SC (Selling Climax), AR (Automatic Rally), ST (Secondary Test), SPRING, UAT (Upthrust After Distribution), SOS (Sign of Strength), SOB (Sign of Weakness)
3. THE TechnicalAnalysisService SHALL classificar a fase atual em 9 estados: MARKUP, MARKDOWN, ACUMULACAO_SPRING, DISTRIBUICAO_UAT, ACUMULACAO_ST, ACUMULACAO_AR, ACUMULACAO_SC, DISTRIBUICAO_RANGE, ACUMULACAO_RANGE
4. THE TechnicalAnalysisService SHALL gerar narrativa em português explicando a fase e evento atuais com informação de range (teto/suporte)
5. THE TechnicalAnalysisService SHALL fornecer gatilho operacional específico para cada fase identificada
6. WHEN dados são insuficientes (menos de 20 candles), THE TechnicalAnalysisService SHALL retornar fase INDETERMINADO com narrativa explicativa

### Requisito 13: Volume Profile com POC, HVN e LVN

**User Story:** Como trader, quero que o sistema calcule Volume Profile identificando POC, HVN e LVN, para que os setups de entrada e saída utilizem zonas de volume.

#### Critérios de Aceitação

1. THE TechnicalAnalysisService SHALL distribuir o volume de cada candle proporcionalmente nos bins de preço que ele cobre, usando 50 bins por padrão
2. THE TechnicalAnalysisService SHALL identificar o POC como o bin com maior volume acumulado
3. THE TechnicalAnalysisService SHALL classificar como HVN bins com volume superior a 150% da média
4. THE TechnicalAnalysisService SHALL classificar como LVN bins com volume inferior a 50% da média
5. THE MotorExecucao SHALL utilizar HVN como alvos e LVN como zonas de aceleração no cálculo de TP1, TP2 e TP3

### Requisito 14: Motor de Execução com Plano A e Plano B

**User Story:** Como trader, quero que o sistema gere setups matemáticos com dois planos operacionais, para que eu tenha opções de entrada agressiva e conservadora.

#### Critérios de Aceitação

1. THE MotorExecucao SHALL gerar Plano A (antecipação) com entrada no preço atual, stop baseado em ATR multiplicado e alvos baseados em HVN/LVN
2. THE MotorExecucao SHALL gerar Plano B (entrada técnica) com entrada em pullback a POC ou suporte relevante
3. THE MotorExecucao SHALL calcular alavancagem máxima baseada no score: score menor que 50 limita a 2x, score 50-64 limita a 3x, score 65-74 limita a 5x, score 75 ou mais permite até 10x
4. THE MotorExecucao SHALL calcular preço de liquidação usando fórmula: entrada × (1 - 1/alavancagem + mm) para LONG e entrada × (1 + 1/alavancagem - mm) para SHORT
5. THE MotorExecucao SHALL verificar que o stop está abaixo do preço de liquidação com margem de segurança de 5%, reduzindo alavancagem iterativamente se necessário
6. WHEN suportes do usuário estão disponíveis via OCR, THE MotorExecucao SHALL ajustar o stop para logo abaixo do suporte mais alto válido
7. WHEN resistências do usuário estão disponíveis via OCR, THE MotorExecucao SHALL ajustar o stop SHORT para logo acima da resistência mais baixa válida
8. IF o preço atual é zero ou inválido, THEN THE MotorExecucao SHALL retornar setup com verificação INVÁLIDO sem realizar cálculos

### Requisito 15: Narrativa Gemini AI com Hierarquia de Dados

**User Story:** Como trader, quero uma narrativa gerada por IA que priorize dados matemáticos calculados sobre interpretação visual, para que a análise final seja precisa e fundamentada.

#### Critérios de Aceitação

1. THE GeminiAnalysisService SHALL incluir no prompt a instrução de que dados calculados via API prevalecem sobre interpretação visual do gráfico
2. THE GeminiAnalysisService SHALL montar contexto completo incluindo indicadores, derivativos, macro, score e zonas antes de enviar ao Gemini
3. WHEN compressão de volatilidade está ativa, THE GeminiAnalysisService SHALL injetar instrução obrigatória no contexto orientando setup agressivo na direção do rompimento
4. THE GeminiAnalysisService SHALL enviar a imagem do gráfico junto com o prompt textual para análise multimodal
5. THE GeminiAnalysisService SHALL parsear a resposta JSON do Gemini, removendo code fences e caracteres de controle
6. IF o contexto estiver vazio, THEN THE GeminiAnalysisService SHALL usar fallback textual informando que dados não estavam disponíveis
7. IF o parse JSON falhar, THEN THE GeminiAnalysisService SHALL tentar correção removendo trailing commas e caracteres inválidos antes de falhar definitivamente

### Requisito 16: Dados Macro e Sentimento como Flags Informativas

**User Story:** Como trader, quero que dados macro (VIX, DXY, S&P500) e sentimento (Fear & Greed) gerem flags informativas sem afetar o score principal, para separar o contexto macroeconômico da análise técnica.

#### Critérios de Aceitação

1. THE ScoringEngine SHALL gerar flag VIX_ELEVADO quando VIX está entre 25 e 30, e VIX_CRITICO quando VIX é superior a 30
2. THE ScoringEngine SHALL gerar flag SAIDA_DO_MERCADO quando variação de dominância USDT é superior a 0.2%
3. THE ScoringEngine SHALL gerar flag ACUMULACAO_INSTITUCIONAL quando descorrelação BTC do tipo FORCA_RELATIVA é detectada
4. THE ScoringEngine SHALL gerar flag DISTRIBUICAO_INSTITUCIONAL quando descorrelação BTC do tipo FRAQUEZA_RELATIVA é detectada
5. THE ScoringEngine SHALL gerar flag EUFORIA_EXTREMA quando Fear & Greed é superior a 80
6. THE ScoringEngine SHALL gerar flag PANICO_EXTREMO_OPORTUNIDADE quando Fear & Greed é inferior a 20
7. THE GeminiAnalysisService SHALL buscar VIX, DXY e S&P500 via YahooFinanceService e Fear & Greed via AlternativeService

### Requisito 17: Micro Radar — Monitoramento em Tempo Real via WebSocket

**User Story:** Como trader, quero um sistema de monitoramento em tempo real que detecte anomalias (spikes de volume, movimentos bruscos, funding extremo, cascatas de liquidação), para receber alertas antes que o mercado se mova significativamente.

#### Critérios de Aceitação

1. THE MonitorWorker SHALL monitorar 15 pares pré-definidos via WebSocket (BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, DOGEUSDT, ADAUSDT, AVAXUSDT, LINKUSDT, DOTUSDT, MATICUSDT, NEARUSDT, ARBUSDT, OPUSDT, SUIUSDT)
2. THE MonitorWorker SHALL acumular CVD em tempo real via aggTrade WebSocket, fazendo snapshot a cada 60 segundos em buffer circular de 100 posições
3. THE MonitorWorker SHALL atualizar orderbook com 5 melhores níveis bid/ask via depth5 WebSocket
4. THE MonitorWorker SHALL calcular book imbalance como (sum_bids - sum_asks) / (sum_bids + sum_asks)
5. WHEN volume atual excede 3x a SMA20 de volume, THE MonitorWorker SHALL disparar alerta SPIKE_VOLUME com urgência ALTA
6. WHEN variação de preço em 60 segundos excede 1.5%, THE MonitorWorker SHALL disparar alerta MOVIMENTO_BRUSCO com urgência ALTA
7. WHEN funding rate é superior a 0.05%, THE MonitorWorker SHALL disparar alerta FUNDING_EXTREMO bearish
8. WHEN funding rate é inferior a -0.03%, THE MonitorWorker SHALL disparar alerta FUNDING_EXTREMO bullish
9. WHEN OI varia mais de 5% em 5 minutos, THE MonitorWorker SHALL disparar alerta OI_SPIKE
10. WHEN 3 candles consecutivos na mesma direção com variação total superior a 1.5% e volume 2x acima da média, THE MonitorWorker SHALL disparar alerta LIQUIDATION_CASCADE
11. THE MonitorWorker SHALL filtrar pares com volume diário inferior a 50 milhões de dólares
12. THE MonitorWorker SHALL evitar alertas duplicados do mesmo tipo/ativo/corretora em intervalo de 300 segundos

### Requisito 18: Clusters de Liquidação no Score

**User Story:** Como trader, quero que clusters de liquidação próximos ao preço atual influenciem o score, para antecipar movimentos de squeeze.

#### Critérios de Aceitação

1. WHEN cluster de liquidação acima está a menos de 1% do preço atual, THE ScoringEngine SHALL adicionar 2 pontos bearish e flag CLUSTER_ACIMA
2. WHEN cluster de liquidação abaixo está a menos de 1% do preço atual, THE ScoringEngine SHALL adicionar 2 pontos bullish e flag CLUSTER_ABAIXO

### Requisito 19: Equal Highs e Equal Lows

**User Story:** Como trader, quero que o sistema identifique níveis de equal highs e equal lows, para detectar áreas de liquidez acumulada.

#### Critérios de Aceitação

1. THE IndicatorEngine SHALL identificar equal highs nos últimos 100 candles com tolerância de 0.15% entre topos
2. THE IndicatorEngine SHALL identificar equal lows nos últimos 100 candles com tolerância de 0.15% entre fundos
3. THE IndicatorEngine SHALL retornar lista de níveis únicos de equal highs e equal lows detectados

### Requisito 20: Análise Multi-Timeframe

**User Story:** Como trader, quero que o sistema avalie timeframes superiores ao operado, para confirmar o viés direcional no contexto de tendência maior.

#### Critérios de Aceitação

1. WHEN o timeframe operado é 15m, THE GeminiAnalysisService SHALL avaliar 1h, 4h e 1d como timeframes superiores
2. WHEN o timeframe operado é 1h, THE GeminiAnalysisService SHALL avaliar 4h, 1d e 1w como timeframes superiores
3. WHEN o timeframe operado é 4h, THE GeminiAnalysisService SHALL avaliar 1d, 1w e 1M como timeframes superiores
4. FOR EACH timeframe superior, THE GeminiAnalysisService SHALL classificar o viés como BULLISH (score >= 2), BEARISH (score <= -2) ou NEUTRO, baseado em RSI relativo a 50, preço relativo a EMA21 e preço relativo a EMA50

### Requisito 21: Funding Rate com 5 Faixas no Score

**User Story:** Como trader de derivativos, quero que o funding rate seja pontuado em 5 faixas distintas, para capturar nuances de posicionamento do mercado.

#### Critérios de Aceitação

1. WHEN funding rate está entre -0.01% e 0.01%, THE ScoringEngine SHALL atribuir 2 pontos para ambas as direções (neutro)
2. WHEN funding rate é superior a 0.05%, THE ScoringEngine SHALL atribuir 8 pontos bearish e flag LONG_SQUEEZE_IMINENTE
3. WHEN funding rate está entre 0.03% e 0.05%, THE ScoringEngine SHALL atribuir 6 pontos bearish
4. WHEN funding rate é inferior a -0.03%, THE ScoringEngine SHALL atribuir 8 pontos bullish e flag SHORT_SQUEEZE_IMINENTE
5. WHEN funding rate está entre -0.03% e -0.02%, THE ScoringEngine SHALL atribuir 6 pontos bullish

### Requisito 22: OI Direcional com Preço no Score

**User Story:** Como trader, quero que a combinação de direção do OI com direção do preço seja pontuada no score, para detectar tendência suportada por capital.

#### Critérios de Aceitação

1. WHEN OI subindo E preço subindo, THE ScoringEngine SHALL atribuir 8 pontos bullish (tendência forte)
2. WHEN OI subindo E preço caindo, THE ScoringEngine SHALL atribuir 8 pontos bearish (pressão vendedora)
3. WHEN OI caindo E preço subindo, THE ScoringEngine SHALL atribuir 3 pontos bullish e flag RALLY_FRACO
4. WHEN OI caindo E preço caindo, THE ScoringEngine SHALL atribuir 3 pontos bearish e flag CORRECAO_FRACA

### Requisito 23: Divergência CVD no Score

**User Story:** Como trader, quero que divergências entre preço e CVD gerem pontuação significativa, para identificar falsos movimentos.

#### Critérios de Aceitação

1. WHEN divergência CVD bearish é detectada (preço subindo com CVD caindo), THE ScoringEngine SHALL atribuir 10 pontos bearish e flag CVD_DIVERGENCIA_BEARISH
2. WHEN divergência CVD bullish é detectada (preço caindo com CVD subindo), THE ScoringEngine SHALL atribuir 10 pontos bullish e flag CVD_DIVERGENCIA_BULLISH
3. THE MonitorWorker SHALL detectar divergência CVD comparando 3 pontos consecutivos de topos/fundos de preço com topos/fundos de CVD

### Requisito 24: Gravação de Alertas no Banco de Dados

**User Story:** Como desenvolvedor, quero que alertas sejam gravados diretamente no MySQL sem depender do artisan serve, para evitar timeouts em single-thread.

#### Critérios de Aceitação

1. THE MonitorWorker SHALL gravar alertas diretamente na tabela genesis_alertas via conexão MySQL (pymysql), sem passar pela API Laravel
2. THE MonitorWorker SHALL incluir nos alertas: ativo, tipo, mensagem, direcao, urgencia, corretora, timeframe, preco_atual, variacao_pct, score, motivos e timeframes
3. IF a conexão com o banco falhar, THEN THE MonitorWorker SHALL registrar o erro no log sem interromper o processamento

### Requisito 25: Cache de Dados com TTL Configurável

**User Story:** Como desenvolvedor, quero que chamadas frequentes à API sejam cacheadas com TTL apropriado, para reduzir latência e evitar rate limits.

#### Critérios de Aceitação

1. THE BinanceService SHALL cachear respostas de API com TTL configurável (padrão 300 segundos)
2. THE GeminiAnalysisService SHALL cachear resposta do Gemini por 5 minutos usando chave baseada em symbol + timeframe + leverage
3. THE MonitorWorker SHALL cachear Fear & Greed Index por 1 hora

### Requisito 26: Detecção de Padrão de Candle

**User Story:** Como trader, quero que o sistema identifique padrões de candle significativos, para complementar a análise técnica.

#### Critérios de Aceitação

1. THE TechnicalAnalysisService SHALL detectar padrão DOJI quando o corpo do candle é inferior a 10% do range
2. THE TechnicalAnalysisService SHALL detectar ENGOLFO_ALTISTA quando candle bullish atual engolfa candle bearish anterior
3. THE TechnicalAnalysisService SHALL detectar ENGOLFO_BAIXISTA quando candle bearish atual engolfa candle bullish anterior
4. THE TechnicalAnalysisService SHALL detectar MARTELO quando sombra inferior excede 2x o corpo e sombra superior é inferior a 50% do corpo
5. THE TechnicalAnalysisService SHALL detectar ESTRELA_CADENTE quando sombra superior excede 2x o corpo e sombra inferior é inferior a 50% do corpo
6. THE TechnicalAnalysisService SHALL detectar PIN_BAR quando qualquer sombra excede 2.5x o corpo

### Requisito 27: Zonas Estruturais PDH/PDL e PWH/PWL

**User Story:** Como trader, quero que o sistema calcule máximas e mínimas do dia e da semana anteriores, para usar como zonas de interesse.

#### Critérios de Aceitação

1. THE GeminiAnalysisService SHALL calcular PDH (Previous Day High) e PDL (Previous Day Low) a partir de candles diários
2. THE GeminiAnalysisService SHALL calcular PWH (Previous Week High) e PWL (Previous Week Low) a partir de candles semanais
3. THE IndicatorEngine SHALL calcular PDH e PDL baseado em UTC day boundary dos candles disponíveis
4. THE IndicatorEngine SHALL calcular PWH e PWL baseado em semana ISO dos candles disponíveis

### Requisito 28: Cálculo de Tamanho de Posição

**User Story:** Como trader, quero que o sistema calcule automaticamente o tamanho da posição baseado na minha margem e alavancagem, para saber exatamente quanto operar.

#### Critérios de Aceitação

1. WHEN o usuário informa valor de entrada e alavancagem, THE GeminiAnalysisService SHALL calcular: valor total = margem × alavancagem, quantidade = valor total / preço de entrada
2. THE GeminiAnalysisService SHALL calcular risco em USD: (distância stop / preço entrada) × valor total
3. IF valor de entrada é zero ou não informado, THEN THE GeminiAnalysisService SHALL usar margem demo de 100 USD para os cálculos

### Requisito 29: Fontes de Indicadores com Fallback OCR

**User Story:** Como trader, quero saber se cada indicador veio de cálculo via API ou do gráfico (OCR), para avaliar a confiabilidade dos dados.

#### Critérios de Aceitação

1. THE TechnicalAnalysisService SHALL rastrear a fonte de cada indicador calculado: "API" quando calculado via candles, "GRAFICO" quando obtido via OCR, "INDISPONIVEL" quando não disponível
2. WHEN o cálculo via API retorna null E dados OCR existem para o indicador, THE TechnicalAnalysisService SHALL usar o valor OCR como fallback
3. THE GeminiAnalysisService SHALL incluir o mapa de fontes na resposta final para o frontend exibir
