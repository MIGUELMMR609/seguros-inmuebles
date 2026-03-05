// Llama a la API de Anthropic directamente desde el navegador.
// VITE_ANTHROPIC_API_KEY se incrusta en el bundle en tiempo de build.
// Usar solo en aplicaciones privadas/internas con acceso restringido.

const MODELO = 'claude-haiku-4-5-20251001';
const LIMITE_MB = 4;

function archivoABase64(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(lector.result.split(',')[1]);
    lector.onerror = () => reject(new Error('Error al leer el archivo'));
    lector.readAsDataURL(archivo);
  });
}

async function llamarAnthropicConPdf(archivo, prompt) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('La clave de API de IA no está configurada. Contacta con el administrador.');
  }

  if (archivo.size > LIMITE_MB * 1024 * 1024) {
    throw new Error(`El PDF es demasiado grande (${(archivo.size / 1024 / 1024).toFixed(1)} MB). El límite es ${LIMITE_MB} MB.`);
  }

  const base64 = await archivoABase64(archivo);

  const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text().catch(() => '');
    throw new Error(`Error de la IA (${respuesta.status}). Inténtalo de nuevo.`);
  }

  const resultado = await respuesta.json();
  const texto = resultado.content?.[0]?.text;
  if (!texto) throw new Error('La IA no devolvió ninguna respuesta');

  try {
    return JSON.parse(texto);
  } catch {
    const coincidencia = texto.match(/\{[\s\S]*\}/);
    if (!coincidencia) throw new Error('No se pudo extraer información estructurada del PDF');
    return JSON.parse(coincidencia[0]);
  }
}

// --- Analizar póliza de seguro ---
const PROMPT_POLIZA = `Analiza este documento de seguro o contrato y extrae los datos relevantes.
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

export async function analizarPolizaPdf(archivo) {
  return llamarAnthropicConPdf(archivo, PROMPT_POLIZA);
}

// --- Analizar contrato de arrendamiento ---
const PROMPT_CONTRATO = `Analiza este contrato de arrendamiento/alquiler y extrae los datos relevantes.
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

Si no encuentras algún dato, usa null. Las fechas deben estar en formato YYYY-MM-DD. Los importes como números sin símbolo de moneda.`;

export async function analizarContratoPdf(archivo) {
  return llamarAnthropicConPdf(archivo, PROMPT_CONTRATO);
}
