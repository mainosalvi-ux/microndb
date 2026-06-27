const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db'); // Conexión central a tu archivo db.js

// Middleware de seguridad integrado
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Sesión no iniciada o expirada.' });
}

// GET /api/records
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    const user = rows[0];
    if (!user?.nation_id) return res.json([]);
    
    const { rows: records } = await pool.query(
      'SELECT * FROM records WHERE nation_id = $1 ORDER BY created_at DESC',
      [user.nation_id]
    );
    res.json(records);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/records — AQUÍ FALLABA AL CREAR EL REGISTRO
router.post('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    const user = rows[0];
    if (!user?.nation_id) return res.status(403).json({ error: 'No nation assigned' });
    
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Data required' });
    
    const id = uuidv4();
    await pool.query(
      'INSERT INTO records (id, nation_id, data, source) VALUES ($1, $2, $3, $4)',
      [id, user.nation_id, JSON.stringify(data), 'user']
    );
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/records/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { rows: userRows } = await pool.query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    const user = userRows[0];
    
    const { rows: recordRows } = await pool.query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    const record = recordRows[0];
    
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.nation_id !== user?.nation_id) return res.status(403).json({ error: 'Forbidden' });
    
    await pool.query(
      'UPDATE records SET data = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(req.body.data), record.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/records/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows: userRows } = await pool.query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    const user = userRows[0];
    
    const { rows: recordRows } = await pool.query('SELECT * FROM records WHERE id = $1', [req.params.id]);
    const record = recordRows[0];
    
    if (!record) return res.status(404).json({ error: 'Not found' });
    if (record.nation_id !== user?.nation_id) return res.status(403).json({ error: 'Forbidden' });
    
    await pool.query('DELETE FROM records WHERE id = $1', [record.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
