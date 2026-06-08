import { io } from 'socket.io-client';

let socket = null;

export const webSocketService = {
  /**
   * Estabelece ligação com o servidor Socket.io utilizando o token JWT
   */
  connect(token) {
    if (socket) {
      console.log('🔌 Reutilizando ligação WebSocket existente.');
      return socket;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    console.log(`🔌 Ligando ao servidor WebSocket: ${socketUrl}`);

    socket = io(socketUrl, {
      auth: {
        token: `Bearer ${token}`
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    socket.on('connect', () => {
      console.log('✅ Ligação WebSocket estabelecida com sucesso. ID:', socket.id);
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Erro na ligação WebSocket:', error.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Ligação WebSocket perdida:', reason);
    });

    return socket;
  },

  /**
   * Encerra a ligação ativa
   */
  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
      console.log('🔌 Ligação WebSocket encerrada manualmente.');
    }
  },

  /**
   * Subscreve um evento
   */
  on(event, callback) {
    if (socket) {
      socket.on(event, callback);
    } else {
      console.warn(`⚠️ Tentou registar evento [${event}] mas o socket não está ligado.`);
    }
  },

  /**
   * Cancela a subscrição de um evento
   */
  off(event, callback) {
    if (socket) {
      socket.off(event, callback);
    }
  }
};
