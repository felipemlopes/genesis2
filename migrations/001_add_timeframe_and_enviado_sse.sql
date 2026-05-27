-- Migration: Adicionar coluna timeframe e ajustar enviado_sse na tabela genesis_alertas
-- Data: 2026-05-24
-- Descrição: Adiciona coluna timeframe após corretora com DEFAULT '1h'
--            e garante que enviado_sse tem NOT NULL DEFAULT 0
-- Requisitos: 2.4, 3.4

-- Adicionar coluna timeframe (se não existir)
-- Registros antigos receberão automaticamente o DEFAULT '1h'
ALTER TABLE genesis_alertas
ADD COLUMN timeframe VARCHAR(10) NOT NULL DEFAULT '1h' COMMENT 'Timeframe do alerta (ex: 1h, 4h, 1d)' AFTER corretora;

-- Garantir que enviado_sse tem NOT NULL (caso tabela já exista sem NOT NULL)
ALTER TABLE genesis_alertas
MODIFY COLUMN enviado_sse TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Flag de controle: 1 se foi enviado pela API SSE, 0 caso contrário';

-- Verificação: confirmar que a coluna foi criada corretamente
-- SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME = 'genesis_alertas' AND COLUMN_NAME IN ('timeframe', 'enviado_sse');
