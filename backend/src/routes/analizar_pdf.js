const express = require('express');
const { PDFDocument } = require('pdf-lib');
const { uploadMemoria } = require('../middleware/upload');
const { verificarToken } = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');

const router = express.Router();
router.use(verificarToken);

const TIMEOUT_MS = 115_000;
const MAX_BYTES_ANTHROPIC = 5 * 1024 * 1024; // 5 MB
const MAX_PAGINAS = 10;

async function reducirPdf(buffer) {
  if (buffer.length <= MAX_BYTES_ANTHROPIC) return buffer;
  try {
    const pdfOrig = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const total = pdfOrig.getPageCount();
    if (total <= MAX_PAGINAS) return buffer;
    const pdfNuevo = await PDFDocument.create();
    const indices = Array.from({ length: MAX_PAGINAS }, (_, i) => i);
    const paginas = await pdfNuevo.copyPages(pdfOrig, indices);
    paginas.forEach((p) => pdfNuevo.addPage(p));
    const bytes = await pdfNuevo.save();
    console.log(`PDF reducido: ${total} → ${MAX_PAGINAS} páginas (${buffer.length} → ${bytes.length} bytes)`);
    return Buffer.from(bytes);
  } catch (err) {
    console.warn('No se pudo reducir el PDF, se envía completo:', err.message);
    return buffer;
  }
}

function subirPdfACloudinary(buffer) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: 'polizas-seguros', resource_type: 'raw', type: 'upload', access_mode: 'public', format: 'pdf' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    ).end(buffer);
  });
}

// POST /api/analizar-pdf
router.post('/', uploadMemoria.single('documento'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo PDF' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'La clave de API de IA no está configurada (ANTHROPIC_API_KEY)' });
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    // Reducir si supera 5 MB (primeras 10 páginas)
    const bufferParaIA = await reducirPdf(req.file.buffer);
    const base64 = bufferParaIA.toString('base64');

    // Subir el PDF original a Cloudinary en paralelo
    const promesaUrl = subirPdfACloudinary(req.file.buffer).catch((err) => {
      console.warn('No se pudo subir PDF a Cloudinary:', err?.message);
      return null;
    });

    const prompt = `Analiza este documento de póliza de seguro de inmueble y extrae toda la información relevante.
Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional, sin markdown, sin explicaciones) con esta estructura exacta:

{
  "compania_aseguradora": "nombre de la compañía aseguradora o null",
  "numero_poliza": "número de póliza o contrato o null",
  "tipo": "tipo de seguro (vivienda/nave/local/comunidad/otros) o null",
  "fecha_inicio": "YYYY-MM-DD o null",
  "fecha_vencimiento": "YYYY-MM-DD o null",
  "importe_anual": número decimal o null,
  "importe_pago": número decimal (importe por recibo/fraccionado) o null,
  "periodicidad_pago": "anual/semestral/trimestral o null",
  "contacto_nombre": "nombre del agente o mediador o null",
  "contacto_telefono": "teléfono del agente o null",
  "contacto_email": "email del agente o null",
  "riesgos_cubiertos": "descripción de las principales coberturas y garantías incluidas en la póliza o null",
  "riesgos_no_cubiertos": "descripción de las exclusiones y riesgos no cubiertos mencionados o null",
  "analisis_fortalezas": "puntos fuertes y aspectos destacables de esta póliza o null",
  "analisis_carencias": "carencias, limitaciones o aspectos a mejorar detectados o null",
  "como_complementar": "recomendaciones para completar o mejorar la cobertura actual o null",
  "direccion_bien_asegurado": "dirección completa del bien asegurado (calle, número, piso, ciudad) o null"
}

Si no encuentras algún dato, usa null. Las fechas en formato YYYY-MM-DD. Los importes como números sin símbolo de moneda. Los campos de análisis deben ser texto descriptivo en español.`;

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
      console.error(`Error Anthropic analizar-pdf [${respuesta.status}]:`, cuerpo.slice(0, 300));
      let detalle = '';
      try { detalle = JSON.parse(cuerpo)?.error?.message || cuerpo.slice(0, 200); } catch { detalle = cuerpo.slice(0, 200); }
      return res.status(502).json({ error: `IA [${respuesta.status}]: ${detalle}` });
    }

    const resultado = await respuesta.json();
    const texto = resultado.content?.[0]?.text;
    if (!texto) return res.status(422).json({ error: 'La IA no devolvió ninguna respuesta' });

    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      const m = texto.match(/\{[\s\S]*\}/);
      if (!m) return res.status(422).json({ error: 'No se pudo extraer información estructurada del PDF' });
      datos = JSON.parse(m[0]);
    }

    const documentoUrl = await promesaUrl;
    res.json({ datos, documento_url: documentoUrl });
  } catch (error) {
    clearTimeout(temporizador);
    if (error.name === 'AbortError') {
      console.error('Timeout analizar-pdf (>115s)');
      return res.status(504).json({ error: 'La IA tardó demasiado. Prueba con un PDF más pequeño o inténtalo de nuevo.' });
    }
    console.error('Error analizar-pdf:', error.message);
    res.status(500).json({ error: 'Error interno al analizar el PDF' });
  }
});

module.exports = router;
