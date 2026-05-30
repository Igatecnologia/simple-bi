const express = require('express');
const path    = require('path');
const db      = require('./database');

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // serve index.html

// ── ADMIN AUTH ────────────────────────────────────────────────────────────

app.post('/api/admin/auth', (req, res) => {
  const { usuario, senha_hash } = req.body;
  const cfg = db.prepare('SELECT usuario, senha_hash FROM admin_config WHERE id = 1').get();
  if (!cfg || cfg.usuario !== usuario || cfg.senha_hash !== senha_hash)
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  res.json({ ok: true });
});

app.put('/api/admin/senha', (req, res) => {
  const { usuario_atual, senha_hash_atual, usuario_novo, senha_hash_nova } = req.body;
  const cfg = db.prepare('SELECT usuario, senha_hash FROM admin_config WHERE id = 1').get();
  if (!cfg || cfg.usuario !== usuario_atual || cfg.senha_hash !== senha_hash_atual)
    return res.status(401).json({ erro: 'Usuário ou senha atual incorretos.' });
  db.prepare('UPDATE admin_config SET usuario = ?, senha_hash = ? WHERE id = 1')
    .run(usuario_novo || usuario_atual, senha_hash_nova);
  res.json({ ok: true });
});

// ── EMPRESAS ──────────────────────────────────────────────────────────────

app.get('/api/empresas', (req, res) => {
  const empresas = db.prepare(
    'SELECT * FROM empresas WHERE ativo = 1 ORDER BY nome'
  ).all();
  const relStmt = db.prepare(
    'SELECT * FROM relatorios WHERE empresa_id = ? AND ativo = 1 ORDER BY nome'
  );
  empresas.forEach(e => { e.relatorios = relStmt.all(e.id); });
  res.json(empresas);
});

app.post('/api/empresas', (req, res) => {
  const { nome, api_base, login_endpoint, relatorios = [] } = req.body;
  if (!nome || !api_base || !login_endpoint)
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });

  const r = db.prepare(
    'INSERT INTO empresas (nome, api_base, login_endpoint) VALUES (?, ?, ?)'
  ).run(nome.trim(), api_base.trim(), login_endpoint.trim());

  const relStmt = db.prepare(
    'INSERT INTO relatorios (empresa_id, nome, endpoint) VALUES (?, ?, ?)'
  );
  relatorios.forEach(rel => relStmt.run(r.lastInsertRowid, rel.nome.trim(), rel.endpoint.trim()));

  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(r.lastInsertRowid);
  empresa.relatorios = db.prepare('SELECT * FROM relatorios WHERE empresa_id = ?').all(r.lastInsertRowid);
  res.status(201).json(empresa);
});

app.put('/api/empresas/:id', (req, res) => {
  const id = Number(req.params.id);
  const { nome, api_base, login_endpoint, relatorios = [] } = req.body;
  if (!nome || !api_base || !login_endpoint)
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });

  db.prepare(
    'UPDATE empresas SET nome = ?, api_base = ?, login_endpoint = ? WHERE id = ?'
  ).run(nome.trim(), api_base.trim(), login_endpoint.trim(), id);

  // sincroniza relatórios: remove e re-insere
  db.prepare('DELETE FROM relatorios WHERE empresa_id = ?').run(id);
  const relStmt = db.prepare(
    'INSERT INTO relatorios (empresa_id, nome, endpoint) VALUES (?, ?, ?)'
  );
  relatorios.forEach(rel => relStmt.run(id, rel.nome.trim(), rel.endpoint.trim()));

  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(id);
  empresa.relatorios = db.prepare('SELECT * FROM relatorios WHERE empresa_id = ?').all(id);
  res.json(empresa);
});

app.delete('/api/empresas/:id', (req, res) => {
  db.prepare('UPDATE empresas SET ativo = 0 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ── PROXY (evita Mixed Content HTTPS → HTTP) ─────────────────────────────
app.post('/api/proxy', async (req, res) => {
  const { url, method = 'GET', headers = {}, body } = req.body;
  if (!url) return res.status(400).json({ erro: 'URL não informada.' });
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json', ...headers } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch {
    res.status(502).json({ erro: 'Não foi possível conectar à API externa.' });
  }
});

// ── START ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Simple BI rodando em http://localhost:${PORT}`);
  console.log(`Senha admin padrão: admin`);
});
