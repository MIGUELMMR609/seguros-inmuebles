const express = require('express');
const { uploadMemoria } = require('../middleware/upload');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// POST /api/analizar-pdf - Analizar PDF de póliza/contrato con IA
router.post('/', uploadMemoria.single('documento'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo PDF' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'La clave de API de IA no está configurada (ANTHROPIC_API_KEY)' });
  }

  try {
    const base64 = req.file.buffer.toString('base64');

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
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!respuesta.ok) {
      const errorBody = await respuesta.text();
      console.error('Error de la API de IA al analizar PDF:', errorBody);
      return res.status(502).json({ error: 'Error al comunicarse con la IA. Inténtalo de nuevo.' });
    }

    const resultado = await respuesta.json();

    if (!resultado.content || resultado.content.length === 0) {
      return res.status(422).json({ error: 'La IA no devolvió ninguna respuesta' });
    }

    const texto = resultado.content[0].text;

    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      const coincidencia = texto.match(/\{[\s\S]*\}/);
      if (!coincidencia) {
        return res.status(422).json({ error: 'No se pudo extraer información estructurada del PDF' });
      }
      try {
        datos = JSON.parse(coincidencia[0]);
      } catch {
        return res.status(422).json({ error: 'La respuesta de la IA no es un JSON válido' });
      }
    }

    res.json({ datos });
  } catch (error) {
    console.error('Error al analizar PDF con IA:', error.message || error);
    res.status(500).json({ error: 'Error interno al analizar el PDF' });
  }
});

module.exports = router;
