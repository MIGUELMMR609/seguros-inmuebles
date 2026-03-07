const cron = require('node-cron');
const { pool } = require('../config/database');
const { enviarEmailAlertas, enviarEmailInquilino } = require('../services/emailService');

async function obtenerPolizasProximasAVencer() {
  const polizasInmuebles = await pool.query(
    `SELECT
       p.id, 'inmueble' AS origen, p.tipo, p.compania_aseguradora, p.numero_poliza,
       p.fecha_vencimiento, p.importe_anual,
       i.nombre AS nombre_referencia, i.direccion AS direccion_referencia,
       (p.fecha_vencimiento - CURRENT_DATE) AS dias_restantes
     FROM polizas p
     LEFT JOIN inmuebles i ON p.inmueble_id = i.id
     WHERE p.fecha_vencimiento IS NOT NULL
       AND p.fecha_vencimiento >= CURRENT_DATE
       AND (p.fecha_vencimiento - CURRENT_DATE) <= 30
     ORDER BY p.fecha_vencimiento ASC`
  );

  const polizasInquilinos = await pool.query(
    `SELECT
       pi.id, 'inquilino' AS origen, 'seguro_inquilino' AS tipo,
       pi.compania_aseguradora, pi.numero_poliza, pi.fecha_vencimiento, pi.importe_anual,
       inq.nombre AS nombre_referencia, inq.email AS email_inquilino,
       i.nombre AS direccion_referencia,
       inq.id AS inquilino_id,
       (pi.fecha_vencimiento - CURRENT_DATE) AS dias_restantes
     FROM polizas_inquilinos pi
     LEFT JOIN inquilinos inq ON pi.inquilino_id = inq.id
     LEFT JOIN inmuebles i ON inq.inmueble_id = i.id
     WHERE pi.fecha_vencimiento IS NOT NULL
       AND pi.fecha_vencimiento >= CURRENT_DATE
       AND (pi.fecha_vencimiento - CURRENT_DATE) <= 30
     ORDER BY pi.fecha_vencimiento ASC`
  );

  return {
    todasLasAlertas: [...polizasInmuebles.rows, ...polizasInquilinos.rows].sort(
      (a, b) => a.dias_restantes - b.dias_restantes
    ),
    polizasInquilinos: polizasInquilinos.rows,
  };
}

async function obtenerInquilinosSinSeguro() {
  const resultado = await pool.query(
    `SELECT i.id, i.nombre, i.email,
       inm.nombre AS nombre_inmueble
     FROM inquilinos i
     LEFT JOIN inmuebles inm ON inm.id = i.inmueble_id
     WHERE NOT EXISTS (
       SELECT 1 FROM polizas_inquilinos pi
       WHERE pi.inquilino_id = i.id
         AND (pi.fecha_vencimiento IS NULL OR pi.fecha_vencimiento >= CURRENT_DATE)
     )
     ORDER BY i.nombre ASC`
  );
  return resultado.rows;
}

async function ejecutarRevisionAlertas() {
  console.log('Iniciando revisión diaria de pólizas próximas a vencer...');
  try {
    const [{ todasLasAlertas, polizasInquilinos }, inquilinosSinSeguro] = await Promise.all([
      obtenerPolizasProximasAVencer(),
      obtenerInquilinosSinSeguro(),
    ]);

    console.log(`Se encontraron ${todasLasAlertas.length} pólizas próximas a vencer`);
    console.log(`Se encontraron ${inquilinosSinSeguro.length} inquilinos sin seguro activo`);

    // Enviar email consolidado al admin
    await enviarEmailAlertas(todasLasAlertas, inquilinosSinSeguro);

    // SUSPENDIDO: envío de email individual a inquilinos desactivado hasta nuevo aviso
    // Para reactivar, descomentar el bloque siguiente:
    // let emailsInquilinos = 0;
    // for (const poliza of polizasInquilinos) {
    //   if (poliza.email_inquilino) {
    //     await enviarEmailInquilino(
    //       { nombre: poliza.nombre_referencia, email: poliza.email_inquilino },
    //       poliza
    //     );
    //     emailsInquilinos++;
    //   }
    // }
    // if (emailsInquilinos > 0) {
    //   console.log(`Emails de aviso enviados a ${emailsInquilinos} inquilinos`);
    // }

    console.log('Revisión diaria completada');
  } catch (error) {
    console.error('Error durante la revisión diaria de alertas:', error);
  }
}

function iniciarCronAlertas() {
  // Ejecutar todos los días a las 9:00 AM (hora de Madrid)
  cron.schedule('0 9 * * *', ejecutarRevisionAlertas, {
    timezone: 'Europe/Madrid',
  });
  console.log('Cron de alertas programado: todos los días a las 9:00 AM (Europe/Madrid)');
}

module.exports = { iniciarCronAlertas, ejecutarRevisionAlertas };
