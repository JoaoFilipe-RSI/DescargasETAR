# Gestão de Descargas Autoportantes nas ETAR

Este projeto consiste num sistema integrado para digitalização, centralização e gestão das descargas autoportantes (camiões cisterna) de águas residuais nas Estações de Tratamento de Águas Residuais (ETAR). A plataforma substitui os impressos físicos em papel por fluxos de trabalho digitais e automáticos.

---

## 🎯 Objetivos do Projeto

1.  **Digitalização**: Eliminação do papel através de formulários digitais padronizados.
2.  **Centralização**: Histórico estruturado de descargas por cliente, ETAR e transportador.
3.  **Controlo de Acessos**: Diferentes perfis de utilizadores (Clientes, Operadores ETAR, Técnicos de Laboratório, Gestão de Clientes/ETAR).
4.  **Motor de Regras**:
    *   **Auto-Aprovação Semanal**: Validação de Whitelists e quotas diárias contratadas (válida de segunda a sexta-feira). Ao fim de semana, qualquer pedido entra em estado `SOLICITADA` para aprovação manual pelo Gestor de Clientes.
    *   **Gestão de Contingência**: Bloqueio e reencaminhamento automático em caso de indisponibilidade súbita de uma ETAR.
    *   **Triagem de Amostras**: Motor para decidir se uma amostra deve ser analisada ou descartada com base na periodicidade contratada e data da última recolha.

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
*   Associação física de operadores/responsáveis às suas respetivas ETARs na BD para fins de validação RBAC e integridade territorial.
*   Criação de pedidos de descarga (`POST /api/descargas`) com validação automática de disponibilidade da ETAR, Whitelists contratuais e quotas de descargas diárias (auto-aprovação).
*   **Preenchimento Condicional**: Lógica condicional na submissão de pedidos. Para Clientes Transportadores, é obrigatório preencher os dados do Produtor Externo. Para Clientes Produtores, esta secção é totalmente omitida.
*   Aprovação/Rejeição manual de pedidos excedentes ou sem whitelist (`PUT /api/descargas/:id/decisao`).
*   Agendamento logístico por clientes com gravação de matrículas, transportadora e geração do QR Code Token (`PUT /api/descargas/:id/agendar`).
*   Leitura/Validação de QR Code no portão da ETAR por Operadores autorizados (`GET /api/descargas/validar/:token`).
*   Confirmação física de receção na ETAR com atualização de volume real, observações, idempotência e despoletamento automático de criação de amostras (`PUT /api/descargas/:id/receber`).

### 5. Módulo de Laboratório & Amostras
*   Instalação da dependência `pdfkit` para geração dinâmica de relatórios em formato PDF.
*   **Check-in físico com triagem inteligente e lista de recolhidas** (`PUT /api/amostras/receber/:token`): Triagem automática com base em periodicidade de contrato. Adicionado dropdown no Frontend que lista em tempo real as amostras recolhidas para facilidade de check-in.
*   **Introdução de Resultados**: Grelha de entrada de dados para o Técnico de Laboratório (botão "Resultados") com ocultação automática dos ensaios adicionais (Azoto Kjeldahl e Zinco) quando não contratualizados. Ativação manual via checkbox e limpeza automática ao desmarcar.
*   **Validação Técnica e Conclusão** (`PUT /api/amostras/:id/validar`): Validação pelo Responsável, concluindo o fluxo e atualizando simultaneamente o estado da descarga para `CONCLUIDA` e a ficha do cliente com a data de recolha.
*   **Boletim Analítico em PDF** (`GET /api/amostras/:id/boletim`): Geração automática do Boletim de Resultados analíticos oficial com assinatura e carimbo digital do responsável.

### 6. Frontend React & PWA (Novo)
*   **Design Harmonioso e Premium**: Baseado em CSS nativo, com uma paleta de cores moderna (azul marinho e verde-esmeralda), fontes do Google (Outfit e Inter) e suporte a modo escuro integrado.
*   **Layout Confortável e Adaptativo**: Alargamento do bloco central dos dashboards do Técnico e do Operador/Responsável para `1000px` para acomodar convenientemente as colunas das tabelas e os ensaios analíticos.
*   **Progressive Web App (PWA)**: Registado via `vite-plugin-pwa`. Inclui ícones adaptados a smartphones, manifesto de aplicação instalável e um Service Worker configurado para estratégias de caching offline.
*   **Dashboards Baseados em Funções (RBAC)**:
    *   **Cliente/Produtor**: Consulta de histórico, criação de pedidos de descarga, agendamento de veículos, exibição de QR Code e visualização inline da Ficha de Descarga (PDF) sem download forçado.
    *   **Operador da ETAR**: Scanner virtual (por token de segurança ou câmara simulada) e preenchimento de ficha de receção física com recolha ou não de amostra.
    *   **Técnico de Laboratório**: Check-in de frascos na entrada e introdução simples de resultados de ensaio de bancada com validação automática.
    *   **Responsável**: Ecrã consolidado para tomada de decisões e validação de relatórios (carimbo digital).
    *   **Responsável da ETAR**: Dashboard unificado que inclui as funções do Operador de ETAR e um separador inicial de "Histórico de descargas" por mês e ano, exibindo cartões de estatísticas (volume e cisternas) e abrindo a Ficha de Descarga (PDF) diretamente no navegador (inline) sem download forçado.

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
*   **Quota Diária Sem Limite**: Suporte à configuração de Whitelists sem limite diário. Ao deixar o campo de quota vazio, o sistema assume "Sem limite" (valor `null` na base de dados), permitindo múltiplos pedidos de descarga por dia com aprovação automática.
*   **Parametrização Analítica Contratual**: Associação dinâmica de parâmetros adicionais específicos que devem ser analisados para as amostras de cada cliente.
*   **Contingência de ETARs (Reagendamento Automático)**:
    *   Suspensão e reativação imediata de receção numa ETAR com propagação instantânea via WebSockets.
    *   **Descargas `AUTORIZADA`**: Reencaminhamento automático para a ETAR disponível mais próxima do cliente (por diferença absoluta de ID) que tenha whitelist ativa e quota diária livre. Se não houver ETAR elegível, o pedido reverte para `SOLICITADA` com notificação aos gestores.
    *   **Descargas `AGENDADA`**: São mantidas mas marcadas com um alerta vermelho proeminente de `⚠️ CONTACTO URGENTE` nos painéis do Gestor, Operador e Cliente para contacto telefónico imediato.
*   **Sininho de Alertas**: Painel de notificações interativo com registo persistente local das notificações recebidas (com data, hora e marcação de leitura).

### 9. Melhorias de Fluxo e Relatórios (Novo)
*   **Cancelamento e Edição de Pedidos pelo Cliente**: O cliente pode cancelar pedidos em curso (`SOLICITADA`, `AUTORIZADA` ou `AGENDADA`), que mudam para `REJEITADA` e ganham o badge **CANCELADA**. Pedidos rejeitados ou cancelados podem ser editados e resubmetidos no portal do cliente, reavaliando automaticamente as whitelists e quotas diárias.
*   **Redesenho de PDFs Eletrónicos**:
    *   **Ficha de Descarga**: Geração eletrónica em página única sem linhas pontilhadas de preenchimento manual. O documento adapta-se se o cliente for Produtor ou Transportador (exibindo referência de produtor externo e movendo a declaração de responsabilidade).
    *   **Boletim Analítico**: Logótipo IPAC/ilac-MRA simulado. Formatação decimal nativa portuguesa (vírgula decimal) e conversão automática para notação científica maiúscula (ex: `1,2E+2`) para valores analíticos superiores a 100.

---

## 🧪 Como Executar os Testes

Foi desenvolvida uma suite de **60 testes integrados** de ponta a ponta (Jest + Supertest) que validam todas as rotas e regras de negócio com limpeza automática da base de dados pós-execução.

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
