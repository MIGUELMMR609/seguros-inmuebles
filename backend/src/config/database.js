const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function inicializarBaseDatos() {
  const cliente = await pool.connect();
  try {
    // Tablas base
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol VARCHAR(50) DEFAULT 'usuario',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inmuebles (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        direccion TEXT,
        tipo VARCHAR(50) DEFAULT 'piso',
        notas TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS polizas (
        id SERIAL PRIMARY KEY,
        inmueble_id INTEGER REFERENCES inmuebles(id) ON DELETE CASCADE,
        tipo VARCHAR(100) DEFAULT 'vivienda',
        compania_aseguradora VARCHAR(255),
        numero_poliza VARCHAR(255),
        fecha_inicio DATE,
        fecha_vencimiento DATE,
        importe_anual DECIMAL(10,2),
        notas TEXT,
        documento_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inquilinos (
        id SERIAL PRIMARY KEY,
        inmueble_id INTEGER REFERENCES inmuebles(id) ON DELETE CASCADE,
        nombre VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        telefono VARCHAR(50),
        fecha_inicio_contrato DATE,
        fecha_fin_contrato DATE,
        notas TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS polizas_inquilinos (
        id SERIAL PRIMARY KEY,
        inquilino_id INTEGER REFERENCES inquilinos(id) ON DELETE CASCADE,
        compania_aseguradora VARCHAR(255),
        numero_poliza VARCHAR(255),
        fecha_inicio DATE,
        fecha_vencimiento DATE,
        importe_anual DECIMAL(10,2),
        notas TEXT,
        documento_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Eliminar CHECK constraints antiguos en tipo (para permitir los nuevos valores)
    await cliente.query(`
      ALTER TABLE polizas DROP CONSTRAINT IF EXISTS polizas_tipo_check;
      ALTER TABLE inmuebles DROP CONSTRAINT IF EXISTS inmuebles_tipo_check;
    `);

    // Nuevas columnas en polizas (idempotente con IF NOT EXISTS)
    await cliente.query(`
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS contacto_nombre VARCHAR(255);
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS contacto_telefono VARCHAR(50);
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS contacto_email VARCHAR(255);
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS periodicidad_pago VARCHAR(50) DEFAULT 'anual';
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS importe_pago DECIMAL(10,2);
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS fecha_proximo_pago DATE;
    `);

    // Columnas de análisis IA experto en pólizas
    await cliente.query(`
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS riesgos_cubiertos TEXT;
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS riesgos_no_cubiertos TEXT;
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS analisis_fortalezas TEXT;
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS analisis_carencias TEXT;
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS valoracion NUMERIC(3,1);
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS como_complementar TEXT;
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS comparador_mercado JSONB;
      ALTER TABLE polizas ADD COLUMN IF NOT EXISTS fecha_ultimo_analisis TIMESTAMP;
    `);

    // Tabla historial de renovaciones
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS historial_polizas (
        id SERIAL PRIMARY KEY,
        poliza_id INTEGER REFERENCES polizas(id) ON DELETE CASCADE,
        fecha_inicio DATE,
        fecha_vencimiento DATE,
        importe DECIMAL(10,2),
        notas TEXT,
        fecha_renovacion TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tabla siniestros
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS siniestros (
        id SERIAL PRIMARY KEY,
        poliza_id INTEGER REFERENCES polizas(id) ON DELETE CASCADE,
        fecha_apertura DATE NOT NULL DEFAULT CURRENT_DATE,
        motivo TEXT,
        numero_siniestro VARCHAR(255),
        persona_contacto VARCHAR(255),
        llamadas JSONB DEFAULT '[]',
        fotos JSONB DEFAULT '[]',
        estado VARCHAR(50) DEFAULT 'abierto',
        fecha_cierre DATE,
        notas TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Columnas adicionales siniestros (migración)
    await cliente.query(`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS compania_aseguradora VARCHAR(255)`);
    await cliente.query(`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS contacto_nombre VARCHAR(255)`);
    await cliente.query(`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS contacto_telefono VARCHAR(50)`);
    await cliente.query(`ALTER TABLE siniestros ADD COLUMN IF NOT EXISTS contacto_email VARCHAR(255)`);

    // Tabla registro de emails enviados
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS registro_emails (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(100) NOT NULL,
        destinatario_email VARCHAR(255),
        destinatario_tipo VARCHAR(50),
        poliza_id INTEGER,
        inquilino_id INTEGER,
        fecha_envio TIMESTAMP DEFAULT NOW(),
        estado VARCHAR(20) DEFAULT 'enviado',
        mensaje_error TEXT
      );
    `);

    // Nuevas columnas en inquilinos (migración)
    await cliente.query(`
      ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS importe_renta NUMERIC(10,2);
      ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS documento_url VARCHAR(500);
      ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS observaciones_ia TEXT;
      ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'activo';
      ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS fecha_finalizacion DATE;
      ALTER TABLE inquilinos ADD COLUMN IF NOT EXISTS motivo_finalizacion TEXT;
    `);

    // Actualizar inquilinos existentes sin estado
    await cliente.query(`UPDATE inquilinos SET estado = 'activo' WHERE estado IS NULL`);

    // Tabla de renovaciones de contrato de inquilino
    await cliente.query(`
      CREATE TABLE IF NOT EXISTS contrato_renovaciones (
        id SERIAL PRIMARY KEY,
        inquilino_id INTEGER REFERENCES inquilinos(id) ON DELETE CASCADE,
        fecha_inicio DATE,
        fecha_fin DATE,
        importe NUMERIC(10,2),
        notas TEXT,
        fecha_renovacion TIMESTAMP DEFAULT NOW()
      );
    `);

    // Usuario admin por defecto
    const bcrypt = require('bcryptjs');
    const usuarioExistente = await cliente.query(
      'SELECT id FROM usuarios WHERE email = $1',
      ['admin@seguros.com']
    );

    if (usuarioExistente.rows.length === 0) {
      const passwordHash = await bcrypt.hash('Admin1234!', 10);
      await cliente.query(
        'INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)',
        ['Administrador', 'admin@seguros.com', passwordHash, 'admin']
      );
      console.log('Usuario admin creado: admin@seguros.com / Admin1234!');
    }
  } finally {
    cliente.release();
  }
}

module.exports = { pool, inicializarBaseDatos };
