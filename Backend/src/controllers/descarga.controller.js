const crypto = require('crypto');
const PDFDocument = require('pdfkit');
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

      const diaSemana = now.getDay(); // 0 = Domingo, 6 = Sábado
      const eFimDeSemana = (diaSemana === 0 || diaSemana === 6);

      if ((auth.quota === null || auth.quota === undefined || totalHoje < auth.quota) && auth.auto_aprovacao && !eFimDeSemana) {
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
    SELECT d.*, c.nome AS cliente_nome, e.nome AS etar_nome,
           am.boletim_publico, am.id_amostra
    FROM descarga d
    JOIN cliente c ON d.id_cliente = c.id_cliente
    LEFT JOIN etar e ON d.id_etar = e.id_etar
    LEFT JOIN amostra am ON d.id_descarga = am.id_descarga
    WHERE 1=1
  `;
  const values = [];
  let paramIndex = 1;

  // Filtros de Perfil (RBAC)
  if (perfil === 'CLIENTE') {
    query += ` AND d.id_cliente = $${paramIndex++}`;
    values.push(userClienteId);
  } else if (perfil === 'OPERADOR_ETAR' || perfil === 'RESPONSAVEL_ETAR') {
    // Operadores e Responsáveis de ETAR só vêem descargas da sua ETAR e que já estejam agendadas ou em fases seguintes
    query += ` AND d.id_etar = $${paramIndex++} AND d.estado_descarga IN ('AGENDADA', 'RECEBIDA', 'CONCLUIDA')`;
    values.push(userEtarId);
  }

  // Filtros dinâmicos opcionais via Query Params
  if (estado) {
    query += ` AND d.estado_descarga = $${paramIndex++}`;
    values.push(estado.toUpperCase());
  }
  if (id_etar && id_etar !== 'null' && id_etar !== 'undefined' && perfil !== 'OPERADOR_ETAR' && perfil !== 'RESPONSAVEL_ETAR') {
    query += ` AND d.id_etar = $${paramIndex++}`;
    values.push(parseInt(id_etar, 10));
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

  if (!decisao || !['AUTORIZADA', 'REJEITADA', 'SOLICITAR_ELEMENTOS'].includes(decisao.toUpperCase())) {
    return res.status(400).json({ erro: 'Decisão inválida. Escolha AUTORIZADA, REJEITADA ou SOLICITAR_ELEMENTOS.' });
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

    let query;
    let values;

    if (decisao.toUpperCase() === 'SOLICITAR_ELEMENTOS') {
      query = `
        UPDATE descarga
        SET observacoes = $1
        WHERE id_descarga = $2
        RETURNING *
      `;
      values = [observacoes || null, id];
    } else {
      query = `
        UPDATE descarga
        SET estado_descarga = $1, data_decisao = NOW(), id_utilizador_decisao = $2, observacoes = COALESCE($3, observacoes)
        WHERE id_descarga = $4
        RETURNING *
      `;
      values = [decisao.toUpperCase(), req.user.id_utilizador, observacoes || null, id];
    }

    const result = await pool.query(query, values);
    const descarga = result.rows[0];

    // Registar no histórico
    const histQuery = `
      INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador)
      VALUES ('DESCARGA', $1, $2, $3, $4)
    `;
    const acaoHist = decisao.toUpperCase() === 'SOLICITAR_ELEMENTOS'
      ? 'PEDIDO_ELEMENTOS'
      : (decisao.toUpperCase() === 'AUTORIZADA' ? 'AUTORIZACAO' : 'REJEICAO');
    const descHist = decisao.toUpperCase() === 'SOLICITAR_ELEMENTOS'
      ? `Foram solicitados elementos adicionais ao cliente. Obs: ${observacoes || 'Sem observações'}`
      : `Pedido de descarga analisado e ${decisao.toLowerCase()} manualmente. Obs: ${observacoes || 'Sem observações'}`;
    await pool.query(histQuery, [id, acaoHist, descHist, req.user.id_utilizador]);

    const { enviarNotificacao } = require('../config/socket');
    const msgNotif = decisao.toUpperCase() === 'SOLICITAR_ELEMENTOS'
      ? `Foram solicitados elementos adicionais para o seu pedido de descarga #${descarga.id_descarga}.`
      : `O seu pedido de descarga #${descarga.id_descarga} foi ${decisao.toLowerCase()}.`;

    enviarNotificacao(`cliente-${descarga.id_cliente}`, 'decisao-pedido', {
      id_descarga: descarga.id_descarga,
      estado_descarga: descarga.estado_descarga,
      mensagem: msgNotif
    });

    return res.json({
      mensagem: decisao.toUpperCase() === 'SOLICITAR_ELEMENTOS'
        ? 'Pedido de elementos adicionais registado com sucesso.'
        : `Descarga foi ${decisao.toLowerCase()} com sucesso.`,
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
 * Cliente cancela uma descarga (SOLICITADA, AUTORIZADA ou AGENDADA).
 * O estado é alterado para 'REJEITADA' e a observação para 'Cancelada pelo cliente'.
 */
exports.cancelarDescarga = async (req, res) => {
  const { id } = req.params;
  const id_cliente = req.user.id_cliente;

  try {
    const checkRes = await pool.query('SELECT estado_descarga, id_cliente FROM descarga WHERE id_descarga = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Descarga não encontrada.' });
    }
    const descarga = checkRes.rows[0];
    if (descarga.id_cliente !== id_cliente) {
      return res.status(403).json({ erro: 'Esta descarga não pertence à sua conta.' });
    }

    const estadosCancelaveis = ['SOLICITADA', 'AUTORIZADA', 'AGENDADA'];
    if (!estadosCancelaveis.includes(descarga.estado_descarga)) {
      return res.status(400).json({ erro: 'Esta descarga já se encontra num estado que não pode ser cancelado.' });
    }

    const query = `
      UPDATE descarga
      SET estado_descarga = 'REJEITADA', observacoes = 'Cancelada pelo cliente', qr_code_token = NULL
      WHERE id_descarga = $1
      RETURNING *
    `;
    const result = await pool.query(query, [id]);
    const updatedDescarga = result.rows[0];

    const histQuery = `
      INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador)
      VALUES ('DESCARGA', $1, 'CANCELAMENTO', 'Descarga cancelada pelo cliente.', $2)
    `;
    await pool.query(histQuery, [id, req.user.id_utilizador]);

    const { enviarNotificacao } = require('../config/socket');
    enviarNotificacao('gestores-clientes', 'descarga-concluida', {
      id_descarga: id,
      mensagem: `A descarga #${id} foi cancelada pelo cliente (${req.user.nome}).`
    });

    return res.json({
      mensagem: 'Descarga cancelada com sucesso.',
      descarga: updatedDescarga
    });

  } catch (err) {
    console.error('Erro ao cancelar descarga:', err);
    return res.status(500).json({ erro: 'Erro interno ao cancelar descarga.' });
  }
};

/**
 * Cliente edita um pedido de descarga rejeitado/cancelado (REJEITADA).
 * Revalida a ETAR, verifica quotas e atualiza o estado para 'AUTORIZADA' ou 'SOLICITADA'.
 */
exports.editarPedido = async (req, res) => {
  const { id } = req.params;
  const { id_etar, tipo_efluente, quantidade, numero_recipientes, nome_produtor_externo, morada_produtor_externo } = req.body;
  const id_cliente = req.user.id_cliente;

  if (!id_etar || !tipo_efluente || !quantidade) {
    return res.status(400).json({ erro: 'Por favor, indique ETAR, tipo de efluente e quantidade.' });
  }

  try {
    // 1. Buscar a descarga e verificar se pertence ao cliente e está REJEITADA
    const checkRes = await pool.query('SELECT estado_descarga, id_cliente FROM descarga WHERE id_descarga = $1', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Descarga não encontrada.' });
    }
    const descarga = checkRes.rows[0];
    if (descarga.id_cliente !== id_cliente) {
      return res.status(403).json({ erro: 'Esta descarga não pertence à sua conta.' });
    }
    if (descarga.estado_descarga !== 'REJEITADA') {
      return res.status(400).json({ erro: 'Apenas pedidos no estado REJEITADA podem ser editados.' });
    }

    // 2. Verificar se a nova/atual ETAR está disponível
    const etarRes = await pool.query('SELECT disponivel, nome FROM etar WHERE id_etar = $1', [id_etar]);
    if (etarRes.rows.length === 0) {
      return res.status(404).json({ erro: 'ETAR não encontrada.' });
    }
    if (!etarRes.rows[0].disponivel) {
      return res.status(400).json({ erro: `A ${etarRes.rows[0].nome} encontra-se indisponível para receber descargas.` });
    }

    // 3. Verificar regras de whitelist (autorização prévia)
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

      const diaSemana = now.getDay(); // 0 = Domingo, 6 = Sábado
      const eFimDeSemana = (diaSemana === 0 || diaSemana === 6);

      if ((auth.quota === null || auth.quota === undefined || totalHoje < auth.quota) && auth.auto_aprovacao && !eFimDeSemana) {
        estado = 'AUTORIZADA';
        dataDecisao = now;
        autoAprovado = true;
      }
    }

    // 4. Atualizar a descarga
    const updateQuery = `
      UPDATE descarga
      SET id_etar = $1, tipo_efluente = $2, quantidade = $3,
          numero_recipientes = $4, estado_descarga = $5, data_decisao = $6,
          nome_produtor_externo = $7, morada_produtor_externo = $8,
          observacoes = NULL, qr_code_token = NULL
      WHERE id_descarga = $9
      RETURNING *
    `;
    const values = [
      id_etar, tipo_efluente, quantidade,
      numero_recipientes || null, estado, dataDecisao,
      nome_produtor_externo || null, morada_produtor_externo || null,
      id
    ];
    const updateRes = await pool.query(updateQuery, values);
    const updatedDescarga = updateRes.rows[0];

    // 5. Registar no histórico
    const histQuery = `
      INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador)
      VALUES ('DESCARGA', $1, 'EDICAO', $2, $3)
    `;
    const histDesc = autoAprovado 
      ? 'Pedido reeditado pelo cliente e aprovado automaticamente (Whitelist/Quota).'
      : 'Pedido reeditado pelo cliente. A aguardar aprovação manual.';
    await pool.query(histQuery, [id, histDesc, req.user.id_utilizador]);

    const { enviarNotificacao } = require('../config/socket');
    
    if (estado === 'SOLICITADA') {
      enviarNotificacao('gestores-clientes', 'novo-pedido', {
        id_descarga: id,
        cliente_nome: req.user.nome,
        quantidade: updatedDescarga.quantidade
      });
    } else {
      enviarNotificacao(`cliente-${id_cliente}`, 'decisao-pedido', {
        id_descarga: id,
        mensagem: `O seu pedido reeditado #${id} foi aprovado automaticamente.`
      });
    }

    enviarNotificacao('gestores-clientes', 'descarga-concluida', {
      id_descarga: id,
      mensagem: `O pedido #${id} foi reeditado pelo cliente (${req.user.nome}).`
    });

    return res.json({
      mensagem: autoAprovado 
        ? 'Pedido de descarga reeditado e AUTORIZADO automaticamente.' 
        : 'Pedido de descarga reeditado com sucesso. A aguardar autorização.',
      descarga: updatedDescarga
    });

  } catch (err) {
    console.error('Erro ao editar pedido:', err);
    return res.status(500).json({ erro: 'Erro interno ao editar pedido de descarga.' });
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
      WHERE d.qr_code_token = $1 OR CAST(d.id_descarga AS TEXT) = $1
    `;
    const result = await pool.query(query, [token.trim()]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'QR Code ou ID inválido ou descarga não encontrada.' });
    }

    const descarga = result.rows[0];

    // Validar se o operador é da mesma ETAR do agendamento
    if (req.user.perfil === 'OPERADOR_ETAR' && req.user.id_etar !== descarga.id_etar) {
      return res.status(403).json({ erro: 'Esta descarga está agendada para outra ETAR. Não pode validá-la.' });
    }

    return res.json({
      mensagem: 'Código QR ou ID validado com sucesso.',
      descarga
    });

  } catch (err) {
    console.error('Erro ao validar token/ID:', err);
    return res.status(500).json({ erro: 'Erro interno ao validar QR Code ou ID.' });
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
    const estadoDescargaFinal = recolha_amostra ? 'RECEBIDA' : 'CONCLUIDA';
    const updateQuery = `
      UPDATE descarga
      SET estado_descarga = $1, data_rececao = NOW(),
          quantidade_real = $2, recolha_amostra = $3, observacoes = COALESCE($4, observacoes),
          id_utilizador_rececao = $5
      WHERE id_descarga = $6
      RETURNING *
    `;
    const updateRes = await client.query(updateQuery, [estadoDescargaFinal, quantidade_real, !!recolha_amostra, observacoes || null, req.user.id_utilizador, id]);
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

    const { enviarNotificacao } = require('../config/socket');
    if (recolha_amostra && amostra) {
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
    } else {
      enviarNotificacao('gestores-clientes', 'descarga-concluida', {
        id_descarga: id,
        mensagem: `Receção efetuada na ETAR: Descarga #${id} foi concluída (volume real: ${quantidade_real} L).`
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

/**
 * Gera a Ficha de Descarga em PDF (GET /api/descargas/:id/ficha).
 */
exports.gerarFichaDescargaPDF = async (req, res) => {
  const { id } = req.params;
  const { perfil, id_cliente: userClienteId } = req.user;

  try {
    const query = `
      SELECT d.*, c.nome AS cliente_nome, c.email AS cliente_email, c.contacto AS cliente_contacto, c.morada AS cliente_morada,
             e.nome AS etar_nome,
             u_dec.nome AS decisor_nome, u_rec.nome AS operador_nome
      FROM descarga d
      JOIN cliente c ON d.id_cliente = c.id_cliente
      LEFT JOIN etar e ON d.id_etar = e.id_etar
      LEFT JOIN utilizador u_dec ON d.id_utilizador_decisao = u_dec.id_utilizador
      LEFT JOIN utilizador u_rec ON d.id_utilizador_rececao = u_rec.id_utilizador
      WHERE d.id_descarga = $1
    `;
    const descargaRes = await pool.query(query, [id]);

    if (descargaRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Descarga não encontrada.' });
    }

    const d = descargaRes.rows[0];

    if (perfil === 'CLIENTE' && d.id_cliente !== userClienteId) {
      return res.status(403).json({ erro: 'Não tem permissão para aceder a este documento.' });
    }

    // Determinar se o cliente atua como Produtor ou Transportador
    const isTransportador = d.nome_produtor_externo && d.nome_produtor_externo.trim().length > 0;

    const formatarDataPT = (date) => {
      if (!date) return '-';
      const dt = new Date(date);
      const dia = String(dt.getDate()).padStart(2, '0');
      const mes = String(dt.getMonth() + 1).padStart(2, '0');
      const ano = dt.getFullYear();
      return `${dia}/${mes}/${ano}`;
    };

    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=Ficha_Descarga_${d.id_descarga}.pdf`);
    doc.pipe(res);

    // --- 1. CABEÇALHO ---
    // Logótipo simulado
    doc.strokeColor('#CCCCCC').lineWidth(1);
    doc.rect(40, 40, 90, 45).stroke();
    doc.fontSize(8).fillColor('#666666').text('ENTIDADE GESTORA', 40, 58, { width: 90, align: 'center', bold: true });

    // Título Principal
    doc.fillColor('#1A365D').fontSize(12).text('FICHA DE DESCARGA DE ÁGUAS RESIDUAIS', 150, 48, { bold: true });
    doc.fontSize(10).fillColor('#333333').text(`AUTOPORTANTES – Cliente / ${isTransportador ? 'Transportador' : 'Produtor'}`, 150, 64, { bold: true });
    doc.fontSize(8.5).fillColor('#666666').text(`Documento N.º: DESC-${d.id_descarga}/${new Date(d.data_pedido).getFullYear()} | Token: ${d.qr_code_token || 'N/A'}`, 150, 78);

    doc.strokeColor('#DDDDDD').moveTo(40, 95).lineTo(555, 95).stroke();

    // --- 2. SECÇÃO PRODUTOR (Y=105) ---
    doc.fillColor('#1A365D').fontSize(10).text('PRODUTOR', 40, 105, { bold: true });
    doc.fontSize(8.5).fillColor('#333333');

    let produtorNome = '';
    let produtorMorada = '';
    let produtorContacto = '';
    let produtorTelefone = '';
    let produtorEmail = '';

    if (isTransportador) {
      // Se o cliente é transportador, o produtor é o externo preenchido
      produtorNome = d.nome_produtor_externo;
      produtorMorada = d.morada_produtor_externo || 'Morada não especificada';
      produtorContacto = 'N/A';
      produtorTelefone = 'N/A';
      produtorEmail = 'N/A';
    } else {
      // Se o cliente é o próprio produtor
      produtorNome = d.cliente_nome;
      produtorMorada = d.cliente_morada || 'Morada não especificada';
      produtorContacto = d.cliente_contacto || 'N/A';
      produtorTelefone = d.cliente_contacto || 'N/A'; // Usar contacto como telefone
      produtorEmail = d.cliente_email || 'N/A';
    }

    doc.text(`Empresa: ${produtorNome}`, 45, 120);
    doc.text(`Morada: ${produtorMorada}`, 45, 132);
    doc.text(`Pessoa a contactar: ${produtorContacto}`, 45, 144);
    doc.text(`Telefone: ${produtorTelefone}`, 280, 144);
    doc.text(`E-mail: ${produtorEmail}`, 410, 144);

    // Sub-secção Águas Residuais
    doc.fillColor('#1A365D').fontSize(9).text('ÁGUAS RESIDUAIS', 45, 162, { bold: true });
    doc.fontSize(8.5).fillColor('#333333');
    doc.text('Tipo de água residual entregue para tratamento:', 45, 175);

    // Checkboxes Tipo de Efluente
    const tipo = d.tipo_efluente ? d.tipo_efluente.toLowerCase() : '';
    const isInd = tipo.includes('industrial');
    const isDom = tipo.includes('domest') || tipo.includes('domést');
    const isMis = tipo.includes('mist');
    const isLam = tipo.includes('lamas') || tipo.includes('fossa');

    doc.text(`${isInd ? '[X]' : '[ ]'} Industrial`, 60, 190);
    doc.text(`${isDom ? '[X]' : '[ ]'} Doméstica`, 170, 190);
    doc.text(`${isMis ? '[X]' : '[ ]'} Mista`, 280, 190);
    doc.text(`${isLam ? '[X]' : '[ ]'} Lamas Fossa Séptica`, 370, 190);

    // Checkboxes ETAR
    doc.text('ETAR utilizada:', 45, 208);
    const etarNome = d.etar_nome ? d.etar_nome.toLowerCase() : '';
    const isEtarNorte = etarNome.includes('norte');
    const isEtarCentro = etarNome.includes('centro');
    const isEtarSul = etarNome.includes('sul');

    doc.text(`${isEtarNorte ? '[X]' : '[ ]'} ETAR Norte`, 60, 222);
    doc.text(`${isEtarCentro ? '[X]' : '[ ]'} ETAR Centro`, 170, 222);
    doc.text(`${isEtarSul ? '[X]' : '[ ]'} ETAR Sul`, 280, 222);

    // Quantidade Solicitada e Recipientes
    doc.text('Quantidade solicitada:', 45, 240);
    doc.text(`${d.quantidade} litros`, 60, 252, { bold: true });
    const quantM3 = d.quantidade ? (Number(d.quantidade) / 1000).toFixed(2) : '0.00';
    doc.text(`${quantM3} m³`, 170, 252, { bold: true });

    doc.text('N.º Embalagens ou Recipientes:', 280, 240);
    doc.text(`${d.numero_recipientes || 'N/A'}`, 280, 252, { bold: true });

    // Declaração do Produtor se for layout de Produtor
    if (!isTransportador) {
      doc.fillColor('#666666').fontSize(7.5).text('Declaração: certifico a exactidão das declarações prestadas e que a água residual/lama fossa séptica está conforme acordado na autorização de descarga concedida.', 45, 272, { width: 500 });
      doc.fontSize(8.5).fillColor('#333333').text(`Ass. Cliente (Produtor): ${d.cliente_nome}`, 45, 292);
      doc.text(`Data: ${formatarDataPT(d.data_pedido)}`, 400, 292);
      doc.strokeColor('#EEEEEE').moveTo(40, 312).lineTo(555, 312).stroke();
    } else {
      doc.strokeColor('#EEEEEE').moveTo(40, 272).lineTo(555, 272).stroke();
    }

    // --- 3. SECÇÃO TRANSPORTADOR (Y dinâmico) ---
    const transY = isTransportador ? 285 : 325;
    doc.fillColor('#1A365D').fontSize(10).text('TRANSPORTADOR', 40, transY, { bold: true });
    doc.fontSize(8.5).fillColor('#333333');

    let transportadorNome = '';
    let transportadorMorada = '';
    let transportadorContacto = '';
    let transportadorTelefone = '';
    let transportadorEmail = '';

    if (isTransportador) {
      // Se for transportador, o transportador é o cliente
      transportadorNome = d.cliente_nome;
      transportadorMorada = d.cliente_morada || 'Morada não especificada';
      transportadorContacto = d.cliente_contacto || 'N/A';
      transportadorTelefone = d.cliente_contacto || 'N/A';
      transportadorEmail = d.cliente_email || 'N/A';
    } else {
      // Se for produtor, a transportadora é externa
      transportadorNome = d.empresa_transportadora || 'N/A';
      transportadorMorada = 'N/A';
      transportadorContacto = 'N/A';
      transportadorTelefone = 'N/A';
      transportadorEmail = 'N/A';
    }

    doc.text(`Empresa / Nome: ${transportadorNome}`, 45, transY + 15);
    doc.text(`Morada: ${transportadorMorada}`, 45, transY + 27);
    doc.text(`Pessoa a contactar: ${transportadorContacto}`, 45, transY + 39);
    doc.text(`Telefone: ${transportadorTelefone}`, 280, transY + 39);
    doc.text(`E-mail: ${transportadorEmail}`, 410, transY + 39);
    doc.text(`Matrícula Camião/Tractor: ${d.matricula_trator || 'N/A'}`, 45, transY + 51);
    doc.text(`Matrícula Cisterna: ${d.matricula_cisterna || 'N/A'}`, 280, transY + 51);

    // Declaração se for Transportador
    if (isTransportador) {
      doc.fillColor('#666666').fontSize(7.5).text('Declaração: certifico a exactidão das declarações prestadas e que a água residual/lama fossa séptica está conforme acordado na autorização de descarga concedida.', 45, transY + 67, { width: 500 });
      doc.fontSize(8.5).fillColor('#333333').text(`Ass. Transportador: ${d.cliente_nome}`, 45, transY + 87);
      doc.text(`Data: ${formatarDataPT(d.data_agendamento || d.data_pedido)}`, 400, transY + 87);
      doc.strokeColor('#EEEEEE').moveTo(40, transY + 107).lineTo(555, transY + 107).stroke();
    } else {
      doc.strokeColor('#EEEEEE').moveTo(40, transY + 68).lineTo(555, transY + 68).stroke();
    }

    // --- 4. SECÇÃO ENTIDADE GESTORA (Y dinâmico) ---
    const gestoraY = isTransportador ? 405 : 405;
    doc.fillColor('#1A365D').fontSize(10).text('ENTIDADE GESTORA', 40, gestoraY, { bold: true });
    doc.fontSize(8.5).fillColor('#333333');
    doc.text('Pessoa a contactar: Gestor de cliente', 45, gestoraY + 15);
    doc.text('Telefone: +351 252 000 000', 45, gestoraY + 27);
    doc.text('E-mail: gestao.clientes@entidadegestora.pt', 280, gestoraY + 27);

    // Recepção Aceite
    doc.fillColor('#1A365D').fontSize(9).text('Receção Aceite na ETAR', 45, gestoraY + 45, { bold: true });
    doc.fontSize(8.5).fillColor('#333333');
    doc.text('Quantidade real recebida:', 45, gestoraY + 58);
    const quantRealLitros = d.quantidade_real ? `${d.quantidade_real} litros` : 'Ainda não recebida';
    const quantRealM3 = d.quantidade_real ? `${(Number(d.quantidade_real) / 1000).toFixed(2)} m³` : '-';
    doc.text(quantRealLitros, 60, gestoraY + 70, { bold: true });
    doc.text(quantRealM3, 170, gestoraY + 70, { bold: true });

    doc.text(`Data da Receção: ${formatarDataPT(d.data_rececao)}`, 280, gestoraY + 58);
    doc.text(`Operador Recetor: ${d.operador_nome || 'N/A'}`, 280, gestoraY + 70);

    doc.strokeColor('#EEEEEE').moveTo(40, gestoraY + 90).lineTo(555, gestoraY + 90).stroke();

    // --- 5. OBSERVAÇÕES (Y dinâmico) ---
    const obsY = gestoraY + 102;
    doc.fillColor('#1A365D').fontSize(10).text('OBSERVAÇÕES', 40, obsY, { bold: true });
    doc.fontSize(8.5).fillColor('#333333');
    doc.text(d.observacoes || 'Nenhuma observação registada.', 45, obsY + 15, { width: 500 });

    // --- 6. ASSINATURAS E VALIDAÇÃO DIGITAL ---
    const signY = obsY + 55;
    doc.fontSize(8.5).fillColor('#333333');
    doc.text('Validação da Entidade Gestora:', 40, signY);
    doc.fontSize(9).text(d.decisor_nome || 'Gestor de Contratos', 40, signY + 15, { bold: true });
    doc.fontSize(7.5).fillColor('#666666').text('Documento autorizado digitalmente pelo Gestor.', 40, signY + 27, { italic: true });

    doc.fontSize(8.5).fillColor('#333333').text('Operador de Receção ETAR:', 330, signY);
    doc.fontSize(9).text(d.operador_nome || 'Operador ETAR', 330, signY + 15, { bold: true });
    doc.fontSize(7.5).fillColor('#666666').text(d.data_rececao ? 'Receção física assinada digitalmente na ETAR.' : 'A aguardar receção física.', 330, signY + 27, { italic: true });

    // Rodapé de cópias
    doc.fontSize(7).fillColor('#999999').text('Este impresso foi assinado eletronicamente e emitido pelo sistema centralizado de gestão de descargas.', 40, 775, { align: 'center' });
    doc.text('Pág. 1 de 1', 510, 790);

    doc.end();

  } catch (err) {
    console.error('Erro ao gerar PDF da ficha de descarga:', err);
    if (!res.headersSent) {
      return res.status(500).json({ erro: 'Erro interno ao gerar PDF da ficha de descarga.' });
    }
  }
};
