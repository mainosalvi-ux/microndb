const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb, query, queryOne, run } = require('./database');

const ADMIN_EMAIL = 'mainosalvi@gmail.com';
const ADMIN_PASSWORD = 'salvi3141';

async function seedAdmin() {
  await getDb();
  const existing = queryOne('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);
  if (!existing) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    run('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), 'Admin', ADMIN_EMAIL, hash, 'admin']);
    console.log('  Admin seeded:', ADMIN_EMAIL);
  } else {
    // Always sync admin password on boot
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    run('UPDATE users SET password = ? WHERE email = ?', [hash, ADMIN_EMAIL]);
  }
}

function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.userId || req.session?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

router.post('/login', async (req, res) => {
  await getDb();
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = queryOne('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Incorrect email or password' });
  req.session.userId = user.id;
  req.session.role = user.role;
  const nation = user.nation_id ? queryOne('SELECT * FROM nations WHERE id = ?', [user.nation_id]) : null;
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    nation: nation ? { ...nation, fields: JSON.parse(nation.fields) } : null
  });
});

router.post('/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

router.get('/me', requireAuth, async (req, res) => {
  await getDb();
  const user = queryOne('SELECT id, name, email, role, nation_id FROM users WHERE id = ?', [req.session.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const nation = user.nation_id ? queryOne('SELECT * FROM nations WHERE id = ?', [user.nation_id]) : null;
  res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    nation: nation ? { ...nation, fields: JSON.parse(nation.fields) } : null
  });
});

module.exports = { router, requireAuth, requireAdmin, seedAdmin };
