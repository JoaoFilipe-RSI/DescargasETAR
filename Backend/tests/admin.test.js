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
};

describe('Módulo de Administração - Testes de Integração', () => {
  const createdUserIds = [];
  const createdClientIds = [];
  const createdAutIds = [];

  // Limpeza de lixo de testes
  afterAll(async () => {
    try {
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
      // Restaurar estado da ETAR 1
      await pool.query('UPDATE etar SET disponivel = true WHERE id_etar = 1');
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
});
