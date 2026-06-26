const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db'); // Conexión a Supabase

// Función para crear la tabla y el usuario administrador al iniciar
async function seedAdmin() {
  try {
    // Crear tabla de usuarios si no existe en Supabase
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user'
      );
    `);

    // Verificar si ya existe el administrador
    const res = await pool.query('SELECT * FROM users WHERE email = $1', ['mainosalvi@gmail.com']);
    
    if (res.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('salvi3141', 10);
      await pool.query(
        'INSERT INTO users (email, password, role) VALUES ($1, $2, $3)',
        ['mainosalvi@gmail.com', hashedPassword, 'admin']
      );
      console.log('✅ Usuario administrador creado con éxito en Supabase.');
    }
  } catch (err) {
    console.error('❌ Error en seedAdmin:', err);
  }
}

// Ruta de Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status dream?.(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ success: true, user: { email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = { router, seedAdmin };
