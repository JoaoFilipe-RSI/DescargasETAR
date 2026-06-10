const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Função utilitária para efetuar pedidos HTTP autenticados
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers,
  };
  
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.erro || `Erro HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * MÓDULO DE AUTENTICAÇÃO
 */
export const authService = {
  async login(email, password) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.utilizador));
    }
    return data.utilizador;
  },
  
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  
  getCurrentUser() {
    const userJson = localStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
  },
  
  isAuthenticated() {
    return !!localStorage.getItem('token');
  },
  
  alterarSenha(senhaAtual, novaSenha) {
    return request('/auth/alterar-senha', {
      method: 'PUT',
      body: { senhaAtual, novaSenha }
    });
  },
  
  atualizarPerfil(nome, email) {
    return request('/auth/perfil', {
      method: 'PUT',
      body: { nome, email }
    });
  }
};

/**
 * MÓDULO DE DESCARGAS
 */
export const descargaService = {
  criarPedido(pedidoData) {
    return request('/descargas', {
      method: 'POST',
      body: pedidoData
    });
  },
  
  obterDescargas(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/descargas?${query}`);
  },
  
  registarDecisao(id, decisao, observacoes) {
    return request(`/descargas/${id}/decisao`, {
      method: 'PUT',
      body: { decisao, observacoes }
    });
  },
  
  agendarDescarga(id, agendamentoData) {
    return request(`/descargas/${id}/agendar`, {
      method: 'PUT',
      body: agendamentoData
    });
  },
  
  validarTokenQR(tokenQR) {
    return request(`/descargas/validar/${tokenQR}`);
  },
  
  registarRececao(id, rececaoData) {
    return request(`/descargas/${id}/receber`, {
      method: 'PUT',
      body: rececaoData
    });
  },
  
  cancelarDescarga(id) {
    return request(`/descargas/${id}/cancelar`, {
      method: 'PUT'
    });
  },
  
  editarPedido(id, pedidoData) {
    return request(`/descargas/${id}`, {
      method: 'PUT',
      body: pedidoData
    });
  },
  
  async abrirFichaPDF(id) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/descargas/${id}/ficha`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.erro || 'Erro ao obter PDF.');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
};

/**
 * MÓDULO DE LABORATÓRIO & AMOSTRAS
 */
export const amostraService = {
  receberAmostra(tokenAmostra) {
    return request(`/amostras/receber/${tokenAmostra}`, {
      method: 'PUT'
    });
  },
  
  obterAmostras(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/amostras?${query}`);
  },
  
  obterDetalhesAmostra(id) {
    return request(`/amostras/${id}`);
  },
  
  registarResultados(id, resultadosArray) {
    return request(`/amostras/${id}/resultados`, {
      method: 'POST',
      body: { resultados: resultadosArray }
    });
  },
  
  validarAmostra(id) {
    return request(`/amostras/${id}/validar`, {
      method: 'PUT'
    });
  },
  
  async descarregarBoletimPDF(id, refAmostra) {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/amostras/${id}/boletim`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.erro || 'Erro ao descarregar PDF.');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Boletim_Analitico_${refAmostra || id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  disponibilizarBoletim(id) {
    return request(`/amostras/${id}/disponibilizar`, {
      method: 'PUT'
    });
  }
};

/**
 * MÓDULO DE ADMINISTRAÇÃO E CONFIGURAÇÃO
 */
export const adminService = {
  obterClientes() {
    return request('/admin/clientes');
  },
  criarCliente(clienteData) {
    return request('/admin/clientes', {
      method: 'POST',
      body: clienteData
    });
  },
  atualizarEstadoCliente(id, ativo) {
    return request(`/admin/clientes/${id}/status`, {
      method: 'PUT',
      body: { ativo }
    });
  },
  atualizarCliente(id, clienteData) {
    return request(`/admin/clientes/${id}`, {
      method: 'PUT',
      body: clienteData
    });
  },
  obterEtars() {
    return request('/admin/etars');
  },
  atualizarDisponibilidadeEtar(id, disponivel) {
    return request(`/admin/etars/${id}/disponibilidade`, {
      method: 'PUT',
      body: { disponivel }
    });
  },
  obterAutorizacoes() {
    return request('/admin/autorizacoes');
  },
  criarAutorizacao(autorizacaoData) {
    return request('/admin/autorizacoes', {
      method: 'POST',
      body: autorizacaoData
    });
  },
  atualizarAutorizacao(id, autorizacaoData) {
    return request(`/admin/autorizacoes/${id}`, {
      method: 'PUT',
      body: autorizacaoData
    });
  },
  obterParametros() {
    return request('/admin/parametros');
  },
  obterParametrosCliente(id) {
    return request(`/admin/clientes/${id}/parametros`);
  },
  atualizarParametrosCliente(id, parametrosIdsArray) {
    return request(`/admin/clientes/${id}/parametros`, {
      method: 'POST',
      body: { parametros: parametrosIdsArray }
    });
  },
  obterRelatorios(filtros) {
    const params = new URLSearchParams();
    if (filtros) {
      if (filtros.id_cliente) params.append('id_cliente', filtros.id_cliente);
      if (filtros.id_etar) params.append('id_etar', filtros.id_etar);
      if (filtros.mes) params.append('mes', filtros.mes);
      if (filtros.ano) params.append('ano', filtros.ano);
      if (filtros.estado) params.append('estado', filtros.estado);
    }
    const queryStr = params.toString();
    return request(`/admin/relatorios${queryStr ? '?' + queryStr : ''}`);
  },
  obterUtilizadores() {
    return request('/admin/utilizadores');
  },
  criarUtilizador(dados) {
    return request('/admin/utilizadores', {
      method: 'POST',
      body: dados
    });
  },
  atualizarUtilizador(id, dados) {
    return request(`/admin/utilizadores/${id}`, {
      method: 'PUT',
      body: dados
    });
  }
};
