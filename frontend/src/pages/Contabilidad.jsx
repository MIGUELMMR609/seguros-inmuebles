import { useEffect, useState } from 'react';
import { Calculator, Download, Printer, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { obtenerContabilidadApi } from '../api/index.js';

const ETIQUETAS_PERIODICIDAD = {
  anual: 'Anual', semestral: 'Semestral', trimestral: 'Trimestral',
};

function formatearEuro(valor) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(valor || 0);
}

function exportarCSV(meses, anio, totalAnual) {
  const cabecera = ['Mes', 'Inmueble', 'Compañía', 'Nº Póliza', 'Tipo', 'Periodicidad', 'Importe', 'Fecha Pago'];
  const filas = [cabecera.join(';')];

  meses.forEach((mes) => {
    mes.pagos.forEach((pago) => {
      filas.push([
        mes.nombre,
        pago.nombre_inmueble,
        pago.compania_aseguradora,
        pago.numero_poliza,
        pago.tipo,
        ETIQUETAS_PERIODICIDAD[pago.periodicidad] || pago.periodicidad,
        pago.importe.toFixed(2).replace('.', ','),
        pago.fecha_pago,
      ].join(';'));
    });
    if (mes.pagos.length > 0) {
      filas.push([mes.nombre, '', '', '', '', 'TOTAL MES', mes.total.toFixed(2).replace('.', ','), ''].join(';'));
    }
  });
  filas.push(['', '', '', '', '', 'TOTAL ANUAL', totalAnual.toFixed(2).replace('.', ','), ''].join(';'));

  const blob = new Blob(['\uFEFF' + filas.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `contabilidad_seguros_${anio}.csv`;
  enlace.click();
  URL.revokeObjectURL(url);
}

export default function Contabilidad() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    try {
      const res = await obtenerContabilidadApi(anio);
      setDatos(res.data);
    } catch {
      setDatos(null);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [anio]);

  const mesesConPagos = datos?.meses?.filter((m) => m.pagos.length > 0) || [];
  const totalAnual = datos?.totalAnual || 0;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator size={24} className="text-[#1e3a5f]" />
            Contabilidad
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Pagos previstos por pólizas activas
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Selector de año */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5">
            <button onClick={() => setAnio((a) => a - 1)} className="p-1 text-gray-400 hover:text-gray-700 rounded">
              <ChevronLeft size={16} />
            </button>
            <span className="font-semibold text-gray-800 w-12 text-center">{anio}</span>
            <button onClick={() => setAnio((a) => a + 1)} className="p-1 text-gray-400 hover:text-gray-700 rounded">
              <ChevronRight size={16} />
            </button>
          </div>
          {/* Exportar */}
          {datos && (
            <>
              <button
                onClick={() => exportarCSV(datos.meses, anio, totalAnual)}
                className="btn-secundario text-sm"
              >
                <Download size={15} /> Excel/CSV
              </button>
              <button
                onClick={() => window.print()}
                className="btn-secundario text-sm"
              >
                <Printer size={15} /> Imprimir
              </button>
            </>
          )}
        </div>
      </div>

      {/* Resumen anual */}
      {datos && !cargando && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="tarjeta">
            <p className="text-sm text-gray-500">Total anual</p>
            <p className="text-2xl font-bold text-[#1e3a5f] mt-1">{formatearEuro(totalAnual)}</p>
          </div>
          <div className="tarjeta">
            <p className="text-sm text-gray-500">Meses con pagos</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{mesesConPagos.length}</p>
          </div>
          <div className="tarjeta">
            <p className="text-sm text-gray-500">Total pólizas</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">
              {new Set(datos.meses.flatMap((m) => m.pagos.map((p) => p.poliza_id))).size}
            </p>
          </div>
          <div className="tarjeta">
            <p className="text-sm text-gray-500">Pago medio/mes</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">
              {mesesConPagos.length > 0
                ? formatearEuro(totalAnual / mesesConPagos.length)
                : '—'}
            </p>
          </div>
        </div>
      )}

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1e3a5f]" />
        </div>
      ) : !datos || datos.meses.every((m) => m.pagos.length === 0) ? (
        <div className="tarjeta flex flex-col items-center justify-center py-16">
          <TrendingUp size={48} className="text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-500">Sin datos para {anio}</h3>
          <p className="text-gray-400 text-sm mt-1">
            Añade fechas de próximo pago en las pólizas para ver el calendario.
          </p>
        </div>
      ) : (
        <div className="space-y-4 print-container">
          {/* Tabla anual completa */}
          <div className="tarjeta overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Mes</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Inmueble</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Compañía</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nº Póliza</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Period.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Importe</th>
                </tr>
              </thead>
              <tbody>
                {datos.meses.map((mes) => (
                  mes.pagos.length === 0 ? null : (
                    <>
                      {mes.pagos.map((pago, iPago) => (
                        <tr key={`${mes.mes}-${iPago}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          {iPago === 0 && (
                            <td
                              rowSpan={mes.pagos.length + 1}
                              className="px-4 py-3 font-bold text-[#1e3a5f] align-top border-r border-gray-100"
                            >
                              {mes.nombre}
                            </td>
                          )}
                          <td className="px-4 py-3 font-medium text-gray-800">{pago.nombre_inmueble}</td>
                          <td className="px-4 py-3 text-gray-600">{pago.compania_aseguradora}</td>
                          <td className="px-4 py-3 font-mono text-gray-600 text-xs">{pago.numero_poliza}</td>
                          <td className="px-4 py-3 text-gray-600 capitalize">{pago.tipo?.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{ETIQUETAS_PERIODICIDAD[pago.periodicidad] || pago.periodicidad}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatearEuro(pago.importe)}</td>
                        </tr>
                      ))}
                      {/* Fila total del mes */}
                      <tr className="bg-blue-50 border-b-2 border-blue-100">
                        <td colSpan={5} className="px-4 py-2 text-right text-xs font-semibold text-blue-600 uppercase tracking-wider">
                          Total {mes.nombre}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-blue-700">{formatearEuro(mes.total)}</td>
                      </tr>
                    </>
                  )
                ))}
                {/* Total anual */}
                <tr className="bg-[#1e3a5f] text-white">
                  <td colSpan={6} className="px-4 py-4 text-right font-bold text-sm uppercase tracking-wider">
                    TOTAL ANUAL {anio}
                  </td>
                  <td className="px-4 py-4 text-right font-black text-lg">{formatearEuro(totalAnual)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
