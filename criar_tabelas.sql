-- Script SQL para criação da tabela de alertas do Gênesis
-- DEV: Execute este arquivo no seu banco de dados MySQL
-- e configure as variáveis MYSQL_* no arquivo .env

CREATE TABLE IF NOT EXISTS genesis_alertas (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID único do alerta',
    ativo VARCHAR(20) NOT NULL COMMENT 'Símbolo do ativo (ex: BTCUSDT)',
    tipo VARCHAR(50) NOT NULL COMMENT 'Tipo do evento: SPIKE_VOLUME, MOVIMENTO_BRUSCO, CVD_DIVERGENCIA, FUNDING_EXTREMO, OI_SPIKE, BOOK_IMBALANCE',
    mensagem TEXT NOT NULL COMMENT 'Mensagem descritiva da anomalia',
    direcao ENUM('BULLISH', 'BEARISH', 'NEUTRO') NOT NULL COMMENT 'Direção do viés do alerta',
    urgencia ENUM('ALTA', 'MEDIA', 'BAIXA') NOT NULL COMMENT 'Nível de urgência / importância do alerta',
    corretora VARCHAR(20) NOT NULL COMMENT 'Corretora onde a anomalia foi detectada (ex: BINANCE, BYBIT)',
    preco_atual DECIMAL(20, 8) NOT NULL COMMENT 'Preço da criptomoeda no momento do alerta',
    variacao_pct DECIMAL(10, 4) NOT NULL COMMENT 'Variação percentual associada ao evento, se aplicável',
    enviado_sse TINYINT(1) DEFAULT 0 COMMENT 'Flag de controle: 1 se foi enviado pela API SSE, 0 caso contrário',
    enviado_telegram TINYINT(1) DEFAULT 0 COMMENT 'Flag de controle: 1 se foi enviado via Telegram, 0 caso contrário',
    criado_em DATETIME NOT NULL COMMENT 'Data e hora em que o alerta foi gerado pelo worker',
    
    -- Índices para melhorar a performance nas buscas do SSE e controle de duplicadas
    INDEX idx_enviado_sse (enviado_sse),
    INDEX idx_criado_em (criado_em),
    INDEX idx_multiplo (ativo, tipo, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Query de verificação (pode ser executada para checar os últimos registros lidos no SSE)
-- SELECT * FROM genesis_alertas ORDER BY criado_em DESC LIMIT 10;

-- Query de limpeza: Exclui registros com mais de 7 dias
-- DEV: Agende este comando em um cron job no banco de dados para não acumular lixo
-- DELETE FROM genesis_alertas WHERE criado_em < DATE_SUB(NOW(), INTERVAL 7 DAY);
