#!/usr/bin/env node
/**
 * backup.js — Exporta todas las tablas de la BD a un archivo JSON.
 * Hace backup de LOCAL y/o RENDER según las variables configuradas en .env:
 *   DATABASE_URL       → base de datos local
 *   DATABASE_URL_RENDER → base de datos de producción en Render
 * Guarda los archivos en: local y iCloud Drive.
 * Uso: npm run backup  (desde backend/)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const MAX_BACKUPS = 30;

// Carpetas de destino para los archivos JSON
const DESTINOS = [
  {
    nombre: 'Local',
    ruta: path.join(HOME, 'gestion-polizas', 'backups'),
  },
  {
    nombre: 'iCloud',
    ruta: path.join(HOME, 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'COPIA SEGURIDAD SEGUROS'),
  },
];

// Tablas a exportar (en orden para respetar FK en restore)
const TABLAS = [
  'usuarios',
  'inmuebles',
  'polizas',
  'historial_polizas',
  'inquilinos',
  'polizas_inquilinos',
  'contrato_renovaciones',
  'siniestros',
  'registro_emails',
];

// Orígenes de datos configurados
const ORIGENES = [
  { nombre: 'Local',  url: process.env.DATABASE_URL,        ssl: false },
  { nombre: 'Render', url: process.env.DATABASE_URL_RENDER, ssl: true  },
].filter((o) => o.url);

function limpiarBackupsAntiguos(directorio, prefijo) {
  try {
    const archivos = fs.readdirSync(directorio)
      .filter((f) => f.startsWith(prefijo) && f.endsWith('.json'))
      .map((f) => ({ nombre: f, ruta: path.join(directorio, f), mtime: fs.statSync(path.join(directorio, f)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    const aEliminar = archivos.slice(MAX_BACKUPS);
    for (const archivo of aEliminar) {
      fs.unlinkSync(archivo.ruta);
      console.log(`   🗑  Eliminado backup antiguo: ${archivo.nombre}`);
    }
  } catch (err) {
    console.warn(`   ⚠  No se pudieron limpiar backups antiguos: ${err.message}`);
  }
}

async function backupOrigen(origen) {
  const pool = new Pool({
    connectionString: origen.url,
    ...(origen.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  console.log(`\n📦 Backup de ${origen.nombre}...`);
  console.log(`   Servidor: ${origen.url.replace(/:\/\/.*@/, '://***@')}`);

  const cliente = await pool.connect();
  const datos = {};
  const resumen = {};

  try {
    for (const tabla of TABLAS) {
      try {
        const res = await cliente.query(`SELECT * FROM ${tabla} ORDER BY id`);
        datos[tabla] = res.rows;
        resumen[tabla] = res.rows.length;
        console.log(`   ✓ ${tabla.padEnd(25)} ${res.rows.length} registros`);
      } catch (err) {
        console.warn(`   ⚠ ${tabla}: no encontrada (${err.message})`);
        datos[tabla] = [];
        resumen[tabla] = 0;
      }
    }

    const fecha = new Date().toISOString().slice(0, 10);
    const hora = new Date().toTimeString().slice(0, 5).replace(':', 'h');
    const prefijo = `backup_${origen.nombre.toLowerCase()}_`;
    const nombreArchivo = `${prefijo}${fecha}_${hora}.json`;

    const contenido = {
      meta: {
        fecha: new Date().toISOString(),
        origen: origen.nombre,
        tablas: TABLAS,
        version: '1.0',
      },
      datos,
    };
    const json = JSON.stringify(contenido, null, 2);

    console.log('\n💾 Guardando en destinos...');
    const guardados = [];

    for (const destino of DESTINOS) {
      try {
        fs.mkdirSync(destino.ruta, { recursive: true });
        const rutaArchivo = path.join(destino.ruta, nombreArchivo);
        fs.writeFileSync(rutaArchivo, json, 'utf8');
        const tamano = (fs.statSync(rutaArchivo).size / 1024).toFixed(1);
        limpiarBackupsAntiguos(destino.ruta, prefijo);
        console.log(`   ✅ ${destino.nombre}: ${rutaArchivo}`);
        guardados.push({ destino: destino.nombre, tamano });
      } catch (err) {
        console.warn(`   ⚠  No se pudo guardar en ${destino.nombre}: ${err.message}`);
      }
    }

    if (guardados.length === 0) {
      throw new Error(`No se pudo guardar el backup de ${origen.nombre} en ningún destino`);
    }

    // Guardar en la tabla backups de la BD (solo si hay tabla backups)
    try {
      const tamanyo = Buffer.byteLength(json, 'utf8');
      const conteo = {
        inmuebles: resumen.inmuebles || 0,
        polizas: resumen.polizas || 0,
        inquilinos: resumen.inquilinos || 0,
        siniestros: resumen.siniestros || 0,
      };
      await cliente.query(
        `INSERT INTO backups (nombre_archivo, tamanyo, registros_json, conteo_registros)
         VALUES ($1, $2, $3, $4)`,
        [nombreArchivo, tamanyo, json, JSON.stringify(conteo)]
      );
      await cliente.query(
        `DELETE FROM backups WHERE id NOT IN (
           SELECT id FROM backups ORDER BY created_at DESC LIMIT 10
         )`
      );
      console.log(`   ✅ Guardado en tabla backups de ${origen.nombre}`);
    } catch {
      // La tabla backups puede no existir en local — se ignora
    }

    const total = Object.values(resumen).reduce((a, b) => a + b, 0);
    console.log(`\n📊 Total: ${total} registros · ${guardados[0]?.tamano} KB`);

  } finally {
    cliente.release();
    await pool.end();
  }
}

async function main() {
  if (ORIGENES.length === 0) {
    console.error('❌ No hay ninguna DATABASE_URL configurada en .env');
    process.exit(1);
  }

  for (const origen of ORIGENES) {
    await backupOrigen(origen);
  }

  console.log('\n✅ Backup completado.\n');
}

main().catch((err) => {
  console.error('\n❌ Error durante el backup:', err.message);
  process.exit(1);
});
