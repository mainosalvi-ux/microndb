const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');

const ADMIN_EMAIL = 'mainosalvi@gmail.com';
const ADMIN_PASSWORD = 'salvi3141';

async function seedAdmin() {
  const { rows } = await query('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL]);
  const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  if (rows.length === 0) {
    await query(
      'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), 'Admin', ADMIN_EMAIL, hash, 'admin']
    );
    console.log('  Admin created:', ADMIN_EMAIL);
  } else {
    // Always sync password on boot so changes to ADMIN_PASSWORD take effect
    await query('UPDATE users SET password = $1 WHERE email = $2', [hash, ADMIN_EMAIL]);
  }
}

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.userId || req.session?.role !== 'admin')
    return res.status(403).json({ error: 'Forbidden' });
  next();
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  try {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Incorrect email or password' });
    req.session.userId = user.id;
    req.session.role = user.role;
    let nation = null;
    if (user.nation_id) {
      const { rows: nr } = await query('SELECT * FROM nations WHERE id = $1', [user.nation_id]);
      nation = nr[0] || null;
    }
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      nation,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, email, role, nation_id FROM users WHERE id = $1',
      [req.session.userId]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    let nation = null;
    if (user.nation_id) {
      const { rows: nr } = await query('SELECT * FROM nations WHERE id = $1', [user.nation_id]);
      nation = nr[0] || null;
    }
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      nation,
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, requireAuth, requireAdmin, seedAdmin };
