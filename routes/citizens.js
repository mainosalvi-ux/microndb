const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, query, queryOne, run } = require('./database');

// GET /api/citizens/:slug  — public: get nation info + citizen fields
router.get('/:slug', async (req, res) => {
  await getDb();
  const nation = queryOne('SELECT id, name, slug, color_idx, fields FROM nations WHERE slug = ?', [req.params.slug]);
  if (!nation) return res.status(404).json({ error: 'Nation not found' });
  // Citizen form fields: we use a fixed set (name, email, birthdate, city of origin)
  // plus any extra fields from the nation if they want
  res.json({ id: nation.id, name: nation.name, slug: nation.slug, color_idx: nation.color_idx });
});

// POST /api/citizens/:slug  — public: register as citizen
router.post('/:slug', async (req, res) => {
  await getDb();
  const nation = queryOne('SELECT id FROM nations WHERE slug = ?', [req.params.slug]);
  if (!nation) return res.status(404).json({ error: 'Nation not found' });
  const { data } = req.body;
  if (!data || !data.full_name || !data.email) return res.status(400).json({ error: 'Name and email are required' });

  // Prevent duplicate email per nation
  const existing = query('SELECT id FROM citizens WHERE nation_id = ?', [nation.id])
    .map(c => JSON.parse(queryOne('SELECT data FROM citizens WHERE id = ?', [c.id])?.data || '{}'))
    .find(d => d.email?.toLowerCase() === data.email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'This email is already registered in this nation' });

  const id = uuidv4();
  run('INSERT INTO citizens (id, nation_id, data) VALUES (?, ?, ?)',
    [id, nation.id, JSON.stringify(data)]);
  res.json({ ok: true, id });
});

module.exports = router;
