const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db'); // Conexión central a Supabase

// Middleware de seguridad integrado
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Sesión no iniciada o expirada.' });
}

const UPLOAD_DIR = path.join(__dirname, '../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.txt', '.xlsx', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// GET /api/documents — list documents for my nation
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await pool.query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    if (!user?.nation_id) return res.json([]);
    const { rows } = await pool.query(
      'SELECT * FROM documents WHERE nation_id = $1 ORDER BY created_at DESC',
      [user.nation_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/documents — upload a document
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { rows: [user] } = await pool.query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    if (!user?.nation_id) return res.status(403).json({ error: 'No nation assigned' });
    if (!req.file) return res.status(400).json({ error: 'No file or unsupported format (PDF, Word, Excel, image, TXT)' });
    const id = uuidv4();
    await pool.query(
      'INSERT INTO documents (id, nation_id, uploaded_by, filename, original_name, mimetype, size) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, user.nation_id, req.session.userId, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size]
    );
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/documents/:id/download
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await pool.query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    const { rows: [doc] } = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.nation_id !== user?.nation_id) return res.status(403).json({ error: 'Forbidden' });
    const filePath = path.join(UPLOAD_DIR, doc.filename);
    res.download(filePath, doc.original_name);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/documents/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await pool.query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    const { rows: [doc] } = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.nation_id !== user?.nation_id) return res.status(403).json({ error: 'Forbidden' });
    const filePath = path.join(UPLOAD_DIR, doc.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM documents WHERE id = $1', [doc.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
