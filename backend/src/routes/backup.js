const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// Función reutilizable por el cron y el endpoint
async function crearBackup() {
  const [inmuebles, polizas, inquilinos, polizasInquilinos, siniestros, contRenovaciones, historialPolizas, registroEmails, propuestasPolizas] = await Promise.all([
    pool.query('SELECT * FROM inmuebles ORDER BY id'),
    pool.query('SELECT * FROM polizas ORDER BY id'),
    pool.query('SELECT * FROM inquilinos ORDER BY id'),
    pool.query('SELECT * FROM polizas_inquilinos ORDER BY id'),
    pool.query('SELECT * FROM siniestros ORDER BY id'),
    pool.query('SELECT * FROM contrato_renovaciones ORDER BY id'),
    pool.query('SELECT * FROM historial_polizas ORDER BY id'),
    pool.query('SELECT * FROM registro_emails ORDER BY id'),
    pool.query('SELECT * FROM propuestas_polizas ORDER BY id'),
  ]);

  const conteo = {
    inmuebles: inmuebles.rows.length,
    polizas: polizas.rows.length,
    inquilinos: inquilinos.rows.length,
    polizas_inquilinos: polizasInquilinos.rows.length,
    siniestros: siniestros.rows.length,
    renovaciones_contrato: contRenovaciones.rows.length,
    historial_polizas: historialPolizas.rows.length,
    registro_emails: registroEmails.rows.length,
    propuestas_polizas: propuestasPolizas.rows.length,
  };

  const datos = {
    version: '1.0',
    fecha: new Date().toISOString(),
    conteo,
    inmuebles: inmuebles.rows,
    polizas: polizas.rows,
    inquilinos: inquilinos.rows,
    polizas_inquilinos: polizasInquilinos.rows,
    siniestros: siniestros.rows,
    contrato_renovaciones: contRenovaciones.rows,
    historial_polizas: historialPolizas.rows,
    registro_emails: registroEmails.rows,
    propuestas_polizas: propuestasPolizas.rows,
  };

  const json = JSON.stringify(datos, null, 2);
  const tamanyo = Buffer.byteLength(json, 'utf8');
  const fechaStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const nombreArchivo = `backup_${fechaStr}.json`;

  // Guardar en BD
  const res = await pool.query(
    `INSERT INTO backups (nombre_archivo, tamanyo, registros_json, conteo_registros)
     VALUES ($1, $2, $3, $4) RETURNING id, fecha, nombre_archivo, tamanyo, conteo_registros, created_at`,
    [nombreArchivo, tamanyo, json, JSON.stringify(conteo)]
  );

  // Conservar solo los últimos 10 backups
  await pool.query(
    `DELETE FROM backups WHERE id NOT IN (
       SELECT id FROM backups ORDER BY created_at DESC LIMIT 10
     )`
  );

  return { meta: res.rows[0], json, nombreArchivo };
}

// POST /api/backup — Crear backup y descargar inmediatamente
router.post('/', async (req, res) => {
  try {
    const { meta, json, nombreArchivo } = await crearBackup();
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'X-Backup-Id': meta.id,
    });
    res.send(json);
  } catch (error) {
    console.error('Error al crear backup:', error);
    res.status(500).json({ error: 'Error al crear la copia de seguridad' });
  }
});

// GET /api/backup — Listar copias guardadas
router.get('/', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, fecha, nombre_archivo, tamanyo, conteo_registros, created_at
       FROM backups ORDER BY created_at DESC`
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar backups:', error);
    res.status(500).json({ error: 'Error al obtener las copias de seguridad' });
  }
});

// GET /api/backup/:id/download — Descargar copia específica
router.get('/:id/download', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT nombre_archivo, registros_json FROM backups WHERE id = $1',
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Copia de seguridad no encontrada' });
    }
    const { nombre_archivo, registros_json } = resultado.rows[0];
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${nombre_archivo}"`,
    });
    res.send(registros_json);
  } catch (error) {
    console.error('Error al descargar backup:', error);
    res.status(500).json({ error: 'Error al descargar la copia de seguridad' });
  }
});

// DELETE /api/backup/:id — Eliminar copia específica
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM backups WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Copia de seguridad no encontrada' });
    }
    res.json({ mensaje: 'Copia eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar backup:', error);
    res.status(500).json({ error: 'Error al eliminar la copia de seguridad' });
  }
});

module.exports = { router, crearBackup };
