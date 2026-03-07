const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();
router.use(verificarToken);

// GET /api/alertas/resumen - Resumen para badges del menú (Inquilinos + Pólizas Inquilinos)
router.get('/resumen', async (req, res) => {
  try {
    const [contratosPronto, inquilinosSinSeguro, inmueblesSinPoliza] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int FROM inquilinos
         WHERE (estado = 'activo' OR estado IS NULL)
           AND fecha_fin_contrato IS NOT NULL
           AND (
             fecha_fin_contrato < CURRENT_DATE
             OR (fecha_fin_contrato - CURRENT_DATE) <= 30
           )`
      ),
      pool.query(
        `SELECT COUNT(*)::int FROM inquilinos i
         WHERE (i.estado = 'activo' OR i.estado IS NULL)
           AND NOT EXISTS (
             SELECT 1 FROM polizas_inquilinos pi
             WHERE pi.inquilino_id = i.id
               AND (pi.fecha_vencimiento IS NULL OR pi.fecha_vencimiento >= CURRENT_DATE)
           )`
      ),
      pool.query(
        `SELECT COUNT(*)::int FROM inmuebles i
         WHERE NOT EXISTS (
           SELECT 1 FROM polizas p WHERE p.inmueble_id = i.id
         )`
      ),
    ]);

    res.json({
      contratos_proximos: contratosPronto.rows[0].count,
      inquilinos_sin_seguro: inquilinosSinSeguro.rows[0].count,
      inmuebles_sin_poliza: inmueblesSinPoliza.rows[0].count,
    });
  } catch (error) {
    console.error('Error al obtener resumen de alertas:', error);
    res.status(500).json({ error: 'Error al obtener el resumen' });
  }
});

// GET /api/alertas - Todas las secciones de alertas
router.get('/', async (req, res) => {
  try {
    const diasLimite = parseInt(req.query.dias) || 30;

    const [
      polizasInmuebles,
      polizasInquilinos,
      contratosAlquiler,
      inmueblesSinPoliza,
      polizasVencidasInm,
      polizasVencidasInq,
      inquilinosSinPoliza,
      contratosVencidos,
    ] = await Promise.all([

      // Pólizas de inmuebles próximas a vencer
      pool.query(
        `SELECT
           p.id,
           'inmueble' AS origen,
           p.tipo,
           p.compania_aseguradora,
           p.numero_poliza,
           p.fecha_vencimiento,
           p.importe_anual,
           i.nombre AS nombre_inmueble,
           i.nombre AS nombre_referencia,
           i.direccion AS direccion_referencia,
           (p.fecha_vencimiento - CURRENT_DATE)::int AS dias_restantes
         FROM polizas p
         LEFT JOIN inmuebles i ON p.inmueble_id = i.id
         WHERE p.fecha_vencimiento IS NOT NULL
           AND p.fecha_vencimiento >= CURRENT_DATE
           AND (p.fecha_vencimiento - CURRENT_DATE) <= $1
         ORDER BY p.fecha_vencimiento ASC`,
        [diasLimite]
      ),

      // Pólizas de inquilinos próximas a vencer
      pool.query(
        `SELECT
           pi.id,
           'inquilino' AS origen,
           'seguro_inquilino' AS tipo,
           pi.compania_aseguradora,
           pi.numero_poliza,
           pi.fecha_vencimiento,
           pi.importe_anual,
           inq.nombre AS nombre_inquilino,
           inq.nombre AS nombre_referencia,
           inm.nombre AS nombre_inmueble,
           inm.nombre AS direccion_referencia,
           (pi.fecha_vencimiento - CURRENT_DATE)::int AS dias_restantes
         FROM polizas_inquilinos pi
         LEFT JOIN inquilinos inq ON pi.inquilino_id = inq.id
         LEFT JOIN inmuebles inm ON inq.inmueble_id = inm.id
         WHERE pi.fecha_vencimiento IS NOT NULL
           AND pi.fecha_vencimiento >= CURRENT_DATE
           AND (pi.fecha_vencimiento - CURRENT_DATE) <= $1
         ORDER BY pi.fecha_vencimiento ASC`,
        [diasLimite]
      ),

      // Contratos de alquiler próximos a vencer
      pool.query(
        `SELECT
           inq.id,
           'contrato' AS origen,
           inq.nombre AS nombre_inquilino,
           inq.nombre AS nombre_referencia,
           inm.nombre AS nombre_inmueble,
           inq.fecha_fin_contrato,
           (inq.fecha_fin_contrato - CURRENT_DATE)::int AS dias_restantes
         FROM inquilinos inq
         LEFT JOIN inmuebles inm ON inm.id = inq.inmueble_id
         WHERE (inq.estado = 'activo' OR inq.estado IS NULL)
           AND inq.fecha_fin_contrato IS NOT NULL
           AND inq.fecha_fin_contrato >= CURRENT_DATE
           AND (inq.fecha_fin_contrato - CURRENT_DATE) <= $1
         ORDER BY inq.fecha_fin_contrato ASC`,
        [diasLimite]
      ),

      // Inmuebles sin ninguna póliza vigente asignada
      pool.query(
        `SELECT i.id, i.nombre, i.tipo, i.direccion
         FROM inmuebles i
         WHERE NOT EXISTS (
           SELECT 1 FROM polizas p
           WHERE p.inmueble_id = i.id
             AND (p.fecha_vencimiento IS NULL OR p.fecha_vencimiento >= CURRENT_DATE)
         )
         ORDER BY i.nombre ASC`
      ),

      // Pólizas de inmuebles vencidas
      pool.query(
        `SELECT
           p.id,
           'inmueble' AS origen,
           p.tipo,
           p.compania_aseguradora,
           p.numero_poliza,
           p.fecha_vencimiento,
           i.nombre AS nombre_referencia,
           i.nombre AS nombre_inmueble,
           (CURRENT_DATE - p.fecha_vencimiento)::int AS dias_vencida
         FROM polizas p
         LEFT JOIN inmuebles i ON p.inmueble_id = i.id
         WHERE p.fecha_vencimiento IS NOT NULL
           AND p.fecha_vencimiento < CURRENT_DATE
         ORDER BY p.fecha_vencimiento DESC`
      ),

      // Pólizas de inquilinos vencidas
      pool.query(
        `SELECT
           pi.id,
           'inquilino' AS origen,
           'seguro_inquilino' AS tipo,
           pi.compania_aseguradora,
           pi.numero_poliza,
           pi.fecha_vencimiento,
           inq.nombre AS nombre_referencia,
           inm.nombre AS nombre_inmueble,
           (CURRENT_DATE - pi.fecha_vencimiento)::int AS dias_vencida
         FROM polizas_inquilinos pi
         LEFT JOIN inquilinos inq ON pi.inquilino_id = inq.id
         LEFT JOIN inmuebles inm ON inq.inmueble_id = inm.id
         WHERE pi.fecha_vencimiento IS NOT NULL
           AND pi.fecha_vencimiento < CURRENT_DATE
         ORDER BY pi.fecha_vencimiento DESC`
      ),

      // Inquilinos activos sin ninguna póliza vigente asignada
      pool.query(
        `SELECT i.id, i.nombre, i.email, i.telefono, inm.nombre AS nombre_inmueble
         FROM inquilinos i
         LEFT JOIN inmuebles inm ON i.inmueble_id = inm.id
         WHERE (i.estado = 'activo' OR i.estado IS NULL)
           AND NOT EXISTS (
             SELECT 1 FROM polizas_inquilinos pi
             WHERE pi.inquilino_id = i.id
               AND (pi.fecha_vencimiento IS NULL OR pi.fecha_vencimiento >= CURRENT_DATE)
           )
         ORDER BY i.nombre ASC`
      ),

      // Contratos de alquiler ya vencidos (inquilino activo)
      pool.query(
        `SELECT
           inq.id,
           inq.nombre AS nombre_inquilino,
           inm.nombre AS nombre_inmueble,
           inq.fecha_fin_contrato,
           (CURRENT_DATE - inq.fecha_fin_contrato)::int AS dias_vencido
         FROM inquilinos inq
         LEFT JOIN inmuebles inm ON inq.inmueble_id = inm.id
         WHERE (inq.estado = 'activo' OR inq.estado IS NULL)
           AND inq.fecha_fin_contrato IS NOT NULL
           AND inq.fecha_fin_contrato < CURRENT_DATE
         ORDER BY inq.fecha_fin_contrato DESC`
      ),
    ]);

    const polizasVencidas = [
      ...polizasVencidasInm.rows,
      ...polizasVencidasInq.rows,
    ].sort((a, b) => b.dias_vencida - a.dias_vencida);

    const total =
      polizasInmuebles.rows.length +
      polizasInquilinos.rows.length +
      contratosAlquiler.rows.length +
      inmueblesSinPoliza.rows.length +
      polizasVencidas.length +
      inquilinosSinPoliza.rows.length +
      contratosVencidos.rows.length;

    const hayUrgentes =
      polizasVencidas.length > 0 ||
      contratosVencidos.rows.length > 0 ||
      polizasInmuebles.rows.some((p) => p.dias_restantes <= 7) ||
      polizasInquilinos.rows.some((p) => p.dias_restantes <= 7) ||
      contratosAlquiler.rows.some((c) => c.dias_restantes <= 7);

    // 'alertas' mantiene compatibilidad con Dashboard (pólizas combinadas)
    const alertas = [
      ...polizasInmuebles.rows,
      ...polizasInquilinos.rows,
    ].sort((a, b) => a.dias_restantes - b.dias_restantes);

    res.json({
      total,
      diasLimite,
      hay_urgentes: hayUrgentes,
      polizas_inmuebles: polizasInmuebles.rows,
      polizas_inquilinos: polizasInquilinos.rows,
      contratos_alquiler: contratosAlquiler.rows,
      inmuebles_sin_poliza: inmueblesSinPoliza.rows,
      polizas_vencidas: polizasVencidas,
      inquilinos_sin_poliza: inquilinosSinPoliza.rows,
      contratos_vencidos: contratosVencidos.rows,
      alertas, // backward compat
    });
  } catch (error) {
    console.error('Error al obtener alertas:', error);
    res.status(500).json({ error: 'Error al obtener las alertas' });
  }
});

module.exports = router;
