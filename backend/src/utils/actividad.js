const { pool } = require('../config/database');

async function registrarActividad(usuarioId, usuarioEmail, accion, entidad, entidadId, detalle, ip) {
  try {
    await pool.query(
      `INSERT INTO registro_actividad (usuario_id, usuario_email, accion, entidad, entidad_id, detalle, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [usuarioId || null, usuarioEmail || null, accion, entidad || null, entidadId || null, detalle || null, ip || null]
    );
  } catch (err) {
    console.warn('No se pudo registrar actividad:', err.message);
  }
}

module.exports = { registrarActividad };
