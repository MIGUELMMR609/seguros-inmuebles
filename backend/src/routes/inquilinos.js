const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// GET /api/inquilinos
// ?historico=true → devuelve finalizados; por defecto → activos
router.get('/', async (req, res) => {
  try {
    const { inmueble_id, historico } = req.query;
    const estadoFiltro = historico === 'true' ? 'finalizado' : 'activo';

    let consulta = `
      SELECT inq.*, i.nombre AS nombre_inmueble, i.direccion AS direccion_inmueble
      FROM inquilinos inq
      LEFT JOIN inmuebles i ON inq.inmueble_id = i.id
      WHERE (inq.estado = $1 OR (inq.estado IS NULL AND $1 = 'activo'))
    `;
    const parametros = [estadoFiltro];

    if (inmueble_id) {
      parametros.push(inmueble_id);
      consulta += ` AND inq.inmueble_id = $${parametros.length}`;
    }

    consulta += ' ORDER BY inq.nombre ASC';

    const resultado = await pool.query(consulta, parametros);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener inquilinos:', error);
    res.status(500).json({ error: 'Error al obtener los inquilinos' });
  }
});

// GET /api/inquilinos/:id
router.get('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT inq.*, i.nombre AS nombre_inmueble, i.direccion AS direccion_inmueble
       FROM inquilinos inq
       LEFT JOIN inmuebles i ON inq.inmueble_id = i.id
       WHERE inq.id = $1`,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener inquilino:', error);
    res.status(500).json({ error: 'Error al obtener el inquilino' });
  }
});

// POST /api/inquilinos
router.post('/', async (req, res) => {
  try {
    const {
      inmueble_id, nombre, email, telefono,
      fecha_inicio_contrato, fecha_fin_contrato,
      importe_renta, documento_url, observaciones_ia, notas,
    } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del inquilino es requerido' });
    }

    const resultado = await pool.query(
      `INSERT INTO inquilinos
        (inmueble_id, nombre, email, telefono, fecha_inicio_contrato, fecha_fin_contrato,
         importe_renta, documento_url, observaciones_ia, notas, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'activo')
       RETURNING *`,
      [
        inmueble_id || null,
        nombre.trim(),
        email || null,
        telefono || null,
        fecha_inicio_contrato || null,
        fecha_fin_contrato || null,
        importe_renta || null,
        documento_url || null,
        observaciones_ia || null,
        notas || null,
      ]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al crear inquilino:', error);
    res.status(500).json({ error: 'Error al crear el inquilino' });
  }
});

// PUT /api/inquilinos/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      inmueble_id, nombre, email, telefono,
      fecha_inicio_contrato, fecha_fin_contrato,
      importe_renta, documento_url, observaciones_ia, notas,
    } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del inquilino es requerido' });
    }

    const resultado = await pool.query(
      `UPDATE inquilinos
       SET inmueble_id = $1, nombre = $2, email = $3, telefono = $4,
           fecha_inicio_contrato = $5, fecha_fin_contrato = $6,
           importe_renta = $7, documento_url = $8, observaciones_ia = $9, notas = $10
       WHERE id = $11
       RETURNING *`,
      [
        inmueble_id || null,
        nombre.trim(),
        email || null,
        telefono || null,
        fecha_inicio_contrato || null,
        fecha_fin_contrato || null,
        importe_renta || null,
        documento_url || null,
        observaciones_ia || null,
        notas || null,
        req.params.id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al actualizar inquilino:', error);
    res.status(500).json({ error: 'Error al actualizar el inquilino' });
  }
});

// PUT /api/inquilinos/:id/finalizar
router.put('/:id/finalizar', async (req, res) => {
  try {
    const { motivo } = req.body;

    const resultado = await pool.query(
      `UPDATE inquilinos
       SET estado = 'finalizado', fecha_finalizacion = CURRENT_DATE, motivo_finalizacion = $1
       WHERE id = $2
       RETURNING *`,
      [motivo || null, req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al finalizar contrato:', error);
    res.status(500).json({ error: 'Error al finalizar el contrato' });
  }
});

// PUT /api/inquilinos/:id/reactivar
router.put('/:id/reactivar', async (req, res) => {
  try {
    const resultado = await pool.query(
      `UPDATE inquilinos
       SET estado = 'activo', fecha_finalizacion = NULL, motivo_finalizacion = NULL
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al reactivar inquilino:', error);
    res.status(500).json({ error: 'Error al reactivar el inquilino' });
  }
});

// POST /api/inquilinos/:id/renovar
router.post('/:id/renovar', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, importe, notas } = req.body;
    const inquilinoId = req.params.id;

    // Insertar en historial de renovaciones
    await pool.query(
      `INSERT INTO contrato_renovaciones (inquilino_id, fecha_inicio, fecha_fin, importe, notas)
       VALUES ($1, $2, $3, $4, $5)`,
      [inquilinoId, fecha_inicio || null, fecha_fin || null, importe || null, notas || null]
    );

    // Actualizar inquilino con nuevas fechas e importe
    const resultado = await pool.query(
      `UPDATE inquilinos
       SET fecha_inicio_contrato = COALESCE($1, fecha_inicio_contrato),
           fecha_fin_contrato = COALESCE($2, fecha_fin_contrato),
           importe_renta = COALESCE($3, importe_renta)
       WHERE id = $4
       RETURNING *`,
      [fecha_inicio || null, fecha_fin || null, importe || null, inquilinoId]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    res.json({ inquilino: resultado.rows[0], mensaje: 'Contrato renovado correctamente' });
  } catch (error) {
    console.error('Error al renovar contrato:', error);
    res.status(500).json({ error: 'Error al renovar el contrato' });
  }
});

// GET /api/inquilinos/:id/renovaciones
router.get('/:id/renovaciones', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT * FROM contrato_renovaciones WHERE inquilino_id = $1 ORDER BY fecha_renovacion DESC`,
      [req.params.id]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener renovaciones:', error);
    res.status(500).json({ error: 'Error al obtener el historial de renovaciones' });
  }
});

// DELETE /api/inquilinos/:id
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM inquilinos WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    res.json({ mensaje: 'Inquilino eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar inquilino:', error);
    res.status(500).json({ error: 'Error al eliminar el inquilino' });
  }
});

module.exports = router;
