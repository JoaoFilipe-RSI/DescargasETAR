const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// GET /api/db/clientes
router.get('/clientes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cliente');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro de BD:', err);
    res.status(500).json({ 
      erro: 'Erro de comunicação com a base de dados', 
      detalhe: err.message 
    });
  }
});

module.exports = router;
