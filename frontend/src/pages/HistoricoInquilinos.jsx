import { useEffect, useState } from 'react';
import { Archive, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import Tabla from '../components/Tabla.jsx';
import Modal from '../components/Modal.jsx';
import { obtenerHistoricoInquilinosApi, reactivarInquilinoApi, obtenerHistoricoRenovacionesApi } from '../api/index.js';

export default function HistoricoInquilinos() {
  const [inquilinos, setInquilinos] = useState([]);
  const [renovaciones, setRenovaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [confirmandoReactivar, setConfirmandoReactivar] = useState(null);
  const [reactivando, setReactivando] = useState(false);

  async function cargar() {
    try {
      const [resInq, resRen] = await Promise.all([
        obtenerHistoricoInquilinosApi(),
        obtenerHistoricoRenovacionesApi(),
      ]);
      setInquilinos(resInq.data);
      setRenovaciones(resRen.data);
    } catch {
      setError('Error al cargar el histórico de inquilinos');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function handleReactivar() {
    setReactivando(true);
    try {
      await reactivarInquilinoApi(confirmandoReactivar.id);
      setConfirmandoReactivar(null);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al reactivar el inquilino');
    } finally {
      setReactivando(false);
    }
  }

  const columnas = [
    {
      clave: 'nombre_inmueble', titulo: 'Inmueble', sortable: true,
      valorOrden: (f) => f.nombre_inmueble || '',
      render: (f) => <span className="font-medium">{f.nombre_inmueble || '—'}</span>,
    },
    { clave: 'nombre', titulo: 'Inquilino', render: (f) => f.nombre },
    {
      clave: 'email', titulo: 'Email',
      render: (f) => f.email
        ? <a href={`mailto:${f.email}`} className="text-[#1e3a5f] hover:underline">{f.email}</a>
        : '—',
    },
    {
      clave: 'fecha_inicio_contrato', titulo: 'Inicio contrato',
      render: (f) => f.fecha_inicio_contrato
        ? new Date(f.fecha_inicio_contrato).toLocaleDateString('es-ES')
        : '—',
    },
    {
      clave: 'fecha_fin_contrato', titulo: 'Fin contrato', sortable: true,
      valorOrden: (f) => f.fecha_fin_contrato || '9999-12-31',
      render: (f) => f.fecha_fin_contrato
        ? new Date(f.fecha_fin_contrato).toLocaleDateString('es-ES')
        : '—',
    },
    {
      clave: 'importe_renta', titulo: 'Renta/mes',
      render: (f) => f.importe_renta
        ? `${parseFloat(f.importe_renta).toFixed(2)} €`
        : '—',
    },
    {
      clave: 'fecha_finalizacion', titulo: 'Finalizado',
      render: (f) => f.fecha_finalizacion
        ? new Date(f.fecha_finalizacion).toLocaleDateString('es-ES')
        : '—',
    },
    {
      clave: 'motivo_finalizacion', titulo: 'Motivo',
      render: (f) => f.motivo_finalizacion
        ? <span className="text-gray-500 text-sm">{f.motivo_finalizacion}</span>
        : '—',
    },
    {
      clave: 'acciones', titulo: 'Acciones', ancho: '110px',
      render: (f) => (
        <button
          onClick={() => setConfirmandoReactivar(f)}
          title="Reactivar inquilino"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
        >
          <RotateCcw size={16} />
          Reactivar
        </button>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Archive size={24} className="text-[#1e3a5f]" />
            Histórico de Inquilinos
          </h1>
          <p className="text-gray-500 text-sm mt-1">{inquilinos.length} contratos finalizados</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="tarjeta">
        <Tabla
          columnas={columnas}
          datos={inquilinos}
          cargando={cargando}
          mensajeVacio="No hay contratos finalizados en el histórico."
        />
      </div>

      {/* Sección: contratos anteriores archivados por renovación */}
      <div className="tarjeta mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <RefreshCw size={18} className="text-blue-600" />
            Contratos anteriores (renovados)
          </h2>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${renovaciones.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {renovaciones.length} registro{renovaciones.length !== 1 ? 's' : ''}
          </span>
        </div>
        {cargando ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" /></div>
        ) : renovaciones.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No hay contratos renovados aún.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
                  <th className="pb-2 pr-4">Inquilino</th>
                  <th className="pb-2 pr-4">Inmueble</th>
                  <th className="pb-2 pr-4">Período del contrato</th>
                  <th className="pb-2 pr-4">Renta/mes</th>
                  <th className="pb-2 pr-4">Cláusula adicional</th>
                  <th className="pb-2 pr-4">PDF</th>
                  <th className="pb-2 text-right">Archivado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {renovaciones.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-medium text-gray-900">{r.nombre_inquilino || '—'}</td>
                    <td className="py-3 pr-4 text-gray-600">{r.nombre_inmueble || '—'}</td>
                    <td className="py-3 pr-4 text-gray-600">
                      {r.fecha_inicio ? new Date(r.fecha_inicio).toLocaleDateString('es-ES') : '—'}
                      {' → '}
                      {r.fecha_fin ? new Date(r.fecha_fin).toLocaleDateString('es-ES') : '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {r.importe ? `${parseFloat(r.importe).toFixed(2)} €` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-500 max-w-xs">
                      {r.clausulas_adicionales
                        ? <span title={r.clausulas_adicionales}>{r.clausulas_adicionales.length > 50 ? r.clausulas_adicionales.slice(0, 50) + '…' : r.clausulas_adicionales}</span>
                        : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      {r.documento_url
                        ? <a href={r.documento_url} target="_blank" rel="noopener noreferrer" className="text-[#1e3a5f] hover:underline font-medium text-xs">Ver PDF</a>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                      {new Date(r.fecha_renovacion).toLocaleDateString('es-ES')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal confirmar reactivar */}
      <Modal
        abierto={!!confirmandoReactivar}
        onCerrar={() => setConfirmandoReactivar(null)}
        titulo="Reactivar inquilino"
        ancho="max-w-sm"
      >
        <p className="text-gray-600 text-sm mb-6">
          ¿Reactivar a <strong>{confirmandoReactivar?.nombre}</strong>? Volverá a aparecer en la lista de inquilinos activos.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmandoReactivar(null)} className="btn-secundario flex-1">
            Cancelar
          </button>
          <button
            onClick={handleReactivar}
            disabled={reactivando}
            className="btn-primario flex-1 justify-center"
          >
            {reactivando
              ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              : <><RotateCcw size={14} /> Reactivar</>
            }
          </button>
        </div>
      </Modal>
    </div>
  );
}
