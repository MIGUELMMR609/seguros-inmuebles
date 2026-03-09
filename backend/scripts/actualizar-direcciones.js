#!/usr/bin/env node
/**
 * actualizar-direcciones.js
 * Lee los PDFs de todas las pólizas de inmuebles que tienen documento_url
 * y actualiza el campo direccion_bien_asegurado usando la IA de Anthropic.
 *
 * Uso: node scripts/actualizar-direcciones.js
 *      node scripts/actualizar-direcciones.js --forzar   (re-procesa aunque ya tengan dirección)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const FORZAR = process.argv.includes('--forzar');

async function descargarPdfBase64(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar PDF`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const limitado = buffer.length > MAX_BYTES ? buffer.slice(0, MAX_BYTES) : buffer;
  return limitado.toString('base64');
}

async function extraerDireccion(base64) {
  const prompt = `Analiza esta póliza de seguro y extrae ÚNICAMENTE la dirección del bien asegurado.
Búscala en campos como: SITUACIÓN DEL RIESGO, UBICACIÓN DEL RIESGO, DESCRIPCIÓN DEL RIESGO, SITUADA EN, DOMICILIO DEL RIESGO.
Devuelve ÚNICAMENTE un JSON con este formato exacto (sin texto adicional):
{"direccion": "CL EJEMPLO 123 LOCAL 1 28001 MADRID"}
Si no encuentras la dirección, devuelve: {"direccion": null}`;

  const respuesta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: AbortSignal.timeout(60_000),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    throw new Error(`Anthropic [${respuesta.status}]: ${cuerpo.slice(0, 200)}`);
  }

  const resultado = await respuesta.json();
  const texto = (resultado.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    const m = texto.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No se pudo parsear la respuesta de la IA');
    datos = JSON.parse(m[0]);
  }

  return datos.direccion || null;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY no configurada');
    process.exit(1);
  }

  const { rows: polizas } = await pool.query(`
    SELECT p.id, p.numero_poliza, p.documento_url, p.direccion_bien_asegurado,
           i.nombre AS nombre_inmueble
    FROM polizas p
    LEFT JOIN inmuebles i ON p.inmueble_id = i.id
    WHERE p.documento_url IS NOT NULL
    ${FORZAR ? '' : "AND (p.direccion_bien_asegurado IS NULL OR p.direccion_bien_asegurado = '')"}
    ORDER BY p.id
  `);

  console.log(`\n📋 Pólizas a procesar: ${polizas.length}${FORZAR ? ' (modo forzar)' : ' (sin dirección)'}\n`);

  if (polizas.length === 0) {
    console.log('✅ Todas las pólizas ya tienen dirección. Usa --forzar para reprocesar.');
    await pool.end();
    return;
  }

  let ok = 0, errores = 0, sinDireccion = 0;

  for (const poliza of polizas) {
    const etiqueta = `[${poliza.id}] ${poliza.nombre_inmueble || ''} · ${poliza.numero_poliza || ''}`;
    process.stdout.write(`  ${etiqueta} ... `);

    try {
      const base64 = await descargarPdfBase64(poliza.documento_url);
      const direccion = await extraerDireccion(base64);

      if (direccion) {
        await pool.query(
          'UPDATE polizas SET direccion_bien_asegurado = $1 WHERE id = $2',
          [direccion, poliza.id]
        );
        console.log(`✅ ${direccion}`);
        ok++;
      } else {
        console.log('⚠️  No encontrada en el PDF');
        sinDireccion++;
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      errores++;
    }

    // Pausa para respetar el límite de tokens por minuto de Anthropic
    if (polizas.indexOf(poliza) < polizas.length - 1) {
      process.stdout.write('  ⏳ Esperando 70s...\n');
      await new Promise(r => setTimeout(r, 70_000));
    }
  }

  console.log(`\n📊 Resultado: ${ok} actualizadas · ${sinDireccion} sin dirección en PDF · ${errores} errores\n`);
  await pool.end();
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
