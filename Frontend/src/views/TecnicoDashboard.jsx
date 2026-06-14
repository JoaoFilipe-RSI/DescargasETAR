import React, { useState, useEffect, useRef } from 'react';
import { amostraService } from '../services/api';
import { FlaskConical, ClipboardList, ScanLine, Check, AlertCircle, LogOut, Settings } from 'lucide-react';
import { webSocketService } from '../services/websocket';
import NotificationBell from '../components/NotificationBell';
import { Html5Qrcode } from 'html5-qrcode';

export default function TecnicoDashboard({ user, onLogout, notifications, onMarkAsRead, onMarkAllAsRead, onChangePassword }) {
  const [activeView, setActiveView] = useState('checkin'); // 'checkin', 'lista', 'bancada', 'triagem-res'
  const [sampleTokenInput, setSampleTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cameraActive, setCameraActive] = useState(true);
  const [scannerError, setScannerError] = useState('');
  const html5QrCodeRef = useRef(null);
  
  // Amostras listadas
  const [amostrasEmAnalise, setAmostrasEmAnalise] = useState([]);
  
  // Triagem result
  const [triagemData, setTriagemData] = useState(null);

  // Amostra selecionada para bancada
  const [selectedAmostra, setSelectedAmostra] = useState(null);
  
  // Resultados a introduzir
  // Parâmetros do seed: 1-pH, 2-CQO, 3-CBO5, 4-SST, 5-Condutividade, 6-Azoto Kjeldahl, 7-Zinco
  const [resultadosData, setResultadosData] = useState({
    1: { valor: '', unidade: 'pH', metodo: '' },
    2: { valor: '', unidade: 'mg/L', metodo: '' },
    3: { valor: '', unidade: 'mg/L', metodo: '' },
    4: { valor: '', unidade: 'mg/L', metodo: '' },
    5: { valor: '', unidade: 'mS/cm', metodo: '' },
    6: { valor: '', unidade: 'mg/L', metodo: '' }, // Azoto (Adicional Cliente AAA/BBB)
    7: { valor: '', unidade: 'mg/L', metodo: '' }  // Zinco (Adicional Cliente BBB)
  });

  // Parâmetros específicos (extra) selecionados/ativos para reportar
  const [selectedExtraParams, setSelectedExtraParams] = useState({
    6: false,
    7: false
  });

  // Amostras recolhidas prontas para check-in
  const [amostrasRecolhidas, setAmostrasRecolhidas] = useState([]);

  const loadAmostrasRecolhidas = async () => {
    try {
      const data = await amostraService.obterAmostras({ estado: 'RECOLHIDA' });
      setAmostrasRecolhidas(data);
    } catch (err) {
      console.error('Erro ao carregar amostras recolhidas:', err);
    }
  };

  const toggleExtraParam = (id) => {
    setSelectedExtraParams(prev => {
      const newVal = !prev[id];
      if (!newVal) {
        // Limpar o valor quando ocultado
        setResultadosData(current => ({
          ...current,
          [id]: { ...current[id], valor: '' }
        }));
      }
      return {
        ...prev,
        [id]: newVal
      };
    });
  };

  // Carregar lista de amostras em análise
  const loadAmostras = async () => {
    setLoading(true);
    try {
      const data = await amostraService.obterAmostras({ estado: 'EM_ANALISE' });
      setAmostrasEmAnalise(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao carregar lista de amostras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'checkin') {
      loadAmostrasRecolhidas();
    } else if (activeView === 'lista') {
      loadAmostras();
    }
  }, [activeView]);

  // Escutar novas amostras em tempo real via WebSockets
  useEffect(() => {
    const handleNovaAmostra = (data) => {
      setSuccess(`Nova amostra aguardando triagem/bancada: ${data.qr_code_token} (Descarga #${data.id_descarga}).`);
      loadAmostras();
      loadAmostrasRecolhidas();
    };

    webSocketService.on('nova-amostra', handleNovaAmostra);

    return () => {
      webSocketService.off('nova-amostra', handleNovaAmostra);
    };
  }, []);

  // Controlar o Scanner de QR Code real (Câmara)
  useEffect(() => {
    let html5QrCode = null;

    if (activeView === 'checkin' && cameraActive) {
      setScannerError('');
      
      const startCamera = async () => {
        try {
          const element = document.getElementById("tecnico-qr-reader");
          if (!element) return;

          html5QrCode = new Html5Qrcode("tecnico-qr-reader");
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
                  setSampleTokenInput(decodedText);
                  handleCheckin(null, decodedText);
                }).catch(err => {
                  console.error("Erro ao parar câmara após scan:", err);
                  setCameraActive(false);
                  setSampleTokenInput(decodedText);
                  handleCheckin(null, decodedText);
                });
              }
            },
            () => {}
          );
        } catch (err) {
          console.error("Erro ao iniciar o scanner do técnico:", err);
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

  // Efetuar Check-in (Receber Amostra física e triagem)
  const handleCheckin = async (e, overrideToken = null) => {
    if (e && e.preventDefault) e.preventDefault();
    const token = overrideToken || sampleTokenInput;
    if (!token || !token.trim()) return;

    setLoading(true);
    setError('');
    setSuccess('');
    setTriagemData(null);
    try {
      const res = await amostraService.receberAmostra(token.trim());
      setTriagemData(res);
      setActiveView('triagem-res');
      loadAmostrasRecolhidas(); // Atualizar lista de amostras recolhidas
    } catch (err) {
      setError(err.message || 'Código de amostra inválido ou já processado.');
    } finally {
      setLoading(false);
    }
  };

  // Abrir ecrã de bancada para uma amostra
  const handleOpenBancada = (amostra) => {
    setSelectedAmostra(amostra);
    // Limpar valores anteriores
    const resetResultados = { ...resultadosData };
    Object.keys(resetResultados).forEach(key => {
      resetResultados[key].valor = '';
    });
    setResultadosData(resetResultados);

    // Determinar quais os parâmetros extra definidos no contrato da amostra
    const contractParams = amostra.parametros_contratuais || [];
    setSelectedExtraParams({
      6: contractParams.includes(6),
      7: contractParams.includes(7)
    });

    setError('');
    setSuccess('');
    setActiveView('bancada');
  };

  // Submeter Resultados de Bancada
  const handleSubmitResultados = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Filtrar apenas os resultados que foram preenchidos
      const resultadosArray = [];
      
      for (const paramId of Object.keys(resultadosData)) {
        const item = resultadosData[paramId];
        if (item.valor !== '') {
          const valNum = parseFloat(item.valor);
          
          // Validação física de pH (0 a 14)
          if (paramId === '1' && (valNum < 0 || valNum > 14)) {
            throw new Error('O valor de pH tem de estar compreendido entre 0 e 14.');
          }

          if (valNum < 0) {
            throw new Error('Os valores de ensaios não podem ser negativos.');
          }

          resultadosArray.push({
            id_parametro: parseInt(paramId, 10),
            valor: valNum,
            unidade: item.unidade,
            metodo: item.metodo
          });
        }
      }

      if (resultadosArray.length === 0) {
        throw new Error('Por favor, introduza pelo menos um resultado de ensaio.');
      }

      await amostraService.registarResultados(selectedAmostra.id_amostra, resultadosArray);
      setSuccess('Resultados laboratoriais submetidos com sucesso!');
      setSelectedAmostra(null);
      setActiveView('lista');
    } catch (err) {
      setError(err.message || 'Erro ao submeter resultados analíticos.');
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
            <strong>{user.nome}</strong> (Téc. Laboratório)
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

      <main className="content-wrapper animate-fade-in" style={{ maxWidth: '1000px' }}>
        
        {/* Menu Rápido */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button className={`btn ${activeView === 'checkin' || activeView === 'triagem-res' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => { setActiveView('checkin'); setError(''); setSuccess(''); setSampleTokenInput(''); setCameraActive(true); }}>
            <ScanLine size={16} /> Check-in de Frascos
          </button>
          <button className={`btn ${activeView === 'lista' || activeView === 'bancada' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => { setActiveView('lista'); setError(''); setSuccess(''); }}>
            <ClipboardList size={16} /> Lista de amostras em análise
          </button>
        </div>

        {error && <div className="card" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)', padding: '1rem', borderLeft: '5px solid var(--danger)' }}>{error}</div>}
        {success && <div className="card" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '1rem', borderLeft: '5px solid var(--success)' }}>{success}</div>}

        {/* 1. Check-in de Frascos */}
        {activeView === 'checkin' && (
          <div className="card" style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>Receção de Amostras no Laboratório</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Faça a leitura do código QR no frasco da amostra recolhida na ETAR para registar a sua entrada e obter a triagem.
            </p>

            {scannerError && (
              <div className="card" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)', padding: '0.75rem', fontSize: '0.85rem', borderLeft: '4px solid var(--warning)', marginBottom: '1.5rem', textAlign: 'left' }}>
                {scannerError}
              </div>
            )}

            {/* Viewport de Scanner (Câmara Real ou Feedback) */}
            <div className="scanner-viewport" style={{ marginBottom: '1.5rem' }}>
              {cameraActive ? (
                <div id="tecnico-qr-reader" style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', color: '#ffffff' }}>
                  {loading ? (
                    <p style={{ fontWeight: 600 }}>A processar entrada...</p>
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                      <FlaskConical size={48} style={{ opacity: 0.5, marginBottom: '1rem', display: 'inline-block' }} />
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

            <form onSubmit={handleCheckin}>
              {/* Opção para selecionar amostra da lista no estado RECOLHIDA */}
              <div className="form-group" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Selecionar Amostra Recolhida</label>
                <select 
                  className="form-input" 
                  value={sampleTokenInput} 
                  onChange={(e) => setSampleTokenInput(e.target.value)}
                >
                  <option value="">-- Selecione uma amostra (estado RECOLHIDA) --</option>
                  {amostrasRecolhidas.map((am) => (
                    <option key={am.id_amostra} value={am.qr_code_token}>
                      {am.qr_code_token} - {am.cliente_nome} ({am.etar_nome || 'ETAR N/A'})
                    </option>
                  ))}
                </select>
                {amostrasRecolhidas.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '0.25rem' }}>
                    Nenhuma amostra no estado RECOLHIDA disponível neste momento.
                  </p>
                )}
              </div>

              <div style={{ borderTop: '1px dashed var(--border)', margin: '1.5rem 0', paddingTop: '1.5rem', textAlign: 'left' }}>
                <div className="form-group">
                  <label className="form-label">Introduzir Token da Amostra (Manual)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="text" className="form-input" placeholder="Ex: AMOSTRA-2026-XXXXXX" required value={sampleTokenInput} onChange={(e) => setSampleTokenInput(e.target.value.toUpperCase())} />
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                      {loading ? 'A ler...' : 'Registar Entrada'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* 1.1 Triagem Result */}
        {activeView === 'triagem-res' && triagemData && (
          <div className="card" style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}>Entrada de Amostra Concluída</h3>
            
            <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)', margin: '1.5rem 0', backgroundColor: triagemData.triagem === 'ANALISAR' ? 'var(--accent-light)' : 'var(--warning-light)', border: `2px solid ${triagemData.triagem === 'ANALISAR' ? 'var(--accent)' : 'var(--warning)'}` }}>
              <FlaskConical size={48} style={{ color: triagemData.triagem === 'ANALISAR' ? 'var(--accent)' : 'var(--warning)', marginBottom: '0.75rem', display: 'inline-block' }} />
              <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>
                Ref: {triagemData.amostra.qr_code_token}
              </h4>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, textTransform: 'uppercase', color: triagemData.triagem === 'ANALISAR' ? 'var(--accent)' : 'var(--warning)' }}>
                Triagem: {triagemData.triagem}
              </div>
               <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.5rem' }}>
                {triagemData.mensagem}
              </p>

              {triagemData.triagem === 'ANALISAR' && triagemData.parametros && triagemData.parametros.length > 0 && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px dashed var(--border)', paddingTop: '1.25rem', textAlign: 'left' }}>
                  <h5 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '0.75rem', fontWeight: 600 }}>Parâmetros definidos para analisar ({triagemData.amostra.cliente_nome}):</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {triagemData.parametros.map((p) => (
                      <div key={p.id_parametro} style={{ fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-base)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <span>
                          <strong>{p.nome}</strong> 
                          <span style={{ color: 'var(--text-secondary)', marginLeft: '4px', fontSize: '0.75rem' }}>
                            ({p.tipo_parametro.replace('_', ' ')})
                          </span>
                        </span>
                        <span className="badge" style={{ 
                          fontSize: '0.65rem', 
                          padding: '0.15rem 0.5rem', 
                          backgroundColor: p.obrigatorio ? 'var(--accent-light)' : 'var(--success-light)', 
                          color: p.obrigatorio ? 'var(--accent)' : 'var(--success)',
                          border: `1px solid ${p.obrigatorio ? 'var(--accent)' : 'var(--success)'}`
                        }}>
                          {p.obrigatorio ? 'Obrigatório' : 'Contratual'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { setActiveView('checkin'); setTriagemData(null); setCameraActive(true); setSampleTokenInput(''); }}>
              Efetuar Novo Check-in
            </button>
          </div>
        )}

        {/* 2. Lista de Bancada (Amostras em Análise) */}
        {activeView === 'lista' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>Amostras em Análise</h3>
            {loading ? (
              <p>A ler amostras pendentes...</p>
            ) : amostrasEmAnalise.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Sem amostras pendentes de análise neste momento.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ref. Amostra</th>
                      <th>Cliente</th>
                      <th>ETAR Origem</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amostrasEmAnalise.map((am) => (
                      <tr key={am.id_amostra}>
                        <td>
                          <strong style={{ fontSize: '0.95rem' }}>{am.qr_code_token}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Recolhida: {new Date(am.data_recolha).toLocaleString()}
                          </div>
                        </td>
                        <td>{am.cliente_nome}</td>
                        <td>{am.etar_nome || 'N/A'}</td>
                        <td>
                          <button className="btn btn-primary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => handleOpenBancada(am)}>
                            <ClipboardList size={14} /> Resultados
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

        {/* 3. Ecrã de Introdução de Resultados (Bancada) */}
        {activeView === 'bancada' && selectedAmostra && (
          <div className="card">
            <h3 style={{ marginBottom: '0.5rem' }}>Ensaios Analíticos (Bancada)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Introduza os resultados medidos para a amostra <strong>{selectedAmostra.qr_code_token}</strong> (Cliente: {selectedAmostra.cliente_nome}).
            </p>

            <form onSubmit={handleSubmitResultados}>
              {/* Parâmetros Físico-Químicos Obrigatórios */}
              <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>
                Parâmetros Obrigatórios (Sistema)
              </h4>
              
              <div className="results-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">pH (0 a 14) *</label>
                  <input type="number" step="0.01" className="form-input" placeholder="Ex: 7.20" required value={resultadosData[1].valor} onChange={(e) => setResultadosData({ ...resultadosData, 1: { ...resultadosData[1], valor: e.target.value } })} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">CQO (mg/L) *</label>
                  <input type="number" step="0.1" className="form-input" placeholder="Ex: 450.0" required value={resultadosData[2].valor} onChange={(e) => setResultadosData({ ...resultadosData, 2: { ...resultadosData[2], valor: e.target.value } })} />
                </div>

                <div className="form-group">
                  <label className="form-label">CBO5 (mg/L) *</label>
                  <input type="number" step="0.1" className="form-input" placeholder="Ex: 150.0" required value={resultadosData[3].valor} onChange={(e) => setResultadosData({ ...resultadosData, 3: { ...resultadosData[3], valor: e.target.value } })} />
                </div>

                <div className="form-group">
                  <label className="form-label">SST (mg/L) *</label>
                  <input type="number" step="0.1" className="form-input" placeholder="Ex: 120.0" required value={resultadosData[4].valor} onChange={(e) => setResultadosData({ ...resultadosData, 4: { ...resultadosData[4], valor: e.target.value } })} />
                </div>

                <div className="form-group">
                  <label className="form-label">Condutividade (mS/cm) *</label>
                  <input type="number" step="0.01" className="form-input" placeholder="Ex: 2.30" required value={resultadosData[5].valor} onChange={(e) => setResultadosData({ ...resultadosData, 5: { ...resultadosData[5], valor: e.target.value } })} />
                </div>
              </div>

              {/* Parâmetros Adicionais */}
              <h4 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem' }}>
                Parâmetros Específicos (Extra)
              </h4>

              {/* Opção para selecionar parâmetros extra manualmente se o técnico optar por analisar */}
              <div style={{ 
                marginBottom: '1.25rem', 
                backgroundColor: 'var(--bg-base)', 
                padding: '0.75rem 1rem', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Selecione os parâmetros extra a reportar (ou ative manualmente se necessário):
                </span>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input 
                      type="checkbox" 
                      checked={selectedExtraParams[6] || false} 
                      onChange={() => toggleExtraParam(6)} 
                      style={{ cursor: 'pointer' }}
                    />
                    Azoto Kjeldahl
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input 
                      type="checkbox" 
                      checked={selectedExtraParams[7] || false} 
                      onChange={() => toggleExtraParam(7)} 
                      style={{ cursor: 'pointer' }}
                    />
                    Zinco
                  </label>
                </div>
              </div>
              
              <div className="results-grid" style={{ marginBottom: '1.5rem' }}>
                {selectedExtraParams[6] && (
                  <div className="form-group">
                    <label className="form-label">Azoto Kjeldahl (mg/L)</label>
                    <input type="number" step="0.1" className="form-input" placeholder="Ex: 35.5" value={resultadosData[6].valor} onChange={(e) => setResultadosData({ ...resultadosData, 6: { ...resultadosData[6], valor: e.target.value } })} />
                  </div>
                )}

                {selectedExtraParams[7] && (
                  <div className="form-group">
                    <label className="form-label">Zinco (mg/L)</label>
                    <input type="number" step="0.01" className="form-input" placeholder="Ex: 0.15" value={resultadosData[7].valor} onChange={(e) => setResultadosData({ ...resultadosData, 7: { ...resultadosData[7], valor: e.target.value } })} />
                  </div>
                )}

                {!selectedExtraParams[6] && !selectedExtraParams[7] && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    Nenhum parâmetro específico ativado para esta amostra. Ative acima se necessário.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'A submeter...' : 'Gravar e Submeter Ensaio'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveView('lista')}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
