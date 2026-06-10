const express = require('express');
const adminController = require('../controllers/admin.controller');
const { verificarToken, verificarPerfis } = require('../middlewares/auth.middleware');

const router = express.Router();

// Aplicar verificação de autenticação JWT a todas as rotas deste ficheiro
router.use(verificarToken);

// Parâmetros (acessível também por RESPONSAVEL_LAB para gestão do catálogo analítico)
router.get('/parametros', verificarPerfis(['RESPONSAVEL_LAB', 'GESTOR_CLIENTES', 'GESTOR_ADMIN']), adminController.obterParametros);
router.get('/parametros/tipos', verificarPerfis(['RESPONSAVEL_LAB', 'GESTOR_CLIENTES', 'GESTOR_ADMIN']), adminController.obterTiposParametro);
router.post('/parametros/tipos', verificarPerfis(['GESTOR_CLIENTES', 'GESTOR_ADMIN']), adminController.criarTipoParametro);
router.put('/parametros/:id', verificarPerfis(['RESPONSAVEL_LAB', 'GESTOR_CLIENTES', 'GESTOR_ADMIN']), adminController.atualizarParametro);

// Restringir restantes rotas de administração a gestores
router.use(verificarPerfis(['GESTOR_CLIENTES', 'GESTOR_ADMIN']));

// 1. Clientes
router.get('/clientes', adminController.obterClientes);
router.post('/clientes', adminController.criarCliente);
router.put('/clientes/:id/status', adminController.atualizarEstadoCliente);
router.put('/clientes/:id', adminController.atualizarCliente);

// 2. ETARs
router.get('/etars', adminController.obterEtars);
router.put('/etars/:id/disponibilidade', adminController.atualizarDisponibilidadeEtar);
router.post('/etars', adminController.criarEtar);

// 3. Whitelists
router.get('/autorizacoes', adminController.obterAutorizacoes);
router.post('/autorizacoes', adminController.criarAutorizacao);
router.put('/autorizacoes/:id', adminController.atualizarAutorizacao);

// 4. Parâmetros contratuais
router.get('/clientes/:id/parametros', adminController.obterParametrosCliente);
router.post('/clientes/:id/parametros', adminController.atualizarParametrosCliente);
router.post('/parametros', adminController.criarParametro);

// 5. Relatórios Consolidados
router.get('/relatorios', adminController.obterRelatorios);

// 6. Utilizadores Internos
router.get('/utilizadores', verificarPerfis(['GESTOR_ADMIN']), adminController.obterUtilizadores);
router.post('/utilizadores', verificarPerfis(['GESTOR_ADMIN']), adminController.criarUtilizador);
router.put('/utilizadores/:id', verificarPerfis(['GESTOR_ADMIN']), adminController.atualizarUtilizador);

// 7. Auditoria do Sistema
router.get('/auditoria', verificarPerfis(['GESTOR_ADMIN']), adminController.obterLogsAuditoria);

// 8. Mensagem Geral / Notificações do Sistema
router.post('/notificacoes/geral', verificarPerfis(['GESTOR_ADMIN']), adminController.enviarMensagemGeral);

// 9. Perfis de Utilizador
router.get('/perfis', verificarPerfis(['GESTOR_ADMIN']), adminController.obterPerfis);
router.post('/perfis', verificarPerfis(['GESTOR_ADMIN']), adminController.criarPerfil);
router.put('/perfis/:id', verificarPerfis(['GESTOR_ADMIN']), adminController.atualizarPerfil);

module.exports = router;
