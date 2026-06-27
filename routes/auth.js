const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db'); // Conexión a tu archivo db.js actual

// Función para crear el administrador en Supabase al iniciar
async function seedAdmin() {
  try {
    // Verificar si ya existe el administrador
    const res = await pool.query('SELECT * FROM users WHERE email = $1', ['mainosalvi@gmail.com']);
    
    if (res.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('salvi3141', 10);
      // Generamos un id único de texto ya que tu tabla db.js usa TEXT para el id
      const adminId = 'admin-' + Date.now(); 
      
      await pool.query(
        'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)',
        [adminId, 'Admin Salvi', 'mainosalvi@gmail.com', hashedPassword, 'admin']
      );
      console.log('✅ Usuario administrador creado con éxito en Supabase.');
    }
  } catch (err) {
    console.error('❌ Error en seedAdmin de PostgreSQL:', err.message);
  }
}

// Ruta de Login para producción
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.nationId = user.nation_id;

    res.json({ success: true, user: { email: user.email, role: user.role } });
  } catch (err) {
    console.error('Error en ruta login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = { router, seedAdmin };
