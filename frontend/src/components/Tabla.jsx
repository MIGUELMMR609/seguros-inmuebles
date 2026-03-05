import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';

export default function Tabla({
  columnas,
  datos,
  cargando = false,
  mensajeVacio = 'No hay registros disponibles',
  filasPorPagina = 10,
}) {
  const [paginaActual, setPaginaActual] = useState(1);
  const [orden, setOrden] = useState({ campo: null, dir: 'asc' });

  function toggleOrden(col) {
    setOrden((prev) =>
      prev.campo === col.clave
        ? { campo: col.clave, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { campo: col.clave, dir: 'asc' }
    );
    setPaginaActual(1);
  }

  function getValor(fila, col) {
    if (col.valorOrden) return col.valorOrden(fila);
    const v = fila[col.clave];
    return v == null ? '' : v;
  }

  const datosOrdenados = orden.campo
    ? [...datos].sort((a, b) => {
        const col = columnas.find((c) => c.clave === orden.campo);
        const va = getValor(a, col);
        const vb = getValor(b, col);
        let cmp = 0;
        if (typeof va === 'string' && typeof vb === 'string') {
          cmp = va.localeCompare(vb, 'es', { sensitivity: 'base' });
        } else {
          cmp = va < vb ? -1 : va > vb ? 1 : 0;
        }
        return orden.dir === 'asc' ? cmp : -cmp;
      })
    : datos;

  const totalPaginas = Math.ceil(datosOrdenados.length / filasPorPagina);
  const inicio = (paginaActual - 1) * filasPorPagina;
  const datosPagina = datosOrdenados.slice(inicio, inicio + filasPorPagina);

  function irAPagina(pagina) {
    if (pagina >= 1 && pagina <= totalPaginas) setPaginaActual(pagina);
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" />
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columnas.map((col) => (
                <th
                  key={col.clave}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${
                    col.sortable ? 'cursor-pointer select-none hover:text-gray-800 hover:bg-gray-100 transition-colors' : ''
                  }`}
                  style={{ width: col.ancho }}
                  onClick={col.sortable ? () => toggleOrden(col) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.titulo}
                    {col.sortable && (
                      orden.campo === col.clave
                        ? orden.dir === 'asc'
                          ? <ChevronUp size={13} className="text-[#1e3a5f]" />
                          : <ChevronDown size={13} className="text-[#1e3a5f]" />
                        : <ChevronsUpDown size={13} className="text-gray-300" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {datosPagina.length === 0 ? (
              <tr>
                <td colSpan={columnas.length} className="px-4 py-12 text-center text-gray-400 text-sm">
                  {mensajeVacio}
                </td>
              </tr>
            ) : (
              datosPagina.map((fila, indice) => (
                <tr key={fila.id ?? indice} className="hover:bg-gray-50 transition-colors">
                  {columnas.map((col) => (
                    <td key={col.clave} className="px-4 py-3 text-gray-700">
                      {col.render ? col.render(fila) : fila[col.clave] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>
            Mostrando {inicio + 1}–{Math.min(inicio + filasPorPagina, datosOrdenados.length)} de{' '}
            {datosOrdenados.length} registros
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => irAPagina(paginaActual - 1)}
              disabled={paginaActual === 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPaginas }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - paginaActual) <= 1)
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((item, i) =>
                item === '...' ? (
                  <span key={`sep-${i}`} className="px-2">…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => irAPagina(item)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      paginaActual === item ? 'bg-[#1e3a5f] text-white' : 'hover:bg-gray-100'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              onClick={() => irAPagina(paginaActual + 1)}
              disabled={paginaActual === totalPaginas}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
