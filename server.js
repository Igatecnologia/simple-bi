const express = require('express');
const path    = require('path');
const { randomUUID } = require('crypto');
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
    'INSERT INTO empresas (nome, api_base, login_endpoint, uuid) VALUES (?, ?, ?, ?)'
  ).run(nome.trim(), api_base.trim(), login_endpoint.trim(), randomUUID());

  const relStmt = db.prepare(
    'INSERT INTO relatorios (empresa_id, nome, endpoint, tipo, campo_exibicao) VALUES (?, ?, ?, ?, ?)'
  );
  relatorios.forEach(rel => relStmt.run(r.lastInsertRowid, rel.nome.trim(), rel.endpoint.trim(), rel.tipo || 'vendas', rel.campo_exibicao ?? 'campo1'));

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
    'INSERT INTO relatorios (empresa_id, nome, endpoint, tipo, campo_exibicao) VALUES (?, ?, ?, ?, ?)'
  );
  relatorios.forEach(rel => relStmt.run(id, rel.nome.trim(), rel.endpoint.trim(), rel.tipo || 'vendas', rel.campo_exibicao ?? 'campo1'));

  const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?').get(id);
  empresa.relatorios = db.prepare('SELECT * FROM relatorios WHERE empresa_id = ?').all(id);
  res.json(empresa);
});

app.delete('/api/empresas/:id', (req, res) => {
  db.prepare('UPDATE empresas SET ativo = 0 WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
});

// ── PROXY PARA A FONTE DE DADOS (ERP) ────────────────────────────────────
// O navegador nunca chama a API do ERP diretamente — sempre esta própria
// origem. O api_base real fica só no banco, do lado do servidor.

app.all('/api/erp/:uuid/*', async (req, res) => {
  const empresa = db.prepare(
    'SELECT * FROM empresas WHERE uuid = ? AND ativo = 1'
  ).get(req.params.uuid);
  if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });

  const subpath     = '/' + req.params[0];
  const queryIdx     = req.originalUrl.indexOf('?');
  const query        = queryIdx === -1 ? '' : req.originalUrl.slice(queryIdx);
  const url          = `${empresa.api_base}${subpath}${query}`;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        'Content-Type': 'application/json',
        'EMP-UUID': empresa.uuid,
      },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      signal: AbortSignal.timeout(120000),
    });
    const body = await upstream.text();
    res.status(upstream.status);
    res.set('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(body);
  } catch (err) {
    const timedOut = err.name === 'TimeoutError' || err.name === 'AbortError';
    res.status(timedOut ? 504 : 502).json({ erro: `Erro ao acessar fonte de dados (${err.message})` });
  }
});

// ── START ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Simple BI rodando em http://localhost:${PORT}`);
  console.log(`Senha admin padrão: admin`);
});
