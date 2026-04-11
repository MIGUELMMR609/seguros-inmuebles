const express = require('express');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');
const { uploadRecibo } = require('../middleware/upload');
const { registrarActividad } = require('../utils/actividad');
const { llamarAnthropicApi } = require('../utils/anthropic');
const cloudinary = require('../config/cloudinary');

const MAX_BYTES_PDF = 5 * 1024 * 1024; // 5 MB límite Anthropic

const router = express.Router();
router.use(verificarToken);

// POST /api/polizas-inquilinos/poliza-optima
// IMPORTANTE: debe estar ANTES de las rutas /:id para que Express no lo confunda con un id
router.post('/poliza-optima', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'La clave de API de IA no está configurada (ANTHROPIC_API_KEY)' });
  }

  try {
    const { poliza_inmueble_id, datos_inmueble } = req.body;
    console.log('[poliza-optima] Inicio — poliza_inmueble_id:', poliza_inmueble_id);

    if (!poliza_inmueble_id) {
      return res.status(400).json({ error: 'Debes seleccionar una póliza de inmueble' });
    }

    // 1. Cargar la póliza del inmueble con su análisis
    const resPoliza = await pool.query(
      `SELECT p.*, i.nombre AS nombre_inmueble, i.direccion AS direccion_inmueble
       FROM polizas p
       LEFT JOIN inmuebles i ON p.inmueble_id = i.id
       WHERE p.id = $1`,
      [poliza_inmueble_id]
    );

    if (resPoliza.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza de inmueble no encontrada' });
    }

    const polizaInmueble = resPoliza.rows[0];
    console.log('[poliza-optima] Póliza cargada:', polizaInmueble.nombre_inmueble, '| PDF:', !!polizaInmueble.documento_url, '| Análisis:', !!(polizaInmueble.riesgos_cubiertos));

    // 2. Intentar leer el PDF de la póliza del inmueble
    let base64Pdf = null;
    if (polizaInmueble.documento_url) {
      try {
        const rutaArchivo = path.join(__dirname, '../../uploads', path.basename(polizaInmueble.documento_url));
        if (fs.existsSync(rutaArchivo)) {
          const buf = fs.readFileSync(rutaArchivo);
          // Limitar tamaño del PDF a 5MB para Anthropic
          if (buf.length <= MAX_BYTES_PDF) {
            base64Pdf = buf.toString('base64');
          } else {
            console.log('[poliza-optima] PDF demasiado grande (' + (buf.length / 1024 / 1024).toFixed(1) + 'MB), se omite');
          }
        } else {
          console.log('[poliza-optima] PDF no en disco, intentando HTTP fallback...');
          const urlPdf = polizaInmueble.documento_url.startsWith('http')
            ? polizaInmueble.documento_url
            : `${req.protocol}://${req.get('host')}${polizaInmueble.documento_url}`;
          const resPdf = await fetch(urlPdf);
          if (resPdf.ok) {
            const buf = Buffer.from(await resPdf.arrayBuffer());
            if (buf.length <= MAX_BYTES_PDF) {
              base64Pdf = buf.toString('base64');
            } else {
              console.log('[poliza-optima] PDF HTTP demasiado grande, se omite');
            }
          } else {
            console.log('[poliza-optima] PDF HTTP fallback falló:', resPdf.status);
          }
        }
      } catch (errPdf) {
        console.log('[poliza-optima] PDF no disponible:', errPdf.message);
      }
    }

    console.log('[poliza-optima] PDF base64:', base64Pdf ? (base64Pdf.length / 1024).toFixed(0) + 'KB' : 'no');

    // 3. Construir contexto
    const tipoUso = datos_inmueble?.tipo_inmueble === 'local_negocio' ? 'Local de negocio' : 'Vivienda';

    let datosEspecificos = '';
    if (datos_inmueble?.tipo_inmueble === 'vivienda') {
      const items = [];
      if (datos_inmueble.tiene_mascotas) items.push('Tiene mascotas');
      if (datos_inmueble.tiene_objetos_valor) items.push(`Objetos de valor: ${datos_inmueble.valor_objetos_valor || 'Sí'}`);
      if (datos_inmueble.num_personas) items.push(`${datos_inmueble.num_personas} personas vivirán`);
      if (datos_inmueble.tiene_vehiculo_garaje) items.push('Vehículo en garaje');
      if (datos_inmueble.valor_mobiliario) items.push(`Mobiliario/contenido: ${datos_inmueble.valor_mobiliario} €`);
      datosEspecificos = items.join(', ') || 'Sin datos adicionales';
    } else if (datos_inmueble?.tipo_inmueble === 'local_negocio') {
      const items = [];
      if (datos_inmueble.tipo_negocio) items.push(`Tipo: ${datos_inmueble.tipo_negocio}`);
      if (datos_inmueble.tiene_mercancia) items.push(`Mercancía: ${datos_inmueble.valor_mercancia || 'Sí'}`);
      if (datos_inmueble.tiene_empleados) items.push(`Empleados: ${datos_inmueble.num_empleados || 'Sí'}`);
      if (datos_inmueble.atiende_publico) items.push('Atiende al público');
      if (datos_inmueble.tiene_maquinaria) items.push(`Maquinaria: ${datos_inmueble.valor_maquinaria ? datos_inmueble.valor_maquinaria + ' €' : 'Sí (sin valor especificado)'}`);
      if (datos_inmueble.necesita_rc_empleados) items.push(`RC empleados: ${datos_inmueble.capital_rc_empleados ? datos_inmueble.capital_rc_empleados + ' €' : 'Sí'}`);
      if (datos_inmueble.necesita_rc_explotacion) items.push(`RC explotación: ${datos_inmueble.capital_rc_explotacion ? datos_inmueble.capital_rc_explotacion + ' €' : 'Sí'}`);
      if (datos_inmueble.necesita_defensa_juridica) items.push('Necesita defensa jurídica');
      if (datos_inmueble.necesita_equipos_electronicos) items.push(`Equipos electrónicos: ${datos_inmueble.valor_equipos_electronicos ? datos_inmueble.valor_equipos_electronicos + ' €' : 'Sí'}`);
      if (datos_inmueble.valor_mobiliario) items.push(`Mobiliario/contenido: ${datos_inmueble.valor_mobiliario} €`);
      datosEspecificos = items.join(', ') || 'Sin datos adicionales';
    }

    let analisisPrevio = '';
    if (polizaInmueble.riesgos_cubiertos || polizaInmueble.riesgos_no_cubiertos) {
      analisisPrevio = `
ANÁLISIS PREVIO DE LA PÓLIZA DEL INMUEBLE:
- Riesgos cubiertos: ${polizaInmueble.riesgos_cubiertos || 'No analizado'}
- Riesgos NO cubiertos: ${polizaInmueble.riesgos_no_cubiertos || 'No analizado'}
- Fortalezas: ${polizaInmueble.analisis_fortalezas || 'No analizado'}
- Carencias: ${polizaInmueble.analisis_carencias || 'No analizado'}
- Cómo complementar: ${polizaInmueble.como_complementar || 'No analizado'}`;
    }

    const prompt = `Eres un experto corredor de seguros en España con más de 20 años de experiencia.

Tu tarea: Recomendar la PÓLIZA ÓPTIMA DE INQUILINO que COMPLEMENTE la póliza del propietario del inmueble.
IMPORTANTE: Debes LEER EL PDF de la póliza del propietario y EXTRAER los importes contratados de cada cobertura.

=== PÓLIZA ACTUAL DEL PROPIETARIO (INMUEBLE) ===
- Inmueble: ${polizaInmueble.nombre_inmueble || 'No especificado'}${polizaInmueble.direccion_inmueble ? ' (' + polizaInmueble.direccion_inmueble + ')' : ''}
- Compañía: ${polizaInmueble.compania_aseguradora || 'No especificada'}
- Tipo: ${polizaInmueble.tipo || 'vivienda'}
- Importe: ${polizaInmueble.importe_anual ? polizaInmueble.importe_anual + ' €/año' : 'No especificado'}
- Valoración: ${polizaInmueble.valoracion ? polizaInmueble.valoracion + '/10' : 'No valorada'}
${analisisPrevio}

=== DATOS DEL INQUILINO / USO ===
- Tipo de uso: ${tipoUso}
- Datos específicos: ${datosEspecificos}

=== INSTRUCCIONES ===
1. Genera una TABLA de coberturas/riesgos concretos con DOS columnas de tipo STRING:
   - "propietario": EXTRAE del PDF el importe contratado por el propietario para cada cobertura.
     Formatos válidos:
     · "SI — 500.000 €" (si está cubierto, con el importe que aparece en el PDF)
     · "SI — sin importe especificado" (si está cubierto pero no encuentras importe en el PDF)
     · "NO contratado" (si esa cobertura no está en la póliza del propietario)
   - "inquilino": Recomienda si el inquilino debe contratarlo, con importe y motivo.
     Formatos válidos:
     · "SI — 150.000 € — No cubierto por propietario"
     · "SI — 300.000 € — Complementa cobertura existente"
     · "NO necesario — Ya cubierto por propietario"
     Usa los importes que el inquilino indicó en sus datos específicos como referencia para los capitales.
2. Cada concepto debe ser CORTO y CLARO (máximo 6-8 palabras)
3. Incluye entre 10 y 20 filas con coberturas/riesgos relevantes
4. Resume la recomendación en 3-4 líneas máximo
5. Da una prima estimada anual total para el inquilino (rango en €/año)
6. Sugiere MÁXIMO 3 compañías de España con breve justificación (1 línea cada una)

Devuelve ÚNICAMENTE un JSON válido (sin markdown, sin texto extra) con esta estructura:
{
  "tabla_coberturas": [
    { "concepto": "Incendio y explosión", "propietario": "SI — 500.000 €", "inquilino": "NO necesario — Ya cubierto por propietario" },
    { "concepto": "Daños por agua", "propietario": "SI — 300.000 €", "inquilino": "NO necesario — Ya cubierto por propietario" },
    { "concepto": "RC inquilino a terceros", "propietario": "NO contratado", "inquilino": "SI — 300.000 € — No cubierto por propietario" },
    { "concepto": "Robo de contenido", "propietario": "NO contratado", "inquilino": "SI — 30.000 € — No cubierto por propietario" },
    { "concepto": "Responsabilidad civil", "propietario": "SI — 150.000 €", "inquilino": "SI — 300.000 € — Complementa cobertura existente" }
  ],
  "tipo_recomendado": "Tipo de seguro (hogar inquilino, RC, multirriesgo comercial, etc.)",
  "resumen": "Resumen en 3-4 líneas máximo con la recomendación principal para el inquilino",
  "prima_estimada_anual": "350-500 €/año",
  "companias_recomendadas": [
    "Mapfre — buena relación calidad/precio para inquilinos",
    "Zurich — amplia cobertura de RC",
    "AXA — buen servicio postventa"
  ]
}`;

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 115_000);

    // Construir el contenido del mensaje
    const contenidoMensaje = [];
    if (base64Pdf) {
      contenidoMensaje.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
      });
    }
    contenidoMensaje.push({ type: 'text', text: prompt });

    console.log('[poliza-optima] Llamando a Anthropic... (con PDF:', !!base64Pdf, ')');

    const respuesta = await llamarAnthropicApi({
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        ...(base64Pdf ? { 'anthropic-beta': 'pdfs-2024-09-25' } : {}),
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: contenidoMensaje }],
      }),
    });

    clearTimeout(temporizador);

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      console.error(`[poliza-optima] Error Anthropic [${respuesta.status}]:`, cuerpo.slice(0, 500));
      let detalle = '';
      try { detalle = JSON.parse(cuerpo)?.error?.message || cuerpo.slice(0, 200); } catch { detalle = cuerpo.slice(0, 200); }
      return res.status(502).json({ error: `IA [${respuesta.status}]: ${detalle}` });
    }

    const resultadoIA = await respuesta.json();
    const textoCompleto = resultadoIA.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    console.log('[poliza-optima] Respuesta IA recibida, longitud:', textoCompleto.length);

    let datos;
    try {
      datos = JSON.parse(textoCompleto);
    } catch {
      const m = textoCompleto.match(/\{[\s\S]*\}/);
      if (!m) {
        console.error('[poliza-optima] No se encontró JSON en respuesta IA:', textoCompleto.slice(0, 500));
        return res.status(422).json({ error: 'No se pudo extraer el informe de la IA' });
      }
      try {
        datos = JSON.parse(m[0]);
      } catch (errJson) {
        console.error('[poliza-optima] JSON inválido en respuesta IA:', errJson.message, m[0].slice(0, 300));
        return res.status(422).json({ error: 'La IA devolvió un formato no válido. Inténtalo de nuevo.' });
      }
    }

    console.log('[poliza-optima] Informe generado correctamente');

    res.json({
      informe: datos,
      poliza_inmueble: {
        id: polizaInmueble.id,
        nombre_inmueble: polizaInmueble.nombre_inmueble,
        compania: polizaInmueble.compania_aseguradora,
        tiene_pdf: !!base64Pdf,
        tiene_analisis: !!(polizaInmueble.riesgos_cubiertos || polizaInmueble.riesgos_no_cubiertos),
      },
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('[poliza-optima] Timeout (>115s)');
      return res.status(504).json({ error: 'La IA tardó demasiado. Inténtalo de nuevo.' });
    }
    console.error('[poliza-optima] Error interno:', error.message, error.stack);
    res.status(500).json({ error: 'Error interno al generar el informe: ' + error.message });
  }
});

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
      direccion_bien_asegurado,
      datos_inmueble,
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
        compania_aseguradora ?? null,
        numero_poliza ?? null,
        fecha_inicio ?? null,
        fecha_vencimiento ?? null,
        importe_anual ?? null,
        notas ?? null,
        documento_url ?? null,
        tomador_poliza ?? null,
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
          como_complementar = $9,
          direccion_bien_asegurado = $10,
          datos_inmueble = $11
         WHERE id = $12`,
        [
          tipo || 'hogar',
          contacto_nombre ?? null,
          contacto_telefono ?? null,
          contacto_email ?? null,
          riesgos_cubiertos ?? null,
          riesgos_no_cubiertos ?? null,
          analisis_fortalezas ?? null,
          analisis_carencias ?? null,
          como_complementar ?? null,
          direccion_bien_asegurado ?? null,
          datos_inmueble ? JSON.stringify(datos_inmueble) : null,
          polizaId,
        ]
      );
    } catch (errNuevas) {
      console.warn('No se pudieron guardar campos nuevos (migración pendiente):', errNuevas.message);
    }

    const final = await pool.query('SELECT * FROM polizas_inquilinos WHERE id = $1', [polizaId]);
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    registrarActividad(req.usuario.id, req.usuario.email, 'crear', 'poliza_inquilino', polizaId, `${compania_aseguradora || ''} · ${numero_poliza || ''}`, ip);
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
      direccion_bien_asegurado,
      datos_inmueble,
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
        compania_aseguradora ?? null,
        numero_poliza ?? null,
        fecha_inicio ?? null,
        fecha_vencimiento ?? null,
        importe_anual ?? null,
        notas ?? null,
        documento_url ?? null,
        tomador_poliza ?? null,
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
          como_complementar = $9,
          direccion_bien_asegurado = $10,
          datos_inmueble = $11
         WHERE id = $12`,
        [
          tipo || 'hogar',
          contacto_nombre ?? null,
          contacto_telefono ?? null,
          contacto_email ?? null,
          riesgos_cubiertos ?? null,
          riesgos_no_cubiertos ?? null,
          analisis_fortalezas ?? null,
          analisis_carencias ?? null,
          como_complementar ?? null,
          direccion_bien_asegurado ?? null,
          datos_inmueble ? JSON.stringify(datos_inmueble) : null,
          req.params.id,
        ]
      );
    } catch (errNuevas) {
      console.warn('No se pudieron guardar campos nuevos (migración pendiente):', errNuevas.message);
    }

    const final = await pool.query('SELECT * FROM polizas_inquilinos WHERE id = $1', [req.params.id]);
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    registrarActividad(req.usuario.id, req.usuario.email, 'editar', 'poliza_inquilino', parseInt(req.params.id), `${compania_aseguradora || ''} · ${numero_poliza || ''}`, ip);
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
      'DELETE FROM polizas_inquilinos WHERE id = $1 RETURNING id, compania_aseguradora, numero_poliza',
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza de inquilino no encontrada' });
    }

    const { id: polizaId, compania_aseguradora, numero_poliza } = resultado.rows[0];
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    registrarActividad(req.usuario.id, req.usuario.email, 'eliminar', 'poliza_inquilino', polizaId, `${compania_aseguradora || ''} · ${numero_poliza || ''}`, ip);

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

    const respuesta = await llamarAnthropicApi( {
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
      let detalle = '';
      try { detalle = JSON.parse(cuerpo)?.error?.message || cuerpo.slice(0, 200); } catch { detalle = cuerpo.slice(0, 200); }
      return res.status(502).json({ error: `IA [${respuesta.status}]: ${detalle}` });
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
        datos.valoracion ?? null,
        datos.riesgos_cubiertos ?? null,
        datos.riesgos_no_cubiertos ?? null,
        datos.analisis_fortalezas ?? null,
        datos.analisis_carencias ?? null,
        datos.como_complementar ?? null,
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

// --- RENOVACIÓN DE PÓLIZA DE INQUILINO CON OCR DE RECIBO BANCARIO ---

// Sube un buffer a Cloudinary, detectando automáticamente el tipo (PDF o imagen)
function subirReciboCloudinary(buffer, esImagen) {
  return new Promise((resolve, reject) => {
    const opciones = esImagen
      ? { folder: 'recibos-polizas', resource_type: 'image', type: 'upload', access_mode: 'public' }
      : { folder: 'recibos-polizas', resource_type: 'raw', type: 'upload', access_mode: 'public', format: 'pdf' };
    cloudinary.uploader.upload_stream(opciones, (error, result) => {
      if (error) reject(error);
      else resolve(result.secure_url);
    }).end(buffer);
  });
}

// Normaliza número de póliza para comparar (quita espacios, guiones, puntos)
function normalizarNumeroPoliza(num) {
  if (!num) return '';
  return String(num).toLowerCase().replace(/[\s\-_\.\/]/g, '');
}

// POST /api/polizas-inquilinos/:id/ocr-recibo — sube recibo y extrae datos con IA
router.post('/:id/ocr-recibo', uploadRecibo.single('recibo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'La clave de API de IA no está configurada (ANTHROPIC_API_KEY)' });
  }

  try {
    // 1. Cargar póliza actual para comparar luego
    const resPol = await pool.query(
      `SELECT pi.*, inq.nombre AS nombre_inquilino
       FROM polizas_inquilinos pi
       LEFT JOIN inquilinos inq ON pi.inquilino_id = inq.id
       WHERE pi.id = $1`,
      [req.params.id]
    );
    if (resPol.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza de inquilino no encontrada' });
    }
    const poliza = resPol.rows[0];

    // 2. Detectar tipo (PDF / imagen)
    const mimetype = req.file.mimetype || '';
    const nombre = (req.file.originalname || '').toLowerCase();
    const esPDF = mimetype === 'application/pdf' || mimetype === 'application/octet-stream' || nombre.endsWith('.pdf');
    const esImagen = !esPDF && mimetype.startsWith('image/');
    const mediaTypeImagen = esImagen
      ? (mimetype === 'image/jpg' ? 'image/jpeg' : mimetype)
      : null;

    const base64 = req.file.buffer.toString('base64');

    // 3. Subir recibo a Cloudinary en paralelo
    const promesaUrl = subirReciboCloudinary(req.file.buffer, esImagen).catch((err) => {
      console.warn('No se pudo subir recibo a Cloudinary:', err?.message);
      return null;
    });

    // 4. Llamar a la IA para OCR
    const prompt = `Analiza este recibo bancario de un seguro y extrae la información del pago.
Devuelve ÚNICAMENTE un objeto JSON válido (sin markdown, sin texto extra) con esta estructura exacta:
{
  "numero_poliza": "número de póliza tal como aparece en el recibo, o null",
  "compania_aseguradora": "nombre de la compañía aseguradora o null",
  "importe_pagado": número decimal sin símbolo de moneda o null,
  "fecha_pago": "YYYY-MM-DD (fecha en que se efectuó el cargo/pago) o null",
  "fecha_inicio": "YYYY-MM-DD (inicio del nuevo periodo de cobertura que cubre el recibo) o null",
  "fecha_vencimiento": "YYYY-MM-DD (fin del nuevo periodo de cobertura que cubre el recibo) o null",
  "periodo_cobertura": "texto descriptivo del periodo (ej: 01/01/2026 al 31/12/2026) o null"
}
Las fechas SIEMPRE en formato YYYY-MM-DD. Los importes como números decimales sin € ni comas de miles (usa punto como separador decimal).
Si algún dato no aparece en el recibo, usa null.`;

    const contenido = esPDF
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: prompt },
        ]
      : [
          { type: 'image', source: { type: 'base64', media_type: mediaTypeImagen, data: base64 } },
          { type: 'text', text: prompt },
        ];

    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), 115_000);

    const respuesta = await llamarAnthropicApi({
      method: 'POST',
      signal: controlador.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        ...(esPDF ? { 'anthropic-beta': 'pdfs-2024-09-25' } : {}),
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: contenido }],
      }),
    });

    clearTimeout(temporizador);

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      console.error(`Error Anthropic ocr-recibo [${respuesta.status}]:`, cuerpo.slice(0, 300));
      let detalle = '';
      try { detalle = JSON.parse(cuerpo)?.error?.message || cuerpo.slice(0, 200); } catch { detalle = cuerpo.slice(0, 200); }
      return res.status(502).json({ error: `IA [${respuesta.status}]: ${detalle}` });
    }

    const resultadoIA = await respuesta.json();
    const texto = resultadoIA.content?.filter((b) => b.type === 'text').map((b) => b.text).join('') || '';
    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      const m = texto.match(/\{[\s\S]*\}/);
      if (!m) return res.status(422).json({ error: 'La IA no devolvió un JSON válido' });
      datos = JSON.parse(m[0]);
    }

    // 5. Verificación automática: comparar número de póliza del recibo con la registrada
    const numRec = normalizarNumeroPoliza(datos.numero_poliza);
    const numPol = normalizarNumeroPoliza(poliza.numero_poliza);
    const coincide = !!numRec && !!numPol && (numRec === numPol || numRec.includes(numPol) || numPol.includes(numRec));

    const recibo_url = await promesaUrl;

    res.json({
      datos,
      recibo_url,
      verificacion: {
        coincide,
        numero_poliza_actual: poliza.numero_poliza || null,
        numero_poliza_recibo: datos.numero_poliza || null,
        nombre_inquilino: poliza.nombre_inquilino || null,
      },
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Timeout ocr-recibo (>115s)');
      return res.status(504).json({ error: 'La IA tardó demasiado. Inténtalo de nuevo.' });
    }
    console.error('Error ocr-recibo:', error.message);
    res.status(500).json({ error: 'Error interno al analizar el recibo' });
  }
});

// POST /api/polizas-inquilinos/:id/renovar — aplica renovación y guarda histórico
router.post('/:id/renovar', async (req, res) => {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    const { id } = req.params;
    const {
      nueva_fecha_inicio,
      nueva_fecha_vencimiento,
      nuevo_importe,
      nueva_compania_aseguradora,
      nuevo_numero_poliza,
      fecha_pago,
      recibo_url,
      notas,
    } = req.body;

    if (!nueva_fecha_vencimiento) {
      await cliente.query('ROLLBACK');
      return res.status(400).json({ error: 'La nueva fecha de vencimiento es requerida' });
    }

    // Cargar póliza actual
    const actual = await cliente.query(
      `SELECT fecha_inicio, fecha_vencimiento, importe_anual, compania_aseguradora, numero_poliza
       FROM polizas_inquilinos WHERE id = $1`,
      [id]
    );
    if (actual.rows.length === 0) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ error: 'Póliza de inquilino no encontrada' });
    }
    const pa = actual.rows[0];

    // Guardar histórico (snapshot del estado previo + recibo del nuevo periodo)
    await cliente.query(
      `INSERT INTO historial_polizas_inquilinos
         (poliza_inquilino_id, compania_aseguradora, numero_poliza,
          fecha_inicio, fecha_vencimiento, importe, fecha_pago, recibo_url, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        nueva_compania_aseguradora || pa.compania_aseguradora || null,
        nuevo_numero_poliza || pa.numero_poliza || null,
        nueva_fecha_inicio || pa.fecha_inicio || null,
        nueva_fecha_vencimiento,
        nuevo_importe != null && nuevo_importe !== '' ? parseFloat(nuevo_importe) : pa.importe_anual,
        fecha_pago || null,
        recibo_url || null,
        notas || null,
      ]
    );

    // Actualizar póliza con los nuevos datos
    const actualizada = await cliente.query(
      `UPDATE polizas_inquilinos SET
         fecha_inicio = COALESCE($1, fecha_inicio),
         fecha_vencimiento = $2,
         importe_anual = COALESCE($3, importe_anual),
         compania_aseguradora = COALESCE($4, compania_aseguradora),
         numero_poliza = COALESCE($5, numero_poliza),
         updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        nueva_fecha_inicio || null,
        nueva_fecha_vencimiento,
        nuevo_importe != null && nuevo_importe !== '' ? parseFloat(nuevo_importe) : null,
        nueva_compania_aseguradora || null,
        nuevo_numero_poliza || null,
        id,
      ]
    );

    await cliente.query('COMMIT');

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    registrarActividad(
      req.usuario.id,
      req.usuario.email,
      'renovar',
      'poliza_inquilino',
      parseInt(id),
      `Renovada hasta ${nueva_fecha_vencimiento}`,
      ip
    );

    res.json({ mensaje: 'Póliza renovada correctamente', poliza: actualizada.rows[0] });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al renovar póliza de inquilino:', error);
    res.status(500).json({ error: 'Error al renovar la póliza de inquilino' });
  } finally {
    cliente.release();
  }
});

// GET /api/polizas-inquilinos/:id/recibos — lista histórico de recibos pagados
router.get('/:id/recibos', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT * FROM historial_polizas_inquilinos
       WHERE poliza_inquilino_id = $1
       ORDER BY fecha_renovacion DESC`,
      [req.params.id]
    );
    res.json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener recibos:', error);
    res.status(500).json({ error: 'Error al obtener el histórico de recibos' });
  }
});

module.exports = router;
