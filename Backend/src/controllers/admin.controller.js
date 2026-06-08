const bcrypt = require('bcryptjs');
const pool = require('../config/db');

/**
 * 1. Clientes
 */
exports.obterClientes = async (req, res) => {
  try {
    const query = `
      SELECT c.*, u.ativo 
      FROM cliente c 
      JOIN utilizador u ON c.id_utilizador = u.id_utilizador
      ORDER BY c.id_cliente
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao obter clientes:', err);
    return res.status(500).json({ erro: 'Erro interno ao obter clientes.' });
  }
};

exports.criarCliente = async (req, res) => {
  const { nome, morada, contacto, telefone, email, password, periodicidade_analise } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ erro: 'Por favor, indique o nome e email do cliente.' });
  }

  const rawPassword = password && password.trim() ? password.trim() : 'Descargas123!';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar se o email já está em uso
    const checkUser = await client.query('SELECT id_utilizador FROM utilizador WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (checkUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Este email já está registado no sistema.' });
    }

    // Cifrar a password
    const passwordHash = await bcrypt.hash(rawPassword, 12);

    // 1. Criar o utilizador com perfil CLIENTE (id_perfil = 1)
    const userQuery = `
      INSERT INTO utilizador (id_perfil, nome, email, password_hash, ativo)
      VALUES (1, $1, $2, $3, true)
      RETURNING id_utilizador
    `;
    const userRes = await client.query(userQuery, [nome, email.trim(), passwordHash]);
    const id_utilizador = userRes.rows[0].id_utilizador;

    // 2. Criar a ficha do cliente
    const clientQuery = `
      INSERT INTO cliente (id_utilizador, nome, morada, contacto, telefone, email, periodicidade_analise)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const clientRes = await client.query(clientQuery, [
      id_utilizador,
      nome,
      morada || null,
      contacto || null,
      telefone || null,
      email.trim(),
      periodicidade_analise || 'POR_DESCARGA'
    ]);

    await client.query('COMMIT');

    return res.status(201).json({
      mensagem: 'Cliente registado com sucesso.',
      cliente: clientRes.rows[0]
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao criar cliente:', err);
    return res.status(500).json({ erro: 'Erro interno ao criar cliente contratualizado.' });
  } finally {
    client.release();
  }
};

/**
 * 2. ETARs
 */
exports.obterEtars = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM etar ORDER BY id_etar');
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao obter ETARs:', err);
    return res.status(500).json({ erro: 'Erro interno ao obter ETARs.' });
  }
};

exports.atualizarDisponibilidadeEtar = async (req, res) => {
  const { id } = req.params;
  const { disponivel } = req.body;

  if (disponivel === undefined) {
    return res.status(400).json({ erro: 'Por favor, indique o estado de disponibilidade.' });
  }

  try {
    const query = `
      UPDATE etar 
      SET disponivel = $1 
      WHERE id_etar = $2 
      RETURNING *
    `;
    const result = await pool.query(query, [!!disponivel, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'ETAR não encontrada.' });
    }

    const etar = result.rows[0];

    // Emitir notificação WebSockets
    const { enviarNotificacao } = require('../config/socket');
    enviarNotificacao(`etar-${etar.id_etar}`, 'status-etar', {
      id_etar: etar.id_etar,
      disponivel: etar.disponivel,
      mensagem: `A ${etar.nome} encontra-se agora ${etar.disponivel ? 'disponível' : 'indisponível'} para receber descargas.`
    });
    // Notificar gestores
    enviarNotificacao('gestores-clientes', 'status-etar', {
      id_etar: etar.id_etar,
      disponivel: etar.disponivel,
      mensagem: `A ${etar.nome} encontra-se agora ${etar.disponivel ? 'disponível' : 'indisponível'} para receber descargas.`
    });

    return res.json({
      mensagem: `Disponibilidade da ETAR atualizada para ${etar.disponivel ? 'disponível' : 'indisponível'}.`,
      etar
    });

  } catch (err) {
    console.error('Erro ao atualizar disponibilidade da ETAR:', err);
    return res.status(500).json({ erro: 'Erro interno ao atualizar disponibilidade da ETAR.' });
  }
};

/**
 * 3. Whitelists / Autorizações
 */
exports.obterAutorizacoes = async (req, res) => {
  try {
    const query = `
      SELECT a.*, c.nome AS cliente_nome, e.nome AS etar_nome 
      FROM autorizacao a
      JOIN cliente c ON a.id_cliente = c.id_cliente
      JOIN etar e ON a.id_etar = e.id_etar
      ORDER BY a.id_autorizacao
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao obter autorizações:', err);
    return res.status(500).json({ erro: 'Erro interno ao obter autorizações.' });
  }
};

exports.criarAutorizacao = async (req, res) => {
  const { id_cliente, id_etar, quota, auto_aprovacao } = req.body;

  if (!id_cliente || !id_etar || quota === undefined) {
    return res.status(400).json({ erro: 'Indique cliente, ETAR e a quota diária autorizada.' });
  }

  try {
    // Verificar se já existe autorização para esta associação
    const checkQuery = 'SELECT id_autorizacao FROM autorizacao WHERE id_cliente = $1 AND id_etar = $2';
    const checkRes = await pool.query(checkQuery, [id_cliente, id_etar]);

    if (checkRes.rows.length > 0) {
      return res.status(400).json({ erro: 'Já existe uma regra de whitelist configurada para este cliente nesta ETAR.' });
    }

    const query = `
      INSERT INTO autorizacao (id_cliente, id_etar, quota, ativo, auto_aprovacao)
      VALUES ($1, $2, $3, true, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [id_cliente, id_etar, parseInt(quota, 10), !!auto_aprovacao]);

    return res.status(201).json({
      mensagem: 'Regra de whitelist criada com sucesso.',
      autorizacao: result.rows[0]
    });

  } catch (err) {
    console.error('Erro ao criar autorização:', err);
    return res.status(500).json({ erro: 'Erro interno ao criar regra de whitelist.' });
  }
};

exports.atualizarAutorizacao = async (req, res) => {
  const { id } = req.params;
  const { quota, auto_aprovacao, ativo } = req.body;

  if (quota === undefined || auto_aprovacao === undefined || ativo === undefined) {
    return res.status(400).json({ erro: 'Forneça quota, auto_aprovacao e estado ativo.' });
  }

  try {
    const query = `
      UPDATE autorizacao
      SET quota = $1, auto_aprovacao = $2, ativo = $3
      WHERE id_autorizacao = $4
      RETURNING *
    `;
    const result = await pool.query(query, [parseInt(quota, 10), !!auto_aprovacao, !!ativo, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Regra de whitelist não encontrada.' });
    }

    return res.json({
      mensagem: 'Regra de whitelist atualizada com sucesso.',
      autorizacao: result.rows[0]
    });

  } catch (err) {
    console.error('Erro ao atualizar autorização:', err);
    return res.status(500).json({ erro: 'Erro interno ao atualizar regra de whitelist.' });
  }
};

/**
 * 4. Parâmetros Contratuais
 */
exports.obterParametros = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parametro ORDER BY id_parametro');
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao obter parâmetros:', err);
    return res.status(500).json({ erro: 'Erro interno ao obter parâmetros.' });
  }
};

exports.obterParametrosCliente = async (req, res) => {
  const { id } = req.params; // id_cliente

  try {
    const query = `
      SELECT id_parametro 
      FROM cliente_parametro 
      WHERE id_cliente = $1 AND ativo = true
    `;
    const result = await pool.query(query, [id]);
    const activeIds = result.rows.map(row => row.id_parametro);
    return res.json(activeIds);
  } catch (err) {
    console.error('Erro ao obter parâmetros do cliente:', err);
    return res.status(500).json({ erro: 'Erro interno ao obter parâmetros contratuais.' });
  }
};

exports.atualizarParametrosCliente = async (req, res) => {
  const { id } = req.params; // id_cliente
  const { parametros } = req.body; // Array de IDs de parâmetros ativos (ex: [6, 7])

  if (!parametros || !Array.isArray(parametros)) {
    return res.status(400).json({ erro: 'Forneça uma lista de IDs de parâmetros.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Remover parâmetros ativos antigos
    await client.query('DELETE FROM cliente_parametro WHERE id_cliente = $1', [id]);

    // Inserir os novos parâmetros ativos
    const insertQuery = `
      INSERT INTO cliente_parametro (id_cliente, id_parametro, ativo)
      VALUES ($1, $2, true)
    `;
    for (const paramId of parametros) {
      await client.query(insertQuery, [id, parseInt(paramId, 10)]);
    }

    await client.query('COMMIT');
    return res.json({ mensagem: 'Parâmetros contratuais do cliente atualizados com sucesso.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar parâmetros do cliente:', err);
    return res.status(500).json({ erro: 'Erro interno ao atualizar parâmetros contratuais.' });
  } finally {
    client.release();
  }
};
