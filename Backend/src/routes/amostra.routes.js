const express = require('express');
const router = express.Router();
const amostraController = require('../controllers/amostra.controller');
const { verificarToken, verificarPerfis } = require('../middlewares/auth.middleware');

// Todas as rotas deste módulo necessitam de autenticação
router.use(verificarToken);

// PUT /api/amostras/receber/:token - Check-in da amostra física e triagem automática (Técnicos e Responsáveis de Lab)
router.put('/receber/:token', verificarPerfis(['TECNICO_LAB', 'RESPONSAVEL_LAB']), amostraController.receberAmostra);

// GET /api/amostras - Listagem de amostras (Todos os perfis autorizados, filtrado internamente)
router.get('/', verificarPerfis(['CLIENTE', 'TECNICO_LAB', 'RESPONSAVEL_LAB', 'GESTOR_CLIENTES']), amostraController.obterAmostras);

// GET /api/amostras/:id - Detalhes da amostra e os seus resultados (Filtrado para Clientes)
router.get('/:id', verificarPerfis(['CLIENTE', 'TECNICO_LAB', 'RESPONSAVEL_LAB', 'GESTOR_CLIENTES']), amostraController.obterDetalhesAmostra);

// POST /api/amostras/:id/resultados - Introdução de resultados laboratoriais (Apenas Técnicos)
router.post('/:id/resultados', verificarPerfis(['TECNICO_LAB']), amostraController.registarResultados);

// PUT /api/amostras/:id/validar - Validação técnica (Responsável de Laboratório ou de ETAR)
router.put('/:id/validar', verificarPerfis(['RESPONSAVEL_LAB', 'RESPONSAVEL_ETAR']), amostraController.validarAmostra);

// PUT /api/amostras/:id/disponibilizar - Disponibilizar boletim ao cliente (Gestor de Clientes)
router.put('/:id/disponibilizar', verificarPerfis(['GESTOR_CLIENTES']), amostraController.disponibilizarBoletim);

// GET /api/amostras/:id/boletim - Download do Boletim Analítico em PDF
router.get('/:id/boletim', verificarPerfis(['CLIENTE', 'RESPONSAVEL_LAB', 'RESPONSAVEL_ETAR', 'GESTOR_CLIENTES']), amostraController.gerarBoletimPDF);

module.exports = router;
