const crypto = require('crypto');
const pool = require('../config/db');

/**
 * Cria um novo pedido de descarga.
 */
exports.criarPedido = async (req, res) => {
  const { id_etar, tipo_efluente, quantidade, numero_recipientes, nome_produtor_externo, morada_produtor_externo } = req.body;
  const id_cliente = req.user.id_cliente;

  if (!id_etar || !tipo_efluente || !quantidade) {
    return res.status(400).json({ erro: 'Por favor, indique ETAR, tipo de efluente e quantidade.' });
  }

  try {
    // 1. Verificar se a ETAR está disponível
    const etarRes = await pool.query('SELECT disponivel, nome FROM etar WHERE id_etar = $1', [id_etar]);
    if (etarRes.rows.length === 0) {
      return res.status(404).json({ erro: 'ETAR não encontrada.' });
    }
    if (!etarRes.rows[0].disponivel) {
      return res.status(400).json({ erro: `A ${etarRes.rows[0].nome} encontra-se indisponível para receber descargas.` });
    }

    // 2. Verificar regras de whitelist (autorização prévia)
    const autQuery = `
      SELECT quota, auto_aprovacao, ativo 
      FROM autorizacao 
      WHERE id_cliente = $1 AND id_etar = $2
    `;
    const autRes = await pool.query(autQuery, [id_cliente, id_etar]);

    const now = new Date();
    let estado = 'SOLICITADA';
    let dataDecisao = null;
    let autoAprovado = false;

    if (autRes.rows.length > 0 && autRes.rows[0].ativo) {
      const auth = autRes.rows[0];

      // Verificar quota de descargas efetuadas hoje
      const countQuery = `
        SELECT COUNT(*)::int AS total 
        FROM descarga 
        WHERE id_cliente = $1 AND id_etar = $2 
          AND data_pedido::date = CURRENT_DATE
      `;
      const countRes = await pool.query(countQuery, [id_cliente, id_etar]);
      const totalHoje = countRes.rows[0].total;

      if (totalHoje < auth.quota && auth.auto_aprovacao) {
        estado = 'AUTORIZADA';
        dataDecisao = now;
        autoAprovado = true;
      }
    }

    // 3. Inserir a descarga
    const insertQuery = `
      INSERT INTO descarga (
        id_cliente, id_etar, data_pedido, tipo_efluente, quantidade,
        numero_recipientes, estado_descarga, data_decisao,
        nome_produtor_externo, morada_produtor_externo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const values = [
      id_cliente, id_etar, now, tipo_efluente, quantidade,
      numero_recipientes || null, estado, dataDecisao,
      nome_produtor_externo || null, morada_produtor_externo || null
    ];
    
    const descRes = await pool.query(insertQuery, values);
    const descarga = descRes.rows[0];

    // 4. Registar no histórico
    const histQuery = `
      INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador)
      VALUES ('DESCARGA', $1, 'CRIACAO', $2, $3)
    `;
    const histDesc = autoAprovado 
      ? 'Pedido criado e aprovado automaticamente pelo sistema (Whitelist/Quota).'
      : 'Pedido criado. A aguardar aprovação manual.';
    await pool.query(histQuery, [descarga.id_descarga, histDesc, req.user.id_utilizador]);

    if (estado === 'SOLICITADA') {
      const { enviarNotificacao } = require('../config/socket');
      enviarNotificacao('gestores-clientes', 'novo-pedido', {
        id_descarga: descarga.id_descarga,
        cliente_nome: req.user.nome,
        quantidade: descarga.quantidade
      });
    }

    return res.status(201).json({
      mensagem: autoAprovado 
        ? 'Pedido de descarga criado e AUTORIZADO automaticamente.' 
        : 'Pedido de descarga criado com sucesso. A aguardar autorização.',
      descarga
    });

  } catch (err) {
    console.error('Erro ao criar pedido:', err);
    return res.status(500).json({ erro: 'Erro interno ao criar pedido de descarga.' });
  }
};

/**
 * Lista descargas com filtros baseados no perfil.
 */
exports.obterDescargas = async (req, res) => {
  const { estado, id_etar, id_cliente, data_inicio, data_fim } = req.query;
  const { perfil, id_cliente: userClienteId, id_etar: userEtarId } = req.user;

  let query = `
    SELECT d.*, c.nome AS cliente_nome, e.nome AS etar_nome
    FROM descarga d
    JOIN cliente c ON d.id_cliente = c.id_cliente
    LEFT JOIN etar e ON d.id_etar = e.id_etar
    WHERE 1=1
  `;
  const values = [];
  let paramIndex = 1;

  // Filtros de Perfil (RBAC)
  if (perfil === 'CLIENTE') {
    query += ` AND d.id_cliente = $${paramIndex++}`;
    values.push(userClienteId);
  } else if (perfil === 'OPERADOR_ETAR') {
    // Operadores só vêem descargas da sua ETAR e que já estejam agendadas ou em fases seguintes
    query += ` AND d.id_etar = $${paramIndex++} AND d.estado_descarga IN ('AGENDADA', 'RECEBIDA', 'CONCLUIDA')`;
    values.push(userEtarId);
  }

  // Filtros dinâmicos opcionais via Query Params
  if (estado) {
    query += ` AND d.estado_descarga = $${paramIndex++}`;
    values.push(estado.toUpperCase());
  }
  if (id_etar && perfil !== 'OPERADOR_ETAR') {
    query += ` AND d.id_etar = $${paramIndex++}`;
    values.push(id_etar);
  }
  if (id_cliente && perfil !== 'CLIENTE') {
    query += ` AND d.id_cliente = $${paramIndex++}`;
    values.push(id_cliente);
  }
  if (data_inicio) {
    query += ` AND d.data_pedido >= $${paramIndex++}`;
    values.push(data_inicio);
  }
  if (data_fim) {
    query += ` AND d.data_pedido <= $${paramIndex++}`;
    values.push(data_fim);
  }

  query += ' ORDER BY d.data_pedido DESC';

  try {
    const result = await pool.query(query, values);
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar descargas:', err);
    return res.status(500).json({ erro: 'Erro interno ao listar descargas.' });
  }
};

/**
 * Regista a decisão manual do Gestor de Clientes (Aprovar/Rejeitar).
 */
exports.registarDecisao = async (req, res) => {
  const { id } = req.params;
  const { decisao, observacoes } = req.body;

  if (!decisao || !['AUTORIZADA', 'REJEITADA'].includes(decisao.toUpperCase())) {
    return res.status(400).json({ erro: 'Decisão inválida. Escolha AUTORIZADA ou REJEITADA.' });
  }

  try {
    // Verificar se existe a descarga e se está SOLICITADA
    const checkRes = await pool.query('SELECT estado_descarga FROM descarga WHERE id_descarga = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Descarga não encontrada.' });
    }
    if (checkRes.rows[0].estado_descarga !== 'SOLICITADA') {
      return res.status(400).json({ erro: 'Apenas é possível decidir sobre descargas com estado SOLICITADA.' });
    }

    const query = `
      UPDATE descarga
      SET estado_descarga = $1, data_decisao = NOW(), id_utilizador_decisao = $2, observacoes = COALESCE($3, observacoes)
      WHERE id_descarga = $4
      RETURNING *
    `;
    const result = await pool.query(query, [decisao.toUpperCase(), req.user.id_utilizador, observacoes || null, id]);
    const descarga = result.rows[0];

    // Registar no histórico
    const histQuery = `
      INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador)
      VALUES ('DESCARGA', $1, $2, $3, $4)
    `;
    const acaoHist = decisao.toUpperCase() === 'AUTORIZADA' ? 'AUTORIZACAO' : 'REJEICAO';
    const descHist = `Pedido de descarga analisado e ${decisao.toLowerCase()} manualmente. Obs: ${observacoes || 'Sem observações'}`;
    await pool.query(histQuery, [id, acaoHist, descHist, req.user.id_utilizador]);

    const { enviarNotificacao } = require('../config/socket');
    enviarNotificacao(`cliente-${descarga.id_cliente}`, 'decisao-pedido', {
      id_descarga: descarga.id_descarga,
      estado_descarga: descarga.estado_descarga,
      mensagem: `O seu pedido de descarga #${descarga.id_descarga} foi ${decisao.toLowerCase()}.`
    });

    return res.json({
      mensagem: `Descarga foi ${decisao.toLowerCase()} com sucesso.`,
      descarga
    });

  } catch (err) {
    console.error('Erro ao decidir descarga:', err);
    return res.status(500).json({ erro: 'Erro interno ao registar decisão.' });
  }
};

/**
 * Cliente efetua o agendamento de uma descarga autorizada.
 */
exports.agendarDescarga = async (req, res) => {
  const { id } = req.params;
  const { empresa_transportadora, matricula_trator, matricula_cisterna } = req.body;
  const id_cliente = req.user.id_cliente;

  if (!empresa_transportadora || !matricula_trator) {
    return res.status(400).json({ erro: 'Por favor, forneça transportadora e matrícula do trator.' });
  }

  try {
    // Validar descarga pertence ao cliente e está AUTORIZADA
    const checkRes = await pool.query('SELECT estado_descarga, id_cliente FROM descarga WHERE id_descarga = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Descarga não encontrada.' });
    }
    const descargaCheck = checkRes.rows[0];
    if (descargaCheck.id_cliente !== id_cliente) {
      return res.status(403).json({ erro: 'Esta descarga não pertence à sua conta.' });
    }
    if (descargaCheck.estado_descarga !== 'AUTORIZADA') {
      return res.status(400).json({ erro: 'Apenas descargas no estado AUTORIZADA podem ser agendadas.' });
    }

    // Gerar token do QR Code único
    const hash = crypto.randomBytes(3).toString('hex').toUpperCase();
    const qrToken = `DESC-${new Date().getFullYear()}-${hash}`;

    const query = `
      UPDATE descarga
      SET estado_descarga = 'AGENDADA', data_agendamento = NOW(),
          empresa_transportadora = $1, matricula_trator = $2, matricula_cisterna = $3,
          qr_code_token = $4
      WHERE id_descarga = $5
      RETURNING *
    `;
    const result = await pool.query(query, [empresa_transportadora, matricula_trator, matricula_cisterna || null, qrToken, id]);
    const descarga = result.rows[0];

    // Registar histórico
    const histQuery = `
      INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador)
      VALUES ('DESCARGA', $1, 'AGENDAMENTO', $2, $3)
    `;
    const descHist = `Descarga agendada: ${empresa_transportadora} | Trator: ${matricula_trator} | Cisterna: ${matricula_cisterna || 'N/A'}`;
    await pool.query(histQuery, [id, descHist, req.user.id_utilizador]);

    const { enviarNotificacao } = require('../config/socket');
    enviarNotificacao(`etar-${descarga.id_etar}`, 'novo-agendamento', {
      id_descarga: descarga.id_descarga,
      empresa_transportadora: descarga.empresa_transportadora,
      matricula_trator: descarga.matricula_trator
    });

    return res.json({
      mensagem: 'Descarga agendada com sucesso. QR Code gerado.',
      qr_code_token: qrToken,
      descarga
    });

  } catch (err) {
    console.error('Erro ao agendar descarga:', err);
    return res.status(500).json({ erro: 'Erro interno ao agendar descarga.' });
  }
};

/**
 * Operador valida o QR Code (token) apresentado pelo motorista.
 */
exports.validarTokenQR = async (req, res) => {
  const { token } = req.params;

  try {
    const query = `
      SELECT d.*, c.nome AS cliente_nome, e.nome AS etar_nome
      FROM descarga d
      JOIN cliente c ON d.id_cliente = c.id_cliente
      LEFT JOIN etar e ON d.id_etar = e.id_etar
      WHERE d.qr_code_token = $1
    `;
    const result = await pool.query(query, [token.trim()]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'QR Code inválido ou descarga não encontrada.' });
    }

    const descarga = result.rows[0];

    // Validar se o operador é da mesma ETAR do agendamento
    if (req.user.perfil === 'OPERADOR_ETAR' && req.user.id_etar !== descarga.id_etar) {
      return res.status(403).json({ erro: 'Esta descarga está agendada para outra ETAR. Não pode validá-la.' });
    }

    return res.json({
      mensagem: 'Código QR lido com sucesso.',
      descarga
    });

  } catch (err) {
    console.error('Erro ao validar token QR:', err);
    return res.status(500).json({ erro: 'Erro interno ao validar QR Code.' });
  }
};

/**
 * Operador confirma a receção física na ETAR.
 */
exports.registarRececao = async (req, res) => {
  const { id } = req.params;
  const { quantidade_real, recolha_amostra, observacoes } = req.body;

  if (quantidade_real === undefined || quantidade_real <= 0) {
    return res.status(400).json({ erro: 'Por favor, indique a quantidade real recebida (volume superior a 0).' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar se existe a descarga e se está em estado AGENDADA
    const checkRes = await client.query('SELECT estado_descarga, id_etar FROM descarga WHERE id_descarga = $1 FOR UPDATE', [id]);
    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Descarga não encontrada.' });
    }

    const descarga = checkRes.rows[0];

    if (descarga.estado_descarga === 'RECEBIDA' || descarga.estado_descarga === 'CONCLUIDA') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Erro: Esta descarga já foi processada anteriormente.' });
    }

    if (descarga.estado_descarga !== 'AGENDADA') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Apenas descargas no estado AGENDADA podem ser recebidas.' });
    }

    // Verificar se o operador pertence a esta ETAR
    if (req.user.id_etar !== descarga.id_etar) {
      await client.query('ROLLBACK');
      return res.status(403).json({ erro: 'Não tem permissão para receber descargas de outra ETAR.' });
    }

    // 1. Atualizar a descarga
    const updateQuery = `
      UPDATE descarga
      SET estado_descarga = 'RECEBIDA', data_rececao = NOW(),
          quantidade_real = $1, recolha_amostra = $2, observacoes = COALESCE($3, observacoes),
          id_utilizador_rececao = $4
      WHERE id_descarga = $5
      RETURNING *
    `;
    const updateRes = await client.query(updateQuery, [quantidade_real, !!recolha_amostra, observacoes || null, req.user.id_utilizador, id]);
    const descargaAtualizada = updateRes.rows[0];

    // 2. Se recolheu amostra, criar registo na tabela amostra
    let amostra = null;
    if (recolha_amostra) {
      const hashSample = crypto.randomBytes(3).toString('hex').toUpperCase();
      const sampleToken = `AMOSTRA-${new Date().getFullYear()}-${hashSample}`;

      const sampleQuery = `
        INSERT INTO amostra (id_descarga, estado_amostra, data_recolha, qr_code_token)
        VALUES ($1, 'RECOLHIDA', NOW(), $2)
        RETURNING *
      `;
      const sampleRes = await client.query(sampleQuery, [id, sampleToken]);
      amostra = sampleRes.rows[0];
    }

    // 3. Registar histórico
    const histQuery = `
      INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador)
      VALUES ('DESCARGA', $1, 'RECECAO', $2, $3)
    `;
    const descHist = `Descarga recebida na ETAR. Vol Real: ${quantidade_real}L | Amostra Recolhida: ${recolha_amostra ? 'SIM' : 'NÃO'}`;
    await client.query(histQuery, [id, descHist, req.user.id_utilizador]);

    await client.query('COMMIT');

    if (recolha_amostra && amostra) {
      const { enviarNotificacao } = require('../config/socket');
      enviarNotificacao('laboratorio-tecnicos', 'nova-amostra', {
        id_amostra: amostra.id_amostra,
        qr_code_token: amostra.qr_code_token,
        id_descarga: id
      });
      enviarNotificacao('laboratorio-responsaveis', 'nova-amostra', {
        id_amostra: amostra.id_amostra,
        qr_code_token: amostra.qr_code_token,
        id_descarga: id
      });
    }

    return res.json({
      mensagem: 'Receção da descarga registada com sucesso.',
      descarga: descargaAtualizada,
      amostra
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na receção:', err);
    return res.status(500).json({ erro: 'Erro interno ao registar receção de descarga.' });
  } finally {
    client.release();
  }
};
