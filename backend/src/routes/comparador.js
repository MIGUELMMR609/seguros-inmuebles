const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');
const { llamarAnthropicApi } = require('../utils/anthropic');
const { upload } = require('../middleware/upload');

const router = express.Router();
router.use(verificarToken);

const TIMEOUT_MS = 120_000;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB por PDF

// Descarga un PDF desde una URL y lo devuelve como base64
async function descargarPdfBase64(url) {
  const respuesta = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} al descargar PDF`);
  const buffer = Buffer.from(await respuesta.arrayBuffer());
  // Limitar tamaño para no superar límites de Anthropic
  const limitado = buffer.length > MAX_BYTES ? buffer.slice(0, MAX_BYTES) : buffer;
  return limitado.toString('base64');
}

// Construye el texto de fallback con los campos guardados en BD
function construirTextoFallback(poliza, etiqueta) {
  const lineas = [`=== ${etiqueta} ===`];
  if (poliza.compania_aseguradora) lineas.push(`Compañía: ${poliza.compania_aseguradora}`);
  if (poliza.numero_poliza) lineas.push(`Nº póliza: ${poliza.numero_poliza}`);
  if (poliza.tipo) lineas.push(`Tipo: ${poliza.tipo}`);
  if (poliza.importe_anual) lineas.push(`Prima anual: ${poliza.importe_anual} €`);
  if (poliza.fecha_inicio) lineas.push(`Inicio: ${poliza.fecha_inicio}`);
  if (poliza.fecha_vencimiento) lineas.push(`Vencimiento: ${poliza.fecha_vencimiento}`);
  if (poliza.riesgos_cubiertos) lineas.push(`Riesgos cubiertos: ${poliza.riesgos_cubiertos}`);
  if (poliza.riesgos_no_cubiertos) lineas.push(`Riesgos NO cubiertos: ${poliza.riesgos_no_cubiertos}`);
  if (poliza.analisis_fortalezas) lineas.push(`Fortalezas: ${poliza.analisis_fortalezas}`);
  if (poliza.analisis_carencias) lineas.push(`Carencias: ${poliza.analisis_carencias}`);
  if (poliza.valoracion) lineas.push(`Valoración previa: ${poliza.valoracion}/10`);
  return lineas.join('\n');
}

// POST /api/comparador
router.post('/', async (req, res) => {
  const { ids, tipo } = req.body;

  if (!Array.isArray(ids) || ids.length < 2) {
    return res.status(400).json({ error: 'Se necesitan al menos 2 pólizas para comparar' });
  }
  if (!['inmuebles', 'inquilinos'].includes(tipo)) {
    return res.status(400).json({ error: 'El tipo debe ser "inmuebles" o "inquilinos"' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'La clave de API de IA no está configurada' });
  }

  const tabla = tipo === 'inmuebles' ? 'polizas' : 'polizas_inquilinos';

  // Cargar pólizas de la BD
  let polizas;
  try {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const consulta = tipo === 'inmuebles'
      ? `SELECT p.*, i.nombre AS nombre_inmueble FROM polizas p LEFT JOIN inmuebles i ON p.inmueble_id = i.id WHERE p.id IN (${placeholders})`
      : `SELECT pi.*, inq.nombre AS nombre_inquilino, i.nombre AS nombre_inmueble FROM polizas_inquilinos pi LEFT JOIN inquilinos inq ON pi.inquilino_id = inq.id LEFT JOIN inmuebles i ON inq.inmueble_id = i.id WHERE pi.id IN (${placeholders})`;
    const resultado = await pool.query(consulta, ids);
    polizas = resultado.rows;
    if (polizas.length < 2) {
      return res.status(404).json({ error: 'No se encontraron suficientes pólizas con esos IDs' });
    }
  } catch (err) {
    console.error('Error al cargar pólizas para comparar:', err.message);
    return res.status(500).json({ error: 'Error al cargar las pólizas de la base de datos' });
  }

  // Preparar los bloques de contenido para Claude
  const bloques = [];
  for (const poliza of polizas) {
    const etiqueta = `${poliza.compania_aseguradora || 'Sin compañía'} · ${poliza.numero_poliza || `ID ${poliza.id}`}`;

    if (poliza.documento_url) {
      try {
        const base64 = await descargarPdfBase64(poliza.documento_url);
        bloques.push({
          tipo: 'pdf',
          poliza,
          etiqueta,
          base64,
        });
        console.log(`PDF descargado para póliza ${poliza.id}: ${poliza.documento_url}`);
        continue;
      } catch (err) {
        console.warn(`No se pudo descargar PDF de póliza ${poliza.id}: ${err.message}. Usando texto de BD.`);
      }
    }

    // Fallback: usar texto de los campos guardados
    bloques.push({
      tipo: 'texto',
      poliza,
      etiqueta,
      texto: construirTextoFallback(poliza, etiqueta),
    });
  }

  // Construir el mensaje para Claude
  const contenido = [];

  for (const bloque of bloques) {
    contenido.push({
      type: 'text',
      text: `PÓLIZA: ${bloque.etiqueta} (ID: ${bloque.poliza.id})`,
    });
    if (bloque.tipo === 'pdf') {
      contenido.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: bloque.base64 },
      });
    } else {
      contenido.push({ type: 'text', text: bloque.texto });
    }
  }

  const prompt = `Eres un experto comparador de pólizas de seguros inmobiliarios. Analiza en profundidad las ${polizas.length} pólizas indicadas arriba.

Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional, sin markdown, sin explicaciones) con esta estructura exacta:

{
  "resumen": "párrafo ejecutivo de 2-3 frases resumiendo las diferencias principales",
  "polizas": [
    {
      "id": número_id_de_la_poliza,
      "etiqueta": "Compañía · Nº póliza",
      "compania": "nombre compañía",
      "prima_anual": número_decimal_o_null,
      "capitales": {
        "continente": número_o_null,
        "contenido": número_o_null,
        "responsabilidad_civil": número_o_null
      },
      "franquicia": "150 € por siniestro o null",
      "riesgos_cubiertos": ["cobertura 1", "cobertura 2"],
      "riesgos_no_cubiertos": ["exclusión 1", "exclusión 2"],
      "exclusiones": "descripción general de exclusiones",
      "fortalezas": "puntos fuertes de esta póliza",
      "valoracion": número_del_1_al_10
    }
  ],
  "tabla_coberturas": [
    {
      "cobertura": "Incendio",
      "valores": ["✅ 150.000 €", "❌", "⚠️ Sublímite 30.000 €"]
    }
  ],
  "analisis_propietario_inquilino": {
    "cubre_propietario": ["Incendio continente: 150.000 €", "RC propietario: 300.000 €"],
    "debe_cubrir_inquilino": ["Contenido personal", "RC inquilino", "Robo efectos personales"],
    "gaps_cobertura": ["Sin cobertura de RC inquilino", "Contenido personal no asegurado"]
  },
  "recomendacion": {
    "mejor_id": id_de_la_mejor_poliza,
    "texto": "explicación detallada de por qué esta póliza es la mejor opción"
  }
}

IMPORTANTE:
- El array "polizas" debe tener exactamente ${polizas.length} elementos, uno por cada póliza analizada, en el mismo orden
- En "capitales", extrae los importes numéricos (sin símbolo €). Si no están disponibles, usa null
- En tabla_coberturas, INCLUYE el IMPORTE contratado junto al icono cuando esté disponible (ej: "✅ 150.000 €", "⚠️ Sublímite 30.000 €"). El array "valores" debe tener exactamente ${polizas.length} elementos
- Usa ✅ si la cobertura está incluida, ❌ si no está incluida, ⚠️ si tiene limitaciones
- Los IDs deben ser los IDs numéricos exactos: ${polizas.map((p) => p.id).join(', ')}
- En "analisis_propietario_inquilino": analiza qué riesgos cubre la póliza del propietario del inmueble y qué debería cubrir por separado el inquilino con su propia póliza. Los gaps son riesgos importantes que ninguna póliza cubre
- Si no puedes determinar un dato, usa null para números o "No disponible" para texto
- Todo el texto debe estar en español`;

  contenido.push({ type: 'text', text: prompt });

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
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
        max_tokens: 8192,
        messages: [{ role: 'user', content: contenido }],
      }),
    });

    clearTimeout(temporizador);

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      console.error(`Error Anthropic comparador [${respuesta.status}]:`, cuerpo.slice(0, 500));
      let detalle = '';
      try { detalle = JSON.parse(cuerpo)?.error?.message || cuerpo.slice(0, 200); } catch { detalle = cuerpo.slice(0, 200); }
      return res.status(502).json({ error: `IA [${respuesta.status}]: ${detalle}` });
    }

    const resultado = await respuesta.json();
    const texto = (resultado.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!texto) return res.status(422).json({ error: 'La IA no devolvió ninguna respuesta de texto' });

    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      const m = texto.match(/\{[\s\S]*\}/);
      if (!m) return res.status(422).json({ error: 'No se pudo extraer la comparación estructurada' });
      try {
        datos = JSON.parse(m[0]);
      } catch {
        return res.status(422).json({ error: 'La respuesta de la IA no tiene el formato esperado' });
      }
    }

    // Enriquecer con nombre_inmueble / nombre_inquilino de la BD (la IA no lo sabe)
    if (Array.isArray(datos.polizas)) {
      datos.polizas = datos.polizas.map((p) => {
        const bdPoliza = polizas.find((bp) => bp.id === p.id || String(bp.id) === String(p.id));
        if (!bdPoliza) return p;
        const extra = { nombre_inmueble: bdPoliza.nombre_inmueble || null };
        if (bdPoliza.nombre_inquilino) extra.nombre_inquilino = bdPoliza.nombre_inquilino;
        return { ...p, ...extra };
      });
    }

    res.json(datos);
  } catch (error) {
    clearTimeout(temporizador);
    if (error.name === 'AbortError') {
      console.error('Timeout comparador (>120s)');
      return res.status(504).json({ error: 'La IA tardó demasiado. Inténtalo de nuevo o selecciona menos pólizas.' });
    }
    console.error('Error comparador:', error.message);
    res.status(500).json({ error: 'Error interno al comparar las pólizas' });
  }
});

// POST /api/comparador/renovacion
router.post('/renovacion', upload.single('documento'), async (req, res) => {
  const { poliza_id } = req.body;

  if (!poliza_id) {
    return res.status(400).json({ error: 'Se necesita el ID de la póliza actual' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Se necesita el PDF de la nueva póliza (renovación)' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'La clave de API de IA no está configurada' });
  }

  // Cargar póliza actual de BD
  let poliza;
  try {
    const resultado = await pool.query(
      `SELECT p.*, i.nombre AS nombre_inmueble FROM polizas p LEFT JOIN inmuebles i ON p.inmueble_id = i.id WHERE p.id = $1`,
      [poliza_id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Póliza no encontrada' });
    }
    poliza = resultado.rows[0];
  } catch (err) {
    console.error('Error al cargar póliza para renovación:', err.message);
    return res.status(500).json({ error: 'Error al cargar la póliza de la base de datos' });
  }

  // Preparar PDF de la póliza actual
  const contenido = [];
  const etiquetaActual = `${poliza.compania_aseguradora || 'Sin compañía'} · ${poliza.numero_poliza || `ID ${poliza.id}`}`;

  contenido.push({ type: 'text', text: `PÓLIZA ACTUAL: ${etiquetaActual} (ID: actual)` });

  if (poliza.documento_url) {
    try {
      const base64 = await descargarPdfBase64(poliza.documento_url);
      contenido.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      });
      console.log(`PDF descargado para póliza actual ${poliza.id}: ${poliza.documento_url}`);
    } catch (err) {
      console.warn(`No se pudo descargar PDF de póliza ${poliza.id}: ${err.message}. Usando texto de BD.`);
      contenido.push({ type: 'text', text: construirTextoFallback(poliza, etiquetaActual) });
    }
  } else {
    contenido.push({ type: 'text', text: construirTextoFallback(poliza, etiquetaActual) });
  }

  // Preparar PDF de la nueva póliza (subido)
  contenido.push({ type: 'text', text: 'NUEVA PÓLIZA (RENOVACIÓN) (ID: nueva)' });
  const bufferNueva = req.file.buffer;
  const limitado = bufferNueva.length > MAX_BYTES ? bufferNueva.slice(0, MAX_BYTES) : bufferNueva;
  contenido.push({
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: limitado.toString('base64') },
  });

  const prompt = `Eres un experto comparador de pólizas de seguros inmobiliarios. Analiza en profundidad las 2 pólizas indicadas arriba: la PÓLIZA ACTUAL y la NUEVA PÓLIZA (RENOVACIÓN).

Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional, sin markdown, sin explicaciones) con esta estructura exacta:

{
  "resumen": "párrafo ejecutivo de 2-3 frases resumiendo las diferencias principales entre la póliza actual y la renovación",
  "polizas": [
    {
      "id": "actual",
      "etiqueta": "Póliza actual · Compañía · Nº",
      "compania": "nombre compañía",
      "prima_anual": número_decimal_o_null,
      "capitales": {
        "continente": número_o_null,
        "contenido": número_o_null,
        "responsabilidad_civil": número_o_null
      },
      "franquicia": "150 € por siniestro o null",
      "riesgos_cubiertos": ["cobertura 1", "cobertura 2"],
      "riesgos_no_cubiertos": ["exclusión 1", "exclusión 2"],
      "exclusiones": "descripción general de exclusiones",
      "fortalezas": "puntos fuertes de esta póliza",
      "valoracion": número_del_1_al_10
    },
    {
      "id": "nueva",
      "etiqueta": "Renovación · Compañía · Nº",
      "compania": "nombre compañía",
      "prima_anual": número_decimal_o_null,
      "capitales": {
        "continente": número_o_null,
        "contenido": número_o_null,
        "responsabilidad_civil": número_o_null
      },
      "franquicia": "150 € por siniestro o null",
      "riesgos_cubiertos": ["cobertura 1", "cobertura 2"],
      "riesgos_no_cubiertos": ["exclusión 1", "exclusión 2"],
      "exclusiones": "descripción general de exclusiones",
      "fortalezas": "puntos fuertes de esta póliza",
      "valoracion": número_del_1_al_10
    }
  ],
  "tabla_coberturas": [
    {
      "cobertura": "Incendio",
      "valores": ["✅ 150.000 €", "⚠️ Sublímite 100.000 €"]
    }
  ],
  "analisis_propietario_inquilino": {
    "cubre_propietario": ["Incendio continente: 150.000 €"],
    "debe_cubrir_inquilino": ["Contenido personal", "RC inquilino"],
    "gaps_cobertura": ["Sin cobertura de RC inquilino"]
  },
  "recomendacion": {
    "mejor_id": "actual" o "nueva",
    "texto": "explicación detallada de si conviene renovar o no, destacando mejoras y empeoramientos"
  }
}

IMPORTANTE:
- El array "polizas" debe tener exactamente 2 elementos: primero la póliza actual (id: "actual"), luego la nueva (id: "nueva")
- En "capitales", extrae los importes numéricos (sin símbolo €). Si no están disponibles, usa null
- En tabla_coberturas, INCLUYE el IMPORTE contratado junto al icono cuando esté disponible (ej: "✅ 150.000 €"). El array "valores" debe tener exactamente 2 elementos
- Usa ✅ si la cobertura está incluida, ❌ si no está incluida, ⚠️ si tiene limitaciones
- Destaca especialmente qué coberturas MEJORAN en la renovación y cuáles EMPEORAN
- En "analisis_propietario_inquilino": analiza qué cubre el propietario y qué debería cubrir el inquilino por separado
- Si no puedes determinar un dato, usa null para números o "No disponible" para texto
- Todo el texto debe estar en español`;

  contenido.push({ type: 'text', text: prompt });

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const respuesta = await llamarAnthropicApi({
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
        max_tokens: 8192,
        messages: [{ role: 'user', content: contenido }],
      }),
    });

    clearTimeout(temporizador);

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      console.error(`Error Anthropic renovación [${respuesta.status}]:`, cuerpo.slice(0, 500));
      let detalle = '';
      try { detalle = JSON.parse(cuerpo)?.error?.message || cuerpo.slice(0, 200); } catch { detalle = cuerpo.slice(0, 200); }
      return res.status(502).json({ error: `IA [${respuesta.status}]: ${detalle}` });
    }

    const resultado = await respuesta.json();
    const texto = (resultado.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (!texto) return res.status(422).json({ error: 'La IA no devolvió ninguna respuesta de texto' });

    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      const m = texto.match(/\{[\s\S]*\}/);
      if (!m) return res.status(422).json({ error: 'No se pudo extraer la comparación estructurada' });
      try {
        datos = JSON.parse(m[0]);
      } catch {
        return res.status(422).json({ error: 'La respuesta de la IA no tiene el formato esperado' });
      }
    }

    // Enriquecer con nombre_inmueble
    if (Array.isArray(datos.polizas)) {
      datos.polizas = datos.polizas.map((p) => {
        if (p.id === 'actual' || String(p.id) === String(poliza.id)) {
          return { ...p, id: 'actual', nombre_inmueble: poliza.nombre_inmueble || null };
        }
        return { ...p, nombre_inmueble: poliza.nombre_inmueble || null };
      });
    }

    res.json(datos);
  } catch (error) {
    clearTimeout(temporizador);
    if (error.name === 'AbortError') {
      console.error('Timeout renovación (>120s)');
      return res.status(504).json({ error: 'La IA tardó demasiado. Inténtalo de nuevo.' });
    }
    console.error('Error renovación:', error.message);
    res.status(500).json({ error: 'Error interno al comparar la renovación' });
  }
});

module.exports = { router };
