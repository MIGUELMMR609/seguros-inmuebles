const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

const TIPOS_VALIDOS = ['vivienda', 'nave', 'local', 'inquilino_resp_civil', 'activ_economica', 'comunidad', 'otros'];

// GET /api/polizas
router.get('/', async (req, res) => {
  try {
    const { inmueble_id, tipo } = req.query;
    let consulta = `
      SELECT p.*, i.nombre AS nombre_inmueble, i.direccion AS direccion_inmueble
      FROM polizas p
      LEFT JOIN inmuebles i ON p.inmueble_id = i.id
      WHERE 1=1
    `;
    const parametros = [];

    if (inmueble_id) {
      parametros.push(inmueble_id);
      consulta += ` AND p.inmueble_id = $${parametros.length}`;
    }

    if (tipo) {
      parametros.push(tipo);
      consulta += ` AND p.tipo = $${parametros.length}`;
    }

    consulta += ' ORDER BY p.fecha_vencimiento ASC';

    const resultado = await pool.query(consulta, parametros);
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener pólizas:', error);
    res.status(500).json({ error: 'Error al obtener las pólizas' });
  }
});

// GET /api/polizas/:id
router.get('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT p.*, i.nombre AS nombre_inmueble, i.direccion AS direccion_inmueble
       FROM polizas p
       LEFT JOIN inmuebles i ON p.inmueble_id = i.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza no encontrada' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al obtener póliza:', error);
    res.status(500).json({ error: 'Error al obtener la póliza' });
  }
});

// POST /api/polizas
router.post('/', async (req, res) => {
  try {
    const {
      inmueble_id, tipo, compania_aseguradora, numero_poliza,
      fecha_inicio, fecha_vencimiento, importe_anual, notas, documento_url,
      contacto_nombre, contacto_telefono, contacto_email,
      periodicidad_pago, importe_pago, fecha_proximo_pago,
    } = req.body;

    if (!inmueble_id) {
      return res.status(400).json({ error: 'El inmueble es requerido' });
    }

    const tipoFinal = TIPOS_VALIDOS.includes(tipo) ? tipo : 'vivienda';

    const resultado = await pool.query(
      `INSERT INTO polizas
        (inmueble_id, tipo, compania_aseguradora, numero_poliza, fecha_inicio, fecha_vencimiento,
         importe_anual, notas, documento_url, contacto_nombre, contacto_telefono, contacto_email,
         periodicidad_pago, importe_pago, fecha_proximo_pago)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        inmueble_id, tipoFinal, compania_aseguradora || null, numero_poliza || null,
        fecha_inicio || null, fecha_vencimiento || null, importe_anual || null,
        notas || null, documento_url || null, contacto_nombre || null,
        contacto_telefono || null, contacto_email || null,
        periodicidad_pago || 'anual', importe_pago || null, fecha_proximo_pago || null,
      ]
    );

    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al crear póliza:', error);
    res.status(500).json({ error: 'Error al crear la póliza' });
  }
});

// PUT /api/polizas/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      inmueble_id, tipo, compania_aseguradora, numero_poliza,
      fecha_inicio, fecha_vencimiento, importe_anual, notas, documento_url,
      contacto_nombre, contacto_telefono, contacto_email,
      periodicidad_pago, importe_pago, fecha_proximo_pago,
    } = req.body;

    const tipoFinal = TIPOS_VALIDOS.includes(tipo) ? tipo : 'vivienda';

    const resultado = await pool.query(
      `UPDATE polizas
       SET inmueble_id=$1, tipo=$2, compania_aseguradora=$3, numero_poliza=$4,
           fecha_inicio=$5, fecha_vencimiento=$6, importe_anual=$7, notas=$8,
           documento_url=$9, contacto_nombre=$10, contacto_telefono=$11, contacto_email=$12,
           periodicidad_pago=$13, importe_pago=$14, fecha_proximo_pago=$15, updated_at=NOW()
       WHERE id=$16
       RETURNING *`,
      [
        inmueble_id, tipoFinal, compania_aseguradora || null, numero_poliza || null,
        fecha_inicio || null, fecha_vencimiento || null, importe_anual || null,
        notas || null, documento_url || null, contacto_nombre || null,
        contacto_telefono || null, contacto_email || null,
        periodicidad_pago || 'anual', importe_pago || null, fecha_proximo_pago || null,
        req.params.id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza no encontrada' });
    }

    res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al actualizar póliza:', error);
    res.status(500).json({ error: 'Error al actualizar la póliza' });
  }
});

// DELETE /api/polizas/:id
router.delete('/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM polizas WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza no encontrada' });
    }

    res.json({ mensaje: 'Póliza eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar póliza:', error);
    res.status(500).json({ error: 'Error al eliminar la póliza' });
  }
});

// GET /api/polizas/:id/coberturas - Extraer coberturas del PDF de la póliza con IA
router.get('/:id/coberturas', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT documento_url FROM polizas WHERE id = $1', [req.params.id]);
    if (resultado.rows.length === 0) return res.status(404).json({ error: 'Póliza no encontrada' });

    const { documento_url } = resultado.rows[0];

    if (!documento_url) {
      return res.json({ tiene_documento: false, coberturas: [] });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'API de IA no configurada' });
    }

    const nombreArchivo = path.basename(documento_url);
    const rutaArchivo = path.join(__dirname, '../../uploads', nombreArchivo);

    if (!fs.existsSync(rutaArchivo)) {
      return res.json({ tiene_documento: true, archivo_disponible: false, coberturas: [] });
    }

    const base64 = fs.readFileSync(rutaArchivo).toString('base64');

    const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64 },
            },
            {
              type: 'text',
              text: `Analiza este documento de póliza de seguro y extrae todas las coberturas incluidas.
Devuelve ÚNICAMENTE un array JSON válido con los nombres de las coberturas, por ejemplo:
["Incendio y explosión", "Daños por agua", "Robo y expoliación", "Responsabilidad civil", "Rotura de cristales"]
Solo nombres de coberturas, sin importes ni límites. Si no encuentras coberturas claramente definidas, devuelve [].`,
            },
          ],
        }],
      }),
    });

    if (!respuesta.ok) {
      console.error('Error API IA coberturas:', await respuesta.text());
      return res.status(502).json({ error: 'Error al comunicarse con la IA' });
    }

    const iaResult = await respuesta.json();
    const texto = iaResult.content?.[0]?.text || '[]';

    let coberturas;
    try {
      coberturas = JSON.parse(texto);
    } catch {
      const match = texto.match(/\[[\s\S]*\]/);
      coberturas = match ? JSON.parse(match[0]) : [];
    }

    if (!Array.isArray(coberturas)) coberturas = [];

    res.json({ tiene_documento: true, archivo_disponible: true, coberturas });
  } catch (error) {
    console.error('Error al obtener coberturas:', error);
    res.status(500).json({ error: 'Error al analizar coberturas' });
  }
});

module.exports = router;
