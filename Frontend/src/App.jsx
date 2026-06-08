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

  const [notifications, setNotifications] = useState([]);

  // Estados para Alterar Palavra-passe
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Carregar sessão existente no arranque
  useEffect(() => {
    const sessionUser = authService.getCurrentUser();
    if (sessionUser && authService.isAuthenticated()) {
      setUser(sessionUser);
    }
    setLoading(false);
  }, []);

  // Carregar notificações persistidas específicas do utilizador ao efetuar login
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`notifications_${user.id_utilizador}`);
      setNotifications(saved ? JSON.parse(saved) : []);
    } else {
      setNotifications([]);
    }
  }, [user]);

  // Gravar alterações das notificações no armazenamento local
  useEffect(() => {
    if (user && notifications.length > 0) {
      localStorage.setItem(`notifications_${user.id_utilizador}`, JSON.stringify(notifications));
    } else if (user) {
      localStorage.removeItem(`notifications_${user.id_utilizador}`);
    }
  }, [notifications, user]);

  // Ligar/Desligar WebSocket e gerir subscrições globais do "sininho"
  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      if (token) {
        webSocketService.connect(token);

        const addNotification = (mensagem) => {
          setNotifications((prev) => [
            {
              id: Date.now() + Math.random().toString(36).substring(2, 9),
              mensagem,
              data: new Date(),
              lida: false
            },
            ...prev
          ]);
        };

        const handlers = [];

        // Mapear eventos por perfil do utilizador para alimentar o sininho
        if (user.perfil === 'CLIENTE') {
          const handleDecisao = (data) => addNotification(data.mensagem);
          const handleBoletim = (data) => addNotification(data.mensagem);

          webSocketService.on('decisao-pedido', handleDecisao);
          webSocketService.on('boletim-disponivel', handleBoletim);
          handlers.push({ event: 'decisao-pedido', cb: handleDecisao });
          handlers.push({ event: 'boletim-disponivel', cb: handleBoletim });
        } else if (user.perfil === 'OPERADOR_ETAR' || user.perfil === 'RESPONSAVEL_ETAR') {
          const handleNovoAgendamento = (data) => 
            addNotification(`Novo agendamento recebido: ${data.empresa_transportadora} (${data.matricula_trator}).`);

          webSocketService.on('novo-agendamento', handleNovoAgendamento);
          handlers.push({ event: 'novo-agendamento', cb: handleNovoAgendamento });
        } else if (user.perfil === 'TECNICO_LAB') {
          const handleNovaAmostra = (data) => 
            addNotification(`Nova amostra para check-in: ${data.qr_code_token} (Descarga #${data.id_descarga}).`);

          webSocketService.on('nova-amostra', handleNovaAmostra);
          handlers.push({ event: 'nova-amostra', cb: handleNovaAmostra });
        } else if (user.perfil === 'RESPONSAVEL_LAB') {
          const handleNovaAmostra = (data) => 
            addNotification(`Nova amostra recolhida: ${data.qr_code_token} (Descarga #${data.id_descarga}).`);
          const handleAmostraAnalisada = (data) => 
            addNotification(`Resultados laboratoriais prontos para validação: Amostra ${data.qr_code_token}.`);

          webSocketService.on('nova-amostra', handleNovaAmostra);
          webSocketService.on('amostra-analisada', handleAmostraAnalisada);
          handlers.push({ event: 'nova-amostra', cb: handleNovaAmostra });
          handlers.push({ event: 'amostra-analisada', cb: handleAmostraAnalisada });
        } else if (user.perfil === 'GESTOR_CLIENTES') {
          const handleNovoPedido = (data) => 
            addNotification(`Novo pedido pendente: Descarga #${data.id_descarga} (${data.cliente_nome} - ${data.quantidade}L).`);
          const handleDescargaConcluida = (data) => 
            addNotification(data.mensagem);
          const handleAmostraConcluida = (data) => 
            addNotification(data.mensagem);

          webSocketService.on('novo-pedido', handleNovoPedido);
          webSocketService.on('descarga-concluida', handleDescargaConcluida);
          webSocketService.on('amostra-concluida', handleAmostraConcluida);
          handlers.push({ event: 'novo-pedido', cb: handleNovoPedido });
          handlers.push({ event: 'descarga-concluida', cb: handleDescargaConcluida });
          handlers.push({ event: 'amostra-concluida', cb: handleAmostraConcluida });
        }

        return () => {
          handlers.forEach(({ event, cb }) => {
            webSocketService.off(event, cb);
          });
          webSocketService.disconnect();
        };
      }
    } else {
      webSocketService.disconnect();
    }
  }, [user]);

  const handleMarkAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await authService.alterarSenha(senhaAtual, novaSenha);
      setSuccessMsg('Palavra-passe alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setTimeout(() => {
        setShowChangePassword(false);
        setSuccessMsg('');
      }, 2000);
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao alterar palavra-passe.');
    }
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

  const renderDashboard = () => {
    switch (user.perfil) {
      case 'CLIENTE':
        return (
          <ClienteDashboard 
            user={user} 
            onLogout={handleLogout} 
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onChangePassword={() => setShowChangePassword(true)}
          />
        );
      
      case 'OPERADOR_ETAR':
      case 'RESPONSAVEL_ETAR':
        return (
          <OperadorDashboard 
            user={user} 
            onLogout={handleLogout} 
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onChangePassword={() => setShowChangePassword(true)}
          />
        );
      
      case 'TECNICO_LAB':
        return (
          <TecnicoDashboard 
            user={user} 
            onLogout={handleLogout} 
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onChangePassword={() => setShowChangePassword(true)}
          />
        );
      
      case 'RESPONSAVEL_LAB':
      case 'GESTOR_CLIENTES':
        return (
          <ResponsavelDashboard 
            user={user} 
            onLogout={handleLogout} 
            notifications={notifications}
            onMarkAsRead={handleMarkAsRead}
            onMarkAllAsRead={handleMarkAllAsRead}
            onChangePassword={() => setShowChangePassword(true)}
          />
        );
      
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
  };

  return (
    <>
      {renderDashboard()}

      {showChangePassword && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem' }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', marginBottom: 0 }}>
            <h3 style={{ marginBottom: '1rem' }}>Alterar Palavra-passe</h3>
            
            {errorMsg && (
              <div className="card" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: '0.75rem', marginBottom: '1rem', borderLeft: '4px solid var(--danger)', fontSize: '0.85rem' }}>
                {errorMsg}
              </div>
            )}
            
            {successMsg && (
              <div className="card" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '0.75rem', marginBottom: '1rem', borderLeft: '4px solid var(--success)', fontSize: '0.85rem' }}>
                {successMsg}
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit}>
              <div className="form-group">
                <label className="form-label">Palavra-passe Atual *</label>
                <input 
                  type="password" 
                  className="form-input" 
                  required 
                  value={senhaAtual} 
                  onChange={e => setSenhaAtual(e.target.value)} 
                  placeholder="Introduza a palavra-passe atual"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nova Palavra-passe *</label>
                <input 
                  type="password" 
                  className="form-input" 
                  required 
                  value={novaSenha} 
                  onChange={e => setNovaSenha(e.target.value)} 
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Gravar</button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => { 
                    setShowChangePassword(false); 
                    setSenhaAtual(''); 
                    setNovaSenha(''); 
                    setErrorMsg(''); 
                    setSuccessMsg(''); 
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
