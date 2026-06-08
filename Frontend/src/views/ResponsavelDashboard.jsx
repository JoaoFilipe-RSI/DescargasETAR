import React, { useState, useEffect } from 'react';
import { amostraService, descargaService, adminService } from '../services/api';
import { ShieldCheck, ClipboardList, CheckSquare, XSquare, Download, LogOut, FileText, ToggleLeft, ToggleRight, Settings, PlusCircle, Check, X, HelpCircle } from 'lucide-react';
import { webSocketService } from '../services/websocket';
import NotificationBell from '../components/NotificationBell';

export default function ResponsavelDashboard({ user, onLogout, notifications, onMarkAsRead, onMarkAllAsRead }) {
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

  // Estados de Administração (Novo)
  const [clientesList, setClientesList] = useState([]);
  const [etarsList, setEtarsList] = useState([]);
  const [autorizacoesList, setAutorizacoesList] = useState([]);
  const [parametrosList, setParametrosList] = useState([]);
  const [descargasConcluidas, setDescargasConcluidas] = useState([]);
  const [amostrasConcluidas, setAmostrasConcluidas] = useState([]);

  // Estados para o novo separador de Relatórios
  const [relatoriosData, setRelatoriosData] = useState([]);
  const [filtroCliente, setFiltroCliente] = useState('all');
  const [filtroEtar, setFiltroEtar] = useState('all');
  const [filtroMes, setFiltroMes] = useState('all');
  const [filtroAno, setFiltroAno] = useState('all');
  const [filtroEstado, setFiltroEstado] = useState('all');

  // Modais de Criação
  const [showAddCliente, setShowAddCliente] = useState(false);
  const [showAddAutorizacao, setShowAddAutorizacao] = useState(false);
  const [editingAutorizacaoId, setEditingAutorizacaoId] = useState(null);

  // Estados de Formulário
  const [newClienteData, setNewClienteData] = useState({
    nome: '',
    morada: '',
    contacto: '',
    telefone: '',
    email: '',
    password: '',
    periodicidade_analise: 'POR_DESCARGA'
  });

  const [newAutorizacaoData, setNewAutorizacaoData] = useState({
    id_cliente: '',
    id_etar: '',
    quota: '5',
    auto_aprovacao: true
  });

  const [selectedConfigClient, setSelectedConfigClient] = useState('');
  const [activeParams, setActiveParams] = useState([]);

  // Carregar dados conforme perfil e tab ativa
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      if (user.perfil === 'GESTOR_CLIENTES') {
        if (activeTab === 'decisoes') {
          const data = await descargaService.obterDescargas({ estado: 'SOLICITADA' });
          setSolicitadas(data);
        } else if (activeTab === 'clientes') {
          const data = await adminService.obterClientes();
          setClientesList(data);
        } else if (activeTab === 'autorizacoes') {
          const auts = await adminService.obterAutorizacoes();
          setAutorizacoesList(auts);
          const cls = await adminService.obterClientes();
          setClientesList(cls);
          const ets = await adminService.obterEtars();
          setEtarsList(ets);
          const params = await adminService.obterParametros();
          setParametrosList(params);
        } else if (activeTab === 'etars') {
          const ets = await adminService.obterEtars();
          setEtarsList(ets);
        } else if (activeTab === 'historicoDescargas') {
          const data = await descargaService.obterDescargas({ estado: 'CONCLUIDA' });
          setDescargasConcluidas(data);
        } else if (activeTab === 'historicoAmostras') {
          const data = await amostraService.obterAmostras({ estado: 'CONCLUIDA' });
          setAmostrasConcluidas(data);
        } else if (activeTab === 'relatorios') {
          const cls = await adminService.obterClientes();
          setClientesList(cls);
          const ets = await adminService.obterEtars();
          setEtarsList(ets);
        }
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

  // Carregar os relatórios consolidados do Gestor com base nos filtros
  const loadRelatorios = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminService.obterRelatorios({
        id_cliente: filtroCliente,
        id_etar: filtroEtar,
        mes: filtroMes,
        ano: filtroAno,
        estado: filtroEstado
      });
      setRelatoriosData(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar relatórios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'relatorios') {
      loadRelatorios();
    }
  }, [filtroCliente, filtroEtar, filtroMes, filtroAno, filtroEstado, activeTab]);

  // Carregar parâmetros contratuais do cliente selecionado
  useEffect(() => {
    if (selectedConfigClient) {
      const loadClientParams = async () => {
        try {
          const activeIds = await adminService.obterParametrosCliente(selectedConfigClient);
          setActiveParams(activeIds);
        } catch (err) {
          setError('Erro ao obter parâmetros do cliente selecionado.');
        }
      };
      loadClientParams();
    } else {
      setActiveParams([]);
    }
  }, [selectedConfigClient]);

  // Gestor de Clientes: Criar Cliente e Utilizador
  const handleCreateCliente = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await adminService.criarCliente(newClienteData);
      setSuccess('Novo cliente contratualizado e credenciais de utilizador criadas com sucesso!');
      setShowAddCliente(false);
      setNewClienteData({
        nome: '',
        morada: '',
        contacto: '',
        telefone: '',
        email: '',
        password: '',
        periodicidade_analise: 'POR_DESCARGA'
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao registar novo cliente.');
    }
  };

  // Gestor de Clientes: Criar/Editar Regra de Whitelist (Autorização)
  const handleSaveAutorizacao = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingAutorizacaoId) {
        const currentAut = autorizacoesList.find(a => a.id_autorizacao === editingAutorizacaoId);
        const activeState = currentAut ? currentAut.ativo : true;

        await adminService.atualizarAutorizacao(editingAutorizacaoId, {
          quota: newAutorizacaoData.quota,
          auto_aprovacao: newAutorizacaoData.auto_aprovacao,
          ativo: activeState
        });
        setSuccess('Regra de whitelist atualizada com sucesso!');
      } else {
        await adminService.criarAutorizacao(newAutorizacaoData);
        setSuccess('Nova regra de whitelist registada com sucesso!');
      }
      setShowAddAutorizacao(false);
      setEditingAutorizacaoId(null);
      setNewAutorizacaoData({
        id_cliente: '',
        id_etar: '',
        quota: '5',
        auto_aprovacao: true
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao processar regra de whitelist.');
    }
  };

  // Gestor de Clientes: Alternar Estado Ativo da Whitelist
  const handleToggleAutorizacaoStatus = async (aut) => {
    setError('');
    setSuccess('');
    try {
      await adminService.atualizarAutorizacao(aut.id_autorizacao, {
        quota: aut.quota,
        auto_aprovacao: aut.auto_aprovacao,
        ativo: !aut.ativo
      });
      setSuccess(`Estado da whitelist atualizado para ${!aut.ativo ? 'ativo' : 'inativo'} com sucesso!`);
      loadData();
    } catch (err) {
      setError('Erro ao alternar o estado da whitelist.');
    }
  };

  // Gestor de Clientes: Alternar Disponibilidade da ETAR (Contingência)
  const handleToggleEtarAvailability = async (id, currentAvailability) => {
    setError('');
    setSuccess('');
    try {
      await adminService.atualizarDisponibilidadeEtar(id, !currentAvailability);
      setSuccess(`Estado da ETAR atualizado para ${!currentAvailability ? 'disponível' : 'indisponível'}!`);
      loadData();
    } catch (err) {
      setError('Erro ao atualizar disponibilidade da ETAR.');
    }
  };

  // Gestor de Clientes: Gravar Parâmetros Contratuais
  const handleUpdateClientParams = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await adminService.atualizarParametrosCliente(selectedConfigClient, activeParams);
      setSuccess('Parâmetros analíticos contratuais gravados com sucesso!');
    } catch (err) {
      setError('Erro ao gravar parâmetros contratuais.');
    }
  };

  const handleToggleParamCheckbox = (paramId) => {
    if (activeParams.includes(paramId)) {
      setActiveParams(activeParams.filter(id => id !== paramId));
    } else {
      setActiveParams([...activeParams, paramId]);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Escutar eventos WebSocket em tempo real baseados no perfil
  useEffect(() => {
    if (user.perfil === 'GESTOR_CLIENTES') {
      const handleNovoPedido = (data) => {
        setSuccess(`Novo pedido de descarga pendente: Descarga #${data.id_descarga} (${data.cliente_nome} - ${data.quantidade}L).`);
        loadData();
      };
      const handleDescargaConcluida = (data) => {
        setSuccess(data.mensagem || `Receção efetuada: Descarga #${data.id_descarga} concluída.`);
        loadData();
      };
      const handleAmostraConcluida = (data) => {
        setSuccess(data.mensagem || `Resultados validados: amostra #${data.id_amostra} concluída.`);
        loadData();
      };

      webSocketService.on('novo-pedido', handleNovoPedido);
      webSocketService.on('descarga-concluida', handleDescargaConcluida);
      webSocketService.on('amostra-concluida', handleAmostraConcluida);

      return () => {
        webSocketService.off('novo-pedido', handleNovoPedido);
        webSocketService.off('descarga-concluida', handleDescargaConcluida);
        webSocketService.off('amostra-concluida', handleAmostraConcluida);
      };
    } else if (user.perfil === 'RESPONSAVEL_LAB' || user.perfil === 'RESPONSAVEL_ETAR') {
      const handleNovaAmostra = (data) => {
        setSuccess(`Nova amostra recolhida na ETAR: ${data.qr_code_token} (Descarga #${data.id_descarga}).`);
        loadData();
      };
      const handleAmostraAnalisada = (data) => {
        setSuccess(`Resultados laboratoriais prontos para validação: Amostra ${data.qr_code_token} (Descarga #${data.id_descarga}).`);
        loadData();
      };

      webSocketService.on('nova-amostra', handleNovaAmostra);
      webSocketService.on('amostra-analisada', handleAmostraAnalisada);

      return () => {
        webSocketService.off('nova-amostra', handleNovaAmostra);
        webSocketService.off('amostra-analisada', handleAmostraAnalisada);
      };
    }
  }, [user.perfil]);

  // Gestor de Clientes: Registar Decisão Manual (Aprovar / Rejeitar / Solicitar Elementos)
  const handleDecisao = async (decisao) => {
    setError('');
    setSuccess('');
    try {
      await descargaService.registarDecisao(selectedDescarga.id_descarga, decisao, decisaoObs);
      let acaoTexto = '';
      if (decisao === 'SOLICITAR_ELEMENTOS') {
        acaoTexto = 'colocada em falta de elementos';
      } else if (decisao === 'AUTORIZADA') {
        acaoTexto = 'autorizada';
      } else {
        acaoTexto = 'rejeitada';
      }
      setSuccess(`Descarga #${selectedDescarga.id_descarga} foi ${acaoTexto} com sucesso!`);
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

  // Disponibilizar Boletim Analítico ao Cliente
  const handleDisponibilizarBoletim = async (amostraId) => {
    setError('');
    setSuccess('');
    try {
      await amostraService.disponibilizarBoletim(amostraId);
      setSuccess('Boletim Analítico disponibilizado para o cliente com sucesso!');
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao disponibilizar Boletim.');
    }
  };

  // Abrir PDF da Ficha de Descarga
  const handleAbrirFichaDescarga = async (idDescarga) => {
    setError('');
    try {
      await descargaService.abrirFichaPDF(idDescarga);
    } catch (err) {
      setError(err.message || 'Erro ao abrir a Ficha de Descarga.');
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

      <main className="content-wrapper animate-fade-in" style={{ maxWidth: '1400px' }}>
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
              <button className={`tab-btn ${activeTab === 'decisoes' ? 'active' : ''}`} onClick={() => { setActiveTab('decisoes'); setError(''); setSuccess(''); }}>
                Pedidos Pendentes
              </button>
              <button className={`tab-btn ${activeTab === 'clientes' ? 'active' : ''}`} onClick={() => { setActiveTab('clientes'); setError(''); setSuccess(''); }}>
                Clientes
              </button>
              <button className={`tab-btn ${activeTab === 'autorizacoes' ? 'active' : ''}`} onClick={() => { setActiveTab('autorizacoes'); setError(''); setSuccess(''); }}>
                Whitelists e Quotas
              </button>
              <button className={`tab-btn ${activeTab === 'etars' ? 'active' : ''}`} onClick={() => { setActiveTab('etars'); setError(''); setSuccess(''); }}>
                Disponibilidade ETARs
              </button>
              <button className={`tab-btn ${activeTab === 'historicoDescargas' ? 'active' : ''}`} onClick={() => { setActiveTab('historicoDescargas'); setError(''); setSuccess(''); }}>
                Descargas Concluídas
              </button>
              <button className={`tab-btn ${activeTab === 'historicoAmostras' ? 'active' : ''}`} onClick={() => { setActiveTab('historicoAmostras'); setError(''); setSuccess(''); }}>
                Boletins Analíticos
              </button>
              <button className={`tab-btn ${activeTab === 'relatorios' ? 'active' : ''}`} onClick={() => { setActiveTab('relatorios'); setError(''); setSuccess(''); }}>
                Relatórios Consolidados
              </button>
            </div>

            {/* TAB: PEDIDOS PENDENTES DE DECISÃO */}
            {activeTab === 'decisoes' && (
              <div>
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

            {/* TAB: GESTÃO DE CLIENTES CONTRATUALIZADOS */}
            {activeTab === 'clientes' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3>Clientes Contratualizados</h3>
                  <button className="btn btn-primary" onClick={() => setShowAddCliente(true)}>
                    <PlusCircle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Adicionar Cliente
                  </button>
                </div>
                {loading ? (
                  <p>A carregar clientes...</p>
                ) : clientesList.length === 0 ? (
                  <p>Não existem clientes registados no sistema.</p>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ref</th>
                          <th>Nome</th>
                          <th>Email</th>
                          <th>Periodicidade Análise</th>
                          <th>Contacto / Telefone</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientesList.map(c => (
                          <tr key={c.id_cliente}>
                            <td><strong>#{c.id_cliente}</strong></td>
                            <td>{c.nome}</td>
                            <td>{c.email}</td>
                            <td><span className="badge badge-solicitada">{c.periodicidade_analise}</span></td>
                            <td>{c.contacto || 'N/A'} {c.telefone ? `(${c.telefone})` : ''}</td>
                            <td>
                              <span className={`badge ${c.ativo ? 'badge-autorizada' : 'badge-rejeitada'}`}>
                                {c.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB: WHITELISTS E PARAMETRIZAÇÃO DE CLIENTES */}
            {activeTab === 'autorizacoes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3>Whitelists e Quotas Diárias</h3>
                    <button className="btn btn-primary" onClick={() => {
                      setEditingAutorizacaoId(null);
                      setNewAutorizacaoData({
                        id_cliente: '',
                        id_etar: '',
                        quota: '5',
                        auto_aprovacao: true
                      });
                      setShowAddAutorizacao(true);
                    }}>
                      <PlusCircle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Configurar Whitelist
                    </button>
                  </div>
                  {loading ? (
                    <p>A carregar regras de quota...</p>
                  ) : autorizacoesList.length === 0 ? (
                    <p>Sem regras de whitelist ativas.</p>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ref</th>
                            <th>Cliente</th>
                            <th>ETAR Autorizada</th>
                            <th>Quota Diária</th>
                            <th>Auto-Aprovação</th>
                            <th>Estado</th>
                            <th>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {autorizacoesList.map(a => (
                            <tr key={a.id_autorizacao}>
                              <td><strong>#{a.id_autorizacao}</strong></td>
                              <td>{a.cliente_nome}</td>
                              <td>{a.etar_nome}</td>
                              <td>{a.quota} descargas/dia</td>
                              <td>{a.auto_aprovacao ? 'Sim (Automática)' : 'Não (Manual)'}</td>
                              <td>
                                <span className={`badge ${a.ativo ? 'badge-autorizada' : 'badge-rejeitada'}`}>
                                  {a.ativo ? 'Ativa' : 'Inativa'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button 
                                    className="btn btn-primary" 
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                    onClick={() => {
                                      setEditingAutorizacaoId(a.id_autorizacao);
                                      setNewAutorizacaoData({
                                        id_cliente: a.id_cliente,
                                        id_etar: a.id_etar,
                                        quota: a.quota.toString(),
                                        auto_aprovacao: a.auto_aprovacao
                                      });
                                      setShowAddAutorizacao(true);
                                    }}
                                  >
                                    Editar
                                  </button>
                                  <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleToggleAutorizacaoStatus(a)}>
                                    {a.ativo ? 'Desativar' : 'Ativar'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="card" style={{ maxWidth: '600px' }}>
                  <h3>Parametrização de Amostras por Cliente</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    Selecione um cliente para configurar quais os ensaios analíticos adicionais previstos no contrato de descarga.
                  </p>
                  <div className="form-group">
                    <label className="form-label">Selecionar Cliente</label>
                    <select className="form-input" value={selectedConfigClient} onChange={e => setSelectedConfigClient(e.target.value)}>
                      <option value="">-- Escolha um cliente --</option>
                      {clientesList.map(c => (
                        <option key={c.id_cliente} value={c.id_cliente}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  {selectedConfigClient && (
                    <form onSubmit={handleUpdateClientParams}>
                      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                        <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Ensaios Específicos do Contrato:</h4>
                        {parametrosList.filter(p => !p.obrigatorio).map(p => (
                          <div key={p.id_parametro} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input 
                              type="checkbox" 
                              id={`param-${p.id_parametro}`} 
                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                              checked={activeParams.includes(p.id_parametro)} 
                              onChange={() => handleToggleParamCheckbox(p.id_parametro)} 
                            />
                            <label htmlFor={`param-${p.id_parametro}`} style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                              <strong>{p.nome}</strong> ({p.tipo_parametro.replace('_', ' ')})
                            </label>
                          </div>
                        ))}
                      </div>
                      <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }}>
                        Gravar Parâmetros Contratuais
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* TAB: DISPONIBILIDADE DE ETARS (CONTINGÊNCIA) */}
            {activeTab === 'etars' && (
              <div>
                <h3 style={{ marginBottom: '1.5rem' }}>Estado e Disponibilidade de ETARs</h3>
                {loading ? (
                  <p>A carregar ETARs...</p>
                ) : etarsList.length === 0 ? (
                  <p>Nenhuma ETAR cadastrada.</p>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ref</th>
                          <th>ETAR</th>
                          <th>Localização</th>
                          <th>Estado de Aceitação</th>
                          <th>Ação de Contingência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {etarsList.map(e => (
                          <tr key={e.id_etar}>
                            <td><strong>#{e.id_etar}</strong></td>
                            <td>{e.nome}</td>
                            <td>{e.localizacao}</td>
                            <td>
                              <span className={`badge ${e.disponivel ? 'badge-autorizada' : 'badge-rejeitada'}`}>
                                {e.disponivel ? 'Disponível' : 'Indisponível (Bloqueada)'}
                              </span>
                            </td>
                            <td>
                              <button 
                                className="btn" 
                                style={{ 
                                  padding: '0.35rem 0.7rem', 
                                  fontSize: '0.8rem', 
                                  backgroundColor: e.disponivel ? 'var(--danger)' : 'var(--success)', 
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }} 
                                onClick={() => handleToggleEtarAvailability(e.id_etar, e.disponivel)}
                              >
                                {e.disponivel ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}
                                {e.disponivel ? 'Suspender Receção' : 'Ativar Receção'}
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

            {/* TAB: HISTÓRICO DE DESCARGAS CONCLUÍDAS */}
            {activeTab === 'historicoDescargas' && (
              <div>
                <h3 style={{ marginBottom: '1.5rem' }}>Histórico de Descargas Concluídas</h3>
                {loading ? (
                  <p>A carregar descargas...</p>
                ) : descargasConcluidas.length === 0 ? (
                  <p>Não existem descargas concluídas registadas no sistema.</p>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ref/Data</th>
                          <th>Cliente</th>
                          <th>ETAR Destino</th>
                          <th>Efluente</th>
                          <th>Qtd. Real (Solicitada)</th>
                          <th>Data Receção</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {descargasConcluidas.map((d) => (
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
                            <td>
                              <strong>{d.quantidade_real ? `${d.quantidade_real} L` : 'N/A'}</strong>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                                ({d.quantidade} L)
                              </span>
                            </td>
                            <td>{d.data_rececao ? new Date(d.data_rececao).toLocaleString() : 'N/A'}</td>
                            <td>
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', backgroundColor: 'var(--success)' }} 
                                onClick={() => handleAbrirFichaDescarga(d.id_descarga)}
                              >
                                <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Ver Ficha
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

            {/* TAB: HISTÓRICO DE BOLETINS ANALÍTICOS (AMOSTRAS CONCLUÍDAS) */}
            {activeTab === 'historicoAmostras' && (
              <div>
                <h3 style={{ marginBottom: '1.5rem' }}>Boletins Analíticos de Amostras Concluídas</h3>
                {loading ? (
                  <p>A carregar boletins...</p>
                ) : amostrasConcluidas.length === 0 ? (
                  <p>Não existem amostras concluídas ou boletins validados no sistema.</p>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ref. Amostra</th>
                          <th>Cliente</th>
                          <th>ETAR Origem</th>
                          <th>Data Conclusão</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {amostrasConcluidas.map((am) => (
                          <tr key={am.id_amostra}>
                            <td><strong>{am.qr_code_token}</strong></td>
                            <td>{am.cliente_nome}</td>
                            <td>{am.etar_nome}</td>
                            <td>{new Date(am.data_validacao).toLocaleDateString()}</td>
                            <td style={{ display: 'flex', gap: '0.5rem' }}>
                              <button 
                                className="btn btn-primary" 
                                style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', backgroundColor: 'var(--success)' }} 
                                onClick={() => handleDownloadBoletim(am)}
                              >
                                <Download size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Boletim PDF
                              </button>
                              {am.boletim_publico ? (
                                <span className="badge" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', border: '1px solid var(--success)', padding: '0.35rem 0.7rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: 'var(--radius-sm)' }}>
                                  <Check size={14} /> Disponibilizado
                                </span>
                              ) : (
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                                  onClick={() => handleDisponibilizarBoletim(am.id_amostra)}
                                >
                                  Disponibilizar ao Cliente
                                </button>
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

            {/* TAB: RELATÓRIOS CONSOLIDADOS */}
            {activeTab === 'relatorios' && (
              <div>
                <h3 style={{ marginBottom: '1.5rem' }}>Relatórios Consolidados</h3>

                {/* Filtros de Pesquisa */}
                <div className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem', marginBottom: '1.5rem', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>Cliente</label>
                    <select className="form-input" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} style={{ padding: '0.4rem' }}>
                      <option value="all">-- Todos os Clientes --</option>
                      {clientesList.map(c => (
                        <option key={c.id_cliente} value={c.id_cliente}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>ETAR</label>
                    <select className="form-input" value={filtroEtar} onChange={(e) => setFiltroEtar(e.target.value)} style={{ padding: '0.4rem' }}>
                      <option value="all">-- Todas as ETARs --</option>
                      {etarsList.map(e => (
                        <option key={e.id_etar} value={e.id_etar}>{e.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: 1, minWidth: '110px' }}>
                    <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>Mês</label>
                    <select className="form-input" value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} style={{ padding: '0.4rem' }}>
                      <option value="all">-- Todos --</option>
                      <option value="1">Janeiro</option>
                      <option value="2">Fevereiro</option>
                      <option value="3">Março</option>
                      <option value="4">Abril</option>
                      <option value="5">Maio</option>
                      <option value="6">Junho</option>
                      <option value="7">Julho</option>
                      <option value="8">Agosto</option>
                      <option value="9">Setembro</option>
                      <option value="10">Outubro</option>
                      <option value="11">Novembro</option>
                      <option value="12">Dezembro</option>
                    </select>
                  </div>

                  <div style={{ flex: 1, minWidth: '110px' }}>
                    <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>Ano</label>
                    <select className="form-input" value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} style={{ padding: '0.4rem' }}>
                      <option value="all">-- Todos --</option>
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>

                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>Estado da descarga</label>
                    <select className="form-input" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ padding: '0.4rem' }}>
                      <option value="all">-- Todos os Estados --</option>
                      <option value="SOLICITADA">Solicitada</option>
                      <option value="AUTORIZADA">Autorizada</option>
                      <option value="REJEITADA">Rejeitada</option>
                      <option value="AGENDADA">Agendada</option>
                      <option value="RECEBIDA">Recebida</option>
                      <option value="CONCLUIDA">Concluída</option>
                    </select>
                  </div>
                </div>

                {loading ? (
                  <p>A carregar relatórios...</p>
                ) : relatoriosData.length === 0 ? (
                  <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>Não existem descargas registadas para os filtros selecionados.</p>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Ref/Data Pedido</th>
                          <th>Cliente</th>
                          <th>ETAR</th>
                          <th>Estado Descarga</th>
                          <th>Qtd. Real (Solicitada)</th>
                          <th>Amostra</th>
                          <th>Resultados Analíticos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relatoriosData.map((r) => {
                          const hasAmostra = !!r.id_amostra;
                          const hasResultados = Array.isArray(r.resultados) && r.resultados.length > 0;
                          return (
                            <tr key={r.id_descarga}>
                              <td>
                                <strong>#{r.id_descarga}</strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  {new Date(r.data_pedido).toLocaleDateString()}
                                </div>
                              </td>
                              <td><strong>{r.cliente_nome}</strong></td>
                              <td>{r.etar_nome || `ETAR ${r.id_etar}`}</td>
                              <td>
                                <span className={`badge badge-${r.estado_descarga.toLowerCase()}`} style={{ fontSize: '0.7rem' }}>
                                  {r.estado_descarga}
                                </span>
                              </td>
                              <td>
                                <strong>{r.quantidade_real ? `${r.quantidade_real} L` : 'N/A'}</strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  ({r.quantidade} L)
                                </div>
                              </td>
                              <td>
                                {hasAmostra ? (
                                  <div>
                                    <span className={`badge badge-${r.estado_amostra.toLowerCase()}`} style={{ fontSize: '0.7rem' }}>
                                      {r.estado_amostra}
                                    </span>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                      Ref: {r.qr_code_token || 'N/A'}
                                    </div>
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Sem recolha</span>
                                )}
                              </td>
                              <td style={{ maxWidth: '300px' }}>
                                {hasResultados ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', fontSize: '0.75rem' }}>
                                    {r.resultados.map((res, idx) => (
                                      <span 
                                        key={idx} 
                                        style={{ 
                                          backgroundColor: 'var(--bg-base)', 
                                          border: '1px solid var(--border)', 
                                          borderRadius: '4px', 
                                          padding: '2px 6px', 
                                          whiteSpace: 'nowrap' 
                                        }}
                                      >
                                        <strong>{res.parametro}:</strong> {res.valor} {res.unidade || ''}
                                      </span>
                                    ))}
                                  </div>
                                ) : hasAmostra ? (
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                    Aguardando análise
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. SE FOR RESPONSÁVEL DE LAB / ETAR */}
        {(user.perfil === 'RESPONSAVEL_LAB' || user.perfil === 'RESPONSAVEL_ETAR') && (
          <div>
            <div className="tabs-nav">
              <button className={`tab-btn ${activeTab === 'validacoes' ? 'active' : ''}`} onClick={() => { setActiveTab('validacoes'); setError(''); setSuccess(''); }}>
                Amostras Analisadas ({analisadas.length})
              </button>
              <button className={`tab-btn ${activeTab === 'concluidas' ? 'active' : ''}`} onClick={() => { setActiveTab('concluidas'); setError(''); setSuccess(''); }}>
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

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" style={{ flex: 1, minWidth: '100px', backgroundColor: 'var(--success)' }} onClick={() => handleDecisao('AUTORIZADA')}>
                  <CheckSquare size={16} /> Autorizar
                </button>
                <button className="btn btn-primary" style={{ flex: 1, minWidth: '100px', backgroundColor: 'var(--danger)' }} onClick={() => handleDecisao('REJEITADA')}>
                  <XSquare size={16} /> Rejeitar
                </button>
                <button className="btn btn-primary" style={{ flex: 1, minWidth: '130px', backgroundColor: 'var(--warning)' }} onClick={() => handleDecisao('SOLICITAR_ELEMENTOS')}>
                  <HelpCircle size={16} /> Pedir Elementos
                </button>
                <button className="btn btn-secondary" style={{ flex: 1, minWidth: '80px' }} onClick={() => setSelectedDescarga(null)}>
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

        {/* Modal: Adicionar Cliente */}
        {showAddCliente && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', marginBottom: 0, maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>Registar Novo Cliente Contratado</h3>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowAddCliente(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateCliente}>
                <div className="form-group">
                  <label className="form-label">Nome da Empresa / Cliente *</label>
                  <input type="text" className="form-input" placeholder="Ex: Lavandarias Reunidas SA" required value={newClienteData.nome} onChange={e => setNewClienteData({ ...newClienteData, nome: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Principal (Acesso) *</label>
                  <input type="email" className="form-input" placeholder="geral@empresa.com" required value={newClienteData.email} onChange={e => setNewClienteData({ ...newClienteData, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Palavra-passe (Opcional - por omissão: Descargas123!)</label>
                  <input type="password" className="form-input" placeholder="Introduza a password" value={newClienteData.password} onChange={e => setNewClienteData({ ...newClienteData, password: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Periodicidade de Análises Contratada</label>
                  <select className="form-input" value={newClienteData.periodicidade_analise} onChange={e => setNewClienteData({ ...newClienteData, periodicidade_analise: e.target.value })}>
                    <option value="POR_DESCARGA">Por Descarga (Sempre)</option>
                    <option value="SEMANAL">Semanal (Uma por semana civil)</option>
                    <option value="QUINZENAL">Quinzenal (Mínimo a cada 15 dias)</option>
                    <option value="MENSAL">Mensal (Uma por mês civil)</option>
                    <option value="TRIMESTRAL">Trimestral (Uma por trimestre)</option>
                    <option value="SEMESTRAL">Semestral (Uma por semestre)</option>
                    <option value="ANUAL">Anual (Uma por ano civil)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Morada da Sede / Instalações</label>
                  <input type="text" className="form-input" placeholder="Morada..." value={newClienteData.morada} onChange={e => setNewClienteData({ ...newClienteData, morada: e.target.value })} />
                </div>
                <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="form-label">Nome de Contacto</label>
                    <input type="text" className="form-input" placeholder="Pessoa de contacto" value={newClienteData.contacto} onChange={e => setNewClienteData({ ...newClienteData, contacto: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Telefone</label>
                    <input type="text" className="form-input" placeholder="Telefone..." value={newClienteData.telefone} onChange={e => setNewClienteData({ ...newClienteData, telefone: e.target.value })} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirmar Contrato</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddCliente(false)}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Adicionar/Editar Autorização Whitelist */}
        {showAddAutorizacao && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="card" style={{ width: '100%', maxWidth: '450px', marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3>{editingAutorizacaoId ? 'Editar Whitelist / Limites' : 'Configurar Whitelist / Limites'}</h3>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowAddAutorizacao(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleSaveAutorizacao}>
                <div className="form-group">
                  <label className="form-label">Selecionar Cliente contratado *</label>
                  <select className="form-input" required disabled={!!editingAutorizacaoId} value={newAutorizacaoData.id_cliente} onChange={e => setNewAutorizacaoData({ ...newAutorizacaoData, id_cliente: e.target.value })}>
                    <option value="">-- Escolha um cliente --</option>
                    {clientesList.map(c => (
                      <option key={c.id_cliente} value={c.id_cliente}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Selecionar ETAR autorizada *</label>
                  <select className="form-input" required disabled={!!editingAutorizacaoId} value={newAutorizacaoData.id_etar} onChange={e => setNewAutorizacaoData({ ...newAutorizacaoData, id_etar: e.target.value })}>
                    <option value="">-- Escolha uma ETAR --</option>
                    {etarsList.map(e => (
                      <option key={e.id_etar} value={e.id_etar}>{e.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Quota Diária de Descargas *</label>
                  <input type="number" className="form-input" required min="1" value={newAutorizacaoData.quota} onChange={e => setNewAutorizacaoData({ ...newAutorizacaoData, quota: e.target.value })} />
                </div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                  <input 
                    type="checkbox" 
                    id="auto-aprovacao-check" 
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    checked={newAutorizacaoData.auto_aprovacao} 
                    onChange={e => setNewAutorizacaoData({ ...newAutorizacaoData, auto_aprovacao: e.target.checked })} 
                  />
                  <label htmlFor="auto-aprovacao-check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                    <strong>Ativar Auto-Aprovação</strong> (Ignora triagem manual)
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editingAutorizacaoId ? 'Gravar Alterações' : 'Gravar Regra'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddAutorizacao(false)}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
