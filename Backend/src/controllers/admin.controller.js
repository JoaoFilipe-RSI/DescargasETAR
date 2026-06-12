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

    await client.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
      ['CLIENTE', clientRes.rows[0].id_cliente, 'CRIACAO', `Cliente contratado ${nome} registado no sistema.`, req.user.id_utilizador]
    );

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

    await client.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
      ['CLIENTE', id, 'EDICAO', `Dados do cliente ${nome} atualizados no sistema.`, req.user.id_utilizador]
    );

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

    await pool.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
      ['CLIENTE', id, 'ALTERACAO_STATUS', `Estado da conta do cliente id #${id} atualizado para ${!!ativo ? 'ativo' : 'inativo'}.`, req.user.id_utilizador]
    );

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

exports.criarEtar = async (req, res) => {
  const { nome, localizacao, disponivel } = req.body;

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Por favor, indique o nome da ETAR.' });
  }

  try {
    const query = `
      INSERT INTO etar (nome, localizacao, disponivel)
      VALUES ($1, $2, $3)
      RETURNING id_etar, nome, localizacao, disponivel
    `;
    const result = await pool.query(query, [
      nome.trim(),
      localizacao ? localizacao.trim() : null,
      disponivel !== undefined ? !!disponivel : true
    ]);

    const newEtar = result.rows[0];
    await pool.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
      ['ETAR', newEtar.id_etar, 'CRIACAO', `ETAR ${newEtar.nome} criada no sistema com localização ${newEtar.localizacao || 'N/A'}.`, req.user.id_utilizador]
    );

    return res.status(201).json({
      mensagem: 'ETAR criada com sucesso.',
      etar: newEtar
    });
  } catch (err) {
    console.error('Erro ao criar ETAR:', err);
    return res.status(500).json({ erro: 'Erro interno ao criar ETAR.' });
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

    const newAut = result.rows[0];
    await pool.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
      ['AUTORIZACAO', newAut.id_autorizacao, 'CRIACAO', `Regra de whitelist criada para cliente #${id_cliente} na ETAR #${id_etar} com quota de ${quotaVal !== null ? `${quotaVal} descargas/dia` : 'Sem limite'}.`, req.user.id_utilizador]
    );

    return res.status(201).json({
      mensagem: 'Regra de whitelist criada com sucesso.',
      autorizacao: newAut
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

    const updatedAut = result.rows[0];
    await pool.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
      ['AUTORIZACAO', id, 'EDICAO', `Regra de whitelist id #${id} atualizada. Quota: ${quotaVal !== null ? `${quotaVal} descargas/dia` : 'Sem limite'}, Auto-Aprovação: ${!!auto_aprovacao ? 'Sim' : 'Não'}, Ativa: ${!!ativo ? 'Sim' : 'Não'}.`, req.user.id_utilizador]
    );

    return res.json({
      mensagem: 'Regra de whitelist atualizada com sucesso.',
      autorizacao: updatedAut
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
  const { id_cliente, id_etar, mes, ano, estado, data_inicio, data_fim } = req.query;

  let query = `
    SELECT d.id_descarga, d.data_pedido, d.data_rececao, d.tipo_efluente, d.quantidade, d.quantidade_real, d.estado_descarga, d.observacoes,
           d.data_decisao,
           c.nome AS cliente_nome, c.id_cliente,
           e.nome AS etar_nome, e.id_etar,
           ud.nome AS decisao_por_nome,
           ur.nome AS rececao_por_nome,
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
    LEFT JOIN utilizador ud ON d.id_utilizador_decisao = ud.id_utilizador
    LEFT JOIN utilizador ur ON d.id_utilizador_rececao = ur.id_utilizador
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
    query += ` AND EXTRACT(MONTH FROM COALESCE(d.data_rececao, d.data_pedido)) = $${paramIndex++}`;
    values.push(parseInt(mes, 10));
  }

  if (ano && ano !== 'all') {
    query += ` AND EXTRACT(YEAR FROM COALESCE(d.data_rececao, d.data_pedido)) = $${paramIndex++}`;
    values.push(parseInt(ano, 10));
  }

  if (estado && estado !== 'all') {
    query += ` AND d.estado_descarga = $${paramIndex++}`;
    values.push(estado.toUpperCase());
  }

  if (data_inicio) {
    query += ` AND COALESCE(d.data_rececao, d.data_pedido)::date >= $${paramIndex++}::date`;
    values.push(data_inicio);
  }

  if (data_fim) {
    query += ` AND COALESCE(d.data_rececao, d.data_pedido)::date <= $${paramIndex++}::date`;
    values.push(data_fim);
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

    const newUtilizador = result.rows[0];
    await pool.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
      ['UTILIZADOR', newUtilizador.id_utilizador, 'CRIACAO', `Utilizador interno ${newUtilizador.nome} (${newUtilizador.email}) criado com perfil id #${id_perfil}.`, req.user.id_utilizador]
    );

    return res.status(201).json({
      mensagem: 'Utilizador criado com sucesso.',
      utilizador: newUtilizador
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

      const updatedUser = result.rows[0];
      await pool.query(
        "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
        ['UTILIZADOR', id, 'EDICAO', `Utilizador interno ${updatedUser.nome} atualizado (palavra-passe alterada). Ativo: ${updatedUser.ativo ? 'Sim' : 'Não'}.`, req.user.id_utilizador]
      );

      return res.json({
        mensagem: 'Utilizador atualizado com sucesso (palavra-passe alterada).',
        utilizador: updatedUser
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

      const updatedUser = result.rows[0];
      await pool.query(
        "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
        ['UTILIZADOR', id, 'EDICAO', `Utilizador interno ${updatedUser.nome} atualizado. Ativo: ${updatedUser.ativo ? 'Sim' : 'Não'}.`, req.user.id_utilizador]
      );

      return res.json({
        mensagem: 'Utilizador atualizado com sucesso.',
        utilizador: updatedUser
      });
    }
  } catch (err) {
    console.error('Erro ao atualizar utilizador:', err);
    return res.status(500).json({ erro: 'Erro interno ao atualizar utilizador.' });
  }
};

exports.obterLogsAuditoria = async (req, res) => {
  try {
    const { entidade, acao, pesquisa } = req.query;
    let query = `
      SELECT h.id_historico, h.entidade, h.id_entidade, h.acao, h.descricao, h.data,
             u.nome AS utilizador_nome, u.email AS utilizador_email, p.nome AS utilizador_perfil
      FROM historico h
      JOIN utilizador u ON h.id_utilizador = u.id_utilizador
      JOIN perfil p ON u.id_perfil = p.id_perfil
    `;
    const whereConditions = [];
    const values = [];

    if (entidade && entidade !== 'all') {
      values.push(entidade.trim());
      whereConditions.push(`h.entidade = $${values.length}`);
    }

    if (acao && acao !== 'all') {
      values.push(acao.trim());
      whereConditions.push(`h.acao = $${values.length}`);
    }

    if (pesquisa && pesquisa.trim() !== '') {
      values.push(`%${pesquisa.trim()}%`);
      whereConditions.push(`(h.descricao ILIKE $${values.length} OR u.nome ILIKE $${values.length} OR u.email ILIKE $${values.length})`);
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ` + whereConditions.join(' AND ');
    }

    query += ` ORDER BY h.data DESC, h.id_historico DESC`;

    const result = await pool.query(query, values);
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao obter logs de auditoria:', err);
    return res.status(500).json({ erro: 'Erro interno ao obter logs de auditoria.' });
  }
};

exports.criarParametro = async (req, res) => {
  const { nome, tipo_parametro, unidade_default, obrigatorio } = req.body;

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Por favor, indique o nome do parâmetro.' });
  }

  try {
    // Obter tipos válidos dinamicamente do ENUM do PostgreSQL
    const enumQuery = `
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'tipo_parametro_enum'
    `;
    const enumRes = await pool.query(enumQuery);
    const tiposValidos = enumRes.rows.map(r => r.enumlabel);

    if (!tiposValidos.includes(tipo_parametro)) {
      return res.status(400).json({ erro: 'Tipo de parâmetro inválido.' });
    }
    // Verificar duplicado
    const nameCheck = await pool.query('SELECT id_parametro FROM parametro WHERE LOWER(nome) = LOWER($1)', [nome.trim()]);
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({ erro: 'Já existe um parâmetro registado com este nome.' });
    }

    const query = `
      INSERT INTO parametro (nome, tipo_parametro, unidade_default, obrigatorio)
      VALUES ($1, $2, $3, $4)
      RETURNING id_parametro, nome, tipo_parametro, unidade_default, obrigatorio
    `;
    const result = await pool.query(query, [
      nome.trim(),
      tipo_parametro,
      unidade_default ? unidade_default.trim() : 'mg/L',
      obrigatorio !== undefined ? !!obrigatorio : false
    ]);

    const newParam = result.rows[0];

    // Logar no histórico
    await pool.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
      ['PARAMETRO', newParam.id_parametro, 'CRIACAO', `Parâmetro analítico global ${newParam.nome} (${newParam.tipo_parametro}) criado no catálogo do sistema.`, req.user.id_utilizador]
    );

    // Notificar Responsáveis de Laboratório (id_perfil = 5)
    try {
      const respLabUsers = await pool.query("SELECT id_utilizador FROM utilizador WHERE id_perfil = 5 AND ativo = true");
      if (respLabUsers.rows.length > 0) {
        const notifMsg = `Novo parâmetro adicionado ao catálogo: "${newParam.nome}". Configure a metodologia e incerteza padrão.`;
        
        // Inserir na tabela de notificações persistentes
        const insertNotifQuery = `
          INSERT INTO notificacao (id_utilizador, mensagem, tipo, enviada)
          VALUES ($1, $2, 'LABORATORIO', true)
        `;
        for (const u of respLabUsers.rows) {
          await pool.query(insertNotifQuery, [u.id_utilizador, notifMsg]);
        }

        // Enviar via WebSocket em tempo real
        const { enviarNotificacao } = require('../config/socket');
        enviarNotificacao('laboratorio-responsaveis', 'novo-parametro', {
          mensagem: notifMsg,
          parametro: newParam
        });
      }
    } catch (notifErr) {
      console.error('Erro ao notificar responsáveis do laboratório sobre novo parâmetro:', notifErr);
    }

    return res.status(201).json({
      mensagem: 'Parâmetro analítico criado com sucesso no catálogo global.',
      parametro: newParam
    });
  } catch (err) {
    console.error('Erro ao criar parâmetro global:', err);
    return res.status(500).json({ erro: 'Erro interno ao criar parâmetro.' });
  }
};

exports.atualizarParametro = async (req, res) => {
  const { id } = req.params;
  const { 
    metodo_default_cod, 
    metodo_default_nome, 
    incerteza_default,
    nome,
    tipo_parametro,
    unidade_default,
    obrigatorio
  } = req.body;

  if (incerteza_default !== undefined && incerteza_default !== null && incerteza_default !== '') {
    const incertezaVal = parseFloat(incerteza_default);
    if (isNaN(incertezaVal) || incertezaVal < 0) {
      return res.status(400).json({ erro: 'A incerteza padrão deve ser um número não negativo.' });
    }
  }

  try {
    // Obter dados atuais do parâmetro
    const checkExist = await pool.query('SELECT * FROM parametro WHERE id_parametro = $1', [id]);
    if (checkExist.rows.length === 0) {
      return res.status(404).json({ erro: 'Parâmetro não encontrado.' });
    }
    const paramAtual = checkExist.rows[0];

    // Se mudou o nome, verificar duplicados
    if (nome && nome.trim().toLowerCase() !== paramAtual.nome.toLowerCase()) {
      const nameCheck = await pool.query(
        'SELECT id_parametro FROM parametro WHERE LOWER(nome) = LOWER($1) AND id_parametro <> $2',
        [nome.trim(), id]
      );
      if (nameCheck.rows.length > 0) {
        return res.status(400).json({ erro: 'Já existe um parâmetro registado com este nome.' });
      }
    }

    // Validar tipo de parâmetro se fornecido
    if (tipo_parametro) {
      const enumQuery = `
        SELECT enumlabel 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = 'tipo_parametro_enum'
      `;
      const enumRes = await pool.query(enumQuery);
      const tiposValidos = enumRes.rows.map(r => r.enumlabel);
      if (!tiposValidos.includes(tipo_parametro)) {
        return res.status(400).json({ erro: 'Tipo de parâmetro inválido.' });
      }
    }

    const finalNome = nome !== undefined ? nome.trim() : paramAtual.nome;
    const finalTipo = tipo_parametro !== undefined ? tipo_parametro : paramAtual.tipo_parametro;
    const finalUnidade = unidade_default !== undefined ? unidade_default.trim() : paramAtual.unidade_default;
    const finalObrigatorio = obrigatorio !== undefined ? !!obrigatorio : paramAtual.obrigatorio;

    const finalMetodoCod = metodo_default_cod !== undefined 
      ? (metodo_default_cod ? metodo_default_cod.trim() : null) 
      : paramAtual.metodo_default_cod;
    const finalMetodoNome = metodo_default_nome !== undefined 
      ? (metodo_default_nome ? metodo_default_nome.trim() : null) 
      : paramAtual.metodo_default_nome;
    
    let finalIncerteza = paramAtual.incerteza_default;
    if (incerteza_default !== undefined) {
      finalIncerteza = (incerteza_default === null || incerteza_default === '') ? null : parseFloat(incerteza_default);
    }

    const query = `
      UPDATE parametro
      SET nome = $1,
          tipo_parametro = $2,
          unidade_default = $3,
          obrigatorio = $4,
          metodo_default_cod = $5,
          metodo_default_nome = $6,
          incerteza_default = $7
      WHERE id_parametro = $8
      RETURNING *
    `;
    const result = await pool.query(query, [
      finalNome,
      finalTipo,
      finalUnidade,
      finalObrigatorio,
      finalMetodoCod,
      finalMetodoNome,
      finalIncerteza,
      id
    ]);

    const updatedParam = result.rows[0];

    // Logar no histórico (auditoria)
    await pool.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
      [
        'PARAMETRO',
        id,
        'EDICAO',
        `Parâmetro ${paramAtual.nome} atualizado no catálogo. Nome: ${updatedParam.nome}, Tipo: ${updatedParam.tipo_parametro}, Obrigatório: ${updatedParam.obrigatorio ? 'Sim' : 'Não'}.`,
        req.user.id_utilizador
      ]
    );

    return res.json({
      mensagem: 'Parâmetro analítico atualizado com sucesso.',
      parametro: updatedParam
    });
  } catch (err) {
    console.error('Erro ao atualizar parâmetro global:', err);
    return res.status(500).json({ erro: 'Erro interno ao atualizar parâmetro.' });
  }
};

exports.enviarMensagemGeral = async (req, res) => {
  const { mensagem } = req.body;

  if (!mensagem || !mensagem.trim()) {
    return res.status(400).json({ erro: 'Por favor, indique a mensagem geral a enviar.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obter todos os utilizadores ativos
    const usersRes = await client.query('SELECT id_utilizador FROM utilizador WHERE ativo = true');

    // 2. Registar no histórico (auditoria)
    const logDescricao = `Aviso Geral enviado a todos os utilizadores: "${mensagem.trim().substring(0, 80)}${mensagem.trim().length > 80 ? '...' : ''}"`;
    const histRes = await client.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5) RETURNING id_historico",
      ['SISTEMA', 0, 'ENVIO_AVISO_GERAL', logDescricao, req.user.id_utilizador]
    );

    // 3. Inserir notificações individuais para persistência (na tabela notificacao)
    const insertQuery = `
      INSERT INTO notificacao (id_utilizador, mensagem, tipo, enviada)
      VALUES ($1, $2, 'SISTEMA', true)
    `;
    for (const row of usersRes.rows) {
      await client.query(insertQuery, [row.id_utilizador, mensagem.trim()]);
    }

    await client.query('COMMIT');

    // 4. Emitir via WebSocket para todos
    const { enviarNotificacaoGeral } = require('../config/socket');
    enviarNotificacaoGeral('mensagem-geral', {
      mensagem: mensagem.trim(),
      autor: req.user.nome
    });

    return res.status(201).json({
      mensagem: 'Aviso geral enviado e registado com sucesso para todos os utilizadores.',
      id_historico: histRes.rows[0].id_historico
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao enviar mensagem geral:', err);
    return res.status(500).json({ erro: 'Erro interno ao enviar aviso geral.' });
  } finally {
    client.release();
  }
};

/**
 * 9. Perfis de Utilizador
 */
exports.obterPerfis = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM perfil ORDER BY id_perfil');
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao obter perfis:', err);
    return res.status(500).json({ erro: 'Erro interno ao obter perfis de utilizador.' });
  }
};

exports.criarPerfil = async (req, res) => {
  const { nome } = req.body;

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Por favor, indique o nome do perfil.' });
  }

  const nomeNormalizado = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');

  if (!nomeNormalizado) {
    return res.status(400).json({ erro: 'Nome do perfil inválido.' });
  }

  try {
    const checkQuery = 'SELECT id_perfil FROM perfil WHERE UPPER(nome) = $1';
    const checkRes = await pool.query(checkQuery, [nomeNormalizado]);
    if (checkRes.rows.length > 0) {
      return res.status(400).json({ erro: 'Já existe um perfil com este nome.' });
    }

    const insertQuery = 'INSERT INTO perfil (nome) VALUES ($1) RETURNING *';
    const insertRes = await pool.query(insertQuery, [nomeNormalizado]);
    const newPerfil = insertRes.rows[0];

    await pool.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
      ['PERFIL', newPerfil.id_perfil, 'CRIACAO', `Perfil de utilizador ${newPerfil.nome} criado com sucesso.`, req.user.id_utilizador]
    );

    return res.status(201).json({
      mensagem: 'Perfil criado com sucesso.',
      perfil: newPerfil
    });
  } catch (err) {
    console.error('Erro ao criar perfil:', err);
    return res.status(500).json({ erro: 'Erro interno ao criar perfil.' });
  }
};

exports.atualizarPerfil = async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Por favor, indique o nome do perfil.' });
  }

  const nomeNormalizado = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');

  if (!nomeNormalizado) {
    return res.status(400).json({ erro: 'Nome do perfil inválido.' });
  }

  try {
    const checkExist = await pool.query('SELECT nome FROM perfil WHERE id_perfil = $1', [id]);
    if (checkExist.rows.length === 0) {
      return res.status(404).json({ erro: 'Perfil não encontrado.' });
    }
    const nomeAntigo = checkExist.rows[0].nome;

    const checkDuplicate = await pool.query('SELECT id_perfil FROM perfil WHERE UPPER(nome) = $1 AND id_perfil <> $2', [nomeNormalizado, id]);
    if (checkDuplicate.rows.length > 0) {
      return res.status(400).json({ erro: 'Já existe outro perfil registado com este nome.' });
    }

    const updateQuery = 'UPDATE perfil SET nome = $1 WHERE id_perfil = $2 RETURNING *';
    const updateRes = await pool.query(updateQuery, [nomeNormalizado, id]);
    const updatedPerfil = updateRes.rows[0];

    await pool.query(
      "INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador) VALUES ($1, $2, $3, $4, $5)",
      ['PERFIL', updatedPerfil.id_perfil, 'EDICAO', `Perfil ${nomeAntigo} atualizado para ${updatedPerfil.nome}.`, req.user.id_utilizador]
    );

    return res.json({
      mensagem: 'Perfil atualizado com sucesso.',
      perfil: updatedPerfil
    });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    return res.status(500).json({ erro: 'Erro interno ao atualizar perfil.' });
  }
};

exports.obterTiposParametro = async (req, res) => {
  try {
    const enumQuery = `
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'tipo_parametro_enum'
      ORDER BY enumlabel ASC
    `;
    const enumRes = await pool.query(enumQuery);
    const types = enumRes.rows.map(r => r.enumlabel);
    return res.json(types);
  } catch (err) {
    console.error('Erro ao obter tipos de parâmetros:', err);
    return res.status(500).json({ erro: 'Erro interno ao obter tipos de parâmetros.' });
  }
};

exports.criarTipoParametro = async (req, res) => {
  const { nome } = req.body;
  if (!nome || !nome.trim()) {
    return res.status(400).json({ erro: 'Por favor, indique o nome do novo tipo.' });
  }

  const nomeNormalizado = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');

  if (!nomeNormalizado || !/^[A-Z0-9_]+$/.test(nomeNormalizado)) {
    return res.status(400).json({ erro: 'Nome do tipo inválido. Apenas são permitidas letras, números e underscores.' });
  }

  try {
    const enumQuery = `
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'tipo_parametro_enum'
    `;
    const enumRes = await pool.query(enumQuery);
    const types = enumRes.rows.map(r => r.enumlabel);

    if (types.includes(nomeNormalizado)) {
      return res.status(400).json({ erro: 'Este tipo de parâmetro já existe.' });
    }

    // ALTER TYPE ADD VALUE não pode correr em transações nem aceita placeholders $1 no PostgreSQL.
    // Como nomeNormalizado é estritamente validado por regex, a interpolação é segura contra SQL injection.
    await pool.query(`ALTER TYPE tipo_parametro_enum ADD VALUE '${nomeNormalizado}'`);

    return res.status(201).json({
      mensagem: 'Novo tipo de parâmetro criado com sucesso.',
      tipo: nomeNormalizado
    });
  } catch (err) {
    console.error('Erro ao criar tipo de parâmetro:', err);
    return res.status(500).json({ erro: 'Erro interno ao criar tipo de parâmetro.' });
  }
};
