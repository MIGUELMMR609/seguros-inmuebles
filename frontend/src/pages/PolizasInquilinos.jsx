import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Shield, ExternalLink, AlertTriangle } from 'lucide-react';
import Tabla from '../components/Tabla.jsx';
import Modal from '../components/Modal.jsx';
import UploadPDF from '../components/UploadPDF.jsx';
import {
  obtenerPolizasInquilinosApi,
  crearPolizaInquilinoApi,
  actualizarPolizaInquilinoApi,
  eliminarPolizaInquilinoApi,
  obtenerInquilinosApi,
} from '../api/index.js';

const formularioVacio = {
  inquilino_id: '',
  compania_aseguradora: '',
  numero_poliza: '',
  fecha_inicio: '',
  fecha_vencimiento: '',
  importe_anual: '',
  notas: '',
  documento_url: '',
};

function calcularEstado(fechaVencimiento) {
  if (!fechaVencimiento) return { etiqueta: 'Sin fecha', clase: 'bg-gray-100 text-gray-600' };
  const dias = Math.ceil((new Date(fechaVencimiento) - new Date()) / 86400000);
  if (dias < 0) return { etiqueta: 'Vencida', clase: 'bg-red-100 text-red-700' };
  if (dias <= 30) return { etiqueta: `Vence en ${dias}d`, clase: 'bg-orange-100 text-orange-700' };
  return { etiqueta: 'Vigente', clase: 'bg-green-100 text-green-700' };
}

export default function PolizasInquilinos() {
  const [polizas, setPolizas] = useState([]);
  const [inquilinos, setInquilinos] = useState([]);
  const [inquilinosSinSeguro, setInquilinosSinSeguro] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroInquilino, setFiltroInquilino] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  async function cargar() {
    try {
      const [resPolizas, resInquilinos, resTodas] = await Promise.all([
        obtenerPolizasInquilinosApi(filtroInquilino ? { inquilino_id: filtroInquilino } : {}),
        obtenerInquilinosApi(),
        obtenerPolizasInquilinosApi({}),
      ]);
      setPolizas(resPolizas.data);
      setInquilinos(resInquilinos.data);

      // Detectar inquilinos sin póliza activa (usando TODAS las polizas, sin filtro)
      const conPolizaActiva = new Set(
        resTodas.data
          .filter((p) => !p.fecha_vencimiento || new Date(p.fecha_vencimiento) >= new Date())
          .map((p) => p.inquilino_id)
      );
      setInquilinosSinSeguro(resInquilinos.data.filter((inq) => !conPolizaActiva.has(inq.id)));
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, [filtroInquilino]);

  function abrirCrear() {
    setEditando(null);
    setFormulario(formularioVacio);
    setError('');
    setModalAbierto(true);
  }

  function abrirEditar(poliza) {
    setEditando(poliza);
    setFormulario({
      inquilino_id: poliza.inquilino_id || '',
      compania_aseguradora: poliza.compania_aseguradora || '',
      numero_poliza: poliza.numero_poliza || '',
      fecha_inicio: poliza.fecha_inicio ? poliza.fecha_inicio.split('T')[0] : '',
      fecha_vencimiento: poliza.fecha_vencimiento ? poliza.fecha_vencimiento.split('T')[0] : '',
      importe_anual: poliza.importe_anual || '',
      notas: poliza.notas || '',
      documento_url: poliza.documento_url || '',
    });
    setError('');
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
    setError('');
  }

  function handleCambio(e) {
    setFormulario((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleGuardar(e) {
    e.preventDefault();
    if (!formulario.inquilino_id) {
      setError('Debes seleccionar un inquilino');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const datos = {
        ...formulario,
        importe_anual: formulario.importe_anual ? parseFloat(formulario.importe_anual) : null,
      };
      if (editando) {
        await actualizarPolizaInquilinoApi(editando.id, datos);
      } else {
        await crearPolizaInquilinoApi(datos);
      }
      await cargar();
      cerrarModal();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la póliza');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id) {
    try {
      await eliminarPolizaInquilinoApi(id);
      setConfirmandoEliminar(null);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar la póliza');
    }
  }

  const columnas = [
    {
      clave: 'nombre_inmueble', titulo: 'Inmueble', sortable: true,
      valorOrden: (f) => f.nombre_inmueble || '',
      render: (f) => <span className="font-medium">{f.nombre_inmueble || '—'}</span>,
    },
    { clave: 'nombre_inquilino', titulo: 'Inquilino', render: (f) => f.nombre_inquilino || '—' },
    {
      clave: 'compania_aseguradora', titulo: 'Compañía', sortable: true,
      valorOrden: (f) => f.compania_aseguradora || '',
    },
    { clave: 'numero_poliza', titulo: 'Nº Póliza', render: (f) => <span className="font-mono text-sm">{f.numero_poliza || '—'}</span> },
    {
      clave: 'fecha_vencimiento', titulo: 'Vencimiento', sortable: true,
      valorOrden: (f) => f.fecha_vencimiento || '9999-12-31',
      render: (f) => f.fecha_vencimiento ? new Date(f.fecha_vencimiento).toLocaleDateString('es-ES') : '—',
    },
    {
      clave: 'importe_anual',
      titulo: 'Importe',
      render: (f) => f.importe_anual ? `${parseFloat(f.importe_anual).toFixed(2)} €` : '—',
    },
    {
      clave: 'estado', titulo: 'Estado', sortable: true,
      valorOrden: (f) => f.fecha_vencimiento || '9999-12-31',
      render: (f) => {
        const estado = calcularEstado(f.fecha_vencimiento);
        return <span className={`text-xs font-semibold px-2 py-1 rounded-full ${estado.clase}`}>{estado.etiqueta}</span>;
      },
    },
    {
      clave: 'documento_url',
      titulo: 'Doc.',
      render: (f) => f.documento_url ? (
        <a href={f.documento_url} target="_blank" rel="noopener noreferrer" className="text-[#1e3a5f] hover:text-blue-600">
          <ExternalLink size={15} />
        </a>
      ) : '—',
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      ancho: '100px',
      render: (f) => (
        <div className="flex items-center gap-2">
          <button onClick={() => abrirEditar(f)} className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors">
            <Pencil size={15} />
          </button>
          <button onClick={() => setConfirmandoEliminar(f)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={24} className="text-[#1e3a5f]" />
            Pólizas de Inquilinos
          </h1>
          <p className="text-gray-500 text-sm mt-1">{polizas.length} pólizas registradas</p>
        </div>
        <button onClick={abrirCrear} className="btn-primario">
          <Plus size={16} /> Nueva póliza
        </button>
      </div>

      {/* Aviso de inquilinos sin seguro */}
      {inquilinosSinSeguro.length > 0 && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-xl mb-5">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">
              {inquilinosSinSeguro.length} inquilino{inquilinosSinSeguro.length !== 1 ? 's' : ''} sin seguro activo:
            </span>{' '}
            {inquilinosSinSeguro.map((i) => i.nombre).join(', ')}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-5">
        <select value={filtroInquilino} onChange={(e) => setFiltroInquilino(e.target.value)} className="campo-formulario w-auto min-w-[200px]">
          <option value="">Todos los inquilinos</option>
          {inquilinos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
      </div>

      <div className="tarjeta">
        <Tabla columnas={columnas} datos={polizas} cargando={cargando} mensajeVacio="No hay pólizas de inquilinos registradas." />
      </div>

      {/* Modal alta/edición */}
      <Modal abierto={modalAbierto} onCerrar={cerrarModal} titulo={editando ? 'Editar póliza de inquilino' : 'Nueva póliza de inquilino'} ancho="max-w-2xl">
        <form onSubmit={handleGuardar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="etiqueta-formulario">Inquilino *</label>
              <select name="inquilino_id" value={formulario.inquilino_id} onChange={handleCambio} className="campo-formulario">
                <option value="">Selecciona un inquilino</option>
                {inquilinos.map((i) => <option key={i.id} value={i.id}>{i.nombre} {i.nombre_inmueble ? `— ${i.nombre_inmueble}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="etiqueta-formulario">Compañía aseguradora</label>
              <input name="compania_aseguradora" value={formulario.compania_aseguradora} onChange={handleCambio} className="campo-formulario" placeholder="Mapfre, Allianz..." />
            </div>
            <div>
              <label className="etiqueta-formulario">Número de póliza</label>
              <input name="numero_poliza" value={formulario.numero_poliza} onChange={handleCambio} className="campo-formulario font-mono" placeholder="POL-2024-XXXX" />
            </div>
            <div>
              <label className="etiqueta-formulario">Importe anual (€)</label>
              <input type="number" step="0.01" name="importe_anual" value={formulario.importe_anual} onChange={handleCambio} className="campo-formulario" placeholder="0.00" />
            </div>
            <div>
              <label className="etiqueta-formulario">Fecha de inicio</label>
              <input type="date" name="fecha_inicio" value={formulario.fecha_inicio} onChange={handleCambio} className="campo-formulario" />
            </div>
            <div>
              <label className="etiqueta-formulario">Fecha de vencimiento</label>
              <input type="date" name="fecha_vencimiento" value={formulario.fecha_vencimiento} onChange={handleCambio} className="campo-formulario" />
            </div>
            <div className="col-span-2">
              <label className="etiqueta-formulario">Documento PDF</label>
              <UploadPDF urlActual={formulario.documento_url} onSubida={(url) => setFormulario((prev) => ({ ...prev, documento_url: url }))} />
            </div>
            <div className="col-span-2">
              <label className="etiqueta-formulario">Notas</label>
              <textarea name="notas" value={formulario.notas} onChange={handleCambio} rows={3} className="campo-formulario resize-none" placeholder="Observaciones..." />
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={cerrarModal} className="btn-secundario flex-1">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primario flex-1 justify-center">
              {guardando ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : editando ? 'Guardar cambios' : 'Crear póliza'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmar eliminación */}
      <Modal abierto={!!confirmandoEliminar} onCerrar={() => setConfirmandoEliminar(null)} titulo="Confirmar eliminación" ancho="max-w-sm">
        <p className="text-gray-600 text-sm mb-6">
          ¿Eliminar la póliza <strong>{confirmandoEliminar?.numero_poliza || 'seleccionada'}</strong> de {confirmandoEliminar?.nombre_inquilino}?
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmandoEliminar(null)} className="btn-secundario flex-1">Cancelar</button>
          <button onClick={() => handleEliminar(confirmandoEliminar.id)} className="btn-peligro flex-1 justify-center">Eliminar</button>
        </div>
      </Modal>
    </div>
  );
}
