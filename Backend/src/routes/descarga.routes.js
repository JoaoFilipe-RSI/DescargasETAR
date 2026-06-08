const express = require('express');
const router = express.Router();
const descargaController = require('../controllers/descarga.controller');
const { verificarToken, verificarPerfis } = require('../middlewares/auth.middleware');

// Todas as rotas deste módulo necessitam de autenticação
router.use(verificarToken);

// POST /api/descargas - Criar pedido de descarga (Apenas Clientes)
router.post('/', verificarPerfis(['CLIENTE']), descargaController.criarPedido);

// GET /api/descargas - Listar descargas (Todos os perfis autorizados - filtrado por RBAC internamente)
router.get('/', descargaController.obterDescargas);

// PUT /api/descargas/:id/decisao - Aprovação ou Rejeição de pedido (Apenas Gestor de Clientes)
router.put('/:id/decisao', verificarPerfis(['GESTOR_CLIENTES']), descargaController.registarDecisao);

// PUT /api/descargas/:id/agendar - Agendar descarga autorizada (Apenas Clientes)
router.put('/:id/agendar', verificarPerfis(['CLIENTE']), descargaController.agendarDescarga);

// GET /api/descargas/validar/:token - Validar QR Code (Operadores de ETAR e Gestores de Clientes)
router.get('/validar/:token', verificarPerfis(['OPERADOR_ETAR', 'GESTOR_CLIENTES']), descargaController.validarTokenQR);

// PUT /api/descargas/:id/receber - Registar receção física na ETAR (Apenas Operadores de ETAR)
router.put('/:id/receber', verificarPerfis(['OPERADOR_ETAR']), descargaController.registarRececao);

module.exports = router;
