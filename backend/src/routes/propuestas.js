const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// GET /api/propuestas — listar todas las propuestas
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT pp.*,
             inq.nombre AS nombre_inquilino,
             i.nombre AS nombre_inmueble
      FROM propuestas_polizas pp
      LEFT JOIN inquilinos inq ON pp.inquilino_id = inq.id
      LEFT JOIN polizas p ON pp.poliza_inmueble_id = p.id
      LEFT JOIN inmuebles i ON p.inmueble_id = i.id
      ORDER BY pp.created_at DESC
    `);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener propuestas:', error);
    res.status(500).json({ error: 'Error al obtener las propuestas' });
  }
});

// POST /api/propuestas — crear propuesta
router.post('/', async (req, res) => {
  try {
    const { inquilino_id, poliza_inmueble_id, datos_inmueble, informe, poliza_inmueble_info } = req.body;

    if (!informe) {
      return res.status(400).json({ error: 'El informe es requerido' });
    }

    const resultado = await pool.query(
      `INSERT INTO propuestas_polizas (inquilino_id, poliza_inmueble_id, datos_inmueble, informe, poliza_inmueble_info)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        inquilino_id || null,
        poliza_inmueble_id || null,
        datos_inmueble ? JSON.stringify(datos_inmueble) : null,
        JSON.stringify(informe),
        poliza_inmueble_info ? JSON.stringify(poliza_inmueble_info) : null,
      ]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al crear propuesta:', error);
    res.status(500).json({ error: 'Error al crear la propuesta' });
  }
});

// DELETE /api/propuestas/:id — eliminar propuesta
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM propuestas_polizas WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Propuesta no encontrada' });
    }

    res.json({ mensaje: 'Propuesta eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar propuesta:', error);
    res.status(500).json({ error: 'Error al eliminar la propuesta' });
  }
});

module.exports = router;
