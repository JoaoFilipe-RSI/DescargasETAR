import React, { useState, useEffect } from 'react';
import { descargaService } from '../services/api';
import { Camera, Search, FileText, CheckCircle2, AlertTriangle, LogOut, Printer } from 'lucide-react';
import { webSocketService } from '../services/websocket';
import NotificationBell from '../components/NotificationBell';

export default function OperadorDashboard({ user, onLogout, notifications, onMarkAsRead, onMarkAllAsRead }) {
  const [activeView, setActiveView] = useState('scanner'); // 'scanner', 'receber', 'agendados', 'sucesso'
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Dados da descarga validada
  const [validatedDescarga, setValidatedDescarga] = useState(null);
  const [rececaoResult, setRececaoResult] = useState(null);
  
  // Inputs da receção
  const [rececaoData, setRececaoData] = useState({
    quantidade_real: '',
    recolha_amostra: false,
    observacoes: ''
  });

  // Lista de agendados para a ETAR do operador
  const [agendadasList, setAgendadasList] = useState([]);

  // Carregar lista de descargas agendadas
  const loadAgendados = async () => {
    setLoading(true);
    try {
      // Filtrar apenas agendadas para a ETAR específica do operador
      const data = await descargaService.obterDescargas({
        estado: 'AGENDADA',
        id_etar: user.id_etar
      });
      setAgendadasList(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao obter agendamentos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'agendados') {
      loadAgendados();
    }
  }, [activeView]);

  // Escutar agendamentos em tempo real via WebSockets
  useEffect(() => {
    const handleNovoAgendamento = (data) => {
      setSuccess(`Novo agendamento recebido em tempo real: ${data.empresa_transportadora} (${data.matricula_trator}).`);
      loadAgendados();
    };

    webSocketService.on('novo-agendamento', handleNovoAgendamento);

    return () => {
      webSocketService.off('novo-agendamento', handleNovoAgendamento);
    };
  }, []);

  // Validar QR Code / Token
  const handleValidateQR = async (e, overrideToken = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const token = overrideToken || qrInput;
    if (!token || !token.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await descargaService.validarTokenQR(token.trim());
      setValidatedDescarga(res.descarga);
      setRececaoData({
        quantidade_real: res.descarga.quantidade.toString(), // Pré-preenche com o autorizado
        recolha_amostra: false,
        observacoes: ''
      });
      setActiveView('receber');
    } catch (err) {
      setError(err.message || 'Código QR inválido ou descarga não autorizada.');
    } finally {
      setLoading(false);
    }
  };

  // Submeter Receção Física
  const handleConfirmRececao = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        quantidade_real: parseFloat(rececaoData.quantidade_real),
        recolha_amostra: rececaoData.recolha_amostra,
        observacoes: rececaoData.observacoes || null
      };

      const res = await descargaService.registarRececao(validatedDescarga.id_descarga, payload);
      setRececaoResult(res);
      setActiveView('sucesso');
    } catch (err) {
      setError(err.message || 'Erro ao registar receção física.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="navbar">
        <div className="brand">
          <img src="/pwa-192x192.png" className="brand-logo" alt="Logo" />
          <span className="brand-name">DescargasETAR</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <strong>{user.nome}</strong> ({user.etar_nome || `Op. ETAR ${user.id_etar}`})
          </span>
          <NotificationBell 
            notifications={notifications} 
            onMarkAsRead={onMarkAsRead} 
            onMarkAllAsRead={onMarkAllAsRead} 
          />
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={onLogout}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      <main className="content-wrapper animate-fade-in" style={{ maxWidth: '600px' }}>
        
        {/* Menu de Ações Rápido */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button className={`btn ${activeView === 'scanner' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => { setActiveView('scanner'); setError(''); setSuccess(''); setQrInput(''); }}>
            <Camera size={16} /> Ler QR Code
          </button>
          <button className={`btn ${activeView === 'agendados' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => { setActiveView('agendados'); setError(''); setSuccess(''); }}>
            <Search size={16} /> Agendadas
          </button>
        </div>

        {error && <div className="card" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: '1rem', borderLeft: '5px solid var(--danger)' }}>{error}</div>}
        {success && <div className="card" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '1rem', borderLeft: '5px solid var(--success)' }}>{success}</div>}

        {/* 1. Scanner de QR Code (Visual) */}
        {activeView === 'scanner' && (
          <div className="card" style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>Validação na Entrada da ETAR</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Utilize a câmara do tablet/smartphone para ler o QR Code de descarga apresentado pelo motorista.
            </p>

            {/* Viewport de Scanner Animado (Simulação) */}
            <div className="scanner-viewport">
              <div className="scanner-line"></div>
              <Camera size={64} style={{ color: '#ffffff', opacity: 0.15, position: 'absolute', top: 'calc(50% - 32px)', left: 'calc(50% - 32px)' }} />
            </div>

            <form onSubmit={handleValidateQR}>
              <div className="form-group">
                <label className="form-label">Introduzir Token QR Manualmente (Simulador)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" className="form-input" placeholder="Ex: DESC-2026-XXXXXX" required value={qrInput} onChange={(e) => setQrInput(e.target.value.toUpperCase())} />
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'A ler...' : 'Validar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* 2. Ficha de Receção Física */}
        {activeView === 'receber' && validatedDescarga && (
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} style={{ color: 'var(--accent)' }} /> Ficha de Receção de Efluente
            </h3>

            {/* Informações Gerais da Guia */}
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
              <div style={{ marginBottom: '0.25rem' }}><strong>Cliente:</strong> {validatedDescarga.cliente_nome}</div>
              <div style={{ marginBottom: '0.25rem' }}><strong>Transportadora:</strong> {validatedDescarga.empresa_transportadora}</div>
              <div style={{ marginBottom: '0.25rem' }}><strong>Matrícula:</strong> {validatedDescarga.matricula_trator} {validatedDescarga.matricula_cisterna ? `| Cisterna: ${validatedDescarga.matricula_cisterna}` : ''}</div>
              <div style={{ marginBottom: '0.25rem' }}><strong>Tipo de Resíduo:</strong> {validatedDescarga.tipo_efluente}</div>
              <div><strong>Volume Autorizado:</strong> {validatedDescarga.quantidade} Litros</div>
            </div>

            <form onSubmit={handleConfirmRececao}>
              <div className="form-group">
                <label className="form-label">Volume Real Medido (Litros)</label>
                <input type="number" className="form-input" required value={rececaoData.quantidade_real} onChange={(e) => setRececaoData({ ...rececaoData, quantidade_real: e.target.value })} />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', padding: '1rem 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', margin: '1.5rem 0' }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.9rem' }}>Recolher Amostra de Efluente?</strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Obriga à recolha para triagem laboratorial.</span>
                </div>
                <input type="checkbox" style={{ width: '24px', height: '24px', cursor: 'pointer' }} checked={rececaoData.recolha_amostra} onChange={(e) => setRececaoData({ ...rececaoData, recolha_amostra: e.target.checked })} />
              </div>

              <div className="form-group">
                <label className="form-label">Observações da Carga (Opcional)</label>
                <textarea className="form-input" style={{ minHeight: '80px', resize: 'vertical' }} placeholder="Ex: Odor muito forte, espuma excessiva ou matrícula correta..." value={rececaoData.observacoes} onChange={(e) => setRececaoData({ ...rececaoData, observacoes: e.target.value })}></textarea>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'A processar...' : 'Finalizar Receção'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveView('scanner')}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 3. Ecrã de Sucesso e Instruções de Amostragem */}
        {activeView === 'sucesso' && rececaoResult && (
          <div className="card" style={{ textAlign: 'center', borderTop: '5px solid var(--success)' }}>
            <CheckCircle2 size={54} style={{ color: 'var(--success)', marginBottom: '1rem', display: 'inline-block' }} />
            <h3 style={{ color: 'var(--success)' }}>Receção Física Registada!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Os dados foram enviados com sucesso para o servidor de monitorização.
            </p>

            {rececaoResult.amostra ? (
              <div className="card" style={{ backgroundColor: 'var(--accent-light)', borderColor: 'var(--accent)', padding: '1rem', margin: '1rem 0' }}>
                <AlertTriangle size={24} style={{ color: 'var(--accent)', marginBottom: '0.5rem', display: 'inline-block' }} />
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.25rem' }}>Requer Recolha de Amostra</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '1rem' }}>
                  Retire uma amostra do efluente e rotule o frasco com o identificador único abaixo.
                </p>
                
                <div style={{ fontSize: '1.3rem', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '1px', padding: '0.5rem', backgroundColor: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'inline-block', marginBottom: '1rem' }}>
                  {rececaoResult.amostra.qr_code_token}
                </div>

                <div>
                  <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => alert('Imprimindo Etiqueta Térmica... Código QR do Frasco de Teste.')}>
                    <Printer size={16} /> Imprimir Etiqueta
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ backgroundColor: 'var(--success-light)', borderColor: 'var(--success)', padding: '1rem', margin: '1rem 0' }}>
                <h4 style={{ color: 'var(--success)', marginBottom: '0.25rem' }}>Sem Amostragem Requerida</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                  Não é necessário recolher amostra para esta descarga. O camião pode abandonar a ETAR.
                </p>
              </div>
            )}

            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => { setActiveView('scanner'); setValidatedDescarga(null); setRececaoResult(null); }}>
              Voltar ao Scanner
            </button>
          </div>
        )}

        {/* 4. Lista de Descargas Agendadas */}
        {activeView === 'agendados' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Descargas Agendadas para Hoje</h3>
            {loading ? (
              <p>A ler agendamentos...</p>
            ) : agendadasList.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Sem descargas agendadas para esta ETAR hoje.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Empresa / Matrícula</th>
                      <th>Volume</th>
                      <th>Token QR</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agendadasList.map((a) => (
                      <tr key={a.id_descarga}>
                        <td>
                          <strong>{a.cliente_nome}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {a.empresa_transportadora} ({a.matricula_trator})
                          </div>
                        </td>
                        <td>{a.quantidade} L</td>
                        <td><code style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{a.qr_code_token || `ID: ${a.id_descarga}`}</code></td>
                        <td>
                          <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }} onClick={() => { setQrInput(a.qr_code_token || a.id_descarga.toString()); handleValidateQR(null, a.qr_code_token || a.id_descarga.toString()); }}>
                            Receber
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
