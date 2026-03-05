const express = require('express');
const { pool } = require('../config/database');
const { verificarToken } = require('../middleware/auth');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle,
} = require('docx');

const router = express.Router();
router.use(verificarToken);

function formatearFecha(fecha) {
  if (!fecha) return '—';
  return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatearImporte(importe) {
  if (!importe) return '—';
  return `${parseFloat(importe).toFixed(2)} €`;
}

function parrafo(texto, opciones = {}) {
  return new Paragraph({
    alignment: opciones.centrado ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { after: opciones.sinEspacioFinal ? 0 : 200 },
    children: [
      new TextRun({
        text: texto,
        bold: opciones.negrita || false,
        size: opciones.tamano || 22,
        font: 'Times New Roman',
      }),
    ],
  });
}

function tituloPrincipal(texto) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [
      new TextRun({
        text: texto,
        bold: true,
        size: 28,
        font: 'Times New Roman',
        underline: {},
      }),
    ],
  });
}

function subtitulo(texto) {
  return new Paragraph({
    spacing: { before: 300, after: 100 },
    children: [
      new TextRun({
        text: texto,
        bold: true,
        size: 24,
        font: 'Times New Roman',
      }),
    ],
  });
}

function lineaSeparadora() {
  return new Paragraph({
    spacing: { after: 200 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
    },
    children: [new TextRun({ text: '' })],
  });
}

function espacioVacio() {
  return new Paragraph({ children: [new TextRun({ text: '' })] });
}

// GET /api/inquilinos/:id/contrato-word
router.get('/inquilinos/:id/contrato-word', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT inq.*, i.nombre AS nombre_inmueble, i.direccion AS direccion_inmueble
       FROM inquilinos inq
       LEFT JOIN inmuebles i ON inq.inmueble_id = i.id
       WHERE inq.id = $1`,
      [req.params.id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Inquilino no encontrado' });
    }

    const inq = resultado.rows[0];
    const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children: [
            tituloPrincipal('CONTRATO DE ARRENDAMIENTO DE VIVIENDA'),

            parrafo(`En ______________, a ${fechaHoy}`, { centrado: true }),

            espacioVacio(),
            lineaSeparadora(),

            subtitulo('REUNIDOS'),

            parrafo('De una parte, EL ARRENDADOR, propietario del inmueble descrito en el presente contrato.', { negrita: false }),

            parrafo('De otra parte, EL ARRENDATARIO:', { negrita: false }),

            parrafo(`   Nombre completo: ${inq.nombre || '—'}`, {}),
            parrafo(`   Email: ${inq.email || '—'}`, {}),
            parrafo(`   Teléfono: ${inq.telefono || '—'}`, {}),

            espacioVacio(),
            lineaSeparadora(),

            subtitulo('EXPONEN'),

            parrafo(`PRIMERO. El arrendador es propietario del inmueble sito en ${inq.direccion_inmueble || '___________________________'} (${inq.nombre_inmueble || 'inmueble'}).`),

            parrafo('SEGUNDO. Ambas partes acuerdan el arrendamiento del citado inmueble para uso como vivienda habitual del arrendatario, bajo las condiciones pactadas en el presente contrato.'),

            espacioVacio(),
            lineaSeparadora(),

            subtitulo('CLÁUSULAS'),

            parrafo('Primera. OBJETO DEL CONTRATO', { negrita: true, sinEspacioFinal: true }),
            parrafo(`El arrendador cede en arrendamiento al arrendatario el inmueble ubicado en ${inq.direccion_inmueble || '___________________________'}, destinado exclusivamente al uso de vivienda habitual.`),

            parrafo('Segunda. DURACIÓN DEL CONTRATO', { negrita: true, sinEspacioFinal: true }),
            parrafo(`El presente contrato tendrá una duración desde el ${formatearFecha(inq.fecha_inicio_contrato)} hasta el ${formatearFecha(inq.fecha_fin_contrato)}. Transcurrido dicho plazo, el contrato se prorrogará según lo establecido en la Ley de Arrendamientos Urbanos vigente.`),

            parrafo('Tercera. RENTA MENSUAL', { negrita: true, sinEspacioFinal: true }),
            parrafo(`La renta mensual pactada es de ${formatearImporte(inq.importe_renta)}, pagadera los primeros cinco días hábiles de cada mes mediante transferencia bancaria a la cuenta que el arrendador indique.`),

            parrafo('Cuarta. FIANZA', { negrita: true, sinEspacioFinal: true }),
            parrafo('A la firma del presente contrato, el arrendatario entregará al arrendador una fianza equivalente a una mensualidad de renta, conforme a lo establecido en el artículo 36 de la LAU.'),

            parrafo('Quinta. CONSERVACIÓN DEL INMUEBLE', { negrita: true, sinEspacioFinal: true }),
            parrafo('El arrendatario se obliga a mantener el inmueble en perfecto estado de conservación y a comunicar de inmediato al arrendador cualquier desperfecto o avería que requiera reparación urgente.'),

            parrafo('Sexta. PROHIBICIÓN DE CESIÓN Y SUBARRIENDO', { negrita: true, sinEspacioFinal: true }),
            parrafo('El arrendatario no podrá ceder ni subarrendar el inmueble sin el consentimiento expreso y por escrito del arrendador.'),

            parrafo('Séptima. SUMINISTROS', { negrita: true, sinEspacioFinal: true }),
            parrafo('Los gastos de suministros (agua, luz, gas, teléfono, internet, etc.) correrán a cargo del arrendatario desde la fecha de inicio del contrato.'),

            parrafo('Octava. RESOLUCIÓN DEL CONTRATO', { negrita: true, sinEspacioFinal: true }),
            parrafo('El incumplimiento por cualquiera de las partes de las obligaciones del presente contrato facultará a la parte contraria a resolver el mismo, sin perjuicio de las acciones legales correspondientes.'),

            ...(inq.notas ? [
              parrafo('Novena. OBSERVACIONES PARTICULARES', { negrita: true, sinEspacioFinal: true }),
              parrafo(inq.notas),
            ] : []),

            ...(inq.observaciones_ia ? [
              parrafo('Observaciones adicionales (análisis IA):', { negrita: true, sinEspacioFinal: true }),
              parrafo(inq.observaciones_ia),
            ] : []),

            espacioVacio(),
            lineaSeparadora(),

            parrafo('Y en prueba de conformidad con cuanto antecede, ambas partes firman el presente contrato por duplicado, en el lugar y fecha indicados en el encabezamiento.', { centrado: false }),

            espacioVacio(),
            espacioVacio(),
            espacioVacio(),

            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({ text: 'EL ARRENDADOR', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: '                                        ', size: 22, font: 'Times New Roman' }),
                new TextRun({ text: 'EL ARRENDATARIO', bold: true, size: 22, font: 'Times New Roman' }),
              ],
            }),

            espacioVacio(),
            espacioVacio(),
            espacioVacio(),

            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({ text: '___________________________', size: 22, font: 'Times New Roman' }),
                new TextRun({ text: '                    ', size: 22, font: 'Times New Roman' }),
                new TextRun({ text: '___________________________', size: 22, font: 'Times New Roman' }),
              ],
            }),

            parrafo(`Firmado: ______________, a ${fechaHoy}`, { centrado: true }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    const nombreArchivo = `contrato_${inq.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error al generar contrato Word:', error);
    res.status(500).json({ error: 'Error al generar el contrato Word' });
  }
});

module.exports = router;
