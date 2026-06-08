const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares globais
app.use(cors());
app.use(express.json());

// Importação das Rotas de Teste
const testRoutes = require('./routes/test.routes');
const dbRoutes = require('./routes/db.routes');

// Registo de Rotas
app.use('/api/test', testRoutes);
app.use('/api/db', dbRoutes);

module.exports = app;
