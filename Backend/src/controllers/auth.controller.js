const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

/**
 * Efetua o login do utilizador e gera o token JWT.
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ erro: 'Por favor, forneça email e palavra-passe.' });
  }

  try {
    // Procurar utilizador, o seu perfil, o id_cliente associado se for cliente, e o nome da etar
    const query = `
      SELECT u.id_utilizador, u.nome, u.email, u.password_hash, u.ativo, u.id_etar,
             p.nome AS perfil, c.id_cliente,
             e.nome AS etar_nome
      FROM utilizador u
      JOIN perfil p ON u.id_perfil = p.id_perfil
      LEFT JOIN cliente c ON u.id_utilizador = c.id_utilizador
      LEFT JOIN etar e ON u.id_etar = e.id_etar
      WHERE LOWER(u.email) = LOWER($1)
    `;
    const result = await pool.query(query, [email.toLowerCase().trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    const user = result.rows[0];

    // Verificar se o utilizador está ativo
    if (!user.ativo) {
      return res.status(403).json({ erro: 'Esta conta está desativada. Contacte o administrador.' });
    }

    // Comparar palavra-passe
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    // Criar o payload do JWT
    const payload = {
      id_utilizador: user.id_utilizador,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      id_etar: user.id_etar,
      etar_nome: user.etar_nome,
      id_cliente: user.id_cliente
    };

    // Assinar o token (expira em 24 horas)
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

    // Enviar resposta
    return res.json({
      mensagem: 'Login efetuado com sucesso.',
      token,
      utilizador: {
        id_utilizador: user.id_utilizador,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil,
        id_etar: user.id_etar,
        etar_nome: user.etar_nome,
        id_cliente: user.id_cliente
      }
    });

  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ erro: 'Erro interno ao efetuar login.' });
  }
};

/**
 * Retorna os dados do utilizador autenticado obtidos do token.
 */
exports.getMe = (req, res) => {
  return res.json({ utilizador: req.user });
};
