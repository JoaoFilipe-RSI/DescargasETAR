const express = require('express');
const router = express.Router();
const amostraController = require('../controllers/amostra.controller');
const { verificarToken, verificarPerfis } = require('../middlewares/auth.middleware');

// Todas as rotas deste módulo necessitam de autenticação
router.use(verificarToken);

// PUT /api/amostras/receber/:token - Check-in da amostra física e triagem automática (Técnicos e Responsáveis de Lab)
router.put('/receber/:token', verificarPerfis(['TECNICO_LAB', 'RESPONSAVEL_LAB']), amostraController.receberAmostra);

// GET /api/amostras - Listagem de amostras (Todos os perfis autorizados, filtrado internamente)
router.get('/', verificarPerfis(['CLIENTE', 'TECNICO_LAB', 'RESPONSAVEL_LAB', 'GESTOR_CLIENTES', 'GESTOR_ADMIN']), amostraController.obterAmostras);

// GET /api/amostras/:id - Detalhes da amostra e os seus resultados (Filtrado para Clientes)
router.get('/:id', verificarPerfis(['CLIENTE', 'TECNICO_LAB', 'RESPONSAVEL_LAB', 'GESTOR_CLIENTES', 'GESTOR_ADMIN']), amostraController.obterDetalhesAmostra);

// POST /api/amostras/:id/resultados - Introdução e edição de resultados laboratoriais (Técnicos e Responsável de Lab)
router.post('/:id/resultados', verificarPerfis(['TECNICO_LAB', 'RESPONSAVEL_LAB']), amostraController.registarResultados);

// PUT /api/amostras/:id/validar - Validação técnica (Apenas Responsável de Laboratório)
router.put('/:id/validar', verificarPerfis(['RESPONSAVEL_LAB']), amostraController.validarAmostra);

// PUT /api/amostras/:id/disponibilizar - Disponibilizar boletim ao cliente (Gestor de Clientes)
router.put('/:id/disponibilizar', verificarPerfis(['GESTOR_CLIENTES', 'GESTOR_ADMIN']), amostraController.disponibilizarBoletim);

// GET /api/amostras/:id/boletim - Download do Boletim Analítico em PDF
router.get('/:id/boletim', verificarPerfis(['CLIENTE', 'RESPONSAVEL_LAB', 'GESTOR_CLIENTES', 'GESTOR_ADMIN']), amostraController.gerarBoletimPDF);

module.exports = router;
