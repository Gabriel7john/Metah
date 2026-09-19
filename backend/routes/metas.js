const express = require("express");
const db = require("../config/database");
const autenticar = require("../middleware/auth");

const router = express.Router();
router.use(autenticar);

const TIPOS = ["simples", "contador"];

// Listar metas do usuário (com streak e progresso do dia)
router.get("/", (req, res) => {
  const metas = db
    .prepare(
      "SELECT * FROM metas WHERE usuario_id = ? AND ativa = 1 ORDER BY criado_em DESC",
    )
    .all(req.usuario.id);

  res.json(metas.map(montarMeta));
});

// Criar meta
router.post("/", (req, res) => {
  const { titulo, descricao, cor, tipo = "simples" } = req.body;

  if (!titulo) {
    return res.status(400).json({ erro: "Título é obrigatório" });
  }
  if (!TIPOS.includes(tipo)) {
    return res.status(400).json({ erro: "Tipo de meta inválido" });
  }

  let alvo = null;
  let unidade = null;
  let passo = 1;

  if (tipo === "contador") {
    alvo = Number(req.body.alvo);
    if (!Number.isFinite(alvo) || alvo <= 0) {
      return res.status(400).json({ erro: "Informe um alvo maior que zero" });
    }

    const passoInformado = req.body.passo;
    passo =
      passoInformado === undefined || passoInformado === ""
        ? 1
        : Number(passoInformado);
    if (!Number.isFinite(passo) || passo <= 0) {
      return res.status(400).json({ erro: "O passo deve ser maior que zero" });
    }

    unidade =
      String(req.body.unidade || "")
        .trim()
        .slice(0, 20) || null;
  }

  const resultado = db
    .prepare(
      `INSERT INTO metas (usuario_id, titulo, descricao, cor, tipo, alvo, unidade, passo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      req.usuario.id,
      titulo,
      descricao || null,
      cor || "#4f46e5",
      tipo,
      alvo,
      unidade,
      passo,
    );

  const novaMeta = db
    .prepare("SELECT * FROM metas WHERE id = ?")
    .get(resultado.lastInsertRowid);
  res.status(201).json(montarMeta(novaMeta));
});

// Editar meta
router.put("/:id", (req, res) => {
  const { titulo, descricao, cor } = req.body;
  const meta = db
    .prepare("SELECT * FROM metas WHERE id = ? AND usuario_id = ?")
    .get(req.params.id, req.usuario.id);

  if (!meta) return res.status(404).json({ erro: "Meta não encontrada" });

  db.prepare(
    "UPDATE metas SET titulo = ?, descricao = ?, cor = ? WHERE id = ?",
  ).run(
    titulo || meta.titulo,
    descricao !== undefined ? descricao : meta.descricao,
    cor || meta.cor,
    req.params.id,
  );

  res.json(db.prepare("SELECT * FROM metas WHERE id = ?").get(req.params.id));
});

// Excluir (soft delete) meta
router.delete("/:id", (req, res) => {
  const meta = db
    .prepare("SELECT * FROM metas WHERE id = ? AND usuario_id = ?")
    .get(req.params.id, req.usuario.id);

  if (!meta) return res.status(404).json({ erro: "Meta não encontrada" });

  db.prepare("UPDATE metas SET ativa = 0 WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

// Marcar/desmarcar conclusão de hoje (só para metas simples)
router.post("/:id/concluir", (req, res) => {
  const meta = db
    .prepare("SELECT * FROM metas WHERE id = ? AND usuario_id = ?")
    .get(req.params.id, req.usuario.id);

  if (!meta) return res.status(404).json({ erro: "Meta não encontrada" });

  if (meta.tipo === "contador") {
    return res.status(400).json({ erro: "Meta com progresso: use /progresso" });
  }

  const dataHoje = hoje();
  const existente = db
    .prepare("SELECT * FROM conclusoes WHERE meta_id = ? AND data = ?")
    .get(req.params.id, dataHoje);

  if (existente) {
    // desmarcar
    db.prepare("DELETE FROM conclusoes WHERE id = ?").run(existente.id);
  } else {
    db.prepare(
      "INSERT INTO conclusoes (meta_id, data, concluida) VALUES (?, ?, 1)",
    ).run(req.params.id, dataHoje);
  }

  res.json({
    concluidaHoje: !existente,
    streak: calcularStreak(req.params.id),
  });
});

// Somar ao progresso de hoje (quantidade negativa desfaz)
router.post("/:id/progresso", (req, res) => {
  const meta = buscarMetaContador(req, res);
  if (!meta) return;

  const quantidade = Number(req.body.quantidade);
  if (!Number.isFinite(quantidade) || quantidade === 0) {
    return res.status(400).json({ erro: "Quantidade inválida" });
  }

  db.prepare(
    `INSERT INTO progressos (meta_id, data, valor) VALUES (?, ?, ROUND(MAX(0, ?), 4))
     ON CONFLICT(meta_id, data) DO UPDATE SET valor = ROUND(MAX(0, valor + ?), 4)`,
  ).run(meta.id, hoje(), quantidade, quantidade);

  res.json(sincronizarConclusao(meta));
});

// Definir o valor exato de hoje (corrigir erro)
router.patch("/:id/progresso", (req, res) => {
  const meta = buscarMetaContador(req, res);
  if (!meta) return;

  const valor = Number(req.body.valor);
  if (!Number.isFinite(valor) || valor < 0) {
    return res.status(400).json({ erro: "Valor inválido" });
  }

  db.prepare(
    `INSERT INTO progressos (meta_id, data, valor) VALUES (?, ?, ?)
     ON CONFLICT(meta_id, data) DO UPDATE SET valor = excluded.valor`,
  ).run(meta.id, hoje(), valor);

  res.json(sincronizarConclusao(meta));
});

// Histórico de conclusões de uma meta (para calendário/gráfico)
router.get("/:id/historico", (req, res) => {
  const meta = db
    .prepare("SELECT * FROM metas WHERE id = ? AND usuario_id = ?")
    .get(req.params.id, req.usuario.id);

  if (!meta) return res.status(404).json({ erro: "Meta não encontrada" });

  const historico = db
    .prepare(
      "SELECT data, concluida FROM conclusoes WHERE meta_id = ? ORDER BY data DESC",
    )
    .all(req.params.id);

  res.json(historico);
});

// --- Funções auxiliares ---

// Data de hoje (YYYY-MM-DD) no fuso do Brasil. Com toISOString() o "dia"
// virava às 21h, porque ele usa UTC.
function hoje() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

function diaAnterior(dataStr) {
  const d = new Date(`${dataStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

function buscarMetaContador(req, res) {
  const meta = db
    .prepare(
      "SELECT * FROM metas WHERE id = ? AND usuario_id = ? AND ativa = 1",
    )
    .get(req.params.id, req.usuario.id);

  if (!meta) {
    res.status(404).json({ erro: "Meta não encontrada" });
    return null;
  }
  if (meta.tipo !== "contador") {
    res.status(400).json({ erro: "Esta meta não é do tipo progresso" });
    return null;
  }
  return meta;
}

function valorDoDia(metaId) {
  const registro = db
    .prepare("SELECT valor FROM progressos WHERE meta_id = ? AND data = ?")
    .get(metaId, hoje());
  return registro ? registro.valor : 0;
}

function calcularPercentual(valor, alvo) {
  return Math.min(100, Math.round((valor / alvo) * 100));
}

// Meta do tipo contador conta como "concluída" no dia quando valor >= alvo.
// Mantemos a tabela conclusoes em sincronia, então streak e histórico
// continuam funcionando sem nenhuma mudança.
function sincronizarConclusao(meta) {
  const dataHoje = hoje();
  const valorHoje = valorDoDia(meta.id);
  const concluidaHoje = valorHoje >= meta.alvo;

  if (concluidaHoje) {
    db.prepare(
      "INSERT OR IGNORE INTO conclusoes (meta_id, data, concluida) VALUES (?, ?, 1)",
    ).run(meta.id, dataHoje);
  } else {
    db.prepare("DELETE FROM conclusoes WHERE meta_id = ? AND data = ?").run(
      meta.id,
      dataHoje,
    );
  }

  return {
    valorHoje,
    alvo: meta.alvo,
    percentual: calcularPercentual(valorHoje, meta.alvo),
    concluidaHoje,
    streak: calcularStreak(meta.id),
  };
}

function montarMeta(meta) {
  const base = {
    ...meta,
    streak: calcularStreak(meta.id),
    concluidaHoje: foiConcluidaHoje(meta.id),
  };

  if (meta.tipo !== "contador") return base;

  const valorHoje = valorDoDia(meta.id);
  return {
    ...base,
    valorHoje,
    percentual: calcularPercentual(valorHoje, meta.alvo),
  };
}

function foiConcluidaHoje(metaId) {
  const registro = db
    .prepare("SELECT id FROM conclusoes WHERE meta_id = ? AND data = ?")
    .get(metaId, hoje());
  return !!registro;
}

function calcularStreak(metaId) {
  const datas = new Set(
    db
      .prepare("SELECT data FROM conclusoes WHERE meta_id = ?")
      .all(metaId)
      .map((r) => r.data),
  );

  if (datas.size === 0) return 0;

  let cursor = hoje();

  // Se hoje ainda não foi concluída, o streak considera a partir de ontem
  if (!datas.has(cursor)) {
    cursor = diaAnterior(cursor);
  }

  let streak = 0;
  while (datas.has(cursor)) {
    streak++;
    cursor = diaAnterior(cursor);
  }

  return streak;
}

module.exports = router;
