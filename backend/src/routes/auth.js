const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');
const { registrarActividad } = require('../utils/actividad');

const router = express.Router();

// Rate limiting simple para login (en memoria)
const intentosLogin = new Map();
const MAX_INTENTOS = 10;
const VENTANA_MS = 15 * 60 * 1000; // 15 minutos

function limpiarIntentosExpirados() {
  const ahora = Date.now();
  for (const [ip, datos] of intentosLogin) {
    if (ahora - datos.inicio > VENTANA_MS) intentosLogin.delete(ip);
  }
}
setInterval(limpiarIntentosExpirados, 60_000);

// POST /api/auth/login
router.post('/login', (req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const ahora = Date.now();
  const datos = intentosLogin.get(ip);
  if (datos && ahora - datos.inicio < VENTANA_MS && datos.intentos >= MAX_INTENTOS) {
    return res.status(429).json({ error: 'Demasiados intentos de login. Espera 15 minutos.' });
  }
  next();
}, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    const resultado = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const usuario = resultado.rows[0];
    const passwordValida = await bcrypt.compare(password, usuario.password);

    if (!passwordValida) {
      // Registrar intento fallido para rate limiting
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
      const datos = intentosLogin.get(ip) || { intentos: 0, inicio: Date.now() };
      datos.intentos++;
      intentosLogin.set(ip, datos);
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, rol: usuario.rol, nombre: usuario.nombre },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    registrarActividad(usuario.id, usuario.email, 'login', 'usuarios', usuario.id, `Login desde ${req.headers['user-agent']?.slice(0, 100) || 'desconocido'}`, ip);

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// POST /api/auth/logout
router.post('/logout', verificarToken, (req, res) => {
  res.json({ mensaje: 'Sesión cerrada correctamente' });
});

// GET /api/auth/yo (obtener usuario actual)
router.get('/yo', verificarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, email, rol, created_at FROM usuarios WHERE id = $1',
      [req.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error al obtener datos del usuario' });
  }
});

module.exports = router;
