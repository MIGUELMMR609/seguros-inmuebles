import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Building2, AlertTriangle } from 'lucide-react';
import Tabla from '../components/Tabla.jsx';
import Modal from '../components/Modal.jsx';
import Toast from '../components/Toast.jsx';
import {
  obtenerInmueblesApi,
  crearInmuebleApi,
  actualizarInmuebleApi,
  eliminarInmuebleApi,
} from '../api/index.js';

const TIPOS = [
  { valor: 'piso', etiqueta: 'Piso' },
  { valor: 'nave', etiqueta: 'Nave' },
  { valor: 'local', etiqueta: 'Local' },
  { valor: 'garaje', etiqueta: 'Garaje' },
];

const formularioVacio = { nombre: '', direccion: '', tipo: 'piso', notas: '' };

export default function Inmuebles() {
  const [inmuebles, setInmuebles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);
  const [toast, setToast] = useState(null);

  const mostrarToast = useCallback((mensaje, tipo = 'info') => {
    setToast({ mensaje, tipo });
  }, []);

  async function cargar() {
    try {
      const res = await obtenerInmueblesApi();
      setInmuebles([...res.data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })));
    } catch {
      mostrarToast('Error al cargar los inmuebles', 'error');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  function abrirCrear() {
    setEditando(null);
    setFormulario(formularioVacio);
    setError('');
    setModalAbierto(true);
  }

  function abrirEditar(inmueble) {
    setEditando(inmueble);
    setFormulario({
      nombre: inmueble.nombre || '',
      direccion: inmueble.direccion || '',
      tipo: inmueble.tipo || 'piso',
      notas: inmueble.notas || '',
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
    if (!formulario.nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      if (editando) {
        await actualizarInmuebleApi(editando.id, formulario);
        mostrarToast('Inmueble actualizado correctamente', 'success');
      } else {
        await crearInmuebleApi(formulario);
        mostrarToast('Inmueble creado. Recuerda añadir una póliza de seguro.', 'warning');
      }
      await cargar();
      cerrarModal();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el inmueble');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id) {
    try {
      await eliminarInmuebleApi(id);
      setConfirmandoEliminar(null);
      mostrarToast('Inmueble eliminado correctamente', 'success');
      await cargar();
    } catch (err) {
      mostrarToast(err.response?.data?.error || 'Error al eliminar el inmueble', 'error');
    }
  }

  const columnas = [
    {
      clave: 'nombre',
      titulo: 'Nombre',
      render: (f) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{f.nombre}</span>
          {f.total_polizas === 0 && (
            <span
              title="Este inmueble no tiene ninguna póliza asignada"
              className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium"
            >
              <AlertTriangle size={11} />
              Sin póliza
            </span>
          )}
        </div>
      ),
    },
    {
      clave: 'tipo',
      titulo: 'Tipo',
      render: (f) => {
        const tipo = TIPOS.find((t) => t.valor === f.tipo);
        return tipo ? tipo.etiqueta : f.tipo;
      },
    },
    { clave: 'direccion', titulo: 'Dirección' },
    {
      clave: 'total_polizas',
      titulo: 'Pólizas',
      render: (f) => (
        <span className={`text-sm font-semibold ${f.total_polizas === 0 ? 'text-orange-500' : 'text-gray-700'}`}>
          {f.total_polizas}
        </span>
      ),
    },
    { clave: 'notas', titulo: 'Notas', render: (f) => f.notas || '—' },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      ancho: '100px',
      render: (f) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => abrirEditar(f)}
            className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors"
            title="Editar"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setConfirmandoEliminar(f)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Eliminar"
          >
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
            <Building2 size={24} className="text-[#1e3a5f]" />
            Inmuebles
          </h1>
          <p className="text-gray-500 text-sm mt-1">{inmuebles.length} inmuebles registrados</p>
        </div>
        <button onClick={abrirCrear} className="btn-primario">
          <Plus size={16} /> Añadir inmueble
        </button>
      </div>

      {/* Aviso de inmuebles sin póliza */}
      {inmuebles.some((i) => i.total_polizas === 0) && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-800 text-sm px-4 py-3 rounded-xl mb-5">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>
            Hay{' '}
            <strong>{inmuebles.filter((i) => i.total_polizas === 0).length}</strong>{' '}
            inmueble{inmuebles.filter((i) => i.total_polizas === 0).length !== 1 ? 's' : ''} sin
            póliza asignada.
          </span>
        </div>
      )}

      <div className="tarjeta">
        <Tabla
          columnas={columnas}
          datos={inmuebles}
          cargando={cargando}
          mensajeVacio="No hay inmuebles registrados. Añade el primero."
        />
      </div>

      {/* Modal alta/edición */}
      <Modal
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={editando ? 'Editar inmueble' : 'Nuevo inmueble'}
      >
        <form onSubmit={handleGuardar} className="space-y-4">
          <div>
            <label className="etiqueta-formulario">Nombre *</label>
            <input
              name="nombre"
              value={formulario.nombre}
              onChange={handleCambio}
              className="campo-formulario"
              placeholder="Ej: Piso Centro Madrid"
            />
          </div>
          <div>
            <label className="etiqueta-formulario">Tipo</label>
            <select name="tipo" value={formulario.tipo} onChange={handleCambio} className="campo-formulario">
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>{t.etiqueta}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta-formulario">Dirección</label>
            <input
              name="direccion"
              value={formulario.direccion}
              onChange={handleCambio}
              className="campo-formulario"
              placeholder="Calle, número, piso..."
            />
          </div>
          <div>
            <label className="etiqueta-formulario">Notas</label>
            <textarea
              name="notas"
              value={formulario.notas}
              onChange={handleCambio}
              rows={3}
              className="campo-formulario resize-none"
              placeholder="Observaciones adicionales..."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={cerrarModal} className="btn-secundario flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primario flex-1 justify-center">
              {guardando ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : editando ? 'Guardar cambios' : 'Crear inmueble'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmar eliminación */}
      <Modal
        abierto={!!confirmandoEliminar}
        onCerrar={() => setConfirmandoEliminar(null)}
        titulo="Confirmar eliminación"
        ancho="max-w-sm"
      >
        <p className="text-gray-600 text-sm mb-6">
          ¿Estás seguro de que quieres eliminar <strong>{confirmandoEliminar?.nombre}</strong>?
          También se eliminarán todas sus pólizas e inquilinos.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmandoEliminar(null)} className="btn-secundario flex-1">
            Cancelar
          </button>
          <button
            onClick={() => handleEliminar(confirmandoEliminar.id)}
            className="btn-peligro flex-1 justify-center"
          >
            Eliminar
          </button>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />
      )}
    </div>
  );
}
