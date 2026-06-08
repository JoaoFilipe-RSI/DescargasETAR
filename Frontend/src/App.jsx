import React, { useState, useEffect } from 'react';
import { authService } from './services/api';
import { webSocketService } from './services/websocket';
import Login from './views/Login';
import ClienteDashboard from './views/ClienteDashboard';
import OperadorDashboard from './views/OperadorDashboard';
import TecnicoDashboard from './views/TecnicoDashboard';
import ResponsavelDashboard from './views/ResponsavelDashboard';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carregar sessão existente no arranque
  useEffect(() => {
    const sessionUser = authService.getCurrentUser();
    if (sessionUser && authService.isAuthenticated()) {
      setUser(sessionUser);
    }
    setLoading(false);
  }, []);

  // Ligar/Desligar WebSocket com base no estado da sessão do utilizador
  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      if (token) {
        webSocketService.connect(token);
      }
    } else {
      webSocketService.disconnect();
    }
    return () => {
      webSocketService.disconnect();
    };
  }, [user]);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
        <p style={{ fontFamily: 'var(--font-title)', fontWeight: 600, color: 'var(--text-secondary)' }}>
          A carregar sessão...
        </p>
      </div>
    );
  }

  // Se não estiver autenticado, exibe o ecrã de Login
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Direcionamento dinâmico baseado no perfil do utilizador (RBAC)
  switch (user.perfil) {
    case 'CLIENTE':
      return <ClienteDashboard user={user} onLogout={handleLogout} />;
    
    case 'OPERADOR_ETAR':
      return <OperadorDashboard user={user} onLogout={handleLogout} />;
    
    case 'TECNICO_LAB':
      return <TecnicoDashboard user={user} onLogout={handleLogout} />;
    
    case 'RESPONSAVEL_LAB':
    case 'RESPONSAVEL_ETAR':
    case 'GESTOR_CLIENTES':
      return <ResponsavelDashboard user={user} onLogout={handleLogout} />;
    
    default:
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '2rem', textAlign: 'center' }}>
          <h2>Acesso Não Autorizado</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>
            O seu perfil de utilizador (<strong>{user.perfil}</strong>) não tem permissões para aceder a esta aplicação.
          </p>
          <button className="btn btn-primary" onClick={handleLogout}>Voltar</button>
        </div>
      );
  }
}
