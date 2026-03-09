const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

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
    const resultado = await pool.query(
      `SELECT * FROM ${tabla} WHERE id IN (${placeholders})`,
      ids
    );
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

  const prompt = `Analiza y compara en profundidad las ${polizas.length} pólizas de seguro indicadas arriba.

Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional, sin markdown, sin explicaciones) con esta estructura exacta:

{
  "resumen": "párrafo ejecutivo de 2-3 frases resumiendo las diferencias principales",
  "polizas": [
    {
      "id": número_id_de_la_poliza,
      "etiqueta": "Compañía · Nº póliza",
      "compania": "nombre compañía",
      "prima_anual": número_decimal_o_null,
      "capital_asegurado": "descripción del capital o null",
      "franquicia": "descripción de la franquicia o null",
      "riesgos_cubiertos": ["cobertura 1", "cobertura 2"],
      "riesgos_no_cubiertos": ["exclusión 1", "exclusión 2"],
      "exclusiones": "descripción general de exclusiones",
      "fortalezas": "puntos fuertes de esta póliza",
      "valoracion": número_del_1_al_10
    }
  ],
  "tabla_coberturas": [
    { "cobertura": "nombre de la cobertura", "valores": ["✅", "❌", "⚠️"] }
  ],
  "recomendacion": {
    "mejor_id": id_de_la_mejor_poliza,
    "texto": "explicación detallada de por qué esta póliza es la mejor opción"
  }
}

IMPORTANTE:
- El array "polizas" debe tener exactamente ${polizas.length} elementos, uno por cada póliza analizada, en el mismo orden
- El array "valores" en tabla_coberturas debe tener exactamente ${polizas.length} elementos (uno por póliza, en el mismo orden)
- Usa ✅ si la cobertura está completamente incluida, ❌ si no está incluida, ⚠️ si está incluida con limitaciones
- Los IDs deben ser los IDs numéricos exactos de cada póliza: ${polizas.map((p) => p.id).join(', ')}
- Si no puedes determinar un dato, usa null para números o "No disponible" para texto
- Todo el texto debe estar en español`;

  contenido.push({ type: 'text', text: prompt });

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
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
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        messages: [{ role: 'user', content: contenido }],
      }),
    });

    clearTimeout(temporizador);

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      console.error(`Error Anthropic comparador [${respuesta.status}]:`, cuerpo.slice(0, 500));
      return res.status(502).json({ error: 'Error al comunicarse con la IA. Inténtalo de nuevo.' });
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

module.exports = { router };
