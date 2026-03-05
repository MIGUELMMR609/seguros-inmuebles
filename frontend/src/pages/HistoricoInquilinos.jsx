import { useEffect, useState } from 'react';
import { Archive, RotateCcw, AlertTriangle } from 'lucide-react';
import Tabla from '../components/Tabla.jsx';
import Modal from '../components/Modal.jsx';
import { obtenerHistoricoInquilinosApi, reactivarInquilinoApi } from '../api/index.js';

export default function HistoricoInquilinos() {
  const [inquilinos, setInquilinos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [confirmandoReactivar, setConfirmandoReactivar] = useState(null);
  const [reactivando, setReactivando] = useState(false);

  async function cargar() {
    try {
      const res = await obtenerHistoricoInquilinosApi();
      setInquilinos(res.data);
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
      clave: 'acciones', titulo: 'Acciones', ancho: '90px',
      render: (f) => (
        <button
          onClick={() => setConfirmandoReactivar(f)}
          title="Reactivar inquilino"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
        >
          <RotateCcw size={13} />
          Reactivar
        </button>
      ),
    },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
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
