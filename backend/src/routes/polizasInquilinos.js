const express = require('express');
const fs = require('fs');
const path = require('path');
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
      tipo,
      compania_aseguradora,
      numero_poliza,
      fecha_inicio,
      fecha_vencimiento,
      importe_anual,
      notas,
      documento_url,
      tomador_poliza,
      contacto_nombre,
      contacto_telefono,
      contacto_email,
      riesgos_cubiertos,
      riesgos_no_cubiertos,
      analisis_fortalezas,
      analisis_carencias,
      como_complementar,
    } = req.body;

    if (!inquilino_id) {
      return res.status(400).json({ error: 'El inquilino es requerido' });
    }

    // INSERT base (columnas que siempre existen)
    const resultado = await pool.query(
      `INSERT INTO polizas_inquilinos
        (inquilino_id, compania_aseguradora, numero_poliza, fecha_inicio, fecha_vencimiento, importe_anual, notas, documento_url, tomador_poliza)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
        tomador_poliza || null,
      ]
    );

    const polizaId = resultado.rows[0].id;

    // UPDATE de columnas nuevas (resistente a migraciones pendientes)
    try {
      await pool.query(
        `UPDATE polizas_inquilinos SET
          tipo = $1,
          contacto_nombre = $2,
          contacto_telefono = $3,
          contacto_email = $4,
          riesgos_cubiertos = $5,
          riesgos_no_cubiertos = $6,
          analisis_fortalezas = $7,
          analisis_carencias = $8,
          como_complementar = $9
         WHERE id = $10`,
        [
          tipo || 'hogar',
          contacto_nombre || null,
          contacto_telefono || null,
          contacto_email || null,
          riesgos_cubiertos || null,
          riesgos_no_cubiertos || null,
          analisis_fortalezas || null,
          analisis_carencias || null,
          como_complementar || null,
          polizaId,
        ]
      );
    } catch (errNuevas) {
      console.warn('No se pudieron guardar campos nuevos (migración pendiente):', errNuevas.message);
    }

    const final = await pool.query('SELECT * FROM polizas_inquilinos WHERE id = $1', [polizaId]);
    res.status(201).json(final.rows[0]);
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
      tipo,
      compania_aseguradora,
      numero_poliza,
      fecha_inicio,
      fecha_vencimiento,
      importe_anual,
      notas,
      documento_url,
      tomador_poliza,
      contacto_nombre,
      contacto_telefono,
      contacto_email,
      riesgos_cubiertos,
      riesgos_no_cubiertos,
      analisis_fortalezas,
      analisis_carencias,
      como_complementar,
    } = req.body;

    // UPDATE base
    const resultado = await pool.query(
      `UPDATE polizas_inquilinos
       SET inquilino_id = $1, compania_aseguradora = $2, numero_poliza = $3,
           fecha_inicio = $4, fecha_vencimiento = $5, importe_anual = $6,
           notas = $7, documento_url = $8, tomador_poliza = $9, updated_at = NOW()
       WHERE id = $10
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
        tomador_poliza || null,
        req.params.id,
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza de inquilino no encontrada' });
    }

    // UPDATE columnas nuevas
    try {
      await pool.query(
        `UPDATE polizas_inquilinos SET
          tipo = $1,
          contacto_nombre = $2,
          contacto_telefono = $3,
          contacto_email = $4,
          riesgos_cubiertos = $5,
          riesgos_no_cubiertos = $6,
          analisis_fortalezas = $7,
          analisis_carencias = $8,
          como_complementar = $9
         WHERE id = $10`,
        [
          tipo || 'hogar',
          contacto_nombre || null,
          contacto_telefono || null,
          contacto_email || null,
          riesgos_cubiertos || null,
          riesgos_no_cubiertos || null,
          analisis_fortalezas || null,
          analisis_carencias || null,
          como_complementar || null,
          req.params.id,
        ]
      );
    } catch (errNuevas) {
      console.warn('No se pudieron guardar campos nuevos (migración pendiente):', errNuevas.message);
    }

    const final = await pool.query('SELECT * FROM polizas_inquilinos WHERE id = $1', [req.params.id]);
    res.json(final.rows[0]);
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

// POST /api/polizas-inquilinos/:id/analizar-experto
router.post('/:id/analizar-experto', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'La clave de API de IA no está configurada (ANTHROPIC_API_KEY)' });
  }

  try {
    const resultado = await pool.query(
      `SELECT pi.*, inq.nombre AS nombre_inquilino, i.nombre AS nombre_inmueble
       FROM polizas_inquilinos pi
       LEFT JOIN inquilinos inq ON pi.inquilino_id = inq.id
       LEFT JOIN inmuebles i ON inq.inmueble_id = i.id
       WHERE pi.id = $1`,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza de inquilino no encontrada' });
    }

    const poliza = resultado.rows[0];

    if (!poliza.documento_url) {
      return res.status(400).json({ error: 'Sube el PDF de la póliza primero' });
    }

    let base64;
    try {
      const rutaArchivo = path.join(__dirname, '../../uploads', path.basename(poliza.documento_url));
      if (fs.existsSync(rutaArchivo)) {
        base64 = fs.readFileSync(rutaArchivo).toString('base64');
      } else {
        // Fallback: leer el PDF via HTTP (necesario en Render donde el FS es efímero)
        const urlPdf = poliza.documento_url.startsWith('http')
          ? poliza.documento_url
          : `${req.protocol}://${req.get('host')}${poliza.documento_url}`;
        const resPdf = await fetch(urlPdf);
        if (!resPdf.ok) throw new Error('No accesible');
        const buf = await resPdf.arrayBuffer();
        base64 = Buffer.from(buf).toString('base64');
      }
    } catch {
      return res.status(404).json({ archivo_disponible: false, error: 'PDF no disponible en servidor' });
    }

    const prompt = `Eres un experto en correduría de seguros en España con más de 20 años de experiencia.
Analiza esta póliza de seguro de inquilino/hogar y proporciona un análisis experto completo.

Datos de la póliza:
- Compañía: ${poliza.compania_aseguradora || 'No especificada'}
- Tipo: ${poliza.tipo || 'hogar'}
- Importe anual: ${poliza.importe_anual ? poliza.importe_anual + '€/año' : 'No especificado'}
- Inquilino: ${poliza.nombre_inquilino || 'No especificado'}
- Inmueble: ${poliza.nombre_inmueble || 'No especificado'}

Usa búsqueda web si es necesario para comparar con precios actuales del mercado español de seguros de hogar/inquilino.

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "valoracion": 7.5,
  "riesgos_cubiertos": "descripción detallada de coberturas incluidas",
  "riesgos_no_cubiertos": "descripción de exclusiones y riesgos no cubiertos",
  "analisis_fortalezas": "puntos fuertes y ventajas de esta póliza",
  "analisis_carencias": "aspectos mejorables, carencias o puntos débiles",
  "como_complementar": "recomendaciones para mejorar la cobertura con seguros adicionales o riders",
  "comparador_mercado": {
    "precio_estimado_mercado": "rango de precio típico en el mercado español (ej: 150-300 €/año)",
    "evaluacion_precio": "si el precio es competitivo, caro o económico respecto al mercado",
    "recomendaciones": "recomendaciones específicas de mercado"
  }
}`;

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 115_000);

    const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    clearTimeout(temporizador);

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      console.error(`Error Anthropic analizar-experto-inquilino [${respuesta.status}]:`, cuerpo.slice(0, 300));
      return res.status(502).json({ error: 'Error al comunicarse con la IA. Inténtalo de nuevo.' });
    }

    const resultadoIA = await respuesta.json();
    const textoCompleto = resultadoIA.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let datos;
    try {
      datos = JSON.parse(textoCompleto);
    } catch {
      const m = textoCompleto.match(/\{[\s\S]*\}/);
      if (!m) return res.status(422).json({ error: 'No se pudo extraer el análisis estructurado de la IA' });
      datos = JSON.parse(m[0]);
    }

    // Guardar en BD
    await pool.query(
      `UPDATE polizas_inquilinos SET
        valoracion = $1,
        riesgos_cubiertos = $2,
        riesgos_no_cubiertos = $3,
        analisis_fortalezas = $4,
        analisis_carencias = $5,
        como_complementar = $6,
        comparador_mercado = $7,
        fecha_ultimo_analisis = NOW()
       WHERE id = $8`,
      [
        datos.valoracion || null,
        datos.riesgos_cubiertos || null,
        datos.riesgos_no_cubiertos || null,
        datos.analisis_fortalezas || null,
        datos.analisis_carencias || null,
        datos.como_complementar || null,
        datos.comparador_mercado ? JSON.stringify(datos.comparador_mercado) : null,
        req.params.id,
      ]
    );

    const final = await pool.query('SELECT * FROM polizas_inquilinos WHERE id = $1', [req.params.id]);
    const polizaFinal = final.rows[0];

    res.json({
      valoracion: polizaFinal.valoracion,
      riesgos_cubiertos: polizaFinal.riesgos_cubiertos,
      riesgos_no_cubiertos: polizaFinal.riesgos_no_cubiertos,
      analisis_fortalezas: polizaFinal.analisis_fortalezas,
      analisis_carencias: polizaFinal.analisis_carencias,
      como_complementar: polizaFinal.como_complementar,
      comparador_mercado: polizaFinal.comparador_mercado,
      fecha_ultimo_analisis: polizaFinal.fecha_ultimo_analisis,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Timeout analizar-experto-inquilino (>115s)');
      return res.status(504).json({ error: 'La IA tardó demasiado. Inténtalo de nuevo.' });
    }
    console.error('Error analizar-experto-inquilino:', error.message);
    res.status(500).json({ error: 'Error interno al analizar la póliza' });
  }
});

module.exports = router;
