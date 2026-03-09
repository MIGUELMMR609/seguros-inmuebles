const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');
const { registrarActividad } = require('../utils/actividad');

const router = express.Router();
router.use(verificarToken);

// GET /api/inmuebles
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT i.*,
              COUNT(p.id)::int AS total_polizas
       FROM inmuebles i
       LEFT JOIN polizas p ON p.inmueble_id = i.id
       GROUP BY i.id
       ORDER BY i.nombre ASC`
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener inmuebles:', error);
    res.status(500).json({ error: 'Error al obtener los inmuebles' });
  }
});

// GET /api/inmuebles/:id
router.get('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT i.*, COUNT(p.id)::int AS total_polizas
       FROM inmuebles i
       LEFT JOIN polizas p ON p.inmueble_id = i.id
       WHERE i.id = $1
       GROUP BY i.id`,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Inmueble no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener inmueble:', error);
    res.status(500).json({ error: 'Error al obtener el inmueble' });
  }
});

// POST /api/inmuebles
router.post('/', async (req, res) => {
  try {
    const { nombre, direccion, tipo, notas } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del inmueble es requerido' });
    }

    const tiposValidos = ['piso', 'nave', 'local', 'garaje'];
    const tipoFinal = tiposValidos.includes(tipo) ? tipo : 'piso';

    const resultado = await pool.query(
      'INSERT INTO inmuebles (nombre, direccion, tipo, notas) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre.trim(), direccion || null, tipoFinal, notas || null]
    );

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    registrarActividad(req.usuario.id, req.usuario.email, 'crear', 'inmueble', resultado.rows[0].id, nombre.trim(), ip);
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al crear inmueble:', error);
    res.status(500).json({ error: 'Error al crear el inmueble' });
  }
});

// PUT /api/inmuebles/:id
router.put('/:id', async (req, res) => {
  try {
    const { nombre, direccion, tipo, notas } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del inmueble es requerido' });
    }

    const tiposValidos = ['piso', 'nave', 'local', 'garaje'];
    const tipoFinal = tiposValidos.includes(tipo) ? tipo : 'piso';

    const resultado = await pool.query(
      `UPDATE inmuebles
       SET nombre = $1, direccion = $2, tipo = $3, notas = $4
       WHERE id = $5 RETURNING *`,
      [nombre.trim(), direccion || null, tipoFinal, notas || null, req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Inmueble no encontrado' });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    registrarActividad(req.usuario.id, req.usuario.email, 'editar', 'inmueble', parseInt(req.params.id), nombre.trim(), ip);
    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al actualizar inmueble:', error);
    res.status(500).json({ error: 'Error al actualizar el inmueble' });
  }
});

// DELETE /api/inmuebles/:id
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM inmuebles WHERE id = $1 RETURNING id, nombre',
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Inmueble no encontrado' });
    }

    const { id: inmuebleId, nombre } = resultado.rows[0];
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    registrarActividad(req.usuario.id, req.usuario.email, 'eliminar', 'inmueble', inmuebleId, nombre, ip);

    res.json({ mensaje: 'Inmueble eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar inmueble:', error);
    res.status(500).json({ error: 'Error al eliminar el inmueble' });
  }
});

module.exports = router;
