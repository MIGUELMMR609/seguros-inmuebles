const express = require('express');
const { PDFDocument } = require('pdf-lib');
const { uploadMemoria } = require('../middleware/upload');
const { verificarToken } = require('../middleware/auth');
const cloudinary = require('../config/cloudinary');

const router = express.Router();
router.use(verificarToken);

const TIMEOUT_MS = 115_000;
const MAX_BYTES_ANTHROPIC = 5 * 1024 * 1024;
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
    console.log(`Contrato reducido: ${total} → ${MAX_PAGINAS} páginas (${buffer.length} → ${bytes.length} bytes)`);
    return Buffer.from(bytes);
  } catch (err) {
    console.warn('No se pudo reducir el contrato PDF, se envía completo:', err.message);
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

// POST /api/analizar-contrato
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
    const bufferParaIA = await reducirPdf(req.file.buffer);
    const base64 = bufferParaIA.toString('base64');

    const promesaUrl = subirPdfACloudinary(req.file.buffer).catch((err) => {
      console.warn('No se pudo subir contrato a Cloudinary:', err?.message);
      return null;
    });

    const prompt = `Eres un experto jurídico español en arrendamientos urbanos (LAU). Analiza este contrato y extrae todos los datos relevantes.
Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional, sin markdown, sin explicaciones) con esta estructura exacta:

{
  "nombre_inquilino": "nombre completo del PRIMER arrendatario/inquilino únicamente o null",
  "email": "email del PRIMER arrendatario únicamente o null",
  "telefono": "teléfono del PRIMER arrendatario únicamente o null",
  "otros_inquilinos": "Si hay 2 o más arrendatarios en el contrato, incluye TODOS los arrendatarios excepto el primero. Cada uno en una línea separada con este formato exacto: 'Nombre: X | Email: Y | Teléfono: Z'. Ejemplo con dos adicionales: 'Nombre: Ana López | Email: ana@mail.com | Teléfono: 600111222\nNombre: Carlos Ruiz | Email: carlos@mail.com | Teléfono: 600333444'. Si solo hay un arrendatario usa null",
  "fecha_inicio": "YYYY-MM-DD o null",
  "fecha_fin": "YYYY-MM-DD o null",
  "importe_renta": número decimal (renta mensual en euros) o null,
  "direccion_inmueble": "dirección completa del inmueble arrendado o null",
  "clausulas_principales": "resumen de las cláusulas más importantes: duración, renta, fianza, uso, etc. o null",
  "clausulas_perjudiciales": "cláusulas que perjudican al arrendador o 'Ninguna detectada'",
  "obligaciones_inquilino": "lista de obligaciones del arrendatario según el contrato o null",
  "obligaciones_propietario": "lista de obligaciones del arrendador según el contrato o null",
  "analisis_juridico": "fortalezas y debilidades jurídicas, conformidad con la LAU o null",
  "recomendaciones_contrato": "recomendaciones para mejorar el contrato en futuras renovaciones o null",
  "valoracion_contrato": número del 1 al 10 como experto jurídico o null
}

Si no encuentras algún dato, usa null. Las fechas en formato YYYY-MM-DD. Los importes como números sin símbolo de moneda.
IMPORTANTE: Si el contrato tiene varios arrendatarios, el campo "nombre_inquilino" solo lleva el nombre del primero, y "otros_inquilinos" debe incluir obligatoriamente los datos de TODOS los demás (nombre, email y teléfono de cada uno).`;

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
        max_tokens: 4096,
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
      console.error(`Error Anthropic analizar-contrato [${respuesta.status}]:`, cuerpo.slice(0, 300));
      return res.status(502).json({ error: 'Error al comunicarse con la IA. Inténtalo de nuevo.' });
    }

    const resultado = await respuesta.json();
    const texto = resultado.content?.[0]?.text;
    if (!texto) return res.status(422).json({ error: 'La IA no devolvió ninguna respuesta' });

    // Limpiar posibles delimitadores markdown ```json ... ```
    const textoLimpio = texto.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();

    let datos;
    try {
      datos = JSON.parse(textoLimpio);
    } catch {
      const m = textoLimpio.match(/\{[\s\S]*\}/);
      if (!m) {
        console.error('analizar-contrato: respuesta IA no contiene JSON. stop_reason:', resultado.stop_reason, '| texto:', textoLimpio.slice(0, 500));
        return res.status(422).json({ error: 'No se pudo extraer información estructurada del PDF' });
      }
      try {
        datos = JSON.parse(m[0]);
      } catch (parseErr) {
        console.error('analizar-contrato: JSON extraído inválido. stop_reason:', resultado.stop_reason, '|', m[0].slice(0, 300));
        return res.status(422).json({ error: 'No se pudo extraer información estructurada del PDF' });
      }
    }

    console.log('analizar-contrato — nombre_inquilino:', datos.nombre_inquilino, '| otros_inquilinos:', JSON.stringify(datos.otros_inquilinos));
    const documentoUrl = await promesaUrl;
    res.json({ datos, documento_url: documentoUrl });
  } catch (error) {
    clearTimeout(temporizador);
    if (error.name === 'AbortError') {
      console.error('Timeout analizar-contrato (>115s)');
      return res.status(504).json({ error: 'La IA tardó demasiado. Prueba con un PDF más pequeño o inténtalo de nuevo.' });
    }
    console.error('Error analizar-contrato:', error.message);
    res.status(500).json({ error: 'Error interno al analizar el contrato' });
  }
});

module.exports = router;
