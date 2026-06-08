const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

// POST /api/auth/login - Efetuar login de utilizador (Público)
router.post('/login', authController.login);

// GET /api/auth/me - Obter dados do próprio utilizador logado (Protegido por token)
router.get('/me', verificarToken, authController.getMe);

module.exports = router;
