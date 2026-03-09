const express = require('express');
const { pool } = require('../config/database');
const { verificarToken, soloAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);
router.use(soloAdmin);

// GET /api/actividad?pagina=1&limite=50&usuario_id=&accion=&entidad=&desde=&hasta=
router.get('/', async (req, res) => {
  try {
    const { pagina = 1, limite = 50, usuario_id, accion, entidad, desde, hasta } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    const params = [];
    let where = 'WHERE 1=1';
    if (usuario_id) { params.push(usuario_id); where += ` AND ra.usuario_id = $${params.length}`; }
    if (accion) { params.push(accion); where += ` AND ra.accion = $${params.length}`; }
    if (entidad) { params.push(entidad); where += ` AND ra.entidad = $${params.length}`; }
    if (desde) { params.push(desde); where += ` AND ra.fecha >= $${params.length}`; }
    if (hasta) { params.push(hasta + ' 23:59:59'); where += ` AND ra.fecha <= $${params.length}`; }

    const [{ rows }, { rows: total }] = await Promise.all([
      pool.query(
        `SELECT ra.*, u.nombre AS usuario_nombre
         FROM registro_actividad ra
         LEFT JOIN usuarios u ON ra.usuario_id = u.id
         ${where}
         ORDER BY ra.fecha DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limite), offset]
      ),
      pool.query(`SELECT COUNT(*) FROM registro_actividad ra ${where}`, params),
    ]);

    res.json({ registros: rows, total: parseInt(total[0].count), pagina: parseInt(pagina), limite: parseInt(limite) });
  } catch (err) {
    console.error('Error al obtener actividad:', err);
    res.status(500).json({ error: 'Error al obtener el registro de actividad' });
  }
});

// GET /api/actividad/usuarios — lista de usuarios para el filtro
router.get('/usuarios', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nombre, email FROM usuarios ORDER BY nombre');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

module.exports = router;
