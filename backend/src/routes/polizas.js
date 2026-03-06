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
      riesgos_cubiertos, riesgos_no_cubiertos, analisis_fortalezas, analisis_carencias, como_complementar,
    } = req.body;

    if (!inmueble_id) {
      return res.status(400).json({ error: 'El inmueble es requerido' });
    }

    const tipoFinal = TIPOS_VALIDOS.includes(tipo) ? tipo : 'vivienda';

    const resultado = await pool.query(
      `INSERT INTO polizas
        (inmueble_id, tipo, compania_aseguradora, numero_poliza, fecha_inicio, fecha_vencimiento,
         importe_anual, notas, documento_url, contacto_nombre, contacto_telefono, contacto_email,
         periodicidad_pago, importe_pago, fecha_proximo_pago,
         riesgos_cubiertos, riesgos_no_cubiertos, analisis_fortalezas, analisis_carencias, como_complementar)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING *`,
      [
        inmueble_id, tipoFinal, compania_aseguradora || null, numero_poliza || null,
        fecha_inicio || null, fecha_vencimiento || null, importe_anual || null,
        notas || null, documento_url || null, contacto_nombre || null,
        contacto_telefono || null, contacto_email || null,
        periodicidad_pago || 'anual', importe_pago || null, fecha_proximo_pago || null,
        riesgos_cubiertos || null, riesgos_no_cubiertos || null,
        analisis_fortalezas || null, analisis_carencias || null, como_complementar || null,
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
      riesgos_cubiertos, riesgos_no_cubiertos, analisis_fortalezas, analisis_carencias, como_complementar,
    } = req.body;

    const tipoFinal = TIPOS_VALIDOS.includes(tipo) ? tipo : 'vivienda';

    const resultado = await pool.query(
      `UPDATE polizas
       SET inmueble_id=$1, tipo=$2, compania_aseguradora=$3, numero_poliza=$4,
           fecha_inicio=$5, fecha_vencimiento=$6, importe_anual=$7, notas=$8,
           documento_url=$9, contacto_nombre=$10, contacto_telefono=$11, contacto_email=$12,
           periodicidad_pago=$13, importe_pago=$14, fecha_proximo_pago=$15,
           riesgos_cubiertos=$16, riesgos_no_cubiertos=$17,
           analisis_fortalezas=$18, analisis_carencias=$19, como_complementar=$20,
           updated_at=NOW()
       WHERE id=$21
       RETURNING *`,
      [
        inmueble_id, tipoFinal, compania_aseguradora || null, numero_poliza || null,
        fecha_inicio || null, fecha_vencimiento || null, importe_anual || null,
        notas || null, documento_url || null, contacto_nombre || null,
        contacto_telefono || null, contacto_email || null,
        periodicidad_pago || 'anual', importe_pago || null, fecha_proximo_pago || null,
        riesgos_cubiertos || null, riesgos_no_cubiertos || null,
        analisis_fortalezas || null, analisis_carencias || null, como_complementar || null,
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

// POST /api/polizas/:id/analizar-experto - Análisis experto IA de la póliza
router.post('/:id/analizar-experto', async (req, res) => {
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

    const poliza = resultado.rows[0];

    if (!poliza.documento_url) {
      return res.status(400).json({ error: 'Sube el PDF primero' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'API de IA no configurada (ANTHROPIC_API_KEY)' });
    }

    const rutaArchivo = path.join(__dirname, '../../uploads', path.basename(poliza.documento_url));

    if (!fs.existsSync(rutaArchivo)) {
      return res.status(404).json({ archivo_disponible: false, error: 'PDF no disponible en servidor' });
    }

    const base64 = fs.readFileSync(rutaArchivo).toString('base64');

    const prompt = `Eres un experto en correduría de seguros en España con más de 20 años de experiencia.
Analiza esta póliza de seguro de inmueble y proporciona un análisis experto completo.

Datos conocidos de la póliza:
- Compañía aseguradora: ${poliza.compania_aseguradora || 'Desconocida'}
- Tipo de seguro: ${poliza.tipo || 'vivienda'}
- Importe anual: ${poliza.importe_anual ? poliza.importe_anual + ' €/año' : 'No especificado'}
- Inmueble: ${poliza.nombre_inmueble || 'No especificado'}${poliza.direccion_inmueble ? ' (' + poliza.direccion_inmueble + ')' : ''}

Usa la búsqueda web para consultar precios actuales del mercado de seguros de hogar en España si lo necesitas para el comparador.

Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional, sin markdown) con esta estructura exacta:
{
  "valoracion": 7.5,
  "riesgos_cubiertos": "Descripción detallada de los principales riesgos cubiertos según el documento",
  "riesgos_no_cubiertos": "Descripción de los riesgos excluidos o no cubiertos más relevantes",
  "analisis_fortalezas": "Puntos fuertes de esta póliza respecto a la competencia y las necesidades del asegurado",
  "analisis_carencias": "Puntos débiles, carencias o aspectos mejorables de esta póliza",
  "como_complementar": "Recomendaciones específicas para complementar o mejorar la cobertura actual",
  "comparador_mercado": {
    "precio_estimado_mercado": "XXX-YYY €/año",
    "evaluacion_precio": "Descripción de si el precio es competitivo, caro o económico respecto al mercado actual",
    "recomendaciones": "Recomendaciones sobre si mantener, cambiar o renegociar la póliza"
  }
}

La valoración es un número del 1 al 10 (puede tener un decimal). Todos los campos de texto en español.`;

    const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25,web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      console.error(`Error Anthropic analizar-experto [${respuesta.status}]:`, cuerpo.slice(0, 300));
      return res.status(502).json({ error: 'Error al comunicarse con la IA. Inténtalo de nuevo.' });
    }

    const iaResult = await respuesta.json();
    const texto = iaResult.content.filter((b) => b.type === 'text').map((b) => b.text).join('');

    if (!texto) return res.status(422).json({ error: 'La IA no devolvió ninguna respuesta de texto' });

    let analisis;
    try {
      analisis = JSON.parse(texto);
    } catch {
      const m = texto.match(/\{[\s\S]*\}/);
      if (!m) return res.status(422).json({ error: 'No se pudo extraer el análisis estructurado' });
      analisis = JSON.parse(m[0]);
    }

    await pool.query(
      `UPDATE polizas SET
        riesgos_cubiertos = $1,
        riesgos_no_cubiertos = $2,
        analisis_fortalezas = $3,
        analisis_carencias = $4,
        valoracion = $5,
        como_complementar = $6,
        comparador_mercado = $7,
        fecha_ultimo_analisis = NOW()
       WHERE id = $8`,
      [
        analisis.riesgos_cubiertos || null,
        analisis.riesgos_no_cubiertos || null,
        analisis.analisis_fortalezas || null,
        analisis.analisis_carencias || null,
        analisis.valoracion || null,
        analisis.como_complementar || null,
        analisis.comparador_mercado ? JSON.stringify(analisis.comparador_mercado) : null,
        req.params.id,
      ]
    );

    res.json({ ...analisis, fecha_ultimo_analisis: new Date().toISOString() });
  } catch (error) {
    console.error('Error analizar-experto:', error.message);
    res.status(500).json({ error: 'Error interno al analizar la póliza' });
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
