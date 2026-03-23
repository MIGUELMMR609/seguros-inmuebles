import Modal from './Modal.jsx';
import { Download } from 'lucide-react';
import { imprimirComparador } from '../utils/imprimirInforme.js';
import { formatearMiles } from '../utils/moneda.js';
import { useNavigate } from 'react-router-dom';

/* ── Helpers ── */

function fmt(v) {
  if (v == null) return '—';
  return formatearMiles(parseFloat(v).toFixed(0)) + ' €';
}

function estrellas(val) {
  if (val == null) return '—';
  const n = Math.min(5, Math.max(0, Math.round(val / 2)));
  return '⭐'.repeat(n) + '☆'.repeat(5 - n);
}

function colorCelda(v) {
  if (!v) return '';
  const s = String(v);
  if (s.includes('✅')) return 'bg-emerald-50 text-emerald-700';
  if (s.includes('❌')) return 'bg-red-50 text-red-700';
  if (s.includes('⚠️')) return 'bg-amber-50 text-amber-700';
  return '';
}

function semaforo(polizas, campo, mejorEs = 'alto') {
  const vals = polizas.map((p) => {
    const v = typeof campo === 'function' ? campo(p) : p[campo];
    return v != null ? parseFloat(v) : null;
  });
  const validos = vals.filter((v) => v !== null);
  if (validos.length < 2) return polizas.map(() => 'neutral');
  const mejor = mejorEs === 'alto' ? Math.max(...validos) : Math.min(...validos);
  const peor = mejorEs === 'alto' ? Math.min(...validos) : Math.max(...validos);
  if (mejor === peor) return polizas.map(() => 'neutral');
  return vals.map((v) => {
    if (v === null) return 'neutral';
    if (v === mejor) return 'verde';
    if (v === peor) return 'rojo';
    return 'amarillo';
  });
}

function semClase(tipo) {
  if (tipo === 'verde') return 'text-emerald-700 font-bold';
  if (tipo === 'rojo') return 'text-red-600 font-bold';
  if (tipo === 'amarillo') return 'text-amber-600 font-bold';
  return 'text-gray-700';
}

function semBg(tipo) {
  if (tipo === 'verde') return 'bg-emerald-50/60';
  if (tipo === 'rojo') return 'bg-red-50/60';
  if (tipo === 'amarillo') return 'bg-amber-50/60';
  return '';
}

/* ── Component ── */

export default function ModalComparador({ abierto, onCerrar, onDescargar, datos, tipo, tituloOverride }) {
  const navigate = useNavigate();
  if (!datos) return null;

  const { resumen, polizas = [], tabla_coberturas = [], analisis_propietario_inquilino: api, recomendacion } = datos;
  const mejorId = recomendacion?.mejor_id;
  const n = polizas.length;

  // Backward compat: old format had capital_asegurado string, new has capitales object
  const tieneCapitales = polizas.some((p) => p.capitales);

  // Semaphore calculations
  const semPrima = semaforo(polizas, 'prima_anual', 'bajo');
  const semVal = semaforo(polizas, 'valoracion', 'alto');
  const semCont = tieneCapitales ? semaforo(polizas, (p) => p.capitales?.continente, 'alto') : [];
  const semCndo = tieneCapitales ? semaforo(polizas, (p) => p.capitales?.contenido, 'alto') : [];
  const semRC = tieneCapitales ? semaforo(polizas, (p) => p.capitales?.responsabilidad_civil, 'alto') : [];

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={tituloOverride || `Comparador de pólizas${tipo === 'inquilinos' ? ' de inquilinos' : ''}`}
      ancho="max-w-6xl"
    >
      <div className="space-y-6">

        {/* Download button */}
        <div className="flex justify-end">
          <button
            onClick={() => { imprimirComparador(datos, tipo); if (onDescargar) onDescargar(); else { onCerrar(); navigate('/polizas'); } }}
            className="btn-secundario flex items-center gap-2"
          >
            <Download size={14} /> Descargar informe
          </button>
        </div>

        {/* Resumen ejecutivo */}
        {resumen && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">Resumen ejecutivo</h3>
            <p className="text-sm text-slate-700 leading-relaxed">{resumen}</p>
          </div>
        )}

        {/* ── Tabla comparativa principal ── */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Tabla comparativa</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-sm">
              {/* Dark header */}
              <thead>
                <tr className="bg-[#1e3a5f]">
                  <th className="text-left py-3 px-4 text-white/50 font-semibold text-xs w-44"></th>
                  {polizas.map((p) => (
                    <th key={p.id} className={`py-3 px-4 text-center text-white text-xs ${p.id === mejorId ? 'bg-emerald-500/20' : ''}`}>
                      <div className="font-bold">{p.etiqueta || p.compania || `Póliza ${p.id}`}</div>
                      {p.nombre_inmueble && <div className="font-normal text-white/40 mt-0.5 text-[10px]">{p.nombre_inmueble}</div>}
                      {p.nombre_inquilino && <div className="font-normal text-white/40 text-[10px]">{p.nombre_inquilino}</div>}
                      {p.id === mejorId && (
                        <span className="inline-block mt-1.5 text-[9px] bg-emerald-400 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                          🏆 Mejor
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Prima anual */}
                <tr className="border-b border-slate-100">
                  <td className="py-2.5 px-4 font-semibold text-slate-500 bg-slate-50 text-xs">💰 Prima anual</td>
                  {polizas.map((p, i) => (
                    <td key={p.id} className={`py-2.5 px-4 text-center ${semBg(semPrima[i])}`}>
                      <span className={`text-sm font-bold ${semClase(semPrima[i])}`}>{fmt(p.prima_anual)}</span>
                    </td>
                  ))}
                </tr>

                {/* Capitales (new format) */}
                {tieneCapitales && (
                  <>
                    <tr className="bg-slate-100/60">
                      <td colSpan={n + 1} className="py-1.5 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Capitales asegurados
                      </td>
                    </tr>
                    <tr className="border-b border-slate-50">
                      <td className="py-2 px-4 pl-7 text-xs text-slate-500 bg-slate-50/50">🏠 Continente</td>
                      {polizas.map((p, i) => (
                        <td key={p.id} className={`py-2 px-4 text-center ${semBg(semCont[i])}`}>
                          <span className={`text-sm font-bold ${semClase(semCont[i])}`}>{fmt(p.capitales?.continente)}</span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-50 bg-white">
                      <td className="py-2 px-4 pl-7 text-xs text-slate-500 bg-slate-50/50">📦 Contenido</td>
                      {polizas.map((p, i) => (
                        <td key={p.id} className={`py-2 px-4 text-center ${semBg(semCndo[i])}`}>
                          <span className={`text-sm font-bold ${semClase(semCndo[i])}`}>{fmt(p.capitales?.contenido)}</span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-2 px-4 pl-7 text-xs text-slate-500 bg-slate-50/50">⚖️ Responsabilidad Civil</td>
                      {polizas.map((p, i) => (
                        <td key={p.id} className={`py-2 px-4 text-center ${semBg(semRC[i])}`}>
                          <span className={`text-sm font-bold ${semClase(semRC[i])}`}>{fmt(p.capitales?.responsabilidad_civil)}</span>
                        </td>
                      ))}
                    </tr>
                  </>
                )}

                {/* Capital asegurado (old format fallback) */}
                {!tieneCapitales && (
                  <tr className="border-b border-slate-100">
                    <td className="py-2.5 px-4 font-semibold text-slate-500 bg-slate-50 text-xs">🏗️ Capital asegurado</td>
                    {polizas.map((p) => (
                      <td key={p.id} className="py-2.5 px-4 text-center text-xs text-slate-600">{p.capital_asegurado || '—'}</td>
                    ))}
                  </tr>
                )}

                {/* Franquicia */}
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  <td className="py-2.5 px-4 font-semibold text-slate-500 bg-slate-50 text-xs">🔒 Franquicia</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2.5 px-4 text-center text-xs text-slate-600">{p.franquicia || '—'}</td>
                  ))}
                </tr>

                {/* Separator */}
                <tr className="bg-slate-100/60">
                  <td colSpan={n + 1} className="py-1.5 px-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Análisis de riesgos
                  </td>
                </tr>

                {/* Riesgos cubiertos */}
                <tr className="border-b border-slate-100">
                  <td className="py-2.5 px-4 font-semibold text-slate-500 bg-slate-50 text-xs align-top">✅ Riesgos cubiertos</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2.5 px-4 align-top">
                      {Array.isArray(p.riesgos_cubiertos) && p.riesgos_cubiertos.length > 0 ? (
                        <ul className="space-y-0.5">
                          {p.riesgos_cubiertos.map((r, i) => (
                            <li key={i} className="text-[11px] text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 flex items-start gap-1">
                              <span className="shrink-0">✅</span> {r}
                            </li>
                          ))}
                        </ul>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  ))}
                </tr>

                {/* Riesgos NO cubiertos */}
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  <td className="py-2.5 px-4 font-semibold text-slate-500 bg-slate-50 text-xs align-top">❌ No cubiertos</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2.5 px-4 align-top">
                      {Array.isArray(p.riesgos_no_cubiertos) && p.riesgos_no_cubiertos.length > 0 ? (
                        <ul className="space-y-0.5">
                          {p.riesgos_no_cubiertos.map((r, i) => (
                            <li key={i} className="text-[11px] text-red-700 bg-red-50 rounded px-1.5 py-0.5 flex items-start gap-1">
                              <span className="shrink-0">❌</span> {r}
                            </li>
                          ))}
                        </ul>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  ))}
                </tr>

                {/* Exclusiones */}
                <tr className="border-b border-slate-100">
                  <td className="py-2.5 px-4 font-semibold text-slate-500 bg-slate-50 text-xs align-top">⛔ Exclusiones</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2.5 px-4 text-[11px] text-slate-600 align-top">{p.exclusiones || '—'}</td>
                  ))}
                </tr>

                {/* Fortalezas */}
                <tr className="border-b border-slate-100 bg-slate-50/30">
                  <td className="py-2.5 px-4 font-semibold text-slate-500 bg-slate-50 text-xs align-top">💪 Fortalezas</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2.5 px-4 text-[11px] text-emerald-700 bg-emerald-50/30 align-top">{p.fortalezas || '—'}</td>
                  ))}
                </tr>

                {/* Valoración */}
                <tr>
                  <td className="py-3 px-4 font-semibold text-slate-500 bg-slate-50 text-xs">⭐ Valoración</td>
                  {polizas.map((p, i) => (
                    <td key={p.id} className={`py-3 px-4 text-center ${semBg(semVal[i])}`}>
                      <div className="text-base leading-none">{estrellas(p.valoracion)}</div>
                      <div className={`text-[10px] mt-1 ${semClase(semVal[i])}`}>
                        {p.valoracion != null ? `${p.valoracion}/10` : '—'}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Tabla de coberturas detallada ── */}
        {tabla_coberturas.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">Detalle de coberturas</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1e3a5f]">
                    <th className="text-left py-2.5 px-4 text-white/60 font-semibold text-xs">Cobertura</th>
                    {polizas.map((p) => (
                      <th key={p.id} className="py-2.5 px-4 text-center text-white font-semibold text-xs">
                        {p.compania || `Póliza ${p.id}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabla_coberturas.map((fila, i) => (
                    <tr key={i} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                      <td className="py-2 px-4 text-xs font-medium text-slate-600">{fila.cobertura}</td>
                      {(fila.valores || []).map((v, j) => (
                        <td key={j} className={`py-2 px-4 text-center text-xs font-semibold ${colorCelda(v)}`}>{v || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Propietario vs Inquilino ── */}
        {api && (api.cubre_propietario?.length > 0 || api.debe_cubrir_inquilino?.length > 0 || api.gaps_cobertura?.length > 0) && (
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-3">
              🏠 Propietario vs 👤 Inquilino
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Cubre propietario */}
              {api.cubre_propietario?.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-2.5">🏠 Cubre el propietario</h4>
                  <ul className="space-y-1.5">
                    {api.cubre_propietario.map((item, i) => (
                      <li key={i} className="text-[11px] text-blue-700 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">✅</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Debe cubrir inquilino */}
              {api.debe_cubrir_inquilino?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-2.5">👤 Debe cubrir el inquilino</h4>
                  <ul className="space-y-1.5">
                    {api.debe_cubrir_inquilino.map((item, i) => (
                      <li key={i} className="text-[11px] text-amber-700 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">⚠️</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Gaps */}
              {api.gaps_cobertura?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-2.5">🚨 Gaps de cobertura</h4>
                  <ul className="space-y-1.5">
                    {api.gaps_cobertura.map((item, i) => (
                      <li key={i} className="text-[11px] text-red-700 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5">❌</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Recomendación ── */}
        {recomendacion && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-500 mb-2">🏆 Recomendación</h3>
            {mejorId && (
              <p className="font-bold text-emerald-800 mb-2 text-sm">
                🏆 Mejor opción:{' '}
                {polizas.find((p) => p.id === mejorId)?.etiqueta || `Póliza ID ${mejorId}`}
              </p>
            )}
            <p className="text-sm text-emerald-800 leading-relaxed">{recomendacion.texto}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
