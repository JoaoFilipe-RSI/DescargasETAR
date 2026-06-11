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
| **Testes** | Jest + Supertest (89 testes de integração) |
| **Alojamento (Planeado)** | AWS RDS + AWS EC2/Elastic Beanstalk |

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
│   ├── schema_gestao_descargas.sql   # Esquema completo com todas as constraints
│   ├── seed_gestao_descargas.sql     # Dados iniciais para testes
│   ├── update_schema_qr_tokens.sql   # Migração QR codes
│   ├── inserir_novos_utilizadores.sql
│   └── add_missing_constraints.sql   # Constraints adicionadas na auditoria
└── README.md
```

---

## 🚀 O que está Implementado

### 1. Base de Dados PostgreSQL — Esquema Completo com Constraints

- **12 tabelas**: `perfil`, `utilizador`, `cliente`, `etar`, `parametro`, `descarga`, `amostra`, `resultado_analitico`, `autorizacao`, `cliente_parametro`, `historico`, `notificacao`
- **ENUMs**: `estado_descarga_enum`, `estado_amostra_enum`, `tipo_parametro_enum`, `tipo_notificacao_enum`
- **Auditoria completa de constraints** (aplicada em 2026-06-11) — **23 CHECK + 5 UNIQUE** activas:

  | Tabela | Constraints notáveis |
  |--------|---------------------|
  | `descarga` | `quantidade > 0`, `quantidade_real > 0`, cronologia de datas (pedido→decisão→agendamento→receção), desvio máx. 200% da quantidade real vs. solicitada, `numero_recipientes > 0` |
  | `amostra` | **1 amostra por descarga** (`UNIQUE id_descarga`), cadeia de datas completa (recolha→lab→início análise→fim→validação) |
  | `resultado_analitico` | **Parâmetro único por amostra** (`UNIQUE id_amostra + id_parametro`), `valor >= 0`, `incerteza >= 0` |
  | `autorizacao` | `quota > 0` (ou NULL = ilimitada) |
  | `utilizador` | `TRIM(nome) <> ''`, formato de email por regex |
  | `cliente` | `TRIM(nome) <> ''`, periodicidade restrita a valores válidos |
  | `etar` | `TRIM(nome) <> ''` |
  | `historico` | `entidade` restrita ao conjunto definido de entidades do sistema |
  | `notificacao` | Mensagem não vazia, não pode estar lida sem ter sido enviada |

---

### 2. Backend — API RESTful Completa

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

### 3. Frontend React — Dashboards por Perfil

#### Cliente / Produtor / Transportador
- Criação de pedidos de descarga com preenchimento condicional (Produtor vs. Transportador)
- Histórico de descargas com estados visuais (badges coloridos)
- Agendamento de veículo com matrícula e QR Code inline
- Cancelamento e reedição de pedidos
- Visualização da Ficha de Descarga (PDF inline, sem download forçado)

#### Operador da ETAR
- Scanner virtual por token ou câmara simulada
- Ficha de receção física (volume real, amostra recolhida, observações)
- Lista de amostras recolhidas para check-in

#### Técnico de Laboratório
- Check-in de amostras na entrada do laboratório
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
- Envio de mensagens gerais a todos os utilizadores activos

#### Gestor Admin (perfil completo)
- Tudo do Gestor de Clientes +
- Gestão de Utilizadores Internos (criação, edição, associação a ETAR)
- Gestão de Perfis de utilizador
- **Painel de Auditoria**: Log completo com filtro por entidade (DESCARGA, AMOSTRA, PARAMETRO, AUTORIZACAO, ETAR, PERFIL, SISTEMA, CLIENTE, UTILIZADOR) e ação

---

### 4. Notificações em Tempo Real (WebSockets)

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

### 5. Geração de PDF

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

Suite de **89 testes de integração** (Jest + Supertest) cobrindo todos os módulos:

```bash
cd Backend
npm test
```

| Suite | Testes | Cobertura |
|-------|--------|-----------|
| `auth.test.js` | Login, sessão, acesso negado | Autenticação + JWT |
| `descargas.test.js` | Criação, aprovação, agendamento, QR, receção, cancelamento, edição | Fluxo completo de descargas |
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
-- 1. Criar schema
\i SQL/schema_gestao_descargas.sql

-- 2. Inserir dados iniciais
\i SQL/seed_gestao_descargas.sql

-- 3. Aplicar constraints adicionais
\i SQL/add_missing_constraints.sql
```

---

## 📋 Próximas Etapas

- [ ] **Alojamento & Cloud (AWS)**:
  - [ ] Migração da BD local para AWS RDS (PostgreSQL)
  - [ ] Deploy da API REST para AWS Elastic Beanstalk ou EC2
  - [ ] Configuração do Frontend para produção na AWS S3/CloudFront
- [ ] **Funcionalidades Futuras**:
  - [ ] Exportação de relatórios em Excel/CSV
  - [ ] Painel de estatísticas com gráficos (Chart.js ou Recharts)
  - [ ] Notificações por e-mail (SendGrid ou AWS SES)
  - [ ] Aplicação móvel nativa (React Native)
