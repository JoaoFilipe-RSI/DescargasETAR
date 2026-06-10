const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const pool = require('../src/config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_token_for_descargas_system_2026';

const tokens = {
  cliente: jwt.sign(
    { id_utilizador: 1, perfil: 'CLIENTE', id_cliente: 1, nome: 'Empresa AAA' },
    JWT_SECRET,
    { expiresIn: '1h' }
  ),
  gestor: jwt.sign(
    { id_utilizador: 9, perfil: 'GESTOR_CLIENTES', nome: 'Mariana Costa' },
    JWT_SECRET,
    { expiresIn: '1h' }
  ),
  gestorAdmin: jwt.sign(
    { id_utilizador: 120, perfil: 'GESTOR_ADMIN', nome: 'Filipe Ferreira' },
    JWT_SECRET,
    { expiresIn: '1h' }
  ),
};

describe('Módulo de Administração - Testes de Integração', () => {
  const createdUserIds = [];
  const createdClientIds = [];
  const createdAutIds = [];
  const createdDescargaIds = [];
  const createdEtarIds = [];
  const createdParamIds = [];

  let originalEtarStates = [];
  let originalDescargaStates = [];

  beforeAll(async () => {
    try {
      // Guardar estados originais das ETARs
      const etarsRes = await pool.query('SELECT id_etar, disponivel FROM etar');
      originalEtarStates = etarsRes.rows;

      // Guardar estados originais de todas as descargas
      const descargasRes = await pool.query('SELECT id_descarga, id_etar, estado_descarga, observacoes FROM descarga');
      originalDescargaStates = descargasRes.rows;

      // Garantir estado esperado para os testes
      await pool.query('UPDATE etar SET disponivel = true WHERE id_etar IN (1, 2, 3)');
      await pool.query('UPDATE etar SET disponivel = false WHERE id_etar = 4');
    } catch (err) {
      console.error('Erro ao inicializar base de dados para testes:', err);
    }
  });

  // Limpeza de lixo de testes
  afterAll(async () => {
    try {
      if (createdParamIds.length > 0) {
        await pool.query("DELETE FROM historico WHERE entidade = 'PARAMETRO' AND id_entidade = ANY($1)", [createdParamIds]);
        await pool.query('DELETE FROM cliente_parametro WHERE id_parametro = ANY($1)', [createdParamIds]);
        await pool.query('DELETE FROM parametro WHERE id_parametro = ANY($1)', [createdParamIds]);
      }
      if (createdDescargaIds.length > 0) {
        await pool.query('DELETE FROM descarga WHERE id_descarga = ANY($1)', [createdDescargaIds]);
      }
      if (createdClientIds.length > 0) {
        await pool.query('DELETE FROM cliente_parametro WHERE id_cliente = ANY($1)', [createdClientIds]);
      }
      if (createdAutIds.length > 0) {
        await pool.query('DELETE FROM autorizacao WHERE id_autorizacao = ANY($1)', [createdAutIds]);
      }
      if (createdClientIds.length > 0) {
        await pool.query('DELETE FROM cliente WHERE id_cliente = ANY($1)', [createdClientIds]);
      }
      if (createdUserIds.length > 0) {
        await pool.query('DELETE FROM utilizador WHERE id_utilizador = ANY($1)', [createdUserIds]);
      }
      if (createdEtarIds.length > 0) {
        await pool.query("DELETE FROM historico WHERE entidade = 'ETAR' AND id_entidade = ANY($1)", [createdEtarIds]);
        await pool.query('DELETE FROM etar WHERE id_etar = ANY($1)', [createdEtarIds]);
      }

      // Restaurar estado original das ETARs
      for (const etar of originalEtarStates) {
        await pool.query('UPDATE etar SET disponivel = $1 WHERE id_etar = $2', [etar.disponivel, etar.id_etar]);
      }

      // Restaurar estado original das descargas pré-existentes
      for (const desc of originalDescargaStates) {
        if (!createdDescargaIds.includes(desc.id_descarga)) {
          await pool.query(
            'UPDATE descarga SET id_etar = $1, estado_descarga = $2, observacoes = $3 WHERE id_descarga = $4',
            [desc.id_etar, desc.estado_descarga, desc.observacoes, desc.id_descarga]
          );
        }
      }

      // Limpar histórico dos testes
      await pool.query(
        "DELETE FROM historico WHERE id_utilizador = 9 AND acao IN ('REAGENDAMENTO_AUTOMATICO', 'REVERSAO_ESTADO', 'ALERTA_OPERACIONAL')"
      );
    } catch (err) {
      console.error('Erro ao limpar dados de teste admin:', err);
    }
  });

  describe('1. Segurança e RBAC', () => {
    test('Deve impedir (403) o acesso de clientes à listagem de clientes', async () => {
      const res = await request(app)
        .get('/api/admin/clientes')
        .set('Authorization', `Bearer ${tokens.cliente}`);
      expect(res.status).toBe(403);
    });

    test('Deve autorizar (200) o acesso de gestores à listagem de clientes', async () => {
      const res = await request(app)
        .get('/api/admin/clientes')
        .set('Authorization', `Bearer ${tokens.gestor}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('2. Gestão de Clientes', () => {
    test('Deve criar um cliente e utilizador com sucesso', async () => {
      const res = await request(app)
        .post('/api/admin/clientes')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          nome: 'Empresa Teste CRUD Lda',
          email: 'crud@empresateste.pt',
          morada: 'Morada de Teste 123',
          contacto: 'Manuel Rosa',
          telefone: '960000000',
          periodicidade_analise: 'MENSAL'
        });

      expect(res.status).toBe(201);
      expect(res.body.cliente).toBeDefined();
      expect(res.body.cliente.id_cliente).toBeDefined();

      createdClientIds.push(res.body.cliente.id_cliente);
      createdUserIds.push(res.body.cliente.id_utilizador);
    });

    test('Deve rejeitar (400) criação com email em duplicado', async () => {
      const res = await request(app)
        .post('/api/admin/clientes')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          nome: 'Outra Empresa',
          email: 'crud@empresateste.pt'
        });
      expect(res.status).toBe(400);
    });

    test('Deve atualizar (ativar/desativar) o estado de utilizador do cliente', async () => {
      const idCliente = createdClientIds[0];
      const resDesativar = await request(app)
        .put(`/api/admin/clientes/${idCliente}/status`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({ ativo: false });

      expect(resDesativar.status).toBe(200);
      expect(resDesativar.body.ativo).toBe(false);

      const resAtivar = await request(app)
        .put(`/api/admin/clientes/${idCliente}/status`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({ ativo: true });

      expect(resAtivar.status).toBe(200);
      expect(resAtivar.body.ativo).toBe(true);
    });

    test('Deve atualizar os dados de contacto e email do cliente com sucesso', async () => {
      const idCliente = createdClientIds[0];
      const res = await request(app)
        .put(`/api/admin/clientes/${idCliente}`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          nome: 'Empresa Teste Alterada',
          email: 'alterado@empresateste.pt',
          morada: 'Nova Morada 999',
          contacto: 'Novo Colaborador',
          telefone: '912345678',
          periodicidade_analise: 'SEMANAL'
        });

      expect(res.status).toBe(200);
      expect(res.body.cliente.nome).toBe('Empresa Teste Alterada');
      expect(res.body.cliente.email).toBe('alterado@empresateste.pt');
      expect(res.body.cliente.contacto).toBe('Novo Colaborador');
      expect(res.body.cliente.periodicidade_analise).toBe('SEMANAL');
    });
  });

  describe('3. Disponibilidade de ETARs', () => {
    test('Deve listar as ETARs do sistema', async () => {
      const res = await request(app)
        .get('/api/admin/etars')
        .set('Authorization', `Bearer ${tokens.gestor}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('Deve atualizar a disponibilidade de uma ETAR (Contingência)', async () => {
      const res = await request(app)
        .put('/api/admin/etars/1/disponibilidade')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({ disponivel: false });

      expect(res.status).toBe(200);
      expect(res.body.etar.disponivel).toBe(false);
    });
  });

  describe('4. Whitelists e Parametrização', () => {
    test('Deve criar uma regra de whitelist para o cliente de teste', async () => {
      const res = await request(app)
        .post('/api/admin/autorizacoes')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          id_cliente: createdClientIds[0],
          id_etar: 2,
          quota: 7,
          auto_aprovacao: true
        });

      expect(res.status).toBe(201);
      expect(res.body.autorizacao).toBeDefined();
      createdAutIds.push(res.body.autorizacao.id_autorizacao);
    });

    test('Deve criar uma regra de whitelist com quota nula (Sem limite)', async () => {
      const res = await request(app)
        .post('/api/admin/autorizacoes')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          id_cliente: createdClientIds[0],
          id_etar: 3,
          quota: '',
          auto_aprovacao: true
        });

      expect(res.status).toBe(201);
      expect(res.body.autorizacao).toBeDefined();
      expect(res.body.autorizacao.quota).toBeNull();
      createdAutIds.push(res.body.autorizacao.id_autorizacao);
    });

    test('Deve atualizar uma regra de whitelist para quota nula (Sem limite)', async () => {
      const res = await request(app)
        .put(`/api/admin/autorizacoes/${createdAutIds[0]}`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          quota: null,
          auto_aprovacao: true,
          ativo: true
        });

      expect(res.status).toBe(200);
      expect(res.body.autorizacao).toBeDefined();
      expect(res.body.autorizacao.quota).toBeNull();
    });

    test('Deve listar todas as whitelists e quotas', async () => {
      const res = await request(app)
        .get('/api/admin/autorizacoes')
        .set('Authorization', `Bearer ${tokens.gestor}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('Deve atualizar os parâmetros analíticos contratuais do cliente', async () => {
      const res = await request(app)
        .post(`/api/admin/clientes/${createdClientIds[0]}/parametros`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({ parametros: [6] });

      expect(res.status).toBe(200);

      const checkRes = await request(app)
        .get(`/api/admin/clientes/${createdClientIds[0]}/parametros`)
        .set('Authorization', `Bearer ${tokens.gestor}`);

      expect(checkRes.status).toBe(200);
      expect(checkRes.body).toContain(6);
    });
  });

  describe('5. Reset de Senha de Clientes e Gestão de Utilizadores Internos', () => {
    test('Deve permitir ao gestor redefinir a senha do cliente na edição', async () => {
      const idCliente = createdClientIds[0];
      const res = await request(app)
        .put(`/api/admin/clientes/${idCliente}`)
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          nome: 'Empresa Teste Alterada',
          email: 'alterado@empresateste.pt',
          password: 'NovaSenhaCliente123!',
          periodicidade_analise: 'SEMANAL'
        });

      expect(res.status).toBe(200);

      // Tentar login com a nova password resetada pelo gestor
      const resLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alterado@empresateste.pt',
          password: 'NovaSenhaCliente123!'
        });
      expect(resLogin.status).toBe(200);
      expect(resLogin.body.token).toBeDefined();
    });

    test('Deve impedir (403) a listagem de utilizadores internos a gestores comuns', async () => {
      const res = await request(app)
        .get('/api/admin/utilizadores')
        .set('Authorization', `Bearer ${tokens.gestor}`);
      expect(res.status).toBe(403);
    });

    test('Deve permitir (200) a listagem de utilizadores internos a gestores admin', async () => {
      const res = await request(app)
        .get('/api/admin/utilizadores')
        .set('Authorization', `Bearer ${tokens.gestorAdmin}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Garantir que não contém o utilizador cliente (id_perfil = 1)
      const temCliente = res.body.some(u => u.id_perfil === 1);
      expect(temCliente).toBe(false);
    });

    test('Deve impedir (403) a criação de utilizador por gestores comuns', async () => {
      const res = await request(app)
        .post('/api/admin/utilizadores')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          nome: 'Técnico de Teste CRUD',
          email: 'tecnico.crud@laboratorio.pt',
          id_perfil: 4,
          password: 'PasswordTeste123!',
          ativo: true
        });
      expect(res.status).toBe(403);
    });

    test('Deve criar, atualizar e desativar um utilizador interno com perfil gestor admin', async () => {
      // 1. Criar utilizador interno
      const resCriar = await request(app)
        .post('/api/admin/utilizadores')
        .set('Authorization', `Bearer ${tokens.gestorAdmin}`)
        .send({
          nome: 'Técnico de Teste CRUD',
          email: 'tecnico.crud@laboratorio.pt',
          id_perfil: 4, // TECNICO_LAB
          password: 'PasswordTeste123!',
          ativo: true
        });

      expect(resCriar.status).toBe(201);
      expect(resCriar.body.utilizador).toBeDefined();
      expect(resCriar.body.utilizador.id_utilizador).toBeDefined();
      const idUtilizador = resCriar.body.utilizador.id_utilizador;
      createdUserIds.push(idUtilizador);

      // 2. Atualizar utilizador interno (incluindo reposição de senha)
      const resEditar = await request(app)
        .put(`/api/admin/utilizadores/${idUtilizador}`)
        .set('Authorization', `Bearer ${tokens.gestorAdmin}`)
        .send({
          nome: 'Técnico de Teste Editado',
          email: 'tecnico.editado@laboratorio.pt',
          id_perfil: 4,
          password: 'NovaPassword123!',
          ativo: false // Suspenso
        });

      expect(resEditar.status).toBe(200);
      expect(resEditar.body.utilizador.nome).toBe('Técnico de Teste Editado');
      expect(resEditar.body.utilizador.ativo).toBe(false);

      // 3. Verificar se login falha porque está suspenso (403)
      const resLoginSuspended = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'tecnico.editado@laboratorio.pt',
          password: 'NovaPassword123!'
        });
      expect(resLoginSuspended.status).toBe(403);
      expect(resLoginSuspended.body.erro).toBe('Esta conta está desativada. Contacte o administrador.');
    });
  });

  describe('6. Contingência e Reagendamento de Descargas', () => {
    let testClientId;
    let testUserId;
    let authId1, authId2;

    beforeAll(async () => {
      // Criar um cliente para testar
      const resUser = await pool.query(
        "INSERT INTO utilizador (id_perfil, nome, email, password_hash, ativo) VALUES (1, 'Cliente Contingencia', 'contingencia@cliente.pt', 'hash', true) RETURNING id_utilizador"
      );
      testUserId = resUser.rows[0].id_utilizador;
      createdUserIds.push(testUserId);

      const resClient = await pool.query(
        "INSERT INTO cliente (id_utilizador, nome, email, periodicidade_analise) VALUES ($1, 'Cliente Contingencia', 'contingencia@cliente.pt', 'POR_DESCARGA') RETURNING id_cliente",
        [testUserId]
      );
      testClientId = resClient.rows[0].id_cliente;
      createdClientIds.push(testClientId);

      // Autorizar em ETAR 1 e ETAR 2
      const resAuth1 = await pool.query(
        "INSERT INTO autorizacao (id_cliente, id_etar, quota, ativo, auto_aprovacao) VALUES ($1, 1, 5, true, true) RETURNING id_autorizacao",
        [testClientId]
      );
      authId1 = resAuth1.rows[0].id_autorizacao;
      createdAutIds.push(authId1);

      const resAuth2 = await pool.query(
        "INSERT INTO autorizacao (id_cliente, id_etar, quota, ativo, auto_aprovacao) VALUES ($1, 2, 5, true, true) RETURNING id_autorizacao",
        [testClientId]
      );
      authId2 = resAuth2.rows[0].id_autorizacao;
      createdAutIds.push(authId2);
    });

    test('Deve reagendar automaticamente descarga AUTORIZADA para ETAR com ID mais próximo quando a original fica indisponível', async () => {
      // 1. Criar descarga AUTORIZADA para ETAR 1 (Norte)
      const resDesc = await pool.query(
        "INSERT INTO descarga (id_cliente, id_etar, data_pedido, tipo_efluente, quantidade, estado_descarga) VALUES ($1, 1, NOW(), 'Industrial', 1000, 'AUTORIZADA') RETURNING id_descarga",
        [testClientId]
      );
      const testDescargaId = resDesc.rows[0].id_descarga;
      createdDescargaIds.push(testDescargaId);

      // 2. Definir ETAR 1 como indisponível
      const res = await request(app)
        .put('/api/admin/etars/1/disponibilidade')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({ disponivel: false });

      expect(res.status).toBe(200);
      expect(res.body.etar.disponivel).toBe(false);

      // 3. Verificar se a descarga foi movida para a ETAR 2 (Coimbra) pois tem whitelist e quota
      const checkDesc = await pool.query('SELECT id_etar, estado_descarga FROM descarga WHERE id_descarga = $1', [testDescargaId]);
      expect(checkDesc.rows[0].id_etar).toBe(2);
      expect(checkDesc.rows[0].estado_descarga).toBe('AUTORIZADA');
    });

    test('Deve reverter descarga AUTORIZADA para SOLICITADA se não houver ETAR alternativa com quota ou disponível', async () => {
      // 1. Criar nova descarga AUTORIZADA para ETAR 2 (Coimbra)
      const resDesc = await pool.query(
        "INSERT INTO descarga (id_cliente, id_etar, data_pedido, tipo_efluente, quantidade, estado_descarga) VALUES ($1, 2, NOW(), 'Industrial', 1000, 'AUTORIZADA') RETURNING id_descarga",
        [testClientId]
      );
      const testDescargaId = resDesc.rows[0].id_descarga;
      createdDescargaIds.push(testDescargaId);

      // 2. Definir ETAR 2 como indisponível (agora tanto a ETAR 1 como a 2 estão indisponíveis para este cliente)
      const res = await request(app)
        .put('/api/admin/etars/2/disponibilidade')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({ disponivel: false });

      expect(res.status).toBe(200);
      expect(res.body.etar.disponivel).toBe(false);

      // 3. Verificar se a descarga foi revertida para SOLICITADA e tem observações adicionadas
      const checkDesc = await pool.query('SELECT id_etar, estado_descarga, observacoes FROM descarga WHERE id_descarga = $1', [testDescargaId]);
      expect(checkDesc.rows[0].estado_descarga).toBe('SOLICITADA');
      expect(checkDesc.rows[0].observacoes).toContain('[Revertido por indisponibilidade urgente');
    });

    test('Deve adicionar alerta operacional em observações de descargas AGENDADAS na ETAR desativada', async () => {
      // Restaurar ETAR 3 (Lisboa) e criar whitelist para teste
      await pool.query('UPDATE etar SET disponivel = true WHERE id_etar = 3');
      const resAuth3 = await pool.query(
        "INSERT INTO autorizacao (id_cliente, id_etar, quota, ativo, auto_aprovacao) VALUES ($1, 3, 5, true, true) RETURNING id_autorizacao",
        [testClientId]
      );
      createdAutIds.push(resAuth3.rows[0].id_autorizacao);

      // 1. Criar descarga AGENDADA para ETAR 3
      const resDesc = await pool.query(
        "INSERT INTO descarga (id_cliente, id_etar, data_pedido, tipo_efluente, quantidade, estado_descarga, data_agendamento, matricula_trator) VALUES ($1, 3, NOW(), 'Industrial', 1000, 'AGENDADA', NOW(), 'AA-00-AA') RETURNING id_descarga",
        [testClientId]
      );
      const testDescargaId = resDesc.rows[0].id_descarga;
      createdDescargaIds.push(testDescargaId);

      // 2. Suspender ETAR 3
      const res = await request(app)
        .put('/api/admin/etars/3/disponibilidade')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({ disponivel: false });

      expect(res.status).toBe(200);

      // 3. Verificar observações contêm o alerta operacional
      const checkDesc = await pool.query('SELECT estado_descarga, observacoes FROM descarga WHERE id_descarga = $1', [testDescargaId]);
      expect(checkDesc.rows[0].estado_descarga).toBe('AGENDADA'); // Mantém-se agendada
      expect(checkDesc.rows[0].observacoes).toContain('ALERTA OPERACIONAL');
    });
  });

  describe('7. Auditoria do Sistema', () => {
    test('Deve impedir (403) a consulta de logs de auditoria a gestores comuns', async () => {
      const res = await request(app)
        .get('/api/admin/auditoria')
        .set('Authorization', `Bearer ${tokens.gestor}`);
      expect(res.status).toBe(403);
    });

    test('Deve permitir (200) a consulta de logs de auditoria a gestores admin', async () => {
      const res = await request(app)
        .get('/api/admin/auditoria')
        .set('Authorization', `Bearer ${tokens.gestorAdmin}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        const log = res.body[0];
        expect(log.id_historico).toBeDefined();
        expect(log.entidade).toBeDefined();
        expect(log.acao).toBeDefined();
        expect(log.utilizador_nome).toBeDefined();
        expect(log.utilizador_email).toBeDefined();
        expect(log.utilizador_perfil).toBeDefined();
      }
    });

    test('Deve filtrar logs de auditoria por entidade', async () => {
      const res = await request(app)
        .get('/api/admin/auditoria?entidade=DESCARGA')
        .set('Authorization', `Bearer ${tokens.gestorAdmin}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const allDescarga = res.body.every(log => log.entidade === 'DESCARGA');
      expect(allDescarga).toBe(true);
    });
  });

  describe('8. Gestão de ETARs', () => {
    test('Deve impedir (401) a criação de ETAR por utilizador não autenticado', async () => {
      const res = await request(app)
        .post('/api/admin/etars')
        .send({ nome: 'ETAR Inválida', localizacao: 'Nenhures' });
      expect(res.status).toBe(401);
    });

    test('Deve permitir (201) a criação de ETAR por um gestor comum', async () => {
      const res = await request(app)
        .post('/api/admin/etars')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          nome: 'ETAR Leste Teste',
          localizacao: 'Bragança',
          disponivel: true
        });

      expect(res.status).toBe(201);
      expect(res.body.etar).toBeDefined();
      expect(res.body.etar.id_etar).toBeDefined();
      expect(res.body.etar.nome).toBe('ETAR Leste Teste');
      createdEtarIds.push(res.body.etar.id_etar);
    });

    test('Deve permitir (201) a criação de ETAR por um gestor admin', async () => {
      const res = await request(app)
        .post('/api/admin/etars')
        .set('Authorization', `Bearer ${tokens.gestorAdmin}`)
        .send({
          nome: 'ETAR Oeste Teste',
          localizacao: 'Viana do Castelo',
          disponivel: false
        });

      expect(res.status).toBe(201);
      expect(res.body.etar.nome).toBe('ETAR Oeste Teste');
      expect(res.body.etar.disponivel).toBe(false);
      createdEtarIds.push(res.body.etar.id_etar);
    });

    test('Deve impedir (400) a criação de ETAR sem nome', async () => {
      const res = await request(app)
        .post('/api/admin/etars')
        .set('Authorization', `Bearer ${tokens.gestorAdmin}`)
        .send({
          localizacao: 'Guarda'
        });
      expect(res.status).toBe(400);
      expect(res.body.erro).toBe('Por favor, indique o nome da ETAR.');
    });
  });

  describe('9. Catálogo de Parâmetros', () => {
    test('Deve impedir (401) a criação de parâmetro por utilizador não autenticado', async () => {
      const res = await request(app)
        .post('/api/admin/parametros')
        .send({ nome: 'Parametro Invalido', tipo_parametro: 'FISICO_QUIMICO', unidade_default: 'mg/L', obrigatorio: false });
      expect(res.status).toBe(401);
    });

    test('Deve impedir (403) a criação de parâmetro por cliente', async () => {
      const res = await request(app)
        .post('/api/admin/parametros')
        .set('Authorization', `Bearer ${tokens.cliente}`)
        .send({ nome: 'Parametro Cliente', tipo_parametro: 'FISICO_QUIMICO', unidade_default: 'mg/L', obrigatorio: false });
      expect(res.status).toBe(403);
    });

    test('Deve criar (201) um novo parâmetro analítico no catálogo por um gestor comum', async () => {
      const res = await request(app)
        .post('/api/admin/parametros')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          nome: 'CBO5 Teste',
          tipo_parametro: 'FISICO_QUIMICO',
          unidade_default: 'mg O2/L',
          obrigatorio: false
        });

      expect(res.status).toBe(201);
      expect(res.body.parametro).toBeDefined();
      expect(res.body.parametro.id_parametro).toBeDefined();
      expect(res.body.parametro.nome).toBe('CBO5 Teste');
      expect(res.body.parametro.tipo_parametro).toBe('FISICO_QUIMICO');
      createdParamIds.push(res.body.parametro.id_parametro);
    });

    test('Deve criar (201) um novo parâmetro analítico no catálogo por um gestor admin', async () => {
      const res = await request(app)
        .post('/api/admin/parametros')
        .set('Authorization', `Bearer ${tokens.gestorAdmin}`)
        .send({
          nome: 'Chumbo Teste',
          tipo_parametro: 'METAIS',
          unidade_default: 'ug/L',
          obrigatorio: true
        });

      expect(res.status).toBe(201);
      expect(res.body.parametro.nome).toBe('Chumbo Teste');
      expect(res.body.parametro.tipo_parametro).toBe('METAIS');
      expect(res.body.parametro.obrigatorio).toBe(true);
      createdParamIds.push(res.body.parametro.id_parametro);
    });

    test('Deve impedir (400) a criação de parâmetro em duplicado', async () => {
      const res = await request(app)
        .post('/api/admin/parametros')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          nome: 'CBO5 Teste',
          tipo_parametro: 'FISICO_QUIMICO',
          unidade_default: 'mg/L',
          obrigatorio: false
        });
      expect(res.status).toBe(400);
      expect(res.body.erro).toBe('Já existe um parâmetro registado com este nome.');
    });

    test('Deve impedir (400) a criação de parâmetro com tipo inválido', async () => {
      const res = await request(app)
        .post('/api/admin/parametros')
        .set('Authorization', `Bearer ${tokens.gestor}`)
        .send({
          nome: 'Parametro Invalido Tipo',
          tipo_parametro: 'TIPO_QUE_NAO_EXISTE',
          unidade_default: 'mg/L',
          obrigatorio: false
        });
      expect(res.status).toBe(400);
      expect(res.body.erro).toBe('Tipo de parâmetro inválido.');
    });
  });
});

