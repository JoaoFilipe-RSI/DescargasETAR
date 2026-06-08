const express = require('express');
const router = express.Router();

// GET /api/test
router.get('/', (req, res) => {
  res.json({ mensagem: 'API a funcionar!' });
});

module.exports = router;
