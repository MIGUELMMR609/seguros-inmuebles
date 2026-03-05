require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { inicializarBaseDatos } = require('./src/config/database');
const { iniciarCronAlertas } = require('./src/cron/alertasCron');

// Rutas
const authRoutes = require('./src/routes/auth');
const inmueblesRoutes = require('./src/routes/inmuebles');
const polizasRoutes = require('./src/routes/polizas');
const inquilinosRoutes = require('./src/routes/inquilinos');
const polizasInquilinosRoutes = require('./src/routes/polizasInquilinos');
const uploadRoutes = require('./src/routes/upload');
const alertasRoutes = require('./src/routes/alertas');
const usuariosRoutes = require('./src/routes/usuarios');
const renovacionesRoutes = require('./src/routes/renovaciones');
const siniestrosRoutes = require('./src/routes/siniestros');
const contabilidadRoutes = require('./src/routes/contabilidad');
const registroEmailsRoutes = require('./src/routes/registro_emails');
const analizarPdfRoutes = require('./src/routes/analizar_pdf');
const analizarContratoRoutes = require('./src/routes/analizar_contrato');
const generarContratoRoutes = require('./src/routes/generar_contrato');

const app = express();
const PUERTO = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos subidos (PDFs, fotos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/inmuebles', inmueblesRoutes);
app.use('/api/polizas', polizasRoutes);
app.use('/api/inquilinos', inquilinosRoutes);
app.use('/api/polizas-inquilinos', polizasInquilinosRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/alertas', alertasRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/renovaciones', renovacionesRoutes);
app.use('/api/siniestros', siniestrosRoutes);
app.use('/api/contabilidad', contabilidadRoutes);
app.use('/api/registro-emails', registroEmailsRoutes);
app.use('/api/analizar-pdf', analizarPdfRoutes);
app.use('/api/analizar-contrato', analizarContratoRoutes);
app.use('/api', generarContratoRoutes);

// Servir frontend en producción
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function iniciarConReintentos(intentos = 5, espera = 3000) {
  for (let i = 1; i <= intentos; i++) {
    try {
      await inicializarBaseDatos();
      console.log('Base de datos inicializada correctamente');
      return;
    } catch (error) {
      console.error(`Error al conectar con la BD (intento ${i}/${intentos}):`, error.message);
      if (i < intentos) {
        console.log(`Reintentando en ${espera / 1000}s...`);
        await new Promise((r) => setTimeout(r, espera));
      } else {
        throw error;
      }
    }
  }
}

async function iniciar() {
  // El servidor escucha primero para que Render detecte el puerto
  app.listen(PUERTO, () => {
    console.log(`Servidor ejecutándose en el puerto ${PUERTO}`);
  });

  try {
    await iniciarConReintentos();
    iniciarCronAlertas();
    console.log('Tarea programada de alertas iniciada');
  } catch (error) {
    console.error('Error crítico al iniciar la BD tras varios intentos:', error);
    // No hacemos process.exit para que el proceso siga en pie
  }
}

iniciar();
