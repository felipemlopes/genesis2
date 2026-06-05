-- Migration: Adicionar colunas motivos, timeframes, score e expires_at na tabela genesis_alertas
-- Autor: Kiro
-- Data: 2026-06-04
-- Descrição: Adiciona campos necessários para o monitor_worker gravar alertas com motivos,
--            timeframes ativos, score de confiança e expiração automática.

-- Adicionar coluna motivos (JSON com array de motivos do alerta)
ALTER TABLE genesis_alertas
ADD COLUMN motivos JSON DEFAULT NULL COMMENT 'Array JSON com os motivos/indicadores que geraram o alerta' AFTER variacao_pct;

-- Adicionar coluna timeframes (JSON com timeframes onde o sinal foi detectado)
ALTER TABLE genesis_alertas
ADD COLUMN timeframes JSON DEFAULT NULL COMMENT 'Array JSON com timeframes onde o sinal aparece' AFTER motivos;

-- Adicionar coluna score (pontuação de confiança do alerta)
ALTER TABLE genesis_alertas
ADD COLUMN score INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Score de confiança do alerta (0-100)' AFTER timeframes;

-- Adicionar coluna expires_at (expiração automática do alerta)
ALTER TABLE genesis_alertas
ADD COLUMN expires_at DATETIME DEFAULT NULL COMMENT 'Data/hora em que o alerta expira e não deve mais ser exibido' AFTER score;

-- Adicionar coluna updated_at (para compatibilidade com o código)
ALTER TABLE genesis_alertas
ADD COLUMN updated_at DATETIME DEFAULT NULL COMMENT 'Última atualização do registro' AFTER criado_em;
