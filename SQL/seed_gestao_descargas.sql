
-- =======================================
-- DADOS INICIAIS (SEED DATA)
-- =======================================

-- PERFIS
INSERT INTO perfil (nome) VALUES
('CLIENTE'),
('OPERADOR_ETAR'),
('RESPONSAVEL_ETAR'),
('TECNICO_LAB'),
('RESPONSAVEL_LAB'),
('GESTOR_CLIENTES');

-- UTILIZADORES
INSERT INTO utilizador (id_perfil, nome, email, password_hash, ativo) VALUES
-- Clientes (id_perfil = 1)
(1, 'EmpresaIndustrialAAA SA - Produtor Industrial', 'geral@empresaIndustrialaaa.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(1, 'EmpresaIndustrialBBB SA - Produtor Industrial', 'geral@empresaIndustrialbbb.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(1, 'TransEfluentes Lda - Transportador', 'logistica@transefluentes.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),

-- Operador de Linha (id_perfil = 2)
(2, 'Carlos Silva - Operador ETAR', 'carlos.silva@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(2, 'José Teixeira - Operador ETAR', 'jose.teixeira@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),

-- Responsável de ETAR (id_perfil = 3)
(3, 'Fernando Rocha - Responsável de ETAR', 'fernando.rocha@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),

-- Técnico de Laboratório (id_perfil = 4)
(4, 'Ana Pereira - Técnica de Laboratório', 'ana.pereira@laboratorio.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),

-- Responsável de Laboratório (id_perfil = 5)
(5, 'Rui Fonseca - Diretor Laboratório', 'rui.fonseca@laboratorio.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),

-- Gestor de Clientes / Admin (id_perfil = 6)
(6, 'Mariana Costa - Gestão de Contratos', 'mariana.costa@administracao.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(6, 'António Almeida - Gestão de Clientes', 'antonio.almeida@administracao.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true);


-- CLIENTES
INSERT INTO cliente (id_utilizador, nome, morada, contacto, telefone, email, periodicidade_analise, data_ultima_analise) VALUES
(1, 'EmpresaIndustrialAAA SA', 'Zona Industrial da Maia, Lote 5', 'Rui Santos', '911111111', 'geral@empresaindustrialaaa.pt', 'MENSAL', NULL),
(2, 'EmpresaIndustrialBBB SA', 'Parque Industrial de Coimbra, Pavilhão 3', 'Marta Lima', '922222222', 'geral@empresaindustrialbbb.pt', 'TRIMESTRAL', NULL),
(3, 'TransEfluentes Lda', 'Sede Logística - Viseu', 'Jorge Duarte', '933333333', 'logistica@transefluentes.pt', 'POR_DESCARGA', NULL);

-- ETARS
INSERT INTO etar (nome, localizacao, disponivel) VALUES
('ETAR Norte', 'Porto', true),
('ETAR Centro', 'Coimbra', true),
('ETAR Sul', 'Lisboa', true),
('ETAR Algarve', 'Faro', false); -- Simulando ETAR em manutenção (Para testar o RNF06)

INSERT INTO parametro (nome, tipo_parametro, unidade_default, obrigatorio) VALUES
('pH', 'FISICO_QUIMICO', 'pH', TRUE),
('CQO', 'FISICO_QUIMICO', 'mg/L', TRUE),
('CBO5', 'FISICO_QUIMICO', 'mg/L', TRUE),
('SST', 'FISICO_QUIMICO', 'mg/L', TRUE),
('Condutividade', 'FISICO_QUIMICO', 'mS/cm', TRUE),
('Azoto Kjeldahl', 'AZOTO', 'mg/L', FALSE),
('Zinco', 'METAIS', 'mg/L', FALSE);

-- CLIENTE_PARAMETRO (parametros adicionais por cliente)
INSERT INTO cliente_parametro (id_cliente, id_parametro, ativo) VALUES
-- Empresa A tem Azoto
(1, 6, TRUE),

-- Empresa B tem Azoto e Metais
(2, 6, TRUE),
(2, 7, TRUE);

-- AUTORIZACOES
INSERT INTO autorizacao (id_cliente, id_etar, quota, ativo, auto_aprovacao) VALUES
-- Empresa Industrial AAA (id_cliente = 1)
(1, 1, 5, true, true),  -- Autorizada em ETAR Norte (Auto-Aprovação Ativa)

-- Empresa Industrial BBB (id_cliente = 2)
(2, 2, 3, true, false), -- Autorizada em ETAR Centro (Aprovação Manual da Gestão)

-- TransEfluentes Lda - Transportador (id_cliente = 3)
(3, 1, 10, true, true), -- Autorizado em ETAR Norte
(3, 2, 10, true, true); -- Autorizado em ETAR Centro

-- DESCARGAS

-- SOLICITADA
INSERT INTO descarga (
    id_cliente, id_etar, data_pedido, tipo_efluente, quantidade, numero_recipientes, estado_descarga
) VALUES (
    1, 1, NOW() - INTERVAL '1 day', 'Domestico', 100, 2, 'SOLICITADA'
);

-- AUTORIZADA
INSERT INTO descarga (
    id_cliente, id_etar, data_pedido, tipo_efluente, quantidade,
    estado_descarga, data_decisao, id_utilizador_decisao
) VALUES (
    1, 1, NOW() - INTERVAL '2 days', 'Industrial', 200,
    'AUTORIZADA', NOW() - INTERVAL '1 day', 6
);

-- AGENDADA
INSERT INTO descarga (
    id_cliente, id_etar, data_pedido, tipo_efluente, quantidade,
    estado_descarga, data_decisao, id_utilizador_decisao,
    data_agendamento, empresa_transportadora,
    matricula_trator, matricula_cisterna
) VALUES (
    1, 1, NOW() - INTERVAL '3 days', 'Industrial', 300,
    'AGENDADA', NOW() - INTERVAL '2 days', 6,
    NOW() - INTERVAL '1 day', 'Transportes X',
    'AA-00-AA', 'BB-00-BB'
);

-- RECEBIDA
INSERT INTO descarga (
    id_cliente, id_etar, data_pedido, tipo_efluente, quantidade,
    estado_descarga, data_decisao, id_utilizador_decisao,
    data_agendamento, data_rececao, quantidade_real, recolha_amostra,
    id_utilizador_rececao
) VALUES (
    2, 1, NOW() - INTERVAL '4 days', 'Domestico', 150,
    'RECEBIDA', NOW() - INTERVAL '3 days', 6,
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 145, true,
    5
);

-- AMOSTRA
INSERT INTO amostra (
    id_descarga, estado_amostra,
    data_recolha, data_rececao_lab,
    data_inicio_analise,
    id_tecnico, id_responsavel
) VALUES (
    4, 'EM_ANALISE',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day',
    NOW(),
    7, 8
);

-- RESULTADOS ANALITICOS
INSERT INTO resultado_analitico (
    id_amostra, id_parametro, valor, unidade
) VALUES
(1, 1, 7.2, 'pH'),
(1, 2, 500, 'mg/L'),
(1, 6, 120, 'mg/L');

-- NOTIFICACOES
INSERT INTO notificacao (id_utilizador, mensagem, tipo, enviada) VALUES
(1, 'Descarga autorizada', 'DESCARGA', TRUE),
(2, 'Descarga rejeitada', 'DESCARGA', TRUE),
(3, 'Nova receção registada', 'SISTEMA', TRUE);

-- HISTORICO
INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES
('DESCARGA', 2, 'AUTORIZACAO', 'Descarga autorizada pelo gestor', 9),
('DESCARGA', 3, 'AGENDAMENTO', 'Descarga agendada pelo cliente', 1),
('DESCARGA', 4, 'RECECAO', 'Receção realizada pelo operador', 4);

-- ASSOCIACAO DE ETARS A UTILIZADORES
UPDATE utilizador SET id_etar = 1 WHERE email = 'carlos.silva@etar.pt';
UPDATE utilizador SET id_etar = 2 WHERE email = 'jose.teixeira@etar.pt';
UPDATE utilizador SET id_etar = 1 WHERE email = 'fernando.rocha@etar.pt';
