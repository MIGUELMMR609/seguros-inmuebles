const express = require('express');
const { uploadMemoria } = require('../middleware/upload');
const { verificarToken } = require('../middleware/auth');
const { subirACloudinary } = require('./upload');
const { llamarAnthropicApi } = require('../utils/anthropic');
const { reducirPdf } = require('../utils/pdf');

const router = express.Router();
router.use(verificarToken);

const TIMEOUT_MS = 115_000;

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
    const promesaUrl = subirACloudinary(req.file.buffer).catch((err) => {
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
  "direccion_bien_asegurado": "dirección completa del bien asegurado: búscala en campos como SITUACIÓN DEL RIESGO, UBICACIÓN DEL RIESGO, DESCRIPCIÓN DEL RIESGO, SITUADA EN, DOMICILIO DEL RIESGO. Extrae la dirección completa con calle, número, piso/local, código postal y ciudad. Ejemplo: CL SANTA ENGRACIA 136 LOCAL 1 28003 MADRID. Si no aparece, null",

  "capital_continente": número decimal (capital asegurado continente/edificio) o null,
  "capital_contenido": número decimal (capital asegurado contenido / mobiliario doméstico) o null,
  "capital_mercancias_max": número decimal (mercancías/existencias capital máximo) o null,
  "capital_mercancias_promedio": número decimal (mercancías/existencias capital promedio) o null,
  "capital_maquinaria_mobiliario": número decimal (maquinaria y mobiliario) o null,
  "capital_rc_general": número decimal (RC general / explotación) o null,
  "capital_defensa_juridica": número decimal (defensa jurídica) o null,
  "capital_robo_caja_fuerte": número decimal (robo de dinero en caja fuerte) o null,
  "capital_perdida_alquileres": número decimal (pérdida de alquileres o traslado de contenido) o null,
  "capital_danos_agua": número decimal (daños por agua) o null,
  "capital_robo": número decimal (robo) o null,
  "capital_danos_electricos": número decimal (daños eléctricos) o null,
  "capital_fenomenos_atmosfericos": número decimal (fenómenos atmosféricos / climatológicos) o null,
  "capital_rc_propietario": número decimal (responsabilidad civil del propietario) o null,

  "cob_no_perdida_explotacion": true si la pérdida de explotación aparece como NO contratada o excluida, false en caso contrario,
  "cob_no_averia_maquinaria": true si la avería de maquinaria NO está contratada, false en caso contrario,
  "cob_no_rc_productos": true si la RC de productos NO está contratada, false en caso contrario,
  "cob_no_todo_riesgo": true si "todo riesgo accidental" NO está contratado, false en caso contrario,
  "cob_no_danos_inmueble": true si "daños al inmueble alquilado" NO está contratado, false en caso contrario,
  "cob_no_danos_esteticos": true si los "daños estéticos" NO están contratados, false en caso contrario,
  "cob_no_rotura_cristales": true si la "rotura de cristales" NO está contratada, false en caso contrario,
  "cob_no_transporte": true si la cobertura de transporte NO está contratada, false en caso contrario,

  "franquicias": "texto libre con todas las franquicias aplicables (ej. 'Robo 150 €, Daños por agua 90 €, Rotura de cristales sin franquicia'). Si no aparecen, null",

  "tomador_cif_nif": "CIF o NIF del tomador de la póliza o null",
  "tomador_telefono": "teléfono del tomador o null",
  "tomador_email": "email del tomador o null",
  "tomador_banco_domiciliacion": "entidad bancaria o IBAN donde se domicilia el recibo o null"
}

Si no encuentras algún dato, usa null (o false para los booleanos de coberturas NO contratadas si no hay mención explícita). Las fechas en formato YYYY-MM-DD. Los importes como números sin símbolo de moneda ni separadores de miles (usa punto como separador decimal). Los campos de análisis deben ser texto descriptivo en español.`;

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
