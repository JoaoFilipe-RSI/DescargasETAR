const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

// POST /api/auth/login - Efetuar login de utilizador (Público)
router.post('/login', authController.login);

// GET /api/auth/me - Obter dados do próprio utilizador logado (Protegido por token)
router.get('/me', verificarToken, authController.getMe);

// PUT /api/auth/alterar-senha - Alterar palavra-passe do utilizador logado (Protegido por token)
router.put('/alterar-senha', verificarToken, authController.alterarSenha);

module.exports = router;
