const nodemailer = require('nodemailer');
const { pool } = require('../config/database');

function crearTransportador() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function calcularUrgencia(diasRestantes) {
  if (diasRestantes <= 7) return { color: '#dc2626', etiqueta: 'URGENTE' };
  if (diasRestantes <= 15) return { color: '#f97316', etiqueta: 'MUY PRÓXIMO' };
  return { color: '#ca8a04', etiqueta: 'PRÓXIMO' };
}

async function registrarEmail({ tipo, destinatarioEmail, destinatarioTipo, polizaId, inquilinoId, estado, mensajeError }) {
  try {
    await pool.query(
      `INSERT INTO registro_emails (tipo, destinatario_email, destinatario_tipo, poliza_id, inquilino_id, estado, mensaje_error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tipo, destinatarioEmail || null, destinatarioTipo || null, polizaId || null, inquilinoId || null, estado, mensajeError || null]
    );
  } catch (err) {
    console.error('Error al registrar email en BD:', err);
  }
}

function generarFilaTablaAdmin(alerta) {
  const urgencia = calcularUrgencia(alerta.dias_restantes);
  const fechaVencimiento = new Date(alerta.fecha_vencimiento).toLocaleDateString('es-ES');
  const origen = alerta.origen === 'inmueble' ? 'Inmueble' : 'Inquilino';
  const tipo = (alerta.tipo || '').replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px 16px;">
        <span style="background-color:${urgencia.color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;">${urgencia.etiqueta}</span>
      </td>
      <td style="padding: 12px 16px; color:#374151;">${origen}</td>
      <td style="padding: 12px 16px; font-weight:600; color:#111827;">${alerta.nombre_referencia || '—'}</td>
      <td style="padding: 12px 16px; color:#374151;">${tipo}</td>
      <td style="padding: 12px 16px; color:#374151;">${alerta.compania_aseguradora || '—'}</td>
      <td style="padding: 12px 16px; color:#374151; font-family:monospace;">${alerta.numero_poliza || '—'}</td>
      <td style="padding: 12px 16px; color:#374151;">${fechaVencimiento}</td>
      <td style="padding: 12px 16px; font-weight:bold; color:${urgencia.color};">${alerta.dias_restantes} días</td>
    </tr>`;
}

async function enviarEmailAlertas(alertas, inquilinosSinSeguro = []) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('Configuración de Gmail no disponible. No se enviará el email de alertas.');
    return;
  }

  if (alertas.length === 0 && inquilinosSinSeguro.length === 0) {
    console.log('No hay alertas pendientes. No se enviará email al admin.');
    return;
  }

  const destinatario = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
  const filasTabla = alertas.map(generarFilaTablaAdmin).join('');
  const fechaHoy = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const seccionSinSeguro = inquilinosSinSeguro.length > 0 ? `
    <div style="padding:24px 32px;background-color:#fef2f2;border-bottom:1px solid #fecaca;">
      <h2 style="color:#991b1b;font-size:16px;margin:0 0 12px;">⚠️ Inquilinos sin seguro activo (${inquilinosSinSeguro.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background-color:#fff1f1;">
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #fecaca;">Inquilino</th>
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #fecaca;">Email</th>
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #fecaca;">Inmueble</th>
          </tr>
        </thead>
        <tbody>
          ${inquilinosSinSeguro.map((inq) => `
            <tr style="border-bottom:1px solid #fecaca;">
              <td style="padding:8px 12px;font-weight:600;color:#111827;">${inq.nombre}</td>
              <td style="padding:8px 12px;color:#374151;">${inq.email || '—'}</td>
              <td style="padding:8px 12px;color:#374151;">${inq.nombre_inmueble || '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '';

  const seccionPolizas = alertas.length > 0 ? `
    <div style="padding:24px 32px;background-color:#eff6ff;border-bottom:1px solid #bfdbfe;">
      <p style="margin:0;color:#1e40af;font-size:16px;">
        Se han detectado <strong>${alertas.length} póliza${alertas.length !== 1 ? 's' : ''}</strong>
        que vence${alertas.length !== 1 ? 'n' : ''} en los próximos 30 días.
      </p>
    </div>
    <div style="padding:24px 32px;overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background-color:#f9fafb;">
            <th style="padding:12px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Urgencia</th>
            <th style="padding:12px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Tipo</th>
            <th style="padding:12px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Nombre</th>
            <th style="padding:12px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Seguro</th>
            <th style="padding:12px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Compañía</th>
            <th style="padding:12px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Nº Póliza</th>
            <th style="padding:12px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Vencimiento</th>
            <th style="padding:12px 16px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Días Rest.</th>
          </tr>
        </thead>
        <tbody>${filasTabla}</tbody>
      </table>
    </div>` : '';

  const cuerpoHTML = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background-color:#f3f4f6;margin:0;padding:20px;">
  <div style="max-width:900px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background-color:#1e3a5f;padding:24px 32px;">
      <h1 style="color:white;margin:0;font-size:22px;">🔔 Resumen de Alertas de Seguros</h1>
      <p style="color:#93c5fd;margin:8px 0 0;font-size:14px;">${fechaHoy}</p>
    </div>
    ${seccionSinSeguro}
    ${seccionPolizas}
    <div style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        Email generado automáticamente por el sistema de Gestión de Pólizas de Seguros.
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    const transportador = crearTransportador();
    await transportador.sendMail({
      from: `"Gestión de Seguros" <${process.env.GMAIL_USER}>`,
      to: destinatario,
      subject: `🔔 Alertas seguros: ${alertas.length} póliza${alertas.length !== 1 ? 's' : ''} próxima${alertas.length !== 1 ? 's' : ''} a vencer${inquilinosSinSeguro.length > 0 ? ` · ${inquilinosSinSeguro.length} sin seguro` : ''}`,
      html: cuerpoHTML,
    });
    console.log(`Email de alertas enviado a ${destinatario}`);
    await registrarEmail({
      tipo: 'alerta_vencimiento',
      destinatarioEmail: destinatario,
      destinatarioTipo: 'admin',
      estado: 'enviado',
    });
  } catch (error) {
    console.error('Error al enviar email de alertas al admin:', error);
    await registrarEmail({
      tipo: 'alerta_vencimiento',
      destinatarioEmail: destinatario,
      destinatarioTipo: 'admin',
      estado: 'error',
      mensajeError: error.message,
    });
    throw error;
  }
}

async function enviarEmailInquilino(inquilino, polizaInquilino) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;
  if (!inquilino.email) return;

  const dias = polizaInquilino.dias_restantes;
  const fechaVencimiento = new Date(polizaInquilino.fecha_vencimiento).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const cuerpoHTML = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background-color:#f3f4f6;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background-color:#1e3a5f;padding:24px 32px;">
      <h1 style="color:white;margin:0;font-size:20px;">📋 Aviso de Renovación de Seguro</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;">Estimado/a <strong>${inquilino.nombre}</strong>,</p>
      <p style="color:#374151;">Le informamos de que su póliza de seguro está próxima a vencer:</p>
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px;color:#9a3412;font-size:14px;"><strong>Compañía:</strong> ${polizaInquilino.compania_aseguradora || '—'}</p>
        <p style="margin:0 0 8px;color:#9a3412;font-size:14px;"><strong>Nº de póliza:</strong> ${polizaInquilino.numero_poliza || '—'}</p>
        <p style="margin:0 0 8px;color:#9a3412;font-size:14px;"><strong>Fecha de vencimiento:</strong> ${fechaVencimiento}</p>
        <p style="margin:0;color:#9a3412;font-size:16px;font-weight:bold;">Días restantes: ${dias}</p>
      </div>
      <p style="color:#374151;">Por favor, renueve su póliza antes de la fecha de vencimiento para evitar quedar sin cobertura.</p>
      <p style="color:#6b7280;font-size:14px;">Si tiene alguna duda, contacte con su gestor de seguros.</p>
    </div>
    <div style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
        Este email ha sido enviado automáticamente por el sistema de Gestión de Pólizas.
      </p>
    </div>
  </div>
</body>
</html>`;

  try {
    const transportador = crearTransportador();
    await transportador.sendMail({
      from: `"Gestión de Seguros" <${process.env.GMAIL_USER}>`,
      to: inquilino.email,
      subject: `⚠️ Su póliza de seguro vence en ${dias} días`,
      html: cuerpoHTML,
    });
    console.log(`Email de aviso enviado a inquilino: ${inquilino.email}`);
    await registrarEmail({
      tipo: 'aviso_renovacion_inquilino',
      destinatarioEmail: inquilino.email,
      destinatarioTipo: 'inquilino',
      polizaId: polizaInquilino.id || null,
      inquilinoId: polizaInquilino.inquilino_id || null,
      estado: 'enviado',
    });
  } catch (error) {
    console.error(`Error al enviar email al inquilino ${inquilino.email}:`, error);
    await registrarEmail({
      tipo: 'aviso_renovacion_inquilino',
      destinatarioEmail: inquilino.email,
      destinatarioTipo: 'inquilino',
      polizaId: polizaInquilino.id || null,
      inquilinoId: polizaInquilino.inquilino_id || null,
      estado: 'error',
      mensajeError: error.message,
    });
    // No relanzar: un fallo en el email de un inquilino no debe detener el proceso
  }
}

module.exports = { enviarEmailAlertas, enviarEmailInquilino };
