import Modal from './Modal.jsx';
import { Download } from 'lucide-react';
import { imprimirComparador } from '../utils/imprimirInforme.js';
import { useNavigate } from 'react-router-dom';

function colorValoracion(v) {
  if (!v && v !== 0) return 'bg-gray-100 text-gray-500';
  if (v >= 7) return 'bg-green-100 text-green-700';
  if (v >= 5) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

function colorCelda(valor) {
  if (valor === '✅') return 'bg-green-50 text-green-700';
  if (valor === '❌') return 'bg-red-50 text-red-700';
  if (valor === '⚠️') return 'bg-yellow-50 text-yellow-700';
  return 'bg-gray-50 text-gray-600';
}

export default function ModalComparador({ abierto, onCerrar, datos, tipo }) {
  const navigate = useNavigate();
  if (!datos) return null;

  const { resumen, polizas = [], tabla_coberturas = [], recomendacion } = datos;
  const mejorId = recomendacion?.mejor_id;

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={`Comparador de pólizas${tipo === 'inquilinos' ? ' de inquilinos' : ''}`}
      ancho="max-w-5xl"
    >
      <div className="space-y-6 print:space-y-4">

        {/* Botón descargar */}
        <div className="flex justify-end">
          <button
            onClick={() => { imprimirComparador(datos, tipo); onCerrar(); navigate('/polizas'); }}
            className="btn-secundario flex items-center gap-2"
          >
            <Download size={14} />
            Descargar informe
          </button>
        </div>

        {/* Resumen ejecutivo */}
        {resumen && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Resumen ejecutivo</h3>
            <p className="text-sm text-gray-700">{resumen}</p>
          </div>
        )}

        {/* Tabla comparativa por póliza */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tabla comparativa</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 bg-gray-100 text-gray-600 font-semibold rounded-tl-lg w-36">Campo</th>
                  {polizas.map((p) => (
                    <th
                      key={p.id}
                      className={`py-2 px-3 text-center font-semibold text-sm ${
                        p.id === mejorId
                          ? 'bg-green-100 text-green-800 border-b-2 border-green-400'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {p.etiqueta || p.compania || `Póliza ${p.id}`}
                      {p.id === mejorId && (
                        <span className="ml-1 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full">⭐ Mejor</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Compañía */}
                <tr className="border-t border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50">Compañía</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2 px-3 text-center text-gray-700">{p.compania || '—'}</td>
                  ))}
                </tr>
                {/* Prima anual */}
                <tr className="border-t border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50">Prima anual</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2 px-3 text-center text-gray-700">
                      {p.prima_anual != null ? `${parseFloat(p.prima_anual).toFixed(2)} €` : '—'}
                    </td>
                  ))}
                </tr>
                {/* Capital asegurado */}
                <tr className="border-t border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50">Capital asegurado</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2 px-3 text-center text-gray-700 text-xs">{p.capital_asegurado || '—'}</td>
                  ))}
                </tr>
                {/* Franquicia */}
                <tr className="border-t border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50">Franquicia</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2 px-3 text-center text-gray-700 text-xs">{p.franquicia || '—'}</td>
                  ))}
                </tr>
                {/* Riesgos cubiertos */}
                <tr className="border-t border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50 align-top">Riesgos cubiertos</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2 px-3 align-top">
                      {Array.isArray(p.riesgos_cubiertos) && p.riesgos_cubiertos.length > 0 ? (
                        <ul className="space-y-0.5">
                          {p.riesgos_cubiertos.map((r, i) => (
                            <li key={i} className="text-xs text-green-700 flex items-start gap-1">
                              <span className="mt-0.5">✅</span> {r}
                            </li>
                          ))}
                        </ul>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                  ))}
                </tr>
                {/* Riesgos NO cubiertos */}
                <tr className="border-t border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50 align-top">Riesgos NO cubiertos</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2 px-3 align-top">
                      {Array.isArray(p.riesgos_no_cubiertos) && p.riesgos_no_cubiertos.length > 0 ? (
                        <ul className="space-y-0.5">
                          {p.riesgos_no_cubiertos.map((r, i) => (
                            <li key={i} className="text-xs text-red-700 flex items-start gap-1">
                              <span className="mt-0.5">❌</span> {r}
                            </li>
                          ))}
                        </ul>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                  ))}
                </tr>
                {/* Exclusiones */}
                <tr className="border-t border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50 align-top">Exclusiones</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2 px-3 text-xs text-gray-600 align-top">{p.exclusiones || '—'}</td>
                  ))}
                </tr>
                {/* Fortalezas */}
                <tr className="border-t border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50 align-top">Fortalezas</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2 px-3 text-xs text-green-700 bg-green-50 align-top">{p.fortalezas || '—'}</td>
                  ))}
                </tr>
                {/* Valoración */}
                <tr className="border-t border-gray-100">
                  <td className="py-2 px-3 font-medium text-gray-500 bg-gray-50">Valoración</td>
                  {polizas.map((p) => (
                    <td key={p.id} className="py-2 px-3 text-center">
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${colorValoracion(p.valoracion)}`}>
                        {p.valoracion != null ? `${p.valoracion}/10` : '—'}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabla de coberturas */}
        {tabla_coberturas.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Coberturas por póliza</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3 bg-gray-100 text-gray-600 font-semibold rounded-tl-lg">Cobertura</th>
                    {polizas.map((p) => (
                      <th key={p.id} className="py-2 px-3 text-center bg-gray-100 text-gray-600 font-semibold text-xs">
                        {p.compania || `Póliza ${p.id}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tabla_coberturas.map((fila, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-gray-700 font-medium bg-gray-50 text-xs">{fila.cobertura}</td>
                      {(fila.valores || []).map((v, j) => (
                        <td key={j} className={`py-2 px-3 text-center text-base ${colorCelda(v)}`}>{v || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recomendación */}
        {recomendacion && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">Recomendación IA</h3>
            {mejorId && (
              <p className="font-semibold text-green-800 mb-2">
                ⭐ Mejor opción:{' '}
                {polizas.find((p) => p.id === mejorId)?.etiqueta || `Póliza ID ${mejorId}`}
              </p>
            )}
            <p className="text-sm text-green-800">{recomendacion.texto}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
