# Documento de Requisitos — Exchange Router + OI Histórico

## Introdução

Este documento especifica os requisitos para implementação do roteamento multi-corretora de dados derivativos (Etapa 3) e do armazenamento histórico de Open Interest com cálculo de variação real (Etapa 4) na plataforma Genesis. Atualmente, o GeminiAnalysisService busca dados derivativos exclusivamente da Binance e utiliza valores hardcoded para Fear & Greed, BTC Dominância e variação de OI. Esta feature elimina essas limitações criando um roteador inteligente que direciona chamadas à corretora correta, com fallback para Binance, e persiste o OI no banco para cálculo de variação temporal.

## Glossário

- **ExchangeRouter**: Serviço central que detecta a corretora de origem e roteia chamadas de dados derivativos para o serviço correto
- **Corretora_Detectada**: Corretora identificada via OCR do logo presente na imagem do gráfico enviada pelo usuário
- **Derivativos**: Conjunto de dados composto por Open Interest, Funding Rate, Long/Short Ratio e CVD
- **Fallback**: Comportamento de buscar dados na Binance quando a corretora detectada retorna valores nulos ou zerados
- **Alerta_Hibrido**: Flag indicando que os dados da análise vieram de fontes mistas (corretora detectada + Binance)
- **OI_Historico**: Tabela de banco de dados que armazena o valor de Open Interest por símbolo e corretora ao longo do tempo
- **Aviso_Liquidez**: Flag indicando que o ativo na corretora detectada não possui liquidez suficiente em derivativos
- **ScoreInput**: Array de dados consolidados passado ao engine de scoring para cálculo de pontuação da análise
- **GeminiAnalysisService**: Serviço principal que orquestra a análise técnica completa de um ativo

## Requisitos

### Requisito 1: Completar Endpoints Derivativos nas Corretoras

**User Story:** Como desenvolvedor, eu quero que todas as corretoras suportadas tenham os mesmos endpoints derivativos implementados, para que o ExchangeRouter possa rotear requisições para qualquer uma delas.

#### Critérios de Aceite

1. THE BybitService SHALL expor o método getOpenInterest que consulta o endpoint /v5/market/open-interest com category=linear e retorna o valor de openInterest do símbolo
2. THE BybitService SHALL expor o método getLongShortRatio que consulta o endpoint /v5/market/account-ratio com category=linear e retorna a lista de ratios
3. THE BybitService SHALL expor o método getCvd que calcula o delta cumulativo de volume a partir dos trades agregados
4. THE BitgetService SHALL expor o método getFundingRate que consulta o endpoint /api/v2/mix/market/current-fund-rate com productType=USDT-FUTURES e retorna o valor de fundingRate
5. THE BitgetService SHALL expor o método getOpenInterest que consulta o endpoint /api/v2/mix/market/open-interest com productType=USDT-FUTURES e retorna o valor de openInterest
6. THE BitgetService SHALL expor o método getLongShortRatio que consulta o endpoint /api/v2/mix/market/account-long-short-ratio com productType=USDT-FUTURES e retorna a lista de ratios
7. THE BitgetService SHALL expor o método getCvd que calcula o delta cumulativo de volume a partir dos trades
8. THE BitgetService SHALL expor o método getCandles que consulta o endpoint /api/v2/mix/market/candles com productType=USDT-FUTURES e retorna a lista de candles
9. THE OkxService SHALL expor o método getLongShortRatio que consulta o endpoint /api/v5/rubik/stat/contracts/long-short-account-ratio e retorna a lista de ratios
10. THE OkxService SHALL expor o método getCvd que calcula o delta cumulativo de volume a partir dos trades agregados
11. THE OkxService SHALL expor o método getCandles que consulta o endpoint /api/v5/market/candles e retorna a lista de candles
12. WHEN qualquer endpoint derivativo de uma corretora retornar erro HTTP, THE serviço correspondente SHALL lançar uma RuntimeException com código de status e logar o erro via Log::error

### Requisito 2: Criar o ExchangeRouter com Detecção e Fallback

**User Story:** Como analista, eu quero que a plataforma detecte automaticamente a corretora do meu gráfico e busque dados derivativos da corretora correta, para que a análise reflita os dados reais da exchange que estou operando.

#### Critérios de Aceite

1. WHEN o GeminiAnalysisService iniciar uma análise, THE ExchangeRouter SHALL receber o nome da corretora detectada via OCR e o símbolo do ativo
2. WHEN a Corretora_Detectada for identificada, THE ExchangeRouter SHALL rotear chamadas de getOpenInterest, getFundingRate, getLongShortRatio e getCvd para o serviço da corretora correspondente
3. IF a Corretora_Detectada não for reconhecida entre [binance, bybit, bitget, okx], THEN THE ExchangeRouter SHALL utilizar BinanceService como padrão
4. IF o serviço da Corretora_Detectada retornar null ou lançar exceção para qualquer endpoint derivativo, THEN THE ExchangeRouter SHALL buscar o dado correspondente no BinanceService
5. IF o serviço da Corretora_Detectada retornar OI igual a 0 E funding_rate igual a 0 simultaneamente, THEN THE ExchangeRouter SHALL ativar o Aviso_Liquidez e buscar todos os derivativos no BinanceService
6. WHEN o ExchangeRouter utilizar dados de mais de uma corretora na mesma análise, THE ExchangeRouter SHALL retornar o campo alerta_hibrido com valor true e indicar quais fontes forneceram cada dado
7. THE ExchangeRouter SHALL retornar um array normalizado contendo as chaves: oi, funding_rate, long_short_ratio, cvd, fonte_primaria, fonte_fallback, alerta_hibrido e aviso_liquidez
8. THE ExchangeRouter SHALL utilizar o padrão CacheManager::remember para cada chamada delegada, respeitando o TTL configurado em cada serviço

### Requisito 3: Armazenamento Histórico de Open Interest

**User Story:** Como analista, eu quero que o sistema armazene o OI de cada análise no banco de dados, para que a variação de OI seja calculada com base em dados reais e não seja sempre zero.

#### Critérios de Aceite

1. THE Sistema SHALL criar a tabela oi_historico com as colunas: id (bigint, autoincrement), symbol (varchar 50), exchange (varchar 20), oi_valor (decimal 20,2), created_at (timestamp)
2. THE tabela oi_historico SHALL ter um índice composto em [symbol, exchange, created_at] para consultas eficientes
3. WHEN o ExchangeRouter retornar o valor de OI para uma análise, THE GeminiAnalysisService SHALL inserir um registro na tabela oi_historico com o symbol, exchange de origem e o valor de OI obtido
4. WHEN uma nova análise for iniciada, THE GeminiAnalysisService SHALL consultar o registro mais recente de oi_historico para o mesmo symbol e exchange para calcular a variação percentual
5. WHEN existir um registro anterior de OI na tabela, THE GeminiAnalysisService SHALL calcular oi_variacao como ((oi_atual - oi_anterior) / oi_anterior) * 100 arredondado a 2 casas decimais
6. IF não existir registro anterior de OI na tabela para o par symbol+exchange, THEN THE GeminiAnalysisService SHALL definir oi_variacao como 0
7. THE GeminiAnalysisService SHALL passar o valor real de oi_variacao ao ScoreInput no campo oi_subindo em substituição ao valor hardcoded 0

### Requisito 4: Integrar Dados Públicos ao ScoreInput

**User Story:** Como analista, eu quero que o Fear & Greed Index e a BTC Dominância reais sejam usados no scoring, para que a análise reflita o sentimento de mercado atual ao invés de valores fixos.

#### Critérios de Aceite

1. WHEN uma análise for iniciada, THE GeminiAnalysisService SHALL chamar AlternativeService::getCurrentFearGreed para obter o valor real do Fear & Greed Index
2. WHEN uma análise for iniciada, THE GeminiAnalysisService SHALL chamar CoinGeckoService::getBtcDominance para obter a dominância real do BTC
3. THE GeminiAnalysisService SHALL passar o valor real de fear_greed ao ScoreInput em substituição ao valor hardcoded 50
4. THE GeminiAnalysisService SHALL passar o valor real de btc_dominancia ao ScoreInput em substituição ao valor hardcoded 0
5. IF a chamada ao AlternativeService falhar, THEN THE GeminiAnalysisService SHALL utilizar 50 como valor padrão para fear_greed e logar um warning
6. IF a chamada ao CoinGeckoService falhar, THEN THE GeminiAnalysisService SHALL utilizar 0 como valor padrão para btc_dominancia_variacao e logar um warning

### Requisito 5: Detecção de Liquidez Insuficiente

**User Story:** Como analista, eu quero ser informado quando o ativo analisado não possui liquidez em derivativos na corretora detectada, para que eu saiba que os dados de scoring podem não refletir a realidade daquela exchange.

#### Critérios de Aceite

1. WHEN o ExchangeRouter detectar que OI retornado é igual a 0 E funding_rate retornado é igual a 0 para a Corretora_Detectada, THE ExchangeRouter SHALL definir aviso_liquidez como true
2. WHEN aviso_liquidez for true, THE GeminiAnalysisService SHALL incluir o campo aviso_liquidez na resposta da análise com a mensagem descritiva indicando a corretora sem liquidez
3. WHEN aviso_liquidez for true E o fallback para Binance também retornar OI igual a 0, THE GeminiAnalysisService SHALL zerar o bloco de derivativos no ScoreInput (oi_subindo=false, funding_rate=0, long_short_ratio=50, cvd_delta=0)

### Requisito 6: Substituição da Chamada Hardcoded no GeminiAnalysisService

**User Story:** Como desenvolvedor, eu quero que o GeminiAnalysisService utilize o ExchangeRouter ao invés de chamar BinanceService diretamente, para que o fluxo suporte múltiplas corretoras sem duplicação de código.

#### Critérios de Aceite

1. THE GeminiAnalysisService SHALL substituir todas as chamadas diretas a BinanceService para dados derivativos (linhas 47-63) por uma única chamada ao ExchangeRouter
2. THE GeminiAnalysisService SHALL passar ao ExchangeRouter o symbol e a corretora detectada via OCR como parâmetros
3. THE GeminiAnalysisService SHALL utilizar o array normalizado retornado pelo ExchangeRouter para compor o bloco de derivativos do ScoreInput
4. WHEN o ExchangeRouter retornar alerta_hibrido=true, THE GeminiAnalysisService SHALL incluir o campo alerta_hibrido na resposta final da análise
5. THE GeminiAnalysisService SHALL manter o tratamento de exceção existente: em caso de falha total nos derivativos, utilizar os valores padrão (oi=0, funding_rate=0, long_short_ratio=50, cvd={delta:0, imbalance:0}, oi_variacao=0)
