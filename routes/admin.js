const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { getDb, query, queryOne, run } = require('./database');
const { requireAdmin } = require('./auth');

function genToken() {
  return crypto.randomBytes(16).toString('hex');
}

router.get('/users', requireAdmin, async (req, res) => {
  await getDb();
  const users = query("SELECT id, name, email, role, nation_id, created_at FROM users WHERE role != 'admin'");
  const nations = query('SELECT * FROM nations').reduce((m, n) => {
    m[n.id] = { ...n, fields: JSON.parse(n.fields) }; return m;
  }, {});
  res.json(users.map(u => ({ ...u, nation: u.nation_id ? nations[u.nation_id] : null })));
});

router.post('/users', requireAdmin, async (req, res) => {
  await getDb();
  const { name, email, password, nationName, fields } = req.body;
  if (!name || !email || !password || !nationName || !fields?.length)
    return res.status(400).json({ error: 'All fields required' });
  const existing = queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const colorIdx = query('SELECT COUNT(*) as c FROM nations')[0].c % 8;
  const nationId = uuidv4();
  const token = genToken();
  run('INSERT INTO nations (id, name, color_idx, fields, join_token) VALUES (?, ?, ?, ?, ?)',
    [nationId, nationName, colorIdx, JSON.stringify(fields), token]);
  const userId = uuidv4();
  run('INSERT INTO users (id, name, email, password, role, nation_id) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, name, email.toLowerCase().trim(), bcrypt.hashSync(password, 10), 'user', nationId]);
  res.json({ ok: true, userId, nationId, joinToken: token });
});

router.put('/users/:id', requireAdmin, async (req, res) => {
  await getDb();
  const { name, password, nationName, fields } = req.body;
  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (name) run('UPDATE users SET name = ? WHERE id = ?', [name, user.id]);
  if (password) run('UPDATE users SET password = ? WHERE id = ?', [bcrypt.hashSync(password, 10), user.id]);
  if (nationName && user.nation_id) run('UPDATE nations SET name = ? WHERE id = ?', [nationName, user.nation_id]);
  if (fields && user.nation_id) run('UPDATE nations SET fields = ? WHERE id = ?', [JSON.stringify(fields), user.nation_id]);
  res.json({ ok: true });
});

router.delete('/users/:id', requireAdmin, async (req, res) => {
  await getDb();
  const user = queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.nation_id) {
    run('DELETE FROM records WHERE nation_id = ?', [user.nation_id]);
    run('DELETE FROM nations WHERE id = ?', [user.nation_id]);
  }
  run('DELETE FROM users WHERE id = ?', [user.id]);
  res.json({ ok: true });
});

router.get('/nations', requireAdmin, async (req, res) => {
  await getDb();
  const nations = query('SELECT * FROM nations').map(n => ({ ...n, fields: JSON.parse(n.fields) }));
  const records = query('SELECT * FROM records ORDER BY created_at DESC').map(r => ({ ...r, data: JSON.parse(r.data) }));
  const byNation = records.reduce((m, r) => { (m[r.nation_id] = m[r.nation_id] || []).push(r); return m; }, {});
  res.json(nations.map(n => ({ ...n, records: byNation[n.id] || [] })));
});

router.get('/stats', requireAdmin, async (req, res) => {
  await getDb();
  const nations = query('SELECT COUNT(*) as c FROM nations')[0].c;
  const users = query("SELECT COUNT(*) as c FROM users WHERE role != 'admin'")[0].c;
  const records = query('SELECT COUNT(*) as c FROM records')[0].c;
  const recent = query(`
    SELECT r.id, r.data, r.created_at, r.nation_id, r.source, n.name as nation_name, n.color_idx
    FROM records r JOIN nations n ON r.nation_id = n.id
    ORDER BY r.created_at DESC LIMIT 8
  `).map(r => ({ ...r, data: JSON.parse(r.data) }));
  res.json({ nations, users, records, recent });
});

// Regenerate join link
router.post('/nations/:id/regen-token', requireAdmin, async (req, res) => {
  await getDb();
  const token = genToken();
  run('UPDATE nations SET join_token = ? WHERE id = ?', [token, req.params.id]);
  res.json({ ok: true, joinToken: token });
});

module.exports = router;
