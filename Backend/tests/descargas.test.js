const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const pool = require('../src/config/db');

// Tokens gerados programaticamente para os diferentes perfis usando o JWT_SECRET do .env
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_token_for_descargas_system_2026';

const tokens = {
  clienteAAA: jwt.sign(
    { id_utilizador: 1, perfil: 'CLIENTE', id_cliente: 1, nome: 'Empresa AAA' },
    JWT_SECRET,
    { expiresIn: '1h' }
  ),
  clienteBBB: jwt.sign(
    { id_utilizador: 2, perfil: 'CLIENTE', id_cliente: 2, nome: 'Empresa BBB' },
    JWT_SECRET,
    { expiresIn: '1h' }
  ),
  operadorEtar1: jwt.sign(
    { id_utilizador: 4, perfil: 'OPERADOR_ETAR', id_etar: 1, nome: 'Carlos Silva' },
    JWT_SECRET,
    { expiresIn: '1h' }
  ),
  operadorEtar2: jwt.sign(
    { id_utilizador: 5, perfil: 'OPERADOR_ETAR', id_etar: 2, nome: 'José Teixeira' },
    JWT_SECRET,
    { expiresIn: '1h' }
  ),
  gestorClientes: jwt.sign(
    { id_utilizador: 9, perfil: 'GESTOR_CLIENTES', nome: 'Mariana Costa' },
    JWT_SECRET,
    { expiresIn: '1h' }
  ),
};

describe('Módulo de Descargas - Testes de Integração', () => {
  // Array para guardar os IDs das descargas criadas durante os testes para posterior limpeza
  const createdDescargaIds = [];
  let qrCodeToken = '';
  let idDescargaAutoAprovada = null;
  let idDescargaSolicitada = null;

  let mockDateValue = new Date('2026-06-08T12:00:00.000Z'); // Segunda-feira (Weekday)
  let originalDate;

  beforeAll(() => {
    originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor(...args) {
        if (args.length === 0) {
          return new originalDate(mockDateValue.getTime());
        }
        return new originalDate(...args);
      }
      static now() {
        return mockDateValue.getTime();
      }
    };
  });

  // Garantir limpeza no final de todos os testes
  afterAll(async () => {
    global.Date = originalDate;
    if (createdDescargaIds.length > 0) {
      try {
        // 1. Apagar amostras associadas
        await pool.query('DELETE FROM amostra WHERE id_descarga = ANY($1)', [createdDescargaIds]);
        
        // 2. Apagar histórico associado
        await pool.query("DELETE FROM historico WHERE entidade = 'DESCARGA' AND id_entidade = ANY($1)", [createdDescargaIds]);
        
        // 3. Apagar descargas criadas
        await pool.query('DELETE FROM descarga WHERE id_descarga = ANY($1)', [createdDescargaIds]);
        
        console.log(`Limpeza concluída com sucesso. ${createdDescargaIds.length} registos de teste removidos.`);
      } catch (err) {
        console.error('Erro durante o cleanup da base de dados:', err);
      }
    }
    // Fechar ligação ao pool para o Jest não ficar aberto
    await pool.end();
  });

  describe('1. Criar Pedido de Descarga (POST /api/descargas)', () => {
    test('Deve aprovar automaticamente (AUTORIZADA) quando dentro da quota e com whitelist ativa', async () => {
      const res = await request(app)
        .post('/api/descargas')
        .set('Authorization', `Bearer ${tokens.clienteAAA}`)
        .send({
          id_etar: 1, // ETAR Norte
          tipo_efluente: 'Industrial',
          quantidade: 100,
          numero_recipientes: 1,
          nome_produtor_externo: 'Produtor Teste A',
          morada_produtor_externo: 'Rua Teste A'
        });

      expect(res.status).toBe(201);
      expect(res.body.descarga).toBeDefined();
      expect(res.body.descarga.estado_descarga).toBe('AUTORIZADA');
      
      idDescargaAutoAprovada = res.body.descarga.id_descarga;
      createdDescargaIds.push(idDescargaAutoAprovada);
    });

    test('Deve manter como SOLICITADA se for criado no fim de semana (Sábado ou Domingo) mesmo com quota e whitelist ativa', async () => {
      mockDateValue = new Date('2026-06-06T12:00:00.000Z'); // Sábado

      const res = await request(app)
        .post('/api/descargas')
        .set('Authorization', `Bearer ${tokens.clienteAAA}`)
        .send({
          id_etar: 1,
          tipo_efluente: 'Industrial',
          quantidade: 50,
          numero_recipientes: 1
        });

      expect(res.status).toBe(201);
      expect(res.body.descarga).toBeDefined();
      expect(res.body.descarga.estado_descarga).toBe('SOLICITADA');

      createdDescargaIds.push(res.body.descarga.id_descarga);

      // Restaurar para Segunda-feira
      mockDateValue = new Date('2026-06-08T12:00:00.000Z');
    });

    test('Deve manter como SOLICITADA quando a whitelist requer aprovação manual (auto_aprovacao = false)', async () => {
      const res = await request(app)
        .post('/api/descargas')
        .set('Authorization', `Bearer ${tokens.clienteBBB}`)
        .send({
          id_etar: 2, // ETAR Centro (Empresa BBB tem quota mas auto_aprovacao é false no seed)
          tipo_efluente: 'Industrial',
          quantidade: 120,
          numero_recipientes: 1
        });

      expect(res.status).toBe(201);
      expect(res.body.descarga).toBeDefined();
      expect(res.body.descarga.estado_descarga).toBe('SOLICITADA');

      idDescargaSolicitada = res.body.descarga.id_descarga;
      createdDescargaIds.push(idDescargaSolicitada);
    });

    test('Deve falhar (400) se a ETAR de destino estiver indisponível (ex: ETAR Algarve)', async () => {
      const res = await request(app)
        .post('/api/descargas')
        .set('Authorization', `Bearer ${tokens.clienteAAA}`)
        .send({
          id_etar: 4, // ETAR Algarve (disponivel = false no seed)
          tipo_efluente: 'Domestico',
          quantidade: 50
        });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('indisponível');
    });

    test('Deve falhar (401) se o token não for fornecido ou for inválido', async () => {
      const res = await request(app)
        .post('/api/descargas')
        .send({
          id_etar: 1,
          tipo_efluente: 'Industrial',
          quantidade: 100
        });

      expect(res.status).toBe(401);
    });
  });

  describe('2. Registar Decisão Manual (PUT /api/descargas/:id/decisao)', () => {
    test('Deve autorizar uma descarga SOLICITADA quando efetuado por um Gestor de Clientes', async () => {
      const res = await request(app)
        .put(`/api/descargas/${idDescargaSolicitada}/decisao`)
        .set('Authorization', `Bearer ${tokens.gestorClientes}`)
        .send({
          decisao: 'AUTORIZADA',
          observacoes: 'Aprovado manualmente em ambiente de testes.'
        });

      expect(res.status).toBe(200);
      expect(res.body.descarga.estado_descarga).toBe('AUTORIZADA');
    });

    test('Deve permitir solicitar elementos adicionais (SOLICITAR_ELEMENTOS) mantendo o estado SOLICITADA e atualizando as observações', async () => {
      // Criar descarga temporária
      const createRes = await request(app)
        .post('/api/descargas')
        .set('Authorization', `Bearer ${tokens.clienteBBB}`)
        .send({
          id_etar: 2,
          tipo_efluente: 'Industrial',
          quantidade: 150,
          numero_recipientes: 1
        });
      
      const tempId = createRes.body.descarga.id_descarga;
      createdDescargaIds.push(tempId);

      // Solicitar elementos
      const res = await request(app)
        .put(`/api/descargas/${tempId}/decisao`)
        .set('Authorization', `Bearer ${tokens.gestorClientes}`)
        .send({
          decisao: 'SOLICITAR_ELEMENTOS',
          observacoes: 'Falta licença ambiental e boletim prévio do produtor.'
        });

      expect(res.status).toBe(200);
      expect(res.body.descarga.estado_descarga).toBe('SOLICITADA');
      expect(res.body.descarga.observacoes).toBe('Falta licença ambiental e boletim prévio do produtor.');

      // Verificar histórico
      const histRes = await pool.query("SELECT * FROM historico WHERE entidade = 'DESCARGA' AND id_entidade = $1 AND acao = 'PEDIDO_ELEMENTOS'", [tempId]);
      expect(histRes.rows.length).toBe(1);
    });

    test('Deve impedir (403) a decisão se o perfil não for Gestor de Clientes (ex: perfil Cliente)', async () => {
      const res = await request(app)
        .put(`/api/descargas/${idDescargaSolicitada}/decisao`)
        .set('Authorization', `Bearer ${tokens.clienteAAA}`)
        .send({
          decisao: 'REJEITADA'
        });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Agendar Descarga Autorizada (PUT /api/descargas/:id/agendar)', () => {
    test('Deve agendar com sucesso pelo próprio cliente, retornando um token de QR Code', async () => {
      const res = await request(app)
        .put(`/api/descargas/${idDescargaAutoAprovada}/agendar`)
        .set('Authorization', `Bearer ${tokens.clienteAAA}`)
        .send({
          empresa_transportadora: 'TransRapida Lda',
          matricula_trator: 'ZZ-11-ZZ',
          matricula_cisterna: 'YY-22-YY'
        });

      expect(res.status).toBe(200);
      expect(res.body.descarga.estado_descarga).toBe('AGENDADA');
      expect(res.body.qr_code_token).toBeDefined();
      expect(res.body.qr_code_token).toMatch(/^DESC-\d{4}-[0-9A-F]{6}$/);

      qrCodeToken = res.body.qr_code_token;
    });

    test('Deve falhar (403) se outro cliente tentar agendar uma descarga que não lhe pertence', async () => {
      const res = await request(app)
        .put(`/api/descargas/${idDescargaAutoAprovada}/agendar`)
        .set('Authorization', `Bearer ${tokens.clienteBBB}`)
        .send({
          empresa_transportadora: 'Outro Transportador Lda',
          matricula_trator: 'AA-00-AA'
        });

      expect(res.status).toBe(403);
      expect(res.body.erro).toContain('não pertence');
    });
  });

  describe('4. Validar Token QR (GET /api/descargas/validar/:token)', () => {
    test('Deve validar com sucesso se o operador for da mesma ETAR', async () => {
      const res = await request(app)
        .get(`/api/descargas/validar/${qrCodeToken}`)
        .set('Authorization', `Bearer ${tokens.operadorEtar1}`); // Operador da ETAR 1 (Norte)

      expect(res.status).toBe(200);
      expect(res.body.descarga).toBeDefined();
      expect(res.body.descarga.qr_code_token).toBe(qrCodeToken);
    });

    test('Deve falhar (403) se o operador for de outra ETAR', async () => {
      const res = await request(app)
        .get(`/api/descargas/validar/${qrCodeToken}`)
        .set('Authorization', `Bearer ${tokens.operadorEtar2}`); // Operador da ETAR 2 (Centro)

      expect(res.status).toBe(403);
      expect(res.body.erro).toContain('outra ETAR');
    });
  });

  describe('5. Confirmar Receção Física na ETAR (PUT /api/descargas/:id/receber)', () => {
    test('Deve registar a receção com sucesso, gerando uma amostra quando solicitado', async () => {
      const res = await request(app)
        .put(`/api/descargas/${idDescargaAutoAprovada}/receber`)
        .set('Authorization', `Bearer ${tokens.operadorEtar1}`)
        .send({
          quantidade_real: 98,
          recolha_amostra: true,
          observacoes: 'Descarregado sem anomalias.'
        });

      expect(res.status).toBe(200);
      expect(res.body.descarga.estado_descarga).toBe('RECEBIDA');
      expect(res.body.descarga.quantidade_real).toBe("98");
      expect(res.body.amostra).toBeDefined();
      expect(res.body.amostra.estado_amostra).toBe('RECOLHIDA');
      expect(res.body.amostra.qr_code_token).toMatch(/^AMOSTRA-\d{4}-[0-9A-F]{6}$/);
    });

    test('Deve impedir (400) o registo duplicado de receção (Idempotência)', async () => {
      const res = await request(app)
        .put(`/api/descargas/${idDescargaAutoAprovada}/receber`)
        .set('Authorization', `Bearer ${tokens.operadorEtar1}`)
        .send({
          quantidade_real: 98,
          recolha_amostra: false
        });

      expect(res.status).toBe(400);
      expect(res.body.erro).toContain('já foi processada');
    });
  });

  describe('6. Obter/Listar Descargas com RBAC (GET /api/descargas)', () => {
    test('Clientes só devem ver as suas próprias descargas', async () => {
      const res = await request(app)
        .get('/api/descargas')
        .set('Authorization', `Bearer ${tokens.clienteAAA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      // Garantir que todas as descargas listadas pertencem ao cliente 1
      res.body.forEach(descarga => {
        expect(descarga.id_cliente).toBe(1);
      });
    });

    test('Operador de ETAR só deve ver descargas da sua ETAR e em estado AGENDADA/RECEBIDA/CONCLUIDA', async () => {
      const res = await request(app)
        .get('/api/descargas')
        .set('Authorization', `Bearer ${tokens.operadorEtar1}`); // ETAR 1

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      res.body.forEach(descarga => {
        expect(descarga.id_etar).toBe(1);
        expect(['AGENDADA', 'RECEBIDA', 'CONCLUIDA']).toContain(descarga.estado_descarga);
      });
    });
  });

  describe('7. Download da Ficha de Descarga (GET /api/descargas/:id/ficha)', () => {
    test('Deve gerar o PDF da Ficha de Descarga com sucesso', async () => {
      const res = await request(app)
        .get(`/api/descargas/${idDescargaSolicitada}/ficha`)
        .set('Authorization', `Bearer ${tokens.gestorClientes}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      
      const pdfHeader = res.body.toString('binary', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    test('Deve impedir (403) outro cliente de aceder à Ficha de Descarga', async () => {
      const res = await request(app)
        .get(`/api/descargas/${idDescargaSolicitada}/ficha`)
        .set('Authorization', `Bearer ${tokens.clienteAAA}`); // idDescargaSolicitada é do clienteBBB (cliente 2)

      expect(res.status).toBe(403);
    });
  });
});
