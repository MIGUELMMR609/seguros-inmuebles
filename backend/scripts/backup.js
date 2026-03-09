#!/usr/bin/env node
/**
 * backup.js — Exporta todas las tablas de la BD de producción a un archivo JSON.
 * Guarda en DOS ubicaciones: local y iCloud Drive.
 * Uso: npm run backup  (desde backend/)
 *      npm run backup -- --output /ruta/personalizada
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const MAX_BACKUPS = 30;

// Carpetas de destino
const DESTINOS = [
  {
    nombre: 'Local',
    ruta: path.join(HOME, 'gestion-polizas', 'backups'),
  },
  {
    nombre: 'iCloud',
    ruta: path.join(HOME, 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Backups-Seguros'),
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

function limpiarBackupsAntiguos(directorio) {
  try {
    const archivos = fs.readdirSync(directorio)
      .filter((f) => f.startsWith('backup_') && f.endsWith('.json'))
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

async function backup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('\n📦 Iniciando backup de la base de datos...');
  console.log(`   Servidor: ${process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@') || '(no definido)'}`);

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
    const nombreArchivo = `backup_${fecha}_${hora}.json`;

    const contenido = {
      meta: {
        fecha: new Date().toISOString(),
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
        limpiarBackupsAntiguos(destino.ruta);
        console.log(`   ✅ Backup guardado en ${destino.nombre}: ${rutaArchivo}`);
        guardados.push({ destino: destino.nombre, ruta: rutaArchivo, tamano });
      } catch (err) {
        console.warn(`   ⚠  No se pudo guardar en ${destino.nombre}: ${err.message}`);
      }
    }

    if (guardados.length === 0) {
      throw new Error('No se pudo guardar el backup en ningún destino');
    }

    console.log('\n📊 Resumen de registros:');
    const total = Object.values(resumen).reduce((a, b) => a + b, 0);
    for (const [tabla, cantidad] of Object.entries(resumen)) {
      if (cantidad > 0) console.log(`   ${tabla.padEnd(25)} ${cantidad}`);
    }
    console.log(`   ${'TOTAL'.padEnd(25)} ${total} registros`);
    console.log(`   ${'Tamaño'.padEnd(25)} ${guardados[0]?.tamano} KB\n`);

  } finally {
    cliente.release();
    await pool.end();
  }
}

backup().catch((err) => {
  console.error('\n❌ Error durante el backup:', err.message);
  process.exit(1);
});
