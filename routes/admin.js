const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { pool } = require('../db'); // Conexión central a Supabase

// Middleware integrado directamente aquí para evitar errores de importación 'undefined'
function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de administrador' });
}

function genToken() {
  return crypto.randomBytes(16).toString('hex');
}

// GET /api/admin/users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const { rows: users } = await pool.query(
      "SELECT id, name, email, role, nation_id, created_at FROM users WHERE role != 'admin'"
    );
    const { rows: nations } = await pool.query('SELECT * FROM nations');
    const nationMap = Object.fromEntries(nations.map(n => [n.id, n]));
    res.json(users.map(u => ({ ...u, nation: u.nation_id ? nationMap[u.nation_id] : null })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/users
router.post('/users', requireAdmin, async (req, res) => {
  const { name, email, password, nationName, fields } = req.body;
  if (!name || !email || !password || !nationName || !fields?.length)
    return res.status(400).json({ error: 'All fields required' });
  try {
    const { rows: ex } = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (ex.length) return res.status(409).json({ error: 'Email already registered' });

    const { rows: nc } = await pool.query('SELECT COUNT(*) as c FROM nations');
    const colorIdx = parseInt(nc[0]?.c || 0) % 8;
    const nationId = uuidv4();
    const token = genToken();

    await pool.query(
      'INSERT INTO nations (id, name, color_idx, fields, join_token) VALUES ($1, $2, $3, $4, $5)',
      [nationId, nationName, colorIdx, JSON.stringify(fields), token]
    );
    const userId = uuidv4();
    await pool.query(
      'INSERT INTO users (id, name, email, password, role, nation_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [userId, name, email.toLowerCase().trim(), bcrypt.hashSync(password, 10), 'user', nationId]
    );
    res.json({ ok: true, userId, nationId, joinToken: token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/users/:id
router.put('/users/:id', requireAdmin, async (req, res) => {
  const { name, password, nationName, fields } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (name) await pool.query('UPDATE users SET name = $1 WHERE id = $2', [name, user.id]);
    if (password) await pool.query('UPDATE users SET password = $1 WHERE id = $2', [bcrypt.hashSync(password, 10), user.id]);
    if (nationName && user.nation_id) await pool.query('UPDATE nations SET name = $1 WHERE id = $2', [nationName, user.nation_id]);
    if (fields && user.nation_id) await pool.query('UPDATE nations SET fields = $1 WHERE id = $2', [JSON.stringify(fields), user.nation_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.nation_id) {
      await pool.query('DELETE FROM records WHERE nation_id = $1', [user.nation_id]);
      await pool.query('DELETE FROM documents WHERE nation_id = $1', [user.nation_id]);
      await pool.query('DELETE FROM nations WHERE id = $1', [user.nation_id]);
    }
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { rows: [nc] } = await pool.query('SELECT COUNT(*) as c FROM nations');
    const { rows: [uc] } = await pool.query("SELECT COUNT(*) as c FROM users WHERE role != 'admin'");
    const { rows: [rc] } = await pool.query('SELECT COUNT(*) as c FROM records');
    const { rows: [cc] } = await pool.query("SELECT COUNT(*) as c FROM records WHERE source = 'citizen'");
    res.json({
      nations: parseInt(nc?.c || 0),
      users: parseInt(uc?.c || 0),
      records: parseInt(rc?.c || 0),
      citizens: parseInt(cc?.c || 0),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/admin/nations
router.get('/nations', requireAdmin, async (req, res) => {
  try {
    const { rows: nations } = await pool.query('SELECT * FROM nations ORDER BY created_at ASC');
    const { rows: counts } = await pool.query(`
      SELECT nation_id,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE source = 'citizen') as citizens
      FROM records GROUP BY nation_id
    `);
    const countMap = Object.fromEntries(counts.map(c => [c.nation_id, c]));
    res.json(nations.map(n => ({
      ...n,
      total: parseInt(countMap[n.id]?.total || 0),
      citizens: parseInt(countMap[n.id]?.citizens || 0),
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/nations/:id/regen-token
router.post('/nations/:id/regen-token', requireAdmin, async (req, res) => {
  try {
    const token = genToken();
    await pool.query('UPDATE nations SET join_token = $1 WHERE id = $2', [token, req.params.id]);
    res.json({ ok: true, joinToken: token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
