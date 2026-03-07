const express = require('express');
const { PDFDocument } = require('pdf-lib');
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

// GET /api/inquilinos/historico-renovaciones — contratos archivados por renovación
// IMPORTANTE: debe ir antes de /:id para evitar que Express lo trate como un id
router.get('/historico-renovaciones', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT cr.*,
              inq.nombre AS nombre_inquilino,
              inq.inmueble_id,
              inm.nombre AS nombre_inmueble
       FROM contrato_renovaciones cr
       JOIN inquilinos inq ON cr.inquilino_id = inq.id
       LEFT JOIN inmuebles inm ON inq.inmueble_id = inm.id
       ORDER BY cr.fecha_renovacion DESC`
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener histórico de renovaciones:', error);
    res.status(500).json({ error: 'Error al obtener el histórico de renovaciones' });
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
      importe_renta, documento_url, observaciones_ia, notas, tomador_contrato,
      clausulas_principales, clausulas_perjudiciales, obligaciones_inquilino,
      obligaciones_propietario, analisis_juridico, recomendaciones_contrato,
    } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del inquilino es requerido' });
    }

    console.log('POST inquilino — nombre:', nombre, '| observaciones_ia:', observaciones_ia?.slice(0, 100) || '(vacío)');

    const resultado = await pool.query(
      `INSERT INTO inquilinos
        (inmueble_id, nombre, email, telefono, fecha_inicio_contrato, fecha_fin_contrato,
         importe_renta, documento_url, observaciones_ia, notas, estado,
         tomador_contrato, clausulas_principales, clausulas_perjudiciales,
         obligaciones_inquilino, obligaciones_propietario, analisis_juridico, recomendaciones_contrato)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'activo',$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        inmueble_id || null, nombre.trim(), email || null, telefono || null,
        fecha_inicio_contrato || null, fecha_fin_contrato || null,
        importe_renta || null, documento_url || null,
        observaciones_ia || null, notas || null,
        tomador_contrato || null, clausulas_principales || null,
        clausulas_perjudiciales || null, obligaciones_inquilino || null,
        obligaciones_propietario || null, analisis_juridico || null,
        recomendaciones_contrato || null,
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
      importe_renta, documento_url, observaciones_ia, notas, tomador_contrato,
      clausulas_principales, clausulas_perjudiciales, obligaciones_inquilino,
      obligaciones_propietario, analisis_juridico, recomendaciones_contrato,
    } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del inquilino es requerido' });
    }

    const resultado = await pool.query(
      `UPDATE inquilinos
       SET inmueble_id=$1, nombre=$2, email=$3, telefono=$4,
           fecha_inicio_contrato=$5, fecha_fin_contrato=$6,
           importe_renta=$7, documento_url=$8, observaciones_ia=$9, notas=$10,
           tomador_contrato=$11, clausulas_principales=$12, clausulas_perjudiciales=$13,
           obligaciones_inquilino=$14, obligaciones_propietario=$15,
           analisis_juridico=$16, recomendaciones_contrato=$17
       WHERE id=$18
       RETURNING *`,
      [
        inmueble_id || null, nombre.trim(), email || null, telefono || null,
        fecha_inicio_contrato || null, fecha_fin_contrato || null,
        importe_renta || null, documento_url || null,
        observaciones_ia || null, notas || null,
        tomador_contrato || null, clausulas_principales || null,
        clausulas_perjudiciales || null, obligaciones_inquilino || null,
        obligaciones_propietario || null, analisis_juridico || null,
        recomendaciones_contrato || null,
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
    const {
      tipo_renovacion,
      fecha_inicio, fecha_fin, importe,
      clausulas_adicionales,
      nuevo_documento_url,
      // Contrato nuevo:
      notas, documento_url,
      clausulas_principales, clausulas_perjudiciales,
      obligaciones_inquilino, obligaciones_propietario,
      analisis_juridico, recomendaciones_contrato, valoracion_contrato,
    } = req.body;
    const inquilinoId = req.params.id;

    // Leer datos actuales del inquilino para archivarlos
    const actual = await pool.query('SELECT * FROM inquilinos WHERE id = $1', [inquilinoId]);
    if (actual.rows.length === 0) return res.status(404).json({ error: 'Inquilino no encontrado' });
    const inq = actual.rows[0];

    // Archivar contrato actual en histórico
    await pool.query(
      `INSERT INTO contrato_renovaciones (
         inquilino_id, fecha_inicio, fecha_fin, importe, notas,
         tipo_renovacion, clausulas_adicionales, documento_url,
         clausulas_principales, clausulas_perjudiciales,
         obligaciones_inquilino, obligaciones_propietario,
         analisis_juridico, recomendaciones_contrato, valoracion_contrato
       ) VALUES ($1,$2,$3,$4,$5::text,$6,$7::text,$8::text,$9::text,$10::text,$11::text,$12::text,$13::text,$14::text,$15::numeric)`,
      [
        inquilinoId,
        inq.fecha_inicio_contrato, inq.fecha_fin_contrato, inq.importe_renta,
        inq.notas,
        tipo_renovacion || 'mismas_clausulas',
        clausulas_adicionales || null,
        inq.documento_url,
        inq.clausulas_principales, inq.clausulas_perjudiciales,
        inq.obligaciones_inquilino, inq.obligaciones_propietario,
        inq.analisis_juridico, inq.recomendaciones_contrato, inq.valoracion_contrato,
      ]
    );

    let resultado;
    if (!tipo_renovacion || tipo_renovacion === 'mismas_clausulas') {
      // Solo actualizar fechas, importe y opcionalmente nuevo PDF
      resultado = await pool.query(
        `UPDATE inquilinos
         SET fecha_inicio_contrato = COALESCE($1, fecha_inicio_contrato),
             fecha_fin_contrato    = COALESCE($2, fecha_fin_contrato),
             importe_renta         = COALESCE($3, importe_renta),
             documento_url         = COALESCE($4, documento_url)
         WHERE id = $5 RETURNING *`,
        [fecha_inicio || null, fecha_fin || null, importe || null, nuevo_documento_url || null, inquilinoId]
      );
    } else {
      // Contrato nuevo: sustituir todos los campos del contrato
      resultado = await pool.query(
        `UPDATE inquilinos
         SET fecha_inicio_contrato          = COALESCE($1::date, fecha_inicio_contrato),
             fecha_fin_contrato             = COALESCE($2::date, fecha_fin_contrato),
             importe_renta                  = COALESCE($3::numeric, importe_renta),
             documento_url                  = $4::text,
             notas                          = $5::text,
             clausulas_principales          = $6::text,
             clausulas_perjudiciales        = $7::text,
             obligaciones_inquilino         = $8::text,
             obligaciones_propietario       = $9::text,
             analisis_juridico              = $10::text,
             recomendaciones_contrato       = $11::text,
             valoracion_contrato            = $12::numeric,
             fecha_ultimo_analisis_contrato = CASE WHEN $12::numeric IS NOT NULL THEN NOW() ELSE NULL END
         WHERE id = $13 RETURNING *`,
        [
          fecha_inicio || null, fecha_fin || null, importe || null,
          documento_url || null,
          notas || null,
          clausulas_principales || null, clausulas_perjudiciales || null,
          obligaciones_inquilino || null, obligaciones_propietario || null,
          analisis_juridico || null, recomendaciones_contrato || null,
          valoracion_contrato || null,
          inquilinoId,
        ]
      );
    }

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

// POST /api/inquilinos/:id/analizar-contrato — Análisis jurídico experto del contrato
router.post('/:id/analizar-contrato', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'La clave de API de IA no está configurada (ANTHROPIC_API_KEY)' });
  }

  try {
    const resultado = await pool.query(
      `SELECT inq.*, i.nombre AS nombre_inmueble FROM inquilinos inq
       LEFT JOIN inmuebles i ON inq.inmueble_id = i.id WHERE inq.id = $1`,
      [req.params.id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }
    const inq = resultado.rows[0];

    if (!inq.documento_url) {
      return res.status(400).json({ error: 'Sube el PDF del contrato primero' });
    }

    // Obtener el PDF (Cloudinary URL o disco)
    let buffer;
    try {
      const urlPdf = inq.documento_url.startsWith('http')
        ? inq.documento_url
        : `${req.protocol}://${req.get('host')}${inq.documento_url}`;
      const resPdf = await fetch(urlPdf);
      if (!resPdf.ok) throw new Error(`HTTP ${resPdf.status}`);
      const arr = await resPdf.arrayBuffer();
      buffer = Buffer.from(arr);
    } catch (err) {
      return res.status(404).json({ error: 'PDF del contrato no disponible: ' + err.message });
    }

    // Reducir si supera 5 MB
    const MAX_BYTES = 5 * 1024 * 1024;
    if (buffer.length > MAX_BYTES) {
      try {
        const pdfOrig = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const total = pdfOrig.getPageCount();
        if (total > 10) {
          const pdfNuevo = await PDFDocument.create();
          const paginas = await pdfNuevo.copyPages(pdfOrig, Array.from({ length: 10 }, (_, i) => i));
          paginas.forEach((p) => pdfNuevo.addPage(p));
          buffer = Buffer.from(await pdfNuevo.save());
          console.log(`Contrato reducido: ${total} → 10 páginas para análisis`);
        }
      } catch (e) {
        console.warn('No se pudo reducir el contrato, se envía completo:', e.message);
      }
    }

    const base64 = buffer.toString('base64');

    const prompt = `Eres un experto jurídico español especializado en derecho de arrendamientos urbanos (LAU) con más de 20 años de experiencia.
Analiza este contrato de arrendamiento en detalle y proporciona un análisis jurídico completo.

Datos conocidos:
- Inquilino: ${inq.nombre}
- Inmueble: ${inq.nombre_inmueble || 'No especificado'}
- Renta: ${inq.importe_renta ? inq.importe_renta + ' €/mes' : 'No especificada'}

Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional, sin markdown) con esta estructura exacta:
{
  "valoracion_contrato": 7.5,
  "clausulas_principales": "Resumen de las cláusulas más importantes: duración, renta, fianza, uso del inmueble, etc.",
  "clausulas_perjudiciales": "Cláusulas que perjudican al arrendador: limitaciones de acceso, responsabilidades excesivas, renuncias de derechos, etc. Si no hay ninguna, indicar 'Ninguna cláusula especialmente perjudicial detectada'.",
  "obligaciones_inquilino": "Lista detallada de obligaciones del arrendatario según el contrato",
  "obligaciones_propietario": "Lista detallada de obligaciones del arrendador según el contrato",
  "analisis_juridico": "Fortalezas y debilidades jurídicas del contrato: conformidad con la LAU, cláusulas nulas, protecciones para ambas partes",
  "recomendaciones_contrato": "Recomendaciones concretas para mejorar el contrato en futuras renovaciones, cláusulas a añadir o modificar"
}

La valoración es un número del 1 al 10 (puede tener un decimal). Todos los campos en español.`;

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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 3000,
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
      console.error(`Error Anthropic analizar-contrato-experto [${respuesta.status}]:`, cuerpo.slice(0, 300));
      return res.status(502).json({ error: 'Error al comunicarse con la IA. Inténtalo de nuevo.' });
    }

    const iaResult = await respuesta.json();
    const texto = iaResult.content?.filter((b) => b.type === 'text').map((b) => b.text).join('') || '';

    let analisis;
    try {
      analisis = JSON.parse(texto);
    } catch {
      const m = texto.match(/\{[\s\S]*\}/);
      if (!m) return res.status(422).json({ error: 'No se pudo extraer el análisis estructurado' });
      analisis = JSON.parse(m[0]);
    }

    await pool.query(
      `UPDATE inquilinos SET
        clausulas_principales=$1, clausulas_perjudiciales=$2,
        obligaciones_inquilino=$3, obligaciones_propietario=$4,
        analisis_juridico=$5, recomendaciones_contrato=$6,
        valoracion_contrato=$7, fecha_ultimo_analisis_contrato=NOW()
       WHERE id=$8`,
      [
        analisis.clausulas_principales || null,
        analisis.clausulas_perjudiciales || null,
        analisis.obligaciones_inquilino || null,
        analisis.obligaciones_propietario || null,
        analisis.analisis_juridico || null,
        analisis.recomendaciones_contrato || null,
        analisis.valoracion_contrato || null,
        req.params.id,
      ]
    );

    const final = await pool.query('SELECT * FROM inquilinos WHERE id=$1', [req.params.id]);
    const r = final.rows[0];
    res.json({
      valoracion_contrato: r.valoracion_contrato,
      clausulas_principales: r.clausulas_principales,
      clausulas_perjudiciales: r.clausulas_perjudiciales,
      obligaciones_inquilino: r.obligaciones_inquilino,
      obligaciones_propietario: r.obligaciones_propietario,
      analisis_juridico: r.analisis_juridico,
      recomendaciones_contrato: r.recomendaciones_contrato,
      fecha_ultimo_analisis_contrato: r.fecha_ultimo_analisis_contrato,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'La IA tardó demasiado. Inténtalo de nuevo.' });
    }
    console.error('Error analizar-contrato-experto:', error.message);
    res.status(500).json({ error: 'Error interno al analizar el contrato' });
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
