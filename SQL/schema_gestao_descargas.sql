
-- ENUMS
CREATE TYPE estado_descarga_enum AS ENUM ('SOLICITADA','AUTORIZADA','REJEITADA','AGENDADA','RECEBIDA','CONCLUIDA');
CREATE TYPE estado_amostra_enum AS ENUM ('RECOLHIDA','EM_TRANSITO','RECEBIDA','EM_ANALISE','ANALISADA','DESCARTADA','CONCLUIDA');
CREATE TYPE tipo_parametro_enum AS ENUM ('FISICO_QUIMICO','AZOTO','METAIS','OLEOS E GORDURAS');
CREATE TYPE tipo_notificacao_enum AS ENUM ('DESCARGA','AMOSTRA','LABORATORIO','SISTEMA');


-- PERFIL
CREATE TABLE perfil (
    id_perfil SERIAL PRIMARY KEY,
    nome TEXT UNIQUE NOT NULL
);

-- UTILIZADOR
CREATE TABLE utilizador (
    id_utilizador SERIAL PRIMARY KEY,
    id_perfil INT NOT NULL,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_perfil) REFERENCES perfil(id_perfil)
);

-- CLIENTE
CREATE TABLE cliente (
    id_cliente SERIAL PRIMARY KEY,
    id_utilizador INT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    morada TEXT,
    contacto TEXT,
    telefone TEXT,
    email TEXT,
    periodicidade_analise TEXT,
    data_ultima_analise TIMESTAMP,
    FOREIGN KEY (id_utilizador) REFERENCES utilizador(id_utilizador)
);

-- ETAR
CREATE TABLE etar (
    id_etar SERIAL PRIMARY KEY,
    nome TEXT NOT NULL,
    localizacao TEXT,
    disponivel BOOLEAN DEFAULT TRUE
);

-- PARAMETRO
CREATE TABLE parametro (
    id_parametro SERIAL PRIMARY KEY,
    nome TEXT UNIQUE NOT NULL,
    tipo_parametro tipo_parametro_enum NOT NULL,
    unidade_default TEXT,
    metodo_default_cod TEXT,
    metodo_default_nome TEXT,
    incerteza_default NUMERIC CHECK (incerteza_default >= 0)
);

-- DESCARGA
CREATE TABLE descarga (
    id_descarga SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_etar INT,
    data_pedido TIMESTAMP NOT NULL,
    tipo_efluente TEXT NOT NULL,
    quantidade NUMERIC CHECK (quantidade > 0),
    numero_recipientes INT,
    estado_descarga estado_descarga_enum NOT NULL,
    data_decisao TIMESTAMP,
    id_utilizador_decisao INT,
    data_agendamento TIMESTAMP,
    empresa_transportadora TEXT,
    nome_produtor_externo TEXT,
    morada_produtor_externo TEXT,
    matricula_trator TEXT,
    matricula_cisterna TEXT,
    data_rececao TIMESTAMP,
    quantidade_real NUMERIC CHECK (quantidade_real > 0),
    recolha_amostra BOOLEAN,
    observacoes TEXT,
    id_utilizador_rececao INT,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_etar) REFERENCES etar(id_etar),
    FOREIGN KEY (id_utilizador_decisao) REFERENCES utilizador(id_utilizador),
    FOREIGN KEY (id_utilizador_rececao) REFERENCES utilizador(id_utilizador)
);

-- AMOSTRA
CREATE TABLE amostra (
    id_amostra SERIAL PRIMARY KEY,
    id_descarga INT NOT NULL,
    estado_amostra estado_amostra_enum NOT NULL,
    data_recolha TIMESTAMP,
    data_rececao_lab TIMESTAMP,
    data_inicio_analise TIMESTAMP,
    data_fim_analise TIMESTAMP,
    data_descarte TIMESTAMP,
    data_validacao TIMESTAMP,
    id_tecnico INT,
    id_responsavel INT,
    boletim_publico BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_descarga) REFERENCES descarga(id_descarga),
    FOREIGN KEY (id_tecnico) REFERENCES utilizador(id_utilizador),
    FOREIGN KEY (id_responsavel) REFERENCES utilizador(id_utilizador)
);

-- RESULTADO ANALITICO
CREATE TABLE resultado_analitico (
    id_resultado SERIAL PRIMARY KEY,
    id_amostra INT NOT NULL,
    id_parametro INT NOT NULL,
    valor NUMERIC,
    unidade TEXT,
    metodo TEXT,
    incerteza NUMERIC,
    FOREIGN KEY (id_amostra) REFERENCES amostra(id_amostra),
    FOREIGN KEY (id_parametro) REFERENCES parametro(id_parametro)
);

-- AUTORIZACAO
CREATE TABLE autorizacao (
    id_autorizacao SERIAL PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_etar INT NOT NULL,
    quota INT,
    ativo BOOLEAN DEFAULT TRUE,
    auto_aprovacao BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_etar) REFERENCES etar(id_etar),
    UNIQUE (id_cliente, id_etar)
);

-- HISTORICO
CREATE TABLE historico (
    id_historico SERIAL PRIMARY KEY,
    entidade TEXT NOT NULL,
    id_entidade INT NOT NULL,
    acao TEXT NOT NULL,
    descricao TEXT,
    data TIMESTAMP DEFAULT NOW(),
    id_utilizador INT NOT NULL,
    FOREIGN KEY (id_utilizador) REFERENCES utilizador(id_utilizador)
);

-- NOTIFICACAO
CREATE TABLE notificacao (
    id_notificacao SERIAL PRIMARY KEY,
    id_utilizador INT NOT NULL,
    mensagem TEXT NOT NULL,
    tipo tipo_notificacao_enum,
    enviada BOOLEAN DEFAULT FALSE,
    lida BOOLEAN DEFAULT FALSE,
    data TIMESTAMP DEFAULT NOW(),

    CONSTRAINT fk_notificacao_utilizador
        FOREIGN KEY (id_utilizador) REFERENCES utilizador(id_utilizador),

    CONSTRAINT chk_mensagem_not_empty
        CHECK (TRIM(mensagem) <> ''),

    CONSTRAINT chk_lida_enviada
        CHECK (enviada = TRUE OR lida = FALSE)
);




-- 1. Associar Operador a uma Etar específica
ALTER TABLE utilizador
ADD COLUMN id_etar INT; 

-- 2. Criar nova tabela - Associar Cliente a Parametro (conjunto de parametros)
CREATE TABLE cliente_parametro (
    id_cliente INT NOT NULL,
    id_parametro INT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,

    PRIMARY KEY (id_cliente, id_parametro),
    
    FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    FOREIGN KEY (id_parametro) REFERENCES parametro(id_parametro)
);

-- 3. Alteração à tabela PARAMETRO
ALTER TABLE parametro
ADD COLUMN obrigatorio BOOLEAN DEFAULT FALSE;

   --3.1.  Marcar os parâmetros físico-químicos como obrigatórios
UPDATE parametro
SET obrigatorio = TRUE
WHERE tipo_parametro = 'FISICO_QUIMICO';

-- 4. Alteração à tabela DESCARGA e AMOSTRA
	-- 4.1 Adicionar coluna qr_code_token à tabela descarga
ALTER TABLE descarga ADD COLUMN IF NOT EXISTS qr_code_token TEXT UNIQUE;

	-- 4.2 Adicionar coluna qr_code_token à tabela amostra
ALTER TABLE amostra ADD COLUMN IF NOT EXISTS qr_code_token TEXT UNIQUE;
	
-- 5. Restrições para a tabela DESCARGA
ALTER TABLE descarga ADD CONSTRAINT chk_data_rececao_agendamento 
    CHECK (data_rececao IS NULL OR data_agendamento IS NULL OR data_rececao >= data_agendamento);

ALTER TABLE descarga ADD CONSTRAINT chk_data_decisao_pedido 
    CHECK (data_decisao IS NULL OR data_decisao >= data_pedido);

ALTER TABLE descarga ADD CONSTRAINT chk_data_agendamento_decisao
    CHECK (data_agendamento IS NULL OR data_decisao IS NULL OR data_agendamento >= data_decisao);

ALTER TABLE descarga ADD CONSTRAINT chk_numero_recipientes_positivo
    CHECK (numero_recipientes IS NULL OR numero_recipientes > 0);

ALTER TABLE descarga ADD CONSTRAINT chk_quantidade_real_desvio
    CHECK (quantidade_real IS NULL OR 
           (quantidade_real >= quantidade * 0.1 AND quantidade_real <= quantidade * 2.0));

-- 6. Restrições para a tabela AMOSTRA
ALTER TABLE amostra ADD CONSTRAINT chk_data_analise_laboratorio 
    CHECK (data_inicio_analise IS NULL OR data_inicio_analise >= data_rececao_lab);

ALTER TABLE amostra ADD CONSTRAINT chk_data_rececao_lab_recolha
    CHECK (data_rececao_lab IS NULL OR data_recolha IS NULL OR data_rececao_lab >= data_recolha);

ALTER TABLE amostra ADD CONSTRAINT chk_data_fim_analise_inicio
    CHECK (data_fim_analise IS NULL OR data_inicio_analise IS NULL OR data_fim_analise >= data_inicio_analise);

ALTER TABLE amostra ADD CONSTRAINT chk_data_validacao_fim_analise
    CHECK (data_validacao IS NULL OR data_fim_analise IS NULL OR data_validacao >= data_fim_analise);

-- Uma descarga só pode ter uma amostra
ALTER TABLE amostra ADD CONSTRAINT uq_amostra_por_descarga
    UNIQUE (id_descarga);

-- 7. Restrições para RESULTADO_ANALITICO
ALTER TABLE resultado_analitico ADD CONSTRAINT chk_valor_positivo
    CHECK (valor IS NULL OR valor >= 0);

ALTER TABLE resultado_analitico ADD CONSTRAINT chk_incerteza_positiva
    CHECK (incerteza IS NULL OR incerteza >= 0);

-- O mesmo parâmetro não pode ser repetido na mesma amostra
ALTER TABLE resultado_analitico ADD CONSTRAINT uq_resultado_amostra_parametro
    UNIQUE (id_amostra, id_parametro);

-- 8. Restrições para AUTORIZACAO
ALTER TABLE autorizacao ADD CONSTRAINT chk_quota_positiva
    CHECK (quota IS NULL OR quota > 0);

-- 9. Restrições para UTILIZADOR
ALTER TABLE utilizador ADD CONSTRAINT chk_utilizador_nome_not_empty
    CHECK (TRIM(nome) <> '');

ALTER TABLE utilizador ADD CONSTRAINT chk_email_formato
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 10. Restrições para CLIENTE
ALTER TABLE cliente ADD CONSTRAINT chk_cliente_nome_not_empty
    CHECK (TRIM(nome) <> '');

ALTER TABLE cliente ADD CONSTRAINT chk_periodicidade_analise
    CHECK (periodicidade_analise IS NULL OR 
           periodicidade_analise IN ('POR_DESCARGA', 'QUINZENAL', 'MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL'));

-- 11. Restrições para ETAR
ALTER TABLE etar ADD CONSTRAINT chk_etar_nome_not_empty
    CHECK (TRIM(nome) <> '');

-- 12. Restrições para HISTORICO
ALTER TABLE historico ADD CONSTRAINT chk_entidade_valida
    CHECK (entidade IN ('DESCARGA', 'AMOSTRA', 'PARAMETRO', 'AUTORIZACAO', 
                        'ETAR', 'PERFIL', 'SISTEMA', 'UTILIZADOR', 'CLIENTE'));

