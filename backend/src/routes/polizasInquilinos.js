const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// GET /api/polizas-inquilinos
router.get('/', async (req, res) => {
  try {
    const { inquilino_id } = req.query;
    let consulta = `
      SELECT pi.*, inq.nombre AS nombre_inquilino, inq.email AS email_inquilino,
             i.nombre AS nombre_inmueble
      FROM polizas_inquilinos pi
      LEFT JOIN inquilinos inq ON pi.inquilino_id = inq.id
      LEFT JOIN inmuebles i ON inq.inmueble_id = i.id
      WHERE 1=1
    `;
    const parametros = [];

    if (inquilino_id) {
      parametros.push(inquilino_id);
      consulta += ` AND pi.inquilino_id = $${parametros.length}`;
    }

    consulta += ' ORDER BY pi.fecha_vencimiento ASC';

    const resultado = await pool.query(consulta, parametros);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener pólizas de inquilinos:', error);
    res.status(500).json({ error: 'Error al obtener las pólizas de inquilinos' });
  }
});

// GET /api/polizas-inquilinos/:id
router.get('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT pi.*, inq.nombre AS nombre_inquilino, inq.email AS email_inquilino,
              i.nombre AS nombre_inmueble
       FROM polizas_inquilinos pi
       LEFT JOIN inquilinos inq ON pi.inquilino_id = inq.id
       LEFT JOIN inmuebles i ON inq.inmueble_id = i.id
       WHERE pi.id = $1`,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza de inquilino no encontrada' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener póliza de inquilino:', error);
    res.status(500).json({ error: 'Error al obtener la póliza de inquilino' });
  }
});

// POST /api/polizas-inquilinos
router.post('/', async (req, res) => {
  try {
    const {
      inquilino_id,
      compania_aseguradora,
      numero_poliza,
      fecha_inicio,
      fecha_vencimiento,
      importe_anual,
      notas,
      documento_url,
    } = req.body;

    if (!inquilino_id) {
      return res.status(400).json({ error: 'El inquilino es requerido' });
    }

    const resultado = await pool.query(
      `INSERT INTO polizas_inquilinos
        (inquilino_id, compania_aseguradora, numero_poliza, fecha_inicio, fecha_vencimiento, importe_anual, notas, documento_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        inquilino_id,
        compania_aseguradora || null,
        numero_poliza || null,
        fecha_inicio || null,
        fecha_vencimiento || null,
        importe_anual || null,
        notas || null,
        documento_url || null,
      ]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al crear póliza de inquilino:', error);
    res.status(500).json({ error: 'Error al crear la póliza de inquilino' });
  }
});

// PUT /api/polizas-inquilinos/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      inquilino_id,
      compania_aseguradora,
      numero_poliza,
      fecha_inicio,
      fecha_vencimiento,
      importe_anual,
      notas,
      documento_url,
    } = req.body;

    const resultado = await pool.query(
      `UPDATE polizas_inquilinos
       SET inquilino_id = $1, compania_aseguradora = $2, numero_poliza = $3,
           fecha_inicio = $4, fecha_vencimiento = $5, importe_anual = $6,
           notas = $7, documento_url = $8, updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        inquilino_id,
        compania_aseguradora || null,
        numero_poliza || null,
        fecha_inicio || null,
        fecha_vencimiento || null,
        importe_anual || null,
        notas || null,
        documento_url || null,
        req.params.id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza de inquilino no encontrada' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al actualizar póliza de inquilino:', error);
    res.status(500).json({ error: 'Error al actualizar la póliza de inquilino' });
  }
});

// DELETE /api/polizas-inquilinos/:id
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM polizas_inquilinos WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza de inquilino no encontrada' });
    }

    res.json({ mensaje: 'Póliza de inquilino eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar póliza de inquilino:', error);
    res.status(500).json({ error: 'Error al eliminar la póliza de inquilino' });
  }
});

module.exports = router;
