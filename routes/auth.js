const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db'); // Conexión central a Supabase

// Middleware para verificar si el usuario es Administrador
function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de administrador.' });
}

// Middleware para verificar si el usuario está autenticado (Micronación o Admin)
function requireUser(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Sesión no iniciada o expirada.' });
}

// Función para crear el administrador inicial en Supabase al arrancar el servidor
async function seedAdmin() {
  try {
    const res = await pool.query('SELECT * FROM users WHERE email = $1', ['mainosalvi@gmail.com']);
    
    if (res.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('salvi3141', 10);
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

// Ruta de inicio de sesión (Login)
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

    let nation = null;
    if (user.nation_id) {
      const nationRes = await pool.query('SELECT * FROM nations WHERE id = $1', [user.nation_id]);
      if (nationRes.rows.length > 0) {
        nation = nationRes.rows[0];
        
        // El formateo problemático se removió de acá porque ahora lo hace de forma
        // transparente y centralizada el interceptor de db.js antes de enviar la fila.
      }
    }

    res.json({ 
      success: true, 
      user: { 
        id: user.id,
        name: user.name,
        email: user.email, 
        role: user.role,
        nation_id: user.nation_id,
        nation: nation
      } 
    });
  } catch (err) {
    console.error('Error en ruta login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = { 
  router, 
  seedAdmin, 
  requireAdmin, 
  requireUser 
};
