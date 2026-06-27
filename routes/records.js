const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { requireAuth } = require('./auth');

// GET /api/records
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    if (!user?.nation_id) return res.json([]);
    const { rows } = await query(
      'SELECT * FROM records WHERE nation_id = $1 ORDER BY created_at DESC',
      [user.nation_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/records
router.post('/', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    if (!user?.nation_id) return res.status(403).json({ error: 'No nation assigned' });
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Data required' });
    const id = uuidv4();
    await query(
      'INSERT INTO records (id, nation_id, data, source) VALUES ($1, $2, $3, $4)',
      [id, user.nation_id, JSON.stringify(data), 'user']
    );
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/records/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    const { rows: [record] } = await query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.nation_id !== user?.nation_id) return res.status(403).json({ error: 'Forbidden' });
    await query(
      'UPDATE records SET data = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(req.body.data), record.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/records/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    const { rows: [record] } = await query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.nation_id !== user?.nation_id) return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM records WHERE id = $1', [record.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
