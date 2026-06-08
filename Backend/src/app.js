const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares globais
app.use(cors());
app.use(express.json());

// Importação das Rotas
const testRoutes = require('./routes/test.routes');
const dbRoutes = require('./routes/db.routes');
const authRoutes = require('./routes/auth.routes');

// Registo de Rotas
app.use('/api/test', testRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/auth', authRoutes);

module.exports = app;
