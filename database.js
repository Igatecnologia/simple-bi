const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(process.env.DB_PATH || path.join(__dirname, 'bi.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS empresas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    nome            TEXT    NOT NULL,
    api_base        TEXT    NOT NULL,
    login_endpoint  TEXT    NOT NULL DEFAULT '/usuario/login',
    ativo           INTEGER NOT NULL DEFAULT 1,
    criado_em       DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS relatorios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id  INTEGER NOT NULL,
    nome        TEXT    NOT NULL,
    endpoint    TEXT    NOT NULL,
    ativo       INTEGER NOT NULL DEFAULT 1,
    criado_em   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin_config (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    usuario     TEXT NOT NULL DEFAULT 'admin',
    senha_hash  TEXT NOT NULL
  );
`);

// migração: adiciona coluna usuario se não existir
try {
  db.exec("ALTER TABLE admin_config ADD COLUMN usuario TEXT NOT NULL DEFAULT 'admin'");
} catch (_) { /* coluna já existe */ }

// migração: adiciona coluna tipo em relatorios
try {
  db.exec("ALTER TABLE relatorios ADD COLUMN tipo TEXT NOT NULL DEFAULT 'vendas'");
} catch (_) { /* coluna já existe */ }

// migração: adiciona coluna campo_exibicao em relatorios
try {
  db.exec("ALTER TABLE relatorios ADD COLUMN campo_exibicao TEXT NOT NULL DEFAULT 'campo1'");
} catch (_) { /* coluna já existe */ }

// credenciais padrão: admin / admin  →  sha256("admin")
const adminExists = db.prepare('SELECT COUNT(*) AS n FROM admin_config').get();
if (adminExists.n === 0) {
  db.prepare('INSERT INTO admin_config (id, usuario, senha_hash) VALUES (1, ?, ?)').run(
    'admin',
    '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'
  );
}

// seed: empresa SGB (exemplo inicial)
const empCount = db.prepare('SELECT COUNT(*) AS n FROM empresas').get();
if (empCount.n === 0) {
  const r = db.prepare(
    'INSERT INTO empresas (nome, api_base, login_endpoint) VALUES (?, ?, ?)'
  ).run('SGB', 'http://dbcayemecolchoes.centraldoaplicativo.com.br/sgbrbi', '/usuario/login');

  db.prepare(
    'INSERT INTO relatorios (empresa_id, nome, endpoint) VALUES (?, ?, ?)'
  ).run(r.lastInsertRowid, 'Vendas Sintético', '/vendas/analitico');

  db.prepare('INSERT INTO relatorios (empresa_id, nome, endpoint, tipo) VALUES (?, ?, ?, ?)'
  ).run(r.lastInsertRowid, 'Produção', '/produzido', 'producao');

  db.prepare('INSERT INTO relatorios (empresa_id, nome, endpoint, tipo) VALUES (?, ?, ?, ?)'
  ).run(r.lastInsertRowid, 'Compras', '/compras', 'compras');
}

// migração: seed relatório "Venda Detalhada" para cada empresa que ainda não o tenha
try {
  const empresas = db.prepare('SELECT id FROM empresas WHERE ativo = 1').all();
  const insStmt  = db.prepare(
    'INSERT INTO relatorios (empresa_id, nome, endpoint, tipo) VALUES (?, ?, ?, ?)'
  );
  empresas.forEach(e => {
    const existe = db.prepare(
      "SELECT COUNT(*) AS n FROM relatorios WHERE empresa_id = ? AND tipo = 'vendadet'"
    ).get(e.id);
    if (existe.n === 0) {
      insStmt.run(e.id, 'Venda Detalhada', '/venda/detalhada', 'vendadet');
    }
  });
} catch (_) {}

module.exports = db;
