const telaAuth = document.getElementById("tela-auth");
const telaDashboard = document.getElementById("tela-dashboard");

// --- Alternar abas login/registro ---
const tabLogin = document.getElementById("tab-login");
const tabRegistro = document.getElementById("tab-registro");
const formLogin = document.getElementById("form-login");
const formRegistro = document.getElementById("form-registro");

tabLogin.addEventListener("click", () => {
  tabLogin.classList.add("ativa");
  tabRegistro.classList.remove("ativa");
  formLogin.style.display = "flex";
  formRegistro.style.display = "none";
});

tabRegistro.addEventListener("click", () => {
  tabRegistro.classList.add("ativa");
  tabLogin.classList.remove("ativa");
  formRegistro.style.display = "flex";
  formLogin.style.display = "none";
});

// --- Login ---
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const senha = document.getElementById("login-senha").value;
  const erroEl = document.getElementById("erro-login");

  try {
    const { token } = await api.login(email, senha);
    localStorage.setItem("token", token);
    mostrarDashboard();
  } catch (err) {
    erroEl.textContent = err.message;
  }
});

// --- Registro ---
formRegistro.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("registro-nome").value;
  const email = document.getElementById("registro-email").value;
  const senha = document.getElementById("registro-senha").value;
  const erroEl = document.getElementById("erro-registro");

  try {
    const { token } = await api.registrar(nome, email, senha);
    localStorage.setItem("token", token);
    mostrarDashboard();
  } catch (err) {
    erroEl.textContent = err.message;
  }
});

// --- Sair ---
document.getElementById("btn-sair").addEventListener("click", () => {
  localStorage.removeItem("token");
  telaDashboard.style.display = "none";
  telaAuth.style.display = "flex";
});

// --- Nova meta ---
const inputTipo = document.getElementById("input-tipo");
const camposContador = document.getElementById("campos-contador");
const inputAlvo = document.getElementById("input-alvo");

inputTipo.addEventListener("change", () => {
  const ehContador = inputTipo.value === "contador";
  camposContador.style.display = ehContador ? "flex" : "none";
  inputAlvo.required = ehContador;
});

document
  .getElementById("form-nova-meta")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const titulo = document.getElementById("input-titulo").value;
    const cor = document.getElementById("input-cor").value;
    const tipo = inputTipo.value;

    const extras = { tipo };
    if (tipo === "contador") {
      extras.alvo = Number(inputAlvo.value);
      extras.unidade = document.getElementById("input-unidade").value;
      extras.passo = document.getElementById("input-passo").value || 1;
    }

    const resposta = await api.criarMeta(titulo, cor, extras);
    if (resposta.erro) {
      alert(resposta.erro);
      return;
    }

    e.target.reset();
    camposContador.style.display = "none";
    inputAlvo.required = false;
    carregarMetas();
  });

// --- Renderizar metas ---
function escapar(texto) {
  const el = document.createElement("div");
  el.textContent = texto ?? "";
  return el.innerHTML;
}

function formatarNumero(n) {
  return Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function htmlStreak(meta) {
  return `<div class="meta-streak">🔥 ${meta.streak} dia${meta.streak !== 1 ? "s" : ""} seguidos</div>`;
}

function htmlMetaSimples(meta) {
  return `
    <div class="meta-info">
      <h3>${escapar(meta.titulo)}</h3>
      ${htmlStreak(meta)}
    </div>
    <div class="meta-acoes">
      <button class="btn-concluir ${meta.concluidaHoje ? "marcado" : ""}" data-id="${meta.id}">✓</button>
      <button class="btn-excluir" data-id="${meta.id}">🗑</button>
    </div>
  `;
}

function htmlMetaContador(meta) {
  const unidade = meta.unidade ? ` ${escapar(meta.unidade)}` : "";
  const passo = meta.passo || 1;

  return `
    <div class="meta-info">
      <h3>${escapar(meta.titulo)}</h3>
      <div class="barra">
        <div class="barra-preenchimento" style="width:${meta.percentual}%"></div>
      </div>
      <div class="meta-progresso">
        ${formatarNumero(meta.valorHoje)} / ${formatarNumero(meta.alvo)}${unidade} (${meta.percentual}%)
      </div>
      ${htmlStreak(meta)}
    </div>
    <div class="meta-acoes">
      <button class="btn-progresso" data-id="${meta.id}" data-quantidade="${-passo}">−${formatarNumero(passo)}</button>
      <button class="btn-progresso mais" data-id="${meta.id}" data-quantidade="${passo}">+${formatarNumero(passo)}</button>
      <button class="btn-editar-valor" data-id="${meta.id}" data-valor="${meta.valorHoje}" title="Definir valor de hoje">✎</button>
      <button class="btn-excluir" data-id="${meta.id}">🗑</button>
    </div>
  `;
}

async function carregarMetas() {
  const metas = await api.listarMetas();
  const lista = document.getElementById("lista-metas");
  lista.innerHTML = "";

  if (metas.length === 0) {
    lista.innerHTML =
      '<p style="text-align:center;color:#888">Nenhuma meta ainda. Adicione a primeira acima!</p>';
    return;
  }
  function atualizarResumo(metas) {
    const resumo = document.getElementById("resumo-dia");

    if (metas.length === 0) {
      resumo.textContent = "";
      return;
    }

    const feitas = metas.filter((m) => m.concluidaHoje).length;
    const percentual = Math.round((feitas / metas.length) * 100);
    const todas = feitas === metas.length ? " 🎉" : "";

    resumo.textContent = `Hoje: ${feitas} de ${metas.length} metas concluídas (${percentual}%)${todas}`;
  }

  metas.forEach((meta) => {
    const card = document.createElement("div");
    card.className = `card-meta ${meta.concluidaHoje ? "concluida" : ""}`;
    card.style.setProperty("--cor", meta.cor);

    card.innerHTML =
      meta.tipo === "contador" ? htmlMetaContador(meta) : htmlMetaSimples(meta);

    lista.appendChild(card);
  });

  // eventos dos botões
  document.querySelectorAll(".btn-concluir").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.concluirMeta(btn.dataset.id);
      carregarMetas();
    });
  });

  document.querySelectorAll(".btn-progresso").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await api.registrarProgresso(
        btn.dataset.id,
        Number(btn.dataset.quantidade),
      );
      carregarMetas();
    });
  });

  document.querySelectorAll(".btn-editar-valor").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const entrada = prompt("Quanto você já fez hoje?", btn.dataset.valor);
      if (entrada === null) return;

      const valor = Number(entrada.replace(",", "."));
      if (entrada.trim() === "" || !Number.isFinite(valor) || valor < 0) {
        alert("Digite um número válido (0 ou mais).");
        return;
      }

      await api.definirProgresso(btn.dataset.id, valor);
      carregarMetas();
    });
  });

  document.querySelectorAll(".btn-excluir").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Excluir esta meta?")) {
        await api.excluirMeta(btn.dataset.id);
        carregarMetas();
      }
    });
  });
}

const FRASES = [
  "Pequenos passos todos os dias levam longe.",
  "Constância vence motivação.",
  "Hoje é dia de cumprir o combinado com você mesmo.",
  "Não precisa ser perfeito, precisa ser feito.",
  "Um dia de cada vez, uma meta de cada vez.",
  "Quem começa hoje já sai na frente de quem começa amanhã.",
  "O hábito de hoje é o resultado de amanhã.",
];

function mostrarFraseDoDia() {
  // muda a cada dia, mas fica igual durante o dia todo
  const dia = Math.floor(Date.now() / 86400000);
  document.getElementById("frase-dia").textContent =
    FRASES[dia % FRASES.length];
}

function mostrarDashboard() {
  telaAuth.style.display = "none";
  telaDashboard.style.display = "block";
  mostrarFraseDoDia();
  carregarMetas();
}

// --- Inicialização ---
if (getToken()) {
  mostrarDashboard();
}
