const express = require('express');
const { uploadMemoria } = require('../middleware/upload');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

const LIMITE_MB = 4;
const TIMEOUT_MS = 115_000; // 115s — por debajo del límite de Render

// POST /api/analizar-pdf - Analizar PDF de póliza con IA
router.post('/', uploadMemoria.single('documento'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo PDF' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'La clave de API de IA no está configurada (ANTHROPIC_API_KEY)' });
  }

  const tamanoMB = req.file.buffer.length / (1024 * 1024);
  if (tamanoMB > LIMITE_MB) {
    return res.status(413).json({
      error: `El PDF es demasiado grande (${tamanoMB.toFixed(1)} MB). El límite es ${LIMITE_MB} MB. Comprime el PDF antes de subirlo.`,
    });
  }

  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const base64 = req.file.buffer.toString('base64');
    // Liberar buffer de memoria lo antes posible
    req.file.buffer = null;

    const prompt = `Analiza este documento de seguro o contrato y extrae los datos relevantes.
Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional, sin markdown, sin explicaciones) con esta estructura exacta:

{
  "compania_aseguradora": "nombre de la compañía aseguradora o null",
  "numero_poliza": "número de póliza o contrato o null",
  "tipo": "tipo de seguro (vivienda/nave/local/comunidad/otros) o null",
  "fecha_inicio": "YYYY-MM-DD o null",
  "fecha_vencimiento": "YYYY-MM-DD o null",
  "importe_anual": número decimal o null,
  "importe_pago": número decimal (importe por recibo) o null,
  "periodicidad_pago": "anual/semestral/trimestral o null",
  "contacto_nombre": "nombre del agente/contacto o null",
  "contacto_telefono": "teléfono del agente o null",
  "contacto_email": "email del agente o null",
  "observaciones_ia": "notas relevantes extraídas del documento o null"
}

Si no encuentras algún dato, usa null. Las fechas deben estar en formato YYYY-MM-DD. Los importes como números sin símbolo de moneda.`;

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
        max_tokens: 1024,
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
      return res.status(502).json({ error: 'Error al comunicarse con la IA. Inténtalo de nuevo.' });
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

    res.json({ datos });
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
