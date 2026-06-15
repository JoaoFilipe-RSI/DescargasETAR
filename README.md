# Gestão de Descargas Autoportantes nas ETAR

Sistema integrado para digitalização, centralização e gestão das descargas autoportantes (camiões cisterna) de águas residuais nas Estações de Tratamento de Águas Residuais (ETAR). A plataforma substitui os impressos físicos em papel por fluxos de trabalho digitais e automáticos, com controlo de acesso baseado em perfis (RBAC), notificações em tempo real e geração automática de documentos analíticos.

---

## 🎯 Objetivos do Projeto

1. **Digitalização**: Eliminação do papel através de formulários digitais padronizados.
2. **Centralização**: Histórico estruturado de descargas por cliente, ETAR e transportador.
3. **Controlo de Acessos**: 7 perfis de utilizadores distintos com permissões independentes.
4. **Motor de Regras**:
   - **Auto-Aprovação Semanal**: Validação de Whitelists e quotas diárias contratadas (válida de segunda a sexta-feira). Ao fim de semana, qualquer pedido entra em `SOLICITADA` para aprovação manual.
   - **Gestão de Contingência**: Bloqueio e reencaminhamento automático em caso de indisponibilidade súbita de uma ETAR.
   - **Triagem de Amostras**: Motor para decidir se uma amostra deve ser analisada ou descartada com base na periodicidade contratada e data da última recolha.
5. **Rastreabilidade Total**: Histórico de auditoria completo de todas as ações realizadas no sistema.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Backend** | Node.js + Express (API RESTful) |
| **Base de Dados** | PostgreSQL (pgAdmin 4) |
| **Tempo Real** | Socket.io (servidor) + Socket.io-client (cliente) |
| **Frontend** | React.js 18 + Vite 5 (PWA) |
| **Estilização** | CSS Vanilla (Design System HSL + Glassmorphism) |
| **Segurança** | JWT (JSON Web Tokens) + Bcrypt |
| **Geração de PDF** | PDFKit |
| **Testes** | Jest + Supertest (93 testes de integração) |
| **Alojamento (Produção)** | Vercel (Frontend) + AWS EC2 (API) + AWS RDS (PostgreSQL) |

---

## 📂 Estrutura do Projeto

```text
DescargasETAR/
├── Backend/                      # API Node.js/Express
│   ├── src/
│   │   ├── config/               # Ligação BD (db.js) e Socket.io (socket.js)
│   │   ├── controllers/          # admin, auth, descarga, amostra
│   │   ├── middlewares/          # JWT + RBAC
│   │   ├── routes/               # Endpoints da API
│   │   ├── app.js                # Configuração Express
│   │   └── server.js             # Inicialização HTTP + Socket.io
│   ├── tests/                    # 89 testes de integração (Jest/Supertest)
│   ├── .env                      # Variáveis de ambiente (não versionado)
│   └── package.json
├── Frontend/                     # SPA React + PWA
│   ├── public/                   # Ícones PWA e manifesto
│   ├── src/
│   │   ├── components/           # NotificationBell (sininho de alertas)
│   │   ├── services/             # api.js (Axios) + websocket.js
│   │   ├── views/                # Login, ClienteDashboard, OperadorDashboard,
│   │   │                         # TecnicoDashboard, ResponsavelDashboard
│   │   ├── App.jsx               # Roteamento + Socket global
│   │   ├── App.css               # Componentes gráficos
│   │   └── index.css             # Design System (variáveis HSL)
│   ├── package.json
│   └── vite.config.js            # Vite + plugin PWA offline
├── SQL/
│   ├── ER.png                    # Diagrama Entidade-Relação
│   ├── db_descargas.sql          # Esquema completo da base de dados com todas as constraints
│   ├── db_descargas_inserts.sql  # Registos de inserção de dados secundários e configurações
│   └── seed_gestao_descargas.sql # Dados de teste e simulação de utilizadores/ETARs
└── README.md
```

---

## 🚀 O que está Implementado

### 1. Base de Dados PostgreSQL — Esquema Completo com Constraints

- **12 tabelas**: `perfil`, `utilizador`, `cliente`, `etar`, `parametro`, `descarga`, `amostra`, `resultado_analitico`, `autorizacao`, `cliente_parametro`, `historico`, `notificacao`
- **ENUMs**: `estado_descarga_enum`, `estado_amostra_enum`, `tipo_parametro_enum`, `tipo_notificacao_enum`
- **Auditoria completa de constraints** — **23 CHECK + 9 UNIQUE** activas:

  | Tabela | Constraints Notáveis (CHECK e UNIQUE) |
  |--------|---------------------|
  | `descarga` | `quantidade > 0`, `quantidade_real > 0`<br>• `qr_code_token` **UNIQUE** (Token do QR Code único da descarga)<br>• `chk_numero_recipientes_positivo` (`numero_recipientes > 0`)<br>• `chk_data_rececao_agendamento` (`data_rececao >= data_agendamento`) <br>• `chk_data_decisao_pedido` (`data_decisao >= data_pedido`) <br>• `chk_data_agendamento_decisao` (`data_agendamento >= data_decisao`) <br>• `chk_quantidade_real_desvio` (Quantidade real deve situar-se entre 10% e 200% da solicitada) |
  | `amostra` | **1 amostra por descarga** (`id_descarga` **UNIQUE**)<br>• `qr_code_token` **UNIQUE** (Token do QR Code único do frasco de amostra)<br>• `chk_data_analise_laboratorio` (`data_inicio_analise >= data_rececao_lab`) <br>• `chk_data_rececao_lab_recolha` (`data_rececao_lab >= data_recolha`) <br>• `chk_data_fim_analise_inicio` (`data_fim_analise >= data_inicio_analise`) <br>• `chk_data_validacao_fim_analise` (`data_validacao >= data_fim_analise`) |
  | `resultado_analitico` | **Parâmetro único por amostra** (`UNIQUE (id_amostra, id_parametro)`) <br>• `chk_valor_positivo` (`valor >= 0`) <br>• `chk_incerteza_positiva` (`incerteza >= 0`) |
  | `autorizacao` | **Par cliente-ETAR único** (`UNIQUE (id_cliente, id_etar)`) <br>• `chk_quota_positiva` (`quota > 0` ou NULL = ilimitada) |
  | `utilizador` | `email` **UNIQUE** <br>• `chk_utilizador_nome_not_empty` (`TRIM(nome) <> ''`) <br>• `chk_email_formato` (Validação de formato de email por Regex) |
  | `cliente` | `id_utilizador` **UNIQUE** <br>• `chk_cliente_nome_not_empty` (`TRIM(nome) <> ''`) <br>• `chk_periodicidade_analise` (Restrito a `POR_DESCARGA`, `QUINZENAL`, `MENSAL`, `TRIMESTRAL`, `SEMESTRAL`, `ANUAL`) |
  | `etar` | `chk_etar_nome_not_empty` (`TRIM(nome) <> ''`) |
  | `historico` | `chk_entidade_valida` (Restringe entidade às entidades declaradas no sistema) |
  | `notificacao` | `chk_mensagem_not_empty` (`TRIM(mensagem) <> ''`) <br>• `chk_lida_enviada` (Notificação não pode estar lida sem antes ter sido enviada) |
  | `perfil` | `nome` **UNIQUE** |
  | `parametro` | `nome` **UNIQUE** <br>• `incerteza_default >= 0` |

### 2. Motores de Regras & Lógica de Negócio (Resumo)

* **Mecanismo de Auto-Aprovação (Whitelist):** Aprovação automática (`AUTORIZADA`) de pedidos de efluentes industriais de segunda a sexta-feira, se o cliente tiver whitelist ativa na ETAR e estiver dentro da quota diária.
* **Controlo de Quotas Operacionais:** Bloqueio automático de novos pedidos se excedida a quota diária contratada do cliente para a ETAR específica.
* **Triagem Inteligente de Periodicidade Laboratorial:** Algoritmo que decide autonomamente, no check-in, se a amostra de efluente deve avançar para ensaio ou ser descartada, cruzando a periodicidade do contrato com a data do último ensaio.
* **Gestão de Indisponibilidade de ETARs (Contingência):**
  * *Reencaminhamento Autónomo:* Desvio automático de pedidos `AUTORIZADA` para ETARs geográficas viáveis do cliente com whitelist ativa e quota disponível.
  * *Contingência Manual:* Se não houver desvio automático, reverte o pedido, emite alerta WebSockets para o Gestor e permite o **reencaminhamento manual** (com opção de forçar excecionalmente a rota para ETARs sem whitelist).
* **Segurança Ativa no Motor Relacional (In-Database Rules):** Aplicação de regras de integridade (como formato estrito de e-mails via regex) diretamente nas constraints físicas do PostgreSQL, atuando como última linha de defesa.
* **Controlo de Desvio Volumétrico:** Bloqueio de receções no portão com desvios volumétricos grosseiros ou fraudulentos (limite de tolerância entre 10% e 200% do volume original).
* **Cálculo Automático de Incertezas:** Cálculo dinâmico e síncrono da incerteza expandida com base nas incertezas padrão definidas no catálogo de parâmetros.
* **Bloqueio de Estados Operacionais:** Blindagem e imutabilidade dos dados operacionais da descarga (como matrículas e volumes) após o check-in do veículo (`RECEBIDA` / `CONCLUIDA`).
* **Disponibilização Condicional de Boletins:** Retenção confidencial dos boletins analíticos gerados, que só ficam acessíveis para o cliente após aprovação expressa da Gestão de Clientes.

---

### 3. Backend — API RESTful Completa

#### Autenticação & Segurança
- `POST /api/auth/login` — Login com JWT + perfil do utilizador
- `GET /api/auth/me` — Verificação de sessão activa
- Middleware RBAC com validação de perfil em todas as rotas protegidas

#### Módulo de Descargas
- `POST /api/descargas` — Criação com auto-aprovação (whitelist + quota diária + dia da semana)
- `PUT /api/descargas/:id/decisao` — Aprovação/Rejeição/Pedido de Elementos pelo Gestor
- `PUT /api/descargas/:id/agendar` — Agendamento com matrícula, transportadora e geração de QR Code
- `GET /api/descargas/validar/:token` — Validação do QR Code no portão da ETAR
- `PUT /api/descargas/:id/receber` — Receção física com volume real e criação automática de amostra
- `PUT /api/descargas/:id/cancelar` — Cancelamento pelo Cliente
- `PUT /api/descargas/:id/editar` — Reedição de pedido rejeitado com reavaliação automática
- `PUT /api/descargas/:id/reencaminharManual` — Reencaminhamento manual de descargas agendadas afetadas por indisponibilidade de ETAR (com bypass opcional de whitelist/quota)
- `GET /api/descargas/:id/ficha` — Ficha de Descarga em PDF (Produtor ou Transportador)


#### Módulo de Laboratório & Amostras
- `PUT /api/amostras/receber/:token` — Check-in com triagem inteligente por periodicidade
- `PUT /api/amostras/:id/resultados` — Introdução de resultados pelo Técnico
- `PUT /api/amostras/:id/validar` — Validação e conclusão pelo Responsável de Lab
- `GET /api/amostras/:id/boletim` — Boletim Analítico em PDF com carimbo e assinatura digital

#### Módulo de Administração (`/api/admin/`)
- **Clientes**: CRUD com criação automática de conta de utilizador
- **Autorizações**: Whitelists por cliente+ETAR com quota e auto-aprovação configuráveis
- **ETARs**: Criação, listagem e alteração de disponibilidade (com reagendamento automático)
- **Parâmetros Analíticos**: Catálogo global com tipo, unidade, obrigatoriedade, método e incerteza padrão
- **Tipos de Parâmetro**: Gestão dinâmica do ENUM `tipo_parametro_enum` (adição sem reinício)
- **Parâmetros Contratuais**: Associação de parâmetros adicionais por cliente
- **Utilizadores Internos**: CRUD de utilizadores não-clientes com associação a ETAR
- **Perfis**: CRUD de perfis de utilizador
- **Relatórios**: Listagem consolidada de descargas com filtros (cliente, ETAR, mês, ano, estado) e informação de quem autorizou/recebeu cada descarga
- **Auditoria**: Log completo de ações com filtro por entidade, ação e pesquisa livre

---

### 4. Frontend React — Dashboards por Perfil

#### Cliente / Produtor / Transportador
- Criação de pedidos de descarga com preenchimento condicional (Produtor vs. Transportador)
- Histórico de descargas com estados visuais (badges coloridos)
- Agendamento de veículo com matrícula e QR Code inline
- Cancelamento e reedição de pedidos
- Visualização da Ficha de Descarga (PDF inline, sem download forçado)

#### Operador da ETAR
- Validação de entrada via QR Code (câmara real ou inserção manual do token)
- Ficha de receção física (volume real, amostra recolhida, observações)
- Geração, visualização e impressão de etiqueta QR para acompanhamento da amostra

#### Técnico de Laboratório
- Check-in de amostras na entrada do laboratório (leitura QR por câmara ou através da lista de amostras aguardando check-in)
- Grelha de resultados de ensaio por parâmetro (com/sem parâmetros contratuais adicionais)
- Ocultação/ativação manual de ensaios não contratualizados com limpeza automática

#### Responsável de Laboratório
- Validação e conclusão de análises com carimbo digital
- Acesso ao catálogo global de parâmetros para definir método e incerteza padrão

#### Responsável de ETAR
- Dashboard unificado com funções de Operador
- Histórico de descargas por mês/ano com estatísticas de volume e cisternas

#### Gestor de Clientes
- Painel de decisões (aprovar/rejeitar/solicitar elementos)
- Gestão completa de clientes, autorizações, ETARs e catálogo de parâmetros
- **Catálogo Global de Parâmetros**: Edição de parâmetros existentes + criação de novos tipos dinâmicos inline
- Painel de Relatórios com filtros avançados e informação de "quem fez" cada mudança de estado
- **Reencaminhamento Manual de Contingência**: Possibilidade de transferir descargas agendadas afetadas por indisponibilidade de ETAR (com bypass opcional de quota/whitelist)
- Envio de mensagens gerais a todos os utilizadores activos


#### Gestor Admin (perfil completo)
- Tudo do Gestor de Clientes +
- Gestão de Utilizadores Internos (criação, edição, associação a ETAR)
- Gestão de Perfis de utilizador
- **Painel de Auditoria**: Log completo com filtro por entidade (DESCARGA, AMOSTRA, PARAMETRO, AUTORIZACAO, ETAR, PERFIL, SISTEMA, CLIENTE, UTILIZADOR) e ação

---

### 5. Notificações em Tempo Real (WebSockets)

- Conexão Socket.io bidirecional com autenticação JWT no momento da ligação
- **Salas por perfil**: `cliente-<id>`, `etar-<id>`, `laboratorio-tecnicos`, `laboratorio-responsaveis`, `gestores-clientes`
- **Sininho de alertas** (componente `NotificationBell`) com histórico persistente local, marcação de lida/não-lida e marca-tudo-como-lido

**Notificações implementadas** (evento → destinatário):

| Evento | Destinatário |
|--------|-------------|
| Novo pedido de descarga | Gestores de Clientes |
| Descarga autorizada/rejeitada | Cliente |
| Descarga agendada | Operadores da ETAR destino |
| Nova amostra no laboratório | Técnicos e Responsáveis de Lab |
| Amostra descartada | Responsáveis de Lab |
| Análise concluída e validada | Gestores de Clientes + Cliente |
| ETAR indisponível | Gestores de Clientes |
| Descarga com alerta operacional | Gestores de Clientes |
| Novo parâmetro adicionado ao catálogo | Responsável de Lab |
| Mensagem geral do sistema | Todos os utilizadores activos |

---

### 6. Geração de PDF

#### Ficha de Descarga (`GET /api/descargas/:id/ficha`)
- Documento único adaptado ao tipo de cliente (Produtor vs. Transportador)
- Sem linhas de preenchimento manual — campos preenchidos automaticamente
- Referência a produtor externo e declaração de responsabilidade condicional

#### Boletim Analítico (`GET /api/amostras/:id/boletim`)
- Logótipo IPAC/ilac-MRA simulado
- Carimbo e assinatura digital generativa única por responsável (algoritmo baseado no nome)
- Formatação decimal portuguesa (vírgula decimal)
- Notação científica automática para valores > 100 (ex: `1,2E+2`)

---

## 🧪 Testes de Integração

Suite de **93 testes de integração** (Jest + Supertest) cobrindo todos os módulos:

```bash
cd Backend
npm test
```

| Suite | Testes | Cobertura |
|-------|--------|-----------|
| `auth.test.js` | Login, sessão, acesso negado | Autenticação + JWT |
| `descargas.test.js` | Criação, aprovação, agendamento, QR, receção, cancelamento, edição, reencaminhamento manual | Fluxo completo de descargas |
| `amostras.test.js` | Check-in, resultados, validação, boletim, descarte | Fluxo completo de laboratório |
| `admin.test.js` | Clientes, ETARs, autorizações, parâmetros, tipos, relatórios, auditoria | Módulo de administração |


> Os testes criam dados isolados e fazem limpeza automática da base de dados após execução.

---

## ▶️ Como Executar Localmente

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+ com a base de dados `db_descargas` criada
- Ficheiro `Backend/.env` configurado (ver `Backend/.env.example`)

### Backend
```bash
cd Backend
npm install
npm run dev       # Servidor em http://localhost:3001
```

### Frontend
```bash
cd Frontend
npm install
npm run dev       # Aplicação em http://localhost:5173
```

### Base de Dados
```sql
-- 1. Criar base de dados e tabelas (Esquema Completo)
\i SQL/db_descargas.sql

-- 2. Inserir registos e relacionamentos estruturados
\i SQL/db_descargas_inserts.sql

-- 3. Opcional: Dados adicionais de simulação para testes rápidos
\i SQL/seed_gestao_descargas.sql
```

---

## 🌐 Alojamento & Produção (Cloud)

A plataforma encontra-se totalmente disponível e alojada em ambiente cloud descentralizado e seguro:

* **Frontend (React)**: Alojado na [Vercel](https://descargas-etar.vercel.app/) com HTTPS ativo e suporte completo a PWA/Service Workers.
* **Backend API (Node.js)**: Alojado em instância **AWS EC2 (Ubuntu 22.04 LTS)**:
  * Executado em ambiente de produção gerido pelo **PM2** (24/7).
  * Configurado como Proxy Inverso através do **Nginx**.
  * Certificado SSL automático e seguro gerado pelo **Certbot (Let's Encrypt)** através do subdomínio `15-188-63-77.sslip.io` para resolver as restrições de *Mixed Content* dos browsers.
* **Base de Dados (PostgreSQL)**: Alojada em instância **AWS RDS (db-descargas-prod)** com isolamento de acessos de rede e redundância lógica.

### 🔄 Procedimento de Atualização em Produção (Deployment & CI/CD)

Ao efetuar um `git push` local para o repositório GitHub, a sincronização e atualização dos ambientes de produção decorre da seguinte forma:

1. **Frontend (Vercel) — Automatizado (CI/CD)**:
   * A Vercel deteta a alteração no ramo principal via *webhook*.
   * Compila o React (com base nos ficheiros de visualização, estilos e componentes mais recentes) e atualiza o servidor automaticamente em segundos.

2. **Backend API (AWS EC2) — Atualização Manual Segura**:
   * Aceda ao terminal da instância AWS EC2 via **SSH** e execute a atualização:
     ```bash
     # Navegar para a pasta do Backend
     cd /caminho/para/o/projeto/Backend

     # Atualizar o código local com o GitHub
     git pull origin main

     # Reiniciar os processos sob gestão do PM2 para aplicar as mudanças
     pm2 restart all
     ```

---

## 📋 Próximas Etapas

- [ ] **Funcionalidades Futuras**:
  - [ ] Exportação de relatórios em Excel/CSV
  - [ ] Painel de estatísticas com gráficos (Chart.js ou Recharts)
  - [ ] Notificações por e-mail (SendGrid ou AWS SES)
  - [ ] Aplicação móvel nativa (React Native)
