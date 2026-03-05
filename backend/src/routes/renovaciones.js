const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// GET /api/renovaciones/:polizaId - Historial de una póliza
router.get('/:polizaId', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT * FROM historial_polizas
       WHERE poliza_id = $1
       ORDER BY fecha_renovacion DESC`,
      [req.params.polizaId]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener historial de renovaciones:', error);
    res.status(500).json({ error: 'Error al obtener el historial' });
  }
});

// POST /api/renovaciones/:polizaId - Renovar póliza
router.post('/:polizaId', async (req, res) => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const { polizaId } = req.params;
    const {
      nueva_fecha_inicio, nueva_fecha_vencimiento, nuevo_importe, nuevo_importe_pago,
      nueva_fecha_proximo_pago, notas, nueva_compania_aseguradora, nuevo_numero_poliza,
    } = req.body;

    if (!nueva_fecha_vencimiento) {
      return res.status(400).json({ error: 'La nueva fecha de vencimiento es requerida' });
    }

    // Obtener datos actuales de la póliza
    const polizaActual = await cliente.query(
      'SELECT fecha_inicio, fecha_vencimiento, importe_anual FROM polizas WHERE id = $1',
      [polizaId]
    );

    if (polizaActual.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Póliza no encontrada' });
    }

    const { fecha_inicio, fecha_vencimiento, importe_anual } = polizaActual.rows[0];

    // Guardar datos actuales en el historial
    await cliente.query(
      `INSERT INTO historial_polizas (poliza_id, fecha_inicio, fecha_vencimiento, importe, notas)
       VALUES ($1, $2, $3, $4, $5)`,
      [polizaId, fecha_inicio, fecha_vencimiento, importe_anual, notas || null]
    );

    // Actualizar la póliza con los nuevos datos
    const polizaActualizada = await cliente.query(
      `UPDATE polizas
       SET fecha_inicio = $1,
           fecha_vencimiento = $2,
           importe_anual = COALESCE($3, importe_anual),
           importe_pago = COALESCE($4, importe_pago),
           fecha_proximo_pago = COALESCE($5, fecha_proximo_pago),
           compania_aseguradora = COALESCE($7, compania_aseguradora),
           numero_poliza = COALESCE($8, numero_poliza),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        nueva_fecha_inicio || fecha_inicio,
        nueva_fecha_vencimiento,
        nuevo_importe || null,
        nuevo_importe_pago || null,
        nueva_fecha_proximo_pago || null,
        polizaId,
        nueva_compania_aseguradora || null,
        nuevo_numero_poliza || null,
      ]
    );

    await cliente.query('COMMIT');

    res.json({
      mensaje: 'Póliza renovada correctamente',
      poliza: polizaActualizada.rows[0],
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al renovar póliza:', error);
    res.status(500).json({ error: 'Error al renovar la póliza' });
  } finally {
    cliente.release();
  }
});

module.exports = router;
