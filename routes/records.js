const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, query, queryOne, run } = require('./database');
const { requireAuth } = require('./auth');

router.get('/', requireAuth, async (req, res) => {
  await getDb();
  const user = queryOne('SELECT nation_id FROM users WHERE id = ?', [req.session.userId]);
  if (!user?.nation_id) return res.json([]);
  const records = query('SELECT * FROM records WHERE nation_id = ? ORDER BY created_at DESC', [user.nation_id]);
  res.json(records.map(r => ({ ...r, data: JSON.parse(r.data) })));
});

router.post('/', requireAuth, async (req, res) => {
  await getDb();
  const user = queryOne('SELECT nation_id FROM users WHERE id = ?', [req.session.userId]);
  if (!user?.nation_id) return res.status(403).json({ error: 'No nation assigned' });
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'Data required' });
  const id = uuidv4();
  run('INSERT INTO records (id, nation_id, data, source) VALUES (?, ?, ?, ?)', [id, user.nation_id, JSON.stringify(data), 'user']);
  res.json({ ok: true, id });
});

router.put('/:id', requireAuth, async (req, res) => {
  await getDb();
  const user = queryOne('SELECT nation_id FROM users WHERE id = ?', [req.session.userId]);
  const record = queryOne('SELECT * FROM records WHERE id = ?', [req.params.id]);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  if (record.nation_id !== user?.nation_id) return res.status(403).json({ error: 'Forbidden' });
  run("UPDATE records SET data = ?, updated_at = datetime('now') WHERE id = ?", [JSON.stringify(req.body.data), record.id]);
  res.json({ ok: true });
});

router.delete('/:id', requireAuth, async (req, res) => {
  await getDb();
  const user = queryOne('SELECT nation_id FROM users WHERE id = ?', [req.session.userId]);
  const record = queryOne('SELECT * FROM records WHERE id = ?', [req.params.id]);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  if (record.nation_id !== user?.nation_id) return res.status(403).json({ error: 'Forbidden' });
  run('DELETE FROM records WHERE id = ?', [record.id]);
  res.json({ ok: true });
});

module.exports = router;
