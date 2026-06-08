
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
    unidade_default TEXT
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


	
-- 5. Restrições para a tabela DESCARGA
ALTER TABLE descarga ADD CONSTRAINT chk_data_rececao_agendamento 
    CHECK (data_rececao IS NULL OR data_agendamento IS NULL OR data_rececao >= data_agendamento);

ALTER TABLE descarga ADD CONSTRAINT chk_data_decisao_pedido 
    CHECK (data_decisao IS NULL OR data_decisao >= data_pedido);

-- 6. Restrição para a tabela AMOSTRA (Aplica-se aqui porque as colunas pertencem a esta tabela)
ALTER TABLE amostra ADD CONSTRAINT chk_data_analise_laboratorio 
    CHECK (data_inicio_analise IS NULL OR data_inicio_analise >= data_rececao_lab);
