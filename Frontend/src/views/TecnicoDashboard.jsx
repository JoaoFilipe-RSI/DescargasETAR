import React, { useState, useEffect } from 'react';
import { amostraService } from '../services/api';
import { FlaskConical, ClipboardList, ScanLine, Check, AlertCircle, LogOut } from 'lucide-react';

export default function TecnicoDashboard({ user, onLogout }) {
  const [activeView, setActiveView] = useState('checkin'); // 'checkin', 'lista', 'bancada', 'triagem-res'
  const [sampleTokenInput, setSampleTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Amostras listadas
  const [amostrasEmAnalise, setAmostrasEmAnalise] = useState([]);
  
  // Triagem result
  const [triagemData, setTriagemData] = useState(null);

  // Amostra selecionada para bancada
  const [selectedAmostra, setSelectedAmostra] = useState(null);
  
  // Resultados a introduzir
  // Parâmetros do seed: 1-pH, 2-CQO, 3-CBO5, 4-SST, 5-Condutividade, 6-Azoto Kjeldahl, 7-Zinco
  const [resultadosData, setResultadosData] = useState({
    1: { valor: '', unidade: 'pH', metodo: 'SMEWW 4500-H+' },
    2: { valor: '', unidade: 'mg/L', metodo: 'SMEWW 5220 B' },
    3: { valor: '', unidade: 'mg/L', metodo: 'SMEWW 5210 B' },
    4: { valor: '', unidade: 'mg/L', metodo: 'SMEWW 2540 D' },
    5: { valor: '', unidade: 'mS/cm', metodo: 'SMEWW 2510 B' },
    6: { valor: '', unidade: 'mg/L', metodo: 'SMEWW 4500-N' }, // Azoto (Adicional Cliente AAA/BBB)
    7: { valor: '', unidade: 'mg/L', metodo: 'SMEWW 3111 B' }  // Zinco (Adicional Cliente BBB)
  });

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
    if (activeView === 'lista') {
      loadAmostras();
    }
  }, [activeView]);

  // Efetuar Check-in (Receber Amostra física e triagem)
  const handleCheckin = async (e) => {
    e.preventDefault();
    if (!sampleTokenInput.trim()) return;

    setLoading(true);
    setError('');
    setTriagemData(null);
    try {
      const res = await amostraService.receberAmostra(sampleTokenInput.trim());
      setTriagemData(res);
      setActiveView('triagem-res');
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
    setError('');
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
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }} onClick={onLogout}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      <main className="content-wrapper animate-fade-in" style={{ maxWidth: '650px' }}>
        
        {/* Menu Rápido */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button className={`btn ${activeView === 'checkin' || activeView === 'triagem-res' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => { setActiveView('checkin'); setError(''); setSampleTokenInput(''); }}>
            <ScanLine size={16} /> Check-in de Frascos
          </button>
          <button className={`btn ${activeView === 'lista' || activeView === 'bancada' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => { setActiveView('lista'); setError(''); }}>
            <ClipboardList size={16} /> Lista de Bancada
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

            <div className="scanner-viewport">
              <div className="scanner-line"></div>
              <FlaskConical size={64} style={{ color: '#ffffff', opacity: 0.15, position: 'absolute', top: 'calc(50% - 32px)', left: 'calc(50% - 32px)' }} />
            </div>

            <form onSubmit={handleCheckin}>
              <div className="form-group">
                <label className="form-label">Introduzir Token da Amostra (Simulador)</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" className="form-input" placeholder="Ex: AMOSTRA-2026-XXXXXX" required value={sampleTokenInput} onChange={(e) => setSampleTokenInput(e.target.value.toUpperCase())} />
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'A ler...' : 'Registar Entrada'}
                  </button>
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
            </div>

            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => { setActiveView('checkin'); setTriagemData(null); }}>
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
                            <ClipboardList size={14} /> Bancada
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
                Parâmetros Específicos do Contrato (Opcional se não aplicável)
              </h4>
              
              <div className="results-grid" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Azoto Kjeldahl (mg/L)</label>
                  <input type="number" step="0.1" className="form-input" placeholder="Ex: 35.5" value={resultadosData[6].valor} onChange={(e) => setResultadosData({ ...resultadosData, 6: { ...resultadosData[6], valor: e.target.value } })} />
                </div>

                <div className="form-group">
                  <label className="form-label">Zinco (mg/L)</label>
                  <input type="number" step="0.01" className="form-input" placeholder="Ex: 0.15" value={resultadosData[7].valor} onChange={(e) => setResultadosData({ ...resultadosData, 7: { ...resultadosData[7], valor: e.target.value } })} />
                </div>
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
