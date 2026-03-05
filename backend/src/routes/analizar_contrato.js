const express = require('express');
const { uploadMemoria } = require('../middleware/upload');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// POST /api/analizar-contrato - Analizar PDF de contrato de arrendamiento con IA
router.post('/', uploadMemoria.single('documento'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo PDF' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'La clave de API de IA no está configurada (ANTHROPIC_API_KEY)' });
  }

  try {
    const base64 = req.file.buffer.toString('base64');

    const prompt = `Analiza este contrato de arrendamiento/alquiler y extrae los datos relevantes.
Devuelve ÚNICAMENTE un objeto JSON válido (sin texto adicional, sin markdown, sin explicaciones) con esta estructura exacta:

{
  "nombre_inquilino": "nombre completo del arrendatario/inquilino o null",
  "email": "email del arrendatario o null",
  "telefono": "teléfono del arrendatario o null",
  "fecha_inicio": "YYYY-MM-DD o null",
  "fecha_fin": "YYYY-MM-DD o null",
  "importe_renta": número decimal (renta mensual en euros) o null,
  "direccion_inmueble": "dirección completa del inmueble arrendado o null",
  "observaciones_ia": "lista de cláusulas relevantes que perjudican al arrendador, condiciones especiales, penalizaciones, obligaciones del arrendatario o null"
}

Si no encuentras algún dato, usa null. Las fechas deben estar en formato YYYY-MM-DD. Los importes como números sin símbolo de moneda. En observaciones_ia incluye solo información relevante para el arrendador.`;

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
      console.error('Error de la API de IA al analizar contrato:', errorBody);
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
    console.error('Error al analizar contrato con IA:', error.message || error);
    res.status(500).json({ error: 'Error interno al analizar el contrato' });
  }
});

module.exports = router;
