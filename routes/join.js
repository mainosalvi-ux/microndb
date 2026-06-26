const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, queryOne, run } = require('./database');

// GET /api/join/:token — get nation info for the public form
router.get('/:token', async (req, res) => {
  await getDb();
  const nation = queryOne('SELECT id, name, color_idx, fields FROM nations WHERE join_token = ?', [req.params.token]);
  if (!nation) return res.status(404).json({ error: 'Invalid or expired link' });
  res.json({ ...nation, fields: JSON.parse(nation.fields) });
});

// POST /api/join/:token — submit citizen registration
router.post('/:token', async (req, res) => {
  await getDb();
  const nation = queryOne('SELECT id FROM nations WHERE join_token = ?', [req.params.token]);
  if (!nation) return res.status(404).json({ error: 'Invalid or expired link' });
  const { data } = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Data required' });
  const id = uuidv4();
  run('INSERT INTO records (id, nation_id, data, source) VALUES (?, ?, ?, ?)',
    [id, nation.id, JSON.stringify(data), 'citizen']);
  res.json({ ok: true, id });
});

module.exports = router;
