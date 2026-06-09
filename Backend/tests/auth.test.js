const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const bcrypt = require('bcryptjs');

describe('Módulo de Autenticação - Teste de Alteração de Palavra-passe', () => {
  let token = '';

  beforeAll(async () => {
    // Garantir que a password hash está correta na base de dados antes de iniciar o login
    const testHash = await bcrypt.hash('Descargas123!', 12);
    await pool.query(
      "UPDATE utilizador SET password_hash = $1 WHERE email = 'mariana.costa@administracao.pt'",
      [testHash]
    );

    // Fazer login inicial com Mariana Costa
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'mariana.costa@administracao.pt',
        password: 'Descargas123!'
      });
    token = res.body.token;
  });

  afterAll(async () => {
    // Restaurar a password e dados originais na base de dados
    try {
      const defaultHash = await bcrypt.hash('Descargas123!', 12);
      await pool.query(
        "UPDATE utilizador SET email = 'mariana.costa@administracao.pt', password_hash = $1, nome = 'Mariana Costa - Gestão de Contratos' WHERE email = 'mariana.costa@administracao.pt' OR email = 'mariana.atualizada@administracao.pt'",
        [defaultHash]
      );
    } catch (err) {
      console.error('Erro ao restaurar utilizador original no afterAll:', err);
    }
  });

  test('Deve recusar login com credenciais incorretas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'mariana.costa@administracao.pt',
        password: 'senha_errada'
      });
    expect(res.status).toBe(401);
  });

  test('Deve alterar a palavra-passe com sucesso', async () => {
    const res = await request(app)
      .put('/api/auth/alterar-senha')
      .set('Authorization', `Bearer ${token}`)
      .send({
        senhaAtual: 'Descargas123!',
        novaSenha: 'NewPassword123!'
      });

    expect(res.status).toBe(200);
    expect(res.body.mensagem).toBe('Palavra-passe alterada com sucesso!');

    // Testar login com a nova password
    const resNewLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'mariana.costa@administracao.pt',
        password: 'NewPassword123!'
      });
    expect(resNewLogin.status).toBe(200);
    expect(resNewLogin.body.token).toBeDefined();
  });

  test('Deve falhar ao tentar alterar com a senha atual incorreta', async () => {
    const res = await request(app)
      .put('/api/auth/alterar-senha')
      .set('Authorization', `Bearer ${token}`)
      .send({
        senhaAtual: 'senha_errada',
        novaSenha: 'qualquer_coisa'
      });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('A senha atual introduzida está incorreta.');
  });

  test('Deve atualizar os dados do perfil com sucesso e retornar novo token', async () => {
    const res = await request(app)
      .put('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Mariana Costa Atualizada',
        email: 'mariana.atualizada@administracao.pt'
      });

    expect(res.status).toBe(200);
    expect(res.body.mensagem).toBe('Perfil atualizado com sucesso!');
    expect(res.body.token).toBeDefined();
    expect(res.body.utilizador.nome).toBe('Mariana Costa Atualizada');
    expect(res.body.utilizador.email).toBe('mariana.atualizada@administracao.pt');

    // Fazer login com o novo email e com a password correspondente para verificar
    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'mariana.atualizada@administracao.pt',
        password: 'NewPassword123!'
      });
    expect(resLogin.status).toBe(200);
  });

  test('Deve falhar ao tentar atualizar perfil com email já existente', async () => {
    const res = await request(app)
      .put('/api/auth/perfil')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nome: 'Mariana',
        email: 'antonio.almeida@administracao.pt'
      });

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('Este email já está registado para outro utilizador.');
  });
});
