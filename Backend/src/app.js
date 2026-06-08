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
const descargaRoutes = require('./routes/descarga.routes');

// Registo de Rotas
app.use('/api/test', testRoutes);
app.use('/api/db', dbRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/descargas', descargaRoutes);

module.exports = app;
