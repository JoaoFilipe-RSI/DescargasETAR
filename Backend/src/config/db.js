const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Testar a conexão inicial ao banco de dados
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Erro ao ligar ao PostgreSQL:', err.message);
  } else {
    console.log('Ligação ao PostgreSQL estabelecida com sucesso em:', res.rows[0].now);
  }
});

module.exports = pool;
