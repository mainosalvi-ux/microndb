const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');

// GET /api/join/:token
router.get('/:token', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, name, color_idx, fields FROM nations WHERE join_token = $1',
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired link' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/join/:token — citizen self-registration
router.post('/:token', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id FROM nations WHERE join_token = $1',
      [req.params.token]
    );
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired link' });
    const nation = rows[0];
    const { data } = req.body;
    if (!data || typeof data !== 'object') return res.status(400).json({ error: 'Data required' });

    // Insert — citizen_number set automatically by DB trigger
    const id = uuidv4();
    const { rows: [rec] } = await query(
      `INSERT INTO records (id, nation_id, data, source, joined_at)
       VALUES ($1, $2, $3, 'citizen', NOW())
       RETURNING id, citizen_number, joined_at`,
      [id, nation.id, JSON.stringify(data)]
    );

    res.json({ ok: true, id: rec.id, citizenNumber: rec.citizen_number, joinedAt: rec.joined_at });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
