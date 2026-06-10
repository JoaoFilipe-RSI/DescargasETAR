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
router.put('/:id/decisao', verificarPerfis(['GESTOR_CLIENTES', 'GESTOR_ADMIN']), descargaController.registarDecisao);

// PUT /api/descargas/:id/agendar - Agendar descarga autorizada (Apenas Clientes)
router.put('/:id/agendar', verificarPerfis(['CLIENTE']), descargaController.agendarDescarga);

// PUT /api/descargas/:id/cancelar - Cancelar descarga pelo cliente (Apenas Clientes)
router.put('/:id/cancelar', verificarPerfis(['CLIENTE']), descargaController.cancelarDescarga);

// PUT /api/descargas/:id - Editar pedido de descarga rejeitado/cancelado (Apenas Clientes)
router.put('/:id', verificarPerfis(['CLIENTE']), descargaController.editarPedido);

// GET /api/descargas/validar/:token - Validar QR Code (Operadores de ETAR, Responsáveis de ETAR e Gestores de Clientes)
router.get('/validar/:token', verificarPerfis(['OPERADOR_ETAR', 'RESPONSAVEL_ETAR', 'GESTOR_CLIENTES', 'GESTOR_ADMIN']), descargaController.validarTokenQR);

// PUT /api/descargas/:id/receber - Registar receção física na ETAR (Operadores de ETAR e Responsáveis de ETAR)
router.put('/:id/receber', verificarPerfis(['OPERADOR_ETAR', 'RESPONSAVEL_ETAR']), descargaController.registarRececao);

// GET /api/descargas/:id/ficha - Download da Ficha de Descarga em PDF
router.get('/:id/ficha', verificarPerfis(['CLIENTE', 'GESTOR_CLIENTES', 'GESTOR_ADMIN', 'OPERADOR_ETAR', 'RESPONSAVEL_ETAR']), descargaController.gerarFichaDescargaPDF);

module.exports = router;
