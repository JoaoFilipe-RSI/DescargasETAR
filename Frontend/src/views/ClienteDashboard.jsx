import React, { useState, useEffect } from 'react';
import { descargaService, amostraService } from '../services/api';
import { webSocketService } from '../services/websocket';
import { QRCodeSVG } from 'qrcode.react';
import { PlusCircle, Calendar, ShieldCheck, Download, LogOut, Clock, Truck, Eye, Settings } from 'lucide-react';
import NotificationBell from '../components/NotificationBell';

export default function ClienteDashboard({ user, onLogout, notifications, onMarkAsRead, onMarkAllAsRead, onChangePassword }) {
  const [activeTab, setActiveTab] = useState('pedidos');
  const [descargas, setDescargas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form para nova descarga
  const [newDescarga, setNewDescarga] = useState({
    id_etar: '1',
    tipo_efluente: 'Industrial',
    quantidade: '',
    numero_recipientes: '',
    nome_produtor_externo: '',
    morada_produtor_externo: ''
  });

  // Modal de Agendamento
  const [selectedDescarga, setSelectedDescarga] = useState(null);
  const [schedulingData, setSchedulingData] = useState({
    empresa_transportadora: '',
    matricula_trator: '',
    matricula_cisterna: ''
  });

  // Carregar dados de descargas do cliente
  const loadDescargas = async () => {
    setLoading(true);
    try {
      const data = await descargaService.obterDescargas();
      setDescargas(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao carregar descargas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDescargas();
  }, [activeTab]);

  // Escutar atualizações via WebSockets em tempo real
  useEffect(() => {
    const handleDecisao = (data) => {
      setSuccess(data.mensagem);
      loadDescargas();
    };

    const handleBoletim = (data) => {
      setSuccess(data.mensagem);
      loadDescargas();
    };

    webSocketService.on('decisao-pedido', handleDecisao);
    webSocketService.on('boletim-disponivel', handleBoletim);

    return () => {
      webSocketService.off('decisao-pedido', handleDecisao);
      webSocketService.off('boletim-disponivel', handleBoletim);
    };
  }, []);

  // Criar Pedido
  const handleCreatePedido = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const isTransportador = user?.nome?.toLowerCase().includes('transportador');

    // Validar produtor externo obrigatório se for transportador
    if (isTransportador) {
      if (!newDescarga.nome_produtor_externo?.trim() || !newDescarga.morada_produtor_externo?.trim()) {
        setError('A informação do produtor externo (Nome e Morada) é obrigatória para clientes transportadores.');
        return;
      }
    }

    try {
      const payload = {
        id_etar: parseInt(newDescarga.id_etar, 10),
        tipo_efluente: newDescarga.tipo_efluente,
        quantidade: parseFloat(newDescarga.quantidade),
        numero_recipientes: newDescarga.numero_recipientes ? parseInt(newDescarga.numero_recipientes, 10) : null,
        nome_produtor_externo: isTransportador ? newDescarga.nome_produtor_externo.trim() : null,
        morada_produtor_externo: isTransportador ? newDescarga.morada_produtor_externo.trim() : null
      };

      const res = await descargaService.criarPedido(payload);
      setSuccess(res.mensagem);
      setNewDescarga({
        id_etar: '1',
        tipo_efluente: 'Industrial',
        quantidade: '',
        numero_recipientes: '',
        nome_produtor_externo: '',
        morada_produtor_externo: ''
      });
      setActiveTab('pedidos');
    } catch (err) {
      setError(err.message || 'Erro ao criar pedido de descarga.');
    }
  };

  // Submeter Agendamento
  const handleSchedule = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await descargaService.agendarDescarga(selectedDescarga.id_descarga, schedulingData);
      setSuccess('Descarga agendada e QR Code gerado!');
      setSelectedDescarga(null);
      setSchedulingData({ empresa_transportadora: '', matricula_trator: '', matricula_cisterna: '' });
      loadDescargas();
    } catch (err) {
      setError(err.message || 'Erro ao agendar descarga.');
    }
  };

  // Descarregar PDF do Boletim Analítico
  const handleDownloadBoletim = async (idDescarga) => {
    setError('');
    try {
      // Obter amostra concluída correspondente à descarga
      const amostras = await amostraService.obterAmostras({ estado: 'CONCLUIDA' });
      const amostra = amostras.find(a => a.id_descarga === idDescarga);

      if (!amostra) {
        throw new Error('Nenhum Boletim Analítico validado para esta descarga.');
      }

      await amostraService.descarregarBoletimPDF(amostra.id_amostra, amostra.qr_code_token);
    } catch (err) {
      setError(err.message || 'Erro ao efetuar download do Boletim.');
    }
  };

  // Abrir PDF da Ficha de Descarga
  const handleAbrirFicha = async (idDescarga) => {
    setError('');
    try {
      await descargaService.abrirFichaPDF(idDescarga);
    } catch (err) {
      setError(err.message || 'Erro ao abrir a Ficha de Descarga.');
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
            Olá, <strong>{user.nome}</strong> (Cliente)
          </span>
          <NotificationBell
            notifications={notifications}
            onMarkAsRead={onMarkAsRead}
            onMarkAllAsRead={onMarkAllAsRead}
          />
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onChangePassword}>
            <Settings size={16} /> Configurações
          </button>
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={onLogout}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      <main className="content-wrapper animate-fade-in">
        <div className="dashboard-header">
          <div>
            <h2>Portal do Produtor/Cliente</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Crie pedidos, agende veículos e consulte boletins analíticos das ETARs.</p>
          </div>
        </div>

        {error && <div className="card" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: '1rem', borderLeft: '5px solid var(--danger)' }}>{error}</div>}
        {success && <div className="card" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '1rem', borderLeft: '5px solid var(--success)' }}>{success}</div>}

        {/* Navegação de Abas */}
        <div className="tabs-nav">
          <button className={`tab-btn ${activeTab === 'pedidos' ? 'active' : ''}`} onClick={() => setActiveTab('pedidos')}>
            <Clock size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Os meus Pedidos
          </button>
          <button className={`tab-btn ${activeTab === 'criar' ? 'active' : ''}`} onClick={() => setActiveTab('criar')}>
            <PlusCircle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Novo Pedido
          </button>
        </div>

        {/* Tab 1: Listagem e Agendamento */}
        {activeTab === 'pedidos' && (
          <div>
            {loading ? (
              <p>A carregar registos...</p>
            ) : descargas.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <Calendar size={48} style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }} />
                <h3>Sem descargas registadas</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Ainda não fez nenhum pedido de descarga no sistema.</p>
                <button className="btn btn-primary" onClick={() => setActiveTab('criar')}>Criar o primeiro pedido</button>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ref/Data</th>
                      <th>ETAR</th>
                      <th>Efluente</th>
                      <th>Qtd (L)</th>
                      <th>Estado</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {descargas.map((d) => (
                      <tr key={d.id_descarga}>
                        <td>
                          <strong>#{d.id_descarga}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {new Date(d.data_pedido).toLocaleDateString()}
                          </div>
                        </td>
                        <td>{d.etar_nome || `ETAR ${d.id_etar}`}</td>
                        <td>{d.tipo_efluente}</td>
                        <td>{d.quantidade} L</td>
                        <td>
                          <span className={`badge badge-${d.estado_descarga === 'RECEBIDA' ? 'concluida' : d.estado_descarga.toLowerCase()}`}>
                            {d.estado_descarga === 'RECEBIDA' ? 'CONCLUIDA' : d.estado_descarga}
                          </span>
                        </td>
                        <td>
                          {d.estado_descarga === 'AUTORIZADA' && (
                            <button className="btn btn-primary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setSelectedDescarga(d)}>
                              <Truck size={14} /> Agendar
                            </button>
                          )}
                          {d.estado_descarga === 'AGENDADA' && d.qr_code_token && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>{d.qr_code_token}</span>
                                <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setSelectedDescarga(d)}>
                                  Ver QR
                                </button>
                              </div>
                              {d.observacoes && d.observacoes.includes('ALERTA OPERACIONAL') && (
                                <div style={{ 
                                  fontSize: '0.7rem', 
                                  color: 'var(--danger)', 
                                  backgroundColor: 'var(--danger-light)', 
                                  padding: '0.25rem 0.5rem', 
                                  borderRadius: 'var(--radius-sm)', 
                                  border: '1px solid var(--danger)', 
                                  maxWidth: '220px',
                                  marginTop: '0.25rem',
                                  lineHeight: '1.2'
                                }}>
                                  ⚠️ <strong>Aviso Importante:</strong> A ETAR de destino tem restrições de emergência. Aguarde contacto.
                                </div>
                              )}
                            </div>
                          )}
                          {(d.estado_descarga === 'CONCLUIDA' || d.estado_descarga === 'RECEBIDA') && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <button
                                className="btn btn-primary"
                                style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', backgroundColor: 'var(--success)' }}
                                onClick={() => handleAbrirFicha(d.id_descarga)}
                              >
                                <Eye size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Ver Ficha
                              </button>
                              {d.id_amostra && d.boletim_publico && (
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', backgroundColor: 'var(--success)' }}
                                  onClick={() => handleDownloadBoletim(d.id_descarga)}
                                >
                                  <Download size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Boletim
                                </button>
                              )}
                            </div>
                          )}
                          {d.estado_descarga === 'SOLICITADA' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>A aguardar aprovação</span>
                              {d.observacoes && (
                                <div style={{ 
                                  fontSize: '0.75rem', 
                                  color: d.observacoes.includes('Revertido') ? 'var(--danger)' : 'var(--warning)', 
                                  backgroundColor: d.observacoes.includes('Revertido') ? 'var(--danger-light)' : 'var(--warning-light)', 
                                  padding: '0.25rem 0.5rem', 
                                  borderRadius: 'var(--radius-sm)', 
                                  border: d.observacoes.includes('Revertido') ? '1px solid var(--danger)' : '1px solid var(--warning)', 
                                  maxWidth: '220px', 
                                  wordBreak: 'break-word',
                                  marginTop: '0.25rem'
                                }}>
                                  <strong>{d.observacoes.includes('Revertido') ? 'Aviso:' : 'Elementos em falta:'}</strong> {d.observacoes}
                                </div>
                              )}
                            </div>
                          )}
                          {d.estado_descarga === 'REJEITADA' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 600 }}>Descarga rejeitada</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Formulário de Nova Descarga */}
        {activeTab === 'criar' && (
          <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Submeter Pedido de Descarga</h3>
            <form onSubmit={handleCreatePedido}>
              <div className="form-group">
                <label className="form-label">Selecione a ETAR</label>
                <select className="form-input" value={newDescarga.id_etar} onChange={(e) => setNewDescarga({ ...newDescarga, id_etar: e.target.value })}>
                  <option value="1">ETAR Norte (Porto)</option>
                  <option value="2">ETAR Centro (Coimbra)</option>
                  <option value="3">ETAR Sul (Lisboa)</option>
                  <option value="4">ETAR Algarve (Faro) - Em Manutenção</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Efluente</label>
                <select className="form-input" value={newDescarga.tipo_efluente} onChange={(e) => setNewDescarga({ ...newDescarga, tipo_efluente: e.target.value })}>
                  <option value="Industrial">Industrial</option>
                  <option value="Domestico">Doméstico / Fossa Séptica</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Volume Estimado (Litros)</label>
                <input type="number" className="form-input" placeholder="Ex: 8000" required value={newDescarga.quantidade} onChange={(e) => setNewDescarga({ ...newDescarga, quantidade: e.target.value })} />
              </div>

              <div className="form-group">
                <label className="form-label">Número de Recipientes (Opcional)</label>
                <input type="number" className="form-input" placeholder="Ex: 1" value={newDescarga.numero_recipientes} onChange={(e) => setNewDescarga({ ...newDescarga, numero_recipientes: e.target.value })} />
              </div>

              {user?.nome?.toLowerCase().includes('transportador') && (
                <div style={{ borderTop: '1px solid var(--border)', margin: '1.5rem 0', paddingTop: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Informação do Produtor Externo *</h4>
                  <div className="form-group">
                    <label className="form-label">Nome do Produtor *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ex: Lavandaria Sol Lda" 
                      required 
                      value={newDescarga.nome_produtor_externo} 
                      onChange={(e) => setNewDescarga({ ...newDescarga, nome_produtor_externo: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Morada do Produtor *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ex: Zona Industrial Maia" 
                      required 
                      value={newDescarga.morada_produtor_externo} 
                      onChange={(e) => setNewDescarga({ ...newDescarga, morada_produtor_externo: e.target.value })} 
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Submeter Pedido</button>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('pedidos')}>Cancelar</button>
              </div>
            </form>
          </div>
        )}

        {/* Modal / Visualizador de Agendamento ou Exibição de QR Code */}
        {selectedDescarga && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '480px', marginBottom: 0, overflowY: 'auto', maxHeight: '90vh' }}>
              <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>
                  {selectedDescarga.estado_descarga === 'AUTORIZADA' ? 'Agendar Camião Cisterna' : 'Guia Digital / QR Code'}
                </h3>
              </div>

              {selectedDescarga.estado_descarga === 'AUTORIZADA' ? (
                <form onSubmit={handleSchedule}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Indique os dados logísticos do veículo que irá efetuar a descarga na <strong>{selectedDescarga.etar_nome || `ETAR ${selectedDescarga.id_etar}`}</strong>.
                  </p>
                  <div className="form-group">
                    <label className="form-label">Empresa Transportadora</label>
                    <input type="text" className="form-input" placeholder="Ex: TransEfluentes Lda" required value={schedulingData.empresa_transportadora} onChange={(e) => setSchedulingData({ ...schedulingData, empresa_transportadora: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Matrícula do Trator/Camião</label>
                    <input type="text" className="form-input" placeholder="Ex: AA-00-AA" required value={schedulingData.matricula_trator} onChange={(e) => setSchedulingData({ ...schedulingData, matricula_trator: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Matrícula da Cisterna (Opcional)</label>
                    <input type="text" className="form-input" placeholder="Ex: BB-11-BB" value={schedulingData.matricula_cisterna} onChange={(e) => setSchedulingData({ ...schedulingData, matricula_cisterna: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirmar Agendamento</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setSelectedDescarga(null)}>Fechar</button>
                  </div>
                </form>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Apresente este código QR ao portão da <strong>{selectedDescarga.etar_nome}</strong> para validação de entrada do veículo.
                  </p>

                  <div className="qr-container" style={{ margin: '1rem 0' }}>
                    <div className="qr-code-box">
                      <QRCodeSVG value={selectedDescarga.qr_code_token} size={200} />
                    </div>
                    <span style={{ fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {selectedDescarga.qr_code_token}
                    </span>
                  </div>

                  <div style={{ textAlign: 'left', fontSize: '0.85rem', backgroundColor: 'var(--bg-base)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                    <strong>Dados do Agendamento:</strong>
                    <div>Transportadora: {selectedDescarga.empresa_transportadora}</div>
                    <div>Veículo: Trator {selectedDescarga.matricula_trator} {selectedDescarga.matricula_cisterna ? `| Cisterna ${selectedDescarga.matricula_cisterna}` : ''}</div>
                    <div>Volume Autorizado: {selectedDescarga.quantidade} Litros</div>
                  </div>

                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setSelectedDescarga(null)}>Fechar</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
