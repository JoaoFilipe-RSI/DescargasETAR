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

exports.atualizarCliente = async (req, res) => {
  const { id } = req.params;
  const { nome, morada, contacto, telefone, email, periodicidade_analise } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ erro: 'Nome e email são obrigatórios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const clientRes = await client.query('SELECT id_utilizador FROM cliente WHERE id_cliente = $1', [id]);
    if (clientRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    const id_utilizador = clientRes.rows[0].id_utilizador;

    const emailCheck = await client.query(
      'SELECT id_utilizador FROM utilizador WHERE LOWER(email) = LOWER($1) AND id_utilizador <> $2',
      [email.trim(), id_utilizador]
    );
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Este email já está a ser utilizado por outro utilizador.' });
    }

    const { password } = req.body;
    if (password && password.trim().length >= 6) {
      const passwordHash = await bcrypt.hash(password.trim(), 12);
      await client.query(
        'UPDATE utilizador SET nome = $1, email = $2, password_hash = $3 WHERE id_utilizador = $4',
        [nome, email.trim(), passwordHash, id_utilizador]
      );
    } else {
      await client.query(
        'UPDATE utilizador SET nome = $1, email = $2 WHERE id_utilizador = $3',
        [nome, email.trim(), id_utilizador]
      );
    }

    const updateClientQuery = `
      UPDATE cliente
      SET nome = $1, morada = $2, contacto = $3, telefone = $4, email = $5, periodicidade_analise = $6
      WHERE id_cliente = $7
      RETURNING *
    `;
    const updatedClientRes = await client.query(updateClientQuery, [
      nome,
      morada || null,
      contacto || null,
      telefone || null,
      email.trim(),
      periodicidade_analise,
      id
    ]);

    await client.query('COMMIT');
    return res.json({
      mensagem: 'Dados do cliente atualizados com sucesso.',
      cliente: updatedClientRes.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar cliente:', err);
    return res.status(500).json({ erro: 'Erro interno ao atualizar dados do cliente.' });
  } finally {
    client.release();
  }
};

exports.atualizarEstadoCliente = async (req, res) => {
  const { id } = req.params;
  const { ativo } = req.body;

  if (ativo === undefined) {
    return res.status(400).json({ erro: 'Por favor, indique o estado ativo.' });
  }

  try {
    const clientRes = await pool.query('SELECT id_utilizador FROM cliente WHERE id_cliente = $1', [id]);
    if (clientRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado.' });
    }
    const id_utilizador = clientRes.rows[0].id_utilizador;

    const userQuery = 'UPDATE utilizador SET ativo = $1 WHERE id_utilizador = $2 RETURNING ativo';
    const userRes = await pool.query(userQuery, [!!ativo, id_utilizador]);

    return res.json({
      mensagem: `Estado da conta do cliente atualizado para ${userRes.rows[0].ativo ? 'ativo' : 'inativo'}.`,
      ativo: userRes.rows[0].ativo
    });
  } catch (err) {
    console.error('Erro ao atualizar estado do cliente:', err);
    return res.status(500).json({ erro: 'Erro interno ao atualizar estado da conta do cliente.' });
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

  const id_etar = parseInt(id, 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Atualizar a disponibilidade da ETAR
    const updateEtarQuery = `
      UPDATE etar 
      SET disponivel = $1 
      WHERE id_etar = $2 
      RETURNING *
    `;
    const etarResult = await client.query(updateEtarQuery, [!!disponivel, id_etar]);

    if (etarResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'ETAR não encontrada.' });
    }

    const etar = etarResult.rows[0];

    // Se a ETAR foi marcada como INDISPONÍVEL
    if (!etar.disponivel) {
      // 2. Processar descargas AUTORIZADAS (Reagendamento automático)
      const autDescargasRes = await client.query(
        "SELECT * FROM descarga WHERE id_etar = $1 AND estado_descarga = 'AUTORIZADA'",
        [id_etar]
      );
      const autDescargas = autDescargasRes.rows;

      const { enviarNotificacao } = require('../config/socket');

      for (const d of autDescargas) {
        // Encontrar ETARs candidatas ativas (excluindo a original)
        const candEtarsRes = await client.query(
          "SELECT id_etar, nome FROM etar WHERE id_etar <> $1 AND disponivel = true",
          [id_etar]
        );
        const candEtars = candEtarsRes.rows;

        let bestEtar = null;
        let minDiff = Infinity;

        for (const cand of candEtars) {
          // Verificar se o cliente tem whitelist/autorização ativa para esta ETAR
          const authRes = await client.query(
            "SELECT quota, auto_aprovacao, ativo FROM autorizacao WHERE id_cliente = $1 AND id_etar = $2 AND ativo = true",
            [d.id_cliente, cand.id_etar]
          );

          if (authRes.rows.length > 0) {
            const auth = authRes.rows[0];
            
            // Verificar quota consumida no dia da data_pedido
            const countRes = await client.query(
              "SELECT COUNT(*)::int AS total FROM descarga WHERE id_cliente = $1 AND id_etar = $2 AND data_pedido::date = $3::date",
              [d.id_cliente, cand.id_etar, d.data_pedido]
            );
            const totalDia = countRes.rows[0].total;

            if (auth.quota === null || auth.quota === undefined || totalDia < auth.quota) {
              const diff = Math.abs(cand.id_etar - id_etar);
              if (diff < minDiff) {
                minDiff = diff;
                bestEtar = cand;
              }
            }
          }
        }

        if (bestEtar) {
          // Reagendar automaticamente para a bestEtar
          await client.query(
            "UPDATE descarga SET id_etar = $1 WHERE id_descarga = $2",
            [bestEtar.id_etar, d.id_descarga]
          );

          // Registar no histórico
          await client.query(
            "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
            [
              'DESCARGA',
              d.id_descarga,
              'REAGENDAMENTO_AUTOMATICO',
              `Descarga reencaminhada automaticamente para a ${bestEtar.nome} devido à indisponibilidade de urgência da ${etar.nome}.`,
              req.user.id_utilizador
            ]
          );

          // Enviar notificação real-time para o cliente
          enviarNotificacao(`cliente-${d.id_cliente}`, 'decisao-pedido', {
            id_descarga: d.id_descarga,
            estado_descarga: 'AUTORIZADA',
            mensagem: `A sua descarga autorizada #${d.id_descarga} foi reencaminhada automaticamente para a ${bestEtar.nome} devido à indisponibilidade de urgência da ${etar.nome}.`
          });
        } else {
          // Sem alternativa: reverter para SOLICITADA
          const obsMsg = `[Revertido por indisponibilidade urgente da ${etar.nome}].\nNão foi encontrada alternativa viável automaticamente.\nAguarde reencaminhamento por parte da Gestão de Clientes.`;
          const novaObs = d.observacoes ? `${obsMsg}\n${d.observacoes}` : obsMsg;

          await client.query(
            "UPDATE descarga SET estado_descarga = 'SOLICITADA', observacoes = $1 WHERE id_descarga = $2",
            [novaObs, d.id_descarga]
          );

          // Registar no histórico
          await client.query(
            "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
            [
              'DESCARGA',
              d.id_descarga,
              'REVERSAO_ESTADO',
              `Descarga revertida para SOLICITADA devido a indisponibilidade da ${etar.nome} sem ETAR alternativa disponível.`,
              req.user.id_utilizador
            ]
          );

          // Enviar notificação real-time para o cliente
          enviarNotificacao(`cliente-${d.id_cliente}`, 'decisao-pedido', {
            id_descarga: d.id_descarga,
            estado_descarga: 'SOLICITADA',
            mensagem: `A sua descarga #${d.id_descarga} necessita de ser reencaminhada devido à indisponibilidade de urgência da ${etar.nome}. Entraremos em contacto brevemente.`
          });

          // Enviar notificação real-time para os gestores
          enviarNotificacao('gestores-clientes', 'novo-pedido', {
            id_descarga: d.id_descarga,
            estado_descarga: 'SOLICITADA',
            mensagem: `O pedido de descarga #${d.id_descarga} foi revertido para SOLICITADO. Não foi encontrada nenhuma ETAR alternativa com quota disponível para o cliente.`
          });
        }
      }

      // 3. Processar descargas AGENDADAS (Apenas marcar com comentário de alerta se não tiver já o alerta)
      const agendadasRes = await client.query(
        "SELECT d.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone FROM descarga d JOIN cliente c ON d.id_cliente = c.id_cliente JOIN utilizador u ON c.id_utilizador = u.id_utilizador WHERE d.id_etar = $1 AND d.estado_descarga = 'AGENDADA'",
        [id_etar]
      );
      const agendadas = agendadasRes.rows;

      for (const d of agendadas) {
        if (!d.observacoes || !d.observacoes.includes('ALERTA OPERACIONAL')) {
          const alertaMsg = `[ALERTA OPERACIONAL: ETAR indisponível. Contactar o cliente imediatamente se a descarga não puder ser realizada (ex: impossibilidade de usar o tanque de retenção).]`;
          const novaObs = d.observacoes ? `${alertaMsg}\n${d.observacoes}` : alertaMsg;

          await client.query(
            "UPDATE descarga SET observacoes = $1 WHERE id_descarga = $2",
            [novaObs, d.id_descarga]
          );

          // Registar no histórico
          await client.query(
            "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
            [
              'DESCARGA',
              d.id_descarga,
              'ALERTA_OPERACIONAL',
              `Alerta de contacto imediato adicionado à descarga agendada #${d.id_descarga} devido a indisponibilidade da ${etar.nome}.`,
              req.user.id_utilizador
            ]
          );

          // Enviar notificação real-time para os gestores
          enviarNotificacao('gestores-clientes', 'alerta-agendamento', {
            id_descarga: d.id_descarga,
            estado_descarga: 'AGENDADA',
            mensagem: `Aviso: A descarga agendada #${d.id_descarga} para a ${etar.nome} (agora indisponível) requer contacto imediato com o cliente ${d.cliente_nome} (${d.cliente_telefone || 'Sem telefone'}).`
          });
        }
      }
    }

    await client.query('COMMIT');

    // Emitir notificações gerais de alteração de estado da ETAR (fora da transação para manter a lógica original)
    const { enviarNotificacao } = require('../config/socket');
    enviarNotificacao(`etar-${etar.id_etar}`, 'status-etar', {
      id_etar: etar.id_etar,
      disponivel: etar.disponivel,
      mensagem: `A ${etar.nome} encontra-se agora ${etar.disponivel ? 'disponível' : 'indisponível'} para receber descargas.`
    });
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
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar disponibilidade da ETAR:', err);
    return res.status(500).json({ erro: 'Erro interno ao atualizar disponibilidade da ETAR.' });
  } finally {
    client.release();
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

  if (!id_cliente || !id_etar) {
    return res.status(400).json({ erro: 'Indique cliente e ETAR.' });
  }

  try {
    // Verificar se já existe autorização para esta associação
    const checkQuery = 'SELECT id_autorizacao FROM autorizacao WHERE id_cliente = $1 AND id_etar = $2';
    const checkRes = await pool.query(checkQuery, [id_cliente, id_etar]);

    if (checkRes.rows.length > 0) {
      return res.status(400).json({ erro: 'Já existe uma regra de whitelist configurada para este cliente nesta ETAR.' });
    }

    const quotaVal = (quota === undefined || quota === null || quota === '' || isNaN(parseInt(quota, 10))) ? null : parseInt(quota, 10);

    const query = `
      INSERT INTO autorizacao (id_cliente, id_etar, quota, ativo, auto_aprovacao)
      VALUES ($1, $2, $3, true, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [id_cliente, id_etar, quotaVal, !!auto_aprovacao]);

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

  if (auto_aprovacao === undefined || ativo === undefined) {
    return res.status(400).json({ erro: 'Forneça auto_aprovacao e estado ativo.' });
  }

  try {
    const quotaVal = (quota === undefined || quota === null || quota === '' || isNaN(parseInt(quota, 10))) ? null : parseInt(quota, 10);

    const query = `
      UPDATE autorizacao
      SET quota = $1, auto_aprovacao = $2, ativo = $3
      WHERE id_autorizacao = $4
      RETURNING *
    `;
    const result = await pool.query(query, [quotaVal, !!auto_aprovacao, !!ativo, id]);

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
    return res.json({ mensagem: 'Parâmetros contratuais do cliente updated com sucesso.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao atualizar parâmetros do cliente:', err);
    return res.status(500).json({ erro: 'Erro interno ao atualizar parâmetros contratuais.' });
  } finally {
    client.release();
  }
};

exports.obterRelatorios = async (req, res) => {
  const { id_cliente, id_etar, mes, ano, estado } = req.query;

  let query = `
    SELECT d.id_descarga, d.data_pedido, d.data_rececao, d.tipo_efluente, d.quantidade, d.quantidade_real, d.estado_descarga, d.observacoes,
           c.nome AS cliente_nome, c.id_cliente,
           e.nome AS etar_nome, e.id_etar,
           am.id_amostra, am.qr_code_token, am.estado_amostra, am.data_validacao,
           COALESCE(
             (SELECT json_agg(json_build_object('parametro', p.nome, 'valor', r.valor, 'unidade', r.unidade, 'incerteza', r.incerteza))
              FROM resultado_analitico r
              JOIN parametro p ON r.id_parametro = p.id_parametro
              WHERE r.id_amostra = am.id_amostra),
             '[]'::json
           ) AS resultados
    FROM descarga d
    JOIN cliente c ON d.id_cliente = c.id_cliente
    LEFT JOIN etar e ON d.id_etar = e.id_etar
    LEFT JOIN amostra am ON d.id_descarga = am.id_descarga
    WHERE 1=1
  `;
  const values = [];
  let paramIndex = 1;

  if (id_cliente && id_cliente !== 'all') {
    query += ` AND d.id_cliente = $${paramIndex++}`;
    values.push(parseInt(id_cliente, 10));
  }

  if (id_etar && id_etar !== 'all') {
    query += ` AND d.id_etar = $${paramIndex++}`;
    values.push(parseInt(id_etar, 10));
  }

  if (mes && mes !== 'all') {
    query += ` AND EXTRACT(MONTH FROM d.data_pedido) = $${paramIndex++}`;
    values.push(parseInt(mes, 10));
  }

  if (ano && ano !== 'all') {
    query += ` AND EXTRACT(YEAR FROM d.data_pedido) = $${paramIndex++}`;
    values.push(parseInt(ano, 10));
  }

  if (estado && estado !== 'all') {
    query += ` AND d.estado_descarga = $${paramIndex++}`;
    values.push(estado.toUpperCase());
  }

  query += ' ORDER BY d.data_pedido DESC';

  try {
    const result = await pool.query(query, values);
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao obter relatórios:', err);
    return res.status(500).json({ erro: 'Erro interno ao obter relatórios.' });
  }
};

exports.obterUtilizadores = async (req, res) => {
  try {
    const query = `
      SELECT u.id_utilizador, u.nome, u.email, u.id_perfil, u.ativo, u.id_etar,
             p.nome AS perfil_nome, e.nome AS etar_nome
      FROM utilizador u
      JOIN perfil p ON u.id_perfil = p.id_perfil
      LEFT JOIN etar e ON u.id_etar = e.id_etar
      WHERE u.id_perfil <> 1
      ORDER BY u.id_utilizador
    `;
    const result = await pool.query(query);
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao obter utilizadores:', err);
    return res.status(500).json({ erro: 'Erro interno ao obter utilizadores.' });
  }
};

exports.criarUtilizador = async (req, res) => {
  const { nome, email, id_perfil, password, id_etar, ativo } = req.body;

  if (!nome || !email || !id_perfil) {
    return res.status(400).json({ erro: 'Por favor, indique nome, email e perfil.' });
  }

  const rawPassword = password && password.trim() ? password.trim() : 'Descargas123!';
  try {
    // Verificar se o email já existe
    const emailCheck = await pool.query('SELECT id_utilizador FROM utilizador WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ erro: 'Este email já está registado no sistema.' });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const query = `
      INSERT INTO utilizador (id_perfil, nome, email, password_hash, id_etar, ativo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_utilizador, nome, email, id_perfil, id_etar, ativo
    `;
    const result = await pool.query(query, [
      parseInt(id_perfil, 10),
      nome.trim(),
      email.trim().toLowerCase(),
      passwordHash,
      id_etar ? parseInt(id_etar, 10) : null,
      ativo !== undefined ? !!ativo : true
    ]);

    return res.status(201).json({
      mensagem: 'Utilizador criado com sucesso.',
      utilizador: result.rows[0]
    });
  } catch (err) {
    console.error('Erro ao criar utilizador:', err);
    return res.status(500).json({ erro: 'Erro interno ao criar utilizador.' });
  }
};

exports.atualizarUtilizador = async (req, res) => {
  const { id } = req.params;
  const { nome, email, id_perfil, password, id_etar, ativo } = req.body;

  if (!nome || !email || !id_perfil) {
    return res.status(400).json({ erro: 'Por favor, indique nome, email e perfil.' });
  }

  try {
    // Verificar se o email já está em uso por outro utilizador
    const emailCheck = await pool.query(
      'SELECT id_utilizador FROM utilizador WHERE LOWER(email) = LOWER($1) AND id_utilizador <> $2',
      [email.trim(), id]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ erro: 'Este email já está a ser utilizado por outro utilizador.' });
    }

    // Se o gestor atualizou a senha do utilizador
    if (password && password.trim().length >= 6) {
      const passwordHash = await bcrypt.hash(password.trim(), 12);
      const query = `
        UPDATE utilizador
        SET nome = $1, email = $2, id_perfil = $3, password_hash = $4, id_etar = $5, ativo = $6
        WHERE id_utilizador = $7
        RETURNING id_utilizador, nome, email, id_perfil, id_etar, ativo
      `;
      const result = await pool.query(query, [
        nome.trim(),
        email.trim().toLowerCase(),
        parseInt(id_perfil, 10),
        passwordHash,
        id_etar ? parseInt(id_etar, 10) : null,
        ativo !== undefined ? !!ativo : true,
        id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ erro: 'Utilizador não encontrado.' });
      }

      return res.json({
        mensagem: 'Utilizador atualizado com sucesso (palavra-passe alterada).',
        utilizador: result.rows[0]
      });
    } else {
      const query = `
        UPDATE utilizador
        SET nome = $1, email = $2, id_perfil = $3, id_etar = $4, ativo = $5
        WHERE id_utilizador = $6
        RETURNING id_utilizador, nome, email, id_perfil, id_etar, ativo
      `;
      const result = await pool.query(query, [
        nome.trim(),
        email.trim().toLowerCase(),
        parseInt(id_perfil, 10),
        id_etar ? parseInt(id_etar, 10) : null,
        ativo !== undefined ? !!ativo : true,
        id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ erro: 'Utilizador não encontrado.' });
      }

      return res.json({
        mensagem: 'Utilizador atualizado com sucesso.',
        utilizador: result.rows[0]
      });
    }
  } catch (err) {
    console.error('Erro ao atualizar utilizador:', err);
    return res.status(500).json({ erro: 'Erro interno ao atualizar utilizador.' });
  }
};
