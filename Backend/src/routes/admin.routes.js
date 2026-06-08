const express = require('express');
const adminController = require('../controllers/admin.controller');
const { verificarToken, verificarPerfis } = require('../middlewares/auth.middleware');

const router = express.Router();

// Aplicar verificação de autenticação JWT e restrição de perfil GESTOR_CLIENTES a todas as rotas deste ficheiro
router.use(verificarToken);
router.use(verificarPerfis(['GESTOR_CLIENTES']));

// 1. Clientes
router.get('/clientes', adminController.obterClientes);
router.post('/clientes', adminController.criarCliente);
router.put('/clientes/:id/status', adminController.atualizarEstadoCliente);
router.put('/clientes/:id', adminController.atualizarCliente);

// 2. ETARs
router.get('/etars', adminController.obterEtars);
router.put('/etars/:id/disponibilidade', adminController.atualizarDisponibilidadeEtar);

// 3. Whitelists
router.get('/autorizacoes', adminController.obterAutorizacoes);
router.post('/autorizacoes', adminController.criarAutorizacao);
router.put('/autorizacoes/:id', adminController.atualizarAutorizacao);

// 4. Parâmetros contratuais
router.get('/parametros', adminController.obterParametros);
router.get('/clientes/:id/parametros', adminController.obterParametrosCliente);
router.post('/clientes/:id/parametros', adminController.atualizarParametrosCliente);

// 5. Relatórios Consolidados
router.get('/relatorios', adminController.obterRelatorios);

module.exports = router;
