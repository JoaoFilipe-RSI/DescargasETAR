# Gestão de Descargas Autoportantes nas ETAR

Este projeto consiste num sistema integrado para digitalização, centralização e gestão das descargas autoportantes (camiões cisterna) de águas residuais nas Estações de Tratamento de Águas Residuais (ETAR). A plataforma substitui os impressos físicos em papel por fluxos de trabalho digitais e automáticos.

---

## 🎯 Objetivos do Projeto

1.  **Digitalização**: Eliminação do papel através de formulários digitais padronizados.
2.  **Centralização**: Histórico estruturado de descargas por cliente, ETAR e transportador.
3.  **Controlo de Acessos**: Diferentes perfis de utilizadores (Clientes, Operadores ETAR, Técnicos de Laboratório, Gestão de Clientes).
4.  **Motor de Regras**:
    *   **Auto-Aprovação**: Validação de Whitelists e quotas diárias contratadas.
    *   **Gestão de Contingência**: Bloqueio e reencaminhamento automático em caso de indisponibilidade súbita de uma ETAR.
    *   **Triagem de Amostras**: Motor para decidir se uma amostra deve ser analisada ou descartada com base na periodicidade contratada.

---

## 🛠️ Stack Tecnológica

*   **Backend**: Node.js com Express (API RESTful).
*   **Base de Dados**: PostgreSQL (gerido com pgAdmin 4).
*   **Segurança**: JSON Web Tokens (JWT) e hashing de passwords com Bcrypt.
*   **Alojamento (Planeado)**: AWS RDS (PostgreSQL) e AWS EC2/Elastic Beanstalk (API).

---

## 📂 Estrutura do Projeto

```text
DescargasETAR/
├── Backend/                 # Código-fonte da API Node.js/Express
│   ├── src/
│   │   ├── config/          # Configurações de ligações (ex: db.js)
│   │   ├── controllers/     # Controladores das rotas
│   │   ├── middlewares/     # Middlewares globais e de segurança (JWT/RBAC)
│   │   ├── routes/          # Definição dos endpoints da API
│   │   ├── services/        # Lógica de negócio e regras (Services)
│   │   ├── app.js           # Configuração da app Express
│   │   └── server.js        # Inicialização do servidor HTTP
│   ├── .env                 # Variáveis de ambiente locais (não versionado)
│   └── package.json         # Definições de dependências e scripts npm
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

---

## 📋 Planeamento Próximas Etapas (Backend)

*   [ ] **Módulo de Laboratório & Amostras**:
    *   Receção de amostras com verificação inteligente de periodicidade (analisar vs descartar).
    *   Introdução de resultados de parâmetros analíticos.
    *   Validação técnica e geração automática do Boletim Analítico em PDF.
