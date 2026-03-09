const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  font-size: 13px; color: #1f2937; background: #fff;
  padding: 32px 40px; max-width: 900px; margin: 0 auto;
}
.header {
  display: flex; justify-content: space-between; align-items: flex-end;
  border-bottom: 2px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 24px;
}
.logo { font-size: 20px; font-weight: 800; color: #1e3a5f; letter-spacing: -0.5px; }
.logo small { display: block; font-size: 11px; font-weight: 400; color: #6b7280; margin-top: 3px; }
.fecha { font-size: 11px; color: #9ca3af; text-align: right; line-height: 1.6; }
.datos-box {
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
  padding: 14px 18px; margin-bottom: 20px;
}
.datos-tabla { width: 100%; border-collapse: collapse; font-size: 12px; }
.datos-tabla td { padding: 4px 0; vertical-align: top; }
.dato-label { color: #6b7280; font-weight: 600; width: 20%; white-space: nowrap; padding-right: 8px !important; }
.dato-sep { width: 30%; padding-right: 20px !important; color: #111827; }
.valoracion {
  display: flex; align-items: center; gap: 16px;
  border-radius: 10px; padding: 14px 18px; margin-bottom: 18px;
  border: 1px solid transparent;
}
.val-num { font-size: 34px; font-weight: 800; line-height: 1; }
.val-etiqueta { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; color: #6b7280; }
.val-desc { font-size: 13px; font-weight: 600; margin-top: 3px; }
.seccion {
  border-left: 4px solid; border-radius: 6px;
  padding: 12px 16px; margin-bottom: 14px; page-break-inside: avoid;
}
.seccion h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
.seccion p { font-size: 13px; line-height: 1.65; color: #374151; white-space: pre-line; }
.seccion-comp { border-left: 4px solid #6b7280; background: #f9fafb; border-radius: 6px; padding: 12px 16px; margin-bottom: 14px; }
.seccion-comp h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #4b5563; margin-bottom: 8px; }
.seccion-comp p { font-size: 13px; line-height: 1.6; color: #374151; margin-bottom: 6px; }
.footer {
  border-top: 1px solid #e5e7eb; margin-top: 28px; padding-top: 10px;
  font-size: 10px; color: #9ca3af; text-align: center;
}
@media print {
  body { padding: 0; }
  @page { margin: 1.5cm; size: A4; }
}
`;

function esc(txt) {
  if (!txt) return '';
  return String(txt).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sec(titulo, contenido, borde, fondo, color) {
  if (!contenido) return '';
  return `<div class="seccion" style="border-color:${borde};background:${fondo};">
    <h3 style="color:${color};">${titulo}</h3>
    <p>${esc(contenido)}</p>
  </div>`;
}

function formatFecha(f) {
  if (!f) return null;
  try { return new Date(f).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return String(f); }
}

function fila(label, valor) {
  if (!valor) return '';
  return `<tr>
    <td class="dato-label">${label}:</td>
    <td class="dato-sep">${esc(String(valor))}</td>
  </tr>`;
}

function filaDupla(l1, v1, l2, v2) {
  const c1 = v1 ? `<td class="dato-label">${l1}:</td><td class="dato-sep">${esc(String(v1))}</td>` : '<td colspan="2"></td>';
  const c2 = v2 ? `<td class="dato-label">${l2}:</td><td class="dato-sep">${esc(String(v2))}</td>` : '<td colspan="2"></td>';
  if (!v1 && !v2) return '';
  return `<tr>${c1}${c2}</tr>`;
}

function valoracionHtml(val, etiqueta, descripcion) {
  if (!val) return '';
  const num = parseFloat(val);
  const vc = num >= 7 ? '#15803d' : num >= 5 ? '#c2410c' : '#b91c1c';
  const vb = num >= 7 ? '#f0fdf4' : num >= 5 ? '#fff7ed' : '#fef2f2';
  return `<div class="valoracion" style="background:${vb};border-color:${vc}33;">
    <div class="val-num" style="color:${vc};">${num.toFixed(1)}</div>
    <div>
      <div class="val-etiqueta">${etiqueta}</div>
      <div class="val-desc" style="color:${vc};">${descripcion}</div>
    </div>
  </div>`;
}

function abrirVentana(titulo, cuerpo) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${esc(titulo)}</title>
  <style>${CSS}</style>
</head>
<body>
  ${cuerpo}
  <script>window.onload = function() { window.focus(); window.print(); }<\/script>
</body>
</html>`;
  const win = window.open('', '_blank', 'width=900,height=720');
  if (!win) {
    alert('Permite las ventanas emergentes en tu navegador para imprimir el informe.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

export function imprimirInformePoliza(analisis, poliza) {
  const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const tipo = poliza.tipo
    ? poliza.tipo.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';
  const val = analisis.valoracion ? parseFloat(analisis.valoracion) : null;
  const valDesc = val ? (val >= 7 ? 'Buena cobertura' : val >= 5 ? 'Cobertura mejorable' : 'Cobertura insuficiente') : '';
  const cm = analisis.comparador_mercado;

  const cuerpo = `
    <div class="header">
      <div>
        <div class="logo">Gestión de Seguros<small>Informe de Análisis Experto de Póliza</small></div>
      </div>
      <div class="fecha">Generado el<br><strong>${fechaHoy}</strong></div>
    </div>

    <div class="datos-box">
      <table class="datos-tabla">
        ${filaDupla('Compañía', poliza.compania_aseguradora, 'Nº Póliza', poliza.numero_poliza)}
        ${filaDupla('Tipo', tipo, 'Tomador', poliza.tomador_poliza)}
        ${poliza.nombre_inmueble ? filaDupla('Inmueble', poliza.nombre_inmueble, 'Inquilino', poliza.nombre_inquilino) : fila('Inquilino', poliza.nombre_inquilino)}
        ${filaDupla('Inicio', formatFecha(poliza.fecha_inicio), 'Vencimiento', formatFecha(poliza.fecha_vencimiento))}
        ${poliza.importe_anual ? fila('Importe anual', parseFloat(poliza.importe_anual).toFixed(2) + ' €') : ''}
      </table>
    </div>

    ${valoracionHtml(val, 'Valoración IA', valDesc)}

    ${sec('Riesgos cubiertos', analisis.riesgos_cubiertos, '#16a34a', '#f0fdf4', '#15803d')}
    ${sec('Riesgos no cubiertos', analisis.riesgos_no_cubiertos, '#dc2626', '#fef2f2', '#b91c1c')}
    ${sec('Fortalezas', analisis.analisis_fortalezas, '#2563eb', '#eff6ff', '#1d4ed8')}
    ${sec('Carencias', analisis.analisis_carencias, '#ea580c', '#fff7ed', '#c2410c')}
    ${sec('Cómo complementar', analisis.como_complementar, '#9333ea', '#faf5ff', '#7e22ce')}

    ${cm ? `<div class="seccion-comp">
      <h3>Comparador de mercado</h3>
      ${cm.precio_estimado_mercado ? `<p><strong>Precio de mercado:</strong> ${esc(cm.precio_estimado_mercado)}</p>` : ''}
      ${cm.evaluacion_precio ? `<p><strong>Evaluación del precio:</strong> ${esc(cm.evaluacion_precio)}</p>` : ''}
      ${cm.recomendaciones ? `<p><strong>Recomendaciones:</strong> ${esc(cm.recomendaciones)}</p>` : ''}
    </div>` : ''}

    <div class="footer">
      Informe generado el ${fechaHoy} · Gestión de Seguros
      ${analisis.fecha_ultimo_analisis ? ` · Análisis IA: ${formatFecha(analisis.fecha_ultimo_analisis)}` : ''}
    </div>
  `;

  abrirVentana(
    `Informe Póliza — ${poliza.compania_aseguradora || ''} ${poliza.numero_poliza || ''}`,
    cuerpo
  );
}

export function imprimirComparador(datos, tipo) {
  const { resumen, polizas = [], tabla_coberturas = [], recomendacion } = datos;
  const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const mejorId = recomendacion?.mejor_id;
  const titulo = tipo === 'inquilinos' ? 'Comparador de pólizas de inquilinos' : 'Comparador de pólizas de inmuebles';

  const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; padding: 28px 36px; }
.header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1e3a5f; padding-bottom: 14px; margin-bottom: 20px; }
.logo { font-size: 18px; font-weight: 800; color: #1e3a5f; }
.logo small { display: block; font-size: 11px; font-weight: 400; color: #6b7280; margin-top: 2px; }
.fecha { font-size: 11px; color: #9ca3af; text-align: right; line-height: 1.6; }
.resumen { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; font-size: 12px; color: #374151; line-height: 1.6; }
.resumen strong { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px; }
h3.seccion-titulo { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 8px; margin-top: 18px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 11px; }
th { background: #f3f4f6; color: #4b5563; font-weight: 600; padding: 7px 10px; text-align: center; border: 1px solid #e5e7eb; }
th.campo { text-align: left; }
td { padding: 6px 10px; border: 1px solid #e5e7eb; vertical-align: top; color: #374151; }
td.campo { background: #f9fafb; font-weight: 500; color: #6b7280; }
td.centro { text-align: center; }
.mejor { background: #f0fdf4 !important; color: #166534 !important; border-bottom: 2px solid #4ade80 !important; }
.badge-mejor { font-size: 9px; background: #16a34a; color: #fff; padding: 1px 6px; border-radius: 10px; margin-left: 4px; }
.val-badge { font-weight: 700; padding: 2px 7px; border-radius: 10px; font-size: 11px; }
.val-verde { background: #dcfce7; color: #15803d; }
.val-amarillo { background: #fef9c3; color: #a16207; }
.val-rojo { background: #fee2e2; color: #b91c1c; }
.val-gris { background: #f3f4f6; color: #6b7280; }
.green-cell { background: #f0fdf4; color: #15803d; }
.red-cell { background: #fef2f2; color: #b91c1c; }
.yellow-cell { background: #fefce8; color: #a16207; }
ul { list-style: none; padding: 0; }
li { margin-bottom: 3px; }
.recomendacion { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin-top: 4px; }
.recomendacion strong { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #16a34a; margin-bottom: 6px; }
.recomendacion p { font-size: 12px; color: #14532d; line-height: 1.6; }
.footer { border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 8px; font-size: 10px; color: #9ca3af; text-align: center; }
@media print { body { padding: 0; } @page { margin: 1.5cm; size: A4 landscape; } }
`;

  function valBadge(v) {
    if (v == null) return '<span class="val-badge val-gris">—</span>';
    const n = parseFloat(v);
    const cls = n >= 7 ? 'val-verde' : n >= 5 ? 'val-amarillo' : 'val-rojo';
    return `<span class="val-badge ${cls}">${n.toFixed(1)}/10</span>`;
  }

  function cellColor(v) {
    if (v === '✅') return 'green-cell';
    if (v === '❌') return 'red-cell';
    if (v === '⚠️') return 'yellow-cell';
    return '';
  }

  // Cabeceras de pólizas
  const thPolizas = polizas.map((p) => {
    const esMejor = p.id === mejorId;
    return `<th class="${esMejor ? 'mejor' : ''}">${esc(p.etiqueta || p.compania || `Póliza ${p.id}`)}${esMejor ? '<span class="badge-mejor">⭐ Mejor</span>' : ''}</th>`;
  }).join('');

  function filaTabla(campo, fn) {
    const celdas = polizas.map((p) => `<td class="centro">${fn(p)}</td>`).join('');
    return `<tr><td class="campo">${campo}</td>${celdas}</tr>`;
  }

  const tablaComparativa = `
<h3 class="seccion-titulo">Tabla comparativa</h3>
<table>
  <thead><tr><th class="campo">Campo</th>${thPolizas}</tr></thead>
  <tbody>
    ${filaTabla('Compañía', (p) => esc(p.compania || '—'))}
    ${filaTabla('Prima anual', (p) => p.prima_anual != null ? `${parseFloat(p.prima_anual).toFixed(2)} €` : '—')}
    ${filaTabla('Capital asegurado', (p) => esc(p.capital_asegurado || '—'))}
    ${filaTabla('Franquicia', (p) => esc(p.franquicia || '—'))}
    <tr>
      <td class="campo">Riesgos cubiertos</td>
      ${polizas.map((p) => `<td>${Array.isArray(p.riesgos_cubiertos) && p.riesgos_cubiertos.length ? `<ul>${p.riesgos_cubiertos.map((r) => `<li class="green-cell" style="padding:1px 3px;border-radius:3px;margin-bottom:2px;">✅ ${esc(r)}</li>`).join('')}</ul>` : '—'}</td>`).join('')}
    </tr>
    <tr>
      <td class="campo">Riesgos NO cubiertos</td>
      ${polizas.map((p) => `<td>${Array.isArray(p.riesgos_no_cubiertos) && p.riesgos_no_cubiertos.length ? `<ul>${p.riesgos_no_cubiertos.map((r) => `<li class="red-cell" style="padding:1px 3px;border-radius:3px;margin-bottom:2px;">❌ ${esc(r)}</li>`).join('')}</ul>` : '—'}</td>`).join('')}
    </tr>
    ${filaTabla('Exclusiones', (p) => esc(p.exclusiones || '—'))}
    ${filaTabla('Fortalezas', (p) => esc(p.fortalezas || '—'))}
    ${filaTabla('Valoración', (p) => valBadge(p.valoracion))}
  </tbody>
</table>`;

  const tablaCoberturas = tabla_coberturas.length > 0 ? `
<h3 class="seccion-titulo">Coberturas por póliza</h3>
<table>
  <thead><tr><th class="campo">Cobertura</th>${polizas.map((p) => `<th>${esc(p.compania || `Póliza ${p.id}`)}</th>`).join('')}</tr></thead>
  <tbody>
    ${tabla_coberturas.map((fila) => `<tr>
      <td class="campo">${esc(fila.cobertura)}</td>
      ${(fila.valores || []).map((v) => `<td class="centro ${cellColor(v)}">${v || '—'}</td>`).join('')}
    </tr>`).join('')}
  </tbody>
</table>` : '';

  const htmlResumen = resumen ? `<div class="resumen"><strong>Resumen ejecutivo</strong>${esc(resumen)}</div>` : '';

  const htmlRecomendacion = recomendacion ? `
<div class="recomendacion">
  <strong>Recomendación IA</strong>
  ${mejorId ? `<p style="font-weight:600;margin-bottom:6px;">⭐ Mejor opción: ${esc(polizas.find((p) => p.id === mejorId)?.etiqueta || `Póliza ID ${mejorId}`)}</p>` : ''}
  <p>${esc(recomendacion.texto)}</p>
</div>` : '';

  const cuerpo = `
<style>${css}</style>
<div class="header">
  <div>
    <div class="logo">Gestión de Seguros<small>${esc(titulo)}</small></div>
  </div>
  <div class="fecha">Generado el<br><strong>${fechaHoy}</strong></div>
</div>
${htmlResumen}
${tablaComparativa}
${tablaCoberturas}
${htmlRecomendacion}
<div class="footer">Informe generado el ${fechaHoy} · Gestión de Seguros</div>`;

  const win = window.open('', '_blank', 'width=1100,height=800');
  if (!win) {
    alert('Permite las ventanas emergentes en tu navegador para imprimir el informe.');
    return;
  }
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(titulo)}</title></head><body>${cuerpo}<script>window.onload=function(){window.focus();window.print();}<\/script></body></html>`);
  win.document.close();
}

export function imprimirInformeContrato(analisis, inquilino) {
  const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const val = analisis.valoracion_contrato ? parseFloat(analisis.valoracion_contrato) : null;
  const valDesc = val ? (val >= 7 ? 'Contrato sólido' : val >= 5 ? 'Contrato mejorable' : 'Contrato con carencias') : '';

  const cuerpo = `
    <div class="header">
      <div>
        <div class="logo">Gestión de Seguros<small>Informe de Análisis Jurídico de Contrato de Arrendamiento</small></div>
      </div>
      <div class="fecha">Generado el<br><strong>${fechaHoy}</strong></div>
    </div>

    <div class="datos-box">
      <table class="datos-tabla">
        ${filaDupla('Inquilino', inquilino?.nombre, 'Inmueble', inquilino?.nombre_inmueble)}
        ${fila('Tomador del contrato', inquilino?.tomador_contrato)}
        ${filaDupla(
          'Inicio del contrato', formatFecha(inquilino?.fecha_inicio_contrato),
          'Fin del contrato', formatFecha(inquilino?.fecha_fin_contrato)
        )}
        ${inquilino?.importe_renta ? fila('Renta mensual', parseFloat(inquilino.importe_renta).toFixed(2) + ' €/mes') : ''}
      </table>
    </div>

    ${valoracionHtml(val, 'Valoración jurídica', valDesc)}

    ${sec('Cláusulas principales', analisis.clausulas_principales, '#2563eb', '#eff6ff', '#1d4ed8')}
    ${sec('Cláusulas perjudiciales para el arrendador', analisis.clausulas_perjudiciales, '#dc2626', '#fef2f2', '#b91c1c')}
    ${sec('Obligaciones del inquilino', analisis.obligaciones_inquilino, '#6b7280', '#f9fafb', '#4b5563')}
    ${sec('Obligaciones del propietario', analisis.obligaciones_propietario, '#6b7280', '#f9fafb', '#4b5563')}
    ${sec('Análisis jurídico — conformidad con la LAU', analisis.analisis_juridico, '#4f46e5', '#eef2ff', '#4338ca')}
    ${sec('Recomendaciones', analisis.recomendaciones_contrato, '#16a34a', '#f0fdf4', '#15803d')}

    <div class="footer">
      Informe generado el ${fechaHoy} · Gestión de Seguros
      ${analisis.fecha_ultimo_analisis_contrato ? ` · Análisis IA: ${formatFecha(analisis.fecha_ultimo_analisis_contrato)}` : ''}
    </div>
  `;

  abrirVentana(`Informe Jurídico — ${inquilino?.nombre || ''}`, cuerpo);
}
