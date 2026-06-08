# Gestão de Descargas Autoportantes nas ETAR

Este projeto consiste num sistema integrado para digitalização, centralização e gestão das descargas autoportantes (camiões cisterna) de águas residuais nas Estações de Tratamento de Águas Residuais (ETAR). A plataforma substitui os impressos físicos em papel por fluxos de trabalho digitais e automáticos.

---

## 🎯 Objetivos do Projeto

1.  **Digitalização**: Eliminação do papel através de formulários digitais padronizados.
2.  **Centralização**: Histórico estruturado de descargas por cliente, ETAR e transportador.
3.  **Controlo de Acessos**: Diferentes perfis de utilizadores (Clientes, Operadores ETAR, Técnicos de Laboratório, Gestão de Clientes/ETAR).
4.  **Motor de Regras**:
    *   **Auto-Aprovação**: Validação de Whitelists e quotas diárias contratadas.
    *   **Gestão de Contingência**: Bloqueio e reencaminhamento automático em caso de indisponibilidade súbita de uma ETAR.
    *   **Triagem de Amostras**: Motor para decidir se uma amostra deve ser analisada ou descartada com base na periodicidade contratada.

---

## 🛠️ Stack Tecnológica

*   **Backend**: Node.js com Express (API RESTful) e HTTP Nativo.
*   **Base de Dados**: PostgreSQL (gerido com pgAdmin 4).
*   **Comunicação em Tempo Real**: Socket.io (servidor) e Socket.io-client (cliente).
*   **Frontend**: React.js 18 + Vite 5 (PWA - Progressive Web App).
*   **Estilização**: CSS Vanilla (Design System com variáveis personalizadas HSL e Glassmorphism).
*   **Segurança**: JSON Web Tokens (JWT) e hashing de passwords com Bcrypt.
*   **Alojamento (Planeado)**: AWS RDS (PostgreSQL) e AWS EC2/Elastic Beanstalk (API/Frontend).

---

## 📂 Estrutura do Projeto

```text
DescargasETAR/
├── Backend/                 # Código-fonte da API Node.js/Express
│   ├── src/
│   │   ├── config/          # Ligações ao banco de dados e socket initializer
│   │   ├── controllers/     # Controladores das rotas
│   │   ├── middlewares/     # Middlewares globais e de segurança (JWT/RBAC)
│   │   ├── routes/          # Definição dos endpoints da API
│   │   ├── app.js           # Configuração da app Express
│   │   └── server.js        # Inicialização conjunta Express e HTTP/Socket.io
│   ├── .env                 # Variáveis de ambiente locais (não versionado)
│   └── package.json         # Definições de dependências e scripts npm
├── Frontend/                # Aplicação Cliente Single Page (PWA)
│   ├── public/              # Ativos estáticos e ícones do manifesto PWA
│   ├── src/
│   │   ├── services/        # Consumo de API (Axios wrapper) e serviços WebSocket
│   │   ├── views/           # Vistas/Dashboards (Login, Cliente, Operador, Técnico, Responsável)
│   │   ├── App.css          # Estilos globais e componentes gráficos
│   │   ├── index.css        # Variáveis de tema e design system
│   │   └── App.jsx          # Controlador de rotas e ligação ao Socket global
│   ├── package.json         # Scripts de compilação da PWA (workaround Node 18)
│   └── vite.config.js       # Configuração do Vite e plugin de PWA offline
├── SQL/                     # Scripts de modelação do PostgreSQL
│   ├── ER.png               # Diagrama Entidade-Relação
│   ├── schema_gestao_descargas.sql  # Estrutura de tabelas e enums
│   └── seed_gestao_descargas.sql    # Dados iniciais para testes
└── README.md                # Documentação do projeto
```

---

## 🚀 O que já foi Implementado

### 1. Base de Dados PostgreSQL
*   Esquema completo implementado na base de dados `db_descargas` no schema `public`.
*   Tabelas estruturadas: `perfil`, `utilizador`, `cliente`, `etar`, `parametro`, `descarga`, `amostra`, `resultado_analitico`, `autorizacao`, `cliente_parametro`, `historico`, `notificacao`.
*   Enumerações de estados (`estado_descarga_enum` e `estado_amostra_enum`) e restrições integradas.
*   Dados de teste semeados com sucesso.

### 2. Infraestrutura Inicial do Backend
*   Projeto Node.js inicializado.
*   Instalação das dependências principais: `express`, `pg`, `cors`, `dotenv` e `nodemon` (desenvolvimento).
*   Configuração de variáveis de ambiente no ficheiro `.env`.
*   Criação do Pool de Ligações ao PostgreSQL (`src/config/db.js`).
*   Configuração do servidor Express (`src/app.js` e `src/server.js`).
*   Endpoints de teste implementados e validados localmente:
    *   `GET /api/test` (Sanidade da API).
    *   `GET /api/db/clientes` (Validação de conectividade com a BD).

### 3. Módulo de Autenticação & Controlo de Acesso (JWT / RBAC)
*   Instalação de `bcryptjs` e `jsonwebtoken`.
*   Implementação do controlador de autenticação com login (`POST /api/auth/login`) e verificação do perfil do utilizador ativo (`GET /api/auth/me`).
*   Implementação de middlewares para validar tokens JWT e aplicar controlo de acesso baseado em perfis (RBAC).
*   Configuração e teste de conectividade e validação da segurança (pedidos com token válido vs bloqueios de acessos não autorizados).

### 4. Módulo de Descargas
*   Migração de esquema de BD para adicionar as colunas `qr_code_token` (UUID/Hash) às tabelas `descarga` e `amostra`.
*   Associação física de operadores às suas respetivas ETARs na BD para fins de validação RBAC e de integridade territorial.
*   Criação de pedidos de descarga (`POST /api/descargas`) com validação automática de disponibilidade da ETAR, Whitelists contratuais e quotas de descargas diárias (auto-aprovação).
*   Aprovação/Rejeição manual de pedidos excedentes ou sem whitelist (`PUT /api/descargas/:id/decisao`).
*   Agendamento logístico por clientes com gravação de matrículas, transportadora e geração do QR Code Token (`PUT /api/descargas/:id/agendar`).
*   Leitura/Validação de QR Code no portão da ETAR por Operadores autorizados (`GET /api/descargas/validar/:token`).
*   Confirmação física de receção na ETAR com atualização de volume real, observações, idempotência e despoletamento automático de criação de amostras (`PUT /api/descargas/:id/receber`).

### 5. Módulo de Laboratório & Amostras
*   Instalação da dependência `pdfkit` para geração dinâmica de relatórios em formato PDF.
*   **Check-in físico com triagem inteligente** (`PUT /api/amostras/receber/:token`): Triagem automática que decide se a amostra recolhida deve ser analisada (`EM_ANALISE`) ou descartada (`DESCARTADA`) com base nas regras de periodicidade do contrato do cliente e na sua última análise concluída.
*   **Introdução de Resultados** (`POST /api/amostras/:id/resultados`): Grelha de entrada de dados para o Técnico de Laboratório com validação física (ex: pH entre 0 e 14) e verificação rigorosa de parâmetros obrigatórios por cliente.
*   **Validação Técnica e Conclusão** (`PUT /api/amostras/:id/validar`): Validação pelo Responsável, concluindo o fluxo e atualizando simultaneamente o estado da descarga para `CONCLUIDA` e a ficha do cliente com a data de recolha.
*   **Boletim Analítico em PDF** (`GET /api/amostras/:id/boletim`): Geração automática do Boletim de Resultados analíticos oficial com assinatura e carimbo digital do responsável.

### 6. Frontend React & PWA (Novo)
*   **Design Harmonioso e Premium**: Baseado em CSS nativo, com uma paleta de cores moderna (azul marinho e verde-esmeralda), fontes do Google (Outfit e Inter) e suporte a modo escuro integrado.
*   **Progressive Web App (PWA)**: Registado via `vite-plugin-pwa`. Inclui ícones adaptados a smartphones, manifesto de aplicação instalável e um Service Worker configurado para estratégias de caching offline.
*   **Dashboards Baseados em Funções (RBAC)**:
    *   **Cliente/Produtor**: Consulta de histórico, criação de pedidos de descarga, agendamento de veículos, exibição de QR Code e descarga direta de boletins em PDF.
    *   **Operador da ETAR**: Scanner virtual (por token de segurança ou câmara simulada) e preenchimento de ficha de receção física com recolha ou não de amostra.
    *   **Técnico de Laboratório**: Check-in de frascos na entrada e introdução simples de resultados de ensaio de bancada com validação automática.
    *   **Responsável**: Ecrã consolidado para tomada de decisões e validação de relatórios (carimbo digital).

### 7. Notificações WebSockets em Tempo Real (Novo)
*   **Comunicação Instantânea**: Conexão bidirecional mantida pelo cliente Socket.io de forma global. O token JWT é enviado no momento da ligação para validação e posicionamento seguro do utilizador nas respetivas salas.
*   **Encaminhamento Baseado em Salas**:
    *   Clientes na sala `cliente-<id_cliente>`
    *   Operadores na sala `etar-<id_etar>`
    *   Técnicos na sala `laboratorio-tecnicos`
    *   Responsáveis na sala `laboratorio-responsaveis`
    *   Gestores de Clientes na sala `gestores-clientes`
*   **Fluxo em Tempo Real**: Sempre que há uma alteração de estado relevante no backend (criação de pedidos, aprovações, agendamentos, check-ins ou análises concluídas), é disparada uma notificação para a sala correta.
*   **Atualização de UI Transparente**: Ao receber uma notificação via WebSocket, os dashboards mostram um banner de alerta informativo verde e atualizem o estado local recarregando os dados em segundo plano, sem necessidade de atualizar manualmente a página.

### 8. Módulo de Administração & Painel do Gestor (Novo)
*   **Gestão de Clientes**: Criação e listagem de novos clientes contratualizados com geração automática de credenciais de utilizador.
*   **Whitelists e Quotas**: Configuração e alteração em tempo real das quotas diárias e ativação de auto-aprovação de pedidos por cliente e ETAR.
*   **Parametrização Analítica Contratual**: Associação dinâmica de parâmetros adicionais específicos que devem ser analisados para as amostras de cada cliente.
*   **Contingência de ETARs**: Ativação/suspensão manual e imediata de receção física de efluentes numa ETAR, com envio automático de alertas via WebSockets para os operadores e gestores envolvidos.
*   **Sininho de Alertas**: Painel de notificações interativo com registo persistente local das notificações recebidas (com data, hora e marcação de leitura).
*   **Ficha de Descarga em PDF**: Geração e download automático de relatórios em formato PDF sintetizando os dados de logística, transportador, volumes (solicitado e real) e observações de receção na ETAR.

---

## 🧪 Como Executar os Testes

Foi desenvolvida uma suite de **34 testes integrados** de ponta a ponta (Jest + Supertest) que validam todas as rotas e regras de negócio com limpeza automática da base de dados pós-execução.

Para correr os testes:
1. Certifique-se de que a base de dados Postgres está ativa e configurada no ficheiro `Backend/.env`.
2. Aceda à pasta do backend:
   ```bash
   cd Backend
   ```
3. Execute o comando de testes:
   ```bash
   npm test
   ```

---

## 📋 Planeamento Próximas Etapas

*   [x] **Desenvolvimento do Frontend (React)**:
    *   [x] Interface de login facilitada com atalhos de simulação.
    *   [x] Painel do Cliente e geração de códigos QR.
    *   [x] Ecrã de registo físico para o Operador da ETAR.
    *   [x] Lista de bancada e entrada de ensaios do Técnico de Lab.
    *   [x] Validações e assinaturas eletrónicas de Boletins.
*   [x] **Notificações WebSockets em Tempo Real**:
    *   [x] Inicializador do socket no backend com aperto de mão JWT.
    *   [x] Lógica de Rooms baseada nos perfis e filiações.
    *   [x] Emissão de gatilhos automáticos nos controladores de descargas/amostras.
    *   [x] Subscrições e atualização automática da interface com alertas toasts.
*   [ ] **Alojamento & Cloud (AWS)**:
    *   [ ] Migração da BD local para AWS RDS (PostgreSQL).
    *   [ ] Deploy da API REST para AWS Elastic Beanstalk ou EC2.
    *   [ ] Configuração do Frontend para produção na AWS S3/CloudFront.
