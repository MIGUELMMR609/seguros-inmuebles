const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// GET /api/registro-emails - Lista de emails enviados con filtros
router.get('/', async (req, res) => {
  try {
    const { tipo, destinatario_tipo, estado, fecha_desde, fecha_hasta } = req.query;

    const condiciones = ['1=1'];
    const valores = [];
    let indice = 1;

    if (tipo) {
      condiciones.push(`re.tipo = $${indice++}`);
      valores.push(tipo);
    }
    if (destinatario_tipo) {
      condiciones.push(`re.destinatario_tipo = $${indice++}`);
      valores.push(destinatario_tipo);
    }
    if (estado) {
      condiciones.push(`re.estado = $${indice++}`);
      valores.push(estado);
    }
    if (fecha_desde) {
      condiciones.push(`re.fecha_envio >= $${indice++}`);
      valores.push(fecha_desde);
    }
    if (fecha_hasta) {
      condiciones.push(`re.fecha_envio < ($${indice++}::date + interval '1 day')`);
      valores.push(fecha_hasta);
    }

    const resultado = await pool.query(
      `SELECT
         re.id,
         re.tipo,
         re.destinatario_email,
         re.destinatario_tipo,
         re.estado,
         re.fecha_envio,
         re.mensaje_error,
         re.poliza_id,
         re.inquilino_id,
         inq.nombre AS nombre_inquilino
       FROM registro_emails re
       LEFT JOIN inquilinos inq ON inq.id = re.inquilino_id
       WHERE ${condiciones.join(' AND ')}
       ORDER BY re.fecha_envio DESC
       LIMIT 200`,
      valores
    );

    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener registro de emails:', error);
    res.status(500).json({ error: 'Error al obtener el registro de emails' });
  }
});

module.exports = router;
