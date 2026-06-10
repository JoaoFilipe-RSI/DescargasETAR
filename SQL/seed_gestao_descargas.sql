
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
('GESTOR_CLIENTES'),
('GESTOR_ADMIN');

-- UTILIZADORES
INSERT INTO utilizador (id_perfil, nome, email, password_hash, ativo) VALUES
-- Clientes (id_perfil = 1)
(1, 'EmpresaIndustrialAAA SA', 'geral@empresaIndustrialaaa.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(1, 'EmpresaIndustrialBBB SA', 'geral@empresaIndustrialbbb.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(1, 'TransEfluentes Lda', 'logistica@transefluentes.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),

-- Operadores (id_perfil = 2)
(2, 'Carlos Silva', 'carlos.silva@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(2, 'José Teixeira', 'jose.teixeira@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(2, 'Bruno Nogueira', 'bruno.nogueira@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(2, 'Diana Santos', 'diana.santos@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(2, 'Filipe Abreu', 'filipe.abreu@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(2, 'Gabriela Sousa', 'gabriela.sousa@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(2, 'Igor Gomes', 'igor.gomes@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(2, 'Joana Cruz', 'joana.cruz@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),

-- Responsáveis de ETAR (id_perfil = 3)
(3, 'Fernando Rocha', 'fernando.rocha@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(3, 'Eduardo Lima', 'eduardo.lima@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(3, 'Helder Costa', 'helder.costa@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(3, 'Katia Martins', 'katia.martins@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),

-- Técnicos de Laboratório (id_perfil = 4)
(4, 'Ana Pereira', 'ana.pereira@laboratorio.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(4, 'Pedro Sousa', 'pedro.sousa@laboratorio.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),

-- Responsável de Laboratório (id_perfil = 5)
(5, 'Rui Fonseca', 'rui.fonseca@laboratorio.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),

-- Gestor de Clientes / Admin (id_perfil = 6 / 7)
(6, 'Mariana Costa', 'mariana.costa@administracao.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(6, 'António Almeida', 'antonio.almeida@administracao.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true),
(7, 'Filipe Ferreira', 'filipe.ferreira@admin.entidadegestora.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true);


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

INSERT INTO parametro (nome, tipo_parametro, unidade_default, obrigatorio, metodo_default_cod, metodo_default_nome, incerteza_default) VALUES
('pH', 'FISICO_QUIMICO', 'pH', TRUE, 'SMEWW 4500-H+', 'Eletrometria', 0.015),
('CQO', 'FISICO_QUIMICO', 'mg/L', TRUE, 'SMEWW 5220 B', 'Refluxo Fechado / Titulometria', 0.05),
('CBO5', 'FISICO_QUIMICO', 'mg/L', TRUE, 'SMEWW 5210 B', 'Incubação / Eletrométrico', 0.08),
('SST', 'FISICO_QUIMICO', 'mg/L', TRUE, 'SMEWW 2540 D', 'Secagem a 103-105ºC / Gravimetria', 0.10),
('Condutividade', 'FISICO_QUIMICO', 'mS/cm', TRUE, 'SMEWW 2510 B', 'Condutimetria', 0.05),
('Azoto Kjeldahl', 'AZOTO', 'mg/L', FALSE, 'SMEWW 4500-N', 'Digestão / Destilação / Titulometria', 0.06),
('Zinco', 'METAIS', 'mg/L', FALSE, 'SMEWW 3111 B', 'Espectrofotometria de Absorção Atómica (EAA)', 0.05);

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
    'AUTORIZADA', NOW() - INTERVAL '1 day', 19
);

-- AGENDADA
INSERT INTO descarga (
    id_cliente, id_etar, data_pedido, tipo_efluente, quantidade,
    estado_descarga, data_decisao, id_utilizador_decisao,
    data_agendamento, empresa_transportadora,
    matricula_trator, matricula_cisterna
) VALUES (
    1, 1, NOW() - INTERVAL '3 days', 'Industrial', 300,
    'AGENDADA', NOW() - INTERVAL '2 days', 19,
    NOW() - INTERVAL '1 day', 'Transportes X',
    'AA-00-AA', 'BB-00-BB'
);

-- RECEBIDA
INSERT INTO descarga (
    id_cliente, id_etar, data_pedido, tipo_efluente, quantidade,
    estado_descarga, data_decisao, id_utilizador_decisao,
    data_agendamento, data_rececao, quantidade_real, recolha_amostra,
    id_utilizador_rececao, empresa_transportadora, matricula_trator
) VALUES (
    2, 1, NOW() - INTERVAL '4 days', 'Domestico', 150,
    'RECEBIDA', NOW() - INTERVAL '3 days', 19,
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 145, true,
    4, 'Transportes Y', 'IT-45_LL'
);

-- AMOSTRA
INSERT INTO amostra (
    id_descarga, estado_amostra,
    data_recolha, data_rececao_lab,
    data_inicio_analise,
    id_tecnico, id_responsavel,
    qr_code_token
) VALUES (
    4, 'EM_ANALISE',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day',
    NOW(),
    16, 18,
    'AMOSTRA-2026-BBB99F'
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
('DESCARGA', 2, 'AUTORIZACAO', 'Descarga autorizada pelo gestor', 19),
('DESCARGA', 3, 'AGENDAMENTO', 'Descarga agendada pelo cliente', 1),
('DESCARGA', 4, 'RECECAO', 'Receção realizada pelo operador', 4);

-- ASSOCIACAO DE ETARS A UTILIZADORES
UPDATE utilizador SET id_etar = 1 WHERE email = 'carlos.silva@etar.pt';
UPDATE utilizador SET id_etar = 2 WHERE email = 'jose.teixeira@etar.pt';
UPDATE utilizador SET id_etar = 1 WHERE email = 'fernando.rocha@etar.pt';

-- Novas associações de ETARs para operadores e responsáveis de teste
UPDATE utilizador SET id_etar = 1 WHERE email = 'bruno.nogueira@etar.pt';
UPDATE utilizador SET id_etar = 2 WHERE email = 'diana.santos@etar.pt';
UPDATE utilizador SET id_etar = 2 WHERE email = 'eduardo.lima@etar.pt';
UPDATE utilizador SET id_etar = 3 WHERE email = 'filipe.abreu@etar.pt';
UPDATE utilizador SET id_etar = 3 WHERE email = 'gabriela.sousa@etar.pt';
UPDATE utilizador SET id_etar = 3 WHERE email = 'helder.costa@etar.pt';
UPDATE utilizador SET id_etar = 4 WHERE email = 'igor.gomes@etar.pt';
UPDATE utilizador SET id_etar = 4 WHERE email = 'joana.cruz@etar.pt';
UPDATE utilizador SET id_etar = 4 WHERE email = 'katia.martins@etar.pt';
