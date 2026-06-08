const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const pool = require('../src/config/db');

// Tokens gerados programaticamente para os testes
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_token_for_descargas_system_2026';

const tokens = {
  tecnicoLab: jwt.sign(
    { id_utilizador: 7, perfil: 'TECNICO_LAB', nome: 'Ana Pereira' },
    JWT_SECRET,
    { expiresIn: '1h' }
  ),
  responsavelLab: jwt.sign(
    { id_utilizador: 8, perfil: 'RESPONSAVEL_LAB', nome: 'Rui Fonseca' },
    JWT_SECRET,
    { expiresIn: '1h' }
  ),
  clienteAAA: jwt.sign(
    { id_utilizador: 1, perfil: 'CLIENTE', id_cliente: 1, nome: 'Empresa AAA' },
    JWT_SECRET,
    { expiresIn: '1h' }
  ),
};

describe('Módulo de Laboratório & Amostras - Testes de Integração', () => {
  let testDescargaId = null;
  let testAmostraId = null;
  let testAmostraToken = 'AMOSTRA-TEST-999999';

  beforeAll(async () => {
    // 1. Criar descarga de teste em estado RECEBIDA
    const descRes = await pool.query(`
      INSERT INTO descarga (id_cliente, id_etar, data_pedido, tipo_efluente, quantidade, estado_descarga, data_rececao, quantidade_real, recolha_amostra)
      VALUES (1, 1, NOW() - INTERVAL '1 hour', 'Industrial', 100, 'RECEBIDA', NOW(), 100, true)
      RETURNING id_descarga
    `);
    testDescargaId = descRes.rows[0].id_descarga;

    // 2. Criar amostra de teste no estado inicial RECOLHIDA
    const amRes = await pool.query(`
      INSERT INTO amostra (id_descarga, estado_amostra, data_recolha, qr_code_token)
      VALUES ($1, 'RECOLHIDA', NOW() - INTERVAL '45 minutes', $2)
      RETURNING id_amostra
    `, [testDescargaId, testAmostraToken]);
    testAmostraId = amRes.rows[0].id_amostra;

    // Garantir que a data_ultima_analise do cliente está limpa (NULL) no início do teste
    await pool.query('UPDATE cliente SET data_ultima_analise = NULL WHERE id_cliente = 1');
  });

  afterAll(async () => {
    // Limpeza rigorosa após a execução
    if (testAmostraId) {
      await pool.query('DELETE FROM resultado_analitico WHERE id_amostra = $1', [testAmostraId]);
      await pool.query("DELETE FROM historico WHERE entidade = 'AMOSTRA' AND id_entidade = $1", [testAmostraId]);
      await pool.query('DELETE FROM amostra WHERE id_amostra = $1', [testAmostraId]);
    }
    if (testDescargaId) {
      await pool.query("DELETE FROM historico WHERE entidade = 'DESCARGA' AND id_entidade = $1", [testDescargaId]);
      await pool.query('DELETE FROM descarga WHERE id_descarga = $1', [testDescargaId]);
    }
    // Repor a data de última análise do cliente para NULL
    await pool.query('UPDATE cliente SET data_ultima_analise = NULL WHERE id_cliente = 1');
    // Fechar pool de conexões
    await pool.end();
  });

  describe('1. Check-in de Amostras (PUT /api/amostras/receber/:token)', () => {
    test('Deve receber a amostra e triar para ANALISAR (visto que data_ultima_analise é NULL)', async () => {
      const res = await request(app)
        .put(`/api/amostras/receber/${testAmostraToken}`)
        .set('Authorization', `Bearer ${tokens.tecnicoLab}`);

      expect(res.status).toBe(200);
      expect(res.body.triagem).toBe('ANALISAR');
      expect(res.body.amostra.estado_amostra).toBe('EM_ANALISE');
    });

    test('Deve falhar (400) se tentarmos receber a mesma amostra novamente (já triada/processada)', async () => {
      const res = await request(app)
        .put(`/api/amostras/receber/${testAmostraToken}`)
        .set('Authorization', `Bearer ${tokens.tecnicoLab}`);

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('já se encontra no estado');
    });
  });

  describe('2. Introdução de Resultados (POST /api/amostras/:id/resultados)', () => {
    test('Deve falhar (400) se enviarmos um pH fisicamente impossível (>14)', async () => {
      const res = await request(app)
        .post(`/api/amostras/${testAmostraId}/resultados`)
        .set('Authorization', `Bearer ${tokens.tecnicoLab}`)
        .send({
          resultados: [
            { id_parametro: 1, valor: 15.0, unidade: 'pH' } // pH inválido
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('valor de pH tem de estar entre 0 e 14');
    });

    test('Deve falhar (400) se faltarem parâmetros obrigatórios para o cliente', async () => {
      const res = await request(app)
        .post(`/api/amostras/${testAmostraId}/resultados`)
        .set('Authorization', `Bearer ${tokens.tecnicoLab}`)
        .send({
          resultados: [
            { id_parametro: 1, valor: 7.2, unidade: 'pH' } // Só pH, faltam CQO, CBO5, etc.
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('Falta de parâmetros obrigatórios');
    });

    test('Deve submeter todos os resultados com sucesso, movendo o estado para ANALISADA', async () => {
      // Cliente 1 (Empresa AAA) tem no seed os parâmetros obrigatórios físico-químicos (1 a 5) + Azoto (6)
      const res = await request(app)
        .post(`/api/amostras/${testAmostraId}/resultados`)
        .set('Authorization', `Bearer ${tokens.tecnicoLab}`)
        .send({
          resultados: [
            { id_parametro: 1, valor: 7.2, unidade: 'pH', metodo: 'SMEWW 4500-H+', incerteza: 0.1 },
            { id_parametro: 2, valor: 450, unidade: 'mg/L', metodo: 'SMEWW 5220 B', incerteza: 25 },
            { id_parametro: 3, valor: 180, unidade: 'mg/L', metodo: 'SMEWW 5210 B', incerteza: 15 },
            { id_parametro: 4, valor: 120, unidade: 'mg/L', metodo: 'SMEWW 2540 D', incerteza: 10 },
            { id_parametro: 5, valor: 2.3, unidade: 'mS/cm', metodo: 'SMEWW 2510 B', incerteza: 0.1 },
            { id_parametro: 6, valor: 35.5, unidade: 'mg/L', metodo: 'SMEWW 4500-N', incerteza: 2.0 }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.mensagem).toContain('Resultados registados com sucesso');
    });
  });

  describe('3. Validação Técnica e Conclusão (PUT /api/amostras/:id/validar)', () => {
    test('Deve falhar (403) se o utilizador que valida não for Responsável', async () => {
      const res = await request(app)
        .put(`/api/amostras/${testAmostraId}/validar`)
        .set('Authorization', `Bearer ${tokens.tecnicoLab}`);

      expect(res.status).toBe(403);
    });

    test('Deve validar a amostra com sucesso, atualizando a ficha do cliente e a descarga correspondente', async () => {
      const res = await request(app)
        .put(`/api/amostras/${testAmostraId}/validar`)
        .set('Authorization', `Bearer ${tokens.responsavelLab}`);

      expect(res.status).toBe(200);
      expect(res.body.mensagem).toContain('Amostra validada com sucesso');

      // Validar alterações finais na base de dados
      const checkAmostra = await pool.query('SELECT estado_amostra, id_responsavel, data_validacao FROM amostra WHERE id_amostra = $1', [testAmostraId]);
      expect(checkAmostra.rows[0].estado_amostra).toBe('CONCLUIDA');
      expect(checkAmostra.rows[0].id_responsavel).toBe(8);
      expect(checkAmostra.rows[0].data_validacao).not.toBeNull();

      const checkDescarga = await pool.query('SELECT estado_descarga FROM descarga WHERE id_descarga = $1', [testDescargaId]);
      expect(checkDescarga.rows[0].estado_descarga).toBe('CONCLUIDA');

      const checkCliente = await pool.query('SELECT data_ultima_analise FROM cliente WHERE id_cliente = 1');
      expect(checkCliente.rows[0].data_ultima_analise).not.toBeNull();
    });
  });

  describe('4. Download do Boletim Analítico em PDF (GET /api/amostras/:id/boletim)', () => {
    test('Deve gerar o ficheiro PDF do boletim com sucesso para download', async () => {
      const res = await request(app)
        .get(`/api/amostras/${testAmostraId}/boletim`)
        .set('Authorization', `Bearer ${tokens.clienteAAA}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      
      // O corpo da resposta deve ser um Buffer contendo a assinatura padrão do ficheiro PDF (%PDF)
      const pdfHeader = res.body.toString('binary', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    test('Deve falhar (403) se outro cliente tentar descarregar o boletim', async () => {
      const tokenClienteBBB = jwt.sign(
        { id_utilizador: 2, perfil: 'CLIENTE', id_cliente: 2, nome: 'Empresa BBB' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get(`/api/amostras/${testAmostraId}/boletim`)
        .set('Authorization', `Bearer ${tokenClienteBBB}`);

      expect(res.status).toBe(403);
    });
  });
});
