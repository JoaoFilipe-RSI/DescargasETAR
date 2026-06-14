import React, { useState, useEffect } from 'react';
import { amostraService, descargaService, adminService } from '../services/api';
import { ShieldCheck, ClipboardList, CheckSquare, XSquare, Download, LogOut, FileText, ToggleLeft, ToggleRight, Settings, PlusCircle, Check, X, HelpCircle, Megaphone, Eye, Menu } from 'lucide-react';
import { webSocketService } from '../services/websocket';
import NotificationBell from '../components/NotificationBell';

export default function ResponsavelDashboard({ user, onLogout, notifications, onMarkAsRead, onMarkAllAsRead, onChangePassword, onAddNotification }) {
  const [activeTab, setActiveTab] = useState(
    (user.perfil === 'GESTOR_CLIENTES' || user.perfil === 'GESTOR_ADMIN') ? 'decisoes' : 'validacoes'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estados do Gestor de Clientes
  const [solicitadas, setSolicitadas] = useState([]);
  const [decisaoObs, setDecisaoObs] = useState('');
  const [selectedDescarga, setSelectedDescarga] = useState(null);
  
  // Estados para reencaminhamento manual de descargas agendadas (Contingência)
  const [selectedReencaminharDescarga, setSelectedReencaminharDescarga] = useState(null);
  const [reencaminharEtarId, setReencaminharEtarId] = useState('');
  const [reencaminharForcar, setReencaminharForcar] = useState(false);
  const [reencaminharObservacoes, setReencaminharObservacoes] = useState('');
  const [reencaminharLoading, setReencaminharLoading] = useState(false);
  const [exibirOpcaoForcar, setExibirOpcaoForcar] = useState(false);

  // Estados do Responsável de Laboratório/ETAR
  const [analisadas, setAnalisadas] = useState([]);
  const [concluidas, setConcluidas] = useState([]);
  const [selectedAmostra, setSelectedAmostra] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [editResultados, setEditResultados] = useState([]);
  const [editingParamId, setEditingParamId] = useState(null);

  // Estados de Administração (Novo)
  const [clientesList, setClientesList] = useState([]);
  const [etarsList, setEtarsList] = useState([]);
  const [autorizacoesList, setAutorizacoesList] = useState([]);
  const [parametrosList, setParametrosList] = useState([]);
  const [descargasConcluidas, setDescargasConcluidas] = useState([]);
  const [amostrasConcluidas, setAmostrasConcluidas] = useState([]);

  // Estados para o novo separador de Utilizadores Internos
  const [utilizadoresList, setUtilizadoresList] = useState([]);
  const [perfisList, setPerfisList] = useState([]);
  const [showPerfisModal, setShowPerfisModal] = useState(false);
  const [editingPerfilId, setEditingPerfilId] = useState(null);
  const [newPerfilData, setNewPerfilData] = useState({ nome: '' });
  const [showAddUtilizador, setShowAddUtilizador] = useState(false);
  const [editingUtilizadorId, setEditingUtilizadorId] = useState(null);
  const [newUtilizadorData, setNewUtilizadorData] = useState({
    nome: '',
    email: '',
    id_perfil: '2',
    id_etar: '',
    password: '',
    ativo: true
  });

  // Estados para o novo separador de Relatórios
  const [relatoriosData, setRelatoriosData] = useState([]);
  const [filtroCliente, setFiltroCliente] = useState('all');
  const [filtroEtar, setFiltroEtar] = useState('all');
  const [filtroMesRelatorios, setFiltroMesRelatorios] = useState('all');
  const [filtroAnoRelatorios, setFiltroAnoRelatorios] = useState('all');
  const [filtroEstado, setFiltroEstado] = useState('all');
  const [periodoInicioRelatorios, setPeriodoInicioRelatorios] = useState('');
  const [periodoFimRelatorios, setPeriodoFimRelatorios] = useState('');

  const [filtroMesDescargas, setFiltroMesDescargas] = useState('all');
  const [filtroAnoDescargas, setFiltroAnoDescargas] = useState('all');
  const [periodoInicioDescargas, setPeriodoInicioDescargas] = useState('');
  const [periodoFimDescargas, setPeriodoFimDescargas] = useState('');

  const [filtroMesAmostras, setFiltroMesAmostras] = useState('all');
  const [filtroAnoAmostras, setFiltroAnoAmostras] = useState('all');
  const [periodoInicioAmostras, setPeriodoInicioAmostras] = useState('');
  const [periodoFimAmostras, setPeriodoFimAmostras] = useState('');

  const [filtroMesConcluidasLab, setFiltroMesConcluidasLab] = useState('all');
  const [filtroAnoConcluidasLab, setFiltroAnoConcluidasLab] = useState('all');
  const [periodoInicioConcluidasLab, setPeriodoInicioConcluidasLab] = useState('');
  const [periodoFimConcluidasLab, setPeriodoFimConcluidasLab] = useState('');
  const [pesquisaConcluidasLab, setPesquisaConcluidasLab] = useState('');

  // Estados para o novo separador de Auditoria
  const [auditoriaList, setAuditoriaList] = useState([]);
  const [filtroAuditEntidade, setFiltroAuditEntidade] = useState('all');
  const [filtroAuditAcao, setFiltroAuditAcao] = useState('all');
  const [pesquisaAudit, setPesquisaAudit] = useState('');

  const [showAddEtar, setShowAddEtar] = useState(false);
  const [newEtarData, setNewEtarData] = useState({
    nome: '',
    localizacao: '',
    disponivel: true
  });

  const [showAddParam, setShowAddParam] = useState(false);
  const [editingGlobalParamId, setEditingGlobalParamId] = useState(null);
  const [tiposParametrosList, setTiposParametrosList] = useState(['FISICO_QUIMICO', 'AZOTO', 'METAIS', 'OLEOS E GORDURAS']);
  const [showAddTypeInline, setShowAddTypeInline] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newParamData, setNewParamData] = useState({
    nome: '',
    tipo_parametro: 'FISICO_QUIMICO',
    unidade_default: 'mg/L',
    obrigatorio: false
  });

  // Estado para modal de edição do catálogo de parâmetros (Responsável Lab)
  const [showEditParamCatalog, setShowEditParamCatalog] = useState(false);
  const [editingParamCatalogData, setEditingParamCatalogData] = useState({
    id_parametro: null,
    nome: '',
    metodo_default_cod: '',
    metodo_default_nome: '',
    incerteza_default: ''
  });

  const [showGeneralMsgModal, setShowGeneralMsgModal] = useState(false);
  const [generalMsgText, setGeneralMsgText] = useState('');

  // Modais de Criação
  const [showAddCliente, setShowAddCliente] = useState(false);
  const [showAddAutorizacao, setShowAddAutorizacao] = useState(false);
  const [editingAutorizacaoId, setEditingAutorizacaoId] = useState(null);
  const [editingClienteId, setEditingClienteId] = useState(null);

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
      if (user.perfil === 'GESTOR_CLIENTES' || user.perfil === 'GESTOR_ADMIN') {
        if (activeTab === 'decisoes') {
          const data = await descargaService.obterDescargas({ estado: 'SOLICITADA' });
          setSolicitadas(data);

          // Sincronizar notificações offline para o gestor (descargas revertidas)
          if (Array.isArray(data)) {
            data.forEach(d => {
              if (d.observacoes && d.observacoes.includes('Revertido por indisponibilidade urgente')) {
                const etarNome = d.etar_nome || `ETAR ${d.id_etar}`;
                const notifMsg = `O pedido de descarga #${d.id_descarga} foi revertido para SOLICITADO devido à indisponibilidade da ${etarNome} (sem alternativa).`;
                if (typeof onAddNotification === 'function') {
                  onAddNotification(notifMsg);
                }
              }
            });
          }
        } else if (activeTab === 'clientes') {
          const data = await adminService.obterClientes();
          const sorted = Array.isArray(data) ? [...data].sort((a, b) => a.nome.localeCompare(b.nome)) : [];
          setClientesList(sorted);
          const params = await adminService.obterParametros();
          setParametrosList(params);
          try {
            const types = await adminService.obterTiposParametro();
            setTiposParametrosList(types);
          } catch (err) {
            console.error('Erro ao obter tipos de parâmetros:', err);
          }
        } else if (activeTab === 'autorizacoes') {
          const auts = await adminService.obterAutorizacoes();
          setAutorizacoesList(Array.isArray(auts) ? [...auts].sort((x, y) => (x.cliente_nome || '').localeCompare(y.cliente_nome || '')) : []);
          const cls = await adminService.obterClientes();
          setClientesList(Array.isArray(cls) ? [...cls].sort((a, b) => a.nome.localeCompare(b.nome)) : []);
          const ets = await adminService.obterEtars();
          setEtarsList(ets);
          const params = await adminService.obterParametros();
          setParametrosList(params);
          try {
            const types = await adminService.obterTiposParametro();
            setTiposParametrosList(types);
          } catch (err) {
            console.error('Erro ao obter tipos de parâmetros:', err);
          }
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
          setClientesList(Array.isArray(cls) ? [...cls].sort((a, b) => a.nome.localeCompare(b.nome)) : []);
          const ets = await adminService.obterEtars();
          setEtarsList(ets);
        } else if (activeTab === 'utilizadores' && user.perfil === 'GESTOR_ADMIN') {
          const utls = await adminService.obterUtilizadores();
          const sortedUtls = Array.isArray(utls)
            ? [...utls].sort((a, b) => {
              if (Number(a.id_perfil) !== Number(b.id_perfil)) {
                return Number(a.id_perfil) - Number(b.id_perfil);
              }
              return a.nome.localeCompare(b.nome);
            })
            : [];
          setUtilizadoresList(sortedUtls);
          const ets = await adminService.obterEtars();
          setEtarsList(ets);
          const pfs = await adminService.obterPerfis();
          setPerfisList(Array.isArray(pfs) ? pfs : []);
        } else if (activeTab === 'auditoria' && user.perfil === 'GESTOR_ADMIN') {
          const logs = await adminService.obterLogsAuditoria({
            entidade: filtroAuditEntidade,
            acao: filtroAuditAcao,
            pesquisa: pesquisaAudit
          });
          setAuditoriaList(logs);
        }
      } else {
        // Responsável de Lab/ETAR
        if (activeTab === 'catalogo') {
          const params = await adminService.obterParametros();
          setParametrosList(params);
        } else {
          const dataAnal = await amostraService.obterAmostras({ estado: 'ANALISADA' });
          setAnalisadas(dataAnal);
          const dataConc = await amostraService.obterAmostras({ estado: 'CONCLUIDA' });
          setConcluidas(dataConc);
        }
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
        mes: filtroMesRelatorios,
        ano: filtroAnoRelatorios,
        estado: filtroEstado,
        data_inicio: periodoInicioRelatorios || undefined,
        data_fim: periodoFimRelatorios || undefined
      });

      const sorted = Array.isArray(data) ? [...data].sort((a, b) => {
        const da = parseDate(a.data_rececao);
        const db = parseDate(b.data_rececao);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      }) : [];

      setRelatoriosData(sorted);

      // Sincronizar notificações de alertas operacionais offline para o gestor
      if (Array.isArray(sorted)) {
        sorted.forEach(d => {
          if (d.estado_descarga === 'AGENDADA' && d.observacoes && d.observacoes.includes('ALERTA OPERACIONAL')) {
            const etarNome = d.etar_nome || `ETAR ${d.id_etar}`;
            const notifMsg = `Aviso: A descarga agendada #${d.id_descarga} para a ${etarNome} (agora indisponível) requer contacto imediato com o cliente.`;
            if (typeof onAddNotification === 'function') {
              onAddNotification(notifMsg);
            }
          }
          if (d.estado_descarga === 'SOLICITADA' && d.observacoes && d.observacoes.includes('Revertido por indisponibilidade urgente')) {
            const etarNome = d.etar_nome || `ETAR ${d.id_etar}`;
            const notifMsg = `O pedido de descarga #${d.id_descarga} foi revertido para SOLICITADO devido à indisponibilidade da ${etarNome} (sem alternativa).`;
            if (typeof onAddNotification === 'function') {
              onAddNotification(notifMsg);
            }
          }
        });
      }
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
  }, [filtroCliente, filtroEtar, filtroMesRelatorios, filtroAnoRelatorios, filtroEstado, periodoInicioRelatorios, periodoFimRelatorios, activeTab]);

  useEffect(() => {
    if (activeTab === 'auditoria') {
      loadData();
    }
  }, [filtroAuditEntidade, filtroAuditAcao, pesquisaAudit, activeTab]);

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

  // Gestor de Clientes: Criar ou Editar Cliente e Utilizador
  const handleSaveCliente = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingClienteId) {
        await adminService.atualizarCliente(editingClienteId, newClienteData);
        setSuccess('Dados do cliente e conta de utilizador atualizados com sucesso!');
      } else {
        await adminService.criarCliente(newClienteData);
        setSuccess('Novo cliente contratualizado e credenciais de utilizador criadas com sucesso!');
      }
      setShowAddCliente(false);
      setEditingClienteId(null);
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
      setError(err.message || 'Erro ao gravar dados do cliente.');
    }
  };

  // Gestor de Clientes: Criar ou Editar Utilizador Interno
  const handleSaveUtilizador = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingUtilizadorId) {
        await adminService.atualizarUtilizador(editingUtilizadorId, newUtilizadorData);
        setSuccess('Utilizador interno atualizado com sucesso!');
      } else {
        await adminService.criarUtilizador(newUtilizadorData);
        setSuccess('Utilizador interno criado com sucesso!');
      }
      setShowAddUtilizador(false);
      setEditingUtilizadorId(null);
      setNewUtilizadorData({
        nome: '',
        email: '',
        id_perfil: '2',
        id_etar: '',
        password: '',
        ativo: true
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao gravar utilizador interno.');
    }
  };

  const handleSavePerfil = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingPerfilId) {
        await adminService.atualizarPerfil(editingPerfilId, newPerfilData);
        setSuccess('Perfil atualizado com sucesso!');
      } else {
        await adminService.criarPerfil(newPerfilData);
        setSuccess('Perfil criado com sucesso!');
      }
      setEditingPerfilId(null);
      setNewPerfilData({ nome: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao gravar perfil.');
    }
  };

  // Gestor de Clientes / Admin: Criar Nova ETAR
  const handleSaveEtar = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await adminService.criarEtar(newEtarData);
      setSuccess('Nova ETAR registada com sucesso!');
      setShowAddEtar(false);
      setNewEtarData({
        nome: '',
        localizacao: '',
        disponivel: true
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao criar nova ETAR.');
    }
  };

  // Gestor: Criar ou Editar Parâmetro Analítico no Catálogo
  const handleSaveParam = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (editingGlobalParamId) {
        await adminService.atualizarParametro(editingGlobalParamId, newParamData);
        setSuccess('Parâmetro analítico atualizado com sucesso no catálogo!');
      } else {
        await adminService.criarParametro(newParamData);
        setSuccess('Novo parâmetro analítico registado com sucesso no catálogo!');
      }
      setShowAddParam(false);
      setEditingGlobalParamId(null);
      setNewParamData({
        nome: '',
        tipo_parametro: tiposParametrosList[0] || 'FISICO_QUIMICO',
        unidade_default: 'mg/L',
        obrigatorio: false
      });
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao gravar parâmetro global.');
    }
  };

  // Responsável Lab: Editar defaults de Metodologia e Incerteza de um Parâmetro
  const handleSaveParamCatalog = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const incVal = editingParamCatalogData.incerteza_default;
    if (incVal !== '' && incVal !== null && incVal !== undefined) {
      const parsed = parseFloat(incVal);
      if (isNaN(parsed) || parsed < 0) {
        setError('A incerteza padrão deve ser um número não negativo (ex: 0.05 para 5%).');
        return;
      }
    }
    try {
      await adminService.atualizarParametro(editingParamCatalogData.id_parametro, {
        metodo_default_cod: editingParamCatalogData.metodo_default_cod,
        metodo_default_nome: editingParamCatalogData.metodo_default_nome,
        incerteza_default: incVal !== '' && incVal !== null ? parseFloat(incVal) : null
      });
      setSuccess(`Parâmetro "${editingParamCatalogData.nome}" atualizado com sucesso no catálogo!`);
      setShowEditParamCatalog(false);
      setEditingParamCatalogData({ id_parametro: null, nome: '', metodo_default_cod: '', metodo_default_nome: '', incerteza_default: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao atualizar parâmetro.');
    }
  };

  // Gestor Admin: Enviar Aviso Geral
  const handleSendGeneralMessage = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await adminService.enviarMensagemGeral(generalMsgText);
      setSuccess('Aviso geral enviado com sucesso para todos os utilizadores!');
      setShowGeneralMsgModal(false);
      setGeneralMsgText('');
    } catch (err) {
      setError(err.message || 'Erro ao enviar aviso geral.');
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

  // Gestor de Clientes: Alternar Estado Ativo da Conta do Cliente
  const handleToggleClienteStatus = async (cliente) => {
    setError('');
    setSuccess('');
    try {
      await adminService.atualizarEstadoCliente(cliente.id_cliente, !cliente.ativo);
      setSuccess(`Estado do cliente ${cliente.nome} atualizado para ${!cliente.ativo ? 'ativo' : 'inativo'} com sucesso!`);
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao alternar o estado do cliente.');
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

  // Gestor de Clientes: Reencaminhamento Manual de Descarga (Contingência)
  const clienteTemWhitelist = (clienteId, etarId) => {
    return autorizacoesList.some(a => a.id_cliente === parseInt(clienteId, 10) && a.id_etar === parseInt(etarId, 10) && a.ativo);
  };

  const handleAbrirReencaminhar = (descarga) => {
    setError('');
    setSuccess('');
    setSelectedReencaminharDescarga(descarga);
    // Tentar pré-selecionar uma ETAR diferente que esteja disponível
    const outraEtar = etarsList.find(e => e.id_etar !== descarga.id_etar && e.disponivel);
    const etarIdInicial = outraEtar ? String(outraEtar.id_etar) : '';
    setReencaminharEtarId(etarIdInicial);
    setReencaminharForcar(false);
    setReencaminharObservacoes('');
    
    // Validar whitelist inicial
    if (etarIdInicial && !clienteTemWhitelist(descarga.id_cliente, etarIdInicial)) {
      setExibirOpcaoForcar(true);
    } else {
      setExibirOpcaoForcar(false);
    }
  };

  const handleEtarReencaminharChange = (val) => {
    setReencaminharEtarId(val);
    const temWl = clienteTemWhitelist(selectedReencaminharDescarga.id_cliente, val);
    if (!temWl) {
      setExibirOpcaoForcar(true);
    } else {
      setExibirOpcaoForcar(false);
      setReencaminharForcar(false);
    }
  };

  const handleReencaminharSubmeter = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    setReencaminharLoading(true);

    try {
      const payload = {
        id_etar: parseInt(reencaminharEtarId, 10),
        forcar: reencaminharForcar,
        observacoes: reencaminharObservacoes
      };

      await descargaService.reencaminharManual(selectedReencaminharDescarga.id_descarga, payload);
      setSuccess(`Descarga #${selectedReencaminharDescarga.id_descarga} reencaminhada com sucesso!`);
      setSelectedReencaminharDescarga(null);
      loadData(); // Atualiza a tabela e relatórios
    } catch (err) {
      setError(err.message || 'Erro ao reencaminhar descarga.');
      if (err.message && (err.message.includes('whitelist') || err.message.includes('quota') || err.message.includes('excedida'))) {
        setExibirOpcaoForcar(true);
      }
    } finally {
      setReencaminharLoading(false);
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
    if (user.perfil === 'GESTOR_CLIENTES' || user.perfil === 'GESTOR_ADMIN') {
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

      const handleAlertaAgendamento = (data) => {
        setError(data.mensagem || `Aviso: A descarga #${data.id_descarga} agendada requer contacto de emergência!`);
        loadData();
      };

      webSocketService.on('novo-pedido', handleNovoPedido);
      webSocketService.on('descarga-concluida', handleDescargaConcluida);
      webSocketService.on('amostra-concluida', handleAmostraConcluida);
      webSocketService.on('alerta-agendamento', handleAlertaAgendamento);

      return () => {
        webSocketService.off('novo-pedido', handleNovoPedido);
        webSocketService.off('descarga-concluida', handleDescargaConcluida);
        webSocketService.off('amostra-concluida', handleAmostraConcluida);
        webSocketService.off('alerta-agendamento', handleAlertaAgendamento);
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
      const handleNovoParametro = (data) => {
        setSuccess(data.mensagem || 'Novo parâmetro adicionado ao catálogo. Configure a metodologia e incerteza padrão.');
        loadData();
      };

      webSocketService.on('nova-amostra', handleNovaAmostra);
      webSocketService.on('amostra-analisada', handleAmostraAnalisada);
      webSocketService.on('novo-parametro', handleNovoParametro);

      return () => {
        webSocketService.off('nova-amostra', handleNovaAmostra);
        webSocketService.off('amostra-analisada', handleAmostraAnalisada);
        webSocketService.off('novo-parametro', handleNovoParametro);
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

  // Abrir PDF do Boletim em novo separador
  const handleVerBoletim = async (amostra) => {
    setError('');
    try {
      await amostraService.verBoletimPDF(amostra.id_amostra);
    } catch (err) {
      setError(err.message || 'Erro ao abrir o Boletim.');
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

  // Carregar os resultados de uma amostra antes de abrir o modal de validação ou visualização
  const handleOpenValidacao = async (amostra, viewOnly = false) => {
    setError('');
    setSuccess('');
    setIsViewOnly(viewOnly);
    setEditingParamId(null);
    try {
      const details = await amostraService.obterDetalhesAmostra(amostra.id_amostra);
      setSelectedAmostra(details);
      if (details && Array.isArray(details.resultados)) {
        setEditResultados(
          details.resultados.map(r => ({
            id_resultado: r.id_resultado,
            id_parametro: r.id_parametro,
            parametro_nome: r.parametro_nome,
            valor: r.valor,
            unidade: r.unidade,
            metodo: r.metodo || '',
            incerteza: r.incerteza || ''
          }))
        );
      } else {
        setEditResultados([]);
      }
    } catch (err) {
      setError('Erro ao carregar parâmetros da amostra.');
    }
  };

  // Gravar edições parciais ou totais nos resultados analíticos
  const handleSaveEdits = async (validateAfterSave = false) => {
    setError('');
    setSuccess('');

    // Validar limites físicos e lógicos
    for (const r of editResultados) {
      const val = Number(r.valor);
      if (isNaN(val) || val < 0) {
        setError(`O valor para o parâmetro "${r.parametro_nome}" não pode ser negativo.`);
        return;
      }
      if (r.parametro_nome.toUpperCase() === 'PH') {
        if (val < 0 || val > 14) {
          setError('Validação de integridade física falhou: o valor de pH tem de estar entre 0 e 14.');
          return;
        }
      }
      if (r.incerteza !== '' && r.incerteza !== null && r.incerteza !== undefined) {
        const inc = Number(r.incerteza);
        if (isNaN(inc) || inc < 0) {
          setError(`A incerteza para o parâmetro "${r.parametro_nome}" não pode ser negativa.`);
          return;
        }
      }
    }

    try {
      const payload = editResultados.map(r => ({
        id_parametro: r.id_parametro,
        valor: Number(r.valor),
        unidade: r.unidade,
        metodo: r.metodo || null,
        incerteza: r.incerteza !== '' && r.incerteza !== null && r.incerteza !== undefined ? Number(r.incerteza) : null
      }));

      await amostraService.registarResultados(selectedAmostra.amostra.id_amostra, payload);

      if (validateAfterSave) {
        await amostraService.validarAmostra(selectedAmostra.amostra.id_amostra);
        setSuccess('Resultados atualizados, boletim validado e assinado digitalmente com sucesso!');
        setSelectedAmostra(null);
      } else {
        setSuccess('Resultados e metodologias atualizados com sucesso!');
        // Atualizar visualização
        const updatedDetails = await amostraService.obterDetalhesAmostra(selectedAmostra.amostra.id_amostra);
        setSelectedAmostra(updatedDetails);
        setEditingParamId(null);
      }
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao guardar alterações nos resultados.');
    }
  };

  // Definir metodologia editada como padrão no catálogo de parâmetros
  const handleDefinirMetodoPadrao = async (paramId, metodoStr) => {
    setError('');
    setSuccess('');
    try {
      let cod = metodoStr ? metodoStr.trim() : '';
      let nome = '';

      // Se estiver no formato "Código (Nome)"
      const match = cod.match(/^([^(]+)\(([^)]+)\)$/);
      if (match) {
        cod = match[1].trim();
        nome = match[2].trim();
      }

      // Obter os parâmetros atuais para preservar a incerteza e outros campos
      const allParams = await adminService.obterParametros();
      const paramObj = allParams.find(p => p.id_parametro === paramId);
      const currentIncerteza = paramObj ? paramObj.incerteza_default : null;

      await adminService.atualizarParametro(paramId, {
        metodo_default_cod: cod || null,
        metodo_default_nome: nome || null,
        incerteza_default: currentIncerteza
      });

      // Atualizar lista de parâmetros local se estiver carregada
      if (Array.isArray(parametrosList)) {
        setParametrosList(parametrosList.map(p => p.id_parametro === paramId ? {
          ...p,
          metodo_default_cod: cod || null,
          metodo_default_nome: nome || null
        } : p));
      }

      setSuccess(`Metodologia padrão do parâmetro atualizada no catálogo para: ${cod}${nome ? ` (${nome})` : ''}`);
    } catch (err) {
      setError(err.message || 'Erro ao atualizar metodologia padrão.');
    }
  };

  // Derived filtered / sorted lists (temporal filters + sorting)
  const parseDate = (v) => {
    if (!v) return null;
    if (typeof v === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        const [y, m, day] = v.split('-').map(Number);
        return new Date(y, m - 1, day);
      }
      const formatted = v.replace(' ', 'T');
      const d = new Date(formatted);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  };

  const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const matchesPeriod = (itemDateStr, { inicio, fim, mes, ano }) => {
    if (!itemDateStr) return false;
    const d = parseDate(itemDateStr);
    if (!d) return false;
    const itemDay = dateOnly(d);
    if (inicio) {
      const s = parseDate(inicio);
      if (s && itemDay < dateOnly(s)) return false;
    }
    if (fim) {
      const f = parseDate(fim);
      if (f && itemDay > dateOnly(f)) return false;
    }
    if (mes !== 'all' || ano !== 'all') {
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      if (mes !== 'all' && Number(mes) !== month) return false;
      if (ano !== 'all' && Number(ano) !== year) return false;
    }
    return true;
  };

  const hasFiltroDescargas = periodoInicioDescargas || periodoFimDescargas || filtroMesDescargas !== 'all' || filtroAnoDescargas !== 'all';
  const hasFiltroAmostras = periodoInicioAmostras || periodoFimAmostras || filtroMesAmostras !== 'all' || filtroAnoAmostras !== 'all';

  const descargasFiltradas = Array.isArray(descargasConcluidas)
    ? [...descargasConcluidas]
      .filter(d => {
        // prefer data_rececao, fallback to data_pedido
        const dateField = d.data_rececao || d.data_pedido;
        const hasFilter = periodoInicioDescargas || periodoFimDescargas || filtroMesDescargas !== 'all' || filtroAnoDescargas !== 'all';
        return hasFilter ? matchesPeriod(dateField, {
          inicio: periodoInicioDescargas,
          fim: periodoFimDescargas,
          mes: filtroMesDescargas,
          ano: filtroAnoDescargas
        }) : true;
      })
      .sort((a, b) => {
        const da = parseDate(a.data_rececao);
        const db = parseDate(b.data_rececao);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      })
    : [];

  const amostrasFiltradas = Array.isArray(amostrasConcluidas)
    ? [...amostrasConcluidas]
      .filter(am => {
        // prefer data_recolha for filtering/sorting
        const dateField = am.data_recolha || am.data_validacao || am.data_rececao || am.data_pedido;
        const hasFilter = periodoInicioAmostras || periodoFimAmostras || filtroMesAmostras !== 'all' || filtroAnoAmostras !== 'all';
        return hasFilter ? matchesPeriod(dateField, {
          inicio: periodoInicioAmostras,
          fim: periodoFimAmostras,
          mes: filtroMesAmostras,
          ano: filtroAnoAmostras
        }) : true;
      })
      .sort((a, b) => {
        const da = parseDate(a.data_recolha);
        const db = parseDate(b.data_recolha);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      })
    : [];

  const hasFiltroConcluidasLab = periodoInicioConcluidasLab || periodoFimConcluidasLab
    || filtroMesConcluidasLab !== 'all' || filtroAnoConcluidasLab !== 'all' || pesquisaConcluidasLab.trim();

  const concluidasFiltradas = Array.isArray(concluidas)
    ? [...concluidas]
      .filter(am => {
        const dateField = am.data_validacao || am.data_recolha || am.data_rececao;
        const hasDateFilter = periodoInicioConcluidasLab || periodoFimConcluidasLab
          || filtroMesConcluidasLab !== 'all' || filtroAnoConcluidasLab !== 'all';
        if (hasDateFilter && !matchesPeriod(dateField, {
          inicio: periodoInicioConcluidasLab,
          fim: periodoFimConcluidasLab,
          mes: filtroMesConcluidasLab,
          ano: filtroAnoConcluidasLab
        })) return false;
        if (pesquisaConcluidasLab.trim()) {
          const q = pesquisaConcluidasLab.trim().toLowerCase();
          const match = [am.qr_code_token, am.id_amostra, am.cliente_nome, am.etar_nome]
            .some(v => v != null && String(v).toLowerCase().includes(q));
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = parseDate(a.data_validacao);
        const db = parseDate(b.data_validacao);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
      })
    : [];

  return (
    <div className="app-container">
      <header className="navbar" style={{ position: 'relative' }}>
        <div className="brand">
          <img src="/pwa-192x192.png" className="brand-logo" alt="Logo" />
          <span className="brand-name">DescargasETAR</span>
        </div>
        
        {/* Ações clássicas para Desktop */}
        <div className="navbar-desktop-actions">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Olá, <strong>{user.nome}</strong> ({user.perfil.replace('_', ' ')})
          </span>
          <NotificationBell
            notifications={notifications}
            onMarkAsRead={onMarkAsRead}
            onMarkAllAsRead={onMarkAllAsRead}
          />
          {user.perfil === 'GESTOR_ADMIN' && (
            <button
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={() => {
                setGeneralMsgText('');
                setShowGeneralMsgModal(true);
              }}
              title="Enviar Aviso Geral"
            >
              <Megaphone size={16} /> Aviso Geral
            </button>
          )}
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onChangePassword}>
            <Settings size={16} /> Configurações
          </button>
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={onLogout}>
            <LogOut size={16} /> Sair
          </button>
        </div>

        {/* Ações simplificadas para Mobile */}
        <div className="navbar-menu-mobile">
          <NotificationBell
            notifications={notifications}
            onMarkAsRead={onMarkAsRead}
            onMarkAllAsRead={onMarkAllAsRead}
          />
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Dropdown de Menu Mobile */}
        {mobileMenuOpen && (
          <>
            <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)}></div>
            <div className="mobile-menu-dropdown card">
              <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{user.nome}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '2px' }}>
                  {user.perfil.replace('_', ' ')}
                </div>
              </div>
              {user.perfil === 'GESTOR_ADMIN' && (
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', fontSize: '0.85rem' }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setGeneralMsgText('');
                    setShowGeneralMsgModal(true);
                  }}
                >
                  <Megaphone size={16} /> Aviso Geral
                </button>
              )}
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', fontSize: '0.85rem' }} 
                onClick={() => { setMobileMenuOpen(false); onChangePassword(); }}
              >
                <Settings size={16} /> Configurações
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', color: 'var(--danger)', fontSize: '0.85rem' }} 
                onClick={() => { setMobileMenuOpen(false); onLogout(); }}
              >
                <LogOut size={16} /> Sair
              </button>
            </div>
          </>
        )}
      </header>

      <main className="content-wrapper animate-fade-in" style={{ maxWidth: '1400px' }}>
        <div className="dashboard-header">
          <div>
            <h2>
              {(user.perfil === 'GESTOR_CLIENTES' || user.perfil === 'GESTOR_ADMIN')
                ? 'Painel de Gestão e Decisão'
                : 'Painel de Validação Técnica'}
            </h2>
            <p style={{ color: 'var(--text-secondary)' }}>
              {(user.perfil === 'GESTOR_CLIENTES' || user.perfil === 'GESTOR_ADMIN')
                ? 'Autorize pedidos de descarga, configure whitelists e quotas, gerencie o sistema.'
                : 'Avalie e aprove os resultados das análises, defina as metodologias e incertezas e assine os boletins analíticos.'}
            </p>
          </div>
        </div>

        {error && <div className="card" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: '1rem', borderLeft: '5px solid var(--danger)' }}>{error}</div>}
        {success && <div className="card" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '1rem', borderLeft: '5px solid var(--success)' }}>{success}</div>}

        {/* 1. SE FOR GESTOR DE CLIENTES / ADMIN */}
        {(user.perfil === 'GESTOR_CLIENTES' || user.perfil === 'GESTOR_ADMIN') && (
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
                Relatórios
              </button>
              {user.perfil === 'GESTOR_ADMIN' && (
                <>
                  <button className={`tab-btn ${activeTab === 'utilizadores' ? 'active' : ''}`} onClick={() => { setActiveTab('utilizadores'); setError(''); setSuccess(''); }}>
                    Utilizadores
                  </button>
                  <button className={`tab-btn ${activeTab === 'auditoria' ? 'active' : ''}`} onClick={() => { setActiveTab('auditoria'); setError(''); setSuccess(''); }}>
                    Auditoria
                  </button>
                </>
              )}
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
                              {d.observacoes && d.observacoes.includes('Revertido') && (
                                <span className="badge badge-rejeitada" style={{ fontSize: '0.65rem', marginTop: '0.25rem', display: 'inline-block', padding: '0.15rem 0.35rem', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: '4px' }}>
                                  ⚠️ Autorização Revertida
                                </span>
                              )}
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
                          <th>Ações</th>
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
                            <td>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                  onClick={() => {
                                    setEditingClienteId(c.id_cliente);
                                    setNewClienteData({
                                      nome: c.nome,
                                      morada: c.morada || '',
                                      contacto: c.contacto || '',
                                      telefone: c.telefone || '',
                                      email: c.email,
                                      password: '',
                                      periodicidade_analise: c.periodicidade_analise
                                    });
                                    setShowAddCliente(true);
                                  }}
                                >
                                  Editar
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                  onClick={() => handleToggleClienteStatus(c)}
                                >
                                  {c.ativo ? 'Suspender' : 'Ativar'}
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
            )}

            {/* TAB: WHITELISTS E PARAMETRIZAÇÃO DE CLIENTES */}
            {activeTab === 'autorizacoes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Parâmetros e Catálogo no topo */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {/* Lado Esquerdo: Parametrização por Cliente */}
                  <div className="card" style={{ marginBottom: 0 }}>
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

                  {/* Lado Direito: Catálogo Global de Parâmetros */}
                  <div className="card" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3>Catálogo Global de Parâmetros</h3>
                      <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => {
                        setEditingGlobalParamId(null);
                        setNewParamData({
                          nome: '',
                          tipo_parametro: tiposParametrosList[0] || 'FISICO_QUIMICO',
                          unidade_default: 'mg/L',
                          obrigatorio: false
                        });
                        setShowAddParam(true);
                      }}>
                        <PlusCircle size={14} /> Novo Parâmetro
                      </button>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                      Lista global de análises e contaminantes cadastrados no catálogo do sistema.
                    </p>
                    <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: 0 }}>
                      <table className="data-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                          <tr>
                            <th>Nome</th>
                            <th>Tipo</th>
                            <th>Unidade</th>
                            <th style={{ textAlign: 'center' }}>Obrig.</th>
                            <th style={{ textAlign: 'center' }}>Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parametrosList.map(p => (
                            <tr key={p.id_parametro}>
                              <td><strong>{p.nome}</strong></td>
                              <td>
                                <span className="badge" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)' }}>
                                  {p.tipo_parametro.replace('_', ' ').toLowerCase()}
                                </span>
                              </td>
                              <td>{p.unidade_default}</td>
                              <td style={{ textAlign: 'center' }}>{p.obrigatorio ? 'Sim' : 'Não'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                                  onClick={() => {
                                    setEditingGlobalParamId(p.id_parametro);
                                    setNewParamData({
                                      nome: p.nome,
                                      tipo_parametro: p.tipo_parametro,
                                      unidade_default: p.unidade_default || '',
                                      obrigatorio: p.obrigatorio
                                    });
                                    setShowAddParam(true);
                                  }}
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Whitelists e Quotas Diárias abaixo */}
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
                              <td>{a.quota === null || a.quota === undefined || a.quota === '' ? 'Sem limite' : `${a.quota} descargas/dia`}</td>
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
                                        quota: a.quota !== null && a.quota !== undefined ? a.quota.toString() : '',
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
              </div>
            )}

            {/* TAB: DISPONIBILIDADE DE ETARS (CONTINGÊNCIA) */}
            {activeTab === 'etars' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3>Estado e Disponibilidade de ETARs</h3>
                  <button className="btn btn-primary" onClick={() => setShowAddEtar(true)}>
                    <PlusCircle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Adicionar ETAR
                  </button>
                </div>
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
                ) : (
                  <>
                    <div className="filters-container card">
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Mês</label>
                        <select className="form-input" value={filtroMesDescargas} onChange={(e) => setFiltroMesDescargas(e.target.value)} style={{ padding: '0.35rem' }}>
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
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Ano</label>
                        <select className="form-input" value={filtroAnoDescargas} onChange={(e) => setFiltroAnoDescargas(e.target.value)} style={{ padding: '0.35rem' }}>
                          <option value="all">-- Todos --</option>
                          <option value="2024">2024</option>
                          <option value="2025">2025</option>
                          <option value="2026">2026</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Período Início</label>
                        <input type="date" className="form-input" value={periodoInicioDescargas} onChange={(e) => setPeriodoInicioDescargas(e.target.value)} style={{ padding: '0.35rem' }} />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Período Fim</label>
                        <input type="date" className="form-input" value={periodoFimDescargas} onChange={(e) => setPeriodoFimDescargas(e.target.value)} style={{ padding: '0.35rem' }} />
                      </div>
                      <div className="btn-clear-wrapper">
                        <button className="btn btn-secondary" onClick={() => { setFiltroMesDescargas('all'); setFiltroAnoDescargas('all'); setPeriodoInicioDescargas(''); setPeriodoFimDescargas(''); }}>Limpar</button>
                      </div>
                    </div>
                    {descargasFiltradas.length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)' }}>
                        {hasFiltroDescargas
                          ? 'Nenhuma descarga encontrada para os filtros selecionados. Ajuste o período ou clique em Limpar.'
                          : 'Não existem descargas concluídas registadas.'}
                      </p>
                    ) : (
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Ref/Data Pedido</th>
                              <th>Cliente</th>
                              <th>ETAR Destino</th>
                              <th>Efluente</th>
                              <th>Qtd. Real (Solicitada)</th>
                              <th>Data Receção</th>
                              <th>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {descargasFiltradas.map((d) => (
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
                  </>
                )}
              </div>
            )}

            {/* TAB: HISTÓRICO DE BOLETINS ANALÍTICOS (AMOSTRAS CONCLUÍDAS) */}
            {activeTab === 'historicoAmostras' && (
                  <div>
                    <h3 style={{ marginBottom: '1.5rem' }}>Boletins Analíticos de Amostras Concluídas</h3>
                    {loading ? (
                      <p>A carregar boletins...</p>
                    ) : (
                      <>
                        <div className="filters-container card">
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Mês</label>
                            <select className="form-input" value={filtroMesAmostras} onChange={(e) => setFiltroMesAmostras(e.target.value)} style={{ padding: '0.35rem' }}>
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
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Ano</label>
                            <select className="form-input" value={filtroAnoAmostras} onChange={(e) => setFiltroAnoAmostras(e.target.value)} style={{ padding: '0.35rem' }}>
                              <option value="all">-- Todos --</option>
                              <option value="2024">2024</option>
                              <option value="2025">2025</option>
                              <option value="2026">2026</option>
                            </select>
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Período Início</label>
                            <input type="date" className="form-input" value={periodoInicioAmostras} onChange={(e) => setPeriodoInicioAmostras(e.target.value)} style={{ padding: '0.35rem' }} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Período Fim</label>
                            <input type="date" className="form-input" value={periodoFimAmostras} onChange={(e) => setPeriodoFimAmostras(e.target.value)} style={{ padding: '0.35rem' }} />
                          </div>
                          <div className="btn-clear-wrapper">
                            <button className="btn btn-secondary" onClick={() => { setFiltroMesAmostras('all'); setFiltroAnoAmostras('all'); setPeriodoInicioAmostras(''); setPeriodoFimAmostras(''); }}>Limpar</button>
                          </div>
                        </div>
                        {amostrasFiltradas.length === 0 ? (
                          <p style={{ color: 'var(--text-secondary)' }}>
                            {hasFiltroAmostras
                              ? 'Nenhum boletim encontrado para os filtros selecionados. Ajuste o período ou clique em Limpar.'
                              : 'Não existem amostras concluídas ou boletins validados.'}
                          </p>
                        ) : (
                          <div className="table-container">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Ref. Amostra</th>
                                  <th>Data Recolha</th>
                                  <th>Cliente</th>
                                  <th>ETAR</th>
                                  <th>Data Conclusão</th>
                                  <th>Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {amostrasFiltradas.map((am) => (
                                  <tr key={am.id_amostra}>
                                    <td><strong>{am.qr_code_token}</strong></td>
                                    <td>{am.data_recolha ? new Date(am.data_recolha).toLocaleDateString() : 'N/A'}</td>
                                    <td>{am.cliente_nome}</td>
                                    <td>{am.etar_nome}</td>
                                    <td>{am.data_validacao ? new Date(am.data_validacao).toLocaleDateString() : 'N/A'}</td>
                                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                                      <button
                                        className="btn btn-secondary"
                                        style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                                        onClick={() => handleVerBoletim({ id_amostra: am.id_amostra, qr_code_token: am.qr_code_token })}
                                      >
                                        <Eye size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Ver Boletim
                                      </button>
                                      <button
                                        className="btn btn-secondary"
                                        style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                                        onClick={() => handleDownloadBoletim({ id_amostra: am.id_amostra, qr_code_token: am.qr_code_token })}
                                        title="Descarregar PDF"
                                      >
                                        <Download size={14} />
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
                      </>
                    )}
                  </div>
                )}

            {/* TAB: RELATÓRIOS CONSOLIDADOS */}
            {activeTab === 'relatorios' && (
                      <div>
                        <h3 style={{ marginBottom: '1.5rem' }}>Relatórios</h3>

                        <div className="filters-container" style={{ marginBottom: '0.75rem' }}>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Período Início</label>
                            <input type="date" className="form-input" value={periodoInicioRelatorios} onChange={(e) => setPeriodoInicioRelatorios(e.target.value)} style={{ padding: '0.35rem' }} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Período Fim</label>
                            <input type="date" className="form-input" value={periodoFimRelatorios} onChange={(e) => setPeriodoFimRelatorios(e.target.value)} style={{ padding: '0.35rem' }} />
                          </div>
                          <div className="btn-clear-wrapper">
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setFiltroMesRelatorios('all');
                                setFiltroAnoRelatorios('all');
                                setPeriodoInicioRelatorios('');
                                setPeriodoFimRelatorios('');
                              }}
                            >
                              Limpar
                            </button>
                          </div>
                        </div>

                        {/* Filtros de Pesquisa */}
                        <div className="filters-container card">
                          <div>
                            <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>Cliente</label>
                            <select className="form-input" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} style={{ padding: '0.4rem' }}>
                              <option value="all">-- Todos os Clientes --</option>
                              {clientesList.map(c => (
                                <option key={c.id_cliente} value={c.id_cliente}>{c.nome}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>ETAR</label>
                            <select className="form-input" value={filtroEtar} onChange={(e) => setFiltroEtar(e.target.value)} style={{ padding: '0.4rem' }}>
                              <option value="all">-- Todas as ETARs --</option>
                              {etarsList.map(e => (
                                <option key={e.id_etar} value={e.id_etar}>{e.nome}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>Mês</label>
                            <select className="form-input" value={filtroMesRelatorios} onChange={(e) => setFiltroMesRelatorios(e.target.value)} style={{ padding: '0.4rem' }}>
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

                          <div>
                            <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>Ano</label>
                            <select className="form-input" value={filtroAnoRelatorios} onChange={(e) => setFiltroAnoRelatorios(e.target.value)} style={{ padding: '0.4rem' }}>
                              <option value="all">-- Todos --</option>
                              <option value="2025">2025</option>
                              <option value="2026">2026</option>
                              <option value="2027">2027</option>
                            </select>
                          </div>

                          <div>
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
                                  <th>Ref/Data Recolha</th>
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
                                          {r.data_rececao ? new Date(r.data_rececao).toLocaleDateString() : 'N/A'}
                                        </div>
                                      </td>
                                      <td><strong>{r.cliente_nome}</strong></td>
                                      <td>{r.etar_nome || `ETAR ${r.id_etar}`}</td>
                                      <td>
                                        <span className={`badge badge-${r.estado_descarga.toLowerCase()}`} style={{ fontSize: '0.7rem' }}>
                                          {r.estado_descarga}
                                        </span>
                                        {/* Quem autorizou/rejeitou */}
                                        {r.decisao_por_nome && ['AUTORIZADA', 'REJEITADA'].includes(r.estado_descarga) && (
                                          <div style={{
                                            fontSize: '0.68rem',
                                            color: 'var(--text-secondary)',
                                            marginTop: '0.2rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                          }}>
                                            <span style={{ opacity: 0.6 }}>👤</span>
                                            <span style={{ fontStyle: 'italic' }}>por {r.decisao_por_nome}</span>
                                          </div>
                                        )}
                                        {/* Quem recebeu */}
                                        {r.rececao_por_nome && ['RECEBIDA', 'CONCLUIDA'].includes(r.estado_descarga) && (
                                          <div style={{
                                            fontSize: '0.68rem',
                                            color: 'var(--text-secondary)',
                                            marginTop: '0.2rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px'
                                          }}>
                                            <span style={{ opacity: 0.6 }}>👤</span>
                                            <span style={{ fontStyle: 'italic' }}>recebido por {r.rececao_por_nome}</span>
                                          </div>
                                        )}
                                        {/* Quem autorizou (em estados mais avançados que AUTORIZADA) */}
                                        {r.decisao_por_nome && ['AGENDADA', 'RECEBIDA', 'CONCLUIDA'].includes(r.estado_descarga) && (
                                          <div style={{
                                            fontSize: '0.65rem',
                                            color: 'var(--text-secondary)',
                                            marginTop: '0.1rem',
                                            opacity: 0.75
                                          }}>
                                            ✓ aut. por {r.decisao_por_nome}
                                          </div>
                                        )}
                                        {r.observacoes && r.observacoes.includes('ALERTA OPERACIONAL') && (
                                          <div>
                                            <div style={{
                                              fontSize: '0.65rem',
                                              color: 'var(--danger)',
                                              backgroundColor: 'var(--danger-light)',
                                              padding: '2px 4px',
                                              borderRadius: '4px',
                                              border: '1px solid var(--danger)',
                                              marginTop: '0.2rem',
                                              whiteSpace: 'normal',
                                              lineHeight: '1.1',
                                              textAlign: 'center'
                                            }}>
                                              ⚠️ Contacto Urgente
                                            </div>
                                            <button
                                              className="btn btn-primary"
                                              style={{
                                                padding: '0.25rem 0.5rem',
                                                fontSize: '0.7rem',
                                                marginTop: '0.35rem',
                                                width: '100%',
                                                backgroundColor: 'var(--primary)',
                                                border: 'none',
                                                borderRadius: 'var(--radius-sm)'
                                              }}
                                              onClick={() => handleAbrirReencaminhar(r)}
                                            >
                                              Reencaminhar
                                            </button>
                                          </div>
                                        )}
                                        {r.observacoes && r.observacoes.includes('Revertido') && (
                                          <div style={{
                                            fontSize: '0.65rem',
                                            color: 'var(--danger)',
                                            backgroundColor: 'var(--danger-light)',
                                            padding: '2px 4px',
                                            borderRadius: '4px',
                                            border: '1px solid var(--danger)',
                                            marginTop: '0.2rem',
                                            whiteSpace: 'normal',
                                            lineHeight: '1.1'
                                          }}>
                                            ⚠️ Autorização Revertida
                                          </div>
                                        )}
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

            {/* TAB: GESTÃO DE UTILIZADORES INTERNOS */}
            {activeTab === 'utilizadores' && user.perfil === 'GESTOR_ADMIN' && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <h3>Gestão de Utilizadores Internos</h3>
                          <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                              onClick={() => {
                                setEditingPerfilId(null);
                                setNewPerfilData({ nome: '' });
                                setShowPerfisModal(true);
                              }}
                            >
                              Gerir Perfis
                            </button>
                            <button
                              className="btn btn-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                              onClick={() => {
                                setEditingUtilizadorId(null);
                                setNewUtilizadorData({
                                  nome: '',
                                  email: '',
                                  id_perfil: '2',
                                  id_etar: '',
                                  password: '',
                                  ativo: true
                                });
                                setShowAddUtilizador(true);
                              }}
                            >
                              <PlusCircle size={18} /> Adicionar Utilizador
                            </button>
                          </div>
                        </div>

                        {loading ? (
                          <p>A ler utilizadores...</p>
                        ) : utilizadoresList.length === 0 ? (
                          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                            <p style={{ color: 'var(--text-secondary)' }}>Nenhum utilizador interno registado no sistema.</p>
                          </div>
                        ) : (
                          <div className="table-container">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Nome</th>
                                  <th>Perfil / Cargo</th>
                                  <th>Email</th>
                                  <th>ETAR Associada</th>
                                  <th>Estado</th>
                                  <th>Ações</th>
                                </tr>
                              </thead>
                              <tbody>
                                {utilizadoresList.map((u) => (
                                  <tr key={u.id_utilizador}>
                                    <td><strong>{u.nome}</strong></td>
                                    <td>
                                      <span className="badge badge-info" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                                        {u.perfil_nome ? u.perfil_nome.replace('_', ' ').toLowerCase() : 'N/A'}
                                      </span>
                                    </td>
                                    <td>{u.email}</td>
                                    <td>
                                      {u.id_etar ? (
                                        <span>{u.etar_nome || `ETAR #${u.id_etar}`}</span>
                                      ) : (
                                        <span style={{ color: 'var(--text-secondary)' }}>-</span>
                                      )}
                                    </td>
                                    <td>
                                      <span className={`badge badge-${u.ativo ? 'success' : 'danger'}`} style={{ fontSize: '0.75rem' }}>
                                        {u.ativo ? 'Ativo' : 'Suspenso'}
                                      </span>
                                    </td>
                                    <td>
                                      <button
                                        className="btn btn-primary"
                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                        onClick={() => {
                                          setEditingUtilizadorId(u.id_utilizador);
                                          setNewUtilizadorData({
                                            nome: u.nome,
                                            email: u.email,
                                            id_perfil: String(u.id_perfil),
                                            id_etar: u.id_etar ? String(u.id_etar) : '',
                                            password: '',
                                            ativo: !!u.ativo
                                          });
                                          setShowAddUtilizador(true);
                                        }}
                                      >
                                        Editar
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

            {/* TAB: AUDITORIA DO SISTEMA */}
            {activeTab === 'auditoria' && user.perfil === 'GESTOR_ADMIN' && (
                      <div>
                        <h3 style={{ marginBottom: '1.5rem' }}>Auditoria do Sistema (Logs de Rastreabilidade)</h3>

                        {/* Filtros de Pesquisa */}
                        <div className="filters-container card">
                          <div>
                            <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>Filtrar por Entidade</label>
                            <select className="form-input" value={filtroAuditEntidade} onChange={(e) => setFiltroAuditEntidade(e.target.value)} style={{ padding: '0.4rem' }}>
                              <option value="all">-- Todas as Entidades --</option>
                              <option value="DESCARGA">Descargas</option>
                              <option value="AMOSTRA">Amostras</option>
                              <option value="CLIENTE">Clientes</option>
                              <option value="UTILIZADOR">Utilizadores</option>
                              <option value="AUTORIZACAO">Whitelists / Autorizações</option>
                              <option value="ETAR">ETARs</option>
                              <option value="PARAMETRO">Parâmetros</option>
                              <option value="PERFIL">Perfis</option>
                              <option value="SISTEMA">Sistema</option>
                            </select>
                          </div>

                          <div>
                            <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>Filtrar por Ação</label>
                            <select className="form-input" value={filtroAuditAcao} onChange={(e) => setFiltroAuditAcao(e.target.value)} style={{ padding: '0.4rem' }}>
                              <option value="all">-- Todas as Ações --</option>
                              <option value="PEDIDO">Pedidos de Descarga</option>
                              <option value="AUTORIZACAO">Autorizações</option>
                              <option value="REJEICAO">Rejeições</option>
                              <option value="PEDIDO_ELEMENTOS">Pedido de Elementos</option>
                              <option value="AGENDAMENTO">Agendamentos</option>
                              <option value="RECECAO">Receções</option>
                              <option value="VALIDACAO">Validações de Boletins</option>
                              <option value="DISPONIBILIZACAO">Disponibilizações</option>
                              <option value="CANCELAMENTO">Cancelamentos</option>
                              <option value="EDICAO">Edições</option>
                              <option value="CRIACAO">Criações</option>
                              <option value="ALTERACAO_STATUS">Alterações de Estado</option>
                            </select>
                          </div>

                          <div style={{ flexGrow: 2 }}>
                            <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.8rem' }}>Pesquisa por utilizador ou descrição</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Pesquise por nome, email ou detalhes do log..."
                              value={pesquisaAudit}
                              onChange={(e) => setPesquisaAudit(e.target.value)}
                              style={{ padding: '0.4rem' }}
                            />
                          </div>
                        </div>

                        {loading ? (
                          <p>A ler logs de auditoria...</p>
                        ) : auditoriaList.length === 0 ? (
                          <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
                            <p style={{ color: 'var(--text-secondary)' }}>Nenhum log de auditoria encontrado para os filtros selecionados.</p>
                          </div>
                        ) : (
                          <div className="table-container">
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Ref</th>
                                  <th>Data / Hora</th>
                                  <th>Utilizador</th>
                                  <th>Entidade</th>
                                  <th>Ação</th>
                                  <th>Descrição / Detalhes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {auditoriaList.map((log) => {
                                  // Definir cores das entidades
                                  let entityColor = 'var(--text-secondary)';
                                  let entityBg = 'var(--bg-base)';
                                  if (log.entidade === 'DESCARGA') {
                                    entityColor = '#2563eb';
                                    entityBg = '#dbeafe';
                                  } else if (log.entidade === 'AMOSTRA') {
                                    entityColor = '#7c3aed';
                                    entityBg = '#f3e8ff';
                                  } else if (log.entidade === 'CLIENTE') {
                                    entityColor = '#059669';
                                    entityBg = '#d1fae5';
                                  } else if (log.entidade === 'UTILIZADOR') {
                                    entityColor = '#db2777';
                                    entityBg = '#fce7f3';
                                  } else if (log.entidade === 'AUTORIZACAO') {
                                    entityColor = '#d97706';
                                    entityBg = '#fef3c7';
                                  } else if (log.entidade === 'ETAR') {
                                    entityColor = '#0d9488';
                                    entityBg = '#ccfbf1';
                                  } else if (log.entidade === 'PARAMETRO') {
                                    entityColor = '#0891b2';
                                    entityBg = '#ecfeff';
                                  } else if (log.entidade === 'PERFIL') {
                                    entityColor = '#4b5563';
                                    entityBg = '#f3f4f6';
                                  } else if (log.entidade === 'SISTEMA') {
                                    entityColor = '#ea580c';
                                    entityBg = '#ffedd5';
                                  }

                                  // Definir cores das ações
                                  let actionClass = 'badge-info';
                                  if (log.acao.includes('AUTORIZACAO') || log.acao.includes('VALIDACAO') || log.acao.includes('CRIACAO')) {
                                    actionClass = 'badge-autorizada';
                                  } else if (log.acao.includes('REJEICAO') || log.acao.includes('CANCELAMENTO') || log.acao.includes('SUSPENSAO')) {
                                    actionClass = 'badge-rejeitada';
                                  } else if (log.acao.includes('EDICAO') || log.acao.includes('ALTERACAO')) {
                                    actionClass = 'badge-solicitada';
                                  }

                                  return (
                                    <tr key={log.id_historico}>
                                      <td><strong>#{log.id_historico}</strong></td>
                                      <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                        {new Date(log.data).toLocaleString()}
                                      </td>
                                      <td>
                                        <div><strong>{log.utilizador_nome}</strong></div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.utilizador_email}</div>
                                        <span className="badge" style={{ fontSize: '0.65rem', marginTop: '0.15rem', padding: '1px 4px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}>
                                          {log.utilizador_perfil.replace('_', ' ').toLowerCase()}
                                        </span>
                                      </td>
                                      <td>
                                        <span className="badge" style={{
                                          color: entityColor,
                                          backgroundColor: entityBg,
                                          border: `1px solid ${entityColor}`,
                                          fontSize: '0.75rem',
                                          textTransform: 'capitalize'
                                        }}>
                                          {log.entidade.toLowerCase()} #{log.id_entidade}
                                        </span>
                                      </td>
                                      <td>
                                        <span className={`badge ${actionClass}`} style={{ fontSize: '0.75rem' }}>
                                          {log.acao.replace('_', ' ')}
                                        </span>
                                      </td>
                                      <td style={{ fontSize: '0.85rem', maxWidth: '350px', wordBreak: 'break-word' }}>
                                        {log.descricao}
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
                      {user.perfil === 'RESPONSAVEL_LAB' && (
                        <button className={`tab-btn ${activeTab === 'catalogo' ? 'active' : ''}`} onClick={() => { setActiveTab('catalogo'); setError(''); setSuccess(''); }}>
                          Catálogo de Parâmetros
                        </button>
                      )}
                    </div>

                    {loading ? (
                      <p>A carregar registos...</p>
                    ) : activeTab === 'catalogo' && user.perfil === 'RESPONSAVEL_LAB' ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <div>
                            <h3 style={{ marginBottom: '0.25rem' }}>Catálogo de Parâmetros Analíticos</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              Consulte e edite a metodologia padrão e incerteza base de cada parâmetro. Estas configurações são aplicadas automaticamente quando o técnico de laboratório regista os ensaios.
                            </p>
                          </div>
                        </div>
                        <div className="table-container">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Parâmetro</th>
                                <th>Tipo</th>
                                <th>Unidade</th>
                                <th>Código do Método</th>
                                <th>Nome do Método</th>
                                <th style={{ textAlign: 'center' }}>Incerteza Padrão (%)</th>
                                <th style={{ textAlign: 'center' }}>Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.isArray(parametrosList) && parametrosList.map((p) => (
                                <tr key={p.id_parametro}>
                                  <td><strong>{p.nome}</strong>{p.obrigatorio && <span className="badge badge-info" style={{ marginLeft: '6px', fontSize: '0.7rem' }}>Obrig.</span>}</td>
                                  <td><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.tipo_parametro}</span></td>
                                  <td>{p.unidade_default || '-'}</td>
                                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{p.metodo_default_cod || <span style={{ color: 'var(--text-secondary)' }}>-</span>}</td>
                                  <td style={{ fontSize: '0.85rem' }}>{p.metodo_default_nome || <span style={{ color: 'var(--text-secondary)' }}>-</span>}</td>
                                  <td style={{ textAlign: 'center' }}>
                                    {p.incerteza_default !== null && p.incerteza_default !== undefined
                                      ? <strong>{(parseFloat(p.incerteza_default) * 100).toFixed(1)}%</strong>
                                      : <span style={{ color: 'var(--text-secondary)' }}>-</span>
                                    }
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      className="btn btn-primary"
                                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                                      onClick={() => {
                                        setEditingParamCatalogData({
                                          id_parametro: p.id_parametro,
                                          nome: p.nome,
                                          metodo_default_cod: p.metodo_default_cod || '',
                                          metodo_default_nome: p.metodo_default_nome || '',
                                          incerteza_default: p.incerteza_default !== null && p.incerteza_default !== undefined
                                            ? String(parseFloat(p.incerteza_default))
                                            : ''
                                        });
                                        setShowEditParamCatalog(true);
                                        setError('');
                                        setSuccess('');
                                      }}
                                    >
                                      Editar
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
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
                                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => handleOpenValidacao(am, true)}>
                                      Visualizar
                                    </button>
                                    <button className="btn btn-primary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => handleOpenValidacao(am, false)}>
                                      Validar
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : (
                      <>
                        <div className="filters-container card">
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Mês</label>
                            <select className="form-input" value={filtroMesConcluidasLab} onChange={(e) => setFiltroMesConcluidasLab(e.target.value)} style={{ padding: '0.35rem' }}>
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
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Ano</label>
                            <select className="form-input" value={filtroAnoConcluidasLab} onChange={(e) => setFiltroAnoConcluidasLab(e.target.value)} style={{ padding: '0.35rem' }}>
                              <option value="all">-- Todos --</option>
                              <option value="2024">2024</option>
                              <option value="2025">2025</option>
                              <option value="2026">2026</option>
                            </select>
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Período Início</label>
                            <input type="date" className="form-input" value={periodoInicioConcluidasLab} onChange={(e) => setPeriodoInicioConcluidasLab(e.target.value)} style={{ padding: '0.35rem' }} />
                          </div>
                          <div>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Período Fim</label>
                            <input type="date" className="form-input" value={periodoFimConcluidasLab} onChange={(e) => setPeriodoFimConcluidasLab(e.target.value)} style={{ padding: '0.35rem' }} />
                          </div>
                          <div style={{ flexGrow: 2 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Pesquisar amostra</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Ref., ID, cliente ou ETAR..."
                              value={pesquisaConcluidasLab}
                              onChange={(e) => setPesquisaConcluidasLab(e.target.value)}
                              style={{ padding: '0.35rem' }}
                            />
                          </div>
                          <div className="btn-clear-wrapper">
                            <button
                              className="btn btn-secondary"
                              onClick={() => {
                                setFiltroMesConcluidasLab('all');
                                setFiltroAnoConcluidasLab('all');
                                setPeriodoInicioConcluidasLab('');
                                setPeriodoFimConcluidasLab('');
                                setPesquisaConcluidasLab('');
                              }}
                            >
                              Limpar
                            </button>
                          </div>
                        </div>
                        {concluidasFiltradas.length === 0 ? (
                          <p style={{ color: 'var(--text-secondary)' }}>
                            {hasFiltroConcluidasLab
                              ? 'Nenhum boletim encontrado para os filtros selecionados. Ajuste a pesquisa ou clique em Limpar.'
                              : 'Sem boletins concluídos em arquivo.'}
                          </p>
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
                                {concluidasFiltradas.map((am) => (
                                  <tr key={am.id_amostra}>
                                    <td><strong>{am.qr_code_token}</strong></td>
                                    <td>{am.cliente_nome}</td>
                                    <td>{am.etar_nome}</td>
                                    <td>{am.data_validacao ? new Date(am.data_validacao).toLocaleDateString() : 'N/A'}</td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-primary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem', backgroundColor: 'var(--success)' }} onClick={() => handleVerBoletim({ id_amostra: am.id_amostra, qr_code_token: am.qr_code_token })}>
                                          <Eye size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> Ver Boletim
                                        </button>
                                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => handleDownloadBoletim({ id_amostra: am.id_amostra, qr_code_token: am.qr_code_token })} title="Descarregar PDF">
                                          <Download size={14} />
                                        </button>
                                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => handleOpenValidacao(am, true)}>
                                          Visualizar
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Modal: Editar Parâmetro no Catálogo Analítico (Responsável Lab) */}
                {showEditParamCatalog && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '500px', marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                          <h3 style={{ marginBottom: '0.25rem' }}>Editar Parâmetro: {editingParamCatalogData.nome}</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            As alterações aplicam-se apenas a futuros registos. Os boletins já validados não são afetados.
                          </p>
                        </div>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowEditParamCatalog(false)}><X size={20} /></button>
                      </div>
                      <form onSubmit={handleSaveParamCatalog}>
                        <div className="form-group">
                          <label className="form-label">Código do Método (ex: SMEWW 4500-H+)</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: SMEWW 5220 B"
                            value={editingParamCatalogData.metodo_default_cod}
                            onChange={e => setEditingParamCatalogData({ ...editingParamCatalogData, metodo_default_cod: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Nome do Método (ex: Refluxo Fechado / Titulometria)</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: Eletrometria"
                            value={editingParamCatalogData.metodo_default_nome}
                            onChange={e => setEditingParamCatalogData({ ...editingParamCatalogData, metodo_default_nome: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Incerteza Padrão (em decimal — ex: 0.05 para 5%)</label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="number"
                              className="form-input"
                              placeholder="Ex: 0.05"
                              step="0.001"
                              min="0"
                              max="1"
                              value={editingParamCatalogData.incerteza_default}
                              onChange={e => setEditingParamCatalogData({ ...editingParamCatalogData, incerteza_default: e.target.value })}
                              style={{ flex: 1 }}
                            />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {editingParamCatalogData.incerteza_default !== '' && editingParamCatalogData.incerteza_default !== null && !isNaN(parseFloat(editingParamCatalogData.incerteza_default))
                                ? `= ${(parseFloat(editingParamCatalogData.incerteza_default) * 100).toFixed(1)}%`
                                : ''}
                            </span>
                          </div>
                          <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                            A incerteza absoluta é calculada automaticamente como: valor × percentagem (ex: CQO 100 mg/L × 5% = ±5 mg/L)
                          </small>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                          <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Gravar Alterações</button>
                          <button type="button" className="btn btn-secondary" onClick={() => setShowEditParamCatalog(false)}>Cancelar</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}


                {selectedReencaminharDescarga && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: '100%', maxWidth: '480px', marginBottom: 0 }}>
                      <h3>Reencaminhar Descarga Agendada</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '0.5rem 0 1.2rem 0' }}>
                        Transfira a descarga <strong>#{selectedReencaminharDescarga.id_descarga}</strong> da <strong>{selectedReencaminharDescarga.cliente_nome}</strong> para outra ETAR devido a indisponibilidade.
                      </p>

                      <div style={{ backgroundColor: 'var(--bg-base)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                        <div><strong>Origem Atual:</strong> {selectedReencaminharDescarga.etar_nome || `ETAR ${selectedReencaminharDescarga.id_etar}`}</div>
                        <div><strong>Volume:</strong> {selectedReencaminharDescarga.quantidade} Litros</div>
                        <div><strong>Veículo:</strong> {selectedReencaminharDescarga.empresa_transportadora || 'N/A'} (Trator: {selectedReencaminharDescarga.matricula_trator || 'N/A'})</div>
                      </div>

                      <form onSubmit={handleReencaminharSubmeter}>
                        <div className="form-group">
                          <label className="form-label">ETAR de Destino</label>
                          <select
                            className="form-input"
                            value={reencaminharEtarId}
                            onChange={(e) => handleEtarReencaminharChange(e.target.value)}
                            required
                          >
                            <option value="">-- Selecione a ETAR --</option>
                            {etarsList
                              .filter(e => e.id_etar !== selectedReencaminharDescarga.id_etar && e.disponivel)
                              .map(e => {
                                const temWl = clienteTemWhitelist(selectedReencaminharDescarga.id_cliente, e.id_etar);
                                return (
                                  <option key={e.id_etar} value={e.id_etar}>
                                    {e.nome} {temWl ? '(Autorizada)' : '(Não Autorizada)'}
                                  </option>
                                );
                              })
                            }
                          </select>
                        </div>

                        {exibirOpcaoForcar && (
                          <div className="card" style={{
                            backgroundColor: 'var(--warning-light)',
                            color: 'var(--warning)',
                            padding: '0.75rem',
                            marginBottom: '1rem',
                            borderLeft: '4px solid var(--warning)',
                            fontSize: '0.85rem',
                            borderRadius: 'var(--radius-sm)'
                          }}>
                            <strong>Aviso de Autorização Excecional:</strong>
                            <div style={{ marginTop: '0.25rem', marginBottom: '0.5rem', lineHeight: '1.2' }}>
                              O cliente não possui whitelist ou quota ativa para esta ETAR. É necessário forçar o reencaminhamento.
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: '500' }}>
                              <input
                                type="checkbox"
                                checked={reencaminharForcar}
                                onChange={(e) => setReencaminharForcar(e.target.checked)}
                              />
                              Confirmar reencaminhamento forçado
                            </label>
                          </div>
                        )}

                        <div className="form-group">
                          <label className="form-label">Motivo / Justificação</label>
                          <textarea
                            className="form-input"
                            style={{ minHeight: '70px', resize: 'vertical' }}
                            placeholder="Descreva o motivo ou acordo de reagendamento com o cliente..."
                            value={reencaminharObservacoes}
                            onChange={(e) => setReencaminharObservacoes(e.target.value)}
                            required
                          ></textarea>
                        </div>

                        {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ flex: 1, backgroundColor: 'var(--success)', border: 'none' }}
                            disabled={reencaminharLoading || (exibirOpcaoForcar && !reencaminharForcar)}
                          >
                            {reencaminharLoading ? 'A processar...' : 'Confirmar'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ flex: 1 }}
                            onClick={() => setSelectedReencaminharDescarga(null)}
                            disabled={reencaminharLoading}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}


                {selectedDescarga && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: '100%', maxWidth: '480px', marginBottom: 0 }}>
                      <h3>Decidir Pedido de Descarga</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.5rem 0 1.5rem 0' }}>
                        Aprove ou rejeite o pedido da <strong>{selectedDescarga.cliente_nome}</strong> para a <strong>{selectedDescarga.etar_nome}</strong> (Qtd: {selectedDescarga.quantidade} Litros).
                      </p>

                      {selectedDescarga.observacoes && (
                        <div className="card" style={{
                          backgroundColor: selectedDescarga.observacoes.includes('Revertido') ? 'var(--danger-light)' : 'var(--warning-light)',
                          color: selectedDescarga.observacoes.includes('Revertido') ? 'var(--danger)' : 'var(--warning)',
                          padding: '0.75rem',
                          marginBottom: '1rem',
                          borderLeft: selectedDescarga.observacoes.includes('Revertido') ? '4px solid var(--danger)' : '4px solid var(--warning)',
                          fontSize: '0.85rem',
                          borderRadius: 'var(--radius-sm)'
                        }}>
                          <strong>{selectedDescarga.observacoes.includes('Revertido') ? 'Alerta de Reversão de Urgência:' : 'Elementos Solicitados Anteriormente:'}</strong>
                          <div style={{ marginTop: '0.25rem', fontStyle: 'italic', wordBreak: 'break-word' }}>
                            "{selectedDescarga.observacoes}"
                          </div>
                        </div>
                      )}

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
                          <HelpCircle size={16} /> Pedir mais elementos
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
                    <div className="card" style={{ width: '100%', maxWidth: isViewOnly ? '560px' : '820px', marginBottom: 0, overflowY: 'auto', maxHeight: '90vh', transition: 'max-width 0.3s ease-in-out' }}>
                      <h3>{isViewOnly ? 'Visualizar Resultados Analíticos' : 'Validar Boletim Analítico'}</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        {isViewOnly
                          ? `Resultados laboratoriais concluídos para a amostra ${selectedAmostra.amostra.qr_code_token}.`
                          : `Revise os resultados laboratoriais registados para a amostra ${selectedAmostra.amostra.qr_code_token}.`
                        }
                      </p>

                      <div style={{ backgroundColor: 'var(--bg-base)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <strong>Detalhes:</strong>
                          <div>Cliente: {selectedAmostra.amostra.cliente_nome}</div>
                          <div>Volume Real: {selectedAmostra.amostra.quantidade_real} Litros</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div>Data de Recolha: {new Date(selectedAmostra.amostra.data_recolha).toLocaleDateString()}</div>
                          {selectedAmostra.amostra.data_validacao && (
                            <div>Validado em: {new Date(selectedAmostra.amostra.data_validacao).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>

                      <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Parâmetro</th>
                              <th>Valor Medido</th>
                              <th>Metodologia</th>
                              <th>Incerteza</th>
                              {!isViewOnly && <th style={{ textAlign: 'center' }}>Ação</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {editResultados.map((r) => {
                              const isEditing = editingParamId === r.id_parametro;
                              return (
                                <tr key={r.id_resultado || r.id_parametro}>
                                  <td style={{ verticalAlign: 'middle', fontWeight: '500' }}>{r.parametro_nome}</td>
                                  <td style={{ verticalAlign: 'middle' }}>
                                    {isEditing ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <input
                                          type="number"
                                          step="any"
                                          className="form-input"
                                          style={{ width: '85px', padding: '0.3rem', margin: 0 }}
                                          value={r.valor}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setEditResultados(prev => prev.map(item => item.id_parametro === r.id_parametro ? { ...item, valor: val } : item));
                                          }}
                                        />
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.unidade}</span>
                                      </div>
                                    ) : (
                                      <div>
                                        <strong>{Number(r.valor).toFixed(2)}</strong> <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.unidade}</span>
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ verticalAlign: 'middle' }}>
                                    {isEditing ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <input
                                          type="text"
                                          className="form-input"
                                          style={{ width: '130px', padding: '0.3rem', margin: 0 }}
                                          placeholder="ex: SMEWW"
                                          value={r.metodo}
                                          onChange={(e) => {
                                            const m = e.target.value;
                                            setEditResultados(prev => prev.map(item => item.id_parametro === r.id_parametro ? { ...item, metodo: m } : item));
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          style={{ padding: '0.3rem', minWidth: 'auto', display: 'flex', alignItems: 'center' }}
                                          title="Definir esta metodologia como padrão para o catálogo"
                                          onClick={() => handleDefinirMetodoPadrao(r.id_parametro, r.metodo)}
                                        >
                                          <Settings size={14} />
                                        </button>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '0.85rem' }}>
                                        <span>{r.metodo || <span style={{ color: 'var(--text-secondary)' }}>-</span>}</span>
                                        {r.metodo && !isViewOnly && (
                                          <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }}
                                            title="Definir esta metodologia como padrão para o catálogo"
                                            onClick={() => handleDefinirMetodoPadrao(r.id_parametro, r.metodo)}
                                          >
                                            <Settings size={12} /> Usar como Padrão
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ verticalAlign: 'middle' }}>
                                    {isEditing ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <input
                                          type="number"
                                          step="any"
                                          className="form-input"
                                          style={{ width: '80px', padding: '0.3rem', margin: 0 }}
                                          placeholder="Incerteza"
                                          value={r.incerteza}
                                          onChange={(e) => {
                                            const inc = e.target.value;
                                            setEditResultados(prev => prev.map(item => item.id_parametro === r.id_parametro ? { ...item, incerteza: inc } : item));
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: '0.85rem' }}>
                                        {r.incerteza !== '' && r.incerteza !== null && r.incerteza !== undefined ? (
                                          Number(r.incerteza) < 1
                                            ? `±${Math.round(Number(r.incerteza) * 100)}%`
                                            : `±${Math.round(Number(r.incerteza))}%`
                                        ) : (
                                          <span style={{ color: 'var(--text-secondary)' }}>-</span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  {!isViewOnly && (
                                    <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                                      {isEditing ? (
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                          <button
                                            type="button"
                                            className="btn btn-primary"
                                            style={{ padding: '0.25rem 0.4rem', backgroundColor: 'var(--success)', minWidth: 'auto' }}
                                            onClick={() => setEditingParamId(null)}
                                            title="Confirmar"
                                          >
                                            <Check size={14} />
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-secondary"
                                            style={{ padding: '0.25rem 0.4rem', minWidth: 'auto' }}
                                            onClick={() => {
                                              const orig = selectedAmostra.resultados.find(orig => orig.id_parametro === r.id_parametro);
                                              setEditResultados(prev => prev.map(item => item.id_parametro === r.id_parametro ? {
                                                ...item,
                                                valor: orig.valor,
                                                metodo: orig.metodo || '',
                                                incerteza: orig.incerteza || ''
                                              } : item));
                                              setEditingParamId(null);
                                            }}
                                            title="Cancelar"
                                          >
                                            <X size={14} />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-secondary"
                                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', minWidth: 'auto' }}
                                          onClick={() => setEditingParamId(r.id_parametro)}
                                        >
                                          Editar
                                        </button>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                        {!isViewOnly ? (
                          <>
                            <button className="btn btn-primary" style={{ flex: 1, minWidth: '150px' }} onClick={() => handleSaveEdits(false)}>
                              Gravar Alterações
                            </button>
                            <button className="btn btn-primary" style={{ flex: 1, minWidth: '220px', backgroundColor: 'var(--success)' }} onClick={() => handleSaveEdits(true)}>
                              <ShieldCheck size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> Validar e Assinar Boletim
                            </button>
                          </>
                        ) : null}
                        <button className="btn btn-secondary" style={{ flex: isViewOnly ? 1 : 'none', minWidth: '80px' }} onClick={() => setSelectedAmostra(null)}>
                          {isViewOnly ? 'Fechar' : 'Cancelar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal: Adicionar/Editar Cliente */}
                {showAddCliente && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', marginBottom: 0, maxHeight: '90vh', overflowY: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3>{editingClienteId ? 'Editar Cliente Contratado' : 'Registar Novo Cliente Contratado'}</h3>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => { setShowAddCliente(false); setEditingClienteId(null); setNewClienteData({ nome: '', morada: '', contacto: '', telefone: '', email: '', password: '', periodicidade_analise: 'POR_DESCARGA' }); }}><X size={20} /></button>
                      </div>
                      <form onSubmit={handleSaveCliente}>
                        <div className="form-group">
                          <label className="form-label">Nome da Empresa / Cliente *</label>
                          <input type="text" className="form-input" placeholder="Ex: Lavandarias Reunidas SA" required value={newClienteData.nome} onChange={e => setNewClienteData({ ...newClienteData, nome: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Email Principal (Acesso) *</label>
                          <input type="email" className="form-input" placeholder="geral@empresa.com" required value={newClienteData.email} onChange={e => setNewClienteData({ ...newClienteData, email: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">
                            {editingClienteId
                              ? 'Alterar Palavra-passe do Cliente (Opcional - deixar em branco para manter)'
                              : 'Palavra-passe (Opcional - por omissão: Descargas123!)'}
                          </label>
                          <input
                            type="password"
                            className="form-input"
                            placeholder={editingClienteId ? "Deixe em branco para manter" : "Introduza a password"}
                            value={newClienteData.password || ''}
                            onChange={e => setNewClienteData({ ...newClienteData, password: e.target.value })}
                          />
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
                          <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editingClienteId ? 'Gravar Alterações' : 'Confirmar Contrato'}</button>
                          <button type="button" className="btn btn-secondary" onClick={() => { setShowAddCliente(false); setEditingClienteId(null); setNewClienteData({ nome: '', morada: '', contacto: '', telefone: '', email: '', password: '', periodicidade_analise: 'POR_DESCARGA' }); }}>Cancelar</button>
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
                          <label className="form-label">Quota Diária de Descargas (Deixe em branco para 'Sem limite')</label>
                          <input type="number" className="form-input" min="1" value={newAutorizacaoData.quota} onChange={e => setNewAutorizacaoData({ ...newAutorizacaoData, quota: e.target.value })} />
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

                {/* Modal: Adicionar/Editar Utilizador Interno */}
                {showAddUtilizador && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '480px', marginBottom: 0, maxHeight: '90vh', overflowY: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3>{editingUtilizadorId ? 'Editar Utilizador Interno' : 'Registar Novo Utilizador Interno'}</h3>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => setShowAddUtilizador(false)}
                        >
                          <X size={20} />
                        </button>
                      </div>

                      <form onSubmit={handleSaveUtilizador}>
                        <div className="form-group">
                          <label className="form-label">Nome Completo *</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: Carlos Silva"
                            required
                            disabled={!!editingUtilizadorId}
                            value={newUtilizadorData.nome}
                            onChange={e => setNewUtilizadorData({ ...newUtilizadorData, nome: e.target.value })}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Endereço de Email (Acesso) *</label>
                          <input
                            type="email"
                            className="form-input"
                            placeholder="carlos.silva@etar.pt"
                            required
                            value={newUtilizadorData.email}
                            onChange={e => setNewUtilizadorData({ ...newUtilizadorData, email: e.target.value })}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Perfil / Permissões de Acesso *</label>
                          <select
                            className="form-input"
                            required
                            value={newUtilizadorData.id_perfil}
                            onChange={e => setNewUtilizadorData({ ...newUtilizadorData, id_perfil: e.target.value, id_etar: (e.target.value !== '2' && e.target.value !== '3') ? '' : newUtilizadorData.id_etar })}
                          >
                            {perfisList.length > 0 ? (
                              perfisList
                                .filter(p => Number(p.id_perfil) !== 1)
                                .map(p => (
                                  <option key={p.id_perfil} value={String(p.id_perfil)}>
                                    {p.nome.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                                  </option>
                                ))
                            ) : (
                              <>
                                <option value="2">Operador de ETAR</option>
                                <option value="3">Responsável de ETAR</option>
                                <option value="4">Técnico de Laboratório</option>
                                <option value="5">Responsável de Laboratório</option>
                                <option value="6">Gestor de Clientes</option>
                                <option value="7">Gestor Admin</option>
                              </>
                            )}
                          </select>
                        </div>

                        {(newUtilizadorData.id_perfil === '2' || newUtilizadorData.id_perfil === '3') && (
                          <div className="form-group">
                            <label className="form-label">ETAR Associada *</label>
                            <select
                              className="form-input"
                              required
                              value={newUtilizadorData.id_etar}
                              onChange={e => setNewUtilizadorData({ ...newUtilizadorData, id_etar: e.target.value })}
                            >
                              <option value="">-- Escolha uma ETAR --</option>
                              {etarsList.map(e => (
                                <option key={e.id_etar} value={e.id_etar}>{e.nome}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="form-group">
                          <label className="form-label">
                            {editingUtilizadorId
                              ? 'Alterar Palavra-passe (Opcional - deixar em branco para manter)'
                              : 'Palavra-passe (Opcional - por omissão: Descargas123!)'}
                          </label>
                          <input
                            type="password"
                            className="form-input"
                            placeholder={editingUtilizadorId ? "Deixe em branco para manter" : "Introduza a palavra-passe"}
                            value={newUtilizadorData.password || ''}
                            onChange={e => setNewUtilizadorData({ ...newUtilizadorData, password: e.target.value })}
                          />
                        </div>

                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
                          <input
                            type="checkbox"
                            id="utilizador_ativo"
                            checked={!!newUtilizadorData.ativo}
                            onChange={e => setNewUtilizadorData({ ...newUtilizadorData, ativo: e.target.checked })}
                          />
                          <label htmlFor="utilizador_ativo" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                            Conta de Utilizador Ativa (Permite login)
                          </label>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                          <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                            {editingUtilizadorId ? 'Gravar Alterações' : 'Criar Utilizador'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setShowAddUtilizador(false)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Modal: Adicionar Nova ETAR */}
                {showAddEtar && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '450px', marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3>Registar Nova ETAR</h3>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowAddEtar(false)}><X size={20} /></button>
                      </div>
                      <form onSubmit={handleSaveEtar}>
                        <div className="form-group">
                          <label className="form-label">Nome da ETAR *</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: ETAR Leste"
                            required
                            value={newEtarData.nome}
                            onChange={e => setNewEtarData({ ...newEtarData, nome: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Localização (Concelho/Cidade)</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: Vila Real"
                            value={newEtarData.localizacao}
                            onChange={e => setNewEtarData({ ...newEtarData, localizacao: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                          <input
                            type="checkbox"
                            id="etar-disponivel-check"
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                            checked={newEtarData.disponivel}
                            onChange={e => setNewEtarData({ ...newEtarData, disponivel: e.target.checked })}
                          />
                          <label htmlFor="etar-disponivel-check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                            <strong>Ativa / Disponível para receber descargas</strong>
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                          <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Gravar ETAR</button>
                          <button type="button" className="btn btn-secondary" onClick={() => setShowAddEtar(false)}>Cancelar</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Modal: Adicionar Novo Parâmetro Analítico */}
                {showAddParam && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '450px', marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3>{editingGlobalParamId ? 'Editar Parâmetro' : 'Registar Novo Parâmetro'}</h3>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => { setShowAddParam(false); setEditingGlobalParamId(null); setShowAddTypeInline(false); setNewTypeName(''); }}><X size={20} /></button>
                      </div>
                      <form onSubmit={handleSaveParam}>
                        <div className="form-group">
                          <label className="form-label">Nome do Parâmetro *</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: CBO5"
                            required
                            value={newParamData.nome}
                            onChange={e => setNewParamData({ ...newParamData, nome: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label className="form-label" style={{ marginBottom: 0 }}>Tipo de Parâmetro *</label>
                            <button
                              type="button"
                              className="btn-link"
                              style={{ fontSize: '0.8rem', background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}
                              onClick={() => setShowAddTypeInline(!showAddTypeInline)}
                            >
                              {showAddTypeInline ? 'Cancelar' : '+ Novo Tipo'}
                            </button>
                          </div>
                          {!showAddTypeInline ? (
                            <select
                              className="form-input"
                              required
                              value={newParamData.tipo_parametro}
                              onChange={e => setNewParamData({ ...newParamData, tipo_parametro: e.target.value })}
                            >
                              {tiposParametrosList.map(type => (
                                <option key={type} value={type}>
                                  {type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="text"
                                className="form-input"
                                style={{ margin: 0, flex: 1 }}
                                placeholder="Ex: Microbiologia"
                                value={newTypeName}
                                onChange={e => setNewTypeName(e.target.value)}
                              />
                              <button
                                type="button"
                                className="btn btn-primary"
                                style={{ padding: '0.4rem 0.8rem', minWidth: 'auto' }}
                                onClick={async () => {
                                  if (!newTypeName.trim()) return;
                                  try {
                                    const res = await adminService.criarTipoParametro(newTypeName);
                                    const newType = res.tipo;
                                    // Adicionar à lista local de tipos
                                    setTiposParametrosList(prev => [...prev, newType].sort());
                                    // Selecionar o novo tipo criado
                                    setNewParamData(prev => ({ ...prev, tipo_parametro: newType }));
                                    setNewTypeName('');
                                    setShowAddTypeInline(false);
                                    setSuccess('Novo tipo de parâmetro adicionado com sucesso!');
                                  } catch (err) {
                                    setError(err.message || 'Erro ao criar novo tipo.');
                                  }
                                }}
                              >
                                Adicionar
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="form-group">
                          <label className="form-label">Unidade Padrão *</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: mg/L"
                            required
                            value={newParamData.unidade_default}
                            onChange={e => setNewParamData({ ...newParamData, unidade_default: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                          <input
                            type="checkbox"
                            id="param-obrigatorio-check"
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                            checked={newParamData.obrigatorio}
                            onChange={e => setNewParamData({ ...newParamData, obrigatorio: e.target.checked })}
                          />
                          <label htmlFor="param-obrigatorio-check" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                            <strong>Obrigatório em todas as análises</strong>
                          </label>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                          <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>{editingGlobalParamId ? 'Gravar Alterações' : 'Gravar Parâmetro'}</button>
                          <button type="button" className="btn btn-secondary" onClick={() => { setShowAddParam(false); setEditingGlobalParamId(null); setShowAddTypeInline(false); setNewTypeName(''); }}>Cancelar</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Modal: Enviar Aviso Geral a Todos os Utilizadores */}
                {showGeneralMsgModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '480px', marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Megaphone size={20} /> Enviar Aviso Geral</h3>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowGeneralMsgModal(false)}><X size={20} /></button>
                      </div>
                      <form onSubmit={handleSendGeneralMessage}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                          Escreva um aviso ou mensagem de sistema. Esta mensagem será enviada em tempo real para o sininho de notificações de **todos** os utilizadores do sistema (clientes, operadores, técnicos, etc.).
                        </p>
                        <div className="form-group">
                          <label className="form-label">Mensagem *</label>
                          <textarea
                            className="form-input"
                            required
                            rows={4}
                            value={generalMsgText}
                            onChange={e => setGeneralMsgText(e.target.value)}
                            placeholder="Ex: Informamos que a ETAR Norte estará em manutenção programada amanhã..."
                            style={{ resize: 'vertical' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                          <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Enviar Aviso</button>
                          <button type="button" className="btn btn-secondary" onClick={() => setShowGeneralMsgModal(false)}>Cancelar</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Modal: Gerir Perfis / Cargos */}
                {showPerfisModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '500px', marginBottom: 0, maxHeight: '90vh', overflowY: 'auto' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3>Gerir Perfis e Cargos</h3>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => {
                            setShowPerfisModal(false);
                            setEditingPerfilId(null);
                            setNewPerfilData({ nome: '' });
                          }}
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {/* Form de Criação/Edição */}
                      <form onSubmit={handleSavePerfil} style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                        <h4 style={{ marginBottom: '1rem' }}>
                          {editingPerfilId ? 'Editar Nome do Perfil' : 'Adicionar Novo Perfil'}
                        </h4>
                        <div className="form-group">
                          <label className="form-label">Nome do Perfil *</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ex: Técnico de Qualidade"
                            required
                            value={newPerfilData.nome}
                            onChange={e => setNewPerfilData({ nome: e.target.value })}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                          <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                            {editingPerfilId ? 'Gravar Alteração' : 'Criar Perfil'}
                          </button>
                          {editingPerfilId && (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => {
                                setEditingPerfilId(null);
                                setNewPerfilData({ nome: '' });
                              }}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </form>

                      {/* Listagem de Perfis existentes */}
                      <div>
                        <h4 style={{ marginBottom: '1rem' }}>Perfis Disponíveis no Sistema</h4>
                        <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          <table className="data-table" style={{ fontSize: '0.85rem' }}>
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Perfil</th>
                                <th style={{ textAlign: 'right' }}>Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {perfisList.map(p => (
                                <tr key={p.id_perfil}>
                                  <td><strong>#{p.id_perfil}</strong></td>
                                  <td>
                                    <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                                      {p.nome}
                                    </span>
                                  </td>
                                  <td style={{ textAlign: 'right' }}>
                                    {p.id_perfil !== 1 ? (
                                      <button
                                        type="button"
                                        className="btn btn-primary"
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                        onClick={() => {
                                          setEditingPerfilId(p.id_perfil);
                                          setNewPerfilData({ nome: p.nome.replace(/_/g, ' ') });
                                        }}
                                      >
                                        Editar
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sistema</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowPerfisModal(false);
                            setEditingPerfilId(null);
                            setNewPerfilData({ nome: '' });
                          }}
                        >
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
