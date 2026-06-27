const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const { query } = require('../db');
const { requireAuth } = require('./auth');

// Supabase client for storage
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET = 'nation-documents';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.txt', '.xlsx', '.csv'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// GET /api/documents
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    if (!user?.nation_id) return res.json([]);
    const { rows } = await query(
      'SELECT * FROM documents WHERE nation_id = $1 ORDER BY created_at DESC',
      [user.nation_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/documents
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { rows: [user] } = await query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    if (!user?.nation_id) return res.status(403).json({ error: 'No nation assigned' });
    if (!req.file) return res.status(400).json({ error: 'No file or unsupported format (PDF, Word, Excel, image, TXT)' });

    const ext = '.' + req.file.originalname.split('.').pop().toLowerCase();
    const storagePath = `${user.nation_id}/${uuidv4()}${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    const id = uuidv4();
    await query(
      'INSERT INTO documents (id, nation_id, uploaded_by, filename, original_name, mimetype, size) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, user.nation_id, req.session.userId, storagePath, req.file.originalname, req.file.mimetype, req.file.size]
    );

    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/documents/:id/download
router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    const { rows: [doc] } = await query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.nation_id !== user?.nation_id) return res.status(403).json({ error: 'Forbidden' });

    // Generate signed URL (valid 60 seconds)
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.filename, 60);

    if (error) throw new Error(error.message);

    res.redirect(data.signedUrl);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/documents/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows: [user] } = await query('SELECT nation_id FROM users WHERE id = $1', [req.session.userId]);
    const { rows: [doc] } = await query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if (doc.nation_id !== user?.nation_id) return res.status(403).json({ error: 'Forbidden' });

    // Delete from Supabase Storage
    await supabase.storage.from(BUCKET).remove([doc.filename]);
    await query('DELETE FROM documents WHERE id = $1', [doc.id]);

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
