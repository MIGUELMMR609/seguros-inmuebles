import { useEffect, useState, useRef } from 'react';
import {
  Plus, Pencil, Trash2, Users, AlertTriangle,
  RefreshCw, UserX, FileText, Sparkles, SkipForward, Download, Euro, Printer,
} from 'lucide-react';
import { imprimirInformeContrato } from '../utils/imprimirInforme.js';
import Tabla from '../components/Tabla.jsx';
import Modal from '../components/Modal.jsx';
import UploadPDF from '../components/UploadPDF.jsx';
import {
  obtenerInquilinosApi, crearInquilinoApi, actualizarInquilinoApi,
  eliminarInquilinoApi, obtenerInmueblesApi,
  finalizarInquilinoApi, renovarContratoApi, generarContratoWordApi,
  analizarContratoExpertoApi,
} from '../api/index.js';
import { analizarContratoApi } from '../api/index.js';

const formularioVacio = {
  inmueble_id: '',
  nombre: '',
  tomador_contrato: '',
  email: '',
  telefono: '',
  fecha_inicio_contrato: '',
  fecha_fin_contrato: '',
  importe_renta: '',
  notas: '',
  documento_url: '',
  observaciones_ia: '',
  clausulas_principales: '',
  clausulas_perjudiciales: '',
  obligaciones_inquilino: '',
  obligaciones_propietario: '',
  analisis_juridico: '',
  recomendaciones_contrato: '',
  valoracion_contrato: '',
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

  // Modal análisis jurídico IA
  const [modalAnalisis, setModalAnalisis] = useState(false);
  const [inquilinoAnalisis, setInquilinoAnalisis] = useState(null);
  const [analisisActual, setAnalisisActual] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState('');

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
      tomador_contrato: inquilino.tomador_contrato || '',
      email: inquilino.email || '',
      telefono: inquilino.telefono || '',
      fecha_inicio_contrato: inquilino.fecha_inicio_contrato ? inquilino.fecha_inicio_contrato.split('T')[0] : '',
      fecha_fin_contrato: inquilino.fecha_fin_contrato ? inquilino.fecha_fin_contrato.split('T')[0] : '',
      importe_renta: inquilino.importe_renta || '',
      notas: inquilino.notas || '',
      documento_url: inquilino.documento_url || '',
      observaciones_ia: inquilino.observaciones_ia || '',
      clausulas_principales: inquilino.clausulas_principales || '',
      clausulas_perjudiciales: inquilino.clausulas_perjudiciales || '',
      obligaciones_inquilino: inquilino.obligaciones_inquilino || '',
      obligaciones_propietario: inquilino.obligaciones_propietario || '',
      analisis_juridico: inquilino.analisis_juridico || '',
      recomendaciones_contrato: inquilino.recomendaciones_contrato || '',
      valoracion_contrato: inquilino.valoracion_contrato || '',
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
      const { datos, documento_url } = res.data;
      setFormulario((prev) => ({
        ...prev,
        nombre: datos.nombre_inquilino || prev.nombre,
        email: datos.email || prev.email,
        telefono: datos.telefono || prev.telefono,
        fecha_inicio_contrato: datos.fecha_inicio || prev.fecha_inicio_contrato,
        fecha_fin_contrato: datos.fecha_fin || prev.fecha_fin_contrato,
        importe_renta: datos.importe_renta != null ? String(datos.importe_renta) : prev.importe_renta,
        clausulas_principales: datos.clausulas_principales || prev.clausulas_principales,
        clausulas_perjudiciales: datos.clausulas_perjudiciales || prev.clausulas_perjudiciales,
        obligaciones_inquilino: datos.obligaciones_inquilino || prev.obligaciones_inquilino,
        obligaciones_propietario: datos.obligaciones_propietario || prev.obligaciones_propietario,
        analisis_juridico: datos.analisis_juridico || prev.analisis_juridico,
        recomendaciones_contrato: datos.recomendaciones_contrato || prev.recomendaciones_contrato,
        valoracion_contrato: datos.valoracion_contrato != null ? String(datos.valoracion_contrato) : prev.valoracion_contrato,
        documento_url: documento_url || prev.documento_url,
      }));
      setPasoModal('form');
    } catch (err) {
      setErrorPdf(err.response?.data?.error || err.message || 'Error al analizar el contrato');
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
      window.dispatchEvent(new CustomEvent('refreshBadges'));
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
      window.dispatchEvent(new CustomEvent('refreshBadges'));
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
      window.dispatchEvent(new CustomEvent('refreshBadges'));
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
      window.dispatchEvent(new CustomEvent('refreshBadges'));
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

  // --- Modal análisis jurídico IA ---
  function abrirAnalisis(inquilino) {
    setInquilinoAnalisis(inquilino);
    setErrorAnalisis('');
    if (inquilino.fecha_ultimo_analisis_contrato) {
      setAnalisisActual({
        clausulas_principales: inquilino.clausulas_principales,
        clausulas_perjudiciales: inquilino.clausulas_perjudiciales,
        obligaciones_inquilino: inquilino.obligaciones_inquilino,
        obligaciones_propietario: inquilino.obligaciones_propietario,
        analisis_juridico: inquilino.analisis_juridico,
        recomendaciones_contrato: inquilino.recomendaciones_contrato,
        valoracion_contrato: inquilino.valoracion_contrato,
        fecha_ultimo_analisis_contrato: inquilino.fecha_ultimo_analisis_contrato,
      });
    } else {
      setAnalisisActual(null);
    }
    setModalAnalisis(true);
  }

  function cerrarModalAnalisis() {
    setModalAnalisis(false);
    setInquilinoAnalisis(null);
    setAnalisisActual(null);
    setAnalizando(false);
    setErrorAnalisis('');
  }

  async function handleAnalizarExperto() {
    setAnalizando(true);
    setErrorAnalisis('');
    try {
      const res = await analizarContratoExpertoApi(inquilinoAnalisis.id);
      setAnalisisActual(res.data);
      await cargar();
    } catch (err) {
      setErrorAnalisis(err.response?.data?.error || 'Error al analizar el contrato');
    } finally {
      setAnalizando(false);
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
      ancho: '185px',
      render: (f) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => abrirRenovar(f)}
            title="Renovar contrato"
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={() => abrirFinalizar(f)}
            title="Finalizar contrato"
            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
          >
            <UserX size={20} />
          </button>
          <button
            onClick={() => abrirAnalisis(f)}
            title="Análisis jurídico IA"
            className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            <Sparkles size={20} />
          </button>
          <button
            onClick={() => abrirEditar(f)}
            title="Editar"
            className="p-1.5 text-gray-400 hover:text-[#1e3a5f] hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Pencil size={20} />
          </button>
          <button
            onClick={() => setConfirmandoEliminar(f)}
            title="Eliminar"
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={20} />
          </button>
        </div>
      ),
    },
  ];

  // --- Helpers análisis ---
  function badgeValoracion(v) {
    const num = parseFloat(v);
    if (isNaN(num)) return null;
    const color = num >= 7 ? 'bg-green-100 text-green-700' : num >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
    return <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-bold ${color}`}>{num.toFixed(1)}/10</span>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
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

              {/* Análisis jurídico IA (solo si hay datos) */}
              {(formulario.clausulas_principales || formulario.clausulas_perjudiciales || formulario.analisis_juridico || formulario.recomendaciones_contrato) && (
                <div className="col-span-2 space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-purple-200">
                    <Sparkles size={14} className="text-purple-600" />
                    <span className="text-sm font-semibold text-purple-700">Análisis jurídico IA</span>
                    {formulario.valoracion_contrato && (
                      <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                        {parseFloat(formulario.valoracion_contrato).toFixed(1)}/10
                      </span>
                    )}
                  </div>
                  {formulario.clausulas_principales && (
                    <div>
                      <label className="etiqueta-formulario">Cláusulas principales</label>
                      <textarea name="clausulas_principales" value={formulario.clausulas_principales} onChange={handleCambio} rows={2} className="campo-formulario resize-none text-sm bg-blue-50 border-blue-200" />
                    </div>
                  )}
                  {formulario.clausulas_perjudiciales && (
                    <div>
                      <label className="etiqueta-formulario">Cláusulas perjudiciales</label>
                      <textarea name="clausulas_perjudiciales" value={formulario.clausulas_perjudiciales} onChange={handleCambio} rows={2} className="campo-formulario resize-none text-sm bg-red-50 border-red-200" />
                    </div>
                  )}
                  {formulario.obligaciones_inquilino && (
                    <div>
                      <label className="etiqueta-formulario">Obligaciones del inquilino</label>
                      <textarea name="obligaciones_inquilino" value={formulario.obligaciones_inquilino} onChange={handleCambio} rows={2} className="campo-formulario resize-none text-sm" />
                    </div>
                  )}
                  {formulario.obligaciones_propietario && (
                    <div>
                      <label className="etiqueta-formulario">Obligaciones del propietario</label>
                      <textarea name="obligaciones_propietario" value={formulario.obligaciones_propietario} onChange={handleCambio} rows={2} className="campo-formulario resize-none text-sm" />
                    </div>
                  )}
                  {formulario.analisis_juridico && (
                    <div>
                      <label className="etiqueta-formulario">Análisis jurídico</label>
                      <textarea name="analisis_juridico" value={formulario.analisis_juridico} onChange={handleCambio} rows={3} className="campo-formulario resize-none text-sm bg-blue-50 border-blue-200" />
                    </div>
                  )}
                  {formulario.recomendaciones_contrato && (
                    <div>
                      <label className="etiqueta-formulario">Recomendaciones</label>
                      <textarea name="recomendaciones_contrato" value={formulario.recomendaciones_contrato} onChange={handleCambio} rows={2} className="campo-formulario resize-none text-sm bg-green-50 border-green-200" />
                    </div>
                  )}
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

      {/* Modal análisis jurídico IA */}
      <Modal
        abierto={modalAnalisis}
        onCerrar={cerrarModalAnalisis}
        titulo={`Análisis jurídico IA — ${inquilinoAnalisis?.nombre || ''}`}
        ancho="max-w-2xl"
      >
        {!inquilinoAnalisis?.documento_url ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <FileText size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium mb-1">Sin documento del contrato</p>
            <p className="text-sm text-gray-400">Sube el PDF del contrato para poder realizar el análisis jurídico.</p>
          </div>
        ) : analizando ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
            <p className="text-gray-700 font-medium mb-1">Analizando el contrato...</p>
            <p className="text-sm text-gray-400">La IA está revisando el contrato. Puede tardar hasta un minuto.</p>
          </div>
        ) : analisisActual ? (
          <div className="space-y-4">
            {/* Cabecera valoración + fecha */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500 font-medium">Valoración:</span>
                {analisisActual.valoracion_contrato
                  ? badgeValoracion(analisisActual.valoracion_contrato)
                  : <span className="text-gray-400 text-sm">—</span>
                }
              </div>
              {analisisActual.fecha_ultimo_analisis_contrato && (
                <span className="text-xs text-gray-400">
                  Analizado el {new Date(analisisActual.fecha_ultimo_analisis_contrato).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Cláusulas principales */}
            {analisisActual.clausulas_principales && (
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Cláusulas principales</p>
                <p className="text-sm text-blue-900 whitespace-pre-line">{analisisActual.clausulas_principales}</p>
              </div>
            )}

            {/* Cláusulas perjudiciales */}
            {analisisActual.clausulas_perjudiciales && (
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">Cláusulas perjudiciales para el arrendador</p>
                <p className="text-sm text-red-900 whitespace-pre-line">{analisisActual.clausulas_perjudiciales}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Obligaciones inquilino */}
              {analisisActual.obligaciones_inquilino && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Obligaciones del inquilino</p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{analisisActual.obligaciones_inquilino}</p>
                </div>
              )}

              {/* Obligaciones propietario */}
              {analisisActual.obligaciones_propietario && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Obligaciones del propietario</p>
                  <p className="text-sm text-gray-800 whitespace-pre-line">{analisisActual.obligaciones_propietario}</p>
                </div>
              )}
            </div>

            {/* Análisis jurídico */}
            {analisisActual.analisis_juridico && (
              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Análisis jurídico (conformidad LAU)</p>
                <p className="text-sm text-indigo-900 whitespace-pre-line">{analisisActual.analisis_juridico}</p>
              </div>
            )}

            {/* Recomendaciones */}
            {analisisActual.recomendaciones_contrato && (
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Recomendaciones</p>
                <p className="text-sm text-green-900 whitespace-pre-line">{analisisActual.recomendaciones_contrato}</p>
              </div>
            )}

            {errorAnalisis && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{errorAnalisis}</div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => imprimirInformeContrato(analisisActual, inquilinoAnalisis)}
                className="btn-secundario flex items-center gap-2"
              >
                <Printer size={14} />
                Imprimir informe
              </button>
              <button
                type="button"
                onClick={handleAnalizarExperto}
                disabled={analizando}
                className="btn-primario bg-purple-600 hover:bg-purple-700"
              >
                <Sparkles size={15} />
                Regenerar análisis
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles size={28} className="text-purple-400" />
            </div>
            <p className="text-gray-700 font-medium mb-1">Sin análisis jurídico</p>
            <p className="text-sm text-gray-400 mb-6">
              Haz clic en "Analizar con IA" para que un experto jurídico revise el contrato.
            </p>
            {errorAnalisis && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4 w-full">{errorAnalisis}</div>
            )}
            <button
              type="button"
              onClick={handleAnalizarExperto}
              disabled={analizando}
              className="btn-primario bg-purple-600 hover:bg-purple-700"
            >
              <Sparkles size={15} />
              Analizar con IA
            </button>
          </div>
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
