import { useEffect, useState, useRef } from 'react';
import {
  Plus, Pencil, Trash2, Users, AlertTriangle,
  RefreshCw, UserX, FileText, Sparkles, SkipForward, Download, Euro,
} from 'lucide-react';
import Tabla from '../components/Tabla.jsx';
import Modal from '../components/Modal.jsx';
import UploadPDF from '../components/UploadPDF.jsx';
import {
  obtenerInquilinosApi, crearInquilinoApi, actualizarInquilinoApi,
  eliminarInquilinoApi, obtenerInmueblesApi,
  finalizarInquilinoApi, renovarContratoApi, generarContratoWordApi,
  analizarContratoApi,
} from '../api/index.js';

const formularioVacio = {
  inmueble_id: '',
  nombre: '',
  email: '',
  telefono: '',
  fecha_inicio_contrato: '',
  fecha_fin_contrato: '',
  importe_renta: '',
  notas: '',
  documento_url: '',
  observaciones_ia: '',
};

const renovarVacio = { fecha_inicio: '', fecha_fin: '', importe: '', notas: '' };

export default function Inquilinos() {
  const [inquilinos, setInquilinos] = useState([]);
  const [inmuebles, setInmuebles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // Modal crear/editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pasoModal, setPasoModal] = useState('pdf'); // 'pdf' | 'analizando' | 'error_pdf' | 'form'
  const [editando, setEditando] = useState(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [guardando, setGuardando] = useState(false);
  const [errorPdf, setErrorPdf] = useState('');
  const inputPdfRef = useRef(null);

  // Modal finalizar
  const [modalFinalizar, setModalFinalizar] = useState(null);
  const [motivoFinalizacion, setMotivoFinalizacion] = useState('');
  const [finalizando, setFinalizando] = useState(false);

  // Modal renovar
  const [modalRenovar, setModalRenovar] = useState(null);
  const [formularioRenovacion, setFormularioRenovacion] = useState(renovarVacio);
  const [renovando, setRenovando] = useState(false);
  const [renovacionGuardada, setRenovacionGuardada] = useState(false);
  const [idRenovado, setIdRenovado] = useState(null);
  const [generandoWord, setGenerandoWord] = useState(false);

  // Confirmar eliminar
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(null);

  async function cargar() {
    try {
      const [resInquilinos, resInmuebles] = await Promise.all([
        obtenerInquilinosApi(),
        obtenerInmueblesApi(),
      ]);
      setInquilinos(resInquilinos.data);
      setInmuebles(resInmuebles.data);
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  // --- Modal crear/editar ---
  function abrirCrear() {
    setEditando(null);
    setFormulario(formularioVacio);
    setPasoModal('pdf');
    setErrorPdf('');
    setError('');
    setModalAbierto(true);
  }

  function abrirEditar(inquilino) {
    setEditando(inquilino);
    setFormulario({
      inmueble_id: inquilino.inmueble_id || '',
      nombre: inquilino.nombre || '',
      email: inquilino.email || '',
      telefono: inquilino.telefono || '',
      fecha_inicio_contrato: inquilino.fecha_inicio_contrato ? inquilino.fecha_inicio_contrato.split('T')[0] : '',
      fecha_fin_contrato: inquilino.fecha_fin_contrato ? inquilino.fecha_fin_contrato.split('T')[0] : '',
      importe_renta: inquilino.importe_renta || '',
      notas: inquilino.notas || '',
      documento_url: inquilino.documento_url || '',
      observaciones_ia: inquilino.observaciones_ia || '',
    });
    setPasoModal('form');
    setError('');
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setEditando(null);
    setError('');
    setErrorPdf('');
    if (inputPdfRef.current) inputPdfRef.current.value = '';
  }

  function handleCambio(e) {
    setFormulario((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handlePdfArchivo(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    if (archivo.type !== 'application/pdf') {
      setErrorPdf('Solo se aceptan archivos PDF');
      return;
    }
    if (archivo.size > 10 * 1024 * 1024) {
      setErrorPdf('El archivo no puede superar 10 MB');
      return;
    }

    setErrorPdf('');
    setPasoModal('analizando');

    try {
      const res = await analizarContratoApi(archivo);
      const datos = res.data.datos;
      setFormulario((prev) => ({
        ...prev,
        nombre: datos.nombre_inquilino || prev.nombre,
        email: datos.email || prev.email,
        telefono: datos.telefono || prev.telefono,
        fecha_inicio_contrato: datos.fecha_inicio || prev.fecha_inicio_contrato,
        fecha_fin_contrato: datos.fecha_fin || prev.fecha_fin_contrato,
        importe_renta: datos.importe_renta != null ? String(datos.importe_renta) : prev.importe_renta,
        observaciones_ia: datos.observaciones_ia || prev.observaciones_ia,
      }));
      setPasoModal('form');
    } catch (err) {
      setErrorPdf(err.response?.data?.error || 'Error al analizar el contrato');
      setPasoModal('error_pdf');
    }
  }

  async function handleGuardar(e) {
    e.preventDefault();
    if (!formulario.nombre.trim()) {
      setError('El nombre del inquilino es requerido');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      if (editando) {
        await actualizarInquilinoApi(editando.id, formulario);
      } else {
        await crearInquilinoApi(formulario);
      }
      await cargar();
      cerrarModal();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el inquilino');
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id) {
    try {
      await eliminarInquilinoApi(id);
      setConfirmandoEliminar(null);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar el inquilino');
    }
  }

  // --- Modal finalizar ---
  function abrirFinalizar(inquilino) {
    setModalFinalizar(inquilino);
    setMotivoFinalizacion('');
  }

  async function handleFinalizar() {
    setFinalizando(true);
    try {
      await finalizarInquilinoApi(modalFinalizar.id, { motivo: motivoFinalizacion });
      setModalFinalizar(null);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al finalizar el contrato');
    } finally {
      setFinalizando(false);
    }
  }

  // --- Modal renovar ---
  function abrirRenovar(inquilino) {
    setModalRenovar(inquilino);
    setFormularioRenovacion({
      fecha_inicio: inquilino.fecha_inicio_contrato ? inquilino.fecha_inicio_contrato.split('T')[0] : '',
      fecha_fin: inquilino.fecha_fin_contrato ? inquilino.fecha_fin_contrato.split('T')[0] : '',
      importe: inquilino.importe_renta || '',
      notas: '',
    });
    setRenovacionGuardada(false);
    setIdRenovado(null);
  }

  function cerrarRenovar() {
    setModalRenovar(null);
    setRenovacionGuardada(false);
    setIdRenovado(null);
  }

  async function handleRenovar(e) {
    e.preventDefault();
    setRenovando(true);
    try {
      await renovarContratoApi(modalRenovar.id, formularioRenovacion);
      setRenovacionGuardada(true);
      setIdRenovado(modalRenovar.id);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al renovar el contrato');
    } finally {
      setRenovando(false);
    }
  }

  async function handleGenerarWord(id) {
    setGenerandoWord(true);
    try {
      const res = await generarContratoWordApi(id);
      const nombreInquilino = modalRenovar?.nombre || 'inquilino';
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `contrato_${nombreInquilino.replace(/\s+/g, '_')}.docx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Error al generar el contrato Word');
    } finally {
      setGenerandoWord(false);
    }
  }

  // --- Tabla ---
  const columnas = [
    {
      clave: 'nombre_inmueble', titulo: 'Inmueble', sortable: true,
      valorOrden: (f) => f.nombre_inmueble || '',
      render: (f) => <span className="font-medium">{f.nombre_inmueble || '—'}</span>,
    },
    { clave: 'nombre', titulo: 'Nombre', render: (f) => f.nombre },
    {
      clave: 'email', titulo: 'Email',
      render: (f) => f.email
        ? <a href={`mailto:${f.email}`} className="text-[#1e3a5f] hover:underline">{f.email}</a>
        : '—',
    },
    { clave: 'telefono', titulo: 'Teléfono', render: (f) => f.telefono || '—' },
    {
      clave: 'importe_renta', titulo: 'Renta/mes',
      render: (f) => f.importe_renta
        ? <span className="font-medium">{parseFloat(f.importe_renta).toFixed(2)} €</span>
        : '—',
    },
    {
      clave: 'fecha_inicio_contrato', titulo: 'Inicio',
      render: (f) => f.fecha_inicio_contrato
        ? new Date(f.fecha_inicio_contrato).toLocaleDateString('es-ES')
        : '—',
    },
    {
      clave: 'fecha_fin_contrato', titulo: 'Fin contrato', sortable: true,
      valorOrden: (f) => f.fecha_fin_contrato || '9999-12-31',
      render: (f) => {
        if (!f.fecha_fin_contrato) return '—';
        const fecha = new Date(f.fecha_fin_contrato);
        const hoy = new Date();
        const dias = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
        const pasado = dias < 0;
        const proximo = dias >= 0 && dias <= 30;
        return (
          <div className="flex items-center gap-2">
            <span className={pasado ? 'text-red-600 font-medium' : proximo ? 'text-orange-600 font-medium' : ''}>
              {fecha.toLocaleDateString('es-ES')}
            </span>
            {proximo && (
              <span className="inline-flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">
                <AlertTriangle size={10} />
                {dias}d
              </span>
            )}
            {pasado && (
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                Vencido
              </span>
            )}
          </div>
        );
      },
    },
    {
      clave: 'acciones',
      titulo: 'Acciones',
      ancho: '140px',
      render: (f) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => abrirRenovar(f)}
            title="Renovar contrato"
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => abrirFinalizar(f)}
            title="Finalizar contrato"
            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
          >
            <UserX size={15} />
          </button>
          <button
            onClick={() => abrirEditar(f)}
            title="Editar"
            className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setConfirmandoEliminar(f)}
            title="Eliminar"
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users size={24} className="text-[#1e3a5f]" />
            Inquilinos
          </h1>
          <p className="text-gray-500 text-sm mt-1">{inquilinos.length} inquilinos activos</p>
        </div>
        <button onClick={abrirCrear} className="btn-primario">
          <Plus size={16} /> Añadir inquilino
        </button>
      </div>

      <div className="tarjeta">
        <Tabla columnas={columnas} datos={inquilinos} cargando={cargando} mensajeVacio="No hay inquilinos activos." />
      </div>

      {/* Modal crear/editar */}
      <Modal
        abierto={modalAbierto}
        onCerrar={cerrarModal}
        titulo={editando ? 'Editar inquilino' : 'Nuevo inquilino'}
        ancho="max-w-2xl"
      >
        {/* Paso PDF (solo al crear) */}
        {!editando && pasoModal === 'pdf' && (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <FileText size={32} className="text-[#1e3a5f]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¿Tienes el contrato en PDF?
            </h3>
            <p className="text-sm text-gray-500 mb-8 max-w-xs">
              Si tienes el PDF del contrato de arrendamiento, la IA puede extraer automáticamente los datos del formulario.
            </p>
            <div className="flex gap-3 w-full max-w-sm">
              <button
                type="button"
                onClick={() => inputPdfRef.current?.click()}
                className="btn-primario flex-1 justify-center"
              >
                <Sparkles size={16} />
                Sí, analizar PDF
              </button>
              <button
                type="button"
                onClick={() => setPasoModal('form')}
                className="btn-secundario flex-1 justify-center"
              >
                <SkipForward size={16} />
                Omitir
              </button>
            </div>
            <input
              ref={inputPdfRef}
              type="file"
              accept="application/pdf"
              onChange={handlePdfArchivo}
              className="hidden"
            />
          </div>
        )}

        {/* Paso analizando */}
        {!editando && pasoModal === 'analizando' && (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e3a5f]" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Analizando el contrato...</h3>
            <p className="text-sm text-gray-500">La IA está leyendo el documento. Esto puede tardar unos segundos.</p>
          </div>
        )}

        {/* Error PDF */}
        {!editando && pasoModal === 'error_pdf' && (
          <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No se pudo analizar el PDF</h3>
            <p className="text-sm text-red-600 mb-6">{errorPdf}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setPasoModal('pdf'); setErrorPdf(''); if (inputPdfRef.current) inputPdfRef.current.value = ''; }}
                className="btn-secundario"
              >
                Intentar de nuevo
              </button>
              <button type="button" onClick={() => setPasoModal('form')} className="btn-primario">
                Continuar sin PDF
              </button>
            </div>
            <input
              ref={inputPdfRef}
              type="file"
              accept="application/pdf"
              onChange={handlePdfArchivo}
              className="hidden"
            />
          </div>
        )}

        {/* Formulario */}
        {pasoModal === 'form' && (
          <form onSubmit={handleGuardar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="etiqueta-formulario">Nombre completo *</label>
                <input name="nombre" value={formulario.nombre} onChange={handleCambio} className="campo-formulario" placeholder="Juan García López" />
              </div>
              <div className="col-span-2">
                <label className="etiqueta-formulario">Inmueble asociado</label>
                <select name="inmueble_id" value={formulario.inmueble_id} onChange={handleCambio} className="campo-formulario">
                  <option value="">Sin inmueble asignado</option>
                  {inmuebles.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="etiqueta-formulario">Email</label>
                <input type="email" name="email" value={formulario.email} onChange={handleCambio} className="campo-formulario" placeholder="inquilino@email.com" />
              </div>
              <div>
                <label className="etiqueta-formulario">Teléfono</label>
                <input name="telefono" value={formulario.telefono} onChange={handleCambio} className="campo-formulario" placeholder="600 000 000" />
              </div>
              <div>
                <label className="etiqueta-formulario">Inicio del contrato</label>
                <input type="date" name="fecha_inicio_contrato" value={formulario.fecha_inicio_contrato} onChange={handleCambio} className="campo-formulario" />
              </div>
              <div>
                <label className="etiqueta-formulario">Fin del contrato</label>
                <input type="date" name="fecha_fin_contrato" value={formulario.fecha_fin_contrato} onChange={handleCambio} className="campo-formulario" />
              </div>
              <div className="col-span-2">
                <label className="etiqueta-formulario">Renta mensual (€)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="importe_renta"
                    value={formulario.importe_renta}
                    onChange={handleCambio}
                    className="campo-formulario pl-8"
                    placeholder="800.00"
                    step="0.01"
                    min="0"
                  />
                  <Euro size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
              <div className="col-span-2">
                <label className="etiqueta-formulario">Documento del contrato (PDF)</label>
                <UploadPDF
                  urlActual={formulario.documento_url}
                  onSubida={(url) => setFormulario((prev) => ({ ...prev, documento_url: url }))}
                />
              </div>
              <div className="col-span-2">
                <label className="etiqueta-formulario">Notas</label>
                <textarea name="notas" value={formulario.notas} onChange={handleCambio} rows={2} className="campo-formulario resize-none" placeholder="Observaciones..." />
              </div>
              {formulario.observaciones_ia && (
                <div className="col-span-2">
                  <label className="etiqueta-formulario flex items-center gap-1">
                    <Sparkles size={13} className="text-[#1e3a5f]" />
                    Análisis IA del contrato
                  </label>
                  <textarea
                    name="observaciones_ia"
                    value={formulario.observaciones_ia}
                    onChange={handleCambio}
                    rows={3}
                    className="campo-formulario resize-none bg-blue-50 border-blue-200 text-blue-900 text-sm"
                    placeholder="Observaciones extraídas por IA..."
                  />
                </div>
              )}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={cerrarModal} className="btn-secundario flex-1">Cancelar</button>
              <button type="submit" disabled={guardando} className="btn-primario flex-1 justify-center">
                {guardando ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : editando ? 'Guardar cambios' : 'Crear inquilino'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal finalizar contrato */}
      <Modal abierto={!!modalFinalizar} onCerrar={() => setModalFinalizar(null)} titulo="Finalizar contrato" ancho="max-w-sm">
        <p className="text-gray-600 text-sm mb-4">
          ¿Finalizar el contrato de <strong>{modalFinalizar?.nombre}</strong>? El inquilino pasará al histórico.
        </p>
        <div className="mb-4">
          <label className="etiqueta-formulario">Motivo (opcional)</label>
          <textarea
            value={motivoFinalizacion}
            onChange={(e) => setMotivoFinalizacion(e.target.value)}
            rows={3}
            className="campo-formulario resize-none"
            placeholder="Fin de contrato, impago, acuerdo mutuo..."
          />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setModalFinalizar(null)} className="btn-secundario flex-1">Cancelar</button>
          <button
            onClick={handleFinalizar}
            disabled={finalizando}
            className="btn-peligro flex-1 justify-center"
          >
            {finalizando ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Finalizar contrato'}
          </button>
        </div>
      </Modal>

      {/* Modal renovar contrato */}
      <Modal abierto={!!modalRenovar} onCerrar={cerrarRenovar} titulo={`Renovar contrato — ${modalRenovar?.nombre || ''}`} ancho="max-w-lg">
        {renovacionGuardada ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <RefreshCw size={28} className="text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Contrato renovado</h3>
            <p className="text-sm text-gray-500 mb-6">Los datos del contrato han sido actualizados correctamente.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={cerrarRenovar} className="btn-secundario">Cerrar</button>
              <button
                onClick={() => handleGenerarWord(idRenovado)}
                disabled={generandoWord}
                className="btn-primario"
              >
                {generandoWord
                  ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  : <><Download size={15} /> Generar contrato Word</>
                }
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRenovar} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="etiqueta-formulario">Nueva fecha inicio</label>
                <input
                  type="date"
                  value={formularioRenovacion.fecha_inicio}
                  onChange={(e) => setFormularioRenovacion((p) => ({ ...p, fecha_inicio: e.target.value }))}
                  className="campo-formulario"
                />
              </div>
              <div>
                <label className="etiqueta-formulario">Nueva fecha fin</label>
                <input
                  type="date"
                  value={formularioRenovacion.fecha_fin}
                  onChange={(e) => setFormularioRenovacion((p) => ({ ...p, fecha_fin: e.target.value }))}
                  className="campo-formulario"
                />
              </div>
              <div className="col-span-2">
                <label className="etiqueta-formulario">Nueva renta mensual (€)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formularioRenovacion.importe}
                    onChange={(e) => setFormularioRenovacion((p) => ({ ...p, importe: e.target.value }))}
                    className="campo-formulario pl-8"
                    placeholder="800.00"
                    step="0.01"
                    min="0"
                  />
                  <Euro size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>
              <div className="col-span-2">
                <label className="etiqueta-formulario">Notas de la renovación</label>
                <textarea
                  value={formularioRenovacion.notas}
                  onChange={(e) => setFormularioRenovacion((p) => ({ ...p, notas: e.target.value }))}
                  rows={2}
                  className="campo-formulario resize-none"
                  placeholder="Condiciones acordadas, subida de renta..."
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={cerrarRenovar} className="btn-secundario flex-1">Cancelar</button>
              <button type="submit" disabled={renovando} className="btn-primario flex-1 justify-center">
                {renovando ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Guardar renovación'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal confirmar eliminación */}
      <Modal abierto={!!confirmandoEliminar} onCerrar={() => setConfirmandoEliminar(null)} titulo="Confirmar eliminación" ancho="max-w-sm">
        <p className="text-gray-600 text-sm mb-6">
          ¿Eliminar al inquilino <strong>{confirmandoEliminar?.nombre}</strong>? También se eliminarán sus pólizas asociadas.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setConfirmandoEliminar(null)} className="btn-secundario flex-1">Cancelar</button>
          <button onClick={() => handleEliminar(confirmandoEliminar.id)} className="btn-peligro flex-1 justify-center">Eliminar</button>
        </div>
      </Modal>
    </div>
  );
}
