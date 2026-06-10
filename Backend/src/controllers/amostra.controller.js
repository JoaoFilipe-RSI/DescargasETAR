const pool = require('../config/db');
const PDFDocument = require('pdfkit');

/**
 * Função utilitária para verificar se duas datas se encontram na mesma semana civil (segunda a domingo).
 */
function isSameWeek(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  const day1 = d1.getDay() || 7; 
  const day2 = d2.getDay() || 7;
  
  const mon1 = new Date(d1);
  mon1.setDate(d1.getDate() - day1 + 1);
  mon1.setHours(0,0,0,0);
  
  const mon2 = new Date(d2);
  mon2.setDate(d2.getDate() - day2 + 1);
  mon2.setHours(0,0,0,0);
  
  return mon1.getTime() === mon2.getTime();
}

/**
 * 1. Check-in & Motor de Decisão (PUT /api/amostras/receber/:token)
 */
exports.receberAmostra = async (req, res) => {
  const { token } = req.params;
  const id_tecnico = req.user.id_utilizador;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Procurar amostra vinculada, dados da descarga e periodicidade do cliente
    const selectQuery = `
      SELECT a.*, d.id_cliente, c.nome AS cliente_nome, c.periodicidade_analise, c.data_ultima_analise
      FROM amostra a
      JOIN descarga d ON a.id_descarga = d.id_descarga
      JOIN cliente c ON d.id_cliente = c.id_cliente
      WHERE a.qr_code_token = $1
      FOR UPDATE
    `;
    const checkRes = await client.query(selectQuery, [token.trim()]);

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Amostra não encontrada.' });
    }

    const amostra = checkRes.rows[0];

    // Verificar se já foi recebida/processada
    if (amostra.estado_amostra !== 'RECOLHIDA') {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        erro: `Erro: Esta amostra já se encontra no estado ${amostra.estado_amostra}.` 
      });
    }

    const { periodicidade_analise, data_ultima_analise } = amostra;
    const now = new Date();
    let deveAnalisar = true;

    // Motor de Decisão baseada em periodicidade
    if (data_ultima_analise) {
      const lastDate = new Date(data_ultima_analise);
      
      switch (periodicidade_analise.toUpperCase()) {
        case 'POR_DESCARGA':
          deveAnalisar = true;
          break;
        case 'SEMANAL':
          deveAnalisar = !isSameWeek(lastDate, now);
          break;
        case 'QUINZENAL':
          const diffMsQuinzenal = now.getTime() - lastDate.getTime();
          deveAnalisar = diffMsQuinzenal >= 15 * 24 * 3600 * 1000;
          break;
        case 'MENSAL':
          deveAnalisar = !(lastDate.getMonth() === now.getMonth() && lastDate.getFullYear() === now.getFullYear());
          break;
        case 'TRIMESTRAL':
          const q1 = Math.floor(lastDate.getMonth() / 3);
          const q2 = Math.floor(now.getMonth() / 3);
          deveAnalisar = !(q1 === q2 && lastDate.getFullYear() === now.getFullYear());
          break;
        case 'SEMESTRAL':
          const diffMsSemestral = now.getTime() - lastDate.getTime();
          deveAnalisar = diffMsSemestral >= 180 * 24 * 3600 * 1000;
          break;
        case 'ANUAL':
          deveAnalisar = lastDate.getFullYear() !== now.getFullYear();
          break;
        default:
          deveAnalisar = true; // Por segurança, se desconhecido, analisa
      }
    }

    let estadoFinal = '';
    let updateQuery = '';
    let values = [];
    let descricaoHist = '';

    if (deveAnalisar) {
      estadoFinal = 'EM_ANALISE';
      updateQuery = `
        UPDATE amostra
        SET estado_amostra = 'EM_ANALISE', data_rececao_lab = NOW(), data_inicio_analise = NOW(), id_tecnico = $1
        WHERE id_amostra = $2
        RETURNING *
      `;
      values = [id_tecnico, amostra.id_amostra];
      descricaoHist = 'Amostra recebida no laboratório. Triagem: ANALISAR (periodicidade contratada fora de prazo ou primeira análise).';
    } else {
      estadoFinal = 'DESCARTADA';
      updateQuery = `
        UPDATE amostra
        SET estado_amostra = 'DESCARTADA', data_rececao_lab = NOW(), data_descarte = NOW(), id_tecnico = $1
        WHERE id_amostra = $2
        RETURNING *
      `;
      values = [id_tecnico, amostra.id_amostra];
      descricaoHist = `Amostra recebida no laboratório. Triagem: DESCARTADA (análise concluída recentemente em ${new Date(data_ultima_analise).toLocaleDateString()}).`;
      
      // Se for descartada, a descarga também deve avançar para concluída? O fluxo prevê que sem análise adicional a descarga fica concluída.
      await client.query("UPDATE descarga SET estado_descarga = 'CONCLUIDA' WHERE id_descarga = $1", [amostra.id_descarga]);
    }

    const updateRes = await client.query(updateQuery, values);
    const amostraAtualizada = updateRes.rows[0];

    // Registar no histórico da amostra
    const histQuery = `
      INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador)
      VALUES ('AMOSTRA', $1, 'RECEPCAO', $2, $3)
    `;
    await client.query(histQuery, [amostra.id_amostra, descricaoHist, id_tecnico]);

    // Obter parâmetros obrigatórios + parâmetros específicos ativos do cliente para mostrar na triagem
    const paramsQuery = `
      SELECT p.id_parametro, p.nome, p.tipo_parametro, p.unidade_default, p.obrigatorio
      FROM parametro p
      LEFT JOIN cliente_parametro cp ON p.id_parametro = cp.id_parametro AND cp.id_cliente = $1 AND cp.ativo = TRUE
      WHERE p.obrigatorio = TRUE OR (cp.id_parametro IS NOT NULL)
      ORDER BY p.obrigatorio DESC, p.id_parametro ASC
    `;
    const paramsRes = await client.query(paramsQuery, [amostra.id_cliente]);
    const parametrosCliente = paramsRes.rows;

    await client.query('COMMIT');

    return res.json({
      mensagem: deveAnalisar 
        ? 'Amostra recebida e triada para ANÁLISE.' 
        : 'Amostra recebida e DESCARTADA automaticamente (periodicidade cumprida).',
      triagem: deveAnalisar ? 'ANALISAR' : 'DESCARTAR',
      amostra: {
        ...amostraAtualizada,
        cliente_nome: amostra.cliente_nome
      },
      parametros: parametrosCliente
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na receção de amostra:', err);
    return res.status(500).json({ erro: 'Erro interno ao efetuar check-in da amostra.' });
  } finally {
    client.release();
  }
};

/**
 * 2. Listar Amostras (GET /api/amostras)
 */
exports.obterAmostras = async (req, res) => {
  const { estado, id_cliente } = req.query;
  const { perfil, id_cliente: userClienteId } = req.user;

  let query = `
    SELECT a.*, d.id_cliente, c.nome AS cliente_nome, d.tipo_efluente, e.nome AS etar_nome,
           COALESCE(
             (SELECT json_agg(cp.id_parametro) 
              FROM cliente_parametro cp 
              WHERE cp.id_cliente = d.id_cliente AND cp.ativo = TRUE),
             '[]'::json
           ) AS parametros_contratuais
    FROM amostra a
    JOIN descarga d ON a.id_descarga = d.id_descarga
    JOIN cliente c ON d.id_cliente = c.id_cliente
    LEFT JOIN etar e ON d.id_etar = e.id_etar
    WHERE 1=1
  `;
  const values = [];
  let paramIndex = 1;

  if (perfil === 'CLIENTE') {
    query += ` AND d.id_cliente = $${paramIndex++}`;
    values.push(userClienteId);
  } else if (id_cliente) {
    query += ` AND d.id_cliente = $${paramIndex++}`;
    values.push(id_cliente);
  }

  if (estado) {
    query += ` AND a.estado_amostra = $${paramIndex++}`;
    values.push(estado.toUpperCase());
  }

  query += ' ORDER BY a.data_recolha DESC';

  try {
    const result = await pool.query(query, values);
    return res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar amostras:', err);
    return res.status(500).json({ erro: 'Erro interno ao listar amostras.' });
  }
};

/**
 * 3. Obter Detalhes da Amostra (GET /api/amostras/:id)
 */
exports.obterDetalhesAmostra = async (req, res) => {
  const { id } = req.params;
  const { perfil, id_cliente: userClienteId } = req.user;

  try {
    const query = `
      SELECT a.*, d.id_cliente, d.tipo_efluente, d.quantidade_real, c.nome AS cliente_nome, e.nome AS etar_nome
      FROM amostra a
      JOIN descarga d ON a.id_descarga = d.id_descarga
      JOIN cliente c ON d.id_cliente = c.id_cliente
      LEFT JOIN etar e ON d.id_etar = e.id_etar
      WHERE a.id_amostra = $1
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'Amostra não encontrada.' });
    }

    const amostra = result.rows[0];

    // Verificar se o cliente tem acesso a esta amostra e se foi disponibilizada
    if (perfil === 'CLIENTE') {
      if (amostra.id_cliente !== userClienteId) {
        return res.status(403).json({ erro: 'Não tem permissão para aceder aos dados desta amostra.' });
      }
      if (!amostra.boletim_publico) {
        return res.status(403).json({ erro: 'Este boletim ainda não foi disponibilizado para consulta.' });
      }
    }

    // Obter resultados analíticos
    const resQuery = `
      SELECT r.*, p.nome AS parametro_nome, p.tipo_parametro
      FROM resultado_analitico r
      JOIN parametro p ON r.id_parametro = p.id_parametro
      WHERE r.id_amostra = $1
    `;
    const resResult = await pool.query(resQuery, [id]);

    return res.json({
      amostra,
      resultados: resResult.rows
    });

  } catch (err) {
    console.error('Erro ao obter detalhes da amostra:', err);
    return res.status(500).json({ erro: 'Erro interno ao obter detalhes da amostra.' });
  }
};

/**
 * 4. Introdução de Resultados (POST /api/amostras/:id/resultados)
 */
exports.registarResultados = async (req, res) => {
  const { id } = req.params;
  const { resultados } = req.body; // Array: [ { id_parametro: 1, valor: 7.2, unidade: 'pH', metodo: 'SMEWW 4500-H+', incerteza: 0.1 } ]
  const id_tecnico = req.user.id_utilizador;

  if (!resultados || !Array.isArray(resultados) || resultados.length === 0) {
    return res.status(400).json({ erro: 'Por favor, forneça uma lista de resultados.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar estado da amostra
    const checkRes = await client.query(`
      SELECT a.*, d.id_cliente 
      FROM amostra a 
      JOIN descarga d ON a.id_descarga = d.id_descarga
      WHERE a.id_amostra = $1 FOR UPDATE
    `, [id]);
    
    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Amostra não encontrada.' });
    }

    const amostra = checkRes.rows[0];

    if (amostra.estado_amostra !== 'EM_ANALISE' && amostra.estado_amostra !== 'ANALISADA') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Resultados só podem ser introduzidos em amostras em estado EM_ANALISE.' });
    }

    // Obter parâmetros obrigatórios do sistema
    const paramQuery = `
      SELECT id_parametro, nome, tipo_parametro 
      FROM parametro 
      WHERE obrigatorio = TRUE
    `;
    const systemParams = await client.query(paramQuery);

    // Obter parâmetros específicos do cliente que estejam ativos
    const clientParamQuery = `
      SELECT p.id_parametro, p.nome, p.tipo_parametro
      FROM parametro p
      JOIN cliente_parametro cp ON p.id_parametro = cp.id_parametro
      WHERE cp.id_cliente = $1 AND cp.ativo = TRUE
    `;
    const clientParams = await client.query(clientParamQuery, [amostra.id_cliente]);

    // Combinar todos os parâmetros obrigatórios para validação
    const requiredParamsMap = new Map();
    systemParams.rows.forEach(p => requiredParamsMap.set(p.id_parametro, p.nome));
    clientParams.rows.forEach(p => requiredParamsMap.set(p.id_parametro, p.nome));

    // Validar e estruturar resultados introduzidos
    const inputParamIds = new Set();
    for (const resItem of resultados) {
      const { id_parametro, valor } = resItem;
      if (!id_parametro || valor === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Cada resultado deve ter id_parametro e valor.' });
      }

      inputParamIds.add(Number(id_parametro));

      if (valor < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ erro: 'Os valores dos parâmetros analíticos não podem ser negativos.' });
      }

      // Validação específica para pH (pH tem de estar entre 0 e 14)
      const paramDetails = await client.query('SELECT nome FROM parametro WHERE id_parametro = $1', [id_parametro]);
      if (paramDetails.rows.length > 0 && paramDetails.rows[0].nome.toUpperCase() === 'PH') {
        if (valor < 0 || valor > 14) {
          await client.query('ROLLBACK');
          return res.status(400).json({ erro: 'Validação de integridade física falhou: o valor de pH tem de estar entre 0 e 14.' });
        }
      }
    }

    // Validar se todos os parâmetros obrigatórios/ativos foram introduzidos
    const missingParams = [];
    requiredParamsMap.forEach((nome, id_parametro) => {
      if (!inputParamIds.has(id_parametro)) {
        missingParams.push(nome);
      }
    });

    if (missingParams.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        erro: `Falta de parâmetros obrigatórios para este cliente: ${missingParams.join(', ')}.` 
      });
    }

    // Inserir os resultados (com Upsert se já existirem)
    const upsertQuery = `
      INSERT INTO resultado_analitico (id_amostra, id_parametro, valor, unidade, metodo, incerteza)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id_amostra, id_parametro) DO UPDATE
      SET valor = EXCLUDED.valor, unidade = EXCLUDED.unidade, metodo = EXCLUDED.metodo, incerteza = EXCLUDED.incerteza
    `;
    
    // NOTA: Como a tabela não possui constraint UNIQUE (id_amostra, id_parametro) explicitamente no schema original,
    // vamos apagar as anteriores e inserir as novas para garantir integridade.
    await client.query('DELETE FROM resultado_analitico WHERE id_amostra = $1', [id]);

    const insertQuery = `
      INSERT INTO resultado_analitico (id_amostra, id_parametro, valor, unidade, metodo, incerteza)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    for (const resItem of resultados) {
      const { id_parametro, valor, unidade, metodo, incerteza } = resItem;
      await client.query(insertQuery, [
        id, 
        id_parametro, 
        valor, 
        unidade || null, 
        metodo || null, 
        incerteza || null
      ]);
    }

    // Atualizar estado da amostra para ANALISADA
    const updateSampleQuery = `
      UPDATE amostra
      SET estado_amostra = 'ANALISADA', data_fim_analise = NOW(), id_tecnico = $1
      WHERE id_amostra = $2
      RETURNING *
    `;
    const updateSampleRes = await client.query(updateSampleQuery, [id_tecnico, id]);
    const updatedAmostra = updateSampleRes.rows[0];

    // Registar histórico
    const histQuery = `
      INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador)
      VALUES ('AMOSTRA', $1, 'RESULTADOS', 'Resultados laboratoriais inseridos com sucesso na bancada.', $2)
    `;
    await client.query(histQuery, [id, id_tecnico]);

    await client.query('COMMIT');

    const { enviarNotificacao } = require('../config/socket');
    enviarNotificacao('laboratorio-responsaveis', 'amostra-analisada', {
      id_amostra: updatedAmostra.id_amostra,
      qr_code_token: updatedAmostra.qr_code_token,
      id_descarga: updatedAmostra.id_descarga
    });

    return res.json({ mensagem: 'Resultados registados com sucesso. Amostra analisada.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao registar resultados:', err);
    return res.status(500).json({ erro: 'Erro interno ao registar resultados analíticos.' });
  } finally {
    client.release();
  }
};

/**
 * 5. Validação Técnica e Conclusão (PUT /api/amostras/:id/validar)
 */
exports.validarAmostra = async (req, res) => {
  const { id } = req.params;
  const id_responsavel = req.user.id_utilizador;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar se existe e está no estado ANALISADA
    const checkRes = await client.query(`
      SELECT a.*, d.id_cliente, a.data_recolha
      FROM amostra a
      JOIN descarga d ON a.id_descarga = d.id_descarga
      WHERE a.id_amostra = $1 FOR UPDATE
    `, [id]);

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Amostra não encontrada.' });
    }

    const amostra = checkRes.rows[0];

    if (amostra.estado_amostra !== 'ANALISADA') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Apenas é possível validar amostras com estado ANALISADA.' });
    }

    // 1. Atualizar amostra para CONCLUIDA
    const updateSampleQuery = `
      UPDATE amostra
      SET estado_amostra = 'CONCLUIDA', data_validacao = NOW(), id_responsavel = $1
      WHERE id_amostra = $2
    `;
    await client.query(updateSampleQuery, [id_responsavel, id]);

    // 2. Atualizar ficha do cliente (data_ultima_analise) com a data_recolha da amostra concluída
    const updateClientQuery = `
      UPDATE cliente
      SET data_ultima_analise = $1
      WHERE id_cliente = $2
    `;
    await client.query(updateClientQuery, [amostra.data_recolha, amostra.id_cliente]);

    // 3. Atualizar estado da descarga vinculada para CONCLUIDA
    const updateDescargaQuery = `
      UPDATE descarga
      SET estado_descarga = 'CONCLUIDA'
      WHERE id_descarga = $1
    `;
    await client.query(updateDescargaQuery, [amostra.id_descarga]);

    // 4. Registar no histórico
    const histQuery = `
      INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador)
      VALUES ($1, $2, $3, $4, $5)
    `;
    // Histórico da Amostra
    await client.query(histQuery, ['AMOSTRA', id, 'VALIDACAO', 'Análise laboratorial validada e concluída pelo responsável.', id_responsavel]);
    // Histórico da Descarga
    await client.query(histQuery, ['DESCARGA', amostra.id_descarga, 'CONCLUSAO', 'Descarga finalizada e concluída após validação do Boletim Analítico.', id_responsavel]);

    await client.query('COMMIT');

    const { enviarNotificacao } = require('../config/socket');
    enviarNotificacao('gestores-clientes', 'amostra-concluida', {
      id_amostra: id,
      id_descarga: amostra.id_descarga,
      mensagem: `Resultados validados: amostra #${id} concluída (Descarga #${amostra.id_descarga}).`
    });

    return res.json({ mensagem: 'Amostra validada com sucesso. Ficha do cliente e descarga concluídas.' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro na validação da amostra:', err);
    return res.status(500).json({ erro: 'Erro interno ao validar amostra.' });
  } finally {
    client.release();
  }
};

/**
 * 6. Geração do Boletim Analítico em PDF (GET /api/amostras/:id/boletim)
 */
exports.gerarBoletimPDF = async (req, res) => {
  const { id } = req.params;
  const { perfil, id_cliente: userClienteId } = req.user;

  try {
    // Buscar todos os dados para o boletim
    const query = `
      SELECT a.id_amostra, a.estado_amostra, a.data_recolha, a.data_rececao_lab, a.data_inicio_analise, a.data_fim_analise, a.data_validacao, a.qr_code_token AS amostra_token,
             a.boletim_publico,
             d.id_descarga, d.id_cliente, d.data_rececao, d.tipo_efluente, d.quantidade_real, d.matricula_trator, d.empresa_transportadora, d.nome_produtor_externo,
             c.nome AS cliente_nome, c.morada AS cliente_morada, c.contacto AS cliente_contacto,
             e.nome AS etar_nome,
             u_tec.nome AS tecnico_nome, u_resp.nome AS responsavel_nome,
             u_rec.nome AS operador_nome
      FROM amostra a
      JOIN descarga d ON a.id_descarga = d.id_descarga
      JOIN cliente c ON d.id_cliente = c.id_cliente
      LEFT JOIN etar e ON d.id_etar = e.id_etar
      LEFT JOIN utilizador u_tec ON a.id_tecnico = u_tec.id_utilizador
      LEFT JOIN utilizador u_resp ON a.id_responsavel = u_resp.id_utilizador
      LEFT JOIN utilizador u_rec ON d.id_utilizador_rececao = u_rec.id_utilizador
      WHERE a.id_amostra = $1
    `;
    const sampleRes = await pool.query(query, [id]);

    if (sampleRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Amostra não encontrada.' });
    }

    const info = sampleRes.rows[0];

    // Verificar se o cliente tem acesso a esta amostra e se foi disponibilizada
    if (perfil === 'CLIENTE') {
      if (info.id_cliente !== userClienteId) {
        return res.status(403).json({ erro: 'Não tem permissão para aceder a este boletim.' });
      }
      if (!info.boletim_publico) {
        return res.status(403).json({ erro: 'Este boletim analítico ainda não foi disponibilizado pela gestão.' });
      }
    }

    if (info.estado_amostra !== 'CONCLUIDA') {
      return res.status(400).json({ erro: 'O boletim analítico só está disponível para amostras no estado CONCLUIDA.' });
    }

    // Buscar resultados
    const resQuery = `
      SELECT r.valor, r.unidade, r.metodo, r.incerteza, p.nome AS parametro_nome
      FROM resultado_analitico r
      JOIN parametro p ON r.id_parametro = p.id_parametro
      WHERE r.id_amostra = $1
    `;
    const resultsRes = await pool.query(resQuery, [id]);
    const resultados = resultsRes.rows;

    // Utilitários de formatação de valores PT-PT
    const formatarDataPT = (date) => {
      if (!date) return '-';
      const d = new Date(date);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      return `${dia}-${mes}-${ano}`;
    };

    const formatarNumeroPT = (val) => {
      if (val === undefined || val === null) return '-';
      const num = Number(val);
      if (isNaN(num)) return val;
      
      // Se for >= 100, formatar em notação científica: ex. 120 -> 1,2E+2
      if (num >= 100) {
        const exponent = Math.floor(Math.log10(num));
        const base = num / Math.pow(10, exponent);
        const baseStr = base.toFixed(1).replace('.', ',');
        return `${baseStr}E+${exponent}`;
      }
      
      return num.toFixed(1).replace('.', ',');
    };

    const formatarIncerteza = (val) => {
      if (val === undefined || val === null) return '-';
      const num = Number(val);
      if (isNaN(num) || num <= 0) return '-';
      if (num < 1) {
        return `±${Math.round(num * 100)}%`;
      }
      return `±${Math.round(num)}%`;
    };

    // Iniciar o documento PDF (A4 com margens de 40pt)
    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Boletim_Analitico_Amostra_${info.id_amostra}.pdf`);
    doc.pipe(res);

    // --- 1. CABEÇALHO (Y=40 a Y=95) ---
    // Logótipos SGS (Simulados à esquerda)
    doc.strokeColor('#CCCCCC').lineWidth(1);
    doc.circle(55, 60, 12).stroke();
    doc.circle(72, 60, 12).stroke();
    doc.fontSize(6).fillColor('#666666').text('SGS', 49, 58, { width: 12, align: 'center' });
    doc.fontSize(6).fillColor('#666666').text('SGS', 66, 58, { width: 12, align: 'center' });

    // Informação do Laboratório
    doc.fontSize(7.5).fillColor('#333333');
    doc.text('Laboratório de Ensaios Analíticos da Entidade Gestora', 100, 42, { bold: true });
    doc.text('Localização: Zona Industrial de Santo Tirso', 100, 52);
    doc.text('Morada completa: Rua dos Trigos, Pavilhão G', 100, 62);
    doc.text('4780 - 143 Santo Tirso', 100, 72);

    // Bloco de Acreditação IPAC/ilac-MRA (Simulados à direita)
    // Caixa IPAC
    doc.rect(415, 42, 60, 45).stroke();
    doc.fontSize(6.5).fillColor('#333333').text('IPAC', 415, 46, { width: 60, align: 'center', bold: true });
    doc.fontSize(5).text('acreditação', 415, 54, { width: 60, align: 'center' });
    doc.fontSize(5).text('L0336\nISO/IEC 17025\nEnsaios', 415, 62, { width: 60, align: 'center' });

    // Caixa ilac-MRA
    doc.rect(485, 42, 70, 45).stroke();
    doc.fontSize(7).fillColor('#111111').text('ilac-MRA', 485, 47, { width: 70, align: 'center', bold: true });
    doc.fontSize(4).text('-------------------------', 485, 56, { width: 70, align: 'center' });
    doc.fontSize(5.5).text('Accredited\nCalibration & Testing', 485, 62, { width: 70, align: 'center' });

    // --- 2. BANNER DE TÍTULO (Y=100 a Y=125) ---
    const anoVal = info.data_validacao ? new Date(info.data_validacao).getFullYear() : new Date().getFullYear();
    doc.rect(40, 100, 515, 22).fill('#0B5A96');
    doc.fillColor('#FFFFFF').fontSize(11).text(`BOLETIM DE ENSAIOS N.º ${info.id_amostra}/${anoVal}`, 40, 106, { align: 'center', bold: true });

    // --- 3. METADADOS E INFORMAÇÃO GERAL (Y=132 a Y=225) ---
    // Caixa da Esquerda (Origem e Colheita)
    doc.strokeColor('#DDDDDD').lineWidth(1).rect(40, 132, 250, 93).stroke();
    doc.fontSize(7.5).fillColor('#333333');
    doc.text(`Referência do cliente: ${info.nome_produtor_externo || '-'}`, 46, 138);
    doc.text(`Produto: Água residual (Efluente não tratado)`, 46, 150);
    doc.text(`Especificação a cumprir: Não aplicável`, 46, 162);
    doc.text(`Origem da amostra: Efluente ${info.tipo_efluente}`, 46, 174);
    doc.text(`Local de amostragem: Durante a descarga na ${info.etar_nome}`, 46, 186);
    doc.text(`Colheita de amostra: Amostragem não incluída na acreditação`, 46, 198, { width: 240 });
    doc.text(`Amostra pontual - Realizada pelo Operador (${info.operador_nome || 'N/A'})`, 46, 208, { width: 240 });

    // Caixa da Direita (Dados de Cliente e Datas)
    doc.strokeColor('#DDDDDD').rect(305, 132, 250, 93).stroke();
    doc.fontSize(8.5).text(info.cliente_nome, 312, 138, { bold: true });
    doc.fontSize(7.5).text(info.cliente_morada || 'Morada não registada', 312, 150, { width: 236 });
    
    // Divisória interna na caixa direita
    doc.strokeColor('#EEEEEE').moveTo(305, 170).lineTo(555, 170).stroke();

    doc.fontSize(7.5).fillColor('#333333');
    doc.text(`Amostragem: ${formatarDataPT(info.data_recolha)}`, 312, 175);
    doc.text(`Receção da amostra: ${formatarDataPT(info.data_rececao)}`, 312, 186);
    doc.text(`Início dos ensaios: ${formatarDataPT(info.data_rececao_lab || info.data_recolha)}`, 312, 197);
    doc.text(`Conclusão dos ensaios: ${formatarDataPT(info.data_validacao)}`, 312, 208);
    doc.fontSize(8).text(`N.º Amostra: ${info.id_amostra}/${anoVal}`, 440, 175, { bold: true });

    // --- 4. TABELA DE RESULTADOS (Y=235 em diante) ---
    // Cabeçalho da Tabela
    doc.rect(40, 235, 515, 18).fill('#5E5E5E');
    doc.fillColor('#FFFFFF').fontSize(7.5);
    doc.text('Parâmetro', 46, 240, { bold: true });
    doc.text('Método de ensaio / Técnica analítica', 46, 240, { bold: true, align: 'center', width: 260 });
    doc.text('Resultado', 310, 240, { bold: true, align: 'right', width: 60 });
    doc.text('Incerteza expandida', 380, 240, { bold: true, align: 'center', width: 75 });
    doc.text('Unidades', 465, 240, { bold: true, align: 'center', width: 55 });
    doc.text('VL', 525, 240, { bold: true, align: 'center', width: 25 });

    let rowY = 258;
    doc.fillColor('#333333');

    resultados.forEach((resItem) => {
      if (rowY > 600) {
        doc.addPage();
        rowY = 50;
      }

      // Parâmetro e Método
      doc.fontSize(7.5).text(resItem.parametro_nome || 'N/A', 46, rowY, { bold: true });
      doc.fontSize(6.5).fillColor('#666666').text(resItem.metodo || 'SMEWW / Interno', 46, rowY + 9, { italic: true });
      doc.fillColor('#333333');

      // Resultado
      doc.fontSize(7.5).text(formatarNumeroPT(resItem.valor), 310, rowY + 3, { align: 'right', width: 60 });
      // Incerteza
      doc.text(formatarIncerteza(resItem.incerteza), 380, rowY + 3, { align: 'center', width: 75 });
      // Unidades
      doc.text(resItem.unidade || 'mg/L', 465, rowY + 3, { align: 'center', width: 55 });
      // VL
      doc.text('-', 525, rowY + 3, { align: 'center', width: 25 });

      rowY += 23;
    });

    rowY += 10;
    
    // --- 5. OBSERVAÇÕES E FIM (Y dinâmico) ---
    if (rowY > 650) {
      doc.addPage();
      rowY = 50;
    }

    doc.fontSize(8).fillColor('#333333');
    doc.text(`Observações: ${info.observacoes || 'Sem observações adicionais a registar.'}`, 40, rowY, { width: 515 });
    
    rowY = doc.y + 15;
    doc.fontSize(8).fillColor('#999999').text('------- FIM DO DOCUMENTO -------', 40, rowY, { align: 'center', width: 515 });

    // --- 6. ASSINATURAS (Y dinâmico, garantindo espaço suficiente para evitar sobreposição) ---
    rowY = doc.y + 25;
    if (rowY > 650) {
      doc.addPage();
      rowY = 50;
    }

    doc.fontSize(7).fillColor('#666666');
    doc.text(`Emitido em: ${new Date().toLocaleString('pt-PT')}`, 40, rowY, { width: 160 });
    doc.text('Relatório de Ensaio emitido eletronicamente.', 40, rowY + 12, { italic: true, width: 160 });

    // Área do Técnico e Responsável com alinhamento perfeito de colunas sem sobreposição
    doc.fontSize(7.5).fillColor('#333333');
    doc.text('Técnico Executor:', 220, rowY, { width: 160 });
    doc.fontSize(8).text(info.tecnico_nome || 'N/A', 220, rowY + 12, { bold: true, width: 160 });
    
    doc.fontSize(7.5).text('A Responsável Técnica e Qualidade do Laboratório:', 400, rowY, { width: 155 });
    doc.fontSize(8).text(info.responsavel_nome || 'N/A', 400, rowY + 18, { bold: true, width: 155 });

    // --- 7. RODAPÉ FIXO (Notas legais e contactos no fundo da folha) ---
    // Usamos Y fixo no fundo da página (A4 tem 842 de altura)
    const renderFooters = (pDoc) => {
      const oldBottom = pDoc.page.margins.bottom;
      pDoc.page.margins.bottom = 0;

      pDoc.fontSize(6).fillColor('#777777');
      pDoc.text('Legenda: SMEWW - Standard Methods for Examination of Water and Wastewater; ISO - International Standard Organization; EN - Norma Europeia; PIQ - Método interno do Laboratório da Entidade Gestora; WHO - World Health Organization; NP - Norma Portuguesa; EAM - Espectrometria de Absorção Molecular; EAA - Espectrometria de Absorção Atómica; VL - Valor limite.', 40, 725, { width: 515 });
      pDoc.text('(1) O ensaio não está incluído no âmbito da acreditação; (2) Ensaio contratado a laboratório externo; (3) Os resultados aplicam-se exclusivamente à amostra ensaiada.', 40, 755, { width: 515 });
      
      pDoc.strokeColor('#DDDDDD').lineWidth(0.8).moveTo(40, 775).lineTo(555, 775).stroke();
      pDoc.fontSize(6.5).fillColor('#555555').text('ENTIDADE GESTORA - Tratamento de Águas Residuais - Rua dos Trigos, Santo Tirso | Tel: +351 252 000 000 | geral@entidadegestora.pt', 40, 782, { align: 'center', width: 515 });
      pDoc.fontSize(7).text('Lab 7.8A-08.20', 40, 798);
      pDoc.text('Pág. 1 de 1', 505, 798);

      pDoc.page.margins.bottom = oldBottom;
    };

    renderFooters(doc);

    doc.end();

  } catch (err) {
    console.error('Erro ao gerar PDF do boletim:', err);
    if (!res.headersSent) {
      return res.status(500).json({ erro: 'Erro interno ao gerar PDF do boletim.' });
    }
  }
};

/**
 * 7. Disponibilizar Boletim Analítico ao Cliente (PUT /api/amostras/:id/disponibilizar)
 */
exports.disponibilizarBoletim = async (req, res) => {
  const { id } = req.params;
  const id_gestor = req.user.id_utilizador;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar se existe a amostra e se está CONCLUIDA
    const checkQuery = `
      SELECT a.*, d.id_cliente, d.id_descarga
      FROM amostra a
      JOIN descarga d ON a.id_descarga = d.id_descarga
      WHERE a.id_amostra = $1
      FOR UPDATE
    `;
    const checkRes = await client.query(checkQuery, [id]);

    if (checkRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Amostra não encontrada.' });
    }

    const amostra = checkRes.rows[0];

    if (amostra.estado_amostra !== 'CONCLUIDA') {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Apenas boletins de amostras concluídas podem ser disponibilizados.' });
    }

    if (amostra.boletim_publico) {
      await client.query('ROLLBACK');
      return res.status(400).json({ erro: 'Este boletim já se encontra disponível para o cliente.' });
    }

    // 1. Atualizar boletim_publico para true
    await client.query('UPDATE amostra SET boletim_publico = TRUE WHERE id_amostra = $1', [id]);

    // 2. Registar no histórico
    const histQuery = `
      INSERT INTO historico (entidade, id_entidade, acao, descricao, id_utilizador)
      VALUES ('AMOSTRA', $1, 'DISPONIBILIZAR', 'Boletim analítico disponibilizado para o cliente pela gestão.', $2)
    `;
    await client.query(histQuery, [id, id_gestor]);

    await client.query('COMMIT');

    // 3. Enviar notificação em tempo real ao cliente
    const { enviarNotificacao } = require('../config/socket');
    enviarNotificacao(`cliente-${amostra.id_cliente}`, 'boletim-disponivel', {
      id_amostra: id,
      id_descarga: amostra.id_descarga,
      mensagem: 'O Boletim Analítico da sua descarga foi disponibilizado para download.'
    });

    return res.json({
      mensagem: 'Boletim analítico disponibilizado para o cliente com sucesso.',
      id_amostra: id
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erro ao disponibilizar boletim:', err);
    return res.status(500).json({ erro: 'Erro interno ao disponibilizar boletim.' });
  } finally {
    client.release();
  }
};
