const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/**
 * Inicializa o servidor Socket.io anexado ao servidor HTTP nativo.
 */
function inicializarSocket(server) {
  io = new Server(server, {
    cors: {
      origin: '*', // Permitir ligação do PWA local em qualquer porta
      methods: ['GET', 'POST', 'PUT']
    }
  });

  // Middleware de Autenticação JWT para ligações socket
  io.use((socket, next) => {
    const authHeader = socket.handshake.auth.token;
    
    if (!authHeader) {
      return next(new Error('Acesso negado. Token não fornecido.'));
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next(new Error('Acesso negado. Formato de token inválido.'));
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_token_for_descargas_system_2026');
      socket.user = decoded; // Anexa o utilizador descodificado ao socket
      next();
    } catch (err) {
      return next(new Error('Token inválido ou expirado.'));
    }
  });

  // Conexão estabelecida e encaminhamento de salas
  io.on('connection', (socket) => {
    const { perfil, id_cliente, id_etar, nome } = socket.user;
    
    console.log(`🔌 Cliente WebSocket ligado: ${nome} (${perfil}) | Socket ID: ${socket.id}`);

    // Associar utilizadores a salas baseadas em perfis (RBAC)
    if (perfil === 'CLIENTE' && id_cliente) {
      const room = `cliente-${id_cliente}`;
      socket.join(room);
      console.log(`   └─ Juntou-se à sala: ${room}`);
    } else if ((perfil === 'OPERADOR_ETAR' || perfil === 'RESPONSAVEL_ETAR') && id_etar) {
      const room = `etar-${id_etar}`;
      socket.join(room);
      console.log(`   └─ Juntou-se à sala: ${room}`);
    } else if (perfil === 'TECNICO_LAB') {
      const room = 'laboratorio-tecnicos';
      socket.join(room);
      console.log(`   └─ Juntou-se à sala: ${room}`);
    } else if (perfil === 'RESPONSAVEL_LAB') {
      const room = 'laboratorio-responsaveis';
      socket.join(room);
      console.log(`   └─ Juntou-se à sala: ${room}`);
    } else if (perfil === 'GESTOR_CLIENTES' || perfil === 'GESTOR_ADMIN') {
      const room = 'gestores-clientes';
      socket.join(room);
      console.log(`   └─ Juntou-se à sala: ${room}`);
    }

    socket.on('disconnect', () => {
      console.log(`🔌 Cliente WebSocket desligado: ${nome} | Socket ID: ${socket.id}`);
    });
  });

  return io;
}

/**
 * Função utilitária para emitir eventos para salas específicas
 */
function enviarNotificacao(sala, evento, dados) {
  if (!io) {
    console.warn('⚠️ Tentou-se enviar notificação antes do Socket.io ser inicializado.');
    return;
  }
  
  console.log(`📢 Emitindo evento [${evento}] para a sala [${sala}]`);
  io.to(sala).emit(evento, dados);
}

/**
 * Função utilitária para emitir eventos para todos os utilizadores (broadcast geral)
 */
function enviarNotificacaoGeral(evento, dados) {
  if (!io) {
    console.warn('⚠️ Tentou-se enviar notificação antes do Socket.io ser inicializado.');
    return;
  }
  
  console.log(`📢 Emitindo evento geral [${evento}] para todos os utilizadores ligados`);
  io.emit(evento, dados);
}

module.exports = {
  inicializarSocket,
  enviarNotificacao,
  enviarNotificacaoGeral
};
