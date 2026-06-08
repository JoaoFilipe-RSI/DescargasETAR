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

    await client.query('COMMIT');

    return res.json({
      mensagem: deveAnalisar 
        ? 'Amostra recebida e triada para ANÁLISE.' 
        : 'Amostra recebida e DESCARTADA automaticamente (periodicidade cumprida).',
      triagem: deveAnalisar ? 'ANALISAR' : 'DESCARTAR',
      amostra: amostraAtualizada
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
    SELECT a.*, d.id_cliente, c.nome AS cliente_nome, d.tipo_efluente, e.nome AS etar_nome
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

    // Verificar se o cliente tem acesso a esta amostra
    if (perfil === 'CLIENTE' && amostra.id_cliente !== userClienteId) {
      return res.status(403).json({ erro: 'Não tem permissão para aceder aos dados desta amostra.' });
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
    enviarNotificacao(`cliente-${amostra.id_cliente}`, 'boletim-disponivel', {
      id_amostra: id,
      id_descarga: amostra.id_descarga,
      mensagem: 'O Boletim Analítico da sua descarga foi validado e encontra-se disponível para download.'
    });

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
      SELECT a.id_amostra, a.estado_amostra, a.data_recolha, a.data_validacao, a.qr_code_token AS amostra_token,
             d.id_descarga, d.id_cliente, d.data_rececao, d.tipo_efluente, d.quantidade_real, d.matricula_trator, d.empresa_transportadora,
             c.nome AS cliente_nome, c.morada AS cliente_morada, c.contacto AS cliente_contacto,
             e.nome AS etar_nome,
             u_tec.nome AS tecnico_nome, u_resp.nome AS responsavel_nome
      FROM amostra a
      JOIN descarga d ON a.id_descarga = d.id_descarga
      JOIN cliente c ON d.id_cliente = c.id_cliente
      LEFT JOIN etar e ON d.id_etar = e.id_etar
      LEFT JOIN utilizador u_tec ON a.id_tecnico = u_tec.id_utilizador
      LEFT JOIN utilizador u_resp ON a.id_responsavel = u_resp.id_utilizador
      WHERE a.id_amostra = $1
    `;
    const sampleRes = await pool.query(query, [id]);

    if (sampleRes.rows.length === 0) {
      return res.status(404).json({ erro: 'Amostra não encontrada.' });
    }

    const info = sampleRes.rows[0];

    // Verificar se o cliente tem acesso a esta amostra
    if (perfil === 'CLIENTE' && info.id_cliente !== userClienteId) {
      return res.status(403).json({ erro: 'Não tem permissão para aceder a este boletim.' });
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

    // Iniciar o documento PDF
    const doc = new PDFDocument({ margin: 50 });

    // Enviar cabeçalhos HTTP para download do ficheiro
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Boletim_Analitico_Amostra_${info.id_amostra}.pdf`);
    doc.pipe(res);

    // Layout do PDF

    // Título Principal
    doc.fillColor('#1A365D')
       .fontSize(20)
       .text('BOLETIM ANALÍTICO DE DESCARGA', { align: 'center', bold: true });
    
    doc.fontSize(10)
       .fillColor('#4A5568')
       .text(`Amostra Ref: ${info.amostra_token}`, { align: 'center' })
       .moveDown(1.5);

    // Linha divisória
    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, 100).lineTo(562, 100).stroke();

    // 1. Dados do Cliente e ETAR
    doc.moveDown(1);
    doc.fontSize(12).fillColor('#2B6CB0').text('1. Informação Geral', { bold: true }).moveDown(0.3);
    
    doc.fontSize(10).fillColor('#2D3748');
    
    // Tabela de Informações Gerais
    const col1Left = 50;
    const col2Left = 300;
    let currentY = doc.y;

    doc.text(`Cliente: ${info.cliente_nome}`, col1Left, currentY);
    doc.text(`ETAR de Receção: ${info.etar_nome}`, col2Left, currentY);
    currentY += 16;
    doc.text(`Contacto: ${info.cliente_contacto || 'N/A'}`, col1Left, currentY);
    doc.text(`Tipo de Efluente: ${info.tipo_efluente}`, col2Left, currentY);
    currentY += 16;
    doc.text(`Transportadora: ${info.empresa_transportadora || 'N/A'}`, col1Left, currentY);
    doc.text(`Matrícula Trator: ${info.matricula_trator || 'N/A'}`, col2Left, currentY);
    currentY += 16;
    doc.text(`Volume Real: ${info.quantidade_real} Litros`, col1Left, currentY);
    doc.text(`Data de Recolha: ${new Date(info.data_recolha).toLocaleString()}`, col2Left, currentY);
    currentY += 16;
    doc.text(`Data de Receção: ${new Date(info.data_rececao).toLocaleString()}`, col1Left, currentY);
    doc.text(`Data de Validação: ${new Date(info.data_validacao).toLocaleString()}`, col2Left, currentY);

    doc.y = currentY + 30;

    // Linha divisória
    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, doc.y).lineTo(562, doc.y).stroke();
    doc.moveDown(1.5);

    // 2. Tabela de Parâmetros Analíticos
    doc.fontSize(12).fillColor('#2B6CB0').text('2. Parâmetros Analíticos Obtidos', { bold: true }).moveDown(0.5);

    // Cabeçalho da Tabela
    const tableTop = doc.y;
    doc.fontSize(9).fillColor('#718096');
    
    doc.text('Parâmetro', 55, tableTop, { width: 120, bold: true });
    doc.text('Valor', 180, tableTop, { width: 60, align: 'right', bold: true });
    doc.text('Unidade', 260, tableTop, { width: 60, bold: true });
    doc.text('Método Analítico', 340, tableTop, { width: 140, bold: true });
    doc.text('Incerteza', 500, tableTop, { width: 60, align: 'right', bold: true });

    doc.strokeColor('#A0AEC0').lineWidth(1.5).moveTo(50, tableTop + 15).lineTo(562, tableTop + 15).stroke();
    
    let rowY = tableTop + 22;
    doc.fillColor('#2D3748');

    resultados.forEach((resItem) => {
      // Adicionar linha se o espaço acabar
      if (rowY > 700) {
        doc.addPage();
        rowY = 50;
      }

      doc.text(resItem.parametro_name || 'N/A', 55, rowY, { width: 120 });
      doc.text(Number(resItem.valor).toFixed(2), 180, rowY, { width: 60, align: 'right' });
      doc.text(resItem.unidade || 'mg/L', 260, rowY, { width: 60 });
      doc.text(resItem.metodo || 'SMEWW / Interno', 340, rowY, { width: 140 });
      doc.text(resItem.incerteza ? `± ${Number(resItem.incerteza).toFixed(2)}` : 'N/A', 500, rowY, { width: 60, align: 'right' });

      // Linha fina separadora de registos
      doc.strokeColor('#EDF2F7').lineWidth(0.8).moveTo(50, rowY + 14).lineTo(562, rowY + 14).stroke();
      rowY += 20;
    });

    doc.y = rowY + 20;
    doc.moveDown(2);

    // 3. Assinatura/Validação Digital
    const signY = doc.y;
    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, signY).lineTo(562, signY).stroke();
    doc.moveDown(1.5);

    doc.fontSize(10).fillColor('#718096').text('Documento eletrónico validado digitalmente por:', 50, doc.y);
    doc.fontSize(11).fillColor('#1A202C').text(info.responsavel_nome || 'Diretor de Laboratório', 50, doc.y + 15, { bold: true });
    doc.fontSize(9).fillColor('#718096').text('Responsável Técnico / Responsável de Laboratório', 50, doc.y + 15);

    doc.fontSize(10).fillColor('#718096').text('Técnico Executor:', 350, signY + 18);
    doc.fontSize(11).fillColor('#1A202C').text(info.tecnico_nome || 'Técnico de Laboratório', 350, signY + 33, { bold: true });

    // Fim do documento
    doc.end();

  } catch (err) {
    console.error('Erro ao gerar PDF do boletim:', err);
    // Se ocorrer erro antes de enviar headers
    if (!res.headersSent) {
      return res.status(500).json({ erro: 'Erro interno ao gerar PDF do boletim.' });
    }
  }
};
