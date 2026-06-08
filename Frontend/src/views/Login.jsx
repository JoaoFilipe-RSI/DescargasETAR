import React, { useState } from 'react';
import { authService } from '../services/api';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await authService.login(email, password);
      onLoginSuccess(user);
    } catch (err) {
      setError(err.message || 'Credenciais inválidas. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Função utilitária para testadores (preenche dados das sementes da BD)
  const handleQuickLogin = (quickEmail) => {
    setEmail(quickEmail);
    setPassword('123456'); // Senha default encriptada no seed
    setError('');
  };

  return (
    <div className="login-container animate-fade-in">
      <div className="card login-card" style={{ boxShadow: 'var(--shadow-lg)', borderTop: '6px solid var(--accent)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/pwa-192x192.png" alt="Logo" style={{ width: '64px', height: '64px', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }} />
          <h2>Gestão de Descargas</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Plataforma Digital de Controlo e Rastreabilidade</p>
        </div>

        {error && (
          <div className="card" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', marginBottom: '1rem', borderLeft: '4px solid var(--danger)' }}>
            <AlertCircle size={16} /> <span style={{ fontSize: '0.85rem' }}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Mail size={14} /> Email Corporativo
            </label>
            <input type="email" className="form-input" placeholder="exemplo@empresa.pt" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Lock size={14} /> Palavra-passe
            </label>
            <input type="password" className="form-input" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'A autenticar...' : 'Entrar no Sistema'}
          </button>
        </form>

        {/* Utilitário para Testes Rápidos (Seed Data) */}
        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', textAlign: 'center' }}>
            Acesso Rápido para Testes:
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className="btn btn-secondary" style={{ padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'flex-start' }} onClick={() => handleQuickLogin('geral@empresaIndustrialaaa.pt')}>
              👤 Cliente: Empresa Industrial AAA
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'flex-start' }} onClick={() => handleQuickLogin('carlos.silva@etar.pt')}>
              ⚙️ Operador: Carlos Silva (ETAR Norte)
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'flex-start' }} onClick={() => handleQuickLogin('ana.pereira@laboratorio.pt')}>
              🧪 Técnico Lab: Ana Pereira
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'flex-start' }} onClick={() => handleQuickLogin('rui.fonseca@laboratorio.pt')}>
              🔬 Resp. Lab: Rui Fonseca
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.4rem', fontSize: '0.75rem', justifyContent: 'flex-start' }} onClick={() => handleQuickLogin('mariana.costa@administracao.pt')}>
              💼 Gestor Clientes: Mariana Costa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
