#!/usr/bin/env node
/**
 * backup.js — Exporta todas las tablas de la BD de producción a un archivo JSON.
 * Uso: npm run backup  (desde backend/)
 *      npm run backup -- --output /ruta/personalizada
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Carpeta de destino (~/gestion-polizas/backups/)
const BACKUP_DIR = path.join(require('os').homedir(), 'gestion-polizas', 'backups');

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

    // Crear directorio si no existe
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const fecha = new Date().toISOString().slice(0, 10);
    const hora = new Date().toTimeString().slice(0, 5).replace(':', 'h');
    const nombreArchivo = `backup_${fecha}_${hora}.json`;
    const rutaArchivo = path.join(BACKUP_DIR, nombreArchivo);

    const contenido = {
      meta: {
        fecha: new Date().toISOString(),
        tablas: TABLAS,
        version: '1.0',
      },
      datos,
    };

    fs.writeFileSync(rutaArchivo, JSON.stringify(contenido, null, 2), 'utf8');

    const tamano = (fs.statSync(rutaArchivo).size / 1024).toFixed(1);

    console.log('\n✅ Backup completado:');
    console.log(`   Archivo : ${rutaArchivo}`);
    console.log(`   Tamaño  : ${tamano} KB`);
    console.log('\n📊 Resumen:');
    const total = Object.values(resumen).reduce((a, b) => a + b, 0);
    for (const [tabla, cantidad] of Object.entries(resumen)) {
      if (cantidad > 0) console.log(`   ${tabla.padEnd(25)} ${cantidad}`);
    }
    console.log(`   ${'TOTAL'.padEnd(25)} ${total} registros\n`);

  } finally {
    cliente.release();
    await pool.end();
  }
}

backup().catch((err) => {
  console.error('\n❌ Error durante el backup:', err.message);
  process.exit(1);
});
