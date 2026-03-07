#!/usr/bin/env node
/**
 * restore.js — Restaura la BD desde un archivo de backup JSON.
 * Uso: npm run restore -- --file ~/gestion-polizas/backups/backup_2026-03-07_10h30.json
 *
 * ADVERTENCIA: Borra y reinserta todos los datos de las tablas incluidas en el backup.
 * Ejecutar solo en caso de emergencia y con la BD detenida o en mantenimiento.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Tablas en orden inverso para eliminar FK primero
const TABLAS_BORRADO = [
  'registro_emails',
  'siniestros',
  'contrato_renovaciones',
  'polizas_inquilinos',
  'historial_polizas',
  'inquilinos',
  'polizas',
  'inmuebles',
  'usuarios',
];

function pregunta(rl, texto) {
  return new Promise((resolve) => rl.question(texto, resolve));
}

async function restore() {
  // Leer argumento --file
  const args = process.argv.slice(2);
  const idxFile = args.indexOf('--file');
  if (idxFile === -1 || !args[idxFile + 1]) {
    console.error('❌ Debes indicar el archivo: npm run restore -- --file <ruta_backup.json>');
    process.exit(1);
  }

  const rutaBackup = path.resolve(args[idxFile + 1].replace(/^~/, require('os').homedir()));

  if (!fs.existsSync(rutaBackup)) {
    console.error(`❌ Archivo no encontrado: ${rutaBackup}`);
    process.exit(1);
  }

  const contenido = JSON.parse(fs.readFileSync(rutaBackup, 'utf8'));
  const { meta, datos } = contenido;

  console.log('\n⚠️  RESTAURACIÓN DE BASE DE DATOS');
  console.log(`   Archivo : ${rutaBackup}`);
  console.log(`   Fecha   : ${meta.fecha}`);
  console.log(`   Servidor: ${process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@') || '(no definido)'}`);
  console.log('\n   Tablas que se restaurarán:');
  for (const tabla of Object.keys(datos)) {
    console.log(`     • ${tabla}: ${datos[tabla].length} registros`);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const confirmacion = await pregunta(rl, '\n⚠️  Esto BORRARÁ y reemplazará los datos actuales. Escribe "RESTAURAR" para confirmar: ');
  rl.close();

  if (confirmacion.trim() !== 'RESTAURAR') {
    console.log('\n❌ Restauración cancelada.');
    process.exit(0);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    // Deshabilitar FK temporalmente
    await cliente.query('SET session_replication_role = replica');

    // Borrar en orden inverso
    for (const tabla of TABLAS_BORRADO) {
      if (datos[tabla] !== undefined) {
        await cliente.query(`DELETE FROM ${tabla}`);
        await cliente.query(`ALTER SEQUENCE IF EXISTS ${tabla}_id_seq RESTART WITH 1`);
      }
    }

    // Restaurar en orden normal
    let totalInsertados = 0;
    for (const tabla of Object.keys(datos)) {
      const filas = datos[tabla];
      if (!filas || filas.length === 0) continue;

      const columnas = Object.keys(filas[0]);
      for (const fila of filas) {
        const valores = columnas.map((c) => fila[c]);
        const placeholders = columnas.map((_, i) => `$${i + 1}`).join(', ');
        await cliente.query(
          `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
          valores
        );
        totalInsertados++;
      }

      // Actualizar secuencia al máximo id
      await cliente.query(`
        SELECT setval('${tabla}_id_seq', COALESCE((SELECT MAX(id) FROM ${tabla}), 1))
      `).catch(() => {}); // Ignorar si no hay secuencia

      console.log(`   ✓ ${tabla.padEnd(25)} ${filas.length} registros`);
    }

    // Restaurar FK
    await cliente.query('SET session_replication_role = DEFAULT');
    await cliente.query('COMMIT');

    console.log(`\n✅ Restauración completada: ${totalInsertados} registros insertados.\n`);

  } catch (err) {
    await cliente.query('ROLLBACK');
    await cliente.query('SET session_replication_role = DEFAULT');
    console.error('\n❌ Error durante la restauración, se ha revertido todo:', err.message);
    process.exit(1);
  } finally {
    cliente.release();
    await pool.end();
  }
}

restore().catch((err) => {
  console.error('\n❌ Error inesperado:', err.message);
  process.exit(1);
});
