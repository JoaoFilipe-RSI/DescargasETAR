-- =======================================
-- ADIÇÃO DE NOVOS UTILIZADORES DE TESTE
-- =======================================

-- Insere apenas os novos utilizadores adicionados recentemente ao seed,
-- sem causar conflitos ou duplicações se já existirem na base de dados.
INSERT INTO utilizador (id_perfil, nome, email, password_hash, ativo, id_etar) VALUES
-- Operadores (id_perfil = 2)
(2, 'Bruno Nogueira', 'bruno.nogueira@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true, 1),
(2, 'Diana Santos', 'diana.santos@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true, 2),
(2, 'Filipe Abreu', 'filipe.abreu@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true, 3),
(2, 'Gabriela Rodrigues', 'gabriela.rodrigues@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true, 3),
(2, 'Igor Gomes', 'igor.gomes@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true, 4),
(2, 'Joana Cruz', 'joana.cruz@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true, 4),

-- Responsáveis de ETAR (id_perfil = 3)
(3, 'Eduardo Lima', 'eduardo.lima@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true, 2),
(3, 'Helder Costa', 'helder.costa@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true, 3),
(3, 'Katia Martins', 'katia.martins@etar.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true, 4),

-- Técnico de Laboratório (id_perfil = 4)
(4, 'Pedro Sousa', 'pedro.sousa@laboratorio.pt', '$2b$12$K3vZg7mQxO7pL2R1vK9uOuE7eHB5V2p8FzJ9w6tGx4yM1qR3oSa2q', true, NULL),

ON CONFLICT (email) DO NOTHING;
