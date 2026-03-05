const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function calcularFechasPagoEnAnio(fechaBase, periodicidad, anio) {
  const mesesIntervalo = periodicidad === 'trimestral' ? 3 : periodicidad === 'semestral' ? 6 : 12;
  const fechas = [];

  // Partir desde la fecha base y desplazarse para encontrar pagos en el año
  let fecha = new Date(fechaBase);
  fecha.setHours(12, 0, 0, 0); // Normalizar hora

  // Ir al primer pago igual o anterior al inicio del año target
  const inicioAnio = new Date(anio, 0, 1);
  while (fecha >= inicioAnio) {
    fecha.setMonth(fecha.getMonth() - mesesIntervalo);
  }
  fecha.setMonth(fecha.getMonth() + mesesIntervalo);

  // Recoger todos los pagos del año
  const finAnio = new Date(anio, 11, 31);
  while (fecha <= finAnio) {
    if (fecha.getFullYear() === anio) {
      fechas.push(new Date(fecha));
    }
    fecha.setMonth(fecha.getMonth() + mesesIntervalo);
  }

  return fechas;
}

// GET /api/contabilidad?year=2024
router.get('/', async (req, res) => {
  try {
    const anio = parseInt(req.query.year) || new Date().getFullYear();

    const resultado = await pool.query(
      `SELECT p.id, p.numero_poliza, p.tipo, p.compania_aseguradora,
              p.periodicidad_pago, p.importe_pago, p.importe_anual,
              p.fecha_proximo_pago, p.fecha_inicio, p.fecha_vencimiento,
              i.nombre AS nombre_inmueble
       FROM polizas p
       LEFT JOIN inmuebles i ON p.inmueble_id = i.id
       WHERE (p.fecha_proximo_pago IS NOT NULL OR p.fecha_inicio IS NOT NULL)
         AND (p.fecha_vencimiento IS NULL OR p.fecha_vencimiento >= $1)`,
      [`${anio}-01-01`]
    );

    // Estructura: { mes: [pagos] }
    const pagoPorMes = {};
    for (let m = 0; m < 12; m++) {
      pagoPorMes[m] = [];
    }

    let totalAnual = 0;

    for (const poliza of resultado.rows) {
      const fechaBase = poliza.fecha_proximo_pago || poliza.fecha_inicio;
      if (!fechaBase) continue;

      const periodicidad = poliza.periodicidad_pago || 'anual';
      const importe = parseFloat(poliza.importe_pago || poliza.importe_anual || 0);

      const fechasPago = calcularFechasPagoEnAnio(fechaBase, periodicidad, anio);

      for (const fechaPago of fechasPago) {
        const mes = fechaPago.getMonth(); // 0-11
        pagoPorMes[mes].push({
          poliza_id: poliza.id,
          numero_poliza: poliza.numero_poliza || '—',
          tipo: poliza.tipo,
          compania_aseguradora: poliza.compania_aseguradora || '—',
          nombre_inmueble: poliza.nombre_inmueble || '—',
          periodicidad,
          importe,
          fecha_pago: fechaPago.toISOString().split('T')[0],
        });
        totalAnual += importe;
      }
    }

    // Construir resumen mensual
    const meses = Array.from({ length: 12 }, (_, m) => ({
      mes: m,
      nombre: NOMBRES_MESES[m],
      pagos: pagoPorMes[m],
      total: pagoPorMes[m].reduce((s, p) => s + p.importe, 0),
    }));

    res.json({ anio, meses, totalAnual });
  } catch (error) {
    console.error('Error al obtener datos de contabilidad:', error);
    res.status(500).json({ error: 'Error al obtener los datos de contabilidad' });
  }
});

module.exports = router;
