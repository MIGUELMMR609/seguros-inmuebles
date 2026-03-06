const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');
const { uploadFotos } = require('../middleware/upload');

const router = express.Router();
router.use(verificarToken);

// GET /api/siniestros
router.get('/', async (req, res) => {
  try {
    const { poliza_id, estado } = req.query;
    let consulta = `
      SELECT s.*, p.numero_poliza, p.tipo AS tipo_poliza,
             p.inmueble_id, i.nombre AS nombre_inmueble
      FROM siniestros s
      LEFT JOIN polizas p ON s.poliza_id = p.id
      LEFT JOIN inmuebles i ON p.inmueble_id = i.id
      WHERE 1=1
    `;
    const parametros = [];

    if (poliza_id) {
      parametros.push(poliza_id);
      consulta += ` AND s.poliza_id = $${parametros.length}`;
    }

    if (estado) {
      parametros.push(estado);
      consulta += ` AND s.estado = $${parametros.length}`;
    }

    consulta += ' ORDER BY s.created_at DESC';

    const resultado = await pool.query(consulta, parametros);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener siniestros:', error);
    res.status(500).json({ error: 'Error al obtener los siniestros' });
  }
});

// GET /api/siniestros/:id
router.get('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT s.*, p.numero_poliza, p.tipo AS tipo_poliza,
              p.inmueble_id, i.nombre AS nombre_inmueble
       FROM siniestros s
       LEFT JOIN polizas p ON s.poliza_id = p.id
       LEFT JOIN inmuebles i ON p.inmueble_id = i.id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Siniestro no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener siniestro:', error);
    res.status(500).json({ error: 'Error al obtener el siniestro' });
  }
});

// POST /api/siniestros
router.post('/', async (req, res) => {
  try {
    const { poliza_id, fecha_apertura, motivo, numero_siniestro, persona_contacto,
            compania_aseguradora, contacto_nombre, contacto_telefono, contacto_email, notas } = req.body;

    if (!poliza_id) {
      return res.status(400).json({ error: 'La póliza es requerida' });
    }

    const resultado = await pool.query(
      `INSERT INTO siniestros (poliza_id, fecha_apertura, motivo, numero_siniestro, persona_contacto,
                               compania_aseguradora, contacto_nombre, contacto_telefono, contacto_email, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        poliza_id,
        fecha_apertura || new Date().toISOString().split('T')[0],
        motivo || null,
        numero_siniestro || null,
        persona_contacto || null,
        compania_aseguradora || null,
        contacto_nombre || null,
        contacto_telefono || null,
        contacto_email || null,
        notas || null,
      ]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al crear siniestro:', error);
    res.status(500).json({ error: 'Error al crear el siniestro' });
  }
});

// PUT /api/siniestros/:id
router.put('/:id', async (req, res) => {
  try {
    const { fecha_apertura, motivo, numero_siniestro, persona_contacto,
            compania_aseguradora, contacto_nombre, contacto_telefono, contacto_email, notas } = req.body;

    const resultado = await pool.query(
      `UPDATE siniestros
       SET fecha_apertura=$1, motivo=$2, numero_siniestro=$3, persona_contacto=$4,
           compania_aseguradora=$5, contacto_nombre=$6, contacto_telefono=$7, contacto_email=$8,
           notas=$9, updated_at=NOW()
       WHERE id=$10
       RETURNING *`,
      [
        fecha_apertura || null,
        motivo || null,
        numero_siniestro || null,
        persona_contacto || null,
        compania_aseguradora || null,
        contacto_nombre || null,
        contacto_telefono || null,
        contacto_email || null,
        notas || null,
        req.params.id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Siniestro no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al actualizar siniestro:', error);
    res.status(500).json({ error: 'Error al actualizar el siniestro' });
  }
});

// DELETE /api/siniestros/:id
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM siniestros WHERE id=$1 RETURNING id',
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Siniestro no encontrado' });
    }

    res.json({ mensaje: 'Siniestro eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar siniestro:', error);
    res.status(500).json({ error: 'Error al eliminar el siniestro' });
  }
});

// PUT /api/siniestros/:id/cerrar
router.put('/:id/cerrar', async (req, res) => {
  try {
    const resultado = await pool.query(
      `UPDATE siniestros
       SET estado='cerrado', fecha_cierre=CURRENT_DATE, updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Siniestro no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al cerrar siniestro:', error);
    res.status(500).json({ error: 'Error al cerrar el siniestro' });
  }
});

// PUT /api/siniestros/:id/reabrir
router.put('/:id/reabrir', async (req, res) => {
  try {
    const resultado = await pool.query(
      `UPDATE siniestros
       SET estado='abierto', fecha_cierre=NULL, updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Siniestro no encontrado' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al reabrir siniestro:', error);
    res.status(500).json({ error: 'Error al reabrir el siniestro' });
  }
});

// POST /api/siniestros/:id/llamadas - Añadir una llamada al registro
router.post('/:id/llamadas', async (req, res) => {
  try {
    const { fecha, descripcion, resultado: resultadoLlamada } = req.body;

    const siniestro = await pool.query(
      'SELECT llamadas FROM siniestros WHERE id=$1',
      [req.params.id]
    );

    if (siniestro.rows.length === 0) {
      return res.status(404).json({ error: 'Siniestro no encontrado' });
    }

    const llamadasActuales = siniestro.rows[0].llamadas || [];
    const nuevaLlamada = {
      fecha: fecha || new Date().toISOString().split('T')[0],
      descripcion: descripcion || '',
      resultado: resultadoLlamada || '',
    };

    const resultado = await pool.query(
      `UPDATE siniestros
       SET llamadas=$1, updated_at=NOW()
       WHERE id=$2
       RETURNING *`,
      [JSON.stringify([...llamadasActuales, nuevaLlamada]), req.params.id]
    );

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al añadir llamada:', error);
    res.status(500).json({ error: 'Error al añadir la llamada' });
  }
});

// DELETE /api/siniestros/:id/llamadas/:indice - Eliminar una llamada
router.delete('/:id/llamadas/:indice', async (req, res) => {
  try {
    const siniestro = await pool.query(
      'SELECT llamadas FROM siniestros WHERE id=$1',
      [req.params.id]
    );

    if (siniestro.rows.length === 0) {
      return res.status(404).json({ error: 'Siniestro no encontrado' });
    }

    const llamadas = [...(siniestro.rows[0].llamadas || [])];
    llamadas.splice(parseInt(req.params.indice), 1);

    const resultado = await pool.query(
      'UPDATE siniestros SET llamadas=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [JSON.stringify(llamadas), req.params.id]
    );

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al eliminar llamada:', error);
    res.status(500).json({ error: 'Error al eliminar la llamada' });
  }
});

// POST /api/siniestros/:id/fotos - Subir fotos
router.post('/:id/fotos', uploadFotos.array('fotos', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron fotos' });
    }

    const siniestro = await pool.query(
      'SELECT fotos FROM siniestros WHERE id=$1',
      [req.params.id]
    );

    if (siniestro.rows.length === 0) {
      return res.status(404).json({ error: 'Siniestro no encontrado' });
    }

    const fotosActuales = siniestro.rows[0].fotos || [];
    const nuevasFotos = req.files.map((f) => f.path);

    const resultado = await pool.query(
      'UPDATE siniestros SET fotos=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [JSON.stringify([...fotosActuales, ...nuevasFotos]), req.params.id]
    );

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al subir fotos:', error);
    res.status(500).json({ error: 'Error al subir las fotos' });
  }
});

// DELETE /api/siniestros/:id/fotos/:indice - Eliminar una foto
router.delete('/:id/fotos/:indice', async (req, res) => {
  try {
    const siniestro = await pool.query(
      'SELECT fotos FROM siniestros WHERE id=$1',
      [req.params.id]
    );

    if (siniestro.rows.length === 0) {
      return res.status(404).json({ error: 'Siniestro no encontrado' });
    }

    const fotos = [...(siniestro.rows[0].fotos || [])];
    fotos.splice(parseInt(req.params.indice), 1);

    const resultado = await pool.query(
      'UPDATE siniestros SET fotos=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [JSON.stringify(fotos), req.params.id]
    );

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al eliminar foto:', error);
    res.status(500).json({ error: 'Error al eliminar la foto' });
  }
});

module.exports = router;
