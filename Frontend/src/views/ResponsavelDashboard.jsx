import React, { useState, useEffect } from 'react';
import { amostraService, descargaService } from '../services/api';
import { ShieldCheck, ClipboardList, CheckSquare, XSquare, Download, LogOut, FileText } from 'lucide-react';

export default function ResponsavelDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState(
    user.perfil === 'GESTOR_CLIENTES' ? 'decisoes' : 'validacoes'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Estados do Gestor de Clientes
  const [solicitadas, setSolicitadas] = useState([]);
  const [decisaoObs, setDecisaoObs] = useState('');
  const [selectedDescarga, setSelectedDescarga] = useState(null);

  // Estados do Responsável de Laboratório/ETAR
  const [analisadas, setAnalisadas] = useState([]);
  const [concluidas, setConcluidas] = useState([]);
  const [selectedAmostra, setSelectedAmostra] = useState(null);

  // Carregar dados conforme perfil
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (user.perfil === 'GESTOR_CLIENTES') {
        const data = await descargaService.obterDescargas({ estado: 'SOLICITADA' });
        setSolicitadas(data);
      } else {
        // Responsável de Lab/ETAR
        const dataAnal = await amostraService.obterAmostras({ estado: 'ANALISADA' });
        setAnalisadas(dataAnal);
        const dataConc = await amostraService.obterAmostras({ estado: 'CONCLUIDA' });
        setConcluidas(dataConc);
      }
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Gestor de Clientes: Registar Decisão Manual (Aprovar / Rejeitar)
  const handleDecisao = async (decisao) => {
    setError('');
    setSuccess('');
    try {
      await descargaService.registarDecisao(selectedDescarga.id_descarga, decisao, decisaoObs);
      setSuccess(`Descarga #${selectedDescarga.id_descarga} foi ${decisao.toLowerCase()} com sucesso!`);
      setSelectedDescarga(null);
      setDecisaoObs('');
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao registar decisão.');
    }
  };

  // Responsável de Lab: Validar Amostra
  const handleValidarAmostra = async (amostraId) => {
    setError('');
    setSuccess('');
    try {
      await amostraService.validarAmostra(amostraId);
      setSuccess('Boletim Analítico validado e carimbado digitalmente com sucesso!');
      setSelectedAmostra(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao validar amostra.');
    }
  };

  // Descarregar PDF
  const handleDownloadBoletim = async (amostra) => {
    setError('');
    try {
      await amostraService.descarregarBoletimPDF(amostra.id_amostra, amostra.qr_code_token);
    } catch (err) {
      setError(err.message || 'Erro ao descarregar Boletim.');
    }
  };

  // Carregar os resultados de uma amostra antes de abrir o modal de validação
  const handleOpenValidacao = async (amostra) => {
    setError('');
    try {
      const details = await amostraService.obterDetalhesAmostra(amostra.id_amostra);
      setSelectedAmostra(details);
    } catch (err) {
      setError('Erro ao carregar parâmetros da amostra.');
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
            Olá, <strong>{user.nome}</strong> ({user.perfil.replace('_', ' ')})
          </span>
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={onLogout}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      <main className="content-wrapper animate-fade-in">
        <div className="dashboard-header">
          <div>
            <h2>Painel de Gestão e Decisão</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Valide análises laboratoriais e tome decisões de whitelists ou quotas.</p>
          </div>
        </div>

        {error && <div className="card" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: '1rem', borderLeft: '5px solid var(--danger)' }}>{error}</div>}
        {success && <div className="card" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '1rem', borderLeft: '5px solid var(--success)' }}>{success}</div>}

        {/* 1. SE FOR GESTOR DE CLIENTES */}
        {user.perfil === 'GESTOR_CLIENTES' && (
          <div>
            <div className="tabs-nav">
              <button className="tab-btn active">Pedidos Pendentes</button>
            </div>

            {loading ? (
              <p>A ler dados...</p>
            ) : solicitadas.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
                <ShieldCheck size={48} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
                <h3>Sem pendentes</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Não existem pedidos de descarga a aguardar decisão manual.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ref/Data</th>
                      <th>Cliente</th>
                      <th>ETAR Destino</th>
                      <th>Efluente</th>
                      <th>Qtd (L)</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitadas.map((d) => (
                      <tr key={d.id_descarga}>
                        <td>
                          <strong>#{d.id_descarga}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {new Date(d.data_pedido).toLocaleDateString()}
                          </div>
                        </td>
                        <td>{d.cliente_nome}</td>
                        <td>{d.etar_nome || `ETAR ${d.id_etar}`}</td>
                        <td>{d.tipo_efluente}</td>
                        <td>{d.quantidade} L</td>
                        <td>
                          <button className="btn btn-primary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setSelectedDescarga(d)}>
                            Decidir
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

        {/* 2. SE FOR RESPONSÁVEL DE LAB / ETAR */}
        {(user.perfil === 'RESPONSAVEL_LAB' || user.perfil === 'RESPONSAVEL_ETAR') && (
          <div>
            <div className="tabs-nav">
              <button className={`tab-btn ${activeTab === 'validacoes' ? 'active' : ''}`} onClick={() => setActiveTab('validacoes')}>
                Amostras Analisadas ({analisadas.length})
              </button>
              <button className={`tab-btn ${activeTab === 'concluidas' ? 'active' : ''}`} onClick={() => setActiveTab('concluidas')}>
                Boletins Concluídos
              </button>
            </div>

            {loading ? (
              <p>A carregar registos...</p>
            ) : activeTab === 'validacoes' ? (
              analisadas.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3.5rem' }}>
                  <ShieldCheck size={48} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
                  <h3>Sem análises pendentes</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>Todos os ensaios de bancada foram validados e finalizados.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Ref. Amostra</th>
                        <th>Cliente</th>
                        <th>ETAR Origem</th>
                        <th>Data Conclusão Ensaios</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analisadas.map((am) => (
                        <tr key={am.id_amostra}>
                          <td><strong>{am.qr_code_token}</strong></td>
                          <td>{am.cliente_nome}</td>
                          <td>{am.etar_nome}</td>
                          <td>{new Date(am.data_fim_analise).toLocaleString()}</td>
                          <td>
                            <button className="btn btn-primary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => handleOpenValidacao(am)}>
                              Validar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : concluidas.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Sem boletins concluídos em arquivo.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ref. Amostra</th>
                      <th>Cliente</th>
                      <th>ETAR</th>
                      <th>Data Conclusão</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {concluidas.map((am) => (
                      <tr key={am.id_amostra}>
                        <td><strong>{am.qr_code_token}</strong></td>
                        <td>{am.cliente_nome}</td>
                        <td>{am.etar_nome}</td>
                        <td>{new Date(am.data_validacao).toLocaleDateString()}</td>
                        <td>
                          <button className="btn btn-primary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', backgroundColor: 'var(--success)' }} onClick={() => handleDownloadBoletim(am)}>
                            <Download size={14} /> Boletim PDF
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

        {/* Modal de Decisão (Gestor de Clientes) */}
        {selectedDescarga && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div className="card" style={{ width: '100%', maxWidth: '480px', marginBottom: 0 }}>
              <h3>Decidir Pedido de Descarga</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.5rem 0 1.5rem 0' }}>
                Aprove ou rejeite o pedido da <strong>{selectedDescarga.cliente_nome}</strong> para a <strong>{selectedDescarga.etar_nome}</strong> (Qtd: {selectedDescarga.quantidade} Litros).
              </p>
              
              <div className="form-group">
                <label className="form-label">Justificação / Observações (Opcional)</label>
                <textarea className="form-input" style={{ minHeight: '80px', resize: 'vertical' }} placeholder="Indique o motivo da decisão..." value={decisaoObs} onChange={(e) => setDecisaoObs(e.target.value)}></textarea>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--success)' }} onClick={() => handleDecisao('AUTORIZADA')}>
                  <CheckSquare size={16} /> Autorizar
                </button>
                <button className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--danger)' }} onClick={() => handleDecisao('REJEITADA')}>
                  <XSquare size={16} /> Rejeitar
                </button>
                <button className="btn btn-secondary" onClick={() => setSelectedDescarga(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Validação (Responsável Laboratório) */}
        {selectedAmostra && selectedAmostra.amostra && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '520px', marginBottom: 0, overflowY: 'auto', maxHeight: '90vh' }}>
              <h3>Validar Boletim Analítico</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Revise os resultados laboratoriais registados para a amostra <strong>{selectedAmostra.amostra.qr_code_token}</strong>.
              </p>

              <div style={{ backgroundColor: 'var(--bg-base)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                <strong>Detalhes:</strong>
                <div>Cliente: {selectedAmostra.amostra.cliente_nome}</div>
                <div>Volume Real: {selectedAmostra.amostra.quantidade_real} Litros</div>
              </div>

              <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parâmetro</th>
                      <th>Valor Medido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAmostra.resultados.map((r) => (
                      <tr key={r.id_resultado}>
                        <td>{r.parametro_nome}</td>
                        <td>
                          <strong>{Number(r.valor).toFixed(2)}</strong> {r.unidade}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{r.metodo}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button className="btn btn-primary" style={{ flex: 1, backgroundColor: 'var(--success)' }} onClick={() => handleValidarAmostra(selectedAmostra.amostra.id_amostra)}>
                  <ShieldCheck size={16} /> Validar e Assinar Boletim
                </button>
                <button className="btn btn-secondary" onClick={() => setSelectedAmostra(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
