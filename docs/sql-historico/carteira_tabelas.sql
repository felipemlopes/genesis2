-- PASSO 1: Tabelas para o sistema de Carteira Cripto
-- DEV: O campo user_id deve corresponder ao identificador de usuário já usado no sistema de autenticação do projeto.

-- Tabela genesis_carteira_mae para a carteira do administrador
CREATE TABLE IF NOT EXISTS genesis_carteira_mae (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ativo VARCHAR(20) NOT NULL COMMENT 'Símbolo da criptomoeda como BTC ETH SOL',
    nome_completo VARCHAR(100) COMMENT 'Nome completo como Bitcoin',
    corretora VARCHAR(20) NOT NULL COMMENT 'BINANCE BYBIT BITGET OKX',
    preco_entrada DECIMAL(20,8) NOT NULL COMMENT 'Preço pago na entrada',
    preco_atual DECIMAL(20,8) COMMENT 'Atualizado automaticamente via API',
    data_entrada DATE NOT NULL,
    tipo ENUM('GEMA', 'PRJ') NOT NULL,
    alvo_cima DECIMAL(20,8) COMMENT 'Preço alvo para cima',
    alvo_baixo DECIMAL(20,8) COMMENT 'Preço alvo para baixo',
    telegram_mensagem TEXT COMMENT 'Mensagem personalizada a disparar quando atingir alvo',
    status ENUM('ATIVO', 'VENDIDO') DEFAULT 'ATIVO',
    preco_venda DECIMAL(20,8) COMMENT 'Preço realizado na venda',
    data_venda DATE,
    observacoes TEXT,
    criado_em DATETIME NOT NULL,
    atualizado_em DATETIME
);

-- Índices recomendados para facilitar a busca
CREATE INDEX idx_mae_status ON genesis_carteira_mae(status);
CREATE INDEX idx_mae_ativo ON genesis_carteira_mae(ativo);

-- Tabela genesis_carteira_membro para a carteira individual de cada membro
CREATE TABLE IF NOT EXISTS genesis_carteira_membro (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL COMMENT 'Identificador único do membro do sistema de autenticação existente',
    ativo VARCHAR(20) NOT NULL,
    nome_completo VARCHAR(100),
    corretora VARCHAR(20) NOT NULL,
    preco_entrada DECIMAL(20,8) NOT NULL,
    preco_atual DECIMAL(20,8),
    data_entrada DATE NOT NULL,
    tipo ENUM('GEMA', 'PRJ') NOT NULL,
    alvo_saida DECIMAL(20,8) COMMENT 'Preço alvo para receber aviso',
    status ENUM('ATIVO', 'VENDIDO') DEFAULT 'ATIVO',
    preco_venda DECIMAL(20,8),
    data_venda DATE,
    observacoes TEXT,
    criado_em DATETIME NOT NULL,
    atualizado_em DATETIME
);

-- Índices recomendados para facilitar a busca
CREATE INDEX idx_membro_user_id ON genesis_carteira_membro(user_id);
CREATE INDEX idx_membro_status ON genesis_carteira_membro(status);
CREATE INDEX idx_membro_ativo ON genesis_carteira_membro(ativo);

-- Tabela genesis_carteira_gemas
CREATE TABLE IF NOT EXISTS genesis_carteira_gemas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ativo VARCHAR(20) NOT NULL,
    nome_completo VARCHAR(100),
    corretora VARCHAR(20) NOT NULL,
    preco_entrada DECIMAL(20,8) NOT NULL,
    preco_atual DECIMAL(20,8),
    data_entrada DATE NOT NULL,
    tipo ENUM('GEMA', 'PRJ') NOT NULL,
    alvo_cima DECIMAL(20,8),
    alvo_baixo DECIMAL(20,8),
    telegram_mensagem TEXT,
    status ENUM('ATIVO', 'VENDIDO') DEFAULT 'ATIVO',
    preco_venda DECIMAL(20,8),
    data_venda DATE,
    observacoes TEXT,
    criado_em DATETIME NOT NULL,
    atualizado_em DATETIME
);

-- Tabela genesis_analises para histórico de análises dos membros
CREATE TABLE IF NOT EXISTS genesis_analises (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL COMMENT 'identificador do membro',
    ativo VARCHAR(20) NOT NULL COMMENT 'par analisado como BTCUSDT',
    corretora VARCHAR(20) COMMENT 'BINANCE BYBIT OKX BITGET',
    timeframe VARCHAR(10) COMMENT '1h 4h 1d etc',
    score INT COMMENT 'score de confluência de 0 a 100',
    vies VARCHAR(20) COMMENT 'LONG_FORTE SHORT_MODERADO NEUTRO etc',
    direcao VARCHAR(10) COMMENT 'LONG ou SHORT ou NEUTRO',
    alavancagem VARCHAR(10) COMMENT 'alavancagem selecionada pelo membro',
    resumo_analise TEXT COMMENT 'síntese gerada pelo Gemini em até 500 caracteres',
    setup_entrada TEXT COMMENT 'plano A e plano B resumidos',
    stop_loss DECIMAL(20,8),
    take_profit_1 DECIMAL(20,8),
    take_profit_2 DECIMAL(20,8),
    take_profit_3 DECIMAL(20,8),
    risco_retorno VARCHAR(20),
    criado_em DATETIME NOT NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_criado_em (criado_em)
);

-- CORREÇÃO 1 - ADICIONAR CAMPOS À TABELA
ALTER TABLE genesis_analises 
ADD COLUMN IF NOT EXISTS resultado ENUM('TP1_ATINGIDO', 'TP2_ATINGIDO', 'TP3_ATINGIDO', 'STOP_ATINGIDO', 'PENDENTE') DEFAULT 'PENDENTE',
ADD COLUMN IF NOT EXISTS preco_resultado DECIMAL(20,8),
ADD COLUMN IF NOT EXISTS data_resultado DATETIME,
ADD COLUMN IF NOT EXISTS lucro_percentual DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS risco_retorno_realizado DECIMAL(10,4);
