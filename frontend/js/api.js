const API_URL = "http://localhost:3000/api";

function getToken() {
  return localStorage.getItem("token");
}

function headersAutenticados() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

const api = {
  async registrar(nome, email, senha) {
    const res = await fetch(`${API_URL}/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Erro ao registrar");
    return data;
  },

  async login(email, senha) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Erro ao entrar");
    return data;
  },

  async listarMetas() {
    const res = await fetch(`${API_URL}/metas`, {
      headers: headersAutenticados(),
    });
    return res.json();
  },

  // extras: { tipo, alvo, unidade, passo } para metas com progresso
  async criarMeta(titulo, cor, extras = {}) {
    const res = await fetch(`${API_URL}/metas`, {
      method: "POST",
      headers: headersAutenticados(),
      body: JSON.stringify({ titulo, cor, ...extras }),
    });
    return res.json();
  },

  // soma (ou subtrai, se negativo) ao progresso de hoje
  async registrarProgresso(id, quantidade) {
    const res = await fetch(`${API_URL}/metas/${id}/progresso`, {
      method: "POST",
      headers: headersAutenticados(),
      body: JSON.stringify({ quantidade }),
    });
    return res.json();
  },

  // define o valor exato de hoje
  async definirProgresso(id, valor) {
    const res = await fetch(`${API_URL}/metas/${id}/progresso`, {
      method: "PATCH",
      headers: headersAutenticados(),
      body: JSON.stringify({ valor }),
    });
    return res.json();
  },

  async concluirMeta(id) {
    const res = await fetch(`${API_URL}/metas/${id}/concluir`, {
      method: "POST",
      headers: headersAutenticados(),
    });
    return res.json();
  },

  async excluirMeta(id) {
    await fetch(`${API_URL}/metas/${id}`, {
      method: "DELETE",
      headers: headersAutenticados(),
    });
  },
};
