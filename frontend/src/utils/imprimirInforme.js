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

function descargar(nombre, titulo, cuerpo, cssExtra) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${esc(titulo)}</title>
  <style>${cssExtra || CSS}</style>
</head>
<body>
  ${cuerpo}
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
        ${poliza.nombre_inmueble ? fila('Inmueble', poliza.nombre_inmueble) : ''}
        ${filaDupla('Compañía', poliza.compania_aseguradora, 'Nº Póliza', poliza.numero_poliza)}
        ${filaDupla('Tipo', tipo, 'Tomador', poliza.tomador_poliza)}
        ${poliza.nombre_inquilino ? fila('Inquilino', poliza.nombre_inquilino) : ''}
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

  const nombreArchivo = `informe-poliza-${(poliza.numero_poliza || poliza.compania_aseguradora || poliza.id || 'sin-numero').replace(/[^a-z0-9]/gi, '-')}.html`;
  descargar(
    nombreArchivo,
    `Informe Póliza — ${poliza.compania_aseguradora || ''} ${poliza.numero_poliza || ''}`,
    cuerpo
  );
}

export function imprimirComparador(datos, tipo) {
  const { resumen, polizas = [], tabla_coberturas = [], analisis_propietario_inquilino: api, recomendacion } = datos;
  const fechaHoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const mejorId = recomendacion?.mejor_id;
  const titulo = tipo === 'inquilinos' ? 'Comparador de pólizas de inquilinos' : 'Comparador de pólizas de inmuebles';
  const tieneCapitales = polizas.some((p) => p.capitales);

  const css = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; padding: 28px 36px; }
.header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1e3a5f; padding-bottom: 14px; margin-bottom: 20px; }
.logo { font-size: 18px; font-weight: 800; color: #1e3a5f; }
.logo small { display: block; font-size: 11px; font-weight: 400; color: #6b7280; margin-top: 2px; }
.fecha { font-size: 11px; color: #9ca3af; text-align: right; line-height: 1.6; }
.resumen { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; font-size: 12px; color: #374151; line-height: 1.6; }
.resumen strong { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px; }
h3.st { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 8px; margin-top: 20px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 11px; border-radius: 8px; overflow: hidden; }
th.dark { background: #1e3a5f; color: #fff; font-weight: 600; padding: 10px 10px; text-align: center; border: none; }
th.dark-left { background: #1e3a5f; color: rgba(255,255,255,0.5); font-weight: 600; padding: 10px 10px; text-align: left; border: none; }
td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; color: #374151; }
td.campo { background: #f9fafb; font-weight: 600; color: #6b7280; font-size: 11px; }
td.centro { text-align: center; }
tr.sep td { background: #f1f5f9; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; padding: 4px 10px; }
tr.stripe { background: #fafbfc; }
.mejor-th { background: rgba(16,185,129,0.15) !important; }
.badge-mejor { display: inline-block; font-size: 9px; background: #10b981; color: #fff; padding: 2px 7px; border-radius: 10px; margin-top: 3px; }
.sem-verde { color: #059669; font-weight: 700; }
.sem-rojo { color: #dc2626; font-weight: 700; }
.sem-amarillo { color: #d97706; font-weight: 700; }
.green-cell { background: #ecfdf5; color: #065f46; padding: 2px 4px; border-radius: 3px; margin-bottom: 2px; }
.red-cell { background: #fef2f2; color: #991b1b; padding: 2px 4px; border-radius: 3px; margin-bottom: 2px; }
.yellow-cell { background: #fffbeb; color: #92400e; }
ul { list-style: none; padding: 0; }
li { margin-bottom: 3px; }
.reco { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 2px solid #6ee7b7; border-radius: 10px; padding: 16px 18px; margin-top: 6px; }
.reco strong { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #059669; margin-bottom: 6px; }
.reco p { font-size: 12px; color: #064e3b; line-height: 1.6; }
.api-grid { display: flex; gap: 10px; margin-bottom: 18px; }
.api-card { flex: 1; border-radius: 8px; padding: 12px 14px; font-size: 11px; line-height: 1.5; }
.api-blue { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
.api-amber { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
.api-red { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
.api-card h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
.footer { border-top: 1px solid #e5e7eb; margin-top: 24px; padding-top: 8px; font-size: 10px; color: #9ca3af; text-align: center; }
@media print { body { padding: 0; } @page { margin: 1.5cm; size: A4 landscape; } }
`;

  function fmtEur(v) {
    if (v == null) return '—';
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
  }

  function stars(v) {
    if (v == null) return '—';
    const n = Math.min(5, Math.max(0, Math.round(parseFloat(v) / 2)));
    return '⭐'.repeat(n) + '☆'.repeat(5 - n) + ` <span style="font-size:10px;color:#6b7280">(${parseFloat(v).toFixed(0)}/10)</span>`;
  }

  function cellColor(v) {
    if (!v) return '';
    const s = String(v);
    if (s.includes('✅')) return 'green-cell';
    if (s.includes('❌')) return 'red-cell';
    if (s.includes('⚠️')) return 'yellow-cell';
    return '';
  }

  // Semaphore for numeric comparison
  function sem(polizas, fn, mejorEs) {
    const vals = polizas.map(fn);
    const validos = vals.filter((v) => v !== null && !isNaN(v));
    if (validos.length < 2) return polizas.map(() => '');
    const mejor = mejorEs === 'alto' ? Math.max(...validos) : Math.min(...validos);
    const peor = mejorEs === 'alto' ? Math.min(...validos) : Math.max(...validos);
    if (mejor === peor) return polizas.map(() => '');
    return vals.map((v) => {
      if (v === null || isNaN(v)) return '';
      if (v === mejor) return 'sem-verde';
      if (v === peor) return 'sem-rojo';
      return 'sem-amarillo';
    });
  }

  const semPrima = sem(polizas, (p) => p.prima_anual != null ? parseFloat(p.prima_anual) : null, 'bajo');
  const semVal = sem(polizas, (p) => p.valoracion != null ? parseFloat(p.valoracion) : null, 'alto');
  const semCont = tieneCapitales ? sem(polizas, (p) => p.capitales?.continente != null ? parseFloat(p.capitales.continente) : null, 'alto') : [];
  const semCndo = tieneCapitales ? sem(polizas, (p) => p.capitales?.contenido != null ? parseFloat(p.capitales.contenido) : null, 'alto') : [];
  const semRC = tieneCapitales ? sem(polizas, (p) => p.capitales?.responsabilidad_civil != null ? parseFloat(p.capitales.responsabilidad_civil) : null, 'alto') : [];

  // Header
  const thPolizas = polizas.map((p) => {
    const esMejor = p.id === mejorId;
    let label = esc(p.etiqueta || p.compania || `Póliza ${p.id}`);
    if (p.nombre_inmueble) label += `<br><span style="font-weight:400;opacity:0.5;font-size:10px">${esc(p.nombre_inmueble)}</span>`;
    if (esMejor) label += `<br><span class="badge-mejor">🏆 Mejor</span>`;
    return `<th class="dark ${esMejor ? 'mejor-th' : ''}">${label}</th>`;
  }).join('');

  function filaTabla(emoji, campo, fn, semArr, stripe) {
    const celdas = polizas.map((p, i) => {
      const cls = semArr && semArr[i] ? semArr[i] : '';
      return `<td class="centro ${cls}">${fn(p)}</td>`;
    }).join('');
    return `<tr${stripe ? ' class="stripe"' : ''}><td class="campo">${emoji} ${campo}</td>${celdas}</tr>`;
  }

  // Main table
  let tablaRows = '';
  tablaRows += filaTabla('💰', 'Prima anual', (p) => `<strong>${fmtEur(p.prima_anual)}</strong>`, semPrima, false);

  if (tieneCapitales) {
    tablaRows += `<tr class="sep"><td colspan="${polizas.length + 1}">Capitales asegurados</td></tr>`;
    tablaRows += filaTabla('🏠', 'Continente', (p) => `<strong>${fmtEur(p.capitales?.continente)}</strong>`, semCont, false);
    tablaRows += filaTabla('📦', 'Contenido', (p) => `<strong>${fmtEur(p.capitales?.contenido)}</strong>`, semCndo, true);
    tablaRows += filaTabla('⚖️', 'Responsabilidad Civil', (p) => `<strong>${fmtEur(p.capitales?.responsabilidad_civil)}</strong>`, semRC, false);
  } else {
    tablaRows += filaTabla('🏗️', 'Capital asegurado', (p) => esc(p.capital_asegurado || '—'), null, true);
  }

  tablaRows += filaTabla('🔒', 'Franquicia', (p) => esc(p.franquicia || '—'), null, true);

  tablaRows += `<tr class="sep"><td colspan="${polizas.length + 1}">Análisis de riesgos</td></tr>`;

  // Riesgos cubiertos
  tablaRows += `<tr><td class="campo">✅ Riesgos cubiertos</td>${polizas.map((p) =>
    `<td>${Array.isArray(p.riesgos_cubiertos) && p.riesgos_cubiertos.length
      ? `<ul>${p.riesgos_cubiertos.map((r) => `<li class="green-cell">✅ ${esc(r)}</li>`).join('')}</ul>`
      : '—'}</td>`
  ).join('')}</tr>`;

  // Riesgos NO cubiertos
  tablaRows += `<tr class="stripe"><td class="campo">❌ No cubiertos</td>${polizas.map((p) =>
    `<td>${Array.isArray(p.riesgos_no_cubiertos) && p.riesgos_no_cubiertos.length
      ? `<ul>${p.riesgos_no_cubiertos.map((r) => `<li class="red-cell">❌ ${esc(r)}</li>`).join('')}</ul>`
      : '—'}</td>`
  ).join('')}</tr>`;

  tablaRows += filaTabla('⛔', 'Exclusiones', (p) => esc(p.exclusiones || '—'), null, false);
  tablaRows += filaTabla('💪', 'Fortalezas', (p) => esc(p.fortalezas || '—'), null, true);
  tablaRows += filaTabla('⭐', 'Valoración', (p) => stars(p.valoracion), semVal, false);

  const tablaComparativa = `
<h3 class="st">Tabla comparativa</h3>
<table>
  <thead><tr><th class="dark-left" style="width:180px"></th>${thPolizas}</tr></thead>
  <tbody>${tablaRows}</tbody>
</table>`;

  // Coverage table
  const tablaCoberturas = tabla_coberturas.length > 0 ? `
<h3 class="st">Detalle de coberturas</h3>
<table>
  <thead><tr><th class="dark-left">Cobertura</th>${polizas.map((p) => `<th class="dark">${esc(p.compania || `Póliza ${p.id}`)}</th>`).join('')}</tr></thead>
  <tbody>
    ${tabla_coberturas.map((f, i) => `<tr${i % 2 ? ' class="stripe"' : ''}>
      <td class="campo">${esc(f.cobertura)}</td>
      ${(f.valores || []).map((v) => `<td class="centro ${cellColor(v)}" style="font-weight:600">${v || '—'}</td>`).join('')}
    </tr>`).join('')}
  </tbody>
</table>` : '';

  // Propietario vs Inquilino
  let htmlApi = '';
  if (api && (api.cubre_propietario?.length || api.debe_cubrir_inquilino?.length || api.gaps_cobertura?.length)) {
    htmlApi = `<h3 class="st">🏠 Propietario vs 👤 Inquilino</h3><div class="api-grid">`;
    if (api.cubre_propietario?.length) {
      htmlApi += `<div class="api-card api-blue"><h4>🏠 Cubre el propietario</h4><ul>${api.cubre_propietario.map((x) => `<li>✅ ${esc(x)}</li>`).join('')}</ul></div>`;
    }
    if (api.debe_cubrir_inquilino?.length) {
      htmlApi += `<div class="api-card api-amber"><h4>👤 Debe cubrir el inquilino</h4><ul>${api.debe_cubrir_inquilino.map((x) => `<li>⚠️ ${esc(x)}</li>`).join('')}</ul></div>`;
    }
    if (api.gaps_cobertura?.length) {
      htmlApi += `<div class="api-card api-red"><h4>🚨 Gaps de cobertura</h4><ul>${api.gaps_cobertura.map((x) => `<li>❌ ${esc(x)}</li>`).join('')}</ul></div>`;
    }
    htmlApi += '</div>';
  }

  const htmlResumen = resumen ? `<div class="resumen"><strong>Resumen ejecutivo</strong>${esc(resumen)}</div>` : '';

  const htmlRecomendacion = recomendacion ? `
<div class="reco">
  <strong>🏆 Recomendación</strong>
  ${mejorId ? `<p style="font-weight:700;margin-bottom:6px;">🏆 Mejor opción: ${esc(polizas.find((p) => p.id === mejorId)?.etiqueta || `Póliza ID ${mejorId}`)}</p>` : ''}
  <p>${esc(recomendacion.texto)}</p>
</div>` : '';

  const cuerpo = `
<div class="header">
  <div>
    <div class="logo">Gestión de Seguros<small>${esc(titulo)}</small></div>
  </div>
  <div class="fecha">Generado el<br><strong>${fechaHoy}</strong></div>
</div>
${htmlResumen}
${tablaComparativa}
${tablaCoberturas}
${htmlApi}
${htmlRecomendacion}
<div class="footer">Informe generado el ${fechaHoy} · Gestión de Seguros</div>`;

  descargar('comparador-polizas.html', titulo, cuerpo, css);
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

  const nombreArchivo = `informe-contrato-${(inquilino?.nombre || 'inquilino').replace(/[^a-z0-9]/gi, '-')}.html`;
  descargar(nombreArchivo, `Informe Jurídico — ${inquilino?.nombre || ''}`, cuerpo);
}
