const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "..", "metas.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Cria as tabelas caso não existam
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha_hash TEXT NOT NULL,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS metas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    cor TEXT DEFAULT '#4f46e5',
    ativa INTEGER DEFAULT 1,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conclusoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meta_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    concluida INTEGER DEFAULT 1,
    FOREIGN KEY (meta_id) REFERENCES metas(id) ON DELETE CASCADE,
    UNIQUE(meta_id, data)
  );

  -- Progresso diário das metas do tipo "contador" (ex: 1500 de 2000 ml)
  CREATE TABLE IF NOT EXISTS progressos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meta_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    valor REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (meta_id) REFERENCES metas(id) ON DELETE CASCADE,
    UNIQUE(meta_id, data)
  );
`);

// Migração: adiciona colunas novas em bancos que já existiam
function garantirColuna(tabela, coluna, definicao) {
  const colunas = db
    .prepare(`PRAGMA table_info(${tabela})`)
    .all()
    .map((c) => c.name);
  if (!colunas.includes(coluna)) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}

garantirColuna("metas", "tipo", "TEXT NOT NULL DEFAULT 'simples'"); // 'simples' | 'contador'
garantirColuna("metas", "alvo", "REAL"); // quanto precisa fazer no dia (só contador)
garantirColuna("metas", "unidade", "TEXT"); // ml, páginas, min...
garantirColuna("metas", "passo", "REAL DEFAULT 1"); // incremento dos botões +/−

module.exports = db;
