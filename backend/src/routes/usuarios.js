const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { verificarToken, soloAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);
router.use(soloAdmin);

// GET /api/usuarios
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, email, rol, created_at FROM usuarios ORDER BY nombre ASC'
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener los usuarios' });
  }
});

// POST /api/usuarios
router.post('/', async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const rolesValidos = ['admin', 'usuario'];
    if (rol && !rolesValidos.includes(rol)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }

    const emailExistente = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (emailExistente.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const resultado = await pool.query(
      'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, rol, created_at',
      [nombre.trim(), email.toLowerCase().trim(), passwordHash, rol || 'usuario']
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

// PUT /api/usuarios/:id
router.put('/:id', async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    if (!nombre || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }

    // Verificar email único (excluyendo el propio usuario)
    const emailExistente = await pool.query(
      'SELECT id FROM usuarios WHERE email = $1 AND id != $2',
      [email.toLowerCase().trim(), req.params.id]
    );

    if (emailExistente.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    let consulta;
    let parametros;

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      consulta = `
        UPDATE usuarios
        SET nombre = $1, email = $2, password = $3, rol = $4
        WHERE id = $5
        RETURNING id, nombre, email, rol, created_at
      `;
      parametros = [nombre.trim(), email.toLowerCase().trim(), passwordHash, rol || 'usuario', req.params.id];
    } else {
      consulta = `
        UPDATE usuarios
        SET nombre = $1, email = $2, rol = $3
        WHERE id = $4
        RETURNING id, nombre, email, rol, created_at
      `;
      parametros = [nombre.trim(), email.toLowerCase().trim(), rol || 'usuario', req.params.id];
    }

    const resultado = await pool.query(consulta, parametros);

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

// DELETE /api/usuarios/:id
router.delete('/:id', async (req, res) => {
  try {
    // Evitar que el admin se elimine a sí mismo
    if (parseInt(req.params.id) === req.usuario.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }

    const resultado = await pool.query(
      'DELETE FROM usuarios WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ mensaje: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error al eliminar el usuario' });
  }
});

module.exports = router;
