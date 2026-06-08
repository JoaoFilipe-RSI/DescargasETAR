const jwt = require('jsonwebtoken');

/**
 * Middleware para validar o token JWT enviado no header Authorization.
 */
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
  }

  // O formato esperado é "Bearer <TOKEN>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ erro: 'Acesso negado. Formato de token inválido.' });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Anexa as informações do utilizador ao request
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
};

/**
 * Middleware para controlar acessos com base em perfis (RBAC).
 * @param {string[]} perfisPermitidos - Lista de nomes dos perfis que podem aceder.
 */
const verificarPerfis = (perfisPermitidos) => {
  return (req, res, next) => {
    if (!req.user || !req.user.perfil) {
      return res.status(403).json({ erro: 'Acesso negado. Utilizador não autenticado.' });
    }

    if (!perfisPermitidos.includes(req.user.perfil)) {
      return res.status(403).json({ 
        erro: `Acesso negado. O perfil '${req.user.perfil}' não tem permissões para esta operação.` 
      });
    }

    next();
  };
};

module.exports = {
  verificarToken,
  verificarPerfis
};
