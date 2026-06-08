require('dotenv').config();
const http = require('http');
const app = require('./app');
const { inicializarSocket } = require('./config/socket');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
inicializarSocket(server);

server.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
