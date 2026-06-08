-- Adicionar coluna qr_code_token à tabela descarga
ALTER TABLE descarga ADD COLUMN IF NOT EXISTS qr_code_token TEXT UNIQUE;

-- Adicionar coluna qr_code_token à tabela amostra
ALTER TABLE amostra ADD COLUMN IF NOT EXISTS qr_code_token TEXT UNIQUE;
