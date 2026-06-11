-- =================================================================
-- MIGRAÇÃO: Adição de Constraints em Falta — db_descargas
-- Data: 2026-06-11
-- Aplicar após verificar compatibilidade dos dados existentes
-- =================================================================

BEGIN;

-- ── DESCARGA ──────────────────────────────────────────────────────

-- Número de recipientes deve ser positivo (quando preenchido)
ALTER TABLE descarga ADD CONSTRAINT chk_numero_recipientes_positivo
    CHECK (numero_recipientes IS NULL OR numero_recipientes > 0);

-- O agendamento deve ocorrer depois (ou no mesmo momento) da decisão
ALTER TABLE descarga ADD CONSTRAINT chk_data_agendamento_decisao
    CHECK (data_agendamento IS NULL OR data_decisao IS NULL 
           OR data_agendamento >= data_decisao);

-- A quantidade real não deve desviar mais de 10x (mínimo 10% da solicitada,
-- máximo 200%) — protege contra erros grosseiros de digitação
ALTER TABLE descarga ADD CONSTRAINT chk_quantidade_real_desvio
    CHECK (quantidade_real IS NULL OR 
           (quantidade_real >= quantidade * 0.1 
            AND quantidade_real <= quantidade * 2.0));

-- ── AMOSTRA ───────────────────────────────────────────────────────

-- Cada descarga só pode ter uma amostra associada
ALTER TABLE amostra ADD CONSTRAINT uq_amostra_por_descarga
    UNIQUE (id_descarga);

-- A receção no laboratório deve ser posterior à recolha
ALTER TABLE amostra ADD CONSTRAINT chk_data_rececao_lab_recolha
    CHECK (data_rececao_lab IS NULL OR data_recolha IS NULL 
           OR data_rececao_lab >= data_recolha);

-- O fim da análise deve ser posterior (ou simultâneo) ao início
ALTER TABLE amostra ADD CONSTRAINT chk_data_fim_analise_inicio
    CHECK (data_fim_analise IS NULL OR data_inicio_analise IS NULL 
           OR data_fim_analise >= data_inicio_analise);

-- A validação deve ocorrer depois do fim da análise
ALTER TABLE amostra ADD CONSTRAINT chk_data_validacao_fim_analise
    CHECK (data_validacao IS NULL OR data_fim_analise IS NULL 
           OR data_validacao >= data_fim_analise);

-- ── RESULTADO ANALITICO ───────────────────────────────────────────

-- Valor analítico não pode ser negativo (concentrações, pH, etc.)
ALTER TABLE resultado_analitico ADD CONSTRAINT chk_valor_positivo
    CHECK (valor IS NULL OR valor >= 0);

-- Incerteza analítica não pode ser negativa
ALTER TABLE resultado_analitico ADD CONSTRAINT chk_incerteza_positiva
    CHECK (incerteza IS NULL OR incerteza >= 0);

-- O mesmo parâmetro não pode ser registado duas vezes na mesma amostra
ALTER TABLE resultado_analitico ADD CONSTRAINT uq_resultado_amostra_parametro
    UNIQUE (id_amostra, id_parametro);

-- ── AUTORIZACAO ───────────────────────────────────────────────────

-- A quota de descargas deve ser positiva (ou nula = ilimitada)
ALTER TABLE autorizacao ADD CONSTRAINT chk_quota_positiva
    CHECK (quota IS NULL OR quota > 0);

-- ── UTILIZADOR ────────────────────────────────────────────────────

-- Nome do utilizador não pode ser em branco
ALTER TABLE utilizador ADD CONSTRAINT chk_utilizador_nome_not_empty
    CHECK (TRIM(nome) <> '');

-- Email deve ter formato válido
ALTER TABLE utilizador ADD CONSTRAINT chk_email_formato
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- ── CLIENTE ───────────────────────────────────────────────────────

-- Nome do cliente não pode ser em branco
ALTER TABLE cliente ADD CONSTRAINT chk_cliente_nome_not_empty
    CHECK (TRIM(nome) <> '');

-- Periodicidade de análise restrita aos valores válidos do negócio
-- (inclui QUINZENAL que existe nos dados actuais)
ALTER TABLE cliente ADD CONSTRAINT chk_periodicidade_analise
    CHECK (periodicidade_analise IS NULL OR 
           periodicidade_analise IN (
               'POR_DESCARGA', 'QUINZENAL', 'MENSAL', 
               'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'
           ));

-- ── ETAR ──────────────────────────────────────────────────────────

-- Nome da ETAR não pode ser em branco
ALTER TABLE etar ADD CONSTRAINT chk_etar_nome_not_empty
    CHECK (TRIM(nome) <> '');

-- ── HISTORICO ─────────────────────────────────────────────────────

-- Entidade de auditoria restrita aos valores definidos no sistema
-- (inclui CLIENTE que já existe nos dados actuais)
ALTER TABLE historico ADD CONSTRAINT chk_entidade_valida
    CHECK (entidade IN (
        'DESCARGA', 'AMOSTRA', 'PARAMETRO', 'AUTORIZACAO',
        'ETAR', 'PERFIL', 'SISTEMA', 'UTILIZADOR', 'CLIENTE'
    ));

COMMIT;
