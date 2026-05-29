# Documento de Requisitos — Gênesis 2.0: 8 Passos Críticos (Pós-Auditoria)

## Introdução

Este documento especifica os 8 passos críticos identificados no Master Dev Document pós-auditoria do Gênesis 2.0, com prazo final em 31 de maio. Os passos cobrem: estrutura de banco de dados (ATH, alertas Telegram, créditos), correção do cálculo de Tamanho Sugerido, eliminação de localStorage do histórico, mapeamento de TP2/TP3, criação de rota proxy de preços, reescrita do monitoramento de preços, ATH na carteira, e correção do Micro Radar.

## Regras Invioláveis

- API Gemini: NUNCA chamar durante monitoramento contínuo. Somente quando membro clica "Analisar".
- Storage: TUDO vai para MySQL na Hostinger. Remover qualquer escrita em localStorage.
- Preços: Sempre via /api/price/:symbol no servidor. NUNCA chamar exchanges diretamente do frontend.
- Design: Não alterar cores, fontes, espaçamento. Novos elementos seguem padrão existente.
- Comentários: Todos os comentários de código em português.

## Glossário

- **Sistema**: A aplicação Gênesis 2.0 (frontend React + backend Node.js)
- **Servidor**: Backend Node.js (server.ts + routes/api.js) hospedado na Hostinger
- **Frontend**: Aplicação React + TypeScript + React Router
- **MySQL_Hostinger**: Banco de dados MySQL hospedado na Hostinger
- **Carteira_Mae**: Tabela genesis_carteira_mae (carteira do administrador)
- **Carteira_Gemas**: Tabela genesis_carteira_gemas (carteira de gemas)
- **Carteira_Membro**: Tabela genesis_carteira_membro (carteira individual do membro)
- **AnalysisHistory**: Componente AnalysisHistoryDashboard.tsx
- **GeminiService**: Serviço services/geminiService.ts responsável pelo prompt de análise
- **Proxy_Precos**: Rota /api/price/:symbol no servidor que consulta exchanges
- **Monitoramento_Carteira**: Hook useMonitoramentoCarteira.ts que faz polling de preços
- **Micro_Radar**: Componente ConfluenceScore.tsx que exibe oportunidades detectadas
- **ATH**: All-Time High — preço máximo histórico de um ativo na carteira
- **TP1/TP2/TP3**: Take Profit 1, 2 e 3 — alvos de lucro de uma análise
- **Creditos**: Sistema de créditos que controla uso de funcionalidades pagas

## Requisitos

### Requisito 1: Criar migration para colunas ATH e tabelas Telegram

**User Story:** Como administrador, eu quero que o banco de dados contenha as colunas de ATH nas carteiras e as tabelas de alertas Telegram, para que o sistema possa rastrear máximas históricas e enviar alertas progressivos.

**Nota:** O sistema de créditos já existe via pacote bavix/wallet (User model implementa HasWallet). Não criar tabelas genesis_creditos — usar o wallet existente.

#### Critérios de Aceitação

1. THE Sistema SHALL have a Laravel migration that adds columns max_price DECIMAL(24,12), max_price_date DATETIME, and max_variation_pct DECIMAL(10,2) to the tables genesis_carteira_mae, genesis_carteira_gemas, and genesis_carteira_membro
2. THE Sistema SHALL have a Laravel migration that creates the table genesis_alertas_telegram_config with columns: id, wallet_type ENUM('mae','gemas'), ativo TINYINT(1) DEFAULT 1, threshold_minimo DECIMAL(10,2) DEFAULT 10, gap_minimo DECIMAL(10,2) DEFAULT 3, intervalo_horas DECIMAL(4,1) DEFAULT 1, template TEXT, atualizado_em DATETIME, UNIQUE KEY on wallet_type
3. THE Sistema SHALL have a Laravel migration that creates the table genesis_alertas_telegram_estado with columns: id, wallet_type ENUM('mae','gemas'), wallet_asset_id INT, ultimo_alerta_pct DECIMAL(10,2) DEFAULT 0, ultima_verificacao DATETIME, ultimo_disparo DATETIME, total_disparos INT DEFAULT 0, UNIQUE KEY on (wallet_type, wallet_asset_id)
4. WHEN the migration runs, THE Sistema SHALL insert default Telegram alert templates for 'mae' and 'gemas' wallet types with threshold_minimo=10, gap_minimo=3, intervalo_horas=1

### Requisito 2: Corrigir "Tamanho Sugerido = $0.00"

**User Story:** Como membro, eu quero que o Tamanho Sugerido sempre exiba um valor calculado válido, para que eu tenha uma referência de posição mesmo quando não informo valor de entrada.

#### Critérios de Aceitação

1. WHEN the member provides an entryValue greater than zero, THE GeminiService SHALL calculate tamanhoSugerido as entryValue multiplied by leverage
2. WHEN the member provides an entryValue equal to zero or empty, THE GeminiService SHALL use $100.00 as demo margin and calculate tamanhoSugerido as 100 multiplied by leverage
3. THE GeminiService SHALL format tamanhoSugerido as "$X.XX" with two decimal places
4. THE GeminiService SHALL never return "$0.00" as tamanhoSugerido value
5. FOR ALL valid combinations of entryValue and leverage, calculating tamanhoSugerido then formatting then parsing SHALL produce a value greater than zero (round-trip property)

### Requisito 3: Remover localStorage do histórico — somente MySQL

**User Story:** Como membro, eu quero que meu histórico de análises seja persistido exclusivamente no MySQL, para que os dados não se percam ao limpar o navegador e estejam sincronizados entre dispositivos.

#### Critérios de Aceitação

1. THE AnalysisHistory SHALL not use localStorage.getItem, localStorage.setItem, or localStorage.removeItem for analysis history data
2. WHEN a new analysis is saved, THE Sistema SHALL persist it via POST /api/salvar-analise to MySQL_Hostinger
3. WHEN the history page loads, THE AnalysisHistory SHALL fetch all records from the server API using MySQL IDs
4. WHEN a user updates the status of an analysis, THE AnalysisHistory SHALL send a PUT request to the server to update the record in MySQL_Hostinger
5. WHEN a user clears history, THE AnalysisHistory SHALL send a DELETE request to the server to remove records from MySQL_Hostinger
6. THE GenesisPage SHALL not contain any localStorage references for analysis history operations

### Requisito 4: Mapear TP2 e TP3 do banco de dados — círculos sem N/A

**User Story:** Como membro, eu quero visualizar o progresso de TP1, TP2 e TP3 nos círculos de performance, para que eu acompanhe todos os alvos da minha análise.

#### Critérios de Aceitação

1. WHEN loading analysis history from the database, THE AnalysisHistory SHALL map take_profit_2 to target_price2 and take_profit_3 to target_price3 using parseFloat with fallback to zero
2. THE AnalysisHistory SHALL render TP2 and TP3 circles when their values are greater than or equal to zero (using >= 0 check instead of truthy check)
3. IF take_profit_2 or take_profit_3 is null in the database, THEN THE AnalysisHistory SHALL display the circle with 0% progress instead of "N/A"
4. THE AnalysisHistory SHALL use the condition (value !== undefined && value !== null) instead of (value) to avoid falsy-zero rendering bugs

### Requisito 5: Criar rota /api/price/:symbol no servidor

**User Story:** Como desenvolvedor, eu quero uma rota proxy no servidor que consulte preços em múltiplas exchanges, para que o frontend nunca chame APIs de exchanges diretamente (evitando CORS).

#### Critérios de Aceitação

1. THE Servidor SHALL expose a GET /api/price/:symbol route that returns the current price of the given symbol
2. THE Proxy_Precos SHALL query Binance, Bybit, OKX, and Bitget public APIs in fallback order until a valid price is obtained
3. WHEN all exchanges fail to return a price, THE Proxy_Precos SHALL return HTTP 502 with a descriptive error message
4. THE Proxy_Precos SHALL return a JSON response with fields: price (number), exchange (string), symbol (string), timestamp (ISO string)
5. THE Servidor SHALL expose a PUT /api/historico-analises/:id route that updates resultado, preco_resultado, and data_resultado in genesis_analises table
6. WHEN the PUT route receives an invalid id, THE Servidor SHALL return HTTP 404 with error message
7. THE Servidor SHALL never expose exchange API keys or internal errors to the client response

### Requisito 6: Reescrever checkPrices — proxy + TP2/TP3 + progresso circular

**User Story:** Como membro, eu quero que o monitoramento de preços use o proxy do servidor e calcule progresso percentual para todos os alvos, para que os anéis visuais reflitam o avanço real da operação.

#### Critérios de Aceitação

1. THE AnalysisHistory SHALL fetch current prices exclusively via GET /api/price/:symbol (never calling exchange APIs directly from frontend)
2. THE AnalysisHistory SHALL calculate progress percentage (0-100%) for TP1, TP2, TP3, and Stop Loss based on current price relative to entry price and target
3. WHEN a target (TP1, TP2, TP3, or Stop) is reached, THE AnalysisHistory SHALL send a PUT request to /api/historico-analises/:id to update the result in MySQL_Hostinger
4. THE AnalysisHistory SHALL pass progress values to strokeDasharray of SVG circle elements to render visual ring progress
5. THE AnalysisHistory SHALL not save monitoring results to localStorage
6. WHEN calculating progress for a LONG position, THE AnalysisHistory SHALL use formula: ((currentPrice - entryPrice) / (targetPrice - entryPrice)) * 100, clamped between 0 and 100
7. WHEN calculating progress for a SHORT position, THE AnalysisHistory SHALL use formula: ((entryPrice - currentPrice) / (entryPrice - targetPrice)) * 100, clamped between 0 and 100

### Requisito 7: ATH no polling da Carteira

**User Story:** Como administrador, eu quero que o polling da carteira atualize automaticamente o ATH quando o preço atual superar o máximo registrado, para que eu tenha rastreamento histórico de máximas.

#### Critérios de Aceitação

1. WHILE the wallet polling is active, WHEN the current price of an asset exceeds its stored max_price, THE Monitoramento_Carteira SHALL send a PUT request to update max_price, max_price_date, and max_variation_pct in MySQL_Hostinger
2. THE Monitoramento_Carteira SHALL calculate max_variation_pct as ((current_price - preco_entrada) / preco_entrada) * 100
3. IF max_price is null or zero for an asset, THEN THE Monitoramento_Carteira SHALL treat the current price as the initial max_price
4. THE Monitoramento_Carteira SHALL update max_price_date with the current datetime in ISO format when a new ATH is detected

### Requisito 8: Micro Radar — corrigir créditos (50→75) + tooltip + débito real

**User Story:** Como membro, eu quero que o Micro Radar exiba o custo correto de 75 créditos com tooltip informativo e debite os créditos antes de navegar para análise, para que o sistema de créditos funcione corretamente.

#### Critérios de Aceitação

1. THE Micro_Radar SHALL display "75 creditos" instead of "50 creditos" in the cost indicator
2. WHEN the member hovers over the Micro Radar card, THE Micro_Radar SHALL display a tooltip following the group-hover pattern used in MarketWidget.tsx and FundingMonitor.tsx
3. WHEN the member clicks "Analisar Agora", THE Micro_Radar SHALL send a POST request to /api/creditos/debitar with amount 75 before navigating to the analysis
4. IF the credit debit fails (insufficient credits or server error), THEN THE Micro_Radar SHALL display an error message and prevent navigation to analysis
5. THE Servidor SHALL expose a POST /api/creditos/debitar route that deducts credits from the member's bavix/wallet balance and logs the transaction
6. WHEN the member has fewer than 75 credits in their bavix/wallet, THE Servidor SHALL return HTTP 402 with a descriptive error message indicating insufficient credits
7. THE Servidor SHALL accept an idempotency_key parameter in POST /api/creditos/debitar and reject duplicate requests with the same key, returning the original response without debiting again
8. THE Micro_Radar SHALL disable the "Analisar Agora" button and show a loading state while the debit request is in flight, preventing double-clicks
9. THE Micro_Radar SHALL generate a unique idempotency_key per analysis action and send it with the debit request to prevent duplicate charges on network retries
