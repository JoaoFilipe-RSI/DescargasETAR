import React, { useState, useEffect, useRef } from 'react';
import { descargaService } from '../services/api';
import { Camera, Search, FileText, CheckCircle2, AlertTriangle, LogOut, Printer, Settings, Menu, X, Eye } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { webSocketService } from '../services/websocket';
import NotificationBell from '../components/NotificationBell';
import { Html5Qrcode } from 'html5-qrcode';

export default function OperadorDashboard({ user, onLogout, notifications, onMarkAsRead, onMarkAllAsRead, onChangePassword }) {
  const [activeView, setActiveView] = useState(
    user.perfil === 'RESPONSAVEL_ETAR' ? 'rececionadas' : 'scanner'
  ); // 'scanner', 'receber', 'agendados', 'sucesso', 'rececionadas'
  const [qrInput, setQrInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cameraActive, setCameraActive] = useState(true);
  const [scannerError, setScannerError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const html5QrCodeRef = useRef(null);
  
  // Dados da descarga validada
  const [validatedDescarga, setValidatedDescarga] = useState(null);
  const [rececaoResult, setRececaoResult] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  
  // Inputs da receção
  const [rececaoData, setRececaoData] = useState({
    quantidade_real: '',
    recolha_amostra: false,
    observacoes: ''
  });

  // Lista de agendados para a ETAR do operador
  const [agendadasList, setAgendadasList] = useState([]);

  // Histórico de descargas concluídas/recebidas
  const [descargasRececionadas, setDescargasRececionadas] = useState([]);
  const [filtroMesEtar, setFiltroMesEtar] = useState('all');
  const [filtroAnoEtar, setFiltroAnoEtar] = useState('all');
  const [periodoInicioEtar, setPeriodoInicioEtar] = useState('');
  const [periodoFimEtar, setPeriodoFimEtar] = useState('');

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

  // Carregar lista de descargas concluídas/recebidas
  const loadRececionadas = async () => {
    setLoading(true);
    try {
      const data = await descargaService.obterDescargas();
      const filtered = data.filter(d => 
        d.estado_descarga === 'RECEBIDA' || d.estado_descarga === 'CONCLUIDA'
      );
      setDescargasRececionadas(filtered);
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao obter histórico de descargas.');
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirFichaDescarga = async (idDescarga) => {
    setError('');
    try {
      await descargaService.abrirFichaPDF(idDescarga);
    } catch (err) {
      setError(err.message || 'Erro ao abrir Ficha de Descarga.');
    }
  };

  useEffect(() => {
    if (activeView === 'agendados') {
      loadAgendados();
    } else if (activeView === 'rececionadas') {
      loadRececionadas();
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

  // Controlar o Scanner de QR Code real (Câmara)
  useEffect(() => {
    let html5QrCode = null;

    if (activeView === 'scanner' && cameraActive) {
      setScannerError('');
      
      const startCamera = async () => {
        try {
          const element = document.getElementById("operador-qr-reader");
          if (!element) return;

          html5QrCode = new Html5Qrcode("operador-qr-reader");
          html5QrCodeRef.current = html5QrCode;

          // Obter os dispositivos de vídeo disponíveis (isto aciona o pedido de permissão do browser)
          const devices = await Html5Qrcode.getCameras();
          if (!devices || devices.length === 0) {
            throw new Error("Nenhuma câmara detetada.");
          }

          // Procurar uma câmara que corresponda à traseira
          const backCamera = devices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('traseira') || 
            device.label.toLowerCase().includes('environment') || 
            device.label.toLowerCase().includes('rear')
          );

          // Usar a traseira se disponível, senão a primeira (webcam do desktop)
          const cameraId = backCamera ? backCamera.id : devices[0].id;

          await html5QrCode.start(
            cameraId,
            {
              fps: 10,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.7;
                return { width: size, height: size };
              }
            },
            (decodedText) => {
              // Parar a câmara antes de atualizar os estados para evitar race conditions no useEffect
              if (html5QrCode && html5QrCode.isScanning) {
                html5QrCode.stop().then(() => {
                  try {
                    html5QrCode.clear();
                  } catch (e) {}
                  html5QrCodeRef.current = null;
                  setCameraActive(false);
                  setQrInput(decodedText);
                  handleValidateQR(null, decodedText);
                }).catch(err => {
                  console.error("Erro ao parar câmara após scan:", err);
                  setCameraActive(false);
                  setQrInput(decodedText);
                  handleValidateQR(null, decodedText);
                });
              }
            },
            () => {}
          );
        } catch (err) {
          console.error("Erro ao iniciar o scanner:", err);
          setScannerError("Não foi possível aceder à câmara. Verifique as permissões de acesso do browser, se tem uma webcam activa ou se está sob HTTPS.");
          setCameraActive(false);
        }
      };

      const timer = setTimeout(() => {
        startCamera();
      }, 150);

      return () => {
        clearTimeout(timer);
        if (html5QrCode) {
          const instanceToStop = html5QrCode;
          html5QrCodeRef.current = null;
          if (instanceToStop.isScanning) {
            instanceToStop.stop().then(() => {
              try {
                instanceToStop.clear();
              } catch (e) {
                console.warn("Erro ao limpar div no cleanup (provavelmente já desmontada):", e);
              }
            }).catch(e => console.error("Erro ao parar scanner no cleanup:", e));
          }
        }
      };
    }
  }, [activeView, cameraActive]);

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

  const parseDate = (v) => {
    if (!v) return null;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, day] = v.split('-').map(Number);
      return new Date(y, m - 1, day);
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

  const hasFiltroEtar = periodoInicioEtar || periodoFimEtar || filtroMesEtar !== 'all' || filtroAnoEtar !== 'all';

  const filteredDescargas = [...descargasRececionadas]
    .filter(d => {
      const dateField = d.data_rececao || d.data_pedido;
      return hasFiltroEtar
        ? matchesPeriod(dateField, {
          inicio: periodoInicioEtar,
          fim: periodoFimEtar,
          mes: filtroMesEtar,
          ano: filtroAnoEtar
        })
        : true;
    })
    .sort((a, b) => {
      const da = parseDate(a.data_rececao || a.data_pedido);
      const db = parseDate(b.data_rececao || b.data_pedido);
      return (db && da) ? db - da : 0;
    });

  const totalVolume = filteredDescargas.reduce((sum, d) => sum + parseFloat(d.quantidade_real || d.quantidade || 0), 0);
  const totalDescargas = filteredDescargas.length;

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
            <strong>{user.nome}</strong> ({user.etar_nome || `Op. ETAR ${user.id_etar}`})
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
                  {user.etar_nome || `Op. ETAR ${user.id_etar}`}
                </div>
              </div>
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

      <main className="content-wrapper animate-fade-in" style={{ maxWidth: '1000px' }}>
        
        {/* Menu de Ações Rápido */}
        <div className="dashboard-actions-nav">
          {user.perfil === 'RESPONSAVEL_ETAR' && (
            <button className={`btn ${activeView === 'rececionadas' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => { setActiveView('rececionadas'); setError(''); setSuccess(''); setMobileMenuOpen(false); }}>
              <FileText size={16} /> Histórico de descargas
            </button>
          )}
          <button className={`btn ${activeView === 'scanner' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => { setActiveView('scanner'); setError(''); setSuccess(''); setQrInput(''); setCameraActive(true); setMobileMenuOpen(false); }}>
            <Camera size={16} /> Ler QR Code
          </button>
          <button className={`btn ${activeView === 'agendados' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => { setActiveView('agendados'); setError(''); setSuccess(''); setMobileMenuOpen(false); }}>
            <Search size={16} /> Agendadas
          </button>
        </div>

        {error && <div className="card" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: '1rem', borderLeft: '5px solid var(--danger)' }}>{error}</div>}
        {success && <div className="card" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '1rem', borderLeft: '5px solid var(--success)' }}>{success}</div>}

        {/* 1. Scanner de QR Code (Real ou Fallback) */}
        {activeView === 'scanner' && (
          <div className="card" style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>Validação na Entrada da ETAR</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Utilize a câmara do tablet/smartphone para ler o QR Code de descarga apresentado pelo motorista.
            </p>

            {scannerError && (
              <div className="card" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)', padding: '0.75rem', fontSize: '0.85rem', borderLeft: '4px solid var(--warning)', marginBottom: '1.5rem', textAlign: 'left' }}>
                {scannerError}
              </div>
            )}

            {/* Viewport de Scanner (Câmara Real ou Feedback) */}
            <div className="scanner-viewport">
              {cameraActive ? (
                <div id="operador-qr-reader" style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', color: '#ffffff' }}>
                  {loading ? (
                    <p style={{ fontWeight: 600 }}>A validar código lido...</p>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <Camera size={48} style={{ opacity: 0.5, marginBottom: '1rem', display: 'inline-block' }} />
                      <p style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Câmara desativada</p>
                      <button type="button" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => { setCameraActive(true); setError(''); setScannerError(''); }}>
                        Digitalizar Novamente
                      </button>
                    </div>
                  )}
                </div>
              )}
              {cameraActive && <div className="scanner-line" style={{ zIndex: 2 }}></div>}
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

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => alert(`Imprimindo Etiqueta Térmica...\n\nEtiqueta:\nETAR: ${user.etar_nome || 'ETAR ' + user.id_etar}\nDescarga: #${validatedDescarga ? validatedDescarga.id_descarga : ''}\nTipo: ${validatedDescarga ? validatedDescarga.tipo_efluente : ''}\nAmostra: ${rececaoResult.amostra.qr_code_token}\nData: ${new Date().toLocaleString('pt-PT')}`)}>
                    <Printer size={16} /> Imprimir Etiqueta
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--primary)', color: '#ffffff' }} onClick={() => setShowQrModal(true)}>
                    <Eye size={16} /> Visualizar QR Code
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
                          {a.observacoes && a.observacoes.includes('ALERTA OPERACIONAL') && (
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: 'var(--danger)', 
                              backgroundColor: 'var(--danger-light)', 
                              padding: '0.25rem 0.5rem', 
                              borderRadius: 'var(--radius-sm)', 
                              border: '1px solid var(--danger)', 
                              marginTop: '0.4rem',
                              maxWidth: '400px'
                            }}>
                              ⚠️ <strong>Contacto Urgente:</strong> Confirmar se a descarga pode ser feita (ex: tanque de retenção).
                            </div>
                          )}
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

        {/* 5. Histórico de Descargas Rececionadas (Apenas Responsável de ETAR) */}
        {activeView === 'rececionadas' && (
          <div>
            <h3 style={{ marginBottom: '1.5rem' }}>
              Histórico de descargas rececionadas na {user.etar_nome || `ETAR ${user.id_etar}`}
            </h3>
            
            {/* Filtros de Mês, Ano e Período */}
            <div className="card filters-container">
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Mês</label>
                <select className="form-input" value={filtroMesEtar} onChange={(e) => setFiltroMesEtar(e.target.value)} style={{ padding: '0.35rem', width: '100%' }}>
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
                <select className="form-input" value={filtroAnoEtar} onChange={(e) => setFiltroAnoEtar(e.target.value)} style={{ padding: '0.35rem', width: '100%' }}>
                  <option value="all">-- Todos --</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Período Início</label>
                <input type="date" className="form-input" value={periodoInicioEtar} onChange={(e) => setPeriodoInicioEtar(e.target.value)} style={{ padding: '0.35rem', width: '100%' }} />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Período Fim</label>
                <input type="date" className="form-input" value={periodoFimEtar} onChange={(e) => setPeriodoFimEtar(e.target.value)} style={{ padding: '0.35rem', width: '100%' }} />
              </div>
              <div className="btn-clear-wrapper">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setFiltroMesEtar('all');
                    setFiltroAnoEtar('all');
                    setPeriodoInicioEtar('');
                    setPeriodoFimEtar('');
                  }}
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Quadro de Estatísticas Rápidas */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '1rem', 
              marginBottom: '1.5rem' 
            }}>
              <div className="card" style={{ padding: '1rem', textAlign: 'center', marginBottom: 0 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total de Descargas</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '0.25rem' }}>{totalDescargas}</div>
              </div>
              <div className="card" style={{ padding: '1rem', textAlign: 'center', marginBottom: 0 }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Volume Total Recebido</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--accent)', marginTop: '0.25rem' }}>{totalVolume.toLocaleString()} L</div>
              </div>
            </div>

            {loading ? (
              <p>A ler histórico...</p>
            ) : filteredDescargas.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {hasFiltroEtar
                    ? 'Nenhuma descarga encontrada para os filtros selecionados. Ajuste o período ou clique em Limpar.'
                    : 'Não existem descargas rececionadas registadas.'}
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ref/Data</th>
                      <th>Cliente</th>
                      <th>Veículo/Matrícula</th>
                      <th>Qtd. Real</th>
                      <th>Ficha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDescargas.map((d) => (
                      <tr key={d.id_descarga}>
                        <td>
                          <strong>#{d.id_descarga}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {d.data_rececao ? new Date(d.data_rececao).toLocaleDateString() : ''}
                          </div>
                        </td>
                        <td>
                          <strong>{d.cliente_nome}</strong>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {d.tipo_efluente}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem' }}>{d.empresa_transportadora}</span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {d.matricula_trator} {d.matricula_cisterna ? `| ${d.matricula_cisterna}` : ''}
                          </div>
                        </td>
                        <td>
                          <strong>{d.quantidade_real ? `${d.quantidade_real} L` : `${d.quantidade} L`}</strong>
                        </td>
                        <td>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center' }}
                            onClick={() => handleAbrirFichaDescarga(d.id_descarga)}
                            title="Ver Ficha de Descarga PDF"
                          >
                            <FileText size={14} />
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

        {/* Modal para Visualização de Código QR e Etiqueta Física */}
        {showQrModal && rececaoResult && rececaoResult.amostra && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '1rem', backdropFilter: 'blur(4px)' }}>
            <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '420px', marginBottom: 0, backgroundColor: 'var(--bg-card)', padding: '1.5rem', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <h4 style={{ margin: 0, fontFamily: 'var(--font-title)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                  <Printer size={18} /> Etiqueta do Frasco
                </h4>
                <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowQrModal(false)}>
                  <X size={20} />
                </button>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Apresente este código no ecrã para que o Técnico de Laboratório o possa digitalizar na triagem/check-in.
              </p>

              {/* Etiqueta Térmica Simulada */}
              <div style={{ backgroundColor: '#ffffff', color: '#111827', border: '2px solid #000000', borderRadius: '4px', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', margin: '0.5rem auto 1.5rem auto', maxWidth: '280px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', borderBottom: '1px dashed #374151', width: '100%', paddingBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  DescargasETAR - Controlo de Amostra
                </div>
                
                <div style={{ padding: '0.25rem', backgroundColor: '#ffffff' }}>
                  <QRCodeSVG value={rececaoResult.amostra.qr_code_token} size={140} level="M" />
                </div>

                <div style={{ textAlign: 'left', width: '100%', fontSize: '0.75rem', fontFamily: 'monospace', lineHeight: '1.25' }}>
                  <div><strong>ID AM.:</strong> {rececaoResult.amostra.qr_code_token}</div>
                  <div><strong>ID DES.:</strong> #{validatedDescarga ? validatedDescarga.id_descarga : ''}</div>
                  <div><strong>ETAR:</strong> {user.etar_nome || 'ETAR ' + user.id_etar}</div>
                  <div><strong>TIPO:</strong> {validatedDescarga ? validatedDescarga.tipo_efluente : ''}</div>
                  <div><strong>DATA:</strong> {new Date().toLocaleString('pt-PT')}</div>
                </div>
              </div>

              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowQrModal(false)}>
                Fechar Visualização
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
